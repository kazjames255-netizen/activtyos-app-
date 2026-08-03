import { test, expect } from "@playwright/test";
import { API_URL, loadAccounts, statePath } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { arrangeEnquirer, wizardToContent } from "./helpers/email";

// The Email client's backend round trips: an inbound email (webhook → store)
// shows in the Inbox and can be filed; a scheduled send lists under Inbox →
// Scheduled and can be cancelled before it fires; the 4-step campaign wizard
// (Name → Audience → Subject → Content) sends both a worded email and a
// designed one for real. The send engine itself (delivery counts, open pixel,
// merge fields) is covered at the API layer — this spec proves the UI is
// wired to the real store, not local state.
//
// Assertion anchors: every subject carries this run's stamp, so a match can
// only be OUR row (rows here aren't shared-Card, so cardWith doesn't apply).

test.describe("email client", () => {
  test.use({ storageState: statePath("company") });

  test("inbound mail reaches the Inbox and files to Archive; a scheduled send is cancellable", async ({ page }) => {
    const accounts = loadAccounts();
    const stamp = Date.now().toString(36);
    const inboundSubject = `E2E inbound ${stamp}`;
    const schedSubject = `E2E sched ${stamp}`;

    // Arrange 1: a mail platform delivers an email via the inbound webhook.
    const inbound = await fetch(`${API_URL}/api/emails/inbound`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-inbound-secret": process.env.INBOUND_EMAIL_SECRET || "dev-inbound" },
      body: JSON.stringify({
        tenantId: accounts.accounts.company.tenantId,
        from: "E2E Sender", fromEmail: "sender@example.com",
        subject: inboundSubject, text: `Inbound body ${stamp}`,
      }),
    });
    expect(inbound.status).toBe(201);

    // Arrange 2: a queued send an hour out (exactly what the composer's
    // Schedule button posts).
    const op = await fbSignIn(accounts.accounts.company.email);
    const at = new Date(Date.now() + 60 * 60_000);
    const p = (n: number) => String(n).padStart(2, "0");
    const sendAt = `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}T${p(at.getHours())}:${p(at.getMinutes())}`;
    await apiPost("/api/emails/schedule", op.idToken, {
      subject: schedSubject, body: "See you tomorrow.",
      audience: "one", to: `e2e-sched-${stamp}@${TEST_EMAIL_DOMAIN}`, sendAt,
    });

    // The Inbox (default tab) lists the inbound message.
    await page.goto("/company/email");
    await expect(page.getByText(inboundSubject)).toBeVisible({ timeout: 20_000 });

    // Open it and archive from the reader; it leaves the Inbox list…
    await page.getByText(inboundSubject).click();
    await page.getByRole("button", { name: "🗄 Archive" }).click();
    await expect(page.getByText(inboundSubject)).toBeHidden();
    // …and shows under the Archive folder (a server-side move, not local state).
    await page.getByRole("button", { name: /^Archive/ }).click();
    await expect(page.getByText(inboundSubject)).toBeVisible();

    // The Scheduled folder lists the queued send with its firing time.
    await page.getByRole("button", { name: /^Scheduled/ }).click();
    await expect(page.getByText(schedSubject)).toBeVisible();
    // Cancel it (confirm dialog) — the row goes, and the queue records the
    // cancellation server-side. Scope to OUR row: other specs also queue
    // scheduled sends for this tenant, so a bare "✕ Cancel" goes ambiguous
    // under the parallel run.
    page.once("dialog", (d) => void d.accept());
    await page.locator("div.flex").filter({ hasText: schedSubject }).last()
      .getByRole("button", { name: "✕ Cancel", exact: true }).click();
    await expect(page.getByText(schedSubject)).toBeHidden({ timeout: 15_000 });
  });

  test("the composer sends for real; the send lands in the Sent folder", async ({ page }) => {
    const accounts = loadAccounts();
    const stamp = Date.now().toString(36);
    const subject = `E2E compose ${stamp}`;

    await page.goto("/company/email");
    // TabStrip "Compose" (exact — the Inbox sidebar has its own "✎ Compose").
    await page.getByRole("button", { name: "Compose", exact: true }).click();

    // Before anything is sent, the composer states the identity the mail will
    // carry — THIS run's provider name, not the platform's, and a real reply
    // address (GET /api/emails/sender, openapi v0.32.0).
    const sendingAs = page.locator('[data-ui="sending-as"]');
    await expect(sendingAs).toContainText(accounts.accounts.company.tenantName!, { timeout: 15_000 });
    await expect(sendingAs).toContainText("replies go to");
    await page.locator('select:has-text("A single address")').selectOption("one");
    await page.getByPlaceholder("name@example.com", { exact: true }).fill(`e2e-compose-${stamp}@${TEST_EMAIL_DOMAIN}`);
    await page.locator('div:has(> label:text-is("Subject")) input').fill(subject);
    await page.locator('[contenteditable="true"]').fill(`Hello from the e2e run ${stamp}.`);
    await page.getByRole("button", { name: /^Send to 1 recipient$/ }).click();

    // The undo window (default 5s) counts down, then the send actually fires.
    await expect(page.getByText(/^Sent to 1 recipient/)).toBeVisible({ timeout: 25_000 });

    // It's in the real history — the Inbox's Sent folder lists it.
    await page.getByRole("button", { name: "Inbox", exact: true }).click();
    await page.getByRole("button", { name: /^Sent/ }).click();
    await expect(page.getByText(subject)).toBeVisible({ timeout: 15_000 });
  });

  // The campaign modal is a 4-step wizard (Name → Audience → Subject →
  // Content); Send lives on the Content step. Shared steps live in
  // helpers/email.ts: arrange an opted-in enquirer (PECR split-default —
  // without explicit opt-in the send filters a never-booked contact out),
  // then walk to Content with the enquiries segment as the only audience.
  async function walkToContent(page: import("@playwright/test").Page, stamp: string, name: string) {
    await arrangeEnquirer(stamp);
    await wizardToContent(page, name);
  }

  test("the campaign wizard sends a worded email (with countdown) to a live segment", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const name = `E2E campaign ${stamp}`;
    await walkToContent(page, stamp, name);

    // Step 4 — Content: worded template is the default mode. Write a body and
    // add the big countdown (toggling it self-fills a date two weeks out, so
    // the "included" banner proves the email will render the HTML clock).
    await page.locator("textarea").fill(`Hello from the e2e wizard ${stamp}.`);
    await page.getByRole("button", { name: "⏱ Countdown" }).click();
    await expect(page.getByText(/Countdown included/)).toBeVisible();
    await page.getByRole("button", { name: "Send now" }).click();

    // A worded send closes the modal on success; the list shows the SERVER's
    // send record with a live status — "Sending" until the transport hand-off
    // settles, then "Sent".
    const row = page.locator("div.grid").filter({ hasText: name }).last();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row.getByText(/Sent|Sending/)).toBeVisible({ timeout: 15_000 });
  });

  test("a designed campaign sends, saves as a ⭐ My template and is reusable", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const name = `E2E design ${stamp}`;
    const savedName = `E2E saved ${stamp}`;
    await walkToContent(page, stamp, name);

    // Step 4 — Content: switch to the designer and start from a gallery
    // template (the card footer name is unique; the click lands on the card).
    await page.getByRole("button", { name: "🎨 Design your own" }).click();
    await page.getByRole("button", { name: "🎨 Go to new builder" }).click();
    await page.getByText("Multi-activity camp", { exact: true }).click();
    await page.getByRole("button", { name: "✓ I'm ready to send" }).click();

    // Back in the wizard with the design attached; send it.
    await expect(page.getByText("Your design", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Send now" }).click();

    // A designed send offers to save the design under a name before closing.
    await expect(page.getByText(/^Sent to \d+ (family|families)!/)).toBeVisible({ timeout: 20_000 });
    await page.getByPlaceholder("e.g. Summer camp email").fill(savedName);
    await page.getByRole("button", { name: "Save it" }).click();

    // The send is in the server's history with a live status…
    const row = page.locator("div.grid").filter({ hasText: name }).last();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row.getByText(/Sent|Sending/)).toBeVisible({ timeout: 15_000 });

    // …and the saved design round-trips: a fresh wizard lists it under
    // Design your own → "Use a saved one", and picking it attaches the design.
    // (Saved designs live in localStorage — same browser context, so visible.)
    await page.getByRole("button", { name: /New campaign/ }).click();
    await page.getByRole("button", { name: "Next →" }).click();
    await page.getByRole("button", { name: "Next →" }).click();
    await page.getByRole("button", { name: "Next →" }).click();
    await page.getByRole("button", { name: "🎨 Design your own" }).click();
    await page.locator('select:has-text("Use a saved one")').selectOption({ label: savedName });
    await expect(page.getByText("Your design", { exact: true })).toBeVisible();
    await page.getByTitle("Cancel").click();
  });
});

// Mailbox redirect: a provider adds ONE redirect rule in Outlook/Gmail pointing
// at their ActivityOS address, and mail they receive appears in this Inbox.
// Skips unless the stack has an INBOUND_EMAIL_DOMAIN — without one there is no
// address to redirect to, and the setup panel correctly renders nothing.
test.describe("mailbox redirect", () => {
  test.use({ storageState: statePath("company") });

  test("a redirected email reaches the Inbox, and Gmail's confirmation code is surfaced", async ({ page }) => {
    const accounts = loadAccounts();
    const op = await fbSignIn(accounts.accounts.company.email);
    const mb = await apiFetch<{ configured: boolean; address: string | null }>("/api/emails/mailbox", op.idToken);
    test.skip(!mb.configured || !mb.address, "no INBOUND_EMAIL_DOMAIN on this stack");

    const stamp = Date.now().toString(36);
    const subject = `E2E redirected ${stamp}`;
    const code = `${Date.now()}`.slice(-9);
    const post = (body: unknown) => fetch(`${API_URL}/api/emails/inbound`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-inbound-secret": process.env.INBOUND_EMAIL_SECRET || "dev-inbound" },
      body: JSON.stringify(body),
    });

    // A parent's mail, redirected by the provider's own rule — addressed ONLY
    // to the inbound address, so this proves slug routing, not a tenantId hint.
    expect((await post({ to: mb.address, from: "A Parent", fromEmail: `parent-${stamp}@example.com`, subject, text: "Any space in August?" })).status).toBe(201);

    // Gmail's forwarding confirmation lands at the same address; the provider
    // can't open that mailbox, so the panel has to show them the code.
    expect((await post({
      to: mb.address, from: "Gmail Team", fromEmail: "forwarding-noreply@google.com",
      subject: `Gmail Forwarding Confirmation - Receive Mail from e2e-${stamp}@gmail.com`,
      text: `Confirmation code: ${code}\nOr click https://mail.google.com/mail/vf-${stamp} to confirm.`,
    })).status).toBe(201);

    await page.goto("/company/email");
    await expect(page.getByText(subject)).toBeVisible({ timeout: 20_000 });

    const panel = page.locator('[data-ui="mailbox-setup"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-ui="inbound-address"]')).toHaveText(mb.address!);
    await expect(panel.locator('[data-ui="gmail-code"]')).toHaveText(code, { timeout: 20_000 });
  });
});
