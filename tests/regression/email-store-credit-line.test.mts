// Coupon QA (agent B, 8 Oct): a £20 booking with a 10% code and £5 of store credit showed in the confirmation email
// "Price before discount £20.00 / Discount - £2.00 / Total £13.00" - the £5 of credit that explains the gap was not shown anywhere.
import { test } from "node:test";
import assert from "node:assert/strict";
import { layout } from "../../server/src/lib/emailTemplates";
import { mergeBookings } from "../../server/src/lib/mergeBookings";
import type { Booking } from "../../features/bookings/types";

const base = { ref: "QAC-1", listing: "Camp", booker: "A", child: "Ann", amount: 13, listPrice: 20, discountOff: 2, discountNames: ["Discount code X"], walletApplied: 5 } as unknown as Booking;
const text = (b: Booking) => layout({ name: "Prov", hasLogo: false }, "t", "", b).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("the booking email shows the store credit used between the discount and the total", () => {
  const t = text(base);
  assert.match(t, /Price before discount £20\.00/);
  assert.match(t, /Paid from store credit − £5\.00/);
  assert.match(t, /Total £13\.00/);
});

test("no store-credit line when none was used", () => {
  assert.doesNotMatch(text({ ...base, walletApplied: undefined } as Booking), /store credit/);
});

test("a merged multi-booking email sums the store credit of every row", () => {
  const { merged } = mergeBookings([{ ...base, ref: "A" } as Booking, { ...base, ref: "B", walletApplied: 2.5 } as Booking]);
  assert.equal(merged.walletApplied, 7.5);
});
