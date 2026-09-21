import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { seedOakLesson, type SeededLesson } from "./helpers/lessonFixture";
import { cardWith, dismissParentWelcome } from "./helpers/ui";

// Learning Hub — the FAMILY hats: the parent (custdash) and the child who is handed the device.
//  • a parent with 2+ children can never record a result against the wrong child: the runners show a child chip, ask "Who's
//    learning?" until somebody has said, and everything posted carries exactly the child shown;
//  • kid mode ("Hand over to Ava"): full-screen, one child, no portal chrome / sibling picker / adult tabs, Back stays inside,
//    survives a refresh, and only a parent gate (a sum) gets out;
//  • deep links: ?tab=&child=&open=quiz|lesson|hw:<id>[&hw=] survive a refresh, Back closes the runner without leaving the hub,
//    a homework's "Take the quiz" starts THAT quiz recorded against the homework, a lesson's exit quiz is not a stray quiz;
//  • notifications carry the child + tab; a tutor marking a paper tells the family.
// Every state assertion is anchored to THIS run's children / quiz / lesson / homework.

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const subject = `Family Lab ${stamp}`;
const avaName = `Ava${stamp}`;
const benName = `Ben${stamp}`;
const QUIZ = `Family quiz ${stamp}`;
const WRITTEN_QUIZ = `Family written quiz ${stamp}`;
const Q_SHORT = `Name the three-sided shape (${stamp})`;
const Q_WRITTEN = `Explain why the sky is blue (${stamp})`;
const HW_TITLE = `Family homework ${stamp}`;

let accounts: AccountManifest["accounts"];
let tenantId = "";
let avaId = "", benId = "";
let quizId = "", writtenQuizId = "", hwId = "";
let L: SeededLesson;

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
const tabOf = (page: Page, name: RegExp) => page.getByRole("tab", { name });
const HUB = "/api/learning-hub";

const envApi = (() => {
  try {
    const m = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/^NEXT_PUBLIC_API_URL=(.*)$/m);
    return m?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  } catch { return ""; }
})();
const viaLocalApi = (url: string) => (envApi && envApi !== API_URL ? url.replace(new URL(envApi).origin, API_URL) : url);

/** A parent's browser. The provider list is narrowed to exactly Ava + Ben so the family is a clean two-child family whatever else
 *  the shared parent account has accumulated (the API is untouched: same tenant, same data). */
async function familyCtx(browser: Browser, kids: string[] = [avaId, benId]) {
  const ctx = await browser.newContext({ storageState: statePath("parent") });
  if (envApi && envApi !== API_URL) {
    const origin = new URL(envApi).origin;
    await ctx.route((u) => u.origin === origin, async (route) => {
      const url = viaLocalApi(route.request().url());
      if (url.includes("/api/events/") && !url.includes("/ticket")) return route.abort();
      try { await route.fulfill({ response: await route.fetch({ url }) }); } catch { await route.abort(); }
    });
  }
  await ctx.route(/\/api\/learning-hub\/providers(\?|$)/, async (route) => {
    const res = await route.fetch({ url: viaLocalApi(route.request().url()) });
    const list = (await res.json()) as { tenantId: string; children?: { childId: string }[] }[];
    const out = list.map((p) => (p.tenantId === tenantId ? { ...p, children: (p.children ?? []).filter((c) => kids.includes(c.childId)).sort((a, b) => kids.indexOf(a.childId) - kids.indexOf(b.childId)) } : p));
    await route.fulfill({ response: res, json: out });
  });
  return ctx;
}

async function gotoHub(page: Page, url: string) {
  const heading = page.getByRole("heading", { name: /Teaching Hub|My Classroom/ });
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto(url);
    if (await heading.first().isVisible({ timeout: 25_000 }).catch(() => false)) return;
  }
  await expect(heading.first()).toBeVisible({ timeout: 30_000 });
}
async function openFamily(page: Page, query: string) {
  await dismissParentWelcome(page);
  await gotoHub(page, `/custdash/learninghub${query}`);
}
const dropRemembered = async (page: Page) => { await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("aos.hub.child.")) localStorage.removeItem(k); }); };
const parentAttempts = async (childId: string) => apiFetch<{ id: string; assessmentId: string; status: string; homeworkId: string | null; childId: string }[]>(`${HUB}/attempts?tenantId=${tenantId}&childId=${childId}`, await token(accounts.parent));
const chip = (page: Page) => page.getByTestId("hub-child-chip");

/** Answer + hand in the one-question family quiz from the runner. */
async function finishQuiz(page: Page) {
  const runner = page.getByTestId("hub-runner");
  await expect(runner).toBeVisible({ timeout: 30_000 });
  await runner.getByPlaceholder("Type your answer").fill("triangle");
  await runner.getByTestId("hub-review").click();
  await page.getByTestId("hub-handin").click();
  await page.getByTestId("hub-confirm-submit").click();
}

test.beforeAll(async () => {
  test.setTimeout(300_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  await setHub(accounts.freelancer, true);
  const t = await token(accounts.freelancer);
  const listing = await provisionLiveListing(accounts.freelancer, { title: `E2E Family Tuition ${stamp}`, price: 0 });
  avaId = await createParentChild(accounts.parent, { name: avaName });
  benId = await createParentChild(accounts.parent, { name: benName });
  for (const n of [avaName, benName]) await bookViaApi(accounts.parent, listing, { child: n, dates: [listing.runFrom] }).catch((e) => { if (!/clash|existing booking/i.test(String(e))) throw e; });
  await markParentWelcomed(accounts.parent);
  await apiPost(`${HUB}/topics`, t, { subject, topic: "Shapes" });
  for (const c of [avaId, benId]) await apiPost(`${HUB}/students`, t, { childId: c, subjects: [subject] });
  const topics = await apiFetch<{ id: string; subject: string }[]>(`${HUB}/topics`, t);
  const topicId = topics.find((x) => x.subject === subject)!.id;
  const qShort = await apiPost<{ id: string }>(`${HUB}/questions`, t, { topicId, kind: "short", prompt: Q_SHORT, answer: "triangle", marks: 1 });
  const qWritten = await apiPost<{ id: string }>(`${HUB}/questions`, t, { topicId, kind: "written", prompt: Q_WRITTEN, marks: 4 });
  await setHub(accounts.freelancer, true);
  quizId = (await apiPost<{ id: string }>(`${HUB}/assessments`, t, { type: "quiz", title: QUIZ, subject, topicIds: [topicId], questionIds: [qShort.id], timeLimitMins: null, passMarkPct: 50, published: true, retakePolicy: "unlimited" })).id;
  writtenQuizId = (await apiPost<{ id: string }>(`${HUB}/assessments`, t, { type: "quiz", title: WRITTEN_QUIZ, subject, topicIds: [topicId], questionIds: [qWritten.id], timeLimitMins: null, passMarkPct: 50, published: true, retakePolicy: "unlimited" })).id;
  L = await seedOakLesson(t, { stamp, subject, topicId, widget: "neurone" });
  hwId = (await apiPost<{ id: string }>(`${HUB}/homework`, t, { title: HW_TITLE, instructions: "Take the family quiz.", assessmentId: quizId, assignedChildIds: [avaId], dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString() })).id;
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); });

test.describe("two children: who is learning?", () => {
  test("nobody said who is learning: Start waits, and the result is recorded for the child picked, never the other", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await familyCtx(browser);
    const page = await ctx.newPage();
    await openFamily(page, "?tab=quizzes");
    await dropRemembered(page);
    await page.reload();
    await expect(tabOf(page, /^Quizzes/)).toBeVisible({ timeout: 30_000 });
    const card = cardWith(page, QUIZ);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.getByTestId("hub-open-assessment").click();

    // The intro asks first; Start is off until the family says who.
    await expect(page.getByTestId("hub-who-picker")).toBeVisible();
    await expect(page.getByTestId("hub-start")).toBeDisabled();
    await page.getByTestId("hub-who-kid").filter({ hasText: benName }).click();
    await expect(page.getByTestId("hub-who-line").getByTestId("hub-child-chip")).toHaveAttribute("data-child-id", benId, { timeout: 20_000 });
    await expect(page.getByTestId("hub-start")).toBeEnabled({ timeout: 20_000 });
    await page.getByTestId("hub-start").click();

    // The runner's header names the child; the result screen says whose it is.
    await expect(chip(page).first()).toHaveAttribute("data-child-id", benId, { timeout: 30_000 });
    await expect(chip(page).first()).toContainText(benName);
    await finishQuiz(page);
    await expect(page.getByTestId("hub-result-for").getByTestId("hub-child-chip")).toHaveAttribute("data-child-id", benId, { timeout: 30_000 });

    const ben = (await parentAttempts(benId)).filter((a) => a.assessmentId === quizId);
    expect(ben.length).toBe(1);
    expect(ben[0].status).toBe("marked");
    expect((await parentAttempts(avaId)).some((a) => a.assessmentId === quizId)).toBe(false);
    await ctx.close();
  });

  test("a link that names the child is trusted; \"Not Ava? Switch\" is one tap and the chip follows", async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await familyCtx(browser);
    const page = await ctx.newPage();
    await openFamily(page, `?tab=quizzes&child=${avaId}`);
    const card = cardWith(page, QUIZ);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.getByTestId("hub-open-assessment").click();
    await expect(page.getByTestId("hub-who-picker")).toHaveCount(0);
    await expect(page.getByTestId("hub-who-line").getByTestId("hub-child-chip")).toHaveAttribute("data-child-id", avaId);
    await expect(page.getByTestId("hub-start")).toBeEnabled();
    await page.getByTestId("hub-who-switch").click();
    await page.getByTestId("hub-who-kid").filter({ hasText: benName }).click();
    await expect(page.getByTestId("hub-who-line").getByTestId("hub-child-chip")).toHaveAttribute("data-child-id", benId, { timeout: 20_000 });
    expect(page.url()).toContain(`child=${benId}`);
    await ctx.close();
  });

  test("flashcards: the review names the child too", async ({ browser }) => {
    test.setTimeout(120_000);
    const t = await token(accounts.freelancer);
    const topics = await apiFetch<{ id: string; subject: string }[]>(`${HUB}/topics`, t);
    await apiPost(`${HUB}/flashcards`, t, { topicId: topics.find((x) => x.subject === subject)!.id, front: `Fam front ${stamp}`, back: `Fam back ${stamp}`, published: true });
    const ctx = await familyCtx(browser);
    const page = await ctx.newPage();
    await openFamily(page, `?tab=flashcards&child=${avaId}`);
    await expect(page.locator("#hub-fc-start")).toBeVisible({ timeout: 30_000 });
    await page.locator("#hub-fc-start").click();
    await expect(page.getByTestId("hub-fc-session").getByTestId("hub-child-chip")).toHaveAttribute("data-child-id", avaId, { timeout: 20_000 });
    await ctx.close();
  });
});

test.describe("kid mode", () => {
  test("Hand over to Ava: full-screen, one child, adult tabs gone, Back stays, refresh stays, a sum lets a parent out", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await familyCtx(browser);
    const page = await ctx.newPage();
    await openFamily(page, `?tab=home&child=${benId}`);
    await expect(page.locator("#hub-family-bar")).toBeVisible({ timeout: 30_000 });
    // Normal hub: the sibling picker and the adult tabs exist.
    await expect(page.getByRole("radiogroup", { name: "Child" })).toBeVisible();
    await page.locator(`[data-testid="hub-hand-over"][data-child-id="${avaId}"]`).click();

    const hub = page.locator("#learning-hub");
    await expect(hub).toHaveAttribute("data-kid", "1", { timeout: 20_000 });
    await expect(page.getByTestId("hub-kid-bar")).toContainText(avaName);
    // Nothing of the parent portal / sibling picker is reachable, and the layer really covers the sidebar (hit-test at the left edge).
    await expect(page.getByRole("radiogroup", { name: "Child" })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Child" })).toHaveCount(0);
    await expect(page.locator("#hub-family-bar")).toHaveCount(0);
    expect(await page.evaluate(() => { const el = document.elementFromPoint(24, 300); return !!el?.closest("#learning-hub"); })).toBe(true);
    expect(await page.evaluate(() => { const el = document.elementFromPoint(window.innerWidth - 24, 24); return !!el?.closest("#learning-hub"); })).toBe(true);
    const tabs = (await page.getByRole("tab").allInnerTexts()).map((x) => x.trim());
    // Kid tabs: Home · Lessons · Quizzes · Starting quiz (the placement test, in a child's words; it unlocks a locked quiz) · Homework · Flashcards.
    expect(tabs.length).toBe(6);
    expect(tabs.join("|")).toMatch(/Starting quiz/);
    expect(tabs.join("|")).not.toMatch(/Progress|Live lessons|Placement/);
    // The hub is forced onto Ava even though Ben was the child in the URL a moment ago.
    await tabOf(page, /^Quizzes/).click();
    await expect(cardWith(page, QUIZ)).toBeVisible({ timeout: 30_000 });
    await cardWith(page, QUIZ).getByTestId("hub-open-assessment").click();
    await expect(page.getByTestId("hub-who-line").getByTestId("hub-child-chip")).toHaveAttribute("data-child-id", avaId);
    await page.getByRole("button", { name: "Back", exact: true }).first().click();

    // Back never leaves the hub; a refresh stays in kid mode.
    await page.goBack().catch(() => undefined);
    await expect(page).toHaveURL(/custdash\/learninghub/);
    await expect(hub).toHaveAttribute("data-kid", "1");
    await page.reload();
    await expect(page.locator("#learning-hub")).toHaveAttribute("data-kid", "1", { timeout: 30_000 });
    await expect(page.getByTestId("hub-kid-bar")).toContainText(avaName, { timeout: 30_000 });

    // The gate: a wrong sum is refused (and re-asked), the right one returns to the normal hub.
    await page.getByTestId("kid-exit").click();
    const sumOf = async () => { const t = (await page.getByTestId("kid-gate-sum").innerText()).match(/(\d+)\s*×\s*(\d+)/)!; return Number(t[1]) * Number(t[2]); };
    const first = await sumOf();
    await page.locator("#kid-gate-answer").fill(String(first + 1));
    await page.getByTestId("kid-gate-unlock").click();
    await expect(page.getByRole("alert").filter({ hasText: "Not quite" })).toBeVisible();
    await expect(page.locator("#learning-hub")).toHaveAttribute("data-kid", "1");
    await page.locator("#kid-gate-answer").fill(String(await sumOf()));
    await page.getByTestId("kid-gate-unlock").click();
    await expect(page.locator("#learning-hub")).not.toHaveAttribute("data-kid", "1", { timeout: 20_000 });
    await expect(page.locator("#hub-family-bar")).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Child" })).toBeVisible();
    await ctx.close();
  });
});

test.describe("deep links", () => {
  test("a lesson opens from a link, a refresh mid-lesson resumes it, and Back closes the lesson without leaving the hub", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await familyCtx(browser);
    const page = await ctx.newPage();
    await openFamily(page, `?tab=notes&child=${avaId}&open=lesson:${L.noteId}`);
    const player = page.getByTestId("lesson-player");
    await expect(player).toBeVisible({ timeout: 30_000 });
    await expect(player).toHaveAttribute("data-step", "start");
    await expect(player.getByTestId("hub-child-chip").first()).toHaveAttribute("data-child-id", avaId);
    await page.getByTestId("lesson-start").click();
    await expect(player).not.toHaveAttribute("data-step", "start", { timeout: 20_000 });
    const step = await player.getAttribute("data-step");
    await page.reload();
    await expect(page.getByTestId("lesson-player")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("lesson-player")).toHaveAttribute("data-step", step!, { timeout: 30_000 });

    // Opened from the list (a pushed entry), Back closes the lesson and stays in the hub.
    await gotoHub(page, `/custdash/learninghub?tab=notes&child=${avaId}`);
    await page.getByLabel("Search lessons").fill(L.title);
    await cardWith(page, L.title).getByRole("button", { name: L.title, exact: true }).click();
    await expect(page.getByTestId("lesson-player")).toBeVisible({ timeout: 30_000 });
    expect(decodeURIComponent(page.url())).toContain(`open=lesson:${L.noteId}`);
    await page.goBack();
    await expect(page.getByTestId("lesson-player")).toHaveCount(0);
    await expect(page.locator("#hub-notes")).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/custdash\/learninghub/);
    await ctx.close();
  });

  test("a lesson's exit quiz is not offered as a loose quiz; it points back to the lesson", async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await familyCtx(browser);
    const page = await ctx.newPage();
    await openFamily(page, `?tab=quizzes&child=${avaId}`);
    const row = page.locator(`[data-lesson-quiz="${L.quizId}"]`);
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText("Do the lesson first");
    await expect(page.locator(`#hub-assess-${L.quizId}`)).toHaveCount(0); // not among the cards you can Start cold
    await row.getByTestId("hub-quiz-start-lesson").click();
    await expect(page.getByTestId("lesson-player")).toBeVisible({ timeout: 30_000 });
    await ctx.close();
  });

  test("homework: 'Take the quiz' opens THAT quiz for the homework, survives a refresh, and is recorded against the homework", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await familyCtx(browser);
    const page = await ctx.newPage();
    await openFamily(page, `?tab=homework&child=${avaId}&open=hw:${hwId}`);
    const detail = page.locator("#hub-homework-detail");
    await expect(detail).toContainText(HW_TITLE, { timeout: 30_000 });
    await expect(detail.getByTestId("hub-child-chip")).toHaveAttribute("data-child-id", avaId);
    await detail.getByTestId("hub-hw-quiz").getByRole("button", { name: /Take the quiz/ }).click();
    await expect(page.getByTestId("hub-start")).toBeVisible({ timeout: 30_000 });
    expect(decodeURIComponent(page.url())).toContain(`open=quiz:${quizId}`);
    expect(page.url()).toContain(`hw=${hwId}`);

    await page.reload(); // lands on the same quiz's start screen
    await expect(page.getByTestId("hub-start")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("hub-start").click();
    await finishQuiz(page);
    await expect(page.getByTestId("hub-result-for").getByTestId("hub-child-chip")).toHaveAttribute("data-child-id", avaId, { timeout: 30_000 });
    const mine = (await parentAttempts(avaId)).filter((a) => a.assessmentId === quizId);
    expect(mine.some((a) => a.homeworkId === hwId && a.status === "marked")).toBe(true);
    expect((await parentAttempts(benId)).some((a) => a.homeworkId === hwId)).toBe(false);

    // Back from the finished paper returns to the homework, which now shows the quiz as done.
    await page.goBack();
    await expect(page.locator("#hub-homework-detail")).toContainText(HW_TITLE, { timeout: 30_000 });
    await expect(page.locator("#hub-homework-detail").getByTestId("hub-hw-quiz")).toContainText(/Done/, { timeout: 30_000 });
    await ctx.close();
  });
});

test.describe("parent extras + notifications", () => {
  test("Home carries a parent summary and an 'Ask your tutor' link to the provider's messages", async ({ browser }) => {
    test.setTimeout(120_000);
    const ctx = await familyCtx(browser);
    const page = await ctx.newPage();
    await openFamily(page, `?tab=home&child=${avaId}`);
    const summary = page.getByTestId("hub-parent-summary");
    await expect(summary).toContainText(avaName, { timeout: 30_000 });
    await expect(summary).toContainText(/quiz/);
    const ask = page.getByTestId("hub-ask-tutor").first();
    await expect(ask).toBeVisible();
    expect(await ask.getAttribute("href")).toContain(`/custdash/messages?compose=1&tenant=${tenantId}`);
    await ctx.close();
  });

  test("a tutor marking a written quiz tells the family, and the alert opens the right child's quizzes", async () => {
    test.setTimeout(120_000);
    const t = await token(accounts.freelancer);
    const p = await token(accounts.parent);
    const q = `?tenantId=${tenantId}&childId=${avaId}`;
    const started = await apiPost<{ attemptId: string; questions: { id: string }[] }>(`${HUB}/assessments/${writtenQuizId}/attempts${q}`, p, { childId: avaId });
    await apiPost(`${HUB}/attempts/${started.attemptId}/submit${q}`, p, { answers: [{ questionId: started.questions[0].id, response: "Because of scattering." }] });
    const put = await fetch(`${API_URL}${HUB}/attempts/${started.attemptId}/mark`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ answers: [{ questionId: started.questions[0].id, marksAwarded: 3, feedback: "Nice." }] }) });
    expect(put.status).toBe(200);
    await expect.poll(async () => {
      const r = await apiFetch<{ notifications: { title: string; body: string; href?: string }[] }>("/api/notifications", p);
      return r.notifications.find((n) => n.title === "Quiz marked" && n.body.includes(WRITTEN_QUIZ))?.href ?? "";
    }, { timeout: 25_000 }).toContain(`child=${avaId}`);
    const r = await apiFetch<{ notifications: { title: string; body: string; href?: string }[] }>("/api/notifications", p);
    const href = r.notifications.find((n) => n.title === "Quiz marked" && n.body.includes(WRITTEN_QUIZ))!.href!;
    expect(href).toContain("tab=quizzes");
    expect(href.startsWith("/custdash/learninghub?")).toBe(true);
    // A new-homework alert names the homework so it opens the right thing for the right child.
    const hwn = r.notifications.find((n) => n.title === "New homework" && n.body.includes(HW_TITLE));
    if (hwn) { expect(decodeURIComponent(hwn.href!)).toContain(`open=hw:${hwId}`); expect(hwn.href).toContain(`child=${avaId}`); }
  });
});

test.describe("phone (390px)", () => {
  test("family bar, who's-learning picker, kid bar, gate and runner header fit with 44px targets and no sideways scroll", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await browser.newContext({ storageState: statePath("parent"), viewport: { width: 390, height: 844 }, hasTouch: true });
    if (envApi && envApi !== API_URL) {
      const origin = new URL(envApi).origin;
      await ctx.route((u) => u.origin === origin, async (route) => {
        const url = viaLocalApi(route.request().url());
        if (url.includes("/api/events/") && !url.includes("/ticket")) return route.abort();
        try { await route.fulfill({ response: await route.fetch({ url }) }); } catch { await route.abort(); }
      });
    }
    await ctx.route(/\/api\/learning-hub\/providers(\?|$)/, async (route) => {
      const res = await route.fetch({ url: viaLocalApi(route.request().url()) });
      const list = (await res.json()) as { tenantId: string; children?: { childId: string }[] }[];
      await route.fulfill({ response: res, json: list.map((p) => (p.tenantId === tenantId ? { ...p, children: (p.children ?? []).filter((c) => [avaId, benId].includes(c.childId)) } : p)) });
    });
    const page = await ctx.newPage();
    const noSideways = async (what: string) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${what} scrolls sideways`).toBe(true);
    const tall = async (loc: ReturnType<Page["locator"]>, what: string) => {
      const boxes = await loc.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
      expect(boxes.length, `${what}: none found`).toBeGreaterThan(0);
      for (const h of boxes) expect(h, `${what} is ${h}px tall`).toBeGreaterThanOrEqual(44);
    };
    await openFamily(page, `?tab=quizzes&child=${avaId}`);
    await expect(page.locator("#hub-family-bar")).toBeVisible({ timeout: 30_000 });
    await noSideways("family bar");
    await tall(page.locator('#hub-family-bar button, #hub-family-bar a'), "family bar buttons");
    await cardWith(page, QUIZ).getByTestId("hub-open-assessment").click();
    await page.getByTestId("hub-who-switch").click();
    await expect(page.getByTestId("hub-who-picker")).toBeVisible();
    await tall(page.getByTestId("hub-who-kid"), "who's-learning buttons");
    await noSideways("who's learning");
    await page.getByTestId("hub-who-kid").filter({ hasText: avaName }).click();
    await page.getByTestId("hub-start").click();
    await expect(page.getByTestId("hub-runner")).toBeVisible({ timeout: 30_000 });
    await expect(chip(page).first()).toBeVisible();
    await noSideways("quiz runner header");
    await page.getByRole("button", { name: "Leave this quiz" }).click();
    await page.getByRole("button", { name: "Leave for now" }).click();
    // Kid mode + the gate.
    await page.locator("#hub-tab-home").click();
    await page.locator(`[data-testid="hub-hand-over"][data-child-id="${avaId}"]`).click();
    await expect(page.locator("#learning-hub")).toHaveAttribute("data-kid", "1", { timeout: 20_000 });
    await noSideways("kid mode");
    await tall(page.getByTestId("kid-exit"), "kid exit button");
    await tall(page.getByRole("tab"), "kid tabs");
    await page.getByTestId("kid-exit").click();
    await expect(page.getByTestId("kid-gate-sum")).toBeVisible();
    await page.waitForTimeout(500); // the dialog scales in over .22s: measure it settled, not mid-animation (44px * .985 reads 43)
    await tall(page.getByTestId("kid-gate-unlock"), "gate unlock button");
    await noSideways("parent gate");
    await ctx.close();
  });
});

test.afterAll(async () => { await setHub(accounts.freelancer, true).catch(() => undefined); });
