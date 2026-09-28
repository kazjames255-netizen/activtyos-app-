// TEST DATA ONLY: seeds sample worksheets + 3 sample students + a group on a throwaway @activityos-test.com freelancer tenant.
//   cd server && npx tsx src/oak/seedTestWorksheets.ts <tenantId> <ownerEmail>
// Refuses any tenant whose owner is not on @activityos-test.com. Idempotent (worksheets are matched by title).
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auth, db } from "../firebase";
import { putWorksheetObject } from "../lib/worksheetStorage";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const [TID, OWNER] = process.argv.slice(2);
if (!TID || !OWNER?.endsWith("@activityos-test.com")) { console.error("usage: seedTestWorksheets <tenantId> <owner@activityos-test.com>"); process.exit(2); }
const API = "http://localhost:4000", H = "/api/learning-hub", PW = "E2etest!123";
const key = () => { for (const l of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) { const m = l.match(/^\s*NEXT_PUBLIC_FIREBASE_API_KEY\s*=\s*(.*)\s*$/); if (m) return m[1]!.replace(/^["']|["']$/g, ""); } throw new Error("no key"); };
async function signIn(email: string) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${key()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PW, returnSecureToken: true }) });
  const j = (await r.json()) as { idToken?: string; localId?: string };
  if (!j.idToken) throw new Error("sign-in failed for " + email);
  return { token: j.idToken, uid: j.localId! };
}
async function call(p: string, tok: string, method = "GET", body?: unknown) {
  const r = await fetch(`${API}${p}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const t = await r.text(); let j: any = t; try { j = JSON.parse(t); } catch { /* */ }
  if (!r.ok) throw new Error(`${method} ${p} ${r.status} ${t.slice(0, 200)}`);
  return j;
}
type W = { y: number; s: "Maths" | "English" | "Science"; t: string; q?: [string, string[], string, string] }; // prompt, options (correct first), short prompt, short answer
const W: W[] = [
  { y: 1, s: "Maths", t: "Counting and number bonds to 10", q: ["What is 6 + 4?", ["10", "9", "11"], "What is 10 - 3?", "7"] },
  { y: 2, s: "Maths", t: "Adding and subtracting two-digit numbers", q: ["What is 34 + 25?", ["59", "49", "58"], "What is 50 - 20?", "30"] },
  { y: 3, s: "Maths", t: "Times tables: 3, 4 and 8" },
  { y: 4, s: "Maths", t: "Fractions of amounts", q: ["What is 1/4 of 20?", ["5", "4", "10"], "What is 1/2 of 18?", "9"] },
  { y: 5, s: "Maths", t: "Decimals and place value" },
  { y: 6, s: "Maths", t: "Percentages of amounts", q: ["What is 10% of 250?", ["25", "10", "2.5"], "What is 50% of 60?", "30"] },
  { y: 8, s: "Maths", t: "Expanding brackets", q: ["Expand 3(x + 4)", ["3x + 12", "3x + 4", "x + 12"], "Solve 2x = 18. What is x?", "9"] },
  { y: 9, s: "Maths", t: "Pythagoras' theorem" },
  { y: 1, s: "English", t: "Phonics: digraphs sh, ch and th", q: ["Which word has the 'sh' sound?", ["ship", "chip", "thin"], "Which two letters make the end sound in 'fish'?", "sh"] },
  { y: 2, s: "English", t: "Punctuation: capital letters and full stops" },
  { y: 3, s: "English", t: "Nouns, verbs and adjectives", q: ["Which word is the verb? 'The dog runs fast.'", ["runs", "dog", "fast"], "What type of word is 'happy'?", "adjective"] },
  { y: 4, s: "English", t: "Using apostrophes for possession", q: ["Which is correct?", ["the girl's coat", "the girls coat", "the girl's' coat"], "Write the short form of 'do not'.", "don't"] },
  { y: 5, s: "English", t: "Reading comprehension: The Lighthouse Keeper" },
  { y: 6, s: "English", t: "Conjunctions and subordinate clauses", q: ["Which is a subordinating conjunction?", ["although", "and", "but"], "Complete: I stayed inside ___ it was raining.", "because"] },
  { y: 7, s: "English", t: "Persuasive writing techniques" },
  { y: 9, s: "English", t: "Analysing language and structure", q: ["A comparison using 'like' or 'as' is called a...", ["simile", "metaphor", "alliteration"], "What is repeating the same first sound in nearby words called?", "alliteration"] },
  { y: 1, s: "Science", t: "Animals and their body parts", q: ["Which animal is a mammal?", ["dog", "frog", "fish"], "How many legs does a bird have?", "2"] },
  { y: 2, s: "Science", t: "Living things and their habitats" },
  { y: 3, s: "Science", t: "Rocks and soils", q: ["Which type of rock forms from cooled lava?", ["igneous", "sedimentary", "metamorphic"], "Is granite hard or soft?", "hard"] },
  { y: 4, s: "Science", t: "States of matter", q: ["What is water called when it is a gas?", ["water vapour", "ice", "snow"], "What is it called when a liquid turns into a gas?", "evaporation"] },
  { y: 5, s: "Science", t: "Forces: gravity and friction" },
  { y: 6, s: "Science", t: "The circulatory system", q: ["Which organ pumps blood around the body?", ["heart", "lungs", "liver"], "What are the tubes carrying blood away from the heart called?", "arteries"] },
  { y: 7, s: "Science", t: "Cells and microscopes", q: ["Which part of a cell controls its activities?", ["nucleus", "cell wall", "vacuole"], "What is the smallest unit of life called?", "cell"] },
  { y: 9, s: "Science", t: "Chemical reactions and equations" },
];
const pdfFor = (text: string) => { const t = text.replace(/[()\\]/g, ""); return Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 300]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length ${t.length + 60}>>stream\nBT /F1 16 Tf 20 200 Td (${t}) Tj 0 -30 Td (Sample worksheet - test data) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R/Size 6>>\n%%EOF\n`); };

(async () => {
  const { token: T } = await signIn(OWNER);
  const tenant = (await db.collection("tenants").doc(TID).get()).data();
  if (!tenant || (await auth.getUser(tenant.ownerUid)).email !== OWNER) throw new Error("owner mismatch");
  // hub on
  const lib = (await call("/api/library", T)) ?? {};
  await call("/api/library", T, "PUT", { settings: { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: true } } });
  // topics
  let topics: any[] = await call(`${H}/topics`, T);
  const topicFor = async (s: string, y: number) => {
    let parent = topics.find((x) => x.subject === s && !x.subtopic);
    if (!parent) { await call(`${H}/topics`, T, "POST", { subject: s, topic: "Worksheets" }); topics = await call(`${H}/topics`, T); parent = topics.find((x) => x.subject === s && !x.subtopic); }
    let sub = topics.find((x) => x.subject === s && x.subtopic === `Year ${y}`);
    if (!sub) { await call(`${H}/topics`, T, "POST", { parentTopicId: parent.id, subtopic: `Year ${y}` }); topics = await call(`${H}/topics`, T); sub = topics.find((x) => x.subject === s && x.subtopic === `Year ${y}`); }
    return sub.id as string;
  };
  const existing = new Set((await db.collection("hubNotes").where("tenantId", "==", TID).select("title").get()).docs.map((d) => d.get("title")));
  const ids: string[] = [];
  for (const w of W) {
    if (existing.has(w.t)) { console.log("skip", w.t); continue; }
    const topicId = await topicFor(w.s, w.y);
    let quizId: string | undefined;
    if (w.q) {
      const [p1, opts, p2, a2] = w.q;
      const options = opts.map((t, i) => ({ id: `o${i}`, text: t }));
      const q1 = await call(`${H}/questions`, T, "POST", { topicId, kind: "single", prompt: p1, options: [...options].reverse(), answer: "o0", marks: 1, explanation: `The answer is ${opts[0]}.` });
      const q2 = await call(`${H}/questions`, T, "POST", { topicId, kind: "short", prompt: p2, answer: a2, acceptedAnswers: a2 === "don't" ? ["don’t", "dont"] : [], marks: 1, explanation: `The answer is ${a2}.` });
      quizId = (await call(`${H}/assessments`, T, "POST", { type: "quiz", title: `${w.t} (worksheet)`, subject: w.s, topicIds: [topicId], questionIds: [q1.id, q2.id], timeLimitMins: null, passMarkPct: 50, published: true })).id;
    }
    const note = await call(`${H}/notes`, T, "POST", { topicId, title: w.t, body: `Year ${w.y} ${w.s} practice worksheet.`, published: true });
    await putWorksheetObject(TID, note.id, pdfFor(`Year ${w.y} ${w.s}: ${w.t}`));
    await db.collection("hubNotes").doc(note.id).update({ worksheetFile: { name: `${w.t.replace(/[^\w ]/g, "")}.pdf`, size: 700, pages: 1 }, ...(quizId ? { worksheetQuizId: quizId } : {}) });
    ids.push(note.id); console.log("seeded", w.y, w.s, w.t, quizId ? "interactive" : "pdf");
  }
  // students: one throwaway parent + 3 children
  const pEmail = `sample-family-${TID.slice(0, 6).toLowerCase()}@activityos-test.com`;
  let puid: string;
  try { puid = (await auth.getUserByEmail(pEmail)).uid; } catch { puid = (await auth.createUser({ email: pEmail, password: PW })).uid; }
  const pt = (await signIn(pEmail)).token;
  await call("/api/register-role", pt, "POST", { role: "parent", postcode: "NN5 7EA" }).catch(() => null);
  const kids = [["Sam Sample", "Year 3", "2017-03-10"], ["Priya Sample", "Year 6", "2014-05-02"], ["Jordan Sample", "Year 9", "2011-02-20"]] as const;
  const childIds: string[] = [];
  for (const [name, yg, dob] of kids) {
    const ex = await db.collection("children").where("parentUid", "==", puid).where("name", "==", name).get();
    const cid = ex.empty ? (await db.collection("children").add({ parentUid: puid, name, dob, createdAt: new Date().toISOString() })).id : ex.docs[0]!.id;
    childIds.push(cid);
    const now = new Date().toISOString();
    await db.collection("hubEnrolments").doc(`${TID}__${cid}`).set({ tenantId: TID, franchiseId: null, childId: cid, childName: name, parentUid: puid, parentEmail: pEmail, subjects: ["Maths", "English", "Science"], tutorUid: null, tutorName: "", active: true, yearGroup: yg, yearGroupAuto: false, createdBy: tenant.ownerUid, createdAt: now, updatedAt: now });
  }
  const groups: any[] = await call(`${H}/groups`, T);
  if (!groups.some((g) => g.name === "Sample group")) await call(`${H}/groups`, T, "POST", { name: "Sample group", colour: "blue", childIds });
  // GET /api/my/providers (the portal shell's own brand lookup, unrelated to the Hub) reads `customers`/`bookings`, not hubEnrolments — a
  // family created only via hubEnrolments above resolves fine inside the Hub but has no provider name ANYWHERE else in the app (sidebar,
  // Messages, newsfeed): it falls back to "Your activity provider", or — worse, on a browser that has another account's brand cached —
  // silently shows a stale name from whichever tenant that browser looked at last. Write the same `customers` doc a real booking/invite
  // would leave, so this parent brands correctly everywhere, not only inside the Hub.
  const ageOf = (dob: string) => Math.max(0, Math.floor((Date.now() - new Date(dob).getTime()) / 31_557_600_000));
  await db.collection("customers").doc(`${TID}__${puid}`).set({ tenantId: TID, name: "Sample Family", email: pEmail, phone: "", uid: puid,
    children: kids.map(([name, , dob], i) => ({ name, childId: childIds[i], age: ageOf(dob) })) }, { merge: true });
  // refresh the API's notes index for this tenant, then show counts
  const wsIds = (await db.collection("hubNotes").where("tenantId", "==", TID).select("worksheetFile").get()).docs.filter((d) => d.get("worksheetFile")).map((d) => d.id);
  await call(`${H}/notes/index-refresh`, T, "POST", { ids: wsIds }); // patch in place (a bare {} refresh alone left the counts stale)
  { const c = await call(`${H}/notes/counts`, T); console.log(JSON.stringify({ worksheets: c.worksheets, byYear: c.worksheetsByYear, bySubject: c.worksheetsBySubject })); }
  console.log("parent", pEmail, "children", childIds.join(","));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
