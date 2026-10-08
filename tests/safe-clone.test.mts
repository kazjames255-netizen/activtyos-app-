import test from "node:test";
import assert from "node:assert/strict";
import { cloneJson } from "../lib/cloneJson";

// Regression (Quick book blank on iPhone, 9 Oct 2026): structuredClone is missing before iOS Safari 15.4, and lib/api.ts called it on EVERY
// read, so on an older iPhone every screen's data fetch threw and the screen stayed blank. cloneJson must work without it.
test("cloneJson returns an independent copy", () => {
  const src = { a: [1, 2, { b: "x" }], n: null as null, s: "t" };
  const out = cloneJson(src);
  assert.deepEqual(out, src);
  out.a.push(3);
  assert.equal(src.a.length, 3);
});

test("cloneJson works when structuredClone does not exist (old iOS Safari)", () => {
  const g = globalThis as { structuredClone?: unknown };
  const saved = g.structuredClone;
  delete g.structuredClone;
  try {
    const src = { list: [{ id: 1 }], nested: { ok: true } };
    const out = cloneJson(src);
    assert.deepEqual(out, src);
    assert.notEqual(out.list, src.list);
  } finally { g.structuredClone = saved; }
});

test("cloneJson passes primitives through", () => {
  assert.equal(cloneJson(5), 5);
  assert.equal(cloneJson(null), null);
  assert.equal(cloneJson("a"), "a");
});
