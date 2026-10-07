import test from "node:test";
import assert from "node:assert/strict";
import { homeVisitVisibility, directLinkHiddenByArea } from "../../server/src/lib/publicListing";

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
test("'both' outside the area is hidden too (booking one always needs a covered postcode)", () => {
  assert.equal(homeVisitVisibility("both", false), "hide");
});
test("direct link: a hidden listing 404s for a family outside the area, unless they already booked it", () => {
  assert.equal(directLinkHiddenByArea("home-visit", false, false), true);
  assert.equal(directLinkHiddenByArea("both", false, false), true);
  assert.equal(directLinkHiddenByArea("home-visit", false, true), false);
  assert.equal(directLinkHiddenByArea("home-visit", true, false), false);
  assert.equal(directLinkHiddenByArea("home-visit", null, false), false);
  assert.equal(directLinkHiddenByArea("venue", false, false), false);
});
test("venue listings are never affected", () => {
  assert.equal(homeVisitVisibility("venue", false), "show");
  assert.equal(homeVisitVisibility(undefined, false), "show");
  assert.equal(homeVisitVisibility(null, false), "show");
});
