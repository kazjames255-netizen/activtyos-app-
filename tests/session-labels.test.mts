import test from "node:test";
import assert from "node:assert/strict";
import { bookingSessionLabels } from "../server/src/lib/sessionLabels";

const sessions = [
  { date: "2026-10-19", start: "09:00", end: "12:00" },
  { date: "2026-10-20", start: "09:00", end: "12:00" },
];

test("no timing keeps the block hours", () => {
  assert.deepEqual(bookingSessionLabels(sessions, ["2026-10-19"], null), ["Mon 19 Oct 2026 · 09:00 – 12:00"]);
});

test("afternoon timing uses the period hours", () => {
  const out = bookingSessionLabels(sessions, ["2026-10-19", "2026-10-20"], { start: "13:00", finish: "16:00" });
  assert.equal(out.length, 2);
  assert.ok(out[0].endsWith("13:00 – 16:00"));
});
