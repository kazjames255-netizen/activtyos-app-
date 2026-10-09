import { paidSoFar, refundableSoFar } from "../../../features/bookings/helpers";
import type { Booking } from "../../../features/bookings/types";

/**
 * A cancellation's refund that is still waiting for the provider's Approve, when money has ALREADY gone back another way (a
 * refund made in the Stripe dashboard): shrink the pending refund to what is still refundable, or resolve it when nothing is
 * (approved, amount 0, Refunded) so Approve can neither pay nor count the same money twice. Pure: call it on a freshly read booking
 * inside the transaction that writes it. Returns true when it changed anything.
 */
export function resolvePendingCancel(b: Booking, atIso: string): boolean {
  const c = b.cancel;
  if (!c || !(c.refund === "full" || c.refund === "partial" || c.refund === "pending")) return false;
  const left = Math.round(refundableSoFar(b) * 100) / 100;
  if (left <= 0.005) {
    c.refund = "approved"; c.amount = 0; c.refundVia = "card"; c.refundedAt = atIso;
    delete (c as { refundError?: string }).refundError;
    if (b.pay === "Refund pending" || b.pay === "Paid") b.pay = "Refunded";
    return true;
  }
  if ((c.amount ?? 0) > left) { c.amount = left; return true; }
  return false;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** What the provider has already been told about, or `null` when Approve is safe. */
export type AlreadyRefundedWarning = { stripeRefunded: number; pending: number; paid: number };

/**
 * A PENDING PARTIAL refund (an extras / T-shirt refund, a parent release, a cancel-day) whose money the provider ALSO refunded in the Stripe
 * dashboard (the refund sync wrote 'Refunded in Stripe' lines on the booking). The sync does not shrink such a refund (only one that passes
 * what is left), so a plain Approve would pay the same money back twice. Approve must be confirmed on purpose: the route answers 409
 * already_refunded_in_stripe unless the request carries confirmAlreadyRefunded:true. Never shrinks anything, never touches a full refund.
 *
 * Warn when the Stripe-recorded refunds
 *   (a) together with this pending refund pass what was paid, OR
 *   (b) are at least as much as this pending partial, while the pending one is smaller than what is still refundable
 *       (a pending refund that is exactly what is left is the result of the sync's own shrink, not a double).
 */
export function alreadyRefundedWarning(b: Booking): AlreadyRefundedWarning | null {
  const c = b.cancel;
  if (!c || !(c.refund === "partial" || c.refund === "pending")) return null;
  const pending = r2(Math.max(0, c.amount ?? 0));
  if (pending <= 0.004) return null;
  const stripeRefunded = r2((b.refundLog ?? []).filter((x) => x.label === "Refunded in Stripe").reduce((t, x) => t + (x.amount || 0), 0));
  if (stripeRefunded <= 0.004) return null;
  const paid = r2(paidSoFar(b));
  const over = stripeRefunded + pending > paid + 0.005;
  const covers = stripeRefunded >= pending - 0.005 && pending < refundableSoFar(b) - 0.005;
  return over || covers ? { stripeRefunded, pending, paid } : null;
}
