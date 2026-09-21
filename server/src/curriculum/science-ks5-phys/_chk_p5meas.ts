import { TOPIC } from "./p5meas";
import { PEND } from "./_data";
import { ok, opt, sfx, same } from "./_ck";

export function run() {
  const T = TOPIC, k = (n: number) => `p5meas-y12-${String(n).padStart(2, "0")}`;
  opt(T, k(1), "newton");
  sfx(T, k(2), 45e-9, 2);
  sfx(T, k(3), (0.6 / 84.0) * 100, 2, ["84.0", "0.6"]);
  sfx(T, k(4), (5 / 250 + 2 / 40) * 100, 2, ["250", "40"]);
  sfx(T, k(7), 3 * (0.06 / 3.0) * 100, 2, ["3.00", "0.06"]);
  // homogeneity: dimension vectors [L, T] for each term
  const dim = (l: number, t: number) => `${l},${t}`;
  const s = dim(1, 0), ut = dim(1, 0), half_at2 = dim(1, 0), atsq = dim(1, 0); // a t² = m s⁻² s² = m
  ok(s === ut && ut === half_at2, "s = ut + ½at² homogeneous");
  const v = dim(1, -1), at2 = dim(1, 0); ok(v !== at2, "v = u + at² NOT homogeneous"); ok(atsq !== dim(1, -1), "at² is a length");
  ok(dim(1, 0) !== dim(1, -1), "s = ut + ½at: ½at is a velocity, s a length");
  ok(dim(2, -2) !== dim(2, 0), "v² = u² + 2at²: at² length not velocity²");
  // pendulum graph: gradient from the marked points, g = 4π²/gradient; the points must lie near the best-fit line
  const grad = (PEND.B[1] - PEND.A[1]) / (PEND.B[0] - PEND.A[0]);
  sfx(T, k(10), (4 * Math.PI ** 2) / grad, 3, []);
  const n = PEND.L.length, mx = PEND.L.reduce((a, b) => a + b) / n, my = PEND.T2.reduce((a, b) => a + b) / n;
  const ls = PEND.L.reduce((a, x, i) => a + (x - mx) * (PEND.T2[i] - my), 0) / PEND.L.reduce((a, x) => a + (x - mx) ** 2, 0);
  same("least-squares gradient close to marked-line gradient", ls, grad, 0.02);
  sfx(T, k(11), ((13.1 - 11.9) / 2 / 12.4) * 100, 2, ["12.4", "13.1", "11.9"]);
  sfx(T, k(12), (0.002 / 0.358 + 2 * (0.02 / 1.2)) * 100, 2, ["0.358", "1.20"]);
  // note worked examples
  same("note: 0.01/0.62", (0.01 / 0.62) * 100, 1.6, 0.01); same("note: doubled", 2 * 1.6, 3.2);
}
