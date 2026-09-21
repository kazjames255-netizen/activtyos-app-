// Independent answer checks for numm.ts (Numerical Methods, Y13): iterate the methods in code.
import { TOPIC } from "./numm";
import { N, P, W, D, root, type Spec } from "./_m4lib";
import type { CQuestion } from "../types";

export const TOPICS = [TOPIC];
const iter = (g: (x: number) => number, x0: number, n: number) => { let x = x0; for (let i = 0; i < n; i++) x = g(x); return x; };
const newton = (f: (x: number) => number, x0: number, n = 1, fp?: (x: number) => number) => { let x = x0; for (let i = 0; i < n; i++) x = x - f(x) / (fp ? fp(x) : D(f, x)); return x; };
const cubic = (x: number) => x ** 3 - 2 * x - 5;

export const T: Record<string, (q: CQuestion) => Spec> = {
  "numm-y13-01": () => N(cubic(2)),
  "numm-y13-02": () => { const f = (x: number) => 5 * x - 7; if (!(f(1) < 0 && f(2) > 0)) throw new Error("demo"); return P((o) => o === "There is at least one root between x = 1 and x = 2"); },
  "numm-y13-03": () => { const f = (x: number) => 1 / (x - 2); if (!(f(1) < 0 && f(3) > 0)) throw new Error("signs"); if (Math.abs(f(2 + 1e-9)) < 1e6) throw new Error("no asymptote"); return P((o) => o === "f is not continuous at x = 2"); },
  "numm-y13-04": () => N(iter((x) => Math.sqrt(x + 2), 1, 3), 0.00005),
  "numm-y13-05": () => N(iter((x) => 3 - 1 / x, 2, 3), 0.0005),
  "numm-y13-06": () => N(newton((x) => x * x - 7, 3, 1, (x) => 2 * x), 0.0005),
  "numm-y13-07": () => N(newton(cubic, 2, 1, (x) => 3 * x * x - 2), 1e-9),
  "numm-y13-08": () => { const a = root(cubic, 2, 3); if (Math.abs(cubic(2.09) + 0.051) > 0.0005 || Math.abs(cubic(2.095) - 0.005) > 0.0006) throw new Error("quoted values"); return P((o) => o === a.toFixed(2)); },
  "numm-y13-09": () => {
    const a = root(cubic, 2, 3);
    const g: Record<string, (x: number) => number> = {
      "xₙ₊₁ = (xₙ³ − 5)/2": (x) => (x ** 3 - 5) / 2,
      "xₙ₊₁ = (2xₙ + 5)^(1/3)": (x) => (2 * x + 5) ** (1 / 3),
      "xₙ₊₁ = 5/(xₙ² − 2)": (x) => 5 / (x * x - 2),
      "xₙ₊₁ = 2xₙ + 5 − xₙ³ + xₙ": (x) => 2 * x + 5 - x ** 3 + x,
    };
    return P((o) => { const f = g[o]; if (!f) throw new Error("unknown option " + o); if (Math.abs(f(a) - a) > 1e-9) throw new Error("not a rearrangement: " + o); return Math.abs(D(f, a)) < 1; });
  },
  "numm-y13-10": () => { const f = (x: number) => x ** 3 - 2 * x + 2; const seq: number[] = [0]; for (let i = 0; i < 8; i++) seq.push(newton(f, seq[i], 1, (x) => 3 * x * x - 2)); if (!seq.every((v, i) => Math.abs(v - (i % 2)) < 1e-12)) throw new Error("not alternating 0,1"); return P((o) => o === "It alternates between 0 and 1 forever"); },
  "numm-y13-11": () => N(newton((x) => Math.exp(x) - 3 * x, 1.5, 1, (x) => Math.exp(x) - 3), 0.00005),
  "numm-y13-12": () => N(iter((x) => Math.sqrt(6 + x), 1, 200), 1e-9),
  "numm-y13-13": () => { const f = (x: number) => x ** 3 + x - 3; if (!(f(1) < 0 && f(2) > 0)) throw new Error("sign"); const x1 = newton(f, 1.5, 1, (x) => 3 * x * x + 1); if (Math.abs(x1 - 1.258) > 0.0005 || Math.abs(f(1.5) - 1.875) > 1e-12) throw new Error("x1"); return W("f(1) = −1, f(2) = 7; x₁ ≈ 1.258 confirmed"); },
  "numm-y13-14": () => { // the tangent at x0 meets the x-axis at x0 − f/f′ (check on a random cubic)
    const f = (x: number) => x ** 3 - x + 0.4, x0 = 1.7, z = x0 - f(x0) / D(f, x0); if (Math.abs(f(x0) + D(f, x0) * (z - x0)) > 1e-8) throw new Error("tangent"); return P((o) => o === "xₙ₊₁ = xₙ − f(xₙ)/f′(xₙ)");
  },
};
