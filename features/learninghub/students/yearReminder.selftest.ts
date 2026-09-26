import assert from "node:assert/strict";
import { academicYearKey, inShowWindow, manualYearStudents, nextYearLabel, shouldShow } from "./yearReminder";
import type { Student } from "../types";

const yg = ["Reception", "Year 1", "Year 2", "Year 5", "Year 6", "Year 13"];
assert.equal(academicYearKey(new Date(2026, 8, 1)), "2026-27");
assert.equal(academicYearKey(new Date(2026, 7, 31)), "2025-26");
assert.equal(academicYearKey(new Date(2027, 0, 5)), "2026-27");
assert.equal(academicYearKey(new Date(2099, 9, 5)), "2099-00");
assert.equal(inShowWindow(new Date(2026, 6, 31)), false);
assert.equal(inShowWindow(new Date(2026, 7, 1)), true);
assert.equal(inShowWindow(new Date(2026, 9, 31)), true);
assert.equal(inShowWindow(new Date(2026, 10, 1)), false);
assert.equal(nextYearLabel("year 5", yg), "Year 6");
assert.equal(nextYearLabel("Year 13", yg), null);
assert.equal(nextYearLabel("Nursery", yg), null);
const st = (o: Partial<Student> & { childId: string }): Student => ({ childName: o.childId, subjects: [], ...o } as Student);
const rows = manualYearStudents([
  st({ childId: "b", yearGroup: "Year 5", yearGroupAuto: false, hasDob: true }),
  st({ childId: "a", yearGroup: "Year 13", yearGroupAuto: false }),
  st({ childId: "auto", yearGroup: "Year 2", yearGroupAuto: true, hasDob: true }),
  st({ childId: "off", yearGroup: "Year 1", yearGroupAuto: false, active: false }),
  st({ childId: "none", yearGroup: null, yearGroupAuto: false }),
], yg);
assert.deepEqual(rows.map((r) => r.childId), ["a", "b"]);
assert.equal(rows[0].next, null); assert.equal(rows[0].canAuto, false);
assert.equal(rows[1].next, "Year 6"); assert.equal(rows[1].canAuto, true);
const sep = new Date(2026, 8, 10);
assert.equal(shouldShow({ on: sep, canEdit: true, rows, dismissed: false }), true);
assert.equal(shouldShow({ on: sep, canEdit: false, rows, dismissed: false }), false);
assert.equal(shouldShow({ on: sep, canEdit: true, rows: [], dismissed: false }), false);
assert.equal(shouldShow({ on: sep, canEdit: true, rows, dismissed: true }), false);
assert.equal(shouldShow({ on: new Date(2026, 5, 1), canEdit: true, rows, dismissed: false }), false);
console.log("yearReminder selftest ok");
import { pendingRows } from "./yearReminder";
assert.deepEqual(pendingRows(rows, new Set(["a"])).map((r) => r.childId), ["b"]);
console.log("pending ok");
