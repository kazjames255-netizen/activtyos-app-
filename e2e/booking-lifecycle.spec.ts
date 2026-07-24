import { test, expect } from "@playwright/test";
import { loadAccounts, statePath, type AccountManifest } from "./helpers/env";
import { apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, provisionLiveListing } from "./helpers/tenantData";

// The booking lifecycle beyond the happy path: a parent-initiated
// cancellation, and the waitlist loop (full day → queued → operator offers →
// parent accepts). Bookings are arranged via the API; every state change
// under test happens through the UI.

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
let accounts: AccountManifest["accounts"];

test.beforeAll(async () => {
  accounts = loadAccounts().accounts;
});

test.describe("parent cancellation", () => {
  test.use({ storageState: statePath("parent") });

  test("cancel request → Cancelled on both sides", async ({ page, browser }) => {
    const title = `E2E Cancel Camp ${stamp}`;
    const child = `E2E Cancel Kid ${stamp}`;
    const listing = await provisionLiveListing(accounts.company, { title, price: 0 });
    await bookViaApi(accounts.parent, listing, { child });

    await page.goto("/custdash/bookings");
    await page
      .locator("div")
      .filter({ has: page.getByText(title).first() })
      .filter({ has: page.getByRole("button", { name: /Cancel booking/ }) })
      .last()
      .getByRole("button", { name: /Cancel booking/ })
      .click();
    await expect(page.getByText("Request cancellation")).toBeVisible();
    await page.getByRole("button", { name: "Send cancellation request" }).click();

    // The card flips to Cancelled (badge) once the request lands.
    await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible({ timeout: 20_000 });

    // Operator sees it under the Cancelled filter.
    const opCtx = await browser.newContext({ storageState: statePath("company") });
    const opPage = await opCtx.newPage();
    await opPage.goto("/company/bookings");
    await opPage.getByRole("button", { name: /^Cancelled/ }).click();
    await expect(opPage.getByText(child).first()).toBeVisible({ timeout: 20_000 });
    await opCtx.close();
  });
});

test.describe("waitlist loop", () => {
  test.use({ storageState: statePath("parent") });

  test("full day → waitlisted → operator offers → parent accepts", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const title = `E2E Waitlist Camp ${stamp}`;
    const listing = await provisionLiveListing(accounts.company, {
      title,
      price: 0,
      maxAttendees: 1,
      waitlist: true,
    });
    // First child takes the only seat; the second lands on the waiting list.
    const seat = await bookViaApi(accounts.parent, listing, { child: `E2E Seat Kid ${stamp}` });
    const queued = await bookViaApi(accounts.parent, listing, { child: `E2E Queue Kid ${stamp}` });
    expect(queued.status).toBe("Waitlisted");

    // Parent sees the queue card.
    await page.goto("/custdash/bookings");
    await expect(page.getByText("My waiting list")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("On the waiting list").first()).toBeVisible();

    // A place must free up before it can be offered ("That date is still
    // full — free a place first") — the seat-holder cancels.
    const parentSession = await fbSignIn(accounts.parent.email);
    await apiPost(`/api/my/bookings/${seat.ref}/cancel`, parentSession.idToken, {});

    // Operator offers the freed place from the booking detail.
    const opCtx = await browser.newContext({ storageState: statePath("company") });
    const opPage = await opCtx.newPage();
    await opPage.goto("/company/bookings");
    await opPage.getByRole("button", { name: /^Waitlisted/ }).click();
    await opPage.getByText(`E2E Queue Kid ${stamp}`).first().click();
    await opPage.getByRole("button", { name: "Offer place (2h hold)" }).click();
    await expect(opPage.getByText(/Held until \d{2}:\d{2}/)).toBeVisible({ timeout: 20_000 });
    await opCtx.close();

    // Parent accepts the offer — booking confirms.
    await page.goto("/custdash/bookings");
    await expect(page.getByText("A place has opened up!")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Accept the place" }).click();
    await expect(page.getByText("A place has opened up!")).toBeHidden({ timeout: 20_000 });
    await expect(page.getByText("Confirmed").first()).toBeVisible();
  });
});
