import { test, expect } from "@playwright/test";
import { loadAccounts, statePath } from "./helpers/env";

// A head office that has picked a franchise in the scope switcher gets top-bar tabs (Bookings, Families). On a 1280-1439px laptop the
// account-name label and a wide scope picker used to squeeze them into a ~28px scroll box (a stray "[" sliver, tabs unreachable).
test.use({ storageState: statePath("company") });

test("franchise-scoped top-bar tabs stay fully visible on laptop widths", async ({ page }) => {
  test.setTimeout(180_000);
  const fid = loadAccounts().accounts.franchise.uid as string;
  await page.goto("/company/listings");
  await page.evaluate((id) => localStorage.setItem("aos.ho.scope", id), fid);

  for (const width of [1280, 1366, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/company/admin-registers");
    const tab = page.locator("header nav").getByRole("link", { name: "Families" });
    await expect(tab).toBeVisible({ timeout: 60_000 });
    const box = await page.evaluate(() => {
      const scroll = document.querySelector("header nav > div") as HTMLElement | null;
      return scroll ? { visible: scroll.getBoundingClientRect().width, needed: scroll.scrollWidth } : null;
    });
    // Every tab fits without an inner horizontal scroll (allow 2px rounding).
    expect(box, `header tab box at ${width}px`).not.toBeNull();
    expect(box!.visible + 2).toBeGreaterThanOrEqual(box!.needed);
  }
});

test("Take a booking modal closes on Escape", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/company/bookings");
  await page.getByRole("button", { name: /Take a booking/ }).first().click({ timeout: 60_000 });
  const title = page.getByRole("heading", { name: "Take a booking" });
  await title.waitFor({ state: "visible", timeout: 30_000 });
  await page.keyboard.press("Escape");
  await title.waitFor({ state: "hidden", timeout: 5_000 });
});
