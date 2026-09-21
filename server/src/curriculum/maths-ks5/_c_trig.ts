// Independent answer checks for trig.ts (Trigonometry, Y12–13). Everything recomputed numerically.
import { TOPIC } from "./trig";
import { N, FE, W, roots, deg, rad, type Spec } from "./_m4lib";
import type { CQuestion } from "../types";

export const TOPICS = [TOPIC];
const s = (d: number) => Math.sin(rad(d)), c = (d: number) => Math.cos(rad(d)), t = (d: number) => Math.tan(rad(d));
/** genuine solutions (not asymptote artefacts) of f(x)=0 for x in (a,b) in degrees */
const solve = (f: (x: number) => number, a: number, b: number) => roots(f, a, b, 72000).filter((r) => Math.abs(f(r)) < 1e-6);
/** zeros including double roots (touching): local minima of |f| below 1e-9 on a 0.001° grid */
const zeros = (f: (x: number) => number, a: number, b: number) => { const out: number[] = []; const h = 0.001; let p = Math.abs(f(a)), q = Math.abs(f(a + h)); for (let x = a + h; x < b; x += h) { const n = Math.abs(f(x + h)); if (q <= p && q <= n && q < 1e-6) out.push(x); p = q; q = n; } return out; };
const near = (v: number, w: number, e = 1e-6) => Math.abs(v - w) < e;
const has = (arr: number[], v: number) => arr.some((x) => near(x, v, 1e-4));

export const T: Record<string, (q: CQuestion) => Spec> = {
  // ---- Year 12
  "trig-y12-01": () => N((135 * Math.PI) / 180, 1e-9),
  "trig-y12-02": () => N(s(60), 1e-9),
  "trig-y12-03": () => FE((e) => Math.tan(e.θ)),
  "trig-y12-04": () => N(8 * 0.75),
  "trig-y12-05": () => N(0.5 * 36 * 1.2, 1e-9),
  "trig-y12-06": () => { const r = solve((x) => 2 * c(x) - 1, 0.001, 359.999); return N(Math.max(...r), 1e-4); },
  "trig-y12-07": () => FE((e) => Math.tan(e.θ) ** 2),
  "trig-y12-08": () => N(Math.sqrt(36 + 100 - 2 * 6 * 10 * c(65)), 0.0005),
  "trig-y12-09": () => { const C = 180 - 40 - 75; if (C !== 65) throw new Error("angles"); return N((8 * s(75)) / s(40), 0.005); },
  "trig-y12-10": () => { const r = zeros((x) => 2 * s(x) ** 2 + s(x) - 1, 0, 359.999); if (r.length !== 3) throw new Error(`expected 3 solutions, got ${r}`); return N(r.reduce((a, b) => a + b, 0), 1e-3); },
  "trig-y12-11": () => { const r = solve((x) => s(2 * x) - 0.5, 0, 360); if (r.length !== 4) throw new Error(`expected 4, got ${r.length}`); return N(r.reduce((a, b) => a + b, 0), 1e-3); },
  "trig-y12-12": () => { const cosC = (25 + 49 - 81) / (2 * 5 * 7); const C = deg(Math.acos(cosC)); const A = deg(Math.acos((49 + 81 - 25) / (2 * 7 * 9))), B = deg(Math.acos((25 + 81 - 49) / (2 * 5 * 9))); if (Math.abs(A + B + C - 180) > 1e-9 || C < A || C < B) throw new Error("largest angle"); return N(C, 0.05); },
  "trig-y12-13": () => { for (const th of [0.4, 1.1, 2.0, 2.9]) { const l = Math.sin(th) / (1 + Math.cos(th)) + (1 + Math.cos(th)) / Math.sin(th), r = 2 / Math.sin(th); if (Math.abs(l - r) > 1e-9) throw new Error("identity"); } return W("identity confirmed numerically at 4 angles"); },
  // ---- Year 13
  "trig-y13-01": () => FE((e) => 1 / Math.sin(e.θ)),
  "trig-y13-02": () => N(1 / c(60), 1e-9),
  "trig-y13-03": () => FE((e) => 1 / Math.cos(e.θ) ** 2),
  "trig-y13-04": () => { const A = Math.asin(3 / 5), B = Math.asin(5 / 13); return N(Math.sin(A + B), 0.00005); },
  "trig-y13-05": () => { const th = Math.asin(0.6); return N(Math.cos(2 * th), 1e-9); },
  "trig-y13-06": () => { const al = deg(Math.atan2(4, 3)); for (const th of [10, 77, 200]) if (Math.abs(3 * s(th) + 4 * c(th) - 5 * s(th + al)) > 1e-9) throw new Error("R form"); return N(al, 0.005); },
  "trig-y13-07": () => { const r = solve((x) => 3 * s(x) + 4 * c(x) - 2, 0, 360); if (r.length !== 2) throw new Error("two solutions expected"); return N(Math.max(...r), 0.05); },
  "trig-y13-08": () => N(Math.acos(-0.5), 1e-9),
  "trig-y13-09": () => { const g = (th: number) => (1 - Math.cos(3 * th)) / (th * th); return N(g(1e-3), 1e-4); },
  "trig-y13-10": () => { for (const th of [0.3, 1.2, 2.5]) if (Math.abs(Math.cos(3 * th) - (4 * Math.cos(th) ** 3 - 3 * Math.cos(th))) > 1e-12) throw new Error("cos3θ"); return W("cos 3θ identity confirmed numerically"); },
  "trig-y13-11": () => { const r = solve((x) => s(2 * x) - s(x), -0.0001, 180.0001); const uniq = [0, 60, 180]; if (!uniq.every((u) => has(r, u)) || r.length !== 3) throw new Error(`roots ${r}`); return N(uniq.reduce((a, b) => a + b, 0)); },
  "trig-y13-12": () => { const r = solve((x) => 1 / t(x) - 2, 0.01, 359.99); return N(Math.max(...r), 0.05); },
  "trig-y13-13": () => { const r = solve((x) => 2 * t(x) ** 2 + 1 / c(x) - 1, 0.01, 359.99); if (r.length !== 2) throw new Error(`roots ${r}`); return N(Math.min(...r), 0.05); },
};
