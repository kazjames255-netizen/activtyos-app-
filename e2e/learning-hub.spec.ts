import { test, expect } from "@playwright/test";
import { loadAccounts, statePath, API_URL, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { cardWith } from "./helpers/ui";
import type { Page } from "@playwright/test";

// Learning Hub: the on/off switch, the topic taxonomy, course notes & resources,
// the Students roster (enrolment through the UI), a staff member authoring, a
// family reading — and tenant isolation.
//
// The tutor is the standing "freelancer" account, the family the standing
// "parent" (linked to the tutor by a booking, the same way any family is), and
// "company" plays a DIFFERENT provider for the cross-tenant checks (its staff
// account is the "staff" tutor).

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
let accounts: AccountManifest["accounts"];

// Minimal valid PDF ("%PDF-" is what POST /api/uploads sniffs for).
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
/** Status + body without throwing, for asserting refusals. */
async function raw(path: string, idToken: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}`, ...init?.headers } });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

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
/** The hub's sidebar row for a subject / topic (its main button, not the chevron or ⋯). */
const rowOf = (page: Page, label: string) => page.locator("#hub-topic-filter").getByRole("button", { name: new RegExp(`^${label}`) });
/** The desktop sidebar caps the subject list at a handful ("Show all N") — open it before hunting for a row. */
async function revealAll(page: Page) {
  const more = page.locator("#hub-topic-filter").getByRole("button", { name: /^Show all \d+/ });
  if (await more.isVisible().catch(() => false)) await more.click();
}
async function openNotes(page: Page) {
  await expect(page.getByRole("heading", { name: /Teaching Hub|My Classroom/ })).toBeVisible({ timeout: 30_000 });
  await tabOf(page, /^Lessons/).click();
  await expect(page.locator("#hub-notes")).toBeVisible({ timeout: 20_000 });
}

test.beforeAll(async () => {
  accounts = loadAccounts().accounts;
  await setHub(accounts.freelancer, false);
  await setHub(accounts.company, false);
});
test.afterAll(async () => {
  await setHub(accounts.freelancer, false);
  await setHub(accounts.company, false);
});

test.describe("the page on/off switch (Setup → Features)", () => {
  test.use({ storageState: statePath("freelancer") });

  test("starts off: URL and API both refuse it", async ({ page }) => {
    await page.goto("/freelancer/learninghub");
    await expect(page.getByText(/turned off|isn.t available/i).first()).toBeVisible({ timeout: 20_000 });
    const r = await raw("/api/learning-hub/topics", await token(accounts.freelancer));
    expect(r.status).toBe(403);
    expect(r.body.code).toBe("feature_off");
  });

  test("the toggle turns it on, and off again", async ({ page }) => {
    test.setTimeout(240_000); // several full page loads; the dev server is slow when busy
    const featureRow = () =>
      page.getByText("For tutoring providers", { exact: false }).first().locator("xpath=ancestor::div[.//button[normalize-space()='On']][1]");
    await page.goto("/freelancer/setup");
    await expect(page.getByText(/topics, lessons, quizzes, homework, flashcards and live lessons/)).toBeVisible({ timeout: 30_000 });
    // Setup autosaves on a 500ms debounce and shows "Saved" straight away, so
    // wait for the real PUT before navigating (a full page load cancels it).
    const saved = page.waitForResponse((r) => r.url().includes("/api/library") && r.request().method() === "PUT");
    await featureRow().getByRole("button", { name: "On", exact: true }).click();
    expect((await saved).ok()).toBe(true);

    await page.goto("/freelancer/learninghub");
    await expect(page.getByRole("heading", { name: /Teaching Hub|My Classroom/ })).toBeVisible({ timeout: 30_000 });

    // With the hub on, Setup gains a "Learning Hub" settings tab.
    await page.goto("/freelancer/setup?tab=hub");
    await expect(page.getByText("Marking & progress")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Attainment levels")).toBeVisible(); // was "Mastery bands" before round 3
    await expect(page.getByText("Question types")).toBeVisible();

    await page.goto("/freelancer/setup");
    await expect(page.getByText(/topics, lessons, quizzes/)).toBeVisible({ timeout: 30_000 });
    const saved2 = page.waitForResponse((r) => r.url().includes("/api/library") && r.request().method() === "PUT");
    await featureRow().getByRole("button", { name: "Off", exact: true }).click();
    expect((await saved2).ok()).toBe(true);
    await page.goto("/freelancer/learninghub");
    await expect(page.getByText(/turned off|isn.t available/i).first()).toBeVisible({ timeout: 30_000 });
    await setHub(accounts.freelancer, true); // the rest of the file needs it on
  });
});

const subject = `Maths ${stamp}`;
const noteTitle = `Quadratics ${stamp}`;

let childId = "";
const childName = `Hubkid ${stamp}`;

test.describe("tutor builds topics and notes", () => {
  test.use({ storageState: statePath("freelancer") });

  test("Home leads the tab strip, Live lessons follows; every panel has a tab", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/freelancer/learninghub");
    await expect(page.getByRole("heading", { name: /Teaching Hub|My Classroom/ })).toBeVisible({ timeout: 30_000 });
    const tabs = page.getByRole("tab");
    await expect(tabs.first()).toHaveAttribute("data-panel", "home");
    await expect(tabs.nth(1)).toHaveAttribute("data-panel", "live");
    // Home is the default tab as soon as its panel is built; until then Live lessons, then Notes.
    const homeStatus = await tabs.first().getAttribute("data-status");
    const liveStatus = await tabs.nth(1).getAttribute("data-status");
    await expect(tabOf(page, homeStatus === "live" ? /^Home$/ : liveStatus === "live" ? /Live lessons/ : /^Lessons/)).toHaveAttribute("aria-selected", "true");
    // Unbuilt panels stay visible (never hidden), labelled "Soon" in words.
    for (const p of ["home", "live", "students", "dashboard", "diagnostic", "quizzes", "homework", "notes", "flashcards"]) {
      await expect(page.locator(`[role="tab"][data-panel="${p}"]`)).toBeVisible();
    }
    // Roving tabindex + arrow keys.
    await tabs.first().focus();
    await page.keyboard.press("End");
    await expect(tabOf(page, /Flashcards/)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  });

  test("topic → subtopic → note with a PDF worksheet", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/freelancer/learninghub");
    await openNotes(page);

    await page.locator("#hub-topic-filter").getByRole("button", { name: /Add topic/ }).click();
    await page.getByLabel("Subject", { exact: true }).fill(subject);
    await page.getByLabel("Topic name (e.g. Algebra)").fill("Algebra");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(rowOf(page, subject)).toBeVisible({ timeout: 20_000 });

    await rowOf(page, subject).click();
    await page.getByRole("button", { name: "Actions for Algebra" }).click();
    await page.getByRole("menuitem", { name: "Add subtopic" }).click();
    await page.getByLabel("Subtopic name").fill("Quadratics");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(rowOf(page, "Quadratics")).toBeVisible({ timeout: 20_000 });
    await rowOf(page, "Quadratics").click();
    await expect(rowOf(page, "Quadratics")).toHaveAttribute("aria-current", "true");

    // A topic that has subtopics can't be deleted — the refusal shows as a dismissible banner.
    await page.getByRole("button", { name: "Actions for Algebra" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("menuitem", { name: /Tap again to delete/ }).click();
    const banner = page.locator("#learning-hub").getByRole("alert");
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await banner.getByRole("button", { name: "Dismiss error" }).click();
    await expect(banner).toHaveCount(0);

    // No notes yet → an empty state with a call to action, not a bare list.
    await expect(page.getByText("No lessons here yet")).toBeVisible();
    await page.getByRole("button", { name: /New lesson/ }).first().click();
    await page.getByLabel("Title", { exact: true }).fill(noteTitle);
    await page.getByTestId("sb-title").fill("Factorising");
    await page.getByTestId("sb-add-block").click();
    await page.getByTestId("sb-add-text").click();
    await page.getByTestId("sb-block-0").locator("textarea").fill("Find two numbers that **multiply** to c");
    await page.getByTestId("sb-preview").click();
    await expect(page.getByTestId("sb-preview-pane")).toContainText("Factorising");
    await page.getByTestId("sb-preview").click();
    await page.locator("#hub-note-files").setInputFiles({ name: "worksheet.pdf", mimeType: "application/pdf", buffer: PDF });
    await expect(page.getByText("worksheet.pdf")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Save lesson" }).click();

    const card = cardWith(page, noteTitle);
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.getByText("worksheet.pdf")).toBeVisible(); // attachment chip on the card
    await card.getByRole("button", { name: noteTitle, exact: true }).click(); // the whole card opens the reading view
    await expect(page.getByRole("heading", { name: noteTitle })).toBeVisible();
    await expect(page.getByRole("link", { name: /worksheet\.pdf/ })).toHaveAttribute("href", /\/api\/images\/.+sig=/);
    await page.getByRole("button", { name: "All lessons" }).click();
    await expect(cardWith(page, noteTitle)).toBeVisible();
  });

  test("a half-written note survives a tab switch and asks before it's discarded", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/freelancer/learninghub");
    await openNotes(page);
    await revealAll(page);
    await rowOf(page, subject).click();
    await page.getByRole("button", { name: /New lesson/ }).first().click();
    await page.getByLabel("Title", { exact: true }).fill(`Unsaved ${stamp}`);
    await tabOf(page, /Students/).click();
    await expect(tabOf(page, /^Lessons/)).toContainText("Unsaved");
    await tabOf(page, /^Lessons/).click();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(`Unsaved ${stamp}`);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByText("Discard your changes?")).toBeVisible();
    await page.getByRole("button", { name: "Discard" }).click();
    await expect(page.locator("#hub-note-editor")).toHaveCount(0);
    await expect(page.getByText(`Unsaved ${stamp}`)).toHaveCount(0);
  });

  test("on a phone the sidebar collapses into one button and a bottom sheet", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/freelancer/learninghub");
    await openNotes(page);
    await page.getByRole("button", { name: /Subjects and topics/ }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: new RegExp(`^${subject}`) }).first().click();
    await expect(sheet).toHaveCount(0);
    await expect(page.locator("#hub-topic-filter")).toContainText(subject);
    await expect(cardWith(page, noteTitle)).toBeVisible({ timeout: 20_000 });
  });

  test("a subject can't be created twice under different casing", async () => {
    const t = await token(accounts.freelancer);
    const r = await raw("/api/learning-hub/topics", t, { method: "POST", body: JSON.stringify({ subject: subject.toUpperCase(), topic: "algebra" }) });
    expect(r.status).toBe(409);
  });
});

test.describe("tutor enrols a student (Students tab)", () => {
  test.use({ storageState: statePath("freelancer") });

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    const listing = await provisionLiveListing(accounts.freelancer, { title: `E2E Tuition ${stamp}`, price: 0 });
    childId = await createParentChild(accounts.parent, { name: childName });
    // The shared parent may already have a booking in this slot from an earlier run;
    // that's fine — any booking with this provider already links the family.
    await bookViaApi(accounts.parent, listing, { child: childName }).catch((e) => { if (!/clash|existing booking/i.test(String(e))) throw e; });
    await markParentWelcomed(accounts.parent);
    // Families reach the hub ONLY through an enrolment. Before the tutor enrols
    // the child the hub is closed to them (404 — no relationship), even though
    // the parent has booked with this provider.
    const p0 = await token(accounts.parent);
    // (Asked for THIS child: a shared parent may already have other children enrolled.)
    expect((await raw(`/api/learning-hub/topics?tenantId=${accounts.freelancer.tenantId}&childId=${childId}`, p0)).status).toBe(404);
  });

  test("find the child, pick their subjects, enrol — then pause and resume", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/freelancer/learninghub");
    await expect(page.getByRole("heading", { name: /Teaching Hub|My Classroom/ })).toBeVisible({ timeout: 30_000 });
    await tabOf(page, /Students/).click();
    await expect(page.locator("#hub-students")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /Enrol a student/ }).first().click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Search children").fill(childName);
    await dlg.getByRole("button", { name: `Enrol ${childName}` }).click();
    // Step 2: narrow to one subject (empty = everything).
    await expect(dlg.getByText("Which subjects can they see?")).toBeVisible();
    await dlg.getByRole("button", { name: subject, exact: true }).click();
    await expect(dlg.getByRole("button", { name: subject, exact: true })).toHaveAttribute("aria-pressed", "true");
    // Round 3: the tutor can tag the student's school year while enrolling (default: worked out from their date of birth).
    await expectLight(dlg);
    await dlg.getByLabel("Year group").selectOption("Year 5");
    const enrolled = page.waitForResponse((r) => r.url().includes("/api/learning-hub/students") && r.request().method() === "POST");
    await dlg.getByRole("button", { name: "Enrol student" }).click();
    const enrolRes = await enrolled;
    expect(enrolRes.ok()).toBe(true);
    expect(((await enrolRes.json()) as { yearGroup: string }).yearGroup).toBe("Year 5");
    await expect(page.getByRole("status").filter({ hasText: `${childName} is enrolled` })).toBeVisible({ timeout: 20_000 });

    const card = cardWith(page, childName);
    await expect(card).toContainText("Active", { timeout: 20_000 });
    await expect(card).toContainText(subject);
    await expect(card.locator("[data-year-chip]")).toContainText("Year 5");

    // Row actions live in the card's ⋯ menu (Edit subjects / Pause / Un-enrol).
    await card.getByRole("button", { name: `Actions for ${childName}` }).click();
    await page.getByRole("menuitem", { name: "Pause" }).click();
    await expect(cardWith(page, childName, "Paused")).toBeVisible({ timeout: 20_000 });
    await cardWith(page, childName).getByRole("button", { name: `Actions for ${childName}` }).click();
    await page.getByRole("menuitem", { name: "Resume" }).click();
    await expect(cardWith(page, childName, "Active")).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("a family reads it (the student side)", () => {
  test.use({ storageState: statePath("parent") });
  let noteId = "";

  test.beforeAll(async () => {
    test.setTimeout(120_000);
    const t = await token(accounts.freelancer);
    // A draft the family must never see.
    const topics = await apiFetch<{ id: string; subject: string; subtopic: string | null }[]>("/api/learning-hub/topics", t);
    const topic = topics.find((x) => x.subject === subject && x.subtopic === "Quadratics")!;
    await apiPost("/api/learning-hub/notes", t, { topicId: topic.id, title: `Draft ${stamp}`, body: "not yet", published: false, attachments: [] });
    const notes = await apiFetch<{ id: string; title: string }[]>("/api/learning-hub/notes", t);
    noteId = notes.find((n) => n.title === noteTitle)!.id;
  });

  test("sees published notes read-only, never drafts or edit controls", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/custdash/learninghub");
    await expect(page.getByRole("heading", { name: /Teaching Hub|My Classroom/ })).toBeVisible({ timeout: 30_000 });
    const provider = page.getByLabel("Provider");
    if (await provider.isVisible().catch(() => false)) await provider.selectOption(accounts.freelancer.tenantId!);
    // A family with several children picks one in the header (remembered per provider).
    const select = page.getByRole("combobox", { name: "Child" });
    if (await select.isVisible().catch(() => false)) await select.selectOption({ label: childName });
    else if (await page.getByRole("radio", { name: childName }).isVisible().catch(() => false)) await page.getByRole("radio", { name: childName }).click();

    await openNotes(page);
    await revealAll(page);
    await rowOf(page, subject).click();
    await expect(cardWith(page, noteTitle)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(`Draft ${stamp}`)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /New lesson|Add topic|Enrol/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Edit/ })).toHaveCount(0);
    await expect(tabOf(page, /Students/)).toHaveCount(0); // the roster is a tutor's tool
    // The reading view has a worksheet shelf; still no edit / delete.
    await cardWith(page, noteTitle).getByRole("button", { name: noteTitle, exact: true }).click();
    await expect(page.getByRole("link", { name: /worksheet\.pdf/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Edit|Delete/ })).toHaveCount(0);
  });

  test("a family can't write, and can't read a provider it isn't linked to", async () => {
    const p = await token(accounts.parent);
    const q = `?tenantId=${accounts.freelancer.tenantId}`;
    expect((await raw(`/api/learning-hub/topics${q}`, p, { method: "POST", body: JSON.stringify({ subject: "x", topic: "y" }) })).status).toBe(403);
    expect((await raw(`/api/learning-hub/notes/${noteId}${q}`, p, { method: "DELETE" })).status).toBe(403);
    expect((await raw(`/api/learning-hub/topics?tenantId=not-a-real-tenant`, p)).status).toBe(404);
    expect((await raw(`/api/learning-hub/topics`, p)).status).toBe(400);
  });

  test("switching the hub off takes it away from families", async ({ page }) => {
    test.setTimeout(90_000);
    await setHub(accounts.freelancer, false);
    await page.goto("/custdash/learninghub");
    await expect(page.getByText(/isn.t available|None of your providers|turned off/)).toBeVisible({ timeout: 30_000 });
    const p = await token(accounts.parent);
    const r = await raw(`/api/learning-hub/topics?tenantId=${accounts.freelancer.tenantId}`, p);
    expect(r.status).toBe(403);
    await setHub(accounts.freelancer, true);
  });
});

test.describe("a staff member authors too", () => {
  test.use({ storageState: statePath("staff") });

  test("staff opens the hub and builds a topic and a note (default staff caps allow it)", async ({ page }) => {
    test.setTimeout(180_000);
    await setHub(accounts.company, true);
    const staffSubject = `Science ${stamp}`;
    const staffNote = `Forces ${stamp}`;
    await page.goto("/staff/learninghub");
    // A new staff account gets a one-off "Welcome to the team" card that covers the page.
    await page.getByRole("button", { name: /^Skip for now/ }).click({ timeout: 20_000 }).catch(() => {});
    await openNotes(page);
    await expect(tabOf(page, /Students/)).toBeVisible(); // tutors get the roster
    await page.locator("#hub-topic-filter").getByRole("button", { name: /Add topic/ }).click();
    await page.getByLabel("Subject", { exact: true }).fill(staffSubject);
    await page.getByLabel("Topic name (e.g. Algebra)").fill("Forces");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(rowOf(page, staffSubject)).toBeVisible({ timeout: 20_000 });
    await rowOf(page, staffSubject).click();
    await page.getByRole("button", { name: /New lesson/ }).first().click();
    await page.getByLabel("Title", { exact: true }).fill(staffNote);
    await page.getByTestId("sb-add-block").click();
    await page.getByTestId("sb-add-text").click();
    await page.getByTestId("sb-block-0").locator("textarea").fill("Newton's laws in brief.");
    await page.getByRole("button", { name: "Save lesson" }).click();
    await expect(cardWith(page, staffNote)).toBeVisible({ timeout: 20_000 });
    await setHub(accounts.company, false);
  });
});

test.describe("tenant isolation", () => {
  test("another provider's tutor sees none of it and can't touch it", async () => {
    await setHub(accounts.company, true);
    const own = await token(accounts.freelancer);
    const other = await token(accounts.company);
    const notes = await apiFetch<{ id: string; title: string }[]>("/api/learning-hub/notes", own);
    const mine = notes.find((n) => n.title === noteTitle)!;
    const topics = await apiFetch<{ id: string; subject: string }[]>("/api/learning-hub/topics", own);
    const topic = topics.find((t) => t.subject === subject)!;

    // Reads: the other tenant's lists don't contain this tenant's rows.
    expect((await apiFetch<{ subject: string }[]>("/api/learning-hub/topics", other)).some((t) => t.subject === subject)).toBe(false);
    expect((await apiFetch<{ title: string }[]>("/api/learning-hub/notes", other)).some((n) => n.title === noteTitle)).toBe(false);

    // Writes by id: a 404 (never a 403 — it must not confirm the id exists).
    const body = JSON.stringify({ topicId: topic.id, title: "hijack", body: "", published: true, attachments: [] });
    expect((await raw(`/api/learning-hub/notes/${mine.id}`, other, { method: "PUT", body })).status).toBe(404);
    expect((await raw(`/api/learning-hub/notes/${mine.id}`, other, { method: "DELETE" })).status).toBe(404);
    expect((await raw(`/api/learning-hub/topics/${topic.id}`, other, { method: "DELETE" })).status).toBe(404);
    // …and a note can't be filed under, or use a file from, another tenant.
    expect((await raw(`/api/learning-hub/notes`, other, { method: "POST", body })).status).toBe(404);

    // Still intact for its owner.
    expect((await apiFetch<{ title: string }[]>("/api/learning-hub/notes", own)).some((n) => n.title === noteTitle)).toBe(true);
    await setHub(accounts.company, false);
  });

  test("a topic with notes can't be deleted", async () => {
    const own = await token(accounts.freelancer);
    const topics = await apiFetch<{ id: string; subject: string; subtopic: string | null }[]>("/api/learning-hub/topics", own);
    const sub = topics.find((t) => t.subject === subject && t.subtopic === "Quadratics")!;
    const r = await raw(`/api/learning-hub/topics/${sub.id}`, own, { method: "DELETE" });
    expect(r.status).toBe(409);
  });
});
