// The step-by-step LESSON PLAN of an interactive lesson (`lesson.plan`): a simplified, ordered plan a tutor can teach from
// (warm-up → teaching steps → guided practice → independent practice → plenary) plus "common mistakes" and "watch out" notes.
// It REPLACES the raw video script Oak publishes (teacher chatter) — the importer no longer stores the transcript at all.
//
// Every sentence is TRUE to the lesson: the deterministic generator (server/src/oak/factory/plan.ts) only restates Oak's own
// outcome, key learning points, keyword definitions, outline headings, teacher tips and misconceptions, and hand-written plans are
// re-verified against the lesson dossier. Shared by the server (importer, validator) and the client (reader, recap) — keep it pure.

export type PlanStepKind = "warmup" | "teach" | "guided" | "independent" | "plenary";
export const PLAN_KINDS: PlanStepKind[] = ["warmup", "teach", "guided", "independent", "plenary"];

export interface PlanStep {
  kind: PlanStepKind;
  /** Short heading for the step ("Warm-up", or the part of the lesson it teaches). */
  title: string;
  /** Suggested minutes (a guide, not a rule). */
  minutes?: number;
  /** What the tutor / student does: 1-3 short plain-English sentences. */
  doThis: string[];
  /** Something to read aloud, word for word. */
  say?: string;
  /** The key ideas of this step (the lesson's own key learning points / definitions). */
  keyIdeas?: string[];
  /** A quick question to ask, and what a right answer looks like. */
  checkFor?: { ask: string; lookFor?: string };
  keywords?: PlanKeyword[];
  /** Worked examples (each one verified against the lesson). */
  examples?: string[];
  /** The same step written for the student's "Recap: step by step" (short, friendly). */
  recap: string[];
}
export interface PlanKeyword { term: string; meaning?: string }
export interface PlanMistake { mistake: string; fix: string }
export interface LessonPlan {
  v: 1;
  /** "derived" = built by the deterministic generator from Oak's structured facts; "curated" = written and checked by hand. */
  source: "derived" | "curated";
  steps: PlanStep[];
  /** Tutors only: what pupils commonly get wrong, and how to help. */
  commonMistakes: PlanMistake[];
  /** Tutors only: tips for teaching this lesson. */
  watchOut: string[];
}

export const MAX_PLAN_STEPS = 12;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const str = (v: unknown, n = 600): string => (typeof v === "string" ? clip(v.replace(/\s+/g, " ").trim(), n) : "");
const strs = (v: unknown, max: number, n = 600): string[] => (Array.isArray(v) ? v.map((x) => str(x, n)).filter(Boolean).slice(0, max) : []);

/** A stored plan (or anything an API client sent) → a safe LessonPlan, or null when there is nothing usable. */
export function normalizePlan(raw: unknown): LessonPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const steps: PlanStep[] = [];
  for (const s of Array.isArray(r.steps) ? r.steps.slice(0, MAX_PLAN_STEPS) : []) {
    if (!s || typeof s !== "object") continue;
    const x = s as Record<string, unknown>;
    const kind = PLAN_KINDS.includes(x.kind as PlanStepKind) ? (x.kind as PlanStepKind) : "teach";
    const title = str(x.title, 140);
    const doThis = strs(x.doThis, 4, 900);
    const recap = strs(x.recap, 6, 900);
    if (!title || (!doThis.length && !recap.length)) continue;
    const chk = x.checkFor && typeof x.checkFor === "object" ? (x.checkFor as Record<string, unknown>) : null;
    const ask = chk ? str(chk.ask, 400) : "";
    const kws: PlanKeyword[] = Array.isArray(x.keywords)
      ? x.keywords.map((k) => (typeof k === "string" ? { term: str(k, 60) } : { term: str((k as Record<string, unknown>)?.term, 60), meaning: str((k as Record<string, unknown>)?.meaning, 400) })).filter((k) => k.term).map((k) => (k.meaning ? k : { term: k.term })).slice(0, 12)
      : [];
    const minutes = typeof x.minutes === "number" && Number.isFinite(x.minutes) && x.minutes > 0 && x.minutes <= 120 ? Math.round(x.minutes) : undefined;
    steps.push({
      kind, title, ...(minutes ? { minutes } : {}), doThis,
      ...(str(x.say, 750) ? { say: str(x.say, 750) } : {}),
      ...(strs(x.keyIdeas, 8, 750).length ? { keyIdeas: strs(x.keyIdeas, 8, 750) } : {}),
      ...(ask ? { checkFor: { ask, ...(str(chk!.lookFor, 2500) ? { lookFor: str(chk!.lookFor, 2500) } : {}) } } : {}),
      ...(kws.length ? { keywords: kws } : {}),
      ...(strs(x.examples, 6, 300).length ? { examples: strs(x.examples, 6, 300) } : {}),
      recap,
    });
  }
  if (!steps.length) return null;
  const mistakes: PlanMistake[] = Array.isArray(r.commonMistakes)
    ? r.commonMistakes.map((m) => ({ mistake: str((m as Record<string, unknown>)?.mistake, 750), fix: str((m as Record<string, unknown>)?.fix, 750) })).filter((m) => m.mistake).slice(0, 6)
    : [];
  return { v: 1, source: r.source === "curated" ? "curated" : "derived", steps, commonMistakes: mistakes, watchOut: strs(r.watchOut, 6, 750) };
}

/** What a family receives: the steps (the student recap), without the tutor-only notes. */
export function planForFamily(plan: unknown): Record<string, unknown> | null {
  if (!plan || typeof plan !== "object") return null;
  const { commonMistakes: _m, watchOut: _w, ...rest } = plan as Record<string, unknown>;
  void _m; void _w;
  return rest;
}

/** The plan as markdown: the body of a lesson keeps a short plain-text version of it, so anything that reads `body` still works. */
export function planToMarkdown(plan: LessonPlan): string {
  const out: string[] = [];
  plan.steps.forEach((s, i) => {
    out.push(`### ${i + 1}. ${s.title}${s.minutes ? ` (about ${s.minutes} min)` : ""}`);
    const lines = [...s.doThis];
    if (s.say) lines.push(`Read aloud: “${s.say}”`);
    for (const k of s.keyIdeas ?? []) lines.push(`Key idea: ${k}`);
    if (s.keywords?.length) lines.push(`Key words: ${s.keywords.map((k) => (k.meaning ? `**${k.term}** — ${k.meaning}` : `**${k.term}**`)).join("; ")}`);
    for (const e of s.examples ?? []) lines.push(`Example: ${e}`);
    if (s.checkFor) lines.push(`Check: ${s.checkFor.ask}${s.checkFor.lookFor ? ` Look for: ${s.checkFor.lookFor}` : ""}`);
    out.push(lines.map((l) => `- ${l}`).join("\n"));
  });
  return out.join("\n\n");
}

export const PLAN_HEADING = "Lesson plan";
/** The auto-generated "## Lesson plan" section of a lesson's body, removed for display when the structured plan is shown next to it. */
export function stripPlanSection(body: string): string {
  const re = new RegExp(`(^|\\n)## ${PLAN_HEADING}\\n[\\s\\S]*?(?=\\n## |$)`);
  return body.replace(re, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
