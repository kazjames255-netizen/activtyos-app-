// One booking's money-in, net of refunds — the rule shared by the Income tab and the
// Money-in hero (and the Dashboard's "Income collected"). Pure; unchanged maths.
import { receivedOf, refundedGross } from "../bookings/helpers";
import type { Booking } from "../bookings/types";

export function bookingNetIn(b: Booking) {
  const got = receivedOf(b);
  const back = Math.min(got, refundedGross(b));
  return { got, back, net: Math.round((got - back) * 100) / 100 };
}
