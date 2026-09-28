// Bot Foundry — server side. See features/learninghub/games/botfoundry/core.ts for the pure engine/puzzle bank,
// and docs/games-prototypes/BACKEND-PATTERN.md for the contract. The browser never sends "solved: true": it sends
// the PROGRAM it built for each puzzle, and this file re-runs it against the puzzle's own grid with the identical
// pure `runProgram` the client used to animate the bot.
import { db } from "../../firebase";
import {
  applyBotToItems, BOT_RUN, cleanSubmissions, freshPuzzleState, makeBotPlan, markBotRun, puzzleById,
  type Puzzle, type PuzzleState,
} from "../../../../features/learninghub/games/botfoundry/core";
import { weekDaysOf } from "../../../../features/learninghub/games/quiz/core";
import { GameError, loadMiniProfile, defMiniProfile, recordMiniRun, sessionsCol, SESSION_TTL_MS, type MiniProfile } from "./shared";

export const GAME_ID = "bot-foundry";
const puzzleStateCol = db.collection("hubBotPuzzleState");
const puzzleStateId = (tenantId: string, childId: string, puzzleId: string) => `${tenantId}__${childId}__${puzzleId}`;

async function loadPuzzleStates(tenantId: string, childId: string): Promise<Map<string, PuzzleState>> {
  const snap = await puzzleStateCol.where("tenantId", "==", tenantId).where("childId", "==", childId).get();
  const m = new Map<string, PuzzleState>();
  for (const d of snap.docs) { const v = d.data() as PuzzleState; m.set(v.id, v); }
  return m;
}

export async function startBotFoundry(o: { tenantId: string; franchiseId: string | null; childId: string; parentUid: string; years?: string[]; nowIso: string }) {
  const states = await loadPuzzleStates(o.tenantId, o.childId);
  const seed = (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
  const plan = makeBotPlan(seed, states, o.years);
  const ref = sessionsCol.doc();
  await ref.set({
    tenantId: o.tenantId, franchiseId: o.franchiseId, childId: o.childId, parentUid: o.parentUid, gameId: GAME_ID, kind: GAME_ID, seed, planIds: plan.map((p) => p.id),
    status: "started", startedAt: o.nowIso, expiresAt: new Date(new Date(o.nowIso).getTime() + SESSION_TTL_MS).toISOString(), createdBy: o.parentUid, createdAt: o.nowIso,
  });
  const profile = await loadMiniProfile(o.tenantId, o.childId, GAME_ID);
  return { sessionId: ref.id, seed, plan: plan.map(publicPuzzle), limits: { n: BOT_RUN.n }, points: profile?.points ?? 0, streakDays: profile?.streakDays ?? 0 };
}
const publicPuzzle = (p: Puzzle) => ({ id: p.id, title: p.title, concept: p.concept, grid: p.grid, parMoves: p.parMoves, starterBug: p.starterBug ?? null });

export async function finishBotFoundry(o: { tenantId: string; childId: string; sessionId: string; submissions?: unknown; nowIso: string }) {
  const ref = sessionsCol.doc(o.sessionId);
  const first = await ref.get();
  if (!first.exists || first.get("tenantId") !== o.tenantId || first.get("childId") !== o.childId || first.get("kind") !== GAME_ID) throw new GameError(404, "Game not found");
  if (first.get("status") === "done") return { ...(first.get("result") as object), repeat: true };
  if (String(first.get("expiresAt")) < o.nowIso) throw new GameError(410, "This game has expired — start a new one");
  const planIds = first.get("planIds") as string[];
  const plan = planIds.map((id) => puzzleById(id)).filter((p): p is Puzzle => !!p);
  if (plan.length !== planIds.length) throw new GameError(500, "Puzzle bank changed underneath this session");
  const submissions = cleanSubmissions(o.submissions, plan);
  if (!submissions) throw new GameError(400, "Bad submissions");
  const res = markBotRun(plan, submissions);
  const franchiseId = (first.get("franchiseId") as string | null) ?? null;
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.get("status") === "done") return { ...(snap.get("result") as object), repeat: true };
    const puzzleRefs = plan.map((p) => puzzleStateCol.doc(puzzleStateId(o.tenantId, o.childId, p.id)));
    const pRef = db.collection("hubMiniGameProfile").doc(`${o.tenantId}__${o.childId}__${GAME_ID}`);
    const [pSnap, ...qSnaps] = await Promise.all([tx.get(pRef), ...puzzleRefs.map((r) => tx.get(r))]);
    const states = new Map<string, PuzzleState>();
    plan.forEach((p, i) => { if (qSnaps[i]!.exists) states.set(p.id, qSnaps[i]!.data() as PuzzleState); });
    const updated = applyBotToItems(res.rows, states, o.nowIso);
    puzzleRefs.forEach((r, i) => tx.set(r, { tenantId: o.tenantId, franchiseId, childId: o.childId, ...(updated.get(plan[i]!.id) ?? freshPuzzleState(plan[i]!.id)), createdAt: qSnaps[i]!.exists ? qSnaps[i]!.get("createdAt") : o.nowIso }));
    const prof0: MiniProfile = pSnap.exists ? (pSnap.data() as MiniProfile) : defMiniProfile(o.tenantId, franchiseId, o.childId, GAME_ID, o.nowIso);
    const prof = recordMiniRun(prof0, { setKey: "run", correct: res.solved, total: res.total, nowIso: o.nowIso });
    tx.set(pRef, prof);
    const totalStars = res.rows.reduce((a, r) => a + r.stars, 0);
    const result = { done: true, solved: res.solved, total: res.total, stars: totalStars, maxStars: res.total * 3, points: prof.points, streakDays: prof.streakDays, rows: res.rows, mastery: { source: "game", weight: 0.1 } };
    tx.update(ref, { status: "done", finishedAt: o.nowIso, result, trials: res.rows.map((r) => ({ itemId: r.puzzleId, correct: r.reached ? 1 : 0, concept: r.concept })) });
    return result;
  });
}

export async function botFoundryProgress(tenantId: string, childId: string) {
  const [profile, puzzles, snap] = await Promise.all([
    loadMiniProfile(tenantId, childId, GAME_ID),
    loadPuzzleStates(tenantId, childId),
    sessionsCol.where("tenantId", "==", tenantId).where("childId", "==", childId).where("kind", "==", GAME_ID).where("status", "==", "done").get(),
  ]);
  const runs = snap.docs.map((d) => ({ at: d.get("finishedAt") as string, solved: d.get("result.solved") as number, total: d.get("result.total") as number, stars: d.get("result.stars") as number })).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  const nowIso = new Date().toISOString();
  return { points: profile?.points ?? 0, streakDays: profile?.streakDays ?? 0, puzzlesSolved: [...puzzles.values()].filter((p) => p.solved).length, runs, weekDays: weekDaysOf(profile?.daysPlayed ?? [], nowIso), weekGoal: 5 };
}
