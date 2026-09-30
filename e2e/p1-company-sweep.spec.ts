import { test } from "@playwright/test";
import fs from "node:fs";
import { NAV_GROUPS } from "../lib/nav/config";
import { statePath } from "./helpers/env";

// P1 sweep: load every company view, record page errors, console errors, failing API calls, and clickable controls.
test.use({ storageState: statePath("company") });
test.describe.configure({ timeout: 900_000 });
test("p1 company sweep", async ({ page }) => {
  const out: any[] = [];
  const views = NAV_GROUPS.company.flatMap((g) => g.items).filter((i) => i.view !== "auth").map((i) => i.view);
  let cur: any = null;
  page.on("pageerror", (e) => cur?.pageErrors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") cur?.console.push(m.text().slice(0, 200)); });
  page.on("response", (r) => { if (r.status() >= 400 && r.url().includes("/api/")) cur?.bad.push(`${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, "")}`); });
  for (const v of views) {
    cur = { view: v, pageErrors: [], console: [], bad: [] };
    const t0 = Date.now();
    await page.goto(`/company/${v}`);
    await page.waitForLoadState("load");
    await page.waitForTimeout(3500);
    cur.ms = Date.now() - t0;
    cur.text = ((await page.locator("main").textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").slice(0, 300);
    cur.buttons = await page.locator("main button:visible").allTextContents().then((a) => a.map((s) => s.trim()).filter(Boolean).slice(0, 25));
    await page.screenshot({ path: `/tmp/p1/${v}.png` });
    out.push(cur);
  }
  fs.writeFileSync("/tmp/p1/sweep.json", JSON.stringify(out, null, 1));
});
