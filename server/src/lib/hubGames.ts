import { db } from "../firebase";
import { applyToFact, classifyError, cleanLog, cleanPlan, DEFAULT_RT0_MS, eloTheta, fluentMs, freshFact, MAX_TICKS, makeCfg, parseKey, pCorrect, POLICY, replay, retrievability, selectPlan, slowMs, speedBand, strategyFor, summarise, THETA0, TICK_HZ, type Cfg, type FactState, type InputLog, type Plan } from "../../../features/learninghub/games/penguin/core";
import { buildRun } from "../../../features/learninghub/games/penguin/run";
import { journeyView, unlocksFor } from "../../../features/learninghub/games/penguin/journey";
import { modifierOfDay } from "../../../features/learninghub/games/penguin/config";
import { cleanMtcAnswers, makeMtcForm, markMtc, MTC, type MtcItem } from "../../../features/learninghub/games/penguin/mtc";
import { fluentCount, lightFact, newProfileLite, recordMtc, recordRun, weekDaysOf, weekStart, DAILY_SOFT_CAP, type ProfileLite } from "../../../features/learninghub/games/penguin/record";

// Learning Hub GAMES (docs/games-research/03-concepts.md, spec #1 Penguin Slide; docs/games-prototypes/BACKEND-PATTERN.md
// for the checklist this file follows). Three collections, all keyed by childId (privacy: hubPrivacy.ts):
//   hubGameSessions  one doc per run: the seed + config + plan the server issued, and (once finished) the RE-SIMULATED result. `kind` "slide" | "mtc". `skin` "penguin" | "turbo" - which game asked for it (reporting only).
//   hubFactState     one doc per (child, fact): FSRS-lite stability, Elo difficulty, thaw state, typical speed, the wrong answers they actually gave. SHARED by Penguin Slide and Turbo Slide - one true fact-mastery map per child.
//   hubGameProfile   one doc per child: tutor-pinned tables, personal bests (+ the pace of the best run), Elo ability, baseline speed rt0, today's points, days practised. Also shared across skins.
// The browser never sends a score. It sends the input log (or, for MTC practice, the typed answers); the server re-plays / re-marks and computes everything.
// Turbo Slide (features/learninghub/games/turbo/) reuses this exact simulation and these exact collections under a
// highway theme rather than forking a second, parallel implementation - see the file header of games/turbo/core.ts.

export const sessionsCol = db.collection("hubGameSessions");
export const factsCol = db.collection("hubFactState");
export const profileCol = db.collection("hubGameProfile");
export const GAME_ID = "penguin-slide";

export const factDocId = (tenantId: string, childId: string, key: string) => `${tenantId}__${childId}__${key}`;
export const profileId = (tenantId: string, childId: string) => `${tenantId}__${childId}`;
const SESSION_TTL_MS = 48 * 3600_000;

export interface ProfileDoc extends ProfileLite {
  tenantId: string; franchiseId: string | null; childId: string; createdAt: string; updatedAt: string;
}
const defProfile = (tenantId: string, franchiseId: string | null, childId: string, now: string): ProfileDoc => ({ ...newProfileLite(), tenantId, franchiseId, childId, createdAt: now, updatedAt: now });

const strip = (d: FirebaseFirestore.DocumentData): FactState => {
  const p = parseKey(d.key) ?? { op: d.op, a: d.a, b: d.b };
  const base = freshFact(d.key)!;
  return {
    ...base, S: d.S ?? base.S, D: d.D ?? base.D, elo: d.elo ?? base.elo, lastSeen: d.lastSeen ?? null, nextDueAt: d.nextDueAt ?? null, recentMs: d.recentMs ?? [], medianLatencyMs: d.medianLatencyMs ?? 0,
    attempts: d.attempts ?? 0, correct: d.correct ?? 0, hist: d.hist ?? "", correctDays: d.correctDays ?? [], retainedAt: d.retainedAt ?? null, thaw: d.thaw ?? 0, errTypes: d.errTypes ?? {}, wrongAnswers: d.wrongAnswers ?? {}, updatedAt: d.updatedAt ?? "",
    op: p.op, a: p.a, b: p.b,
  };
};

export async function loadFacts(tenantId: string, childId: string): Promise<Map<string, FactState>> {
  const snap = await factsCol.where("tenantId", "==", tenantId).where("childId", "==", childId).get();
  const m = new Map<string, FactState>();
  for (const d of snap.docs) { if (!parseKey(d.get("key"))) continue; const f = strip(d.data()); m.set(f.key, f); }
  return m;
}
export async function loadProfile(tenantId: string, childId: string): Promise<ProfileDoc | null> {
  const s = await profileCol.doc(profileId(tenantId, childId)).get();
  return s.exists ? { ...defProfile(tenantId, null, childId, ""), ...(s.data() as ProfileDoc) } : null;
}


export interface StartInput { mode?: unknown; stageId?: unknown; loadout?: unknown; tables?: unknown; lanes?: unknown; forms?: unknown; calm?: unknown; timer?: unknown; skin?: unknown }
/** Which game asked for this run. Turbo Slide (features/learninghub/games/turbo/) is a highway reskin of the exact
 *  same deterministic simulation as Penguin Slide - same fact selection, same lane physics, same replay - so it
 *  shares hubFactState/hubGameProfile with it rather than forking a second set of collections. `skin` is stored on
 *  the session purely for reporting (which game a run was played in); it never changes scoring. */
export type Skin = "penguin" | "turbo";
const skinOf = (v: unknown): Skin => (v === "turbo" ? "turbo" : "penguin");
type Support = { calm: boolean; noTimer: boolean; readAloudDefault: boolean; textSize: string };

/** What the server hands out at the start of a run: config (calm forced by the child's support profile), plan, best-so-far to race. */
export async function startSession(o: { tenantId: string; franchiseId: string | null; childId: string; parentUid: string; support: Support; age: number | null; body: StartInput; nowIso: string }) {
  const [facts, profile0] = await Promise.all([loadFacts(o.tenantId, o.childId), loadProfile(o.tenantId, o.childId)]);
  const profile = profile0 ?? defProfile(o.tenantId, o.franchiseId, o.childId, o.nowIso);
  const randomSeed = (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
  const built = buildRun({ body: o.body, facts, profile, support: o.support, age: o.age, nowIso: o.nowIso, seed: randomSeed, firstEver: facts.size === 0 && !profile0 });
  if (!built.ok) throw new GameError(built.status, built.error);
  const { cfg, plan, key } = built;
  const seed = built.seed ?? randomSeed; // the Arcade daily challenge fixes the seed for the day; every other run is random
  const skin = skinOf(o.body.skin);
  const rolling = profile.roll.length >= 10 ? profile.roll.reduce((a, b) => a + b, 0) / profile.roll.length : null;
  const ref = sessionsCol.doc();
  const day = o.nowIso.slice(0, 10);
  const today = profile.plays.day === day ? profile.plays.count : 0;
  await ref.set({
    tenantId: o.tenantId, franchiseId: o.franchiseId, childId: o.childId, parentUid: o.parentUid, gameId: GAME_ID, kind: "slide", skin, seed, cfg, plan, key, status: "started",
    startedAt: o.nowIso, expiresAt: new Date(new Date(o.nowIso).getTime() + SESSION_TTL_MS).toISOString(),
    settings: { tables: cfg.tables, lanes: cfg.lanes, calm: cfg.calm, pinned: cfg.pinned, timer: cfg.approachSec > 0 ? "soft" : "none", target: cfg.target, thetaAtStart: profile.theta, rollingAtStart: rolling, stage: cfg.stage, biome: cfg.biome, loadout: cfg.loadout, mod: cfg.mod },
    createdBy: o.parentUid, createdAt: o.nowIso,
  });
  const best = profile.bests?.[key] ?? null;
  return {
    sessionId: ref.id, seed, cfg, plan, skin, best: best ? { fish: best.fish, correct: best.correct, pace: best.pace } : null, tickHz: TICK_HZ, softCap: today >= DAILY_SOFT_CAP, todayCount: today,
    pinned: cfg.pinned, facts: [...facts.values()].map(lightFact), fluentFacts: fluentCount(facts.values()), weekDays: weekDaysOf(profile.days, o.nowIso), weekGoal: POLICY.weekGoalDays,
    xpToday: profile.xp.day === day ? profile.xp.xp : 0, xpCap: POLICY.xpDailyCap, mtcThisWeek: profile.mtcAt.filter((d) => d >= weekStart(o.nowIso)).length,
    ...journeyInfo(profile, facts, o.nowIso),
  };
}

/** The journey as the map screen needs it: stars per stage, what is unlocked, today's Challenge of the Day. */
export function journeyInfo(profile: ProfileLite, facts: ReadonlyMap<string, FactState>, nowIso: string) {
  const v = journeyView(profile.journey, profile.unlockAll);
  return { journey: { stars: profile.journey, unlockAll: profile.unlockAll, totalStars: v.totalStars, maxStars: v.maxStars, bosses: v.bossesCleared }, unlocks: unlocksFor(profile.journey, facts.values(), profile.unlockAll), daily: { modifier: modifierOfDay(nowIso.slice(0, 10)) }, arcade: profile.arcade ?? {}, fishTotal: profile.fishTotal ?? 0 };
}
export async function journeyOverview(tenantId: string, childId: string, nowIso: string) {
  const [facts, profile0] = await Promise.all([loadFacts(tenantId, childId), loadProfile(tenantId, childId)]);
  const profile = profile0 ?? defProfile(tenantId, null, childId, nowIso);
  const day = nowIso.slice(0, 10);
  return { facts: [...facts.values()].map(lightFact), fluentFacts: fluentCount(facts.values()), weekDays: weekDaysOf(profile.days, nowIso), weekGoal: POLICY.weekGoalDays, xpToday: profile.xp.day === day ? profile.xp.xp : 0, xpCap: POLICY.xpDailyCap, mtcThisWeek: profile.mtcAt.filter((d) => d >= weekStart(nowIso)).length, ...journeyInfo(profile, facts, nowIso) };
}
export async function setUnlockAll(tenantId: string, franchiseId: string | null, childId: string, all: boolean, by: string, nowIso: string) {
  const ref = profileCol.doc(profileId(tenantId, childId)); const s = await ref.get();
  if (s.exists) await ref.update({ unlockAll: all, updatedAt: nowIso }); else await ref.set({ ...defProfile(tenantId, franchiseId, childId, nowIso), unlockAll: all, createdBy: by });
}

export { lightFact };
export class GameError extends Error { constructor(public status: number, msg: string) { super(msg); } }

/** Start an "MTC practice": a form of 25 that mimics the official Year 4 check. The 3 try-it-out questions are made (and thrown away) client-side. */
export async function startMtc(o: { tenantId: string; franchiseId: string | null; childId: string; parentUid: string; nowIso: string; skin?: unknown }) {
  const profile = (await loadProfile(o.tenantId, o.childId)) ?? defProfile(o.tenantId, o.franchiseId, o.childId, o.nowIso);
  const seed = (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
  const form = makeMtcForm(seed, profile.lastMtc);
  const ref = sessionsCol.doc();
  await ref.set({ tenantId: o.tenantId, franchiseId: o.franchiseId, childId: o.childId, parentUid: o.parentUid, gameId: GAME_ID, kind: "mtc", skin: skinOf(o.skin), seed, form, status: "started", startedAt: o.nowIso, expiresAt: new Date(new Date(o.nowIso).getTime() + SESSION_TTL_MS).toISOString(), createdBy: o.parentUid, createdAt: o.nowIso });
  return { sessionId: ref.id, seed, form, limits: { n: MTC.n, answerMs: MTC.answerMs, pauseMs: MTC.pauseMs, practice: MTC.practice }, mtcThisWeek: profile.mtcAt.filter((d) => d >= weekStart(o.nowIso)).length };
}

/** Re-simulate and record a finished (or ended-early) run. Idempotent: a second finish returns the stored result. */
export async function finishSession(o: { tenantId: string; childId: string; sessionId: string; log?: unknown; endTick?: unknown; answers?: unknown; nowIso: string }) {
  const ref = sessionsCol.doc(o.sessionId);
  const first = await ref.get();
  if (!first.exists || first.get("tenantId") !== o.tenantId || first.get("childId") !== o.childId) throw new GameError(404, "Game not found");
  if (first.get("status") === "done") return { ...(first.get("result") as object), repeat: true };
  if (String(first.get("expiresAt")) < o.nowIso) throw new GameError(410, "This game has expired - start a new one");
  if (first.get("kind") === "mtc") return finishMtc(ref, first, o);
  const log = cleanLog(o.log);
  if (!log) throw new GameError(400, "Bad input log");
  const endTick = Number(o.endTick);
  if (!Number.isInteger(endTick) || endTick < 0 || endTick > MAX_TICKS || (log.length && log[log.length - 1]![0] > endTick)) throw new GameError(400, "Bad endTick");
  const plan = cleanPlan(first.get("plan")) as Plan;
  const cfg = first.get("cfg") as Cfg;
  const seed = Number(first.get("seed"));
  const sim = replay(seed, cfg, plan, log, endTick);
  const sum = summarise(sim);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.get("status") === "done") return { ...(snap.get("result") as object), repeat: true };
    const keys = [...new Set(sum.results.filter((r) => !r.miss && !r.guess).map((r) => r.k))];
    const pRef = profileCol.doc(profileId(o.tenantId, o.childId));
    const fRefs = keys.map((k) => factsCol.doc(factDocId(o.tenantId, o.childId, k)));
    const [pSnap, ...fSnaps] = await Promise.all([tx.get(pRef), ...fRefs.map((r) => tx.get(r))]);
    const franchiseId = (snap.get("franchiseId") as string | null) ?? null;
    const prof = pSnap.exists ? { ...defProfile(o.tenantId, franchiseId, o.childId, o.nowIso), ...(pSnap.data() as ProfileDoc) } : defProfile(o.tenantId, franchiseId, o.childId, o.nowIso);
    const facts = new Map<string, FactState>(); keys.forEach((k, i) => { if (fSnaps[i]!.exists) facts.set(k, strip(fSnaps[i]!.data()!)); });
    const rec = recordRun(cfg, sum, facts, prof, o.nowIso);
    keys.forEach((k, i) => tx.set(fRefs[i]!, { tenantId: o.tenantId, franchiseId, childId: o.childId, ...rec.facts.get(k)!, createdBy: "system", createdAt: fSnaps[i]!.exists ? fSnaps[i]!.get("createdAt") : o.nowIso }));
    tx.set(pRef, { ...prof, ...rec.profile, updatedAt: o.nowIso });
    const result = rec.result;
    tx.update(ref, {
      status: "done", finishedAt: o.nowIso, endTick, logEntries: log.length,
      summary: { done: sum.done, answered: sum.answered, correct: sum.correct, timeouts: sum.timeouts, fish: sum.fish, bestStreak: sum.bestStreak, ticks: sum.ticks, activeTicks: sum.activeTicks, guessed: sum.guessed },
      // one row per answered gate: the privacy-safe trial event schema of docs C 6.1 (itemId, skill tags, error type, response time, retest index, late-commit flag)
      trials: sum.results.slice(0, 80).map((r) => ({ itemId: `mul:${r.k.slice(2)}`, op: r.op, tags: [`table:${r.a}`, `table:${r.b}`], correct: r.correct ? 1 : 0, miss: r.miss ? 1 : 0, guess: r.guess ? 1 : 0, err: r.err, chosen: r.chosen, ms: Math.round((r.latencyTicks * 1000) / TICK_HZ), attempt: r.requeue ? 2 : 1, late: r.late ? 1 : 0, boss: r.boss ? 1 : 0, format: "lane" })),
      result,
    });
    return result;
  });
}

async function finishMtc(ref: FirebaseFirestore.DocumentReference, first: FirebaseFirestore.DocumentSnapshot, o: { tenantId: string; childId: string; answers?: unknown; nowIso: string }) {
  const answers = cleanMtcAnswers(o.answers);
  if (!answers) throw new GameError(400, "Send 25 answers");
  const form = first.get("form") as MtcItem[];
  const res = markMtc(form, answers);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.get("status") === "done") return { ...(snap.get("result") as object), repeat: true };
    const keys = [...new Set(form.map((i) => `x_${Math.min(i.a, i.b)}x${Math.max(i.a, i.b)}`))];
    const pRef = profileCol.doc(profileId(o.tenantId, o.childId));
    const fRefs = keys.map((k) => factsCol.doc(factDocId(o.tenantId, o.childId, k)));
    const [pSnap, ...fSnaps] = await Promise.all([tx.get(pRef), ...fRefs.map((r) => tx.get(r))]);
    const franchiseId = (snap.get("franchiseId") as string | null) ?? null;
    const prof = pSnap.exists ? { ...defProfile(o.tenantId, franchiseId, o.childId, o.nowIso), ...(pSnap.data() as ProfileDoc) } : defProfile(o.tenantId, franchiseId, o.childId, o.nowIso);
    const facts = new Map<string, FactState>(); keys.forEach((k, i) => { if (fSnaps[i]!.exists) facts.set(k, strip(fSnaps[i]!.data()!)); });
    const rec = recordMtc(form, answers, facts, prof, o.nowIso);
    keys.forEach((k, i) => tx.set(fRefs[i]!, { tenantId: o.tenantId, franchiseId, childId: o.childId, ...rec.facts.get(k)!, createdBy: "system", createdAt: fSnaps[i]!.exists ? fSnaps[i]!.get("createdAt") : o.nowIso }));
    tx.set(pRef, { ...prof, ...rec.profile, updatedAt: o.nowIso });
    const res = rec.res;
    tx.update(ref, { status: "done", finishedAt: o.nowIso, summary: { answered: res.total, correct: res.score, ticks: 0, activeTicks: 0 }, trials: res.rows.map((r) => ({ itemId: `mul:${Math.min(r.a, r.b)}x${Math.max(r.a, r.b)}`, correct: r.ok ? 1 : 0, timeout: r.kind === "timeout" ? 1 : 0, err: r.kind === "wrong" ? classifyError("x", Math.min(r.a, r.b), Math.max(r.a, r.b), r.entered!) : null, chosen: r.entered, ms: r.ms, format: "typed" })), result: rec.result });
    return rec.result;
  });
}

// ─── Pause / resume (mid-run only, kind "slide" - Penguin Slide and Turbo Slide; MTC practice is a short typed
// form and isn't covered) ────────────────────────────────────────────────────────────────────────────────────────
// Nothing new is trusted here: a checkpoint is just the same (seed, cfg, plan) the server already issued at start,
// plus a log the server re-verifies by REPLAYING IT before it is ever stored (the same `replay()` finish() uses).
// Resuming hands that exact, server-held log back to the client; finishing a resumed run still replays the WHOLE
// log from tick 0, so a resumed run is exactly as trustworthy as one played start-to-finish in one sitting.

// Firestore refuses to store an array nested directly inside another array (`InputLog` is `[number, number][]`), so
// a checkpoint's log is packed as one row per entry ({t, p}) - the values are unchanged, only the shape is Firestore-safe.
const packLog = (log: InputLog): { t: number; p: number }[] => log.map(([t, p]) => ({ t, p }));
const unpackLog = (rows: unknown): InputLog | null => (Array.isArray(rows) && rows.every((r) => r && typeof r === "object" && Number.isInteger((r as { t?: unknown }).t) && Number.isInteger((r as { p?: unknown }).p)) ? (rows as { t: number; p: number }[]).map((r) => [r.t, r.p]) : null);

export interface ResumableInfo { sessionId: string; skin: Skin; savedAt: string }
/** Is there a "slide" run this child left mid-way, not yet finished and not yet expired? Only `status: "paused"`
 *  counts - that status is set EXCLUSIVELY by `checkpointSession` below, so a session that is merely `"started"`
 *  (in progress right now, or abandoned without ever calling checkpoint - a killed tab can't run JS to save) is
 *  correctly NOT resumable: it has no saved checkpoint to continue from, so it must fall back to "Play" honestly,
 *  never a false "Continue". */
export async function resumableSession(tenantId: string, childId: string, skin: Skin): Promise<ResumableInfo | null> {
  const nowIso = new Date().toISOString();
  const snap = await sessionsCol.where("tenantId", "==", tenantId).where("childId", "==", childId).where("kind", "==", "slide").where("status", "==", "paused").get();
  const rows = snap.docs.filter((d) => d.get("skin") === skin && !!d.get("checkpoint") && String(d.get("expiresAt")) >= nowIso).sort((a, b) => String(b.get("startedAt")).localeCompare(String(a.get("startedAt"))));
  const d = rows[0];
  if (!d) return null;
  const cp = d.get("checkpoint") as { savedAt?: string } | undefined;
  return { sessionId: d.id, skin, savedAt: cp?.savedAt ?? (d.get("startedAt") as string) };
}

/** "Back to Games" mid-run: save exactly where the child got to (log + tick), server-verified by replaying it, so
 *  a later resume can only ever continue from a state the server itself produced - never one the client asserts. */
export async function checkpointSession(o: { tenantId: string; childId: string; sessionId: string; log?: unknown; endTick?: unknown; nowIso: string }): Promise<{ sessionId: string; saved: boolean }> {
  const ref = sessionsCol.doc(o.sessionId);
  const snap = await ref.get();
  if (!snap.exists || snap.get("tenantId") !== o.tenantId || snap.get("childId") !== o.childId) throw new GameError(404, "Game not found");
  if (snap.get("kind") !== "slide") throw new GameError(400, "This game can't be paused");
  if (snap.get("status") === "done") return { sessionId: o.sessionId, saved: false }; // already finished - nothing to checkpoint, not an error (a stray double-exit)
  if (String(snap.get("expiresAt")) < o.nowIso) return { sessionId: o.sessionId, saved: false };
  const log = cleanLog(o.log);
  if (!log) throw new GameError(400, "Bad input log");
  const endTick = Number(o.endTick);
  if (!Number.isInteger(endTick) || endTick < 0 || endTick > MAX_TICKS || (log.length && log[log.length - 1]![0] > endTick)) throw new GameError(400, "Bad endTick");
  const plan = cleanPlan(snap.get("plan")) as Plan;
  const cfg = snap.get("cfg") as Cfg;
  const seed = Number(snap.get("seed"));
  replay(seed, cfg, plan, log, endTick); // re-verify it actually replays cleanly before it is ever trusted as a resume point
  await ref.update({ checkpoint: { log: packLog(log), endTick, savedAt: o.nowIso }, status: "paused" });
  return { sessionId: o.sessionId, saved: true };
}

/** Fetch ONE specific abandoned-but-resumable session and hand back everything a fresh `startSession` would, plus
 *  the server-held checkpoint to resume from - never a client-supplied position. */
export async function resumeSession(o: { tenantId: string; childId: string; sessionId: string; nowIso: string }) {
  const ref = sessionsCol.doc(o.sessionId);
  const snap = await ref.get();
  if (!snap.exists || snap.get("tenantId") !== o.tenantId || snap.get("childId") !== o.childId) throw new GameError(404, "Game not found");
  if (snap.get("kind") !== "slide") throw new GameError(400, "This game can't be resumed");
  if (snap.get("status") === "done") throw new GameError(410, "This game is already finished");
  if (String(snap.get("expiresAt")) < o.nowIso) throw new GameError(410, "This game has expired - start a new one");
  const stored = snap.get("checkpoint") as { log: unknown; endTick: number } | undefined;
  const log = stored && unpackLog(stored.log);
  if (!stored || !log) throw new GameError(404, "Nothing to resume - start a new one");
  const checkpoint = { log, endTick: stored.endTick };
  const franchiseId = (snap.get("franchiseId") as string | null) ?? null;
  const [facts, profile0] = await Promise.all([loadFacts(o.tenantId, o.childId), loadProfile(o.tenantId, o.childId)]);
  const profile = profile0 ?? defProfile(o.tenantId, franchiseId, o.childId, o.nowIso);
  const cfg = snap.get("cfg") as Cfg;
  const plan = cleanPlan(snap.get("plan")) as Plan;
  const seed = Number(snap.get("seed"));
  const key = snap.get("key") as string;
  const best = profile.bests?.[key] ?? null;
  const day = o.nowIso.slice(0, 10);
  const today = profile.plays.day === day ? profile.plays.count : 0;
  return {
    sessionId: snap.id, seed, cfg, plan, skin: snap.get("skin") as Skin, checkpoint,
    best: best ? { fish: best.fish, correct: best.correct, pace: best.pace } : null, tickHz: TICK_HZ, softCap: today >= DAILY_SOFT_CAP, todayCount: today,
    pinned: cfg.pinned, facts: [...facts.values()].map(lightFact), fluentFacts: fluentCount(facts.values()), weekDays: weekDaysOf(profile.days, o.nowIso), weekGoal: POLICY.weekGoalDays,
    xpToday: profile.xp.day === day ? profile.xp.xp : 0, xpCap: POLICY.xpDailyCap, mtcThisWeek: profile.mtcAt.filter((d) => d >= weekStart(o.nowIso)).length,
    ...journeyInfo(profile, facts, o.nowIso),
  };
}

/** Tutor / family read of a child's fact strengths. Tutor extras (docs C 6.2): heat map, response-time profile, misconceptions, retention, practice quality, effort flags, productive vs total time. */
export async function factsOverview(tenantId: string, childId: string, nowIso = new Date().toISOString()) {
  const [facts, profile, sess] = await Promise.all([loadFacts(tenantId, childId), loadProfile(tenantId, childId), sessionsCol.where("tenantId", "==", tenantId).where("childId", "==", childId).where("status", "==", "done").get()]);
  const rt0 = profile?.rt0Ms ?? DEFAULT_RT0_MS;
  const rows = [...facts.values()].map((f) => {
    const wrong = Object.entries(f.wrongAnswers).sort((p, q) => q[1] - p[1])[0];
    const topErr = Object.entries(f.errTypes).sort((p, q) => q[1] - p[1])[0];
    return { key: f.key, op: f.op, a: f.a, b: f.b, thaw: f.thaw, attempts: f.attempts, correct: f.correct, medianMs: f.medianLatencyMs, band: f.medianLatencyMs ? speedBand(f.medianLatencyMs, rt0) : null, oftenAnswers: wrong ? Number(wrong[0]) : null, errType: topErr ? topErr[0] : null, recall: Math.round(retrievability(f, nowIso) * 100) / 100, nextDueAt: f.nextDueAt, pNow: Math.round(pCorrect(profile?.theta ?? THETA0, f.elo) * 100) / 100 };
  }).sort((p, q) => p.thaw - q.thaw || q.attempts - p.attempts);
  const docs = sess.docs.filter((d) => d.get("kind") !== "mtc");
  const runs = docs.map((d) => ({ at: d.get("finishedAt") as string, mode: (d.get("cfg") as Cfg).mode, answered: d.get("summary.answered") as number, correct: d.get("summary.correct") as number, fish: d.get("summary.fish") as number, productiveSeconds: Math.round(((d.get("summary.activeTicks") as number) ?? 0) / TICK_HZ), totalSeconds: Math.round(((d.get("summary.ticks") as number) ?? 0) / TICK_HZ) })).sort((p, q) => q.at.localeCompare(p.at));
  const mtcRuns = sess.docs.filter((d) => d.get("kind") === "mtc").map((d) => ({ at: d.get("finishedAt") as string, score: d.get("result.score") as number, total: d.get("result.total") as number, timedOut: (d.get("trials") as { timeout?: number }[]).filter((t) => t.timeout).length })).sort((p, q) => q.at.localeCompare(p.at)).slice(0, 6);
  // heat map: first factor x second factor, 2..12 (symmetric; one state per unordered fact)
  const heat: Record<string, { thaw: number; recall: number }> = {};
  for (const r of rows) if (r.op === "x") heat[r.key.slice(2)] = { thaw: r.thaw, recall: r.recall };
  // response-time profile: median by table, retrieval (<3s) / reconstructed (3-6s) / calculated (>6s) split
  const byTable: Record<number, number[]> = {};
  for (const r of rows) if (r.medianMs) for (const t of new Set([r.a, r.b])) (byTable[t] ??= []).push(r.medianMs);
  const med = (xs: number[]) => { const s = [...xs].sort((p, q) => p - q); return s.length ? s[s.length >> 1]! : 0; };
  const rtProfile = { rt0Ms: rt0, byTable: Object.fromEntries(Object.entries(byTable).map(([t, xs]) => [t, med(xs)])), retrieval: rows.filter((r) => r.medianMs && r.medianMs < 3000).length, reconstructed: rows.filter((r) => r.medianMs >= 3000 && r.medianMs <= 6000).length, calculated: rows.filter((r) => r.medianMs > 6000).length };
  // misconceptions: error-type mix (only flagged at >= 3 events) and the numbers actually given
  const mix: Record<string, number> = {}; const confusions: { fact: string; answered: number; times: number }[] = [];
  for (const f of facts.values()) { for (const [k, n] of Object.entries(f.errTypes)) mix[k] = (mix[k] ?? 0) + n; for (const [k, n] of Object.entries(f.wrongAnswers)) confusions.push({ fact: f.key.slice(2), answered: Number(k), times: n }); }
  const misconceptions = { mix, flags: Object.entries(mix).filter(([, n]) => n >= 3).map(([k]) => k), topConfusions: confusions.sort((p, q) => q.times - p.times).slice(0, 8) };
  const days = profile?.days ?? []; const cutoff = new Date(new Date(nowIso).getTime() - 14 * 86_400_000).toISOString().slice(0, 10);
  const totalAns = runs.reduce((a, r) => a + r.answered, 0), totalCor = runs.reduce((a, r) => a + r.correct, 0);
  const practice = {
    spacedDaysLast14: days.filter((d) => d >= cutoff).length, sessions: runs.length, trials: totalAns, accuracy: totalAns ? Math.round((totalCor / totalAns) * 100) / 100 : null,
    inBandRuns: runs.filter((r) => r.answered && r.correct / r.answered >= 0.8 && r.correct / r.answered <= 0.9).length, targetBand: [0.8, 0.9],
    productiveSeconds: runs.reduce((a, r) => a + r.productiveSeconds, 0), totalSeconds: runs.reduce((a, r) => a + r.totalSeconds, 0),
  };
  const effort = { rapidGuessRuns: docs.filter((d) => (d.get("summary.guessed") as number) > 0).length, timeouts: docs.reduce((a, d) => a + ((d.get("summary.timeouts") as number) ?? 0), 0), note: "engagement notes, not judgements" };
  return {
    childId, facts: rows, slowButCorrect: rows.filter((r) => r.correct > 0 && r.band === "slow" && r.thaw >= 1).slice(0, 12), wrong: rows.filter((r) => r.thaw === 1 && r.errType).slice(0, 12),
    pinned: profile?.pinned ?? [], bests: profile?.bests ? Object.fromEntries(Object.entries(profile.bests).map(([k, v]) => [k, { fish: v!.fish, correct: v!.correct, answered: v!.answered, at: v!.at }])) : {}, runs: runs.slice(0, 12), mtc: mtcRuns,
    totals: { facts: rows.length, secure: rows.filter((r) => r.thaw >= 3).length, gold: rows.filter((r) => r.thaw === 4).length, fluent: rows.filter((r) => r.thaw >= 3).length },
    heat, rtProfile, misconceptions, practice, effort, weekDays: weekDaysOf(days, nowIso), weekGoal: POLICY.weekGoalDays, ability: profile?.theta ?? THETA0, targetRate: [0.8, 0.9],
    mastery: { source: "game", weight: 0.15, note: "game evidence is low weight; a tutor check confirms" },
  };
}

export async function setPinned(tenantId: string, franchiseId: string | null, childId: string, tables: number[], by: string, nowIso: string) {
  const ref = profileCol.doc(profileId(tenantId, childId));
  const s = await ref.get();
  if (s.exists) await ref.update({ pinned: tables, updatedAt: nowIso });
  else await ref.set({ ...defProfile(tenantId, franchiseId, childId, nowIso), pinned: tables, createdBy: by });
}
