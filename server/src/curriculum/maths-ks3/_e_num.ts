// Independent expectations for num.ts (Years 7–9). See _check_m2.ts.
import type { CQuestion } from "../types";
import { D } from "./_m2data";
import { R, V, S, add, mul, div, eq, dec, val, sfVal, sfOK, fromSup, gcd, lcm, isPrime, ev, only, setOf, opts, nums, type EMap, type Exp } from "./_m2lib";

const SUPD = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const toSup = (n: number) => String(n).split("").map((c) => SUPD[+c]).join("");
/** prime factorisation as "2² × 3 × 7" */
const pf = (n: number) => { const m = new Map<number, number>(); for (let p = 2; n > 1; p++) while (n % p === 0) { m.set(p, (m.get(p) ?? 0) + 1); n /= p; } return [...m].map(([p, e]) => (e > 1 ? `${p}${toSup(e)}` : `${p}`)).join(" × "); };
const pw = (s: string) => { const m = s.match(/^(\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/); return m ? Number(m[1]) ** Number(fromSup(m[2])) : NaN; };
const accEval = (q: CQuestion, want: number) => { for (const a of q.accepted ?? []) { const t = a.replace(/[×x*]/g, "*").replace(/\^(\d)/g, "**$1").replace(/²/g, "**2").replace(/³/g, "**3"); if (Function(`return (${t})`)() !== want) throw new Error(`${q.key}: accepted "${a}" != ${want}`); } };
const accVal = (q: CQuestion, want: R) => { for (const a of q.accepted ?? []) { const v = val(a); if (!v || !eq(v, want)) throw new Error(`${q.key}: accepted "${a}" does not equal the answer`); } };

export const E: EMap = {
  // ---- Y7
  "num-y7-01": () => V(-3 - 5), "num-y7-02": (q) => only(q, (o) => isPrime(nums(o))), "num-y7-03": () => V(ev("7+3*4")),
  "num-y7-04": () => { if (((D.numline.arrow - D.numline.min) / D.numline.step) % 1 !== 0) throw new Error("arrow off tick"); return V(D.numline.arrow); },
  "num-y7-05": (q) => { accVal(q, dec("0.35")); return V(dec("0.35")); },
  "num-y7-06": (q) => setOf(q, (o) => 36 % nums(o) === 0), "num-y7-07": () => V(lcm(6, 8)),
  "num-y7-08": (q) => {
    const best = Math.max(...opts(q).map((o) => Number(val(o) ? val(o)!.n / val(o)!.d : NaN)));
    const hit = opts(q).filter((o) => val(o)!.n / val(o)!.d === best); if (hit.length !== 1) throw new Error("tie"); return S(hit[0]);
  },
  "num-y7-09": () => V(ev("(12−4)²/2+3")),
  "num-y7-10": (q) => { accEval(q, 84); return S(pf(84)); },
  // ---- Y8
  "num-y8-01": () => V(Math.sqrt(144)), "num-y8-02": () => V(4 ** 3), "num-y8-03": () => V(mul(R(3, 5), R(45))),
  "num-y8-04": (q) => only(q, (o) => sfOK(o) && Math.abs(sfVal(o)! - 4500000) < 1e-6),
  "num-y8-05": () => S((0.04729).toPrecision(2)),
  "num-y8-06": () => V(80 * (1 - 0.15)),
  "num-y8-07": () => { const r = [4.8, 31, 0.51].map((x) => Number(x.toPrecision(1))); return V((r[0] * r[1]) / r[2]); },
  "num-y8-08": (q) => { const t = add(R(2, 3), R(3, 4)); accVal(q, t); return V(t); },
  "num-y8-09": () => V(((290 - 250) / 250) * 100),
  "num-y8-10": (q) => only(q, (o) => sfOK(o) && Math.abs(sfVal(o)! - 2e4 * 3.5e3) < 1),
  // ---- Y9
  "num-y9-01": (q) => only(q, (o) => pw(o) === 3 ** 4 * 3 ** 2),
  "num-y9-02": () => V(5 ** 0), "num-y9-03": () => V(2 ** -3),
  "num-y9-04": (q) => only(q, (o) => { const m = o.match(/^a([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/); return !!m && Number(fromSup(m[1])) === 7 - 3; }),
  "num-y9-05": () => V((3e5) / (6e2)), "num-y9-06": () => V(2.4 * 10 ** -3), "num-y9-07": () => V(12 - 0.5),
  "num-y9-08": () => { if (2 ** 2 * 3 * 7 !== 84 || 2 * 3 ** 2 * 7 !== 126) throw new Error("factorisation in prompt wrong"); return V(gcd(84, 126)); },
  "num-y9-09": (q) => only(q, (o) => { const m = o.match(/^([\d.]+) (≤|<) x (≤|<) ([\d.]+)$/); if (!m) return false; const lo = 6.4 - 0.05, hi = 6.4 + 0.05; return Math.abs(+m[1] - lo) < 1e-9 && m[2] === "≤" && m[3] === "<" && Math.abs(+m[4] - hi) < 1e-9; }),
  "num-y9-10": () => V(36 / 0.8),
};
void div; void lcm; void ({} as Exp);
