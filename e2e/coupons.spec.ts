import { test, expect } from "@playwright/test";
import { loadAccounts, statePath } from "./helpers/env";
import { provisionLiveListing } from "./helpers/tenantData";
import { cardWith } from "./helpers/ui";

// Discount codes end to end: operator creates a percent-off code in the UI,
// a parent applies it at checkout on a priced listing, and it shows in their
// Coupons area afterwards. Serial: the code must exist before it's applied.

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const CODE = `E2E${stamp}`.toUpperCase();

test.describe("discount codes", () => {
  test.use({ storageState: statePath("parent") });

  test("operator creates a percent-off code", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: statePath("company") });
    const page = await ctx.newPage();
    await page.goto("/company/marketing");
    await expect(page.getByText("Discount codes").first()).toBeVisible();

    await page.getByRole("button", { name: /New code/ }).click();
    await page.getByPlaceholder("E.G. SUMMER25").fill(CODE);
    // Type defaults to percent; the value field is the first (placeholder-less)
    // number input — min-spend/usage-limit have placeholders.
    await page.locator('input[type="number"]').first().fill("10");
    await page.getByRole("button", { name: "Create code" }).click();

    // OUR code's row carries the 10% value — older runs' rows also say
    // "10% off", so the value must be read off this row.
    await expect(cardWith(page, CODE, "10% off")).toBeVisible({ timeout: 15_000 });
    await ctx.close();
  });

  test("parent applies the code at checkout and sees it in Coupons", async ({ page }) => {
    test.setTimeout(120_000);
    const accounts = loadAccounts().accounts;
    const title = `E2E Coupon Camp ${stamp}`;
    const listing = await provisionLiveListing(accounts.company, { title, price: 20 });

    await page.goto(`/book/${listing.id}`);
    await page.getByRole("button", { name: /Day pass · £/ }).first().click();
    const timing = page.getByText(/choose a timing/i);
    if (await timing.isVisible().catch(() => false)) {
      await page.getByRole("button", { name: /Full day/ }).first().click();
    }
    await page.getByRole("button", { name: /^(Mon|Tue|Wed|Thu|Fri) \d+$/ }).first().click();
    await page.getByRole("button", { name: /Add .* to basket/ }).click();
    await page.getByRole("button", { name: /Next — add children/ }).click();

    await page.getByRole("button", { name: /Add a new child/ }).click();
    await page.getByPlaceholder("First and last name").fill(`E2E Coupon Kid ${stamp}`);
    const dob = page.locator('input[type="date"]').first();
    if (await dob.isVisible().catch(() => false)) await dob.fill("2018-05-14");
    const boy = page.getByRole("button", { name: "Boy", exact: true });
    if (await boy.isVisible().catch(() => false)) await boy.click();
    await page.getByRole("button", { name: "Add child", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Pay stage. A made-up code is rejected server-side and changes nothing.
    await expect(page.getByText("Have discount codes?")).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder("Type a code…").fill(`NOPE${stamp}`);
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.getByText("That code isn’t recognised")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("£20.00").first()).toBeVisible();

    // The real code — £20 drops by 10%.
    await page.getByPlaceholder("Type a code…").fill(CODE);
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.getByText(`Code ${CODE}`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Due now")).toBeVisible();
    await expect(page.getByText("£18.00").first()).toBeVisible();

    await page.getByRole("button", { name: /Confirm & pay/ }).click();
    await expect(page.getByRole("heading", { name: /Congratulations/ })).toBeVisible({ timeout: 30_000 });

    // The provider's public codes surface in the family's Coupons area.
    await page.goto("/custdash/coupons");
    await expect(page.getByText(CODE).first()).toBeVisible({ timeout: 15_000 });
  });
});
