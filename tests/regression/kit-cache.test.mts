import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import { cached, clearKitCache, kitCacheInvalidator } from "../../server/src/lib/kitCache";

// The Add-on orders month tally / strip is cached for a few seconds; right after a cancel it disagreed with the per-day list (which is never cached).
// Any successful write now empties the cache, and a calculation that was running while the write happened is never stored.
const root = path.resolve(import.meta.dirname, "../..");

test("a cached value is reused until something is written", async () => {
  clearKitCache();
  let n = 0;
  const make = async () => ++n;
  assert.equal(await cached("k", 60_000, make), 1);
  assert.equal(await cached("k", 60_000, make), 1);
  clearKitCache();
  assert.equal(await cached("k", 60_000, make), 2);
});
test("a calculation that started before a write finished is not kept", async () => {
  clearKitCache();
  let n = 0;
  const slow = async () => { const v = ++n; clearKitCache(); return v; }; // the write lands while the calculation is running
  assert.equal(await cached("k2", 60_000, slow), 1);
  assert.equal(await cached("k2", 60_000, slow), 2, "the stale result was not stored");
});
test("every successful write request empties the cache; reads and failed writes do not", () => {
  clearKitCache();
  const run = async (method: string, status: number) => {
    clearKitCache();
    let n = 0;
    await cached("k3", 60_000, async () => ++n);
    const res = new EventEmitter() as EventEmitter & { statusCode: number };
    res.statusCode = status;
    kitCacheInvalidator({ method } as never, res as never, () => {});
    res.emit("finish");
    return cached("k3", 60_000, async () => 99);
  };
  return Promise.all([]).then(async () => {
    assert.equal(await run("POST", 200), 99);
    assert.equal(await run("PUT", 200), 99);
    assert.equal(await run("PATCH", 204), 99);
    assert.equal(await run("DELETE", 200), 99);
    assert.equal(await run("GET", 200), 1);
    assert.equal(await run("POST", 500), 1, "a failed write changed nothing");
  });
});
test("the server wires the invalidator in front of the routes and kit.ts uses the shared cache", () => {
  const idx = fs.readFileSync(path.join(root, "server/src/index.ts"), "utf8");
  assert.match(idx, /kitCacheInvalidator/);
  assert.ok(idx.indexOf("kitCacheInvalidator") < idx.indexOf('app.use("/api/kit"'), "before the routes");
  const kit = fs.readFileSync(path.join(root, "server/src/routes/kit.ts"), "utf8");
  assert.match(kit, /from "\.\.\/lib\/kitCache"/);
  assert.doesNotMatch(kit, /const memo = new Map/);
});
