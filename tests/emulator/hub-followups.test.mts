// Learning Hub follow-ups (10 Oct 2026): behaviour against the REAL API + Firestore emulator (npm run test:emu). Children's data, synthetic only.
//   P  a child's data in the 11 game / quiz / lesson-view collections is EXPORTED and ERASED (only that child; other child + other tenant untouched)
//   S  staff with a missing role / no role / invalid cap level read NO learning data; PUT /api/library refuses an invalid cap level
//   N  GET /notes/:id never returns the publisher link
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { call, db, login, makeProvider, ok, sleep, uniq, type Provider } from "./helpers.mts";
import { eraseChildLearning, exportChildLearning } from "../../server/src/lib/hubPrivacy";

const now = new Date().toISOString();
const tag = uniq();
const C1 = `fu-c1-${tag}`, C2 = `fu-c2-${tag}`; // C1 is erased/exported; C2 is a sibling-in-another-family that must be untouched
const T1 = `fu-t1-${tag}`, T2 = `fu-t2-${tag}`;
const COLS = ["hubAppliedSessions", "hubAppliedState", "hubBotPuzzleState", "hubMiniGameProfile", "hubSortRoundState", "hubTrainingItemState", "hubQuizItemState", "hubQuizProfile", "hubQuizArcadeMastery", "hubQuizArcadeProfile", "hubLessonViews"] as const;
const docId = (col: string, tenant: string, child: string) => `${col}-${tenant}-${child}`;
const seed = (col: string, tenant: string, child: string) =>
  db.collection(col).doc(docId(col, tenant, child)).set({ tenantId: tenant, franchiseId: null, childId: child, gameId: "g", status: "done", marker: `MARK-${child}-${tenant}`, ...(col === "hubAppliedSessions" ? { items: [{ answerKey: `SECRET-${child}` }] } : {}), createdAt: now, updatedAt: now });

describe("P: privacy export and erase cover the 11 game / quiz / lesson-view collections", () => {
  before(async () => {
    for (const c of COLS) { await seed(c, T1, C1); await seed(c, T2, C1); await seed(c, T1, C2); await seed(c, T2, C2); }
  });
  it("export holds the child's docs from every collection, never the other child's, and never an answer key", async () => {
    const out = JSON.stringify(await exportChildLearning(`fu-parent-${tag}`, [C1]));
    for (const c of COLS) {
      for (const t of [T1, T2]) assert.ok(out.includes(docId(c, t, C1)) || out.includes(`MARK-${C1}-${t}`), `${c}@${t}: C1 missing from export`);
    }
    assert.ok(!out.includes(`MARK-${C2}`), "other child's data leaked into the export");
    assert.ok(!out.includes("SECRET-"), "an applied-game answer key was exported");
  });
  it("erase removes the child's docs everywhere and leaves the other child's alone", async () => {
    await eraseChildLearning(C1);
    for (const c of COLS) {
      for (const t of [T1, T2]) {
        assert.equal((await db.collection(c).doc(docId(c, t, C1)).get()).exists, false, `${c}@${t}: C1 doc survived erase`);
        assert.equal((await db.collection(c).doc(docId(c, t, C2)).get()).exists, true, `${c}@${t}: C2 doc was wrongly erased`);
      }
    }
  });
  it("after erase the child's export is empty of those collections; erasing twice is safe", async () => {
    await eraseChildLearning(C1);
    const out = JSON.stringify(await exportChildLearning(`fu-parent-${tag}`, [C1]));
    assert.ok(!out.includes(`MARK-${C1}`));
  });
});

describe("S: staff fail CLOSED on children's learning data; the roles save validates cap levels", () => {
  let A: Provider;
  const staff: Record<string, string> = {};
  const mkStaff = async (key: string, doc: Record<string, unknown>) => {
    const email = `fu-${key}-${tag}@emu.test`;
    const s = await login(email);
    await db.collection("users").doc(s.uid).set({ email, chosen: true, name: email, role: "staff", tenantId: A.tenantId, franchiseId: null, ...doc }, { merge: true });
    staff[key] = s.token;
  };
  const lib = async () => (await ok("GET", "/api/library", A.token)) ?? {};
  const put = (settings: Record<string, unknown>) => call("PUT", "/api/library", A.token, { settings });
  before(async () => {
    A = await makeProvider(`fuA${tag}`);
    const l = await lib();
    const r = await put({ ...(l.settings ?? {}), features: { ...(l.settings?.features ?? {}), learninghub: true }, rolesSetAt: now, roles: [{ id: "fu-view", name: "view", caps: { learninghub: "view" } }, { id: "fu-bad", name: "bad", caps: { learninghub: "view" } }] });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    // an invalid level can only get into storage by writing Firestore directly; the API must treat it as no access anyway
    await db.collection("libraries").doc(A.tenantId).set({ settings: { roles: [{ id: "fu-view", name: "view", caps: { learninghub: "view" } }, { id: "fu-bad", name: "bad", caps: { learninghub: "NONE" } }, { id: "fu-bogus", name: "bogus", caps: { learninghub: "bogus" } }] } }, { merge: true });
    await mkStaff("view", { permRole: "fu-view", staffRole: "fu-view" });
    await mkStaff("missing", { permRole: "deleted-role", staffRole: "deleted-role" });
    await mkStaff("norole", {});
    await mkStaff("upper", { permRole: "fu-bad", staffRole: "fu-bad" });
    await mkStaff("bogus", { permRole: "fu-bogus", staffRole: "fu-bogus" });
    await sleep(10_500); // the API caches settings for 10 s
  });
  it("control: a staff member with a valid view role reads", async () => {
    assert.equal((await call("GET", "/api/learning-hub/attempts", staff.view!)).status, 200);
  });
  it("role id missing from the matrix: 403", async () => {
    assert.equal((await call("GET", "/api/learning-hub/attempts", staff.missing!)).status, 403);
    assert.equal((await call("GET", "/api/learning-hub/lessons", staff.missing!)).status, 403);
  });
  it("no role at all: 403", async () => {
    assert.equal((await call("GET", "/api/learning-hub/attempts", staff.norole!)).status, 403);
  });
  it("an invalid cap level ('NONE', 'bogus') grants nothing: 403", async () => {
    assert.equal((await call("GET", "/api/learning-hub/attempts", staff.upper!)).status, 403);
    assert.equal((await call("GET", "/api/learning-hub/attempts", staff.bogus!)).status, 403);
  });
  it("PUT /api/library refuses an invalid cap level (400) and stores nothing", async () => {
    const l = await lib();
    for (const bad of ["NONE", "bogus", "", 0, true, null]) {
      const r = await put({ ...(l.settings ?? {}), roles: [{ id: "fu-x", name: "x", caps: { learninghub: bad } }] });
      assert.equal(r.status, 400, `${JSON.stringify(bad)} -> ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
    }
    assert.equal((await put({ ...(l.settings ?? {}), roles: "nope" })).status, 400);
    const stored = (await lib()).settings?.roles ?? [];
    assert.ok(!stored.some((x: any) => x.id === "fu-x"), "an invalid role was stored");
  });
  it("PUT /api/library still accepts valid levels", async () => {
    const l = await lib();
    const r = await put({ ...(l.settings ?? {}), roles: [{ id: "fu-ok", name: "ok", caps: { learninghub: "edit", bookings: "view", finances: "none" } }] });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  });
});

describe("N: GET /notes/:id never returns the publisher link", () => {
  it("owner and staff get the lesson without lesson.source.url", async () => {
    const A = await makeProvider(`fuN${tag}`);
    const l = (await ok("GET", "/api/library", A.token)) ?? {};
    await ok("PUT", "/api/library", A.token, { settings: { ...(l.settings ?? {}), features: { ...(l.settings?.features ?? {}), learninghub: true } } });
    const topic = await db.collection("hubTopics").add({ tenantId: A.tenantId, franchiseId: null, name: "Maths", subject: "Maths", subtopic: null, createdAt: now, updatedAt: now });
    const note = await db.collection("hubNotes").add({
      tenantId: A.tenantId, franchiseId: null, topicId: topic.id, title: "Fractions", kind: "lesson", body: "", published: true,
      lesson: { year: "5", source: { provider: "oak", url: "https://www.thenational.academy/teachers/lessons/fu-test", licence: "OGL-3.0" }, widget: null },
      createdBy: "seed", createdByName: "Seed", createdAt: now, updatedAt: now,
    });
    const r = await call("GET", `/api/learning-hub/notes/${note.id}`, A.token);
    assert.equal(r.status, 200, JSON.stringify(r.json).slice(0, 300));
    assert.equal(r.json.title, "Fractions");
    assert.ok(!JSON.stringify(r.json).includes("thenational"), "publisher link returned");
    assert.ok(!/oak national|OGL/i.test(JSON.stringify(r.json)));
  });
});
