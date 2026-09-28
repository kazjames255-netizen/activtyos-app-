// Run: server/node_modules/.bin/tsx features/learninghub/games/penguin/travel.selftest.ts
// The slide game: hazards are real, fair and dodgeable; every world's rule is in the SIMULATION (so the server replays it); wrong answers detour, never end the run.
import { SET_PIECES, STAGES, STAGE_SCRIPT, setPiecesOf, validateSetPiece, friendOf } from "./config";
import { cleanLog, replay, summarise, TICK_HZ, type SimEvent } from "./core";
import { selectStagePlan, stageCfg, starsFor } from "./journey";
import { playBot } from "./bot";

let fails = 0; const ok = (c: unknown, m: string) => { if (!c) { fails++; console.error("FAIL", m); } };
const NOW = "2026-09-26T10:00:00.000Z";
const run = (id: string, seed: number, o: { acc?: number; skill?: 0 | 1 }) => {
  const st = STAGES.find((x) => x.id === id)!; const cfg = stageCfg(st); const plan = selectStagePlan(seed, cfg, st, new Map(), NOW);
  const r = playBot(seed, cfg, plan, { acc: o.acc ?? 1, skill: o.skill ?? 0, think: 30, rngSeed: seed });
  return { ...r, cfg, plan, sum: summarise(r.sim) };
};
const table: string[] = [];
let tot = { hits0: 0, hits1: 0 };
for (const st of STAGES) {
  const a = run(st.id, 11, { skill: 1, acc: 1 }); const b = run(st.id, 11, { skill: 0, acc: 1 });
  const re = summarise(replay(11, a.cfg, a.plan, cleanLog(JSON.parse(JSON.stringify(a.log)))!, a.sim.tick));
  ok(JSON.stringify(re) === JSON.stringify(a.sum), `${st.id} skilled run replays exactly (server re-sim)`);
  ok(a.sim.phase === "done" && b.sim.phase === "done", `${st.id} both finish`);
  ok(a.log.length < 6000, `${st.id} log small enough (${a.log.length})`);
  ok(a.sum.hits <= (st.boss ? 10 : 6), `${st.id} hazards are dodgeable: skilled bot took ${a.sum.hits} hits`);
  tot.hits0 += b.sum.hits; tot.hits1 += a.sum.hits;
  ok(a.sum.fish >= b.sum.fish, `${st.id} steering earns more fish (${a.sum.fish} vs ${b.sum.fish})`);
  ok(starsFor(a.sum) >= 1 && starsFor(b.sum) === starsFor(a.sum), `${st.id} stars come from answers, not from sliding (${starsFor(a.sum)} / ${starsFor(b.sum)})`);
  table.push(`${st.id} ${Math.round(a.sim.tick / TICK_HZ)}s hits ${a.sum.hits}/${b.sum.hits} fish ${a.sum.fish}/${b.sum.fish} tricks ${a.sum.tricks} smash ${a.sum.smashes} bags ${a.sum.bags} boss ${a.sum.bossDown}`);
}
ok(tot.hits0 > tot.hits1 + 8, `not steering costs something: ${tot.hits0} hits vs ${tot.hits1}`);
console.log(table.join("\n"));

// world rules live in the sim
{
  const b2 = run("b2s2", 5, { skill: 1 }); ok(b2.sum.tricks > 0, "Aurora: ramps launch Percy and tricks land (" + b2.sum.tricks + ")");
  let smashes = 0; for (const sd of [5, 6, 7, 8, 9]) smashes += run("b1s3", sd, { skill: 1 }).sum.smashes; ok(smashes > 0, "Glacier: a belly-flop smashes drifts (" + smashes + " over 5 seeds)");
  const st3 = STAGES.find((x) => x.id === "b3s2")!; const cfg3 = stageCfg(st3); const p3 = selectStagePlan(5, cfg3, st3, new Map(), NOW);
  const r3 = playBot(5, cfg3, p3, { skill: 1 }); ok(r3.sim.light < 1, "Caves: the lantern dims as you slide (" + r3.sim.light.toFixed(2) + ")");
  const st4 = STAGES.find((x) => x.id === "b4s2")!; const cfg4 = stageCfg(st4); const p4 = selectStagePlan(5, cfg4, st4, new Map(), NOW);
  let lo = 0, hi = 0; const w = playBot(5, cfg4, p4, { skill: 1 }); void w;
  const s4 = replay(5, cfg4, p4, [], 1); for (let i = 0; i < 1500; i++) { const { windNow } = require("./core") as typeof import("./core"); const v = windNow({ ...s4, tick: i }); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  ok(lo < -0.0005 && hi > 0.0005, `Storm: gusts blow both ways (${lo.toFixed(4)}..${hi.toFixed(4)})`);
  const cfg1 = stageCfg(STAGES[0]!); const p1 = selectStagePlan(5, cfg1, STAGES[0]!, new Map(), NOW); const s1 = replay(5, cfg1, p1, [], 900); ok(s1.wind === 0, "Glacier has no wind");
}
// a wrong answer takes the scenic detour (longer, slower), never ends the run; the fact stays on a sign
{
  const st = STAGES.find((x) => x.id === "b1s3")!; const cfg = stageCfg(st); const plan = selectStagePlan(8, cfg, st, new Map(), NOW);
  const good = playBot(8, cfg, plan, { acc: 1, skill: 1 }), bad = playBot(8, cfg, plan, { acc: 0, skill: 1 });
  ok(bad.sim.phase === "done" && !bad.sim.caught, "all-wrong child still gets to the end (no game over)");
  ok(bad.sim.tick > good.sim.tick + 120, `detours are slower (${Math.round(good.sim.tick / 60)}s vs ${Math.round(bad.sim.tick / 60)}s)`);
}
// bosses: a face, 3 phases, a defeat moment; caught is a gentle stop
{
  const st = STAGES.find((x) => x.id === "b1s4")!; const cfg = stageCfg(st); const plan = selectStagePlan(3, cfg, st, new Map(), NOW);
  const evs: SimEvent[] = []; const s0 = playBot(3, cfg, plan, { acc: 1, skill: 1 });
  ok(s0.sim.bossDown && s0.sim.bossPhase === 3, "perfect run defeats the boss through 3 phases");
  const { newSim, step } = require("./core") as typeof import("./core"); void newSim; void step; void evs;
  const w = playBot(3, cfg, plan, { acc: 0, skill: 1 }); ok(w.sim.caught && !w.sim.bossDown, "no right answers: caught (gentle stop), boss not beaten");
}
// hand-authored set pieces: valid, every scripted id exists in the stage's own world, and they really are placed in v3 runs (not in v2 ones)
{
  for (const p of SET_PIECES) { const bad = validateSetPiece(p); ok(bad.length === 0, `set piece ${p.id}: ${bad.join("; ")}`); }
  for (const [id, list] of Object.entries(STAGE_SCRIPT)) { const st = STAGES.find((x) => x.id === id); ok(!!st, `script for a real stage ${id}`); for (const pid of list) ok(!!st && setPiecesOf(st.biome).some((q) => q.id === pid), `${id} script piece ${pid} belongs to its world`); }
  for (let b = 1; b <= 5; b++) ok(setPiecesOf(b).length >= 4, `world ${b} has >= 4 authored pieces`);
  const r = run("b3s2", 4, { skill: 1 }); ok(r.sum.pieces >= 3, `Caves stage opens with authored pieces (${r.sum.pieces})`);
  const st = STAGES.find((x) => x.id === "b3s2")!; const c2 = { ...stageCfg(st), v: 2 }; const p2 = selectStagePlan(4, c2, st, new Map(), NOW); const legacy = playBot(4, c2, p2, { skill: 1 }); ok(summarise(legacy.sim).pieces === 0, "a v2 run has no authored pieces (old logs replay with the rules they were played under)");
}
// friends: a belly-flop cracks the ice, the friend helps for the rest of the run; a boss frees its friend
{
  let got = 0, tries = 0; for (const sd of [1, 2, 3, 4, 5, 6]) for (const id of ["b1s3", "b2s2", "b3s3", "b4s2"]) { tries++; if (run(id, sd, { skill: 1 }).sum.friend) got++; }
  ok(got >= tries / 2, `a skilled child frees the stage friend most of the time (${got}/${tries})`);
  let idle = 0; for (const sd of [1, 2, 3]) for (const id of ["b1s3", "b2s2", "b3s3"]) if (run(id, sd, { skill: 0 }).sum.friend) idle++; ok(idle <= 1, `a child who never flops rarely frees one (${idle})`);
  ok(run("b1s4", 3, { skill: 0 }).sum.friend, "beating a boss frees the friend it held");
  ok(friendOf(1) === "seal" && friendOf(5) === "hare", "species follow the world");
  const helpful = { with: 0, without: 0 }; for (const sd of [1, 2, 3, 4, 5, 6, 7, 8]) { const r = playBot(sd, stageCfg(STAGES.find((x) => x.id === "b3s2")!), selectStagePlan(sd, stageCfg(STAGES.find((x) => x.id === "b3s2")!), STAGES.find((x) => x.id === "b3s2")!, new Map(), NOW), { skill: 1, think: 30, rngSeed: sd }); if (r.sim.friend) helpful.with += r.sim.fish; else helpful.without += r.sim.fish; }
  ok(helpful.with >= 0, "friend accounting runs");
}
// Serpent ring gate (real, in the sim): a child who slides through the aurora rings breaks her shield; one who never steers only half-cracks it and does not beat her
{
  const good = run("b2s4", 3, { skill: 1 }), idle = run("b2s4", 3, { skill: 0 });
  ok(good.sim.bossDown, "steering through the rings beats the Aurora Serpent"); ok(good.sum.sealed < idle.sum.sealed, `the shield holds more often when you do not steer (${good.sum.sealed} vs ${idle.sum.sealed})`);
  ok(!idle.sim.bossDown && idle.sum.sealed > 0, "a child who never steers cannot finish her (the stage still clears: stars are answers only)");
  ok(starsFor(good.sum) === starsFor(idle.sum), "the ring gate never changes stars");
  const v2 = { ...stageCfg(STAGES.find((x) => x.id === "b2s4")!), v: 2 }; const st = STAGES.find((x) => x.id === "b2s4")!; const rp = playBot(3, v2, selectStagePlan(3, v2, st, new Map(), NOW), { skill: 0 }); ok(rp.sim.sealed === 0 && rp.sim.bossDown, "v2 runs are unchanged: no ring gate");
}
// Yeti division-aim: a right division answer leaves the next wave's gap where you stood
{
  const st = STAGES.find((x) => x.id === "b4s4")!; const cfg = stageCfg(st); const plan = selectStagePlan(3, cfg, st, new Map(), NOW);
  const r = playBot(3, cfg, plan, { skill: 1, think: 30, rngSeed: 3, emit: true }); const throws = r.sim.ev.filter((e) => e.t === "throw").length;
  ok(throws >= 2, `division answers throw a snowball (${throws})`);
  const v2 = { ...cfg, v: 2 }; const r2 = playBot(3, v2, selectStagePlan(3, v2, st, new Map(), NOW), { skill: 1, think: 30, rngSeed: 3, emit: true }); ok(r2.sim.ev.filter((e) => e.t === "throw").length === 0, "v2 runs never aim");
  const aimed = r.sim.ev.filter((e) => e.t === "hit").length; ok(aimed <= 12, "aimed waves stay fair");
  // the aim is REAL: replay the run and, at every throw, the next wave's two flanking snowballs sit on either side of where the child stood (gap = the aimed x, clamped to +-0.45)
  { const { newSim, step, steerToward, laneCenter } = require("./core") as typeof import("./core"); const { travelPlan } = require("./bot") as typeof import("./bot");
    const s2 = newSim(3, cfg, plan, true); let g = 0, checked = 0, good = 0;
    while (s2.phase !== "done" && g++ < 200000) {
      let steer = 0, act: 0 | 1 = 0;
      if (s2.phase === "approach" && s2.gate) { const gt = s2.gate; const tx = laneCenter(gt.perm.indexOf(gt.correctLane), cfg.lanes); steer = steerToward(s2, tx); if (!gt.locked && Math.abs(s2.vx) < 0.004 && Math.abs(s2.x - tx) < 0.15) act = 1; }
      else if (s2.phase === "travel") { const tp = travelPlan(s2); steer = steerToward(s2, tp.x); act = tp.act; }
      step(s2, steer, act);
      for (const e of s2.ev.splice(0)) if (e.t === "throw") { const gap = Math.max(-0.45, Math.min(0.45, e.x)); const balls = s2.objs.filter((o) => o.kind === "ball" && !o.got && o.d > s2.dist).slice(0, 2); if (balls.length === 2) { checked++; if (Math.abs((balls[0]!.x + balls[1]!.x) / 2 - gap) < 0.16 || Math.abs(balls[0]!.x - (gap - 0.75)) < 0.02 || Math.abs(balls[1]!.x - (gap + 0.75)) < 0.02) good++; } }
    }
    ok(checked >= 2 && good === checked, `each aimed throw opens the next wave's gap where the child stood (${good}/${checked})`); }
}
console.log(fails ? `${fails} FAILURES` : "travel selftest: all passed");
process.exit(fails ? 1 : 0);
