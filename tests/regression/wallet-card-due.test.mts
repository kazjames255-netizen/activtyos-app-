import test from "node:test";
import assert from "node:assert/strict";
import { owedOf, receivedOf, cashReceivedOf } from "../../features/bookings/helpers";
import { balanceOf } from "../../server/src/lib/payGate";

// QA-C D1: store credit was taken off twice. `amount` is already net of the wallet, so the card must be asked for amount - CASH received.
const b = (o: Record<string, unknown>) => ({ status: "Confirmed", pay: "Unpaid", amount: 0, ...o }) as any;

test("wallet part-paid: £12.50 less £5 credit is £7.50 to pay by card, not £2.50", () => {
  const x = b({ amount: 7.5, walletApplied: 5 });
  assert.equal(owedOf(x), 7.5);
  assert.equal(balanceOf(x), 7.5);
});

test("wallet + discount: the amount after discount and credit is what the card is asked for", () => {
  const x = b({ amount: 8, walletApplied: 2, discountOff: 2.5, listPrice: 12.5 });
  assert.equal(balanceOf(x), 8);
});

test("once paid by card nothing is owed; the income screens still count the wallet as received", () => {
  const x = b({ amount: 7.5, walletApplied: 5, pay: "Paid", amountPaid: 7.5 });
  assert.equal(owedOf(x), 0);
  assert.equal(cashReceivedOf(x), 7.5);
  assert.equal(receivedOf(x), 12.5);
});

test("a part-paid booking asks for the rest, wallet or not", () => {
  const x = b({ amount: 7.5, walletApplied: 5, amountPaid: 3, pay: "Partially paid" });
  assert.equal(owedOf(x), 4.5);
});

test("wallet + Tax-Free Childcare split: the card pays only amount - HMRC share, never the wallet twice", () => {
  const x = b({ amount: 7.5, walletApplied: 5, tfcAmount: 5, pay: "Awaiting voucher payment" });
  assert.equal(balanceOf(x), 2.5);
  const afterCard = { ...x, cardPaid: 2.5, amountPaid: 2.5 };
  assert.equal(balanceOf(afterCard), 0);
  assert.equal(cashReceivedOf(afterCard), 2.5);
});

test("no wallet: unchanged", () => {
  assert.equal(balanceOf(b({ amount: 0.3 })), 0.3);
  assert.equal(owedOf(b({ amount: 20, pay: "Paid" })), 0);
});
