// Run: cd server && node_modules/.bin/tsx ../features/learninghub/lesson/slides/normalize.selftest.ts
import assert from "node:assert/strict";
import { normalizeEls } from "./normalize";
import type { CanvasEl } from "./types";

const T = (x: number, y: number, w: number, h: number, t: string, o: Partial<CanvasEl> = {}): CanvasEl => ({ k: "text", x, y, w, h, paras: [{ runs: [{ t, size: 18 }] }], ...o } as CanvasEl);

// 1. identical stacked boxes: the later one is hidden
let n = normalizeEls([T(0.1, 0.1, 0.5, 0.1, "Hello"), T(0.1, 0.1, 0.5, 0.1, "hello ", { step: 2 })]);
assert.deepEqual([...n.hide], [1]);
// ...but the earlier-showing copy is the one kept
n = normalizeEls([T(0.1, 0.1, 0.5, 0.1, "Hi", { step: 3 }), T(0.1, 0.1, 0.5, 0.1, "Hi", { step: 1 })]);
assert.deepEqual([...n.hide], [0]);
// 2. different text in the same spot on steps 1,3,5 with no exit: each gets an exit at the next frame's click
n = normalizeEls([T(0.1, 0.1, 0.5, 0.1, "uno", { step: 1 }), T(0.1, 0.1, 0.5, 0.1, "dos", { step: 3 }), T(0.1, 0.1, 0.5, 0.1, "tres", { step: 5 })]);
assert.equal(n.hide.size, 0);
assert.deepEqual([...n.until], [[0, 3], [1, 5]]);
// 3. legit designs are left alone: different boxes, an existing exit, no steps at all
n = normalizeEls([T(0.1, 0.1, 0.3, 0.1, "a", { step: 1 }), T(0.5, 0.5, 0.3, 0.1, "b", { step: 2 })]);
assert.equal(n.hide.size + n.until.size, 0);
n = normalizeEls([T(0.1, 0.1, 0.5, 0.1, "a", { step: 1, until: 2 }), T(0.1, 0.1, 0.5, 0.1, "b", { step: 2 })]);
assert.equal(n.until.size, 0);
n = normalizeEls([T(0.1, 0.1, 0.5, 0.1, "a"), T(0.1, 0.1, 0.5, 0.1, "b")]);
assert.equal(n.hide.size + n.until.size, 0);
console.log("normalize selftest ok");
