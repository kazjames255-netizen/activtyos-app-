// Independent answer checks for stat5.ts (Statistics, Y12–13): binomial / normal computed from first principles.
import { TOPIC } from "./stat5";
import { N, P, W, binPmf, binCdf, normCdf, normInv, regress, sd, mean, nCr, type Spec } from "./_m4lib";
import type { CQuestion } from "../types";

export const TOPICS = [TOPIC];
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
const quoted = (got: number, want: number, dp: number, what: string) => { if (Math.abs(got - want) > 0.5 * 10 ** -dp + 1e-12) throw new Error(`quoted ${what} = ${want} but computed ${got}`); };

export const T: Record<string, (q: CQuestion) => Spec> = {
  "stat5-y12-01": () => P((o) => o === "Simple random"), // recall: every member equally likely, chosen by random numbers
  "stat5-y12-02": () => P((o) => o === "Systematic sampling"), // recall: every kth item after a random start
  "stat5-y12-03": () => N((300 / 1200) * 80),
  "stat5-y12-04": () => { const n = 8, sx = 96, sxx = 1240; return N(Math.sqrt(sxx / n - (sx / n) ** 2), 0.0005); },
  "stat5-y12-05": () => { const fd = [[0, 10, 1.2], [10, 20, 2.5], [20, 30, 3], [30, 50, 1.5], [50, 80, 0.4]]; const c = fd.find((b) => b[0] === 30)!; return N((c[1] - c[0]) * c[2], 1e-9); },
  "stat5-y12-06": () => { const q1 = 24, q3 = 40, iqr = q3 - q1, hi = q3 + 1.5 * iqr, lo = q1 - 1.5 * iqr; return P((o) => { const v = Number(o); return v > hi || v < lo; }); },
  "stat5-y12-07": () => N(1 - (0.25 + 0.15 + 0.2), 1e-9),
  "stat5-y12-08": () => N(0.3 * 0.4 + 0.7 * 0.1, 1e-9),
  "stat5-y12-09": () => N(binPmf(10, 0.3, 4), 0.00005),
  "stat5-y12-10": () => { quoted(binCdf(12, 0.25, 2), 0.3907, 4, "P(X≤2)"); return N(1 - binCdf(12, 0.25, 2), 0.00005); },
  "stat5-y12-11": () => {
    const p = 1 - binCdf(30, 1 / 6, 8); quoted(p, 0.0506, 4, "P(X≥9)"); const reject = p < 0.05;
    return P((o) => (reject ? /^Reject/.test(o) && /</.test(o) : /^Do not reject/.test(o) && />/.test(o) && !/proves/.test(o)));
  },
  "stat5-y12-12": () => { const p = (c: number) => 1 - binCdf(25, 0.5, c - 1); quoted(p(17), 0.0539, 4, "P(X≥17)"); quoted(p(18), 0.0216, 4, "P(X≥18)"); let c = 0; while (p(c) > 0.05) c++; return N(c); },
  "stat5-y12-13": () => { const pv = 1 - binCdf(10, 0.5, 7); if (Math.abs(pv - 56 / 1024) > 1e-12 || r4(pv) !== 0.0547) throw new Error("p-value"); if (!(pv > 0.05)) throw new Error("conclusion"); return W("P(X≥8) = 0.0547 > 0.05 -> do not reject (verified)"); },
  // ---- Year 13
  "stat5-y13-01": () => N((82 - 70) / Math.sqrt(25), 1e-12),
  "stat5-y13-02": () => { const r = -0.9; return P((o) => (r < -0.7 ? o === "Strong negative linear correlation" : false)); },
  "stat5-y13-03": () => N(2.5 + 1.8 * 10, 1e-12),
  "stat5-y13-04": () => N(1 - normCdf(115, 100, 15), 0.00005),
  "stat5-y13-05": () => { const z = normInv(0.8413); return N(20 - 4 * z, 0.01); },
  "stat5-y13-06": () => N(0.15 / 0.4, 1e-12),
  "stat5-y13-07": () => N(50 / (45 + 50), 0.0005),
  "stat5-y13-08": () => N(normCdf(45.5, 40, Math.sqrt(0.4 * 0.6 * 100)), 0.0005),
  "stat5-y13-09": () => { const x = [1, 2, 3, 4, 5, 6], y = [3.1, 4.9, 7.2, 8.8, 11.1, 12.9]; return N(regress(x, y).b, 0.005); },
  "stat5-y13-10": () => P((o) => { const x = Number(o.replace(/\D+/g, " ").trim().split(" ").pop()); return x < 10 || x > 50; }),
  "stat5-y13-11": () => { const z1 = normInv(0.1587), z2 = normInv(0.9772); return N((44 - 28) / (z2 - z1), 0.01); },
  "stat5-y13-12": () => { const r = 0.68, crit = 0.5494; return P((o) => (r > crit ? /^Reject/.test(o) && /positive/.test(o) : false)); },
  "stat5-y13-13": () => N(1 - normCdf(503.5, 500, 8 / Math.sqrt(25)), 0.0001),
  "stat5-y13-14": () => { const exact = 1 - binCdf(80, 0.5, 44); const approx = 1 - normCdf(44.5, 40, Math.sqrt(20)); if (Math.abs(exact - approx) > 0.002 || Math.abs(approx - 0.157) > 0.0006) throw new Error("approx"); return W("N(40,20), P(Y>44.5) ≈ 0.157 (exact binomial 0.1572)"); },
};
void mean; void sd; void nCr;
