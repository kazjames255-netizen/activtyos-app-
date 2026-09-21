import { test, expect } from "@playwright/test";
import { loadAccounts, API_URL, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { ageInYears, ukYearGroup } from "../server/src/lib/hubRules";
import { HUB_DEFAULTS } from "../lib/hubConfig";

// Learning Hub round 3, API level: year group / audience on assessments (incl. one
// placement test per audience), pictures on questions, retake control, auto vs
// written marking, real attainment level, PUT /config, student groups, YouTube
// videos. Tutor = the standing "freelancer", family = "parent", "company" = a
// DIFFERENT provider (its "staff" account is the staff member).

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

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
const setHub = (op: TestAccount, on: boolean) => editSettings(op, (s) => { s.features = { ...((s.features as Record<string, boolean>) ?? {}), learninghub: on }; });
const resetHubCfg = (op: TestAccount) => editSettings(op, (s) => { delete s.hub; });

const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
/** The dev API hot-reloads (tsx watch) whenever a server file is saved — ride out a restart. */
async function net<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= 6 || !(e instanceof TypeError)) throw e;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
async function raw(path: string, idToken: string, init?: RequestInit, retried = false): Promise<{ status: number; body: J; text: string }> {
  const res = await net(() => fetch(`${API_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}`, ...init?.headers } }));
  const text = await res.text();
  let body: J = {};
  try { body = JSON.parse(text); } catch { /* not json */ }
  // Other hub specs switch the shared accounts' hub off in their teardown — switch it back on once and retry.
  if (!retried && res.status === 403 && body.code === "feature_off") {
    await setHub(accounts.freelancer, true);
    await setHub(accounts.company, true);
    return raw(path, idToken, init, true);
  }
  return { status: res.status, body, text };
}
const send = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

let tutor = "", parent = "", other = "", staff = "";
let tid = "";
let childA = "", childB = "", childC = "", childD = "";
const dobA = "2016-03-14";
const ygA = ukYearGroup(dobA) as string;
const ageA = ageInYears(dobA) as number;
const ygOther = HUB_DEFAULTS.yearGroups.find((g) => g !== ygA) as string;
const pq = () => `?tenantId=${tid}`;
const qa = (c: string) => `?tenantId=${tid}&childId=${c}`;

const S1 = `Maths ${stamp}`;
const ids: Record<string, string> = {};
const opt = (id: string, text: string, image?: string) => ({ id, text, ...(image ? { image: { id: image } } : {}) });
const abc = [opt("a", "Alpha"), opt("b", "Beta"), opt("c", "Gamma")];

const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const GOOD_PDF = `data:application/pdf;base64,${Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n").toString("base64")}`;
const YT = "dQw4w9WgXcQ";
const YT2 = "9bZkp7q19f0";

async function upload(idToken: string, dataUrl: string, extra: J = { purpose: "private", kind: "hub" }): Promise<string> {
  const r = await raw("/api/uploads", idToken, send("POST", { dataUrl, ...extra }));
  expect(r.status, r.text).toBe(201);
  return r.body.id as string;
}

async function newQuiz(title: string, over: J = {}): Promise<string> {
  const r = await raw(`${HUB}/assessments`, tutor, send("POST", { type: "quiz", title: `${title} ${stamp}`, subject: S1, questionIds: [ids.single, ids.short], published: true, ...over }));
  expect(r.status, r.text).toBe(201);
  return r.body.id as string;
}
const listFor = async (child: string, query = "") => (await raw(`${HUB}/assessments${qa(child)}${query}`, parent)).body as unknown as J[];
const start = (asmId: string, child: string) => raw(`${HUB}/assessments/${asmId}/attempts${qa(child)}`, parent, send("POST", {}));
/** Answer nothing (or `over`) and submit. */
async function submit(attemptId: string, questions: J[], over: Record<string, unknown> = {}) {
  const r = await raw(`${HUB}/attempts/${attemptId}/submit${pq()}`, parent, send("POST", { answers: questions.map((x) => ({ questionId: x.id, response: over[x.id] ?? null })) }));
  expect(r.status, r.text).toBe(200);
  return r.body;
}
async function takeAndSubmit(asmId: string, child: string) {
  const s = await start(asmId, child);
  expect(s.status, s.text).toBe(201);
  return submit(s.body.attemptId, s.body.questions);
}

test.beforeAll(async () => {
  test.setTimeout(300_000);
  accounts = loadAccounts().accounts;
  await setHub(accounts.freelancer, true);
  await setHub(accounts.company, true);
  await resetHubCfg(accounts.freelancer);
  await resetHubCfg(accounts.company);
  [tutor, parent, other, staff] = await Promise.all([token(accounts.freelancer), token(accounts.parent), token(accounts.company), token(accounts.staff)]);
  tid = accounts.freelancer.tenantId!;

  await provisionLiveListing(accounts.freelancer, { title: `E2E Tutoring ${stamp}`, price: 0 }); // "follow" needs the provider to publish something
  childA = await createParentChild(accounts.parent, { name: `Ava ${stamp}`, dob: dobA });
  childB = (await apiPost<{ id: string }>("/api/my/children", parent, { name: `Ben ${stamp}`, age: 8 })).id; // NO date of birth
  childC = await createParentChild(accounts.parent, { name: `Cal ${stamp}`, dob: "2018-05-14" });
  childD = await createParentChild(accounts.parent, { name: `Dee ${stamp}`, dob: "2017-01-20" }); // never enrolled
  await apiPost("/api/my/providers/follow", parent, { tenantId: tid });
  await markParentWelcomed(accounts.parent);
  for (const c of [childA, childB, childC]) expect((await raw(`${HUB}/students`, tutor, send("POST", { childId: c }))).status).toBeLessThan(300);

  const topic = async (subj: string, name: string) => (await apiPost<{ id: string }>(`${HUB}/topics`, tutor, { subject: subj, topic: name })).id;
  ids.algebra = await topic(S1, "Algebra");
  ids.basics = await topic(`Placement ${stamp}`, "Basics");
  ids.solo = await topic(`Solo ${stamp}`, "Sums");
  const mk = async (name: string, body: J) => { const r = await raw(`${HUB}/questions`, tutor, send("POST", body)); expect(r.status, r.text).toBe(201); ids[name] = r.body.id as string; };
  await mk("single", { topicId: ids.algebra, kind: "single", prompt: `Pick beta ${stamp}`, options: abc, answer: "b", marks: 2, explanation: "Because beta." });
  await mk("short", { topicId: ids.algebra, kind: "short", prompt: "Who formulated gravity?", answer: "Isaac Newton", acceptedAnswers: ["Newton"], marks: 1 });
  await mk("written", { topicId: ids.algebra, kind: "written", prompt: "Explain factorising", marks: 4 });
  await mk("placement", { topicId: ids.basics, kind: "single", prompt: "1+1?", options: [opt("x", "1"), opt("y", "2")], answer: "y", marks: 1 });
  await mk("soloQ", { topicId: ids.solo, kind: "single", prompt: "2+2?", options: [opt("x", "3"), opt("y", "4")], answer: "y", marks: 1 });
});

test.afterAll(async () => {
  await resetHubCfg(accounts.freelancer);
  await resetHubCfg(accounts.company);
  await setHub(accounts.freelancer, false);
  await setHub(accounts.company, false);
});

// ── 6. config ────────────────────────────────────────────────────────────────
test.describe("config: GET and PUT", () => {
  test("GET /config gives the settings, sorted bands, limits and group colours to tutor and family", async () => {
    const t = (await raw(`${HUB}/config`, tutor)).body;
    expect(t.canEdit).toBe(true);
    expect(t.hub.retakePolicy).toBe("unlimited");
    expect(t.hub.yearGroups).toContain(ygA);
    expect(t.bands.map((b: J) => b.label)).toEqual(["Learning", "Developing", "Secure"]);
    expect(t.limits.bands).toMatchObject({ min: 2, max: 8 });
    expect(t.limits.maxVideos).toBe(6);
    expect(t.groupColours).toContain("blue");
    const p = (await raw(`${HUB}/config${pq()}`, parent)).body;
    expect(p.canEdit).toBe(false);
    expect(p.bands.length).toBe(3);
  });

  test("PUT /config validates every rule and is tutor-only", async () => {
    const put = (hub: unknown, t = tutor, qs = "") => raw(`${HUB}/config${qs}`, t, send("PUT", { hub }));
    const bands = (n: number) => Array.from({ length: n }, (_, i) => ({ min: i * 10, label: `L${i}` }));
    expect((await put({ passMarkPct: 60 }, parent, pq())).status).toBe(403);
    for (const bad of [
      { masteryBands: [{ min: 0, label: "Only one" }] }, { masteryBands: bands(9) },
      { masteryBands: [{ min: 10, label: "A" }, { min: 50, label: "B" }] }, // first min must be 0
      { masteryBands: [{ min: 0, label: "A" }, { min: 50, label: "B" }, { min: 50, label: "C" }] }, // not unique / ascending
      { masteryBands: [{ min: 0, label: "A" }, { min: 60, label: "B" }, { min: 40, label: "C" }] },
      { masteryBands: [{ min: 0, label: "" }, { min: 50, label: "B" }] }, { masteryBands: [{ min: 0, label: "x".repeat(25) }, { min: 50, label: "B" }] },
      { passMarkPct: 101 }, { passMarkPct: -1 }, { retakeCooldownHours: 0 }, { retakeCooldownHours: 721 }, { retakePolicy: "twice" },
      { yearGroups: Array.from({ length: 31 }, (_, i) => `G${i}`) }, { yearGroups: ["x".repeat(25)] }, { yearGroups: [] },
      { questionKinds: [] }, { somethingElse: 1 }, {},
    ]) expect((await put(bad)).status, JSON.stringify(bad)).toBe(400);
    expect((await raw(`${HUB}/config`, tutor, send("PUT", {}))).status).toBe(400);
    // still the defaults after all that
    expect((await raw(`${HUB}/config`, tutor)).body.bands.length).toBe(3);

    const ok = await put({ retakePolicy: "cooldown", retakeCooldownHours: 12, passMarkPct: 60, yearGroups: [...HUB_DEFAULTS.yearGroups, "Grade 8"] });
    expect(ok.status, ok.text).toBe(200);
    expect(ok.body.hub).toMatchObject({ retakePolicy: "cooldown", retakeCooldownHours: 12, passMarkPct: 60 });
    expect(ok.body.retakePolicy).toBe("cooldown");
    const g = (await raw(`${HUB}/config`, tutor)).body.hub;
    expect(g).toMatchObject({ retakePolicy: "cooldown", retakeCooldownHours: 12, passMarkPct: 60 });
    expect(g.yearGroups).toContain("Grade 8");
    // a different provider is untouched
    expect((await raw(`${HUB}/config`, other)).body.hub).toMatchObject({ retakePolicy: "unlimited", passMarkPct: 70 });
    // …and back
    expect((await put({ retakePolicy: "unlimited", retakeCooldownHours: 24, passMarkPct: 70, yearGroups: HUB_DEFAULTS.yearGroups })).status).toBe(200);
  });

  test("a staff member (default permissions) can change their provider's settings, and only theirs", async () => {
    const r = await raw(`${HUB}/config`, staff, send("PUT", { hub: { passMarkPct: 65 } }));
    expect(r.status, r.text).toBe(200);
    expect((await raw(`${HUB}/config`, other)).body.hub.passMarkPct).toBe(65); // staff belong to the "company" provider
    expect((await raw(`${HUB}/config`, tutor)).body.hub.passMarkPct).toBe(70);
    await resetHubCfg(accounts.company);
    expect((await raw(`${HUB}/config`, other)).body.hub.passMarkPct).toBe(70);
  });
});

// ── 1. year group ────────────────────────────────────────────────────────────
test.describe("year group on students", () => {
  const row = async (c: string) => ((await raw(`${HUB}/students`, tutor)).body as unknown as J[]).find((r) => r.childId === c)!;

  test("enrolment fills the year group from the dob (UK rule); no dob = unknown and flagged", async () => {
    const a = await row(childA);
    expect(a).toMatchObject({ yearGroup: ygA, yearGroupAuto: true, audienceUnknown: false });
    const b = await row(childB);
    expect(b).toMatchObject({ yearGroup: null, audienceUnknown: true });
    // the date of birth itself never leaves in the roster
    expect(JSON.stringify(await raw(`${HUB}/students`, tutor).then((r) => r.body))).not.toContain(dobA);
  });

  test("a tutor can tag, clear, and return to automatic; other tenants can't touch the student", async () => {
    let r = await raw(`${HUB}/students/${childA}`, tutor, send("PUT", { yearGroup: "year 2" }));
    expect(r.status, r.text).toBe(200);
    expect(r.body).toMatchObject({ yearGroup: "Year 2", yearGroupAuto: false }); // normalised to the tenant's spelling
    r = await raw(`${HUB}/students/${childA}`, tutor, send("PUT", { yearGroup: null }));
    expect(r.body).toMatchObject({ yearGroup: null, audienceUnknown: false }); // unknown year, but the age is known from the dob
    r = await raw(`${HUB}/students/${childA}`, tutor, send("PUT", { yearGroupAuto: true }));
    expect(r.body).toMatchObject({ yearGroup: ygA, yearGroupAuto: true });
    expect((await raw(`${HUB}/students/${childA}`, other, send("PUT", { yearGroup: "Year 1" }))).status).toBe(404);
    expect((await raw(`${HUB}/students`, tutor, send("POST", { childId: childA, yearGroup: "" }))).status).toBe(400);
  });
});

// ── 1b. audience on assessments ──────────────────────────────────────────────
test.describe("audience: who a quiz or placement test is for", () => {
  const aud = (o: J) => ({ yearGroups: [], ageMin: null, ageMax: null, ...o });
  const titles = (rows: J[]) => rows.map((r) => r.title as string);

  test("audience is validated, stored, returned and kept when an edit omits it", async () => {
    const bad = await raw(`${HUB}/assessments`, tutor, send("POST", { type: "quiz", title: "x", subject: S1, questionIds: [ids.single], audience: aud({ ageMin: 9, ageMax: 5 }) }));
    expect(bad.status).toBe(400);
    ids.q0 = await newQuiz("Everyone");
    ids.q1 = await newQuiz("For my year", { audience: aud({ yearGroups: [ygA] }) });
    ids.q2 = await newQuiz("For another year", { audience: aud({ yearGroups: [ygOther] }) });
    ids.q3 = await newQuiz("My age", { audience: aud({ ageMin: ageA, ageMax: ageA }) });
    ids.q4 = await newQuiz("Older kids", { audience: aud({ ageMin: ageA + 3, ageMax: ageA + 4 }) });
    ids.q5 = await newQuiz("Both", { audience: aud({ yearGroups: [ygA], ageMin: ageA + 3, ageMax: ageA + 4 }) });
    const t = (await raw(`${HUB}/assessments`, tutor)).body as unknown as J[];
    const q1 = t.find((x) => x.id === ids.q1)!;
    expect(q1.audience).toEqual({ yearGroups: [ygA], ageMin: null, ageMax: null });
    expect(t.find((x) => x.id === ids.q0)!.audience).toEqual(aud({}));
    // PUT without `audience` keeps it
    const put = await raw(`${HUB}/assessments/${ids.q1}`, tutor, send("PUT", { type: "quiz", title: q1.title, subject: S1, questionIds: [ids.single, ids.short], published: true }));
    expect(put.status, put.text).toBe(200);
    expect(put.body.audience.yearGroups).toEqual([ygA]);
    // a tutor sees who it suits: everyone-quizzes reach all three enrolled students; year-targeted ones the unknown child at least
    const t2 = (await raw(`${HUB}/assessments`, tutor)).body as unknown as J[];
    expect(t2.find((x) => x.id === ids.q0)!.eligibleCount).toBeGreaterThanOrEqual(3);
    const e2 = t2.find((x) => x.id === ids.q2)!;
    expect(e2.eligibleCount).toBeGreaterThanOrEqual(1);
    expect(e2.audienceUnknownCount).toBeGreaterThanOrEqual(1);
    expect(e2.eligibleCount).toBeLessThan(t2.find((x) => x.id === ids.q0)!.eligibleCount); // Ava is excluded
  });

  test("a child with a known year and age sees only what is for them", async () => {
    const t = titles(await listFor(childA));
    for (const n of ["Everyone", "For my year", "My age"]) expect(t, n).toContain(`${n} ${stamp}`);
    for (const n of ["For another year", "Older kids", "Both"]) expect(t, n).not.toContain(`${n} ${stamp}`);
    const rows = await listFor(childA);
    expect(rows.find((r) => r.id === ids.q1)).toMatchObject({ audienceUnknown: false, audience: { yearGroups: [ygA] } });
  });

  test("a child whose year and age are unknown still sees everything, flagged (never silently hidden)", async () => {
    const rows = await listFor(childB);
    for (const id of [ids.q0, ids.q1, ids.q2, ids.q3, ids.q4, ids.q5]) expect(rows.find((r) => r.id === id), id).toBeTruthy();
    expect(rows.find((r) => r.id === ids.q0)!.audienceUnknown).toBe(false);
    expect(rows.find((r) => r.id === ids.q2)!.audienceUnknown).toBe(true);
    expect(rows.find((r) => r.id === ids.q4)!.audienceUnknown).toBe(true);
  });

  test("starting an attempt for an ineligible child is refused; eligible and unknown children may start", async () => {
    for (const id of [ids.q2, ids.q4, ids.q5]) {
      const r = await start(id, childA);
      expect(r.status, id).toBe(409);
      expect(r.body.code).toBe("not_for_this_child");
    }
    // a tutor starting on the child's behalf is held to the same rule
    const onBehalf = await raw(`${HUB}/assessments/${ids.q2}/attempts`, tutor, send("POST", { childId: childA }));
    expect(onBehalf.status).toBe(409);
    expect(onBehalf.body.code).toBe("not_for_this_child");
    expect((await start(ids.q1, childA)).status).toBe(201);
    expect((await start(ids.q3, childA)).status).toBe(201);
    expect((await start(ids.q2, childB)).status).toBe(201); // unknown → allowed
  });

  test("several placement tests can share a subject when their audiences differ; an identical audience is refused", async () => {
    const subj = `Placement ${stamp}`;
    const diag = (title: string, audience: J | undefined, published = true) =>
      raw(`${HUB}/assessments`, tutor, send("POST", { type: "diagnostic", title: `${title} ${stamp}`, subject: subj, questionIds: [ids.placement], published, ...(audience ? { audience } : {}) }));
    const dA = await diag("Placement A", aud({ yearGroups: [ygA] }));
    expect(dA.status, dA.text).toBe(201);
    ids.dA = dA.body.id;
    const dO = await diag("Placement other", aud({ yearGroups: [ygOther] }));
    expect(dO.status, dO.text).toBe(201);
    ids.dO = dO.body.id;
    const dup = await diag("Placement dup", aud({ yearGroups: [ygA.toUpperCase()] }));
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe("diagnostic_exists");
    // a draft with the same audience is fine, but publishing it is not
    const draft = await diag("Placement draft", aud({ yearGroups: [ygA] }), false);
    expect(draft.status).toBe(201);
    const pub = await raw(`${HUB}/assessments/${draft.body.id}`, tutor, send("PUT", { type: "diagnostic", title: "Placement draft", subject: subj, questionIds: [ids.placement], published: true }));
    expect(pub.status).toBe(409);
    // …but a different audience (an age range) publishes
    const ages = await diag("Placement ages", aud({ ageMin: ageA + 4, ageMax: ageA + 6 }));
    expect(ages.status, ages.text).toBe(201);
    // the family sees only the placement tests for their child
    const a = titles(await listFor(childA, "&type=diagnostic"));
    expect(a).toContain(`Placement A ${stamp}`);
    expect(a).not.toContain(`Placement other ${stamp}`);
    expect(a).not.toContain(`Placement ages ${stamp}`);
    const b = titles(await listFor(childB, "&type=diagnostic"));
    expect(b).toContain(`Placement A ${stamp}`);
    expect(b).toContain(`Placement other ${stamp}`);
  });

  test("requireDiagnostic only locks a quiz behind a placement test that is FOR the child; the baseline stays one per subject", async () => {
    expect((await raw(`${HUB}/config`, tutor, send("PUT", { hub: { requireDiagnostic: true } }))).status).toBe(200);
    try {
      const subj = `Placement ${stamp}`;
      const zq = await raw(`${HUB}/assessments`, tutor, send("POST", { type: "quiz", title: `Placement quiz ${stamp}`, subject: subj, questionIds: [ids.placement], published: true }));
      expect(zq.status, zq.text).toBe(201);
      // Solo: the only placement test is for ANOTHER year
      const solo = `Solo ${stamp}`;
      const sd = await raw(`${HUB}/assessments`, tutor, send("POST", { type: "diagnostic", title: `Solo diag ${stamp}`, subject: solo, questionIds: [ids.soloQ], published: true, audience: aud({ yearGroups: [ygOther] }) }));
      expect(sd.status, sd.text).toBe(201);
      const sq = await raw(`${HUB}/assessments`, tutor, send("POST", { type: "quiz", title: `Solo quiz ${stamp}`, subject: solo, questionIds: [ids.soloQ], published: true }));
      expect(sq.status).toBe(201);

      const overlay = async (c: string, id: string) => (await listFor(c)).find((r) => r.id === id)!;
      expect((await overlay(childA, zq.body.id)).locked).toBe(true);              // Placement A is for Ava
      expect((await overlay(childA, sq.body.id)).locked).toBe(false);             // Solo's placement test isn't for her
      expect((await overlay(childB, sq.body.id)).locked).toBe(true);              // unknown → it might be for Ben
      expect((await start(zq.body.id, childA)).body.code).toBe("diagnostic_required");
      expect((await start(sq.body.id, childA)).status).toBe(201);

      await takeAndSubmit(ids.dA, childA);                                        // Ava sits hers…
      expect((await start(zq.body.id, childA)).status).toBe(201);                 // …and the quiz opens
      expect((await start(ids.dO, childA)).body.code).toBe("not_for_this_child");
      await takeAndSubmit(ids.dO, childB);                                        // Ben sits the other one
      const again = await start(ids.dA, childB);                                  // one baseline per (child, subject)
      expect(again.status).toBe(409);
      expect(again.body.code).toBe("diagnostic_done");
    } finally {
      await raw(`${HUB}/config`, tutor, send("PUT", { hub: { requireDiagnostic: false } }));
    }
  });
});

// ── 2. pictures on questions ─────────────────────────────────────────────────
test.describe("images on questions", () => {
  let imgQ = "", imgQuiz = "", oldUrl = "";
  const imgQuestion = (over: J) => ({ topicId: ids.algebra, kind: "single", prompt: `Which shape? ${stamp}`, options: [opt("a", "A"), opt("b", "B")], answer: "b", marks: 1, ...over });

  test("only this tenant's private hub PNG/JPEG/WebP/GIF uploads are accepted, and alt text is required", async () => {
    const good = await upload(tutor, PNG_1PX);
    const post = (b: J) => raw(`${HUB}/questions`, tutor, send("POST", imgQuestion(b)));
    expect((await post({ image: { id: good } })).status).toBe(400);                                   // no alt
    expect((await post({ image: { id: good, alt: "" } })).status).toBe(400);
    expect((await post({ image: { id: await upload(other, PNG_1PX), alt: "x" } })).status).toBe(400);  // another provider's file
    expect((await post({ image: { id: await upload(tutor, PNG_1PX, { purpose: "private" }), alt: "x" } })).status).toBe(400); // not a hub upload
    expect((await post({ image: { id: await upload(tutor, PNG_1PX, { purpose: "public" }), alt: "x" } })).status).toBe(400); // public
    expect((await post({ image: { id: await upload(tutor, GOOD_PDF), alt: "x" } })).status).toBe(400); // a PDF
    expect((await post({ image: { id: "no/such", alt: "x" } })).status).toBe(400);
    expect((await post({ image: { id: "nonexistentimageid123", alt: "x" } })).status).toBe(400);
    expect((await post({ options: [opt("a", "A", await upload(other, PNG_1PX)), opt("b", "B")] })).status).toBe(400); // option picture from elsewhere
    // a note's attachment can't be borrowed as a question picture
    const att = await upload(tutor, GOOD_PDF);
    const note = await raw(`${HUB}/notes`, tutor, send("POST", { topicId: ids.algebra, title: `Note ${stamp}`, body: "", attachments: [{ id: att, name: "w.pdf" }] }));
    expect(note.status, note.text).toBe(201);
    expect((await post({ image: { id: att, alt: "x" } })).status).toBe(400);
    // an unlisted picture was never attached, so nothing above created a question
    const bank = (await raw(`${HUB}/questions?topicId=${ids.algebra}`, tutor)).body as unknown as J[];
    expect(bank.filter((q) => q.prompt === `Which shape? ${stamp}`).length).toBe(0);
  });

  test("a picture question round-trips for the tutor (id + alt + signed preview)", async () => {
    const q = await raw(`${HUB}/questions`, tutor, send("POST", imgQuestion({
      image: { id: await upload(tutor, PNG_1PX), alt: "A blue square" },
      options: [opt("a", "Square", await upload(tutor, PNG_1PX)), opt("b", "Circle", await upload(tutor, PNG_1PX))],
    })));
    expect(q.status, q.text).toBe(201);
    imgQ = q.body.id;
    expect(q.body.image).toMatchObject({ alt: "A blue square" });
    expect(q.body.image.id).toBeTruthy();
    expect(q.body.image.url).toMatch(/sig=/);
    expect(q.body.options[0].image.id).toBeTruthy();
    // an edit that omits `image` keeps it; explicit null removes it
    const keep = await raw(`${HUB}/questions/${imgQ}`, tutor, send("PUT", imgQuestion({ options: q.body.options.map((o: J) => ({ id: o.id, text: o.text, image: o.image ? { id: o.image.id } : undefined })) })));
    expect(keep.status, keep.text).toBe(200);
    expect(keep.body.image?.alt).toBe("A blue square");
  });

  test("students get SIGNED picture links in the attempt (start + resume) and the result review — never the key or a bare id", async () => {
    const mk = await raw(`${HUB}/assessments`, tutor, send("POST", { type: "quiz", title: `Pictures ${stamp}`, subject: S1, questionIds: [imgQ], published: true }));
    expect(mk.status, mk.text).toBe(201);
    imgQuiz = mk.body.id;
    const s = await start(imgQuiz, childC);
    expect(s.status, s.text).toBe(201);
    const pq1 = s.body.questions[0];
    expect(pq1.image.alt).toBe("A blue square");
    expect(pq1.image.url).toMatch(/\/api\/images\/[A-Za-z0-9_-]+\?exp=\d+&sig=/);
    expect(pq1.options.every((o: J) => /sig=/.test(o.image?.url ?? ""))).toBe(true);
    for (const banned of ['"answer"', "correctAnswer", "acceptedAnswers", "explanation"]) expect(s.text, banned).not.toContain(banned);
    oldUrl = pq1.image.url;
    const img = await fetch(oldUrl);
    expect(img.status).toBe(200);
    expect(img.headers.get("content-type")).toBe("image/png");
    expect((await fetch(oldUrl.split("?")[0])).status).toBe(403); // the bare id alone opens nothing

    const resumed = await start(imgQuiz, childC);
    expect(resumed.body.resumed).toBe(true);
    expect(resumed.body.questions[0].image.url).toMatch(/sig=/);
    expect(resumed.body.questions[0].options[0].image.url).toMatch(/sig=/);
    expect(resumed.text).not.toContain('"answer"');

    const result = await submit(s.body.attemptId, s.body.questions, { [imgQ]: "b" });
    expect(result.pct).toBe(100);
    const detail = (await raw(`${HUB}/attempts/${s.body.attemptId}${pq()}`, parent)).body;
    expect(detail.answers[0].image.url).toMatch(/sig=/);
    expect(detail.answers[0].options[0].image.url).toMatch(/sig=/);
    expect(detail.answers[0].correctAnswer).toBe("b"); // reveal policy (after_submit) — the key only appears in the review
  });

  test("a picture used by a result survives an edit; unattempted pictures are dropped on replace and on delete", async () => {
    // Ava-less: replace the attempted question's picture → the OLD file is still there for the result review
    const replaced = await raw(`${HUB}/questions/${imgQ}`, tutor, send("PUT", imgQuestion({ image: { id: await upload(tutor, PNG_1PX), alt: "New alt" }, options: [opt("a", "A"), opt("b", "B")] })));
    expect(replaced.status, replaced.text).toBe(200);
    await new Promise((r) => setTimeout(r, 2500));
    expect((await fetch(oldUrl)).status).toBe(200);

    // A never-attempted question: replace → old file gone; delete → current file gone
    const q2 = await raw(`${HUB}/questions`, tutor, send("POST", imgQuestion({ prompt: `Drop me ${stamp}`, image: { id: await upload(tutor, PNG_1PX), alt: "first" } })));
    expect(q2.status, q2.text).toBe(201);
    const firstUrl = q2.body.image.url as string;
    expect((await fetch(firstUrl)).status).toBe(200);
    const up = await raw(`${HUB}/questions/${q2.body.id}`, tutor, send("PUT", imgQuestion({ prompt: `Drop me ${stamp}`, image: { id: await upload(tutor, PNG_1PX), alt: "second" } })));
    expect(up.status, up.text).toBe(200);
    await expect.poll(async () => (await fetch(firstUrl)).status, { timeout: 20_000 }).toBe(404);
    const secondUrl = up.body.image.url as string;
    expect((await fetch(secondUrl)).status).toBe(200);
    expect((await raw(`${HUB}/questions/${q2.body.id}`, tutor, send("DELETE"))).status).toBe(200);
    await expect.poll(async () => (await fetch(secondUrl)).status, { timeout: 20_000 }).toBe(404);
  });
});

// ── 3 + 4. retakes and self-marking clarity ──────────────────────────────────
test.describe("retake control", () => {
  let rq = "";
  const setCfg = (hub: J) => raw(`${HUB}/config`, tutor, send("PUT", { hub }));
  const retake = async (c: string) => (await listFor(c)).find((r) => r.id === rq)!.retake;

  test("policy 'once': a finished quiz is blocked; a running attempt still resumes; a fresh child may start", async () => {
    rq = await newQuiz("Retake me");
    expect((await setCfg({ retakePolicy: "once" })).status).toBe(200);
    expect(await retake(childA)).toEqual({ allowed: true, reason: null, nextAvailableAt: null });
    const r1 = await takeAndSubmit(rq, childA);
    expect(r1.awaitingWritten).toBe(false);
    expect(await retake(childA)).toEqual({ allowed: false, reason: "once", nextAvailableAt: null });
    const blocked = await start(rq, childA);
    expect(blocked.status).toBe(409);
    expect(blocked.body).toMatchObject({ code: "retake_blocked", reason: "once", nextAvailableAt: null });
    const b1 = await start(rq, childB);                    // never attempted
    expect(b1.status).toBe(201);
    expect((await start(rq, childB)).body.resumed).toBe(true); // running attempt is always resumable
  });

  test("allow-retake grants exactly one more attempt; tutors only; foreign ids are 404", async () => {
    expect((await raw(`${HUB}/assessments/${rq}/allow-retake${qa(childA)}`, parent, send("POST", { childId: childA }))).status).toBe(403);
    expect((await raw(`${HUB}/assessments/${rq}/allow-retake`, other, send("POST", { childId: childA }))).status).toBe(404);
    expect((await raw(`${HUB}/assessments/${rq}/allow-retake`, tutor, send("POST", { childId: "nobody" }))).status).toBe(404);
    expect((await raw(`${HUB}/assessments/${rq}/allow-retake`, tutor, send("POST", { childId: childD }))).status).toBe(404); // not enrolled
    expect((await raw(`${HUB}/assessments/nope/allow-retake`, tutor, send("POST", { childId: childA }))).status).toBe(404);
    const ok = await raw(`${HUB}/assessments/${rq}/allow-retake`, tutor, send("POST", { childId: childA }));
    expect(ok.status, ok.text).toBe(200);
    expect((await retake(childA)).allowed).toBe(true);
    await takeAndSubmit(rq, childA);                       // spends it
    expect((await retake(childA)).allowed).toBe(false);
    expect((await start(rq, childA)).body.code).toBe("retake_blocked");
  });

  test("policy 'cooldown': blocked with the time it opens; an assessment can override the default", async () => {
    expect((await setCfg({ retakePolicy: "cooldown", retakeCooldownHours: 24 })).status).toBe(200);
    const c = await start(rq, childA);
    expect(c.status).toBe(409);
    expect(c.body).toMatchObject({ code: "retake_blocked", reason: "cooldown" });
    const hoursAway = (Date.parse(c.body.nextAvailableAt) - Date.now()) / 3_600_000;
    expect(hoursAway).toBeGreaterThan(23);
    expect(hoursAway).toBeLessThanOrEqual(24.01);
    expect(await retake(childA)).toMatchObject({ allowed: false, reason: "cooldown", nextAvailableAt: c.body.nextAvailableAt });

    const body = (over: J) => ({ type: "quiz", title: `Retake me ${stamp}`, subject: S1, questionIds: [ids.single, ids.short], published: true, ...over });
    expect((await raw(`${HUB}/assessments/${rq}`, tutor, send("PUT", body({ retakePolicy: "cooldown", retakeCooldownHours: 0 })))).status).toBe(400);
    const one = await raw(`${HUB}/assessments/${rq}`, tutor, send("PUT", body({ retakePolicy: "cooldown", retakeCooldownHours: 1 })));
    expect(one.status, one.text).toBe(200);
    const c1 = await start(rq, childA);
    expect(c1.body.reason).toBe("cooldown");
    expect((Date.parse(c1.body.nextAvailableAt) - Date.now()) / 3_600_000).toBeLessThan(1.01);
    // an edit that omits the policy keeps it
    expect((await raw(`${HUB}/assessments/${rq}`, tutor, send("PUT", body({})))).body.retakePolicy).toBe("cooldown");
    expect((await raw(`${HUB}/assessments/${rq}`, tutor, send("PUT", body({ retakePolicy: "unlimited" })))).status).toBe(200);
    await takeAndSubmit(rq, childA);                       // unlimited override beats the tutor's cooldown default
    expect((await raw(`${HUB}/assessments/${rq}`, tutor, send("PUT", body({ retakePolicy: "inherit" })))).body.retakePolicy).toBe("inherit");
    expect((await start(rq, childA)).body.reason).toBe("cooldown"); // back to the tutor default
    expect((await setCfg({ retakePolicy: "unlimited" })).status).toBe(200);
    // "Unlimited" now has a short break after 3 not-passed goes in a row (default retakeBreakAfter 3; childA has just failed 3) …
    const brk = await start(rq, childA);
    expect(brk.status).toBe(409);
    expect(brk.body).toMatchObject({ code: "retake_blocked", reason: "break" });
    expect(Date.parse(brk.body.nextAvailableAt)).toBeGreaterThan(Date.now());
    expect(await retake(childA)).toMatchObject({ allowed: false, reason: "break" });
    // … and the tutor can switch it off (0 = off).
    expect((await setCfg({ retakePolicy: "unlimited", retakeBreakAfter: 0 })).status).toBe(200);
    await takeAndSubmit(rq, childA);
  });
});

test.describe("self-marking clarity and the real attainment level", () => {
  let wq = "";

  test("an auto-marked score is separate from the written part still waiting", async () => {
    wq = await newQuiz("Mixed paper", { questionIds: [ids.single, ids.short, ids.written] });
    const s = await start(wq, childA);
    expect(s.status, s.text).toBe(201);
    const r = await submit(s.body.attemptId, s.body.questions, { [ids.single]: "b", [ids.short]: "wrong", [ids.written]: "Take out the common factor" });
    expect(r).toMatchObject({ status: "pending_marking", autoMarks: 2, autoMax: 3, writtenPending: 1, awaitingWritten: true, maxMarks: 7 });
    expect(r.passed).toBeNull();
    const list = ((await raw(`${HUB}/attempts${qa(childA)}&assessmentId=${wq}`, parent)).body as unknown as J[])[0];
    expect(list).toMatchObject({ autoMarks: 2, autoMax: 3, writtenPending: 1, awaitingWritten: true });
    const detail = (await raw(`${HUB}/attempts/${s.body.attemptId}${pq()}`, parent)).body;
    expect(detail).toMatchObject({ autoMarks: 2, autoMax: 3, writtenPending: 1, awaitingWritten: true });
    // the tutor marks the written answer
    const m = await raw(`${HUB}/attempts/${s.body.attemptId}/mark`, tutor, send("PUT", { answers: [{ questionId: ids.written, marksAwarded: 3, feedback: "Good" }] }));
    expect(m.status, m.text).toBe(200);
    expect(m.body).toMatchObject({ status: "marked", autoMarks: 2, autoMax: 3, writtenPending: 0, awaitingWritten: false, scoreMarks: 5 });
    const after = ((await raw(`${HUB}/attempts${qa(childA)}&assessmentId=${wq}`, parent)).body as unknown as J[])[0];
    expect(after).toMatchObject({ writtenPending: 0, awaitingWritten: false, status: "marked" });
  });

  test("GET /mastery returns the overall attainment band and the tenant's bands; editing bands changes both", async () => {
    let m = (await raw(`${HUB}/mastery${qa(childA)}`, parent)).body;
    expect(m.overall).toMatchObject({ bandCount: 3 });
    expect(m.overall.masteryPct).toBeGreaterThanOrEqual(0);
    expect(m.overall.subjectsCounted).toBeGreaterThanOrEqual(1);
    expect(["Learning", "Developing", "Secure"]).toContain(m.overall.band);
    expect(m.bands).toEqual([{ min: 0, label: "Learning" }, { min: 50, label: "Developing" }, { min: 80, label: "Secure" }]);
    // a child with nothing marked yet has no level
    expect((await raw(`${HUB}/mastery${qa(childB)}`, parent)).body.overall).toBeNull();

    const bands = [{ min: 0, label: "Emerging" }, { min: 20, label: "Working" }, { min: 40, label: "Expected" }, { min: 95, label: "Greater depth" }];
    expect((await raw(`${HUB}/config`, tutor, send("PUT", { hub: { masteryBands: bands } }))).status).toBe(200);
    try {
      m = (await raw(`${HUB}/mastery${qa(childA)}`, parent)).body;
      expect(m.bands).toEqual(bands);
      expect(m.overall.bandCount).toBe(4);
      expect(bands.map((b) => b.label)).toContain(m.overall.band);
      const attempted = (m.subjects as J[]).filter((x) => x.masteryPct !== null);
      expect(attempted.length).toBeGreaterThan(0);
      for (const x of attempted) expect(bands.map((b) => b.label)).toContain(x.band);
      const pct = m.overall.masteryPct as number;
      const idx = bands.reduce((acc, b, i) => (b.min <= pct ? i : acc), 0);
      expect(m.overall.bandIndex).toBe(idx);
      expect(m.overall.next).toEqual(idx < 3 ? bands[idx + 1] : null);
    } finally {
      await raw(`${HUB}/config`, tutor, send("PUT", { hub: { masteryBands: HUB_DEFAULTS.masteryBands } }));
    }
  });
});

// ── 7. groups ────────────────────────────────────────────────────────────────
test.describe("student groups", () => {
  let g1 = "";
  const groups = async (t = tutor) => (await raw(`${HUB}/groups`, t)).body as unknown as J[];
  const day = () => new Date(Date.now() + 86_400_000).toISOString();

  test("create / list / validate; tutors only; other providers never see them", async () => {
    expect((await raw(`${HUB}/groups${pq()}`, parent)).status).toBe(403);
    const mk = (b: J) => raw(`${HUB}/groups`, tutor, send("POST", b));
    const r = await mk({ name: `Year 6 stars ${stamp}`, colour: "teal", childIds: [childA, childB] });
    expect(r.status, r.text).toBe(201);
    g1 = r.body.id;
    expect(r.body).toMatchObject({ colour: "teal", count: 2 });
    expect(r.body.members.map((m: J) => m.childName).sort()).toEqual([`Ava ${stamp}`, `Ben ${stamp}`]);
    expect((await mk({ name: `YEAR 6 STARS ${stamp}`, childIds: [] })).status).toBe(409);
    expect((await mk({ name: "x", colour: "neon" })).status).toBe(400);
    expect((await mk({ name: "" })).status).toBe(400);
    expect((await mk({ name: `Bad ${stamp}`, childIds: [childD] })).status).toBe(404);     // not enrolled
    expect((await mk({ name: `Bad ${stamp}`, childIds: ["nobody"] })).status).toBe(404);
    expect((await groups()).some((g) => g.id === g1)).toBe(true);
    // another provider
    expect((await groups(other)).some((g) => g.id === g1)).toBe(false);
    expect((await raw(`${HUB}/groups/${g1}`, other, send("PUT", { name: "hijack" }))).status).toBe(404);
    expect((await raw(`${HUB}/groups/${g1}`, other, send("DELETE"))).status).toBe(404);
    expect((await raw(`${HUB}/groups/${g1}`, tutor, send("PUT", { childIds: [childA, "nobody"] }))).status).toBe(404);
    const up = await raw(`${HUB}/groups/${g1}`, tutor, send("PUT", { name: `Stars ${stamp}`, colour: "purple" }));
    expect(up.body).toMatchObject({ name: `Stars ${stamp}`, colour: "purple", count: 2 });
  });

  test("homework for a group is expanded to its members (union with named students); foreign / empty groups are refused", async () => {
    const hw = await raw(`${HUB}/homework`, tutor, send("POST", { title: `Group homework ${stamp}`, instructions: "x", assignedGroupIds: [g1] }));
    expect(hw.status, hw.text).toBe(201);
    expect([...hw.body.assignedChildIds].sort()).toEqual([childA, childB].sort());
    expect(hw.body.groupIds).toEqual([g1]);
    expect(hw.body.counts.assigned).toBe(2);
    const both = await raw(`${HUB}/homework`, tutor, send("POST", { title: `Union homework ${stamp}`, assignedChildIds: [childC], assignedGroupIds: [g1] }));
    expect(both.body.assignedChildIds.length).toBe(3);
    // the family sees a row per child
    const rows = (await raw(`${HUB}/homework${qa(childB)}`, parent)).body as unknown as J[];
    expect(rows.some((r) => r.title === `Group homework ${stamp}` && r.childId === childB)).toBe(true);
    // foreign group / no students / empty group
    expect((await raw(`${HUB}/homework`, other, send("POST", { title: "x", assignedGroupIds: [g1] }))).status).toBe(404);
    expect((await raw(`${HUB}/homework`, tutor, send("POST", { title: "x", assignedGroupIds: ["nope"] }))).status).toBe(404);
    expect((await raw(`${HUB}/homework`, tutor, send("POST", { title: "x" }))).status).toBe(400);
    const empty = await raw(`${HUB}/groups`, tutor, send("POST", { name: `Empty ${stamp}`, childIds: [] }));
    expect((await raw(`${HUB}/homework`, tutor, send("POST", { title: "x", assignedGroupIds: [empty.body.id] }))).status).toBe(400);
    // naming only groups on an edit ADDS their members; nothing is removed
    const put = await raw(`${HUB}/homework/${both.body.id}`, tutor, send("PUT", { assignedGroupIds: [] }));
    expect(put.status, put.text).toBe(200);
    expect(put.body.assignedChildIds.length).toBe(3);
    expect(put.body.groupIds).toEqual([]);
    // "Set a quiz" for a group = homework with an assessmentId
    const quiz = await raw(`${HUB}/homework`, tutor, send("POST", { title: `Quiz homework ${stamp}`, assessmentId: ids.q0, assignedGroupIds: [g1] }));
    expect(quiz.status, quiz.text).toBe(201);
    expect(quiz.body.assessmentId).toBe(ids.q0);
  });

  test("lessons for a group are expanded to its members too", async () => {
    const l = await raw(`${HUB}/lessons`, tutor, send("POST", { title: `Group lesson ${stamp}`, startsAt: day(), durationMins: 30, groupIds: [g1] }));
    expect(l.status, l.text).toBe(201);
    expect([...l.body.childIds].sort()).toEqual([childA, childB].sort());
    expect(l.body.groupIds).toEqual([g1]);
    expect((await raw(`${HUB}/lessons`, tutor, send("POST", { title: "x", startsAt: day(), durationMins: 30 }))).status).toBe(400);
    expect((await raw(`${HUB}/lessons`, other, send("POST", { title: "x", startsAt: day(), durationMins: 30, groupIds: [g1] }))).status).toBe(404);
    const fam = ((await raw(`${HUB}/lessons${qa(childA)}`, parent)).body as unknown as J[]).find((x) => x.id === l.body.id)!;
    expect(fam.childIds).toEqual([childA]);      // a family only ever sees its OWN child
    expect(fam.groupIds).toBeUndefined();        // groups are a tutor's tool
  });

  test("un-enrolling, pausing and deleting a child take them out of groups; deleting the group tidies the labels", async () => {
    expect((await raw(`${HUB}/groups/${g1}`, tutor, send("PUT", { childIds: [childA, childB, childC] }))).status).toBe(200);
    expect((await raw(`${HUB}/students/${childC}`, tutor, send("DELETE"))).status).toBe(200);
    expect(((await groups()).find((g) => g.id === g1))!.childIds).not.toContain(childC);
    expect((await raw(`${HUB}/students`, tutor, send("POST", { childId: childC }))).status).toBeLessThan(300); // re-enrolling doesn't sneak them back in
    expect(((await groups()).find((g) => g.id === g1))!.childIds).not.toContain(childC);

    expect((await raw(`${HUB}/students/${childB}`, tutor, send("PUT", { active: false }))).status).toBe(200);
    expect(((await groups()).find((g) => g.id === g1))!.childIds).not.toContain(childB);
    expect((await raw(`${HUB}/students/${childB}`, tutor, send("PUT", { active: true }))).status).toBe(200);

    // a parent deleting the child's profile erases them from groups (privacy cascade)
    expect((await raw(`${HUB}/groups/${g1}`, tutor, send("PUT", { childIds: [childA, childC] }))).status).toBe(200);
    expect((await raw(`/api/my/children/${childC}`, parent, send("DELETE"))).status).toBe(200);
    await expect.poll(async () => ((await groups()).find((g) => g.id === g1))!.childIds, { timeout: 20_000 }).not.toContain(childC);

    expect((await raw(`${HUB}/groups/${g1}`, tutor, send("DELETE"))).status).toBe(200);
    expect((await groups()).some((g) => g.id === g1)).toBe(false);
    const hw = ((await raw(`${HUB}/homework`, tutor)).body as unknown as J[]).find((h) => h.title === `Group homework ${stamp}`)!;
    await expect.poll(async () => (((await raw(`${HUB}/homework`, tutor)).body as unknown as J[]).find((h) => h.id === hw.id)!).groupIds, { timeout: 20_000 }).toEqual([]);
  });
});

// ── 8. videos ────────────────────────────────────────────────────────────────
test.describe("YouTube videos on notes, homework and lesson notes", () => {
  const link = (id: string) => `https://www.youtube.com/watch?v=${id}`;
  const vid = (o: J = {}) => ({ url: link(YT), ...o });

  test("notes: parsed to an id, echoed with a nocookie embed; bad links, hosts and counts are refused", async () => {
    const note = (videos: unknown, extra: J = {}) => raw(`${HUB}/notes`, tutor, send("POST", { topicId: ids.algebra, title: `Video note ${stamp}`, body: "b", videos, ...extra }));
    const ok = await note([vid({ title: "  Intro  ", start: 30 }), { url: `https://youtu.be/${YT2}` }]);
    expect(ok.status, ok.text).toBe(201);
    expect(ok.body.videos[0]).toEqual({ id: YT, title: "Intro", start: 30, url: link(YT), embedUrl: `https://www.youtube-nocookie.com/embed/${YT}?start=30` });
    expect(ok.body.videos[1]).toMatchObject({ id: YT2, start: null, embedUrl: `https://www.youtube-nocookie.com/embed/${YT2}` });
    for (const bad of [
      "https://vimeo.com/123456789", `https://evil.com/watch?v=${YT}`, `https://youtube.com.evil.com/watch?v=${YT}`, "javascript:alert(1)", `data:text/html,${link(YT)}`,
      `https://www.youtube.com/watch?v=short`, `https://www.youtube.com/playlist?list=PL${YT}`, `https://user:pw@www.youtube.com/watch?v=${YT}`, "not a url", "",
    ]) {
      const r = await note([{ url: bad }]);
      expect(r.status, bad).toBe(400);
    }
    expect((await note(Array.from({ length: 7 }, () => vid()))).status).toBe(400);
    expect((await note(Array.from({ length: 6 }, () => vid()))).status).toBe(201);
    expect((await note([vid({ start: -1 })])).status).toBe(400);
    // PUT: omitted keeps, [] clears; the family sees them on a published note
    const put = (b: J) => raw(`${HUB}/notes/${ok.body.id}`, tutor, send("PUT", { topicId: ids.algebra, title: `Video note ${stamp}`, body: "b2", ...b }));
    expect((await put({})).body.videos.length).toBe(2);
    const fam = ((await raw(`${HUB}/notes${pq()}&childId=${childA}`, parent)).body as unknown as J[]).find((n) => n.id === ok.body.id)!;
    expect(fam.videos.map((v: J) => v.id)).toEqual([YT, YT2]);
    expect(fam.videos[0].embedUrl).toContain("youtube-nocookie.com/embed/");
    expect((await put({ videos: [] })).body.videos).toEqual([]);
    // other providers can't edit it
    expect((await raw(`${HUB}/notes/${ok.body.id}`, other, send("PUT", { topicId: ids.algebra, title: "x", body: "", videos: [vid()] }))).status).toBe(404);
  });

  test("homework and lesson notes carry videos too, for tutor and family", async () => {
    const hw = await raw(`${HUB}/homework`, tutor, send("POST", { title: `Video homework ${stamp}`, assignedChildIds: [childA], videos: [vid({ title: "Watch this" })] }));
    expect(hw.status, hw.text).toBe(201);
    expect(hw.body.videos[0]).toMatchObject({ id: YT, title: "Watch this", embedUrl: `https://www.youtube-nocookie.com/embed/${YT}` });
    expect((await raw(`${HUB}/homework`, tutor, send("POST", { title: "x", assignedChildIds: [childA], videos: [{ url: "https://vimeo.com/1" }] }))).status).toBe(400);
    const fam = ((await raw(`${HUB}/homework${qa(childA)}`, parent)).body as unknown as J[]).find((r) => r.id === hw.body.id)!;
    expect(fam.videos[0].id).toBe(YT);
    expect((await raw(`${HUB}/homework/${hw.body.id}`, tutor, send("PUT", { title: `Video homework ${stamp}` }))).body.videos.length).toBe(1); // kept
    expect((await raw(`${HUB}/homework/${hw.body.id}`, tutor, send("PUT", { videos: [] }))).body.videos).toEqual([]);

    const l = await raw(`${HUB}/lessons`, tutor, send("POST", { title: `Video lesson ${stamp}`, startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(), durationMins: 30, childIds: [childA], notes: "see clip", videos: [vid()] }));
    expect(l.status, l.text).toBe(201);
    expect(l.body.videos[0].id).toBe(YT);
    expect((await raw(`${HUB}/lessons`, tutor, send("POST", { title: "x", startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(), durationMins: 30, childIds: [childA], videos: [{ url: "https://example.com/x" }] }))).status).toBe(400);
    const lf = ((await raw(`${HUB}/lessons${qa(childA)}`, parent)).body as unknown as J[]).find((x) => x.id === l.body.id)!;
    expect(lf.videos[0]).toMatchObject({ id: YT, url: link(YT) });
    const lp = await raw(`${HUB}/lessons/${l.body.id}`, tutor, send("PUT", { notes: "new notes" }));
    expect(lp.body.videos.length).toBe(1); // a notes-only edit keeps them
    // nothing but YouTube ever comes back
    expect(JSON.stringify(lf)).not.toMatch(/vimeo|example\.com/);
  });
});
