import { test, expect } from "@playwright/test";
import { loadAccounts, statePath, type AccountManifest } from "./helpers/env";
import { apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, provisionLiveListing, type ProvisionedListing } from "./helpers/tenantData";

// Safeguarding: accidents, medication (the full consent → dose loop), the
// meal shop, and photo moments with consent enforcement.
//
// KNOWN GAP (documented in PROD-READINESS): the operator incident/medication
// forms are free-text with no child link, so operator-created records never
// reach the parent (parent views match on childId). The accident test covers
// the operator log AND the API-level record a picker would create.

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

let accounts: AccountManifest["accounts"];
let listing: ProvisionedListing;
const childName = `E2E Safe Kid ${stamp}`;
let childId: string;

test.beforeAll(async () => {
  accounts = loadAccounts().accounts;
  // Child saved on the parent account (with photo consent for moments),
  // booked onto a listing that runs TODAY — the boards need a session today.
  childId = await createParentChild(accounts.parent, { name: childName, photoConsent: true });
  listing = await provisionLiveListing(accounts.company, { title: `E2E Safe Camp ${stamp}`, price: 0, startToday: true });
  await bookViaApi(accounts.parent, listing, { child: childName, dates: [iso(new Date())] });
});

test.describe("accidents", () => {
  test.use({ storageState: statePath("company") });

  test("operator logs an accident; a child-linked record reaches the parent", async ({ page, browser }) => {
    const uiChild = `E2E Accident Kid ${stamp}`;
    await page.goto("/company/accidents");
    await page.getByRole("button", { name: /Log an accident/ }).click();
    const form = page.locator("div").filter({ has: page.getByText("Log an accident", { exact: true }) }).filter({ has: page.locator("textarea") }).last();
    await form.locator("input").first().fill(uiChild); // Child — free text, first field
    await form.getByPlaceholder("e.g. the main hall").fill("Main hall");
    await form.locator("textarea").fill("Tripped during warm-up, small graze.");
    await form.getByRole("button", { name: "Save record" }).click();
    await expect(page.getByText(uiChild).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("parent not yet informed").first()).toBeVisible();

    // Parent-visible record needs a childId — create it via the API (this is
    // what the operator form will send once it grows a child picker).
    const op = await fbSignIn(accounts.company.email);
    await apiPost("/api/incidents", op.idToken, {
      kind: "accident",
      date: iso(new Date()),
      childName,
      childId,
      severity: "moderate",
      description: "Bumped elbow on the climbing frame — cold pack applied.",
      parentNotified: true,
    });
    const parentCtx = await browser.newContext({ storageState: statePath("parent") });
    const parentPage = await parentCtx.newPage();
    await parentPage.goto("/custdash/accidents");
    await expect(parentPage.getByText(childName).first()).toBeVisible({ timeout: 15_000 });
    await expect(parentPage.getByText("you were notified").first()).toBeVisible();
    await parentCtx.close();
  });
});

test.describe("medication consent loop", () => {
  test.use({ storageState: statePath("parent") });

  test("parent authorises → operator records a dose → parent sees it", async ({ page, browser }) => {
    await page.goto("/custdash/medication");
    await page.getByRole("button", { name: /Authorise a medication/ }).click();
    // Provider + child selects (first real option each), then the essentials.
    const selects = page.locator("select");
    await selects.nth(0).selectOption({ index: 0 }).catch(() => {});
    await selects.nth(1).selectOption({ label: childName }).catch(async () => {
      await selects.nth(1).selectOption({ index: 0 });
    });
    const medName = `Salbutamol ${stamp}`;
    await page.getByPlaceholder("e.g. Salbutamol inhaler").fill(medName);
    await page.getByPlaceholder("e.g. 2 puffs").fill("2 puffs");
    await page.getByText(/I authorise the provider/).click();
    await page.getByRole("button", { name: "Authorise", exact: true }).click();
    await expect(page.getByText("Medication authorised — staff can now administer it.")).toBeVisible({ timeout: 15_000 });

    // Operator records a dose against the consented medication.
    const opCtx = await browser.newContext({ storageState: statePath("company") });
    const opPage = await opCtx.newPage();
    await opPage.goto("/company/medication");
    await expect(opPage.getByText(medName).first()).toBeVisible({ timeout: 15_000 });
    await expect(opPage.getByText("consent on file").first()).toBeVisible();
    // Scope to THIS run's medication — earlier runs leave rows behind.
    await opPage
      .locator("div")
      .filter({ has: opPage.getByText(medName) })
      .filter({ has: opPage.getByRole("button", { name: "Record a dose" }) })
      .last()
      .getByRole("button", { name: "Record a dose" })
      .click();
    await opPage.getByRole("button", { name: "Confirm dose given" }).click();
    await expect(opPage.getByText(/1 dose recorded/).first()).toBeVisible({ timeout: 15_000 });
    await opCtx.close();

    // Parent sees the dose history on THIS run's medication.
    await page.reload();
    await page
      .locator("div")
      .filter({ has: page.getByText(medName) })
      .filter({ has: page.getByRole("button", { name: /Doses given/ }) })
      .last()
      .getByRole("button", { name: /Doses given \(1\)/ })
      .click();
    await expect(page.getByText(/2 puffs/).first()).toBeVisible();
  });
});

test.describe("meal shop", () => {
  test.use({ storageState: statePath("company") });

  test("operator sells a meal; parent orders; operator marks it paid", async ({ page, browser }) => {
    await page.goto("/company/meals");
    await page.getByRole("button", { name: /Meal shop/ }).click();
    await page.getByRole("button", { name: /Add a meal/ }).click();
    await page.getByPlaceholder("Hot lunch").fill(`E2E Hot lunch ${stamp}`);
    await page.locator('input[type="number"]').first().fill("3.50");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(`E2E Hot lunch ${stamp}`).first()).toBeVisible({ timeout: 15_000 });

    // Parent orders one.
    const parentCtx = await browser.newContext({ storageState: statePath("parent") });
    const parentPage = await parentCtx.newPage();
    await parentPage.goto("/custdash/meals");
    await parentPage.getByPlaceholder("Who’s eating?").fill(childName);
    await expect(parentPage.getByText(`E2E Hot lunch ${stamp}`).first()).toBeVisible({ timeout: 15_000 });
    const optionRow = parentPage
      .locator("div")
      .filter({ has: parentPage.getByText(`E2E Hot lunch ${stamp}`) })
      .filter({ has: parentPage.getByRole("button", { name: "More" }) })
      .last();
    await optionRow.getByRole("button", { name: "More" }).click();
    await parentPage.getByRole("button", { name: "Place order" }).click();
    await expect(parentPage.getByText("Order placed — pay the provider at drop-off.")).toBeVisible({ timeout: 15_000 });
    await parentCtx.close();

    // Operator sees the order and marks it paid (the shop tab is client
    // state — a reload lands back on the dietary board).
    await page.reload();
    await page.getByRole("button", { name: /Meal shop/ }).click();
    await expect(page.getByText(childName).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Mark paid" }).first().click();
    await expect(page.getByText("paid", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("moments", () => {
  test.use({ storageState: statePath("company") });

  test("operator posts a photo moment tagged to a consented child; parent sees it", async ({ page, browser }) => {
    const caption = `Great day at camp! (${stamp})`;
    await page.goto("/company/moments");
    await page.getByRole("button", { name: /Share a moment/ }).click();

    // A real decodable image is required (client crops via canvas).
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    await page.locator('input[type="file"]').setInputFiles({ name: "e2e.png", mimeType: "image/png", buffer: png });
    await page.getByPlaceholder("Say something about the day…").fill(caption);
    // Tag our consented child — the button is the child's name.
    await page.getByRole("button", { name: childName }).click();
    await page.getByRole("button", { name: "Post moment" }).click();
    await expect(page.getByText(caption).first()).toBeVisible({ timeout: 20_000 });

    const parentCtx = await browser.newContext({ storageState: statePath("parent") });
    const parentPage = await parentCtx.newPage();
    await parentPage.goto("/custdash/moments");
    await expect(parentPage.getByText(caption)).toBeVisible({ timeout: 15_000 });
    await parentCtx.close();
  });
});
