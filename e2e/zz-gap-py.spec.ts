import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { ROOT, WEB_URL, API_URL } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, apiFetch, apiPost, fbSignIn, fbSignUp } from "./helpers/accounts";
import { cardWith } from "./helpers/ui";

// Gap-fill sweep: PY / BQ / AW checks that already pass on one account kind, re-run on a FRESH freelancer and a FRESH franchise
// (franchise joins a fresh head-office company by invite). Local stack. Run with --project=e2e --no-deps and a config without webServer.

const stamp = Date.now().toString(36);
const SHOTS = path.join(ROOT, "e2e/review/shots/gappy");
const RESULTS = path.join(SHOTS, "_results.json");
fs.mkdirSync(SHOTS, { recursive: true });
type Res = { status: "pass" | "fail" | "blocked"; note: string; shot?: string };
const results: Record<string, Res> = fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, "utf8")) : {};
const save = () => fs.writeFileSync(RESULTS, JSON.stringify(results, null, 2));
const ONLY = (process.env.GAP_ONLY ?? "").split(",").filter(Boolean);

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
type Kind = "freelancer" | "franchise" | "company";
type Acct = { email: string; uid: string; tenantId: string | null; name?: string };
const tokCache = new Map<string, { t: string; at: number }>();
const tok = async (a: Acct) => {
  const c = tokCache.get(a.email);
  if (c && Date.now() - c.at < 40 * 60_000) return c.t;
  const t = (await fbSignIn(a.email)).idToken;
  tokCache.set(a.email, { t, at: Date.now() });
  return t;
};
const A: Record<string, Acct> = {};
const em = (n: string) => `e2e-gap-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`;
const get = async <T = any>(a: Acct, p: string) => apiFetch<T>(p, await tok(a));
const post = async <T = any>(a: Acct, p: string, b: unknown) => apiPost<T>(p, await tok(a), b);
async function raw(a: Acct, method: string, p: string, body?: unknown) {
  const res = await fetch(`${API_URL}${p}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${await tok(a)}` }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  let j: any = null; try { j = await res.json(); } catch { /* */ }
  return { ok: res.ok, status: res.status, body: j };
}
const errText = (r: { body: any }) => (typeof r.body?.error === "string" ? r.body.error : JSON.stringify(r.body?.error ?? r.body));

// ---------------------------------------------------------------- browser
const ctxs = new Map<string, BrowserContext>();
let browserRef: Browser;
async function ctxFor(who: string, home: string): Promise<BrowserContext> {
  const have = ctxs.get(who); if (have) return have;
  const c = await browserRef.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await c.newPage();
  await page.goto(`${WEB_URL}/login`);
  await page.getByPlaceholder("you@example.com").fill(A[who].email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(home.includes("custdash") ? /\/custdash/ : `**${home}`, { timeout: 90_000 });
  await page.close();
  ctxs.set(who, c);
  return c;
}
const opPages = new Map<string, Page>();
async function opPage(k: Kind): Promise<Page> {
  let p = opPages.get(k);
  if (p && !p.isClosed()) return p;
  const key = k === "company" ? "ho" : k;
  p = await (await ctxFor(key, `/${k}/bookings`)).newPage();
  p.setDefaultTimeout(25_000);
  opPages.set(k, p);
  return p;
}
async function parPage(who = "p1"): Promise<Page> {
  const key = `${who}-page`;
  let p = opPages.get(key);
  if (p && !p.isClosed()) return p;
  p = await (await ctxFor(who, "/custdash/browse")).newPage();
  p.setDefaultTimeout(25_000);
  opPages.set(key, p);
  return p;
}
/** Screenshot only once the page has loaded: not "Loading", no skeleton pulse. Returns the path. */
async function shot(page: Page, id: string, k: string, tag = "") {
  await page.waitForLoadState("load").catch(() => {});
  for (let i = 0; i < 30; i++) {
    const t = (await page.locator("body").innerText().catch(() => "")).trim();
    if (t.length > 40 && !/(^|\n)\s*(Loading|Just a moment)/i.test(t) && !(await page.locator('[class*="animate-pulse"]').count().catch(() => 0))) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(700);
  const file = path.join(SHOTS, `${id}.${k}${tag}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}
async function check(id: string, k: Kind, page: () => Promise<Page | null>, fn: () => Promise<string>) {
  if (ONLY.length && !ONLY.includes(id) && !ONLY.includes(`${id}.${k}`)) return;
  const key = `${id}.${k}`;
  try {
    const note = await fn();
    results[key] = { status: results[key]?.status === "blocked" && results[key]?.note === note ? "blocked" : "pass", note, shot: path.join(SHOTS, `${id}.${k}.png`) };
  } catch (e) {
    const msg = String((e as Error).message).split("\n").filter(Boolean).slice(0, 4).join(" | ").slice(0, 900);
    try { const p = await page(); if (p) await shot(p, id, k, ".FAIL"); } catch { /* */ }
    results[key] = { status: "fail", note: msg, shot: path.join(SHOTS, `${id}.${k}.FAIL.png`) };
  }
  save();
  console.log(`[${results[key].status.toUpperCase()}] ${key}: ${results[key].note.slice(0, 200)}`);
}

// ---------------------------------------------------------------- worlds
type W = { k: Kind; op: Acct; venue: string; period: string; p1: string; p3: string; p5: string; std: L; weeks: { blockId: string; dates: string[] }[] };
type L = { id: string; title: string; blockId: string; weeks: { blockId: string; dates: string[] }[] };
const W: Partial<Record<Kind, W>> = {};
let kidSeq = 0;
const kid = (tag: string) => `GP ${tag} ${stamp}-${++kidSeq}`;
const nextMonday = () => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

async function buildWorld(k: Kind): Promise<W> {
  const op = A[k === "company" ? "ho" : k];
  const lib = ((await get(op, "/api/library")) ?? {}) as any;
  await apiFetch("/api/library", await tok(op), { method: "PUT", body: JSON.stringify({
    venues: [{ id: "gp-venue", name: "GP Sports Hall", address: "1 Test Way", city: "Northampton" }],
    settings: { ...(lib.settings ?? {}), marketplaceListed: true,
      billing: { businessName: `GP ${k}`, accountName: `GP Club ${k} ${stamp}`, sortCode: "12-34-56", accountNumber: "87654321", bankName: "Test Bank" },
      voucherProviders: [{ id: "edenred", name: "Edenred", details: [{ label: "Account reference", value: `EDN-${stamp}` }] }] },
  }) });
  const period = (await post(op, "/api/periods", { title: "Full day", start: "09:00", finish: "15:30" })).id;
  const p1 = (await post(op, "/api/passes", { name: "1 day", days: 1 })).id;
  const p3 = (await post(op, "/api/passes", { name: "3 days", days: 3 })).id;
  const p5 = (await post(op, "/api/passes", { name: "5 days", days: 5 })).id;
  const w = { k, op, venue: "gp-venue", period, p1, p3, p5 } as W;
  w.std = await mkListing(w, `GP Std ${k} ${stamp}`, {});
  w.weeks = w.std.weeks;
  return w;
}
async function mkListing(w: W, title: string, o: { cap?: number; approval?: boolean; waitlist?: "auto" | "manual"; hidden?: boolean; haf?: boolean }): Promise<L> {
  const op = w.op;
  const bundle = o.haf
    ? await post(op, "/api/block-bundles", { name: `Bundle ${title}`, periodIds: [(await post(op, "/api/periods", { title: "HAF day", start: "10:00", finish: "14:00" })).id], passIds: [(await post(op, "/api/passes", { name: "HAF place", days: 1 })).id], priced: true, masterPrice: 0, calcOn: true })
    : await post(op, "/api/block-bundles", { name: `Bundle ${title}`, periodIds: [w.period], passIds: [w.p1, w.p3, w.p5], priced: true, masterPrice: 90, calcOn: true, passMode: { [w.p1]: "flat", [w.p3]: "flat", [w.p5]: "flat" }, passFlat: { [w.p1]: 20, [w.p3]: 54, [w.p5]: 90 } });
  const start = nextMonday();
  const l = await post(op, "/api/listings", {
    title, venueId: w.venue, runFrom: iso(start), runTo: iso(addDays(start, o.haf ? 4 : 18)), blockMode: "weekly", days: [1, 2, 3, 4, 5],
    maxAttendees: String(o.cap ?? 10), capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id,
    passes: o.haf ? [{ name: "HAF place", price: 0, days: 1 }] : [{ name: "1 day", price: 20, days: 1 }, { name: "3 days", price: 54, days: 3 }, { name: "5 days", price: 90, days: 5 }],
    bookingType: o.approval || o.haf ? "manual" : "auto",
    ...(o.waitlist ? { waitlist: true, waitlistMode: o.waitlist } : {}),
    status: "live", visibility: o.hidden ? "hidden" : "public",
  });
  await apiFetch(`/api/block-bundles/${bundle.id}/listings`, await tok(op), { method: "PUT", body: JSON.stringify({ listingIds: [l.id] }) });
  const doc = await get(A.p1, `/api/listings/${l.id}`);
  const weeks = (doc.blocks as any[]).map((b) => ({ blockId: b.id, dates: (b.sessions as any[]).map((s) => s.date) }));
  expect(weeks.length, "blocks for " + title).toBeGreaterThan(0);
  return { id: l.id, title, blockId: weeks[0].blockId, weeks };
}
async function newKid(who: string, tag: string) {
  const name = kid(tag);
  await post(A[who], "/api/my/children", { name, dob: "2018-05-14" });
  return name;
}
type Bk = { ref: string; amount: number; status: string; pay: string; method?: string; [k: string]: any };
let cursor = 0;
/** Parent (or on-behalf operator) booking via the API. */
async function book(w: W, o: { method: string; pass?: string; who?: string; as?: Acct; l?: L; week?: number; offset?: number; extra?: Record<string, unknown> }) {
  const l = o.l ?? w.std;
  const pass = o.pass ?? "3 days";
  const n = pass === "1 day" ? 1 : pass === "3 days" ? 3 : 5;
  const wk = l.weeks[o.week ?? cursor++ % l.weeks.length];
  const who = o.who ?? "p1";
  const child = await newKid(who, "k");
  const dates = wk.dates.slice(o.offset ?? 0, (o.offset ?? 0) + n);
  const r = await raw(o.as ?? A[who], "POST", "/api/my/bookings", { listingId: l.id, blockId: wk.blockId, method: o.method, walletCap: 0, items: [{ pass, child, age: 8, dates }], ...(o.extra ?? {}) });
  if (!r.ok) throw new Error(`book ${o.method} -> ${r.status} ${errText(r)}`);
  return { ...(r.body as { bookings: Bk[]; bank?: any }), child, first: (r.body as any).bookings[0] as Bk };
}
const getB = (w: W, ref: string) => get<Bk>(w.op, `/api/bookings/${encodeURIComponent(ref)}`);
const action = (w: W, ref: string, type: string, extra: Record<string, unknown> = {}) => post<Bk>(w.op, `/api/bookings/${encodeURIComponent(ref)}/actions`, { type, ...extra });
const payments = (w: W) => get<{ refs?: string[]; amount: number }[]>(w.op, "/api/payments");
const payTokenFor = (w: W, ref: string): string => {
  const out = execFileSync("npx", ["tsx", path.join(ROOT, "e2e/helpers/payTokenFor.ts"), w.op.tenantId!, ref], { cwd: path.join(ROOT, "server"), encoding: "utf8" });
  const m = out.match(/@@TOKEN@@(\S+)@@END@@/);
  if (!m) throw new Error("no token: " + out.slice(-200));
  return m[1];
};
async function setSettings(w: W, patch: Record<string, unknown>) {
  const lib = ((await get(w.op, "/api/library")) ?? {}) as any;
  await apiFetch("/api/library", await tok(w.op), { method: "PUT", body: JSON.stringify({ settings: { ...(lib.settings ?? {}), ...patch } }) });
}
async function opBookingPage(w: W, ref: string, buttonRe = /Cancel booking|Refund|Mark|Decline|Resend/) {
  const page = await opPage(w.k);
  await page.goto(`/${w.k}/bookings?ref=${encodeURIComponent(ref)}`);
  const btn = page.getByRole("button", { name: buttonRe }).first();
  const open = await btn.waitFor({ state: "visible", timeout: 25_000 }).then(() => true).catch(() => false);
  if (!open) {
    await page.getByText(new RegExp(`Ref ${ref}`)).first().click({ timeout: 25_000 });
    await btn.waitFor({ state: "visible", timeout: 25_000 });
  }
  await page.waitForTimeout(600);
  return page;
}
const OPK: Kind[] = ["freelancer", "franchise"];

test.describe.configure({ mode: "serial" });
test.describe("gap PY sweep", () => {
  test.setTimeout(900_000);
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(600_000);
    browserRef = browser;
    for (const n of ["p1", "p2"]) {
      const s = await fbSignUp(em(n));
      await apiPost("/api/register-role", s.idToken, { role: "parent", postcode: "NN5 7EA" });
      await apiPost("/api/me/welcome", s.idToken, {});
      A[n] = { email: em(n), uid: s.uid, tenantId: null };
    }
    for (const [key, role] of [["freelancer", "freelancer"], ["ho", "company"]] as const) {
      const s = await fbSignUp(em(key));
      const name = `GP ${role} ${stamp}`;
      const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role, businessName: name, providerName: name, providerNameMode: "business" });
      A[key] = { email: em(key), uid: s.uid, tenantId: r.tenantId, name };
    }
    execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", A.freelancer.tenantId!, A.ho.tenantId!], { stdio: "pipe" });
    const inv = await post<{ token: string }>(A.ho, "/api/invites", { role: "franchise", franchiseName: `GP Franchise ${stamp}` });
    const s = await fbSignUp(em("franchise"));
    await apiPost(`/api/invites/${inv.token}/accept`, s.idToken, {});
    A.franchise = { email: em("franchise"), uid: s.uid, tenantId: A.ho.tenantId, name: `GP Franchise ${stamp}` };
    const me = await get(A.franchise, "/api/me");
    console.log("ACCOUNTS", JSON.stringify({ freelancer: A.freelancer.email, franchise: A.franchise.email, ho: A.ho.email, parent: A.p1.email, franchiseMe: { role: me.role, franchiseId: me.franchiseId } }));
    fs.writeFileSync(path.join(SHOTS, "_accounts.json"), JSON.stringify({ A, stamp }, null, 2));
    for (const k of ["freelancer", "franchise", "company"] as Kind[]) {
      W[k] = await buildWorld(k);
      await post(A.p1, "/api/my/providers/follow", { tenantId: A[k === "company" ? "ho" : k].tenantId });
      await post(A.p2, "/api/my/providers/follow", { tenantId: A[k === "company" ? "ho" : k].tenantId }).catch(() => {});
    }
  });
  test.afterAll(async () => { for (const c of ctxs.values()) await c.close().catch(() => {}); });

  // ───────────────────────── PY-006 / PY-008 (franchise) ─────────────────────────
  test("PY-006 PY-008 bank + cash mark received", async () => {
    for (const k of ["franchise"] as Kind[]) {
      const w = W[k]!;
      await check("PY-006", k, () => opPage(k), async () => {
        const r = await book(w, { method: "bank" });
        const b = r.first;
        expect(b.pay).toBe("Unpaid"); expect(b.amount).toBe(54);
        expect(r.bank?.sortCode, "booking response carries the bank details").toBe("12-34-56");
        const page = await opBookingPage(w, b.ref);
        await expect(page.getByText(/Waiting for a bank transfer/i)).toBeVisible();
        await shot(page, "PY-006", k, ".before");
        await page.getByRole("button", { name: "Mark paid" }).click();
        await expect.poll(async () => (await getB(w, b.ref)).pay, { timeout: 25_000 }).toBe("Paid");
        await page.waitForTimeout(1500);
        await shot(page, "PY-006", k);
        const after = await getB(w, b.ref);
        expect(after.amountPaid).toBe(54);
        const pays = await payments(w);
        expect(pays.some((p) => (p.refs ?? []).includes(b.ref) && p.amount === 54), "payment record £54 in Money in").toBeTruthy();
        let told = "";
        for (let i = 0; i < 8 && !told; i++) { const ns = JSON.stringify(await get(A.p1, "/api/notifications")); told = ns.match(new RegExp(`[^{}]*${b.ref}[^{}]*`))?.[0]?.slice(0, 160) ?? ""; if (!told) await new Promise((s) => setTimeout(s, 1500)); }
        return `${b.ref}: bank booking £54 Unpaid, bank details returned; franchise UI showed 'Waiting for a bank transfer' + button 'Mark paid' (the catalogue's 'Mark transfer received' wording is not what the button says on any account kind); after click Paid, amountPaid 54, payments record £54. Family notification: ${told ? '"' + told + '"' : "none found for this ref in the parent bell"}`;
      });
      await check("PY-008", k, () => opPage(k), async () => {
        const b = (await book(w, { method: "cash" })).first;
        expect(b.pay).toBe("Unpaid"); expect(b.status).toBe("Confirmed");
        const page = await opBookingPage(w, b.ref);
        await shot(page, "PY-008", k, ".before");
        await page.getByRole("button", { name: "Mark paid" }).click();
        await expect.poll(async () => (await getB(w, b.ref)).pay, { timeout: 25_000 }).toBe("Paid");
        await page.waitForTimeout(1500);
        await shot(page, "PY-008", k);
        const pays = await payments(w);
        expect(pays.some((p) => (p.refs ?? []).includes(b.ref) && p.amount === 54)).toBeTruthy();
        return `${b.ref}: cash booking £54 Unpaid/Confirmed; franchise UI 'Mark paid' -> Paid, payments record £54`;
      });
    }
  });

  // ───────────────────────── PY-015 ─────────────────────────
  test("PY-015 voucher received", async () => {
    for (const k of OPK) {
      const w = W[k]!;
      await check("PY-015", k, () => opPage(k), async () => {
        const wk = w.std.weeks[1];
        const child = await newKid("p1", "v");
        const r = await raw(A.p1, "POST", "/api/my/bookings", { listingId: w.std.id, blockId: wk.blockId, method: "Childcare voucher — Edenred", voucherScheme: "edenred", walletCap: 0, items: [{ pass: "3 days", child, age: 8, dates: wk.dates.slice(0, 3), paymentRef: `EDN-REF-${stamp}` }] });
        expect(r.ok, errText(r)).toBe(true);
        const ref = r.body.bookings[0].ref as string;
        const b0 = await getB(w, ref);
        expect(b0.pay).toBe("Awaiting voucher payment");
        const nudge = await raw(w.op, "POST", `/api/bookings/${ref}/nudge`, {});
        expect(nudge.ok, "nudge " + errText(nudge)).toBe(true);
        const page = await opBookingPage(w, ref, /^Mark .* received$/);
        const btnTxt = await page.getByRole("button", { name: /^Mark .* received$/ }).first().innerText();
        await shot(page, "PY-015", k, ".before");
        await page.getByRole("button", { name: /^Mark .* received$/ }).first().click();
        await expect.poll(async () => (await getB(w, ref)).pay, { timeout: 25_000 }).toBe("Paid");
        await page.waitForTimeout(1500);
        await shot(page, "PY-015", k);
        const pays = await payments(w);
        expect(pays.some((p) => (p.refs ?? []).includes(ref) && p.amount === 54)).toBeTruthy();
        return `${ref}: voucher booking 'Awaiting voucher payment'; nudge sent (200); ${k} UI button '${btnTxt.trim()}' -> Paid, payments record £54`;
      });
    }
  });

  // ───────────────────────── PY-017 PY-019 PY-020 PY-021 ─────────────────────────
  test("PY-017 HAF, PY-019/020/021 invoice", async () => {
    for (const k of OPK) {
      const w = W[k]!;
      if (k === "freelancer") await check("PY-017", k, () => opPage(k), async () => {
        const wk = w.std.weeks[0];
        const child = await newKid("p1", "haf");
        const r = await raw(w.op, "POST", "/api/my/bookings", { listingId: w.std.id, blockId: wk.blockId, method: "HAF (funded £0)", walletCap: 0, onBehalfOf: { name: "GP HAF Family", email: `haf-${k}-${stamp}@${TEST_EMAIL_DOMAIN}` }, overrideTotal: 0, overrideReason: "HAF funded", items: [{ pass: "1 day", child, age: 8, dates: [wk.dates[0]] }] });
        expect(r.ok, errText(r)).toBe(true);
        const created = r.body.bookings[0] as Bk;
        expect(created.pay).toBe("Funded"); expect(created.amount).toBe(0); expect(created.status).toBe("Confirmed");
        const page = await opBookingPage(w, created.ref, /Cancel booking|Refund|Mark|Resend/);
        await shot(page, "PY-017", k);
        const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
        const nothing = /nothing to collect/i.test(body);
        expect(nothing || /funded/i.test(body), "page should say Funded / nothing to collect").toBeTruthy();
        const inv = JSON.stringify((await raw(w.op, "GET", `/api/invoices`)).body).includes(created.ref);
        const cnt = (await get(A.p1, `/api/listings/${w.std.id}`)).blocks[0].sessions.find((s: any) => s.date === wk.dates[0]);
        expect(inv, "no invoice raised for a funded place").toBe(false);
        return `${created.ref}: HAF booking by provider Confirmed, £0, pay Funded; booking page text ${nothing ? "says 'Nothing to collect'" : "shows Funded (no literal 'Nothing to collect' text)"}; no invoice raised (Invoices list has no entry); place on the day: ${JSON.stringify(cnt)}`;
      });
      let invRef = "";
      await check("PY-019", k, () => opPage(k), async () => {
        const kidN = await newKid("p1", "inv");
        const wk = w.std.weeks[1];
        const famEmail = `fam-${k}-${stamp}@${TEST_EMAIL_DOMAIN}`;
        const r = await raw(w.op, "POST", "/api/my/bookings", { listingId: w.std.id, blockId: wk.blockId, method: "card", onBehalfOf: { name: "GP Invoice Family", email: famEmail, phone: "07700900123" }, items: [{ pass: "3 days", child: kidN, age: 8, dates: wk.dates.slice(2, 5) }] });
        expect(r.ok, errText(r)).toBe(true);
        const b = r.body.bookings[0] as Bk; invRef = b.ref;
        expect(b.pay).toBe("Invoice sent"); expect(b.amount).toBe(54);
        const page = await opBookingPage(w, b.ref);
        await shot(page, "PY-019", k);
        const tokn = payTokenFor(w, b.ref);
        const pg = await (await ctxFor(k === "franchise" ? "franchise" : "freelancer", `/${k}/bookings`)).newPage();
        await pg.goto(`/pay/b/${tokn}`);
        await expect(pg.getByText("Payment request from")).toBeVisible({ timeout: 30_000 });
        await expect(pg.getByText("£54.00").first()).toBeVisible();
        await shot(pg, "PY-019", k, ".paylink");
        await pg.close();
        return `${b.ref}: operator booking for a family -> pay 'Invoice sent', £54; public pay link /pay/b/{token} loads 'Payment request from' with £54.00 (card button needs Stripe: not exercised). Payment-link email not inspected.`;
      });
      if (k === "franchise") {
        await check("PY-020", k, () => opPage(k), async () => {
          expect(invRef).toBeTruthy();
          const before = await getB(w, invRef);
          const page = await opBookingPage(w, invRef, /Resend invoice/);
          await page.getByRole("button", { name: "Resend invoice" }).click();
          await page.waitForTimeout(2000);
          await shot(page, "PY-020", k);
          const after = await getB(w, invRef);
          expect({ pay: after.pay, amountPaid: after.amountPaid, status: after.status }).toEqual({ pay: before.pay, amountPaid: before.amountPaid, status: before.status });
          return `'Resend invoice' clicked on ${invRef}: booking unchanged (${after.pay}, amountPaid ${after.amountPaid}, ${after.status}). Email arrival not inspected.`;
        });
        await check("PY-021", k, () => opPage(k), async () => {
          const page = await opBookingPage(w, invRef, /Mark paid/);
          await page.getByRole("button", { name: "Mark paid" }).click();
          await expect.poll(async () => (await getB(w, invRef)).pay, { timeout: 25_000 }).toBe("Paid");
          await page.waitForTimeout(1500);
          await shot(page, "PY-021", k);
          const a = await getB(w, invRef);
          expect(a.amountPaid).toBe(a.amount);
          const pays = await payments(w);
          expect(pays.some((p) => (p.refs ?? []).includes(invRef) && p.amount === 54)).toBeTruthy();
          return `'Mark paid' -> ${invRef} Paid, amountPaid ${a.amountPaid} = total ${a.amount}, payments record £54`;
        });
      }
    }
  });

  // ───────────────────────── PY-022 PY-023 ─────────────────────────
  test("PY-022 PY-023 reconciliation", async () => {
    for (const k of OPK) {
      const w = W[k]!;
      await check("PY-022", k, () => opPage(k), async () => {
        const b = (await book(w, { method: "card", pass: "1 day" })).first;
        await action(w, b.ref, "cancel", { refund: "none" });
        await post(w.op, `/api/bookings/${b.ref}/record-payment`, { amount: 20, method: "Bank transfer" });
        const a = await getB(w, b.ref);
        expect(a.receivedAfterCancel).toBe(20);
        const page = await opPage(k);
        await page.goto(`/${k}/reconciliation`);
        await expect(page.getByText(b.ref).first()).toBeVisible({ timeout: 45_000 });
        await page.getByText(b.ref).first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(800);
        const row = await page.getByText(b.ref).first().locator("xpath=ancestor::*[self::tr or @data-ui='card' or self::li][1]").innerText().catch(() => "");
        await shot(page, "PY-022", k);
        const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
        const at = body.indexOf(b.ref);
        const near = body.slice(Math.max(0, at - 250), at + 350);
        expect(near, "text around the ref should mention refund/credit").toMatch(/refund|credit/i);
        return `${b.ref}: cancelled (no refund) then £20 recorded -> receivedAfterCancel 20; Reconciliation page lists the ref with text: "${(row || near).replace(/\s+/g, " ").slice(0, 220)}"`;
      });
      await check("PY-023", k, () => opPage(k), async () => {
        const b = (await book(w, { method: "card" })).first;
        await post(w.op, `/api/bookings/${b.ref}/record-payment`, { amount: 20, method: "Cash" });
        await apiFetch(`/api/bookings/${b.ref}/recon-notes`, await tok(w.op), { method: "PUT", body: JSON.stringify({ note: `GP partial ${stamp}` }) });
        const a = await getB(w, b.ref);
        expect(a.pay).toBe("Partially paid"); expect(a.amountPaid).toBe(20);
        const page = await opBookingPage(w, b.ref);
        await shot(page, "PY-023", k);
        const tokn = payTokenFor(w, b.ref);
        const pg = await (await ctxFor(k, `/${k}/bookings`)).newPage();
        await pg.goto(`/pay/b/${tokn}`);
        await expect(pg.getByText("£34.00").first()).toBeVisible({ timeout: 30_000 });
        await shot(pg, "PY-023", k, ".paylink");
        await pg.close();
        const rpage = await opPage(k);
        await rpage.goto(`/${k}/reconciliation`);
        await rpage.waitForTimeout(5000);
        await shot(rpage, "PY-023", k, ".recon");
        const rb = (await rpage.locator("body").innerText()).replace(/\s+/g, " ");
        const at = rb.indexOf(b.ref);
        const reconSeen = at >= 0 ? `Reconciliation row: "${rb.slice(Math.max(0, at - 40), at + 200)}"` : "ref NOT listed on the Reconciliation page (it lists childcare/voucher/off-platform items, partial card+cash booking not shown)";
        return `${b.ref}: £20 of £54 recorded in Reconciliation -> 'Partially paid', recon note saved (GET back: ${(await getB(w, b.ref)).reconNote ?? "n/a"}); pay link asks the balance £34.00; ${reconSeen}`;
      });
    }
  });

  // ───────────────────────── PY-025 ─────────────────────────
  test("PY-025 payment methods in Setup", async () => {
    for (const k of OPK) {
      const w = W[k]!;
      await check("PY-025", k, async () => await parPage("p1"), async () => {
        const kidN = await newKid("p1", "pm");
        const page = await parPage("p1");
        const dayBtns = page.getByRole("button", { name: /^(Mon|Tue|Wed|Thu|Fri) \d+$/ });
        const toPay = async () => {
          await page.goto(`/book/${w.std.id}`);
          await page.getByRole("button", { name: /^1 day · £/ }).first().click();
          const timing = page.getByText(/choose a timing/i);
          if (await timing.isVisible().catch(() => false)) await page.getByRole("button", { name: /Full day/ }).first().click();
          await dayBtns.nth(0).click();
          await page.getByRole("button", { name: /Add .* to basket/ }).click();
          await page.getByRole("button", { name: /Next — add children/ }).click();
          await page.getByRole("button", { name: `Add ${kidN} to this booking` }).click();
          await page.getByRole("button", { name: "Next", exact: true }).click();
          const ph = page.getByPlaceholder("e.g. 07700 900123"); if (await ph.isVisible().catch(() => false)) await ph.fill("07700900123");
          const sel = page.locator("select").filter({ has: page.locator('option[value="card"]') }).first();
          await expect(sel).toBeVisible({ timeout: 30_000 });
          await sel.evaluate((el) => { const s = el as HTMLSelectElement; s.size = s.options.length; s.style.height = "auto"; });
          await page.waitForTimeout(600);
          return await sel.locator("option").allInnerTexts();
        };
        const lib0 = ((await get(w.op, "/api/library")) ?? {}) as any;
        const vp = lib0.settings.voucherProviders as unknown[];
        try {
          await setSettings(w, { payMethods: ["Card", "Cash on the day"] });
          const opts = await toPay();
          await shot(page, "PY-025", k);
          expect(opts.length, `options: ${opts.join(" | ")}`).toBe(2);
          expect(opts.join("|")).toMatch(/card/i); expect(opts.join("|")).toMatch(/cash/i);
          expect(opts.join("|")).not.toMatch(/bank|tax|voucher|haf/i);
          // voucher scheme with no reference is never shown
          await setSettings(w, { payMethods: ["Card", "Childcare vouchers"], voucherProviders: [...vp, { id: "noref", name: "NoRefScheme", details: [] }] });
          const opts2 = await toPay();
          const vSel = page.locator("select").filter({ has: page.locator('option[value="card"]') }).first();
          const vOpt = await vSel.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
          const voucherVal = vOpt.find((v) => /voucher/i.test(v) || /edenred/i.test(v));
          let schemes = "";
          if (voucherVal) { await vSel.selectOption(voucherVal); await page.waitForTimeout(800); schemes = (await page.locator("body").innerText()).replace(/\s+/g, " "); }
          await shot(page, "PY-025", k, ".vouchers");
          expect(opts2.join("|"), "voucher method offered").toMatch(/voucher|edenred/i);
          expect(opts2.join("|") + schemes, "scheme without a reference must not be offered").not.toMatch(/NoRefScheme/);
          expect(opts2.join("|") + schemes, "scheme with a reference is offered").toMatch(/Edenred/);
          return `${k} provider enabled only Card + Cash on the day -> parent checkout 'How you'll pay' lists exactly: ${opts.join(" | ")}; then vouchers on with schemes Edenred (has reference) + NoRefScheme (no reference) -> options ${opts2.join(" | ")}; NoRefScheme never shown, Edenred shown`;
        } finally { await setSettings(w, { payMethods: undefined, voucherProviders: vp }); }
      });
    }
  });

  // ───────────────────────── PY-033 PY-036 ─────────────────────────
  test("PY-033 bank reference, PY-036 HAF listing", async () => {
    for (const k of OPK) {
      const w = W[k]!;
      await check("PY-033", k, () => opPage(k), async () => {
        const b = (await book(w, { method: "bank" })).first;
        let mine: any;
        for (let i = 0; i < 14 && !mine; i++) {
          await new Promise((r) => setTimeout(r, 1500));
          const notes = await get(w.op, "/api/notifications");
          mine = (notes.notifications ?? notes ?? []).find?.((n: any) => n.ref === b.ref || JSON.stringify(n).includes(b.ref));
        }
        expect(mine, "operator notification for the new booking").toBeTruthy();
        const nText = `${mine.title} || ${mine.body}`;
        expect(nText, "notification should tell the provider which bank reference to look for. Observed: " + nText).toMatch(/bank|transfer|reference/i);
        const page = await opBookingPage(w, b.ref);
        const hint = page.getByText(/Look for that reference/i);
        await expect(hint).toBeVisible({ timeout: 30_000 });
        await hint.scrollIntoViewIfNeeded();
        await page.waitForTimeout(700);
        await shot(page, "PY-033", k, ".before");
        await page.evaluate(() => document.querySelectorAll("*").forEach((e) => { if ((e as HTMLElement).scrollTop) (e as HTMLElement).scrollTop = 0; }));
        await page.getByRole("button", { name: /Mark paid/ }).first().click();
        await expect.poll(async () => (await getB(w, b.ref)).pay, { timeout: 25_000 }).toBe("Paid");
        await page.waitForTimeout(1500);
        await shot(page, "PY-033", k);
        await action(w, b.ref, "paid").catch(() => {});
        const after = await getB(w, b.ref);
        expect(after.amountPaid).toBe(54);
        const sum = (await payments(w)).filter((p) => (p.refs ?? []).includes(b.ref)).reduce((s, p) => s + p.amount, 0);
        expect(sum, "one £54 in total").toBe(54);
        return `bell: "${String(mine.title)} / ${String(mine.body).slice(0, 110)}"; booking page shows 'Look for that reference'; 'Mark paid' -> Paid, amountPaid 54; replayed paid action did not double count (payments sum £${sum})`;
      });
      await check("PY-036", k, () => opPage(k), async () => {
        const title = `GP HAF Club ${k} ${stamp}`;
        const haf = await mkListing(w, title, { haf: true, hidden: true });
        const doc = await get(w.op, `/api/listings/${haf.id}`);
        expect(doc.visibility).toBe("hidden"); expect(doc.passes[0].price).toBe(0); expect(doc.bookingType).toBe("manual");
        const page = await opPage(k);
        await page.goto(`/${k}/listings`);
        await expect(page.getByText(title).first()).toBeVisible({ timeout: 60_000 });
        await shot(page, "PY-036", k);
        const pp = await parPage("p1");
        await pp.goto("/custdash/browse");
        await pp.waitForTimeout(6000);
        expect(await pp.locator("body").innerText()).not.toContain(title);
        await shot(pp, "PY-036", k, ".browse");
        await pp.goto(`/book/${haf.id}`);
        await expect(pp.getByText(/HAF place/).first()).toBeVisible({ timeout: 45_000 });
        await shot(pp, "PY-036", k, ".link");
        const pub = await fetch(`${API_URL}/api/public/library/${w.op.tenantId}`).then((r) => r.text());
        expect(pub, "hidden listing absent from the public library payload").not.toContain(title);
        return `"${title}" saved Hidden (link only), Manual approval, pass 'HAF place' £0; shows on the ${k}'s Listings page; absent from parent's Browse and public library payload; opens by direct link /book/{id}. Wizard UI + 'HAF reference' required question not driven (listing built by API).`;
      });
    }
  });

  // ───────────────────────── BQ-006 ─────────────────────────
  test("BQ-006 override total", async () => {
    for (const k of OPK) {
      const w = W[k]!;
      await check("BQ-006", k, () => opPage(k), async () => {
        const wk = w.std.weeks[2];
        const child = await newKid("p1", "ov");
        const r = await raw(w.op, "POST", "/api/my/bookings", { listingId: w.std.id, blockId: wk.blockId, method: "cash", walletCap: 0, items: [{ pass: "3 days", child, age: 8, dates: wk.dates.slice(0, 3) }], onBehalfOf: { email: A.p1.email, name: "GP Family" }, overrideTotal: 40, overrideReason: "agreed on the phone" });
        expect(r.ok, errText(r)).toBe(true);
        const ref = r.body.bookings[0].ref as string;
        const b = await getB(w, ref);
        expect(b.amount).toBe(40);
        expect(b.priceOverride?.originalAmount).toBe(54);
        expect(b.priceOverride?.amount).toBe(40);
        const wk2 = w.std.weeks[2];
        const pr = await raw(A.p1, "POST", "/api/my/bookings", { listingId: w.std.id, blockId: wk2.blockId, method: "cash", walletCap: 0, items: [{ pass: "3 days", child: await newKid("p1", "ovp"), age: 8, dates: wk2.dates.slice(2, 5) }], overrideTotal: 10 });
        expect(pr.status, JSON.stringify(pr.body)).toBe(403);
        const page = await opBookingPage(w, ref);
        await shot(page, "BQ-006", k);
        const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
        expect(body).toMatch(/£40(\.00)?/);
        return `${k} on-behalf booking with overrideTotal 40 on a £54 pass: amount=${b.amount}, priceOverride original ${b.priceOverride.originalAmount} -> ${b.priceOverride.amount} (reason "${b.priceOverride.reason}"); booking page shows £40; same field from a parent -> HTTP ${pr.status}. API assertion for the stored value; the 'Override the total' control/note in the Quick-book form itself was not driven.`;
      });
    }
  });

  // ───────────────────────── AW-002 AW-025 ─────────────────────────
  test("AW-002 decline, AW-025 waitlist owes nothing", async () => {
    for (const k of ["franchise", "company"] as Kind[]) {
      const w = W[k]!;
      await check("AW-002", k, () => opPage(k), async () => {
        const l = await mkListing(w, `GP Approve ${k} ${stamp}`, { cap: 1, approval: true, waitlist: "auto" });
        const reason = `Sorry full of HAF places ${stamp}`;
        const a = await book(w, { method: "cash", pass: "1 day", l, week: 0, who: "p1" });
        expect(a.first.status).toBe("Approval needed");
        const q = await book(w, { method: "cash", pass: "1 day", l, week: 0, who: "p2" });
        expect(q.first.status, "second family waitlisted while the place is held").toBe("Waitlisted");
        const pre = (await payments(w)).filter((p) => (p.refs ?? []).includes(a.first.ref)).length;
        const page = await opBookingPage(w, a.first.ref, /Decline/);
        await shot(page, "AW-002", k, ".before");
        await page.getByRole("button", { name: /^Decline/ }).first().click();
        await page.waitForTimeout(600);
        const box = page.getByPlaceholder(/Sorry, this week/);
        await box.fill(reason);
        await shot(page, "AW-002", k, ".dialog");
        await page.getByRole("button", { name: /^Decline booking$/ }).click();
        await expect.poll(async () => (await getB(w, a.first.ref)).status, { timeout: 25_000 }).toBe("Declined");
        await page.waitForTimeout(1500);
        await shot(page, "AW-002", k);
        const d = await getB(w, a.first.ref);
        expect(d.declineReason).toBe(reason);
        expect(d.amountPaid ?? 0).toBe(0);
        expect((await payments(w)).filter((p) => (p.refs ?? []).includes(a.first.ref)).length).toBe(pre);
        let qs = "";
        for (let i = 0; i < 10; i++) { qs = (await getB(w, q.first.ref)).status; if (qs === "Offered") break; await new Promise((r) => setTimeout(r, 1500)); }
        expect(qs, "waitlist triggered: the waiting family is offered the freed place").toBe("Offered");
        const pp = await parPage("p1");
        await pp.goto("/custdash/bookings");
        const card = cardWith(pp, `Ref ${a.first.ref}`);
        await card.waitFor({ state: "visible", timeout: 60_000 }).catch(() => {});
        await card.getByRole("button", { name: "Details" }).click().catch(() => {});
        await pp.waitForTimeout(1500);
        const seenPage = (await pp.locator("body").innerText()).includes(reason);
        await shot(pp, "AW-002", k, ".parent");
        const notes = JSON.stringify(await get(A.p1, "/api/notifications"));
        const seenBell = notes.includes(reason);
        const seen = `page ${seenPage}, parent bell ${seenBell}`;
        return `${a.first.ref} (Approval needed, cash) declined in the ${k} UI with reason: status Declined, declineReason stored, amountPaid 0, no payment record; freed place -> waiting family's booking ${q.first.ref} went Waitlisted -> ${qs}; the parent's My bookings page shows status Declined (${seen}: the reason is NOT shown in the portal or bell, it is relayed only in the decline email via emailBookingDeclined/bookingDeclinedSpec, server/src/lib/emailTemplates.ts:159; local mail is not sent so the email body was not read)`;
      });
      if (k === "franchise") {
        // AW-025 runs on freelancer + franchise
      }
    }
    for (const k of OPK) {
      const w = W[k]!;
      await check("AW-025", k, () => opPage(k), async () => {
        const l = await mkListing(w, `GP Wait ${k} ${stamp}`, { cap: 1, waitlist: "manual" });
        const f = await book(w, { method: "cash", pass: "3 days", l, week: 0, who: "p2" });
        const dash0 = await get(w.op, "/api/dashboard");
        const pay0 = (await payments(w)).reduce((s, p) => s + p.amount, 0);
        const q = await book(w, { method: "card", pass: "3 days", l, week: 0, who: "p1" });
        expect(q.first.status).toBe("Waitlisted");
        const full = await getB(w, q.first.ref);
        const dash1 = await get(w.op, "/api/dashboard");
        const pay1 = (await payments(w)).reduce((s, p) => s + p.amount, 0);
        const link = await apiFetch<Record<string, any>>(`/api/public/booking-pay/${payTokenFor(w, q.first.ref)}`, null);
        const control = await apiFetch<Record<string, any>>(`/api/public/booking-pay/${payTokenFor(w, f.first.ref)}`, null);
        const page = await opBookingPage(w, q.first.ref, /Cancel booking|Refund|Mark|Decline|Resend|Offer/);
        await shot(page, "AW-025", k);
        const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
        expect(link.closed, `waitlisted pay link ${JSON.stringify(link)} (control ${JSON.stringify(control)})`).toBe(true);
        expect(control.amount).toBe(54);
        expect(dash1.money.outstanding, "outstanding unchanged by a waitlisted booking").toBe(dash0.money.outstanding);
        expect(pay1).toBe(pay0);
        expect(/Mark paid/.test(text), "no Mark paid on a waitlisted booking").toBeFalsy();
        return `${q.first.ref} Waitlisted (amount ${full.amount}, pay '${full.pay}'); dashboard outstanding £${dash0.money.outstanding} -> £${dash1.money.outstanding} (unchanged), payments total £${pay0} -> £${pay1} (unchanged); public pay link closed:true while a confirmed unpaid control booking asks £${control.amount}; operator booking page has no Mark paid`;
      });
    }
  });
});
