// The pure "what a finished run does to a child's memory" step, shared by the SERVER (lib/hubGames.ts, inside a transaction) and the offline DEMO store
// (store.ts, localStorage). Pure: facts + profile in, facts + profile + child-facing result out. No I/O, no clock (the caller passes nowIso).
import { applyToFact, classifyError, DEFAULT_RT0_MS, eloTheta, fluentMs, freshFact, parseKey, POLICY, slowMs, strategyFor, TICK_HZ, THETA0, type Cfg, type FactState, type Summary } from "./core";
import { markMtc, mtcKey, type MtcAnswer, type MtcItem } from "./mtc";
import { STAGES, stageById, POLICY as CFGPOLICY } from "./config";
import { journeyView, starsFor, unlocksFor, type Stars } from "./journey";

export interface Best { fish: number; correct: number; answered: number; pace: number[]; at: string }
export interface ProfileLite {
  pinned: number[]; bests: Record<string, Best>; plays: { day: string; count: number }; theta: number; nAnswers: number; roll: number[];
  rt0Samples: number[]; rt0Ms: number; xp: { day: string; xp: number }; days: string[]; mtcAt: string[]; lastMtc: string[];
  /** Journey: best stars per stage, and the tutor / demo switch that opens every stage. */
  journey: Stars; unlockAll: boolean;
  /** every fish ever collected (the village is paid for with these; what was spent lives on the device, so a lost device never loses progress) */
  fishTotal?: number;
}
export const newProfileLite = (): ProfileLite => ({ pinned: [], bests: {}, plays: { day: "", count: 0 }, theta: THETA0, nAnswers: 0, roll: [], rt0Samples: [], rt0Ms: DEFAULT_RT0_MS, xp: { day: "", xp: 0 }, days: [], mtcAt: [], lastMtc: [], journey: {}, unlockAll: false });

void STAGES;
/** Personal bests are kept per stage (`b1s2`), per daily challenge and per free-play mode. */
export const bestKey = (cfg: Cfg) => cfg.stage ?? (cfg.mod ? "daily" : cfg.mode);
export const DAILY_SOFT_CAP = CFGPOLICY.dailySoftCap;
export const weekStart = (iso: string) => { const d = new Date(iso.slice(0, 10) + "T00:00:00Z"); const dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dow); return d.toISOString().slice(0, 10); };
export const weekDaysOf = (days: string[], nowIso: string) => days.filter((d) => d >= weekStart(nowIso)).length;
export const fluentCount = (facts: Iterable<FactState>) => { let n = 0; for (const f of facts) if (f.thaw >= 3) n++; return n; };
export const lightFact = (f: FactState) => ({ key: f.key, thaw: f.thaw, attempts: f.attempts, correct: f.correct, medianMs: f.medianLatencyMs });

/** Elo + baseline speed + rolling accuracy + "days practised" bookkeeping shared by both kinds of run. */
export function bumpProfile(prof: ProfileLite, facts: Map<string, FactState>, answers: { k: string; correct: boolean; ms: number }[], nowIso: string) {
  for (const a of answers) {
    const f = facts.get(a.k); if (!f) continue;
    const sc = !a.correct ? 0 : a.ms <= fluentMs(prof.rt0Ms) ? 1 : a.ms <= slowMs(prof.rt0Ms) ? 0.75 : 0.5;
    prof.theta = eloTheta(prof.theta, f.elo, sc, prof.nAnswers); prof.nAnswers++;
    prof.roll = [...prof.roll, a.correct ? 1 : 0].slice(-30);
    const p = parseKey(a.k)!;
    if (a.correct && a.ms >= 400 && [p.a, p.b].some((t) => t === 2 || t === 5 || t === 10) && f.attempts > 1) prof.rt0Samples = [...prof.rt0Samples, a.ms].slice(-20);
  }
  if (prof.rt0Samples.length >= 5) { const s = [...prof.rt0Samples].sort((x, y) => x - y); prof.rt0Ms = s[s.length >> 1]!; }
  const day = nowIso.slice(0, 10);
  if (!prof.days.includes(day)) prof.days = [...prof.days, day].slice(-30);
}

export function recordRun(cfg: Cfg, sum: Summary, factsIn: ReadonlyMap<string, FactState>, profIn: ProfileLite, nowIso: string) {
  const prof: ProfileLite = JSON.parse(JSON.stringify(profIn));
  const counted = sum.results.filter((r) => !r.miss && !r.guess);
  const keys = [...new Set(counted.map((r) => r.k))];
  const before = new Map<string, FactState>(); const after = new Map<string, FactState>();
  for (const k of keys) { const f = factsIn.get(k) ?? freshFact(k)!; before.set(k, f); after.set(k, f); }
  const theta0 = prof.theta;
  for (const r of counted) {
    after.set(r.k, applyToFact(after.get(r.k)!, { correct: r.correct, latencyTicks: r.latencyTicks, ...(r.chosen !== null && !r.correct ? { wrongAnswer: r.chosen } : {}), form: r.op, ...(r.op !== "x" ? { divisor: r.aux } : {}) }, { nowIso, rt0Ms: prof.rt0Ms, theta: prof.theta }));
  }
  bumpProfile(prof, after, counted.map((r) => ({ k: r.k, correct: r.correct, ms: Math.round((r.latencyTicks * 1000) / TICK_HZ) })), nowIso);
  const prev = prof.bests?.[bestKey(cfg)] ?? null;
  const newBest = sum.done && sum.answered >= Math.min(6, cfg.n) && (!prev || sum.fish > prev.fish);
  const day = nowIso.slice(0, 10);
  if (newBest) prof.bests = { ...prof.bests, [bestKey(cfg)]: { fish: sum.fish, correct: sum.correct, answered: sum.answered, pace: sum.pace, at: nowIso } };
  prof.fishTotal = (prof.fishTotal ?? 0) + Math.max(0, sum.fish);
  prof.plays = { day, count: (prof.plays.day === day ? prof.plays.count : 0) + (sum.answered > 0 ? 1 : 0) };
  // points: only correct FIRST-attempt answers (not a retest, not a guess), capped per day; informational, never a reason to keep playing
  const xpBefore = prof.xp.day === day ? prof.xp.xp : 0;
  const xp = Math.max(0, Math.min(sum.results.filter((r) => r.correct && !r.requeue && !r.guess).length, POLICY.xpDailyCap - xpBefore));
  prof.xp = { day, xp: xpBefore + xp };
  const fasterDetail = keys.filter((k) => { const b = before.get(k)!, a = after.get(k)!; return b.attempts > 1 && b.medianLatencyMs > 0 && a.thaw >= 2 && a.medianLatencyMs <= b.medianLatencyMs * 0.8; }).map((k) => ({ k, beforeMs: before.get(k)!.medianLatencyMs, afterMs: after.get(k)!.medianLatencyMs }));
  const thawGained = keys.filter((k) => after.get(k)!.thaw > before.get(k)!.thaw).length;
  const wrongs = sum.results.filter((r) => !r.miss && !r.correct && !r.guess);
  const hard = wrongs[0] ?? null;
  const merged = new Map(factsIn); for (const [k, v] of after) merged.set(k, v);
  // journey: stars for a stage run (accuracy + no helper; never speed), what it opened, what it earned
  let stage: null | { id: string; biome: number; stars: number; best: number; cleared: boolean; caught: boolean; opened: string[]; newPowers: string[]; newCosmetics: string[]; boss: boolean } = null;
  if (cfg.stage) {
    const def = stageById(cfg.stage);
    if (def) {
      const earned = starsFor(sum); const prevStars = prof.journey[def.id] ?? 0;
      const beforeView = journeyView(prof.journey, prof.unlockAll); const beforeU = unlocksFor(prof.journey, factsIn.values(), prof.unlockAll);
      if (earned > prevStars) prof.journey = { ...prof.journey, [def.id]: earned };
      const afterView = journeyView(prof.journey, prof.unlockAll); const afterU = unlocksFor(prof.journey, merged.values(), prof.unlockAll);
      stage = {
        id: def.id, biome: def.biome, stars: earned, best: Math.max(prevStars, earned), cleared: earned > 0, caught: sum.caught, boss: def.boss,
        opened: afterView.stages.filter((s, i) => s.status !== "locked" && beforeView.stages[i]!.status === "locked").map((s) => s.def.id),
        newPowers: afterU.powers.filter((p) => !beforeU.powers.includes(p)), newCosmetics: afterU.cosmetics.filter((c) => !beforeU.cosmetics.includes(c)),
      };
    }
  }
  const result = {
    done: sum.done, answered: sum.answered, correct: sum.correct, timeouts: sum.timeouts, fish: sum.fish, bestStreak: sum.bestStreak, seconds: Math.round(sum.ticks / TICK_HZ), productiveSeconds: Math.round(sum.activeTicks / TICK_HZ),
    newBest, previousBest: prev ? { fish: prev.fish } : null, faster: fasterDetail.map((x) => x.k), fasterDetail, thawGained, mode: cfg.mode,
    wrong: wrongs.slice(0, 6).map((r) => ({ k: r.k, shown: r.shown, answer: r.answer, chosen: r.chosen })),
    lookAt: hard ? { k: hard.k, strategy: strategyFor(hard.a, hard.b) } : null,
    pace: sum.pace, facts: keys.map((k) => lightFact(after.get(k)!)), thetaBefore: theta0, thetaAfter: prof.theta,
    xp, xpToday: prof.xp.xp, xpCap: POLICY.xpDailyCap, weekDays: weekDaysOf(prof.days, nowIso), weekGoal: POLICY.weekGoalDays, todayCount: prof.plays.count, softCap: prof.plays.count >= DAILY_SOFT_CAP,
    fluentFacts: fluentCount(merged.values()), stage, helpUsed: sum.helpUsed, caught: sum.caught,
    fishTotal: prof.fishTotal ?? 0, hits: sum.hits, tricks: sum.tricks, bags: sum.bags, bossDown: sum.bossDown, friend: sum.friend, sealed: sum.sealed,
    /** questions answered right the FIRST time they were asked (a re-asked question never counts again): the child-facing number, out of the stage's own question count */
    firstTry: sum.firstTry, firstTryCorrect: sum.firstTryCorrect, asked: Math.min(sum.firstTry, cfg.n),
    // Mastery bridge: game evidence is LOW weight and flagged as a game (docs C section 9 proposes tutor 0.5 / delayed retention 0.35 / in-session 0.15).
    mastery: { source: "game", topic: "md", got: sum.correct, max: sum.answered, weight: 0.15 },
  };
  return { facts: after, merged, profile: prof, result, keys };
}
export type RunResult = ReturnType<typeof recordRun>["result"];

export function recordMtc(form: MtcItem[], answers: MtcAnswer[], factsIn: ReadonlyMap<string, FactState>, profIn: ProfileLite, nowIso: string) {
  const prof: ProfileLite = JSON.parse(JSON.stringify(profIn));
  const res = markMtc(form, answers);
  const keys = [...new Set(form.map((i) => `x_${Math.min(i.a, i.b)}x${Math.max(i.a, i.b)}`))];
  const facts = new Map<string, FactState>(); for (const k of keys) facts.set(k, factsIn.get(k) ?? freshFact(k)!);
  const applied: { k: string; correct: boolean; ms: number }[] = [];
  // typed, unaided answers are the strongest evidence; a timed-out blank says nothing about whether the fact is known, so it does not touch fact memory
  for (const r of res.rows) {
    if (r.kind === "timeout") continue;
    const k = `x_${Math.min(r.a, r.b)}x${Math.max(r.a, r.b)}`;
    facts.set(k, applyToFact(facts.get(k)!, { correct: r.ok, latencyTicks: Math.round((r.ms * TICK_HZ) / 1000), ...(r.entered !== null && !r.ok ? { wrongAnswer: r.entered } : {}), typed: true }, { nowIso, rt0Ms: prof.rt0Ms, theta: prof.theta }));
    applied.push({ k, correct: r.ok, ms: r.ms });
  }
  bumpProfile(prof, facts, applied, nowIso);
  prof.mtcAt = [...prof.mtcAt, nowIso.slice(0, 10)].slice(-30); prof.lastMtc = form.map(mtcKey);
  const ms = res.rows.filter((r) => r.kind !== "timeout").map((r) => r.ms).sort((x, y) => x - y);
  // NO pass mark and never "diagnostic": a practice score with its per-fact record. "timed out" is reported apart from "wrong" (docs C M5/M6).
  const result = {
    kind: "mtc" as const, label: "practice" as const, score: res.score, total: res.total, byTable: res.byTable,
    missed: res.rows.filter((r) => !r.ok).map((r) => ({ a: r.a, b: r.b, kind: r.kind, entered: r.entered, errType: r.entered !== null ? classifyError("x", Math.min(r.a, r.b), Math.max(r.a, r.b), r.entered) : null })),
    medianMs: ms.length ? ms[ms.length >> 1]! : 0, mastery: { source: "game", weight: 0.15 },
  };
  return { facts, profile: prof, result, keys, res };
}
export type MtcRunResult = ReturnType<typeof recordMtc>["result"];
