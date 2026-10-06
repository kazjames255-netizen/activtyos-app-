import test from "node:test";
import assert from "node:assert/strict";
import { isFirstBookedSession } from "../../server/src/lib/bookingRules";

const block = ["2026-10-07", "2026-10-08", "2026-10-09", "2026-10-12"];

test("a multi-day booking is reminded before its first day only", () => {
  assert.equal(isFirstBookedSession(undefined, block, "2026-10-07"), true);
  assert.equal(isFirstBookedSession(undefined, block, "2026-10-08"), false);
  assert.equal(isFirstBookedSession(undefined, block, "2026-10-12"), false);
});
test("the first day is the booking's own first day, not the block's", () => {
  const days = ["2026-10-09", "2026-10-12"];
  assert.equal(isFirstBookedSession(days, block, "2026-10-07"), false);
  assert.equal(isFirstBookedSession(days, block, "2026-10-09"), true);
  assert.equal(isFirstBookedSession(days, block, "2026-10-12"), false);
});
test("a single-day booking still gets its reminder", () => {
  assert.equal(isFirstBookedSession(["2026-10-08"], block, "2026-10-08"), true);
});
test("an unsorted day list still finds the earliest day", () => {
  assert.equal(isFirstBookedSession(["2026-10-12", "2026-10-08"], block, "2026-10-08"), true);
});
