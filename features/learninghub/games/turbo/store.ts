"use client";
// Where a Turbo Slide run's data goes - the SAME server contract as Penguin Slide (server/src/lib/hubGames.ts):
// POST /games/sessions issues the seed + plan, POST /games/sessions/:id/finish takes only the input log and
// re-simulates server-side. The one difference is `skin: "turbo"` on the start body, which the server stores on the
// session purely for reporting; the fact-mastery data (hubFactState/hubGameProfile) is shared with Penguin Slide,
// so practice in either game counts toward the same times-tables fluency.
import { get, post } from "@/lib/api";
import { cleanPlan, replay, summarise, TICK_HZ, type Cfg, type FactState, type InputLog, type Plan } from "./core";
import { buildRun } from "./run";
import { fluentCount, lightFact, newProfileLite, recordRun, weekDaysOf, DAILY_SOFT_CAP, type ProfileLite, type RunResult } from "./record";
import { POLICY } from "../penguin/config";

export interface StartOpts { mode: "solo" | "quick" | "calm" | "daily"; tables?: number[]; lanes?: 3 | 4 }
export interface LightFact { key: string; thaw: number; attempts: number; correct: number; medianMs: number }
export type Started = {
  sessionId: string; seed: number; cfg: Cfg; plan: Plan; best: { fish: number; correct: number; pace: number[] } | null; facts: LightFact[]; fluentFacts: number;
  softCap: boolean; todayCount: number; pinned: number[]; weekDays: number; weekGoal: number;
};
export type Finished = RunResult & { repeat?: boolean; saved?: "server" | "device" | "queued" };
/** Everything `start()` returns, plus the server-held checkpoint (log + tick) to resume from. */
export type Resumed = Started & { checkpoint: { log: InputLog; endTick: number } };
export interface Backend {
  demo: boolean; childName: string;
  start(o: StartOpts): Promise<Started>;
  finish(s: Started, log: InputLog, endTick: number): Promise<Finished>;
  /** "Back to Games" mid-run: save the log + tick so far so the run can be resumed later. */
  checkpoint(sessionId: string, log: InputLog, endTick: number): Promise<void>;
  /** Is there a run this child left mid-way, not finished and not expired? Drives "Continue" vs "Play". */
  resumable(): Promise<{ sessionId: string } | null>;
  /** Fetch that specific session's state (seed/cfg/plan + the checkpoint) so it can actually be continued. */
  resume(sessionId: string): Promise<Resumed>;
  facts(): Promise<LightFact[]>;
}

const QKEY = "aos.games.turbo.queue";
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
    start: (o) => post<Started>(`${H}/sessions${q}`, { childId, mode: o.mode, tables: o.tables, lanes: o.lanes, skin: "turbo" }),
    async finish(s, log, endTick) {
      const path = `${H}/sessions/${s.sessionId}/finish${q}`; const body = { childId, log, endTick };
      try { const r = await post<Finished>(path, body); return { ...r, saved: "server" }; }
      catch (e) {
        if ((e as { status?: number }).status && (e as { status?: number }).status! < 500 && (e as { status?: number }).status! !== 408) throw e;
        saveQ([...loadQ(), { path, body, at: Date.now() }]);
        const sum = summarise(replay(s.seed, s.cfg, s.plan, log, endTick));
        const rec = recordRun(s.cfg, sum, new Map(), newProfileLite(), new Date().toISOString());
        return { ...rec.result, saved: "queued" };
      }
    },
    checkpoint: (sessionId, log, endTick) => post<void>(`${H}/sessions/${sessionId}/checkpoint${q}`, { childId, log, endTick }),
    resumable: () => get<{ resumable: { sessionId: string } | null }>(`${H}/sessions/resumable${q}&skin=turbo`).then((r) => r.resumable),
    resume: (sessionId) => get<Resumed>(`${H}/sessions/${sessionId}/resume${q}`),
    async facts() { const r = await get<{ facts: LightFact[] }>(`${H}/turbo-slide/facts${q}`); return r.facts; },
  };
}

// ── demo (no account yet: same pure core, this device only) ──────────────────────────────────────────────────────
const DKEY = "aos.games.turbo.demo.v1";
type DemoSession = { seed: number; cfg: Cfg; plan: Plan; key: string; checkpoint?: { log: InputLog; endTick: number } };
interface DemoDb { facts: Record<string, FactState>; profile: ProfileLite; sessions: Record<string, DemoSession> }
const loadDb = (): DemoDb => { try { const d = JSON.parse(localStorage.getItem(DKEY) ?? "null") as DemoDb | null; if (d?.profile) return { ...d, sessions: d.sessions ?? {} }; } catch { /* corrupt */ } return { facts: {}, profile: newProfileLite(), sessions: {} }; };
const saveDb = (d: DemoDb) => { try { localStorage.setItem(DKEY, JSON.stringify(d)); } catch { /* private mode */ } };

export function demoBackend(name = "Explorer"): Backend {
  return {
    demo: true, childName: name,
    async start(o) {
      const db = loadDb(); const now = new Date().toISOString(); const facts = new Map(Object.entries(db.facts));
      const seed = (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
      const built = buildRun({ body: { mode: o.mode, tables: o.tables, lanes: o.lanes, calm: o.mode === "calm" }, facts, profile: db.profile, support: {}, age: 9, nowIso: now, seed, firstEver: facts.size === 0 });
      if (!built.ok) throw new Error(built.error);
      const { cfg, plan, key } = built;
      const id = `demo-${seed}`; db.sessions[id] = { seed, cfg, plan, key };
      const keep = Object.keys(db.sessions).slice(-6); db.sessions = Object.fromEntries(keep.map((k) => [k, db.sessions[k]!])); saveDb(db);
      const day = now.slice(0, 10); const today = db.profile.plays.day === day ? db.profile.plays.count : 0;
      const best = db.profile.bests[key] ?? null;
      return { sessionId: id, seed, cfg, plan, best: best ? { fish: best.fish, correct: best.correct, pace: best.pace } : null, facts: [...facts.values()].map(lightFact), fluentFacts: fluentCount(facts.values()), softCap: today >= DAILY_SOFT_CAP, todayCount: today, pinned: cfg.pinned, weekDays: weekDaysOf(db.profile.days, now), weekGoal: POLICY.weekGoalDays };
    },
    async checkpoint(sessionId, log, endTick) {
      const db = loadDb(); const s = db.sessions[sessionId];
      if (!s) return;
      db.sessions[sessionId] = { ...s, checkpoint: { log, endTick } }; saveDb(db);
    },
    async resumable() {
      const db = loadDb();
      const id = Object.keys(db.sessions).find((k) => db.sessions[k]!.checkpoint);
      return id ? { sessionId: id } : null;
    },
    async resume(sessionId) {
      const db = loadDb(); const now = new Date().toISOString(); const facts = new Map(Object.entries(db.facts));
      const s = db.sessions[sessionId];
      if (!s?.checkpoint) throw new Error("Nothing to resume - start a new one");
      const day = now.slice(0, 10); const today = db.profile.plays.day === day ? db.profile.plays.count : 0;
      const best = db.profile.bests[s.key] ?? null;
      return {
        sessionId, seed: s.seed, cfg: s.cfg, plan: s.plan, checkpoint: s.checkpoint, best: best ? { fish: best.fish, correct: best.correct, pace: best.pace } : null,
        facts: [...facts.values()].map(lightFact), fluentFacts: fluentCount(facts.values()), softCap: today >= DAILY_SOFT_CAP, todayCount: today, pinned: s.cfg.pinned,
        weekDays: weekDaysOf(db.profile.days, now), weekGoal: POLICY.weekGoalDays,
      };
    },
    async finish(s, log, endTick) {
      const db = loadDb(); const now = new Date().toISOString();
      const sum = summarise(replay(s.seed, s.cfg, cleanPlan(s.plan) ?? s.plan, log, endTick));
      const rec = recordRun(s.cfg, sum, new Map(Object.entries(db.facts)), db.profile, now);
      for (const k of rec.keys) db.facts[k] = rec.facts.get(k)!;
      db.profile = rec.profile; delete db.sessions[s.sessionId]; saveDb(db);
      return { ...rec.result, saved: "device" };
    },
    async facts() { return Object.values(loadDb().facts).map(lightFact); },
  };
}
export { TICK_HZ };
