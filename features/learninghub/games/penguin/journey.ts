// The journey: which stages are open, how many stars a run earned, what a stage's plan is made of, and what has been unlocked. PURE (server + client share it).
// Stars are for ACCURACY and playing without helpers, NEVER for speed. Stages open by MASTERY (2 stars = >= 80% first-try accuracy), never by time played.
import { makeRng } from "../../tools/engine/rng";
import { BIOMES, COSMETICS, MODIFIERS, POLICY, POWERS, STAGES, biomeOf, isDeviceCos, modifierOfDay, type Modifier, type PowerId, type StageDef } from "./config";
import { factKey, makeCfg, mix, selectPlan, universe, type Cfg, type FactState, type Form, type Plan, type PlanItem, type Summary } from "./core";

export type Stars = Record<string, number>;
export type StageStatus = "locked" | "open" | "done";
export interface StageState { def: StageDef; status: StageStatus; stars: number }

/** A fact is "secure" (session-level mastery) after 3 correct answers with no error in the last 3. Drives helper + wardrobe unlocks, never a lock on play. */
export const isSecure = (f: Pick<FactState, "correct" | "hist">) => f.correct >= 3 && !f.hist.slice(-3).includes("w");
export const securedCount = (facts: Iterable<FactState>) => { let n = 0; for (const f of facts) if (isSecure(f)) n++; return n; };

export interface JourneyView { stages: StageState[]; totalStars: number; maxStars: number; bossesCleared: number; biomesOpen: number }
/** `unlockAll` = the tutor / demo shortcut: every stage is open (stars are still earned honestly). */
export function journeyView(stars: Stars, unlockAll = false): JourneyView {
  const out: StageState[] = []; let prevOk = true;
  for (const def of STAGES) {
    const st = stars[def.id] ?? 0;
    const open = unlockAll || prevOk;
    out.push({ def, status: st > 0 ? "done" : open ? "open" : "locked", stars: st });
    prevOk = st >= POLICY.unlockStars;
  }
  const bosses = STAGES.filter((s) => s.boss);
  return {
    stages: out, totalStars: out.reduce((a, s) => a + s.stars, 0), maxStars: STAGES.length * 3, bossesCleared: bosses.filter((b) => (stars[b.id] ?? 0) >= 1).length,
    biomesOpen: new Set(out.filter((s) => s.status !== "locked").map((s) => s.def.biome)).size,
  };
}
export const isOpen = (stars: Stars, id: string, unlockAll = false) => { const v = journeyView(stars, unlockAll).stages.find((s) => s.def.id === id); return !!v && v.status !== "locked"; };

/** Stars for one run of a stage: 1 = you got to the end, 2 = >= 80% right first time, 3 = >= 92% right first time WITHOUT a helper. Never speed. */
export function starsFor(sum: Summary): number {
  if (!sum.done || sum.caught || sum.firstTry === 0) return 0;
  const acc = sum.firstTryCorrect / sum.firstTry;
  return 1 + (acc >= POLICY.starAccuracy[0] ? 1 : 0) + (acc >= POLICY.starAccuracy[1] && sum.helpUsed === 0 ? 1 : 0);
}

export interface Unlocks { powers: PowerId[]; cosmetics: string[] }
export function unlocksFor(stars: Stars, facts: Iterable<FactState>, unlockAll = false): Unlocks {
  const secured = securedCount(facts); const v = journeyView(stars, unlockAll);
  const perfect = Object.values(stars).filter((n) => n >= 3).length;
  const ok = (u: { secured?: number; stars?: number; boss?: number; perfect?: number }) => (u.secured === undefined || secured >= u.secured) && (u.stars === undefined || v.totalStars >= u.stars) && (u.boss === undefined || v.bossesCleared >= u.boss) && (u.perfect === undefined || perfect >= u.perfect);
  // items unlocked by things only the device knows (fish spent, friends rescued, buildings built) are never listed here: the client adds them from its own record
  return { powers: POWERS.filter((p) => ok(p.unlock)).map((p) => p.id), cosmetics: COSMETICS.filter((c) => !isDeviceCos(c) && ok(c.unlock)).map((c) => c.id) };
}

/** The run config for a stage (free play uses core.makeCfg directly). */
export function stageCfg(st: StageDef, o: { calm?: boolean; lanes?: 3 | 4; loadout?: PowerId[]; mod?: Modifier | null; tutorial?: boolean; approachSec?: number } = {}): Cfg {
  const b = biomeOf(st.biome);
  return makeCfg({
    mode: o.calm ? "calm" : "solo", calm: !!o.calm, n: st.n, lanes: o.lanes ?? (st.biome >= 3 || st.boss ? 4 : 3), forms: st.forms, maxNew: st.n, tables: st.tables, stage: st.id, biome: st.biome, style: b.style,
    shoals: st.shoals, chaser: st.boss ? b.chaser : null, loadout: o.loadout ?? [], mod: o.mod ?? null, tutorial: !!o.tutorial, approachSec: o.approachSec ?? 0,
  });
}

const ordered = (a: number, b: number): [number, number] => (a <= b ? [a, b] : [b, a]);
/** Facts for a stage, then forms: a plain stage mixes the allowed forms; a FAMILY stage (the boss) turns each chosen fact into its whole family (a x b, b x a, p / a, p / b);
 *  a COMBO stage follows each fact with its inverse ("6 x 7 = 42, so 42 / 6 = ?"). */
export function selectStagePlan(seed: number, cfg: Cfg, st: StageDef, snap: ReadonlyMap<string, FactState>, nowIso: string, rolling: number | null = null, theta?: number): Plan {
  const rng = makeRng(mix(seed, 202));
  const per = st.family ? 4 : st.combo ? 2 : 1;
  const nFacts = Math.max(3, Math.round(st.n / per));
  const base = selectPlan(seed, { ...cfg, n: nFacts, tables: st.tables, pinned: [], calm: false, maxNew: nFacts, chaser: null }, snap, nowIso, rolling, theta);
  // A "x2" stage asks x2 facts (never a stray 5 x 5): keep only facts with a stage table as a factor, then top up from that table's own facts.
  const inStage = (k: string) => { const m = /^x_(\d+)x(\d+)$/.exec(k); return !!m && (st.tables.includes(+m[1]!) || st.tables.includes(+m[2]!)); };
  const facts = [...new Map(base.items.filter((i) => inStage(i.k)).map((i) => [i.k, i])).values()].slice(0, nFacts);
  if (facts.length < nFacts) {
    const have = new Set(facts.map((f) => f.k)); const pool = rng.shuffle(universe(st.tables).filter((k) => !have.has(k)));
    for (const k of pool) { if (facts.length >= nFacts) break; facts.push({ k, o: "x", f: 0 }); }
  }
  while (facts.length < nFacts) facts.push(base.items[facts.length % base.items.length]!);
  const items: PlanItem[] = [];
  const others = st.forms.filter((f) => f !== "x") as Form[];
  facts.forEach((it, fam) => {
    const p = /^x_(\d+)x(\d+)$/.exec(it.k)!; const [a, b] = ordered(+p[1]!, +p[2]!);
    if (st.family) {
      items.push({ k: it.k, o: "x", f: 0, fam }, { k: it.k, o: "x", f: 1, fam }, { k: it.k, o: "d", f: 0, fam, d: 0 }, { k: it.k, o: "d", f: 0, fam, d: a === b ? 0 : 1 });
    } else if (st.combo) {
      items.push({ k: it.k, o: "x", f: rng.next() < 0.5 ? 0 : 1, fam }, { k: it.k, o: others[rng.int(0, others.length - 1)] ?? "d", f: 0, fam, combo: 1, d: rng.next() < 0.5 ? 0 : 1 });
    } else {
      items.push({ k: it.k, o: others.length && rng.next() < 0.45 ? others[rng.int(0, others.length - 1)]! : "x", f: rng.next() < 0.5 ? 0 : 1, fam });
    }
  });
  if (st.family) items[items.length - 1] = { ...items[items.length - 1]!, boss: 1 };
  const uniq = universe([2, 5, 10]);
  return { v: base.v, items: items.slice(0, st.n), rescue: [], tables: st.tables, allGold: false, unseen: base.unseen, ...(uniq ? {} : {}) };
}

/** Practice Pit: the child's weakest facts, calmly, no stars, no chaser. */
export function pitPlan(seed: number, cfg: Cfg, snap: ReadonlyMap<string, FactState>, nowIso: string, theta?: number): Plan {
  const weak = [...snap.values()].filter((f) => f.attempts > 0 && f.thaw < 3).sort((p, q) => p.thaw - q.thaw || (q.hist.split("w").length - p.hist.split("w").length) || (p.key < q.key ? -1 : 1)).slice(0, cfg.n).map((f) => f.key);
  const rng = makeRng(mix(seed, 303));
  if (weak.length < 3) return selectPlan(seed, cfg, snap, nowIso, null, theta);
  const items: PlanItem[] = rng.shuffle(weak).slice(0, cfg.n).map((k) => ({ k, o: "x" as Form, f: (rng.next() < 0.5 ? 0 : 1) as 0 | 1 }));
  while (items.length < Math.min(cfg.n, 6)) items.push({ ...items[items.length % Math.max(1, weak.length)]! });
  return { v: 1, items, rescue: [], tables: [], allGold: false, unseen: 0 };
}

export { BIOMES, STAGES, MODIFIERS, modifierOfDay, factKey };
