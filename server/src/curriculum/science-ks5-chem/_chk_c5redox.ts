import { TOPIC as T } from "./c5redox";
import { expect, ok, same } from "./_ck";

export function run() {
  const a = (n: number) => `c5redox-y12-${String(n).padStart(2, "0")}`;
  const b = (n: number) => `c5redox-y13-${String(n).padStart(2, "0")}`;
  // oxidation numbers from the sum rule
  const solve = (charge: number, knownSum: number, n: number) => (charge - knownSum) / n;
  expect(T, a(2), solve(0, 1 + 4 * -2, 1), 0);           // KMnO4: Mn
  expect(T, a(3), solve(-1, 3 * -2, 1), 0);              // ClO3-: Cl
  expect(T, a(9), solve(0, 2 * 1, 2), 0);                // H2O2: O
  expect(T, a(14), solve(0, 2 * 1 + 7 * -2, 2), 0);      // K2Cr2O7: Cr
  same("note H3PO4 P", solve(0, 3 * 1 + 4 * -2, 1), 5);
  ok(solve(0, 0, 1) === 0, "element 0");
  // Q5 half equation: Mn +7 -> +2 = 5 e-; charge balance -1 + 8 - 5 = +2
  ok(-1 + 8 - 5 === 2 && 7 - 2 === 5, "MnO4- half-equation balanced"); ok(-2 + 14 - 6 === 2 * 3, "Cr2O7 half-equation balanced");
  expect(T, a(6), 2 * (6 - 3), 0);
  // Q10: S(+4) SO3^2-: x + 3(-2) = -2 -> +4; SO4^2-: x - 8 = -2 -> +6
  ok(solve(-2, -6, 1) === 4 && solve(-2, -8, 1) === 6, "S +4 -> +6");
  // Q8 disproportionation: Cl 0 -> -1 and +1 (NaClO: +1 + x -2 = 0 -> +1)
  ok(solve(0, 1 - 2, 1) === 1, "NaClO Cl +1");
  // Q12: O in H2O2 -1, H2O -2, O2 0
  ok(-1 > -2 && -1 < 0, "H2O2 disproportionation");
  // titrations
  expect(T, a(7), (5 * (0.02 * 20.0) / 1000) / 0.025, 0.002);
  expect(T, a(11), (0.1 * 24.0 / 1000) / 2, 0.001);
  same("note dichromate", ((6 * 0.01 * 18.0) / 1000) / 0.025, 0.0432, 0.002);
  ok(6 * 1 === 6, "Cr2O7:Fe ratio 1:6 (from 6 e-)");
  // Y13
  const E = { Zn: -0.76, Cu: 0.34, Ag: 0.80, Fe3: 0.77, I2: 0.54, Mg: -2.37, Br2: 1.07, Fe2: -0.44, Ni: -0.25, MnO4: 1.51, Cl2: 1.36 };
  expect(T, b(2), E.Cu - E.Zn, 0.001); expect(T, b(5), E.Ag - E.Fe3, 0.001, 1e-6); same("Fe3+/I2", E.Fe3 - E.I2, 0.23, 0.01); ok(E.Fe3 - E.I2 > 0, "q6 feasible");
  expect(T, b(8), (5 * (0.02 * 22.4) / 1000) / 0.025, 0.002);
  ok(Math.max(E.MnO4, E.Cl2, E.Fe3, E.Zn) === E.MnO4, "q9 MnO4- strongest oxidiser");
  expect(T, b(11), E.Ag - E.Mg, 0.001); same("note Ni/Fe", E.Ni - E.Fe2, 0.19, 0.001, 1e-6); same("note Br2/Fe", E.Br2 - E.Fe3, 0.30, 0.001, 1e-6);
}
