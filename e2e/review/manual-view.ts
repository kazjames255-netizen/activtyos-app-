import path from "node:path";
import { ROOT, WEB_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const OUT = path.join(ROOT, "e2e/review/shots/manual");
(async () => {
  const b = await chromium.launch();
  for (const [name, vp, scheme] of [["desktop-light", { width: 1440, height: 9000 }, "light"], ["desktop-dark", { width: 1440, height: 9000 }, "dark"], ["phone-light", { width: 390, height: 16000 }, "light"], ["phone-dark", { width: 390, height: 16000 }, "dark"]] as const) {
    const ctx = await b.newContext({ viewport: vp, colorScheme: scheme, storageState: path.join(ROOT, "e2e/.auth/platform.json") });
    await ctx.addInitScript((s: string) => { try { localStorage.setItem("theme", s); localStorage.setItem("aos.theme", s); } catch {} document.addEventListener("DOMContentLoaded", () => { document.documentElement.setAttribute("data-theme", s); const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(st); }); }, scheme);
    const p = await ctx.newPage();
    await p.goto(`${WEB_URL}/platform/manual`, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(6000);
    console.log(name, p.url());
    await p.screenshot({ path: path.join(OUT, `${name}-full.png`), fullPage: false });
    await ctx.close();
  }
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
