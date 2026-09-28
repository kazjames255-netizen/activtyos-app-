"use client";
// Where a run's data goes. Two backends behind ONE interface:
//   liveBackend  - the server (POST /api/learning-hub/games/sessions ...). It issues the seed + plan and re-simulates the input log itself.
//   demoBackend  - no account: the same pure core runs in the browser and the child's ice map lives in localStorage on this device. Clearly a demo.
// Both use the same pure functions (selectPlan / replay / recordRun), so the demo plays exactly like the real thing.
import { get, post } from "@/lib/api";
import { cleanPlan, replay, summarise, TICK_HZ, type Cfg, type FactState, type InputLog, type Plan } from "./core";
import { buildRun } from "./run";
import { journeyView, unlocksFor, type Stars, type Unlocks } from "./journey";
import { modifierOfDay, type Modifier } from "./config";
import { makeMtcForm, makeMtcPractice, MTC, type MtcAnswer, type MtcItem } from "./mtc";
import { DAILY_SOFT_CAP, fluentCount, lightFact, newProfileLite, recordMtc, recordRun, weekDaysOf, weekStart, type MtcRunResult, type ProfileLite, type RunResult } from "./record";
import { POLICY } from "./config";

export interface StartOpts { mode: "solo" | "quick" | "calm" | "pit" | "daily" | "arcade" | "arcade-daily" | "arcade-endless"; stageId?: string; loadout?: string[]; tables?: number[]; timer?: "none" | "soft"; lanes?: 3 | 4; forms?: ("x" | "d" | "m")[] }
export interface JourneyInfo { journey: { stars: Stars; unlockAll: boolean; totalStars: number; maxStars: number; bosses: number }; unlocks: Unlocks; daily: { modifier: Modifier }; /** Arcade personal bests (arcade.ts) */ arcade?: ProfileLite["arcade"]; fishTotal?: number }
export interface LightFact { key: string; thaw: number; attempts: number; correct: number; medianMs: number }
export type Started = {
  sessionId: string; seed: number; cfg: Cfg; plan: Plan; best: { fish: number; correct: number; pace: number[] } | null; facts: LightFact[]; fluentFacts: number;
  softCap: boolean; todayCount: number; pinned: number[]; weekDays: number; weekGoal: number; xpToday: number; xpCap: number; mtcThisWeek: number; offlineOnly?: boolean;
} & JourneyInfo
export type JourneyOverview = JourneyInfo & { facts: LightFact[]; fluentFacts: number; weekDays: number; weekGoal: number; xpToday: number; xpCap: number; mtcThisWeek: number }
export interface MtcStarted { sessionId: string; seed: number; form: MtcItem[]; practice: MtcItem[]; limits: { n: number; answerMs: number; pauseMs: number; practice: number }; mtcThisWeek: number }
export type Finished = RunResult & { repeat?: boolean; saved?: "server" | "device" | "queued" };
export type MtcFinished = MtcRunResult & { repeat?: boolean };
/** Everything `start()` returns, plus the server-held checkpoint (log + tick) to resume from. Server-authoritative:
 *  the checkpoint is exactly what `checkpoint()` last saved and had re-verified, never something the client asserts. */
export type Resumed = Started & { checkpoint: { log: InputLog; endTick: number } };
export interface Backend {
  demo: boolean; childName: string;
  start(o: StartOpts): Promise<Started>;
  finish(s: Started, log: InputLog, endTick: number): Promise<Finished>;
  /** "Back to Games" mid-run: save the log + tick so far so the run can be resumed later. Best-effort - a failure
   *  here just means the next visit sees "Play" instead of "Continue", never a scoring risk. */
  checkpoint(sessionId: string, log: InputLog, endTick: number): Promise<void>;
  /** Is there a run this child left mid-way, not finished and not expired? Drives "Continue" vs "Play". */
  resumable(): Promise<{ sessionId: string } | null>;
  /** Fetch that specific session's state (seed/cfg/plan + the checkpoint) so it can actually be continued. */
  resume(sessionId: string): Promise<Resumed>;
  startMtc(): Promise<MtcStarted>;
  finishMtc(s: MtcStarted, answers: MtcAnswer[]): Promise<MtcFinished>;
  facts(): Promise<LightFact[]>;
  journey(): Promise<JourneyOverview>;
  /** Demo only: open every stage. */
  unlockAll?(): Promise<void>;
}

// ── live ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const QKEY = "aos.games.penguin.queue";
type Queued = { path: string; body: unknown; at: number };
const loadQ = (): Queued[] => { try { return JSON.parse(localStorage.getItem(QKEY) ?? "[]") as Queued[]; } catch { return []; } };
const saveQ = (q: Queued[]) => { try { localStorage.setItem(QKEY, JSON.stringify(q.slice(-10))); } catch { /* full or blocked */ } };

export function liveBackend(tenantId: string, childId: string, childName: string): Backend {
  const q = `?tenantId=${encodeURIComponent(tenantId)}&childId=${encodeURIComponent(childId)}`;
  const H = "/api/learning-hub/games";
  const flush = async () => { for (const it of loadQ()) { try { await post(it.path, it.body); saveQ(loadQ().filter((x) => x.at !== it.at)); } catch { /* still offline */ } } };
  if (typeof window !== "undefined") window.addEventListener("online", () => { void flush(); });
  return {
    demo: false, childName,
    start: (o) => post<Started>(`${H}/sessions${q}`, { childId, mode: o.mode, stageId: o.stageId, loadout: o.loadout, tables: o.tables, timer: o.timer, lanes: o.lanes, forms: o.forms }),
    async finish(s, log, endTick) {
      const path = `${H}/sessions/${s.sessionId}/finish${q}`; const body = { childId, log, endTick };
      try { const r = await post<Finished>(path, body); return { ...r, saved: "server" }; }
      catch (e) {
        // Offline / server blip: the whole run played locally, so show the result from the same core and queue the log for when we are back online.
        if ((e as { status?: number }).status && (e as { status?: number }).status! < 500 && (e as { status?: number }).status! !== 408) throw e;
        saveQ([...loadQ(), { path, body, at: Date.now() }]);
        const sum = summarise(replay(s.seed, s.cfg, s.plan, log, endTick));
        const rec = recordRun(s.cfg, sum, new Map(), newProfileLite(), new Date().toISOString());
        return { ...rec.result, saved: "queued" };
      }
    },
    checkpoint: (sessionId, log, endTick) => post<void>(`${H}/sessions/${sessionId}/checkpoint${q}`, { childId, log, endTick }),
    resumable: () => get<{ resumable: { sessionId: string } | null }>(`${H}/sessions/resumable${q}&skin=penguin`).then((r) => r.resumable),
    resume: (sessionId) => get<Resumed>(`${H}/sessions/${sessionId}/resume${q}`),
    async startMtc() { const r = await post<Omit<MtcStarted, "practice">>(`${H}/sessions${q}`, { childId, mode: "mtc" }); return { ...r, practice: makeMtcPractice(r.seed) }; },
    finishMtc: (s, answers) => post<MtcFinished>(`${H}/sessions/${s.sessionId}/finish${q}`, { childId, answers }),
    async facts() { const r = await get<{ facts: LightFact[] }>(`${H}/penguin-slide/facts${q}`); return r.facts; },
    journey: () => get<JourneyOverview>(`${H}/penguin-slide/journey${q}`),
  };
}

// ── demo (this device only) ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const DKEY = "aos.games.penguin.demo.v3";
type DemoSlideSession = { seed: number; cfg: Cfg; plan: Plan; key: string; checkpoint?: { log: InputLog; endTick: number } };
interface DemoDb { facts: Record<string, FactState>; profile: ProfileLite; sessions: Record<string, DemoSlideSession | { mtc: MtcItem[]; seed: number }> }
const isSlideSession = (s: DemoSlideSession | { mtc: MtcItem[]; seed: number } | undefined): s is DemoSlideSession => !!s && "cfg" in s;
const loadDb = (): DemoDb => { try { const d = JSON.parse(localStorage.getItem(DKEY) ?? "null") as DemoDb | null; if (d?.profile) return d; } catch { /* corrupt */ } return { facts: {}, profile: newProfileLite(), sessions: {} }; };
const saveDb = (d: DemoDb) => { try { localStorage.setItem(DKEY, JSON.stringify(d)); } catch { /* private mode */ } };
export const resetDemo = () => { try { localStorage.removeItem(DKEY); } catch { /* ignore */ } };

const jinfo = (db: DemoDb, facts: ReadonlyMap<string, FactState>, now: string): JourneyInfo => { const v = journeyView(db.profile.journey, db.profile.unlockAll); return { journey: { stars: db.profile.journey, unlockAll: db.profile.unlockAll, totalStars: v.totalStars, maxStars: v.maxStars, bosses: v.bossesCleared }, unlocks: unlocksFor(db.profile.journey, facts.values(), db.profile.unlockAll), daily: { modifier: modifierOfDay(now.slice(0, 10)) }, arcade: db.profile.arcade ?? {}, fishTotal: db.profile.fishTotal ?? 0 }; };

export function demoBackend(name = "Explorer", opts: { support?: { calm?: boolean; noTimer?: boolean }; unlockAll?: boolean } = {}): Backend {
  return {
    demo: true, childName: name,
    async start(o) {
      const db = loadDb(); const now = new Date().toISOString(); const facts = new Map(Object.entries(db.facts));
      const randomSeed = (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
      const built = buildRun({ body: { ...o, calm: o.mode === "calm" }, facts, profile: db.profile, support: opts.support ?? {}, age: 9, nowIso: now, seed: randomSeed, firstEver: facts.size === 0 });
      if (!built.ok) throw new Error(built.error);
      const { cfg, plan, key } = built;
      const seed = built.seed ?? randomSeed;
      const id = `demo-${seed}`; db.sessions[id] = { seed, cfg, plan, key };
      const keep = Object.keys(db.sessions).slice(-6); db.sessions = Object.fromEntries(keep.map((k) => [k, db.sessions[k]!])); saveDb(db);
      const day = now.slice(0, 10); const today = db.profile.plays.day === day ? db.profile.plays.count : 0;
      const best = db.profile.bests[key] ?? null;
      return { sessionId: id, seed, cfg, plan, best: best ? { fish: best.fish, correct: best.correct, pace: best.pace } : null, facts: [...facts.values()].map(lightFact), fluentFacts: fluentCount(facts.values()), softCap: today >= DAILY_SOFT_CAP, todayCount: today, pinned: cfg.pinned, weekDays: weekDaysOf(db.profile.days, now), weekGoal: POLICY.weekGoalDays, xpToday: db.profile.xp.day === day ? db.profile.xp.xp : 0, xpCap: POLICY.xpDailyCap, mtcThisWeek: db.profile.mtcAt.filter((d) => d >= weekStart(now)).length, ...jinfo(db, facts, now) };
    },
    async finish(s, log, endTick) {
      const db = loadDb(); const now = new Date().toISOString();
      const sum = summarise(replay(s.seed, s.cfg, cleanPlan(s.plan) ?? s.plan, log, endTick));
      const rec = recordRun(s.cfg, sum, new Map(Object.entries(db.facts)), db.profile, now);
      for (const k of rec.keys) db.facts[k] = rec.facts.get(k)!;
      db.profile = rec.profile; delete db.sessions[s.sessionId]; saveDb(db);
      return { ...rec.result, saved: "device" };
    },
    async checkpoint(sessionId, log, endTick) {
      const db = loadDb(); const s = db.sessions[sessionId];
      if (!isSlideSession(s)) return; // finished / mtc / unknown - nothing to checkpoint
      db.sessions[sessionId] = { ...s, checkpoint: { log, endTick } }; saveDb(db);
    },
    async resumable() {
      const db = loadDb();
      const id = Object.keys(db.sessions).find((k) => isSlideSession(db.sessions[k]) && (db.sessions[k] as DemoSlideSession).checkpoint);
      return id ? { sessionId: id } : null;
    },
    async resume(sessionId) {
      const db = loadDb(); const now = new Date().toISOString(); const facts = new Map(Object.entries(db.facts));
      const s = db.sessions[sessionId];
      if (!isSlideSession(s) || !s.checkpoint) throw new Error("Nothing to resume - start a new one");
      const day = now.slice(0, 10); const today = db.profile.plays.day === day ? db.profile.plays.count : 0;
      const best = db.profile.bests[s.key] ?? null;
      return {
        sessionId, seed: s.seed, cfg: s.cfg, plan: s.plan, checkpoint: s.checkpoint, best: best ? { fish: best.fish, correct: best.correct, pace: best.pace } : null,
        facts: [...facts.values()].map(lightFact), fluentFacts: fluentCount(facts.values()), softCap: today >= DAILY_SOFT_CAP, todayCount: today, pinned: s.cfg.pinned,
        weekDays: weekDaysOf(db.profile.days, now), weekGoal: POLICY.weekGoalDays, xpToday: db.profile.xp.day === day ? db.profile.xp.xp : 0, xpCap: POLICY.xpDailyCap,
        mtcThisWeek: db.profile.mtcAt.filter((d) => d >= weekStart(now)).length, ...jinfo(db, facts, now),
      };
    },
    async startMtc() {
      const db = loadDb(); const seed = (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1; const now = new Date().toISOString();
      const form = makeMtcForm(seed, db.profile.lastMtc); const id = `demo-mtc-${seed}`; db.sessions[id] = { mtc: form, seed }; saveDb(db);
      return { sessionId: id, seed, form, practice: makeMtcPractice(seed), limits: { n: MTC.n, answerMs: MTC.answerMs, pauseMs: MTC.pauseMs, practice: MTC.practice }, mtcThisWeek: db.profile.mtcAt.filter((d) => d >= weekStart(now)).length };
    },
    async finishMtc(s, answers) {
      const db = loadDb(); const now = new Date().toISOString();
      const rec = recordMtc(s.form, answers, new Map(Object.entries(db.facts)), db.profile, now);
      for (const k of rec.keys) db.facts[k] = rec.facts.get(k)!;
      db.profile = rec.profile; saveDb(db);
      return rec.result;
    },
    async facts() { return Object.values(loadDb().facts).map(lightFact); },
    async unlockAll() { const db = loadDb(); db.profile.unlockAll = true; saveDb(db); },
    async journey() {
      const db = loadDb(); const now = new Date().toISOString(); const facts = new Map(Object.entries(db.facts));
      if (opts.unlockAll && !db.profile.unlockAll) { db.profile.unlockAll = true; saveDb(db); }
      const day = now.slice(0, 10);
      return { facts: [...facts.values()].map(lightFact), fluentFacts: fluentCount(facts.values()), weekDays: weekDaysOf(db.profile.days, now), weekGoal: POLICY.weekGoalDays, xpToday: db.profile.xp.day === day ? db.profile.xp.xp : 0, xpCap: POLICY.xpDailyCap, mtcThisWeek: db.profile.mtcAt.filter((d) => d >= weekStart(now)).length, ...jinfo(db, facts, now) };
    },
  };
}
export { TICK_HZ };
