// Run: server/node_modules/.bin/tsx features/learninghub/games/penguin/arcade.selftest.ts
import { arcadeCfg, arcadeDailySeed, arcadeDailyTables, arcadeStars, applyArcade, newArcade, pointsFor, tally, ARCADE } from "./arcade";
import { mix, replay, summarise, TICK_HZ, freshFact, type FactState } from "./core";
import { buildRun } from "./run";
import { newProfileLite, recordRun } from "./record";
import { playBot } from "./bot";

let fails = 0; const ok = (c: unknown, m: string) => { if (!c) { fails++; console.error("FAIL", m); } };
const NOW = "2026-09-27T10:00:00.000Z";
const build = (mode: string, o: { calm?: boolean; facts?: Map<string, FactState>; seed?: number } = {}) =>
  buildRun({ body: { mode }, facts: o.facts ?? new Map(), profile: newProfileLite(), support: { calm: o.calm }, age: 9, nowIso: NOW, seed: o.seed ?? 12345, firstEver: false });

// 0. this file keeps a local copy of core's tick rate and mix (it must not import them at runtime: core imports arcade). They must never drift.
ok(TICK_HZ === 60, "TICK_HZ 60");
ok(pointsFor(1, 0, arcadeCfg("run", { calm: false, age: 9 })).bonus === 10, "an instant answer earns the full +10 speed bonus");
ok(arcadeDailySeed("2026-09-27") === arcadeDailySeed("2026-09-27") && arcadeDailySeed("2026-09-27") !== arcadeDailySeed("2026-09-28"), "daily seed is per-day");
ok(mix(1, 2, 3) === mix(1, 2, 3), "mix deterministic");

// 1. scoring rules, on hand-made results
const a = arcadeCfg("run", { calm: false, age: 9 });
ok(a.lives === 3 && a.timerSec === 9 && arcadeCfg("run", { calm: false, age: 7 }).timerSec === 12, "3 lives, 9 s gate timer (12 s under 8)");
ok(arcadeCfg("run", { calm: true, age: 9 }).lives === 0 && arcadeCfg("run", { calm: true, age: 9 }).timerSec === 0, "calm: no lives, no timer");
const res = (o: Partial<Parameters<typeof applyArcade>[1]> & { i: number }) => ({ k: "x_3x4", op: "x", a: 3, b: 4, aux: 0, shown: "3 x 4", answer: 12, chosen: 12, err: null, lane: 0, correct: true, miss: false, latencyTicks: 0, boss: false, guess: false, requeue: false, tick: 0, fish: 0, shielded: false, late: false, fam: -1, ...o }) as Parameters<typeof applyArcade>[1];
let st = newArcade(a);
for (let i = 0; i < 7; i++) st = applyArcade(st, res({ i, latencyTicks: 0 }), a);
ok(st.combo === 7 && st.bestCombo === 7, "combo counts consecutive right answers");
ok(st.rows[0]!.mult === 1 && st.rows[1]!.mult === 2 && st.rows[4]!.mult === 5 && st.rows[6]!.mult === 5, "multiplier x1, x2 ... capped at x5");
ok(st.score === (10 + 10) * (1 + 2 + 3 + 4 + 5 + 5 + 5), "score = (base + bonus) x combo multiplier");
st = applyArcade(st, res({ i: 7, correct: false, chosen: 99 }), a);
ok(st.combo === 0 && st.lives === 2 && !st.over, "a miss resets the combo and costs a heart");
st = applyArcade(st, res({ i: 8, guess: true, correct: false }), a);
ok(st.lives === 2 && st.combo === 0, "a rapid guess is neutral (no life, no score)");
st = applyArcade(st, res({ i: 9, correct: false, miss: true }), a);
st = applyArcade(st, res({ i: 10, correct: false }), a);
ok(st.over && st.lives === 0 && st.overAt === 10, "the third life ends the run (Game Over) at that result");
const frozen = applyArcade(st, res({ i: 11 }), a);
ok(frozen.score === st.score && frozen.rows.length === st.rows.length, "nothing after Game Over counts");
ok(arcadeStars(st, 20) === 0, "Game Over = no stars in a run");
const slow = applyArcade(newArcade(a), res({ i: 0, latencyTicks: 4 * TICK_HZ }), a);
ok(slow.rows[0]!.bonus === 0, "no speed bonus after the first third of the window");
let calm = newArcade(arcadeCfg("run", { calm: true, age: 9 })); const ca = arcadeCfg("run", { calm: true, age: 9 });
for (let i = 0; i < 12; i++) calm = applyArcade(calm, res({ i, correct: false }), ca);
ok(!calm.over && calm.lives === 0 && calm.wrong === 12, "calm never ends the run");
ok(applyArcade(newArcade(a), res({ i: 0, correct: false, shielded: true }), a).lives === 3, "a shielded slip costs nothing");

// 2. every kind builds a valid, deterministic run; the daily is identical for every child
for (const [mode, kind] of [["arcade", "run"], ["arcade-daily", "daily"], ["arcade-endless", "endless"]] as const) {
  const b = build(mode); ok(b.ok, `${mode} builds`); if (!b.ok) continue;
  ok(b.cfg.arcade?.kind === kind && b.cfg.arcade.lives === 3 && b.cfg.approachSec === 9, `${mode} cfg carries the arcade rules and a gate timer`);
  ok(b.plan.items.length >= 8 && b.plan.items.length <= ARCADE.n[kind], `${mode} plan size ${b.plan.items.length}`);
  ok(b.key === `arcade:${kind}`, `${mode} has its own personal-best key`);
  ok(JSON.stringify(build(mode).ok && (build(mode) as { plan: unknown }).plan) === JSON.stringify(b.plan), `${mode} deterministic`);
}
const dailyA = build("arcade-daily", { seed: 1 }), dailyB = build("arcade-daily", { seed: 999, facts: new Map([["x_7x8", { ...freshFact("x_7x8")!, attempts: 30, correct: 30, thaw: 4 }]]) });
ok(dailyA.ok && dailyB.ok && JSON.stringify(dailyA.ok && dailyA.plan) === JSON.stringify(dailyB.ok && dailyB.plan), "the daily plan is the same for every child (fixed seed, no personal history)");
ok(dailyA.ok && dailyA.seed === arcadeDailySeed("2026-09-27"), "the daily challenge fixes the session seed");
ok(arcadeDailyTables("2026-09-27").length === 4 && JSON.stringify(arcadeDailyTables("2026-09-27")) === JSON.stringify(arcadeDailyTables("2026-09-27")), "daily tables stable");
const cb = build("arcade", { calm: true }); ok(cb.ok && cb.cfg.calm && cb.cfg.arcade?.lives === 0 && cb.cfg.approachSec === 0, "calm arcade: no lives, no timer");
// Journey / free play are untouched: no arcade field at all
const j = build("solo"); ok(j.ok && !j.cfg.arcade, "free play has no arcade rules");

// 3. server-authoritative: the bot plays real runs, the tally comes from the RE-SIMULATED results only
function run(mode: string, acc: number, seed = 777) {
  const b = build(mode, { seed }); if (!b.ok) throw new Error("build");
  const seedUsed = b.seed ?? seed;
  const played = playBot(seedUsed, b.cfg, b.plan, { acc, think: 30, rngSeed: seedUsed });
  const sum = summarise(replay(seedUsed, b.cfg, b.plan, played.log, played.endTick)); // what the server does
  return { b, seedUsed, sum, played };
}
const good = run("arcade", 1);
const goodT = tally(good.b.cfg.arcade!, good.sum.results);
ok(!goodT.over && goodT.correct >= 15 && goodT.score > 0 && goodT.bestCombo >= 10, `a perfect bot clears the run (correct ${goodT.correct}, combo ${goodT.bestCombo}, score ${goodT.score})`);
ok(arcadeStars(goodT, good.b.cfg.n) === 3, "a flawless clear is 3 stars");
const bad = run("arcade", 0);
const badT = tally(bad.b.cfg.arcade!, bad.sum.results);
ok(badT.over && badT.lives === 0 && badT.wrong + badT.misses === 3, "a bot that is always wrong hits Game Over after exactly 3 misses (" + badT.wrong + "+" + badT.misses + ")");
ok(JSON.stringify(tally(good.b.cfg.arcade!, replay(good.seedUsed, good.b.cfg, good.b.plan, good.played.log, good.played.endTick).results)) === JSON.stringify(goodT), "replaying the same log gives the same tally");
const rec = recordRun(good.b.cfg, good.sum, new Map(), newProfileLite(), NOW);
ok(rec.result.arcade?.score === goodT.score && rec.result.arcade?.stars === 3 && rec.result.arcade?.newBest === true && rec.result.arcade?.kind === "run", "recordRun (the server's finish) reports the arcade result and a new best");
ok(rec.profile.arcade?.run?.score === goodT.score, "the personal best is stored on the profile");
const rec2 = recordRun(good.b.cfg, good.sum, rec.facts, rec.profile, NOW);
ok(rec2.result.arcade?.newBest === false && rec2.result.arcade?.previousBest === goodT.score, "the same score again is not a new best");
const endless = run("arcade-endless", 0.8, 31);
const endlessT = tally(endless.b.cfg.arcade!, endless.sum.results);
ok(endlessT.correct > 0 && endlessT.score > 0, "endless scores");
const daily = run("arcade-daily", 1);
const rd = recordRun(daily.b.cfg, daily.sum, new Map(), newProfileLite(), NOW);
ok(rd.result.arcade?.kind === "daily" && (rd.result.arcade?.score ?? 0) > 0, "daily scores");
const rdNext = recordRun(daily.b.cfg, daily.sum, rd.facts, rd.profile, "2026-09-28T09:00:00.000Z");
ok(rdNext.result.arcade?.newBest === true, "the daily best is per day: tomorrow's run starts fresh");

// 4. a run the child ended early (Finish now) is not a clear
const early = run("arcade", 1); const cut = replay(early.seedUsed, early.b.cfg, early.b.plan, early.played.log, Math.floor(early.played.endTick / 3));
const earlyT = tally(early.b.cfg.arcade!, summarise(cut).results);
ok(arcadeStars(earlyT, early.b.cfg.n) === 0 && !earlyT.over, "ending early is not a clear");

console.log(fails ? `${fails} FAILURES` : "arcade selftest: all passed");
process.exit(fails ? 1 : 0);
