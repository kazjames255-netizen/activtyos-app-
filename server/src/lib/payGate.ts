import { owedOf } from "../../../features/bookings/helpers";

// Pure pieces of the public booking pay link (no Firestore) — extracted so they can be unit-tested.

/** A pay-link token is a UUID: 36 hex chars and dashes. Anything else is rejected before a DB read. */
export const isPayTokenFormat = (token: string) => /^[0-9a-f-]{36}$/i.test(token);

/** Bookings a parent may pay for: confirmed places, or operator invoices. */
export const payable = (b: { status: string; pay: string }) =>
  b.pay !== "Paid" &&
  b.pay !== "Refunded" &&
  b.pay !== "Refund pending" &&
  (b.status === "Confirmed" || b.pay === "Invoice sent");

/** What a parent is asked for: the BALANCE (price − money already received), never the whole price again. A part-paid
 *  booking, or a fully-paid one where the family released a day ("Partially refunded", status still Confirmed), used to be
 *  charged its full price a second time. */
export const balanceOf = (b: Parameters<typeof owedOf>[0]) => Math.round(owedOf(b) * 100) / 100;
