import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test, expect, chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { API_URL, ROOT, WEB_URL } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, fbSignIn, fbSignUp } from "./helpers/accounts";
import { cardWith } from "./helpers/ui";

// Provider-side / head-office tracker checks (LT, FD, DI). Fresh throwaway accounts only (@activityos-test.com).
// Every check records pass/fail + evidence to RESULTS_PATH and saves a full-page screenshot of the relevant
// screen to e2e/review/shots/prov/<CHECKID>[.<kind>].png. Results are merged into testTrackerResults separately.

test.describe.configure({ mode: "serial" });
/** A test that never fails the worker (a failure would tear down the worker and re-run beforeAll with duplicate accounts). */
const T = (name: string, fn: (args: { browser: Browser }) => Promise<void>) =>
  test(name, async ({ browser }) => { try { await fn({ browser }); } catch (e) { console.log(`TEST ABORT ${name}: ${(e as Error).message.slice(0, 300)}`); } });

const stamp = Date.now().toString(36);
const SHOTS = path.join(ROOT, "e2e/review/shots/prov");
const RESULTS_PATH = process.env.PROV_RESULTS || path.join(ROOT, "e2e/review/shots/prov/results.json");
fs.mkdirSync(SHOTS, { recursive: true });

type Kind = "co" | "fr" | "fl" | "ho" | "st" | "fa";
const KIND_TRACKER: Record<Kind, string> = { co: "company", fr: "franchise", fl: "freelancer", ho: "head-office", st: "staff", fa: "franchise" };
const PORTAL: Record<Kind, string> = { co: "company", fr: "franchise", fl: "freelancer", ho: "company", st: "staff", fa: "franchise" };

// ── results ────────────────────────────────────────────────────────────────
interface Res { id: string; kind: Kind; ok: boolean; note: string; shot?: string; skipped?: boolean; spec?: { url: string; anchors: string[]; email?: string; home?: string; kind: Kind } }
const results: Res[] = fs.existsSync(RESULTS_PATH) ? (JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8")) as Res[]) : [];
const saveResults = () => fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
const rec = (r: Res) => {
  const i = results.findIndex((x) => x.id === r.id && x.kind === r.kind);
  if (i >= 0) results.splice(i, 1);
  results.push(r);
  saveResults();
  console.log(`${r.ok ? "PASS" : "FAIL"} ${r.id} [${r.kind}] ${r.note}`);
};

// ── accounts ───────────────────────────────────────────────────────────────
interface Acct { email: string; uid: string; tenantId: string | null; franchiseId?: string | null; tok: string; tokAt: number }
const A: Record<string, Acct> = {};
const email = (n: string) => `e2e-prov-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`;
const token = async (k: string) => {
  const a = A[k];
  if (Date.now() - a.tokAt > 35 * 60_000) { a.tok = (await fbSignIn(a.email)).idToken; a.tokAt = Date.now(); }
  return a.tok;
};

async function call(k: string | null, method: string, url: string, body?: unknown, tok?: string): Promise<{ status: number; json: any }> {
  for (let attempt = 0; ; attempt++) {
    try {
      const t = tok ?? (k ? await token(k) : null);
      const res = await fetch(`${API_URL}${url}`, {
        method,
        headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let json: any = null;
      try { json = await res.json(); } catch { /* empty */ }
      return { status: res.status, json };
    } catch (e) {
      if (attempt >= 40) throw e;
      await new Promise((r) => setTimeout(r, 3_000));
    }
  }
}
const ok = async (k: string, method: string, url: string, body?: unknown) => {
  const r = await call(k, method, url, body);
  if (r.status >= 300) throw new Error(`${method} ${url} -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  return r.json;
};

// ── dates ──────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = new Date();
const nextMonday = addDays(today, (8 - today.getDay()) % 7 || 7);
/** Session date: week w (0..2), weekday d (0=Mon..4=Fri). */
const sd = (w: number, d: number) => iso(addDays(nextMonday, w * 7 + d));
const ukToday = iso(today);
const tomorrow = iso(addDays(today, 1));
const yesterday = iso(addDays(today, -1));

// ── assertions ─────────────────────────────────────────────────────────────
const close = (a: number, b: number) => Math.abs(a - b) < 0.006;
function eq(actual: unknown, expected: unknown, label: string) {
  const same = typeof actual === "number" && typeof expected === "number" ? close(actual, expected) : actual === expected;
  if (!same) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function truthy(v: unknown, label: string) { if (!v) throw new Error(`${label}: expected truthy, got ${JSON.stringify(v)}`); }

// ── browser contexts / screenshots ─────────────────────────────────────────
const ctxs: Partial<Record<Kind, BrowserContext>> = {};
let theBrowser: Browser | null = null;
const loginInfo: Partial<Record<Kind, { mail: string; home: string }>> = {};
/** Signed-in browser context for a kind, logging in lazily (the dev web server can be slow/busy; API work must not wait on it). */
async function getCtx(kind: Kind): Promise<BrowserContext> {
  if (ctxs[kind]) return ctxs[kind]!;
  const li = loginInfo[kind]; if (!li) throw new Error("no login info for " + kind);
  if (!theBrowser || !theBrowser.isConnected()) theBrowser = await chromium.launch();
  await uiLogin(theBrowser, kind, li.mail, li.home);
  return ctxs[kind]!;
}
const shotsTaken = new Set<string>();
async function uiLogin(browser: Browser, kind: Kind, mail: string, home: string) {
  for (let attempt = 0; ; attempt++) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    try {
      await page.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded", timeout: 90_000 }).catch(async () => { await page.waitForTimeout(3000); await page.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded", timeout: 90_000 }); });
      await page.getByPlaceholder("you@example.com").fill(mail);
      await page.locator('input[type="password"]').fill(TEST_PASSWORD);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL(`**${home}`, { timeout: 90_000 });
      await page.close();
      ctxs[kind] = ctx;
      return;
    } catch (e) {
      await ctx.close().catch(() => {});
      if (attempt >= 2) throw e;
    }
  }
}
/** Full-page screenshot of `url` as `kind`, optionally waiting for an anchor card text. Never throws. */
let webDownUntil = 0;
interface ShotSpec { url: string; anchors: string[]; email?: string; home?: string; kind: Kind }
let lastSpec: ShotSpec | null = null;
const PENDING = path.join(SHOTS, "pending.json");
function addPending(kind: Kind, url: string, id: string, anchors: (string | RegExp)[]) {
  const cur = fs.existsSync(PENDING) ? JSON.parse(fs.readFileSync(PENDING, "utf8")) : [];
  cur.push({ stamp, kind, url, id, anchors: anchors.map(String), email: loginInfo[kind]?.mail, home: loginInfo[kind]?.home });
  fs.writeFileSync(PENDING, JSON.stringify(cur, null, 1));
}
async function shot(kind: Kind, url: string, id: string, anchors: (string | RegExp)[] = [], pre?: (p: Page) => Promise<void>): Promise<string> {
  lastSpec = { url, anchors: anchors.map(String), email: loginInfo[kind]?.mail, home: loginInfo[kind]?.home, kind };
  if (Date.now() < webDownUntil) return "";
  if (process.env.PROV_NOSHOT && !pre) return ""; // shots are taken in one final replay pass
  const base = shotsTaken.has(id) ? `${id}.${kind}` : id;
  const file = path.join(SHOTS, `${base}.png`);
  try {
    const ctx = await getCtx(kind);
    const page = await ctx.newPage();
    try {
      await page.goto(`${WEB_URL}${url}`, { waitUntil: "load", timeout: 60_000 });
      if (pre) await pre(page);
      if (anchors.length) await cardWith(page, ...anchors).waitFor({ state: "visible", timeout: 25_000 }).catch(async () => { await page.getByText(anchors[0]).first().waitFor({ state: "visible", timeout: 5_000 }).catch(() => {}); });
      await page.waitForTimeout(1_200);
      await page.screenshot({ path: file, fullPage: true });
      shotsTaken.add(id);
    } finally { await page.close(); }
  } catch (e) {
    console.log(`SHOT FAIL ${id} ${(e as Error).message.slice(0, 120)}`);
    if (/ERR_CONNECTION|ERR_ABORTED|Timeout|net::/.test((e as Error).message)) { webDownUntil = Date.now() + 4 * 60_000; addPending(kind, url, id, anchors); }
    return "";
  }
  return path.relative(ROOT, file);
}

/** Run one check; any thrown error is a FAIL with the message as evidence. */
const ONLY = process.env.PROV_ONLY ? process.env.PROV_ONLY.split(",") : null;
async function check(id: string, kind: Kind, fn: () => Promise<{ note: string; shot?: () => Promise<string> }>) {
  if (ONLY && !ONLY.includes(id)) return;
  let r: Res;
  lastSpec = null;
  try {
    const out = await fn();
    r = { id, kind, ok: true, note: out.note, shot: out.shot ? await out.shot() : undefined, ...(lastSpec ? { spec: lastSpec } : {}) };
  } catch (e) {
    const msg = (e as Error).message;
    r = { id, kind, ok: false, note: msg.slice(0, 600), ...(/ERR_CONNECTION|ERR_ABORTED|net::|Target page, context or browser has been closed/.test(msg) ? { skipped: true } : {}) };
    if (!r.skipped) try { r.shot = await shot(kind, `/${PORTAL[kind]}/bookings`, id); } catch { /* ignore */ }
  }
  rec(r);
}

// ── provisioning helpers ───────────────────────────────────────────────────
const unwall = (...tenantIds: string[]) =>
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", ...tenantIds], { stdio: "pipe" });

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

const venueDone = new Set<string>();
async function ensureVenue(k: string) {
  if (venueDone.has(k)) return "prov-venue";
  const lib = (await call(k, "GET", "/api/library")).json ?? {};
  const venues = (lib.venues ?? []) as { id: string }[];
  await ok(k, "PUT", "/api/library", {
    venues: venues.some((v) => v.id === "prov-venue") ? venues : [...venues, { id: "prov-venue", name: "Prov Sports Hall", address: "1 Test Way", city: "Northampton" }],
    settings: { ...(lib.settings ?? {}), marketplaceListed: true },
  });
  venueDone.add(k);
  return "prov-venue";
}

interface Basics { period: string; p1: string; p3: string; p5: string }
const basics: Record<string, Basics> = {};
async function ensureBasics(k: string): Promise<Basics> {
  if (basics[k]) return basics[k];
  const period = (await ok(k, "POST", "/api/periods", { title: "Full day", start: "09:00", finish: "15:00" })).id;
  const p1 = (await ok(k, "POST", "/api/passes", { name: "1 day", days: 1 })).id;
  const p3 = (await ok(k, "POST", "/api/passes", { name: "3 days", days: 3 })).id;
  const p5 = (await ok(k, "POST", "/api/passes", { name: "5 days", days: 5 })).id;
  return (basics[k] = { period, p1, p3, p5 });
}

interface Listing { id: string; title: string; blockId: string; kind: string; blocks: { id: string; startDate: string }[] }
interface LOpts {
  discounts?: Record<string, unknown>[];
  maxAttendees?: number;
  capacityScope?: "day" | "listing";
  extra?: Record<string, unknown>;
  startToday?: boolean;
  approval?: boolean;
  waitlist?: boolean;
}
/** The Standard test camp (LT-001 shape): Mon-Fri x 3 weeks, 10/day, auto approval, 1 day £20 / 3 days £54 / 5 days £90. */
async function mkListing(k: string, title: string, o: LOpts = {}): Promise<Listing> {
  const b = await ensureBasics(k);
  const venueId = await ensureVenue(k);
  const bundle = await ok(k, "POST", "/api/block-bundles", {
    name: `Bundle ${title}`, periodIds: [b.period], passIds: [b.p1, b.p3, b.p5], priced: true, masterPrice: 90, calcOn: false,
    passFlat: { [b.p1]: 20, [b.p3]: 54 },
  });
  const start = o.startToday ? today : nextMonday;
  const listing = await ok(k, "POST", "/api/listings", {
    title, venueId, runFrom: iso(start), runTo: iso(addDays(start, 20)),
    blockMode: o.startToday ? "custom" : "weekly", days: o.startToday ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5],
    maxAttendees: String(o.maxAttendees ?? 10), capacityScope: o.capacityScope ?? "day", showSpaces: true,
    ageFrom: "5", ageTo: "11", blockId: bundle.id,
    passes: [{ name: "1 day", price: 20, days: 1 }, { name: "3 days", price: 54, days: 3 }, { name: "5 days", price: 90, days: 5 }],
    ...(o.approval ? {} : { bookingType: "auto" }),
    ...(o.waitlist === false ? {} : { waitlist: true, waitlistMode: "manual" }),
    status: "live", visibility: "public",
    ...(o.discounts ? { discounts: o.discounts } : {}),
    ...(o.extra ?? {}),
  });
  await ok(k, "PUT", `/api/block-bundles/${bundle.id}/listings`, { listingIds: [listing.id] });
  const full = await ok(k, "GET", `/api/listings/${listing.id}`);
  const blocks = ((full.blocks ?? []) as { id: string; startDate: string }[]).sort((a, c) => (a.startDate < c.startDate ? -1 : 1));
  return { id: listing.id, title, blockId: blocks[0].id, kind: k, blocks };
}

let childN = 0;
const kid = (tag = "K") => `${tag}${stamp}x${++childN}`;
const PASS_DAYS: Record<string, number> = { "1 day": 1, "3 days": 3, "5 days": 5 };
interface Line { child: string; pass: "1 day" | "3 days" | "5 days"; week?: number; dates?: string[]; age?: number; addons?: { id: string }[] }
function items(lines: Line[]) {
  return lines.map((l) => ({
    pass: l.pass, child: l.child, age: l.age ?? 8,
    dates: l.dates ?? Array.from({ length: PASS_DAYS[l.pass] }, (_, i) => sd(l.week ?? 0, i)),
    ...(l.addons ? { addons: l.addons } : {}),
  }));
}
async function book(parent: string, L: Listing, lines: Line[], extra: Record<string, unknown> = {}) {
  return call(parent, "POST", "/api/my/bookings", { listingId: L.id, blockId: L.blockId, method: "card", items: items(lines), ...extra });
}
async function bookOk(parent: string, L: Listing, lines: Line[], extra: Record<string, unknown> = {}) {
  const r = await book(parent, L, lines, extra);
  if (r.status >= 300) throw new Error(`book -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  const bs = (r.json.bookings ?? []) as any[];
  return { bookings: bs, b: bs[0], amount: bs.reduce((s, x) => s + (x.amount ?? 0), 0), off: bs.reduce((s, x) => s + (x.discountOff ?? 0), 0) };
}
const rule = (o: Record<string, unknown>) => ({
  id: `r${Math.random().toString(36).slice(2, 8)}`, kind: "person", name: "", passNames: [], enabled: true, moreThan: 1, appliesTo: "all", method: "subtract", value: 0, beforeDate: "", ...o,
});
const mkCode = (k: string, o: Record<string, unknown>) => ok(k, "POST", "/api/discounts", { active: true, ...o });
const codeList = async (k: string) => (await ok(k, "GET", "/api/discounts")) as any[];
const bookingsPage = (kind: Kind) => `/${PORTAL[kind]}/bookings`;

// ═══════════════════════════════════════════════════════════════════════════
test.beforeAll(async ({ browser }) => {
  test.setTimeout(3_000_000);
  await signupParent("p1"); await signupParent("p2"); await signupParent("p3");
  await signupOperator("co", "company", `Prov Co ${stamp}`);
  await signupOperator("fl", "freelancer", `Prov Free ${stamp}`);
  await signupOperator("ho", "company", `Prov HO ${stamp}`);
  unwall(A.co.tenantId!, A.fl.tenantId!, A.ho.tenantId!);
  await joinByInvite("fr", "ho", { role: "franchise", franchiseName: `Prov Alpha ${stamp}` });
  await joinByInvite("frA", "ho", { role: "franchise", franchiseName: `Prov FrA ${stamp}` });
  await joinByInvite("frB", "ho", { role: "franchise", franchiseName: `Prov FrB ${stamp}` });
  await joinByInvite("st", "co", { role: "staff", name: `Prov Staff ${stamp}`, staffRole: "Manager", assignment: { mode: "all", ids: [] } });
    loginInfo.co = { mail: A.co.email, home: "/company/bookings" };
  loginInfo.fl = { mail: A.fl.email, home: "/freelancer/bookings" };
  loginInfo.ho = { mail: A.ho.email, home: "/company/bookings" };
  loginInfo.fr = { mail: A.fr.email, home: "/franchise/bookings" };
  loginInfo.fa = { mail: A.frA.email, home: "/franchise/bookings" };
  loginInfo.st = { mail: A.st.email, home: "/staff/dash" };
  console.log("ACCOUNTS", JSON.stringify(Object.fromEntries(Object.entries(A).map(([k, v]) => [k, { email: v.email, tenantId: v.tenantId, franchiseId: v.franchiseId }]))));
});

test.afterAll(async () => { for (const c of Object.values(ctxs)) await c?.close().catch(() => {}); });

// ═══════════════════════════════════════════════════════════════════════════
// DI: automatic discounts + codes (the same server code prices all three operator kinds)
// ═══════════════════════════════════════════════════════════════════════════
const DI_KINDS: Kind[] = ["co", "fr", "fl"];
for (const kind of DI_KINDS) {
  T(`DI automatic discounts + codes as ${kind}`, async () => {
    test.setTimeout(3_000_000);
    const k = kind;
    const P = "p1";
    const CODE = (n: string) => `${n}${stamp}`.toUpperCase().replace(/[^A-Z0-9]/g, "");

    // ---- automatic rules ----
    const sib5 = await mkListing(k, `DI sib5 ${kind} ${stamp}`, { discounts: [rule({ kind: "person", method: "subtract", value: 5, moreThan: 1 })] });
    let ref001 = "";
    await check("DI-001", kind, async () => {
      const one = await bookOk(P, sib5, [{ child: kid(), pass: "3 days" }]);
      eq(one.amount, 54, "one child pays"); eq(one.off, 0, "one child discount");
      const two = await bookOk(P, sib5, [{ child: kid(), pass: "3 days" }, { child: kid(), pass: "3 days" }]);
      eq(two.amount, 98, "two children total"); eq(two.off, 10, "discountOff");
      ref001 = two.b.ref;
      return { note: `1 child 54.00 no discount; 2 children ${two.amount} with discountOff ${two.off} (ref ${ref001})`, shot: () => shot(kind, bookingsPage(kind), "DI-001", [ref001]) };
    });
    await check("DI-004", kind, async () => {
      const r = await bookOk(P, sib5, [{ child: kid(), pass: "3 days", week: 0 }, { child: kid(), pass: "3 days", week: 1 }]);
      eq(r.amount, 108, "different weeks, no sibling discount"); eq(r.off, 0, "discountOff");
      return { note: `A wk1 + B wk2 on 3 days -> total ${r.amount} off ${r.off} (ref ${r.b.ref})`, shot: () => shot(kind, bookingsPage(kind), "DI-004", [r.bookings[0].ref]) };
    });
    const sibPct = await mkListing(k, `DI sibPct ${kind} ${stamp}`, { discounts: [rule({ kind: "person", method: "percent", value: 10 })] });
    await check("DI-002", kind, async () => {
      const r = await bookOk(P, sibPct, [{ child: kid(), pass: "3 days" }, { child: kid(), pass: "3 days" }]);
      eq(r.amount, 97.2, "total"); return { note: `2 x 3 days at 10% sibling -> ${r.amount} (off ${r.off}) ref ${r.b.ref}`, shot: () => shot(kind, bookingsPage(kind), "DI-002", [r.b.ref]) };
    });
    const sibPrice = await mkListing(k, `DI sibPrice ${kind} ${stamp}`, { discounts: [rule({ kind: "person", method: "price", value: 45 })] });
    await check("DI-003", kind, async () => {
      const r = await bookOk(P, sibPrice, [{ child: kid(), pass: "3 days" }, { child: kid(), pass: "3 days" }]);
      eq(r.amount, 90, "total"); return { note: `price rule £45 -> ${r.amount} ref ${r.b.ref}`, shot: () => shot(kind, bookingsPage(kind), "DI-003", [r.b.ref]) };
    });
    const sib5only = await mkListing(k, `DI sibLimited ${kind} ${stamp}`, { discounts: [rule({ kind: "person", method: "subtract", value: 5, passNames: ["5 days"] })] });
    await check("DI-005", kind, async () => {
      const r = await bookOk(P, sib5only, [{ child: kid(), pass: "3 days" }, { child: kid(), pass: "3 days" }]);
      eq(r.amount, 108, "no discount on 3 days"); eq(r.off, 0, "off");
      return { note: `rule limited to '5 days'; 2 x 3 days -> ${r.amount} off ${r.off} ref ${r.b.ref}`, shot: () => shot(kind, bookingsPage(kind), "DI-005", [r.b.ref]) };
    });
    const sess = await mkListing(k, `DI session ${kind} ${stamp}`, { discounts: [rule({ kind: "session", method: "percent", value: 10, moreThan: 3 })] });
    await check("DI-006", kind, async () => {
      const r = await bookOk(P, sess, [{ child: kid(), pass: "5 days" }]);
      eq(r.amount, 81, "total"); return { note: `session>3 10%: 5 days -> ${r.amount} ref ${r.b.ref}`, shot: () => shot(kind, bookingsPage(kind), "DI-006", [r.b.ref]) };
    });
    await check("DI-007", kind, async () => {
      const r = await bookOk(P, sess, [{ child: kid(), pass: "3 days" }, { child: kid(), pass: "3 days" }]);
      eq(r.amount, 97.2, "total"); return { note: `3 days x 2 children = 6 sessions -> ${r.amount} ref ${r.b.ref}`, shot: () => shot(kind, bookingsPage(kind), "DI-007", [r.b.ref]) };
    });
    await check("DI-008", kind, async () => {
      const r = await bookOk(P, sess, [{ child: kid(), pass: "3 days" }]);
      eq(r.amount, 54, "total"); eq(r.off, 0, "off"); return { note: `3 sessions not more than 3 -> ${r.amount} off ${r.off} ref ${r.b.ref}`, shot: () => shot(kind, bookingsPage(kind), "DI-008", [r.b.ref]) };
    });
    const early = await mkListing(k, `DI early ${kind} ${stamp}`, { discounts: [rule({ kind: "early", method: "subtract", value: 10, beforeDate: tomorrow })] });
    await check("DI-009", kind, async () => {
      const r = await bookOk(P, early, [{ child: kid(), pass: "5 days" }]);
      eq(r.amount, 80, "total"); return { note: `early bird until ${tomorrow}: 5 days -> ${r.amount} ref ${r.b.ref}`, shot: () => shot(kind, bookingsPage(kind), "DI-009", [r.b.ref]) };
    });
    // Boundary (DI-049 is parent-side) -> last-day inclusive covered by an extra listing with beforeDate = today
    const earlyToday = await mkListing(k, `DI earlyToday ${kind} ${stamp}`, { discounts: [rule({ kind: "early", method: "subtract", value: 10, beforeDate: ukToday })] });
    const earlyPast = await mkListing(k, `DI earlyPast ${kind} ${stamp}`, { discounts: [rule({ kind: "early", method: "subtract", value: 10, beforeDate: yesterday })] });
    await check("DI-010", kind, async () => {
      const past = await bookOk(P, earlyPast, [{ child: kid(), pass: "5 days" }]);
      eq(past.amount, 90, "yesterday cut-off -> full price"); eq(past.off, 0, "off");
      const last = await bookOk(P, earlyToday, [{ child: kid(), pass: "5 days" }]);
      eq(last.amount, 80, "cut-off today is inclusive");
      return { note: `cut-off yesterday -> ${past.amount} (ref ${past.b.ref}); cut-off today (last day) -> ${last.amount}`, shot: () => shot(kind, bookingsPage(kind), "DI-010", [past.b.ref]) };
    });
    const best = await mkListing(k, `DI best ${kind} ${stamp}`, { discounts: [rule({ kind: "person", method: "subtract", value: 5, name: "Five off" }), rule({ kind: "person", method: "percent", value: 10, name: "Ten pct" })] });
    await check("DI-011", kind, async () => {
      const r = await bookOk(P, best, [{ child: kid(), pass: "3 days" }, { child: kid(), pass: "3 days" }]);
      eq(r.amount, 97.2, "best rule only"); eq((r.b.discountNames ?? []).length, 1, "single discount line");
      return { note: `£5 vs 10% rules -> only better applied, total ${r.amount}; discountNames ${JSON.stringify(r.b.discountNames)} ref ${r.b.ref}`, shot: () => shot(kind, bookingsPage(kind), "DI-011", [r.b.ref]) };
    });
    const three = await mkListing(k, `DI three ${kind} ${stamp}`, { discounts: [rule({ kind: "person", method: "percent", value: 10, name: "Sib10" }), rule({ kind: "session", method: "percent", value: 10, moreThan: 3, name: "Multi10" }), rule({ kind: "early", method: "subtract", value: 5, beforeDate: tomorrow, name: "Early5" })] });
    await check("DI-012", kind, async () => {
      const r = await bookOk(P, three, [{ child: kid(), pass: "3 days" }, { child: kid(), pass: "3 days" }]);
      eq(r.amount, 82.48, "stacked order"); eq((r.b.discountNames ?? []).length, 3, "three discount lines");
      return { note: `person 10% -> session 10% -> early £5 = ${r.amount}; names ${JSON.stringify(r.b.discountNames)} ref ${r.b.ref}`, shot: () => shot(kind, bookingsPage(kind), "DI-012", [r.b.ref]) };
    });
    const offL = await mkListing(k, `DI off ${kind} ${stamp}`, { discounts: [rule({ kind: "person", method: "subtract", value: 5, enabled: false })] });
    await check("DI-013", kind, async () => {
      const r = await bookOk(P, offL, [{ child: kid(), pass: "3 days" }, { child: kid(), pass: "3 days" }]);
      eq(r.amount, 108, "disabled rule ignored"); eq(r.off, 0, "off");
      const doc = await ok(k, "GET", `/api/listings/${offL.id}`); eq(doc.discounts[0].enabled, false, "rule.enabled stored false");
      return { note: `enabled=false rule -> ${r.amount}, no discount (ref ${r.b.ref})`, shot: () => shot(kind, bookingsPage(kind), "DI-013", [r.b.ref]) };
    });

    // ---- codes (tenant-wide), on a plain camp ----
    const plain = await mkListing(k, `DI codes ${kind} ${stamp}`);
    const plain2 = await mkListing(k, `DI codes2 ${kind} ${stamp}`);
    const S10 = CODE("SAVE10"), F5 = CODE("FIVEOFF"), K5 = CODE("KIDS5");
    await mkCode(k, { code: S10, type: "percent", value: 10 });
    await mkCode(k, { code: F5, type: "amount", value: 5 });
    await mkCode(k, { code: K5, type: "perAttendee", value: 5 });
    const used = async (c: string) => ((await codeList(k)).find((x) => x.code === c)?.usedCount ?? 0) as number;
    const mkt = `/${PORTAL[kind]}/marketing`;
    await check("DI-014", kind, async () => {
      const before = await used(S10);
      const r = await bookOk(P, plain, [{ child: kid(), pass: "5 days" }], { discountCodes: [S10] });
      eq(r.amount, 81, "total"); eq(r.b.discountCodes?.[0], S10, "discountCodes");
      eq(await used(S10), before + 1, "usedCount");
      return { note: `${S10} 10% on 5 days -> ${r.amount}; usedCount ${before}->${before + 1}; ref ${r.b.ref}`, shot: () => shot(kind, mkt, "DI-014", [S10]) };
    });
    await check("DI-015", kind, async () => {
      const before = await used(F5);
      const r = await bookOk(P, plain, [{ child: kid(), pass: "5 days" }], { discountCodes: [F5] });
      eq(r.amount, 85, "total"); eq(await used(F5), before + 1, "usedCount");
      return { note: `${F5} £5 per booking -> ${r.amount}; usedCount +1; ref ${r.b.ref}`, shot: () => shot(kind, mkt, "DI-015", [F5]) };
    });
    await check("DI-016", kind, async () => {
      const r = await bookOk(P, plain, [{ child: kid(), pass: "3 days" }, { child: kid(), pass: "3 days" }], { discountCodes: [K5] });
      eq(r.amount, 98, "total"); return { note: `${K5} £5/attendee x2 children on 3 days -> ${r.amount}; ref ${r.b.ref}`, shot: () => shot(kind, mkt, "DI-016", [K5]) };
    });
    const BIG = CODE("BIG10");
    await mkCode(k, { code: BIG, type: "percent", value: 10, minSpend: 60 });
    await check("DI-017", kind, async () => {
      const bad = await book(P, plain, [{ child: kid(), pass: "1 day" }], { discountCodes: [BIG] });
      eq(bad.status, 400, "£20 refused"); truthy(/Spend at least £60\.00/.test(JSON.stringify(bad.json)), "reason text: " + JSON.stringify(bad.json));
      const good = await bookOk(P, plain, [{ child: kid(), pass: "5 days" }], { discountCodes: [BIG] });
      eq(good.amount, 81, "£90 works");
      return { note: `1 day £20 refused (${JSON.stringify(bad.json).slice(0, 80)}); 5 days -> ${good.amount}`, shot: () => shot(kind, mkt, "DI-017", [BIG]) };
    });
    const OLD = CODE("OLD10");
    const oldCode = await mkCode(k, { code: OLD, type: "percent", value: 10, expiry: yesterday });
    await check("DI-018", kind, async () => {
      const bad = await book(P, plain, [{ child: kid(), pass: "5 days" }], { discountCodes: [OLD] });
      eq(bad.status, 400, "expired refused"); truthy(/expired/.test(JSON.stringify(bad.json)), "text: " + JSON.stringify(bad.json));
      await ok(k, "PUT", `/api/discounts/${oldCode.id}`, { expiry: ukToday });
      const good = await bookOk(P, plain, [{ child: kid(), pass: "5 days" }], { discountCodes: [OLD] });
      eq(good.amount, 81, "expiry today still valid");
      return { note: `expiry yesterday -> "${bad.json?.error}"; expiry today -> ${good.amount} (inclusive)`, shot: () => shot(kind, mkt, "DI-018", [OLD]) };
    });
    const ONCE = CODE("ONCE");
    await mkCode(k, { code: ONCE, type: "amount", value: 5, usageLimit: 1 });
    await check("DI-019", kind, async () => {
      const a = await bookOk(P, plain, [{ child: kid(), pass: "5 days" }], { discountCodes: [ONCE] });
      eq(a.amount, 85, "first use");
      const b2 = await book("p2", plain, [{ child: kid(), pass: "5 days" }], { discountCodes: [ONCE] });
      eq(b2.status, 400, "second refused"); truthy(/usage limit/.test(JSON.stringify(b2.json)), "text " + JSON.stringify(b2.json));
      const row = (await codeList(k)).find((c) => c.code === ONCE); eq(row.usedCount, 1, "usedCount 1/1");
      return { note: `used once (${a.amount}); second -> "${b2.json?.error}"; usedCount ${row.usedCount}/${row.usageLimit}`, shot: () => shot(kind, mkt, "DI-019", [ONCE]) };
    });
    const LOYAL = CODE("LOYAL");
    await mkCode(k, { code: LOYAL, type: "amount", value: 5, perCustomerLimit: true });
    await check("DI-020", kind, async () => {
      await bookOk(P, plain, [{ child: kid(), pass: "5 days" }], { discountCodes: [LOYAL] });
      const bad = await book(P, plain, [{ child: kid(), pass: "5 days" }], { discountCodes: [LOYAL] });
      eq(bad.status, 400, "second use refused"); truthy(/already used/.test(JSON.stringify(bad.json)), "text " + JSON.stringify(bad.json));
      const other = await bookOk("p2", plain, [{ child: kid(), pass: "5 days" }], { discountCodes: [LOYAL] }); eq(other.amount, 85, "different parent can use it");
      return { note: `same parent twice -> "${bad.json?.error}"; other parent ok (${other.amount})`, shot: () => shot(kind, mkt, "DI-020", [LOYAL]) };
    });
    const SOLO = CODE("SOLO");
    await mkCode(k, { code: SOLO, type: "percent", value: 10, exclusive: true });
    await check("DI-021", kind, async () => {
      const bad = await book(P, plain, [{ child: kid(), pass: "5 days" }], { discountCodes: [SOLO, S10] });
      eq(bad.status, 400, "combo refused"); truthy(/can.t be combined/.test(JSON.stringify(bad.json)) && JSON.stringify(bad.json).includes(SOLO), "text " + JSON.stringify(bad.json));
      return { note: `SOLO + other -> "${bad.json?.error}"`, shot: () => shot(kind, mkt, "DI-021", [SOLO]) };
    });
    await check("DI-022", kind, async () => {
      const a0 = await used(S10), b0 = await used(F5);
      const r = await bookOk(P, plain, [{ child: kid(), pass: "5 days" }], { discountCodes: [S10, F5] });
      eq(r.amount, 76, "10% + £5 add"); eq(await used(S10), a0 + 1, "S10 used"); eq(await used(F5), b0 + 1, "F5 used");
      return { note: `${S10}+${F5} -> ${r.amount} (add, not compound); both usedCount +1; ref ${r.b.ref}`, shot: () => shot(kind, bookingsPage(kind), "DI-022", [r.b.ref]) };
    });
    const FAM = CODE("FAMILY");
    await check("DI-023", kind, async () => {
      await mkCode(k, { code: FAM, type: "percent", value: 20, assignedTo: A.p1.email });
      const mine = await bookOk("p1", plain, [{ child: kid(), pass: "5 days" }], { discountCodes: [FAM] });
      eq(mine.amount, 72, "reserved family gets 20%");
      const other = await book("p2", plain, [{ child: kid(), pass: "5 days" }], { discountCodes: [FAM] });
      eq(other.status, 400, "other refused"); truthy(/reserved for another customer/.test(JSON.stringify(other.json)), "text " + JSON.stringify(other.json));
      const cp = await call("p1", "GET", "/api/my/coupons");
      truthy((cp.json as any[]).some((c) => c.code === FAM), "code listed under p1 coupons");
      return { note: `reserved code: p1 ${mine.amount}; p2 -> "${other.json?.error}"; listed in p1 coupons`, shot: () => shot(kind, mkt, "DI-023", [FAM]) };
    });
    const GRP = CODE("GROUPC");
    await check("DI-024", kind, async () => {
      const g = await ok(k, "POST", "/api/discounts/groups", { name: `NHS ${stamp}`, emails: [A.p1.email, A.p3.email] });
      const c = await mkCode(k, { code: GRP, type: "amount", value: 10, assignedGroupId: g.id });
      truthy(c.assignedEmails?.length === 2 && c.assignedGroupName, "assignedEmails/groupName stored " + JSON.stringify([c.assignedEmails, c.assignedGroupName]));
      const mem = await bookOk("p3", plain, [{ child: kid(), pass: "5 days" }], { discountCodes: [GRP] }); eq(mem.amount, 80, "member discount");
      const non = await book("p2", plain, [{ child: kid(), pass: "5 days" }], { discountCodes: [GRP] });
      eq(non.status, 400, "non-member refused");
      return { note: `group code: member ${mem.amount}; non-member "${non.json?.error}"; assignedGroupName ${c.assignedGroupName}`, shot: () => shot(kind, mkt, "DI-024", [GRP]) };
    });
    const ONLYA = CODE("ONLYA");
    await check("DI-025", kind, async () => {
      await mkCode(k, { code: ONLYA, type: "amount", value: 5, listingId: plain.id });
      const bad = await book(P, plain2, [{ child: kid(), pass: "5 days" }], { discountCodes: [ONLYA] });
      eq(bad.status, 400, "refused on B"); truthy(/doesn.t apply to this activity/.test(JSON.stringify(bad.json)), "text " + JSON.stringify(bad.json));
      const good = await bookOk(P, plain, [{ child: kid(), pass: "5 days" }], { discountCodes: [ONLYA] }); eq(good.amount, 85, "works on A");
      return { note: `listing-scoped: on A ${good.amount}; on B "${bad.json?.error}"`, shot: () => shot(kind, mkt, "DI-025", [ONLYA]) };
    });
    await check("DI-028", kind, async () => {
      const L = await mkListing(k, `DI codeplusauto ${kind} ${stamp}`, { discounts: [rule({ kind: "person", method: "subtract", value: 5 })] });
      const r = await bookOk(P, L, [{ child: kid(), pass: "3 days" }, { child: kid(), pass: "3 days" }], { discountCodes: [S10] });
      eq(r.amount, 88.2, "auto then code"); return { note: `sibling £5 + ${S10}: 108-10=98, 10% -> ${r.amount}; names ${JSON.stringify(r.b.discountNames)}`, shot: () => shot(kind, bookingsPage(kind), "DI-028", [r.b.ref]) };
    });
    await check("DI-029", kind, async () => {
      const lib = (await call(k, "GET", "/api/library")).json ?? {};
      const addonId = `ao${stamp}`;
      await ok(k, "PUT", "/api/library", { addons: [...(lib.addons ?? []), { id: addonId, name: "T-shirt", type: "fixed", price: 8 }] });
      const L = await mkListing(k, `DI addon ${kind} ${stamp}`, { extra: { addonIds: [addonId] } });
      const r = await bookOk(P, L, [{ child: kid(), pass: "5 days", addons: [{ id: addonId }] }], { discountCodes: [S10] });
      eq(r.amount, 89, "code on pass only"); return { note: `5 days + T-shirt £8 with ${S10}: 90-9+8 = ${r.amount}; addons ${JSON.stringify(r.b.addons)}`, shot: () => shot(kind, bookingsPage(kind), "DI-029", [r.b.ref]) };
    });
    const HUGE = CODE("HUGE");
    await mkCode(k, { code: HUGE, type: "amount", value: 500 });
    await check("DI-030", kind, async () => {
      const r = await bookOk(P, plain, [{ child: kid(), pass: "1 day" }], { discountCodes: [HUGE] });
      eq(r.amount, 0, "total zero"); eq(r.b.pay, "Funded", "pay Funded");
      return { note: `£500 code on £20 pass -> amount ${r.amount}, pay ${r.b.pay}; ref ${r.b.ref}`, shot: () => shot(kind, bookingsPage(kind), "DI-030", [r.b.ref]) };
    });
    // Remember this kind's listing + a paid/unpaid anchor booking for FD checks
    (globalThis as any).__prov ??= {};
    (globalThis as any).__prov[kind] = { sib5, plain, plain2 };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// LT: listing types / rules (per operator kind)
// ═══════════════════════════════════════════════════════════════════════════
const localDt = (d: Date) => `${iso(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const feed = async () => (await call("p1", "GET", "/api/listings")).json as any[];
async function dayCounts(k: string, L: Listing) {
  const full = await ok(k, "GET", `/api/listings/${L.id}`);
  const m: Record<string, number> = {};
  for (const b of full.blocks) for (const s of b.sessions) m[s.date] = Math.max(m[s.date] ?? 0, s.bookedCount);
  return m;
}
const listingsPage = (kind: Kind) => `/${PORTAL[kind]}/listings`;

for (const kind of DI_KINDS) {
  T(`LT listing rules as ${kind}`, async () => {
    test.setTimeout(3_000_000);
    const k = kind;
    await check("LT-020", kind, async () => {
      const L = await mkListing(k, `LT opens ${kind} ${stamp}`, { extra: { opensAt: localDt(new Date(Date.now() + 30 * 60_000)) } });
      const early = await book("p1", L, [{ child: kid(), pass: "1 day" }]);
      eq(early.status, 409, "before opens refused"); truthy(/hasn.t opened yet/.test(JSON.stringify(early.json)), JSON.stringify(early.json));
      await ok(k, "PUT", `/api/listings/${L.id}`, { opensAt: localDt(new Date(Date.now() - 60_000)) });
      const after = await bookOk("p1", L, [{ child: kid(), pass: "1 day" }]);
      eq(after.amount, 20, "books after open");
      return { note: `before opensAt -> 409 "${early.json?.error}"; after -> booked ${after.b.ref}`, shot: () => shot(kind, listingsPage(kind), "LT-020", [L.title]) };
    });
    await check("LT-021", kind, async () => {
      const L = await mkListing(k, `LT cutoff ${kind} ${stamp}`, { startToday: true, extra: { bookingCutoffHours: "48" } });
      const soon = await book("p1", L, [{ child: kid(), pass: "1 day", dates: [iso(addDays(today, 1))] }]);
      eq(soon.status, 409, "tomorrow refused"); truthy(/have closed/.test(JSON.stringify(soon.json)), JSON.stringify(soon.json));
      const later = await book("p1", L, [{ child: kid(), pass: "1 day", dates: [iso(addDays(today, 5))] }]);
      eq(later.status < 300, true, "later session bookable: " + JSON.stringify(later.json).slice(0, 150));
      return { note: `cut-off 48h: tomorrow -> 409 "${soon.json?.error?.slice(0, 80)}"; +5 days booked`, shot: () => shot(kind, listingsPage(kind), "LT-021", [L.title]) };
    });
    await check("LT-022", kind, async () => {
      const L = await mkListing(k, `LT ages ${kind} ${stamp}`);
      const young = await book("p1", L, [{ child: kid(), pass: "1 day", age: 4 }]);
      const old = await book("p1", L, [{ child: kid(), pass: "1 day", age: 12 }]);
      eq(young.status, 400, "age 4 refused"); eq(old.status, 400, "age 12 refused");
      truthy(/outside this listing/.test(JSON.stringify(young.json)), JSON.stringify(young.json));
      const okAge = await bookOk("p1", L, [{ child: kid(), pass: "1 day", age: 8 }]); eq(okAge.amount, 20, "age 8 ok");
      const L2 = await mkListing(k, `LT ages-out ${kind} ${stamp}`, { extra: { allowOutOfRange: true } });
      const oor = await bookOk("p1", L2, [{ child: kid(), pass: "1 day", age: 4 }]);
      eq(oor.b.status, "Approval needed", "out-of-range allowed -> approval");
      return { note: `ages 5-11: 4 -> 400 "${young.json?.error?.slice(0, 70)}", 12 -> 400, 8 booked; allowOutOfRange age 4 -> ${oor.b.status}`, shot: () => shot(kind, bookingsPage(kind), "LT-022", [oor.b.ref]) };
    });
    await check("LT-024", kind, async () => {
      const day = await mkListing(k, `LT cap-day ${kind} ${stamp}`, { maxAttendees: 2, capacityScope: "day" });
      const whole = await mkListing(k, `LT cap-all ${kind} ${stamp}`, { maxAttendees: 2, capacityScope: "listing" });
      const one = (d: number) => [{ child: kid(), pass: "1 day" as const, dates: [sd(0, d)] }];
      const out: string[] = [];
      // per day: two children fill Monday, a third is waitlisted for Monday, Tuesday still has places
      await bookOk("p1", day, one(0)); await bookOk("p1", day, one(0));
      const t3 = await book("p1", day, one(0)); const s3 = t3.json?.bookings?.[0]?.status ?? `HTTP ${t3.status}`;
      eq(s3, "Waitlisted", "per-day: third child on full Monday");
      const tue = await bookOk("p1", day, one(1)); eq(tue.b.status, "Confirmed", "per-day: Tuesday still has a place");
      out.push(`per day (max 2): third child on Monday -> ${s3}; a child on Tuesday -> ${tue.b.status}`);
      // whole listing: Monday + Tuesday fill the 2 places, a third on Monday is told it is full
      await bookOk("p1", whole, one(0)); await bookOk("p1", whole, one(1));
      const w3 = await book("p1", whole, one(0)); const ws = w3.json?.bookings?.[0]?.status ?? `HTTP ${w3.status}`;
      eq(ws, "Waitlisted", "whole listing: third child");
      const w4 = await book("p1", whole, one(2)); const w4s = w4.json?.bookings?.[0]?.status ?? `HTTP ${w4.status}`;
      eq(w4s, "Waitlisted", "whole listing: a third child on a different day is also full");
      out.push(`whole listing (max 2, children on Mon+Tue): third child Monday -> ${ws}; third child Wednesday -> ${w4s}`);
      return { note: out.join("; "), shot: () => shot(kind, listingsPage(kind), "LT-024", [day.title]) };
    });
    await check("LT-029", kind, async () => {
      const lib = (await call(k, "GET", "/api/library")).json ?? {};
      const sid = `season${stamp}`;
      await ok(k, "PUT", "/api/library", { settings: { ...(lib.settings ?? {}), seasons: [{ id: sid, name: `Summer ${stamp}` }], marketplaceListed: true } });
      const L = await mkListing(k, `LT season ${kind} ${stamp}`, { extra: { seasonId: sid } });
      const f = (await feed()).find((x) => x.id === L.id);
      eq(f?.season, `Summer ${stamp}`, "season name resolved on feed");
      return { note: `seasonId ${sid} stored; feed resolves season "${f.season}"`, shot: () => shot(kind, listingsPage(kind), "LT-029", [L.title]) };
    });
    await check("LT-034", kind, async () => {
      const lib = (await call(k, "GET", "/api/library")).json ?? {};
      await ok(k, "PUT", "/api/library", { settings: { ...(lib.settings ?? {}), payMethods: ["Card", "Bank transfer", "Cash on the day", "Childcare vouchers", "Tax-Free Childcare"], marketplaceListed: true } });
      const L = await mkListing(k, `LT pay ${kind} ${stamp}`, { extra: { payMethods: ["Bank transfer", "Tax-Free Childcare"] } });
      const doc = await ok(k, "GET", `/api/listings/${L.id}`);
      eq(JSON.stringify(doc.payMethods), JSON.stringify(["Bank transfer", "Tax-Free Childcare"]), "payMethods stored");
      const cash = await book("p1", L, [{ child: kid(), pass: "1 day" }], { method: "Cash on the day" });
      const bank = await book("p1", L, [{ child: kid(), pass: "1 day" }], { method: "Bank transfer" });
      eq(bank.status < 300, true, "allowed method works");
      if (cash.status < 300) throw new Error(`server accepted excluded method "Cash on the day" (HTTP ${cash.status}) - restriction is UI-only`);
      return { note: `excluded method refused ("${JSON.stringify(cash.json).slice(0, 90)}"); Bank transfer accepted`, shot: () => shot(kind, listingsPage(kind), "LT-034", [L.title]) };
    });
    // LT-035 CRITICAL: never more than 10 per day
    if (kind !== "fl") await check("LT-035", kind, async () => {
      const L = await mkListing(k, `LT cap10 ${kind} ${stamp}`);
      const parents = ["p1", "p2", "p3"]; let n = 0; const par = () => parents[n++ % 3];
      const kids10: string[] = [];
      const lines: Line[] = [
        ...Array.from({ length: 4 }, () => ({ child: kid("M"), pass: "1 day" as const, dates: [sd(0, 0)] })),
        ...Array.from({ length: 3 }, () => ({ child: kid("M"), pass: "3 days" as const })),
        ...Array.from({ length: 2 }, () => ({ child: kid("M"), pass: "5 days" as const })),
      ];
      for (const l of lines) { const r = await bookOk(par(), L, [l]); eq(r.b.status, "Confirmed", "seated"); kids10.push(l.child); }
      // 10th via Book for a customer (on behalf)
      const obo = await call(k, "POST", "/api/my/bookings", { listingId: L.id, blockId: L.blockId, method: "card", items: items([{ child: kid("M"), pass: "1 day", dates: [sd(0, 0)] }]), onBehalfOf: { name: "Walk In", email: email(`obo${n}`) } });
      eq(obo.status < 300 && obo.json.bookings[0].status, "Confirmed", "10th (book for customer) seated: " + JSON.stringify(obo.json).slice(0, 200));
      let dc = await dayCounts(k, L); eq(dc[sd(0, 0)], 10, "Monday count 10");
      // 11th by every route
      const r11p = await book("p2", L, [{ child: kid("M"), pass: "1 day", dates: [sd(0, 0)] }]);
      const r11o = await call(k, "POST", "/api/my/bookings", { listingId: L.id, blockId: L.blockId, method: "card", items: items([{ child: kid("M"), pass: "1 day", dates: [sd(0, 0)] }]), onBehalfOf: { name: "Walk In 2", email: email(`obo2${n}`) } });
      const r11q = await call(k, "POST", "/api/bookings", { booker: "Quick Book", email: email(`qb${n}`), child: kid("M"), age: 8, listing: L.title, pass: "1 day", blockId: L.blockId, amount: 20, method: "Cash" });
      const st = (r: { status: number; json: any }) => r.json?.bookings?.[0]?.status ?? r.json?.status ?? `HTTP ${r.status}`;
      const sts = [st(r11p), st(r11o), st(r11q)];
      for (const s of sts) truthy(s !== "Confirmed" && s !== "Approval needed", `11th child must not be seated, got ${s}`);
      dc = await dayCounts(k, L); eq(dc[sd(0, 0)], 10, "Monday still 10 after 11th attempts");
      const tue = await bookOk("p2", L, [{ child: kid("M"), pass: "1 day", dates: [sd(0, 1)] }]); eq(tue.b.status, "Confirmed", "Tuesday bookable");
      // cancel one Monday booking then 11th again
      const victim = (await ok("p1", "GET", "/api/my/bookings")) as any[];
      const target = victim.find((b) => b.listing === L.title && b.tenantId === A[k].tenantId && b.status === "Confirmed" && b.pass === "1 day");
      truthy(target, "found a p1 Monday booking to cancel");
      const cx = await call("p1", "POST", `/api/my/bookings/${target.ref}/cancel`, { tenantId: A[k].tenantId });
      eq(cx.status < 300, true, "cancel: " + JSON.stringify(cx.json).slice(0, 160));
      const again = await book("p3", L, [{ child: kid("M"), pass: "1 day", dates: [sd(0, 0)] }]);
      const againSt = st(again);
      dc = await dayCounts(k, L);
      return { note: `10 seated Mon (parent page x7 incl. 3-day/5-day passes, 1 book-for-customer); 11th: parent=${sts[0]}, book-for-customer=${sts[1]}, quick-book=${sts[2]}; Mon count stayed ${10}; Tue bookable; after cancel 11th -> ${againSt}; final Mon count ${dc[sd(0, 0)]}`, shot: () => shot(kind, bookingsPage(kind), "LT-035", [L.title]) };
    });
  });
}

for (const kind of DI_KINDS) {
  T(`LT ui checks as ${kind}`, async () => {
    test.setTimeout(3_000_000);
    const k = kind;
    await check("LT-025", kind, async () => {
      const L = await mkListing(k, `LT spaces ${kind} ${stamp}`, { maxAttendees: 3 });
      await bookOk("p1", L, [{ child: kid(), pass: "1 day", dates: [sd(0, 0)] }]);
      await bookOk("p2", L, [{ child: kid(), pass: "1 day", dates: [sd(0, 0)] }]);
      const text: Record<string, string> = {};
      const grab = (key: string) => async (p: Page) => { await p.waitForTimeout(3500); text[key] = (await p.locator("body").innerText()).replace(/\s+/g, " "); };
      await ok(k, "PUT", `/api/listings/${L.id}`, { showSpaces: false });
      eq((await ok(k, "GET", `/api/listings/${L.id}`)).showSpaces, false, "stored false");
      await shot(kind, `/book/${L.id}?preview=1`, "LT-025", [], grab("off"));
      await ok(k, "PUT", `/api/listings/${L.id}`, { showSpaces: true });
      const onShot = await shot(kind, `/book/${L.id}?preview=1`, "LT-025", [], grab("on"));
      if (!(text.on ?? "").trim() || !(text.off ?? "").trim()) throw new Error("net::ERR_CONNECTION web page not loaded");
      const re = /(only \d+ left|\d+ (spaces?|places?|spots?) left|almost full(?! full))/i;
      const cnt = (t: string) => (t.match(/\bleft\b/gi) ?? []).length;
      eq(cnt(text.off) , 0, "no 'left' counters with showSpaces=false");
      truthy(cnt(text.on) > 0, "'left' counter shown with showSpaces=true: " + text.on.slice(0, 200));
      return { note: `showSpaces false -> no 'left' counters on the parent page; true (Mon has 1 of 3 left) -> "${(text.on.match(/.{20}\bleft\b.{10}/i) ?? [""])[0]}"`, shot: async () => onShot };
    });
    await check("LT-026", kind, async () => {
      const L = await mkListing(k, `LT dup ${kind} ${stamp}`, { discounts: [rule({ kind: "person", method: "subtract", value: 5 })] });
      const ctx = await getCtx(kind); const page = await ctx.newPage();
      try {
        await page.goto(`${WEB_URL}${listingsPage(kind)}`, { waitUntil: "load" });
        const card = cardWith(page, L.title); await card.waitFor({ timeout: 30_000 });
        await card.getByRole("button", { name: "⋯" }).click();
        await page.getByRole("button", { name: /Duplicate/i }).click();
        await page.waitForTimeout(3_000);
        await page.screenshot({ path: path.join(SHOTS, `LT-026${kind === "co" ? "" : "." + kind}.png`), fullPage: true });
      } finally { await page.close(); }
      const mine = (await ok(k, "GET", "/api/listings?mine=1")) as any[];
      const copy = mine.find((x) => (x.title ?? x.name ?? "").includes(L.title) && x.id !== L.id);
      truthy(copy, "copy listing exists");
      eq(copy.status, "draft", "copy is a draft"); eq((copy.discounts ?? []).length, 1, "discount copied");
      const orig = mine.find((x) => x.id === L.id); eq(orig.status, "live", "original unchanged");
      return { note: `UI Duplicate -> "${copy.title ?? copy.name}" status ${copy.status}, discounts copied; original still live`, shot: async () => `e2e/review/shots/prov/LT-026${kind === "co" ? "" : "." + kind}.png` };
    });
    await check("LT-027", kind, async () => {
      const L = await mkListing(k, `LT arch ${kind} ${stamp}`);
      const bk = await bookOk("p1", L, [{ child: kid(), pass: "1 day" }]);
      const ctx = await getCtx(kind); const page = await ctx.newPage();
      try {
        await page.goto(`${WEB_URL}${listingsPage(kind)}`, { waitUntil: "load" });
        const card = cardWith(page, L.title); await card.waitFor({ timeout: 30_000 });
        await card.getByRole("button", { name: "⋯" }).click();
        await page.getByRole("button", { name: /^Archive/i }).click();
        await page.waitForTimeout(2_500);
        await page.screenshot({ path: path.join(SHOTS, `LT-027${kind === "co" ? "" : "." + kind}.png`), fullPage: true });
      } finally { await page.close(); }
      const doc = await ok(k, "GET", `/api/listings/${L.id}`); eq(doc.archived, true, "archived flag");
      truthy(!(await feed()).some((x) => x.id === L.id), "gone from parent browse feed");
      const del = await call(k, "DELETE", `/api/listings/${L.id}`); eq(del.status, 409, "delete refused: " + JSON.stringify(del.json));
      const still = (await ok(k, "GET", "/api/bookings")).find((b: any) => b.ref === bk.b.ref); truthy(still, "booking remains");
      await ok(k, "PUT", `/api/listings/${L.id}`, { archived: false });
      return { note: `archived via UI; hidden from feed; DELETE -> 409 "${del.json?.error}"; booking ${bk.b.ref} remains; unarchive ok`, shot: async () => `e2e/review/shots/prov/LT-027${kind === "co" ? "" : "." + kind}.png` };
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// FD: finance / dashboard figures (per operator kind)
// ═══════════════════════════════════════════════════════════════════════════
const dash = async (k: string) => (await ok(k, "GET", "/api/dashboard")) as { bookings: { live: number; waitlist: number }; money: { takenThisWeek: number; outstanding: number } };
const allBookings = async (k: string) => (await ok(k, "GET", "/api/bookings")) as any[];
const dashPage = (kind: Kind) => `/${PORTAL[kind]}/dashboard`;
const payRec = (k: string, ref: string, amount: number) => ok(k, "POST", `/api/bookings/${ref}/record-payment`, { amount, method: "Bank transfer", reference: `FD${stamp}${ref}` });

for (const kind of DI_KINDS) {
  T(`FD finance figures as ${kind}`, async () => {
    test.setTimeout(3_000_000);
    const k = kind;
    const base = await mkListing(k, `FD base ${kind} ${stamp}`);
    await check("FD-002", kind, async () => {
      const d0 = await dash(k);
      const r = await bookOk("p1", base, [{ child: kid(), pass: "3 days" }]);
      const d1 = await dash(k);
      eq(r.b.pay, "Unpaid", "pay status"); eq(d1.money.outstanding - d0.money.outstanding, 54, "outstanding +54");
      eq(d1.money.takenThisWeek, d0.money.takenThisWeek, "income unchanged");
      return { note: `unpaid £54 booking ${r.b.ref}: outstanding ${d0.money.outstanding}->${d1.money.outstanding}, taken-this-week stays ${d1.money.takenThisWeek}`, shot: () => shot(kind, dashPage(kind), "FD-002") };
    });
    await check("FD-003", kind, async () => {
      const L = await mkListing(k, `FD disc ${kind} ${stamp}`, { discounts: [rule({ kind: "person", method: "subtract", value: 5 })] });
      const d0 = await dash(k);
      const r = await bookOk("p1", L, [{ child: kid(), pass: "3 days" }, { child: kid(), pass: "3 days" }]);
      const d1 = await dash(k);
      eq(r.amount, 98, "booking 98"); eq(d1.money.outstanding - d0.money.outstanding, 98, "outstanding uses discounted total");
      const row = (await allBookings(k)).find((b) => b.ref === r.b.ref); eq(row.amount, 98, "list amount"); eq(row.listPrice, 108, "list price before discount");
      return { note: `booking ${r.b.ref}: list £108, discount £10, total £98 in bookings list and dashboard outstanding (+98)`, shot: () => shot(kind, dashPage(kind), "FD-003") };
    });
    await check("FD-004", kind, async () => {
      const C = `FDC${stamp}`.toUpperCase();
      await mkCode(k, { code: C, type: "amount", value: 5 });
      await bookOk("p1", base, [{ child: kid(), pass: "1 day" }], { discountCodes: [C] });
      await bookOk("p2", base, [{ child: kid(), pass: "1 day" }], { discountCodes: [C] });
      const used = (await codeList(k)).find((c) => c.code === C).usedCount;
      const n = (await allBookings(k)).filter((b) => (b.discountCodes ?? []).includes(C) && b.status !== "Cancelled").length;
      eq(used, 2, "usedCount"); eq(n, 2, "bookings using code");
      return { note: `code ${C}: usedCount ${used} = ${n} live bookings carrying it`, shot: () => shot(kind, `/${PORTAL[kind]}/marketing`, "FD-004", [C]) };
    });
    await check("FD-012", kind, async () => {
      const L = await mkListing(k, `FD wait ${kind} ${stamp}`, { maxAttendees: 1 });
      const one = () => [{ child: kid(), pass: "1 day" as const, dates: [sd(0, 0)] }];
      await bookOk("p1", L, one());
      const d0 = await dash(k);
      const w = await bookOk("p2", L, one());
      eq(w.b.status, "Waitlisted", "second is waitlisted");
      const d1 = await dash(k);
      eq(d1.money.outstanding, d0.money.outstanding, "waitlisted adds no outstanding"); eq(d1.money.takenThisWeek, d0.money.takenThisWeek, "no income");
      return { note: `waitlisted booking ${w.b.ref} (amount ${w.b.amount}): outstanding unchanged ${d1.money.outstanding}, taken ${d1.money.takenThisWeek}; dashboard waitlist ${d0.bookings.waitlist}->${d1.bookings.waitlist}`, shot: () => shot(kind, bookingsPage(kind), "FD-012", [w.b.ref]) };
    });
    await check("FD-013", kind, async () => {
      const L = await mkListing(k, `FD decl ${kind} ${stamp}`, { approval: true });
      const r = await bookOk("p1", L, [{ child: kid(), pass: "3 days" }]);
      eq(r.b.status, "Approval needed", "needs approval");
      const d0 = await dash(k);
      await ok(k, "POST", `/api/bookings/${r.b.ref}/actions`, { type: "decline", reason: "test" });
      const d1 = await dash(k);
      const row = (await allBookings(k)).find((b) => b.ref === r.b.ref); eq(row.status, "Declined", "declined");
      eq(Math.round((d0.money.outstanding - d1.money.outstanding) * 100) / 100 >= 0, true, "outstanding does not rise");
      eq(d1.money.takenThisWeek, d0.money.takenThisWeek, "no income");
      return { note: `declined ${r.b.ref}: outstanding ${d0.money.outstanding}->${d1.money.outstanding}, taken ${d1.money.takenThisWeek}`, shot: () => shot(kind, bookingsPage(kind), "FD-013", [r.b.ref]) };
    });
    await check("FD-015", kind, async () => {
      const d0 = await dash(k);
      const note = `Grant ${stamp}`;
      await ok(k, "POST", "/api/income", { date: ukToday, category: "Grant", amount: 100, source: note });
      const list = ((await ok(k, "GET", "/api/income")) as any).items as any[];
      truthy(list.some((x) => x.source === note && x.amount === 100), "manual entry listed");
      const d1 = await dash(k); eq(d1.money.takenThisWeek, d0.money.takenThisWeek, "booking income figure unaffected by manual entry");
      return { note: `manual income £100 listed separately (source "${note}"); booking 'taken this week' unchanged ${d1.money.takenThisWeek}`, shot: () => shot(kind, `/${PORTAL[kind]}/finance`, "FD-015") };
    });
    await check("FD-016", kind, async () => {
      const d = await dash(k); const bs = await allBookings(k);
      const live = bs.filter((b) => b.status !== "Cancelled" && b.status !== "Declined" && b.status !== "Waitlisted").length;
      const liveInclWait = bs.filter((b) => b.status !== "Cancelled" && b.status !== "Declined").length;
      const matches = d.bookings.live === live || d.bookings.live === liveInclWait;
      eq(matches, true, `dashboard live=${d.bookings.live} vs list live=${live} (incl waitlist ${liveInclWait})`);
      return { note: `dashboard bookings.live ${d.bookings.live} equals Bookings list (excluding cancelled/declined${d.bookings.live === liveInclWait && live !== liveInclWait ? ", including waitlisted" : ""}: ${d.bookings.live === live ? live : liveInclWait}); total list rows ${bs.length}`, shot: () => shot(kind, dashPage(kind), "FD-016") };
    });
    await check("FD-030", kind, async () => {
      const L = await mkListing(k, `FD taken ${kind} ${stamp}`);
      const d0 = await dash(k);
      const r = await bookOk("p1", L, [{ child: kid(), pass: "1 day" }]);
      await payRec(k, r.b.ref, 20);
      const d1 = await dash(k); eq(d1.money.takenThisWeek - d0.money.takenThisWeek, 20, "taken +20 after payment");
      const cx = await call(k, "POST", `/api/bookings/${r.b.ref}/actions`, { type: "cancel", refund: "full", reason: "FD test" });
      eq(cx.status < 300, true, "cancel+refund: " + JSON.stringify(cx.json).slice(0, 200));
      const dPend = await dash(k);
      const ap = await call(k, "POST", `/api/bookings/${r.b.ref}/actions`, { type: "refund-approve" });
      eq(ap.status < 300, true, "refund-approve: " + JSON.stringify(ap.json).slice(0, 200));
      const d2 = await dash(k);
      eq(d2.money.takenThisWeek, d0.money.takenThisWeek, "taken back to start once the refund is paid");
      return { note: `taken this week ${d0.money.takenThisWeek} -> ${d1.money.takenThisWeek} (paid £20) -> ${dPend.money.takenThisWeek} (cancelled, refund pending) -> ${d2.money.takenThisWeek} (refund paid); booking ${r.b.ref}`, shot: () => shot(kind, dashPage(kind), "FD-030") };
    });
    await check("FD-031", kind, async () => {
      const L = await mkListing(k, `FD pend ${kind} ${stamp}`);
      const r = await bookOk("p1", L, [{ child: kid(), pass: "1 day" }]);
      await payRec(k, r.b.ref, 20);
      const cx = await call(k, "POST", `/api/bookings/${r.b.ref}/actions`, { type: "cancel", refund: "full", reason: "We cancelled it" });
      eq(cx.status < 300, true, "cancel: " + JSON.stringify(cx.json).slice(0, 200));
      const pend = (await allBookings(k)).find((b) => b.ref === r.b.ref);
      eq(pend.pay, "Refund pending", "until refund is paid");
      eq(pend.cancel?.amount, 20, "refund = 100% of amount paid");
      const ap = await call(k, "POST", `/api/bookings/${r.b.ref}/actions`, { type: "refund-approve" });
      eq(ap.status < 300, true, "refund-approve: " + JSON.stringify(ap.json).slice(0, 200));
      const done = (await allBookings(k)).find((b) => b.ref === r.b.ref);
      eq(done.pay, "Refunded", "after refund paid");
      return { note: `provider cancel on paid £20 ${r.b.ref}: pay "${pend.pay}" (refund £${pend.cancel.amount}) -> after refund-approve pay "${done.pay}"`, shot: () => shot(kind, bookingsPage(kind), "FD-031", [r.b.ref]) };
    });
    await check("FD-006", kind, async () => {
      const L = await mkListing(k, `FD refunded ${kind} ${stamp}`);
      const d0 = await dash(k);
      const r = await bookOk("p1", L, [{ child: kid(), pass: "3 days" }]);
      await payRec(k, r.b.ref, 54);
      const d1 = await dash(k); eq(d1.money.takenThisWeek - d0.money.takenThisWeek, 54, "+54");
      await ok(k, "POST", `/api/bookings/${r.b.ref}/actions`, { type: "cancel", refund: "full", reason: "FD-006" });
      await ok(k, "POST", `/api/bookings/${r.b.ref}/actions`, { type: "refund-approve" });
      const row = (await allBookings(k)).find((b) => b.ref === r.b.ref); eq(row.pay, "Refunded", "pay Refunded");
      const d2 = await dash(k); eq(d2.money.takenThisWeek, d0.money.takenThisWeek, "money in -54");
      return { note: `£54 paid then refunded in full: taken ${d0.money.takenThisWeek} -> ${d1.money.takenThisWeek} -> ${d2.money.takenThisWeek}; pay "${row.pay}" (${r.b.ref})`, shot: () => shot(kind, bookingsPage(kind), "FD-006", [r.b.ref]) };
    });
    await check("FD-007", kind, async () => {
      const L = await mkListing(k, `FD partial ${kind} ${stamp}`);
      const d0 = await dash(k);
      const r = await bookOk("p1", L, [{ child: kid(), pass: "3 days" }]);
      await payRec(k, r.b.ref, 54);
      await ok(k, "POST", `/api/bookings/${r.b.ref}/actions`, { type: "cancel", refund: "partial", amount: 20, reason: "FD-007" });
      await ok(k, "POST", `/api/bookings/${r.b.ref}/actions`, { type: "refund-approve" });
      const row = (await allBookings(k)).find((b) => b.ref === r.b.ref);
      const d2 = await dash(k); eq(d2.money.takenThisWeek - d0.money.takenThisWeek, 34, "net £34");
      return { note: `£54 paid, £20 refunded: net taken ${d2.money.takenThisWeek - d0.money.takenThisWeek}; pay "${row.pay}" (${r.b.ref})`, shot: () => shot(kind, bookingsPage(kind), "FD-007", [r.b.ref]) };
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Wallet + memberships (DI-035/036/042, FD-005/028)
// ═══════════════════════════════════════════════════════════════════════════
for (const kind of DI_KINDS) {
  T(`WALLET memberships as ${kind}`, async () => {
    test.setTimeout(3_000_000);
    const k = kind; const pk = `pw${kind}`;
    await signupParent(pk);
    const tid = A[k].tenantId!;
    const lib = (await call(k, "GET", "/api/library")).json ?? {};
    await ok(k, "PUT", "/api/library", { settings: { ...(lib.settings ?? {}), marketplaceListed: true, memberships: { enabled: true, tiers: [
      { id: "gold", name: "Gold", enabled: true, priceMonthly: 40, benefitType: "credit", benefitValue: 50 },
      { id: "perk", name: "Perk15", enabled: true, priceMonthly: 10, benefitType: "percent", benefitValue: 15 },
    ] } } });
    const L = await mkListing(k, `WAL camp ${kind} ${stamp}`);
    const wallet = async () => { const w = await ok(pk, "GET", "/api/my/wallet"); const rows = (w.balances ?? w) as any[]; const r = rows.find((x) => (x.tenantId ?? x.id) === tid); return { bal: (r?.balance ?? r?.amount ?? 0) as number, raw: JSON.stringify(w).slice(0, 200) }; };
    const first = await bookOk(pk, L, [{ child: kid(), pass: "1 day" }]); // makes the family a customer of this provider
    let noWallet = false;
    const needWallet = () => { if (noWallet) throw new Error("net::SKIP prerequisite: franchise memberships unavailable (see DI-036)"); };
    await check("DI-036", kind, async () => {
      const j = await call(pk, "POST", "/api/my/memberships/join", { tenantId: tid, tierId: "gold" });
      if (j.status === 400) noWallet = true;
      eq(j.status, 200, "join: " + JSON.stringify(j.json)); eq(j.json.creditAdded, true, "credit added");
      const w = await wallet(); eq(w.bal, 50, "wallet £50 " + w.raw);
      return { note: `joined Gold (credit tier £50): wallet balance ${w.bal}, creditAdded ${j.json.creditAdded}`, shot: () => shot(kind, `/${PORTAL[kind]}/dashboard`, "DI-036") };
    });
    await check("FD-028", kind, async () => {
      needWallet();
      const o = await ok(k, "GET", "/api/wallet/summary"); truthy(o.outstanding >= 50, "wallet liability includes the £50: " + JSON.stringify(o));
      return { note: `/api/wallet/summary outstanding ${o.outstanding} (includes membership credit £50)`, shot: () => shot(kind, `/${PORTAL[kind]}/dashboard`, "FD-028") };
    });
    await check("FD-005", kind, async () => {
      needWallet();
      const L2 = await mkListing(k, `WAL spend ${kind} ${stamp}`);
      const d0 = await dash(k); const o0 = (await ok(k, "GET", "/api/wallet/summary")).outstanding as number; const w0 = (await wallet()).bal;
      const r = await bookOk(pk, L2, [{ child: kid(), pass: "1 day" }]);
      eq(r.b.walletApplied, 20, "walletApplied"); eq(r.b.amount, 0, "nothing due"); eq(r.b.pay, "Funded", "Funded");
      const d1 = await dash(k); const o1 = (await ok(k, "GET", "/api/wallet/summary")).outstanding as number; const w1 = (await wallet()).bal;
      eq(w1, w0 - 20, "wallet down 20"); eq(Math.round((o0 - o1) * 100) / 100, 20, "liability down 20"); eq(d1.money.takenThisWeek, d0.money.takenThisWeek, "no cash income"); eq(d1.money.outstanding, d0.money.outstanding, "nothing owed");
      return { note: `wallet-paid £20 ${r.b.ref}: walletApplied 20, pay ${r.b.pay}; wallet ${w0}->${w1}; liability ${o0}->${o1}; taken-this-week unchanged ${d1.money.takenThisWeek}`, shot: () => shot(kind, bookingsPage(kind), "FD-005", [r.b.ref]) };
    });
    await check("DI-042", kind, async () => {
      needWallet();
      const L3 = await mkListing(k, `WAL obo ${kind} ${stamp}`);
      const w0 = (await wallet()).bal; truthy(w0 > 0, "parent still has wallet credit");
      const r = await call(k, "POST", "/api/my/bookings", { listingId: L3.id, blockId: L3.blockId, method: "Cash", items: items([{ child: kid(), pass: "1 day" }]), onBehalfOf: { name: "Wallet Fam", email: A[pk].email } });
      eq(r.status < 300, true, "obo booking: " + JSON.stringify(r.json).slice(0, 200));
      const b = r.json.bookings[0]; eq(b.walletApplied ?? 0, 0, "no wallet used"); eq(b.amount, 20, "full amount due");
      const w1 = (await wallet()).bal; eq(w1, w0, "wallet untouched");
      return { note: `provider-booked ${b.ref} for the family: amount ${b.amount}, walletApplied ${b.walletApplied ?? 0}; wallet stays ${w1}`, shot: () => shot(kind, bookingsPage(kind), "DI-042", [b.ref]) };
    });
    await check("DI-035", kind, async () => {
      const j = await call(pk, "POST", "/api/my/memberships/join", { tenantId: tid, tierId: "perk" });
      eq(j.status, 200, "join perk: " + JSON.stringify(j.json));
      const cp = ((await ok(pk, "GET", "/api/my/coupons")) as any[]).find((c) => c.membership && c.tenantId === tid); truthy(cp, "member code listed (membership:true)");
      const L4 = await mkListing(k, `WAL perk ${kind} ${stamp}`);
      const w0 = (await wallet()).bal;
      const r = await bookOk(pk, L4, [{ child: kid(), pass: "5 days" }], { discountCodes: [cp.code], walletCap: 0 });
      eq(r.amount, 76.5, "90 - 15%"); eq(w0, (await wallet()).bal, "wallet untouched (walletCap 0)");
      const codes = await codeList(k); const mc = codes.find((c) => c.code === cp.code); truthy(mc?.membership && mc.assignedTo === A[pk].email.toLowerCase(), "member code doc");
      return { note: `member code ${cp.code} (15% perk, assigned to member): 5 days -> ${r.amount}`, shot: () => shot(kind, bookingsPage(kind), "DI-035", [r.b.ref]) };
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Staff, franchise, head office
// ═══════════════════════════════════════════════════════════════════════════
T("ST staff checks", async () => {
  test.setTimeout(300_000);
  const L = await mkListing("co", `ST camp ${stamp}`);
  const b = await bookOk("p1", L, [{ child: kid(), pass: "3 days" }]);
  await check("LT-030", "st", async () => {
    const post = await call("st", "POST", "/api/listings", { title: "Staff attempt", name: "Staff attempt" });
    truthy(post.status === 403 || post.status === 401, `POST /api/listings as staff -> ${post.status} ${JSON.stringify(post.json)}`);
    const put = await call("st", "PUT", `/api/listings/${L.id}`, { showSpaces: false });
    truthy(put.status === 403 || put.status === 404, `PUT listing as staff -> ${put.status}`);
    const disc = await call("st", "POST", "/api/discounts", { code: "STAFFX", type: "amount", value: 1, active: true });
    truthy(disc.status === 403, `POST discount as staff -> ${disc.status}`);
    const bw = await call("st", "POST", `/api/bookings/${b.b.ref}/actions`, { type: "decline" });
    truthy(bw.status === 403, `booking write as staff -> ${bw.status}`);
    return { note: `staff: POST /api/listings ${post.status}, PUT listing ${put.status}, POST discount ${disc.status}, booking action ${bw.status}`, shot: () => shot("st", "/staff/dash", "LT-030") };
  });
  await check("FD-026", "st", async () => {
    const rows = (await ok("st", "GET", "/api/bookings")) as any[];
    const mine = rows.find((r) => r.ref === b.b.ref); truthy(mine, "staff can see the booking row");
    for (const key of ["amount", "amountPaid", "pay", "method"]) eq(key in mine, false, `no ${key} for staff`);
    const inc = await call("st", "GET", "/api/income"); truthy(inc.status === 403, `income as staff -> ${inc.status}`);
    const sf = await call("st", "GET", "/api/splitfees"); truthy(sf.status >= 400, `splitfees as staff -> ${sf.status}`);
    const nav = await (await getCtx("st")).newPage(); await nav.goto(`${WEB_URL}/staff/dash`, { waitUntil: "load" }); await nav.waitForTimeout(2000);
    const text = await nav.locator("body").innerText(); await nav.close();
    eq(/Money in|Finance|Invoices|Reconciliation|Split fees/i.test(text), false, "no finance menu text in staff portal");
    return { note: "staff booking rows carry no amount/pay/method; /api/income 403; /api/splitfees " + sf.status + "; staff portal shows no finance menus", shot: () => shot("st", "/staff/dash", "FD-026") };
  });
});

T("FR franchise + head office", async () => {
  test.setTimeout(3_000_000);
  const hoL = await mkListing("ho", `HO camp ${stamp}`);
  const frL = await mkListing("frA", `FR camp ${stamp}`);
  const fr2L = await mkListing("frB", `FR2 camp ${stamp}`);

  await check("LT-031", "fr", async () => {
    const mine = (await ok("frA", "GET", "/api/listings?mine=1")) as any[];
    truthy(mine.some((l) => l.id === frL.id), "franchise sees own listing");
    eq(mine.some((l) => l.id === hoL.id || l.id === fr2L.id), false, "no head-office or sibling listing");
    const doc = await ok("frA", "GET", `/api/listings/${frL.id}`);
    truthy(doc.franchiseId, "franchiseId stamped"); eq(doc.franchiseId, A.frA.franchiseId ?? doc.franchiseId, "franchiseId matches account");
    const pub = (await feed()).find((l) => l.id === frL.id); truthy(pub, "listing live on public feed");
    return { note: `franchise listing ${frL.id} franchiseId ${doc.franchiseId}; own list has ${mine.length} listing(s), none of HO/sibling; on public feed`, shot: () => shot("fa", listingsPage("fr"), "LT-031", [frL.title]) };
  });
  await check("LT-032", "ho", async () => {
    const mine = (await ok("ho", "GET", "/api/listings?mine=1")) as any[];
    for (const l of [hoL, frL, fr2L]) truthy(mine.some((x) => x.id === l.id), `HO sees ${l.title}`);
    const frMine = (await ok("frA", "GET", "/api/listings?mine=1")) as any[];
    eq(frMine.length, 1, "franchise sees only its own");
    return { note: `HO list returns ${mine.length} listings (own + both franchises, franchiseId on each: ${mine.map((l) => l.franchiseId ? "F" : "HO").join(",")}); franchise returns ${frMine.length}`, shot: () => shot("ho", listingsPage("ho"), "LT-032", [hoL.title]) };
  });
  await check("LT-033", "ho", async () => {
    const g1 = await call("frA", "GET", `/api/listings/${hoL.id}`); // live+public so readable; check write
    const w1 = await call("frA", "PUT", `/api/listings/${hoL.id}`, { showSpaces: false });
    const w2 = await call("frA", "PUT", `/api/listings/${fr2L.id}`, { showSpaces: false });
    truthy([403, 404].includes(w1.status), `franchise PUT HO listing -> ${w1.status}`); truthy([403, 404].includes(w2.status), `franchise PUT sibling listing -> ${w2.status}`);
    const hoEdit = await call("ho", "PUT", `/api/listings/${frL.id}`, { showSpaces: true });
    const dh = await ok("ho", "GET", "/api/listings?mine=1");
    const frList = (await ok("frA", "GET", "/api/listings?mine=1")) as any[];
    eq(frList.some((l) => l.id === hoL.id), false, "HO listing not pushed to franchise");
    return { note: `franchise cannot edit HO listing (${w1.status}) or sibling's (${w2.status}); no HO->franchise push (franchise list has ${frList.length}); HO edit of franchise listing -> ${hoEdit.status}`, shot: () => shot("fa", listingsPage("fr"), "LT-033", [frL.title]) };
  });
  await check("DI-026", "fr", async () => {
    const C = `FRC${stamp}`.toUpperCase();
    await mkCode("frA", { code: C, type: "amount", value: 5 });
    const own = await bookOk("p1", frL, [{ child: kid(), pass: "5 days" }], { discountCodes: [C] }); eq(own.amount, 85, "works on franchise listing");
    const onHo = await book("p1", hoL, [{ child: kid(), pass: "5 days" }], { discountCodes: [C] });
    eq(onHo.status, 400, "refused on HO listing"); truthy(/doesn.t apply/.test(JSON.stringify(onHo.json)), JSON.stringify(onHo.json));
    const onSib = await book("p1", fr2L, [{ child: kid(), pass: "5 days" }], { discountCodes: [C] });
    eq(onSib.status, 400, "refused on sibling listing");
    return { note: `franchise code: own listing ${own.amount}; HO listing "${onHo.json?.error}"; sibling listing ${onSib.status}`, shot: () => shot("fa", `/franchise/marketing`, "DI-026", [C]) };
  });
  await check("DI-026", "ho", async () => {
    const C = `FRH${stamp}`.toUpperCase();
    await mkCode("frA", { code: C, type: "amount", value: 5 });
    const vis = (await codeList("ho")).some((c) => c.code === C); truthy(vis, "HO sees franchise code in its codes list");
    const onHo = await book("p2", hoL, [{ child: kid(), pass: "5 days" }], { discountCodes: [C] });
    eq(onHo.status, 400, "franchise code refused on HO listing");
    const HC = `HOC${stamp}`.toUpperCase(); await mkCode("ho", { code: HC, type: "amount", value: 5 });
    const net = await bookOk("p2", frL, [{ child: kid(), pass: "5 days" }], { discountCodes: [HC] }); eq(net.amount, 85, "HO own code works network-wide");
    return { note: `HO: franchise code refused on HO listing ("${onHo.json?.error}"); HO's own code works on franchise listing (${net.amount})`, shot: () => shot("ho", `/company/marketing`, "DI-026", [C]) };
  });

  // money: fr gets 20+54+90 = 164, fr2 54, HO direct 54
  const b1 = await bookOk("p1", frL, [{ child: kid(), pass: "1 day", week: 1 }]);
  const b2 = await bookOk("p1", frL, [{ child: kid(), pass: "3 days", week: 1 }]);
  const b3 = await bookOk("p1", frL, [{ child: kid(), pass: "5 days", week: 2 }]);
  const f2 = await bookOk("p2", fr2L, [{ child: kid(), pass: "3 days" }]);
  const dr = await bookOk("p2", hoL, [{ child: kid(), pass: "3 days", week: 1 }]);
  await check("FD-019", "fr", async () => {
    const rows = (await allBookings("frA")) as any[];
    const refs = rows.map((r) => r.ref);
    truthy(refs.includes(b1.b.ref) && refs.includes(b3.b.ref), "own bookings listed");
    eq(refs.includes(f2.b.ref) || refs.includes(dr.b.ref), false, "no sibling / HO-direct booking visible");
    const sf = await ok("frA", "GET", "/api/splitfees/mine");
    eq(sf.revenue >= 164, true, "mine.revenue includes own " + JSON.stringify(sf));
    const d = await dash("frA");
    const hoAll = await allBookings("ho");
    truthy(hoAll.length > rows.length, "HO sees more than the franchise");
    return { note: `franchise sees ${rows.length} bookings (all its own); /splitfees/mine revenue ${sf.revenue}, count ${sf.count}; dashboard live ${d.bookings.live}; HO sees ${hoAll.length}`, shot: () => shot("fa", "/franchise/bookings", "FD-019", [b1.b.ref]) };
  });
  const sfGet = async () => (await ok("ho", "GET", "/api/splitfees")) as any;
  const rowOf = (sf: any, name: string) => sf.franchises.find((f: any) => f.name.includes(name));
  const COUNTS = (st: string) => st !== "Cancelled" && st !== "Declined" && st !== "Waitlisted";
  const expectFor = async (key: string) => {
    const rows = (await allBookings(key)).filter((r) => COUNTS(r.status) && (key !== "ho" || !r.franchiseId));
    return { count: rows.length, revenue: Math.round(rows.reduce((t, r) => t + (r.amount ?? 0), 0) * 100) / 100, collected: Math.round(rows.reduce((t, r) => t + (r.amountPaid ?? (r.pay === "Paid" ? r.amount ?? 0 : 0)), 0) * 100) / 100 };
  };
  await check("FD-020", "ho", async () => {
    await ok("ho", "PUT", "/api/splitfees/settings", { basis: "revenue", rate: 10 });
    const sf = await sfGet(); const a = rowOf(sf, "Prov FrA"), b = rowOf(sf, "Prov FrB");
    const ea = await expectFor("frA"), eb = await expectFor("frB");
    eq(a.revenue, ea.revenue, "FrA revenue = sum of its bookings"); eq(a.fee, Math.round(ea.revenue * 10) / 100, "FrA royalty 10%");
    eq(b.revenue, eb.revenue, "FrB revenue"); eq(b.fee, Math.round(eb.revenue * 10) / 100, "FrB royalty 10%");
    return { note: `10% revenue basis: FrA ${ea.count} bookings, revenue ${a.revenue} (= sum of bookings), royalty ${a.fee}; FrB revenue ${b.revenue} royalty ${b.fee}`, shot: () => shot("ho", "/company/splitfees", "FD-020", ["Prov FrA"]) };
  });
  await check("FD-021", "ho", async () => {
    await ok("ho", "PUT", "/api/splitfees/settings", { basis: "perBooking", perBookingFee: 2 });
    const sf = await sfGet(); const a = rowOf(sf, "Prov FrA"); const ea = await expectFor("frA");
    eq(a.count, ea.count, "count"); eq(a.fee, ea.count * 2, "count x £2");
    return { note: `per-booking £2: FrA count ${a.count} fee ${a.fee} (= ${ea.count} x £2)`, shot: () => shot("ho", "/company/splitfees", "FD-021", ["Prov FrA"]) };
  });
  await ok("ho", "PUT", "/api/splitfees/settings", { basis: "revenue", rate: 10 });
  await check("FD-022", "ho", async () => {
    const before = rowOf(await sfGet(), "Prov FrA");
    await payRec("frA", b2.b.ref, 54);
    const a = rowOf(await sfGet(), "Prov FrA"); const ea = await expectFor("frA");
    eq(a.revenue, ea.revenue, "revenue includes unpaid"); eq(a.collected - before.collected, 54, "collected rises by the £54 paid only");
    truthy(a.collected < a.revenue, "collected below revenue while some bookings are unpaid");
    return { note: `FrA revenue ${a.revenue} (incl. unpaid) vs collected ${before.collected}->${a.collected} after recording £54 on ${b2.b.ref}`, shot: () => shot("ho", "/company/splitfees", "FD-022", ["Prov FrA"]) };
  });
  await check("FD-023", "ho", async () => {
    const sf = await sfGet();
    const ed = await expectFor("ho");
    eq(sf.direct.revenue, ed.revenue, "direct revenue = HO's own bookings " + JSON.stringify(sf.direct));
    truthy(ed.revenue >= 54, "HO direct booking present");
    for (const m of sf.series) { const h = m.byFranchise?.["__ho__"]; if (h) eq(h.fee, 0, "HO direct fee 0"); }
    const expTotal = Math.round(((await expectFor("frA")).revenue + (await expectFor("frB")).revenue + (await expectFor("fr")).revenue) * 100) / 100;
    eq(sf.totals.revenue, expTotal, "totals.revenue = franchises only (direct excluded)");
    return { note: `direct: count ${sf.direct.count} revenue ${sf.direct.revenue} (HO booking ${dr.b.ref}) with no royalty; totals.revenue ${sf.totals.revenue} fee ${sf.totals.fee} exclude direct`, shot: () => shot("ho", "/company/splitfees", "FD-023") };
  });
  await check("FD-024", "ho", async () => {
    const fl = (await ok("ho", "GET", "/api/franchises")) as any;
    const arr = Array.isArray(fl) ? fl : (fl.franchises ?? []);
    truthy(arr.length >= 2, "two franchises listed: " + JSON.stringify(fl).slice(0, 200));
    const ov = await call("ho", "GET", "/api/ho/overview");
    eq(ov.status, 200, "HO overview loads " + JSON.stringify(ov.json).slice(0, 120));
    return { note: `/api/franchises lists ${arr.length}; /api/ho/overview 200`, shot: () => shot("ho", "/company/franchise-overview", "FD-024") };
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Final pass: re-take every recorded screenshot against the current screens (deterministic file names).
// ═══════════════════════════════════════════════════════════════════════════
T("SHOTS replay pending screenshots", async () => {
  test.setTimeout(3_000_000);
  const all = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8")) as Res[];
  const order: Kind[] = ["co", "fr", "fl", "ho", "st", "fa"];
  const byId = new Map<string, Res[]>();
  for (const r of all) if (!r.skipped && r.spec?.email && (!ONLY || ONLY.includes(r.id))) byId.set(r.id, [...(byId.get(r.id) ?? []), r]);
  const jobs: { r: Res; name: string }[] = [];
  for (const [id, rs] of byId) {
    rs.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    rs.forEach((r, i) => jobs.push({ r, name: i === 0 ? `${id}.png` : `${id}.${r.kind}.png` }));
  }
  if (!theBrowser || !theBrowser.isConnected()) theBrowser = await chromium.launch();
  const logged = new Map<string, BrowserContext>();
  for (const j of jobs) {
    const sp = j.r.spec!;
    if (logged.has(sp.email!)) continue;
    try { await uiLogin(theBrowser, sp.kind, sp.email!, sp.home!); logged.set(sp.email!, ctxs[sp.kind]!); } catch (e) { console.log("LOGIN FAIL", sp.email, (e as Error).message.slice(0, 80)); }
  }
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const j = jobs[next++]; const sp = j.r.spec!; const ctx = logged.get(sp.email!);
      if (!ctx) continue;
      try {
        const page = await ctx.newPage();
        try {
          await page.goto(`${WEB_URL}${sp.url}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
          if (sp.anchors.length) await cardWith(page, ...sp.anchors).waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
          else await page.waitForTimeout(3500);
          await page.waitForTimeout(800);
          await page.screenshot({ path: path.join(SHOTS, j.name), fullPage: true });
          j.r.shot = path.relative(ROOT, path.join(SHOTS, j.name));
          console.log("REPLAYED", j.name);
        } finally { await page.close(); }
      } catch (e) { console.log("REPLAY FAIL", j.name, (e as Error).message.slice(0, 100)); }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(all, null, 2));
});
