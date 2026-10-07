// AE screenshots of the quick-book page on the isolated stack: node e2e/review/AE/shots.mjs   (web :3022)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const dir = path.dirname(fileURLToPath(import.meta.url));
const ids = JSON.parse(fs.readFileSync(path.join(dir, "ids.json"), "utf8"));
const url = `http://localhost:3022/book/${ids.listings.venue}?quick=1`;
const sizes = [["1920", 1920, 1080], ["1440", 1440, 900], ["1024", 1024, 800], ["768", 768, 1000], ["390", 390, 844]];
const browser = await chromium.launch();
const results = [];
async function shoot(name, w, h, locale) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  if (locale) await ctx.addInitScript((l) => { try { localStorage.setItem("aos.locale", l); } catch {} }, locale);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  // signed out: dismiss the sign-in popup so the layout behind it shows
  const later = page.getByText(/keep looking|maybe later|not now/i).first();
  if (await later.count()) await later.click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(800);
  const card = page.locator(".aos-pb-card").first();
  await card.waitFor({ timeout: 15000 }).catch(() => {});
  const m = await page.evaluate(() => {
    const q = (s) => document.querySelector(s)?.getBoundingClientRect();
    const c = q(".aos-quick"), card = q(".aos-pb-card"), main = q(".aos-pb-main"), bk = q(".aos-pb-basket"), days = q(".aos-pb-days"), day = q(".aos-pb-day");
    const f = (r) => r && { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    return { win: innerWidth, container: f(c), card: f(card), main: f(main), basket: f(bk), days: f(days), day: f(day), hscroll: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: false });
  results.push({ name, ...m });
  await ctx.close();
}
for (const [n, w, h] of sizes) await shoot(`quick-${n}`, w, h);
await shoot("quick-1440-ar", 1440, 900, "ar");
await shoot("quick-390-ar", 390, 844, "ar");
fs.writeFileSync(path.join(dir, "metrics.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.map((r) => ({ n: r.name, card: r.card?.w, basket: r.basket && `${r.basket.w}@${r.basket.x},${r.basket.y}`, day: r.day?.w, hscroll: r.hscroll })), null, 0));
await browser.close();
