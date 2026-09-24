import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { seedOakLesson, type SeedQ, type SeededLesson } from "./helpers/lessonFixture";
import { cardWith, dismissParentWelcome } from "./helpers/ui";

// Learning Hub — interactive LESSONS (features/learninghub/lesson). An Oak-shaped structured lesson is seeded through the API
// (helpers/lessonFixture.ts, built from scratch/oak-raw/… as docs/oak-import.md prescribes). Then:
//  • tutor: the Lessons tab lists it with an "Interactive" chip, the reader shows the tutor panel, the widget picker attaches /
//    detaches the Explore activity (PATCH), Preview plays it read-only;
//  • parent: plays it end to end (start → learn + widget → key words → warm-up with instant feedback → REAL exit-quiz attempt →
//    done), and the attempt + mastery really exist server-side; no answer key reached the browser before an answer was committed;
//  • a plain markdown note still opens as a note; editing a lesson's text never wipes the structured part; family payloads drop
//    the teacher-only parts; nothing overflows a 360px phone.
// Every state assertion is anchored to THIS run's lesson / quiz (run-unique title, the quiz id, the child's attempt row).

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const subject = `Lessons Lab ${stamp}`;
const childName = `Lessonkid ${stamp}`;
const plainTitle = `Plain markdown note ${stamp}`;
const plainText = `A plain note body ${stamp}`;

let accounts: AccountManifest["accounts"];
let childId = "";
let tenantId = "";
let topicId = "";
let L: SeededLesson;
let plainId = "";

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
import { tabOf, openTab } from "./helpers/hubTabs";

// If .env.local points the web app at a tunnel that isn't up, send its API calls to the local API instead.
const envApi = (() => {
  try {
    const m = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/^NEXT_PUBLIC_API_URL=(.*)$/m);
    return m?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  } catch { return ""; }
})();
async function ctxFor(browser: Browser, role: "freelancer" | "parent", extra: Parameters<Browser["newContext"]>[0] = {}) {
  const ctx = await browser.newContext({ storageState: statePath(role), ...extra });
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
  test.setTimeout(300_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  await setHub(accounts.freelancer, true);
  const t = await token(accounts.freelancer);
  const listing = await provisionLiveListing(accounts.freelancer, { title: `E2E Lessons Tuition ${stamp}`, price: 0 });
  childId = await createParentChild(accounts.parent, { name: childName });
  await bookViaApi(accounts.parent, listing, { child: childName, dates: [listing.runFrom] }).catch((e) => { if (!/clash|existing booking/i.test(String(e))) throw e; });
  await markParentWelcomed(accounts.parent);
  await apiPost("/api/learning-hub/topics", t, { subject, topic: "Neurones" });
  await apiPost("/api/learning-hub/students", t, { childId, subjects: [subject] });
  const topics = await apiFetch<{ id: string; subject: string }[]>("/api/learning-hub/topics", t);
  topicId = topics.find((x) => x.subject === subject)!.id;
  await setHub(accounts.freelancer, true); // other specs toggle the hub on this account
  L = await seedOakLesson(t, { stamp, subject, topicId, widget: "neurone" });
  const plain = await apiPost<{ id: string }>("/api/learning-hub/notes", t, { topicId, title: plainTitle, body: plainText, published: true });
  plainId = plain.id;
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); });

async function gotoHub(page: Page, url: string) {
  const heading = page.getByRole("heading", { name: /Teaching Hub|My Classroom/ });
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto(url);
    if (await heading.first().isVisible({ timeout: 25_000 }).catch(() => false)) return;
  }
  await expect(heading.first()).toBeVisible({ timeout: 30_000 });
}
async function openParentLessons(page: Page) {
  await dismissParentWelcome(page);
  await gotoHub(page, "/custdash/learninghub");
  const provider = page.getByLabel("Provider");
  if (await provider.isVisible().catch(() => false)) await provider.selectOption(tenantId);
  const select = page.getByRole("combobox", { name: "Child" });
  if (await select.isVisible().catch(() => false)) await select.selectOption({ label: childName });
  else {
    const radio = page.getByRole("radio", { name: childName });
    if (await radio.isVisible().catch(() => false)) await radio.click();
  }
  await openTab(page, /^Lessons/);
  await expect(page.locator("#hub-notes")).toBeVisible({ timeout: 20_000 });
}
async function openTutorLessons(page: Page) {
  await gotoHub(page, "/freelancer/learninghub");
  await openTab(page, /^Lessons/);
  await expect(page.locator("#hub-notes")).toBeVisible({ timeout: 20_000 });
}
/** Find THIS run's lesson in the list (search is server-side) and open it. */
async function openLesson(page: Page, title: string) {
  await page.getByLabel("Search lessons").fill(title);
  const card = cardWith(page, title);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole("button", { name: title, exact: true }).click();
}

// ── driving the question UIs (choice, short answer, order, match) ────────────────────────────────────────────────
const player = (page: Page) => page.getByTestId("lesson-player");
async function answer(page: Page, q: SeedQ, how: "right" | "wrong") {
  const root = player(page);
  // The quiz step starts a real attempt first (skeleton, data-step is already "quiz"): wait for THIS question to render before
  // reading its DOM (allInnerTexts does not auto-wait and used to return [] for a match question, silently skipping it).
  await expect(
    q.kind === "match" ? root.getByTestId("hub-match-term").first()
    : q.kind === "order" ? root.getByTestId("hub-order-item").first()
    : q.kind === "short" ? root.getByPlaceholder("Type your answer")
    : root.getByText(q.right, { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  if (q.kind === "single") {
    await root.getByText(how === "right" ? q.right : q.wrong, { exact: true }).click();
  } else if (q.kind === "short") {
    await root.getByPlaceholder("Type your answer").fill(how === "right" ? q.right : q.wrong);
  } else if (q.kind === "order") {
    // Put the items in the right order with the arrow buttons (wrong = leave the shuffle, confirm as it is).
    if (how === "right") {
      const want = q.items!;
      for (let target = 0; target < want.length; target++) {
        for (let guard = 0; guard < 12; guard++) {
          const texts = (await root.getByTestId("hub-order-item").allInnerTexts()).map((s) => s.replace(/\s+/g, " ").trim());
          const at = texts.findIndex((s) => s.includes(want[target]));
          if (at <= target) break;
          await root.getByRole("button", { name: `Move ${want[target]} up` }).click();
        }
      }
    }
    await root.getByTestId("hub-order-keep").click();
  } else if (q.kind === "match") {
    const terms = (await root.getByTestId("hub-match-term").allInnerTexts()).map((s) => s.trim());
    const defOf = terms.map((t) => q.pairs!.find((p) => p.term === t)!.definition);
    // wrong = swap the first two answers.
    const put = how === "right" ? defOf : defOf.map((d, i) => (i === 0 ? defOf[1] : i === 1 ? defOf[0] : d));
    for (let i = 0; i < terms.length; i++) {
      const exact = new RegExp(`^\\s*${put[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
      await root.getByTestId("hub-match-tile").filter({ hasText: exact }).first().click();
      await root.locator(`[data-match-slot="${i}"]`).click();
    }
  }
}

async function xpOf(page: Page) { return Number(((await page.getByTestId("lesson-xp").innerText()).match(/\d+/) ?? ["0"])[0]); }
async function streakOf(page: Page) { return Number(((await page.getByTestId("lesson-streak").innerText()).match(/\d+/) ?? ["0"])[0]); }
const stepIs = (page: Page, s: string) => expect(player(page)).toHaveAttribute("data-step", s, { timeout: 20_000 });

test.describe("tutor: lessons list, preview", () => {
  test("the tab says Lessons, the interactive lesson is flagged, and there is no activity picker", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await gotoHub(page, "/freelancer/learninghub");
    await expect(tabOf(page, /^Lessons/)).toBeVisible({ timeout: 30_000 });
    await openTab(page, /^Lessons/);
    await expect(tabOf(page, /Live lessons/)).toBeVisible(); // the video tab stays distinct (a sibling sub-tab under Lessons)
    await expect(tabOf(page, /Notes & resources/)).toHaveCount(0);
    await expect(page.locator("#hub-notes")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /new lesson/i }).first()).toBeVisible();

    await page.getByLabel("Search lessons").fill(L.title);
    const card = cardWith(page, L.title);
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toContainText("Interactive"); // this run's lesson carries the structured field
    await card.getByRole("button", { name: L.title, exact: true }).click();

    const panel = page.getByTestId("lesson-tutor-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(`${L.points.length} ideas`);
    await expect(panel).toContainText(`${L.warmup.length} warm-up`);
    // Owner decision 2026-09-20: tutors no longer pick an "Interactive activity" — the picker is gone (a lesson that already
    // carries a widget still plays it; see the pupil tests below).
    await expect(page.getByTestId("lesson-widget-select")).toHaveCount(0);
    await ctx.close();
  });

  test("the tutor reader shows the numbered, collapsible Lesson plan (steps, common mistakes, tips) and never the raw script", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await openTutorLessons(page);
    await openLesson(page, L.title);
    const plan = page.getByTestId("lesson-plan");
    await expect(plan).toBeVisible();
    await expect(plan.getByRole("heading", { name: "Lesson plan" })).toBeVisible();
    // THIS run's plan: one numbered step per step of the seeded plan, each titled as seeded
    const steps = plan.getByTestId("plan-step");
    await expect(steps).toHaveCount(L.plan.steps.length);
    for (const [i, st] of L.plan.steps.entries()) await expect(steps.nth(i)).toContainText(st.title);
    // collapsible: the first step is open, the second is closed until it is opened; "Expand all" opens every step
    await expect(steps.nth(0).locator("details")).toHaveAttribute("open", "");
    await expect(steps.nth(1).locator("details")).not.toHaveAttribute("open", "");
    await steps.nth(1).locator("summary").click();
    await expect(steps.nth(1).locator("details")).toHaveAttribute("open", "");
    await plan.getByTestId("lesson-plan-toggle").click();
    for (let i = 0; i < L.plan.steps.length; i++) await expect(steps.nth(i).locator("details")).toHaveAttribute("open", "");
    // the tutor-only notes, taken from this lesson's misconceptions / teacher tips
    await expect(plan.getByTestId("plan-mistakes")).toContainText(L.plan.commonMistakes[0].mistake);
    await expect(plan.getByTestId("plan-mistakes")).toContainText(L.plan.commonMistakes[0].fix);
    if (L.plan.watchOut.length) await expect(plan.getByTestId("plan-watchout")).toContainText(L.plan.watchOut[0].slice(0, 40));
    // the raw video script is gone everywhere in the reader
    await expect(page.getByText(/lesson script|lesson transcript/i)).toHaveCount(0);
    await ctx.close();
  });

  test("Preview plays the lesson read-only and starts nothing", async ({ browser }) => {
    test.setTimeout(240_000);
    const t = await token(accounts.freelancer);
    const attemptsBefore = (await apiFetch<unknown[]>(`/api/learning-hub/attempts`, t)).length;
    const ctx = await ctxFor(browser, "freelancer", { reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await openTutorLessons(page);
    await openLesson(page, L.title);
    await page.getByTestId("lesson-preview").click();
    await expect(page.getByText(/Preview — this is what students see/)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: L.title })).toBeVisible();
    await page.getByTestId("lesson-start").click();
    await stepIs(page, "learn");
    for (let i = 0; i < Math.min(3, L.points.length); i++) await page.getByTestId("lesson-next").click();
    await expect(player(page).locator('[data-widget="neurone"]')).toBeVisible(); // the attached Explore activity
    for (let i = Math.min(3, L.points.length); i < L.points.length; i++) await page.getByTestId("lesson-next").click();
    await page.getByTestId("lesson-next").click();
    await stepIs(page, "words");
    await page.getByRole("button", { name: "Show me all" }).click();
    await page.getByTestId("lesson-next").click();
    await stepIs(page, "warm");
    // Warm-up checks work in preview (the tutor may see keys); the quiz step only describes itself.
    const q0 = L.warmup[0];
    await answer(page, q0, "right");
    await page.getByTestId("lesson-check").click();
    await expect(player(page).getByRole("status").filter({ hasText: /Yes!|Spot on!|Nice one!|Correct!/ })).toBeVisible();
    await page.getByRole("button", { name: "Close preview" }).click();
    await expect(page.getByTestId("lesson-tutor-panel")).toBeVisible(); // back in the tutor's reader
    expect((await apiFetch<unknown[]>(`/api/learning-hub/attempts`, t)).length).toBe(attemptsBefore); // nothing was started
    await ctx.close();
  });
});

test.describe("parent plays the lesson end to end", () => {
  test("start → learn (+ Explore widget) → key words → warm-up → real quiz → done", async ({ browser }) => {
    test.setTimeout(300_000);
    const ctx = await ctxFor(browser, "parent", { reducedMotion: "reduce" });
    const page = await ctx.newPage();
    // No answer key may reach the browser before an answer is committed: record what the two "question" calls returned.
    const leaks: string[] = [];
    let sawWarmup = false, sawAttemptStart = false;
    page.on("response", async (r) => {
      const url = r.url();
      const isWarm = /\/notes\/[^/]+\/lesson-questions/.test(url);
      const isStart = /\/assessments\/[^/]+\/attempts/.test(url) && r.request().method() === "POST";
      if (!isWarm && !isStart) return;
      const body = await r.text().catch(() => "");
      if (isWarm) sawWarmup = true; else sawAttemptStart = true;
      if (/"correctAnswer"|"explanation"|"acceptedAnswers"|"answer":|"pairs"/.test(body)) leaks.push(`${isWarm ? "lesson-questions" : "attempt start"}: ${body.slice(0, 200)}`);
    });

    await openParentLessons(page);
    await openLesson(page, L.title);

    // Start card: outcome, outline, the licence credit.
    await expect(page.getByRole("heading", { level: 1, name: L.title })).toBeVisible();
    await expect(page.getByText(/By the end you can:/)).toBeVisible();
    // (The owner asked for the Oak credit line to be removed from the pupil player.)
    await expect(page.getByTestId("lesson-attribution")).toHaveCount(0);
    await expect(page.getByTestId("lesson-xp")).toContainText("0 XP");
    await page.getByTestId("lesson-start").click();

    // Learn: one point per card, key words highlighted with tap-for-meaning, then the Explore widget after the third point.
    await stepIs(page, "learn");
    // The first card that has a highlighted key word: tapping it shows its meaning.
    const before = Math.min(3, L.points.length); // the Explore card sits after the third idea
    let tapped = false;
    for (let i = 0; i < before; i++) {
      const hl = player(page).locator("button.ls-kw").first();
      if (!tapped && (await hl.count())) {
        const word = (await hl.innerText()).trim();
        const def = L.keywords.find((k) => k.keyword.toLowerCase() === word.toLowerCase())!.description;
        await hl.click();
        await expect(player(page).getByRole("status").filter({ hasText: def })).toBeVisible();
        tapped = true;
      }
      await page.getByTestId("lesson-next").click();
    }
    expect(tapped).toBe(true);
    expect(await xpOf(page)).toBe(2 * before); // +2 XP per card
    const xp = await xpOf(page);
    const widget = player(page).locator('[data-widget="neurone"]');
    await expect(widget).toBeVisible();
    await widget.getByRole("button", { name: /Send impulse/ }).click();
    await expect.poll(() => xpOf(page)).toBe(xp + 3); // the widget rewarded the pupil (reduced motion → instant)
    for (let i = before; i < L.points.length; i++) await page.getByTestId("lesson-next").click();
    await page.getByTestId("lesson-next").click(); // "Continue →" on the last card

    // Key words: flip every card to continue.
    await stepIs(page, "words");
    await expect(page.getByTestId("lesson-next")).toBeDisabled();
    for (const k of L.keywords) await player(page).getByRole("button", { name: new RegExp(`^${k.keyword}\\.`, "i") }).click();
    await expect(page.getByTestId("lesson-next")).toBeEnabled();
    await page.getByTestId("lesson-next").click();

    // Warm-up: the first answer is wrong → "Not quite" + the answer; the rest right → the streak builds.
    await stepIs(page, "warm");
    const wrongFirst = L.warmup[0];
    await answer(page, wrongFirst, "wrong");
    await page.getByTestId("lesson-check").click();
    const fb = player(page).getByRole("status").filter({ hasText: "Not quite" });
    await expect(fb).toBeVisible();
    if (wrongFirst.kind === "single" || wrongFirst.kind === "short") await expect(fb).toContainText(wrongFirst.right);
    if (wrongFirst.explanation) await expect(fb).toContainText(wrongFirst.explanation.slice(0, 30));
    expect(await streakOf(page)).toBe(0);
    await page.getByTestId("lesson-next").click();
    for (let i = 1; i < L.warmup.length; i++) {
      await answer(page, L.warmup[i], "right");
      await page.getByTestId("lesson-check").click();
      await expect(player(page).getByRole("status").filter({ hasText: /Yes!|Spot on!|Nice one!|Correct!/ })).toBeVisible();
      await expect.poll(() => streakOf(page)).toBe(i);
      await page.getByTestId("lesson-next").click();
    }

    // Quiz: a REAL attempt. Everything right except the last question.
    await stepIs(page, "quiz");
    const n = L.quiz.length;
    for (let i = 0; i < n; i++) {
      await answer(page, L.quiz[i], i === n - 1 && n > 1 ? "wrong" : "right");
      if (i < n - 1) await page.getByTestId("lesson-next").click();
    }
    await page.getByTestId("lesson-finish").click();
    await stepIs(page, "done");
    const expected = n > 1 ? n - 1 : n;
    await expect(page.getByTestId("lesson-score")).toHaveText(new RegExp(`^\\s*${expected}\\s*/\\s*${n}\\s*$`));
    await expect(player(page).getByText("Worth another look")).toBeVisible(); // anchored to this attempt's one mistake
    await expect(player(page).getByText(L.quiz[n - 1].prompt).first()).toBeVisible();
    await expect(player(page).getByText(/Your progress is updated/)).toBeVisible();
    // The raw script is gone; the plan's steps come back as a friendly "Recap: step by step" (same steps as the tutor plan)
    await expect(player(page).getByText(/Read the full lesson script/i)).toHaveCount(0);
    const recap = player(page).getByTestId("lesson-recap");
    await expect(recap.getByRole("heading", { name: "Recap: step by step" })).toBeVisible();
    await expect(recap.getByTestId("recap-step")).toHaveCount(L.plan.steps.length);
    for (const st of L.plan.steps) await expect(recap).toContainText(st.recap[0].slice(0, 40));
    await expect(recap).not.toContainText(L.plan.commonMistakes[0].mistake); // tutor-only: mistakes are never shown to the student

    expect(sawWarmup && sawAttemptStart).toBe(true);
    expect(leaks, leaks.join("\n")).toEqual([]);

    // The attempt is REAL: the server marked it, scored it and rolled it into the child's mastery.
    const pt = await token(accounts.parent);
    const attempts = await apiFetch<{ assessmentId: string; status: string; scoreMarks: number; maxMarks: number }[]>(`/api/learning-hub/attempts?tenantId=${tenantId}&childId=${childId}`, pt);
    const mine = attempts.filter((a) => a.assessmentId === L.quizId);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ status: "marked", scoreMarks: expected, maxMarks: n });
    const mastery = await apiFetch<{ subjects: { subject: string; topics: { topicId: string; attempts: number }[] }[] }>(`/api/learning-hub/mastery?tenantId=${tenantId}&childId=${childId}`, pt);
    expect(mastery.subjects.find((s) => s.subject === subject)?.topics.find((x) => x.topicId === topicId)?.attempts ?? 0).toBeGreaterThanOrEqual(1);

    // "Back to lessons" returns to the list, focus mode released (the tabs are back).
    await page.getByTestId("lesson-exit").click();
    await expect(cardWith(page, L.title)).toBeVisible();
    await expect(tabOf(page, /^Lessons/)).toBeVisible();
    await ctx.close();
  });

  test("a plain markdown note still opens as a note, not the lesson player", async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await ctxFor(browser, "parent");
    const page = await ctx.newPage();
    await openParentLessons(page);
    await page.getByLabel("Search lessons").fill(plainTitle);
    const card = cardWith(page, plainTitle);
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).not.toContainText("Interactive");
    await card.getByRole("button", { name: plainTitle, exact: true }).click();
    await expect(page.getByRole("heading", { name: plainTitle })).toBeVisible();
    await expect(page.getByText(plainText)).toBeVisible();
    await expect(page.getByTestId("lesson-player")).toHaveCount(0);
    await ctx.close();
  });

  test("fits a 360px phone", async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await ctxFor(browser, "parent", { viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await openParentLessons(page);
    await openLesson(page, L.title);
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await expect(page.getByRole("heading", { level: 1, name: L.title })).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(1);
    await page.getByTestId("lesson-start").click();
    await stepIs(page, "learn");
    for (let i = 0; i < Math.min(3, L.points.length); i++) await page.getByTestId("lesson-next").click();
    await expect(player(page).locator('[data-widget="neurone"]')).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(1);
    await ctx.close();
  });
});

test.describe("API: lesson field, widget patch, family payloads", () => {
  test("editing the text keeps the structured lesson; families lose teacher-only parts; PATCH is guarded", async () => {
    const t = await token(accounts.freelancer);
    const pt = await token(accounts.parent);
    type Note = { title: string; body: string; published: boolean; lesson?: Record<string, unknown> | null };
    const before = await apiFetch<Note>(`/api/learning-hub/notes/${L.noteId}`, t);
    expect(before.lesson?.teacherTips).toBeTruthy();
    expect(before.lesson?.misconceptions).toBeTruthy();

    // The markdown editor's PUT never sends `lesson` → it must survive.
    const put = await apiFetch<Note>(`/api/learning-hub/notes/${L.noteId}`, t, { method: "PUT", body: JSON.stringify({ topicId, title: before.title, body: `${before.body}\n\nEdited ${stamp}`, published: true }) });
    expect(put.body).toContain(`Edited ${stamp}`);
    const after = await apiFetch<Note>(`/api/learning-hub/notes/${L.noteId}`, t);
    expect(after.lesson?.widget).toBe("neurone");
    expect(after.lesson?.quizId).toBe(L.quizId);

    // A family gets the lesson but not the teacher-only parts.
    const fam = await apiFetch<Note>(`/api/learning-hub/notes/${L.noteId}?tenantId=${tenantId}&childId=${childId}`, pt);
    expect(fam.lesson?.warmupQuestionIds).toEqual(L.warmup.map((q) => q.id));
    expect(fam.lesson?.teacherTips).toBeUndefined();
    expect(fam.lesson?.misconceptions).toBeUndefined();
    // The plan: a tutor gets it whole; a family gets the steps (student recap) but not the common mistakes / tips. No transcript anywhere.
    type P = { steps: unknown[]; commonMistakes?: unknown[]; watchOut?: unknown[] };
    const tp = before.lesson?.plan as P | undefined;
    expect(tp?.steps).toHaveLength(L.plan.steps.length);
    expect(tp?.commonMistakes?.length).toBeGreaterThan(0);
    const fp = fam.lesson?.plan as P | undefined;
    expect(fp?.steps).toHaveLength(L.plan.steps.length);
    expect(fp?.commonMistakes).toBeUndefined();
    expect(fp?.watchOut).toBeUndefined();
    expect(before.lesson?.transcript).toBeUndefined();
    expect(before.body).not.toMatch(/lesson transcript/i);

    // PATCH: only a tutor, only a sane id, only a lesson.
    const patch = (id: string, tok: string, body: unknown) => fetch(`${API_URL}/api/learning-hub/notes/${id}?tenantId=${tenantId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify(body) });
    expect((await patch(L.noteId, pt, { lesson: { widget: "fractionBar" } })).status).toBe(403);
    expect((await patch(L.noteId, t, { lesson: { widget: "not a valid id!" } })).status).toBe(400);
    expect((await patch(plainId, t, { lesson: { widget: "neurone" } })).status).toBe(409);
    expect((await patch(L.noteId, t, { lesson: { widget: "neurone" } })).status).toBe(200);

    // A lesson may only point at THIS tenant's questions / quiz.
    const bad = await fetch(`${API_URL}/api/learning-hub/notes`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ topicId, title: `Bad ${stamp}`, body: "", published: false, lesson: { warmupQuestionIds: ["does-not-exist"] } }) });
    expect(bad.status).toBe(400);

    // Warm-up checks: a foreign question id is refused; a right answer marks correct without needing a child key in the URL for a tutor.
    const q = L.warmup.find((x) => x.kind === "single" || x.kind === "short");
    if (q) {
      const other = await fetch(`${API_URL}/api/learning-hub/notes/${L.noteId}/warmup-check?tenantId=${tenantId}&childId=${childId}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${pt}` }, body: JSON.stringify({ questionId: L.quiz[0].id, response: "x" }) });
      expect(other.status).toBe(404); // a quiz question isn't part of the warm-up
    }
  });
});
