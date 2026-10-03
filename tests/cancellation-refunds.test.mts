/** Cancellation / refund fixes (CN-004/006/007/009/011/022/036 + fresh-provider defaults). Pure. */
import test from "node:test";
import assert from "node:assert/strict";
import { accumulatePendingRelease, noRefundCreditAmount, DEFAULT_POLICIES } from "../lib/cancellation";
import { refundButtonKind, refundedGross } from "../features/bookings/helpers";
import { publicLibrarySettings } from "../server/src/lib/publicLibrary";
import { refundDeclinedSpec } from "../server/src/lib/emailTemplates";
import type { Booking } from "../features/bookings/types";

test("CN-022: second release adds to the pending refund, capped at refundable", () => {
  const first = { refundOnly: true, refund: "pending", amount: 18 };
  assert.equal(accumulatePendingRelease(first, 0, 40), 18, "near day (£0) keeps the earlier £18");
  assert.equal(accumulatePendingRelease(first, 6, 40), 24);
  assert.equal(accumulatePendingRelease(first, 30, 40), 40, "never above refundable");
  assert.equal(accumulatePendingRelease(undefined, 7, 40), 7);
  assert.equal(accumulatePendingRelease({ refundOnly: true, refund: "approved", amount: 18 }, 7, 40), 7, "settled refunds start fresh");
});

test("CN-004: credit note only when policy gives £0, money was paid, wallet is on", () => {
  const on = { noRefundCredit: true, walletOn: true, policyAmount: 0, paid: 25 };
  assert.equal(noRefundCreditAmount(on), 25);
  assert.equal(noRefundCreditAmount({ ...on, noRefundCredit: false }), 0);
  assert.equal(noRefundCreditAmount({ ...on, walletOn: false }), 0);
  assert.equal(noRefundCreditAmount({ ...on, policyAmount: 5 }), 0);
  assert.equal(noRefundCreditAmount({ ...on, paid: 0 }), 0);
});

test("CN-006/009/011: refund button follows how it was paid, then destination", () => {
  assert.equal(refundButtonKind({ voucherScheme: "Tax-Free Childcare", cancel: { refundTo: "card" } }), "reimbursed");
  assert.equal(refundButtonKind({ method: "Childcare voucher", cancel: { refundTo: "card" } }), "reimbursed");
  assert.equal(refundButtonKind({ method: "Cash", cancel: { refundTo: "card" } }), "cash");
  assert.equal(refundButtonKind({ method: "Card", paymentIntentId: "pi_1", cancel: { refundTo: "card" } }), "stripe");
  assert.equal(refundButtonKind({ method: "Card", cancel: { refundTo: "card" } }), "bank");
  assert.equal(refundButtonKind({ voucherScheme: "x", cancel: { refundTo: "wallet" } }), "wallet");
});

test("CN-036: a one-day partial refund comes off revenue", () => {
  const b = { ref: "R", bid: "b", status: "Confirmed", pay: "Partially refunded", amount: 100, amountPaid: 100, refundLog: [{ label: "1 day", amount: 20, on: "2026-10-03", by: "Booker", source: "Wallet" }] } as unknown as Booking;
  assert.equal(refundedGross(b), 20);
  assert.equal(Math.max(0, (b.amount ?? 0) - refundedGross(b)), 80);
});

test("fresh provider: public settings carry the server defaults", () => {
  const s = publicLibrarySettings({});
  assert.equal(s.refundLetCustomerChoose, true);
  assert.equal(s.allowCardRefund, true);
  assert.equal(s.noRefundCredit, false);
  assert.deepEqual(s.cancellationPolicies, DEFAULT_POLICIES);
  const saved = publicLibrarySettings({ refundLetCustomerChoose: false, cancellationPolicies: [{ id: "x" }] });
  assert.equal(saved.refundLetCustomerChoose, false, "saved values win");
  assert.deepEqual(saved.cancellationPolicies, [{ id: "x" }]);
  assert.deepEqual(publicLibrarySettings({ cancellationPolicies: [] }).cancellationPolicies, DEFAULT_POLICIES);
});

test("CN-007: refund-declined email names the provider, amount and that the cancellation stands", () => {
  const b = { ref: "R", booker: "Sam", listing: "Football Camp", cancel: { amount: 30 } } as unknown as Booking;
  const s = refundDeclinedSpec(b, "Sunny Club");
  assert.equal(s.subject, "Refund update — Football Camp");
  assert.match(s.body, /Sunny Club/);
  assert.match(s.body, /£30\.00/);
  assert.match(s.body, /cancellation still stands/);
});
