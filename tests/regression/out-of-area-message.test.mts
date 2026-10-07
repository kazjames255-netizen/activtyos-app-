import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCoverage, OUT_OF_AREA_MESSAGE } from "../../server/src/lib/coverageArea";

// QA-B D2: the refusal for an address outside a provider's area must never carry a distance, a radius, a base postcode or the area list
// (a few refused quotes would let anyone triangulate the provider's home).
test("out-of-area message carries no digits, miles, radius or postcode", () => {
  assert.doesNotMatch(OUT_OF_AREA_MESSAGE, /\d/);
  assert.doesNotMatch(OUT_OF_AREA_MESSAGE, /mile|radius|base|km/i);
  assert.match(OUT_OF_AREA_MESSAGE, /doesn't travel to this address/);
});

test("postcode-list refusal is the same generic message (no postcode echoed back)", async () => {
  const r = await checkCoverage({ mode: "postcodePrefixes", postcodePrefixes: ["MK10"] }, "NW1 6XE");
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.reason, OUT_OF_AREA_MESSAGE);
    assert.doesNotMatch(r.reason, /NW1|MK10/);
  }
});

test("inside the postcode list passes", async () => {
  const r = await checkCoverage({ mode: "postcodePrefixes", postcodePrefixes: ["MK10"] }, "MK10 9NR");
  assert.equal(r.ok, true);
});
