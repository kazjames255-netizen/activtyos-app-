import { parseFormula, parseEquation, atomTotals, isBalanced, solveBalance, formatFormula, unbalancedElements, equationChecker } from "./chem";
import { BANK } from "./bank";

let n = 0, fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  n++;
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a !== b) { fail++; console.error(`FAIL ${name}: got ${a} want ${b}`); }
}
const throws = (name: string, f: () => unknown) => { n++; try { f(); fail++; console.error(`FAIL ${name}: no throw`); } catch { /* ok */ } };
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

// parser
eq("H2O", parseFormula("H2O"), { H: 2, O: 1 });
eq("Ca(OH)2", parseFormula("Ca(OH)2"), { Ca: 1, O: 2, H: 2 });
eq("Al2(SO4)3", parseFormula("Al2(SO4)3"), { Al: 2, S: 3, O: 12 });
eq("CuSO4.5H2O", parseFormula("CuSO4.5H2O"), { Cu: 1, S: 1, O: 9, H: 10 });
eq("dot middle", parseFormula("CuSO4·5H2O"), { Cu: 1, S: 1, O: 9, H: 10 });
eq("Fe2O3", parseFormula("Fe2O3"), { Fe: 2, O: 3 });
eq("C12H22O11", parseFormula("C12H22O11"), { C: 12, H: 22, O: 11 });
eq("(NH4)2SO4", parseFormula("(NH4)2SO4"), { N: 2, H: 8, S: 1, O: 4 });
eq("nested", parseFormula("K4[Fe(CN)6]"), { K: 4, Fe: 1, C: 6, N: 6 });
eq("state symbol", parseFormula("NaCl(aq)"), { Na: 1, Cl: 1 });
eq("Mg no digit", parseFormula("Mg"), { Mg: 1 });
eq("CO vs Co", parseFormula("Co"), { Co: 1 });
eq("CO", parseFormula("CO"), { C: 1, O: 1 });
throws("bad bracket", () => parseFormula("Ca(OH2"));
throws("bad char", () => parseFormula("h2o"));
throws("empty", () => parseFormula(""));
throws("no arrow", () => parseEquation("H2 + O2"));
eq("arrow ->", parseEquation("CH4 + O2 -> CO2 + H2O"), { left: ["CH4", "O2"], right: ["CO2", "H2O"] });
eq("arrow unicode", parseEquation("CH4 + O2 → CO2 + H2O"), { left: ["CH4", "O2"], right: ["CO2", "H2O"] });
eq("arrow =", parseEquation("H2+O2=H2O"), { left: ["H2", "O2"], right: ["H2O"] });

// format
eq("fmt Ca(OH)2", formatFormula("Ca(OH)2"), "Ca(OH)₂");
eq("fmt hydrate", formatFormula("CuSO4.5H2O"), "CuSO₄·5H₂O");
eq("fmt C12", formatFormula("C12H22O11"), "C₁₂H₂₂O₁₁");

// totals and balance
eq("totals", atomTotals("H2 + O2 -> H2O", [2, 1, 2]), { left: { H: 4, O: 2 }, right: { H: 4, O: 2 } });
eq("totals unbal", atomTotals("H2 + O2 -> H2O", [1, 1, 1]), { left: { H: 2, O: 2 }, right: { H: 2, O: 1 } });
eq("isBalanced yes", isBalanced("H2 + O2 -> H2O", [2, 1, 2]), true);
eq("isBalanced no", isBalanced("H2 + O2 -> H2O", [1, 1, 1]), false);
eq("isBalanced multiple ok", isBalanced("H2 + O2 -> H2O", [4, 2, 4]), true);
eq("isBalanced zero", isBalanced("H2 + O2 -> H2O", [0, 0, 0]), false);
eq("isBalanced length", isBalanced("H2 + O2 -> H2O", [2, 1]), false);
eq("isBalanced fraction", isBalanced("H2 + O2 -> H2O", [1, 0.5, 1]), false);
eq("unbalanced els", unbalancedElements("CH4 + O2 -> CO2 + H2O", [1, 1, 1, 1]), ["H", "O"]);
eq("unbalanced none", unbalancedElements("CH4 + O2 -> CO2 + H2O", [1, 2, 1, 2]), []);

// known answers
eq("CH4", solveBalance("CH4 + O2 -> CO2 + H2O"), [1, 2, 1, 2]);
eq("C3H8", solveBalance("C3H8 + O2 -> CO2 + H2O"), [1, 5, 3, 4]);
eq("C4H10", solveBalance("C4H10 + O2 -> CO2 + H2O"), [2, 13, 8, 10]);
eq("Fe2O3+CO", solveBalance("Fe2O3 + CO -> Fe + CO2"), [1, 3, 2, 3]);
eq("thermite", solveBalance("Al + Fe2O3 -> Al2O3 + Fe"), [2, 1, 1, 2]);
eq("Al2(SO4)3", solveBalance("Al(OH)3 + H2SO4 -> Al2(SO4)3 + H2O"), [2, 3, 1, 6]);
eq("hydrate", solveBalance("CuSO4.5H2O -> CuSO4 + H2O"), [1, 1, 5]);
eq("H2O2", solveBalance("H2O2 -> H2O + O2"), [2, 2, 1]);
eq("C2H5OH", solveBalance("C2H5OH + O2 -> CO2 + H2O"), [1, 3, 2, 3]);
eq("Fe3O4", solveBalance("Fe + H2O -> Fe3O4 + H2"), [3, 4, 1, 4]);
eq("glucose", solveBalance("C6H12O6 + O2 -> CO2 + H2O"), [1, 6, 6, 6]);
eq("unsolvable", solveBalance("H2 -> O2"), null);
eq("underdetermined", solveBalance("H2 + O2 -> H2O + H2O2"), null);

// checker
eq("checker ok", equationChecker("CH4 + O2 -> CO2 + H2O", [1, 2, 1, 2]).ok, true);
eq("checker names element", equationChecker("CH4 + O2 -> CO2 + H2O", [1, 1, 1, 2]).message, "Oxygen isn't balanced yet.");
eq("checker not smallest", equationChecker("H2 + O2 -> H2O", [4, 2, 4]).ok, false);
eq("checker zero", equationChecker("H2 + O2 -> H2O", [0, 1, 1]).ok, false);

// bank
eq("bank size", BANK.length >= 45, true);
eq("ids unique", new Set(BANK.map((x) => x.id)).size, BANK.length);
for (const lv of [1, 2, 3]) eq(`level ${lv} present`, BANK.filter((x) => x.level === lv).length >= 8, true);
eq("bank types >= 9", new Set(BANK.map((x) => x.type)).size >= 9, true);
for (const x of BANK) {
  const sol = solveBalance(x.eq);
  eq(`${x.id} solvable`, sol !== null, true);
  if (!sol) continue;
  eq(`${x.id} balanced`, isBalanced(x.eq, sol), true);
  eq(`${x.id} gcd 1`, sol.reduce((a, c) => gcd(a, c), 0), 1);
  eq(`${x.id} checker`, equationChecker(x.eq, sol).ok, true);
}
console.log(`${n} checks, ${fail} failed`);
process.exit(fail ? 1 : 0);
