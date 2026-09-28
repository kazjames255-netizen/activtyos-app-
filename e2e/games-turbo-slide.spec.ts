import { test, expect } from "@playwright/test";
import { loadAccounts, statePath, type AccountManifest } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { playBot } from "../features/learninghub/games/penguin/bot";
import { summarise, replay, type Cfg, type Plan } from "../features/learninghub/games/penguin/core";

// Turbo Slide (highway reskin of the SAME server-authoritative engine as Penguin Slide - see
// docs/games-prototypes/BACKEND-PATTERN.md): the whole server-verified loop for a THROWAWAY child, run against
// the ALREADY-RUNNING dev stack directly with `npx playwright test e2e/games-turbo-slide.spec.ts` (never through
// the shared e2e-locked.sh queue, never e2e:cleanup). Uses a fresh child under the shared freelancer/parent test
// tenant (the same @activityos-test.com convention every other hub spec uses) so it never touches a real tenant.
test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const kidName = `Turbo${stamp}`;
let accounts: AccountManifest["accounts"];
let tenantId = "", childId = "";
const HUB = "/api/learning-hub";
const token = async (a: { email: string }) => (await fbSignIn(a.email)).idToken;
const q = () => `?tenantId=${tenantId}&childId=${childId}`;

interface Started { sessionId: string; seed: number; cfg: Cfg; plan: Plan; skin: string }
interface Finished { done: boolean; answered: number; correct: number; fish: number; repeat?: boolean; facts: { key: string; thaw: number }[] }

async function start(body: Record<string, unknown>) { return apiPost<Started>(`${HUB}/games/sessions${q()}`, await token(accounts.parent), { childId, skin: "turbo", ...body }); }
async function finish(s: Started, log: unknown, endTick: number) { return apiPost<Finished>(`${HUB}/games/sessions/${s.sessionId}/finish${q()}`, await token(accounts.parent), { childId, log, endTick }); }

test.beforeAll(async () => {
  test.setTimeout(240_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  const t = await token(accounts.freelancer);
  const lib = (await apiFetch<{ settings?: { features?: Record<string, boolean> } & Record<string, unknown> } | null>("/api/library", t)) ?? {};
  await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ settings: { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: true } } }) });
  const listing = await provisionLiveListing(accounts.freelancer, { title: `E2E Turbo Slide ${stamp}`, price: 0 });
  childId = await createParentChild(accounts.parent, { name: kidName, dob: "2016-05-14" });
  // The shared parent test account juggles bookings from many concurrent specs at the same 09:00-15:30 slot, so a
  // clash on any one date is expected - try each weekday in the listing's run before giving up.
  const from = new Date(listing.runFrom + "T00:00:00");
  let booked = false;
  for (let i = 0; i < 10 && !booked; i++) {
    const d = new Date(from); d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    try { await bookViaApi(accounts.parent, listing, { child: kidName, dates: [iso] }); booked = true; }
    catch (e) { if (!/clash|existing booking/i.test(String(e))) throw e; }
  }
  if (!booked) throw new Error("could not find a clash-free date to book the test child");
  await markParentWelcomed(accounts.parent);
  await apiPost(`${HUB}/topics`, t, { subject: `Maths ${stamp}`, topic: "Times tables" });
  await apiPost(`${HUB}/students`, t, { childId, subjects: [`Maths ${stamp}`] });
});

test("start tags the session skin:turbo, issues a seed and a plan with NO answer key; another parent's child is refused", async () => {
  const s = await start({ mode: "quick" });
  expect(s.skin).toBe("turbo");
  expect(s.seed).toBeGreaterThan(0);
  expect(s.plan.items.length).toBe(s.cfg.n);
  expect(JSON.stringify(s.plan)).not.toMatch(/answer|correct/i);
  // (no ?childId= in the query this time, so the route falls back to body.childId, which is bogus)
  await expect(apiPost(`${HUB}/games/sessions?tenantId=${tenantId}`, await token(accounts.parent), { childId: "not-my-child", mode: "quick", skin: "turbo" })).rejects.toThrow();
});

test("finish: the SERVER re-simulates the run from the shared core; a claimed score means nothing; finish is idempotent; a bad log is refused", async () => {
  test.setTimeout(120_000);
  const s = await start({ mode: "quick" });
  const bot = playBot(s.seed, s.cfg, s.plan, { acc: 0.8, think: 30 });
  const local = summarise(bot.sim);
  const res = await finish(s, bot.log, bot.endTick);
  expect(res.done).toBe(true);
  expect(res.answered).toBe(local.answered);
  expect(res.correct).toBe(local.correct); // same seed + same log = same answer, decided by the server's own replay
  expect(res.fish).toBe(local.fish);
  const again = await finish(s, bot.log, bot.endTick);
  expect(again.repeat).toBe(true); expect(again.correct).toBe(res.correct);
  // an input log that steers nowhere is worth nothing, whatever the client says
  const s2 = await start({ mode: "quick" });
  const empty = await finish(s2, [], 600);
  expect(empty.correct).toBe(0);
  // tampering with the log CHANGES the outcome, it can only ever be replayed
  const s3 = await start({ mode: "quick" });
  const good = playBot(s3.seed, s3.cfg, s3.plan, { acc: 1, think: 30 });
  const r3 = await finish(s3, good.log, good.endTick);
  expect(r3.correct).toBe(summarise(replay(s3.seed, s3.cfg, s3.plan, good.log, good.endTick)).correct);
  const s4 = await start({ mode: "quick" });
  await expect(finish(s4, [[5, 999]], 100)).rejects.toThrow();
});

test("fact mastery is SHARED with Penguin Slide: /games/turbo-slide/facts and /games/penguin-slide/facts agree", async () => {
  const s = await start({ mode: "solo" });
  const bot = playBot(s.seed, s.cfg, s.plan, { acc: 1, think: 20 });
  await finish(s, bot.log, bot.endTick);
  const [turbo, penguin] = await Promise.all([
    apiFetch<{ totals: { facts: number } }>(`${HUB}/games/turbo-slide/facts?childId=${childId}`, await token(accounts.freelancer)),
    apiFetch<{ totals: { facts: number } }>(`${HUB}/games/penguin-slide/facts?childId=${childId}`, await token(accounts.freelancer)),
  ]);
  expect(turbo.totals.facts).toBeGreaterThan(0);
  expect(turbo.totals.facts).toBe(penguin.totals.facts); // same hubFactState rows, read through two paths
});

test("tutor: pinning tables via the turbo-slide alias shapes the next Turbo run", async () => {
  const t = await token(accounts.freelancer);
  await apiFetch(`${HUB}/games/turbo-slide/pin`, t, { method: "PUT", body: JSON.stringify({ childId, tables: [7] }) });
  const s = await start({ mode: "solo" });
  expect(s.cfg.pinned).toEqual([7]);
  expect(s.plan.items.every((i) => /(^|x)7(x|$)/.test(i.k.slice(2)))).toBe(true);
  await apiFetch(`${HUB}/games/turbo-slide/pin`, t, { method: "PUT", body: JSON.stringify({ childId, tables: [] }) });
});

test("UI: a run playable end to end on /dev/games/turbo-slide records a session server-side", async ({ browser }) => {
  test.setTimeout(300_000);
  const before = await apiFetch<{ practice: { sessions: number } }>(`${HUB}/games/turbo-slide/facts?childId=${childId}`, await token(accounts.freelancer));
  const ctx = await browser.newContext({ storageState: statePath("parent"), viewport: { width: 420, height: 860 } });
  const page = await ctx.newPage();
  await page.goto(`/dev/games/turbo-slide?tenantId=${tenantId}&childId=${childId}&name=${kidName}`);
  await expect(page.getByTestId("turbo-title")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("turbo-mode-quick").click();
  await expect(page.getByTestId("turbo-question")).toBeVisible({ timeout: 30_000 });
  // Click through lanes (no answer key exposed in the real UI - this proves the loop completes and the server
  // records a real session; games-turbo-slide's API tests above prove the scoring itself is server-authoritative).
  const root = page.getByTestId("turbo-slide");
  for (let i = 0; i < 500 && (await root.getAttribute("data-screen")) !== "summary"; i++) {
    const lane0 = page.getByTestId("turbo-lane-0");
    if (await lane0.isVisible().catch(() => false)) await lane0.click({ timeout: 500 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  await expect(page.getByTestId("turbo-summary")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("turbo-result-score")).toBeVisible();
  const after = await apiFetch<{ practice: { sessions: number } }>(`${HUB}/games/turbo-slide/facts?childId=${childId}`, await token(accounts.freelancer));
  expect(after.practice.sessions).toBe(before.practice.sessions + 1);
  await ctx.close();
});
