// Learning Hub — synthetic-load harness. Builds a tenant-sized dataset (what a provider ends up with after the
// curriculum seeds: ~700 topic rows, ~5,000 questions, ~450 quizzes + ~70 placement papers, ~450 notes,
// ~4,500 flashcards) in a SCRATCH tenant and times the hub's real endpoints as a tutor and as an enrolled parent.
//
//   npx tsx src/hubLoadTest.ts setup            # create the scratch tutor + parent accounts/tenant (idempotent)
//   npx tsx src/hubLoadTest.ts seed             # write the synthetic dataset (ids prefixed `hubload-`)
//   npx tsx src/hubLoadTest.ts bench [label]    # time the endpoints; writes bench-<label>.json next to the state file
//   npx tsx src/hubLoadTest.ts compare a b      # side-by-side table of two bench files
//   npx tsx src/hubLoadTest.ts clean            # delete the dataset AND the scratch tenant + accounts
//
// SAFETY: it makes its OWN tenant and accounts (email `hubload-*@example.com`, NOT the @activityos-test.com domain the
// e2e suite wipes) so it can't disturb — or be wiped by — the Playwright specs the other agents run. The state file
// (default <tmpdir>/hubload-state.json, override with HUBLOAD_DIR) remembers the ids; `clean` removes everything.
import "dotenv/config";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auth, db } from "./firebase";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
const DIR = process.env.HUBLOAD_DIR || os.tmpdir();
const STATE = path.join(DIR, "hubload-state.json");
const API = process.env.HUBLOAD_API || "http://localhost:4000";
const PW = "E2etest!123";
const P = "hubload-";

interface State { runId: string; tutor: { email: string; uid: string }; parent: { email: string; uid: string }; tenantId: string; childId: string; seeded?: Record<string, number>; subjects?: string[]; sampleTopicId?: string; sampleSubtopicId?: string }
const load = (): State => JSON.parse(fs.readFileSync(STATE, "utf8"));
const save = (s: State) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2));

function apiKey(): string {
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^\s*NEXT_PUBLIC_FIREBASE_API_KEY\s*=\s*(.*)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, "");
  }
  throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY not found");
}
async function identity(endpoint: string, body: unknown) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${apiKey()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await res.json()) as { idToken?: string; localId?: string; error?: { message?: string } };
  if (!res.ok || !j.idToken) throw new Error(`${endpoint}: ${j.error?.message ?? res.status}`);
  return { idToken: j.idToken, uid: j.localId! };
}
const signIn = (email: string) => identity("accounts:signInWithPassword", { email, password: PW, returnSecureToken: true });
async function call<T = unknown>(pathQ: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${pathQ}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${pathQ} → ${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

// ── setup ────────────────────────────────────────────────────────────────────
async function setup() {
  if (fs.existsSync(STATE)) { console.log(`state exists: ${STATE}`); return; }
  const runId = Date.now().toString(36);
  const tEmail = `hubload-tutor-${runId}@example.com`;
  const pEmail = `hubload-parent-${runId}@example.com`;
  const t = await identity("accounts:signUp", { email: tEmail, password: PW, returnSecureToken: true });
  const r = await call<{ tenantId: string }>("/api/register-role", t.idToken, { method: "POST", body: JSON.stringify({ role: "freelancer", businessName: `HubLoad ${runId}`, providerName: `HubLoad ${runId}`, providerNameMode: "business" }) });
  const p = await identity("accounts:signUp", { email: pEmail, password: PW, returnSecureToken: true });
  await call("/api/register-role", p.idToken, { method: "POST", body: JSON.stringify({ role: "parent", postcode: "NN5 7EA" }) });
  await db.collection("tenants").doc(r.tenantId).update({ subscription: (await import("firebase-admin/firestore")).FieldValue.delete() });
  // Hub on.
  const lib = (await call<{ settings?: Record<string, unknown> } | null>("/api/library", t.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...((lib.settings?.features as Record<string, boolean>) ?? {}), learninghub: true } };
  await call("/api/library", t.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
  // The parent's child (dob → Year 5 in Sept 2026).
  const child = await db.collection("children").add({ parentUid: p.uid, name: "Hubload Kid", dob: "2016-11-03", createdAt: new Date().toISOString() });
  save({ runId, tutor: { email: tEmail, uid: t.uid }, parent: { email: pEmail, uid: p.uid }, tenantId: r.tenantId, childId: child.id });
  console.log(`scratch tenant ${r.tenantId}, tutor ${tEmail}, parent ${pEmail}\nstate: ${STATE}`);
}

// ── seed ─────────────────────────────────────────────────────────────────────
const SUBJECTS = ["Maths", "English", "Science", "History", "Geography"];
const YEARS = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"];
const TOPICS_PER_SUBJECT = 20; // 5 × 20 × (1 + 6) = 700 topic rows
const LOREM = "Fractions, ratios and equations are built from small ideas. Start by naming the parts, then practise a worked example, then try one alone. Check each answer by working backwards, and write the method down in full so a tutor can follow it. ";

async function seed() {
  const s = load();
  const tid = s.tenantId;
  const now = new Date().toISOString();
  const base = { tenantId: tid, franchiseId: null, createdBy: s.tutor.uid, createdAt: now };
  const bw = db.bulkWriter();
  bw.onWriteError((e) => e.failedAttempts < 5);
  const counts: Record<string, number> = {};
  const put = (col: string, id: string, data: Record<string, unknown>) => { counts[col] = (counts[col] ?? 0) + 1; void bw.set(db.collection(col).doc(P + id), { ...base, ...data }); };

  // Topics (700): subject → 20 topics → 6 "Year N" subtopics.
  const topicIds: string[] = []; // top-level
  const subsOf = new Map<string, { id: string; subject: string; topic: string; year: string }[]>();
  for (const subject of SUBJECTS) {
    for (let ti = 0; ti < TOPICS_PER_SUBJECT; ti++) {
      const topic = `${subject} topic ${String(ti + 1).padStart(2, "0")}`;
      const tId = `t-${subject}-${ti}`;
      put("hubTopics", tId, { subject, topic, subtopic: null, parentTopicId: null });
      topicIds.push(P + tId);
      subsOf.set(P + tId, []);
      for (const y of YEARS) {
        const sId = `t-${subject}-${ti}-${y.replace(" ", "")}`;
        put("hubTopics", sId, { subject, topic, subtopic: y, parentTopicId: P + tId });
        subsOf.get(P + tId)!.push({ id: P + sId, subject, topic, year: y });
      }
    }
  }

  const allSubs = [...subsOf.values()].flat(); // 600
  // Questions (5,000): 8 per subtopic (4,800) + 2 per top-level topic (200). Mixed kinds.
  const kinds = ["single", "multi", "short", "number", "written"] as const;
  const qByTopic = new Map<string, string[]>(); // top-level topic id → question ids (subtree)
  let qn = 0;
  const mkQ = (topicId: string, rootId: string) => {
    const id = `q-${qn++}`;
    const kind = kinds[qn % kinds.length];
    const opts = ["a", "b", "c", "d"].map((o) => ({ id: o, text: `Option ${o.toUpperCase()} for question ${qn}` }));
    put("hubQuestions", id, {
      topicId, kind, prompt: `Question ${qn}: ${LOREM.slice(0, 120)} What is the answer?`,
      options: kind === "single" || kind === "multi" ? opts : [],
      answer: kind === "single" ? "b" : kind === "multi" ? ["a", "c"] : kind === "short" ? "seven" : kind === "number" ? 7 : null,
      acceptedAnswers: [], tolerance: 0, marks: kind === "written" ? 3 : 1, explanation: `Explanation for ${qn}. ${LOREM.slice(0, 160)}`, published: true, updatedAt: now,
    });
    qByTopic.set(rootId, [...(qByTopic.get(rootId) ?? []), P + id]);
  };
  for (const root of topicIds) {
    for (const sub of subsOf.get(root)!) for (let k = 0; k < 8; k++) mkQ(sub.id, root);
    for (let k = 0; k < 2; k++) mkQ(root, root);
  }

  // Assessments: 450 quizzes (each 24 questions from one topic's tree) + 70 placement papers (24 questions across a subject).
  let an = 0;
  const quizIds: string[] = [];
  const diagBySubject = new Map<string, string[]>();
  for (const root of topicIds) {
    const subject = allSubs.find((x) => subsOf.get(root)!.some((y) => y.id === x.id))!.subject;
    const pool = qByTopic.get(root)!;
    const quizzes = an < 400 ? 4 : 5;
    for (let k = 0; k < quizzes && an < 450; k++) {
      const qids = Array.from({ length: 24 }, (_, i) => pool[(k * 11 + i) % pool.length]);
      const id = `a-quiz-${an++}`;
      const year = YEARS[k % YEARS.length];
      quizIds.push(P + id);
      put("hubAssessments", id, {
        type: "quiz", title: `${subject} quiz ${an} — ${year}`, subject, topicIds: [root], questionIds: [...new Set(qids)], timeLimitMins: null, passMarkPct: 70, published: true,
        audience: { yearGroups: [year], ageMin: null, ageMax: null }, updatedAt: now,
      });
    }
  }
  let dn = 0;
  for (const subject of SUBJECTS) {
    const subjectRoots = topicIds.filter((r) => allSubs.find((x) => subsOf.get(r)!.some((y) => y.id === x.id))!.subject === subject);
    for (let k = 0; k < 14; k++) {
      const qids: string[] = [];
      for (let i = 0; i < 24; i++) { const pool = qByTopic.get(subjectRoots[(k + i) % subjectRoots.length])!; qids.push(pool[(i * 7 + k) % pool.length]); }
      const id = `a-diag-${dn++}`;
      const y1 = YEARS[k % 6];
      const audience = k < 6 ? { yearGroups: [y1], ageMin: null, ageMax: null } : k < 11 ? { yearGroups: [y1, YEARS[(k + 1) % 6]], ageMin: null, ageMax: null } : { yearGroups: [], ageMin: 5 + (k - 11), ageMax: 7 + (k - 11) };
      diagBySubject.set(subject, [...(diagBySubject.get(subject) ?? []), P + id]);
      put("hubAssessments", id, { type: "diagnostic", title: `${subject} placement paper ${k + 1}`, subject, topicIds: [], questionIds: [...new Set(qids)], timeLimitMins: null, passMarkPct: 60, published: true, audience, updatedAt: now });
    }
  }

  // Notes (450 published, 1–3KB) and flashcards (4,500).
  const subIds = allSubs.map((x) => x.id);
  for (let i = 0; i < 450; i++) {
    const t = subIds[(i * 7) % subIds.length];
    put("hubNotes", `n-${i}`, { topicId: t, title: `Note ${i + 1}: worked examples`, body: `## Note ${i + 1}\n\n${LOREM.repeat(1 + (i % 4))}\n\n- point one\n- point two\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n`, published: true, attachments: [], videos: [], createdByName: "Hubload tutor", updatedAt: now });
  }
  for (let i = 0; i < 4500; i++) {
    put("hubFlashcards", `c-${i}`, { topicId: subIds[i % subIds.length], front: `Card ${i + 1}: what is the key term?`, back: `Answer ${i + 1}: ${LOREM.slice(0, 100)}`, published: true, createdByName: "Hubload tutor", updatedAt: now });
  }

  // Students: the real parent's child + 59 fake students, some attempts + mastery.
  const eid = (child: string) => `${tid}__${child}`;
  const kids = [s.childId, ...Array.from({ length: 59 }, (_, i) => `${P}kid-${i}`)];
  kids.forEach((childId, i) => {
    counts.hubEnrolments = (counts.hubEnrolments ?? 0) + 1;
    void bw.set(db.collection("hubEnrolments").doc(eid(childId)), {
      tenantId: tid, franchiseId: null, childId, childName: i === 0 ? "Hubload Kid" : `Student ${i}`, parentUid: i === 0 ? s.parent.uid : `${P}fake-parent-${i}`, parentEmail: i === 0 ? s.parent.email : `${P}p${i}@example.com`,
      subjects: [], tutorUid: s.tutor.uid, tutorName: "Hubload tutor", active: true, yearGroup: YEARS[i % 6], yearGroupAuto: false, createdBy: s.tutor.uid, createdAt: now, updatedAt: now,
    });
  });
  const attemptQ = (qid: string, topicId: string) => ({ id: qid, topicId, kind: "single", mark: "choice", prompt: `Snapshot ${qid} ${LOREM.slice(0, 100)}`, options: ["a", "b", "c", "d"].map((o) => ({ id: o, text: `Option ${o}` })), marks: 1, answer: "b", acceptedAnswers: [], tolerance: 0, explanation: LOREM.slice(0, 150) });
  let at = 0;
  kids.forEach((childId, i) => {
    const n = i === 0 ? 30 : 5;
    for (let k = 0; k < n; k++) {
      const quiz = quizIds[(i * 13 + k * 7) % quizIds.length];
      const root = topicIds[(i + k) % topicIds.length];
      const qs = (qByTopic.get(root) ?? []).slice(0, 24).map((q) => attemptQ(q, root));
      const submittedAt = new Date(Date.now() - (n - k) * 86_400_000).toISOString();
      counts.hubAttempts = (counts.hubAttempts ?? 0) + 1;
      void bw.set(db.collection("hubAttempts").doc(`${P}att-${at++}`), {
        tenantId: tid, franchiseId: null, assessmentId: quiz, assessmentType: "quiz", assessmentTitle: `Quiz ${quiz}`, subject: SUBJECTS[(i + k) % 5], passMarkPct: 70, homeworkId: null, childId, childName: i === 0 ? "Hubload Kid" : `Student ${i}`,
        parentUid: i === 0 ? s.parent.uid : `${P}fake-parent-${i}`, startedBy: s.tutor.uid, submittedBy: s.tutor.uid, startedAt: submittedAt, submittedAt, timeLimitMins: null, late: false, status: "marked", questions: qs,
        answers: qs.map((q) => ({ questionId: q.id, topicId: root, response: "b", correct: true, marksAwarded: 1, marksMax: 1, feedback: "", pending: false })), scoreMarks: 18, maxMarks: 24, pct: 75, byTopic: { [root]: { got: 18, max: 24 } },
        markedBy: "auto", markedAt: submittedAt, baselineReset: false, autoMarks: 18, autoMax: 24, writtenPending: 0, createdBy: s.tutor.uid, createdAt: submittedAt, updatedAt: submittedAt,
      });
      if (k < 3) {
        counts.hubMastery = (counts.hubMastery ?? 0) + 1;
        void bw.set(db.collection("hubMastery").doc(`${tid}__${childId}__${root}`), { tenantId: tid, franchiseId: null, childId, topicId: root, subject: SUBJECTS[(i + k) % 5], masteryPct: 60 + k * 10, band: "Developing", attempts: 3, baselinePct: 50, lastAttemptAt: submittedAt, createdBy: "system", createdAt: now, updatedAt: now });
      }
    }
  });
  for (let g = 0; g < 5; g++) {
    counts.hubGroups = (counts.hubGroups ?? 0) + 1;
    void bw.set(db.collection("hubGroups").doc(`${P}g-${g}`), { ...base, name: `Group ${g + 1}`, colour: "blue", childIds: kids.slice(g * 8, g * 8 + 8), createdByName: "Hubload tutor", updatedAt: now });
  }
  await bw.close();
  s.seeded = counts; s.subjects = SUBJECTS; s.sampleTopicId = topicIds[0]; s.sampleSubtopicId = subsOf.get(topicIds[0])![4].id;
  save(s);
  console.log("seeded", counts);
}

// ── bench ────────────────────────────────────────────────────────────────────
interface Row { name: string; runs: number; min: number; p50: number; p95: number; max: number; bytes: number; wire: number | null; status: number }
const pct = (xs: number[], p: number) => { const a = [...xs].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.ceil((p / 100) * a.length) - 1)]; };

async function timed(name: string, url: string, token: string, runs: number, init?: RequestInit): Promise<Row & { body?: unknown }> {
  const ts: number[] = [];
  let bytes = 0; let wire: number | null = null; let status = 0; let body: unknown;
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    const res = await fetch(`${API}${url}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers } });
    const text = await res.text();
    ts.push(performance.now() - t0);
    status = res.status; bytes = Buffer.byteLength(text);
    const cl = res.headers.get("content-length"); wire = cl && res.headers.get("content-encoding") ? Number(cl) : null;
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { name, runs, min: Math.round(Math.min(...ts)), p50: Math.round(pct(ts, 50)), p95: Math.round(pct(ts, 95)), max: Math.round(Math.max(...ts)), bytes, wire, status, body };
}

async function bench(label: string) {
  const s = load();
  const tutor = (await signIn(s.tutor.email)).idToken;
  const parent = (await signIn(s.parent.email)).idToken;
  const q = `?tenantId=${s.tenantId}`;
  const qc = `${q}&childId=${s.childId}`;
  const H = "/api/learning-hub";
  const rows: Row[] = [];
  const add = async (who: string, name: string, url: string, token: string, runs = 4, init?: RequestInit) => {
    const r = await timed(`${who} ${name}`, url, token, runs, init);
    const { body: _b, ...row } = r; void _b;
    rows.push(row);
    console.log(`${row.name.padEnd(46)} ${String(row.status).padEnd(4)} p50 ${String(row.p50).padStart(6)}ms  p95 ${String(row.p95).padStart(6)}ms  ${(row.bytes / 1024).toFixed(1).padStart(8)} KB${row.wire ? ` (wire ${(row.wire / 1024).toFixed(1)} KB)` : ""}`);
    return r.body;
  };
  const sub = s.sampleSubtopicId!, top = s.sampleTopicId!;

  console.log(`── tutor (${label})`);
  await add("T", "GET /providers", `${H}/providers`, tutor);
  await add("T", "GET /config", `${H}/config`, tutor);
  await add("T", "GET /topics", `${H}/topics`, tutor);
  await add("T", "GET /notes", `${H}/notes`, tutor);
  await add("T", "GET /notes?topicId=", `${H}/notes?topicId=${top}`, tutor);
  const notes = (await timed("x", `${H}/notes?limit=1`, tutor, 1)).body as { items?: { id: string }[] } | { id: string }[];
  const nid = Array.isArray(notes) ? notes[0]?.id : notes.items?.[0]?.id;
  if (nid) await add("T", "GET /notes/:id", `${H}/notes/${nid}`, tutor, 3);
  await add("T", "GET /questions?topicId=<sub>", `${H}/questions?topicId=${sub}`, tutor);
  await add("T", "GET /questions?topicId=<top>", `${H}/questions?topicId=${top}`, tutor);
  await add("T", "GET /questions (no topic)", `${H}/questions`, tutor, 2);
  await add("T", "GET /assessments", `${H}/assessments`, tutor, 3);
  await add("T", "GET /assessments?type=diagnostic", `${H}/assessments?type=diagnostic`, tutor, 3);
  await add("T", "GET /students", `${H}/students`, tutor);
  await add("T", "GET /groups", `${H}/groups`, tutor);
  await add("T", "GET /mastery/overview", `${H}/mastery/overview`, tutor);
  await add("T", "GET /lessons", `${H}/lessons`, tutor);
  await add("T", "GET /homework", `${H}/homework`, tutor);
  await add("T", "GET /flashcards", `${H}/flashcards`, tutor, 2);
  await add("T", "GET /flashcards?topicId=", `${H}/flashcards?topicId=${sub}`, tutor);
  await add("T", "GET /flashcards/stats", `${H}/flashcards/stats`, tutor, 2);
  await add("T", "GET /attempts?childId=", `${H}/attempts?childId=${s.childId}`, tutor);
  await add("T", "GET /mastery?childId=", `${H}/mastery?childId=${s.childId}`, tutor);

  console.log(`── parent (${label})`);
  await add("P", "GET /providers", `${H}/providers`, parent);
  await add("P", "GET /config", `${H}/config${qc}`, parent);
  await add("P", "GET /topics", `${H}/topics${qc}`, parent);
  await add("P", "GET /notes", `${H}/notes${qc}`, parent);
  await add("P", "GET /students", `${H}/students${q}`, parent);
  const asm = (await add("P", "GET /assessments", `${H}/assessments${qc}`, parent, 3)) as { items?: unknown[] } | { id: string; type: string; subject: string }[];
  await add("P", "GET /assessments?type=diagnostic", `${H}/assessments${qc}&type=diagnostic`, parent, 3);
  await add("P", "GET /mastery", `${H}/mastery${qc}`, parent);
  await add("P", "GET /attempts", `${H}/attempts${qc}`, parent);
  await add("P", "GET /flashcards/due", `${H}/flashcards/due${qc}`, parent, 3);
  await add("P", "GET /lessons", `${H}/lessons${qc}`, parent);
  await add("P", "GET /homework", `${H}/homework${qc}`, parent);

  await removeBenchAttempts(s); // a previous run that died mid-way can leave a submitted placement paper behind (it would block the next start)
  // Attempt start + submit of a 24-question placement paper (each run uses a different subject's paper; attempts removed after).
  const all = (Array.isArray(asm) ? asm : (asm as { items: { id: string; type: string; subject: string }[] }).items) as { id: string; type: string; subject: string }[];
  const diags = all.filter((a) => a.type === "diagnostic");
  const bySubj = new Map<string, string>(); for (const d of diags) if (!bySubj.has(d.subject)) bySubj.set(d.subject, d.id);
  const made: string[] = [];
  const startMs: number[] = [], submitMs: number[] = []; let startB = 0, submitB = 0, nq = 0;
  for (const id of [...bySubj.values()].slice(0, 3)) {
    let t0 = performance.now();
    const st = await call<{ attemptId: string; questions: { id: string }[] }>(`${H}/assessments/${id}/attempts${qc}`, parent, { method: "POST", body: JSON.stringify({}) });
    startMs.push(performance.now() - t0); made.push(st.attemptId); nq = st.questions.length; startB = JSON.stringify(st).length;
    t0 = performance.now();
    const sub2 = await call<unknown>(`${H}/attempts/${st.attemptId}/submit${qc}`, parent, { method: "POST", body: JSON.stringify({ answers: st.questions.map((x) => ({ questionId: x.id, response: "b" })) }) });
    submitMs.push(performance.now() - t0); submitB = JSON.stringify(sub2).length;
  }
  for (const [nm, ms, b] of [["P POST attempt start (24q paper)", startMs, startB], ["P POST attempt submit (24q paper)", submitMs, submitB]] as const) {
    if (!ms.length) continue;
    const row: Row = { name: nm, runs: ms.length, min: Math.round(Math.min(...ms)), p50: Math.round(pct(ms, 50)), p95: Math.round(pct(ms, 95)), max: Math.round(Math.max(...ms)), bytes: b, wire: null, status: 200 };
    rows.push(row); console.log(`${nm.padEnd(46)} ${nq}q  p50 ${String(row.p50).padStart(6)}ms  p95 ${String(row.p95).padStart(6)}ms  ${(b / 1024).toFixed(1).padStart(8)} KB`);
  }
  for (const id of made) await db.collection("hubAttempts").doc(id).delete();

  const out = path.join(DIR, `hubload-bench-${label}.json`);
  fs.writeFileSync(out, JSON.stringify({ label, at: new Date().toISOString(), rows }, null, 2));
  console.log(`wrote ${out}`);
}

/** Remove placement-paper attempts the bench made for the parent's child (the seeded attempts are quizzes, so this can't touch them). */
async function removeBenchAttempts(s: State) {
  const snap = await db.collection("hubAttempts").where("tenantId", "==", s.tenantId).where("childId", "==", s.childId).select("assessmentType", "assessmentId").get();
  const bw = db.bulkWriter();
  for (const d of snap.docs) if (d.get("assessmentType") === "diagnostic") void bw.delete(d.ref);
  await bw.close();
}

/** Just the attempt start/submit timings (after a bench aborted before reaching them). */
async function attemptsOnly(label: string) {
  const s = load();
  const parent = (await signIn(s.parent.email)).idToken;
  const qc = `?tenantId=${s.tenantId}&childId=${s.childId}`;
  const H = "/api/learning-hub";
  await removeBenchAttempts(s);
  const list = await call<{ id: string; type: string; subject: string }[]>(`${H}/assessments${qc}&type=diagnostic`, parent);
  const bySubj = new Map<string, string>(); for (const d of list) if (!bySubj.has(d.subject)) bySubj.set(d.subject, d.id);
  const made: string[] = []; const startMs: number[] = [], submitMs: number[] = [];
  for (const id of [...bySubj.values()].slice(0, 3)) {
    let t0 = performance.now();
    const st = await call<{ attemptId: string; questions: { id: string }[] }>(`${H}/assessments/${id}/attempts${qc}`, parent, { method: "POST", body: JSON.stringify({}) });
    startMs.push(performance.now() - t0); made.push(st.attemptId);
    t0 = performance.now();
    await call<unknown>(`${H}/attempts/${st.attemptId}/submit${qc}`, parent, { method: "POST", body: JSON.stringify({ answers: st.questions.map((x) => ({ questionId: x.id, response: "b" })) }) });
    submitMs.push(performance.now() - t0);
  }
  for (const id of made) await db.collection("hubAttempts").doc(id).delete();
  const row = (name: string, ms: number[]): Row => ({ name, runs: ms.length, min: Math.round(Math.min(...ms)), p50: Math.round(pct(ms, 50)), p95: Math.round(pct(ms, 95)), max: Math.round(Math.max(...ms)), bytes: 0, wire: null, status: 200 });
  const rows = [row("P POST attempt start (24q paper)", startMs), row("P POST attempt submit (24q paper)", submitMs)];
  for (const r of rows) console.log(`${r.name.padEnd(46)} p50 ${r.p50}ms p95 ${r.p95}ms`);
  fs.writeFileSync(path.join(DIR, `hubload-bench-${label}.json`), JSON.stringify({ label, rows }, null, 2));
}

function compare(a: string, b: string) {
  const A = JSON.parse(fs.readFileSync(path.join(DIR, `hubload-bench-${a}.json`), "utf8")).rows as Row[];
  const B = JSON.parse(fs.readFileSync(path.join(DIR, `hubload-bench-${b}.json`), "utf8")).rows as Row[];
  const bm = new Map(B.map((r) => [r.name, r]));
  console.log("| endpoint | before p50 | after p50 | before KB | after KB |\n| --- | ---: | ---: | ---: | ---: |");
  for (const r of A) { const x = bm.get(r.name); console.log(`| ${r.name} | ${r.p50} ms | ${x ? `${x.p50} ms` : "—"} | ${(r.bytes / 1024).toFixed(1)} | ${x ? (x.bytes / 1024).toFixed(1) : "—"} |`); }
}

// ── clean ────────────────────────────────────────────────────────────────────
async function clean() {
  if (!fs.existsSync(STATE)) { console.log("no state file — nothing to clean"); return; }
  const s = load();
  const cols = ["hubTopics", "hubNotes", "hubQuestions", "hubAssessments", "hubFlashcards", "hubFlashcardReviews", "hubEnrolments", "hubAttempts", "hubMastery", "hubGroups", "hubHomework", "hubSubmissions", "hubLessons", "hubBoards", "hubPings", "bookings", "listings", "customers", "notifications", "images"];
  const bw = db.bulkWriter();
  let n = 0;
  for (const c of cols) {
    const snap = await db.collection(c).where("tenantId", "==", s.tenantId).select().get();
    for (const d of snap.docs) { void bw.delete(d.ref); n++; }
  }
  await bw.close();
  await db.collection("children").doc(s.childId).delete();
  await db.recursiveDelete(db.collection("libraries").doc(s.tenantId));
  await db.recursiveDelete(db.collection("tenants").doc(s.tenantId));
  for (const u of [s.tutor.uid, s.parent.uid]) await db.recursiveDelete(db.collection("users").doc(u));
  // The HQ bell aggregates "New freelancer signed up" from the tenants collection (gone now); also drop any read/dismissed marker for it.
  const prefsRef = db.collection("platform").doc("notifPrefs");
  const prefs = await prefsRef.get();
  if (prefs.exists) {
    const gone = (id: string) => id.includes(s.tenantId);
    const patch: Record<string, unknown> = {};
    for (const k of ["readIds", "dismissedIds"]) { const arr = prefs.get(k); if (Array.isArray(arr) && arr.some((x) => typeof x === "string" && gone(x))) patch[k] = arr.filter((x) => !(typeof x === "string" && gone(x))); }
    if (Object.keys(patch).length) await prefsRef.update(patch);
  }
  const res = await auth.deleteUsers([s.tutor.uid, s.parent.uid]);
  console.log(`deleted ${n} tenant docs, tenant, ${res.successCount} auth users`);
  fs.unlinkSync(STATE);
}

const [cmd, ...rest] = process.argv.slice(2);
const run = { setup, seed, bench: () => bench(rest[0] ?? "run"), attempts: () => attemptsOnly(rest[0] ?? "attempts"), compare: async () => compare(rest[0], rest[1]), clean }[cmd as "setup"];
if (!run) { console.error("usage: hubLoadTest.ts setup | seed | bench [label] | compare a b | clean"); process.exit(1); }
run().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
