import test from "node:test";
import assert from "node:assert/strict";
import { classifyRisk, stateReason, isWatchedStatus, mapLimit } from "../server/src/lib/atRisk";

const NOW = Date.parse("2026-10-08T12:00:00Z"), DAY = 86_400_000;
const ago = (d: number) => NOW - d * DAY;

test("at-risk: subscription state wins and needs no booking history", () => {
  assert.equal(stateReason({ status: "past_due" }, NOW)?.reason, "payment_failed");
  assert.equal(stateReason({ status: "canceling" }, NOW)?.reason, "cancelling");
  assert.equal(stateReason({ status: "trialing", trialEndsAt: new Date(NOW + 2 * DAY).toISOString() }, NOW)?.detail, "Trial ends in 2d");
  assert.equal(stateReason({ status: "active" }, NOW), null);
  assert.equal(stateReason({ status: "trialing", trialEndsAt: new Date(NOW + 10 * DAY).toISOString() }, NOW), null);
});

test("at-risk: never launched / quiet / healthy", () => {
  const created = new Date(ago(30)).toISOString();
  assert.equal(classifyRisk({ status: "active", createdAt: created }, NOW)?.reason, "never_launched");
  assert.equal(classifyRisk({ status: "active", createdAt: new Date(ago(5)).toISOString() }, NOW), null);
  assert.equal(classifyRisk({ status: "active", createdAt: created, lastBooking: ago(60) }, NOW)?.detail, "No bookings in 60d");
  assert.equal(classifyRisk({ status: "active", createdAt: created, lastBooking: ago(45) }, NOW), null);
  assert.equal(classifyRisk({ status: "active", createdAt: created, lastBooking: ago(3) }, NOW), null);
});

test("at-risk: watched statuses and mapLimit order/concurrency", async () => {
  assert.ok(isWatchedStatus("active") && !isWatchedStatus("canceled"));
  let inflight = 0, peak = 0;
  const r = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => { inflight++; peak = Math.max(peak, inflight); await new Promise((x) => setTimeout(x, 5)); inflight--; return n * 2; });
  assert.deepEqual(r, [2, 4, 6, 8, 10, 12]);
  assert.ok(peak <= 2);
});
