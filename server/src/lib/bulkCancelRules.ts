import { receivedOf } from "../../../features/bookings/helpers";
import type { Booking } from "../../../features/bookings/types";

/** Bulk cancel cannot carry a refund decision (policy figure, card or wallet): a booking that has received money must be cancelled
 *  one at a time. Returns true when this booking may NOT be bulk-cancelled (QA-C D2: bulk used to cancel it, keep the money, tell the family "No refund"). */
export function blocksBulkCancel(b: Pick<Booking, "status" | "pay" | "amount" | "amountPaid" | "walletApplied">): boolean {
  if (b.status === "Cancelled" || b.status === "Declined" || b.pay === "Refunded") return false;
  return receivedOf(b as Booking) > 0.004;
}
