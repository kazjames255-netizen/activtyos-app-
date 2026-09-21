import { TOPIC as T } from "./c5eq";
import { expect, ok, same } from "./_ck";
import { TITR, titrPH } from "./_data";

const pH = (h: number) => -Math.log10(h);
export function run() {
  const a = (n: number) => `c5eq-y12-${String(n).padStart(2, "0")}`;
  const b = (n: number) => `c5eq-y13-${String(n).padStart(2, "0")}`;
  // Y12
  expect(T, a(5), 0.012 ** 2 / 0.04, 0.001);
  { const h2 = 1 - 0.8, i2 = 1 - 0.8; expect(T, a(7), 1.6 ** 2 / (h2 * i2), 0.001); }
  expect(T, a(8), 0.4 ** 2 / (0.2 ** 2 * 0.1), 0.001);
  ok(Math.abs(0.5 ** 2 / (0.1 * 0.1) - 25) < 1e-9 && 25 < 64, "q11 Q=25 < Kc=64");
  { const V = 2.0, N2 = (1 - 0.2) / V, H2 = (3 - 0.6) / V, NH3 = 0.4 / V; same("conc", N2, 0.4); same("conc", H2, 1.2); expect(T, a(14), NH3 ** 2 / (N2 * H2 ** 3), 0.002); }
  same("note Kc", 0.3 ** 2 / (0.1 ** 2 * 0.2), 45); same("note conc", 0.9 / 3.0, 0.3);
  // Y13
  expect(T, b(2), pH(0.02), 0.002);
  expect(T, b(3), pH(1e-14 / 0.05), 0.001);
  expect(T, b(4), pH(Math.sqrt(1.75e-5 * 0.1)), 0.002);
  { const h = 10 ** -2.85; expect(T, b(5), (h * h) / 0.2, 0.01); }
  // titration curve: half-equivalence pH ≈ pKa, equivalence pH, steep region, indicator
  const pKa = -Math.log10(TITR.Ka); same("pKa 4.76", pKa, 4.76, 0.002); same("pH@12.5 ≈ 4.76", titrPH(12.5), 4.76, 0.005);
  same("Ka from pH 4.76", 10 ** -4.76, 1.74e-5, 0.01); ok(Math.abs(10 ** -4.76 - 1.7e-5) / 1.7e-5 < 0.04, "1.7e-5 answer");
  ok(titrPH(25) > 8.5 && titrPH(25) < 8.9, `equivalence pH ${titrPH(25).toFixed(2)} ≈ 8.7`);
  ok(titrPH(24) < 7.2 && titrPH(26) > 10.5, `steep section 24–26: ${titrPH(24).toFixed(2)} → ${titrPH(26).toFixed(2)}`);
  ok(titrPH(0) > 2.8 && titrPH(0) < 3.0, "starts near pH 2.9"); ok(titrPH(40) > 12.3 && titrPH(40) < 12.7, "ends near 12.5");
  ok(8.2 <= titrPH(25) && titrPH(25) <= 10.0, "phenolphthalein range covers equivalence pH");
  ok(!(3.1 <= titrPH(25) && titrPH(25) <= 4.4) && !(4.4 <= titrPH(25) && titrPH(25) <= 6.2) && !(6.0 <= titrPH(25) && titrPH(25) <= 7.6), "other indicators do not");
  expect(T, b(8), pH(1.75e-5 * 0.2 / 0.1), 0.002);
  expect(T, b(10), 40 ** 2 / 60, 0.003);
  { const n = { N2: 0.2, H2: 0.6, NH3: 0.4 }, tot = 1.2, P = 200; const p = (x: number) => (P * x) / tot; expect(T, b(11), p(n.NH3) ** 2 / (p(n.N2) * p(n.H2) ** 3), 0.01); }
  same("Kw at 50C pH about 6.6", pH(2.3e-7), 6.6, 0.01);
  same("dilution", pH(1e-2 / 10), 3);
  // notes
  same("note pH HCl", pH(0.005), 2.30, 0.002); same("note buffer pH", pH(1.35e-5 * 0.3 / 0.15), 4.57, 0.002);
}
