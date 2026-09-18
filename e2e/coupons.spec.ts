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
    // Boy/girl only renders once the provider's settings.collectGender loads
    // (async) and becomes REQUIRED when it's on, blocking "Add child" with
    // an inline error if skipped — isVisible() never waits, so it can race
    // ahead of the button appearing and silently skip it. Wait briefly
    // instead (same fix as booking.spec.ts/family.spec.ts).
    // This is the CHECKOUT flow's own child form (features/listings/
    // checkout.tsx), a different component from the parent-portal
    // ChildrenApp.tsx wizard — its Boy/Girl buttons carry no emoji prefix.
    const boy = page.getByRole("button", { name: "Boy", exact: true });
    await boy.waitFor({ state: "visible", timeout: 8_000 }).then(() => boy.click()).catch(() => {});
    await page.getByRole("button", { name: "Add child", exact: true }).click();
    // The button reads "Next" only once every provider-required custom
    // question is answered — a required question can be added to this
    // shared tenant mid-run by another spec, same cross-spec race as
    // elsewhere in this suite. Answer generically rather than assume none.
    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    for (let guard = 0; !(await nextBtn.isVisible().catch(() => false)); guard++) {
      if (guard > 20) throw new Error("Children step never reached 'Next' — more blocking questions than expected.");
      for (const box of await page.getByRole("textbox").all()) {
        if (await box.isVisible().catch(() => false) && !(await box.inputValue().catch(() => "x"))) await box.fill("N/A").catch(() => {});
      }
      for (const sel of await page.locator("select:visible").all()) {
        if (!(await sel.inputValue().catch(() => "x"))) {
          const firstReal = await sel.locator("option").nth(1).getAttribute("value").catch(() => null);
          if (firstReal) await sel.selectOption(firstReal).catch(() => {});
        }
      }
      for (const yes of await page.getByRole("button", { name: "Yes", exact: true }).all()) {
        if (await yes.isVisible().catch(() => false)) await yes.click().catch(() => {});
      }
      if (await boy.isVisible().catch(() => false)) await boy.click().catch(() => {});
      const addChildBtn = page.getByRole("button", { name: "Add child", exact: true });
      if (await addChildBtn.isVisible().catch(() => false)) await addChildBtn.click().catch(() => {});
      await page.waitForTimeout(400);
    }
    await nextBtn.click();

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

    // Contact phone is required at the pay stage — without it "Confirm & pay"
    // stays disabled and the click hangs forever waiting for it to be actionable.
    const phoneInput = page.getByPlaceholder("e.g. 07700 900123");
    if (await phoneInput.inputValue().then((v) => !v.trim())) await phoneInput.fill("07700900123");

    await page.getByRole("button", { name: /Confirm & pay/ }).click();
    await expect(page.getByRole("heading", { name: /Congratulations/ })).toBeVisible({ timeout: 30_000 });

    // The provider's public codes surface in the family's Coupons area.
    await page.goto("/custdash/coupons");
    await expect(page.getByText(CODE).first()).toBeVisible({ timeout: 15_000 });
  });
});
