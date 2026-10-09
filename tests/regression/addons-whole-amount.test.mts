import test from "node:test";
import assert from "node:assert/strict";
import { addonsGoBack, refundCoversWhole } from "../../features/bookings/addonRefund";

// FINAL POLISH (C): the whole-amount rule (a refund as big as the whole booking takes the extras back) is ONE helper, used by cancel, cancel-child,
// cancel-day (when it removes the last day) and the parent routes. Before, only 'cancel partial' had it, so a cancel-child with an explicit refund of
// the whole booking left the T-shirt following to the sibling in Add-on orders, the register and the figures.
const b = (amount: number, walletApplied = 0, walletRelieved = 0) => ({ amount, walletApplied, walletRelieved });

test("refundCoversWhole: cash price plus wallet credit spent on it", () => {
  assert.equal(refundCoversWhole(31, b(31)), true);
  assert.equal(refundCoversWhole(30.997, b(31)), true, "float rounding");
  assert.equal(refundCoversWhole(30, b(31)), false);
  assert.equal(refundCoversWhole(31, b(21, 10)), true);
  assert.equal(refundCoversWhole(21, b(21, 10)), false);
  assert.equal(refundCoversWhole(31, b(21, 10, 10)), true, "wallet already relieved no longer counts");
  assert.equal(refundCoversWhole(0, b(0)), false, "nothing is not a refund");
});
test("whole-booking cancel: full, or a partial that covers the whole booking; never a smaller partial or no refund", () => {
  const p = { kind: "cancel" as const, moved: true, grossBefore: 31 };
  assert.equal(addonsGoBack({ ...p, refund: "full", refundedAmount: 31 }), true);
  assert.equal(addonsGoBack({ ...p, refund: "partial", refundedAmount: 31 }), true);
  assert.equal(addonsGoBack({ ...p, refund: "partial", refundedAmount: 5 }), false);
  assert.equal(addonsGoBack({ ...p, refund: "none", refundedAmount: 0, moved: false }), false);
});
test("cancel-child: default refund goes back; an explicit amount only when it covers the whole booking (Cref31)", () => {
  const p = { kind: "cancel-child" as const, moved: true, grossBefore: 31 };
  assert.equal(addonsGoBack({ ...p, refundedAmount: 31 }), true, "no explicit amount");
  assert.equal(addonsGoBack({ ...p, explicitAmount: 31, refundedAmount: 31 }), true, "explicit amount = whole booking");
  assert.equal(addonsGoBack({ ...p, explicitAmount: 5, refundedAmount: 5 }), false);
});
test("cancel-day: only when it removes the last remaining day and the refund covers the whole booking", () => {
  const p = { kind: "cancel-day" as const, moved: true, grossBefore: 31, refundedAmount: 31 };
  assert.equal(addonsGoBack({ ...p, lastDay: true }), true);
  assert.equal(addonsGoBack({ ...p, lastDay: false }), false);
  assert.equal(addonsGoBack({ ...p, lastDay: true, refundedAmount: 20 }), false);
});
test("the provider's explicit YES / NO always wins; nothing moved means nothing goes back", () => {
  assert.equal(addonsGoBack({ kind: "cancel-child", moved: true, grossBefore: 31, refundedAmount: 5, explicitAmount: 5, refundsAddons: true }), true);
  assert.equal(addonsGoBack({ kind: "cancel", moved: true, refund: "full", grossBefore: 31, refundedAmount: 31, refundsAddons: false }), false);
  assert.equal(addonsGoBack({ kind: "cancel", moved: false, refund: "full", grossBefore: 31, refundedAmount: 31, refundsAddons: true }), false);
});
test("parent cancel / release use the same rule", () => {
  assert.equal(addonsGoBack({ kind: "parent-cancel", moved: true, refund: "partial", grossBefore: 31, refundedAmount: 31 }), true);
  assert.equal(addonsGoBack({ kind: "parent-cancel", moved: true, refund: "full", grossBefore: 31, refundedAmount: 31 }), true);
  assert.equal(addonsGoBack({ kind: "parent-cancel", moved: true, refund: "partial", grossBefore: 31, refundedAmount: 10 }), false);
});
