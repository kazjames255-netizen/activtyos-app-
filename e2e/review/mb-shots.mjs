// Screenshots (1440 + 390) + page text of the key screens for the mass-bookings QA. Own stack web :3016 only.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const WEB = "http://localhost:3016";
const SCRATCH = "/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/90282caf-1701-4ffc-a82d-955cde3224d8/scratchpad";
const OUT = process.env.MB_SHOTS || "/Users/kazjames/Downloads/activtyos-app-/.claude/worktrees/agent-ad0f7776822163793/docs/qa-overnight/mass-bookings-shots";
fs.mkdirSync(OUT, { recursive: true });
const S = JSON.parse(fs.readFileSync(path.join(SCRATCH, "mb-state.json"), "utf8"));
const PW = "E2etest!123";
const tag = process.argv[2] || "a";
const only = process.argv[3];

async function login(browser, email, landing, vw) {
  const ctx = await browser.newContext({ viewport: vw });
  const page = await ctx.newPage();
  await page.goto(`${WEB}/login`);
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(`**${landing}`, { timeout: 90000 });
  return { ctx, page };
}
const texts = {};
async function shoot(page, name, url, vwName, wait = 2500) {
  await page.goto(`${WEB}${url}`, { waitUntil: "load" });
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(OUT, `${tag}-${name}-${vwName}.png`), fullPage: true });
  texts[`${name}-${vwName}`] = (await page.locator("body").innerText()).slice(0, 12000);
}
const browser = await chromium.launch();
for (const [vwName, vw] of [["1440", { width: 1440, height: 900 }], ["390", { width: 390, height: 844 }]]) {
  if (!only || only === "prov") {
    const { ctx, page } = await login(browser, S.accts.prov.email, "/company/bookings", vw);
    await shoot(page, "prov-bookings", "/company/bookings", vwName);
    await shoot(page, "prov-finance", "/company/finance", vwName, 4000);
    await shoot(page, "prov-reconciliation", "/company/reconciliation", vwName, 3500);
    await shoot(page, "prov-registers", "/company/admin-registers", vwName, 3500);
    await shoot(page, "prov-listings", "/company/listings", vwName, 3000);
    await shoot(page, "prov-home", "/company/dash", vwName, 3500).catch(() => {});
    await ctx.close();
  }
  if (!only || only === "par") {
    const { ctx, page } = await login(browser, S.accts.parent.email, "/custdash/home", vw);
    await shoot(page, "par-home", "/custdash/home", vwName, 3000);
    await shoot(page, "par-bookings", "/custdash/bookings", vwName, 3500);
    await ctx.close();
  }
  if (!only || only === "pub") {
    const ctx = await browser.newContext({ viewport: vw });
    const page = await ctx.newPage();
    for (const k of ["camp", "addons", "term", "home", "online", "sibling", "multiday", "oneoff", "passes"]) await shoot(page, `pub-${k}`, `/book/${S.listings[k].id}`, vwName, 3000);
    await ctx.close();
  }
}
fs.writeFileSync(path.join(SCRATCH, `texts-${tag}.json`), JSON.stringify(texts, null, 1));
await browser.close();
console.log("done", Object.keys(texts).length);
