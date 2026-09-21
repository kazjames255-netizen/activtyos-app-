// Independent answer checks for mech.ts (Mechanics, Y12–13): SUVAT solver, numeric integration/differentiation, moment balances, projectile simulation.
import { TOPIC } from "./mech";
import { N, P, W, suvat, D, I, root, roots, type Spec } from "./_m4lib";
import type { CQuestion } from "../types";

export const TOPICS = [TOPIC];
const g = 9.8;
const numOf = (o: string) => Number(o.replace(/[^\d.\-]/g, ""));
/** simulate a projectile (Euler-free closed form) and return {t,x,ymax} until it returns to height h0 (or ground level `floor`) */
const flight = (u: number, deg: number, y0 = 0) => {
  const th = (deg * Math.PI) / 180, vx = u * Math.cos(th), vy = u * Math.sin(th);
  const y = (t: number) => y0 + vy * t - 0.5 * g * t * t;
  const T = root(y, vy / g + 1e-9, vy / g + 60 * (1 + y0)); // first crossing of y = 0 after the apex
  let ymax = -Infinity; for (let i = 0; i <= 20000; i++) ymax = Math.max(ymax, y((T * i) / 20000));
  return { T, range: vx * T, ymax, vx, vy };
};

export const T: Record<string, (q: CQuestion) => Spec> = {
  "mech-y12-01": () => N(suvat({ u: 0, a: 3, t: 8 }).s),
  "mech-y12-02": () => N(30 / 12, 1e-12),
  "mech-y12-03": () => P((o) => Math.abs(numOf(o) - 5 * g) < 1e-9),
  "mech-y12-04": () => N(suvat({ u: 20, v: 0, a: -4 }).s, 1e-9),
  "mech-y12-05": () => { const up = suvat({ u: 14, v: 0, a: -g }).s; let m = 0; for (let i = 0; i <= 200000; i++) { const t = (i / 200000) * 3; m = Math.max(m, 14 * t - 0.5 * g * t * t); } if (Math.abs(m - up) > 1e-6) throw new Error("scan vs suvat"); return N(up, 1e-9); },
  "mech-y12-06": () => { const v = (t: number) => (t < 4 ? 3 * t : t <= 14 ? 12 : 12 - 2 * (t - 14)); return N(I(v, 0, 4, 4) + I(v, 4, 14, 4) + I(v, 14, 20, 4), 1e-6); },
  "mech-y12-07": () => N(((5 - 3) * g) / (5 + 3), 0.005),
  "mech-y12-08": () => P((o) => Math.abs(numOf(o) - Math.hypot(6, 8)) < 1e-9),
  "mech-y12-09": () => N((40 * Math.cos((30 * Math.PI) / 180)) / 5, 0.005),
  "mech-y12-10": () => P((o) => Math.abs(numOf(o) - 60 * (g + 1.5)) < 1e-9),
  "mech-y12-11": () => { const a = ((5 - 3) * g) / 8, T1 = 3 * (g + a), T2 = 5 * (g - a); if (Math.abs(T1 - T2) > 1e-9) throw new Error("tensions differ"); return N(T1, 0.005); },
  "mech-y12-12": () => { const a1 = 0.5, t1 = 40, v = a1 * t1, s1 = suvat({ u: 0, a: a1, t: t1 }).s, s2 = v * 120, s3 = suvat({ u: v, v: 0, a: -1 }).s; return N(s1 + s2 + s3, 1e-6); },
  "mech-y12-13": () => { for (const [u, a, t] of [[3, 2, 4], [10, -1.5, 5], [0, 9.8, 2.5]]) { const v = u + a * t; if (Math.abs(u * t + 0.5 * (v - u) * t - (u * t + 0.5 * a * t * t)) > 1e-9) throw new Error("area rectangle+triangle"); } return W("rectangle + triangle area equals ut + ½at² (verified)"); },
  "mech-y13-01": () => N(25 * 0.8, 1e-12),
  "mech-y13-02": () => N(20 * Math.sin((60 * Math.PI) / 180), 0.005),
  "mech-y13-03": () => N(0.4 * 5 * g, 1e-9),
  "mech-y13-04": () => { // moments about A; check equilibrium of forces too
    const RB = (100 * 3 + 40 * 2) / 6, RA = 140 - RB; const mb = RB * 6 - 100 * 3 - 40 * 2; if (Math.abs(mb) > 1e-9 || RA <= 0) throw new Error("beam"); return N(RB, 0.05);
  },
  "mech-y13-05": () => N(flight(20, 30).range, 0.005),
  "mech-y13-06": () => { const h = flight(20, 30).ymax; return P((o) => Math.abs(Number(o) - h) < 0.005 + 1e-9); },
  "mech-y13-07": () => { const mu = Math.tan((25 * Math.PI) / 180); return P((o) => Math.abs(Number(o) - mu) < 0.0005 + 1e-9); },
  "mech-y13-08": () => N(D((t) => 3 * t * t - 4 * t, 2), 1e-6),
  "mech-y13-09": () => N(I((t) => 3 * t * t - 4 * t, 0, 3), 1e-8),
  "mech-y13-10": () => { const vx = D((t) => 2 * t * t, 2), vy = D((t) => 3 * t - 1, 2); return N(Math.hypot(vx, vy), 0.0005); },
  "mech-y13-11": () => { const fr = 0.3 * 4 * g, a = (2 * g - fr) / (4 + 2); if (2 * g <= fr) throw new Error("would not move"); return N(a, 0.005); },
  "mech-y13-12": () => { // find x where reaction at support C (1 m from A) is zero: moments about D (7 m from A)
    const f = (x: number) => 80 * g * (x - 7) - 20 * g * (7 - 4); const x = root(f, 7, 8); if (x >= 8) throw new Error("beyond plank"); return N(x, 1e-6);
  },
  "mech-y13-13": () => { const t = root((t) => 45 - 0.5 * g * t * t, 0.1, 10); return N(12 * t, 0.05); },
  "mech-y13-14": () => { for (const [u, d] of [[15, 30], [22, 55], [9, 41]]) { const f = flight(u, d); const th = (d * Math.PI) / 180; if (Math.abs(f.range - (u * u * Math.sin(2 * th)) / g) > 1e-6) throw new Error("range formula"); } return W("R = u² sin2θ / g confirmed by simulation on 3 cases"); },
};
void roots;
