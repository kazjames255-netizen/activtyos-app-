import { test } from "@playwright/test";
import fs from "node:fs";
import { NAV_GROUPS } from "../lib/nav/config";
import { statePath } from "./helpers/env";

// P1 sweep 2: settle each view, then click every non-destructive control (tabs, buttons) and record errors.
test.use({ storageState: statePath("company") });
test.describe.configure({ timeout: 1_800_000 });
const DESTRUCTIVE = /delete|remove|cancel|sign out|log ?out|archive|refund|wipe|reset|disconnect|revoke|send|publish|pay|approve|reject|decline|clear|deactivate|suspend|terminate|connect stripe|export|download|new listing|save|confirm|submit|create|add|invite/i;
test("p1 company sweep2", async ({ page }) => {
  const out: any[] = [];
  const only = process.env.VIEWS?.split(",");
  const views = NAV_GROUPS.company.flatMap((g) => g.items).filter((i) => i.view !== "auth").map((i) => i.view).filter((v) => !only || only.includes(v));
  let cur: any = null;
  page.on("pageerror", (e) => cur?.pageErrors.push(e.message));
  page.on("response", (r) => { if (r.status() >= 400 && r.url().includes("/api/")) cur?.bad.push(`${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, "")}`); });
  for (const v of views) {
    cur = { view: v, pageErrors: [], bad: [], clicked: [], notes: [] };
    const url = `/company/${v}`;
    const t0 = Date.now();
    const go = async (u: string) => { for (let i = 0; i < 3; i++) { try { await page.goto(u, { waitUntil: "commit", timeout: 60_000 }); return; } catch { await page.waitForTimeout(5000); } } };
    await go(url);
    try { await page.waitForFunction(() => { const m = document.querySelector("main"); return !!m && !/^\s*(Loading…?|Checking access…?)?\s*$/.test(m.textContent || "") && !/Loading (your )?[a-z ]*…|Loading\.\.\./i.test((m.textContent || "").slice(0, 400)); }, null, { timeout: 40_000 }); } catch { cur.notes.push("STUCK LOADING >40s: " + ((await page.locator("main").textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").slice(0, 120)); }
    cur.settleMs = Date.now() - t0;
    await page.waitForTimeout(1000);
    const labels = (await page.locator("main button:visible, main [role=tab]:visible").allTextContents()).map((s) => s.trim().replace(/\s+/g, " ")).filter((s) => s && s.length < 60 && !DESTRUCTIVE.test(s));
    const uniq = [...new Set(labels)].slice(0, 14);
    for (const l of uniq) {
      try {
        if (!page.url().includes(url)) await go(url);
        const el = page.locator("main button:visible, main [role=tab]:visible").filter({ hasText: l }).first();
        if (!(await el.count())) continue;
        await el.click({ timeout: 4000 });
        await page.waitForTimeout(900);
        cur.clicked.push(l);
        const shot = `/tmp/p1/s2-${v}-${cur.clicked.length}.png`;
        if (process.env.SHOTS) await page.screenshot({ path: shot });
        await page.keyboard.press("Escape");
        if (!page.url().includes(url)) await go(url);
      } catch (e: any) { cur.notes.push(`click "${l}" failed: ${String(e.message).split("\n")[0].slice(0, 100)}`); }
    }
    out.push(cur);
    fs.writeFileSync("/tmp/p1/sweep2.json", JSON.stringify(out, null, 1));
  }
});
