import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { loadAccounts } from "../helpers/env";

// The real public storefront (a standing e2e tenant) in ar / ur / pl / es: no raw keys, no page errors, no horizontal overflow, text actually translated
// (the storefront chrome comes from the lazily-loaded catalogue: this proves it arrives before the visitor sees blanks). Read-only. Screenshots in /tmp/store-shots.
const NOISE = /Failed to execute 'measure' on 'Performance'|Router action dispatched before initialization/;
for (const loc of ["ar", "ur", "pl", "es"]) test(`storefront ${loc}`, async ({ browser }) => {
  test.setTimeout(300_000); fs.mkdirSync("/tmp/store-shots", { recursive: true });
  const tid = loadAccounts().accounts.company.tenantId; test.skip(!tid, "no company tenant");
  for (const w of [1280, 390]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    await ctx.addCookies([{ name: "aos.locale", value: loc, url: process.env.E2E_BASE_URL || "http://localhost:3000" }]);
    const page = await ctx.newPage(); const errs: string[] = []; page.on("pageerror", (e) => { if (!NOISE.test(e.message)) errs.push(e.message.slice(0, 120)); });
    await page.goto(`/store/${tid}`, { waitUntil: "load" }); await page.waitForTimeout(5000);
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/\b(p7|p8)[a-z]*\.[A-Za-z_]+\b/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.lang)).toBe(loc);
    await page.screenshot({ path: `/tmp/store-shots/${loc}-store-${w}.png`, fullPage: false });
    expect(errs).toEqual([]); await ctx.close();
  }
});
