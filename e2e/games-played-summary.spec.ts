import { test, expect, type Page } from "@playwright/test";
import { loadAccounts, statePath, type AccountManifest } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { playBot } from "../features/learninghub/games/penguin/bot";
import type { Cfg, Plan } from "../features/learninghub/games/penguin/core";

// Tutor > Progress > one student: a plain summary of WHAT the child practised in games and HOW WELL (doing well / getting there / needs help), only for
// areas actually played, with no game names up front. A child who has played nothing gets one honest line, not an empty grid of zeros.
test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const kidName = `Gia${stamp}`;
let accounts: AccountManifest["accounts"];
let tenantId = "", childId = "";
const HUB = "/api/learning-hub";
const token = async (a: { email: string }) => (await fbSignIn(a.email)).idToken;
const q = () => `?tenantId=${tenantId}&childId=${childId}`;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  const t = await token(accounts.freelancer);
  const lib = (await apiFetch<{ settings?: { features?: Record<string, boolean> } & Record<string, unknown> } | null>("/api/library", t)) ?? {};
  await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ settings: { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: true } } }) });
  const listing = await provisionLiveListing(accounts.freelancer, { title: `E2E Games Summary ${stamp}`, price: 0 });
  childId = await createParentChild(accounts.parent, { name: kidName, dob: "2016-05-14" });
  await bookViaApi(accounts.parent, listing, { child: kidName, dates: [listing.runFrom] }).catch((e) => { if (!/clash|existing booking/i.test(String(e))) throw e; });
  await markParentWelcomed(accounts.parent);
  await apiPost(`${HUB}/topics`, t, { subject: `Maths ${stamp}`, topic: "Times tables" });
  await apiPost(`${HUB}/students`, t, { childId, subjects: [`Maths ${stamp}`] });
});

async function openStudent(page: Page) {
  await page.goto("/freelancer/learninghub?tab=dashboard");
  await page.getByText(kidName).first().click({ timeout: 90_000 });
}

test("a child who has played nothing gets one honest line, no grid, no game name", async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = await browser.newContext({ storageState: statePath("freelancer"), viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await openStudent(page);
  await expect(page.getByTestId("games-none")).toContainText(kidName, { timeout: 60_000 });
  await expect(page.getByTestId("games-played")).toHaveCount(0);
  await expect(page.getByText("Penguin Slide")).toHaveCount(0);
  await ctx.close();
});

test("after a times-tables run the summary names the AREA (Times tables) with a verdict, not the game", async ({ browser }) => {
  test.setTimeout(240_000);
  const s = await apiPost<{ sessionId: string; seed: number; cfg: Cfg; plan: Plan }>(`${HUB}/games/sessions${q()}`, await token(accounts.parent), { childId, mode: "quick" });
  const bot = playBot(s.seed, s.cfg, s.plan, { acc: 0.9, think: 30 });
  await apiPost(`${HUB}/games/sessions/${s.sessionId}/finish${q()}`, await token(accounts.parent), { childId, log: bot.log, endTick: bot.endTick });
  const ctx = await browser.newContext({ storageState: statePath("freelancer"), viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await openStudent(page);
  const area = page.getByTestId("games-area-times");
  await expect(area).toBeVisible({ timeout: 60_000 });
  await expect(area).toContainText("Times tables");
  await expect(area).toHaveAttribute("data-verdict", /doing_well|getting_there|needs_help|just_started/);
  await expect(page.getByTestId("games-played")).not.toContainText("Penguin");
  await expect(page.getByText(/hasn't played any games/)).toHaveCount(0);
  await ctx.close();
});
