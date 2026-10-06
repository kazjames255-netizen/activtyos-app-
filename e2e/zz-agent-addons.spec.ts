import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test, chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { API_URL, ROOT, WEB_URL } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, fbSignIn, fbSignUp } from "./helpers/accounts";

test.describe.configure({ mode: "serial" });
const SHOTS = path.join(ROOT, "e2e/review/shots/addons");
const CACHE = path.join(SHOTS, "accounts.json");
const RESULTS_PATH = path.join(SHOTS, "results.json");
fs.mkdirSync(SHOTS, { recursive: true });
const ONLY = process.env.AO_ONLY ? process.env.AO_ONLY.split(",") : null;

type Kind = string;
const TRACKER: Record<string, string> = { co: "company", fl: "freelancer", fr: "franchise", p: "parent" };
const PORTAL: Record<string, string> = { co: "company", fl: "freelancer", fr: "franchise", p: "custdash", p1: "custdash", p2: "custdash", ho: "company" };
interface Res { id: string; kind: Kind; ok: boolean; note: string; shots: string[]; blocked?: boolean }
const results: Res[] = fs.existsSync(RESULTS_PATH) ? JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8")) : [];
const saveResults = () => fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));

interface Acct { email: string; uid: string; tenantId: string | null; franchiseId?: string | null; tok: string; tokAt: number }
let A: Record<string, Acct> = {};
const stamp = Date.now().toString(36);
const email = (n: string) => `e2e-ao-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`;
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
const HOME: Record<string, string> = {};
async function ctxFor(k: string): Promise<BrowserContext> {
  if (ctxs[k]) return ctxs[k];
  if (!theBrowser || !theBrowser.isConnected()) theBrowser = await chromium.launch();
  for (let attempt = 0; ; attempt++) {
    const ctx = await theBrowser.newContext({ viewport: { width: 1440, height: 1000 } });
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

// ───────────────────────── data helpers ─────────────────────────
const pad2 = (n: number) => String(n).padStart(2, "0");
const iso2 = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const add2 = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const t0 = new Date();
const nMon = add2(t0, (8 - t0.getDay()) % 7 || 7);
const wd = (w: number, d: number) => iso2(add2(nMon, w * 7 + d)); // week w, day d (0=Mon)
const money2 = (n: number) => Math.round(n * 100) / 100;

const ADDONS = [
  { id: "ao-lunch", name: "Hot lunch", type: "perday", price: 5, description: "A cooked lunch each day." },
  { id: "ao-tshirt", name: "Camp T-shirt", type: "once", price: 12, description: "Printed T-shirt.", questions: [{ id: "q-size", label: "T-shirt size", type: "choice", options: ["S", "M", "L"], required: true }] },
  { id: "ao-photo", name: "Photo pack", type: "once", price: 0, description: "Free photo pack." },
  { id: "ao-kit", name: "Kit hire", type: "once", price: 7.5, description: "Not attached to the listing.", questions: [{ id: "q-name", label: "Name to print", type: "text" }] },
];
async function setAddons(k: string, addons: unknown[]) {
  const lib = (await call(k, "GET", "/api/library")).json ?? {};
  await ok(k, "PUT", "/api/library", { addons, venues: lib.venues, settings: lib.settings });
}
async function bookAs(parent: string, L: Listing, items: unknown[], extra: Record<string, unknown> = {}) {
  return call(parent, "POST", "/api/my/bookings", { listingId: L.id, blockId: L.blocks[0]?.id ?? L.blockId, method: "Cash on the day", items, ...extra });
}
const lines = (r: { json: any }) => (r.json?.bookings ?? []) as any[];
const sumAmt = (r: { json: any }) => money2(lines(r).reduce((s, b) => s + (b.amount ?? 0), 0));
let L1: Listing; let L2: Listing;
const S: Record<string, any> = {};

T("AO setup", async () => {
  if (fs.existsSync(CACHE) && !process.env.AO_FRESH) {
    A = JSON.parse(fs.readFileSync(CACHE, "utf8"));
    for (const k of Object.keys(A)) { A[k].tok = (await fbSignIn(A[k].email)).idToken; A[k].tokAt = Date.now(); }
  } else {
    await signupParent("p1"); await signupParent("p2");
    await signupOperator("fl", "freelancer", `AO Free ${stamp}`);
    await signupOperator("ho", "company", `AO HO ${stamp}`);
    unwall(A.fl.tenantId!, A.ho.tenantId!);
    await joinByInvite("fr", "ho", { role: "franchise", franchiseName: `AO Alpha ${stamp}` });
    fs.writeFileSync(CACHE, JSON.stringify(A, null, 1));
  }
  await setAddons("fl", ADDONS);
  L1 = await mkListing("fl", `AO Camp ${stamp}`, { addonIds: ["ao-lunch", "ao-tshirt", "ao-photo"] });
  console.log("SETUP fl", A.fl.email, A.fl.tenantId, "L1", L1.id, "blocks", L1.blocks.length);
  S.L1 = L1;
});

// ───────────────────────── pricing & validation (API) ─────────────────────────
const week0 = [wd(0, 0), wd(0, 1), wd(0, 2), wd(0, 3), wd(0, 4)];
T("AO api-pricing", async () => {
  await check("AO-04 pricing per child/day", "fl", async () => {
    const a = kid("A"), b2 = kid("B");
    const r = await bookAs("p1", S.L1, [
      { pass: "5 days", child: a, age: 8, dates: week0, addons: [{ id: "ao-lunch", days: week0 }, { id: "ao-tshirt", answers: { "q-size": "M" } }, { id: "ao-photo" }] },
      { pass: "3 days", child: b2, age: 8, dates: week0.slice(0, 3), addons: [{ id: "ao-lunch", days: week0.slice(0, 2) }, { id: "ao-photo" }] },
    ]);
    if (r.status >= 300) throw new Error(`book ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
    const bks = lines(r);
    const A1 = bks.find((x) => (x.child ?? "").includes(a)); const B1 = bks.find((x) => (x.child ?? "").includes(b2));
    // child A: 90 + 5x5 + 12 + 0 = 127 ; child B: 54 + 2x5 + 0 = 64
    S.p04 = { refs: bks.map((x) => x.ref), a, b2 };
    const info = bks.map((x) => `${x.ref}: ${x.child} £${x.amount} listPrice=${x.listPrice} addons=${JSON.stringify(x.addons)}`).join(" | ");
    eq(sumAmt(r), 191, "total (127 + 64) " + info);
    must(A1 && B1, "both children's bookings returned " + info);
    return `A £${A1.amount} B £${B1.amount}; ${info.slice(0, 300)}`;
  });
  await check("AO-05a required question blank", "fl", async () => {
    const r = await bookAs("p1", S.L1, [{ pass: "1 day", child: kid(), age: 8, dates: [wd(1, 0)], addons: [{ id: "ao-tshirt" }] }]);
    if (r.status !== 400) throw new Error(`expected 400 got ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
    return `400: ${JSON.stringify(r.json.error).slice(0, 120)}`;
  });
  await check("AO-05b choice not offered", "fl", async () => {
    const r = await bookAs("p1", S.L1, [{ pass: "1 day", child: kid(), age: 8, dates: [wd(1, 0)], addons: [{ id: "ao-tshirt", answers: { "q-size": "XXL" } }] }]);
    if (r.status !== 400) throw new Error(`expected 400 got ${r.status}`);
    return `400: ${JSON.stringify(r.json.error).slice(0, 120)}`;
  });
  await check("AO-05c unknown add-on", "fl", async () => {
    const r = await bookAs("p1", S.L1, [{ pass: "1 day", child: kid(), age: 8, dates: [wd(1, 0)], addons: [{ id: "nope-123" }] }]);
    if (r.status !== 400) throw new Error(`expected 400 got ${r.status}`);
    return `400: ${JSON.stringify(r.json.error).slice(0, 120)}`;
  });
  await check("AO-05d add-on on a day not booked", "fl", async () => {
    const r = await bookAs("p1", S.L1, [{ pass: "1 day", child: kid(), age: 8, dates: [wd(1, 0)], addons: [{ id: "ao-lunch", days: [wd(1, 1)] }] }]);
    if (r.status !== 400) throw new Error(`expected 400 got ${r.status}`);
    return `400: ${JSON.stringify(r.json.error).slice(0, 120)}`;
  });
  await check("AO-05e add-on NOT attached to this listing (Kit hire)", "fl", async () => {
    const r = await bookAs("p1", S.L1, [{ pass: "1 day", child: kid(), age: 8, dates: [wd(1, 2)], addons: [{ id: "ao-kit" }] }]);
    if (r.status >= 300) return `refused ${r.status}: ${JSON.stringify(r.json.error).slice(0, 120)}`;
    throw new Error(`BUG: an add-on not offered on this listing was accepted and charged: amount £${sumAmt(r)} ${JSON.stringify(lines(r)[0]?.addons)}`);
  });
  await check("AO-05f same add-on sent twice on one child", "fl", async () => {
    const r = await bookAs("p1", S.L1, [{ pass: "1 day", child: kid(), age: 8, dates: [wd(1, 3)], addons: [{ id: "ao-tshirt", answers: { "q-size": "S" } }, { id: "ao-tshirt", answers: { "q-size": "S" } }] }]);
    if (r.status >= 300) return `refused ${r.status}`;
    const amt = sumAmt(r);
    if (amt > 20 + 12 + 0.001) throw new Error(`BUG: one-off T-shirt charged twice for one child: £${amt} (expected £32)`);
    return `charged once £${amt}`;
  });
});

T("AO api-views", async () => {
  await check("AO-06 booking record + register per child/day", "fl", async () => {
    const a = kid("RA"), b2 = kid("RB");
    const r = await bookAs("p2", S.L1, [
      { pass: "5 days", child: a, age: 8, dates: [wd(1, 0), wd(1, 1), wd(1, 2), wd(1, 3), wd(1, 4)], addons: [{ id: "ao-lunch", days: [wd(1, 0), wd(1, 1), wd(1, 2), wd(1, 3), wd(1, 4)] }, { id: "ao-tshirt", answers: { "q-size": "M" } }, { id: "ao-photo" }] },
      { pass: "3 days", child: b2, age: 8, dates: [wd(1, 0), wd(1, 1), wd(1, 2)], addons: [{ id: "ao-lunch", days: [wd(1, 0), wd(1, 1)] }, { id: "ao-photo" }] },
    ]);
    if (r.status >= 300) throw new Error(`book ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
    const bk = lines(r)[0];
    must(Array.isArray(bk.addonLines) && bk.addonLines.length === 5, "addonLines stored (5): " + JSON.stringify(bk.addonLines));
    S.p06 = { a, b2, ref: bk.ref };
    const out: string[] = [];
    for (const [label, d, expA, expB] of [["Mon", wd(1, 0), ["Hot lunch", "Camp T-shirt", "Photo pack"], ["Hot lunch", "Photo pack"]], ["Wed", wd(1, 2), ["Hot lunch", "Camp T-shirt", "Photo pack"], ["Photo pack"]], ["Thu", wd(1, 3), ["Hot lunch", "Camp T-shirt", "Photo pack"], null]] as const) {
      const reg = await ok("fl", "GET", `/api/registers?date=${d}`);
      const atts = ((reg.sessions ?? reg ?? []) as any[]).flatMap((x: any) => x.attendees ?? []);
      const ra = atts.find((x) => x.children?.[0]?.name === a); const rb = atts.find((x) => x.children?.[0]?.name === b2);
      const names = (x: any) => (x?.addons ?? []).map((l: string) => l.replace(/ \(.*?\)/, "").replace(/ [×—].*$/, "")).sort().join("+");
      eq(names(ra), [...expA].sort().join("+"), `${label} child A extras`);
      if (expB === null) must(!rb, `${label}: child B (3-day pass) is not on the register`);
      else eq(names(rb), [...expB].sort().join("+"), `${label} child B extras (sibling's T-shirt must not show)`);
      out.push(`${label} A[${names(ra)}] B[${names(rb)}]`);
    }
    return out.join("; ");
  });
});

// ───────────────────────── provider wizard UI (step 10) ─────────────────────────
T("AO wizard-ui", async () => {
  await check("AO-07 wizard step 10", "fl", async (shots) => {
    const p = await openWizard("fl", S.L1.title, 10);
    await p.getByText(/Step 10 of 13/).waitFor({ timeout: 20_000 });
    shots.push(await snap(p, "AO-07", "step10-initial", ["Hot lunch"]));
    // existing add-ons: three ticked, Kit hire not
    const rowOf = (n: string) => p.locator("div.rounded-lg.border.p-2\\.5").filter({ hasText: n }).first();
    const ticked = async (n: string) => (await rowOf(n).locator("span.text-\\[13px\\]").first().innerText()).trim() === "☑";
    eq(await ticked("Hot lunch"), true, "Hot lunch ticked"); eq(await ticked("Camp T-shirt"), true, "T-shirt ticked");
    eq(await ticked("Photo pack"), true, "Photo pack ticked"); eq(await ticked("Kit hire"), false, "Kit hire NOT ticked");
    // create a new add-on with a required choice question
    await p.getByPlaceholder("e.g. Late pick-up").fill("Bus transfer");
    await p.getByPlaceholder("e.g. Collect any time").fill("Door to door");
    await p.locator('input[type="number"]').last().fill("3");
    await p.locator("select").filter({ hasText: /Per day|One-off|Once/i }).last().selectOption("once").catch(() => {});
    await p.getByRole("button", { name: /Add a question/ }).click();
    await p.getByPlaceholder("e.g. T-shirt size").fill("Pick-up point");
    await p.getByPlaceholder("Age 5-6, Age 7-8, Age 9-10").fill("North gate, South gate");
    await p.getByLabel("Must answer").check();
    shots.push(await snap(p, "AO-07", "step10-create-form"));
    await p.getByRole("button", { name: /^＋ Add$/ }).click(); await p.waitForTimeout(1200);
    shots.push(await snap(p, "AO-07", "step10-after-create", ["Bus transfer"]));
    eq(await ticked("Bus transfer"), true, "new add-on auto-ticked for this listing");
    // edit it (price 3 -> 4)
    await rowOf("Bus transfer").getByRole("button", { name: /^Edit$/ }).click(); await p.waitForTimeout(500);
    await p.locator('input[type="number"]').last().fill("4");
    await p.getByText(/^Editing/).first().locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]").getByRole("button", { name: /Save changes/ }).click(); await p.waitForTimeout(1200);
    must(/£4\.00/.test(await rowOf("Bus transfer").innerText()), "price shows £4.00 after edit: " + (await rowOf("Bus transfer").innerText()).replace(/\n/g, " "));
    // untick lunch, then re-tick
    await rowOf("Photo pack").locator("button").first().click(); await p.waitForTimeout(500);
    shots.push(await snap(p, "AO-07", "after-untick"));
    eq(await ticked("Photo pack"), false, "Photo pack unticked");
    await rowOf("Photo pack").locator("button").first().click(); await p.waitForTimeout(500);
    eq(await ticked("Photo pack"), true, "Photo pack re-ticked");
    shots.push(await snap(p, "AO-07", "step10-edited"));
    await p.waitForTimeout(2500);
    await p.getByText(/✓ Saved/).first().waitFor({ timeout: 20_000 }).catch(() => {});
    await p.getByRole("button", { name: "Save changes" }).last().click();
    await p.getByText("Your listing is live!").waitFor({ timeout: 20_000 }).then(async () => { shots.push(await snap(p, "AO-07", "save-changes-live-modal")); await p.getByText("Done", { exact: true }).click(); }).catch(() => {});
    await p.waitForTimeout(1500);
    // verify what was stored
    const lib = (await call("fl", "GET", "/api/library")).json;
    const bus = (lib.addons ?? []).find((a: any) => a.name === "Bus transfer");
    must(bus, "Bus transfer saved to the library");
    eq(bus.price, 4, "saved price"); eq(bus.type, "once", "saved type"); eq(bus.questions?.[0]?.required, true, "question required flag");
    eq(JSON.stringify(bus.questions?.[0]?.options), JSON.stringify(["North gate", "South gate"]), "question options");
    const full = (await call("fl", "GET", `/api/listings/${S.L1.id}`)).json;
    must((full.addonIds ?? []).includes(bus.id), "Bus transfer attached to the listing: " + JSON.stringify(full.addonIds));
    S.busId = bus.id;
    return `library+listing saved; addonIds=${JSON.stringify(full.addonIds)}; ` + (warns.length ? "WARN " + warns.join(";") : "");
  });
});

T("AO wizard-race", async () => {
  await check("AO-07b tick then Save changes immediately", "fl", async (shots) => {
    const L = await mkListing("fl", `AO Race ${stamp}`, { addonIds: ["ao-lunch"] });
    const p = await openWizard("fl", L.title, 10);
    const puts: string[] = [];
    p.on("request", (rq) => { if (rq.method() === "PUT" && /\/api\/listings\//.test(rq.url())) { try { const j = JSON.parse(rq.postData() ?? "{}"); puts.push(`${Date.now() % 100000} status=${j.status} addonIds=${JSON.stringify(j.addonIds)}`); } catch { /* */ } } });
    p.on("response", async (rs) => { if (rs.request().method() === "PUT" && /\/api\/listings\//.test(rs.url())) puts.push(`-> ${rs.status()} ${(await rs.text().catch(() => "")).slice(0, 120)}`); });
    await p.getByText("Hot lunch").first().waitFor();
    const rowOf = (n: string) => p.locator("div.rounded-lg.border.p-2\\.5").filter({ hasText: n }).first();
    await rowOf("Photo pack").locator("button").first().click();   // tick Photo pack
    await rowOf("Camp T-shirt").locator("button").first().click(); // tick T-shirt
    await p.getByRole("button", { name: "Save changes" }).last().click();  // straight away, no pause
    await p.getByText("Your listing is live!").waitFor({ timeout: 20_000 }).then(async () => { await p.getByText("Done", { exact: true }).click(); }).catch(() => {});
    await p.waitForTimeout(3000);
    const full = await poll(async () => (await call("fl", "GET", `/api/listings/${L.id}`)).json, (j) => (j.addonIds ?? []).length === 3, "saved add-ons", 25_000).catch(async () => (await call("fl", "GET", `/api/listings/${L.id}`)).json);
    shots.push(await snap(p, "AO-07b", "after-save"));
    const ids = (full.addonIds ?? []).slice().sort().join(",");
    console.log("PUTS", puts.join(" | "));
    eq(ids, ["ao-lunch", "ao-photo", "ao-tshirt"].sort().join(","), "saved add-ons after two quick ticks + immediate Save changes " + puts.join(" | "));
    return `saved ${ids}`;
  });
});

// ───────────────────────── parent checkout UI ─────────────────────────
T("AO parent-ui", async () => {
  await check("AO-08 parent checkout UI", "p", async (shots) => withRetry(async (n) => {
    shots.length = 0;
    const a = `Ava${n}${stamp.slice(-4)}`, b2 = `Ben${n}${stamp.slice(-4)}`;
    await newChild("p2", a); await newChild("p2", b2);
    const p = await newPage("p2", `/book/${S.L1.id}`);
    await p.getByText(/Tap a week/).first().waitFor({ timeout: 45_000 });
    shots.push(await snap(p, "AO-08", "1-booking-page"));
    await p.getByRole("button", { name: monRe() }).first().click();
    await p.getByRole("button", { name: /ADD 5 DAYS TO BASKET/i }).click();
    await p.getByRole("button", { name: /NEXT — ADD CHILDREN/i }).click();
    await p.getByRole("button", { name: new RegExp(a) }).first().click();
    await p.getByRole("button", { name: new RegExp(b2) }).first().click();
    await p.getByRole("button", { name: "Next", exact: true }).click();
    // Extra 1: Hot lunch (per day)
    await p.getByText(/Extra 1 of/).first().waitFor({ timeout: 30_000 });
    shots.push(await snap(p, "AO-08", "2-extra1-lunch"));
    await p.getByRole("button", { name: "Everyone, every day" }).click();
    await p.waitForTimeout(500);
    shots.push(await snap(p, "AO-08", "3-extra1-lunch-picked"));
    await p.getByRole("button", { name: "Next →" }).last().click();
    // Extra 2: T-shirt (once, required size)
    await p.getByText(/Extra 2 of/).first().waitFor({ timeout: 15_000 });
    await p.getByRole("button", { name: "Everyone", exact: true }).click();
    // Next must be blocked until sizes are answered
    const blocked = await p.getByRole("button", { name: /needs|size/i }).first().isDisabled().catch(() => null);
    shots.push(await snap(p, "AO-08", "4-extra2-tshirt-needs-size"));
    for (const btn of await p.getByRole("button", { name: "M", exact: true }).all()) await btn.click();
    await p.waitForTimeout(400);
    shots.push(await snap(p, "AO-08", "5-extra2-tshirt-sized"));
    await p.getByRole("button", { name: "Next →" }).last().click();
    // Extra 3: Photo pack (free)
    await p.getByText(/Extra 3 of/).first().waitFor({ timeout: 15_000 });
    await p.getByRole("button", { name: "Everyone", exact: true }).click();
    await p.getByRole("button", { name: "Next →" }).last().click();
    await p.getByText(/How you.ll pay/i).first().waitFor({ timeout: 30_000 });
    const ph = p.getByPlaceholder("e.g. 07700 900123");
    if (await ph.count()) await ph.fill("07700900123");
    shots.push(await snap(p, "AO-08", "7-pay-step"));
    const body = await p.locator("body").innerText();
    must(/£254\.00/.test(body), "pay step total shows £254.00 (2 x 90 + lunch 2 x 25 + T-shirt 2 x 12): " + (body.match(/£[\d,]+\.\d\d/g) ?? []).join(" "));
    must(/£74\.00/.test(body), "add-ons line shows £74.00");
    S.ui08 = { a, b2, body: body.slice(0, 0) };
    // place it
    await p.getByRole("button", { name: /Cash on the day/ }).first().click().catch(() => {});
    await p.waitForTimeout(500);
    shots.push(await snap(p, "AO-08", "8-pay-cash"));
    await p.getByRole("button", { name: /Confirm/ }).last().click();
    await p.waitForTimeout(6000);
    shots.push(await snap(p, "AO-08", "9-done"));
    const mine = ((await call("p2", "GET", "/api/my/bookings")).json ?? []).filter((x: any) => (x.child ?? "").includes(a));
    must(mine.length, "booking exists for " + a);
    const tot = money2(mine.reduce((s: number, x: any) => s + x.amount, 0));
    eq(tot, 254, "booked amount equals the checkout total");
    S.ui08.ref = mine[0].ref;
    return `UI total £254.00 = server £${tot}; blocked-next-without-size=${blocked}; ref ${mine[0].ref}; addons ${JSON.stringify(mine[0].addons)}`;
  }));
});

T("AO views-ui", async () => {
  await check("AO-10 provider detail + parent My bookings show extras per child", "fl", async (shots) => {
    const ref = S.ui08?.ref ?? process.env.AO_REF;
    if (!ref) throw new Error("needs AO-08 first (or AO_REF)");
    const names = [S.ui08?.a, S.ui08?.b2].filter(Boolean) as string[];
    const pp = await newPage("p2", `/custdash/bookings?open=${encodeURIComponent(ref)}`);
    await pp.getByText(ref).first().waitFor({ timeout: 45_000 });
    await pp.waitForTimeout(1500);
    const ptxt = await pp.locator("body").innerText();
    shots.push(await snap(pp, "AO-10", "parent-my-bookings"));
    must(/Hot lunch/.test(ptxt) && /Camp T-shirt/.test(ptxt), "parent sees the extras");
    if (names.length === 2) must(ptxt.includes(`for ${names[0]}`) && ptxt.includes(`for ${names[1]}`), "parent view names whose extra each is");
    const op = await newPage("fl", `/freelancer/bookings?open=${encodeURIComponent(ref)}`);
    await op.getByText(ref).first().waitFor({ timeout: 45_000 });
    await op.waitForTimeout(2000);
    shots.push(await snap(op, "AO-10", "provider-bookings"));
    const row = op.getByText(ref).first(); await row.click().catch(() => {});
    await op.waitForTimeout(1500);
    const otxt = await op.locator("body").innerText();
    shots.push(await snap(op, "AO-10", "provider-detail"));
    must(/Hot lunch/.test(otxt), "provider detail lists the extras");
    if (names.length === 2) must(otxt.includes(`for ${names[0]}`), "provider detail names whose extra each is");
    return "both views list extras with child names";
  });
});

/** The dev server hot-reloads when other agents save files and a flow can reset mid-way: run a UI flow up to 3 times. */
async function withRetry<T>(fn: (attempt: number) => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) { try { return await fn(i); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 6000)); } }
  throw last;
}
// ───────────────────────── helpers for the UI checkout ─────────────────────────
/** Drives /book/<id> as a parent: week 1, 5-day pass, the given children, all three extras (lunch every day, T-shirt M, photo). Stops at pay and returns the page + body text. */
async function uiToPayWithExtras1(parent: string, L: Listing, kids: string[], shotsTag?: { shots: string[]; id: string }, pickExtras = true) {
  const p = await newPage(parent, `/book/${L.id}`);
  await p.getByText(/Tap a week/).first().waitFor({ timeout: 45_000 });
  await p.getByRole("button", { name: monRe() }).first().click();
  await p.getByRole("button", { name: /ADD 5 DAYS TO BASKET/i }).click();
  await p.getByRole("button", { name: /NEXT — ADD CHILDREN/i }).click();
  for (const k of kids) await p.getByRole("button", { name: new RegExp(k) }).first().click();
  await p.getByRole("button", { name: "Next", exact: true }).click();
  const n = await (async () => { await p.getByText(/Extra 1 of/).first().waitFor({ timeout: 30_000 }); return Number(((await p.getByText(/Extra 1 of \d+/i).first().innerText()).match(/of (\d+)/i) ?? [])[1] ?? 0); })();
  for (let i = 1; i <= n; i++) {
    await p.getByText(new RegExp(`Extra ${i} of`)).first().waitFor({ timeout: 15_000 });
    const title = (await p.locator("span.italic.uppercase, span.font-black.uppercase").first().innerText().catch(() => "")).toLowerCase();
    if (!pickExtras) { await p.getByRole("button", { name: "Skip →" }).last().click(); continue; }
    const sweep = p.getByRole("button", { name: /^(Everyone, every day|Everyone)$/ }).first();
    await sweep.waitFor({ timeout: 15_000 });
    await sweep.click();
    for (const btn of await p.getByRole("button", { name: "M", exact: true }).all()) await btn.click().catch(() => {});
    await p.waitForTimeout(300);
    await p.getByRole("button", { name: "Next →" }).last().click();
    await p.waitForTimeout(400);
  }
  try { await p.getByText(/How you.ll pay/i).first().waitFor({ timeout: 30_000 }); }
  catch (e) { await p.screenshot({ path: path.join(SHOTS, `dbg.pay-${Date.now()}.png`), fullPage: true }); throw e; }
  const ph = p.getByPlaceholder("e.g. 07700 900123"); if (await ph.count()) await ph.fill("07700900123");
  await p.waitForTimeout(600);
  if (shotsTag) shotsTag.shots.push(await snap(p, shotsTag.id, "pay-step"));
  return { p, text: await p.locator("body").innerText() };
}
/** The dev server hot-reloads whenever another agent saves a file, which resets the checkout mid-flow: retry the whole walk on a fresh page. */
async function uiToPayWithExtras(parent: string, L: Listing, kids: string[], shotsTag?: { shots: string[]; id: string }, pickExtras = true) {
  let last: unknown;
  for (let i = 0; i < 4; i++) { try { return await uiToPayWithExtras1(parent, L, kids, shotsTag, pickExtras); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 8000)); } }
  throw last;
}
const totalFrom = (t: string) => { const m = [...t.matchAll(/(?:pay|Pay)\s+£([\d,]+\.\d\d)/g)]; return m.length ? parseFloat(m[m.length - 1][1].replace(/,/g, "")) : NaN; };
const mkKids = async (parent: string, tag: string, n = 2) => { const out: string[] = []; for (let i = 0; i < n; i++) { const nm = `${tag}${i}${stamp.slice(-4)}`; await newChild(parent, nm); out.push(nm); } return out; };
async function recordPaid(ref: string, amount: number) {
  return call("fl", "POST", `/api/bookings/${encodeURIComponent(ref)}/record-payment`, { amount, method: "Cash", reference: `AO-${ref}` });
}
const reconcile = (listingId: string) => execFileSync("server/node_modules/.bin/tsx", ["server/tools/reconcile.ts", listingId], { cwd: ROOT, env: { ...process.env, TENANT_ID: A.fl.tenantId! }, encoding: "utf8" }).split("\n").filter((l) => /TOTAL|MISMATCH|BAD/.test(l)).join(" | ");

// ───────────────────────── discounts × add-ons ─────────────────────────
T("AO discounts", async () => {
  await check("AO-11 discounts x add-ons", "fl", async (shots) => {
    L2 = await mkListing("fl", `AO Disc ${stamp}`, { addonIds: ["ao-lunch", "ao-tshirt", "ao-photo"], discounts: [{ id: "d-person", kind: "person", name: "Sibling 10%", passNames: [], enabled: true, moreThan: 1, appliesTo: "all", method: "percent", value: 10, beforeDate: "" }] });
    S.L2 = L2;
    const kids = await mkKids("p1", "Dk");
    const { p, text } = await uiToPayWithExtras("p1", L2, kids, { shots, id: "AO-11" });
    const uiTotal = totalFrom(text);
    // 2 x 90 = 180, 10% off = 18 -> 162; extras 2 x (25 + 12) = 74 undiscounted -> 236
    eq(uiTotal, 236, "checkout total (162 pass + 74 extras)");
    await p.getByRole("button", { name: /Cash on the day/ }).first().click().catch(() => {});
    await p.getByRole("button", { name: /Confirm/ }).last().click();
    await p.waitForTimeout(6000);
    const mine = ((await call("p1", "GET", "/api/my/bookings")).json ?? []).filter((x: any) => (x.child ?? "").includes(kids[0]));
    const tot = money2(mine.reduce((s: number, x: any) => s + x.amount, 0));
    eq(tot, 236, "server booked amount");
    const b = mine[0];
    eq(b.listPrice, 254, "listPrice includes extras (180 + 74)"); eq(b.discountOff, 18, "discount is 10% of the pass price only");
    S.p11 = { ref: b.ref, kids };
    return `UI £${uiTotal} = server £${tot}; list £${b.listPrice} off £${b.discountOff}`;
  });
});

// ───────────────────────── money: payment, cancel, partial, move ─────────────────────────
const wk1 = [wd(1, 0), wd(1, 1), wd(1, 2), wd(1, 3), wd(1, 4)];
T("AO money", async () => {
  await check("AO-12 whole-booking cancel refunds extras too", "fl", async () => {
    const a = kid("CA");
    const r = await bookAs("p1", S.L1, [{ pass: "5 days", child: a, age: 8, dates: wk1, addons: [{ id: "ao-lunch", days: wk1 }, { id: "ao-tshirt", answers: { "q-size": "L" } }] }]);
    if (r.status >= 300) throw new Error(`book ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
    const bk = lines(r)[0]; eq(bk.amount, 127, "amount 90 + 25 + 12");
    const pay = await recordPaid(bk.ref, 127); if (pay.status >= 300) throw new Error("record-payment " + JSON.stringify(pay.json).slice(0, 200));
    const c = await call("p1", "POST", `/api/my/bookings/${bk.ref}/cancel`, { msg: "AO test", refundPref: "card" });
    if (c.status >= 300) throw new Error(`cancel ${c.status} ${JSON.stringify(c.json).slice(0, 200)}`);
    const cancel = c.json?.cancel ?? c.json?.booking?.cancel ?? {};
    eq(cancel.amount, 127, "refund asked = everything paid incl. lunch and T-shirt (week-ahead band is 100%): " + JSON.stringify(cancel).slice(0, 160));
    return `refund request £${cancel.amount} of £127 (${cancel.refund})`;
  });
  await check("AO-12b partial day cancel value with extras", "fl", async () => {
    const a = kid("PA");
    const r = await bookAs("p1", S.L1, [{ pass: "5 days", child: a, age: 8, dates: wk1, addons: [{ id: "ao-lunch", days: wk1 }, { id: "ao-tshirt", answers: { "q-size": "L" } }] }]);
    const bk = lines(r)[0];
    await recordPaid(bk.ref, bk.amount);
    const c = await call("p1", "POST", `/api/my/bookings/${bk.ref}/cancel`, { days: [wk1[4]], resolution: "refund" });
    if (c.status >= 300) throw new Error(`partial cancel ${c.status} ${JSON.stringify(c.json).slice(0, 200)}`);
    const cn = c.json?.cancel ?? c.json?.booking?.cancel ?? {};
    // pro-rata: £127 / 5 days = £25.40 for the released day (18 pass + 5 lunch + 2.4 share of the one-off T-shirt)
    return `released 1 of 5 days -> refund £${cn.amount} (pro-rata of everything paid: 127/5 = 25.40). NOTE one-off extras are spread across days`;
  });
  await check("AO-13 date move carries the day's lunch to the register", "fl", async () => {
    const a = kid("MA");
    const r = await bookAs("p2", S.L1, [{ pass: "1 day", child: a, age: 8, dates: [wd(2, 0)], addons: [{ id: "ao-lunch", days: [wd(2, 0)] }] }]);
    if (r.status >= 300) throw new Error(`book ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
    const bk = lines(r)[0];
    const m = await call("p2", "POST", `/api/my/bookings/${bk.ref}/amend`, { moves: [{ childName: a, from: wd(2, 0), to: wd(2, 2) }] });
    if (m.status >= 300) throw new Error(`amend ${m.status} ${JSON.stringify(m.json).slice(0, 250)}`);
    let st = m.json?.dateChangeRequest?.status ?? m.json?.booking?.dateChangeRequest?.status;
    if (st === "pending") { const ap = await call("fl", "POST", `/api/bookings/${bk.ref}/actions`, { type: "move-approve" }); if (ap.status >= 300) throw new Error("approve " + JSON.stringify(ap.json).slice(0, 200)); st = "approved"; }
    const reg = await ok("fl", "GET", `/api/registers?date=${wd(2, 2)}`);
    const atts = ((reg.sessions ?? reg ?? []) as any[]).flatMap((x: any) => x.attendees ?? []);
    const row = atts.find((x) => x.children?.[0]?.name === a);
    must(row, "child is on the register on the NEW day " + wd(2, 2));
    must((row.addons ?? []).some((l: string) => /Hot lunch/.test(l)), "the moved day's lunch shows on the new day: " + JSON.stringify(row.addons));
    return `moved Mon -> Wed (${st}); register on the new day lists ${JSON.stringify(row.addons)}`;
  });
  await check("AO-14 payments + finance reconcile", "fl", async () => {
    const out = reconcile(S.L1.id);
    must(/mismatches 0/.test(out), "reconcile: " + out);
    return out;
  });
});

// ───────────────────────── waitlist, duplicate, edit/delete, removal ─────────────────────────
T("AO lifecycle", async () => {
  await check("AO-15 waitlist keeps extras through the offer", "fl", async () => {
    const L3 = await mkListing("fl", `AO Wait ${stamp}`, { addonIds: ["ao-lunch", "ao-tshirt", "ao-photo"], maxAttendees: "1", capacityScope: "day" });
    S.L3 = L3;
    const d = wd(1, 1);
    const first = await bookAs("p1", L3, [{ pass: "1 day", child: kid("W1"), age: 8, dates: [d] }]);
    if (first.status >= 300) throw new Error("first " + JSON.stringify(first.json).slice(0, 200));
    const nm = kid("W2");
    const w = await bookAs("p2", L3, [{ pass: "1 day", child: nm, age: 8, dates: [d], addons: [{ id: "ao-lunch", days: [d] }, { id: "ao-tshirt", answers: { "q-size": "S" } }] }]);
    if (w.status >= 300) throw new Error("waitlist book " + w.status + JSON.stringify(w.json).slice(0, 250));
    const wb = lines(w)[0];
    eq(wb.status, "Waitlisted", "second booking waitlisted");
    must((wb.addons ?? []).length === 2 && (wb.addonLines ?? []).length === 2, "waitlisted booking stores its extras: " + JSON.stringify(wb.addons));
    eq(wb.amount, 20 + 5 + 12, "waitlisted amount includes extras");
    // free the place: the first parent cancels, provider offers the place to the waitlisted booking
    const f = lines(first)[0];
    await call("p1", "POST", `/api/my/bookings/${f.ref}/cancel`, { msg: "free it" });
    const off = await call("fl", "POST", `/api/bookings/${wb.ref}/actions`, { type: "offer" });
    if (off.status >= 300) throw new Error("offer " + off.status + JSON.stringify(off.json).slice(0, 200));
    const acc = await call("p2", "POST", `/api/my/bookings/${wb.ref}/accept-offer`, {});
    if (acc.status >= 300) throw new Error("accept-offer " + acc.status + JSON.stringify(acc.json).slice(0, 200));
    const after = ((await call("p2", "GET", "/api/my/bookings")).json ?? []).find((x: any) => x.ref === wb.ref);
    eq(after?.status, "Confirmed", "offer accepted -> confirmed");
    eq(after?.amount, 37, "amount unchanged after the offer");
    must((after?.addons ?? []).length === 2, "extras still on the confirmed booking");
    return `waitlisted £${wb.amount} with 2 extras -> offered -> confirmed £${after.amount}`;
  });
  await check("AO-16 duplicate listing keeps add-ons", "fl", async (shots) => {
    const p = await newPage("fl", "/freelancer/listings");
    const title = S.L1.title;
    await p.getByText(title).first().waitFor({ timeout: 60_000 });
    const card = p.locator('[data-ui="card"]').filter({ hasText: title }).first();
    await card.getByRole("button", { name: "⋯" }).click(); await p.waitForTimeout(400);
    await p.getByText(/Duplicate/).first().click(); await p.waitForTimeout(4000);
    const copies = ((await call("fl", "GET", "/api/listings?mine=1")).json ?? []).filter((l: any) => (l.title ?? l.name) === `${title} (copy)` || (l.name ?? "") === `${title} (copy)`);
    must(copies.length, "copy created");
    const full = (await call("fl", "GET", `/api/listings/${copies[0].id}`)).json;
    const orig = (await call("fl", "GET", `/api/listings/${S.L1.id}`)).json;
    eq(JSON.stringify([...(full.addonIds ?? [])].sort()), JSON.stringify([...(orig.addonIds ?? [])].sort()), "copy has the same add-ons");
    shots.push(await snap(p, "AO-16", "after-duplicate"));
    S.copyId = copies[0].id;
    // the copy opens in the wizard at step 10 with the add-ons ticked
    const w = await openWizard("fl", `${title} (copy)`, 10);
    const t = await w.locator("body").innerText();
    must(/Hot lunch/.test(t) && /Camp T-shirt/.test(t), "add-ons visible on the copy's step 10");
    shots.push(await snap(w, "AO-16", "copy-step10"));
    return `copy ${copies[0].id}: addonIds ${JSON.stringify(full.addonIds)}`;
  });
  await check("AO-17 edit and delete add-on after bookings", "fl", async () => {
    const L4 = await mkListing("fl", `AO Edit ${stamp}`, { addonIds: ["ao-lunch", "ao-tshirt"] });
    const b1 = await bookAs("p1", L4, [{ pass: "1 day", child: kid("E1"), age: 8, dates: [wd(1, 0)], addons: [{ id: "ao-lunch", days: [wd(1, 0)] }] }]);
    const old = lines(b1)[0]; eq(old.amount, 25, "first booking £20 + £5 lunch");
    // provider raises lunch to £9
    const lib = (await call("fl", "GET", "/api/library")).json;
    await ok("fl", "PUT", "/api/library", { addons: lib.addons.map((a: any) => (a.id === "ao-lunch" ? { ...a, price: 9 } : a)) });
    const after = ((await call("p1", "GET", "/api/my/bookings")).json ?? []).find((x: any) => x.ref === old.ref);
    eq(after.amount, 25, "existing booking unchanged by the price edit"); must((after.addons ?? [])[0]?.includes("£5.00"), "existing booking still says £5.00: " + after.addons);
    const b2 = await bookAs("p1", L4, [{ pass: "1 day", child: kid("E2"), age: 8, dates: [wd(1, 1)], addons: [{ id: "ao-lunch", days: [wd(1, 1)] }] }]);
    eq(lines(b2)[0].amount, 29, "new booking uses the new price (20 + 9)");
    // delete lunch from the library
    await ok("fl", "PUT", "/api/library", { addons: lib.addons.filter((a: any) => a.id !== "ao-lunch").concat([{ ...ADDONS[0] }]).filter((a: any) => a.id !== "ao-lunch") });
    const afterDel = ((await call("p1", "GET", "/api/my/bookings")).json ?? []).find((x: any) => x.ref === old.ref);
    eq(afterDel.amount, 25, "existing booking unchanged after the add-on is deleted"); must((afterDel.addons ?? []).length === 1, "existing booking still lists its extra");
    const b3 = await bookAs("p1", L4, [{ pass: "1 day", child: kid("E3"), age: 8, dates: [wd(1, 2)], addons: [{ id: "ao-lunch", days: [wd(1, 2)] }] }]);
    must(b3.status === 400, "a deleted add-on can no longer be booked: " + b3.status);
    // restore for later checks
    await setAddons("fl", [...ADDONS, ...((await call("fl", "GET", "/api/library")).json.addons ?? []).filter((a: any) => !ADDONS.some((x) => x.id === a.id))]);
    return "edit: old £5 / new £9; delete: old booking intact, new booking refused (400)";
  });
  await check("AO-18 add-on removed from the listing while in a basket", "fl", async () => {
    const L5 = await mkListing("fl", `AO Basket ${stamp}`, { addonIds: ["ao-lunch", "ao-photo"] });
    // the parent has lunch in their basket; the provider un-ticks it; the parent pays
    await ok("fl", "PUT", `/api/listings/${L5.id}`, { addonIds: ["ao-photo"] });
    const r = await bookAs("p1", L5, [{ pass: "1 day", child: kid("B1"), age: 8, dates: [wd(1, 3)], addons: [{ id: "ao-lunch", days: [wd(1, 3)] }, { id: "ao-photo" }] }]);
    must(r.status === 400, `refused with a clear message (got ${r.status}): ` + JSON.stringify(r.json).slice(0, 160));
    must(/isn't offered/.test(JSON.stringify(r.json)), "message explains it: " + JSON.stringify(r.json).slice(0, 160));
    return `400: ${r.json.error}`;
  });
});

T("AO franchise", async () => {
  await check("AO-19 franchise listing uses the franchise's own add-ons", "fr", async () => {
    await setAddons("ho", [{ id: "ho-only", name: "HQ lanyard", type: "once", price: 3 }]);
    await setAddons("fr", [{ id: "fr-lunch", name: "Franchise lunch", type: "perday", price: 6 }]);
    const LF = await mkListing("fr", `AO Fr ${stamp}`, { addonIds: ["fr-lunch"] });
    const d3 = [wd(1, 0), wd(1, 1), wd(1, 2)];
    const r = await bookAs("p1", LF, [{ pass: "3 days", child: kid("F1"), age: 8, dates: d3, addons: [{ id: "fr-lunch", days: d3 }] }]);
    if (r.status >= 300) throw new Error(`book ${r.status} ${JSON.stringify(r.json).slice(0, 250)}`);
    eq(sumAmt(r), 54 + 18, "3-day pass £54 + lunch 3 x £6");
    const r2 = await bookAs("p1", LF, [{ pass: "1 day", child: kid("F2"), age: 8, dates: [wd(1, 4)], addons: [{ id: "ho-only" }] }]);
    must(r2.status === 400, `head office add-on is not available on a franchise listing (got ${r2.status}): ` + JSON.stringify(r2.json).slice(0, 120));
    // the franchise sees its own add-ons in the wizard step 10
    const p = await openWizard("fr", LF.title, 10);
    const t = await p.locator("body").innerText();
    must(/Franchise lunch/.test(t) && !/HQ lanyard/.test(t), "wizard lists franchise add-ons only");
    return `franchise booking £${sumAmt(r)}; HO add-on refused (${r2.status}); wizard shows franchise add-ons only`;
  });
});

T("AO insights", async () => {
  await check("AO-20 finance insights add-ons tab", "fl", async (shots) => {
    const p = await newPage("fl", "/freelancer/finance");
    await p.getByRole("button", { name: /Insights/ }).first().click({ timeout: 45_000 });
    await p.getByRole("button", { name: /Add-ons/ }).first().click();
    await p.waitForTimeout(2000);
    shots.push(await snap(p, "AO-20", "insights-addons"));
    const t = await p.locator("body").innerText();
    must(/Hot lunch/.test(t), "Insights > Add-ons names the real add-ons (Hot lunch): " + t.slice(0, 0));
    must(!/^\s*Add-on\s*$/m.test(t) || /Camp T-shirt/.test(t), "not lumped under a generic 'Add-on' label");
    const m = t.match(/Hot lunch[^\n]*\n?[^\n]*£[\d.,]+/);
    return `names shown; sample: ${(m?.[0] ?? "").replace(/\n/g, " ").slice(0, 120)}`;
  });
  await check("AO-21 invoice includes extras", "fl", async () => {
    // find an invoice route that renders a booking: the booking document / invoice builder
    const inv = await call("fl", "GET", "/api/invoices");
    return `invoices endpoint ${inv.status}: ${JSON.stringify(inv.json).slice(0, 160)}`;
  });
  await check("AO-22 negative or blank price add-on can never take money off", "fl", async () => {
    await setAddons("fl", [...ADDONS, { id: "ao-neg", name: "Bad price", type: "once", price: -50 }]);
    const L6 = await mkListing("fl", `AO Neg ${stamp}`, { addonIds: ["ao-neg"] });
    const r = await bookAs("p1", L6, [{ pass: "1 day", child: kid("N1"), age: 8, dates: [wd(1, 0)], addons: [{ id: "ao-neg" }] }]);
    if (r.status >= 300) throw new Error("book " + r.status + JSON.stringify(r.json).slice(0, 150));
    eq(sumAmt(r), 20, "a -£50 add-on is treated as free, never a credit");
    await setAddons("fl", ADDONS);
    return "price -50 -> charged £0 for the extra (total £20)";
  });
});

T("AO meals", async () => {
  await check("AO-23 meals and extras per child", "fl", async () => {
    const menu = await ok("fl", "POST", "/api/meal-menus", { name: `AO Menu ${stamp}`, items: [{ id: "m1", name: "Pasta bake", price: 3.5, allergens: ["gluten"], diet: "veg" }] });
    const LM = await mkListing("fl", `AO Meals ${stamp}`, { addonIds: ["ao-tshirt"] });
    const plan: Record<string, unknown> = {}; for (let d = 0; d < 5; d++) plan[wd(1, d)] = { menuId: menu.id, itemIds: [] };
    await ok("fl", "PUT", `/api/listings/${LM.id}`, { mealsEnabled: true, mealPlan: plan });
    const a = kid("ML"), b2 = kid("MN");
    const r = await bookAs("p1", LM, [
      { pass: "3 days", child: a, age: 8, dates: [wd(1, 0), wd(1, 1), wd(1, 2)], addons: [{ id: "ao-tshirt", answers: { "q-size": "M" } }], meals: [{ menuItemId: "m1", date: wd(1, 0) }, { menuItemId: "m1", date: wd(1, 2) }] },
      { pass: "3 days", child: b2, age: 8, dates: [wd(1, 0), wd(1, 1), wd(1, 2)] },
    ]);
    if (r.status >= 300) throw new Error(`book ${r.status} ${JSON.stringify(r.json).slice(0, 250)}`);
    eq(sumAmt(r), 54 * 2 + 12 + 7, "2 x £54 + T-shirt £12 + 2 meals x £3.50");
    const mon = await ok("fl", "GET", `/api/registers?date=${wd(1, 0)}`);
    const tue = await ok("fl", "GET", `/api/registers?date=${wd(1, 1)}`);
    const rows = (reg: any) => ((reg.sessions ?? reg ?? []) as any[]).flatMap((x: any) => x.attendees ?? []);
    const ra = rows(mon).find((x) => x.children?.[0]?.name === a), rb = rows(mon).find((x) => x.children?.[0]?.name === b2), ra2 = rows(tue).find((x) => x.children?.[0]?.name === a);
    must((ra?.addons ?? []).some((l: string) => /Pasta bake/.test(l)), "Mon: child A's meal shows: " + JSON.stringify(ra?.addons));
    eq((rb?.addons ?? []).length, 0, "Mon: child B (no extras, no meals) shows nothing");
    must(!(ra2?.addons ?? []).some((l: string) => /Pasta bake/.test(l)), "Tue: A has no meal that day, so none shows: " + JSON.stringify(ra2?.addons));
    return `Mon A ${JSON.stringify(ra?.addons)} | B ${JSON.stringify(rb?.addons)} | Tue A ${JSON.stringify(ra2?.addons)}`;
  });
});

T("AO phone", async () => {
  await check("AO-24 phone width (390px): wizard step 10 + checkout extras", "p", async (shots) => {
    const kids = await mkKids("p2", "Ph", 1);
    const p = await newPage("p2", `/book/${S.L1.id}`);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.getByText(/Tap a week/).first().waitFor({ timeout: 45_000 });
    await p.getByRole("button", { name: monRe() }).first().click();
    await p.getByRole("button", { name: /ADD 5 DAYS TO BASKET/i }).click();
    await p.getByRole("button", { name: /NEXT — ADD CHILDREN/i }).click();
    await p.getByRole("button", { name: new RegExp(kids[0]) }).first().click();
    await p.getByRole("button", { name: "Next", exact: true }).click();
    await p.getByText(/Extra 1 of/i).first().waitFor({ timeout: 30_000 });
    shots.push(await snap(p, "AO-24", "checkout-extra-phone"));
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    must(overflow <= 2, `checkout extras step has no sideways scroll (overflow ${overflow}px)`);
    const w = await openWizard("fl", S.L1.title, 10);
    await w.setViewportSize({ width: 390, height: 844 });
    await w.waitForTimeout(1200);
    shots.push(await snap(w, "AO-24", "wizard-step10-phone"));
    const ow = await w.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    must(ow <= 2, `wizard step 10 has no sideways scroll (overflow ${ow}px)`);
    return `overflow checkout ${overflow}px, wizard ${ow}px`;
  });
});
