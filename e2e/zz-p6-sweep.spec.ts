import { test } from "@playwright/test";
import { NAV_GROUPS } from "../lib/nav/config";
import { statePath } from "./helpers/env";
import fs from "fs";

test.use({ storageState: statePath("platform") });
test.describe.configure({ timeout: 900_000 });

test("p6 sweep", async ({ page }) => {
  const out: any[] = [];
  let cur = "";
  const bad: Record<string, string[]> = {};
  const push = (m: string) => (bad[cur] ||= []).push(m);
  page.on("pageerror", (e) => push("pageerror: " + e.message.slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") push("console: " + m.text().slice(0, 200)); });
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("_next")) push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 150)}`); });
  const views = NAV_GROUPS.platform.flatMap((g) => g.items).filter((i) => i.view !== "auth");
  for (const v of views) {
    cur = v.view;
    const t0 = Date.now();
    await page.goto(`/platform/${v.view}`);
    await page.waitForTimeout(6000);
    const text = ((await page.locator("main").textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
    const buttons = await page.locator("main button:visible").allInnerTexts().catch(() => []);
    await page.screenshot({ path: `/private/tmp/claude-501/p6-${v.view}.png` });
    out.push({ view: v.view, ms: Date.now() - t0, textLen: text.length, text: text.slice(0, 300), buttons: buttons.map((b) => b.trim().slice(0, 30)).slice(0, 25) });
  }
  fs.writeFileSync("/private/tmp/claude-501/p6-sweep.json", JSON.stringify({ out, bad }, null, 1));
});
