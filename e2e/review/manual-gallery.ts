import path from "node:path";
import fs from "node:fs";
import { ROOT, WEB_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const OUT = path.join(ROOT, "e2e/review/shots/manual-gallery"); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  for (const [name, vp, touch] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]] as const) {
    const ctx = await b.newContext({ viewport: vp, hasTouch: touch, storageState: path.join(ROOT, "e2e/.auth/platform.json") });
    await ctx.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s); }); });
    const p = await ctx.newPage();
    const errs: string[] = []; p.on("pageerror", (e: Error) => errs.push(e.message)); p.on("console", (m: any) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
    await p.goto(`${WEB_URL}/platform/manual`, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(6000);
    const h = p.getByRole("heading", { name: "Create and publish a listing" }).first();
    await h.scrollIntoViewIfNeeded(); await p.waitForTimeout(800);
    const g = p.locator('figure[aria-roledescription="carousel"]').nth(5); // stage 5 gallery
    const count = await p.locator('figure[aria-roledescription="carousel"]').count();
    console.log(name, "galleries", count);
    await g.scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(OUT, `${name}-1-gallery.png`) });
    // next via button, then keyboard
    await g.getByRole("button", { name: "Next screenshot" }).click(); await p.waitForTimeout(400);
    await g.focus(); await p.keyboard.press("ArrowRight"); await p.waitForTimeout(400);
    const cap = await g.locator("figcaption").first().innerText();
    console.log(name, "after next + ArrowRight caption:", cap.replace(/\n/g, " | "));
    await g.getByRole("tab", { name: /Show screenshot 1:/ }).click(); await p.waitForTimeout(300);
    console.log(name, "tab click ->", (await g.locator("figcaption").first().innerText()).split("\n")[0]);
    await p.screenshot({ path: path.join(OUT, `${name}-2-after-nav.png`) });
    // lightbox
    await g.getByRole("button", { name: /^Enlarge:/ }).click(); await p.waitForTimeout(600);
    const dlg = p.getByRole("dialog");
    console.log(name, "dialog open:", await dlg.count());
    await p.screenshot({ path: path.join(OUT, `${name}-3-lightbox.png`) });
    await p.keyboard.press("ArrowRight"); await p.waitForTimeout(300);
    console.log(name, "lightbox counter after ArrowRight:", (await dlg.locator("span[aria-live]").first().innerText()));
    // focus trap: Tab many times, active element must stay inside dialog
    let inside = true; for (let i = 0; i < 8; i++) { await p.keyboard.press("Tab"); inside = inside && await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')); }
    console.log(name, "focus stays in dialog:", inside);
    await p.keyboard.press("Escape"); await p.waitForTimeout(400);
    console.log(name, "dialog after Esc:", await p.getByRole("dialog").count(), "focus back on:", await p.evaluate(() => document.activeElement?.getAttribute("aria-label")?.slice(0, 40)));
    const w = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    console.log(name, "overflow", JSON.stringify(w), "errors:", JSON.stringify(errs.slice(0, 3)));
    await ctx.close();
  }
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
