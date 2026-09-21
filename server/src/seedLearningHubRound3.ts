// Round-3 Learning Hub demo layer, on top of seedLearningHubDemo.ts + seedLearningHubStudents.ts:
//   · REAL PICTURES on questions (drawn PNGs, stored as private kind:"hub" `images` docs), incl. a question
//     whose ANSWERS are pictures
//   · year-group / age-targeted placement tests (diagnostics) + picture quizzes (`audience`)
//   · student groups (`hubGroups`)
//   · real YouTube videos on notes (`videos`)
//   · retake settings (tenant `settings.hub.retakePolicy`, and a per-quiz override)
//   · `yearGroup` on the demo enrolments (UK rule from the child's dob)
//
//   npx tsx src/seedLearningHubRound3.ts <tenantId>          # seed (or refresh) — idempotent
//   npx tsx src/seedLearningHubRound3.ts clean <tenantId>    # remove exactly what this created
//   npx tsx src/seedLearningHubRound3.ts check <tenantId>    # read back + assert
//   npx tsx src/seedLearningHubRound3.ts <tenantId> --dry    # build everything, write nothing
//
// The PNGs come from scratch/hub-demo-images (run `node scratch/hub-demo-images/generate.mjs` from the repo
// root to regenerate them).
//
// SAFETY
//  · Tenant id REQUIRED; @activityos-test.com tenants are refused; only ever touches that tenant.
//  · Every doc it CREATES has an id starting `hubdemo-<tid>-r3-` (hubTopics / hubNotes / hubQuestions /
//    hubAssessments / hubGroups / images). `clean` deletes exactly those.
//  · It also sets fields on EXISTING docs (no other way to demo them): `videos` on four demo notes,
//    `yearGroup` on the tenant's demo enrolments (only where empty), and — only when the tenant hasn't set one —
//    `settings.hub.retakePolicy`/`retakeCooldownHours` on the library doc (field-path update, nothing else touched).
//    `clean` unsets `videos` and the `yearGroup`s it set; the library setting is left alone (it's a legitimate setting).
//  · Never edits a `children` doc, never goes through the API, sends no email and no notification.
//  · Note: seedLearningHubDemo.ts `clean` removes everything under `hubdemo-<tid>-` including these r3 content docs
//    (not the images / groups) — re-run this seed afterwards.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase";

const DRY = process.argv.includes("--dry");
process.argv = process.argv.filter((a) => a !== "--dry");
const arg1 = process.argv[2];
const MODE: "seed" | "clean" | "check" = arg1 === "clean" ? "clean" : arg1 === "check" ? "check" : "seed";
const TID = MODE === "seed" ? arg1 : process.argv[3];
if (!TID || TID.startsWith("-")) {
  console.error("Usage: npx tsx src/seedLearningHubRound3.ts <tenantId> [--dry]   |   ... clean <tenantId>   |   ... check <tenantId>");
  process.exit(1);
}
const PREFIX = `hubdemo-${TID}-`;
const P = `${PREFIX}r3-`;
const id = (s: string) => `${P}${s}`;
const base = (s: string) => `${PREFIX}${s}`; // docs owned by the other two seeds
const here = path.dirname(fileURLToPath(import.meta.url));
const IMG_DIR = path.resolve(here, "../../scratch/hub-demo-images");
const OWN_COLS = ["hubTopics", "hubNotes", "hubQuestions", "hubAssessments", "hubGroups"] as const;
/** Existing demo notes that get YouTube videos (added, not replaced). */
const VIDEO_NOTES: Record<string, { id: string; title: string; start: number }[]> = {
  "note-linear": [{ id: "jWpiMu5LNdg", title: "How to solve one-step equations (Khan Academy)", start: 0 }],
  "note-fractions": [
    { id: "bcCLKACsYJ0", title: "Adding fractions with unlike denominators (Khan Academy)", start: 0 },
    { id: "kZzoVCmUyKg", title: "Introduction to fractions (Khan Academy)", start: 0 },
  ],
  "note-quadratics": [{ id: "eF6zYNzlZKQ", title: "Factoring quadratics with a leading coefficient of 1 (Khan Academy)", start: 0 }],
  "note-cells": [
    { id: "8IlzKri08kk", title: "Introduction to Cells: The Grand Cell Tour (Amoeba Sisters)", start: 0 },
    { id: "isuU2YDU6Ow", title: "What's the difference between animal and plant cells? (BBC Bitesize)", start: 0 },
  ],
};

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

async function delAll(refs: FirebaseFirestore.DocumentReference[]) {
  for (let i = 0; i < refs.length; i += 400) { const b = db.batch(); for (const r of refs.slice(i, i + 400)) b.delete(r); await b.commit(); }
}
const ownImageRefs = async () => (await db.collection("images").where("tenantId", "==", TID).select("kind").get()).docs.filter((d) => d.id.startsWith(P)).map((d) => d.ref);

async function wipe(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const col of OWN_COLS) {
    const snap = await db.collection(col).where("tenantId", "==", TID).select().get();
    const mine = snap.docs.filter((d) => d.id.startsWith(P));
    await delAll(mine.map((d) => d.ref));
    out[col] = mine.length;
  }
  const imgs = await ownImageRefs();
  await delAll(imgs);
  out.images = imgs.length;
  // Fields we set on existing docs.
  let v = 0;
  for (const key of Object.keys(VIDEO_NOTES)) {
    const ref = db.collection("hubNotes").doc(base(key));
    const s = await ref.get();
    if (s.exists && s.get("tenantId") === TID && s.get("videos") !== undefined) { await ref.update({ videos: FieldValue.delete() }); v++; }
  }
  out["notes.videos unset"] = v;
  let y = 0;
  const enr = await db.collection("hubEnrolments").where("tenantId", "==", TID).get();
  for (const d of enr.docs) if (d.get("demo") === true && d.get("yearGroup") !== undefined) { await d.ref.update({ yearGroup: FieldValue.delete() }); y++; }
  out["enrolments.yearGroup unset"] = y;
  return out;
}

// ── UK school year from a date of birth ──────────────────────────────────────
const DEFAULT_YEAR_GROUPS = ["Reception", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6", "Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12", "Year 13"];
/** Age on 31 August of the CURRENT school year (Sept–Aug); Reception = 4, Year 1 = 5 … */
function ukYearGroup(dob: string, labels: string[], today = new Date()): string | null {
  const d = new Date(dob);
  if (!dob || Number.isNaN(d.getTime())) return null;
  const y = today.getUTCMonth() >= 8 ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
  const ref = new Date(Date.UTC(y, 7, 31));
  let age = ref.getUTCFullYear() - d.getUTCFullYear();
  if (ref.getUTCMonth() < d.getUTCMonth() || (ref.getUTCMonth() === d.getUTCMonth() && ref.getUTCDate() < d.getUTCDate())) age--;
  const label = age >= 4 ? DEFAULT_YEAR_GROUPS[age - 4] : undefined;
  return label && labels.some((l) => l.toLowerCase() === label.toLowerCase()) ? label : null;
}

// ── content ──────────────────────────────────────────────────────────────────
type Manifest = Record<string, { alt: string; bytes: number }>;
const IMAGE_KEYS = ["pie", "pyth", "bar", "numline", "plantcell", "foodchain", "circuit", "clock", "compass", "protractor", "cuboid", "scene", "shape-a", "shape-b", "shape-c", "shape-d"] as const;
type ImgKey = (typeof IMAGE_KEYS)[number];

/** [key, subject, topic name] — created only when the tenant doesn't already have that (subject, topic, no subtopic). */
const NEW_TOPICS: [key: string, subject: string, topic: string][] = [
  ["stats", "Maths", "Statistics & data"],
  ["number", "Maths", "Number & place value"],
  ["measure", "Maths", "Measurement & time"],
  ["food", "Science", "Food chains"],
  ["electric", "Science", "Electricity"],
  ["maps", "Geography", "Map skills"],
];
/** Existing topics we file under (subject, topic). */
const EXISTING_TOPICS: Record<string, [subject: string, topic: string]> = {
  fractions: ["Maths", "Fractions & decimals"], geometry: ["Maths", "Geometry"],
  cells: ["Science", "Cells"], comprehension: ["English", "Reading comprehension"], grammar: ["English", "Grammar & punctuation"],
};

type QDef = { key: string; topic: string; kind: string; prompt: string; options?: string[]; optionImages?: ImgKey[]; image?: ImgKey; answer: unknown; accepted?: string[]; tolerance?: number; marks?: number; explanation: string };
const QUESTIONS: QDef[] = [
  // ── Maths
  { key: "pie-frac", topic: "fractions", kind: "single", image: "pie", prompt: "What fraction of the circle is shaded?", options: ["3/8", "3/5", "5/8", "8/3"], answer: "a", explanation: "The circle is cut into 8 equal slices and 3 are shaded, so 3/8 is shaded (5/8 is the part that is not)." },
  { key: "pie-dec", topic: "fractions", kind: "number", image: "pie", prompt: "Write the shaded fraction of the circle as a decimal.", answer: 0.375, tolerance: 0.001, explanation: "3/8 = 3 ÷ 8 = 0.375." },
  { key: "bar-most", topic: "stats", kind: "single", image: "bar", prompt: "Which fruit is the most popular in Class 5B?", options: ["Apple", "Banana", "Grapes", "Strawberry"], answer: "b", explanation: "Banana has the tallest bar (12 children)." },
  { key: "bar-diff", topic: "stats", kind: "number", image: "bar", prompt: "How many MORE children chose grapes than strawberries?", answer: 6, explanation: "Grapes 10, strawberries 4: 10 − 4 = 6." },
  { key: "clock", topic: "measure", kind: "single", image: "clock", prompt: "What time does the clock show?", options: ["3:45", "9:15", "3:09", "4:45"], answer: "a", explanation: "The minute hand points at 9 (45 minutes past) and the hour hand is nearly at 4, so it is 3:45 - a quarter to four." },
  { key: "numline", topic: "number", kind: "number", image: "numline", prompt: "Point P is marked on the number line. What number does it show?", answer: -3, explanation: "Each small mark is 1. P is halfway between −4 and −2, so it is −3." },
  { key: "angle", topic: "geometry", kind: "number", image: "protractor", tolerance: 1, prompt: "Read the protractor. What is the size of the angle between the red line and the baseline, in degrees?", answer: 65, explanation: "Start at 0 on the right-hand end of the baseline and follow the scale up: the red line crosses halfway between 60 and 70, so 65°." },
  { key: "cuboid", topic: "geometry", kind: "number", image: "cuboid", prompt: "Work out the volume of the cuboid in cm³.", answer: 72, explanation: "Volume = length × width × height = 6 × 4 × 3 = 72 cm³." },
  { key: "pyth", topic: "geometry", kind: "number", image: "pyth", prompt: "Use Pythagoras' theorem to find the length of the longest side, x, in cm.", answer: 10, explanation: "x² = 6² + 8² = 36 + 64 = 100, so x = √100 = 10 cm." },
  { key: "pyth-which", topic: "geometry", kind: "single", image: "pyth", prompt: "Which side of this triangle is the hypotenuse?", options: ["The 6 cm side", "The 8 cm side", "The side labelled x", "The side at the right angle"], answer: "c", explanation: "The hypotenuse is always the longest side, the one opposite the right angle: here, x." },
  { key: "symm", topic: "geometry", kind: "single", prompt: "Which of these shapes has a line of mirror symmetry?", options: ["Shape A", "Shape B", "Shape C", "Shape D"], optionImages: ["shape-a", "shape-b", "shape-c", "shape-d"], answer: "c", explanation: "The kite (C) folds exactly onto itself along a vertical line. A parallelogram, a scalene triangle and an S-shape have no mirror line." },
  // ── Science
  { key: "cell-nucleus", topic: "cells", kind: "single", image: "plantcell", prompt: "Which letter labels the nucleus?", options: ["A", "B", "C", "D", "E"], answer: "b", explanation: "The nucleus (B) controls the cell and holds the DNA." },
  { key: "cell-chloro", topic: "cells", kind: "single", image: "plantcell", prompt: "Photosynthesis happens in the chloroplasts. Which letter labels a chloroplast?", options: ["A", "B", "C", "D", "E"], answer: "c", explanation: "Chloroplasts (C) are the green discs that contain chlorophyll." },
  { key: "cell-plant-only", topic: "cells", kind: "multi", marks: 2, image: "plantcell", prompt: "Select ALL the labelled parts that are found in plant cells but NOT in animal cells.", options: ["A", "B", "C", "D", "E"], answer: ["a", "c", "d"], explanation: "The cell wall (A), chloroplasts (C) and the permanent vacuole (D) are plant-only. The nucleus (B) and mitochondria (E) are in both." },
  { key: "food-producer", topic: "food", kind: "single", image: "foodchain", prompt: "In this food chain, which one is the producer?", options: ["Sun", "Grass", "Rabbit", "Fox"], answer: "b", explanation: "Producers make their own food using light energy - grass is the plant in the chain." },
  { key: "food-arrow", topic: "food", kind: "single", image: "foodchain", prompt: "What does the arrow from the rabbit to the fox mean?", options: ["The rabbit eats the fox", "Energy passes from the rabbit to the fox when the fox eats it", "The fox runs faster than the rabbit", "The rabbit lives in the fox's den"], answer: "b", explanation: "Arrows in a food chain show the direction that energy (food) is passed on: rabbit → fox means the fox eats the rabbit." },
  { key: "food-predator", topic: "food", kind: "short", image: "foodchain", prompt: "What word describes an animal, like the fox, that hunts and eats other animals?", answer: "predator", accepted: ["a predator", "carnivore", "a carnivore"], explanation: "A predator hunts other animals (its prey)." },
  { key: "circuit-lamp", topic: "electric", kind: "single", image: "circuit", prompt: "Will the lamp light? Choose the best explanation.", options: ["Yes, because the cell provides energy", "No, because the switch is open so the circuit is not complete", "Yes, because all the wires are joined to something", "No, because the lamp is too big"], answer: "b", explanation: "Current can only flow round a complete loop. The open switch leaves a gap, so the lamp stays off until it is closed." },
  { key: "circuit-cell", topic: "electric", kind: "short", image: "circuit", prompt: "What is the component drawn on the left side of the circuit (one long line and one short thick line)?", answer: "cell", accepted: ["a cell", "battery", "a battery", "electric cell"], explanation: "That is the circuit symbol for a cell (several cells make a battery). The long line is the + end." },
  // ── Geography
  { key: "compass-dir", topic: "maps", kind: "single", image: "compass", prompt: "Which direction does the red arrow point?", options: ["North-east", "South-west", "South-east", "North-west"], answer: "b", explanation: "The arrow points down and to the left, halfway between south and west: south-west (SW)." },
  { key: "compass-opp", topic: "maps", kind: "short", prompt: "What is the opposite direction to north-east?", answer: "south-west", accepted: ["south west", "southwest", "sw"], explanation: "Opposite directions are half a turn apart: north-east ↔ south-west." },
  { key: "compass-turn", topic: "maps", kind: "single", prompt: "You are facing north and turn 90° clockwise. Which way are you facing now?", options: ["West", "South", "East", "North-west"], answer: "c", explanation: "Clockwise from north is east." },
  // ── English (picture prompts)
  { key: "scene-mood", topic: "comprehension", kind: "single", image: "scene", prompt: "Look at the picture. Which phrase best describes the mood of the scene?", options: ["Cheerful and sunny", "Gloomy and stormy", "Calm and peaceful", "Sleepy and quiet"], answer: "b", explanation: "Dark clouds, lightning and slanting rain create a gloomy, stormy, threatening mood." },
  { key: "scene-detail", topic: "comprehension", kind: "single", image: "scene", prompt: "Which detail in the picture suggests that someone is at home?", options: ["The glowing window", "The bent tree", "The lightning", "The rain"], answer: "a", explanation: "A lit window is a clue (an inference) that someone is inside - the other details are weather and scenery." },
  { key: "scene-weather", topic: "comprehension", kind: "short", image: "scene", prompt: "In one word, what kind of weather is shown in the picture? (an adjective ending -y)", answer: "stormy", accepted: ["storm", "a storm", "thunderstorm", "rainy", "stormy weather"], explanation: "Thunder, lightning and heavy rain make it stormy." },
  { key: "scene-write", topic: "comprehension", kind: "written", marks: 4, image: "scene", prompt: "Write two sentences describing the scene. Use at least two adjectives and one simile.", answer: null, explanation: "A strong answer names specific details (cloud, rain, window, tree), uses adjectives such as 'dark', 'heavy', 'lonely', and a simile such as 'the rain fell like tiny needles'." },
];

type ADef = { key: string; type: "quiz" | "diagnostic"; title: string; subject: string; qs: string[]; audience: { yearGroups: string[]; ageMin: number | null; ageMax: number | null }; timeLimitMins: number | null; passMarkPct: number; retakePolicy: "inherit" | "unlimited" | "once" | "cooldown"; note: string };
const ASSESSMENTS: ADef[] = [
  { key: "diag-maths-y34", type: "diagnostic", title: "Year 3–4 placement (Maths)", subject: "Maths", qs: ["clock", "pie-frac", "bar-most", "bar-diff", "symm", "@s-q-geo4", "@q-geo1"], audience: { yearGroups: ["Year 3", "Year 4"], ageMin: null, ageMax: null }, timeLimitMins: null, passMarkPct: 0, retakePolicy: "inherit", note: "placement, Year 3-4" },
  { key: "diag-maths-y56", type: "diagnostic", title: "Year 5–6 placement (Maths)", subject: "Maths", qs: ["pie-dec", "numline", "angle", "cuboid", "symm", "@s-q-frac3", "@s-q-geo3"], audience: { yearGroups: ["Year 5", "Year 6"], ageMin: null, ageMax: null }, timeLimitMins: null, passMarkPct: 0, retakePolicy: "inherit", note: "placement, Year 5-6" },
  { key: "diag-english-1113", type: "diagnostic", title: "Years 7–9 placement (English)", subject: "English", qs: ["scene-mood", "scene-detail", "scene-weather", "scene-write", "@s-q-gram2", "@s-q-gram3", "@s-q-comp1"], audience: { yearGroups: ["Year 7", "Year 8", "Year 9"], ageMin: null, ageMax: null }, timeLimitMins: null, passMarkPct: 0, retakePolicy: "inherit", note: "placement, Years 7-9" },
  { key: "quiz-pictures-y56", type: "quiz", title: "Pictures in Maths (Year 5–6)", subject: "Maths", qs: ["pie-frac", "pie-dec", "numline", "angle", "cuboid", "symm"], audience: { yearGroups: ["Year 5", "Year 6"], ageMin: null, ageMax: null }, timeLimitMins: 15, passMarkPct: 60, retakePolicy: "inherit", note: "picture quiz, Year 5-6" },
  { key: "quiz-pythagoras", type: "quiz", title: "Right-angled triangles (Year 7–9)", subject: "Maths", qs: ["pyth", "pyth-which", "angle", "cuboid"], audience: { yearGroups: ["Year 7", "Year 8", "Year 9"], ageMin: null, ageMax: null }, timeLimitMins: null, passMarkPct: 60, retakePolicy: "inherit", note: "picture quiz, Year 7-9" },
  { key: "quiz-science-pictures", type: "quiz", title: "Science in pictures", subject: "Science", qs: ["cell-nucleus", "cell-chloro", "cell-plant-only", "food-producer", "food-arrow", "food-predator", "circuit-lamp", "circuit-cell"], audience: { yearGroups: [], ageMin: null, ageMax: null }, timeLimitMins: null, passMarkPct: 60, retakePolicy: "once", note: "picture quiz, everyone - retake override: ONCE" },
  { key: "quiz-map-skills", type: "quiz", title: "Map skills: compass points", subject: "Geography", qs: ["compass-dir", "compass-opp", "compass-turn"], audience: { yearGroups: [], ageMin: null, ageMax: null }, timeLimitMins: null, passMarkPct: 60, retakePolicy: "inherit", note: "everyone (Geography)" },
];

const NEW_NOTES: { key: string; topic: string; title: string; body: string; videos: { id: string; title: string; start: number }[] }[] = [
  {
    key: "note-food-chains", topic: "food", title: "Food chains: how energy moves",
    body: "## Who eats whom?\n\nA **food chain** shows how energy passes from one living thing to the next. The **arrows** point the way the energy goes.\n\n`Grass → Rabbit → Fox`\n\n| Word | Meaning |\n| --- | --- |\n| Producer | Makes its own food (plants, using light from the Sun) |\n| Consumer | Eats other living things |\n| Predator | A consumer that hunts other animals |\n| Prey | An animal that is hunted |\n\nEvery chain starts with the **Sun**: producers capture its energy, and everything else depends on them.\n\n**Try it:** watch the video, then have a go at the *Science in pictures* quiz.",
    videos: [{ id: "MuKs9o1s8h8", title: "Fabulous Food Chains (Crash Course Kids)", start: 0 }, { id: "Vtb3I8Vzlfg", title: "Food Webs (Crash Course Kids)", start: 0 }],
  },
  {
    key: "note-pythagoras", topic: "geometry", title: "Pythagoras' theorem",
    body: "## The longest side of a right-angled triangle\n\nIn a triangle with a right angle, the side opposite the right angle is the **hypotenuse** (call it *c*). If the other two sides are *a* and *b*:\n\n`a² + b² = c²`\n\n**Worked example** (the 6 cm / 8 cm triangle):\n\n1. `6² + 8² = 36 + 64 = 100`\n2. `c = √100 = 10 cm`\n\nTo find a *shorter* side, subtract instead: `a² = c² − b²`.\n\nTip: whole-number triples such as **3-4-5**, **5-12-13** and **6-8-10** turn up all the time.",
    videos: [{ id: "AA6RfgP-AHU", title: "The Pythagorean theorem intro (Khan Academy)", start: 0 }, { id: "YompsDlEdtc", title: "How many ways are there to prove the Pythagorean theorem? (TED-Ed)", start: 0 }],
  },
  {
    key: "note-compass", topic: "maps", title: "Compass points and directions",
    body: "## North, east, south, west\n\nThe four **cardinal points** are **N**orth, **E**ast, **S**outh and **W**est. A handy way to remember the order clockwise: **N**ever **E**at **S**oggy **W**eetabix.\n\nBetween them sit the four **intermediate points**: north-east (NE), south-east (SE), south-west (SW) and north-west (NW).\n\n- Turning **clockwise** from north takes you to east, then south, then west.\n- **Opposite** directions are half a turn apart: N ↔ S, E ↔ W, NE ↔ SW, NW ↔ SE.",
    videos: [{ id: "ibLedhew2r0", title: "Cardinal Directions for Kids (Learn Bright)", start: 0 }],
  },
];

const GROUPS: { key: string; name: string; colour: string; members: string[] }[] = [
  { key: "year5-maths", name: "Year 5 Maths", colour: "blue", members: ["Hannah", "Jamie"] },
  { key: "exam-prep", name: "Exam prep", colour: "amber", members: ["Olivia", "Callum", "Priya"] },
  { key: "buddies", name: "Buddies (Hannah & Yamal)", colour: "violet", members: ["Hannah", "Yamal"] },
  { key: "young-starters", name: "Young starters", colour: "green", members: ["Aisha", "Tommy"] },
];

// ── seed ─────────────────────────────────────────────────────────────────────
type Write = { col: string; id: string; data: Record<string, unknown> };
async function seed() {
  const { name, ownerUid, ownerName } = await guard();
  const manifest = JSON.parse(fs.readFileSync(path.join(IMG_DIR, "manifest.json"), "utf8")) as Manifest;
  const png = (k: ImgKey) => {
    const f = path.join(IMG_DIR, `${k}.png`);
    if (!fs.existsSync(f)) throw new Error(`Missing ${f} — run: node scratch/hub-demo-images/generate.mjs`);
    return fs.readFileSync(f);
  };

  const nowIso = new Date().toISOString();
  const b = { tenantId: TID, franchiseId: null, createdBy: ownerUid || "seed", createdAt: nowIso };
  const writes: Write[] = [];
  const put = (col: string, docId: string, data: Record<string, unknown>) => writes.push({ col, id: docId, data });

  // topics: reuse the tenant's own, create the rest
  const topicSnap = await db.collection("hubTopics").where("tenantId", "==", TID).get();
  const findTopic = (subject: string, topic: string) =>
    topicSnap.docs.find((d) => !d.id.startsWith(P) && String(d.get("subject")).toLowerCase() === subject.toLowerCase() && String(d.get("topic")).toLowerCase() === topic.toLowerCase() && !d.get("subtopic") && !d.get("parentTopicId"))?.id;
  const topicId: Record<string, string> = {};
  for (const [k, [subject, topic]] of Object.entries(EXISTING_TOPICS)) {
    const t = findTopic(subject, topic);
    if (!t) throw new Error(`Base topic "${subject} / ${topic}" not found in ${TID} — run seedLearningHubDemo.ts first.`);
    topicId[k] = t;
  }
  for (const [k, subject, topic] of NEW_TOPICS) {
    const existing = findTopic(subject, topic);
    if (existing) { topicId[k] = existing; continue; }
    topicId[k] = id(`topic-${k}`);
    put("hubTopics", topicId[k], { ...b, subject, topic, subtopic: null, parentTopicId: null });
  }
  const subjectOf = new Map<string, string>();
  for (const [k, [s]] of Object.entries(EXISTING_TOPICS)) subjectOf.set(topicId[k], s);
  for (const [k, subject] of NEW_TOPICS) subjectOf.set(topicId[k], subject);

  // images
  const imgId = (k: ImgKey) => id(`img-${k}`);
  for (const k of IMAGE_KEYS) {
    const buf = png(k);
    if (buf.length > 750_000 || buf[0] !== 0x89) throw new Error(`${k}.png is not a valid PNG under 750KB`);
    put("images", imgId(k), { tenantId: TID, contentType: "image/png", b64: buf.toString("base64"), private: true, kind: "hub", bytes: buf.length, createdAt: nowIso });
  }

  // questions
  const qId = (key: string) => (key.startsWith("@") ? base(key.slice(1)) : id(`q-${key}`));
  for (const q of QUESTIONS) {
    const options = (q.options ?? []).map((text, i) => ({
      id: "abcdef"[i], text,
      ...(q.optionImages ? { image: { id: imgId(q.optionImages[i]) } } : {}),
    }));
    put("hubQuestions", qId(q.key), {
      ...b, topicId: topicId[q.topic], kind: q.kind, prompt: q.prompt, options, answer: q.answer, acceptedAnswers: q.accepted ?? [],
      tolerance: q.tolerance ?? 0, marks: q.marks ?? 1, explanation: q.explanation, published: true, updatedAt: nowIso,
      image: q.image ? { id: imgId(q.image), alt: manifest[q.image].alt } : null,
    });
  }

  // assessments (reference existing base questions too — they must exist)
  const qDocs = new Map((await db.collection("hubQuestions").where("tenantId", "==", TID).select("topicId").get()).docs.map((d) => [d.id, d.get("topicId") as string]));
  for (const q of QUESTIONS) qDocs.set(qId(q.key), topicId[q.topic]);
  const topicSubject = new Map(topicSnap.docs.map((d) => [d.id, d.get("subject") as string]));
  for (const [k, s] of subjectOf) topicSubject.set(k, s);
  for (const a of ASSESSMENTS) {
    const questionIds = a.qs.map(qId);
    for (const qi of questionIds) {
      const t = qDocs.get(qi);
      if (!t) throw new Error(`Question ${qi} missing (assessment ${a.key}) — run seedLearningHubStudents.ts first.`);
      if ((topicSubject.get(t) ?? "").toLowerCase() !== a.subject.toLowerCase()) throw new Error(`Question ${qi} is not in subject ${a.subject}`);
    }
    const topicIds = [...new Set(questionIds.map((qi) => qDocs.get(qi)!))];
    put("hubAssessments", id(a.key), {
      ...b, type: a.type, title: a.title, subject: a.subject, topicIds, questionIds, timeLimitMins: a.timeLimitMins, passMarkPct: a.passMarkPct, published: true, updatedAt: nowIso,
      audience: a.audience, retakePolicy: a.retakePolicy,
    });
  }

  // new notes
  for (const n of NEW_NOTES) {
    put("hubNotes", id(n.key), { ...b, topicId: topicId[n.topic], title: n.title, body: n.body, published: true, attachments: [], videos: n.videos, createdByName: ownerName, updatedAt: nowIso });
  }

  // enrolments → groups + yearGroup
  const enrSnap = await db.collection("hubEnrolments").where("tenantId", "==", TID).get();
  const enrols = enrSnap.docs.filter((d) => d.get("active") !== false);
  const libRef = db.collection("libraries").doc(TID);
  const lib = await libRef.get();
  const labelsCfg = (lib.get("settings.hub.yearGroups") as string[] | undefined);
  const labels = labelsCfg?.length ? labelsCfg : DEFAULT_YEAR_GROUPS;
  const childSnaps = enrols.length ? await db.getAll(...enrols.map((d) => db.collection("children").doc(d.get("childId") as string)), { fieldMask: ["dob"] }) : [];
  const yearFor = new Map<string, { yg: string | null; dob: string }>();
  const patches: { ref: FirebaseFirestore.DocumentReference; yg: string }[] = [];
  enrols.forEach((d, i) => {
    const dob = (childSnaps[i].get("dob") as string | undefined) ?? "";
    const yg = ukYearGroup(dob, labels);
    yearFor.set(d.get("childId"), { yg, dob });
    if (yg && !d.get("yearGroup")) patches.push({ ref: d.ref, yg });
  });
  const findChild = (first: string) => enrols.find((d) => String(d.get("childName")).toLowerCase().startsWith(first.toLowerCase()))?.get("childId") as string | undefined;
  const groupsOut: string[] = [];
  for (const g of GROUPS) {
    const childIds = g.members.map(findChild).filter((x): x is string => !!x);
    if (childIds.length !== g.members.length) { groupsOut.push(`${g.name}: SKIPPED (missing enrolment for ${g.members.filter((m) => !findChild(m)).join(", ")})`); continue; }
    put("hubGroups", id(`group-${g.key}`), { ...b, name: g.name, colour: g.colour, childIds, updatedAt: nowIso });
    groupsOut.push(`${g.name} (${childIds.length})`);
  }

  // tenant retake setting — only if the tenant hasn't chosen one
  const hubCfg = (lib.get("settings.hub") ?? null) as Record<string, unknown> | null;
  const setRetake = lib.exists && !(hubCfg && hubCfg.retakePolicy !== undefined);

  if (!DRY) {
    for (let i = 0; i < writes.length; i += 25) { // images are large — small batches
      const wb = db.batch();
      for (const w of writes.slice(i, i + 25)) wb.set(db.collection(w.col).doc(w.id), w.data);
      await wb.commit();
    }
    for (const [key, videos] of Object.entries(VIDEO_NOTES)) {
      const ref = db.collection("hubNotes").doc(base(key));
      const s = await ref.get();
      if (s.exists && s.get("tenantId") === TID) await ref.update({ videos });
      else console.log(`  (note ${key} not present in this tenant — skipped its videos)`);
    }
    for (const p of patches) await p.ref.update({ yearGroup: p.yg });
    if (setRetake) await libRef.update({ "settings.hub.retakePolicy": "cooldown", "settings.hub.retakeCooldownHours": 24 });
  }

  const by = (c: string) => writes.filter((w) => w.col === c).length;
  console.log(`${DRY ? "DRY RUN — nothing written. Would seed" : "Seeded"} Round-3 demo into "${name}" (${TID}):`);
  console.log(`  ${by("images")} images · ${by("hubTopics")} new topics · ${by("hubQuestions")} questions (${QUESTIONS.filter((q) => q.image).length} with a picture, ${QUESTIONS.filter((q) => q.optionImages).length} with picture answers) · ${by("hubAssessments")} assessments (${ASSESSMENTS.filter((a) => a.type === "diagnostic").length} placement + ${ASSESSMENTS.filter((a) => a.type === "quiz").length} quizzes) · ${by("hubNotes")} new notes`);
  console.log(`  videos added to existing notes: ${Object.keys(VIDEO_NOTES).join(", ")}`);
  console.log(`  groups: ${groupsOut.join(" · ")}`);
  console.log(`  yearGroup: ${enrols.map((d) => `${String(d.get("childName")).split(" ")[0]}=${yearFor.get(d.get("childId"))?.yg ?? "?"}`).join(", ")}${patches.length ? ` (set on ${patches.length} enrolments)` : " (all already set)"}`);
  console.log(`  library retake setting: ${!lib.exists ? "no library doc — skipped" : setRetake ? "set retakePolicy=cooldown, retakeCooldownHours=24" : `tenant already defines retakePolicy=${String(hubCfg?.retakePolicy)} — left alone`}`);
  console.log(`  Remove it with:  npx tsx src/seedLearningHubRound3.ts clean ${TID}`);
}

// ── check (read back + assert) ───────────────────────────────────────────────
async function check() {
  await guard();
  let bad = 0;
  const ok = (c: unknown, m: string) => { if (!c) { bad++; console.error(`  FAIL: ${m}`); } };
  const mine = async (col: string) => (await db.collection(col).where("tenantId", "==", TID).get()).docs.filter((d) => d.id.startsWith(P));
  const [topics, notes, qs, asms, groups] = await Promise.all(OWN_COLS.map(mine));
  const imgSnap = (await db.collection("images").where("tenantId", "==", TID).select("kind").get()).docs.filter((d) => d.id.startsWith(P));
  console.log(`Tenant ${TID}: ${imgSnap.length} images · ${topics.length} new topics · ${notes.length} new notes · ${qs.length} questions · ${asms.length} assessments · ${groups.length} groups`);
  ok(imgSnap.length === IMAGE_KEYS.length, `expected ${IMAGE_KEYS.length} images, found ${imgSnap.length}`);
  ok(qs.length === QUESTIONS.length, `expected ${QUESTIONS.length} questions, found ${qs.length}`);
  ok(asms.length === ASSESSMENTS.length, `expected ${ASSESSMENTS.length} assessments, found ${asms.length}`);
  ok(notes.length === NEW_NOTES.length, `expected ${NEW_NOTES.length} new notes, found ${notes.length}`);
  ok(groups.length === GROUPS.length, `expected ${GROUPS.length} groups, found ${groups.length}`);

  // images: full read (b64), PNG magic, < 750KB, same tenant, private hub
  const imgIds = new Set<string>();
  let totalKb = 0;
  for (const ref of imgSnap) {
    const d = (await ref.ref.get()).data()!;
    const buf = Buffer.from(String(d.b64), "base64");
    imgIds.add(ref.id);
    totalKb += buf.length / 1024;
    ok(d.tenantId === TID && d.private === true && d.kind === "hub" && d.contentType === "image/png", `${ref.id}: wrong flags`);
    ok(buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), `${ref.id}: not a PNG (magic bytes)`);
    ok(buf.length < 750_000 && d.bytes === buf.length, `${ref.id}: size ${buf.length} (bytes field ${d.bytes})`);
  }
  console.log(`  images decode as PNG, total ${totalKb.toFixed(0)} KB`);

  // every doc has tenantId; every image reference resolves to an image of THIS tenant
  for (const d of [...topics, ...notes, ...qs, ...asms, ...groups]) ok(d.get("tenantId") === TID, `${d.id}: tenantId`);
  const allQ = new Map((await db.collection("hubQuestions").where("tenantId", "==", TID).get()).docs.map((d) => [d.id, d.data()] as const));
  let refs = 0;
  for (const d of qs) {
    const x = d.data();
    if (x.image) { refs++; ok(imgIds.has(x.image.id) && typeof x.image.alt === "string" && x.image.alt.length > 10, `${d.id}: question image ${x.image?.id} missing or no alt`); }
    for (const o of x.options ?? []) if (o.image) { refs++; ok(imgIds.has(o.image.id), `${d.id}: option image ${o.image.id} missing`); }
    ok(x.published === true && typeof x.prompt === "string" && x.explanation, `${d.id}: shape`);
    if (x.kind === "single") ok(typeof x.answer === "string" && (x.options as { id: string }[]).some((o) => o.id === x.answer), `${d.id}: bad single answer`);
    if (x.kind === "multi") ok(Array.isArray(x.answer) && x.answer.every((a: string) => (x.options as { id: string }[]).some((o) => o.id === a)), `${d.id}: bad multi answer`);
    if (x.kind === "number") ok(typeof x.answer === "number", `${d.id}: bad number answer`);
  }
  console.log(`  ${refs} image references all resolve`);
  const topicIds = new Set((await db.collection("hubTopics").where("tenantId", "==", TID).select().get()).docs.map((d) => d.id));
  for (const d of qs) ok(topicIds.has(d.get("topicId")), `${d.id}: topic missing`);
  for (const d of asms) {
    const x = d.data();
    ok(x.questionIds.every((q: string) => allQ.has(q)), `${d.id}: has a dangling question id`);
    ok(x.audience && Array.isArray(x.audience.yearGroups), `${d.id}: audience`);
    ok(x.published === true && x.questionIds.length > 0, `${d.id}: unpublished/empty`);
  }
  for (const d of notes) ok((d.get("videos") as { id: string }[]).every((v) => /^[A-Za-z0-9_-]{11}$/.test(v.id)), `${d.id}: bad video id`);
  for (const [k, vids] of Object.entries(VIDEO_NOTES)) {
    const s = await db.collection("hubNotes").doc(base(k)).get();
    ok(s.exists && JSON.stringify((s.get("videos") as unknown[]) ?? null) === JSON.stringify(vids), `note ${k}: videos not as seeded`);
  }
  const enr = (await db.collection("hubEnrolments").where("tenantId", "==", TID).get()).docs.filter((d) => d.get("active") !== false);
  const enrIds = new Set(enr.map((d) => d.get("childId") as string));
  for (const g of groups) for (const c of g.get("childIds") as string[]) ok(enrIds.has(c), `${g.id}: member ${c} is not an active enrolment`);
  console.log("  year groups: " + enr.map((d) => `${String(d.get("childName")).split(" ")[0]}=${d.get("yearGroup") ?? "-"}`).join(", "));
  ok(enr.every((d) => !!d.get("yearGroup")), "some enrolment has no yearGroup");
  const lib = await db.collection("libraries").doc(TID).get();
  const rp = lib.get("settings.hub.retakePolicy");
  console.log(`  settings.hub.retakePolicy = ${rp} (cooldown hours ${lib.get("settings.hub.retakeCooldownHours")}); masteryBands untouched: ${JSON.stringify(lib.get("settings.hub.masteryBands"))}`);
  ok(rp !== undefined, "retakePolicy not set");
  const once = asms.find((d) => d.id === id("quiz-science-pictures"));
  ok(once?.get("retakePolicy") === "once", "per-quiz retake override missing");
  console.log(bad ? `CHECK FAILED (${bad})` : "CHECK PASSED");
  if (bad) process.exitCode = 1;
}

(async () => {
  if (MODE === "clean") { await guard(); console.log(`Round-3 clean for ${TID}:`, await wipe()); }
  else if (MODE === "check") await check();
  else await seed();
  process.exit(process.exitCode ?? 0);
})().catch((e) => { console.error(e); process.exit(1); });
