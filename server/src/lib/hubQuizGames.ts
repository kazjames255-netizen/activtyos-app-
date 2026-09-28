import { db } from "../firebase";
import { GameError, sessionsCol } from "./hubGames";
import {
  applyToProfile, applyToState, buildPlan, cleanAnswers, freshItemState, markQuiz, newQuizProfile, weekDaysOf,
  type ItemState, type PlanItem, type QuizItem, type QuizProfile, type QuizResult,
} from "../../../features/learninghub/games/quiz/core";
import { COMPASS_ITEMS } from "../../../features/learninghub/games/compass/content";
import { MUSEUM_ITEMS } from "../../../features/learninghub/games/museum/content";
import { COLOUR_ITEMS } from "../../../features/learninghub/games/colourlab/content";
import { DEBATE_ITEMS } from "../../../features/learninghub/games/debate/content";
import { DETECTIVE_ITEMS } from "../../../features/learninghub/games/detective/content";
import { VAULT_ITEMS } from "../../../features/learninghub/games/vault/content";
import { WORDPOP_ITEMS } from "../../../features/learninghub/games/wordpop/content";
import { markWordPop, WORDPOP_ANSWER_MS } from "../../../features/learninghub/games/wordpop/core";

// The three "quiz-quest" games (Compass Quest / Museum Vault / Colour Lab) - a genuinely different mechanic from
// the times-tables fact-fluency games (Penguin Slide / Turbo Slide), so per docs/games-prototypes/BACKEND-PATTERN.md
// step 1 they get their own state shape rather than being forced into the fact-key shape those games use. The three
// of them DO share one deterministic module (features/learninghub/games/quiz/core.ts) and one Firestore shape,
// because they ask the same kind of question (a seeded multiple-choice item bank) over three different content
// universes - sharing that plumbing here, not forking it three times, is the same "don't fork it" rule the BACKEND
// pattern doc applies to Turbo Slide reusing Penguin Slide's engine.
//
// The browser never sends a score. POST /games/sessions (kind "quiz") issues a plan built from the item bank +
// the child's own per-item state; the client renders it and sends back only which option id it picked per item.
// POST /games/sessions/:id/finish re-marks those picks against the SAME static item bank server-side and writes
// the real result - see markQuiz()/applyToState() in quiz/core.ts.
//
// Collections (privacy: keyed by tenantId/childId exactly like hubFactState/hubGameProfile):
//   hubGameSessions   SHARED with Penguin/Turbo - this file just adds kind:"quiz", gameId:<one of the three below>.
//   hubQuizItemState  one doc per (tenantId, childId, gameId, itemKey): Leitner box, attempts, correct, due date.
//   hubQuizProfile    one doc per (tenantId, childId, gameId): points, best score, run count, days practised.
// Debate Keep / Story Detective / Word Vault teach genuinely different things again (persuasive technique,
// reading comprehension, vocabulary) but ask the exact same KIND of question as the three above - so they join
// this same bank/plumbing rather than forking it a fourth, fifth and sixth time. Word Pop's ITEM shape is also a
// seeded multiple-choice bank, but its mechanic (a timed arcade drill, not an untimed thinking quiz) is genuinely
// different - see features/learninghub/games/wordpop/core.ts for the "reuse vs fork" reasoning: it reuses this
// file's plan-building, Leitner state and profile bookkeeping wholesale, and forks only its own marking function.
export type QuizGameId = "compass-quest" | "museum-vault" | "colour-lab" | "debate-keep" | "story-detective" | "word-vault" | "word-pop";
export const QUIZ_GAME_IDS: readonly QuizGameId[] = ["compass-quest", "museum-vault", "colour-lab", "debate-keep", "story-detective", "word-vault", "word-pop"];
export const isQuizGameId = (v: unknown): v is QuizGameId => typeof v === "string" && (QUIZ_GAME_IDS as readonly string[]).includes(v);
export const isTimedQuizGameId = (v: QuizGameId): boolean => v === "word-pop";

const BANKS: Record<QuizGameId, readonly QuizItem[]> = {
  "compass-quest": COMPASS_ITEMS, "museum-vault": MUSEUM_ITEMS, "colour-lab": COLOUR_ITEMS,
  "debate-keep": DEBATE_ITEMS, "story-detective": DETECTIVE_ITEMS, "word-vault": VAULT_ITEMS, "word-pop": WORDPOP_ITEMS,
};
const ITEMS_PER_RUN: Record<QuizGameId, number> = {
  "compass-quest": 8, "museum-vault": 8, "colour-lab": 8, "debate-keep": 8, "story-detective": 6, "word-vault": 10, "word-pop": 12,
};
const SESSION_TTL_MS = 48 * 3600_000;

export const itemStateCol = db.collection("hubQuizItemState");
export const quizProfileCol = db.collection("hubQuizProfile");
const itemStateDocId = (tenantId: string, childId: string, gameId: QuizGameId, key: string) => `${tenantId}__${childId}__${gameId}__${key}`;
const quizProfileDocId = (tenantId: string, childId: string, gameId: QuizGameId) => `${tenantId}__${childId}__${gameId}`;

async function loadItemState(tenantId: string, childId: string, gameId: QuizGameId): Promise<Map<string, ItemState>> {
  const snap = await itemStateCol.where("tenantId", "==", tenantId).where("childId", "==", childId).where("gameId", "==", gameId).get();
  const m = new Map<string, ItemState>();
  for (const d of snap.docs) { const v = d.data(); m.set(v.key, { key: v.key, box: v.box ?? 0, attempts: v.attempts ?? 0, correct: v.correct ?? 0, lastSeen: v.lastSeen ?? null, nextDueAt: v.nextDueAt ?? null, wrongPicks: v.wrongPicks ?? {} }); }
  return m;
}
async function loadQuizProfile(tenantId: string, childId: string, gameId: QuizGameId): Promise<QuizProfile | null> {
  const s = await quizProfileCol.doc(quizProfileDocId(tenantId, childId, gameId)).get();
  return s.exists ? { ...newQuizProfile(), ...(s.data() as QuizProfile) } : null;
}

export async function startQuiz(o: { tenantId: string; franchiseId: string | null; childId: string; parentUid: string; gameId: QuizGameId; nowIso: string }) {
  const bank = BANKS[o.gameId];
  const [state, profile0] = await Promise.all([loadItemState(o.tenantId, o.childId, o.gameId), loadQuizProfile(o.tenantId, o.childId, o.gameId)]);
  const profile = profile0 ?? newQuizProfile();
  const seed = (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
  const plan: PlanItem[] = buildPlan(seed, bank, state, ITEMS_PER_RUN[o.gameId], o.nowIso);
  if (!plan.length) throw new GameError(500, "No questions available");
  const ref = sessionsCol.doc();
  await ref.set({
    tenantId: o.tenantId, franchiseId: o.franchiseId, childId: o.childId, parentUid: o.parentUid, gameId: o.gameId, kind: "quiz", seed,
    planKeys: plan.map((p) => p.key), status: "started", startedAt: o.nowIso, expiresAt: new Date(new Date(o.nowIso).getTime() + SESSION_TTL_MS).toISOString(),
    createdBy: o.parentUid, createdAt: o.nowIso,
  });
  const seen = [...state.values()].filter((s) => s.attempts > 0).length;
  return {
    sessionId: ref.id, gameId: o.gameId, plan, itemsTotal: bank.length, itemsSeen: seen, secure: [...state.values()].filter((s) => s.box >= 3).length,
    points: profile.points, bestScore: profile.bestScore, weekDays: weekDaysOf(profile.days, o.nowIso), weekGoal: 5,
    ...(isTimedQuizGameId(o.gameId) ? { answerMs: WORDPOP_ANSWER_MS } : {}),
  };
}

/** Re-mark a finished (or ended-early) quiz run. Idempotent: a second finish returns the stored result. Word Pop
 *  (a timed arcade drill, not an untimed quiz) marks through markWordPop instead of markQuiz - see wordpop/core.ts -
 *  everything else here (plan lookup, Leitner state, profile bookkeeping, the transaction shape) is shared as-is. */
export async function finishQuiz(ref: FirebaseFirestore.DocumentReference, first: FirebaseFirestore.DocumentSnapshot, o: { tenantId: string; childId: string; answers?: unknown; nowIso: string }) {
  const gameId = first.get("gameId") as QuizGameId;
  const bank = BANKS[gameId];
  const planKeys = (first.get("planKeys") as string[]) ?? [];
  const answers = cleanAnswers(o.answers, planKeys);
  if (!answers) throw new GameError(400, `Send ${planKeys.length} answers, one per question, in order`);
  const timed = isTimedQuizGameId(gameId);
  const marked = timed ? markWordPop(bank, answers) : markQuiz(bank, answers);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.get("status") === "done") return { ...(snap.get("result") as object), repeat: true };
    const franchiseId = (snap.get("franchiseId") as string | null) ?? null;
    const pRef = quizProfileCol.doc(quizProfileDocId(o.tenantId, o.childId, gameId));
    const iRefs = planKeys.map((k) => itemStateCol.doc(itemStateDocId(o.tenantId, o.childId, gameId, k)));
    const [pSnap, ...iSnaps] = await Promise.all([tx.get(pRef), ...iRefs.map((r) => tx.get(r))]);
    const profile = pSnap.exists ? { ...newQuizProfile(), ...(pSnap.data() as QuizProfile) } : newQuizProfile();
    const state = new Map<string, ItemState>();
    planKeys.forEach((k, i) => { state.set(k, iSnaps[i]!.exists ? (iSnaps[i]!.data() as ItemState) : freshItemState(k)); });
    const newState = applyToState(marked.rows, state, o.nowIso);
    const newProfile = applyToProfile(profile, marked as QuizResult, o.nowIso);
    planKeys.forEach((k, i) => tx.set(iRefs[i]!, { tenantId: o.tenantId, franchiseId, childId: o.childId, gameId, ...newState.get(k)!, createdBy: "system", createdAt: iSnaps[i]!.exists ? iSnaps[i]!.get("createdAt") : o.nowIso }));
    tx.set(pRef, { tenantId: o.tenantId, franchiseId, childId: o.childId, gameId, ...newProfile, createdBy: "system", createdAt: pSnap.exists ? pSnap.get("createdAt") : o.nowIso, updatedAt: o.nowIso });
    const result = {
      score: marked.score, total: marked.total, points: marked.points,
      rows: marked.rows.map((r) => ({ key: r.key, correct: r.correct, correctId: r.correctId, chosenId: r.chosenId, explanation: r.explanation })),
      pointsTotal: newProfile.points, bestScore: newProfile.bestScore, weekDays: weekDaysOf(newProfile.days, o.nowIso), weekGoal: 5,
      ...(timed ? { bestCombo: (marked as ReturnType<typeof markWordPop>).bestCombo } : {}),
    };
    tx.update(ref, {
      status: "done", finishedAt: o.nowIso,
      summary: { answered: marked.rows.filter((r) => r.chosenId !== null).length, correct: marked.score, total: marked.total },
      trials: marked.rows.map((r) => ({ itemId: r.key, tags: r.topics, correct: r.correct ? 1 : 0, miss: r.chosenId === null ? 1 : 0, chosen: r.chosenId, ms: answers.find((a) => a.key === r.key)?.ms ?? 0, format: timed ? "mcq-timed" : "mcq" })),
      result,
    });
    return result;
  });
}

/** Family + tutor read of a child's progress in one of these games - the "GamesSummaryCard" / tutor-progress data. */
export async function quizProgress(tenantId: string, childId: string, gameId: QuizGameId, nowIso = new Date().toISOString()) {
  const bank = BANKS[gameId];
  const [state, profile, sess] = await Promise.all([
    loadItemState(tenantId, childId, gameId), loadQuizProfile(tenantId, childId, gameId),
    sessionsCol.where("tenantId", "==", tenantId).where("childId", "==", childId).where("gameId", "==", gameId).where("status", "==", "done").get(),
  ]);
  const rows = [...state.values()];
  const runs = sess.docs.map((d) => ({ at: d.get("finishedAt") as string, score: d.get("result.score") as number, total: d.get("result.total") as number })).sort((a, b) => b.at.localeCompare(a.at));
  const weakTopics: Record<string, { attempts: number; correct: number }> = {};
  for (const it of bank) { const s = state.get(it.key); if (!s) continue; for (const topic of it.topics) { const t = (weakTopics[topic] ??= { attempts: 0, correct: 0 }); t.attempts += s.attempts; t.correct += s.correct; } }
  return {
    gameId, totals: { facts: rows.filter((r) => r.attempts > 0).length, fluent: rows.filter((r) => r.box >= 3).length, itemsTotal: bank.length },
    points: profile?.points ?? 0, bestScore: profile?.bestScore ?? 0, weekDays: weekDaysOf(profile?.days ?? [], nowIso), weekGoal: 5, runs: runs.slice(0, 12),
    weakTopics: Object.entries(weakTopics).map(([topic, v]) => ({ topic, attempts: v.attempts, accuracy: v.attempts ? Math.round((v.correct / v.attempts) * 100) / 100 : null })).sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1)),
    mastery: { source: "game", weight: 0.15, note: "game evidence is low weight; a tutor check confirms" },
  };
}
