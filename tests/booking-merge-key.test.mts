import test from "node:test";
import assert from "node:assert/strict";
import { mergeGroupKey } from "../server/src/lib/bookingMergeKey";

test("same block+status+timing merges", () => {
  assert.equal(mergeGroupKey({ blockId: "b1", status: "Confirmed", timing: "Morning" }), mergeGroupKey({ blockId: "b1", status: "Confirmed", timing: " morning " }));
});
test("BM-007: Morning and Afternoon stay separate bookings", () => {
  assert.notEqual(mergeGroupKey({ blockId: "b1", status: "Confirmed", timing: "Morning" }), mergeGroupKey({ blockId: "b1", status: "Confirmed", timing: "Afternoon" }));
});
test("different block or status never merge; missing timing is its own group", () => {
  assert.notEqual(mergeGroupKey({ blockId: "b1", status: "Confirmed" }), mergeGroupKey({ blockId: "b2", status: "Confirmed" }));
  assert.notEqual(mergeGroupKey({ blockId: "b1", status: "Confirmed" }), mergeGroupKey({ blockId: "b1", status: "Waitlisted" }));
  assert.equal(mergeGroupKey({ blockId: "b1", status: "Confirmed" }), mergeGroupKey({ blockId: "b1", status: "Confirmed", timing: "" }));
});
