import { test, expect } from "@playwright/test";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD } from "./helpers/accounts";

// Exploratory "brand-new freelancer" walk (see docs/provider-journey-freelancer.md). Covers the sign-up wizard
// (validation + happy path), the plan gate and the first-login surfaces. The listing wizard / parent booking /
// provider-side steps were driven by ad-hoc scripts; their findings are in the doc. Screenshots land in
// e2e/review/shots/journey-freelancer/. Throwaway account: removed by `npm run e2e:cleanup`.
const stamp = Date.now().toString(36);
const email = `e2e-journey-fl-${stamp}@${TEST_EMAIL_DOMAIN}`;
const SHOTS = "e2e/review/shots/journey-freelancer";

test("new freelancer: sign-up wizard -> checklist (no plan wall) -> first login", async ({ page }) => {
  test.setTimeout(180_000);
  const cont = () => page.getByRole("button", { name: /^Continue/ }).click();
  await page.goto("/signup");
  await page.waitForTimeout(1500);
  await cont(); // Freelancer is pre-selected
  await cont();
  await expect(page.getByText("Enter your business name.")).toBeVisible();
  await page.locator("#b-name").fill(`Journey Coaching ${stamp}`);
  await cont();
  await expect(page.getByText("Tell us where you’re based.")).toBeVisible();
  await page.locator("#b-addr").fill("12 High Street, Northampton");
  await cont();
  await expect(page.getByText("Add your postcode.")).toBeVisible();
  await page.locator("#b-pc").fill("NN5 7EA");
  await cont();
  await cont(); // identity (logo optional)
  await cont();
  await expect(page.getByText("Pick one — it really helps us.")).toBeVisible();
  await page.getByText("Word of mouth").click();
  await cont();
  // Create button is disabled until the terms box is ticked (no visible reason is given).
  await expect(page.getByRole("button", { name: /Create account/ })).toBeDisabled();
  await page.locator("input[type=checkbox]").check();
  await page.locator("#l-email").fill(email);
  await page.locator("#l-pw").fill("abc");
  await page.getByRole("button", { name: /Create account/ }).click();
  await expect(page.getByText("Password must be at least 6 characters.")).toBeVisible();
  await page.locator("#l-pw").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /Create account/ }).click();
  // Sign-up no longer asks money questions and there is no plan wall: the new provider lands straight in the portal with the
  // "Get set up" checklist. The plan (free trial) and bank details are asked for at Go live.
  await expect(page.getByText("Get set up to take bookings").first()).toBeVisible({ timeout: 40_000 });
  await expect(page.getByText("Pick your plan")).toHaveCount(0);
  await expect(page.getByText("0 of 5 done").first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/spec-checklist.png`, fullPage: true });

  // First landing is an empty Bookings list under the checklist.
  await expect(page.getByText("No bookings match this view.")).toBeVisible({ timeout: 30_000 });
  await page.goto("/freelancer/listings");
  await expect(page.getByText(/No listings yet/)).toBeVisible({ timeout: 30_000 });
});
