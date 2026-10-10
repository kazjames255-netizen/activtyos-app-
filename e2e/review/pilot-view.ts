import path from "node:path";
import { ROOT, WEB_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const OUT = path.join(ROOT, "e2e/review/shots/pilot");
(async () => {
  const b = await chromium.launch();
  for (const [name, vp, scheme] of [["desktop-light", { width: 1440, height: 1000 }, "light"], ["desktop-dark", { width: 1440, height: 1000 }, "dark"], ["phone-light", { width: 390, height: 900 }, "light"]] as const) {
    const ctx = await b.newContext({ viewport: vp, colorScheme: scheme, storageState: path.join(ROOT, "e2e/.auth/platform.json") });
    await ctx.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s); }); });
    const p = await ctx.newPage();
    const errs: string[] = []; p.on("pageerror", (e: Error) => errs.push(e.message.slice(0, 160)));
    await p.goto(`${WEB_URL}/platform/manual`, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(5000);
    await p.getByRole("button", { name: /Page 3/ }).click(); await p.waitForTimeout(1200);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    console.log(name, "overflow:", overflow, "errors:", errs.length ? errs.join(" | ") : "none", "text has product name:", await p.evaluate(() => /ActivityLane|ActivityLane/.test(document.body.innerText)));
    await p.screenshot({ path: path.join(OUT, `${name}-top.png`) });
    if (name === "desktop-light") {
      await p.getByText("The ten bookings").scrollIntoViewIfNeeded(); await p.waitForTimeout(500); await p.screenshot({ path: path.join(OUT, `${name}-bookings.png`) });
      await p.getByRole("checkbox", { name: "P1 paid" }).check(); await p.getByRole("checkbox", { name: "P1 tool" }).check();
      await p.getByText("Tracker").first().scrollIntoViewIfNeeded(); await p.waitForTimeout(500); await p.screenshot({ path: path.join(OUT, `${name}-tracker.png`) });
      console.log("verified count text:", await p.getByText(/of 10 verified/).innerText());
    }
    await ctx.close();
  }
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
