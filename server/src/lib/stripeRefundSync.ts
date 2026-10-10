import type Stripe from "stripe";
import { db } from "../firebase";
import { stripe } from "./stripe";
import { fromDoc, toDoc, type BookingDoc } from "./bookingDoc";
import { notify } from "./notify";
import { withBusyRetry } from "./busyRetry";
import { resolvePendingCancel } from "./pendingRefund";
import { ukToday } from "./ukDate";
import { clearKitCache } from "./kitCache";
import { bookingDocId } from "../routes/bookings";
import { cashReceivedOf, refundableSoFar } from "../../../features/bookings/helpers";
import type { Booking } from "../../../features/bookings/types";
import type { PaymentRec } from "./settlePayment";

// ─────────────────────────────────────────────────────────────────────────
// Refunds made OUTSIDE the app (the Stripe dashboard, the connected account
// owner's own dashboard) used to be invisible: Stripe showed "Refunded", the
// books still said "Paid" and counted the money as collected.
//
// This is the one place that turns a Stripe refund into our books. The Stripe
// webhook calls it for every refund event, and "Check Stripe for refunds"
// (POST /api/payments/sync-refunds) calls it for refunds made before the
// webhook existed. Both are safe to repeat.
//
// THE RULES
//  - Idempotent per Stripe refund id: the record is `payments/stripe-refund-<refundId>`, created inside a transaction, so
//    duplicate / replayed / concurrent deliveries record it once and tell the provider once.
//  - A refund the APP made is never recorded again. It is recognised by its metadata (activityosOrigin, stamped when we
//    create it, so an event that arrives before our own row is written is still ours) or, for older refunds, by a
//    payments row that already carries its refund id.
//  - It records: a `payments` refund row (via "stripe", reason "refunded in Stripe", refund id) that Payout transactions
//    reads, and a "Refunded in Stripe" refundLog line on each booking that Finance / Reconciliation / "Collected so far" read, so
//    they all show it exactly like the app's own card refunds. Booking pay becomes Refunded / Partially refunded.
//  - It NEVER cancels the booking, never touches refundedApproved, never mints wallet credit. The provider gets ONE bell.
//  - A payment covering several bookings: the refund is attributed pro rata to each booking's share of the cash paid,
//    each capped at what that booking can still give back (allocateRefund); a booking with no room passes its share on.
//  - The recorded total can never exceed the payment (a larger refund is clamped).
//  - A refund Stripe later marks failed / canceled is taken back off again.
//  - Disputes are a different thing and not handled here.
// ─────────────────────────────────────────────────────────────────────────

export type SyncResult = "recorded" | "own" | "unknown" | "ignored" | "reversed" | "unchanged";

/** Split a refund (pence) across bookings: pro rata by weight, never more than a booking's headroom, rounding pennies to the
 *  last booking with room, the remainder of a capped booking passed on. Never allocates more than the bookings can give back. */
export function allocateRefund(totalPence: number, parts: { ref: string; weight: number; headroom: number }[]): { ref: string; pence: number }[] {
  const got = new Map<string, number>(parts.map((p) => [p.ref, 0]));
  const room = (p: { ref: string; headroom: number }) => Math.max(0, Math.floor(p.headroom)) - (got.get(p.ref) ?? 0);
  let remaining = Math.min(Math.max(0, Math.floor(totalPence)), parts.reduce((s, p) => s + Math.max(0, Math.floor(p.headroom)), 0));
  for (let guard = 0; guard < parts.length + 2 && remaining > 0; guard++) {
    const active = parts.filter((p) => room(p) > 0);
    if (!active.length) break;
    const wsum = active.reduce((s, p) => s + Math.max(0, p.weight), 0);
    let assigned = 0;
    for (const p of active) {
      const share = wsum > 0 ? Math.floor((remaining * Math.max(0, p.weight)) / wsum) : Math.floor(remaining / active.length);
      const take = Math.min(share, room(p));
      got.set(p.ref, (got.get(p.ref) ?? 0) + take);
      assigned += take;
    }
    let left = remaining - assigned;
    for (const p of [...active].reverse()) { // the pennies lost to rounding go to the last bookings with room
      if (left <= 0) break;
      const take = Math.min(left, room(p));
      got.set(p.ref, (got.get(p.ref) ?? 0) + take);
      left -= take;
    }
    remaining = left;
  }
  return parts.map((p) => ({ ref: p.ref, pence: got.get(p.ref) ?? 0 })).filter((x) => x.pence > 0);
}

const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const round2 = (n: number) => Math.round(n * 100) / 100;
const refundDocId = (refundId: string) => `stripe-refund-${refundId}`;

type ChargeRec = PaymentRec & { amount?: number; type?: string };

/** The payment record(s) for a PaymentIntent that took money (not the refund rows, which carry the same intent id). */
async function chargeRecordFor(intentId: string): Promise<{ id: string; rec: ChargeRec } | null> {
  const snap = await db.collection("payments").where("paymentIntentId", "==", intentId).get();
  const docs = snap.docs.filter((d) => d.get("type") !== "refund");
  if (!docs.length) return null;
  const best = docs.find((d) => d.get("status") === "succeeded") ?? docs[0];
  return { id: best.id, rec: best.data() as ChargeRec };
}

/** A refund object's PaymentIntent id (it can be missing on very old charges: then read it off the charge). */
async function intentOf(refund: Stripe.Refund, account: string | null): Promise<string | null> {
  const pi = refund.payment_intent;
  if (pi) return typeof pi === "string" ? pi : pi.id;
  const ch = refund.charge;
  if (!ch || !stripe) return null;
  const c = await stripe.charges.retrieve(typeof ch === "string" ? ch : ch.id, {}, account ? { stripeAccount: account } : undefined);
  return c.payment_intent ? (typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent.id) : null;
}

/** The refund as Stripe holds it NOW. An event is a snapshot and events can arrive out of order (a stale "failed" after the
 *  refund succeeded), so the status that counts is the one Stripe reports today. If Stripe cannot show it to us (a 4xx: not found,
 *  not our account) the event's own copy is used; a 5xx / network error throws so the delivery is retried. */
export const refundFetchStats = { retrieves: 0 };
// A bulk dashboard refund fires charge.refunded + refund.created + refund.updated for every refund: concurrent and repeated
// reads of the same refund within a few seconds share ONE Stripe retrieve.
const fetchCache = new Map<string, { at: number; p: Promise<Stripe.Refund> }>();
const FETCH_TTL_MS = 4000;
export function freshRefund(r: Stripe.Refund, account: string | null): Promise<Stripe.Refund> {
  if (!stripe) return Promise.resolve(r);
  const key = `${account ?? ""}|${r.id}`;
  const hit = fetchCache.get(key);
  if (hit && Date.now() - hit.at < FETCH_TTL_MS) return hit.p;
  if (fetchCache.size > 500) for (const [k, v] of fetchCache) if (Date.now() - v.at >= FETCH_TTL_MS) fetchCache.delete(k);
  refundFetchStats.retrieves++;
  const p = stripe.refunds.retrieve(r.id, {}, account ? { stripeAccount: account } : undefined).catch((e) => {
    fetchCache.delete(key);
    const sc = (e as { statusCode?: number }).statusCode;
    if (typeof sc === "number" && sc >= 400 && sc < 500 && sc !== 429) return r;
    throw e;
  });
  fetchCache.set(key, { at: Date.now(), p });
  return p;
}

/** Every refund for a payment / charge, following Stripe's pages (bounded). */
async function listAllRefunds(params: { payment_intent?: string; charge?: string }, account: string | null): Promise<Stripe.Refund[]> {
  const out: Stripe.Refund[] = [];
  let after: string | undefined;
  for (let page = 0; page < 10; page++) {
    const res = await stripe!.refunds.list({ ...params, limit: 100, ...(after ? { starting_after: after } : {}) }, account ? { stripeAccount: account } : undefined);
    out.push(...res.data);
    if (!res.has_more || !res.data.length) break;
    after = res.data[res.data.length - 1].id;
  }
  return out;
}

const isOurs = (r: Stripe.Refund) => {
  const m = r.metadata ?? {};
  return m.activityosOrigin === "app" || !!m.excessFor || !!m.duplicateOf;
};

/**
 * Record one Stripe refund in the books (see the rules above). `account` is the connected account the event came from
 * (event.account) or, for the reconcile path, the payment's own account; null for the platform account.
 */
async function applyStripeRefundInner(refundIn: Stripe.Refund, account: string | null, source: "webhook" | "reconcile" = "webhook", alreadyFresh = false): Promise<SyncResult> {
  if (!refundIn?.id || typeof refundIn.id !== "string") { console.error("[stripe-refund] an event with a refund that has no id — ignored"); return "ignored"; }
  // Webhook events are snapshots: re-read the refund. (The reconcile path just listed it from Stripe.)
  const refund = source === "webhook" && !alreadyFresh ? await freshRefund(refundIn, account) : refundIn;
  const failedNow = refund.status === "failed" || refund.status === "canceled";
  if (isOurs(refund)) return "own";
  const intentId = await intentOf(refund, account);
  if (!intentId) { console.log(`[stripe-refund] ${refund.id}: no PaymentIntent — ignored`); return "ignored"; }
  const found = await chargeRecordFor(intentId);
  if (!found) { console.log(`[stripe-refund] ${refund.id} on ${intentId}: not a payment ActivityLane recorded — ignored`); return "unknown"; }
  const { id: payId, rec } = found;
  // A refund must come from the account the money was taken on.
  if ((account ?? null) !== (rec.stripeAccount ?? null)) {
    console.error(`[stripe-refund] ${refund.id}: event account ${account ?? "platform"} does not match the payment's account ${rec.stripeAccount ?? "platform"} — ignored`);
    return "ignored";
  }
  if (rec.status !== "succeeded" && !rec.status.startsWith("duplicate")) {
    // The refund can only follow a payment we have not settled yet (events out of order): ask Stripe to retry later.
    if (failedNow) return "ignored";
    throw new Error(`payment ${payId} is ${rec.status}, not settled yet`);
  }
  if (rec.status.startsWith("duplicate")) return "ignored"; // the app's own duplicate handling owns these

  const payRef = db.collection("payments").doc(payId);
  const rowRef = db.collection("payments").doc(refundDocId(refund.id));
  const at = new Date().toISOString();
  const createdAt = refund.created ? new Date(refund.created * 1000).toISOString() : at;
  const refs = rec.refs ?? [];
  const refundPence = Math.max(0, Math.round(refund.amount ?? 0));

  const outcome = await withBusyRetry(() => db.runTransaction(async (tx) => {
    const rowSnap = await tx.get(rowRef);
    // ── already recorded: only a later FAILURE changes anything ──
    if (rowSnap.exists) {
      const row = rowSnap.data() as { status?: string; allocations?: { ref: string; pence: number }[]; amount?: number };
      if (!failedNow || row.status !== "succeeded") return { kind: "unchanged" as const };
      const alloc = row.allocations ?? [];
      const bSnaps = await Promise.all(alloc.map((a) => tx.get(db.collection("bookings").doc(bookingDocId(rec.tenantId, a.ref)))));
      const priorRows = await tx.get(db.collection("payments").where("paymentIntentId", "==", rec.paymentIntentId));
      for (const bSnap of bSnaps) {
        if (!bSnap.exists) continue;
        const b = fromDoc(bSnap.data() as BookingDoc);
        b.refundLog = (b.refundLog ?? []).filter((x) => x.refundId !== refund.id);
        if (b.pay === "Refunded" || b.pay === "Partially refunded") {
          const stillGiven = (b.refundLog.length > 0) || (b.refundedApproved ?? 0) > 0;
          b.pay = refundableSoFar(b) <= 0.005 && stillGiven ? "Refunded" : stillGiven ? "Partially refunded" : "Paid";
        }
        tx.set(bSnap.ref, toDoc(b));
      }
      const stillRefunded = priorRows.docs.filter((d) => d.id !== rowRef.id && d.get("type") === "refund" && ["succeeded", "pending"].includes(d.get("status")) && d.get("via") === "stripe").reduce((s, d) => s + (Number(d.get("amount")) || 0), 0);
      tx.update(rowRef, { status: "reversed", reversedAt: at, note: "The refund failed or was cancelled in Stripe" });
      tx.update(payRef, { refundState: stillRefunded <= 0.005 ? null : stillRefunded >= (rec.amount ?? 0) - 0.005 ? "full" : "partial" });
      return { kind: "reversed" as const };
    }
    if (failedNow) return { kind: "unchanged" as const };

    // ── an older app refund (no metadata) that already has its own row ──
    const intentRows = await tx.get(db.collection("payments").where("paymentIntentId", "==", rec.paymentIntentId));
    if (intentRows.docs.some((d) => d.get("type") === "refund" && d.get("refundId") === refund.id)) return { kind: "own" as const };

    // ── how much of the payment is still refundable (a refund can never take it past what was paid) ──
    const paidPence = typeof rec.amount === "number" ? Math.round(rec.amount * 100) : refundPence;
    const alreadyPence = intentRows.docs.filter((d) => d.get("type") === "refund" && !["failed", "reversed"].includes(d.get("status")) && d.get("status") !== "to-reimburse" && d.get("via") !== "wallet" && d.get("method") !== "wallet" && d.get("method") !== "offline").reduce((s, d) => s + Math.round((Number(d.get("amount")) || 0) * 100), 0);
    const takePence = Math.max(0, Math.min(refundPence, paidPence - alreadyPence));

    const bSnaps = await Promise.all(refs.map((r) => tx.get(db.collection("bookings").doc(bookingDocId(rec.tenantId, r)))));
    const bookings = bSnaps.filter((s) => s.exists).map((s) => ({ ref: s.ref, b: fromDoc(s.data() as BookingDoc) }));
    // Meal-order and invoice payments have no booking to adjust: the refund row alone records them.
    const alloc = (rec.mealOrderIds?.length || rec.invoiceId) ? [] : allocateRefund(takePence, bookings.map(({ b }) => ({ ref: b.ref, weight: Math.round(cashReceivedOf(b) * 100), headroom: Math.round(refundableSoFar(b) * 100) })));
    // Nothing to record (no amount, or the payment has no room left): no row and no "£0.00" bell.
    if (takePence <= 0) return { kind: "nothing" as const };
    // Money went back in Stripe but the bookings have nothing left to give back (it was already refunded another way, e.g. as
    // wallet credit): the payment ledger row still records it, so Payout transactions shows the charge refunded, and the provider is told.
    const noRoom = !(rec.mealOrderIds?.length || rec.invoiceId) && bookings.length > 0 && !alloc.length;
    const onDay = ukToday(new Date(refund.created ? refund.created * 1000 : Date.now())); // when the refund happened, not when we heard
    for (const a of alloc) {
      const hit = bookings.find((x) => x.b.ref === a.ref)!;
      const b = hit.b;
      b.refundLog = [...(b.refundLog ?? []), { label: "Refunded in Stripe", amount: a.pence / 100, on: onDay, by: "Stripe", source: "Card", refundId: refund.id }];
      const left = round2(refundableSoFar(b));
      if (b.pay === "Paid" || b.pay === "Partially refunded" || b.pay === "Refunded") b.pay = left <= 0.005 ? "Refunded" : "Partially refunded";
      // A cancellation whose refund is still waiting for Approve: Stripe already paid (some of) it back, so that pending refund
      // shrinks to what is left, or is resolved when nothing is. Otherwise Approve would count the same money twice.
      resolvePendingCancel(b, createdAt);
      tx.set(hit.ref, toDoc(b));
    }
    const recordedPence = takePence;
    const totalNow = alreadyPence + recordedPence;
    tx.set(rowRef, {
      tenantId: rec.tenantId, refs, email: rec.email ?? null, type: "refund", amount: recordedPence / 100, currency: refund.currency || "gbp",
      paymentIntentId: rec.paymentIntentId, stripeAccount: rec.stripeAccount ?? null, status: "succeeded", refundId: refund.id,
      via: "stripe", reason: "refunded in Stripe", stripeReason: refund.reason ?? null, stripeStatus: refund.status ?? null, source,
      allocations: alloc, createdAt, paidAt: createdAt, recordedAt: at,
      ...(recordedPence < refundPence ? { clampedFromPence: refundPence } : {}),
    });
    tx.update(payRef, { refundState: totalNow >= paidPence ? "full" : "partial" });
    return { kind: "recorded" as const, pence: recordedPence, noRoom, refsNamed: alloc.length ? alloc.map((a) => a.ref) : refs };
  }), 6, 200);

  if (outcome.kind === "own") return "own";
  if (outcome.kind === "reversed") return "reversed";
  if (outcome.kind === "unchanged") return "unchanged";
  if (outcome.kind === "nothing") return "ignored";
  // ONE bell (and email, per the provider's settings) per refund: only the transaction that created the record gets here.
  const named = outcome.refsNamed.join(", ");
  const text = `A refund of ${money(outcome.pence)} was made in Stripe for booking${outcome.refsNamed.length > 1 ? "s" : ""} ${named}${outcome.noRoom ? ", but that booking had already been refunded (for example as wallet credit), so its figures are unchanged and the Stripe refund is recorded on the payment only" : ""}.`;
  void notify({
    tenantId: rec.tenantId, to: { kind: "tenant" }, category: "billing", key: "payment-refund-stripe",
    title: "Refund made in Stripe",
    body: `${text} It is recorded on the booking. The booking itself is unchanged: cancel it if you want to.`,
    subject: `Refund made in Stripe · ${named}`,
    emailHtml: `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p><p style="font-size:13px;color:#6a6785">It is recorded on the booking and in your money screens. The booking itself is unchanged: cancel it yourself if you want to.</p>`,
    href: `/company/bookings?ref=${encodeURIComponent(outcome.refsNamed[0] ?? "")}`, ref: outcome.refsNamed[0],
  }).catch((e) => console.error("[stripe-refund] bell failed:", (e as Error).message));
  return "recorded";
}

/** Every refund Stripe holds for a charge (a `charge.refunded` event carries the charge, whose refunds list is not sent in full). */
export async function applyRefundsOfCharge(chargeId: string, account: string | null): Promise<SyncResult[]> {
  if (!stripe) return [];
  let list: Stripe.Refund[];
  try {
    list = await listAllRefunds({ charge: chargeId }, account);
  } catch (e) {
    const sc = (e as { statusCode?: number }).statusCode;
    if (typeof sc === "number" && sc >= 400 && sc < 500 && sc !== 429) { console.error(`[stripe-refund] cannot read refunds of ${chargeId} on ${account ?? "platform"}: ${(e as Error).message} — ignored`); return []; }
    throw e;
  }
  const out: SyncResult[] = [];
  for (const r of list) out.push(await applyStripeRefund(r, account, "webhook", true)); // just listed from Stripe: already fresh
  return out;
}

export interface SyncSummary { checked: number; recorded: number; refundsSeen: number; capped: boolean }

/**
 * "Check Stripe for refunds": read-only on Stripe (one refunds.list per card payment in the period, newest first, at most
 * `max` payments) and writes through the same idempotent path as the webhook, so running it again records nothing new.
 */
export async function syncRefundsForTenant(tenantId: string, opts: { from?: string; to?: string; max?: number } = {}): Promise<SyncSummary> {
  if (!stripe) throw new Error("Card payments aren't connected");
  const max = Math.min(Math.max(opts.max ?? 150, 1), 300);
  const snap = await db.collection("payments").where("tenantId", "==", tenantId).get();
  const day = (d: FirebaseFirestore.QueryDocumentSnapshot) => String(d.get("paidAt") ?? d.get("createdAt") ?? "").slice(0, 10);
  const cards = snap.docs
    .filter((d) => d.get("type") !== "refund" && d.get("status") === "succeeded" && d.get("paymentIntentId") && !d.get("offline"))
    .filter((d) => (!opts.from || day(d) >= opts.from) && (!opts.to || day(d) <= opts.to))
    .sort((a, b) => day(b).localeCompare(day(a)));
  const batch = cards.slice(0, max);
  const out: SyncSummary = { checked: batch.length, recorded: 0, refundsSeen: 0, capped: cards.length > max };
  for (let i = 0; i < batch.length; i += 5) {
    await Promise.all(batch.slice(i, i + 5).map(async (d) => {
      const acct = (d.get("stripeAccount") as string | null) ?? null;
      try {
        const list = await listAllRefunds({ payment_intent: d.get("paymentIntentId") as string }, acct);
        for (const r of list) {
          out.refundsSeen++;
          if ((await applyStripeRefund(r, acct, "reconcile")) === "recorded") out.recorded++;
        }
      } catch (e) {
        console.error(`[stripe-refund] reconcile of ${d.id} failed:`, (e as Error).message);
      }
    }));
  }
  return out;
}

/** Record one Stripe refund; afterwards forget the cached money figures (payouts, add-on orders) so nothing reads the old totals. */
export async function applyStripeRefund(...a: Parameters<typeof applyStripeRefundInner>): ReturnType<typeof applyStripeRefundInner> {
  try { return await applyStripeRefundInner(...a); } finally { clearKitCache(); }
}
