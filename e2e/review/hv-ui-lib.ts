import { SHOTS, load, em } from "./hv-lib";
import { TEST_PASSWORD } from "../helpers/accounts";
import { WEB_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
export const results: { id: string; ok: boolean; note: string; shot?: string }[] = [];
export const rec = (id: string, ok: boolean, note: string, shot?: string) => { results.push({ id, ok, note, shot }); console.log(`${ok ? "PASS" : "FAIL"} ${id} ${note}${shot ? " [" + shot + "]" : ""}`); };
export async function login(browser: any, email: string, vp = { width: 1440, height: 1000 }) {
  const ctx = await browser.newContext({ viewport: vp });
  await ctx.addInitScript(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s)); });
  const page = await ctx.newPage();
  await page.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(1500); await page.getByPlaceholder("you@example.com").fill(email); await page.locator('input[type="password"]').fill(TEST_PASSWORD); await page.waitForTimeout(300); if ((await page.getByPlaceholder("you@example.com").inputValue()) === email) break; }
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((u: URL) => !u.pathname.startsWith("/login"), { timeout: 90_000 });
  await page.waitForTimeout(2500);
  return { ctx, page };
}
export const shot = async (page: any, name: string, full = false) => { await page.waitForTimeout(1200); const f = `${SHOTS}/${name}.png`; await page.screenshot({ path: f, fullPage: full }); return f.replace("/Users/kazjames/Downloads/activtyos-app-/", ""); };
export const go = async (page: any, p: string) => { await page.goto(`${WEB_URL}${p}`, { waitUntil: "load", timeout: 120_000 }).catch(() => {}); await page.waitForTimeout(4500); };
export { load, WEB_URL };
