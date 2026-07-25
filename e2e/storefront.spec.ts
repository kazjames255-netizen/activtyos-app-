import { test, expect } from "@playwright/test";
import { loadAccounts } from "./helpers/env";
import { provisionLiveListing } from "./helpers/tenantData";

// The public, signed-out surfaces: a provider's whole storefront page and a
// listing's book page. No storageState — these must work for strangers.

test("provider storefront lists live listings and links to booking", async ({ page }) => {
  const accounts = loadAccounts().accounts;
  const stamp = Date.now().toString(36);
  const title = `E2E Store Camp ${stamp}`;
  const listing = await provisionLiveListing(accounts.company, { title, price: 0 });

  await page.goto(`/store/${listing.tenantId}`);
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("link", { name: "Book →" }).first().click();
  await page.waitForURL(/\/book\//);

  // Signed out: the book page offers Sign in, and the widget is live.
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText(/choose your pass/i)).toBeVisible({ timeout: 15_000 });
});
