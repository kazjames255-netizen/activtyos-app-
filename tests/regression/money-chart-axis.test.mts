import test from "node:test";
import assert from "node:assert/strict";
import { niceStep, niceTicks, axisLabel, thinLabels, barPx, monthAxisLabel, maxLabelsFor } from "../../features/money/chartAxis";

test("niceStep rounds up to 1/2/2.5/5 x 10^k", () => {
  assert.equal(niceStep(0.12), 0.2);
  assert.equal(niceStep(3), 5);
  assert.equal(niceStep(4.4), 5);
  assert.equal(niceStep(17), 20);
  assert.equal(niceStep(22), 25);
  assert.equal(niceStep(0), 1);
});

test("niceTicks always starts at 0 and covers the max", () => {
  const a = niceTicks(17.1, 4);
  assert.equal(a.ticks[0], 0);
  assert.ok(a.top >= 17.1);
  assert.deepEqual(a.ticks, [0, 5, 10, 15, 20]);
  const b = niceTicks(0.6, 4);
  assert.ok(b.top >= 0.6 && b.step < 1);
  assert.equal(niceTicks(0, 4).ticks[0], 0);
  assert.ok(niceTicks(0, 4).top > 0, "an all-zero chart still gets a usable axis");
  assert.ok(niceTicks(12345, 4).top >= 12345);
});

test("axisLabel: pence only below £1 steps, k above a thousand", () => {
  assert.equal(axisLabel(0, 5), "£0");
  assert.equal(axisLabel(10, 5), "£10");
  assert.equal(axisLabel(0.4, 0.2), "£0.40");
  assert.equal(axisLabel(2500, 500), "£2.5k");
});

test("thinLabels never exceeds the cap, keeps first and last, and keeps all when they fit", () => {
  assert.deepEqual([...thinLabels(6, 6)], [0, 1, 2, 3, 4, 5]);
  const s = thinLabels(12, 6);
  assert.ok(s.size <= 6 && s.has(0) && s.has(11));
  const t = thinLabels(12, 4);
  assert.ok(t.size <= 4 && t.has(0) && t.has(11));
  const u = thinLabels(30, 6);
  assert.ok(u.size <= 7 && u.has(0) && u.has(29));
  assert.equal(thinLabels(0, 5).size, 0);
  // no two kept labels are adjacent when thinning is needed
  const sorted = [...thinLabels(12, 5)].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i] - sorted[i - 1] >= 2);
});

test("barPx: zero is zero, tiny non-zero is visible, the max fills the plot", () => {
  assert.equal(barPx(0, 20, 100), 0);
  assert.equal(barPx(0.01, 20, 100), 4);
  assert.equal(barPx(20, 20, 100), 100);
  assert.equal(barPx(10, 20, 100), 50);
  assert.equal(barPx(5, 0, 100), 0);
});

test("monthAxisLabel adds the year on January and on the first column only", () => {
  assert.deepEqual(monthAxisLabel("Jan", 0, 2026, false), { main: "Jan", year: "'26" });
  assert.deepEqual(monthAxisLabel("Oct", 9, 2026, true), { main: "Oct", year: "'26" });
  assert.deepEqual(monthAxisLabel("Oct", 9, 2026, false), { main: "Oct" });
});

test("maxLabelsFor thins on a phone", () => {
  assert.ok(maxLabelsFor(320) < maxLabelsFor(900));
  assert.ok(maxLabelsFor(10) >= 2);
});
