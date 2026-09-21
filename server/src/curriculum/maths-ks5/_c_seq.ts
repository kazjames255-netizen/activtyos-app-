// Independent answer checks for seq.ts (Sequences & Series, Y12–13): loops, exact binomial coefficients, numeric series.
import { TOPIC } from "./seq";
import { N, P, W, F, nCr, D, parse, type Spec } from "./_m4lib";
import type { CQuestion } from "../types";

export const TOPICS = [TOPIC];
const sumTo = (f: (r: number) => number, a: number, b: number) => { let s = 0; for (let r = a; r <= b; r++) s += f(r); return s; };
const ap = (a: number, d: number) => (n: number) => a + (n - 1) * d;
const gp = (a: number, r: number) => (n: number) => a * r ** (n - 1);
/** binomial series coefficient of x^k in (1+x)^n for real n */
const bc = (n: number, k: number) => { let c = 1; for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1); return c; };
/** option is a polynomial agreeing with f up to order `ord` (error ~h^(ord+1)) at small h, and not better */
const series = (f: (h: number) => number, ord: number) => (o: string) => { const g = parse(o); return [0.01, 0.02].every((h) => Math.abs(g({ x: h }) - f(h)) < 4 * h ** (ord + 1)); };
const isGeo = (s: string) => { const t = s.split(",").map((v) => Number(v.replace(/−/g, "-"))); const r = t[1] / t[0]; return t.every((v, i) => i === 0 || Math.abs(v / t[i - 1] - r) < 1e-12); };

export const T: Record<string, (q: CQuestion) => Spec> = {
  "seq-y12-01": () => N(ap(5, 3)(10)),
  "seq-y12-02": () => N(nCr(7, 2)),
  "seq-y12-03": () => P(isGeo),
  "seq-y12-04": () => N(sumTo(ap(7, 4), 1, 20)),
  "seq-y12-05": () => N(sumTo(gp(3, 2), 1, 8)),
  "seq-y12-06": () => { const s = sumTo(gp(12, 1 / 3), 1, 200); return N(s, 1e-9); },
  "seq-y12-07": () => F((x) => nCr(4, 3) * 2 * 27 * x ** 3),
  "seq-y12-08": () => N(sumTo((r) => 3 * r - 1, 1, 10)),
  "seq-y12-09": () => { // 5th = 23, 9th = 39
    const d = (39 - 23) / 4, a = 23 - 4 * d; if (ap(a, d)(9) !== 39) throw new Error("ap"); return N(a);
  },
  "seq-y12-10": () => { const r = Math.sqrt(80 / 20), a = 20 / (r * r); if (Math.abs(gp(a, r)(5) - 80) > 1e-9) throw new Error("gp"); return N(a); },
  "seq-y12-11": () => { const r = 2 / 3, a = 10 / r; if (Math.abs(a / (1 - r) - 3 * a) > 1e-9) throw new Error("S∞"); return N(a, 1e-9); },
  "seq-y12-12": () => { let n = 0, s = 0; while (s <= 500) { n++; s += gp(2, 1.5)(n); } return N(n); },
  "seq-y12-13": () => { for (const [a, d, n] of [[3, 2, 9], [-4, 0.5, 14], [7, 4, 20]]) if (Math.abs(sumTo(ap(a, d), 1, n) - 0.5 * n * (2 * a + (n - 1) * d)) > 1e-9) throw new Error("AP sum formula"); return W("AP sum formula confirmed on 3 cases"); },
  "seq-y13-01": () => P(series((h) => 1 / (1 + h), 2)),
  "seq-y13-02": () => { let u = 3; for (let i = 1; i < 3; i++) u = 2 * u + 1; return N(u); },
  "seq-y13-03": () => { const u = (n: number) => 1 / n; for (let n = 1; n < 500; n++) if (!(u(n + 1) < u(n))) throw new Error("not decreasing"); if (u(1e6) > 1e-5) throw new Error("no limit"); return P((o) => o === "decreasing and convergent to 0"); },
  "seq-y13-04": () => N(bc(-2, 2) * 4),
  "seq-y13-05": () => N(bc(0.5, 2) * 9),
  "seq-y13-06": () => P((o) => o.replace(/\s/g, "") === "|x|<1/4"),
  "seq-y13-07": () => N(1 + 0.5 * 0.02 - 0.125 * 0.02 ** 2, 1e-9),
  "seq-y13-08": () => { let u = 2; for (let i = 0; i < 200; i++) u = 0.5 * u + 4; return N(u, 1e-9); },
  "seq-y13-09": () => { const f = (x: number) => (4 - x) ** -0.5; const c2 = D((x) => D(f, x, 1e-2), 0, 1e-2) / 2; return N(c2, 0.00005); },
  "seq-y13-10": () => { const f = (x: number) => 1 / ((1 + x) * (1 - 2 * x)); const c2 = D((x) => D(f, x, 1e-2), 0, 1e-2) / 2; return N(c2, 1e-6); },
  "seq-y13-11": () => { let u = 2; for (let i = 1; i < 4; i++) u = 1 / (1 - u); return N(u); },
  "seq-y13-12": () => { const k = -6 / -2; return N(bc(-2, 2) * k * k); },
  "seq-y13-13": () => { const c = [bc(-0.5, 0), bc(-0.5, 1), bc(-0.5, 2)]; if (Math.abs(c[1] + 0.5) > 1e-12 || Math.abs(c[2] - 3 / 8) > 1e-12) throw new Error("coeffs"); return W("coefficients 1, −1/2, 3/8 confirmed"); },
};
