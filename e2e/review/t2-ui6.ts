import path from "node:path";
import { apiFetch, check, loadState, OUT, WEB_URL, TEST_PASSWORD } from "./t2-lib";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const S = loadState(); const L = S.L as Record<string, string>;
const shot = async (p: any, n: string) => { const f = path.join(OUT, `ui-${n}.png`); await p.screenshot({ path: f }); return f; };
(async () => {
  await apiFetch(`/api/listings/${L.disc}`, S.op, { method: "PUT", body: JSON.stringify({ discounts: [] }) });
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 } });
  await ctx.addInitScript(() => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st)); });
  const p = await ctx.newPage();
  await p.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(1500); await p.getByPlaceholder("you@example.com").fill(S.opEmail); await p.locator('input[type="password"]').fill(TEST_PASSWORD); if ((await p.getByPlaceholder("you@example.com").inputValue()) === S.opEmail) break; }
  await p.getByRole("button", { name: "Sign in", exact: true }).click(); await p.waitForURL((u: URL) => !u.pathname.startsWith("/login"), { timeout: 60000 }); await p.waitForTimeout(2000);
  await p.goto(`${WEB_URL}/company/listings`, { waitUntil: "load" }); await p.waitForTimeout(5000);
  await p.locator('[data-ui="card"]').filter({ hasText: "T2 Discounts" }).last().getByRole("button", { name: /^(Edit|Resume)$/ }).first().click();
  await p.getByText(/^Step 1 of 13/).waitFor({ timeout: 45000 });
  for (let i = 1; i < 9; i++) { await p.getByRole("button", { name: /^Next/ }).click(); await p.waitForTimeout(450); }
  await p.waitForTimeout(1500);
  const rules = async () => (await apiFetch<any>(`/api/listings/${L.disc}`, S.op)).discounts ?? [];
  await check("UI-S9-render", async () => { for (const t of ["Multi-person", "Multi-session", "Early bird", "How these stack"]) await p.getByText(t, { exact: false }).first().waitFor({ timeout: 8000 }); return "step 9 shows the three rule types and the stacking explanation"; }, () => shot(p, "step9-initial"));
  await check("UI-S9-early-bird-wording", async () => {
    await p.getByText("Early bird", { exact: true }).first().click(); await p.waitForTimeout(1500);
    const txt = await p.locator("body").innerText();
    const cont = (txt.match(/[^\n]*(blank|continuous|no date|any time)[^\n]*/i)?.[0] ?? "").slice(0, 170);
    if (!/blank|continuous|no date|any time|leave/i.test(txt)) throw new Error("early bird editor does not say what a blank book-by date means");
    const once = (txt.match(/[^\n]*(once per|once for|one per|once a season|per family)[^\n]*/i)?.[0] ?? "").slice(0, 170);
    return `blank-date wording: "${cont}"; fixed-£ once-per-family wording: ${once ? '"' + once + '"' : "NOT shown in the editor"}`;
  }, () => shot(p, "step9-early-editor"));
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
