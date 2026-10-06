import path from "node:path";
import { ROOT, WEB_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const OUT = path.join(ROOT, "e2e/review/shots/manualm");
(async () => {
  const b = await chromium.launch();
  for (const [name, vp] of [["desktop", { width: 1440, height: 1000 }], ["phone", { width: 390, height: 844 }]] as const) {
    const ctx = await b.newContext({ viewport: vp, storageState: path.join(ROOT, "e2e/.auth/platform.json") });
    await ctx.addInitScript(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s)); });
    const p = await ctx.newPage(); const errs: string[] = []; p.on("pageerror", (e: Error) => errs.push(e.message.slice(0, 120)));
    await p.goto(`${WEB_URL}/platform/manual`, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(6000);
    console.log(name, p.url().replace(WEB_URL, ""));
    for (const [tag, title] of [["7b", "When parents see your bank details"], ["8", "Set your cancellation policy"]] as const) {
      const h = p.getByRole("heading", { name: title }).first(); await h.scrollIntoViewIfNeeded(); await p.evaluate((t: string) => { const el = [...document.querySelectorAll("h2")].find((e) => e.textContent === t); if (el) window.scrollTo(0, (el as HTMLElement).getBoundingClientRect().top + window.scrollY - 24); }, title);
      await p.waitForTimeout(800); await p.screenshot({ path: path.join(OUT, `view-${name}-${tag}.png`) });
    }
    // gallery next on the bank stage
    const bank = p.getByRole("heading", { name: "When parents see your bank details" }).first();
    await bank.scrollIntoViewIfNeeded();
    const sec = p.locator("section, div").filter({ has: bank }).last();
    await p.getByRole("button", { name: "Next screenshot" }).nth(0).click({ trial: true }).catch(() => {});
    console.log(name, "errors:", errs.join(" | ") || "none", "| overflowX:", await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2));
    await ctx.close();
  }
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
