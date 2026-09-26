// Pure coordinate-grid axis logic (no DOM): frame the grid to a question's own coordinates, and zoom. Never plots or transforms anything for the child.
import { niceStep, parseNumbers } from "../numberline/range";

export interface GridAxes { min: number; max: number; step: number }
export const DEFAULT_AXES: GridAxes = { min: -10, max: 10, step: 1 };

/** Fit square axes (same range both ways, always including 0) to every number the question mentions. Null when it mentions none. */
export function suggestGridAxes(prompt: string): GridAxes | null {
  // A question about lines / equations (y = 4x, y = x − 9): where things meet is the answer, so don't guess a frame from the numbers — keep the default axes.
  if (/\by\s*=|\bx\s*[+−-]\s*\d|equation of|intersect/i.test(prompt)) return null;
  const nums = parseNumbers(prompt).slice(0, 24);
  if (!nums.length) return null;
  const lo = Math.min(0, ...nums), hi = Math.max(0, ...nums);
  const span = Math.max(hi - lo, 4);
  const step = niceStep(span, 10);
  let min = Math.floor(lo / step) * step - (lo < 0 ? step : 0), max = Math.ceil(hi / step) * step + (hi > 0 ? step : 0);
  // Square, and never a huge grid: a whole-number range of at most 40 steps.
  const half = Math.max(Math.abs(min), Math.abs(max));
  if (lo < 0 && hi > 0) { min = -half; max = half; } else if (lo >= 0) { min = 0; max = Math.max(max, step * 4); } else { max = 0; min = Math.min(min, -step * 4); }
  if ((max - min) / step > 40) return null;
  return { min: Number(min.toPrecision(12)), max: Number(max.toPrecision(12)), step };
}

/** Zoom about the middle: factor < 1 zooms in, > 1 out. Keeps 0 on the grid when it was. */
export function zoomGrid(a: GridAxes, factor: number): GridAxes {
  const mid = (a.min + a.max) / 2, half = ((a.max - a.min) / 2) * factor, step = niceStep(half * 2, 10);
  let min = Math.floor((mid - half) / step) * step, max = Math.ceil((mid + half) / step) * step;
  if (a.min <= 0 && a.max >= 0) { min = Math.min(min, 0); max = Math.max(max, 0); }
  return { min: Number(min.toPrecision(12)), max: Number(max.toPrecision(12)), step };
}

/** Where a straight line through two points meets the axes' square (for the "extend the line" option); null for identical points. */
type P = readonly [number, number];
export function extendLine(a: P, b: P, ax: GridAxes): [P, P] | null {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return null;
  const ts: number[] = [];
  if (dx !== 0) { ts.push((ax.min - a[0]) / dx, (ax.max - a[0]) / dx); }
  if (dy !== 0) { ts.push((ax.min - a[1]) / dy, (ax.max - a[1]) / dy); }
  const pts = ts.map((t): P => [a[0] + t * dx, a[1] + t * dy]).filter((p) => p[0] >= ax.min - 1e-9 && p[0] <= ax.max + 1e-9 && p[1] >= ax.min - 1e-9 && p[1] <= ax.max + 1e-9);
  if (pts.length < 2) return null;
  pts.sort((p, q) => (p[0] - q[0]) || (p[1] - q[1]));
  return [pts[0]!, pts[pts.length - 1]!];
}
