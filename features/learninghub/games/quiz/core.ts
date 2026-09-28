// Shared pure core for the three "quiz-quest" games (Compass Quest / Museum Vault / Colour Lab). These teach
// genuinely different things from the times-tables fact-fluency games (Penguin Slide / Turbo Slide), so per
// docs/games-prototypes/BACKEND-PATTERN.md step 1 they get their OWN state shape - but the three of THEM ask the
// same kind of question (a seeded multiple-choice item bank, server-marked) over three different fact universes,
// so they share this one deterministic module rather than three parallel copies of the same plan/mark logic.
// Same rule as every other game here: the browser never sends a score. It sends the option id it picked for each
// item in the plan the server issued; the server re-looks-up the correct id from the SAME static item bank and
// marks it. This file is imported by both the client (to render) and the server (to mark) - one source of truth.
import { makeRng } from "../../tools/engine/rng";

/** Assign option ids so the CORRECT one is not always the same literal id (a real, exploitable shortcut a naive
 *  content author can fall into: if every item's correct option is id "a", a cheat client can score 100% by always
 *  picking "a" without knowing anything — the per-run option SHUFFLE in buildPlan only reorders array position, it
 *  does not touch ids). This hashes the item's own key so the assignment is fixed at content-authoring time (stable
 *  across reloads) but varies per item, unrelated to any per-run seed. Prefer meaningful ids (e.g. "n"/"s"/"e"/"w")
 *  when the content has natural ones; use this whenever ids would otherwise be arbitrary/positional. */
export function shuffleOptionIds(key: string, correctText: string, wrongTexts: string[]): { options: { id: string; text: string }[]; correctId: string } {
  let h = 0; for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) >>> 0;
  const ids = ["o1", "o2", "o3", "o4"].slice(0, wrongTexts.length + 1);
  const shuffled = makeRng(h || 1).shuffle(ids); // a well-mixed shuffle (mulberry32), not a low-bit-biased LCG
  const texts = [correctText, ...wrongTexts];
  return { options: texts.map((text, i) => ({ id: shuffled[i]!, text })), correctId: shuffled[0]! };
}

export interface QuizItem {
  key: string;
  /** One or more topic tags used for weak-topic weighting and tutor reporting (e.g. "compass-directions"). */
  topics: string[];
  difficulty: 1 | 2 | 3;
  prompt: string;
  /** Optional shared context shown above the prompt (e.g. a short reading passage several items reuse). */
  passage?: string;
  options: { id: string; text: string }[];
  correctId: string;
  explanation: string;
}

export interface ItemState {
  key: string;
  /** Leitner box 0-4: 0 = just missed / never seen, 4 = secure. */
  box: number;
  attempts: number;
  correct: number;
  lastSeen: string | null;
  nextDueAt: string | null;
  wrongPicks: Record<string, number>;
}
export const freshItemState = (key: string): ItemState => ({ key, box: 0, attempts: 0, correct: 0, lastSeen: null, nextDueAt: null, wrongPicks: {} });

// Leitner review spacing in days, index = box after the answer that produced it.
const BOX_DAYS = [0, 1, 3, 7, 16];
const dayMs = 86_400_000;

export interface PlanItem { key: string; topics: string[]; difficulty: 1 | 2 | 3; prompt: string; passage?: string; options: { id: string; text: string }[] }
/** Server picks `count` items: overdue / weak items first (box < 2, or past their next-due date), padded with
 *  fresh unseen items, then a light shuffle of unseen filler - all deterministic from `seed` so the exact same
 *  plan can be rebuilt (nothing needs to be stored beyond the item keys). Options are shuffled per item, by id
 *  only (position never carries meaning), so a client can't infer the answer from where it starts. */
export function buildPlan(seed: number, bank: readonly QuizItem[], state: ReadonlyMap<string, ItemState>, count: number, nowIso: string): PlanItem[] {
  const rng = makeRng(seed);
  const now = new Date(nowIso).getTime();
  const weight = (item: QuizItem): number => {
    const s = state.get(item.key);
    if (!s || s.attempts === 0) return 3; // never seen - worth showing
    if (s.box <= 1) return 5; // weak - highest priority
    const due = s.nextDueAt ? new Date(s.nextDueAt).getTime() : 0;
    if (due <= now) return 2 + (2 - Math.min(2, s.box)); // due for review
    return 0.3; // recently secure - rare filler only
  };
  const pool = bank.map((item) => ({ item, w: weight(item) * (0.5 + rng.next()) }));
  pool.sort((a, b) => b.w - a.w);
  const chosen = pool.slice(0, Math.min(count, pool.length)).map((p) => p.item);
  const ordered = rng.shuffle(chosen);
  return ordered.map((item) => ({ key: item.key, topics: item.topics, difficulty: item.difficulty, prompt: item.prompt, ...(item.passage ? { passage: item.passage } : {}), options: rng.shuffle(item.options) }));
}

export interface MarkedRow { key: string; topics: string[]; correctId: string; chosenId: string | null; correct: boolean; ms: number; explanation: string }
export interface QuizResult { score: number; total: number; points: number; rows: MarkedRow[]; passRate: number }
export interface QuizAnswer { key: string; chosenId: string | null; ms: number }
export const cleanAnswers = (raw: unknown, planKeys: string[]): QuizAnswer[] | null => {
  if (!Array.isArray(raw) || raw.length !== planKeys.length) return null;
  const out: QuizAnswer[] = [];
  for (let i = 0; i < raw.length; i++) {
    const x = raw[i];
    if (!x || typeof x !== "object") return null;
    const key = (x as { key?: unknown }).key, chosenId = (x as { chosenId?: unknown }).chosenId, ms = (x as { ms?: unknown }).ms;
    if (key !== planKeys[i]) return null;
    if (!(chosenId === null || (typeof chosenId === "string" && chosenId.length <= 40))) return null;
    if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return null;
    out.push({ key: key as string, chosenId: chosenId as string | null, ms: Math.min(600_000, Math.round(ms)) });
  }
  return out;
};

/** Mark a submitted answer set against the static bank (never trust the client's own idea of what's correct). */
export function markQuiz(bank: readonly QuizItem[], answers: QuizAnswer[], pointsPerCorrect = 10): QuizResult {
  const byKey = new Map(bank.map((i) => [i.key, i]));
  const rows: MarkedRow[] = answers.map((a) => {
    const item = byKey.get(a.key);
    const correctId = item?.correctId ?? "";
    const correct = !!item && a.chosenId !== null && a.chosenId === correctId;
    return { key: a.key, topics: item?.topics ?? [], correctId, chosenId: a.chosenId, correct, ms: a.ms, explanation: item?.explanation ?? "" };
  });
  const score = rows.filter((r) => r.correct).length;
  return { score, total: rows.length, points: score * pointsPerCorrect, rows, passRate: rows.length ? score / rows.length : 0 };
}

/** Apply a marked result to per-item Leitner state - pure, so both the server and a demo/local backend use it. */
export function applyToState(rows: MarkedRow[], state: Map<string, ItemState>, nowIso: string): Map<string, ItemState> {
  const out = new Map(state);
  for (const r of rows) {
    const prev = out.get(r.key) ?? freshItemState(r.key);
    const box = r.correct ? Math.min(4, prev.box + 1) : Math.max(0, prev.box - 1);
    const nextDueAt = new Date(new Date(nowIso).getTime() + BOX_DAYS[box]! * dayMs).toISOString();
    const wrongPicks = { ...prev.wrongPicks };
    if (!r.correct && r.chosenId) wrongPicks[r.chosenId] = (wrongPicks[r.chosenId] ?? 0) + 1;
    out.set(r.key, { key: r.key, box, attempts: prev.attempts + 1, correct: prev.correct + (r.correct ? 1 : 0), lastSeen: nowIso, nextDueAt, wrongPicks });
  }
  return out;
}

export interface QuizProfile { points: number; pointsToday: { day: string; points: number }; runs: number; bestScore: number; days: string[]; lastPlayedAt: string | null }
export const newQuizProfile = (): QuizProfile => ({ points: 0, pointsToday: { day: "", points: 0 }, runs: 0, bestScore: 0, days: [], lastPlayedAt: null });
export function applyToProfile(profile: QuizProfile, result: QuizResult, nowIso: string): QuizProfile {
  const day = nowIso.slice(0, 10);
  const days = profile.days.includes(day) ? profile.days : [...profile.days, day].slice(-90);
  return {
    points: profile.points + result.points,
    pointsToday: { day, points: (profile.pointsToday.day === day ? profile.pointsToday.points : 0) + result.points },
    runs: profile.runs + 1,
    bestScore: Math.max(profile.bestScore, result.score),
    days,
    lastPlayedAt: nowIso,
  };
}
export function weekDaysOf(days: readonly string[], nowIso: string): number {
  const start = new Date(nowIso); start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const cutoff = start.toISOString().slice(0, 10);
  return days.filter((d) => d >= cutoff).length;
}
