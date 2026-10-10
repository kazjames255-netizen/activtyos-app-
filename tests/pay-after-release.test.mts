/** pay status after a day is cancelled/released: "Refunded" only when nothing is held any more. Pure. */
import test from "node:test";
import assert from "node:assert/strict";
import { overpaidOf } from "../features/bookings/helpers";
import { applyCancelDay, applyCancelChild } from "../features/bookings/mutations";
import type { Booking } from "../features/bookings/types";

const twoDays = () => ({ ref: "AB2", status: "Confirmed", pay: "Paid", method: "Cash", amount: 2, amountPaid: 2, days: ["2026-11-02", "2026-11-03"],
  kids: [{ name: "Kid", dates: ["2026-11-02", "2026-11-03"] }] }) as unknown as Booking;

test("cancel one of two paid days with wallet credit: is Partially refunded (one day still held), not Refunded", () => {
  const b = twoDays();
  applyCancelDay(b, 0, "2026-11-03", { resolution: "wallet" });
  assert.equal(b.amount, 1);
  assert.equal(b.pay, "Partially refunded");
  assert.equal(overpaidOf(b), 0);
});
test("cancel one of two days, refund pending: is Paid", () => {
  const b = twoDays();
  applyCancelDay(b, 0, "2026-11-03", { resolution: "refund" });
  assert.equal(b.pay, "Paid");
});
test("cancel BOTH days with wallet credit: Refunded", () => {
  const b = twoDays();
  applyCancelDay(b, 0, "2026-11-02", { resolution: "wallet" });
  applyCancelDay(b, 0, "2026-11-03", { resolution: "wallet" });
  assert.equal(b.status, "Cancelled");
  assert.equal(b.pay, "Refunded");
});
test("whole child cancelled with wallet credit: Refunded", () => {
  const b = twoDays();
  applyCancelChild(b, 0, { resolution: "wallet" });
  assert.equal(b.pay, "Refunded");
});
