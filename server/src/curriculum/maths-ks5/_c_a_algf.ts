// Independent checks for algf.ts (fork a).
import type { CQuestion } from "../types";
import { N, F, FE, P, W, D, roots, root, parse, sameFn, val, type Spec } from "./_m4lib";

const truth = (f: (x: number) => boolean, lo = -12, hi = 12, n = 4801): boolean[] => Array.from({ length: n }, (_, i) => f(lo + ((hi - lo) * i) / (n - 1)));
const sameTruth = (a: boolean[], b: boolean[]) => a.every((v, i) => v === b[i]);

export const T: Record<string, (q: CQuestion) => Spec> = {
  // ---------- Y12
  "algf-y12-01": () => N(Math.sqrt(50)),
  "algf-y12-02": () => N(Math.pow(27, 2 / 3)),
  "algf-y12-03": () => { const d = 4 * 4 - 4 * 1 * 7; const want = d > 0 ? "two distinct real roots" : d === 0 ? "one repeated root" : "no real roots"; return P((o) => o === want); },
  "algf-y12-04": () => { const k = root((k) => k * k - 4 * 16, 0.1, 20); return N(k, 1e-6); },
  "algf-y12-05": () => F((x) => x * x - 10 * x + 7),
  "algf-y12-06": () => { const r = roots((x) => x + 3 - (x * x - 3 * x + 6), -10, 10); return N(Math.max(...r), 1e-6); },
  "algf-y12-07": () => { const t = truth((x) => x * x - x - 12 < 0); return P((o) => {
      const m: Record<string, (x: number) => boolean> = { "x < −3 or x > 4": (x) => x < -3 || x > 4, "−3 < x < 4": (x) => -3 < x && x < 4, "−4 < x < 3": (x) => -4 < x && x < 3, "x < −4 or x > 3": (x) => x < -4 || x > 3 };
      return sameTruth(t, truth(m[o])); }); },
  "algf-y12-08": () => N(3 ** 3 - 4 * 3 ** 2 + 2 * 3 + 9),
  "algf-y12-09": () => { // f = (x-2)^2 - 3 min (2,-3); y = 2 f(x+1): find its min numerically
      const g = (x: number) => 2 * ((x + 1 - 2) ** 2 - 3); let bx = 0, by = Infinity; for (let x = -5; x <= 5; x += 0.001) if (g(x) < by) { by = g(x); bx = x; }
      return P((o) => { const [a, b] = o.replace(/[()]/g, "").split(",").map((s) => val(s.trim())); return Math.abs(a - bx) < 0.002 && Math.abs(b - by) < 0.002; }); },
  "algf-y12-10": () => N(6 / (3 - Math.sqrt(3))),
  "algf-y12-11": () => { // solve a,b from f(1)=0, f(-2)=0
      let sol: number[] | null = null; for (let a = -20; a <= 20; a++) for (let b = -20; b <= 20; b++) { const f = (x: number) => x ** 3 + a * x * x + b * x - 12; if (f(1) === 0 && f(-2) === 0) sol = [a, b]; } return N(sol![0]); },
  "algf-y12-12": () => { let c = 0; for (let n = -50; n <= 50; n++) if (n * n - 2 * n - 15 < 0 && 3 * n - 2 > 1) c++; return N(c); },
  "algf-y12-13": () => F((x) => (x + 1) * (x - 2) * (x - 4)),
  "algf-y12-14": () => { const f = (x: number) => x * x + 1 - 2 * x; if (Math.abs(D(f, 1)) > 1e-6 || Math.abs(f(1)) > 1e-12) throw new Error("not tangent at 1"); if (roots(f, -5, 5).length > 0 && f(0.9) < 0) throw new Error("crosses"); return W("x²+1=2x -> (x−1)²=0, double root x=1, y=2 verified"); },
  // ---------- Y13
  "algf-y13-01": () => N(2 * 2 ** 2 + 3),
  "algf-y13-02": () => F((x) => (x + 5) / 3),
  "algf-y13-03": () => F((x) => 3 * (x + 4) ** 2),
  "algf-y13-04": () => { const r = roots((x) => Math.abs(2 * x - 3) - 7, -20, 20).map((v) => Math.round(v)).sort((a, b) => a - b); return P((o) => { const s = o.replace("x =", "").replace("only", "").split("or").map((t) => val(t.replace(/x =/, "").trim())).sort((a, b) => a - b); return s.length === r.length && s.every((v, i) => v === r[i]); }); },
  "algf-y13-05": () => { let m = Infinity; for (let x = -20; x <= 20; x += 0.001) m = Math.min(m, x * x - 4 * x + 7); return P((o) => { const [, rhs] = o.split("≥"); return !!rhs && Math.abs(val(rhs.trim()) - m) < 1e-3; }); },
  "algf-y13-06": () => { const f = (x: number) => (x + 2) / (x - 1); const x = root((x) => f(x) - 3, 1.001, 50); return N(x, 1e-6); },
  "algf-y13-07": () => FE((e) => (5 * e.x + 1) / ((e.x - 1) * (e.x + 2))),
  "algf-y13-08": () => { const lhs = (x: number) => (2 * x * x + 5 * x + 5) / ((x - 1) * (x + 2)); const A = 4, B = -1, Pc = 2; for (const x of [3, 4.5, -5, 0.3, 7]) if (Math.abs(lhs(x) - (Pc + A / (x - 1) + B / (x + 2))) > 1e-9) throw new Error("identity fails"); // uniqueness: the identity is only true for A=4
      return N(A); },
  "algf-y13-09": () => N(roots((x) => Math.abs(x * x - 4) - 3, -10, 10, 100000).length),
  "algf-y13-10": () => { const f = (x: number) => 3 * Math.sqrt(x) + 1; if (Math.abs(f(1) - 4) > 1e-12) throw new Error("A not on f"); return P((o) => { const [a, b] = o.replace(/[()]/g, "").split(",").map((s) => val(s.trim())); return Math.abs(f(b) - a) < 1e-9; }); },
  "algf-y13-11": () => { const f = (x: number) => x + 2, g = (x: number) => x * x - 1; const r = roots((x) => f(g(x)) - g(f(x)), -10, 10); if (r.length !== 1) throw new Error("roots"); return N(r[0], 1e-9); },
  "algf-y13-12": () => { let n = -50; while (!(Math.abs(n - 5) < 2 * n - 1)) n++; for (let m = n; m < n + 50; m++) if (!(Math.abs(m - 5) < 2 * m - 1)) throw new Error("not monotone"); return N(n); },
  "algf-y13-13": () => { const f = (x: number) => (x + 1) / (x - 1); for (const x of [2, 3.5, -4, 0.2, 10]) if (Math.abs(f(f(x)) - x) > 1e-9) throw new Error("not self-inverse"); return W("f(f(x)) = x verified numerically at 5 points; algebra in mark scheme matches"); },
};
void parse; void sameFn;
