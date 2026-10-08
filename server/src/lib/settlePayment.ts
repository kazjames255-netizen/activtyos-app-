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
    const todo: { ref: FirebaseFirestore.DocumentReference; b: Booking }[] = [];
    for (const bSnap of bSnaps) {
      if (!bSnap.exists) continue;
      const b = fromDoc(bSnap.data() as BookingDoc);
      const bal = balanceOf(b);
      if (b.pay === "Paid" || bal <= 0.005) continue; // already paid by something else: this payment does not touch it
      owed += bal;
      todo.push({ ref: bSnap.ref, b });
    }
    const paidPence = typeof rec.amount === "number" ? Math.round(rec.amount * 100) : Math.round(owed * 100);
    const excessPence = Math.max(0, paidPence - Math.round(owed * 100));
    if (!todo.length) {
      tx.update(payRef, { status: "duplicate", duplicateDetectedAt: at, excess: { pence: paidPence, state: "pending" } });
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
    tx.update(payRef, { status: "succeeded", paidAt: at, settledAuto: by.auto, ...(excessPence > 0 ? { excess: { pence: excessPence, state: "pending" } } : {}) });
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
export interface Excess { pence: number; state: "pending" | "refunded" | "failed"; refundId?: string }

/**
 * Hand back the part of a card payment that was not owed: all of it when the bookings were already paid (a duplicate payment,
 * recorded as status duplicate*), or just the excess when something else (cash, another card payment) had paid part of it
 * meanwhile. Idempotent: the Stripe refund carries a key derived from the PaymentIntent and the amount, and a refunded
 * record is left alone, so webhook retries, a repeated event and the browser confirm can never refund twice. If Stripe
 * refuses, the record says so (duplicate-needs-refund / excess.state failed), the provider is asked to refund by hand, and the
 * next delivery tries again.
 */
export async function refundExcess(payRef: FirebaseFirestore.DocumentReference): Promise<void> {
  const snap = await payRef.get();
  const rec = snap.data() as (PaymentRec & { amount?: number; excess?: Excess }) | undefined;
  if (!rec?.excess || rec.excess.state === "refunded") return;
  const full = rec.status.startsWith("duplicate");
  const wasPending = rec.excess.state === "pending";
  const pence = rec.excess.pence;
  const where = (rec.refs ?? []).join(", ");
  let refundId: string | null = null;
  let failure = "";
  try {
    if (!stripe) throw new Error("Stripe is not configured");
    const r = await stripe.refunds.create(
      { payment_intent: rec.paymentIntentId, amount: pence, reason: "duplicate", metadata: { duplicateOf: where, tenantId: rec.tenantId } },
      { idempotencyKey: `excess-refund-${rec.paymentIntentId}-${pence}`, ...(rec.stripeAccount ? { stripeAccount: rec.stripeAccount } : {}) },
    );
    refundId = r.id;
  } catch (e) {
    failure = (e as Error).message;
    console.error(`[settle] automatic refund of ${pence}p excess on payment ${snap.id} (${rec.paymentIntentId}) failed:`, failure);
  }
  const at = new Date().toISOString();
  if (refundId) {
    await payRef.update({ "excess.state": "refunded", "excess.refundId": refundId, "excess.refundedAt": at, ...(full ? { status: "duplicate-refunded", refundId, refundedAt: at } : {}) });
  } else {
    await payRef.update({ "excess.state": "failed", "excess.failure": failure.slice(0, 300), ...(full ? { status: "duplicate-needs-refund", refundFailure: failure.slice(0, 300) } : {}) });
  }
  // Tell the provider once (first detection); a retry that succeeds says it is now sorted.
  if (wasPending || refundId) {
    const money = `£${(pence / 100).toFixed(2)}`;
    const what = full ? `A second card payment of ${money} arrived for ${where}, which was already paid.` : `A card payment arrived for ${where} that was ${money} more than was still owed (other money had been received meanwhile).`;
    const body = refundId ? `${what} The extra ${money} was refunded automatically and not recorded.` : `${what} The extra ${money} was NOT recorded and the automatic refund failed: please refund it in Stripe (payment ${rec.paymentIntentId}).`;
    const title = refundId ? "Extra card payment refunded" : "Extra card payment needs refunding";
    void notify({
      tenantId: rec.tenantId, to: { kind: "tenant" }, category: "billing", key: "payment-duplicate",
      title, body, subject: title,
      emailHtml: `<p>${body.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`,
      href: `/company/bookings?ref=${encodeURIComponent((rec.refs ?? [])[0] ?? "")}`, ref: (rec.refs ?? [])[0],
    });
  }
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
