import fs from "node:fs";
import path from "node:path";
import { TEST_PASSWORD } from "../helpers/accounts";
import { ROOT, WEB_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require("/Users/kazjames/Downloads/activtyos-app-/server/node_modules/firebase-admin");
const OUT = path.join(ROOT, "e2e/review/shots/onboarding");
admin.initializeApp({ credential: admin.credential.cert(require("/Users/kazjames/Downloads/activtyos-app-/server/serviceAccountKey.json")) });
const TID = "Pq5HFBwVVD6bsTPeSQHL", EM = "e2e-lta-gl-muvh3jh3@activityos-test.com";
let n = 8;
async function shot(page: any, name: string) { await page.waitForTimeout(1800); await page.screenshot({ path: path.join(OUT, `${String(++n).padStart(2, "0")}-${name}.png`) }); console.log("shot", name); }
const sub = (status: string) => admin.firestore().collection("tenants").doc(TID).set({ subscription: { status, plan: "freelancer" } }, { merge: true });
(async () => {
  // reset: no plan, no bank
  await sub("none");
  const ref = admin.firestore().collection("libraries").doc(TID);
  const cur = (await ref.get()).data() ?? {}; const st = { ...(cur.settings ?? {}) }; delete st.cashOnly; st.billing = { ...(st.billing ?? {}), sortCode: "", accountNumber: "", bankName: "" };
  await ref.set({ settings: st }, { merge: true });
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s)); }); const page = await ctx.newPage();
  await page.goto(`${WEB_URL}/login`, { waitUntil: "load" }); await page.waitForTimeout(3000);
  await page.getByPlaceholder("you@example.com").fill(EM); await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((u: URL) => !u.pathname.startsWith("/login"), { timeout: 90_000 }); await page.waitForTimeout(3000);
  const open = async () => {
    await page.goto(`${WEB_URL}/freelancer/listings`, { waitUntil: "load" }); await page.waitForTimeout(4500);
    await page.getByRole("button", { name: /^Edit$/ }).first().click();
    await page.getByText(/^Step 1 of 13/).waitFor({ timeout: 45_000 });
    for (let i = 1; i < 13; i++) { await page.getByRole("button", { name: /^Next/ }).click(); await page.waitForTimeout(400); }
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: /Publish/i }).last().click();
    await page.getByText("Before you go live").first().waitFor({ timeout: 20_000 }); await page.waitForTimeout(2000);
  };
  await open(); await shot(page, "go-live-step-1-free-trial");
  await sub("trialing"); await open(); await shot(page, "go-live-step-2-bank-details");
  await page.getByPlaceholder("e.g. Barclays").fill("Barclays"); await page.getByPlaceholder("00-00-00").fill("20-57-44"); await page.getByPlaceholder("12345678").fill("63437582");
  await page.getByRole("button", { name: "Save bank details" }).click(); await page.waitForTimeout(3000);
  await shot(page, "go-live-step-3-reply-to");
  for (const [p, name] of [["/freelancer/billing?tab=plan", "billing-your-plan"], ["/freelancer/billing?tab=paid", "billing-get-paid-by-parents"], ["/freelancer/setup?tab=cancel", "cancellation-policy-step"], ["/freelancer", "dashboard-checklist-later"]] as const) {
    await page.goto(`${WEB_URL}${p}`, { waitUntil: "load" }); await page.waitForTimeout(4500); await shot(page, name);
  }
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
