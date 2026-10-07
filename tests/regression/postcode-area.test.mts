import test from "node:test";
import assert from "node:assert/strict";
import { isUkPostcodeFormat, formatPostcode, labelMatchesPostcode, areaFromLabel, outwardOf } from "../../server/src/lib/postcodeArea";

test("postcode format", () => {
  for (const ok of ["MK10 9NR", "mk109nr", "NW1 6XE", "SW1A 1AA", "M1 1AE", "GIR 0AA", " nn5   7ea "]) assert.equal(isUkPostcodeFormat(ok), true, ok);
  for (const bad of ["", "hello", "12345", "MK10", "MK10 9N", "MK1099NR", "NW1 6XEE"]) assert.equal(isUkPostcodeFormat(bad), false, bad);
});
test("formatPostcode adds the space and upper-cases", () => {
  assert.equal(formatPostcode("mk109nr"), "MK10 9NR");
  assert.equal(formatPostcode("  sw1a1aa "), "SW1A 1AA");
  assert.equal(formatPostcode("nonsense"), "NONSENSE");
  assert.equal(outwardOf("MK10 9NR"), "MK10");
});
test("a label must belong to the postcode's district", () => {
  assert.equal(labelMatchesPostcode("MK10 9NR, Kents Hill, Milton Keynes, England", "MK10 9NR"), true);
  assert.equal(labelMatchesPostcode("Paris, France", "MK10 9NR"), false);
});
test("area is the first place name after the postcode, never the postcode or the country", () => {
  assert.equal(areaFromLabel("MK10 9NR, Kents Hill, Milton Keynes, Buckinghamshire, England, United Kingdom", "MK10 9NR"), "Kents Hill");
  assert.equal(areaFromLabel("NW1 6XE, Camden, London, England", "NW1 6XE"), "Camden");
  assert.equal(areaFromLabel("MK10 9NR, England, United Kingdom", "MK10 9NR"), undefined);
  assert.equal(areaFromLabel("MK10, Milton Keynes", "MK10 9NR"), "Milton Keynes");
});
