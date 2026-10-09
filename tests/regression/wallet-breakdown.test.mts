// Owner finding 9 Oct: a booking paid partly with wallet credit showed Total = the cash due (net) and hid the wallet payment.
// One server helper returns {gross, walletApplied, due, paidBy}; screens only display it.
import test from "node:test";
import assert from "node:assert/strict";
import { moneyBreakdown, withMoney } from "../../features/bookings/walletBreakdown";
import type { Booking } from "../../features/bookings/types";

const b = (o: Partial<Booking>) => ({ amount: 0, pay: "Unpaid", status: "Confirmed", method: "Cash on the day", ...o }) as Booking;

test("wallet + cash on the day: £2 price, £1 wallet, £1 to pay, chip Partially paid", () => {
  const m = moneyBreakdown(b({ amount: 1, walletApplied: 1 }));
  assert.deepEqual([m.gross, m.walletApplied, m.due, m.pay], [2, 1, 1, "Partially paid"]);
  assert.deepEqual(m.paidBy, [{ kind: "wallet", amount: 1 }]);
});
test("wallet only: nothing left to pay, Paid in full by wallet", () => {
  const m = moneyBreakdown(b({ amount: 0, walletApplied: 2 }));
  assert.deepEqual([m.gross, m.due, m.pay, m.paidInFullByWallet], [2, 0, "Paid", true]);
});
test("wallet paid it all and the booking is stored as Funded: show Paid, not 'Funded £0'", () => {
  assert.equal(moneyBreakdown(b({ amount: 0, walletApplied: 2, pay: "Funded", method: "Funded" })).pay, "Paid");
});
test("wallet + card paid: Paid, both sources listed", () => {
  const m = moneyBreakdown(b({ amount: 1, walletApplied: 1, pay: "Paid", method: "Card" }));
  assert.deepEqual([m.gross, m.due, m.pay], [2, 0, null]);
  assert.deepEqual(m.paidBy, [{ kind: "wallet", amount: 1 }, { kind: "cash", amount: 1, method: "Card" }]);
});
test("no wallet: gross = amount, no wallet entry, withMoney leaves the booking alone", () => {
  const x = b({ amount: 5 });
  const m = moneyBreakdown(x);
  assert.deepEqual([m.gross, m.walletApplied, m.due, m.pay, m.paidBy], [5, 0, 5, null, []]);
  assert.equal(withMoney(x), x);
});
test("wallet larger than the price never makes the due negative; a relieved wallet part drops out of the gross", () => {
  assert.equal(moneyBreakdown(b({ amount: 0, walletApplied: 9 })).due, 0);
  const m = moneyBreakdown(b({ amount: 0, walletApplied: 3, walletRelieved: 1 }));
  assert.deepEqual([m.gross, m.walletApplied], [2, 2]);
  assert.equal(moneyBreakdown(b({ amount: -4, walletApplied: 2 })).gross, 2);
});
test("part-paid cash counts: £10 price, £4 wallet, £3 cash received -> £3 to pay", () => {
  const m = moneyBreakdown(b({ amount: 6, walletApplied: 4, amountPaid: 3, pay: "Partially paid" }));
  assert.deepEqual([m.gross, m.cashPaid, m.due], [10, 3, 3]);
});
test("a cancelled booking keeps its stored status label", () => {
  assert.equal(moneyBreakdown(b({ amount: 1, walletApplied: 1, status: "Cancelled" })).pay, null);
});
