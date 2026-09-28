import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { seedOakLesson, type SeededLesson } from "./helpers/lessonFixture";
import { cardWith } from "./helpers/ui";

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
const subject = `Preview Lab ${stamp}`;
const childName = `Previewkid ${stamp}`;
const hwTitle = (t: string) => `Homework: ${t}`;
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let accounts: AccountManifest["accounts"];
let childId = "";
let tenantId = "";
let topicId = "";
let L: SeededLesson;

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
const setHub = (op: TestAccount, on: boolean) => retry(async () => {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
});
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
import { openTab } from "./helpers/hubTabs";

const envApi = (() => {
  try {
    const m = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/^NEXT_PUBLIC_API_URL=(.*)$/m);
    return m?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  } catch { return ""; }
})();
async function ctxFor(browser: Browser, role: "freelancer") {
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
  await provisionLiveListing(accounts.freelancer, { title: `E2E Preview Tutoring ${stamp}`, price: 0 }); // the parent can only follow a provider that publishes
  childId = await createParentChild(accounts.parent, { name: childName });
  await retry(async () => apiPost("/api/my/providers/follow", await token(accounts.parent), { tenantId })).catch(() => undefined);
  await markParentWelcomed(accounts.parent);
  await apiPost("/api/learning-hub/topics", t, { subject, topic: "Assigning" });
  await apiPost("/api/learning-hub/students", t, { childId, subjects: [subject] });
  const topics = await apiFetch<{ id: string; subject: string }[]>("/api/learning-hub/topics", t);
  topicId = topics.find((x) => x.subject === subject)!.id;
  await setHub(accounts.freelancer, true);
  L = await seedOakLesson(t, { stamp, subject, topicId, widget: null });
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); });

async function gotoHub(page: Page, url: string) {
  const heading = page.getByRole("heading", { name: /Teaching Hub|Learning Hub|My Classroom/ });
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto(url);
    if (await heading.first().isVisible({ timeout: 25_000 }).catch(() => false)) return;
  }
  await expect(heading.first()).toBeVisible({ timeout: 30_000 });
}
/** The dev API restarts (tsx watch) whenever a server file is saved: retry a dropped connection instead of failing the test. */
async function retry<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) { if (i >= 16 || !/fetch failed|ECONNRESET|socket|other side closed/i.test(String(e))) throw e; await new Promise((r) => setTimeout(r, 5_000)); }
  }
}
interface HwRow { id: string; title: string }
const tutorHomework = (title: string) => retry(async () => (await apiFetch<HwRow[]>("/api/learning-hub/homework", await token(accounts.freelancer))).find((h) => h.title === title));

/** Give a lesson note an Oak-style worksheet (PDF in Storage + note pointers), then PUT the note unchanged so the API's list index picks it up. */
async function seedWorksheet(noteId: string, quizId?: string) {
  execFileSync("npx", ["tsx", path.join(ROOT, "e2e/helpers/seedWorksheet.ts"), tenantId, noteId, ...(quizId ? [quizId] : [])], { cwd: path.join(ROOT, "server"), stdio: "pipe" });
  const t = await token(accounts.freelancer);
  const n = await apiFetch<{ topicId: string; title: string; body: string; published: boolean }>(`/api/learning-hub/notes/${noteId}`, t);
  await apiFetch(`/api/learning-hub/notes/${noteId}`, t, { method: "PUT", body: JSON.stringify({ topicId: n.topicId, title: n.title, body: n.body ?? "", published: true }) });
}

test("Set homework is bare; a worksheet is picked, previewed (PDF + interactive quiz) and survives the preview closing; list + parent see it", async ({ browser }) => {
  test.setTimeout(300_000);
  await seedWorksheet(L.noteId, L.quizId);
  const ctx = await ctxFor(browser, "freelancer");
  const page = await ctx.newPage();
  await gotoHub(page, "/freelancer/learninghub");
  await openTab(page, /^Homework/);
  await expect(page.locator("#hub-new-homework").first()).toBeVisible({ timeout: 30_000 });
  await page.locator("#hub-new-homework").first().click();
  const dlg = page.locator("#hub-homework-form");
  await expect(dlg).toBeVisible({ timeout: 30_000 });
  // Bare: no quiz / lesson / flashcard pickers, no "base it on a lesson".
  for (const gone of ["#hub-hw-quiz", "#hub-hw-note-search", "#hub-hw-flash"]) await expect(dlg.locator(gone)).toHaveCount(0);
  await expect(dlg.getByLabel("Base it on a lesson")).toHaveCount(0);
  const mine = `Worksheet hw ${stamp}`;
  await dlg.getByLabel("Title").fill(mine);

  // Worksheet picker: this run's lesson, badge says Interactive.
  await dlg.getByLabel("Search worksheets").fill(L.title);
  const row = dlg.getByTestId("hub-hw-worksheets").locator("[data-ui=card]", { hasText: L.title });
  await expect(row).toHaveCount(1, { timeout: 30_000 });
  await expect(row).toContainText("Interactive");
  await row.locator("[data-pick]").click();
  await expect(dlg.getByTestId("hub-hw-attached-worksheets")).toContainText(L.title);

  // Preview before/after choosing: the PDF is embedded, the interactive quiz opens on top; Esc closes only the top layer.
  await row.getByTestId("hub-hw-ws-preview-btn").click();
  const wp = page.locator("#hub-hw-worksheet-preview");
  await expect(wp).toBeVisible({ timeout: 30_000 });
  await expect(wp.locator("object[type='application/pdf']")).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: "test-results/hw-worksheet-preview.png" });
  await wp.getByTestId("hub-hw-ws-quiz-btn").click();
  const qp = page.locator("#hub-hw-quiz-preview");
  await expect(qp).toBeVisible({ timeout: 30_000 });
  await expect(qp).toContainText(L.quiz[0]!.prompt.slice(0, 30), { timeout: 30_000 });
  await expect(qp).toContainText(/marks in total/);
  await expect(qp.locator("li[data-ui=card]")).toHaveCount(L.quiz.length);
  await page.screenshot({ path: "test-results/hw-quiz-preview.png" });
  await page.keyboard.press("Escape");
  await expect(qp).toHaveCount(0);
  await expect(wp).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(wp).toHaveCount(0);
  await expect(dlg).toBeVisible();
  await expect(dlg.getByLabel("Title")).toHaveValue(mine);
  await expect(row.locator("[data-pick]")).toHaveAttribute("aria-pressed", "true");

  const kid = dlg.getByRole("button", { name: childName, exact: true });
  if ((await kid.getAttribute("aria-pressed")) !== "true") await kid.click();
  const saved = page.waitForResponse((r) => r.url().includes("/api/learning-hub/homework") && r.request().method() === "POST");
  await dlg.getByRole("button", { name: "Assign homework" }).click();
  const resp = await saved;
  expect(resp.status()).toBe(201);
  const hw = await tutorHomework(mine);
  expect(hw).toBeTruthy();

  // Tutor list: the worksheet row + View worksheet.
  await openTab(page, /Set homework/);
  const card = cardWith(page, mine, "Hand-ins");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText(`Worksheet: ${L.title}`);
  await card.getByTestId("hub-hw-view-worksheet").click();
  await expect(page.locator("#hub-hw-worksheet-preview object")).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Escape");
  await ctx.close();
  // The family's row carries the worksheet (interactive: its quiz id) so the child can do it in the quiz player.
  const fam = await retry(async () => (await apiFetch<{ title: string; worksheets?: { noteId: string; quizId?: string }[] }[]>(`/api/learning-hub/homework?tenantId=${tenantId}&childId=${childId}`, await token(accounts.parent))).find((h) => h.title === mine));
  expect(fam?.worksheets?.[0]).toMatchObject({ noteId: L.noteId, quizId: L.quizId });
});
