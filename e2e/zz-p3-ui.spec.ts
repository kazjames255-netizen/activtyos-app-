import { test } from "@playwright/test";
import fs from "node:fs";
const LOG = "/private/tmp/claude-501/p3ui-progress.log";
import { NAV_GROUPS } from "../lib/nav/config";
import { loadAccounts } from "./helpers/env";
import { TEST_PASSWORD } from "./helpers/accounts";
test.describe.configure({ timeout: 900_000 });
// P3 live sweep of every freelancer nav view: console/page errors, 4xx/5xx from the API, raw error text, dev-overlay issues, slow loads.
test("p3 ui sweep", async ({ page }) => {
  // stored session is stale (Firebase 400 on refresh) - sign in fresh through the real login form
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(loadAccounts().accounts.freelancer.email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/freelancer/bookings", { timeout: 60_000 });
  const views = NAV_GROUPS.freelancer.flatMap((g) => g.items).filter((i) => i.view !== "auth").map((i) => i.view);
  const out: string[] = [];
  let cur = "";
  page.on("pageerror", (e) => out.push(`[${cur}] PAGEERROR ${e.message.slice(0, 200)}`));
  page.on("console", (m) => { if (m.type() === "error") out.push(`[${cur}] CONSOLE ${m.text().slice(0, 200)}`); });
  page.on("response", (r) => { if (r.status() >= 400 && r.url().includes(":4000")) out.push(`[${cur}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/.*:4000/, "")}`); });
  for (const v of views) {
    cur = v;
    const t0 = Date.now();
    await page.goto(`/freelancer/${v}`, { timeout: 60_000 }).catch((e) => out.push(`[${v}] GOTO ${String(e).slice(0, 80)}`));
    await page.locator("main").first().waitFor({ timeout: 30_000 }).catch(() => out.push(`[${v}] NO MAIN`));
    await page.waitForTimeout(3000);
    const url = page.url();
    const txt = ((await page.locator("main").first().textContent({ timeout: 5000 }).catch(() => "")) ?? "").replace(/\s+/g, " ");
    const bad = /Application error|Something went wrong|Unhandled|Internal Server Error|\b(403|500)\b|Requires an|Couldn't load|Failed to fetch|undefined|NaN|\[object/i.exec(txt);
    const overlay = await page.locator("nextjs-portal").count().catch(() => 0);
    const line = `[${v}] ${Date.now() - t0}ms url=${url.replace(/.*:3000/, "")} len=${txt.length}${bad ? ` SUSPECT="${txt.slice(Math.max(0, bad.index - 40), bad.index + 60)}"` : ""}${overlay ? " DEVOVERLAY" : ""} :: ${txt.slice(0, 100)}`;
    fs.appendFileSync(LOG, [...out.splice(0), line].join("\n") + "\n");
  }
  fs.appendFileSync(LOG, out.join("\n") + "\nDONE\n");
});
