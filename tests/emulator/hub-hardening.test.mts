// Learning Hub hardening (10 Oct 2026): attack cases against the REAL API + Firestore emulator (npm run test:emu). Children's data.
// Synthetic data only. Gaps from ~/ActivityLane-QA/runs/areas-10oct/learning-hub (CASES.md): LH03 LH04 LH05 LH06 LH07 LH08 LH11 LH12 LH30 LH31
// LH35 LH36 LH44 LH46 LH57 LH63 and the owner-tenant flag (G6).
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { call, db, login, makeProvider, ok, uniq, type Provider } from "./helpers.mts";

const iso = () => new Date().toISOString();
interface Fam { token: string; uid: string; email: string }
const now = iso();

async function mkUser(email: string, doc: Record<string, unknown>) {
  const s = await login(email);
  await db.collection("users").doc(s.uid).set({ email, chosen: true, name: email, ...doc }, { merge: true });
  return { token: s.token, uid: s.uid, email } as Fam;
}
async function setLib(p: Provider, mut: (s: Record<string, any>) => Record<string, any>) {
  const lib = (await ok("GET", "/api/library", p.token)) ?? {};
  await ok("PUT", "/api/library", p.token, { ...lib, settings: mut(lib.settings ?? {}) });
}
const enrol = (tenantId: string, childId: string, name: string, parent: Fam, extra: Record<string, unknown> = {}) =>
  db.collection("hubEnrolments").doc(`${tenantId}__${childId}`).set({ tenantId, franchiseId: null, childId, childName: name, parentUid: parent.uid, parentEmail: parent.email, subjects: [], tutorUid: null, tutorName: "", active: true, yearGroup: "Year 5", yearGroupAuto: false, createdBy: "seed", createdAt: now, updatedAt: now, ...extra });

const tag = uniq();
let A: Provider, B: Provider;
let P1: Fam, P2: Fam, P3: Fam, P5: Fam, SVIEW: Fam, SNONE: Fam;
const K1 = `k1-${tag}`, K2 = `k2-${tag}`, K3 = `k3-${tag}`, K4 = `k4-${tag}`, K5 = `k5-${tag}`;
let QID = "", ASM = "", LESSON = "", TOPIC = "", ATT_K3 = "";

before(async () => {
  A = await makeProvider(`hhA${tag}`); B = await makeProvider(`hhB${tag}`);
  const roles = [{ id: "hh-view", name: "HH view", caps: { learninghub: "view" } }, { id: "hh-none", name: "HH none", caps: { learninghub: "none", bookings: "edit" } }];
  await setLib(A, (s) => ({ ...s, features: { ...(s.features ?? {}), learninghub: true }, roles, rolesSetAt: now }));
  await setLib(B, (s) => ({ ...s, features: { ...(s.features ?? {}), learninghub: true } }));
  P1 = await mkUser(`hh-p1-${tag}@emu.test`, { role: "parent" });
  P2 = await mkUser(`hh-p2-${tag}@emu.test`, { role: "parent" });
  P3 = await mkUser(`hh-p3-${tag}@emu.test`, { role: "parent" });
  P5 = await mkUser(`hh-p5-${tag}@emu.test`, { role: "parent" });
  SVIEW = await mkUser(`hh-sv-${tag}@emu.test`, { role: "staff", tenantId: A.tenantId, franchiseId: null, permRole: "hh-view", staffRole: "hh-view" });
  SNONE = await mkUser(`hh-sn-${tag}@emu.test`, { role: "staff", tenantId: A.tenantId, franchiseId: null, permRole: "hh-none", staffRole: "hh-none" });
  await enrol(A.tenantId, K1, "Ava One", P1); await enrol(A.tenantId, K2, "Ben Two", P1);
  await enrol(A.tenantId, K3, "Cy Three", P2); await enrol(B.tenantId, K4, "Di Four", P3);
  await enrol(A.tenantId, K5, "Ed Five", P5);
  // content: a topic, 6 one-mark questions, a quiz
  TOPIC = (await db.collection("hubTopics").add({ tenantId: A.tenantId, franchiseId: null, name: "Maths", subject: "Maths", subtopic: null, createdAt: now, updatedAt: now })).id;
  const qids: string[] = [];
  for (let i = 0; i < 6; i++) {
    qids.push((await db.collection("hubQuestions").add({ tenantId: A.tenantId, franchiseId: null, topicId: TOPIC, kind: "single", prompt: `Q${i + 1}?`, options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], answer: "a", acceptedAnswers: [], tolerance: 0, marks: 1, explanation: `KEY-${i}`, published: true, createdBy: "seed", createdAt: now, updatedAt: now })).id);
  }
  QID = qids[0];
  ASM = (await db.collection("hubAssessments").add({ tenantId: A.tenantId, franchiseId: null, type: "quiz", title: "HH quiz", subject: "Maths", topicIds: [TOPIC], questionIds: qids, timeLimitMins: null, passMarkPct: 70, published: true, createdBy: "seed", createdAt: now, updatedAt: now })).id;
  // a K3 attempt (another family's child) at A
  ATT_K3 = (await db.collection("hubAttempts").add({ tenantId: A.tenantId, franchiseId: null, assessmentId: ASM, assessmentType: "quiz", assessmentTitle: "HH quiz", subject: "Maths", passMarkPct: 70, homeworkId: null, childId: K3, childName: "Cy Three", parentUid: P2.uid, startedBy: P2.uid, submittedBy: null, startedAt: now, submittedAt: null, timeLimitMins: null, late: false, status: "in_progress", questions: [], answers: [], scoreMarks: 0, maxMarks: 6, pct: null, byTopic: {}, createdBy: P2.uid, createdAt: now, updatedAt: now })).id;
  // a live lesson for K1 + K3 starting now, with a board: the tutor's text, K1's stroke, K3's stroke
  LESSON = (await db.collection("hubLessons").add({ tenantId: A.tenantId, franchiseId: null, tutorUid: "tutor", tutorName: "Tutor", title: "HH lesson", topicId: null, startsAt: new Date(Date.now() - 5 * 60_000).toISOString(), durationMins: 60, childIds: [K1, K3], status: "scheduled", roomName: null, roomUrl: null, notes: "", attendance: {}, tutorJoinedAt: null, endedAt: null, createdBy: "seed", createdAt: now, updatedAt: now })).id;
  await db.collection("hubBoards").doc(LESSON).set({
    tenantId: A.tenantId, franchiseId: null, lessonId: LESSON, childIds: [K1, K3], updatedAt: "2026-10-10T09:00:00.000Z", updatedBy: "tutor", updatedByName: "Tutor",
    pages: [{ id: "p1", background: "blank", elements: [
      { id: "t1", k: "text", own: "T", z: 1, v: 1, x: 10, y: 10, text: "Hello" },
      { id: "e1", k: "text", own: `c:${K1}`, cid: K1, by: "Ava", z: 2, v: 1, x: 20, y: 20, text: "AVA-DRAWING" },
      { id: "e3", k: "text", own: `c:${K3}`, cid: K3, by: "Cy", z: 3, v: 1, x: 30, y: 30, text: "CY-DRAWING" },
    ] }],
  });
});

const hub = (path: string, tenant: Provider, extra = "") => `/api/learning-hub${path}${path.includes("?") ? "&" : "?"}tenantId=${tenant.tenantId}${extra}`;

describe("other tenant / other parent / unenrolled parent see nothing (LH03 LH04 LH06 LH07 LH08 LH30)", () => {
  it("a parent enrolled only at B asking for A: 404, the same body as a tenant that does not exist", async () => {
    const r = await call("GET", hub("/attempts", A, `&childId=${K4}`), P3.token);
    assert.equal(r.status, 404);
    const ghost = await call("GET", `/api/learning-hub/attempts?tenantId=nope-${tag}`, P3.token);
    assert.deepEqual(r.json, ghost.json);
  });
  it("a parent with no enrolment at all: 404", async () => {
    const nobody = await mkUser(`hh-p4-${tag}@emu.test`, { role: "parent" });
    assert.equal((await call("GET", hub("/attempts", A), nobody.token)).status, 404);
  });
  it("operator B lists attempts and opens A's attempt by id: nothing / 404", async () => {
    const list = await call("GET", "/api/learning-hub/attempts", B.token);
    assert.equal(list.status, 200);
    assert.ok(!JSON.stringify(list.json).includes(K3));
    assert.equal((await call("GET", `/api/learning-hub/attempts/${ATT_K3}`, B.token)).status, 404);
  });
  it("parent P1 reading or drafting on K3's running attempt: 404", async () => {
    assert.equal((await call("GET", hub(`/attempts/${ATT_K3}`, A), P1.token)).status, 404);
    assert.equal((await call("PUT", hub(`/attempts/${ATT_K3}/draft`, A), P1.token, { answers: [] })).status, 404);
  });
  it("parent P1 asking for K3 (another family's child at A): 404", async () => {
    assert.equal((await call("GET", hub("/attempts", A, `&childId=${K3}`), P1.token)).status, 404);
  });
});

describe("a withdrawn parent reads nothing after withdrawal (LH05)", () => {
  it("warm the enrolment cache, withdraw, read again at once: 404", async () => {
    assert.equal((await call("GET", hub("/attempts", A, `&childId=${K5}`), P5.token)).status, 200);
    assert.equal((await call("GET", hub("/attempts", A, `&childId=${K5}`), P5.token)).status, 200);
    await ok("DELETE", `/api/learning-hub/students/${K5}`, A.token);
    const r = await call("GET", hub("/attempts", A, `&childId=${K5}`), P5.token);
    assert.equal(r.status, 404, JSON.stringify(r.json));
  });
  it("withdrawn by a path that cannot clear this process's cache (doc flipped directly): the child routes still refuse", async () => {
    const K6 = `k6-${tag}`;
    const P6 = await mkUser(`hh-p6-${tag}@emu.test`, { role: "parent" });
    await enrol(A.tenantId, K6, "Flo Six", P6);
    assert.equal((await call("GET", hub("/attempts", A, `&childId=${K6}`), P6.token)).status, 200); // caches the enrolment
    await db.collection("hubEnrolments").doc(`${A.tenantId}__${K6}`).update({ active: false });
    const start = await call("POST", hub(`/assessments/${ASM}/attempts`, A, `&childId=${K6}`), P6.token, {});
    assert.equal(start.status, 404, JSON.stringify(start.json));
    const list = await call("GET", hub("/attempts", A, `&childId=${K6}`), P6.token);
    assert.equal(list.status, 404, JSON.stringify(list.json));
  });
});

describe("staff (LH11 LH12)", () => {
  it("no Learning Hub access: refused with a reason", async () => {
    const r = await call("GET", "/api/learning-hub/attempts", SNONE.token);
    assert.equal(r.status, 403); assert.equal(r.json.code, "no_access");
  });
  it("view only: reads work, writes are refused view_only", async () => {
    assert.equal((await call("GET", "/api/learning-hub/attempts", SVIEW.token)).status, 200);
    const w = await call("DELETE", `/api/learning-hub/students/${K1}`, SVIEW.token);
    assert.equal(w.status, 403); assert.equal(w.json.code, "view_only");
    const row = await db.collection("hubEnrolments").doc(`${A.tenantId}__${K1}`).get();
    assert.equal(row.get("active"), true);
  });
  it("staff keep whole-tenant access for now: a view-role member sees the tenant's attempts (documented in the Manual)", async () => {
    const r = await call("GET", "/api/learning-hub/attempts", SVIEW.token);
    assert.ok(JSON.stringify(r.json).includes(ATT_K3), "the whole tenant is visible to staff with the view level");
  });
});

describe("quiz starts: parallel, repeated, hammered (LH31 LH36)", () => {
  it("six parallel starts for one child and quiz make exactly one running attempt, and every reply names it", async () => {
    const replies = await Promise.all(Array.from({ length: 6 }, () => call("POST", hub(`/assessments/${ASM}/attempts`, A, `&childId=${K1}`), P1.token, {})));
    for (const r of replies) assert.ok(r.status === 200 || r.status === 201, JSON.stringify(r.json));
    const ids = new Set(replies.map((r) => r.json.attemptId));
    assert.equal(ids.size, 1, `one attempt id, got ${[...ids]}`);
    const docs = await db.collection("hubAttempts").where("tenantId", "==", A.tenantId).where("childId", "==", K1).where("assessmentId", "==", ASM).get();
    assert.equal(docs.size, 1, "one attempt document");
    // the running attempt never carries the key
    assert.ok(!JSON.stringify(replies[0].json).includes("KEY-"));
    assert.ok(!/"answer"|correctAnswer|acceptedAnswers/.test(JSON.stringify(replies[0].json)));
  });
  it("30 starts an hour per child: the 31st is refused with 429, a sibling is not", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 40; i++) codes.push((await call("POST", hub(`/assessments/${ASM}/attempts`, A, `&childId=${K1}`), P1.token, {})).status);
    assert.ok(codes.includes(429), `some start was limited: ${codes.join(",")}`);
    assert.ok(codes.filter((c) => c !== 429).length <= 24, "no more than 30 starts in total counted (6 already used)");
    const sibling = await call("POST", hub(`/assessments/${ASM}/attempts`, A, `&childId=${K2}`), P1.token, {});
    assert.ok(sibling.status === 200 || sibling.status === 201, JSON.stringify(sibling.json));
  });
});

describe("draft saves (LH35)", () => {
  let attempt = "";
  before(async () => {
    const r = await call("POST", hub(`/assessments/${ASM}/attempts`, A, `&childId=${K2}`), P1.token, {});
    attempt = r.json.attemptId; assert.ok(attempt, JSON.stringify(r.json));
  });
  it("an oversize draft is refused 413 and the earlier draft is kept", async () => {
    const small = await call("PUT", hub(`/attempts/${attempt}/draft`, A, `&childId=${K2}`), P1.token, { answers: [{ questionId: QID, response: "a" }], idx: 0 });
    assert.equal(small.status, 200, JSON.stringify(small.json));
    // each answer is cut to 10,000 characters, so six of them just exceed the 60 KB cap
    const att = (await db.collection("hubAttempts").doc(attempt).get()).data() as any;
    const wide = att.questions.map((q: any) => ({ questionId: q.id, response: "y".repeat(10_000) }));
    const huge = await call("PUT", hub(`/attempts/${attempt}/draft`, A, `&childId=${K2}`), P1.token, { answers: wide });
    assert.equal(huge.status, 413, JSON.stringify(huge.json).slice(0, 200));
    assert.equal(huge.json.code, "draft_too_large");
    const kept = (await db.collection("hubAttempts").doc(attempt).get()).get("draft");
    assert.ok(kept && JSON.stringify(kept).length < 60_000);
  });
  it("hammering the draft route is limited (429)", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 320; i++) codes.push((await call("PUT", hub(`/attempts/${attempt}/draft`, A, `&childId=${K2}`), P1.token, { answers: [{ questionId: QID, response: "a" }] })).status);
    assert.ok(codes.includes(429), "the draft route must rate-limit");
  });
});

describe("whiteboard (LH44 LH46)", () => {
  it("a parent sees the tutor's drawings and their own child's, never another child's", async () => {
    const p1 = await call("GET", hub(`/lessons/${LESSON}/board`, A, `&childId=${K1}`), P1.token);
    assert.equal(p1.status, 200);
    const s1 = JSON.stringify(p1.json);
    assert.ok(s1.includes("AVA-DRAWING") && s1.includes("Hello"));
    assert.ok(!s1.includes("CY-DRAWING") && !s1.includes(K3));
    const p2 = await call("GET", hub(`/lessons/${LESSON}/board`, A, `&childId=${K3}`), P2.token);
    const s2 = JSON.stringify(p2.json);
    assert.ok(s2.includes("CY-DRAWING") && !s2.includes("AVA-DRAWING") && !s2.includes(K1));
  });
  it("the tutor still sees everything", async () => {
    const t = JSON.stringify((await call("GET", `/api/learning-hub/lessons/${LESSON}/board`, A.token)).json);
    assert.ok(t.includes("AVA-DRAWING") && t.includes("CY-DRAWING"));
  });
  it("a stale save returns 409 and changes nothing; a save from the current copy works", async () => {
    const cur = (await call("GET", `/api/learning-hub/lessons/${LESSON}/board`, A.token)).json;
    const pages = [{ id: "p1", background: "blank", elements: [{ id: "t1", k: "text", own: "T", z: 1, v: 1, x: 1, y: 1, text: "TUTOR-ONE" }] }];
    const first = await call("PUT", `/api/learning-hub/lessons/${LESSON}/board`, A.token, { pages, baseUpdatedAt: cur.updatedAt });
    assert.equal(first.status, 200, JSON.stringify(first.json));
    const stalePages = [{ id: "p1", background: "blank", elements: [{ id: "t1", k: "text", own: "T", z: 1, v: 1, x: 1, y: 1, text: "TUTOR-TWO-OVERWRITE" }] }];
    const second = await call("PUT", `/api/learning-hub/lessons/${LESSON}/board`, A.token, { pages: stalePages, baseUpdatedAt: cur.updatedAt });
    assert.equal(second.status, 409, JSON.stringify(second.json));
    assert.equal(second.json.code, "board_stale");
    const stored = JSON.stringify((await db.collection("hubBoards").doc(LESSON).get()).get("pages"));
    assert.ok(stored.includes("TUTOR-ONE") && !stored.includes("TUTOR-TWO"));
    const noBase = await call("PUT", `/api/learning-hub/lessons/${LESSON}/board`, A.token, { pages: stalePages });
    assert.equal(noBase.status, 409, "a save that does not say which copy it started from is stale");
    const third = await call("PUT", `/api/learning-hub/lessons/${LESSON}/board`, A.token, { pages: stalePages, baseUpdatedAt: first.json.updatedAt });
    assert.equal(third.status, 200, JSON.stringify(third.json));
  });
});

describe("live lessons with no video key (LH63)", () => {
  it("the tutor and the family get a clear 'not switched on yet' message, never a 503", async () => {
    const fam = await call("POST", hub(`/lessons/${LESSON}/join`, A, `&childId=${K1}`), P1.token, { childId: K1 });
    assert.notEqual(fam.status, 503, JSON.stringify(fam.json));
    assert.equal(fam.json.code, "video_not_switched_on", JSON.stringify(fam.json));
    assert.match(fam.json.error, /not switched on yet/i);
    const tut = await call("POST", `/api/learning-hub/lessons/${LESSON}/join`, A.token, {});
    assert.notEqual(tut.status, 503, JSON.stringify(tut.json));
    assert.equal(tut.json.code, "video_not_switched_on");
  });
});

describe("owner tenants are a flag on the tenant doc (G6)", () => {
  it("ownsSharedSource reads the flag; the old hardcoded ids mean nothing any more", async () => {
    const { ownsSharedSource, forgetOwnsSharedSource } = await import("../../server/src/lib/hubCore");
    const T1 = `own-flag-${tag}`, T2 = "7jG2XO3cOD3VtoL8YfFY";
    await db.collection("tenants").doc(T1).set({ name: "flagged", ownsSharedSource: true });
    forgetOwnsSharedSource();
    assert.equal(await ownsSharedSource(T1), true);
    assert.equal(await ownsSharedSource(`missing-${tag}`), false);
    // the former hardcoded id, with no flag on its doc (it does not exist in this emulator), is an ordinary tenant now
    assert.equal(await ownsSharedSource(T2), false);
    await db.collection("tenants").doc(T1).delete();
  });
});

describe("publisher name never reaches a bell or an email subject (LH57)", () => {
  it("notifyFamilies scrubs the title and body it stores", async () => {
    const { notifyFamilies } = await import("../../server/src/lib/hubNotify");
    const sent = await notifyFamilies({ tenantId: A.tenantId, childIds: [K1], compose: () => ({ title: "New lesson from Oak National Academy", body: "Ava has a new lesson. Content from Oak National Academy, Open Government Licence." }) });
    assert.ok(sent >= 1);
    await new Promise((r) => setTimeout(r, 400));
    const rows = await db.collection("notifications").where("tenantId", "==", A.tenantId).get();
    const mine = rows.docs.filter((d) => JSON.stringify(d.data()).includes("Ava has a new lesson"));
    assert.ok(mine.length >= 1, "the bell entry exists");
    for (const d of mine) assert.ok(!/oak national|open government|\bOGL\b/i.test(JSON.stringify(d.data())), JSON.stringify(d.data()));
  });
});
