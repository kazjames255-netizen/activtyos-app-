import test from "node:test";
import assert from "node:assert/strict";
import { formatDay, relativeFrom } from "../../lib/i18n/format";

// FAIL 1 (verify-integration-screens): the extras table and Add-on orders printed English dates ('Oct 10', 'Sun, Oct 18', 'in 2 days')
// in Welsh and Polish. Chrome has no Welsh date data, so Welsh uses our own names; every other language follows its locale.
const SUN = "2026-10-18";
const short = { weekday: "short", day: "numeric", month: "short" } as const;

test("formatDay: English stays UK style", () => {
  assert.equal(formatDay(SUN, short, "en"), "Sun 18 Oct");
  assert.equal(formatDay(SUN, { day: "numeric", month: "short" }, "en"), "18 Oct");
});
test("formatDay: Welsh uses Welsh weekday and month names (no browser data needed)", () => {
  assert.equal(formatDay(SUN, short, "cy"), "Sul 18 Hyd");
  assert.equal(formatDay(SUN, { day: "numeric", month: "short" }, "cy"), "18 Hyd");
  assert.equal(formatDay(SUN, { weekday: "long", day: "numeric", month: "long", year: "numeric" }, "cy"), "Dydd Sul 18 Hydref 2026");
  assert.equal(formatDay("2026-03-02", { month: "long", year: "numeric" }, "cy"), "Mawrth 2026");
});
test("formatDay: Polish and Arabic are localised, never the English month", () => {
  const pl = formatDay(SUN, short, "pl");
  assert.match(pl, /paź/); assert.doesNotMatch(pl, /Oct/);
  const ar = formatDay(SUN, short, "ar");
  assert.match(ar, /[؀-ۿ]/); assert.match(ar, /18/); assert.doesNotMatch(ar, /Oct/);
});
test("relativeFrom: 'in N days' / 'tomorrow' per language", () => {
  assert.equal(relativeFrom(2, "day", "en"), "in 2 days");
  assert.equal(relativeFrom(1, "day", "en"), "tomorrow");
  assert.equal(relativeFrom(2, "day", "cy"), "ymhen 2 ddiwrnod");
  assert.equal(relativeFrom(1, "day", "cy"), "yfory");
  assert.equal(relativeFrom(0, "day", "cy"), "heddiw");
  assert.equal(relativeFrom(3, "week", "cy"), "ymhen 3 wythnos");
  assert.equal(relativeFrom(3, "month", "cy"), "ymhen 3 mis");
  assert.match(relativeFrom(2, "day", "pl"), /^za 2 dni$/);
  assert.equal(relativeFrom(1, "day", "pl"), "jutro");
  assert.match(relativeFrom(2, "day", "ar"), /[؀-ۿ]/);
});
