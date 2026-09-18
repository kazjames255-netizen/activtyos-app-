import { test, expect } from "@playwright/test";
import { loadAccounts, statePath, type AccountManifest } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, apiFetch, apiPost, fbSignIn, fbSignUp } from "./helpers/accounts";
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
    // This test runs first in the file, right after global.setup — the busiest
    // point of a run (account provisioning + every other spec file's first
    // hit all landing on the dev server at once). No explicit budget before
    // meant the default 60s was shared with a 30s assertion below; give it
    // real room.
    test.setTimeout(120_000);
    await page.goto("/company/admin-registers");
    // The rebuilt register (July 2026) is a single-listing, single-day hero
    // view with no level-1 heading anywhere on the page (RegistersApp.tsx
    // renders a "Loading the register…" placeholder — no <h1> — until
    // `ready`, then the hero itself has no heading role at all). The
    // "Previous day" nav arrow only exists once the real content mounts, so
    // wait on that instead of a heading that was never there. The register
    // fetches a whole window of days up front (RegistersApp.tsx's `refresh`),
    // which is slow even warm under a busy dev server (same class of issue
    // documented elsewhere in this suite) — 30s occasionally isn't enough.
    await expect(page.getByLabel("Previous day")).toBeVisible({ timeout: 45_000 });

    // Point the register at OUR listing — other runs leave listings behind,
    // which turns the hero name into a dropdown picker. (Never target a bare
    // "▾": the sidebar's collapsible group headers carry the same caret.)
    if (!(await page.getByText(listing.title).first().isVisible().catch(() => false))) {
      await page.getByLabel("Choose listing").click();
      await page.getByPlaceholder("Search listings or venues…").fill(listing.title);
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
    // day's audit trail. Marking collected opens a native window.prompt()
    // asking who took the child (RegistersApp.tsx mark()) — an unhandled
    // dialog gets auto-dismissed (null), which the app reads as "cancelled"
    // and silently aborts the whole action, so a handler must be registered
    // before the click.
    page.once("dialog", (d) => d.accept("E2E Grandparent"));
    await row.getByRole("button", { name: "Collect", exact: true }).click();
    await expect(cardWith(page, childName, /In \d{2}:\d{2} · Out \d{2}:\d{2}/)).toBeVisible({ timeout: 15_000 });
  });

  test("newsfeed post reaches the booked family", async ({ page, browser }) => {
    // A second browser context's own page load plus the 30s parent-
    // visibility wait below doesn't fit the default 60s test budget.
    test.setTimeout(120_000);
    const body = `Bring wellies tomorrow! (${stamp})`;
    // The standing "company" fixture has a franchise joined, so /company/*
    // defaults to the head-office "all franchises" combined scope — posting
    // there targets the network, not this tenant's own direct bookings.
    // Force the tenant's own scope so the booked parent actually receives it.
    await page.goto("/company/newsfeed?hoScope=__ho__");
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
    // Confirmed via a direct /api/posts check that the data is correct
    // (franchiseId: null, tenantId matches) the moment this fails — it's the
    // page's own load/fetch that's slow under a busy dev server, not a
    // targeting bug. Same class of issue as other portal views' load times.
    await expect(parentPage.getByText(body)).toBeVisible({ timeout: 30_000 });
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
    // Same class of slow-load issue documented elsewhere in this suite —
    // this is the last of three page loads in the test, under load.
    await expect(outPage.getByText("No updates yet.")).toBeVisible({ timeout: 30_000 });
    await expect(outPage.getByText(body)).toBeHidden();
    await outCtx.close();
  });

  test("task can be added, completed and lands in Done", async ({ page }) => {
    // Same class of slow-load issue as its siblings in this file — missing
    // the timeout bump they already have.
    test.setTimeout(90_000);
    const title = `E2E task ${stamp}`;
    await page.goto("/company/tasks");
    await page.getByPlaceholder(/Quick add…/).fill(title);
    await page.getByRole("button", { name: "Quick add", exact: true }).click();

    // Quick-adds land unassigned, so they show on the Board (not "My tasks").
    await page.getByRole("button", { name: "Board", exact: true }).click();
    const card = page.locator('[data-ui="card"]').filter({ hasText: title }).last();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // The board no longer has a lone "Done" button (it could only move a
    // card one way) — status is set through the same dropdown the list view
    // uses (TasksApp.tsx). "Done" is one of its options at every status, so
    // it isn't a usable signal on its own — the "Archive" button only
    // renders once status === "done", so anchor on that instead.
    await card.getByLabel("Status").selectOption("done");
    await expect(card.getByRole("button", { name: "Archive" })).toBeVisible({ timeout: 15_000 });

    // Reload proves the completion persisted server-side rather than living
    // only in the optimistic local state.
    await page.reload();
    await page.getByRole("button", { name: "Board", exact: true }).click();
    await expect(
      page.locator('[data-ui="card"]').filter({ hasText: title }).last().getByRole("button", { name: "Archive" }),
    ).toBeVisible({ timeout: 15_000 });
  });
});

// Settings → Staff & workforce, enforced server-side: once the certifications
// register is in use, an expired DBS blocks rostering — and the rota surfaces
// the API's reason instead of silently saving. The rota view only exists on
// the freelancer/franchise/staff portals (company has no schedule slug), so
// this runs as the freelancer.
test.describe("staff & workforce policy", () => {
  test.use({ storageState: statePath("freelancer") });

  test("an expired DBS blocks adding a shift, with the reason shown", async ({ page }) => {
    // The rota (rebuilt as a per-role grid) only assigns shifts to someone
    // already on the tenant's rota ROSTER, picked from a list — never a
    // typed name. There's no UI to add an ad-hoc roster member (roster
    // entries otherwise only come from real staff logins), so seed one
    // directly via PUT /api/rota — the same API the UI itself saves
    // through — with a name matching the compliance record below, then
    // drive the actual block through the real save button.
    test.setTimeout(90_000);
    const who = `E2E Coach ${stamp}`;
    const op = await fbSignIn(accounts.freelancer.email);
    const cert = await apiPost<{ id: string }>("/api/compliance", op.idToken, {
      staffName: who, type: "DBS check", expiry: "2020-01-01",
    });
    const staffId = `e2e-${stamp}`;
    await apiFetch("/api/rota", op.idToken, {
      method: "PUT",
      body: JSON.stringify({ staff: [{ id: staffId, name: who }], shifts: [], sites: [] }),
    });
    await provisionLiveListing(accounts.freelancer, { title: `E2E Rota ${stamp}` });

    await page.goto("/freelancer/schedule");
    await expect(page.getByRole("heading", { name: /Staff schedule/ })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Add a new role/ }).first().click();
    await page.getByRole("button", { name: "Lead Coach" }).click();
    await page.getByRole("button", { name: "＋" }).first().click();
    await page.getByRole("button", { name: /Assign staff/ }).click();
    // The name also matches a sidebar "click to view/edit availability" row
    // for the same person, which carries a rate too ("…£0.00/hr" is in
    // BOTH), so a "£" alone doesn't disambiguate — only the sidebar row
    // carries the 🔔 reminder icon, so exclude that instead.
    await page.getByRole("button", { name: new RegExp(`^(?!.*🔔).*${who}`) }).click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/DBS has expired/)).toBeVisible({ timeout: 15_000 });

    // Remove the fixtures so no later test is policy-gated by them.
    await apiFetch(`/api/compliance/${cert.id}`, op.idToken, { method: "DELETE" });
    await apiFetch("/api/rota", op.idToken, { method: "PUT", body: JSON.stringify({ staff: [], shifts: [], sites: [] }) });
  });
});
