import fs from "node:fs";
import path from "node:path";
import { fbSignUp, apiPost, apiFetch, TEST_PASSWORD, TEST_EMAIL_DOMAIN } from "../helpers/accounts";
import { ROOT, WEB_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require("/Users/kazjames/Downloads/activtyos-app-/server/node_modules/firebase-admin");

const OUT = path.join(ROOT, "e2e/review/shots/onboarding3");
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
admin.initializeApp({ credential: admin.credential.cert(require("/Users/kazjames/Downloads/activtyos-app-/server/serviceAccountKey.json")) });
const stamp = Date.now().toString(36);
const email = `e2e-onb3-${stamp}@${TEST_EMAIL_DOMAIN}`;
const BIZ = "Riverside Activity Camps";

// Make every capture brand-neutral and free of test identities.
const SCRUB = `(() => {
  const brand = (s) => s
    .replace(/(^|[.!?]\\s+)(ActivityOS|Activly)\\b/g, (m, a) => a + "The platform")
    .replace(/\\b([Yy])our (ActivityOS|Activly) plan/g, (m, y) => y + "our plan")
    .replace(/\\b(ActivityOS|Activly)\\b/g, "the platform")
    .replace(/E2e [A-Za-z0-9]+ [A-Za-z0-9]+/g, "Sam Taylor")
    .replace(/[\\w.+-]+@activityos-test\\.com/g, "sam@riverside-camps.co.uk");
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) { const v = n.nodeValue || ""; if (/Activ|E2e|activityos-test/.test(v)) n.nodeValue = brand(v); }
  document.querySelectorAll("input").forEach((i) => { if (/activityos-test/.test(i.value)) i.value = "sam@riverside-camps.co.uk"; });
  document.querySelectorAll("div,a,span").forEach((el) => {
    const t = (el.textContent || "").replace(/\\s+/g, "");
    if (/^(Activly|Activity)$/i.test(t) && el.children.length <= 3) el.style.visibility = "hidden";
  });
  document.querySelectorAll("div").forEach((el) => { const tx = (el.textContent || "").trim(); if (/^POWERED BY/i.test(tx) && tx.length < 140) el.style.visibility = "hidden"; });
  document.querySelectorAll("div").forEach((el) => { if ((el.textContent || "").trim().indexOf("Card payments are being set up") === 0 && el.children.length === 0) el.style.display = "none"; });
})()`;
let n = 0;
async function shot(page: any, name: string) {
  await page.waitForTimeout(1800);
  await page.evaluate(SCRUB).catch((e: Error) => console.log('scrub failed', e.message.slice(0, 120)));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${String(++n).padStart(2, "0")}-${name}.png`) }); console.log("shot", name);
}
async function go(page: any, p: string) { await page.goto(`${WEB_URL}${p}`, { waitUntil: "load", timeout: 120_000 }).catch(() => {}); await page.waitForTimeout(4500); }
const NOPORTAL = () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s)); };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(NOPORTAL);
  const page = await ctx.newPage();
  const s = await fbSignUp(email); const t = s.idToken;
  const r = await apiPost<{ tenantId: string }>("/api/register-role", t, { role: "freelancer", businessName: BIZ, providerName: BIZ, providerNameMode: "business" });
  await admin.firestore().collection("tenants").doc(r.tenantId).set({ subscription: { status: "none", plan: "freelancer" } }, { merge: true });
  await go(page, "/login");
  await page.getByPlaceholder("you@example.com").fill(email); await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((u: URL) => !u.pathname.startsWith("/login"), { timeout: 90_000 }); await page.waitForTimeout(4000);
  const lib = ((await apiFetch<any>("/api/library", t)) ?? {}) as any;
  await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ venues: [{ id: "onb-v", name: "Northampton Sports Hall", address: "1 Test Way, Northampton", city: "Northampton", lat: 52.24, lng: -0.9, zoom: 16 }], settings: lib.settings ?? {} }) });
  const period = await apiPost<{ id: string }>("/api/periods", t, { title: "Full day", start: "09:00", finish: "15:30" });
  const pass = await apiPost<{ id: string }>("/api/passes", t, { name: "Day pass", days: 1 });
  const bundle = await apiPost<{ id: string }>("/api/block-bundles", t, { name: "Half term camp block", periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 12, calcOn: true });
  const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); const e = new Date(d); e.setDate(e.getDate() + 11); const iso = (x: Date) => x.toISOString().slice(0, 10);
  const lst = await apiPost<{ id: string }>("/api/listings", t, { title: "Half term multi-activity camp", venueId: "onb-v", runFrom: iso(d), runTo: iso(e), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "16", status: "draft" });
  await apiFetch(`/api/block-bundles/${bundle.id}/listings`, t, { method: "PUT", body: JSON.stringify({ listingIds: [lst.id] }) });
  await go(page, "/freelancer/listings");
  await page.locator('[data-ui="card"]').filter({ hasText: "Half term multi-activity camp" }).last().getByRole("button", { name: /^(Edit|Resume)$/ }).first().click();
  await page.getByText(/^Step 1 of 13/).waitFor({ timeout: 45_000 });
  const next = async (k: number) => { for (let i = 0; i < k; i++) { await page.getByRole("button", { name: /^Next/ }).click(); await page.waitForTimeout(450); } };
  await next(1); await shot(page, "listing-step-2-details");
  await next(5); await shot(page, "listing-step-7-when-it-runs");
  await next(1); await shot(page, "listing-step-8-tickets-and-block");
  await next(5); await shot(page, "listing-step-13-policy-and-publish");
  await b.close(); process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
