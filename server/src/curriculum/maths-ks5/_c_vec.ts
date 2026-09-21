// Independent answer checks for vec.ts (Vectors, Y12–13): component arithmetic, cross/dot products, line intersection by solving.
import { TOPIC } from "./vec";
import { N, P, FE, W, vadd, vsub, vscale, dot, cross, norm, angleDeg, deg, type Spec } from "./_m4lib";
import type { CQuestion } from "../types";

export const TOPICS = [TOPIC];
/** "3i − j" -> [3,-1,0] */
const ijk = (s: string): number[] => { const t = s.replace(/−/g, "-").replace(/\s/g, ""); const v = [0, 0, 0]; let m: RegExpExecArray | null; const re = /([+-]?)(\d*\.?\d*)([ijk])/g; let used = 0; while ((m = re.exec(t))) { const c = m[2] === "" ? 1 : Number(m[2]); v["ijk".indexOf(m[3])] += (m[1] === "-" ? -1 : 1) * c; used += m[0].length; } if (used !== t.length) throw new Error(`ijk parse: ${s}`); return v; };
const triple = (s: string) => s.replace(/−/g, "-").match(/\(([^)]*)\)/g)!.map((g) => g.slice(1, -1).split(",").map(Number));
const par = (u: number[], v: number[]) => norm(cross(u, v)) < 1e-9;
/** solve a1 + λd1 = a2 + μd2 using components x,y (least squares on 2 eqs), report intersection or skew */
function meet(a1: number[], d1: number[], a2: number[], d2: number[]): { kind: "parallel" | "intersect" | "skew"; pt?: number[] } {
  if (par(d1, d2)) return { kind: "parallel" };
  // solve the 3 equations λd1 − μd2 = a2 − a1 by picking the pair of rows with non-zero determinant
  const rhs = vsub(a2, a1);
  for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
    const det = d1[i] * -d2[j] - -d2[i] * d1[j];
    if (Math.abs(det) < 1e-12) continue;
    const lam = (rhs[i] * -d2[j] - -d2[i] * rhs[j]) / det, mu = (d1[i] * rhs[j] - rhs[i] * d1[j]) / det;
    const p1 = vadd(a1, vscale(d1, lam)), p2 = vadd(a2, vscale(d2, mu));
    return norm(vsub(p1, p2)) < 1e-9 ? { kind: "intersect", pt: p1 } : { kind: "skew" };
  }
  throw new Error("degenerate");
}
const ptStr = (p: number[]) => `(${p.map((v) => Math.round(v)).join(", ")})`;

export const T: Record<string, (q: CQuestion) => Spec> = {
  // ---- Year 12
  "vec-y12-01": () => N(norm([5, 12])),
  "vec-y12-02": () => { const r = vadd([2, 3, 0], [1, -4, 0]); return P((o) => { const v = ijk(o); return v.every((x, i) => x === r[i]); }); },
  "vec-y12-03": () => { const r = vsub([7, 9, 0], [1, 1, 0]); return P((o) => ijk(o).every((x, i) => x === r[i])); },
  "vec-y12-04": () => N(norm([4, -7]), 0.005),
  "vec-y12-05": () => { const a = deg(Math.atan2(3, -2)); return N(a, 0.05); },
  "vec-y12-06": () => P((o) => { const v = ijk(o); return par([6, -9, 0], v); }),
  "vec-y12-07": () => { const k = 6 / -3, lam = 2 * k; if (!par([lam, 6, 0], [2, -3, 0])) throw new Error("not parallel"); return N(lam); },
  "vec-y12-08": () => N(norm(vadd([2, -1, 0], [-5, 4, 0])), 0.0005),
  "vec-y12-09": () => N(norm([2, -3, 6])),
  "vec-y12-10": () => { const u = [2, -3, 6], w = vscale(u, 21 / norm(u)); if (Math.abs(norm(w) - 21) > 1e-9) throw new Error("mag"); return N(w[2], 1e-9); },
  // AN:NB = 1:2  =>  N = A + (1/3)(B − A) ; a,b are scalars in the linear-combination check
  "vec-y12-11": () => FE((e) => e.a + (1 / 3) * (e.b - e.a)),
  "vec-y12-12": () => { const A = [1, -2], B = [7, 10], P = vadd(A, vscale(vsub(B, A), 2 / 3)); return N(P[1], 1e-9); },
  "vec-y12-13": () => { // parallelogram: midpoints of OB and AC coincide for random a, c
    for (const [a, c] of [[[3, 1, 2], [-1, 4, 5]], [[0, 2, 7], [6, -3, 1]]]) { const B = vadd(a, c); const m1 = vscale(B, 0.5), m2 = vscale(vadd(a, c), 0.5), m3 = vadd(a, vscale(vsub(c, a), 0.5)); if (norm(vsub(m1, m3)) > 1e-12 || norm(vsub(m1, m2)) > 1e-12) throw new Error("bisect"); }
    return W("diagonal midpoints coincide (checked numerically)");
  },
  // ---- Year 13
  "vec-y13-01": () => N(dot([2, -1, 3], [4, 5, 1])),
  "vec-y13-02": () => { const A = [1, 2, 3], B = [3, 2, 2], d = vsub(B, A); return P((o) => { const [a, b] = triple(o); return par(b, d) && (norm(vsub(a, A)) < 1e-12 || par(vsub(a, A), d)); }); },
  "vec-y13-03": () => { const a = [1, -2, 3], b = [-3, 6, -9]; const lam = b[0] / a[0]; if (!b.every((x, i) => x === lam * a[i])) throw new Error("not multiples"); return N(lam); },
  "vec-y13-04": () => N(angleDeg([1, 2, 2], [2, 3, 6]), 0.05),
  "vec-y13-05": () => { const r = meet([1, 2, 3], [1, 1, 2], [5, 0, 2], [-2, 4, 5]); if (r.kind !== "intersect") throw new Error(r.kind); const want = `The lines intersect at ${ptStr(r.pt!)}`; return P((o) => o === want); },
  "vec-y13-06": () => { const r = meet([0, 0, 0], [1, 1, 0], [0, 0, 1], [1, -1, 0]); const want = { parallel: "The lines are parallel", intersect: "The lines intersect", skew: "The lines are skew" }[r.kind]; return P((o) => o === want); },
  "vec-y13-07": () => { const a = [1, -1, 2], d = [2, 3, -1]; const lam = (5 - a[1]) / d[1]; const p = vadd(a, vscale(d, lam)); return N(p[0] + p[2]); },
  "vec-y13-08": () => N(norm([4, 4, 7])),
  "vec-y13-09": () => { const A = [1, 2, 3], Pt = [4, 1, 3], d = [1, 1, 1]; const AP = vsub(Pt, A); const dist = norm(cross(AP, d)) / norm(d); // cross-check by minimising |A + λd − P|
    let m = Infinity; for (let i = -20000; i <= 20000; i++) { const l = i / 2000; m = Math.min(m, norm(vsub(vadd(A, vscale(d, l)), Pt))); } if (Math.abs(m - dist) > 1e-6) throw new Error("distance"); return N(dist, 0.0005); },
  "vec-y13-10": () => N(angleDeg([2, -1, 2], [1, 4, 8]), 0.05),
  "vec-y13-11": () => { const p = 4 / 5; if (Math.abs(dot([p, 2, -1], [3, p, 4])) > 1e-12) throw new Error("not perpendicular"); return N(p, 1e-12); },
  "vec-y13-12": () => { const A = [1, 2, 3], B = [4, 5, 9]; const AB = vsub(B, A); const k = 1 + 2 * AB[0]; const C = [k, 8, 15]; if (!par(vsub(C, A), AB)) throw new Error("not collinear"); return N(k); },
  "vec-y13-13": () => { const r = meet([1, 0, 2], [2, 1, -1], [3, 2, 1], [1, -1, 1]); if (r.kind !== "skew") throw new Error(r.kind); return W("lines confirmed skew (λ = 4/3, μ = 2/3 fail the z equation)"); },
};
