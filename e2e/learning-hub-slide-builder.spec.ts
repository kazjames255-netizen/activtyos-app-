import { test, expect, type Page } from "@playwright/test";
import { loadAccounts, statePath, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";

// Learning Hub — the New lesson editor: subject-first topic picker with a search bar (features/learninghub/TopicPicker.tsx),
// the interactive slide builder (lesson/builder/SlideBuilder.tsx) and deleting an EMPTY subject. Assertions are anchored to
// this run's run-unique subject / topic / lesson names.

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const subj = `Sb Subject ${stamp}`;
const otherSubj = `Sb Other ${stamp}`;
const emptySubj = `Sb Empty ${stamp}`;
const topicA = `Alpha topic ${stamp}`;
const topicB = `Beta topic ${stamp}`;
const lessonTitle = `Sb lesson ${stamp}`;

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
  await apiPost("/api/learning-hub/topics", token, { subject: subj, topic: topicA });
  await apiPost("/api/learning-hub/topics", token, { subject: subj, topic: topicB });
  await apiPost("/api/learning-hub/topics", token, { subject: otherSubj, topic: "Other" });
  await apiPost("/api/learning-hub/topics", token, { subject: emptySubj, topic: "General" });
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); });

async function openNewLesson(page: Page) {
  const heading = page.getByRole("heading", { name: /Teaching Hub|My Classroom/ });
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto("/freelancer/learninghub");
    if (await heading.first().isVisible({ timeout: 25_000 }).catch(() => false)) break;
  }
  await expect(tabOf(page, /^Lessons/)).toBeVisible({ timeout: 30_000 });
  await tabOf(page, /^Lessons/).click();
  await expect(page.locator("#hub-notes")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /New lesson/ }).first().click();
  await expect(page.locator("#hub-note-title")).toBeVisible({ timeout: 20_000 });
}
const listTopics = () => apiFetch<{ id: string; subject: string; topic: string }[]>("/api/learning-hub/topics", token);

test.describe("new lesson editor", () => {
  test.use({ storageState: statePath("freelancer") });

  test("topic picker: subject first, then a search bar with the topic names listed", async ({ page }) => {
    test.setTimeout(240_000);
    await openNewLesson(page);
    const list = page.getByTestId("hub-note-topic-list");
    await page.getByTestId("hub-note-topic-subjects").getByRole("button", { name: subj }).click();
    await expect(list.getByRole("option", { name: topicA })).toBeVisible();
    await expect(list.getByRole("option", { name: topicB })).toBeVisible();
    // the other subject's topics are not listed under this subject
    await expect(list.getByRole("option", { name: "Other" })).toHaveCount(0);
    await page.getByTestId("hub-note-topic-search").fill("beta");
    await expect(list.getByRole("option", { name: topicA })).toHaveCount(0);
    await list.getByRole("option", { name: topicB }).click();
    await expect(list.getByRole("option", { name: topicB })).toHaveAttribute("aria-selected", "true");
    await page.getByTestId("hub-note-topic-search").fill("zzzz-nothing");
    await expect(list).toContainText("No " + subj + " topic matches");
  });

  test("slide builder: build slides with a multiple-choice question, preview, save; it opens as an interactive lesson", async ({ page }) => {
    test.setTimeout(300_000);
    await openNewLesson(page);
    await page.getByTestId("hub-note-topic-subjects").getByRole("button", { name: subj }).click();
    await page.getByTestId("hub-note-topic-list").getByRole("option", { name: topicA }).click();
    await page.locator("#hub-note-title").fill(lessonTitle);
    // slide 1: title + paragraph
    await page.getByTestId("sb-title").fill("What is a fraction?");
    await page.getByTestId("sb-add-block").click();
    await page.getByTestId("sb-add-text").click();
    await page.getByTestId("sb-block-0").locator("textarea").fill("A fraction is a **part** of a whole.");
    // slide 2: multiple choice
    await page.getByTestId("sb-new-slide").click();
    await page.getByTestId("sb-template-question").click();
    await page.getByTestId("sb-choice-q").fill("Which is a half?");
    await page.getByTestId("sb-choice-opt-0").fill("1/3");
    await page.getByTestId("sb-choice-opt-1").fill("1/2");
    await page.getByTestId("sb-choice-opt-2").fill("1/4");
    await page.getByRole("radio", { name: "Answer 2 is correct" }).click();
    await page.getByTestId("sb-preview").click();
    await expect(page.getByTestId("sb-preview-pane")).toContainText("Which is a half?");
    await page.getByTestId("sb-preview").click();
    await page.getByRole("button", { name: "Save lesson" }).click();
    await expect(page.locator("#hub-note-title")).toHaveCount(0, { timeout: 30_000 });

    const rows = await apiFetch<{ id: string; title: string }[]>(`/api/learning-hub/notes?q=${encodeURIComponent(lessonTitle)}`, token);
    const hit = rows.find((n) => n.title === lessonTitle);
    expect(hit, "the saved lesson is listed").toBeTruthy();
    const note = await apiFetch<{ lesson?: { slides?: { title: string; blocks: { t: string; answer?: number; options?: string[] }[] }[] } }>(`/api/learning-hub/notes/${hit!.id}`, token);
    const slides = note.lesson?.slides ?? [];
    expect(slides).toHaveLength(2);
    expect(slides[0]!.blocks[0]!.t).toBe("text");
    const choice = slides[1]!.blocks[0]!;
    expect(choice.t).toBe("choice");
    expect(choice.options).toEqual(["1/3", "1/2", "1/4"]);
    expect(choice.answer).toBe(1);
  });

  test("a half-filled multiple-choice question is refused with a clear message", async ({ page }) => {
    test.setTimeout(240_000);
    await openNewLesson(page);
    await page.getByTestId("hub-note-topic-subjects").getByRole("button", { name: subj }).click();
    await page.getByTestId("hub-note-topic-list").getByRole("option", { name: topicA }).click();
    await page.locator("#hub-note-title").fill(`${lessonTitle} bad`);
    await page.getByTestId("sb-title").fill("Broken");
    await page.getByTestId("sb-add-block").click();
    await page.getByTestId("sb-add-choice").click();
    await page.getByTestId("sb-choice-q").fill("Only a question, no answers");
    await page.getByRole("button", { name: "Save lesson" }).click();
    await expect(page.getByText(/needs at least two answers/)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#hub-note-title")).toBeVisible(); // still editing
  });

  test("delete a subject: an empty one goes, one with a lesson is refused", async ({ page }) => {
    test.setTimeout(240_000);
    await openNewLesson(page);
    const chips = page.getByTestId("hub-note-topic-subjects");
    // subject with a lesson in it (the one saved above) → refused
    await chips.getByRole("button", { name: subj }).click();
    await page.getByTestId("hub-note-topic-delete-subject").click();
    await page.getByTestId("hub-note-topic-delete-confirm").click();
    await expect(page.getByTestId("hub-note-topic-delete-err")).toContainText(/still has content/i, { timeout: 15_000 });
    expect((await listTopics()).some((t) => t.subject === subj)).toBe(true);
    // the empty subject → deleted
    await chips.getByRole("button", { name: emptySubj }).click();
    await page.getByTestId("hub-note-topic-delete-subject").click();
    await page.getByTestId("hub-note-topic-delete-confirm").click();
    await expect(chips.getByRole("button", { name: emptySubj })).toHaveCount(0, { timeout: 15_000 });
    expect((await listTopics()).some((t) => t.subject === emptySubj)).toBe(false);
  });
});
