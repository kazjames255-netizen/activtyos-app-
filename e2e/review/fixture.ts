import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { API_URL, ROOT, WEB_URL, type TestAccount } from "../helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, apiPost as _post0, fbSignUp } from "../helpers/accounts";
import { apiFetch as _f, apiPost as _p, fbSignIn as _s } from "../helpers/accounts";
import { bookViaApi as _b, createParentChild as _c, markParentWelcomed as _m, provisionLiveListing as _l } from "../helpers/tenantData";
import { seedOakLesson as _o } from "../helpers/lessonFixture";
import { chromium, type Browser, type Page } from "@playwright/test";

// Review fixture: ONLY the throwaway accounts from e2e/global.setup.ts (@activityos-test.com). Built through the same public
// API the other hub specs use. Notifications: assigning homework / booking may notify the (test) parent account only.
// The shared dev API sometimes drops sockets under load ("fetch failed"): retry transient network errors only.
async function R<T>(fn: () => Promise<T>): Promise<T> {
  for (let a = 0; ; a++) {
    try { return await fn(); } catch (e) {
      if (a < 4 && /fetch failed|other side closed|ECONNRESET|timeout/i.test(String(e) + String((e as { cause?: unknown }).cause))) { await new Promise((r) => setTimeout(r, 3000 * (a + 1))); continue; }
      throw e;
    }
  }
}
const apiFetch: typeof _f = (...a) => R(() => _f(...a));
const apiPost: typeof _p = (...a) => R(() => _p(...a));
// Firebase rate-limits password sign-ins across the shared dev project: sign in once per account (tokens last an hour).
const sessions = new Map<string, ReturnType<typeof _s>>();
const fbSignIn: typeof _s = (email, pw) => { const k = email + (pw ?? ""); if (!sessions.has(k)) sessions.set(k, R(() => _s(email, pw))); return sessions.get(k)!; };
const bookViaApi: typeof _b = (...a) => R(() => _b(...a));
const createParentChild: typeof _c = (...a) => R(() => _c(...a));
const markParentWelcomed: typeof _m = (...a) => R(() => _m(...a));
const provisionLiveListing: typeof _l = (...a) => R(() => _l(...a));
const seedOakLesson: typeof _o = (...a) => R(() => _o(...a));
const AUTH = path.join(ROOT, "e2e/review/.auth");
const statePath = (r: "freelancer" | "parent") => path.join(AUTH, `${r}.json`);
let own: Fx["accounts"] | null = null;

/** Own throwaway pair (same steps as e2e/global.setup.ts: fbSignUp -> /api/register-role -> e2e-unwall -> real UI login). The shared
 *  setup project also logs in a platform (HQ) account, which now needs an emailed one-time code, so it cannot be used as-is. */
export async function provisionOwn(browser?: Browser): Promise<Fx["accounts"]> {
  if (own) return own;
  if (!browser) { const b = await chromium.launch(); try { return await provisionOwn(b); } finally { await b.close(); } }
  fs.mkdirSync(AUTH, { recursive: true });
  const run = "rv" + Date.now().toString(36);
  const em = (r: string) => `e2e-${r}-${run}@${TEST_EMAIL_DOMAIN}`;
  const ps = await fbSignUp(em("parent"));
  await _post0("/api/register-role", ps.idToken, { role: "parent", postcode: "NN5 7EA" });
  const fs_ = await fbSignUp(em("freelancer"));
  const name = `E2E Freelance ${run}`;
  const r = await _post0<{ tenantId: string }>("/api/register-role", fs_.idToken, { role: "freelancer", businessName: name, providerName: name, providerNameMode: "business" });
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", r.tenantId], { stdio: "pipe" });
  for (const [role, email, home] of [["parent", em("parent"), "/custdash/browse"], ["freelancer", em("freelancer"), "/freelancer/bookings"]] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${WEB_URL}/login`);
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(`**${home}`, { timeout: 90_000 });
    await context.storageState({ path: statePath(role), indexedDB: true });
    await context.close();
  }
  own = {
    parent: { role: "parent", email: em("parent"), uid: ps.uid, tenantId: null, tenantName: null },
    freelancer: { role: "freelancer", email: em("freelancer"), uid: fs_.uid, tenantId: r.tenantId, tenantName: name },
  };
  return own;
}

export const HUB = "/api/learning-hub";
export const VIEWPORTS = { "390": { width: 390, height: 844 }, "768": { width: 768, height: 1024 }, "1440": { width: 1440, height: 900 } } as const;

export interface Fx { accounts: { freelancer: TestAccount; parent: TestAccount }; tenantId: string; kids: { id: string; name: string }[]; }

/** Other agents' suite setups wipe the standing accounts' data mid-run: re-check before each capture and rebuild if it is gone. */
export async function ensureFixture(browser: Browser | undefined, fx: Fx, n: number, full: boolean): Promise<Fx> {
  const t = (await fbSignIn(fx.accounts.freelancer.email)).idToken;
  const alive = await apiFetch<{ childId: string }[]>(`${HUB}/students`, t).then((l) => fx.kids.every((k) => l.some((x) => x.childId === k.id))).catch(() => false);
  const groupsOk = !full || (await apiFetch<unknown[]>(`${HUB}/groups`, t).then((g) => g.length >= 2).catch(() => false));
  return alive && groupsOk ? fx : buildFixture(n, full, browser);
}

export async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<{ settings?: Record<string, unknown> & { features?: Record<string, boolean> } } | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}

// Other agents share the standing accounts and their setup wipes data mid-run: retry the whole build if a wipe hits.
export async function buildFixture(n: number, full: boolean, browser?: Browser): Promise<Fx> {
  for (let a = 0; ; a++) {
    try { return await build(await provisionOwn(browser), n, full); } catch (e) { if (a >= 2 || !/not found|Unknown/i.test(String(e))) throw e; }
  }
}
async function build(accounts: Fx["accounts"], n: number, full: boolean): Promise<Fx> {
  const tenantId = accounts.freelancer.tenantId!;
  const stamp = Date.now().toString(36);
  await setHub(accounts.freelancer, true);
  const t = (await fbSignIn(accounts.freelancer.email)).idToken;
  const p = (await fbSignIn(accounts.parent.email)).idToken;
  const listing = await provisionLiveListing(accounts.freelancer, { title: `E2E Review Tuition ${stamp}`, price: 0 });
  const names = ["Ava", "Ben", "Cora", "Dev", "Ella", "Finn", "Gia", "Hugo"].slice(0, n);
  const kids: Fx["kids"] = [];
  names.forEach(() => 0);
  for (let i = 0; i < names.length; i++) {
    const year = 3 + Math.floor((i * 6) / names.length); // Years 3-8
    const name = `${names[i]}${stamp}`;
    const id = await createParentChild(accounts.parent, { name, dob: `${2026 - (year + 5)}-03-01` });
    kids.push({ id, name });
  }
  // One checkout for every child (the shared parent's earlier bookings clash per day, so try each weekday from the end of the run).
  {
    const doc = await apiFetch<{ blocks: { id: string; startDate: string; endDate: string }[] }>(`/api/listings/${listing.id}`, p);
    const days: string[] = [];
    for (let d = new Date(listing.runTo + "T12:00:00"); days.length < 10; d.setDate(d.getDate() - 1)) if (d.getDay() >= 1 && d.getDay() <= 5) days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    let last = "";
    let ok = false;
    for (const day of days) {
      try { await apiPost("/api/my/bookings", p, { listingId: listing.id, blockId: (doc.blocks.find((b) => b.startDate <= day && day <= b.endDate) ?? doc.blocks[0]).id, method: "card", items: kids.map((k) => ({ pass: "Day pass", child: k.name, age: 8, dates: [day] })) }); ok = true; break; } catch (e) { last = String(e); }
    }
    if (!ok) throw new Error("could not book the review children: " + last);
  }
  await markParentWelcomed(accounts.parent);
  const maths = `Maths ${stamp}`, english = `English ${stamp}`;
  for (const s of [maths, english]) await apiPost(`${HUB}/topics`, t, { subject: s, topic: s === maths ? "Fractions" : "Comprehension" });
  for (const k of kids) await apiPost(`${HUB}/students`, t, { childId: k.id, subjects: [maths, english] });
  const topics = await apiFetch<{ id: string; subject: string }[]>(`${HUB}/topics`, t);
  const topicId = topics.find((x) => x.subject === maths)!.id;
  const opts = [{ id: "a", text: "Right" }, { id: "b", text: "Wrong" }];
  const qids: string[] = [];
  for (let i = 1; i <= 3; i++) qids.push((await apiPost<{ id: string }>(`${HUB}/questions`, t, { topicId, kind: "single", prompt: `Review question ${i} ${stamp}`, options: opts, answer: "a", marks: 1 })).id);
  const mk = (title: string, type: "quiz" | "diagnostic") => apiPost<{ id: string }>(`${HUB}/assessments`, t, { type, title, subject: maths, topicIds: [topicId], questionIds: qids, timeLimitMins: null, passMarkPct: 50, published: true, ...(type === "quiz" ? { retakePolicy: "unlimited" } : {}) });
  const quiz = await mk(`Fractions quiz ${stamp}`, "quiz");
  if (full) await mk(`Placement ${stamp}`, "diagnostic");
  await seedOakLesson(t, { stamp, subject: maths, topicId, widget: "neurone" });
  await apiPost(`${HUB}/flashcards`, t, { topicId, front: `1/2 + 1/2 (${stamp})`, back: "1", published: true });
  const day = 86_400_000;
  const hw = async (title: string, due: number, ids: string[], assessmentId?: string) =>
    (await apiPost<{ id: string }>(`${HUB}/homework`, t, { title, instructions: "Show your working.", assignedChildIds: ids, dueAt: new Date(Date.now() + due).toISOString(), ...(assessmentId ? { assessmentId } : {}) })).id;
  const ids = kids.map((k) => k.id);
  const hwDue = await hw(`Fractions sheet ${stamp}`, 3 * day, ids.slice(0, Math.max(1, ids.length - 1)));
  if (full) {
    const hwOver = await hw(`Overdue reading ${stamp}`, -3 * day, ids.slice(0, 3));
    const hwQuiz = await hw(`Quiz homework ${stamp}`, 2 * day, ids.slice(2, 6), quiz.id);
    void hwQuiz;
    // hand-ins waiting to be marked (not the last child: kept quiet)
    for (const k of kids.slice(0, 3)) await apiPost(`${HUB}/submissions/${hwDue}__${k.id}/submit?tenantId=${tenantId}&childId=${k.id}`, p, { text: "Q1 = 1/2, Q2 = 3/4" }).catch(() => undefined);
    void hwOver;
    // two groups of four
    await apiPost(`${HUB}/groups`, t, { name: `Year 3-5 ${stamp}`, colour: "teal", childIds: ids.slice(0, 4) });
    await apiPost(`${HUB}/groups`, t, { name: `Year 6-8 ${stamp}`, colour: "purple", childIds: ids.slice(4) }).catch(() => undefined);
    // quiz results for all but the last two (quiet students)
    for (const k of kids.slice(0, Math.max(1, ids.length - 2))) {
      const qp = `?tenantId=${tenantId}&childId=${k.id}`;
      const start = await apiPost<{ attemptId: string; questions: { id: string }[] }>(`${HUB}/assessments/${quiz.id}/attempts${qp}`, p, {});
      await apiPost(`${HUB}/attempts/${start.attemptId}/submit${qp}`, p, { answers: start.questions.map((x, i) => ({ questionId: x.id, response: i === 0 && k.id !== ids[0] ? "b" : "a" })) });
    }
    await apiPost(`${HUB}/lessons`, t, { title: `Live fractions ${stamp}`, childIds: ids.slice(0, 4), startsAt: new Date(Date.now() + 3 * 3_600_000).toISOString(), durationMins: 45, topicId, notes: "" });
  }
  await setHub(accounts.freelancer, true);
  return { accounts, tenantId, kids };
}

export async function ctxFor(browser: Browser, role: "freelancer" | "parent", vp: { width: number; height: number } = VIEWPORTS["1440"]) {
  return browser.newContext({ storageState: statePath(role), viewport: vp });
}

export type Probe = { console: string[]; pageErrors: string[]; failed: string[]; reset(): void };
export function probe(page: Page): Probe {
  const s: Probe = { console: [], pageErrors: [], failed: [], reset() { s.console.length = 0; s.pageErrors.length = 0; s.failed.length = 0; } };
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") s.console.push(`${m.type()}: ${m.text().slice(0, 160)}`); });
  page.on("pageerror", (e) => s.pageErrors.push(String(e).slice(0, 160)));
  page.on("requestfailed", (r) => { const u = r.url(); if (!/\/api\/events\/|_next\/|hot-update|webpack/.test(u) && r.failure()?.errorText !== "net::ERR_ABORTED") s.failed.push(`${r.method()} ${u.replace(API_URL, "")} ${r.failure()?.errorText}`); });
  page.on("response", (r) => { if (r.status() >= 400 && r.url().startsWith(API_URL)) s.failed.push(`${r.status()} ${r.request().method()} ${r.url().replace(API_URL, "").slice(0, 90)}`); });
  return s;
}

export interface Timing { content: number | null; settled: number | null }
/** content = ms until the ACTIVE tab panel shows text; settled = ms until it also has no skeleton blocks left (null = never within the timeout). */
export async function settle(page: Page, timeout = 45_000): Promise<Timing> {
  const t0 = Date.now();
  const sel = "[data-hub-panel]:not([hidden])";
  const wait = (fn: () => boolean) => page.waitForFunction(fn, undefined, { timeout: Math.max(1, timeout - (Date.now() - t0)), polling: 100 }).then(() => Date.now() - t0, () => null);
  await page.waitForTimeout(300);
  const content = await wait(() => { const p = document.querySelector("[data-hub-panel]:not([hidden])") as HTMLElement | null; return !!p && p.innerText.trim().length > 40 && !/Loading…/.test(p.innerText); });
  const settled = content === null ? null : await wait(() => { const p = document.querySelector("[data-hub-panel]:not([hidden])"); return !!p && !p.querySelector("[class*='animate-pulse']"); });
  void sel;
  return { content, settled };
}

/** Skeleton blocks still on screen (a section that never finished loading). */
export const skeletons = (page: Page) => page.evaluate(() => document.querySelectorAll("[data-hub-panel]:not([hidden]) [class*='animate-pulse']").length).catch(() => -1);

export async function bannerText(page: Page): Promise<string[]> {
  const out = await page.evaluate(() => {
    const hits = new Set<string>();
    document.querySelectorAll("[role='alert']").forEach((e) => hits.add((e as HTMLElement).innerText.trim().replace(/\s+/g, " ")));
    const re = /(can.?t reach Teaching Hub|didn.?t respond within|something went wrong|failed to load)/i;
    document.querySelectorAll("#learning-hub *").forEach((e) => { if (e.children.length === 0) { const t = (e as HTMLElement).innerText?.trim(); if (t && re.test(t)) hits.add(t.replace(/\s+/g, " ")); } });
    return [...hits].filter(Boolean).map((x) => x.slice(0, 200));
  });
  return out;
}

export async function tabStrip(page: Page) {
  const list = page.getByRole("tablist").first();
  const tabs = list.getByRole("tab");
  const n = await tabs.count();
  const labels: string[] = [];
  const keys: string[] = [];
  for (let i = 0; i < n; i++) { labels.push((await tabs.nth(i).innerText()).trim().replace(/\s+/g, " ")); keys.push(((await tabs.nth(i).getAttribute("id")) ?? "").replace(/^hub-tab-/, "") || `tab${i}`); }
  const overflow = await list.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, doc: document.documentElement.scrollWidth, win: window.innerWidth }));
  return { tabs, labels, keys, overflow: overflow.scroll > overflow.client + 1, pageOverflow: overflow.doc > overflow.win + 1, ...overflow };
}

export async function gotoHubPage(page: Page, url: string, fx: Fx) {
  const heading = page.getByRole("heading", { name: /Teaching Hub|My Classroom/ });
  for (let a = 0; a < 3; a++) {
    if (a > 0) await setHub(fx.accounts.freelancer, true);
    await page.goto(url);
    if (await heading.first().isVisible({ timeout: 40_000 }).catch(() => false)) return;
  }
}
/** Parent hub: pick the standing provider and THIS run's child (the shared parent account also holds other suites' children). */
export async function pickChild(page: Page, fx: Fx, idx = 0) {
  const provider = page.getByLabel("Provider");
  if (await provider.isVisible().catch(() => false)) await provider.selectOption(fx.tenantId);
  const name = fx.kids[idx].name;
  const select = page.getByRole("combobox", { name: "Child" });
  const radio = page.getByRole("radio", { name });
  await select.or(radio).first().waitFor({ timeout: 40_000 });
  if (await select.isVisible().catch(() => false)) await select.selectOption({ label: name }); else await radio.click();
  await page.locator("[data-testid='hub-hand-over'],[data-testid='hub-hand-over-toggle']").first().waitFor({ timeout: 30_000 });
}
/** With many children the "Hand over to" pills sit behind a toggle. */
export async function handOver(page: Page, childId: string) {
  const mine = page.locator(`[data-testid="hub-hand-over"][data-child-id="${childId}"]`);
  if (!(await mine.isVisible().catch(() => false))) await page.getByTestId("hub-hand-over-toggle").click();
  await mine.click();
  await page.locator("#learning-hub[data-kid='1']").waitFor({ timeout: 30_000 });
}
export const tabKey = (page: Page, label: string) => { try { return new URL(page.url()).searchParams.get("tab") || label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); } catch { return label; } };
