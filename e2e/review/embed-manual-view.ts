import path from "node:path";
import { ROOT, WEB_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const OUT = path.join(ROOT, "e2e/review/shots/embed");
(async () => {
  const b = await chromium.launch();
  for (const [name, vp] of [["desktop", { width: 1440, height: 1000 }], ["phone", { width: 390, height: 844 }]] as const) {
    const ctx = await b.newContext({ viewport: vp, storageState: path.join(ROOT, "e2e/.auth/platform.json") });
    await ctx.addInitScript(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s)); });
    const p = await ctx.newPage(); const errs: string[] = []; p.on("pageerror", (e: Error) => errs.push(e.message.slice(0, 120)));
    await p.goto(`${WEB_URL}/platform/manual`, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(6000);
    await p.evaluate(() => { const el = [...document.querySelectorAll("h2")].find((e) => e.textContent?.includes("Put booking on your website")); el?.scrollIntoView({ block: "start" }); });
    await p.waitForTimeout(1200); await p.screenshot({ path: path.join(OUT, `manual-${name}-stage.png`) });
    console.log(name, "stage heading:", await p.getByRole("heading", { name: "Put booking on your website" }).count(), "errors:", errs.join(" | ") || "none", "overflowX:", await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2));
    await ctx.close();
  }
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
