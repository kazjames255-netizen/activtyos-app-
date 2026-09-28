// Run: cd server && node_modules/.bin/tsx ../features/learninghub/lesson/slides/roomBelow.selftest.ts
import assert from "node:assert/strict";
import { roomBelow } from "./roomBelow";
import type { CanvasEl } from "./types";

const T = (x: number, y: number, w: number, h: number, paras: number, o: Partial<CanvasEl> = {}): CanvasEl =>
  ({ k: "text", x, y, w, h, paras: Array.from({ length: paras }, (_, i) => ({ runs: [{ t: `p${i}`, size: 18 }] })), ...o }) as CanvasEl;

// 1. a static box with one static neighbour lower down is still capped to the room above it (speech bubbles, captions)
assert.ok(Math.abs(roomBelow([T(0.1, 0.1, 0.5, 0.4, 2), T(0.1, 0.3, 0.5, 0.1, 1)], 0) - 0.5) < 1e-9);
// 2. ...and so is a box with a single click-reveal neighbour (the second sentence of a bubble)
assert.ok(Math.abs(roomBelow([T(0.1, 0.1, 0.5, 0.4, 2), T(0.1, 0.3, 0.5, 0.1, 1, { step: 1 })], 0) - 0.5) < 1e-9);
// 3. an answer key: a 6-line list with 6 click-reveal answers on its lines is NOT squeezed
const key = [T(0.04, 0.25, 0.9, 0.59, 6), ...[0.3, 0.41, 0.51, 0.62, 0.73, 0.84].map((y, k) => T(0.08, y, 0.9, 0.06, 1, { step: k + 1 }))];
assert.equal(roomBelow(key, 0), 1);
// 4. ...but a STATIC box under the same list still caps it
assert.equal(roomBelow([...key, T(0.04, 0.5, 0.9, 0.1, 1)], 0) < 1, true);
// 5. two-line lists (fewer than 3 paragraphs) keep the old behaviour
assert.equal(roomBelow([T(0.1, 0.1, 0.5, 0.4, 2), T(0.1, 0.2, 0.5, 0.05, 1, { step: 1 }), T(0.1, 0.3, 0.5, 0.05, 1, { step: 2 })], 0) < 1, true);
console.log("roomBelow selftest ok");
