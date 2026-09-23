// Deterministic checkers for the geometry board (plan M-07 + the generators' answers).
// Each returns {score,max,feedback[],log} so a tutor can see WHY. Checkers read only the student's OWN marks (given:true is ignored)
// and take their parameters as plain JSON so an attempt can be re-marked later from (checkerId, params, finalState).
import { angDiff, bearingOf, bisectorDir, dirOf, dist, distToLine, fmt3, interiorAngle, lineAngDiff, mid, norm360, projectOnLine, round, sub, unit, type Pt, type Seg } from "../../engine/geometry";
import { combine, type CheckResult } from "../../engine/marking";
import type { Mark, Tol } from "./model";

type SegM = Extract<Mark, { k: "seg" }>;
type ArcM = Extract<Mark, { k: "arc" }>;
type PtM = Extract<Mark, { k: "pt" }>;

const MIN_LINE = 12; // mm — anything shorter is a dot, not a construction line
const own = (marks: Mark[]) => marks.filter((m) => !("given" in m && m.given));
export const studentSegs = (marks: Mark[]): SegM[] => own(marks).filter((m): m is SegM => m.k === "seg" && dist(m.a, m.b) >= MIN_LINE);
const studentArcs = (marks: Mark[]): ArcM[] => own(marks).filter((m): m is ArcM => m.k === "arc");
const dirSeg = (s: SegM) => dirOf(s.a, s.b);
const asSeg = (s: SegM): Seg => ({ a: s.a, b: s.b });
const mm = (n: number) => `${round(n, 1)} mm`;
const dg = (n: number) => `${round(n, 1)}°`;

/** Numeric answer (e.g. "the angle is 68°"). */
export function checkNumeric(answer: number | null | undefined, expected: number, tol: number, unitLabel = ""): CheckResult {
  if (answer == null || !Number.isFinite(answer)) return combine([{ label: "Give an answer", ok: false, marks: 1 }]);
  const diff = Math.abs(answer - expected);
  return combine([{ label: `Answer within ±${tol}${unitLabel}`, ok: diff <= tol + 1e-9, marks: 1, note: diff <= tol + 1e-9 ? undefined : `you gave ${round(answer, 1)}${unitLabel}` }]);
}

/** Perpendicular bisector of A→B: a line through the midpoint at right angles; optionally two equal arcs centred on A and B. */
export function checkPerpBisector(marks: Mark[], A: Pt, B: Pt, tol: Tol, requireArcs = true): CheckResult {
  const ab = dirOf(A, B), m = mid(A, B);
  let best: { angOff: number; offMid: number } | null = null;
  for (const s of studentSegs(marks)) {
    const angOff = Math.abs(lineAngDiff(dirSeg(s), ab) - 90), offMid = distToLine(asSeg(s), m);
    if (!best || angOff + offMid < best.angOff + best.offMid) best = { angOff, offMid };
  }
  const lineOk = !!best && best.angOff <= tol.deg && best.offMid <= tol.mm;
  const parts: Parameters<typeof combine>[0] = [{
    label: "A straight line at right angles to AB through its midpoint", ok: lineOk, marks: 2,
    note: !best ? "no line drawn" : lineOk ? undefined : `${dg(best.angOff)} off square, ${mm(best.offMid)} from the midpoint`,
  }];
  if (requireArcs) {
    const arcs = studentArcs(marks), half = dist(A, B) / 2 - tol.mm;
    const onA = arcs.filter((a) => dist(a.c, A) <= tol.mm && a.r >= half), onB = arcs.filter((a) => dist(a.c, B) <= tol.mm && a.r >= half);
    const equal = onA.some((a) => onB.some((b) => Math.abs(a.r - b.r) <= tol.mm));
    parts.push({ label: "Construction arcs from A and B with the same radius (more than half of AB)", ok: equal, marks: 1, note: equal ? undefined : onA.length && onB.length ? "the two radii differ" : "arcs missing" });
  }
  return combine(parts);
}

/** Bisector of angle A-O-B: a ray from O along the middle; optionally an arc centred on O. */
export function checkAngleBisector(marks: Mark[], O: Pt, A: Pt, B: Pt, tol: Tol, requireArcs = true): CheckResult {
  const want = bisectorDir(O, A, B);
  let best: number | null = null;
  for (const s of studentSegs(marks)) {
    for (const [from, to] of [[s.a, s.b], [s.b, s.a]] as const) {
      if (dist(from, O) > tol.mm + 1) continue;
      const off = angDiff(dirOf(from, to), want);
      if (best == null || off < best) best = off;
    }
  }
  const ok = best != null && best <= tol.deg;
  const parts: Parameters<typeof combine>[0] = [{ label: "A line from the corner that splits the angle in half", ok, marks: 2, note: best == null ? "no line starts at the corner" : ok ? undefined : `${dg(best)} out` }];
  if (requireArcs) {
    const arcs = studentArcs(marks).filter((a) => dist(a.c, O) <= tol.mm);
    parts.push({ label: "Construction arc(s) centred on the corner", ok: arcs.length > 0, marks: 1 });
  }
  return combine(parts);
}

/** A line through P at right angles to line L (P on L or off it). */
export function checkPerpendicular(marks: Mark[], L: Seg, P: Pt, tol: Tol, requireArcs = false): CheckResult {
  const ld = dirOf(L.a, L.b);
  let best: { angOff: number; offP: number } | null = null;
  for (const s of studentSegs(marks)) {
    const angOff = Math.abs(lineAngDiff(dirSeg(s), ld) - 90), offP = distToLine(asSeg(s), P);
    if (!best || angOff + offP < best.angOff + best.offP) best = { angOff, offP };
  }
  const ok = !!best && best.angOff <= tol.deg && best.offP <= tol.mm;
  const parts: Parameters<typeof combine>[0] = [{ label: "A line through the point at right angles to the given line", ok, marks: 2, note: !best ? "no line drawn" : ok ? undefined : `${dg(best.angOff)} off square, ${mm(best.offP)} from the point` }];
  if (requireArcs) parts.push({ label: "Construction arcs shown", ok: studentArcs(marks).length >= 2, marks: 1 });
  return combine(parts);
}

/** Every closed triangle the student has drawn: three corners each joined by a drawn line. Returns side lengths and corner points. */
export function drawnTriangles(marks: Mark[], tolMm: number): { pts: [Pt, Pt, Pt]; sides: [number, number, number] }[] {
  const segs = studentSegs(marks), nodes: Pt[] = [];
  const nodeOf = (p: Pt) => { let i = nodes.findIndex((q) => dist(p, q) <= tolMm * 1.5 + 0.5); if (i < 0) { nodes.push(p); i = nodes.length - 1; } return i; };
  const adj = new Map<string, Seg>();
  for (const s of segs) { const a = nodeOf(s.a), b = nodeOf(s.b); if (a !== b) adj.set(a < b ? `${a}-${b}` : `${b}-${a}`, asSeg(s)); }
  const has = (a: number, b: number) => adj.get(a < b ? `${a}-${b}` : `${b}-${a}`);
  const out: { pts: [Pt, Pt, Pt]; sides: [number, number, number] }[] = [];
  for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) for (let c = b + 1; c < nodes.length; c++) {
    if (has(a, b) && has(b, c) && has(a, c)) {
      const P = nodes[a]!, Q = nodes[b]!, R = nodes[c]!;
      out.push({ pts: [P, Q, R], sides: [dist(P, Q), dist(Q, R), dist(P, R)] });
    }
  }
  return out;
}

export type TriangleSpec =
  | { kind: "sss"; sides: [number, number, number] }
  | { kind: "sas"; a: number; angle: number; b: number }
  | { kind: "asa"; angle1: number; side: number; angle2: number }
  | { kind: "rhs"; hyp: number; side: number };

/** The three side lengths a spec describes (sorted). */
export function specSides(spec: TriangleSpec): [number, number, number] {
  const r = (x: number) => (x * Math.PI) / 180;
  let s: [number, number, number];
  if (spec.kind === "sss") s = spec.sides;
  else if (spec.kind === "sas") s = [spec.a, spec.b, Math.sqrt(spec.a ** 2 + spec.b ** 2 - 2 * spec.a * spec.b * Math.cos(r(spec.angle)))];
  else if (spec.kind === "rhs") s = [spec.side, Math.sqrt(Math.max(0, spec.hyp ** 2 - spec.side ** 2)), spec.hyp];
  else {
    const third = 180 - spec.angle1 - spec.angle2, k = spec.side / Math.sin(r(third));
    s = [spec.side, k * Math.sin(r(spec.angle2)), k * Math.sin(r(spec.angle1))];
  }
  return [...s].sort((a, b) => a - b) as [number, number, number];
}

/** A drawn triangle congruent to the specified one (sides match within tolerance). Construction arcs earn a further mark when required. */
export function checkTriangle(marks: Mark[], spec: TriangleSpec, tol: Tol, requireArcs = true): CheckResult {
  const want = specSides(spec);
  let bestErr = Infinity, bestSides: number[] | null = null;
  for (const t of drawnTriangles(marks, tol.mm)) {
    const s = [...t.sides].sort((a, b) => a - b);
    const err = Math.max(...s.map((v, i) => Math.abs(v - want[i]!)));
    if (err < bestErr) { bestErr = err; bestSides = s; }
  }
  const ok = bestErr <= tol.mm + 1e-9;
  const parts: Parameters<typeof combine>[0] = [{
    label: `A closed triangle with sides ${want.map((v) => round(v, 1)).join(", ")} mm`, ok, marks: 3,
    note: bestSides == null ? "no closed triangle found" : ok ? undefined : `your sides: ${bestSides.map((v) => round(v, 1)).join(", ")} mm`,
  }];
  if (requireArcs) parts.push({ label: "Construction arcs shown", ok: studentArcs(marks).length >= 2, marks: 1 });
  return combine(parts);
}

/** Draw an angle of `target` degrees at O from a base ray pointing along `baseDir` (either side unless `side` is fixed). */
export function checkAngleConstruct(marks: Mark[], O: Pt, baseDir: number, target: number, tol: Tol, side: "any" | "left" | "right" = "any", requireArcs = false): CheckResult {
  let best: number | null = null;
  for (const s of studentSegs(marks)) {
    for (const [from, to] of [[s.a, s.b], [s.b, s.a]] as const) {
      if (dist(from, O) > tol.mm + 1) continue;
      const rel = norm360(dirOf(from, to) - baseDir);            // anticlockwise from the base ray
      const cands = side === "left" ? [target] : side === "right" ? [norm360(-target)] : [target, norm360(-target)];
      for (const c of cands) { const off = angDiff(rel, c); if (best == null || off < best) best = off; }
    }
  }
  const ok = best != null && best <= tol.deg;
  const parts: Parameters<typeof combine>[0] = [{ label: `A line from the point making ${target}° with the base line`, ok, marks: 2, note: best == null ? "no line starts at the point" : ok ? undefined : `${dg(best)} out` }];
  if (requireArcs) parts.push({ label: "Construction arcs shown", ok: studentArcs(marks).some((a) => dist(a.c, O) <= tol.mm) || studentArcs(marks).length >= 2, marks: 1 });
  return combine(parts);
}

/** Locus: every point a fixed distance from P — an (almost) complete circle centred on P with the right radius. */
export function checkLocusCircle(marks: Mark[], P: Pt, r: number, tol: Tol, minSweep = 300): CheckResult {
  let best: { rErr: number; sweep: number } | null = null;
  for (const a of studentArcs(marks)) {
    if (dist(a.c, P) > tol.mm) continue;
    const cand = { rErr: Math.abs(a.r - r), sweep: a.a1 - a.a0 };
    if (!best || (cand.rErr <= tol.mm && cand.sweep > best.sweep) || (best.rErr > tol.mm && cand.rErr < best.rErr)) best = cand;
  }
  const rOk = !!best && best.rErr <= tol.mm, sweepOk = !!best && best.sweep >= minSweep;
  return combine([
    { label: `A circle centred on the point with radius ${round(r, 1)} mm`, ok: rOk, marks: 1, note: !best ? "no arc centred on the point" : rOk ? undefined : `your radius is ${mm(Math.abs(best.rErr) + r)} vs ${mm(r)}` },
    { label: "Drawn all the way round", ok: rOk && sweepOk, marks: 1, note: rOk && !sweepOk ? "the arc stops short of a full circle" : undefined },
  ]);
}

/** Locus: points a fixed distance d from a line — two parallel lines, one each side. */
export function checkParallelLoci(marks: Mark[], L: Seg, d: number, tol: Tol): CheckResult {
  const ld = dirOf(L.a, L.b);
  let sideA = false, sideB = false;
  for (const s of studentSegs(marks)) {
    if (lineAngDiff(dirSeg(s), ld) > tol.deg) continue;
    const mp = mid(s.a, s.b), pr = projectOnLine(L, mp), off = dist(mp, pr.pt);
    if (Math.abs(off - d) > tol.mm) continue;
    const cross = (L.b[0] - L.a[0]) * (mp[1] - L.a[1]) - (L.b[1] - L.a[1]) * (mp[0] - L.a[0]);
    if (cross > 0) sideA = true; else sideB = true;
  }
  return combine([{ label: `A line ${round(d, 1)} mm from the given line on one side`, ok: sideA, marks: 1 }, { label: "…and another on the other side", ok: sideB, marks: 1 }]);
}

/** Plotted points: each expected point has a student point within tolerance (units are grid units, tol in the same units). */
export function checkPoints(plotted: Pt[], expected: Pt[], tol: number): CheckResult {
  const used = new Set<number>();
  const parts = expected.map((e) => {
    let hit = -1, bd = tol + 1e-9;
    plotted.forEach((p, i) => { const d = dist(p, e); if (!used.has(i) && d <= bd) { bd = d; hit = i; } });
    if (hit >= 0) used.add(hit);
    return { label: `Point (${round(e[0], 1)}, ${round(e[1], 1)}) plotted`, ok: hit >= 0, marks: 1 };
  });
  return combine(parts);
}

/** Draw a line from A on a given 3-figure bearing (optionally a given length). */
export function checkBearingLine(marks: Mark[], A: Pt, bearing: number, length: number | null, tol: Tol): CheckResult {
  let best: { off: number; len: number } | null = null;
  for (const s of studentSegs(marks)) {
    for (const [from, to] of [[s.a, s.b], [s.b, s.a]] as const) {
      if (dist(from, A) > tol.mm + 1) continue;
      const off = angDiff(bearingOf(from, to), bearing);
      if (!best || off < best.off) best = { off, len: dist(from, to) };
    }
  }
  const angOk = !!best && best.off <= tol.deg;
  const parts: Parameters<typeof combine>[0] = [{ label: `A line from A on a bearing of ${fmt3(bearing)}`, ok: angOk, marks: 2, note: !best ? "no line starts at A" : angOk ? undefined : `${dg(best.off)} out` }];
  if (length != null) parts.push({ label: `Length ${round(length, 1)} mm`, ok: angOk && !!best && Math.abs(best.len - length) <= tol.mm, marks: 1 });
  return combine(parts);
}

/** Dispatch by id — so an attempt can be re-marked from stored (checkerId, params) with the tenant's tolerances. */
export interface Answer { number?: number | null; marks?: Mark[]; points?: Pt[] }
export type CheckerId = "numeric" | "perpBisector" | "angleBisector" | "perpendicular" | "triangle" | "angleConstruct" | "locusCircle" | "parallelLoci" | "points" | "bearingLine";
export function runChecker(id: CheckerId, p: Record<string, unknown>, a: Answer, tol: Tol): CheckResult {
  const marks = a.marks ?? [], pt = (v: unknown) => v as Pt;
  switch (id) {
    case "numeric": return checkNumeric(a.number, p.expected as number, (p.tolerance as number) ?? tol.deg, (p.unit as string) ?? "");
    case "perpBisector": return checkPerpBisector(marks, pt(p.A), pt(p.B), tol, p.requireArcs !== false);
    case "angleBisector": return checkAngleBisector(marks, pt(p.O), pt(p.A), pt(p.B), tol, p.requireArcs !== false);
    case "perpendicular": return checkPerpendicular(marks, { a: pt(p.La), b: pt(p.Lb) }, pt(p.P), tol, p.requireArcs === true);
    case "triangle": return checkTriangle(marks, p.spec as TriangleSpec, tol, p.requireArcs !== false);
    case "angleConstruct": return checkAngleConstruct(marks, pt(p.O), p.baseDir as number, p.target as number, tol, (p.side as "any") ?? "any", p.requireArcs === true);
    case "locusCircle": return checkLocusCircle(marks, pt(p.P), p.r as number, tol, (p.minSweep as number) ?? 300);
    case "parallelLoci": return checkParallelLoci(marks, { a: pt(p.La), b: pt(p.Lb) }, p.d as number, tol);
    case "points": return checkPoints(a.points ?? [], p.expected as Pt[], (p.tolerance as number) ?? 0.25);
    case "bearingLine": return checkBearingLine(marks, pt(p.A), p.bearing as number, (p.length as number | null) ?? null, tol);
  }
}
export { interiorAngle, sub, unit };
export type { PtM };
