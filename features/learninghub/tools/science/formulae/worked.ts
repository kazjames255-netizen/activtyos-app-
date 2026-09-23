// Step-by-step worked solutions and seeded practice questions — PURE.
import { toSF } from "../../engine/quantity";
import { makeRng } from "../../engine/rng";
import { formulaById, varOf, type Formula, type Values } from "./formulae";
import { formatNum, formatSF, sensibleValue } from "./units";

export interface WorkedStep { n: number; label: string; /** what a pupil should ask themselves (used at "prompts only" scaffold) */ prompt: string; text: string }
export interface Worked { steps: WorkedStep[]; raw: number; answer: { value: number; unit: string; text: string }; sigFigs: number }

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Replace variable symbols in a rearranged expression with their numbers. */
export function substitute(f: Formula, expr: string, values: Values): string {
  const syms = f.vars.map((x) => x.sym).sort((a, b) => b.length - a.length);
  const re = new RegExp(syms.map(escapeRe).join("|"), "g");
  return expr.replace(re, (s) => { const n = values[s]; if (n === undefined) return s; const t = formatNum(n); return n < 0 ? `(${t})` : t; });
}

/** Build the worked solution for finding `unknown`, given the other values (in the variables' SI units). */
export function workedSolution(f: Formula, unknown: string, givens: Values, sigFigs = 3): Worked {
  const raw = f.solveFor(unknown, givens);
  const uv = varOf(f, unknown), rearrange = unknown !== f.subject;
  const eq = f.rearranged[unknown]!;
  const rhs = eq.slice(eq.indexOf("=") + 1).trim();
  const rounded = toSF(raw, sigFigs), shown = formatSF(raw, sigFigs);
  const steps: Omit<WorkedStep, "n">[] = [
    { label: "Write the formula", prompt: "Which equation links the quantities in the question?", text: `${f.words}\n${f.symbol}` },
  ];
  if (rearrange) steps.push({ label: "Rearrange", prompt: `Make ${uv.sym} the subject (undo what is done to it).`, text: `${f.symbol}  →  ${eq}${f.triangle ? `\n(formula triangle: cover ${uv.sym})` : ""}` });
  steps.push(
    { label: "Substitute", prompt: "Put each known value in place of its symbol.", text: `${uv.sym} = ${substitute(f, rhs, givens)}` },
    { label: "Calculate", prompt: "Work it out on your calculator (keep the full display).", text: `${uv.sym} = ${formatNum(toSF(raw, 8))}` },
    { label: "Round", prompt: `Round to ${sigFigs} significant figures.`, text: `${uv.sym} = ${shown}  (${sigFigs} s.f.)` },
    { label: "Unit", prompt: "Add the correct unit.", text: `${uv.sym} = ${shown}${uv.unit ? " " + uv.unit : ""}` },
  );
  return { steps: steps.map((s, i) => ({ ...s, n: i + 1 })), raw, answer: { value: rounded, unit: uv.unit, text: `${shown}${uv.unit ? " " + uv.unit : ""}` }, sigFigs };
}

export interface QuestionOpts { unknown?: string; sigFigs?: number }
export interface Question {
  formulaId: string; seed: number; prompt: string;
  givens: { sym: string; name: string; value: number; unit: string }[];
  unknown: { sym: string; name: string; unit: string };
  expected: { value: number; unit: string }; sigFigs: number;
}
/** Seeded practice question with real-world wording. Same (formulaId, seed, opts) → identical question. */
export function generateQuestion(formulaId: string, seed: number, opts: QuestionOpts = {}): Question {
  const f = formulaById(formulaId);
  if (!f) throw new Error(`Unknown formula ${formulaId}`);
  const rng = makeRng(seed), sf = Math.min(4, Math.max(2, opts.sigFigs ?? 2));
  const unknown = opts.unknown && f.vars.some((x) => x.sym === opts.unknown) ? opts.unknown : rng.pick(f.vars).sym;
  let values: Values = {}, ok = false;
  for (let i = 0; i < 200 && !ok; i++) {
    values = {};
    for (const x of f.vars) if (x.sym !== unknown) values[x.sym] = sensibleValue(rng, x.lo, x.hi, sf);
    const r = f.solveFor(unknown, values);
    ok = Number.isFinite(r) && Math.abs(r) > 1e-6 && Math.abs(r) < 1e9 && (!f.valid || f.valid({ ...values, [unknown]: r }));
  }
  if (!ok) throw new Error(`Could not generate ${formulaId}`);
  const uv = varOf(f, unknown);
  const givens = f.vars.filter((x) => x.sym !== unknown).map((x) => ({ sym: x.sym, name: x.name, value: values[x.sym]!, unit: x.unit }));
  const say = givens.map((g) => `the ${g.name} is ${formatNum(g.value)}${g.unit ? " " + g.unit : ""}`);
  const list = say.length === 1 ? say[0]! : `${say.slice(0, -1).join(", ")} and ${say[say.length - 1]}`;
  const prompt = `${f.scene} ${list.charAt(0).toUpperCase()}${list.slice(1)}. Calculate the ${uv.name}${uv.unit ? ` (in ${uv.unit})` : ""}. Give your answer to ${sf} significant figures.`;
  const w = workedSolution(f, unknown, values, sf);
  return { formulaId, seed, prompt, givens, unknown: { sym: unknown, name: uv.name, unit: uv.unit }, expected: { value: w.answer.value, unit: uv.unit }, sigFigs: sf };
}
/** The worked solution for a generated question. */
export const workedForQuestion = (q: Question): Worked => {
  const f = formulaById(q.formulaId)!;
  const g: Values = {}; for (const x of q.givens) g[x.sym] = x.value;
  return workedSolution(f, q.unknown.sym, g, q.sigFigs);
};
