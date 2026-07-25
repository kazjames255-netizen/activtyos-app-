import { test, expect } from "@playwright/test";
import { loadAccounts, statePath } from "./helpers/env";
import { bookViaApi, provisionLiveListing } from "./helpers/tenantData";

// Broadcast messaging: an operator messages everyone booked on a listing.
// The thread stays hidden from the operator inbox (only the "Sent to groups"
// row shows) but the parent receives it immediately.

test.describe("listing broadcast", () => {
  test.use({ storageState: statePath("company") });

  test("operator broadcasts to a listing's families; parent receives it", async ({ page, browser }) => {
    const accounts = loadAccounts().accounts;
    const stamp = Date.now().toString(36);
    const title = `E2E Broadcast Camp ${stamp}`;
    const listing = await provisionLiveListing(accounts.company, { title, price: 0 });
    await bookViaApi(accounts.parent, listing, { child: `E2E Bcast Kid ${stamp}` });

    await page.goto("/company/messages");
    await page.getByRole("button", { name: /Message customers/ }).click();
    await page.getByRole("button", { name: /Listings/ }).click();

    // Pick our listing in the picker (expand if collapsed, then search).
    const expand = page.getByText(/selected · choose listings/);
    if (await expand.isVisible().catch(() => false)) await expand.click();
    const search = page.getByPlaceholder("Search listings…").last();
    if (await search.isVisible().catch(() => false)) await search.fill(title);
    await page.getByText(title).first().click();

    const body = `Broadcast: session update! (${stamp})`;
    await page.getByPlaceholder(/Write a message/).fill(body);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText(/Sent to 1 famil/).first()).toBeVisible({ timeout: 15_000 });

    // Parent got it.
    const parentCtx = await browser.newContext({ storageState: statePath("parent") });
    const parentPage = await parentCtx.newPage();
    await parentPage.goto("/custdash/messages");
    await expect(parentPage.getByText(body).first()).toBeVisible({ timeout: 20_000 });
    await parentCtx.close();
  });
});
