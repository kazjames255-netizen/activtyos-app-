import path from "node:path";
import { ROOT, WEB_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const OUT = path.join(ROOT, "e2e/review/shots/manual-gallery");
(async () => {
  const b = await chromium.launch();
  for (const [name, vp, touch] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]] as const) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: touch, storageState: path.join(ROOT, "e2e/.auth/platform.json") });
    await ctx.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s); }); });
    const p = await ctx.newPage();
    const errs: string[] = []; p.on("pageerror", (e: Error) => errs.push(e.message));
    await p.goto(`${WEB_URL}/platform/manual`, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(6000);
    const h = p.getByRole("heading", { name: "What the emails look like" }).first();
    await h.scrollIntoViewIfNeeded(); await p.waitForTimeout(800);
    const g = p.locator('figure[aria-roledescription="carousel"]').last();
    await g.getByRole("button", { name: "Next screenshot" }).click(); await p.waitForTimeout(500);
    console.log(name, "caption:", (await g.locator("figcaption").first().innerText()).replace(/\n/g, " | "));
    await p.screenshot({ path: path.join(OUT, `emails-${name}.png`) });
    console.log(name, "overflow:", await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), "errors:", errs.length);
    await ctx.close();
  }
  await b.close();
})();
