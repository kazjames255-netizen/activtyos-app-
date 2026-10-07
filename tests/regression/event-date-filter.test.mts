import { test } from "node:test";
import assert from "node:assert/strict";
import { eventRange, eventWindow, sensibleEventDate, inDateRange } from "../../features/bookings/helpers";

// "Event date" filter on the provider's bookings list: when the child is IN, not when the booking was taken.
const NOW = new Date(2026, 9, 7, 12, 0, 0); // Wed 7 Oct 2026 (local)
const booking = (sessions: string[]) => ({ sessions }) as never;

test("quick ranges: today, tomorrow, Mon-Sun week, next 7, next 30", () => {
  assert.deepEqual(eventRange("today", NOW), { from: "2026-10-07", to: "2026-10-07" });
  assert.deepEqual(eventRange("tomorrow", NOW), { from: "2026-10-08", to: "2026-10-08" });
  assert.deepEqual(eventRange("week", NOW), { from: "2026-10-05", to: "2026-10-11" });
  assert.deepEqual(eventRange("next7", NOW), { from: "2026-10-07", to: "2026-10-13" });
  assert.deepEqual(eventRange("next30", NOW), { from: "2026-10-07", to: "2026-11-05" });
});

test("a Sunday belongs to the week that started the Monday before", () => {
  assert.deepEqual(eventRange("week", new Date(2026, 9, 11, 9, 0, 0)), { from: "2026-10-05", to: "2026-10-11" });
});

test("a half-typed or silly year is never used as a filter", () => {
  assert.equal(sensibleEventDate("2026-10-21", NOW), true);
  assert.equal(sensibleEventDate("0002-10-21", NOW), false);
  assert.equal(sensibleEventDate("2006-10-21", NOW), false);
  assert.equal(sensibleEventDate("2099-10-21", NOW), false);
  assert.equal(sensibleEventDate("", NOW), false);
  assert.equal(eventWindow("", "0002-10-21", "", NOW), null);
});

test("between: one open end is allowed; a quick range wins over typed dates", () => {
  assert.deepEqual(eventWindow("", "2026-10-20", "", NOW), { from: "2026-10-20", to: "" });
  assert.deepEqual(eventWindow("", "", "2026-10-31", NOW), { from: "", to: "2026-10-31" });
  assert.deepEqual(eventWindow("today", "2026-10-20", "2026-10-31", NOW), { from: "2026-10-07", to: "2026-10-07" });
  assert.equal(eventWindow("", "", "", NOW), null);
});

test("a booking matches when any of its event days is inside the window", () => {
  const b = booking(["Mon 26 Oct 2026 · 09:00 – 15:30", "Tue 27 Oct 2026 · 09:00 – 15:30"]);
  assert.equal(inDateRange(b, "2026-10-27", "2026-10-27"), true);
  assert.equal(inDateRange(b, "2026-10-28", "2026-11-05"), false);
  assert.equal(inDateRange(b, "2026-10-01", ""), true);
  assert.equal(inDateRange(booking([]), "2026-10-01", "2026-10-31"), false);
});
