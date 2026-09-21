// Seed believable DEMO STUDENTS (with weeks of learning history) into ONE tenant's
// Learning Hub, so the hub can be seen "in practice": quiz/diagnostic attempts, mastery,
// homework in every state, flashcard reviews, and live lessons.
//
//   npx tsx src/seedLearningHubStudents.ts <tenantId>          # (re)seed — idempotent
//   npx tsx src/seedLearningHubStudents.ts clean <tenantId>    # remove exactly what this created
//   npx tsx src/seedLearningHubStudents.ts check <tenantId>    # read back + assert consistency
//   npx tsx src/seedLearningHubStudents.ts <tenantId> --dry    # build everything, write nothing
//
// HOW IT STAYS HONEST
//  · Content (topics/notes/questions/quizzes/diagnostic/flashcards) comes from
//    seedLearningHubDemo.ts, run as a SUBPROCESS when the tenant doesn't have it yet
//    (it stays the single content source). This file only ADDS a few extra quizzes /
//    questions / flashcards (ids `hubdemo-<tid>-s-…`) so every subject has a diagnostic
//    and the students have more than one quiz to learn from.
//  · Attempts are marked with the REAL pure functions (hubScoring: markResponse /
//    scoreAttempt / applyManualMark), mastery rows are written by the REAL
//    recomputeChildMastery, flashcard reviews run through the REAL sm2(), lesson rooms
//    through the real hubVideo helper — so the data is exactly what the API would have
//    produced. `check` re-derives everything with the pure functions and also calls the
//    real read-path handlers (GET /mastery, /mastery/overview, /homework/inbox, …).
//
// SAFETY
//  · The tenant id is REQUIRED; e2e (@activityos-test.com) tenants are refused.
//  · Every doc this writes has an id starting `hubdemo-<tid>-s-` (or is keyed by a demo
//    child: enrolments `${tid}__${childId}`, mastery, flashcard reviews) and enrolments
//    carry `demo: true`. `clean` deletes only those. It never touches a real `children`
//    doc — the two real children (Hannah JR / Yamal JR of the owner's parent account) are
//    only ENROLLED, their child docs are read-only here.
//  · Nothing goes through the API: no notification, no email is ever sent.
//  · NOTE: seedLearningHubDemo.ts `clean` deletes everything under `hubdemo-<tid>-`, which
//    includes this file's extra content docs (not the attempts / mastery / reviews). If you
//    run that clean, re-run this seed.
import "dotenv/config";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./firebase";
import { hubConfig } from "./lib/hubCore";
import { applyManualMark, inferRule, markResponse, scoreAttempt, type AttemptScore, type MarkRule, type ScoredAnswer } from "./lib/hubScoring";
import { bandFor, computeTopicMastery, rollupSubject, trendOf, type AttemptLite, type TopicMastery } from "./lib/hubMastery";
import { buildQueue, sm2, type SrsQuality, type SrsState } from "./lib/hubSrs";
import { deleteRoom, ensureRoom, joinWindow, roomNameFor, videoConfigured } from "./lib/hubVideo";
import { hubMasteryApi, recomputeChildMastery } from "./routes/hub/mastery";
import { hubHomeworkApi } from "./routes/hub/homeworkApi";
import { hubFlashcardsApi } from "./routes/hub/flashcardsApi";
import { hubLessonsApi } from "./routes/hub/lessonsApi";
import { hubAttemptsApi } from "./routes/hub/attempts";

const DRY = process.argv.includes("--dry");
/** Also enrol the owner's two REAL children (Hannah JR / Yamal JR). Off unless asked for: it reads two real child
 *  names under a real parent uid and writes an enrolment carrying that parent's email. */
const WITH_REAL = process.argv.includes("--with-real-children");
process.argv = process.argv.filter((a) => a !== "--dry" && a !== "--with-real-children");
const arg1 = process.argv[2];
const MODE: "seed" | "clean" | "check" = arg1 === "clean" ? "clean" : arg1 === "check" ? "check" : "seed";
const TID = MODE === "seed" ? arg1 : process.argv[3];
if (!TID || TID.startsWith("-")) {
  console.error("Usage: npx tsx src/seedLearningHubStudents.ts <tenantId> [--dry]   |   ... clean <tenantId>   |   ... check <tenantId>");
  process.exit(1);
}
const PREFIX = `hubdemo-${TID}-`;
const P = `${PREFIX}s-`; // everything this file owns starts here
const id = (s: string) => `${P}${s}`;
const baseId = (s: string) => `${PREFIX}${s}`; // content owned by seedLearningHubDemo.ts
const here = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(here, "..");

/** The owner's real parent account, whose two real children are enrolled as the "rich" demo students. */
const REAL_PARENT_UID = "yh6FCmwPpUbg0BWdbf1khrbHpQl1";
const REAL_PARENT_EMAIL_FALLBACK = "amirthedad@gmail.com";

// ── time & randomness ────────────────────────────────────────────────────────
const DAY = 86_400_000;
const NOW = Date.now();
const MIDNIGHT = (() => { const d = new Date(NOW); d.setUTCHours(0, 0, 0, 0); return d.getTime(); })();
/** `ago` days before today (negative = future) at hh:mm UTC. */
const at = (ago: number, h = 16, m = 0) => new Date(MIDNIGHT - ago * DAY + (h * 60 + m) * 60_000).toISOString();
const clampPast = (ms: number) => new Date(Math.min(ms, NOW - 3_600_000)).toISOString();

function rngFor(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── guard ────────────────────────────────────────────────────────────────────
async function guard(): Promise<{ name: string; ownerUid: string; ownerName: string }> {
  const t = await db.collection("tenants").doc(TID).get();
  if (!t.exists) { console.error(`No tenant ${TID}.`); process.exit(1); }
  const ownerUid = (t.get("ownerUid") as string | undefined) ?? "";
  const owner = ownerUid ? await db.collection("users").doc(ownerUid).get() : null;
  const emails = [t.get("email"), t.get("notifyEmail"), owner?.get("email")].filter((e): e is string => typeof e === "string");
  const bad = emails.find((e) => e.toLowerCase().endsWith("@activityos-test.com"));
  if (bad) { console.error(`Refusing: tenant ${TID} is an e2e test account (${bad}). The Playwright suite owns those.`); process.exit(1); }
  return { name: (t.get("name") as string) ?? TID, ownerUid, ownerName: ((owner?.get("name") as string | undefined) ?? "").trim() || "Your tutor" };
}

// ── the cast ─────────────────────────────────────────────────────────────────
interface Student {
  key: string; n: number; first: string; last: string; dob: string; school: string;
  /** Enrolled subjects; [] = every subject (the real semantics of an enrolment). */
  subjects: string[]; enrolledAgo: number; story: string;
  /** A real child of REAL_PARENT_UID, looked up by name — enrolled only, never created or edited. */
  realName?: string;
}
const STUDENTS: Student[] = [
  { key: "hannah", n: 0, first: "Hannah", last: "JR", dob: "", school: "", subjects: [], enrolledAgo: 71, story: "Steady improver — full history in every subject", realName: "Hannah JR" },
  { key: "yamal", n: 0, first: "Yamal", last: "JR", dob: "", school: "", subjects: [], enrolledAgo: 69, story: "Strong in Maths, weaker in English and Science", realName: "Yamal JR" },
  { key: "olivia", n: 1, first: "Olivia", last: "Bennett", dob: "2010-04-12", school: "Ashdown High School", subjects: [], enrolledAgo: 70, story: "High achiever (Year 11)" },
  { key: "jamie", n: 2, first: "Jamie", last: "Walsh", dob: "2017-02-27", school: "St Mary's Primary", subjects: ["Maths", "English"], enrolledAgo: 68, story: "Struggler who has improved markedly" },
  { key: "priya", n: 3, first: "Priya", last: "Sharma", dob: "2014-06-08", school: "Riverside Academy", subjects: [], enrolledAgo: 66, story: "Maths star, weak in English and Science" },
  { key: "callum", n: 4, first: "Callum", last: "Reid", dob: "2013-01-23", school: "Hollins Grammar", subjects: ["Maths", "Science"], enrolledAgo: 65, story: "Inconsistent — a recent dip" },
  { key: "aisha", n: 5, first: "Aisha", last: "Rahman", dob: "2019-05-30", school: "Elm Park Primary", subjects: ["Maths"], enrolledAgo: 6, story: "Brand new — placement test only" },
  { key: "tommy", n: 6, first: "Tommy", last: "Ellis", dob: "2015-08-14", school: "Oakfield Junior", subjects: [], enrolledAgo: 10, story: "Enrolled, no activity yet" },
];
const fakeChildId = (s: Student) => `${PREFIX}child-${s.key}`;

// ── extra content (this file's own — the base content comes from seedLearningHubDemo.ts) ──
type QDef = { key: string; topic: string; kind: string; prompt: string; options?: { id: string; text: string }[]; answer: unknown; accepted?: string[]; tolerance?: number; marks?: number; explanation: string };
const opts = (...t: string[]) => t.map((text, i) => ({ id: "abcdef"[i], text }));
const EXTRA_Q: QDef[] = [
  { key: "lin3", topic: "maths-algebra-linear", kind: "number", prompt: "Solve x/4 + 3 = 8. What is x?", answer: 20, explanation: "x/4 = 5, so x = 20." },
  { key: "frac3", topic: "maths-fractions", kind: "number", prompt: "What is 2/3 of 12?", answer: 8, explanation: "12 ÷ 3 = 4, then 4 × 2 = 8." },
  { key: "frac4", topic: "maths-fractions", kind: "single", prompt: "Which of these fractions is the largest?", options: opts("3/4", "2/3", "5/8", "7/12"), answer: "a", explanation: "As decimals: 0.75, 0.67, 0.63, 0.58." },
  { key: "geo3", topic: "maths-geometry", kind: "number", prompt: "A rectangle is 8 cm by 5 cm. What is its perimeter in cm?", answer: 26, explanation: "2 × (8 + 5) = 26." },
  { key: "geo4", topic: "maths-geometry", kind: "single", prompt: "How many degrees is a right angle?", options: opts("45°", "90°", "180°", "60°"), answer: "b", explanation: "A right angle is a quarter turn: 90°." },
  { key: "gram2", topic: "english-grammar", kind: "single", prompt: "Choose the correct word: \"They left ___ coats at school.\"", options: opts("their", "there", "they're"), answer: "a", explanation: "\"Their\" shows the coats belong to them." },
  { key: "gram3", topic: "english-grammar", kind: "short", prompt: "Write the past tense of the verb \"to run\".", answer: "ran", explanation: "Run → ran (an irregular verb)." },
  { key: "gram4", topic: "english-grammar", kind: "multi", prompt: "Select ALL the nouns: quickly, table, happiness, jump", options: opts("quickly", "table", "happiness", "jump"), answer: ["b", "c"], marks: 2, explanation: "\"Table\" is a thing and \"happiness\" is an idea. \"Quickly\" is an adverb; \"jump\" is a verb here." },
  { key: "comp1", topic: "english-comprehension", kind: "single", prompt: "Read: \"The door creaked open and a cold draught swept through the hall. Maya gripped the banister.\" How does Maya most likely feel?", options: opts("Bored", "Nervous", "Excited about a party", "Sleepy"), answer: "b", explanation: "Gripping the banister and the cold, creaking setting suggest she is nervous." },
  { key: "comp2", topic: "english-comprehension", kind: "short", prompt: "In the same extract, which word tells us the door made a noise?", answer: "creaked", explanation: "\"Creaked\" is the sound word." },
  { key: "comp3", topic: "english-comprehension", kind: "written", prompt: "Using PEE (Point, Evidence, Explain), describe how the writer creates a tense atmosphere in the extract.", answer: null, marks: 3, explanation: "A good answer names the atmosphere, quotes \"creaked\" or \"cold draught\", and explains the effect on the reader." },
  { key: "force1", topic: "science-forces", kind: "single", prompt: "What is the unit of force?", options: opts("Newton", "Joule", "Watt", "Kilogram"), answer: "a", explanation: "Force is measured in newtons (N)." },
  { key: "force2", topic: "science-forces", kind: "number", prompt: "A car travels 150 m in 10 s. What is its speed in m/s?", answer: 15, explanation: "speed = distance ÷ time = 150 ÷ 10 = 15 m/s." },
  { key: "force3", topic: "science-forces", kind: "short", prompt: "What force pulls objects towards the Earth?", answer: "gravity", accepted: ["gravitational force", "the force of gravity"], explanation: "Gravity pulls everything towards the centre of the Earth." },
  { key: "force4", topic: "science-forces", kind: "multi", prompt: "Select ALL the contact forces.", options: opts("Friction", "Gravity", "Air resistance", "Magnetism"), answer: ["a", "c"], marks: 2, explanation: "Contact forces need touching; gravity and magnetism act at a distance." },
];
type ADef = { key: string; type: "quiz" | "diagnostic"; title: string; subject: string; topics: string[]; questionKeys: string[]; timeLimitMins: number | null; passMarkPct: number };
const EXTRA_A: ADef[] = [
  { key: "quiz-fg", type: "quiz", title: "Fractions & geometry quiz", subject: "Maths", topics: ["maths-fractions", "maths-geometry"], questionKeys: ["frac1", "frac2", "frac3", "frac4", "geo1", "geo2", "geo3", "geo4"], timeLimitMins: null, passMarkPct: 70 },
  { key: "diag-english", type: "diagnostic", title: "English placement check", subject: "English", topics: ["english-grammar", "english-comprehension"], questionKeys: ["gram1", "gram2", "gram3", "comp1", "comp2"], timeLimitMins: null, passMarkPct: 0 },
  { key: "quiz-grammar", type: "quiz", title: "Grammar & punctuation quiz", subject: "English", topics: ["english-grammar"], questionKeys: ["gram1", "gram2", "gram3", "gram4"], timeLimitMins: null, passMarkPct: 60 },
  { key: "quiz-reading", type: "quiz", title: "Reading comprehension quiz", subject: "English", topics: ["english-comprehension"], questionKeys: ["comp1", "comp2", "comp3"], timeLimitMins: 15, passMarkPct: 60 },
  { key: "diag-science", type: "diagnostic", title: "Science placement check", subject: "Science", topics: ["science-cells", "science-forces"], questionKeys: ["cell1", "cell2", "cell3", "force1", "force2", "force3"], timeLimitMins: null, passMarkPct: 0 },
  { key: "quiz-forces", type: "quiz", title: "Forces & motion quiz", subject: "Science", topics: ["science-forces"], questionKeys: ["force1", "force2", "force3", "force4"], timeLimitMins: null, passMarkPct: 60 },
];
const EXTRA_CARDS: [string, string, string, string][] = [
  ["force-unit", "science-forces", "What is the unit of force?", "The newton (N)."],
  ["force-speed", "science-forces", "How do you calculate speed?", "speed = distance ÷ time."],
  ["force-friction", "science-forces", "Which force slows a sliding object down?", "Friction."],
  ["force-mass", "science-forces", "Mass vs weight?", "Mass is the amount of matter (kg); weight is the pull of gravity on it (N)."],
  ["comp-pee", "english-comprehension", "What does PEE stand for?", "Point, Evidence, Explain."],
  ["comp-infer", "english-comprehension", "What is inference?", "Working out something the writer hasn't said directly, using clues in the text."],
  ["comp-atmos", "english-comprehension", "What is \"atmosphere\" in a story?", "The mood or feeling the writer creates for the reader."],
  ["gram-noun", "english-grammar", "What is a noun?", "A word that names a person, place, thing or idea."],
];

/** short alias → id key (under PREFIX) of every assessment used by the attempt specs. */
const ASM: Record<string, string> = {
  dM: "diag-maths", qA: "quiz-algebra", qCell: "quiz-cells",
  qF: "s-quiz-fg", dE: "s-diag-english", qG: "s-quiz-grammar", qC: "s-quiz-reading", dS: "s-diag-science", qFor: "s-quiz-forces",
};

// ── attempt specs (the learning stories) ─────────────────────────────────────
type Level = "good" | "ok" | "weak";
interface AttSpec {
  s: string; a: keyof typeof ASM; ago: number; t: [number, number];
  /** Question keys answered wrongly (by design) — everything else is right. */
  wrong?: string[]; /** Left blank (counts as wrong). */ skip?: string[];
  /** Written question: marks the tutor gave, or "pending" (still waiting for the tutor). */
  wr?: number | "pending"; lvl?: Level; hw?: string;
}
const ATT: AttSpec[] = [
  // Hannah — steady improver, every subject, ~10 weeks
  { s: "hannah", a: "dM", ago: 69, t: [16, 20], wrong: ["quad1", "frac1", "frac2", "geo2"] },
  { s: "hannah", a: "dE", ago: 68, t: [17, 5], wrong: ["gram2", "gram3", "comp2"] },
  { s: "hannah", a: "dS", ago: 67, t: [16, 35], wrong: ["cell3", "force2", "force3"] },
  { s: "hannah", a: "qF", ago: 63, t: [16, 45], wrong: ["frac1", "frac3", "frac4", "geo3", "geo4"] },
  { s: "hannah", a: "qA", ago: 56, t: [17, 10], wrong: ["lin2", "quad2"], wr: 1.5 },
  { s: "hannah", a: "qCell", ago: 52, t: [16, 30], wrong: ["cell3"] },
  { s: "hannah", a: "qG", ago: 55, t: [17, 20], wrong: ["gram3", "gram4"] },
  { s: "hannah", a: "qF", ago: 49, t: [16, 15], wrong: ["frac3", "frac4", "geo3", "geo4"] },
  { s: "hannah", a: "qC", ago: 47, t: [16, 50], wrong: ["comp2"], wr: 1 },
  { s: "hannah", a: "qFor", ago: 44, t: [17, 0], wrong: ["force3", "force4"] },
  { s: "hannah", a: "qA", ago: 42, t: [16, 40], wrong: ["quad2"], wr: 1.5 },
  { s: "hannah", a: "qG", ago: 38, t: [17, 25], wrong: ["gram2", "gram3"] },
  { s: "hannah", a: "qF", ago: 35, t: [16, 20], wrong: ["frac4", "geo3", "geo4"] },
  { s: "hannah", a: "qCell", ago: 33, t: [17, 5], wrong: ["cell1"] },
  { s: "hannah", a: "qC", ago: 30, t: [16, 35], wrong: ["comp2"], wr: 2 },
  { s: "hannah", a: "qA", ago: 28, t: [16, 55], wrong: ["quad2"], wr: 2.5 },
  { s: "hannah", a: "qFor", ago: 24, t: [17, 15], wrong: ["force4"] },
  { s: "hannah", a: "qF", ago: 21, t: [16, 10], wrong: ["frac4", "geo4"] },
  { s: "hannah", a: "qG", ago: 19, t: [17, 30], wrong: ["gram3"] },
  { s: "hannah", a: "qA", ago: 14, t: [16, 45], wrong: ["quad2"], wr: 3, hw: "algebra" },
  { s: "hannah", a: "qCell", ago: 12, t: [17, 0], wrong: [] },
  { s: "hannah", a: "qC", ago: 9, t: [16, 25], wrong: [], wr: 2 },
  { s: "hannah", a: "qF", ago: 8, t: [17, 20], wrong: ["frac4"], hw: "fg" },
  { s: "hannah", a: "qFor", ago: 4, t: [16, 40], wrong: ["force3"] },
  { s: "hannah", a: "qA", ago: 2, t: [17, 10], wrong: [], wr: "pending", lvl: "ok" },
  { s: "hannah", a: "qC", ago: 1, t: [16, 30], wrong: [], wr: "pending", lvl: "good" },
  // Yamal — Maths star; English/Science weaker
  { s: "yamal", a: "dM", ago: 67, t: [16, 15], wrong: ["geo2"] },
  { s: "yamal", a: "dE", ago: 66, t: [17, 0], wrong: ["gram2", "gram3", "comp2"] },
  { s: "yamal", a: "dS", ago: 65, t: [16, 30], wrong: ["cell3", "force2", "force3"] },
  { s: "yamal", a: "qA", ago: 60, t: [16, 20], wrong: [], wr: 3 },
  { s: "yamal", a: "qF", ago: 53, t: [17, 10], wrong: ["frac4"] },
  { s: "yamal", a: "qG", ago: 51, t: [16, 45], wrong: ["gram1", "gram2", "gram3"] },
  { s: "yamal", a: "qCell", ago: 47, t: [17, 25], wrong: ["cell2", "cell3"] },
  { s: "yamal", a: "qA", ago: 46, t: [16, 5], wrong: ["lin2"], wr: 3 },
  { s: "yamal", a: "qC", ago: 41, t: [16, 55], wrong: ["comp2"], wr: 1.5 },
  { s: "yamal", a: "qF", ago: 39, t: [17, 15], wrong: [] },
  { s: "yamal", a: "qFor", ago: 37, t: [16, 35], wrong: ["force2", "force3"] },
  { s: "yamal", a: "qA", ago: 32, t: [16, 50], wrong: [], wr: 2.5 },
  { s: "yamal", a: "qG", ago: 27, t: [17, 5], wrong: ["gram1", "gram2"] },
  { s: "yamal", a: "qF", ago: 25, t: [16, 25], wrong: ["geo3"] },
  { s: "yamal", a: "qCell", ago: 22, t: [17, 30], wrong: ["cell3"] },
  { s: "yamal", a: "qA", ago: 18, t: [16, 40], wrong: [], wr: 3, hw: "algebra" },
  { s: "yamal", a: "qC", ago: 14, t: [17, 0], wrong: ["comp1"], wr: 2 },
  { s: "yamal", a: "qFor", ago: 11, t: [16, 20], wrong: ["force2", "force4"] },
  { s: "yamal", a: "qF", ago: 10, t: [17, 35], wrong: [], hw: "fg" },
  { s: "yamal", a: "qCell", ago: 5, t: [16, 45], wrong: ["cell1"] },
  { s: "yamal", a: "qC", ago: 3, t: [17, 10], wrong: [], wr: "pending", lvl: "ok" },
  // Olivia — high achiever
  { s: "olivia", a: "dM", ago: 68, t: [16, 10], wrong: ["geo2"] },
  { s: "olivia", a: "dE", ago: 68, t: [16, 45], wrong: ["gram3"] },
  { s: "olivia", a: "dS", ago: 67, t: [17, 5], wrong: ["force2"] },
  { s: "olivia", a: "qA", ago: 61, t: [16, 20], wrong: ["lin2"], wr: 3 },
  { s: "olivia", a: "qF", ago: 55, t: [17, 0], wrong: ["frac4"] },
  { s: "olivia", a: "qCell", ago: 49, t: [16, 35], wrong: [] },
  { s: "olivia", a: "qA", ago: 40, t: [16, 15], wrong: [], wr: 2.5 },
  { s: "olivia", a: "qG", ago: 33, t: [17, 20], wrong: ["gram3"] },
  { s: "olivia", a: "qFor", ago: 26, t: [16, 55], wrong: ["force3"] },
  { s: "olivia", a: "qC", ago: 19, t: [17, 10], wrong: [], wr: 2.5 },
  { s: "olivia", a: "qA", ago: 12, t: [16, 30], wrong: [], wr: 2.5, hw: "algebra" },
  { s: "olivia", a: "qF", ago: 6, t: [17, 25], wrong: ["geo4"] },
  { s: "olivia", a: "qC", ago: 2, t: [16, 5], wrong: [], wr: "pending", lvl: "good" },
  // Jamie — struggles, then climbs
  { s: "jamie", a: "dM", ago: 66, t: [16, 30], wrong: ["quad1", "frac1", "frac2", "geo2"] },
  { s: "jamie", a: "dE", ago: 65, t: [17, 10], wrong: ["gram2", "gram3", "comp2"] },
  { s: "jamie", a: "qF", ago: 58, t: [16, 40], wrong: ["frac1", "frac2", "frac4", "geo2"], skip: ["geo3"] },
  { s: "jamie", a: "qA", ago: 51, t: [17, 5], wrong: ["quad1", "quad2", "lin2"], wr: 1 },
  { s: "jamie", a: "qF", ago: 44, t: [16, 25], wrong: ["frac1", "frac3", "geo3", "geo4"] },
  { s: "jamie", a: "qG", ago: 40, t: [17, 15], wrong: ["gram3", "gram4"] },
  { s: "jamie", a: "qA", ago: 33, t: [16, 50], wrong: ["quad2"], wr: 1.5 },
  { s: "jamie", a: "qF", ago: 24, t: [17, 30], wrong: ["frac4", "geo3", "geo4"] },
  { s: "jamie", a: "qG", ago: 20, t: [16, 20], wrong: ["gram2", "gram3"] },
  { s: "jamie", a: "qA", ago: 12, t: [16, 55], wrong: ["quad2"], wr: 2.5, hw: "algebra" },
  { s: "jamie", a: "qF", ago: 6, t: [17, 40], wrong: ["frac4", "geo3"], hw: "fg" },
  { s: "jamie", a: "qG", ago: 3, t: [17, 0], wrong: ["gram3"] },
  { s: "jamie", a: "qC", ago: 2, t: [16, 10], wrong: ["comp2"], wr: "pending", lvl: "weak" },
  // Priya — maths star, weak elsewhere
  { s: "priya", a: "dM", ago: 64, t: [16, 0], wrong: ["geo2"] },
  { s: "priya", a: "dE", ago: 63, t: [16, 40], wrong: ["gram2", "gram3", "comp2"] },
  { s: "priya", a: "dS", ago: 62, t: [17, 10], wrong: ["cell3", "force2", "force3"] },
  { s: "priya", a: "qA", ago: 57, t: [16, 30], wrong: [], wr: 2.5 },
  { s: "priya", a: "qF", ago: 50, t: [17, 20], wrong: ["frac4"] },
  { s: "priya", a: "qG", ago: 46, t: [16, 15], wrong: ["gram1", "gram2", "gram3"] },
  { s: "priya", a: "qCell", ago: 44, t: [16, 45], wrong: ["cell2", "cell3"] },
  { s: "priya", a: "qA", ago: 42, t: [17, 0], wrong: [], wr: 3 },
  { s: "priya", a: "qC", ago: 37, t: [16, 55], wrong: ["comp2"], wr: 1 },
  { s: "priya", a: "qFor", ago: 32, t: [17, 10], wrong: ["force2", "force3", "force4"] },
  { s: "priya", a: "qF", ago: 30, t: [16, 20], wrong: ["geo3"] },
  { s: "priya", a: "qG", ago: 25, t: [17, 25], wrong: ["gram4"] },
  { s: "priya", a: "qCell", ago: 18, t: [16, 40], wrong: ["cell3"] },
  { s: "priya", a: "qA", ago: 16, t: [17, 5], wrong: ["lin2"], wr: 3, hw: "algebra" },
  { s: "priya", a: "qC", ago: 10, t: [16, 15], wrong: ["comp1"], wr: "pending", lvl: "ok" },
  { s: "priya", a: "qF", ago: 8, t: [16, 50], wrong: [], hw: "fg" },
  { s: "priya", a: "qFor", ago: 5, t: [17, 35], wrong: ["force2", "force4"] },
  // Callum — inconsistent, recent dip
  { s: "callum", a: "dM", ago: 62, t: [16, 20], wrong: ["lin1", "geo2"] },
  { s: "callum", a: "dS", ago: 61, t: [17, 0], wrong: ["cell3", "force2"] },
  { s: "callum", a: "qA", ago: 55, t: [16, 40], wrong: ["lin2"], wr: 2 },
  { s: "callum", a: "qCell", ago: 52, t: [17, 15], wrong: ["cell1"] },
  { s: "callum", a: "qF", ago: 48, t: [16, 10], wrong: ["frac3", "geo3"] },
  { s: "callum", a: "qA", ago: 41, t: [17, 20], wrong: ["lin2"], wr: 3 },
  { s: "callum", a: "qFor", ago: 36, t: [16, 30], wrong: ["force4"] },
  { s: "callum", a: "qF", ago: 27, t: [17, 0], wrong: ["frac1", "frac2", "frac4", "geo1"] },
  { s: "callum", a: "qCell", ago: 24, t: [16, 45], wrong: ["cell1", "cell3"] },
  { s: "callum", a: "qA", ago: 20, t: [17, 10], wrong: ["lin1", "lin2", "quad1"], wr: 1, hw: "algebra" },
  { s: "callum", a: "qFor", ago: 13, t: [16, 20], wrong: ["force1", "force2", "force3"] },
  { s: "callum", a: "qF", ago: 9, t: [17, 30], wrong: ["frac2", "frac3", "geo3"], hw: "fg" },
  { s: "callum", a: "qA", ago: 3, t: [16, 10], wrong: ["lin2", "quad2"], wr: "pending", lvl: "weak" },
  // Aisha — new: placement test only
  { s: "aisha", a: "dM", ago: 4, t: [16, 40], wrong: ["quad1", "frac1", "frac2"] },
];

// ── written answers + tutor feedback banks ───────────────────────────────────
const WRITTEN: Record<string, Record<Level, string>> = {
  quad3: {
    good: "Expanding the brackets should give you back the original expression. If it doesn't match, you know you've made a mistake with your numbers, so it's a quick way to check the answer is right before you move on.",
    ok: "Because you can multiply it out again and see if you get the same thing you started with.",
    weak: "So you know it is right.",
  },
  comp3: {
    good: "The writer creates a tense atmosphere by describing the door as having 'creaked' open. This is a sinister sound, which suggests something might be wrong in the house. The 'cold draught' also makes the reader feel uneasy, as if someone or something is there.",
    ok: "The writer makes it tense with the word 'creaked'. This shows the door is old and scary so the reader feels nervous about what is inside.",
    weak: "It is scary because the door creaks.",
  },
};
const FEEDBACK: Record<string, [string, string, string]> = {
  quad3: [
    "Excellent explanation — clear, correct and in your own words. Full marks.",
    "Good, you have the main idea. Next time add why it matters: what does it tell you if the expanded answer doesn't match?",
    "Not quite there yet. Try multiplying out (x + 2)(x + 3) and see what you get. We'll go over it together next lesson.",
  ],
  comp3: [
    "Really well done: Point, Evidence and a proper Explain. You linked 'creaked' to the reader's feelings.",
    "You have the Point and the Evidence. To push up a mark, explain more about the effect — what does 'creaked' make the reader imagine?",
    "A start, but it needs the PEE structure. Which word or phrase is your evidence, and what does it suggest? Let's practise next lesson.",
  ],
};
const feedbackFor = (key: string, frac: number) => (FEEDBACK[key] ?? FEEDBACK.quad3)[frac >= 0.83 ? 0 : frac >= 0.4 ? 1 : 2];
const levelFor = (frac: number): Level => (frac >= 0.83 ? "good" : frac >= 0.4 ? "ok" : "weak");

const WRONG_EXACT: Record<string, string> = { frac1: "2/7", geo2: "360", cell2: "respiration", gram3: "runned", comp2: "opened", force3: "friction" };
const WRONG_NUM: Record<string, number> = { lin1: 15, lin3: 32, frac2: 0.83, frac3: 6, geo1: 13, geo3: 40, force2: 1500 };

// ── stored shapes (mirror routes/hub/shared.ts) ──────────────────────────────
interface QDoc { id: string; key: string; topicId: string; kind: string; prompt: string; options: { id: string; text: string }[]; answer: unknown; acceptedAnswers: string[]; tolerance: number; marks: number; explanation: string }
interface ADoc { id: string; key: string; type: "quiz" | "diagnostic"; title: string; subject: string; topicIds: string[]; questionIds: string[]; timeLimitMins: number | null; passMarkPct: number }
interface Resolved { st: Student; childId: string; childName: string; parentUid: string; parentEmail: string }

const keyOfQ = (docId: string) => docId.replace(PREFIX, "").replace(/^s-q-/, "").replace(/^q-/, "");

function correctResponse(q: QDoc, snapMark: MarkRule, r: () => number, level: Level, written: boolean): unknown {
  switch (snapMark) {
    case "choice": return q.answer;
    case "multi": return q.answer;
    case "exact": {
      const pool = [q.answer as string, ...q.acceptedAnswers];
      let v = pool[r() < 0.7 ? 0 : Math.floor(r() * pool.length)] ?? (q.answer as string);
      if (r() < 0.4) v = v.charAt(0).toUpperCase() + v.slice(1);
      return v;
    }
    case "numeric": return q.answer;
    default: return written ? (WRITTEN[q.key]?.[level] ?? WRITTEN.quad3[level]) : null;
  }
}
function wrongResponse(q: QDoc, snapMark: MarkRule, r: () => number): unknown {
  switch (snapMark) {
    case "choice": {
      const others = q.options.filter((o) => o.id !== q.answer);
      return others[Math.floor(r() * others.length)]?.id ?? "z";
    }
    case "multi": {
      const ans = q.answer as string[];
      if (r() < 0.5) return [ans[0]];
      const extra = q.options.find((o) => !ans.includes(o.id));
      return extra ? [...ans, extra.id] : [ans[0]];
    }
    case "exact": return WRONG_EXACT[q.key] ?? "not sure";
    case "numeric": return WRONG_NUM[q.key] ?? (q.answer as number) + 2;
    default: return "idk";
  }
}

// ── build one attempt with the REAL marking + scoring ───────────────────────
interface BuiltAttempt { docId: string; data: Record<string, unknown>; lite: AttemptLite & { assessmentTitle: string; pct: number | null }; spec: AttSpec; status: string; pct: number; homeworkId: string | null }
function buildAttempt(idx: number, spec: AttSpec, who: Resolved, asm: ADoc, qs: Map<string, QDoc>, cfg: Awaited<ReturnType<typeof hubConfig>>, ownerUid: string, hwDocId: string | null): BuiltAttempt {
  const docId = id(`att-${spec.s}-${String(idx).padStart(2, "0")}`);
  const r = rngFor(`${spec.s}:${idx}`);
  const wrong = new Set([...(spec.wrong ?? []), ...(spec.skip ?? [])]);
  const snaps = asm.questionIds.map((qid) => {
    const q = qs.get(qid);
    if (!q) throw new Error(`Question ${qid} missing for ${asm.id}`);
    return { q, mark: (cfg.questionKinds.find((k) => k.id === q.kind)?.mark ?? inferRule(q)) as MarkRule };
  });
  const snapshot = snaps.map(({ q, mark }) => ({
    id: q.id, topicId: q.topicId, kind: q.kind, mark, prompt: q.prompt, options: q.options, marks: q.marks, answer: q.answer ?? null,
    acceptedAnswers: q.acceptedAnswers, tolerance: q.tolerance, explanation: q.explanation,
  }));
  const hasManual = snaps.some((x) => x.mark === "manual");
  if (hasManual && spec.wr === undefined) throw new Error(`Attempt ${spec.s}#${idx} (${spec.a}) has a written question but no wr`);
  const finalWr = typeof spec.wr === "number" ? spec.wr : null;

  const submittedAt = at(spec.ago, spec.t[0], spec.t[1]);
  const durMins = Math.min(asm.timeLimitMins ? asm.timeLimitMins - 3 : 30, 5 + Math.floor(r() * 4) + asm.questionIds.length * 1.4 | 0);
  const startedAt = new Date(Date.parse(submittedAt) - durMins * 60_000).toISOString();

  // 1. what the student typed, then the server's first marking pass (auto marks; written = pending)
  let answers = snaps.map(({ q, mark }) => {
    const qr = rngFor(`${spec.s}:${idx}:${q.key}`);
    const skipped = (spec.skip ?? []).includes(q.key);
    const intendedWrong = wrong.has(q.key);
    const lvl: Level = spec.lvl ?? (finalWr !== null ? levelFor(finalWr / q.marks) : "ok");
    let response: unknown;
    if (mark === "manual") response = skipped ? "" : correctResponse(q, mark, qr, lvl, true);
    else response = skipped ? (mark === "multi" ? [] : "") : intendedWrong ? wrongResponse(q, mark, qr) : correctResponse(q, mark, qr, lvl, false);
    const o = markResponse({ mark, answer: q.answer, acceptedAnswers: q.acceptedAnswers, tolerance: q.tolerance, marks: q.marks }, response);
    if (mark !== "manual" && o.correct !== !intendedWrong) throw new Error(`Spec mismatch: ${spec.s}#${idx} ${spec.a} ${q.key}: intended ${intendedWrong ? "wrong" : "right"} but marked ${o.correct} (response ${JSON.stringify(response)})`);
    return { questionId: q.id, topicId: q.topicId, response: response ?? null, correct: o.correct, marksAwarded: o.marksAwarded, marksMax: q.marks, feedback: "", pending: o.pending, _key: q.key };
  });
  let score: AttemptScore = scoreAttempt(answers as ScoredAnswer[], asm.passMarkPct);
  let markedBy: string | null = score.status === "marked" ? "auto" : null;
  let markedAt: string | null = score.status === "marked" ? submittedAt : null;

  // 2. the tutor's marking pass (PUT /attempts/:id/mark) when the written answer has been marked
  if (finalWr !== null && score.status === "pending_marking") {
    answers = answers.map((a) => {
      if (!a.pending) return a;
      const m = applyManualMark(a.marksMax, finalWr);
      return { ...a, correct: m.correct, marksAwarded: m.marksAwarded, pending: false, feedback: feedbackFor(a._key, finalWr / a.marksMax) };
    });
    score = scoreAttempt(answers as ScoredAnswer[], asm.passMarkPct);
    markedBy = ownerUid || "seed";
    markedAt = clampPast(Date.parse(submittedAt) + DAY + (3 + Math.floor(r() * 8)) * 3_600_000);
  } else if (spec.wr === "pending" && score.status !== "pending_marking") {
    throw new Error(`${spec.s}#${idx}: wanted pending but the attempt has no written answer`);
  }

  const cleanAnswers = answers.map(({ _key, ...a }) => a);
  const data = {
    tenantId: TID, franchiseId: null, assessmentId: asm.id, assessmentType: asm.type, assessmentTitle: asm.title, subject: asm.subject, passMarkPct: asm.passMarkPct,
    homeworkId: hwDocId, childId: who.childId, childName: who.childName, parentUid: who.parentUid, startedBy: who.parentUid, submittedBy: who.parentUid,
    startedAt, submittedAt, timeLimitMins: asm.timeLimitMins, late: false, status: score.status, questions: snapshot, answers: cleanAnswers,
    scoreMarks: score.scoreMarks, maxMarks: score.maxMarks, pct: score.pct, byTopic: score.byTopic, markedBy, markedAt, baselineReset: false,
    createdBy: who.parentUid, createdAt: startedAt, updatedAt: markedAt ?? submittedAt,
  };
  return {
    docId, data, spec, status: score.status, pct: score.pct, homeworkId: hwDocId,
    lite: { id: docId, assessmentType: asm.type, status: score.status, subject: asm.subject, submittedAt, byTopic: score.byTopic, baselineReset: false, assessmentTitle: asm.title, pct: score.pct },
  };
}

// ── homework ─────────────────────────────────────────────────────────────────
type Sub =
  | { st: "assigned" }
  | { st: "submitted"; text?: string; ago?: number; t?: [number, number] }
  | { st: "marked"; text?: string; ago?: number; t?: [number, number]; score: number; max: number; feedback: string; markedAgo: number };
interface HwDef {
  key: string; title: string; instructions: string; assessment: keyof typeof ASM | null; notes: string[]; fcTopic: string | null;
  assignedAgo: number; dueAgo: number; subs: Record<string, Sub>;
}
const HW: HwDef[] = [
  { key: "algebra", title: "Algebra checkpoint (quiz)", instructions: "Sit the Algebra checkpoint quiz online. Show your working on paper — I'll ask to see it in the next lesson.", assessment: "qA", notes: ["note-linear", "note-quadratics"], fcTopic: "maths-algebra", assignedAgo: 24, dueAgo: 9, subs: {
    olivia: { st: "marked", score: 9, max: 10, feedback: "Excellent work Olivia — full marks on the method and a really clear explanation on the written question. Keep it up.", markedAgo: 10 },
    jamie: { st: "marked", score: 6, max: 10, feedback: "A big step up from your first attempt, Jamie. The quadratics question is the one to revisit — we'll factorise a few together next lesson.", markedAgo: 10 },
    priya: { st: "marked", score: 8, max: 10, feedback: "Strong algebra again. Just double-check the sign in the second question.", markedAgo: 14 },
    callum: { st: "marked", score: 4, max: 10, feedback: "This one slipped, Callum — I think you rushed it. Let's go back over linear equations on Thursday and I'll set a shorter retry.", markedAgo: 18 },
    hannah: { st: "marked", score: 6, max: 10, feedback: "Solid effort Hannah — you're improving every single week. Watch the sign when a number crosses the equals sign.", markedAgo: 11 },
    yamal: { st: "marked", score: 10, max: 10, feedback: "Perfect score, Yamal. Try the extension sheet if you fancy a challenge.", markedAgo: 16 },
  } },
  { key: "fg", title: "Fractions & geometry checkpoint (quiz)", instructions: "Do the Fractions & geometry quiz. Read the note on adding fractions first.", assessment: "qF", notes: ["note-fractions"], fcTopic: "maths-fractions", assignedAgo: 12, dueAgo: -3, subs: {
    jamie: { st: "submitted" },
    priya: { st: "submitted" },
    callum: { st: "marked", score: 5, max: 10, feedback: "Adding fractions with different denominators is still catching you out — re-read the note and try the fractions flashcards this week.", markedAgo: 6 },
    hannah: { st: "submitted" },
    yamal: { st: "marked", score: 9, max: 10, feedback: "Really strong. One slip on a geometry question — check the units.", markedAgo: 8 },
    tommy: { st: "assigned" },
  } },
  { key: "cells", title: "Label the plant cell", instructions: "Read the cells note, then draw and label a plant cell. Learn the four flashcards on organelles.", assessment: null, notes: ["note-cells"], fcTopic: "science-cells", assignedAgo: 9, dueAgo: 2, subs: {
    priya: { st: "submitted", ago: 3, t: [17, 30], text: "I drew a plant cell and labelled the nucleus, cell wall, chloroplasts, mitochondria and vacuole. Chloroplasts are where photosynthesis happens. I wasn't sure what the cell membrane does." },
    hannah: { st: "submitted", ago: 3, t: [18, 10], text: "I drew an animal cell and a plant cell side by side. Plant cells have a cell wall, chloroplasts and a big vacuole; animal cells don't. Mitochondria release energy in both. I'm still not sure what the vacuole does exactly." },
    callum: { st: "assigned" }, tommy: { st: "assigned" }, yamal: { st: "assigned" },
  } },
  { key: "pee", title: "One PEE paragraph", instructions: "Write one PEE paragraph about how the author shows the narrator is nervous.", assessment: null, notes: ["note-inference"], fcTopic: null, assignedAgo: 12, dueAgo: 5, subs: {
    olivia: { st: "marked", ago: 6, t: [18, 0], score: 9, max: 10, markedAgo: 5, text: "The author presents the narrator as nervous through the description of their physical reactions. For example, their 'hands trembled as they reached for the door handle'. This suggests they are afraid of what is on the other side, and the verb 'trembled' shows they cannot control their fear. The reader is left feeling tense too, anticipating something dramatic.", feedback: "Beautifully structured — a confident Point, a well-chosen quote and a proper Explain. To reach full marks, comment on the writer's choice of the word 'trembled' in even more detail." },
    jamie: { st: "submitted", ago: 3, t: [19, 5], text: "The narrator is nervous because it says his hands were shaking. This shows he is scared." },
    priya: { st: "marked", ago: 6, t: [17, 40], score: 5, max: 10, markedAgo: 4, text: "The author shows the narrator is nervous by saying 'her heart was pounding'. This is nervous because it means she is scared. Also she is walking slowly.", feedback: "Good start Priya — you have the Point and the Evidence. Now push the Explain part: what does 'pounding' suggest, and why does that make the reader feel tense? Try starting your explanation with 'This suggests…'." },
    hannah: { st: "marked", ago: 6, t: [18, 20], score: 6, max: 10, markedAgo: 4, text: "The author shows the narrator is nervous when it says 'his knees felt weak'. This shows he is really scared. It makes the reader feel worried for him too.", feedback: "Good Point and Evidence, Hannah. Your Explain is starting — say what 'weak' suggests (loss of control?) to push it to top marks." },
    yamal: { st: "submitted", ago: 4, t: [18, 45], text: "The narrator is nervous. The author uses the word 'trembled'. This means he was shaking because of nerves." },
    tommy: { st: "assigned" },
  } },
  { key: "forces", title: "Forces & motion quiz", instructions: "Sit the Forces & motion quiz. Remember speed = distance ÷ time.", assessment: "qFor", notes: [], fcTopic: "science-forces", assignedAgo: 2, dueAgo: -5, subs: {
    priya: { st: "assigned" }, callum: { st: "assigned" }, tommy: { st: "assigned" }, hannah: { st: "assigned" }, yamal: { st: "assigned" },
  } },
  { key: "warmup", title: "Number bonds & fractions warm-up", instructions: "Do the warm-up sheet: number bonds to 20, then halves and quarters. Ask a grown-up to check it with you.", assessment: null, notes: [], fcTopic: null, assignedAgo: 1, dueAgo: -6, subs: {
    aisha: { st: "assigned" }, tommy: { st: "assigned" },
  } },
  { key: "reading", title: "Reading diary — three entries", instructions: "Read for at least 20 minutes on three evenings and write a short diary entry for each.", assessment: null, notes: [], fcTopic: null, assignedAgo: 27, dueAgo: 20, subs: {
    olivia: { st: "marked", ago: 22, t: [18, 30], score: 8, max: 10, markedAgo: 20, text: "Week 1: Finished chapter 6 of Of Mice and Men. Lennie depends on George completely and George gets frustrated but still looks after him. Week 2: Chapter 7 — Curley's wife is lonely; she says she 'coulda been in the movies', which shows her lost dreams. Week 3: Started chapter 8 and I'm dreading what happens.", feedback: "A lovely reading log — your comments show real understanding of the characters. Next time quote a short phrase in every entry." },
    jamie: { st: "marked", ago: 21, t: [19, 0], score: 6, max: 10, markedAgo: 19, text: "I read 3 nights this week. The book is about a boy called Ahmet who is new and sits at the back. I liked it because he is funny. My favourite part was the football bit.", feedback: "Great to see three nights of reading, Jamie! Next time try to write one sentence about WHY you liked a part." },
    hannah: { st: "marked", ago: 21, t: [18, 40], score: 7, max: 10, markedAgo: 19, text: "Read 'Wonder' for 4 nights. Auggie is brave because he goes to school even though people stare at him. I would feel scared. It made me think about being kind.", feedback: "A thoughtful log, Hannah — you gave a reason for your opinion. Add a short quote next time." },
    yamal: { st: "marked", ago: 21, t: [19, 15], score: 6, max: 10, markedAgo: 19, text: "Read 2 chapters of Holes. Stanley digs a hole every day. It is boring but then he finds something.", feedback: "You've picked a great book, Yamal. Try to write a full paragraph for each entry rather than a few lines." },
  } },
];

// ── flashcard history through the real SM-2 ──────────────────────────────────
interface Habit { startAgo: number; study: (ago: number) => number; newPerDay: number; cap: number; skill: (ago: number, subject: string) => number }
const HABITS: Record<string, Habit> = {
  hannah: { startAgo: 55, study: () => 0.78, newPerDay: 3, cap: 17, skill: (ago) => 0.4 + (55 - ago) * 0.007 },
  yamal: { startAgo: 42, study: () => 0.6, newPerDay: 4, cap: 18, skill: (_a, subj) => (subj === "Maths" ? 0.9 : 0.4) },
  olivia: { startAgo: 60, study: () => 0.85, newPerDay: 4, cap: 17, skill: () => 0.88 },
  jamie: { startAgo: 45, study: (ago) => (ago > 14 ? 0.5 : 0.7), newPerDay: 2, cap: 10, skill: (ago) => 0.25 + (45 - ago) * 0.008 },
  priya: { startAgo: 50, study: () => 0.4, newPerDay: 3, cap: 20, skill: (_a, subj) => (subj === "Maths" ? 0.85 : 0.3) },
  callum: { startAgo: 58, study: (ago) => (ago > 12 ? 0.7 : 0.04), newPerDay: 3, cap: 14, skill: (ago) => (ago > 25 ? 0.65 : 0.4) },
};
function qualityFor(skill: number, r: number): SrsQuality {
  const s = Math.min(0.97, Math.max(0.05, skill));
  const again = 0.5 * (1 - s) * 0.9;
  const hard = 0.12 + 0.2 * (1 - s);
  const easy = 0.35 * s * s;
  if (r < again) return 1;
  if (r < again + hard) return 3;
  if (r > 1 - easy) return 5;
  return 4;
}
interface ReviewDoc { tenantId: string; franchiseId: null; childId: string; cardId: string; topicId: string; parentUid: string; easeFactor: number; intervalDays: number; repetitions: number; nextDueAt: string; lastQuality: number; lastReviewedAt: string; createdAt: string; updatedAt: string }
function simulateReviews(who: Resolved, cards: { id: string; topicId: string; subject: string }[], minEase: number): ReviewDoc[] {
  const h = HABITS[who.st.key];
  if (!h) return [];
  const r = rngFor(`fc:${who.st.key}`);
  const state = new Map<string, { s: SrsState; next: string; q: SrsQuality; last: string; first: string }>();
  let introduced = 0;
  for (let ago = h.startAgo; ago >= 1; ago--) {
    if (r() > h.study(ago)) continue;
    const T0 = Date.parse(at(ago, 17, 0)) + Math.floor(r() * 90) * 60_000;
    let k = 0;
    const stamp = () => new Date(T0 + (k++) * 23_000 + Math.floor(r() * 9000));
    // Due cards first (most overdue first), then new ones — like the real queue.
    const due = cards.filter((c) => state.has(c.id) && state.get(c.id)!.next <= new Date(T0).toISOString()).sort((a, b) => state.get(a.id)!.next.localeCompare(state.get(b.id)!.next));
    for (const c of due) {
      const e = state.get(c.id)!;
      const now = stamp();
      const res = sm2(e.s, qualityFor(h.skill(ago, c.subject), r()), minEase, now);
      state.set(c.id, { s: { easeFactor: res.easeFactor, intervalDays: res.intervalDays, repetitions: res.repetitions }, next: res.nextDueAt, q: res.lastQuality, last: res.lastReviewedAt, first: e.first });
    }
    const fresh = cards.filter((c) => !state.has(c.id)).slice(0, Math.max(0, Math.min(h.newPerDay, h.cap - introduced)));
    for (const c of fresh) {
      const now = stamp();
      const res = sm2(null, qualityFor(h.skill(ago, c.subject), r()), minEase, now);
      state.set(c.id, { s: { easeFactor: res.easeFactor, intervalDays: res.intervalDays, repetitions: res.repetitions }, next: res.nextDueAt, q: res.lastQuality, last: res.lastReviewedAt, first: res.lastReviewedAt });
      introduced++;
    }
  }
  const byId = new Map(cards.map((c) => [c.id, c]));
  return [...state].map(([cardId, e]) => ({
    tenantId: TID, franchiseId: null, childId: who.childId, cardId, topicId: byId.get(cardId)!.topicId, parentUid: who.parentUid,
    easeFactor: e.s.easeFactor, intervalDays: e.s.intervalDays, repetitions: e.s.repetitions, nextDueAt: e.next, lastQuality: e.q, lastReviewedAt: e.last,
    createdAt: e.first, updatedAt: e.last,
  }));
}

// ── content bootstrap + loading ──────────────────────────────────────────────
async function contentPresent(): Promise<boolean> {
  const need = ["topic-maths-algebra", "topic-english-grammar", "topic-science-forces", "diag-maths", "quiz-algebra", "quiz-cells", "q-lin1", "q-cell3", "q-gram1", "card-cell-nucleus", "note-cells", "note-inference", "note-linear", "note-quadratics", "note-fractions"];
  const snaps = await db.getAll(...need.map((k) => {
    const col = k.startsWith("topic-") ? "hubTopics" : k.startsWith("note-") ? "hubNotes" : k.startsWith("q-") ? "hubQuestions" : k.startsWith("card-") ? "hubFlashcards" : "hubAssessments";
    return db.collection(col).doc(baseId(k));
  }));
  return snaps.every((s) => s.exists && s.get("tenantId") === TID);
}
function runContentSeed() {
  console.log("Content missing — running seedLearningHubDemo.ts as a subprocess (single content source)…");
  execFileSync("npx", ["tsx", "src/seedLearningHubDemo.ts", TID], { cwd: SERVER_DIR, stdio: "inherit" });
}

// ── wipe (only what this file owns) ──────────────────────────────────────────
const OWN_COLS = ["hubQuestions", "hubAssessments", "hubFlashcards", "hubHomework", "hubSubmissions", "hubLessons", "hubAttempts"] as const;
/** Enrolments this file created: they carry our marker (a `demo: true` alone is NOT enough — another
 *  seed/agent may have enrolled other demo children), or belong to one of our generated fake children. */
const SEED_MARK = "hub-students-v1";
const isMineEnrolment = (d: FirebaseFirestore.QueryDocumentSnapshot) => d.get("demoSeed") === SEED_MARK || String(d.get("childId") ?? "").startsWith(`${PREFIX}child-`);
async function demoChildIds(): Promise<Set<string>> {
  const snap = await db.collection("hubEnrolments").where("tenantId", "==", TID).get();
  return new Set(snap.docs.filter(isMineEnrolment).map((d) => d.get("childId") as string));
}
async function delAll(refs: FirebaseFirestore.DocumentReference[]) {
  for (let i = 0; i < refs.length; i += 400) { const b = db.batch(); for (const r of refs.slice(i, i + 400)) b.delete(r); await b.commit(); }
}
async function wipe(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const kids = await demoChildIds();
  for (const col of OWN_COLS) {
    const snap = await db.collection(col).where("tenantId", "==", TID).get();
    const mine = snap.docs.filter((d) => d.id.startsWith(P));
    await delAll(mine.map((d) => d.ref));
    out[col] = mine.length;
  }
  for (const col of ["hubMastery", "hubFlashcardReviews"]) {
    const snap = await db.collection(col).where("tenantId", "==", TID).get();
    const mine = snap.docs.filter((d) => kids.has(d.get("childId") as string));
    await delAll(mine.map((d) => d.ref));
    out[col] = mine.length;
  }
  const enr = await db.collection("hubEnrolments").where("tenantId", "==", TID).get();
  const mineE = enr.docs.filter(isMineEnrolment);
  await delAll(mineE.map((d) => d.ref));
  out.hubEnrolments = mineE.length;
  // Fake children only (never a real one): ids we generate, and only if marked demo.
  const fakeRefs = STUDENTS.filter((s) => !s.realName).map((s) => db.collection("children").doc(fakeChildId(s)));
  const fs = (fakeRefs.length ? await db.getAll(...fakeRefs) : []).filter((s) => s.exists && s.get("demo") === true);
  await delAll(fs.map((s) => s.ref));
  out.children = fs.length;
  return out;
}

// ── resolve who is who ───────────────────────────────────────────────────────
function ageOf(dob: string): number {
  const d = new Date(dob);
  const now = new Date(NOW);
  let a = now.getUTCFullYear() - d.getUTCFullYear();
  if (now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) a--;
  return a;
}
async function resolveStudents(): Promise<{ who: Resolved[]; skipped: string[] }> {
  const who: Resolved[] = [];
  const skipped: string[] = [];
  const realEmail = REAL_PARENT_EMAIL_FALLBACK;
  // Only the two real children's NAMES are read (field-masked), and only when --with-real-children is given.
  const realKids = WITH_REAL ? (await db.collection("children").where("parentUid", "==", REAL_PARENT_UID).select("name").get()).docs : [];
  for (const st of STUDENTS) {
    if (st.realName && !WITH_REAL) continue;
    if (st.realName) {
      const hit = realKids.find((d) => ((d.get("name") as string) ?? "").trim().toLowerCase() === st.realName!.toLowerCase());
      if (!hit) { skipped.push(`${st.realName}: no child with that name under ${REAL_PARENT_UID}`); continue; }
      const prev = await db.collection("hubEnrolments").doc(`${TID}__${hit.id}`).get();
      if (prev.exists && prev.get("demo") !== true) { skipped.push(`${st.realName}: already has a real (non-demo) Learning Hub enrolment here — left alone`); continue; }
      who.push({ st, childId: hit.id, childName: (hit.get("name") as string).trim(), parentUid: REAL_PARENT_UID, parentEmail: realEmail });
    } else {
      who.push({ st, childId: fakeChildId(st), childName: `${st.first} ${st.last}`, parentUid: `hubdemo-parent-${st.n}`, parentEmail: `demo.parent${st.n}@example.invalid` });
    }
  }
  return { who, skipped };
}

// ── seed ─────────────────────────────────────────────────────────────────────
type Write = { col: string; id: string; data: Record<string, unknown> };
async function seed() {
  const { name, ownerUid, ownerName } = await guard();

  if (!DRY) console.log(`Cleaning previous demo-student docs in ${TID}: ${JSON.stringify(await wipe())}`);
  if (!(await contentPresent())) {
    if (DRY) { console.log(`DRY RUN: tenant ${TID} has no seedLearningHubDemo.ts content yet — it would be seeded first (skipping the rest of the dry run, nothing to compute against).`); return; }
    runContentSeed();
    if (!(await contentPresent())) { console.error("Content seed ran but the content is still incomplete — stopping."); process.exit(1); }
  }

  const nowIso = new Date(NOW).toISOString();
  const base = { tenantId: TID, franchiseId: null, createdBy: ownerUid || "seed", createdAt: nowIso };
  const writes: Write[] = [];
  const put = (col: string, docId: string, data: Record<string, unknown>) => writes.push({ col, id: docId, data });

  // Load base content, then layer this file's extras on top (in memory, so --dry works).
  const topicSnap = await db.collection("hubTopics").where("tenantId", "==", TID).get();
  const topics = new Map(topicSnap.docs.map((d) => [d.id, { subject: d.get("subject") as string, topic: d.get("topic") as string }]));
  const qs = new Map<string, QDoc>();
  for (const d of (await db.collection("hubQuestions").where("tenantId", "==", TID).get()).docs) {
    if (!d.id.startsWith(PREFIX) || d.id.startsWith(P)) continue;
    const x = d.data();
    qs.set(d.id, { id: d.id, key: keyOfQ(d.id), topicId: x.topicId, kind: x.kind, prompt: x.prompt, options: x.options ?? [], answer: x.answer ?? null, acceptedAnswers: x.acceptedAnswers ?? [], tolerance: x.tolerance ?? 0, marks: x.marks ?? 1, explanation: x.explanation ?? "" });
  }
  for (const q of EXTRA_Q) {
    const docId = id(`q-${q.key}`);
    const topicId = baseId(`topic-${q.topic}`);
    if (!topics.has(topicId)) throw new Error(`Topic ${topicId} missing`);
    qs.set(docId, { id: docId, key: q.key, topicId, kind: q.kind, prompt: q.prompt, options: q.options ?? [], answer: q.answer, acceptedAnswers: q.accepted ?? [], tolerance: q.tolerance ?? 0, marks: q.marks ?? 1, explanation: q.explanation });
    put("hubQuestions", docId, { ...base, topicId, kind: q.kind, prompt: q.prompt, options: q.options ?? [], answer: q.answer, acceptedAnswers: q.accepted ?? [], tolerance: q.tolerance ?? 0, marks: q.marks ?? 1, explanation: q.explanation, published: true, updatedAt: nowIso });
  }
  const qByKey = (k: string) => [...qs.values()].find((q) => q.key === k)?.id;
  const asms = new Map<string, ADoc>();
  for (const d of (await db.collection("hubAssessments").where("tenantId", "==", TID).get()).docs) {
    if (!d.id.startsWith(PREFIX) || d.id.startsWith(P)) continue;
    const x = d.data();
    asms.set(d.id, { id: d.id, key: d.id.replace(PREFIX, ""), type: x.type, title: x.title, subject: x.subject, topicIds: x.topicIds, questionIds: x.questionIds, timeLimitMins: x.timeLimitMins ?? null, passMarkPct: x.passMarkPct });
  }
  const allAsm = await db.collection("hubAssessments").where("tenantId", "==", TID).get();
  const rivalDiag = (subject: string) => allAsm.docs.some((d) => !d.id.startsWith(P) && d.get("type") === "diagnostic" && d.get("published") !== false && String(d.get("subject")).toLowerCase() === subject.toLowerCase() && d.get("franchiseId") == null);
  for (const a of EXTRA_A) {
    const docId = id(a.key);
    const questionIds = a.questionKeys.map((k) => qByKey(k) ?? (() => { throw new Error(`No question ${k}`); })());
    // At most one PUBLISHED diagnostic per subject — never displace one the tenant already has.
    const published = a.type === "quiz" || !rivalDiag(a.subject);
    const topicIds = a.topics.map((t) => baseId(`topic-${t}`));
    asms.set(docId, { id: docId, key: `s-${a.key}`, type: a.type, title: a.title, subject: a.subject, topicIds, questionIds, timeLimitMins: a.timeLimitMins, passMarkPct: a.passMarkPct });
    put("hubAssessments", docId, { ...base, type: a.type, title: a.title, subject: a.subject, topicIds, questionIds, timeLimitMins: a.timeLimitMins, passMarkPct: a.passMarkPct, published, updatedAt: nowIso });
  }
  const cards: { id: string; topicId: string; subject: string; createdAt: string }[] = [];
  for (const d of (await db.collection("hubFlashcards").where("tenantId", "==", TID).get()).docs) {
    if (!d.id.startsWith(PREFIX) || d.id.startsWith(P)) continue;
    const t = topics.get(d.get("topicId") as string);
    if (t && d.get("published") !== false) cards.push({ id: d.id, topicId: d.get("topicId"), subject: t.subject, createdAt: d.get("createdAt") as string });
  }
  for (const [k, topic, front, back] of EXTRA_CARDS) {
    const docId = id(`card-${k}`);
    const topicId = baseId(`topic-${topic}`);
    put("hubFlashcards", docId, { ...base, topicId, front, back, published: true, createdByName: ownerName, updatedAt: nowIso });
    cards.push({ id: docId, topicId, subject: topics.get(topicId)!.subject, createdAt: nowIso });
  }
  cards.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

  const cfg = await hubConfig(TID, null);
  const { who, skipped } = await resolveStudents();
  const byKey = new Map(who.map((w) => [w.st.key, w]));
  const hwId = (k: string) => id(`hw-${k}`);

  // Children + enrolments
  for (const w of who) {
    const st = w.st;
    if (!st.realName) {
      put("children", w.childId, {
        tenantId: TID, name: w.childName, first: st.first, last: st.last, dob: st.dob, age: ageOf(st.dob), school: st.school,
        parentUid: w.parentUid, photoConsent: false, demo: true, createdAt: at(st.enrolledAgo, 9, 0),
      });
    }
    put("hubEnrolments", `${TID}__${w.childId}`, {
      tenantId: TID, franchiseId: null, childId: w.childId, childName: w.childName, parentUid: w.parentUid, parentEmail: w.parentEmail,
      subjects: st.subjects, tutorUid: ownerUid || null, tutorName: ownerName, active: true, demo: true, demoSeed: SEED_MARK,
      createdBy: ownerUid || "seed", createdAt: at(st.enrolledAgo, 10, 0), updatedAt: at(st.enrolledAgo, 10, 0),
    });
  }

  // Attempts
  const attempts: BuiltAttempt[] = [];
  const counter = new Map<string, number>();
  for (const spec of ATT) {
    const w = byKey.get(spec.s);
    if (!w) continue;
    const asm = asms.get(baseId(ASM[spec.a]));
    if (!asm) throw new Error(`Assessment ${ASM[spec.a]} missing`);
    const n = (counter.get(spec.s) ?? 0) + 1;
    counter.set(spec.s, n);
    const b = buildAttempt(n, spec, w, asm, qs, cfg, ownerUid, spec.hw ? hwId(spec.hw) : null);
    attempts.push(b);
    put("hubAttempts", b.docId, b.data);
  }

  // Homework + submissions
  const attemptFor = (student: string, hw: string) => attempts.find((a) => a.spec.s === student && a.spec.hw === hw);
  const subCounts: Record<string, number> = { assigned: 0, submitted: 0, marked: 0 };
  for (const h of HW) {
    const kids = Object.keys(h.subs).filter((k) => byKey.has(k));
    if (!kids.length) continue;
    const asm = h.assessment ? baseId(ASM[h.assessment]) : null;
    if (asm && !asms.has(asm)) throw new Error(`HW assessment ${asm} missing`);
    const noteIds = h.notes.map((n) => baseId(n));
    put("hubHomework", hwId(h.key), {
      ...base, createdAt: at(h.assignedAgo, 9, 30), title: h.title, instructions: h.instructions, assessmentId: asm, noteIds,
      flashcardTopicId: h.fcTopic ? baseId(`topic-${h.fcTopic}`) : null, dueAt: at(h.dueAgo, 18, 0), assignedChildIds: kids.map((k) => byKey.get(k)!.childId),
      createdByName: ownerName, updatedAt: at(h.assignedAgo, 9, 30),
    });
    for (const k of kids) {
      const w = byKey.get(k)!;
      const s = h.subs[k];
      const att = attemptFor(k, h.key);
      let submittedAt: string | null = null;
      let text = "";
      let mark: Record<string, unknown> | null = null;
      if (s.st !== "assigned") {
        submittedAt = att ? new Date(Date.parse(att.data.submittedAt as string) + 4 * 60_000).toISOString() : at(s.ago ?? h.dueAgo + 1, s.t?.[0] ?? 17, s.t?.[1] ?? 30);
        text = s.text ?? (att ? "Done online — the written question was the hardest part." : "");
      }
      if (s.st === "marked") {
        mark = { score: s.score, max: s.max, feedback: s.feedback, markedBy: ownerUid || "seed", markedByName: ownerName, markedAt: clampPast(MIDNIGHT - s.markedAgo * DAY + 11 * 3_600_000) };
      }
      if (s.st !== "assigned" && !att && !text) throw new Error(`Submission ${h.key}/${k} has neither text nor an attempt`);
      subCounts[s.st]++;
      put("hubSubmissions", `${hwId(h.key)}__${w.childId}`, {
        tenantId: TID, franchiseId: null, homeworkId: hwId(h.key), childId: w.childId, parentUid: w.parentUid, status: s.st, text, attachments: [],
        attemptId: att ? att.docId : null, submittedAt, mark, createdBy: ownerUid || "seed", createdAt: at(h.assignedAgo, 9, 30),
        updatedAt: (mark?.markedAt as string | undefined) ?? submittedAt ?? at(h.assignedAgo, 9, 30),
      });
    }
  }

  // Flashcard reviews (real SM-2)
  const reviewsBy = new Map<string, ReviewDoc[]>();
  for (const w of who) {
    const subj = w.st.subjects.map((s) => s.toLowerCase());
    const mine = cards.filter((c) => !subj.length || subj.includes(c.subject.toLowerCase()));
    const rows = simulateReviews(w, mine, cfg.srsMinEase);
    reviewsBy.set(w.childId, rows);
    for (const rv of rows) put("hubFlashcardReviews", `${TID}__${w.childId}__${rv.cardId}`, { ...rv });
  }

  // Live lessons
  const LESSONS: { key: string; title: string; topic: string; startsAt: string; mins: number; kids: string[]; status: "scheduled" | "ended"; notes: string; attended: string[]; live?: boolean }[] = [
    { key: "soon", title: "Maths: fractions & problem solving", topic: "maths-fractions", startsAt: new Date(NOW + 5 * 60_000).toISOString(), mins: 45, kids: ["priya", "callum", "hannah", "yamal"], status: "scheduled", notes: "Bring your fractions flashcards — we'll start with a quick-fire round.", attended: [], live: true },
    { key: "next", title: "English: writing PEE paragraphs", topic: "english-comprehension", startsAt: at(-2, 16, 30), mins: 60, kids: ["olivia", "jamie", "priya", "hannah"], status: "scheduled", notes: "Have your homework paragraph to hand.", attended: [] },
    { key: "past-algebra", title: "Algebra: factorising quadratics", topic: "maths-algebra-quadratics", startsAt: at(4, 16, 0), mins: 60, kids: ["olivia", "jamie", "callum", "hannah", "yamal"], status: "ended", notes: "Worked through 6 factorising questions together.", attended: ["olivia", "jamie", "hannah", "yamal"] },
    { key: "past-cells", title: "Science: cells recap", topic: "science-cells", startsAt: at(11, 17, 0), mins: 45, kids: ["priya", "callum", "tommy", "yamal", "hannah"], status: "ended", notes: "Recapped organelles; set the plant-cell homework.", attended: ["priya", "callum", "yamal", "hannah"] },
  ];
  let roomNote = "";
  for (const l of LESSONS) {
    const childIds = l.kids.filter((k) => byKey.has(k)).map((k) => byKey.get(k)!.childId);
    if (!childIds.length) continue;
    const lessonId = id(`lesson-${l.key}`);
    const start = Date.parse(l.startsAt);
    let roomUrl: string | null = null;
    if (l.live && !DRY && videoConfigured()) {
      try { roomUrl = (await ensureRoom(lessonId, joinWindow(l.startsAt, l.mins).closesAt)).url; roomNote = `Daily room created (${roomNameFor(lessonId)}).`; }
      catch (e) { roomNote = `Could not pre-create the Daily room (${(e as Error).message}) — Join will create it on demand.`; }
    } else if (l.live) roomNote = DRY ? "Daily room would be created on seed." : "DAILY_API_KEY not set — roomUrl left empty; Join creates the room on demand (or reports video unavailable).";
    const attendance: Record<string, string> = {};
    for (const k of l.attended) if (byKey.has(k)) attendance[byKey.get(k)!.childId] = new Date(start + (Math.floor(rngFor(`att:${l.key}:${k}`)() * 5) - 2) * 60_000).toISOString();
    put("hubLessons", lessonId, {
      ...base, createdAt: clampPast(start - 5 * DAY), tutorUid: ownerUid, tutorName: ownerName, title: l.title, topicId: baseId(`topic-${l.topic}`), startsAt: l.startsAt, durationMins: l.mins,
      childIds, status: l.status, roomName: roomNameFor(lessonId), roomUrl, notes: l.notes, attendance,
      tutorJoinedAt: l.status === "ended" ? new Date(start - 6 * 60_000).toISOString() : null, endedAt: l.status === "ended" ? new Date(start + (l.mins + 2) * 60_000).toISOString() : null,
      updatedAt: l.status === "ended" ? new Date(start + (l.mins + 2) * 60_000).toISOString() : nowIso,
    });
  }

  // ── write ──
  if (!DRY) {
    for (let i = 0; i < writes.length; i += 300) {
      const b = db.batch();
      for (const w of writes.slice(i, i + 300)) b.set(db.collection(w.col).doc(w.id), w.data);
      await b.commit();
    }
    for (const w of who) await recomputeChildMastery(TID, w.childId, null); // the real derived-copy rebuild
  }

  // ── report ──
  const by = (c: string) => writes.filter((w) => w.col === c).length;
  console.log(`\n${DRY ? "DRY RUN — nothing written. Would seed" : "Seeded"} ${who.length} demo students into "${name}" (${TID}):`);
  console.log(`  ${by("children")} fake children · ${by("hubEnrolments")} enrolments · ${by("hubAttempts")} attempts · ${by("hubHomework")} homework / ${by("hubSubmissions")} submissions · ${by("hubFlashcardReviews")} flashcard reviews · ${by("hubLessons")} lessons`);
  console.log(`  extra content: ${by("hubQuestions")} questions · ${by("hubAssessments")} assessments · ${by("hubFlashcards")} flashcards`);
  console.log(`  submissions by state: ${JSON.stringify(subCounts)}`);
  for (const s of skipped) console.log(`  SKIPPED: ${s}`);
  if (roomNote) console.log(`  ${roomNote}`);
  console.log("\n  student            attempts  pending  mastery by subject (baseline → growth)                 cards due/upcoming/new");
  for (const w of who) {
    const mine = attempts.filter((a) => a.spec.s === w.st.key);
    const rows = computeTopicMastery(mine.map((a) => a.lite));
    const subj = new Map<string, TopicMastery[]>();
    for (const r of rows.values()) subj.set(r.subject, [...(subj.get(r.subject) ?? []), r]);
    const txt = [...subj].sort().map(([s, rs]) => {
      const roll = rollupSubject(s, rs, 0);
      return `${s} ${roll.masteryPct ?? "–"}%${roll.baselinePct !== null ? ` (${roll.baselinePct}→${roll.growthPct !== null ? (roll.growthPct >= 0 ? "+" : "") + roll.growthPct : "?"})` : ""}`;
    }).join(" · ");
    const sub = w.st.subjects.map((x) => x.toLowerCase());
    const avail = cards.filter((c) => !sub.length || sub.includes(c.subject.toLowerCase()));
    const q = buildQueue(avail, new Map((reviewsBy.get(w.childId) ?? []).map((r) => [r.cardId, { cardId: r.cardId, nextDueAt: r.nextDueAt }])), new Date(NOW));
    console.log(`  ${w.childName.padEnd(18)} ${String(mine.length).padStart(5)}  ${String(mine.filter((a) => a.status === "pending_marking").length).padStart(6)}    ${txt.padEnd(58)} ${q.due.length}/${q.upcoming}/${q.fresh.length}`);
  }
  console.log(`\n  Remove it all with:  npx tsx src/seedLearningHubStudents.ts clean ${TID}`);
}

// ── check: read back, re-derive with the pure functions, call the real read-paths ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
async function callRoute(router: Any, urlPath: string, query: Record<string, string>, who: { tenantId: string; uid: string; name: string }): Promise<{ code: number; body: Any }> {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams(query).toString();
    const req: Any = { method: "GET", url: qs ? `${urlPath}?${qs}` : urlPath, originalUrl: urlPath, baseUrl: "", query, params: {}, headers: {}, body: {}, auth: { role: "freelancer", tenantId: who.tenantId, franchiseId: null }, user: { uid: who.uid, name: who.name }, protocol: "http", get: () => "localhost:4000" };
    const res: Any = { code: 200, status(c: number) { this.code = c; return this; }, json(b: unknown) { resolve({ code: this.code, body: b }); return this; }, setHeader() { return this; }, getHeader() { return undefined; } };
    router(req, res, (e?: unknown) => reject(e ?? new Error(`no route for ${urlPath}`)));
  });
}
async function check() {
  const { ownerUid, ownerName } = await guard();
  const fails: string[] = [];
  const ok = (cond: boolean, msg: string) => { if (!cond) { fails.push(msg); console.error("  FAIL:", msg); } };
  const cfg = await hubConfig(TID, null);
  const kids = [...(await demoChildIds())];
  console.log(`Demo students enrolled: ${kids.length}`);
  ok(kids.length >= 6, `expected ≥6 demo enrolments, found ${kids.length}`);

  // every doc has tenantId; counts
  const counts: Record<string, number> = {};
  for (const col of [...OWN_COLS, "hubMastery", "hubFlashcardReviews", "hubEnrolments"]) {
    const snap = await db.collection(col).where("tenantId", "==", TID).get();
    const mine = snap.docs.filter((d) => (col === "hubMastery" || col === "hubFlashcardReviews" ? kids.includes(d.get("childId")) : col === "hubEnrolments" ? isMineEnrolment(d) : d.id.startsWith(P)));
    counts[col] = mine.length;
    for (const d of mine) ok(d.get("tenantId") === TID, `${col}/${d.id} tenantId=${d.get("tenantId")}`);
  }
  const topicN = (await db.collection("hubTopics").where("tenantId", "==", TID).get()).docs.filter((d) => d.id.startsWith(PREFIX)).length;
  counts.hubTopics = topicN;
  console.log("Counts:", JSON.stringify(counts));

  const topicDocs = new Map((await db.collection("hubTopics").where("tenantId", "==", TID).get()).docs.map((d) => [d.id, d.data()]));
  for (const childId of kids) {
    const enrol = (await db.collection("hubEnrolments").doc(`${TID}__${childId}`).get()).data() as Any;
    const label = `${enrol.childName}`;
    const aSnap = await db.collection("hubAttempts").where("tenantId", "==", TID).where("childId", "==", childId).get();
    const attempts = aSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Any) }));
    // 1. each attempt's stored scoring == a re-run of the real pure functions
    for (const a of attempts) {
      const re = a.answers.map((x: Any) => {
        const q = a.questions.find((z: Any) => z.id === x.questionId);
        if (q.mark === "manual") return { topicId: x.topicId, correct: x.correct, marksAwarded: x.marksAwarded, marksMax: x.marksMax, pending: x.pending };
        const o = markResponse({ mark: q.mark, answer: q.answer, acceptedAnswers: q.acceptedAnswers, tolerance: q.tolerance, marks: q.marks }, x.response);
        ok(o.correct === x.correct && o.marksAwarded === x.marksAwarded, `${label} ${a.id}: auto-mark mismatch on ${x.questionId}`);
        return { topicId: x.topicId, correct: o.correct, marksAwarded: o.marksAwarded, marksMax: x.marksMax, pending: o.pending };
      });
      const sc = scoreAttempt(re as ScoredAnswer[], a.passMarkPct);
      ok(sc.pct === a.pct && sc.status === a.status && sc.scoreMarks === a.scoreMarks && sc.maxMarks === a.maxMarks && JSON.stringify(sc.byTopic) === JSON.stringify(a.byTopic), `${label} ${a.id}: stored score != recomputed (${a.pct}/${sc.pct}, ${a.status}/${sc.status})`);
      ok(a.tenantId === TID && a.childId === childId && a.parentUid === enrol.parentUid, `${label} ${a.id}: tenant/child/parent mismatch`);
    }
    // 2. stored hubMastery == recompute (pure) == what GET /mastery returns
    const lite: AttemptLite[] = attempts.map((a) => ({ id: a.id, assessmentType: a.assessmentType, status: a.status, subject: a.subject, submittedAt: a.submittedAt, byTopic: a.byTopic, baselineReset: a.baselineReset }));
    const fresh = computeTopicMastery(lite);
    const stored = (await db.collection("hubMastery").where("tenantId", "==", TID).where("childId", "==", childId).get()).docs.map((d) => d.data() as Any);
    ok(stored.length === fresh.size, `${label}: ${stored.length} stored mastery rows vs ${fresh.size} computed`);
    for (const s of stored) {
      const f = fresh.get(s.topicId);
      ok(!!f && f.masteryPct === s.masteryPct && f.attempts === s.attempts && f.baselinePct === s.baselinePct && f.lastAttemptAt === s.lastAttemptAt && bandFor(f.masteryPct, cfg.masteryBands) === s.band,
        `${label}: stored mastery for ${s.topicId} differs from recompute (${JSON.stringify(s)} vs ${JSON.stringify(f)})`);
    }
    const api = await callRoute(hubMasteryApi, "/mastery", { childId }, { tenantId: TID, uid: ownerUid, name: ownerName });
    ok(api.code === 200, `${label}: GET /mastery -> ${api.code} ${JSON.stringify(api.body).slice(0, 200)}`);
    if (api.code === 200) {
      const seen = new Map<string, Any>();
      for (const sj of api.body.subjects) for (const t of sj.topics) seen.set(t.topicId, t);
      ok(seen.size === fresh.size, `${label}: GET /mastery has ${seen.size} topic rows vs ${fresh.size}`);
      for (const [tid, f] of fresh) {
        const t = seen.get(tid);
        ok(!!t && t.masteryPct === f.masteryPct && t.attempts === f.attempts && t.baselinePct === f.baselinePct, `${label}: GET /mastery ${tid} ${JSON.stringify(t)} vs ${JSON.stringify(f)}`);
        ok(!!topicDocs.get(tid), `${label}: mastery references missing topic ${tid}`);
      }
      const trend = trendOf(lite.map((a, i) => ({ ...a, pct: attempts[i].pct }))).map((a) => a.submittedAt);
      ok(JSON.stringify(api.body.trend.map((t: Any) => t.at)) === JSON.stringify(trend), `${label}: GET /mastery trend differs`);
    }
  }

  // 3. flashcard reviews: nextDueAt == lastReviewedAt + interval, SM-2 ease bounds
  for (const d of (await db.collection("hubFlashcardReviews").where("tenantId", "==", TID).get()).docs) {
    if (!kids.includes(d.get("childId"))) continue;
    const exp = Date.parse(d.get("lastReviewedAt")) + d.get("intervalDays") * DAY;
    ok(Math.abs(Date.parse(d.get("nextDueAt")) - exp) < 1000, `review ${d.id}: nextDueAt != lastReviewedAt + interval`);
    ok(d.get("easeFactor") >= cfg.srsMinEase && Date.parse(d.get("lastReviewedAt")) <= NOW + 60_000, `review ${d.id}: ease/time out of range`);
  }

  // 4. real read paths run cleanly over the data
  const asOwner = { tenantId: TID, uid: ownerUid, name: ownerName };
  const ov = await callRoute(hubMasteryApi, "/mastery/overview", {}, asOwner);
  ok(ov.code === 200 && kids.every((k) => ov.body.students.some((s: Any) => s.childId === k)), `GET /mastery/overview: ${ov.code}`);
  const inbox = await callRoute(hubHomeworkApi, "/homework/inbox", {}, asOwner);
  ok(inbox.code === 200, `GET /homework/inbox: ${inbox.code}`);
  const stats = await callRoute(hubFlashcardsApi, "/flashcards/stats", {}, asOwner);
  ok(stats.code === 200, `GET /flashcards/stats: ${stats.code}`);
  const lessons = await callRoute(hubLessonsApi, "/lessons", {}, asOwner);
  ok(lessons.code === 200, `GET /lessons: ${lessons.code}`);
  const attList = await callRoute(hubAttemptsApi, "/attempts", {}, asOwner);
  ok(attList.code === 200, `GET /attempts: ${attList.code}`);
  console.log("Homework inbox by status:", JSON.stringify((inbox.body as Any[]).filter((r) => kids.includes(r.childId)).reduce((m: Record<string, number>, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {})));
  console.log("Pending-marking attempts (tutor queue):", (attList.body as Any[]).filter((r) => kids.includes(r.childId) && r.status === "pending_marking").length);
  console.log("Flashcard stats (demo students):", JSON.stringify((stats.body.students as Any[]).filter((s) => kids.includes(s.childId)).map((s) => `${s.childName}: due ${s.due} / reviewed ${s.reviewed} / new ${s.new}`)));
  console.log("Lessons:", JSON.stringify((lessons.body as Any[]).filter((l) => l.id.startsWith(P)).map((l) => `${l.title} [${l.status}] ${l.startsAt} joinable=${l.joinable}`)));

  console.log(fails.length ? `\nCHECK FAILED (${fails.length})` : "\nCHECK PASSED — stored data matches the pure functions and the real read-paths.");
  process.exit(fails.length ? 1 : 0);
}

(async () => {
  if (MODE === "clean") {
    await guard();
    const out = await wipe();
    // Best-effort: drop the live-lesson room we may have created.
    await deleteRoom(roomNameFor(id("lesson-soon")));
    console.log(`Removed from tenant ${TID}: ${JSON.stringify(out)}`);
  } else if (MODE === "check") {
    await check();
  } else {
    await seed();
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
