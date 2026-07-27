import { test, expect } from "@playwright/test";
import { loadAccounts, statePath } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, apiPost, fbSignIn } from "./helpers/accounts";
import { cardWith } from "./helpers/ui";

// Cross-account journeys beyond booking: staff invite → join, operator ↔
// parent messaging, and invoicing. Each flow uses the UI end to end; only
// prerequisites (a customer record) are arranged through the API.

test.describe("team invites", () => {
  test.use({ storageState: statePath("company"), permissions: ["clipboard-read", "clipboard-write"] });

  test("operator creates a link invite; a new staff member joins through it", async ({ page, browser }) => {
    await page.goto("/company/staff");
    await expect(page.getByRole("heading", { name: "Team & invites" })).toBeVisible();

    // Link-only invite: leave the email blank.
    await page.getByRole("button", { name: "+ Invite staff" }).click();
    await page.getByRole("button", { name: "Copy link" }).first().click();
    const inviteUrl = await page.evaluate(() => navigator.clipboard.readText());
    expect(inviteUrl).toContain("/signup?invite=");
    // The row renders the token's tail — the anchor that identifies OUR invite.
    const tokenTail = inviteUrl.split("invite=")[1].slice(-8);

    // A fresh browser profile (signed out) follows the link and joins.
    const invitee = `e2e-invitee-${Date.now().toString(36)}@${TEST_EMAIL_DOMAIN}`;
    const ctx = await browser.newContext();
    const joinPage = await ctx.newPage();
    await joinPage.goto(inviteUrl);
    await expect(joinPage.getByRole("heading", { name: /^Join / })).toBeVisible();
    await joinPage.getByLabel("Your name").fill("E2E Invited Staff");
    await joinPage.getByLabel("Email").fill(invitee);
    await joinPage.getByLabel("Password").fill(TEST_PASSWORD);
    await joinPage.getByRole("button", { name: /^Join / }).click();
    await joinPage.waitForURL("**/staff/dash", { timeout: 30_000 });
    await ctx.close();

    // OUR invite's row flips to Used (live via SSE — poll with a reload as
    // backstop). Earlier runs leave Used rows behind, so never match the
    // badge alone.
    await expect(async () => {
      await page.goto("/company/staff");
      await expect(cardWith(page, tokenTail, "Used")).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });

    // A used invite is dead: following the same link again must hit the
    // invite-problem card, never the join form.
    const reuseCtx = await browser.newContext();
    const reusePage = await reuseCtx.newPage();
    await reusePage.goto(inviteUrl);
    await expect(reusePage.getByRole("heading", { name: "Invite problem" })).toBeVisible({ timeout: 15_000 });
    await expect(reusePage.getByRole("heading", { name: /^Join / })).toBeHidden();
    await reuseCtx.close();
  });
});

test.describe("messages", () => {
  test.use({ storageState: statePath("company") });

  test("operator messages a family; parent sees it and replies", async ({ page, browser }) => {
    const accounts = loadAccounts().accounts;
    const stamp = Date.now().toString(36);
    const familyName = `E2E Family ${stamp}`;

    // The composer only offers existing customers — arrange one whose email
    // is the parent test account's (threads match on email, not uid).
    const op = await fbSignIn(accounts.company.email);
    await apiPost("/api/customers", op.idToken, {
      name: familyName,
      email: accounts.parent.email,
      children: [{ name: "E2E Kid", age: 8 }],
    });

    await page.goto("/company/messages");
    await page.getByRole("button", { name: /Message customers/ }).click();

    // Family picker: expand if collapsed, search, tick our family.
    const expand = page.getByText(/selected · choose families/);
    if (await expand.isVisible().catch(() => false)) await expand.click();
    const search = page.getByPlaceholder("Search families by name, place or email…");
    if (await search.isVisible().catch(() => false)) await search.fill(familyName);
    await page.getByText(familyName).first().click();

    const msgText = `Hello from your provider! (${stamp})`;
    await page.getByPlaceholder(/Write a message/).fill(msgText);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    // The composer clears only on a successful send (React mirrors the draft
    // into the DOM, so text-visibility alone can false-positive).
    await expect(page.getByPlaceholder(/Write a message/)).toHaveValue("", { timeout: 15_000 });
    await expect(page.getByText(msgText).first()).toBeVisible({ timeout: 15_000 });

    // Parent side: open OUR thread by its unique preview — the provider's
    // name is ambiguous (it also titles broadcast threads and the "start a
    // new conversation" row).
    const parentCtx = await browser.newContext({ storageState: statePath("parent") });
    const parentPage = await parentCtx.newPage();
    await parentPage.goto("/custdash/messages");
    await parentPage.getByText(msgText).first().click();
    await expect(parentPage.getByPlaceholder(/Write a message/)).toBeVisible({ timeout: 15_000 });

    const reply = `Thanks, see you then! (${stamp})`;
    await parentPage.getByPlaceholder(/Write a message/).fill(reply);
    await parentPage.getByRole("button", { name: "Send", exact: true }).click();
    await expect(parentPage.getByPlaceholder(/Write a message/)).toHaveValue("", { timeout: 15_000 });
    await parentCtx.close();

    // Operator sees the reply (SSE refresh, no reload needed) — in the thread
    // list preview and the open conversation.
    await expect(page.getByText(reply).first()).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("invoices", () => {
  test.use({ storageState: statePath("company") });

  test("operator drafts an invoice; it shows in the ledger as Draft", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const customer = `E2E Invoice Family ${stamp}`;

    await page.goto("/company/purchasing");
    await expect(page.getByRole("heading", { name: "Money in", level: 1 })).toBeVisible();
    // Make the Invoices side active explicitly (it's the default today, but
    // the side toggle survives redesigns better than assuming the default).
    await page.getByRole("button", { name: "📄 Invoices" }).click();

    await page.getByRole("button", { name: /New invoice/ }).first().click();
    await expect(page.getByText("New invoice", { exact: true })).toBeVisible();
    await page.getByPlaceholder("Customer or business name").fill(customer);
    await page.getByPlaceholder("e.g. Coaching — 2 hrs").fill("Coaching session");
    // The line row's two spinners are Qty then Unit £.
    await page.locator('input[type="number"]').nth(1).fill("25");
    await page.getByRole("button", { name: /Save & view/ }).click();

    // Saving opens the printable preview as a draft — assert inside the
    // preview card (the ledger behind it can hold old £25 invoices).
    const preview = cardWith(page, customer, "Saved as a draft");
    await expect(preview).toBeVisible({ timeout: 15_000 });
    await expect(preview.getByText("INVOICE", { exact: true })).toBeVisible();
    await expect(preview.getByText("Total £25.00").first()).toBeVisible();
    await page.getByRole("button", { name: /Close/ }).click();

    // Ledger: OUR invoice's row holds the status select, set to Draft.
    await page.getByRole("button", { name: /All invoices/ }).click();
    const ledgerRow = cardWith(page, customer);
    await expect(ledgerRow).toBeVisible();
    await expect(ledgerRow.locator("select")).toHaveValue("draft");
  });
});
