// Learning Hub — marking and scoring maths. PURE: no Firestore, no Express, so it
// can be self-tested (server/src/hubSelfTest.ts) and can't drift per route.
// Which rule a question uses comes from settings.hub.questionKinds[kind].mark
// (lib/hubConfig.ts) — nothing about *what* is taught is hardcoded here.

import { cleanToolAnswer, isBlankToolAnswer, markTool, type ToolSpec } from "../../../features/learninghub/tools/problems";

export type MarkRule = "choice" | "multi" | "exact" | "numeric" | "match" | "order" | "tool" | "manual";

/** Everything marking needs about a question (the snapshot taken at attempt start). */
export interface MarkableQuestion {
  mark: MarkRule;
  answer: unknown;
  acceptedAnswers?: string[];
  tolerance?: number;
  marks: number;
  /** Tool questions: which generator + seed built this attempt's problem (marking re-generates it; the key never travels). */
  tool?: ToolSpec;
}

export interface MarkOutcome {
  /** true / false, or null while a tutor still has to mark it. */
  correct: boolean | null;
  marksAwarded: number;
  /** Manual question with a real response: waits for a tutor. */
  pending: boolean;
  /** Tool questions: the checker's plain-English lines ("✓ Perpendicular within 2°…"). Shown to the pupil only when answers may be revealed. */
  feedback?: string[];
}

/** No answer given (null, "", whitespace, empty list). */
export function isBlank(r: unknown): boolean {
  if (r === null || r === undefined) return true;
  if (typeof r === "string") return r.trim() === "";
  if (Array.isArray(r)) return r.length === 0;
  if (typeof r === "object") {
    // match / order responses: blank when there are no pairs / items in them.
    const o = r as Record<string, unknown>;
    if (o.kind === "tool") return isBlankToolAnswer(cleanToolAnswer(o)); // nothing drawn / typed / plotted
    if ("pairs" in o) return !Array.isArray(o.pairs) || o.pairs.length === 0;
    if ("items" in o) return !Array.isArray(o.items) || o.items.length === 0;
  }
  return false;
}

/** trim + lowercase + collapse inner whitespace — the "exact" comparison form. */
export const normText = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** A numeric response: a finite number, or a string that is entirely a number. */
export function toNumber(r: unknown): number | null {
  if (typeof r === "number") return Number.isFinite(r) ? r : null;
  if (typeof r === "string") {
    let t = r.trim().replace(/[\u2212\u2013]/g, "-").replace(/^([-+]?)£/, "$1");
    // "2,500" / "1,250,000.5": commas only when they are genuinely thousands separators.
    if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, "");
    // Standard form as students type it: 1.33×10⁻⁴, 1.33 x 10^-4, 1.33*10^-4 → 1.33e-4.
    const SUP: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "⁺": "+" };
    t = t.replace(/[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (run) => "^" + [...run].map((c) => SUP[c] ?? c).join("")).replace(/\s+/g, "");
    t = t.replace(/^([-+]?(?:\d+\.?\d*|\.\d+))(?:×|x|\*)10\^([-+]?\d+)$/i, "$1e$2");
    if (t === "" || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Comparison form for a match / order piece of text: trim + collapse spaces, CASE-SENSITIVE. Match and order answers are picked from the
 *  stored tiles (never typed), so exact case always round-trips — and EE / Ee / ee (genotypes) stay three different answers. */
const key1 = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : null);

/** A match response ({kind:"match", pairs:[{term, definition}]}) as normalised "term␟definition" strings, or null when malformed. */
function pairKeys(list: unknown): string[] | null {
  if (!Array.isArray(list)) return null;
  const out: string[] = [];
  for (const p of list) {
    const o = (p ?? {}) as Record<string, unknown>;
    const t = key1(o.term), d = key1(o.definition);
    if (t === null || d === null) return null;
    out.push(`${t}\u241f${d}`);
  }
  return out;
}

/** match: every stored pair appears in the response exactly once (order of pairs is irrelevant; duplicated
 *  terms/definitions are handled as a multiset, so a repeated pair can't stand in for a missing one). */
export function markMatch(key: unknown, response: unknown): boolean {
  const want = pairKeys(key);
  const r = (response ?? {}) as Record<string, unknown>;
  const got = r.kind === "match" || r.kind === undefined ? pairKeys(r.pairs) : null;
  if (!want || !want.length || !got || got.length !== want.length) return false;
  const left = new Map<string, number>();
  for (const w of want) left.set(w, (left.get(w) ?? 0) + 1);
  for (const g of got) {
    const n = left.get(g);
    if (!n) return false;
    left.set(g, n - 1);
  }
  return true;
}

/** order: the response is the stored items in exactly the stored sequence (text compared trimmed, case-sensitive). */
export function markOrder(key: unknown, response: unknown): boolean {
  const r = (response ?? {}) as Record<string, unknown>;
  const got = r.kind === "order" || r.kind === undefined ? r.items : null;
  if (!Array.isArray(key) || !Array.isArray(got) || !key.length || got.length !== key.length) return false;
  return key.every((k, i) => { const a = key1(k), b = key1(got[i]); return a !== null && b !== null && a === b; });
}

const asStringSet = (v: unknown): Set<string> | null =>
  Array.isArray(v) && v.every((x) => typeof x === "string") ? new Set(v as string[]) : null;

/** Mark ONE response against ONE question. */
export function markResponse(q: MarkableQuestion, response: unknown): MarkOutcome {
  const wrong: MarkOutcome = { correct: false, marksAwarded: 0, pending: false };
  const right: MarkOutcome = { correct: true, marksAwarded: q.marks, pending: false };

  if (q.mark === "manual") {
    // A blank written answer is simply worth nothing — it doesn't wait for a tutor.
    return isBlank(response) ? wrong : { correct: null, marksAwarded: 0, pending: true };
  }
  if (isBlank(response)) return wrong;

  if (q.mark === "tool") {
    if (!q.tool) return wrong;
    const m = markTool(q.tool, response, q.marks);
    return m ? { correct: m.correct, marksAwarded: m.marksAwarded, pending: false, feedback: m.feedback } : wrong;
  }

  switch (q.mark) {
    case "choice":
      return typeof response === "string" && typeof q.answer === "string" && response === q.answer ? right : wrong;
    case "multi": {
      const want = asStringSet(q.answer);
      const got = asStringSet(response);
      if (!want || !got || want.size === 0 || got.size !== want.size) return wrong;
      for (const id of got) if (!want.has(id)) return wrong;
      return right;
    }
    case "exact": {
      const r = typeof response === "string" ? response : typeof response === "number" ? String(response) : null;
      if (r === null) return wrong;
      const given = normText(r);
      const keys = [q.answer, ...(q.acceptedAnswers ?? [])].filter((k): k is string => typeof k === "string" && k.trim() !== "").map(normText);
      return keys.includes(given) ? right : wrong;
    }
    case "numeric": {
      const x = toNumber(response);
      const a = typeof q.answer === "number" ? q.answer : toNumber(q.answer);
      if (x === null || a === null) return wrong;
      const tol = Math.max(0, q.tolerance ?? 0);
      return Math.abs(x - a) <= tol + 1e-9 ? right : wrong;
    }
    case "match":
      return markMatch(q.answer, response) ? right : wrong;
    case "order":
      return markOrder(q.answer, response) ? right : wrong;
    default:
      return wrong;
  }
}

/** A tenant may have dropped a question kind from its settings after the question
 *  was written; fall back to what the stored question looks like. */
export function inferRule(q: { options?: unknown[]; answer: unknown; pairs?: unknown[]; items?: unknown[] }): MarkRule {
  if (Array.isArray(q.pairs) && q.pairs.length) return "match";
  if (Array.isArray(q.items) && q.items.length) return "order";
  if (Array.isArray(q.answer) && Array.isArray(q.options) && q.options.length) return "multi";
  if (typeof q.answer === "string" && Array.isArray(q.options) && q.options.length) return "choice";
  if (typeof q.answer === "number") return "numeric";
  if (typeof q.answer === "string" && q.answer.trim()) return "exact";
  return "manual";
}

export interface ScoredAnswer {
  topicId: string;
  correct: boolean | null;
  marksAwarded: number;
  marksMax: number;
  /** Manual answer still waiting for a tutor. */
  pending: boolean;
}

export interface AttemptScore {
  /** Marks awarded so far. */
  scoreMarks: number;
  /** Marks available in the whole assessment. */
  maxMarks: number;
  /** Marks available in the questions counted so far (pending ones excluded). */
  countedMax: number;
  /** round(Σawarded / Σmax × 100) over the counted questions. */
  pct: number;
  status: "pending_marking" | "marked";
  byTopic: Record<string, { got: number; max: number }>;
  /** pct ≥ passMarkPct once marked; null while a tutor still has to mark. */
  passed: boolean | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Totals for an attempt from its per-question outcomes. */
export function scoreAttempt(answers: ScoredAnswer[], passMarkPct: number): AttemptScore {
  let got = 0;
  let counted = 0;
  let total = 0;
  const byTopic: Record<string, { got: number; max: number }> = {};
  for (const a of answers) {
    total += a.marksMax;
    if (a.pending) continue;
    got += a.marksAwarded;
    counted += a.marksMax;
    const t = (byTopic[a.topicId] ??= { got: 0, max: 0 });
    t.got = round2(t.got + a.marksAwarded);
    t.max += a.marksMax;
  }
  const pending = answers.some((a) => a.pending);
  const pct = counted > 0 ? Math.round((got / counted) * 100) : 0;
  return {
    scoreMarks: round2(got), maxMarks: total, countedMax: counted, pct,
    status: pending ? "pending_marking" : "marked",
    byTopic,
    passed: pending ? null : pct >= passMarkPct,
  };
}

/** Apply a tutor's mark to one answer: awarded is clamped to [0, max]; the
 *  answer is `correct` only for full marks. */
export function applyManualMark(marksMax: number, awarded: number): { correct: boolean; marksAwarded: number } {
  const a = Math.min(Math.max(0, Number.isFinite(awarded) ? awarded : 0), marksMax);
  const marksAwarded = round2(a);
  return { correct: marksAwarded >= marksMax, marksAwarded };
}

/** May a student see answer keys + explanations for an attempt in this state? `passed` = did this attempt (or an earlier one of the
 *  same quiz) reach the pass mark; "after_pass" needs it. A caller that has no pass mark to speak of (a lesson's warm-up check,
 *  which isn't graded) leaves `passed` undefined and gets the key straight away, as before. */
export function revealAllowed(policy: "after_pass" | "after_submit" | "after_marked" | "never", status: string, passed?: boolean): boolean {
  if (status === "in_progress") return false;
  if (policy === "after_pass") return passed === undefined ? true : passed === true;
  if (policy === "after_submit") return true;
  if (policy === "after_marked") return status === "marked";
  return false;
}

export interface AutoSplit {
  /** Marks earned on the auto-marked (non-written) questions. */
  autoMarks: number;
  /** Marks available on the auto-marked questions. */
  autoMax: number;
  /** Written answers still waiting for a tutor. */
  writtenPending: number;
  awaitingWritten: boolean;
}

/** Split an attempt into its self-marked part and its written part, so a paper with
 *  an auto-marked score never reads as a bare "awaiting marking". `rules` = each
 *  question's mark rule (from the attempt snapshot), by question id. */
export function autoSplit(answers: { questionId: string; marksAwarded: number; marksMax: number; pending: boolean }[], rules: Map<string, MarkRule>): AutoSplit {
  let autoMarks = 0;
  let autoMax = 0;
  let writtenPending = 0;
  for (const a of answers) {
    if (a.pending) writtenPending++;
    if ((rules.get(a.questionId) ?? "manual") === "manual") continue;
    autoMax += a.marksMax;
    autoMarks += a.marksAwarded;
  }
  return { autoMarks: round2(autoMarks), autoMax, writtenPending, awaitingWritten: writtenPending > 0 };
}
