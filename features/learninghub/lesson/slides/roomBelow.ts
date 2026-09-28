import type { CanvasEl } from "./types";

/** How much of a text box's height it may use before it runs into another text box sitting below it (same column): a fraction of its own
 *  height, 1 = no neighbour. Imported decks size a box for the ORIGINAL font, so a wider substituted font wraps to more lines and would
 *  otherwise run down over the next box (a speech bubble's second sentence, a caption under a sentence). */
export function roomBelow(els: CanvasEl[], i: number): number {
  const a = els[i];
  if (!a || a.k !== "text" || a.h <= 0) return 1;
  const below = (b: CanvasEl) => {
    if (b.k !== "text") return false;
    const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    return overlapX >= 0.3 * Math.min(a.w, b.w) && b.y > a.y + 0.01 && b.y < a.y + a.h;
  };
  // An ANSWER KEY laid over a list: a numbered list of questions with the answers as separate click-reveal boxes sitting on the question lines
  // (2+ reveals inside the list's own box, one line each). They are written ON the list by design, not "the next box below it": capping the list to
  // the first answer's top squeezed the whole question list to the 9pt floor and the answers then landed on nothing (calibration cluster overlap:text-text).
  const isAnswerKey = a.paras.length >= 3 && els.filter((b, j) => j !== i && below(b) && b.k === "text" && !!b.step).length >= 2;
  let cap = 1;
  els.forEach((b, j) => {
    if (j === i || !below(b)) return;
    if (isAnswerKey && b.k === "text" && b.step) return;
    cap = Math.min(cap, Math.max(0.3, (b.y - a.y) / a.h));
  });
  return cap;
}
