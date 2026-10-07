// A week now and another in six months: separate periods, nothing generated in between (Kaz, 7 Oct 2026).
import test from "node:test";
import assert from "node:assert/strict";
import { genDates, groupWeeks } from "../../features/listings/format";
import { periodDates, periodSpan, periodsProblem, setWeekOff } from "../../features/listings/wizardRules";
import { desiredRuns, recipeDates } from "../../server/src/lib/listingRunsPure";

const MONFRI = [1, 2, 3, 4, 5];
const two = [{ from: "2026-10-12", to: "2026-10-16" }, { from: "2027-04-12", to: "2027-04-16" }];

test("two periods make only their own days: a week in October and a week in April, nothing between", () => {
  const dates = periodDates({ runFrom: "2026-10-12", runTo: "2027-04-16", days: MONFRI, runPeriods: two }, genDates);
  assert.equal(dates.length, 10);
  assert.equal(groupWeeks(dates).length, 2);
  assert.ok(!dates.some((d) => d > "2026-10-16" && d < "2027-04-12"));
});

test("no periods = the single From..To range, unchanged", () => {
  const dates = periodDates({ runFrom: "2026-10-12", runTo: "2026-10-30", days: MONFRI }, genDates);
  assert.equal(dates.length, 15);
  assert.equal(groupWeeks(dates).length, 3);
});

test("weekend custom days work inside each period", () => {
  const dates = periodDates({ runFrom: "2026-10-10", runTo: "2027-04-18", days: [0, 6], runPeriods: [{ from: "2026-10-10", to: "2026-10-11" }, { from: "2027-04-17", to: "2027-04-18" }] }, genDates);
  assert.deepEqual(dates, ["2026-10-10", "2026-10-11", "2027-04-17", "2027-04-18"]);
});

test("a period over a year long is not cut off at 400 days (each period generates on its own)", () => {
  const dates = periodDates({ runFrom: "2026-10-12", runTo: "2029-10-01", days: [1], runPeriods: [{ from: "2026-10-12", to: "2026-10-12" }, { from: "2029-10-01", to: "2029-10-01" }] }, genDates);
  assert.deepEqual(dates, ["2026-10-12", "2029-10-01"]);
});

test("periodSpan holds the outer range; periodsProblem flags an incomplete, backwards or overlapping period", () => {
  assert.deepEqual(periodSpan(two), { from: "2026-10-12", to: "2027-04-16" });
  assert.equal(periodsProblem(two), null);
  assert.equal(periodsProblem([{ from: "2026-10-12", to: "" }]), "incomplete");
  assert.equal(periodsProblem([{ from: "2026-10-16", to: "2026-10-12" }]), "endBefore");
  assert.equal(periodsProblem([{ from: "2026-10-12", to: "2026-10-20" }, { from: "2026-10-19", to: "2026-10-30" }]), "overlap");
});

test("ticking weeks off and on: only the unticked week's days are switched off", () => {
  const weeks = groupWeeks(periodDates({ runFrom: "2026-10-12", runTo: "2026-10-23", days: MONFRI }, genDates));
  let off: string[] = [];
  off = setWeekOff(off, weeks[0].days, true);
  assert.equal(off.length, 5);
  off = setWeekOff(off, weeks[0].days, false);
  assert.equal(off.length, 0);
});

test("server: the recipe makes blocks ONLY for the periods (two weekly blocks, none in the gap)", () => {
  const recipe = { runFrom: "2026-10-12", runTo: "2027-04-16", blockMode: "weekly" as const, days: MONFRI, runPeriods: two };
  assert.equal(recipeDates(recipe, MONFRI).length, 10);
  const runs = desiredRuns(recipe, { start: "09:00", end: "15:30" });
  assert.equal(runs.length, 2);
  assert.equal(runs[0].startDate, "2026-10-12");
  assert.equal(runs[1].endDate, "2027-04-16");
});

test("server: a switched-off day inside a period is skipped, and a recipe with no periods is as before", () => {
  const recipe = { runFrom: "2026-10-12", runTo: "2026-10-16", blockMode: "weekly" as const, days: MONFRI, datesOff: ["2026-10-14"] };
  assert.equal(recipeDates(recipe, MONFRI).length, 4);
  assert.equal(desiredRuns({ ...recipe, datesOff: [] }, { start: "09:00", end: "10:00" }).length, 1);
});
