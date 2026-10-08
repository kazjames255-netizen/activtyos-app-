import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { db } from "../firebase";

// ─────────────────────────────────────────────────────────────────────────
// One open PaymentIntent per booking(s) and amount.
//
// A double-click on Pay used to fire two checkout calls; each made its own PaymentIntent, the browser confirmed both
// and the family was charged twice for one booking (only one payment was ever recorded). Now:
//
//  1. A repeat call finds the payment record we already made for the same provider + bookings + amount + card mode and,
//     while Stripe says that intent is still open, hands back THE SAME intent and client secret.
//  2. Two calls that arrive at the same instant both miss step 1, so the create itself is made idempotent with a
//     deterministic Stripe idempotency key (same key => Stripe returns the one intent it already made), and the
//     payment record is written under the intent's own id so both calls land on the same record.
//  3. A different amount (a part-payment arrived, a basket changed) is a different key and a new intent. A finished or
//     cancelled intent bumps the "generation" in the key, so the next attempt gets a fresh intent.
// ─────────────────────────────────────────────────────────────────────────

const OPEN = new Set(["requires_payment_method", "requires_confirmation", "requires_action", "processing"]);

export interface IntentRequest {
  tenantId: string;
  /** Booking refs, or meal order ids: whatever this payment covers. */
  covers: string[];
  pence: number;
  hold?: boolean;
  /** Which route asks (booking checkout / pay link / meals): keeps Stripe's idempotency parameter check happy across routes. */
  tag: string;
  stripeAccount: string | null;
  params: Stripe.PaymentIntentCreateParams;
  /** The payments record to store (without paymentIntentId / idemKey, which are added here). */
  record: Record<string, unknown>;
}

export const checkoutKey = (r: Pick<IntentRequest, "tenantId" | "covers" | "pence" | "hold" | "stripeAccount">) =>
  createHash("sha256").update([r.tenantId, [...r.covers].sort().join(","), r.pence, r.hold ? "hold" : "pay", r.stripeAccount ?? "platform"].join("|")).digest("hex").slice(0, 40);

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function createOrReuseIntent(s: Stripe, req: IntentRequest): Promise<{ intent: Stripe.PaymentIntent; paymentId: string; reused: boolean }> {
  const key = checkoutKey(req);
  const opts = req.stripeAccount ? { stripeAccount: req.stripeAccount } : undefined;
  const failRef = db.collection("checkoutFailures").doc(key);
  /** An open intent we already made for this key, if any. */
  const findOpen = async () => {
    const prior = await db.collection("payments").where("idemKey", "==", key).get();
    for (const d of prior.docs.filter((x) => x.get("status") === "created")) {
      const pi = await s.paymentIntents.retrieve(d.get("paymentIntentId") as string, {}, opts).catch(() => null);
      if (pi && OPEN.has(pi.status) && pi.client_secret) return { found: true as const, intent: pi, paymentId: d.id, reused: true };
    }
    return { found: false as const, prior };
  };
  const first = await findOpen();
  if (first.found) return { intent: first.intent, paymentId: first.paymentId, reused: true };
  const generation = first.prior.size;
  // Stripe replays a FAILED create under the same key for 24 hours, so a failure bumps a counter that is part of the next key.
  const failures = ((await failRef.get()).data()?.count as number | undefined) ?? 0;
  let intent: Stripe.PaymentIntent | null = null;
  for (let attempt = 0; attempt < 8 && !intent; attempt++) {
    try {
      intent = await s.paymentIntents.create(req.params, { ...(opts ?? {}), idempotencyKey: `chk-${key}-${generation}-f${failures}` });
    } catch (e) {
      const err = e as { code?: string; type?: string; statusCode?: number };
      // The other simultaneous call is still creating it: Stripe answers 409 until it finishes, then replays the same intent.
      if (err.code === "idempotency_key_in_use" && attempt < 7) { await wait(250); continue; }
      // Same key, different parameters (a racing call from another route): reuse what that call made rather than failing the parent.
      if (err.type === "StripeIdempotencyError" || err.code === "idempotency_error") {
        for (let i = 0; i < 6; i++) {
          const again = await findOpen();
          if (again.found) return { intent: again.intent, paymentId: again.paymentId, reused: true };
          await wait(250);
        }
      }
      if (typeof err.statusCode === "number") await failRef.set({ count: failures + 1, at: new Date().toISOString() }, { merge: true }).catch(() => {});
      throw e;
    }
  }
  const ref = db.collection("payments").doc(intent!.id);
  try {
    await ref.create({ ...req.record, paymentIntentId: intent!.id, idemKey: key });
  } catch (e) {
    // Already written by the call that raced us: fine, same record.
    if ((e as { code?: number }).code !== 6 && !/already exists/i.test((e as Error).message)) throw e;
  }
  // A new intent for this basket supersedes older open ones that cover any of the same bookings (a changed basket or amount).
  const covers = (req.record.refs as string[] | undefined) ?? [];
  if (covers.length) await cancelOpenIntents(req.tenantId, covers, intent!.id).catch(() => {});
  return { intent: intent!, paymentId: ref.id, reused: false };
}

/**
 * Cancel every still-open card PaymentIntent we created for any of these bookings (except `exceptPi`), so a stale
 * browser tab can no longer pay an amount that is out of date. Best effort and idempotent: a PaymentIntent already
 * finished or cancelled is skipped; card HOLDs are left alone; failures are swallowed because the excess-refund in
 * settlePayment.ts is the backstop. Called when a new intent supersedes older ones, when a payment settles, and when
 * an operator records cash against the booking.
 */
export async function cancelOpenIntents(tenantId: string, refs: string[], exceptPi?: string): Promise<void> {
  const { stripe } = await import("./stripe");
  if (!stripe) return;
  const seen = new Set<string>();
  for (const ref of refs) {
    const snap = await db.collection("payments").where("refs", "array-contains", ref).get();
    for (const d of snap.docs) {
      const r = d.data() as { tenantId?: string; status?: string; hold?: boolean; paymentIntentId?: string; stripeAccount?: string | null; offline?: boolean };
      if (seen.has(d.id) || r.tenantId !== tenantId || r.status !== "created" || r.hold || r.offline || !r.paymentIntentId || r.paymentIntentId === exceptPi) continue;
      seen.add(d.id);
      const opts = r.stripeAccount ? { stripeAccount: r.stripeAccount } : undefined;
      try {
        const pi = await stripe.paymentIntents.retrieve(r.paymentIntentId, {}, opts);
        if (OPEN.has(pi.status)) {
          await stripe.paymentIntents.cancel(r.paymentIntentId, { cancellation_reason: "abandoned" }, opts);
          await d.ref.update({ status: "superseded", supersededAt: new Date().toISOString() });
        }
      } catch (e) {
        console.error(`[checkout] could not cancel superseded intent ${r.paymentIntentId}:`, (e as Error).message);
      }
    }
  }
}

/** Call after ANY route ends a booking: once it is Cancelled or Declined, the family's open card payment is cancelled so Pay stops working
 *  instead of taking money for a place they no longer have (settlement refunds anything that still slips through). Best effort, never throws. */
export function stopOpenPayments(b: { tenantId?: string | null; ref: string; status: string }): void {
  if (!b.tenantId || (b.status !== "Cancelled" && b.status !== "Declined")) return;
  void cancelOpenIntents(b.tenantId, [b.ref]).catch(() => {});
}
