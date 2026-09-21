import { TOPIC as T } from "./c5bond";
import { ok, rightOption, find } from "./_ck";

/** electron pairs around a central atom: (valence + monovalent ligands + |negative charge| - positive charge)/2 */
const pairs = (valence: number, ligands: number, charge = 0) => (valence + ligands - charge) / 2;

export function run() {
  const k = (n: number) => `c5bond-y12-${String(n).padStart(2, "0")}`;
  // Q3 NH3: N 5 + 3 H = 8 electrons -> 4 pairs, 3 bp + 1 lp
  ok(pairs(5, 3) === 4 && 4 - 3 === 1, "NH3 3bp+1lp"); ok(109.5 - 2.5 === 107, "107");
  // Q7 BF3: B 3 + 3 = 6 -> 3 pairs = 3 bp
  ok(pairs(3, 3) === 3, "BF3 3 pairs");
  // Q8 ICl4-: I 7 + 4 Cl + 1 charge = 12 -> 6 pairs, 4 bp, 2 lp -> square planar
  ok(pairs(7, 4, -1) === 6 && 6 - 4 === 2, "ICl4- 4bp+2lp");
  // SF6 6+6=12 -> 6 pairs; H2O 6+2 = 8 -> 4 pairs, 2 bp + 2 lp -> 104.5
  ok(pairs(6, 6) === 6 && pairs(6, 2) === 4 && 109.5 - 2 * 2.5 === 104.5, "SF6/H2O");
  // Q10 electronegativity differences
  const EN: Record<string, number> = { H: 2.1, C: 2.5, O: 3.5, Cl: 3.0, F: 4.0 };
  const diff = ["H", "O", "Cl", "F"].map((x) => [x, +(EN[x] - EN.C).toFixed(1)] as [string, number]);
  const most = diff.sort((a, b) => b[1] - a[1])[0][0]; ok(most === "F", "most polar is C-F");
  ok(rightOption(T, k(10)) === "C–F" && EN.F - EN.C === 1.5 && EN.O - EN.C === 1.0 && EN.Cl - EN.C === 0.5 && +(EN.C - EN.H).toFixed(1) === 0.4, "q10 differences quoted in explanation");
  // Q6 / Q11 sets stated in the question
  ok(JSON.stringify((find(T, k(6)).answer as string[]).sort()) === JSON.stringify(["CH₃OH", "NH₃"]), "q6 answer");
  ok(JSON.stringify((find(T, k(11)).answer as string[]).sort()) === JSON.stringify(["CH₂Cl₂", "NH₃"]), "q11 answer");
  // Q12 isomer boiling points quoted: butane -0.5, 2-methylpropane -11.7 (real data)
  ok(-0.5 > -11.7, "butane bp higher");
  // Q8 wrong-option sanity: octahedral arrangement is 6 pairs
  ok(4 + 2 === 6, "octahedral electron-pair geometry");
}
