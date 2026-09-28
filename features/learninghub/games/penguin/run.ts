// Build a run from a start request: which stage / mode, the config, the plan. PURE: shared by the SERVER (which is the authority) and the offline demo.
import { POLICY, modifierOfDay, stageById, type Form, type PowerId } from "./config";
import { frontier, makeCfg, selectPlan, type Cfg, type FactState, type Plan } from "./core";
import { isOpen, pitPlan, selectStagePlan, stageCfg, unlocksFor } from "./journey";
import { bestKey, type ProfileLite } from "./record";

export interface StartBody { mode?: unknown; stageId?: unknown; loadout?: unknown; tables?: unknown; lanes?: unknown; forms?: unknown; timer?: unknown; calm?: unknown }
export type Built = { ok: true; cfg: Cfg; plan: Plan; key: string } | { ok: false; status: number; error: string };

export function buildRun(o: { body: StartBody; facts: ReadonlyMap<string, FactState>; profile: ProfileLite; support: { calm?: boolean; noTimer?: boolean }; age: number | null; nowIso: string; seed: number; firstEver: boolean }): Built {
  const { body, facts, profile, nowIso, seed } = o;
  const wantCalm = !!(o.support.calm || o.support.noTimer || body.calm === true || body.mode === "calm");
  let attempts = 0, correct = 0; for (const f of facts.values()) { attempts += f.attempts; correct += f.correct; }
  // 3 lanes for the younger ones, 4 once they are fluent (>= 20 answers at >= 90%) or 9+; a request may only ask for MORE lanes.
  const fluent = attempts >= 20 && correct / attempts >= 0.9;
  const lanes: 3 | 4 = fluent || (o.age ?? 0) >= 9 || body.lanes === 4 ? 4 : 3;
  const rolling = profile.roll.length >= 10 ? profile.roll.reduce((a, b) => a + b, 0) / profile.roll.length : null;
  // NO timer by default. A soft "sprint" is opt-in only, never for a child whose support profile says noTimer / calm.
  const soft = body.timer === "soft" && !wantCalm;
  const approachSec = soft ? ((o.age ?? 9) < 8 ? 12 : 9) : 0;
  const unlocks = unlocksFor(profile.journey, facts.values(), profile.unlockAll);

  if (typeof body.stageId === "string") {
    const st = stageById(body.stageId);
    if (!st) return { ok: false, status: 400, error: "Unknown stage" };
    if (!isOpen(profile.journey, st.id, profile.unlockAll)) return { ok: false, status: 403, error: "That stage is still locked - earn 2 stars on the one before it" };
    const loadout = (Array.isArray(body.loadout) ? body.loadout : []).filter((p): p is PowerId => typeof p === "string" && (unlocks.powers as string[]).includes(p)).slice(0, POLICY.loadoutSlots);
    const cfg = stageCfg(st, { calm: wantCalm, lanes, loadout: wantCalm ? [] : loadout, tutorial: o.firstEver && st.id === "b1s1", approachSec });
    return { ok: true, cfg, plan: selectStagePlan(seed, cfg, st, facts, nowIso, rolling, profile.theta), key: st.id };
  }
  if (body.mode === "pit") {
    const cfg = makeCfg({ mode: wantCalm ? "calm" : "solo", calm: wantCalm, n: 8, maxNew: 0, lanes, forms: ["x"] });
    return { ok: true, cfg, plan: pitPlan(seed, cfg, facts, nowIso, profile.theta), key: "pit" };
  }
  const mode = wantCalm ? "calm" : body.mode === "quick" ? "quick" : "solo";
  const forms = (Array.isArray(body.forms) && (o.age ?? 9) >= 8 ? (body.forms as unknown[]).filter((f): f is Form => f === "x" || f === "d" || f === "m") : ["x"]) as Form[];
  if (body.mode === "daily") {
    const mod = modifierOfDay(nowIso.slice(0, 10));
    const cfg = makeCfg({ mode: wantCalm ? "calm" : "solo", calm: wantCalm, n: 10, lanes, mod, forms: mod === "backwards" ? ["x", "d", "m"] : ["x"], approachSec });
    if (mod === "family") { // family day: the boss recipe (a fact in all four forms) on the child's current tables, without the chaser
      const st = { id: "daily", biome: 1, idx: 1, boss: false, tables: frontier(facts), forms: ["x", "d"] as Form[], n: 12, family: true, shoals: false, combo: false } as const;
      const fc = makeCfg({ mode: wantCalm ? "calm" : "solo", calm: wantCalm, n: 12, lanes, mod, forms: ["x", "d"], approachSec });
      return { ok: true, cfg: fc, plan: selectStagePlan(seed, fc, st, facts, nowIso, rolling, profile.theta), key: "daily" };
    }
    const base = { ...cfg };
    return { ok: true, cfg: base, plan: selectPlan(seed, base, facts, nowIso, rolling, profile.theta), key: "daily" };
  }
  const cfg = makeCfg({ mode, calm: wantCalm, lanes, tables: Array.isArray(body.tables) ? (body.tables as unknown[]).map(Number) : [], pinned: profile.pinned, forms, approachSec, tutorial: o.firstEver });
  return { ok: true, cfg, plan: selectPlan(seed, cfg, facts, nowIso, rolling, profile.theta), key: bestKey(cfg) };
}
