import fs from "node:fs";
import path from "node:path";
import { ROOT, WEB_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const admin = require("/Users/kazjames/Downloads/activtyos-app-/server/node_modules/firebase-admin");
export const OUT = path.join(ROOT, "e2e/review/shots/onbtest");
fs.mkdirSync(OUT, { recursive: true });
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require("/Users/kazjames/Downloads/activtyos-app-/server/serviceAccountKey.json")) });
export const db = admin.firestore();
export const RES = path.join(OUT, "results.json");
export const results: { id: string; ok: boolean; note: string }[] = fs.existsSync(RES) ? JSON.parse(fs.readFileSync(RES, "utf8")) : [];
export function check(id: string, ok: boolean, note = "") {
  const i = results.findIndex((r) => r.id === id); const r = { id, ok, note };
  if (i >= 0) results[i] = r; else results.push(r);
  fs.writeFileSync(RES, JSON.stringify(results, null, 1));
  console.log(ok ? "PASS" : "FAIL", id, note);
}
export const accounts: { email: string; tenantId?: string; kind: string }[] = [];
export const ACC = path.join(OUT, "accounts.json");
export function saveAcc(a: { email: string; tenantId?: string; kind: string }) {
  const all = fs.existsSync(ACC) ? JSON.parse(fs.readFileSync(ACC, "utf8")) : []; all.push(a); fs.writeFileSync(ACC, JSON.stringify(all, null, 1));
}
export async function newCtx(browser: any, w = 1440, h = 900) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s)); });
  return ctx;
}
let n = 0;
export async function shot(page: any, name: string) { await page.waitForTimeout(1200); await page.screenshot({ path: path.join(OUT, `${name}.png`) }); }
export async function go(page: any, p: string, wait = 4000) { await page.goto(`${WEB_URL}${p}`, { waitUntil: "load", timeout: 120_000 }).catch(() => {}); await page.waitForTimeout(wait); }
export const body = async (page: any) => (await page.locator("body").innerText().catch(() => "")) as string;
import { TEST_PASSWORD } from "../helpers/accounts";
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
