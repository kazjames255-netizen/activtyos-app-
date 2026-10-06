import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fbSignUp, fbSignIn, apiPost, apiFetch, TEST_PASSWORD, TEST_EMAIL_DOMAIN } from "../helpers/accounts";
import { ROOT, WEB_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium, webkit, devices } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");

const SHOTS = path.join(ROOT, "e2e/review/shots/setupbanner");
fs.mkdirSync(SHOTS, { recursive: true });
const stamp = Date.now().toString(36);
const log = (...a: unknown[]) => console.log(...a);
const unwall = (id: string) => execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", id], { stdio: "pipe" });

async function mk(tag: string) {
  const email = `e2e-sb-${tag}-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role: "company", businessName: `SB ${tag} ${stamp}`, providerName: `SB ${tag} ${stamp}`, providerNameMode: "business" });
  unwall(r.tenantId);
  return email;
}
const tok = async (e: string) => (await fbSignIn(e)).idToken;
async function login(page: any, email: string) {
  await page.goto(`${WEB_URL}/login`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/company\//, { timeout: 90_000 });
  await page.waitForTimeout(3000);
}
async function seedVenue(email: string) {
  const t = await tok(email);
  const lib = ((await apiFetch<any>("/api/library", t)) ?? {}) as any;
  await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ venues: [{ id: "sb-venue", name: "Northampton Sports Hall", address: "1 Test Way", city: "Northampton" }], settings: lib.settings ?? {} }) });
}
async function seedBlock(email: string) {
  const t = await tok(email);
  const period = await apiPost<{ id: string }>("/api/periods", t, { title: "Full day", start: "09:00", finish: "15:30" });
  const pass = await apiPost<{ id: string }>("/api/passes", t, { name: "Day pass", days: 1 });
  return apiPost<{ id: string }>("/api/block-bundles", t, { name: "Block SB", periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 12, calcOn: true });
}
async function seedRest(email: string, bundleId: string) {
  const t = await tok(email);
  const lib = ((await apiFetch<any>("/api/library", t)) ?? {}) as any;
  await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ venues: lib.venues, settings: { ...(lib.settings ?? {}), payMethods: ["cash"], cancellationPolicies: [{ id: "p1", name: "Standard" }] } }) });
  const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  const e = new Date(d); e.setDate(e.getDate() + 11);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const l = await apiPost<{ id: string }>("/api/listings", t, { title: "SB Football", venueId: "sb-venue", runFrom: iso(d), runTo: iso(e), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "16", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundleId, passes: [{ name: "Day pass", price: 12, days: 1 }], bookingType: "auto", status: "live", visibility: "public" });
  await apiFetch(`/api/block-bundles/${bundleId}/listings`, t, { method: "PUT", body: JSON.stringify({ listingIds: [l.id] }) });
  await apiPost("/api/invites", t, { role: "staff", name: "Sam Coach", staffRole: "Coach" }).catch(() => {});
}

const PAGES: [string, string][] = [["bookings", "/company/bookings"], ["listings", "/company/listings"], ["setup", "/company/setup"], ["money", "/company/getpaid"]];
async function visit(page: any, tag: string, state: string, pages = PAGES, extra?: (p: any) => Promise<void>) {
  for (const [n, p] of pages) {
    await page.goto(`${WEB_URL}${p}`, { waitUntil: "load", timeout: 120_000 }).catch(() => {});
    await page.waitForTimeout(5000);
    const b = page.locator('[data-testid="setup-banner"]');
    const vis = await b.count();
    const txt = vis ? (await b.innerText()).replace(/\n/g, " | ") : "(none)";
    const box = vis ? await b.boundingBox() : null;
    const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    log(tag, state, n, txt, box ? `h=${Math.round(box.height)} w=${Math.round(box.width)}` : "", "overflowX=", sw);
    if (extra) await extra(page);
    await page.screenshot({ path: path.join(SHOTS, `${tag}-${state}-${n}.png`) });
  }
}

async function run(tag: string, bt: any, device: any) {
  const email = await mk(tag);
  const b = await bt.launch();
  const ctx = await b.newContext(device ? { ...device } : { viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await login(page, email);
  await visit(page, tag, "0of6");
  // expanded panel
  await page.goto(`${WEB_URL}/company/bookings`, { waitUntil: "load" }); await page.waitForTimeout(5000);
  await page.locator(device ? '[data-testid="setup-banner-toggle-m"]' : '[data-testid="setup-banner-toggle"]').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, `${tag}-0of6-panel-open.png`) });
  // Dashboard: banner should be absent (card shown)
  await page.goto(`${WEB_URL}/company/dashboard`, { waitUntil: "load" }); await page.waitForTimeout(5000);
  log(tag, "dashboard banner count:", await page.locator('[data-testid="setup-banner"]').count(), "card:", await page.locator('[data-testid="first-run-checklist"]').count());
  await page.screenshot({ path: path.join(SHOTS, `${tag}-0of6-dashboard.png`) });
  await seedVenue(email);
  const bid = await seedBlock(email);
  await visit(page, tag, "partial");
  // hide for today
  await page.goto(`${WEB_URL}/company/bookings`, { waitUntil: "load" }); await page.waitForTimeout(5000);
  await page.locator('[data-testid="setup-banner-snooze"]').click(); await page.waitForTimeout(500);
  await visit(page, tag, "hidden-today");
  // un-snooze + complete
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes("firstrun.snooze")).forEach((k) => localStorage.removeItem(k)));
  await seedRest(email, bid.id);
  await visit(page, tag, "complete");
  await b.close();
}
(async () => {
  await run("desk", chromium, null);
  await run("phone", webkit, devices["iPhone 13"]);
  log("DONE");
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
