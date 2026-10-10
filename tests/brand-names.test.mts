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

test("brand: the logo assets exist and carry the three lane colours", () => {
  const svg = readFileSync(root + "public/brand/mark.svg", "utf8");
  for (const c of ["#ff6f91", "#18b9a4", "#8a6cf2"]) assert.ok(svg.includes(c), `mark.svg has ${c}`);
  for (const f of ["public/brand/logo-light.svg", "public/brand/logo-dark.svg", "public/brand/icon-192.png", "public/brand/icon-512.png", "app/favicon.ico", "app/apple-icon.png", "app/opengraph-image.png"]) {
    assert.ok(files.includes(f) || readFileSync(root + f).length > 0, f);
  }
});
