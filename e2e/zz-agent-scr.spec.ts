import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test, chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { API_URL, ROOT, WEB_URL } from "./helpers/env";
import { dismissParentWelcome } from "./helpers/ui";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, fbSignIn, fbSignUp } from "./helpers/accounts";

test.describe.configure({ mode: "serial" });
const SHOTS = path.join(ROOT, "e2e/review/shots/scr");
const CACHE = path.join(SHOTS, "accounts.json");
const RESULTS_PATH = path.join(SHOTS, "results.json");
fs.mkdirSync(SHOTS, { recursive: true });
const ONLY = process.env.SCR_ONLY ? process.env.SCR_ONLY.split(",") : null;

type Kind = "co" | "fl" | "fr" | "p";
const TRACKER: Record<string, string> = { co: "company", fl: "freelancer", fr: "franchise", p: "parent" };
const PORTAL: Record<string, string> = { co: "company", fl: "freelancer", fr: "franchise", p: "custdash" };
interface Res { id: string; kind: Kind; ok: boolean; note: string; shots: string[]; blocked?: boolean }
const results: Res[] = fs.existsSync(RESULTS_PATH) ? JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8")) : [];
const saveResults = () => fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));

interface Acct { email: string; uid: string; tenantId: string | null; franchiseId?: string | null; tok: string; tokAt: number }
let A: Record<string, Acct> = {};
const stamp = Date.now().toString(36);
const email = (n: string) => `e2e-scr-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`;
const token = async (k: string) => { const a = A[k]; if (Date.now() - a.tokAt > 35 * 60_000) { a.tok = (await fbSignIn(a.email)).idToken; a.tokAt = Date.now(); } return a.tok; };
async function call(k: string | null, method: string, url: string, body?: unknown, tok?: string): Promise<{ status: number; json: any }> {
  for (let attempt = 0; ; attempt++) {
    try {
      const t = tok ?? (k ? await token(k) : null);
      const res = await fetch(`${API_URL}${url}`, { method, headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      let json: any = null; try { json = await res.json(); } catch { /* empty */ }
      return { status: res.status, json };
    } catch (e) { if (attempt >= 20) throw e; await new Promise((r) => setTimeout(r, 3000)); }
  }
}
const ok = async (k: string, method: string, url: string, body?: unknown) => {
  const r = await call(k, method, url, body);
  if (r.status >= 300) throw new Error(`${method} ${url} -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  return r.json;
};
const unwall = (...ids: string[]) => execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", ...ids], { stdio: "pipe" });
async function signupOperator(key: string, role: "company" | "freelancer", name: string) {
  const s = await fbSignUp(email(key));
  const r = await call(null, "POST", "/api/register-role", { role, businessName: name, providerName: name, providerNameMode: "business" }, s.idToken);
  if (r.status >= 300) throw new Error(`register ${key}: ${JSON.stringify(r.json)}`);
  A[key] = { email: email(key), uid: s.uid, tenantId: r.json.tenantId, tok: s.idToken, tokAt: Date.now() };
}
async function signupParent(key: string) {
  const s = await fbSignUp(email(key));
  const r = await call(null, "POST", "/api/register-role", { role: "parent", postcode: "NN5 7EA" }, s.idToken);
  if (r.status >= 300) throw new Error(`register ${key}: ${JSON.stringify(r.json)}`);
  await call(null, "POST", "/api/me/welcome", {}, s.idToken);
  A[key] = { email: email(key), uid: s.uid, tenantId: null, tok: s.idToken, tokAt: Date.now() };
}
async function joinByInvite(key: string, inviter: string, body: Record<string, unknown>) {
  const inv = await ok(inviter, "POST", "/api/invites", body);
  const s = await fbSignUp(email(key));
  const acc = await call(null, "POST", `/api/invites/${inv.token}/accept`, {}, s.idToken);
  if (acc.status >= 300) throw new Error(`accept ${key}: ${JSON.stringify(acc.json)}`);
  const me = await call(null, "GET", "/api/me", undefined, s.idToken);
  A[key] = { email: email(key), uid: s.uid, tenantId: A[inviter].tenantId, franchiseId: me.json?.franchiseId ?? null, tok: s.idToken, tokAt: Date.now() };
}

// dates
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = new Date();
const nextMonday = addDays(today, (8 - today.getDay()) % 7 || 7);
const sd = (w: number, d: number) => iso(addDays(nextMonday, w * 7 + d));

// browser
let theBrowser: Browser | null = null;
const ctxs: Record<string, BrowserContext> = {};
const HOME: Record<string, string> = { co: "/company/bookings", fl: "/freelancer/bookings", fr: "/franchise/bookings", p: "/custdash" };
async function ctxFor(k: string, mobile = false): Promise<BrowserContext> {
  const ck = mobile ? k + "@m" : k;
  if (ctxs[ck]) return ctxs[ck];
  if (!theBrowser || !theBrowser.isConnected()) theBrowser = await chromium.launch();
  for (let attempt = 0; ; attempt++) {
    const ctx = await theBrowser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    try {
      await page.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      const em = A[k].email;
      for (let i = 0; i < 8; i++) {
        await page.waitForTimeout(1500);
        await page.getByPlaceholder("you@example.com").fill(em);
        await page.locator('input[type="password"]').fill(TEST_PASSWORD);
        await page.waitForTimeout(400);
        if ((await page.getByPlaceholder("you@example.com").inputValue()) === em && (await page.locator('input[type="password"]').inputValue()) === TEST_PASSWORD) break;
      }
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
      await page.close(); ctxs[ck] = ctx; return ctx;
    } catch (e) { await ctx.close().catch(() => {}); if (attempt >= 5) throw e; }
  }
}
async function newPage(k: string, url: string, mobile = false): Promise<Page> {
  const ctx = await ctxFor(k, mobile);
  const page = await ctx.newPage();
  await page.goto(`${WEB_URL}${url}`, { waitUntil: "load", timeout: 120_000 });
  await dismissParentWelcome(page).catch(() => {});
  return page;
}
/** Wait for the text, then for no "Loading" text, then take a full-page shot. */
async function snap(page: Page, id: string, tag: string, wait: (string | RegExp)[] = []) {
  for (const w of wait) await page.getByText(w).first().waitFor({ state: "visible", timeout: 45_000 });
  await page.waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.innerText), null, { timeout: 45_000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const vp = page.viewportSize();
  if (vp) {
    const h = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, ...Array.from(document.querySelectorAll("main, div")).map((e) => (e.scrollHeight > e.clientHeight + 20 && e.clientHeight > 300 ? e.scrollHeight + e.getBoundingClientRect().top : 0))));
    await page.setViewportSize({ width: vp.width, height: Math.min(Math.max(h + 20, vp.height), 5000) }); await page.waitForTimeout(500);
  }
  const f = path.join(SHOTS, `${id}${tag ? "." + tag : ""}.png`);
  await page.screenshot({ path: f, fullPage: true });
  if (vp) await page.setViewportSize(vp);
  return path.relative(ROOT, f);
}

const T = (name: string, fn: () => Promise<void>) => test(name, async () => { test.setTimeout(3_000_000); try { await fn(); } catch (e) { console.log(`TEST ABORT ${name}: ${(e as Error).message.slice(0, 400)}`); } });
async function check(id: string, kind: Kind, fn: (shots: string[]) => Promise<string>) {
  if (ONLY && !ONLY.includes(id)) return;
  const shots: string[] = [];
  let r: Res; warns = [];
  try { const n = await fn(shots); r = { id, kind, ok: true, note: n + (warns.length ? " | WARN: " + warns.join("; ") : ""), shots }; }
  catch (e) { r = { id, kind, ok: false, note: (e as Error).message.slice(0, 700), shots }; }
  const i = results.findIndex((x) => x.id === id && x.kind === kind); if (i >= 0) results.splice(i, 1);
  results.push(r); saveResults();
  console.log(`${r.ok ? "PASS" : "FAIL"} ${id} [${kind}] ${r.note}`);
}

// provisioning
const venueDone = new Set<string>();
async function ensureVenue(k: string) {
  if (venueDone.has(k)) return "lta-venue";
  const lib = (await call(k, "GET", "/api/library")).json ?? {};
  const venues = (lib.venues ?? []) as { id: string }[];
  await ok(k, "PUT", "/api/library", { venues: venues.some((v) => v.id === "lta-venue") ? venues : [...venues, { id: "lta-venue", name: "LTA Sports Hall", address: "1 Test Way", city: "Northampton" }], settings: { ...(lib.settings ?? {}), marketplaceListed: true } });
  venueDone.add(k); return "lta-venue";
}
interface Listing { id: string; title: string; blockId: string; blocks: { id: string; startDate: string }[]; tenantId: string }
interface PassDef { name: string; days: number; price: number }
const STD_PASSES: PassDef[] = [{ name: "5 days", days: 5, price: 90 }, { name: "3 days", days: 3, price: 54 }, { name: "1 day", days: 1, price: 20 }];
const passIdCache: Record<string, string> = {};
let periodCache: Record<string, string> = {};
async function ensurePass(k: string, name: string, days: number) {
  const key = `${k}|${name}|${days}`;
  return (passIdCache[key] ??= (await ok(k, "POST", "/api/passes", { name, days })).id);
}
async function ensurePeriod(k: string) { return (periodCache[k] ??= (await ok(k, "POST", "/api/periods", { title: "Full day", start: "09:00", finish: "15:00" })).id); }
interface MkOpts { noVenue?: boolean; passes?: PassDef[]; from?: string; to?: string; days?: number[]; mode?: "weekly" | "custom" }
async function mkListing(k: string, title: string, extra: Record<string, unknown> = {}, o: MkOpts = {}): Promise<Listing> {
  const passes = o.passes ?? STD_PASSES;
  const venueId = await ensureVenue(k);
  const period = await ensurePeriod(k);
  const ids = await Promise.all(passes.map((p) => ensurePass(k, p.name, p.days)));
  const master = [...passes].sort((a, c) => c.days - a.days)[0];
  const passFlat: Record<string, number> = {}; const periodPrice: Record<string, number> = {};
  passes.forEach((p, i) => { passFlat[ids[i]] = p.price; periodPrice[`${ids[i]}_${period}`] = p.price; });
  const bundle = await ok(k, "POST", "/api/block-bundles", { name: `Bundle ${title}`, periodIds: [period], passIds: ids, priced: true, masterPrice: master.price, calcOn: false, passFlat, periodPrice });
  const listing = await ok(k, "POST", "/api/listings", {
    title, ...(o.noVenue ? {} : { venueId }), runFrom: o.from ?? iso(nextMonday), runTo: o.to ?? iso(addDays(nextMonday, 20)), blockMode: o.mode ?? "weekly", days: o.days ?? [1, 2, 3, 4, 5],
    maxAttendees: "10", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "11", blockId: bundle.id,
    passes: passes.map((p) => ({ name: p.name, price: p.price, days: p.days })),
    bookingType: "auto", waitlist: true, waitlistMode: "manual", status: "live", visibility: "public", ...extra,
  });
  await ok(k, "PUT", `/api/block-bundles/${bundle.id}/listings`, { listingIds: [listing.id] });
  const full = await ok(k, "GET", `/api/listings/${listing.id}`);
  const blocks = ((full.blocks ?? []) as { id: string; startDate: string }[]).sort((a, c) => (a.startDate < c.startDate ? -1 : 1));
  return { id: listing.id, title, blockId: blocks[0]?.id, blocks, tenantId: listing.tenantId };
}
let childN = 0;
const kid = (tag = "K") => `${tag}${stamp}x${++childN}`;
async function book(parent: string, L: Listing, dates: string[], pass: string, extra: Record<string, unknown> = {}, child = kid()) {
  return call(parent, "POST", "/api/my/bookings", { listingId: L.id, blockId: L.blockId, method: "card", items: [{ pass, child, age: 8, dates }], ...extra });
}
async function bookOk(parent: string, L: Listing, dates: string[], pass: string, extra: Record<string, unknown> = {}) {
  const r = await book(parent, L, dates, pass, extra);
  if (r.status >= 300) throw new Error(`book -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  return r.json.bookings[0] as any;
}
const eq = (a: unknown, b: unknown, label: string) => { const same = typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 0.006 : a === b; if (!same) throw new Error(`${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const must = (v: unknown, label: string) => { if (!v) throw new Error(`${label}: expected truthy, got ${JSON.stringify(v)}`); };
const monRe = () => new RegExp("^Mon\\s*" + nextMonday.getDate() + "$", "i");
async function newChild(parent: string, name: string) { return ok(parent, "POST", "/api/my/children", { name, dob: "2017-03-04" }); }
/** Parent UI: from /book/<id> to the Pay step with `childName` on the 5-day week-1 pass. */
async function uiToPay(p: Page, childName: string, passLabel = /ADD 5 DAYS TO BASKET/i) {
  await p.getByText(/Tap a week/).first().waitFor({ timeout: 45_000 });
  await p.getByRole("button", { name: monRe() }).first().click();
  await p.getByRole("button", { name: passLabel }).click();
  await p.getByRole("button", { name: /NEXT — ADD CHILDREN/i }).click();
  await p.getByRole("button", { name: new RegExp(`Add ${childName} to this booking`) }).click();
  await p.getByRole("button", { name: "Next", exact: true }).click();
  await p.getByPlaceholder("e.g. 07700 900123").waitFor({ timeout: 45_000 });
}
async function openWizard(kind: string, title: string, step: number) {
  const p = await newPage(kind, `/${PORTAL[kind]}/listings`);
  await p.getByText(title).first().waitFor({ state: "visible", timeout: 60_000 });
  const card = p.locator('[data-ui="card"]').filter({ hasText: title }).last();
  await card.getByRole("button", { name: "Edit" }).click();
  await p.getByText(/^Step 1 of 13/).waitFor({ timeout: 45_000 });
  for (let n = 1; n < step; n++) { await p.getByRole("button", { name: /^Next/ }).click(); await p.waitForTimeout(500); }
  await p.waitForTimeout(800);
  await p.getByText(/✓ Saved/).first().waitFor({ timeout: 20_000 }).catch(() => {});
  return p;
}
let dbgN = 0;
let warns: string[] = [];
const saveWizard = async (p: Page) => {
  await p.getByText(/✓ Saved/).first().waitFor({ timeout: 15_000 }).catch(() => {});
  await p.waitForTimeout(2500);
  await p.getByRole("button", { name: "Save changes" }).click();
  try { await p.getByText(/^Step \d+ of 13/).waitFor({ state: "hidden", timeout: 25_000 }); }
  catch (e) {
    const conflict = await p.getByText(/changed in another tab/i).count();
    const f = `dbg.save${++dbgN}.png`; await p.screenshot({ path: path.join(SHOTS, f) });
    if (!conflict) throw new Error("wizard did not close after Save changes (see " + f + ")");
    warns.push(`Save changes showed 'This listing changed in another tab' (single tab, autosave already stored the edit) ${f}`);
    await p.getByRole("button", { name: "×", exact: true }).first().click().catch(() => {});
  }
  await p.waitForTimeout(1500);
};
async function poll<T>(fn: () => Promise<T>, okf: (v: T) => boolean, label: string, ms = 30_000): Promise<T> {
  const t0 = Date.now(); let v = await fn();
  while (!okf(v) && Date.now() - t0 < ms) { await new Promise((r) => setTimeout(r, 2000)); v = await fn(); }
  if (!okf(v)) throw new Error(`${label}: not as expected after ${ms / 1000}s: ${JSON.stringify(v).slice(0, 200)}`);
  return v;
}
const OPS: Kind[] = ["co", "fl", "fr"];


test.beforeAll(async () => {
  test.setTimeout(3_000_000);
  if (fs.existsSync(CACHE) && !process.env.SCR_FRESH) {
    A = JSON.parse(fs.readFileSync(CACHE, "utf8"));
    for (const k of Object.keys(A)) { A[k].tok = (await fbSignIn(A[k].email)).idToken; A[k].tokAt = Date.now(); }
    return;
  }
  for (const k of ["pA", "pB", "pC", "pD", "pE", "pF", "pG", "pH", "pOp"]) await signupParent(k);
  await signupOperator("co", "company", `SCR Co ${stamp}`);
  await signupOperator("fl", "freelancer", `SCR Free ${stamp}`);
  await signupOperator("ho", "company", `SCR HO ${stamp}`);
  unwall(A.co.tenantId!, A.fl.tenantId!, A.ho.tenantId!);
  await joinByInvite("fr", "ho", { role: "franchise", franchiseName: `SCR Alpha ${stamp}` });
  fs.writeFileSync(CACHE, JSON.stringify(A, null, 1));
  console.log("ACCOUNTS", Object.entries(A).map(([k, v]) => `${k}=${v.email}`).join(" "));
});
test.afterAll(async () => { for (const c of Object.values(ctxs)) await c?.close().catch(() => {}); await theBrowser?.close().catch(() => {}); });


// ======= CHECKS GO BELOW =======
const sessionDates = async (k: string, L: Listing) => {
  const full = await ok(k, "GET", `/api/listings/${L.id}`);
  return ((full.blocks ?? []) as any[]).flatMap((b) => (b.sessions ?? []).map((x: any) => x.date as string)).sort();
};
const wed = (w: number) => iso(addDays(nextMonday, 2 + 7 * w));
const DATA_PATH = path.join(SHOTS, "data.json");
let D: Record<string, any> = fs.existsSync(DATA_PATH) ? JSON.parse(fs.readFileSync(DATA_PATH, "utf8")) : {};
const saveD = () => fs.writeFileSync(DATA_PATH, JSON.stringify(D, null, 1));
const L = (key: string): Listing => D.L[key];
const say = (...a: unknown[]) => console.log("SCR", ...a);
const LOADING = /Loading…|Loading\.\.\./;

async function uiPick(p: Page, child: string, o: { wk?: number; chip?: RegExp; add?: RegExp } = {}) {
  await p.getByText(/Tap a week|Choose (your|any) dates/).first().waitFor({ timeout: 45_000 });
  if (o.chip) await p.getByRole("button", { name: o.chip }).first().click();
  const wk = o.wk ?? 0;
  await p.getByRole("button", { name: new RegExp("^Mon\\s*" + addDays(nextMonday, 7 * wk).getDate() + "$", "i") }).first().click();
  await p.getByRole("button", { name: o.add ?? /ADD .* TO BASKET/i }).click();
  await p.getByRole("button", { name: /NEXT — ADD CHILDREN/i }).click();
  await p.getByRole("button", { name: new RegExp(`Add ${child} to this booking|${child}`) }).first().click();
  await p.getByRole("button", { name: "Next", exact: true }).click();
  await p.getByPlaceholder("e.g. 07700 900123").waitFor({ timeout: 45_000 });
}
async function uiConfirm(p: Page, method?: string) {
  if (await p.getByPlaceholder("e.g. 07700 900123").isVisible().catch(() => false)) await p.getByPlaceholder("e.g. 07700 900123").fill("07700900123");
  if (method) await p.locator("select").filter({ has: p.locator(`option[value="${method}"]`) }).first().selectOption(method);
  await p.waitForTimeout(800);
  const btn = () => p.locator("button:visible").filter({ hasText: /^(Add your contact phone|Confirm|Pay|Join|Request|Send)/i }).last();
  await btn().click();
  await p.waitForTimeout(1200);
  const t = (await btn().innerText().catch(() => "")).trim();
  if (/^Confirm|^Pay|^Join|^Request|^Send/i.test(t)) await btn().click().catch(() => {});
}

T("DATA", async () => {
  if (D.done) return;
  D.L = {};
  const lib = (await call("co", "GET", "/api/library")).json ?? {};
  await ensureVenue("co");
  const lib2 = (await call("co", "GET", "/api/library")).json ?? {};
  const put = await call("co", "PUT", "/api/library", { venues: lib2.venues, settings: { ...(lib2.settings ?? {}), marketplaceListed: true, payMethods: ["Card", "Cash", "Bank transfer"], billing: { ...(lib2.settings?.billing ?? {}), bankName: "Test Bank", accountName: "SCR Co Ltd", sortCode: "12-34-56", accountNumber: "12345678" } } });
  say("settings put", put.status);
  const one = [{ name: "1 day", days: 1, price: 20 }];
  const eb = (beforeDate: string) => [{ id: "ee" + beforeDate, kind: "early", name: "", passNames: [], enabled: true, moreThan: 1, appliesTo: "all", method: "subtract", value: 10, beforeDate }];
  D.L.dash = await mkListing("co", `SCR dash ${stamp}`);
  D.L.term = await mkListing("co", `SCR term ${stamp}`, { bookRules: { Term: "blocks" } }, { passes: [{ name: "Term", days: 10, price: 120 }, { name: "1 day", days: 1, price: 15 }], from: wed(0), to: wed(9), days: [3] });
  D.L.wait = await mkListing("co", `SCR wait ${stamp}`, {}, { passes: one }); await ok("co", "PUT", `/api/listings/${D.L.wait.id}`, { maxAttendees: "1" });
  D.L.cash = await mkListing("co", `SCR cash ${stamp}`, {}, { passes: one });
  D.L.bank = await mkListing("co", `SCR bank ${stamp}`, {}, { passes: one });
  D.L.free = await mkListing("co", `SCR free ${stamp}`, {}, { passes: [{ name: "1 day", days: 0 + 1, price: 0 }] });
  D.L.appr = await mkListing("co", `SCR approval ${stamp}`, { bookingType: "manual" }, { passes: one });
  D.L.ebfut = await mkListing("co", `SCR ebfuture ${stamp}`, { discounts: eb(iso(addDays(today, 6))) }, { passes: one });
  D.L.ebblank = await mkListing("co", `SCR ebblank ${stamp}`, { discounts: eb("") }, { passes: one });
  try { D.L.ebpast = await mkListing("co", `SCR ebpast ${stamp}`, { discounts: eb(iso(addDays(today, -3))) }, { passes: one }); } catch (e) { say("ebpast create failed", (e as Error).message); }
  D.L.multi = await mkListing("co", `SCR multi ${stamp}`);
  saveD();
  // data bookings
  const dstr = sd(0, 0);
  D.pC_wait = (await book("pC", D.L.wait, [dstr], "1 day", {}, "Wc" + stamp)).json.bookings[0];
  const w = await book("pB", D.L.wait, [dstr], "1 day", {}, "Wb" + stamp);
  D.pB_wait = w.json.bookings?.[0]; say("pB waitlist booking", w.status, D.pB_wait?.status, D.pB_wait?.pay, D.pB_wait?.amount);
  D.pB_one = await bookOk("pB", D.L.dash, [sd(0, 1)], "1 day");
  D.pA_one = await bookOk("pA", D.L.dash, [sd(0, 2)], "1 day");
  const t = await book("pA", D.L.term, await sessionDates("co", D.L.term), "Term", {}, "Tm" + stamp);
  D.pA_term = t.json.bookings; say("pA term rows", t.status, D.pA_term?.length, JSON.stringify((D.pA_term ?? []).map((b: any) => [b.ref, b.bid, b.amount, b.days])));
  saveD();
  D.done = true; saveD();
});

const bodyTxt = async (p: Page) => (await p.locator("body").innerText()).replace(/\n+/g, " | ");
const apiBookings = async (k: string) => ((await ok(k, "GET", "/api/my/bookings")) as any);
T("S1", async () => {
  if (process.env.SCR_ONLY && !process.env.SCR_ONLY.includes("S1")) return;
  for (const k of ["pB", "pA"]) {
    const bl = await apiBookings(k); const arr = Array.isArray(bl) ? bl : bl.bookings;
    say(k, "API bookings", JSON.stringify(arr.map((b: any) => [b.ref, b.status, b.pay, b.amount, b.amountPaid])));
    for (const mob of [false, true]) {
      const p = await newPage(k, "/custdash", mob);
      const f = await snap(p, "S1", `${k}.dash.${mob ? "m" : "d"}`, [/to pay due|\d+ to pay/i, /Changed your mind/]);
      say(f, (await bodyTxt(p)).slice(0, 700));
      if (!mob) {
        const link = p.getByRole("link", { name: /Changed your mind/ });
        say(k, "cancel link count", await link.count(), "href", await link.first().getAttribute("href").catch(() => null));
        if (await link.count()) {
          await link.first().click();
          await p.waitForTimeout(3500);
          say(k, "after click URL", p.url());
          say("shot", await snap(p, "S1", `${k}.afterCancelClick`));
          say((await bodyTxt(p)).slice(0, 900));
        }
      }
      await p.close();
    }
  }
});

T("S2", async () => {
  if (process.env.SCR_ONLY && !process.env.SCR_ONLY.includes("S2")) return;
  for (const [k, mob] of [["pA", false], ["pA", true], ["pB", false]] as [string, boolean][]) {
    const p = await newPage(k, "/custdash/bookings?tab=payments", mob);
    const f = await snap(p, "S2", `${k}.pay.${mob ? "m" : "d"}`, [/£/]);
    say(f, (await bodyTxt(p)).replace(/.*My payments/, "").slice(0, 900));
    await p.close();
  }
  // pA mobile bookings list
  { const p = await newPage("pA", "/custdash/bookings", true); say(await snap(p, "S2", "pA.list.m", [/Still to pay/])); await p.close(); }
  // pay modal on one row
  { const p = await newPage("pA", "/custdash/bookings"); await p.getByRole("button", { name: /^Pay £12.00/ }).first().click(); await p.waitForTimeout(4000); say(await snap(p, "S2", "pA.paymodal")); await p.close(); }
  // change dates on a row
  { const p = await newPage("pA", "/custdash/bookings"); await p.getByRole("button", { name: /Change dates/ }).first().click(); await p.waitForTimeout(2500); say(await snap(p, "S2", "pA.changedates")); await p.close(); }
  // cancel one row of the multi-week set (SCR-10316-style: first Term row)
  { const p = await newPage("pA", `/custdash/bookings?cancel=${D.pA_term[0].ref}`);
    await p.getByText(/Request cancellation/).first().waitFor({ timeout: 45_000 });
    say("cancel panel", await snap(p, "S2", "pA.cancelpanel"));
    say((await bodyTxt(p)).replace(/.*Request cancellation/, "Request cancellation").slice(0, 500));
    await p.getByRole("button", { name: /Send cancellation request/ }).click(); await p.waitForTimeout(3500);
    say("after cancel", await snap(p, "S2", "pA.aftercancel"));
    const bl = await apiBookings("pA"); const arr = Array.isArray(bl) ? bl : bl.bookings;
    say("pA after", JSON.stringify(arr.map((b: any) => [b.ref, b.status, b.pay, b.amount, b.cancel?.refund])));
    await p.close(); }
  { const p = await newPage("pA", "/custdash"); say(await snap(p, "S2", "pA.dash.after", [/to pay/])); say((await bodyTxt(p)).match(/\d+ to pay \| [^|]*/)?.[0]); await p.close(); }
});

async function uiRun(k: string, Lx: Listing, tag: string, o: { child: string; method?: string; wk?: number; chip?: RegExp; add?: RegExp; hold?: boolean }) {
  await newChild(k, o.child);
  const p = await newPage(k, `/book/${Lx.id}`, false);
  await uiPick(p, o.child, o);
  await snap(p, "S3", `${tag}.pay`);
  if (o.hold) return p;
  await uiConfirm(p, o.method);
  await p.getByText(/Nearly there|booked in|waiting list|request|received|Booked|cash|transfer|🎉/i).first().waitFor({ timeout: 45_000 }).catch(() => {});
  await p.waitForTimeout(2500);
  const f = await snap(p, "S3", `${tag}.done`);
  say(tag, f, "H2:", await p.locator("h2").allInnerTexts(), "|", (await bodyTxt(p)).replace(/.*(Nearly there|You're on|received|booked)/i, "$1").slice(0, 700));
  return p;
}
T("S3", async () => {
  if (process.env.SCR_ONLY && !process.env.SCR_ONLY.includes("S3")) return;
  const one = /^1 day/;
  for (const [tag, k, key, method] of [["card-disc", "pD", "ebfut", undefined], ["cash", "pE", "cash", "cash"], ["bank", "pF", "bank", "bank"], ["free", "pG", "free", undefined], ["approval", "pH", "appr", undefined]] as [string, string, string, string | undefined][]) {
    try { const p = await uiRun(k, L(key), tag, { child: "C" + tag.replace(/\W/g, "") + stamp, method, chip: one, add: /ADD 1 DAY|ADD .* TO BASKET/i }); await p.close(); } catch (e) { say(tag, "ERR", (e as Error).message.slice(0, 300)); }
  }
  // waitlist: pG joins full listing (pC holds the only place on Mon wk0)
  try { const p = await uiRun("pD", L("wait"), "waitlist", { child: "Cwl" + stamp, chip: one, add: /ADD 1 DAY|ADD .* TO BASKET/i }); await p.close(); } catch (e) { say("waitlist ERR", (e as Error).message.slice(0, 300)); }
  // multi-week: 5 days wk0 + 3 days wk1, card
  try {
    const nm = "Cmw" + stamp; await newChild("pH", nm);
    const p = await newPage("pH", `/book/${L("multi").id}`);
    await p.getByText(/Tap a week/).first().waitFor({ timeout: 45_000 });
    await p.getByRole("button", { name: monRe() }).first().click();
    await p.getByRole("button", { name: /ADD 5 DAYS TO BASKET/i }).click();
    await p.getByRole("button", { name: /^3 days · £54/ }).first().click();
    for (const d of [0, 1, 2]) { const dd = addDays(nextMonday, 7 + d).getDate(); await p.getByRole("button", { name: new RegExp("^" + ["Mon", "Tue", "Wed"][d] + "\\s*" + dd + "$", "i") }).first().click(); }
    await p.getByRole("button", { name: /ADD 3 DAYS TO BASKET/i }).click();
    await p.getByRole("button", { name: /NEXT — ADD CHILDREN/i }).click();
    await p.getByRole("button", { name: new RegExp(nm) }).first().click();
    await p.getByRole("button", { name: "Next", exact: true }).click();
    await p.getByPlaceholder("e.g. 07700 900123").waitFor({ timeout: 45_000 });
    await snap(p, "S3", "multiweek.pay");
    await uiConfirm(p);
    await p.getByText(/Nearly there/).first().waitFor({ timeout: 45_000 }); await p.waitForTimeout(2500);
    say("multiweek", await snap(p, "S3", "multiweek.done"), await p.locator("h2").allInnerTexts(), (await bodyTxt(p)).match(/\d+ bookings[^|]*/)?.[0]);
    await p.close();
  } catch (e) { say("multiweek ERR", (e as Error).message.slice(0, 300)); }
  // mobile done view for card
  try { const p = await newPage("pD", `/book/${L("dash").id}`, true); void p; await p.close(); } catch { /* */ }
});

T("S4", async () => {
  if (process.env.SCR_ONLY && !process.env.SCR_ONLY.includes("S4")) return;
  if (!D.opL) {
    D.opL = {};
    for (const k of ["fl", "fr"]) {
      D.opL[k] = await mkListing(k, `SCR term ${k} ${stamp}`, { bookRules: { Term: "blocks" } }, { passes: [{ name: "Term", days: 10, price: 120 }, { name: "1 day", days: 1, price: 15 }], from: wed(0), to: wed(9), days: [3] });
    }
    D.opL.co = D.L.term;
    for (const k of ["co", "fl", "fr"]) {
      const ds = await sessionDates(k, D.opL[k]);
      const r1 = await book("pOp", D.opL[k], ds, "Term", {}, "Opa" + stamp);
      const r2 = await book("pOp", D.opL[k], ds, "Term", {}, "Opb" + stamp);
      D.opL[k + "_refs"] = [...(r1.json.bookings ?? []), ...(r2.json.bookings ?? [])].map((b: any) => b.ref);
      say(k, "op bookings", r1.status, r2.status, D.opL[k + "_refs"].length);
    }
    saveD();
  }
  for (const k of ["co", "fl", "fr"]) {
    const refs: string[] = D.opL[k + "_refs"];
    const p = await newPage(k, `/${PORTAL[k]}/bookings`);
    await p.getByText(refs[3] ?? refs[0]).first().waitFor({ timeout: 60_000 }).catch(() => {});
    say(k, "list", await snap(p, "S4", `${k}.list`), (await bodyTxt(p)).slice(0, 1200));
    const search = p.getByPlaceholder(/search/i).first();
    say(k, "search box", await search.count());
    if (await search.count()) {
      await search.fill(refs[5]); await p.waitForTimeout(1500);
      say(k, "search by ref", refs[5], await snap(p, "S4", `${k}.search`), "rows:", await p.getByText(/SCR-\d+/).count());
      await search.fill("Opa" + stamp); await p.waitForTimeout(1500);
      say(k, "search by child", "rows:", await p.getByText(/SCR-\d+/).count());
    }
    await p.close();
  }
  { const p = await newPage("co", `/company/bookings`, true); say("co mobile", await snap(p, "S4", "co.list.m", [/SCR-/])); await p.close(); }
});

T("S5", async () => {
  if (process.env.SCR_ONLY && !process.env.SCR_ONLY.includes("S5")) return;
  const tid = A.co.tenantId;
  for (const key of ["ebfut", "ebblank", "ebpast"]) {
    const Lx = L(key);
    if (!Lx) { say(key, "missing"); continue; }
    const p = await newPage("pG", `/book/${Lx.id}`);
    say(key, "listing page", await snap(p, "S5", `${key}.listing`, [/Tap a week|Choose/]));
    const t = await bodyTxt(p); say(key, "discount text:", t.match(/.{0,100}(early|Early|Book by|book by|£10.00 off).{0,140}/g)?.slice(0, 4));
    await p.close();
  }
  { const p = await newPage("pG", `/custdash/browse`); await p.waitForTimeout(3000);
    const s = p.getByPlaceholder(/search/i).first(); if (await s.count()) { await s.fill("SCR eb"); await p.waitForTimeout(2000); }
    say("browse", await snap(p, "S5", "browse")); const t = await bodyTxt(p); say("browse eb text:", t.match(/SCR eb\w+ \w+.{0,200}/g));
    await p.close(); }
  { const p = await newPage("pG", `/store/${tid}`); await p.waitForTimeout(3000);
    say("store", await snap(p, "S5", "store")); const t = await bodyTxt(p); say("store eb text:", t.match(/SCR eb\w+ \w+.{0,200}/g));
    await p.close(); }
  // fixed early bird used: pD already holds ebfut wk0 (S3); second booking wk1
  { const nm = "Cused" + stamp; await newChild("pD", nm);
    const p = await newPage("pD", `/book/${L("ebfut").id}`);
    try { await uiPick(p, nm, { wk: 1, chip: /^1 day/, add: /ADD 1 DAY|ADD .* TO BASKET/i }); } catch (e) { say("used pick ERR", (e as Error).message.slice(0, 200)); }
    say("used note", await snap(p, "S5", "used.pay"), /already on an earlier booking/.test(await bodyTxt(p))); await p.close(); }
});

T("S6", async () => {
  if (process.env.SCR_ONLY && !process.env.SCR_ONLY.includes("S6")) return;
  { const p = await newPage("pG", `/custdash/browse`);
    await p.getByText(/SCR (eb|dash|term)/).first().waitFor({ timeout: 60_000 }).catch(() => {});
    await p.waitForTimeout(2500);
    const s = p.getByPlaceholder(/search/i).first(); if (await s.count()) { await s.fill("SCR eb"); await p.waitForTimeout(2000); }
    say("browse", await snap(p, "S6", "browse")); const t = await bodyTxt(p); say("browse text:", t.slice(t.indexOf("SCR eb") - 100, t.indexOf("SCR eb") + 900));
    await p.close(); }
  // waitlist UI
  { const nm = "Cwl" + stamp; const p = await newPage("pD", `/book/${L("wait").id}`);
    await p.waitForTimeout(5000); say("wait page", await snap(p, "S6", "wait.listing")); say((await bodyTxt(p)).slice(0, 800)); await p.close(); }
  // multiweek: debug
  { const nm = "Cmw" + stamp; const p = await newPage("pH", `/book/${L("multi").id}`);
    try {
    await p.getByText(/Tap a week/).first().waitFor({ timeout: 45_000 });
    await p.getByRole("button", { name: monRe() }).first().click();
    await p.getByRole("button", { name: /ADD 5 DAYS TO BASKET/i }).click();
    await p.getByRole("button", { name: /^3 days · £54/ }).first().click();
    for (const d of [0, 1, 2]) { const dd = addDays(nextMonday, 7 + d).getDate(); await p.getByRole("button", { name: new RegExp("^" + ["Mon", "Tue", "Wed"][d] + "\\s*" + dd + "$", "i") }).first().click(); }
    await p.getByRole("button", { name: /ADD 3 DAYS TO BASKET/i }).click();
    await p.getByRole("button", { name: /NEXT — ADD CHILDREN/i }).click();
    await p.waitForTimeout(1500); say("mw children", await snap(p, "S6", "mw.children"));
    const btns = await p.locator("button:visible").allInnerTexts(); say("mw btns", JSON.stringify(btns).slice(0, 600));
    } catch (e) { say("mw ERR", (e as Error).message.slice(0, 200), await snap(p, "S6", "mw.err")); }
    await p.close(); }
});

T("S7", async () => {
  if (process.env.SCR_ONLY && !process.env.SCR_ONLY.includes("S7")) return;
  const nm = "Cmw" + stamp; await newChild("pH", nm);
  { const p = await newPage("pH", `/book/${L("multi").id}`);
    try {
      await p.getByText(/Tap a week/).first().waitFor({ timeout: 45_000 });
      await p.getByRole("button", { name: monRe() }).first().click();
      await p.getByRole("button", { name: /ADD 5 DAYS TO BASKET/i }).click();
      await p.getByRole("button", { name: /^3 days · £54/ }).first().click();
      for (const d of [0, 1, 2]) { const dd = addDays(nextMonday, 7 + d).getDate(); await p.getByRole("button", { name: new RegExp("^" + ["Mon", "Tue", "Wed"][d] + "\\s*" + dd + "$", "i") }).first().click(); }
      await p.getByRole("button", { name: /ADD 3 DAYS TO BASKET/i }).click();
      await p.getByRole("button", { name: /NEXT — ADD CHILDREN/i }).click();
      await p.locator("button").filter({ hasText: nm }).first().click();
      await p.waitForTimeout(800); say("mw btns", JSON.stringify(await p.locator("button:visible").allInnerTexts()).slice(0, 500));
      await p.getByRole("button", { name: /Choose days for each child/ }).click(); await p.waitForTimeout(1000); say("mw days", await snap(p, "S7", "mw.days"), JSON.stringify(await p.locator("button:visible").allInnerTexts()).slice(0, 500));
      await p.getByRole("button", { name: "Next", exact: true }).click();
      await p.getByText(/How you.ll pay/i).first().waitFor({ timeout: 30_000 });
      say("mw pay", await snap(p, "S7", "mw.pay"));
      await uiConfirm(p);
      await p.getByText(/Nearly there/).first().waitFor({ timeout: 45_000 }); await p.waitForTimeout(2500);
      say("mw done", await snap(p, "S7", "mw.done"), (await bodyTxt(p)).slice(0, 1100));
    } catch (e) { say("mw ERR", (e as Error).message.slice(0, 200), await snap(p, "S7", "mw.err")); }
    await p.close(); }
  { const c = "Cwl" + stamp; await newChild("pD", c);
    const p = await newPage("pD", `/book/${L("wait").id}`);
    try {
      await p.getByText(/Tap every day|Tap a week/).first().waitFor({ timeout: 45_000 });
      await p.getByRole("button", { name: /^1 day · £20/ }).first().click();
      await p.getByRole("button", { name: monRe() }).first().click();
      await p.getByRole("button", { name: /Join the waiting list/i }).click().catch(() => {}); await p.waitForTimeout(800);
      say("wl btns", JSON.stringify(await p.locator("button:visible").allInnerTexts()).slice(0, 700), await snap(p, "S7", "wl.picked"));
            await p.getByRole("button", { name: /Join the waiting list/i }).click().catch(() => {});
      await p.locator("button").filter({ hasText: c }).first().click();
      await p.waitForTimeout(800); say("wl btns2", JSON.stringify(await p.locator("button:visible").allInnerTexts()).slice(-300));
      await p.getByRole("button", { name: "Next", exact: true }).click();
      await p.getByText(/How you.ll pay/i).first().waitFor({ timeout: 30_000 });
      say("wl pay", await snap(p, "S7", "wl.pay"));
      await uiConfirm(p);
      await p.getByText(/waiting list/i).first().waitFor({ timeout: 45_000 }); await p.waitForTimeout(2500);
      say("wl done", await snap(p, "S7", "wl.done"), (await bodyTxt(p)).slice(0, 800));
    } catch (e) { say("wl ERR", (e as Error).message.slice(0, 200), await snap(p, "S7", "wl.err")); }
    await p.close(); }
});
