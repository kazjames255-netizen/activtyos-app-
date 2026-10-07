import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const WEB = "http://localhost:3016";
const SCRATCH = "/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/90282caf-1701-4ffc-a82d-955cde3224d8/scratchpad";
const OUT = "/Users/kazjames/Downloads/activtyos-app-/.claude/worktrees/agent-ad0f7776822163793/docs/qa-overnight/mass-bookings-shots";
const S = JSON.parse(fs.readFileSync(path.join(SCRATCH, "mb-state.json"), "utf8"));
const tag = process.argv[2] || "b";
const browser = await chromium.launch();
const out = {};
for (const [vwName, vw] of [["1440", { width: 1440, height: 900 }], ["390", { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vw });
  const page = await ctx.newPage();
  await page.goto(`${WEB}/login`);
  await page.getByPlaceholder("you@example.com").fill(S.accts.prov.email);
  await page.locator('input[type="password"]').fill("E2etest!123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/company/bookings", { timeout: 90000 });
  await page.goto(`${WEB}/company/finance`, { waitUntil: "load" });
  await page.waitForTimeout(3500);
  for (const t of ["Overview", "Revenue", "Debts", "Insights"]) {
    await page.getByRole("button", { name: t, exact: true }).first().click().catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, `${tag}-prov-finance-${t}-${vwName}.png`), fullPage: true });
    out[`finance-${t}-${vwName}`] = (await page.locator("body").innerText()).slice(0, 9000);
  }
  // dashboard
  await page.goto(`${WEB}/company/dash`, { waitUntil: "load" }); await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(OUT, `${tag}-prov-dash-${vwName}.png`), fullPage: true });
  out[`dash-${vwName}`] = (await page.locator("body").innerText()).slice(0, 9000);
  // bell
  await page.locator('button[aria-label*="otification" i]').first().click().catch(async () => { await page.locator("header button").nth(2).click().catch(() => {}); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, `${tag}-prov-bell-${vwName}.png`) });
  out[`bell-${vwName}`] = (await page.locator("body").innerText()).slice(0, 5000);
  await ctx.close();
}
fs.writeFileSync(path.join(SCRATCH, `texts-${tag}.json`), JSON.stringify(out, null, 1));
await browser.close();
console.log("done");
