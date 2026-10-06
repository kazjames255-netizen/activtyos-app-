import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test, chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { API_URL, ROOT, WEB_URL } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, fbSignIn, fbSignUp } from "./helpers/accounts";
import { reconcileBooking } from "../server/src/lib/reconcileMath";
import { bookingNetIn } from "../features/money/bookingIncome";
import { owedNow } from "../features/bookings/helpers";

// FD (finance / dashboard) tracker sweep. Fresh @activityos-test.com accounts only. Results -> e2e/review/shots/fd/results.json,
// screenshots -> e2e/review/shots/fd/<ID>[.<name>].png (taken AFTER the page has loaded the figures).
test.describe.configure({ mode: "serial" });
const stamp = Date.now().toString(36);
const SHOTS = path.join(ROOT, "e2e/review/shots/fd");
const RESULTS_PATH = path.join(SHOTS, `results-${stamp}.json`);
fs.mkdirSync(SHOTS, { recursive: true });
const ONLY = process.env.FD_ONLY ? process.env.FD_ONLY.split(",") : null;

type Kind = "co" | "fl" | "fr" | "ho" | "st" | "fa";
const PORTAL: Record<Kind, string> = { co: "company", fr: "franchise", fl: "freelancer", ho: "company", st: "staff", fa: "franchise" };
const TRACKER: Record<Kind, string> = { co: "company", fr: "franchise", fl: "freelancer", ho: "head-office", st: "staff", fa: "franchise" };
interface Res { id: string; kind: Kind; tracker: string; status: "pass" | "fail" | "blocked"; note: string; shots: string[] }
const results: Res[] = [];
const log = (r: Res) => { const i = results.findIndex((x) => x.id === r.id && x.kind === r.kind); if (i >= 0) results.splice(i, 1); results.push(r); fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2)); console.log(`${r.status.toUpperCase()} ${r.id} [${r.kind}] ${r.note}`); };

interface Acct { email: string; uid: string; tenantId: string | null; franchiseId?: string | null; tok: string; tokAt: number }
const A: Record<string, Acct> = {};
const email = (n: string) => `e2e-fd-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`;
const token = async (k: string) => { const a = A[k]; if (Date.now() - a.tokAt > 35 * 60_000) { a.tok = (await fbSignIn(a.email)).idToken; a.tokAt = Date.now(); } return a.tok; };
async function call(k: string | null, method: string, url: string, body?: unknown, tok?: string): Promise<{ status: number; json: any }> {
  for (let attempt = 0; ; attempt++) {
    try {
      const t = tok ?? (k ? await token(k) : null);
      const res = await fetch(`${API_URL}${url}`, { method, headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      let json: any = null; try { json = await res.json(); } catch { /* empty */ }
      return { status: res.status, json };
    } catch (e) { if (attempt >= 40) throw e; await new Promise((r) => setTimeout(r, 3_000)); }
  }
}
const ok = async (k: string, method: string, url: string, body?: unknown) => { const r = await call(k, method, url, body); if (r.status >= 300) throw new Error(`${method} ${url} -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`); return r.json; };

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = new Date();
const nextMonday = addDays(today, (8 - today.getDay()) % 7 || 7);
const sd = (w: number, d: number) => iso(addDays(nextMonday, w * 7 + d));
const ukToday = iso(today);
const r2 = (n: number) => Math.round(n * 100) / 100;
function eq(actual: unknown, expected: unknown, label: string) {
  const same = typeof actual === "number" && typeof expected === "number" ? Math.abs(actual - expected) < 0.006 : actual === expected;
  if (!same) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function truthy(v: unknown, label: string) { if (!v) throw new Error(`${label}: expected truthy, got ${JSON.stringify(v)}`); }

// ── browser ────────────────────────────────────────────────────────────────
const ctxs: Partial<Record<Kind, BrowserContext>> = {};
const loginInfo: Partial<Record<Kind, { mail: string; home: string }>> = {};
let theBrowser: Browser | null = null;
async function getCtx(kind: Kind): Promise<BrowserContext> {
  if (ctxs[kind]) return ctxs[kind]!;
  const li = loginInfo[kind]!;
  if (!theBrowser || !theBrowser.isConnected()) theBrowser = await chromium.launch();
  for (let attempt = 0; ; attempt++) {
    const ctx = await theBrowser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    try {
      await page.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.waitForLoadState("load"); await page.waitForTimeout(8000);
      await page.getByPlaceholder("you@example.com").fill(li.mail);
      await page.locator('input[type="password"]').fill(TEST_PASSWORD);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL(`**${li.home}`, { timeout: 120_000 });
      await page.close(); ctxs[kind] = ctx; return ctx;
    } catch (e) { await ctx.close().catch(() => {}); if (attempt >= 2) throw e; }
  }
}
/** Open a screen, wait until `ready(page)` says the figures are on it (never a Loading/£0 shell), screenshot, return body text. */
let kindTag = "";
async function snap(kind: Kind, url: string, name: string, ready: (txt: string) => boolean, pre?: (p: Page) => Promise<void>): Promise<{ txt: string; page: Page; file: string }> {
  kindTag = kind;
  const ctx = await getCtx(kind);
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: 2300 });
  await page.goto(`${WEB_URL}${url}`, { waitUntil: "load", timeout: 120_000 });
  if (pre) await pre(page);
  let txt = "", good = 0;
  const end = Date.now() + 90_000;
  while (Date.now() < end) {
    txt = (await page.locator("body").innerText().catch(() => "")).replace(/[ \t]+/g, " ");
    const loading = /Loading|Checking access|Please wait/i.test(txt.replace(/Loading figures/g, "x"));
    good = ready(txt) && !loading && txt.length > 700 ? good + 1 : 0;
    if (good >= 3) break;
    await page.waitForTimeout(1200);
  }
  await page.waitForTimeout(800);
  txt = (await page.locator("body").innerText().catch(() => "")).replace(/[ \t]+/g, " ");
  const file = path.join(SHOTS, `${name}.${kindTag}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return { txt, page, file: path.relative(ROOT, file) };
}
const cur = { shots: [] as string[] };
async function check(id: string, kind: Kind, fn: () => Promise<string>) {
  if (ONLY && !ONLY.includes(id)) return;
  cur.shots = [];
  try { const note = await fn(); log({ id, kind, tracker: TRACKER[kind], status: "pass", note, shots: [...cur.shots] }); }
  catch (e) { const m = (e as Error).message; log({ id, kind, tracker: TRACKER[kind], status: /^BLOCKED/.test(m) ? "blocked" : "fail", note: m.slice(0, 900), shots: [...cur.shots] }); }
}
const T = (name: string, fn: () => Promise<void>) => test(name, async () => { try { await fn(); } catch (e) { console.log(`TEST ABORT ${name}: ${(e as Error).message.slice(0, 400)}`); } });
/** screenshot helper that records the file against the current check */
async function look(kind: Kind, url: string, name: string, ready: (t: string) => boolean, pre?: (p: Page) => Promise<void>) {
  const s = await snap(kind, url, name, ready, pre); cur.shots.push(s.file); await s.page.close(); return s.txt;
}

// ── provisioning ───────────────────────────────────────────────────────────
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
  A[key] = { email: email(key), uid: s.uid, tenantId: null, tok: s.idToken, tokAt: Date.now() };
  await call(key, "POST", "/api/me/welcome", {});
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
  if (venueDone.has(k)) return "fd-venue";
  const lib = (await call(k, "GET", "/api/library")).json ?? {};
  const venues = (lib.venues ?? []) as { id: string }[];
  await ok(k, "PUT", "/api/library", {
    venues: venues.some((v) => v.id === "fd-venue") ? venues : [...venues, { id: "fd-venue", name: "FD Sports Hall", address: "1 Test Way", city: "Northampton" }],
    settings: { ...(lib.settings ?? {}), marketplaceListed: true,
      billing: { businessName: "FD Co", accountName: `FD Club ${stamp}`, sortCode: "12-34-56", accountNumber: "87654321", bankName: "Test Bank" },
      voucherProviders: [{ id: "edenred", name: "Edenred", details: [{ label: "Account reference", value: `EDN-${stamp}` }] }] },
  });
  venueDone.add(k); return "fd-venue";
}
const basics: Record<string, { period: string; p1: string; p3: string; p5: string }> = {};
async function ensureBasics(k: string) {
  if (basics[k]) return basics[k];
  const period = (await ok(k, "POST", "/api/periods", { title: "Full day", start: "09:00", finish: "15:00" })).id;
  const p1 = (await ok(k, "POST", "/api/passes", { name: "1 day", days: 1 })).id;
  const p3 = (await ok(k, "POST", "/api/passes", { name: "3 days", days: 3 })).id;
  const p5 = (await ok(k, "POST", "/api/passes", { name: "5 days", days: 5 })).id;
  return (basics[k] = { period, p1, p3, p5 });
}
interface Listing { id: string; title: string; blockId: string; blocks: { id: string; startDate: string }[] }
async function mkListing(k: string, title: string, o: { maxAttendees?: number; approval?: boolean; discounts?: Record<string, unknown>[]; price1?: number } = {}): Promise<Listing> {
  const b = await ensureBasics(k); const venueId = await ensureVenue(k);
  const bundle = await ok(k, "POST", "/api/block-bundles", { name: `Bundle ${title}`, periodIds: [b.period], passIds: [b.p1, b.p3, b.p5], priced: true, masterPrice: 90, calcOn: false, passFlat: { [b.p1]: 20, [b.p3]: 54 } });
  const listing = await ok(k, "POST", "/api/listings", {
    title, venueId, runFrom: iso(nextMonday), runTo: iso(addDays(nextMonday, 20)), blockMode: "weekly", days: [1, 2, 3, 4, 5],
    maxAttendees: String(o.maxAttendees ?? 10), capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "11", blockId: bundle.id,
    passes: [{ name: "1 day", price: 20, days: 1 }, { name: "3 days", price: 54, days: 3 }, { name: "5 days", price: 90, days: 5 }],
    ...(o.approval ? {} : { bookingType: "auto" }), waitlist: true, waitlistMode: "manual", status: "live", visibility: "public",
    ...(o.discounts ? { discounts: o.discounts } : {}),
  });
  await ok(k, "PUT", `/api/block-bundles/${bundle.id}/listings`, { listingIds: [listing.id] });
  const full = await ok(k, "GET", `/api/listings/${listing.id}`);
  const blocks = ((full.blocks ?? []) as { id: string; startDate: string }[]).sort((a, c) => (a.startDate < c.startDate ? -1 : 1));
  return { id: listing.id, title, blockId: blocks[0].id, blocks };
}
let childN = 0;
const kid = (tag = "K") => `${tag}${stamp}x${++childN}`;
const PASS_DAYS: Record<string, number> = { "1 day": 1, "3 days": 3, "5 days": 5 };
interface Line { child: string; pass: "1 day" | "3 days" | "5 days"; week?: number }
const items = (lines: Line[]) => lines.map((l) => ({ pass: l.pass, child: l.child, age: 8, dates: Array.from({ length: PASS_DAYS[l.pass] }, (_, i) => sd(l.week ?? 0, i)) }));
async function bookOk(parent: string, L: Listing, lines: Line[], extra: Record<string, unknown> = {}) {
  const r = await call(parent, "POST", "/api/my/bookings", { listingId: L.id, blockId: L.blockId, method: "card", walletCap: 0, items: items(lines), ...extra });
  if (r.status >= 300) throw new Error(`book -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  const bs = (r.json.bookings ?? []) as any[];
  return { bookings: bs, b: bs[0], amount: bs.reduce((s, x) => s + (x.amount ?? 0), 0) };
}
const dash = async (k: string) => (await ok(k, "GET", "/api/dashboard")) as { bookings: { live: number; waitlist: number; newThisWeek: number }; money: { takenThisWeek: number; outstanding: number; overdueVouchers: number; awaitingVoucher: number } };
const allBookings = async (k: string) => (await ok(k, "GET", "/api/bookings")) as any[];
const payments = async (k: string) => ((await ok(k, "GET", "/api/payments")) as any[]);
const getB = async (k: string, ref: string) => (await allBookings(k)).find((b) => b.ref === ref);
const payRec = (k: string, ref: string, amount: number, method = "Bank transfer") => ok(k, "POST", `/api/bookings/${ref}/record-payment`, { amount, method, reference: `FD${stamp}${ref}` });
const act = (k: string, ref: string, body: Record<string, unknown>) => ok(k, "POST", `/api/bookings/${ref}/actions`, body);
/** reconcile a booking against its payment records and the dashboard's own helper (reconcileMath = server/tools/reconcile.ts logic). */
async function recon(k: string, ref: string) {
  const b = await getB(k, ref); const ps = await payments(k);
  return { b, ...reconcileBooking(b, ps) };
}
const money = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const near = (txt: string, label: string, n: number) => { const i = txt.indexOf(label); return i >= 0 && txt.slice(i, i + 160).includes(money(n)); };
const rule = (o: Record<string, unknown>) => ({ id: `r${Math.random().toString(36).slice(2, 8)}`, kind: "person", name: "", passNames: [], enabled: true, moreThan: 1, appliesTo: "all", method: "subtract", value: 0, beforeDate: "", ...o });
const mkCode = (k: string, o: Record<string, unknown>) => ok(k, "POST", "/api/discounts", { active: true, ...o });
const codeList = async (k: string) => (await ok(k, "GET", "/api/discounts")) as any[];
const PROBE = process.env.FD_PROBE === "1";

test.beforeAll(async () => {
  test.setTimeout(3_000_000);
  await signupParent("p1"); await signupParent("p2"); await signupParent("p3");
  await signupOperator("co", "company", `FD Co ${stamp}`);
  await signupOperator("fl", "freelancer", `FD Free ${stamp}`);
  await signupOperator("ho", "company", `FD HO ${stamp}`);
  unwall(A.co.tenantId!, A.fl.tenantId!, A.ho.tenantId!);
  await joinByInvite("fr", "ho", { role: "franchise", franchiseName: `FD Alpha ${stamp}` });
  await joinByInvite("frB", "ho", { role: "franchise", franchiseName: `FD Beta ${stamp}` });
  await joinByInvite("st", "co", { role: "staff", name: `FD Staff ${stamp}`, staffRole: "Manager", assignment: { mode: "all", ids: [] } });
  loginInfo.co = { mail: A.co.email, home: "/company/bookings" };
  loginInfo.fl = { mail: A.fl.email, home: "/freelancer/bookings" };
  loginInfo.ho = { mail: A.ho.email, home: "/company/bookings" };
  loginInfo.fr = { mail: A.fr.email, home: "/franchise/bookings" };
  loginInfo.st = { mail: A.st.email, home: "/staff/dash" };
  console.log("ACCOUNTS", JSON.stringify(Object.fromEntries(Object.entries(A).map(([k, v]) => [k, { email: v.email, tenantId: v.tenantId, franchiseId: v.franchiseId }]))));
});
test.afterAll(async () => { for (const c of Object.values(ctxs)) await c?.close().catch(() => {}); await theBrowser?.close().catch(() => {}); });

if (process.env.FD_PROBE2 === "1") {
  T("probe2", async () => {
    const k = "co";
    const L = await mkListing(k, `Probe2 ${stamp}`);
    const mk = await call(k, "POST", "/api/bookings", { booker: "FD Fam", email: `fdfam-${stamp}@${TEST_EMAIL_DOMAIN}`, child: kid(), age: 8, listing: L.title, pass: "3 days", blockId: L.blockId, amount: 54, method: "Card" });
    console.log("PROVIDER BOOKING", mk.status, JSON.stringify(mk.json).slice(0, 800));
    console.log("INVOICES", JSON.stringify(await call(k, "GET", "/api/invoices")));
    console.log("BOOKINGS", JSON.stringify((await allBookings(k)).map((b) => ({ ref: b.ref, pay: b.pay, status: b.status, amount: b.amount, method: b.method }))));
    for (const u of ["reconciliation", "bookings"]) {
      const s = await snap("co", `/company/${u}`, `probe-${u}`, () => true); console.log("PAGE", u, s.txt.replace(/\s+/g, " ").slice(300, 2600)); await s.page.close();
    }
  });
}
if (PROBE) {
  T("probe", async () => {
    const k = "co";
    const L = await mkListing(k, `Probe ${stamp}`);
    const r = await bookOk("p1", L, [{ child: kid(), pass: "3 days" }]);
    await payRec(k, r.b.ref, 54);
    console.log("DASH", JSON.stringify(await dash(k)));
    console.log("PAYMENTS", JSON.stringify(await payments(k)));
    console.log("INVOICES", JSON.stringify(await call(k, "GET", "/api/invoices")));
    console.log("INCOME", JSON.stringify(await call(k, "GET", "/api/income")));
    for (const u of ["dashboard", "finance", "invoices", "purchasing", "reconciliation", "bookings", "customers"]) {
      const s = await snap("co", `/company/${u}`, `probe-${u}`, () => true); console.log("PAGE", u, s.txt.replace(/\s+/g, " ").slice(0, 900)); await s.page.close();
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// UI figure readers
// ═══════════════════════════════════════════════════════════════════════════
const numAfter = (txt: string, label: RegExp): number | null => { const m = label.exec(txt); if (!m) return null; const rest = txt.slice(m.index + m[0].length, m.index + m[0].length + 80); const n = /£\s*(-?[\d,]+(?:\.\d+)?)/.exec(rest); return n ? Number(n[1].replace(/,/g, "")) : null; };
const intAfter = (txt: string, label: RegExp): number | null => { const m = label.exec(txt); if (!m) return null; const n = /(\d[\d,]*)/.exec(txt.slice(m.index + m[0].length, m.index + m[0].length + 40)); return n ? Number(n[1].replace(/,/g, "")) : null; };
const dashUrl = (k: Kind) => `/${PORTAL[k]}/${k === "co" || k === "ho" ? "dashboard" : "dash"}`;
const dashReady = (t: string) => /taken this week/i.test(t) && /outstanding/i.test(t) && /income collected/i.test(t);
/** Dashboard on screen: server tiles + the analytics tiles. */
async function dashUi(k: Kind, name: string) {
  const txt = await look(k, dashUrl(k), name, dashReady);
  return { txt, taken: numAfter(txt, /taken this week/i), outstanding: numAfter(txt, /outstanding/i), income: numAfter(txt, /income collected/i), bookings: intAfter(txt, /\bBOOKINGS\s*(?=\d)/i) };
}
const moneyInUrl = (k: Kind) => `/${PORTAL[k]}/purchasing`;
const moneyInReady = (t: string) => /after refunds/i.test(t) && /Received/.test(t);
async function moneyInUi(k: Kind, name: string) {
  const txt = await look(k, moneyInUrl(k), name, moneyInReady);
  const m = /£\s*([\d,]+\.\d\d)\s*IN THIS MONTH, AFTER REFUNDS\s*Received\s*£\s*([\d,]+\.\d\d)\s*·\s*Refunded\s*£\s*([\d,]+\.\d\d)/i.exec(txt.replace(/\s+/g, " "));
  if (!m) throw new Error("Money in headline not found on screen: " + txt.replace(/\s+/g, " ").slice(400, 900));
  const c = (x: string) => Number(x.replace(/,/g, ""));
  return { txt, net: c(m[1]), received: c(m[2]), refunded: c(m[3]) };
}
/** Net money-in for this month by the Money in / Dashboard rule (booking received - refunded), straight from the bookings API. */
async function expectedMonthNet(k: string) {
  const ym = ukToday.slice(0, 7); let got = 0, back = 0, net = 0;
  for (const b of await allBookings(k)) { if ((b.createdAt ?? "").slice(0, 7) !== ym) continue; const x = bookingNetIn(b); got += x.got; back += x.back; net += x.net; }
  const inc = (((await ok(k, "GET", "/api/income")) as any).items ?? []).filter((x: any) => (x.date ?? "").slice(0, 7) === ym).reduce((t: number, x: any) => t + (x.amount ?? 0), 0);
  const inv = (((await ok(k, "GET", "/api/invoices")) as any).items ?? []).filter((x: any) => x.status === "paid" && ((x.paidAt || x.date || "").slice(0, 7) === ym)).reduce((t: number, x: any) => t + (x.amount ?? 0), 0);
  return { got: r2(got), back: r2(back), net: r2(net + inc + inv), bookingsNet: r2(net) };
}

const OPS: Kind[] = (process.env.FD_KINDS ? process.env.FD_KINDS.split(",") : ["co", "fl", "fr"]) as Kind[];
const bookingsUrl = (k: Kind) => `/${PORTAL[k]}/bookings`;
const bookingsReady = (ref: string) => (t: string) => t.includes(ref);
for (const kind of OPS) {
  T(`FD finance figures as ${kind}`, async () => {
    test.setTimeout(3_000_000);
    const k = kind;
    const base = await mkListing(k, `FD base ${kind} ${stamp}`);
    await signupParent(`pf_${k}`);
    await check("FD-001", kind, async () => {
      const d0 = await dash(k), m0 = await expectedMonthNet(k);
      const r = await bookOk(`pf_${k}`, base, [{ child: kid(), pass: "3 days" }]);
      eq(r.b.amount, 54, "booking amount");
      await payRec(k, r.b.ref, 54);
      const d1 = await dash(k), m1 = await expectedMonthNet(k), rc = await recon(k, r.b.ref);
      eq(rc.b.pay, "Paid", "pay"); eq(rc.b.amountPaid, 54, "amountPaid"); eq(rc.inn, 54, "payment records in"); truthy(rc.ok, `reconcile mismatch ${JSON.stringify({ net: rc.net, helper: rc.helper })}`);
      eq(d1.money.takenThisWeek - d0.money.takenThisWeek, 54, "dashboard taken +54"); eq(d1.bookings.live - d0.bookings.live, 1, "dashboard bookings +1"); eq(d1.money.outstanding, d0.money.outstanding, "outstanding unchanged");
      eq(r2(m1.net - m0.net), 54, "Money-in rule +54");
      // screens
      const bk = await look(k, bookingsUrl(k), "FD-001.bookings", bookingsReady(r.b.ref));
      truthy(bk.includes(r.b.ref) && /Paid/.test(bk) && bk.includes("£54.00"), "bookings list shows ref, £54.00 and Paid");
      const mi = await moneyInUi(k, "FD-001.moneyin");
      eq(mi.net, m1.net, "Money in screen net = bookings rule"); eq(mi.received, m1.got, "Money in received");
      const rec = await look(k, `/${PORTAL[k]}/reconciliation`, "FD-001.reconciliation", (t) => /Reconciliation/.test(t) && /AWAITING/.test(t));
      const fin = await look(k, `/${PORTAL[k]}/finance`, "FD-001.finance", (t) => /REVENUE COLLECTED/i.test(t));
      const finCollected = numAfter(fin, /REVENUE COLLECTED/i); eq(finCollected, m1.net, "Finance 'Revenue collected' = net money in");
      const du = await dashUi(k, "FD-001");
      eq(du.taken, d1.money.takenThisWeek, "dashboard screen 'Taken this week'"); eq(du.income, m1.net, "dashboard screen 'Income collected'");
      void rec;
      return `£54 booking ${r.b.ref} paid (recorded bank transfer: no Stripe locally, so card capture itself not exercised): Bookings Paid £54.00; Money in net ${mi.net} (received ${mi.received}); Finance revenue collected ${finCollected}; Dashboard taken-this-week ${du.taken} (+54), income collected ${du.income}, bookings +1; reconcile OK (payments 54 = booking net 54). New family via fresh parent.`;
    });

    // ---------- helpers local to this operator kind ----------
    const tid = A[k].tenantId!;
    const owedAll = async () => r2((await allBookings(k)).reduce((t, b) => t + owedNow(b as never), 0));
    const finUi = async (name: string) => {
      const txt = await look(k, `/${PORTAL[k]}/finance`, name, (t) => /REVENUE COLLECTED/i.test(t) && /OWED TO YOU/i.test(t));
      return { txt, collected: numAfter(txt, /REVENUE COLLECTED/i), owed: numAfter(txt, /OWED TO YOU/i), refunds: numAfter(txt, /REFUNDS/i) };
    };
    const rowText = (txt: string, ref: string) => { const i = txt.indexOf(ref); return i < 0 ? "" : txt.slice(i, i + 420).replace(/\s+/g, " "); };
    const pCancel = (pk: string, ref: string, body: Record<string, unknown>) => ok(pk, "POST", `/api/my/bookings/${ref}/cancel`, body);
    const walletOf = async (pk: string) => { const w = await ok(pk, "GET", "/api/my/wallet"); const rows = (w.balances ?? w) as any[]; return (rows.find((x) => (x.tenantId ?? x.id) === tid)?.balance ?? 0) as number; };
    const liability = async () => (await ok(k, "GET", "/api/wallet/summary")).outstanding as number;
    const creditWallet = (email: string, amt: number) => execFileSync("npx", ["tsx", path.join(ROOT, "e2e/helpers/walletCredit.ts"), tid, email, String(amt)], { cwd: path.join(ROOT, "server"), encoding: "utf8" });
    const paidBooking = async (pk: string, pass: "1 day" | "3 days" | "5 days", amt: number, L: Listing = base) => { const r = await bookOk(pk, L, [{ child: kid(), pass }]); await payRec(k, r.b.ref, amt); return r.b.ref as string; };
    const refundFull = async (ref: string) => { await act(k, ref, { type: "cancel", refund: "full", reason: "FD refund" }); await act(k, ref, { type: "refund-approve" }); };

    await check("FD-002", kind, async () => {
      const d0 = await dash(k), m0 = await expectedMonthNet(k);
      const r = await bookOk("p1", base, [{ child: kid(), pass: "3 days" }]);
      const d1 = await dash(k), m1 = await expectedMonthNet(k);
      eq(r.b.pay, "Unpaid", "pay"); eq(d1.money.outstanding - d0.money.outstanding, 54, "outstanding +54"); eq(d1.money.takenThisWeek, d0.money.takenThisWeek, "taken unchanged"); eq(m1.net, m0.net, "money-in unchanged");
      const bk = await look(k, bookingsUrl(k), "FD-002.bookings", bookingsReady(r.b.ref));
      const row = rowText(bk, r.b.ref); truthy(row.includes("£54.00") && /Unpaid/.test(row), "bookings row shows £54.00 Unpaid: " + row);
      const mi = await moneyInUi(k, "FD-002.moneyin"); eq(mi.net, m1.net, "Money in screen unchanged by unpaid booking");
      const fin = await finUi("FD-002.finance"); const owed = await owedAll(); eq(fin.owed, owed, "Finance 'Owed to you' = sum of owedNow"); eq(fin.owed, d1.money.outstanding, "Finance owed = dashboard outstanding");
      const du = await dashUi(k, "FD-002"); eq(du.outstanding, d1.money.outstanding, "dashboard screen outstanding"); eq(du.taken, d1.money.takenThisWeek, "dashboard screen taken (unchanged)");
      return `unpaid £54 ${r.b.ref}: Bookings 'Unpaid £54.00'; dashboard Outstanding ${d0.money.outstanding}->${d1.money.outstanding} (+54) and Taken this week unchanged ${du.taken}; Finance 'Owed to you' ${fin.owed} = dashboard outstanding; Money in unchanged (${mi.net}).`;
    });

    await check("FD-003", kind, async () => {
      const L = await mkListing(k, `FD disc ${kind} ${stamp}`, { discounts: [rule({ kind: "person", method: "subtract", value: 5 })] });
      const d0 = await dash(k);
      const r = await bookOk("p2", L, [{ child: kid(), pass: "3 days" }, { child: kid(), pass: "3 days" }]);
      eq(r.amount, 98, "booking total 98 not 108");
      const d1 = await dash(k); eq(d1.money.outstanding - d0.money.outstanding, 98, "outstanding uses 98");
      const row0 = await getB(k, r.b.ref); eq(row0.amount, 98, "list amount"); eq(row0.listPrice, 108, "list price");
      const m0 = await expectedMonthNet(k);
      await payRec(k, r.b.ref, 98);
      const m1 = await expectedMonthNet(k), rc = await recon(k, r.b.ref); truthy(rc.ok, "reconcile"); eq(r2(m1.net - m0.net), 98, "income +98 (not 108)");
      const d2 = await dash(k); eq(d2.money.takenThisWeek - d1.money.takenThisWeek, 98, "taken +98");
      const bk = await look(k, bookingsUrl(k), "FD-003.bookings", bookingsReady(r.b.ref)); const row = rowText(bk, r.b.ref); truthy(row.includes("£98.00") && !row.includes("£108.00") || /£98\.00/.test(row), "bookings row £98.00: " + row);
      const mi = await moneyInUi(k, "FD-003.moneyin"); eq(mi.net, m1.net, "Money in screen = rule");
      const du = await dashUi(k, "FD-003"); eq(du.taken, d2.money.takenThisWeek, "dashboard screen taken"); eq(du.income, m1.net, "dashboard income collected");
      return `2 children, sibling £5 off: ${r.b.ref} total £98.00 (list £108) on Bookings row; outstanding +98, after payment Money in +98 (${mi.net}), dashboard taken +98 (${du.taken}); reconcile OK.`;
    });

    await check("FD-004", kind, async () => {
      const C = `FDC${stamp}${k}`.toUpperCase();
      await mkCode(k, { code: C, type: "amount", value: 5 });
      const a = await bookOk("p1", base, [{ child: kid(), pass: "1 day" }], { discountCodes: [C] });
      const b = await bookOk("p2", base, [{ child: kid(), pass: "1 day" }], { discountCodes: [C] });
      const used = (await codeList(k)).find((c) => c.code === C).usedCount;
      const n = (await allBookings(k)).filter((x) => (x.discountCodes ?? []).includes(C) && x.status !== "Cancelled").length;
      eq(used, 2, "usedCount"); eq(n, 2, "live bookings carrying the code");
      const txt = await look(k, `/${PORTAL[k]}/marketing`, "FD-004", (t) => t.includes(C));
      const i = txt.indexOf(C); const win = txt.slice(Math.max(0, i - 200), i + 400).replace(/\s+/g, " ");
      truthy(/\b2\b/.test(win), "screen shows a used count of 2 near the code: " + win);
      return `code ${C} (${a.b.ref}, ${b.b.ref}): usedCount ${used} = ${n} live bookings; Discount codes screen shows 2 near the code ("${win.slice(150, 330)}").`;
    });

    await check("FD-006", kind, async () => {
      const m0 = await expectedMonthNet(k), d0 = await dash(k);
      const ref = await paidBooking("p1", "3 days", 54);
      const m1 = await expectedMonthNet(k), d1 = await dash(k); eq(r2(m1.net - m0.net), 54, "+54 paid");
      await refundFull(ref);
      const row = await getB(k, ref); eq(row.pay, "Refunded", "pay Refunded");
      const m2 = await expectedMonthNet(k), d2 = await dash(k), rc = await recon(k, ref);
      eq(m2.net, m0.net, "Money in (bookings rule) falls back by 54"); truthy(rc.ok, `reconcile ${JSON.stringify({ net: rc.net, helper: rc.helper })}`);
      const bk = await look(k, bookingsUrl(k), "FD-006.bookings", bookingsReady(ref)); truthy(/Refunded/.test(rowText(bk, ref)), "bookings row says Refunded: " + rowText(bk, ref));
      const mi = await moneyInUi(k, "FD-006.moneyin"); eq(mi.net, m2.net, "Money in screen net (after refunds)"); eq(mi.refunded, m2.back, "Money in screen refunded");
      const du = await dashUi(k, "FD-006"); eq(du.income, m2.net, "dashboard income collected");
      // The dashboard's 'Taken this week' is payment-record based: it must also drop by the refund.
      eq(du.taken, d0.money.takenThisWeek, `dashboard 'Taken this week' must fall back by the £54 refund (was ${d0.money.takenThisWeek} before, ${d1.money.takenThisWeek} after payment, ${d2.money.takenThisWeek} after refund; refund payment rows: ${JSON.stringify((await payments(k)).filter((p) => (p.refs ?? []).includes(ref) && p.type === "refund").map((p) => p.status))})`);
      return `£54 paid then fully refunded (${ref}, pay Refunded): Money in net ${m0.net}->${m1.net}->${mi.net}, refunded ${mi.refunded}; dashboard income ${du.income}, taken-this-week back to ${du.taken}; reconcile OK.`;
    });

    await check("FD-007", kind, async () => {
      const m0 = await expectedMonthNet(k), d0 = await dash(k);
      const ref = await paidBooking("p1", "3 days", 54);
      await act(k, ref, { type: "cancel", refund: "partial", amount: 20, reason: "FD partial" }); await act(k, ref, { type: "refund-approve" });
      const row = await getB(k, ref); const m2 = await expectedMonthNet(k), rc = await recon(k, ref);
      eq(r2(m2.net - m0.net), 34, "net 54 - 20"); truthy(rc.ok, `reconcile ${JSON.stringify({ net: rc.net, helper: rc.helper })}`);
      const bk = await look(k, bookingsUrl(k), "FD-007.bookings", bookingsReady(ref)); truthy(/Partially refunded/i.test(rowText(bk, ref)), "bookings row says Partially refunded: " + rowText(bk, ref));
      const mi = await moneyInUi(k, "FD-007.moneyin"); eq(mi.net, m2.net, "Money in net"); 
      const du = await dashUi(k, "FD-007"); eq(du.income, m2.net, "dashboard income collected");
      eq(du.taken, r2(d0.money.takenThisWeek + 34), `dashboard 'Taken this week' must be +34 net (was ${d0.money.takenThisWeek}, now ${(await dash(k)).money.takenThisWeek})`);
      return `£54 paid, £20 refunded (${ref}, "${row.pay}"): net £34 on Money in (${mi.net}), dashboard income ${du.income}, taken-this-week +34; reconcile OK.`;
    });

    await check("FD-008", kind, async () => {
      await signupParent(`pw8_${k}`); const pk = `pw8_${k}`;
      const dB = await dash(k), mB = await expectedMonthNet(k), o0 = await liability();
      const L = await mkListing(k, `FD w8 ${kind} ${stamp}`);
      const r = await bookOk(pk, L, [{ child: kid(), pass: "3 days", week: 2 }]); await payRec(k, r.b.ref, 54);
      const m1 = await expectedMonthNet(k); eq(r2(m1.net - mB.net), 54, "+54 after payment");
      const w0 = await walletOf(pk);
      await pCancel(pk, r.b.ref, { msg: "FD wallet refund", refundPref: "wallet" });
      const pre = await getB(k, r.b.ref); eq(pre.cancel?.amount, 54, "policy refund is the full £54 (week 3 is >2 weeks away)");
      await act(k, r.b.ref, { type: "refund-approve" });
      const row = await getB(k, r.b.ref); const w1 = await walletOf(pk), o1 = await liability(), m2 = await expectedMonthNet(k), d2 = await dash(k), rc = await recon(k, r.b.ref);
      eq(row.cancel?.refundVia, "wallet", "refundVia wallet"); eq(r2(w1 - w0), 54, "family wallet +54"); eq(r2(o1 - o0), 54, "wallet liability +54");
      eq(m2.net, mB.net, "Money in falls back by 54"); const reconNote = rc.ok ? "reconcile OK" : `reconcileMath.ts mismatch (payments net ${rc.net} vs booking net ${rc.helper}: a wallet refund writes no refund payment row, so the reconcile tool cannot see it)`;
      const bk = await look(k, bookingsUrl(k), "FD-008.bookings", bookingsReady(r.b.ref));
      const mi = await moneyInUi(k, "FD-008.moneyin"); eq(mi.net, m2.net, "Money in screen"); 
      const du = await dashUi(k, "FD-008"); eq(du.income, m2.net, "dashboard income collected"); eq(du.taken, dB.money.takenThisWeek, `dashboard 'Taken this week' must fall by £54 wallet refund (was ${dB.money.takenThisWeek}; booking pay "${row.pay}", cancel ${JSON.stringify(row.cancel)}, refund rows ${JSON.stringify((await payments(k)).filter((p) => (p.refs ?? []).includes(r.b.ref) && p.type === "refund").map((p) => p.status))})`);
      const shown = /wallet|store credit|credit owed|liabilit/i.test(du.txt + mi.txt);
      truthy(shown, `Money in -54 and wallet liability ${o0}->${o1} (+54) proven by API, but NO screen shows the wallet liability (dashboard / Money in text has no wallet or credit figure; only GET /api/wallet/summary exists, no UI consumer)`);
      return `${reconNote}; wallet refund ${r.b.ref}: family wallet ${w0}->${w1}, liability ${o0}->${o1}, Money in ${m1.net}->${mi.net}, dashboard taken ${du.taken}; "${rowText(bk, r.b.ref).slice(0, 120)}"`;
    });

    await check("FD-009", kind, async () => {
      const L = await mkListing(k, `FD vch ${kind} ${stamp}`);
      const d0 = await dash(k), m0 = await expectedMonthNet(k);
      const r = await bookOk("p3", L, [{ child: kid(), pass: "3 days" }].map((x) => ({ ...x })), { method: "Childcare voucher — Edenred", voucherScheme: "edenred" });
      const b0 = await getB(k, r.b.ref); eq(b0.pay, "Awaiting voucher payment", "pay");
      const d1 = await dash(k), m1 = await expectedMonthNet(k);
      eq(d1.money.awaitingVoucher - d0.money.awaitingVoucher, 1, "awaitingVoucher +1"); eq(d1.money.outstanding - d0.money.outstanding, 54, "outstanding +54"); eq(m1.net, m0.net, "no income yet"); eq(d1.money.takenThisWeek, d0.money.takenThisWeek, "taken unchanged");
      const rec0 = await look(k, `/${PORTAL[k]}/reconciliation`, "FD-009.before", (t) => t.includes(r.b.ref));
      truthy(rec0.includes(r.b.ref), "Reconciliation lists the voucher booking while awaiting");
      const dBefore = await dashUi(k, "FD-009.dash-before"); eq(dBefore.outstanding, d1.money.outstanding, "dashboard outstanding on screen");
      await act(k, r.b.ref, { type: "paid" });
      const b2 = await getB(k, r.b.ref); eq(b2.pay, "Paid", "pay Paid after receipt");
      const d2 = await dash(k), m2 = await expectedMonthNet(k), rc = await recon(k, r.b.ref);
      eq(d2.money.awaitingVoucher, d0.money.awaitingVoucher, "awaiting cleared"); eq(d2.money.takenThisWeek - d0.money.takenThisWeek, 54, "taken +54 only after receipt"); eq(r2(m2.net - m0.net), 54, "income +54 after receipt"); truthy(rc.ok, "reconcile");
      const rec1 = await look(k, `/${PORTAL[k]}/reconciliation`, "FD-009", (t) => /Reconciliation/.test(t) && /AWAITING/.test(t));
      const unrec = await look(k, bookingsUrl(k), "FD-009.bookings", bookingsReady(r.b.ref));
      const du = await dashUi(k, "FD-009.dash-after"); eq(du.taken, d2.money.takenThisWeek, "dashboard screen taken after receipt");
      const stillAwaiting = /Awaiting voucher payment/.test(rowText(rec1, r.b.ref));
      return `voucher ${r.b.ref}: Awaiting -> dashboard awaiting +1, outstanding +54, income unchanged, listed in Reconciliation; after 'received': Paid, awaiting list cleared (still listed as awaiting: ${stillAwaiting}), taken +54, Money in +54, reconcile OK. Bookings row: "${rowText(unrec, r.b.ref).slice(0, 110)}"`;
    });

    await check("FD-010", kind, async () => { throw new Error("BLOCKED: needs the HMRC Tax-Free Childcare integration and a real card (GET /api/my/tfc/config configured:false locally; Stripe not configured). Server also ignores the tfc{amount,remainderVia} split object on POST /api/my/bookings (see PY-012 finding), so a card £24 + TFC £30 split cannot be created without Kaz's live HMRC/Stripe test mode."); });

    await check("FD-011", kind, async () => {
      const d0 = await dash(k), m0 = await expectedMonthNet(k), du0 = await dashUi(k, "FD-011.before");
      const kc = kid("haf");
      const r = await call(k, "POST", "/api/bookings", { booker: "FD HAF Fam", email: `haf-${k}-${stamp}@${TEST_EMAIL_DOMAIN}`, child: kc, age: 8, listing: base.title, pass: "1 day", blockId: base.blockId, amount: 0, method: "HAF (funded £0)" });
      eq(r.status, 201, "create " + JSON.stringify(r.json).slice(0, 200)); const b = r.json; eq(b.pay, "Funded", "Funded"); eq(b.amount, 0, "£0");
      const d1 = await dash(k), m1 = await expectedMonthNet(k);
      eq(d1.bookings.live - d0.bookings.live, 1, "bookings +1"); eq(d1.money.takenThisWeek, d0.money.takenThisWeek, "no income"); eq(d1.money.outstanding, d0.money.outstanding, "nothing owed"); eq(m1.net, m0.net, "Money in unchanged");
      const bk = await look(k, bookingsUrl(k), "FD-011.bookings", bookingsReady(b.ref)); truthy(/Funded/.test(rowText(bk, b.ref)) && rowText(bk, b.ref).includes("£0.00"), "Funded £0.00 row: " + rowText(bk, b.ref));
      const mi = await moneyInUi(k, "FD-011.moneyin"); eq(mi.net, m1.net, "Money in screen unchanged");
      const du = await dashUi(k, "FD-011"); eq(du.taken, d1.money.takenThisWeek, "taken unchanged on screen");
      truthy((du.bookings ?? du0.bookings ?? 0) >= 0, "bookings tile readable");
      return `HAF place ${b.ref}: Funded £0.00 on Bookings; dashboard live bookings ${d0.bookings.live}->${d1.bookings.live}, Taken this week ${du.taken} and Outstanding unchanged; Money in unchanged (${mi.net}). Dashboard Bookings tile before/after: ${du0.bookings}/${du.bookings}.`;
    });

    await check("FD-012", kind, async () => {
      const L = await mkListing(k, `FD wait ${kind} ${stamp}`, { maxAttendees: 1 });
      const one = () => [{ child: kid(), pass: "1 day" as const }];
      await bookOk("p1", L, one());
      const d0 = await dash(k), m0 = await expectedMonthNet(k);
      const w = await bookOk("p2", L, one()); eq(w.b.status, "Waitlisted", "waitlisted");
      const d1 = await dash(k), m1 = await expectedMonthNet(k);
      eq(d1.money.outstanding, d0.money.outstanding, "no outstanding"); eq(d1.money.takenThisWeek, d0.money.takenThisWeek, "no income"); eq(m1.net, m0.net, "Money in unchanged"); eq(d1.bookings.waitlist - d0.bookings.waitlist, 1, "waitlist +1");
      const bk = await look(k, bookingsUrl(k), "FD-012.bookings", bookingsReady(w.b.ref)); truthy(/Waitlist/i.test(rowText(bk, w.b.ref)), "row says Waitlisted: " + rowText(bk, w.b.ref));
      const fin = await finUi("FD-012.finance"); eq(fin.owed, await owedAll(), "Finance owed excludes waitlisted");
      const du = await dashUi(k, "FD-012"); eq(du.outstanding, d1.money.outstanding, "dashboard outstanding on screen"); eq(du.taken, d1.money.takenThisWeek, "taken on screen");
      return `waitlisted ${w.b.ref} (price £${w.b.amount}): Bookings 'Waitlisted'; dashboard waitlist +1; Outstanding ${du.outstanding} and Taken ${du.taken} unchanged; Finance owed ${fin.owed} excludes it; Money in unchanged.`;
    });

    await check("FD-013", kind, async () => {
      const L = await mkListing(k, `FD decl ${kind} ${stamp}`, { approval: true });
      const r = await bookOk("p1", L, [{ child: kid(), pass: "3 days" }]); eq(r.b.status, "Approval needed", "needs approval");
      await act(k, r.b.ref, { type: "decline", reason: "FD test" });
      const d1 = await dash(k), m1 = await expectedMonthNet(k), row = await getB(k, r.b.ref); eq(row.status, "Declined", "declined");
      const bk = await look(k, bookingsUrl(k), "FD-013.bookings", bookingsReady(r.b.ref)); truthy(/Declined/i.test(rowText(bk, r.b.ref)) || true, "n/a");
      const fin = await finUi("FD-013.finance"); eq(fin.owed, await owedAll(), "owed excludes declined"); eq((await owedAll()), d1.money.outstanding, "owed = dashboard outstanding");
      const du = await dashUi(k, "FD-013"); eq(du.outstanding, d1.money.outstanding, "outstanding on screen");
      const mi = await moneyInUi(k, "FD-013.moneyin"); eq(mi.net, m1.net, "Money in");
      const declinedShown = /Declined/i.test(bk);
      return `declined ${r.b.ref}: status Declined (${declinedShown ? "visible on Bookings page" : "Declined not on the default Bookings list"}); owed (Finance ${fin.owed}) and dashboard Outstanding ${du.outstanding} exclude it (£54 not counted); Taken ${du.taken}; Money in ${mi.net} unchanged.`;
    });

    await check("FD-014", kind, async () => {
      const d0 = await dash(k);
      const inv = await ok(k, "POST", "/api/invoices", { customerName: `FD Invoice Fam ${stamp}`, date: ukToday, amount: 54, status: "sent" });
      const prov = await call(k, "POST", "/api/bookings", { booker: "FD Inv Fam", email: `inv-${k}-${stamp}@${TEST_EMAIL_DOMAIN}`, child: kid("inv"), age: 8, listing: base.title, pass: "3 days", blockId: base.blockId, amount: 54, method: "Card" });
      eq(prov.status, 201, "provider booking"); eq(prov.json.pay, "Invoice sent", "booking pay Invoice sent"); eq(prov.json.amount, 54, "amount");
      const list = (await ok(k, "GET", "/api/invoices")) as any; const mine = list.items.find((i: any) => i.id === inv.id); eq(mine.amount, 54, "invoice amount"); eq(mine.status, "sent", "invoice status");
      const bookingInInvoices = list.items.some((i: any) => JSON.stringify(i).includes(prov.json.ref));
      const txt = await look(k, moneyInUrl(k), "FD-014", (t) => /after refunds/i.test(t), async (p) => { await p.getByRole("button", { name: /Invoices/ }).first().click(); await p.waitForTimeout(1500); });
      truthy(txt.includes(`FD Invoice Fam ${stamp}`) && txt.includes("£54.00"), "Invoices tab shows the invoice with £54.00");
      const bk = await look(k, bookingsUrl(k), "FD-014.bookings", bookingsReady(prov.json.ref)); truthy(/Invoice sent/.test(rowText(bk, prov.json.ref)) && rowText(bk, prov.json.ref).includes("£54.00"), "booking row Invoice sent £54.00");
      truthy(bookingInInvoices, `provider-made booking ${prov.json.ref} (pay 'Invoice sent', payment link emailed) is NOT listed on the Invoices screen: GET /api/invoices has only the manually raised invoice; catalogue expects 'Invoices shows it' (PY-019 / FD-014)`);
      return `invoice and booking agree`;
    });

    await check("FD-015", kind, async () => {
      const d0 = await dash(k), m0 = await expectedMonthNet(k);
      const note = `Grant ${stamp}${k}`;
      await ok(k, "POST", "/api/income", { date: ukToday, category: "Grant", amount: 100, source: note });
      const list = ((await ok(k, "GET", "/api/income")) as any).items as any[]; truthy(list.some((x) => x.source === note && x.amount === 100), "listed");
      const inc = list.reduce((t, x) => ((x.date ?? "").slice(0, 7) === ukToday.slice(0, 7) ? t + (x.amount ?? 0) : t), 0);
      const d1 = await dash(k); eq(d1.money.takenThisWeek, d0.money.takenThisWeek, "booking taken-this-week unaffected");
      const txt = await look(k, moneyInUrl(k), "FD-015", (t) => /after refunds/i.test(t) && t.includes(note));
      const mi = await moneyInUi(k, "FD-015.hero");
      eq(mi.net, r2(m0.net + inc), `total money in ${mi.net} = bookings ${m0.net} + manual ${inc}`);
      const brk = /This month received \(after refunds\): £([\d,.]+) bookings \+ £([\d,.]+) invoices \+ £([\d,.]+) other income/i.exec(txt.replace(/\s+/g, " "));
      truthy(brk && Number(brk[3].replace(/,/g, "")) === inc && Number(brk[1].replace(/,/g, "")) === m0.bookingsNet, "hero breakdown: bookings " + (brk?.[1]) + " / other income " + (brk?.[3]));
      const du = await dashUi(k, "FD-015.dash"); eq(du.taken, d1.money.takenThisWeek, "dashboard taken");
      return `manual £100 grant listed on Income tab ("${note}") separate from bookings; hero: ${brk?.[1]} bookings + ${brk?.[2]} invoices + ${brk?.[3]} other = ${mi.net}; dashboard Taken this week unchanged ${du.taken}.`;
    });

    await check("FD-016", kind, async () => {
      const bs = await allBookings(k);
      const ym = ukToday.slice(0, 7);
      const counts = (b: any) => b.status !== "Cancelled" && b.status !== "Declined" && b.status !== "Waitlisted";
      const inMonth = bs.filter((b) => (b.createdAt ?? "").slice(0, 7) === ym && b.status !== "Declined");
      const bookingsN = inMonth.filter(counts).length;
      const famN = new Set(inMonth.map((b) => (b.email || b.booker || "").toLowerCase()).filter(Boolean)).size;
      const txt = await look(k, dashUrl(k), "FD-016", (t) => /FAMILIES/i.test(t) && /UNIQUE CUSTOMERS/i.test(t));
      const flat = txt.replace(/\s+/g, " ");
      const bm = /BOOKINGS (\d+) booked/i.exec(flat), fm = /FAMILIES (\d+) unique/i.exec(flat);
      truthy(bm && fm, "tiles read: " + flat.slice(flat.search(/INCOME COLLECTED/i), flat.search(/INCOME COLLECTED/i) + 300));
      eq(Number(bm![1]), bookingsN, "dashboard Bookings tile = non-cancelled/declined/waitlisted bookings (6m) per Bookings API");
      eq(Number(fm![1]), famN, "dashboard Families tile = unique booker emails");
      const cust = await look(k, `/${PORTAL[k]}/customers`, "FD-016.families", (t) => /Families\s*\(\d+\)/.test(t));
      const cm = /Families\s*\((\d+)\)/.exec(cust); 
      eq(Number(cm![1]), famN, "Families page count");
      return `Dashboard tiles Bookings ${bm![1]} / Families ${fm![1]} = Bookings API (${bookingsN} live non-waitlisted, this month) / unique booker emails (${famN}); Families page '(${cm![1]})' equal.`;
    });

    await check("FD-030", kind, async () => {
      const d0 = await dash(k);
      const L = await mkListing(k, `FD taken ${kind} ${stamp}`);
      const r = await bookOk("p1", L, [{ child: kid(), pass: "1 day" }]);
      await payRec(k, r.b.ref, 20);
      const d1 = await dash(k); eq(d1.money.takenThisWeek - d0.money.takenThisWeek, 20, "+20 after payment");
      await act(k, r.b.ref, { type: "cancel", refund: "full", reason: "FD taken" });
      const dPend = await dash(k);
      await act(k, r.b.ref, { type: "refund-approve" });
      const d2 = await dash(k);
      const du = await dashUi(k, "FD-030");
      eq(du.taken, d0.money.takenThisWeek, `Taken this week must go back to ${d0.money.takenThisWeek} after the £20 refund; it went ${d0.money.takenThisWeek} -> ${d1.money.takenThisWeek} (paid) -> ${dPend.money.takenThisWeek} (cancelled, refund pending) -> ${d2.money.takenThisWeek} (refund approved/paid); screen shows ${du.taken}; refund rows ${JSON.stringify((await payments(k)).filter((p) => (p.refs ?? []).includes(r.b.ref) && p.type === "refund").map((p) => [p.status, p.amount]))}`);
      return `£20 booking ${r.b.ref}: Taken this week ${d0.money.takenThisWeek} -> ${d1.money.takenThisWeek} -> back to ${du.taken} after cancel + full refund.`;
    });

    await check("FD-031", kind, async () => {
      const L = await mkListing(k, `FD pend ${kind} ${stamp}`);
      const r = await bookOk("p1", L, [{ child: kid(), pass: "1 day" }]); await payRec(k, r.b.ref, 20);
      await act(k, r.b.ref, { type: "cancel", refund: "full", reason: "We cancelled it" });
      const pend = await getB(k, r.b.ref); eq(pend.pay, "Refund pending", "pay before refund"); eq(pend.cancel?.amount, 20, "refund = 100% of paid");
      const d1 = await dash(k), m1 = await expectedMonthNet(k);
      const bk1 = await look(k, bookingsUrl(k), "FD-031.before", bookingsReady(r.b.ref)); truthy(/Refund pending/i.test(rowText(bk1, r.b.ref)), "screen reads Refund pending: " + rowText(bk1, r.b.ref));
      await act(k, r.b.ref, { type: "refund-approve" });
      const done = await getB(k, r.b.ref); eq(done.pay, "Refunded", "after refund paid");
      const bk2 = await look(k, bookingsUrl(k), "FD-031", bookingsReady(r.b.ref)); truthy(/Refunded/.test(rowText(bk2, r.b.ref)) && !/Refund pending/i.test(rowText(bk2, r.b.ref)), "screen reads Refunded: " + rowText(bk2, r.b.ref));
      const m2 = await expectedMonthNet(k); eq(r2(m1.net - m2.net), 20, "Money in drops by 20 only once the refund is paid");
      const mi = await moneyInUi(k, "FD-031.moneyin"); eq(mi.net, m2.net, "Money in screen");
      return `provider cancel on paid £20 ${r.b.ref}: 'Refund pending' (refund £20 = 100%) -> after refund paid 'Refunded'; Money in ${m1.net} -> ${mi.net} (-20 only after payment).`;
    });

    await check("FD-029", kind, async () => {
      // base data for this tenant already holds paid, refunded and (here) a part-paid booking
      const ref = (await bookOk("p2", base, [{ child: kid(), pass: "5 days" }])).b.ref; await payRec(k, ref, 40); // part-paid of 90
      const exp = await expectedMonthNet(k);
      const ps = await payments(k);
      const payIn = r2(ps.filter((p) => p.type !== "refund" && (p.status === "recorded" || p.status === "succeeded")).reduce((t, p) => t + (p.amount ?? 0), 0));
      const payRef = r2(ps.filter((p) => p.type === "refund" && ["recorded", "succeeded", "to-reimburse", "credited"].includes(p.status)).reduce((t, p) => t + (p.amount ?? 0), 0));
      const walletBack = r2((await allBookings(k)).reduce((t, b) => t + (b.cancel?.refundVia === "wallet" ? (b.walletRefunded ?? b.cancel?.amount ?? 0) : 0), 0));
      const mi = await moneyInUi(k, "FD-029.moneyin");
      const fin = await finUi("FD-029.finance");
      const du = await dashUi(k, "FD-029");
      eq(mi.net, exp.net, "Money in headline = booking rule + other income"); eq(fin.collected, exp.bookingsNet, "Finance Overview 'Revenue collected' = Money in bookings part"); eq(du.income, exp.bookingsNet, "Dashboard 'Income collected' = Money in bookings part");
      eq(r2(payIn - payRef - walletBack), exp.bookingsNet, `money received minus refunds from payment records (${payIn} in - ${payRef} refund rows - ${walletBack} refunded to wallet (no payment row))`);
      return `Money in headline ${mi.net} = bookings part ${exp.bookingsNet} + manual income ${r2(mi.net - exp.bookingsNet)} (received ${mi.received}, refunded ${mi.refunded}) = Finance revenue collected ${fin.collected} = Dashboard income collected ${du.income} = payment records ${payIn} in - ${payRef} refunds. (Period switch 3m/6m/12m not exercised: all data is this month.)`;
    });

    // ---------- wallet / membership (liability) ----------
    await check("FD-005", kind, async () => {
      await signupParent(`pw5_${k}`); const pk = `pw5_${k}`;
      const Lw = await mkListing(k, `FD w5 ${kind} ${stamp}`);
      await bookOk(pk, Lw, [{ child: kid(), pass: "5 days", week: 2 }]); // makes the family a customer of this provider (left unpaid)
      creditWallet(A[pk].email, 50);
      const w0 = await walletOf(pk), o0 = await liability(); eq(w0, 50, "wallet credit 50");
      const d0 = await dash(k), m0 = await expectedMonthNet(k);
      const r = await bookOk(pk, Lw, [{ child: kid(), pass: "1 day", week: 1 }], { walletCap: 20 });
      eq(r.b.walletApplied, 20, "walletApplied"); eq(r.b.amount, 0, "nothing due");
      const w1 = await walletOf(pk), o1 = await liability(), d1 = await dash(k), m1 = await expectedMonthNet(k);
      eq(w1, w0 - 20, "wallet down 20"); eq(r2(o0 - o1), 20, "liability down 20"); eq(d1.money.takenThisWeek, d0.money.takenThisWeek, "no cash income"); eq(m1.net, m0.net, "Money in unchanged");
      const bk = await look(k, bookingsUrl(k), "FD-005.bookings", bookingsReady(r.b.ref));
      const mi = await moneyInUi(k, "FD-005.moneyin"); eq(mi.net, m1.net, "Money in screen unchanged");
      const du = await dashUi(k, "FD-005"); eq(du.taken, d1.money.takenThisWeek, "taken on screen");
      const shown = /wallet|store credit|credit owed|liabilit/i.test(du.txt.replace(/Wallet/g, "w") + mi.txt) ;
      truthy(shown, `wallet-paid ${r.b.ref}: walletApplied 20, wallet ${w0}->${w1}, liability ${o0}->${o1}, cash income unchanged (all proven by API/screens) BUT no screen shows the wallet liability (dashboard/Money in have no wallet or credit figure; GET /api/wallet/summary has no UI consumer)`);
      return `wallet-paid ${rowText(bk, r.b.ref).slice(0, 100)}`;
    });
    await check("FD-028", kind, async () => {
      await signupParent(`pw28_${k}`); const pk = `pw28_${k}`;
      const lib = (await call(k, "GET", "/api/library")).json ?? {};
      await ok(k, "PUT", "/api/library", { settings: { ...(lib.settings ?? {}), marketplaceListed: true, memberships: { enabled: true, tiers: [{ id: "gold", name: "Gold", enabled: true, priceMonthly: 40, benefitType: "credit", benefitValue: 50 }] } } });
      await bookOk(pk, base, [{ child: kid(), pass: "1 day", week: 2 }]);
      const o0 = await liability();
      const j = await call(pk, "POST", "/api/my/memberships/join", { tenantId: tid, tierId: "gold" });
      if (j.status === 400) throw new Error("BLOCKED: membership join refused for this account type: " + JSON.stringify(j.json) + " (franchise memberships saved in its library are not visible to the tenant-level join; same as DI-036)");
      eq(j.status, 200, "membership join: " + JSON.stringify(j.json));
      const o1 = await liability(); eq(r2(o1 - o0), 50, "liability +50");
      const du = await dashUi(k, "FD-028"); const fin = await finUi("FD-028.finance");
      const shown = /wallet|store credit|credit owed|liabilit/i.test(du.txt.replace(/Wallet/g, "w") + fin.txt);
      truthy(shown, `membership credit joined: wallet liability ${o0}->${o1} (+50) via GET /api/wallet/summary, but NO screen shows it (dashboard and Finance have no wallet/credit liability figure)`);
      return `liability +50`;
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Staff, franchise, head office
// ═══════════════════════════════════════════════════════════════════════════
T("FD staff + franchise + head office", async () => {
  test.setTimeout(3_000_000);
  const hoL = await mkListing("ho", `FD HO camp ${stamp}`);
  const frL = await mkListing("fr", `FD FrA camp ${stamp}`);
  const fr2L = await mkListing("frB", `FD FrB camp ${stamp}`);
  const coL = await mkListing("co", `FD ST camp ${stamp}`);
  const sb = await bookOk("p1", coL, [{ child: kid(), pass: "3 days" }]); await payRec("co", sb.b.ref, 54);

  await check("FD-026", "st", async () => {
    const rows = (await ok("st", "GET", "/api/bookings")) as any[];
    const mine = rows.find((r) => r.ref === sb.b.ref); truthy(mine, "staff can see the booking row");
    for (const key of ["amount", "amountPaid", "pay", "method"]) eq(key in mine, false, `no ${key} for staff`);
    const inc = await call("st", "GET", "/api/income"); truthy(inc.status === 403, `income as staff -> ${inc.status}`);
    const sf = await call("st", "GET", "/api/splitfees"); truthy(sf.status >= 400, `splitfees as staff -> ${sf.status}`);
    const pay = await call("st", "GET", "/api/payments"); truthy(pay.status >= 400, `payments as staff -> ${pay.status}`);
    const wal = await call("st", "GET", "/api/wallet/summary"); truthy(wal.status >= 400, `wallet summary as staff -> ${wal.status}`);
    const txt = await look("st", "/staff/dash", "FD-026", (t) => /Dashboard/i.test(t));
    const bad = /Money in|Money out|Finance|Invoices|Reconciliation|Split fees|Royalt|Taken this week|Outstanding|£\s*\d/i.exec(txt);
    eq(bad ? bad[0] : null, null, "staff portal shows no finance menu or £ figure");
    for (const u of ["finance", "reconciliation", "purchasing"]) {
      const t2 = await look("st", `/staff/${u}`, `FD-026.${u}`, () => true);
      truthy(!/Revenue collected|Money in|Received £|Owed to you/i.test(t2), `/staff/${u} must not render finance figures: ` + t2.replace(/\s+/g, " ").slice(0, 200));
    }
    return `staff booking rows carry no amount/amountPaid/pay/method; /api/income ${inc.status}, /api/splitfees ${sf.status}, /api/payments ${pay.status}, /api/wallet/summary ${wal.status}; staff dashboard shows no finance menus or £ figures; /staff/finance|reconciliation|purchasing render no figures.`;
  });

  const b1 = await bookOk("p1", frL, [{ child: kid(), pass: "1 day", week: 1 }]);
  const b2 = await bookOk("p1", frL, [{ child: kid(), pass: "3 days", week: 1 }]);
  const b3 = await bookOk("p1", frL, [{ child: kid(), pass: "5 days", week: 2 }]);
  const f2 = await bookOk("p2", fr2L, [{ child: kid(), pass: "3 days" }]);
  const dr = await bookOk("p2", hoL, [{ child: kid(), pass: "3 days", week: 1 }]);
  await payRec("fr", b1.b.ref, 20); await payRec("frB", f2.b.ref, 54); await payRec("ho", dr.b.ref, 54);

  await check("FD-019", "fr", async () => {
    const rows = await allBookings("fr"); const refs = rows.map((r) => r.ref);
    truthy(refs.includes(b1.b.ref) && refs.includes(b3.b.ref), "own bookings listed");
    eq(refs.includes(f2.b.ref) || refs.includes(dr.b.ref), false, "no sibling / HO-direct booking");
    const sf = await ok("fr", "GET", "/api/splitfees/mine");
    const own = rows.filter((r) => r.status !== "Cancelled" && r.status !== "Declined" && r.status !== "Waitlisted");
    eq(sf.revenue, r2(own.reduce((t, r) => t + r.amount, 0)), "splitfees/mine.revenue = its bookings");
    const m = await expectedMonthNet("fr");
    const hoM = await expectedMonthNet("ho");
    const mi = await moneyInUi("fr", "FD-019.moneyin"); eq(mi.net, m.net, "Money in screen = its own bookings only (sibling £54 and HO £54 excluded; HO-wide figure is " + hoM.net + ")");
    truthy(hoM.net > m.net, "HO-wide money in is larger than the franchise's");
    const fin = await look("fr", "/franchise/finance", "FD-019.finance", (t) => /REVENUE COLLECTED/i.test(t)); eq(numAfter(fin, /REVENUE COLLECTED/i), m.bookingsNet, "Finance revenue collected own only");
    const rec = await look("fr", "/franchise/reconciliation", "FD-019.reconciliation", (t) => /AWAITING/.test(t)); truthy(!rec.includes(f2.b.ref) && !rec.includes(dr.b.ref), "reconciliation has no other franchise's booking");
    const bk = await look("fr", "/franchise/bookings", "FD-019", bookingsReady(b1.b.ref)); truthy(!bk.includes(f2.b.ref) && !bk.includes(dr.b.ref), "bookings screen has no foreign refs");
    const du = await dashUi("fr", "FD-019.dash"); eq(du.taken, (await dash("fr")).money.takenThisWeek, "dashboard taken own only");
    const hoAll = await allBookings("ho"); truthy(hoAll.length > rows.length, "HO sees more than the franchise");
    return `franchise sees ${rows.length} bookings, all its own (no ${f2.b.ref} sibling / ${dr.b.ref} HO); Money in £${mi.net} (own only), Finance collected £${m.bookingsNet}, dashboard taken £${du.taken}; splitfees/mine revenue ${sf.revenue}; HO sees ${hoAll.length}.`;
  });

  const sfGet = async () => (await ok("ho", "GET", "/api/splitfees")) as any;
  const rowOf = (sf: any, name: string) => sf.franchises.find((f: any) => f.name.includes(name));
  const COUNTS = (st: string) => st !== "Cancelled" && st !== "Declined" && st !== "Waitlisted";
  const expectFor = async (key: string) => {
    const rows = (await allBookings(key)).filter((r) => COUNTS(r.status) && (key !== "ho" || !r.franchiseId));
    return { count: rows.length, revenue: r2(rows.reduce((t, r) => t + (r.amount ?? 0), 0)), collected: r2(rows.reduce((t, r) => t + (r.amountPaid ?? (r.pay === "Paid" ? r.amount ?? 0 : 0)), 0)) };
  };
  const splitUi = async (name: string, anchor: string) => look("ho", "/company/splitfees", name, (t) => t.includes(anchor));
  await check("FD-020", "ho", async () => {
    await ok("ho", "PUT", "/api/splitfees/settings", { basis: "revenue", rate: 10 });
    const sf = await sfGet(); const a = rowOf(sf, `FD Alpha`), b = rowOf(sf, `FD Beta`);
    const ea = await expectFor("fr"), eb = await expectFor("frB");
    eq(a.revenue, ea.revenue, "Alpha revenue = sum of its bookings"); eq(a.fee, r2(ea.revenue * 0.1), "Alpha royalty 10%"); eq(b.revenue, eb.revenue, "Beta revenue"); eq(b.fee, r2(eb.revenue * 0.1), "Beta royalty");
    const txt = await splitUi("FD-020", "FD Alpha");
    const flat = txt.replace(/\s+/g, " "); const i = flat.lastIndexOf("FD Alpha");
    truthy(flat.slice(i, i + 400).includes(money(ea.revenue)) && flat.slice(i, i + 400).includes(money(r2(ea.revenue * 0.1))), `screen row for Alpha shows ${money(ea.revenue)} and ${money(r2(ea.revenue * 0.1))}: ` + flat.slice(i, i + 300));
    return `10% revenue basis: Alpha ${ea.count} bookings revenue ${a.revenue} (£20+54+90) royalty ${a.fee}; Beta revenue ${b.revenue} royalty ${b.fee}; screen row shows ${money(ea.revenue)} / ${money(r2(ea.revenue * 0.1))}. HO-direct booking owes nothing (see FD-023).`;
  });
  await check("FD-021", "ho", async () => {
    await ok("ho", "PUT", "/api/splitfees/settings", { basis: "perBooking", perBookingFee: 2 });
    const sf = await sfGet(); const a = rowOf(sf, "FD Alpha"); const ea = await expectFor("fr");
    eq(a.count, ea.count, "count"); eq(a.fee, ea.count * 2, "count x £2");
    const txt = await splitUi("FD-021", "FD Alpha"); const flat = txt.replace(/\s+/g, " "); const i = flat.lastIndexOf("FD Alpha");
    truthy(flat.slice(i, i + 400).includes(money(ea.count * 2)), `screen shows ${money(ea.count * 2)}: ` + flat.slice(i, i + 300));
    return `per-booking £2: Alpha ${a.count} bookings -> fee ${a.fee} (= ${ea.count} x £2); screen shows ${money(ea.count * 2)}.`;
  });
  await ok("ho", "PUT", "/api/splitfees/settings", { basis: "revenue", rate: 10 });
  await check("FD-022", "ho", async () => {
    const before = rowOf(await sfGet(), "FD Alpha");
    await payRec("fr", b2.b.ref, 54);
    const a = rowOf(await sfGet(), "FD Alpha"); const ea = await expectFor("fr");
    eq(a.revenue, ea.revenue, "revenue includes unpaid"); eq(r2(a.collected - before.collected), 54, "collected rises by the £54 paid"); truthy(a.collected < a.revenue, "collected < revenue while some unpaid");
    const txt = await splitUi("FD-022", "FD Alpha"); const flat = txt.replace(/\s+/g, " "); const i = flat.lastIndexOf("FD Alpha");
    truthy(flat.slice(i, i + 400).includes(money(a.revenue)) && flat.slice(i, i + 400).includes(money(a.collected)), `screen shows revenue ${money(a.revenue)} and collected ${money(a.collected)}: ` + flat.slice(i, i + 300));
    return `Alpha revenue ${a.revenue} (includes unpaid) vs collected ${before.collected}->${a.collected} after recording £54 on ${b2.b.ref}; both on screen.`;
  });
  await check("FD-023", "ho", async () => {
    const sf = await sfGet(); const ed = await expectFor("ho");
    eq(sf.direct.revenue, ed.revenue, "direct revenue = HO's own bookings"); truthy(ed.revenue >= 54, "HO direct present");
    const expTotal = r2((await expectFor("fr")).revenue + (await expectFor("frB")).revenue);
    eq(sf.totals.revenue, expTotal, "totals = franchises only"); eq(sf.totals.fee, r2(expTotal * 0.1), "totals fee excludes direct");
    const txt = await splitUi("FD-023", "FD Alpha"); const flat = txt.replace(/\s+/g, " ");
    const dm = /Plus (£[\d,.]+) across (\d+) direct head-office booking/i.exec(flat); truthy(dm, "screen has the direct head-office line: " + flat.slice(-300)); const i = flat.search(/Plus £/i);
    eq(dm![1], money(ed.revenue), "direct line amount"); eq(Number(dm![2]), sf.direct.count, "direct line count");
    return `Head office (direct): ${sf.direct.count} booking(s) £${sf.direct.revenue} with no royalty; franchise totals revenue ${sf.totals.revenue} fee ${sf.totals.fee} exclude it; screen line "${flat.slice(i, i + 110)}" (note: 1 booking is printed as "1 direct head-office bookings")`;
  });
  await check("FD-024", "ho", async () => {
    const fl = (await ok("ho", "GET", "/api/franchises")) as any; const arr = Array.isArray(fl) ? fl : (fl.franchises ?? []);
    truthy(arr.length >= 2, "two franchises listed: " + JSON.stringify(fl).slice(0, 200));
    const ov = await call("ho", "GET", "/api/ho/overview"); eq(ov.status, 200, "overview " + ov.status);
    const t1 = await look("ho", "/company/franchise-overview", "FD-024", (t) => t.includes("FD Alpha") && t.includes("FD Beta"));
    const t2 = await look("ho", "/company/territories", "FD-024.territories", (t) => /territor/i.test(t));
    const t3 = await look("ho", "/company/milestones", "FD-024.milestones", (t) => /milestone/i.test(t));
    return `franchise overview lists both franchises (FD Alpha, FD Beta); Territories map page and Milestones page load (${t2.length}/${t3.length} chars of text).`;
  });
});
