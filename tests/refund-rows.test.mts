/** Reconciliation refunds: one row per refund (no cancellation + "Refund approved" double count). Pure. */
import test from "node:test";
import assert from "node:assert/strict";
import { refundsOf } from "../server/src/lib/refundRows";
import type { Booking } from "../features/bookings/types";

const base = { ref: "AB1", booker: "Sam", listing: "Camp", method: "Card" } as unknown as Booking;

test("approved whole-booking refund shows once, not as cancellation + Refund approved", () => {
  const b = { ...base, refundedApproved: 64, cancel: { on: "2026-10-01", by: "x", refund: "approved", amount: 64, refundVia: "card", refundedAt: "2026-10-02T10:00:00Z" },
    refundLog: [{ label: "Refund approved", amount: 64, on: "2026-10-02", by: "Provider", source: "Card" }] } as unknown as Booking;
  const rows = refundsOf(b);
  assert.equal(rows.length, 1);
  assert.equal(rows.reduce((t, r) => t + r.amount, 0), 64);
});

test("legacy approved refund with no log line still shows once", () => {
  const b = { ...base, cancel: { on: "2026-10-01", by: "x", refund: "approved", amount: 30 } } as unknown as Booking;
  assert.equal(refundsOf(b).length, 1);
});

test("separate partial releases stay separate", () => {
  const b = { ...base, refundLog: [
    { label: "1 day released — wallet credit", amount: 10, on: "2026-10-02", by: "Booker", source: "Wallet" },
    { label: "Refund approved (partial)", amount: 5, on: "2026-10-03", by: "Provider", source: "Card" },
  ] } as unknown as Booking;
  const rows = refundsOf(b);
  assert.equal(rows.length, 2);
  assert.equal(rows.reduce((t, r) => t + r.amount, 0), 15);
});
