import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed } from "./helpers/tenantData";
import { seedOakLesson, type SeededLesson } from "./helpers/lessonFixture";
import { cardWith, dismissParentWelcome } from "./helpers/ui";

// Learning Hub — "Set for children": a tutor sets a LESSON (Lessons tab) as homework.
//  • reader header button → Homework form opens with the lesson attached, its exit quiz chosen, a starting title/instructions →
//    tutor picks THIS run's child + a due date → the homework exists server-side with noteIds + assessmentId;
//  • the parent sees it as set work; the assigned lesson opens the INTERACTIVE PLAYER ("Start the lesson"), and leaving returns to Homework;
//  • a plain (non-interactive) lesson is assignable from the list card's action, here to a whole GROUP;
//  • no students enrolled: the form says how to add some and Assign stays disabled.
//  • READY-MADE homework: the form opens prefilled from GET /notes/:id/homework-pack ("Homework: <lesson>", instructions built from the
//    lesson's own key ideas + its quiz, the exit quiz attached, default due date); the Homework tab's blank form has a "Base it on a
//    lesson…" search that fills the same fields, and a "Set for all my Year N students" shortcut ticks the whole year.
// Every state assertion is anchored to THIS run's lesson / homework titles.

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const subject = `Assign Lab ${stamp}`;
const childName = `Assignkid ${stamp}`;
const plainTitle = `Plain assign note ${stamp}`;
const groupName = `Assign group ${stamp}`;
const hwTitle = (t: string) => `Homework: ${t}`;
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let accounts: AccountManifest["accounts"];
let childId = "";
let tenantId = "";
let topicId = "";
let L: SeededLesson;
let plainId = "";
let groupId = "";

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
const setHub = (op: TestAccount, on: boolean) => retry(async () => {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
});
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
import { tabOf, openTab } from "./helpers/hubTabs";

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
  test.setTimeout(300_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  await setHub(accounts.freelancer, true);
  const t = await token(accounts.freelancer);
  childId = await createParentChild(accounts.parent, { name: childName });
  await apiPost("/api/my/providers/follow", await token(accounts.parent), { tenantId });
  await markParentWelcomed(accounts.parent);
  await apiPost("/api/learning-hub/topics", t, { subject, topic: "Assigning" });
  await apiPost("/api/learning-hub/students", t, { childId, subjects: [subject] });
  const topics = await apiFetch<{ id: string; subject: string }[]>("/api/learning-hub/topics", t);
  topicId = topics.find((x) => x.subject === subject)!.id;
  await setHub(accounts.freelancer, true);
  L = await seedOakLesson(t, { stamp, subject, topicId, widget: null });
  plainId = (await apiPost<{ id: string }>("/api/learning-hub/notes", t, { topicId, title: plainTitle, body: `Plain body ${stamp}`, published: true })).id;
  groupId = (await apiPost<{ id: string }>("/api/learning-hub/groups", t, { name: groupName, childIds: [childId] })).id;
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
async function openTutorLessons(page: Page) {
  await gotoHub(page, "/freelancer/learninghub");
  await openTab(page, /^Lessons/);
  await expect(page.locator("#hub-notes")).toBeVisible({ timeout: 20_000 });
}
async function openParentHub(page: Page, tab: RegExp) {
  await dismissParentWelcome(page);
  await gotoHub(page, "/custdash/learninghub");
  const provider = page.getByLabel("Provider");
  if (await provider.isVisible().catch(() => false)) await provider.selectOption(tenantId);
  const select = page.getByRole("combobox", { name: "Child" });
  const pill = page.getByRole("radio", { name: childName });
  if (await select.isVisible().catch(() => false)) await select.selectOption({ label: childName });
  else if (await pill.isVisible({ timeout: 8_000 }).catch(() => false)) await pill.click();
  await openTab(page, tab);
}
async function searchLesson(page: Page, title: string) {
  await page.getByLabel("Search lessons").fill(title);
  const card = cardWith(page, title);
  await expect(card).toBeVisible({ timeout: 20_000 });
  return card;
}

/** The dev API restarts (tsx watch) whenever a server file is saved: retry a dropped connection instead of failing the test. */
async function retry<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) { if (i >= 16 || !/fetch failed|ECONNRESET|socket|other side closed/i.test(String(e))) throw e; await new Promise((r) => setTimeout(r, 5_000)); }
  }
}
interface HwRow { id: string; title: string; noteIds: string[]; assessmentId: string | null; assignedChildIds: string[]; groupIds?: string[]; dueAt: string }
const tutorHomework = (title: string) => retry(async () => (await apiFetch<HwRow[]>("/api/learning-hub/homework", await token(accounts.freelancer))).find((h) => h.title === title));
interface FamRow { id: string; title: string; assessmentId: string | null; notes: { id: string; title: string; interactive?: boolean }[] }
const familyHomework = (title: string) => retry(async () =>
  (await apiFetch<FamRow[]>(`/api/learning-hub/homework?tenantId=${tenantId}&childId=${childId}`, await token(accounts.parent))).find((h) => h.title === title));

test.describe("set a lesson for children", () => {
  test("tutor: reader → Set for children → picks this run's child → homework exists with the lesson + its quiz", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await openTutorLessons(page);
    const card = await searchLesson(page, L.title);
    await card.getByRole("button", { name: L.title, exact: true }).click();
    // The reader header carries the action.
    await expect(page.getByTestId("lesson-tutor-panel")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("lesson-set-for-children")).toHaveCount(1); // one clear button, not two
    await page.getByTestId("lesson-set-for-children").click();

    const dlg = page.locator("#hub-homework-form");
    await expect(dlg).toBeVisible({ timeout: 30_000 });
    await expect(dlg.getByLabel("Title")).toHaveValue(hwTitle(L.title), { timeout: 20_000 }); // the ready-made title, not a blank form
    const ins = dlg.getByLabel("Instructions");
    await expect(ins).toHaveValue(new RegExp(esc(L.title)));
    await expect(ins).toHaveValue(new RegExp(esc(L.quizTitle))); // "Do the lesson quiz “…”"
    await expect(ins).toHaveValue(new RegExp(esc(L.points[0].replace(/\s+/g, " ").slice(0, 40)))); // the lesson's own key idea
    await expect(ins).toHaveValue(new RegExp(esc(L.outcome.slice(0, 40))));
    await expect(dlg.getByTestId("hub-hw-attached-lessons")).toContainText(L.title);
    await expect(dlg.getByTestId("hub-hw-attached-lessons")).toContainText("interactive");
    await expect(dlg.locator("#hub-hw-quiz")).toHaveValue(L.quizId, { timeout: 20_000 }); // the lesson's exit quiz, preselected

    // A tenant with exactly one student has them preselected (redesign: one less tap), so only tap when not yet chosen.
    const kidBtn = dlg.getByRole("button", { name: childName, exact: true });
    if ((await kidBtn.getAttribute("aria-pressed")) !== "true") await kidBtn.click();
    await expect(kidBtn).toHaveAttribute("aria-pressed", "true");
    const due = new Date(Date.now() + 3 * 86_400_000);
    const dueStr = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
    await dlg.locator("#hub-hw-due").fill(dueStr);
    const saved = page.waitForResponse((r) => r.url().includes("/api/learning-hub/homework") && r.request().method() === "POST");
    await dlg.getByRole("button", { name: "Assign homework" }).click();
    expect((await saved).status()).toBe(201);
    await expect(dlg).toHaveCount(0);

    // Server-side truth: the lesson AND its exit quiz are on the homework, for this child, due in ~3 days.
    const hw = await tutorHomework(hwTitle(L.title));
    expect(hw, "homework row for this run's lesson").toBeTruthy();
    expect(hw!.noteIds).toEqual([L.noteId]);
    expect(hw!.assessmentId).toBe(L.quizId);
    expect(hw!.assignedChildIds).toEqual([childId]);
    expect(Date.parse(hw!.dueAt)).toBeGreaterThan(Date.now() + 2 * 86_400_000);
    // …and it lands on the Homework tab (Set homework) for the tutor.
    await expect(page.getByRole("tab", { name: /Set homework/ })).toBeVisible({ timeout: 20_000 });
    await openTab(page, /Set homework/);
    await expect(cardWith(page, hwTitle(L.title), "Hand-ins (0/1)")).toBeVisible({ timeout: 30_000 });
    await ctx.close();
  });

  test("parent: sees it as set work and 'Start the lesson' opens the interactive player (Back returns to Homework)", async ({ browser }) => {
    test.setTimeout(240_000);
    const fam = await familyHomework(hwTitle(L.title));
    expect(fam, "the family payload has this run's homework").toBeTruthy();
    expect(fam!.assessmentId).toBe(L.quizId);
    expect(fam!.notes).toEqual([{ id: L.noteId, title: L.title, interactive: true }]);

    const ctx = await ctxFor(browser, "parent");
    const page = await ctx.newPage();
    await openParentHub(page, /Homework/);
    const row = cardWith(page, hwTitle(L.title));
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText(/Due/);
    await row.click();
    const detail = page.locator("#hub-homework-detail");
    await expect(detail).toBeVisible();
    await expect(detail.getByText("Lessons to do first")).toBeVisible();
    await expect(detail.getByTestId("hub-hw-quiz")).toBeVisible(); // the exit quiz rides along
    await detail.getByTestId("hub-hw-start-lesson").click();
    // The Lessons tab opens straight into the interactive lesson player for THIS lesson.
    const player = page.getByTestId("lesson-player");
    await expect(player).toBeVisible({ timeout: 30_000 });
    await expect(player).toContainText(L.title);
    await player.getByRole("button", { name: "Leave this lesson" }).click();
    await expect(page.locator("#hub-tabpanel-homework")).toBeVisible({ timeout: 20_000 });
    // Leaving the lesson goes Back to the very homework it was started from (its detail), not just the list.
    await expect(page.locator("#hub-homework-detail")).toContainText(L.title, { timeout: 20_000 });
    await ctx.close();
  });

  test("a plain (non-interactive) lesson can be set for a whole group from the lesson reader", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await openTutorLessons(page);
    const card = await searchLesson(page, plainTitle);
    await card.getByRole("button", { name: plainTitle, exact: true }).click(); // the list icon is gone: one form, opened from the reader
    await page.getByTestId("lesson-set-for-children").click();
    const dlg = page.locator("#hub-homework-form");
    await expect(dlg).toBeVisible({ timeout: 30_000 });
    await expect(dlg.getByLabel("Title")).toHaveValue(hwTitle(plainTitle), { timeout: 20_000 });
    await expect(dlg.getByLabel("Instructions")).toHaveValue(new RegExp(`Read the lesson .${esc(plainTitle)}`));
    await expect(dlg.getByTestId("hub-hw-attached-lessons")).toContainText(plainTitle);
    await expect(dlg.getByTestId("hub-hw-attached-lessons")).not.toContainText("interactive");
    await expect(dlg.locator("#hub-hw-quiz")).toHaveValue(""); // a plain lesson has no exit quiz
    await dlg.locator("[data-group-pick]", { hasText: groupName }).click(); // a whole group
    await expect(dlg.getByRole("button", { name: childName, exact: true })).toHaveAttribute("aria-pressed", "true");
    const saved = page.waitForResponse((r) => r.url().includes("/api/learning-hub/homework") && r.request().method() === "POST");
    await dlg.getByRole("button", { name: "Assign homework" }).click();
    expect((await saved).status()).toBe(201);

    const hw = await tutorHomework(hwTitle(plainTitle));
    expect(hw, "homework row for the plain lesson").toBeTruthy();
    expect(hw!.noteIds).toEqual([plainId]);
    expect(hw!.assessmentId).toBeNull();
    expect(hw!.groupIds).toEqual([groupId]);
    expect(hw!.assignedChildIds).toEqual([childId]);
    await ctx.close();

    // The family sees it, with the lesson to READ (no interactive player button).
    const fam = await familyHomework(hwTitle(plainTitle));
    expect(fam!.notes).toEqual([{ id: plainId, title: plainTitle, interactive: false }]);
    const pctx = await ctxFor(browser, "parent");
    const ppage = await pctx.newPage();
    await openParentHub(ppage, /Homework/);
    await cardWith(ppage, hwTitle(plainTitle)).click();
    const detail = ppage.locator("#hub-homework-detail");
    await expect(detail.getByText("Lessons to read first")).toBeVisible({ timeout: 20_000 });
    await expect(detail.getByTestId("hub-hw-start-lesson")).toHaveCount(0);
    await detail.getByRole("button", { name: plainTitle }).click();
    await expect(detail.getByText(`Plain body ${stamp}`)).toBeVisible({ timeout: 20_000 });
    await pctx.close();
  });

  test("the pack API is a pure suggestion built from the lesson's own data, tutors only", async () => {
    test.setTimeout(120_000);
    const t = await token(accounts.freelancer);
    const pack = await retry(() => apiFetch<{ title: string; instructions: string; noteIds: string[]; assessmentId: string | null; quiz: { id: string; title: string; published: boolean } | null; dueInDays: number; dueAt: string; flashcardCount: number; interactive: boolean; year: string | null; basis: { keyIdeas: number; quiz: boolean } }>(`/api/learning-hub/notes/${L.noteId}/homework-pack`, t));
    expect(pack.title).toBe(hwTitle(L.title));
    expect(pack.noteIds).toEqual([L.noteId]);
    expect(pack.assessmentId).toBe(L.quizId);
    expect(pack.quiz?.title).toBe(L.quizTitle);
    expect(pack.interactive).toBe(true);
    expect(pack.basis.keyIdeas).toBeGreaterThan(0);
    expect(pack.instructions).toContain(L.quizTitle);
    expect(pack.dueInDays).toBeGreaterThanOrEqual(1);
    expect(Date.parse(pack.dueAt)).toBeGreaterThan(Date.now() + 86_400_000 - 60_000);
    // Nothing was stored by asking: no homework row exists for this lesson yet under a stray title.
    const plain = await apiFetch<{ title: string; assessmentId: string | null; interactive: boolean }>(`/api/learning-hub/notes/${plainId}/homework-pack`, t);
    expect(plain).toMatchObject({ title: hwTitle(plainTitle), assessmentId: null, interactive: false });
    // A parent can't ask for it.
    const pt = await token(accounts.parent);
    const r = await fetch(`${API_URL}/api/learning-hub/notes/${L.noteId}/homework-pack?tenantId=${tenantId}`, { headers: { Authorization: `Bearer ${pt}` } });
    expect(r.status).toBe(403);
  });

  test("Homework tab: 'Set homework' → Base it on a lesson fills the form, then one click sets it for the whole year", async ({ browser }) => {
    test.setTimeout(240_000);
    const t = await token(accounts.freelancer);
    const pack = await retry(() => apiFetch<{ year: string | null }>(`/api/learning-hub/notes/${L.noteId}/homework-pack`, t));
    expect(pack.year, "the fixture lesson carries its year").toBeTruthy();
    // Put this run's child in that year (tutor-tagged, so it does not depend on a date of birth).
    await retry(() => apiPost("/api/learning-hub/students", t, { childId, subjects: [subject], yearGroup: `Year ${pack.year}` }));
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await gotoHub(page, "/freelancer/learninghub");
    await openTab(page, /^Homework/);
    await expect(page.locator("#hub-new-homework")).toBeVisible({ timeout: 30_000 });
    await page.locator("#hub-new-homework").click();
    const dlg = page.locator("#hub-homework-form");
    await expect(dlg).toBeVisible({ timeout: 30_000 });
    await expect(dlg.getByLabel("Title")).toHaveValue(""); // a blank form until a lesson is picked
    await expect(dlg.getByTestId("hub-hw-year-all")).toHaveCount(0);
    await dlg.getByLabel("Base it on a lesson").fill(L.title);
    const reached = page.waitForResponse((r) => r.url().includes("/api/learning-hub/homework/reach")); // who can open the quiz — the year shortcut skips those who can't
    await dlg.getByRole("listbox", { name: "Lessons" }).getByRole("option", { name: L.title, exact: true }).click();
    await expect(dlg.getByLabel("Title")).toHaveValue(hwTitle(L.title), { timeout: 20_000 });
    await expect(dlg.getByLabel("Instructions")).toHaveValue(new RegExp(esc(L.quizTitle)));
    await expect(dlg.locator("#hub-hw-quiz")).toHaveValue(L.quizId, { timeout: 20_000 });
    await expect(dlg.getByTestId("hub-hw-attached-lessons")).toContainText(L.title);
    await reached;
    // Everything stays editable: give it this run's own title.
    const mine = `${hwTitle(L.title)} — whole year ${stamp}`;
    await dlg.getByLabel("Title").fill(mine);
    // A lone student is preselected (redesign), which hides the year shortcut: untick them first so the shortcut has work to do.
    const kid = dlg.getByRole("button", { name: childName, exact: true });
    if ((await kid.getAttribute("aria-pressed")) === "true") await kid.click();
    // One click ticks every student of that year.
    const yearBtn = dlg.getByTestId("hub-hw-year-all");
    await expect(yearBtn).toContainText(`Year ${pack.year}`);
    await yearBtn.click();
    await expect(dlg.getByRole("button", { name: childName, exact: true })).toHaveAttribute("aria-pressed", "true");
    const saved = page.waitForResponse((r) => r.url().includes("/api/learning-hub/homework") && r.request().method() === "POST");
    await dlg.getByRole("button", { name: "Assign homework" }).click();
    expect((await saved).status()).toBe(201);
    const hw = await tutorHomework(mine);
    expect(hw, "homework row").toBeTruthy();
    expect(hw!.assessmentId).toBe(L.quizId);
    expect(hw!.noteIds).toEqual([L.noteId]);
    expect(hw!.assignedChildIds).toContain(childId);
    await openTab(page, /Set homework/); // the assignments list (the default view is the inbox)
    await expect(cardWith(page, mine, "Hand-ins")).toBeVisible({ timeout: 30_000 });
    await ctx.close();
    // The family side is unchanged: same payload, same quiz + lesson.
    const fam = await familyHomework(mine);
    expect(fam!.assessmentId).toBe(L.quizId);
    expect(fam!.notes[0]?.id).toBe(L.noteId);
  });

  test("no students enrolled: the form tells the tutor how to add some and Assign stays off", async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    // Pretend the roster is empty (the standing account itself has students from other specs).
    await page.route((u) => u.pathname.endsWith("/api/learning-hub/students"), async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await openTutorLessons(page);
    const card = await searchLesson(page, L.title);
    // H-01: the list icon is gone; the one form opens from the lesson reader.
    await card.getByRole("button", { name: L.title, exact: true }).click();
    await page.getByTestId("lesson-set-for-children").click();
    const dlg = page.locator("#hub-homework-form");
    await expect(dlg).toBeVisible({ timeout: 30_000 });
    await expect(dlg.getByTestId("hub-hw-no-students")).toContainText(/haven.t added any students yet/);
    await expect(dlg.getByTestId("hub-hw-no-students").getByRole("button", { name: "Go to Students" })).toBeVisible();
    await expect(dlg.getByRole("button", { name: "Assign homework" })).toBeDisabled();
    await dlg.getByTestId("hub-hw-no-students").getByRole("button", { name: "Go to Students" }).click();
    await expect(dlg).toHaveCount(0);
    await expect(page.locator("[role=tab][aria-selected=true]")).toContainText(/Students/);
    await ctx.close();
  });

  test("the Live lessons workspace and its dialogs say lessons, not notes", async ({ browser }) => {
    test.setTimeout(240_000);
    const t = await token(accounts.freelancer);
    const title = `Wording live ${stamp}`;
    await retry(() => apiPost("/api/learning-hub/lessons", t, { title, topicId, startsAt: new Date(Date.now() + 4 * 60_000).toISOString(), durationMins: 30, childIds: [childId], notes: `Bring a pencil ${stamp}` }));
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await gotoHub(page, "/freelancer/learninghub");
    await openTab(page, /Live lessons/);
    const row = cardWith(page, title);
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.locator('[data-action="add-notes"]').click();
    const dlg = page.locator("#hub-lesson-notes-dialog");
    await expect(dlg).toBeVisible({ timeout: 20_000 });
    await expect(dlg).toContainText(/Message, lessons & videos/);
    await expect(dlg).toContainText(/Lessons attached to this live lesson/);
    await expect(dlg.locator("#ws-attach-notes")).toContainText(/Attach lessons/);
    await expect(dlg.locator("#ws-new-note")).toContainText(/New lesson/);
    expect(await dlg.innerText()).not.toMatch(/\bnotes?\b/i);
    await ctx.close();
  });
});
