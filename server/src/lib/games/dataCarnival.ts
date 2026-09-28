import type { Rng } from "../../../../features/learninghub/tools/engine/rng";
import type { QuizGameSpec, QuizItem } from "../quizArcade";

// Data Carnival — statistics / data handling (KS2-KS3: reading bar/pie/line charts, mean/median/mode/range,
// interpreting a real small dataset). A fairground frame: each correct read of the data lights up another stall
// (client-side only; the datasets and the arithmetic here are the real thing, re-marked server-side).
export const DATA_CARNIVAL_TOPICS = ["barChart", "pieChart", "lineChart", "mean", "median", "modeRange"] as const;
export type DataCarnivalTopic = (typeof DATA_CARNIVAL_TOPICS)[number];

// Small stall/carnival-themed categories so the charts feel like real data, not just "A, B, C".
const CATEGORY_SETS: string[][] = [
  ["Coconut shy", "Hoopla", "Duck shoot", "Ring toss"], ["Toffee apple", "Candy floss", "Popcorn", "Lemonade"],
  ["Ferris wheel", "Carousel", "Waltzers", "Big slide"], ["Red team", "Blue team", "Green team", "Yellow team"],
];
export interface ChartSpec { kind: "bar" | "pie" | "line"; labels: string[]; values: number[]; unit: string }
export const meanOf = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
export const medianOf = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2; };
export const modeOf = (xs: number[]): number[] => { const c = new Map<number, number>(); for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1); const max = Math.max(...c.values()); return [...c.entries()].filter(([, n]) => n === max).map(([v]) => v).sort((a, b) => a - b); };
export const rangeOf = (xs: number[]): number => Math.max(...xs) - Math.min(...xs);
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function makeChart(rng: Rng, difficulty: 1 | 2 | 3, kind: "bar" | "pie" | "line"): ChartSpec {
  const n = difficulty === 1 ? 4 : difficulty === 2 ? 4 : 5;
  const labels = rng.pick(CATEGORY_SETS).slice(0, n);
  const hi = difficulty === 1 ? 20 : difficulty === 2 ? 40 : 60;
  let values: number[];
  if (kind === "line") { // a small trend over time, small steps so a "rise/fall between points" question is answerable at a glance
    values = [rng.int(4, hi)];
    for (let i = 1; i < n; i++) values.push(Math.max(1, values[i - 1]! + rng.int(-6, 8)));
  } else values = Array.from({ length: n }, () => rng.int(2, hi));
  return { kind, labels, values, unit: kind === "pie" ? "votes" : kind === "line" ? "visitors" : "tickets" };
}
// Guaranteed to terminate even when `correct` is very small (e.g. 0) and there aren't `count` distinct non-negative
// integers within the first `spread` either side of it: widens the search window every 40 misses, then falls back
// to a plain sequential fill so this can never spin forever (found the hard way - see server/src/scripts, this bit
// a first draft of Shape Workshop's 3D-solid questions where "correct" is 0 or 1 edges/vertices).
function distinctInts(rng: Rng, correct: number, count: number, spread: number): number[] {
  const out = new Set<number>();
  let s = Math.max(1, spread), guard = 0;
  while (out.size < count && guard++ < 400) { const x = correct + rng.int(-s, s); if (x !== correct && x >= 0) out.add(x); if (guard % 40 === 0) s++; }
  for (let filler = 0; out.size < count; filler++) if (filler !== correct) out.add(filler);
  return [...out].slice(0, count);
}
function shuffledChoices(rng: Rng, correct: string, distractors: string[]): { choices: string[]; correctIndex: number } {
  const pool = [...new Set(distractors)].filter((d) => d !== correct).slice(0, 3);
  for (let n = 1; pool.length < 3; n++) pool.push(`${correct}+${n}`); // defensive, distinct fallback for a generator that under-supplied distinct distractors
  const choices = rng.shuffle([correct, ...pool]);
  return { choices, correctIndex: choices.indexOf(correct) };
}
const chartText = (c: ChartSpec): string => `${c.kind === "bar" ? "Bar chart" : c.kind === "pie" ? "Pie chart" : "Line chart"}: ` + c.labels.map((l, i) => `${l} = ${c.values[i]}`).join(", ");

function itemReadHighest(rng: Rng, difficulty: 1 | 2 | 3, idx: number, kind: "bar" | "pie"): QuizItem {
  const c = makeChart(rng, difficulty, kind);
  const maxIdx = c.values.indexOf(Math.max(...c.values));
  const correct = c.labels[maxIdx]!;
  const { choices, correctIndex } = shuffledChoices(rng, correct, c.labels.filter((l) => l !== correct));
  return { id: `q${idx}`, topic: kind === "bar" ? "barChart" : "pieChart", prompt: `${chartText(c)}. Which had the most ${c.unit}?`, choices, correctIndex, explain: `${correct} has the highest value (${c.values[maxIdx]}).` };
}
function itemReadLowest(rng: Rng, difficulty: 1 | 2 | 3, idx: number, kind: "bar" | "pie"): QuizItem {
  const c = makeChart(rng, difficulty, kind);
  const minIdx = c.values.indexOf(Math.min(...c.values));
  const correct = c.labels[minIdx]!;
  const { choices, correctIndex } = shuffledChoices(rng, correct, c.labels.filter((l) => l !== correct));
  return { id: `q${idx}`, topic: kind === "bar" ? "barChart" : "pieChart", prompt: `${chartText(c)}. Which had the fewest ${c.unit}?`, choices, correctIndex, explain: `${correct} has the lowest value (${c.values[minIdx]}).` };
}
function itemReadValue(rng: Rng, difficulty: 1 | 2 | 3, idx: number, kind: "bar" | "pie" | "line"): QuizItem {
  const c = makeChart(rng, difficulty, kind);
  const i = rng.int(0, c.labels.length - 1);
  const correct = c.values[i]!;
  const { choices, correctIndex } = shuffledChoices(rng, String(correct), distinctInts(rng, correct, 3, Math.max(3, Math.round(correct * 0.3))).map(String));
  const label = kind === "line" ? `at ${c.labels[i]}` : `for ${c.labels[i]}`;
  return { id: `q${idx}`, topic: kind === "bar" ? "barChart" : kind === "pie" ? "pieChart" : "lineChart", prompt: `${chartText(c)}. How many ${c.unit} were there ${label}?`, choices, correctIndex, explain: `Reading the chart, ${c.labels[i]} = ${correct}.` };
}
function itemLineTrend(rng: Rng, difficulty: 1 | 2 | 3, idx: number): QuizItem {
  const c = makeChart(rng, difficulty, "line");
  const i = rng.int(0, c.labels.length - 2);
  const rose = c.values[i + 1]! > c.values[i]!;
  const correct = rose ? "Rose" : c.values[i + 1] === c.values[i] ? "Stayed the same" : "Fell";
  const choices = rng.shuffle(["Rose", "Fell", "Stayed the same"]);
  return { id: `q${idx}`, topic: "lineChart", prompt: `${chartText(c)}. Between ${c.labels[i]} and ${c.labels[i + 1]}, did the ${c.unit} rise, fall, or stay the same?`, choices, correctIndex: choices.indexOf(correct), explain: `${c.labels[i]} was ${c.values[i]} and ${c.labels[i + 1]} was ${c.values[i + 1]}, so it ${correct.toLowerCase()}.` };
}
function itemTotal(rng: Rng, difficulty: 1 | 2 | 3, idx: number, kind: "bar" | "pie"): QuizItem {
  const c = makeChart(rng, difficulty, kind);
  const correct = c.values.reduce((a, b) => a + b, 0);
  const { choices, correctIndex } = shuffledChoices(rng, String(correct), distinctInts(rng, correct, 3, Math.max(4, Math.round(correct * 0.2))).map(String));
  return { id: `q${idx}`, topic: kind === "bar" ? "barChart" : "pieChart", prompt: `${chartText(c)}. What is the total number of ${c.unit}?`, choices, correctIndex, explain: `${c.values.join(" + ")} = ${correct}.` };
}
function statSet(rng: Rng, difficulty: 1 | 2 | 3): number[] {
  const n = difficulty === 1 ? 5 : difficulty === 2 ? 7 : 9;
  const hi = difficulty === 1 ? 15 : difficulty === 2 ? 30 : 50;
  const xs = Array.from({ length: n }, () => rng.int(1, hi));
  if (difficulty >= 2 && rng.next() < 0.6) xs[rng.int(0, n - 1)] = xs[0]!; // force a repeat so mode is meaningful
  return xs;
}
function itemMean(rng: Rng, difficulty: 1 | 2 | 3, idx: number): QuizItem {
  let xs = statSet(rng, difficulty);
  let m = meanOf(xs);
  // Bias toward datasets with a whole-number mean so the answer is a clean multiple choice.
  let guard = 0;
  while (!Number.isInteger(m) && guard++ < 20) { xs = statSet(rng, difficulty); m = meanOf(xs); }
  const correct = Number.isInteger(m) ? m : Math.round(m * 10) / 10;
  const { choices, correctIndex } = shuffledChoices(rng, fmt(correct), distinctInts(rng, Math.round(correct), 3, 3).map(fmt));
  return { id: `q${idx}`, topic: "mean", prompt: `Find the mean of this dataset: ${xs.join(", ")}`, choices, correctIndex, explain: `Mean = total ÷ how many = ${xs.reduce((a, b) => a + b, 0)} ÷ ${xs.length} = ${fmt(correct)}.` };
}
function itemMedian(rng: Rng, difficulty: 1 | 2 | 3, idx: number): QuizItem {
  const xs = statSet(rng, difficulty);
  const correct = medianOf(xs);
  const { choices, correctIndex } = shuffledChoices(rng, fmt(correct), distinctInts(rng, Math.round(correct), 3, 4).map(fmt));
  const sorted = [...xs].sort((a, b) => a - b);
  return { id: `q${idx}`, topic: "median", prompt: `Find the median of this dataset: ${xs.join(", ")}`, choices, correctIndex, explain: `In order: ${sorted.join(", ")}. The middle value (or the average of the middle two) is ${fmt(correct)}.` };
}
function itemModeOrRange(rng: Rng, difficulty: 1 | 2 | 3, idx: number): QuizItem {
  const xs = statSet(rng, difficulty);
  const askMode = rng.next() < 0.5;
  if (askMode) {
    const modes = modeOf(xs);
    const correct = modes.length === 1 ? String(modes[0]) : modes.length === xs.length ? "No mode" : modes.join(" and ");
    const { choices, correctIndex } = shuffledChoices(rng, correct, [String(xs[0]), "No mode", ...distinctInts(rng, modes[0] ?? xs[0]!, 3, 4).map(String)]);
    return { id: `q${idx}`, topic: "modeRange", prompt: `Find the mode of this dataset: ${xs.join(", ")}`, choices, correctIndex, explain: modes.length === xs.length ? "Every value appears once, so there is no mode." : `${correct} appears most often.` };
  }
  const correct = rangeOf(xs);
  const { choices, correctIndex } = shuffledChoices(rng, String(correct), distinctInts(rng, correct, 3, 3).map(String));
  return { id: `q${idx}`, topic: "modeRange", prompt: `Find the range of this dataset: ${xs.join(", ")}`, choices, correctIndex, explain: `Range = highest − lowest = ${Math.max(...xs)} − ${Math.min(...xs)} = ${correct}.` };
}

const GENERATORS: ((rng: Rng, difficulty: 1 | 2 | 3, idx: number) => QuizItem)[] = [
  (r, d, i) => itemReadHighest(r, d, i, "bar"), (r, d, i) => itemReadLowest(r, d, i, "bar"), (r, d, i) => itemReadValue(r, d, i, "bar"), (r, d, i) => itemTotal(r, d, i, "bar"),
  (r, d, i) => itemReadHighest(r, d, i, "pie"), (r, d, i) => itemReadValue(r, d, i, "pie"), (r, d, i) => itemTotal(r, d, i, "pie"),
  (r, d, i) => itemReadValue(r, d, i, "line"), itemLineTrend, itemMean, itemMedian, itemModeOrRange,
];
const BY_TOPIC: Record<DataCarnivalTopic, ((rng: Rng, difficulty: 1 | 2 | 3, idx: number) => QuizItem)[]> = {
  barChart: [(r, d, i) => itemReadHighest(r, d, i, "bar"), (r, d, i) => itemReadLowest(r, d, i, "bar"), (r, d, i) => itemReadValue(r, d, i, "bar"), (r, d, i) => itemTotal(r, d, i, "bar")],
  pieChart: [(r, d, i) => itemReadHighest(r, d, i, "pie"), (r, d, i) => itemReadValue(r, d, i, "pie"), (r, d, i) => itemTotal(r, d, i, "pie")],
  lineChart: [(r, d, i) => itemReadValue(r, d, i, "line"), itemLineTrend], mean: [itemMean], median: [itemMedian], modeRange: [itemModeOrRange],
};

export const dataCarnivalSpec: QuizGameSpec = {
  gameId: "data-carnival", topics: DATA_CARNIVAL_TOPICS, runLength: 8,
  buildPlan(rng, { difficulty, weakTopics }) {
    const items: QuizItem[] = [];
    const weak = weakTopics.filter((t): t is DataCarnivalTopic => (DATA_CARNIVAL_TOPICS as readonly string[]).includes(t));
    for (let i = 0; i < 8; i++) {
      const useWeak = weak.length && i < 5 && rng.next() < 0.6;
      const pool = useWeak ? BY_TOPIC[rng.pick(weak)]! : GENERATORS;
      let item = rng.pick(pool)(rng, difficulty, i);
      let guard = 0;
      while (items.some((x) => x.prompt === item.prompt) && guard++ < 5) item = rng.pick(GENERATORS)(rng, difficulty, i);
      items.push(item);
    }
    return items;
  },
};
