import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { dismissParentWelcome } from "./helpers/ui";

// Teaching Hub — subject colours. Every standard subject wears its own colour, the tutor can choose a subject's colour from its ⋯ menu,
// and EVERY card / chip / tile for that subject changes with it — for the tutor, after a reload, and for the family's My Classroom.
// State assertions read the computed colour of THIS run's subject (data-subject-tile / data-subject-cover carry the subject name).

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const subject = `Colours ${stamp}`;
const childName = `Colourkid ${stamp}`;
const quizTitle = `Colour quiz ${stamp}`;
const ORANGE = "rgb(234, 88, 12)"; // palette "orange" (features/learninghub/subjectColour.ts)
const PURPLE = "rgb(124, 58, 237)"; // palette "purple"

let accounts: AccountManifest["accounts"];

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
const tabOf = (page: Page, name: RegExp) => page.getByRole("tab", { name });

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

async function gotoHub(page: Page, url: string) {
  const heading = page.getByRole("heading", { name: /Teaching Hub|My Classroom/ });
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto(url);
    if (await heading.first().isVisible({ timeout: 25_000 }).catch(() => false)) return;
  }
  await expect(heading.first()).toBeVisible({ timeout: 30_000 });
}
async function openTutorQuizzes(page: Page) {
  await gotoHub(page, "/freelancer/learninghub");
  await expect(tabOf(page, /Quizzes/)).toBeVisible({ timeout: 30_000 });
  await tabOf(page, /Quizzes/).click();
  await expect(page.locator(`[data-subject-tile="${subject}"]`).first()).toBeAttached({ timeout: 30_000 });
}
/** The colour a subject's tile / cover is drawn in right now (a resolved rgb string). */
const tileColour = (page: Page, s: string) => page.locator(`[data-subject-tile="${s}"]`).first().evaluate((e) => getComputedStyle(e).color);
const coverColour = (page: Page, s: string) => page.locator(`[data-subject-cover="${s}"]`).first().evaluate((e) => getComputedStyle(e).color);

test.beforeAll(async () => {
  test.setTimeout(240_000);
  accounts = loadAccounts().accounts;
  await setHub(accounts.freelancer, true);
  const t = await token(accounts.freelancer);
  // The standard subjects (may already exist on this standing tenant), plus this run's own.
  for (const s of ["Maths", "English", "Science", "French", "Spanish", "German"]) await apiPost("/api/learning-hub/topics", t, { subject: s, topic: `Colours ${s}` }).catch(() => undefined);
  await apiPost("/api/learning-hub/topics", t, { subject, topic: "Shades" });
  const topics = await apiFetch<{ id: string; subject: string }[]>("/api/learning-hub/topics", t);
  const topicId = topics.find((x) => x.subject === subject)!.id;
  const q = await apiPost<{ id: string }>("/api/learning-hub/questions", t, { topicId, kind: "short", prompt: `Name a primary colour (${stamp})`, answer: "red", marks: 1 });
  await apiPost("/api/learning-hub/assessments", t, { type: "quiz", title: quizTitle, subject, topicIds: [topicId], questionIds: [q.id], timeLimitMins: null, passMarkPct: 50, published: true });
  // A family enrolled for this subject, to read the same colours through My Classroom.
  const listing = await provisionLiveListing(accounts.freelancer, { title: `E2E Colour Tuition ${stamp}`, price: 0 });
  const childId = await createParentChild(accounts.parent, { name: childName });
  await bookViaApi(accounts.parent, listing, { child: childName, dates: [listing.runFrom] }).catch((e) => { if (!/clash|existing booking/i.test(String(e))) throw e; });
  await markParentWelcomed(accounts.parent);
  await apiPost("/api/learning-hub/students", t, { childId, subjects: [subject] });
  await apiFetch("/api/learning-hub/config", t, { method: "PUT", body: JSON.stringify({ hub: { subjectColours: {} } }) }); // start from the defaults
});
test.afterAll(async () => {
  try { await apiFetch("/api/learning-hub/config", await token(accounts.freelancer), { method: "PUT", body: JSON.stringify({ hub: { subjectColours: {} } }) }); } catch { /* best effort */ }
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); });

test("the standard subjects each wear a different colour", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await ctxFor(browser, "freelancer");
  const page = await ctx.newPage();
  await openTutorQuizzes(page);
  const names = ["Maths", "English", "Science", "French", "Spanish", "German"];
  const seen = new Map<string, string>();
  for (const n of names) {
    await expect(page.locator(`[data-subject-tile="${n}"]`).first()).toBeAttached({ timeout: 30_000 });
    seen.set(n, await tileColour(page, n));
  }
  expect(new Set(seen.values()).size, `colours: ${JSON.stringify([...seen])}`).toBe(names.length);
  await ctx.close();
});

test("the tutor picks a subject's colour from its menu and every card for it changes", async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = await ctxFor(browser, "freelancer");
  const page = await ctx.newPage();
  await openTutorQuizzes(page);
  const before = await tileColour(page, subject);
  expect(before).not.toBe(ORANGE);
  const cover0 = await coverColour(page, subject);
  expect(cover0).toBe(before); // the quiz card's cover and the chip's tile are one colour

  // Pick the subject's chip first so its row is always listed in the sheet (a long subject list is capped).
  await page.getByRole("group", { name: "Filter by subject" }).getByRole("button", { name: subject }).click();
  // ⋯ menu on the subject (in the Manage topics sheet) -> Subject colour -> Orange.
  await page.getByRole("button", { name: /Manage topics/ }).click();
  await page.getByRole("button", { name: `Actions for ${subject}` }).click();
  await page.getByRole("menuitem", { name: "Subject colour" }).click();
  const dlg = page.locator("#hub-subject-colour");
  await expect(dlg).toBeVisible();
  const saved = page.waitForResponse((r) => r.url().includes("/api/learning-hub/config") && r.request().method() === "PUT");
  await dlg.getByRole("radio", { name: "Orange" }).click();
  expect((await saved).ok()).toBeTruthy();
  await expect(dlg.getByRole("radio", { name: "Orange" })).toHaveAttribute("aria-checked", "true");
  await dlg.getByRole("button", { name: "Done" }).click();
  await page.keyboard.press("Escape"); // the Manage topics sheet

  await expect.poll(() => tileColour(page, subject), { timeout: 15_000 }).toBe(ORANGE);
  expect(await coverColour(page, subject)).toBe(ORANGE);
  // Another subject is untouched.
  expect(await tileColour(page, "Maths")).not.toBe(ORANGE);

  // It's stored on the tenant, and survives a reload.
  const t = await token(accounts.freelancer);
  const cfg = await apiFetch<{ hub: { subjectColours: Record<string, string> } }>("/api/learning-hub/config", t);
  expect(cfg.hub.subjectColours[subject.toLowerCase()]).toBe("orange");
  await page.reload();
  await expect(tabOf(page, /Quizzes/)).toBeVisible({ timeout: 30_000 });
  await tabOf(page, /Quizzes/).click();
  await expect(page.locator(`[data-subject-tile="${subject}"]`).first()).toBeAttached({ timeout: 30_000 });
  await expect.poll(() => tileColour(page, subject), { timeout: 15_000 }).toBe(ORANGE);
  await expect(page.locator(`[data-subject-cover="${subject}"]`).first()).toBeAttached({ timeout: 15_000 });
  expect(await coverColour(page, subject)).toBe(ORANGE);
  await ctx.close();
});

test("the server only accepts colours from the palette", async () => {
  const t = await token(accounts.freelancer);
  const put = (body: unknown) => fetch(`${API_URL}/api/learning-hub/config`, { method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${t}` }, body: JSON.stringify(body) });
  expect((await put({ hub: { subjectColours: { [subject]: "hotpink" } } })).status).toBe(400);
  expect((await put({ hub: { subjectColours: { [subject]: "#ff0000" } } })).status).toBe(400);
  expect((await put({ hub: { subjectColours: ["blue"] } })).status).toBe(400);
  const cfg = await apiFetch<{ hub: { subjectColours: Record<string, string> } }>("/api/learning-hub/config", t);
  expect(cfg.hub.subjectColours[subject.toLowerCase()]).toBe("orange"); // untouched by the refused writes
});

test("a family sees the tutor's colour in My Classroom, and a change reaches them", async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = await ctxFor(browser, "parent");
  const page = await ctx.newPage();
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
  await expect(tabOf(page, /Quizzes/)).toBeVisible({ timeout: 30_000 });
  await tabOf(page, /Quizzes/).click();
  await expect(page.locator(`[data-subject-tile="${subject}"]`).first()).toBeAttached({ timeout: 30_000 });
  await expect.poll(() => tileColour(page, subject), { timeout: 20_000 }).toBe(ORANGE);

  // The tutor switches it to purple (API, as the tutor would from the menu); the open family page repaints live.
  const t = await token(accounts.freelancer);
  await apiFetch("/api/learning-hub/config", t, { method: "PUT", body: JSON.stringify({ hub: { subjectColours: { [subject.toLowerCase()]: "purple" } } }) });
  await expect.poll(() => tileColour(page, subject), { timeout: 30_000 }).toBe(PURPLE);
  await ctx.close();
});
