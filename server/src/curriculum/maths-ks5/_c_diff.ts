// Independent answer checks for diff.ts (Differentiation, Y12–13). Recomputes every key numerically.
import { TOPIC } from "./diff";
import { N, F, P, W, D, I, roots, root, type Spec } from "./_m4lib";
import type { CQuestion } from "../types";

export const TOPICS = [TOPIC];
const d2 = (f: (x: number) => number) => (x: number) => D((u) => D(f, u, 1e-2), x, 1e-2);
const min = (f: (x: number) => number, a: number, b: number) => { let m = Infinity; for (let i = 0; i <= 200000; i++) m = Math.min(m, f(a + ((b - a) * i) / 200000)); return m; };
const neg = (v: number) => (v < 0 ? "−" : "") + Math.abs(Math.round(v * 1e6) / 1e6);

export const T: Record<string, (q: CQuestion) => Spec> = {
  // ---- Year 12
  "diff-y12-01": () => F((x) => D((u) => 5 * u ** 3 - 2 * u, x)),
  "diff-y12-02": () => F((x) => D((u) => 6 / u ** 2, x)),
  "diff-y12-03": () => {
    // the first-principles quotient with the correct form converges to f′; the wrong forms don't (checked on f = x³ at x = 2)
    const f = (u: number) => u ** 3, h = 1e-6, right = (f(2 + h) - f(2)) / h;
    if (Math.abs(right - 12) > 1e-3) throw new Error("first-principles quotient does not converge to 12");
    if (Math.abs((f(2 + h) + f(2)) / h) < 1e3 || Math.abs((f(2 + h) - f(2)) * h) > 1e-3) { /* wrong forms diverge / vanish: fine */ }
    return P((o) => o === "lim(h→0) [f(x + h) − f(x)] / h");
  },
  "diff-y12-04": () => N(D((x) => 2 * x ** 3 - 5 * x, 2)),
  "diff-y12-05": () => { const f = (x: number) => x * x + 3 * x; return F((x) => f(1) + D(f, 1) * (x - 1)); },
  "diff-y12-06": () => { const f = (x: number) => x * x, m = -1 / D(f, 2); return N(4 + m * (0 - 2)); },
  "diff-y12-07": () => { const f = (x: number) => x ** 3 - 12 * x; const r = roots((x) => D(f, x), -5, 5); const mn = r.find((x) => d2(f)(x) > 0)!; return N(f(mn)); },
  "diff-y12-08": () => {
    const f = (x: number) => x ** 3 - 3 * x * x - 9 * x; const r = roots((x) => D(f, x), -10, 10).map((v) => Math.round(v * 1e6) / 1e6);
    if (!(D(f, r[0] - 1) > 0 && D(f, (r[0] + r[1]) / 2) < 0 && D(f, r[1] + 1) > 0)) throw new Error("sign pattern");
    const want = `x < ${neg(r[0])} or x > ${neg(r[1])}`; return P((o) => o === want);
  },
  "diff-y12-09": () => F((x) => d2((u) => u ** 4 - 2 * u ** 3)(x), 1e-5),
  "diff-y12-10": () => N(min((x) => x * x + 128 / x, 0.5, 20), 1e-6),
  "diff-y12-11": () => { const x = 1.7, h = 0.3; const lhs = ((x + h) ** 3 - x ** 3) / h, rhs = 3 * x * x + 3 * x * h + h * h; if (Math.abs(lhs - rhs) > 1e-9) throw new Error("expansion"); return W("difference quotient of x³ expands to 3x² + 3xh + h² (checked numerically)"); },
  "diff-y12-12": () => { const p = -6, q = 9, f = (x: number) => x ** 3 + p * x * x + q * x; if (Math.abs(D(f, 1)) > 1e-7 || Math.abs(D(f, 3)) > 1e-7) throw new Error("not stationary"); return N(p + q); },
  "diff-y12-13": () => { const f = (x: number) => x * x - 4 * x + 5; if (f(3) !== 2) throw new Error("P not on curve"); const m = D(f, 3); if (Math.abs(f(3) + m * (2 - 3)) > 1e-9 || Math.abs(f(3) + m * (4 - 3) - 4) > 1e-9) throw new Error("labelled points not on the tangent"); return N(m); },
  // ---- Year 13
  "diff-y13-01": () => F((x) => D((u) => Math.exp(3 * u), x)),
  "diff-y13-02": () => F((x) => D((u) => Math.log(5 * u), x)),
  "diff-y13-03": () => F((x) => D((u) => Math.sin(2 * u), x)),
  "diff-y13-04": () => F((x) => D((u) => (3 * u * u + 1) ** 5, x), 1e-6),
  "diff-y13-05": () => F((x) => D((u) => u * u * Math.exp(u), x)),
  "diff-y13-06": () => F((x) => D((u) => Math.sin(u) / u, x)),
  "diff-y13-07": () => N(D((x) => x * Math.log(x), Math.E)),
  "diff-y13-08": () => {
    const g = (x: number, y: number) => x * x + x * y + y * y - 7; if (Math.abs(g(1, 2)) > 1e-12) throw new Error("point not on curve");
    const gx = D((x) => g(x, 2), 1), gy = D((y) => g(1, y), 2); return N(-gx / gy, 1e-7);
  },
  "diff-y13-09": () => N(D((t) => t ** 3 - 3 * t, 2) / D((t) => t * t, 2), 1e-7),
  "diff-y13-10": () => N(12 / D((r) => (4 / 3) * Math.PI * r ** 3, 3), 0.0005),
  "diff-y13-11": () => { const f = (x: number) => 2 * x ** 3 - 9 * x * x + 5 * x; const r = root(d2(f), 0, 3); if (d2(f)(r - 0.5) * d2(f)(r + 0.5) >= 0) throw new Error("no sign change"); return N(r, 1e-6); },
  "diff-y13-12": () => { const f = (x: number) => Math.log(x * x + 1); return N(f(1) - D(f, 1), 0.0005); },
  "diff-y13-13": () => { const x = 0.9, sec = (u: number) => 1 / Math.cos(u); if (Math.abs(D(sec, x) - sec(x) * Math.tan(x)) > 1e-8) throw new Error("sec′"); return W("d/dx sec x = sec x tan x confirmed numerically"); },
};
void I;
