import path from "node:path";
import { ROOT, WEB_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const OUT = path.join(ROOT, "e2e/review/shots/onboarding");
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s)); });
  const p = await ctx.newPage();
  await p.goto(`${WEB_URL}/signup`, { waitUntil: "load" }); await p.waitForTimeout(4000);
  const fills: Record<string, string> = { "#b-name": "Your Business Name", "#b-addr": "1 High Street, Northampton", "#b-pc": "NN1 1AA", "#b-email": "hello@yourbusiness.co.uk", "#b-phone": "07700 900123", "#i-name": "Sam Taylor" };
  for (let i = 2; i <= 6; i++) {
    await p.getByRole("button", { name: /Continue/ }).last().click().catch(() => {});
    await p.waitForTimeout(1500);
    for (const [sel, v] of Object.entries(fills)) { const el = p.locator(sel); if (await el.count()) await el.fill(v).catch(() => {}); }
    await p.waitForTimeout(800);
    await p.screenshot({ path: path.join(OUT, `01-signup-step-${i}.png`) }); console.log("signup step", i);
  }
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
