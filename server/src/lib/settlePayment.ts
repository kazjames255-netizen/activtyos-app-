import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import { fromDoc, toDoc, type BookingDoc } from "./bookingDoc";
import { bookingDocId } from "../routes/bookings";
import { paidSoFar } from "../../../features/bookings/helpers";
import type { Booking } from "../../../features/bookings/types";

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
export async function settlePaymentRecord(paymentId: string, by: SettleBy): Promise<SettleResult> {
  const payRef = db.collection("payments").doc(paymentId);
  const at = new Date().toISOString();

  // Claim the payment first, in a transaction, so two callers racing (browser
  // callback and webhook) can't both write the money.
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(payRef);
    if (!snap.exists) return null;
    const rec = snap.data() as PaymentRec;
    if (rec.status === "succeeded") return null;
    tx.update(payRef, { status: "succeeded", paidAt: at, settledAuto: by.auto });
    return rec;
  });
  if (!claimed) return (await payRef.get()).exists ? "already" : "unknown";

  if (claimed.mealOrderIds?.length) {
    const batch = db.batch();
    for (const id of claimed.mealOrderIds) {
      const oSnap = await db.collection("mealOrders").doc(id).get();
      if (!oSnap.exists) continue;
      batch.set(oSnap.ref, { pay: "Paid", amountPaid: oSnap.data()!.total ?? 0, paidAt: at, paymentIntentId: claimed.paymentIntentId }, { merge: true });
    }
    await batch.commit();
    return "settled";
  }

  const batch = db.batch();
  for (const bookingRef of claimed.refs ?? []) {
    const bSnap = await db.collection("bookings").doc(bookingDocId(claimed.tenantId, bookingRef)).get();
    if (!bSnap.exists) continue;
    const b = fromDoc(bSnap.data() as BookingDoc);
    b.pay = "Paid";
    // What was actually taken, so a later part-refund or cancel works from
    // real money rather than inferring it from the status word.
    b.amountPaid = b.amount;
    b.paymentIntentId = claimed.paymentIntentId;
    b.stripeAccount = claimed.stripeAccount;
    b.cardFailed = false;
    if (by.auto) b.reconciledBy = { at, by: by.by, auto: true };
    batch.set(bSnap.ref, toDoc(b));
  }
  await batch.commit();
  return "settled";
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
export async function settleInvoicePayment(paymentId: string, invoiceId: string, intentId: string, by: SettleBy): Promise<SettleResult> {
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
