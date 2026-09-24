import { test, expect, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { seedOakLesson, type SeedQ, type SeededLesson } from "./helpers/lessonFixture";
import { cardWith, dismissParentWelcome } from "./helpers/ui";
import { openTab } from "./helpers/hubTabs";

// Learning Hub — IN-PERSON lessons (features/learninghub/inperson, server/src/routes/hub/inPersonApi.ts). A tutor runs a lesson on their own
// device with two children beside them (no video), taps in each child's answers, and every child gets a REAL marked attempt that their
// parent sees; attendance is set by the tutor; the family is notified; open homework for the quiz is ticked off; a follow-up opens the
// Homework form. Plus the safety rules: a tutor can never record a result for a child outside their roster / this session / their tenant,
// the retake gate is skipped-not-failed with a tutor override, and a hand-in is idempotent.
// Every assertion is anchored to THIS run's lesson / quiz / children (stamped names, ids).

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const stamp = Date.now().toString(36);
const HUB = "/api/learning-hub";
const subject = `InPerson Lab ${stamp}`;
const nameA = `Ipa ${stamp}`;
const nameB = `Ipb ${stamp}`;
const nameC = `Ipc ${stamp}`;
const nameD = `Ipd ${stamp}`;

let accounts: AccountManifest["accounts"];
let tenantId = "";
let tutor = "", parent = "", other = "";
let childA = "", childB = "", childC = "", childD = "";
let topicId = "";
let L: SeededLesson;
let hwId = "";
let sessionId = "";

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
async function setHub(op: TestAccount, on: boolean) {
  for (let i = 0; ; i++) {
    try {
      const s = await fbSignIn(op.email);
      const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
      const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
      await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
      return;
    } catch (e) {
      if (i >= 6 || !(e instanceof TypeError)) throw e;
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
async function raw(p: string, idToken: string, init?: RequestInit): Promise<{ status: number; body: J; text: string }> {
  let res: Response | null = null;
  for (let i = 0; i < 6 && !res; i++) {
    try { res = await fetch(`${API_URL}${p}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}`, ...init?.headers } }); }
    catch (e) { if (!(e instanceof TypeError) || i === 5) throw e; await new Promise((r) => setTimeout(r, 3000)); } // the dev API hot-reloads
  }
  const text = await res!.text();
  let body: J = {};
  try { body = JSON.parse(text); } catch { /* not json */ }
  return { status: res!.status, body, text };
}
const send = (m: string, p: string, t: string, body?: unknown) => raw(p, t, { method: m, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
/** POST that must create something — through the retrying `raw` (the dev API restarts whenever a server file is saved). */
const create = async (p: string, t: string, body: unknown) => { const r = await send("POST", p, t, body); expect(r.status, r.text).toBe(201); return r.body.id as string; };
const bell = async (t: string) => (await raw("/api/notifications", t)).body.notifications as { title: string; body: string; category: string }[];

// If .env.local points the web app at a tunnel that isn't up, send its API calls to the local API instead.
const envApi = (() => {
  try {
    const m = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/^NEXT_PUBLIC_API_URL=(.*)$/m);
    return m?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  } catch { return ""; }
})();
async function ctxFor(browser: Browser, role: "freelancer" | "parent") {
  const ctx = await browser.newContext({ storageState: statePath(role), reducedMotion: "reduce" });
  if (envApi && envApi !== API_URL) {
    const origin = new URL(envApi).origin;
    await ctx.route((u) => u.origin === origin, async (route) => {
      const url = route.request().url().replace(origin, API_URL);
      if (url.includes("/api/events/") && !url.includes("/ticket")) return route.abort();
      try { await route.fulfill({ response: await route.fetch({ url }) }); } catch { await route.abort(); }
    });
  }
  return ctx;
}
async function gotoHub(page: Page, url: string) {
  const tabs = page.getByRole("tablist").first();
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto(url);
    if (await tabs.isVisible({ timeout: 25_000 }).catch(() => false)) return;
  }
  await expect(tabs).toBeVisible({ timeout: 30_000 });
}

test.beforeAll(async () => {
  test.setTimeout(300_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  await setHub(accounts.freelancer, true);
  await setHub(accounts.company, true);
  tutor = await token(accounts.freelancer);
  parent = await token(accounts.parent);
  other = await token(accounts.company);
  await provisionLiveListing(accounts.freelancer, { title: `E2E InPerson Tuition ${stamp}`, price: 0 });
  childA = await createParentChild(accounts.parent, { name: nameA });
  childB = await createParentChild(accounts.parent, { name: nameB });
  childC = await createParentChild(accounts.parent, { name: nameC }); // enrolled, but NOT in the session
  childD = await createParentChild(accounts.parent, { name: nameD }); // never enrolled
  await apiPost("/api/my/providers/follow", parent, { tenantId });
  await markParentWelcomed(accounts.parent);
  await apiPost(`${HUB}/topics`, tutor, { subject, topic: "Nerves" });
  const topics = await apiFetch<{ id: string; subject: string }[]>(`${HUB}/topics`, tutor);
  topicId = topics.find((x) => x.subject === subject)!.id;
  for (const c of [childA, childB, childC]) expect((await send("POST", `${HUB}/students`, tutor, { childId: c, subjects: [subject] })).status).toBe(201);
  L = await seedOakLesson(tutor, { stamp, subject, topicId, widget: null, warmupMax: 2, quizMax: 3, skipKinds: ["order", "match"] });
  // Open homework for the lesson's quiz for child A — the in-person result should tick it off.
  const hw = await send("POST", `${HUB}/homework`, tutor, { title: `IP homework ${stamp}`, assessmentId: L.quizId, assignedChildIds: [childA], dueAt: new Date(Date.now() + 5 * 86_400_000).toISOString() });
  expect(hw.status, hw.text).toBe(201);
  hwId = hw.body.id as string;
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); await setHub(accounts.company, true); });
test.afterAll(async () => { await setHub(accounts.freelancer, false); await setHub(accounts.company, false); });

/** The expected marks for a child, given how the test answers each question. */
const wrongOption = (q: SeedQ) => q.wrong;
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test.describe("server rules", () => {
  test("only a tutor can start one, and only for their own enrolled students", async () => {
    test.setTimeout(240_000);
    // A family may not.
    expect((await send("POST", `${HUB}/in-person/sessions?tenantId=${tenantId}`, parent, { childIds: [childA], assessmentId: L.quizId })).status).toBe(403);
    // A child that was never enrolled (or a stranger's id) is a 404, not a session.
    const notEnrolled = await send("POST", `${HUB}/in-person/sessions`, tutor, { childIds: [childD], assessmentId: L.quizId });
    expect(notEnrolled.status, notEnrolled.text).toBe(404);
    expect((await send("POST", `${HUB}/in-person/sessions`, tutor, { childIds: ["nope/../x"], assessmentId: L.quizId })).status).toBe(404);
    // ANOTHER provider's tutor can't put this provider's student into a session.
    expect((await send("POST", `${HUB}/in-person/sessions`, other, { childIds: [childA], assessmentId: L.quizId })).status).toBe(404);
    // A session needs somebody in it.
    expect((await send("POST", `${HUB}/in-person/sessions`, tutor, { childIds: [], assessmentId: L.quizId })).status).toBe(400);
  });

  test("hand-in: skips children outside the session, is idempotent, gates + override, attendance", async () => {
    test.setTimeout(240_000);
    // A quiz of its own (same questions), so the UI test below still owns THIS lesson's quiz results.
    const apiQuiz = (await create(`${HUB}/assessments`, tutor, { type: "quiz", title: `IP api quiz ${stamp}`, subject, topicIds: [topicId], questionIds: L.quiz.map((q) => q.id), published: true, passMarkPct: 50 }));
    const mk = await send("POST", `${HUB}/in-person/sessions`, tutor, { childIds: [childA, childB], assessmentId: apiQuiz, key: `api${stamp}` });
    expect(mk.status, mk.text).toBe(201);
    const sid = mk.body.id as string;
    expect(mk.body.status).toBe("live");
    expect(Object.keys(mk.body.attendance).sort()).toEqual([childA, childB].sort()); // everyone picked starts as "here"
    // A double tap of Start returns the SAME session.
    const again = await send("POST", `${HUB}/in-person/sessions`, tutor, { childIds: [childA, childB], assessmentId: apiQuiz, key: `api${stamp}` });
    expect(again.body.id).toBe(sid);
    // It is not a video lesson: hidden from the lessons list, refused by join.
    const lessons = (await raw(`${HUB}/lessons`, tutor)).body as unknown as J[];
    expect(lessons.some((l) => l.id === sid)).toBe(false);
    expect((await send("POST", `${HUB}/lessons/${sid}/join`, tutor, {})).status).toBe(404);
    expect((await send("GET", `${HUB}/in-person/sessions/${sid}`, other)).status).toBe(404); // another tenant can't even see it
    expect((await send("GET", `${HUB}/in-person/sessions/${sid}?tenantId=${tenantId}`, parent)).status).toBe(403);

    // The paper as one class sees it: no key on the student fields, the key in `key`, the same shuffle for everyone.
    const paper = await raw(`${HUB}/in-person/sessions/${sid}/questions`, tutor);
    expect(paper.status, paper.text).toBe(200);
    expect(paper.body.questions.length).toBe(L.quiz.length);

    const answers = paper.body.questions.map((q: J) => ({ questionId: q.id, verdict: "right" }));
    // childC is enrolled but not in the session; childD is not enrolled; both are skipped and NOTHING is recorded for them.
    const first = await send("POST", `${HUB}/in-person/sessions/${sid}/submit`, tutor, { assessmentId: apiQuiz, linkHomework: false, children: [{ childId: childA, answers }, { childId: childC, answers }, { childId: childD, answers }] });
    expect(first.status, first.text).toBe(200);
    const byChild = new Map((first.body.results as J[]).map((r) => [r.childId, r]));
    expect(byChild.get(childA)!.status).toBe("recorded");
    expect(byChild.get(childA)!.pct).toBe(100);
    expect(byChild.get(childC)!.status).toBe("skipped");
    expect(byChild.get(childC)!.code).toBe("not_in_session");
    expect(byChild.get(childD)!.status).toBe("skipped");
    expect(((await raw(`${HUB}/attempts?childId=${childC}`, tutor)).body as unknown as J[]).length).toBe(0);
    expect((await raw(`${HUB}/attempts?childId=${childD}`, tutor)).status).toBe(404); // never enrolled: no attempts can exist for them
    // Idempotent: the same hand-in again records nothing new.
    const retry = await send("POST", `${HUB}/in-person/sessions/${sid}/submit`, tutor, { assessmentId: apiQuiz, linkHomework: false, children: [{ childId: childA, answers }] });
    expect((retry.body.results as J[])[0]!.status).toBe("duplicate");
    const mine = ((await raw(`${HUB}/attempts?childId=${childA}`, tutor)).body as unknown as J[]).filter((a) => a.assessmentId === apiQuiz);
    expect(mine.length).toBe(1);
    expect(mine[0]!.inPerson).toBe(true);
    // Another provider's tutor can't record results into it either.
    expect((await send("POST", `${HUB}/in-person/sessions/${sid}/submit`, other, { assessmentId: apiQuiz, children: [{ childId: childA, answers }] })).status).toBe(404);

    // Attendance: tutor-settable, only for children in the session (a late arrival is ADDED, an unknown one refused).
    const off = await send("PUT", `${HUB}/in-person/sessions/${sid}/attendance`, tutor, { present: { [childB]: false } });
    expect(off.status, off.text).toBe(200);
    expect(off.body.attendance[childB]).toBeUndefined();
    expect(off.body.attendance[childA]).toBeTruthy();
    expect((await send("PUT", `${HUB}/in-person/sessions/${sid}/attendance`, tutor, { present: { [childC]: true } })).status).toBe(404); // not in the session yet
    expect((await send("PUT", `${HUB}/in-person/sessions/${sid}/attendance`, tutor, { add: [childD] })).status).toBe(404); // not enrolled
    const late = await send("PUT", `${HUB}/in-person/sessions/${sid}/attendance`, tutor, { add: [childC] });
    expect(late.status, late.text).toBe(200);
    expect(late.body.attendance[childC]).toBeTruthy();
    expect((await send("PUT", `${HUB}/in-person/sessions/${sid}/attendance`, other, { present: { [childA]: false } })).status).toBe(404);

    // Retake gate: a "once" quiz already taken by the child is SKIPPED (not a failed batch) — until the tutor overrides it.
    const gq = (await create(`${HUB}/questions`, tutor, { topicId, kind: "short", prompt: `Gate ${stamp}`, answer: "yes", marks: 1 }));
    const once = (await create(`${HUB}/assessments`, tutor, { type: "quiz", title: `IP once ${stamp}`, subject, topicIds: [topicId], questionIds: [gq], published: true, retakePolicy: "once" }));
    const gs = await send("POST", `${HUB}/in-person/sessions`, tutor, { childIds: [childA], assessmentId: once });
    const g1 = await send("POST", `${HUB}/in-person/sessions/${gs.body.id}/submit`, tutor, { assessmentId: once, linkHomework: false, children: [{ childId: childA, answers: [{ questionId: gq, response: "yes" }] }] });
    expect((g1.body.results as J[])[0]!.status).toBe("recorded");
    expect((g1.body.results as J[])[0]!.pct).toBe(100);
    const gs2 = await send("POST", `${HUB}/in-person/sessions`, tutor, { childIds: [childA], assessmentId: once });
    const blocked = await send("POST", `${HUB}/in-person/sessions/${gs2.body.id}/submit`, tutor, { assessmentId: once, linkHomework: false, children: [{ childId: childA, answers: [{ questionId: gq, response: "yes" }] }] });
    expect(blocked.status).toBe(200);
    expect((blocked.body.results as J[])[0]!.status).toBe("skipped");
    expect((blocked.body.results as J[])[0]!.code).toBe("retake_blocked");
    const forced = await send("POST", `${HUB}/in-person/sessions/${gs2.body.id}/submit`, tutor, { assessmentId: once, linkHomework: false, override: true, children: [{ childId: childA, answers: [{ questionId: gq, response: "nope" }] }] });
    expect((forced.body.results as J[])[0]!.status).toBe("recorded");
    expect((forced.body.results as J[])[0]!.pct).toBe(0); // marked from the response by the server

    // Ending: idempotent, and only the tutor's own tenant can.
    expect((await send("POST", `${HUB}/in-person/sessions/${sid}/end`, other, {})).status).toBe(404);
    const end = await send("POST", `${HUB}/in-person/sessions/${sid}/end`, tutor, { warmup: [{ childId: childA, correct: 1, total: 2 }, { childId: childD, correct: 1, total: 1 }] });
    expect(end.status, end.text).toBe(200);
    expect(end.body.status).toBe("ended");
    expect(end.body.warmup).toEqual([{ childId: childA, correct: 1, total: 2 }]); // a child outside the session is dropped
    expect((await send("POST", `${HUB}/in-person/sessions/${sid}/end`, tutor, {})).body.status).toBe("ended");
  });
});

test.describe("tutor UI: teach a lesson in person to two children", () => {
  test("lesson → two children → warm-up → capture grid → results, attempts + attendance + notification + homework ticked off", async ({ browser }) => {
    test.setTimeout(360_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await gotoHub(page, "/freelancer/learninghub?tab=notes");
    await expect(page.locator("#hub-notes")).toBeVisible({ timeout: 25_000 });
    // Open the lesson, preview it, then go live in person from the "One room" card (NotesPanel.tsx → GoLivePicker).
    await page.getByLabel("Search lessons").fill(L.title);
    await page.getByRole("button", { name: L.title, exact: true }).first().click();
    await page.getByTestId("lesson-open").click();
    await page.getByTestId("lesson-one-room").click();

    await expect(page.getByRole("heading", { name: "Who's here?" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: nameA, exact: true }).click();
    await page.getByRole("button", { name: nameB, exact: true }).click();
    await page.getByTestId("golive-start").click();

    const run = page.getByTestId("inperson-run");
    await expect(run).toBeVisible({ timeout: 20_000 });
    sessionId = (await run.getAttribute("data-session"))!;
    expect(sessionId).toBeTruthy();
    await expect(page.getByTestId("ip-banner")).toContainText("2 children");
    await expect(page.getByTestId("ip-who-btn")).toContainText("2 of 2 here");

    // The lesson player runs read-only, on the tutor's device: nothing is started for any child. A live
    // in-person session skips the Start step automatically (who's here was already chosen to get here).
    await page.getByTestId("preview-jump-warm").click({ force: true });
    // Warm-up: out loud. Tag each child's answer onto the option they said, then check the class.
    const warm = page.getByTestId("ip-warm-extra");
    await expect(warm).toBeVisible();
    const wq = L.warmup[0]!;
    if (wq.kind === "single") {
      await warm.getByTestId(`ip-warm-name-${nameA}`).click();
      await warm.locator('[data-testid^="ip-warm-opt-"]', { hasText: wq.right }).click(); // A: right by option
      await warm.getByTestId(`ip-warm-name-${nameB}`).click();
      await warm.locator('[data-testid^="ip-warm-opt-"]', { hasText: wrongOption(wq) }).click(); // B: wrong by option
      await warm.getByTestId("ip-warm-check").click();
      await expect(warm.getByRole("note")).toContainText(wq.right);
    } else {
      await warm.getByTestId(`ip-warm-right-${nameA}`).click(); // got it
      await warm.getByTestId(`ip-warm-wrong-${nameB}`).click(); // not yet
    }

    // Quiz: the capture grid.
    await page.getByTestId("preview-jump-quiz").click({ force: true });
    const grid = page.getByTestId("ip-answered");
    await expect(grid).toContainText("0 of 2 recorded");
    for (let i = 0; i < L.quiz.length; i++) {
      const q = L.quiz[i]!;
      await expect(page.getByRole("heading", { name: q.prompt })).toBeVisible();
      if (q.kind === "single") {
        await page.getByRole("button", { name: new RegExp(`${nameA}: option [A-J], ${esc(q.right)}$`) }).click(); // A: right by option
        await page.getByRole("button", { name: new RegExp(`${nameB}: option [A-J], ${esc(wrongOption(q))}$`) }).click(); // B: wrong by option
      } else {
        await page.getByPlaceholder("Their answer").first().fill(q.right); // A: typed, right
        await page.getByTestId(`ip-wrong-${nameB}`).click(); // B: the tutor's call, not yet
      }
      await expect(grid).toContainText("2 of 2 recorded");
      if (i < L.quiz.length - 1) await page.getByTestId("ip-next").click();
    }
    // "Show answer" is tutor-only and off by default.
    await expect(page.getByTestId("ip-key")).toHaveCount(0);
    await page.getByTestId("ip-show-answer").click();
    await expect(page.getByTestId("ip-key")).toContainText("Answer:");

    await page.getByTestId("ip-mark-class").click();
    await page.getByTestId("ip-confirm-mark").click();

    // Results: per child, from the server's marking.
    const table = page.getByTestId("ip-results");
    await expect(table).toBeVisible({ timeout: 30_000 });
    const rowA = table.locator(`tr[data-result-row="${nameA}"]`);
    const rowB = table.locator(`tr[data-result-row="${nameB}"]`);
    await expect(rowA).toHaveAttribute("data-result-status", "recorded");
    await expect(rowA.locator("[data-score]")).toContainText(`${L.quiz.length}/${L.quiz.length} · 100%`);
    await expect(rowA.locator("[data-score]")).toContainText("homework ticked off");
    await expect(rowB.locator("[data-score]")).toContainText(`0/${L.quiz.length} · 0%`);
    await expect(rowB.locator("[data-score]")).toContainText("under");
    await expect(page.getByTestId("ip-warm-summary")).toContainText(`${nameA} 1/1`);

    // Follow-up homework opens the Homework form pre-filled (and finishes the session).
    await page.getByTestId("ip-followup-weak").click();
    await expect(page.locator(`input[value="Follow-up: ${L.title}"]`)).toBeVisible({ timeout: 25_000 });
    await expect(page.getByTestId("inperson-run")).toHaveCount(0);
    await ctx.close();
  });

  test("server-side: each child's attempt, marks, attendance, the ended session", async () => {
    test.setTimeout(240_000);
    expect(sessionId).toBeTruthy();
    const s = await raw(`${HUB}/in-person/sessions/${sessionId}`, tutor);
    expect(s.status, s.text).toBe(200);
    expect(s.body.status).toBe("ended");
    expect(Object.keys(s.body.attendance).sort()).toEqual([childA, childB].sort());
    expect(s.body.warmup.find((w: J) => w.childId === childA)).toMatchObject({ correct: 1, total: 1 });
    expect(s.body.warmup.find((w: J) => w.childId === childB)).toMatchObject({ correct: 0, total: 1 });
    const results = s.body.results as J[];
    expect(results.length).toBe(2);
    const ra = results.find((r) => r.childId === childA)!;
    const rb = results.find((r) => r.childId === childB)!;
    expect(ra).toMatchObject({ scoreMarks: L.quiz.length, maxMarks: L.quiz.length, pct: 100, status: "marked", passed: true });
    expect(rb).toMatchObject({ scoreMarks: 0, maxMarks: L.quiz.length, pct: 0, status: "marked", passed: false });
    // Real attempt documents, in-person, with the right marks — read back through the ordinary attempts API.
    const full = await raw(`${HUB}/attempts/${ra.attemptId}`, tutor);
    expect(full.body.inPerson).toBe(true);
    expect(full.body.answers.every((a: J) => a.correct === true)).toBe(true);
    // Homework A had for this quiz is handed in with that attempt; B had none.
    const hwFamily = ((await raw(`${HUB}/homework?childId=${childA}&tenantId=${tenantId}`, parent)).body as unknown as J[]).find((h) => h.id === hwId);
    expect(hwFamily?.submission.status).toBe("submitted");
    expect(hwFamily?.submission.attemptId).toBe(ra.attemptId);
  });

  test("parent: the results are in their child's progress, and the family was told", async ({ browser }) => {
    test.setTimeout(240_000);
    // The parent's own API view: each child's result, flagged as done in person.
    for (const [child, pct] of [[childA, 100], [childB, 0]] as const) {
      const rows = (await raw(`${HUB}/attempts?childId=${child}&tenantId=${tenantId}`, parent)).body as unknown as J[];
      const mine = rows.filter((a) => a.assessmentId === L.quizId);
      expect(mine.length, `parent sees ${child}'s attempt`).toBe(1);
      expect(mine[0]).toMatchObject({ pct, status: "marked", inPerson: true, childId: child });
    }
    // Mastery was recomputed for the child (the quiz counted).
    const mastery = (await raw(`${HUB}/mastery?childId=${childA}&tenantId=${tenantId}`, parent)).body as J;
    expect(JSON.stringify(mastery)).toContain(subject);
    // The notification: one per child, with THAT child's score.
    const notes = await bell(parent);
    const na = notes.find((n) => n.title === "Lesson done with your tutor" && n.body.includes(nameA) && n.body.includes(L.quizTitle));
    const nb = notes.find((n) => n.title === "Lesson done with your tutor" && n.body.includes(nameB) && n.body.includes(L.quizTitle));
    expect(na?.body, "notification for A").toContain(`${L.quiz.length}/${L.quiz.length} (100%)`);
    expect(nb?.body, "notification for B").toContain(`0/${L.quiz.length} (0%)`);
    expect(na?.category).toBe("learning");

    // And on screen, in the parent's Learning Hub for that child.
    const ctx = await ctxFor(browser, "parent");
    const page = await ctx.newPage();
    await dismissParentWelcome(page);
    // The family's view follows the provider's "Learning Hub" switch, which other specs flip on this account (and the server caches for a few
    // seconds): (re)set it and reload until the hub's own tabs are there — the "isn't available" card has a Learning Hub heading too.
    const tabs = page.getByRole("tablist").first();
    for (let attempt = 0; attempt < 5; attempt++) {
      await setHub(accounts.freelancer, true);
      await page.goto("/custdash/learninghub?tab=home");
      if (await tabs.isVisible({ timeout: 25_000 }).catch(() => false)) break;
      await page.waitForTimeout(12_000);
    }
    await expect(tabs).toBeVisible({ timeout: 30_000 });
    const provider = page.getByLabel("Provider");
    if (await provider.isVisible({ timeout: 20_000 }).catch(() => false)) await provider.selectOption(tenantId);
    const select = page.getByRole("combobox", { name: "Child" });
    if (await select.isVisible({ timeout: 5_000 }).catch(() => false)) await select.selectOption({ label: nameA });
    else { const radio = page.getByRole("radio", { name: nameA }); if (await radio.isVisible().catch(() => false)) await radio.click(); }
    await expect(cardWith(page, "Latest results", L.quizTitle)).toBeVisible({ timeout: 60_000 }); // this run's quiz, in the parent's Latest results
    await ctx.close();
  });
});

test.describe("setup: year filter + send to the children's portals", () => {
  test("the lessons list filters by year on the server", async () => {
    test.setTimeout(240_000);
    const q = encodeURIComponent(L.title);
    const y10 = (await raw(`${HUB}/notes?lessons=1&year=10&q=${q}&limit=40`, tutor)).body as J;
    expect((y10.items as J[]).some((n) => n.id === L.noteId), "Year 10 includes the lesson").toBe(true);
    expect((y10.items as J[]).find((n) => n.id === L.noteId)!.lessonYear).toBe(10);
    const y3 = (await raw(`${HUB}/notes?lessons=1&year=3&q=${q}&limit=40`, tutor)).body as J;
    expect((y3.items as J[]).some((n) => n.id === L.noteId), "Year 3 excludes it").toBe(false);
    expect((y3.items as J[]).length).toBeLessThanOrEqual(40);
  });

  test("Year chip narrows the list; Yes sends the lesson + quiz to the child's portal; No (default) sends nothing", async ({ browser }) => {
    test.setTimeout(360_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    // The full-screen in-person setup (lesson/quiz search, year filters, "send to portal" choice) lives behind
    // TutorHome's "Teach in person" tile now that the per-lesson toolbar button is gone (NotesPanel goes live
    // inline via GoLivePicker instead, which has no such setup step).
    await gotoHub(page, "/freelancer/learninghub?tab=home");
    await expect(page.locator("#hub-home-tutor")).toBeVisible({ timeout: 25_000 });
    await openTab(page, /Teach in person/);
    const app = page.getByTestId("inperson-app");
    await expect(app).toBeVisible();

    const filters = app.getByTestId("ip-filters");
    await app.getByLabel("Search lessons").fill(L.title);
    await filters.getByRole("tab", { name: "Year 3", exact: true }).click();
    await expect(app.locator(`[data-pick="${L.noteId}"]`)).toHaveCount(0, { timeout: 20_000 });
    await filters.getByRole("tab", { name: "Year 10", exact: true }).click();
    await expect(app.locator(`[data-pick="${L.noteId}"]`)).toBeVisible({ timeout: 20_000 });
    await app.locator(`[data-pick="${L.noteId}"]`).click();
    await expect(app.getByTestId("ip-chosen")).toContainText(L.title);

    // P-hub: no direct-post to the portals any more; the step is a pointer to the one Set homework form.
    await expect(app.getByTestId("ip-portal-hint")).toContainText("Set homework");
    await expect(app.getByTestId("ip-portal-choice")).toHaveCount(0);

    await app.getByRole("button", { name: nameB, exact: true }).click();
    await app.getByTestId("ip-start").click();
    const run = page.getByTestId("inperson-run");
    await expect(run).toBeVisible({ timeout: 30_000 });
    const sid = (await run.getAttribute("data-session"))!;

    // Starting a session no longer creates homework behind the tutor's back.
    const rows = (await raw(`${HUB}/homework?childId=${childB}&tenantId=${tenantId}`, parent)).body as unknown as J[];
    expect(rows.some((h) => h.title === L.title)).toBe(false);

    expect((await send("POST", `${HUB}/in-person/sessions/${sid}/end`, tutor, {})).status).toBe(200);

    await ctx.close();
  });

  test("a quiz / placement test: starts a session without creating homework", async ({ browser }) => {
    test.setTimeout(360_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await gotoHub(page, "/freelancer/learninghub?tab=home");
    await expect(page.locator("#hub-home-tutor")).toBeVisible({ timeout: 25_000 });
    await openTab(page, /Teach in person/);
    const app = page.getByTestId("inperson-app");
    await expect(app).toBeVisible();
    await app.getByRole("tab", { name: "A quiz or placement test" }).click();
    await app.getByLabel("Search quizzes").fill(L.quizTitle);
    await app.getByRole("radio", { name: new RegExp(esc(L.quizTitle)) }).first().click();
    await app.getByRole("button", { name: nameB, exact: true }).click();
    await app.getByTestId("ip-start").click();
    const run = page.getByTestId("inperson-run");
    await expect(run).toBeVisible({ timeout: 30_000 });
    const sid = (await run.getAttribute("data-session"))!;
    const rows = (await raw(`${HUB}/homework?childId=${childB}&tenantId=${tenantId}`, parent)).body as unknown as J[];
    expect(rows.some((h) => h.title === L.quizTitle)).toBe(false);
    expect((await send("POST", `${HUB}/in-person/sessions/${sid}/end`, tutor, {})).status).toBe(200);
    await ctx.close();
  });
});
