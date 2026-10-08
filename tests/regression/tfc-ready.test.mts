import test from "node:test";
import assert from "node:assert/strict";
import { tfcMissing, tfcReady, looksLikeUkPostcode, looksLikeRegistration, acceptsTfc } from "../../lib/tfcReady";

test("APF's saved details (name, registration number, MK45 4JZ) are ready: nobody who already set this up is broken", () => {
  assert.deepEqual(tfcReady({ settingName: "APF Activity Camps", registrationNumber: "EY123456", postcode: "MK45 4JZ" }), { ready: true, missing: [] });
  assert.equal(tfcReady({ registrationNumber: "1234567", postcode: "mk454jz" }, "APF Activity Camps").ready, true, "the display name stands in for the registered name; a lower-case postcode is fine");
});

test("what is missing is named, in the order the form asks for it", () => {
  assert.deepEqual(tfcMissing({}, ""), ["name", "registration", "postcode"]);
  assert.deepEqual(tfcMissing({ settingName: "X", postcode: "MK45 4JZ" }), ["registration"]);
  assert.deepEqual(tfcMissing({ settingName: "X", registrationNumber: "EY123456" }), ["postcode"]);
});

test("a malformed postcode or registration number is not ready", () => {
  assert.equal(looksLikeUkPostcode("SW1 1EF"), true);
  assert.equal(looksLikeUkPostcode("hello"), false);
  assert.equal(looksLikeUkPostcode("MK45"), false);
  assert.equal(looksLikeRegistration("EY123456"), true);
  assert.equal(looksLikeRegistration("EY 123 456"), true, "spaces are tidied away");
  assert.equal(looksLikeRegistration("12"), false);
  assert.equal(looksLikeRegistration("not a number!"), false);
  assert.deepEqual(tfcMissing({ settingName: "X", registrationNumber: "ab", postcode: "nope" }), ["registration", "postcode"]);
});

test("only a provider that lists Tax-Free Childcare as a way to pay needs the details", () => {
  assert.equal(acceptsTfc(["Card", "Bank transfer", "Tax-Free Childcare"]), true);
  assert.equal(acceptsTfc(["Card", "TFC"]), true);
  assert.equal(acceptsTfc(["Card", "Cash"]), false);
  assert.equal(acceptsTfc(undefined), false);
});
