// PENGUIN SLIDE - the pure, deterministic game core. NO React, NO DOM, NO `@/` imports, NO clock, NO Math.random, NO transcendental maths:
// the server (server/src/lib/hubGames.ts) imports this exact file and RE-SIMULATES a finished run from (seed, config, plan, input log), so a
// child's score / accuracy / response times are computed by the server and never trusted from the browser ("Question Port": games never mark).
//
// Shape of the game: the penguin slides down an icy run at 60 fixed ticks/s. Each question is a GATE of 3-4 lanes; every lane holds an ice block
// with a number on it. The child STEERS the penguin (momentum, drift, wall bounce; input is quantised to steer -3..3 + an "act" tap per tick) and
// the block the penguin hits is the answer. Wrong answers are physical obstacles; the right one shatters into fish. Nothing here knows about
// pixels: the renderer reads the Sim and interpolates.
//
// Determinism rules: only + - * / sqrt-free arithmetic, Math.floor/abs/min/max/imul, integer hashing. Every random draw comes from makeRng(mix(seed, ...)).

import { makeRng, type Rng } from "../../tools/engine/rng";
export const TICK_HZ = 60;

import { POLICY, POWERS, STAGE_SCRIPT, setPieceItems, setPieceLen, setPiecesOf, type ChaserKind, type Form, type GateStyle, type Modifier, type PowerId } from "./config";
export { POLICY };
export type { Form };
export const CORE_VERSION = 3;
/** Version history (a saved run keeps the `v` it was played under, so an old input log is always re-simulated with the rules it was played with):
 *  2: the ledge auto-locked after 0.23 s of rest and the client committed on key/finger release.
 *  3: a lane is only locked by an explicit `act` (tap on the chosen answer, Space/Enter or the lock-in ring); the world got friends, Serpent ring-gating, Yeti division-aim and hand-authored set pieces. */
export const LEGACY_AUTOLOCK_BELOW = 3;
export const isV3 = (c: { v?: number }) => (c.v ?? 0) >= 3;

// ─── Facts ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Op = "x" | "d";
/** Canonical, order-free fact key: `x_7x8` covers 7x8 and 8x7; `d_7x8` covers 56/7 and 56/8. */
export const factKey = (op: Op, a: number, b: number) => `${op}_${Math.min(a, b)}x${Math.max(a, b)}`;
export function parseKey(k: string): { op: Op; a: number; b: number } | null {
  const m = /^([xd])_(\d{1,2})x(\d{1,2})$/.exec(k);
  if (!m) return null;
  const a = +m[2], b = +m[3];
  if (a < 1 || b < 1 || a > 12 || b > 12 || a > b) return null;
  return { op: m[1] as Op, a, b };
}

/** What we remember about one fact for one child (FSRS-lite: stability S in days, difficulty D prior from table/size; docs/games-research/deep/C section 3).
 *  `thaw` is the child-facing ice -> gold ladder derived from the evidence: 0 new, 1 learning, 2 accurate, 3 fluent, 4 retained. */
export interface FactState {
  key: string; op: Op; a: number; b: number;
  /** Stability (days until recall probability falls to ~90%) and difficulty prior (0.3 easy .. 1 hard). */
  S: number; D: number; /** Elo-style difficulty rating for THIS child (logit scale) */ elo: number; lastSeen: string | null; nextDueAt: string | null;
  recentMs: number[]; medianLatencyMs: number;
  attempts: number; correct: number;
  /** Last 6 outcomes, oldest first: w wrong, c correct, F correct and within the child's fluent band. */
  hist: string;
  /** Distinct days with a correct answer (last 4) and the last time a correct answer followed a gap of 7+ days. */
  correctDays: string[]; retainedAt: string | null;
  thaw: 0 | 1 | 2 | 3 | 4;
  /** Wrong answers by kind (operand_neighbour, add_instead, reversal, ...) and the exact numbers the child gave. */
  errTypes: Record<string, number>; wrongAnswers: Record<string, number>;
  updatedAt: string;
}
const HARD_TABLES = [6, 7, 8, 9, 12];
export const difficultyPrior = (a: number, b: number) => Math.round(Math.min(1, 0.3 + (a * b) / 144 * 0.5 + (HARD_TABLES.includes(a) || HARD_TABLES.includes(b) ? 0.12 : 0)) * 100) / 100;
/** Elo-style adaptive difficulty (docs A section c): child ability theta vs per-fact difficulty b, success p = sigmoid(theta - b). Selection aims for
 *  p ~ 0.80-0.85 as a PRIOR (tunable in Cfg.target), never as a law. Not used inside the simulation, only to choose the plan and to update memory. */
export const THETA0 = 1.6;
export const bPrior = (a: number, b: number) => Math.round((0.5 + 4 * (difficultyPrior(a, b) - 0.3)) * 100) / 100;
export const pCorrect = (theta: number, b: number) => 1 / (1 + Math.exp(-(theta - b)));
/** s: 1 correct and quick, 0.75 correct, 0.5 correct but slow, 0 wrong. K shrinks as answers accumulate. */
export const eloTheta = (theta: number, b: number, s: number, nAnswers: number) => Math.round((theta + Math.max(0.05, 0.4 / (1 + nAnswers / 40)) * (s - pCorrect(theta, b))) * 1000) / 1000;
export const freshFact = (k: string): FactState | null => {
  const p = parseKey(k);
  return p ? { key: k, ...p, S: 0.05, D: difficultyPrior(p.a, p.b), elo: bPrior(p.a, p.b), lastSeen: null, nextDueAt: null, recentMs: [], medianLatencyMs: 0, attempts: 0, correct: 0, hist: "", correctDays: [], retainedAt: null, thaw: 0, errTypes: {}, wrongAnswers: {}, updatedAt: "" } : null;
};

/** Speed bands are RELATIVE to the child's own baseline `rt0` (median time on their easy 2x/5x/10x facts), so typing/steering speed, EAL and SEND do
 *  not read as "slow". Tutors see these, the child never does. */
export const DEFAULT_RT0_MS = 2200;
export const fluentMs = (rt0: number) => Math.max(1800, Math.min(3500, Math.round(1.75 * (rt0 || DEFAULT_RT0_MS))));
export const slowMs = (rt0: number) => Math.max(6000, Math.round(3 * (rt0 || DEFAULT_RT0_MS)));
export const speedBand = (ms: number, rt0 = DEFAULT_RT0_MS): "fast" | "ok" | "slow" => (ms <= fluentMs(rt0) ? "fast" : ms <= slowMs(rt0) ? "ok" : "slow");
export const RAPID_GUESS_MS = 400;

const DAY = 86_400_000;
const TARGET_R = 0.87;
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((p, q) => p - q); const m = s.length >> 1; return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2); };
/** Recall probability now. */
export const retrievability = (f: FactState, nowIso: string): number => (f.lastSeen ? Math.exp(-Math.max(0, (new Date(nowIso).getTime() - new Date(f.lastSeen).getTime()) / DAY) / Math.max(0.003, f.S)) : 0);

/** Why a wrong answer was wrong. Misconception tags for the tutor (operand errors are ~76% of multiplication errors). */
export function classifyError(op: Form, a: number, b: number, given: number, divisor?: number): string {
  if (op === "d" || op === "m") { const q = divisor === a ? b : a; return given === divisor ? "divisor_given" : Math.abs(given - q) === 1 ? "off_by_1" : Math.abs(given - q) === 2 ? "off_by_2" : "other"; }
  const p = a * b;
  if (given === swapDigits(p) && p >= 10 && given !== p) return "reversal";
  if (given === a + b) return "add_instead";
  if (given === p + a || given === p - a || given === p + b || given === p - b) return "operand_neighbour";
  if (Math.abs(given - p) === 1) return "off_by_1";
  if (Math.abs(given - p) === 2) return "off_by_2";
  if (given % a === 0 || given % b === 0) return "table_confusion";
  return "other";
}

/** Retest gaps: a fact answered correctly comes back soon, then tomorrow, then further out (minimums; S sets the rest). */
const MIN_GAP_DAYS = [0, 0.007, 1, 3];
export function applyToFact(prev: FactState, r: { correct: boolean; latencyTicks: number; wrongAnswer?: number; divisor?: number; typed?: boolean; form?: Form }, o: { nowIso: string; rt0Ms?: number; theta?: number }): FactState {
  const f: FactState = { ...prev, recentMs: [...prev.recentMs], correctDays: [...prev.correctDays], errTypes: { ...prev.errTypes }, wrongAnswers: { ...prev.wrongAnswers } };
  const ms = Math.round((r.latencyTicks * 1000) / TICK_HZ);
  const day = o.nowIso.slice(0, 10);
  const rapid = ms < RAPID_GUESS_MS;
  const R = retrievability(prev, o.nowIso);
  const gapDays = prev.lastSeen ? (new Date(o.nowIso).getTime() - new Date(prev.lastSeen).getTime()) / DAY : 0;
  f.attempts += 1;
  if (!rapid) { f.recentMs = [...f.recentMs, ms].slice(-5); f.medianLatencyMs = median(f.recentMs); }
  let outcome: "w" | "c" | "F";
  let run = 0; for (let i = f.hist.length - 1; i >= 0 && f.hist[i] !== "w"; i--) run++;
  if (r.correct) {
    f.correct += 1;
    outcome = !rapid && ms <= fluentMs(o.rt0Ms ?? DEFAULT_RT0_MS) ? "F" : "c";
    const g = rapid ? 1 : outcome === "F" ? 3 : ms <= slowMs(o.rt0Ms ?? DEFAULT_RT0_MS) ? 2 : 1;
    const D = Math.max(0.3, f.D);
    f.S = g === 1 ? f.S * (1 + (0.3 * (1 - R)) / D) : g === 2 ? f.S * (1 + (1.0 * (1 - R)) / D + 0.3) : f.S * (1 + (1.6 * (1 - R)) / D + 0.3);
    f.S = Math.min(60, Math.round(f.S * 1000) / 1000);
    if (!f.correctDays.includes(day)) f.correctDays = [...f.correctDays, day].slice(-4);
    if (gapDays >= 7 && g >= 2) f.retainedAt = o.nowIso;
    run += 1;
  } else {
    outcome = "w";
    f.S = Math.max(0.0035, f.S * 0.4);
    const et = classifyError(r.form ?? f.op, f.a, f.b, r.wrongAnswer ?? -1, r.divisor);
    if (typeof r.wrongAnswer === "number") {
      f.errTypes[et] = (f.errTypes[et] ?? 0) + 1;
      const k = String(r.wrongAnswer); f.wrongAnswers[k] = (f.wrongAnswers[k] ?? 0) + 1;
      f.wrongAnswers = Object.fromEntries(Object.entries(f.wrongAnswers).sort((p, q) => q[1] - p[1]).slice(0, 4));
    }
    f.retainedAt = null; run = 0;
  }
  {
    const sc = !r.correct ? 0 : rapid ? 0.75 : outcome === "F" ? 1 : ms <= slowMs(o.rt0Ms ?? DEFAULT_RT0_MS) ? 0.75 : 0.5;
    const p = pCorrect(o.theta ?? THETA0, prev.elo);
    f.elo = Math.round((prev.elo - Math.max(0.08, 0.4 / (1 + prev.attempts / 3)) * (sc - p)) * 1000) / 1000;
  }
  f.hist = (f.hist + outcome).slice(-6);
  f.lastSeen = o.nowIso;
  const interval = Math.min(30, Math.max(MIN_GAP_DAYS[Math.min(run, 3)]!, f.S * Math.log(1 / TARGET_R)));
  f.nextDueAt = new Date(new Date(o.nowIso).getTime() + interval * DAY).toISOString();
  f.thaw = stateOf(f);
  f.updatedAt = o.nowIso;
  return f;
}

/** new -> learning -> accurate -> fluent -> retained (docs C 3.4). An error after a gap drops it (the last-3 / last-4 windows). */
export function stateOf(f: Pick<FactState, "attempts" | "hist" | "correct" | "correctDays" | "retainedAt">): 0 | 1 | 2 | 3 | 4 {
  if (f.attempts === 0) return 0;
  const last3 = f.hist.slice(-3), last4 = f.hist.slice(-4);
  const accurate = f.correct >= 3 && f.correctDays.length >= 2 && !last3.includes("w");
  const fluent = accurate && last4.length >= 3 && (last4.match(/F/g)?.length ?? 0) >= 3 && !last4.includes("w");
  if (fluent && f.retainedAt) return 4;
  if (fluent) return 3;
  return accurate ? 2 : 1;
}

// ─── Config + plan (item selection) ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type Mode = "solo" | "quick" | "calm";
export interface Cfg {
  v: number; mode: Mode; n: number; lanes: 3 | 4; calm: boolean;
  /** 0 = NO time pressure (default for everyone): the gate waits for the child. >0 = optional "sprint": seconds until it arrives; a gate that
   *  arrives untouched is a neutral miss (retried later). Timers are for measurement / opt-in play, never the default. */
  approachSec: number; maxNew: number;
  /** In-session success-rate band the plan aims for (tunable; logged so it can be validated on real data, docs C R11). */
  target: [number, number];
  /** Tables the child picked ([] = Pip's picks). */
  tables: number[]; /** Tables a tutor pinned: they win over everything. */ pinned: number[]; forms: Form[];
  /** Journey: which stage this run is (null = free play), its biome (art + how gates look), moving gates, the chaser of a boss stage, the helpers taken along, today's safe modifier. */
  stage: string | null; biome: number; style: GateStyle; shoals: boolean; chaser: ChaserKind | null; loadout: PowerId[]; mod: Modifier | null;
  /** The child's very first run: the first gates are eased (one wrong lane removed) and the right block glows. */ tutorial: boolean;
}
export const MODE_DEFAULTS: Record<Mode, { n: number; calm: boolean; maxNew: number }> = {
  solo: { n: 12, calm: false, maxNew: 6 }, quick: { n: 6, calm: false, maxNew: 3 }, calm: { n: 8, calm: true, maxNew: 4 },
};
export function makeCfg(p: Partial<Cfg> & { mode?: Mode } = {}): Cfg {
  const mode: Mode = p.calm ? "calm" : p.mode ?? "solo";
  const d = MODE_DEFAULTS[mode];
  const ok = (xs: unknown, lo: number, hi: number) => (Array.isArray(xs) ? [...new Set(xs.map(Number).filter((x) => Number.isInteger(x) && x >= lo && x <= hi))].sort((a, b) => a - b) : []);
  return {
    v: CORE_VERSION, mode, n: Math.max(4, Math.min(40, Math.floor(p.n ?? d.n))), lanes: p.lanes === 4 ? 4 : 3, calm: d.calm,
    approachSec: p.approachSec && p.approachSec > 0 && !d.calm ? Math.max(6, Math.min(16, p.approachSec)) : 0, target: [0.8, 0.9], maxNew: Math.max(0, Math.min(12, Math.floor(p.maxNew ?? d.maxNew))),
    tables: ok(p.tables, 2, 12), pinned: ok(p.pinned, 2, 12), forms: (Array.isArray(p.forms) ? [...new Set(p.forms.filter((f): f is Form => f === "x" || f === "d" || f === "m"))] : []).length ? [...new Set((p.forms as Form[]).filter((f) => f === "x" || f === "d" || f === "m"))] : ["x"], tutorial: p.tutorial === true,
    stage: typeof p.stage === "string" ? p.stage.slice(0, 8) : null, biome: Math.max(1, Math.min(5, Math.floor(p.biome ?? 1))), style: p.style ?? "blocks", shoals: p.shoals === true && !d.calm, chaser: p.chaser ?? null,
    loadout: (Array.isArray(p.loadout) ? [...new Set(p.loadout.filter((x): x is PowerId => POWERS.some((q) => q.id === x)))] : []).slice(0, POLICY.loadoutSlots), mod: p.mod ?? null,
  };
}

/** o = how the fact is asked: x (7 x 8), d (56 / 7), m (? x 8 = 56). fam = fact-family id, combo = the follow-up of a fact just answered. */
export interface PlanItem { k: string; o: Form; f: 0 | 1; boss?: 1; fam?: number; combo?: 1; /** d/m only: which factor is shown as the divisor / known one (0 = the smaller, 1 = the larger) */ d?: 0 | 1 }
export interface Plan { v: number; items: PlanItem[]; rescue: PlanItem[]; tables: number[]; allGold: boolean; unseen: number }

/** Tables unlock in this order; a new one opens when >= 80% of the facts in the open ones are "accurate" or better (thaw >= 2, docs C 3.5). */
export const TABLE_ORDER = [2, 5, 10, 3, 4, 8, 6, 7, 9, 11, 12];
export const universe = (tables: number[]): string[] => {
  const out = new Set<string>();
  for (const t of tables) for (let b = 2; b <= 12; b++) out.add(factKey("x", t, b));
  return [...out].sort();
};
export function frontier(snap: ReadonlyMap<string, FactState>): number[] {
  let open = 3;
  for (;;) {
    const T = TABLE_ORDER.slice(0, open);
    const facts = universe(T);
    const secure = facts.filter((k) => (snap.get(k)?.thaw ?? 0) >= 2).length;
    if (open >= TABLE_ORDER.length || secure / facts.length < 0.8) break;
    open++;
  }
  return TABLE_ORDER.slice(0, open).sort((a, b) => a - b);
}
const nextTableAfter = (T: number[]): number | null => TABLE_ORDER.find((t) => !T.includes(t)) ?? null;

/** FNV-ish integer mix: every derived rng stream comes from this so nothing depends on call order. */
export function mix(seed: number, a: number, b = 0): number {
  let h = (seed ^ Math.imul(a + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = (h ^ Math.imul(b + 0x7f4a7c15, 0x297a2d39)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x165667b1) >>> 0;
  return (h ^ (h >>> 16)) >>> 0 || 1;
}

/** Choose this run's facts (docs A section c + C section 3): per 12 items ~6 at the target success rate (weak / due facts first), 3 confidence builders,
 *  2 stretch (new or hard), 1 spaced review of a secure fact. At most `maxNew` never-seen facts, interleaved (no fact twice in a row, no table three times
 *  running). A tutor's pinned tables win. `theta` = the child's Elo ability, `rolling` = recent accuracy (steers how many new facts open). */
export function selectPlan(seed: number, cfg: Cfg, snap: ReadonlyMap<string, FactState>, nowIso: string, rolling: number | null = null, theta: number = THETA0): Plan {
  const rng = makeRng(mix(seed, 101));
  const pinned = cfg.pinned.length > 0;
  const T = pinned ? cfg.pinned : cfg.tables.length ? cfg.tables : frontier(snap);
  const uni = universe(T);
  const st = (k: string) => snap.get(k);
  const seen = (k: string) => (st(k)?.attempts ?? 0) > 0;
  const R = (k: string) => (seen(k) ? retrievability(st(k)!, nowIso) : 0);
  const isDue = (k: string) => { const s = st(k); return !!s && s.attempts > 0 && (!s.nextDueAt || s.nextDueAt <= nowIso); };
  const pr = (k: string) => { const s = st(k); const f = parseKey(k)!; return pCorrect(theta, s ? s.elo : bPrior(f.a, f.b)); };
  // weakest first: lowest recall probability now, recent errors and the tables that are hard for everyone count for more
  const weakness = (k: string) => { const s = st(k)!; return (1 - R(k)) * 100 + (4 - s.thaw) * 40 + (s.hist.slice(-2).includes("w") ? 60 : 0) + s.D * 10; };
  const weak = uni.filter((k) => seen(k) && (st(k)!.thaw < 3 || isDue(k))).sort((p, q) => weakness(q) - weakness(p) || (p < q ? -1 : 1));
  const unseen = uni.filter((k) => !seen(k));
  const nxt = pinned || cfg.calm ? null : nextTableAfter(T);
  const stretch = nxt ? universe([nxt]).filter((k) => !uni.includes(k)) : [];

  const n = cfg.n;
  const nReview = n >= 8 && !cfg.calm ? 1 : 0, nEasy = Math.round(n * 0.25), nHard = cfg.calm ? Math.round(n * 0.1) : Math.round(n * 0.17);
  const nTarget = n - nReview - nEasy - nHard;
  const chosen: string[] = [];
  // success-rate steering (target 80-90%): cruising above the band opens more new facts, struggling below it closes the door
  let newLeft = Math.max(0, cfg.maxNew + (rolling !== null && rolling > cfg.target[1] + 0.03 ? 2 : 0) - (rolling !== null && rolling < cfg.target[0] - 0.05 ? Math.min(cfg.maxNew, 3) : 0));
  const take = (pool: string[], count: number, shuffled: boolean) => {
    for (const k of shuffled ? rng.shuffle(pool) : pool) {
      if (count <= 0) break;
      if (chosen.includes(k)) continue;
      if (!seen(k)) { if (newLeft <= 0) continue; newLeft--; }
      chosen.push(k); count--;
    }
    return count;
  };
  const secure = uni.filter((k) => seen(k) && st(k)!.thaw >= 2);
  // 1 spaced review of an old, secure fact that is fading
  take(secure.filter((k) => isDue(k) || R(k) < 0.9).sort((p, q) => R(p) - R(q)), nReview, false);
  // the target block: what is weak/due comes back first, then facts the child should get right about 80-90% of the time
  const inBand = uni.filter((k) => seen(k) && !weak.includes(k) && pr(k) >= 0.7 && pr(k) <= 0.93);
  let left = take(weak, nTarget, false);
  left = take(inBand, left, true);
  left = take(unseen.filter((k) => pr(k) >= 0.45), left, true);
  // confidence builders: facts the child already gets right
  let easyLeft = take(secure.filter((k) => pr(k) > 0.9 || st(k)!.thaw >= 3), nEasy, true);
  // stretch: the next table (or new / hard facts inside the current ones)
  const nStretch = nStretchFor(cfg, stretch.length, nHard);
  let hardLeft = take(stretch, nStretch, true) + (nHard - nStretch);
  hardLeft = take(unseen, hardLeft, true);
  easyLeft = take(secure, easyLeft, true);
  // whatever is still missing (small pools, capped new facts): weak, then anything, repeats last (spaced by the interleave below)
  take(weak, n - chosen.length, false); take(secure, n - chosen.length, true); take(uni, n - chosen.length, true);
  for (let guard = 0; chosen.length < n && guard < 400; guard++) chosen.push(chosen[guard % Math.max(1, chosen.length)] ?? uni[0]!);
  void left; void hardLeft; void easyLeft;

  // interleave: no fact twice in a row, no table three times running
  const order = rng.shuffle(chosen);
  const tableOf = (k: string) => parseKey(k)!;
  for (let i = 1; i < order.length; i++) {
    const p1 = order[i - 1]!, p2 = i > 1 ? order[i - 2]! : "";
    const bad = (cand: string) => {
      if (cand === p1) return true;
      const c = tableOf(cand);
      return !!p2 && [c.a, c.b].some((t) => [tableOf(p1), tableOf(p2)].every((p) => p.a === t || p.b === t));
    };
    if (!bad(order[i]!)) continue;
    for (let j = i + 1; j < order.length; j++) if (!bad(order[j]!)) { [order[i], order[j]] = [order[j]!, order[i]!]; break; }
  }
  const formOf = (): Form => { const others = cfg.forms.filter((f) => f !== "x"); return others.length && rng.next() < 0.4 ? others[rng.int(0, others.length - 1)]! : "x"; };
  const items: PlanItem[] = order.map((k) => ({ k, o: formOf(), f: rng.next() < 0.5 ? 0 : 1 }));
  // boss gates: the weakest two facts move to the middle and the end (never in calm / short runs)
  if (!cfg.calm && n >= 10) {
    const slots = [Math.floor(n / 2) - 1, n - 1];
    const ranked = [...new Set(items.map((i) => i.k))].sort((p, q) => (st(q) ? weakness(q) : 0) - (st(p) ? weakness(p) : 0) || (p < q ? -1 : 1));
    slots.forEach((slot, idx) => {
      const k = ranked[idx]; if (!k) return;
      const at = items.findIndex((i, j) => i.k === k && !items[j]!.boss && j !== slots[1 - idx]);
      if (at >= 0 && at !== slot) [items[at], items[slot]] = [items[slot]!, items[at]!];
      items[slot] = { ...items[slot]!, boss: 1 };
    });
  }
  // boss placement can re-create neighbours: fix any fact twice in a row by swapping with a later non-boss slot (boss flags stay on their slots)
  for (let pass = 0; pass < 3; pass++) for (let i = 1; i < items.length; i++) {
    if (items[i]!.k !== items[i - 1]!.k) continue;
    for (let j = 0; j < items.length; j++) {
      if (j === i || j === i - 1 || items[j]!.boss || items[i]!.boss && false) continue;
      const a = items[i]!, b = items[j]!;
      const okHere = (idx: number, k: string) => items[idx - 1]?.k !== k && items[idx + 1]?.k !== k;
      if (a.boss && b.boss) continue;
      if (okHere(i, b.k) && okHere(j, a.k)) { const ka = { k: a.k, o: a.o, f: a.f }; a.k = b.k; a.o = b.o; a.f = b.f; b.k = ka.k; b.o = ka.o; b.f = ka.f; break; }
    }
  }
  // rescue: easy wins to slide in after struggling (secure facts first, then the friendliest tables)
  const easy = [...secure].concat(universe([2, 5, 10])).filter((k, i, a) => a.indexOf(k) === i).slice(0, 12);
  const rescue = rng.shuffle(easy).slice(0, 3).map((k) => ({ k, o: "x" as Form, f: 0 as const }));
  return { v: CORE_VERSION, items, rescue, tables: T, allGold: weak.length === 0 && unseen.length === 0, unseen: unseen.length };
}
const nStretchFor = (cfg: Cfg, avail: number, nHard: number) => (cfg.pinned.length || cfg.calm || !avail ? 0 : Math.min(nHard, Math.max(1, Math.round(nHard / 2))));

/** Never trust a plan that arrives from outside: keep only well-formed items. */
export function cleanPlan(raw: unknown): Plan | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<Plan>;
  const ok = (i: unknown): i is PlanItem => !!i && typeof i === "object" && typeof (i as PlanItem).k === "string" && !!parseKey((i as PlanItem).k) && ((i as PlanItem).o === "x" || (i as PlanItem).o === "d" || (i as PlanItem).o === "m") && ((i as PlanItem).f === 0 || (i as PlanItem).f === 1);
  if (!Array.isArray(p.items) || p.items.length < 1 || p.items.length > 60 || !p.items.every(ok)) return null;
  const items = p.items.map((i) => ({ k: i.k, o: i.o, f: i.f, ...(i.boss ? { boss: 1 as const } : {}), ...(typeof i.fam === "number" ? { fam: i.fam } : {}), ...(i.combo ? { combo: 1 as const } : {}), ...(i.d === 0 || i.d === 1 ? { d: i.d } : {}) }));
  const rescue = Array.isArray(p.rescue) ? p.rescue.filter(ok).slice(0, 6).map((i) => ({ k: i.k, o: i.o, f: i.f })) : [];
  return { v: CORE_VERSION, items, rescue, tables: Array.isArray(p.tables) ? p.tables.filter((x) => Number.isInteger(x)).slice(0, 12) : [], allGold: !!p.allGold, unseen: Number(p.unseen) || 0 };
}

// ─── Gate content: the question and its lane options ─────────────────────────────────────────────────────────────────────────────────────

export interface Gate {
  serial: number; k: string; op: Form; a: number; b: number; /** what is shown: 7 x 8 | 56 / 7 | ? x 8 = 56 (m: shownA = the known factor, shownB = the product) */ shownA: number; shownB: number; /** the divisor / known factor (0 for x) */ aux: number;
  answer: number; opts: (number | null)[]; correctLane: number; boss: boolean; rq: number;
  shownTick: number; gd: number; touched: boolean; firstInputTick: number; lane: number; stable: number; enterTick: number; locked: boolean; actLane: number;
  hinted: boolean; star: boolean;
  /** perm[lane] = which option sits in that lane right now (moving gates rotate it until the child commits). */ perm: number[]; frozen: boolean; combo: boolean; fam: number;
}
const swapDigits = (n: number) => (n >= 10 ? Number(String(n).split("").reverse().join("")) : n);

/** Options for a gate: the answer plus real misconceptions (adjacent multiples, digit swap, add-instead-of-multiply). Always distinct, positive. */
export function makeOptions(op: Form, a: number, b: number, lanes: number, rng: Rng, forceAux: -1 | 0 | 1 = -1): { answer: number; opts: number[]; correctLane: number; aux: number } {
  const p = a * b;
  let answer: number; let bad: number[]; let more: number[]; let aux = 0;
  if (op === "x") {
    answer = p;
    bad = rng.shuffle([p + a, p - a, p + b, p - b]);
    more = rng.shuffle([swapDigits(p), a + b, p + 10, p - 10, p + 1, p - 1, a * (b + 2), a * Math.max(1, b - 2)]);
  } else {
    // d: a x b = p asked as p / a (or / b). m: asked as ? x a = p (or ? x b = p). Either way the answer is the OTHER factor.
    aux = forceAux >= 0 ? (forceAux === 0 ? Math.min(a, b) : Math.max(a, b)) : rng.next() < 0.5 ? a : b; answer = aux === a ? b : a;
    bad = rng.shuffle([answer + 1, answer - 1, aux, answer + 2, answer - 2]);
    more = rng.shuffle([op === "d" ? p - aux : aux + answer + 1, answer + 3, answer * 2, Math.max(1, answer - 3)]);
  }
  const seen = new Set<number>([answer]);
  const picked: number[] = [];
  const add = (n: number) => { if (n > 0 && !seen.has(n) && Number.isFinite(n)) { seen.add(n); picked.push(n); } };
  for (const n of bad) { if (picked.length >= Math.min(2, lanes - 1)) break; add(n); }
  for (const n of [...more, ...bad]) { if (picked.length >= lanes - 1) break; add(n); }
  for (let d = 1; picked.length < lanes - 1 && d < 40; d++) add(answer + d * (d % 2 ? 1 : -1));
  const opts = rng.shuffle([answer, ...picked.slice(0, lanes - 1)]);
  return { answer, opts, correctLane: opts.indexOf(answer), aux };
}
/** For the "fact to look at" card: a strategy that turns a hard fact into easy ones. `id` picks a translated template. */
export function strategyFor(a: number, b: number): { id: "double" | "double2" | "near10" | "five" | "ten2" | "swap"; a: number; b: number; x: number; y: number; t: number } {
  const lo = Math.min(a, b), hi = Math.max(a, b), t = a * b;
  if (lo === 2) return { id: "double", a: hi, b: 2, x: hi, y: hi, t };
  if (lo === 4) return { id: "double2", a: hi, b: 4, x: hi * 2, y: hi * 4, t };
  if (lo === 9) return { id: "near10", a: hi, b: 9, x: hi * 10, y: hi, t };
  if (lo === 11) return { id: "near10", a: hi, b: 11, x: hi * 10, y: hi, t };
  if (lo === 12) return { id: "ten2", a: hi, b: 12, x: hi * 10, y: hi * 2, t };
  if (lo >= 6 && lo <= 8) return { id: "five", a: hi, b: lo, x: hi * 5, y: hi * (lo - 5), t };
  return { id: "swap", a: hi, b: lo, x: hi, y: lo, t };
}

// ─── The simulation ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
//
// A run is a string of LEGS. Each leg is: TRAVEL (real sliding: carve, dodge, flop, jump, tricks, chase fish; nothing about maths and never a clock on
// thinking) -> LEDGE (the gate: Percy skids to a stop and the answers are objects in the world; untimed) -> CONSEQUENCE (a correct answer physically opens
// the route: bridge / launch ramp / crystal door / whale; a wrong one takes the slower scenic detour and a sign shows the fact). Objects live in DISTANCE
// space (`dist`), so anything that slows Percy really delays him. Everything below is integer / + - * / arithmetic and seeded rng: it replays on the server.

export const laneCenter = (lane: number, lanes: number) => -1 + (2 * lane + 1) / lanes;
export const laneOf = (x: number, lanes: number) => Math.max(0, Math.min(lanes - 1, Math.floor(((x + 1) * lanes) / 2)));

// Tuned for "ice": low drag = momentum, a little bounce off the walls.
export const ACC = 0.0007;      // per tick per steer unit
export const DRAG = 0.96;       // velocity kept each tick
export const DRAG_STUN = 0.9;
export const WALL = 0.92;
const SNAP_K = 0.2; // ~170 ms to 90% of a lane change (docs A rule 6)
const LOCK_TICKS = 14;
const SETTLE_V = 0.0035;
export const SPAWN_D = 34;
export const HOVER_D = 9;
const RUSH = 0.8;
const RUSH_CALM = 0.42;
const FB_CORRECT = 70, FB_WRONG = 135, FB_MISS = 48, FINISH_TICKS = 150, FINISH_BOSS = 270; // a wrong fact stays up for >= 2 s (docs C R8)
const FAR = 0.3, DRIFT = 0.035, DRIFT_CALM = 0.016;
export const MAX_TICKS = TICK_HZ * 60 * 25;

// travel tunables (all in ticks / distance units; the renderer reads a few of them)
export const V_TRAVEL = 0.34;
const LEG_D = 106, LEG_INTRO = 72, LEG_DETOUR = 150, LEG_CALM = 40;
export const FLOP_TICKS = 22, FLOP_CD = 66, BOOST_TICKS = 38, AIR_TICKS = 52, AIR_BIG = 100, TRICK_CD = 12, TRICK_MIN_AIR = 8;
const LIGHT_DECAY = 0.0006, WIND_MAX = 0.0012, WIND_BLOCK = 150;

export type Power = "star" | "hint" | "shield";
/** fish/sky (aerial fish: only while airborne)/bag (secret stash) | drift (soft: slows; a belly-flop smashes it) | rock/ball (hard: stun + drops fish) | pad (boost) | ramp (launch)
 *  | crystal (lantern refill) | ring (aurora ring) | span (the set piece the last answer decided) | sign (the wrong-answer signpost) | star/hint/shield helper pickups */
export type ObjKind = "fish" | "sky" | "bag" | "friend" | "drift" | "rock" | "ball" | "pad" | "ramp" | "crystal" | "ring" | "span" | "star" | "hint" | "shield";
export interface Obj { kind: ObjKind; x: number; d: number; /** half-width */ w: number; /** value (fish) */ v: number; open?: boolean; got?: boolean; /** the set piece it belongs to (for tuning) */ src?: string }
export interface Sign { d: number; op: Form; a: number; b: number; shownA: number; shownB: number; answer: number; aux: number }
export interface Result { i: number; k: string; op: Form; a: number; b: number; /** the divisor / known factor shown (0 for x) */ aux: number; shown: string; answer: number; chosen: number | null; err: string | null; lane: number; correct: boolean; miss: boolean; latencyTicks: number; boss: boolean; guess: boolean; requeue: boolean; tick: number; fish: number; shielded: boolean; late: boolean; fam: number }
export type SimEvent =
  | { t: "gate"; g: Gate } | { t: "correct"; r: Result; streak: number; mult: number } | { t: "wrong"; r: Result; shielded: boolean } | { t: "miss"; r: Result }
  | { t: "fish"; x: number; v: number } | { t: "power"; kind: Power } | { t: "powerUse"; kind: Power | "freeze" } | { t: "bump"; x: number } | { t: "lock" } | { t: "unlock" } | { t: "shift" }
  | { t: "breath" } | { t: "strategy"; k: string } | { t: "finish" } | { t: "done" } | { t: "mult"; mult: number } | { t: "requeue"; k: string } | { t: "chase"; pos: number } | { t: "caught" }
  | { t: "leg"; route: "open" | "detour" | "none" } | { t: "ledge" } | { t: "hit"; kind: ObjKind; x: number; lost: number; src?: string } | { t: "smash"; x: number } | { t: "boost"; x: number }
  | { t: "launch"; big: boolean } | { t: "trick"; n: number } | { t: "land"; tricks: number } | { t: "flop" } | { t: "span"; open: boolean; biome: number } | { t: "ring"; x: number }
  | { t: "crystal"; x: number } | { t: "bag"; x: number } | { t: "rescue"; x: number } | { t: "friendSave"; x: number } | { t: "ringGate"; open: boolean; got: number; of: number } | { t: "throw"; x: number } | { t: "phase"; n: 1 | 2 | 3 } | { t: "defeat" } | { t: "wind"; w: number };

interface QItem { k: string; o: Form; f: 0 | 1; boss: boolean; rq: number; fam: number; combo: boolean; d: -1 | 0 | 1 }
/** A boss stage's boss starts this far away. A wrong answer lets it advance; right answers push it back and FILL ITS WEAK SPOT. It never moves with TIME. */
export const CHASE_START = 5, CHASE_HIT = 2, CHASE_GAIN = 0.75;
/** The weak spot is full (the boss is beaten) when this share of the stage's questions were answered right. */
export const BOSS_NEED = 0.75;
export const bossNeed = (n: number) => Math.max(1, Math.ceil(n * BOSS_NEED));
const SHIFT_TICKS = 32;
export interface Sim {
  cfg: Cfg; seed: number; plan: Plan; emit: boolean; ev: SimEvent[];
  tick: number; x: number; vx: number; target: number; lastSteer: number; stun: number; dist: number; speed: number;
  phase: "travel" | "approach" | "feedback" | "finish" | "done"; phaseLeft: number;
  queue: QItem[]; gate: Gate | null; serial: number; resolved: number; requeues: number; reqCount: Record<string, number>; rescueUsed: number;
  results: Result[]; pace: number[]; streak: number; bestStreak: number; mult: number; wrongRun: number; fastWrong: number;
  fish: number; activeTicks: number; easeLeft: number; recent: boolean[]; starNext: boolean; hintNext: boolean; shield: boolean; timeouts: number; wallBumps: number;
  /** helpers: run charges from the loadout, how many times a helper was USED (costs the 3rd star, never anything else), magnet, boss chaser */
  charges: { hint: number; freeze: number }; helpUsed: number; shieldTaken: boolean; magnet: boolean; chase: number; caught: boolean;
  // ── the travel game
  objs: Obj[]; leg: number; legEnd: number; detour: boolean; sign: Sign | null; route: "open" | "detour" | "none";
  flop: number; flopCd: number; /** invulnerable ticks after a hit (Percy blinks) */ inv: number; boost: number; slow: number; air: number; airMax: number; tricks: number; trickCd: number; light: number; windOff: boolean; wind: number;
  hits: number; fishLost: number; tricksTotal: number; smashes: number; bags: number; bagPlaced: boolean; bossFill: number; bossPhase: 1 | 2 | 3; bossDown: boolean;
  // ── v3: a rescued friend who helps for the rest of the run, the Serpent's ring gate, the Yeti's division aim, hand-authored set pieces
  friend: boolean; friendPlaced: boolean; friendSaved: boolean; legRings: number; legRingsGot: number; sealed: number; aim: number | null; pieces: number; scriptAt: number; lastPiece: string;
}

const stageIdx = (c: Cfg) => { const m = /^b\d+s(\d)$/.exec(c.stage ?? ""); return m ? +m[1]! : 2; };

export function newSim(seed: number, cfg: Cfg, plan: Plan, emit = false): Sim {
  const has = (p: PowerId) => cfg.loadout.includes(p);
  const s: Sim = {
    cfg, seed: seed >>> 0 || 1, plan, emit, ev: [], tick: 0, x: 0, vx: 0, target: 1, lastSteer: 0, stun: 0, dist: 0, speed: 0.11,
    phase: "travel", phaseLeft: 0, queue: plan.items.map((i) => ({ k: i.k, o: i.o, f: i.f, boss: !!i.boss, rq: 0, fam: i.fam ?? -1, combo: !!i.combo, d: i.d ?? -1 })), gate: null, serial: 0, resolved: 0, requeues: 0, reqCount: {}, rescueUsed: 0,
    results: [], pace: [], streak: 0, bestStreak: 0, mult: 1, wrongRun: 0, fastWrong: 0, fish: 0, activeTicks: 0, easeLeft: 0, recent: [], starNext: false, hintNext: false, shield: has("shield"), timeouts: 0, wallBumps: 0,
    charges: { hint: has("hint") ? POWERS.find((p) => p.id === "hint")!.charges : 0, freeze: has("freeze") ? POWERS.find((p) => p.id === "freeze")!.charges : 0 }, helpUsed: has("radar") ? 1 : 0, shieldTaken: has("shield"), magnet: has("magnet"), chase: cfg.chaser ? CHASE_START : 0, caught: false,
    objs: [], leg: 0, legEnd: 0, detour: false, sign: null, route: "none", flop: 0, flopCd: 0, inv: 0, boost: 0, slow: 0, air: 0, airMax: AIR_TICKS, tricks: 0, trickCd: 0, light: 1, windOff: false, wind: 0,
    hits: 0, fishLost: 0, tricksTotal: 0, smashes: 0, bags: 0, bagPlaced: false, bossFill: 0, bossPhase: 1, bossDown: false,
    friend: false, friendPlaced: false, friendSaved: false, legRings: 0, legRingsGot: 0, sealed: 0, aim: null, pieces: 0, scriptAt: 0, lastPiece: "",
  };
  s.x = cfg.calm ? laneCenter(s.target, cfg.lanes) : 0;
  startLeg(s, "none");
  return s;
}

const cruise = (s: Sim) => (SPAWN_D / (Math.max(1, s.cfg.approachSec) * TICK_HZ));
const push = (s: Sim, e: SimEvent) => { if (s.emit) s.ev.push(e); };
const windBlock = (seed: number, k: number) => (mix(seed, 900 + k) % 3) - 1;
/** Storm Pass / Summit: gusts push Percy sideways (a gust builds and fades linearly; deterministic from the seed). Not while he waits on the ledge. */
export function windNow(s: Pick<Sim, "cfg" | "seed" | "tick" | "windOff">): number {
  const c = s.cfg; if (c.calm || s.windOff || (c.biome !== 4 && c.biome !== 5)) return 0;
  const k = Math.floor(s.tick / WIND_BLOCK), f = (s.tick % WIND_BLOCK) / WIND_BLOCK;
  const a = windBlock(s.seed, k), b = windBlock(s.seed, k + 1);
  return (a + (b - a) * f) * WIND_MAX * (c.biome === 5 && !c.chaser ? 0.6 : 1);
}

function spawnGate(s: Sim) {
  const q = s.queue[0];
  if (!q) return;
  const f = parseKey(q.k)!;
  const rng = makeRng(mix(s.seed, s.serial * 3 + 1));
  const { answer, opts, correctLane, aux } = makeOptions(q.o, f.a, f.b, s.cfg.lanes, rng, q.d);
  // shown: x -> the two factors (either way round); d -> dividend and divisor; m -> the KNOWN factor and the product ("? x known = product")
  const shown = q.o === "x" ? (q.f ? [f.b, f.a] : [f.a, f.b]) : q.o === "d" ? [f.a * f.b, aux] : [aux, f.a * f.b];
  const lane = laneOf(s.x, s.cfg.lanes);
  if (s.cfg.mod === "mirror") opts.reverse(); // today's safe modifier: the lanes are mirrored (same answers, other way round)
  const cl = s.cfg.mod === "mirror" ? opts.indexOf(answer) : correctLane;
  const g: Gate = {
    serial: s.serial++, k: q.k, op: q.o, a: f.a, b: f.b, shownA: shown[0]!, shownB: shown[1]!, aux, answer, opts: [...opts], correctLane: cl, boss: q.boss, rq: q.rq,
    shownTick: s.tick, gd: SPAWN_D, touched: false, firstInputTick: -1, lane, stable: 0, enterTick: s.tick, locked: false, actLane: -1, hinted: false, star: false,
    perm: opts.map((_, i) => i), frozen: false, combo: q.combo, fam: q.fam,
  };
  // struggling (2 wrong in the last 3) or a first-ever run: quietly take one wrong lane away for a few gates. Nothing is announced (docs A: session DDA guard).
  const eased = (s.easeLeft > 0 || (s.cfg.tutorial && s.resolved < 3)) && !s.hintNext;
  if (eased) { s.easeLeft = Math.max(0, s.easeLeft - 1); const wl = opts.map((_, i) => i).filter((i) => i !== cl); g.opts[wl[makeRng(mix(s.seed, g.serial * 3 + 2)).int(0, wl.length - 1)]!] = null; g.hinted = true; }
  if (s.hintNext) {
    const wrongLanes = opts.map((_, i) => i).filter((i) => i !== cl);
    const drop = wrongLanes[makeRng(mix(s.seed, g.serial * 3 + 2)).int(0, wrongLanes.length - 1)]!;
    g.opts[drop] = null; g.hinted = true; s.hintNext = false; push(s, { t: "powerUse", kind: "hint" }); // found in the world, not chosen: no cost
  }
  if (s.starNext) { g.star = true; s.starNext = false; push(s, { t: "powerUse", kind: "star" }); }
  s.gate = g; s.phase = "approach";
  push(s, { t: "gate", g });
}

const insertAt = (s: Sim, item: QItem, rng: Rng) => {
  const pos = Math.min(s.queue.length, 3 + rng.int(0, 3) - 1); // 3-6 items later: index 2..5 of what is left after the current one
  s.queue.splice(Math.max(0, pos), 0, item);
};

// ── the level: one authored-feeling leg per question, generated from the seed ──────────────────────────────────────────────────────────────

type Table = [string, number][];
/** Pattern weights per world: each world leans on its own rule (glacier: drifts + flop; aurora: ramps; caves: crystals + stalactites; storm: wind + floes; summit: forks). */
const PATTERNS: Record<number, Table> = {
  1: [["trail", 46], ["drift", 30], ["pad", 16], ["pair", 8]],
  2: [["trail", 26], ["ramp", 34], ["drift", 12], ["pad", 12], ["pair", 16]],
  3: [["trail", 20], ["crystal", 22], ["rocks", 34], ["drift", 10], ["pad", 8], ["pair", 6]],
  4: [["trail", 28], ["drift", 18], ["pair", 22], ["pad", 16], ["rocks", 16]],
  5: [["trail", 14], ["fork", 22], ["ramp", 16], ["rocks", 16], ["pair", 16], ["crystal", 8], ["pad", 8]],
};
const pickFrom = (rng: Rng, t: Table): string => { let tot = 0; for (const [, w] of t) tot += w; let r = rng.next() * tot; for (const [n, w] of t) { r -= w; if (r < 0) return n; } return t[0]![0]; };
const clampX = (x: number) => Math.max(-0.86, Math.min(0.86, x));
/** A rock that always leaves the straight line through `gap` clear (>= 0.5 to one side, on the side with more room): a group of rocks is never a wall, so it can always be dodged by holding the gap. */
const rockAround = (rng: Rng, gap: number): number => { let side = rng.next() < 0.5 ? -1 : 1; const off = 0.5 + rng.int(0, 4) / 10; if (Math.abs(gap + side * off) > 0.86) side = -side; return clampX(gap + side * off); };

/** Build the objects of the next leg and set where its gate arrives. `route` is what the LAST answer decided (open: the set piece is a reward; detour: scenic + a sign). */
function startLeg(s: Sim, route: "open" | "detour" | "none") {
  const c = s.cfg; const rng = makeRng(mix(s.seed, 7000 + s.leg * 17)); const first = s.leg === 0; s.leg++; s.legRings = 0; s.legRingsGot = 0;
  const d0 = s.dist; const detour = route === "detour"; s.detour = detour; s.windOff = false; s.route = route; s.phase = "travel";
  const big = route === "open" && (c.biome === 2 || c.biome === 5) && !c.calm;
  const lead = first ? 14 : detour ? 44 : big ? 58 : 32;
  const len = c.calm ? LEG_CALM : first ? LEG_INTRO : detour ? LEG_DETOUR : LEG_D;
  s.legEnd = d0 + lead + len;
  const add = (kind: ObjKind, x: number, d: number, w = 0.16, v = 1) => { if (kind === "ring") s.legRings++; s.objs.push({ kind, x: clampX(x), d, w, v }); };
  const trail = (x0: number, x1: number, d: number, n = 6, sp = 3.2, kind: ObjKind = "fish", v = 1) => { for (let i = 0; i < n; i++) add(kind, x0 + ((x1 - x0) * i) / Math.max(1, n - 1), d + i * sp, 0.1, v); };
  // the set piece the last answer decided
  if (route !== "none" && !c.calm) {
    if (route === "detour") { s.objs.push({ kind: "span", x: 0, d: d0 + 27, w: 1, v: 0, open: false }); }
    else {
      s.objs.push({ kind: "span", x: 0, d: d0 + 16, w: 1, v: 0, open: true });
      if (big) { for (let i = 0; i < 11; i++) add("sky", (i % 4 === 0 ? -0.5 : i % 4 === 1 ? 0 : i % 4 === 2 ? 0.5 : 0), d0 + 22 + i * 3.4, 0.14, 1); }
      else trail(0, 0, d0 + 20, 6, 3, "fish", 1);
    }
  } else if (route !== "none") s.objs.push({ kind: "span", x: 0, d: d0 + 16, w: 1, v: 0, open: route === "open" });
  const ei = stageIdx(c), df = c.stage ? (ei - 1) / 3 : 0.4, bossy = !!c.chaser;
  // patterns along the leg
  const a = d0 + lead + (first ? 4 : 2), b = s.legEnd - 5;
  if (c.calm) { trail(rng.int(-6, 6) / 10, rng.int(-6, 6) / 10, a + 6, 6, 4); trail(0, 0, s.legEnd - 4, 4, 3.4); }
  else {
    const v3 = isV3(c);
    const table = v3 && !bossy ? [...(PATTERNS[c.biome] ?? PATTERNS[1]!), ["set", 26] as [string, number]] : PATTERNS[c.biome] ?? PATTERNS[1]!;
    const script = v3 && !bossy && !first && c.stage ? STAGE_SCRIPT[c.stage] : undefined;
    const putPiece = (id: string | null, at: number): number => { // a hand-authored set piece (config.ts): the stage script names it, or the world picks from its own pool
      const pool = setPiecesOf(c.biome).filter((q) => q.id !== s.lastPiece); const pc = (id ? setPiecesOf(c.biome).find((q) => q.id === id) : null) ?? pool[rng.int(0, pool.length - 1)];
      if (!pc || at + setPieceLen(pc) > b - 6) return -1;
      const mir = rng.next() < 0.5; for (const it of setPieceItems(pc, mir)) { add(it.kind, it.x, at + it.d, it.w, it.v); s.objs[s.objs.length - 1]!.src = pc.id; }
      s.lastPiece = pc.id; s.pieces++; return setPieceLen(pc) + 10;
    };
    const hazardScale = 0.55 + df * 0.7 + (detour ? 0.35 : 0);
    for (let d = a; d < b - 4;) {
      let name: string;
      if (script && d === a && s.scriptAt < script.length) { const adv = putPiece(script[s.scriptAt]!, d); if (adv > 0) { s.scriptAt++; d += adv; continue; } } // the stage's own opening beats are hand-made
      if (bossy && rng.next() < (c.chaser === "whiteout" ? 0.5 : 0.7)) name = "wave"; else name = pickFrom(rng, table); // the last boss mixes every attack, so its waves come a little less often
      if ((name === "rocks" || name === "pair" || name === "fork") && rng.next() > hazardScale + (c.biome >= 3 ? 0.25 : 0) - (c.biome === 1 && ei < 3 ? 0.5 : 0)) name = "trail";
      if (first && (name === "rocks" || name === "pair")) name = "trail";
      if (bossy && (name === "rocks" || name === "pair" || name === "fork")) name = "trail"; // on a boss run the hazards ARE the boss's attacks: nothing else is added on top
      const gx = rng.int(-6, 6) / 10; // a gap / centre for this beat
      if (name === "set") { const adv = putPiece(null, d); if (adv > 0) { d += adv; continue; } name = "trail"; }
      if (name === "trail") { const x0 = rng.int(-7, 7) / 10; trail(x0, x0 + rng.int(-5, 5) / 10, d, 6, 3.2); d += 22; }
      else if (name === "drift") { add("drift", gx, d, 0.21); if (rng.next() < 0.5) add("drift", gx + (gx > 0 ? -0.5 : 0.5), d + 3, 0.21); trail(gx, gx, d + 5, 3, 2.6); d += 14; }
      else if (name === "pad") { add("pad", gx, d, 0.22); trail(gx, gx, d + 5, 5, 3, "fish", 1); d += 20; }
      else if (name === "pair") { add("rock", gx - 0.62, d, 0.17); add("rock", gx + 0.62, d, 0.17); trail(gx, gx, d - 4, 5, 2.2); d += 14; }
      else if (name === "rocks") { const n = 2 + (df > 0.5 ? 1 : 0); for (let i = 0; i < n; i++) add("rock", rockAround(rng, gx), d + i * 4.5, 0.15); trail(gx, gx, d - 3, 3, 1.4); d += n * 4.5 + 8; }
      else if (name === "ramp") { add("ramp", gx, d, 0.26); for (let i = 0; i < 9; i++) add("sky", (i % 3 === 0 ? -0.4 : i % 3 === 1 ? 0.05 : 0.45), d + 4 + i * 2.6, 0.14, 1); d += 34; }
      else if (name === "crystal") { add("crystal", gx, d, 0.24); trail(gx, gx, d + 4, 4, 2.6); d += 16; }
      else if (name === "fork") { // Summit: a gentle side (left) and a steep, rewarding side (right); the child chooses by where they steer
        trail(-0.6, -0.6, d, 5, 3); add("rock", 0.55, d + 6, 0.17); add("rock", 0.25, d + 12, 0.15); trail(0.6, 0.6, d, 3, 3, "fish", 2); add("pad", 0.62, d + 16, 0.2); trail(0.62, 0.62, d + 20, 4, 2.6, "fish", 2); d += 28;
      } else if (name === "wave") { bossWave(s, add, trail, rng, d); d += waveExtent(s.cfg.chaser, s.bossPhase) + 16 + (s.bossPhase >= 3 ? 6 : 0); } // the next wave starts >= 0.7 s after the last object of this one (waves never overlap: the gaps must be reachable)
      else d += 12;
    }
    trail(0, 0, s.legEnd - 2, 4, 3.4); // a last line of fish leading in to the ledge
    // a friend frozen in ice: crack it with a belly-flop and they help for the rest of the run, then move into the Igloo Village
    if (v3 && !s.friendPlaced && !bossy && s.leg >= 4) { s.friendPlaced = true; const fx = (rng.next() < 0.5 ? -1 : 1) * 0.3, fd = a + (b - a) * 0.42; trail(fx, fx, fd - 12, 4, 2.4); add("friend", fx, fd, 0.22, 1); }
    // a secret: one stash per stage, at the edge, guarded, reached by skilled sliding (no maths penalty for skipping it)
    if (!s.bagPlaced && !bossy && s.leg >= 3) { s.bagPlaced = true; const side = rng.next() < 0.5 ? -1 : 1; const bd = a + (b - a) * 0.55; add("rock", side * 0.55, bd - 8, 0.15); add("bag", side * 0.88, bd, 0.2, 8); }
  }
  s.objs.sort((p, q) => p.d - q.d);
}

/** How far (in distance units) past its start a wave still has objects: the boss's next wave is placed after this + a recovery breath. */
function waveExtent(k: ChaserKind | null, ph: 1 | 2 | 3): number {
  if (k === "avalanche") return ph >= 2 ? 12 : 0;
  if (k === "serpent") return ph === 1 ? (4 + ph - 1) * 5 : ph === 2 ? (4 + ph) * 5 + 4 : (4 + ph) * 5 + 16;
  if (k === "cavein") return (1 + ph) * 5.2;
  if (k === "blizzard") return ph >= 3 ? 24 : ph >= 2 ? 12 : 5;
  return ph >= 3 ? 20 : ph >= 2 ? 14 : 0;
}

/** Boss attack waves, by boss and phase (1 gentle .. 3 fierce). Every wave leaves a gap you can see and steer into. */
function bossWave(s: Sim, add: (k: ObjKind, x: number, d: number, w?: number, v?: number) => void, trail: (x0: number, x1: number, d: number, n?: number, sp?: number, kind?: ObjKind, v?: number) => void, rng: Rng, d: number) {
  const ph = s.bossPhase; const k = s.cfg.chaser;
  let gap = rng.int(-4, 4) / 10;
  if (isV3(s.cfg) && k === "blizzard" && s.aim !== null) { gap = Math.max(-0.45, Math.min(0.45, s.aim)); s.aim = null; } // Yeti division-aim: the counter-throw you aimed opens the corridor where you stand
  /** balls flank a gap you can see and steer into (>= 0.7 wide): the fierce phases add a second gap a little way off */
  const flank = (kind: ObjKind, g: number, dd: number, n = 2) => { for (let i = 0; i < n; i++) { add(kind, g - 0.64 - i * 0.5, dd, 0.2); add(kind, g + 0.64 + i * 0.5, dd, 0.2); } };
  if (k === "avalanche") { flank("ball", gap, d); if (ph >= 2) flank("ball", Math.max(-0.4, Math.min(0.4, gap + (rng.next() < 0.5 ? 0.3 : -0.3))), d + 12); trail(gap, gap, d - 3, 3, 1.5); }
  else if (k === "serpent") { for (let i = 0; i < 4 + ph; i++) add("ring", -0.6 + ((i % 3) * 0.6), d + i * 5, 0.28, 3); if (ph >= 2) flank("ball", gap, d + (4 + ph) * 5 + 4, 1); if (ph >= 3) flank("ball", -gap, d + (4 + ph) * 5 + 16, 1); }
  else if (k === "cavein") { for (let i = 0; i < 2 + ph; i++) add("rock", rockAround(rng, gap), d + i * 5.2, 0.17); trail(gap, gap, d - 3, 3, 1.6); }
  else if (k === "blizzard") { const v3 = isV3(s.cfg); add("ball", v3 ? gap - 0.75 : -0.75, d, 0.2); add("ball", v3 ? gap + 0.75 : 0.75, d + 5, 0.2); if (ph >= 2) flank("ball", gap, d + 12, 1); if (ph >= 3) flank("ball", -gap, d + 24, 1); trail(gap * 0.5, gap * 0.5, d - 4, 3, 1.6); }
  else { // whiteout: everything at once
    flank(rng.next() < 0.5 ? "ball" : "rock", gap, d, 1);
    if (ph >= 2) { add("ring", -gap, d + 9, 0.28, 3); add("rock", gap + 0.6, d + 14, 0.17); }
    if (ph >= 3) flank("ball", Math.max(-0.4, Math.min(0.4, gap + (gap > 0 ? -0.3 : 0.3))), d + 20, 1); // the second corridor is never more than 0.3 away from the first
    trail(gap, gap, d - 3, 3, 1.6);
  }
}

const bossPhaseOf = (s: Sim): 1 | 2 | 3 => { const f = s.bossFill / bossNeed(s.plan.items.length); return f >= 0.67 ? 3 : f >= 0.34 ? 2 : 1; };

/** What Percy just ran into (or over): everything that happens because of WHERE he is, not what he answered. */
function collide(s: Sim, d0: number) {
  const c = s.cfg; const d1 = s.dist; if (d1 <= d0 && !s.objs.length) return;
  for (const o of s.objs) {
    if (o.got || o.d <= d0 || o.d > d1) continue;
    const dx = Math.abs(s.x - o.x);
    const air = s.air > 0;
    switch (o.kind) {
      case "fish": case "bag": {
        const reach = o.kind === "bag" ? o.w + 0.1 : (s.magnet ? 0.42 : s.friend ? 0.32 : 0.2); // a rescued friend reaches for fish too
        if (dx < reach) { o.got = true; s.fish += o.v; if (o.kind === "bag") { s.bags++; push(s, { t: "bag", x: o.x }); } else push(s, { t: "fish", x: o.x, v: o.v }); }
        break;
      }
      case "sky": if (air && dx < (s.magnet ? 0.42 : s.friend ? 0.34 : 0.24)) { o.got = true; s.fish += o.v; push(s, { t: "fish", x: o.x, v: o.v }); } break;
      case "star": case "hint": case "shield":
        if (dx < 0.26) { o.got = true; if (o.kind === "star") s.starNext = true; else if (o.kind === "hint") s.hintNext = true; else s.shield = true; push(s, { t: "power", kind: o.kind }); }
        break;
      case "drift":
        if (air) break;
        if (dx < o.w + 0.05) { o.got = true; if (s.flop > 0) { s.smashes++; s.fish += 1; push(s, { t: "smash", x: o.x }); } else { s.slow = 34; s.speed *= 0.55; push(s, { t: "hit", kind: "drift", x: o.x, lost: 0 }); } }
        break;
      case "rock": case "ball": {
        if (air || s.inv > 0) break;
        const dark = c.biome === 3 && s.light < 0.3;
        if (dx < o.w + 0.05 + (dark ? 0.08 : 0)) {
          o.got = true;
          if (s.friend && !s.friendSaved) { s.friendSaved = true; s.inv = 40; push(s, { t: "friendSave", x: o.x }); break; } // the friend takes the first bump (once per run): no stun, nothing dropped
 s.hits++; s.stun = 40; s.slow = 46; s.inv = 84; s.speed *= 0.4; const lost = Math.min(2, s.fish); s.fish -= lost; s.fishLost += lost;
          push(s, { t: "hit", kind: o.kind, x: o.x, lost, ...(o.src ? { src: o.src } : {}) });
        }
        break;
      }
      case "pad": if (dx < 0.22) { o.got = true; s.boost = BOOST_TICKS; s.speed += 0.14; push(s, { t: "boost", x: o.x }); } break;
      case "ramp": if (!air && dx < 0.25) { o.got = true; s.air = s.airMax = AIR_TICKS; s.tricks = 0; s.trickCd = 0; push(s, { t: "launch", big: false }); } break;
      case "crystal": if (dx < 0.25) { o.got = true; s.light = Math.min(1, s.light + 0.5); s.fish += 1; push(s, { t: "crystal", x: o.x }); } break;
      case "ring": if (dx < o.w + 0.04) { o.got = true; s.fish += o.v; s.legRingsGot++; push(s, { t: "ring", x: o.x }); } break;
      case "friend": if (!s.friend && isV3(c) && dx < o.w + 0.1 && (s.flop > 0 || air)) { o.got = true; s.friend = true; push(s, { t: "rescue", x: o.x }); } break; // the ice only cracks for a belly-flop (or a landing)
      case "span":
        o.got = true;
        if (o.open) {
          if (c.biome === 2 || c.biome === 5) { s.air = s.airMax = AIR_BIG; s.tricks = 0; s.trickCd = 0; s.boost = BOOST_TICKS; push(s, { t: "launch", big: true }); }
          else if (c.biome === 3) { s.light = 1; s.boost = 20; }
          else if (c.biome === 4) { s.windOff = true; s.boost = BOOST_TICKS + 20; }
          else s.boost = BOOST_TICKS + 20;
          if (c.biome !== 2 && c.biome !== 5) s.speed += 0.12;
        } else if (c.biome === 3) s.light = Math.max(0, s.light - 0.25);
        push(s, { t: "span", open: !!o.open, biome: c.biome });
        break;
    }
  }
  if (s.objs.length > 0 && s.objs[0]!.d < s.dist - 14) s.objs = s.objs.filter((o) => o.d >= s.dist - 14);
}

/** One 1/60 s tick. `steer` -3..3 (quantised), `act` 0/1 (a tap: "lock it in" on the ledge, a belly-flop / trick while travelling), `power` 0 none / 1 use a hint fish / 2 use the slow-time crystal (one-tick taps). */
export function step(s: Sim, steerIn: number, act: 0 | 1 = 0, power: 0 | 1 | 2 | 3 = 0): void {
  if (s.phase === "done") return;
  s.tick++;
  const c = s.cfg;
  const steer = Math.max(-3, Math.min(3, Math.round(steerIn)));
  const px = s.x; const d0 = s.dist;
  const g0 = s.gate;
  const rolling = s.phase === "travel" || s.phase === "feedback" || (s.phase === "approach" && !!g0 && g0.gd > HOVER_D && !g0.locked);
  // ── the slide: flop / tricks / boost timers
  if (s.flopCd > 0) s.flopCd--; if (s.trickCd > 0) s.trickCd--; if (s.flop > 0) s.flop--; if (s.boost > 0) s.boost--; if (s.slow > 0) s.slow--; if (s.inv > 0) s.inv--;
  if (!c.calm && c.biome === 3 && s.phase !== "finish") s.light = Math.max(0, s.light - LIGHT_DECAY);
  if (act && s.phase === "travel" && s.air === 0 && s.flop === 0 && s.flopCd === 0 && !c.calm) { s.flop = FLOP_TICKS; s.flopCd = FLOP_CD; push(s, { t: "flop" }); }
  else if (act && s.air > TRICK_MIN_AIR && s.trickCd === 0 && s.tricks < 3) { s.tricks++; s.tricksTotal++; s.trickCd = TRICK_CD; s.fish += 1; push(s, { t: "trick", n: s.tricks }); }
  if (s.air > 0) { s.air--; if (s.air === 0) { const tr = s.tricks; if (tr > 0) { s.boost = Math.max(s.boost, BOOST_TICKS + tr * 14); s.speed += 0.08 * tr; s.fish += tr; } push(s, { t: "land", tricks: tr }); s.tricks = 0; } }
  s.wind = rolling ? windNow(s) : 0;
  // ── lateral motion
  if (c.calm) {
    if (steer !== 0 && s.lastSteer === 0) s.target = Math.max(0, Math.min(c.lanes - 1, s.target + (steer > 0 ? 1 : -1)));
    s.x += (laneCenter(s.target, c.lanes) - s.x) * SNAP_K;
    s.vx = s.x - px;
  } else {
    const k = (s.stun > 0 ? 0.4 : 1) * (s.air > 0 ? 0.65 : 1) * (s.flop > 0 ? 0.5 : 1);
    s.vx = (s.vx + ACC * steer * k + s.wind) * (s.stun > 0 ? DRAG_STUN : DRAG);
    s.x += s.vx;
    if (s.x > WALL) { s.x = WALL; if (s.vx > 0.006) { s.wallBumps++; push(s, { t: "bump", x: 1 }); } s.vx = -s.vx * 0.5; }
    else if (s.x < -WALL) { s.x = -WALL; if (s.vx < -0.006) { s.wallBumps++; push(s, { t: "bump", x: -1 }); } s.vx = -s.vx * 0.5; }
  }
  s.lastSteer = steer;
  if (s.stun > 0) s.stun--;
  const lane = laneOf(s.x, c.lanes);

  const g = s.gate;
  if (s.phase === "travel") {
    s.activeTicks++;
    let tgt = V_TRAVEL + (s.boost > 0 ? 0.2 : 0) + (s.flop > 0 ? 0.1 : 0);
    if (s.slow > 0) tgt *= 0.45; if (s.detour) tgt = Math.min(tgt, 0.25);
    s.speed += (tgt - s.speed) * 0.1; s.dist += s.speed;
    if (s.dist >= s.legEnd) spawnGate(s);
  } else if (s.phase === "approach" && g) {
    s.activeTicks++; // productive time: a question is on screen (docs: log it apart from menus / animations)
    // helpers taken along: a hint fish melts one wrong block, the slow-time crystal holds moving blocks still (each is a one-tick tap the child chose)
    if (power === 1 && s.charges.hint > 0 && !g.hinted && !g.locked) {
      const wl = g.opts.map((o, i) => (o !== null && i !== g.correctLane ? i : -1)).filter((i) => i >= 0);
      if (wl.length > 1) { g.opts[wl[makeRng(mix(s.seed, g.serial * 3 + 5)).int(0, wl.length - 1)]!] = null; g.hinted = true; s.charges.hint--; s.helpUsed++; push(s, { t: "powerUse", kind: "hint" }); }
    } else if (power === 2 && s.charges.freeze > 0 && c.shoals && !g.frozen) { g.frozen = true; s.charges.freeze--; s.helpUsed++; push(s, { t: "powerUse", kind: "freeze" }); }
    // moving gates ("shoals"): the blocks drift one lane along WHILE the gate arrives, and hold still once Percy is on the ledge (thinking is never on a clock)
    if (c.shoals && !c.calm && !g.locked && !g.frozen && g.gd > HOVER_D + 0.5 && g.shownTick !== s.tick && (s.tick - g.shownTick) % SHIFT_TICKS === 0) {
      g.perm = g.perm.map((_, l) => g.perm[(l + g.perm.length - 1) % g.perm.length]!); push(s, { t: "shift" });
    }
    if ((steer !== 0 || act) && !g.touched) { g.touched = true; g.firstInputTick = s.tick; }
    if (lane !== g.lane) { g.lane = lane; g.stable = 0; g.enterTick = s.tick; if (g.locked && g.actLane !== lane) { g.locked = false; push(s, { t: "unlock" }); } } else g.stable++;
    const onLedge = g.gd <= HOVER_D + 0.5;
    if (act && g.touched && onLedge) { g.actLane = lane; if (!g.locked) { g.locked = true; push(s, { t: "lock" }); } }
    else if (!isV3(c) && g.touched && !g.locked && onLedge && g.stable >= LOCK_TICKS && Math.abs(s.vx) < SETTLE_V && steer === 0) { g.locked = true; g.actLane = lane; push(s, { t: "lock" }); } // v2 only: resting locked the lane by itself. From v3 on a lane is locked ONLY by an explicit act.
    else if (g.locked && g.actLane === lane && steer !== 0 && !c.calm && Math.abs(s.vx) > 0.02) { g.locked = false; push(s, { t: "unlock" }); }
    const soft = c.approachSec > 0;
    let target: number;
    if (g.locked) target = c.calm ? RUSH_CALM : RUSH;
    else if (soft) target = cruise(s);
    else target = g.gd > HOVER_D ? FAR : c.calm ? DRIFT_CALM : DRIFT; // no timer: the gate waits at the stop line, the ice just drifts
    const wasFar = g.gd > HOVER_D;
    s.speed += (target - s.speed) * 0.06;
    if (Math.abs(target - s.speed) < 0.0004) s.speed = target;
    s.dist += s.speed;
    if (soft || g.locked || g.gd > HOVER_D) g.gd -= s.speed;
    if (wasFar && g.gd <= HOVER_D && !soft) push(s, { t: "ledge" });
    if (g.gd <= 0) resolve(s, g);
  } else if (s.phase === "feedback") {
    const fs = 0.22 + (s.boost > 0 ? 0.12 : 0);
    s.speed += ((s.slow > 0 ? fs * 0.6 : fs) - s.speed) * 0.08; s.dist += s.speed;
    if (--s.phaseLeft <= 0) {
      if (s.queue.length && !s.caught) { s.phase = "travel"; }
      else {
        s.phase = "finish"; s.gate = null;
        const need = bossNeed(s.plan.items.length);
        if (c.chaser && !s.caught && s.bossFill >= need) { s.bossDown = true; s.phaseLeft = FINISH_BOSS; push(s, { t: "defeat" }); if (isV3(c) && !s.friend) { s.friend = true; push(s, { t: "rescue", x: 0 }); } } // beating a boss frees the friend it was holding
        else { s.phaseLeft = FINISH_TICKS; push(s, { t: s.caught ? "caught" : "finish" }); }
      }
    }
  } else if (s.phase === "finish") {
    s.speed += (0.16 - s.speed) * 0.05; s.dist += s.speed;
    if (--s.phaseLeft <= 0) { s.phase = "done"; push(s, { t: "done" }); }
  }
  collide(s, d0);
}

function resolve(s: Sim, g: Gate) {
  const c = s.cfg;
  const q = s.queue.shift()!;
  let lane = laneOf(s.x, c.lanes);
  // coyote time (~100 ms): a child who was steering into the next lane a hair too late still gets that lane; logged as `late` so motor timing is not read as a knowledge error
  let late = false;
  if (!c.calm && !g.locked && s.lastSteer !== 0 && Math.sign(s.lastSteer) === Math.sign(s.vx) && Math.abs(s.vx) > 0.004) {
    const pl = laneOf(s.x + s.vx * 6, c.lanes);
    if (pl !== lane) { lane = pl; late = true; }
  }
  const chosen = g.opts[g.perm[lane]!] ?? null;
  const miss = !g.touched || chosen === null;
  const correct = !miss && chosen === g.answer;
  const latencyTicks = g.touched ? Math.max(g.firstInputTick, g.enterTick) - g.shownTick : 0;
  const rng = makeRng(mix(s.seed, g.serial * 3 + 3));
  const shown = g.op === "x" ? `${g.shownA} x ${g.shownB}` : g.op === "d" ? `${g.shownA} / ${g.shownB}` : `? x ${g.shownA} = ${g.shownB}`;
  const r: Result = { i: s.resolved++, k: g.k, op: g.op, a: g.a, b: g.b, aux: g.aux, shown, answer: g.answer, chosen, err: !miss && !correct && chosen !== null ? classifyError(g.op, g.a, g.b, chosen, g.aux || undefined) : null, lane, correct, miss, latencyTicks, boss: g.boss, guess: false, requeue: q.rq > 0, tick: s.tick, fish: 0, shielded: false, late, fam: g.fam };
  s.pace.push(s.tick);
  s.gate = null;
  s.phase = "feedback";
  s.speed = Math.max(s.speed, 0.2);
  s.sign = null;
  const requeue = () => {
    const n = s.reqCount[q.k] ?? 0;
    if (n >= 2 || s.requeues >= Math.ceil(c.n * 0.6) || c.chaser) return; // a boss stage never repeats a fact: the boss's advance IS the cost
    s.reqCount[q.k] = n + 1; s.requeues++;
    insertAt(s, { k: q.k, o: q.o, f: (q.f ? 0 : 1) as 0 | 1, boss: false, rq: q.rq + 1, fam: -1, combo: false, d: q.d }, rng);
    push(s, { t: "requeue", k: q.k });
  };
  let route: "open" | "detour" | "none" = "none";
  if (miss) {
    s.timeouts++; requeue(); s.phaseLeft = FB_MISS; r.tick = s.tick;
    s.results.push(r); push(s, { t: "miss", r });
  } else if (correct) {
    route = "open";
    s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak); s.wrongRun = 0; s.fastWrong = 0;
    const m = c.calm ? 1 : 1 + Math.min(3, Math.floor(s.streak / 3));
    if (m !== s.mult) { s.mult = m; push(s, { t: "mult", mult: m }); }
    r.fish = c.calm ? 1 : m * (g.boss ? 2 : 1) * (g.star ? 2 : 1) * (c.mod === "fish2" ? 2 : 1);
    s.fish += r.fish; s.phaseLeft = FB_CORRECT;
    if (c.chaser) {
      s.chase = Math.min(CHASE_START, s.chase + CHASE_GAIN); push(s, { t: "chase", pos: s.chase });
      let dmg = 1;
      if (isV3(c) && c.chaser === "serpent") { // the Serpent's ring gate: her shield holds unless you slid through at least half of the aurora rings on the way in; sealed, a right answer only cracks it by half
        const need = Math.ceil(s.legRings / 2), open = s.legRings === 0 || s.legRingsGot >= need; if (!open) { dmg = 0.5; s.sealed++; }
        push(s, { t: "ringGate", open, got: s.legRingsGot, of: s.legRings });
      }
      if (isV3(c) && c.chaser === "blizzard" && g.op === "d") { s.aim = laneCenter(lane, c.lanes); push(s, { t: "throw", x: s.aim }); } // the quotient you picked aims the counter-throw: the Yeti's next wave leaves its gap where you stand
      s.bossFill += dmg; const ph = bossPhaseOf(s); if (ph !== s.bossPhase) { s.bossPhase = ph; push(s, { t: "phase", n: ph }); }
    }
    s.results.push(r); push(s, { t: "correct", r, streak: s.streak, mult: s.mult });
    if (!c.calm && s.streak % 3 === 0 && s.streak > 0) {
      const kinds: Power[] = ["star", "hint", "shield"];
      const kind = kinds[rng.int(0, 2)]!;
      s.objs.push({ kind, x: laneCenter(rng.int(0, c.lanes - 1), c.lanes), d: s.dist + 42, w: 0.2, v: 0 });
    }
  } else {
    route = "detour";
    s.wrongRun++;
    const fast = latencyTicks < 45; s.fastWrong = fast ? s.fastWrong + 1 : 0;
    if (s.shield) { s.shield = false; r.shielded = true; if (s.shieldTaken) { s.helpUsed++; s.shieldTaken = false; } push(s, { t: "powerUse", kind: "shield" }); }
    else {
      s.streak = Math.floor(s.streak / 2); s.mult = c.calm ? 1 : 1 + Math.min(3, Math.floor(s.streak / 3));
      if (c.chaser) { s.chase = Math.max(0, s.chase - CHASE_HIT); push(s, { t: "chase", pos: s.chase }); if (s.chase <= 0) s.caught = true; }
    }
    if (!c.calm) s.stun = 50;
    s.phaseLeft = FB_WRONG; requeue();
    if (s.fastWrong >= 3) { // three quick wrong taps: guessing. Take a breath; these answers are not data.
      r.guess = true; for (let j = s.results.length - 1, n = 0; j >= 0 && n < 2; j--, n++) s.results[j]!.guess = true;
      s.fastWrong = 0; push(s, { t: "breath" });
    }
    s.results.push(r); push(s, { t: "wrong", r, shielded: r.shielded });
    if (s.wrongRun >= 3 && s.plan.rescue.length && s.rescueUsed < 3 && !c.chaser) {
      const rs = s.plan.rescue[s.rescueUsed++]!;
      s.queue.unshift({ k: rs.k, o: rs.o, f: rs.f, boss: false, rq: 0, fam: -1, combo: false, d: -1 });
      push(s, { t: "strategy", k: q.k }); s.wrongRun = 0;
    }
  }
  if (!miss) { s.recent.push(correct); if (s.recent.length > 3) s.recent.shift(); if (s.recent.filter((x) => !x).length >= 2 && s.easeLeft === 0) s.easeLeft = 3; }
  if (s.queue.length && !s.caught) {
    startLeg(s, route); s.phase = "feedback";
    // a wrong answer leaves a signpost with the fact (the world tells you, not a pop-up); the requeue brings it back a few gates later
    if (route === "detour" && !c.calm) s.sign = { d: s.dist + 15, op: g.op, a: g.a, b: g.b, shownA: g.shownA, shownB: g.shownB, answer: g.answer, aux: g.aux };
    push(s, { t: "leg", route });
  }
}


// ─── Replay + summary (what the server runs) ─────────────────────────────────────────────────────────────────────────────────────────────

/** Input log: [tick, packed] entries where packed = (steer + 3) | (act << 3) | (power << 4). The state holds until the next entry; `act` and `power` last one tick. */
export type InputLog = [number, number][];
export const packInput = (steer: number, act: 0 | 1, power: 0 | 1 | 2 | 3 = 0) => (Math.max(-3, Math.min(3, Math.round(steer))) + 3) | (act << 3) | (power << 4);
export const unpackInput = (p: number): [number, 0 | 1, 0 | 1 | 2 | 3] => [(p & 7) - 3, ((p >> 3) & 1) as 0 | 1, ((p >> 4) & 3) as 0 | 1 | 2 | 3];

export function cleanLog(raw: unknown, maxEntries = 30000): InputLog | null {
  if (!Array.isArray(raw) || raw.length > maxEntries) return null;
  const out: InputLog = []; let last = -1;
  for (const e of raw) {
    if (!Array.isArray(e) || e.length !== 2) return null;
    const [t, p] = e as [unknown, unknown];
    if (!Number.isInteger(t) || !Number.isInteger(p) || (t as number) < 0 || (t as number) > MAX_TICKS || (t as number) < last || (p as number) < 0 || (p as number) > 63 || ((p as number) & 7) > 6) return null;
    out.push([t as number, p as number]); last = t as number;
  }
  return out;
}

/** Replay a log to `endTick` (or until the run finishes). Deterministic: the same inputs always give the same Sim. */
export function replay(seed: number, cfg: Cfg, plan: Plan, log: InputLog, endTick: number): Sim {
  const s = newSim(seed, cfg, plan, false);
  let li = 0; let steer = 0; let act: 0 | 1 = 0; let power: 0 | 1 | 2 | 3 = 0;
  const end = Math.min(endTick, MAX_TICKS);
  while (s.tick < end && s.phase !== "done") {
    while (li < log.length && log[li]![0] <= s.tick) { [steer, act, power] = unpackInput(log[li]![1]); li++; }
    step(s, steer, act, power);
    act = 0; power = 0; // act / power are single-tick taps; a log entry that wants another writes another entry
  }
  return s;
}

export interface Summary {
  done: boolean; ticks: number; answered: number; correct: number; timeouts: number; fish: number; bestStreak: number; guessed: number;
  pace: number[]; results: Result[]; activeTicks: number;
  /** journey: was a boss chaser caught (a gentle stop, never a failure state), helpers used, first-try accuracy (a retest does not count against you twice) */
  caught: boolean; helpUsed: number; firstTry: number; firstTryCorrect: number;
  /** the slide game: hits taken, tricks landed, belly-flop smashes, secret stashes found, and whether the stage boss's weak spot was filled */
  hits: number; tricks: number; smashes: number; bags: number; bossDown: boolean;
  /** v3: a friend was freed this run, how many times the Serpent's ring gate held, pieces of the level that were hand-authored */
  friend: boolean; sealed: number; pieces: number;
}
export function summarise(s: Sim): Summary {
  const real = s.results.filter((r) => !r.miss);
  const first = real.filter((r) => !r.requeue && !r.guess);
  return {
    done: s.phase === "done", ticks: s.tick, answered: real.length, correct: real.filter((r) => r.correct).length, timeouts: s.timeouts,
    fish: s.fish, bestStreak: s.bestStreak, guessed: s.results.filter((r) => r.guess).length, pace: s.pace, results: s.results, activeTicks: s.activeTicks,
    caught: s.caught, helpUsed: s.helpUsed, firstTry: first.length, firstTryCorrect: first.filter((r) => r.correct).length,
    hits: s.hits, tricks: s.tricksTotal, smashes: s.smashes, bags: s.bags, bossDown: s.bossDown, friend: s.friend, sealed: s.sealed, pieces: s.pieces,
  };
}

// ─── Autopilot (client input helper for tap-a-lane / number keys; also the self-test's "child") ────────────────────────────────────────────

/** Quantised steer that glides the penguin to `targetX` and stops there (a PD controller tuned to the ice). */
export function steerToward(s: Pick<Sim, "x" | "vx">, targetX: number, gain = 0.07): number {
  const dx = targetX - s.x;
  const vd = Math.max(-0.05, Math.min(0.05, dx * gain));
  const need = (vd - s.vx) * 40 + vd * 59.5;
  let st = Math.max(-3, Math.min(3, Math.round(need)));
  if (st === 0 && Math.abs(dx) > 0.02 && Math.abs(s.vx) < 0.006) st = dx > 0 ? 1 : -1; // creep the last few pixels so it really arrives
  return st;
}
