import test from "node:test";
import assert from "node:assert/strict";
import { isChunkLoadError, reloadOnceForChunkError } from "../lib/chunkError";

test("recognises chunk / dynamic import failures from Chrome, Safari and Firefox", () => {
  assert.ok(isChunkLoadError({ name: "ChunkLoadError", message: "Loading chunk 12 failed." }));
  assert.ok(isChunkLoadError({ message: "Importing a module script failed." })); // Safari
  assert.ok(isChunkLoadError({ message: "Failed to fetch dynamically imported module: https://x/_next/a.js" }));
  assert.ok(!isChunkLoadError({ message: "Cannot read properties of undefined" }));
});

test("reloads once, then never again in the same tab", () => {
  const mem = new Map<string, string>();
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  let n = 0;
  const e = { name: "ChunkLoadError", message: "Loading chunk 3 failed" };
  assert.equal(reloadOnceForChunkError(e, store, () => { n++; }), true);
  assert.equal(reloadOnceForChunkError(e, store, () => { n++; }), false);
  assert.equal(n, 1);
});

test("a non-chunk error or blocked storage never reloads", () => {
  let n = 0;
  assert.equal(reloadOnceForChunkError({ message: "boom" }, { getItem: () => null, setItem: () => {} }, () => { n++; }), false);
  const bad = { getItem: () => { throw new Error("denied"); }, setItem: () => {} };
  assert.equal(reloadOnceForChunkError({ name: "ChunkLoadError" }, bad, () => { n++; }), false);
  assert.equal(n, 0);
});
