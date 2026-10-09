/** Regression (9 Oct): the banner "Every day" ticks every day of every pass, plural wording, required size. Pure. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { slotsOf, selState, sweepTo, allDaysForm, missingAnswers, copyTargets, type Slot } from "../../features/listings/addonSelect";
import p7ckMod from "../../lib/i18n/messages/areas/p7ck";
import { pickPlural } from "../../lib/i18n/plural";
const p7ck: any = (p7ckMod as any).default ?? p7ckMod;

const items = [{ id: "a", dates: ["2026-09-01"] }, { id: "b", dates: ["2026-09-10"] }];
const slots = slotsOf(items, () => ["Child B"]);
const store: Record<string, string[]> = {};
const daysOf = (s: Slot) => store[`${s.itemId}|${s.child}`] ?? [];
const apply = (r: ReturnType<typeof sweepTo>) => r.forEach(({ slot, days }) => { store[`${slot.itemId}|${slot.child}`] = days; });

test("select-all ticks every day of every pass, pressing again clears all, partial state is reported", () => {
  assert.equal(selState(slots, daysOf, true), "none");
  apply(sweepTo(slots, daysOf, true));
  assert.deepEqual(store, { "a|Child B": ["2026-09-01"], "b|Child B": ["2026-09-10"] });
  assert.equal(selState(slots, daysOf, true), "all");
  apply(sweepTo(slots, daysOf, true));
  assert.equal(selState(slots, daysOf, true), "none");
  store["a|Child B"] = ["2026-09-01"];
  assert.equal(selState(slots, daysOf, true), "some");
  apply(sweepTo(slots, daysOf, true));
  assert.equal(selState(slots, daysOf, true), "all");
});

test("a day from another pass does not count as full; one-off extras use the * marker", () => {
  store["a|Child B"] = ["2026-09-10"]; store["b|Child B"] = ["2026-09-10"];
  assert.equal(selState(slots, daysOf, true), "some");
  assert.deepEqual(sweepTo(slots, () => [], false).map((x) => x.days), [["*"], ["*"]]);
});

test("several children across passes are all covered", () => {
  const s2 = slotsOf(items, (id) => (id === "a" ? ["X", "Y"] : ["X"]));
  assert.equal(sweepTo(s2, () => [], true).length, 3);
});

test("plural form: 1 day, both days, all N", () => {
  assert.equal(allDaysForm(1).key, "allNDays_one");
  assert.equal(allDaysForm(2).key, "allBothDays");
  assert.equal(allDaysForm(3).key, "allNDays_other");
  const t = (k: string, v?: Record<string, string | number>) => { const e = p7ck.en[k]; return e === undefined ? k : e.replace("{n}", String(v?.n)); };
  assert.equal(pickPlural(t, "en", "allNDays", 1), "✓ All 1 day");
  assert.equal(pickPlural(t, "en", "allNDays", 3), "✓ All 3 days");
});

test("a required size must be chosen for a ticked day; same-for-all targets the child's other passes", () => {
  store["a|Child B"] = ["2026-09-01"]; store["b|Child B"] = ["2026-09-10"];
  const q = [{ id: "sz", label: "size", required: true }];
  const ans: Record<string, string> = {};
  const ansOf = (s: Slot, id: string) => ans[`${s.itemId}|${s.child}|${id}`] ?? "";
  assert.equal(missingAnswers(slots, daysOf, q, ansOf).length, 2);
  ans["a|Child B|sz"] = "m";
  assert.deepEqual(missingAnswers(slots, daysOf, q, ansOf).map((m) => m.slot.itemId), ["b"]);
  assert.deepEqual(copyTargets(slots, slots[0], daysOf).map((s) => s.itemId), ["b"]);
  store["b|Child B"] = [];
  assert.equal(copyTargets(slots, slots[0], daysOf).length, 0);
  assert.equal(missingAnswers(slots, daysOf, q, ansOf).length, 0);
});

test("new strings in all 11 languages; checkout uses the helpers", () => {
  for (const k of ["allNDays_one", "allNDays_other", "allBothDays", "allDaysDone", "chooseFor", "sameForAll"]) for (const l of ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"]) assert.ok(p7ck[l]?.[k], `${l}.${k}`);
  const src = readFileSync(new URL("../../features/listings/checkout.tsx", import.meta.url), "utf8");
  for (const s of ["sweepTo(", "selState(", "missingAnswers(", "copyTargets(", 'pickPlural(tr, locale, "p7ck.allNDays"', "p7ck.chooseFor", "p7ck.sameForAll"]) assert.ok(src.includes(s), s);
});
