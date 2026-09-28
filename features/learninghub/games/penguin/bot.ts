// A simulated child for tests: reads the current gate, decides after `think` ticks, steers with the same autopilot the game uses, locks in, uses helpers when asked.
// It drives the real deterministic core, so a log it produces is exactly what a browser would send. Pure (tests + e2e only; never shipped to the child).
import { makeRng } from "../../tools/engine/rng";
import { laneCenter, newSim, packInput, step, steerToward, TRICK_MIN_AIR, type Cfg, type InputLog, type Plan, type Sim } from "./core";

export interface BotOpts { acc?: number; think?: number; useHint?: boolean; rngSeed?: number; /** 0 = never steers while travelling (takes hits), 1 = dodges hazards and chases fish, tricks off ramps */ skill?: 0 | 1; /** keep the event list (tests only) */ emit?: boolean }

/** Where a competent child would be while travelling: away from hazards, toward fish. (Also flops through drifts and taps tricks in the air.) */
export function travelPlan(s: Sim): { x: number; act: 0 | 1 } {
  let best = s.x, bestCost = 1e9; let act: 0 | 1 = 0;
  for (let xi = -9; xi <= 9; xi++) {
    const x = xi / 10; let cost = Math.abs(x - s.x) * 0.6;
    for (const o of s.objs) {
      const z = o.d - s.dist; if (o.got || z < 0 || z > 26) continue; const dx = Math.abs(x - o.x);
      if (o.kind === "rock" || o.kind === "ball") { if (dx < o.w + 0.16) cost += 40 - z; else if (dx < o.w + 0.36) cost += (30 - z) * 0.25; }
      else if (o.kind === "drift") { if (dx < o.w + 0.1) cost += 6; }
      else if (o.kind === "ring") { if (dx < o.w + 0.02) cost -= 3 * (o.v || 1); }
      else if (o.kind === "fish" || o.kind === "crystal" || o.kind === "pad" || o.kind === "bag") { if (dx < 0.14) cost -= 3 * (o.v || 1); }
      else if (o.kind === "ramp") { if (dx < 0.16) cost -= 4; }
      else if (o.kind === "friend") { if (!s.friend && dx < 0.14) cost -= 6; }
      else if (o.kind === "sky" && s.air > 0) { if (dx < 0.16) cost -= 3; }
    }
    if (cost < bestCost) { bestCost = cost; best = x; }
  }
  if (s.air > TRICK_MIN_AIR && s.tricks < 3 && s.trickCd === 0) act = 1;
  for (const o of s.objs) { const z = o.d - s.dist; if (o.kind === "drift" && !o.got && z > 0 && z < 4 && Math.abs(s.x - o.x) < o.w + 0.1) act = 1; if (o.kind === "friend" && !o.got && !s.friend && z > 0 && z < 3.5 && Math.abs(s.x - o.x) < o.w + 0.05) act = 1; }
  return { x: best, act };
}
export function playBot(seed: number, cfg: Cfg, plan: Plan, o: BotOpts = {}): { sim: Sim; log: InputLog; endTick: number } {
  const acc = o.acc ?? 0.9, think = o.think ?? 40;
  const s = newSim(seed, cfg, plan, !!o.emit); const log: InputLog = []; let last = -1; const r = makeRng((o.rngSeed ?? seed) ^ 77);
  let decided = -1, targetOpt = 0, wait = 0, guard = 0;
  while (s.phase !== "done" && s.tick < 60 * 60 * 10 && guard++ < 700000) {
    let steer = 0, act: 0 | 1 = 0, power: 0 | 1 | 2 | 3 = 0; const g = s.gate;
    if (s.phase === "approach" && g) {
      if (decided !== g.serial) {
        if (++wait >= think) {
          decided = g.serial; wait = 0;
          const live = g.opts.map((x, i) => (x === null ? -1 : i)).filter((i) => i >= 0 && i !== g.correctLane);
          targetOpt = r.next() < acc || !live.length ? g.correctLane : live[r.int(0, live.length - 1)]!;
          if (o.useHint && s.charges.hint > 0 && !g.hinted) power = 1;
        }
      }
      if (decided === g.serial) {
        const lane = g.perm.indexOf(targetOpt);
        if (cfg.calm) { const cur = s.target; steer = cur < lane ? 1 : cur > lane ? -1 : 0; if (s.lastSteer !== 0) steer = 0; if (steer === 0 && cur === lane && !g.locked && s.lastSteer === 0) act = 1; }
        else { const tx = laneCenter(lane, cfg.lanes); steer = steerToward(s, tx); if (!g.locked && Math.abs(s.vx) < 0.004 && Math.abs(s.x - tx) < 0.15) act = 1; }
      }
    } else { wait = 0; if (o.skill === 1 && s.phase === "travel") { const tp = travelPlan(s); steer = steerToward(s, tp.x); act = tp.act; } }
    const p = packInput(steer, act, power);
    if (p !== last || act || power) { log.push([s.tick, p]); last = p; }
    step(s, steer, act, power);
  }
  return { sim: s, log, endTick: s.tick };
}
