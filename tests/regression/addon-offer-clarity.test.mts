/** Regression (9 Oct): the add-on switch in the listing editor must be unmistakable, and parents see the extras line. Pure. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { offeredCount, showNoneOnHint, extrasList } from "../../features/listings/addonOffer";
import { contrast } from "../../features/listings/pageThemes";
import wiz2 from "../../lib/i18n/messages/areas/p8lst-parts/wiz2";

const LOCS = ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"] as const;
const KEYS = ["wbOfferedOn", "wbOfferedOff", "wbOfferedSummary", "wbOfferedHint", "wbExtrasLine"];
const src = readFileSync(new URL("../../features/listings/ListingWizard.tsx", import.meta.url), "utf8");

test("offered count ignores stale ids and counts each add-on once", () => {
  const all = [{ id: "a" }, { id: "b" }];
  assert.deepEqual(offeredCount(all, ["a"]), { on: 1, total: 2 });
  assert.deepEqual(offeredCount(all, ["a", "a", "gone"]), { on: 1, total: 2 });
  assert.deepEqual(offeredCount([], ["a"]), { on: 0, total: 0 });
});

test("the none-on hint shows only when add-ons exist and none is on", () => {
  assert.equal(showNoneOnHint({ on: 0, total: 2 }), true);
  assert.equal(showNoneOnHint({ on: 1, total: 2 }), false);
  assert.equal(showNoneOnHint({ on: 0, total: 0 }), false);
});

test("extras line: names with price, per-day marked, list order kept, empty when nothing", () => {
  const fmt = { money: (n: number) => `£${n.toFixed(2)}`, perDay: (p: string) => `${p}/day` };
  assert.equal(extrasList([{ id: "1", name: "tshirty", price: 10, type: "perday" }, { id: "2", name: "water bottle", price: 5, type: "once" }], fmt), "tshirty (£10.00/day), water bottle (£5.00)");
  assert.equal(extrasList([], fmt), "");
});

test("new strings exist in all 11 languages, keep their placeholders, and are translated", () => {
  const m = ((wiz2 as any).default ?? wiz2) as Record<string, Record<string, string>>;
  for (const k of KEYS) {
    for (const l of LOCS) {
      const v = m[l]?.[k];
      assert.ok(v && v.length > 0, `${l}.${k} missing`);
      if (l !== "en") assert.notEqual(v, m.en[k], `${l}.${k} is still English`);
      for (const ph of m.en[k].match(/\{\w+\}/g) ?? []) assert.ok(v.includes(ph), `${l}.${k} lost ${ph}`);
    }
  }
});

test("the editor row is a real switch with a 44px target, labelled; the parent page shows the extras line", () => {
  assert.ok(src.includes('role="switch"') && src.includes("aria-checked={on}"));
  assert.ok(src.includes("min-h-[44px]"));
  assert.ok(src.includes('tr("p8lst.wbOfferedOn")') && src.includes('tr("p8lst.wbOfferedOff")'));
  assert.ok(src.includes('tr("p8lst.wbOfferedSummary"') && src.includes('tr("p8lst.wbOfferedHint")'));
  assert.ok(src.includes('tr("p8lst.wbExtrasLine"'));
});

test("selected row text (brand-ink on brand-soft) and the off-state text stay readable (AA 4.5:1)", () => {
  assert.ok(contrast("#102356", "#eaf0fc") >= 4.5, "selected row");
  assert.ok(contrast("#4a4763", "#ffffff") >= 4.5, "off row, light surface (ink-2)");
  assert.ok(contrast("#aeb3c2", "#181a21") >= 4.5, "off row, dark surface (ink-2)");
});
