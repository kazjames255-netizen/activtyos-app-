import test from "node:test";
import assert from "node:assert/strict";
import { sortByStart, popoverPlacement } from "../../features/parent/weekPopover";

test("bookings on a day are listed earliest first, untimed last", () => {
  const rows = [{ n: "late", t: "14:00-15:30" }, { n: "none", t: null }, { n: "early", t: "09:00-10:00" }, { n: "noon", t: "12:15" }];
  assert.deepEqual(sortByStart(rows, (r) => r.t).map((r) => r.n), ["early", "noon", "late", "none"]);
});

test("equal start times keep their order", () => {
  const rows = [{ n: "a", t: "09:00" }, { n: "b", t: "09:00" }];
  assert.deepEqual(sortByStart(rows, (r) => r.t).map((r) => r.n), ["a", "b"]);
});

test("popover goes under the tile and stays inside the screen", () => {
  const p = popoverPlacement({ left: 4, right: 64, top: 100, bottom: 200 }, 800, 900, 1);
  assert.equal(p.above, false);
  assert.equal(p.left, 8); // pushed in from the left edge
  assert.equal(p.top, 208);
  const q = popoverPlacement({ left: 760, right: 796, top: 100, bottom: 200 }, 800, 900, 1);
  assert.ok(q.left + 264 <= 792); // not off the right edge
});

test("popover flips above the tile when there is no room below", () => {
  const p = popoverPlacement({ left: 300, right: 360, top: 700, bottom: 780 }, 800, 800, 3);
  assert.equal(p.above, true);
  assert.equal(p.bottom, 800 - 700 + 8);
});
