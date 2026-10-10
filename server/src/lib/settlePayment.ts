import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import { fromDoc, toDoc, type BookingDoc } from "./bookingDoc";
import { bookingDocId, notifyPaymentReceived } from "../routes/bookings";
import { notify } from "./notify";
import { stripe } from "./stripe";
import { cancelOpenIntents } from "./checkoutIntent";
import { providerPaidBell } from "./providerPaidBell";
import { paidSoFar, cashReceivedOf } from "../../../features/bookings/helpers";
import { balanceOf } from "./payGate";
import type { Booking } from "../../../features/bookings/types";
import { clearKitCache } from "./kitCache";

// ─────────────────────────────────────────────────────────────────────────
// Settling a card payment — the ONE place that turns "Stripe took the money"
// into "the booking/meal/invoice is paid".
//
// It used to live only in the browser-callback handlers (POST
// /api/payments/checkout/:id/confirm and the pay-link confirm), so a parent
// who closed the tab as the payment confirmed left money taken at Stripe and
// nothing recorded here (backlog b7). The Stripe webhook now calls the same
// functions, which is why they must stay idempotent: both paths routinely run
// for the same payment, and Stripe retries deliveries.
//
// Idempotency rests on the `payments` doc's own status: the first caller to
// flip it to "succeeded" does the writes, later callers no-op.
// ─────────────────────────────────────────────────────────────────────────

export interface PaymentRec {
  tenantId: string;
  refs?: string[];
  mealOrderIds?: string[];
  invoiceId?: string;
  paymentIntentId: string;
  stripeAccount: string | null;
  status: string;
  email?: string;
}

export type SettleResult = "settled" | "already" | "unknown";

/** Who settled it, for the audit stamp on the booking. */
export interface SettleBy {
  /** Stripe's webhook (nobody was at the keyboard) rather than a browser. */
  auto: boolean;
  by: string;
}

/** The `payments` record for a Stripe PaymentIntent, or null if we never
 *  created one (a charge made outside ActivityOS). */
export async function paymentForIntent(intentId: string): Promise<{ id: string; rec: PaymentRec } | null> {
  const snap = await db.collection("payments").where("paymentIntentId", "==", intentId).limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, rec: snap.docs[0].data() as PaymentRec };
}

/**
 * Mark the bookings / meal orders a payment covers as paid.
 *
 * `by.auto` records that this was settled without the payer's browser — the
 * Reconciliation badge reads "Auto-reconciled" rather than naming a person
 * (backlog cc5). The HMRC EPP feed, when it lands, stamps the same shape.
 */
async function settlePaymentRecordInner(paymentId: string, by: SettleBy): Promise<SettleResult> {
  const payRef = db.collection("payments").doc(paymentId);
  const at = new Date().toISOString();

  const before = await payRef.get();
  if (!before.exists) return "unknown";
  const pre = before.data() as PaymentRec & { hold?: boolean; amount?: number; excess?: Excess };
  // Money still to be handed back from an earlier settlement whose refund did not complete (crash / Stripe error): retry it.
  if (pre.excess && pre.excess.state !== "refunded") {
    await refundExcess(payRef);
    return "already";
  }

  // Meal orders (and card HOLDs, which are captured booking-by-booking on approval, never settled as a whole here).
  if (pre.mealOrderIds?.length || pre.hold) {
    const claimed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(payRef);
      if (!snap.exists) return null;
      const rec = snap.data() as PaymentRec & { hold?: boolean };
      if (rec.status === "succeeded" || rec.status.startsWith("duplicate") || rec.hold) return null;
      tx.update(payRef, { status: "succeeded", paidAt: at, settledAuto: by.auto });
      return rec;
    });
    if (!claimed?.mealOrderIds?.length) return "already";
    const batch = db.batch();
    for (const id of claimed.mealOrderIds) {
      const oSnap = await db.collection("mealOrders").doc(id).get();
      if (!oSnap.exists) continue;
      batch.set(oSnap.ref, { pay: "Paid", amountPaid: oSnap.data()!.total ?? 0, paidAt: at, paymentIntentId: claimed.paymentIntentId }, { merge: true });
    }
    await batch.commit();
    return "settled";
  }

  // Booking payments: claim the payment AND settle the bookings in ONE transaction. The check "is this money still owed?" is made
  // against the bookings as read inside that same transaction, so two settlements arriving together (browser confirm + webhook,
  // two intents for one booking) are serialised by Firestore: the second one re-reads the bookings the first one paid.
  // Whatever the payment exceeds what is still owed (a whole second payment, or the part left over after cash/another card
  // payment arrived meanwhile) is never recorded: it is marked as excess and refunded below.
  const settled: Booking[] = [];
  const confirmedNow = new Set<string>();
  const outcome = await db.runTransaction(async (tx) => {
    settled.length = 0;
    confirmedNow.clear();
    const snap = await tx.get(payRef);
    if (!snap.exists) return null;
    const rec = snap.data() as PaymentRec & { amount?: number };
    if (rec.status === "succeeded" || rec.status.startsWith("duplicate")) return null;
    const bSnaps = await Promise.all((rec.refs ?? []).map((r) => tx.get(db.collection("bookings").doc(bookingDocId(rec.tenantId, r)))));
    let owed = 0;
    let notPayable = false;
    const todo: { ref: FirebaseFirestore.DocumentReference; b: Booking }[] = [];
    for (const bSnap of bSnaps) {
      if (!bSnap.exists) continue;
      const b = fromDoc(bSnap.data() as BookingDoc);
      const bal = balanceOf(b);
      // A booking that has ended (cancelled, declined, released by the unpaid-card sweep) can never take money, whatever is still
      // "outstanding" on it: the payment is refunded in full and the booking is left exactly as it is.
      if (b.status === "Cancelled" || b.status === "Declined") { notPayable = true; continue; }
      if (b.pay === "Paid" || bal <= 0.005) { if (b.pay !== "Paid" && b.status === "Waitlisted") notPayable = true; continue; } // already paid by something else (or no longer payable): this payment does not touch it
      owed += bal;
      todo.push({ ref: bSnap.ref, b });
    }
    const paidPence = typeof rec.amount === "number" ? Math.round(rec.amount * 100) : Math.round(owed * 100);
    const excessPence = Math.max(0, paidPence - Math.round(owed * 100));
    if (!todo.length) {
      tx.update(payRef, { status: "duplicate", duplicateDetectedAt: at, excess: { pence: paidPence, state: "pending", reason: notPayable ? "not-payable" : "paid" } });
      return { kind: "duplicate" as const, rec };
    }
    for (const { ref, b } of todo) {
      // Part-paid Tax-Free Childcare: the card took only the remainder. The HMRC
      // portion is still awaited, so the booking stays "Awaiting voucher payment"
      // (operator: Mark Tax-Free Childcare received) with the split recorded.
      const tfcSplit = (b.tfcAmount ?? 0) > 0 && (b.amount ?? 0) > (b.tfcAmount ?? 0);
      // A parent's own card booking (pay 'Unpaid', place Confirmed) had its 'booked in' email held back until the card went through: the
      // payment email is then the ONE confirmation. (An operator's invoice, or a part-paid voucher, was confirmed earlier.)
      if (b.status === "Confirmed" && b.pay === "Unpaid" && !tfcSplit && !b.cardHold) confirmedNow.add(b.ref);
      if (tfcSplit) {
        const taken = balanceOf(b);
        b.cardPaid = Math.round(((b.cardPaid ?? 0) + taken) * 100) / 100;
        b.amountPaid = Math.round((cashReceivedOf(b) + taken) * 100) / 100;
        b.pay = b.amountPaid >= (b.amount ?? 0) - 0.005 ? "Paid" : "Awaiting voucher payment";
      } else {
        b.pay = "Paid";
        // What was actually taken, so a later part-refund or cancel works from
        // real money rather than inferring it from the status word.
        b.amountPaid = b.amount;
      }
      b.paymentIntentId = rec.paymentIntentId;
      b.stripeAccount = rec.stripeAccount;
      b.cardFailed = false;
      if (by.auto) b.reconciledBy = { at, by: by.by, auto: true };
      tx.set(ref, toDoc(b));
      settled.push(b);
    }
    tx.update(payRef, { status: "succeeded", paidAt: at, settledAuto: by.auto, ...(excessPence > 0 ? { excess: { pence: excessPence, state: "pending", reason: notPayable ? "not-payable" : "partly-paid" } } : {}) });
    return { kind: "settled" as const, rec };
  });
  if (!outcome) return (await payRef.get()).exists ? "already" : "unknown";
  const claimed = outcome.rec;
  if (outcome.kind === "duplicate") {
    await refundExcess(payRef);
    return "already";
  }
  // This payment is the one that counts: any other card payment still open for these bookings can no longer be needed.
  await cancelOpenIntents(claimed.tenantId, claimed.refs ?? [], claimed.paymentIntentId).catch(() => {});
  // Anything beyond what was owed goes straight back.
  await refundExcess(payRef).catch((e) => console.error("[settle] excess refund:", (e as Error).message));
  // Tell the family their card payment landed — the same email + bell an
  // operator's manual "record payment" sends. Runs after the commit and only on
  // the claiming caller, so a webhook retry or a late browser confirm can't
  // send it twice. Best-effort: a mail failure must never undo settled money.
  // One payment, one email: bookings for the same family settled together (a basket spanning weeks) share it.
  const byFamily = new Map<string, typeof settled>();
  // Same family AND same activity: one payment across two different activities must not describe one with the other's dates.
  const famKey = (b: (typeof settled)[number]) => `${(b.email ?? "").toLowerCase()}|${b.listingId ?? b.listing ?? ""}`;
  for (const b of settled) byFamily.set(famKey(b), [...(byFamily.get(famKey(b)) ?? []), b]);
  for (const grp of byFamily.values()) {
    await notifyPaymentReceived(claimed.tenantId, grp[0], "card", grp, false, grp.every((x) => confirmedNow.has(x.ref)))
      .catch((e) => console.error(`[settle] payment-received notice for ${grp[0].ref}:`, (e as Error).message));
    // The provider's bell said 'awaiting card payment' when the family booked: tell them it has now landed.
    const pb = providerPaidBell(grp, grp.every((x) => confirmedNow.has(x.ref)));
    void notify({
      tenantId: claimed.tenantId,
      to: { kind: "tenant" },
      category: "billing",
      key: "booking-new",
      title: pb.title,
      body: pb.body,
      subject: `${pb.title} · ${grp[0].booker}`,
      emailHtml: `<p>${pb.detail.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p><p style="font-size:13px;color:#6a6785">The card payment has landed, so there is nothing left to chase on this booking.</p>`,
      href: `/company/bookings?ref=${encodeURIComponent(grp[0].ref)}`,
      ref: grp[0].ref,
    });
  }
  return "settled";
}

/** Money a card payment took beyond what was owed: pending until Stripe has refunded it. */
export interface Excess { pence: number; state: "pending" | "refunded" | "failed"; refundId?: string; failures?: number; reason?: ExcessReason }
/** Why part or all of a payment was not owed: the booking was already paid, other money covered part of it, or the booking could no longer take a payment. */
export type ExcessReason = "paid" | "partly-paid" | "not-payable";

/** The provider's alert for an automatic refund (pure, so the wording is tested). */
export function excessMessage(a: { reason?: ExcessReason; full: boolean; pence: number; where: string; refunded: boolean; pi: string }): { title: string; body: string } {
  const money = `£${(a.pence / 100).toFixed(2)}`;
  const what = a.reason === "not-payable"
    ? `A card payment of ${money} arrived for ${a.where}, but the booking was no longer payable (it was cancelled, declined or on the waiting list), so nothing was recorded against it.`
    : a.full
      ? `A second card payment of ${money} arrived for ${a.where}, which was already paid.`
      : `A card payment arrived for ${a.where} that was ${money} more than was still owed (other money had been received meanwhile).`;
  const body = a.refunded
    ? `${what} The ${a.full ? "payment" : "extra"} ${money} was refunded automatically and not recorded.`
    : `${what} The ${a.full ? "payment" : "extra"} ${money} was NOT recorded and the automatic refund failed: please refund it in Stripe (payment ${a.pi}).`;
  return { title: a.refunded ? "Card payment refunded automatically" : "Card payment needs refunding", body };
}

/**
 * Hand back the part of a card payment that was not owed: all of it when the bookings were already paid (a duplicate payment,
 * recorded as status duplicate*), or just the excess when something else (cash, another card payment) had paid part of it
 * meanwhile. Idempotent: the Stripe refund is keyed on the PaymentIntent, the amount and the number of definite failures so
 * far (a failed refund is replayed by Stripe for 24h under the same key, so a retry needs a fresh one), and a refunded record
 * is left alone, so webhook retries, a repeated event and the browser confirm can never refund twice. A refund Stripe already
 * made for this record (found by metadata) is adopted instead of repeated. If Stripe refuses, the record says so
 * (duplicate-needs-refund / excess.state failed), the provider is asked to refund by hand, and the next delivery tries again.
 * A partial excess also writes a refund row so Money in, reconciliation and the refundable amount stay net.
 */
export async function refundExcess(payRef: FirebaseFirestore.DocumentReference, client: any = stripe): Promise<void> {
  const snap = await payRef.get();
  const rec = snap.data() as (PaymentRec & { amount?: number; excess?: Excess }) | undefined;
  if (!rec?.excess || rec.excess.state === "refunded") return;
  const full = rec.status.startsWith("duplicate");
  const wasPending = rec.excess.state === "pending";
  const pence = rec.excess.pence;
  const failures = rec.excess.failures ?? 0;
  const where = (rec.refs ?? []).join(", ");
  let refundId: string | null = null;
  let failure = "";
  let definite = false;
  try {
    if (!client) throw new Error("Stripe is not configured");
    const opts = rec.stripeAccount ? { stripeAccount: rec.stripeAccount } : undefined;
    // A refund an earlier attempt got through (we may have crashed before writing it down): adopt it.
    const made = client.refunds.list ? (await client.refunds.list({ payment_intent: rec.paymentIntentId, limit: 100 }, opts)).data.find((x: any) => x.metadata?.excessFor === snap.id && x.status !== "failed" && x.status !== "canceled") : null;
    if (made) refundId = made.id;
    else {
      const r = await client.refunds.create(
        { payment_intent: rec.paymentIntentId, amount: pence, reason: "duplicate", metadata: { duplicateOf: where, tenantId: rec.tenantId, excessFor: snap.id, activityosOrigin: "app" } },
        { idempotencyKey: `excess-refund-${rec.paymentIntentId}-${pence}-f${failures}`, ...(opts ?? {}) },
      );
      refundId = r.id;
    }
  } catch (e) {
    failure = (e as Error).message;
    definite = typeof (e as { statusCode?: number }).statusCode === "number"; // Stripe answered: a retry needs a new key. A timeout keeps the key (a replay is safe).
    console.error(`[settle] automatic refund of ${pence}p excess on payment ${snap.id} (${rec.paymentIntentId}) failed:`, failure);
  }
  const at = new Date().toISOString();
  if (refundId) {
    await payRef.update({ "excess.state": "refunded", "excess.refundId": refundId, "excess.refundedAt": at, ...(full ? { status: "duplicate-refunded", refundId, refundedAt: at } : {}) });
    // A full duplicate was never counted as money in (its status is not succeeded), so only a PART refund of a counted payment needs a row.
    if (!full) {
      await db.collection("payments").doc(`excess-${snap.id}`).set({
        tenantId: rec.tenantId, refs: rec.refs ?? [], type: "refund", amount: pence / 100, currency: "gbp", paymentIntentId: rec.paymentIntentId,
        stripeAccount: rec.stripeAccount ?? null, status: "succeeded", refundId, reason: "excess", createdAt: at, paidAt: at,
      });
    }
  } else {
    await payRef.update({ "excess.state": "failed", "excess.failure": failure.slice(0, 300), "excess.failures": failures + (definite ? 1 : 0), ...(full ? { status: "duplicate-needs-refund", refundFailure: failure.slice(0, 300) } : {}) });
  }
  // Tell people ONCE per payment. Which messages go out is decided inside a transaction on the payment record that stamps
  // them as sent (excess.notifiedFailed / notifiedRefunded / notifiedFamily), so however many deliveries (webhook, browser
  // confirm, replays, sweeps) reach this point together, exactly one of them wins each claim and the rest send nothing.
  const famEmail = (rec as { email?: string }).email;
  const familyWanted = !!refundId && full && rec.excess.reason === "not-payable" && !!famEmail?.includes("@");
  const claim = await db.runTransaction(async (tx) => {
    const cur = (await tx.get(payRef)).data() as { excess?: Excess & { notifiedFailed?: string; notifiedRefunded?: string; notifiedFamily?: string } } | undefined;
    const ex: { notifiedFailed?: string; notifiedRefunded?: string; notifiedFamily?: string } = cur?.excess ?? {};
    const upd: Record<string, string> = {};
    let provider = false;
    let family = false;
    if (refundId) {
      if (!ex.notifiedRefunded) { upd["excess.notifiedRefunded"] = at; provider = true; }
      if (familyWanted && !ex.notifiedFamily) { upd["excess.notifiedFamily"] = at; family = true; }
    } else if (!ex.notifiedFailed) { upd["excess.notifiedFailed"] = at; provider = true; }
    if (Object.keys(upd).length) tx.update(payRef, upd);
    return { provider, family };
  });
  if (claim.provider) {
    const m = excessMessage({ reason: rec.excess.reason, full, pence, where, refunded: !!refundId, pi: rec.paymentIntentId });
    void notify({
      tenantId: rec.tenantId, to: { kind: "tenant" }, category: "billing", key: "payment-duplicate",
      title: m.title, body: m.body, subject: m.title,
      emailHtml: `<p>${m.body.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`,
      href: `/company/bookings?ref=${encodeURIComponent((rec.refs ?? [])[0] ?? "")}`, ref: (rec.refs ?? [])[0],
    });
  }
  // The family paid for a booking that had ended: tell them plainly that nothing was taken (once, when the refund has gone).
  if (claim.family && famEmail) {
    const money = `£${(pence / 100).toFixed(2)}`;
    const text = `Your card payment of ${money} for booking ${where} could not be used because the booking had already been cancelled, so nothing has been taken: it has been refunded in full. It can take a few days to show on your statement.`;
    void notify({
      tenantId: rec.tenantId, to: { kind: "parent", email: famEmail }, category: "billing",
      title: "Your payment was refunded", body: text, subject: "Your payment was refunded - nothing was taken",
      emailHtml: `<p>${text}</p>`, href: `/custdash/bookings?open=${encodeURIComponent((rec.refs ?? [])[0] ?? "")}`, ref: (rec.refs ?? [])[0],
    });
  }
}

/** What the payer's browser is told about a payment after settlement: "refunded" (the booking could not take it and it went back),
 *  "refunding" (same, the refund is still being completed), or "settled" (the normal case, including "already paid by something else"). */
export async function paymentOutcome(paymentId: string): Promise<"refunded" | "refunding" | "settled"> {
  const d = (await db.collection("payments").doc(paymentId).get()).data() as (PaymentRec & { excess?: Excess }) | undefined;
  if (!d || !d.status.startsWith("duplicate") || d.excess?.reason !== "not-payable") return "settled";
  return d.status === "duplicate-refunded" ? "refunded" : "refunding";
}

/**
 * An invoice raised for a booking settles THAT booking when it's paid. It
 * didn't: the invoice flipped to paid and the booking still said Unpaid, so
 * the family could be chased (and pay) again, and Money-in counted the money
 * twice — once as an invoice, once when the booking was paid.
 *
 * Idempotent: the invoice is stamped bookingSettledAt, so a repeated confirm
 * or a re-save of "paid" never adds the money to the booking twice.
 */
export async function settleInvoiceBooking(invId: string, extra: { paymentIntentId?: string; via: string }): Promise<void> {
  const invRef = db.collection("invoices").doc(invId);
  await db.runTransaction(async (tx) => {
    const inv = (await tx.get(invRef)).data();
    if (!inv || inv.status !== "paid" || inv.bookingSettledAt || !inv.bookingRef || !inv.tenantId) return;
    const bRef = db.collection("bookings").doc(`${inv.tenantId}_${String(inv.bookingRef).trim()}`);
    const bSnap = await tx.get(bRef);
    if (!bSnap.exists) return; // free-text ref that isn't one of ours — nothing to settle
    const b = bSnap.data() as Booking;
    if (b.status === "Cancelled") return;
    // Cash already in, counted the way refunds count it (a legacy "Paid" row
    // with no amountPaid was paid in full) — so a top-up invoice on a paid
    // booking can't knock it back to "Partially paid".
    const cashBefore = paidSoFar(b) - Math.max(0, b.walletApplied ?? 0);
    const paid = Math.round((cashBefore + Number(inv.amount ?? 0)) * 100) / 100;
    tx.set(bRef, {
      amountPaid: paid,
      pay: paid + Math.max(0, b.walletApplied ?? 0) >= (b.amount ?? 0) - 0.005 ? "Paid" : "Partially paid",
      paidAt: new Date().toISOString(),
      settledByInvoice: invId,
      // The booking's own card payment (paymentIntentId + stripeAccount) is
      // what a refund goes back to — keep it; the invoice's is recorded beside.
      ...(extra.paymentIntentId ? { invoicePaymentIntentIds: FieldValue.arrayUnion(extra.paymentIntentId) } : {}),
    }, { merge: true });
    tx.set(invRef, { bookingSettledAt: new Date().toISOString(), bookingSettledVia: extra.via }, { merge: true });
  });
}

/** Mark an invoice paid from its own PaymentIntent, then settle its booking.
 *  Used by the pay-link confirm and by the webhook when the payer's browser
 *  never came back. */
async function settleInvoicePaymentInner(paymentId: string, invoiceId: string, intentId: string, by: SettleBy): Promise<SettleResult> {
  const payRef = db.collection("payments").doc(paymentId);
  const invRef = db.collection("invoices").doc(invoiceId);
  const at = new Date().toISOString();
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(payRef);
    if (!snap.exists) return false;
    if ((snap.data() as PaymentRec).status === "succeeded") return false;
    // "link" — paid through the pay-link (card), matching the operator-side
    // paidVia vocabulary ("link" | "manual").
    tx.set(invRef, { status: "paid", paidAt: at, paidVia: "link", paymentIntentId: intentId }, { merge: true });
    tx.update(payRef, { status: "succeeded", paidAt: at, settledAuto: by.auto });
    return true;
  });
  await settleInvoiceBooking(invoiceId, { paymentIntentId: intentId, via: "link" });
  return claimed ? "settled" : "already";
}

/**
 * A card that failed at Stripe. The banner and the `cardFailed` field already
 * existed with nothing to set them (backlog item 9) — the webhook is the only
 * place that learns about a failure the payer's browser never reported.
 */
export async function markCardFailed(intentId: string, failed: boolean): Promise<void> {
  const found = await paymentForIntent(intentId);
  if (!found) return;
  const { rec } = found;
  const batch = db.batch();
  for (const bookingRef of rec.refs ?? []) {
    const bRef = db.collection("bookings").doc(bookingDocId(rec.tenantId, bookingRef));
    if (!(await bRef.get()).exists) continue;
    batch.set(bRef, { cardFailed: failed }, { merge: true });
  }
  await batch.commit();
}

export async function settlePaymentRecord(...a: Parameters<typeof settlePaymentRecordInner>): ReturnType<typeof settlePaymentRecordInner> {
  try { return await settlePaymentRecordInner(...a); } finally { clearKitCache(); }
}
export async function settleInvoicePayment(...a: Parameters<typeof settleInvoicePaymentInner>): ReturnType<typeof settleInvoicePaymentInner> {
  try { return await settleInvoicePaymentInner(...a); } finally { clearKitCache(); }
}
