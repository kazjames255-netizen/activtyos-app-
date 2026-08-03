import { test, expect } from "@playwright/test";
import { loadAccounts, statePath, type AccountManifest } from "./helpers/env";
import { apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, provisionLiveListing } from "./helpers/tenantData";
import { cardWith } from "./helpers/ui";

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

    // THIS booking's card flips to Cancelled once the request lands — never
    // assert the badge alone, older runs' cancelled cards would satisfy it.
    await expect(cardWith(page, title, "Cancelled")).toBeVisible({ timeout: 20_000 });

    // Operator sees it under the Cancelled filter.
    const opCtx = await browser.newContext({ storageState: statePath("company") });
    const opPage = await opCtx.newPage();
    await opPage.goto("/company/bookings");
    await opPage.getByRole("button", { name: /^Cancelled/ }).click();
    await expect(opPage.getByText(child).first()).toBeVisible({ timeout: 20_000 });
    await opCtx.close();
  });
});

test.describe("approval flow", () => {
  test.use({ storageState: statePath("parent") });

  test("approval-needed bookings: operator approves one, declines another; parent sees both outcomes", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const title = `E2E Approval Camp ${stamp}`;
    const approveKid = `E2E Approve Kid ${stamp}`;
    const declineKid = `E2E Decline Kid ${stamp}`;
    const listing = await provisionLiveListing(accounts.company, { title, price: 0, approval: true });
    const b1 = await bookViaApi(accounts.parent, listing, { child: approveKid });
    const b2 = await bookViaApi(accounts.parent, listing, { child: declineKid });
    // The server rule under test: no bookingType on the listing ⇒ places are
    // only held pending the operator's say-so.
    expect(b1.status).toBe("Approval needed");
    expect(b2.status).toBe("Approval needed");

    // Parent sees both waiting on approval.
    await page.goto("/custdash/bookings");
    await expect(cardWith(page, approveKid, "Approval needed")).toBeVisible({ timeout: 15_000 });
    await expect(cardWith(page, declineKid, "Approval needed")).toBeVisible();

    // Operator decides from the booking detail.
    const opCtx = await browser.newContext({ storageState: statePath("company") });
    const opPage = await opCtx.newPage();
    await opPage.goto("/company/bookings");
    await opPage.getByText(approveKid).first().click();
    await opPage.getByRole("button", { name: "Approve", exact: true }).click();
    // Wait for the flip to land in the operator UI before navigating away —
    // a goto (or context close) aborts the in-flight POST, which is exactly
    // how this test lost approvals under full-suite load.
    await expect(cardWith(opPage, approveKid, "Confirmed")).toBeVisible({ timeout: 15_000 });
    await opPage.goto("/company/bookings");
    await opPage.getByText(declineKid).first().click();
    await opPage.getByRole("button", { name: "Decline", exact: true }).click();
    // Declining now opens a confirm popup with an optional reason the family
    // sees in the decline email; the booking only flips once it's confirmed.
    await opPage.getByRole("button", { name: "Decline booking", exact: true }).click();
    await expect(cardWith(opPage, declineKid, "Declined")).toBeVisible({ timeout: 15_000 });
    await opCtx.close();

    // Parent's cards flip to the two outcomes.
    await page.goto("/custdash/bookings");
    await expect(cardWith(page, approveKid, "Confirmed")).toBeVisible({ timeout: 20_000 });
    await expect(cardWith(page, declineKid, "Declined")).toBeVisible({ timeout: 20_000 });
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

    // Parent sees the queue card — OUR child's, not a leftover one.
    await page.goto("/custdash/bookings");
    await expect(page.getByText("My waiting list")).toBeVisible({ timeout: 15_000 });
    await expect(cardWith(page, `E2E Queue Kid ${stamp}`, "On the waiting list")).toBeVisible();

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

    // Parent accepts the offer — booking confirms. All scoped to OUR child's
    // card: an unexpired offer left by an earlier run renders the same banner.
    await page.goto("/custdash/bookings");
    const offerCard = cardWith(page, `E2E Queue Kid ${stamp}`, "A place has opened up!");
    await expect(offerCard).toBeVisible({ timeout: 20_000 });
    await offerCard.getByRole("button", { name: "Accept the place" }).click();
    await expect(offerCard).toBeHidden({ timeout: 20_000 });
    await expect(cardWith(page, `E2E Queue Kid ${stamp}`, "Confirmed")).toBeVisible({ timeout: 20_000 });
  });
});
