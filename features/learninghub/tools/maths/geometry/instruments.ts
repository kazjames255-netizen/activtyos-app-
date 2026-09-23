// Instrument geometry + snapping. Pure functions (no DOM): the board draws what these describe.
import { add, angDiff, closestOnSeg, dirOf, dirVec, dist, distToLine, lineAngDiff, mid, norm180, norm360, polar, projectOnLine, scale, sub, type Pt, type Seg } from "../../engine/geometry";
import type { InstrKind, Instrument, Mark, Tol } from "./model";

export const SIZE = {
  ruler15: { len: 150, w: 30 }, ruler30: { len: 300, w: 32 }, straightedge: { len: 200, w: 26 },
  setsquare45: { a: 100, b: 100 }, setsquare3060: { a: 104, b: 60 },
  protractor: { r: 62 }, compass: { max: 160 },
} as const;

const isBar = (k: InstrKind) => k === "ruler15" || k === "ruler30" || k === "straightedge";
const isSquare = (k: InstrKind) => k === "setsquare45" || k === "setsquare3060";
export const isProtractor = (k: InstrKind) => k === "protractor180" || k === "protractor360";

export const barLen = (k: InstrKind) => (k === "ruler15" ? SIZE.ruler15.len : k === "ruler30" ? SIZE.ruler30.len : SIZE.straightedge.len);
export const barWidth = (k: InstrKind) => (k === "ruler15" ? SIZE.ruler15.w : k === "ruler30" ? SIZE.ruler30.w : SIZE.straightedge.w);
/** Rulers show a millimetre scale; a straight edge is deliberately unmarked (pure compass-and-straightedge work). */
export const hasScale = (k: InstrKind) => k === "ruler15" || k === "ruler30";

const org = (i: Instrument): Pt => [i.x, i.y];
const u = (i: Instrument) => dirVec(i.rot);
/** The direction the body extends towards (90° anticlockwise of the baseline). */
const n = (i: Instrument) => dirVec(i.rot + 90);

/** The edges a pencil can be drawn along. The FIRST edge is the primary one (the ruler's zero-scale edge). */
export function edgesOf(i: Instrument): Seg[] {
  const o = org(i);
  if (isBar(i.kind)) {
    const L = barLen(i.kind), W = barWidth(i.kind);
    const top = add(o, scale(n(i), W));
    return [{ a: o, b: add(o, scale(u(i), L)) }, { a: top, b: add(top, scale(u(i), L)) }];
  }
  if (isSquare(i.kind)) {
    const { a, b } = i.kind === "setsquare45" ? SIZE.setsquare45 : SIZE.setsquare3060;
    const p1 = add(o, scale(u(i), a)), p2 = add(o, scale(n(i), b));
    return [{ a: o, b: p1 }, { a: o, b: p2 }, { a: p1, b: p2 }];
  }
  if (isProtractor(i.kind)) {
    const r = SIZE.protractor.r;
    return [{ a: add(o, scale(u(i), -r)), b: add(o, scale(u(i), r)) }];
  }
  return [];
}

/** Outline polygon (for drawing and hit-testing). Protractors return their bounding box; the board draws the arc itself. */
export function bodyOf(i: Instrument): Pt[] {
  const o = org(i);
  if (isBar(i.kind)) {
    const L = barLen(i.kind), W = barWidth(i.kind);
    return [o, add(o, scale(u(i), L)), add(add(o, scale(u(i), L)), scale(n(i), W)), add(o, scale(n(i), W))];
  }
  if (isSquare(i.kind)) {
    const { a, b } = i.kind === "setsquare45" ? SIZE.setsquare45 : SIZE.setsquare3060;
    return [o, add(o, scale(u(i), a)), add(o, scale(n(i), b))];
  }
  if (isProtractor(i.kind)) {
    const r = SIZE.protractor.r;
    if (i.kind === "protractor360") return [add(add(o, scale(u(i), -r)), scale(n(i), -r)), add(add(o, scale(u(i), r)), scale(n(i), -r)), add(add(o, scale(u(i), r)), scale(n(i), r)), add(add(o, scale(u(i), -r)), scale(n(i), r))];
    return [add(o, scale(u(i), -r)), add(o, scale(u(i), r)), add(add(o, scale(u(i), r)), scale(n(i), r)), add(add(o, scale(u(i), -r)), scale(n(i), r))];
  }
  return [o];
}

/** Compass pencil point. */
export const compassPen = (i: Instrument): Pt => polar(org(i), i.r ?? 60, i.pen ?? 0);

/** What a protractor reads for a ray from its centre towards `dir` (screen degrees). Both printed scales are returned.
 *  `null` = the ray is off a 180° protractor's half-disc. */
export function protractorReading(i: Instrument, dir: number): { outer: number; inner: number } | null {
  const rel = norm360(dir - i.rot);
  if (i.kind === "protractor180") {
    if (rel > 180 + 1e-9) return null;
    return { outer: rel, inner: 180 - rel };
  }
  return { outer: rel, inner: norm360(360 - rel) };
}

/** Where the pencil would meet the ruler's drawing edge, for drawing a straight line along an edge. */
export function drawAlongEdge(edge: Seg, from: Pt, to: Pt): { a: Pt; b: Pt } {
  const pa = projectOnLine(edge, from), pb = projectOnLine(edge, to);
  const cl = (t: number) => Math.max(0, Math.min(1, t));
  const at = (t: number): Pt => add(edge.a, scale(sub(edge.b, edge.a), cl(t)));
  return { a: at(pa.t), b: at(pb.t) };
}
/** The nearest edge (of any instrument) to `p`, within `within` mm, or null. */
export function nearestEdge(instruments: Instrument[], p: Pt, within: number): { edge: Seg; instrumentId: string; d: number } | null {
  let best: { edge: Seg; instrumentId: string; d: number } | null = null;
  for (const ins of instruments) for (const e of edgesOf(ins)) {
    const d = dist(closestOnSeg(e, p), p);
    if (d <= within && (!best || d < best.d)) best = { edge: e, instrumentId: ins.id, d };
  }
  return best;
}

/** Every point mark and segment end a tool may snap to. */
export function snapPoints(marks: Mark[]): Pt[] {
  const out: Pt[] = [];
  for (const m of marks) {
    if (m.k === "pt") out.push(m.p);
    else if (m.k === "seg") out.push(m.a, m.b);
    else if (m.k === "arc") out.push(polar(m.c, 0, 0));
  }
  return out;
}
export function nearestPoint(pts: Pt[], p: Pt, within: number): Pt | null {
  let best: Pt | null = null, bd = within;
  for (const q of pts) { const d = dist(p, q); if (d <= bd) { bd = d; best = q; } }
  return best;
}

/** Ruler / straight edge / set square: slide the instrument so its primary edge passes exactly through a nearby point. */
export function snapEdgeToPoints(i: Instrument, marks: Mark[], tolMm: number): Instrument {
  const e = edgesOf(i)[0];
  if (!e) return i;
  let best: { off: Pt; d: number } | null = null;
  for (const q of snapPoints(marks)) {
    const pr = projectOnLine(e, q);
    if (pr.t < -0.05 || pr.t > 1.05) continue;
    const d = dist(pr.pt, q);
    if (d <= tolMm && (!best || d < best.d)) best = { off: sub(q, pr.pt), d };
  }
  return best ? { ...i, x: i.x + best.off[0], y: i.y + best.off[1] } : i;
}

/** Protractor: put the centre on a nearby point, then turn the baseline onto a line that leaves that point. */
export function snapProtractor(i: Instrument, marks: Mark[], tol: { mm: number; deg: number }): Instrument {
  if (!isProtractor(i.kind)) return i;
  const c = nearestPoint(snapPoints(marks), [i.x, i.y], Math.max(tol.mm, 4));
  if (!c) return i;
  let out: Instrument = { ...i, x: c[0], y: c[1] };
  const maxDeg = Math.max(tol.deg, 3);
  let bestDiff = maxDeg, bestRot = i.rot;
  for (const m of marks) {
    if (m.k !== "seg") continue;
    for (const [from, to] of [[m.a, m.b], [m.b, m.a]] as const) {
      if (dist(from, c) > Math.max(tol.mm, 1.5)) continue;
      const d = dirOf(from, to);
      for (const cand of [d, norm360(d + 180)]) {
        const diff = angDiff(cand, i.rot);
        if (diff < bestDiff) { bestDiff = diff; bestRot = cand; }
      }
    }
  }
  out = { ...out, rot: bestRot };
  return out;
}

/** Set square: turn so an edge is parallel or perpendicular to a ruler / straight edge it is resting against. */
export function snapSetSquare(i: Instrument, others: Instrument[], tolDeg: number): Instrument {
  if (!isSquare(i.kind)) return i;
  const mine = edgesOf(i);
  let best: { delta: number; d: number } | null = null;
  for (const o of others) {
    if (o.id === i.id || !isBar(o.kind)) continue;
    const bar = edgesOf(o)[0]!;
    const barDir = dirOf(bar.a, bar.b);
    for (const e of mine) {
      const ed = dirOf(e.a, e.b);
      const diff = norm180(barDir - ed);
      const wrapped = ((diff % 180) + 180) % 180;
      const delta = wrapped > 90 ? wrapped - 180 : wrapped;
      if (Math.abs(delta) <= tolDeg && (!best || Math.abs(delta) < best.d)) best = { delta, d: Math.abs(delta) };
    }
  }
  return best ? { ...i, rot: norm360(i.rot + best.delta) } : i;
}

/** Compass: hold the radius; if the pencil point (or the radius) is close to an existing point, snap onto it. */
export function snapCompass(i: Instrument, marks: Mark[], tolMm: number): Instrument {
  if (i.kind !== "compass") return i;
  const pen = compassPen(i), q = nearestPoint(snapPoints(marks), pen, tolMm);
  if (q) return { ...i, r: dist(org(i), q), pen: dirOf(org(i), q) };
  return i;
}
/** Set a radius (clamped to what the legs can span). */
export const withRadius = (i: Instrument, r: number): Instrument => ({ ...i, r: Math.max(2, Math.min(SIZE.compass.max, r)) });

/** The arc a compass pencil draws while sweeping its pencil leg from direction `start` by `delta` degrees (signed, +anticlockwise). */
export function arcFromSweep(c: Pt, r: number, start: number, delta: number): { c: Pt; r: number; a0: number; a1: number } {
  const d = Math.max(-360, Math.min(360, delta));
  return d >= 0 ? { c, r, a0: norm360(start), a1: norm360(start) + d } : { c, r, a0: norm360(start + d), a1: norm360(start + d) - d };
}

/** New instrument at a sensible default place on the paper. */
export function makeInstrument(kind: InstrKind, id: string, at: Pt = [30, 90]): Instrument {
  const base = { id, kind, x: at[0], y: at[1], rot: 0 };
  return kind === "compass" ? { ...base, r: 40, pen: 0 } : base;
}

export { mid, distToLine, lineAngDiff };
export type { Tol };
