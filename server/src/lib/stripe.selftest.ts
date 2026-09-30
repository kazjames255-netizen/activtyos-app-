import assert from "node:assert/strict";
import { resolvePlatformFallback, checkProductionUrls } from "./stripe";

const logs: string[] = [];
const log = (m: string) => logs.push(m);

// production + fallback=1 -> forced off, error logged
assert.equal(resolvePlatformFallback({ NODE_ENV: "production", STRIPE_PLATFORM_FALLBACK: "1" }, log), false);
assert.equal(logs.length, 1);
assert.match(logs[0], /STRIPE_PLATFORM_FALLBACK/);
// other truthy spellings are caught too
assert.equal(resolvePlatformFallback({ NODE_ENV: "production", STRIPE_PLATFORM_FALLBACK: "true" }, log), false);
assert.equal(logs.length, 2);

// production, unset / 0 -> off, nothing logged
logs.length = 0;
assert.equal(resolvePlatformFallback({ NODE_ENV: "production" }, log), false);
assert.equal(resolvePlatformFallback({ NODE_ENV: "production", STRIPE_PLATFORM_FALLBACK: "0" }, log), false);
assert.equal(logs.length, 0);

// development unchanged
assert.equal(resolvePlatformFallback({ NODE_ENV: "development", STRIPE_PLATFORM_FALLBACK: "1" }, log), true);
assert.equal(resolvePlatformFallback({ STRIPE_PLATFORM_FALLBACK: "1" }, log), true);
assert.equal(resolvePlatformFallback({}, log), false);
assert.equal(logs.length, 0);

// production URL check: logs, never throws
assert.deepEqual(checkProductionUrls({ NODE_ENV: "production" }, log), ["WEB_URL", "API_URL"]);
assert.equal(logs.length, 2);
logs.length = 0;
assert.deepEqual(checkProductionUrls({ NODE_ENV: "production", WEB_URL: "https://a", API_URL: "https://b" }, log), []);
assert.deepEqual(checkProductionUrls({ NODE_ENV: "development" }, log), []);
assert.equal(logs.length, 0);

console.log("stripe selftest passed");
