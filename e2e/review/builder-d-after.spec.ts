import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { ROOT } from "../helpers/env";
import { buildFixture, ctxFor, settle, gotoHubPage, handOver, type Fx } from "./fixture";

// Builder D (P-03/P-04/P-13) after-screenshots at 390 and 768 + assertions. Throwaway accounts only.
const OUT = path.join(ROOT, "docs/teaching-hub-review/screenshots/after");
test.describe.configure({ mode: "serial" });
let fx: Fx;
test.beforeAll(async () => { test.setTimeout(400_000); fx = await buildFixture(3, true); });

for (const [vpName, vp] of [["390", { width: 390, height: 844 }], ["768", { width: 768, height: 1024 }]] as const) {
  test(`parent + kid @${vpName}`, async ({ browser }) => {
    test.setTimeout(600_000);
    const ctx = await ctxFor(browser, "parent", vp);
    const page = await ctx.newPage();
    const shot = async (dir: string, name: string) => { fs.mkdirSync(path.join(OUT, dir), { recursive: true }); await page.screenshot({ path: path.join(OUT, dir, `${name}-${vpName}.png`), fullPage: true }); };
    await gotoHubPage(page, `/custdash/learninghub?tab=home&child=${fx.kids[0].id}`, fx);
    await settle(page);
    await expect(page.getByTestId("hub-parent-verdict")).toBeVisible({ timeout: 30_000 });
    await shot("parent", "home-verdict");
    await handOver(page, fx.kids[0].id);
    await settle(page);
    await expect(page.getByTestId("hub-kid-next")).toBeVisible({ timeout: 30_000 });
    const box = await page.getByTestId("hub-kid-next").boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(96);
    const go = page.getByTestId("hub-kid-go");
    if (await go.count()) expect((await go.boundingBox())!.height).toBeGreaterThanOrEqual(56);
    await expect(page.getByText(/streak|Mastery snapshot/i)).toHaveCount(0);
    expect((await page.getByRole("tab").allInnerTexts()).join("|")).not.toMatch(/Progress|Live lessons|How I/);
    await shot("kid", "home");
    await page.getByRole("tab", { name: /Homework/ }).click();
    await settle(page);
    await expect(page.locator("body")).not.toContainText(/overdue|handed in late/i);
    await shot("kid", "homework");
    await page.goto(`/custdash/learninghub?tab=dashboard&child=${fx.kids[0].id}`);
    await settle(page);
    await expect(page.locator("#learning-hub")).toHaveAttribute("data-kid", "1");
    await page.waitForTimeout(1500);
    await shot("kid", "progress-stars");
    await ctx.close();
  });
}
