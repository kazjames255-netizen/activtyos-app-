/**
 * The public browse feed is cached for a few seconds per asker (it used to take 8s+ on every visit).
 * The cache must never serve an operator's stale edit: every listing write clears it, and ?fresh=1 skips it.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../server/src/routes/listings.ts", import.meta.url), "utf8");

test("the browse feed is cached per asker and per provider, for seconds not minutes", () => {
  assert.match(src, /const BROWSE_CACHE_MS = (\d{3,5});/);
  assert.ok(Number(/BROWSE_CACHE_MS = (\d+)/.exec(src)![1]) <= 15000);
  assert.match(src, /browseKey = `\$\{req\.user\?\.uid \?\? "anon"\}\|\$\{tenantFilter \?\? ""\}`/);
});

test("any listing write clears the cache, and ?fresh=1 bypasses it", () => {
  assert.match(src, /listings\.use\(\(req, res, next\) => \{ if \(req\.method !== "GET"\) res\.on\("finish", \(\) => clearBrowseCache\(\)\)/);
  assert.match(src, /req\.query\.fresh === "1"/);
});

test("the operator's own list (?mine=1) is never cached", () => {
  const mineAt = src.indexOf('req.query.mine === "1"');
  const cacheAt = src.indexOf("browseCache.get(browseKey)");
  assert.ok(mineAt > 0 && cacheAt > mineAt, "the mine=1 branch returns before the cache is consulted");
});
