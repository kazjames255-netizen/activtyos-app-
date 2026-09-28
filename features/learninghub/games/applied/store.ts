"use client";
// Where a run's data goes for the applied-maths cluster (Market Day, Bake Off Blitz, Rhythm Reef). Same two-backend
// shape as features/learninghub/games/penguin/store.ts: liveBackend hits the real API and never sees an answer key;
// demoBackend (no account) runs the identical pure generateForm/markForm in the browser against localStorage, so a
// no-account demo plays exactly like the real thing and is honestly labelled as a demo.
import { get, post } from "@/lib/api";
import { cleanAnswers, generateForm, ITEMS_PER_RUN, markForm, nextLevel, sanitize, type Answer, type GameId, type ItemOut, type Level } from "./core";

export interface Started { sessionId: string; gameId: GameId; level: Level; items: ItemOut[]; itemsPerRun: number; best: { score: number; total: number; at: string } | null; softCap: boolean; todayCount: number; xpToday: number; daysPractised: number; demo?: boolean }
/** Everything `start()` returns, plus the server-held checkpoint (answers so far) to resume from. Server-
 *  authoritative: exactly what `checkpoint()` last saved, never something the client asserts. */
export type Resumed = Started & { checkpoint: { answers: Answer[] } };
export interface FinishedRow { id: string; tag: string; correct: boolean; given: number | string | null; answer: number | string }
export interface Finished { gameId: GameId; score: number; total: number; level: Level; nextLevel: Level; newBest: boolean; best: { score: number; total: number; at: string } | null; xpGained: number; xpToday: number; rows: FinishedRow[]; repeat?: boolean }
export interface TagRow { tag: string; attempts: number; correct: number; rate: number | null }
export interface Overview { gameId: GameId; level: Level; best: { score: number; total: number; at: string } | null; tags: TagRow[]; weak: TagRow[]; totals: { attempts: number; correct: number; accuracy: number | null; daysPractised: number }; xpToday: number }

export interface Backend {
  demo: boolean; childName: string;
  start(): Promise<Started>;
  finish(s: Started, answers: Answer[]): Promise<Finished>;
  overview(): Promise<Overview>;
  /** "Back to Games" mid-run: save the answers given so far so the run can be resumed later. Best-effort - a
   *  failure here just means the next visit starts fresh, never blocks exiting. */
  checkpoint(sessionId: string, answers: Answer[]): Promise<void>;
  /** Is there a run this child left mid-way in THIS game, not finished, not expired? */
  resumable(): Promise<{ sessionId: string } | null>;
  /** Fetch that specific session's state (items/level + the checkpoint) so it can actually be continued. */
  resume(sessionId: string): Promise<Resumed>;
}

// ── live ───────────────────────────────────────────────────────────────────────────────────────────────────────
export function liveBackend(gameId: GameId, tenantId: string, childId: string, childName: string): Backend {
  const q = `?tenantId=${encodeURIComponent(tenantId)}&childId=${encodeURIComponent(childId)}`;
  const H = `/api/learning-hub/games/applied/${gameId}`;
  return {
    demo: false, childName,
    start: () => post<Started>(`${H}/sessions${q}`, { childId }),
    finish: (s, answers) => post<Finished>(`${H}/sessions/${s.sessionId}/finish${q}`, { childId, answers }),
    overview: () => get<Overview>(`${H}/state${q}`),
    checkpoint: (sessionId, answers) => post<void>(`${H}/sessions/${sessionId}/checkpoint${q}`, { childId, answers }),
    resumable: () => get<{ resumable: { sessionId: string } | null }>(`${H}/sessions/resumable${q}`).then((r) => r.resumable),
    resume: (sessionId) => get<Resumed>(`${H}/sessions/${sessionId}/resume${q}`),
  };
}

// ── demo (this device only) ───────────────────────────────────────────────────────────────────────────────────
const DKEY_PREFIX = "aos.games.applied.demo.v1.";
interface DemoState { level: Level; tags: Record<string, { attempts: number; correct: number }>; best: { score: number; total: number; at: string } | null; xpToday: { day: string; xp: number }; days: string[] }
interface DemoSession { seed: number; level: Level; checkpoint?: { answers: Answer[] } }
interface DemoDb { state: DemoState; sessions: Record<string, DemoSession> }
const newDemoState = (): DemoState => ({ level: 1, tags: {}, best: null, xpToday: { day: "", xp: 0 }, days: [] });
const loadDb = (gameId: GameId): DemoDb => { try { const d = JSON.parse(localStorage.getItem(DKEY_PREFIX + gameId) ?? "null") as DemoDb | null; if (d?.state) return d; } catch { /* corrupt */ } return { state: newDemoState(), sessions: {} }; };
const saveDb = (gameId: GameId, d: DemoDb) => { try { localStorage.setItem(DKEY_PREFIX + gameId, JSON.stringify(d)); } catch { /* private mode */ } };
export const resetDemo = (gameId: GameId) => { try { localStorage.removeItem(DKEY_PREFIX + gameId); } catch { /* ignore */ } };

export function demoBackend(gameId: GameId, name = "Explorer"): Backend {
  return {
    demo: true, childName: name,
    async start() {
      const db = loadDb(gameId); const now = new Date().toISOString(); const day = now.slice(0, 10);
      const seed = (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
      const items = generateForm(gameId, seed, db.state.level);
      const id = `demo-${seed}`; db.sessions[id] = { seed, level: db.state.level };
      const keep = Object.keys(db.sessions).slice(-6); db.sessions = Object.fromEntries(keep.map((k) => [k, db.sessions[k]!])); saveDb(gameId, db);
      return { sessionId: id, gameId, level: db.state.level, items: sanitize(items), itemsPerRun: ITEMS_PER_RUN, best: db.state.best, softCap: false, todayCount: 0, xpToday: db.state.xpToday.day === day ? db.state.xpToday.xp : 0, daysPractised: db.state.days.length, demo: true };
    },
    async finish(s, answers) {
      const db = loadDb(gameId); const now = new Date().toISOString(); const day = now.slice(0, 10);
      const sess = db.sessions[s.sessionId];
      const items = generateForm(gameId, sess?.seed ?? 1, sess?.level ?? s.level);
      const cleaned = cleanAnswers(answers, items.map((i) => i.id)) ?? [];
      const marked = markForm(items, cleaned);
      const tags = { ...db.state.tags };
      for (const r of marked.rows) { const e = tags[r.tag] ?? { attempts: 0, correct: 0 }; tags[r.tag] = { attempts: e.attempts + 1, correct: e.correct + (r.correct ? 1 : 0) }; }
      const isBest = !db.state.best || marked.score > db.state.best.score;
      const xpDay = db.state.xpToday.day === day ? db.state.xpToday.xp : 0;
      const xpGain = Math.max(0, Math.min(120 - xpDay, marked.rows.filter((r) => r.correct).length * 5));
      const level = sess?.level ?? s.level;
      db.state = { level: nextLevel(level, marked.score, marked.total), tags, best: isBest ? { score: marked.score, total: marked.total, at: now } : db.state.best, xpToday: { day, xp: xpDay + xpGain }, days: db.state.days.includes(day) ? db.state.days : [...db.state.days.slice(-89), day] };
      delete db.sessions[s.sessionId]; saveDb(gameId, db);
      return { gameId, score: marked.score, total: marked.total, level, nextLevel: db.state.level, newBest: isBest, best: db.state.best, xpGained: xpGain, xpToday: db.state.xpToday.xp, rows: marked.rows.map((r) => ({ id: r.id, tag: r.tag, correct: r.correct, given: r.given, answer: r.answer })) };
    },
    async overview() {
      const db = loadDb(gameId); const now = new Date().toISOString(); const day = now.slice(0, 10);
      const rows = Object.entries(db.state.tags).map(([tag, s]) => ({ tag, attempts: s.attempts, correct: s.correct, rate: s.attempts ? s.correct / s.attempts : null }));
      const totalAttempts = rows.reduce((a, r) => a + r.attempts, 0), totalCorrect = rows.reduce((a, r) => a + r.correct, 0);
      return { gameId, level: db.state.level, best: db.state.best, tags: rows, weak: rows.filter((r) => r.rate !== null && r.rate < 0.6), totals: { attempts: totalAttempts, correct: totalCorrect, accuracy: totalAttempts ? totalCorrect / totalAttempts : null, daysPractised: db.state.days.length }, xpToday: db.state.xpToday.day === day ? db.state.xpToday.xp : 0 };
    },
    async checkpoint(sessionId, answers) {
      const db = loadDb(gameId); const s = db.sessions[sessionId];
      if (!s) return; // finished / unknown - nothing to checkpoint
      db.sessions[sessionId] = { ...s, checkpoint: { answers } }; saveDb(gameId, db);
    },
    async resumable() {
      const db = loadDb(gameId);
      const id = Object.keys(db.sessions).find((k) => db.sessions[k]?.checkpoint);
      return id ? { sessionId: id } : null;
    },
    async resume(sessionId) {
      const db = loadDb(gameId); const now = new Date().toISOString(); const day = now.slice(0, 10);
      const s = db.sessions[sessionId];
      if (!s?.checkpoint) throw new Error("Nothing to resume - start a new one");
      const items = generateForm(gameId, s.seed, s.level);
      return { sessionId, gameId, level: s.level, items: sanitize(items), itemsPerRun: ITEMS_PER_RUN, checkpoint: s.checkpoint, best: db.state.best, softCap: false, todayCount: 0, xpToday: db.state.xpToday.day === day ? db.state.xpToday.xp : 0, daysPractised: db.state.days.length, demo: true };
    },
  };
}
