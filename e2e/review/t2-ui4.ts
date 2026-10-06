import path from "node:path";
import { apiFetch, check, loadState, OUT, WEB_URL, TEST_PASSWORD } from "./t2-lib";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const S = loadState();
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 1500 } }); const p = await ctx.newPage();
  await p.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(1500); await p.getByPlaceholder("you@example.com").fill(S.opEmail); await p.locator('input[type="password"]').fill(TEST_PASSWORD); if ((await p.getByPlaceholder("you@example.com").inputValue()) === S.opEmail) break; }
  await p.getByRole("button", { name: "Sign in", exact: true }).click(); await p.waitForURL((u: URL) => !u.pathname.startsWith("/login"), { timeout: 60000 });
  await p.goto(`${WEB_URL}/company`, { waitUntil: "load" }); await p.waitForTimeout(7000);
  await check("UI-DASH-numbers", async () => {
    const rows = await apiFetch<any[]>("/api/bookings", S.op);
    const live = rows.filter((r) => !/cancel|declin/i.test(r.status));
    const waiting = rows.filter((r) => /waitlist/i.test(r.status)).length;
    const txt = await p.locator("body").innerText();
    const nums = (txt.match(/[^\n]*(booking|waiting|Waitlist|place)[^\n]*/gi) ?? []).slice(0, 8).map((x) => x.trim().slice(0, 70));
    return `API: ${rows.length} booking rows (${live.length} not cancelled/declined, ${waiting} waitlisted). Dashboard lines: ${JSON.stringify(nums)}`;
  }, async () => { const f = path.join(OUT, "ui-dashboard.png"); await p.screenshot({ path: f }); return f; });
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
