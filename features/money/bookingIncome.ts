// One booking's money-in, net of refunds — the rule shared by the Income tab and the
// Money-in hero (and the Dashboard's "Income collected"). Pure; unchanged maths.
import { receivedOf, refundedGross, refundOwedOf } from "../bookings/helpers";
import type { Booking } from "../bookings/types";

/** Money to the penny: float residue (0.1 + 0.2) never leaks into a shown figure. */
export const round2 = (n: number) => Math.round(n * 100) / 100;
/** An amount is only "owed" above half a penny, so float residue never shows a £0.00 debt. */
export const isOwed = (n: number) => n > 0.005;
/** A paid invoice is standalone money-in only if it did NOT settle a booking (that money is already in the booking's amountPaid). */
export const isStandaloneInvoiceIn = (v: { status?: string; bookingSettledAt?: string }) => v.status === "paid" && !v.bookingSettledAt;

const UK_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });
/** "YYYY-MM-DD" on the UK wall clock. A bare date passes through; an ISO instant is converted from UTC
 *  (a booking made 00:30 BST on the 1st is 23:30Z the day before, but belongs to the 1st). */
export function ukDay(s?: string | null): string {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return s.slice(0, 10);
  return UK_DAY.format(new Date(t));
}
/** "YYYY-MM" on the UK wall clock. */
export const ukMonth = (s?: string | null) => ukDay(s).slice(0, 7);

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
