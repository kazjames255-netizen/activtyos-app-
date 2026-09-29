import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { tabOf } from "./helpers/hubTabs";

// Tutor Home — Student snapshot: "Needs help first" (a to-do list of the lowest-mastery children, one tap opens
// that child's progress; children with no results are a calm "Not started yet" line, never "needs help") above
// the class grid, which is sorted lowest overall first with not-started children last. Every state assertion is
// anchored to THIS run's stamped children / subject / quiz (the standing tenant holds other specs' children too).

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const subject = `Snap ${stamp}`;
const lowName = `Lowkid${stamp}`;
const okName = `Okkid${stamp}`;
const blankName = `Blanksnap${stamp}`;
const quizTitle = `Snap quiz ${stamp}`;
const HUB = "/api/learning-hub";

let accounts: AccountManifest["accounts"];
let lowId = "", okId = "", blankId = "", tenantId = "";

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
/** The dev API can restart under us — ride out network failures only. */
async function net<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= 6 || !(e instanceof TypeError)) throw e;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
const post = <T = unknown,>(p: string, t: string, b: unknown) => net(() => apiPost<T>(p, t, b));
async function setHub(op: TestAccount, on: boolean) {
  await net(async () => {
    const s = await fbSignIn(op.email);
    const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
    const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
    await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
  });
}
const token = async (a: TestAccount) => (await net(() => fbSignIn(a.email))).idToken;

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

test.beforeAll(async () => {
  test.setTimeout(240_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  await setHub(accounts.freelancer, true);
  await net(() => provisionLiveListing(accounts.freelancer, { title: `E2E Snap ${stamp}`, price: 0 }));
  lowId = await net(() => createParentChild(accounts.parent, { name: lowName }));
  okId = await net(() => createParentChild(accounts.parent, { name: okName }));
  blankId = await net(() => createParentChild(accounts.parent, { name: blankName }));
  const t = await token(accounts.freelancer);
  const p = await token(accounts.parent);
  await post("/api/my/providers/follow", p, { tenantId });
  await net(() => markParentWelcomed(accounts.parent));
  for (const id of [lowId, okId, blankId]) await post(`${HUB}/students`, t, { childId: id, subjects: [subject] });
  const topic = await post<{ id: string }>(`${HUB}/topics`, t, { subject, topic: "Snapshots" });
  const opts = [{ id: "a", text: "Right" }, { id: "b", text: "Wrong" }];
  const qids: string[] = [];
  for (let i = 1; i <= 2; i++) qids.push((await post<{ id: string }>(`${HUB}/questions`, t, { topicId: topic.id, kind: "single", prompt: `Snap question ${i} ${stamp}`, options: opts, answer: "a", marks: 1 })).id);
  const quiz = await post<{ id: string }>(`${HUB}/assessments`, t, { type: "quiz", title: quizTitle, subject, topicIds: [topic.id], questionIds: qids, timeLimitMins: null, published: true });
  // The low child gets everything wrong (0%), the ok child everything right (100%), the blank child sits nothing.
  for (const [id, answer] of [[lowId, "b"], [okId, "a"]] as const) {
    const qp = `?tenantId=${tenantId}&childId=${id}`;
    const start = await post<{ attemptId: string; questions: { id: string }[] }>(`${HUB}/assessments/${quiz.id}/attempts${qp}`, p, {});
    await post(`${HUB}/attempts/${start.attemptId}/submit${qp}`, p, { answers: start.questions.map((x) => ({ questionId: x.id, response: answer })) });
  }
});
test.beforeEach(async () => { await setHub(accounts.freelancer, true); });

async function gotoHub(page: Page) {
  const heading = page.getByRole("heading", { name: /Teaching Hub|Learning Hub|My Classroom/ });
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto("/freelancer/learninghub");
    if (await heading.first().isVisible({ timeout: 25_000 }).catch(() => false)) return;
  }
  await expect(heading.first()).toBeVisible({ timeout: 30_000 });
}

test("tutor Home: one grid — a low child's row is red-outlined with a ringed weakest subject and a 'why' line; a child with no results is a calm 'Not started yet' line", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await tutorCtx(browser);
  const page = await ctx.newPage();
  await gotoHub(page);
  await expect(page.locator("#hub-home-tutor")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("snapshot-needs-help")).toHaveCount(0); // one component: no separate list
  await expect(page.getByTestId("snapshot-help-count")).toContainText(/Need help: \d+/, { timeout: 45_000 });

  const low = page.locator(`[data-testid="snapshot-row"][data-child="${lowId}"]`);
  await expect(low).toBeVisible({ timeout: 45_000 });
  await expect(low).toContainText(lowName);
  await expect(low).toHaveAttribute("data-help", "red"); // 0% is under 40 → red
  await expect(low.getByTestId("snapshot-why")).toHaveText(`${subject} 0% needs help`);
  // The weakest subject cell carries the ring + ▼ in the row's own tone (red here), and the row's Open button says who and why.
  await expect(low.locator('[data-weakest="red"]')).toHaveAccessibleName(new RegExp(`${lowName}, ${subject}: 0 percent`));
  await expect(low.getByTestId("snapshot-open")).toHaveAccessibleName(new RegExp(`Open progress for ${lowName}: ${subject} 0%`));

  // The 100% child has a row with an Open button, no highlight, no why line.
  const ok = page.locator(`[data-testid="snapshot-row"][data-child="${okId}"]`);
  await expect(ok).toBeVisible();
  await expect(ok).not.toHaveAttribute("data-help", /.+/);
  await expect(ok.getByTestId("snapshot-why")).toHaveCount(0);
  await expect(ok.getByTestId("snapshot-open")).toBeVisible();

  // The blank child is NOT a row: it is one clickable first name in the dashed line, with the comma OUTSIDE the button (no stray space).
  await expect(page.locator(`[data-testid="snapshot-row"][data-child="${blankId}"]`)).toHaveCount(0);
  const line = page.getByTestId("snapshot-not-started");
  await expect(line).toContainText("Not started yet:");
  await expect(line.locator(`[data-child="${blankId}"]`)).toHaveText(blankName); // the stamped name has no space, so its first name is the whole name
  expect(await line.innerText()).not.toMatch(/\s,/);
  await ctx.close();
});

test("tutor Home: ONE need score orders and highlights (never a highlighted row below an unhighlighted one); bands stay inside the card; avatars line up", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await tutorCtx(browser);
  const page = await ctx.newPage();
  await gotoHub(page);
  await expect(page.locator(`[data-testid="snapshot-row"][data-child="${lowId}"]`)).toBeVisible({ timeout: 45_000 });

  const rows = await page.locator('[data-testid="snapshot-row"]').evaluateAll((els) => els.map((r) => ({ id: (r as HTMLElement).dataset.child, help: (r as HTMLElement).dataset.help ?? "", right: r.getBoundingClientRect().right, avatarX: r.querySelector('[data-testid="snapshot-accent"]')!.getBoundingClientRect().x })));
  // Once an unhighlighted row appears, no highlighted row may follow.
  const firstPlain = rows.findIndex((r) => !r.help);
  if (firstPlain >= 0) expect(rows.slice(firstPlain).every((r) => !r.help)).toBe(true);
  // This run's children keep the order low -> ok (other specs' children may interleave).
  const ids = rows.map((r) => r.id);
  expect(ids.indexOf(lowId)).toBeGreaterThanOrEqual(0);
  if (ids.indexOf(okId) >= 0) expect(ids.indexOf(lowId)).toBeLessThan(ids.indexOf(okId));
  // The accent bar (and so the avatar after it) sits at the same x in EVERY row, highlighted or not.
  expect(new Set(rows.map((r) => Math.round(r.avatarX))).size).toBe(1);
  // No row band overflows the card: every row's right edge is inside the snapshot card.
  const cardRight = await page.locator("#hub-home-tutor").getByTestId("snapshot-row").first().evaluate((el) => (el.closest('[data-ui="card"]') ?? el.parentElement!.parentElement!).getBoundingClientRect().right);
  for (const r of rows) expect(r.right).toBeLessThanOrEqual(cardRight + 1);
  await ctx.close();
});

test("tutor Home: one tap on Open (or a not-started name) opens that child's progress", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await tutorCtx(browser);
  const page = await ctx.newPage();
  await gotoHub(page);
  await expect(page.locator(`[data-testid="snapshot-row"][data-child="${lowId}"]`)).toBeVisible({ timeout: 45_000 });

  await page.locator(`[data-testid="snapshot-open"][data-child="${lowId}"]`).click();
  await expect(tabOf(page, /^Progress/)).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });
  // :visible filters out the (hidden) child-picker <option> sharing this name — an unscoped
  // getByText(lowName).first() can pick that DOM node over the actual on-screen text, and the
  // Progress panel has two possible layouts (empty-state vs "hub-progress") so this can't be
  // scoped to a single container either.
  await expect(page.locator(`:visible:text("${lowName}")`).first()).toBeVisible({ timeout: 30_000 });

  await page.getByRole("tab", { name: "Home", exact: true }).click();
  await page.locator(`[data-testid="snapshot-not-started-open"][data-child="${blankId}"]`).click();
  await expect(tabOf(page, /^Progress/)).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });
  await ctx.close();
});
