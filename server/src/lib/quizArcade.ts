import { db } from "../firebase";
import { makeRng, type Rng } from "../../../features/learninghub/tools/engine/rng";

// Shared server-authoritative engine for the Learning Hub's "quiz arcade" games: Prime Reef (number theory),
// Data Carnival (statistics) and Shape Workshop (geometry). These are three genuinely different skill domains
// (docs/games-prototypes/BACKEND-PATTERN.md step 1: "does the new game ask the same kind of question over the
// same fact universe as an existing game?" — no), so each gets its own item bank and its own mastery collection —
// but they share the exact same session lifecycle, marking, mastery-update and profile-update code so there is
// ONE place that can be subtly wrong instead of three. Follows the same non-negotiable as Penguin/Turbo Slide:
// the browser never sends a score. It receives a plan of multiple-choice items WITHOUT their correct answers,
// sends back only which choice it picked (and how long it took) per item, and the server marks against the
// full plan it kept for itself — exactly the shape of the existing MTC practice mode (features/learninghub/games/penguin/mtc.ts).
//
// Firestore collections (Step 2 of BACKEND-PATTERN.md). Named "QuizArcade" (not "Quiz") because a separate,
// unrelated static-item-bank + Leitner engine already exists at features/learninghub/games/quiz/core.ts +
// server/src/lib/hubQuizGames.ts (for Compass Quest / Museum Vault / Colour Lab) — that engine replays a FIXED
// bank of pre-written items, which is right for content like "which way is south-west" but wrong for arithmetic
// (a fixed bank of "mean of {2,4,6}" questions would let a child memorise the answer instead of computing it).
// This engine instead re-generates a fresh, seeded set of items every run from a pure generator per game, which is
// closer in shape to features/learninghub/games/applied/core.ts's generateForm — just multiple-choice instead of
// typed numeric answers. Three distinct engines for three genuinely different item shapes, not three copies of one:
//   hubGameSessions      (SHARED with every other game) — one doc per run: kind "quiz", gameId, the full plan
//                        (including correctIndex — never sent back to the client), and once finished, the result.
//   hubQuizArcadeMastery one doc per (child, gameId, topic): attempts, correct, streak, recent wrong answers.
//   hubQuizArcadeProfile one doc per (child, gameId): best score/streak, run count, coins earned, days played.
export const sessionsCol = db.collection("hubGameSessions");
export const masteryCol = db.collection("hubQuizArcadeMastery");
export const profileCol = db.collection("hubQuizArcadeProfile");

const SESSION_TTL_MS = 48 * 3600_000;
export class GameError extends Error { constructor(public status: number, msg: string) { super(msg); } }

export type QuizGameId = "prime-reef" | "data-carnival" | "shape-workshop";

export interface QuizItem {
  /** Stable id within the run, e.g. "q3" — used to line up an answer with its item. */
  id: string;
  topic: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  /** Shown on the end-of-run review after a miss (docs/games-prototypes/ARCADE-BRIEF.md #5). */
  explain: string;
}
export type PublicItem = Omit<QuizItem, "correctIndex" | "explain">;
function stripPlan(plan: QuizItem[]): PublicItem[] {
  return plan.map(({ id, topic, prompt, choices }) => ({ id, topic, prompt, choices }));
}

export interface QuizGameSpec {
  gameId: QuizGameId;
  topics: readonly string[];
  runLength: number;
  /** Pure + seeded: given the seed and which topics the child is weakest on, build the run's items. Must be
   *  deterministic (same seed + same weakTopics + same difficulty ⇒ same plan) so a re-derivation for audit is
   *  possible even though in practice the server just keeps the plan it generated. */
  buildPlan(rng: Rng, o: { difficulty: 1 | 2 | 3; weakTopics: string[] }): QuizItem[];
}

export interface MasteryRow { topic: string; attempts: number; correct: number; streakBest: number; level: 0 | 1 | 2 | 3 | 4; lastSeen: string | null; recentWrong: { prompt: string; chosen: string; correct: string }[] }
export interface QuizProfileDoc {
  tenantId: string; franchiseId: string | null; childId: string; gameId: QuizGameId;
  runs: number; bestScore: number; bestStreak: number; totalCorrect: number; totalAnswered: number; coins: number;
  days: string[]; lastPlayedAt: string | null; createdAt: string; updatedAt: string;
}
const defProfile = (tenantId: string, franchiseId: string | null, childId: string, gameId: QuizGameId, now: string): QuizProfileDoc => ({
  tenantId, franchiseId, childId, gameId, runs: 0, bestScore: 0, bestStreak: 0, totalCorrect: 0, totalAnswered: 0, coins: 0, days: [], lastPlayedAt: null, createdAt: now, updatedAt: now,
});
const profileId = (tenantId: string, childId: string, gameId: QuizGameId) => `${tenantId}__${childId}__${gameId}`;
const masteryId = (tenantId: string, childId: string, gameId: QuizGameId, topic: string) => `${tenantId}__${childId}__${gameId}__${topic}`;

async function loadProfile(tenantId: string, childId: string, gameId: QuizGameId): Promise<QuizProfileDoc | null> {
  const s = await profileCol.doc(profileId(tenantId, childId, gameId)).get();
  return s.exists ? (s.data() as QuizProfileDoc) : null;
}
async function loadMastery(tenantId: string, childId: string, gameId: QuizGameId): Promise<Map<string, MasteryRow & { updatedAt: string }>> {
  const snap = await masteryCol.where("tenantId", "==", tenantId).where("childId", "==", childId).where("gameId", "==", gameId).get();
  const m = new Map<string, MasteryRow & { updatedAt: string }>();
  for (const d of snap.docs) {
    const v = d.data();
    m.set(v.topic as string, { topic: v.topic, attempts: v.attempts ?? 0, correct: v.correct ?? 0, streakBest: v.streakBest ?? 0, level: v.level ?? 0, lastSeen: v.lastSeen ?? null, recentWrong: v.recentWrong ?? [], updatedAt: v.updatedAt ?? "" });
  }
  return m;
}
const levelOf = (attempts: number, correct: number): 0 | 1 | 2 | 3 | 4 => {
  if (attempts < 2) return 0;
  const acc = correct / attempts;
  if (attempts >= 8 && acc >= 0.85) return 4;
  if (attempts >= 5 && acc >= 0.75) return 3;
  if (attempts >= 3 && acc >= 0.6) return 2;
  return 1;
};

/** What difficulty band + which topics to weight this run toward, from the child's own mastery so far
 *  (weakest-first, same idea as Penguin Slide's `frontier`). First-ever run is always the easiest band. */
function pickDifficulty(mastery: Map<string, MasteryRow>, topics: readonly string[]): { difficulty: 1 | 2 | 3; weakTopics: string[] } {
  const rows = topics.map((t) => mastery.get(t)).filter((r): r is MasteryRow => !!r && r.attempts >= 3);
  if (!rows.length) return { difficulty: 1, weakTopics: [...topics] };
  const overallAcc = rows.reduce((a, r) => a + r.correct / r.attempts, 0) / rows.length;
  const difficulty: 1 | 2 | 3 = overallAcc < 0.6 ? 1 : overallAcc < 0.85 ? 2 : 3;
  const seen = new Set(rows.map((r) => r.topic));
  const unseen = topics.filter((t) => !seen.has(t));
  const weakest = [...rows].sort((a, b) => a.correct / a.attempts - b.correct / b.attempts).slice(0, Math.max(1, Math.ceil(topics.length / 2))).map((r) => r.topic);
  return { difficulty, weakTopics: [...unseen, ...weakest].length ? [...unseen, ...weakest] : [...topics] };
}

export interface StartResult { sessionId: string; seed: number; items: PublicItem[]; runLength: number; best: { score: number; streak: number } | null; coins: number; topics: readonly string[] }
export async function startQuizSession(spec: QuizGameSpec, o: { tenantId: string; franchiseId: string | null; childId: string; parentUid: string; nowIso: string }): Promise<StartResult> {
  const [mastery, profile] = await Promise.all([loadMastery(o.tenantId, o.childId, spec.gameId), loadProfile(o.tenantId, o.childId, spec.gameId)]);
  const seed = (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
  const { difficulty, weakTopics } = pickDifficulty(mastery, spec.topics);
  const rng = makeRng(seed);
  const plan = spec.buildPlan(rng, { difficulty, weakTopics });
  if (plan.length !== spec.runLength) throw new Error(`buildPlan for ${spec.gameId} returned ${plan.length} items, expected ${spec.runLength}`);
  const ref = sessionsCol.doc();
  await ref.set({
    tenantId: o.tenantId, franchiseId: o.franchiseId, childId: o.childId, parentUid: o.parentUid, gameId: spec.gameId, kind: "quiz", seed, plan, status: "started",
    startedAt: o.nowIso, expiresAt: new Date(new Date(o.nowIso).getTime() + SESSION_TTL_MS).toISOString(), createdBy: o.parentUid, createdAt: o.nowIso,
    settings: { difficulty, weakTopics },
  });
  return { sessionId: ref.id, seed, items: stripPlan(plan), runLength: spec.runLength, best: profile ? { score: profile.bestScore, streak: profile.bestStreak } : null, coins: profile?.coins ?? 0, topics: spec.topics };
}

export interface Answer { id: unknown; chosen: unknown; ms: unknown }
export function cleanAnswers(raw: unknown, plan: QuizItem[]): { id: string; chosenIndex: number | null; ms: number }[] | null {
  if (!Array.isArray(raw) || raw.length !== plan.length) return null;
  const byId = new Map(plan.map((p) => [p.id, p]));
  const out: { id: string; chosenIndex: number | null; ms: number }[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") return null;
    const a = x as Answer;
    if (typeof a.id !== "string" || !byId.has(a.id)) return null;
    const item = byId.get(a.id)!;
    const chosen = a.chosen;
    if (!(chosen === null || (typeof chosen === "number" && Number.isInteger(chosen) && chosen >= 0 && chosen < item.choices.length))) return null;
    const ms = Number(a.ms);
    if (!Number.isFinite(ms) || ms < 0) return null;
    out.push({ id: a.id, chosenIndex: chosen as number | null, ms: Math.min(120_000, Math.round(ms)) });
  }
  return out;
}

export interface QuizResult {
  score: number; total: number; accuracy: number; streak: number; bestStreak: number; coins: number; newBest: boolean;
  rows: { id: string; topic: string; prompt: string; ok: boolean; chosen: string | null; correct: string; explain: string }[];
  repeat?: boolean;
}

/** Re-mark a finished (or ended-early — an unanswered tail counts as wrong, never dropped) run against the
 *  server's own stored plan. Idempotent: a second finish on the same session returns the stored result. */
export async function finishQuizSession(spec: QuizGameSpec, o: { tenantId: string; childId: string; sessionId: string; answers?: unknown; nowIso: string }): Promise<QuizResult> {
  const ref = sessionsCol.doc(o.sessionId);
  const first = await ref.get();
  if (!first.exists || first.get("tenantId") !== o.tenantId || first.get("childId") !== o.childId || first.get("gameId") !== spec.gameId) throw new GameError(404, "Game not found");
  if (first.get("status") === "done") return { ...(first.get("result") as QuizResult), repeat: true };
  if (String(first.get("expiresAt")) < o.nowIso) throw new GameError(410, "This game has expired - start a new one");
  const plan = first.get("plan") as QuizItem[];
  const answers = cleanAnswers(o.answers, plan);
  if (!answers) throw new GameError(400, "Bad answers");
  const byId = new Map(answers.map((a) => [a.id, a]));

  let streak = 0, bestStreak = 0, correctCount = 0;
  const rows: QuizResult["rows"] = [];
  const perTopic = new Map<string, { attempts: number; correct: number; wrong: { prompt: string; chosen: string; correct: string }[] }>();
  for (const item of plan) {
    const a = byId.get(item.id);
    const ok = !!a && a.chosenIndex === item.correctIndex;
    if (ok) { correctCount++; streak++; bestStreak = Math.max(bestStreak, streak); } else streak = 0;
    const t = perTopic.get(item.topic) ?? { attempts: 0, correct: 0, wrong: [] };
    t.attempts++; if (ok) t.correct++;
    else t.wrong.push({ prompt: item.prompt, chosen: a && a.chosenIndex !== null ? item.choices[a.chosenIndex]! : "(no answer)", correct: item.choices[item.correctIndex]! });
    perTopic.set(item.topic, t);
    rows.push({ id: item.id, topic: item.topic, prompt: item.prompt, ok, chosen: a && a.chosenIndex !== null ? item.choices[a.chosenIndex]! : null, correct: item.choices[item.correctIndex]!, explain: item.explain });
  }
  const coinsEarned = Math.floor(correctCount / 2);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.get("status") === "done") return { ...(snap.get("result") as QuizResult), repeat: true };
    const franchiseId = (snap.get("franchiseId") as string | null) ?? null;
    const pRef = profileCol.doc(profileId(o.tenantId, o.childId, spec.gameId));
    const topics = [...perTopic.keys()];
    const mRefs = topics.map((t) => masteryCol.doc(masteryId(o.tenantId, o.childId, spec.gameId, t)));
    const [pSnap, ...mSnaps] = await Promise.all([tx.get(pRef), ...mRefs.map((r) => tx.get(r))]);
    const prof: QuizProfileDoc = pSnap.exists ? (pSnap.data() as QuizProfileDoc) : defProfile(o.tenantId, franchiseId, o.childId, spec.gameId, o.nowIso);
    const day = o.nowIso.slice(0, 10);
    const newBest = correctCount > prof.bestScore;
    const nextProfile: QuizProfileDoc = {
      ...prof, runs: prof.runs + 1, bestScore: Math.max(prof.bestScore, correctCount), bestStreak: Math.max(prof.bestStreak, bestStreak),
      totalCorrect: prof.totalCorrect + correctCount, totalAnswered: prof.totalAnswered + plan.length, coins: prof.coins + coinsEarned,
      days: prof.days.includes(day) ? prof.days : [...prof.days, day].slice(-60), lastPlayedAt: o.nowIso, updatedAt: o.nowIso,
    };
    tx.set(pRef, nextProfile);
    topics.forEach((topic, i) => {
      const cur = mSnaps[i]!.exists ? mSnaps[i]!.data()! : null;
      const t = perTopic.get(topic)!;
      const attempts = (cur?.attempts ?? 0) + t.attempts, correct = (cur?.correct ?? 0) + t.correct;
      const recentWrong = [...(cur?.recentWrong ?? []), ...t.wrong].slice(-5);
      tx.set(mRefs[i]!, {
        tenantId: o.tenantId, franchiseId, childId: o.childId, gameId: spec.gameId, topic, attempts, correct,
        streakBest: Math.max(cur?.streakBest ?? 0, bestStreak), level: levelOf(attempts, correct), lastSeen: o.nowIso, recentWrong,
        createdAt: cur?.createdAt ?? o.nowIso, updatedAt: o.nowIso,
      });
    });
    const result: QuizResult = { score: correctCount, total: plan.length, accuracy: Math.round((correctCount / plan.length) * 100) / 100, streak, bestStreak, coins: coinsEarned, newBest, rows };
    tx.update(ref, { status: "done", finishedAt: o.nowIso, result });
    return result;
  });
}

const WEEK_GOAL = 5;
/** Days practised in the current week (Sun-Sat), same convention as every other game's `weekDaysOf`. */
function weekDaysOf(days: readonly string[], nowIso = new Date().toISOString()): number {
  const start = new Date(nowIso); start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const cutoff = start.toISOString().slice(0, 10);
  return days.filter((d) => d >= cutoff).length;
}

export interface QuizFacts {
  gameId: QuizGameId; topics: MasteryRow[]; runs: number; bestScore: number; bestStreak: number; coins: number; days: string[];
  totalCorrect: number; totalAnswered: number; lastPlayedAt: string | null; weekDays: number; weekGoal: number;
}
export async function quizFacts(spec: QuizGameSpec, tenantId: string, childId: string): Promise<QuizFacts> {
  const [mastery, profile] = await Promise.all([loadMastery(tenantId, childId, spec.gameId), loadProfile(tenantId, childId, spec.gameId)]);
  const topics = spec.topics.map((t) => mastery.get(t) ?? { topic: t, attempts: 0, correct: 0, streakBest: 0, level: 0 as const, lastSeen: null, recentWrong: [] });
  return {
    gameId: spec.gameId, topics, runs: profile?.runs ?? 0, bestScore: profile?.bestScore ?? 0, bestStreak: profile?.bestStreak ?? 0, coins: profile?.coins ?? 0,
    days: profile?.days ?? [], totalCorrect: profile?.totalCorrect ?? 0, totalAnswered: profile?.totalAnswered ?? 0,
    lastPlayedAt: profile?.lastPlayedAt ?? null, weekDays: weekDaysOf(profile?.days ?? []), weekGoal: WEEK_GOAL,
  };
}

/** For the Progress-panel summary card: has this child played ANY of the three quiz-arcade games, combined. */
export async function quizArcadeSummary(tenantId: string, childId: string, specs: QuizGameSpec[]): Promise<{ played: boolean; runs: number; bestScore: number; gamesPlayed: number; weekDays: number }> {
  const profiles = await Promise.all(specs.map((s) => loadProfile(tenantId, childId, s.gameId)));
  const played = profiles.some((p) => !!p);
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const daySet = new Set<string>();
  for (const p of profiles) if (p) for (const d of p.days) if (d >= cutoff) daySet.add(d);
  return {
    played, runs: profiles.reduce((a, p) => a + (p?.runs ?? 0), 0), bestScore: Math.max(0, ...profiles.map((p) => p?.bestScore ?? 0)),
    gamesPlayed: profiles.filter((p) => !!p).length, weekDays: daySet.size,
  };
}
