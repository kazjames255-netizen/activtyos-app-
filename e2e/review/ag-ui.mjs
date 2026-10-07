import { chromium } from "/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright/index.mjs";
import fs from "node:fs";
const D = process.cwd() + "/docs/home-visit-qa/AG/";
const A = JSON.parse(fs.readFileSync("/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/90282caf-1701-4ffc-a82d-955cde3224d8/scratchpad/ag-accounts.json", "utf8"));
const WEB = "http://localhost:3024";
const out = {};
const b = await chromium.launch();
async function login(email) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(90000);
  await page.goto(WEB + "/login", { waitUntil: "load", timeout: 120000 });
  await page.locator('input[type="email"], #email, input[name="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(A.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await page.waitForURL((u) => !/login/.test(u.pathname), { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(3000);
  for (const t of ["Skip", "Maybe later", "Got it", "Close", "Skip for now"]) { const x = page.getByRole("button", { name: t }).first(); if (await x.isVisible().catch(() => false)) await x.click().catch(() => {}); }
  return { ctx, page };
}
async function insights(p, base, shot) {
  await p.goto(`${base}/finance`, { waitUntil: "load", timeout: 120000 });
  await p.getByRole("button", { name: /^Insights$/ }).first().click({ timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.getByRole("button", { name: /Value & mix/ }).first().click({ timeout: 30000 });
  await p.waitForTimeout(2500);
  const panel = p.locator("text=Gender split").first();
  await panel.scrollIntoViewIfNeeded().catch(() => {});
  await p.screenshot({ path: D + shot, fullPage: true });
  return (await p.locator("body").innerText()).includes("Gender split") ? (await p.locator("body").innerText()).split("Gender split")[1].slice(0, 400) : "NO PANEL";
}
// provider: 2 of 3 children have a gender (girl, other); marnie has none
const { page: p } = await login(A.provider.email);
const base = "http://localhost:3024/freelancer";
console.log("provider at", p.url());
out.before = await insights(p, base, "01-insights-before.png");
console.log("BEFORE:", JSON.stringify(out.before));
// parent two: the home-page prompt for marnie
const { page: q } = await login(A.parents.two.email);
await q.goto(WEB + "/custdash/home", { waitUntil: "load", timeout: 120000 });
await q.getByText(/Add gender for marnie kelson/i).first().waitFor({ timeout: 60000 }).catch(() => {});
await q.waitForTimeout(1500);
await q.screenshot({ path: D + "02-parent-home-prompt.png", fullPage: false });
out.promptVisible = await q.getByText(/Add gender for marnie kelson/i).first().isVisible().catch(() => false);
console.log("prompt visible:", out.promptVisible);
await q.getByRole("radio", { name: /^Boy$/ }).first().click({ timeout: 30000 });
await q.waitForTimeout(2500);
out.saved = await q.getByText(/Saved/).first().isVisible().catch(() => false);
await q.screenshot({ path: D + "03-parent-home-saved.png", fullPage: false });
console.log("saved:", out.saved);
// parent one: My children edit shows the 4 options
await q.goto(WEB + "/custdash/children", { waitUntil: "load", timeout: 120000 });
await q.waitForTimeout(3000);
await q.screenshot({ path: D + "04-parent-children.png", fullPage: true });
// provider again: 3 of 3
out.after = await insights(p, base, "05-insights-after.png");
console.log("AFTER:", JSON.stringify(out.after));
fs.writeFileSync(D + "ag-result.json", JSON.stringify(out, null, 2));
await b.close();
