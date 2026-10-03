/**
 * Payments edge cases (pure: no network, no Firestore).
 * Run: npm run test:payments  (= tsx --test tests/payments-edge.test.mts)
 * Oracle: lib/testTracker/catalogue.ts (DI-014..DI-030, PY-*, FD-*).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { checkCode, reservedEmails, type DiscountCodeDoc } from "../server/src/lib/discountCodes";
import { isPayTokenFormat, payable, balanceOf } from "../server/src/lib/payGate";
import { owedOf, paidSoFar, receivedOf, collectedNet, refundedGross, payLabelFor, payTone, matchesFilter, owedNow } from "../features/bookings/helpers";
import type { Booking } from "../features/bookings/types";

const code = (o: Partial<DiscountCodeDoc>): DiscountCodeDoc => ({ tenantId: "t", code: "X", type: "percent", value: 10, ...o });
const bk = (o: Record<string, unknown>) => ({ ref: "R1", bid: "b", status: "Confirmed", pay: "Unpaid", amount: 100, ...o }) as unknown as Booking;
const TODAY = "2026-10-03";

test("checkCode: expiry (DI-018)", () => {
  assert.equal(checkCode(code({ expiry: "2026-10-03" }), 100, TODAY).ok, true, "expiry == today is the last valid day");
  assert.deepEqual(checkCode(code({ expiry: "2026-10-02" }), 100, TODAY), { ok: false, reason: "This code has expired" });
  assert.equal(checkCode(code({ expiry: "2026-10-04" }), 100, TODAY).ok, true);
  assert.equal(checkCode(code({}), 100, TODAY).ok, true, "no expiry = never expires");
});

test("checkCode: usage limit (DI-019)", () => {
  assert.deepEqual(checkCode(code({ usageLimit: 1, usedCount: 1 }), 100, TODAY), { ok: false, reason: "This code has reached its usage limit" });
  assert.equal(checkCode(code({ usageLimit: 2, usedCount: 1 }), 100, TODAY).ok, true, "one left");
  assert.equal(checkCode(code({ usageLimit: 1 }), 100, TODAY).ok, true, "usedCount absent = 0");
  assert.equal(checkCode(code({ usageLimit: 1, usedCount: 5 }), 100, TODAY).ok, false, "over-used also refused");
  assert.equal(checkCode(code({ usageLimit: 0 }), 100, TODAY).ok, false, "limit 0 = unusable");
});

test("checkCode: per-family limit is NOT enforced here (route reads bookings, DI-020)", () => {
  assert.equal(checkCode(code({ perCustomerLimit: true }), 100, TODAY, { email: "a@b.com" }).ok, true);
});

test("checkCode: reserved-to-email (DI-023/046)", () => {
  const c = code({ assignedTo: "Family@Example.com " });
  assert.deepEqual(reservedEmails(c), ["family@example.com"]);
  assert.equal(checkCode(c, 100, TODAY, { email: "  FAMILY@example.COM  " }).ok, true, "case + whitespace insensitive");
  assert.equal(checkCode(c, 100, TODAY, { email: "other@example.com" }).ok, false);
  assert.deepEqual(checkCode(c, 100, TODAY), { ok: false, reason: "This code is reserved for another customer" }, "no email supplied");
  const g = code({ assignedEmails: [" A@x.com", "b@x.com"] });
  assert.equal(checkCode(g, 100, TODAY, { email: "a@X.com" }).ok, true, "group member");
  assert.equal(checkCode(g, 100, TODAY, { email: "c@x.com" }).ok, false);
});

test("checkCode: percent rounding to pence (DI-014)", () => {
  assert.deepEqual(checkCode(code({ value: 15 }), 33.33, TODAY), { ok: true, off: 5 }, "15% of 33.33 = 4.9995 -> 5.00");
  assert.deepEqual(checkCode(code({ value: 10 }), 90, TODAY), { ok: true, off: 9 });
  assert.deepEqual(checkCode(code({ value: 33.3333 }), 10, TODAY), { ok: true, off: 3.33 });
  assert.deepEqual(checkCode(code({ value: 100 }), 42.5, TODAY), { ok: true, off: 42.5 });
  assert.deepEqual(checkCode(code({ value: 150 }), 40, TODAY), { ok: true, off: 40 }, ">100% capped at subtotal");
});

test("checkCode: flat code bigger than subtotal never goes below zero (DI-030)", () => {
  assert.deepEqual(checkCode(code({ type: "amount", value: 50 }), 20, TODAY), { ok: true, off: 20 });
  assert.deepEqual(checkCode(code({ type: "perAttendee", value: 15 }), 20, TODAY, { attendees: 3 }), { ok: true, off: 20 });
  assert.deepEqual(checkCode(code({ type: "amount", value: 5 }), 90, TODAY), { ok: true, off: 5 }, "DI-015");
  assert.deepEqual(checkCode(code({ type: "perAttendee", value: 5 }), 108, TODAY, { attendees: 2 }), { ok: true, off: 10 }, "DI-016");
  assert.deepEqual(checkCode(code({ type: "perAttendee", value: 5 }), 108, TODAY, { attendees: 0 }), { ok: true, off: 5 }, "0 attendees counts as 1");
});

test("checkCode: min spend boundary (DI-017)", () => {
  assert.equal(checkCode(code({ minSpend: 60 }), 60, TODAY).ok, true, "exactly equal is allowed");
  assert.deepEqual(checkCode(code({ minSpend: 60 }), 59.99, TODAY), { ok: false, reason: "Spend at least £60.00 to use this code" });
  assert.deepEqual(checkCode(code({ minSpend: 60 }), 20, TODAY), { ok: false, reason: "Spend at least £60.00 to use this code" });
  assert.deepEqual(checkCode(code({ minSpend: 60 }), 90, TODAY), { ok: true, off: 9 });
});

test("checkCode: misc guards (active, zero, maxOff, listing, franchise)", () => {
  assert.equal(checkCode(code({ active: false }), 100, TODAY).ok, false);
  assert.equal(checkCode(code({ value: 0 }), 100, TODAY).ok, false, "gives no discount");
  assert.equal(checkCode(code({}), 0, TODAY).ok, false, "zero subtotal");
  assert.deepEqual(checkCode(code({ type: "amount", value: 30, maxOff: 12.5 }), 100, TODAY), { ok: true, off: 12.5 });
  assert.equal(checkCode(code({ listingId: "L1" }), 100, TODAY, { listingId: "L2" }).ok, false, "DI-025");
  assert.equal(checkCode(code({ listingId: "L1" }), 100, TODAY, { listingId: "L1" }).ok, true);
  assert.equal(checkCode(code({ franchiseId: "F1" }), 100, TODAY, { listingFranchiseId: null }).ok, false, "DI-026");
  assert.equal(checkCode(code({ franchiseId: "F1" }), 100, TODAY, { listingFranchiseId: "F1" }).ok, true);
});

test("money helpers: owedOf / receivedOf / paidSoFar / owedNow", () => {
  assert.equal(owedOf(bk({ pay: "Unpaid" })), 100);
  assert.equal(owedOf(bk({ pay: "Partially paid", amountPaid: 40 })), 60, "PY-023");
  assert.equal(owedOf(bk({ pay: "Paid" })), 0);
  assert.equal(owedOf(bk({ pay: "Funded", amount: 0 })), 0, "PY-017 HAF £0");
  assert.equal(owedOf(bk({ pay: "Awaiting voucher payment" })), 100);
  assert.equal(owedOf(bk({ pay: "Partially paid", amountPaid: 150 })), 0, "overpaid never negative");
  assert.equal(receivedOf(bk({ pay: "Funded", amount: 0 })), 0);
  assert.equal(receivedOf(bk({ pay: "Refund pending" })), 100);
  assert.equal(receivedOf(bk({ pay: "Partially refunded" })), 100);
  assert.equal(receivedOf(bk({ pay: "Unpaid" })), 0);
  assert.equal(paidSoFar(bk({ pay: "Partially paid", amountPaid: 40 })), 40);
  assert.equal(paidSoFar(bk({ pay: "Paid", amountPaid: 0 })), 100, "joint sibling booking stores amountPaid 0");
  assert.equal(paidSoFar(bk({ pay: "Unpaid", walletApplied: 10 })), 10, "wallet counts");
  assert.equal(paidSoFar(bk({ pay: "Refund pending" })), 100);
  assert.equal(paidSoFar(bk({ pay: "Awaiting voucher payment" })), 0);
  assert.equal(owedNow(bk({ status: "Waitlisted" })), 0, "waitlist owes nothing");
  assert.equal(owedNow(bk({ status: "Offered" })), 0);
  assert.equal(owedNow(bk({ status: "Cancelled" })), 0);
  assert.equal(owedNow(bk({ status: "Confirmed" })), 100);
});

test("money helpers: collectedNet / refundedGross", () => {
  assert.equal(collectedNet(bk({ pay: "Paid" })), 100);
  assert.equal(collectedNet(bk({ pay: "Unpaid" })), 0);
  assert.equal(refundedGross(bk({ pay: "Refund pending", cancel: { refund: "pending", amount: 100 } })), 0, "pending refund has not moved money");
  assert.equal(collectedNet(bk({ pay: "Refund pending", cancel: { refund: "full", amount: 100 } })), 100);
  assert.equal(refundedGross(bk({ pay: "Refunded", cancel: { refund: "approved", amount: 100 } })), 100);
  assert.equal(collectedNet(bk({ pay: "Refunded", cancel: { refund: "approved", amount: 100 } })), 0);
  assert.equal(collectedNet(bk({ pay: "Partially refunded", refundLog: [{ amount: 25, label: "Day released" }] })), 75);
  assert.equal(
    refundedGross(bk({ pay: "Refunded", cancel: { refund: "approved", amount: 90 }, refundLog: [{ amount: 90, label: "Refund approved: cancellation" }] })),
    90, "approved refund already in the log is not counted twice");
  assert.equal(collectedNet(bk({ pay: "Paid", refundLog: [{ amount: 500 }] })), 0, "never negative");
});

test("payLabelFor / payTone (waitlist, refunds, funded, off-platform)", () => {
  for (const status of ["Waitlisted", "Offered"]) {
    assert.equal(payLabelFor({ pay: "Unpaid", status }), "Waiting list - nothing owed");
    assert.deepEqual(payTone("Unpaid", status), payTone("Nonsense"), "grey while waiting");
  }
  assert.equal(payLabelFor({ pay: "Unpaid", status: "Confirmed" }), "Unpaid");
  assert.equal(payLabelFor({ pay: "Refund pending" }), "Refund pending");
  assert.equal(payLabelFor({ pay: "Partially refunded" }), "Partially refunded");
  assert.equal(payLabelFor({ pay: "Partially refunded", method: "Tax-Free Childcare" }), "Partially refunded via HMRC");
  assert.equal(payLabelFor({ pay: "Funded" }), "Funded £0");
  assert.equal(payLabelFor({ pay: "Partially paid" }), "Partially paid");
  assert.equal(payLabelFor({ pay: "Awaiting voucher payment", voucherScheme: "Edenred" }), "Edenred pending");
  assert.equal(payLabelFor({ pay: "Awaiting voucher payment", method: "Cash" }), "Cash pending");
  assert.equal(payLabelFor({ pay: "Awaiting voucher payment", method: "Bank transfer" }), "Transfer pending");
  assert.equal(payLabelFor({ pay: "Awaiting voucher payment", method: "Tax-Free Childcare" }), "TFC pending");
  assert.equal(payLabelFor({ pay: "Paid", method: "Tax-Free Childcare" }), "Paid · TFC");
  assert.equal(payLabelFor({ pay: "Paid", voucherScheme: "Edenred" }), "Paid · voucher");
  assert.equal(payLabelFor({ pay: "Paid", method: "Cash" }), "Paid");
  assert.deepEqual(payTone("Refund pending"), payTone("Unpaid"), "both amber");
  assert.deepEqual(payTone("Partially paid"), payTone("Unpaid"));
  assert.notDeepEqual(payTone("Awaiting voucher payment"), payTone("Unpaid"), "voucher-pending is distinct from unpaid");
  assert.deepEqual(payTone("Funded"), payTone("Awaiting voucher payment"), "both blue");
  assert.notDeepEqual(payTone("Paid"), payTone("Unpaid"));
});

test("matchesFilter 'unpaid' (PY-021)", () => {
  const u = (o: Record<string, unknown>) => matchesFilter(bk(o), "unpaid");
  assert.equal(u({ pay: "Unpaid" }), true);
  assert.equal(u({ pay: "Invoice sent" }), true);
  assert.equal(u({ pay: "Awaiting voucher payment" }), true);
  assert.equal(u({ pay: "Unpaid", status: "Waitlisted" }), false);
  assert.equal(u({ pay: "Unpaid", status: "Offered" }), false);
  assert.equal(u({ pay: "Unpaid", status: "Cancelled" }), false);
  assert.equal(u({ pay: "Unpaid", status: "Declined" }), false);
  assert.equal(u({ pay: "Paid" }), false);
  assert.equal(u({ pay: "Funded", amount: 0 }), false);
  assert.equal(u({ pay: "Refund pending" }), false);
  assert.equal(u({ pay: "Partially refunded" }), false);
  assert.equal(u({ pay: "Partially paid", amountPaid: 40 }), false, "documents current behaviour: part-paid is not in the Unpaid tab");
});

test("pay-link token format (PY-019)", () => {
  assert.equal(isPayTokenFormat("123e4567-e89b-12d3-a456-426614174000"), true);
  assert.equal(isPayTokenFormat("123E4567-E89B-12D3-A456-426614174000"), true, "case-insensitive");
  assert.equal(isPayTokenFormat(""), false);
  assert.equal(isPayTokenFormat("123e4567-e89b-12d3-a456-42661417400"), false, "35 chars");
  assert.equal(isPayTokenFormat("123e4567-e89b-12d3-a456-4266141740000"), false, "37 chars");
  assert.equal(isPayTokenFormat("../../bookings/abcdefghijklmnopqrstuvw"), false, "path traversal");
  assert.equal(isPayTokenFormat("123e4567-e89b-12d3-a456-42661417400g"), false, "non-hex");
  assert.equal(isPayTokenFormat("123e4567-e89b-12d3-a456-426614174000\n"), false, "trailing newline");
  // charset + length only: 36 dashes passes (harmless, the doc lookup then misses)
  assert.equal(isPayTokenFormat("-".repeat(36)), true);
});

test("payable(): gating on status / pay", () => {
  assert.equal(payable({ status: "Confirmed", pay: "Unpaid" }), true);
  assert.equal(payable({ status: "Confirmed", pay: "Partially paid" }), true);
  assert.equal(payable({ status: "Confirmed", pay: "Partially refunded" }), true, "balanceOf then decides whether anything is due");
  assert.equal(payable({ status: "Confirmed", pay: "Paid" }), false);
  assert.equal(payable({ status: "Confirmed", pay: "Refunded" }), false);
  assert.equal(payable({ status: "Confirmed", pay: "Refund pending" }), false);
  assert.equal(payable({ status: "Waitlisted", pay: "Unpaid" }), false);
  assert.equal(payable({ status: "Offered", pay: "Unpaid" }), false);
  assert.equal(payable({ status: "Approval needed", pay: "Unpaid" }), false);
  assert.equal(payable({ status: "Declined", pay: "Unpaid" }), false);
  assert.equal(payable({ status: "Cancelled", pay: "Unpaid" }), false);
  assert.equal(payable({ status: "Approval needed", pay: "Invoice sent" }), true, "operator invoice is payable");
  // payable() alone does not reject a cancelled booking still saying "Invoice sent"; the route's earlier
  // Cancelled/Declined checks (payments.ts GET + checkout) are what stop it. Locked in so nobody drops them.
  assert.equal(payable({ status: "Cancelled", pay: "Invoice sent" }), true);
});

test("balanceOf(): amount comes from the booking balance, never the client", () => {
  assert.equal(balanceOf(bk({ pay: "Unpaid", amount: 33.33 })), 33.33);
  assert.equal(balanceOf(bk({ pay: "Partially paid", amount: 100, amountPaid: 40 })), 60);
  assert.equal(balanceOf(bk({ pay: "Partially paid", amount: 100, amountPaid: 33.33 })), 66.67, "float noise stripped (100 - 33.33)");
  assert.equal(balanceOf(bk({ pay: "Partially paid", amount: 0.3, amountPaid: 0.1 })), 0.2, "0.3 - 0.1 float noise stripped");
  assert.equal(balanceOf(bk({ pay: "Paid" })), 0);
  assert.equal(balanceOf(bk({ pay: "Partially refunded", amount: 80 })), 0, "released day: not charged the price twice");
  assert.equal(balanceOf(bk({ pay: "Funded", amount: 0 })), 0);
  assert.equal(balanceOf(bk({ pay: "Unpaid", amount: 0 })), 0);
  assert.equal(balanceOf(bk({ pay: "Unpaid", amount: undefined })), 0);
  assert.equal(balanceOf(bk({ pay: "Partially paid", amount: 100, amountPaid: 120 })), 0, "overpaid -> nothing to pay");
  assert.equal(balanceOf(bk({ pay: "Unpaid", amount: 50, requestedAmount: 1 })), 50, "unknown client-ish fields are ignored");
});
