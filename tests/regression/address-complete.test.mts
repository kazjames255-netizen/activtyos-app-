import test from "node:test";
import assert from "node:assert/strict";
import { addressMissing, composeAddress, isFullAddress, splitAddress, visitLineHasHouse, isUkPostcodeShape } from "../../lib/addressComplete";

test("the real incomplete address (no door number) is rejected", () => {
  assert.deepEqual(addressMissing("Corris Court, Milton Keynes", "MK10 9NR"), ["house"]);
  assert.equal(isFullAddress("Corris Court, Milton Keynes", "MK10 9NR"), false);
});
test("a numbered address and a house-name address are complete", () => {
  assert.equal(isFullAddress("12 Corris Court, Milton Keynes", "MK10 9NR"), true);
  assert.equal(isFullAddress("Rose Cottage, High Street, Milton Keynes", "mk10 9nr"), true);
  assert.equal(isFullAddress("12A Corris Court, Milton Keynes", "MK109NR"), true);
});
test("missing town, street and bad postcode are each reported", () => {
  assert.deepEqual(addressMissing("12 Corris Court", "MK10 9NR"), ["town"]);
  assert.deepEqual(addressMissing("", ""), ["house", "street", "town", "postcode"]);
  assert.deepEqual(addressMissing("12 Corris Court, Milton Keynes", "hello"), ["postcode"]);
  assert.equal(isUkPostcodeShape("NW1"), false); // a district alone is not a home postcode
});
test("compose and split round-trip", () => {
  const a = composeAddress({ house: "12", street: "Corris Court", town: "Milton Keynes" });
  assert.equal(a, "12 Corris Court, Milton Keynes");
  assert.deepEqual(splitAddress(a, "mk10 9nr"), { house: "12", street: "Corris Court", town: "Milton Keynes", postcode: "MK10 9NR" });
  const b = composeAddress({ house: "Rose Cottage", street: "High Street", town: "Milton Keynes" });
  assert.equal(b, "Rose Cottage, High Street, Milton Keynes");
  assert.deepEqual(splitAddress(b), { house: "Rose Cottage", street: "High Street", town: "Milton Keynes", postcode: "" });
  assert.equal(isFullAddress(composeAddress({ house: "7", street: "High St", town: "Bedford" }), "MK40 1AA"), true);
});
test("a visit line must say which house", () => {
  assert.equal(visitLineHasHouse("12 High Street"), true);
  assert.equal(visitLineHasHouse("Rose Cottage High Street"), true);
  assert.equal(visitLineHasHouse("Corris Court"), false);
  assert.equal(visitLineHasHouse(""), false);
});
