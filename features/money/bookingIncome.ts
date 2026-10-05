// One booking's money-in, net of refunds — the rule shared by the Income tab and the
// Money-in hero (and the Dashboard's "Income collected"). Pure; unchanged maths.
import { receivedOf, refundedGross, refundOwedOf } from "../bookings/helpers";
import type { Booking } from "../bookings/types";

export function bookingNetIn(b: Booking) {
  const got = receivedOf(b);
  const back = Math.min(got, refundedGross(b));
  return { got, back, net: Math.round((got - back) * 100) / 100 };
}

/** A refund agreed with the family but not yet SENT. The money hasn't left, so it stays inside `net`
 *  (never in `back`) and is shown as "owed" beside it, not as refunded. */
export function bookingRefundOwed(b: Booking) {
  const { got, back } = bookingNetIn(b);
  return Math.min(refundOwedOf(b), Math.max(0, got - back));
}
