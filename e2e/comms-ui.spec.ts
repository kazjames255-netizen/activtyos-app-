import { test, expect, type Page } from "@playwright/test";
import { loadAccounts, statePath, type AccountManifest } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { dismissParentWelcome } from "./helpers/ui";

// The notification bell, end to end in a real browser, per role (plan3 P8):
// a fresh accident rings the PARENT's bell (badge -> panel -> deep link -> badge
// clears), a fresh booking rings the operator's bell with a deep link to that
// booking, and a franchise/staff bell never shows head office's alerts.

test.describe.configure({ mode: "serial" });
const stamp = Date.now().toString(36);
const kid = `E2E Bell Kid ${stamp}`;
let accounts: AccountManifest["accounts"];
let bookingRef = "";

const bellButton = (page: Page) => page.getByRole("button", { name: /^Notifications/ });

test.beforeAll(async () => {
  test.setTimeout(150_000);
  accounts = loadAccounts().accounts;
  await createParentChild(accounts.parent, { name: kid });
  const listing = await provisionLiveListing(accounts.company, { title: `E2E Bell Camp ${stamp}`, price: 0 });
  bookingRef = (await bookViaApi(accounts.parent, listing, { child: kid })).ref;
  const par = await fbSignIn(accounts.parent.email);
  const childId = (await apiFetch<{ id: string; name: string }[]>("/api/my/children", par.idToken)).find((c) => c.name === kid)!.id;
  const staff = await fbSignIn(accounts.staff.email);
  await apiPost("/api/incidents", staff.idToken, {
    kind: "accident", date: new Date().toISOString().slice(0, 10), childId, childName: kid,
    description: `E2E bell accident ${stamp}`, severity: "minor",
  });
  await markParentWelcomed(accounts.parent);
});

test.describe("parent bell", () => {
  test.use({ storageState: statePath("parent") });
  test("badge, panel entry, deep link, and the badge clears once opened", async ({ page }) => {
    test.setTimeout(90_000);
    await dismissParentWelcome(page);
    await page.goto("/custdash/bookings");
    await expect(bellButton(page)).toHaveAttribute("aria-label", /\d+ new/, { timeout: 30_000 });
    await bellButton(page).click();
    const entry = page.getByRole("button", { name: new RegExp(`An accident was recorded for ${kid}`) }).first();
    await expect(entry).toBeVisible();
    await entry.click();
    await expect(page).toHaveURL(/\/custdash\/accidents/);
    await page.reload();
    // Opening the panel marked everything read: no "N new" on the bell any more.
    await expect(bellButton(page)).not.toHaveAttribute("aria-label", /\d+ new/, { timeout: 30_000 });
  });
});

test.describe("operator bells", () => {
  test.describe("company", () => {
    test.use({ storageState: statePath("company") });
    test("new booking rings the bell and deep-links to that booking", async ({ page }) => {
      test.setTimeout(90_000);
      await page.goto("/company/dashboard");
      await expect(bellButton(page)).toBeVisible({ timeout: 30_000 });
      await bellButton(page).click();
      const entry = page.getByRole("button", { name: new RegExp(bookingRef) }).first();
      await expect(entry).toBeVisible({ timeout: 20_000 });
      await entry.click();
      await expect(page).toHaveURL(new RegExp(`/company/bookings\\?ref=${bookingRef}`));
    });
  });

  test.describe("staff", () => {
    test.use({ storageState: statePath("staff") });
    test("staff never see head office's booking alerts", async ({ page }) => {
      test.setTimeout(60_000);
      await page.goto("/staff/dash");
      await expect(bellButton(page)).toBeVisible({ timeout: 30_000 });
      await bellButton(page).click();
      // Panel has finished loading (either rows or the empty state) before asserting absence.
      await expect(page.getByText(/Nothing yet|\d+[mhd] ago|just now/).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(bookingRef)).toHaveCount(0);
    });
  });

  test.describe("franchise", () => {
    test.use({ storageState: statePath("franchise") });
    test("a franchise never sees head office's booking alerts", async ({ page }) => {
      test.setTimeout(60_000);
      await page.goto("/franchise/dash");
      await expect(bellButton(page)).toBeVisible({ timeout: 30_000 });
      await bellButton(page).click();
      // Panel has finished loading (either rows or the empty state) before asserting absence.
      await expect(page.getByText(/Nothing yet|\d+[mhd] ago|just now/).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(bookingRef)).toHaveCount(0);
    });
  });
});
