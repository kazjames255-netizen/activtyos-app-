import { db } from "../firebase";
import { stripe, toPence } from "./stripe";
import { fromDoc, toDoc, type BookingDoc } from "./bookingDoc";
import { notify } from "./notify";
import { shouldReleaseDiscountCodes } from "./bookingGuards";
import { bellTitle, bellBody, bellMoney, bellDay } from "./bellText";
import { emailBookingRequestReceived } from "./emails";
import { notifyPaymentReceived, bookingDocId } from "../routes/bookings";
import { blockCountDelta, bookingSeats, heldPlaces, placesDelta, placesDeltaIsZero, applyPlacesDelta, type BlockDoc } from "./blockDomain";
import { applyRowAction } from "../../../features/bookings/mutations";
import type { Booking } from "../../../features/bookings/types";

// ─────────────────────────────────────────────────────────────────────────
// CARD HOLD — manual-approval listings paid by card.
//
// The family's card is AUTHORISED when they book (PaymentIntent, capture_method "manual": the money is held on their card, not taken).
// The provider approving the booking CAPTURES it; declining or cancelling RELEASES it. Stripe lets a card authorisation stand for about
// 7 days, then cancels it itself - so the provider is told the deadline, and a sweep (and the payment_intent.canceled webhook) declines
// a booking nobody answered in time.
//
// One basket (two children) = one card, one PaymentIntent, one booking row per child. Stripe can capture a PaymentIntent only ONCE (a
// partial capture drops the rest), so approving a row captures the rows approved TOGETHER; a row still waiting afterwards loses its hold
// and the family pays for it after approval, the ordinary way.
// ─────────────────────────────────────────────────────────────────────────

/** How long Stripe keeps a card authorisation. The real figure comes from the charge (capture_before) when Stripe gives it. */
export const HOLD_DAYS = 7;
/** The provider gets a reminder when this long is left. */
export const REMIND_HOURS = 48;
/** A family who never entered their card within this long loses the request. */
export const AWAITING_CARD_HOURS = 24;

/** Does this new booking need a card hold? (manual approval, paid by card, something to pay, not an operator booking.) */
export function wantsCardHold(b: Pick<Booking, "status" | "amount">, method: unknown, onBehalf: unknown): boolean {
  return b.status === "Approval needed" && /^card$/i.test(String(method)) && (b.amount ?? 0) > 0 && !onBehalf;
}

/** The provider-facing deadline, e.g. "Thursday 15 October, 14:30". */
export function deadlineLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

/** The warning every provider email about a held booking carries. */
export function deadlineWarningHtml(expiresAt: string): string {
  return `<p style="margin:14px 0;padding:12px 14px;border:2px solid #f0c96b;border-radius:10px;background:#fff7e0;color:#7a4b00;font-size:14px;line-height:1.5">
    <b>Please approve or decline by ${deadlineLabel(expiresAt)}.</b><br>
    The family's card is held, not charged. Stripe releases a card hold after ${HOLD_DAYS} days: if you haven't answered by then, the hold is cancelled, no money is taken and the booking is cancelled automatically.</p>`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const round2 = (n: number) => Math.round(n * 100) / 100;

async function bookingsOfRefs(tenantId: string, refs: string[]) {
  const snaps = await Promise.all(refs.map((r) => db.collection("bookings").doc(bookingDocId(tenantId, r)).get()));
  return snaps.filter((s) => s.exists).map((s) => ({ ref: s.ref, b: fromDoc(s.data() as BookingDoc) }));
}

/** Every booking row sharing this hold. */
async function holdGroup(tenantId: string, intentId: string) {
  const snap = await db.collection("bookings").where("tenantId", "==", tenantId).where("cardHold.intentId", "==", intentId).get();
  return snap.docs.map((d) => ({ ref: d.ref, b: fromDoc(d.data() as BookingDoc) }));
}

/**
 * The family's card was authorised (Stripe says requires_capture). Idempotent: the browser callback and the webhook both call it.
 * Stamps the booking rows as held, then - ONCE - tells the family (card held, not charged) and the provider (approve by <deadline>).
 */
export async function markHeld(paymentId: string): Promise<"held" | "already" | "unknown"> {
  if (!stripe) return "unknown";
  const payRef = db.collection("payments").doc(paymentId);
  const at = new Date().toISOString();
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(payRef);
    if (!snap.exists) return null;
    const rec = snap.data() as { status?: string };
    if (rec.status === "held" || rec.status === "succeeded" || rec.status === "released") return null;
    tx.update(payRef, { status: "held", heldAt: at });
    return snap.data() as { tenantId: string; refs?: string[]; paymentIntentId: string; stripeAccount: string | null };
  });
  if (!claimed) return (await payRef.get()).exists ? "already" : "unknown";

  // Stripe says exactly when the authorisation lapses; fall back to the standard window.
  let expiresAt = new Date(Date.now() + HOLD_DAYS * 86_400_000).toISOString();
  try {
    const pi = await stripe.paymentIntents.retrieve(claimed.paymentIntentId, { expand: ["latest_charge"] }, claimed.stripeAccount ? { stripeAccount: claimed.stripeAccount } : undefined);
    const ch = pi.latest_charge as { payment_method_details?: { card?: { capture_before?: number } } } | null;
    const cb = ch?.payment_method_details?.card?.capture_before;
    if (cb) expiresAt = new Date(cb * 1000).toISOString();
  } catch (e) { console.error("[cardHold] couldn't read capture_before:", (e as Error).message); }

  const rows = await bookingsOfRefs(claimed.tenantId, claimed.refs ?? []);
  const held: Booking[] = [];
  const batch = db.batch();
  for (const { ref, b } of rows) {
    if (b.cardHold?.state !== "awaiting" || b.status !== "Approval needed") continue; // declined/cancelled while the card was being entered
    b.cardHold = { ...b.cardHold, state: "held", intentId: claimed.paymentIntentId, paymentId, heldAt: at, expiresAt };
    b.paymentIntentId = claimed.paymentIntentId;
    b.stripeAccount = claimed.stripeAccount;
    b.cardFailed = false;
    batch.set(ref, toDoc(b));
    held.push(b);
  }
  await batch.commit();
  if (!held.length) {
    // Nothing left to approve (the request was withdrawn while the card was being entered): give the money back.
    await cancelIntent(claimed.paymentIntentId, claimed.stripeAccount);
    await payRef.update({ status: "released" }).catch(() => {});
    return "held";
  }
  void announceHeld(claimed.tenantId, held, expiresAt).catch((e) => console.error("[cardHold] announce failed:", (e as Error).message));
  return "held";
}

/** Family: "card held, not charged". Provider: "approve by <deadline>". */
async function announceHeld(tenantId: string, held: Booking[], expiresAt: string): Promise<void> {
  const b0 = held[0];
  const tenantDoc = await db.collection("tenants").doc(tenantId).get();
  const providerName = (tenantDoc.get("name") as string) || "your provider";
  if (b0.email?.includes("@")) emailBookingRequestReceived(b0, providerName, held.map((h) => h.ref));
  // The provider gets the SAME rich notice as any new booking (date, children's health notes, address + access note, money) plus the deadline.
  const listingSnap = b0.listingId ? await db.collection("listings").doc(b0.listingId).get() : null;
  const listing = { tenantId, tenantName: providerName, name: b0.listing, ...((listingSnap?.exists ? listingSnap.data() : {}) as Record<string, unknown>) } as { tenantId: string; tenantName?: string; name: string };
  const { notifyProviderNewBooking } = await import("../routes/my");
  notifyProviderNewBooking({ listing: { ...listing, tenantId, tenantName: (listing.tenantName as string | undefined) ?? providerName, name: (listing.name as string | undefined) ?? b0.listing }, bookings: held, method: "card", listingId: b0.listingId ?? "", bookerName: b0.booker, heldUntil: expiresAt });
}

async function cancelIntent(intentId: string, stripeAccount: string | null | undefined): Promise<void> {
  if (!stripe) return;
  try {
    await stripe.paymentIntents.cancel(intentId, {}, stripeAccount ? { stripeAccount } : undefined);
  } catch (e) {
    // Already cancelled / already captured is fine: the aim (no hold left standing) is met or moot.
    console.error(`[cardHold] cancel ${intentId}:`, (e as Error).message);
  }
}

export type CaptureResult = { ok: true } | { ok: false; error: string };

/**
 * The provider approved these bookings: take the money. `rows` are the bookings being approved (already Confirmed in the DB).
 * Rows of the same card are captured together; a sibling still waiting loses its hold (see the header note).
 */
export async function captureHolds(rows: Booking[]): Promise<CaptureResult> {
  if (!stripe) return { ok: false, error: "Card payments aren't connected" };
  const byIntent = new Map<string, Booking[]>();
  for (const b of rows) if (b.cardHold?.state === "held" && b.cardHold.intentId) byIntent.set(b.cardHold.intentId, [...(byIntent.get(b.cardHold.intentId) ?? []), b]);
  for (const [intentId, group] of byIntent) {
    const tenantId = group[0].tenantId!;
    const amount = round2(group.reduce((s, b) => s + (b.cardHold?.amount ?? 0), 0));
    const acct = group[0].stripeAccount ?? undefined;
    try {
      await stripe.paymentIntents.capture(intentId, { amount_to_capture: toPence(amount) }, { idempotencyKey: `capture-${intentId}-${toPence(amount)}`, ...(acct ? { stripeAccount: acct } : {}) });
    } catch (e) {
      const msg = (e as Error).message;
      console.error(`[cardHold] capture ${intentId} failed:`, msg);
      return { ok: false, error: /expired|canceled|cancelled|no longer|cannot be captured/i.test(msg) ? "The card hold has expired, so the payment can't be taken. Ask the family to book again." : msg };
    }
    const at = new Date().toISOString();
    // Record the capture against each booking's CURRENT state (read inside a transaction), never against the copy read before the capture:
    // a booking cancelled / declined while the card was being taken must not be written back as approved + paid.
    const all = await holdGroup(tenantId, intentId);
    const approvedRefs = new Set(group.map((b) => b.ref));
    const settled: Booking[] = [];
    let endedPence = 0;
    await db.runTransaction(async (tx) => {
      settled.length = 0;
      endedPence = 0;
      const mine = await Promise.all(group.map((b) => tx.get(db.collection("bookings").doc(bookingDocId(tenantId, b.ref)))));
      const sibs = await Promise.all(all.filter(({ b }) => !approvedRefs.has(b.ref)).map(({ ref }) => tx.get(ref)));
      for (const snap of mine) {
        if (!snap.exists) continue;
        const cur = fromDoc(snap.data() as BookingDoc);
        const paidAmount = group.find((g) => g.ref === cur.ref)?.cardHold?.amount ?? cur.cardHold?.amount ?? 0;
        if (cur.status !== "Confirmed" || cur.pay === "Paid") {
          if (cur.pay !== "Paid") endedPence += toPence(paidAmount); // ended while the money was being taken: it goes back below
          continue;
        }
        cur.pay = "Paid";
        cur.amountPaid = paidAmount;
        cur.cardHold = { ...(cur.cardHold ?? { amount: paidAmount }), state: "captured" } as Booking["cardHold"];
        cur.reconciledBy = { at, by: "Card hold captured on approval", auto: true };
        tx.set(snap.ref, toDoc(cur));
        settled.push(cur);
      }
      // Siblings of the same card that weren't approved with these lose their hold (the capture dropped the rest of the authorisation).
      for (const snap of sibs) {
        if (!snap.exists) continue;
        const cur = fromDoc(snap.data() as BookingDoc);
        if (cur.cardHold?.state !== "held") continue;
        cur.cardHold = { ...cur.cardHold, state: "released" };
        tx.set(snap.ref, toDoc(cur));
      }
    });
    // Claim the payment record: a double-click on Approve (or a retry) captures idempotently but must tell the family only ONCE.
    let first = true;
    const payId = group[0].cardHold?.paymentId;
    let refundEnded = false;
    if (payId) {
      const payRef = db.collection("payments").doc(payId);
      first = await db.runTransaction(async (tx) => {
        const ps = await tx.get(payRef);
        const cur = ps.data() as { status?: string; capturedAmount?: number } | undefined;
        if (ps.exists && cur?.status?.startsWith("duplicate")) return false; // already handed back
        if (ps.exists && cur?.status === "succeeded" && cur.capturedAmount === amount) return false;
        if (endedPence > 0) {
          // Money was taken for bookings that had ended: the existing late-payment refund hands it back (one refund, one notice each side).
          const kept = toPence(amount) - endedPence;
          tx.update(payRef, kept > 0
            ? { status: "succeeded", paidAt: at, settledAuto: true, capturedAmount: round2(kept / 100), excess: { pence: endedPence, state: "pending", reason: "not-payable" } }
            : { status: "duplicate", duplicateDetectedAt: at, excess: { pence: endedPence, state: "pending", reason: "not-payable" } });
          refundEnded = true;
          return kept > 0;
        }
        tx.update(payRef, { status: "succeeded", paidAt: at, settledAuto: true, capturedAmount: amount });
        return true;
      });
      if (refundEnded) await (await import("./settlePayment")).refundExcess(payRef).catch((e) => console.error("[cardHold] refund of money taken for an ended booking:", (e as Error).message));
    }
    if (first && settled.length) await notifyPaymentReceived(tenantId, settled[0], "card", settled, true).catch((e) => console.error("[cardHold] payment-received notice:", (e as Error).message));
  }
  return { ok: true };
}

/**
 * These bookings were declined / cancelled / withdrawn: let the family's card go. Only when nothing else still waits on the same card -
 * a sibling still pending keeps the authorisation.
 */
export async function releaseHolds(rows: Booking[]): Promise<void> {
  const byIntent = new Map<string, Booking[]>();
  for (const b of rows) if ((b.cardHold?.state === "held" || b.cardHold?.state === "awaiting") && b.cardHold.intentId) byIntent.set(b.cardHold.intentId, [...(byIntent.get(b.cardHold.intentId) ?? []), b]);
  for (const [intentId, group] of byIntent) {
    const tenantId = group[0].tenantId!;
    const mine = new Set(group.map((b) => b.ref));
    const all = await holdGroup(tenantId, intentId);
    const stillWaiting = all.some(({ b }) => !mine.has(b.ref) && b.cardHold?.state === "held" && b.status === "Approval needed");
    // Mark each booking's hold released from its CURRENT state (a capture finishing at this instant must not be overwritten by an older copy).
    await db.runTransaction(async (tx) => {
      const snaps = await Promise.all(all.filter(({ b }) => mine.has(b.ref)).map(({ ref }) => tx.get(ref)));
      for (const sn of snaps) {
        if (!sn.exists) continue;
        const cur = fromDoc(sn.data() as BookingDoc);
        if (cur.cardHold?.state !== "held" && cur.cardHold?.state !== "awaiting") continue; // captured / already released meanwhile: leave it
        cur.cardHold = { ...cur.cardHold, state: "released" };
        tx.set(sn.ref, toDoc(cur));
      }
    });
    if (stillWaiting) continue;
    await cancelIntent(intentId, group[0].stripeAccount);
    const payId = group[0].cardHold?.paymentId;
    if (payId) {
      // Only an authorisation nobody took: a payment that was captured / refunded in the meantime keeps its record (succeeded, duplicate-refunded...).
      const payRef = db.collection("payments").doc(payId);
      await db.runTransaction(async (tx) => {
        const d = (await tx.get(payRef)).data() as { status?: string } | undefined;
        if (d && (d.status === "created" || d.status === "held")) tx.update(payRef, { status: "released" });
      }).catch(() => {});
    }
  }
}

/** Decline a booking on the platform's own authority (the hold lapsed, or the card was never entered): status, seats and the family's email. */
export async function systemDecline(b: Booking, reason: string, state: "expired" | "released"): Promise<void> {
  const tenantId = b.tenantId!;
  const ref = db.collection("bookings").doc(bookingDocId(tenantId, b.ref));
  const updated = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const cur = fromDoc(snap.data() as BookingDoc);
    if (cur.status !== "Approval needed") return null; // answered in the meantime
    const before = structuredClone({ status: cur.status, seats: cur.seats, days: cur.days, kids: cur.kids });
    applyRowAction(cur, "decline");
    cur.declineReason = reason;
    cur.cardHold = cur.cardHold ? { ...cur.cardHold, state } : undefined;
    let blockUpdate: { ref: FirebaseFirestore.DocumentReference; counts: ReturnType<typeof applyPlacesDelta> } | null = null;
    if (cur.blockId && blockCountDelta("Approval needed", cur.status, bookingSeats(cur)) !== 0) {
      const bs = await tx.get(db.collection("blocks").doc(cur.blockId));
      if (bs.exists) {
        const block = bs.data() as BlockDoc;
        const pd = placesDelta(heldPlaces(before, block), heldPlaces(cur, block));
        if (!placesDeltaIsZero(pd)) blockUpdate = { ref: bs.ref, counts: applyPlacesDelta(block, pd) };
      }
    }
    tx.set(ref, toDoc(cur));
    if (blockUpdate) tx.update(blockUpdate.ref, { ...blockUpdate.counts });
    return cur;
  });
  if (!updated) return;
  // The request lapsed (or the card never came), so the family never got the place: any discount code it used goes back.
  if (shouldReleaseDiscountCodes(updated)) void import("./discountRedemptions").then((m) => m.releaseDiscountCodes(tenantId, updated.ref)).catch(() => {});
  if (updated.blockId) void import("./waitlist").then((m) => m.triggerWaitlist(updated.blockId!)).catch(() => {});
  if (updated.email?.includes("@")) {
    const { emailBookingDeclined } = await import("./emails");
    const name = ((await db.collection("tenants").doc(tenantId).get()).get("name") as string) || "your provider";
    emailBookingDeclined(updated, name, reason);
  }
}

/**
 * Sweep: (1) a held booking the provider hasn't answered with REMIND_HOURS left gets one reminder; (2) a hold past its deadline is declined
 * (Stripe has already cancelled it, or we cancel it now); (3) a family who never entered their card loses the request after a day.
 */
export async function cardHoldSweep(): Promise<void> {
  const now = Date.now();
  const snap = await db.collection("bookings").where("cardHold.state", "in", ["held", "awaiting"]).limit(400).get();
  for (const d of snap.docs) {
    const b = fromDoc(d.data() as BookingDoc);
    if (b.status !== "Approval needed" || !b.cardHold || !b.tenantId) continue;
    try {
      if (b.cardHold.state === "awaiting") {
        const made = b.createdAt ? Date.parse(b.createdAt) : now;
        if (now - made > AWAITING_CARD_HOURS * 3_600_000) {
          await releaseHolds([b]);
          await systemDecline(b, "The card details were never entered, so the request was cancelled.", "released");
        }
        continue;
      }
      const exp = b.cardHold.expiresAt ? Date.parse(b.cardHold.expiresAt) : NaN;
      if (!Number.isFinite(exp)) continue;
      if (now >= exp) {
        await releaseHolds([b]);
        await systemDecline(b, "The provider didn't approve in time, so the card hold was released and no payment was taken.", "expired");
        void notify({ tenantId: b.tenantId, to: { kind: "tenant" }, category: "booking", bellOnly: true, title: bellTitle("request-expired", b.ref), body: bellBody(["Card held", bellMoney(b.cardHold?.amount ?? b.amount ?? 0), "Released"]), href: `/company/bookings?ref=${encodeURIComponent(b.ref)}`, ref: b.ref });
      } else if (exp - now <= REMIND_HOURS * 3_600_000) {
        const { fireOnce } = await import("./scheduler");
        await fireOnce(`holdremind_${b.tenantId}_${b.ref}`, { tenantId: b.tenantId }, () =>
          notify({
            tenantId: b.tenantId!,
            to: { kind: "tenant" },
            category: "booking",
            title: bellTitle("answer-by", b.ref),
            body: bellBody(["Card held", bellMoney(b.cardHold?.amount ?? b.amount ?? 0), bellDay(b.cardHold!.expiresAt!)]),
            subject: `Reminder: answer ${b.booker}'s request by ${deadlineLabel(b.cardHold!.expiresAt!)} (${b.ref})`,
            href: `/company/bookings?ref=${encodeURIComponent(b.ref)}`,
            ref: b.ref,
            emailHtml: `<p>${esc(b.booker)}'s request for <b>${esc(b.listing)}</b> (${esc(b.ref)}) is still waiting for you.</p>${deadlineWarningHtml(b.cardHold!.expiresAt!)}`,
          }),
        );
      }
    } catch (e) { console.error(`[cardHold] sweep ${b.ref}:`, (e as Error).message); }
  }
}

/** payment_intent.canceled from Stripe: a hold we didn't release ourselves lapsed - decline whatever still waits on it. */
export async function holdCanceledByStripe(paymentId: string): Promise<void> {
  const snap = await db.collection("payments").doc(paymentId).get();
  if (!snap.exists) return;
  const rec = snap.data() as { tenantId: string; refs?: string[]; status?: string };
  if (rec.status === "released" || rec.status === "succeeded") return;
  await snap.ref.update({ status: "released" });
  for (const { b } of await bookingsOfRefs(rec.tenantId, rec.refs ?? [])) {
    if (b.status === "Approval needed" && (b.cardHold?.state === "held" || b.cardHold?.state === "awaiting"))
      await systemDecline(b, "The card hold lapsed before the provider approved, so no payment was taken.", "expired");
  }
}
