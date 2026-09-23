// Seeded random numbers (mulberry32) so a regenerating question is reproducible from its seed alone.
export interface Rng {
  /** [0, 1) */ next(): number;
  /** integer in [lo, hi] inclusive */ int(lo: number, hi: number): number;
  /** float in [lo, hi) */ float(lo: number, hi: number): number;
  pick<T>(xs: readonly T[]): T;
  shuffle<T>(xs: readonly T[]): T[];
}
export function makeRng(seed: number): Rng {
  let a = (seed >>> 0) || 0x9e3779b9;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  return {
    next, int,
    float: (lo, hi) => lo + next() * (hi - lo),
    pick: (xs) => xs[int(0, xs.length - 1)]!,
    shuffle: (xs) => { const o = [...xs]; for (let i = o.length - 1; i > 0; i--) { const j = int(0, i); [o[i], o[j]] = [o[j]!, o[i]!]; } return o; },
  };
}
/** A fresh seed for a new attempt. */
export const newSeed = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
