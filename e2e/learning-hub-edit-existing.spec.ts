import { test, expect, type Browser, type Page } from "@playwright/test";
import { loadAccounts, statePath, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { cardWith } from "./helpers/ui";

// Teaching Hub — the "New" / "Edit existing" tab strip inside the lesson editor, the quiz builder and the flashcard dialog.
// "Edit existing" is a searchable list of THIS tutor's existing lessons / quizzes / flashcards (server-searched, same subject /
// topic filters as the panels); choosing one opens it in the same editor. Every assertion is anchored to this run's stamp.

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const subject = `Editable ${stamp}`;
const NOTE = `Edit-me lesson ${stamp}`;
const NOTE2 = `Renamed lesson ${stamp}`;
const NOTE_OTHER = `Other lesson ${stamp}`;
const QUIZ = `Edit-me quiz ${stamp}`;
const QUIZ2 = `Renamed quiz ${stamp}`;
const CARD_FRONT = `Front to edit ${stamp}`;
const CARD_BACK2 = `Back rewritten ${stamp}`;

let accounts: AccountManifest["accounts"];
let topicId = "";

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
import { tabOf, openTab } from "./helpers/hubTabs";

async function tutorPage(browser: Browser) {
  const ctx = await browser.newContext({ storageState: statePath("freelancer") });
  const page = await ctx.newPage();
  const heading = page.getByRole("heading", { name: /Teaching Hub|My Classroom/ });
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto("/freelancer/learninghub");
    if (await heading.first().isVisible({ timeout: 25_000 }).catch(() => false)) break;
  }
  await expect(heading.first()).toBeVisible({ timeout: 30_000 });
  return { ctx, page };
}

test.beforeAll(async () => {
  test.setTimeout(120_000);
  accounts = loadAccounts().accounts;
  await setHub(accounts.freelancer, true);
  const t = (await fbSignIn(accounts.freelancer.email)).idToken;
  await apiPost("/api/learning-hub/topics", t, { subject, topic: "Things to edit" });
  const topics = await apiFetch<{ id: string; subject: string }[]>("/api/learning-hub/topics", t);
  topicId = topics.find((x) => x.subject === subject)!.id;
  await apiPost("/api/learning-hub/notes", t, { topicId, title: NOTE, body: "Original body text.", published: true, attachments: [] });
  await apiPost("/api/learning-hub/notes", t, { topicId, title: NOTE_OTHER, body: "Another one.", published: true, attachments: [] });
  const q = await apiPost<{ id: string }>("/api/learning-hub/questions", t, { topicId, kind: "short", prompt: `Name a triangle ${stamp}`, answer: "triangle", marks: 1 });
  await apiPost("/api/learning-hub/assessments", t, { type: "quiz", title: QUIZ, subject, topicIds: [topicId], questionIds: [q.id], timeLimitMins: null, passMarkPct: 50, published: true });
  await apiPost("/api/learning-hub/flashcards", t, { topicId, front: CARD_FRONT, back: "Original back", published: true });
});

test("lessons: New lesson has a New / Edit existing strip; Edit existing finds and opens a lesson", async ({ browser }) => {
  test.setTimeout(300_000);
  const { ctx, page } = await tutorPage(browser);
  await openTab(page, /^Lessons/);
  await expect(page.locator("#hub-notes")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /new lesson/i }).first().click();

  const editor = page.locator("#hub-note-editor");
  await expect(editor.getByRole("heading", { name: "New lesson" })).toBeVisible();
  const strip = editor.getByTestId("creator-tabs");
  await expect(strip.getByRole("tab", { name: "New" })).toHaveAttribute("aria-selected", "true");
  await strip.getByRole("tab", { name: "Edit existing" }).click();

  // Search is server-side and narrows to THIS run's lesson.
  await editor.getByTestId("edit-existing-search").fill(NOTE);
  const rows = editor.getByTestId("edit-existing-row");
  await expect(rows).toHaveCount(1, { timeout: 20_000 });
  await expect(rows.first()).toContainText(NOTE);
  await expect(editor.getByTestId("edit-existing-list")).not.toContainText(NOTE_OTHER);
  // Subject filter is offered too.
  await editor.getByLabel("Subject").selectOption(subject);
  await editor.getByTestId("edit-existing-search").fill("");
  await expect(rows).toHaveCount(2, { timeout: 20_000 });
  await editor.getByTestId("edit-existing-search").fill(NOTE);
  await expect(rows).toHaveCount(1, { timeout: 20_000 });

  await rows.first().click();
  await expect(editor.getByRole("heading", { name: "Edit lesson" })).toBeVisible({ timeout: 20_000 });
  await expect(editor.getByLabel("Title", { exact: true })).toHaveValue(NOTE);
  await expect(editor.getByLabel("Lesson text")).toHaveValue("Original body text.");
  await expect(strip.getByRole("tab", { name: "Edit existing" })).toHaveAttribute("aria-selected", "true");

  // Edit it and save: the list shows the renamed lesson.
  await editor.getByLabel("Title", { exact: true }).fill(NOTE2);
  await editor.getByRole("button", { name: "Save lesson" }).click();
  await expect(page.locator("#hub-notes")).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Search lessons").fill(NOTE2);
  await expect(cardWith(page, NOTE2)).toBeVisible({ timeout: 20_000 });

  await ctx.close();
});

test("lessons: the New tab starts blank again and asks first when the open lesson has unsaved changes", async ({ browser }) => {
  test.setTimeout(300_000);
  const { ctx, page } = await tutorPage(browser);
  await openTab(page, /^Lessons/);
  await expect(page.locator("#hub-notes")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /new lesson/i }).first().click();
  const editor = page.locator("#hub-note-editor");
  const strip = editor.getByTestId("creator-tabs");
  await strip.getByRole("tab", { name: "Edit existing" }).click();
  await editor.getByTestId("edit-existing-search").fill(NOTE2);
  await expect(editor.getByTestId("edit-existing-row")).toHaveCount(1, { timeout: 20_000 });
  await editor.getByTestId("edit-existing-row").first().click();
  await expect(editor.getByLabel("Title", { exact: true })).toHaveValue(NOTE2, { timeout: 20_000 });
  await editor.getByLabel("Title", { exact: true }).fill(`${NOTE2} typo`);
  await strip.getByRole("tab", { name: "New" }).click();
  await expect(editor.getByTestId("edit-existing-confirm-new")).toBeVisible();
  await editor.getByTestId("edit-existing-confirm-new").click();
  await expect(editor.getByRole("heading", { name: "New lesson" })).toBeVisible();
  await expect(editor.getByLabel("Title", { exact: true })).toHaveValue("");
  await ctx.close();
});

test("quizzes: the New quiz builder has the strip; Edit existing opens a quiz in the builder", async ({ browser }) => {
  test.setTimeout(300_000);
  const { ctx, page } = await tutorPage(browser);
  await openTab(page, /^Quizzes/);
  await page.getByTestId("hub-new-assessment").click();
  const dlg = page.locator("#hub-assessment-builder");
  await expect(dlg).toBeVisible({ timeout: 20_000 });
  await expect(dlg).toContainText("New quiz");
  const strip = dlg.getByTestId("creator-tabs");
  await expect(strip.getByRole("tab", { name: "New" })).toHaveAttribute("aria-selected", "true");
  await strip.getByRole("tab", { name: "Edit existing" }).click();

  await dlg.getByTestId("edit-existing-search").fill(QUIZ);
  const rows = dlg.getByTestId("edit-existing-row");
  await expect(rows).toHaveCount(1, { timeout: 20_000 });
  await expect(rows.first()).toContainText(QUIZ);
  // the year-group filter is offered for quizzes
  await expect(dlg.getByLabel("Year group")).toBeVisible();
  await rows.first().click();

  await expect(dlg).toContainText("Edit quiz", { timeout: 20_000 });
  await expect(dlg.getByLabel("Title", { exact: true })).toHaveValue(QUIZ);
  await expect(dlg.getByText(`Name a triangle ${stamp}`).first()).toBeVisible();
  await dlg.getByLabel("Title", { exact: true }).fill(QUIZ2);
  await dlg.getByTestId("hub-save-assessment").click();
  await expect(dlg).toBeHidden({ timeout: 20_000 });
  await page.getByTestId("hub-assessment-search").getByRole("textbox").fill(QUIZ2);
  await expect(cardWith(page, QUIZ2)).toBeVisible({ timeout: 20_000 });
  await ctx.close();
});

test("flashcards: the New card dialog has the strip; Edit existing opens a card", async ({ browser }) => {
  test.setTimeout(300_000);
  const { ctx, page } = await tutorPage(browser);
  await openTab(page, /^Flashcards/);
  await page.locator("#hub-add-card").click();
  const dlg = page.locator("#hub-card-dialog");
  await expect(dlg).toBeVisible({ timeout: 20_000 });
  const strip = dlg.getByTestId("creator-tabs");
  await expect(strip.getByRole("tab", { name: "New" })).toHaveAttribute("aria-selected", "true");
  await strip.getByRole("tab", { name: "Edit existing" }).click();
  await dlg.getByTestId("edit-existing-search").fill(CARD_FRONT);
  const rows = dlg.getByTestId("edit-existing-row");
  await expect(rows).toHaveCount(1, { timeout: 20_000 });
  await rows.first().click();

  await expect(dlg.getByLabel(/Front \(question\)/)).toHaveValue(CARD_FRONT, { timeout: 20_000 });
  await expect(dlg).toContainText("Edit card");
  await dlg.getByLabel(/Back \(answer\)/).fill(CARD_BACK2);
  await dlg.getByRole("button", { name: "Save changes" }).click();
  await expect(dlg).toBeHidden({ timeout: 20_000 });
  await page.getByLabel("Search cards").fill(CARD_FRONT);
  await expect(page.locator("[data-card]").filter({ hasText: CARD_FRONT })).toBeVisible({ timeout: 20_000 });
  await ctx.close();
  // and the API really has the new back
  const t = (await fbSignIn(accounts.freelancer.email)).idToken;
  const res = await apiFetch<{ front: string; back: string }[] | { items: { front: string; back: string }[] }>(`/api/learning-hub/flashcards?limit=20&q=${encodeURIComponent(CARD_FRONT)}`, t);
  const cards = Array.isArray(res) ? res : res.items;
  expect(cards.find((c) => c.front === CARD_FRONT)?.back).toBe(CARD_BACK2);
});
