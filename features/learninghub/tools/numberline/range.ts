// Pure number-line range logic (no DOM). Fits a line to a QUESTION's own numbers so the child doesn't retype start/end/step every time — it only frames the
// numbers the question mentions and what they can add/subtract to; it never marks or reveals an answer.

export interface NlRange { start: number; end: number; step: number }

/** Every number written in the text (handles −/-, thousands commas, decimals; ignores a trailing degree/℃/% sign). */
export function parseNumbers(text: string): number[] {
  const out: number[] = [];
  const re = /(?<![\w.])([−-]?)\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text.replace(/−/g, "-"))) !== null) {
    const n = Number((m[2] ?? "").replace(/,/g, "") + (m[3] ?? ""));
    if (Number.isFinite(n)) out.push(m[1] ? -n : n);
  }
  return out;
}

/** A tidy tick step (1, 2, 5 × 10ⁿ) giving roughly `ticks` intervals across `span`. */
export function niceStep(span: number, ticks = 10): number {
  if (!(span > 0)) return 1;
  const raw = span / ticks, pow = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return Number((nice * pow).toPrecision(12));
}

/** Frame the question's numbers AND what pairs of them can sum / differ to (so "−7 then drops by 6" shows −13). Null when the text has no numbers. */
export function suggestRange(prompt: string): NlRange | null {
  const nums = parseNumbers(prompt).slice(0, 5);
  if (!nums.length) return null;
  const c = new Set<number>(nums);
  for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) { c.add(nums[i]! + nums[j]!); c.add(nums[i]! - nums[j]!); c.add(nums[j]! - nums[i]!); }
  // A question whose numbers are all positive never needs a negative side just because b − a is negative.
  const pool = nums.every((x) => x >= 0) ? [...c].filter((x) => x >= 0) : [...c];
  let lo = Math.min(...pool), hi = Math.max(...pool);
  if (lo >= 0 && lo < hi * 0.6) lo = 0; // an all-positive question starts the line at 0
  if (hi <= 0 && hi > lo * 0.6) hi = 0;
  if (lo === hi) { lo -= 5; hi += 5; }
  const step = niceStep(hi - lo, 10);
  let start = Math.floor(lo / step) * step - (lo < 0 ? step : 0), end = Math.ceil(hi / step) * step + step;
  if (lo >= 0) start = Math.max(0, Math.floor(lo / step) * step - (lo === 0 ? 0 : step));
  if (end - start > step * 40) end = start + step * 40;
  return { start: Number(start.toPrecision(12)), end: Number(end.toPrecision(12)), step };
}

/** Zoom the line about its centre: factor < 1 zooms IN (a shorter line, finer step), > 1 zooms out. */
export function zoomRange(r: NlRange, factor: number): NlRange {
  const mid = (r.start + r.end) / 2, half = ((r.end - r.start) / 2) * factor;
  const step = niceStep(half * 2, 10);
  const start = Math.floor((mid - half) / step) * step, end = Math.ceil((mid + half) / step) * step;
  return { start: Number(start.toPrecision(12)), end: Number(end.toPrecision(12)), step };
}

/** "1/4", "0.25", "1 1/2" or "3" → a number, else null (lets the child type a fractional step). */
export function parseStep(s: string): number | null {
  const t = s.trim().replace(/−/g, "-");
  const mixed = /^(-?\d+)\s+(\d+)\/(\d+)$/.exec(t);
  if (mixed) { const d = Number(mixed[3]); return d ? Number(mixed[1]) + (Number(mixed[1]) < 0 ? -1 : 1) * (Number(mixed[2]) / d) : null; }
  const frac = /^(-?\d+)\/(\d+)$/.exec(t);
  if (frac) { const d = Number(frac[2]); return d ? Number(frac[1]) / d : null; }
  const n = Number(t);
  return t !== "" && Number.isFinite(n) ? n : null;
}

/** Label a tick as a fraction (½, 3/4, 1 1/2) when `asFraction`, else as a decimal. */
export function tickLabel(v: number, decimals: number, asFraction: boolean): string {
  if (!asFraction) return Number(v.toFixed(decimals)).toString();
  const neg = v < 0, a = Math.abs(v), whole = Math.floor(a + 1e-9), frac = a - whole;
  if (frac < 1e-9) return `${neg ? "−" : ""}${whole}`;
  for (let d = 2; d <= 16; d++) { const n = Math.round(frac * d); if (Math.abs(frac - n / d) < 1e-9) { const g = gcd(n, d); return `${neg ? "−" : ""}${whole ? whole + " " : ""}${n / g}/${d / g}`; } }
  return Number(v.toFixed(decimals)).toString();
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
