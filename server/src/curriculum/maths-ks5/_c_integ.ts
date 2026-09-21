// Independent answer checks for integ.ts (Integration, Y12–13).
import { TOPIC } from "./integ";
import { N, P, W, D, I, roots, parse, SAMPLES, type Spec } from "./_m4lib";
import type { CQuestion } from "../types";

export const TOPICS = [TOPIC];
/** Predicate: option text (an antiderivative "… + c") differentiates to f at every sample x (x > 0 samples). */
const anti = (f: (x: number) => number) => (o: string) => {
  const g = parse(o.replace(/\s*\+\s*c\s*$/, ""));
  return SAMPLES.every((e) => { const h = (u: number) => g({ ...e, x: u }); return Math.abs(D(h, e.x) - f(e.x)) < 1e-6 * Math.max(1, Math.abs(f(e.x))); });
};
const trap = (f: (x: number) => number, a: number, b: number, n: number) => { const h = (b - a) / n; let s = f(a) + f(b); for (let i = 1; i < n; i++) s += 2 * f(a + i * h); return (h / 2) * s; };

export const T: Record<string, (q: CQuestion) => Spec> = {
  "integ-y12-01": () => P(anti((x) => 6 * x * x + 4 * x)),
  "integ-y12-02": () => P(anti((x) => 1 / (x * x))),
  "integ-y12-03": () => N(I((x) => 3 * x * x, 0, 2), 1e-9),
  "integ-y12-04": () => P(anti((x) => Math.sqrt(x) + 6)),
  "integ-y12-05": () => { const g = (x: number) => 3 * x * x - 4 * x + 4; if (Math.abs(D(g, 1.3) - (6 * 1.3 - 4)) > 1e-7 || g(1) !== 3) throw new Error("particular solution"); return N(g(2)); },
  "integ-y12-06": () => N(I((x) => x * x + 1, 0, 3), 1e-9),
  "integ-y12-07": () => N(I((x) => 1 / Math.sqrt(x), 1, 4), 1e-8),
  "integ-y12-08": () => { const r = roots((x) => 2 * x - x * x, -1, 3); if (r.length !== 1 && r.length !== 2) throw new Error("roots"); return N(I((x) => 2 * x - x * x, 0, 2), 0.0005); },
  "integ-y12-09": () => N(Math.abs(I((x) => x * x - 4, 0, 2)), 0.0005),
  "integ-y12-10": () => {
    const f = (x: number) => x ** 3 - 7 * x * x + 12 * x; const r = roots(f, -0.5, 4.5).map((v) => Math.round(v * 1e6) / 1e6);
    // roots at 0 (endpoint scan may miss), 3, 4; area = sum |∫| between consecutive roots inside [0,4]
    const pts = [0, 3, 4]; if (!r.some((v) => Math.abs(v - 3) < 1e-6)) throw new Error("root 3 missing");
    let tot = 0; for (let i = 0; i < pts.length - 1; i++) tot += Math.abs(I(f, pts[i], pts[i + 1])); return N(tot, 0.0005);
  },
  "integ-y12-11": () => N(3 * 12 + I(() => 2, 1, 5)),
  "integ-y12-12": () => { const k = Math.sqrt(16); if (Math.abs(I((x) => 4 * x, 1, k) - 30) > 1e-8) throw new Error("k"); return N(k); },
  "integ-y12-13": () => { const f = (x: number) => 4 * x - x * x; const r = roots(f, -1, 5, 6000); if (Math.abs(f(4)) > 1e-12) throw new Error("root 4"); void r; if (Math.abs(I(f, 0, 4) - 32 / 3) > 1e-9) throw new Error("area 32/3"); return W("area = 32/3 confirmed by quadrature"); },
  "integ-y13-01": () => P(anti((x) => Math.exp(2 * x))),
  "integ-y13-02": () => P(anti((x) => 3 / x)),
  "integ-y13-03": () => P(anti((x) => Math.cos(3 * x))),
  "integ-y13-04": () => P(anti((x) => 2 * x * (x * x + 1) ** 4)),
  "integ-y13-05": () => N(I((x) => 2 * x * Math.exp(x * x), 0, 1), 0.0005),
  "integ-y13-06": () => P(anti((x) => x * Math.exp(x))),
  "integ-y13-07": () => N(I(Math.log, 1, Math.E), 1e-8),
  "integ-y13-08": () => N(I((x) => 1 / ((x - 1) * (x + 1)), 2, 3), 0.0005),
  "integ-y13-09": () => { // solve dy/dx = 2xy, y(0)=1 by RK4 to compare with e^(x²)
    let y = 1, x = 0; const h = 1e-4; const f = (x: number, y: number) => 2 * x * y;
    for (let i = 0; i < 10000; i++) { const k1 = f(x, y), k2 = f(x + h / 2, y + (h / 2) * k1), k3 = f(x + h / 2, y + (h / 2) * k2), k4 = f(x + h, y + h * k3); y += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4); x += h; }
    return N(y, 0.0005);
  },
  "integ-y13-10": () => N(trap((x) => 1 / (1 + x), 0, 2, 4), 0.0005),
  "integ-y13-11": () => { const t = trap(Math.exp, 0, 1, 4), ex = Math.E - 1; if (!(t > ex)) throw new Error("expected an overestimate"); return P((o) => /^It is an overestimate/.test(o)); },
  "integ-y13-12": () => N(I((x) => Math.sin(x) ** 2, 0, Math.PI), 0.0005),
  "integ-y13-13": () => N(I((x) => x / Math.sqrt(x + 1), 0, 3), 0.0005),
  "integ-y13-14": () => { const F = (x: number) => 0.5 * x * x * Math.log(x) - 0.25 * x * x; const x = 2.3; if (Math.abs(D(F, x) - x * Math.log(x)) > 1e-8) throw new Error("antiderivative"); return W("antiderivative differentiates to x ln x (numerical)"); },
};
