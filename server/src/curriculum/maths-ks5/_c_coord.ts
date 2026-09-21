// Independent answer checks for coord.ts (Coordinate Geometry, Y12–13).
import { TOPIC } from "./coord";
import { N, F, P, STR, W, roots, parse, type Spec } from "./_m4lib";
import type { CQuestion } from "../types";

export const TOPICS = [TOPIC];
const hyp = (a: number, b: number) => Math.sqrt(a * a + b * b);
const sg = (s: string) => (s === "+" ? 1 : -1);
/** relation "L = R" holds for every sampled parameter value of the curve (x(t), y(t)) */
const relHolds = (xf: (t: number) => number, yf: (t: number) => number) => (o: string) => {
  const [l, r] = o.split("=").map((s) => parse(s));
  return [0.3, 0.7, 1.1, 1.6, 2.3, 2.9, 4.1].every((t) => { const env = { x: xf(t), y: yf(t), t }; return Math.abs(l(env) - r(env)) < 1e-9 * Math.max(1, Math.abs(l(env))); });
};

export const T: Record<string, (q: CQuestion) => Spec> = {
  "coord-y12-01": () => N((12 - 3) / (4 - 1)),
  "coord-y12-02": () => STR(`(${(2 + 8) / 2}, ${(-4 + 6) / 2})`),
  "coord-y12-03": () => N(hyp(7 - 1, 10 - 2)),
  "coord-y12-04": () => F((x) => 5 + -3 * (x - 2)),
  "coord-y12-05": () => { const m = -1 / 2; return F((x) => 1 + m * (x - 4)); },
  "coord-y12-06": () => { // x² + y² − 6x + 4y − 12 = 0  ->  centre (−D/2, −E/2), r = √(D²/4 + E²/4 − F)
    const D = -6, E = 4, Fc = -12, cx = -D / 2, cy = -E / 2, r = Math.sqrt(D * D / 4 + E * E / 4 - Fc);
    return P((o) => { const m = o.replace(/−/g, "-").match(/^centre \((-?\d+), (-?\d+)\), radius (\d+)$/); return !!m && +m[1] === cx && +m[2] === cy && +m[3] === r; });
  },
  "coord-y12-07": () => P((o) => { const m = o.match(/^\(x ([+−]) (\d+)\)² \+ \(y ([+−]) (\d+)\)² = (\d+)$/); if (!m) return false; const a = -sg(m[1] === "+" ? "+" : "-") * +m[2], b = -sg(m[3] === "+" ? "+" : "-") * +m[4]; return a === -1 && b === 4 && +m[5] === 9; }),
  "coord-y12-08": () => { const d2 = (5 - 2) ** 2 + (6 - 2) ** 2; return P((o) => o === (d2 < 25 ? "inside the circle" : d2 === 25 ? "on the circle" : "outside the circle")); },
  "coord-y12-09": () => { const m = -1 / (4 / 3); if (Math.abs(9 + 16 - 25) > 0) throw new Error("point"); return N(4 + m * (0 - 3), 1e-12); },
  "coord-y12-10": () => { const disc = (k: number) => 4 * k * k - 8 * (k * k - 8); const r = roots(disc, 0, 10); return N(r[0], 1e-6); },
  "coord-y12-11": () => { // (x−1)² + (x+1)² = 10  =>  2x² + 2 − 10 = 0
    const xs = roots((x) => (x - 1) ** 2 + (x + 3 - 2) ** 2 - 10, -10, 10); if (xs.length !== 2) throw new Error("two points expected");
    return N(hyp(xs[1] - xs[0], (xs[1] + 3) - (xs[0] + 3)), 0.0005);
  },
  "coord-y12-12": () => N(((4 - -2) ** 2 + (5 - 1) ** 2) / 4),
  "coord-y12-13": () => { const A = [0, 0], B = [4, 2], C = [-1, 2]; const mAB = (B[1] - A[1]) / (B[0] - A[0]), mAC = (C[1] - A[1]) / (C[0] - A[0]); if (Math.abs(mAB * mAC + 1) > 1e-12) throw new Error("not right-angled"); const area = 0.5 * hyp(4, 2) * hyp(-1, 2); if (Math.abs(area - 5) > 1e-9) throw new Error("area"); return W("gradients ½ and −2 (product −1); area 5 confirmed"); },
  // ---- Year 13
  "coord-y13-01": () => F((x) => (x / 2) ** 2),
  "coord-y13-02": () => STR(`(${3 + 1}, ${2 * 3 * 3})`),
  "coord-y13-03": () => { for (const t of [0.2, 1, 2.5, 4]) if (Math.abs((3 * Math.cos(t)) ** 2 + (3 * Math.sin(t)) ** 2 - 9) > 1e-12) throw new Error("not a circle of radius 3"); return P((o) => o === "a circle of radius 3"); },
  "coord-y13-04": () => P(relHolds((t) => t * t, (t) => 2 * t)),
  "coord-y13-05": () => P(relHolds((t) => 2 * Math.cos(t), (t) => 3 * Math.sin(t))),
  "coord-y13-06": () => F((x) => (x + 1) ** 2),
  "coord-y13-07": () => { const t = -0.5; if (2 * t + 1 !== 0) throw new Error("x=0"); return N(t * t - 3); },
  "coord-y13-08": () => N(3 * 2 ** 2 / 2),
  "coord-y13-09": () => { const t = roots((t) => 15 * t - 5 * t * t, 0.5, 5)[0]; return N(12 * t, 1e-6); },
  "coord-y13-10": () => { let m = -Infinity; for (let i = 0; i <= 300000; i++) { const t = (3 * i) / 300000; m = Math.max(m, 15 * t - 5 * t * t); } return N(m, 1e-6); },
  "coord-y13-11": () => P(relHolds((t) => t + 1 / t, (t) => t - 1 / t)),
  "coord-y13-12": () => { const ts = roots((t) => -2 + 4 * Math.sin(t), 0, 2 * Math.PI); return N(Math.max(...ts.map((t) => 1 + 4 * Math.cos(t))), 0.0005); },
  "coord-y13-13": () => { for (const t of [0.4, 1.3, -2]) { const x = 3 * t, y = t * t + 2 * t; if (Math.abs(9 * y - (x * x + 6 * x)) > 1e-9) throw new Error("cartesian form"); } return W("9y = x² + 6x confirmed at sample t"); },
};
