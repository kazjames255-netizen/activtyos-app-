import path from "node:path";
import { apiFetch, check, loadState, OUT, WEB_URL, TEST_PASSWORD } from "./t2-lib";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const S = loadState(); const L = S.L as Record<string, string>;
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 } });
  const p = await ctx.newPage();
  await p.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(1500); await p.getByPlaceholder("you@example.com").fill(S.opEmail); await p.locator('input[type="password"]').fill(TEST_PASSWORD); if ((await p.getByPlaceholder("you@example.com").inputValue()) === S.opEmail) break; }
  await p.getByRole("button", { name: "Sign in", exact: true }).click(); await p.waitForURL((u: URL) => !u.pathname.startsWith("/login"), { timeout: 60000 }); await p.waitForTimeout(2500);
  await p.goto(`${WEB_URL}/company/listings`, { waitUntil: "load" }); await p.waitForTimeout(6000);
  for (const [key, title] of [["day", "T2 PerDay"], ["whole", "T2 Whole"], ["disc", "T2 Discounts"]] as const) {
    await check(`UI-CARD-${key}`, async () => {
      const d = await apiFetch<any>(`/api/listings/${L[key]}`, S.op);
      const booked = d.blocks.reduce((s: number, bl: any) => s + (bl.capacity - bl.spotsLeft), 0);
      const cap = d.blocks.reduce((s: number, bl: any) => s + bl.capacity, 0);
      const txt = (await p.locator('[data-ui="card"]').filter({ hasText: title }).last().innerText()).replace(/\n+/g, " | ");
      const m = /(\d+) of (\d+) booked/.exec(txt);
      if (!m) throw new Error("card has no 'N of M booked': " + txt.slice(0, 160));
      if (Number(m[1]) !== booked || Number(m[2]) !== cap) throw new Error(`card says ${m[1]} of ${m[2]} booked, API says ${booked} of ${cap} (sum over blocks of capacity-spotsLeft)`);
      return `card "${m[0]}" matches API (${booked} booked of ${cap}); scope ${d.blocks[0].capacityScope}; text: ${(txt.match(/\d+ left[^|]*/)?.[0] ?? "")}`;
    }, async () => { const f = path.join(OUT, `ui-card-${key}.png`); await p.locator('[data-ui="card"]').filter({ hasText: title }).last().screenshot({ path: f }); return f; });
  }
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
