import { test, expect } from "@playwright/test";
import { loadAccounts, statePath, type AccountManifest } from "./helpers/env";
import { apiFetch, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, markParentWelcomed, provisionLiveListing, type ProvisionedListing } from "./helpers/tenantData";
import { cardWith, dismissParentWelcome } from "./helpers/ui";

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
    // A multi-step wizard plus a second browser context's own navigation is
    // meaningfully more than the default 60s budget under load.
    test.setTimeout(120_000);
    // The standing "company" fixture has a franchise joined to it (global
    // setup, for the invite/franchise-portal specs), so without a scope this
    // lands on the head-office "all franchises" combined view (HoOversightApp),
    // which is read-only and has no "Log first aid" button. Scope to the head
    // office's own direct operation, same as e2e/settings-scheduling.spec.ts.
    await page.goto("/company/accidents?hoScope=__ho__");
    // The view was renamed Accidents → "First aid" (July 2026 manual pass).
    await page.getByRole("button", { name: /Log first aid/ }).click();

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
    await dismissParentWelcome(parentPage);
    // Same class of slow-load issue documented elsewhere in this suite
    // (e.g. dayops.spec.ts's newsfeed test) — the record is confirmed saved
    // (asserted on the operator side above); the parent page's own realtime
    // reconnect + refetch round trip can outrun 15s under a busy dev server.
    await expect(cardWith(parentPage, childName, "Tripped during warm-up")).toBeVisible({ timeout: 30_000 });

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
    // Multi-context (parent + operator) plus a full page reload partway
    // through — same class of multi-step test as "accidents" above, which
    // already needed 120s; this one was missing the same bump.
    test.setTimeout(120_000);
    // Mark the welcome popup seen server-side before navigating, so it never
    // opens at all — see markParentWelcomed's doc comment for why dismissing
    // it via the UI alone is racy.
    await markParentWelcomed(loadAccounts().accounts.parent);
    await page.goto("/custdash/medication");
    await dismissParentWelcome(page);
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
    // Same franchise-linked-fixture issue as the accidents test above — scope
    // to the head office's own direct operation, not the read-only combined view.
    await opPage.goto("/company/medication?hoScope=__ho__");
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

  // Meals is now a menu-builder (Saved menus → Season & listing → Menu →
  // Days, features/meals/MenuPlanner.tsx + SavedMenus.tsx) feeding a
  // parent-side weekly timetable (features/meals/ParentMealsApp.tsx) that
  // pays through a real Stripe PayModal. This drives the real operator +
  // parent UI end to end: build a saved menu, drop it onto today (the
  // listing this describe block's booked child already runs on today),
  // then have the parent pick it and start paying. It stops at the PayModal
  // rather than completing a charge — this dev environment has no
  // STRIPE_SECRET_KEY configured (same known gap as payments.spec.ts /
  // subscription-billing.spec.ts), so /api/payments/checkout deterministically
  // 503s with "Payments aren't configured" — asserting on THAT is the honest
  // boundary of what's testable here, and still proves the order reached the
  // server unpaid and the parent-side pay flow wired up correctly.
  const fmtDateTile = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });

  test("operator plans a menu; parent picks a meal and starts paying", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const menuName = `E2E Meal Menu ${stamp}`;
    const dishName = `E2E Hot Lunch ${stamp}`;
    const todayIso = iso(new Date());

    await page.goto("/company/meals?hoScope=__ho__");

    // 1 · Saved menus — build a one-dish menu.
    await page.getByRole("button", { name: "Saved menus" }).click();
    await page.getByRole("button", { name: /New menu/ }).click();
    await page.getByPlaceholder("e.g. Summer week A").fill(menuName);
    await page.getByPlaceholder("Hot lunch — chicken").fill(dishName);
    await page.locator('input[type="number"]').first().fill("3.50");
    await page.getByRole("button", { name: "Save menu" }).click();
    await expect(cardWith(page, menuName)).toBeVisible({ timeout: 15_000 });

    // 2 · Season & listing — point the planner at this run's live listing
    // (the one the top-of-file beforeAll already booked childName onto,
    // running today). If this tenant has seasons configured the listing
    // picker only reveals itself once a season's picked — "All" always works.
    await page.getByRole("button", { name: "1 · Season & listing" }).click();
    // The listing picker only renders once a season's been touched (or the
    // tenant has none at all) — touching "All seasons" first, when the
    // picker exists, reveals it.
    const seasonSelect = page.locator('select[title="Filter to a season"]');
    if (await seasonSelect.count()) await seasonSelect.selectOption("");
    const listingSelect = page.locator("select").last();
    await expect(listingSelect).toBeVisible({ timeout: 10_000 });
    await listingSelect.selectOption({ label: listing.title });

    // 3 · Days — pick the menu as the "brush", then drop it onto today's tile.
    await page.getByRole("button", { name: "3 · Days" }).click();
    await page.getByRole("button", { name: menuName, exact: true }).click();
    await page.getByText(fmtDateTile(todayIso), { exact: true }).click();
    await page.getByRole("button", { name: /Save plan/ }).click();

    // Confirm the plan actually landed server-side (the "Days" tab's own
    // flash text is easy to miss a repaint of under a busy dev server).
    const companySignIn = await fbSignIn(accounts.company.email);
    await expect
      .poll(
        async () => {
          const l = await apiFetch<{ mealsEnabled?: boolean; mealPlan?: Record<string, unknown> }>(
            `/api/listings/${encodeURIComponent(listing.id)}`,
            companySignIn.idToken,
          );
          return !!l.mealsEnabled && !!l.mealPlan?.[todayIso];
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    // Parent side: pick today's meal for the booked child, then start paying.
    await markParentWelcomed(accounts.parent);
    const parentCtx = await browser.newContext({ storageState: statePath("parent") });
    const parentPage = await parentCtx.newPage();
    await parentPage.goto("/custdash/meals");
    await dismissParentWelcome(parentPage);
    const cell = parentPage.getByLabel(`Meal for ${childName} on `, { exact: false });
    await expect(cell).toBeVisible({ timeout: 20_000 });
    // Index 0 is the "— choose —" placeholder; index 1 is our one dish.
    await cell.selectOption({ index: 1 });
    await expect(parentPage.getByText(dishName).first()).toBeVisible({ timeout: 10_000 });

    await parentPage.getByRole("button", { name: /💳 Pay/ }).click();
    await expect(parentPage.getByText(/Pay for your meal/)).toBeVisible({ timeout: 15_000 });
    // The deterministic 503 documented above — proves the order was created
    // and priced server-side, and the pay flow is wired up correctly.
    await expect(parentPage.getByText(/Payments aren.t configured/)).toBeVisible({ timeout: 15_000 });
    await parentPage.getByRole("button", { name: "Close" }).click();
    await parentCtx.close();

    // The order itself reached the server, priced correctly, and unpaid.
    const parentSignIn = await fbSignIn(accounts.parent.email);
    const orders = await apiFetch<{ childName: string; date: string; total: number; pay: string }[]>(
      "/api/meal-orders",
      parentSignIn.idToken,
    );
    const ours = orders.find((o) => o.childName === childName && o.date === todayIso);
    expect(ours, "the parent's meal order should have reached the server").toBeTruthy();
    expect(ours!.total).toBe(3.5);
    expect(ours!.pay).toBe("Unpaid");
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
    // The upload opens a full-screen square-crop modal (z-60) — it must be
    // confirmed, or it silently swallows every later click (fills still land,
    // which is why only the click steps ever failed).
    await page.getByRole("button", { name: "Use photo" }).click();
    await page.getByPlaceholder("A quick highlight for the parents…").fill(caption);
    // Consent enforcement. Tagging is a focus-gated SEARCH dropdown now (12
    // rows max), so each child must be searched by their run-stamped name —
    // the consented one is clickable, the no-consent one renders disabled
    // with a "no photos" badge. (`/api/moments` rejects the tag server-side
    // too, so this is UX, not the safeguard itself.)
    const childSearch = page.getByPlaceholder("Search child, parent or email…");
    await childSearch.fill(childName);
    await expect(page.getByRole("button", { name: childName })).toBeEnabled({ timeout: 15_000 });
    await page.getByRole("button", { name: childName }).click();
    await childSearch.fill(noConsentChild);
    await expect(page.getByRole("button", { name: noConsentChild })).toBeDisabled({ timeout: 15_000 });
    await page.getByRole("button", { name: /Post moment/ }).click();
    await expect(page.getByText(caption).first()).toBeVisible({ timeout: 20_000 });

    const parentCtx = await browser.newContext({ storageState: statePath("parent") });
    const parentPage = await parentCtx.newPage();
    await parentPage.goto("/custdash/moments");
    await expect(parentPage.getByText(caption)).toBeVisible({ timeout: 15_000 });
    await parentCtx.close();
  });
});
