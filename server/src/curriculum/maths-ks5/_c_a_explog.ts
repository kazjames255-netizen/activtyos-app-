// Independent checks for explog.ts (fork a).
import type { CQuestion } from "../types";
import { N, F, P, W, root, roots, val, type Spec } from "./_m4lib";

const ln = Math.log, log10 = Math.log10;
export const T: Record<string, (q: CQuestion) => Spec> = {
  // ---------- Y12
  "explog-y12-01": () => N(log10(32) / log10(2), 1e-9),
  "explog-y12-02": () => { // log a - log b == log(a/b) numerically
      const a = 7.3, b = 2.9; const t = log10(a) - log10(b); const cands: Record<string, number> = { "log(a − b)": log10(a - b), "log(a/b)": log10(a / b), "log a / log b": log10(a) / log10(b), "log(b/a)": log10(b / a) };
      return P((o) => Math.abs(cands[o] - t) < 1e-9); },
  "explog-y12-03": () => N(root((x) => 5 ** x - 125, 0, 10), 1e-6),
  "explog-y12-04": () => N(root((x) => 3 ** x - 20, 0, 10), 0.005),
  "explog-y12-05": () => N(2 * log10(3) + log10(4) - log10(6), 1e-9),
  "explog-y12-06": () => N(Math.exp(3), 0.005),
  "explog-y12-07": () => { const a = 3, b = root((b) => a * b * b - 48, 0.1, 20); if (Math.abs(a * b ** 2 - 48) > 1e-6) throw new Error("x"); return N(b, 1e-6); },
  "explog-y12-08": () => N(log10(2), 0.0005),
  "explog-y12-09": () => { const c = -3 - 2 ** 0; return N(c); },
  "explog-y12-10": () => { const grad = (2.4 - 0.4) / 5; return N(10 ** grad, 0.005); },
  "explog-y12-11": () => { const x = root((x) => 4 ** x - 3 * 2 ** x - 4, 0, 5); const all = roots((x) => 4 ** x - 3 * 2 ** x - 4, -10, 10); if (all.length !== 1) throw new Error("count"); return N(x, 1e-6); },
  "explog-y12-12": () => { const r = roots((x) => Math.exp(2 * x) - 5 * Math.exp(x) + 6, -5, 5); if (r.length !== 2) throw new Error("roots"); return N(Math.max(...r), 0.005); },
  "explog-y12-13": () => { const b = Math.cbrt(720 / 90), a = 90 / b ** 2; if (Math.abs(a * b ** 5 - 720) > 1e-9) throw new Error("fit"); const t = root((t) => a * b ** t - 1000, 0, 20); return N(t, 0.005); },
  "explog-y12-14": () => { for (const [x, y, base] of [[8, 5, 2], [3.7, 11.2, 10], [2.5, 0.4, 3]]) { const p = Math.log(x) / Math.log(base), q = Math.log(y) / Math.log(base); if (Math.abs(Math.log(x * y) / Math.log(base) - (p + q)) > 1e-12) throw new Error("law"); } return W("log_a(xy)=p+q verified numerically"); },
  // ---------- Y13
  "explog-y13-01": () => N(ln(Math.exp(4)) + Math.exp(ln(3)), 1e-9),
  "explog-y13-02": () => N(ln(12) - ln(3), 1e-9),
  "explog-y13-03": () => { const f = (x: number) => Math.exp(x) + 2; const lim = f(-60); return P((o) => o.startsWith("y =") && Math.abs(val(o.replace("y =", "")) - lim) < 1e-6); },
  "explog-y13-04": () => N(root((x) => Math.exp(2 * x + 1) - 30, -5, 5), 0.005),
  "explog-y13-05": () => N(root((x) => ln(3 * x - 1) - 2, 0.34, 20), 0.005),
  "explog-y13-06": () => N(root((t) => 2000 * Math.exp(0.04 * t) - 4000, 0, 100), 0.05),
  "explog-y13-07": () => { const k = root((k) => Math.exp(-5 * k) - 0.5, 0.001, 5); return N(k, 0.0005); },
  "explog-y13-08": () => N(Math.exp(2), 0.005),
  "explog-y13-09": () => { const f = (x: number) => 3 * Math.exp(-x); if (Math.abs(f(0) - 3) > 1e-12 || Math.abs(f(1) - 1.1) > 0.01) throw new Error("curve"); return F(f); },
  "explog-y13-10": () => N((6.5 - 3.5) / (3 - 1)),
  "explog-y13-11": () => { const r = roots((x) => ln(x - 2) + 1, 2.0001, 10); return N(r[0], 0.005); },
  "explog-y13-12": () => { const r = roots((x) => 2 * Math.exp(2 * x) - 9 * Math.exp(x) + 4, -5, 5); if (r.length !== 2) throw new Error("roots"); return N(Math.max(...r), 0.005); },
  "explog-y13-13": () => N(root((t) => 20 + 65 * Math.exp(-0.08 * t) - 40, 0, 100), 0.05),
  "explog-y13-14": () => { const A = 6, k = 3 * ln(2); for (const x of [-1, 0.4, 2.3]) if (Math.abs(A * Math.exp(k * x) - 6 * 2 ** (3 * x)) > 1e-9) throw new Error("form"); return W("6·2^(3x) = 6e^(3x ln2) verified numerically"); },
};
