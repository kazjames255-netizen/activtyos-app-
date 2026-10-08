// A Tax-Free Childcare / voucher booking that a 100% discount code left at GBP 0 got NO email at all (coupon test C, 8 Oct): the generic
// confirmation is skipped for every voucher booking, and the voucher-instructions email only covers bookings still awaiting the scheme's money.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { voucherEmailAnnouncesBasket } from "../../server/src/lib/bookingGuards";

test("voucher instructions announce a basket that still waits on the scheme", () => {
  assert.equal(voucherEmailAnnouncesBasket(true, [{ pay: "Awaiting voucher payment" }]), true);
  assert.equal(voucherEmailAnnouncesBasket(true, [{ pay: "Funded" }, { pay: "Awaiting voucher payment" }]), true);
});

test("a fully discounted (Funded) or waitlisted voucher basket falls back to the ordinary email", () => {
  assert.equal(voucherEmailAnnouncesBasket(true, [{ pay: "Funded" }]), false);
  assert.equal(voucherEmailAnnouncesBasket(true, [{ pay: "Unpaid" }]), false);
});

test("a non-voucher basket is never handled by the voucher email", () => {
  assert.equal(voucherEmailAnnouncesBasket(false, [{ pay: "Awaiting voucher payment" }]), false);
});

test("the booking route asks it", () => {
  const my = readFileSync(new URL("../../server/src/routes/my.ts", import.meta.url), "utf8");
  assert.match(my, /if \(voucherEmailAnnouncesBasket\(!!voucher, bookings\)\)/);
});
