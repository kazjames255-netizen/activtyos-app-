// ARCADE MODE for Penguin Slide (docs/games-prototypes/ARCADE-BRIEF.md, phase 1): lives + Game Over, combo x2..x5, base x combo + speed bonus scoring, a
// daily challenge with a fixed seed, and an endless run. It is a PURE layer over the existing simulation: the sim is untouched (Journey / Free play play exactly
// as before, CORE_VERSION unchanged); Arcade only reads the sim's `Result`s, in order, and folds them into a tally. The client folds them live to draw hearts /
// score / combo and to end the run at Game Over; the SERVER folds the same results from its own re-simulation (record.ts -> recordRun), so a score, a combo and a
// Game Over are never something the browser claims. Nothing here has a clock, Math.random or DOM (same rules as core.ts).
// (Imports only TYPES from core.ts - core.ts imports cleanArcadeCfg from here, so a value import back would be a cycle.)
import type { Result } from "./core";

const TICK_HZ = 60; // = core.ts TICK_HZ (asserted in arcade.selftest.ts)
/** Same integer mix as core.ts's `mix` (kept local to avoid the import cycle; asserted equal in arcade.selftest.ts). */
function mix(seed: number, a: number, b = 0): number {
  let h = (seed ^ Math.imul(a + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = (h ^ Math.imul(b + 0x7f4a7c15, 0x297a2d39)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x165667b1) >>> 0;
  return (h ^ (h >>> 16)) >>> 0 || 1;
}

export type ArcadeKind = "run" | "daily" | "endless";
export const ARCADE_KINDS: readonly ArcadeKind[] = ["run", "daily", "endless"];
/** `lives` 0 = unlimited (Calm: no lives, no timer, no Game Over - the same run, without the pressure). `timerSec` = seconds a gate takes to arrive (0 = none). */
export interface ArcadeCfg { kind: ArcadeKind; lives: number; timerSec: number }

export const ARCADE = {
  lives: 3, comboCap: 5, base: 10, speedBonusMax: 10,
  /** gates per run by kind (endless ends at Game Over, or when the plan - the core's 40-gate cap - is used up) */
  n: { run: 20, daily: 12, endless: 40 } as Record<ArcadeKind, number>,
  /** endless stars by score (run / daily stars are earned by clearing the run, see arcadeStars) */
  endlessStars: [200, 600, 1200] as const,
} as const;

/** The Arcade config for a request. Calm strips the pressure (no lives, no timer) but keeps the score and combo. `age` picks a kinder gate timer for under-8s. */
export function arcadeCfg(kind: ArcadeKind, o: { calm: boolean; age: number | null }): ArcadeCfg {
  return o.calm ? { kind, lives: 0, timerSec: 0 } : { kind, lives: ARCADE.lives, timerSec: (o.age ?? 9) < 8 ? 12 : 9 };
}
export const cleanArcadeCfg = (x: unknown): ArcadeCfg | null => {
  if (!x || typeof x !== "object") return null;
  const a = x as Partial<ArcadeCfg>;
  if (!ARCADE_KINDS.includes(a.kind as ArcadeKind)) return null;
  const lives = Math.floor(Number(a.lives)), timerSec = Number(a.timerSec);
  return { kind: a.kind as ArcadeKind, lives: Number.isFinite(lives) ? Math.max(0, Math.min(5, lives)) : ARCADE.lives, timerSec: Number.isFinite(timerSec) && timerSec > 0 ? Math.max(6, Math.min(16, timerSec)) : 0 };
};

export interface ArcadeRow { i: number; k: string; ok: boolean; miss: boolean; mult: number; bonus: number; points: number; combo: number; livesLeft: number }
export interface ArcadeState {
  kind: ArcadeKind; maxLives: number; lives: number; combo: number; bestCombo: number; score: number; correct: number; wrong: number; misses: number;
  /** the run is over: the last life went (never in Calm) */ over: boolean; /** index of the result that ended it (or null) */ overAt: number | null; rows: ArcadeRow[];
}
export const newArcade = (a: ArcadeCfg): ArcadeState => ({ kind: a.kind, maxLives: a.lives, lives: a.lives, combo: 0, bestCombo: 0, score: 0, correct: 0, wrong: 0, misses: 0, over: false, overAt: null, rows: [] });

/** Points for one right answer: (base + speed bonus) x combo multiplier. The bonus is the first third of the gate window, linear from +10 to +0; no timer = no bonus. */
export function pointsFor(combo: number, latencyTicks: number, a: ArcadeCfg): { mult: number; bonus: number; points: number } {
  const mult = Math.max(1, Math.min(ARCADE.comboCap, combo));
  const third = (a.timerSec * TICK_HZ) / 3;
  const bonus = a.timerSec > 0 ? Math.round(ARCADE.speedBonusMax * Math.max(0, 1 - Math.max(0, latencyTicks) / third)) : 0;
  return { mult, bonus, points: (ARCADE.base + bonus) * mult };
}

/** Fold ONE result into the tally. A rapid guess (< 0.4 s, the core's own `guess` flag) is neutral: no score, no life, the combo is left alone (so mashing gets nothing).
 *  A shielded slip costs no life. Anything after Game Over is ignored. */
export function applyArcade(st: ArcadeState, r: Result, a: ArcadeCfg): ArcadeState {
  if (st.over || r.guess) return st;
  const next: ArcadeState = { ...st, rows: [...st.rows] };
  if (r.correct) {
    next.combo = st.combo + 1; next.bestCombo = Math.max(st.bestCombo, next.combo); next.correct = st.correct + 1;
    const p = pointsFor(next.combo, r.latencyTicks, a);
    next.score = st.score + p.points;
    next.rows.push({ i: r.i, k: r.k, ok: true, miss: false, mult: p.mult, bonus: p.bonus, points: p.points, combo: next.combo, livesLeft: st.lives });
    return next;
  }
  next.combo = r.shielded ? st.combo : 0;
  if (r.miss) next.misses = st.misses + 1; else next.wrong = st.wrong + 1;
  if (a.lives > 0 && !r.shielded) { next.lives = Math.max(0, st.lives - 1); if (next.lives === 0) { next.over = true; next.overAt = r.i; } }
  next.rows.push({ i: r.i, k: r.k, ok: false, miss: r.miss, mult: 0, bonus: 0, points: 0, combo: next.combo, livesLeft: next.lives });
  return next;
}

/** The whole run: what the server computes from the re-simulated results. */
export function tally(a: ArcadeCfg, results: readonly Result[]): ArcadeState { let st = newArcade(a); for (const r of results) st = applyArcade(st, r, a); return st; }

/** 0-3 stars. Run / daily: clear the run (no Game Over) for 2, and 3 with no life lost; endless: by score. Never for speed alone. */
export function arcadeStars(st: ArcadeState, n: number): 0 | 1 | 2 | 3 {
  if (st.kind === "endless") { const [a, b, c] = ARCADE.endlessStars; return st.score >= c ? 3 : st.score >= b ? 2 : st.score >= a ? 1 : 0; }
  if (st.over) return 0;
  const answered = st.correct + st.wrong + st.misses;
  if (answered < Math.min(n, ARCADE.n[st.kind])) return 0; // ended early by the child: not a clear
  return st.maxLives > 0 && st.lives === st.maxLives ? 3 : st.maxLives === 0 || st.lives >= 2 ? 2 : 1;
}

// ── daily challenge: ONE fixed seed + fixed tables per calendar day, the same for every child ─────────────────────────────────────────────────────────────────
export const arcadeDailySeed = (day: string): number => { let h = 0; const s = `arcade-daily-${day}`; for (let i = 0; i < s.length; i++) h = mix(h || 1, s.charCodeAt(i), i); return h >>> 0 || 1; };
/** Four tables for the day (2..12), stable per date and spread across the range so it is a real mixed set, never always the easy ones. */
export function arcadeDailyTables(day: string): number[] {
  const pool = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; const out: number[] = [];
  let h = arcadeDailySeed(`${day}-tables`);
  while (out.length < 4) { h = mix(h, out.length + 17, 3); const t = pool[h % pool.length]!; if (!out.includes(t)) out.push(t); }
  return out.sort((x, y) => x - y);
}
