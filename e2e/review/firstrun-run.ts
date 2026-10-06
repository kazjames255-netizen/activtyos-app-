import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fbSignUp, fbSignIn, apiPost, apiFetch, TEST_PASSWORD, TEST_EMAIL_DOMAIN } from "../helpers/accounts";
import { ROOT, WEB_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium, webkit, devices } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");

const SHOTS = path.join(ROOT, "e2e/review/shots/firstrun");
fs.mkdirSync(SHOTS, { recursive: true });
const stamp = Date.now().toString(36);
const em = (w: string) => `e2e-fr-${w}-${stamp}@${TEST_EMAIL_DOMAIN}`;
const unwall = (...ids: string[]) => execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", ...ids], { stdio: "pipe" });
const log = (...a: unknown[]) => console.log(...a);

async function mk(role: "freelancer" | "company", name: string) {
  const s = await fbSignUp(em(role));
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role, businessName: name, providerName: name, providerNameMode: "business" });
  unwall(r.tenantId);
  return { email: em(role), tenantId: r.tenantId };
}
async function tok(email: string) { return (await fbSignIn(email)).idToken; }

async function login(page: any, email: string, home: RegExp) {
  await page.goto(`${WEB_URL}/login`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(home, { timeout: 90_000 });
  await page.waitForTimeout(3000);
}
async function shot(page: any, name: string, full = false) {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full });
  log("shot", name);
}
async function goto(page: any, p: string) { await page.goto(`${WEB_URL}${p}`, { waitUntil: "load", timeout: 120_000 }).catch(() => {}); await page.waitForTimeout(5000); }
const card = (page: any) => page.locator('[data-testid="first-run-checklist"]');
async function prog(page: any) { const c = card(page); return (await c.count()) ? (await c.locator('[data-testid="first-run-progress"]').innerText()) : "(hidden)"; }

async function seedPartial(email: string, withTeam: boolean) {
  const t = await tok(email);
  const lib = ((await apiFetch<any>("/api/library", t)) ?? {}) as any;
  await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ venues: [...(lib.venues ?? []), { id: "fr-venue", name: "Northampton Sports Hall", address: "1 Test Way", city: "Northampton" }], settings: lib.settings ?? {} }) });
}
async function seedBlock(email: string, title: string) {
  const t = await tok(email);
  const period = await apiPost<{ id: string }>("/api/periods", t, { title: "Full day", start: "09:00", finish: "15:30" });
  const pass = await apiPost<{ id: string }>("/api/passes", t, { name: "Day pass", days: 1 });
  return apiPost<{ id: string }>("/api/block-bundles", t, { name: `Block ${title}`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 12, calcOn: true });
}
async function seedListing(email: string, title: string, bundleId: string) {
  const t = await tok(email);
  const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  const e = new Date(d); e.setDate(e.getDate() + 11);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const l = await apiPost<{ id: string }>("/api/listings", t, { title, venueId: "fr-venue", runFrom: iso(d), runTo: iso(e), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "16", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundleId, passes: [{ name: "Day pass", price: 12, days: 1 }], bookingType: "auto", status: "live", visibility: "public" });
  await apiFetch(`/api/block-bundles/${bundleId}/listings`, t, { method: "PUT", body: JSON.stringify({ listingIds: [l.id] }) });
  return l.id;
}

async function runRole(label: string, role: string, email: string, dashPath: string, tabs: boolean, browserType: any, device: any, tag: string, full: boolean) {
  const b = await browserType.launch();
  const ctx = await b.newContext(device ? { ...device } : { viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await login(page, email, new RegExp(`/${role}/`));
  // 1: Bookings empty state at 0
  await goto(page, `/${role}/bookings`);
  log(label, tag, "bookings:", await prog(page));
  await shot(page, `${label}-${tag}-1-bookings-empty`);
  await goto(page, dashPath);
  log(label, tag, "dash 0:", await prog(page));
  await shot(page, `${label}-${tag}-2-dashboard-0`);
  if (full) {
    await seedPartial(email, false);
    const bid = await seedBlock(email, label);
    await goto(page, dashPath);
    log(label, tag, "after venue+block:", await prog(page));
    await shot(page, `${label}-${tag}-3-dashboard-partial`);
    await seedListing(email, `${label} Football`, bid.id);
    if (tabs) await apiPost("/api/invites", await tok(email), { role: "staff", name: "Sam Coach", staffRole: "Coach" }).catch((e: Error) => log("invite", e.message));
    await page.evaluate(() => { try { /* mark pay + cancel visited */ } catch {} });
    await goto(page, dashPath);
    log(label, tag, "after listing(+team):", await prog(page));
    await shot(page, `${label}-${tag}-4-dashboard-listing-done`);
    // click pay + cancel buttons to tick them
    for (const id of ["pay", "cancel"]) {
      await card(page).locator(`[data-testid="first-run-step-${id}"] button`).click().catch(() => {});
      await page.waitForTimeout(4000);
      if (id === "pay") await shot(page, `${label}-${tag}-5-getpaid-clean`);
      else await shot(page, `${label}-${tag}-6-cancel-tab`);
      await goto(page, dashPath);
    }
    log(label, tag, "after pay+cancel:", await prog(page));
    await shot(page, `${label}-${tag}-7-dashboard-complete`);
    await card(page).locator('[data-testid="first-run-hide"]').click().catch(() => {});
    await page.waitForTimeout(800);
    await goto(page, dashPath);
    log(label, tag, "after Hide+reload:", await prog(page));
    await shot(page, `${label}-${tag}-8-dashboard-hidden`);
  }
  await b.close();
}

(async () => {
  const ONLY = process.env.ONLY || "";
  const fl = await mk("freelancer", `FR Free ${stamp}`);
  const co = await mk("company", `FR Co ${stamp}`);
  // franchise: invited by a separate head office
  log("provisioned", fl.email, co.email);
  if (!ONLY) await runRole("freelancer", "freelancer", fl.email, "/freelancer/dash", false, chromium, null, "desk", true);
  if (!ONLY) await runRole("freelancer", "freelancer", fl.email, "/freelancer/dash", false, webkit, devices["iPhone 13"], "phone", false);
  if (!ONLY) await runRole("company", "company", co.email, "/company/dashboard", true, chromium, null, "desk", true);
  if (!ONLY) await runRole("company", "company", co.email, "/company/dashboard", true, webkit, devices["iPhone 13"], "phone", false);
  // franchise via invite from the HO (second company account)
  const hoEmail = em("company").replace("company", "ho");
  const s = await fbSignUp(hoEmail);
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role: "company", businessName: `FR HO ${stamp}`, providerName: `FR HO ${stamp}`, providerNameMode: "business" });
  unwall(r.tenantId);
  const inv = await apiPost<{ token: string }>("/api/invites", s.idToken, { role: "franchise", franchiseName: `FR Sunny ${stamp}` });
  const fe = em("franchise");
  const fs2 = await fbSignUp(fe);
  await apiPost(`/api/invites/${inv.token}/accept`, fs2.idToken, {});
  await runRole("franchise", "franchise", fe, "/franchise/dash", true, chromium, null, "desk", true);
  await runRole("franchise", "franchise", fe, "/franchise/dash", false, webkit, devices["iPhone 13"], "phone", false);
  fs.writeFileSync(path.join(SHOTS, "accounts.json"), JSON.stringify({ fl, co, hoEmail, fe }, null, 2));
  log("DONE");
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
