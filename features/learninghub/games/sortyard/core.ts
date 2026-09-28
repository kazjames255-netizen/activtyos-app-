// Sort Yard — a statistics/data-handling game: classify real data into categories, read a simple chart, and order
// values. Grounded in the National Curriculum maths programme of study (statistics strand):
//   KS1  — sort objects into given categories; count and compare categorical data.
//   LKS2 — interpret pictograms, tally charts, bar charts (Y3); solve comparison/sum/difference problems (Y4).
//   UKS2 — interpret line graphs; know the difference between discrete and continuous data (Y5-6).
// Same server-authoritative contract as every hub game: the server issues a seeded PLAN (which rounds, built from
// a curated data bank); the browser sends only the child's SUBMITTED answers (category assignments / typed
// numbers / an ordering); the server RE-GRADES from the stored plan with this same pure engine. Pure + isomorphic
// (imported by the client UI and by server/src/lib/games/sortYard.ts).
import { makeRng } from "../../tools/engine/rng";

export type RoundKind = "sort" | "chart" | "order";
export type Concept = "categorical" | "chart-reading" | "comparing" | "averages";

// ── "sort": classify real items into the categories they actually belong to ──────────────────────────────────────
export interface SortItem { label: string; category: string }
export interface SortRound {
  kind: "sort";
  id: string;
  concept: "categorical";
  years: string[];
  title: string;
  categories: string[];
  items: SortItem[];
}
const SORT_ROUNDS: SortRound[] = [
  { kind: "sort", id: "animals-diet", concept: "categorical", years: ["1", "2"], title: "Sort by diet", categories: ["Herbivore", "Carnivore", "Omnivore"], items: [
    { label: "Rabbit", category: "Herbivore" }, { label: "Cow", category: "Herbivore" }, { label: "Sheep", category: "Herbivore" },
    { label: "Lion", category: "Carnivore" }, { label: "Shark", category: "Carnivore" }, { label: "Eagle", category: "Carnivore" },
    { label: "Bear", category: "Omnivore" }, { label: "Human", category: "Omnivore" }, { label: "Pig", category: "Omnivore" },
  ] },
  { kind: "sort", id: "shapes-sides", concept: "categorical", years: ["1", "2"], title: "Sort 2D shapes by number of sides", categories: ["3 sides", "4 sides", "More than 4 sides"], items: [
    { label: "Triangle", category: "3 sides" }, { label: "Square", category: "4 sides" }, { label: "Rectangle", category: "4 sides" },
    { label: "Pentagon", category: "More than 4 sides" }, { label: "Hexagon", category: "More than 4 sides" }, { label: "Rhombus", category: "4 sides" },
  ] },
  { kind: "sort", id: "numbers-odd-even", concept: "categorical", years: ["1", "2", "3"], title: "Sort the numbers", categories: ["Odd", "Even"], items: [
    { label: "14", category: "Even" }, { label: "23", category: "Odd" }, { label: "36", category: "Even" }, { label: "41", category: "Odd" },
    { label: "58", category: "Even" }, { label: "77", category: "Odd" }, { label: "90", category: "Even" }, { label: "15", category: "Odd" },
  ] },
  { kind: "sort", id: "data-type", concept: "categorical", years: ["4", "5", "6"], title: "Categorical or numerical data?", categories: ["Categorical", "Numerical"], items: [
    { label: "Favourite colour", category: "Categorical" }, { label: "Height in cm", category: "Numerical" },
    { label: "Type of pet", category: "Categorical" }, { label: "Number of siblings", category: "Numerical" },
    { label: "Eye colour", category: "Categorical" }, { label: "Temperature in °C", category: "Numerical" },
    { label: "Mode of transport to school", category: "Categorical" }, { label: "Shoe size", category: "Numerical" },
  ] },
  { kind: "sort", id: "materials", concept: "categorical", years: ["1", "2", "3"], title: "Sort by material", categories: ["Wood", "Metal", "Plastic", "Fabric"], items: [
    { label: "Table", category: "Wood" }, { label: "Spoon", category: "Metal" }, { label: "Ruler", category: "Plastic" }, { label: "Jumper", category: "Fabric" },
    { label: "Fence", category: "Wood" }, { label: "Coin", category: "Metal" }, { label: "Bottle", category: "Plastic" }, { label: "Scarf", category: "Fabric" },
  ] },
];

// ── "chart": read a bar chart (given as data) and answer a question about it ─────────────────────────────────────
export interface ChartRound {
  kind: "chart";
  id: string;
  concept: "chart-reading" | "comparing" | "averages";
  years: string[];
  title: string;
  chartTitle: string;
  bars: { label: string; value: number }[];
  question: string;
  answer: number;
}
const CHART_ROUNDS: ChartRound[] = [
  { kind: "chart", id: "pets-total", concept: "chart-reading", years: ["2", "3"], title: "Reading a bar chart", chartTitle: "Pets owned by Class 3", bars: [{ label: "Dog", value: 8 }, { label: "Cat", value: 6 }, { label: "Fish", value: 4 }, { label: "Rabbit", value: 2 }], question: "How many children own a dog?", answer: 8 },
  { kind: "chart", id: "pets-most", concept: "comparing", years: ["2", "3"], title: "Comparing bars", chartTitle: "Pets owned by Class 3", bars: [{ label: "Dog", value: 8 }, { label: "Cat", value: 6 }, { label: "Fish", value: 4 }, { label: "Rabbit", value: 2 }], question: "How many more children own a dog than a rabbit?", answer: 6 },
  { kind: "chart", id: "fruit-total", concept: "chart-reading", years: ["3", "4"], title: "Reading a bar chart", chartTitle: "Fruit sold at the tuck shop", bars: [{ label: "Apple", value: 15 }, { label: "Banana", value: 22 }, { label: "Orange", value: 9 }, { label: "Grapes", value: 18 }], question: "How many pieces of fruit were sold altogether?", answer: 64 },
  { kind: "chart", id: "fruit-diff", concept: "comparing", years: ["3", "4"], title: "Comparing bars", chartTitle: "Fruit sold at the tuck shop", bars: [{ label: "Apple", value: 15 }, { label: "Banana", value: 22 }, { label: "Orange", value: 9 }, { label: "Grapes", value: 18 }], question: "What is the difference between the most sold and the least sold fruit?", answer: 13 },
  { kind: "chart", id: "temps-mode", concept: "averages", years: ["5", "6"], title: "Finding the mode", chartTitle: "Midday temperature (°C) this week", bars: [{ label: "Mon", value: 18 }, { label: "Tue", value: 20 }, { label: "Wed", value: 18 }, { label: "Thu", value: 21 }, { label: "Fri", value: 18 }], question: "What is the mode (most common) temperature?", answer: 18 },
  { kind: "chart", id: "temps-range", concept: "averages", years: ["5", "6"], title: "Finding the range", chartTitle: "Midday temperature (°C) this week", bars: [{ label: "Mon", value: 18 }, { label: "Tue", value: 20 }, { label: "Wed", value: 15 }, { label: "Thu", value: 21 }, { label: "Fri", value: 18 }], question: "What is the range (highest minus lowest)?", answer: 6 },
];

// ── "order": put values in ascending order ─────────────────────────────────────────────────────────────────────
export interface OrderRound { kind: "order"; id: string; concept: "comparing"; years: string[]; title: string; values: number[]; direction: "ascending" | "descending" }
const ORDER_ROUNDS: OrderRound[] = [
  { kind: "order", id: "order1", concept: "comparing", years: ["1", "2"], title: "Put these in order, smallest first", values: [7, 2, 9, 4], direction: "ascending" },
  { kind: "order", id: "order2", concept: "comparing", years: ["2", "3"], title: "Put these in order, smallest first", values: [34, 12, 58, 23, 41], direction: "ascending" },
  { kind: "order", id: "order3", concept: "comparing", years: ["3", "4"], title: "Put these in order, largest first", values: [156, 89, 201, 47, 132], direction: "descending" },
  { kind: "order", id: "order4", concept: "comparing", years: ["4", "5"], title: "Put these decimals in order, smallest first", values: [3.5, 3.05, 3.55, 3.1], direction: "ascending" },
];

export type Round = SortRound | ChartRound | OrderRound;
export const ROUNDS: Round[] = [...SORT_ROUNDS, ...CHART_ROUNDS, ...ORDER_ROUNDS];
export const roundById = (id: string): Round | null => ROUNDS.find((r) => r.id === id) ?? null;

export const SORTYARD_RUN = { n: 6 } as const;

export interface RoundState { id: string; solved: boolean; attempts: number; correct: number; updatedAt: string }
export const freshRoundState = (id: string): RoundState => ({ id, solved: false, attempts: 0, correct: 0, updatedAt: "" });

/** Pick `n` rounds, mixing all three kinds, weakest/unsolved first, deterministic from `seed`. */
export function makeSortPlan(seed: number, states: ReadonlyMap<string, RoundState>, years?: string[]): Round[] {
  const rng = makeRng(seed);
  const bank = years?.length ? ROUNDS.filter((r) => r.years.some((y) => years.includes(y))) : ROUNDS;
  // As in Bot Foundry: only narrow to the year-tagged bank when it has enough rounds for a full run, so a year
  // group at the edge of the bank's coverage still gets a full, varied run rather than being starved to 1-2 rounds.
  const pool = bank.length >= SORTYARD_RUN.n ? bank : ROUNDS;
  const unsolved = pool.filter((r) => !states.get(r.id)?.solved);
  const solved = pool.filter((r) => states.get(r.id)?.solved);
  const ordered = [...rng.shuffle(unsolved), ...rng.shuffle(solved)];
  const n = Math.min(SORTYARD_RUN.n, pool.length);
  return ordered.slice(0, n);
}

export type Submission =
  | { kind: "sort"; roundId: string; assignments: Record<string, string> } // item label -> category
  | { kind: "chart"; roundId: string; value: number }
  | { kind: "order"; roundId: string; order: number[] };

export interface RoundRow { roundId: string; title: string; concept: Concept; correct: boolean; detail: string }
export interface SortResult { correct: number; total: number; rows: RoundRow[] }

function gradeOne(round: Round, sub: Submission | undefined): RoundRow {
  if (round.kind === "sort") {
    const assignments = (sub && sub.kind === "sort" ? sub.assignments : {}) || {};
    const total = round.items.length;
    const right = round.items.filter((it) => assignments[it.label] === it.category).length;
    return { roundId: round.id, title: round.title, concept: round.concept, correct: right === total, detail: `${right}/${total} correctly sorted` };
  }
  if (round.kind === "chart") {
    const value = sub && sub.kind === "chart" ? Number(sub.value) : NaN;
    const correct = Number.isFinite(value) && value === round.answer;
    return { roundId: round.id, title: round.title, concept: round.concept, correct, detail: correct ? "Correct" : `The answer was ${round.answer}` };
  }
  // order
  const order = sub && sub.kind === "order" && Array.isArray(sub.order) ? sub.order : [];
  const key = [...round.values].sort((a, b) => (round.direction === "ascending" ? a - b : b - a));
  const correct = order.length === key.length && order.every((v, i) => v === key[i]);
  return { roundId: round.id, title: round.title, concept: round.concept, correct, detail: correct ? "Correct order" : `The correct order was ${key.join(", ")}` };
}

/** Grade a run. Pure — re-checks every submission against ITS OWN round from the stored plan; the client's claimed
 *  outcome (which category it says it dropped an item in) is never trusted on its own, only the final assignment. */
export function markSortRun(plan: Round[], submissions: Submission[]): SortResult {
  const rows = plan.map((round) => gradeOne(round, submissions.find((s) => s.roundId === round.id)));
  return { correct: rows.filter((r) => r.correct).length, total: rows.length, rows };
}

export function applySortToItems(rows: RoundRow[], states: ReadonlyMap<string, RoundState>, nowIso: string): Map<string, RoundState> {
  const out = new Map(states);
  for (const r of rows) {
    const s = out.get(r.roundId) ?? freshRoundState(r.roundId);
    out.set(r.roundId, { id: r.roundId, solved: s.solved || r.correct, attempts: s.attempts + 1, correct: s.correct + (r.correct ? 1 : 0), updatedAt: nowIso });
  }
  return out;
}

// ── validation of untrusted client submissions, bounded ─────────────────────────────────────────────────────────
export function cleanSubmissions(raw: unknown, plan: Round[]): Submission[] | null {
  if (!Array.isArray(raw) || raw.length > 20) return null;
  const byId = new Map(plan.map((r) => [r.id, r]));
  const out: Submission[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") return null;
    const roundId = (s as { roundId?: unknown }).roundId;
    if (typeof roundId !== "string" || !byId.has(roundId)) return null;
    const round = byId.get(roundId)!;
    if (round.kind === "sort") {
      const assignments = (s as { assignments?: unknown }).assignments;
      if (!assignments || typeof assignments !== "object" || Array.isArray(assignments)) return null;
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(assignments as Record<string, unknown>)) { if (typeof k === "string" && typeof v === "string") clean[k.slice(0, 60)] = v.slice(0, 60); }
      out.push({ kind: "sort", roundId, assignments: clean });
    } else if (round.kind === "chart") {
      const value = (s as { value?: unknown }).value;
      if (typeof value !== "number" || !Number.isFinite(value)) return null;
      out.push({ kind: "chart", roundId, value });
    } else {
      const order = (s as { order?: unknown }).order;
      if (!Array.isArray(order) || order.length > 20 || !order.every((v) => typeof v === "number")) return null;
      out.push({ kind: "order", roundId, order: order as number[] });
    }
  }
  return out;
}
