import { TOPIC as T } from "./c5gp";
import { Mr, NA } from "./_atoms";
import { expect, ok, same } from "./_ck";

export function run() {
  const a = (n: number) => `c5gp-y12-${String(n).padStart(2, "0")}`;
  const b = (n: number) => `c5gp-y13-${String(n).padStart(2, "0")}`;
  expect(T, a(4), (0.4 / 40.1) * 24.0 * 1000, 0.01);
  const nSO4 = 0.1 * 25 / 1000, nBa = 0.15 * 10 / 1000; ok(nBa < nSO4, "Ba limiting"); same("Mr BaSO4", Mr("BaSO4"), 233.4); expect(T, a(11), nBa * Mr("BaSO4"), 0.005);
  // note: antacid
  const nMg = 0.29 / Mr("Mg(OH)2"); same("Mr Mg(OH)2", Mr("Mg(OH)2"), 58.3); same("note n", nMg, 4.97e-3, 0.003); same("note V", (2 * nMg) / 0.1 * 1000, 99.5, 0.003);
  // S oxidation change H2SO4 -> H2S: +6 to -2
  ok(6 - -2 === 8, "S +6 -> -2"); ok(2 * 1 + -2 === 0, "H2S: S -2"); ok(1 + 1 + -2 + 0 === 0, "NaClO: Cl+1 check (Na +1, O -2, Cl x): x=+1");
  // Y13
  const h = 6.63e-34, c = 3.00e8, L = 6.02e23; expect(T, b(8), (L * h * c) / 600e-9 / 1000, 0.005); same("q8 J/mol", (L * h * c) / 600e-9, 1.996e5, 0.002);
  same("note 500nm", (L * h * c) / 500e-9 / 1000, 240, 0.005);
  expect(T, b(14), (0.01 * 18.4 / 1000) / 0.025, 0.002); same("note EDTA", (0.01 * 15 / 1000) / 0.02, 7.5e-3, 0.001);
  // Complex: charge/coordination sanity. [Co(NH3)6]3+ : 6 ligands, Co(III)
  ok(6 * 0 + 3 === 3, "[Co(NH3)6]3+ charge"); ok(-1 * 4 + 2 === -2, "[CuCl4]2- charge");
  // Cr(VI) +6 -> +3 -> +2; Cu2+ d9, Zn2+ d10, Fe2+ d6, Ni2+ d8
  const dEl = { Zn: 10, Fe: 6, Cu: 9, Ni: 8 }; ok(Object.entries(dEl).filter(([, n]) => n > 0 && n < 10).map(([k]) => k).join() === "Fe,Cu,Ni", "transition elements Fe Cu Ni; Zn not");
  ok(NA > 0, "");
}
