/** Pass rules enforced by POST /api/my/bookings (LT-008, LT-013, LT-014, LT-016). Pure. */
import test from "node:test";
import assert from "node:assert/strict";
import { bookingHasPass, passCap, passClosedBy, passDaysProblem, passFullDay } from "../server/src/lib/passBooking";

// Two Mon-Fri weeks: 10 run days.
const wk = (mon: number) => [0, 1, 2, 3, 4].map((i) => `2027-07-${String(mon + i).padStart(2, "0")}`);
const run = [...wk(5), ...wk(12)];

test("LT-014: capacity '0' closes a pass; blank/other caps do not", () => {
  assert.equal(passClosedBy("0"), true);
  assert.equal(passClosedBy(""), false);
  assert.equal(passClosedBy(undefined), false);
  assert.equal(passClosedBy("1"), false);
  assert.equal(passCap(" 3 "), 3);
  assert.equal(passCap("abc"), null);
});

test("LT-013: pass cap of 1 is full once one seat is held that day", () => {
  assert.equal(passFullDay(1, {}, { "2027-07-05": 1 }), null);
  assert.equal(passFullDay(1, { "2027-07-05": 1 }, { "2027-07-05": 1 }), "2027-07-05");
  assert.equal(passFullDay(1, { "2027-07-05": 1 }, { "2027-07-06": 1 }), null);
  assert.equal(passFullDay(null, { "2027-07-05": 99 }, { "2027-07-05": 1 }), null);
  assert.equal(passFullDay(2, {}, { "2027-07-05": 3 }), "2027-07-05"); // a basket bigger than the cap
});

test("LT-016: a 5-day pass needs exactly 5 days", () => {
  assert.equal(passDaysProblem({ need: 5, picked: wk(5).slice(0, 2), runDates: run }), "This pass needs exactly 5 days");
  assert.equal(passDaysProblem({ need: 5, picked: wk(5), runDates: run }), null);
  assert.equal(passDaysProblem({ need: 1, picked: wk(5), runDates: run }), null); // single-day lines
});

test("LT-008: whole-block pass (Term, 10 days) takes all dates of the block", () => {
  assert.match(passDaysProblem({ need: 10, picked: run.slice(0, 5), runDates: run, rule: "blocks" })!, /exactly 10/);
  const nine = [...run.slice(0, 4), ...run.slice(5)];
  assert.match(passDaysProblem({ need: 10, picked: nine, runDates: run, rule: "blocks" })!, /exactly 10/);
  assert.match(passDaysProblem({ need: 10, picked: [...nine, "2027-07-24"], runDates: run, rule: "blocks" })!, /every date/); // 10 days but not the block's
  assert.equal(passDaysProblem({ need: 10, picked: run, runDates: run, rule: "blocks" }), null);
  // weekly 'any N' rule is not forced to the whole run
  assert.equal(passDaysProblem({ need: 5, picked: [...run.slice(0, 3), ...run.slice(7, 9)], runDates: run, rule: "week" }), null);
});

test("week-block pass must sit in a single week", () => {
  assert.equal(passDaysProblem({ need: 5, picked: wk(12), runDates: run, rule: "blocks" }), null);
  assert.match(passDaysProblem({ need: 5, picked: [...run.slice(0, 3), ...run.slice(7, 9)], runDates: run, rule: "blocks" })!, /single week/);
});

test("whole-run block ignores days already gone", () => {
  assert.equal(passDaysProblem({ need: 10, picked: run.slice(2), runDates: run, rule: "blocks", today: run[2] }), "This pass needs exactly 10 days");
});

test("bookingHasPass matches the pass in 'Pass · Timing' labels", () => {
  assert.equal(bookingHasPass("Term · Full Day", "Term"), true);
  assert.equal(bookingHasPass("Day · Term", "Term"), true);
  assert.equal(bookingHasPass("Terminal", "Term"), false);
  assert.equal(bookingHasPass(undefined, "Term"), false);
});
