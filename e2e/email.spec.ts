import { test, expect } from "@playwright/test";
import { API_URL, loadAccounts, statePath } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, apiPost, fbSignIn } from "./helpers/accounts";

// The Email client's backend round trips: an inbound email (webhook → store)
// shows in the Inbox and can be filed; a scheduled send lists under Inbox →
// Scheduled and can be cancelled before it fires. The send engine itself
// (delivery counts, open pixel, merge fields) is covered at the API layer —
// this spec proves the UI is wired to the real store, not local state.
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
    // cancellation server-side.
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "✕ Cancel", exact: true }).click();
    await expect(page.getByText(schedSubject)).toBeHidden({ timeout: 15_000 });
  });
});
