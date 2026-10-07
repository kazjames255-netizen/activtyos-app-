// AL browser check: Reconciliation refund filters on the isolated stack (web :3029 / API :4029). Throwaway provider only.
import { chromium } from "/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright/index.mjs";
import fs from "node:fs";
const D = process.cwd() + "/docs/home-visit-qa/AL/";
const A = JSON.parse(fs.readFileSync(D + "accounts.json", "utf8"));
const WEB = "http://localhost:3029";
const out = {};
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1360, height: 1500 } });
const page = await ctx.newPage(); page.setDefaultTimeout(90000);
for (let i = 0; i < 4; i++) {
  await page.goto(WEB + "/login", { waitUntil: "load", timeout: 150000 });
  await page.locator('input[type="email"], #email, input[name="email"]').first().fill(A.provider.email);
  await page.locator('input[type="password"]').first().fill(A.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  const ok = await page.waitForURL((u) => !/login/.test(u.pathname), { timeout: 60000 }).then(() => true).catch(() => false);
  if (ok) break;
  console.log("login attempt", i + 1, "stayed on login:", (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 160));
}
await page.waitForTimeout(3000);
for (const t of ["Skip", "Not now", "Maybe later", "Got it", "Close", "Skip for now"]) { const x = page.getByRole("button", { name: t }).first(); if (await x.isVisible().catch(() => false)) await x.click().catch(() => {}); }
const base = page.url().match(/^(https?:\/\/[^/]+\/[a-z]+)\//)?.[1] ?? WEB + "/freelancer";
async function open(q = "") {
  for (let i = 0; i < 3; i++) {
    await page.goto(`${base}/reconciliation${q}`, { waitUntil: "load", timeout: 150000 });
    if (await page.getByRole("button", { name: /Hide refunded/ }).first().waitFor({ timeout: 90000 }).then(() => true).catch(() => false)) return;
  }
  throw new Error("reconciliation not rendered: " + page.url());
}
const statusBtn = (name) => page.locator(`div:has(> button:text-is("Awaiting")) > button:text-is("${name}")`).first();
const methodTab = (name) => page.locator("button", { hasText: new RegExp("^" + name) }).first();
const settle = async () => { await page.getByRole("button", { name: /^Bank transfer/ }).first().waitFor({ timeout: 90000 }).catch(() => {}); await page.waitForTimeout(1200); };
const shown = async () => (await page.locator("body").innerText()).match(/(\d+) shown|(\d+) to match|Nothing to do/i)?.[0] ?? "";
const refsOnList = async () => (await page.locator("body").innerText()).match(/#HVQ-\d+/g)?.filter((v, i, a) => a.indexOf(v) === i) ?? [];
const tabText = async () => (await page.locator("button").allInnerTexts()).filter((t) => /Bank transfer|Card|Tax-Free/.test(t)).map((t) => t.replace(/\s+/g, " "));
await open();
await settle();
out.base = base;
await page.screenshot({ path: D + "01-default-awaiting.png", fullPage: true });
out.default = { shown: await shown(), refs: await refsOnList(), tabs: await tabText() };

await statusBtn("All").click();
await page.waitForTimeout(800);
await page.screenshot({ path: D + "02-status-all-with-refunded.png", fullPage: true });
out.statusAll = { shown: await shown(), refs: await refsOnList(), tabs: await tabText(), chips: await page.locator("body").innerText().then((t) => ["Refund awaiting transfer", "Refunded", "Part refunded"].filter((c) => t.includes(c))) };

await statusBtn("Refunded").click();
await page.waitForTimeout(800);
await page.screenshot({ path: D + "03-status-refunded.png", fullPage: true });
out.statusRefunded = { shown: await shown(), refs: await refsOnList(), url: page.url() };

// method tabs vs the Refunds panel (status All so refunded rows are listed)
await statusBtn("All").click();
const tab = async (name) => { await methodTab(name).click(); await page.waitForTimeout(800); };
await tab("Bank transfer");
out.bankTab = { refs: await refsOnList(), panel: (await page.locator('[data-ui="refunds"]').innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 330) };
await page.screenshot({ path: D + "04-bank-tab-all-refunds-panel.png", fullPage: true });
await tab("Card");
out.cardTab = { refs: await refsOnList(), panel: (await page.locator('[data-ui="refunds"]').innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 330) };
await page.screenshot({ path: D + "05-card-tab.png", fullPage: true });
await methodTab("All").click();
await page.waitForTimeout(500);

// Hide refunded
await page.getByRole("button", { name: "Hide refunded" }).first().click();
await page.waitForTimeout(900);
out.hideStatusAllRefs = await refsOnList();
await page.screenshot({ path: D + "06-hide-refunded-on.png", fullPage: true });
out.hide = { shown: await shown(), refs: await refsOnList(), tabs: await tabText(), url: page.url(), panelBar: (await page.locator("body").innerText()).includes("Refunded bookings are hidden"), panelListVisible: await page.locator('[data-ui="refunds"]').count() };
// refresh keeps the choice (URL)
await open("?status=refunded&hideRefunded=1");
await settle();
out.hideAfterReload = { pressed: await page.getByRole("button", { name: /Hide refunded/ }).first().getAttribute("aria-pressed"), url: page.url() };
// Clear filters
await page.getByRole("button", { name: /Clear filters/ }).first().click().catch(() => {});
await page.waitForTimeout(700);
out.afterClear = { pressed: await page.getByRole("button", { name: /Hide refunded/ }).first().getAttribute("aria-pressed"), url: page.url() };
// collapse the Refunds panel; remembered across reload
await open();
await settle();
await page.screenshot({ path: D + "dbg-before-collapse.png", fullPage: true });
out.beforeCollapse = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 600);
await page.getByRole("button", { name: "Hide list" }).first().click({ timeout: 20000 });
await page.waitForTimeout(500);
await page.screenshot({ path: D + "07-refunds-panel-collapsed.png", fullPage: true });
await open("");
await settle();
out.collapsedAfterReload = await page.getByRole("button", { name: "Show list" }).count();
// Direct URL: ?status=refunded&hideRefunded=0 and ?hideRefunded=1
await open("?status=refunded");
await settle();
out.urlStatus = { refs: await refsOnList() };
// phone width
await page.setViewportSize({ width: 390, height: 1200 });
await open("?status=all");
await settle();
await page.screenshot({ path: D + "08-phone-status-all.png", fullPage: true });
out.phone = { overflowX: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2) };
fs.writeFileSync(D + "ui-results.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await b.close();
