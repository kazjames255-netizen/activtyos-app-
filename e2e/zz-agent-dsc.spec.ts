import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test, chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { API_URL, ROOT, WEB_URL } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, fbSignIn, fbSignUp } from "./helpers/accounts";

test.describe.configure({ mode: "serial" });
const SHOTS = path.join(ROOT, "e2e/review/shots/dsc");
const CACHE = path.join(SHOTS, "accounts.json");
const RESULTS_PATH = path.join(SHOTS, "results.json");
fs.mkdirSync(SHOTS, { recursive: true });
const ONLY = process.env.DSC_ONLY ? process.env.DSC_ONLY.split(",") : null;

type Kind = "co" | "fl" | "fr" | "p";
const TRACKER: Record<string, string> = { co: "company", fl: "freelancer", fr: "franchise", p: "parent" };
const PORTAL: Record<string, string> = { co: "company", fl: "freelancer", fr: "franchise", p: "custdash" };
interface Res { id: string; kind: Kind; ok: boolean; note: string; shots: string[]; blocked?: boolean }
const results: Res[] = fs.existsSync(RESULTS_PATH) ? JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8")) : [];
const saveResults = () => fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));

interface Acct { email: string; uid: string; tenantId: string | null; franchiseId?: string | null; tok: string; tokAt: number }
let A: Record<string, Acct> = {};
const stamp = process.env.DSC_STAMP ?? Date.now().toString(36);
const email = (n: string) => `e2e-dsc-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`;
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
async function ctxFor(k: string): Promise<BrowserContext> {
  if (ctxs[k]) return ctxs[k];
  if (!theBrowser || !theBrowser.isConnected()) theBrowser = await chromium.launch();
  for (let attempt = 0; ; attempt++) {
    const ctx = await theBrowser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    try {
      await page.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      const em = A[k === "p" ? "p1" : k].email;
      for (let i = 0; i < 8; i++) {
        await page.waitForTimeout(1500);
        await page.getByPlaceholder("you@example.com").fill(em);
        await page.locator('input[type="password"]').fill(TEST_PASSWORD);
        await page.waitForTimeout(400);
        if ((await page.getByPlaceholder("you@example.com").inputValue()) === em && (await page.locator('input[type="password"]').inputValue()) === TEST_PASSWORD) break;
      }
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
      await page.close(); ctxs[k] = ctx; return ctx;
    } catch (e) { await ctx.close().catch(() => {}); if (attempt >= 5) throw e; }
  }
}
let lastPage: Page | null = null;
async function newPage(k: string, url: string): Promise<Page> {
  const ctx = await ctxFor(k);
  const page = await ctx.newPage(); lastPage = page;
  await page.goto(`${WEB_URL}${url}`, { waitUntil: "load", timeout: 120_000 });
  return page;
}
/** Wait for the text, then for no "Loading" text, then take a full-page shot. */
async function snap(page: Page, id: string, tag: string, wait: (string | RegExp)[] = []) {
  for (const w of wait) await page.getByText(w).first().waitFor({ state: "visible", timeout: 45_000 });
  await page.waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.innerText), null, { timeout: 45_000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const f = path.join(SHOTS, `${id}${tag ? "." + tag : ""}.png`);
  await page.screenshot({ path: f, fullPage: true });
  return path.relative(ROOT, f);
}

const T = (name: string, fn: () => Promise<void>) => test(name, async () => { test.setTimeout(3_000_000); try { await fn(); } catch (e) { console.log(`TEST ABORT ${name}: ${(e as Error).message.slice(0, 400)}`); } });
async function check(id: string, kind: Kind, fn: (shots: string[]) => Promise<string>) {
  if (ONLY && !ONLY.includes(id)) return;
  const shots: string[] = [];
  let r: Res; warns = [];
  try { const n = await fn(shots); r = { id, kind, ok: true, note: n + (warns.length ? " | WARN: " + warns.join("; ") : ""), shots }; }
  catch (e) { await lastPage?.screenshot({ path: path.join(SHOTS, `dbg.fail.${id}.png`), fullPage: true }).catch(() => {}); r = { id, kind, ok: false, note: (e as Error).message.slice(0, 700), shots }; }
  const i = results.findIndex((x) => x.id === id && x.kind === kind); if (i >= 0) results.splice(i, 1);
  results.push(r); saveResults();
  console.log(`${r.ok ? "PASS" : "FAIL"} ${id} [${kind}] ${r.note}`);
}

// provisioning
const venueDone = new Set<string>();
async function ensureVenue(k: string) {
  if (venueDone.has(k)) return "dsc-venue";
  const lib = (await call(k, "GET", "/api/library")).json ?? {};
  const venues = (lib.venues ?? []) as { id: string }[];
  await ok(k, "PUT", "/api/library", { venues: venues.some((v) => v.id === "dsc-venue") ? venues : [...venues, { id: "dsc-venue", name: "DSC Sports Hall", address: "1 Test Way", city: "Northampton" }], settings: { ...(lib.settings ?? {}), marketplaceListed: true, seasons: [{ id: "s-dsc", name: "DSC Autumn" }] } });
  venueDone.add(k); return "dsc-venue";
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
  await p.getByText(childName).first().click();
  await p.getByRole("button", { name: "Next", exact: true }).click();
  await p.getByText(/^Total$/).first().waitFor({ timeout: 45_000 });
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
  if (fs.existsSync(CACHE) && !process.env.DSC_FRESH) {
    A = JSON.parse(fs.readFileSync(CACHE, "utf8"));
    for (const k of Object.keys(A)) { A[k].tok = (await fbSignIn(A[k].email)).idToken; A[k].tokAt = Date.now(); }
    return;
  }
  await signupParent("p1"); await signupParent("p2"); await signupParent("p3");
  await signupOperator("co", "company", `DSC Co ${stamp}`);
  unwall(A.co.tenantId!);
  fs.writeFileSync(CACHE, JSON.stringify(A, null, 1));
  console.log("ACCOUNTS", Object.entries(A).map(([k, v]) => `${k}=${v.email}`).join(" "));
});
test.afterAll(async () => { for (const c of Object.values(ctxs)) await c?.close().catch(() => {}); await theBrowser?.close().catch(() => {}); });

// ======= CHECKS GO BELOW =======

const FAR = "2030-01-01";
let ruleN = 0;
const R = (kind: "person" | "session" | "early", method: "percent" | "subtract" | "price", value: number, o: Record<string, unknown> = {}) => ({ id: `r${stamp}${++ruleN}`, kind, name: o.name ?? `${kind} ${method} ${value}`, passNames: [], enabled: true, moreThan: kind === "session" ? 3 : 1, appliesTo: "all", method, value, beforeDate: kind === "early" ? FAR : "", ...o });
const wk = (w: number) => [0, 1, 2, 3, 4].map((d) => sd(w, d));
const sum = (r: any) => Math.round(r.json.bookings.reduce((s: number, b: any) => s + (b.amount ?? 0), 0) * 100) / 100;
async function basket(parent: string, L: Listing, items: { pass: string; child: string; dates: string[] }[], extra: Record<string, unknown> = {}) {
  const r = await call(parent, "POST", "/api/my/bookings", { listingId: L.id, blockId: L.blockId, method: "card", items: items.map((i) => ({ ...i, age: 8 })), ...extra });
  if (r.status >= 300) throw new Error(`basket -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  return r;
}
const KA = () => kid("A"); 
const rows: string[] = [];
const rec = (s: string) => { rows.push(s); };

T("API-person", async () => {
  await check("D1-person-pct-only", "co", async () => {
    const ru = R("person", "percent", 10);
    const L = await mkListing("co", `DSC person ${stamp}`, { discounts: [ru] });
    // validation
    const bad = await call("co", "POST", "/api/listings", { title: "bad sub", venueId: await ensureVenue("co"), status: "draft", discounts: [R("person", "subtract", 5)] });
    eq(bad.status, 400, "POST person subtract");
    const bad2 = await call("co", "POST", "/api/listings", { title: "bad price", venueId: await ensureVenue("co"), status: "draft", discounts: [R("person", "price", 5)] });
    eq(bad2.status, 400, "POST person price");
    const full = await ok("co", "GET", `/api/listings/${L.id}`);
    const put = (d: unknown) => call("co", "PUT", `/api/listings/${L.id}`, { ...full, discounts: d, updatedAt: undefined });
    const chg = await put([{ ...ru, method: "subtract", value: 5 }]);
    const add = await put([ru, R("person", "subtract", 5)]);
    // bypass attempt: an existing non-person fixed rule re-kinded to person (same id/method/value)
    const early = R("early", "subtract", 5);
    const L2 = await mkListing("co", `DSC rekind ${stamp}`, { discounts: [early] });
    const full2 = await ok("co", "GET", `/api/listings/${L2.id}`);
    const rekind = await call("co", "PUT", `/api/listings/${L2.id}`, { ...full2, discounts: [{ ...early, kind: "person", moreThan: 1 }] });
    const stored = (await ok("co", "GET", `/api/listings/${L2.id}`)).discounts;
    rec(`PUT change pct->subtract=${chg.status}; PUT add new subtract=${add.status}; PUT re-kind early-fixed to person=${rekind.status} stored kind=${stored?.[0]?.kind}/${stored?.[0]?.method}`);
    eq(chg.status, 400, "PUT change"); eq(add.status, 400, "PUT add");
    // pricing
    const A1 = KA(), B1 = KA();
    const two = await basket("p1", L, [{ pass: "5 days", child: A1, dates: wk(0) }, { pass: "5 days", child: B1, dates: wk(1) }]);
    eq(sum(two), 162, "A wk0 + B wk1 together");
    const one = await basket("p2", L, [{ pass: "5 days", child: KA(), dates: wk(0) }]); eq(sum(one), 90, "single child");
    const s1 = await basket("p3", L, [{ pass: "5 days", child: KA(), dates: wk(0) }]);
    const s2 = await basket("p3", L, [{ pass: "5 days", child: KA(), dates: wk(1) }]);
    eq(sum(s1) + sum(s2), 180, "two separate checkouts");
    const same = await basket("p2", L, [{ pass: "5 days", child: KA(), dates: wk(2) }, { pass: "5 days", child: KA(), dates: wk(2) }]); eq(sum(same), 162, "two kids same week");
    // one child on two weeks = still one child
    const oneTwo = await basket("p3", L, [{ pass: "5 days", child: A1, dates: wk(2) }, { pass: "3 days", child: A1, dates: [sd(2, 0), sd(2, 1), sd(2, 2)] }]).catch((e) => ({ err: String(e).slice(0, 150) }));
    rec("one child two lines: " + JSON.stringify((oneTwo as any).err ?? sum(oneTwo)));
    return rows.slice(-2).join(" | ") + ` | pricing: A+B diff weeks 162, single 90, separate 180, same wk 162`;
  });
});

T("API-early", async () => {
  await check("D2-early-fixed", "co", async () => {
    const mk = (suffix: string, rules: any[], extra: Record<string, unknown> = {}) => mkListing("co", `DSC early ${suffix} ${stamp}`, { discounts: rules, ...extra });
    const L = await mk("fixed", [R("early", "subtract", 10)]);
    const a = await basket("p1", L, [{ pass: "5 days", child: KA(), dates: wk(0) }]); eq(sum(a), 80, "first (unpaid card) gets £10");
    const gA = await ok("p1", "GET", `/api/listings/${L.id}`); const gB = await ok("p2", "GET", `/api/listings/${L.id}`);
    eq(!!gA.earlyFixedUsed, true, "GET p1 earlyFixedUsed"); eq(!!gB.earlyFixedUsed, false, "GET p2 earlyFixedUsed");
    const anon = await call(null, "GET", `/api/listings/${L.id}`); eq(!!anon.json?.earlyFixedUsed, false, "anon");
    const b = await basket("p1", L, [{ pass: "5 days", child: KA(), dates: wk(1) }]); eq(sum(b), 90, "second booking no early");
    const c = await basket("p2", L, [{ pass: "5 days", child: KA(), dates: wk(0) }]); eq(sum(c), 80, "different parent gets it");
    // cancel first -> rebook
    const refA = a.json.bookings[0].ref;
    const cx = await call("p1", "POST", `/api/my/bookings/${refA}/cancel`, {});
    const L1 = await ok("p1", "GET", `/api/listings/${L.id}`);
    // p1 still has booking b (no early stamp) so used=false now
    const d = await basket("p1", L, [{ pass: "5 days", child: KA(), dates: wk(2) }]); eq(sum(d), 80, "rebook after cancel gets it again");
    // same checkout two weeks: once
    const e = await basket("p3", L, [{ pass: "5 days", child: "Z" + KA(), dates: wk(0) }, { pass: "5 days", child: "Z" + KA(), dates: wk(1) }]); 
    rec(`cancel=${cx.status} earlyFixedUsed after cancel=${!!L1.earlyFixedUsed}; one checkout two kids/weeks total=${sum(e)}`);
    // concurrency
    const L3 = await mk("race", [R("early", "subtract", 10)]);
    const race = await Promise.all([0, 1, 2].map((w) => call("p2", "POST", "/api/my/bookings", { listingId: L3.id, blockId: L3.blockId, method: "card", items: [{ pass: "5 days", child: KA(), age: 8, dates: wk(w) }] })));
    rec("race 3 simultaneous: " + race.map((r) => r.status + ":" + (r.json?.bookings ? sum(r) : "-")).join(","));
    return `fixed: first 80, second 90, other parent 80, GET flag p1 true/p2 false/anon false, cancel->rebook 80; ` + rows.slice(-2).join(" | ");
  });
  await check("D2-early-pct-blank-season", "co", async () => {
    const P = await mkListing("co", `DSC early pct ${stamp}`, { discounts: [R("early", "percent", 10)] });
    const x = await basket("p1", P, [{ pass: "5 days", child: KA(), dates: wk(0) }]); const y = await basket("p1", P, [{ pass: "5 days", child: KA(), dates: wk(1) }]);
    eq(sum(x), 81, "pct 1"); eq(sum(y), 81, "pct 2 unlimited");
    const Bl = await mkListing("co", `DSC early blank ${stamp}`, { discounts: [R("early", "subtract", 10, { beforeDate: "" })] });
    const z = await basket("p2", Bl, [{ pass: "5 days", child: KA(), dates: wk(0) }]); eq(sum(z), 80, "blank date applies");
    const z2 = await basket("p2", Bl, [{ pass: "5 days", child: KA(), dates: wk(1) }]); eq(sum(z2), 90, "blank date, second");
    // season: two listings same season, third without season
    const S1 = await mkListing("co", `DSC season1 ${stamp}`, { seasonId: "s-dsc", discounts: [R("early", "subtract", 10)] });
    const S2 = await mkListing("co", `DSC season2 ${stamp}`, { seasonId: "s-dsc", discounts: [R("early", "subtract", 10)] });
    const N = await mkListing("co", `DSC noseason ${stamp}`, { discounts: [R("early", "subtract", 10)] });
    const sd1 = await ok("co", "GET", `/api/listings/${S1.id}`); rec("seasonId stored: " + sd1.seasonId);
    const s1 = await basket("p3", S1, [{ pass: "5 days", child: KA(), dates: wk(0) }]); eq(sum(s1), 80, "season L1");
    const s2 = await basket("p3", S2, [{ pass: "5 days", child: KA(), dates: wk(0) }]);
    const n1 = await basket("p3", N, [{ pass: "5 days", child: KA(), dates: wk(0) }]);
    const g2 = await ok("p3", "GET", `/api/listings/${S2.id}`);
    rec(`season: L2 after L1 same season=${sum(s2)} (want 90); no-season listing=${sum(n1)} (want 80); GET S2 flag=${!!g2.earlyFixedUsed}`);
    eq(sum(s2), 90, "same-season listing"); eq(sum(n1), 80, "no-season listing");
    return `pct unlimited 81/81; blank date 80 then 90; ` + rows.slice(-2).join(" | ");
  });
});

T("API-order", async () => {
  await check("D3-order-codes-edges", "co", async () => {
    const L = await mkListing("co", `DSC order ${stamp}`, { discounts: [R("person", "percent", 10), R("session", "percent", 10), R("early", "percent", 10)] });
    const t = await basket("p1", L, [{ pass: "5 days", child: KA(), dates: wk(0) }, { pass: "5 days", child: KA(), dates: wk(1) }]);
    eq(sum(t), 131.22, "person>session>early");
    const one = await basket("p2", L, [{ pass: "5 days", child: KA(), dates: wk(0) }]); eq(sum(one), 72.9, "one child session+early: 90*.9*.9");
    // session only 3 days -> not >3
    const three = await basket("p3", L, [{ pass: "3 days", child: KA(), dates: [sd(0, 0), sd(0, 1), sd(0, 2)] }]); eq(sum(three), 48.6, "3 days early only");
    return "ok";
  });
});

T("API-edges", async () => {
  await check("D4-codes-behalf-edges", "co", async () => {
    const out: string[] = [];
    const L = await mkListing("co", `DSC codes ${stamp}`, { discounts: [R("session", "percent", 10), R("early", "subtract", 10)] });
    const code = `DSC${stamp.toUpperCase()}`;
    await ok("co", "POST", "/api/discounts", { active: true, code, type: "percent", value: 10 });
    const c = await basket("p1", L, [{ pass: "5 days", child: KA(), dates: wk(0) }], { discountCodes: [code] });
    // 90 -> session 81 -> early 71 -> code 10% => 63.9
    out.push("session+early+code=" + sum(c)); eq(sum(c), 63.9, "code after auto discounts");
    // on behalf
    const fam = `e2e-dsc-fam-${stamp}@${TEST_EMAIL_DOMAIN}`;
    const ob = { onBehalfOf: { name: "Fam Test", email: fam } };
    const b1 = await basket("co", L, [{ pass: "5 days", child: KA(), dates: wk(1) }], ob);
    const b2 = await basket("co", L, [{ pass: "5 days", child: KA(), dates: wk(2) }], ob);
    out.push(`behalf 1st=${sum(b1)} 2nd=${sum(b2)}`);
    eq(sum(b1), 71, "behalf 1st (81-10)"); eq(sum(b2), 81, "behalf 2nd (session only)");
    // 100% early, tiny prices
    const H = await mkListing("co", `DSC hundred ${stamp}`, { discounts: [R("early", "percent", 100)] });
    const h = await basket("p2", H, [{ pass: "5 days", child: KA(), dates: wk(0) }]); out.push("100% total=" + sum(h) + " status=" + h.json.bookings[0].status + " payStatus=" + (h.json.bookings[0].pay ?? h.json.bookings[0].paymentStatus)); eq(sum(h), 0, "100%");
    const Tn = await mkListing("co", `DSC tiny ${stamp}`, { discounts: [R("early", "percent", 33.33), R("person", "percent", 33.33)] }, { passes: [{ name: "1 day", days: 1, price: 0.01 }] });
    const tn = await basket("p2", Tn, [{ pass: "1 day", child: KA(), dates: [sd(0, 0)] }, { pass: "1 day", child: KA(), dates: [sd(1, 0)] }]); out.push("tiny total=" + sum(tn) + " off=" + tn.json.bookings.map((b: any) => b.discountOff)); 
    const F = await mkListing("co", `DSC fixedbig ${stamp}`, { discounts: [R("early", "subtract", 500)] }, { passes: [{ name: "1 day", days: 1, price: 20 }] });
    const fb = await basket("p2", F, [{ pass: "1 day", child: KA(), dates: [sd(0, 0)] }]); out.push("fixed £500 on £20=" + sum(fb)); eq(sum(fb), 0, "min");
    // rows sum check: discountOff + amount == listPrice
    const bk = c.json.bookings[0]; out.push(`row: listPrice=${bk.listPrice} off=${bk.discountOff} amount=${bk.amount} names=${JSON.stringify(bk.discountNames)} scope=${bk.earlyBirdScope}`);
    // expired early
    const X = await mkListing("co", `DSC expired ${stamp}`, { discounts: [R("early", "percent", 10, { beforeDate: "2020-01-01" })] });
    const x = await basket("p2", X, [{ pass: "5 days", child: KA(), dates: wk(0) }]); eq(sum(x), 90, "expired");
    return out.join(" | ");
  });
});

async function nextStep(p: Page) { await p.getByRole("button", { name: /^Next/ }).click(); await p.waitForTimeout(700); }
async function toDiscounts(kind: string, title: string) {
  const p = await openWizard(kind, title, 1);
  for (let i = 0; i < 13; i++) {
    if (await p.getByText("Automatic discounts").first().isVisible().catch(() => false)) break;
    await nextStep(p);
  }
  await p.getByText("Automatic discounts").first().waitFor({ timeout: 20_000 });
  await p.waitForTimeout(800);
  return p;
}
T("UI-wizard", async () => {
  await check("U1-wizard-person", "co", async (shots) => {
    const out: string[] = [];
    const title = `DSC rekind ${stamp}`; // legacy person/subtract rule (created via re-kind)
    let p = await toDiscounts("co", title);
    shots.push(await snap(p, "U1", "step-legacy-list"));
    await p.getByRole("button", { name: "Edit", exact: true }).last().click();
    await p.waitForTimeout(800);
    must(await p.getByText(/set up with a fixed/i).count(), "legacy note shown");
    shots.push(await snap(p, "U1", "legacy-edit"));
    const opts = await p.locator("select").evaluateAll((els) => els.map((e) => (e as HTMLSelectElement).innerText.replace(/\n/g, "|")));
    out.push("legacy selects: " + JSON.stringify(opts.filter((o) => /percent/i.test(o))));
    // change the value of the legacy rule -> autosave
    const val = p.locator('input[type="number"]').last();
    await val.fill("6"); await p.waitForTimeout(3500);
    shots.push(await snap(p, "U1", "legacy-value-changed"));
    const body = await p.locator("body").innerText();
    out.push("err text: " + (body.match(/.{60}(must be a percentage|Couldn.t save|error).{80}/is)?.[0] ?? "").replace(/\s+/g," ")); out.push("after legacy value 5->6: " + (/must be a percentage|Couldn.t save|error/i.test(body) ? "ERROR SHOWN" : "no error text"));
    const stored = (await ok("co", "GET", `/api/listings/${(await ok("co", "GET", "/api/listings?mine=1")).find((l: any) => l.title === title).id}`)).discounts[0];
    out.push(`stored value=${stored.value} method=${stored.method}`);
    await p.getByRole("button", { name: "Save changes" }).last().click(); await p.waitForTimeout(3500);
    shots.push(await snap(p, "U1", "legacy-after-wizard-save"));
    out.push("after wizard Save: wizard open=" + (await p.getByText(/^Step \d+ of 13/).count()) + " toast=" + ((await p.locator("body").innerText()).match(/(could not|couldn.t|failed|percentage \()[^\n]{0,100}/i)?.[0] ?? "none"));
    // Cancel after edit
    await val.fill("7"); await p.waitForTimeout(500);
    await p.getByRole("button", { name: "Cancel", exact: true }).first().click(); await p.waitForTimeout(3500);
    shots.push(await snap(p, "U1", "after-cancel"));
    const stored2 = (await ok("co", "GET", `/api/listings/${(await ok("co", "GET", "/api/listings?mine=1")).find((l: any) => l.title === title).id}`)).discounts[0];
    out.push(`after typing 7 then Cancel stored value=${stored2.value}`);
    await p.close();
    // new person rule
    p = await toDiscounts("co", `DSC person ${stamp}`);
    await p.getByRole("button", { name: /Multi.?person|Siblings/i }).first().click(); await p.waitForTimeout(800);
    const sel = await p.locator("select").evaluateAll((els) => els.map((e) => Array.from((e as HTMLSelectElement).options).map((o) => o.text).join("|")));
    out.push("new person selects: " + JSON.stringify(sel.filter((o) => /percent/i.test(o))));
    shots.push(await snap(p, "U1", "new-person"));
    await p.close();
    return out.join(" | ");
  });
  await check("U2-wizard-early-edit", "co", async (shots) => {
    const out: string[] = [];
    const title = `DSC early fixed ${stamp}`;
    const p = await toDiscounts("co", title);
    await p.getByRole("button", { name: "Edit", exact: true }).last().click(); await p.waitForTimeout(800);
    shots.push(await snap(p, "U2", "early-edit", [/once per family per season/]));
    await p.locator('input[type="date"]').last().fill("2031-02-03"); await p.waitForTimeout(500);
    await p.waitForTimeout(2500); await p.getByRole("button", { name: "Save changes" }).last().click(); await p.getByText(/^Step \d+ of 13/).waitFor({ state: "hidden", timeout: 25000 }).catch(() => {}); await p.waitForTimeout(1500);
    const lid = (await ok("co", "GET", "/api/listings?mine=1")).find((l: any) => l.title === title).id;
    const st = (await ok("co", "GET", `/api/listings/${lid}`)).discounts[0];
    out.push("date after only wizard Save changes: " + st.beforeDate); eq(st.beforeDate, "2031-02-03", "date saved");
    await p.close();
    // blank date message
    const p2 = await toDiscounts("co", `DSC early blank ${stamp}`);
    await p2.getByRole("button", { name: "Edit", exact: true }).last().click(); await p2.waitForTimeout(800);
    shots.push(await snap(p2, "U2", "blank-date", [/runs continuously/]));
    await p2.close();
    return out.join(" | ");
  });
});

async function finish(p: Page) {
  if (await p.getByPlaceholder("e.g. 07700 900123").count()) await p.getByPlaceholder("e.g. 07700 900123").fill("07700900123");
  const btn = p.locator("button:visible").filter({ hasText: /^(Pay|Book|Confirm|Complete|Reserve|Place|Add)/i }).last();
  await p.waitForTimeout(600);
  const label = (await btn.innerText()).trim();
  await btn.click();
  await p.waitForTimeout(4000); await p.screenshot({ path: path.join(SHOTS, "dbg.afterfinish.png"), fullPage: true });
  return label;
}
T("UI-parent", async () => {
  await check("U3-parent-early", "p", async (shots) => {
    const out: string[] = [];
    const L = await mkListing("co", `DSC ui early ${stamp}`, { discounts: [R("early", "subtract", 10, { name: "Early bird £10 off" })] });
    const c1 = "Ea" + stamp + "n", c2 = "Eb" + stamp + "n";
    await newChild("p1", c1); await newChild("p1", c2);
    let p = await newPage("p", `/book/${L.id}`);
    shots.push(await snap(p, "U3", "book-page-1", ["Tap a week"]));
    await p.getByRole("button", { name: monRe() }).first().click();
    await p.getByRole("button", { name: /ADD 5 DAYS TO BASKET/i }).click();
    await p.getByRole("button", { name: /NEXT — ADD CHILDREN/i }).click();
    await p.waitForTimeout(2500); await p.screenshot({ path: path.join(SHOTS, "dbg.children.png"), fullPage: true });
    await p.getByText(c1).first().click();
    await p.getByRole("button", { name: "Next", exact: true }).click();
    await p.getByText(/^Total$/).first().waitFor({ timeout: 45_000 });
    shots.push(await snap(p, "U3", "pay-1", ["You save"]));
    must(await p.getByText(/discount applied/i).count(), "badge");
    out.push("pay-1 badge: " + (await p.getByText(/You save/).first().innerText()));
    out.push("btn: " + await finish(p));
    await p.getByText(/Nearly there|booked in|Booked/i).first().waitFor({ timeout: 45_000 }); await p.getByRole("button", { name: "×" }).first().click().catch(() => {});
    shots.push(await snap(p, "U3", "confirm-1", [/Nearly there/]));
    const body1 = await p.locator("body").innerText();
    out.push("confirm1 has breakdown: " + /Price before discount/.test(body1) + " nearly=" + /Nearly there/.test(body1) + " bookedin=" + /booked in/i.test(body1));
    await p.close();
    p = await newPage("p", `/book/${L.id}`);
    await p.getByText(/Tap a week/).first().waitFor({ timeout: 45_000 });
    shots.push(await snap(p, "U3", "book-page-2"));
    await uiToPay(p, c2);
    shots.push(await snap(p, "U3", "pay-2", [/already on an earlier booking/]));
    out.push("pay-2 badge count=" + await p.getByText(/discount applied/i).count() + " note=" + await p.getByText(/already on an earlier booking/).count());
    out.push("btn2: " + await finish(p));
    await p.getByText(/Nearly there/i).first().waitFor({ timeout: 45_000 }); await p.locator('button:has-text("×")').first().click().catch(() => {});
    shots.push(await snap(p, "U3", "confirm-2"));
    out.push("confirm2 breakdown: " + /Price before discount/.test(await p.locator("body").innerText()));
    await p.close();
    return out.join(" | ");
  });
  await check("U4-parent-person", "p", async (shots) => {
    const out: string[] = [];
    const L = await mkListing("co", `DSC ui person ${stamp}`, { discounts: [R("person", "percent", 10, { name: "Sibling 10% off" })] });
    const c1 = "Pa" + stamp + "n", c2 = "Pb" + stamp + "n";
    await newChild("p1", c1); await newChild("p1", c2);
    const p = await newPage("p", `/book/${L.id}`);
    await p.getByText(/Tap a week/).first().waitFor({ timeout: 45_000 });
    await p.getByRole("button", { name: monRe() }).first().click();
    await p.getByRole("button", { name: /ADD 5 DAYS TO BASKET/i }).click();
    shots.push(await snap(p, "U4", "basket"));
    await p.getByRole("button", { name: /NEXT — ADD CHILDREN/i }).click();
    await p.getByText(c1).first().click();
    await p.getByText(c2).first().click();
    shots.push(await snap(p, "U4", "children"));
    await p.getByRole("button", { name: "Next", exact: true }).click();
    await p.getByText(/^Total$/).first().waitFor({ timeout: 45_000 });
    shots.push(await snap(p, "U4", "pay", ["You save"]));
    const txt = await p.locator("body").innerText();
    out.push("save text: " + (txt.match(/You save[^\n]*/)?.[0] ?? "none") + "; total text: " + (txt.match(/Total[^\n]*\n?[^\n]*/i)?.[0] ?? "").replace(/\n/g, " "));
    out.push("btn: " + await finish(p));
    await p.getByText(/Nearly there/i).first().waitFor({ timeout: 45_000 });
    shots.push(await snap(p, "U4", "confirm"));
    const bk = (await ok("p1", "GET", "/api/my/bookings")) as any[];
    const mine = bk.filter((b) => b.listing === L.title || b.listingId === L.id);
    out.push("server amounts: " + mine.map((b) => b.amount).join(","));
    await p.close();
    return out.join(" | ");
  });
});
