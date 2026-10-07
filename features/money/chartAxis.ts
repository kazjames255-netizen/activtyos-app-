// Pure helpers for the money bar charts (no React, no DOM): a "nice" value axis, thinned month labels, and bar heights.
// Presentation only: the figures themselves come from the finance screens untouched.

/** Round a step up to a "nice" 1 / 2 / 2.5 / 5 x 10^k number. */
export function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exp);
  const f = raw / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return Math.round(nice * base * 1e6) / 1e6;
}

/** Axis ticks from 0 up to a nice maximum that covers `max`. Always at least [0, step]; `count` is the wanted number of gridlines above zero. */
export function niceTicks(max: number, count = 4): { ticks: number[]; top: number; step: number } {
  const m = max > 0 && Number.isFinite(max) ? max : 1;
  const step = niceStep(m / Math.max(1, count));
  const n = Math.max(1, Math.ceil(m / step - 1e-9));
  const ticks = Array.from({ length: n + 1 }, (_, i) => Math.round(i * step * 1e6) / 1e6);
  return { ticks, top: ticks[ticks.length - 1], step };
}

/** Compact £ label for an axis tick: whole pounds when the step allows, pence only when the step is below £1, k above a thousand. */
export function axisLabel(v: number, step: number): string {
  if (v === 0) return "£0";
  if (Math.abs(v) >= 1000) return `£${Math.round((v / 1000) * 10) / 10}k`;
  return step < 1 ? `£${v.toFixed(2)}` : `£${Math.round(v * 100) / 100}`;
}

/** Which of `n` category labels to print so they never collide: always the first and last, evenly spaced between, at most `maxLabels`. */
export function thinLabels(n: number, maxLabels: number): Set<number> {
  const out = new Set<number>();
  if (n <= 0) return out;
  const cap = Math.max(2, Math.floor(maxLabels));
  if (n <= cap) { for (let i = 0; i < n; i++) out.add(i); return out; }
  const stride = Math.ceil((n - 1) / (cap - 1));
  for (let i = 0; i < n; i += stride) out.add(i);
  out.add(n - 1);
  // The last label must not sit right next to the one before it: drop that one when the gap is too small.
  const sorted = [...out].sort((a, b) => a - b);
  if (sorted.length >= 3 && sorted[sorted.length - 1] - sorted[sorted.length - 2] < stride / 2) out.delete(sorted[sorted.length - 2]);
  return out;
}

/** Bar height in px for a value: proportional, but any non-zero value is at least `minPx` tall so it never reads as an empty month; zero is 0 (drawn as a dash instead). */
export function barPx(value: number, top: number, plotPx: number, minPx = 4): number {
  if (!(value > 0) || !(top > 0)) return 0;
  return Math.max(minPx, Math.round((value / top) * plotPx));
}

/** Month label: "Oct", with the year added ("Jan 26") on January and on the first column so a long range reads clearly. */
export function monthAxisLabel(monthShort: string, monthIndex: number, yearFull: number, isFirst: boolean): { main: string; year?: string } {
  const yy = String(yearFull).slice(-2);
  return monthIndex === 0 || isFirst ? { main: monthShort, year: `'${yy}` } : { main: monthShort };
}

/** How many labels fit in `widthPx` of plot, at roughly `perLabelPx` each (phones therefore thin to about every second month). */
export function maxLabelsFor(widthPx: number, perLabelPx = 46): number {
  return Math.max(2, Math.floor(widthPx / perLabelPx));
}
