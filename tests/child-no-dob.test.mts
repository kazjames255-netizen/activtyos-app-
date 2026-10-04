/** A child without a date of birth (DOB optional): allowed, but age rules skip them. */
import test from "node:test";
import assert from "node:assert/strict";
import { judgedAge, ageCapGroup, outsideAgeRange } from "../server/src/lib/childAge";
import { childSchema } from "../server/src/lib/childSchema";

process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??= "test-dummy-key";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??= "test-dummy";
process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??= "1:1:web:1";
const { dobRequired: childDobRequired } = await import("../lib/childDob");
const { withDefaults } = await import("../lib/settings");

const groups = [{ id: "u5", ageFrom: 0, ageTo: 4 }, { id: "o5", ageFrom: 5, ageTo: 11 }];

test("unknown age is never judged", () => {
  assert.equal(judgedAge({ age: 0, ageKnown: false }), undefined);
  assert.equal(judgedAge({}), undefined);
  assert.equal(judgedAge({ age: 0, ageKnown: true }), 0); // a real infant
});
test("unknown age skips the age-range check; known ages still enforced", () => {
  assert.equal(outsideAgeRange({ age: 0, ageKnown: false }, 5, 11), false);
  assert.equal(outsideAgeRange({ age: 3, ageKnown: true }, 5, 11), true);
  assert.equal(outsideAgeRange({ age: 12, ageKnown: true }, 5, 11), true);
  assert.equal(outsideAgeRange({ age: 7, ageKnown: true }, 5, 11), false);
});
test("unknown age is not counted in the 0-4 cap group; known ages are", () => {
  assert.equal(ageCapGroup({ age: 0, ageKnown: false }, groups), undefined);
  assert.equal(ageCapGroup({ age: 0, ageKnown: true }, groups), "u5");
  assert.equal(ageCapGroup({ age: 8, ageKnown: true }, groups), "o5");
});
test("childDob helper: optional only when the provider says so and no age-gated question", () => {
  assert.equal(childDobRequired(withDefaults({ requireDob: false }), []), false);
  assert.equal(childDobRequired(withDefaults({ requireDob: true }), []), true);
  assert.equal(childDobRequired(null, []), true);
});
test("server child schema accepts a child with no dob (optional), rejects a future one", () => {
  assert.equal(childSchema.safeParse({ name: "Sam" }).success, true);
  assert.equal(childSchema.safeParse({ name: "Sam", dob: "" }).success, true);
  assert.equal(childSchema.safeParse({ name: "Sam", dob: "2999-01-01" }).success, false);
});
