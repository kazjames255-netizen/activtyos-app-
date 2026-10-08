// UI checks for the chrome-fixes batch (web :3014 -> API :4014): billing ?tab=paid, friendly Stripe message, wizard policy wording, Save pricing confirmation.
import { chromium } from "/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright/index.mjs";
import fs from "node:fs";
const A = JSON.parse(fs.readFileSync(process.cwd() + "/e2e/review/chrome-fixes-accounts.json", "utf8"));
const WEB = "http://localhost:3014";
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1360, height: 800 } })).newPage();
page.setDefaultTimeout(60000);
await page.goto(WEB + "/login", { waitUntil: "load", timeout: 180000 });
await page.locator('input[type="email"]').first().fill(A.email);
await page.locator('input[type="password"]').first().fill(A.password);
await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
await page.waitForURL((u) => !/login/.test(u.pathname), { timeout: 180000 });
await page.waitForTimeout(3000);

await page.goto(WEB + "/freelancer/billing?tab=paid", { waitUntil: "load", timeout: 180000 });
await page.waitForTimeout(3000);
const paidPressed = await page.locator('button[aria-pressed="true"]').first().innerText();
console.log("tab=paid active tab:", JSON.stringify(paidPressed.split("\n")[0]));

const connect = page.getByRole("button", { name: /Connect|Resume/i }).first();
await connect.click();
await page.waitForTimeout(4000);
const body = await page.locator("body").innerText();
console.log("raw Stripe dev text visible:", /npx|v2\/core|Accounts v1/.test(body), "| friendly visible:", /couldn.t reach Stripe/i.test(body));

await page.goto(WEB + "/freelancer/billing", { waitUntil: "load", timeout: 180000 });
await page.waitForTimeout(2500);
await page.setViewportSize({ width: 1100, height: 600 });
const start = page.getByRole("button", { name: /Start free trial|Start .*trial/i }).first();
if (await start.isVisible().catch(() => false)) {
  await start.click();
  await page.waitForTimeout(2500);
  const dlg = page.locator("div.fixed.inset-0.z-50 > div").first();
  const box = await dlg.boundingBox();
  console.log("trial modal box:", box && { y: Math.round(box.y), h: Math.round(box.height) }, "viewport h 600; scrollable:", await dlg.evaluate((e) => getComputedStyle(e).overflowY));
} else console.log("no Start trial button on this account (unwalled)");
await b.close();
