import { test, expect, type Browser, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { cardWith } from "./helpers/ui";
import { openTab } from "./helpers/hubTabs";

// Learning Hub — "Auto-plan a week" (features/learninghub/plan/, server/src/lib/hubPlan.ts, server/src/routes/hub/planApi.ts).
// leaf-07 verified the feature live end to end but found zero e2e coverage despite the testids already being in place
// (hub-plan-picker, hub-plan-go, hub-student-plan, hub-group-plan, autoplan-item, autoplan-set). This spec covers:
//   1. the empty state — a student with no attempts/weak topics gets "Nothing to plan right now".
//   2. a real weak-topic scenario — an attempt scored below the pass mark, plus a second, unattempted quiz on the
//      same topic (the plan's content pick) — surfaces one ranked, explained suggestion.
//   3. "Set these" actually posts real homework for the suggested item (server-side, then reflected in the UI).
// Every state assertion is anchored to THIS run's entities (stamped names) per AGENTS.md's e2e assertion rule.

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const HUB = "/api/learning-hub";
const subject = `AP Maths ${stamp}`;
const topicName = `Fractions ${stamp}`;
const emptyKidName = `APEmptykid ${stamp}`;
const planKidName = `APPlankid ${stamp}`;
const quizAttemptedTitle = `AP attempted quiz ${stamp}`;
const quizFreshTitle = `AP fresh quiz ${stamp}`;

let accounts: AccountManifest["accounts"];
let tutor = "";
let parent = "";
let tenantId = "";
let emptyKidId = "";
let planKidId = "";
const ids: Record<string, string> = {};

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
type Body = Record<string, unknown> & { error?: unknown; code?: string };
async function raw(p: string, idToken: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${p}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}`, ...init?.headers } });
  const text = await res.text();
  let body: unknown = {};
  try { body = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: body as Body };
}
const send = (m: string, p: string, t: string, body?: unknown) => raw(p, t, { method: m, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

/** Answer every question of a started attempt with `over[questionId]`, null otherwise. */
const answersFor = (r: Body) => (over: Record<string, unknown>) =>
  (r.questions as { id: string }[]).map((x) => ({ questionId: x.id, response: over[x.id] ?? null }));

async function tutorPage(browser: Browser): Promise<{ ctx: Awaited<ReturnType<Browser["newContext"]>>; page: Page }> {
  const ctx = await browser.newContext({ storageState: statePath("freelancer") });
  return { ctx, page: await ctx.newPage() };
}
async function gotoHub(page: Page, tab: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto(`/freelancer/learninghub?tab=${tab}`);
    if (await page.getByRole("tab").first().isVisible({ timeout: 25_000 }).catch(() => false)) return;
  }
  await expect(page.getByRole("tab").first()).toBeVisible({ timeout: 30_000 });
}

test.beforeAll(async () => {
  test.setTimeout(240_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  await setHub(accounts.freelancer, true);
  await provisionLiveListing(accounts.freelancer, { title: `E2E Tutoring ${stamp}`, price: 0 });
  emptyKidId = await createParentChild(accounts.parent, { name: emptyKidName });
  planKidId = await createParentChild(accounts.parent, { name: planKidName });
  await markParentWelcomed(accounts.parent);
  tutor = await token(accounts.freelancer);
  parent = await token(accounts.parent);

  // Both students enrolled for the same (stamped, so run-unique) subject/topic.
  ids.topic = (await apiPost<{ id: string }>(`${HUB}/topics`, tutor, { subject, topic: topicName })).id;
  expect((await send("POST", `${HUB}/students`, tutor, { childId: emptyKidId, subjects: [subject] })).status).toBe(201);
  expect((await send("POST", `${HUB}/students`, tutor, { childId: planKidId, subjects: [subject] })).status).toBe(201);

  // Two auto-marked single-choice questions on the topic, so no manual marking is needed for mastery to update.
  const q = async (prompt: string, correct: "a" | "b") =>
    (await apiPost<{ id: string }>(`${HUB}/questions`, tutor, {
      topicId: ids.topic, kind: "single", prompt, options: [{ id: "a", text: "Alpha" }, { id: "b", text: "Beta" }], answer: correct, marks: 1,
    })).id;
  ids.qAttempted = await q(`AP question 1 ${stamp}`, "b");
  ids.qFresh = await q(`AP question 2 ${stamp}`, "b");

  const mkQuiz = async (title: string, questionId: string) =>
    (await apiPost<{ id: string }>(`${HUB}/assessments`, tutor, {
      type: "quiz", title, subject, topicIds: [ids.topic], questionIds: [questionId], timeLimitMins: null, published: true,
    })).id;
  ids.quizAttempted = await mkQuiz(quizAttemptedTitle, ids.qAttempted);
  ids.quizFresh = await mkQuiz(quizFreshTitle, ids.qFresh);

  // Seed the weak-topic scenario for planKid: sit the first quiz and answer it WRONG — an attempt below the pass mark
  // (default passMarkPct 70; this scores 0%), leaving quizFresh as the still-unattempted quiz on the same topic.
  const start = await send("POST", `${HUB}/assessments/${ids.quizAttempted}/attempts?tenantId=${tenantId}&childId=${planKidId}`, parent, {});
  expect(start.status).toBe(201);
  const submit = await send("POST", `${HUB}/attempts/${start.body.attemptId}/submit?tenantId=${tenantId}`, parent, { answers: answersFor(start.body)({ [ids.qAttempted]: "a" }) });
  expect(submit.status).toBe(200);
  expect(submit.body).toMatchObject({ status: "marked", pct: 0, passed: false });
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); });
test.afterAll(async () => { await setHub(accounts.freelancer, false); });

test.describe("empty state — a student with no attempts and no weak topics", () => {
  test("the sheet says there's nothing to plan", async ({ browser }) => {
    test.setTimeout(180_000);
    const { ctx, page } = await tutorPage(browser);
    await gotoHub(page, "students");
    const card = cardWith(page, emptyKidName);
    await expect(card).toBeVisible({ timeout: 40_000 });
    await card.getByTestId("hub-student-plan").click();
    const dlg = page.locator("#autoplan-sheet");
    await expect(dlg).toBeVisible({ timeout: 30_000 });
    await expect(dlg.getByRole("status")).toHaveCount(0, { timeout: 30_000 }); // loading finished
    await expect(dlg.getByText("Nothing to plan right now")).toBeVisible({ timeout: 20_000 });
    await expect(dlg.getByTestId("autoplan-item")).toHaveCount(0);
    await dlg.getByRole("button", { name: "Close" }).click();
    await expect(dlg).toHaveCount(0);
    await ctx.close();
  });
});

test.describe("a real weak-topic plan is suggested and can be set", () => {
  test("the picker (Homework tab) generates a ranked, explained item for planKid, and Set these creates real homework", async ({ browser }) => {
    test.setTimeout(240_000);
    const { ctx, page } = await tutorPage(browser);
    await gotoHub(page, "homework");

    const picker = page.getByTestId("hub-plan-picker");
    await expect(picker).toBeVisible({ timeout: 40_000 });
    await picker.getByLabel("Plan for").selectOption({ label: planKidName });
    await page.getByTestId("hub-plan-go").click();

    const dlg = page.locator("#autoplan-sheet");
    await expect(dlg).toBeVisible({ timeout: 30_000 });
    await expect(dlg.getByRole("status")).toHaveCount(0, { timeout: 30_000 }); // loading finished

    // exactly one ranked item, for THIS run's topic, referencing the fresh (unattempted) quiz — the attempted
    // quiz is excluded (attempted in the last 10 days), and the topic scored 0% so it ranks #1.
    const item = cardWith(page, topicName, "Priority 1");
    await expect(item).toBeVisible({ timeout: 20_000 });
    await expect(item).toContainText("Scored 0%");
    await expect(item).toContainText(quizFreshTitle);
    await expect(item).not.toContainText(quizAttemptedTitle);
    await expect(item.getByTestId("autoplan-item")).toBeChecked(); // suggestions are pre-ticked
    await expect(dlg.getByTestId("autoplan-item")).toHaveCount(1);

    await dlg.getByTestId("autoplan-set").click();
    await expect(dlg).toHaveCount(0, { timeout: 30_000 });

    // server side: real homework, for planKid, wired to the fresh quiz.
    const hw = (await raw(`${HUB}/homework`, tutor)).body as unknown as { id: string; title: string; assessmentId: string | null; assignedChildIds: string[] }[];
    const created = hw.find((h) => h.assessmentId === ids.quizFresh && h.assignedChildIds.includes(planKidId));
    expect(created).toBeTruthy();
    expect(created!.title).toContain(topicName);

    // and it shows up in the "Set homework" list.
    await page.getByRole("tab", { name: "Set homework" }).click();
    await expect(cardWith(page, created!.title, planKidName)).toBeVisible({ timeout: 30_000 });
    await ctx.close();
  });
});
