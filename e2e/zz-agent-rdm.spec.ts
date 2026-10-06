import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test, chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { API_URL, ROOT, WEB_URL } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, fbSignIn, fbSignUp } from "./helpers/accounts";

test.describe.configure({ mode: "serial" });
const SHOTS = path.join(ROOT, "e2e/review/shots/rdm");
const CACHE = path.join(SHOTS, "accounts.json");
const RESULTS_PATH = path.join(SHOTS, "results.json");
fs.mkdirSync(SHOTS, { recursive: true });
const ONLY = process.env.RDM_ONLY ? process.env.RDM_ONLY.split(",") : null;

type Kind = "co" | "fl" | "fr" | "p" | "cs" | "fs" | "p1" | "p2" | "p3";
const TRACKER: Record<string, string> = { co: "company", fl: "freelancer", fr: "franchise", p: "parent" };
const PORTAL: Record<string, string> = { co: "company", fl: "freelancer", fr: "franchise", p: "custdash", p1: "custdash", p2: "custdash", p3: "custdash", cs: "staff", fs: "staff" };
interface Res { id: string; kind: Kind; ok: boolean; note: string; shots: string[]; blocked?: boolean }
const results: Res[] = fs.existsSync(RESULTS_PATH) ? JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8")) : [];
const saveResults = () => fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));

interface Acct { email: string; uid: string; tenantId: string | null; franchiseId?: string | null; tok: string; tokAt: number }
let A: Record<string, Acct> = {};
const stamp = Date.now().toString(36);
const email = (n: string) => `e2e-rdm-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`;
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
  if (venueDone.has(k)) return "rdm-venue";
  const lib = (await call(k, "GET", "/api/library")).json ?? {};
  const venues = (lib.venues ?? []) as { id: string }[];
  await ok(k, "PUT", "/api/library", { venues: venues.some((v) => v.id === "rdm-venue") ? venues : [...venues, { id: "rdm-venue", name: "RDM Sports Hall", address: "1 Test Way", city: "Northampton" }], settings: { ...(lib.settings ?? {}), marketplaceListed: true } });
  venueDone.add(k); return "rdm-venue";
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
async function ensurePeriod(k: string, start = "09:00", finish = "15:00") { return (periodCache[k + start] ??= (await ok(k, "POST", "/api/periods", { title: "Full day", start, finish })).id); }
interface MkOpts { start?: string; finish?: string; noVenue?: boolean; passes?: PassDef[]; from?: string; to?: string; days?: number[]; mode?: "weekly" | "custom" }
async function mkListing(k: string, title: string, extra: Record<string, unknown> = {}, o: MkOpts = {}): Promise<Listing> {
  const passes = o.passes ?? STD_PASSES;
  const venueId = await ensureVenue(k);
  const period = await ensurePeriod(k, o.start, o.finish);
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
  if (fs.existsSync(CACHE) && !process.env.RDM_FRESH) {
    A = JSON.parse(fs.readFileSync(CACHE, "utf8"));
    for (const k of Object.keys(A)) { A[k].tok = (await fbSignIn(A[k].email)).idToken; A[k].tokAt = Date.now(); }
    return;
  }
  await signupParent("p1"); await signupParent("p2"); await signupParent("p3");
  await signupOperator("co", "company", `RDM Co ${stamp}`);
  await signupOperator("fl", "freelancer", `RDM Free ${stamp}`);
  await signupOperator("ho", "company", `RDM HO ${stamp}`);
  unwall(A.co.tenantId!, A.fl.tenantId!, A.ho.tenantId!);
  await joinByInvite("fr", "ho", { role: "franchise", franchiseName: `RDM Alpha ${stamp}` });
  await joinByInvite("cs", "co", { role: "staff", name: `RDM CoStaff ${stamp}`, staffRole: "Coach", assignment: { mode: "all", ids: [] } });
  await joinByInvite("fs", "fr", { role: "staff", name: `RDM FrStaff ${stamp}`, staffRole: "Coach", assignment: { mode: "all", ids: [] } });
  fs.writeFileSync(CACHE, JSON.stringify(A, null, 1));
  console.log("ACCOUNTS", Object.entries(A).map(([k, v]) => `${k}=${v.email}`).join(" "));
});
test.afterAll(async () => { for (const c of Object.values(ctxs)) await c?.close().catch(() => {}); await theBrowser?.close().catch(() => {}); });

// ======= CHECKS GO BELOW =======

const FIX = path.join(SHOTS, "fixtures.json");
interface Fx { L: Record<string, Listing>; refs: Record<string, Record<string, string>>; kids: Record<string, Record<string, string>> }
let F: Fx = fs.existsSync(FIX) ? JSON.parse(fs.readFileSync(FIX, "utf8")) : { L: {}, refs: {}, kids: {} };
const saveF = () => fs.writeFileSync(FIX, JSON.stringify(F, null, 1));
const todayIso = iso(today);
const td = (n: number) => iso(addDays(today, n));
const ALLDAYS = [0, 1, 2, 3, 4, 5, 6];
async function kidRec(parent: string, name: string, extra: Record<string, unknown> = {}) {
  const c = await ok(parent, "POST", "/api/my/children", { name, dob: "2017-03-04", ...extra });
  return c.id as string;
}
const TODAY_OPTS = { from: todayIso, to: td(11), mode: "custom" as const, days: ALLDAYS, start: "08:00", finish: "12:00" };
const SESSION_PAGE: Record<string, string> = { co: "/company/admin-registers", fl: "/freelancer/registers", fr: "/franchise/registers", cs: "/staff/registers", fs: "/staff/registers" };
async function bookKid(parent: string, L: Listing, kidName: string, kidId: string, dates: string[], pass: string) {
  return call(parent, "POST", "/api/my/bookings", { listingId: L.id, blockId: L.blockId, method: "card", items: [{ pass, child: kidName, childId: kidId, age: 8, dates }] });
}
const regFor = async (k: string, date: string, L: Listing) => {
  const r = await call(k, "GET", `/api/registers?date=${date}`);
  if (r.status >= 300) throw new Error(`registers ${k} ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  return ((r.json as any[]) ?? []).find((x) => x.listingId === L.id) as any;
};
const names = (reg: any) => ((reg?.attendees ?? []) as any[]).map((a) => a.children[0].name).sort();

T("SETUP fixtures", async () => {
  if (F.L.co && F.L.fl && F.L.fr && !process.env.RDM_REFIX) return;
  for (const k of OPS) {
    const L = await mkListing(k, `RDM Today ${k} ${stamp}`, { maxAttendees: "4", capacityScope: "day" }, TODAY_OPTS);
    F.L[k] = L; F.refs[k] = {}; F.kids[k] = {};
    const mk = async (tag: string, parent: string, extra: Record<string, unknown> = {}) => { const n = `${tag}${k}${stamp}`; F.kids[k][tag] = n; F.kids[k][tag + "Id"] = await kidRec(parent, n, extra); return n; };
    const D = await mk("Dee", "p3");
    const A1 = await mk("Ann", "p1", { allergies: "Peanuts RDMALLERGY", medical: "Asthma inhaler RDMMED" });
    const B = await mk("Bob", "p2");
    const M = await mk("Mia", "p1");
    const C = await mk("Cat", "p3");
    const go = async (tag: string, n: string, parent: string, dates: string[], pass: string) => { const r = await bookKid(parent, L, n, F.kids[k][tag + "Id"], dates, pass); if (r.status >= 300) throw new Error(`book ${tag}: ${r.status} ${JSON.stringify(r.json).slice(0, 250)}`); F.refs[k][tag] = r.json.bookings[0].ref; F.refs[k][tag + "Status"] = r.json.bookings[0].status; };
    await go("Dee", D, "p3", [todayIso], "1 day");
    await go("Ann", A1, "p1", [todayIso], "1 day");
    await go("Bob", B, "p2", [todayIso, td(1)], "3 days").catch(async () => go("Bob", B, "p2", [todayIso], "1 day"));
    await go("Mia", M, "p1", [todayIso, td(2), td(4)], "3 days");
    await go("Cat", C, "p3", [todayIso], "1 day");
    console.log("SETUP", k, JSON.stringify(F.refs[k]));
    await ok(k, "POST", `/api/bookings/${F.refs[k].Dee}/actions`, { type: "cancel", refund: "none" });
    saveF();
  }
});

// ---------- REG-1 register content ----------
for (const k of OPS) T(`REG-1 ${k}`, async () => {
  await check("REG-1", k, async (shots) => {
    const L = F.L[k]; const K = F.kids[k]; const R = F.refs[k];
    const reg = await regFor(k, todayIso, L);
    must(reg, "no register session today");
    const got = names(reg);
    const want = [K.Ann, K.Bob, K.Mia].sort();
    eq(JSON.stringify(got), JSON.stringify(want), "today attendees (waitlisted Cat + cancelled Dee must be absent)");
    eq(reg.counts.expected, 3, "headcount expected");
    const ann = reg.attendees.find((a: any) => a.children[0].name === K.Ann);
    must(/RDMALLERGY/.test(ann.child?.allergies ?? ""), "allergy on register payload");
    must(/RDMMED/.test(ann.child?.medical ?? ""), "medical on register payload");
    // multi-day: Mia on today, +2, +4 only
    const d1 = await regFor(k, td(1), L), d2 = await regFor(k, td(2), L), d3 = await regFor(k, td(3), L), d4 = await regFor(k, td(4), L);
    const has = (r: any, n: string) => names(r).includes(n);
    eq(has(d1, K.Mia), false, "Mia not on +1"); eq(has(d2, K.Mia), true, "Mia on +2"); eq(has(d3, K.Mia), false, "Mia not on +3"); eq(has(d4, K.Mia), true, "Mia on +4");
    const bobMulti = has(d1, K.Bob);
    // marks: Ann in+collect, Bob absent, Mia untouched (UI click later)
    await ok(k, "POST", `/api/registers/${reg.blockId}/${todayIso}/mark`, { ref: ann.ref, action: "in" });
    await ok(k, "POST", `/api/registers/${reg.blockId}/${todayIso}/mark`, { ref: ann.ref, action: "collect", collectedBy: "Granny RDM" });
    const bob = reg.attendees.find((a: any) => a.children[0].name === K.Bob);
    await ok(k, "POST", `/api/registers/${reg.blockId}/${todayIso}/mark`, { ref: bob.ref, action: "absent", reason: "Sick RDM" });
    await ok(k, "POST", `/api/registers/${reg.blockId}/${todayIso}/note`, { ref: ann.ref, op: "save", text: "Mum running late RDMNOTE" }).catch(() => {});
    return `attendees ${got.length}=Ann,Bob,Mia (no Cat/Dee); allergy+medical in payload; Mia only +0,+2,+4; Bob on +1: ${bobMulti}`;
  });
});

// Bob's multi-date booking: did the first (3 days x 2 dates) call succeed?
T("DBG bob", async () => {
  const k = "co"; const b = await ok(k, "GET", `/api/bookings/${F.refs[k].Bob}`);
  console.log("BOB", JSON.stringify({ pass: b.pass, days: b.days, kids: b.kids, amount: b.amount, status: b.status }));
});

const BADTXT = /\(Amir\)|needs building|undefined|NaN|\[object|TODO|lorem|Something went wrong|Application error/i;
async function bodyBad(p: Page) { const t = await p.evaluate(() => document.body.innerText); const m = t.match(BADTXT); return m ? m[0] : null; }
async function snapBoth(k: string, url: string, id: string, tag: string, wait: (string | RegExp)[], shots: string[], act?: (p: Page) => Promise<void>) {
  const p = await newPage(k, url);
  if (act) await act(p);
  shots.push(await snap(p, id, `${tag}.desk`, wait));
  const bad = await bodyBad(p); if (bad) warns.push(`${tag} shows "${bad}"`);
  await p.setViewportSize({ width: 390, height: 1900 }); await p.waitForTimeout(800);
  shots.push(await snap(p, id, `${tag}.phone`, wait));
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (ov > 4) warns.push(`${tag} horizontal overflow ${ov}px at 390`);
  await p.close();
}
for (const k of ["co", "fl", "fr", "cs", "fs"] as Kind[]) T(`REG-2 ${k}`, async () => {
  await check("REG-2", k, async (shots) => {
    const base = k === "cs" ? "co" : k === "fs" ? "fr" : k;
    const K = F.kids[base];
    await snapBoth(k, SESSION_PAGE[k], "REG-2", k, [K.Ann], shots);
    return `register loaded for ${k}`;
  });
});

const rowOf = (p: Page, n: string) => p.locator('[data-ui="card"]').filter({ hasText: n }).last();
T("REG-3 co ui + stale tab", async () => {
  await check("REG-3", "co", async (shots) => {
    const K = F.kids.co;
    const a = await newPage("co", SESSION_PAGE.co); const b = await newPage("co", SESSION_PAGE.co);
    await rowOf(a, K.Mia).waitFor({ timeout: 45_000 }); await rowOf(b, K.Mia).waitFor({ timeout: 45_000 });
    // double click In on A
    await rowOf(a, K.Mia).getByRole("button", { name: "In", exact: true }).dblclick();
    await a.waitForTimeout(2500);
    const reg = await regFor("co", todayIso, F.L.co);
    const mia = reg.attendees.find((x: any) => x.children[0].name === K.Mia);
    eq(mia.attendance?.status, "in", "Mia in after dblclick");
    shots.push(await snap(a, "REG-3", "A.after-in", [K.Mia]));
    // stale B (still shows not-arrived) taps Absent
    await b.setViewportSize({ width: 1440, height: 1000 });
    await rowOf(b, K.Mia).getByRole("button", { name: "Absent", exact: true }).click();
    await b.waitForTimeout(2500);
    shots.push(await snap(b, "REG-3", "B.stale-absent", [K.Mia]));
    const reg2 = await regFor("co", todayIso, F.L.co);
    const mia2 = reg2.attendees.find((x: any) => x.children[0].name === K.Mia);
    const txt = await b.evaluate(() => document.body.innerText);
    const rowTxt = await rowOf(b, K.Mia).innerText();
    // back button / reload keeps state
    await b.goBack().catch(() => {}); await b.waitForTimeout(500);
    await a.close(); await b.close();
    // true staleness at API level
    const mk = (body: any) => call("co", "POST", `/api/registers/${reg.blockId}/${todayIso}/mark`, { ref: mia.ref, ...body });
    await mk({ action: "reset" }); await mk({ action: "in" });
    const stale = await mk({ action: "absent", from: "none" });
    const dbl = await Promise.all([mk({ action: "collect", collectedBy: "X" }), mk({ action: "collect", collectedBy: "Y" })]);
    await mk({ action: "uncollect" });
    const fin = (await regFor("co", todayIso, F.L.co)).attendees.find((x: any) => x.children[0].name === K.Mia);
    eq(stale.status, 409, "stale absent from=none should be refused 409: " + JSON.stringify(stale.json).slice(0, 150));
    return `UI: B (live-refreshed) absent after A's In = deliberate change; API stale absent(from none) -> ${stale.status}; two simultaneous collects -> ${dbl.map((d) => d.status)}; Mia final ${fin.attendance?.status}; B row: ${rowTxt.replace(/\s+/g, " ").slice(0, 80)}`;
  });
});

T("REG-4 late pickup", async () => {
  await check("REG-4", "co", async (shots) => {
    const K = F.kids.co; const reg = await regFor("co", todayIso, F.L.co);
    const mia = reg.attendees.find((x: any) => x.children[0].name === K.Mia);
    const r = await call("co", "POST", `/api/registers/${reg.blockId}/${todayIso}/mark`, { ref: mia.ref, action: "in" }); eq(r.status < 300, true, "mark in " + JSON.stringify(r.json));
    const p = await newPage("co", SESSION_PAGE.co);
    await rowOf(p, K.Mia).waitFor({ timeout: 45_000 });
    shots.push(await snap(p, "REG-4", "late.desk", [K.Mia]));
    const txt = await p.evaluate(() => document.body.innerText);
    const late = /late|overdue|over(?=\s)|chase|nudge/i.test(txt);
    await rowOf(p, K.Mia).getByText(/Quick actions/).click(); await p.waitForTimeout(800);
    shots.push(await snap(p, "REG-4", "quick.desk", [K.Mia]));
    await p.keyboard.press("Escape");
    const sel = p.locator("select").filter({ hasText: /All sessions/ }).first();
    const opts = await sel.locator("option").allInnerTexts();
    const outOpt = await sel.locator("option").evaluateAll((os) => (os as HTMLOptionElement[]).map((o) => o.value).filter((v) => v.startsWith("out|")));
    if (outOpt[0]) await sel.selectOption(outOpt[0]);
    await p.waitForTimeout(1200);
    shots.push(await snap(p, "REG-4", "collection-group.desk", [K.Mia]));
    const bell = p.getByText(/late|running late|chase|Nudge/i).first();
    if (await bell.count()) { await bell.click().catch(() => {}); await p.waitForTimeout(1000); shots.push(await snap(p, "REG-4", "bell.desk", [])); }
    await p.close();
    warns.push("select options: " + opts.join("/"));
    return `late-collect indicator visible on page: ${late}`;
  });
});

// ---------- MESSAGES ----------
const tenantOf = (k: string) => A[k === "fr" || k === "fs" ? "ho" : k === "cs" ? "co" : k].tenantId!;
const threadsOf = async (k: string) => ((await call(k, "GET", "/api/messages/threads")).json ?? []) as any[];
T("MSG setup p4 + ho listing", async () => {
  if (!A.p4) { await signupParent("p4"); fs.writeFileSync(CACHE, JSON.stringify(A, null, 1)); }
  if (!F.L.ho) {
    const L = await mkListing("ho", `RDM HO direct ${stamp}`, {}, {}); F.L.ho = L; F.refs.ho = {}; F.kids.ho = {};
    const n = `Hal${stamp}`; const id = await kidRec("p4", n);
    const r = await bookKid("p4", L, n, id, [sd(0, 0)], "1 day"); if (r.status >= 300) throw new Error("ho book " + JSON.stringify(r.json));
    F.refs.ho.Hal = r.json.bookings[0].ref; F.kids.ho.Hal = n; saveF();
  }
});
for (const k of OPS) T(`MSG-1 thread ${k}`, async () => {
  await check("MSG-1", k, async (shots) => {
    const p1e = A.p1.email; const tid = tenantOf(k);
    const o = await call(k, "POST", "/api/messages", { parentEmail: p1e, subject: `Hello ${k}`, body: `Hello from ${k} operator RDMMSG1` });
    eq(o.status, 201, "operator start " + JSON.stringify(o.json).slice(0, 150));
    const pth = (await threadsOf("p1")).find((t) => t.tenantId === tid);
    must(pth, "parent sees thread"); eq(pth.parentUnread, 1, "parent unread after 1 op message");
    // parent UI
    const p = await newPage("p1", "/custdash/messages");
    shots.push(await snap(p, "MSG-1", `${k}.parent-inbox.desk`, [/RDMMSG1/]));
    const bad1 = await bodyBad(p); if (bad1) warns.push(`parent inbox shows ${bad1}`);
    await p.close();
    // parent reads then replies
    const th = await call("p1", "GET", `/api/messages/threads/${pth.id}`); eq(th.status, 200, "parent open");
    const after = (await threadsOf("p1")).find((t) => t.id === pth.id); eq(after.parentUnread, 0, "parent unread cleared after open");
    const rep = await call("p1", "POST", "/api/messages", { tenantId: tid, body: `Reply from parent to ${k} RDMMSG2` }); eq(rep.status, 201, "parent reply");
    const dup = await call("p1", "POST", "/api/messages", { tenantId: tid, body: `Reply from parent to ${k} RDMMSG2` });
    const oth = (await threadsOf(k)).find((t) => t.id === pth.id); must(oth, "operator sees thread");
    eq(oth.operatorUnread, 1, "operator unread after parent reply (dup send must not double count; dup status " + dup.status + ")");
    // operator UI with unread
    const q = await newPage(k, `/${PORTAL[k]}/messages`);
    shots.push(await snap(q, "MSG-1", `${k}.op-inbox.desk`, [/RDMMSG2/]));
    const bad2 = await bodyBad(q); if (bad2) warns.push(`op inbox shows ${bad2}`);
    await q.setViewportSize({ width: 390, height: 1400 }); await q.waitForTimeout(700);
    shots.push(await snap(q, "MSG-1", `${k}.op-inbox.phone`, []));
    const ov = await q.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (ov > 4) warns.push(`op inbox overflow ${ov}`);
    await q.close();
    await call(k, "GET", `/api/messages/threads/${pth.id}`);
    eq((await threadsOf(k)).find((t) => t.id === pth.id).operatorUnread, 0, "operator unread cleared");
    return `thread start/reply/unread counts OK (parent 1->0, operator 1->0); dup send status ${dup.status}`;
  });
});

T("MSG-2 broadcast + scoping", async () => {
  // broadcast to a listing's families (co)
  await check("MSG-2", "co", async (shots) => {
    const L = F.L.co;
    const rc = await call("co", "POST", "/api/messages/listing-recipients", { listings: [L.id] });
    const emails = (rc.json as any[]).map((r) => r.email).sort();
    const bc = await call("co", "POST", "/api/messages/broadcast", { listings: [L.id], subject: "Bcast co", body: "Broadcast to listing families RDMBCAST" });
    eq(bc.status, 200, "broadcast " + JSON.stringify(bc.json).slice(0, 150));
    // who received
    const got: string[] = [];
    for (const pk of ["p1", "p2", "p3", "p4"]) { const t = (await threadsOf(pk)).find((x) => x.tenantId === A.co.tenantId && /RDMBCAST/.test(x.lastBody ?? "")); if (t) got.push(pk); }
    // p3 only has a cancelled (Dee) and a waitlisted (Cat) booking: waitlisted counts as live
    const msg = `recipients ${emails.length} (${emails.map((e) => e.split("-")[2]).join(",")}); delivered to ${got.join(",")}; broadcast sent=${bc.json.sent}`;
    must(got.includes("p1") && got.includes("p2"), "p1+p2 must get it; " + msg);
    must(!got.includes("p4"), "p4 (no co booking) must not get it");
    const p = await newPage("p2", "/custdash/messages");
    shots.push(await snap(p, "MSG-2", "co.parent-p2-bcast.desk", [/RDMBCAST/])); await p.close();
    const q = await newPage("co", "/company/messages");
    shots.push(await snap(q, "MSG-2", "co.op-after-bcast.desk", [])); await q.close();
    return msg;
  });
  // franchise scoping
  await check("MSG-3", "fr", async () => {
    const out: string[] = [];
    // ho opens a thread with p4 (ho-only family)
    const h = await call("ho", "POST", "/api/messages", { parentEmail: A.p4.email, body: "HO to p4 RDMHO" }); eq(h.status, 201, "ho->p4 " + JSON.stringify(h.json).slice(0, 100));
    const f1 = await call("fr", "POST", "/api/messages", { parentEmail: A.p4.email, body: "fr to p4 RDMNO" }); out.push(`fr->p4 ${f1.status}`);
    eq(f1.status, 400, "franchise must not message a head-office-only family");
    const f2 = await call("fr", "POST", "/api/messages", { parentEmail: A.p2.email, body: "fr to p2 RDMFR2" }); eq(f2.status, 201, "fr->p2");
    const frT = await threadsOf("fr");
    must(!frT.some((t) => t.parentEmail === A.p4.email.toLowerCase()), "franchise inbox must not list the ho-only family's thread");
    const hoT = (await threadsOf("ho")).find((t) => t.parentEmail === A.p4.email.toLowerCase());
    const peek = await call("fr", "GET", `/api/messages/threads/${hoT.id}`); out.push(`fr open ho thread ${peek.status}`); eq(peek.status, 404, "fr opening ho thread");
    const rr = await call("fr", "POST", "/api/messages/listing-recipients", { listings: [F.L.ho.id] }); out.push(`fr recipients for ho listing ${(rr.json as any[]).length}`); eq((rr.json as any[]).length, 0, "fr recipients of ho listing");
    const fb = await call("fr", "POST", "/api/messages/broadcast", { listings: [F.L.ho.id], body: "fr bcast ho RDMNO" }); out.push(`fr broadcast ho listing ${fb.status}`); must(fb.status >= 400, "fr broadcast to ho listing must fail");
    const fb2 = await call("fr", "POST", "/api/messages/broadcast", { emails: [A.p4.email], body: "fr bcast p4 RDMNO" }); out.push(`fr broadcast to p4 email ${fb2.status}`); must(fb2.status >= 400, "fr broadcast to ho-only email must fail");
    const fbk = await call("fr", "POST", "/api/messages/from-booking", { ref: F.refs.ho.Hal, body: "x RDMNO" }); out.push(`fr from-booking ho booking ${fbk.status}`); eq(fbk.status, 404, "from-booking of ho booking");
    // parent p4 cannot see franchise stuff; p4 -> co refused (no booking)
    const pc = await call("p4", "POST", "/api/messages", { tenantId: A.co.tenantId, body: "no booking RDM" }); out.push(`p4->co (never booked) ${pc.status}`); eq(pc.status, 403, "parent w/o booking");
    return out.join("; ");
  });
  await check("MSG-4", "cs", async (shots) => {
    const out: string[] = [];
    const before = await threadsOf("cs"); out.push(`cs sees ${before.length} threads before writing (co has ${(await threadsOf("co")).length})`); eq(before.length, 0, "plain staff sees none before writing");
    const s1 = await call("cs", "POST", "/api/messages", { parentEmail: A.p2.email, body: "staff hello RDMSTAFF" }); eq(s1.status, 201, "cs send " + JSON.stringify(s1.json).slice(0, 100));
    const after = await threadsOf("cs"); out.push(`after: ${after.length}`); eq(after.length, 1, "staff sees only own thread");
    const coT = (await threadsOf("co")).find((t) => t.parentEmail === A.p1.email.toLowerCase());
    const peek = await call("cs", "GET", `/api/messages/threads/${coT.id}`); out.push(`cs open owner's thread ${peek.status}`); eq(peek.status, 404, "staff peeking");
    const q = await newPage("cs", "/staff/messages");
    await q.getByRole("button", { name: /Skip for now/i }).click({ timeout: 4000 }).catch(() => {});
    shots.push(await snap(q, "MSG-4", "cs.inbox.desk", [])); await q.close();
    // franchise staff
    const f1 = await call("fs", "POST", "/api/messages", { parentEmail: A.p4.email, body: "fs->p4 RDMNO" }); out.push(`fs->p4 ${f1.status}`); eq(f1.status, 400, "fs -> ho-only family");
    const f2 = await call("fs", "POST", "/api/messages", { parentEmail: A.p1.email, body: "fs->p1 RDMFS" }); out.push(`fs->p1 ${f2.status}`); eq(f2.status, 201, "fs -> own family");
    out.push(`fs threads ${(await threadsOf("fs")).length}`);
    return out.join("; ");
  });
});

// ---------- AMENDMENTS ----------
const PK: Record<string, string> = { co: "p1", fl: "p2", fr: "p3" };
const OTHER: Record<string, string[]> = { co: ["p2", "p3"], fl: ["p1", "p3"], fr: ["p1", "p2"] };
async function setSettings(k: string, s: Record<string, unknown>) {
  const lib = (await call(k, "GET", "/api/library")).json ?? {};
  await ok(k, "PUT", "/api/library", { venues: lib.venues ?? [], settings: { ...(lib.settings ?? {}), ...s } });
}
const bookDoc = async (k: string, ref: string) => (await ok(k, "GET", `/api/bookings/${ref}`));
const amend = (pk: string, tid: string, ref: string, body: Record<string, unknown>) => call(pk, "POST", `/api/my/bookings/${encodeURIComponent(ref)}/amend?tenantId=${tid}`, body);
const AM: Record<string, any> = (F as any).am ?? {};
for (const k of OPS) T(`AM-1 ${k}`, async () => {
  await check("AM-1", k, async (shots) => {
    const pk = PK[k]; const tid = tenantOf(k); const d: any = (AM[k] = {});
    await setSettings(k, { allowDateChanges: true, amendSelfService: false, amendNoticeHours: 0, amendFee: 0, amendAllowCheaper: true });
    const L = await mkListing(k, `RDM Amend ${k} ${stamp}`, { maxAttendees: "2" }); d.L = L;
    const x = `Xan${k}${stamp}`; const xid = await kidRec(pk, x); d.x = x;
    const b1 = await bookKid(pk, L, x, xid, [sd(0, 0)], "1 day"); eq(b1.status < 300, true, "book " + JSON.stringify(b1.json).slice(0, 200));
    const ref = b1.json.bookings[0].ref; d.ref = ref; d.xid = xid;
    // 1. request (self-service OFF)
    const r1 = await amend(pk, tid, ref, { moves: { [sd(0, 0)]: sd(0, 1) }, msg: "Please move RDMAMEND" });
    eq(r1.status, 201, "request " + JSON.stringify(r1.json).slice(0, 200)); eq(r1.json.amendApplied, undefined, "not applied when self-service off");
    let b = await bookDoc(k, ref); eq(b.dateChangeRequest?.status, "pending", "request pending");
    const dbl = await amend(pk, tid, ref, { moves: { [sd(0, 0)]: sd(0, 2) } }); d.dblStatus = dbl.status;
    // parent UI shows pending
    const p = await newPage(pk, `/custdash/bookings?amend=${ref}`);
    shots.push(await snap(p, "AM-1", `${k}.parent-pending.desk`, [x]));
    const bad = await bodyBad(p); if (bad) warns.push(`parent bookings shows ${bad}`);
    await p.close();
    // operator sees the request
    const o = await newPage(k, `/${PORTAL[k]}/bookings?ref=${ref}`);
    shots.push(await snap(o, "AM-1", `${k}.op-request.desk`, [x]));
    await o.close();
    // approve
    await ok(k, "POST", `/api/bookings/${ref}/actions`, { type: "move-approve" });
    b = await bookDoc(k, ref); eq(JSON.stringify(b.days), JSON.stringify([sd(0, 2)]), "days after approve (2nd pending request replaced the 1st)");
    warns.push(`2nd amend request while one pending -> ${dbl.status}, silently REPLACED the first (Tue->Wed)`);
    const reg1 = await regFor(k, sd(0, 2), L), reg0 = await regFor(k, sd(0, 0), L);
    must(names(reg1).includes(x), "on Tue register"); must(!names(reg0).includes(x), "gone from Mon register");
    d.afterApprove = { amount: b.amount, pay: b.pay, status: b.status }; (F as any).am = AM; saveF();
    return `request pending OK (second pending request while one open -> ${dbl.status}); approve moved Mon->Wed (last request wins), registers follow; amount ${b.amount} pay ${b.pay}`;
  });
});

for (const k of OPS) T(`AM-2 ${k}`, async () => {
  await check("AM-2", k, async (shots) => {
    const pk = PK[k]; const tid = tenantOf(k); const d = AM[k]; const L: Listing = d.L; const ref = d.ref; const x = d.x;
    await setSettings(k, { amendSelfService: true, amendFee: 5, amendNoticeHours: 0 });
    // fill Thursday (cap 2) with two other families
    for (const o of OTHER[k]) { const n = `Fil${o}${k}${stamp}`; const id = await kidRec(o, n); const r = await bookKid(o, L, n, id, [sd(0, 3)], "1 day"); if (r.status >= 300) throw new Error("fill " + JSON.stringify(r.json)); }
    const full = await amend(pk, tid, ref, { moves: { [sd(0, 2)]: sd(0, 3) } });
    eq(full.status, 400, "move to full day refused: " + JSON.stringify(full.json).slice(0, 150));
    const beforeB = await bookDoc(k, ref);
    // UI: parent moves Wed -> Fri
    const p = await newPage(pk, `/custdash/bookings?amend=${ref}`);
    await p.getByText("Your dates", { exact: false }).first().waitFor({ timeout: 45_000 });
    const sel = p.locator("select").filter({ hasText: /Keep this date/ }).first();
    await p.waitForFunction(() => Array.from(document.querySelectorAll("select")).some((e) => /Keep this date/.test(e.options[0]?.text ?? "") && e.options.length > 2), null, { timeout: 30_000 }).catch(() => {});
    const labels = await sel.locator("option").allInnerTexts();
    shots.push(await snap(p, "AM-2", `${k}.modal-open.desk`, []));
    const friLabel = labels.find((l) => new RegExp("Fri\\s*" + addDays(nextMonday, 4).getDate() + "\\b").test(l));
    const thuLabel = labels.find((l) => new RegExp("Thu\\s*" + addDays(nextMonday, 3).getDate() + "\\b").test(l));
    must(friLabel, "Fri option present: " + labels.join(" | "));
    const thuInfo = thuLabel ?? "Thu option not offered (full)";
    await sel.selectOption({ label: friLabel! });
    await p.waitForTimeout(600);
    shots.push(await snap(p, "AM-2", `${k}.modal-picked.desk`, []));
    const feeTxt = (await p.evaluate(() => document.body.innerText)).match(/[^\n]*£5[^\n]*/)?.[0] ?? "";
    const send = p.getByRole("button", { name: /Send request|Move my|Confirm|Change my/i }).first();
    const sendLabel = await send.innerText();
    await send.dblclick(); // double click on purpose
    await p.waitForTimeout(3500);
    shots.push(await snap(p, "AM-2", `${k}.modal-after.desk`, []));
    const afterB = await bookDoc(k, ref);
    await p.close();
    const regFri = await regFor(k, sd(0, 4), L), regWed = await regFor(k, sd(0, 2), L);
    must(names(regFri).includes(x), "on Fri register after self-service move"); must(!names(regWed).includes(x), "off Wed register");
    eq(JSON.stringify(afterB.days), JSON.stringify([sd(0, 4)]), "booking days");
    const hist = JSON.stringify(afterB.dateChangeRequest ?? {});
    // operator change-day into full Thursday -> refused; into Tue ok
    const cd1 = await call(k, "POST", `/api/bookings/${ref}/actions`, { type: "change-day", ki: 0, oldDate: sd(0, 4), newDate: sd(0, 3) });
    const cd2 = await call(k, "POST", `/api/bookings/${ref}/actions`, { type: "change-day", ki: 0, oldDate: sd(0, 4), newDate: sd(0, 1) });
    const fin = await bookDoc(k, ref);
    eq(cd1.status, 409, "operator move into full day: " + JSON.stringify(cd1.json).slice(0, 120));
    eq(cd2.status < 300, true, "operator move to Tue " + JSON.stringify(cd2.json).slice(0, 120));
    eq(JSON.stringify(fin.days), JSON.stringify([sd(0, 1)]), "final days");
    // capacity shown to other parent on Thu: still 2 booked (not 3)
    const thuReg = await regFor(k, sd(0, 3), L); eq(thuReg.counts.expected, 2, "Thu headcount");
    return `Thu full -> API 400 "${full.json.error}"; UI options: ${thuInfo}; fee text "${feeTxt.trim().slice(0, 90)}"; button "${sendLabel}"; amount before ${beforeB.amount} after ${afterB.amount} pay ${afterB.pay} feeCharged ${afterB.dateChangeRequest?.feeCharged}; dblclick -> one move; operator change-day into full Thu 409 "${cd1.json.error}"; to Tue ok; Thu headcount 2`;
  });
});

for (const k of OPS) T(`AM-3 ${k}`, async () => {
  await check("AM-3", k, async (shots) => {
    const pk = PK[k]; const tid = tenantOf(k); const d = AM[k]; const L: Listing = d.L; const ref = d.ref; const x = d.x;
    await setSettings(k, { amendSelfService: false, amendFee: 0, amendNoticeHours: 0 });
    const cur = await bookDoc(k, ref); const from = cur.days[0]; // Tue
    const r = await amend(pk, tid, ref, { moves: { [from]: sd(0, 4) } }); eq(r.status, 201, "request Tue->Fri " + JSON.stringify(r.json).slice(0, 150));
    for (const o of OTHER[k]) { const n = `Fr${o}${k}${stamp}`; const id = await kidRec(o, n); const rr = await bookKid(o, L, n, id, [sd(0, 4)], "1 day"); if (rr.status >= 300) throw new Error("fill fri " + JSON.stringify(rr.json)); d["fri" + o] = rr.json.bookings[0].status; }
    const friBefore = (await regFor(k, sd(0, 4), L)).counts.expected;
    const ap = await call(k, "POST", `/api/bookings/${ref}/actions`, { type: "move-approve" });
    const after = await bookDoc(k, ref); const friAfter = (await regFor(k, sd(0, 4), L)).counts.expected;
    const o = await newPage(k, `/${PORTAL[k]}/bookings?ref=${ref}`);
    shots.push(await snap(o, "AM-3", `${k}.op-after-approve.desk`, [x])); await o.close();
    // double approve
    const ap2 = await call(k, "POST", `/api/bookings/${ref}/actions`, { type: "move-approve" });
    const after2 = await bookDoc(k, ref);
    const msg = `Fri had ${friBefore}/2 when approving Tue->Fri: approve status ${ap.status} ${ap.status >= 400 ? JSON.stringify(ap.json).slice(0, 100) : ""}; booking days now ${JSON.stringify(after.days)}; Fri headcount ${friBefore}->${friAfter}; 2nd approve ${ap2.status}, days ${JSON.stringify(after2.days)} moves approved ${after2.amendMovesApproved}`;
    must(!(ap.status < 300 && friAfter > 2), "OVERBOOKED: approve moved a child into a full day (Fri " + friAfter + "/2). " + msg);
    return msg;
  });
});

for (const k of OPS) T(`AM-5 ${k}`, async () => {
  await check("AM-5", k, async () => {
    const d = AM[k]; await setSettings(k, { amendFee: 5, amendSelfService: false });
    const b0 = await bookDoc(k, d.ref);
    const a1 = await call(k, "POST", `/api/bookings/${d.ref}/actions`, { type: "move-approve" });
    const b1 = await bookDoc(k, d.ref);
    const a2 = await call(k, "POST", `/api/bookings/${d.ref}/actions`, { type: "move-approve" });
    const b2 = await bookDoc(k, d.ref);
    await setSettings(k, { amendFee: 0 });
    const msg = `re-approving an already-approved request: amount ${b0.amount} -> ${b1.amount} -> ${b2.amount}; status ${a1.status}/${a2.status}; moves approved ${b0.amendMovesApproved}->${b1.amendMovesApproved}->${b2.amendMovesApproved}; req status ${b2.dateChangeRequest?.status}`;
    must(b2.amount === b0.amount && b2.amendMovesApproved === b0.amendMovesApproved, "re-approve changed money/limits: " + msg);
    return msg;
  });
});

const wedd = (w: number) => iso(addDays(nextMonday, 2 + 7 * w));
for (const k of OPS) T(`AM-4 ${k}`, async () => {
  await check("AM-4", k, async (shots) => {
    const pk = PK[k]; const tid = tenantOf(k);
    await setSettings(k, { allowDateChanges: true, amendSelfService: true, amendFee: 0, amendNoticeHours: 0 });
    const T1 = await mkListing(k, `RDM Term ${k} ${stamp}`, { bookRules: { Term: "blocks" } }, { passes: [{ name: "Term", days: 4, price: 60 }, { name: "1 day", days: 1, price: 15 }], from: wedd(0), to: wedd(3), days: [3] });
    const full = await ok(k, "GET", `/api/listings/${T1.id}`);
    const ds = ((full.blocks ?? []) as any[]).flatMap((b) => (b.sessions ?? []).map((x: any) => x.date as string)).sort();
    const kn = `Trm${k}${stamp}`; const kidI = await kidRec(pk, kn);
    const rb = await bookKid(pk, T1, kn, kidI, ds, "Term"); if (rb.status >= 300) throw new Error("term book " + JSON.stringify(rb.json).slice(0, 200));
    const nb = rb.json.bookings.length; const tref = rb.json.bookings[0].ref;
    const mv = await amend(pk, tid, tref, { moves: { [ds[0]]: ds[1] } });
    const p = await newPage(pk, `/custdash/bookings?amend=${tref}`);
    await p.getByText(/fixed block/i).first().waitFor({ timeout: 45_000 }).catch(() => {});
    const hasWording = (await p.evaluate(() => document.body.innerText)).match(/[^\n]*fixed block[^\n]*/i)?.[0] ?? "";
    shots.push(await snap(p, "AM-4", `${k}.fixed.desk`, []));
    await p.setViewportSize({ width: 390, height: 1500 }); await p.waitForTimeout(700);
    shots.push(await snap(p, "AM-4", `${k}.fixed.phone`, []));
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (ov > 4) warns.push(`fixed modal overflow ${ov}`);
    await p.close();
    // "week" rule pass
    const W = await mkListing(k, `RDM WeekPass ${k} ${stamp}`, { bookRules: { "3 days": "week" }, maxAttendees: "5" });
    const wn = `Wk${k}${stamp}`; const wid = await kidRec(pk, wn);
    const rw = await bookKid(pk, W, wn, wid, [sd(0, 0), sd(0, 1), sd(0, 2)], "3 days"); if (rw.status >= 300) throw new Error("week book " + JSON.stringify(rw.json).slice(0, 200));
    const wref = rw.json.bookings[0].ref;
    const cross = await amend(pk, tid, wref, { moves: { [sd(0, 0)]: sd(1, 0) } });
    const same = await amend(pk, tid, wref, { moves: { [sd(0, 0)]: sd(0, 3) } });
    const wb = await bookDoc(k, wref);
    return `Term x4 weeks booked -> ${nb} booking(s); parent move on Term -> ${mv.status} "${(mv.json.error ?? "").slice(0, 90)}"; modal wording: "${hasWording.slice(0, 160)}"; week-rule pass: cross-week move ${cross.status} "${(cross.json.error ?? "").slice(0, 100)}"; same-week move ${same.status}, days ${JSON.stringify(wb.days)}`;
  });
});

for (const k of OPS) T(`AM-6 ${k}`, async () => {
  await check("AM-6", k, async (shots) => {
    const pk = PK[k]; const tid = tenantOf(k); const d = AM[k];
    await setSettings(k, { amendSelfService: true, amendFee: 0 });
    const cur = await bookDoc(k, d.ref);
    const r = await amend(pk, tid, d.ref, { moves: { [cur.days[0]]: sd(1, 0) } });
    // does the UI offer week-1 dates?
    const p = await newPage(pk, `/custdash/bookings?amend=${d.ref}`);
    await p.waitForFunction(() => Array.from(document.querySelectorAll("select")).some((e) => /Keep this date/.test(e.options[0]?.text ?? "") && e.options.length > 2), null, { timeout: 30_000 }).catch(() => {});
    const opts = await p.locator("select").filter({ hasText: /Keep this date/ }).first().locator("option").allInnerTexts();
    const wk1 = opts.find((o) => new RegExp("Mon\\s*" + addDays(nextMonday, 7).getDate() + "\\b").test(o));
    let uiResult = "n/a";
    if (wk1) {
      await p.locator("select").filter({ hasText: /Keep this date/ }).first().selectOption({ label: wk1 });
      await p.getByRole("button", { name: /Confirm change|Send request/ }).first().click();
      await p.waitForTimeout(3000);
      shots.push(await snap(p, "AM-6", `${k}.ui-cross-week.desk`, []));
      uiResult = (await p.evaluate(() => document.body.innerText)).match(/[^\n]*(doesn.t run|no longer|full|changed)[^\n]*/i)?.[0] ?? "no message";
    }
    await p.close();
    return `API move 1-day booking to next week's Mon: ${r.status} "${(r.json.error ?? "ok").slice(0, 90)}"; UI offers week-1 Mon: ${!!wk1}; UI after confirm: "${uiResult.slice(0, 120)}"`;
  });
});

for (const k of OPS) T(`MSG-5 ${k}`, async () => {
  await check("MSG-5", k, async (shots) => {
    const d = AM[k]; const pk = PK[k]; const tid = tenantOf(k);
    const o = await newPage(k, `/${PORTAL[k]}/bookings?ref=${d.ref}`);
    await o.getByRole("button", { name: /Message family/i }).click();
    const ta = o.getByPlaceholder("Write your message…"); await ta.fill(`Hi {ParentName}, about {ChildName} on {SessionDate} RDMFROMBK`);
    await o.waitForTimeout(2500);
    shots.push(await snap(o, "MSG-5", `${k}.modal.desk`, []));
    const sendBtn = o.getByRole("button", { name: "Send message" }); await sendBtn.dblclick();
    await o.waitForTimeout(3000);
    shots.push(await snap(o, "MSG-5", `${k}.after-send.desk`, []));
    await o.close();
    const th = (await threadsOf(pk)).find((t) => t.tenantId === tid);
    const msgs = (await call(pk, "GET", `/api/messages/threads/${th.id}`)).json.messages as any[];
    const mine = msgs.filter((m) => /RDMFROMBK/.test(m.body));
    const raw = /\{(ParentName|ChildName|SessionDate)\}/.test(mine[0]?.body ?? "");
    must(mine.length >= 1, "message delivered"); 
    if (mine.length > 1) warns.push(`double-click sent ${mine.length} copies`);
    if (raw) warns.push("merge fields not resolved: " + mine[0].body);
    return `delivered ${mine.length}x; body: "${(mine[0]?.body ?? "").slice(0, 100)}"`;
  });
});

T("REG-5 scoping + other days", async () => {
  await check("REG-5", "fr", async (shots) => {
    // head office own listing today with p4's child: franchise register must not show it
    if (!F.L.hoToday) {
      const L = await mkListing("ho", `RDM HO today ${stamp}`, { maxAttendees: "4" }, TODAY_OPTS); F.L.hoToday = L;
      const n = `Hot${stamp}`; const id = await kidRec("p4", n); const r = await bookKid("p4", L, n, id, [todayIso], "1 day"); if (r.status >= 300) throw new Error(JSON.stringify(r.json)); F.kids.hoToday = { Hot: n }; saveF();
    }
    const frAll = ((await call("fr", "GET", `/api/registers?date=${todayIso}`)).json as any[]);
    const fsAll = ((await call("fs", "GET", `/api/registers?date=${todayIso}`)).json as any[]);
    const hoAll = ((await call("ho", "GET", `/api/registers?date=${todayIso}`)).json as any[]);
    const csAll = ((await call("cs", "GET", `/api/registers?date=${todayIso}`)).json as any[]);
    const hasHot = (a: any[]) => a.some((s) => (s.attendees ?? []).some((x: any) => x.children[0].name === F.kids.hoToday.Hot));
    eq(hasHot(frAll), false, "franchise register must not contain head-office child"); eq(hasHot(fsAll), false, "franchise staff register");
    eq(hasHot(hoAll), true, "head office sees own child");
    eq(hasHot(csAll), false, "co staff isn't ho");
    const hoSeesFr = hoAll.some((s) => s.listingId === F.L.fr.id);
    // other days via UI (co)
    const K = F.kids.co;
    const p = await newPage("co", SESSION_PAGE.co); await rowOf(p, K.Ann).waitFor({ timeout: 45_000 });
    await p.locator('input[type="date"]').fill(td(1)).catch(() => {});
    await p.waitForTimeout(2500); shots.push(await snap(p, "REG-5", "co.day-plus1.desk", []));
    const t1 = await p.evaluate(() => document.body.innerText);
    await p.locator('input[type="date"]').fill(td(2)).catch(() => {});
    await p.waitForTimeout(2500); shots.push(await snap(p, "REG-5", "co.day-plus2.desk", []));
    const t2 = await p.evaluate(() => document.body.innerText);
    await p.close();
    if (t1.includes(K.Mia)) warns.push("Mia shown on +1 day in UI");
    must(t2.includes(K.Mia), "Mia must show on +2 in UI");
    return `fr/fs registers hide HO child; HO sees it; HO register also lists franchise listing: ${hoSeesFr}; UI +1 has Mia: ${t1.includes(K.Mia)}, +2 has Mia: ${t2.includes(K.Mia)}`;
  });
});
