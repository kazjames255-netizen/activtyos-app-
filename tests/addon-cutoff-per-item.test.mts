// Per-add-on request cut-off: the rule is snapshotted on the booking's add-on line; no snapshot = the provider-wide Setup default.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addonRequestBlock, cutoffValue, dayBlock, lineCutoffDays, lineRequestBlock, requestDeadline } from "../features/bookings/addonRequests";
import { priceAddon } from "../server/src/lib/addonPricing";

const fail = (m: string): never => { throw new Error(m); };
const b = { status: "Confirmed", days: ["2026-10-20"], addonRequests: [] } as never;
const today = "2026-10-15"; // 5 days before

describe("cutoffValue: only an integer 0..60 counts", () => {
  it("accepts", () => { assert.equal(cutoffValue(0), 0); assert.equal(cutoffValue(7), 7); assert.equal(cutoffValue(60), 60); });
  it("rejects everything else", () => { for (const v of [-1, 61, 1.5, "3", null, undefined, NaN, {}, true]) assert.equal(cutoffValue(v), null, String(v)); });
});

describe("lineCutoffDays: per-item overrides Setup, absent follows Setup", () => {
  it("override wins", () => assert.equal(lineCutoffDays({ requestCutoffDays: 7 }, 3), 7));
  it("off (absent / null / junk) follows Setup", () => { for (const l of [{}, { requestCutoffDays: null }, { requestCutoffDays: "9" }, { requestCutoffDays: 99 }]) assert.equal(lineCutoffDays(l as never, 3), 3); });
  it("0 is a real value: requests close at the session day", () => {
    assert.equal(lineCutoffDays({ requestCutoffDays: 0 }, 3), 0);
    assert.equal(dayBlock("2026-10-19", "2026-10-20", 0), "none");
    assert.equal(dayBlock("2026-10-20", "2026-10-20", 0), "none");
    assert.equal(dayBlock("2026-10-21", "2026-10-20", 0), "past");
  });
});

describe("blocks use the resolved per-line value", () => {
  const shirt = { key: "k", days: ["2026-10-20"], requestCutoffDays: 7 };
  const lunch = { key: "k2", days: ["2026-10-20"], requestCutoffDays: 1 };
  it("5 days before: T-shirt (7) closed, lunch (1) open, old line with Setup 3 open", () => {
    assert.equal(addonRequestBlock(b, shirt, today, lineCutoffDays(shirt, 3)), "cutoff");
    assert.equal(addonRequestBlock(b, lunch, today, lineCutoffDays(lunch, 3)), "none");
    assert.equal(addonRequestBlock(b, { key: "k3", days: ["2026-10-20"] }, today, lineCutoffDays({}, 3)), "none");
  });
  it("boundary: today = day - N is still open", () => {
    assert.equal(dayBlock("2026-10-13", "2026-10-20", 7), "none");
    assert.equal(dayBlock("2026-10-14", "2026-10-20", 7), "cutoff");
  });
  it("per day for a daily extra", () => {
    const daily = { key: "d", perDay: true, days: ["2026-10-17", "2026-10-25"], requestCutoffDays: 7 };
    assert.equal(lineRequestBlock(b, daily, today, lineCutoffDays(daily, 3)), "none"); // 25th still open
    assert.equal(lineRequestBlock(b, { ...daily, days: ["2026-10-17", "2026-10-20"] }, today, 7), "cutoff");
  });
  it("deadline date uses the per-item number", () => assert.equal(requestDeadline("2026-10-20", lineCutoffDays(shirt, 3)), "2026-10-13"));
});

describe("snapshot at booking time", () => {
  const def = { id: "a", name: "T-shirt", type: "once", price: 10, requestCutoffDays: 7 };
  it("priceAddon copies a valid rule onto the line", () => assert.equal(priceAddon(def, {}, ["2026-10-20"], "Kid", fail).requestCutoffDays, 7));
  it("no rule (or an invalid one) leaves no snapshot", () => {
    assert.ok(!("requestCutoffDays" in priceAddon({ ...def, requestCutoffDays: undefined }, {}, ["2026-10-20"], "Kid", fail)));
    assert.ok(!("requestCutoffDays" in priceAddon({ ...def, requestCutoffDays: 99 }, {}, ["2026-10-20"], "Kid", fail)));
  });
  it("later listing edits do not touch a line already snapshotted", () => {
    const line = { requestCutoffDays: priceAddon(def, {}, ["2026-10-20"], "Kid", fail).requestCutoffDays };
    const edited = { ...def, requestCutoffDays: 1 }; void edited;
    assert.equal(lineCutoffDays(line, 3), 7);
  });
});
