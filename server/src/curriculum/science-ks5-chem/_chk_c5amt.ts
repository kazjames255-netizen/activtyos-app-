import { TOPIC as T } from "./c5amt";
import { Mr, R } from "./_atoms";
import { expect, ok, same } from "./_ck";

export function run() {
  const k = (n: number) => `c5amt-y12-${String(n).padStart(2, "0")}`;
  expect(T, k(1), Mr("Ca(OH)2"), 0.002);
  expect(T, k(2), 5.85 / Mr("NaCl"), 0.005);
  expect(T, k(3), 0.25 * Mr("CaCO3"), 0.003);
  expect(T, k(4), (4.0 / Mr("NaOH")) / 0.25, 0.005);
  const V5 = (0.05 * R * 298) / 101000 * 1e6; expect(T, k(5), V5, 0.004); same("q5 explanation 1226", V5, 1226, 0.001);
  // Q6 empirical formula
  const r = [40.0 / 12.0, 6.7 / 1.0, 53.3 / 16.0]; const min = Math.min(...r); const ratio = r.map((x) => x / min);
  ok(Math.abs(ratio[0] - 1) < 0.02 && Math.abs(ratio[1] - 2) < 0.02 && Math.abs(ratio[2] - 1) < 0.02, "q6 ratio 1:2:1: " + ratio);
  // Q7
  ok(Mr("CH2O") === 30 && 180 / Mr("CH2O") === 6 && Mr("C6H12O6") === 180, "q7 C6H12O6 Mr 180");
  // Q8 titration
  const nHCl = 0.1 * 21.5 / 1000; expect(T, k(8), nHCl / 0.025, 0.001); same("note 2.15e-3", nHCl, 2.15e-3); same("note KOH n", 0.15 * 18.4 / 1000, 2.76e-3); same("note KOH c", 0.15 * 18.4 / 1000 / 0.02, 0.138);
  // Q9 % yield
  const th = (6.0 / Mr("CaCO3")) * Mr("CaO"); same("q9 theoretical 3.363", th, 3.363, 0.001); expect(T, k(9), (2.0 / th) * 100, 0.003);
  // Q10 limiting
  const nMg = 2.43 / 24.3, nHCl2 = 1.0 * 0.1; ok(nHCl2 / 2 < nMg, "HCl limiting"); expect(T, k(10), (nHCl2 / 2) * 24.0, 0.001);
  // Q11 water of crystallisation
  const nW = (2.49 - 1.59) / 18.0, nCu = 1.59 / Mr("CuSO4"); same("x", nW / nCu, 5, 0.01); expect(T, k(11), Math.round(nW / nCu), 0);
  same("q11 Mr CuSO4", Mr("CuSO4"), 159.6);
  // Q12 Mr from pV=nRT
  const n12 = (100e3 * 100e-6) / (R * 300); expect(T, k(12), 0.24 / n12, 0.003); same("q12 n", n12, 4.01e-3, 0.002);
  // Q13 Avogadro
  expect(T, k(13), 0.5 * 6.02e23, 0.001);
  // Q14 atom economy
  same("NaBr Mr", Mr("NaBr"), 102.9); expect(T, k(14), (Mr("C2H5OH") / (Mr("C2H5OH") + Mr("NaBr"))) * 100, 0.003);
  // note worked gas example
  const v = (0.02 * R * 350) / 1e5; same("note gas example", v * 1e6, 582, 0.002);
}
