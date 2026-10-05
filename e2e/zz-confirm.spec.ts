import { test, type Browser, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { ROOT, API_URL, WEB_URL } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, apiPost, fbSignIn, fbSignUp } from "./helpers/accounts";

// CN-019: cancelling ONE of two children frees ONE place. API-only, private API:
//   NEXT_PUBLIC_API_URL=http://localhost:4011 npx playwright test -c e2e/zz-cn019.config.ts
test.describe.configure({ mode: "serial" });
const stamp = Date.now().toString(36);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const MON1 = (() => { const d = new Date(); d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7)); return d; })();
type Acct = { email: string; uid: string; tenantId?: string; name?: string; token: () => Promise<string> };
const tok = (email: string) => async () => (await fbSignIn(email)).idToken;
async function call(a: Acct | null, method: string, p: string, body?: unknown) {
  const r = await fetch(`${API_URL}${p}`, { method, headers: { "Content-Type": "application/json", ...(a ? { Authorization: `Bearer ${await a.token()}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: r.status, json, text };
}
async function ok<T = any>(a: Acct | null, method: string, p: string, body?: unknown): Promise<T> {
  const r = await call(a, method, p, body);
  if (r.status >= 300) throw new Error(`${method} ${p} -> ${r.status} ${r.text.slice(0, 300)}`);
  return r.json as T;
}
async function mkParent(tag: string): Promise<Acct> {
  const email = `e2e-cf-${tag}-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  await apiPost("/api/register-role", s.idToken, { role: "parent", postcode: "NN5 7EA" });
  await apiPost("/api/me/welcome", s.idToken, {});
  return { email, uid: s.uid, token: tok(email) };
}
async function mkOp(): Promise<Acct> {
  const email = `e2e-cf-op-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  const name = `CF op ${stamp}`;
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role: "company", businessName: name, providerName: name, providerNameMode: "business" });
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", r.tenantId], { stdio: "pipe" });
  return { email, uid: s.uid, tenantId: r.tenantId, name, token: tok(email) };
}
const VENUE = "cf-venue";
async function mkListing(a: Acct, title: string, max: number) {
  const lib = ((await ok(a, "GET", "/api/library")) ?? {}) as any;
  await ok(a, "PUT", "/api/library", { venues: [...(lib.venues ?? []), { id: VENUE, name: "Hall", address: "1 Test Way", city: "Northampton" }], settings: { ...(lib.settings ?? {}), marketplaceListed: true, providerName: a.name } });
  const period = await ok(a, "POST", "/api/periods", { title: "Full day", start: "09:00", finish: "15:30" });
  const pass = await ok(a, "POST", "/api/passes", { name: "3 days", days: 3 });
  const bundle = await ok(a, "POST", "/api/block-bundles", { name: `B ${title}`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 54, calcOn: true, passFlat: { [pass.id]: 54 }, passMode: { [pass.id]: "flat" } });
  const l = await ok(a, "POST", "/api/listings", {
    title, venueId: VENUE, runFrom: iso(MON1), runTo: iso(addDays(MON1, 4)), blockMode: "weekly", days: [1, 2, 3, 4, 5],
    maxAttendees: String(max), capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id,
    passes: [{ name: "3 days", price: 54, days: 3 }], bookingType: "auto", waitlist: true, waitlistMode: "auto", status: "live", visibility: "public",
  });
  await ok(a, "PUT", `/api/block-bundles/${bundle.id}/listings`, { listingIds: [l.id] });
  return l.id as string;
}
const blockOf = async (op: Acct, id: string) => { const f = await ok(op, "GET", `/api/listings/${id}`); const b = f.blocks[0]; return { id: b.id as string, booked: b.bookedCount as number, days: (b.sessions as any[]).map((s) => s.bookedCount ?? 0) as number[], dates: (b.sessions as any[]).map((s) => s.date as string) }; };
const publicSpots = async (p: Acct, id: string): Promise<string> => { const all = await ok<any>(p, "GET", "/api/listings"); const rows: any[] = Array.isArray(all) ? all : all.listings ?? []; const l = rows.find((x) => x.id === id); const b = l?.blocks?.[0]; return JSON.stringify({ spotsLeft: b?.spotsLeft, sessions: (b?.sessions ?? []).slice(0, 3).map((s: any) => s.spotsLeft) }); };
const book = (p: Acct, listingId: string, blockId: string, dates: string[], kids: string[]) => call(p, "POST", "/api/my/bookings", { listingId, blockId, method: "card", walletCap: 0, items: kids.map((c) => ({ pass: "3 days", child: c, age: 8, dates })) });

const SHOTS = path.join(ROOT, "e2e/review/shots/confirm");
const shot = (page: Page, id: string) => page.screenshot({ path: path.join(SHOTS, `${id}.png`), fullPage: true });
const fail = (m: string) => { throw new Error(m); };
const eq = (a: unknown, b: unknown, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) fail(`${m}: expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };
async function login(browser: Browser, a: { email: string }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${WEB_URL}/login`);
  await page.getByPlaceholder("you@example.com").fill(a.email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/company/, { timeout: 45_000 });
  return page;
}
const text = async (page: Page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");

test("provider money actions need a confirm; refunds are pending then sent", async ({ browser }) => {
  test.setTimeout(900_000);
  const parent = await mkParent("a");
  const op = await mkOp();
  const lid = await mkListing(op, `CF ${stamp}`, 6);
  const blk = await blockOf(op, lid);
  const d3 = blk.dates.slice(0, 3);
  const child = `Mia${stamp}`;
  const r = await call(parent, "POST", "/api/my/bookings", { listingId: lid, blockId: blk.id, method: "card", walletCap: 0, items: [{ pass: "3 days", child, age: 8, dates: d3 }] });
  eq(r.status, 201, "book " + r.text.slice(0, 200));
  const ref: string = r.json.bookings[0].ref;
  console.log("TENANT", op.tenantId, "LISTING", lid, "REF", ref);
  const get = () => ok<any>(op, "GET", `/api/bookings/${ref}`);
  const pg = await login(browser, op);
  const open = async () => { await pg.goto(`${WEB_URL}/company/bookings?ref=${encodeURIComponent(ref)}`); await pg.getByText(child, { exact: true }).first().waitFor({ timeout: 30_000 }); await pg.waitForTimeout(1500); };

  // 1. Mark paid -> confirm first
  await open();
  await pg.getByRole("button", { name: /^Mark paid$/ }).click();
  await pg.locator('[data-ui="money-confirm"][data-kind="paid"]').waitFor();
  eq((await get()).pay === "Paid", false, "nothing happened on the first click");
  await shot(pg, "1-mark-paid-confirm");
  await pg.getByRole("button", { name: "Not yet" }).click();
  eq(await pg.locator('[data-ui="money-confirm"]').count(), 0, "panel closed on Not yet");
  eq((await get()).pay === "Paid", false, "still unpaid after Not yet");
  await pg.getByRole("button", { name: /^Mark paid$/ }).click();
  await pg.getByRole("button", { name: "Yes, mark as received" }).click();
  await pg.getByText("Paid", { exact: true }).first().waitFor({ timeout: 20_000 });
  let b = await get(); eq([b.pay, b.amountPaid], ["Paid", 54], "paid");
  await shot(pg, "2-paid");

  // Money in BEFORE
  await pg.goto(`${WEB_URL}/company/purchasing`); await pg.waitForTimeout(3500);
  const miBefore = await text(pg); await shot(pg, "3-money-in-before");

  // 2. Cancel one day -> confirm, pick "We cancelled it" (full), refund pending
  await open();
  await pg.getByText("Cancel this day").first().click();
  const panel = pg.locator('[data-ui="money-confirm"][data-kind="cancel-day"]');
  await panel.waitFor();
  eq((await get()).cancel ?? null, null, "nothing happened on the first click");
  await panel.getByText("We cancelled it").click();
  await panel.locator('[data-choice="refund"]').click();
  await pg.waitForTimeout(400);
  await shot(pg, "4-cancel-day-confirm");
  const panelText = await panel.innerText();
  console.log("PANEL", panelText.replace(/\s+/g, " "));
  if (!/Refund £18\.00 to the family/.test(panelText)) fail("panel should offer a £18.00 refund: " + panelText);
  await panel.getByRole("button", { name: "Yes, cancel it" }).click();
  await pg.waitForTimeout(2500);
  b = await get();
  eq([b.cancel?.refund, b.cancel?.amount, (b.refundLog ?? []).length, b.pay], ["pending", 18, 0, "Paid"], "pending refund, nothing logged as refunded");
  await shot(pg, "5-after-cancel-day");
  const afterCancel = await text(pg);
  if (!/Refund requested: £18\.00/.test(afterCancel)) fail("detail should say refund requested £18.00");

  // Refunds tab + Money in show OWED
  await pg.goto(`${WEB_URL}/company/bookings`); await pg.waitForTimeout(2500);
  const tabs = await pg.getByRole("button", { name: /Refunds/ }).first().innerText().catch(() => "?");
  console.log("REFUNDS TAB", tabs.replace(/\s+/g, " "));
  if (/^Refunds\s*0$/.test(tabs.replace(/\s+/g, " ").trim())) fail("Refunds tab still 0");
  await pg.getByRole("button", { name: /Refunds/ }).first().click(); await pg.waitForTimeout(1200);
  await shot(pg, "6-refunds-tab-pending");
  await pg.goto(`${WEB_URL}/company/purchasing`); await pg.waitForTimeout(3500);
  const miOwed = await text(pg); await shot(pg, "7-money-in-owed");
  if (!/Refunds owed to families, not yet sent: £18\.00/.test(miOwed)) fail("Money in must show £18.00 owed");
  if (/£18\.00 refunded/.test(miOwed)) fail("Money in must NOT show it as refunded yet");
  console.log("MONEY IN before has owed:", /not yet sent/.test(miBefore));

  // 3. Mark refund sent -> confirm first
  await open();
  await pg.getByRole("button", { name: /Mark refund reimbursed|Approve refund|Accept|Mark/ }).filter({ hasText: /refund|reimbursed|bank/i }).first().click();
  const rp = pg.locator('[data-ui="money-confirm"][data-kind="refund-sent"]');
  await rp.waitFor();
  eq((await get()).cancel.refund, "pending", "still pending after the first click");
  await shot(pg, "8-refund-sent-confirm");
  console.log("REFPANEL", (await rp.innerText()).replace(/\s+/g, " "));
  await rp.getByRole("button", { name: /^Yes/ }).click();
  await pg.waitForTimeout(3000);
  b = await get();
  eq([b.cancel.refund, b.refundedApproved, b.pay], ["approved", 18, "Partially refunded"], "refunded once marked sent");
  eq((b.refundLog ?? []).reduce((n: number, x: any) => n + x.amount, 0), 18, "counted once");
  await pg.goto(`${WEB_URL}/company/purchasing`); await pg.waitForTimeout(3500);
  const miSent = await text(pg); await shot(pg, "9-money-in-refunded");
  if (/not yet sent/.test(miSent)) fail("owed banner should be gone");

  // 4. Cancel the child's remaining place: confirm, wallet option
  await open();
  await pg.getByText(/^Cancel all \d+ days$/).first().click();
  const cp = pg.locator('[data-ui="money-confirm"][data-kind="cancel-child"]');
  await cp.waitFor();
  eq((await get()).kids[0].cancelled ?? false, false, "child still booked after first click");
  await cp.locator('[data-choice="wallet"]').click(); await pg.waitForTimeout(300);
  await shot(pg, "10-cancel-child-confirm-wallet");
  await cp.getByRole("button", { name: "Yes, cancel it" }).click();
  await pg.waitForTimeout(3000);
  b = await get();
  const walletEntry = (b.refundLog ?? []).find((x: any) => x.source === "Wallet");
  eq(!!walletEntry, true, "wallet credit logged immediately");
  eq(walletEntry.amount, 36, "wallet credit defaults to the child's remaining value");
  console.log("FINAL", JSON.stringify({ status: b.status, pay: b.pay, refundLog: b.refundLog, cancel: b.cancel, refundedApproved: b.refundedApproved }));
  await shot(pg, "11-after-cancel-child");
  console.log("DONE");
});
