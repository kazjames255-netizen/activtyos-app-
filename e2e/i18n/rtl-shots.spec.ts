import fs from "node:fs";
import { test } from "@playwright/test";
import { loadAccounts, statePath, type Role } from "../helpers/env";

// Screenshots of key screens in a chosen locale (default ar) for a human look at RTL layout. RTL_LOCALE=ar RTL_OUT=/tmp/rtl-shots. Read-only.
const LOC = process.env.RTL_LOCALE ?? "ar"; const OUT = process.env.RTL_OUT ?? "/tmp/rtl-shots";
const SHOTS: { role: Role | null; path: string; name: string }[] = [
  { role: null, path: "/login", name: "login" }, { role: null, path: "/signup", name: "signup" }, { role: null, path: "/how-it-works", name: "how" },
  { role: "company", path: "/company/dash", name: "company-dash" }, { role: "company", path: "/company/bookings", name: "company-bookings" },
  { role: "company", path: "/company/blocks", name: "company-blocks" }, { role: "company", path: "/company/schedule", name: "company-schedule" },
  { role: "company", path: "/company/setup", name: "company-setup" }, { role: "parent", path: "/custdash/children", name: "parent-children" },
  { role: "parent", path: "/custdash/browse", name: "parent-browse" },
];
for (const w of [1280, 390]) test(`rtl shots ${LOC} ${w}`, async ({ browser }) => {
  test.setTimeout(900_000); fs.mkdirSync(OUT, { recursive: true });
  for (const s of SHOTS) {
    const ctx = await browser.newContext({ storageState: s.role ? statePath(s.role) : undefined, viewport: { width: w, height: 900 } });
    await ctx.addCookies([{ name: "aos.locale", value: LOC, url: process.env.E2E_BASE_URL || "http://localhost:3000" }]);
    await ctx.addInitScript((l) => { try { localStorage.setItem("aos.locale", l); } catch { /* */ } }, LOC);
    const page = await ctx.newPage();
    await page.goto(s.path, { waitUntil: "load" }).catch(() => undefined); await page.waitForTimeout(3000);
    if (s.role && /\/login/.test(page.url())) { // a stored state that has gone signed out: sign in through the real form
      const acc = loadAccounts(); const a = acc.accounts[s.role];
      await page.locator('input[type="email"]').first().fill(a.email); await page.locator('input[type="password"]').first().fill(acc.password);
      await page.locator('button[type="submit"]').first().click(); await page.waitForTimeout(6000);
      await page.goto(s.path, { waitUntil: "load" }).catch(() => undefined);
    }
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/${LOC}-${s.name}-${w}.png` }).catch(() => undefined);
    await ctx.close();
  }
});
