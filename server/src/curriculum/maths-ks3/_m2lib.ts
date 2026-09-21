// Shared helpers for the maths-ks3 answer checker (agent M2). Underscore prefix => skipped by validate.ts.
import type { CQuestion } from "../types";

export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
export type R = { n: number; d: number };
export const R = (n: number, d = 1): R => { const g = gcd(n, d) || 1; const s = d < 0 ? -1 : 1; return { n: (s * n) / g, d: (s * d) / g }; };
export const add = (a: R, b: R) => R(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: R, b: R) => R(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: R, b: R) => R(a.n * b.n, a.d * b.d);
export const div = (a: R, b: R) => R(a.n * b.d, a.d * b.n);
export const eq = (a: R, b: R) => a.n === b.n && a.d === b.d;
export const num = (r: R) => r.n / r.d;
export const dec = (s: string): R => { const neg = s.startsWith("-"); const t = neg ? s.slice(1) : s; const [i, f = ""] = t.split("."); return R((neg ? -1 : 1) * parseInt(i + f, 10), 10 ** f.length); };
export const simp = (n: number, d: number) => { const g = gcd(n, d); return `${n / g}/${d / g}`; };
export const mixed = (r: R) => { const w = Math.floor(r.n / r.d); const rem = r.n - w * r.d; return rem === 0 ? `${w}` : w === 0 ? `${rem}/${r.d}` : `${w} ${rem}/${r.d}`; };

const SUP: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };
export const fromSup = (s: string) => s.split("").map((c) => SUP[c] ?? c).join("");

/** Parse a plain quantity (number, decimal, fraction, mixed number, %, with £/units) into an exact rational, else null. */
export function val(s0: string | number): R | null {
  let s = String(s0).trim().replace(/,/g, "").replace(/−/g, "-").replace(/^£/, "").replace(/^\s*[a-z]\s*=\s*/i, "").replace(/(\d)\s+\/\s+(\d)/g, "$1/$2");
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(-?\d+) (\d+)\/(\d+)(?:\s*[a-zA-Z°²³ ]*)$/))) return add(R(+m[1]), R(+m[2], +m[3]));
  if ((m = s.match(/^(-?\d*\.?\d+)(?:\/(\d+))?\s*(%)?\s*(?:[a-zA-Z°²³\/ ]*)$/))) {
    let r = m[2] ? div(m[1].includes(".") ? dec(m[1]) : R(+m[1]), R(+m[2])) : m[1].includes(".") ? dec(m[1]) : R(+m[1]);
    if (m[3]) r = div(r, R(100));
    return r;
  }
  return null;
}

/** Standard-form / power value: "4.5 × 10⁶", "3⁴", "2⁻³". Returns a JS number or null. */
export function sfVal(s: string): number | null {
  const t = s.trim().replace(/−/g, "-");
  let m = t.match(/^(-?[\d.]+) × 10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹-]+)$/);
  if (m) return parseFloat(m[1]) * 10 ** parseInt(fromSup(m[2]), 10);
  return null;
}
export const sfOK = (s: string) => { const m = s.trim().match(/^([\d.]+) × 10/); return !!m && parseFloat(m[1]) >= 1 && parseFloat(m[1]) < 10; };

/** Convert an algebra string ("3x + 12", "(x + 2)(x + 3)", "2p − q²") into a JS function of named variables. */
export function toFn(s: string, vars: string[]): (...a: number[]) => number {
  let t = s.replace(/−/g, "-").replace(/×/g, "*").replace(/²/g, "**2").replace(/³/g, "**3");
  t = t.replace(/(\d)\s*([a-z(])/g, "$1*$2").replace(/([a-z)])\s*\(/g, "$1*(").replace(/\)\s*([a-z\d])/g, ")*$1").replace(/([a-z])\s*([a-z])/g, "$1*$2").replace(/([a-z])\s*([a-z])/g, "$1*$2");
  return Function(...vars, `return (${t})`) as (...a: number[]) => number;
}
const SAMPLES: number[][] = [[1, 2], [3, -1], [-2, 5], [4, 7], [0.5, 3], [-3, -4]];
/** Do two algebra strings agree at several sample points (single-letter variables in `vars`)? */
export function algEq(a: string | ((...x: number[]) => number), b: string | ((...x: number[]) => number), vars: string[] = ["x"]): boolean {
  const fa = typeof a === "string" ? toFn(a, vars) : a, fb = typeof b === "string" ? toFn(b, vars) : b;
  return SAMPLES.every((sm) => Math.abs(fa(...sm.slice(0, vars.length)) - fb(...sm.slice(0, vars.length))) < 1e-9);
}

export const ev = (e: string) => Function(`return (${e.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/²/g, "**2").replace(/³/g, "**3")})`)() as number;
export const isPrime = (n: number) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
export const factors = (n: number) => { const f: number[] = []; for (let i = 1; i <= n; i++) if (n % i === 0) f.push(i); return f; };
export const lcm = (a: number, b: number) => (a * b) / gcd(a, b);
export const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
export const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const mode = (a: number[]) => { const c = new Map<number, number>(); a.forEach((x) => c.set(x, (c.get(x) ?? 0) + 1)); const mx = Math.max(...c.values()); return [...c].filter(([, k]) => k === mx).map(([x]) => x); };
export const range = (a: number[]) => Math.max(...a) - Math.min(...a);
export const fix = (x: number, dp = 9) => Math.round(x * 10 ** dp) / 10 ** dp;

export type Exp = { v: R } | { s: string } | { set: string[] };
export const V = (n: number | R): Exp => ({ v: typeof n === "number" ? R(Math.round(n * 1e9), 1e9) : n });
export const S = (s: string): Exp => ({ s });
export const opts = (q: CQuestion) => q.options ?? [];
export const only = (q: CQuestion, pred: (o: string) => boolean): Exp => {
  const hit = opts(q).filter(pred);
  if (hit.length !== 1) throw new Error(`${q.key}: expected exactly one matching option, got ${hit.length} [${hit.join(" | ")}]`);
  return S(hit[0]);
};
export const setOf = (q: CQuestion, pred: (o: string) => boolean): Exp => ({ set: opts(q).filter(pred) });
export const nums = (o: string) => Number(o.replace(/,/g, "").replace(/−/g, "-").replace(/[^\d.\-]/g, ""));
export type EMap = Record<string, (q: CQuestion) => Exp>;
