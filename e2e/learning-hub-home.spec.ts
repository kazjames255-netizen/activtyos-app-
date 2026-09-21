import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { cardWith, dismissParentWelcome } from "./helpers/ui";

// Learning Hub — the Home tab (first tab, default for both audiences): a tutor
// sees their day (attention tiles, class snapshot, recent activity), a family
// sees a warm daily view for the chosen child (greeting, next lesson, flashcards,
// homework, results) and every card jumps to the right tab. Every state assertion
// is anchored to THIS run's stamped child / quiz / homework / lesson names.

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const subject = `Home ${stamp}`;
const childName = `Homekid${stamp}`;
const blankName = `Blankkid${stamp}`;
const quizTitle = `Home quiz ${stamp}`;
const hwTitle = `Home homework ${stamp}`;
const lessonTitle = `Home lesson ${stamp}`;
const HUB = "/api/learning-hub";

let accounts: AccountManifest["accounts"];
let childId = "", blankId = "", tenantId = "";

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
/** The dev API hot-reloads whenever anyone saves a server file — ride out a restart (network failures only). */
async function net<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= 6 || !(e instanceof TypeError)) throw e;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
const post = <T = unknown,>(p: string, t: string, b: unknown) => net(() => apiPost<T>(p, t, b));
async function setHub(op: TestAccount, on: boolean) { await net(() => setHubOnce(op, on)); }
async function setHubOnce(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
const token = async (a: TestAccount) => (await net(() => fbSignIn(a.email))).idToken;
const tabOf = (page: Page, name: RegExp) => page.getByRole("tab", { name });

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
  test.setTimeout(240_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  await setHub(accounts.freelancer, true);
  await net(() => provisionLiveListing(accounts.freelancer, { title: `E2E Home ${stamp}`, price: 0 }));
  childId = await net(() => createParentChild(accounts.parent, { name: childName }));
  blankId = await net(() => createParentChild(accounts.parent, { name: blankName }));
  const t = await token(accounts.freelancer);
  const p = await token(accounts.parent);
  await post("/api/my/providers/follow", p, { tenantId });
  await net(() => markParentWelcomed(accounts.parent));
  await post(`${HUB}/students`, t, { childId, subjects: [subject] });
  await post(`${HUB}/students`, t, { childId: blankId, subjects: [subject] });
  const topic = await post<{ id: string }>(`${HUB}/topics`, t, { subject, topic: "Fractions" });
  for (const [front, back] of [["1/2 + 1/2", "1"], ["3/4 − 1/4", "1/2"], ["Simplify 4/8", "1/2"]]) {
    await post(`${HUB}/flashcards`, t, { topicId: topic.id, front: `${front} (${stamp})`, back, published: true });
  }
  const opts = [{ id: "a", text: "Right" }, { id: "b", text: "Wrong" }];
  const qids: string[] = [];
  for (let i = 1; i <= 2; i++) qids.push((await post<{ id: string }>(`${HUB}/questions`, t, { topicId: topic.id, kind: "single", prompt: `Home question ${i} ${stamp}`, options: opts, answer: "a", marks: 1 })).id);
  const quiz = await post<{ id: string }>(`${HUB}/assessments`, t, { type: "quiz", title: quizTitle, subject, topicIds: [topic.id], questionIds: qids, timeLimitMins: null, published: true });
  // The child sits the quiz and gets everything right → a 100% result, a mastery cell, an activity row.
  const qp = `?tenantId=${tenantId}&childId=${childId}`;
  const start = await post<{ attemptId: string; questions: { id: string }[] }>(`${HUB}/assessments/${quiz.id}/attempts${qp}`, p, {});
  await post(`${HUB}/attempts/${start.attemptId}/submit${qp}`, p, { answers: start.questions.map((x) => ({ questionId: x.id, response: "a" })) });
  await post(`${HUB}/homework`, t, { title: hwTitle, instructions: "Show your working.", assignedChildIds: [childId], dueAt: new Date(Date.now() + 20 * 3_600_000).toISOString() });
  await post(`${HUB}/lessons`, t, { title: lessonTitle, childIds: [childId], startsAt: new Date(Date.now() + 3 * 3_600_000).toISOString(), durationMins: 45, topicId: topic.id, notes: "" });
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); }); // other specs toggle the hub on this account
test.afterAll(async () => { /* leave the hub on: the standing account is shared with the other hub specs */ });

async function gotoHub(page: Page, url: string) {
  const heading = page.getByRole("heading", { name: /Teaching Hub|My Classroom/ });
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto(url);
    if (await heading.first().isVisible({ timeout: 25_000 }).catch(() => false)) return;
  }
  await expect(heading.first()).toBeVisible({ timeout: 30_000 });
}
async function openParentHome(page: Page, name: string) {
  await dismissParentWelcome(page);
  await gotoHub(page, "/custdash/learninghub");
  const provider = page.getByLabel("Provider");
  if (await provider.isVisible().catch(() => false)) await provider.selectOption(tenantId);
  const select = page.getByRole("combobox", { name: "Child" });
  if (await select.isVisible().catch(() => false)) await select.selectOption({ label: name });
  else await page.getByRole("radio", { name }).click();
  await expect(page.locator("#hub-home-student")).toBeVisible({ timeout: 45_000 });
}

test("tutor: Home is the first, default tab and reflects this run's work", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await ctxFor(browser, "freelancer");
  const page = await ctx.newPage();
  await gotoHub(page, "/freelancer/learninghub");
  const tabs = page.getByRole("tablist", { name: "Sections", exact: true }).getByRole("tab");
  await expect(tabs.first()).toHaveText(/Home/);
  await expect(page.getByRole("tab", { name: "Home", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#hub-home-tutor")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("heading", { name: "Needs your attention" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Homework to mark/ })).toBeVisible();

  // Class snapshot: this run's child appears with a 100% cell for this run's subject.
  await expect(page.getByRole("img", { name: new RegExp(`${childName}, ${subject}: 100 percent`) })).toBeVisible({ timeout: 45_000 });
  // Recent activity: the child's quiz result, anchored to this run's quiz title.
  await expect(cardWith(page, "Recent activity", `scored 100% on ${quizTitle}`)).toBeVisible({ timeout: 45_000 });

  // The weekly rhythm chart has a text alternative and a table view.
  await expect(page.getByRole("img", { name: /Weekly rhythm/ }).first()).toBeVisible();
  await page.getByRole("button", { name: "Show as table" }).click();
  await expect(page.getByRole("table").filter({ hasText: "Count" })).toBeVisible();

  // Quick actions jump to the right tab.
  await page.getByRole("button", { name: /Assign homework Set the next task/ }).click();
  await expect(tabOf(page, /^Homework$/)).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Home", exact: true }).click();
  await expect(page.locator("#hub-home-tutor")).toBeVisible();
  await page.getByRole("button", { name: /Schedule video lesson Pick a time/ }).click();
  await expect(tabOf(page, /^Live lessons/)).toHaveAttribute("aria-selected", "true");
  await ctx.close();
});

test("family: warm Home for the chosen child, cards jump to the right tab", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await ctxFor(browser, "parent");
  const page = await ctx.newPage();
  await openParentHome(page, childName);
  await expect(page.getByRole("tab", { name: "Home", exact: true })).toHaveAttribute("aria-selected", "true");
  const home = page.locator("#hub-home-student");
  await expect(home.getByRole("heading", { name: new RegExp(`${childName}\\.`) })).toBeVisible();
  // Next lesson (only lesson this child has), homework due soon, latest result ring — all anchored to this run.
  await expect(cardWith(page, lessonTitle)).toBeVisible({ timeout: 45_000 });
  await expect(home.getByRole("button", { name: new RegExp(`${hwTitle}\\. Due`) })).toBeVisible({ timeout: 45_000 });
  await expect(home.getByRole("img", { name: new RegExp(`${quizTitle}: 100 percent`) }).first()).toBeVisible({ timeout: 45_000 });
  await expect(home.getByText(/1 active day in 2 weeks|-day streak/)).toBeVisible();

  await home.getByRole("button", { name: "Review flashcards now" }).click();
  await expect(tabOf(page, /^Flashcards/)).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Home", exact: true }).click();
  await home.getByRole("button", { name: /See progress/ }).click();
  await expect(tabOf(page, /^Progress/)).toHaveAttribute("aria-selected", "true");
  await ctx.close();
});

test("family: a child with no activity gets inviting empty states, not blanks", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await ctxFor(browser, "parent");
  const page = await ctx.newPage();
  await openParentHome(page, blankName);
  const home = page.locator("#hub-home-student");
  await expect(home.getByRole("heading", { name: new RegExp(`${blankName}\\.`) })).toBeVisible();
  await expect(home.getByText("No results yet")).toBeVisible({ timeout: 45_000 });
  await expect(home.getByText("Mastery builds with every quiz")).toBeVisible();
  await expect(home.getByText("Start a streak today")).toBeVisible();
  await ctx.close();
});
