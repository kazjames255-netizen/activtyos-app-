// Pure maths for the results-table-and-graph tool (S-02; also maths chart building M-60/M-61). No React, no DOM.
import { combine, type CheckResult } from "../../engine/marking";

export type Pt = [number, number];
export type ChartType = "scatter" | "line" | "bar";

const EPS = 1e-9;
/** Remove floating-point dust (0.30000000000000004 -> 0.3). */
export const clean = (v: number, dp = 10) => { const r = Number(v.toFixed(dp)); return Object.is(r, -0) ? 0 : r; };

// ---------- nice scales ----------
export interface Scale { min: number; max: number; step: number; ticks: number[] }
/** Nice axis: step is 1, 2 or 5 x 10^n. `includeZero` stretches the range to reach 0. */
export function niceScale(min: number, max: number, targetTicks = 6, includeZero = false): Scale {
  let lo = Math.min(min, max), hi = Math.max(min, max);
  if (includeZero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (hi - lo < EPS) { const pad = Math.abs(hi) > EPS ? Math.abs(hi) * 0.5 : 1; lo -= pad; hi += pad; if (includeZero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); } }
  const raw = (hi - lo) / Math.max(1, targetTicks);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / mag;
  const step = clean((f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag);
  const dp = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  const a = clean(Math.floor(lo / step + EPS) * step, dp), b = clean(Math.ceil(hi / step - EPS) * step, dp);
  const ticks: number[] = [];
  for (let i = 0; a + i * step <= b + step * 1e-6; i++) ticks.push(clean(a + i * step, dp));
  return { min: a, max: b, step, ticks };
}
/** Linear map of v from [d0,d1] to [p0,p1]. */
export const linMap = (v: number, d0: number, d1: number, p0: number, p1: number) => (d1 === d0 ? p0 : p0 + ((v - d0) / (d1 - d0)) * (p1 - p0));
/** value -> pixel (y inverted for SVG: pass p0 = bottom px, p1 = top px). */
export const toPixel = (v: number, s: Scale, p0: number, p1: number) => linMap(v, s.min, s.max, p0, p1);
export const fromPixel = (px: number, s: Scale, p0: number, p1: number) => linMap(px, p0, p1, s.min, s.max);
/** Snap to the nearest multiple of `step`. */
export const snapTo = (v: number, step: number) => clean(Math.round(v / step) * step);

// ---------- statistics ----------
export const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
export function median(xs: number[]) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}
/** All most-frequent values; [] when every value is different (no mode). */
export function mode(xs: number[]): number[] {
  const c = new Map<number, number>(); for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  const top = Math.max(0, ...c.values());
  if (top <= 1) return [];
  return [...c.entries()].filter(([, n]) => n === top).map(([v]) => v).sort((a, b) => a - b);
}
export const range = (xs: number[]) => (xs.length ? Math.max(...xs) - Math.min(...xs) : NaN);

// ---------- regression ----------
export interface Fit { gradient: number; intercept: number; r2: number; n: number }
/** Least-squares line. `throughOrigin` forces c = 0 (r² then measured about the mean, so it can be low for a poor origin fit). */
export function regression(pts: Pt[], throughOrigin = false): Fit | null {
  const n = pts.length; if (n < 2) return null;
  const mx = mean(pts.map((p) => p[0])), my = mean(pts.map((p) => p[1]));
  let m: number, c: number;
  if (throughOrigin) {
    const sxx = pts.reduce((s, p) => s + p[0] * p[0], 0); if (sxx < EPS) return null;
    m = pts.reduce((s, p) => s + p[0] * p[1], 0) / sxx; c = 0;
  } else {
    const sxx = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0); if (sxx < EPS) return null;
    m = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / sxx; c = my - m * mx;
  }
  const ssTot = pts.reduce((s, p) => s + (p[1] - my) ** 2, 0), ssRes = pts.reduce((s, p) => s + (p[1] - (m * p[0] + c)) ** 2, 0);
  const r2 = ssTot < EPS ? 1 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));
  return { gradient: m, intercept: c, r2, n };
}
export const lineY = (f: { gradient: number; intercept: number }, x: number) => f.gradient * x + f.intercept;
/** Two end points of the fitted line across [x0,x1] (for drawing). */
export const fitSegment = (f: Fit, x0: number, x1: number): [Pt, Pt] => [[x0, lineY(f, x0)], [x1, lineY(f, x1)]];
/** Gradient and intercept of the line through two points (a pupil's hand-drawn line). null if vertical. */
export function lineThrough(a: Pt, b: Pt): { gradient: number; intercept: number } | null {
  if (Math.abs(b[0] - a[0]) < EPS) return null;
  const m = (b[1] - a[1]) / (b[0] - a[0]); return { gradient: m, intercept: a[1] - m * a[0] };
}

// ---------- repeats and anomalies ----------
export interface Row { x: number; reps: number[] }
/** Repeat readings that sit far from the others in the same row: distance from the median of the OTHER readings must exceed
 *  max(2.5 x their spread, 6% of that median). Needs >= 3 readings in the row. Returns [rowIndex, repIndex] pairs. */
export function repeatAnomalies(rows: Row[]): [number, number][] {
  const out: [number, number][] = [];
  rows.forEach((r, i) => {
    if (r.reps.length < 3) return;
    r.reps.forEach((v, j) => {
      const rest = r.reps.filter((_, k) => k !== j), med = median(rest);
      if (Math.abs(v - med) > Math.max(2.5 * range(rest), 0.06 * Math.abs(med), EPS)) out.push([i, j]);
    });
  });
  return out;
}
/** Mean of each row (optionally leaving out flagged readings) as plot points. */
export function groupedMeans(rows: Row[], excludeAnomalies = true): Pt[] {
  const bad = new Set(excludeAnomalies ? repeatAnomalies(rows).map(([i, j]) => `${i}:${j}`) : []);
  const pts: Pt[] = [];
  rows.forEach((r, i) => { const v = r.reps.filter((_, j) => !bad.has(`${i}:${j}`)); if (v.length) pts.push([r.x, mean(v)]); });
  return pts;
}
/** Points far from a straight-line trend: leave-one-out, so a wild point cannot hide by dragging the line towards itself.
 *  Flags a point whose residual exceeds k x the residual SD of the OTHER points (SD floored at 2% of the y range). Returns indexes. */
export function trendAnomalies(pts: Pt[], k = 3): number[] {
  if (pts.length < 5) return [];
  const yr = range(pts.map((p) => p[1])), floor = Math.max(0.02 * yr, EPS), out: number[] = [];
  pts.forEach((p, i) => {
    const rest = pts.filter((_, j) => j !== i), f = regression(rest); if (!f) return;
    const sd = Math.sqrt(rest.reduce((s, q) => s + (q[1] - lineY(f, q[0])) ** 2, 0) / Math.max(1, rest.length - 2));
    if (Math.abs(p[1] - lineY(f, p[0])) > k * Math.max(sd, floor)) out.push(i);
  });
  return out;
}

// ---------- chart helpers ----------
/** Axis scales for a chart. Bars always start at zero on y. */
export function chartScales(pts: Pt[], type: ChartType, zero = true): { x: Scale; y: Scale } {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  if (!pts.length) return { x: niceScale(0, 10, 5), y: niceScale(0, 10, 5) };
  return {
    x: type === "bar" ? { min: 0, max: pts.length, step: 1, ticks: pts.map((_, i) => i) } : niceScale(Math.min(...xs), Math.max(...xs), 6, zero),
    y: niceScale(Math.min(...ys), Math.max(...ys), 6, zero || type === "bar"),
  };
}
/** Bar centres and width for `n` bars across `plotW` px. */
export function barGeometry(n: number, plotW: number, gap = 0.3) {
  const slot = n ? plotW / n : plotW, w = slot * (1 - gap);
  return { width: w, centres: Array.from({ length: n }, (_, i) => slot * (i + 0.5)) };
}
/** SVG path through pixel points, left to right. */
export const linePath = (px: Pt[]) => [...px].sort((a, b) => a[0] - b[0]).map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

// ---------- pupil-graph checkers ----------
export interface Tol { x: number; y: number }
/** 1 mark per expected point: a pupil point must lie within tolerance (data units) of it. Feedback names the row, never the coordinates. */
export function checkPlotted(points: Pt[], expected: Pt[], tol: Tol): CheckResult {
  const used = new Set<number>(), ok: boolean[] = [], note: (string | undefined)[] = [];
  const near = (a: Pt, b: Pt, k: number) => Math.abs(a[0] - b[0]) <= tol.x * k + EPS && Math.abs(a[1] - b[1]) <= tol.y * k + EPS;
  const dist = (a: Pt, b: Pt) => Math.hypot((a[0] - b[0]) / tol.x, (a[1] - b[1]) / tol.y);
  expected.forEach((e, i) => {
    let best = -1, bd = Infinity;
    points.forEach((p, j) => { if (used.has(j) || !near(p, e, 1)) return; const d = dist(p, e); if (d < bd) { bd = d; best = j; } });
    if (best >= 0) { used.add(best); ok[i] = true; return; }
    ok[i] = false;
    note[i] = points.some((p, j) => !used.has(j) && near(p, e, 3)) ? "there is a point close by, but not on the right square" : "not plotted yet";
  });
  // a second pass frees points that were greedily taken by a neighbour but are still needed: rare with sensible tolerances, so keep it simple
  const res = combine(expected.map((_, i) => ({ label: `Point ${i + 1} of your table`, ok: ok[i]!, marks: 1, note: note[i] })));
  const extra = points.length - used.size;
  if (extra > 0) res.feedback.push(`You have ${extra} point${extra === 1 ? "" : "s"} that ${extra === 1 ? "does" : "do"} not match any reading. Check or rub ${extra === 1 ? "it" : "them"} out.`);
  res.log = { ...res.log, plotted: points.length, expected: expected.length, matched: used.size, extra, missing: ok.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0) };
  return res;
}

/** 2 marks: gradient and intercept of the pupil's line each within tolerancePct of the regression line.
 *  Gradient is compared relatively; the intercept against max(|c|, 10% of the y range) so a near-zero intercept is fair. */
export function checkBestFit(line: { gradient: number; intercept: number } | null, data: Pt[], tolerancePct: number, throughOrigin = false): CheckResult {
  const f = regression(data, throughOrigin), t = tolerancePct / 100;
  if (!f) return { score: 0, max: 2, feedback: ["✗ Not enough data to fit a line"], log: { reason: "no-fit" } };
  if (!line) return combine([{ label: "Gradient of your line", ok: false, marks: 1, note: "no line drawn" }, { label: "Where your line crosses the y-axis", ok: false, marks: 1, note: "no line drawn" }]);
  const yr = range(data.map((p) => p[1])), gTol = t * Math.max(Math.abs(f.gradient), EPS), cTol = t * Math.max(Math.abs(f.intercept), 0.1 * yr);
  const gOk = Math.abs(line.gradient - f.gradient) <= gTol, cOk = Math.abs(line.intercept - f.intercept) <= cTol;
  const dir = (a: number, b: number) => (a > b ? "too steep" : "not steep enough");
  const r = combine([
    { label: "Gradient of your line", ok: gOk, marks: 1, note: gOk ? undefined : Math.sign(line.gradient) !== Math.sign(f.gradient) ? "your line slopes the wrong way" : dir(line.gradient, f.gradient) },
    { label: "Where your line crosses the y-axis", ok: cOk, marks: 1, note: cOk ? undefined : line.intercept > f.intercept ? "too high up" : "too low down" },
  ]);
  r.log = { ...r.log, gradient: line.gradient, intercept: line.intercept, expected: f };
  return r;
}

export interface AxesSpec {
  xLabel: string; xUnit: string; yLabel: string; yUnit: string;
  xTicks: number[]; yTicks: number[];
  xData: [number, number]; yData: [number, number];   // min & max of the data to be plotted
  needUnits?: boolean;
}
const evenTicks = (t: number[]) => { if (t.length < 3) return false; const d = t[1]! - t[0]!; return d > 0 && t.every((v, i) => i === 0 || Math.abs(v - t[i - 1]! - d) <= Math.abs(d) * 1e-6); };
const usesGrid = (t: number[], d: [number, number]) => {
  if (t.length < 2) return false; const lo = Math.min(...t), hi = Math.max(...t);
  return hi > lo && d[0] >= lo - EPS && d[1] <= hi + EPS && (d[1] - d[0]) / (hi - lo) >= 0.5 - EPS;
};
/** 4 marks: both axes labelled; units given; scale uses at least half the grid (and fits the data); even intervals. */
export function checkAxes(a: AxesSpec): CheckResult {
  const has = (s: string) => s.trim().length > 0, needU = a.needUnits !== false;
  const gx = usesGrid(a.xTicks, a.xData), gy = usesGrid(a.yTicks, a.yData);
  return combine([
    { label: "Both axes have a label", ok: has(a.xLabel) && has(a.yLabel), marks: 1, note: !has(a.xLabel) && !has(a.yLabel) ? "neither axis is labelled" : !has(a.xLabel) ? "the x-axis has no label" : !has(a.yLabel) ? "the y-axis has no label" : undefined },
    { label: "Units are shown", ok: !needU || (has(a.xUnit) && has(a.yUnit)), marks: 1, note: needU && !(has(a.xUnit) && has(a.yUnit)) ? "add the unit to each axis label" : undefined },
    { label: "The scale makes good use of the grid", ok: gx && gy, marks: 1, note: gx && gy ? undefined : `${!gx ? "x-axis" : ""}${!gx && !gy ? " and " : ""}${!gy ? "y-axis" : ""}: the data should fill at least half the axis and fit on it` },
    { label: "Scale goes up in even steps", ok: evenTicks(a.xTicks) && evenTicks(a.yTicks), marks: 1, note: evenTicks(a.xTicks) && evenTicks(a.yTicks) ? undefined : "each axis needs equal-sized steps" },
  ]);
}
