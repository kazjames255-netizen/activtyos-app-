// Tool QUESTIONS: everything the SERVER needs to serve and mark an interactive question, in pure TypeScript (no React, no DOM, no `@/` imports —
// server/src imports this file directly). The server keeps the generator id + seed on the attempt; the child gets only the public part of the problem
// (prompt, given marks, what to answer); marking re-generates the same problem from the seed, so the model answer never leaves the server.
import { markProblem, GENERATORS, type Generator, type Problem } from "./maths/geometry/generators";
import { DEFAULT_TOL, type Mark, type Tol } from "./maths/geometry/model";
import type { Answer } from "./maths/geometry/checkers";
import type { Pt } from "./engine/geometry";

/** Every generator a tool question can use, by id. Later subjects add theirs here. */
export const PROBLEM_GENERATORS: Record<string, Generator> = { ...GENERATORS };
export const isGenerator = (id: unknown): id is string => typeof id === "string" && id in PROBLEM_GENERATORS;

/** Human labels for the authoring picker. */
export const GENERATOR_LABEL: Record<string, string> = {
  "M-G01.measure": "Measure an angle (protractor)", "M-G01.draw": "Draw an angle (protractor + ruler)", "M-G02.perpBisector": "Construct a perpendicular bisector",
  "M-G02.angleBisector": "Construct an angle bisector", "M-G02.triangle": "Construct a triangle from three sides", "M-G02.equilateral": "Construct an equilateral triangle",
  "M-G02.locus": "Draw a locus (circle round a point)", "M-G03.plot": "Plot points on a coordinate grid", "M-G09.measure": "Measure a bearing", "M-G09.draw": "Draw a bearing",
};

/** What a child is allowed to see of a problem: never the model answer, the checker or its parameters. */
export interface PublicProblem { generatorId: string; seed: number; prompt: string; paper: Problem["paper"]; given: Mark[]; expects: Problem["expects"]; unit?: string }
export const publicProblem = (p: Problem): PublicProblem => ({ generatorId: p.generatorId, seed: p.seed, prompt: p.prompt, paper: p.paper, given: p.given, expects: p.expects, ...(p.unit ? { unit: p.unit } : {}) });

const num = (v: unknown, lim = 5000): number | null => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= lim ? v : null);
const pt = (v: unknown): Pt | null => { if (!Array.isArray(v) || v.length !== 2) return null; const x = num(v[0]), y = num(v[1]); return x === null || y === null ? null : [x, y]; };
const MAX_MARKS = 300, MAX_FREE_PTS = 400;

/** Shape a client answer into something safe to mark and to store. Anything odd is dropped; size is capped. Returns null when nothing usable is left. */
export function cleanToolAnswer(r: unknown): Answer | null {
  if (!r || typeof r !== "object" || Array.isArray(r)) return null;
  const o = r as Record<string, unknown>;
  const out: Answer = {};
  const n = o.number === null ? null : num(o.number, 1e9);
  if (n !== null) out.number = n; else if (o.number === null) out.number = null;
  if (Array.isArray(o.points)) out.points = o.points.slice(0, 100).map(pt).filter((p): p is Pt => !!p);
  if (Array.isArray(o.marks)) {
    const marks: Mark[] = [];
    for (const m of o.marks.slice(0, MAX_MARKS)) {
      if (!m || typeof m !== "object") continue;
      const k = (m as { k?: unknown }).k, id = typeof (m as { id?: unknown }).id === "string" ? String((m as { id: string }).id).slice(0, 40) : `m${marks.length}`;
      if (k === "seg") { const a = pt((m as { a?: unknown }).a), b = pt((m as { b?: unknown }).b); if (a && b) marks.push({ id, k: "seg", a, b, ruled: !!(m as { ruled?: unknown }).ruled }); }
      else if (k === "arc") { const c = pt((m as { c?: unknown }).c), rr = num((m as { r?: unknown }).r, 2000), a0 = num((m as { a0?: unknown }).a0, 1e5), a1 = num((m as { a1?: unknown }).a1, 1e5); if (c && rr !== null && a0 !== null && a1 !== null && rr > 0) marks.push({ id, k: "arc", c, r: rr, a0, a1 }); }
      else if (k === "pt") { const p = pt((m as { p?: unknown }).p); if (p) marks.push({ id, k: "pt", p }); }
      else if (k === "free") { const pts = Array.isArray((m as { pts?: unknown }).pts) ? ((m as { pts: unknown[] }).pts.slice(0, MAX_FREE_PTS).map(pt).filter((p): p is Pt => !!p)) : []; if (pts.length > 1) marks.push({ id, k: "free", pts }); }
    }
    out.marks = marks;
  }
  return out;
}
/** Nothing handed in: no number, no drawing, no points. */
export const isBlankToolAnswer = (a: Answer | null): boolean => !a || ((a.number === undefined || a.number === null) && !(a.marks?.length) && !(a.points?.length));

export interface ToolSpec { generatorId: string; seed: number; tol?: Partial<Tol> }
export interface ToolMarking { correct: boolean; marksAwarded: number; feedback: string[]; score: number; max: number }
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Mark a stored tool response against the question's marks. Fractional credit is kept (e.g. 2 of 3 checks → 2/3 of the marks). null = can't mark (unknown generator). */
export function markTool(tool: ToolSpec, response: unknown, marks: number): ToolMarking | null {
  const gen = PROBLEM_GENERATORS[tool.generatorId];
  if (!gen) return null;
  const problem = gen(tool.seed);
  const answer = cleanToolAnswer(response);
  if (isBlankToolAnswer(answer)) return { correct: false, marksAwarded: 0, feedback: ["Nothing handed in"], score: 0, max: problem.maxScore };
  const res = markProblem(problem, answer!, { ...DEFAULT_TOL, ...(tool.tol ?? {}) });
  return { correct: res.max > 0 && res.score >= res.max - 1e-9, marksAwarded: round2(res.max > 0 ? (marks * res.score) / res.max : 0), feedback: res.feedback, score: res.score, max: res.max };
}
