import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { cardWith, dismissParentWelcome } from "./helpers/ui";
import { seedOakLesson } from "./helpers/lessonFixture";

// Learning Hub — the teaching panels' UI (Live lessons, Homework, Flashcards):
// tutor sets homework in the UI → the family hands it in → the tutor marks →
// the family sees the mark; the family reviews flashcards (server SM-2 schedules
// them); the lesson list renders and Join is disabled until the join window.
//
// Video: headless automation can't prove a real media call, so the join test only
// checks that the room opens and the join request is made — the frame mounting
// (or a friendly "video isn't available" state) is asserted, not the media.

// Fake camera + mic so a real Daily call can connect headlessly (the interactive-lessons-in-the-call test needs two connected peers).
test.use({ launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });
test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const subject = `Teach ${stamp}`;
const childName = `UIkid ${stamp}`;
const hwTitle = `Fractions HW ${stamp}`;
const lessonTitle = `Fractions lesson ${stamp}`;
const soonTitle = `Starting soon ${stamp}`;
const soonNote = `Bring a pencil ${stamp}`;
const rejoinTitle = `Rejoin me ${stamp}`;
const FEEDBACK = `Great working ${stamp}`;
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

let accounts: AccountManifest["accounts"];
let childId = "";
let topicId = "";

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
const tabOf = (page: Page, name: RegExp) => page.getByRole("tab", { name });
/** A dialog / sheet must be a LIGHT surface (perceived luminance well above mid-grey), not the app's dark :root fallback. */
async function expectLight(el: import("@playwright/test").Locator) {
  const lum = await el.evaluate((n) => {
    // color-mix() surfaces compute to `color(srgb 0.99 0.98 0.95)` (0–1 channels); plain colours to `rgb(r, g, b)` (0–255).
    const bg = getComputedStyle(n).backgroundColor;
    const k = bg.startsWith("color(") ? 255 : 1;
    const m = (bg.replace(/\/.*$/, "").match(/-?[\d.]+/g) ?? ["0", "0", "0"]).map((x) => Number(x) * k);
    return 0.299 * m[0]! + 0.587 * m[1]! + 0.114 * m[2]!;
  });
  expect(lum).toBeGreaterThan(200);
}

// If .env.local points the web app at a tunnel that isn't up, send its API calls
// to the local API instead (the page is otherwise dead in this environment).
const envApi = (() => {
  try {
    const m = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/^NEXT_PUBLIC_API_URL=(.*)$/m);
    return m?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  } catch { return ""; }
})();
/** A fresh browser context for a role, with the API rewrite above when needed. */
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
  test.setTimeout(240_000);
  accounts = loadAccounts().accounts;
  await setHub(accounts.freelancer, true);
  const t = await token(accounts.freelancer);
  const listing = await provisionLiveListing(accounts.freelancer, { title: `E2E Teaching ${stamp}`, price: 0 });
  childId = await createParentChild(accounts.parent, { name: childName });
  // The family reaches a provider by following it (a booking would clash with the standing parent's other sessions).
  await apiPost("/api/my/providers/follow", await token(accounts.parent), { tenantId: accounts.freelancer.tenantId });
  await markParentWelcomed(accounts.parent);
  await apiPost("/api/learning-hub/topics", t, { subject, topic: "Fractions" });
  // Enrolled for THIS subject only, so the flashcard queue is exactly our four cards.
  await apiPost("/api/learning-hub/students", t, { childId, subjects: [subject] });
  const topics = await apiFetch<{ id: string; subject: string }[]>("/api/learning-hub/topics", t);
  topicId = topics.find((x) => x.subject === subject)!.id;
  await apiPost("/api/learning-hub/notes", t, { topicId, title: `Fractions note ${stamp}`, body: "## Fractions\n\nAdd the tops when the bottoms match.", published: true, attachments: [] });
  for (const [front, back] of [["1/2 + 1/2", "1"], ["3/4 − 1/4", "1/2"], ["Simplify 4/8", "1/2"], ["1/3 of 12", "4"]]) {
    await apiPost("/api/learning-hub/flashcards", t, { topicId, front: `${front} (${stamp})`, back, published: true });
  }
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); }); // other specs toggle the hub on this account
test.afterAll(async () => { /* leave the hub on: the standing account is shared with the other hub specs */ });

/** Open a hub URL; other specs flip this shared account's hub switch off, so re-assert it and retry once. */
async function gotoHub(page: Page, url: string) {
  const heading = page.getByRole("heading", { name: /Teaching Hub|My Classroom/ });
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto(url);
    if (await heading.first().isVisible({ timeout: 25_000 }).catch(() => false)) return;
  }
  await expect(heading.first()).toBeVisible({ timeout: 30_000 });
}

/** The family view of the hub with OUR child chosen. */
async function openParentHub(page: Page, tab: RegExp) {
  await dismissParentWelcome(page);
  await gotoHub(page, "/custdash/learninghub");
  const provider = page.getByLabel("Provider");
  if (await provider.isVisible().catch(() => false)) await provider.selectOption(accounts.freelancer.tenantId!);
  // The child picker is a pill row (radiogroup) for up to three children, a select beyond that.
  const select = page.getByRole("combobox", { name: "Child" });
  const pill = page.getByRole("radio", { name: childName });
  if (await select.isVisible().catch(() => false)) await select.selectOption({ label: childName });
  else if (await pill.isVisible({ timeout: 8_000 }).catch(() => false)) await pill.click();
  await expect(tabOf(page, tab)).toBeVisible({ timeout: 30_000 });
  await tabOf(page, tab).click();
}
async function openTutorHub(page: Page, tab: RegExp) {
  await gotoHub(page, "/freelancer/learninghub");
  await expect(tabOf(page, tab)).toBeVisible({ timeout: 30_000 });
  await tabOf(page, tab).click();
}

test.describe("homework: set → hand in → mark → see the mark", () => {
  test("the tutor sets homework in the UI", async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await openTutorHub(page, /Homework/);
    await page.locator("#hub-new-homework").first().click();
    const dlg = page.locator("#hub-homework-form");
    await expect(dlg).toBeVisible();
    await dlg.getByLabel("Title").fill(hwTitle);
    await dlg.getByLabel("Instructions").fill("Add the fractions and show your working.");
    await dlg.getByRole("button", { name: childName, exact: true }).click();
    await expect(dlg.getByRole("button", { name: childName, exact: true })).toHaveAttribute("aria-pressed", "true");
    const saved = page.waitForResponse((r) => r.url().includes("/api/learning-hub/homework") && r.request().method() === "POST");
    await dlg.getByRole("button", { name: "Assign homework" }).click();
    expect((await saved).status()).toBe(201);
    await expect(dlg).toHaveCount(0);
    await page.getByRole("tab", { name: /Set homework/ }).click();
    await expect(cardWith(page, hwTitle, "Hand-ins (0/1)")).toBeVisible({ timeout: 30_000 });
    await ctx.close();
  });

  test("the family sees it due and hands it in (text + a PDF)", async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await ctxFor(browser, "parent");
    const page = await ctx.newPage();
    await openParentHub(page, /Homework/);
    const card = cardWith(page, hwTitle);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toContainText(/Due/);
    await card.click();
    await expect(page.locator("#hub-homework-detail")).toBeVisible();
    await expect(page.getByText("Add the fractions and show your working.")).toBeVisible();
    await page.locator("#hub-hw-text").fill(`1/2 + 1/2 = 1 (${stamp})`);
    await page.locator("#hub-hw-files").setInputFiles({ name: "workings.pdf", mimeType: "application/pdf", buffer: PDF });
    await expect(page.getByText("workings.pdf")).toBeVisible({ timeout: 20_000 });
    await page.locator("#hub-hw-submit").click();
    await expect(page.getByText("Handed in!")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#hub-homework-detail")).toHaveAttribute("data-status", "submitted");
    await page.getByRole("button", { name: /All homework/ }).click();
    await expect(cardWith(page, hwTitle, "Awaiting marking")).toBeVisible({ timeout: 20_000 });
    await ctx.close();
  });

  test("the tutor sees the hand-in in the inbox and marks it 8/10", async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await openTutorHub(page, /Homework/);
    await page.locator('[data-filter="submitted"]').click();
    const row = cardWith(page, hwTitle, childName);
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toHaveAttribute("data-status", "submitted");
    await row.click();
    const dlg = page.locator("#hub-mark-dialog");
    await expect(dlg).toBeVisible();
    await expectLight(dlg); // dialogs are portalled into the themed hub root: light warm, never the app's dark fallback
    await expect(dlg.getByText(`1/2 + 1/2 = 1 (${stamp})`)).toBeVisible();
    await expect(dlg.getByRole("link", { name: /workings\.pdf/ })).toHaveAttribute("href", /\/api\/images\/.+sig=/);
    await dlg.getByLabel("Score").fill("8");
    await dlg.getByLabel("Out of").fill("10");
    await dlg.getByLabel("Feedback").fill(FEEDBACK);
    const marked = page.waitForResponse((r) => r.url().includes("/mark") && r.request().method() === "PUT");
    await dlg.getByRole("button", { name: "Save mark" }).click();
    expect((await marked).ok()).toBe(true);
    await expect(dlg).toHaveCount(0);
    await page.locator('[data-filter="marked"]').click();
    const done = cardWith(page, hwTitle, childName);
    await expect(done).toHaveAttribute("data-status", "marked", { timeout: 20_000 });
    await expect(done).toContainText("8/10");
    await ctx.close();
  });

  test("the family sees Marked: 8/10 with the feedback", async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await ctxFor(browser, "parent");
    const page = await ctx.newPage();
    await openParentHub(page, /Homework/);
    const card = cardWith(page, hwTitle);
    await expect(card).toHaveAttribute("data-status", "marked", { timeout: 30_000 });
    await expect(card).toContainText("8/10");
    await card.click();
    const mark = page.getByTestId("hub-mark");
    await expect(mark).toContainText("8");
    await expect(mark).toContainText("80%");
    await expect(mark).toContainText(FEEDBACK);
    await ctx.close();
  });
});

test.describe("flashcards: the family reviews what's due", () => {
  test("review the queue with the keyboard; the server then has nothing due", async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await ctxFor(browser, "parent");
    const page = await ctx.newPage();
    await openParentHub(page, /Flashcards/);
    await expect(page.getByTestId("hub-fc-start")).toContainText("card", { timeout: 30_000 });
    await page.locator("#hub-fc-start").click();
    await expect(page.getByTestId("hub-flashcard")).toBeVisible();
    // Card 1: flip with Space, rate Good with 3 — then the rest of the deck the same way.
    await expect(page.getByTestId("hub-flashcard")).toHaveAttribute("data-flipped", "false");
    await page.keyboard.press("Space");
    await expect(page.getByTestId("hub-flashcard")).toHaveAttribute("data-flipped", "true");
    const reviews: Promise<unknown>[] = [];
    page.on("response", (r) => { if (/\/flashcards\/[^/]+\/review/.test(r.url()) && r.request().method() === "POST") reviews.push(r.json()); });
    await page.keyboard.press("3");
    for (let i = 0; i < 12 && !(await page.getByTestId("hub-fc-summary").isVisible().catch(() => false)); i++) {
      await page.keyboard.press("Space");
      await page.keyboard.press("4");
      await page.waitForTimeout(250);
    }
    await expect(page.getByTestId("hub-fc-summary")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("hub-fc-summary")).toContainText("Session complete");
    await expect.poll(() => reviews.length, { timeout: 20_000 }).toBeGreaterThanOrEqual(4);
    const first = (await reviews[0]) as { intervalDays: number; nextDueAt: string };
    expect(first.intervalDays).toBeGreaterThanOrEqual(1); // SM-2 ran server-side; the UI only displays it
    await page.getByRole("button", { name: "Done for now" }).click();
    await expect(page.getByTestId("hub-fc-caughtup")).toBeVisible({ timeout: 30_000 });
    await ctx.close();
  });

  test("the tutor sees the deck and the student's progress", async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await openTutorHub(page, /Flashcards/);
    await expect(page.locator(`[data-topic="${topicId}"]`)).toBeVisible({ timeout: 30_000 });
    await expect(cardWith(page, `1/2 + 1/2 (${stamp})`)).toContainText("Published");
    // Paste-add: two good lines and one bad line.
    await page.locator("#hub-bulk-cards").click();
    const dlg = page.locator("#hub-bulk-dialog");
    await dlg.getByLabel("Topic").selectOption(topicId);
    await dlg.getByLabel("Paste your cards").fill(`Half of 10 (${stamp}) | 5\nDouble 7 (${stamp}) | 14\nno separator here`);
    await expect(dlg).toContainText("2 cards ready");
    await expect(dlg).toContainText("Line 3");
    await dlg.getByRole("button", { name: /Add 2 cards/ }).click();
    await expect(dlg).toHaveCount(0, { timeout: 30_000 });
    await expect(cardWith(page, `Double 7 (${stamp})`)).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("live lessons: schedule, list, and the join window", () => {
  test("the tutor schedules a lesson in the UI (tomorrow) and sees it listed", async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await openTutorHub(page, /Live lessons/);
    await page.locator("#hub-schedule-lesson").first().click();
    const dlg = page.locator("#hub-lesson-form");
    await expect(dlg).toBeVisible();
    await dlg.getByLabel("Title").fill(lessonTitle);
    await dlg.getByLabel("Topic (optional)").selectOption(topicId);
    await dlg.getByRole("button", { name: childName, exact: true }).click();
    const saved = page.waitForResponse((r) => r.url().endsWith(`/api/learning-hub/lessons?tenantId=${accounts.freelancer.tenantId}`) && r.request().method() === "POST");
    await dlg.getByRole("button", { name: "Schedule video lesson" }).click();
    expect((await saved).status()).toBe(201);
    await expect(dlg).toHaveCount(0);
    const mine = page.locator('#hub-next-lesson, [data-ui="card"]').filter({ hasText: lessonTitle }).first();
    await expect(mine).toBeVisible({ timeout: 30_000 });
    await expect(mine).toContainText(childName);
    await ctx.close();
  });

  test("the family sees it, but Join is disabled outside the window", async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await ctxFor(browser, "parent");
    const page = await ctx.newPage();
    await openParentHub(page, /Live lessons/);
    const hero = page.locator("#hub-next-lesson");
    await expect(hero).toContainText(lessonTitle, { timeout: 30_000 });
    await expect(hero).toHaveAttribute("data-phase", "upcoming");
    const join = page.locator("#hub-join-btn");
    await expect(join).toBeDisabled();
    await expect(join).toContainText("Opens in");
    // The API agrees: joining now is refused (409) with the window in the message.
    const lessons = await apiFetch<{ id: string; title: string }[]>(`/api/learning-hub/lessons?tenantId=${accounts.freelancer.tenantId}&childId=${childId}`, await token(accounts.parent));
    const lesson = lessons.find((l) => l.title === lessonTitle)!;
    const res = await fetch(`${API_URL}/api/learning-hub/lessons/${lesson.id}/join?tenantId=${accounts.freelancer.tenantId}&childId=${childId}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token(accounts.parent)}` }, body: "{}" });
    expect(res.status).toBe(409);
    // …but the equipment check is open to everyone: the lobby previews, and Join stays locked until the window opens.
    await hero.getByRole("button", { name: /Test camera/ }).click();
    await expect(page.locator("#hub-lobby")).toBeVisible();
    await expect(page.locator("#hub-lobby-join")).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(page.locator("#hub-lobby")).toHaveCount(0);
    await ctx.close();
  });

  test("a lesson about to start can be joined: the room opens and the join call is made", async ({ browser }) => {
    test.setTimeout(180_000);
    const t = await token(accounts.freelancer);
    await apiPost("/api/learning-hub/lessons", t, { title: soonTitle, topicId, startsAt: new Date(Date.now() + 4 * 60_000).toISOString(), durationMins: 30, childIds: [childId], notes: soonNote });
    const ctx = await ctxFor(browser, "parent", { permissions: ["camera", "microphone"] });
    const page = await ctx.newPage();
    await openParentHub(page, /Live lessons/);
    const hero = page.locator("#hub-next-lesson");
    await expect(hero).toContainText(soonTitle, { timeout: 30_000 });
    await expect(hero).toHaveAttribute("data-phase", "open");
    // The tutor's lesson note is visible on the hero card (not only on ended rows)…
    await expect(hero.locator("[data-lesson-notes]")).toContainText(soonNote);
    const join = page.locator("#hub-join-btn");
    await expect(join).toBeEnabled();
    // Joining goes through the pre-join lobby: a camera + microphone check, then one Join button.
    await join.click();
    const lobby = page.locator("#hub-lobby");
    await expect(lobby).toBeVisible({ timeout: 20_000 });
    await expect(lobby.locator('[data-check="camera"]')).toBeVisible();
    await expect(lobby.locator('[data-check="microphone"]')).toBeVisible();
    await expect(lobby.locator("[data-lesson-notes]")).toContainText(soonNote); // …in the lobby…
    const joined = page.waitForResponse((r) => /\/lessons\/[^/]+\/join/.test(r.url()) && r.request().method() === "POST");
    await page.locator("#hub-lobby-join").click();
    await expect(page.locator("#hub-call-room")).toBeVisible({ timeout: 20_000 });
    const res = await joined;
    // 200 → Daily's frame mounts; 503 (video not configured) → a friendly state. Never a blank screen.
    if (res.status() === 200) await expect(page.locator("[data-testid=hub-daily-frame] iframe")).toBeAttached({ timeout: 30_000 });
    else await expect(page.locator("#hub-call-room")).toContainText(/isn.t available|couldn.t connect|isn.t open/i, { timeout: 20_000 });
    // …and inside the call: the family workspace (Notes · Homework · Cards) carries the lesson note and the topic's notes.
    const ws = page.getByTestId("hub-workspace");
    await expect(ws).toBeVisible({ timeout: 20_000 });
    await expect(ws.getByRole("tab")).toHaveCount(4); // Notes · Homework · Cards · Board
    await expect(ws).toContainText(soonNote);
    await expect(ws).toContainText(`Fractions note ${stamp}`, { timeout: 20_000 });
    await ws.getByRole("tab", { name: /Cards/ }).click();
    await expect(ws.locator("#ws-present-deck")).toBeVisible({ timeout: 20_000 });
    await ws.locator("#ws-present-deck").click();
    const deck = page.getByTestId("ws-deck");
    await expect(deck).toBeVisible();
    await page.keyboard.press("Space");
    await expect(deck.locator("[data-flipped=true]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(deck).toHaveCount(0);
    // "Back to lessons" keeps the call running in a small floating window; its ✕ really leaves.
    await page.locator("#hub-call-room").locator('[data-action="back-to-lessons"]').click();
    await expect(page.locator("[data-call-layer]")).toHaveAttribute("data-call-layer", "mini");
    await page.locator('[data-action="mini-leave"]').click();
    await expect(page.locator("#hub-call-room")).toHaveCount(0);
    await ctx.close();
  });
});

// ── Round 4: rejoin, "stay on the call?", and the in-call workspace ──────────────
test.describe("live lessons: rejoin, stay prompt and workspace", () => {
  test.setTimeout(480_000); // one long real-call journey on a shared dev stack
  let lessonId = "";
  const lessonRow = (page: Page) => page.locator(`[data-lesson-id="${lessonId}"]`).first();
  const joinBtn = (page: Page) => page.locator(`[data-lesson-id="${lessonId}"] [data-action="join"], #hub-next-lesson[data-lesson-id="${lessonId}"] #hub-join-btn`).first();

  test("the tutor runs a lesson: workspace tabs, the stay prompt, End → rejoin without the lobby", async ({ browser }) => {
    const ctx = await ctxFor(browser, "freelancer", { permissions: ["camera", "microphone"] });
    const page = await ctx.newPage();
    await openTutorHub(page, /Live lessons/);
    // Created only now (the room's cut-off is tied to the scheduled end): a 10-minute lesson that ends ~75 s from now —
    // the "stay?" prompt opens when the scheduled end passes, and the list picks the new lesson up live.
    const t = await token(accounts.freelancer);
    const created = await apiPost<{ id: string }>("/api/learning-hub/lessons", t, { title: rejoinTitle, topicId, startsAt: new Date(Date.now() - 10 * 60_000 + 75_000).toISOString(), durationMins: 10, childIds: [childId], notes: `Note for ${stamp}` });
    lessonId = created.id;
    await expect(lessonRow(page)).toBeVisible({ timeout: 60_000 });
    await expect(lessonRow(page).locator("[data-lesson-notes]")).toContainText(`Note for ${stamp}`); // the note shows on the row too
    await joinBtn(page).click();
    await expect(page.locator("#hub-lobby [data-lesson-notes]")).toContainText(`Note for ${stamp}`);
    await page.locator("#hub-lobby-join").click();
    const room = page.locator("#hub-call-room");
    await expect(room).toBeVisible({ timeout: 20_000 });
    // The call sits INSIDE the hub page: the hub's own tab strip / hero / lists are gone (no duplicates)…
    await expect(page.locator("[data-call-layer]")).toHaveAttribute("data-call-layer", "inline");
    await expect(page.locator('[role="tab"]:not([data-tab])', { hasText: /^Lessons/ })).toHaveCount(0); // (the workspace's own tabs carry data-tab and include a "Lessons" tab)
    await expect(page.locator("#hub-next-lesson")).toHaveCount(0);

    // ── the stay prompt: light card ON the call, focused Stay button, live countdown ──
    const prompt = page.getByTestId("hub-stay-prompt");
    await expect(prompt).toBeVisible({ timeout: 150_000 });
    await expect(prompt).toHaveAttribute("role", "alertdialog");
    await expect(prompt).toContainText("Lesson time is up — stay on the call?");
    await expect(page.locator("#hub-stay-btn")).toBeFocused();
    const c1 = await page.getByTestId("stay-countdown").innerText();
    await expect.poll(async () => page.getByTestId("stay-countdown").innerText()).not.toBe(c1);
    const extended = page.waitForResponse((r) => /\/lessons\/[^/]+\/extend/.test(r.url()) && r.request().method() === "POST");
    await page.locator("#hub-stay-btn").click();
    expect((await extended).status()).toBe(200);
    await expect(page.getByTestId("hub-toast")).toContainText("15 more minutes");
    await expect(prompt).toHaveCount(0);

    // ── the workspace: tabs scoped to THIS lesson's student ──
    const ws = page.getByTestId("hub-workspace");
    await expect(ws).toBeVisible({ timeout: 20_000 });
    await expect(ws.getByRole("tab")).toHaveCount(7); // …and the whiteboard (live/board)
    await expect(ws.locator(`[data-student="${childId}"]`)).toContainText(childName, { timeout: 30_000 });
    await ws.getByRole("tab", { name: /Lessons/ }).click();
    // The lesson's note is EDITABLE right here (autosaves), not a "go edit the lesson" detour.
    const noteBox = ws.locator("#ws-lesson-note");
    await expect(noteBox).toHaveValue(`Note for ${stamp}`);
    const putNote = page.waitForResponse((r) => /\/lessons\/[^/]+/.test(r.url()) && r.request().method() === "PUT");
    await noteBox.fill(`Edited in the call ${stamp}`);
    expect((await putNote).status()).toBe(200);
    await expect(ws.locator('[data-save-state="saved"]').first()).toBeVisible();
    // Attach a library note → it shows first, marked "For this lesson".
    await ws.locator("#ws-attach-notes").click();
    const attach = page.locator("#ws-attach-dialog");
    await expect(attach).toBeVisible();
    await attach.getByLabel(new RegExp(`Fractions note ${stamp}`)).check();
    await attach.getByRole("button", { name: /Save/ }).click();
    await expect(attach).toHaveCount(0, { timeout: 20_000 });
    await expect(ws.getByTestId("attached-notes")).toBeVisible({ timeout: 20_000 });
    await expect(ws).toContainText("For this lesson");
    await expect(ws).toContainText(`Fractions note ${stamp}`, { timeout: 20_000 });
    await ws.getByRole("tab", { name: /Progress/ }).click();
    await expect(ws).toContainText(childName, { timeout: 30_000 });
    await ws.getByRole("tab", { name: /Homework/ }).click();
    await expect(ws.locator("#ws-set-homework")).toBeVisible();
    await ws.getByRole("tab", { name: /Quiz/ }).click();
    await ws.getByRole("tab", { name: /Cards/ }).click();
    await expect(ws).toContainText(`(${stamp})`, { timeout: 30_000 });
    // Layout presets and Present mode (P): tutor-only controls disappear, names can be hidden.
    await room.locator('[data-preset="work"]').click();
    await expect(room).toHaveAttribute("data-layout", "work");
    // The floating video tile is draggable, resizable, and remembers where it was put.
    const tile = page.getByTestId("hub-video-pane");
    await expect(page.locator("[data-tile-grip]")).toBeVisible();
    const before = (await tile.boundingBox())!;
    const grip = (await page.locator("[data-tile-grip]").boundingBox())!;
    await page.mouse.move(grip.x + 30, grip.y + 20);
    await page.mouse.down();
    await page.mouse.move(grip.x - 260, grip.y - 160, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => Math.round((await tile.boundingBox())!.x)).not.toBe(Math.round(before.x));
    const stored = await page.evaluate(() => localStorage.getItem("hub-video-tile"));
    expect(JSON.parse(stored!)).toMatchObject({ size: "m" });
    await page.locator('[data-tile-size="s"]').click();
    await expect.poll(async () => Math.round((await tile.boundingBox())!.width)).toBeLessThan(Math.round(before.width));
    await page.locator("[data-tile-reset]").click(); // back bottom-right, medium
    await expect.poll(async () => Math.round((await tile.boundingBox())!.x)).toBeGreaterThan(Math.round(before.x) - 4);
    await room.locator('[data-preset="65-35"]').click();
    await expect(room).toHaveAttribute("data-layout", "split");
    await ws.getByRole("tab", { name: /Homework/ }).click();
    await page.keyboard.press("p");
    await expect(room).toHaveAttribute("data-present", "1");
    await expect(ws.locator("#ws-set-homework")).toHaveCount(0);
    await page.keyboard.press("p");
    await expect(room).toHaveAttribute("data-present", "0");

    // ── End lesson: explains it is not a lock-out ──
    await room.locator('[data-action="end-lesson"]').click();
    await expect(page.getByTestId("hub-end-confirm")).toContainText(/disconnects everyone\. You and your students can still rejoin until \d{2}:\d{2}/);
    await page.locator('[data-action="confirm-end"]').click();
    await expect(room.locator('[data-action="rejoin-call"]')).toBeVisible({ timeout: 30_000 }); // never a dead end
    await room.getByRole("button", { name: "Leave page" }).click();
    await expect(room).toHaveCount(0);

    // "Ended" inside the window is a rejoinable state, for the tutor…
    await expect(lessonRow(page)).toHaveAttribute("data-stage", "rejoin", { timeout: 30_000 });
    await expect(lessonRow(page)).toContainText("Ended — rejoin");
    await expect(lessonRow(page)).toContainText("Rejoin lesson");
    // …and "Rejoin now" skips the lobby.
    const again = page.waitForResponse((r) => new RegExp(`/lessons/${lessonId}/join`).test(r.url()) && r.request().method() === "POST");
    await lessonRow(page).locator('[data-action="rejoin-now"]').click();
    await expect(room).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#hub-lobby")).toHaveCount(0);
    expect((await again).status()).toBe(200);
    await ctx.close();
  });

  test("safeguarding: after End the family cannot rejoin (or keep the room going) until the tutor is back; then they walk straight in", async ({ browser }) => {
    test.skip(!lessonId, "needs the lesson from the previous test");
    const t = await token(accounts.freelancer);
    await apiFetch(`/api/learning-hub/lessons/${lessonId}/end?tenantId=${accounts.freelancer.tenantId}`, t, { method: "POST", body: "{}" });
    const ctx = await ctxFor(browser, "parent", { permissions: ["camera", "microphone"] });
    const page = await ctx.newPage();
    await openParentHub(page, /Live lessons/);
    // No Join / Rejoin for the family while the tutor is out…
    await expect(lessonRow(page)).toContainText("Waiting for your tutor", { timeout: 30_000 });
    await expect(lessonRow(page).locator('[data-action="rejoin-now"], [data-action="join"]')).toHaveCount(0);
    // …and the server agrees (the UI is not the guard): no token, a clear code, no room.
    const pt = await token(accounts.parent);
    const rawPost = (path: string, tok: string) => fetch(`${API_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: "{}" });
    const refused = await rawPost(`/api/learning-hub/lessons/${lessonId}/join?tenantId=${accounts.freelancer.tenantId}&childId=${childId}`, pt);
    expect(refused.status).toBe(409);
    expect(((await refused.json()) as { code?: string; token?: string }).code).toBe("waiting_for_tutor");
    expect((await rawPost(`/api/learning-hub/lessons/${lessonId}/extend?tenantId=${accounts.freelancer.tenantId}&childId=${childId}`, pt)).status).toBe(409);
    // The tutor comes back in (their join makes it live again): the family's row updates live and they can rejoin.
    expect((await rawPost(`/api/learning-hub/lessons/${lessonId}/join?tenantId=${accounts.freelancer.tenantId}`, t)).status).toBe(200);
    // (The row normally updates live through the hubLessons stream; a reload is the fallback so a slow event stream can't fail the safeguarding check.)
    if (!(await expect(lessonRow(page)).not.toContainText("Waiting for your tutor", { timeout: 20_000 }).then(() => true, () => false))) {
      await openParentHub(page, /Live lessons/);
      await expect(lessonRow(page)).not.toContainText("Waiting for your tutor", { timeout: 30_000 });
    }
    const joined = page.waitForResponse((r) => new RegExp(`/lessons/${lessonId}/join`).test(r.url()) && r.request().method() === "POST");
    await lessonRow(page).locator('[data-action="rejoin-now"]').click();
    expect((await joined).status()).toBe(200);
    await expect(page.locator("#hub-call-room")).toBeVisible({ timeout: 20_000 });
    await ctx.close();
  });
});

// ── Round 3: groups, YouTube videos, and light dialogs ───────────────────────
const groupName = `Grp ${stamp}`;
const vidHw = `Video HW ${stamp}`;
const YT = "https://youtu.be/aircAruvnKk";
test.describe("groups + videos: a group quick action sets video homework", () => {
  test("the tutor makes a group, filters by it, and 'Set homework' opens the form preselected", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await openTutorHub(page, /Students/);
    await page.locator("#hub-new-group").click();
    const gd = page.locator("#hub-group-dialog");
    await expect(gd).toBeVisible();
    await expectLight(gd);
    await gd.getByLabel("Group name").fill(groupName);
    await gd.getByRole("button", { name: childName, exact: true }).click();
    const made = page.waitForResponse((r) => r.url().includes("/api/learning-hub/groups") && r.request().method() === "POST");
    await gd.getByRole("button", { name: "Create group" }).click();
    expect((await made).status()).toBe(201);
    await expect(gd).toHaveCount(0);
    const card = page.locator(`[data-group-card="${groupName}"]`);
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toContainText("1 student");
    // Filtering the roster by the group leaves just our child, wearing the group chip.
    await card.locator("[data-group-filter]").click();
    await expect(cardWith(page, childName)).toContainText(groupName);
    // One click: Set homework → the form is open, the group and its member are already chosen.
    // (The tile's MAIN click opens the group's existing homework when there is any — and this child already has some from
    // earlier tests — so the always-creates "+" is the one-click "Set homework".)
    await card.locator('[data-group-create="homework"]').click();
    const dlg = page.locator("#hub-homework-form");
    await expect(dlg).toBeVisible({ timeout: 30_000 });
    await expectLight(dlg);
    await expect(dlg.locator("[data-group-pick]", { hasText: groupName })).toHaveAttribute("aria-pressed", "true");
    await expect(dlg.getByRole("button", { name: childName, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(dlg.locator("[data-recipient-summary]")).toContainText("Sending to 1 student");
    // Videos: instant format validation, a thumbnail preview, then it joins the list.
    await dlg.getByLabel("Title").fill(vidHw);
    await dlg.getByLabel("Instructions").fill("Watch first, then write three things you learned.");
    const link = dlg.locator("#hub-hw-video-link");
    await link.fill("https://vimeo.com/12345");
    await expect(dlg.getByRole("alert").filter({ hasText: /doesn.t look like a YouTube link/ })).toBeVisible();
    await link.fill(YT);
    await expect(dlg.locator("[data-video-preview] img")).toHaveAttribute("src", /^https:\/\/i\.ytimg\.com\/vi\/aircAruvnKk\/mqdefault\.jpg$/);
    await dlg.locator("[data-video-add]").click();
    await expect(dlg.locator("[data-video-row]")).toHaveCount(1);
    const saved = page.waitForResponse((r) => r.url().includes("/api/learning-hub/homework") && r.request().method() === "POST");
    await dlg.getByRole("button", { name: "Assign homework" }).click();
    const res = await saved;
    expect(res.status()).toBe(201);
    const body = (await res.json()) as { videos: { id: string; embedUrl: string }[]; groupIds: string[]; assignedChildIds: string[] };
    expect(body.videos[0]!.id).toBe("aircAruvnKk");
    expect(body.videos[0]!.embedUrl).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/aircAruvnKk/);
    expect(body.groupIds.length).toBe(1);
    expect(body.assignedChildIds).toEqual([childId]);
    await ctx.close();
  });

  test("the group card's tiles show what exists for THAT group, link to a filtered view, and the chip clears", async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await ctxFor(browser, "freelancer");
    const page = await ctx.newPage();
    await openTutorHub(page, /Students/);
    const card = page.locator(`[data-group-card="${groupName}"]`);
    await expect(card).toBeVisible({ timeout: 30_000 });
    const hwTile = card.locator('[data-group-tile="homework"]');
    // Status, not a bare shortcut: the video homework set in the previous test is open for this group's one student.
    await expect(hwTile).toContainText("1 open", { timeout: 30_000 });
    await expect(hwTile).toHaveAttribute("data-exists", "1");
    await expect(card.locator('[data-group-tile="quiz"]')).toContainText("No quiz set");
    // A group's tile also counts lessons set for ONLY its members, and earlier tests in this file scheduled/ran lessons for this
    // same single child — so the state depends on the run's history; it must say SOMETHING true, not be blank.
    await expect(card.locator('[data-group-tile="lesson"] [data-tile-status]')).toContainText(/None scheduled|Live now|Next:|Nothing upcoming/);
    // A secondary "+" always creates new, with the group preselected.
    await expect(card.getByRole("button", { name: `Set new homework for ${groupName}` })).toBeVisible();
    // Main click → Homework tab filtered to this group, wearing a chip.
    await hwTile.locator("[data-group-action]").click();
    const chip = page.locator(`[data-group-view-chip="${groupName}"]`);
    await expect(chip).toBeVisible({ timeout: 30_000 });
    await expect(chip).toContainText("1 student");
    await expect(cardWith(page, vidHw)).toBeVisible();
    // Clearing removes the filter, and it doesn't come back.
    await chip.locator("[data-clear-group-view]").click();
    await expect(chip).toHaveCount(0);
    await page.waitForTimeout(1500);
    await expect(chip).toHaveCount(0);
    // With no quiz set, the Quiz tile's main click opens the set-a-quiz form for the group (today's behaviour).
    await tabOf(page, /Students/).click();
    await page.locator(`[data-group-card="${groupName}"] [data-group-tile="quiz"] [data-group-action]`).click();
    const dlg = page.locator("#hub-homework-form");
    await expect(dlg).toBeVisible({ timeout: 30_000 });
    await expect(dlg.locator("[data-group-pick]", { hasText: groupName })).toHaveAttribute("aria-pressed", "true");
    await ctx.close();
  });

  test("the family gets the video above the instructions: a facade first, a sandboxed nocookie iframe only after play", async ({ browser }) => {
    test.setTimeout(180_000);
    const t = await token(accounts.freelancer);
    await apiPost("/api/learning-hub/notes", t, { topicId, title: `Video note ${stamp}`, body: "Watch, then try it.", published: true, attachments: [], videos: [{ url: YT, title: "Neural nets", start: 30 }] });
    const ctx = await ctxFor(browser, "parent");
    const page = await ctx.newPage();
    await openParentHub(page, /Homework/);
    const card = cardWith(page, vidHw);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toContainText("Video");
    await card.click();
    const detail = page.locator("#hub-homework-detail");
    await expect(detail.locator("[data-video-embeds]")).toBeVisible();
    await expect(detail.locator("iframe")).toHaveCount(0); // nothing is requested from YouTube until play
    await expect(detail.getByRole("link", { name: /Open on YouTube/ })).toHaveAttribute("href", "https://www.youtube.com/watch?v=aircAruvnKk");
    await expect(detail.getByText(/Nothing is loaded from YouTube until you press play/)).toBeVisible();
    await detail.locator("[data-video-play]").click();
    const frame = detail.locator("iframe");
    await expect(frame).toHaveCount(1);
    await expect(frame).toHaveAttribute("src", /^https:\/\/www\.youtube-nocookie\.com\/embed\/aircAruvnKk/);
    await expect(frame).toHaveAttribute("sandbox", /allow-scripts/);
    await expect(frame).toHaveAttribute("loading", "lazy");
    await expect(frame).toHaveAttribute("title", /.+/);
    // The note carries a Video chip and an embed in its reading view.
    await page.getByRole("tab", { name: /^Lessons/ }).click();
    const nc = cardWith(page, `Video note ${stamp}`);
    await expect(nc.locator("[data-video-chip]")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: `Video note ${stamp}`, exact: true }).click();
    await expect(page.locator("#hub-reader [data-video-embeds]")).toBeVisible();
    await ctx.close();
  });

  test("the API refuses a non-YouTube link", async () => {
    const t = await token(accounts.freelancer);
    const res = await fetch(`${API_URL}/api/learning-hub/notes`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ topicId, title: "bad vid", body: "x", published: false, attachments: [], videos: [{ url: "https://evil.example/watch?v=aircAruvnKk" }] }) });
    expect(res.status).toBe(400);
  });
});

// ── Interactive lessons taught IN the call, and a broken tab never takes the call down ─────────────────────────────
// Two real Daily calls (tutor + family): the tutor presses Teach on an interactive lesson attached to the live lesson; the family (who
// joins AFTER it started) lands in the same lesson and follows the tutor step by step until they choose to go at their own pace.
// A workspace tab that throws while rendering shows a "Reload tab" card and the call keeps running.
test.describe("interactive lessons in the call + tab error boundary", () => {
  test.setTimeout(480_000);

  test("Teach opens the lesson beside the video; a late-joining family follows; a crashing tab is contained", async ({ browser }) => {
    const t = await token(accounts.freelancer);
    const seeded = await seedOakLesson(t, { stamp: `call${stamp}`, subject, topicId, warmupMax: 2, quizMax: 2 });
    const liveTitle = `Teach in call ${stamp}`;
    const created = await apiPost<{ id: string }>("/api/learning-hub/lessons", t, { title: liveTitle, topicId, startsAt: new Date(Date.now() - 5 * 60_000).toISOString(), durationMins: 90, childIds: [childId], noteIds: [seeded.noteId] });
    const row = (page: Page) => page.locator(`[data-lesson-id="${created.id}"]`).first();
    const join = (page: Page) => page.locator(`[data-lesson-id="${created.id}"] [data-action="join"], #hub-next-lesson[data-lesson-id="${created.id}"] #hub-join-btn`).first();
    const enter = async (page: Page) => {
      await expect(row(page)).toBeVisible({ timeout: 60_000 });
      await join(page).click();
      await page.locator("#hub-lobby-join").click();
      await expect(page.locator("#hub-call-room")).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-testid="hub-daily-frame"] iframe')).toBeAttached({ timeout: 60_000 });
    };

    // ── the tutor starts teaching ──
    const tctx = await ctxFor(browser, "freelancer", { permissions: ["camera", "microphone"] });
    const tp = await tctx.newPage();
    await openTutorHub(tp, /Live lessons/);
    await enter(tp);
    const tws = tp.getByTestId("hub-workspace");
    await tws.getByRole("tab", { name: /Lessons/ }).click();
    await expect(tws.getByTestId("ws-interactive-lessons")).toContainText(seeded.title, { timeout: 30_000 });
    await tws.getByRole("button", { name: `Teach ${seeded.title}` }).click();
    const tLesson = tws.getByTestId("ws-lesson-player");
    await expect(tLesson).toHaveAttribute("data-drive", "1", { timeout: 30_000 });
    const tPlayer = tLesson.getByTestId("lesson-player");
    await expect(tPlayer).toHaveAttribute("data-step", "start");

    // ── the family joins late and lands in the same lesson, following ──
    const fctx = await ctxFor(browser, "parent", { permissions: ["camera", "microphone"] });
    const fp = await fctx.newPage();
    await openParentHub(fp, /Live lessons/);
    await enter(fp);
    const fws = fp.getByTestId("hub-workspace");
    const fLesson = fws.getByTestId("ws-lesson-player");
    await expect(fLesson).toHaveAttribute("data-following", "1", { timeout: 60_000 });
    const fPlayer = fLesson.getByTestId("lesson-player");
    await expect(fPlayer).toHaveAttribute("data-step", "start");

    // ── the tutor moves; the family follows; going at their own pace lets go ──
    await tPlayer.getByTestId("preview-jump-words").click({ force: true });
    await expect(tPlayer).toHaveAttribute("data-step", "words");
    await expect(fPlayer).toHaveAttribute("data-step", "words", { timeout: 30_000 });
    await fLesson.getByRole("button", { name: "Go at my own pace" }).click();
    await expect(fLesson).toHaveAttribute("data-following", "0");
    await tPlayer.getByTestId("preview-jump-learn").click({ force: true });
    await expect(tPlayer).toHaveAttribute("data-step", "learn");
    await expect(fPlayer).toHaveAttribute("data-step", "words"); // stayed put
    await tLesson.getByRole("button", { name: "Close preview" }).click();
    await expect(tLesson).toHaveCount(0);

    // ── a tab that throws while rendering is contained: card + Reload tab, the call keeps running ──
    await fp.route(/\/api\/learning-hub\/homework(\?|$)/, (r) => r.request().method() === "GET"
      ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "a", title: "A", dueAt: "2026-01-01T00:00:00Z" }, { id: "b", title: "B", dueAt: "2026-01-02T00:00:00Z" }]) })
      : r.continue());
    await fLesson.getByRole("button", { name: "Leave this lesson" }).click(); // mid-lesson: asks first
    await fp.getByTestId("lesson-leave").click();
    await expect(fLesson).toHaveCount(0);
    await fws.getByRole("tab", { name: /Homework/ }).click();
    const crashed = fws.getByTestId("ws-tab-crashed");
    await expect(crashed).toBeVisible({ timeout: 20_000 });
    await expect(crashed).toContainText("This tab hit a problem");
    await expect(fp.locator("#hub-call-room")).toBeVisible();                                   // the call is untouched…
    await expect(fp.locator('[data-testid="hub-daily-frame"] iframe')).toBeAttached();
    await fws.getByRole("tab", { name: /Lessons/ }).click();                                     // …and the other tabs still work
    await expect(fws.getByTestId("ws-interactive-lessons")).toContainText(seeded.title);
    await fp.unroute(/\/api\/learning-hub\/homework(\?|$)/);
    await fws.getByRole("tab", { name: /Homework/ }).click();
    await fws.locator('[data-action="reload-tab"]').click();
    await expect(fws.getByTestId("ws-tab-crashed")).toHaveCount(0);

    await tctx.close();
    await fctx.close();
  });
});
