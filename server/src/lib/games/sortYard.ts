// Sort Yard — server side. See features/learninghub/games/sortyard/core.ts for the pure engine/data bank, and
// docs/games-prototypes/BACKEND-PATTERN.md for the contract. The browser never sends "correct: true": it sends its
// SUBMITTED classification/answer/ordering for each round, and this file re-grades every one from the stored plan.
import { db } from "../../firebase";
import {
  cleanSubmissions, freshRoundState, makeSortPlan, markSortRun, roundById, SORTYARD_RUN,
  type Round, type RoundState,
} from "../../../../features/learninghub/games/sortyard/core";
import { weekDaysOf } from "../../../../features/learninghub/games/quiz/core";
import { GameError, loadMiniProfile, defMiniProfile, recordMiniRun, sessionsCol, SESSION_TTL_MS, type MiniProfile } from "./shared";

export const GAME_ID = "sort-yard";
const roundStateCol = db.collection("hubSortRoundState");
const roundStateId = (tenantId: string, childId: string, roundId: string) => `${tenantId}__${childId}__${roundId}`;

async function loadRoundStates(tenantId: string, childId: string): Promise<Map<string, RoundState>> {
  const snap = await roundStateCol.where("tenantId", "==", tenantId).where("childId", "==", childId).get();
  const m = new Map<string, RoundState>();
  for (const d of snap.docs) { const v = d.data() as RoundState; m.set(v.id, v); }
  return m;
}

export async function startSortYard(o: { tenantId: string; franchiseId: string | null; childId: string; parentUid: string; years?: string[]; nowIso: string }) {
  const states = await loadRoundStates(o.tenantId, o.childId);
  const seed = (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
  const plan = makeSortPlan(seed, states, o.years);
  const ref = sessionsCol.doc();
  await ref.set({
    tenantId: o.tenantId, franchiseId: o.franchiseId, childId: o.childId, parentUid: o.parentUid, gameId: GAME_ID, kind: GAME_ID, seed, planIds: plan.map((r) => r.id),
    status: "started", startedAt: o.nowIso, expiresAt: new Date(new Date(o.nowIso).getTime() + SESSION_TTL_MS).toISOString(), createdBy: o.parentUid, createdAt: o.nowIso,
  });
  const profile = await loadMiniProfile(o.tenantId, o.childId, GAME_ID);
  return { sessionId: ref.id, seed, plan: plan.map(publicRound), limits: { n: SORTYARD_RUN.n }, points: profile?.points ?? 0, streakDays: profile?.streakDays ?? 0 };
}
// Chart/order rounds carry their real values (that's the data to read, not the answer); sort rounds carry the item
// labels and category CHOICES but never which item maps to which category.
function publicRound(r: Round) {
  if (r.kind === "sort") return { kind: r.kind, id: r.id, title: r.title, concept: r.concept, categories: r.categories, items: r.items.map((it) => it.label) };
  if (r.kind === "chart") return { kind: r.kind, id: r.id, title: r.title, concept: r.concept, chartTitle: r.chartTitle, bars: r.bars, question: r.question };
  return { kind: r.kind, id: r.id, title: r.title, concept: r.concept, values: r.values, direction: r.direction };
}

export async function finishSortYard(o: { tenantId: string; childId: string; sessionId: string; submissions?: unknown; nowIso: string }) {
  const ref = sessionsCol.doc(o.sessionId);
  const first = await ref.get();
  if (!first.exists || first.get("tenantId") !== o.tenantId || first.get("childId") !== o.childId || first.get("kind") !== GAME_ID) throw new GameError(404, "Game not found");
  if (first.get("status") === "done") return { ...(first.get("result") as object), repeat: true };
  if (String(first.get("expiresAt")) < o.nowIso) throw new GameError(410, "This game has expired — start a new one");
  const planIds = first.get("planIds") as string[];
  const plan = planIds.map((id) => roundById(id)).filter((r): r is Round => !!r);
  if (plan.length !== planIds.length) throw new GameError(500, "Round bank changed underneath this session");
  const submissions = cleanSubmissions(o.submissions, plan);
  if (!submissions) throw new GameError(400, "Bad submissions");
  const res = markSortRun(plan, submissions);
  const franchiseId = (first.get("franchiseId") as string | null) ?? null;
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.get("status") === "done") return { ...(snap.get("result") as object), repeat: true };
    const roundRefs = plan.map((r) => roundStateCol.doc(roundStateId(o.tenantId, o.childId, r.id)));
    const pRef = db.collection("hubMiniGameProfile").doc(`${o.tenantId}__${o.childId}__${GAME_ID}`);
    const [pSnap, ...rSnaps] = await Promise.all([tx.get(pRef), ...roundRefs.map((r) => tx.get(r))]);
    const states = new Map<string, RoundState>();
    plan.forEach((r, i) => { if (rSnaps[i]!.exists) states.set(r.id, rSnaps[i]!.data() as RoundState); });
    for (const row of res.rows) {
      const s = states.get(row.roundId) ?? freshRoundState(row.roundId);
      states.set(row.roundId, { id: row.roundId, solved: s.solved || row.correct, attempts: s.attempts + 1, correct: s.correct + (row.correct ? 1 : 0), updatedAt: o.nowIso });
    }
    roundRefs.forEach((r, i) => tx.set(r, { tenantId: o.tenantId, franchiseId, childId: o.childId, ...(states.get(plan[i]!.id) ?? freshRoundState(plan[i]!.id)), createdAt: rSnaps[i]!.exists ? rSnaps[i]!.get("createdAt") : o.nowIso }));
    const prof0: MiniProfile = pSnap.exists ? (pSnap.data() as MiniProfile) : defMiniProfile(o.tenantId, franchiseId, o.childId, GAME_ID, o.nowIso);
    const prof = recordMiniRun(prof0, { setKey: "run", correct: res.correct, total: res.total, nowIso: o.nowIso });
    tx.set(pRef, prof);
    const result = { done: true, correct: res.correct, total: res.total, points: prof.points, streakDays: prof.streakDays, rows: res.rows, mastery: { source: "game", weight: 0.1 } };
    tx.update(ref, { status: "done", finishedAt: o.nowIso, result, trials: res.rows.map((r) => ({ itemId: r.roundId, correct: r.correct ? 1 : 0, concept: r.concept })) });
    return result;
  });
}

export async function sortYardProgress(tenantId: string, childId: string) {
  const [profile, rounds, snap] = await Promise.all([
    loadMiniProfile(tenantId, childId, GAME_ID),
    loadRoundStates(tenantId, childId),
    sessionsCol.where("tenantId", "==", tenantId).where("childId", "==", childId).where("kind", "==", GAME_ID).where("status", "==", "done").get(),
  ]);
  const runs = snap.docs.map((d) => ({ at: d.get("finishedAt") as string, correct: d.get("result.correct") as number, total: d.get("result.total") as number })).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  const nowIso = new Date().toISOString();
  return { points: profile?.points ?? 0, streakDays: profile?.streakDays ?? 0, roundsSolved: [...rounds.values()].filter((r) => r.solved).length, runs, weekDays: weekDaysOf(profile?.daysPlayed ?? [], nowIso), weekGoal: 5 };
}
