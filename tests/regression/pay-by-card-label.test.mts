import test from "node:test";
import assert from "node:assert/strict";
import { isNonCardMethod } from "../../features/bookings/helpers";

// The pay button on My bookings AND the Payments page: 'Pay by card instead' for a booking the family chose to pay another way (it opens a CARD form),
// plain 'Pay' for an ordinary card booking.
test("isNonCardMethod: bank transfer, cash, voucher and Tax-Free Childcare are not card", () => {
  for (const m of ["Bank transfer", "bank", "Cash", "cash on the day", "Childcare voucher", "Voucher", "Tax-Free Childcare", "tax free childcare", "TFC"]) assert.equal(isNonCardMethod(m), true, m);
});
test("isNonCardMethod: card and unknown methods keep the plain Pay button", () => {
  for (const m of ["Card", "card", "Apple Pay", "—", "", undefined, null]) assert.equal(isNonCardMethod(m as string | undefined | null), false, String(m));
});
