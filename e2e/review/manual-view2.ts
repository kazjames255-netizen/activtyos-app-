import path from "node:path";
import { ROOT, WEB_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const OUT = path.join(ROOT, "e2e/review/shots/manual");
(async () => {
  const b = await chromium.launch();
  for (const [name, vp, scheme] of [["desktop-light", { width: 1440, height: 900 }, "light"], ["desktop-dark", { width: 1440, height: 900 }, "dark"], ["phone-light", { width: 390, height: 844 }, "light"], ["phone-dark", { width: 390, height: 844 }, "dark"]] as const) {
    const ctx = await b.newContext({ viewport: vp, colorScheme: scheme, storageState: path.join(ROOT, "e2e/.auth/platform.json") });
    await ctx.addInitScript((s: string) => { try { localStorage.setItem("theme", s); localStorage.setItem("aos.theme", s); } catch {} document.addEventListener("DOMContentLoaded", () => { document.documentElement.setAttribute("data-theme", s); const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(st); }); }, scheme);
    const p = await ctx.newPage();
    await p.goto(`${WEB_URL}/platform/manual`, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(6000);
    const heads = ["The whole journey on one line", "Go live: three single steps", "Who pays whom", "The plan: trial, charge and grace", "The emails a new provider gets"];
    let i = 0;
    for (const h of heads) {
      const el = p.getByRole("heading", { name: h }).first();
      await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(700);
      await p.screenshot({ path: path.join(OUT, `v-${name}-${++i}.png`) });
    }
    const w = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    console.log(name, JSON.stringify(w));
    await ctx.close();
  }
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
