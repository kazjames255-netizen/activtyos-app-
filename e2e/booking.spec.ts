import { test, expect } from "@playwright/test";
import { loadAccounts, statePath } from "./helpers/env";
import { ensureVenue, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { cardWith, dismissParentWelcome } from "./helpers/ui";

// The platform's core journey. Two halves:
//   1. Operator builds a block and publishes a listing entirely through the UI.
//   2. Parent finds an (API-arranged) listing in Browse, books a child in,
//      and the operator's Bookings view — already open — updates live.

const stamp = () => Date.now().toString(36);

test.describe("operator publishes a listing via the wizard", () => {
  test.use({ storageState: statePath("freelancer") });

  test("blocks → wizard → published", async ({ page }) => {
    // The full block-build + wizard + publish flow is meaningfully more
    // than the default 60s budget under parallel-worker load.
    test.setTimeout(120_000);
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
    // Once a card is added its button flips to "✓ In block" + Undo, so it
    // drops out of this locator's matches — the remaining cards shift down
    // an index each time. Snapshot the count up front, then always click
    // index 0 (the next not-yet-added card), rather than nth(i) against a
    // shrinking live list.
    const addToBlock = page.getByRole("button", { name: "+ Add to block" });
    const cardCount = await addToBlock.count();
    for (let i = 0; i < cardCount; i++) await addToBlock.first().click();
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
    // Two browser contexts, an extra sign-in round trip for
    // markParentWelcomed, plus the full book→pay→confirm flow — 120s wasn't
    // enough under a busy dev server (same class of slow-load issue
    // documented elsewhere in this suite).
    test.setTimeout(150_000);
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

    // Parent finds the listing in Browse. Mark the one-time first-login
    // welcome modal (ParentWelcome.tsx) as seen server-side before
    // navigating, so it never opens at all — see markParentWelcomed's doc
    // comment for why dismissing it via the UI alone is racy.
    await markParentWelcomed(accounts.parent);
    await page.goto("/custdash/browse");
    await dismissParentWelcome(page);
    await page.getByPlaceholder("Search by name or venue…").fill(title);
    // Accessible name is "More details — <listing title>", not bare "More
    // details" (disambiguates cards from each other) — match the prefix.
    await page.getByRole("button", { name: /^More details/ }).first().click();
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
    // Boy/girl only renders once the provider's settings.collectGender loads
    // (async) — and becomes REQUIRED when it's on (checkout.tsx), blocking
    // "Add child" with an inline error if skipped. isVisible() never waits,
    // so it can race ahead of the button appearing and silently skip it —
    // wait briefly instead (same fix already applied in family.spec.ts).
    // This is the CHECKOUT flow's own child form (features/listings/
    // checkout.tsx), a different component from the parent-portal
    // ChildrenApp.tsx wizard — its Boy/Girl buttons carry no emoji prefix.
    const boyBtn = page.getByRole("button", { name: "Boy", exact: true });
    await boyBtn.waitFor({ state: "visible", timeout: 8_000 }).then(() => boyBtn.click()).catch(() => {});
    await page.getByRole("button", { name: "Add child", exact: true }).click();
    // The button reads "Next" only once every child is on a pass and any
    // provider-required custom question is answered (checkout.tsx's `ready`)
    // — otherwise it shows a guiding message instead ("Answer "…" for …",
    // "Put a child on every pass", etc). A required question can be added to
    // this shared tenant mid-run by another spec (settings-scheduling.spec.ts,
    // "All listings" scope) — same class of cross-spec race as elsewhere in
    // this suite. Answer generically rather than assume there is none.
    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    for (let guard = 0; !(await nextBtn.isVisible().catch(() => false)); guard++) {
      // A busy shared tenant can accumulate a genuinely large set of custom
      // questions (other specs add their own concurrently) — give this
      // plenty of room before concluding something's actually stuck.
      if (guard > 20) throw new Error("Children step never reached 'Next' — more blocking questions than expected.");
      // The child form can still be open if "Add child" was blocked by a
      // required field we hadn't filled yet — answer everything currently
      // visible FIRST, then submit, so a field revealed by an earlier
      // answer (e.g. a "tell us more" box that only appears after picking
      // Yes) gets picked up on submission rather than raced past.
      for (const box of await page.getByRole("textbox").all()) {
        if (await box.isVisible().catch(() => false) && !(await box.inputValue().catch(() => "x"))) await box.fill("N/A").catch(() => {});
      }
      for (const sel of await page.locator("select:visible").all()) {
        if (!(await sel.inputValue().catch(() => "x"))) {
          const firstReal = await sel.locator("option").nth(1).getAttribute("value").catch(() => null);
          if (firstReal) await sel.selectOption(firstReal).catch(() => {});
        }
      }
      for (const yes of await page.getByRole("button", { name: "Yes", exact: true }).all()) {
        if (await yes.isVisible().catch(() => false)) await yes.click().catch(() => {});
      }
      if (await boyBtn.isVisible().catch(() => false)) await boyBtn.click().catch(() => {});
      const addChildBtn = page.getByRole("button", { name: "Add child", exact: true });
      if (await addChildBtn.isVisible().catch(() => false)) await addChildBtn.click().catch(() => {});
      await page.waitForTimeout(400);
    }
    await nextBtn.click();

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
