/**
 * 9 Oct 2026 refund follow-ups (pure):
 *  Q1  a pending PARTIAL refund whose money was ALSO refunded in the Stripe dashboard must be warned about before Approve (alreadyRefundedWarning).
 *  Q2  a refund on a booking part-paid offline + card is split between the two methods in proportion to what is still refundable by each (splitRefundByMethod).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { alreadyRefundedWarning } from "../server/src/lib/pendingRefund";
import { splitRefundByMethod } from "../server/src/lib/refundSplit";
import type { Booking } from "../features/bookings/types";

const bk = (o: Partial<Booking>): Booking => ({ ref: "R1", pay: "Paid", amount: 20, amountPaid: 20, ...o } as Booking);
const stripeLine = (amount: number) => ({ label: "Refunded in Stripe", amount, on: "2026-10-09", by: "Stripe", source: "Card", refundId: "re_x" });

test("Q1: Stripe already refunded as much as the pending partial -> warn with the three figures", () => {
  const w = alreadyRefundedWarning(bk({ cancel: { on: "x", by: "Provider", refund: "partial", amount: 8 }, refundLog: [stripeLine(8)] } as Partial<Booking>));
  assert.deepEqual(w, { stripeRefunded: 8, pending: 8, paid: 20 });
});

test("Q1: pending + Stripe money passes what was paid -> warn", () => {
  const w = alreadyRefundedWarning(bk({ cancel: { on: "x", by: "Provider", refund: "pending", amount: 15 }, refundLog: [stripeLine(7)] } as Partial<Booking>));
  assert.ok(w);
  assert.equal(w!.stripeRefunded, 7);
});

test("Q1: a smaller Stripe refund that does not overlap -> no warning", () => {
  assert.equal(alreadyRefundedWarning(bk({ cancel: { on: "x", by: "Provider", refund: "partial", amount: 8 }, refundLog: [stripeLine(3)] } as Partial<Booking>)), null);
});

test("Q1: no Stripe refund, a full refund, or an approved one -> no warning", () => {
  assert.equal(alreadyRefundedWarning(bk({ cancel: { on: "x", by: "Provider", refund: "partial", amount: 8 } } as Partial<Booking>)), null);
  assert.equal(alreadyRefundedWarning(bk({ cancel: { on: "x", by: "Provider", refund: "full", amount: 12 }, refundLog: [stripeLine(8)] } as Partial<Booking>)), null);
  assert.equal(alreadyRefundedWarning(bk({ cancel: { on: "x", by: "Provider", refund: "approved", amount: 8 }, refundLog: [stripeLine(8)] } as Partial<Booking>)), null);
});

test("Q1: a pending refund that is exactly what is left is not a double refund -> no warning", () => {
  assert.equal(alreadyRefundedWarning(bk({ cancel: { on: "x", by: "Provider", refund: "partial", amount: 12 }, refundLog: [stripeLine(8)] } as Partial<Booking>)), null);
});

test("Q2: split follows what is still refundable by each method (50/50 -> 100 gives 50/50, 60 gives 30/30)", () => {
  assert.deepEqual(splitRefundByMethod(100, 50, 50), { card: 50, offline: 50 });
  assert.deepEqual(splitRefundByMethod(60, 50, 50), { card: 30, offline: 30 });
});

test("Q2: uneven money, pennies add up, never more than a method can take", () => {
  assert.deepEqual(splitRefundByMethod(15, 20, 10), { card: 10, offline: 5 });
  const s = splitRefundByMethod(10, 1, 2);
  assert.equal(Math.round((s.card + s.offline) * 100), 1000);
  assert.deepEqual(splitRefundByMethod(22, 12, 10), { card: 12, offline: 10 });
});

test("Q2: only one method left, or more asked than the card can take", () => {
  assert.deepEqual(splitRefundByMethod(30, 0, 30), { card: 0, offline: 30 });
  assert.deepEqual(splitRefundByMethod(30, 30, 0), { card: 30, offline: 0 });
  assert.deepEqual(splitRefundByMethod(40, 20, 0), { card: 20, offline: 20 }, "the excess is owed back by hand, as before");
});
