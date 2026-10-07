/** Regression (7 Oct): "brand colours drive theme choice". matchThemes() is pure + deterministic, picks 3 distinct valid
 *  themes for the provider's three colours (weights 3:2:1), degrades gracefully with missing colours, and the server
 *  accepts only hex brand colours and a known default theme. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ALL_THEME_KEYS, LEGACY_THEME_KEYS, NEW_THEME_KEYS, matchThemes, colourDistance, normaliseHex, isThemeKey, themeKeyColours } from "../../features/listings/pageThemes";
import { PAGE_STYLES, brandSettingsError } from "../../server/src/lib/listingRules";
import { PUBLIC_SETTINGS_KEYS } from "../../server/src/lib/publicLibrary";

const NAVY_ORANGE_WHITE = { c1: "#14213d", c2: "#ff7a00", c3: "#f7f5f0" };

test("all 25 themes have key colours and are valid server keys", () => {
  assert.equal(ALL_THEME_KEYS.length, 25);
  assert.equal(LEGACY_THEME_KEYS.length + NEW_THEME_KEYS.length, 25);
  for (const k of ALL_THEME_KEYS) {
    assert.ok(themeKeyColours(k), `${k} has key colours`);
    assert.ok((PAGE_STYLES as readonly string[]).includes(k), `${k} accepted by the server`);
    assert.ok(isThemeKey(k));
  }
  assert.ok(!isThemeKey("nope") && !isThemeKey(undefined));
});

test("returns exactly 3 distinct valid keys", () => {
  for (const brand of [NAVY_ORANGE_WHITE, { c1: "#dc2626" }, { c1: "#00ff00", c2: "#0000ff", c3: "#ff00ff" }, { c1: "#000000", c2: "#ffffff", c3: "#808080" }]) {
    const m = matchThemes(brand);
    assert.equal(m.length, 3);
    assert.equal(new Set(m.map((x) => x.key)).size, 3);
    for (const x of m) assert.ok(isThemeKey(x.key));
  }
  assert.equal(matchThemes(NAVY_ORANGE_WHITE, 5).length, 5);
});

test("navy + orange + near-white picks navy / orange themes", () => {
  const keys = matchThemes(NAVY_ORANGE_WHITE).map((x) => x.key);
  // Varsity (navy header, gold accent, cream ground) and Brite (grape header, orange accent, peach ground) are the sensible fits;
  // dark-navy Royal / Midnight-style themes are acceptable neighbours, a lime or pink theme is not.
  assert.ok(keys.includes("varsity") || keys.includes("brite"), `got ${keys.join(",")}`);
  for (const bad of ["pitch", "pirouette", "riso", "arcade", "aurora", "mint"]) assert.ok(!keys.includes(bad as never), `${bad} should not match navy/orange/white`);
});

test("a pure red brand matches a red theme", () => {
  const keys = matchThemes({ c1: "#dc2626" }).map((x) => x.key);
  assert.ok(keys.includes("crimson") || keys.includes("poster") || keys.includes("burgundy"), keys.join(","));
});

test("deterministic: same input, same output, key-order independent", () => {
  const a = matchThemes(NAVY_ORANGE_WHITE);
  const b = matchThemes({ c3: "#f7f5f0", c2: "#ff7a00", c1: "#14213d" });
  assert.deepEqual(a, b);
  assert.deepEqual(matchThemes(NAVY_ORANGE_WHITE), a);
  // case / shorthand hex are normalised
  assert.deepEqual(matchThemes({ c1: "#14213D", c2: "#F70", c3: "#F7F5F0" }).map((x) => x.key), matchThemes({ c1: "#14213d", c2: "#ff7700", c3: "#f7f5f0" }).map((x) => x.key));
});

test("scores are ascending (best first)", () => {
  const m = matchThemes(NAVY_ORANGE_WHITE, 25);
  for (let i = 1; i < m.length; i++) assert.ok(m[i - 1].score <= m[i].score);
});

test("weights: main outweighs second outweighs third", () => {
  const rank = (brand: { c1: string; c2: string; c3: string }, key: string) => matchThemes(brand, 25).findIndex((x) => x.key === key);
  const blue = "#1032cf", red = "#e11d48", green = "#059669";
  // The same three colours in a different order: the theme built on the blue ranks better the heavier the blue is weighted.
  const r1 = rank({ c1: blue, c2: red, c3: green }, "halftone");
  const r2 = rank({ c1: red, c2: blue, c3: green }, "halftone");
  const r3 = rank({ c1: red, c2: green, c3: blue }, "halftone");
  assert.ok(r1 <= r2 && r2 <= r3 && r1 < r3, `ranks ${r1} ${r2} ${r3}`);
  assert.equal(matchThemes({ c1: blue })[0].slot, "main");
  assert.equal(matchThemes({ c2: blue })[0].slot, "second");
  assert.equal(matchThemes({ c3: blue })[0].slot, "third");
});

test("missing colours fall back gracefully", () => {
  assert.deepEqual(matchThemes({}), []);
  assert.deepEqual(matchThemes({ c1: null, c2: undefined, c3: "" }), []);
  assert.deepEqual(matchThemes({ c1: "not a colour", c2: "red" }), []);
  assert.equal(matchThemes({ c1: "#1032cf" }).length, 3);
  assert.equal(matchThemes({ c2: "#1032cf" }).length, 3);
  assert.equal(matchThemes({ c1: "#1032cf", c2: "garbage" })[0].key, matchThemes({ c1: "#1032cf" })[0].key);
});

test("colour distance sanity", () => {
  assert.equal(colourDistance("#123456", "#123456"), 0);
  assert.ok(colourDistance("#ffffff", "#000000") > 90);
  assert.ok(colourDistance("#14213d", "#16243f") < 3);
  assert.equal(normaliseHex("#ABC"), "#aabbcc");
  assert.equal(normaliseHex("blue"), null);
});

test("server: brand colours must be hex, default theme must be a known key", () => {
  assert.equal(brandSettingsError({}), null);
  assert.equal(brandSettingsError({ brandColor: "#2f6bd8", brandColor2: "#ff7a00", brandColor3: "#FFF", defaultListingTheme: "varsity" }), null);
  assert.equal(brandSettingsError({ brandColor2: "", brandColor3: undefined }), null, "empty clears");
  assert.ok(brandSettingsError({ brandColor2: "orange" }));
  assert.ok(brandSettingsError({ brandColor3: "url(javascript:1)" }));
  assert.ok(brandSettingsError({ brandColor: 12 }));
  assert.ok(brandSettingsError({ defaultListingTheme: "not-a-theme" }));
  for (const k of PAGE_STYLES) assert.equal(brandSettingsError({ defaultListingTheme: k }), null);
});

test("brand colours are public (they tint pages), the default theme is not", () => {
  const keys = PUBLIC_SETTINGS_KEYS as readonly string[];
  assert.ok(keys.includes("brandColor") && keys.includes("brandColor2") && keys.includes("brandColor3"));
  assert.ok(!keys.includes("defaultListingTheme"));
});

test("wiring: new listings start on the saved default; picking a theme saves it", () => {
  const wiz = readFileSync(new URL("../../features/listings/ListingWizard.tsx", import.meta.url), "utf8");
  assert.ok(wiz.includes("defaults?.defaultListingTheme ? resolveTheme(defaults.defaultListingTheme)"));
  assert.ok(wiz.includes("defaultListingTheme: t"));
  assert.ok(wiz.includes("<MatchedThemes"));
});
