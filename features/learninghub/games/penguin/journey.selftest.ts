// Run: server/node_modules/.bin/tsx features/learninghub/games/penguin/journey.selftest.ts
import { COSMETICS, STAGES, POWERS, isDeviceCos } from "./config";
import { cleanLog, cleanPlan, laneCenter, newSim, packInput, replay, step, steerToward, summarise, type FactState, type InputLog, type Sim } from "./core";
import { journeyView, pitPlan, selectStagePlan, stageCfg, starsFor, unlocksFor } from "./journey";
import { freshFact } from "./core";
import { playBot } from "./bot";

let fails = 0; const ok = (c: unknown, m: string) => { if (!c) { fails++; console.error("FAIL", m); } };
const NOW = "2026-09-26T10:00:00.000Z";

function play(seed: number, cfg: ReturnType<typeof stageCfg>, plan: ReturnType<typeof selectStagePlan>, acc: number, useHelp = false) {
  const r = playBot(seed, cfg, plan, { acc, useHint: useHelp, rngSeed: seed });
  return { s: r.sim, log: r.log };
}

// 1. every stage has a valid, deterministic plan and a bot can finish it; replay == live
for (const st of STAGES) {
  const cfg = stageCfg(st);
  const plan = selectStagePlan(42, cfg, st, new Map(), NOW);
  ok(plan.items.length >= Math.min(st.n, 8) && plan.items.length <= st.n, `${st.id} plan size ${plan.items.length}`);
  ok(JSON.stringify(selectStagePlan(42, cfg, st, new Map(), NOW)) === JSON.stringify(plan), `${st.id} plan deterministic`);
  ok(cleanPlan(JSON.parse(JSON.stringify(plan)))?.items.length === plan.items.length, `${st.id} plan survives cleanPlan`);
  if (st.family) {
    ok(plan.items.length % 4 === 0, `${st.id} family stage is made of 4s`);
    for (let i = 0; i < plan.items.length; i += 4) { const g = plan.items.slice(i, i + 4); ok(new Set(g.map((x) => x.k)).size === 1 && g[0]!.o === "x" && g[2]!.o === "d", `${st.id} family ${i / 4} is one fact in four forms`); }
  }
  if (st.combo && !st.family) ok(plan.items.filter((i) => i.combo).length === plan.items.length / 2, `${st.id} combos follow their fact`);
  const { s, log } = play(42, cfg, plan, 0.9);
  const sum = summarise(s);
  ok(s.phase === "done", `${st.id} bot finishes (tick ${s.tick})`);
  const re = summarise(replay(42, cfg, plan, cleanLog(JSON.parse(JSON.stringify(log)))!, s.tick));
  ok(JSON.stringify(re) === JSON.stringify(sum), `${st.id} replay equals live`);
  const stars = starsFor(sum);
  ok(stars >= 0 && stars <= 3, `${st.id} stars ${stars} (${sum.firstTryCorrect}/${sum.firstTry}, help ${sum.helpUsed}, caught ${sum.caught})`);
}

// 2. a boss chaser is gentle but real: three wrong in a row lets it catch you, and a caught run is a stop, not a failure state
{
  const st = STAGES.find((x) => x.id === "b1s4")!; const cfg = stageCfg(st); const plan = selectStagePlan(9, cfg, st, new Map(), NOW);
  const { s } = play(9, cfg, plan, 0);
  ok(s.caught && s.phase === "done", "chaser catches a child who answers nothing right");
  ok(starsFor(summarise(s)) === 0, "caught = 0 stars (try again), the facts still count");
  const good = play(9, cfg, plan, 1).s; const gs = summarise(good); ok(!good.caught && starsFor(gs) === 3, "perfect boss run = 3 stars " + JSON.stringify({ d: gs.done, ft: gs.firstTry, fc: gs.firstTryCorrect, h: gs.helpUsed, c: gs.caught, n: gs.answered }));
}
// 3. shoals really move blocks, and only until the child commits
{
  const st = STAGES.find((x) => x.id === "b4s1")!; const cfg = stageCfg(st); const plan = selectStagePlan(5, cfg, st, new Map(), NOW);
  const s = newSim(5, cfg, plan, true); let shifts = 0;
  for (let i = 0; i < 700; i++) { step(s, 0, 0); shifts += s.ev.filter((e) => e.t === "shift").length; s.ev.length = 0; }
  ok(shifts >= 2, "idle child: the shoal drifts (" + shifts + " shifts)");
  const perm = s.gate?.perm.join(",");
  const { s: p2 } = play(5, cfg, plan, 1); ok(p2.phase === "done" && summarise(p2).correct === summarise(p2).answered, "a committed child is not shifted under");
  void perm;
}
// 4. helpers cost the 3rd star, nothing else; loadout is validated to slots + known powers
{
  const st = STAGES.find((x) => x.id === "b1s3")!;
  const cfg = stageCfg(st, { loadout: ["hint", "shield", "magnet", "freeze", "bogus" as never] }); ok(cfg.loadout.length === 2, "loadout capped at 2 slots and unknown powers dropped");
  const cfgH = stageCfg(st, { loadout: ["hint"] }); const plan = selectStagePlan(3, cfgH, st, new Map(), NOW);
  const { s } = play(3, cfgH, plan, 1, true); const sum = summarise(s);
  ok(sum.helpUsed >= 1 && starsFor(sum) === 2, "using a hint fish: still 2 stars, never the 3rd (" + starsFor(sum) + ", help " + sum.helpUsed + ")");
}
// 5. unlock rules: mastery (2 stars) opens the next stage; a tutor can open everything; powers/cosmetics are deterministic
{
  let v = journeyView({}); ok(v.stages[0]!.status === "open" && v.stages[1]!.status === "locked", "only the first stage is open at the start");
  v = journeyView({ b1s1: 1 }); ok(v.stages[1]!.status === "locked", "1 star does not open the next stage (replay it)");
  v = journeyView({ b1s1: 2 }); ok(v.stages[1]!.status === "open", "2 stars open the next stage");
  ok(journeyView({}, true).stages.every((s) => s.status !== "locked"), "tutor / demo unlock-all");
  const facts: FactState[] = ["x_2x3", "x_2x4", "x_2x5", "x_2x6", "x_2x7"].map((k) => ({ ...freshFact(k)!, attempts: 3, correct: 3, hist: "ccc" }));
  const u = unlocksFor({}, facts); ok(u.powers.includes("hint") && !u.powers.includes("freeze"), "hint fish unlocked by 3 secure facts, freeze not yet");
  ok(u.cosmetics.includes("scarf") && u.cosmetics.includes("cap") && !u.cosmetics.includes("crown"), "scarf at 4 secure facts, crown not yet");
  ok(POWERS.length === 5, "five earned helpers");
  // the wardrobe: 40 items, all EARNED (mastery, stars, bosses, 3-star stages, friends, the village, or fish collected by playing); the server never lists what only the device can know
  ok(COSMETICS.length === 40 && new Set(COSMETICS.map((c) => c.id)).size === 40, "40 distinct wardrobe items (" + COSMETICS.length + ")");
  ok(COSMETICS.every((c) => Object.keys(c.unlock).every((k) => ["secured", "stars", "boss", "perfect", "friends", "built", "fish"].includes(k))), "every unlock is a deterministic, earned condition (no random, no money)");
  const serverList = unlocksFor({}, facts).cosmetics; ok(COSMETICS.filter((c) => isDeviceCos(c)).every((c) => !serverList.includes(c.id)), "device-only items (friends, buildings, fish) are never handed out by the server");
  const allStars = Object.fromEntries(STAGES.map((s2) => [s2.id, 3])); const rich = unlocksFor(allStars, facts); ok(rich.cosmetics.includes("tophat") && rich.cosmetics.includes("snowboard") && rich.cosmetics.includes("spacehelmet"), "3-star stages unlock the top hat, snowboard and space helmet");
  ok(!unlocksFor({}, facts).cosmetics.includes("tophat"), "and a beginner has none of them");
}
// 6. Practice Pit picks the weakest facts
{
  const snap = new Map<string, FactState>(); for (const [k, thaw] of [["x_6x7", 1], ["x_7x8", 1], ["x_6x8", 2], ["x_2x3", 4], ["x_5x5", 3]] as const) snap.set(k, { ...freshFact(k)!, attempts: 3, correct: thaw > 1 ? 3 : 1, hist: thaw > 1 ? "ccc" : "cw", thaw });
  const p = pitPlan(1, stageCfg(STAGES[0]!, { calm: true }), snap, NOW); const keys = p.items.map((i) => i.k);
  ok(keys.includes("x_6x7") && keys.includes("x_7x8") && !keys.includes("x_2x3"), "pit = weak facts only");
}
console.log(fails ? `${fails} FAILURES` : "journey selftest: all passed");
process.exit(fails ? 1 : 0);
