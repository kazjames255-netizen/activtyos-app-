// Seed a believable tutoring demo into ONE named tenant's Learning Hub: subjects
// (Maths / English / Science) with topics + subtopics, notes, a bank of questions
// of every kind, a diagnostic and two quizzes, flashcards — and, when the tenant
// already has enrolled students, homework (in every state) and live lessons.
//
// Uses the Firestore admin path directly (like the other seeds), so it never goes
// through the API and never sends a notification or an email.
//
// SAFETY
//  · The tenant id is REQUIRED — there is no default tenant, so it can't be run
//    "by accident" against somebody's real account.
//  · It refuses any tenant that looks like an e2e test account (an
//    @activityos-test.com owner/contact) — the Playwright suite owns those.
//  · Idempotent: every doc id is prefixed `hubdemo-<tenantId>-` and content is
//    deterministic, so re-running overwrites in place. `clean` removes exactly
//    those docs and nothing else. It never touches docs it didn't create.
//  · It does NOT create fake parents or children. Homework/lessons are attached to
//    students the tenant has ALREADY enrolled (Learning Hub → Students); with none,
//    it seeds the content only and says so.
//
//   npx tsx src/seedLearningHubDemo.ts <tenantId>          # seed (or refresh)
//   npx tsx src/seedLearningHubDemo.ts clean <tenantId>    # remove the demo docs
//   npx tsx src/seedLearningHubDemo.ts <tenantId> --dry    # build it all, write nothing
//
// Turn the hub on for the tenant first: Setup → Features → Learning Hub.
import { db } from "./firebase";

const DRY = process.argv.includes("--dry"); // build everything, write nothing
process.argv = process.argv.filter((a) => a !== "--dry");
const arg1 = process.argv[2];
const clean = arg1 === "clean";
const TID = clean ? process.argv[3] : arg1;
if (!TID || TID.startsWith("-")) {
  console.error("Usage: npx tsx src/seedLearningHubDemo.ts <tenantId>   |   npx tsx src/seedLearningHubDemo.ts clean <tenantId>");
  process.exit(1);
}
const PREFIX = `hubdemo-${TID}-`;
const id = (s: string) => `${PREFIX}${s}`;
const COLLECTIONS = ["hubTopics", "hubNotes", "hubQuestions", "hubAssessments", "hubFlashcards", "hubHomework", "hubSubmissions", "hubLessons"] as const;

const DAY = 86_400_000;
const at = (offsetDays: number, hour = 16, min = 0) => { const d = new Date(Date.now() + offsetDays * DAY); d.setUTCHours(hour, min, 0, 0); return d.toISOString(); };

async function guard(): Promise<{ name: string; ownerUid: string; ownerName: string }> {
  const t = await db.collection("tenants").doc(TID).get();
  if (!t.exists) { console.error(`No tenant ${TID}.`); process.exit(1); }
  const ownerUid = (t.get("ownerUid") as string | undefined) ?? "";
  const owner = ownerUid ? await db.collection("users").doc(ownerUid).get() : null;
  const emails = [t.get("email"), t.get("notifyEmail"), owner?.get("email")].filter((e): e is string => typeof e === "string");
  if (emails.some((e) => e.toLowerCase().endsWith("@activityos-test.com"))) {
    console.error(`Refusing: tenant ${TID} is an e2e test account (${emails.find((e) => e.toLowerCase().endsWith("@activityos-test.com"))}). The Playwright suite owns those.`);
    process.exit(1);
  }
  return { name: (t.get("name") as string) ?? TID, ownerUid, ownerName: ((owner?.get("name") as string | undefined) ?? "").trim() || "Your tutor" };
}

async function wipe() {
  let n = 0;
  for (const col of COLLECTIONS) {
    const snap = await db.collection(col).where("tenantId", "==", TID).get();
    const mine = snap.docs.filter((d) => d.id.startsWith(PREFIX));
    for (let i = 0; i < mine.length; i += 400) { const b = db.batch(); for (const d of mine.slice(i, i + 400)) b.delete(d.ref); await b.commit(); }
    n += mine.length;
  }
  return n;
}

async function seed() {
  const { name, ownerUid, ownerName } = await guard();
  const now = new Date().toISOString();
  const base = { tenantId: TID, franchiseId: null, createdBy: ownerUid || "seed", createdAt: now };
  const writes: { col: string; id: string; data: Record<string, unknown> }[] = [];
  const put = (col: string, docId: string, data: Record<string, unknown>) => writes.push({ col, id: id(docId), data: { ...base, ...data } });

  // ── Topics ────────────────────────────────────────────────────────────────
  const topics: [key: string, subject: string, topic: string, sub: string | null, parent: string | null][] = [
    ["maths-algebra", "Maths", "Algebra", null, null],
    ["maths-algebra-linear", "Maths", "Algebra", "Linear equations", "maths-algebra"],
    ["maths-algebra-quadratics", "Maths", "Algebra", "Quadratics", "maths-algebra"],
    ["maths-fractions", "Maths", "Fractions & decimals", null, null],
    ["maths-geometry", "Maths", "Geometry", null, null],
    ["english-comprehension", "English", "Reading comprehension", null, null],
    ["english-grammar", "English", "Grammar & punctuation", null, null],
    ["science-cells", "Science", "Cells", null, null],
    ["science-forces", "Science", "Forces & motion", null, null],
  ];
  for (const [k, subject, topic, sub, parent] of topics) put("hubTopics", `topic-${k}`, { subject, topic, subtopic: sub, parentTopicId: parent ? id(`topic-${parent}`) : null });
  const T = (k: string) => id(`topic-${k}`);

  // ── Notes ─────────────────────────────────────────────────────────────────
  const notes: [key: string, topic: string, title: string, body: string, published: boolean][] = [
    ["linear", "maths-algebra-linear", "Solving linear equations", "## The balance method\n\nWhatever you do to **one side**, do to the **other**.\n\n1. Get the letter terms on one side\n2. Get the numbers on the other\n3. Divide by the coefficient\n\nExample: `3x + 5 = 20` → `3x = 15` → `x = 5`.", true],
    ["quadratics", "maths-algebra-quadratics", "Factorising quadratics", "## Factorising `x² + bx + c`\n\nFind two numbers that **multiply** to `c` and **add** to `b`.\n\n- `x² + 5x + 6` → numbers 2 and 3 → `(x + 2)(x + 3)`\n- `x² − x − 12` → numbers −4 and 3 → `(x − 4)(x + 3)`\n\nAlways check by expanding.", true],
    ["fractions", "maths-fractions", "Adding fractions with different denominators", "## Common denominators\n\n1. Find the lowest common multiple of the denominators\n2. Rewrite each fraction\n3. Add the numerators\n4. Simplify\n\n`1/3 + 1/4 = 4/12 + 3/12 = 7/12`", true],
    ["inference", "english-comprehension", "Finding evidence in a text", "## PEE: Point, Evidence, Explain\n\nMake a **point**, quote the **evidence**, then **explain** what it shows about the character or theme.", true],
    ["cells", "science-cells", "Plant and animal cells", "## What is in a cell?\n\n| Part | Job |\n| --- | --- |\n| Nucleus | Controls the cell |\n| Mitochondria | Releases energy |\n| Cell wall | Supports (plants only) |\n| Chloroplast | Photosynthesis (plants only) |", true],
    ["forces-draft", "science-forces", "Newton's laws (draft)", "Work in progress — to be published after Friday's lesson.", false],
  ];
  for (const [k, topic, title, body, published] of notes) put("hubNotes", `note-${k}`, { topicId: T(topic), title, body, published, attachments: [], createdByName: ownerName, updatedAt: now });

  // ── Questions (kinds match settings.hub.questionKinds defaults) ───────────
  type Q = { key: string; topic: string; kind: string; prompt: string; options?: { id: string; text: string }[]; answer: unknown; accepted?: string[]; tolerance?: number; marks?: number; explanation: string };
  const opts = (...t: string[]) => t.map((text, i) => ({ id: "abcdef"[i], text }));
  const questions: Q[] = [
    { key: "lin1", topic: "maths-algebra-linear", kind: "number", prompt: "Solve 3x + 5 = 20. What is x?", answer: 5, explanation: "3x = 15, so x = 5." },
    { key: "lin2", topic: "maths-algebra-linear", kind: "single", prompt: "Which step comes first when solving 2x − 7 = 11?", options: opts("Divide by 2", "Add 7 to both sides", "Subtract 11", "Multiply by 7"), answer: "b", explanation: "Undo the −7 first: add 7 to both sides, then divide by 2." },
    { key: "quad1", topic: "maths-algebra-quadratics", kind: "single", prompt: "Factorise x² + 5x + 6", options: opts("(x + 1)(x + 6)", "(x + 2)(x + 3)", "(x − 2)(x − 3)", "(x + 5)(x + 1)"), answer: "b", explanation: "2 × 3 = 6 and 2 + 3 = 5." },
    { key: "quad2", topic: "maths-algebra-quadratics", kind: "multi", prompt: "Select ALL the roots of x² − 5x + 6 = 0", options: opts("1", "2", "3", "6"), answer: ["b", "c"], marks: 2, explanation: "(x − 2)(x − 3) = 0 gives x = 2 or x = 3." },
    { key: "quad3", topic: "maths-algebra-quadratics", kind: "written", prompt: "Explain, in your own words, why checking a factorisation by expanding is a good idea.", answer: null, marks: 3, explanation: "Expanding should give back the original expression; if it doesn't, the factors are wrong." },
    { key: "frac1", topic: "maths-fractions", kind: "short", prompt: "What is 1/3 + 1/4 as a single fraction? (write like 7/12)", answer: "7/12", explanation: "4/12 + 3/12 = 7/12." },
    { key: "frac2", topic: "maths-fractions", kind: "number", prompt: "Write 3/8 as a decimal.", answer: 0.375, tolerance: 0.001, explanation: "3 ÷ 8 = 0.375." },
    { key: "geo1", topic: "maths-geometry", kind: "number", prompt: "A rectangle is 8 cm by 5 cm. What is its area in cm²?", answer: 40, explanation: "Area = length × width = 8 × 5." },
    { key: "geo2", topic: "maths-geometry", kind: "short", prompt: "What do the angles inside a triangle add up to (in degrees)?", answer: "180", accepted: ["180 degrees", "180°"], explanation: "The interior angles of any triangle sum to 180°." },
    { key: "cell1", topic: "science-cells", kind: "single", prompt: "Which part of a cell releases energy?", options: opts("Nucleus", "Mitochondria", "Cell wall", "Chloroplast"), answer: "b", explanation: "Respiration happens in the mitochondria." },
    { key: "cell2", topic: "science-cells", kind: "short", prompt: "What is the name of the process plants use to make food from light?", answer: "photosynthesis", explanation: "Photosynthesis takes place in chloroplasts." },
    { key: "cell3", topic: "science-cells", kind: "multi", prompt: "Which of these are found ONLY in plant cells?", options: opts("Cell wall", "Nucleus", "Chloroplasts", "Cell membrane"), answer: ["a", "c"], marks: 2, explanation: "Animal cells have a nucleus and a membrane too." },
    { key: "gram1", topic: "english-grammar", kind: "single", prompt: "Which sentence is punctuated correctly?", options: opts("Its a lovely day.", "It's a lovely day.", "Its' a lovely day.", "Its a lovely, day."), answer: "b", explanation: "It's = it is." },
  ];
  for (const q of questions) {
    put("hubQuestions", `q-${q.key}`, { topicId: T(q.topic), kind: q.kind, prompt: q.prompt, options: q.options ?? [], answer: q.answer, acceptedAnswers: q.accepted ?? [], tolerance: q.tolerance ?? 0, marks: q.marks ?? 1, explanation: q.explanation, published: true, updatedAt: now });
  }
  const Q = (...keys: string[]) => keys.map((k) => id(`q-${k}`));

  // ── Assessments ───────────────────────────────────────────────────────────
  put("hubAssessments", "diag-maths", { type: "diagnostic", title: "Maths placement check", subject: "Maths", topicIds: ["maths-algebra-linear", "maths-algebra-quadratics", "maths-fractions", "maths-geometry"].map(T), questionIds: Q("lin1", "quad1", "frac1", "frac2", "geo1", "geo2"), timeLimitMins: null, passMarkPct: 0, published: true, updatedAt: now });
  put("hubAssessments", "quiz-algebra", { type: "quiz", title: "Algebra checkpoint", subject: "Maths", topicIds: ["maths-algebra-linear", "maths-algebra-quadratics"].map(T), questionIds: Q("lin1", "lin2", "quad1", "quad2", "quad3"), timeLimitMins: 20, passMarkPct: 70, published: true, updatedAt: now });
  put("hubAssessments", "quiz-cells", { type: "quiz", title: "Cells quiz", subject: "Science", topicIds: [T("science-cells")], questionIds: Q("cell1", "cell2", "cell3"), timeLimitMins: null, passMarkPct: 60, published: true, updatedAt: now });

  // ── Flashcards ────────────────────────────────────────────────────────────
  const cards: [string, string, string, string][] = [
    ["cell-nucleus", "science-cells", "What does the nucleus do?", "It controls the cell's activities and holds the DNA."],
    ["cell-mito", "science-cells", "Where does respiration happen?", "In the mitochondria."],
    ["cell-chloro", "science-cells", "What do chloroplasts do?", "They carry out photosynthesis (plant cells only)."],
    ["cell-wall", "science-cells", "Which cells have a cell wall?", "Plant cells (it supports and protects them)."],
    ["frc-lcm", "maths-fractions", "First step to add 1/3 + 1/4?", "Find a common denominator (12)."],
    ["frc-dec", "maths-fractions", "1/8 as a decimal?", "0.125"],
    ["geo-tri", "maths-geometry", "Sum of the angles in a triangle?", "180°"],
    ["geo-area", "maths-geometry", "Area of a triangle?", "½ × base × height"],
    ["alg-quad", "maths-algebra-quadratics", "Factorise x² + bx + c: what do you look for?", "Two numbers that multiply to c and add to b."],
    ["alg-bal", "maths-algebra-linear", "Golden rule for solving equations?", "Do the same to both sides."],
    ["gram-its", "english-grammar", "When do you write \"it's\"?", "Only when you mean \"it is\" or \"it has\"."],
    ["gram-semi", "english-grammar", "What does a semicolon join?", "Two closely related complete sentences."],
  ];
  for (const [k, topic, front, back] of cards) put("hubFlashcards", `card-${k}`, { topicId: T(topic), front, back, published: true, createdByName: ownerName, updatedAt: now });

  // ── Homework & lessons — only for students the tenant has already enrolled ──
  const enr = (await db.collection("hubEnrolments").where("tenantId", "==", TID).get()).docs.map((d) => d.data() as { childId: string; childName: string; parentUid: string; active?: boolean }).filter((e) => e.active !== false).slice(0, 4);
  if (enr.length) {
    const hw = [
      { key: "algebra", title: "Algebra checkpoint (quiz)", instructions: "Sit the Algebra checkpoint quiz. Show your working on paper and upload a photo of the written question.", assessmentId: id("quiz-algebra"), noteIds: [id("note-linear"), id("note-quadratics")], flashcardTopicId: T("maths-algebra"), due: at(3, 18) },
      { key: "cells", title: "Label the plant cell", instructions: "Read the cells note, then draw and label a plant cell. Learn the four flashcards on organelles.", assessmentId: null, noteIds: [id("note-cells")], flashcardTopicId: T("science-cells"), due: at(-2, 18) },
      { key: "pee", title: "One PEE paragraph", instructions: "Write one PEE paragraph about how the author shows the narrator is nervous.", assessmentId: null, noteIds: [id("note-inference")], flashcardTopicId: null, due: at(6, 18) },
    ];
    for (const h of hw) {
      put("hubHomework", `hw-${h.key}`, { title: h.title, instructions: h.instructions, assessmentId: h.assessmentId, noteIds: h.noteIds, flashcardTopicId: h.flashcardTopicId, dueAt: h.due, assignedChildIds: enr.map((e) => e.childId), createdByName: ownerName, updatedAt: now });
      enr.forEach((e, i) => {
        // A spread of states so every tab of the inbox has something in it.
        const state = h.key === "cells" ? (i % 2 === 0 ? "marked" : "submitted") : i === 0 && h.key === "algebra" ? "submitted" : "assigned";
        const submittedAt = state === "assigned" ? null : at(-3, 17, 30 + i);
        put("hubSubmissions", `hw-${h.key}__${e.childId}`, {
          homeworkId: id(`hw-${h.key}`), childId: e.childId, parentUid: e.parentUid, status: state,
          text: state === "assigned" ? "" : "I labelled the nucleus, cell wall, chloroplasts and mitochondria. I wasn't sure about the vacuole.",
          attachments: [], attemptId: null, submittedAt,
          mark: state === "marked" ? { score: 8 - i, max: 10, feedback: "Clear labelling — remember the vacuole holds cell sap. Good effort!", markedBy: ownerUid || "seed", markedByName: ownerName, markedAt: at(-1, 10) } : null,
          updatedAt: now,
        });
      });
    }
    put("hubLessons", "lesson-next", { tutorUid: ownerUid, tutorName: ownerName, title: "Algebra: factorising quadratics", topicId: T("maths-algebra-quadratics"), startsAt: at(1, 16), durationMins: 60, childIds: enr.slice(0, 2).map((e) => e.childId), status: "scheduled", roomName: null, roomUrl: null, notes: "Bring the factorising worksheet.", attendance: {}, tutorJoinedAt: null, endedAt: null, updatedAt: now });
    put("hubLessons", "lesson-past", { tutorUid: ownerUid, tutorName: ownerName, title: "Cells recap", topicId: T("science-cells"), startsAt: at(-5, 16), durationMins: 45, childIds: enr.slice(0, 2).map((e) => e.childId), status: "ended", roomName: null, roomUrl: null, notes: "", attendance: Object.fromEntries(enr.slice(0, 2).map((e) => [e.childId, at(-5, 16, 2)])), tutorJoinedAt: at(-5, 15, 58), endedAt: at(-5, 16, 47), updatedAt: now });
  }

  if (!DRY) for (let i = 0; i < writes.length; i += 400) {
    const b = db.batch();
    for (const w of writes.slice(i, i + 400)) b.set(db.collection(w.col).doc(w.id), w.data);
    await b.commit();
  }
  const by = (c: string) => writes.filter((w) => w.col === c).length;
  console.log(`${DRY ? "DRY RUN — nothing written. Would seed" : "Seeded"} the Learning Hub demo into "${name}" (${TID}):`);
  console.log(`  ${by("hubTopics")} topics · ${by("hubNotes")} notes · ${by("hubQuestions")} questions · ${by("hubAssessments")} assessments (diagnostic + 2 quizzes) · ${by("hubFlashcards")} flashcards`);
  console.log(enr.length
    ? `  ${by("hubHomework")} homework × ${enr.length} enrolled students (${by("hubSubmissions")} submissions) · ${by("hubLessons")} lessons`
    : "  No enrolled students yet, so no homework/lessons were added. Enrol a student (Learning Hub → Students) and re-run to add them.");
  console.log("  Make sure the hub is on: Setup → Features → Learning Hub.");
  console.log(`  Remove it all with:  npx tsx src/seedLearningHubDemo.ts clean ${TID}`);
}

(async () => {
  if (clean) {
    await guard();
    console.log(`Removed ${await wipe()} demo docs from tenant ${TID}.`);
  } else {
    await seed();
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
