import fs from "node:fs";
import path from "node:path";
import { ROOT, WEB_URL } from "../helpers/env";
import { TEST_PASSWORD } from "../helpers/accounts";
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const admin = require("/Users/kazjames/Downloads/activtyos-app-/server/node_modules/firebase-admin");
export const OUT = path.join(ROOT, "e2e/review/shots/st4");
fs.mkdirSync(OUT, { recursive: true });
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require("/Users/kazjames/Downloads/activtyos-app-/server/serviceAccountKey.json")) });
export const db = admin.firestore();
export const STATE = path.join(OUT, "state.json");
export const loadState = (): any => (fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : {});
export const saveState = (s: any) => fs.writeFileSync(STATE, JSON.stringify(s, null, 1));
export const RES = path.join(OUT, "results.json");
export function check(id: string, ok: boolean, note = "", shotName = "") {
  const all: any[] = fs.existsSync(RES) ? JSON.parse(fs.readFileSync(RES, "utf8")) : [];
  const r = { id, ok, note, shot: shotName };
  const i = all.findIndex((x) => x.id === id); if (i >= 0) all[i] = r; else all.push(r);
  fs.writeFileSync(RES, JSON.stringify(all, null, 1));
  console.log(ok ? "PASS" : "FAIL", id, note);
}
export async function newCtx(browser: any, w = 1440, h = 900) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s)); });
  return ctx;
}
export async function shot(page: any, name: string) { await page.waitForTimeout(1200); await page.screenshot({ path: path.join(OUT, `${name}.png`) }); return `e2e/review/shots/st4/${name}.png`; }
export async function go(page: any, p: string, wait = 4000) { await page.goto(`${WEB_URL}${p}`, { waitUntil: "load", timeout: 120_000 }).catch(() => {}); await page.waitForTimeout(wait); }
export const body = async (page: any) => (await page.locator("body").innerText().catch(() => "")) as string;
export async function login(page: any, email: string) {
  await go(page, "/login", 3000);
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(1200);
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.waitForTimeout(300);
    if ((await page.getByPlaceholder("you@example.com").inputValue()) === email) break;
  }
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((u: URL) => !u.pathname.startsWith("/login"), { timeout: 90_000 });
  await page.waitForTimeout(3500);
}
/** Opens a listing's wizard at the given step (1-based), retrying if the dev server reloads the page mid-way. */
export async function openWizard(page: any, base: string, title: string, step: number) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await go(page, `${base}/listings`);
      await page.getByText(title).first().waitFor({ timeout: 60000 });
      const card = page.locator('[data-ui="card"]').filter({ hasText: title }).last();
      await card.getByRole("button", { name: /^(Edit|Resume)$/ }).first().click();
      await page.getByText(/^Step 1 of 13/).waitFor({ timeout: 45000 });
      for (let n = 1; n < step; n++) { await page.getByRole("button", { name: /^Next/ }).click({ timeout: 15000 }); await page.waitForTimeout(450); }
      await page.waitForTimeout(2500);
      return;
    } catch (e) { console.log("openWizard retry", attempt, String(e).slice(0, 80)); }
  }
  throw new Error("could not open wizard");
}
