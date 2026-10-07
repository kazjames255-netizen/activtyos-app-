import test from "node:test";
import assert from "node:assert/strict";
import { homeVisitVisibility } from "../../server/src/lib/publicListing";

// Kaz: a home-visit listing whose area does not cover the family's postcode must not be visible to them at all.
test("home-visit listing outside the family's area is hidden", () => {
  assert.equal(homeVisitVisibility("home-visit", false), "hide");
});
test("a covered family sees it", () => {
  assert.equal(homeVisitVisibility("home-visit", true), "show");
  assert.equal(homeVisitVisibility("both", true), "show");
});
test("unknown postcode never hides (checkout asks for it and refuses an uncovered one)", () => {
  assert.equal(homeVisitVisibility("home-visit", null), "show");
  assert.equal(homeVisitVisibility("both", null), "show");
});
test("'both' outside the area stays visible, venue only", () => {
  assert.equal(homeVisitVisibility("both", false), "venue-only");
});
test("venue listings are never affected", () => {
  assert.equal(homeVisitVisibility("venue", false), "show");
  assert.equal(homeVisitVisibility(undefined, false), "show");
  assert.equal(homeVisitVisibility(null, false), "show");
});
