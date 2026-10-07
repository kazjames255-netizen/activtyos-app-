import test from "node:test";
import assert from "node:assert/strict";
import { parseSessionTile, daysFromToday } from "../../features/bookings/SessionTiles";

test("parseSessionTile reads weekday, day, month, year and time", () => {
  const p = parseSessionTile("Wed 28 Oct 2026 · 09:00 – 15:30");
  assert.deepEqual(p && { wd: p.wd, day: p.day, mon: p.mon, year: p.year, iso: p.iso, time: p.time }, { wd: "Wed", day: 28, mon: "Oct", year: 2026, iso: "2026-10-28", time: "09:00–15:30" });
});

test("parseSessionTile handles 'Sept' and a missing time; junk returns null", () => {
  const p = parseSessionTile("Mon 06 Sept 2027");
  assert.equal(p?.iso, "2027-09-06");
  assert.equal(p?.time, "");
  assert.equal(parseSessionTile("Week 4"), null);
});

test("daysFromToday counts whole days either side of today", () => {
  assert.equal(daysFromToday("2026-10-08", "2026-10-07"), 1);
  assert.equal(daysFromToday("2026-10-07", "2026-10-07"), 0);
  assert.equal(daysFromToday("2026-10-01", "2026-10-07"), -6);
});
