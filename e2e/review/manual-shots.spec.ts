import { test } from "@playwright/test";
import { statePath } from "../helpers/env";
test.use({ storageState: statePath("platform") });
for (const [name, w, h] of [["desktop", 1440, 900], ["mobile", 390, 844]] as const)
  for (const scheme of ["light", "dark"] as const)
    test(`manual ${name} ${scheme}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/platform/manual");
      await page.getByText("Provider onboarding").first().waitFor({ timeout: 30000 });
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      console.log(name, scheme, "overflow px:", over);
      await page.waitForTimeout(800);
      const h2 = await page.evaluate(() => {
        let best = 0;
        document.querySelectorAll("*").forEach((e) => { if (e.scrollHeight > e.clientHeight + 50 && getComputedStyle(e).overflowY !== "visible") best = Math.max(best, e.scrollHeight); });
        return Math.max(best, document.documentElement.scrollHeight);
      });
      await page.setViewportSize({ width: w, height: Math.min(h2 + 120, 16000) });
      await page.waitForTimeout(600);
      await page.screenshot({ path: `e2e/review/shots/manual/${name}-${scheme}.png`, fullPage: true });
    });
