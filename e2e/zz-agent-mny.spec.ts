import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test, chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { API_URL, ROOT, WEB_URL } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, fbSignIn, fbSignUp } from "./helpers/accounts";

// Agent MNY: money-path audit. API-driven (no Stripe locally) + UI shots.
test.describe.configure({ mode: "serial" });
const SHOTS = path.join(ROOT, "e2e/review/shots/mny");
const CACHE = path.join(SHOTS, "accounts.json");
const RESULTS_PATH = path.join(SHOTS, "results.json");
fs.mkdirSync(SHOTS, { recursive: true });
const ONLY = process.env.MNY_ONLY ? process.env.MNY_ONLY.split(",") : null;

interface Res { id: string; ok: boolean; note: string }
const results: Res[] = fs.existsSync(RESULTS_PATH) ? JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8")) : [];
const saveResults = () => fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));

interface Acct { email: string; uid: string; tenantId: string | null; tok: string; tokAt: number }
let A: Record<string, Acct> = {};
const stamp = Date.now().toString(36);
const email = (n: string) => `e2e-mny-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`;
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

// dates
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = new Date();
const nextMonday = addDays(today, (8 - today.getDay()) % 7 || 7);
const sd = (w: number, d: number) => iso(addDays(nextMonday, w * 7 + d));
const r2 = (n: number) => Math.round(n * 100) / 100;

// browser
let theBrowser: Browser | null = null;
const ctxs: Record<string, BrowserContext> = {};
async function ctxFor(k: string): Promise<BrowserContext> {
  if (ctxs[k]) return ctxs[k];
  if (!theBrowser || !theBrowser.isConnected()) theBrowser = await chromium.launch();
  for (let attempt = 0; ; attempt++) {
    const ctx = await theBrowser.newContext({ viewport: { width: 1440, height: 1100 } });
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
async function snap(page: Page, id: string, wait: (string | RegExp)[] = []) {
  for (const w of wait) await page.getByText(w).first().waitFor({ state: "visible", timeout: 45_000 });
  await page.waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.innerText), null, { timeout: 45_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const f = path.join(SHOTS, `${id}.png`);
  await page.screenshot({ path: f, fullPage: true });
  return path.relative(ROOT, f);
}

const eq = (a: unknown, b: unknown, label: string) => { const same = typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 0.006 : a === b; if (!same) throw new Error(`${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const must = (v: unknown, label: string) => { if (!v) throw new Error(`${label}: expected truthy, got ${JSON.stringify(v)}`); };
const sum = (xs: number[]) => r2(xs.reduce((s, x) => s + x, 0));
async function check(id: string, fn: () => Promise<string>) {
  if (ONLY && !ONLY.includes(id)) return;
  let r: Res;
  try { r = { id, ok: true, note: await fn() }; } catch (e) { r = { id, ok: false, note: (e as Error).message.slice(0, 900) }; }
  const i = results.findIndex((x) => x.id === id); if (i >= 0) results.splice(i, 1);
  results.push(r); saveResults();
  console.log(`${r.ok ? "PASS" : "FAIL"} ${id} ${r.note}`);
}

// provisioning
interface Listing { id: string; title: string; blockId: string; blocks: { id: string; startDate: string }[]; tenantId: string }
interface PassDef { name: string; days: number; price: number }
const STD_PASSES: PassDef[] = [{ name: "5 days", days: 5, price: 90 }, { name: "3 days", days: 3, price: 54 }, { name: "1 day", days: 1, price: 20 }];
const passIdCache: Record<string, string> = {};
let periodId: string | null = null;
let venueDone = false;
async function ensureVenue() {
  if (venueDone) return "mny-venue";
  const lib = (await call("co", "GET", "/api/library")).json ?? {};
  const venues = (lib.venues ?? []) as { id: string }[];
  await ok("co", "PUT", "/api/library", { ...lib, venues: venues.some((v) => v.id === "mny-venue") ? venues : [...venues, { id: "mny-venue", name: "MNY Hall", address: "1 Test Way", city: "Northampton" }], settings: { ...(lib.settings ?? {}), marketplaceListed: true } });
  venueDone = true; return "mny-venue";
}
async function ensurePass(name: string, days: number) { return (passIdCache[`${name}|${days}`] ??= (await ok("co", "POST", "/api/passes", { name, days })).id); }
async function ensurePeriod() { return (periodId ??= (await ok("co", "POST", "/api/periods", { title: "Full day", start: "09:00", finish: "15:00" })).id); }
interface MkOpts { passes?: PassDef[]; from?: string; to?: string; days?: number[] }
async function mkListing(title: string, extra: Record<string, unknown> = {}, o: MkOpts = {}): Promise<Listing> {
  const passes = o.passes ?? STD_PASSES;
  const venueId = await ensureVenue();
  const period = await ensurePeriod();
  const ids = await Promise.all(passes.map((p) => ensurePass(p.name, p.days)));
  const master = [...passes].sort((a, c) => c.days - a.days)[0];
  const passFlat: Record<string, number> = {}; const periodPrice: Record<string, number> = {};
  passes.forEach((p, i) => { passFlat[ids[i]] = p.price; periodPrice[`${ids[i]}_${period}`] = p.price; });
  const bundle = await ok("co", "POST", "/api/block-bundles", { name: `Bundle ${title}`, periodIds: [period], passIds: ids, priced: true, masterPrice: master.price, calcOn: false, passFlat, periodPrice });
  const listing = await ok("co", "POST", "/api/listings", {
    title, venueId, runFrom: o.from ?? iso(nextMonday), runTo: o.to ?? iso(addDays(nextMonday, 11)), blockMode: "weekly", days: o.days ?? [1, 2, 3, 4, 5],
    maxAttendees: "10", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "11", blockId: bundle.id,
    passes: passes.map((p) => ({ name: p.name, price: p.price, days: p.days })),
    bookingType: "auto", waitlist: true, waitlistMode: "manual", status: "live", visibility: "public", ...extra,
  });
  await ok("co", "PUT", `/api/block-bundles/${bundle.id}/listings`, { listingIds: [listing.id] });
  const full = await ok("co", "GET", `/api/listings/${listing.id}`);
  const blocks = ((full.blocks ?? []) as { id: string; startDate: string }[]).sort((a, c) => (a.startDate < c.startDate ? -1 : 1));
  return { id: listing.id, title, blockId: blocks[0]?.id, blocks, tenantId: listing.tenantId };
}
let childN = 0;
const kid = (tag = "K") => `${tag}${stamp}x${++childN}`;
type Item = { pass: string; child?: string; dates?: string[]; age?: number; addons?: { id: string; days?: string[] }[] };
async function basket(who: string, L: Listing, items: Item[], extra: Record<string, unknown> = {}) {
  return call(who, "POST", "/api/my/bookings", { listingId: L.id, blockId: L.blockId, method: "cash", items: items.map((i) => ({ child: kid(), age: 8, ...i })), ...extra });
}
async function basketOk(who: string, L: Listing, items: Item[], extra: Record<string, unknown> = {}) {
  const r = await basket(who, L, items, extra);
  if (r.status >= 300) throw new Error(`basket -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  return r.json.bookings as any[];
}
const week = (w: number) => [0, 1, 2, 3, 4].map((d) => sd(w, d));
const getBooking = async (ref: string) => ok("co", "GET", `/api/bookings/${ref}`);
const payCash = (ref: string, amount: number) => ok("co", "POST", `/api/bookings/${ref}/record-payment`, { amount, method: "Cash" });
const act = (ref: string, body: unknown) => ok("co", "POST", `/api/bookings/${ref}/actions`, body);
const myBookings = async (who: string) => (await ok(who, "GET", "/api/my/bookings")) as any[];

test.beforeAll(async () => {
  test.setTimeout(3_000_000);
  if (fs.existsSync(CACHE) && !process.env.MNY_FRESH) {
    A = JSON.parse(fs.readFileSync(CACHE, "utf8"));
    for (const k of Object.keys(A)) { A[k].tok = (await fbSignIn(A[k].email)).idToken; A[k].tokAt = Date.now(); }
    return;
  }
  await signupParent("p1"); await signupParent("p2"); await signupParent("p3"); await signupParent("p4");
  await signupOperator("co", "company", `MNY Co ${stamp}`);
  unwall(A.co.tenantId!);
  fs.writeFileSync(CACHE, JSON.stringify(A, null, 1));
  console.log("ACCOUNTS", Object.entries(A).map(([k, v]) => `${k}=${v.email}`).join(" "));
});
test.afterAll(async () => { for (const c of Object.values(ctxs)) await c?.close().catch(() => {}); await theBrowser?.close().catch(() => {}); });

const L: Record<string, Listing> = {};
const LISTINGS = "mny-listings.json";

test("MNY money audit", async () => {
  test.setTimeout(3_000_000);

  // ======================= PART A: the three known gaps =======================
  const TERM: PassDef[] = [{ name: "1 day", days: 1, price: 20 }, { name: "3 days", days: 3, price: 54 }, { name: "5 days", days: 5, price: 90 }, { name: "Term", days: 10, price: 150 }];
  L.A = await mkListing(`MNY gaps ${stamp}`, {
    ticketOverrides: { "1 day": { capacity: "1" }, "3 days": { capacity: "0" } },
    bookRules: { Term: "blocks" },
  }, { passes: TERM });

  await check("A1-pass-cap", async () => {
    const d = sd(0, 0), d2 = sd(0, 1);
    const r1 = await basket("p1", L.A, [{ pass: "1 day", dates: [d] }]);
    const r2_ = await basket("p2", L.A, [{ pass: "1 day", dates: [d] }]);
    const b2 = r2_.json?.bookings?.[0];
    // same basket: two kids on the capped pass for a fresh date
    const r3 = await basket("p3", L.A, [{ pass: "1 day", dates: [d2] }, { pass: "1 day", dates: [d2] }]);
    const st3 = (r3.json?.bookings ?? []).map((b: any) => `${b.status}/${b.kids?.length ?? 1}kids`).join(",");
    // a different pass on the same day is not capped
    const r4 = await basket("p4", L.A, [{ pass: "5 days", dates: week(0) }]);
    const listingDoc = await ok("co", "GET", `/api/listings/${L.A.id}`);
    const rowsAfter = (await ok("co", "GET", "/api/bookings")) as any[];
    return `p1 ${r1.status} ${r1.json?.bookings?.[0]?.status}; p2 same date -> ${r2_.status} ${b2?.status ?? JSON.stringify(r2_.json).slice(0, 120)} (${b2?.note ?? ""}); same-basket 2 kids cap1 -> ${r3.status} [${st3}] ; 5-day pass same days -> ${r4.status} ${r4.json?.bookings?.[0]?.status}; passFullDates=${JSON.stringify(listingDoc.passFullDates ?? null)}; rows=${rowsAfter.length}`;
  });

  await check("A2-closed-and-daycount", async () => {
    const closed = await basket("p1", L.A, [{ pass: "3 days", dates: [sd(1, 0), sd(1, 1), sd(1, 2)] }]);
    const five2 = await basket("p1", L.A, [{ pass: "5 days", dates: [sd(1, 0), sd(1, 1)] }]);
    const five6 = await basket("p1", L.A, [{ pass: "5 days", dates: [...week(1), sd(0, 1)] }]);
    const crossWeek5 = await basket("p1", L.A, [{ pass: "5 days", dates: [sd(0, 3), sd(0, 4), sd(1, 0), sd(1, 1), sd(1, 2)] }]);
    return `closed 3-day pass -> ${closed.status} "${closed.json?.error}"; 5-day on 2 dates -> ${five2.status} "${five2.json?.error}"; 5-day on 6 dates -> ${five6.status} "${five6.json?.error}"; 5-day pass spanning two weeks (default 'week' rule) -> ${crossWeek5.status} ${crossWeek5.status < 300 ? "ACCEPTED " + crossWeek5.json.bookings.map((b: any) => b.ref + " £" + b.amount).join(",") : crossWeek5.json?.error}`;
  });

  await check("A3-term-partial", async () => {
    const five = [...week(0), ...week(1)].filter((_, i) => i % 2 === 0); // 5 of 10 dates
    const half = await basket("p2", L.A, [{ pass: "Term", dates: five }]);
    const all = await basket("p2", L.A, [{ pass: "Term", dates: [...week(0), ...week(1)] }]);
    const noDates = await basket("p3", L.A, [{ pass: "Term" }]);
    return `Term on 5/10 dates -> ${half.status} "${half.json?.error ?? "ACCEPTED"}"; Term on all 10 -> ${all.status} ${all.json?.bookings?.map((b: any) => "£" + b.amount).join("+")}; Term dateless -> ${noDates.status} ${noDates.json?.bookings?.map((b: any) => b.days?.length + "d £" + b.amount).join("+") ?? noDates.json?.error}`;
  });

  // UI evidence for A: parent page shows closed + full
  await check("A-ui-shot", async () => {
    const p = await newPage("p2", `/book/${L.A.id}`);
    const f = await snap(p, "A-parent-page", [/Tap a week/]);
    const txt = await p.locator("body").innerText();
    await p.close();
    return `${f}; page mentions Closed:${/closed/i.test(txt)} Full:${/\bfull\b/i.test(txt)}`;
  });


  // ======================= PART B: money paths =======================
  const lib0 = (await call("co", "GET", "/api/library")).json ?? {};
  await ok("co", "PUT", "/api/library", { ...lib0, addons: [...(lib0.addons ?? []), { id: "mny-lunch", name: "Lunch", type: "perday", price: 5 }, { id: "mny-tee", name: "T-shirt", type: "once", price: 7.5 }],
    settings: { ...(lib0.settings ?? {}), voucherProviders: [{ id: "edenred", name: "Edenred", details: [{ label: "Account", value: "ACC123" }] }] } });
  const SIB = { id: "r1", kind: "person", appliesTo: "all", name: "Sibling", passNames: [], enabled: true, moreThan: 1, method: "percent", value: 10, beforeDate: "" };
  const PASSES_B: PassDef[] = [{ name: "1 day", days: 1, price: 20 }, { name: "5 days", days: 5, price: 90 }, { name: "Term", days: 10, price: 150 }, { name: "Odd", days: 10, price: 99.99 }];
  L.B = await mkListing(`MNY sib ${stamp}`, { discounts: [SIB] }, { passes: PASSES_B });
  L.C = await mkListing(`MNY codes ${stamp}`, {}, { passes: PASSES_B });
  for (const [code, type, value] of [["PCT10", "percent", 10], ["AMT7", "amount", 7], ["KID3", "perAttendee", 3]] as const)
    await call("co", "POST", "/api/discounts", { code, type, value });

  L.D = await mkListing(`MNY custom ${stamp}`, { blockMode: "custom" }, { passes: PASSES_B });
  await check("B1-sibling-addons", async () => {
    const bs = await basketOk("p1", L.B, [
      { pass: "5 days", dates: week(0), addons: [{ id: "mny-lunch" }, { id: "mny-tee" }] },
      { pass: "5 days", dates: week(0), addons: [{ id: "mny-lunch" }, { id: "mny-tee" }] }]);
    const total = sum(bs.map((b) => b.amount));
    eq(total, 162 + 65, "basket total (180 -10% = 162, +2x(25+7.5))");
    const rows = bs.map((b) => `${b.ref} amt ${b.amount} list ${b.listPrice} off ${b.discountOff} kids ${b.kids?.length}`);
    eq(sum(bs.map((b) => b.listPrice ?? b.amount)), 245, "listPrice sum");
    return `total ${total}; ${rows.join(" | ")}`;
  });

  await check("B2-codes", async () => {
    // single child, 2 weeks as two lines -> KID3 per attendee. Preview (attendees=1) says 3.
    const val = await call("p2", "POST", "/api/discounts/validate", { tenantId: L.C.tenantId, code: "KID3", subtotal: 180, attendees: 1, listingId: L.C.id });
    const kidName = kid();
    const bs = await basketOk("p2", L.C, [{ pass: "5 days", dates: week(0), child: kidName }, { pass: "5 days", dates: week(1), child: kidName }], { discountCodes: ["KID3"] });
    const tot = sum(bs.map((b) => b.amount));
    const kidOff = r2(180 - tot);
    // percent + amount stack
    const bs2 = await basketOk("p3", L.C, [{ pass: "5 days", dates: week(0) }], { discountCodes: ["PCT10", "AMT7"] });
    eq(sum(bs2.map((b) => b.amount)), 90 - 9 - 7, "PCT10+AMT7 on 90");
    // two kids, KID3
    const bs3 = await basketOk("p4", L.C, [{ pass: "5 days", dates: week(0) }, { pass: "5 days", dates: week(0) }], { discountCodes: ["KID3"] });
    eq(sum(bs3.map((b) => b.amount)), 180 - 6, "KID3 two kids");
    // addons untouched by code: percent code with addons
    const bs4 = await basketOk("p3", L.C, [{ pass: "1 day", dates: [sd(1, 0)], addons: [{ id: "mny-lunch" }, { id: "mny-tee" }] }], { discountCodes: ["PCT10"] });
    eq(sum(bs4.map((b) => b.amount)), 18 + 5 + 7.5, "PCT10 on 1 day + addons");
    const msg = `validate(attendees=1,sub=180)=${JSON.stringify(val.json)}; same child on 2 weekly lines + KID3 charged total ${tot} (discount £${kidOff})`;
    if (Math.abs(kidOff - 3) > 0.006) throw new Error("per-attendee code counts child x lines: " + msg);
    return msg;
  });

  let walletBal = 0;
  await check("B3-wallet-code-addons-split", async () => {
    // build wallet: p3 hasn't paid anything; use p4: book 5-day cash £90, record cash, parent releases 2 days to wallet
    const [b0] = await basketOk("p4", L.C, [{ pass: "5 days", dates: week(1), child: kid() }]);
    await payCash(b0.ref, 90);
    const rel = await call("p4", "POST", `/api/my/bookings/${b0.ref}/cancel`, { days: week(1).slice(0, 2), resolution: "wallet" });
    if (rel.status >= 300) throw new Error("wallet release " + JSON.stringify(rel.json));
    const w = await ok("p4", "GET", "/api/my/wallet");
    walletBal = (w.balances ?? [])[0]?.balance ?? 0;
    eq(walletBal, 36, "wallet after releasing 2/5 days of £90");
    // Term (10 days, 2 blocks) + PCT10 + lunch x10 + tee, wallet 36 all
    const bs = await basketOk("p4", L.C, [{ pass: "Term", dates: [...week(0), ...week(1)], addons: [{ id: "mny-lunch" }, { id: "mny-tee" }] }], { discountCodes: ["PCT10"], walletCap: 36 }); // the checkout ASKS: the family chose to use all £36
    const gross = 150 - 15 + 50 + 7.5;
    const amt = sum(bs.map((b) => b.amount)), wal = sum(bs.map((b) => b.walletApplied ?? 0));
    eq(r2(amt + wal), gross, "amount due + wallet = total");
    eq(wal, 36, "wallet used");
    // each row: list - off = amount + walletApplied
    const rowChk = bs.map((b) => `${b.ref}:${b.amount}+w${b.walletApplied ?? 0} list ${b.listPrice} off ${b.discountOff} days ${b.days?.length}`);
    for (const b of bs) if (b.listPrice !== undefined) eq(r2(b.listPrice - (b.discountOff ?? 0)), r2(b.amount + (b.walletApplied ?? 0)), `row ${b.ref} list-off=amount+wallet`);
    const w2 = await ok("p4", "GET", "/api/my/wallet");
    eq((w2.balances ?? [])[0]?.balance ?? 0, 0, "wallet left");
    // walletCap
    const [b2] = await basketOk("p4", L.C, [{ pass: "1 day", dates: [sd(1, 4)] }], { walletCap: 5 });
    eq(b2.walletApplied ?? 0, 0, "no wallet left to apply");
    return `rows ${rowChk.join(" | ")}`;
  });

  // ---- cancel / refund on a multi-week booking
  let oddRef = "";
  await check("B4-refund-multiweek-policy", async () => {
    const [b] = await basketOk("p1", L.D, [{ pass: "Odd", dates: [...week(0), ...week(1)], child: kid() }]);
    oddRef = b.ref;
    const bks = await myBookings("p1");
    const mine = bks.filter((x) => x.ref === b.ref || x.listing === L.D.title);
    await payCash(b.ref, b.amount);
    eq(b.amount, 99.99, "Odd price");
    const pct = (d: string) => { const h = (Date.parse(d + "T00:00:00+01:00") - Date.now()) / 36e5; return h >= 168 ? 1 : h >= 48 ? 0.5 : 0; };
    const release = [...week(0).slice(1), ...week(1)]; // 9 days, keep Mon 12
    const slot = r2(99.99 / 10);
    const exp = sum(release.map((d) => r2(slot * pct(d))));
    const r = await call("p1", "POST", `/api/my/bookings/${b.ref}/cancel`, { days: release, resolution: "refund" });
    if (r.status >= 300) throw new Error("partial " + JSON.stringify(r.json));
    const pending = r.json.cancel?.amount;
    eq(pending, exp, "partial refund per-day policy");
    // whole cancel afterwards: overwrites the pending request?
    const w = await call("p1", "POST", `/api/my/bookings/${b.ref}/cancel`, {});
    return `blocks=${new Set(mine.map((x) => x.blockId)).size}; slot ${slot}; 9-day partial pending ${pending} (expected ${exp}); then whole cancel -> ${w.status} cancel=${JSON.stringify(w.json?.cancel)} paid 99.99`;
  });
  await check("B4b-approve-refund-ledger", async () => {
    if (!oddRef) throw new Error("no booking");
    const before = await getBooking(oddRef);
    const amt = before.cancel?.amount;
    const r = await call("co", "POST", `/api/bookings/${oddRef}/actions`, { type: "refund-approve" });
    const after = await getBooking(oddRef);
    const rec = await ok("co", "GET", "/api/reconciliation");
    const mineRef = rec.refunds.filter((x: any) => x.ref === oddRef);
    return `approve ${r.status}; cancel.amount ${amt} -> refundedApproved ${after.refundedApproved} pay ${after.pay} status ${after.status}; reconciliation refunds for ref: ${JSON.stringify(mineRef.map((x: any) => x.amount))}; log ${JSON.stringify(after.refundLog)}`;
  });

  // whole-booking cancel on paid multi-week, no partials
  await check("B4c-whole-cancel-rounding", async () => {
    const [b] = await basketOk("p2", L.D, [{ pass: "Odd", dates: [...week(0), ...week(1)], child: kid() }]);
    await payCash(b.ref, b.amount);
    const r = await call("p2", "POST", `/api/my/bookings/${b.ref}/cancel`, {});
    const h = (Date.parse(sd(0, 0) + "T00:00:00+01:00") - Date.now()) / 36e5;
    const pct = h >= 168 ? 1 : h >= 48 ? 0.5 : 0;
    eq(r.json.cancel?.amount, r2(99.99 * pct), "whole cancel policy amount");
    return `notice ${h.toFixed(1)}h -> ${pct * 100}%: cancel.amount ${r.json.cancel?.amount} of 99.99 (${r.json.cancel?.msg})`;
  });

  // ---- operator on behalf
  await check("B5-take-booking-onbehalf", async () => {
    const mk = (k: string, method: string, extra: Record<string, unknown> = {}) => call("co", "POST", "/api/my/bookings", { listingId: L.C.id, blockId: L.C.blockId, method, items: [{ pass: "5 days", child: kid(), age: 8, dates: week(0) }, { pass: "5 days", child: kid(), age: 8, dates: week(0) }], onBehalfOf: { name: "Walk In", email: `e2e-mny-walk-${k}-${stamp}@${TEST_EMAIL_DOMAIN}` }, ...extra });
    const cash = await mk("c", "Cash");
    const bank = await mk("b", "Bank transfer", { discountCodes: ["PCT10"] });
    const free = await mk("f", "HAF (funded £0)", { overrideTotal: 0, overrideReason: "HAF" });
    const freeNoOv = await mk("g", "HAF (funded £0)");
    const ov = await mk("o", "Cash", { discountCodes: ["AMT7"], overrideTotal: 123.45, overrideReason: "mate" });
    for (const [n, r] of Object.entries({ cash, bank, free, freeNoOv, ov })) if (r.status >= 300) throw new Error(`${n}: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
    const t = (r: any) => sum(r.json.bookings.map((b: any) => b.amount));
    eq(t(cash), 180, "cash 2 kids"); eq(t(bank), 162, "bank PCT10");
    eq(t(free), 0, "free override 0"); eq(t(ov), 123.45, "override 123.45");
    const fb = free.json.bookings[0];
    const ob = ov.json.bookings;
    const origSum = sum(ob.map((b: any) => b.priceOverride?.originalAmount ?? 0));
    eq(origSum, 173, "override original total = 180-7");
    return `cash £${t(cash)} pay=${cash.json.bookings[0].pay}; bank £${t(bank)} pay=${bank.json.bookings[0].pay}; free £${t(free)} pay=${fb.pay}; HAFnoOv=${JSON.stringify(freeNoOv.json.bookings.map((b: any) => ({ a: b.amount, w: b.walletApplied, st: b.status, l: b.listPrice, pay: b.pay })))} method=${fb.method}; HAF w/o override -> £${t(freeNoOv)} pay=${freeNoOv.json.bookings[0].pay} method=${freeNoOv.json.bookings[0].method}; override rows ${ob.length} amounts ${ob.map((b: any) => b.amount)} originals ${ob.map((b: any) => b.priceOverride?.originalAmount)}`;
  });

  // ---- waitlist offer accept amount
  await check("B6-waitlist-offer-accept", async () => {
    const LW = await mkListing(`MNY wait ${stamp}`, { maxAttendees: "1", waitlist: true, waitlistMode: "manual" }, { passes: [{ name: "1 day", days: 1, price: 20 }] });
    const d = sd(0, 2);
    const [a] = await basketOk("p1", LW, [{ pass: "1 day", dates: [d] }], { discountCodes: ["AMT7"] });
    const [w] = await basketOk("p2", LW, [{ pass: "1 day", dates: [d] }], { discountCodes: ["PCT10"] });
    eq(w.status, "Waitlisted", "p2 waitlisted");
    const cc = await ok("co", "GET", "/api/discounts");
    const used = Object.fromEntries(cc.map((c: any) => [c.code, c.usedCount]));
    await call("p1", "POST", `/api/my/bookings/${a.ref}/cancel`, {});
    const off = await call("co", "POST", `/api/bookings/${w.ref}/actions`, { type: "offer" });
    const acc = await call("p2", "POST", `/api/my/bookings/${w.ref}/accept-offer`, {});
    const fin = await getBooking(w.ref);
    return `waitlisted amount ${w.amount} (list ${w.listPrice}, off ${w.discountOff}); offer ${off.status}; accept ${acc.status} ${acc.json?.error ?? ""}; final status ${fin.status} amount ${fin.amount} pay ${fin.pay}; codes usedCount ${JSON.stringify(used)}`;
  });

  // ---- TFC part pay + voucher
  await check("B7-tfc-part-pay", async () => {
    const out: string[] = [];
    L.E = await mkListing(`MNY tfc ${stamp}`, { maxAttendees: "40" }, { passes: PASSES_B });
    for (const tfcAmt of [40, 33.33, 150, 149.99]) {
      const r = await basket("p3", L.E, [{ pass: "Term", dates: [...week(0), ...week(1)], child: kid() }], { method: "tfc", tfc: { amount: tfcAmt, remainderVia: "card" } });
      if (r.status >= 300) { out.push(`${tfcAmt}: ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`); continue; }
      const bs = r.json.bookings;
      const parts = bs.map((b: any) => b.tfcAmount ?? b.amount);
      const rec = (await ok("co", "GET", "/api/reconciliation")).items.filter((i: any) => bs.some((b: any) => b.ref === i.ref));
      out.push(`tfc ${tfcAmt}: rows ${bs.map((b: any) => `£${b.amount} tfc ${b.tfcAmount ?? "-"} via ${b.tfcRemainderVia ?? "-"} pay ${b.pay}`).join(" / ")} partsSum ${sum(parts)}; recon outstanding ${rec.map((i: any) => i.outstanding)}`);
      if (sum(parts) !== Math.min(tfcAmt, 150)) throw new Error(`TFC parts ${parts} do not sum to ${tfcAmt}: ` + JSON.stringify(bs.map((b: any) => ({ a: b.amount, pay: b.pay, st: b.status, t: b.tfcAmount, w: b.walletApplied, m: b.method }))));
      if (bs.some((b: any) => (b.tfcAmount ?? 0) > b.amount)) throw new Error("tfc part > amount");
    }
    return out.join(" || ");
  });
  await check("B8-voucher", async () => {
    const bs = await basketOk("p3", L.C, [{ pass: "5 days", dates: week(1), child: kid() }], { method: "voucher", voucherScheme: "edenred" });
    const b = bs[0];
    if (b.pay !== "Awaiting voucher payment") throw new Error("pay " + b.pay + " " + JSON.stringify({ m: b.method, vs: b.voucherScheme, st: b.status, a: b.amount, lib: ((await ok("co", "GET", "/api/library")).settings ?? {}).voucherProviders }));
    return `voucher: £${b.amount} pay ${b.pay} scheme ${b.voucherScheme} sendBy ${b.voucherSendBy} receiveBy ${b.voucherReceiveBy}`;
  });


  // ---- ledger: Money in / Reconciliation vs rows
  await check("B9-ledger", async () => {
    const rows = (await ok("co", "GET", "/api/bookings")) as any[];
    const rec = await ok("co", "GET", "/api/reconciliation");
    const settled = (b: any) => ["Paid", "Refund pending", "Refunded", "Partially refunded"].includes(b.pay);
    const received = (b: any) => r2((settled(b) ? Math.max(b.amount ?? 0, b.amountPaid ?? 0) : Math.max(0, b.amountPaid ?? 0)) + Math.max(0, b.walletApplied ?? 0));
    const gotSum = sum(rows.map(received));
    const refundedSum = sum(rows.map((b) => Math.max(0, b.refundedApproved ?? 0) + (b.refundLog ?? []).filter((x: any) => !/^refund approved/i.test(x.label || "")).reduce((t: number, x: any) => t + (x.amount || 0), 0)));
    const dead = (b: any) => ["Cancelled", "Declined", "Waitlisted"].includes(b.status);
    const owed = sum(rows.filter((b) => !dead(b) && !["Paid", "Funded"].includes(b.pay)).map((b) => Math.max(0, r2((b.amount ?? 0) - (b.amountPaid ?? 0)))));
    const recItems = rec.items as any[];
    const recOut = rec.summary.outstanding;
    const rowOutByRef = Object.fromEntries(recItems.map((i: any) => [i.ref, i.outstanding]));
    const diffs = rows.filter((b) => !dead(b) && !["Paid", "Funded"].includes(b.pay) && Math.abs((rowOutByRef[b.ref] ?? 0) - Math.max(0, r2((b.amount ?? 0) - (b.amountPaid ?? 0)))) > 0.005).map((b) => `${b.ref} pay=${b.pay} amt=${b.amount} paid=${b.amountPaid} recon=${rowOutByRef[b.ref]}`);
    const p = await newPage("co", "/company/purchasing");
    const f1 = await snap(p, "B9-money-in", [/Money in|Income/i]);
    const txt = await p.locator("body").innerText();
    await p.close();
    const p2 = await newPage("co", "/company/reconciliation");
    const f2 = await snap(p2, "B9-reconciliation", [/Reconcil/i]);
    const txt2 = await p2.locator("body").innerText();
    await p2.close();
    fs.writeFileSync(path.join(SHOTS, "B9-money-in.txt"), txt); fs.writeFileSync(path.join(SHOTS, "B9-recon.txt"), txt2);
    const m = txt.match(/£[\d,]+\.\d\d/g)?.slice(0, 8);
    const m2 = txt2.match(/£[\d,]+\.\d\d/g)?.slice(0, 10);
    return `rows ${rows.length}; received(sum of rows) ${gotSum}; refunded ${refundedSum}; net ${r2(gotSum - refundedSum)} | recon.summary.outstanding ${recOut} vs independent owed ${owed}; per-row diffs ${diffs.length ? diffs.join("; ") : "none"}; refunds ${JSON.stringify(rec.summary.refunds)} | MoneyIn page amounts ${m} | Recon page amounts ${m2} | ${f1} ${f2}`;
  });

  fs.writeFileSync(path.join(SHOTS, LISTINGS), JSON.stringify(L, null, 1));
});
