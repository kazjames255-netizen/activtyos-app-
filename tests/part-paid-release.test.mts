/**
 * A family releases days on a booking that is only PART paid: the removed days leave the price (pass share + daily extras) exactly as for an unpaid
 * booking, and only money paid BEYOND the new price comes back: refund = max(0, paid - new price - pending). Pure helpers.
 * Run: server/node_modules/.bin/tsx --test tests/part-paid-release.test.mts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { applyPartialCancel } from "../features/bookings/mutations";
import type { Booking } from "../features/bookings/types";

const D5 = ["2099-07-27", "2099-07-28", "2099-07-29", "2099-07-30", "2099-07-31"];
const D7 = [...D5, "2099-08-01", "2099-08-02"];
const mk = (o: Partial<Booking> & { days?: string[] }): Booking => {
  const days = o.days ?? D5;
  return { ref: "X-1", status: "Confirmed", seats: 1, days: [...days], child: "A", sessions: [], kids: [{ name: "A", childId: "a", dates: [...days] }], ...o } as unknown as Booking;
};

test("paid 18 of 45, release 3 of 5 days: price 18, refund 0, nothing owed", () => {
  const b = mk({ amount: 45, amountPaid: 18, pay: "Partially paid" });
  const r = applyPartialCancel(b, [{ childKey: "a", days: D5.slice(0, 3) }]);
  assert.equal(r.partPaid, true);
  assert.equal(b.amount, 18);
  assert.equal(r.overpaid, 0);
});

test("paid 70 (wallet 50 + cash 20) of 161, release 2 of 7 days: price drops, refund 0", () => {
  const b = mk({ days: D7, amount: 111, walletApplied: 50, amountPaid: 20, pay: "Partially paid" });
  const r = applyPartialCancel(b, [{ childKey: "a", days: D7.slice(0, 2) }]);
  assert.equal(r.overpaid, 0);
  assert.equal(b.amount, 65); // 111 - 2 x 23
});

test("paid 150 of 161, release 2 of 7: the 35 paid beyond the new price (115) comes back", () => {
  const b = mk({ days: D7, amount: 161, amountPaid: 150, pay: "Partially paid" });
  const r = applyPartialCancel(b, [{ childKey: "a", days: D7.slice(0, 2) }]);
  assert.equal(b.amount, 115);
  assert.equal(r.overpaid, 35);
});

test("an earlier pending refund is counted: paid 100 of 120, 5 pending, release 2 of 5 -> price 72, 23 more", () => {
  const b = mk({ amount: 120, amountPaid: 100, pay: "Partially paid", cancel: { on: "x", by: "Booker", refund: "pending", amount: 5, refundOnly: true } as Booking["cancel"] });
  const r = applyPartialCancel(b, [{ childKey: "a", days: D5.slice(0, 2) }]);
  assert.equal(b.amount, 72);
  assert.equal(r.overpaid, 23);
});

test("only wallet credit paid (50 of 161, cash due 111): the removed share leaves the cash due first, then the wallet part", () => {
  const b = mk({ days: D7, amount: 111, walletApplied: 50, amountPaid: 0, pay: "Awaiting payment" });
  const r = applyPartialCancel(b, [{ childKey: "a", days: D7.slice(0, 5) }]); // 5 x 23 = 115
  assert.equal(b.amount, 0);
  assert.equal(b.walletRelieved, 4);
  assert.equal(r.overpaid, 4); // 50 paid, 46 still counted
});

test("paid in full: the price stays (the policy decides the refund), not part-paid", () => {
  const b = mk({ amount: 100, amountPaid: 100, pay: "Paid" });
  const r = applyPartialCancel(b, [{ childKey: "a", days: D5.slice(0, 2) }]);
  assert.equal(r.partPaid, false);
  assert.equal(b.amount, 100);
});

test("nothing paid: the price drops as before", () => {
  const b = mk({ amount: 100, amountPaid: 0, pay: "Invoice sent" });
  const r = applyPartialCancel(b, [{ childKey: "a", days: D5.slice(0, 2) }]);
  assert.equal(r.partPaid, false);
  assert.equal(b.amount, 60);
});
