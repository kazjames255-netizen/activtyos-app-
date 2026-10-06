import path from "node:path";
import { apiFetch, check, loadState, OUT, WEB_URL, TEST_PASSWORD } from "./t2-lib";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const S = loadState(); const L = S.L as Record<string, string>; const P = S.parents as Record<string, { email: string }>;
const shot = async (p: any, name: string) => { const f = path.join(OUT, `ui-${name}.png`); await p.screenshot({ path: f }); return f; };
async function login(b: any, email: string, w = 1440, h = 1000) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(() => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st)); });
  const p = await ctx.newPage();
  await p.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(1500); await p.getByPlaceholder("you@example.com").fill(email); await p.locator('input[type="password"]').fill(TEST_PASSWORD); if ((await p.getByPlaceholder("you@example.com").inputValue()) === email) break; }
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForURL((u: URL) => !u.pathname.startsWith("/login"), { timeout: 60_000 }); await p.waitForTimeout(2500);
  return p;
}
(async () => {
  const b = await chromium.launch();
  const op = await login(b, S.opEmail);
  // ---- wizard step 3 on the per-day listing ----
  await op.goto(`${WEB_URL}/company/listings`, { waitUntil: "load" }); await op.waitForTimeout(5000);
  const card = op.locator('[data-ui="card"]').filter({ hasText: "T2 PerDay" }).last();
  await card.getByRole("button", { name: /^(Edit|Resume)$/ }).first().click();
  await op.getByText(/^Step 1 of 13/).waitFor({ timeout: 45_000 });
  await op.getByRole("button", { name: /^Next/ }).click(); await op.waitForTimeout(500); await op.getByRole("button", { name: /^Next/ }).click(); await op.waitForTimeout(1200);
  await check("UI-S3-render", async () => {
    for (const t of [/Allow children outside this age range/, /Maximum attendees/i, /Show remaining spaces/, /Age from/i, /Age to/i, /Limit places by age group|Set age caps/]) await op.getByText(t).first().waitFor({ timeout: 8000 });
    return "step 3 shows age range, out-of-range question, maximum attendees (per day / whole listing), show spaces, age caps";
  }, () => shot(op, "step3-initial"));
  const api = async () => (await apiFetch<any>(`/api/listings/${L.day}`, S.op));
  await check("UI-S3-toggles-save", async () => {
    await op.getByRole("button", { name: "Yes", exact: true }).first().click();            // allow out of range
    await op.getByRole("button", { name: "Whole listing" }).click();                      // scope
    const cap = op.locator('input[type="number"]').nth(2); await cap.fill("12");           // max attendees (after age from/to)
    await op.getByRole("button", { name: "No", exact: true }).last().click();              // hide spaces
    await op.waitForTimeout(500);
    await op.getByRole("button", { name: /^Save (draft|changes)$/ }).first().click(); await op.waitForTimeout(3500);
    const d = await api();
    if (d.status !== "live") throw new Error(`BUG: pressing the top-right Save button on a LIVE listing changed its status to "${d.status}" (parents can no longer book)`);
    const got = { allowOutOfRange: d.allowOutOfRange, scope: d.capacityScope, max: d.maxAttendees, show: d.showSpaces };
    if (!(got.allowOutOfRange === true && got.scope === "listing" && String(got.max) === "12" && got.show === false)) throw new Error("saved values do not match what was clicked: " + JSON.stringify(got));
    return "clicked Yes / Whole listing / 12 / No spaces -> saved " + JSON.stringify(got);
  }, () => shot(op, "step3-changed"));
  // restore
  await apiFetch(`/api/listings/${L.day}`, S.op, { method: "PUT", body: JSON.stringify({ allowOutOfRange: false, capacityScope: "day", maxAttendees: "10", showSpaces: true }) });
  await op.close();
  // ---- parent pages: spaces left shown / hidden ----
  const pa = await login(b, P.a.email);
  await check("UI-SPACES-shown", async () => {
    await pa.goto(`${WEB_URL}/book/${L.day}`, { waitUntil: "load" }); await pa.waitForTimeout(5000);
    const t = await pa.locator("body").innerText();
    if (!/\d+\s*(spaces?|places?)\s*left|left/i.test(t)) throw new Error("no 'spaces left' text on the parent page although showSpaces is on");
    return "parent page shows spaces left: " + (t.match(/[^\n]*left[^\n]*/i)?.[0] ?? "").slice(0, 80);
  }, () => shot(pa, "parent-spaces-shown"));
  await check("UI-SPACES-hidden", async () => {
    await pa.goto(`${WEB_URL}/book/${L.hide}`, { waitUntil: "load" }); await pa.waitForTimeout(5000);
    const t = await pa.locator("body").innerText();
    if (/\d+\s*(spaces?|places?)\s*left/i.test(t)) throw new Error("showSpaces is OFF but the parent page still says: " + (t.match(/[^\n]*\d+\s*(spaces?|places?)\s*left[^\n]*/i)?.[0] ?? ""));
    return "no 'N spaces left' on the parent page when showSpaces is off";
  }, () => shot(pa, "parent-spaces-hidden"));
  await pa.close();
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
