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
const base = p.url().match(/^(https?:\/\/[^/]+\/[a-z]+)/)?.[1] ?? WEB + "/freelancer";
// dashboard
await p.goto(base, { waitUntil: "load", timeout: 180000 }); await tid(p, "dash-addon-card").waitFor({ timeout: 150000 }).catch(() => {}); await p.waitForTimeout(4000);
out.dashCard = await tid(p, "dash-addon-card").innerText().catch(() => null);
await p.screenshot({ path: D + "01-dashboard-card.png" });
await tid(p, "dash-addon-card").screenshot({ path: D + "01b-dashboard-card-closeup.png" }).catch(() => {});
out.sidebarHasAddon = /Add-on orders/.test(await p.locator("body").innerText());
// kit day
await p.goto(`${base}/kit?date=${A.day}`, { waitUntil: "load", timeout: 180000 }); await tid(p, "kit-strip").waitFor({ timeout: 150000 }).catch(() => {}); await p.waitForTimeout(3500);
await p.screenshot({ path: D + "02-day-view-strip.png", fullPage: true });
out.chips = await tid(p, "kit-chip").count();
out.day1 = (await p.locator("body").innerText()).slice(0, 900);
// next day arrow
await tid(p, "kit-next").click(); await p.waitForTimeout(2500);
await p.screenshot({ path: D + "03-next-day-with-orders.png", fullPage: true });
// name filter
await tid(p, "kit-name-filter").selectOption({ label: "Snack pack" }).catch(async () => { await tid(p, "kit-name-filter").selectOption("Snack pack"); }); await p.waitForTimeout(2500);
await p.screenshot({ path: D + "04-name-filter-snack.png", fullPage: true });
out.msgButtons = await tid(p, "kit-msg").count(); out.msgAll = await tid(p, "kit-msg-all").count();
const href = await tid(p, "kit-msg-all").first().getAttribute("href").catch(() => null); out.msgAllHref = href;
if (href) { await p.goto(WEB + href.replace(/^https?:\/\/[^/]+/, ""), { waitUntil: "load", timeout: 180000 }); await p.waitForTimeout(6000); await p.screenshot({ path: D + "05-message-composer.png" }); }
// month
await p.goto(`${base}/kit?date=${A.day}&view=month`, { waitUntil: "load", timeout: 180000 }); await tid(p, "kit-month").waitFor({ timeout: 150000 }).catch(() => {}); await p.waitForTimeout(3500);
await p.screenshot({ path: D + "06-month-tally.png", fullPage: true });
out.month = await tid(p, "kit-month-totals").innerText().catch(() => null);
// reminder toggle
await p.goto(`${base}/kit?date=${A.day}`, { waitUntil: "load", timeout: 180000 }); await tid(p, "kit-remind").waitFor({ timeout: 150000 }).catch(() => {}); await p.waitForTimeout(2500);
out.remindBefore = await tid(p, "kit-remind").innerText();
await tid(p, "kit-remind").click(); await p.waitForTimeout(2000);
out.remindAfter = await tid(p, "kit-remind").innerText();
await p.screenshot({ path: D + "07-reminder-off.png" });
await p.goto(`${base}/setup`, { waitUntil: "load", timeout: 180000 }); await p.waitForTimeout(5000);
await tid(p, "kit-remind"); // placeholder
await ctx.close();
// phone
const ph = await login(A.provider.email, { width: 390, height: 844 });
await ph.page.goto(`${base}/kit?date=${A.day}`, { waitUntil: "load", timeout: 180000 }); await ph.page.waitForTimeout(6000);
await ph.page.screenshot({ path: D + "08-phone-day.png", fullPage: true });
await ph.page.goto(base, { waitUntil: "load", timeout: 180000 }); await ph.page.waitForTimeout(6000);
await ph.page.screenshot({ path: D + "09-phone-dashboard.png", fullPage: true });
await ph.ctx.close();
// provider with no orders
const e = await login(A.empty.email);
await e.page.waitForTimeout(5000);
out.emptySidebarHasAddon = /Add-on orders/.test(await e.page.locator("body").innerText());
await e.page.screenshot({ path: D + "10-empty-provider-dashboard.png" });
const eb = e.page.url().match(/^(https?:\/\/[^/]+\/[a-z]+)/)?.[1];
await e.page.goto(`${eb}/kit`, { waitUntil: "load", timeout: 180000 }); await e.page.waitForTimeout(6000);
await e.page.screenshot({ path: D + "11-empty-provider-kit-page.png" });
out.emptyKitText = (await e.page.locator("main").innerText().catch(() => "")).slice(0, 300);
fs.writeFileSync(D + "ui-results.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await b.close();
