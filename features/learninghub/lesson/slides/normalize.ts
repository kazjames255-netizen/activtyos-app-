import type { CanvasEl, CanvasText } from "./types";

// Render-time normalisation of STORED imported decks (never written back). Fixes converter artefacts without touching the stored lesson:
//  • `dupHide`: a text box that repeats another box's text in (nearly) the same spot is drawn once (a converter re-emit at another reveal step).
//  • `until`: stacked "frames" — different text in the same box, each appearing on a later click, with no exit animation recorded — get a
//    virtual exit on the next frame's click, so the pile of words becomes a replace-in-place build like the original slide.
// Indices are unchanged (edit mode commits by index), only the drawing is affected.

export interface Norm { hide: Set<number>; until: Map<number, number> }

const txt = (e: CanvasText) => e.paras.map((p) => p.runs.map((r) => r.t).join("")).join("\n").replace(/\s+/g, " ").trim().toLowerCase();
const iou = (a: CanvasEl, b: CanvasEl) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  const i = w * h;
  return i / (a.w * a.h + b.w * b.h - i);
};
const hasParaAnim = (e: CanvasText) => e.paras.some((p) => p.step || p.until);

export function normalizeEls(els: CanvasEl[]): Norm {
  const hide = new Set<number>(), until = new Map<number, number>();
  const T: { i: number; e: CanvasText; s: string }[] = [];
  els.forEach((e, i) => { if (e.k === "text") { const s = txt(e); if (s) T.push({ i, e, s }); } });
  // duplicates (identical text, IoU >= .8, same exit): keep the one that shows first
  for (let a = 0; a < T.length; a++) {
    if (hide.has(T[a]!.i)) continue;
    for (let b = a + 1; b < T.length; b++) {
      const A = T[a]!, B = T[b]!;
      if (hide.has(B.i) || A.s !== B.s || (A.e.until ?? 0) !== (B.e.until ?? 0) || hasParaAnim(A.e) || hasParaAnim(B.e) || iou(A.e, B.e) < 0.8) continue;
      if ((B.e.step ?? 0) < (A.e.step ?? 0)) { hide.add(A.i); break; }
      hide.add(B.i);
    }
  }
  // stacked reveal frames
  const live = T.filter((t) => !hide.has(t.i) && !t.e.until && !hasParaAnim(t.e));
  const used = new Set<number>();
  for (const seed of live) {
    if (used.has(seed.i)) continue;
    const grp = live.filter((t) => !used.has(t.i) && iou(seed.e, t.e) >= 0.6);
    const steps = new Set(grp.map((t) => t.e.step ?? 0));
    if (grp.length < 2 || steps.size < 2 || !grp.some((t) => (t.e.step ?? 0) > 0)) continue;
    grp.forEach((t) => used.add(t.i));
    const order = [...grp].sort((p, q) => (p.e.step ?? 0) - (q.e.step ?? 0) || p.i - q.i);
    for (let k = 0; k < order.length - 1; k++) {
      const nxt = order.slice(k + 1).find((t) => (t.e.step ?? 0) > (order[k]!.e.step ?? 0));
      if (nxt) until.set(order[k]!.i, nxt.e.step!);
    }
  }
  return { hide, until };
}
