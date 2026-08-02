import { test, expect } from "@playwright/test";
import { loadAccounts, statePath } from "./helpers/env";
import { ensureVenue, provisionLiveListing } from "./helpers/tenantData";
import { cardWith } from "./helpers/ui";

// The platform's core journey. Two halves:
//   1. Operator builds a block and publishes a listing entirely through the UI.
//   2. Parent finds an (API-arranged) listing in Browse, books a child in,
//      and the operator's Bookings view — already open — updates live.

const stamp = () => Date.now().toString(36);

test.describe("operator publishes a listing via the wizard", () => {
  test.use({ storageState: statePath("freelancer") });

  test("blocks → wizard → published", async ({ page }) => {
    const accounts = loadAccounts().accounts;
    await ensureVenue(accounts.freelancer);
    const title = `E2E Wizard Camp ${stamp()}`;

    // Build a block bundle: one period, one pass, into the library.
    await page.goto("/freelancer/blocks");
    await expect(page.getByRole("heading", { level: 2, name: "Sessions & blocks" })).toBeVisible();
    // Unique names so we can wait for OUR cards (cards render async, and
    // earlier runs leave cards behind). Everything on the board goes into the
    // block — extras are harmless, missing passes are not.
    const periodName = `Full day ${stamp()}`;
    const passName = `Day pass ${stamp()}`;
    await page.getByRole("button", { name: "+ Add a period" }).click();
    await page.getByPlaceholder("Period title").fill(periodName);
    await page.getByRole("button", { name: "Add period", exact: true }).click();
    await expect(page.getByText(periodName).first()).toBeVisible();
    await page.getByRole("button", { name: "+ Add a pass" }).click();
    await page.getByPlaceholder("Pass name (e.g. 5-day week pass)").fill(passName);
    await page.getByRole("button", { name: "Add pass", exact: true }).click();
    await expect(page.getByText(passName).first()).toBeVisible();
    // Cards are reusable, so their button stays after a click — click each
    // one exactly once to put every period/pass on the board into the block.
    const addToBlock = page.getByRole("button", { name: "+ Add to block" });
    const cardCount = await addToBlock.count();
    for (let i = 0; i < cardCount; i++) await addToBlock.nth(i).click();
    const blockName = `E2E Block ${stamp()}`;
    await page.getByPlaceholder("e.g. Summer Multi Activity Camp — Loughton").fill(blockName);
    await page.getByRole("button", { name: /Move to Block Library/ }).click();
    const savePricing = page.getByRole("button", { name: "Save pricing" }).first();
    if (await savePricing.isVisible().catch(() => false)) await savePricing.click();

    // Wizard (full-page slideshow): title + venue (Basics), dates (When it
    // runs), block (Tickets & pricing), publish. The step nav is a segmented
    // progress bar whose buttons carry only a title ("7. When it runs") — no
    // accessible name — so navigate by title, without the number (steps get
    // renumbered when Kaz splits one).
    await page.goto("/freelancer/listings");
    await page.getByRole("button", { name: /New listing/ }).click();
    await page.getByPlaceholder("e.g. Summer Multi-Activity Camp").fill(title);
    // The venue lives on the Details step since the Basics→Details split.
    await page.getByTitle(/\. Details$/).click();
    await page.locator("select").filter({ hasText: "Select a venue…" }).selectOption({ index: 1 });

    await page.getByTitle(/\. When it runs$/).click();
    const from = new Date();
    from.setDate(from.getDate() + (((8 - from.getDay()) % 7) || 7)); // next Monday
    const to = new Date(from);
    to.setDate(to.getDate() + 11);
    // Local date parts — toISOString() is UTC and walks a BST midnight back a day.
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    // getByLabel, NOT input[type=date] — the listings page behind the overlay
    // has a "Runs on" date filter that a bare locator matches first.
    await page.getByLabel("Runs from").fill(iso(from));
    await page.getByLabel("Runs to").fill(iso(to));

    // Pick OUR block — leftover blocks from earlier runs may sit first.
    await page.getByTitle(/\. Tickets & pricing$/).click();
    await page.getByRole("button", { name: blockName }).click();

    // The header Publish button carries the blocker count in its name
    // ("Publish (2)") until the listing is ready — so an exact-name match
    // doubles as the readiness wait (the old "ready to publish" band is gone).
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Publish", exact: true }).click();

    // Back on the list: THIS listing's card shows Published (any old listing
    // would satisfy an unscoped badge check).
    await expect(cardWith(page, title, "Published")).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("parent books; operator sees it live", () => {
  test.use({ storageState: statePath("parent") });

  test("browse → book free place → confirmation → live operator row", async ({ page, browser }) => {
    const accounts = loadAccounts().accounts;
    const s = stamp();
    const title = `E2E Camp ${s}`;
    const childName = `E2E Kid ${s}`;
    const listing = await provisionLiveListing(accounts.company, { title, price: 0 });

    // Operator watches Bookings BEFORE the parent books — proves SSE.
    const opCtx = await browser.newContext({ storageState: statePath("company") });
    const opPage = await opCtx.newPage();
    await opPage.goto("/company/bookings");
    await expect(opPage.getByRole("heading", { level: 2, name: "Bookings" })).toBeVisible();

    // Parent finds the listing in Browse.
    await page.goto("/custdash/browse");
    await page.getByPlaceholder("Search by name or venue…").fill(title);
    await page.getByRole("button", { name: "More details", exact: true }).first().click();
    await page.waitForURL(`**/book/${listing.id}`);

    // Pick the pass (then a timing, if the bundle offers periods), one day,
    // add to basket, on to children.
    await page.getByRole("button", { name: /Day pass · £/ }).first().click();
    const timing = page.getByText(/choose a timing/i);
    if (await timing.isVisible().catch(() => false)) {
      await page.getByRole("button", { name: /Full day/ }).first().click();
    }
    await expect(page.getByText(/choose (your|any) dates/i)).toBeVisible();
    await page.getByRole("button", { name: /^(Mon|Tue|Wed|Thu|Fri) \d+$/ }).first().click();
    await page.getByRole("button", { name: /Add .* to basket/ }).click();
    await page.getByRole("button", { name: /Next — add children/ }).click();

    // New child with the minimum the provider requires.
    await page.getByRole("button", { name: /Add a new child/ }).click();
    await page.getByPlaceholder("First and last name").fill(childName);
    const dob = page.locator('input[type="date"]').first();
    if (await dob.isVisible().catch(() => false)) await dob.fill("2018-05-14");
    const boy = page.getByRole("button", { name: "Boy", exact: true });
    if (await boy.isVisible().catch(() => false)) await boy.click();
    await page.getByRole("button", { name: "Add child", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Free booking: no payment method, just confirm.
    await expect(page.getByText("Nothing to pay.")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("heading", { name: /Congratulations/ })).toBeVisible({ timeout: 30_000 });
    // Capture OUR reference — the operator-side check must look for exactly it.
    const refLine = await page.getByText(/Reference[s]? APF-\d+/).textContent();
    const ref = refLine?.match(/APF-\d+/)?.[0];
    expect(ref, "confirmation should show a booking reference").toBeTruthy();

    // Parent's own bookings list shows it. Anchor on OUR ref, not the listing
    // title: the rebuilt hub has an "All activities" filter whose <option>s
    // carry every listing name, so getByText(title).first() resolves to a
    // hidden option and proves nothing.
    await page.getByRole("link", { name: "See my bookings" }).click();
    await page.waitForURL("**/custdash/bookings");
    await expect(page.getByText(`Ref ${ref}`).first()).toBeVisible({ timeout: 15_000 });

    // The operator's already-open Bookings view received it via SSE — no reload.
    await expect(opPage.getByText(childName).first()).toBeVisible({ timeout: 25_000 });
    await expect(opPage.getByText(`Ref ${ref}`).first()).toBeVisible();
    await opCtx.close();
  });
});
