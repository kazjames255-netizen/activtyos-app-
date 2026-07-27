import { test, expect } from "@playwright/test";
import { loadAccounts, statePath, type AccountManifest } from "./helpers/env";
import { apiFetch, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, provisionLiveListing, type ProvisionedListing } from "./helpers/tenantData";
import { cardWith } from "./helpers/ui";

// Safeguarding: accidents, medication (the full consent → dose loop), the
// meal shop, and photo moments with consent enforcement.
//
// The operator forms now carry a booked-child picker, so a record logged on
// the ground links to the parent's account and raises their bell — the
// accident test drives that whole path through the UI.

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

let accounts: AccountManifest["accounts"];
let listing: ProvisionedListing;
const childName = `E2E Safe Kid ${stamp}`;
const noConsentChild = `E2E NoPhoto Kid ${stamp}`;

test.beforeAll(async () => {
  accounts = loadAccounts().accounts;
  // Child saved on the parent account (with photo consent for moments),
  // booked onto a listing that runs TODAY — the boards need a session today.
  // A second child WITHOUT consent books the same session: the moments picker
  // must offer the first and never the second.
  await createParentChild(accounts.parent, { name: childName, photoConsent: true });
  await createParentChild(accounts.parent, { name: noConsentChild, photoConsent: false });
  listing = await provisionLiveListing(accounts.company, { title: `E2E Safe Camp ${stamp}`, price: 0, startToday: true });
  await bookViaApi(accounts.parent, listing, { child: childName, dates: [iso(new Date())] });
  await bookViaApi(accounts.parent, listing, { child: noConsentChild, dates: [iso(new Date())] });
});

test.describe("accidents", () => {
  test.use({ storageState: statePath("company") });

  test("operator logs an accident through the wizard; the record and its bell reach the parent", async ({ page, browser }) => {
    await page.goto("/company/accidents");
    await page.getByRole("button", { name: /Log an accident/ }).click();

    // Step 1 — who and where. Picking the BOOKED child is what links the
    // record to the parent's account; the picker's "not a booked child" row
    // deliberately doesn't, so wait for the real option rather than taking
    // whichever row is on screen before the booking list has loaded.
    await page.getByPlaceholder("Search a booked child…").fill(childName);
    const bookedChild = page.getByRole("button", { name: childName, exact: true });
    await expect(bookedChild).toBeVisible({ timeout: 15_000 });
    await bookedChild.click();
    await page.getByPlaceholder("e.g. the main hall").fill("Main hall");
    await page.getByRole("button", { name: "Next →", exact: true }).click();

    // Step 2 — what happened.
    await page.locator("textarea").first().fill("Tripped during warm-up, small graze.");
    await page.getByRole("button", { name: "Next →", exact: true }).click();

    // Step 3 — save.
    await page.getByRole("button", { name: "Save record" }).click();
    await expect(cardWith(page, childName, "Tripped during warm-up")).toBeVisible({ timeout: 15_000 });

    const parentCtx = await browser.newContext({ storageState: statePath("parent") });
    const parentPage = await parentCtx.newPage();
    await parentPage.goto("/custdash/accidents");
    await expect(cardWith(parentPage, childName, "Tripped during warm-up")).toBeVisible({ timeout: 15_000 });

    // …and the notification layer raised a bell for the family, not just a
    // record they'd have to go looking for.
    const parent = await fbSignIn(accounts.parent.email);
    const bell = await apiFetch<{ notifications: { category: string; title: string }[] }>(
      "/api/notifications",
      parent.idToken,
    );
    expect(
      bell.notifications.some((n) => n.category === "accident" && n.title.includes(childName)),
    ).toBe(true);
    await parentCtx.close();
  });
});

test.describe("medication consent loop", () => {
  test.use({ storageState: statePath("parent") });

  test("parent authorises → operator records a dose → parent sees it", async ({ page, browser }) => {
    await page.goto("/custdash/medication");
    await page.getByRole("button", { name: /Authorise a medication/ }).click();
    const medName = `Salbutamol ${stamp}`;

    // Step 1 — provider, which child, and the medicine itself. The child is a
    // toggle chip, so it must read as selected before moving on.
    await page.locator("select").first().selectOption({ index: 0 });
    const childChip = page.getByRole("button", { name: childName, exact: false }).first();
    await expect(childChip).toBeVisible({ timeout: 15_000 });
    await childChip.click();
    await page.getByPlaceholder("e.g. Salbutamol inhaler").fill(medName);
    await page.getByPlaceholder("e.g. 2 puffs").fill("2 puffs");
    await page.getByRole("button", { name: "Next →", exact: true }).click();

    // Step 2 — when staff should give it. The default ("on every booked day")
    // is what this test wants, so just move on.
    await page.getByRole("button", { name: "Next →", exact: true }).click();

    // Step 3 — the consent tick is the authorising artefact.
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Authorise", exact: true }).click();
    await expect(page.getByText(/Medication authorised for .* — staff can now administer it\./)).toBeVisible({ timeout: 15_000 });

    // Operator records a dose against the consented medication.
    const opCtx = await browser.newContext({ storageState: statePath("company") });
    const opPage = await opCtx.newPage();
    await opPage.goto("/company/medication");
    await expect(opPage.getByText(medName).first()).toBeVisible({ timeout: 15_000 });
    await expect(opPage.getByText("consent on file").first()).toBeVisible();
    // Scope to THIS run's medication — earlier runs leave rows behind. Logging
    // a dose is one tap (Given? Yes) plus a confirm.
    // The form authorises one medication PER selected child, so the medicine
    // name alone can match several cards — scope to this child's.
    const medCard = cardWith(opPage, medName, childName);
    await medCard.getByRole("button", { name: "✓ Yes" }).click();
    await medCard.getByRole("button", { name: "Confirm", exact: true }).click();
    // The dose count must appear on THIS run's medication card.
    await expect(cardWith(opPage, medName, childName, /History \(1\)/)).toBeVisible({ timeout: 15_000 });
    await opCtx.close();

    // Parent sees the dose history on THIS run's medication.
    await page.reload();
    await cardWith(page, medName, childName).getByRole("button", { name: /Doses given \(1\)/ }).click();
    // The dose line inside OUR medication's card — every run doses "2 puffs".
    await expect(cardWith(page, medName, childName, /2 puffs/)).toBeVisible();
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
    // OUR child's order card: click ITS Mark-paid (a leftover unpaid order
    // from a failed run could sit first) and expect the paid badge on it.
    const orderCard = cardWith(page, childName);
    await expect(orderCard).toBeVisible({ timeout: 15_000 });
    await orderCard.getByRole("button", { name: "Mark paid" }).click();
    // exact: the "unpaid" badge and "Mark paid" button both contain "paid".
    await expect(cardWith(page, childName).getByText("paid", { exact: true })).toBeVisible({ timeout: 15_000 });
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
    await page.getByPlaceholder("A quick highlight for the parents…").fill(caption);
    // Consent enforcement: both children are in today's session, and both are
    // listed — but the one without photo consent is shown disabled and badged,
    // so staff can see who's there without being able to put them in a photo.
    // (`/api/moments` rejects the tag server-side too, so this is UX, not the
    // safeguard itself.)
    await expect(page.getByRole("button", { name: childName })).toBeEnabled({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: noConsentChild })).toBeDisabled();
    // Tag our consented child — the button is the child's name.
    await page.getByRole("button", { name: childName }).click();
    await page.getByRole("button", { name: /Post moment/ }).click();
    await expect(page.getByText(caption).first()).toBeVisible({ timeout: 20_000 });

    const parentCtx = await browser.newContext({ storageState: statePath("parent") });
    const parentPage = await parentCtx.newPage();
    await parentPage.goto("/custdash/moments");
    await expect(parentPage.getByText(caption)).toBeVisible({ timeout: 15_000 });
    await parentCtx.close();
  });
});
