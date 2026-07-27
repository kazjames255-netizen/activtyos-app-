import { test, expect } from "@playwright/test";
import { loadAccounts } from "./helpers/env";
import { provisionLiveListing } from "./helpers/tenantData";

// The public, signed-out surfaces: a provider's whole storefront page and a
// listing's book page. No storageState — these must work for strangers.

test("provider storefront lists live listings and links to booking", async ({ page }) => {
  const accounts = loadAccounts().accounts;
  const stamp = Date.now().toString(36);
  const title = `E2E Store Camp ${stamp}`;
  const draftTitle = `E2E Store Draft ${stamp}`;
  const hiddenTitle = `E2E Store Hidden ${stamp}`;
  const listing = await provisionLiveListing(accounts.company, { title, price: 0 });
  // Unpublished work must never leak to the public storefront.
  await provisionLiveListing(accounts.company, { title: draftTitle, price: 0, status: "draft" });
  await provisionLiveListing(accounts.company, { title: hiddenTitle, price: 0, visibility: "hidden" });

  await page.goto(`/store/${listing.tenantId}`);
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(draftTitle)).toBeHidden();
  await expect(page.getByText(hiddenTitle)).toBeHidden();
  // The whole listing card is one link — target it by OUR title (a bare
  // "Book →" .first() opens whichever listing happens to sit first) and
  // prove it routes to OUR listing's book page.
  await page.getByRole("link", { name: title }).click();
  await page.waitForURL(`**/book/${listing.id}`);

  // Signed out: the book page offers Sign in, and the widget is live.
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText(/choose your pass/i)).toBeVisible({ timeout: 15_000 });
});
