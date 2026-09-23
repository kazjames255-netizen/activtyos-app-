import { test, expect } from "@playwright/test";
import { dismissParentWelcome } from "./helpers/ui";
import { loadAccounts, API_URL, statePath, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";

// Learning Hub — the child / parent leftovers (API level, one throwaway family):
//  • the default reveal rule is "after_pass": a failed attempt shows which answers were wrong but never the key; a pass (or an earlier
//    pass of the same quiz) opens it; a tutor always sees it;
//  • unlimited retakes get a short break after 3 not-passed tries in a row, a tutor's one-more-go lifts it;
//  • a running attempt's answers are kept server-side (PUT /attempts/:id/draft) and come back on resume; only the attempt's owner may save
//    them; a submitted attempt can't take a draft and the draft is gone after hand-in;
//  • siblings in one live lesson are both marked present by ONE /attended call naming both.
// Every assertion is anchored to THIS run's children / quizzes / lesson.

test.describe.configure({ mode: "serial" });

const HUB = "/api/learning-hub";
const stamp = Date.now().toString(36);
const subject = `G2 Lab ${stamp}`;
let accounts: AccountManifest["accounts"];
let tenantId = "";
let avaId = "", benId = "";
let topicId = "";
let revealQuiz = "", breakQuiz = "", draftQuiz = "";
const subject2 = `G2 Kid ${stamp}`;
let lockedQuiz = "", diagId = "";
const qIds: Record<string, string> = {};

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
const post = <T = unknown>(path: string, t: string, body: unknown = {}) => apiPost<T>(path, t, body);
async function raw(path: string, t: string, method = "GET", body?: unknown) {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, { method, headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await res.text();
  let json: Record<string, any> = {};
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json, text };
}
interface Started { attemptId: string; resumed?: boolean; draft?: { answers: Record<string, unknown>; idx: number; savedAt: string }; questions: { id: string; prompt: string }[] }
const answerAll = (s: Started, right: boolean) => s.questions.map((q) => ({ questionId: q.id, response: right ? "right" : "nope" }));

test.beforeAll(async () => {
  test.setTimeout(240_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  await setHub(accounts.freelancer, true);
  const t = await token(accounts.freelancer);
  const listing = await provisionLiveListing(accounts.freelancer, { title: `E2E G2 Tuition ${stamp}`, price: 0 });
  avaId = await createParentChild(accounts.parent, { name: `Ava${stamp}` });
  benId = await createParentChild(accounts.parent, { name: `Ben${stamp}` });
  for (const n of [`Ava${stamp}`, `Ben${stamp}`]) await bookViaApi(accounts.parent, listing, { child: n, dates: [listing.runFrom] }).catch((e) => { if (!/clash|existing booking/i.test(String(e))) throw e; });
  await markParentWelcomed(accounts.parent);
  await post(`${HUB}/topics`, t, { subject, topic: "Shapes" });
  await post(`${HUB}/topics`, t, { subject: subject2, topic: "Starters" });
  for (const c of [avaId, benId]) await post(`${HUB}/students`, t, { childId: c, subjects: [subject, subject2] });
  const topic2 = (await apiFetch<{ id: string; subject: string }[]>(`${HUB}/topics`, t)).find((x) => x.subject === subject2)!.id;
  const q2 = (await post<{ id: string }>(`${HUB}/questions`, t, { topicId: topic2, kind: "short", prompt: `Kid Q (${stamp}) type right`, answer: "right", marks: 1 })).id;
  diagId = (await post<{ id: string }>(`${HUB}/assessments`, t, { type: "diagnostic", title: `G2 kid starter ${stamp}`, subject: subject2, topicIds: [topic2], questionIds: [q2], timeLimitMins: null, passMarkPct: 50, published: true })).id;
  lockedQuiz = (await post<{ id: string }>(`${HUB}/assessments`, t, { type: "quiz", title: `G2 kid locked quiz ${stamp}`, subject: subject2, topicIds: [topic2], questionIds: [q2], timeLimitMins: null, passMarkPct: 50, published: true, retakePolicy: "unlimited" })).id;
  topicId = (await apiFetch<{ id: string; subject: string }[]>(`${HUB}/topics`, t)).find((x) => x.subject === subject)!.id;
  for (const k of ["a", "b"]) qIds[k] = (await post<{ id: string }>(`${HUB}/questions`, t, { topicId, kind: "short", prompt: `Type "right" (${k} ${stamp})`, answer: "right", marks: 1, explanation: `Because ${k}.` })).id;
  const mk = async (title: string) => (await post<{ id: string }>(`${HUB}/assessments`, t, { type: "quiz", title, subject, topicIds: [topicId], questionIds: [qIds.a, qIds.b], timeLimitMins: null, passMarkPct: 100, published: true, retakePolicy: "unlimited" })).id;
  revealQuiz = await mk(`G2 reveal ${stamp}`);
  breakQuiz = await mk(`G2 break ${stamp}`);
  draftQuiz = await mk(`G2 draft ${stamp}`);
});
test.afterAll(async () => { await setHub(accounts.freelancer, true); });

test.describe("the answer key is held back until the quiz is passed", () => {
  let failedId = "";
  test("a failed attempt: which answers were wrong, but no key or explanation; the tutor still sees them", async () => {
    const p = await token(accounts.parent), t = await token(accounts.freelancer);
    const start = await raw(`${HUB}/assessments/${revealQuiz}/attempts?tenantId=${tenantId}&childId=${avaId}`, p, "POST", {});
    expect(start.status).toBe(201);
    failedId = start.body.attemptId;
    const sub = await raw(`${HUB}/attempts/${failedId}/submit?tenantId=${tenantId}&childId=${avaId}`, p, "POST", { answers: answerAll(start.body as unknown as Started, false) });
    expect(sub.status).toBe(200);
    expect(sub.body).toMatchObject({ status: "marked", pct: 0, passed: false, keyHeld: true });
    expect(sub.body.answers.every((a: { correct: boolean }) => a.correct === false)).toBe(true);
    expect(sub.text).not.toMatch(/"correctAnswer"|"explanation"|Because a|Because b/);
    const again = await raw(`${HUB}/attempts/${failedId}?tenantId=${tenantId}&childId=${avaId}`, p);
    expect(again.text).not.toMatch(/"correctAnswer"|"explanation"/);
    const tut = await raw(`${HUB}/attempts/${failedId}`, t);
    expect(tut.body.keyHeld).toBeUndefined();
    expect(tut.body.answers[0]).toMatchObject({ correctAnswer: "right" });
  });

  test("a pass opens the key, and so does the earlier failed attempt of the same quiz from then on", async () => {
    const p = await token(accounts.parent);
    const start = await raw(`${HUB}/assessments/${revealQuiz}/attempts?tenantId=${tenantId}&childId=${avaId}`, p, "POST", {});
    expect(start.status).toBe(201);
    const sub = await raw(`${HUB}/attempts/${start.body.attemptId}/submit?tenantId=${tenantId}&childId=${avaId}`, p, "POST", { answers: answerAll(start.body as unknown as Started, true) });
    expect(sub.body).toMatchObject({ status: "marked", pct: 100, passed: true });
    expect(sub.body.keyHeld).toBeUndefined();
    expect(sub.body.answers[0]).toMatchObject({ correctAnswer: "right" });
    expect(sub.text).toMatch(/Because [ab]\./);
    const old = await raw(`${HUB}/attempts/${failedId}?tenantId=${tenantId}&childId=${avaId}`, p);
    expect(old.body.keyHeld).toBeUndefined();
    expect(old.body.answers[0]).toMatchObject({ correctAnswer: "right" });
    // …but only for Ava's own quizzes: Ben has passed nothing.
    const ben = await raw(`${HUB}/assessments/${revealQuiz}/attempts?tenantId=${tenantId}&childId=${benId}`, p, "POST", {});
    const benSub = await raw(`${HUB}/attempts/${ben.body.attemptId}/submit?tenantId=${tenantId}&childId=${benId}`, p, "POST", { answers: answerAll(ben.body as unknown as Started, false) });
    expect(benSub.body.keyHeld).toBe(true);
  });

  test("a tenant that chooses after_submit gets the old behaviour back", async () => {
    const t = await token(accounts.freelancer), p = await token(accounts.parent);
    expect((await raw(`${HUB}/config`, t, "PUT", { hub: { revealAnswers: "after_submit" } })).status).toBe(200);
    try {
      const s = await raw(`${HUB}/assessments/${revealQuiz}/attempts?tenantId=${tenantId}&childId=${benId}`, p, "POST", {});
      const sub = await raw(`${HUB}/attempts/${s.body.attemptId}/submit?tenantId=${tenantId}&childId=${benId}`, p, "POST", { answers: answerAll(s.body as unknown as Started, false) });
      expect(sub.body.keyHeld).toBeUndefined();
      expect(sub.body.answers[0]).toMatchObject({ correctAnswer: "right" });
    } finally {
      await raw(`${HUB}/config`, t, "PUT", { hub: { revealAnswers: "after_pass" } });
    }
  });
});

test.describe("a short break after three tries that didn't pass", () => {
  test("3 fails then the 4th start waits; the list says so; a tutor's one-more-go lifts it", async () => {
    const p = await token(accounts.parent), t = await token(accounts.freelancer);
    const go = async (right: boolean) => {
      const s = await raw(`${HUB}/assessments/${breakQuiz}/attempts?tenantId=${tenantId}&childId=${avaId}`, p, "POST", {});
      expect(s.status, JSON.stringify(s.body)).toBe(201);
      await raw(`${HUB}/attempts/${s.body.attemptId}/submit?tenantId=${tenantId}&childId=${avaId}`, p, "POST", { answers: answerAll(s.body as unknown as Started, right) });
    };
    await go(false); await go(false); await go(false);
    const blocked = await raw(`${HUB}/assessments/${breakQuiz}/attempts?tenantId=${tenantId}&childId=${avaId}`, p, "POST", {});
    expect(blocked.status).toBe(409);
    expect(blocked.body).toMatchObject({ code: "retake_blocked", reason: "break" });
    expect(Date.parse(blocked.body.nextAvailableAt)).toBeGreaterThan(Date.now());
    const list = (await raw(`${HUB}/assessments?tenantId=${tenantId}&childId=${avaId}`, p)).body as unknown as { id: string; retake: { allowed: boolean; reason: string } }[];
    expect(list.find((a) => a.id === breakQuiz)!.retake).toMatchObject({ allowed: false, reason: "break" });
    // The other child is unaffected (the streak is per child).
    expect((await raw(`${HUB}/assessments/${breakQuiz}/attempts?tenantId=${tenantId}&childId=${benId}`, p, "POST", {})).status).toBe(201);
    expect((await raw(`${HUB}/assessments/${breakQuiz}/allow-retake`, t, "POST", { childId: avaId })).status).toBe(200);
    expect((await raw(`${HUB}/assessments/${breakQuiz}/attempts?tenantId=${tenantId}&childId=${avaId}`, p, "POST", {})).status).toBe(201);
  });
});

test.describe("answers so far are kept on the server", () => {
  test("PUT draft → resume returns it; foreign writers 404; gone after hand-in", async () => {
    const p = await token(accounts.parent), t = await token(accounts.freelancer);
    const start = await raw(`${HUB}/assessments/${draftQuiz}/attempts?tenantId=${tenantId}&childId=${benId}`, p, "POST", {});
    expect(start.status).toBe(201);
    const id = start.body.attemptId as string;
    const [q1] = (start.body as unknown as Started).questions;
    expect(start.body.draft).toBeUndefined();
    const put = await raw(`${HUB}/attempts/${id}/draft?tenantId=${tenantId}&childId=${benId}`, p, "PUT", { answers: [{ questionId: q1.id, response: "right" }, { questionId: "not-in-this-attempt", response: "x" }, { questionId: qIds.b, response: "" }], idx: 1 });
    expect(put.status).toBe(200);
    const resumed = await raw(`${HUB}/assessments/${draftQuiz}/attempts?tenantId=${tenantId}&childId=${benId}`, p, "POST", {});
    expect(resumed.body).toMatchObject({ resumed: true, attemptId: id });
    expect(resumed.body.draft.answers).toEqual({ [q1.id]: "right" }); // the stray id and the empty answer were dropped
    expect(resumed.body.draft.idx).toBe(1);
    // Not the attempt's owner: a tutor who didn't start it, and Ava's parent-scoped id for Ben's attempt.
    expect((await raw(`${HUB}/attempts/${id}/draft`, t, "PUT", { answers: [{ questionId: q1.id, response: "x" }] })).status).toBe(404);
    expect((await raw(`${HUB}/attempts/${id}/draft?tenantId=${tenantId}&childId=${avaId}`, p, "PUT", { answers: [] })).status).toBe(404);
    expect((await raw(`${HUB}/attempts/${id}/draft?tenantId=${tenantId}&childId=${benId}`, p, "PUT", { answers: new Array(301).fill({ questionId: q1.id, response: "x" }) })).status).toBe(400);
    // The draft is never in a result / list, and is deleted on hand-in.
    expect((await raw(`${HUB}/attempts/${id}?tenantId=${tenantId}&childId=${benId}`, p)).text).not.toContain("savedAt");
    const sub = await raw(`${HUB}/attempts/${id}/submit?tenantId=${tenantId}&childId=${benId}`, p, "POST", { answers: answerAll(start.body as unknown as Started, true) });
    expect(sub.status).toBe(200);
    expect((await raw(`${HUB}/attempts/${id}/draft?tenantId=${tenantId}&childId=${benId}`, p, "PUT", { answers: [] })).status).toBe(409);
    const next = await raw(`${HUB}/assessments/${draftQuiz}/attempts?tenantId=${tenantId}&childId=${benId}`, p, "POST", {});
    expect(next.body.draft).toBeUndefined();
  });
});

test.describe("siblings in one live lesson", () => {
  test("one /attended naming both children marks both present; a foreign id is ignored", async () => {
    const p = await token(accounts.parent), t = await token(accounts.freelancer);
    const lesson = await post<{ id: string }>(`${HUB}/lessons`, t, { title: `G2 siblings ${stamp}`, topicId, startsAt: new Date().toISOString(), durationMins: 60, childIds: [avaId, benId] });
    const at = await raw(`${HUB}/lessons/${lesson.id}/attended?tenantId=${tenantId}`, p, "POST", { childIds: [avaId, benId, "someone-elses-child"] });
    expect(at.status, JSON.stringify(at.body)).toBe(200);
    expect(new Set(at.body.childIds)).toEqual(new Set([avaId, benId]));
    const rows = (await raw(`${HUB}/lessons`, t)).body as unknown as { id: string; attendance?: Record<string, string> }[];
    const row = rows.find((r) => r.id === lesson.id)!;
    expect(Object.keys(row.attendance ?? {}).sort()).toEqual([avaId, benId].sort());
    // Naming nobody who is in the lesson is still a 404, and a single named child still works on its own.
    expect((await raw(`${HUB}/lessons/${lesson.id}/attended?tenantId=${tenantId}`, p, "POST", { childIds: ["someone-elses-child"] })).status).toBe(404);
  });
});

test.describe("kid mode can take the placement test that unlocks a quiz", () => {
  test("Starting quiz tab, locked card → button → the same runner with no sibling switch → the quiz unlocks", async ({ browser }) => {
    test.setTimeout(240_000);
    const t = await token(accounts.freelancer);
    expect((await raw(`${HUB}/config`, t, "PUT", { hub: { requireDiagnostic: true } })).status).toBe(200);
    const ctx = await browser.newContext({ storageState: statePath("parent") });
    const page = await ctx.newPage();
    try {
      await dismissParentWelcome(page);
      await setHub(accounts.freelancer, true);
      await page.goto(`/custdash/learninghub?tab=quizzes&child=${avaId}`);
      await expect(page.getByRole("heading", { name: /Teaching Hub|My Classroom/ }).first()).toBeVisible({ timeout: 40_000 });
      const toggle = page.getByTestId("hub-hand-over-toggle");
      if (await toggle.isVisible({ timeout: 5_000 }).catch(() => false)) await toggle.click();
      await page.locator(`[data-testid="hub-hand-over"][data-child-id="${avaId}"]`).click();
      await expect(page.getByTestId("hub-kid-bar")).toBeVisible();
      await expect(page.getByRole("tab", { name: /Starting quiz/ })).toBeVisible();
      await expect(page.getByRole("tab", { name: /Progress|Live lessons|Students/ })).toHaveCount(0);
      await page.getByRole("tab", { name: /^Quizzes/ }).click();
      const locked = page.locator(`#hub-assess-${lockedQuiz}`);
      await expect(locked).toContainText("starting quiz", { timeout: 30_000 });
      await expect(locked).not.toContainText(/placement|diagnostic/i);
      await locked.getByTestId("hub-go-diag").click();
      const card = page.locator(`#hub-assess-${diagId}`);
      await expect(card).toBeVisible({ timeout: 30_000 });
      await card.getByTestId("hub-open-assessment").click();
      await expect(page.getByTestId("hub-who-line")).toBeVisible();
      await expect(page.getByTestId("hub-who-switch")).toHaveCount(0); // a child can't become their sibling from here
      await expect(page.getByTestId("hub-child-chip").first()).toContainText(`Ava${stamp}`);
      await page.getByTestId("hub-start").click();
      const runner = page.getByTestId("hub-runner");
      await expect(runner).toBeVisible({ timeout: 30_000 });
      await expect(runner.getByTestId("hub-child-chip")).toContainText(`Ava${stamp}`);
      await runner.getByPlaceholder("Type your answer").fill("right");
      await runner.getByTestId("hub-review").click();
      await page.getByTestId("hub-handin").click();
      await page.getByTestId("hub-confirm-submit").click();
      await expect(page.getByTestId("hub-result")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("hub-result")).not.toContainText(/baseline|placement|mastery/i);
      // Recorded against Ava (the API is the truth), and the locked quiz is open now.
      const mine = (await raw(`${HUB}/attempts?tenantId=${tenantId}&childId=${avaId}`, await token(accounts.parent))).body as unknown as { assessmentId: string; status: string }[];
      expect(mine.some((a) => a.assessmentId === diagId && a.status === "marked")).toBe(true);
      const list = (await raw(`${HUB}/assessments?tenantId=${tenantId}&childId=${avaId}`, await token(accounts.parent))).body as unknown as { id: string; locked: boolean }[];
      expect(list.find((a) => a.id === lockedQuiz)!.locked).toBe(false);
    } finally {
      await raw(`${HUB}/config`, t, "PUT", { hub: { requireDiagnostic: false } });
      await ctx.close();
    }
  });
});
