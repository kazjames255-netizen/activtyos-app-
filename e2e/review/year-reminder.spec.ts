import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { ROOT } from "../helpers/env";
import { apiFetch, fbSignIn } from "../helpers/accounts";
import { HUB, buildFixture, ctxFor, gotoHubPage, settle, VIEWPORTS, type Fx } from "./fixture";

// September year-group reminder (docs/teaching-hub-review/07-changes/P-year-reminder.md). The date is pinned with page.clock.
// Fixture: kid 0 = Year 5 by hand, kid 1 = Year 6 by hand, kid 2 = automatic (must never be listed). Sends no email/notification.
//   npx playwright test -c playwright.review.config.ts e2e/review/year-reminder.spec.ts --workers=1
const OUT = path.join(ROOT, "docs/teaching-hub-review/screenshots/after/year-reminder");
test.describe.configure({ mode: "serial" });
let fx: Fx; let tok: string;
type Row = { childId: string; yearGroup: string | null; yearGroupAuto: boolean };
const rows = () => apiFetch<Row[]>(`${HUB}/students`, tok);
const year = async (i: number) => (await rows()).find((r) => r.childId === fx.kids[i].id)?.yearGroup ?? null;
const put = (i: number, body: object) => apiFetch(`${HUB}/students/${fx.kids[i].id}`, tok, { method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

test.beforeAll(async () => {
  test.setTimeout(400_000);
  fx = await buildFixture(3, false);
  tok = (await fbSignIn(fx.accounts.freelancer.email)).idToken;
  await put(0, { yearGroup: "Year 5" }); await put(1, { yearGroup: "Year 6" }); await put(2, { yearGroupAuto: true });
});

test("shows in September, lists only manual students, move up, undo, all done", async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await ctxFor(browser, "freelancer", VIEWPORTS["1440"]);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-10T10:00:00"));
  await gotoHubPage(page, "/freelancer/learninghub?tab=home", fx);
  await settle(page);
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("hub.yearReminder")) localStorage.removeItem(k); });
  await page.reload(); await settle(page);
  const card = page.getByTestId("year-reminder");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText("year group set by hand");
  await page.screenshot({ path: path.join(OUT, "card-1440.png") });

  await card.getByRole("button", { name: "Review year groups" }).click();
  const dlg = page.getByRole("dialog", { name: "Review year groups" });
  await expect(dlg.locator("[data-year-row]")).toHaveCount(2);
  await expect(dlg.locator(`[data-year-row="${fx.kids[0].id}"]`)).toContainText("Year 5 → Year 6");
  await expect(dlg.locator(`[data-year-row="${fx.kids[2].id}"]`)).toHaveCount(0);
  await page.screenshot({ path: path.join(OUT, "dialog-1440.png") });

  await dlg.getByRole("button", { name: /^Move .* up to Year 6$/ }).first().click();
  await expect(dlg.locator(`[data-year-row="${fx.kids[0].id}"]`)).toContainText("Year 6 ✓");
  await expect.poll(() => year(0), { timeout: 20_000 }).toBe("Year 6");
  await dlg.getByRole("button", { name: /^Undo / }).click();
  await expect(dlg.locator(`[data-year-row="${fx.kids[0].id}"]`)).toContainText("Year 5 → Year 6");
  await expect.poll(() => year(0), { timeout: 20_000 }).toBe("Year 5");

  // Move all: one confirm naming the count, then Undo restores both
  await dlg.getByRole("button", { name: /Move all up a year/ }).click();
  await expect(dlg).toContainText("Move 2 students up a year?");
  await dlg.getByRole("button", { name: "Yes, move 2 up" }).click();
  await expect(page.getByTestId("year-undo")).toBeVisible();
  await expect.poll(() => year(0), { timeout: 20_000 }).toBe("Year 6"); await expect.poll(() => year(1), { timeout: 20_000 }).toBe("Year 7"); expect(await year(2)).not.toBeNull();
  await page.getByTestId("year-undo").getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => year(1), { timeout: 20_000 }).toBe("Year 6");
  await expect.poll(() => year(0), { timeout: 20_000 }).toBe("Year 5");
  await page.screenshot({ path: path.join(OUT, "undone-1440.png") });

  await dlg.getByRole("button", { name: "All done" }).click();
  await expect(card).toHaveCount(0);
  await page.reload(); await settle(page);
  await expect(page.getByTestId("year-reminder")).toHaveCount(0);
  await ctx.close();
});

test("hidden outside the window", async ({ browser }) => {
  const ctx = await ctxFor(browser, "freelancer", VIEWPORTS["1440"]);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-06-10T10:00:00"));
  await gotoHubPage(page, "/freelancer/learninghub?tab=home", fx);
  await settle(page);
  await expect(page.getByTestId("year-reminder")).toHaveCount(0);
  await ctx.close();
});

test("mobile card and dialog", async ({ browser }) => {
  const ctx = await ctxFor(browser, "freelancer", VIEWPORTS["390"]);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-10T10:00:00"));
  await gotoHubPage(page, "/freelancer/learninghub?tab=home", fx);
  await settle(page);
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("hub.yearReminder")) localStorage.removeItem(k); });
  await page.reload(); await settle(page);
  await expect(page.getByTestId("year-reminder")).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: path.join(OUT, "card-390.png") });
  await page.getByRole("button", { name: "Review year groups" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "dialog-390.png") });
  await ctx.close();
});

test("not visible to the parent", async ({ browser }) => {
  const ctx = await ctxFor(browser, "parent", VIEWPORTS["1440"]);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-10T10:00:00"));
  await gotoHubPage(page, `/custdash/learninghub?tab=home&child=${fx.kids[0].id}`, fx);
  await settle(page);
  await expect(page.getByTestId("year-reminder")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Review year groups" })).toHaveCount(0);
  await ctx.close();
});
