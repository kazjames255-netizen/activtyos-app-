// Pure fraction-bar logic (no DOM). A bar is `wholes` identical rows, each split into `den` equal parts; `shaded` holds the indices (0 .. wholes*den-1) the child tapped.
// Nothing here chooses a common denominator, adds, compares or simplifies for the child: it only re-slices what they have and reports what they shaded.

export interface Bar { den: number; wholes: number; shaded: number[] }
export const MAX_DEN = 24, MAX_WHOLES = 4;

export const newBar = (den = 4, wholes = 1): Bar => ({ den: Math.max(1, Math.min(MAX_DEN, den)), wholes: Math.max(1, Math.min(MAX_WHOLES, wholes)), shaded: [] });

/** Toggle one part. */
export function toggle(b: Bar, i: number): Bar {
  if (i < 0 || i >= b.den * b.wholes) return b;
  return { ...b, shaded: b.shaded.includes(i) ? b.shaded.filter((x) => x !== i) : [...b.shaded, i].sort((a, c) => a - c) };
}

/** Split every part into `factor` smaller equal parts (3/4 → 6/8 for factor 2): same amount shaded, finer parts. Null if it would pass the maximum. */
export function reslice(b: Bar, factor: number): Bar | null {
  if (!Number.isInteger(factor) || factor < 2 || b.den * factor > MAX_DEN) return null;
  const shaded: number[] = [];
  for (const i of b.shaded) for (let k = 0; k < factor; k++) shaded.push(i * factor + k);
  return { den: b.den * factor, wholes: b.wholes, shaded };
}

/** Change the number of parts per whole, keeping a shaded amount only when it survives (otherwise clears it — the child decides what to shade). */
export function setDen(b: Bar, den: number): Bar {
  const d = Math.max(1, Math.min(MAX_DEN, Math.round(den)));
  return d === b.den ? b : { den: d, wholes: b.wholes, shaded: [] };
}
export function setWholes(b: Bar, wholes: number): Bar {
  const w = Math.max(1, Math.min(MAX_WHOLES, Math.round(wholes)));
  return { ...b, wholes: w, shaded: b.shaded.filter((i) => i < b.den * w) };
}

/** What is shaded, as the child would write it: top over bottom, and as a mixed number when more than a whole is shaded. */
export function shadedFraction(b: Bar): { num: number; den: number; whole: number; rem: number } {
  const num = b.shaded.length;
  return { num, den: b.den, whole: Math.floor(num / b.den), rem: num % b.den };
}
export function label(b: Bar): string {
  const f = shadedFraction(b);
  if (!f.num) return "nothing shaded";
  if (f.den === 1) return String(f.num);
  return f.whole ? (f.rem ? `${f.num}/${f.den}  =  ${f.whole} ${f.rem}/${f.den}` : `${f.num}/${f.den}  =  ${f.whole}`) : `${f.num}/${f.den}`;
}
