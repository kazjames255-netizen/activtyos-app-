import { db } from "../firebase";
import {
  cleanAnswers, clampLevel, generateForm, GAME_IDS, ITEMS_PER_RUN, markForm, nextLevel, sanitize,
  type GameId, type Item, type Level,
} from "../../../features/learninghub/games/applied/core";

// Learning Hub — the applied-maths cluster: Market Day (money/economics), Bake Off Blitz (measurement/ratio/
// proportion), Rhythm Reef (pattern/sequencing). See docs/games-prototypes/BACKEND-PATTERN.md step 1: three
// genuinely different skill domains, so each gets its own state shape here (not forced into the times-tables
// fact-key model of hubGames.ts) but they follow the exact same server-authoritative contract: the server issues a
// form built from a seed (features/learninghub/games/applied/core.ts), the client shows it and sends back only the
// answers actually given, the server re-marks the SAME stored items it issued.
//
// Two collections, keyed by (tenantId, childId, ...):
//   hubAppliedSessions   one doc per run: gameId, level, seed, the FULL items (incl. answer key — never sent to the
//                        client as-is, see `sanitize`), then once finished the marked result.
//   hubAppliedState      one doc per (child, gameId): current level, per-tag attempt/correct tallies, personal
//                        bests, xp/streak bookkeeping — the same shape for all three games so GamesSummaryCard's
//                        pattern extends cleanly instead of forking a parallel summary per game.
export const appliedSessionsCol = db.collection("hubAppliedSessions");
export const appliedStateCol = db.collection("hubAppliedState");
const SESSION_TTL_MS = 48 * 3600_000;
const DAILY_SOFT_CAP = 20;

export const appliedStateId = (tenantId: string, childId: string, gameId: GameId) => `${tenantId}__${childId}__${gameId}`;

export interface TagStat { attempts: number; correct: number }
export interface AppliedStateDoc {
  tenantId: string; franchiseId: string | null; childId: string; gameId: GameId;
  level: Level; tags: Record<string, TagStat>;
  best: { score: number; total: number; at: string } | null;
  xp: { day: string; xp: number };
  days: string[]; // ISO dates practised, this game
  plays: { day: string; count: number };
  createdAt: string; updatedAt: string;
}
const defState = (tenantId: string, franchiseId: string | null, childId: string, gameId: GameId, now: string): AppliedStateDoc => ({
  tenantId, franchiseId, childId, gameId, level: 1, tags: {}, best: null, xp: { day: "", xp: 0 }, days: [], plays: { day: "", count: 0 }, createdAt: now, updatedAt: now,
});

export class GameError extends Error { constructor(public status: number, msg: string) { super(msg); } }
export const isGameId = (v: unknown): v is GameId => typeof v === "string" && (GAME_IDS as readonly string[]).includes(v);

export async function loadState(tenantId: string, childId: string, gameId: GameId): Promise<AppliedStateDoc | null> {
  const s = await appliedStateCol.doc(appliedStateId(tenantId, childId, gameId)).get();
  return s.exists ? { ...defState(tenantId, null, childId, gameId, ""), ...(s.data() as AppliedStateDoc) } : null;
}

export async function startAppliedSession(o: {
  tenantId: string; franchiseId: string | null; childId: string; parentUid: string; gameId: GameId; nowIso: string;
}) {
  const state0 = await loadState(o.tenantId, o.childId, o.gameId);
  const state = state0 ?? defState(o.tenantId, o.franchiseId, o.childId, o.gameId, o.nowIso);
  const day = o.nowIso.slice(0, 10);
  const today = state.plays.day === day ? state.plays.count : 0;
  const seed = (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
  const items = generateForm(o.gameId, seed, state.level);
  const ref = appliedSessionsCol.doc();
  await ref.set({
    tenantId: o.tenantId, franchiseId: o.franchiseId, childId: o.childId, parentUid: o.parentUid, gameId: o.gameId,
    seed, level: state.level, items, status: "started", startedAt: o.nowIso,
    expiresAt: new Date(new Date(o.nowIso).getTime() + SESSION_TTL_MS).toISOString(), createdBy: o.parentUid, createdAt: o.nowIso,
  });
  return {
    sessionId: ref.id, gameId: o.gameId, level: state.level, items: sanitize(items), itemsPerRun: ITEMS_PER_RUN,
    best: state.best, softCap: today >= DAILY_SOFT_CAP, todayCount: today, xpToday: state.xp.day === day ? state.xp.xp : 0,
    daysPractised: state.days.length,
  };
}

/** Re-mark and record a finished run. Idempotent: a second finish returns the stored result. */
export async function finishAppliedSession(o: { tenantId: string; childId: string; gameId: GameId; sessionId: string; answers?: unknown; nowIso: string }) {
  const ref = appliedSessionsCol.doc(o.sessionId);
  const first = await ref.get();
  if (!first.exists || first.get("tenantId") !== o.tenantId || first.get("childId") !== o.childId || first.get("gameId") !== o.gameId) throw new GameError(404, "Game not found");
  if (first.get("status") === "done") return { ...(first.get("result") as object), repeat: true };
  if (String(first.get("expiresAt")) < o.nowIso) throw new GameError(410, "This game has expired - start a new one");
  const items = first.get("items") as Item[];
  const answers = cleanAnswers(o.answers, items.map((i) => i.id));
  if (!answers) throw new GameError(400, "Send an answer for every question");
  const marked = markForm(items, answers);
  const franchiseId = (first.get("franchiseId") as string | null) ?? null;
  const level = first.get("level") as Level;

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.get("status") === "done") return { ...(snap.get("result") as object), repeat: true };
    const sRef = appliedStateCol.doc(appliedStateId(o.tenantId, o.childId, o.gameId));
    const sSnap = await tx.get(sRef);
    const state = sSnap.exists ? { ...defState(o.tenantId, franchiseId, o.childId, o.gameId, o.nowIso), ...(sSnap.data() as AppliedStateDoc) } : defState(o.tenantId, franchiseId, o.childId, o.gameId, o.nowIso);
    const day = o.nowIso.slice(0, 10);
    const tags = { ...state.tags };
    for (const r of marked.rows) { const e = tags[r.tag] ?? { attempts: 0, correct: 0 }; tags[r.tag] = { attempts: e.attempts + 1, correct: e.correct + (r.correct ? 1 : 0) }; }
    const isBest = !state.best || marked.score > state.best.score || (marked.score === state.best.score && marked.total < state.best.total);
    const firstCorrectToday = marked.rows.filter((r) => r.correct).length;
    const xpDay = state.xp.day === day ? state.xp.xp : 0;
    const xpGain = Math.min(POLICY_XP_CAP - xpDay, firstCorrectToday * 5);
    const next: AppliedStateDoc = {
      ...state, level: nextLevel(level, marked.score, marked.total),
      tags, best: isBest ? { score: marked.score, total: marked.total, at: o.nowIso } : state.best,
      xp: { day, xp: xpDay + Math.max(0, xpGain) },
      days: state.days.includes(day) ? state.days : [...state.days.slice(-89), day],
      plays: { day, count: (state.plays.day === day ? state.plays.count : 0) + 1 },
      updatedAt: o.nowIso,
    };
    tx.set(sRef, next);
    const result = {
      gameId: o.gameId, score: marked.score, total: marked.total, level, nextLevel: next.level,
      newBest: isBest, best: next.best, xpGained: Math.max(0, xpGain), xpToday: next.xp.xp,
      rows: marked.rows.map((r) => ({ id: r.id, tag: r.tag, correct: r.correct, given: r.given, answer: r.answer })),
    };
    tx.update(ref, {
      status: "done", finishedAt: o.nowIso,
      trials: marked.rows.map((r) => ({ itemId: r.id, tags: [r.tag], correct: r.correct ? 1 : 0, chosen: r.given, ms: r.ms, format: "typed" })),
      result,
    });
    return result;
  });
}
const POLICY_XP_CAP = 120;

// ─── Pause / resume (same pattern as hubGames.ts's checkpointSession/resumeSession/resumableSession for Penguin/
// Turbo Slide): nothing new is trusted — a checkpoint is just the answers-so-far against the exact items the
// server already issued at start; resuming hands that server-held progress back, and finish() re-marks the FULL
// stored item set regardless of how many were answered before a pause, so a resumed run is exactly as trustworthy
// as one played start-to-finish in one sitting. ─────────────────────────────────────────────────────────────────
export interface AppliedResumableInfo { sessionId: string; gameId: GameId; savedAt: string }
export async function resumableAppliedSession(tenantId: string, childId: string, gameId: GameId): Promise<AppliedResumableInfo | null> {
  const nowIso = new Date().toISOString();
  const [started, paused] = await Promise.all(["started", "paused"].map((status) =>
    appliedSessionsCol.where("tenantId", "==", tenantId).where("childId", "==", childId).where("gameId", "==", gameId).where("status", "==", status).get()));
  const rows = [...started.docs, ...paused.docs].filter((d) => String(d.get("expiresAt")) >= nowIso).sort((a, b) => String(b.get("startedAt")).localeCompare(String(a.get("startedAt"))));
  const d = rows[0];
  if (!d) return null;
  const cp = d.get("checkpoint") as { savedAt?: string } | undefined;
  return { sessionId: d.id, gameId, savedAt: cp?.savedAt ?? (d.get("startedAt") as string) };
}

/** "Back to Games" mid-run: save the answers given so far. Re-validated the same way `finishAppliedSession` marks
 *  (cleanAnswers against the stored items) before it is ever trusted as a resume point. */
export async function checkpointAppliedSession(o: { tenantId: string; childId: string; gameId: GameId; sessionId: string; answers?: unknown; nowIso: string }): Promise<{ sessionId: string; saved: boolean }> {
  const ref = appliedSessionsCol.doc(o.sessionId);
  const snap = await ref.get();
  if (!snap.exists || snap.get("tenantId") !== o.tenantId || snap.get("childId") !== o.childId || snap.get("gameId") !== o.gameId) throw new GameError(404, "Game not found");
  if (snap.get("status") === "done") return { sessionId: o.sessionId, saved: false };
  if (String(snap.get("expiresAt")) < o.nowIso) return { sessionId: o.sessionId, saved: false };
  const items = snap.get("items") as Item[];
  const partial = Array.isArray(o.answers) ? o.answers : [];
  // A checkpoint may hold FEWER than every item (mid-run); accept any subset whose ids are real and well-formed.
  const ids = new Set(items.map((i) => i.id));
  for (const a of partial) {
    if (!a || typeof a !== "object") throw new GameError(400, "Bad checkpoint");
    const id = (a as { id?: unknown }).id;
    if (typeof id !== "string" || !ids.has(id)) throw new GameError(400, "Bad checkpoint");
  }
  await ref.update({ checkpoint: { answers: partial, savedAt: o.nowIso }, status: "paused" });
  return { sessionId: o.sessionId, saved: true };
}

/** Fetch ONE specific abandoned-but-resumable session and hand back everything a fresh `startAppliedSession` would,
 *  plus the server-held checkpoint (answers so far) to resume from — never a client-supplied position. */
export async function resumeAppliedSession(o: { tenantId: string; childId: string; gameId: GameId; sessionId: string; nowIso: string }) {
  const ref = appliedSessionsCol.doc(o.sessionId);
  const snap = await ref.get();
  if (!snap.exists || snap.get("tenantId") !== o.tenantId || snap.get("childId") !== o.childId || snap.get("gameId") !== o.gameId) throw new GameError(404, "Game not found");
  if (snap.get("status") === "done") throw new GameError(410, "This game is already finished");
  if (String(snap.get("expiresAt")) < o.nowIso) throw new GameError(410, "This game has expired - start a new one");
  const checkpoint = snap.get("checkpoint") as { answers: { id: string; value: number | string | null; ms: number }[] } | undefined;
  if (!checkpoint) throw new GameError(404, "Nothing to resume - start a new one");
  const items = snap.get("items") as Item[];
  const franchiseId = (snap.get("franchiseId") as string | null) ?? null;
  const level = snap.get("level") as Level;
  const state = await loadState(o.tenantId, o.childId, o.gameId);
  const day = o.nowIso.slice(0, 10);
  const today = state?.plays.day === day ? state.plays.count : 0;
  return {
    sessionId: snap.id, gameId: o.gameId, level, items: sanitize(items), itemsPerRun: ITEMS_PER_RUN, checkpoint,
    best: state?.best ?? null, softCap: today >= DAILY_SOFT_CAP, todayCount: today, xpToday: state?.xp.day === day ? state.xp.xp : 0,
    daysPractised: state?.days.length ?? 0, franchiseId,
  };
}

/** Family / tutor read of a child's applied-maths progress for one game (feeds GamesSummaryCard's shared pattern). */
export async function appliedOverview(tenantId: string, childId: string, gameId: GameId, nowIso = new Date().toISOString()) {
  const state = await loadState(tenantId, childId, gameId);
  const day = nowIso.slice(0, 10);
  const tags = state?.tags ?? {};
  const rows = Object.entries(tags).map(([tag, s]) => ({ tag, attempts: s.attempts, correct: s.correct, rate: s.attempts ? Math.round((s.correct / s.attempts) * 100) / 100 : null }))
    .sort((a, b) => (a.rate ?? 1) - (b.rate ?? 1));
  const totalAttempts = rows.reduce((a, r) => a + r.attempts, 0), totalCorrect = rows.reduce((a, r) => a + r.correct, 0);
  return {
    gameId, level: state?.level ?? 1, best: state?.best ?? null, tags: rows,
    weak: rows.filter((r) => r.rate !== null && r.rate < 0.6).slice(0, 6),
    totals: { attempts: totalAttempts, correct: totalCorrect, accuracy: totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) / 100 : null, daysPractised: state?.days.length ?? 0 },
    xpToday: state?.xp.day === day ? state.xp.xp : 0,
    mastery: { source: "game", weight: 0.15, note: "game evidence is low weight; a tutor check confirms" },
  };
}
