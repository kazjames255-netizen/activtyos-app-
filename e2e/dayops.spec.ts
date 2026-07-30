import { test, expect } from "@playwright/test";
import { loadAccounts, statePath, type AccountManifest } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, apiPost, fbSignUp } from "./helpers/accounts";
import { bookViaApi, provisionLiveListing, type ProvisionedListing } from "./helpers/tenantData";
import { cardWith } from "./helpers/ui";

// Day-to-day operations: the register for a session day, newsfeed posts
// reaching booked families, and the team task list. One API-arranged booking
// feeds the register and gates the parent's newsfeed. Serial: tests share
// the arranged listing.

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
let accounts: AccountManifest["accounts"];
let listing: ProvisionedListing;
const childName = `E2E Reg Kid ${stamp}`;

test.beforeAll(async () => {
  accounts = loadAccounts().accounts;
  listing = await provisionLiveListing(accounts.company, { title: `E2E DayOps ${stamp}`, price: 0 });
  await bookViaApi(accounts.parent, listing, { child: childName });
});

test.describe("operator day ops", () => {
  test.use({ storageState: statePath("company") });

  test("register shows the booked child; check-in sticks", async ({ page }) => {
    await page.goto("/company/admin-registers");
    // The rebuilt register (July 2026) is a single-listing, single-day hero
    // view — the only level-1 heading is the top bar's nav label.
    await expect(page.getByRole("heading", { level: 1, name: "Registers" })).toBeVisible();
    await expect(page.getByLabel("Previous day")).toBeVisible({ timeout: 15_000 });

    // Point the register at OUR listing — other runs leave listings behind,
    // which turns the hero name into a dropdown picker. (Never target a bare
    // "▾": the sidebar's collapsible group headers carry the same caret.)
    if (!(await page.getByText(listing.title).first().isVisible().catch(() => false))) {
      await page.getByLabel("Choose listing").click();
      await page.getByPlaceholder("Search listings…").fill(listing.title);
      await page.getByRole("button", { name: listing.title }).click();
    }
    // Jump to the session day via the 📅 overlay input (the booking sits on
    // the listing's first day).
    await page.locator('input[type="date"]').fill(listing.runFrom);

    // Rows carry data-ui="card"; the child renders by bare name (age sits in
    // the subtitle now, so no "(8)" suffix).
    const row = page.locator('[data-ui="card"]').filter({ hasText: childName }).last();
    await expect(row).toBeVisible({ timeout: 15_000 });

    // Mark them in. The In-time must land in OUR child's row — other runs'
    // listings share the same session date and may hold checked-in children.
    await row.getByRole("button", { name: "In", exact: true }).click();
    await expect(cardWith(page, childName, /In \d{2}:\d{2}/)).toBeVisible({ timeout: 15_000 });

    // Collect them (the old check-out) — the row keeps the in-time for the
    // day's audit trail.
    await row.getByRole("button", { name: "Collect", exact: true }).click();
    await expect(cardWith(page, childName, /In \d{2}:\d{2} · Out \d{2}:\d{2}/)).toBeVisible({ timeout: 15_000 });
  });

  test("newsfeed post reaches the booked family", async ({ page, browser }) => {
    const body = `Bring wellies tomorrow! (${stamp})`;
    await page.goto("/company/newsfeed");
    // Posting starts from a template tile now. "Announcement" also names a
    // filter chip, so pick the tile by its unique hint line.
    await page.getByRole("button", { name: "General news for families" }).click();
    await page.getByPlaceholder("e.g. Early pick-up today at 3pm").fill(`Wellies day (${stamp})`);
    await page.getByPlaceholder("Write the update families will see…").fill(body);
    await page.getByRole("button", { name: "Post to Newsfeed" }).click();
    // The composer closing proves the POST succeeded — asserting the body
    // text alone could match the composer's own textarea mirror.
    await expect(page.getByPlaceholder("Write the update families will see…")).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText(body).first()).toBeVisible({ timeout: 15_000 });

    const parentCtx = await browser.newContext({ storageState: statePath("parent") });
    const parentPage = await parentCtx.newPage();
    await parentPage.goto("/custdash/newsfeed");
    await expect(parentPage.getByText(body)).toBeVisible({ timeout: 15_000 });
    await parentCtx.close();

    // …and ONLY the booked family: a parent with no booking at this provider
    // must never see the post (the feed is scoped to booked tenants).
    const outsider = `e2e-outsider-${stamp}@${TEST_EMAIL_DOMAIN}`;
    const s = await fbSignUp(outsider);
    await apiPost("/api/register-role", s.idToken, { role: "parent", postcode: "NN5 7EA" });
    const outCtx = await browser.newContext();
    const outPage = await outCtx.newPage();
    await outPage.goto("/login");
    await outPage.getByPlaceholder("you@example.com").fill(outsider);
    await outPage.locator('input[type="password"]').fill(TEST_PASSWORD);
    await outPage.getByRole("button", { name: "Sign in", exact: true }).click();
    await outPage.waitForURL("**/custdash/browse", { timeout: 30_000 });
    await outPage.goto("/custdash/newsfeed");
    await expect(outPage.getByText("No updates yet.")).toBeVisible({ timeout: 15_000 });
    await expect(outPage.getByText(body)).toBeHidden();
    await outCtx.close();
  });

  test("task can be added, completed and lands in Done", async ({ page }) => {
    const title = `E2E task ${stamp}`;
    await page.goto("/company/tasks");
    await page.getByPlaceholder(/Quick add…/).fill(title);
    await page.getByRole("button", { name: "Quick add", exact: true }).click();

    // Quick-adds land unassigned, so they show on the Board (not "My tasks").
    await page.getByRole("button", { name: "Board", exact: true }).click();
    const card = page.locator('[data-ui="card"]').filter({ hasText: title }).last();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Every board card has a "Done" button; ours flips to "✓ Done" when the
    // PUT lands (exact:true keeps the pre-click match off the flipped label).
    await card.getByRole("button", { name: "Done", exact: true }).click();
    await expect(cardWith(page, title, "✓ Done")).toBeVisible({ timeout: 15_000 });

    // Reload proves the completion persisted server-side rather than living
    // only in the optimistic local state.
    await page.reload();
    await page.getByRole("button", { name: "Board", exact: true }).click();
    await expect(cardWith(page, title, "✓ Done")).toBeVisible({ timeout: 15_000 });
  });
});
