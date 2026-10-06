import path from "node:path";
import { apiFetch, check, loadState, OUT, WEB_URL, TEST_PASSWORD } from "./t2-lib";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const S = loadState(); const P = S.parents as Record<string, { email: string; tok: string }>;
async function login(b: any, email: string) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 } });
  await ctx.addInitScript(() => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st)); });
  const p = await ctx.newPage(); await p.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(1500); await p.getByPlaceholder("you@example.com").fill(email); await p.locator('input[type="password"]').fill(TEST_PASSWORD); if ((await p.getByPlaceholder("you@example.com").inputValue()) === email) break; }
  await p.getByRole("button", { name: "Sign in", exact: true }).click(); await p.waitForURL((u: URL) => !u.pathname.startsWith("/login"), { timeout: 60000 }); await p.waitForTimeout(2500); return p;
}
(async () => {
  const b = await chromium.launch(); const pb = await login(b, P.b.email);
  await pb.goto(`${WEB_URL}/custdash/bookings`, { waitUntil: "load" }); await pb.waitForTimeout(6000);
  await check("UI-WAITLIST-parent-view", async () => {
    const rows = await apiFetch<any[]>("/api/my/bookings", P.b.tok);
    const wl = rows.filter((r) => /waitlist/i.test(r.status));
    if (!wl.length) throw new Error("test data has no waitlisted booking for parent B");
    const text = await pb.locator("body").innerText();
    const owes = /Pay £\d/.test(text);
    const line = (text.match(/[^\n]*Waitlist[^\n]*/i)?.[0] ?? "").slice(0, 100);
    const toPay = (text.match(/Still to pay\s*(\d+)/i) ?? [])[1];
    return `parent B has ${wl.length} waitlisted booking(s) (API amount £${wl[0].amount}); page shows "${line}"; 'Pay £' button on page: ${owes}; 'Still to pay' count: ${toPay ?? "n/a"}`;
  }, async () => { const f = path.join(OUT, "ui-waitlist-parent.png"); await pb.screenshot({ path: f }); return f; });
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
