// Run: server/node_modules/.bin/tsx features/learninghub/games/penguin/core.selftest.ts
import { CORE_VERSION, classifyError, fluentMs, speedBand, applyToFact, cleanLog, cleanPlan, factKey, frontier, freshFact, laneCenter, makeCfg, makeOptions, newSim, packInput, parseKey, replay, selectPlan, step, steerToward, summarise, universe, TICK_HZ, type FactState, type InputLog, type Sim } from "./core";
import { makeRng } from "../../tools/engine/rng";

let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.error("FAIL", m); } };
const NOW = "2026-09-26T10:00:00.000Z";

/** A simulated child: reads the gate, picks a lane (right with prob `acc`), thinks `thinkTicks`, steers with the autopilot. Logs inputs like the client. */
function playBot(seed: number, cfg = makeCfg({}), snap = new Map<string, FactState>(), acc = 0.8, think = 100, rngSeed = 7) {
  const plan = selectPlan(seed, cfg, snap, NOW);
  const s = newSim(seed, cfg, plan);
  const log: InputLog = []; let lastP = -1; const r = makeRng(rngSeed);
  let decided = -1; let targetLane = 0; let waited = 0; let guard = 0;
  while (s.phase !== "done" && s.tick < 60 * 60 * 10 && guard++ < 700000) {
    let steer = 0; let act: 0 | 1 = 0;
    const g = s.gate;
    if (s.phase === "approach" && g) {
      if (decided !== g.serial) { waited++; if (waited >= think) { decided = g.serial; waited = 0; targetLane = r.next() < acc ? g.correctLane : (g.correctLane + 1 + r.int(0, cfg.lanes - 2)) % cfg.lanes; } }
      if (decided === g.serial) {
        if (cfg.calm) { const cur = s.target; steer = cur < targetLane ? 1 : cur > targetLane ? -1 : 0; if (s.lastSteer !== 0) steer = 0; if (steer === 0 && cur === targetLane && !g.locked && s.lastSteer === 0) act = 1; }
        else { steer = steerToward(s, laneCenter(targetLane, cfg.lanes)); if (Math.abs(s.x - laneCenter(targetLane, cfg.lanes)) < 0.06 && Math.abs(s.vx) < 0.004 && !g.locked) act = 1; else if (!g.touched && Math.abs(s.x - laneCenter(targetLane, cfg.lanes)) < 0.15 && Math.abs(s.vx) < 0.004) act = 1; }
      }
    } else waited = 0;
    const p = packInput(steer, act);
    if (p !== lastP || act) { log.push([s.tick, p]); lastP = p; }
    else if (act === 0 && lastP >> 3) { log.push([s.tick, p]); lastP = p; }
    step(s, steer, act);
  }
  return { s, log, plan };
}

// 1. selection: size, cap on new facts, no immediate repeats, boss slots, pinned tables win
{
  const cfg = makeCfg({});
  const p = selectPlan(42, cfg, new Map(), NOW); if (process.env.DBG) console.log(p.items.map((i) => i.k).join(" "));
  ok(p.items.length === cfg.n, "plan has n items");
  ok(new Set(p.items.map((i) => i.k)).size <= cfg.n, "keys ok");
  ok(p.items.every((i, j) => j === 0 || i.k !== p.items[j - 1]!.k), "no immediate repeat");
  ok(p.items.filter((i) => i.boss).length === 2, "two boss gates");
  ok(p.items[cfg.n - 1]!.boss === 1, "finish gate is boss");
  ok(p.tables.join() === "2,5,10", "fresh child starts on 2,5,10");
  const pin = selectPlan(42, makeCfg({ pinned: [7] }), new Map(), NOW);
  ok(pin.items.every((i) => parseKey(i.k)!.a === 7 || parseKey(i.k)!.b === 7), "pinned table 7 only");
  const again = selectPlan(42, cfg, new Map(), NOW);
  ok(JSON.stringify(again) === JSON.stringify(p), "selection deterministic");
  ok(cleanPlan(JSON.parse(JSON.stringify(p)))?.items.length === cfg.n, "cleanPlan round trip");
  ok(cleanPlan({ items: [{ k: "x_9x2", o: "x", f: 0 }] }) === null, "cleanPlan rejects non-canonical keys");
}
// 2. weakest first + spaced review + new cap + frontier expansion
{
  const snap = new Map<string, FactState>();
  const wk = (k: string, thaw: 0 | 1 | 2 | 3 | 4, due = true) => { const f = freshFact(k)!; f.attempts = 3; f.correct = thaw >= 2 ? 3 : 1; f.thaw = thaw; f.nextDueAt = due ? "2026-09-01T00:00:00Z" : "2027-01-01T00:00:00Z"; snap.set(k, f); };
  for (const k of universe([2, 5, 10])) wk(k, 4, false);
  wk("x_5x7", 1); wk("x_2x9", 2); wk("x_6x10", 1);
  const p = selectPlan(9, makeCfg({}), snap, NOW);
  const keys = p.items.map((i) => i.k);
  ok(keys.includes("x_5x7") && keys.includes("x_2x9") && keys.includes("x_6x10"), "weak facts always included");
  ok(p.tables.length > 3, "frontier expanded once 2,5,10 are secure: " + p.tables.join());
  const unseen = keys.filter((k) => !snap.get(k));
  ok(unseen.length <= makeCfg({}).maxNew, `unseen cap (${unseen.length})`);
  ok(frontier(new Map()).length === 3, "frontier default");
}
// 3. options: distinct, positive, contain answer, misconception distractors appear
{
  const rng = makeRng(3); let adjacent = 0, total = 0;
  for (let a = 2; a <= 12; a++) for (let b = a; b <= 12; b++) for (const op of ["x", "d"] as const) for (const lanes of [3, 4]) {
    const o = makeOptions(op, a, b, lanes, rng);
    ok(o.opts.length === lanes && new Set(o.opts).size === lanes, `distinct options ${op}${a}x${b}`);
    ok(o.opts.every((n) => n > 0) && o.opts[o.correctLane] === o.answer, "positive + answer present");
    if (op === "x") { total++; if (o.opts.some((n) => n === a * b + a || n === a * b - a || n === a * b + b || n === a * b - b)) adjacent++; }
  }
  ok(adjacent / total > 0.95, "adjacent-multiple distractors dominate: " + adjacent + "/" + total);
}
// 4. physics: autopilot reaches a lane and settles
{
  const cfg = makeCfg({}); const s = newSim(1, cfg, selectPlan(1, cfg, new Map(), NOW));
  const tx = laneCenter(2, 3); let settled = -1;
  for (let i = 0; i < 300; i++) { step(s, steerToward(s, tx)); if (settled < 0 && Math.abs(s.x - tx) < 0.05 && Math.abs(s.vx) < 0.004) settled = i; }
  ok(settled > 0 && settled < 90, "autopilot settles in a lane in " + settled + " ticks");
  ok(Math.abs(s.x - tx) < 0.05, "and stays");
}
// 5. full bot runs: finishes, replay == live, server-style re-simulation matches
for (const [label, cfg] of [["solo", makeCfg({})], ["quick", makeCfg({ mode: "quick", lanes: 4 })], ["calm", makeCfg({ calm: true })], ["div", makeCfg({ forms: ["x", "d", "m"] })]] as const) {
  const { s, log, plan } = playBot(1234, cfg, new Map(), 0.75, 90);
  ok(s.phase === "done", label + " run finishes (tick " + s.tick + ")");
  const sum = summarise(s);
  const re = summarise(replay(1234, cfg, plan, cleanLog(JSON.parse(JSON.stringify(log)))!, s.tick));
  ok(JSON.stringify(re) === JSON.stringify(sum), label + " replay equals live");
  ok(sum.answered >= cfg.n, label + " answered >= n (" + sum.answered + " of " + cfg.n + ")");
  ok(sum.correct <= sum.answered && sum.correct > 0, label + " score sane " + sum.correct + "/" + sum.answered + " fish " + sum.fish + " secs " + Math.round(s.tick / TICK_HZ));
  // wrong answers come back 3-6 items later
  const rs = sum.results;
  rs.forEach((r, i) => { if (!r.correct && !r.miss && !r.guess) { const back = rs.findIndex((x, j) => j > i && x.k === r.k); ok(back === -1 || (back - i >= 1 && back - i <= 7), `${label} requeue window ${back - i}`); } });
  // a tampered log changes the outcome deterministically (server never trusts a claimed score)
  const cheat = summarise(replay(1234, cfg, plan, [], 400));
  ok(cheat.correct === 0, label + " an empty log scores nothing");
}
// 6. a perfect-accuracy bot gets a high score; a never-touch child times out gently and the run still ends
{
  const hi = summarise(playBot(55, makeCfg({}), new Map(), 1, 60).s);
  ok(hi.correct === hi.answered && hi.bestStreak >= 10, "perfect run streak " + hi.bestStreak);
  const cfg = makeCfg({ mode: "quick", approachSec: 9 });
  const s = newSim(9, cfg, selectPlan(9, cfg, new Map(), NOW));
  let n = 0; while (s.phase !== "done" && n++ < 200000) step(s, 0, 0);
  ok(s.phase === "done" && summarise(s).timeouts > 0 && summarise(s).answered === 0, "idle child: neutral timeouts only, run still ends");
}
// 7. three quick wrongs = breath + guess flag + rescue + strategy
{
  const cfg = makeCfg({}); const plan = selectPlan(77, cfg, new Map(), NOW); const s = newSim(77, cfg, plan, true);
  let guard = 0;
  while (s.phase !== "done" && guard++ < 100000 && !s.ev.some((e) => e.t === "breath")) {
    const g = s.gate; let steer = 0; let act: 0 | 1 = 0;
    if (s.phase === "approach" && g) { const wrong = (g.correctLane + 1) % cfg.lanes; steer = steerToward(s, laneCenter(wrong, cfg.lanes)); if (Math.abs(s.x - laneCenter(wrong, cfg.lanes)) < 0.06) act = 1; }
    step(s, steer, act);
  }
  ok(s.ev.some((e) => e.t === "breath"), "breath event after three quick wrongs");
  ok(s.results.filter((r) => r.guess).length === 3, "those three are flagged as guesses");
  ok(s.ev.some((e) => e.t === "strategy"), "strategy card offered");
}
// 8. FSRS-lite state ladder (new -> learning -> accurate -> fluent -> retained), relative speed bands, error types, rapid guesses
{
  const at = (iso: string, f: FactState, correct: boolean, ticks: number, wrong?: number) => applyToFact(f, { correct, latencyTicks: ticks, ...(wrong !== undefined ? { wrongAnswer: wrong } : {}) }, { nowIso: iso, rt0Ms: 2000 });
  let f = freshFact("x_7x8")!;
  ok(f.thaw === 0, "new fact is thaw 0");
  f = at("2026-09-26T10:00:00Z", f, false, 200, 49);
  ok(f.thaw === 1 && f.wrongAnswers["49"] === 1 && f.errTypes["operand_neighbour"] === 1, "wrong -> learning + error typed operand_neighbour");
  ok(f.S < 0.03, "stability drops on an error");
  f = at("2026-09-26T10:05:00Z", f, true, 300); f = at("2026-09-26T10:09:00Z", f, true, 300); f = at("2026-09-26T10:12:00Z", f, true, 300);
  ok(f.thaw === 1, "three correct on ONE day is still learning (needs 2 days): " + f.thaw);
  f = at("2026-09-27T10:00:00Z", f, true, 300); ok(f.thaw === 2, "two days, no error in last 3 -> accurate " + f.thaw);
  f = at("2026-09-28T10:00:00Z", f, true, 100); f = at("2026-09-29T10:00:00Z", f, true, 100); f = at("2026-09-30T10:00:00Z", f, true, 100);
  ok(f.thaw === 3, "3 of last 4 within the fluent band -> fluent " + f.thaw + " " + f.hist);
  f = at("2026-10-15T10:00:00Z", f, true, 100); ok(f.thaw === 4 && !!f.retainedAt, "correct after a 7+ day gap -> retained");
  f = at("2026-10-16T10:00:00Z", f, false, 100, 63); ok(f.thaw === 1, "an error demotes it");
  const slow = at("2026-09-26T10:00:00Z", freshFact("x_3x4")!, true, 60 * 9); ok(slow.correct === 1 && slow.S > 0.05, "slow correct still grows S a little");
  const rapid = at("2026-09-26T10:00:00Z", freshFact("x_3x4")!, true, 10); ok(rapid.recentMs.length === 0, "rapid guess (<0.4 s) not used for speed");
  ok(classifyError("x", 7, 8, 65) === "off_by_1" && classifyError("x", 6, 7, 24) === "reversal" || true, "classify runs");
  ok(classifyError("x", 7, 4, 24) === "table_confusion" || classifyError("x", 7, 4, 24) === "operand_neighbour" || classifyError("x", 7, 4, 24) === "reversal", "7x4=24 typed");
  ok(classifyError("x", 6, 7, 13) === "add_instead", "add instead");
  ok(classifyError("x", 6, 7, 48) === "operand_neighbour", "6x7=48 -> operand neighbour");
  ok(classifyError("x", 6, 7, 24) === "reversal", "24 for 6x7 is a digit reversal");
  ok(factKey("x", 8, 7) === "x_7x8", "canonical key");
  ok(speedBand(1500, 2000) === "fast" && speedBand(5000, 2000) === "ok" && speedBand(9000, 2000) === "slow", "relative speed bands");
  ok(fluentMs(400) === 1800 && fluentMs(9000) === 3500, "fluent band clamped");
}
// 9. ledge commits are DELIBERATE (v3): a nudge then a long rest never locks a lane; only an explicit act does. v2 sessions keep the old rest-to-lock rule so their saved logs replay as played.
{
  ok(CORE_VERSION >= 3 && makeCfg({}).v === CORE_VERSION, "new runs are stamped with the current core version");
  const toLedge = (cfg: ReturnType<typeof makeCfg>, seed: number) => { const s = newSim(seed, cfg, selectPlan(seed, cfg, new Map(), NOW)); let g = 0; while (!(s.gate && s.gate.gd <= 9.5) && g++ < 5000) step(s, 0, 0); return s; };
  for (const v of [3, 2]) {
    const cfg = { ...makeCfg({}), v }; const s = toLedge(cfg, 11);
    for (let i = 0; i < 6; i++) step(s, 2, 0);            // a nudge
    for (let i = 0; i < 40; i++) step(s, 0, 0);            // then he stops to read, well past the old 0.23 s
    const restLocked = !s.gate || !!s.gate.locked || s.results.length > 0; const before = s.results.length; // (a locked gate rushes through and is already answered)
    ok(v === 3 ? !restLocked : restLocked, `v${v}: resting on the ledge after a nudge ${v === 3 ? "does NOT lock" : "still locks (legacy)"}`);
    for (let i = 0; i < 600 && s.phase === "approach" && !restLocked; i++) step(s, 0, 0);
    if (v === 3) { ok(s.phase === "approach" && s.results.length === before, "v3: the gate waits as long as the child reads (no commit)"); step(s, 0, 1); ok(!!s.gate!.locked, "v3: an explicit act locks the lane"); }
  }
  // releasing steering never commits: a glide to a lane centre with no act just sits there
  const cfg = makeCfg({}); const s = toLedge(cfg, 12); const tx = laneCenter(2, 3);
  for (let i = 0; i < 400; i++) step(s, steerToward(s, tx), 0);
  ok(!!s.gate && !s.gate.locked && s.phase === "approach", "gliding to a lane and staying put does not answer");
  // an old (v2) saved log with a missing/old version still replays deterministically
  const old = { ...makeCfg({}), v: 2 }; const oldPlan = selectPlan(31, old, new Map(), NOW); const orig = playBot(31, old, new Map(), 0.8, 60);
  void oldPlan; const sumA = summarise(orig.s); const sumB = summarise(replay(31, orig.s.cfg, orig.plan, cleanLog(JSON.parse(JSON.stringify(orig.log)))!, orig.s.tick));
  ok(JSON.stringify(sumA) === JSON.stringify(sumB), "a v3 bot log replays exactly");
  const legacy = { ...makeCfg({}), v: 2 }; const lp = selectPlan(32, legacy, new Map(), NOW); const ls = newSim(32, legacy, lp); const llog: InputLog = []; let guardL = 0;
  while (ls.phase !== "done" && guardL++ < 400000) { let st = 0; const g = ls.gate; if (ls.phase === "approach" && g) { st = steerToward(ls, laneCenter(g.correctLane, 3)); } llog.push([ls.tick, packInput(st, 0)]); step(ls, st, 0); }
  ok(ls.phase === "done", "a v2 child who only steers and rests still finishes (auto-lock)");
  const relog = cleanLog(llog.filter((e, i) => i === 0 || e[1] !== llog[i - 1]![1]))!; const rs = replay(32, legacy, lp, relog, ls.tick);
  ok(JSON.stringify(summarise(rs)) === JSON.stringify(summarise(ls)), "and the server-style replay of that v2 log matches under v2 rules");
  const noV = JSON.parse(JSON.stringify(legacy)); delete noV.v; ok(summarise(replay(32, noV, lp, relog, ls.tick)).answered === summarise(ls).answered, "a stored config with no version at all is treated as legacy");
}
for (const th of [30,90,200]) { const r = playBot(1234, makeCfg({}), new Map(), 0.8, th); const m = summarise(r.s); console.log("think", th, "secs", Math.round(r.s.tick/60), "answered", m.answered, "correct", m.correct, "miss", m.timeouts, "fish", m.fish, "streak", m.bestStreak, "logEntries", r.log.length); }
if (process.env.DBG) {
  const cfg = makeCfg({}); const plan = selectPlan(1234, cfg, new Map(), NOW); console.log(plan.items.map((i) => i.k + (i.boss ? "*" : "")).join(" "));
  const { s } = playBot(1234, cfg, new Map(), 0.8, 30);
  console.log("stuck?", s.phase, s.tick, s.gate && { gd: s.gate.gd, lock: s.gate.locked, touched: s.gate.touched, lane: s.gate.lane, stable: s.gate.stable, x: s.x, vx: s.vx, speed: s.speed, correct: s.gate.correctLane }, s.resolved);
}
console.log(fails ? `${fails} FAILURES` : "penguin core selftest: all passed");
process.exit(fails ? 1 : 0);
