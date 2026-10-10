// Checkout asks before spending wallet credit (9 Oct 2026): pure choice/amount helpers, the 11-language strings, and the wiring.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { walletAppliedFor, walletCapToSend, walletRemaining, walletChoiceMissing, walletChoiceRequired, walletCoversWhole, walletLeftAfter, defaultPart, clampPart } from "../../features/listings/walletChoice";
import ckMod from "../../lib/i18n/messages/areas/p8lst-parts/ck";

test("no choice yet applies nothing and blocks paying while there is credit to spend", () => {
  assert.equal(walletAppliedFor(null, 0, 30), 0);
  assert.equal(walletChoiceRequired(true, 30), true);
  assert.equal(walletChoiceMissing(true, 30, null), true);
  for (const c of ["use", "part", "keep"] as const) assert.equal(walletChoiceMissing(true, 30, c), false);
});
test("no credit, or not a parent checkout: nothing to ask", () => {
  assert.equal(walletChoiceRequired(true, 0), false);
  assert.equal(walletChoiceMissing(true, 0, null), false);
  assert.equal(walletChoiceRequired(false, 30), false);
  assert.equal(walletChoiceMissing(false, 30, null), false);
});
test("use = all that can come off; keep = none; part = clamped to [0, avail]", () => {
  assert.equal(walletAppliedFor("use", 5, 30), 30);
  assert.equal(walletAppliedFor("keep", 5, 30), 0);
  assert.equal(walletAppliedFor("part", 12.34, 30), 12.34);
  assert.equal(walletAppliedFor("part", 99, 30), 30);
  assert.equal(walletAppliedFor("part", -4, 30), 0);
  assert.equal(walletAppliedFor("part", NaN, 30), 0);
});
test("the cap sent is always a number: explicit 0 for keep/none/operator, never undefined", () => {
  assert.equal(walletCapToSend(true, "keep", 0, 30), 0);
  assert.equal(walletCapToSend(true, null, 0, 30), 0);
  assert.equal(walletCapToSend(true, "use", 0, 30), 30);
  assert.equal(walletCapToSend(true, "part", 10, 30), 10);
  assert.equal(walletCapToSend(false, "use", 10, 30), 0);
  assert.equal(typeof walletCapToSend(true, "keep", 0, 0), "number");
});
test("credit larger than the total: whole booking covered, applied never exceeds the total", () => {
  const balance = 100, afterCode = 40, avail = Math.min(balance, afterCode);
  assert.equal(walletCoversWhole(avail, afterCode), true);
  assert.equal(walletAppliedFor("use", 0, avail), 40);
  assert.equal(walletLeftAfter(balance, 40), 60);
  assert.equal(walletCoversWhole(25, 40), false);
});
test("part helpers follow the available amount down", () => {
  assert.equal(defaultPart(25), 12.5);
  assert.equal(clampPart(20, 8), 8);
  assert.equal(clampPart(3, 8), 3);
  assert.equal(walletLeftAfter(30, 12.5), 17.5);
});

const LOCALES = ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"] as const;
const ck: any = (ckMod as any).default ?? ckMod;
const KEYS: [string, string[]][] = [
  ["ck8WalletAskHead", ["{amt}", "{provider}"]], ["ck8WalletAskUse", ["{amt}"]], ["ck8WalletAskKeep", []], ["ck8WalletAskPart", []],
  ["ck8WalletCoversWhole", []], ["ck8WalletChoose", ["{amt}"]], ["ck8WalletPartAmt", ["{amt}"]],
];
test("every new checkout wallet string is in all 11 languages, translated, with its placeholders", () => {
  const bad: string[] = [];
  for (const [key, vars] of KEYS) {
    for (const loc of LOCALES) {
      const v = ck[loc]?.[key];
      if (!v) { bad.push(`${loc}.${key} missing`); continue; }
      for (const p of vars) if (!v.includes(p)) bad.push(`${loc}.${key} lost ${p}`);
      if (loc !== "en" && v === ck.en[key] && ck.en[key].length > 14) bad.push(`${loc}.${key} is still English`);
    }
  }
  assert.deepEqual(bad, []);
});
test("checkout wires the choice: required, explicit cap, no silent default", () => {
  const src = readFileSync("features/listings/checkout.tsx", "utf8");
  assert.match(src, /walletCapToSend\(/);
  assert.match(src, /walletChoiceMissing\(/);
  assert.doesNotMatch(src, /walletUse === null \? walletAvail/);
  assert.doesNotMatch(src, /walletCap: walletUse === null \? undefined/);
});
test("server: omitted/null walletCap means do not use", () => {
  const src = readFileSync("server/src/routes/my.ts", "utf8");
  assert.match(src, /walletCap: z\.number\(\)\.nonnegative\(\)\.nullish\(\)/);
  assert.doesNotMatch(src, /: walletHeld;\s*\n\s*let walletLeft/);
});

test("multi-block basket: each POST offers the unspent part of the chosen total, so shown = charged", () => {
  // block 1 = day pass 20, block 2 = 3-day 60, credit 50, 'Use' chosen
  assert.equal(walletRemaining(50, 0), 50);
  assert.equal(walletRemaining(50, 20), 30);
  assert.equal(walletRemaining(50, 50), 0);
  assert.equal(walletRemaining(50, 70), 0);
  assert.equal(walletRemaining(12.34, 0.1), 12.24);
});
test("wizard sends the remainder on every block POST (not cap-then-0)", () => {
  const src = readFileSync("features/listings/ListingWizard.tsx", "utf8");
  assert.match(src, /walletRemaining\(walletCap, walletSpent\)/);
  assert.doesNotMatch(src, /walletSent \? 0 : walletCap/);
  assert.match(src, /walletSpent \+= /);
});
