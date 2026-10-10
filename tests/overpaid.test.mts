/** ONE overpaid rule (overpaidOf): money held beyond the price that has NOT already been handed back or promised back. Pure. */
import test from "node:test";
import assert from "node:assert/strict";
import { overpaidOf } from "../features/bookings/helpers";
import type { Booking } from "../features/bookings/types";

const mk = (o: Record<string, unknown>) => ({ ref: "AB1", pay: "Partially paid", amount: 1, amountPaid: 2, ...o }) as unknown as Booking;

test("paid 2, price 1, no refund: 1 overpaid", () => assert.equal(overpaidOf(mk({})), 1));
test("paid 2, price 1, wallet-credit refund 1 (the APF-10342 case): 0", () =>
  assert.equal(overpaidOf(mk({ refundLog: [{ label: "Sam - 15 Oct - wallet credit", amount: 1, on: "9 Oct", by: "Provider", source: "Wallet" }] })), 0));
test("paid 2, price 1, refund request pending 1: 0", () =>
  assert.equal(overpaidOf(mk({ cancel: { on: "x", by: "Provider", refund: "pending", amount: 1, refundOnly: true } })), 0));
test("approved bank refund still awaiting transfer counts as handled", () =>
  assert.equal(overpaidOf(mk({ refundedApproved: 1, cancel: { on: "x", by: "Provider", refund: "approved", amount: 1, refundOnly: true, refundTransfer: "awaiting" } })), 0));
test("part refund 0.5: 0.5 still overpaid", () =>
  assert.equal(overpaidOf(mk({ refundLog: [{ label: "x - wallet credit", amount: 0.5, on: "d", by: "Provider", source: "Wallet" }] })), 0.5));
test("refund made in the Stripe dashboard (refund sync log line) counts", () =>
  assert.equal(overpaidOf(mk({ method: "Card", refundLog: [{ label: "Refunded in Stripe", amount: 1, on: "d", by: "Stripe", source: "Card", refundId: "re_1" }] })), 0));
test("wallet-applied booking: cash 1 + wallet 1 against price (1 cash + 1 wallet) is not overpaid", () =>
  assert.equal(overpaidOf(mk({ amount: 1, amountPaid: 1, walletApplied: 1 })), 0));
test("wallet-applied booking really overpaid by 1", () =>
  assert.equal(overpaidOf(mk({ amount: 1, amountPaid: 2, walletApplied: 1 })), 1));
test("two refunds add up", () =>
  assert.equal(overpaidOf(mk({ amountPaid: 3, refundLog: [
    { label: "a - wallet credit", amount: 0.5, on: "d", by: "Provider", source: "Wallet" },
    { label: "b - wallet credit", amount: 0.5, on: "d", by: "Provider", source: "Wallet" }] })), 1));
test("refund larger than the overpay clamps at 0, never negative", () =>
  assert.equal(overpaidOf(mk({ refundLog: [{ label: "x", amount: 5, on: "d", by: "Provider", source: "Card" }] })), 0));
test("exactly paid: 0", () => assert.equal(overpaidOf(mk({ amountPaid: 1 })), 0));
