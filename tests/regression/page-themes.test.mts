/** Regression (7 Oct): the 15 round-three booking page themes + the original 10.
 *  Every key must be selectable in the wizard picker, accepted by the server, fully tokenised, translated (11 columns) and readable (WCAG AA 4.5:1). Pure. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LEGACY_THEME_KEYS, NEW_THEME_KEYS, THEME_TOKENS, FONT_STACK, themeFontHref, contrast, contrastPairs, ART_TEXT_PAIRS } from "../../features/listings/pageThemes";
import { PAGE_STYLES, baseListingSchema } from "../../server/src/lib/listingRules";

const wizard = readFileSync(new URL("../../features/listings/ListingWizard.tsx", import.meta.url), "utf8");
const hero = readFileSync(new URL("../../features/listings/ThemeHero.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const wiz2 = readFileSync(new URL("../../lib/i18n/messages/areas/p8lst-parts/wiz2.ts", import.meta.url), "utf8");

const REQUIRED = ["bg", "surf", "surf2", "ink", "mute", "line", "band", "bandInk", "eyebrow", "strip", "stripInk", "acc", "accInk", "price", "sec", "phStops", "ph", "phInk", "chip", "chipInk", "sel", "selInk", "selOn", "cta", "ctaInk", "r", "rs", "rb", "grain"] as const;

test("there are exactly 15 new themes alongside the original 10", () => {
  assert.equal(NEW_THEME_KEYS.length, 15);
  assert.equal(LEGACY_THEME_KEYS.length, 10);
  assert.equal(new Set([...LEGACY_THEME_KEYS, ...NEW_THEME_KEYS]).size, 25);
  assert.deepEqual(Object.keys(THEME_TOKENS).sort(), [...NEW_THEME_KEYS].sort());
});

test("every theme key is selectable in the wizard (type, registry and picker)", () => {
  for (const k of LEGACY_THEME_KEYS) assert.ok(wizard.includes(`"${k}"`), `legacy theme ${k} still in the wizard`);
  assert.ok(/export type PageTheme = [^;]*NewThemeKey;/.test(wizard), "PageTheme includes the new keys");
  assert.ok(/\.\.\.\(Object\.fromEntries\(NEW_THEME_KEYS\.map\(/.test(wizard), "THEMES registers every new key");
  assert.ok(/Object\.values\(THEMES\)\.map/.test(wizard), "the picker lists everything in THEMES");
  assert.ok(wizard.includes('tr("p8lst.wbTheme_" + t.key)'), "picker labels come from the catalogue");
});

test("the server accepts every theme key and still accepts the legacy 'navy'", () => {
  const expected = [...LEGACY_THEME_KEYS, ...NEW_THEME_KEYS, "navy"].sort();
  assert.deepEqual([...PAGE_STYLES].sort(), expected);
  for (const k of expected) {
    const r = baseListingSchema.safeParse({ pageStyle: k });
    assert.ok(!r.success || r.data.pageStyle === k, `schema keeps ${k}`);
    if (!r.success) assert.ok(!r.error.issues.some((i) => i.path[0] === "pageStyle"), `pageStyle ${k} rejected: ${JSON.stringify(r.error.issues)}`);
  }
  const bad = baseListingSchema.safeParse({ pageStyle: "not-a-theme" });
  assert.ok(!bad.success && bad.error.issues.some((i) => i.path[0] === "pageStyle"), "unknown keys are still rejected");
});

test("every new theme has every token, a font and hero artwork", () => {
  for (const k of NEW_THEME_KEYS) {
    const th = THEME_TOKENS[k];
    assert.equal(th.key, k);
    for (const f of REQUIRED) assert.ok(th.t[f] !== undefined && th.t[f] !== "", `${k}.${f} missing`);
    for (const f of ["bg", "surf", "surf2", "ink", "mute", "line", "band", "bandInk", "eyebrow", "strip", "stripInk", "acc", "accInk", "price", "sec", "phInk", "chip", "chipInk", "sel", "selInk", "selOn", "cta", "ctaInk"] as const) {
      assert.match(th.t[f] as string, /^#[0-9a-fA-F]{6}$/, `${k}.${f} is a hex colour`);
    }
    assert.match(th.dot, /^#[0-9a-fA-F]{6}$/);
    assert.ok(th.t.phStops.length >= 1 && th.t.phStops.every((c) => /^#[0-9a-fA-F]{6}$/.test(c)), `${k} header stops`);
    assert.ok(FONT_STACK[th.font], `${k} font stack`);
    assert.match(themeFontHref(k) ?? "", /^https:\/\/fonts\.googleapis\.com\/css2\?family=.+&display=swap$/, `${k} lazy font url`);
    assert.ok(hero.includes(`case "${k}"`), `${k} has hero art in ThemeHero`);
    assert.ok(css.includes(`.aos-art.th-${k}`), `${k} has hero art styles`);
  }
  assert.equal(themeFontHref("sport"), null, "the original ten load no extra font");
});

test("every theme has a translated name with exactly 11 columns", () => {
  for (const k of [...LEGACY_THEME_KEYS, ...NEW_THEME_KEYS]) {
    const m = new RegExp(`^  wbTheme_${k}: (\\[.*\\]),$`, "m").exec(wiz2);
    assert.ok(m, `wbTheme_${k} row exists`);
    const cols = JSON.parse(m![1]) as string[];
    assert.equal(cols.length, 11, `wbTheme_${k} has 11 columns`);
    assert.ok(cols.every((c) => c.trim().length > 0), `wbTheme_${k} has no empty column`);
  }
});

test("every text/background pair on every theme is at least 4.5:1", () => {
  const fails: string[] = [];
  for (const k of NEW_THEME_KEYS) {
    for (const [label, fg, bg] of [...contrastPairs(THEME_TOKENS[k]), ...(ART_TEXT_PAIRS[k] ?? [])]) {
      const c = contrast(fg, bg);
      if (c < 4.5) fails.push(`${k}: ${label} ${fg} on ${bg} = ${c.toFixed(2)}`);
    }
  }
  assert.deepEqual(fails, []);
});

test("light themes are never white-on-white and dark themes never dark-on-dark", () => {
  for (const k of NEW_THEME_KEYS) {
    const th = THEME_TOKENS[k];
    const bgDark = contrast(th.t.bg, "#000000") < contrast(th.t.bg, "#FFFFFF");
    assert.equal(bgDark, th.dark, `${k}: dark flag matches its page colour`);
    assert.ok(contrast(th.t.ink, th.t.bg) >= 4.5 && contrast(th.t.ink, th.t.surf) >= 4.5, `${k}: body text readable`);
  }
});
