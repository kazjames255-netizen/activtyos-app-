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

// Kaz: a family SENT the direct link and outside the area sees a friendly page, not "not found": the 404 carries a machine code.
import { outOfAreaBody } from "../../server/src/lib/publicListing";
test("direct-link 404 for an out-of-area family carries code out_of_area, the provider's name and the family's own district only", () => {
  const b = outOfAreaBody("APF Activity Camps", "t1", "MK10 9NR");
  assert.equal(b.error, "Listing not found");
  assert.equal(b.code, "out_of_area");
  assert.deepEqual(b.provider, { name: "APF Activity Camps", tenantId: "t1" });
  assert.equal(b.district, "MK10");
});
test("direct-link 404 body never contains a base postcode, radius or coverage fields", () => {
  const s = JSON.stringify(outOfAreaBody("P", "t", "nw1 6xe")).toLowerCase();
  assert.equal(JSON.parse(s).district, "nw1");
  for (const k of ["basepostcode", "radius", "coverage", "prefix"]) assert.ok(!s.includes(k), k);
});
test("a missing provider name still yields a usable body", () => {
  const b = outOfAreaBody(undefined, undefined, "SW1A1AA");
  assert.equal(b.provider.name, "");
  assert.equal(b.district, "SW1A");
});
