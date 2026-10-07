import { chromium } from "/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright/index.mjs";
import fs from "node:fs";
const D = process.cwd() + "/docs/home-visit-qa/AK/";
const A = JSON.parse(fs.readFileSync(D + "accounts.json", "utf8"));
const WEB = "http://localhost:3028";
const out = {};
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1360, height: 1200 }, acceptDownloads: true });
const p = await ctx.newPage(); p.setDefaultTimeout(90000);
await p.goto(WEB + "/login", { waitUntil: "load", timeout: 120000 });
await p.locator('input[type="email"], #email, input[name="email"]').first().fill(A.provider.email);
await p.locator('input[type="password"]').first().fill(A.password);
await p.getByRole("button", { name: "Sign in", exact: true }).last().click();
await p.waitForURL((u) => !/login/.test(u.pathname), { timeout: 120000 }).catch(() => {});
await p.waitForTimeout(3000);
for (const t of ["Skip", "Not now", "Maybe later", "Got it", "Close", "Skip for now"]) { const x = p.getByRole("button", { name: t }).first(); if (await x.isVisible().catch(() => false)) await x.click().catch(() => {}); }
const base = p.url().match(/^(https?:\/\/[^/]+\/[a-z]+)\//)?.[1] ?? WEB + "/freelancer";
await p.goto(`${base}/invoices`, { waitUntil: "load", timeout: 120000 });
await p.getByRole("button", { name: "All income" }).first().click({ timeout: 120000 });
await p.waitForTimeout(3000);
await p.screenshot({ path: D + "01-all-income.png", fullPage: true });
const txt = async () => (await p.locator("body").innerText());
let t = await txt();
out.allLine = (t.match(/Entries shown[^\n]*\n?[^\n]*/) ?? [""])[0];
out.hasShowFilter = /Show\s*\n?\s*All/.test(t) || (await p.getByRole("button", { name: "Awaiting transfer" }).count()) > 0;
out.rowsAll = (await p.locator("text=HVQ-").count());
for (const [name, key] of [["Refunded", "refunded"], ["Awaiting transfer", "awaiting"], ["Received", "received"]]) {
  await p.getByRole("group").getByRole("button", { name, exact: true }).first().click();
  await p.waitForTimeout(1200);
  const tt = await txt();
  out[key] = { url: p.url(), line: (tt.match(/Entries shown[^\n]*\n?[^\n]*/) ?? [""])[0], rows: await p.locator("text=HVQ-").count() };
  await p.screenshot({ path: D + `02-filter-${key}.png`, fullPage: true });
}
await p.getByRole("group").getByRole("button", { name: "All", exact: true }).first().click();
await p.waitForTimeout(800);
out.urlAfterAll = p.url();
// reload with ?show=refunded
await p.goto(p.url().split("?")[0] + "?show=refunded", { waitUntil: "load" });
await p.getByRole("button", { name: "All income" }).first().click({ timeout: 120000 }).catch(() => {});
await p.waitForTimeout(2500);
out.reloadRefunded = { url: p.url(), pressed: await p.getByRole("button", { name: "Refunded", exact: true }).first().getAttribute("aria-pressed").catch(() => null), rows: await p.locator("text=HVQ-").count() };
// CSV for the Awaiting filter
await p.getByRole("group").getByRole("button", { name: "Awaiting transfer", exact: true }).first().click();
await p.waitForTimeout(800);
const [dl] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: /Export CSV/i }).first().click()]);
const f = D + "export-awaiting.csv"; await dl.saveAs(f); out.csv = fs.readFileSync(f, "utf8").split("\n").slice(0, 4);
// phone width
await p.setViewportSize({ width: 390, height: 900 });
await p.getByRole("group").getByRole("button", { name: "All", exact: true }).first().click();
await p.waitForTimeout(1500);
await p.screenshot({ path: D + "03-all-income-390.png", fullPage: true });
out.noSideScroll = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
fs.writeFileSync(D + "ui-results.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
await b.close();
