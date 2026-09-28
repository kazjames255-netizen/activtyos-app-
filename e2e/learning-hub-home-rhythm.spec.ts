import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, provisionLiveListing } from "./helpers/tenantData";

// Learning Hub — tutor Home "Weekly rhythm": the glass-capsule chart. One quiz is handed in TODAY by this
// run's own child, so today's capsule carries a count ≥ 1. Checks: 14 capsules, an accessible name on each
// (day + hand-ins), the floating tooltip on hover and on keyboard focus, and the table alternative + back.

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const subject = `Rhythm ${stamp}`;
const childName = `Rhythmkid${stamp}`;
const quizTitle = `Rhythm quiz ${stamp}`;
const HUB = "/api/learning-hub";

let accounts: AccountManifest["accounts"];
let childId = "", tenantId = "";

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
/** The dev API can restart under a run — ride out network failures only. */
async function net<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= 6 || !(e instanceof TypeError)) throw e;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
const post = <T = unknown,>(p: string, t: string, b: unknown) => net(() => apiPost<T>(p, t, b));
const token = async (a: TestAccount) => (await net(() => fbSignIn(a.email))).idToken;
async function setHub(op: TestAccount, on: boolean) {
  await net(async () => {
    const s = await fbSignIn(op.email);
    const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
    const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
    await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
  });
}
const envApi = (() => {
  try {
    const m = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/^NEXT_PUBLIC_API_URL=(.*)$/m);
    return m?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  } catch { return ""; }
})();
async function tutorCtx(browser: Browser) {
  const ctx = await browser.newContext({ storageState: statePath("freelancer") });
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
async function gotoTutorHome(page: Page) {
  const heading = page.getByRole("heading", { name: /Teaching Hub|Learning Hub|My Classroom/ });
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto("/freelancer/learninghub");
    if (await heading.first().isVisible({ timeout: 25_000 }).catch(() => false)) break;
  }
  await expect(page.locator("#hub-home-tutor")).toBeVisible({ timeout: 45_000 });
}

test.beforeAll(async () => {
  test.setTimeout(240_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  await setHub(accounts.freelancer, true);
  await net(() => provisionLiveListing(accounts.freelancer, { title: `E2E Rhythm ${stamp}`, price: 0 }));
  childId = await net(() => createParentChild(accounts.parent, { name: childName }));
  const t = await token(accounts.freelancer);
  const p = await token(accounts.parent);
  await post("/api/my/providers/follow", p, { tenantId });
  await post(`${HUB}/students`, t, { childId, subjects: [subject] });
  const topic = await post<{ id: string }>(`${HUB}/topics`, t, { subject, topic: "Rhythm" });
  const opts = [{ id: "a", text: "Right" }, { id: "b", text: "Wrong" }];
  const qids: string[] = [];
  for (let i = 1; i <= 2; i++) qids.push((await post<{ id: string }>(`${HUB}/questions`, t, { topicId: topic.id, kind: "single", prompt: `Rhythm question ${i} ${stamp}`, options: opts, answer: "a", marks: 1 })).id);
  const quiz = await post<{ id: string }>(`${HUB}/assessments`, t, { type: "quiz", title: quizTitle, subject, topicIds: [topic.id], questionIds: qids, timeLimitMins: null, published: true });
  const qp = `?tenantId=${tenantId}&childId=${childId}`;
  const start = await post<{ attemptId: string; questions: { id: string }[] }>(`${HUB}/assessments/${quiz.id}/attempts${qp}`, p, {});
  await post(`${HUB}/attempts/${start.attemptId}/submit${qp}`, p, { answers: start.questions.map((x) => ({ questionId: x.id, response: "a" })) });
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); });

test("tutor Home: weekly rhythm is 14 glass capsules with names, a tooltip and a table view", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await tutorCtx(browser);
  const page = await ctx.newPage();
  await gotoTutorHome(page);

  const chart = page.getByTestId("hub-home-rhythm");
  await expect(chart).toBeVisible({ timeout: 45_000 });
  const group = page.getByRole("group", { name: /Weekly rhythm/ });
  await expect(group.first()).toBeVisible();

  // 14 days, each capsule named "<day> <date> · N hand-in(s)"; today (the last one) holds this run's hand-in.
  const caps = chart.getByTestId("hub-home-rhythm-capsule");
  await expect(caps).toHaveCount(14);
  const today = caps.nth(13);
  await expect(today).toHaveAttribute("aria-label", /hand-in/);
  expect(Number(await today.getAttribute("data-count"))).toBeGreaterThanOrEqual(1);

  // Hover shows the floating tooltip with that capsule's day and count.
  await today.hover();
  const tip = page.getByTestId("hub-home-rhythm-tip");
  await expect(tip).toBeVisible();
  await expect(tip).toHaveText(/hand-in/);
  await page.mouse.move(0, 0);
  await expect(tip).toBeHidden();

  // Keyboard: focusing a capsule shows the same tooltip.
  await caps.nth(12).focus();
  await expect(tip).toBeVisible();
  await caps.nth(12).blur();

  // Table alternative and back to the capsules.
  await page.getByTestId("hub-home-rhythm-toggle").click();
  await expect(page.getByTestId("hub-home-rhythm-table")).toBeVisible();
  await expect(page.getByRole("table").filter({ hasText: "Count" })).toBeVisible();
  await expect(caps).toHaveCount(0);
  await page.getByTestId("hub-home-rhythm-toggle").click();
  await expect(caps).toHaveCount(14);
  await ctx.close();
});
