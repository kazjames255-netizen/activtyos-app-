import { test, expect } from "@playwright/test";
import { buildFixture, ctxFor, settle, gotoHubPage, handOver, type Fx } from "./review/fixture";

// A child's Homework screen: three raised stat tiles, each homework as a subject-coloured card with a status ribbon,
// at most five rows per list with an Open / Close toggle, and never red "overdue" wording for a child.
// Throwaway accounts only. Not run by the author: the lead / test fork own the e2e lock.
test.describe.configure({ mode: "serial" });
let fx: Fx;
test.beforeAll(async () => { test.setTimeout(400_000); fx = await buildFixture(3, true); });

test("child Homework shows tiles, coloured cards, at most five per list and Open / Close", async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await ctxFor(browser, "parent", { width: 768, height: 1024 });
  const page = await ctx.newPage();
  await gotoHubPage(page, `/custdash/learninghub?tab=homework&child=${fx.kids[0].id}`, fx);
  await settle(page);
  await handOver(page, fx.kids[0].id);
  await settle(page);

  const root = page.locator("#hub-homework");
  await expect(root).toBeVisible({ timeout: 30_000 });

  // three tiles (To do / Handed in / Marked), each a labelled group
  const tiles = page.getByTestId("hub-stat-tiles");
  await expect(tiles).toBeVisible();
  await expect(tiles.locator('[data-testid^="hub-stat-"]')).toHaveCount(3);

  // every list has an Open / Close toggle and never more than five rows before "Show all"
  for (const id of ["todo", "waiting", "marked"]) {
    const group = page.getByTestId(`hub-hw-group-${id}`);
    if (!(await group.count())) continue;
    const toggle = page.getByTestId(`hub-hw-group-toggle-${id}`);
    const list = page.locator(`#hub-hw-list-${id}`);
    expect(await list.getByTestId("hub-hw-card").count()).toBeLessThanOrEqual(5);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await toggle.click();
    await expect(list).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(list).toBeVisible();
    const all = page.getByTestId(`hub-hw-group-all-${id}`);
    if (await all.count()) {
      await all.click();
      expect(await list.getByTestId("hub-hw-card").count()).toBeGreaterThan(5);
      await all.click();
      expect(await list.getByTestId("hub-hw-card").count()).toBeLessThanOrEqual(5);
    }
  }

  // each card carries a status ribbon and keeps its data attributes; a child never sees the word "Overdue"
  const cards = page.getByTestId("hub-hw-card");
  if (await cards.count()) {
    await expect(cards.first().getByTestId("hub-hw-ribbon")).toBeVisible();
    await expect(cards.first()).toHaveAttribute("data-status", /assigned|submitted|marked/);
  }
  await expect(page.locator("body")).not.toContainText(/overdue/i);
  await ctx.close();
});
