// Run: server/node_modules/.bin/tsx features/learninghub/tools/science/formulae/formulae.selftest.ts
import { checkQuantity, toSF } from "../../engine/quantity";
import { makeRng } from "../../engine/rng";
import { FORMULAE, formulaById, GROUP_ORDER, G_FIELD, type Values } from "./formulae";
import { convertUnit, findUnit, formatSF, readValue, sensibleValue, standardForm, unitOptions } from "./units";
import { generateQuestion, workedForQuestion, workedSolution } from "./worked";

let n = 0, bad = 0;
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.error("FAIL", m); } };
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

// library shape
ok(FORMULAE.length >= 22, `at least 22 formulae (${FORMULAE.length})`);
ok(new Set(FORMULAE.map((f) => f.id)).size === FORMULAE.length, "unique ids");
ok(GROUP_ORDER.every((g) => FORMULAE.some((f) => f.group === g)), "every group has a formula");
for (const id of ["speed", "acceleration", "density", "pressure", "force", "weight", "work", "ke", "gpe", "power-work", "power-energy", "efficiency", "wave", "ohm", "charge", "power-iv", "energy-pt", "energy-qv", "moment", "shc", "spring", "magnification", "pct-change", "yield", "moles", "concentration"])
  ok(!!formulaById(id), `has ${id}`);

// known values
const S = (id: string, u: string, v: Values) => formulaById(id)!.solveFor(u, v);
ok(near(S("speed", "v", { d: 100, t: 20 }), 5), "speed 100/20");
ok(near(S("weight", "W", { m: 5, g: G_FIELD }), 49), "weight 5kg = 49 N");
ok(near(S("ke", "E", { m: 2, v: 3 }), 9), "KE 2kg 3m/s = 9 J");
ok(near(S("ke", "v", { E: 9, m: 2 }), 3), "KE solve v");
ok(near(S("gpe", "E", { m: 2, g: 9.8, h: 10 }), 196), "GPE");
ok(near(S("efficiency", "η", { U: 30, T: 120 }), 25), "efficiency 25%");
ok(near(S("ohm", "R", { V: 12, I: 3 }), 4), "R = V/I");
ok(near(S("shc", "Δθ", { ΔE: 8400, m: 2, c: 4200 }), 1), "shc dT");
ok(near(S("pct-change", "p", { N: 120, O: 80 }), 50), "pct change +50");
ok(near(S("yield", "Y", { A: 8, T: 10 }), 80), "yield 80");
ok(near(S("moles", "n", { m: 44, Mr: 44 }), 1), "1 mole");
ok(near(S("period", "f", { T: 0.02 }), 50), "f=1/T");
ok(Number.isNaN(S("speed", "v", { d: 10 })), "missing value gives NaN");
ok(Number.isNaN(S("speed", "zzz", { d: 10, t: 2 })), "unknown variable gives NaN");
ok(formulaById("force")!.triangle?.top === "F" && formulaById("speed")!.triangle?.top === "d", "triangles laid out");

// round trip: EVERY formula, EVERY variable, seeded random values
let trips = 0, tripFail = 0;
for (const f of FORMULAE) {
  const rng = makeRng(f.id.length * 977 + 5);
  for (let i = 0; i < 20; i++) {
    const vals: Values = {};
    for (const x of f.vars) vals[x.sym] = sensibleValue(rng, x.lo, x.hi, 3);
    if (f.valid && !f.valid(vals)) { /* solve back still works mathematically */ }
    // make vals self-consistent: compute subject from the rest
    const subj = f.solveFor(f.subject, vals); vals[f.subject] = subj;
    for (const target of f.vars) {
      const rest: Values = {}; for (const x of f.vars) if (x.sym !== target.sym) rest[x.sym] = vals[x.sym]!;
      const back = f.solveFor(target.sym, rest); trips++;
      if (!near(back, vals[target.sym]!)) { tripFail++; console.error("round trip", f.id, target.sym, back, vals[target.sym]); }
    }
  }
  ok(f.vars.every((x) => typeof f.rearranged[x.sym] === "string" && f.rearranged[x.sym]!.startsWith(x.sym + " =")), `${f.id}: rearrangement text for every variable`);
}
ok(trips > 1000 && tripFail === 0, `round trips consistent (${trips} tried, ${tripFail} failed)`);

// units
ok(near(convertUnit(250, "cm", "m")!, 2.5), "250 cm = 2.5 m");
ok(near(convertUnit(3.2, "km", "m")!, 3200), "km to m");
ok(near(convertUnit(450, "g", "kg")!, 0.45), "g to kg");
ok(near(convertUnit(1200, "mg", "g")!, 1.2), "mg to g");
ok(near(convertUnit(2, "h", "s")!, 7200) && near(convertUnit(3, "min", "s")!, 180), "h, min to s");
ok(near(convertUnit(5, "kJ", "J")!, 5000) && near(convertUnit(2, "MJ", "J")!, 2e6), "kJ, MJ to J");
ok(near(convertUnit(2.4, "kW", "W")!, 2400), "kW to W");
ok(near(convertUnit(40, "ms", "s")!, 0.04), "ms to s");
ok(near(convertUnit(500, "cm³", "m³")!, 5e-4), "cm³ to m³");
ok(near(convertUnit(250, "cm3", "dm³")!, 0.25), "cm3 typed, to dm³");
ok(near(convertUnit(36, "km/h", "m/s")!, 10), "km/h to m/s");
ok(near(convertUnit(8, "g/cm³", "kg/m³")!, 8000), "g/cm³ to kg/m³");
ok(convertUnit(3, "cm", "s") === null, "cm to s refused");
ok(findUnit("ohm")?.symbol === "Ω" && findUnit("KW")?.symbol === "kW" && findUnit("m/s2")?.symbol === "m/s²", "unit aliases");
ok(findUnit("blorp") === null, "unknown unit is null");
ok(unitOptions("m").includes("cm") && !unitOptions("m").includes("g"), "unit options same dimension only");
const rv = readValue("20 cm", "m", "m"); ok("value" in rv && near(rv.value, 0.2), "typed prefix overrides selector");
const rv2 = readValue("3.2 × 10^4", "J", "J"); ok("value" in rv2 && near(rv2.value, 32000), "standard form typed");
const rv3 = readValue("5 s", "m", "m"); ok("error" in rv3, "wrong-dimension unit rejected");
ok("error" in readValue("abc", "m", "m"), "non-number rejected");

// s.f. and standard form
ok(toSF(0.0034567, 2) === 0.0035 && toSF(12345, 3) === 12300, "s.f. rounding");
ok(formatSF(2.5, 3) === "2.50", "trailing zero kept 2.50");
ok(formatSF(0.04567, 2) === "0.046", "0.046");
ok(formatSF(12000, 3) === "1.20 × 10⁴", "12000 @3 s.f. in standard form");
ok(formatSF(149.6, 3) === "150", "149.6 @3 = 150");
ok(standardForm(32000) === "3.2 × 10⁴", "3.2 × 10⁴");
ok(standardForm(0.00045) === "4.5 × 10⁻⁴", "4.5 × 10⁻⁴");
ok(standardForm(3.2e4, 3) === "3.20 × 10⁴", "std form with s.f.");

// worked solutions
const sp = workedSolution(formulaById("speed")!, "v", { d: 150, t: 12 }, 3);
ok(sp.answer.value === 12.5 && sp.answer.text === "12.5 m/s", "worked speed answer 12.5 m/s");
ok(sp.steps[sp.steps.length - 1]!.text.includes("12.5 m/s"), "last step shows final number and unit");
ok(sp.steps.some((s) => s.text.includes("150 ÷ 12")), "substitution shows 150 ÷ 12");
ok(!sp.steps.some((s) => s.label === "Rearrange"), "no rearrange step when unknown is the subject");
const tw = workedSolution(formulaById("speed")!, "t", { v: 5, d: 100 }, 2);
ok(tw.steps.some((s) => s.label === "Rearrange" && s.text.includes("t = d ÷ v")), "rearrange step when needed");
ok(tw.steps.map((s) => s.n).join() === tw.steps.map((_, i) => i + 1).join(), "steps numbered 1..n");
const kw = workedSolution(formulaById("ke")!, "v", { E: 9, m: 2 }, 3);
ok(kw.answer.text === "3.00 m/s" && kw.steps.some((s) => s.text.includes("√(2 × 9 ÷ 2)")), "KE worked with root");
const neg = workedSolution(formulaById("pct-change")!, "p", { N: 60, O: 80 }, 3);
ok(neg.answer.value === -25 && neg.steps.some((s) => s.text.includes("(60 − 80) ÷ 80 × 100")), "percentage decrease worked");

// question generation
let gen = 0, badGen = 0, mismatch = 0;
for (const f of FORMULAE) {
  for (let seed = 1; seed <= 500; seed++) {
    const q = generateQuestion(f.id, seed * 7919);
    gen++;
    const vals = [q.expected.value, ...q.givens.map((g) => g.value)];
    if (vals.some((x) => !Number.isFinite(x) || Math.abs(x) > 1e9 || Math.abs(x) < 1e-7 || x === 0)) { badGen++; console.error("absurd", f.id, seed, q.prompt); }
    if (seed % 25 === 0) {
      const w = workedForQuestion(q);
      if (w.answer.value !== q.expected.value || !w.steps[w.steps.length - 1]!.text.includes(formatSF(q.expected.value, q.sigFigs))) { mismatch++; console.error("mismatch", f.id, seed); }
      if (JSON.stringify(generateQuestion(f.id, seed * 7919)) !== JSON.stringify(q)) { mismatch++; console.error("nondeterministic", f.id, seed); }
    }
  }
}
ok(gen === FORMULAE.length * 500 && badGen === 0, `${gen} generated questions: no NaN/Infinity/absurd values (${badGen} bad)`);
ok(mismatch === 0, "questions deterministic; expected value equals worked solution");
// every unknown answerable + marks a correct typed answer in full
let markBad = 0;
for (const f of FORMULAE) for (const x of f.vars) {
  const q = generateQuestion(f.id, 42, { unknown: x.sym });
  ok(q.unknown.sym === x.sym, `${f.id} unknown honoured (${x.sym})`);
  const typed = `${q.expected.value}e0 ${q.expected.unit}`.trim();
  const res = checkQuantity(typed, q.expected, { sigFigs: undefined });
  if (res.score !== res.max) { markBad++; console.error("marking", f.id, x.sym, typed, res.feedback); }
  const wrong = checkQuantity(`${q.expected.value * 2} ${q.expected.unit}`, q.expected);
  if (wrong.score === wrong.max) markBad++;
}
ok(markBad === 0, "correct answers get full marks, doubled answers do not");
ok(generateQuestion("speed", 1).prompt !== generateQuestion("speed", 2).prompt, "different seeds give different questions");
ok(generateQuestion("speed", 3, { sigFigs: 3 }).sigFigs === 3, "sigFigs option honoured");
let threw = false; try { generateQuestion("nope", 1); } catch { threw = true; }
ok(threw, "unknown formula throws");

console.log(`${n - bad}/${n} checks passed`);
if (bad) process.exit(1);
