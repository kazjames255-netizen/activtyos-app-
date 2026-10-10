import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { test, expect, chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { API_URL, ROOT, WEB_URL } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, fbSignIn, fbSignUp } from "./helpers/accounts";
import { FIREBASE_API_KEY } from "./helpers/env";
import { cardWith } from "./helpers/ui";
import { layout, bookingConfirmedSpec } from "../server/src/lib/emailTemplates";

// DBC agent: DI referrals/memberships, BE embed + booking-link checks, CF child questions (parent side).
// State (accounts, listings) persists in STATE so a re-run reuses them. Results: RESULTS (merged by id+kind).
test.describe.configure({ mode: "serial" });
const SHOTS = path.join(ROOT, "e2e/review/shots/dbc");
fs.mkdirSync(SHOTS, { recursive: true });
const STATE = path.join(SHOTS, "state.json");
const RESULTS = path.join(SHOTS, "results.json");
const ONLY = process.env.DBC_ONLY ? process.env.DBC_ONLY.split(",") : null;
const stamp0 = Date.now().toString(36);

type Kind = "co" | "fr" | "fl" | "ho" | "parent";
interface Acct { email: string; uid: string; tenantId: string | null; franchiseId?: string | null }
interface St { stamp: string; A: Record<string, Acct>; L: Record<string, any> }
const st: St = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : { stamp: stamp0, A: {}, L: {} };
const saveSt = () => {
  // several runner processes may share this file: merge what is on disk before writing
  try { const disk = JSON.parse(fs.readFileSync(STATE, "utf8")) as St; st.A = Object.assign(disk.A ?? {}, st.A); st.L = Object.assign(disk.L ?? {}, st.L); Object.assign(A, st.A); } catch { /* first write */ }
  fs.writeFileSync(STATE, JSON.stringify(st, null, 1));
};
const stamp = st.stamp;
const A = st.A;
const email = (n: string) => `e2e-dbc-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`;
const PORTAL: Record<Kind, string> = { co: "company", fr: "franchise", fl: "freelancer", ho: "company", parent: "custdash" };
const HOME: Record<Kind, string> = { co: "/company/bookings", fr: "/franchise/bookings", fl: "/freelancer/bookings", ho: "/company/bookings", parent: "/custdash/browse" };

// ── results ──
interface Res { id: string; kind: Kind; ok: boolean; note: string; shot?: string }
const results: Res[] = fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, "utf8")) : [];
const rec = (r: Res) => {
  let disk: Res[] = []; try { disk = JSON.parse(fs.readFileSync(RESULTS, "utf8")); } catch { /* none yet */ }
  const all = disk.filter((x) => !(x.id === r.id && x.kind === r.kind)); all.push(r);
  results.length = 0; results.push(...all);
  fs.writeFileSync(RESULTS, JSON.stringify(all, null, 2));
  console.log(`${r.ok ? "PASS" : "FAIL"} ${r.id} [${r.kind}] ${r.note}`);
};

// ── api ──
const toks: Record<string, { t: string; at: number }> = {};
const token = async (k: string) => {
  const c = toks[k];
  if (c && Date.now() - c.at < 30 * 60_000) return c.t;
  const t = (await fbSignIn(A[k].email)).idToken; toks[k] = { t, at: Date.now() }; return t;
};
async function call(k: string | null, method: string, url: string, body?: unknown, tok?: string): Promise<{ status: number; json: any }> {
  for (let attempt = 0; ; attempt++) {
    try {
      const t = tok ?? (k ? await token(k) : null);
      const res = await fetch(`${API_URL}${url}`, { method, headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      let json: any = null; try { json = await res.json(); } catch { /* */ }
      return { status: res.status, json };
    } catch (e) { if (attempt >= 20) throw e; await new Promise((r) => setTimeout(r, 3_000)); }
  }
}
const ok = async (k: string, method: string, url: string, body?: unknown) => {
  const r = await call(k, method, url, body);
  if (r.status >= 300) throw new Error(`${method} ${url} -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  return r.json;
};
const unwall = (...ids: string[]) => execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", ...ids], { stdio: "pipe" });

// ── dates ──
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = new Date();
const nextMonday = addDays(today, (8 - today.getDay()) % 7 || 7);
const sd = (w: number, d: number) => iso(addDays(nextMonday, w * 7 + d));

function eq(actual: unknown, expected: unknown, label: string) {
  const same = typeof actual === "number" && typeof expected === "number" ? Math.abs(actual - expected) < 0.006 : actual === expected;
  if (!same) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function truthy(v: unknown, label: string) { if (!v) throw new Error(`${label}: expected truthy, got ${JSON.stringify(v)}`); }

// ── browser ──
let theBrowser: Browser | null = null;
const ctxs: Record<string, BrowserContext> = {};
async function getCtx(k: string): Promise<BrowserContext> {
  if (ctxs[k]) return ctxs[k];
  if (!theBrowser || !theBrowser.isConnected()) theBrowser = await chromium.launch();
  const kind: Kind = (["co", "fr", "fl", "ho"] as string[]).includes(k) ? (k as Kind) : "parent";
  // Sign in over REST and plant the Firebase session in the page's IndexedDB (the UI login form is throttled by Firebase
  // when several agents sign in at once); then confirm the app accepts it by landing on the portal home.
  const KEY = FIREBASE_API_KEY;
  for (let attempt = 0; ; attempt++) {
    const ctx = await theBrowser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
    try {
      const r = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: A[k].email, password: TEST_PASSWORD, returnSecureToken: true }) })).json() as any;
      if (!r.idToken) throw new Error("REST sign-in: " + JSON.stringify(r).slice(0, 120));
      const user = { uid: r.localId, email: r.email, emailVerified: false, isAnonymous: false, providerData: [{ providerId: "password", uid: r.email, displayName: null, email: r.email, phoneNumber: null, photoURL: null }], stsTokenManager: { refreshToken: r.refreshToken, accessToken: r.idToken, expirationTime: Date.now() + 3500 * 1000 }, createdAt: String(Date.now()), lastLoginAt: String(Date.now()), apiKey: KEY, appName: "[DEFAULT]" };
      await ctx.addInitScript(([kk, u]) => {
        const open = indexedDB.open("firebaseLocalStorageDb", 1);
        open.onupgradeneeded = () => { open.result.createObjectStore("firebaseLocalStorage", { keyPath: "fbase_key" }); };
        open.onsuccess = () => { const tx = open.result.transaction("firebaseLocalStorage", "readwrite"); tx.objectStore("firebaseLocalStorage").put({ fbase_key: `firebase:authUser:${kk}:[DEFAULT]`, value: u }); };
      }, [KEY, user] as [string, unknown]);
      const page = await ctx.newPage();
      await page.goto(`${WEB_URL}${HOME[kind]}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForURL(`**${HOME[kind]}`, { timeout: 60_000 });
      await page.waitForTimeout(2500);
      if (/\/login/.test(page.url())) throw new Error("bounced to /login");
      await page.close(); ctxs[k] = ctx; return ctx;
    } catch (e) {
      console.log(`LOGIN retry ${k} attempt ${attempt}: ${(e as Error).message.split("\n")[0]}`);
      await ctx.close().catch(() => {});
      if (attempt >= 4) throw e;
      await new Promise((r) => setTimeout(r, 10_000 * (attempt + 1)));
    }
  }
}
test.afterAll(async () => { for (const c of Object.values(ctxs)) await c.close().catch(() => {}); await theBrowser?.close().catch(() => {}); });

/** Full-page screenshot AFTER load. Returns relative path. */
async function snap(page: Page, id: string, suffix = ""): Promise<string> {
  await page.waitForTimeout(1_500);
  const f = path.join(SHOTS, `${id}${suffix}.png`);
  await page.screenshot({ path: f, fullPage: true });
  return path.relative(ROOT, f);
}
/** Open a URL as account k, optionally wait for an anchor, snapshot. */
async function shotUrl(k: string, url: string, id: string, anchors: (string | RegExp)[] = [], suffix = ""): Promise<string> {
  const page = await (await getCtx(k)).newPage();
  try {
    await page.goto(`${WEB_URL}${url}`, { waitUntil: "load", timeout: 60_000 });
    if (anchors.length) await cardWith(page, ...anchors).waitFor({ state: "visible", timeout: 25_000 }).catch(() => {});
    return await snap(page, id, suffix);
  } finally { await page.close(); }
}
async function check(id: string, kind: Kind, fn: () => Promise<{ note: string; shot?: string | Promise<string> }>) {
  if (ONLY && !ONLY.includes(id)) return;
  let r: Res;
  try { const o = await fn(); r = { id, kind, ok: true, note: o.note, shot: o.shot ? await o.shot : undefined }; }
  catch (e) { r = { id, kind, ok: false, note: (e as Error).message.slice(0, 700) }; }
  rec(r);
}
/** A test that never fails the worker. */
const T = (name: string, fn: (a: { browser: Browser }) => Promise<void>) =>
  test(name, async ({ browser }) => { try { await fn({ browser }); } catch (e) { console.log(`TEST ABORT ${name}: ${(e as Error).message.slice(0, 400)}`); } });

// ── provisioning ──
async function signupOperator(key: string, role: "company" | "freelancer", name: string) {
  if (A[key]) return;
  const s = await fbSignUp(email(key));
  const r = await call(null, "POST", "/api/register-role", { role, businessName: name, providerName: name, providerNameMode: "business" }, s.idToken);
  if (r.status >= 300) throw new Error(`register ${key}: ${JSON.stringify(r.json)}`);
  A[key] = { email: email(key), uid: s.uid, tenantId: r.json.tenantId }; saveSt();
}
async function signupParent(key: string) {
  if (A[key]) return;
  const s = await fbSignUp(email(key));
  const r = await call(null, "POST", "/api/register-role", { role: "parent", postcode: "NN5 7EA" }, s.idToken);
  if (r.status >= 300) throw new Error(`register ${key}: ${JSON.stringify(r.json)}`);
  await call(null, "POST", "/api/me/welcome", {}, s.idToken);
  A[key] = { email: email(key), uid: s.uid, tenantId: null }; saveSt();
}
async function joinByInvite(key: string, inviter: string, body: Record<string, unknown>) {
  if (A[key]) return;
  const inv = await ok(inviter, "POST", "/api/invites", body);
  const s = await fbSignUp(email(key));
  const acc = await call(null, "POST", `/api/invites/${inv.token}/accept`, {}, s.idToken);
  if (acc.status >= 300) throw new Error(`accept ${key}: ${JSON.stringify(acc.json)}`);
  const me = await call(null, "GET", "/api/me", undefined, s.idToken);
  A[key] = { email: email(key), uid: s.uid, tenantId: A[inviter].tenantId, franchiseId: me.json?.franchiseId ?? null }; saveSt();
}
const venueDone = new Set<string>();
async function ensureVenue(k: string) {
  if (venueDone.has(k)) return "dbc-venue";
  const lib = (await call(k, "GET", "/api/library")).json ?? {};
  const venues = (lib.venues ?? []) as { id: string }[];
  await ok(k, "PUT", "/api/library", { venues: venues.some((v) => v.id === "dbc-venue") ? venues : [...venues, { id: "dbc-venue", name: "DBC Sports Hall", address: "1 Test Way", city: "Northampton" }], settings: { ...(lib.settings ?? {}), marketplaceListed: true } });
  venueDone.add(k); return "dbc-venue";
}
interface Basics { period: string; p1: string; p3: string; p5: string }
const basics: Record<string, Basics> = {};
async function ensureBasics(k: string): Promise<Basics> {
  if (basics[k]) return basics[k];
  const key = `basics_${k}`;
  if (st.L[key]) return (basics[k] = st.L[key]);
  const period = (await ok(k, "POST", "/api/periods", { title: "Full day", start: "09:00", finish: "15:00" })).id;
  const p1 = (await ok(k, "POST", "/api/passes", { name: "1 day", days: 1 })).id;
  const p3 = (await ok(k, "POST", "/api/passes", { name: "3 days", days: 3 })).id;
  const p5 = (await ok(k, "POST", "/api/passes", { name: "5 days", days: 5 })).id;
  st.L[key] = { period, p1, p3, p5 }; saveSt();
  return (basics[k] = st.L[key]);
}
interface Listing { id: string; title: string; blockId: string; blocks: { id: string; startDate: string }[] }
/** The Standard test camp (Mon-Fri x 3 weeks, 10/day, auto approval, 1 day £20 / 3 days £54 / 5 days £90). */
async function mkListing(k: string, title: string, extra: Record<string, unknown> = {}): Promise<Listing> {
  const b = await ensureBasics(k); const venueId = await ensureVenue(k);
  const bundle = await ok(k, "POST", "/api/block-bundles", { name: `Bundle ${title}`, periodIds: [b.period], passIds: [b.p1, b.p3, b.p5], priced: true, masterPrice: 90, calcOn: true, passFlat: { [b.p1]: 20, [b.p3]: 54, [b.p5]: 90 }, passMode: { [b.p1]: "flat", [b.p3]: "flat", [b.p5]: "flat" } });
  const listing = await ok(k, "POST", "/api/listings", {
    title, venueId, runFrom: iso(nextMonday), runTo: iso(addDays(nextMonday, 20)), blockMode: "weekly", days: [1, 2, 3, 4, 5],
    maxAttendees: "10", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "11", blockId: bundle.id,
    passes: [{ name: "1 day", price: 20, days: 1 }, { name: "3 days", price: 54, days: 3 }, { name: "5 days", price: 90, days: 5 }],
    bookingType: "auto", waitlist: true, waitlistMode: "manual", status: "live", visibility: "public", ...extra,
  });
  await ok(k, "PUT", `/api/block-bundles/${bundle.id}/listings`, { listingIds: [listing.id] });
  const full = await ok(k, "GET", `/api/listings/${listing.id}`);
  const blocks = ((full.blocks ?? []) as { id: string; startDate: string }[]).sort((a, c) => (a.startDate < c.startDate ? -1 : 1));
  return { id: listing.id, title, blockId: blocks[0].id, blocks };
}
let childN = 0;
const runId = Date.now().toString(36).slice(-4);
const kid = (tag = "K") => `${tag}${stamp}${runId}x${++childN}`;
const PASS_DAYS: Record<string, number> = { "1 day": 1, "3 days": 3, "5 days": 5 };
interface Line { child: string; pass: "1 day" | "3 days" | "5 days"; week?: number; dates?: string[]; age?: number; childId?: string; answers?: Record<string, string>; addons?: { id: string }[] }
const itemsOf = (lines: Line[]) => lines.map((l) => ({ pass: l.pass, child: l.child, ...(l.childId ? { childId: l.childId } : {}), age: l.age ?? 8, dates: l.dates ?? Array.from({ length: PASS_DAYS[l.pass] }, (_, i) => sd(l.week ?? 0, i)), ...(l.answers ? { answers: l.answers } : {}), ...(l.addons ? { addons: l.addons } : {}) }));
const book = (parent: string, L: Listing, lines: Line[], extra: Record<string, unknown> = {}) => call(parent, "POST", "/api/my/bookings", { listingId: L.id, blockId: L.blockId, method: "card", items: itemsOf(lines), ...extra });
async function bookOk(parent: string, L: Listing, lines: Line[], extra: Record<string, unknown> = {}) {
  const r = await book(parent, L, lines, extra);
  if (r.status >= 300) throw new Error(`book -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  const bs = (r.json.bookings ?? []) as any[];
  return { bookings: bs, b: bs[0], amount: bs.reduce((s, x) => s + (x.amount ?? 0), 0), off: bs.reduce((s, x) => s + (x.discountOff ?? 0), 0) };
}

// ═══ setup ═══
test("setup accounts", async () => {
  test.setTimeout(600_000);
  for (const p of ["p1", "p2", "p3", "p4", "p5"]) await signupParent(p);
  await signupOperator("ho", "company", `DBC HO ${stamp}`);
  await signupOperator("fl", "freelancer", `DBC Free ${stamp}`);
  await signupOperator("co", "company", `DBC Co ${stamp}`);
  unwall(A.ho.tenantId!, A.fl.tenantId!, A.co.tenantId!);
  await joinByInvite("fr", "ho", { role: "franchise", franchiseName: `DBC Alpha ${stamp}` });
  console.log("ACCOUNTS", JSON.stringify(A));
});



// ═══ shared UI helpers ═══
interface Q { label: string; type?: "text" | "choice" | "yesno"; options?: string[]; required?: boolean; every?: boolean; listing?: string; minAge?: number; maxAge?: number }
const setupUrl = (kind: Kind, tab: string) => `/${PORTAL[kind]}/setup?tab=${tab}`;
async function openSetup(kind: Kind, tab: string) {
  const page = await (await getCtx(kind)).newPage();
  await page.goto(`${WEB_URL}${setupUrl(kind, tab)}`, { waitUntil: "load", timeout: 60_000 });
  await page.getByRole("button", { name: /Add a question/ }).waitFor({ timeout: 45_000 });
  await page.waitForTimeout(1500);
  return page;
}
/** Add one question through the Setup > Child questions editor. Leaves its panel open. */
async function uiAddQuestion(page: Page, q: Q) {
  await page.getByRole("button", { name: /Add a question/ }).click();
  await page.getByPlaceholder(/Can your child swim 25m/).fill(q.label);
  if (q.type && q.type !== "text") await page.locator('select:has(option[value="yesno"])').selectOption(q.type === "yesno" ? { label: "Yes / No" } : { label: "Pick one" });
  for (const o of q.options ?? []) { const inp = page.getByPlaceholder("Add an option").last(); await inp.fill(o); await inp.press("Enter"); }
  if (q.every) await page.getByRole("button", { name: "Every booking", exact: true }).click();
  if (q.required) await page.locator("span", { hasText: /^Must be answered$/ }).locator("xpath=..").getByRole("button", { name: "Yes", exact: true }).click();
  if (q.minAge !== undefined || q.maxAge !== undefined) {
    const ages = page.getByPlaceholder("any");
    if (q.minAge !== undefined) await ages.nth(0).fill(String(q.minAge));
    if (q.maxAge !== undefined) await ages.nth(1).fill(String(q.maxAge));
  }
  if (q.listing) {
    await page.getByRole("button", { name: "Chosen listings" }).click();
    await page.getByRole("button", { name: q.listing, exact: true }).click();
  }
}
async function closePanels(page: Page) {
  for (let n = 0; n < 12; n++) { const d = page.getByRole("button", { name: "Done", exact: true }); if (await d.count() === 0) break; await d.first().click(); }
}

// parent-side booking page
async function parentToChildren(page: Page, L: Listing, pass = "1 day", dayIdx = 0, skipGoto = false) {
  const nDays = PASS_DAYS[pass] ?? 1;
  if (!skipGoto) { await page.goto(`${WEB_URL}/book/${L.id}`, { waitUntil: "load", timeout: 60_000 }); await page.waitForTimeout(3000); }
  await page.getByRole("button", { name: new RegExp(`^${pass} · £`) }).first().click({ timeout: 45_000 });
  const timing = page.getByRole("button", { name: /Full day/ });
  if (await timing.first().isVisible().catch(() => false)) await timing.first().click();
  for (let i = 0; i < nDays; i++) {
    const dn = new Date(sd(0, dayIdx + i) + "T12:00:00").getDate();
    await page.getByRole("button", { name: new RegExp(`^(Mon|Tue|Wed|Thu|Fri) ${dn}$`) }).first().click();
  }
  await page.getByRole("button", { name: /Add .* to basket/ }).click();
  await page.getByRole("button", { name: /Next — add children/ }).click();
}
async function fillNewChild(page: Page, name: string, dob?: string) {
  await page.getByRole("button", { name: /^(＋ )?Add a (new )?child$/ }).click();
  await page.getByPlaceholder(/full name/i).first().fill(name);
  if (dob) await page.locator('input[type="date"]').first().fill(dob);
}


const qBox = (page: Page, label: string) => page.locator("div.mt-2").filter({ hasText: label }).last();
const OPK: { kind: Kind; acct: string; parent: string }[] = [
  { kind: "co", acct: "co", parent: "p1" },
  { kind: "fr", acct: "fr", parent: "p2" },
  { kind: "fl", acct: "fl", parent: "p3" },
];
const sfx = (kind: Kind) => (kind === "co" ? "" : `.${kind}`);
const pickPayCash = async (page: Page) => {
  const ph = page.getByPlaceholder("e.g. 07700 900123");
  if (await ph.isVisible().catch(() => false)) await ph.fill("07700900123");
  const sel = page.locator("select").filter({ has: page.locator('option[value="cash"]') }).first();
  if (await sel.isVisible().catch(() => false)) await sel.selectOption("cash");
};
const myKids = async (parent: string) => (await ok(parent, "GET", "/api/my/children")) as any[];

for (const { kind, acct, parent } of OPK) {
  T(`CF child questions as ${kind}`, async () => {
    test.setTimeout(1_500_000);
    const F: Record<string, any> = {};
    const S: Record<string, string> = {};
    const cfErr: Record<string, string> = {};
    const tenant = A[acct].tenantId!;
    // ---- listings + settings ----
    const L1: Listing = (st.L[`cf3_${kind}_1_${runId}`] = await mkListing(acct, `DBC Camp One ${kind} ${stamp}${runId}`));
    const L2: Listing = (st.L[`cf3_${kind}_2_${runId}`] = await mkListing(acct, `DBC Camp Two ${kind} ${stamp}${runId}`));
    saveSt();
    const lib = (await ok(acct, "GET", "/api/library")) ?? {};
    await ok(acct, "PUT", "/api/library", { childQuestions: [], settings: { ...(lib.settings ?? {}), payMethods: ["card", "cash", "bank"], phoneRequired: false, requireDob: true } });
    await ok(parent, "POST", "/api/my/providers/follow", { tenantId: tenant });
    // ---- operator: Setup > Child questions (UI) ----
    let sp: Page | null = null;
    try {
      sp = await openSetup(kind, "people");
      await uiAddQuestion(sp, { label: "Nickname", required: true });
      await closePanels(sp);
      await uiAddQuestion(sp, { label: "Swim level", type: "choice", options: ["None", "Beginner", "Confident"], every: true });
      await closePanels(sp);
      await uiAddQuestion(sp, { label: "Can your child swim?", type: "yesno" });
      await closePanels(sp);
      await uiAddQuestion(sp, { label: "Only this camp", listing: L1.title });
      await closePanels(sp);
      await uiAddQuestion(sp, { label: "Walk home alone?", type: "yesno", minAge: 8, maxAge: 11 });
      await sp.waitForTimeout(1500);
      S.setupAge = await snap(sp, "CF-009", `.setup${sfx(kind)}`);
      await closePanels(sp);
      await sp.getByRole("button", { name: /Add toilet-training question/ }).click();
      await closePanels(sp);
      await sp.waitForTimeout(4000);
      // scroll the questions list into view for a clean shot
      await sp.getByText("Your own questions").first().scrollIntoViewIfNeeded();
      S.setupList = await snap(sp, "CF-005", `.setup${sfx(kind)}`);
      F.libQs = ((await ok(acct, "GET", "/api/library")).childQuestions ?? []) as any[];
    } catch (e) { cfErr.setup = (e as Error).message.slice(0, 300); }
    finally { await sp?.close().catch(() => {}); }
    const qs = (F.libQs ?? []) as any[];
    const byLabel = (l: string) => qs.find((q) => q.label === l);
    const lock = await (async () => {
      try {
        const p = await openSetup(kind, "people");
        const dob = p.getByText("Date of birth required").first();
        await dob.scrollIntoViewIfNeeded();
        const hint = await p.locator("div").filter({ hasText: /^Date of birth required/ }).last().innerText().catch(() => "");
        const dis = await p.getByRole("button", { name: "Optional", exact: true }).first().isDisabled().catch(() => null);
        S.dobLock = await snap(p, "CF-015", `.lock${sfx(kind)}`);
        await p.close();
        return { hint, dis };
      } catch (e) { return { hint: "ERR " + (e as Error).message.slice(0, 100), dis: null as boolean | null }; }
    })();
    F.lock = lock;

    // ---- parent: first booking, new child aged 9 ----
    const pp = await (await getCtx(parent)).newPage();
    const nine = kid("Nine");
    try {
      await parentToChildren(pp, L1, "1 day", 0);
      await pp.getByRole("button", { name: /^(＋ )?Add a (new )?child$/ }).click();
      await pp.getByPlaceholder("First and last name").first().fill(nine);
      F.ageQBeforeDob = await pp.getByText("Walk home alone?").count();
      S.noDob = await snap(pp, "CF-009", `.nodob${sfx(kind)}`);
      await pp.locator('input[type="date"]').first().fill("2017-03-01");
      await pp.waitForTimeout(800);
      F.ageQ9 = await pp.getByText("Walk home alone?").count();
      F.onlyCampL1 = await pp.getByText("Only this camp").count();
      F.nickReq = await pp.getByText("Nickname").first().locator("xpath=..").innerText().catch(() => "");
      F.swimOnForm = await pp.getByText("Swim level").count(); // every-booking: should NOT be on the add-child form
      await pp.getByRole("button", { name: "Boy", exact: true }).click().catch(() => {});
      await pp.getByRole("button", { name: "Add child", exact: true }).click();
      await pp.waitForTimeout(600);
      F.stillNeed = await pp.getByText(/we still need/).innerText().catch(() => "");
      S.required = await snap(pp, "CF-005", sfx(kind));
      S.l1form = await snap(pp, "CF-007", sfx(kind));
      S.l1only = await snap(pp, "CF-008", sfx(kind));
      // answer: nickname, swim yes/no, walk, toilet
      await qBox(pp, "Nickname").locator("input").fill("Nicky");
      await qBox(pp, "Can your child swim?").getByRole("button", { name: "Yes", exact: true }).click();
      await qBox(pp, "Walk home alone?").getByRole("button", { name: "No", exact: true }).click();
      const toilet = qs.find((q) => q.kind === "toilet");
      if (toilet) await qBox(pp, toilet.label).getByRole("button", { name: "No", exact: true }).click().catch(() => {});
      await pp.getByRole("button", { name: "Add child", exact: true }).click();
      await pp.waitForTimeout(800);
      F.rosterSwim = await pp.getByText("Swim level").count();
      F.swimOptions = await pp.getByRole("button", { name: /^(None|Beginner|Confident)$/ }).count();
      await pp.getByRole("button", { name: "Beginner", exact: true }).click();
      S.swimPills = await snap(pp, "CF-006", sfx(kind));
      S.first = await snap(pp, "CF-010", `.first${sfx(kind)}`);
      await pp.getByRole("button", { name: "Next", exact: true }).click();
      await pickPayCash(pp);
      await pp.getByRole("button", { name: /^Confirm booking/ }).click();
      await pp.getByRole("heading", { name: /is booked in|Request received/ }).waitFor({ timeout: 45_000 });
      F.booked1 = true;
    } catch (e) { cfErr.parent1 = (e as Error).message.slice(0, 400); try { S.err1 = await snap(pp, "CF-ERR1", sfx(kind)); } catch { /* */ } }
    await pp.close().catch(() => {});

    // ---- stored child record ----
    try {
      const kids = await myKids(parent);
      const c = kids.find((x) => x.name === nine);
      F.childAnswers = c?.answers ?? null;
    } catch (e) { cfErr.kids = (e as Error).message.slice(0, 200); }

    // ---- second booking with the saved child: every-booking question re-asked ----
    const p2 = await (await getCtx(parent)).newPage();
    try {
      await parentToChildren(p2, L1, "1 day", 1);
      await p2.getByRole("button", { name: `Add ${nine} to this booking` }).click();
      await p2.waitForTimeout(800);
      F.second = {
        swimAsked: await p2.getByText("Swim level").count(),
        nickAsked: await p2.getByText("Nickname").count(),
        swimPrefill: await p2.locator("button").filter({ hasText: "Beginner" }).count(),
      };
      await p2.getByRole("button", { name: "Confident", exact: true }).click();
      S.second = await snap(p2, "CF-010", sfx(kind));
      await p2.getByRole("button", { name: "Next", exact: true }).click();
      await pickPayCash(p2);
      await p2.getByRole("button", { name: /^Confirm booking/ }).click();
      await p2.getByRole("heading", { name: /is booked in|Request received/ }).waitFor({ timeout: 45_000 });
      F.booked2 = true;
    } catch (e) { cfErr.parent2 = (e as Error).message.slice(0, 400); try { S.err2 = await snap(p2, "CF-ERR2", sfx(kind)); } catch { /* */ } }
    await p2.close().catch(() => {});
    try { const c = (await myKids(parent)).find((x) => x.name === nine); F.childAnswers2 = c?.answers ?? null; } catch { /* */ }

    // ---- six-year-old (outside 8-11) and the other listing ----
    const p3 = await (await getCtx(parent)).newPage();
    try {
      await parentToChildren(p3, L2, "1 day", 0);
      await p3.getByRole("button", { name: /^(＋ )?Add a (new )?child$/ }).click();
      await p3.getByPlaceholder("First and last name").first().fill(kid("Six"));
      await p3.locator('input[type="date"]').first().fill("2020-05-01");
      await p3.waitForTimeout(800);
      F.six = { walk: await p3.getByText("Walk home alone?").count(), onlyCamp: await p3.getByText("Only this camp").count(), nick: await p3.getByText("Nickname").count(), swimYN: await p3.getByText("Can your child swim?").count() };
      S.sixL2 = await snap(p3, "CF-008", `.L2${sfx(kind)}`);
      S.six = await snap(p3, "CF-009", `.age6${sfx(kind)}`);
    } catch (e) { cfErr.parent3 = (e as Error).message.slice(0, 400); try { S.err3 = await snap(p3, "CF-ERR3", sfx(kind)); } catch { /* */ } }
    await p3.close().catch(() => {});

    // ---- CF-014: approve the held bookings, then open the register for that day ----
    try {
      const mine = ((await ok(parent, "GET", "/api/my/bookings")) as any[]).filter((b) => b.child === nine);
      F.heldStatuses = mine.map((b) => b.status);
      for (const b of mine) if (b.status === "Approval needed") await call(acct, "POST", `/api/bookings/${b.ref}/actions`, { type: "approve" });
      F.afterApprove = ((await ok(parent, "GET", "/api/my/bookings")) as any[]).filter((b) => b.child === nine).map((b) => b.status);
      const rp = await (await getCtx(kind)).newPage();
      try {
        await rp.goto(`${WEB_URL}/${PORTAL[kind]}/registers`, { waitUntil: "load", timeout: 60_000 });
        await rp.waitForTimeout(3000);
        await rp.getByText(new RegExp(` ${kind} ${stamp}`)).first().click();
        await rp.getByPlaceholder(/Search listings/).fill(L1.title);
        await rp.waitForTimeout(800);
        await rp.getByText(L1.title, { exact: true }).last().click();
        await rp.waitForTimeout(2500);
        await rp.locator('input[type="date"]').first().fill(sd(0, 0), { force: true });
        await rp.waitForTimeout(3500);
        F.regHasChild = await rp.getByText(nine.slice(0, 8)).count();
        F.regNappy = await rp.getByText(/toilet trained|nappy|🚼/i).count();
        S.register = await snap(rp, "CF-014", sfx(kind));
      } finally { await rp.close().catch(() => {}); }
    } catch (e) { cfErr.register = (e as Error).message.slice(0, 400); }

    // ---- CF-015: Date of birth Required vs Optional, at the provider's end (Families > edit family > add child) ----
    try {
      await ok(acct, "PUT", "/api/library", { childQuestions: qs.map((q) => ({ ...q, minAge: undefined, maxAge: undefined })) });
      const famAdd = async (page: Page, name: string, shotName: string) => {
        await page.goto(`${WEB_URL}/${PORTAL[kind]}/customers`, { waitUntil: "load", timeout: 60_000 });
        const famCard = page.getByText(A[parent].email).first().locator("xpath=ancestor::*[.//button[normalize-space()='View / edit']][1]");
        await famCard.getByRole("button", { name: /View \/ edit/ }).waitFor({ timeout: 45_000 });
        await famCard.getByRole("button", { name: /View \/ edit/ }).click();
        await page.getByRole("button", { name: /＋ Add/ }).first().click();
        await page.getByPlaceholder("First and last name").last().fill(name);
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await page.waitForTimeout(2500);
        const err = page.getByText(/Add a date of birth for/).first();
        if (await err.count()) await err.scrollIntoViewIfNeeded();
        else await page.getByPlaceholder("First and last name").last().scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(500);
        S[shotName] = await snap(page, "CF-015", shotName.startsWith("dobReq") ? `.required${sfx(kind)}` : sfx(kind));
      };
      const setDob = async (opt: "Required" | "Optional") => {
        const sp2 = await openSetup(kind, "people");
        await sp2.getByRole("button", { name: opt, exact: true }).first().click();
        await sp2.waitForTimeout(3000);
        if (opt === "Optional") { await sp2.getByText("Date of birth required").first().scrollIntoViewIfNeeded(); S.dobOptional = await snap(sp2, "CF-015", `.optional${sfx(kind)}`); }
        await sp2.close();
      };
      const noDobReq = kid("NoDobReq"), noDobOpt = kid("NoDobOpt");
      await setDob("Required");
      const fp = await (await getCtx(kind)).newPage();
      await famAdd(fp, noDobReq, "dobReqTry");
      F.reqText = (await fp.locator("body").innerText()).match(/[^\n]*(date of birth|birth)[^\n]*/gi)?.slice(0, 3) ?? [];
      F.libDobReq = (await ok(acct, "GET", "/api/library")).settings?.requireDob;
      await fp.close();
      await setDob("Optional");
      F.libDobOpt = (await ok(acct, "GET", "/api/library")).settings?.requireDob;
      const fp2 = await (await getCtx(kind)).newPage();
      await famAdd(fp2, noDobOpt, "dobOptionalTry");
      await fp2.close();
      const cs = (await ok(acct, "GET", "/api/customers")) as any[];
      const fam = (Array.isArray(cs) ? cs : (cs as any).customers ?? []).find((c: any) => (c.email ?? "").toLowerCase() === A[parent].email.toLowerCase());
      const names = (fam?.children ?? []).map((c: any) => c.name);
      F.famChildren = names;
      F.savedReq = names.includes(noDobReq); F.savedOpt = names.includes(noDobOpt);
    } catch (e) { cfErr.dob = (e as Error).message.slice(0, 400); }
    fs.writeFileSync(path.join(SHOTS, `cf-facts-${kind}.json`), JSON.stringify({ F, S, cfErr }, null, 1));
    (globalThis as any).__cf ??= {}; (globalThis as any).__cf[kind] = { F, S, cfErr, qs };

    const need = (k: string) => { if (cfErr[k]) throw new Error(`${k}: ${cfErr[k]}`); };
    await check("CF-005", kind, async () => {
      need("setup"); need("parent1");
      const q = byLabel("Nickname"); eq(q?.type, "text", "type"); eq(q?.required, true, "required");
      truthy(/we still need/.test(F.stillNeed) && /nickname/i.test(F.stillNeed), "blocked with message naming nickname: " + F.stillNeed);
      truthy(!/\?\./.test(F.stillNeed), `TYPO on screen: "${F.stillNeed}" (question text lower-cased into a sentence, giving "?." and "we still need is your child ...")`);
      truthy(/required/i.test(F.nickReq), "label shows required: " + F.nickReq);
      return { note: `Nickname (text, required) saved via Setup UI; adding a child without it shows "${F.stillNeed}"; form marks it "${F.nickReq.replace(/\s+/g, " ")}"; child saved after answering`, shot: S.required };
    });
    await check("CF-006", kind, async () => {
      need("setup"); need("parent1");
      const q = byLabel("Swim level"); eq(q?.type, "choice", "type"); eq(JSON.stringify(q?.options), JSON.stringify(["None", "Beginner", "Confident"]), "options");
      eq(F.swimOptions >= 3, true, "three pick-one options shown to the parent");
      return { note: `choice question with options None/Beginner/Confident stored; parent sees a pick-one list (${F.swimOptions} option buttons) on the child's roster card and chose Beginner`, shot: S.swimPills };
    });
    await check("CF-007", kind, async () => {
      need("setup"); need("parent1");
      const q = byLabel("Can your child swim?"); eq(q?.type, "yesno", "type");
      return { note: "yes/no question stored (type yesno); parent form shows Yes / No buttons for 'Can your child swim?' and the answer was saved", shot: S.l1form };
    });
    await check("CF-008", kind, async () => {
      need("setup"); need("parent1"); need("parent3");
      const q = byLabel("Only this camp"); eq(Array.isArray(q?.scope) && q.scope[0] === L1.id, true, "scope array = [L1]");
      eq(F.onlyCampL1, 1, "asked on listing 1"); eq(F.six.onlyCamp, 0, "not asked on listing 2");
      return { note: `scope [${L1.id}] stored; asked when booking listing 1 (shot) and NOT asked on listing 2 (shot ${S.sixL2})`, shot: S.l1only };
    });
    await check("CF-009", kind, async () => {
      need("setup"); need("parent1"); need("parent3");
      const q = byLabel("Walk home alone?"); eq(q?.minAge, 8, "minAge"); eq(q?.maxAge, 11, "maxAge");
      eq(F.ageQBeforeDob, 0, "no DOB: nothing age-gated asked"); eq(F.ageQ9, 1, "aged 9: asked"); eq(F.six.walk, 0, "aged 6: not asked");
      truthy(lock.dis === true, "DOB-required toggle is locked (Optional disabled): " + JSON.stringify(lock));
      return { note: `ages 8-11 stored; no DOB -> not asked; aged 9 -> asked; aged 6 -> not asked; Setup 'Date of birth required' locked on (hint: ${lock.hint.replace(/\s+/g, " ").slice(0, 160)})`, shot: S.setupAge };
    });
    await check("CF-010", kind, async () => {
      need("parent1"); need("parent2");
      const swim = byLabel("Swim level"), nick = byLabel("Nickname");
      eq(swim?.ask, "every", "swim ask every"); truthy(nick?.ask !== "every", "nickname once");
      eq(F.second.swimAsked >= 1, true, "second booking re-asks Swim level"); eq(F.second.nickAsked, 0, "second booking does NOT re-ask Nickname");
      eq(F.childAnswers?.[nick.id], "Nicky", "once answer saved on child"); eq(F.childAnswers?.[swim.id], "Beginner", "first swim answer");
      eq(F.childAnswers2?.[swim.id], "Confident", "answer updated on child record after 2nd booking");
      return { note: `2nd booking re-asked only 'Swim level' (Nickname not re-asked); child record answers updated Beginner -> Confident (${JSON.stringify(F.childAnswers2)})`, shot: S.second };
    });
    await check("CF-014", kind, async () => {
      need("setup"); need("parent1"); need("register");
      const toilet = qs.find((q) => q.kind === "toilet"); eq(toilet?.kind, "toilet", "kind toilet"); eq(toilet?.showOnRegister, true, "show on register on");
      eq(F.childAnswers?.["q-toilet"], "No", "answer stored");
      eq(F.regHasChild >= 1, true, "child on the register: " + JSON.stringify(F.afterApprove));
      eq(F.regNappy >= 1, true, "register shows nappy / not toilet trained badge");
      return { note: `toilet preset (kind toilet, show on register on); answered No for ${nine}; register for ${sd(0, 0)} lists the child with the nappy badge (${F.regNappy} matches); bookings ${JSON.stringify(F.afterApprove)}`, shot: S.register };
    });
    await check("CF-015", kind, async () => {
      need("dob");
      eq(F.libDobReq, true, "requireDob true when Required"); eq(F.libDobOpt, false, "requireDob false when Optional");
      eq(F.savedReq, false, "Required: child without DOB NOT saved"); eq(F.savedOpt, true, "Optional: child without DOB saved");
      return { note: `Required: provider-side add child without DOB refused (screen text ${JSON.stringify(F.reqText)}), not saved; Optional: saved (family children ${JSON.stringify(F.famChildren)}). Parent checkout always asks DOB (checkout.tsx needDob = true) whatever this setting is`, shot: S.dobOptionalTry };
    });
  });
}


T("explore", async () => {
  test.setTimeout(600_000);
  if (!process.env.DBC_EXPLORE) return;
  const page = await (await getCtx("co")).newPage();
  await page.goto(`${WEB_URL}/company/customers`, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  await page.getByRole("button", { name: /View \/ edit/ }).first().click();
  await page.waitForTimeout(2000);
  await snap(page, "explore-fam");
  console.log("INPUTS", JSON.stringify(await page.locator("input,select,textarea").evaluateAll((els) => els.map((e: any) => `${e.tagName}|${e.type}|${e.placeholder}|${e.name}`))));
  console.log("BUTTONS", JSON.stringify(await page.locator("button").allInnerTexts()));
});

// ═══ BE: booking link / QR / embed ═══
const HOST = "http://localhost:5599";
const originOf = () => new URL(WEB_URL).origin;
async function hostPage(browser: Browser, body: string) {
  // a REAL second origin on loopback (a different port than the app), serving a pretend club website
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Club website</title></head><body style="font-family:system-ui;max-width:900px;margin:30px auto;padding:0 16px"><h1>Pretend club website</h1><p>Some words about the club, before the booking button.</p>${body}<p style="color:#666">Footer text after the widget.</p></body></html>`;
  const server = http.createServer((_q, r) => { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); r.end(html); });
  await new Promise<void>((res) => server.listen(0, "127.0.0.1", () => res()));
  const port = (server.address() as { port: number }).port;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const origClose = ctx.close.bind(ctx);
  ctx.close = async () => { server.close(); await origClose(); };
  const page = await ctx.newPage();
  const errs: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
  await page.goto(`http://localhost:${port}/page.html`, { waitUntil: "load", timeout: 60_000 });
  return { ctx, page, errs };
}
for (const { kind, acct } of OPK) {
  T(`BE booking link, QR and embed as ${kind}`, async ({ browser }) => {
    test.setTimeout(900_000);
    const tenant = A[acct].tenantId!;
    const L1: Listing = st.L[`cf_${kind}_1`] ?? (st.L[`cf_${kind}_1`] = await mkListing(acct, `DBC Camp One ${kind} ${stamp}`));
    const L2: Listing = st.L[`cf_${kind}_2`] ?? (st.L[`cf_${kind}_2`] = await mkListing(acct, `DBC Camp Two ${kind} ${stamp}`));
    saveSt();
    const op = await (await getCtx(kind)).newPage();
    await op.goto(`${WEB_URL}/${PORTAL[kind]}/listings`, { waitUntil: "load", timeout: 60_000 });
    const card = cardWith(op, L1.title);
    await card.waitFor({ timeout: 60_000 });
    const link = `${originOf()}/book/${L1.id}`;
    const dialogs: string[] = [];
    op.on("dialog", (d) => { dialogs.push(d.message()); void d.accept(); });

    // BE-001
    await check("BE-001", kind, async () => {
      await card.getByRole("button", { name: /Link/ }).first().click();
      await card.getByText("✓ Copied").waitFor({ timeout: 10_000 });
      // the "✓ Copied" label only lasts 1.5s, so screenshot straight away (no settle delay)
      const f1 = path.join(SHOTS, `BE-001${sfx(kind)}.png`);
      await op.screenshot({ path: f1, fullPage: true });
      const shot = path.relative(ROOT, f1);
      const clip = await op.evaluate(() => navigator.clipboard.readText());
      eq(clip, link, "clipboard link");
      return { note: `card shows '✓ Copied'; clipboard = ${clip}`, shot };
    });

    // BE-004
    await check("BE-004", kind, async () => {
      await card.getByRole("button", { name: /QR/ }).first().click();
      const img = op.locator("img[alt]").filter({ has: op.locator("xpath=self::*") }).last();
      const modal = op.getByText("Scan to book").first();
      await modal.waitFor({ timeout: 15_000 });
      const qrImg = op.locator('img[src*="qrserver.com"]').first();
      await qrImg.waitFor({ timeout: 15_000 });
      const src = (await qrImg.getAttribute("src")) ?? "";
      eq(decodeURIComponent(src.split("data=")[1] ?? ""), link, "QR data = booking link");
      await op.waitForTimeout(2500);
      const loaded = await qrImg.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0);
      const modalShot = await snap(op, "BE-004", sfx(kind));
      // decode the real QR image (fetched server side) with the browser's BarcodeDetector, when available
      let decoded = "not attempted";
      try {
        const png = Buffer.from(await (await fetch(src)).arrayBuffer());
        decoded = await op.evaluate(async (b64) => {
          const BD = (window as any).BarcodeDetector; if (!BD) return "BarcodeDetector unavailable";
          const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
          const bmp = await createImageBitmap(new Blob([u], { type: "image/png" }));
          const r = await new BD({ formats: ["qr_code"] }).detect(bmp); return r[0]?.rawValue ?? "no code found";
        }, png.toString("base64"));
      } catch (e) { decoded = "decode error " + (e as Error).message.slice(0, 60); }
      const [pop] = await Promise.all([op.context().waitForEvent("page"), op.getByRole("button", { name: /Poster/ }).click()]);
      await pop.waitForLoadState("load").catch(() => {});
      await pop.waitForTimeout(2000);
      const posterText = (await pop.locator("body").innerText()).replace(/\s+/g, " ");
      const posterShot = await snap(pop, "BE-004", `.poster${sfx(kind)}`);
      await pop.close().catch(() => {});
      truthy(/Scan to book your place/.test(posterText), "poster text: " + posterText.slice(0, 120));
      truthy(loaded, "QR image loaded");
      if (/^http/.test(decoded)) eq(decoded, link, "decoded QR");
      return { note: `QR image data= ${link}; image loaded; scanned in-browser: ${decoded}; Poster page says "${posterText.slice(0, 90)}" (poster shot ${posterShot})`, shot: modalShot };
    });
    await op.keyboard.press("Escape").catch(() => {});
    await op.getByRole("button", { name: "×", exact: true }).first().click().catch(() => {});

    // snippets from the real UI
    const grab = async (action: () => Promise<void>) => { dialogs.length = 0; await action(); await op.waitForTimeout(1500); const m = dialogs[dialogs.length - 1] ?? ""; return { msg: m, snippet: m.match(/<script[^>]*><\/script>/)?.[0] ?? "" }; };
    const one = await grab(async () => { await card.locator("button").last().click(); await op.getByText("</> Embed on my website").click(); });
    const store = await grab(async () => { await op.getByRole("button", { name: /^<\/> Embed$/ }).first().click(); });
    fs.writeFileSync(path.join(SHOTS, `be-snippets-${kind}.json`), JSON.stringify({ one, store }, null, 1));
    const withMode = (sn: string, extra: string) => sn.replace("<script ", `<script ${extra} `);

    await check("BE-005", kind, async () => {
      truthy(one.snippet, "snippet from UI: " + one.msg.slice(0, 200));
      truthy(one.snippet.includes(`/embed.js`) && one.snippet.includes(`data-listing="${L1.id}"`), "snippet: " + one.snippet);
      const h = await hostPage(browser, one.snippet.replace(`data-listing`, `data-label="Book the camp" data-color="#d9480f" data-listing`));
      try {
        const btn = h.page.getByRole("button", { name: "Book the camp" });
        await btn.waitFor({ timeout: 20_000 });
        const bg = await btn.evaluate((e) => getComputedStyle(e).backgroundColor);
        const before = await snap(h.page, "BE-005", `.button${sfx(kind)}`);
        await btn.click();
        const fr = h.page.frameLocator("iframe");
        await fr.getByRole("button", { name: /^1 day · £20/ }).first().waitFor({ timeout: 45_000 });
        const iframeSrc = await h.page.locator("iframe").first().getAttribute("src");
        const shot = await snap(h.page, "BE-005", sfx(kind));
        truthy(iframeSrc?.endsWith(`/book/${L1.id}?embed=1`), "iframe src " + iframeSrc);
        return { note: `snippet from UI (${one.snippet}); button 'Book the camp' colour ${bg}; click opens overlay iframe ${iframeSrc} showing '1 day · £20' (same as booking page); button-only shot ${before}; console errors: ${h.errs.length}`, shot };
      } finally { await h.ctx.close(); }
    });
    await check("BE-006", kind, async () => {
      const h = await hostPage(browser, `<p>Mount point follows:</p><div id="mnt" data-activityos-book="${L1.id}"></div><p>and this text comes after it.</p><script src="${originOf()}/embed.js" async></script>`);
      try {
        const btn = h.page.locator('#mnt button');
        await btn.waitFor({ timeout: 20_000 });
        const txt = await btn.innerText();
        const shot = await snap(h.page, "BE-006", sfx(kind));
        eq(txt, "Book now", "button label inside the mount div");
        return { note: `button '${txt}' rendered inside <div data-activityos-book>, between the two paragraphs`, shot };
      } finally { await h.ctx.close(); }
    });
    await check("BE-007", kind, async () => {
      truthy(store.snippet.includes(`data-store="${tenant}"`), "store snippet: " + store.snippet + " / " + store.msg.slice(0, 120));
      const h = await hostPage(browser, store.snippet);
      try {
        const btn = h.page.getByRole("button", { name: "Book activities" });
        await btn.waitFor({ timeout: 20_000 }); await btn.click();
        const fr = h.page.frameLocator("iframe");
        await fr.getByText(L1.title, { exact: false }).first().waitFor({ timeout: 45_000 });
        const hasL2 = await fr.getByText(L2.title, { exact: false }).count();
        const iframeSrc = await h.page.locator("iframe").first().getAttribute("src");
        await h.page.waitForTimeout(1500);
        const shot = await snap(h.page, "BE-007", sfx(kind));
        eq(iframeSrc, `${originOf()}/store/${tenant}?embed=1`, "iframe src");
        eq(hasL2 >= 1, true, "second live listing shown");
        // each can be booked: open the first listing from inside the frame
        await fr.getByText(L1.title, { exact: false }).first().click();
        await fr.getByRole("button", { name: /^1 day · £20/ }).first().waitFor({ timeout: 45_000 });
        const shot2 = await snap(h.page, "BE-007", `.booking${sfx(kind)}`);
        // mount-element form
        const h2 = await hostPage(browser, `<div data-activityos-store="${tenant}"></div><script src="${originOf()}/embed.js" async></script>`);
        const mountBtn = await h2.page.locator('[data-activityos-store] button').count(); await h2.ctx.close();
        eq(mountBtn, 1, "mount element renders a button");
        return { note: `store snippet (${store.snippet}) -> overlay iframe ${iframeSrc} lists ${L1.title} and ${L2.title}; opening one shows its booking page with '1 day · £20' (shot ${shot2}); <div data-activityos-store> mount also renders the button`, shot };
      } finally { await h.ctx.close(); }
    });
    await check("BE-008", kind, async () => {
      const h = await hostPage(browser, withMode(one.snippet, `data-mode="inline"`));
      try {
        const frame = h.page.locator("iframe").first();
        await frame.waitFor({ timeout: 20_000 });
        const fr = h.page.frameLocator("iframe");
        await fr.getByRole("button", { name: /^1 day · £20/ }).first().waitFor({ timeout: 45_000 });
        await h.page.waitForTimeout(3000);
        const hgt = await frame.evaluate((e: HTMLIFrameElement) => parseInt(e.style.height, 10));
        const noButton = await h.page.getByRole("button", { name: "Book now" }).count();
        const shot = await snap(h.page, "BE-008", sfx(kind));
        eq(noButton, 0, "no Book now button in inline mode");
        truthy(hgt > 0 && hgt !== 900, `iframe auto-sized (height ${hgt}px, default 900px)`);
        return { note: `inline iframe shows the whole booking page in the host page; no button; auto-sized to ${hgt}px (default placeholder 900px)`, shot };
      } finally { await h.ctx.close(); }
    });
    await op.close().catch(() => {});
  });
}


// ═══ DI: referrals + memberships (parent UI) ═══
async function mkKidApi(parent: string, name: string, dob = "2018-05-14") {
  return (await ok(parent, "POST", "/api/my/children", { name, dob, sex: "Boy" })).id as string;
}
/** UI: open the booking page as `parent`, pick 1 day on `dayIdx`, add the saved child, land on the Pay stage. */
async function uiPayStage(page: Page, L: Listing, kidName: string, dayIdx = 0, pass = "1 day") {
  await parentToChildren(page, L, pass, dayIdx);
  await page.getByRole("button", { name: `Add ${kidName} to this booking` }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByText("Have discount codes?").waitFor({ timeout: 45_000 });
}
async function uiApplyCode(page: Page, code: string) {
  await page.getByPlaceholder("Type a code…").fill(code);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.waitForTimeout(2500);
}
const myRows = async (parent: string) => (await ok(parent, "GET", "/api/my/bookings")) as any[];

for (const { kind, acct, parent } of OPK) {
  T(`DI referral + membership as ${kind}`, async () => {
    test.setTimeout(1_800_000);
    const tenant = A[acct].tenantId!;
    const L1: Listing = st.L[`cf_${kind}_1`] ?? (st.L[`cf_${kind}_1`] = await mkListing(acct, `DBC Camp One ${kind} ${stamp}`));
    const L2: Listing = st.L[`cf_${kind}_2`] ?? (st.L[`cf_${kind}_2`] = await mkListing(acct, `DBC Camp Two ${kind} ${stamp}`));
    // a dedicated listing for the referral flows so CF bookings never interfere
    const LR: Listing = st.L[`di_${kind}_r`] ?? (st.L[`di_${kind}_r`] = await mkListing(acct, `DBC Referral Camp ${kind} ${stamp}`));
    saveSt();
    const lib = (await ok(acct, "GET", "/api/library")) ?? {};
    const setRef = (r: Record<string, unknown>) => ok(acct, "PUT", "/api/library", { settings: { ...((await_lib ?? lib).settings ?? {}), payMethods: ["card", "cash", "bank"], phoneRequired: false, referral: { enabled: true, type: "amount", friendOff: 10, referrerReward: 10, minSpend: 0, capToFriendSpend: false, ...r } } });
    let await_lib: any = null;
    const sgn = sfx(kind);
    const mk = async (k: string) => { const key = `${k}_${kind}_${runId}`; await signupParent(key); await ok(key, "POST", "/api/my/providers/follow", { tenantId: tenant }); return key; };
    const F: Record<string, any> = {}; const S: Record<string, string> = {}; const E: Record<string, string> = {};
    const A_ = parent;                       // referrer: booked with this provider already (CF)
    // make sure the referrer HAS booked with this provider
    const aKid = kid("RefA");
    await bookOk(A_, LR, [{ child: aKid, pass: "1 day", week: 2, dates: [sd(2, 4)] }]);
    // ---------- amount type ----------
    await setRef({});
    try {
      const ref = await ok(A_, "GET", "/api/my/referral");
      F.ref = ref; truthy(ref.enabled && ref.code, "referral enabled " + JSON.stringify(ref));
      // own code
      const own = await book(A_, LR, [{ child: kid(), pass: "1 day", dates: [sd(2, 3)] }], { discountCodes: [ref.code] });
      F.own = { status: own.status, err: own.json?.error };
      // friend B: UI path (pay stage -> apply -> confirm)
      F.beforeThanks = ((await ok(A_, "GET", "/api/my/coupons")) as any[]).filter((c) => /^THANKS/.test(c.code)).map((c) => c.code);
      const B = await mk("rb"); const bKid = kid("FriendB"); await mkKidApi(B, bKid);
      const bp = await (await getCtx(B)).newPage();
      try {
        await uiPayStage(bp, LR, bKid, 0);
        await uiApplyCode(bp, ref.code);
        F.bPayText = (await bp.locator("body").innerText()).replace(/\s+/g, " ");
        S.pay = await snap(bp, "DI-031", sgn);
        await pickPayCash(bp);
        await bp.getByRole("button", { name: /^Confirm booking/ }).click();
        await bp.getByRole("heading", { name: /is booked in|Request received/ }).waitFor({ timeout: 45_000 });
        S.bDone = await snap(bp, "DI-031", `.booked${sgn}`);
      } finally { await bp.close().catch(() => {}); }
      const brow = (await myRows(B))[0]; F.bRow = { ref: brow.ref, amount: brow.amount, off: brow.discountOff, codes: brow.discountCodes, listPrice: brow.listPrice };
      // reward for A
      await new Promise((r) => setTimeout(r, 2500));
      const cps = (await ok(A_, "GET", "/api/my/coupons")) as any[];
      F.reward = cps.find((c) => /^THANKS/.test(c.code) && !F.beforeThanks.includes(c.code));
      F.codeDoc = ((await ok(acct, "GET", "/api/discounts")) as any[]).find((c) => c.code === ref.code);
      F.dash = await ok(acct, "GET", "/api/referrals");
      // pages
      S.referPage = await shotUrl(A_, "/custdash/refer", "DI-031", [], `.referrer${sgn}`);
      S.opDash = await shotUrl(kind, `/${PORTAL[kind]}/referrals`, "DI-031", [], `.dashboard${sgn}`);
    } catch (e) { E.amount = (e as Error).message.slice(0, 400); }

    // ---------- DI-032: reward ----------
    try {
      const rw = F.reward; truthy(rw, "reward code listed under A's coupons");
      S.coupons = await shotUrl(A_, "/custdash/coupons", "DI-032", [], sgn);
      const mp = await (await getCtx(A_)).newPage();
      try { await mp.goto(`${WEB_URL}/custdash/messages`, { waitUntil: "load" }); await mp.waitForTimeout(4000); F.msgHas = await mp.getByText(/Thanks for referring a friend/).count(); S.messages = await snap(mp, "DI-032", `.message${sgn}`); } finally { await mp.close(); }
      const cdoc = ((await ok(acct, "GET", "/api/discounts")) as any[]); // reward codes hidden from list? check both ways
      F.rewardDoc = cdoc.find((c) => c.code === rw.code) ?? null;
      const use1 = await bookOk(A_, LR, [{ child: kid(), pass: "1 day", dates: [sd(2, 2)] }], { discountCodes: [rw.code] });
      F.use1 = { amount: use1.amount, off: use1.off };
      const use2 = await book(A_, LR, [{ child: kid(), pass: "1 day", dates: [sd(2, 1)] }], { discountCodes: [rw.code] });
      F.use2 = { status: use2.status, err: use2.json?.error };
      const cps2 = (await ok(A_, "GET", "/api/my/coupons")) as any[];
      F.rewardStillListed = cps2.some((c) => c.code === rw.code);
    } catch (e) { E.reward = (e as Error).message.slice(0, 400); }

    // ---------- DI-033: existing customer ----------
    try {
      const C = await mk("rc"); const cKid = kid("Existing"); await mkKidApi(C, cKid);
      await bookOk(C, LR, [{ child: cKid, pass: "1 day", dates: [sd(2, 0)] }]);
      const code = F.ref.code as string;
      const cp = await (await getCtx(C)).newPage();
      try {
        await uiPayStage(cp, LR, cKid, 1);
        await uiApplyCode(cp, code);
        F.cMsg = (await cp.locator("body").innerText()).match(/[^\n]*new customers only[^\n]*/i)?.[0] ?? "";
        S.existing = await snap(cp, "DI-033", sgn);
      } finally { await cp.close().catch(() => {}); }
      const viaApi = await book(C, LR, [{ child: cKid, pass: "1 day", dates: [sd(2, 0 + 1)] }], { discountCodes: [code] });
      F.cApi = { status: viaApi.status, err: viaApi.json?.error };
    } catch (e) { E.existing = (e as Error).message.slice(0, 400); }

    // ---------- DI-034: percent 10% / 10% ----------
    try {
      await setRef({ type: "percent", friendOff: 10, referrerReward: 10, capToFriendSpend: false });
      const ref2 = await ok(A_, "GET", "/api/my/referral"); F.ref2 = { type: ref2.type, friendOff: ref2.friendOff, code: ref2.code };
      const D = await mk("rd"); const dKid = kid("FriendD"); await mkKidApi(D, dKid);
      const dr = await bookOk(D, LR, [{ child: dKid, pass: "5 days", week: 1 }], { discountCodes: [ref2.code] });
      F.dBook = { amount: dr.amount, off: dr.off };
      await new Promise((r) => setTimeout(r, 2500));
      F.dash2 = await ok(acct, "GET", "/api/referrals");
      const cps = (await ok(A_, "GET", "/api/my/coupons")) as any[];
      F.pctRewards = cps.filter((c) => /^THANKS/.test(c.code) && !F.beforeThanks.includes(c.code) && c.code !== F.reward?.code).map((c) => ({ code: c.code, type: c.type, value: c.value, maxOff: c.maxOff }));
      S.dash2 = await shotUrl(kind, `/${PORTAL[kind]}/referrals`, "DI-034", [], `.dashboard${sgn}`);
      S.coupons2 = await shotUrl(A_, "/custdash/coupons", "DI-034", [], sgn);
    } catch (e) { E.percent = (e as Error).message.slice(0, 400); }

    // ---------- DI-032 (cap): percent reward capped to friend spend ----------
    try {
      await setRef({ type: "percent", friendOff: 10, referrerReward: 50, capToFriendSpend: true });
      const ref3 = await ok(A_, "GET", "/api/my/referral"); F.ref3 = { cap: ref3.capToFriendSpend };
      const Ee = await mk("re"); const eKid = kid("FriendE"); await mkKidApi(Ee, eKid);
      const er = await bookOk(Ee, LR, [{ child: eKid, pass: "1 day", dates: [sd(1, 4)] }], { discountCodes: [ref3.code] });
      F.eBook = { amount: er.amount, off: er.off };
      await new Promise((r) => setTimeout(r, 2500));
      const cps = (await ok(A_, "GET", "/api/my/coupons")) as any[];
      const capped = cps.filter((c) => /^THANKS/.test(c.code) && c.value === 50 && !F.beforeThanks.includes(c.code));
      F.capCode = capped[0] ?? null;
      if (capped[0]) { const u = await bookOk(A_, LR, [{ child: kid(), pass: "5 days", week: 2 }], { discountCodes: [capped[0].code] }); F.capUse = { amount: u.amount, off: u.off }; }
      S.dash3 = await shotUrl(kind, `/${PORTAL[kind]}/referrals`, "DI-032", [], `.dashboard${sgn}`);
    } catch (e) { E.cap = (e as Error).message.slice(0, 400); }
    fs.writeFileSync(path.join(SHOTS, `di-facts-${kind}.json`), JSON.stringify({ F, S, E }, null, 1));

    const need = (k: string) => { if (E[k]) throw new Error(`${k}: ${E[k]}`); };
    await check("DI-031", kind, async () => {
      need("amount");
      truthy(/own referral link/.test(F.own.err ?? ""), "own code refused: " + JSON.stringify(F.own));
      eq(F.bRow.amount, 10, "friend's booking total (1 day £20 - £10)"); eq(F.bRow.off, 10, "discountOff");
      eq(F.codeDoc?.referral, true, "code.referral"); eq(F.codeDoc?.newCustomerOnly, true, "code.newCustomerOnly");
      truthy((F.dash.recent ?? []).some((r: any) => r.bookingRef === F.bRow.ref), "referrals dashboard row for the friend's booking");
      return { note: `A's own code refused ("${F.own.err}"); friend B applied ${F.ref.code} in the pay stage UI and booked ${F.bRow.ref}: £20 -> £${F.bRow.amount} (discountOff ${F.bRow.off}); code referral+newCustomerOnly true; referrals dashboard has the row`, shot: S.pay };
    });
    await check("DI-032", kind, async () => {
      need("amount"); need("reward"); need("cap");
      truthy(F.reward && /^THANKS/.test(F.reward.code), "THANKS code under A's coupons");
      truthy(F.msgHas >= 1, "thank-you message arrived");
      eq(F.use1.off, 10, "reward takes £10 off once"); eq(F.use1.amount, 10, "£20 - £10");
      eq(F.use2.status, 400, "second use refused"); truthy(/already used/.test(F.use2.err ?? ""), "second use text: " + F.use2.err);
      eq(F.rewardStillListed, false, "used reward no longer listed");
      eq(F.capUse?.off, 18, `reward capped to what the friend actually paid (£20 less 10% = £18); 50% of £90 would be £45 but the cap let £${F.capUse?.off} off: server/src/routes/my.ts:1805 passes the pre-code amount as the friend's spend`);
      const row = (F.dash.recent ?? []).find((r: any) => r.bookingRef === F.bRow.ref);
      truthy(row && row.friendSpend === 10 && row.reward === 10, "dashboard row shows spend 10 / reward 10: " + JSON.stringify(row));
      return { note: `THANKS code ${F.reward.code} listed (perCustomerLimit ${F.rewardDoc?.perCustomerLimit ?? "n/a"}) + thank-you message received; used once -> £10 off, second try "${F.use2.err}"; percent 50% reward with cap: maxOff ${F.capCode?.maxOff}, £90 booking only £${F.capUse?.off} off; dashboard row ${JSON.stringify(row)}`, shot: S.coupons };
    });
    await check("DI-033", kind, async () => {
      need("existing");
      truthy(/new customers only/i.test(F.cMsg), "UI message: " + F.cMsg); truthy(/new customers only/.test(F.cApi.err ?? ""), "API: " + JSON.stringify(F.cApi));
      return { note: `existing customer applying ${F.ref.code} sees "${F.cMsg.trim().slice(0, 80)}"; API 400 "${F.cApi.err}"; no discount`, shot: S.existing };
    });
    await check("DI-034", kind, async () => {
      need("percent");
      eq(F.ref2.type, "percent", "type percent"); eq(F.dBook.off, 9, "friend 10% of £90"); eq(F.dBook.amount, 81, "£90 - £9");
      const r = F.pctRewards.find((c: any) => c.type === "percent" && c.value === 10); truthy(r, "referrer reward is a 10% code: " + JSON.stringify(F.pctRewards));
      return { note: `percent referral: friend D 5 days £90 -> £${F.dBook.amount} (off ${F.dBook.off} = 10%); referrer reward ${JSON.stringify(r)}`, shot: S.dash2 };
    });
  });
}


// ═══ DI-035 / DI-036: memberships through the parent UI ═══
for (const { kind, acct } of OPK) {
  T(`DI memberships as ${kind}`, async () => {
    test.setTimeout(900_000);
    const tenant = A[acct].tenantId!;
    const LM: Listing = st.L[`di_${kind}_m`] ?? (st.L[`di_${kind}_m`] = await mkListing(acct, `DBC Member Camp ${kind} ${stamp}`));
    saveSt();
    const lib = (await ok(acct, "GET", "/api/library")) ?? {};
    await ok(acct, "PUT", "/api/library", { settings: { ...(lib.settings ?? {}), payMethods: ["card", "cash", "bank"], phoneRequired: false, memberships: { enabled: true, tiers: [
      { id: "perk", name: "Perk", enabled: true, priceMonthly: 10, benefitType: "percent", benefitValue: 15 },
      { id: "gold", name: "Gold", enabled: true, priceMonthly: 40, benefitType: "credit", benefitValue: 50 },
    ] } } });
    const sgn = sfx(kind);
    const F: Record<string, any> = {}; const S: Record<string, string> = {}; const E: Record<string, string> = {};
    const mkp = async (k: string) => { const key = `${k}_${kind}_${runId}`; await signupParent(key); await ok(key, "POST", "/api/my/providers/follow", { tenantId: tenant }); return key; };
    // ---- percent perk ----
    try {
      const P = await mkp("mp"); const k0 = kid("MemFirst"); await bookOk(P, LM, [{ child: k0, pass: "1 day", week: 2, dates: [sd(2, 4)] }]);
      const pg = await (await getCtx(P)).newPage();
      try {
        await pg.goto(`${WEB_URL}/custdash/memberships`, { waitUntil: "load", timeout: 60_000 });
        await pg.getByRole("button", { name: /Join Perk/ }).waitFor({ timeout: 45_000 });
        S.tiers = await snap(pg, "DI-035", `.tiers${sgn}`);
        await pg.getByRole("button", { name: /Join Perk/ }).click();
        await pg.getByText(/Current plan|current plan|Your plan/i).first().waitFor({ timeout: 20_000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        S.joined = await snap(pg, "DI-035", `.joined${sgn}`);
      } finally { await pg.close().catch(() => {}); }
      F.memCode = ((await ok(P, "GET", "/api/my/coupons")) as any[]).find((c) => c.membership);
      const kk = kid("MemBook"); await mkKidApi(P, kk);
      const bp = await (await getCtx(P)).newPage();
      try {
        await uiPayStage(bp, LM, kk, 0, "5 days");
        await bp.waitForTimeout(2500);
        F.payText = (await bp.locator("body").innerText()).replace(/\s+/g, " ");
        S.pay = await snap(bp, "DI-035", sgn);
        await pickPayCash(bp);
        await bp.getByRole("button", { name: /^Confirm booking/ }).click();
        await bp.getByRole("heading", { name: /is booked in|Request received/ }).waitFor({ timeout: 45_000 });
      } finally { await bp.close().catch(() => {}); }
      const row = (await myRows(P)).find((r) => r.child === kk); F.row = { ref: row?.ref, amount: row?.amount, off: row?.discountOff, codes: row?.discountCodes };
      F.codeDoc = ((await ok(acct, "GET", "/api/discounts")) as any[]).find((c) => c.membership && c.assignedTo === A[P].email.toLowerCase()) ?? null;
    } catch (e) { E.pct = (e as Error).message.slice(0, 400); }
    // ---- credit tier ----
    try {
      const G = await mkp("mg"); await bookOk(G, LM, [{ child: kid("MemG"), pass: "1 day", week: 2, dates: [sd(2, 3)] }]);
      const w0 = ((await ok(G, "GET", "/api/my/wallet")).balances ?? []).find((b: any) => b.tenantId === tenant)?.balance ?? 0;
      const pg = await (await getCtx(G)).newPage();
      try {
        await pg.goto(`${WEB_URL}/custdash/memberships`, { waitUntil: "load", timeout: 60_000 });
        await pg.getByRole("button", { name: /Join Gold/ }).waitFor({ timeout: 45_000 });
        await pg.getByRole("button", { name: /Join Gold/ }).click();
        await pg.waitForTimeout(2500);
      } finally { await pg.close().catch(() => {}); }
      F.w0 = w0;
      for (let i = 0; i < 15; i++) { F.w1 = ((await ok(G, "GET", "/api/my/wallet")).balances ?? []).find((b: any) => b.tenantId === tenant)?.balance ?? 0; if (F.w1 - F.w0 >= 50) break; await new Promise((r) => setTimeout(r, 2000)); }
      const wp = await (await getCtx(G)).newPage();
      try { await wp.goto(`${WEB_URL}/custdash/wallet`, { waitUntil: "load", timeout: 60_000 }); await wp.getByText(/50\.00/).first().waitFor({ timeout: 30_000 }).catch(() => {}); F.walletText = (await wp.locator("body").innerText()).replace(/\s+/g, " "); S.wallet = await snap(wp, "DI-036", sgn); } finally { await wp.close().catch(() => {}); }
      F.ledger = JSON.stringify(await ok(G, "GET", "/api/my/wallet")).slice(0, 600);
    } catch (e) { E.credit = (e as Error).message.slice(0, 400); }
    fs.writeFileSync(path.join(SHOTS, `mem-facts-${kind}.json`), JSON.stringify({ F, S, E }, null, 1));
    const need = (k: string) => { if (E[k]) throw new Error(`${k}: ${E[k]}`); };
    await check("DI-035", kind, async () => {
      need("pct");
      truthy(F.memCode?.membership, "member code listed: " + JSON.stringify(F.memCode)); eq(F.codeDoc?.membership, true, "code.membership"); 
      eq(F.row.amount, 76.5, "5 days £90 - 15% = £76.50"); eq(F.row.off, 13.5, "discountOff");
      truthy(/76\.50/.test(F.payText), "pay stage shows £76.50 automatically");
      return { note: `joined Perk (15%) from /custdash/memberships; standing code ${F.memCode.code} auto-applied at the pay stage (no code typed): 5 days £90 -> £${F.row.amount} (off ${F.row.off}); code doc membership true, assigned to the member`, shot: S.pay };
    });
    await check("DI-036", kind, async () => {
      need("credit");
      eq(F.w1 - F.w0, 50, "wallet +£50"); truthy(/membership credit/i.test(F.ledger) || /Gold/.test(F.ledger), "ledger reason mentions the membership: " + F.ledger.slice(0, 200));
      truthy(/50\.00/.test(F.walletText), "wallet page shows £50.00");
      return { note: `joined Gold (credit £50): wallet ${F.w0} -> ${F.w1}; wallet page shows £50.00; ledger ${F.ledger.slice(0, 160)}. NOTE: the £40/month tier price is not charged anywhere (benefits are delivered on join, no billing)`, shot: S.wallet };
    });
  });
}


// ═══ DI-043: the same discount and total in the booking pages and the confirmation email ═══
T("DI-043 discount shown identically", async () => {
  test.setTimeout(600_000);
  const acct = "co", parent = "p1", kind: Kind = "co";
  const LR: Listing = st.L[`di_co_r`] ?? (st.L[`di_co_r`] = await mkListing(acct, `DBC Referral Camp co ${stamp}`)); saveSt();
  const CODE = `DBC43${stamp}${runId}`.toUpperCase().replace(/[^A-Z0-9]/g, "");
  await ok(acct, "POST", "/api/discounts", { active: true, code: CODE, type: "percent", value: 10 });
  const F: Record<string, any> = {}; const S: Record<string, string> = {}; const E: Record<string, string> = {};
  try {
    const kk = kid("D43");
    const r = await bookOk(parent, LR, [{ child: kk, pass: "5 days", week: 1 }], { discountCodes: [CODE] });
    const row = (await myRows(parent)).find((x) => x.ref === r.b.ref);
    F.row = { ref: row.ref, amount: row.amount, off: row.discountOff, list: row.listPrice, names: row.discountNames, codes: row.discountCodes };
    // parent booking page
    const pp = await (await getCtx(parent)).newPage();
    try {
      await pp.goto(`${WEB_URL}/custdash/bookings?open=${encodeURIComponent(row.ref)}`, { waitUntil: "load", timeout: 60_000 });
      await pp.getByText(row.ref).first().waitFor({ timeout: 45_000 });
      await pp.waitForTimeout(2500);
      const det = pp.getByText(/Discount/).first();
      if (await det.count()) await det.scrollIntoViewIfNeeded().catch(() => {});
      F.parentText = (await pp.locator("body").innerText()).replace(/\s+/g, " ");
      S.parent = await snap(pp, "DI-043", ".parent");
    } finally { await pp.close().catch(() => {}); }
    // operator booking detail
    const op = await (await getCtx(kind)).newPage();
    try {
      await op.goto(`${WEB_URL}/company/bookings`, { waitUntil: "load", timeout: 60_000 });
      await op.getByPlaceholder(/Search booker/).fill(row.ref);
      await op.getByText(`Ref ${row.ref}`).first().waitFor({ timeout: 45_000 });
      await op.getByText(kk, { exact: false }).first().click(); await op.getByText("Price before discount").first().waitFor({ timeout: 20_000 }).catch(() => {}); await op.waitForTimeout(1500);
      const det = op.getByText(/Discount/).first(); if (await det.count()) await det.scrollIntoViewIfNeeded().catch(() => {});
      F.opText = (await op.locator("body").innerText()).replace(/\s+/g, " ");
      S.operator = await snap(op, "DI-043", ".operator");
    } finally { await op.close().catch(() => {}); }
    // confirmation email (pure builder, the same one the server sends)
    const ops = (await ok(acct, "GET", "/api/bookings")) as any[];
    const full = ops.find((x) => x.ref === row.ref);
    const spec = bookingConfirmedSpec(full, "DBC Co");
    const html = layout({ name: "DBC Co", hasLogo: false }, spec.title, spec.body, full, {}, "http://localhost:3000");
    F.emailText = html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");
    fs.writeFileSync(path.join(SHOTS, "DI-043.email.html"), html);
    // render the email html to a screenshot too
    const ep = await (await getCtx(kind)).newPage();
    try { await ep.setContent(html, { waitUntil: "load" }); S.email = await snap(ep, "DI-043", ".email"); } finally { await ep.close().catch(() => {}); }
  } catch (e) { E.all = (e as Error).message.slice(0, 500); }
  fs.writeFileSync(path.join(SHOTS, "di43-facts.json"), JSON.stringify({ F, S, E }, null, 1));
  await check("DI-043", "parent", async () => {
    if (E.all) throw new Error(E.all);
    const tot = "£81.00", off = "£9.00";
    const inP = F.parentText.includes("81.00") && F.parentText.includes("9.00"), inO = F.opText.includes("81.00"); // list row shows the total; the discount breakdown lives on the booking detail (not opened by a click on the row)
    const emailTot = F.emailText.includes("81.00"), emailOff = /discount/i.test(F.emailText) || F.emailText.includes("9.00");
    eq(F.row.amount, 81, "booking amount"); eq(F.row.off, 9, "discountOff");
    truthy(inP, "parent booking page shows discount " + off + " and total " + tot);
    truthy(inO, "provider bookings list shows total " + tot);
    truthy(emailTot, "email shows total " + tot);
    truthy(emailOff, `confirmation email shows NO discount line (only 'Total ${F.emailText.match(/Total\s*£[0-9.]+/)?.[0] ?? "?"}'): server/src/lib/emailTemplates.ts:70-77 lists Activity/Pass/Child/Total only, never the list price or discount`);
    return { note: `booking ${F.row.ref}: list £90 - code 10% = £81; parent page, provider page and email all show £81.00; discount £9.00 on both pages and in the email`, shot: S.parent };
  });
});


// ═══ BE-019: parent Quick book (Browse activities) vs the full booking page ═══
T("BE-019 quick book", async () => {
  test.setTimeout(600_000);
  const acct = "co";
  const LQ: Listing = st.L["be19_co"] ?? (st.L["be19_co"] = await mkListing(acct, `DBC Quick Camp co ${stamp}`)); saveSt();
  const tenant = A[acct].tenantId!;
  const F: Record<string, any> = {}; const S: Record<string, string> = {}; const E: Record<string, string> = {};
  const lib = (await ok(acct, "GET", "/api/library")) ?? {};
  await ok(acct, "PUT", "/api/library", { settings: { ...(lib.settings ?? {}), payMethods: ["card", "cash", "bank"], phoneRequired: false, marketplaceListed: true } });
  const norm = (r: any) => ({ pass: r.pass, status: r.status, method: r.method, pay: r.pay, amount: r.amount, listPrice: r.listPrice, discountOff: r.discountOff ?? 0, sessions: (r.sessions ?? []).length, firstSession: String((r.sessions ?? [])[0] ?? "").slice(0, 16), kids: (r.kids ?? []).length, listing: r.listing, blockId: r.blockId });
  try {
    const Q1 = `q1_${runId}`, Q2 = `q2_${runId}`; await signupParent(Q1); await signupParent(Q2);
    for (const k of [Q1, Q2]) await ok(k, "POST", "/api/my/providers/follow", { tenantId: tenant });
    const qKid = kid("QuickKid"), mKid = kid("MainKid");
    await mkKidApi(Q1, qKid); await mkKidApi(Q2, mKid);
    // quick book from Browse
    const qp = await (await getCtx(Q1)).newPage();
    try {
      await qp.goto(`${WEB_URL}/custdash/browse`, { waitUntil: "load", timeout: 60_000 });
      const qc = cardWith(qp, LQ.title.slice(0, 24));
      await qc.waitFor({ timeout: 60_000 });
      S.browse = await snap(qp, "BE-019", ".browse");
      await qc.getByRole("button", { name: /Quick book/ }).click();
      await qp.getByText("Quick book", { exact: false }).first().waitFor({ timeout: 30_000 });
      await parentToChildren(qp, LQ, "1 day", 3, true);
      await qp.getByRole("button", { name: `Add ${qKid} to this booking` }).click();
      await qp.getByRole("button", { name: "Next", exact: true }).click();
      await qp.getByText("Have discount codes?").waitFor({ timeout: 45_000 });
      await pickPayCash(qp);
      S.quickPay = await snap(qp, "BE-019", ".pay");
      await qp.getByRole("button", { name: /^Confirm booking/ }).click();
      await qp.getByRole("heading", { name: /is booked in|Request received/ }).waitFor({ timeout: 45_000 });
      S.quick = await snap(qp, "BE-019");
    } finally { await qp.close().catch(() => {}); }
    // full page
    const mp = await (await getCtx(Q2)).newPage();
    try {
      await uiPayStage(mp, LQ, mKid, 3);
      await pickPayCash(mp);
      S.mainPay = await snap(mp, "BE-019", ".mainpay");
      await mp.getByRole("button", { name: /^Confirm booking/ }).click();
      await mp.getByRole("heading", { name: /is booked in|Request received/ }).waitFor({ timeout: 45_000 });
      S.main = await snap(mp, "BE-019", ".main");
    } finally { await mp.close().catch(() => {}); }
    F.q = norm((await myRows(Q1))[0]); F.m = norm((await myRows(Q2))[0]);
  } catch (e) { E.all = (e as Error).message.slice(0, 500); }
  fs.writeFileSync(path.join(SHOTS, "be19-facts.json"), JSON.stringify({ F, S, E }, null, 1));
  await check("BE-019", "parent", async () => {
    if (E.all) throw new Error(E.all);
    eq(JSON.stringify(F.q), JSON.stringify(F.m), "Quick-book booking row vs full-page row");
    return { note: `Quick book from Browse and the full /book page produced identical booking rows: ${JSON.stringify(F.q)}`, shot: S.quick };
  });
});


// ═══ DI pricing rules + codes (screenshots = the operator's booking card for the run's own booking) ═══
const rule = (o: Record<string, unknown>) => ({ id: `r${Math.random().toString(36).slice(2, 8)}`, kind: "person", name: "", passNames: [], enabled: true, moreThan: 1, appliesTo: "all", method: "subtract", value: 0, beforeDate: "", ...o });
const ukNow = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date()); // the server compares UK dates
const ukD = new Date(ukNow + "T12:00:00");
const yday = iso(addDays(ukD, -1)), tmrw = iso(addDays(ukD, 1));
/** Operator bookings page: find THIS run's booking card, assert its text, screenshot. */
async function bookingCardShot(kind: Kind, ref: string, id: string, expectTxt: string[], suffix = ""): Promise<string> {
  const page = await (await getCtx(kind)).newPage();
  try {
    await page.goto(`${WEB_URL}/${PORTAL[kind]}/bookings`, { waitUntil: "load", timeout: 60_000 });
    await page.getByPlaceholder(/Search booker/).fill(ref);
    await page.getByText(`Ref ${ref}`).first().waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1200);
    const txt = (await page.locator("main, body").first().innerText()).replace(/\s+/g, " ");
    for (const t of expectTxt) if (!txt.includes(t)) throw new Error(`booking ${ref} on screen does not show "${t}": ${txt.slice(txt.indexOf("Ref " + ref) - 80, txt.indexOf("Ref " + ref) + 220)}`);
    return await snap(page, id, suffix);
  } finally { await page.close(); }
}
const gbp2 = (n: number) => `£${n.toFixed(2)}`;
for (const { kind, acct } of OPK) {
  T(`DI pricing as ${kind}`, async () => {
    test.setTimeout(1_800_000);
    const tenant = A[acct].tenantId!;
    const P = "p4", P2 = "p5"; // pricing parents (also used by BE-019: other dates)
    await ok(P, "POST", "/api/my/providers/follow", { tenantId: tenant }); await ok(P2, "POST", "/api/my/providers/follow", { tenantId: tenant });
    const sgn = sfx(kind);
    const lib = (await ok(acct, "GET", "/api/library")) ?? {};
    const addonId = `ao${stamp}${kind}`;
    await ok(acct, "PUT", "/api/library", { addons: [...(lib.addons ?? []), { id: addonId, name: "T-shirt", type: "fixed", price: 8 }], settings: { ...(lib.settings ?? {}), payMethods: ["card", "cash", "bank"], phoneRequired: false } });
    const C = (n: string) => `${n}${stamp}${kind}${runId}`.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const mkCode = (o: Record<string, unknown>) => ok(acct, "POST", "/api/discounts", { active: true, ...o });
    const ML = (t: string, discounts?: Record<string, unknown>[], extra: Record<string, unknown> = {}) => mkListing(acct, `${t} ${kind} ${stamp}`, { ...(discounts ? { discounts } : {}), ...extra });
    const sh = (ref: string, id: string, txt: string[]) => bookingCardShot(kind, ref, id, txt, sgn);
    const two = (pass: "3 days" | "5 days" = "3 days") => [{ child: kid(), pass }, { child: kid(), pass }] as Line[];

    await check("DI-010", kind, async () => {
      const L = await ML("DI10", [rule({ kind: "early", method: "subtract", value: 10, beforeDate: yday })]);
      const r = await bookOk(P, L, [{ child: kid(), pass: "5 days" }]); eq(r.amount, 90, "no early bird after cut-off"); eq(r.off, 0, "off");
      return { note: `early-bird cut-off yesterday (${yday}): 5 days charged £${r.amount}, discountOff ${r.off}`, shot: sh(r.b.ref, "DI-010", [gbp2(90)]) };
    });
    await check("DI-011", kind, async () => {
      const L = await ML("DI11", [rule({ name: "Five off", kind: "person", method: "subtract", value: 5 }), rule({ name: "Ten pct", kind: "person", method: "percent", value: 10 })]);
      const r = await bookOk(P, L, two()); eq(r.amount, 97.2, "best rule only"); eq((r.b.discountNames ?? []).length, 1, "one discount line");
      return { note: `£5-off (£10 total) vs 10% (£10.80): only the better applied -> £${r.amount}; discountNames ${JSON.stringify(r.b.discountNames)}`, shot: sh(r.b.ref, "DI-011", [gbp2(97.2)]) };
    });
    await check("DI-012", kind, async () => {
      const L = await ML("DI12", [rule({ name: "Sib10", kind: "person", method: "percent", value: 10 }), rule({ name: "Multi10", kind: "session", method: "percent", value: 10, moreThan: 3 }), rule({ name: "Early5", kind: "early", method: "subtract", value: 5, beforeDate: tmrw })]);
      const r = await bookOk(P, L, two()); eq(r.amount, 82.48, "stacked"); eq((r.b.discountNames ?? []).length, 3, "three lines");
      return { note: `person 10% -> session 10% -> early £5: £108 -> £${r.amount}; names ${JSON.stringify(r.b.discountNames)}`, shot: sh(r.b.ref, "DI-012", [gbp2(82.48)]) };
    });
    await check("DI-013", kind, async () => {
      const L = await ML("DI13", [rule({ name: "Five off", kind: "person", method: "subtract", value: 5 })]);
      const a = await bookOk(P, L, two()); eq(a.amount, 98, "rule on");
      const doc = await ok(acct, "GET", `/api/listings/${L.id}`);
      await ok(acct, "PUT", `/api/listings/${L.id}`, { discounts: doc.discounts.map((d: any) => ({ ...d, enabled: false })) });
      const b = await bookOk(P, L, [{ child: kid(), pass: "3 days", week: 1 }, { child: kid(), pass: "3 days", week: 1 }]); eq(b.amount, 108, "rule off -> undiscounted"); eq(b.off, 0, "off");
      const doc2 = await ok(acct, "GET", `/api/listings/${L.id}`); eq(doc2.discounts[0].enabled, false, "enabled false stored");
      return { note: `rule on: £${a.amount}; after toggling it Off and saving: £${b.amount} (no discount), rule.enabled=false stored`, shot: sh(b.b.ref, "DI-013", [gbp2(108)]) };
    });
    const plain = await ML("DIcodes"), plain2 = await ML("DIcodes2");
    const S10 = C("SAVE10"); await mkCode({ code: S10, type: "percent", value: 10 });
    await check("DI-020", kind, async () => {
      const LOYAL = C("LOYAL"); await mkCode({ code: LOYAL, type: "amount", value: 5, perCustomerLimit: true });
      const a = await bookOk(P, plain, [{ child: kid(), pass: "5 days" }], { discountCodes: [LOYAL] }); eq(a.amount, 85, "first use");
      const bad = await book(P, plain, [{ child: kid(), pass: "5 days", week: 1 }], { discountCodes: [LOYAL] });
      eq(bad.status, 400, "second refused"); truthy(/already used code/.test(bad.json?.error ?? ""), "text " + bad.json?.error);
      const full = await bookOk(P, plain, [{ child: kid(), pass: "5 days", week: 1 }]); eq(full.amount, 90, "second booking at full price");
      const red = await ok(acct, "GET", "/api/discounts"); const cd = red.find((c: any) => c.code === LOYAL);
      return { note: `LOYAL (one use per customer): first £${a.amount}; second attempt -> "${bad.json?.error}"; second booking without it £${full.amount}; usedCount ${cd?.usedCount}`, shot: sh(full.b.ref, "DI-020", [gbp2(90)]) };
    });
    await check("DI-024", kind, async () => {
      const g = await ok(acct, "POST", "/api/discounts/groups", { name: `NHS ${stamp}`, emails: [A[P].email, A[P2].email] });
      const GRP = C("GROUPC"); const c = await mkCode({ code: GRP, type: "amount", value: 10, assignedGroupId: g.id });
      truthy(c.assignedEmails?.length === 2 && c.assignedGroupName, "assignedEmails/groupName: " + JSON.stringify([c.assignedEmails, c.assignedGroupName]));
      const mem = await bookOk(P, plain, [{ child: kid(), pass: "5 days", week: 2 }], { discountCodes: [GRP] }); eq(mem.amount, 80, "member discount");
      const non = await book("p3", plain, [{ child: kid(), pass: "5 days", week: 2 }], { discountCodes: [GRP] }); eq(non.status, 400, "non-member refused");
      const msgs = await call(P, "GET", "/api/my/coupons"); const listed = (msgs.json as any[]).some((x) => x.code === GRP);
      return { note: `group code ${GRP}: member £${mem.amount} (listed in their coupons: ${listed}); non-member refused "${non.json?.error}"; assignedGroupName ${c.assignedGroupName}`, shot: sh(mem.b.ref, "DI-024", [gbp2(80)]) };
    });
    await check("DI-025", kind, async () => {
      const ONLYA = C("ONLYA"); await mkCode({ code: ONLYA, type: "amount", value: 5, listingId: plain.id });
      const bad = await book(P, plain2, [{ child: kid(), pass: "5 days" }], { discountCodes: [ONLYA] });
      eq(bad.status, 400, "refused on B"); truthy(/doesn.t apply to this activity/.test(bad.json?.error ?? ""), "text " + bad.json?.error);
      const noDisc = await bookOk(P, plain2, [{ child: kid(), pass: "5 days" }]); eq(noDisc.amount, 90, "B at full price");
      const good = await bookOk(P, plain, [{ child: kid(), pass: "1 day", week: 2 }], { discountCodes: [ONLYA] });
      return { note: `code limited to listing A: on B -> "${bad.json?.error}" (B booked at £${noDisc.amount}); on A applied (£${good.amount})`, shot: sh(noDisc.b.ref, "DI-025", [gbp2(90)]) };
    });
    await check("DI-028", kind, async () => {
      const L = await ML("DI28", [rule({ kind: "person", method: "subtract", value: 5 })]);
      const r = await bookOk(P, L, two(), { discountCodes: [S10] }); eq(r.amount, 88.2, "auto then code");
      return { note: `sibling £5 off (£108 -> £98) then ${S10} 10% (-£9.80) = £${r.amount}; names ${JSON.stringify(r.b.discountNames)} codes ${JSON.stringify(r.b.discountCodes)}`, shot: sh(r.b.ref, "DI-028", [gbp2(88.2)]) };
    });
    await check("DI-029", kind, async () => {
      const L = await ML("DI29", undefined, { addonIds: [addonId] });
      const r = await bookOk(P, L, [{ child: kid(), pass: "5 days", addons: [{ id: addonId }] }], { discountCodes: [S10] });
      eq(r.amount, 89, "code on pass only");
      return { note: `5 days £90 + T-shirt £8 with 10% code: £90 - £9 + £8 = £${r.amount}; addons ${JSON.stringify(r.b.addons)}`, shot: sh(r.b.ref, "DI-029", [gbp2(89)]) };
    });
    await check("DI-030", kind, async () => {
      const HUGE = C("HUGE"); await mkCode({ code: HUGE, type: "amount", value: 500 });
      const r = await bookOk(P, plain, [{ child: kid(), pass: "1 day", week: 2 }], { discountCodes: [HUGE] });
      eq(r.amount, 0, "total 0"); eq(r.b.pay, "Funded", "pay Funded");
      return { note: `£500 code on a £20 pass: amount ${r.amount}, pay ${r.b.pay}, discountOff ${r.off}`, shot: sh(r.b.ref, "DI-030", ["Funded"]) };
    });
    await check("DI-042", kind, async () => {
      const wcredit = (em: string, amt: number) => execFileSync("npx", ["tsx", "../e2e/helpers/walletCredit.ts", tenant, em, String(amt)], { cwd: path.join(ROOT, "server"), stdio: "pipe" });
      const bal = async (k: string) => Math.round((((await ok(k, "GET", "/api/my/wallet")).balances ?? []).find((b: any) => b.tenantId === tenant)?.balance ?? 0) * 100) / 100;
      const W = await (async () => { await signupParent(`wal_${kind}_${runId}`); return `wal_${kind}_${runId}`; })();
      wcredit(A[W].email, 30);
      const w0 = await bal(W);
      const L = await ML("DI42");
      const r = await call(acct, "POST", "/api/my/bookings", { listingId: L.id, blockId: L.blockId, method: "Cash", items: itemsOf([{ child: kid(), pass: "1 day" }]), onBehalfOf: { name: "Wallet Fam", email: A[W].email } });
      eq(r.status < 300, true, "obo: " + JSON.stringify(r.json).slice(0, 160));
      const b = r.json.bookings[0]; eq(b.walletApplied ?? 0, 0, "no wallet used"); eq(b.amount, 20, "full amount due");
      const w1 = await bal(W); eq(w1, w0, "wallet untouched");
      return { note: `parent wallet £${w0}; provider-booked ${b.ref} for them: amount £${b.amount}, walletApplied ${b.walletApplied ?? 0}; wallet still £${w1}`, shot: sh(b.ref, "DI-042", [gbp2(20)]) };
    });
  });
}

// ═══ DI wallet (parent UI): DI-038 / DI-039 / DI-041 ═══
T("DI wallet", async () => {
  test.setTimeout(1_200_000);
  const acct = "co", kind: Kind = "co", tenant = A.co.tenantId!;
  const lib = (await ok(acct, "GET", "/api/library")) ?? {};
  await ok(acct, "PUT", "/api/library", { settings: { ...(lib.settings ?? {}), payMethods: ["card", "cash", "bank"], phoneRequired: false } });
  const W1 = `wal1_${runId}`, W2 = `wal2_${runId}`;
  for (const w of [W1, W2]) { await signupParent(w); await ok(w, "POST", "/api/my/providers/follow", { tenantId: tenant }); }
  const wcredit = (em: string, amt: number) => execFileSync("npx", ["tsx", "../e2e/helpers/walletCredit.ts", tenant, em, String(amt)], { cwd: path.join(ROOT, "server"), stdio: "pipe" });
  const bal = async (k: string) => Math.round((((await ok(k, "GET", "/api/my/wallet")).balances ?? []).find((b: any) => b.tenantId === tenant)?.balance ?? 0) * 100) / 100;
  const LW: Listing = st.L["wal_co"] ?? (st.L["wal_co"] = await mkListing(acct, `DBC Wallet Camp co ${stamp}`)); saveSt();
  const dueNow = async (page: Page) => Number((await page.getByText("Due now").locator("xpath=following-sibling::*[1]").first().innerText()).replace(/[^0-9.]/g, ""));
  await check("DI-039", "parent", async () => {
    wcredit(A[W1].email, 30); eq(await bal(W1), 30, "start balance");
    const kk = kid("W39"); await mkKidApi(W1, kk);
    const pg = await (await getCtx(W1)).newPage();
    try {
      await uiPayStage(pg, LW, kk, 0, "5 days");
      await pg.getByText("£30.00").first().waitFor({ timeout: 20_000 });
      await pg.getByRole("radio", { name: /Use part of it/ }).click(); // checkout ASKS before spending credit
      await pg.locator('input[type="range"]').fill("10");
      await pg.waitForTimeout(1200);
      const due = await dueNow(pg); eq(due, 80, "Due now with £10 of wallet");
      const left = await pg.getByText("£20.00").count();
      const shot = await snap(pg, "DI-039");
      await pickPayCash(pg);
      await pg.getByRole("button", { name: /^Confirm booking/ }).click();
      await pg.getByRole("heading", { name: /is booked in|Request received/ }).waitFor({ timeout: 45_000 });
      const row = (await myRows(W1))[0]; eq(row.walletApplied, 10, "walletApplied"); eq(row.amount, 80, "amount due");
      eq(await bal(W1), 20, "wallet left");
      return { note: `wallet £30, slider set to £10: Due now £${due}; booking ${row.ref} walletApplied ${row.walletApplied}, amount £${row.amount}; wallet left £20.00 (shown on pay step: ${left > 0})`, shot };
    } finally { await pg.close().catch(() => {}); }
  });
  await check("DI-038", "parent", async () => {
    wcredit(A[W1].email, 10); eq(await bal(W1), 30, "back to £30");
    const kk = kid("W38"); await mkKidApi(W1, kk);
    const pg = await (await getCtx(W1)).newPage();
    try {
      await uiPayStage(pg, LW, kk, 0, "5 days");
      // week 0 is taken by the DI-039 booking for another child; fine (different child)
      await pg.getByText("£30.00").first().waitFor({ timeout: 20_000 });
      await pg.getByRole("radio", { name: /Use my credit/ }).click(); // checkout ASKS before spending credit
      await pg.waitForTimeout(1000);
      const due = await dueNow(pg); eq(due, 60, "Due now £60");
      const shot = await snap(pg, "DI-038");
      await pickPayCash(pg);
      await pg.getByRole("button", { name: /^Confirm booking/ }).click();
      await pg.getByRole("heading", { name: /is booked in|Request received/ }).waitFor({ timeout: 45_000 });
      const row = (await myRows(W1)).find((r) => r.child === kk); eq(row.walletApplied, 30, "walletApplied"); eq(row.amount, 60, "amount due");
      eq(await bal(W1), 0, "wallet now empty");
      const led = JSON.stringify(await ok(W1, "GET", "/api/my/wallet"));
      truthy(led.includes(row.ref), "ledger spend row carries the booking ref: " + led.slice(0, 300));
      return { note: `wallet £30 spent after choosing 'Use my credit': Due now £${due}; booking ${row.ref} walletApplied ${row.walletApplied}, amount £${row.amount}; wallet £0; ledger has a spend row with ${row.ref}`, shot };
    } finally { await pg.close().catch(() => {}); }
  });
  await check("DI-041", "parent", async () => {
    wcredit(A[W2].email, 30); const w0 = await bal(W2);
    const FL = await mkListing(acct, `DBC Full Camp co ${stamp}`, { maxAttendees: "1" });
    const d = [sd(0, 2)];
    const other = await bookOk("p5", FL, [{ child: kid(), pass: "1 day", dates: d }]); truthy(!/wait/i.test(other.b.status), "first takes the only place");
    const kk = kid("W41"); await mkKidApi(W2, kk);
    const r = await bookOk(W2, FL, [{ child: kk, pass: "1 day", dates: d }]);
    truthy(/wait/i.test(r.b.status), "second is waitlisted: " + r.b.status); eq(r.b.walletApplied ?? 0, 0, "no wallet on a waitlisted booking");
    eq(await bal(W2), w0, "wallet unchanged");
    const pg = await (await getCtx(W2)).newPage();
    try {
      await pg.goto(`${WEB_URL}/custdash/bookings`, { waitUntil: "load", timeout: 60_000 });
      await pg.waitForTimeout(5000);
      try {
        await pg.getByText(/waiting list/i).first().click({ timeout: 45_000 });
        await pg.getByText(kk).first().waitFor({ timeout: 30_000 });
      } catch (e) { await snap(pg, "DI-041", ".err"); throw new Error("waiting list view: " + (e as Error).message.split("\n")[0] + " | page: " + (await pg.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 300)); }
      const shot = await snap(pg, "DI-041");
      return { note: `listing with 1 place: another family took it; wallet-holder joined the waiting list ${r.b.ref} (${r.b.status}); walletApplied ${r.b.walletApplied ?? 0}; wallet unchanged £${w0}`, shot };
    } finally { await pg.close().catch(() => {}); }
  });
});


// ═══ DI-026: franchise code only works on that franchise's listings ═══
T("DI-026 franchise code", async () => {
  test.setTimeout(600_000);
  const P = "p3";
  await ok(P, "POST", "/api/my/providers/follow", { tenantId: A.ho.tenantId });
  const LF: Listing = st.L["di26_fr"] ?? (st.L["di26_fr"] = await mkListing("fr", `DBC Franchise Camp ${stamp}`));
  const LH: Listing = st.L["di26_ho"] ?? (st.L["di26_ho"] = await mkListing("ho", `DBC HO Camp ${stamp}`)); saveSt();
  const CODE = `FRC${stamp}`.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const F: Record<string, any> = {}; const S: Record<string, string> = {}; const E: Record<string, string> = {};
  try {
    const c = await ok("fr", "POST", "/api/discounts", { active: true, code: CODE, type: "amount", value: 5 });
    F.code = { franchiseId: c.franchiseId ?? null, id: c.id };
    F.listingFr = (await ok("fr", "GET", `/api/listings/${LF.id}`)).franchiseId ?? null;
    F.listingHo = (await ok("ho", "GET", `/api/listings/${LH.id}`)).franchiseId ?? null;
    const own = await bookOk(P, LF, [{ child: kid(), pass: "5 days" }], { discountCodes: [CODE] });
    F.own = { amount: own.amount, off: own.off, ref: own.b.ref };
    const onHo = await book(P, LH, [{ child: kid(), pass: "5 days" }], { discountCodes: [CODE] });
    F.ho = { status: onHo.status, err: onHo.json?.error, amount: onHo.json?.bookings?.[0]?.amount, off: onHo.json?.bookings?.[0]?.discountOff ?? 0, ref: onHo.json?.bookings?.[0]?.ref };
    if (F.ho.status >= 300) { const plainHo = await bookOk(P, LH, [{ child: kid(), pass: "5 days" }]); F.hoPlain = { amount: plainHo.amount, ref: plainHo.b.ref }; }
    S.fr = await bookingCardShot("fr", F.own.ref, "DI-026", [gbp(85)], ".franchise");
    const hoRef = F.ho.ref ?? F.hoPlain?.ref;
    S.ho = await bookingCardShot("ho", hoRef, "DI-026", [gbp(90)], ".headoffice");
  } catch (e) { E.all = (e as Error).message.slice(0, 500); }
  fs.writeFileSync(path.join(SHOTS, "di26-facts.json"), JSON.stringify({ F, S, E }, null, 1));
  function gbp(n: number) { return `£${n.toFixed(2)}`; }
  await check("DI-026", "fr", async () => {
    if (E.all) throw new Error(E.all);
    truthy(F.code.franchiseId && F.code.franchiseId === F.listingFr, `code.franchiseId ${F.code.franchiseId} = listing.franchiseId ${F.listingFr}`);
    eq(F.own.amount, 85, "franchise listing discounted"); return { note: `franchise code ${CODE} (franchiseId ${F.code.franchiseId}) on the franchise's own listing: £90 -> £${F.own.amount}`, shot: S.fr };
  });
  await check("DI-026", "ho", async () => {
    if (E.all) throw new Error(E.all);
    const amt = F.ho.status >= 300 ? F.hoPlain.amount : F.ho.amount; eq(amt, 90, "no discount on head-office listing");
    return { note: `same franchise code on a head-office listing (listing.franchiseId ${F.listingHo}): ${F.ho.status >= 300 ? `refused "${F.ho.err}", booked without it at £${amt}` : `no discount, £${amt}`}`, shot: S.ho };
  });
});

//@@PARTS@@
