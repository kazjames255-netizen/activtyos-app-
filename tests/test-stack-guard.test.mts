/** Pure tests for the test-stack guard (server and web). Run: npm run test:testStackGuard */
import test from "node:test";
import assert from "node:assert/strict";
import { testStackProblems } from "../server/src/lib/testStackGuard.ts";
import { webTestStackProblems } from "../lib/firebase/testStackWebGuard.ts";

const good = { TEST_STACK: "1", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099" };

test("off by default: no TEST_STACK means no checks", () => {
  assert.deepEqual(testStackProblems({}), []);
  assert.deepEqual(testStackProblems({ FIREBASE_PROJECT_ID: "activityos-bef89" }), []);
});
test("good emulator env passes (project defaults to demo-activityos)", () => {
  assert.deepEqual(testStackProblems(good), []);
  assert.deepEqual(testStackProblems({ ...good, FIRESTORE_EMULATOR_HOST: "[::1]:8180", FIREBASE_PROJECT_ID: "demo-x", STRIPE_SECRET_KEY: "sk_test_abc" }), []);
});
test("missing emulator hosts are refused", () => {
  assert.equal(testStackProblems({ TEST_STACK: "1" }).length, 2);
  assert.equal(testStackProblems({ ...good, FIREBASE_AUTH_EMULATOR_HOST: undefined }).length, 1);
});
test("non-local emulator hosts are refused", () => {
  assert.equal(testStackProblems({ ...good, FIRESTORE_EMULATOR_HOST: "firestore.googleapis.com:443" }).length, 1);
  assert.equal(testStackProblems({ ...good, FIREBASE_AUTH_EMULATOR_HOST: "10.0.0.5:9099" }).length, 1);
  assert.equal(testStackProblems({ ...good, FIREBASE_AUTH_EMULATOR_HOST: "localhost.evil.com:9099" }).length, 1);
});
test("live or non-demo project ids are refused", () => {
  assert.ok(testStackProblems({ ...good, FIREBASE_PROJECT_ID: "activityos-bef89" })[0].includes("LIVE"));
  assert.equal(testStackProblems({ ...good, FIREBASE_PROJECT_ID: "my-project" }).length, 1);
});
test("live credentials are refused", () => {
  assert.equal(testStackProblems({ ...good, FIREBASE_SERVICE_ACCOUNT: "{}" }).length, 1);
  assert.equal(testStackProblems({ ...good, GOOGLE_APPLICATION_CREDENTIALS: "/x.json" }).length, 1);
});
test("only Stripe test keys are allowed", () => {
  assert.equal(testStackProblems({ ...good, STRIPE_SECRET_KEY: "sk_live_x" }).length, 1);
  assert.equal(testStackProblems({ ...good, STRIPE_SECRET_KEY: "rk_live_x" }).length, 1);
  assert.deepEqual(testStackProblems({ ...good, STRIPE_SECRET_KEY: "" }), []);
});
test("web guard", () => {
  assert.deepEqual(webTestStackProblems({}), []);
  const w = { NEXT_PUBLIC_TEST_STACK: "1", NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-activityos" };
  assert.deepEqual(webTestStackProblems(w), []);
  assert.equal(webTestStackProblems({ NEXT_PUBLIC_TEST_STACK: "1" }).length, 2);
  assert.equal(webTestStackProblems({ ...w, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "activityos-bef89" }).length, 1);
  assert.equal(webTestStackProblems({ ...w, NEXT_PUBLIC_API_URL: "https://api.example.com" }).length, 1);
});
