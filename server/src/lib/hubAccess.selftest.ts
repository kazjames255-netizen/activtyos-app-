// Run: server/node_modules/.bin/tsx server/src/lib/hubAccess.selftest.ts
import assert from "node:assert/strict";
import { mergeHub } from "../../../lib/hubConfig";
import { childMayOpen } from "./hubAccess";

// H2: a tenant that never set `lessonAccess` must land on "assigned" (only what the tutor set).
assert.equal(mergeHub(undefined).lessonAccess, "assigned");
assert.equal(mergeHub({} as never).lessonAccess, "assigned");
assert.equal(mergeHub({ lessonAccess: "bogus" } as never).lessonAccess, "assigned");
assert.equal(mergeHub({ lessonAccess: "all" } as never).lessonAccess, "all");
assert.equal(mergeHub({ lessonAccess: "year" } as never).lessonAccess, "year");
const mine = new Set(["a"]);
assert.equal(childMayOpen("assigned", { id: "a", lessonYear: 3 }, mine, 3), true);
assert.equal(childMayOpen("assigned", { id: "b", lessonYear: 3 }, mine, 3), false);
assert.equal(childMayOpen("year", { id: "b", lessonYear: 3 }, mine, 3), true);
assert.equal(childMayOpen("year", { id: "b", lessonYear: 4 }, mine, 3), false);
assert.equal(childMayOpen("year", { id: "b", lessonYear: null }, mine, 3), false);
assert.equal(childMayOpen("all", { id: "z", lessonYear: 9 }, new Set(), null), true);
console.log("hubAccess selftest: ok");
