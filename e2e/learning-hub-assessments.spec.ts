import { test, expect } from "@playwright/test";
import { loadAccounts, API_URL, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, provisionLiveListing } from "./helpers/tenantData";

// Learning Hub milestones 3-5, API level: question bank, quizzes + diagnostics,
// server-side marking, answer-key secrecy, diagnostic gating + baseline, mastery,
// tenant isolation. Tutor = the standing "freelancer", family = "parent",
// "company" = a DIFFERENT provider for the cross-tenant checks.

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
let accounts: AccountManifest["accounts"];
const HUB = "/api/learning-hub";

interface Lib { settings?: Record<string, unknown> }
async function editSettings(op: TestAccount, change: (s: Record<string, unknown>) => void) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}) };
  change(settings);
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
const setHub = (op: TestAccount, on: boolean) =>
  editSettings(op, (s) => { s.features = { ...((s.features as Record<string, boolean>) ?? {}), learninghub: on }; });
/** Override settings.hub (null = back to defaults). */
const setHubCfg = (op: TestAccount, hub: Record<string, unknown> | null) => editSettings(op, (s) => { if (hub) s.hub = hub; else delete s.hub; });

const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
async function raw(path: string, idToken: string, init?: RequestInit, retried = false): Promise<{ status: number; body: J; text: string }> {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}`, ...init?.headers } });
  const text = await res.text();
  let body: J = {};
  try { body = JSON.parse(text); } catch { /* not json */ }
  // The standing accounts are shared with other specs that switch the hub off in their teardown —
  // if that lands mid-run, switch it back on and retry once (the assertion under test still runs).
  if (!retried && res.status === 403 && body.code === "feature_off") {
    await setHub(accounts.freelancer, true);
    return raw(path, idToken, init, true);
  }
  return { status: res.status, body, text };
}
const send = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

let tutor = "";
let parent = "";
let other = "";
let tid = "";
let childId = "";
const q = () => `?tenantId=${tid}&childId=${childId}`;
const pq = () => `?tenantId=${tid}`;

const subject = `Maths ${stamp}`;
const ids: Record<string, string> = {};
const opt = (id: string, text: string) => ({ id, text });

/** Answer every question of a started attempt. */
const answersFor = (r: J) => (over: Record<string, unknown>) => r.questions.map((x: J) => ({ questionId: x.id, response: over[x.id] ?? null }));

test.beforeAll(async () => {
  test.setTimeout(240_000);
  accounts = loadAccounts().accounts;
  await setHub(accounts.freelancer, true);
  await setHubCfg(accounts.freelancer, null);
  await setHub(accounts.company, true);
  tutor = await token(accounts.freelancer);
  parent = await token(accounts.parent);
  other = await token(accounts.company);
  tid = accounts.freelancer.tenantId!;

  // The family reaches the hub only through an enrolment of a child booked with the tutor.
  const listing = await provisionLiveListing(accounts.freelancer, { title: `E2E Tutoring ${stamp}`, price: 0 });
  childId = await createParentChild(accounts.parent, { name: `Quizkid ${stamp}` });
  // The standing parent may already have sessions on some days (other specs) — take the first free weekday.
  const days: string[] = [];
  for (let d = new Date(`${listing.runFrom}T12:00:00`); d <= new Date(`${listing.runTo}T12:00:00`); d.setDate(d.getDate() + 1)) {
    if (d.getDay() >= 1 && d.getDay() <= 5) days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  let booked = false;
  for (const day of days.reverse()) {
    try { await bookViaApi(accounts.parent, listing, { child: `Quizkid ${stamp}`, dates: [day] }); booked = true; break; } catch (e) { if (!/clash|between sessions/.test(String(e))) throw e; }
  }
  expect(booked).toBe(true);
  expect((await raw(`${HUB}/students`, tutor, send("POST", { childId }))).status).toBe(201);

  // Taxonomy: Maths → Algebra, Geometry;  Science → Cells;  History → Romans.
  const topic = async (subj: string, name: string) => (await apiPost<{ id: string }>(`${HUB}/topics`, tutor, { subject: subj, topic: name })).id;
  ids.algebra = await topic(subject, "Algebra");
  ids.geometry = await topic(subject, "Geometry");
  ids.cells = await topic(`Science ${stamp}`, "Cells");
  ids.romans = await topic(`History ${stamp}`, "Romans");

  const mk = async (name: string, body: J) => { ids[name] = (await apiPost<{ id: string }>(`${HUB}/questions`, tutor, body)).id; };
  const abc = [opt("a", "Alpha"), opt("b", "Beta"), opt("c", "Gamma")];
  await mk("single", { topicId: ids.algebra, kind: "single", prompt: `Pick beta ${stamp}`, options: abc, answer: "b", marks: 2, explanation: "Because beta." });
  await mk("multi", { topicId: ids.algebra, kind: "multi", prompt: "Pick alpha and gamma", options: abc, answer: ["a", "c"], marks: 2, explanation: "Two of three." });
  await mk("short", { topicId: ids.algebra, kind: "short", prompt: "Who formulated gravity?", answer: "Isaac Newton", acceptedAnswers: ["Newton"], marks: 1 });
  await mk("num", { topicId: ids.algebra, kind: "number", prompt: "Pi to 2dp?", answer: 3.14, tolerance: 0.01, marks: 1 });
  await mk("written", { topicId: ids.algebra, kind: "written", prompt: "Explain factorising", marks: 4 });
  await mk("geo", { topicId: ids.geometry, kind: "single", prompt: "Angles in a triangle sum to?", options: [opt("x", "90"), opt("y", "180")], answer: "y", marks: 2 });
  await mk("draft", { topicId: ids.algebra, kind: "short", prompt: "SECRET DRAFT QUESTION", answer: "nope", marks: 1, published: false });
  await mk("cell", { topicId: ids.cells, kind: "single", prompt: "Powerhouse of the cell?", options: [opt("m", "Mitochondria"), opt("n", "Nucleus")], answer: "m", marks: 1 });
  await mk("roman", { topicId: ids.romans, kind: "short", prompt: "Who was first emperor?", answer: "Augustus", marks: 1 });
});

test.afterAll(async () => {
  await setHubCfg(accounts.freelancer, null);
  await setHub(accounts.freelancer, false);
  await setHub(accounts.company, false);
});

const assessment = (o: J) => ({ type: "quiz", timeLimitMins: null, published: true, ...o });

test.describe("config and the question bank", () => {
  test("GET /config: merged hub settings for tutor and family", async () => {
    const t = (await raw(`${HUB}/config`, tutor)).body;
    expect(t.canEdit).toBe(true);
    expect(t.hub.questionKinds.map((k: J) => k.mark)).toEqual(["choice", "multi", "exact", "numeric", "match", "order", "manual"]); // matching + ordering were added to the defaults
    expect(t.hub.passMarkPct).toBe(70);
    const p = (await raw(`${HUB}/config${pq()}`, parent)).body;
    expect(p.canEdit).toBe(false);
    expect(p.hub.masteryBands.length).toBeGreaterThan(0);
    expect((await raw(`${HUB}/config`, parent)).status).toBe(400);
  });

  test("questions are validated against their kind's marking rule", async () => {
    const base = { topicId: ids.algebra, prompt: "p", marks: 1 };
    const post = (b: J) => raw(`${HUB}/questions`, tutor, send("POST", { ...base, ...b }));
    expect((await post({ kind: "nonsense" })).status).toBe(400);
    expect((await post({ kind: "single", options: [opt("a", "A")], answer: "a" })).status).toBe(400); // <2 options
    expect((await post({ kind: "single", options: [opt("a", "A"), opt("b", "B")], answer: "zzz" })).status).toBe(400);
    expect((await post({ kind: "multi", options: [opt("a", "A"), opt("b", "B")], answer: ["a", "zzz"] })).status).toBe(400);
    expect((await post({ kind: "number", answer: "not a number" })).status).toBe(400);
    expect((await post({ kind: "short" })).status).toBe(400);
    expect((await post({ kind: "single", topicId: "no-such-topic", options: [opt("a", "A"), opt("b", "B")], answer: "a" })).status).toBe(404);
    // ids are generated when omitted
    const r = await post({ kind: "single", options: [{ text: "A" }, { text: "B" }], answer: "x" });
    expect(r.status).toBe(400);
  });

  test("the bank is tutor-only, and lists full questions with their key", async () => {
    expect((await raw(`${HUB}/questions${pq()}`, parent)).status).toBe(403);
    expect((await raw(`${HUB}/questions${pq()}`, parent, send("POST", { topicId: ids.algebra, kind: "short", prompt: "x", answer: "y" }))).status).toBe(403);
    const list = (await raw(`${HUB}/questions?topicId=${ids.algebra}`, tutor)).body as unknown as J[];
    const s = list.find((x) => x.id === ids.single)!;
    expect(s.answer).toBe("b");
    expect(s.explanation).toBe("Because beta.");
    expect(list.some((x) => x.id === ids.geo)).toBe(false); // other topic
  });
});

let quizId = "";
let diagId = "";
let draftQuizId = "";

test.describe("assessments", () => {
  test("authoring rules: subject match, drafts, one published diagnostic", async () => {
    // A quiz can't be published with a draft question…
    const bad = await raw(`${HUB}/assessments`, tutor, send("POST", assessment({ title: "Bad", subject, questionIds: [ids.single, ids.draft] })));
    expect(bad.status).toBe(400);
    // …nor mix subjects.
    expect((await raw(`${HUB}/assessments`, tutor, send("POST", assessment({ title: "Mixed", subject, questionIds: [ids.single, ids.cell] })))).status).toBe(400);
    // …nor be empty when published.
    expect((await raw(`${HUB}/assessments`, tutor, send("POST", assessment({ title: "Empty", subject, questionIds: [] })))).status).toBe(400);
    // A draft may hold anything valid.
    const d = await raw(`${HUB}/assessments`, tutor, send("POST", assessment({ title: `Draft quiz ${stamp}`, subject, questionIds: [ids.single, ids.draft], published: false })));
    expect(d.status).toBe(201);
    draftQuizId = d.body.id;

    const quiz = await raw(`${HUB}/assessments`, tutor, send("POST", assessment({ title: `Algebra quiz ${stamp}`, subject, questionIds: [ids.single, ids.multi, ids.short, ids.num, ids.written] })));
    expect(quiz.status).toBe(201);
    expect(quiz.body.totalMarks).toBe(10);
    expect(quiz.body.passMarkPct).toBe(70); // from settings.hub.passMarkPct
    quizId = quiz.body.id;
    const diag = await raw(`${HUB}/assessments`, tutor, send("POST", assessment({ type: "diagnostic", title: `Maths placement ${stamp}`, subject, questionIds: [ids.single, ids.geo] })));
    expect(diag.status).toBe(201);
    diagId = diag.body.id;
    // One published diagnostic per subject.
    const dup = await raw(`${HUB}/assessments`, tutor, send("POST", assessment({ type: "diagnostic", title: "Second", subject: subject.toUpperCase(), questionIds: [ids.geo] })));
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe("diagnostic_exists");
    // type is immutable
    expect((await raw(`${HUB}/assessments/${quizId}`, tutor, send("PUT", assessment({ type: "diagnostic", title: "x", subject, questionIds: [ids.single] })))).status).toBe(400);
  });

  test("a question used by a published assessment can't be deleted or unpublished; its topic can't be deleted", async () => {
    const del = await raw(`${HUB}/questions/${ids.single}`, tutor, send("DELETE"));
    expect(del.status).toBe(409);
    const single = (await raw(`${HUB}/questions?topicId=${ids.algebra}`, tutor)).body as unknown as J[];
    const s = single.find((x) => x.id === ids.single)!;
    const unpub = await raw(`${HUB}/questions/${ids.single}`, tutor, send("PUT", { ...s, published: false }));
    expect(unpub.status).toBe(409);
    expect((await raw(`${HUB}/topics/${ids.geometry}`, tutor, send("DELETE"))).status).toBe(409);
  });

  test("a family sees published assessments only, as summaries with no questions or keys", async () => {
    const r = await raw(`${HUB}/assessments${q()}`, parent);
    expect(r.status).toBe(200);
    const list = r.body as unknown as J[];
    const titles = list.map((a) => a.title);
    expect(titles).toContain(`Algebra quiz ${stamp}`);
    expect(titles).toContain(`Maths placement ${stamp}`);
    expect(titles).not.toContain(`Draft quiz ${stamp}`);
    const quiz = list.find((a) => a.id === quizId)!;
    expect(quiz.questionCount).toBe(5);
    expect(quiz.totalMarks).toBe(10);
    expect(quiz.questionIds).toBeUndefined();
    expect(quiz.lastAttempt).toBeNull();
    expect(r.text).not.toContain("SECRET DRAFT");
    expect(r.text).not.toMatch(/"answer"|"explanation"|"prompt"/);
    // …and the tutor sees the draft too.
    const t = (await raw(`${HUB}/assessments`, tutor)).body as unknown as J[];
    expect(t.map((a) => a.title)).toContain(`Draft quiz ${stamp}`);
    // filters
    expect(((await raw(`${HUB}/assessments${q()}&type=diagnostic`, parent)).body as unknown as J[]).every((a) => a.type === "diagnostic")).toBe(true);
    expect(((await raw(`${HUB}/assessments${q()}&subject=${encodeURIComponent(`Science ${stamp}`)}`, parent)).body as unknown as J[]).length).toBe(0);
  });

  test("nobody can sit a draft; a family can't use a child that isn't theirs", async () => {
    expect((await raw(`${HUB}/assessments/${draftQuizId}/attempts${q()}`, parent, send("POST", {}))).status).toBe(404);
    const t = await raw(`${HUB}/assessments/${draftQuizId}/attempts`, tutor, send("POST", { childId }));
    expect(t.status).toBe(409);
    expect((await raw(`${HUB}/assessments/${quizId}/attempts?tenantId=${tid}&childId=not-my-child`, parent, send("POST", {}))).status).toBe(404);
    expect((await raw(`${HUB}/assessments/${quizId}/attempts?tenantId=${tid}`, parent, send("POST", {}))).status).toBe(400); // childId required
    expect((await raw(`${HUB}/assessments/${quizId}/attempts${q()}`, parent, send("POST", { homeworkId: "nope" }))).status).toBe(404);
  });
});

let diagAttempt = "";
let quizAttempt1 = "";

test.describe("diagnostic gating and baseline", () => {
  test("requireDiagnostic locks quizzes behind a published diagnostic, until taken", async () => {
    await setHubCfg(accounts.freelancer, { requireDiagnostic: true });
    const list = (await raw(`${HUB}/assessments${q()}`, parent)).body as unknown as J[];
    const quiz = list.find((a) => a.id === quizId)!;
    expect(quiz.locked).toBe(true);
    expect(quiz.lockedReason).toMatch(/diagnostic/i);
    expect(list.find((a) => a.id === diagId)!.done).toBe(false);
    const r = await raw(`${HUB}/assessments/${quizId}/attempts${q()}`, parent, send("POST", {}));
    expect(r.status).toBe(409);
    expect(r.body.code).toBe("diagnostic_required");
  });

  test("the diagnostic attempt never carries the key; submit marks it server-side", async () => {
    const start = await raw(`${HUB}/assessments/${diagId}/attempts${q()}`, parent, send("POST", {}));
    expect(start.status).toBe(201);
    expect(start.text).not.toMatch(/"answer"|"explanation"|"correct"|"acceptedAnswers"|"tolerance"/);
    diagAttempt = start.body.attemptId;
    expect(start.body.questions).toHaveLength(2);
    // Resuming returns the same attempt, still keyless.
    const again = await raw(`${HUB}/assessments/${diagId}/attempts${q()}`, parent, send("POST", {}));
    expect(again.body.attemptId).toBe(diagAttempt);
    expect(again.body.resumed).toBe(true);
    // A running attempt reveals nothing, not even to its family via GET.
    const running = await raw(`${HUB}/attempts/${diagAttempt}${pq()}&childId=${childId}`, parent);
    expect(running.body.status).toBe("in_progress");
    expect(running.text).not.toMatch(/"answer"|"explanation"|"correctAnswer"/);

    // single: wrong ("a"), geo: right ("y")  → 2/4 = 50%
    const sub = await raw(`${HUB}/attempts/${diagAttempt}/submit${pq()}`, parent, send("POST", { answers: answersFor(start.body)({ [ids.single]: "a", [ids.geo]: "y" }) }));
    expect(sub.status).toBe(200);
    expect(sub.body).toMatchObject({ status: "marked", scoreMarks: 2, maxMarks: 4, pct: 50, passed: false });
    expect(sub.body.byTopic[ids.algebra]).toEqual({ got: 0, max: 2 });
    expect(sub.body.byTopic[ids.geometry]).toEqual({ got: 2, max: 2 });
    // default revealAnswers = after_pass (changed from after_submit): this attempt FAILED (50% < the pass mark), so the family sees which
    // answers were wrong but NOT the key or the explanations — the result says why (keyHeld) — while the tutor still sees everything.
    const a1 = sub.body.answers.find((a: J) => a.questionId === ids.single);
    expect(a1).toMatchObject({ correct: false, marksAwarded: 0 });
    expect(sub.body.keyHeld).toBe(true);
    expect(sub.text).not.toMatch(/"correctAnswer"|"explanation"|Because beta/);
    const tutorView = await raw(`${HUB}/attempts/${diagAttempt}`, tutor);
    expect(tutorView.body.keyHeld).toBeUndefined();
    expect(tutorView.body.answers.find((a: J) => a.questionId === ids.single)).toMatchObject({ correctAnswer: "b", explanation: "Because beta." });
    // submitting twice is refused
    expect((await raw(`${HUB}/attempts/${diagAttempt}/submit${pq()}`, parent, send("POST", { answers: [] }))).status).toBe(409);
    // a diagnostic already taken can't be started again
    const dup = await raw(`${HUB}/assessments/${diagId}/attempts${q()}`, parent, send("POST", {}));
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe("diagnostic_done");
  });

  test("the diagnostic sets the baseline but not mastery or the trend; quizzes are unlocked", async () => {
    const m = (await raw(`${HUB}/mastery${q()}`, parent)).body;
    const maths = m.subjects.find((s: J) => s.subject === subject);
    expect(maths.baselinePct).toBe(50); // mean(0, 100)
    expect(maths.masteryPct).toBeNull();
    expect(maths.growthPct).toBeNull();
    expect(maths.coverage).toBe(0);
    const alg = maths.topics.find((t: J) => t.topicId === ids.algebra);
    expect(alg).toMatchObject({ baselinePct: 0, masteryPct: null, attempts: 0 });
    expect(m.trend).toEqual([]);
    const list = (await raw(`${HUB}/assessments${q()}`, parent)).body as unknown as J[];
    expect(list.find((a) => a.id === quizId)!.locked).toBe(false);
    expect(list.find((a) => a.id === diagId)).toMatchObject({ done: true });
    await setHubCfg(accounts.freelancer, null);
  });
});

test.describe("a quiz: marking, manual marks, mastery", () => {
  test("submit: every auto rule is marked, the written answer waits for the tutor", async () => {
    const start = await raw(`${HUB}/assessments/${quizId}/attempts${q()}`, parent, send("POST", {}));
    expect(start.status).toBe(201);
    expect(start.body.questions).toHaveLength(5);
    expect(start.body.questions.map((x: J) => x.id)).toEqual([ids.single, ids.multi, ids.short, ids.num, ids.written]); // assessment order
    expect(start.text).not.toMatch(/"answer"|"explanation"|"correct"|SECRET DRAFT/);
    const opts = start.body.questions[0].options as J[];
    expect(opts.every((o) => Object.keys(o).sort().join() === "id,text")).toBe(true);
    expect(start.body.questions[2].options).toBeUndefined();
    quizAttempt1 = start.body.attemptId;

    const sub = await raw(`${HUB}/attempts/${quizAttempt1}/submit${pq()}`, parent, send("POST", {
      answers: answersFor(start.body)({ [ids.single]: "b", [ids.multi]: ["c", "a"], [ids.short]: "  newton ", [ids.num]: "3.15", [ids.written]: "Find two numbers that multiply to c" }),
    }));
    expect(sub.status).toBe(200);
    // 2+2+1+1 = 6 awarded of the 6 marks counted so far → 100%; the 4 written marks are pending.
    expect(sub.body).toMatchObject({ status: "pending_marking", scoreMarks: 6, maxMarks: 10, pct: 100, passed: null });
    const by = (id: string) => sub.body.answers.find((a: J) => a.questionId === id);
    expect(by(ids.single)).toMatchObject({ correct: true, marksAwarded: 2 });
    expect(by(ids.multi)).toMatchObject({ correct: true, marksAwarded: 2 });
    expect(by(ids.short)).toMatchObject({ correct: true, marksAwarded: 1 });
    expect(by(ids.num)).toMatchObject({ correct: true, marksAwarded: 1 });
    expect(by(ids.written)).toMatchObject({ correct: null, marksAwarded: 0 });
    // Not yet marked → not in mastery.
    const m = (await raw(`${HUB}/mastery${q()}`, parent)).body;
    expect(m.trend).toEqual([]);
    expect(m.subjects.find((s: J) => s.subject === subject).masteryPct).toBeNull();
  });

  test("a family can't mark; the tutor sees who's waiting and marks it", async () => {
    const mark = { answers: [{ questionId: ids.written, marksAwarded: 2, feedback: "Good start" }] };
    expect((await raw(`${HUB}/attempts/${quizAttempt1}/mark${pq()}`, parent, send("PUT", mark))).status).toBe(403);
    // Tutor list: pending
    const list = (await raw(`${HUB}/attempts?childId=${childId}`, tutor)).body as unknown as J[];
    expect(list.find((a) => a.id === quizAttempt1)).toMatchObject({ status: "pending_marking", passed: null });
    // Tutor sees the (unrevealed-to-family) detail incl. pending flag and key
    const detail = (await raw(`${HUB}/attempts/${quizAttempt1}`, tutor)).body;
    expect(detail.answers.find((a: J) => a.questionId === ids.written)).toMatchObject({ pending: true, response: "Find two numbers that multiply to c", prompt: "Explain factorising" });
    // Over-max and unknown answers are refused.
    expect((await raw(`${HUB}/attempts/${quizAttempt1}/mark`, tutor, send("PUT", { answers: [{ questionId: ids.written, marksAwarded: 5 }] }))).status).toBe(400);
    expect((await raw(`${HUB}/attempts/${quizAttempt1}/mark`, tutor, send("PUT", { answers: [{ questionId: "nope", marksAwarded: 1 }] }))).status).toBe(400);
    const done = await raw(`${HUB}/attempts/${quizAttempt1}/mark`, tutor, send("PUT", mark));
    expect(done.status).toBe(200);
    // 6 + 2 = 8 of 10 → 80% → passes the 70% mark
    expect(done.body).toMatchObject({ status: "marked", scoreMarks: 8, maxMarks: 10, pct: 80, passed: true });
    // The family sees the mark + feedback
    const fam = (await raw(`${HUB}/attempts/${quizAttempt1}${pq()}&childId=${childId}`, parent)).body;
    expect(fam.answers.find((a: J) => a.questionId === ids.written)).toMatchObject({ correct: false, marksAwarded: 2, feedback: "Good start" });
  });

  test("mastery: 80% → Secure; baseline + growth; coverage; trend", async () => {
    const m = (await raw(`${HUB}/mastery${q()}`, parent)).body;
    const maths = m.subjects.find((s: J) => s.subject === subject);
    const alg = maths.topics.find((t: J) => t.topicId === ids.algebra);
    expect(alg).toMatchObject({ masteryPct: 80, band: "Secure", attempts: 1, baselinePct: 0 });
    expect(maths).toMatchObject({ masteryPct: 80, band: "Secure", baselinePct: 50, growthPct: 80 });
    expect(maths.coverage).toBe(0.5); // Algebra attempted; Geometry has published questions but no quiz slice
    expect(m.trend).toHaveLength(1);
    expect(m.trend[0]).toMatchObject({ pct: 80, subject, title: `Algebra quiz ${stamp}` });
  });

  test("a second attempt is weighted 0.5^i, newest first; the diagnostic never counts", async () => {
    const start = await raw(`${HUB}/assessments/${quizId}/attempts${q()}`, parent, send("POST", {}));
    // Everything blank: the blank written answer is worth 0 and does NOT wait for a tutor.
    const sub = await raw(`${HUB}/attempts/${start.body.attemptId}/submit${pq()}`, parent, send("POST", { answers: [] }));
    expect(sub.body).toMatchObject({ status: "marked", scoreMarks: 0, pct: 0, passed: false });
    // slices newest first: 0/10, 8/10 → (0 + 0.5×0.8) / 1.5 = 26.67 → 27
    const m = (await raw(`${HUB}/mastery${q()}`, parent)).body;
    const maths = m.subjects.find((s: J) => s.subject === subject);
    expect(maths.topics.find((t: J) => t.topicId === ids.algebra)).toMatchObject({ masteryPct: 27, band: "Learning", attempts: 2 });
    expect(m.trend.map((t: J) => t.pct)).toEqual([80, 0]); // oldest → newest
    // Attempt list: newest first, no answers/keys for the family
    const list = await raw(`${HUB}/attempts${q()}`, parent);
    const rows = list.body as unknown as J[];
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0].pct).toBe(0);
    expect(list.text).not.toMatch(/"answers"|"correctAnswer"|"explanation"/);
    expect((await raw(`${HUB}/attempts${q()}&assessmentId=${diagId}`, parent)).body).toHaveLength(1);
  });

  test("overview + recompute agree with the dashboard", async () => {
    const before = (await raw(`${HUB}/mastery${q()}`, parent)).body.subjects.find((s: J) => s.subject === subject).masteryPct;
    expect((await raw(`${HUB}/mastery/recompute${pq()}`, parent, send("POST", {}))).status).toBe(403);
    expect((await raw(`${HUB}/mastery/recompute`, tutor, send("POST", { childId }))).body.ok).toBe(true);
    const ov = (await raw(`${HUB}/mastery/overview`, tutor)).body;
    const me = ov.students.find((s: J) => s.childId === childId);
    expect(me.subjects.find((s: J) => s.subject === subject)).toMatchObject({ masteryPct: before, band: "Learning" });
    expect(me.lastActive).toBeTruthy();
    expect((await raw(`${HUB}/mastery/overview${pq()}`, parent)).status).toBe(403);
  });
});

test.describe("revealing answers follows settings.hub.revealAnswers", () => {
  test("never: a marked attempt shows scores but no key; a tutor still sees it", async () => {
    await setHubCfg(accounts.freelancer, { revealAnswers: "never" });
    const fam = await raw(`${HUB}/attempts/${quizAttempt1}${pq()}&childId=${childId}`, parent);
    expect(fam.body.answers.length).toBe(5);
    expect(fam.text).not.toMatch(/"correctAnswer"|"explanation"|Because beta/);
    const t = await raw(`${HUB}/attempts/${quizAttempt1}`, tutor);
    expect(t.text).toContain("correctAnswer");
  });

  test("after_marked: hidden while pending, shown once the tutor marks", async () => {
    await setHubCfg(accounts.freelancer, { revealAnswers: "after_marked" });
    const start = await raw(`${HUB}/assessments/${quizId}/attempts${q()}`, parent, send("POST", {}));
    const id = start.body.attemptId;
    const sub = await raw(`${HUB}/attempts/${id}/submit${pq()}`, parent, send("POST", { answers: answersFor(start.body)({ [ids.single]: "b", [ids.written]: "words" }) }));
    expect(sub.body.status).toBe("pending_marking");
    expect(sub.text).not.toMatch(/"correctAnswer"|"explanation"/);
    await raw(`${HUB}/attempts/${id}/mark`, tutor, send("PUT", { answers: [{ questionId: ids.written, marksAwarded: 4 }] }));
    const after = await raw(`${HUB}/attempts/${id}${pq()}&childId=${childId}`, parent);
    expect(after.body.status).toBe("marked");
    expect(after.text).toContain("Because beta.");
    await setHubCfg(accounts.freelancer, null);
  });
});

test.describe("retaking a diagnostic, and waivers", () => {
  test("reset-baseline: tutor only; the retake sets the baseline again, once", async () => {
    expect((await raw(`${HUB}/attempts/${diagAttempt}/reset-baseline${pq()}`, parent, send("POST", {}))).status).toBe(403);
    expect((await raw(`${HUB}/attempts/${quizAttempt1}/reset-baseline`, tutor, send("POST", {}))).status).toBe(409); // not a diagnostic
    expect((await raw(`${HUB}/attempts/${diagAttempt}/reset-baseline`, tutor, send("POST", {}))).body.ok).toBe(true);
    let m = (await raw(`${HUB}/mastery${q()}`, parent)).body.subjects.find((s: J) => s.subject === subject);
    expect(m.baselinePct).toBeNull();
    const list = (await raw(`${HUB}/assessments${q()}`, parent)).body as unknown as J[];
    expect(list.find((a) => a.id === diagId)!.done).toBe(false);

    const start = await raw(`${HUB}/assessments/${diagId}/attempts${q()}`, parent, send("POST", {}));
    expect(start.status).toBe(201);
    const sub = await raw(`${HUB}/attempts/${start.body.attemptId}/submit${pq()}`, parent, send("POST", { answers: answersFor(start.body)({ [ids.single]: "b", [ids.geo]: "y" }) }));
    expect(sub.body.pct).toBe(100);
    m = (await raw(`${HUB}/mastery${q()}`, parent)).body.subjects.find((s: J) => s.subject === subject);
    expect(m.baselinePct).toBe(100);
    // once again taken → refused
    expect((await raw(`${HUB}/assessments/${diagId}/attempts${q()}`, parent, send("POST", {}))).status).toBe(409);
  });

  test("a waiver lifts the lock; with no published diagnostic there is no lock", async () => {
    // Science: a diagnostic AND a quiz. History: only a quiz.
    const sciDiag = await raw(`${HUB}/assessments`, tutor, send("POST", assessment({ type: "diagnostic", title: `Sci placement ${stamp}`, subject: `Science ${stamp}`, questionIds: [ids.cell] })));
    const sciQuiz = await raw(`${HUB}/assessments`, tutor, send("POST", assessment({ title: `Sci quiz ${stamp}`, subject: `Science ${stamp}`, questionIds: [ids.cell] })));
    const hisQuiz = await raw(`${HUB}/assessments`, tutor, send("POST", assessment({ title: `Roman quiz ${stamp}`, subject: `History ${stamp}`, questionIds: [ids.roman] })));
    expect([sciDiag.status, sciQuiz.status, hisQuiz.status]).toEqual([201, 201, 201]);
    await setHubCfg(accounts.freelancer, { requireDiagnostic: true });
    const locked = await raw(`${HUB}/assessments/${sciQuiz.body.id}/attempts${q()}`, parent, send("POST", {}));
    expect(locked.status).toBe(409);
    expect(locked.body.code).toBe("diagnostic_required");
    // History has no diagnostic → nothing to unlock
    expect((await raw(`${HUB}/assessments/${hisQuiz.body.id}/attempts${q()}`, parent, send("POST", {}))).status).toBe(201);
    // Parents can't waive; the tutor can.
    expect((await raw(`${HUB}/students/${childId}/diagnostic-waive${pq()}`, parent, send("POST", { subject: `Science ${stamp}` }))).status).toBe(403);
    const w = await raw(`${HUB}/students/${childId}/diagnostic-waive`, tutor, send("POST", { subject: `Science ${stamp}` }));
    expect(w.body.waived).toContain(`science ${stamp}`);
    expect((await raw(`${HUB}/assessments/${sciQuiz.body.id}/attempts${q()}`, parent, send("POST", {}))).status).toBe(201);
    await setHubCfg(accounts.freelancer, null);
  });
});

test.describe("history is snapshotted, tutors can start on behalf", () => {
  test("editing a question mid-attempt doesn't change how that attempt is marked", async () => {
    // Tutor starts a quiz for the student…
    const start = await raw(`${HUB}/assessments/${quizId}/attempts`, tutor, send("POST", { childId }));
    expect(start.status).toBe(201);
    expect(start.text).not.toMatch(/"answer"|"explanation"/);
    // …then edits the question: answer → "a", marks 2 → 3.
    const s = ((await raw(`${HUB}/questions?topicId=${ids.algebra}`, tutor)).body as unknown as J[]).find((x) => x.id === ids.single)!;
    expect((await raw(`${HUB}/questions/${ids.single}`, tutor, send("PUT", { ...s, answer: "a", marks: 3 }))).status).toBe(200);
    // The parent submits "b": still right, still worth 2.
    const sub = await raw(`${HUB}/attempts/${start.body.attemptId}/submit${pq()}`, parent, send("POST", { answers: answersFor(start.body)({ [ids.single]: "b" }) }));
    expect(sub.status).toBe(200);
    expect(sub.body.answers.find((a: J) => a.questionId === ids.single)).toMatchObject({ correct: true, marksAwarded: 2, marksMax: 2 });
    // (the paper as a whole isn't passed, so the family's copy holds the key back under the default after_pass; the tutor's copy has it)
    expect((await raw(`${HUB}/attempts/${start.body.attemptId}`, tutor)).body.answers.find((a: J) => a.questionId === ids.single).correctAnswer).toBe("b");
    // restore
    await raw(`${HUB}/questions/${ids.single}`, tutor, send("PUT", { ...s }));
  });
});

test.describe("tenant isolation", () => {
  test("another provider's tutor sees none of it and can't touch it (404s, never 403s)", async () => {
    // Lists never contain our rows.
    expect(JSON.stringify((await raw(`${HUB}/questions`, other)).body)).not.toContain(ids.single);
    expect(JSON.stringify((await raw(`${HUB}/assessments`, other)).body)).not.toContain(quizId);
    expect(((await raw(`${HUB}/attempts`, other)).body as unknown as J[]).some((a) => a.childId === childId)).toBe(false);
    expect(((await raw(`${HUB}/mastery/overview`, other)).body.students as J[]).some((s) => s.childId === childId)).toBe(false);
    // By id: 404.
    const okQ = { topicId: ids.algebra, kind: "short", prompt: "x", answer: "y" };
    expect((await raw(`${HUB}/questions/${ids.single}`, other, send("PUT", okQ))).status).toBe(404);
    expect((await raw(`${HUB}/questions/${ids.single}`, other, send("DELETE"))).status).toBe(404);
    expect((await raw(`${HUB}/questions`, other, send("POST", okQ))).status).toBe(404); // our topic
    expect((await raw(`${HUB}/questions?topicId=${ids.algebra}`, other)).status).toBe(404);
    const body = { type: "quiz", title: "x", subject, questionIds: [ids.single], published: true };
    expect((await raw(`${HUB}/assessments/${quizId}`, other, send("PUT", body))).status).toBe(404);
    expect((await raw(`${HUB}/assessments/${quizId}`, other, send("DELETE"))).status).toBe(404);
    expect((await raw(`${HUB}/assessments/${quizId}/attempts`, other, send("POST", { childId }))).status).toBe(404);
    expect((await raw(`${HUB}/attempts/${quizAttempt1}`, other)).status).toBe(404);
    expect((await raw(`${HUB}/attempts/${quizAttempt1}/mark`, other, send("PUT", { answers: [{ questionId: ids.written, marksAwarded: 0 }] }))).status).toBe(404);
    expect((await raw(`${HUB}/attempts/${diagAttempt}/reset-baseline`, other, send("POST", {}))).status).toBe(404);
    expect((await raw(`${HUB}/attempts/${quizAttempt1}/submit`, other, send("POST", { answers: [] }))).status).toBe(404);
    expect((await raw(`${HUB}/mastery?childId=${childId}`, other)).status).toBe(404);
    expect((await raw(`${HUB}/students/${childId}/diagnostic-waive`, other, send("POST", { subject }))).status).toBe(404);
    // A family can't reach a provider it isn't enrolled with, and can't read our data as another tenant.
    const ot = accounts.company.tenantId!;
    expect((await raw(`${HUB}/assessments?tenantId=${ot}&childId=${childId}`, parent)).status).toBe(404);
    expect((await raw(`${HUB}/attempts/${quizAttempt1}?tenantId=${ot}`, parent)).status).toBe(404);
    // Still intact for the owner.
    expect((await raw(`${HUB}/attempts/${quizAttempt1}`, tutor)).status).toBe(200);
  });

  test("a family can't see an attempt through another child or a missing scope", async () => {
    expect((await raw(`${HUB}/attempts/${quizAttempt1}?tenantId=${tid}&childId=someone-else`, parent)).status).toBe(404);
    expect((await raw(`${HUB}/mastery?tenantId=${tid}&childId=someone-else`, parent)).status).toBe(404);
    expect((await raw(`${HUB}/attempts/${quizAttempt1}`, parent)).status).toBe(400); // no ?tenantId
  });

  test("an assessment with attempts can't be deleted; an unused one can", async () => {
    const del = await raw(`${HUB}/assessments/${quizId}`, tutor, send("DELETE"));
    expect(del.status).toBe(409);
    expect((await raw(`${HUB}/assessments/${draftQuizId}`, tutor, send("DELETE"))).status).toBe(200);
  });
});
