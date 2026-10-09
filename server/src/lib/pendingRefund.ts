import { refundableSoFar } from "../../../features/bookings/helpers";
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
