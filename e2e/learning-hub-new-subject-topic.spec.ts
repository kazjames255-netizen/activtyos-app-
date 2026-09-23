import { test, expect, type Page } from "@playwright/test";
import { loadAccounts, statePath, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { cardWith } from "./helpers/ui";

// Learning Hub — inline "+ New subject" / "+ New topic" in every form that picks a subject or topic
// (features/learninghub/NewTopicInline.tsx): quiz builder (subject select + topic chips), question form, lesson editor,
// flashcard dialog. The new item is created through POST /api/learning-hub/topics and auto-selected. A subject can't be
// created twice under different casing. Assertions are anchored to THIS run's run-unique subject / topic names.

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const baseSubject = `Nst Base ${stamp}`;
const quizSubject = `Nst Quiz ${stamp}`;
const quizTopic = `Nst Quiz Topic ${stamp}`;
const qTopic = `Nst Q Topic ${stamp}`;
const noteTopic = `Nst Note Topic ${stamp}`;
const noteTitle = `Nst lesson ${stamp}`;
const cardSubject = `Nst Card ${stamp}`;

let accounts: AccountManifest["accounts"];
let token = "";

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
const tabOf = (page: Page, name: RegExp) => page.getByRole("tab", { name });

test.beforeAll(async () => {
  test.setTimeout(120_000);
  accounts = loadAccounts().accounts;
  await setHub(accounts.freelancer, true);
  token = (await fbSignIn(accounts.freelancer.email)).idToken;
  await apiPost("/api/learning-hub/topics", token, { subject: baseSubject, topic: "Base" });
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); });

async function openTab(page: Page, tab: RegExp) {
  const heading = page.getByRole("heading", { name: /Teaching Hub|My Classroom/ });
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto("/freelancer/learninghub");
    if (await heading.first().isVisible({ timeout: 25_000 }).catch(() => false)) break;
  }
  await expect(tabOf(page, tab)).toBeVisible({ timeout: 30_000 });
  await tabOf(page, tab).click();
}
const listTopics = () => apiFetch<{ id: string; subject: string; topic: string }[]>("/api/learning-hub/topics", token);

test.describe("new subject / topic inline", () => {
  test.use({ storageState: statePath("freelancer") });

  test("quiz builder: new subject then new topic, both auto-selected; casing dup is refused", async ({ page }) => {
    test.setTimeout(360_000);
    await openTab(page, /^Quizzes/);
    await page.getByTestId("hub-new-assessment").click();
    const nt = page.getByTestId("quiz-new-topic");
    await expect(nt).toBeVisible({ timeout: 20_000 });

    // a subject typed again under other casing is refused with a clear message
    await nt.getByTestId("quiz-new-topic-subject-btn").click();
    await nt.getByTestId("quiz-new-topic-name").fill(baseSubject.toUpperCase());
    await nt.getByTestId("quiz-new-topic-save").click();
    await expect(nt.getByTestId("quiz-new-topic-err")).toContainText(/already exists/i);

    // a genuinely new subject: created, then selected in the Subject select
    await nt.getByTestId("quiz-new-topic-name").fill(quizSubject);
    await nt.getByTestId("quiz-new-topic-save").click();
    await expect(page.locator("#ha-subject")).toHaveValue(quizSubject, { timeout: 20_000 });
    await expect(nt.getByTestId("quiz-new-topic-form")).toHaveCount(0);

    // a new topic under it: shows as a pressed "Topics covered" chip
    await nt.getByTestId("quiz-new-topic-topic-btn").click();
    await expect(nt.getByTestId("quiz-new-topic-subject-select")).toHaveValue(quizSubject);
    await nt.getByTestId("quiz-new-topic-name").fill(quizTopic);
    await nt.getByTestId("quiz-new-topic-save").click();
    await expect(page.getByRole("button", { name: quizTopic, pressed: true })).toBeVisible({ timeout: 20_000 });

    // and both really exist server-side
    const rows = await listTopics();
    expect(rows.some((r) => r.subject === quizSubject && r.topic === "General")).toBe(true);
    expect(rows.some((r) => r.subject === quizSubject && r.topic === quizTopic)).toBe(true);

    // the question form (opened from the builder) offers the same, defaulting to the quiz's subject
    await page.getByTestId("hub-inline-new-question").click();
    const qf = page.getByTestId("question-new-topic");
    await expect(page.locator("#hq-topic [aria-selected=true]")).toContainText(quizTopic, { timeout: 20_000 });
    await qf.getByTestId("question-new-topic-topic-btn").click();
    await expect(qf.getByTestId("question-new-topic-subject-select")).toHaveValue(quizSubject);
    await qf.getByTestId("question-new-topic-name").fill(qTopic);
    await qf.getByTestId("question-new-topic-save").click();
    await expect(page.locator("#hq-topic [aria-selected=true]")).toContainText(qTopic, { timeout: 20_000 });
  });

  test("lesson editor: new topic under an existing subject is created and selected, then the lesson saves into it", async ({ page }) => {
    test.setTimeout(360_000);
    await openTab(page, /^Lessons/);
    await expect(page.locator("#hub-notes")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /new lesson/i }).first().click();
    const nt = page.getByTestId("note-new-topic");
    await nt.getByTestId("note-new-topic-topic-btn").click();
    await nt.getByTestId("note-new-topic-subject-select").selectOption(baseSubject);
    await nt.getByTestId("note-new-topic-name").fill(noteTopic);
    await nt.getByTestId("note-new-topic-save").click();
    await expect(page.locator("#hub-note-topic")).toContainText(noteTopic, { timeout: 20_000 });
    await expect(page.locator("#hub-note-topic [aria-selected=true]")).toContainText(noteTopic);
    await page.locator("#hub-note-title").fill(noteTitle);
    await page.getByRole("button", { name: "Save lesson" }).click();
    await page.getByLabel("Search lessons").fill(noteTitle);
    const card = cardWith(page, noteTitle);
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toContainText(noteTopic);
  });

  test("flashcard dialog: new subject is created with a General topic and selected", async ({ page }) => {
    test.setTimeout(360_000);
    await openTab(page, /^Flashcards/);
    await page.locator("#hub-add-card").click();
    const nt = page.getByTestId("card-new-topic");
    await nt.getByTestId("card-new-topic-subject-btn").click();
    await nt.getByTestId("card-new-topic-name").fill(cardSubject);
    await nt.getByTestId("card-new-topic-save").click();
    await expect(page.locator("#hub-card-topic option:checked")).toContainText(`${cardSubject} › General`, { timeout: 20_000 });
    await page.locator("#hub-card-front").fill(`Front ${stamp}`);
    await page.locator("#hub-card-back").fill(`Back ${stamp}`);
    await page.getByRole("button", { name: "Save card" }).click();
    await expect(page.locator("#hub-card-dialog")).toHaveCount(0, { timeout: 20_000 });
    const rows = await listTopics();
    expect(rows.some((r) => r.subject === cardSubject && r.topic === "General")).toBe(true);
  });
});
