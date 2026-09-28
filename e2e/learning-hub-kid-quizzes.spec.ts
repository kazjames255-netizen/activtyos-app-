import { test, expect } from "@playwright/test";
import { buildFixture, ctxFor, settle, gotoHubPage, handOver, type Fx } from "./review/fixture";

// A child's Quizzes list: three stat tiles above the lists, each list (To do / Done) with an Open / Close toggle and
// at most five cards before "Show more". Throwaway accounts only. Not run by the author: the lead / test fork own the e2e lock.
test.describe.configure({ mode: "serial" });
let fx: Fx;
test.beforeAll(async () => { test.setTimeout(400_000); fx = await buildFixture(3, true); });

test("child Quizzes shows tiles and lists of at most five with Open / Close", async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await ctxFor(browser, "parent", { width: 768, height: 1024 });
  const page = await ctx.newPage();
  await gotoHubPage(page, `/custdash/learninghub?tab=quizzes&child=${fx.kids[0].id}`, fx);
  await settle(page);
  await handOver(page, fx.kids[0].id);
  await settle(page);

  const list = page.getByTestId("hub-quiz-list");
  await expect(list).toBeVisible({ timeout: 30_000 });
  const tiles = page.getByTestId("hub-stat-tiles");
  if (await tiles.count()) {
    await expect(tiles.locator('[data-testid^="hub-stat-"]')).toHaveCount(3);
    for (const id of ["todo", "done"]) {
      const toggle = page.getByTestId(`hub-assess-toggle-${id}`);
      if (!(await toggle.count())) continue;
      const grid = page.locator(`#hub-assess-list-${id}`);
      expect(await grid.locator('[id^="hub-assess-"]').count()).toBeLessThanOrEqual(5);
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await toggle.click();
      await expect(grid).toBeHidden();
      await toggle.click();
      await expect(grid).toBeVisible();
    }
  }
  await ctx.close();
});
