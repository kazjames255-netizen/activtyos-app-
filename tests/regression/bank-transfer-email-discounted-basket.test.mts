// Bank-transfer confirmation email (coupon test C, 8 Oct): a basket spanning two weeks makes two bookings. The done screen asked for the whole
// discounted total under both references, but the EMAIL only described the first booking (half the money, one reference, one week's dates). And
// a 100%-discount code with "Bank transfer" emailed a "Pay by bank transfer ... Amount £0.00" block.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bankTransferAsk } from "../../server/src/lib/bankTransferAsk";

test("a two-week discounted basket asks for the whole total under both references", () => {
  const ask = bankTransferAsk([
    { ref: "QAC-10322", status: "Confirmed", amount: 18 },
    { ref: "QAC-10323", status: "Confirmed", amount: 18 },
  ]);
  assert.deepEqual(ask, { reference: "QAC-10322, QAC-10323", amount: 36 });
});

test("a waitlisted place owes nothing yet and is left out", () => {
  assert.deepEqual(bankTransferAsk([{ ref: "A-1", status: "Confirmed", amount: 18 }, { ref: "A-2", status: "Waitlisted", amount: 18 }]), { reference: "A-1", amount: 18 });
});

test("a booking a 100% code left at GBP 0 has nothing to pay: no bank block", () => {
  assert.equal(bankTransferAsk([{ ref: "A-1", status: "Confirmed", amount: 0 }]), null);
  assert.equal(bankTransferAsk([{ ref: "A-1", status: "Waitlisted", amount: 20 }]), null);
});

test("the booking route uses it for the email, and merges a bank basket like any other", () => {
  const my = readFileSync(new URL("../../server/src/routes/my.ts", import.meta.url), "utf8");
  assert.match(my, /bankTransferAsk\(bookings\)/);
  assert.doesNotMatch(my, /bookings\.every\(\(x\) => x\.status === b0\.status\) && !isBankMethod\(input\.method\)/);
});
