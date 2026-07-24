import { test, expect } from "@playwright/test";
import { statePath } from "./helpers/env";

// Parent child-profile management: the 4-step modal, required fields, and
// the saved card. (All four steps are in the DOM at once, slid off-screen —
// placeholders are unique per step, so targeting stays unambiguous.)

test.describe("children profiles", () => {
  test.use({ storageState: statePath("parent") });

  test("parent adds a child through the 4-step modal", async ({ page }) => {
    const name = `E2E Child ${Date.now().toString(36)}`;

    await page.goto("/custdash/children");
    await page.getByRole("button", { name: "+ Add child" }).click();

    // Step 1 — basics.
    await expect(page.getByText("Add a child · Step 1 of 4")).toBeVisible();
    await page.getByPlaceholder("Child’s name").fill(name);
    await page.locator('input[type="date"]').first().fill("2018-05-14");
    await page.getByRole("button", { name: "Boy", exact: true }).click();
    await page.getByRole("button", { name: "Next →" }).click();

    // Step 2 — health & diet (all optional): flag an allergy.
    await page.getByPlaceholder("e.g. nuts — leave blank if none").fill("Peanuts");
    await page.getByRole("button", { name: "Next →" }).click();

    // Step 3 — emergency contact is required.
    await page.getByPlaceholder("Name", { exact: true }).fill("E2E Grandparent");
    await page.getByPlaceholder("Phone", { exact: true }).fill("07700900123");
    await page.getByRole("button", { name: "Next →" }).click();

    // Step 4 — safeguarding, then save.
    await page.getByPlaceholder("e.g. Bluebell").fill("Sunflower");
    await page.getByRole("button", { name: "Save child" }).click();

    // The card renders with the flags we set.
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("⚠ Allergy: Peanuts").first()).toBeVisible();

    // Remove it again (cleanup + covers the confirm dialog).
    page.on("dialog", (d) => d.accept());
    await page
      .locator("div")
      .filter({ has: page.getByText(name, { exact: true }) })
      .filter({ has: page.getByRole("button", { name: "Remove" }) })
      .last()
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(page.getByText(name)).toBeHidden({ timeout: 15_000 });
  });
});
