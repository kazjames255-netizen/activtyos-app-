import { test, expect } from "@playwright/test";
import { buildFixture, ctxFor, settle, gotoHubPage, handOver, type Fx } from "./review/fixture";

// The colourful child Home (stat tiles, "My to-do list", "My week" capsules) exists for the Year 3-6 band only.
// KS1 keeps nothing under the big card, and Year 7+ keeps its plain list. Throwaway accounts only.
// Not run by the author: the lead / test fork own the e2e lock.
test.describe.configure({ mode: "serial" });
let fx: Fx;
test.beforeAll(async () => { test.setTimeout(400_000); fx = await buildFixture(3, true); });

test("child Home shows only what its age band allows", async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await ctxFor(browser, "parent", { width: 768, height: 1024 });
  const page = await ctx.newPage();
  await gotoHubPage(page, `/custdash/learninghub?tab=home&child=${fx.kids[0].id}`, fx);
  await settle(page);
  await handOver(page, fx.kids[0].id);
  await settle(page);
  const kid = page.getByTestId("hub-home-kid");
  await expect(kid).toBeVisible({ timeout: 30_000 });
  const band = await kid.getAttribute("data-band");
  const tiles = page.getByTestId("hub-stat-tiles");
  const todo = page.getByTestId("hub-kid-todo");
  const week = page.getByRole("group", { name: /my week/i });
  if (band === "ks2") {
    await expect(tiles).toBeVisible();
    await expect(tiles.getByRole("button").or(tiles.locator("[data-testid]")).first()).toBeVisible();
    await expect(week).toBeVisible();
    // never more than five to-do rows, and never a red "overdue" wording for a child
    if (await todo.count()) {
      expect(await page.getByTestId("hub-kid-todo-row").count()).toBeLessThanOrEqual(5);
      const toggle = page.getByTestId("hub-kid-todo-toggle");
      if (await toggle.count()) {
        await toggle.click();
        await expect(page.locator("#hub-kid-todo-rows")).toBeHidden();
        await toggle.click();
        await expect(page.locator("#hub-kid-todo-rows")).toBeVisible();
      }
    }
    await expect(page.locator("body")).not.toContainText(/overdue|handed in late/i);
  } else {
    // KS1 and Year 7+: none of the new colourful parts
    await expect(tiles).toHaveCount(0);
    await expect(week).toHaveCount(0);
    await expect(todo).toHaveCount(0);
  }
  await ctx.close();
});
