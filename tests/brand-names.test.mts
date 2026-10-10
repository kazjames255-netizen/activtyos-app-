/** Pure: customer-facing source never carries an old product name (ActivityOS / Activly / the "Name TBC" placeholder).
 *  Internal identifiers are allow-listed below; add to the list ONLY for a name that is code, not text a person reads. */
import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { BRAND, BRAND_DOMAIN } from "../lib/i18n/config";
import { BRAND as SERVER_BRAND, BRAND_DOMAIN as SERVER_DOMAIN } from "../server/src/lib/brand";

const root = new URL("../", import.meta.url).pathname;
const files = execSync("git ls-files", { cwd: root, maxBuffer: 1 << 28 }).toString().split("\n").filter(Boolean);

// Only places a customer, parent, provider or recipient can read.
const SCOPE = /^(app|components|features|lib|public|server\/src)\//;
const SKIP = /^(lib\/testing\/|lib\/testTracker\/)|\.(png|jpe?g|gif|webp|ico|woff2?|mp4|webm|pdf)$|\.md$/;
const OLD = /ActivityOS|Activly|Name TBC/g;
// Internal identifiers that legitimately still contain an old name (code, not copy).
const ALLOW = [
  /ActivityOSEmbed/g,        // public embed.js global kept as an alias for old embedders
  /messageActivityOS/g,      // i18n catalogue key
  /ActivlySiteApp/g,         // component / view-registry identifier
  /activly-site/g,
];

function hits(text: string): string[] {
  let t = text;
  for (const a of ALLOW) t = t.replace(a, "");
  return [...t.matchAll(OLD)].map((m) => t.slice(Math.max(0, m.index! - 25), m.index! + 35).replace(/\s+/g, " "));
}

test("brand: web and server constants agree and point at ActivityLane", () => {
  assert.equal(BRAND, "ActivityLane");
  assert.equal(SERVER_BRAND, "ActivityLane");
  assert.equal(BRAND_DOMAIN, "activitylane.com");
  assert.equal(SERVER_DOMAIN, "activitylane.com");
});

test("brand: no customer-facing file contains an old product name", () => {
  const bad: Record<string, string[]> = {};
  for (const f of files) {
    if (!SCOPE.test(f) || SKIP.test(f)) continue;
    let s: string;
    try { s = readFileSync(root + f, "utf8"); } catch { continue; }
    const h = hits(s);
    if (h.length) bad[f] = h.slice(0, 3);
  }
  assert.deepEqual(bad, {});
});

test("brand: the logo assets exist and carry the sky-to-white gradient lanes", () => {
  const svg = readFileSync(root + "public/brand/mark.svg", "utf8");
  assert.ok(svg.includes("#6ea4f5") && svg.includes("linearGradient"), "mark.svg lanes are the sky gradient");
  for (const f of ["public/brand/logo-light.svg", "public/brand/logo-dark.svg", "public/brand/mark-bare-dark.svg", "public/brand/mark-bare-light.svg", "public/brand/icon-192.png", "public/brand/icon-512.png", "app/favicon.ico", "app/apple-icon.png", "app/opengraph-image.png"]) {
    assert.ok(files.includes(f) || readFileSync(root + f).length > 0, f);
  }
});

test("brand: the lockup is the bare mark with a two-tone wordmark (Activity white / Lane amber on dark; deep amber on light)", () => {
  const dark = readFileSync(root + "public/brand/logo-dark.svg", "utf8");
  const light = readFileSync(root + "public/brand/logo-light.svg", "utf8");
  assert.ok(!/<rect[^>]*rx=/.test(dark + light), "no tile in the lockups");
  assert.match(dark, /fill="#ffffff">Activity[\s\S]*fill="#ffb02e">Lane/);
  assert.match(light, /fill="#14378f">Activity[\s\S]*fill="#c77700">Lane/);
  const pages = files.filter((f) => /^public\/(v2\/)?[a-z0-9-]+\.html$/.test(f) && readFileSync(root + f, "utf8").includes('class="brand"'));
  assert.ok(pages.length > 30);
  for (const f of pages) assert.ok(readFileSync(root + f, "utf8").includes("mark-bare-dark.svg"), f + " uses the onDark lockup");
});

test("brand: deep amber on light passes 3:1 on white", () => {
  const lum = (h: string) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  assert.ok(1.05 / (lum("#c77700") + 0.05) >= 3);
});

test("brand: logo assets and component use gradient lanes, none of the old pink / teal / violet", () => {
  const OLD_LANES = /#ff6f91|#18b9a4|#8a6cf2/i;
  for (const f of ["mark.svg", "mark-bare-dark.svg", "mark-bare-light.svg", "logo-dark.svg", "logo-light.svg"]) {
    const t = readFileSync(root + "public/brand/" + f, "utf8");
    assert.doesNotMatch(t, OLD_LANES, f);
    assert.match(t, /stop-color="#6ea4f5"/, f + " starts at sky blue");
  }
  assert.match(readFileSync(root + "public/brand/logo-dark.svg", "utf8"), /stop-color="#ffffff"/);
  assert.match(readFileSync(root + "public/brand/logo-light.svg", "utf8"), /stop-color="#14378f"/);
  const comp = readFileSync(root + "components/ui/Logo.tsx", "utf8");
  assert.doesNotMatch(comp, OLD_LANES);
  assert.match(comp, /useId/, "unique gradient ids per instance");
});
