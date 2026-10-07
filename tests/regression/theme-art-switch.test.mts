/** Regression (7 Oct): the "show theme artwork when there's no photo" switch defaults on, persists through the listing schema,
 *  and the wizard's i18n rows carry all 11 languages. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { themeArtOn } from "../../features/listings/pageThemes";
import { baseListingSchema } from "../../server/src/lib/listingRules";

test("artwork is on by default, off only when explicitly false", () => {
  assert.equal(themeArtOn({}), true);
  assert.equal(themeArtOn(undefined), true);
  assert.equal(themeArtOn({ themeArt: true }), true);
  assert.equal(themeArtOn({ themeArt: false }), false);
});

test("listing schema accepts and keeps themeArt, rejects non-booleans, and old listings without it still parse", () => {
  assert.equal(baseListingSchema.parse({ title: "x", themeArt: false }).themeArt, false);
  assert.equal(baseListingSchema.parse({ title: "x", themeArt: true }).themeArt, true);
  assert.equal(baseListingSchema.parse({ title: "x" }).themeArt, undefined);
  assert.equal(baseListingSchema.safeParse({ title: "x", themeArt: "no" }).success, false);
});

test("the switch label and hint have exactly 11 languages", () => {
  const src = readFileSync(new URL("../../lib/i18n/messages/areas/p8lst-parts/wiz2.ts", import.meta.url), "utf8");
  for (const k of ["waThemeArt", "waThemeArtHint"]) {
    const m = src.match(new RegExp(`^  ${k}: \\[(.*)\\],$`, "m"));
    assert.ok(m, k);
    assert.equal(m![1].split(/",\s*"/).length, 11, k);
  }
});
