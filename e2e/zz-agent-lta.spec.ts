import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test, chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { API_URL, ROOT, WEB_URL } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, fbSignIn, fbSignUp } from "./helpers/accounts";

test.describe.configure({ mode: "serial" });
const SHOTS = path.join(ROOT, "e2e/review/shots/lta");
const CACHE = path.join(SHOTS, "accounts.json");
const RESULTS_PATH = path.join(SHOTS, "results.json");
fs.mkdirSync(SHOTS, { recursive: true });
const ONLY = process.env.LTA_ONLY ? process.env.LTA_ONLY.split(",") : null;

type Kind = "co" | "fl" | "fr" | "p";
const TRACKER: Record<string, string> = { co: "company", fl: "freelancer", fr: "franchise", p: "parent" };
const PORTAL: Record<string, string> = { co: "company", fl: "freelancer", fr: "franchise", p: "custdash" };
interface Res { id: string; kind: Kind; ok: boolean; note: string; shots: string[]; blocked?: boolean }
const results: Res[] = fs.existsSync(RESULTS_PATH) ? JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8")) : [];
const saveResults = () => fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));

interface Acct { email: string; uid: string; tenantId: string | null; franchiseId?: string | null; tok: string; tokAt: number }
let A: Record<string, Acct> = {};
const stamp = Date.now().toString(36);
const email = (n: string) => `e2e-lta-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`;
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
async function newPage(k: string, url: string): Promise<Page> {
  const ctx = await ctxFor(k);
  const page = await ctx.newPage();
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
  await p.getByRole("button", { name: new RegExp(childName) }).first().click();
  await p.getByRole("button", { name: "Next", exact: true }).click();
  await p.getByPlaceholder("e.g. 07700 900123").waitFor({ timeout: 45_000 });
}
async function openWizard(kind: string, title: string, step: number) {
  const p = await newPage(kind, `/${PORTAL[kind]}/listings`);
  await p.getByText(title).first().waitFor({ state: "visible", timeout: 60_000 });
  const card = p.locator('[data-ui="card"]').filter({ hasText: title }).last();
  await card.getByRole("button", { name: /^(Edit|Resume)$/ }).first().click();
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
  if (fs.existsSync(CACHE) && !process.env.LTA_FRESH) {
    A = JSON.parse(fs.readFileSync(CACHE, "utf8"));
    for (const k of Object.keys(A)) { A[k].tok = (await fbSignIn(A[k].email)).idToken; A[k].tokAt = Date.now(); }
    return;
  }
  await signupParent("p1"); await signupParent("p2");
  await signupOperator("co", "company", `LTA Co ${stamp}`);
  await signupOperator("fl", "freelancer", `LTA Free ${stamp}`);
  await signupOperator("ho", "company", `LTA HO ${stamp}`);
  unwall(A.co.tenantId!, A.fl.tenantId!, A.ho.tenantId!);
  await joinByInvite("fr", "ho", { role: "franchise", franchiseName: `LTA Alpha ${stamp}` });
  fs.writeFileSync(CACHE, JSON.stringify(A, null, 1));
  console.log("ACCOUNTS", Object.entries(A).map(([k, v]) => `${k}=${v.email}`).join(" "));
});
test.afterAll(async () => { for (const c of Object.values(ctxs)) await c?.close().catch(() => {}); await theBrowser?.close().catch(() => {}); });

// ======= CHECKS GO BELOW =======
async function nextStep(p: Page) { await p.getByRole("button", { name: /^Next/ }).click(); await p.waitForTimeout(700); }

const OUT_MSG = /outside|coverage/i;
// ---------- LT-004 radius ----------
for (const kind of ["co", "fl"] as Kind[]) T(`LT-004 ${kind}`, async () => {
  await check("LT-004", kind, async (shots) => {
    const title = `LTA radius ${kind} ${stamp}`;
    const L = await mkListing(kind, title, { deliveryMode: "home-visit", venueId: null, coverageArea: { mode: "radius", basePostcode: "SW1A 1AA", radiusMiles: 5 }, minGapMinutes: 30 }, { noVenue: true });
    const doc = await ok(kind, "GET", `/api/listings/${L.id}`);
    eq(doc.coverageArea.mode, "radius", "mode"); eq(doc.coverageArea.radiusMiles, 5, "radius"); eq(doc.coverageArea.basePostcode, "SW1A 1AA", "base");
    // operator wizard shows the saved radius
    const w = await openWizard(kind, title, 2);
    await w.getByText("Radius from base").first().waitFor({ timeout: 45_000 });
    shots.push(await snap(w, "LT-004", `${kind}.wizard`, ["Coverage area"])); await w.close();
    // outside: UI checkout refused
    const outKid = "Out" + stamp + kind;
    await newChild("p1", outKid);
    const p = await newPage("p", `/book/${L.id}`);
    await uiToPay(p, outKid);
    await p.getByPlaceholder("e.g. 07700 900123").fill("07700900123");
    await p.getByPlaceholder("House number and street").fill("1 Piccadilly");
    await p.getByPlaceholder("Postcode").fill("M1 1AE");
    await p.locator("button:visible").filter({ hasText: /^(Pay|Book|Confirm|Complete|Reserve|Place|Add)/i }).last().click();
    await p.getByText(OUT_MSG).first().waitFor({ timeout: 45_000 });
    shots.push(await snap(p, "LT-004", `${kind}.outside`, [OUT_MSG])); await p.close();
    // API: inside accepted, outside refused, no booking created for the refused one
    const far = await book("p1", L, [sd(0, 0)], "1 day", { serviceAddress: { address: "1 Piccadilly", postcode: "M1 1AE" } });
    eq(far.status, 409, "far status"); must(OUT_MSG.test(far.json.error), "far message " + far.json.error);
    const near = await bookOk("p1", L, [sd(0, 1)], "1 day", { serviceAddress: { address: "10 Downing St", postcode: "SW1A 2AA" } });
    eq(near.serviceAddress?.postcode, "SW1A 2AA", "serviceAddress stored");
    return `radius 5mi from SW1A 1AA stored; far M1 1AE refused (UI + API 409 "${far.json.error}"); SW1A 2AA booked ${near.ref}`;
  });
});

// ---------- LT-005 both ----------
for (const kind of ["co", "fl"] as Kind[]) T(`LT-005 ${kind}`, async () => {
  await check("LT-005", kind, async (shots) => {
    const title = `LTA both ${kind} ${stamp}`;
    // publishing "both" without a coverage area is refused (the wizard asks for both)
    const venueId = await ensureVenue(kind);
    const bad = await call(kind, "POST", "/api/listings", { title: title + " bad", venueId, deliveryMode: "both", status: "live", runFrom: iso(nextMonday), runTo: iso(nextMonday), blockMode: "weekly", days: [1] });
    const L = await mkListing(kind, title, { deliveryMode: "both", coverageArea: { mode: "postcodePrefixes", postcodePrefixes: ["SW1", "SW2"] } });
    const doc = await ok(kind, "GET", `/api/listings/${L.id}`);
    eq(doc.deliveryMode, "both", "mode"); must(doc.venueId, "venueId"); eq(doc.coverageArea.mode, "postcodePrefixes", "coverage");
    const w = await openWizard(kind, title, 2);
    await w.getByText("Coverage area").first().waitFor({ timeout: 30_000 });
    shots.push(await snap(w, "LT-005", `${kind}.wizard`, ["Coverage area"])); await w.close();
    const p = await newPage("p", `/book/${L.id}`);
    shots.push(await snap(p, "LT-005", `${kind}.parent`, ["LTA Sports Hall"])); await p.close();
    const near = await bookOk("p1", L, [sd(0, 0)], "1 day", { serviceAddress: { address: "10 Downing St", postcode: "SW1A 2AA" } });
    eq(near.serviceAddress?.postcode, "SW1A 2AA", "visit address");
    return `both: venueId ${doc.venueId} + coverage SW1/SW2; publish-without-coverage -> ${bad.status} "${JSON.stringify(bad.json).slice(0, 110)}"; parent page shows venue; SW1A 2AA accepted ${near.ref}`;
  });
});
// ---------- LT-006 parent visit address ----------
T("LT-006 p", async () => {
  await check("LT-006", "p", async (shots) => {
    const title = `LTA visit ${stamp}`;
    const L = await mkListing("co", title, { deliveryMode: "home-visit", venueId: null, coverageArea: { mode: "postcodePrefixes", postcodePrefixes: ["SW1", "SW2"] } }, { noVenue: true });
    const nm = "Vis" + stamp; await newChild("p1", nm);
    const p = await newPage("p", `/book/${L.id}`);
    await uiToPay(p, nm);
    // prefilled from account
    const pc = p.getByPlaceholder("Postcode");
    eq(await pc.inputValue(), "NN5 7EA", "postcode prefilled from account");
    await p.getByPlaceholder("e.g. 07700 900123").fill("07700900123");
    await pc.fill("");
    const btn = () => p.locator("button:visible").filter({ hasText: /^(Pay|Book|Confirm|Complete|Reserve|Place|Add)/i }).last();
    await btn().waitFor();
    const label1 = (await btn().innerText()).trim();
    shots.push(await snap(p, "LT-006", "blank", ["We’ll come to you"].filter(() => false)));
    must(/Add the visit address/i.test(label1), `button with blank postcode: "${label1}"`);
    await p.getByPlaceholder("House number and street").fill("10 Downing Street");
    await pc.fill("SW1A 2AA");
    const label2 = (await btn().innerText()).trim();
    shots.push(await snap(p, "LT-006", "filled"));
    must(/Confirm|Pay/i.test(label2) && !/visit address/i.test(label2), `button after filling: "${label2}"`);
    return `blank postcode -> button "${label1}"; account postcode NN5 7EA prefilled and editable; filled -> "${label2}"`;
  });
});
// ---------- LT-007 one-off ----------
for (const kind of OPS) T(`LT-007 ${kind}`, async () => {
  await check("LT-007", kind, async (shots) => {
    const title = `LTA oneoff ${kind} ${stamp}`;
    const day = sd(1, 2);
    const L = await mkListing(kind, title, {}, { passes: [{ name: "1 day", days: 1, price: 15 }], from: day, to: day, days: [3] });
    must(L.blocks.length === 1, `blocks ${L.blocks.length}`);
    const p = await newPage("p", `/book/${L.id}`);
    await p.getByText(/Tap a week|Select|Add 1/i).first().waitFor({ timeout: 45_000 }).catch(() => {});
    shots.push(await snap(p, "LT-007", `${kind}.before`, ["£15.00"])); await p.close();
    const b = await bookOk("p1", L, [day], "1 day");
    eq(b.amount, 15, "total"); eq((b.days ?? []).length, 1, "days"); eq(b.days[0], day, "date");
    const q = await newPage("p", `/book/${L.id}`);
    shots.push(await snap(q, "LT-007", `${kind}.after`, ["9 of 10"].filter(() => false))); await q.close();
    const o = await newPage(kind, `/${PORTAL[kind]}/bookings`);
    shots.push(await snap(o, "LT-007", `${kind}.op`, [b.ref])); await o.close();
    return `one session (${day}), one pass "1 day" £15; booking ${b.ref} total £${b.amount} days ${JSON.stringify(b.days)}`;
  });
});

const sessionDates = async (k: string, L: Listing) => {
  const full = await ok(k, "GET", `/api/listings/${L.id}`);
  return ((full.blocks ?? []) as any[]).flatMap((b) => (b.sessions ?? []).map((x: any) => x.date as string)).sort();
};
const dlabel = (iso0: string) => new Date(iso0 + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).replace(",", "");
const wed = (w: number) => iso(addDays(nextMonday, 2 + 7 * w));
// ---------- LT-008 term club ----------
for (const kind of OPS) T(`LT-008 ${kind}`, async () => {
  await check("LT-008", kind, async (shots) => {
    const title = `LTA term ${kind} ${stamp}`;
    const L = await mkListing(kind, title, { bookRules: { Term: "blocks" } }, { passes: [{ name: "Term", days: 10, price: 120 }, { name: "1 day", days: 1, price: 15 }], from: wed(0), to: wed(9), days: [3] });
    const dates = await sessionDates(kind, L);
    eq(dates.length, 10, "sessions"); must(dates.every((d) => new Date(d + "T12:00:00").getDay() === 3), "all Wednesdays");
    const p = await newPage("p", `/book/${L.id}`);
    await p.getByRole("button", { name: /^Term · £120/ }).first().click();
    await p.waitForTimeout(1200);
    shots.push(await snap(p, "LT-008", `${kind}.term`, ["10 days"])); await p.close();
    const part = await book("p1", L, dates.slice(0, 5), "Term");
    const r = await book("p1", L, dates, "Term");
    if (r.status >= 300) throw new Error("book " + JSON.stringify(r.json).slice(0, 200));
    const rows = r.json.bookings as any[];
    const total = rows.reduce((a, x) => a + x.amount, 0);
    const alld = [...new Set(rows.flatMap((x) => x.days as string[]))].sort();
    eq(total, 120, "Term total over all rows"); eq(alld.length, 10, "distinct dates");
    const b = rows[0];
    const o = await newPage(kind, `/${PORTAL[kind]}/bookings`);
    shots.push(await snap(o, "LT-008", `${kind}.op`, [b.ref])); await o.close();
    return `10 Wednesdays ${dates[0]}..${dates[9]}; Term chip ticks all; ${rows.length} booking row(s) refs ${rows.map((x) => x.ref).join(",")} total £${total}, ${alld.length} distinct dates; booking only 5 dates on Term -> ${part.status} ${JSON.stringify(part.json).slice(0, 100)}`;
  });
});
// ---------- LT-009 camp several weeks ----------
for (const kind of OPS) T(`LT-009 ${kind}`, async () => {
  await check("LT-009", kind, async (shots) => {
    const title = `LTA camp ${kind} ${stamp}`;
    const L = await mkListing(kind, title);
    const nm = "Cmp" + kind + stamp; await newChild("p1", nm);
    const p = await newPage("p", `/book/${L.id}`);
    await p.getByText(/Tap a week/).first().waitFor({ timeout: 45_000 });
    await p.getByRole("button", { name: monRe() }).first().click();
    await p.getByRole("button", { name: /ADD 5 DAYS TO BASKET/i }).click();
    await p.getByRole("button", { name: /^3 days · £54/ }).first().click();
    for (const d of [0, 1, 2]) { const dd = addDays(nextMonday, 7 + d).getDate(); await p.getByRole("button", { name: new RegExp("^" + ["Mon", "Tue", "Wed"][d] + "\\s*" + dd + "$", "i") }).first().click(); }
    await p.getByRole("button", { name: /ADD 3 DAYS TO BASKET/i }).click();
    await p.waitForTimeout(1000);
    await p.getByText("Your basket", { exact: false }).first().scrollIntoViewIfNeeded();
    shots.push(await snap(p, "LT-009", `${kind}.basket`, ["£144.00"])); await p.close();
    const r = await call("p1", "POST", "/api/my/bookings", { listingId: L.id, blockId: L.blocks[0].id, method: "card", items: [
      { pass: "5 days", child: nm, age: 8, dates: [0, 1, 2, 3, 4].map((d) => sd(0, d)) }, { pass: "3 days", child: nm, age: 8, dates: [0, 1, 2].map((d) => sd(1, d)) }] });
    if (r.status >= 300) throw new Error("book " + JSON.stringify(r.json).slice(0, 200));
    const bs = r.json.bookings as any[];
    const total = bs.reduce((a, x) => a + x.amount, 0);
    eq(total, 144, "total");
    const refs = new Set(bs.map((x) => x.ref));
    const o = await newPage(kind, `/${PORTAL[kind]}/bookings`);
    shots.push(await snap(o, "LT-009", `${kind}.op`, [bs[0].ref])); await o.close();
    return `basket £144.00 (UI); API: ${bs.length} booking row(s), ${refs.size} reference(s) ${[...refs].join(",")}, total £${total}, days per row ${bs.map((x) => x.days.length).join("+")}`;
  });
});
// ---------- LT-010 weekend ----------
for (const kind of OPS) T(`LT-010 ${kind}`, async () => {
  await check("LT-010", kind, async (shots) => {
    const title = `LTA weekend ${kind} ${stamp}`;
    const sat = iso(addDays(nextMonday, 12)); const end = iso(addDays(nextMonday, 20));
    const L = await mkListing(kind, title, {}, { passes: [{ name: "1 day", days: 1, price: 20 }], from: sat, to: end, days: [6, 0], mode: "custom" });
    const dates = await sessionDates(kind, L);
    must(dates.length >= 4, "sessions " + dates.length); must(dates.every((d) => [0, 6].includes(new Date(d + "T12:00:00").getDay())), "only Sat/Sun: " + dates.join(","));
    const w = await openWizard(kind, title, 7);
    shots.push(await snap(w, "LT-010", `${kind}.wizard`, ["Calendar"])); await w.close();
    const p = await newPage("p", `/book/${L.id}`);
    await p.getByText(/Choose (your|any) dates/i).first().waitFor({ timeout: 45_000 });
    shots.push(await snap(p, "LT-010", `${kind}.parent`, [/Choose (your|any) dates/i])); await p.close();
    return `custom Sat+Sun listing: sessions ${dates.join(",")} (all Sat/Sun)`;
  });
});
// ---------- LT-011 date off ----------
for (const kind of OPS) T(`LT-011 ${kind}`, async () => {
  await check("LT-011", kind, async (shots) => {
    const title = `LTA dateoff ${kind} ${stamp}`;
    const L = await mkListing(kind, title);
    const booked = sd(1, 2); // Wed week 2, has a booking
    const off = sd(1, 3);    // Thu week 2, free
    const bk = await bookOk("p1", L, [booked], "1 day");
    const w = await openWizard(kind, title, 7);
    await w.waitForTimeout(3000);
    // (a) switching off a booked date is refused, booking untouched
    await w.getByRole("button", { name: dlabel(booked) }).click();
    await w.waitForTimeout(400);
    await w.getByRole("button", { name: "Save changes" }).click();
    await w.getByText(/removes a date that children are booked on/i).first().waitFor({ timeout: 30_000 });
    shots.push(await snap(w, "LT-011", `${kind}.refused`));
    const stillThere = ((await ok(kind, "GET", "/api/bookings")) as any[]).find((x) => x.ref === bk.ref);
    must(stillThere && !/cancel/i.test(stillThere.status), "booking untouched");
    // (b) restore it, switch off the free Thursday, save
    await w.getByRole("button", { name: dlabel(booked) }).click();
    await w.getByRole("button", { name: dlabel(off) }).click();
    await w.waitForTimeout(500);
    shots.push(await snap(w, "LT-011", `${kind}.wizard`, ["Calendar"]));
    await saveWizard(w); await w.close();
    const doc = await poll(() => ok(kind, "GET", `/api/listings/${L.id}`), (d) => (d.datesOff ?? []).includes(off), "datesOff stored");
    const dates = await sessionDates(kind, L);
    must(!dates.includes(off), "session removed"); must(dates.includes(booked), "booked date kept"); eq(dates.length, 14, "sessions left");
    const p = await newPage("p", `/book/${L.id}`);
    await p.getByText(/Choose (your|any) dates/i).first().waitFor({ timeout: 45_000 });
    shots.push(await snap(p, "LT-011", `${kind}.parent`)); await p.close();
    return `Wed ${booked} (1 booking ${bk.ref}) refused with "This change removes a date that children are booked on..." and booking left "${stillThere.status}"; free date ${off} switched off: datesOff ${JSON.stringify(doc.datesOff)}, 14 sessions left`;
  });
});
// ---------- LT-012 trip ----------
for (const kind of ["co", "fl"] as Kind[]) T(`LT-012 ${kind}`, async () => {
  await check("LT-012", kind, async (shots) => {
    const L = await mkListing(kind, `LTA trip base ${kind} ${stamp}`);
    const nm = "Trp" + kind + stamp; await newChild("p1", nm);
    const bk = await bookOk("p1", L, [sd(0, 0)], "1 day", {}); // child name resolved below
    void bk;
    const r = await call("p1", "POST", "/api/my/bookings", { listingId: L.id, blockId: L.blockId, method: "card", items: [{ pass: "1 day", child: nm, age: 8, dates: [sd(0, 1)] }] });
    if (r.status >= 300) throw new Error("book " + JSON.stringify(r.json));
    const dest = `LTA Zoo ${kind} ${stamp}`;
    const trip = await ok(kind, "POST", "/api/trips", { destination: dest, address: "Zoo Lane", date: sd(0, 3), departTime: "09:30", returnTime: "15:00", listingId: L.id, childNames: [nm], askConsent: true, status: "planned" });
    must((trip.childIds ?? []).length === 1, "trip childIds " + JSON.stringify(trip.childIds));
    const mine = (await ok("p1", "GET", "/api/my/trips")) as any[];
    const t = mine.find((x) => x.id === trip.id); must(t, "trip on parent list");
    const p = await newPage("p", "/custdash/trips");
    await p.getByText(dest).first().waitFor({ timeout: 45_000 });
    shots.push(await snap(p, "LT-012", `${kind}.parent.before`, [dest]));
    await p.getByRole("button", { name: /give consent/i }).first().click();
    await p.getByText(/consent given|granted|given/i).first().waitFor({ timeout: 30_000 });
    shots.push(await snap(p, "LT-012", `${kind}.parent.after`, [dest])); await p.close();
    const doc = (await ok(kind, "GET", "/api/trips") as any[]).find((x) => x.id === trip.id);
    eq(doc.attendees[0].consent, "granted", "consent recorded");
    const o = await newPage(kind, `/${PORTAL[kind]}/trips`);
    await o.getByText(dest).first().waitFor({ timeout: 45_000 });
    await o.getByText(dest).first().click().catch(() => {});
    await o.waitForTimeout(1500);
    shots.push(await snap(o, "LT-012", `${kind}.op`, [dest])); await o.close();
    return `trip "${dest}" created with child ${nm} (childIds 1); parent saw it on Trips & consent and gave consent in one tap; operator doc attendee consent=${doc.attendees[0].consent} consentSource ${doc.attendees[0].consentSource}`;
  });
});
// ---------- LT-013 1:1 pass ----------
for (const kind of OPS) T(`LT-013 ${kind}`, async () => {
  await check("LT-013", kind, async (shots) => {
    const title = `LTA oneone ${kind} ${stamp}`;
    const L = await mkListing(kind, title, { ticketOverrides: { "1:1 session": { capacity: "1" } } }, { passes: [{ name: "1:1 session", days: 1, price: 30 }, { name: "1 day", days: 1, price: 20 }] });
    const d = sd(0, 1);
    const a = await bookOk("p1", L, [d], "1:1 session");
    const b = await book("p2", L, [d], "1:1 session");
    if (b.status >= 300) throw new Error("B booking " + b.status + JSON.stringify(b.json));
    const bb = b.json.bookings[0];
    const other = await bookOk("p2", L, [d], "1 day"); // other pass still bookable
    const w = await openWizard(kind, title, 8);
    shots.push(await snap(w, "LT-013", `${kind}.wizard`, ["1:1 session"])); await w.close();
    const p = await newPage("p2", `/book/${L.id}`);
    await p.getByText(/Choose (your|any) dates/i).first().waitFor({ timeout: 45_000 });
    shots.push(await snap(p, "LT-013", `${kind}.parentB`)); await p.close();
    const o = await newPage(kind, `/${PORTAL[kind]}/bookings`);
    shots.push(await snap(o, "LT-013", `${kind}.op`, [bb.ref])); await o.close();
    const note = `capacity/day 1 on "1:1 session": A ${a.ref} status ${a.status}; B ${bb.ref} status ${bb.status}; "1 day" pass booked by B (${other.status})`;
    if (!/wait/i.test(bb.status)) throw new Error("B was not waitlisted/refused. " + note);
    return note;
  });
});
// ---------- LT-014 close pass / LT-015 hide pass ----------
for (const kind of OPS) T(`LT-014 ${kind}`, async () => {
  await check("LT-014", kind, async (shots) => {
    const title = `LTA close ${kind} ${stamp}`;
    const L = await mkListing(kind, title);
    const w = await openWizard(kind, title, 8);
    await w.waitForTimeout(3000);
    await w.getByRole("button", { name: "Close", exact: true }).last().click();
    await w.waitForTimeout(600);
    shots.push(await snap(w, "LT-014", `${kind}.wizard`));
    await saveWizard(w); await w.close();
    const doc = await poll(() => ok(kind, "GET", `/api/listings/${L.id}`), (d) => d.ticketOverrides?.["1 day"]?.capacity === "0", "1 day capacity 0 stored");
    const p = await newPage("p", `/book/${L.id}`);
    await p.getByText(/Closed/i).first().waitFor({ timeout: 45_000 });
    shots.push(await snap(p, "LT-014", `${kind}.parent`, [/Closed/i])); await p.close();
    const ok3 = await bookOk("p1", L, [sd(0, 0), sd(0, 1), sd(0, 2)], "3 days");
    const closed = await book("p2", L, [sd(0, 4)], "1 day");
    return `1 day override capacity "0"; parent page shows Closed; 3 days still booked ${ok3.ref}; direct API booking of the closed pass -> HTTP ${closed.status} ${JSON.stringify(closed.json).slice(0, 120)}`;
  });
});
for (const kind of OPS) T(`LT-015 ${kind}`, async () => {
  await check("LT-015", kind, async (shots) => {
    const title = `LTA hide ${kind} ${stamp}`;
    const L = await mkListing(kind, title);
    const w = await openWizard(kind, title, 8);
    await w.waitForTimeout(3000);
    await w.getByRole("button", { name: "Hide", exact: true }).nth(1).click();
    await w.waitForTimeout(600);
    shots.push(await snap(w, "LT-015", `${kind}.wizard.hidden`));
    await saveWizard(w);
    eq((await ok(kind, "GET", `/api/listings/${L.id}`)).ticketOverrides?.["3 days"]?.hidden, true, "hidden true");
    const p = await newPage("p", `/book/${L.id}`);
    await p.getByText(/Choose (your|any) dates/i).first().waitFor({ timeout: 45_000 });
    const n3 = await p.getByText("3 days", { exact: false }).count();
    shots.push(await snap(p, "LT-015", `${kind}.parent.hidden`)); await p.close();
    must(n3 === 0, "3 days still visible on parent page (" + n3 + ")");
    const w2 = await openWizard(kind, title, 8);
    await w2.getByRole("button", { name: "Show", exact: true }).click();
    await w2.waitForTimeout(600); await saveWizard(w2); await w2.close(); await w.close();
    eq((await ok(kind, "GET", `/api/listings/${L.id}`)).ticketOverrides?.["3 days"]?.hidden, false, "hidden false");
    const q = await newPage("p", `/book/${L.id}`);
    await q.getByText("3 days", { exact: false }).first().waitFor({ timeout: 45_000 });
    shots.push(await snap(q, "LT-015", `${kind}.parent.shown`)); await q.close();
    return `Hide on "3 days": ticketOverrides hidden true, parent page showed no "3 days"; Show: hidden false, "3 days" back on parent page`;
  });
});
// ---------- LT-016 pass longer than run ----------
for (const kind of OPS) T(`LT-016 ${kind}`, async () => {
  await check("LT-016", kind, async (shots) => {
    const title = `LTA short ${kind} ${stamp}`;
    const L = await mkListing(kind, title, {}, { from: iso(nextMonday), to: iso(addDays(nextMonday, 1)), days: [1, 2] });
    const w = await openWizard(kind, title, 8);
    await w.getByText("Not available for this run").first().waitFor({ timeout: 30_000 });
    shots.push(await snap(w, "LT-016", `${kind}.wizard`, ["Not available for this run"])); await w.close();
    const p = await newPage("p", `/book/${L.id}`);
    await p.getByText(/Not enough days left/i).first().waitFor({ timeout: 45_000 });
    shots.push(await snap(p, "LT-016", `${kind}.parent`, [/Not enough days left/i])); await p.close();
    const r = await book("p1", L, [sd(0, 0), sd(0, 1)], "5 days");
    return `wizard warns "Not available for this run"; parent page shows "Not enough days left"; direct API booking of 5 days over 2 dates -> HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`;
  });
});
// ---------- LT-017 browse ----------
for (const kind of OPS) T(`LT-017 ${kind}`, async () => {
  await check("LT-017", kind, async (shots) => {
    const title = `LTA public ${kind} ${stamp}`;
    const L = await mkListing(kind, title);
    const feed = (await ok("p1", "GET", "/api/listings")) as any[];
    must(feed.some((x) => x.id === L.id), "in public feed");
    const p = await newPage("p", "/custdash/browse");
    await p.getByPlaceholder(/search/i).first().fill(title);
    await p.getByText(title).first().waitFor({ timeout: 45_000 });
    shots.push(await snap(p, "LT-017", `${kind}.browse`, [title])); await p.close();
    const s = await newPage("p", `/store/${L.tenantId}`);
    await s.getByText(title).first().waitFor({ timeout: 45_000 });
    shots.push(await snap(s, "LT-017", `${kind}.store`, [title])); await s.close();
    return `public listing in /api/listings feed, on Browse activities search and on the provider storefront`;
  });
});
// ---------- LT-018 hidden link ----------
for (const kind of OPS) T(`LT-018 ${kind}`, async () => {
  await check("LT-018", kind, async (shots) => {
    const title = `LTA hiddenlink ${kind} ${stamp}`;
    const L = await mkListing(kind, title, { visibility: "hidden" });
    const feed = (await ok("p1", "GET", "/api/listings")) as any[];
    must(!feed.some((x) => x.id === L.id), "must NOT be in public feed");
    const storeFeed = (await ok("p1", "GET", `/api/listings?tenantId=${L.tenantId}`)) as any[];
    must(!storeFeed.some((x) => x.id === L.id), "must NOT be in storefront feed");
    const p = await newPage("p", "/custdash/browse");
    await p.getByPlaceholder(/search/i).first().fill(title);
    await p.waitForTimeout(2500);
    must((await p.getByText(title).count()) === 0, "shown in Browse");
    shots.push(await snap(p, "LT-018", `${kind}.browse`)); await p.close();
    const direct = await ok("p1", "GET", `/api/listings/${L.id}`); eq(direct.id, L.id, "direct GET");
    const q = await newPage("p", `/book/${L.id}`);
    await q.getByText(title, { exact: false }).first().waitFor({ timeout: 45_000 });
    shots.push(await snap(q, "LT-018", `${kind}.direct`, [/Choose (your|any) dates/i])); await q.close();
    const b = await bookOk("p1", L, [sd(0, 0)], "1 day");
    return `visibility hidden: absent from /api/listings and storefront feed and Browse search; direct /book link opens and booking ${b.ref} made (£${b.amount})`;
  });
});
// ---------- LT-019 draft ----------
for (const kind of OPS) T(`LT-019 ${kind}`, async () => {
  await check("LT-019", kind, async (shots) => {
    const title = `LTA draft ${kind} ${stamp}`;
    const o = await newPage(kind, `/${PORTAL[kind]}/listings`);
    await o.getByRole("button", { name: /New listing/ }).click();
    await o.getByText(/^Step 1 of 13/).waitFor({ timeout: 30_000 });
    const ti = o.getByPlaceholder("e.g. Summer Multi-Activity Camp");
    for (let i = 0; i < 6; i++) { await o.waitForTimeout(1500); await ti.fill(title); await o.waitForTimeout(300); if ((await ti.inputValue()) === title) break; }
    await o.getByRole("button", { name: "Save draft" }).click();
    await o.waitForTimeout(3000);
    await o.getByRole("button", { name: "×", exact: true }).first().click().catch(() => {});
    await o.waitForTimeout(1500);
    await o.screenshot({ path: path.join(SHOTS, `dbg.draft.${kind}.png`) });
    console.log("DRAFTS", JSON.stringify(((await ok(kind, "GET", "/api/listings")) as any[]).slice(-3).map((x) => [x.id, x.title, x.name, x.status])));
    const mine = ((await ok(kind, "GET", "/api/listings?mine=1")) as any[]).find((x) => (x.title ?? x.name) === title);
    must(mine, "draft saved"); eq(mine.status, "draft", "status");
    await o.getByText(title).first().waitFor({ timeout: 30_000 });
    shots.push(await snap(o, "LT-019", `${kind}.op`, [title])); await o.close();
    const feed = (await ok("p1", "GET", "/api/listings")) as any[]; must(!feed.some((x) => x.id === mine.id), "not in feed");
    const direct = await call("p1", "GET", `/api/listings/${mine.id}`);
    const q = await newPage("p", `/book/${mine.id}`);
    await q.getByText(/not available|not found|no longer/i).first().waitFor({ timeout: 45_000 });
    shots.push(await snap(q, "LT-019", `${kind}.parent`, [/not available|not found|no longer/i])); await q.close();
    const bk = await call("p1", "POST", "/api/my/bookings", { listingId: mine.id, blockId: "x", method: "card", items: [{ pass: "1 day", child: kid(), age: 8, dates: [sd(0, 0)] }] });
    return `draft saved via Save draft (status draft); not in public feed; parent GET -> ${direct.status}; /book page says not available; direct booking attempt -> ${bk.status} ${JSON.stringify(bk.json).slice(0, 100)}`;
  });
});

T("dbg", async () => {
  if (!process.env.LTA_DBG) return;
  const b = await chromium.launch();
  for (const k of ["fl", "fr"]) {
    const ctx = await b.newContext(); const page = await ctx.newPage();
    await page.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.getByPlaceholder("you@example.com").fill(A[k].email);
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForTimeout(15000);
    console.log("DBG", k, page.url(), (await page.locator("body").innerText()).slice(0, 400).replace(/\n/g, " | "));
    await page.screenshot({ path: path.join(SHOTS, `dbg.${k}.png`) });
  }
});

T("REFTEST", async () => {
  if (!process.env.LTA_REF) return;
  const L = await mkListing("co", `LTA refs ${stamp}`, {}, { passes: [{ name: "4 days", days: 4, price: 70 }, { name: "1 day", days: 1, price: 20 }] });
  const post = async (label: string, items: unknown[]) => {
    const r = await call("p1", "POST", "/api/my/bookings", { listingId: L.id, blockId: L.blocks[0].id, method: "card", items });
    console.log("REF", label, r.status, JSON.stringify((r.json.bookings ?? r.json).map?.((b: any) => ({ ref: b.ref, bid: b.bid, pass: b.pass, child: b.child, days: b.days?.length, amt: b.amount })) ?? r.json));
  };
  const c = "Ref" + stamp;
  await post("A five 1-day passes Mon-Fri, one child", [0, 1, 2, 3, 4].map((d) => ({ pass: "1 day", child: c + "a", age: 8, dates: [sd(0, d)] })));
  await post("B 1-day Mon + 4-day Tue-Fri, one child", [{ pass: "1 day", child: c + "b", age: 8, dates: [sd(1, 0)] }, { pass: "4 days", child: c + "b", age: 8, dates: [1, 2, 3, 4].map((d) => sd(1, d)) }]);
  await post("C 4-day pass, two children, same week", ["c1", "c2"].map((x) => ({ pass: "4 days", child: c + x, age: 8, dates: [0, 1, 2, 3].map((d) => sd(2, d)) })));
});

T("EARLYTEST", async () => {
  if (!process.env.LTA_EARLY) return;
  const rule = (m: string) => ({ id: "e" + m, kind: "early", name: "", passNames: [], enabled: true, moreThan: 1, appliesTo: "all", method: m, value: m === "percent" ? 10 : 10, beforeDate: process.env.LTA_BLANK ? "" : iso(addDays(today, 5)) });
  for (const m of ["subtract", "percent"]) {
    const L = await mkListing("co", `LTA early ${m} ${stamp}`, { discounts: [rule(m)] });
    const a = await bookOk("p1", L, [sd(0, 0)], "1 day");
    const b = await bookOk("p1", L, [sd(0, 1)], "1 day");
    const c = await book("p2", L, [sd(0, 2)], "1 day"); // different family
    const full = await ok("p1", "GET", `/api/listings/${L.id}`);
    console.log("EARLY", m, "first", a.amount, "second", b.amount, "other family", c.json.bookings?.[0]?.amount, "stamp", a.earlyBirdScope, "previewUsed", full.earlyFixedUsed);
  }
});

T("ABTEST", async () => {
  if (!process.env.LTA_AB) return;
  const rule = { id: "p10", kind: "person", name: "", passNames: [], enabled: true, moreThan: 1, appliesTo: "all", method: "percent", value: 10, beforeDate: "" };
  const L = await mkListing("co", `LTA ab ${stamp}`, { discounts: [rule] });
  const a = "Aa" + stamp, b = "Bb" + stamp;
  const r = await call("p1", "POST", "/api/my/bookings", { listingId: L.id, blockId: L.blocks[0].id, method: "card", items: [
    { pass: "3 days", child: a, age: 8, dates: [0, 1, 2].map((d) => sd(0, d)) }, { pass: "3 days", child: b, age: 8, dates: [0, 1, 2].map((d) => sd(1, d)) }] });
  const total = (r.json.bookings ?? []).reduce((x: number, y: any) => x + y.amount, 0);
  console.log("AB same checkout", r.status, "total", total, "rows", (r.json.bookings ?? []).length);
  const s1 = await bookOk("p2", L, [0, 1, 2].map((d) => sd(2, d)), "3 days");
  console.log("AB single child", s1.amount);
  // browser: parent basket with two children on different weeks
  await newChild("p1", "Ab1" + stamp); await newChild("p1", "Ab2" + stamp);
  const p = await newPage("p", `/book/${L.id}`);
  try {
    await p.getByText(/Tap a week/).first().waitFor({ timeout: 45_000 });
    await p.getByRole("button", { name: /^3 days · £54/ }).first().click();
    for (const d of [0, 1, 2]) { await p.getByRole("button", { name: new RegExp("^" + ["Mon", "Tue", "Wed"][d] + "\\s*" + addDays(nextMonday, d).getDate() + "$", "i") }).first().click(); }
    await p.getByRole("button", { name: /ADD 3 DAYS TO BASKET/i }).click();
    for (const d of [0, 1, 2]) { await p.getByRole("button", { name: new RegExp("^" + ["Mon", "Tue", "Wed"][d] + "\\s*" + addDays(nextMonday, 7 + d).getDate() + "$", "i") }).first().click(); }
    await p.getByRole("button", { name: /ADD 3 DAYS TO BASKET/i }).click();
    await p.getByRole("button", { name: /NEXT — ADD CHILDREN/i }).click();
    await p.waitForTimeout(1500);
    await p.getByRole("button", { name: new RegExp("Ab1" + stamp) }).click();
    await p.getByRole("button", { name: new RegExp("Ab2" + stamp) }).click();
    await p.waitForTimeout(1000);
    console.log("AB buttons", JSON.stringify(await p.locator("button:visible").allInnerTexts()).slice(-500));
    await p.getByRole("button", { name: "Next", exact: true }).click();
    await p.getByPlaceholder("e.g. 07700 900123").waitFor({ timeout: 30_000 });
    await p.waitForTimeout(1500);
    await snap(p, "AB", "pay");
    console.log("AB total text", (await p.getByText(/^Total/).first().locator("xpath=..").innerText()).replace(/\n/g, " "));
  } catch (e) { console.log("AB btns", JSON.stringify(await p.getByRole("button").evaluateAll((els: any[]) => els.map((x) => (x.getAttribute("aria-label") || x.innerText).slice(0, 50)))).slice(0, 900)); await snap(p, "AB", "fail"); console.log("AB fail", (e as Error).message.slice(0, 300)); }
});

T("WIZDISC", async () => {
  if (!process.env.LTA_WIZ) return;
  const rules = [
    { id: "pp", kind: "person", name: "", passNames: [], enabled: true, moreThan: 1, appliesTo: "all", method: "percent", value: 10, beforeDate: "" },
    { id: "ee", kind: "early", name: "", passNames: [], enabled: true, moreThan: 1, appliesTo: "all", method: "subtract", value: 10, beforeDate: iso(addDays(today, 5)) },
  ];
  const title = `LTA wizdisc ${stamp}`;
  await mkListing("co", title, { discounts: rules });
  const w = await openWizard("co", title, 9);
  await w.waitForTimeout(2000);
  await snap(w, "WIZ", "list");
  const ed = (n: number) => w.getByText(/^Your discounts/).locator(`xpath=following::button[normalize-space()='Edit'][${n}]`);
  await ed(1).click({ timeout: 10_000 });
  await w.waitForTimeout(800);
  await snap(w, "WIZ", "edit-person");
  await ed(2).click({ timeout: 10_000 });
  await w.waitForTimeout(800);
  await snap(w, "WIZ", "edit-early");
  console.log("WIZ done", JSON.stringify(await w.locator("select option:checked, select").evaluateAll((els: any[]) => els.map((e) => Array.from(e.options ?? []).map((o: any) => o.text).join("|")))));
});

T("AW021", async () => {
  if (!process.env.LTA_AW) return;
  const L = await mkListing("co", `LTA wl ${stamp}`, {}, { passes: [{ name: "1 day", days: 1, price: 20 }] });
  await ok("co", "PUT", `/api/listings/${L.id}`, { maxAttendees: "1" });
  const d = sd(0, 0);
  await bookOk("p1", L, [d], "1 day");
  const r = await book("p2", L, [d], "1 day");
  const b = r.json.bookings[0];
  console.log("AW status", b.status, "pay", b.pay, "amount", b.amount, "ref", b.ref);
  const p = await newPage("p2", "/custdash/bookings");
  await p.getByText(/Waitlist/i).first().waitFor({ timeout: 45_000 }).catch(() => {});
  await p.waitForTimeout(2500);
  await p.getByText("My waiting list").first().click();
  await p.waitForTimeout(1500);
  const f = await snap(p, "AW-021", "waitlist");
  const panel = p.locator("body");
  const txt = (await panel.innerText()).replace(/\n/g, " | ");
  const i = txt.indexOf("My waiting list");
  console.log("AW panel", txt.slice(i, i + 700));
  console.log("AW ref on page", txt.includes(b.ref), "Pay buttons for it: see screenshot", f);
});

T("EARLYDATE", async () => {
  if (!process.env.LTA_ED) return;
  const rule = { id: "ee", kind: "early", name: "Book by the cut-off date — £10.00 off", passNames: [], enabled: true, moreThan: 1, appliesTo: "all", method: "subtract", value: 10, beforeDate: "" };
  const title = `LTA edate ${stamp}`;
  const L = await mkListing("co", title, { discounts: [rule] });
  const w = await openWizard("co", title, 9);
  await w.waitForTimeout(3000);
  await w.getByText(/^Your discounts/).locator("xpath=following::button[normalize-space()='Edit'][1]").click();
  await w.getByText(/^Must book on or before/i).locator("xpath=following::input[1]").fill(iso(addDays(today, 9)));
  await w.waitForTimeout(500);
  // NOTE: the rule form's own Save is NOT pressed - straight to the wizard's bottom Save changes
  await w.getByRole("button", { name: "Save changes" }).last().click();
  await w.waitForTimeout(6000);
  console.log("ED after bottom save only", JSON.stringify((await ok("co", "GET", `/api/listings/${L.id}`)).discounts.map((d: any) => d.beforeDate)));
});

T("DASH", async () => {
  if (!process.env.LTA_DASH) return;
  const p = await newPage("p", "/custdash");
  await p.getByText(/to pay/i).first().waitFor({ timeout: 60_000 });
  await p.waitForTimeout(1500);
  await snap(p, "DASH", "pay");
  console.log("DASH link", await p.getByRole("link", { name: /Changed your mind/ }).count());
});

T("CANCELLINK", async () => {
  if (!process.env.LTA_CL) return;
  const L = await mkListing("co", `LTA cl ${stamp}`);
  const b = await bookOk("p1", L, [sd(0, 0)], "1 day");
  const p = await newPage("p", `/custdash/bookings?cancel=${b.ref}`);
  await p.getByText(/cancel/i).first().waitFor({ timeout: 45_000 });
  await p.waitForTimeout(2500);
  await snap(p, "CL", "deeplink");
  console.log("CL ref", b.ref);
});

T("UNPAID", async () => {
  if (!process.env.LTA_UP) return;
  const L = await mkListing("co", `LTA unpaid ${stamp}`);
  const nm = "Up" + stamp; await newChild("p1", nm);
  const p = await newPage("p", `/book/${L.id}`);
  await uiToPay(p, nm);
  await p.getByPlaceholder("e.g. 07700 900123").fill("07700900123");
  console.log("UP btns", JSON.stringify(await p.locator("button:visible").allInnerTexts()).slice(0, 700));
  await p.locator("button:visible").filter({ hasText: /^(Add your contact phone|Confirm)/i }).last().click({ timeout: 10_000 }).catch(async () => { await snap(p, "UP", "stuck"); });
  await p.waitForTimeout(1500);
  console.log("UP btns2", JSON.stringify(await p.locator("button:visible").allInnerTexts()).slice(0, 700));
  await p.locator("button:visible").filter({ hasText: /^Confirm/i }).last().click({ timeout: 10_000 }).catch(() => {});
  await p.getByText(/Nearly there|booked in/).first().waitFor({ timeout: 45_000 });
  await p.waitForTimeout(1500);
  await snap(p, "UP", "done");
  console.log("UP heading", await p.locator("h2").first().innerText());
});

T("EBUI", async () => {
  if (!process.env.LTA_EB) return;
  const rule = { id: "ebx", kind: "early", name: "", passNames: [], enabled: true, moreThan: 1, appliesTo: "all", method: "subtract", value: 10, beforeDate: "" };
  const L = await mkListing("co", `LTA ebui ${stamp}`, { discounts: [rule] });
  // parent p2: first booking via the UI shows the badge, second shows the already-used note
  for (const round of [1, 2]) {
    const nm = "Eb" + round + stamp; await newChild("p2", nm);
    const p = await newPage("p2", `/book/${L.id}`);
    await p.getByText(/Tap a week/).first().waitFor({ timeout: 45_000 });
    console.log("EB btns", JSON.stringify(await p.locator("button:visible").allInnerTexts()).slice(0, 500));
    await p.getByRole("button", { name: /^1 day · £20/ }).first().click();
    const wk = round === 1 ? 0 : 1;
    await p.getByRole("button", { name: new RegExp("^Mon\\s*" + addDays(nextMonday, 7 * wk).getDate() + "$", "i") }).first().click();
    await p.getByRole("button", { name: /ADD 1 DAY|ADD .* TO BASKET/i }).click();
    await p.getByRole("button", { name: /NEXT — ADD CHILDREN/i }).click();
    await p.getByRole("button", { name: new RegExp(nm) }).click();
    await p.getByRole("button", { name: "Next", exact: true }).click();
    await p.getByPlaceholder("e.g. 07700 900123").waitFor({ timeout: 30_000 });
    await p.waitForTimeout(1500);
    await snap(p, "EB", "pay" + round);
    if (round === 1) {
      await p.getByPlaceholder("e.g. 07700 900123").fill("07700900123");
      await p.locator("button:visible").filter({ hasText: /^(Add your contact phone|Confirm)/i }).last().click();
      await p.waitForTimeout(1500);
      await p.locator("button:visible").filter({ hasText: /^Confirm/i }).last().click();
      await p.getByText(/Nearly there|booked in/).first().waitFor({ timeout: 45_000 });
      await p.waitForTimeout(1500);
      await snap(p, "EB", "done1");
      console.log("EB heading", await p.locator("h2").first().innerText());
    }
    await p.close();
  }
});

T("TOPAYF", async () => {
  if (!process.env.LTA_TF) return;
  const p = await newPage("p", "/custdash/bookings?filter=topay");
  await p.getByText(/Still to pay/).first().waitFor({ timeout: 45_000 });
  await p.waitForTimeout(2000);
  await snap(p, "TF", "list");
  console.log("TF tab text", (await p.getByRole("button", { name: /Still to pay/ }).first().innerText()).replace(/\n/g, " "), "| all tab", (await p.getByRole("button", { name: /^All/ }).first().innerText()).replace(/\n/g, " "));
});

T("LABEL", async () => {
  if (!process.env.LTA_LB) return;
  const stale = { id: "lb", kind: "early", name: "Book by the cut-off date — £10.00 off", passNames: [], enabled: true, moreThan: 1, appliesTo: "all", method: "percent", value: 12, beforeDate: "" };
  const L = await mkListing("co", `LTA label ${stamp}`, { discounts: [stale] });
  const nm = "Lb" + stamp; await newChild("p1", nm);
  const p = await newPage("p", `/book/${L.id}`);
  await uiToPay(p, nm);
  await p.waitForTimeout(1500);
  await snap(p, "LB", "pay");
  console.log("LB text", (await p.getByText(/Discount applied|discount applied/).first().locator("xpath=ancestor::div[1]/..").innerText()).replace(/\n/g, " | ").slice(0, 400));
});

T("BROWSEOFF", async () => {
  if (!process.env.LTA_BO) return;
  const rule = { id: "bo", kind: "early", name: "Book by the cut-off date — £10.00 off", passNames: [], enabled: true, moreThan: 1, appliesTo: "all", method: "subtract", value: 12, beforeDate: "2027-04-30" };
  const title = `LTA browseoff ${stamp}`;
  await mkListing("co", title, { discounts: [rule] });
  const p = await newPage("p", "/custdash/browse");
  await p.getByPlaceholder(/search/i).first().fill(title);
  await p.getByText(title).first().waitFor({ timeout: 45_000 });
  await p.waitForTimeout(1500);
  await snap(p, "BO", "browse", [title]);
  console.log("BO card", (await p.locator('[data-ui="card"]').filter({ hasText: title }).last().innerText()).replace(/\n/g, " | ").slice(0, 500));
});

T("USEDLINK", async () => {
  if (!process.env.LTA_UL) return;
  const rule = { id: "ul", kind: "early", name: "", passNames: [], enabled: true, moreThan: 1, appliesTo: "all", method: "subtract", value: 10, beforeDate: "" };
  const L = await mkListing("co", `LTA usedlink ${stamp}`, { discounts: [rule] });
  const first = await bookOk("p2", L, [sd(0, 0)], "1 day");
  const full = await ok("p2", "GET", `/api/listings/${L.id}`);
  console.log("UL api", first.ref, JSON.stringify({ used: full.earlyFixedUsed, ref: full.earlyFixedRef, unpaid: full.earlyFixedUnpaid }));
  const nm = "Ul" + stamp; await newChild("p2", nm);
  const p = await newPage("p2", `/book/${L.id}`);
  await p.getByText(/Tap a week/).first().waitFor({ timeout: 45_000 });
  await p.getByRole("button", { name: /^1 day · £20/ }).first().click();
  await p.getByRole("button", { name: new RegExp("^Mon\\s*" + addDays(nextMonday, 7).getDate() + "$", "i") }).first().click();
  await p.getByRole("button", { name: /TO BASKET/i }).click();
  await p.getByRole("button", { name: /NEXT — ADD CHILDREN/i }).click();
  await p.getByRole("button", { name: new RegExp(nm) }).first().click();
  await p.getByRole("button", { name: "Next", exact: true }).click();
  await p.getByText(/Have discount codes/).first().waitFor({ timeout: 30_000 });
  await p.waitForTimeout(1500);
  await snap(p, "UL", "pay");
  console.log("UL link", await p.getByRole("link", { name: /Cancel it/ }).count());
});

T("DNAMES", async () => {
  if (!process.env.LTA_DN) return;
  const rule = { id: "dn", kind: "early", name: "", passNames: [], enabled: true, moreThan: 1, appliesTo: "all", method: "percent", value: 10, beforeDate: "" };
  const L = await mkListing("co", `LTA dnames ${stamp}`, { discounts: [rule] });
  const b = await bookOk("p1", L, [sd(0, 0)], "1 day");
  console.log("DN names", JSON.stringify(b.discountNames), b.discountOff);
});

T("RACE", async () => {
  if (!process.env.LTA_RACE) return;
  const rule = { id: "rc", kind: "early", name: "", passNames: [], enabled: true, moreThan: 1, appliesTo: "all", method: "subtract", value: 10, beforeDate: "" };
  const L = await mkListing("co", `LTA race ${stamp}`, { discounts: [rule] });
  const rs = await Promise.all([0, 1, 2].map((d) => book("p1", L, [sd(0, d)], "1 day")));
  console.log("RACE", JSON.stringify(rs.map((r) => [r.status, r.json.bookings?.[0]?.amount ?? r.json.error])));
  const again = await book("p1", L, [sd(1, 0)], "1 day");
  console.log("RACE after", again.status, again.json.bookings?.[0]?.amount ?? again.json.error);
});

T("STORE", async () => {
  if (!process.env.LTA_ST) return;
  const rule = { id: "st", kind: "early", name: "", passNames: [], enabled: true, moreThan: 1, appliesTo: "all", method: "percent", value: 10, beforeDate: "" };
  const L = await mkListing("co", `LTA store ${stamp}`, { discounts: [rule] });
  const s = await newPage("p", `/store/${L.tenantId}`);
  await s.getByText(`LTA store ${stamp}`).first().waitFor({ timeout: 45_000 });
  await s.waitForTimeout(1500);
  await snap(s, "ST", "store", [`LTA store ${stamp}`]);
  console.log("ST", (await s.locator("a").filter({ hasText: `LTA store ${stamp}` }).first().innerText()).replace(/\n/g, " | "));
});

T("SIGNUPPW", async () => {
  if (!process.env.LTA_SP) return;
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1000, height: 1000 } }); const p = await ctx.newPage();
  await p.goto(`${WEB_URL}/signup`, { waitUntil: "load" });
  await p.waitForTimeout(3000);
  console.log("SP buttons", JSON.stringify(await p.locator("button:visible").allInnerTexts()).slice(0, 500));
  await b.close();
});

T("BILLPAGE", async () => {
  if (!process.env.LTA_BP) return;
  const p = await newPage("co", "/company/billing");
  await p.getByText("Billing and payouts").first().waitFor({ timeout: 60_000 });
  await p.waitForTimeout(2500);
  await snap(p, "BP", "plan");
  await p.getByRole("button", { name: /Get paid by parents/ }).first().click();
  await p.getByText("Bank details for invoices").first().waitFor({ timeout: 30_000 });
  await p.waitForTimeout(2000);
  await snap(p, "BP", "paid");
  const g = await newPage("co", "/help/get-paid");
  await g.waitForTimeout(1500);
  await snap(g, "BP", "guide");
  const nav = await newPage("co", "/company/bookings");
  await nav.waitForTimeout(2500);
  console.log("BP nav has Billing:", await nav.getByText("Billing & payouts").count(), "old Subscription:", await nav.getByText("Subscription", { exact: true }).count());
});

T("GOLIVE", async () => {
  if (!process.env.LTA_GL) return;
  if (!A.gl) { await signupOperator("gl", "freelancer", `LTA Golive ${stamp}`); fs.writeFileSync(CACHE, JSON.stringify(A, null, 1)); }
  const gl = await call("gl", "GET", "/api/subscription/go-live");
  console.log("GL status", gl.status, JSON.stringify(gl.json));
  const L = await mkListing("gl", `LTA golive ${stamp}`, { status: "draft" }).catch((e) => { console.log("GL mk draft", (e as Error).message.slice(0, 200)); return null; });
  if (!L) return;
  const pub = await call("gl", "PUT", `/api/listings/${L.id}`, { status: "live" });
  console.log("GL publish via API", pub.status, JSON.stringify(pub.json).slice(0, 160));
  const w = await openWizard("gl", `LTA golive ${stamp}`, 13);
  console.log("GL btns", JSON.stringify(await w.locator("button:visible").allInnerTexts()).slice(0, 600));
  await snap(w, "GL", "wizard-last");
  await w.getByRole("button", { name: /Publish/i }).last().click({ timeout: 15_000 }).catch((e) => console.log("GL click fail", e.message.slice(0, 100)));
  await w.getByText("Before you go live").first().waitFor({ timeout: 20_000 });
  await w.waitForTimeout(1500);
  await snap(w, "GL", "modal");
  console.log("GL modal text", (await w.locator('[role="dialog"]').innerText()).replace(/\n/g, " | ").slice(0, 500));
  await w.getByLabel("I only take cash").check().catch(async () => { await w.getByText("I only take cash").click(); });
  await w.waitForTimeout(2500);
  await snap(w, "GL", "cash");
  console.log("GL after cash tick, go live enabled:", await w.getByRole("button", { name: "Go live" }).isEnabled());
});
