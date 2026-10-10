/** Assistant knowledge lint (pure). Fails on duplicated paragraphs, the product name, dead /api paths and "not built" next to features that exist. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SETUP_KNOWLEDGE, SETUP_RULES } from "../server/src/lib/setupKnowledge";
import { lintKnowledge } from "../server/src/lib/knowledgeLint";

const indexSrc = readFileSync(new URL("../server/src/index.ts", import.meta.url), "utf8");
const mounted = [...indexSrc.matchAll(/app\.use\(\s*"(\/api\/[a-z0-9/_-]+)"/gi)].map((m) => m[1]);

test("knowledge: no duplicate paragraphs", () => {
  assert.deepEqual(lintKnowledge(SETUP_KNOWLEDGE, mounted).duplicates, []);
});
test("knowledge: never writes the product name", () => {
  assert.deepEqual(lintKnowledge(SETUP_KNOWLEDGE + "\n" + SETUP_RULES, mounted).productNames, []);
});
test("knowledge: every /api path it mentions is mounted", () => {
  assert.ok(mounted.length > 20, "found the mounted routes");
  assert.deepEqual(lintKnowledge(SETUP_KNOWLEDGE, mounted).badApiPaths, []);
});
test("knowledge: no stale 'not built' claims", () => {
  assert.deepEqual(lintKnowledge(SETUP_KNOWLEDGE, mounted).notBuilt, []);
});
test("knowledge: the unsourced Stripe fee figure is gone (never-quote rule)", () => {
  assert.doesNotMatch(SETUP_KNOWLEDGE, /1\.4\s*%/);
});
test("knowledge: no flat claim that other payment methods are 'not offered' (Stripe decides)", () => {
  assert.doesNotMatch(SETUP_RULES, /NEVER mention Klarna/);
});
test("knowledge: the home-visit address rule is stated once", () => {
  const n = SETUP_KNOWLEDGE.split("\n").filter((l) => l.startsWith("HOME-VISIT CHECKOUT")).length;
  assert.equal(n, 1);
});

test("lint helper catches what it should (self-check)", () => {
  const r = lintKnowledge("Same paragraph about holds and deadlines goes here twice.\n\nOther.\n\nSame paragraph about holds and deadlines goes here twice.\n\nActivityOS rooms. See /api/nope/x and /api/bookings. Cancel is not built yet.", ["/api/bookings"]);
  assert.equal(r.duplicates.length, 1);
  assert.equal(r.productNames.length, 1);
  assert.deepEqual(r.badApiPaths, ["/api/nope/x"]);
  assert.equal(r.notBuilt.length, 1);
});
