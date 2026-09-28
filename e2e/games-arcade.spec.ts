import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { dismissParentWelcome } from "./helpers/ui";
import { playBot } from "../features/learninghub/games/penguin/bot";
import { replay, summarise, type Cfg, type Plan } from "../features/learninghub/games/penguin/core";
import { arcadeDailySeed, arcadeStars, tally } from "../features/learninghub/games/penguin/arcade";

// Penguin Slide ARCADE mode (features/learninghub/games/penguin/arcade.ts): lives, combo scoring, a daily challenge with one seed for everybody, endless.
// The whole point is that none of it is the browser's word: the server replays the input log and folds the SAME rules over the re-simulated results.
// Every assertion is anchored to THIS run's throwaway children / sessions.
test.describe.configure({ mode: "serial" });

const HUB = "/api/learning-hub";
const stamp = Date.now().toString(36);
let accounts: AccountManifest["accounts"];
let tenantId = "";
let kidA = "", kidB = "", kidUi = "";
const token = async (a: TestAccount) => (await fbSignIn(a.email)).idToken;
const q = (childId: string) => `?tenantId=${tenantId}&childId=${childId}`;

interface ArcadeRes { kind: "run" | "daily" | "endless"; score: number; bestCombo: number; lives: number; maxLives: number; over: boolean; correct: number; wrong: number; misses: number; stars: number; newBest: boolean; previousBest: number | null; rows: { ok: boolean; points: number }[] }
interface Started { sessionId: string; seed: number; cfg: Cfg; plan: Plan; arcade?: Record<string, unknown> }
interface Finished { done: boolean; answered: number; correct: number; repeat?: boolean; arcade: ArcadeRes | null }
const start = async (childId: string, mode: string, extra: Record<string, unknown> = {}) => apiPost<Started>(`${HUB}/games/sessions${q(childId)}`, await token(accounts.parent), { childId, mode, ...extra });
const finish = async (childId: string, s: Started, log: unknown, endTick: number) => apiPost<Finished>(`${HUB}/games/sessions/${s.sessionId}/finish${q(childId)}`, await token(accounts.parent), { childId, log, endTick });

async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<{ settings?: { features?: Record<string, boolean> } & Record<string, unknown> } | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
const envApi = (() => { try { const m = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/^NEXT_PUBLIC_API_URL=(.*)$/m); return m?.[1]?.trim().replace(/^["']|["']$/g, "") ?? ""; } catch { return ""; } })();
async function ctxFor(browser: Browser) {
  const ctx = await browser.newContext({ storageState: statePath("parent") });
  if (envApi && envApi !== API_URL) {
    const origin = new URL(envApi).origin;
    await ctx.route((u) => u.origin === origin, async (route) => { try { await route.fulfill({ response: await route.fetch({ url: route.request().url().replace(origin, API_URL) }) }); } catch { await route.abort(); } });
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
  const t = await token(accounts.freelancer), p = await token(accounts.parent);
  await provisionLiveListing(accounts.freelancer, { title: `E2E Arcade ${stamp}`, price: 0 });
  await apiPost("/api/my/providers/follow", p, { tenantId });
  await markParentWelcomed(accounts.parent);
  for (const [n, dob] of [["A", "2016-04-01"], ["B", "2016-06-01"], ["Ui", "2015-04-01"]] as const) {
    const id = await createParentChild(accounts.parent, { name: `Arcadekid${n}${stamp}`, dob });
    await apiPost(`${HUB}/students`, t, { childId: id, subjects: [`Maths ${stamp}`] });
    if (n === "A") kidA = id; else if (n === "B") kidB = id; else kidUi = id;
  }
});

test("an Arcade run: the server issues the rules, replays the log and reports lives, combo, score and stars", async () => {
  test.setTimeout(150_000);
  const s = await start(kidA, "arcade");
  expect(s.cfg.arcade).toMatchObject({ kind: "run", lives: 3, timerSec: 9 });
  expect(s.cfg.approachSec).toBe(9); // the gate clock is on in Arcade
  expect(s.plan.items.length).toBe(20);
  const bot = playBot(s.seed, s.cfg, s.plan, { acc: 1, think: 30 });
  const res = await finish(kidA, s, bot.log, bot.endTick);
  const local = tally(s.cfg.arcade as never, summarise(replay(s.seed, s.cfg, s.plan, bot.log, bot.endTick)).results);
  expect(res.arcade).not.toBeNull();
  expect(res.arcade!.score).toBe(local.score); // computed by the server from its own replay = the same pure rules
  expect(res.arcade!.over).toBe(false);
  expect(res.arcade!.lives).toBe(3);
  expect(res.arcade!.correct).toBe(20);
  expect(res.arcade!.bestCombo).toBe(20);
  expect(res.arcade!.stars).toBe(3);
  expect(res.arcade!.newBest).toBe(true);
  expect(res.arcade!.rows.every((r) => r.ok && r.points >= 10)).toBe(true);
  // idempotent, and a re-finish cannot change the stored score
  const again = await finish(kidA, s, [], 60);
  expect(again.repeat).toBe(true);
  expect(again.arcade!.score).toBe(res.arcade!.score);
  // the personal best is kept on the profile and shown on the map next time
  const j = await apiFetch<{ arcade?: { run?: { score: number } } }>(`${HUB}/games/penguin-slide/journey${q(kidA)}`, await token(accounts.parent));
  expect(j.arcade?.run?.score).toBe(res.arcade!.score);
});

test("Game Over comes from the server's replay: 3 lives, then the run stops counting; a client cannot claim more", async () => {
  test.setTimeout(150_000);
  const s = await start(kidA, "arcade");
  // a child who is wrong every time: the server ends the run at the third miss whatever the log goes on to do
  const bot = playBot(s.seed, s.cfg, s.plan, { acc: 0, think: 30 });
  const res = await finish(kidA, s, bot.log, bot.endTick);
  const a = res.arcade!;
  expect(a.over).toBe(true);
  expect(a.lives).toBe(0);
  expect(a.wrong + a.misses).toBe(3);
  expect(a.score).toBe(0);
  expect(a.stars).toBe(0);
  expect(a.newBest).toBe(false); // 0 is never a "best"
  // mixed play: whatever happens after the last heart is ignored — the server's score is exactly the fold of its own results
  for (let i = 0; i < 3; i++) {
    const m = await start(kidA, "arcade");
    const mixed = playBot(m.seed, m.cfg, m.plan, { acc: 0.6, think: 30, rngSeed: 5 + i });
    const r = await finish(kidA, m, mixed.log, mixed.endTick);
    const t = tally(m.cfg.arcade as never, summarise(replay(m.seed, m.cfg, m.plan, mixed.log, mixed.endTick)).results);
    expect(r.arcade!.score).toBe(t.score);
    expect(r.arcade!.over).toBe(t.over);
    expect(r.arcade!.lives).toBe(t.lives);
    expect(r.arcade!.stars).toBe(arcadeStars(t, m.cfg.n));
  }
});

test("the daily challenge is one fixed seed and plan for every child; endless keeps its own best", async () => {
  test.setTimeout(150_000);
  const a = await start(kidA, "arcade-daily"), b = await start(kidB, "arcade-daily");
  expect(a.cfg.arcade?.kind).toBe("daily");
  expect(a.seed).toBe(b.seed);
  expect(a.plan).toEqual(b.plan); // no personal history in it: everyone gets today's questions
  expect(a.cfg.tables).toEqual(b.cfg.tables);
  expect(a.seed).toBe(arcadeDailySeed(new Date().toISOString().slice(0, 10)));
  const bot = playBot(a.seed, a.cfg, a.plan, { acc: 1, think: 30 });
  const res = await finish(kidA, a, bot.log, bot.endTick);
  expect(res.arcade!.kind).toBe("daily");
  expect(res.arcade!.score).toBeGreaterThan(0);
  expect(res.arcade!.newBest).toBe(true);
  const e = await start(kidB, "arcade-endless");
  expect(e.cfg.arcade?.kind).toBe("endless");
  expect(e.plan.items.length).toBe(40);
  const eb = playBot(e.seed, e.cfg, e.plan, { acc: 0.8, think: 30, rngSeed: 3 });
  const er = await finish(kidB, e, eb.log, eb.endTick);
  expect(er.arcade!.kind).toBe("endless");
  expect(er.arcade!.correct).toBeGreaterThan(0);
  const jb = await apiFetch<{ arcade?: Record<string, { score: number }> }>(`${HUB}/games/penguin-slide/journey${q(kidB)}`, await token(accounts.parent));
  expect(jb.arcade?.endless?.score).toBe(er.arcade!.score);
  expect(jb.arcade?.run).toBeUndefined(); // bests are per kind, and per child
});

test("free play and Journey are untouched: no arcade rules, no arcade result", async () => {
  const s = await start(kidB, "quick");
  expect(s.cfg.arcade).toBeUndefined();
  expect(s.cfg.approachSec).toBe(0);
  const bot = playBot(s.seed, s.cfg, s.plan, { acc: 0.9, think: 30 });
  const res = await finish(kidB, s, bot.log, bot.endTick);
  expect(res.arcade).toBeNull();
});

test("in the app: the Arcade card on the map starts a real run with hearts, score and the gate clock", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await ctxFor(browser);
  const page = await ctx.newPage();
  await dismissParentWelcome(page);
  await gotoHub(page, `/custdash/learninghub/${encodeURIComponent(kidUi)}?tab=games`);
  await page.getByTestId("hub-games-play-penguin").click({ timeout: 45_000 });
  await page.getByTestId("hub-games-level-2").click();
  await expect(page.getByTestId("ps-map")).toBeVisible({ timeout: 25_000 });
  const card = page.getByTestId("ps-arcade");
  await expect(card).toBeVisible();
  await expect(page.getByTestId("ps-arcade-run-best")).toHaveText(/No score yet/);
  await expect(page.getByTestId("ps-arcade-daily")).toContainText("×"); // today's tables are shown
  const started = page.waitForResponse((r) => r.url().includes(`${HUB}/games/sessions?`) && r.request().method() === "POST");
  await page.getByTestId("ps-arcade-run-play").click();
  const body = await (await started).json() as Started;
  expect(body.cfg.arcade).toMatchObject({ kind: "run", lives: 3 });
  await expect(page.getByTestId("ps-arcade-hearts")).toHaveAttribute("data-lives", "3", { timeout: 20_000 });
  await expect(page.getByTestId("ps-arcade-score")).toContainText("0");
  await expect(page.getByTestId("ps-fish")).toHaveCount(0); // one score in Arcade, not two multipliers
  await expect(page.getByTestId("ps-question")).toBeVisible({ timeout: 20_000 });
  // "Finish now" from the pause card ends the run early: it is scored by the server (0 right) and is NOT a clear
  await page.getByTestId("ps-pause").click();
  await page.getByTestId("ps-finish-now").click();
  await expect(page.getByTestId("ps-arcade-summary")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("ps-arcade-stars")).toHaveCount(1);
  await expect(page.getByTestId("ps-arcade-stars")).toHaveAttribute("data-stars", "0");
  await expect(page.getByTestId("ps-arcade-again")).toBeVisible();
  await ctx.close();
});
