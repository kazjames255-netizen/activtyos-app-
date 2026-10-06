import { test } from "@playwright/test";
import { NAV_GROUPS } from "../lib/nav/config";
import { statePath } from "./helpers/env";
const SHOTS = "/private/tmp/claude-501/p3";
test.use({ storageState: statePath("freelancer") });
test.describe.configure({ timeout: 900_000 });
test("p3 passive sweep", async ({ page }) => {
  const views = NAV_GROUPS.freelancer.flatMap((g) => g.items).filter((i) => i.view !== "auth").map((i) => i.view);
  const out: string[] = [];
  let cur = "";
  page.on("pageerror", (e) => out.push(`[${cur}] PAGEERROR ${e.message.slice(0, 200)}`));
  page.on("console", (m) => { if (m.type() === "error") out.push(`[${cur}] CONSOLE ${m.text().slice(0, 200)}`); });
  page.on("response", (r) => { if (r.status() >= 400 && r.url().includes(":4000")) out.push(`[${cur}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/.*:4000/, "")}`); });
  for (const v of views) {
    cur = v;
    const t0 = Date.now();
    await page.goto(`/freelancer/${v}`);
    await page.waitForTimeout(3500);
    const txt = ((await page.locator("main").textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
    out.push(`[${v}] ${Date.now() - t0}ms len=${txt.length} :: ${txt.slice(0, 140)}`);
    await page.screenshot({ path: `${SHOTS}/${v}.png`, fullPage: false });
  }
  console.log("\n" + out.join("\n"));
});
