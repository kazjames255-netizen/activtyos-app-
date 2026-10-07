// AI screenshots of the Money in > Income trend chart: node e2e/review/AI/shots.mjs <baseUrl> <prefix>
// e.g. after: node e2e/review/AI/shots.mjs http://localhost:3026 after    before (same data, live site): node e2e/review/AI/shots.mjs https://activtyos-app-zayoxs-projects.vercel.app before
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const dir = path.dirname(fileURLToPath(import.meta.url));
const acc = JSON.parse(fs.readFileSync(path.join(dir, "../../../docs/home-visit-qa/AI/accounts.json"), "utf8"));
const [base, prefix] = [process.argv[2], process.argv[3] || "after"];
const outDir = path.join(dir, "../../../docs/home-visit-qa/AI");
const browser = await chromium.launch();
const results = [];
async function run(label, w, h, locale) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  if (locale) await ctx.addInitScript((l) => { try { localStorage.setItem("aos.locale", l); } catch {} }, locale);
  const page = await ctx.newPage();
  await page.goto(`${base}/login`, { waitUntil: "load" });
  await page.locator('input[type="email"], input[name="email"], input[autocomplete="email"], input[autocomplete="username"]').first().fill(acc.provider.email);
  await page.locator('input[type="password"]').first().fill(acc.password);
  await page.locator('input[type="password"]').first().press("Enter");
  await page.waitForURL(/\/freelancer|\/onboard|\/home/, { timeout: 60000 }).catch(() => {});
  await page.goto(`${base}/freelancer/purchasing`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  const income = page.getByRole("button", { name: /💰/ }).first();
  if (await income.count()) { await income.click().catch(() => {}); await page.waitForTimeout(1500); }
  const ov = page.getByRole("button", { name: /^overview$/i }).first();
  if (await ov.count()) { await ov.click().catch(() => {}); await page.waitForTimeout(1500); }
  const group = page.locator("div.inline-flex.overflow-hidden.rounded-full").filter({ has: page.locator("button") }).first();
  for (const [idx, key] of ["7d", "month", "6m", "9m", "year"].entries()) {
    const b = group.locator("button").nth(idx);
    if (!(await b.count())) { results.push({ label, key, missing: true }); continue; }
    await b.click(); await page.waitForTimeout(700);
    const card = page.locator("div.p-4").filter({ has: group }).first();
    await card.scrollIntoViewIfNeeded().catch(() => {});
    await card.screenshot({ path: path.join(outDir, `${prefix}-${label}-${key}.png`) }).catch(async () => { await page.screenshot({ path: path.join(outDir, `${prefix}-${label}-${key}.png`) }); });
    if (key === "6m" || key === "year") {
      const col = page.locator('[data-testid="money-bars"] [role="img"]').nth(key === "year" ? 8 : 4);
      if (await col.count()) {
        await col.hover(); await page.waitForTimeout(400);
        await card.screenshot({ path: path.join(outDir, `${prefix}-${label}-${key}-tip.png`) }).catch(() => {});
        await col.focus(); await page.keyboard.press("Tab"); await page.waitForTimeout(300);
      }
    }
    const m = await page.evaluate(() => { const el = document.querySelector('[data-testid="money-bars"]'); if (!el) return { bars: false }; const r = el.getBoundingClientRect(); return { bars: true, w: Math.round(r.width), hscroll: document.documentElement.scrollWidth > innerWidth + 1, labels: [...el.querySelectorAll("div.whitespace-nowrap")].map((d) => d.textContent).join("|") }; });
    results.push({ label, key, ...m });
  }
  await ctx.close();
}
await run("1440", 1440, 1000);
await run("390", 390, 844);
if (prefix === "after") await run("1440-ar", 1440, 1000, "ar");
fs.writeFileSync(path.join(outDir, `${prefix}-metrics.json`), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
await browser.close();
