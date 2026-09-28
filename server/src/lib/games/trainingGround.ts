// Training Ground — server side. See features/learninghub/games/training/core.ts for the pure engine/content this
// wraps, and docs/games-prototypes/BACKEND-PATTERN.md for the contract. The browser never sends a score: it sends
// typed answers + response times; this file re-marks them from the SEEDED PLAN it itself stored at start.
import { db } from "../../firebase";
import {
  applyDrillToItems, cleanDrillAnswers, DRILL, freshItemState, makeDrillPlan, markDrill, packById,
  type DrillItem, type ItemState, type DrillAnswer,
} from "../../../../features/learninghub/games/training/core";
import { weekDaysOf } from "../../../../features/learninghub/games/quiz/core";
import { GameError, loadMiniProfile, defMiniProfile, recordMiniRun, sessionsCol, SESSION_TTL_MS, type MiniProfile } from "./shared";

export const GAME_ID = "training-ground";
const itemStateCol = db.collection("hubTrainingItemState");
const itemStateId = (tenantId: string, childId: string, packId: string, itemId: string) => `${tenantId}__${childId}__${packId}__${itemId}`;

async function loadItemStates(tenantId: string, childId: string, packId: string): Promise<Map<string, ItemState>> {
  const snap = await itemStateCol.where("tenantId", "==", tenantId).where("childId", "==", childId).where("packId", "==", packId).get();
  const m = new Map<string, ItemState>();
  for (const d of snap.docs) { const v = d.data() as ItemState; m.set(v.id, v); }
  return m;
}

export async function startTraining(o: { tenantId: string; franchiseId: string | null; childId: string; parentUid: string; packId?: unknown; nowIso: string }) {
  const packId = typeof o.packId === "string" ? o.packId : "spell-ks2-y34";
  const pack = packById(packId);
  if (!pack) throw new GameError(400, "Unknown pack");
  const states = await loadItemStates(o.tenantId, o.childId, packId);
  const seed = (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
  const plan = makeDrillPlan(seed, pack, states);
  const ref = sessionsCol.doc();
  await ref.set({
    tenantId: o.tenantId, franchiseId: o.franchiseId, childId: o.childId, parentUid: o.parentUid, gameId: GAME_ID, kind: GAME_ID, packId, seed, plan,
    status: "started", startedAt: o.nowIso, expiresAt: new Date(new Date(o.nowIso).getTime() + SESSION_TTL_MS).toISOString(), createdBy: o.parentUid, createdAt: o.nowIso,
  });
  const profile = await loadMiniProfile(o.tenantId, o.childId, GAME_ID);
  return { sessionId: ref.id, seed, packId, packTitle: pack.title, plan: plan.map(publicItem), limits: { n: DRILL.n, answerMs: DRILL.answerMs }, points: profile?.points ?? 0, streakDays: profile?.streakDays ?? 0 };
}
const publicItem = (it: DrillItem) => ({ id: it.id, prompt: it.prompt });

export async function finishTraining(o: { tenantId: string; childId: string; sessionId: string; answers?: unknown; nowIso: string }) {
  const ref = sessionsCol.doc(o.sessionId);
  const first = await ref.get();
  if (!first.exists || first.get("tenantId") !== o.tenantId || first.get("childId") !== o.childId || first.get("kind") !== GAME_ID) throw new GameError(404, "Game not found");
  if (first.get("status") === "done") return { ...(first.get("result") as object), repeat: true };
  if (String(first.get("expiresAt")) < o.nowIso) throw new GameError(410, "This game has expired — start a new one");
  const plan = first.get("plan") as DrillItem[];
  const answers = cleanDrillAnswers(o.answers, plan.length);
  if (!answers) throw new GameError(400, `Send ${plan.length} answers`);
  const res = markDrill(plan, answers);
  const packId = first.get("packId") as string;
  const franchiseId = (first.get("franchiseId") as string | null) ?? null;
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.get("status") === "done") return { ...(snap.get("result") as object), repeat: true };
    const itemRefs = plan.map((it) => itemStateCol.doc(itemStateId(o.tenantId, o.childId, packId, it.id)));
    const pRef = db.collection("hubMiniGameProfile").doc(`${o.tenantId}__${o.childId}__${GAME_ID}`);
    const [pSnap, ...iSnaps] = await Promise.all([tx.get(pRef), ...itemRefs.map((r) => tx.get(r))]);
    const states = new Map<string, ItemState>();
    plan.forEach((it, i) => { if (iSnaps[i]!.exists) states.set(it.id, iSnaps[i]!.data() as ItemState); });
    const updated = applyDrillToItems(res.rows, states, o.nowIso);
    itemRefs.forEach((r, i) => tx.set(r, { tenantId: o.tenantId, franchiseId, childId: o.childId, packId, ...(updated.get(plan[i]!.id) ?? freshItemState(plan[i]!.id)), createdAt: iSnaps[i]!.exists ? iSnaps[i]!.get("createdAt") : o.nowIso }));
    const prof0: MiniProfile = pSnap.exists ? (pSnap.data() as MiniProfile) : defMiniProfile(o.tenantId, franchiseId, o.childId, GAME_ID, o.nowIso);
    const prof = recordMiniRun(prof0, { setKey: packId, correct: res.score, total: res.total, nowIso: o.nowIso });
    tx.set(pRef, prof);
    const result = { done: true, score: res.score, total: res.total, streak: res.streak, packId, points: prof.points, streakDays: prof.streakDays, best: prof.bests[packId] ?? null, wrong: res.rows.filter((r) => !r.ok).map((r) => ({ prompt: r.prompt, answer: r.answer, entered: r.entered })), mastery: { source: "game", weight: 0.1 } };
    tx.update(ref, { status: "done", finishedAt: o.nowIso, result, trials: res.rows.map((r) => ({ itemId: r.id, correct: r.ok ? 1 : 0, chosen: r.entered })) });
    return result;
  });
}

export async function trainingProgress(tenantId: string, childId: string) {
  const [profile, snap] = await Promise.all([
    loadMiniProfile(tenantId, childId, GAME_ID),
    sessionsCol.where("tenantId", "==", tenantId).where("childId", "==", childId).where("kind", "==", GAME_ID).where("status", "==", "done").get(),
  ]);
  const runs = snap.docs.map((d) => ({ at: d.get("finishedAt") as string, packId: d.get("packId") as string, score: d.get("result.score") as number, total: d.get("result.total") as number })).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  const nowIso = new Date().toISOString();
  return { points: profile?.points ?? 0, streakDays: profile?.streakDays ?? 0, bests: profile?.bests ?? {}, runs, weekDays: weekDaysOf(profile?.daysPlayed ?? [], nowIso), weekGoal: 5 };
}
