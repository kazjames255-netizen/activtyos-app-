import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test, chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { API_URL, ROOT, WEB_URL } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, fbSignIn, fbSignUp } from "./helpers/accounts";
import { reconcileBooking } from "../server/src/lib/reconcileMath";
import { layout, bookingConfirmedSpec } from "../server/src/lib/emailTemplates";

// Last-5 re-verification (CN-033, CF-005, DI-043, FD-008, FD-026) against the LOCAL stack, fresh throwaway accounts.
test.describe.configure({ mode: "serial" });
const stamp = Date.now().toString(36);
const SHOTS = path.join(ROOT, "e2e/review/shots/last5");
fs.mkdirSync(SHOTS, { recursive: true });
const OUT = path.join(SHOTS, "_results.json");
const RES: Record<string, { status: string; note: string }> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const rec = (id: string, status: "pass" | "fail", note: string) => { RES[id] = { status, note }; fs.writeFileSync(OUT, JSON.stringify(RES, null, 1)); console.log(`RESULT ${id} ${status} :: ${note}`); };

interface Acct { email: string; uid: string; tenantId: string | null; tok: string; tokAt: number }
const A: Record<string, Acct> = {};
const email = (n: string) => `e2e-l5-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`;
const token = async (k: string) => { const a = A[k]; if (Date.now() - a.tokAt > 35 * 60_000) { a.tok = (await fbSignIn(a.email)).idToken; a.tokAt = Date.now(); } return a.tok; };
async function call(k: string | null, method: string, url: string, body?: unknown, tok?: string): Promise<{ status: number; json: any }> {
  const t = tok ?? (k ? await token(k) : null);
  const res = await fetch(`${API_URL}${url}`, { method, headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let json: any = null; try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json };
}
const ok = async (k: string, method: string, url: string, body?: unknown) => { const r = await call(k, method, url, body); if (r.status >= 300) throw new Error(`${method} ${url} -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`); return r.json; };
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = new Date();
const nextMonday = addDays(today, (8 - today.getDay()) % 7 || 7);
const sd = (w: number, d: number) => iso(addDays(nextMonday, w * 7 + d));
const r2 = (n: number) => Math.round(n * 100) / 100;
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

let browser: Browser;
const ctxs: Record<string, BrowserContext> = {};
async function getCtx(key: string, home: RegExp): Promise<BrowserContext> {
  if (ctxs[key]) return ctxs[key];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(`${WEB_URL}/login`, { waitUntil: "load", timeout: 120_000 });
  await page.waitForTimeout(4000);
  await page.getByPlaceholder("you@example.com").fill(A[key].email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(home, { timeout: 120_000 });
  await page.close();
  return (ctxs[key] = ctx);
}
async function settle(page: Page, extra?: (t: string) => boolean) {
  await page.waitForLoadState("load").catch(() => {});
  for (let i = 0; i < 40; i++) {
    const t = (await page.locator("body").innerText().catch(() => "")).trim();
    if (t.length > 120 && !/(^|\n)\s*(Loading|Checking access)/i.test(t.replace(/Loading figures/g, "x")) && (!extra || extra(t))) break;
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(1200);
}
const shotFile = (id: string) => path.join(SHOTS, `${id}.png`);

let venueDone = false;
async function mkListing(k: string, title: string) {
  if (!venueDone || k !== "co") { /* per-account */ }
  const lib = (await call(k, "GET", "/api/library")).json ?? {};
  const venues = (lib.venues ?? []) as { id: string }[];
  await ok(k, "PUT", "/api/library", { venues: venues.some((v) => v.id === "l5-venue") ? venues : [...venues, { id: "l5-venue", name: "L5 Hall", address: "1 Test Way", city: "Northampton" }], settings: { ...(lib.settings ?? {}), marketplaceListed: true } });
  const period = (await ok(k, "POST", "/api/periods", { title: "Full day", start: "09:00", finish: "15:00" })).id;
  const p1 = (await ok(k, "POST", "/api/passes", { name: "1 day", days: 1 })).id;
  const p3 = (await ok(k, "POST", "/api/passes", { name: "3 days", days: 3 })).id;
  const p5 = (await ok(k, "POST", "/api/passes", { name: "5 days", days: 5 })).id;
  const bundle = await ok(k, "POST", "/api/block-bundles", { name: `Bundle ${title}`, periodIds: [period], passIds: [p1, p3, p5], priced: true, masterPrice: 90, calcOn: false, passFlat: { [p1]: 20, [p3]: 54 } });
  const listing = await ok(k, "POST", "/api/listings", {
    title, venueId: "l5-venue", runFrom: iso(nextMonday), runTo: iso(addDays(nextMonday, 20)), blockMode: "weekly", days: [1, 2, 3, 4, 5],
    maxAttendees: "10", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "11", blockId: bundle.id,
    passes: [{ name: "1 day", price: 20, days: 1 }, { name: "3 days", price: 54, days: 3 }, { name: "5 days", price: 90, days: 5 }],
    bookingType: "auto", waitlist: true, waitlistMode: "manual", status: "live", visibility: "public",
  });
  await ok(k, "PUT", `/api/block-bundles/${bundle.id}/listings`, { listingIds: [listing.id] });
  const full = await ok(k, "GET", `/api/listings/${listing.id}`);
  const blocks = ((full.blocks ?? []) as { id: string; startDate: string }[]).sort((a, c) => (a.startDate < c.startDate ? -1 : 1));
  return { id: listing.id as string, title, blockId: blocks[0].id as string };
}
type L = Awaited<ReturnType<typeof mkListing>>;
const PASS_DAYS: Record<string, number> = { "1 day": 1, "3 days": 3, "5 days": 5 };
let childN = 0;
const kid = (tag = "K") => `${tag}${stamp}x${++childN}`;
async function book(parent: string, l: L, pass: "1 day" | "3 days" | "5 days", week: number, extra: Record<string, unknown> = {}) {
  const items = [{ pass, child: kid(), age: 8, dates: Array.from({ length: PASS_DAYS[pass] }, (_, i) => sd(week, i)) }];
  const r = await call(parent, "POST", "/api/my/bookings", { listingId: l.id, blockId: l.blockId, method: "card", walletCap: 0, items, ...extra });
  if (r.status >= 300) throw new Error(`book -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  return r.json.bookings[0];
}
const dash = async (k: string) => (await ok(k, "GET", "/api/dashboard")) as { money: { takenThisWeek: number } };
const getB = async (k: string, ref: string) => ((await ok(k, "GET", "/api/bookings")) as any[]).find((b) => b.ref === ref);
const payments = async (k: string) => (await ok(k, "GET", "/api/payments")) as any[];

test.beforeAll(async () => {
  test.setTimeout(600_000);
  browser = await chromium.launch();
  await signupOperator("co", "company", `L5 Co ${stamp}`);
  await signupOperator("fl", "freelancer", `L5 Free ${stamp}`);
  unwall(A.co.tenantId!, A.fl.tenantId!);
  await signupParent("p1"); await signupParent("p2");
  const inv = await ok("co", "POST", "/api/invites", { role: "staff", name: `L5 Staff ${stamp}`, staffRole: "Manager", assignment: { mode: "all", ids: [] } });
  const s = await fbSignUp(email("st"));
  const acc = await call(null, "POST", `/api/invites/${inv.token}/accept`, {}, s.idToken);
  if (acc.status >= 300) throw new Error("accept staff " + JSON.stringify(acc.json));
  A.st = { email: email("st"), uid: s.uid, tenantId: A.co.tenantId, tok: s.idToken, tokAt: Date.now() };
  console.log("ACCOUNTS", JSON.stringify(Object.fromEntries(Object.entries(A).map(([k, v]) => [k, v.email]))));
});
test.afterAll(async () => { for (const c of Object.values(ctxs)) await c.close().catch(() => {}); await browser?.close().catch(() => {}); });

const ONLY = (process.env.L5_ONLY ?? "").split(",").filter(Boolean);
const T = (name: string, fn: () => Promise<void>) => ONLY.length && !ONLY.includes(name) ? undefined : test(name, async () => { test.setTimeout(900_000); try { await fn(); } catch (e) { console.log(`TEST ABORT ${name}: ${(e as Error).message.slice(0, 600)}`); } });
async function check(id: string, fn: () => Promise<string>) { try { rec(id, "pass", await fn()); } catch (e) { rec(id, "fail", String((e as Error).message).split("\n").slice(0, 4).join(" | ").slice(0, 900)); } }
const eq = (a: unknown, b: unknown, l: string) => { const same = typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 0.006 : a === b; if (!same) throw new Error(`${l}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const truthy = (v: unknown, l: string) => { if (!v) throw new Error(l); };

T("CN-033", async () => {
  await check("CN-033", async () => {
    const ctx = await getCtx("co", /company/);
    const page = await ctx.newPage();
    await page.goto(`${WEB_URL}/company/setup?tab=cancel`, { waitUntil: "load", timeout: 90_000 });
    const lbl = page.getByText(/When a refund is due/i).first();
    await lbl.waitFor({ timeout: 60_000 });
    const sel = page.locator("select").filter({ has: page.locator("option", { hasText: /Flag it for me/ }) }).first();
    await sel.selectOption("auto");
    await page.waitForTimeout(1200);
    await lbl.scrollIntoViewIfNeeded();
    await settle(page);
    await page.screenshot({ path: shotFile("CN-033"), fullPage: true });
    const t1 = await page.locator("body").innerText();
    const bad1 = t1.match(/\(Amir\)|needs building|Until this is built/i);
    // Reconciliation > Tax-Free Childcare
    await page.goto(`${WEB_URL}/company/reconciliation`, { waitUntil: "load", timeout: 90_000 });
    await settle(page);
    const tab = page.getByRole("button", { name: /Tax-Free Childcare/ }).first();
    await tab.waitFor({ timeout: 30_000 });
    await tab.click();
    await page.waitForTimeout(1500);
    await settle(page, (t) => /Tax-Free Childcare/.test(t));
    await page.screenshot({ path: shotFile("CN-033.recon"), fullPage: true });
    const t2 = await page.locator("body").innerText();
    const bad2 = t2.match(/\(Amir\)|needs building|Until this is built/i);
    const sample1 = (t1.match(/[^\n]*(Automatic|automatic)[^\n]*/g) ?? []).slice(0, 2).join(" // ");
    fs.writeFileSync(path.join(SHOTS, "CN-033.txt"), `SETUP:\n${t1}\n\nRECON TFC:\n${t2}`);
    await page.close();
    truthy(!bad1, `Setup shows developer text: "${bad1?.[0]}"`);
    truthy(!bad2, `Reconciliation TFC shows developer text: "${bad2?.[0]}"`);
    return `neither Setup > Cancellations (auto selected) nor Reconciliation > TFC contains (Amir)/needs building/Until this is built. Setup note text: ${sample1.slice(0, 300)}`;
  });
});

T("CF-005", async () => {
  await check("CF-005", async () => {
    const l = await mkListing("co", `L5 CF ${stamp}`);
    const lib = (await call("co", "GET", "/api/library")).json ?? {};
    await ok("co", "PUT", "/api/library", { ...{ venues: lib.venues }, childQuestions: [
      { id: "q-nick", label: "Nickname", type: "text", scope: "all", required: true },
      { id: "q-toilet", label: "Is your child toilet trained?", type: "yesno", kind: "toilet", scope: "all", required: true, showOnRegister: true, reviewIfNo: true },
    ] });
    const cq = ((await call("co", "GET", "/api/library")).json?.childQuestions ?? []) as any[];
    truthy(cq.length === 2, "2 required questions saved: " + JSON.stringify(cq).slice(0, 200));
    const ctx = await getCtx("p1", /custdash|dashboard|parent|book/);
    const page = await ctx.newPage();
    await page.goto(`${WEB_URL}/book/${l.id}`, { waitUntil: "load", timeout: 90_000 });
    await page.waitForTimeout(3000);
    await page.getByRole("button", { name: /^1 day · £/ }).first().click({ timeout: 45_000 });
    const timing = page.getByRole("button", { name: /Full day/ });
    if (await timing.first().isVisible().catch(() => false)) await timing.first().click();
    const dn = new Date(sd(0, 0) + "T12:00:00").getDate();
    await page.getByRole("button", { name: new RegExp(`^(Mon|Tue|Wed|Thu|Fri) ${dn}$`) }).first().click();
    await page.getByRole("button", { name: /Add .* to basket/ }).click();
    await page.getByRole("button", { name: /Next — add children/ }).click();
    await page.getByRole("button", { name: /^(＋ )?Add a (new )?child$/ }).click();
    const nm = kid("Cf");
    await page.getByPlaceholder("First and last name").first().fill(nm);
    await page.locator('input[type="date"]').first().fill("2017-03-01");
    await page.getByRole("button", { name: "Boy", exact: true }).click().catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: shotFile("CF-005.form"), fullPage: true });
    await page.getByRole("button", { name: "Add child", exact: true }).click();
    await page.waitForTimeout(800);
    const msgEl = page.getByText(/we still need/).first();
    await msgEl.waitFor({ timeout: 15_000 }).catch(async (e) => { await page.screenshot({ path: shotFile("CF-005.fail"), fullPage: true }); fs.writeFileSync(path.join(SHOTS, "CF-005.fail.txt"), await page.locator("body").innerText()); throw e; });
    const msg = (await msgEl.innerText()).trim();
    await msgEl.scrollIntoViewIfNeeded();
    await settle(page);
    await page.screenshot({ path: shotFile("CF-005"), fullPage: true });
    await page.close();
    truthy(!/\?\./.test(msg), `typo '?.' on screen: "${msg}"`);
    truthy(/we still need nickname and is your child toilet trained\?$/i.test(msg), `unexpected wording: "${msg}"`);
    return `message on screen: "${msg}"`;
  });
});

T("DI-043", async () => {
  await check("DI-043", async () => {
    const l = await mkListing("co", `L5 DI ${stamp}`);
    const CODE = `L5D${stamp}`.toUpperCase().replace(/[^A-Z0-9]/g, "");
    await ok("co", "POST", "/api/discounts", { active: true, code: CODE, type: "percent", value: 10 });
    const b = await book("p1", l, "5 days", 1, { discountCodes: [CODE] });
    const full = await getB("co", b.ref);
    eq(full.amount, 81, "booking amount"); eq(full.discountOff, 9, "discountOff"); eq(full.listPrice, 90, "listPrice");
    const spec = bookingConfirmedSpec(full, "L5 Co");
    const html = layout({ name: "L5 Co", hasLogo: false }, spec.title, spec.body, full, {}, "http://localhost:3000");
    fs.writeFileSync(path.join(SHOTS, "DI-043.email.html"), html);
    const text = html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim();
    fs.writeFileSync(path.join(SHOTS, "DI-043.email.txt"), text);
    const ctx = await getCtx("co", /company/);
    const ep = await ctx.newPage();
    await ep.setContent(html, { waitUntil: "load" });
    await ep.waitForTimeout(800);
    await ep.screenshot({ path: shotFile("DI-043"), fullPage: true });
    await ep.close();
    truthy(/Price before discount\s*£90\.00/.test(text), "no 'Price before discount £90.00' row: " + text.slice(0, 500));
    truthy(/Discount[^£]*−\s*£9\.00/.test(text), "no 'Discount − £9.00' row");
    truthy(/Total\s*£81\.00/.test(text), "no Total £81.00");
    return `booking ${b.ref}: list £90, code ${CODE} 10% => £81; email text: ${text.slice(0, 700)}`;
  });
});

T("FD-008", async () => {
  await check("FD-008", async () => {
    const dB = await dash("co");
    const l = await mkListing("co", `L5 FD ${stamp}`);
    const b = await book("p2", l, "3 days", 2);
    await ok("co", "POST", `/api/bookings/${b.ref}/record-payment`, { amount: 54, method: "Bank transfer", reference: `L5${stamp}` });
    const d1 = await dash("co");
    eq(r2(d1.money.takenThisWeek - dB.money.takenThisWeek), 54, "taken this week +54 after payment");
    await ok("p2", "POST", `/api/my/bookings/${b.ref}/cancel`, { msg: "L5 wallet refund", refundPref: "wallet" });
    await ok("co", "POST", `/api/bookings/${b.ref}/actions`, { type: "refund-approve" });
    const row = await getB("co", b.ref);
    eq(row.cancel?.refundVia, "wallet", "refundVia");
    const d2 = await dash("co");
    const rc = reconcileBooking(row, await payments("co"));
    const ctx = await getCtx("co", /company/);
    const pg = await ctx.newPage();
    await pg.setViewportSize({ width: 1440, height: 1600 });
    await pg.goto(`${WEB_URL}/company/dashboard`, { waitUntil: "load", timeout: 90_000 });
    await settle(pg, (t) => /taken this week/i.test(t) && /income collected/i.test(t));
    await pg.screenshot({ path: shotFile("FD-008"), fullPage: true });
    const dtxt = (await pg.locator("body").innerText()).replace(/\s+/g, " ");
    await pg.goto(`${WEB_URL}/company/purchasing`, { waitUntil: "load", timeout: 90_000 });
    await settle(pg, (t) => /after refunds/i.test(t));
    await pg.screenshot({ path: shotFile("FD-008.moneyin"), fullPage: true });
    const mtxt = (await pg.locator("body").innerText()).replace(/\s+/g, " ");
    await pg.close();
    const num = (t: string, re: RegExp) => { const m = re.exec(t); if (!m) return null; const n = /£\s*(-?[\d,]+(?:\.\d+)?)/.exec(t.slice(m.index + m[0].length, m.index + m[0].length + 80)); return n ? Number(n[1].replace(/,/g, "")) : null; };
    const takenUi = num(dtxt, /taken this week/i), incomeUi = num(dtxt, /income collected/i);
    const mi = /£\s*([\d,]+\.\d\d)\s*IN THIS MONTH, AFTER REFUNDS\s*Received\s*£\s*([\d,]+\.\d\d)\s*·\s*Refunded\s*£\s*([\d,]+\.\d\d)/i.exec(mtxt);
    const detail = `api taken ${dB.money.takenThisWeek}->${d1.money.takenThisWeek}->${d2.money.takenThisWeek}; UI taken ${takenUi}, UI income ${incomeUi}, Money in ${mi ? `net ${mi[1]} received ${mi[2]} refunded ${mi[3]}` : "NOT FOUND"}; reconcile ${JSON.stringify({ ok: rc.ok, net: (rc as any).net, helper: (rc as any).helper, inn: (rc as any).inn })}`;
    fs.writeFileSync(path.join(SHOTS, "FD-008.facts.txt"), detail + "\n\nBOOKING " + JSON.stringify(row.cancel) + "\npay " + row.pay);
    eq(d2.money.takenThisWeek, dB.money.takenThisWeek, "API taken-this-week must fall back by the £54 wallet refund");
    eq(takenUi, dB.money.takenThisWeek, "dashboard screen 'Taken this week'");
    truthy(mi, "Money in headline not found");
    eq(Number(mi![1].replace(/,/g, "")), incomeUi ?? -1, "Money in net agrees with dashboard income collected");
    truthy(rc.ok, "reconcileBooking mismatch for the wallet-refunded booking " + JSON.stringify({ net: (rc as any).net, helper: (rc as any).helper }));
    return detail;
  });
});

T("FD-026", async () => {
  await check("FD-026", async () => {
    const st = await call("st", "GET", "/api/wallet/summary");
    const co = await call("co", "GET", "/api/wallet/summary");
    const fl = await call("fl", "GET", "/api/wallet/summary");
    const me = await call("st", "GET", "/api/me");
    const ctx = await getCtx("st", /staff/);
    const pg = await ctx.newPage();
    await pg.goto(`${WEB_URL}/staff/dash`, { waitUntil: "load", timeout: 90_000 });
    await settle(pg, (t) => /Dashboard/i.test(t));
    await pg.screenshot({ path: shotFile("FD-026"), fullPage: true });
    await pg.close();
    const d = `staff(role=${me.json?.role}) ${st.status} ${JSON.stringify(st.json)}; owner(company) ${co.status} ${JSON.stringify(co.json)}; owner(freelancer) ${fl.status} ${JSON.stringify(fl.json)}`;
    eq(st.status, 403, "staff wallet summary status"); eq(co.status, 200, "company owner status"); eq(fl.status, 200, "freelancer owner status");
    return d;
  });
});
