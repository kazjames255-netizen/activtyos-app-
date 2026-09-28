// Training Ground — a generic, subject-agnostic rapid-drill practice arena. Same server-authoritative contract as every
// other Learning Hub game (docs/games-prototypes/BACKEND-PATTERN.md): the server issues a seeded plan built from a
// curated content PACK, the child types answers, the browser sends only the typed answers + response times, and the
// server re-marks from the stored plan. This file is PURE and isomorphic — imported by both the client UI and the
// server (server/src/lib/games/trainingGround.ts), exactly like features/learninghub/games/penguin/mtc.ts.
//
// It is deliberately content-agnostic: a "pack" is just a list of prompt/answer items with tags. Any future game
// (spelling, vocabulary, science facts, geography, times tables...) can plug in a new pack without touching the
// engine below. Ship packs are curriculum-grounded (see PACKS) — never placeholder text.
import { makeRng } from "../../tools/engine/rng";

export interface DrillItem {
  id: string;
  /** What's shown to the child. */
  prompt: string;
  /** The canonical answer, shown in review. */
  answer: string;
  /** Case/whitespace-insensitive accepted spellings (always includes `answer`). */
  accepted: string[];
  tags: string[];
}
export interface DrillPack {
  id: string;
  subject: string;
  title: string;
  /** National Curriculum years this pack targets, e.g. ["3","4"]. */
  years: string[];
  items: DrillItem[];
}

// ── Curriculum-grounded content ──────────────────────────────────────────────────────────────────────────────────
// KS1 statutory common exception words (DfE English programme of study, Year 1 and Year 2 word lists).
const KS1_Y1_WORDS = ["the", "a", "do", "to", "today", "of", "said", "says", "are", "were", "was", "is", "his", "has", "I", "you", "your", "they", "be", "he", "me", "she", "we", "no", "go", "so", "by", "my", "here", "there", "where", "love", "come", "some", "one", "once", "ask", "friend", "school", "put", "push", "pull", "full", "house", "our"];
const KS1_Y2_WORDS = ["door", "floor", "poor", "because", "find", "kind", "mind", "behind", "child", "children", "wild", "climb", "most", "only", "both", "old", "cold", "gold", "hold", "told", "every", "everybody", "even", "great", "break", "steak", "pretty", "beautiful", "after", "fast", "last", "past", "father", "class", "grass", "pass", "plant", "path", "bath", "hour", "move", "prove", "improve", "sure", "sugar", "eye", "could", "should", "would", "who", "whole", "any", "many", "clothes", "busy", "people", "water", "again", "half", "money", "parents", "Christmas"];
// KS2 statutory spelling words, years 3-4 and 5-6 (DfE English programme of study appendix 1).
const KS2_Y34_WORDS = ["accident", "actual", "address", "answer", "appear", "arrive", "believe", "bicycle", "breath", "calendar", "caught", "centre", "century", "certain", "circle", "complete", "consider", "continue", "decide", "describe", "different", "difficult", "disappear", "early", "earth", "eight", "enough", "exercise", "experience", "experiment", "extreme", "famous", "favourite", "forward", "fruit", "grammar", "group", "guard", "guide", "heard", "heart", "height", "history", "imagine", "increase", "important", "interest", "island", "knowledge", "learn", "length", "library", "material", "medicine", "mention", "minute", "natural", "naughty", "notice", "occasion", "often", "opposite", "ordinary", "particular", "peculiar", "perhaps", "popular", "position", "possess", "possible", "potatoes", "pressure", "probably", "promise", "purpose", "quarter", "question", "recent", "regular", "remember", "sentence", "separate", "special", "straight", "strange", "strength", "suppose", "surprise", "therefore", "though", "although", "thought", "through", "various", "weight", "woman", "women"];
const KS2_Y56_WORDS = ["accommodate", "accompany", "according", "achieve", "aggressive", "amateur", "ancient", "apparent", "appreciate", "attached", "available", "average", "awkward", "bargain", "bruise", "category", "cemetery", "committee", "communicate", "community", "competition", "conscience", "conscious", "controversy", "convenience", "correspond", "criticise", "curiosity", "definite", "desperate", "determined", "develop", "dictionary", "disastrous", "embarrass", "environment", "equipment", "especially", "exaggerate", "excellent", "existence", "explanation", "familiar", "foreign", "forty", "frequently", "government", "guarantee", "harass", "hindrance", "identity", "immediately", "individual", "interfere", "interrupt", "language", "leisure", "lightning", "marvellous", "mischievous", "muscle", "necessary", "neighbour", "nuisance", "occupy", "occur", "opportunity", "parliament", "persuade", "physical", "prejudice", "privilege", "profession", "programme", "pronunciation", "queue", "recognise", "recommend", "relevant", "restaurant", "rhyme", "rhythm", "sacrifice", "secretary", "shoulder", "signature", "sincere", "soldier", "stomach", "sufficient", "suggest", "symbol", "system", "temperature", "thorough", "twelfth", "variety", "vegetable", "vehicle", "yacht"];

// KS2 science quick-fire facts — grounded in the National Curriculum science programme of study (states of matter,
// life cycles, forces, electricity, materials, living things).
const SCIENCE_Y34: [string, string][] = [
  ["The three states of matter are solid, liquid and ___", "gas"],
  ["Water turns into a gas when it ___", "evaporates"],
  ["A gas turns into a liquid when it ___", "condenses"],
  ["A liquid turns into a solid when it ___", "freezes"],
  ["The force that pulls objects towards the Earth", "gravity"],
  ["A force that slows things down when surfaces rub together", "friction"],
  ["The gas plants take in from the air to make food", "carbon dioxide"],
  ["The gas plants release that animals need to breathe", "oxygen"],
  ["The process plants use to make their own food using sunlight", "photosynthesis"],
  ["The part of a plant that takes in water from the soil", "roots"],
  ["The stage between egg and adult in a butterfly's life cycle", "caterpillar"],
  ["A material that lets electricity pass through it easily", "conductor"],
  ["A material that does not let electricity pass through it", "insulator"],
  ["The organ that pumps blood around the body", "heart"],
  ["The process by which a caterpillar becomes a butterfly", "metamorphosis"],
  ["A push or a pull on an object is called a", "force"],
  ["The star at the centre of our solar system", "the Sun"],
  ["The natural satellite that orbits the Earth", "the Moon"],
  ["Animals that only eat plants are called", "herbivores"],
  ["Animals that only eat meat are called", "carnivores"],
  ["Animals that eat both plants and meat are called", "omnivores"],
];
const SCIENCE_Y56: [string, string][] = [
  ["The process of a liquid changing to a gas below boiling point", "evaporation"],
  ["The force needed to overcome gravity so a rocket can lift off", "thrust"],
  ["The force that acts opposite to the direction of movement through air", "air resistance"],
  ["Newton's unit for measuring force", "newtons"],
  ["The organ system responsible for pumping blood", "circulatory system"],
  ["The process by which offspring resemble their parents", "inheritance"],
  ["A change that produces a new substance and cannot easily be reversed", "irreversible change"],
  ["A change like melting or freezing that can be reversed", "reversible change"],
  ["The gas that makes up about 78% of the air we breathe", "nitrogen"],
  ["The stage of human development between birth and childhood", "infancy"],
  ["The scientist who proposed the theory of evolution by natural selection", "Charles Darwin"],
  ["The name for a change of state from solid directly to gas", "sublimation"],
];

const words = (id: string, subject: string, title: string, years: string[], list: string[]): DrillPack => ({
  id, subject, title, years,
  items: list.map((w, i) => ({ id: `${id}_${i}`, prompt: `Spell: "${w}"`, answer: w, accepted: [w], tags: [subject, ...years.map((y) => `y${y}`)] })),
});
const facts = (id: string, subject: string, title: string, years: string[], list: [string, string][]): DrillPack => ({
  id, subject, title, years,
  items: list.map(([q, a], i) => ({ id: `${id}_${i}`, prompt: q, answer: a, accepted: [a, a.replace(/^the\s+/i, "")], tags: [subject, ...years.map((y) => `y${y}`)] })),
});

export const PACKS: DrillPack[] = [
  words("spell-ks1-y1", "spelling", "Tricky words (Year 1)", ["1"], KS1_Y1_WORDS),
  words("spell-ks1-y2", "spelling", "Tricky words (Year 2)", ["2"], KS1_Y2_WORDS),
  words("spell-ks2-y34", "spelling", "Spelling list (Years 3–4)", ["3", "4"], KS2_Y34_WORDS),
  words("spell-ks2-y56", "spelling", "Spelling list (Years 5–6)", ["5", "6"], KS2_Y56_WORDS),
  facts("science-ks2-y34", "science", "Science quick-fire (Years 3–4)", ["3", "4"], SCIENCE_Y34),
  facts("science-ks2-y56", "science", "Science quick-fire (Years 5–6)", ["5", "6"], SCIENCE_Y56),
];
export const packById = (id: string): DrillPack | null => PACKS.find((p) => p.id === id) ?? null;

export const DRILL = { n: 12, answerMs: 15_000 } as const;

/** A per-child, per-item mastery-lite record — same shape philosophy as penguin's FactState, but far simpler:
 *  no FSRS, just attempts/correct/streak and a 0-4 "thaw" level (never seen -> shaky -> ok -> solid -> mastered). */
export interface ItemState { id: string; attempts: number; correct: number; streak: number; thaw: 0 | 1 | 2 | 3 | 4; lastMs: number; lastWrong: string | null; updatedAt: string }
export const freshItemState = (id: string): ItemState => ({ id, attempts: 0, correct: 0, streak: 0, thaw: 0, lastMs: 0, lastWrong: null, updatedAt: "" });

/** Build a form of `n` items from a pack: weakest (lowest thaw, longest since seen) first, so practice targets
 *  what a child hasn't secured yet — never the raw, un-weighted order of the word list. Deterministic from `seed`. */
export function makeDrillPlan(seed: number, pack: DrillPack, states: ReadonlyMap<string, ItemState>): DrillItem[] {
  const rng = makeRng(seed);
  const weighted = pack.items.map((it) => {
    const s = states.get(it.id);
    const weight = s ? (4 - s.thaw) + 1 : 6; // never-seen items get the strongest pull, then weakest-first
    return { it, weight, jitter: rng.next() };
  });
  weighted.sort((a, b) => b.weight - a.weight || b.jitter - a.jitter);
  const n = Math.min(DRILL.n, pack.items.length);
  // take the weakest 2n candidates then shuffle down to n, so the form isn't rigidly the same order every time
  const pool = weighted.slice(0, Math.min(weighted.length, n * 2)).map((w) => w.it);
  return rng.shuffle(pool).slice(0, n);
}

export interface DrillAnswer { v: string; ms: number }
export interface DrillRow { id: string; prompt: string; answer: string; entered: string; ok: boolean; ms: number }
export interface DrillResult { score: number; total: number; rows: DrillRow[]; streak: number }

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Mark a form. Pure — the server calls this from the STORED plan + the submitted answers; the client never sends a score. */
export function markDrill(plan: DrillItem[], answers: DrillAnswer[]): DrillResult {
  let streak = 0, best = 0;
  const rows: DrillRow[] = plan.map((it, i) => {
    const a = answers[i];
    const entered = typeof a?.v === "string" ? a.v.slice(0, 200) : "";
    const ms = Math.max(0, Math.min(DRILL.answerMs + 1000, Math.round(a?.ms ?? 0)));
    const ok = it.accepted.some((acc) => norm(acc) === norm(entered)) && ms <= DRILL.answerMs + 500;
    streak = ok ? streak + 1 : 0; best = Math.max(best, streak);
    return { id: it.id, prompt: it.prompt, answer: it.answer, entered, ok, ms };
  });
  return { score: rows.filter((r) => r.ok).length, total: rows.length, rows, streak: best };
}

/** Update each item's mastery-lite state from one form's rows. Pure — used by both the server (record) and the
 *  in-memory demo. */
export function applyDrillToItems(rows: DrillRow[], states: ReadonlyMap<string, ItemState>, nowIso: string): Map<string, ItemState> {
  const out = new Map(states);
  for (const r of rows) {
    const s = out.get(r.id) ?? freshItemState(r.id);
    const attempts = s.attempts + 1, correct = s.correct + (r.ok ? 1 : 0), streak = r.ok ? s.streak + 1 : 0;
    const thaw = r.ok ? (Math.min(4, s.thaw + (streak >= 2 ? 1 : 0)) as 0 | 1 | 2 | 3 | 4) : (Math.max(0, s.thaw - 1) as 0 | 1 | 2 | 3 | 4);
    out.set(r.id, { id: r.id, attempts, correct, streak, thaw, lastMs: r.ms, lastWrong: r.ok ? null : r.entered || null, updatedAt: nowIso });
  }
  return out;
}
export const cleanDrillAnswers = (raw: unknown, n: number): DrillAnswer[] | null => {
  if (!Array.isArray(raw) || raw.length !== n) return null;
  const out: DrillAnswer[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") return null;
    const v = (x as { v?: unknown }).v, ms = (x as { ms?: unknown }).ms;
    if (typeof v !== "string" || typeof ms !== "number" || !Number.isFinite(ms)) return null;
    out.push({ v, ms });
  }
  return out;
};
