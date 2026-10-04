import { test, expect, type Page, type Browser } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { ROOT, API_URL } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, apiPost, fbSignIn, fbSignUp } from "./helpers/accounts";

// Parent Home (custdash/home): empty state for a brand-new parent, and a populated state (unpaid + upcoming booking + child).
// Run: npx playwright test -c e2e/zz-parent-home.config.ts
test.describe.configure({ mode: "serial" });
const stamp = Date.now().toString(36);
const SHOTS = path.join(ROOT, "e2e/review/shots/home");
fs.mkdirSync(SHOTS, { recursive: true });
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const MON1 = (() => { const d = new Date(); d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7)); return d; })();

async function call(token: string, method: string, p: string, body?: unknown) {
  const r = await fetch(`${API_URL}${p}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  if (r.status >= 300) throw new Error(`${method} ${p} -> ${r.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

let tenantId = "", listingId = "", blockId = "";
const emails = { empty: `e2e-home-empty-${stamp}@${TEST_EMAIL_DOMAIN}`, full: `e2e-home-full-${stamp}@${TEST_EMAIL_DOMAIN}` };

async function mkParent(email: string, name: string) {
  const s = await fbSignUp(email);
  await apiPost("/api/register-role", s.idToken, { role: "parent", postcode: "NN5 7EA", providerId: tenantId });
  await apiPost("/api/me/welcome", s.idToken, {});
  await call(s.idToken, "PUT", "/api/account", { name }).catch(() => {});
  return s;
}

async function signIn(page: Page, email: string, next?: string) {
  await page.goto(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.waitForLoadState("load");
  await page.waitForTimeout(1500); // let React hydrate, or it wipes the typed values
  await page.locator("#login-email").fill(email);
  await page.locator('input[type="password"]').first().fill(TEST_PASSWORD);
  await expect(page.locator("#login-email")).toHaveValue(email);
  await page.locator('form button[type="submit"]').first().click();
}

test("setup: operator with a live listing", async () => {
  const email = `e2e-home-op-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  const name = `Home Club ${stamp}`;
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role: "company", businessName: name, providerName: name, providerNameMode: "business" });
  tenantId = r.tenantId;
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", tenantId], { stdio: "pipe" });
  const t = s.idToken;
  const lib = ((await call(t, "GET", "/api/library")) ?? {}) as any;
  await call(t, "PUT", "/api/library", { venues: [{ id: "hv", name: "Home Hall", address: "1 Test Way", city: "Northampton" }], settings: { ...(lib.settings ?? {}), marketplaceListed: true, providerName: name } });
  const period = await call(t, "POST", "/api/periods", { title: "Full day", start: "09:00", finish: "15:30" });
  const pass = await call(t, "POST", "/api/passes", { name: "1 day", days: 1 });
  const bundle = await call(t, "POST", "/api/block-bundles", { name: `Home ${stamp}`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 20, calcOn: true, passFlat: { [pass.id]: 20 }, passMode: { [pass.id]: "flat" } });
  const l = await call(t, "POST", "/api/listings", {
    title: `Football Camp ${stamp}`, venueId: "hv", runFrom: iso(MON1), runTo: iso(addDays(MON1, 18)), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "10", capacityScope: "day", showSpaces: true,
    ageFrom: "5", ageTo: "12", blockId: bundle.id, passes: [{ name: "1 day", price: 20, days: 1 }], bookingType: "auto", waitlist: true, waitlistMode: "manual", status: "live", visibility: "public",
  });
  await call(t, "PUT", `/api/block-bundles/${bundle.id}/listings`, { listingIds: [l.id] });
  const full = await call(t, "GET", `/api/listings/${l.id}`);
  listingId = l.id; blockId = full.blocks[0].id;
  const days = full.blocks[0].sessions.map((x: any) => x.date).sort();
  (globalThis as any).__days = days;
});

test("empty state: brand-new parent", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await mkParent(emails.empty, "Priya Shah");
  await signIn(page, emails.empty);
  await page.waitForURL(/\/custdash\/home/, { timeout: 60_000 });
  const home = page.getByTestId("parent-home");
  await expect(home.getByRole("heading", { name: /Hello, Priya/ })).toBeVisible();
  await expect(home.getByText("Welcome! Two quick steps")).toBeVisible();
  await expect(page.locator('nav[aria-label] [data-tab="home"]')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.setViewportSize({ width: 390, height: 1500 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, "empty-390.png") });
  await shotDesktop(browser, emails.empty, "empty");
});

test("populated: unpaid + upcoming booking + child", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const s = await mkParent(emails.full, "Sam Jones");
  const kid = await call(s.idToken, "POST", "/api/my/children", { name: `Mia ${stamp}`, dob: "2017-03-04", sex: "Girl" }).catch(() => null);
  await call(s.idToken, "POST", "/api/my/children", { name: `Leo ${stamp}`, dob: "2015-06-01" }).catch(() => null);
  void kid;
  const days: string[] = (globalThis as any).__days;
  for (const d of [days[0], days[2]]) {
    await call(s.idToken, "POST", "/api/my/bookings", { listingId, blockId, method: "card", walletCap: 0, items: [{ pass: "1 day", child: `Mia ${stamp}`, age: 8, dates: [d] }] });
  }
  await signIn(page, emails.full);
  await page.waitForURL(/\/custdash\/home/, { timeout: 60_000 });
  const home = page.getByTestId("parent-home");
  await expect(home.getByRole("heading", { name: /Hello, Sam/ })).toBeVisible();
  await expect(home.getByText(/2 to pay/).first()).toBeVisible({ timeout: 30_000 });
  await expect(home.getByText(`Football Camp ${stamp}`).first()).toBeVisible();
  await page.waitForTimeout(2000);
  await page.setViewportSize({ width: 390, height: 1500 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, "full-390.png") });
  await shotDesktop(browser, emails.full, "full");
  // `next` still wins over the Home default
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx.newPage();
  await signIn(p2, emails.full, "/custdash/bookings");
  await p2.waitForURL(/\/custdash\/bookings/, { timeout: 60_000 });
  await ctx.close();
});

async function shotDesktop(browser: Browser, email: string, tag: string) {
  for (const w of [1280, 1440]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 1000 } });
    const p = await ctx.newPage();
    await signIn(p, email);
    await p.waitForURL(/\/custdash\/home/, { timeout: 60_000 }).catch(async (e) => { await p.screenshot({ path: path.join(SHOTS, `debug-${tag}-${w}.png`) }); throw e; });
    await expect(p.getByTestId("parent-home").getByRole("heading").first()).toBeVisible();
    await p.waitForTimeout(2500);
    await p.screenshot({ path: path.join(SHOTS, `${tag}-${w}.png`) });
    await ctx.close();
  }
}
