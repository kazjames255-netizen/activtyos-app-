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
    await expect(page.getByRole("heading", { level: 2, name: "Registers" })).toBeVisible();
    // Jump to the session day (the booking sits on the listing's first day).
    await page.locator('input[type="date"]').fill(listing.runFrom);

    await expect(page.getByText(listing.title).first()).toBeVisible({ timeout: 15_000 });
    // Attendee rows render children as "Name (age)".
    const attendee = page.getByText(`${childName} (8)`);
    await expect(attendee).toBeVisible();

    // Mark them in — the innermost div holding both the child and an In
    // button is their row (a bare .last() after one filter lands on the
    // text node's own wrapper, which has no buttons).
    await page
      .locator("div")
      .filter({ has: attendee })
      .filter({ has: page.getByRole("button", { name: "In", exact: true }) })
      .last()
      .getByRole("button", { name: "In", exact: true })
      .click();
    // The In-time must land in OUR listing's register section — other runs'
    // listings share the same session date and may hold checked-in children.
    await expect(cardWith(page, `${childName} (8)`, /In · \d{2}:\d{2}/)).toBeVisible({ timeout: 15_000 });

    // Check them out again — the row keeps the in-time for the day's audit trail.
    await page
      .locator("div")
      .filter({ has: attendee })
      .filter({ has: page.getByRole("button", { name: "Out", exact: true }) })
      .last()
      .getByRole("button", { name: "Out", exact: true })
      .click();
    await expect(cardWith(page, `${childName} (8)`, /Out · \d{2}:\d{2} \(in \d{2}:\d{2}\)/)).toBeVisible({ timeout: 15_000 });
  });

  test("newsfeed post reaches the booked family", async ({ page, browser }) => {
    const body = `Bring wellies tomorrow! (${stamp})`;
    await page.goto("/company/newsfeed");
    await page.getByPlaceholder("Bring wellies and a packed lunch…").fill(body);
    await page.getByRole("button", { name: "Post to families" }).click();
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
    await page.getByPlaceholder("Add a task…").fill(title);
    await page.getByRole("button", { name: "Add", exact: true }).click();

    const row = page.locator("div").filter({ has: page.getByText(title, { exact: true }) }).last();
    await expect(row).toBeVisible({ timeout: 15_000 });
    // click(), not check(): the checkbox is React-controlled and only flips
    // once the PUT round-trips, which check()'s immediate verification fails.
    // The checked state IS the round-trip proof — a "Done (n)" section header
    // shows for any old completed task and proves nothing about this one.
    await row.locator('input[type="checkbox"]').click();
    await expect(row.locator('input[type="checkbox"]')).toBeChecked({ timeout: 15_000 });
  });
});
