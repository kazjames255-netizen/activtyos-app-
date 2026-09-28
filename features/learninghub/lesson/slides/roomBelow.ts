import type { CanvasEl } from "./types";

/** How much of a text box's height it may use before it runs into another text box sitting below it (same column): a fraction of its own
 *  height, 1 = no neighbour. Imported decks size a box for the ORIGINAL font, so a wider substituted font wraps to more lines and would
 *  otherwise run down over the next box (a speech bubble's second sentence, a caption under a sentence). */
export function roomBelow(els: CanvasEl[], i: number): number {
  const a = els[i];
  if (!a || a.k !== "text" || a.h <= 0) return 1;
  let cap = 1;
  els.forEach((b, j) => {
    if (j === i || b.k !== "text") return;
    const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    if (overlapX < 0.3 * Math.min(a.w, b.w)) return;
    if (b.y > a.y + 0.01 && b.y < a.y + a.h) cap = Math.min(cap, Math.max(0.3, (b.y - a.y) / a.h));
  });
  return cap;
}

