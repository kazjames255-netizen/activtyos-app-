import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { cardWith, dismissParentWelcome } from "./helpers/ui";

// Learning Hub — quizzes UI. The tutor writes a question and builds a quiz in the
// UI; the family sits it (single choice, short answer, number, written) and gets
// an instant scored review with the written answer pending; the tutor marks the
// written answer; the family then sees "Passed", the tutor's feedback, and their
// progress; the tutor's progress overview shows the student. Every state
// assertion is anchored to THIS run's quiz / child (cardWith / run-unique text).

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const subject = `Quizzing ${stamp}`;
const childName = `Quizkid ${stamp}`;
const quizTitle = `Sets quiz ${stamp}`;
const Q = {
  choice: `Which of these is prime? (${stamp})`,
  short: `Name the shape with three sides (${stamp})`,
  number: `What is 6 × 7? (${stamp})`,
  written: `Explain what a prime number is (${stamp})`,
  ui: `What is the name for a shape with four equal sides? (${stamp})`,
};
const FEEDBACK = `Well reasoned ${stamp}`;
const PIC_Q = `Which shape is drawn here? (${stamp})`;
const PIC_ALT = `A tiny test picture of a dot (${stamp})`;
const PIC_QUIZ = `Picture quiz ${stamp}`;
const ONCE_QUIZ = `One-shot quiz ${stamp}`;
const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const pngDataUrl = `data:image/png;base64,${PNG_B64}`;

let accounts: AccountManifest["accounts"];
let childId = "";

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
const tabOf = (page: Page, name: RegExp) => page.getByRole("tab", { name });

// If .env.local points the web app at a tunnel that isn't up, send its API calls
// to the local API instead (same trick as the teaching-ui spec).
const envApi = (() => {
  try {
    const m = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/^NEXT_PUBLIC_API_URL=(.*)$/m);
    return m?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  } catch { return ""; }
})();
async function ctxFor(browser: Browser, role: "freelancer" | "parent") {
  const ctx = await browser.newContext({ storageState: statePath(role) });
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

test.beforeAll(async () => {
  test.setTimeout(240_000);
  accounts = loadAccounts().accounts;
  await setHub(accounts.freelancer, true);
  const t = await token(accounts.freelancer);
  const listing = await provisionLiveListing(accounts.freelancer, { title: `E2E Quiz Tuition ${stamp}`, price: 0 });
  childId = await createParentChild(accounts.parent, { name: childName });
  await bookViaApi(accounts.parent, listing, { child: childName, dates: [listing.runFrom] }).catch((e) => { if (!/clash|existing booking/i.test(String(e))) throw e; });
  await markParentWelcomed(accounts.parent);
  await apiPost("/api/learning-hub/topics", t, { subject, topic: "Sets" });
  await apiPost("/api/learning-hub/students", t, { childId, subjects: [subject] });
  const topics = await apiFetch<{ id: string; subject: string }[]>("/api/learning-hub/topics", t);
  const topicId = topics.find((x) => x.subject === subject)!.id;
  const opts = ["9", "7", "8", "12"].map((text, i) => ({ id: `o${i}`, text }));
  await apiPost("/api/learning-hub/questions", t, { topicId, kind: "single", prompt: Q.choice, options: opts, answer: "o1", marks: 1, explanation: "7 only divides by 1 and 7." });
  await apiPost("/api/learning-hub/questions", t, { topicId, kind: "short", prompt: Q.short, answer: "triangle", marks: 1 });
  await apiPost("/api/learning-hub/questions", t, { topicId, kind: "number", prompt: Q.number, answer: 42, tolerance: 0, marks: 1 });
  await apiPost("/api/learning-hub/questions", t, { topicId, kind: "written", prompt: Q.written, marks: 4 });
  // A question with a picture (+ alt text) in its own one-question quiz, and a one-attempt quiz.
  await setHub(accounts.freelancer, true); // other specs toggle the hub on this account
  const pic = await apiPost<{ id: string }>("/api/uploads", t, { dataUrl: pngDataUrl, purpose: "private", kind: "hub" });
  const picQ = await apiPost<{ id: string }>("/api/learning-hub/questions", t, { topicId, kind: "short", prompt: PIC_Q, answer: "dot", marks: 1, image: { id: pic.id, alt: PIC_ALT } });
  await apiPost("/api/learning-hub/assessments", t, { type: "quiz", title: PIC_QUIZ, subject, topicIds: [topicId], questionIds: [picQ.id], timeLimitMins: null, passMarkPct: 50, published: true });
  await apiPost("/api/learning-hub/assessments", t, { type: "quiz", title: ONCE_QUIZ, subject, topicIds: [topicId], questionIds: [picQ.id], timeLimitMins: null, passMarkPct: 50, published: true, retakePolicy: "once" });
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); }); // other specs toggle the hub on this account

async function gotoHub(page: Page, url: string) {
  const heading = page.getByRole("heading", { name: /Teaching Hub|My Classroom/ });
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto(url);
    if (await heading.first().isVisible({ timeout: 25_000 }).catch(() => false)) return;
  }
  await expect(heading.first()).toBeVisible({ timeout: 30_000 });
}
async function openParentHub(page: Page, tab: RegExp) {
  await dismissParentWelcome(page);
  await gotoHub(page, "/custdash/learninghub");
  const provider = page.getByLabel("Provider");
  if (await provider.isVisible().catch(() => false)) await provider.selectOption(accounts.freelancer.tenantId!);
  const select = page.getByRole("combobox", { name: "Child" });
  if (await select.isVisible().catch(() => false)) await select.selectOption({ label: childName });
  else {
    const radio = page.getByRole("radio", { name: childName });
    if (await radio.isVisible().catch(() => false)) await radio.click();
  }
  await expect(tabOf(page, tab)).toBeVisible({ timeout: 30_000 });
  await tabOf(page, tab).click();
}
async function openTutorHub(page: Page, tab: RegExp) {
  await gotoHub(page, "/freelancer/learninghub");
  await expect(tabOf(page, tab)).toBeVisible({ timeout: 30_000 });
  await tabOf(page, tab).click();
}

test.describe("tutor authors in the UI", () => {
  test("writes a question, then builds and publishes a quiz from the bank", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await openTutorHub(page, /Quizzes/);

    // A question, from the form (kind list comes from the tenant config).
    await page.getByRole("radio", { name: "Question bank" }).click();
    await page.locator('[data-testid="hub-new-question"]').click();
    const qf = page.locator("#hub-question-form");
    await expect(qf).toBeVisible();
    await qf.getByTestId("hq-topic-subjects").getByRole("button", { name: subject, exact: true }).click();
    await qf.getByTestId("hq-topic-list").getByRole("option", { name: "Sets", exact: true }).click();
    await qf.getByRole("radio", { name: /Short answer/ }).click();
    await qf.getByLabel("Question", { exact: true }).fill(Q.ui);
    await qf.getByLabel("Correct answer").fill("square");
    // Live preview shows what a student will see.
    await expect(qf.getByRole("complementary", { name: "Student preview" })).toContainText(Q.ui);
    await qf.locator('[data-testid="hub-save-question"]').click();
    await expect(qf).toHaveCount(0);
    // The bank is paged (40) and sorted by topic, and the standing tutor's bank grows across specs — narrow to THIS run's questions.
    await page.getByPlaceholder("Search questions…").fill(stamp);
    await expect(cardWith(page, Q.ui, "Published")).toBeVisible({ timeout: 30_000 });
    await expect(cardWith(page, Q.written, "Written answer")).toBeVisible();

    // The quiz.
    await page.getByRole("radio", { name: "Quizzes" }).click();
    await page.locator('[data-testid="hub-new-assessment"]').click();
    const dlg = page.locator("#hub-assessment-builder");
    await expect(dlg).toBeVisible();
    await dlg.getByLabel("Title").fill(quizTitle);
    await dlg.getByLabel("Subject").selectOption({ label: subject });
    await dlg.getByLabel("Pass mark %").fill("50");
    // Who is this for? Year groups only (the age-range inputs were removed from the builder). The test child is 8, so tag Year 4 (they stay eligible).
    await dlg.getByRole("button", { name: "Year 4", exact: true }).click();
    await expect(dlg.locator('[data-testid="hub-audience-summary"]')).toContainText("Year 4");
    await expect(dlg.getByRole("group", { name: "Year groups" })).toBeVisible();
    for (let i = 0; i < 5; i++) await dlg.getByRole("button", { name: /^Add “/ }).first().click();
    await expect(dlg.getByText("5 questions, 8 marks").first()).toBeVisible();
    // Tutors are told why a paper with a written question waits.
    await expect(dlg.getByText(/1 written, you mark this/)).toBeVisible();
    await dlg.getByRole("switch").last().click(); // publish
    const saved = page.waitForResponse((r) => r.url().includes("/api/learning-hub/assessments") && r.request().method() === "POST");
    await dlg.locator('[data-testid="hub-save-assessment"]').click();
    expect((await saved).status()).toBe(201);
    await expect(dlg).toHaveCount(0);
    // The standing tutor now has many subjects; the list groups by subject and collapses the groups — narrow to THIS run's.
    await page.getByRole("group", { name: "Filter by subject" }).getByRole("button", { name: subject }).click();
    await expect(cardWith(page, quizTitle, "Published", "5 questions")).toBeVisible({ timeout: 30_000 });
    await expect(cardWith(page, quizTitle, "Year 4")).toBeVisible();
    await ctx.close();
  });
});

test.describe("the family sits it", () => {
  test("answers every kind, hands in, sees the score with the written answer pending", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await ctxFor(browser, "parent");
    const page = await ctx.newPage();
    await openParentHub(page, /Quizzes/);
    const card = cardWith(page, quizTitle);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toContainText("5 questions");
    await expect(card.locator('[data-testid="hub-audience-chips"]')).toContainText("Year 4");
    await card.locator('[data-testid="hub-open-assessment"]').click();
    await page.locator('[data-testid="hub-start"]').click();
    const runner = page.locator('[data-testid="hub-runner"]');
    await expect(runner).toBeVisible({ timeout: 20_000 });

    for (let i = 0; i < 5; i++) {
      const legend = (await runner.locator("legend").innerText()).trim();
      if (legend.includes(Q.choice)) await runner.getByText("7", { exact: true }).click();
      else if (legend.includes(Q.short)) await runner.getByPlaceholder("Type your answer").fill("Triangle");
      else if (legend.includes(Q.ui)) await runner.getByPlaceholder("Type your answer").fill("square");
      else if (legend.includes(Q.number)) await runner.getByPlaceholder("Enter a number").fill("42");
      else if (legend.includes(Q.written)) await runner.getByPlaceholder(/Write your answer/).fill("A prime has exactly two factors, one and itself.");
      else throw new Error(`unexpected question: ${legend}`);
      if (i < 4) await runner.locator('[data-testid="hub-next"]').click();
      else await runner.locator('[data-testid="hub-review"]').click();
    }
    await expect(page.getByText("Ready to hand in?")).toBeVisible();
    await page.locator('[data-testid="hub-handin"]').click();
    await page.locator('[data-testid="hub-confirm-submit"]').click();

    const result = page.locator('[data-testid="hub-result"]');
    await expect(result).toBeVisible({ timeout: 30_000 });
    // Self-marking clarity: the auto-marked score is shown at once (never a bare "Awaiting marking");
    // only the written answer is described as being with the tutor.
    await expect(result.locator('[data-testid="hub-result-headline"]')).toContainText("Auto-marked 4/4");
    const banner = result.locator('[data-testid="hub-result-banner"]');
    await expect(banner).toHaveAttribute("data-kind", "partial");
    await expect(banner.getByRole("img", { name: /Auto-marked 4 out of 4/ })).toBeVisible();
    await expect(banner).toContainText("1 written answer");
    await expect(banner.locator('[data-testid="hub-ring-maybe"]')).toHaveCount(1);
    await expect(result.getByText("Awaiting marking")).toHaveCount(0);
    const written = result.locator('[data-testid="hub-review-item"]').filter({ hasText: Q.written });
    await expect(written).toContainText("Your tutor is marking this");
    const choice = result.locator('[data-testid="hub-review-item"]').filter({ hasText: Q.choice });
    await expect(choice).toContainText("Correct");
    await ctx.close();
  });
});

test.describe("the tutor marks the written answer", () => {
  test("marking queue → award marks + feedback → saved", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await openTutorHub(page, /Quizzes/);
    await page.getByRole("radio", { name: /^Marking/ }).click();
    const row = page.locator('[data-testid="hub-marking-row"]').filter({ hasText: quizTitle }).filter({ hasText: childName });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.click();
    const form = page.locator('[data-testid="hub-mark-form"]');
    await expect(form).toContainText("A prime has exactly two factors");
    await form.locator('[data-testid="hub-marks-input"]').fill("4");
    await form.getByLabel(/^Feedback/).fill(FEEDBACK);
    const saved = page.waitForResponse((r) => /\/attempts\/[^/]+\/mark/.test(r.url()) && r.request().method() === "PUT");
    await form.locator('[data-testid="hub-save-marks"]').click();
    expect((await saved).status()).toBe(200);
    // Back in (or advanced past) the queue: THIS attempt is gone from it.
    const back = page.getByRole("button", { name: /← Queue/ });
    if (await back.isVisible().catch(() => false)) await back.click();
    await expect(page.locator('[data-testid="hub-marking-row"]').filter({ hasText: quizTitle }).filter({ hasText: childName })).toHaveCount(0, { timeout: 20_000 });
    await ctx.close();
  });

  test("Results lists it as passed, and the overview shows the student", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await openTutorHub(page, /Quizzes/);
    await page.getByRole("radio", { name: "Results" }).click();
    const res = page.locator('[data-testid="hub-results"]');
    const line = res.getByRole("button").filter({ hasText: childName }).filter({ hasText: quizTitle });
    await expect(line).toContainText("Passed", { timeout: 30_000 });
    await expect(line).toContainText("100%");
    // The quiz card carries its real numbers: attempts and the average score.
    await page.getByRole("radio", { name: "Quizzes" }).click();
    await page.getByRole("group", { name: "Filter by subject" }).getByRole("button", { name: subject }).click(); // groups are collapsed per subject
    const qcard = cardWith(page, quizTitle, "Published");
    await expect(qcard).toContainText("1 attempt", { timeout: 30_000 });
    await expect(qcard).toContainText("100%");
    await tabOf(page, /Progress/).click();
    const row = page.locator('[data-testid="hub-overview"] tbody tr').filter({ hasText: childName });
    await expect(row).toContainText("%", { timeout: 30_000 });
    await row.getByRole("button").click();
    await expect(page.locator(`[id="hub-progress-${subject}"]`)).toContainText("Sets", { timeout: 30_000 });
    await ctx.close();
  });
});

test.describe("resuming a paper", () => {
  test("a quiz left running after a reload is offered back as \"Resume your quiz\"", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await ctxFor(browser, "parent");
    const page = await ctx.newPage();
    await openParentHub(page, /Quizzes/);
    const card = cardWith(page, quizTitle);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.locator('[data-testid="hub-open-assessment"]').click();
    await page.locator('[data-testid="hub-start"]').click();
    await expect(page.locator('[data-testid="hub-runner"]')).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("Leave this quiz").click();
    await page.getByRole("button", { name: "Leave for now" }).click();
    // Back on the list the running paper is offered, not lost.
    const resume = page.locator('[data-testid="hub-resume"]').filter({ hasText: quizTitle });
    await expect(resume).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await openParentHub(page, /Quizzes/);
    const again = page.locator('[data-testid="hub-resume"]').filter({ hasText: quizTitle });
    await expect(again).toBeVisible({ timeout: 30_000 });
    await again.getByRole("button", { name: /Resume your quiz/ }).click();
    await expect(page.locator('[data-testid="hub-runner"]')).toBeVisible({ timeout: 30_000 });
    await ctx.close();
  });
});

test.describe("the family sees the outcome", () => {
  test("passed chip, the tutor's feedback, and progress by topic", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await ctxFor(browser, "parent");
    const page = await ctx.newPage();
    await openParentHub(page, /Quizzes/);
    const card = cardWith(page, quizTitle, "Passed");
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toContainText("100%");
    // Grouped: a passed quiz lives under "Done", not "To do".
    await expect(page.getByRole("region", { name: "Done" }).locator('[data-ui="card"]').filter({ hasText: quizTitle })).toBeVisible();
    await card.getByRole("button", { name: /Last result/ }).click();
    const result = page.locator('[data-testid="hub-result"]');
    await expect(result.locator('[data-testid="hub-result-headline"]')).toContainText("passed", { timeout: 20_000 });
    await expect(result.locator('[data-testid="hub-result-banner"]')).toHaveAttribute("data-kind", "passed");
    await expect(result.locator('[data-testid="hub-result-banner"]').getByRole("img", { name: /100 percent/ })).toBeVisible();
    await expect(result).toContainText(FEEDBACK);
    // The answer key is shown because the tenant's revealAnswers allows it.
    await expect(result.locator('[data-testid="hub-review-item"]').filter({ hasText: Q.choice })).toContainText("7 only divides");

    await tabOf(page, /Progress/).click();
    const prog = page.locator(`[id="hub-progress-${subject}"]`);
    await expect(prog).toBeVisible({ timeout: 30_000 });
    await expect(prog).toContainText("Sets");
    await expect(prog).toContainText("1 quiz");
    await ctx.close();
  });

  test("the placement test tab shows an honest empty state", async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await ctxFor(browser, "parent");
    const page = await ctx.newPage();
    await openParentHub(page, /Placement test/);
    await expect(page.getByText("Find your starting point")).toBeVisible({ timeout: 30_000 });
    await ctx.close();
  });
});

test.describe("pictures on questions", () => {
  test("the form makes alt text mandatory, and a family sees the picture and can zoom it", async ({ browser }) => {
    test.setTimeout(240_000);
    // Tutor: the question bank shows the picture question with its thumbnail chip; the form demands alt text.
    const tctx = await ctxFor(browser, "freelancer");
    const tpage = await tctx.newPage();
    await openTutorHub(tpage, /Quizzes/);
    await tpage.getByRole("radio", { name: "Question bank" }).click();
    await tpage.getByPlaceholder("Search questions…").fill(stamp); // the bank is paged and grows across specs
    await expect(cardWith(tpage, PIC_Q, "Picture")).toBeVisible({ timeout: 30_000 });
    await tpage.locator('[data-testid="hub-new-question"]').click();
    const qf = tpage.locator("#hub-question-form");
    await qf.getByTestId("hq-topic-subjects").getByRole("button", { name: subject, exact: true }).click();
    await qf.getByTestId("hq-topic-list").getByRole("option", { name: "Sets", exact: true }).click();
    await qf.getByRole("radio", { name: /Short answer/ }).click();
    const promptText = `Picture upload check (${stamp})`;
    await qf.getByLabel("Question", { exact: true }).fill(promptText);
    await qf.getByLabel("Correct answer").fill("dot");
    await qf.locator('[data-testid="hub-image-input"]').setInputFiles({ name: "dot.png", mimeType: "image/png", buffer: Buffer.from(PNG_B64, "base64") });
    await expect(qf.locator('[data-testid="hub-image-alt"]')).toBeVisible({ timeout: 30_000 });
    await qf.locator('[data-testid="hub-save-question"]').click();
    await expect(qf.getByText(/Describe the picture/).first()).toBeVisible();
    await qf.locator('[data-testid="hub-image-alt"]').fill("A single dot");
    await qf.locator('[data-testid="hub-save-question"]').click();
    await expect(qf).toHaveCount(0);
    await expect(cardWith(tpage, promptText, "Picture")).toBeVisible({ timeout: 30_000 });
    await tctx.close();

    // Family: the picture renders with its alt text and opens in a lightbox that Esc closes.
    const ctx = await ctxFor(browser, "parent");
    const page = await ctx.newPage();
    await openParentHub(page, /Quizzes/);
    const card = cardWith(page, PIC_QUIZ);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.locator('[data-testid="hub-open-assessment"]').click();
    await page.locator('[data-testid="hub-start"]').click();
    const img = page.locator('[data-testid="hub-question-image"] img');
    await expect(img).toBeVisible({ timeout: 30_000 });
    await expect(img).toHaveAttribute("alt", PIC_ALT);
    await page.getByRole("button", { name: /Enlarge picture/ }).click();
    const box = page.getByRole("dialog", { name: /Picture:/ });
    await expect(box).toContainText(PIC_ALT);
    await page.keyboard.press("Escape");
    await expect(box).toHaveCount(0);
    await expect(page.locator('[data-testid="hub-runner"]')).toBeVisible(); // Esc closed only the lightbox
    await ctx.close();
  });
});

test.describe("retake control", () => {
  test("a one-attempt quiz says so, and the tutor can allow one more go", async ({ browser }) => {
    test.setTimeout(240_000);
    const pt = await token(accounts.parent);
    const list = await apiFetch<{ id: string; title: string }[]>(`/api/learning-hub/assessments?tenantId=${accounts.freelancer.tenantId}&childId=${childId}&type=quiz`, pt);
    const once = list.find((a) => a.title === ONCE_QUIZ)!;
    const started = await apiPost<{ attemptId: string; questions: { id: string }[] }>(`/api/learning-hub/assessments/${once.id}/attempts?tenantId=${accounts.freelancer.tenantId}&childId=${childId}`, pt, { childId });
    await apiPost(`/api/learning-hub/attempts/${started.attemptId}/submit?tenantId=${accounts.freelancer.tenantId}&childId=${childId}`, pt, { answers: [{ questionId: started.questions[0].id, response: "dot" }] });

    const ctx = await ctxFor(browser, "parent");
    const page = await ctx.newPage();
    await openParentHub(page, /Quizzes/);
    const card = cardWith(page, ONCE_QUIZ);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.locator('[data-testid="hub-retake-once"]')).toContainText("One attempt only");
    await expect(card.locator('[data-testid="hub-open-assessment"]')).toHaveCount(0);

    // The tutor grants exactly one more attempt from Results.
    const tctx = await ctxFor(browser, "freelancer");
    const tpage = await tctx.newPage();
    await openTutorHub(tpage, /Quizzes/);
    await tpage.getByRole("radio", { name: "Results" }).click();
    const row = tpage.locator('[data-testid="hub-result-row"]').filter({ hasText: ONCE_QUIZ }).filter({ hasText: childName });
    await expect(row).toBeVisible({ timeout: 30_000 });
    const granted = tpage.waitForResponse((r) => /\/allow-retake/.test(r.url()) && r.request().method() === "POST");
    await row.getByRole("button", { name: /Allow one more attempt/ }).click();
    expect((await granted).status()).toBeLessThan(300);
    await tctx.close();

    await page.reload();
    await openParentHub(page, /Quizzes/);
    await expect(cardWith(page, ONCE_QUIZ).locator('[data-testid="hub-open-assessment"]')).toBeVisible({ timeout: 30_000 });
    await ctx.close();
  });
});

test.describe("attainment + editable levels", () => {
  test("Progress shows the real level; the tutor edits the levels and the legend follows", async ({ browser }) => {
    test.setTimeout(240_000);
    const t = await token(accounts.freelancer);
    const before = (await apiFetch<{ hub: { masteryBands: { min: number; label: string }[] } }>("/api/learning-hub/config", t)).hub.masteryBands;
    try {
      const pctx = await ctxFor(browser, "parent");
      const ppage = await pctx.newPage();
      await openParentHub(ppage, /Progress/);
      const att = ppage.locator('[data-testid="hub-attainment"]').first();
      await expect(att).toBeVisible({ timeout: 30_000 });
      await expect(att).toContainText("Attainment");
      await expect(att.locator('[data-testid="hub-attainment-band"]')).toBeVisible();
      await expect(att.locator('[data-testid="hub-attainment-marker"]')).toBeVisible();
      // No XP / level-N game bar any more.
      await expect(ppage.getByText(/\bXP\b/)).toHaveCount(0);
      await expect(ppage.locator('[data-testid="hub-trend"]')).toBeVisible();
      await pctx.close();

      const ctx = await ctxFor(browser, "freelancer");
      const page = await ctx.newPage();
      await openTutorHub(page, /Progress/);
      await page.locator('[data-testid="hub-overview"]').waitFor({ timeout: 30_000 });
      await page.locator('[data-testid="hub-edit-levels"]').click();
      const dlg = page.locator("#hub-levels-modal");
      await expect(dlg).toBeVisible();
      const newName = `Mastered ${stamp}`;
      await dlg.getByRole("button", { name: "Add a level" }).click();
      await dlg.getByLabel(/Level \d+ name/).last().fill(newName);
      await dlg.getByLabel(/Level \d+ starts at percent/).last().fill("95");
      const saved = page.waitForResponse((r) => r.url().includes("/api/learning-hub/config") && r.request().method() === "PUT");
      await dlg.locator('[data-testid="hub-save-levels"]').click();
      expect((await saved).status()).toBe(200);
      await expect(dlg).toHaveCount(0);
      await expect(page.locator('[data-testid="hub-level-legend"]').first()).toContainText(newName, { timeout: 30_000 });
      await ctx.close();
    } finally {
      await apiFetch("/api/learning-hub/config", t, { method: "PUT", body: JSON.stringify({ hub: { masteryBands: before } }) });
    }
  });
});
