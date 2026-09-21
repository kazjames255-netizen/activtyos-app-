import type { CanvasEl } from "./types";

// Pure geometry for placing pictures / text boxes on a canvas slide (tutor preview edit mode). Everything is a FRACTION of the slide
// (0..1), like the saved elements; `W`/`H` are the slide's size in points and only serve to keep an aspect ratio true.
// The UI (CanvasSlide.tsx) turns pointer movement into fractions and calls applyDrag; nothing here touches the DOM.

export interface Rect { x: number; y: number; w: number; h: number }
export type Handle = "move" | "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";
export interface DragOpts {
  /** keep the aspect ratio while resizing (Shift toggles this) */
  lock: boolean;
  /** snap to the slide's edges / centre and to other elements' edges / centres (Alt turns it off) */
  snap: boolean;
  W: number; H: number;
  /** boxes of the other elements, for snapping */
  others: Rect[];
  minW?: number; minH?: number;
}
export interface Guides { v: number[]; h: number[] }

export const MIN_SIZE = 0.02;
const SNAP = 0.009;
const r4 = (v: number) => Math.round(v * 10000) / 10000;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Where an element may sit: fully on the slide (or, for an element that already bleeds off it, no further out than it was). */
const bounds = (r: Rect): { x0: number; x1: number; y0: number; y1: number } => ({ x0: Math.min(0, r.x), x1: Math.max(1, r.x + r.w), y0: Math.min(0, r.y), y1: Math.max(1, r.y + r.h) });

function lines(others: Rect[]): { v: number[]; h: number[] } {
  const v = [0, 0.5, 1], h = [0, 0.5, 1];
  for (const o of others) { v.push(o.x, o.x + o.w / 2, o.x + o.w); h.push(o.y, o.y + o.h / 2, o.y + o.h); }
  return { v, h };
}
/** The offset that snaps the nearest of `probes` onto a line (0 = nothing close), plus the line it snapped to. */
function pull(probes: number[], ls: number[]): { d: number; at?: number } {
  let best = SNAP + 1, d = 0, at: number | undefined;
  for (const p of probes) for (const l of ls) { const g = Math.abs(l - p); if (g < best && g <= SNAP) { best = g; d = l - p; at = l; } }
  return { d, at };
}

/** The new box for a drag of `handle` by (dx, dy) — fractions of the slide since the drag began — from the box it began with. */
export function applyDrag(handle: Handle, start: Rect, dx: number, dy: number, o: DragOpts): { rect: Rect; guides: Guides } {
  const B = bounds(start);
  const g: Guides = { v: [], h: [] };
  const ls = o.snap ? lines(o.others) : { v: [], h: [] };
  const minW = o.minW ?? MIN_SIZE, minH = o.minH ?? MIN_SIZE;

  if (handle === "move") {
    let x = start.x + dx, y = start.y + dy;
    if (o.snap) {
      const px = pull([x, x + start.w / 2, x + start.w], ls.v), py = pull([y, y + start.h / 2, y + start.h], ls.h);
      x += px.d; y += py.d;
      if (px.at !== undefined) g.v.push(px.at);
      if (py.at !== undefined) g.h.push(py.at);
    }
    x = clamp(x, Math.min(B.x0, B.x1 - start.w), Math.max(B.x0, B.x1 - start.w));
    y = clamp(y, Math.min(B.y0, B.y1 - start.h), Math.max(B.y0, B.y1 - start.h));
    return { rect: { x: r4(x), y: r4(y), w: start.w, h: start.h }, guides: g };
  }

  const hasW = handle.includes("w"), hasE = handle.includes("e"), hasN = handle.includes("n"), hasS = handle.includes("s");
  const left = start.x, right = start.x + start.w, top = start.y, bottom = start.y + start.h;
  let nl = left, nr = right, nt = top, nb = bottom;
  if (hasW) nl = left + dx;
  if (hasE) nr = right + dx;
  if (hasN) nt = top + dy;
  if (hasS) nb = bottom + dy;
  if (o.snap) {
    if (hasW) { const p = pull([nl], ls.v); nl += p.d; if (p.at !== undefined) g.v.push(p.at); }
    if (hasE) { const p = pull([nr], ls.v); nr += p.d; if (p.at !== undefined) g.v.push(p.at); }
    if (hasN) { const p = pull([nt], ls.h); nt += p.d; if (p.at !== undefined) g.h.push(p.at); }
    if (hasS) { const p = pull([nb], ls.h); nb += p.d; if (p.at !== undefined) g.h.push(p.at); }
  }

  if (o.lock && start.w > 0 && start.h > 0) {
    // one uniform scale, anchored on the opposite corner (or the opposite edge's middle for an edge handle)
    const corner = (hasW || hasE) && (hasN || hasS);
    const wantW = Math.max(nr - nl, minW) / start.w, wantH = Math.max(nb - nt, minH) / start.h;
    let s = corner ? Math.max(wantW, wantH) : hasW || hasE ? wantW : wantH;
    const roomW = hasW ? right - B.x0 : hasE ? B.x1 - left : 2 * Math.min(left + start.w / 2 - B.x0, B.x1 - (left + start.w / 2));
    const roomH = hasN ? bottom - B.y0 : hasS ? B.y1 - top : 2 * Math.min(top + start.h / 2 - B.y0, B.y1 - (top + start.h / 2));
    s = Math.min(s, roomW / start.w, roomH / start.h);
    s = Math.max(s, Math.max(minW / start.w, minH / start.h));
    const w2 = start.w * s, h2 = start.h * s;
    if (hasW) { nr = right; nl = right - w2; } else if (hasE) { nl = left; nr = left + w2; } else { nl = left + (start.w - w2) / 2; nr = nl + w2; }
    if (hasN) { nb = bottom; nt = bottom - h2; } else if (hasS) { nt = top; nb = top + h2; } else { nt = top + (start.h - h2) / 2; nb = nt + h2; }
  } else {
    if (nr - nl < minW) { if (hasW) nl = nr - minW; else nr = nl + minW; }
    if (nb - nt < minH) { if (hasN) nt = nb - minH; else nb = nt + minH; }
    nl = clamp(nl, B.x0, B.x1); nr = clamp(nr, B.x0, B.x1); nt = clamp(nt, B.y0, B.y1); nb = clamp(nb, B.y0, B.y1);
    if (nr - nl < minW) { if (hasW) nl = nr - minW; else nr = nl + minW; }
    if (nb - nt < minH) { if (hasN) nt = nb - minH; else nb = nt + minH; }
  }
  return { rect: { x: r4(nl), y: r4(nt), w: r4(nr - nl), h: r4(nb - nt) }, guides: g };
}

/** A keyboard nudge (fractions), kept on the slide. */
export function nudge(r: Rect, dx: number, dy: number): Rect {
  const B = bounds(r);
  return { ...r, x: r4(clamp(r.x + dx, Math.min(B.x0, B.x1 - r.w), Math.max(B.x0, B.x1 - r.w))), y: r4(clamp(r.y + dy, Math.min(B.y0, B.y1 - r.h), Math.max(B.y0, B.y1 - r.h))) };
}

const overlaps = (a: Rect, b: Rect) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.002 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.002;
export type Order = "forward" | "back" | "front" | "backmost";

/** Move element `idx` in the paint order (later = on top): one step past the next element it overlaps, or all the way. Returns the new list and where the element is now. */
export function reorderEl(els: CanvasEl[], idx: number, dir: Order): { els: CanvasEl[]; idx: number } {
  const me = els[idx];
  if (!me) return { els, idx };
  let to = idx;
  if (dir === "front") to = els.length - 1;
  else if (dir === "backmost") to = 0;
  else if (dir === "forward") { to = els.length - 1; for (let j = idx + 1; j < els.length; j++) { const o = els[j]!; if (o.k !== "shape" && overlaps(me, o)) { to = j; break; } } }
  else { to = 0; for (let j = idx - 1; j >= 0; j--) { const o = els[j]!; if (o.k !== "shape" && overlaps(me, o)) { to = j; break; } } }
  if (to === idx) return { els, idx };
  const next = els.slice();
  next.splice(idx, 1);
  next.splice(to, 0, me);
  return { els: next, idx: to };
}
