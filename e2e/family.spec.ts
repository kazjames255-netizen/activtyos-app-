import { test, expect } from "@playwright/test";
import { loadAccounts, statePath } from "./helpers/env";
import { bookViaApi, createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { cardWith, dismissParentWelcome } from "./helpers/ui";

// Parent child-profile management: the multi-step modal, required fields, and
// the saved card. (All steps are in the DOM at once, slid off-screen —
// placeholders are unique per step, so targeting stays unambiguous.)
//
// The step COUNT isn't fixed: "A few questions" only appears when the
// provider has custom child questions configured, and "Safeguarding" only
// when a collection check or photo-consent question is on (ChildrenApp.tsx).
// Both can be toggled on by other specs sharing this tenant's settings — so
// rather than assume a step count, fill whatever's on the current step (name/
// dob/sex on the first, required text/select/yes-no answers if a "Next →" is
// disabled) and advance until "Save child" appears.

test.describe("children profiles", () => {
  test.use({ storageState: statePath("parent") });

  test("parent adds a child through the 4-step modal", async ({ page }) => {
    // The generic step-walker (up to 5 steps, each with its own fill/wait)
    // plus a removal round-trip is meaningfully more than the default 60s.
    test.setTimeout(120_000);
    const name = `E2E Child ${Date.now().toString(36)}`;

    // Mark the welcome popup seen server-side before navigating so it never
    // opens at all — see markParentWelcomed's doc comment for why dismissing
    // it via the UI alone is racy.
    await markParentWelcomed(loadAccounts().accounts.parent);
    await page.goto("/custdash/children");
    await dismissParentWelcome(page);
    await page.getByRole("button", { name: "+ Add child" }).click();

    // Step 1 — basics (always present, always first).
    await expect(page.getByText(/Add a child · Step 1 of \d+/)).toBeVisible();
    await page.getByPlaceholder("Child’s name").fill(name);
    await page.locator('input[type="date"]').first().fill("2018-05-14");
    // Boy/girl only renders when the provider's settings.collectGender is on
    // — another spec (settings-scheduling.spec.ts) toggles this tenant-wide
    // and it isn't reset by the per-run data wipe, so don't assume it's on.
    // settings load async, so isVisible() alone can race ahead of the
    // button appearing — wait briefly, and only skip if it never shows.
    const boyBtn = page.getByRole("button", { name: "👦 Boy", exact: true });
    await boyBtn.waitFor({ state: "visible", timeout: 8_000 }).then(() => boyBtn.click()).catch(() => {});
    await page.getByRole("button", { name: "Next →" }).click();

    // Step 2 — health & diet (all optional): flag an allergy.
    await page.getByPlaceholder("e.g. nuts — leave blank if none").fill("Peanuts");
    await page.getByRole("button", { name: "Next →" }).click();

    // Step 3 — emergency contact is required.
    await page.getByPlaceholder("Name", { exact: true }).fill("E2E Grandparent");
    await page.getByPlaceholder("Phone", { exact: true }).fill("07700900123");
    await page.getByRole("button", { name: "Next →" }).click();

    // From here on, the remaining steps depend on the provider's settings
    // (custom questions / safeguarding may or may not be configured) — fill
    // whatever's required on the current step and advance until Save appears.
    const saveBtn = page.getByRole("button", { name: "Save child" });
    for (let guard = 0; !(await saveBtn.isVisible().catch(() => false)); guard++) {
      if (guard > 5) throw new Error("Add-child wizard never reached Save child — more steps than expected, or Next stayed disabled.");
      const nextBtn = page.getByRole("button", { name: "Next →" });
      if (!(await nextBtn.isEnabled())) {
        // A required custom question on "A few questions" is blocking Next —
        // answer every empty required field generically (we don't know this
        // provider's exact question text ahead of time).
        for (const box of await page.getByRole("textbox").all()) {
          if (await box.isVisible() && !(await box.inputValue())) await box.fill("N/A").catch(() => {});
        }
        for (const sel of await page.locator("select:visible").all()) {
          if (!(await sel.inputValue())) {
            const firstReal = await sel.locator("option").nth(1).getAttribute("value").catch(() => null);
            if (firstReal) await sel.selectOption(firstReal);
          }
        }
        for (const yes of await page.getByRole("button", { name: "Yes", exact: true }).all()) {
          if (await yes.isVisible()) await yes.click().catch(() => {});
        }
      }
      await nextBtn.click();
    }
    // Safeguarding's collection password (if present) is optional — leave it.
    await saveBtn.click();

    // THIS child's card renders with the flags we set (other children may
    // carry the same allergy — read it off our card). The allergy note is
    // behind a FlagChip that starts collapsed (ChildrenApp.tsx) — its detail
    // only renders once clicked open, joined with an em dash, not a colon
    // ("⚠ Allergy — Peanuts", not "⚠ Allergy: Peanuts").
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
    const card = cardWith(page, name);
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.getByRole("button", { name: /Allergy/ }).click();
    await expect(card.getByText("Peanuts")).toBeVisible();

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

  test("a child with bookings can't be removed", async ({ page }) => {
    const accounts = loadAccounts().accounts;
    const stamp = Date.now().toString(36);
    const name = `E2E Locked Child ${stamp}`;
    await createParentChild(accounts.parent, { name });
    const listing = await provisionLiveListing(accounts.company, { title: `E2E Lock Camp ${stamp}`, price: 0 });
    await bookViaApi(accounts.parent, listing, { child: name });

    await page.goto("/custdash/children");
    const card = cardWith(page, name);
    await expect(card).toBeVisible({ timeout: 15_000 });
    // The Remove action is replaced by the locked hint — no live button.
    await expect(card.getByText("🔒 Remove")).toBeVisible();
    await expect(card.getByRole("button", { name: "Remove", exact: true })).toBeHidden();
  });
});
