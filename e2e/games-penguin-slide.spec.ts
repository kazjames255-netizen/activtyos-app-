import { test, expect, type Page } from "@playwright/test";
import { loadAccounts, statePath, type AccountManifest } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { playBot } from "../features/learninghub/games/penguin/bot";
import { summarise, replay, type Cfg, type Plan } from "../features/learninghub/games/penguin/core";
import { makeMtcPractice, MTC } from "../features/learninghub/games/penguin/mtc";

// Penguin Slide (times-table game): the whole server-verified loop for a THROWAWAY child.
//  start (server issues seed + plan, no answer key) -> the browser plays the deterministic core -> finish (the SERVER re-simulates from the seed + input log and
//  computes score / accuracy / stars) -> per-fact memory, journey progress, tutor summary. Every assertion is anchored to THIS run's child / session ids.
test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const kidName = `Pip${stamp}`;
let accounts: AccountManifest["accounts"];
let tenantId = "", childId = "";
const HUB = "/api/learning-hub";
const token = async (a: { email: string }) => (await fbSignIn(a.email)).idToken;
const q = () => `?tenantId=${tenantId}&childId=${childId}`;

interface Started { sessionId: string; seed: number; cfg: Cfg; plan: Plan; best: unknown; journey: { stars: Record<string, number> }; unlocks: { powers: string[]; cosmetics: string[] } }
interface Finished { done: boolean; answered: number; correct: number; fish: number; newBest: boolean; repeat?: boolean; stage: null | { id: string; stars: number; opened: string[]; cleared: boolean }; facts: { key: string; thaw: number }[]; xp: number; weekDays: number }

async function start(body: Record<string, unknown>) { return apiPost<Started>(`${HUB}/games/sessions${q()}`, await token(accounts.parent), { childId, ...body }); }
async function finish(s: Started, log: unknown, endTick: number) { return apiPost<Finished>(`${HUB}/games/sessions/${s.sessionId}/finish${q()}`, await token(accounts.parent), { childId, log, endTick }); }

test.beforeAll(async () => {
  test.setTimeout(240_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.freelancer.tenantId!;
  const t = await token(accounts.freelancer);
  const lib = (await apiFetch<{ settings?: { features?: Record<string, boolean> } & Record<string, unknown> } | null>("/api/library", t)) ?? {};
  await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ settings: { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: true } } }) });
  const listing = await provisionLiveListing(accounts.freelancer, { title: `E2E Times Tables ${stamp}`, price: 0 });
  childId = await createParentChild(accounts.parent, { name: kidName, dob: "2016-05-14" });
  await bookViaApi(accounts.parent, listing, { child: kidName, dates: [listing.runFrom] }).catch((e) => { if (!/clash|existing booking/i.test(String(e))) throw e; });
  await markParentWelcomed(accounts.parent);
  await apiPost(`${HUB}/topics`, t, { subject: `Maths ${stamp}`, topic: "Times tables" });
  await apiPost(`${HUB}/students`, t, { childId, subjects: [`Maths ${stamp}`] });
});

test("start issues a seed and a plan with NO answer key; another parent's child is refused", async () => {
  const s = await start({ mode: "quick" });
  expect(s.seed).toBeGreaterThan(0);
  expect(s.plan.items.length).toBe(s.cfg.n);
  expect(JSON.stringify(s.plan)).not.toMatch(/answer|correct/i); // the plan is facts to ask, never the marks
  expect(s.cfg.approachSec).toBe(0); // no timer by default
  // `?childId=` (query) wins over the body on the server (see resolveCtx/gamesApi.ts), so the attempt has to put
  // the foreign id in the QUERY string — the body-only version this used to send was silently ignored server-side
  // and always fell back to this run's own (legitimate) child, proving nothing.
  await expect(apiPost(`${HUB}/games/sessions?tenantId=${tenantId}&childId=not-my-child`, await token(accounts.parent), { mode: "quick" })).rejects.toThrow();
});

test("finish: the SERVER re-simulates the run; a claimed score means nothing; finish is idempotent", async () => {
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
  // a bad log is refused, not trusted
  const s4 = await start({ mode: "quick" });
  await expect(finish(s4, [[5, 999]], 100)).rejects.toThrow();
});

test("journey: 2 stars open the next stage; a locked stage is refused; stars + facts are recorded", async () => {
  test.setTimeout(180_000);
  await expect(start({ stageId: "b1s3" })).rejects.toThrow(/locked/i);
  const s = await start({ stageId: "b1s1" });
  expect(s.cfg.stage).toBe("b1s1"); expect(s.cfg.biome).toBe(1);
  const bot = playBot(s.seed, s.cfg, s.plan, { acc: 1, think: 30 });
  const res = await finish(s, bot.log, bot.endTick);
  expect(res.stage?.id).toBe("b1s1"); expect(res.stage?.stars).toBe(3); expect(res.stage?.opened).toContain("b1s2");
  expect(res.facts.length).toBeGreaterThan(0);
  const next = await start({ stageId: "b1s2" });
  expect(next.cfg.stage).toBe("b1s2");
  const j = await apiFetch<{ journey: { stars: Record<string, number> } }>(`${HUB}/games/penguin-slide/journey${q()}`, await token(accounts.parent));
  expect(j.journey.stars.b1s1).toBe(3);
});

test("MTC practice: 25 typed answers, marked by the server, no pass mark", async () => {
  const s = await apiPost<{ sessionId: string; form: { a: number; b: number }[]; limits: { n: number } }>(`${HUB}/games/sessions${q()}`, await token(accounts.parent), { childId, mode: "mtc" });
  expect(s.form.length).toBe(MTC.n); expect(new Set(s.form.map((i) => `${Math.min(i.a, i.b)}x${Math.max(i.a, i.b)}`)).size).toBe(MTC.n);
  expect(makeMtcPractice(1).length).toBe(3);
  const answers = s.form.map((i, k) => ({ v: k === 0 ? null : i.a * i.b, ms: 2000 + k }));
  const r = await apiPost<{ kind: string; label: string; score: number; total: number; missed: { kind: string }[] }>(`${HUB}/games/sessions/${s.sessionId}/finish${q()}`, await token(accounts.parent), { childId, answers });
  expect(r.kind).toBe("mtc"); expect(r.label).toBe("practice"); expect(r.score).toBe(24); expect(r.missed[0]!.kind).toBe("timeout");
  expect(JSON.stringify(r)).not.toMatch(/pass|fail/i);
});

test("tutor: fact strengths for THIS child, pin tables, and the pin shapes the next run", async () => {
  const t = await token(accounts.freelancer);
  const o = await apiFetch<{ childId: string; facts: { key: string; thaw: number }[]; heat: Record<string, unknown>; totals: { facts: number }; practice: { sessions: number; productiveSeconds: number } }>(`${HUB}/games/penguin-slide/facts?childId=${childId}`, t);
  expect(o.childId).toBe(childId); expect(o.totals.facts).toBeGreaterThan(0); expect(Object.keys(o.heat).length).toBeGreaterThan(0); expect(o.practice.sessions).toBeGreaterThan(0); expect(o.practice.productiveSeconds).toBeGreaterThan(0);
  await apiFetch(`${HUB}/games/penguin-slide/pin`, t, { method: "PUT", body: JSON.stringify({ childId, tables: [7] }) });
  const s = await start({ mode: "solo" });
  expect(s.cfg.pinned).toEqual([7]);
  expect(s.plan.items.every((i) => /(^|x)7(x|$)/.test(i.k.slice(2)))).toBe(true);
  await apiFetch(`${HUB}/games/penguin-slide/pin`, t, { method: "PUT", body: JSON.stringify({ childId, tables: [] }) });
  await expect(apiFetch(`${HUB}/games/penguin-slide/pin`, await token(accounts.parent), { method: "PUT", body: JSON.stringify({ childId, tables: [3] }) })).rejects.toThrow(); // a parent cannot pin
});

async function parentPage(browser: import("@playwright/test").Browser): Promise<Page> {
  const ctx = await browser.newContext({ storageState: statePath("parent"), viewport: { width: 1280, height: 800 } });
  return ctx.newPage();
}

test("UI: play a real stage in the browser (map -> stage -> steer -> stars) and the server records it", async ({ browser }) => {
  test.setTimeout(240_000);
  const before = await apiFetch<{ practice: { sessions: number } }>(`${HUB}/games/penguin-slide/facts?childId=${childId}`, await token(accounts.freelancer));
  const page = await parentPage(browser);
  await page.goto(`/dev/games/penguin-slide?tenantId=${tenantId}&childId=${childId}&name=${kidName}&debugAnswers=1`);
  await expect(page.getByTestId("ps-map")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("ps-stage-b1s2")).toHaveAttribute("data-status", /open|done/); // b1s1 was cleared with 3 stars above
  await page.getByTestId("ps-stage-b1s2").click();
  await page.getByTestId("ps-story-skip").click({ timeout: 2500 }).catch(() => { /* the prologue is shown once per device */ });
  await page.getByTestId("ps-stage-start").click();
  const root = page.getByTestId("penguin-slide");
  let last = "", n = 0;
  for (let i = 0; i < 400 && (await root.getAttribute("data-screen")) !== "summary"; i++) {
    const text = await page.getByTestId("ps-q-text").textContent({ timeout: 300 }).catch(() => "");
    if (text && text !== last) {
      last = text; n++;
      await page.waitForTimeout(500);
      const c = Number(await root.getAttribute("data-debug-correct"));
      await page.getByTestId(`ps-pad-${c}`).click(); // tap the chosen answer: the penguin glides to that lane and locks it in (moving alone never answers; there are no number-key shortcuts)
    }
    await page.waitForTimeout(100);
  }
  // anything new (a stage, a helper, an outfit) arrives first as its own one-card reveal: dismiss them, then the summary
  await expect(page.getByTestId("ps-summary").or(page.getByTestId("ps-reveal"))).toBeVisible({ timeout: 30_000 });
  for (let k = 0; k < 8 && (await page.getByTestId("ps-reveal").count()) > 0; k++) { await page.getByTestId("ps-reveal-next").click(); await page.waitForTimeout(150); }
  await expect(page.getByTestId("ps-summary")).toBeVisible({ timeout: 30_000 });
  expect(n).toBeGreaterThanOrEqual(8);
  await expect(page.getByTestId("ps-stars")).toHaveAttribute("data-stars", /[1-3]/);
  await expect(page.getByTestId("ps-saved")).toHaveText(/Saved\./);
  const after = await apiFetch<{ practice: { sessions: number } }>(`${HUB}/games/penguin-slide/facts?childId=${childId}`, await token(accounts.freelancer));
  expect(after.practice.sessions).toBe(before.practice.sessions + 1);
  await page.context().close();
});

test("UI: Calm variant (support profile) has no timer / shake / fish counter, and keyboard-only play finishes", async ({ browser }) => {
  test.setTimeout(240_000);
  const page = await parentPage(browser);
  await page.goto(`/dev/games/penguin-slide?calm=1&debugAnswers=1&unlock=all`);
  await expect(page.getByTestId("ps-map")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("ps-free").click();
  await expect(page.getByTestId("ps-q-text")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("ps-fish")).toHaveCount(0); // calm: no score flashes
  await expect(page.getByTestId("penguin-slide")).toHaveClass(/ps-calm/);
  await page.context().close();
});
