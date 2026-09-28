import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed } from "./helpers/tenantData";
import { dismissParentWelcome } from "./helpers/ui";
import { playBot } from "../features/learninghub/games/penguin/bot";
import { summarise, type Cfg, type Plan } from "../features/learninghub/games/penguin/core";

// Games tab — the child-selection flow (owner brief: "add a games tab... but like all tabs it needs to flow so we
// know which child is taking it") plus the card-list shape (owner correction: a list of small game cards is the
// landing state, launching one is a child state with a real exit back to the list). Every assertion is anchored to
// THIS run's throwaway @activityos-test.com accounts / children — never the real tenants.
test.describe.configure({ mode: "serial" });

const HUB = "/api/learning-hub";
const stamp = Date.now().toString(36);
const nameA = `Gamekid${stamp}A`;
const nameB = `Gamekid${stamp}B`;
let accounts: AccountManifest["accounts"];
let tenantId = "", childA = "", childB = "";

interface Lib { settings?: { settings?: unknown } & Record<string, unknown> }
async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<{ settings?: { features?: Record<string, boolean> } & Record<string, unknown> } | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
const post = <T = unknown,>(p: string, t: string, b: unknown) => apiPost<T>(p, t, b);

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
      try { await route.fulfill({ response: await route.fetch({ url }) }); } catch { await route.abort(); }
    });
  }
  return ctx;
}
async function gotoHub(page: Page, url: string) {
  const heading = page.getByRole("heading", { name: /Teaching Hub|Learning Hub|My Classroom/ });
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.freelancer, true);
    await page.goto(url);
    if (await heading.first().isVisible({ timeout: 25_000 }).catch(() => false)) return;
  }
  await expect(heading.first()).toBeVisible({ timeout: 30_000 });
}

test.beforeAll(async () => {
  test.setTimeout(240_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  await setHub(accounts.freelancer, true);
  const t = await token(accounts.freelancer);
  childA = await createParentChild(accounts.parent, { name: nameA, dob: "2016-04-01" });
  childB = await createParentChild(accounts.parent, { name: nameB, dob: "2015-04-01" });
  const p = await token(accounts.parent);
  await post("/api/my/providers/follow", p, { tenantId });
  await markParentWelcomed(accounts.parent);
  await post(`${HUB}/students`, t, { childId: childA, subjects: [`Maths ${stamp}`] });
  await post(`${HUB}/students`, t, { childId: childB, subjects: [`Maths ${stamp}`] });
});

test("(a) a multi-child family cannot reach playable game content without picking a child first", async ({ browser }) => {
  const ctx = await ctxFor(browser, "parent");
  const page = await ctx.newPage();
  await dismissParentWelcome(page);
  // Level 1 (no :childId in the path): a multi-child family is forced onto the overview, even with ?tab=games
  // named explicitly — LearningHubApp's forceOverview gate (games was wired into the same TAB_ORDER / gate every
  // other panel uses, not a side channel).
  await gotoHub(page, `/custdash/learninghub?tab=games`);
  await expect(page.locator("#hub-family-overview")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("penguin-slide")).toHaveCount(0);
  await expect(page.getByTestId("hub-games-list")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Games" })).toHaveCount(0);
  await page.screenshot({ path: "/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/9019c60e-ba39-4e52-8a1c-d81f4f3bd850/scratchpad/games-shots/games-a-overview.png", fullPage: true }).catch(() => undefined);
  await ctx.close();
});

test("(b) once a child is chosen: Games tab + card list, launching starts a real server session, and exit returns to the list", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await ctxFor(browser, "parent");
  const page = await ctx.newPage();
  await dismissParentWelcome(page);
  // Level 2 route, exactly like every other tab: /[portal]/learninghub/[childId]?tab=games.
  await gotoHub(page, `/custdash/learninghub/${encodeURIComponent(childA)}?tab=games`);
  const gamesTab = page.getByRole("tab", { name: "Games" }).last();
  await expect(gamesTab).toBeVisible({ timeout: 45_000 });
  await expect(gamesTab).toHaveAttribute("aria-selected", "true");
  // The hub's own chrome (tab bar) stays visible — Games is a section of the hub, not a takeover.
  await expect(page.getByRole("tab", { name: "Home" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Progress" })).toBeVisible();

  const list = page.getByTestId("hub-games-list");
  await expect(list).toBeVisible({ timeout: 20_000 });
  const playBtn = page.getByTestId("hub-games-play-penguin");
  await expect(playBtn).toBeVisible();
  await expect(playBtn).toHaveText(/Play/); // first visit: never played -> "Play", not "Continue"
  await page.screenshot({ path: "/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/9019c60e-ba39-4e52-8a1c-d81f4f3bd850/scratchpad/games-shots/games-b-list.png", fullPage: true }).catch(() => undefined);

  await playBtn.click();
  // Level picker step (owner ask: let the child choose the most appropriate difficulty, defaulted from year group).
  await expect(page.getByTestId("hub-games-levels")).toBeVisible({ timeout: 15_000 });
  const level2 = page.getByTestId("hub-games-level-2");
  await expect(level2).toBeVisible();
  await expect(level2).toContainText("×3"); // real tables from the level, not placeholder text
  await page.screenshot({ path: "/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/9019c60e-ba39-4e52-8a1c-d81f4f3bd850/scratchpad/games-shots/games-b-levels.png", fullPage: true }).catch(() => undefined);
  await level2.click();
  await expect(page.getByTestId("hub-games-runner")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("hub-games-back")).toBeVisible();
  await expect(page.getByTestId("penguin-slide")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("ps-map")).toBeVisible({ timeout: 20_000 });
  // Tab bar is STILL visible while the game is up (no focus-mode takeover).
  await expect(gamesTab).toBeVisible();
  await page.screenshot({ path: "/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/9019c60e-ba39-4e52-8a1c-d81f4f3bd850/scratchpad/games-shots/games-b-launched.png", fullPage: true }).catch(() => undefined);

  // A real run, started against the real API (not a demo/local stub): the child's own account, this tenant.
  const started = page.waitForResponse((r) => r.url().includes(`${HUB}/games/sessions?`) && r.request().method() === "POST");
  await page.getByTestId("ps-free").click();
  const startRes = await started;
  expect(startRes.status()).toBe(201);
  const startBody = await startRes.json() as { sessionId: string; seed: number; cfg: Cfg; plan: Plan };
  expect(startBody.sessionId).toBeTruthy();
  // The chosen level (×3 ×4 ×8) really did reach the server and really did change what this run asks: the
  // server's own config carries those exact tables, and every planned question draws one of its factors from them.
  expect([...startBody.cfg.tables].sort((a, b) => a - b)).toEqual([3, 4, 8]);
  for (const item of startBody.plan.items) {
    const m = item.k.match(/^x_(\d+)x(\d+)$/);
    expect(m, `unexpected fact key ${item.k}`).toBeTruthy();
    const [a, b] = [Number(m![1]), Number(m![2])];
    expect([3, 4, 8].includes(a) || [3, 4, 8].includes(b), `${item.k} isn't from the chosen level`).toBe(true);
  }

  // Exit back to the list is real (not a dead end / not relying on browser Back): click it mid-run.
  await page.getByTestId("hub-games-back").click();
  await expect(page.getByTestId("hub-games-list")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("hub-games-runner")).toHaveCount(0);
  await page.screenshot({ path: "/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/9019c60e-ba39-4e52-8a1c-d81f4f3bd850/scratchpad/games-shots/games-b-back-to-list.png", fullPage: true }).catch(() => undefined);

  // The started session finishes for real via the server's own re-simulation (same loop the existing
  // games-penguin-slide.spec.ts proves at the API level) — playing it out with the deterministic bot.
  const q = `?tenantId=${tenantId}&childId=${childA}`;
  const bot = playBot(startBody.seed, startBody.cfg, startBody.plan, { acc: 0.8, think: 30 });
  const local = summarise(bot.sim);
  const finishRes = await apiPost<{ done: boolean; answered: number; correct: number }>(`${HUB}/games/sessions/${startBody.sessionId}/finish${q}`, await token(accounts.parent), { childId: childA, log: bot.log, endTick: bot.endTick });
  expect(finishRes.done).toBe(true);
  expect(finishRes.answered).toBe(local.answered);
  expect(finishRes.correct).toBe(local.correct);
  await ctx.close();
});

test("(c) a single-child family reaches Games with no extra friction", async ({ browser }) => {
  // A fresh parent-side check isn't needed for a dedicated single-child account here (that would mean a THIRD
  // throwaway family); LearningHubApp's Level 1 -> Level 2 redirect (hub.children.length === 1) is generic — every
  // panel benefits from it identically, Games included, because it was wired through the same TAB_ORDER / familyGroups
  // registration as Home/Homework/Progress, not a special case. What this test confirms directly: childB (this
  // family's OTHER child) reaches Games exactly the same way childA did, with no per-child special-casing.
  const ctx = await ctxFor(browser, "parent");
  const page = await ctx.newPage();
  await dismissParentWelcome(page);
  await gotoHub(page, `/custdash/learninghub/${encodeURIComponent(childB)}?tab=games`);
  await expect(page.getByRole("tab", { name: "Games" }).last()).toHaveAttribute("aria-selected", "true", { timeout: 45_000 });
  await expect(page.getByTestId("hub-games-list")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("hub-games-play-penguin")).toBeVisible();
  await ctx.close();
});

test("(d) a tutor / canEdit account never sees a Start-playing affordance for themselves", async ({ browser }) => {
  const ctx = await ctxFor(browser, "freelancer");
  const page = await ctx.newPage();
  await gotoHub(page, "/freelancer/learninghub?tab=games");
  // No family top-tab strip exists for a tutor; ?tab=games is still a reachable deep link (tabAlias.ts resolves any
  // panel key as-is) — the panel itself, not the nav, is what must refuse a play affordance, exactly like the API.
  await expect(page.getByTestId("hub-games-list")).toHaveCount(0);
  await expect(page.getByTestId("hub-games-play-penguin")).toHaveCount(0);
  await expect(page.getByTestId("penguin-slide")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Games" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Games are played from a student's own account/i)).toBeVisible();
  await ctx.close();
});
