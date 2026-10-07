import { chromium } from "/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright/index.mjs";
import fs from "node:fs";
const D = process.cwd() + "/docs/home-visit-qa/AM/";
const A = JSON.parse(fs.readFileSync(D + "accounts.json", "utf8"));
const WEB = "http://localhost:3030";
const out = {};
const b = await chromium.launch();
async function login(email, vp = { width: 1360, height: 1000 }) {
  const ctx = await b.newContext({ viewport: vp });
  const page = await ctx.newPage(); page.setDefaultTimeout(90000);
  await page.goto(WEB + "/login", { waitUntil: "load", timeout: 180000 });
  await page.locator('input[type="email"]').first().fill(email); await page.locator('input[type="password"]').first().fill(A.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await page.waitForURL((u) => !/login/.test(u.pathname), { timeout: 180000 }).catch(() => {});
  await page.waitForTimeout(3000);
  for (const t of ["Skip", "Not now", "Maybe later", "Got it", "Close", "Skip for now"]) { const x = page.getByRole("button", { name: t }).first(); if (await x.isVisible().catch(() => false)) await x.click().catch(() => {}); }
  return { ctx, page };
}
const tid = (p, id) => p.locator(`[data-testid="${id}"]`);
const { ctx, page: p } = await login(A.provider.email);
p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 300)); });
p.on("pageerror", (e) => console.log("PAGEERR", String(e).slice(0, 400)));
const base = p.url().match(/^(https?:\/\/[^/]+\/[a-z]+)/)?.[1];
await p.goto(`${base}/kit?date=${A.day}`, { waitUntil: "load", timeout: 90000 }); await tid(p, "kit-strip").waitFor({ timeout: 60000 });
await tid(p, "kit-tab-month").click(); await p.waitForTimeout(4000);
await p.screenshot({ path: D + "06-month-tally.png", fullPage: true });
console.log("month visible", await tid(p, "kit-month").count());
await ctx.close(); await b.close();
