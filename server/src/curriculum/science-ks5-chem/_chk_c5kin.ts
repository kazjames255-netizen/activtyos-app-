import { TOPIC as T } from "./c5kin";
import { expect, ok, same, find } from "./_ck";
import { MB, ARR, arrLnK, HL } from "./_data";
import { R } from "./_atoms";

/** Maxwell–Boltzmann f(E) ∝ sqrt(E) exp(-E/kT), E in units of k*T1 (=300 K); normalised to unit area; fraction with E >= Ea */
function frac(T: number, ea: number) {
  const kT = T / MB.T1; const f = (e: number) => Math.sqrt(e) * Math.exp(-e / kT);
  let tot = 0, tail = 0; const dE = 0.001; for (let e = dE / 2; e < 60; e += dE) { tot += f(e) * dE; if (e >= ea) tail += f(e) * dE; }
  return tail / tot;
}
export function run() {
  const a = (n: number) => `c5kin-y12-${String(n).padStart(2, "0")}`;
  const b = (n: number) => `c5kin-y13-${String(n).padStart(2, "0")}`;
  // Y12
  const fA = frac(MB.T1, MB.Ea), fB = frac(MB.T2, MB.Ea); ok(fB > fA * 1.5, `Boltzmann: tail fraction B ${fB.toFixed(3)} > A ${fA.toFixed(3)}`);
  const peak = (T: number) => { const kT = T / MB.T1; let best = 0, bx = 0; let tot = 0; for (let e = 0.0005; e < 60; e += 0.001) tot += Math.sqrt(e) * Math.exp(-e / kT) * 0.001; for (let e = 0.001; e < 10; e += 0.001) { const v = Math.sqrt(e) * Math.exp(-e / kT) / tot; if (v > best) { best = v; bx = e; } } return { best, bx }; };
  ok(peak(MB.T2).best < peak(MB.T1).best && peak(MB.T2).bx > peak(MB.T1).bx, "curve B (higher T) has lower peak further right");
  expect(T, a(5), (0.2 - 0.14) / 40, 0.001);
  ok(Math.abs(80 / 41 - 1.95) < 0.01, "q10 ratio 1.95");
  expect(T, a(13), 2 ** 3, 0);
  ok(90 + 60 === 150 && 55 + 60 === 115, "q14 reverse Ea"); same("note syringe", 36 / 90, 0.4);
  // Y13: initial-rates data
  const r = { e1: 2.0e-3, e2: 8.0e-3, e3: 4.0e-3 };
  const mA = Math.log2(r.e2 / r.e1), mB = Math.log2(r.e3 / r.e1); ok(mA === 2 && mB === 1, "orders 2 and 1");
  expect(T, b(2), mA + mB, 0); expect(T, b(3), r.e1 / (0.1 ** mA * 0.1 ** mB), 0.001);
  ok(find(T, b(3)).prompt.includes("2.0 × 10⁻³"), "q3 uses exp 1 data");
  // half-life graph: constant t1/2 -> first order; contrast with second order
  const A = (t: number) => HL.A0 * 2 ** (-t / HL.tHalf); ok(close2(A(50), 0.4) && close2(A(100), 0.2) && close2(A(150), 0.1), "constant half life 50 s");
  expect(T, b(6), Math.LN2 / 50, 0.004);
  // Arrhenius from the labelled points (rounded to 2 dp as drawn)
  const y1 = +arrLnK(0.003).toFixed(2), y2 = +arrLnK(0.0034).toFixed(2); ok(y1 === 0.34 && y2 === -2.55, `labelled points ${y1}, ${y2}`);
  const grad = (y2 - y1) / (0.0034 - 0.003); same("gradient -7225", grad, -7225, 0.001); expect(T, b(8), (-grad * R) / 1000, 0.002); same("Ea from line = 60", (ARR.Ea) / 1000, 60);
  // two-temperature
  const k2 = 2.0e-3 * Math.exp((50000 / R) * (1 / 300 - 1 / 310)); same("q10 exponent", (50000 / R) * (1 / 300 - 1 / 310), 0.647, 0.002); expect(T, b(10), k2, 0.004);
  expect(T, b(13), 3 ** 2 * 0.5, 0);
  // note examples
  same("note k", 4.5e-4 / 0.15, 3.0e-3); const ex = (75000 / R) * (1 / 298 - 1 / 308); same("note ln", ex, 0.983, 0.002); same("note ratio", Math.exp(ex), 2.67, 0.003);
}
const close2 = (x: number, y: number) => Math.abs(x - y) < 1e-9;
