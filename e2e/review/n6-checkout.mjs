// N6: the parent's checkout offers Tax-Free Childcare only when the provider's details are complete. Provider = fresh N6_STOP account (no details yet).
import { chromium } from "/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright/index.mjs";
import fs from "node:fs";
const D = process.cwd() + "/docs/home-visit-qa/N6/";
const A = JSON.parse(fs.readFileSync(D + "accounts2.json", "utf8"));
const WEB = "http://localhost:3044";
const out = {};
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 1300 } });
const page = await ctx.newPage(); page.setDefaultTimeout(60000);
await page.goto(WEB + "/login", { waitUntil: "load", timeout: 120000 });
await page.locator('input[type="email"], #email, input[name="email"]').first().fill(A.parent.email);
await page.locator('input[type="password"]').first().fill(A.password);
await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
await page.waitForURL((u) => /custdash|parent/.test(u.pathname), { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(4000);
out.afterLogin = page.url();
async function reach(shot) {
  await page.goto(WEB + `/book/${A.listing.id}?quick=1`, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(6000);
  out.signedOutPopup = await page.getByText("Sign in first to book").isVisible().catch(() => false);
  await page.getByRole("button", { name: /Day pass/ }).first().click().catch(() => {});
  await page.getByRole("button", { name: /9:00/ }).first().click().catch(() => {});
  await page.waitForTimeout(800);
  const d = String(new Date().getDate());
  await page.locator("button").filter({ hasText: new RegExp("^\\s*[A-Za-z]{3}\\s*" + d + "\\s*$", "i") }).first().click({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /^Add 1/ }).first().click({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  for (let i = 0; i < 5; i++) { const n = page.getByRole("button", { name: /^Next/ }).first(); if (await n.isVisible().catch(() => false)) { await n.click().catch(() => {}); await page.waitForTimeout(1500); } }
  // Children step: pick the child, then go on to Pay
  await page.getByText("sally james").first().click({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  for (let i = 0; i < 4; i++) { const g = page.getByRole("button", { name: /Continue|Next — pay|Go to pay|Review|Pay/ }).first(); if (await g.isVisible().catch(() => false) && await g.isEnabled().catch(() => false)) { await g.click().catch(() => {}); await page.waitForTimeout(1800); } }
  const sel = page.locator("select").filter({ hasText: /Card|Cash|Tax-Free/ }).first();
  await sel.waitFor({ timeout: 40000 }).catch(() => {});
  const opts = (await sel.locator("option").allInnerTexts().catch(() => [])).map((x) => x.trim());
  const note = await page.getByTestId("tfc-not-ready").isVisible().catch(() => false);
  await sel.scrollIntoViewIfNeeded().catch(() => {});
  await page.screenshot({ path: D + shot, fullPage: false });
  return { opts, note };
}
out.before = await reach("07-checkout-no-tfc-details.png");
// the provider saves the details (API: the Setup form itself was screenshotted in 05-setup-tfc-ready.png)
const key = fs.readFileSync("/Users/kazjames/Downloads/activtyos-app-/.env.local", "utf8").match(/NEXT_PUBLIC_FIREBASE_API_KEY=(\S+)/)[1].replace(/["']/g, "");
const si = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: A.provider.email, password: A.password, returnSecureToken: true }) })).json();
const H = { "Content-Type": "application/json", Authorization: `Bearer ${si.idToken}` };
const lib = await (await fetch("http://localhost:4044/api/library", { headers: H })).json();
const put = await fetch("http://localhost:4044/api/library", { method: "PUT", headers: H, body: JSON.stringify({ settings: { ...(lib.settings ?? {}), childcare: { settingName: A.provider.name, regulator: "Ofsted", registrationNumber: "EY123456", postcode: "MK45 4JZ" } } }) });
out.savedDetails = put.status;
out.after = await reach("09-checkout-with-tfc-details.png");
fs.writeFileSync(D + "ui-results2.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
await b.close();
