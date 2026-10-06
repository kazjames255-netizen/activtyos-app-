import fs from "node:fs";
import path from "node:path";
import { fbSignUp, apiPost, apiFetch, TEST_PASSWORD, TEST_EMAIL_DOMAIN } from "../helpers/accounts";
import { ROOT, WEB_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require("/Users/kazjames/Downloads/activtyos-app-/server/node_modules/firebase-admin");

const OUT = path.join(ROOT, "e2e/review/shots/onboarding");
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
admin.initializeApp({ credential: admin.credential.cert(require("/Users/kazjames/Downloads/activtyos-app-/server/serviceAccountKey.json")) });
const stamp = Date.now().toString(36);
const email = `e2e-onb-${stamp}@${TEST_EMAIL_DOMAIN}`;
let n = 0;
async function shot(page: any, name: string) { await page.waitForTimeout(1800); await page.screenshot({ path: path.join(OUT, `${String(++n).padStart(2, "0")}-${name}.png`) }); console.log("shot", name); }
async function go(page: any, p: string) { await page.goto(`${WEB_URL}${p}`, { waitUntil: "load", timeout: 120_000 }).catch(() => {}); await page.waitForTimeout(4500); }

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s)); });
  const page = await ctx.newPage();
  // 1. sign-up page as a new provider sees it
  await go(page, "/signup");
  await shot(page, "signup-first-screen");
  // create the account behind the scenes (same call the sign-up form makes)
  const s = await fbSignUp(email);
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role: "freelancer", businessName: "APF Activity Camps", providerName: "APF Activity Camps", providerNameMode: "business" });
  await go(page, "/login");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((u: URL) => !u.pathname.startsWith("/login"), { timeout: 90_000 });
  await page.waitForTimeout(4000);
  await go(page, "/freelancer");
  await shot(page, "dashboard-checklist-0-of-5");
  // 2. add venue
  await go(page, "/freelancer/listings?tab=locations&add=1");
  await shot(page, "add-venue-form");
  const lib = ((await apiFetch<any>("/api/library", s.idToken)) ?? {}) as any;
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ venues: [{ id: "onb-v", name: "Northampton Sports Hall", address: "1 Test Way, Northampton", city: "Northampton", lat: 52.24, lng: -0.9, zoom: 16 }], settings: lib.settings ?? {} }) });
  await go(page, "/freelancer/listings?tab=locations");
  await shot(page, "venue-added-next-step-prompt");
  // 3. block
  await go(page, "/freelancer/listings?tab=blocks");
  await shot(page, "blocks-tab");
  const t = s.idToken;
  const period = await apiPost<{ id: string }>("/api/periods", t, { title: "Full day", start: "09:00", finish: "15:30" });
  const pass = await apiPost<{ id: string }>("/api/passes", t, { name: "Day pass", days: 1 });
  await apiPost("/api/block-bundles", t, { name: "Half term camp block", periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 12, calcOn: true });
  await go(page, "/freelancer/listings?tab=blocks");
  await shot(page, "block-created-next-step-prompt");
  // 4. listing: new listing wizard
  await go(page, "/freelancer/listings");
  await shot(page, "listings-empty");
  await page.getByRole("button", { name: /New listing/ }).first().click().catch(() => {});
  await page.waitForTimeout(3000);
  await shot(page, "listing-wizard-step-1");
  await page.close();
  await b.close();
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
