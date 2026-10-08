// The parent-facing policy sentence: capital first letter, and 24/48 hours read as hours (the Setup editor shows "48 hours", not "2 days").
import test from "node:test";
import assert from "node:assert/strict";
import { policyWording, DEFAULT_POLICY } from "../../lib/cancellation";

test("starts with a capital", () => {
  assert.match(policyWording(DEFAULT_POLICY), /^C/);
});

test("48 hours stays 48 hours, 1 week stays 1 week", () => {
  const w = policyWording(DEFAULT_POLICY);
  assert.match(w, /at least 1 week before it starts for a full refund/);
  assert.match(w, /at least 48 hours before it starts for a 50% refund/);
  assert.doesNotMatch(w, /2 days/);
});
