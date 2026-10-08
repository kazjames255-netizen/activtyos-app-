// The staff home page (features/dashboard/StaffDashApp.tsx) must only call APIs the role may use: a Bookings-none / Registers-none role is
// refused the day boards (/api/ratios, /api/incidents) by the family-read rule, so the home must not ask for them (the red "Your role doesn't
// have access" line). The decision is one pure function over the caps the server returns in /api/me - no business rule lives in the page.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mayReadFamilyData, staffHomeCalls } from "../lib/accessMap";

type Caps = Record<string, "none" | "view" | "edit">;
const ALL = { ratios: true, registers: true, tasks: true, incidents: true, timetable: true };

describe("staffHomeCalls", () => {
  it("no matrix in force (caps null/undefined): every card loads, as before", () => {
    assert.deepEqual(staffHomeCalls(null), ALL);
    assert.deepEqual(staffHomeCalls(undefined), ALL);
  });
  it("Bookings none + Registers none: no ratios, registers or incidents call; tasks and timetable still load", () => {
    const caps: Caps = { bookings: "none", registers: "none" };
    assert.deepEqual(staffHomeCalls(caps), { ratios: false, registers: false, tasks: true, incidents: false, timetable: true });
  });
  it("none/none but the role names ratios / incidents itself: those calls are made", () => {
    const c = staffHomeCalls({ bookings: "none", registers: "none", ratios: "view", incidents: "edit" });
    assert.equal(c.ratios, true); assert.equal(c.incidents, true); assert.equal(c.registers, false);
  });
  it("Registers view: everything the page needs", () => {
    const c = staffHomeCalls({ bookings: "none", registers: "view" });
    assert.deepEqual(c, ALL);
  });
  it("Bookings view, Registers none: day boards yes, registers call no", () => {
    const c = staffHomeCalls({ bookings: "view", registers: "none" });
    assert.equal(c.ratios, true); assert.equal(c.incidents, true); assert.equal(c.registers, false);
  });
  it("an area set to None is never called, whatever else is granted", () => {
    const c = staffHomeCalls({ bookings: "edit", registers: "edit", tasks: "none", timetable: "none", ratios: "none", incidents: "none" });
    assert.deepEqual(c, { ratios: false, registers: true, tasks: false, incidents: false, timetable: false });
  });
  it("mayReadFamilyData is the same rule the API enforces", () => {
    assert.equal(mayReadFamilyData(null, "ratios"), true);
    assert.equal(mayReadFamilyData({ bookings: "none", registers: "none" }, "ratios"), false);
    assert.equal(mayReadFamilyData({ bookings: "none", registers: "none", ratios: "view" }, "ratios"), true);
    assert.equal(mayReadFamilyData({ bookings: "none", registers: "none", ratios: "none" }, "ratios"), false);
  });
});
