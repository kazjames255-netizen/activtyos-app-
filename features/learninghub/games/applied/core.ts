// Shared, pure, seeded item generation + marking for the applied-maths cluster: Market Day (money/economics),
// Bake Off Blitz (measurement/ratio/proportion) and Rhythm Reef (pattern/sequencing). Per docs/games-prototypes/
// BACKEND-PATTERN.md step 1, these are genuinely different skill domains from each other (and from the times-tables
// fact fluency of Penguin/Turbo Slide), so each models its own item shapes here rather than being forced into the
// x/d/m fact-key shape. They share ONE typed-answer session flow (like features/learninghub/games/penguin/mtc.ts):
// the server issues a form of items built from a seed, the client shows them and collects answers, the server
// re-marks the SAME stored items it issued. The browser never sees an answer key.
import { makeRng, type Rng } from "../../tools/engine/rng";

export type GameId = "market" | "bakeoff" | "reef";
export const GAME_IDS: readonly GameId[] = ["market", "bakeoff", "reef"];
export const ITEMS_PER_RUN = 8;
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;
export type Level = 1 | 2 | 3 | 4 | 5;
export const clampLevel = (n: number): Level => Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.round(n))) as Level;

/** FNV-ish integer mix: every derived rng stream comes from this so nothing depends on call order (same recipe as
 *  features/learninghub/games/penguin/core.ts's `mix`, kept local so this domain has no dependency on that one). */
export function mix(seed: number, a: number, b = 0): number {
  let h = (seed ^ Math.imul(a + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = (h ^ Math.imul(b + 0x7f4a7c15, 0x297a2d39)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x165667b1) >>> 0;
  return (h ^ (h >>> 16)) >>> 0 || 1;
}

export interface Choice { id: string; label: string }
/** One question. `answer` is the marking key — NEVER sent to the client (see `sanitize`). `prompt` carries only
 *  render data (numbers/strings/units), no correctness. */
export interface Item {
  id: string;
  tag: string;
  kind: string;
  level: Level;
  prompt: Record<string, unknown>;
  choices?: Choice[];
  unit?: string;
  answer: number | string;
}
export type ItemOut = Omit<Item, "answer">;
export const sanitize = (items: Item[]): ItemOut[] => items.map(({ answer: _answer, ...rest }) => rest);

export interface Answer { id: string; value: number | string | null; ms: number }
export interface MarkedRow { id: string; tag: string; kind: string; correct: boolean; given: number | string | null; answer: number | string; ms: number }
export interface MarkResult { score: number; total: number; rows: MarkedRow[]; byTag: Record<string, { right: number; total: number }> }

const ANSWER_MS_CAP = 5 * 60_000; // a generous ceiling just to keep stored numbers sane; there is no per-question countdown (content rule: no time pressure on thinking)

export function markForm(items: Item[], answers: Answer[] | null | undefined): MarkResult {
  const byId = new Map((answers ?? []).map((a) => [a.id, a]));
  const rows: MarkedRow[] = items.map((it) => {
    const a = byId.get(it.id);
    const ms = Math.max(0, Math.min(ANSWER_MS_CAP, Math.round(a?.ms ?? 0)));
    const given = a && (typeof a.value === "number" || typeof a.value === "string") ? a.value : null;
    let correct = false;
    if (given !== null) {
      if (typeof it.answer === "number" && typeof given === "number") correct = Math.abs(given - it.answer) < 1e-6;
      else correct = String(given) === String(it.answer);
    }
    return { id: it.id, tag: it.tag, kind: it.kind, correct, given, answer: it.answer, ms };
  });
  const byTag: Record<string, { right: number; total: number }> = {};
  for (const r of rows) { const e = (byTag[r.tag] ??= { right: 0, total: 0 }); e.total++; if (r.correct) e.right++; }
  return { score: rows.filter((r) => r.correct).length, total: items.length, rows, byTag };
}
export const cleanAnswers = (raw: unknown, expectIds: string[]): Answer[] | null => {
  if (!Array.isArray(raw) || raw.length !== expectIds.length) return null;
  const ids = new Set(expectIds);
  const out: Answer[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") return null;
    const id = (x as { id?: unknown }).id, v = (x as { value?: unknown }).value, ms = (x as { ms?: unknown }).ms;
    if (typeof id !== "string" || !ids.has(id)) return null;
    if (!(v === null || typeof v === "number" || typeof v === "string")) return null;
    if (typeof v === "number" && !Number.isFinite(v)) return null;
    if (typeof v === "string" && v.length > 40) return null;
    if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
    out.push({ id, value: v as number | string | null, ms });
  }
  return out;
};

// ── content: names & helpers shared by the generators ──────────────────────────────────────────────────────────
const STALL_GOODS = ["apples", "oranges", "bread rolls", "cheese wedges", "notebooks", "pencils", "postcards", "plant pots", "juice cartons", "muffins"];
const money = (rng: Rng, level: Level): number => { // pence
  const table = [[100, 500, 50], [150, 900, 50], [199, 1999, 1], [349, 4999, 1], [199, 9999, 1]] as const;
  const [lo, hi, step] = table[level - 1]!;
  return Math.round(rng.int(lo / step, hi / step)) * step;
};
const payFor = (rng: Rng, priceP: number, level: Level): number => {
  // A realistic amount handed over: exact, or up to the next round coin/note.
  const notes = [50, 100, 200, 500, 1000, 2000, 5000];
  if (level <= 2 && rng.next() < 0.35) return priceP; // exact change sometimes, only at gentle levels
  const roundTo = level <= 1 ? 50 : level <= 3 ? 100 : 500;
  let paid = Math.ceil(priceP / roundTo) * roundTo;
  if (paid === priceP) paid += roundTo;
  const note = notes.find((n) => n >= paid);
  return note ?? paid;
};
const fmtPence = (p: number): string => `£${(p / 100).toFixed(2)}`;

function genMoney(rng: Rng, level: Level, idx: number): Item {
  const kinds = level <= 1 ? ["change"] : level <= 2 ? ["change", "change", "budget"] : level <= 3 ? ["change", "bestvalue", "budget"] : ["bestvalue", "profit", "budget", "change"];
  const kind = rng.pick(kinds);
  const id = `q${idx}`;
  if (kind === "change") {
    const priceP = money(rng, level);
    const paidP = payFor(rng, priceP, level);
    return { id, tag: "money:change", kind, level, unit: "p", prompt: { priceLabel: fmtPence(priceP), paidLabel: fmtPence(paidP), priceP, paidP }, answer: paidP - priceP };
  }
  if (kind === "bestvalue") {
    const good = rng.pick(STALL_GOODS);
    const qtyA = rng.int(2, 4 + level), qtyB = qtyA + rng.pick([1, 2, 3].filter((d) => d !== 0));
    const unitBase = rng.int(15, 30 + level * 8);
    let priceA = qtyA * unitBase + rng.int(-5, 5);
    let priceB = qtyB * unitBase + rng.int(-8, 12); // deliberately NOT proportional, so one pack is genuinely better value
    priceA = Math.max(10, priceA); priceB = Math.max(10, priceB);
    const unitA = priceA / qtyA, unitB = priceB / qtyB;
    const answer = unitA <= unitB ? "a" : "b";
    return {
      id, tag: "money:bestvalue", kind, level,
      prompt: { good, a: { qty: qtyA, priceLabel: fmtPence(priceA) }, b: { qty: qtyB, priceLabel: fmtPence(priceB) } },
      choices: [{ id: "a", label: `${qtyA} for ${fmtPence(priceA)}` }, { id: "b", label: `${qtyB} for ${fmtPence(priceB)}` }],
      answer,
    };
  }
  if (kind === "profit") {
    const cost = money(rng, Math.max(2, level) as Level);
    const margin = rng.int(20, 40 + level * 20) * (rng.next() < 0.8 ? 1 : -1); // occasional loss-making stall day
    const sell = Math.max(10, cost + margin);
    return { id, tag: "money:profit", kind, level, unit: "p", prompt: { good: rng.pick(STALL_GOODS), costLabel: fmtPence(cost), sellLabel: fmtPence(sell) }, answer: sell - cost };
  }
  // budget: n items, enough money to cover them, answer = pence left over
  const n = level <= 2 ? 2 : level <= 4 ? 3 : 4;
  const items: { name: string; priceP: number }[] = [];
  const names = rng.shuffle(STALL_GOODS).slice(0, n);
  let total = 0;
  for (const name of names) { const p = money(rng, level); items.push({ name, priceP: p }); total += p; }
  const budgetP = total + payFor(rng, total, level) - total + rng.int(0, 3) * 100; // comfortably covers the shop
  return { id, tag: "money:budget", kind, level, unit: "p", prompt: { budgetLabel: fmtPence(budgetP), items: items.map((i) => ({ name: i.name, priceLabel: fmtPence(i.priceP) })), budgetP }, answer: budgetP - total };
}

const UNITS_MASS = ["g", "kg"] as const, UNITS_VOL = ["ml", "l"] as const;
const BAKES = ["sponge cake", "flapjacks", "bread rolls", "pizza dough", "cookie dough", "pancake batter", "muffins", "shortbread"];
function genBake(rng: Rng, level: Level, idx: number): Item {
  const kinds = level <= 1 ? ["scale"] : level <= 2 ? ["scale", "capacity"] : level <= 3 ? ["scale", "convert", "capacity"] : ["scale", "convert", "ratio", "capacity"];
  const kind = rng.pick(kinds);
  const id = `q${idx}`;
  if (kind === "scale") {
    const bake = rng.pick(BAKES);
    const s1 = rng.pick(level <= 2 ? [2, 4] : level <= 3 ? [3, 4, 6] : [3, 4, 5, 6, 8]);
    const factor = rng.pick(level <= 2 ? [2, 3] : level <= 4 ? [2, 3, 4] : [2, 3, 5]);
    const up = rng.next() < 0.6;
    const s2 = up ? s1 * factor : Math.max(1, Math.round(s1 / factor));
    const perServe = rng.int(20, 40 + level * 15); // grams (or ml) per serving, chosen so the scaled amount is a whole number
    const q1 = perServe * s1;
    const unit = rng.pick(UNITS_MASS.concat(UNITS_VOL as unknown as typeof UNITS_MASS));
    const answer = Math.round((q1 * s2) / s1);
    return { id, tag: "measure:scale", kind, level, unit, prompt: { bake, s1, s2, q1, unit }, answer };
  }
  if (kind === "convert") {
    const big = rng.pick(UNITS_MASS.concat(UNITS_VOL as unknown as typeof UNITS_MASS)) === "kg" || rng.next() < 0.5;
    const mass = rng.next() < 0.5;
    const wholeUnits = level <= 2 ? rng.int(1, 5) : rng.int(1, 9);
    const frac = level <= 3 ? rng.pick([0, 500]) : rng.pick([0, 100, 250, 500, 750]);
    const smallPerBig = 1000;
    const smallVal = wholeUnits * smallPerBig + frac;
    const unitBig = mass ? "kg" : "l", unitSmall = mass ? "g" : "ml";
    const toSmall = rng.next() < 0.5;
    return toSmall
      ? { id, tag: "measure:convert", kind, level, unit: unitSmall, prompt: { bigLabel: `${(smallVal / 1000).toFixed(smallVal % 1000 === 0 ? 0 : 2)}${unitBig}`, toUnit: unitSmall }, answer: smallVal }
      : { id, tag: "measure:convert", kind, level, unit: unitBig, prompt: { smallLabel: `${smallVal}${unitSmall}`, toUnit: unitBig }, answer: Math.round((smallVal / 1000) * 100) / 100 };
  }
  if (kind === "ratio") {
    const bake = rng.pick(BAKES);
    const rA = rng.int(2, 3 + Math.floor(level / 2)), rB = rng.int(1, 2 + Math.floor(level / 2));
    const mult = rng.int(2, 6);
    const flour = rA * mult * 25; // grams, keeps it a clean whole number
    const sugar = rB * mult * 25;
    return { id, tag: "measure:ratio", kind, level, unit: "g", prompt: { bake, ratioA: rA, ratioB: rB, flour }, answer: sugar };
  }
  // capacity: how many FULL cups of size c(ml) fill a bowl of size V(ml) — integer division, remainder discarded on purpose
  const cup = rng.pick([50, 100, 150, 200, 250]);
  const cups = rng.int(3, 6 + level);
  const extra = rng.int(0, cup - 1);
  const bowl = cup * cups + extra;
  return { id, tag: "measure:capacity", kind, level, unit: "ml", prompt: { bowl, cup }, answer: cups };
}

const REEF_SYMBOLS = ["🐚", "🐠", "🦀", "⭐", "🫧"];
function genReef(rng: Rng, level: Level, idx: number): Item {
  const kinds = level <= 1 ? ["shapes"] : level <= 2 ? ["shapes", "arith"] : level <= 3 ? ["arith", "beat"] : level <= 4 ? ["arith", "geo", "beat"] : ["arith", "geo", "beat", "missing"];
  const kind = rng.pick(kinds);
  const id = `q${idx}`;
  if (kind === "shapes") {
    const period = rng.pick([2, 3]);
    const set = rng.shuffle(REEF_SYMBOLS).slice(0, period);
    const shown = Array.from({ length: 6 }, (_, i) => set[i % period]!);
    return { id, tag: "pattern:shapes", kind, level, prompt: { seq: shown }, choices: rng.shuffle(REEF_SYMBOLS).slice(0, 4).map((s) => ({ id: s, label: s })), answer: set[6 % period]! };
  }
  if (kind === "arith") {
    const start = rng.int(1, 10 + level * 4);
    const step = rng.pick(level <= 3 ? [1, 2, 3, 5, 10] : [2, 3, 4, 5, 6, 7, 8, 9, 10, -2, -3, -5]);
    const seq = Array.from({ length: 5 }, (_, i) => start + step * i);
    return { id, tag: "pattern:arith", kind, level, prompt: { seq }, answer: start + step * 5 };
  }
  if (kind === "geo") {
    const start = rng.int(1, 6);
    const ratio = rng.pick(level <= 4 ? [2, 3] : [2, 3, 4]);
    const seq = Array.from({ length: 4 }, (_, i) => start * ratio ** i);
    return { id, tag: "pattern:geo", kind, level, prompt: { seq }, answer: start * ratio ** 4 };
  }
  if (kind === "missing") {
    const start = rng.int(1, 12);
    const step = rng.pick([2, 3, 4, 5, 6, -2, -3, -4]);
    const seq = Array.from({ length: 6 }, (_, i) => start + step * i);
    const hole = rng.int(1, 4); // never the first or last, so it's a genuine "fill the gap"
    const answer = seq[hole]!;
    const shown = seq.map((v, i) => (i === hole ? null : v));
    return { id, tag: "pattern:missing", kind, level, prompt: { seq: shown }, answer };
  }
  // beat: a repeating rhythm-as-pattern (bubbles), find what comes NEXT — a maths pattern-recognition device, not a
  // music-performance mechanic (content rule: never a real rhythm/performance game).
  const period = rng.pick(level <= 3 ? [2, 3] : [3, 4]);
  const set = rng.shuffle(REEF_SYMBOLS).slice(0, period);
  const len = period * rng.int(2, 3) + rng.int(0, period - 1);
  const shown = Array.from({ length: len }, (_, i) => set[i % period]!);
  const nextSym = set[len % period]!;
  return { id, tag: "pattern:beat", kind, level, prompt: { seq: shown }, choices: rng.shuffle([...new Set([nextSym, ...rng.shuffle(REEF_SYMBOLS)])]).slice(0, 4).map((s) => ({ id: s, label: s })), answer: nextSym };
}

const GENERATORS: Record<GameId, (rng: Rng, level: Level, idx: number) => Item> = { market: genMoney, bakeoff: genBake, reef: genReef };

/** A deterministic form of `ITEMS_PER_RUN` items for `gameId` at `level`, built purely from `seed`. Retries a couple
 *  of times on an accidental duplicate tag-heavy draw so a form isn't e.g. 8x "budget" in a row. */
export function generateForm(gameId: GameId, seed: number, level: Level): Item[] {
  const gen = GENERATORS[gameId];
  let best: Item[] | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const rng = makeRng(mix(seed, 4100 + attempt));
    const items = Array.from({ length: ITEMS_PER_RUN }, (_, i) => gen(rng, level, i));
    const kinds = new Set(items.map((it) => it.kind));
    if (kinds.size > 1 || ITEMS_PER_RUN <= 2) { best = items; break; }
    best = items;
  }
  return best!;
}

/** Next level from this run's score: up a notch on a strong run, down a notch on a weak one, otherwise unchanged —
 *  the same "adjust toward the 80-90% success band" idea as the fact-fluency games, kept simple because this
 *  domain has no per-fact FSRS state, just a level per (child, game). */
export function nextLevel(current: Level, score: number, total: number): Level {
  if (!total) return current;
  const rate = score / total;
  if (rate >= 0.85 && current < MAX_LEVEL) return (current + 1) as Level;
  if (rate <= 0.4 && current > MIN_LEVEL) return (current - 1) as Level;
  return current;
}
