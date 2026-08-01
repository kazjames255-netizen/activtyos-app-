import { test, expect } from "@playwright/test";
import { API_URL, loadAccounts, statePath } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { arrangeEnquirer, wizardToContent } from "./helpers/email";
import { cardWith } from "./helpers/ui";

// Audience management on the Email page: the recipient viewer, per-person
// removal (which must suppress server-side, not just hide a row), the
// computed Booked-parents groups, the inbox → "Mark as enquiry" loop, and the
// wizard's "Skip this send" exclusion. Audience cards carry data-ui="card",
// so cardWith anchors each assertion to the right card; every person/subject
// is stamped per run.

interface Segment { id: string; emails: string[] }

test.describe("email audiences", () => {
  test.use({ storageState: statePath("company") });

  test("the recipient viewer lists an enquirer; removing them suppresses server-side", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const email = await arrangeEnquirer(stamp, "viewer");

    await page.goto("/company/email");
    await page.getByRole("button", { name: "Audiences", exact: true }).click();
    await page.getByRole("button", { name: /Enquiries/ }).click();

    // The merged "everyone" card → open its viewer → find OUR person.
    const card = cardWith(page, "New enquiries — everyone");
    await card.getByRole("button", { name: /View/ }).click();
    await card.getByPlaceholder(/Search .* recipient/).fill(email);
    // exact: the "No recipients match “<email>”" empty state echoes the
    // search text, so a substring match can never go hidden.
    await expect(card.getByText(email, { exact: true })).toBeVisible();

    // Remove them (confirm dialog). The row goes…
    page.once("dialog", (d) => void d.accept());
    await card.getByTitle("Remove this person").click();
    await expect(card.getByText(email, { exact: true })).toBeHidden();

    // …and it's a real suppression: the server's marketing audiences drop
    // them (POST /api/emails/suppress ran, not just local state).
    const op = await fbSignIn(loadAccounts().accounts.company.email);
    await expect.poll(async () => {
      const segs = await apiFetch<Segment[]>("/api/emails/audiences", op.idToken);
      return segs.find((s) => s.id === "enquiries")?.emails ?? [];
    }, { timeout: 15_000 }).not.toContain(email);
  });

  test("a booked family surfaces in the computed Booked-parents groups", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const email = `e2e-groups-${stamp}@${TEST_EMAIL_DOMAIN}`;
    const op = await fbSignIn(loadAccounts().accounts.company.email);
    // A manual phone booking — a real bookings doc, made today, so the family
    // qualifies for the "New this season" computed group.
    await apiPost("/api/bookings", op.idToken, {
      booker: `E2E Grouped ${stamp}`, email, child: `E2E Kid ${stamp}`, age: 7,
      listing: `E2E Groups Camp ${stamp}`, pass: "Day pass", dates: "Phone booking",
      amount: 0, method: "cash",
    });

    await page.goto("/company/email");
    await page.getByRole("button", { name: "Audiences", exact: true }).click();
    await page.getByRole("button", { name: /Booked parents/ }).click();

    const card = cardWith(page, "New this season");
    await card.getByRole("button", { name: /View/ }).click();
    await card.getByPlaceholder(/Search .* recipient/).fill(email);
    await expect(card.getByText(email)).toBeVisible();
  });

  test("inbound mail marked as an enquiry joins the enquiries audience", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const senderEmail = `e2e-marked-${stamp}@${TEST_EMAIL_DOMAIN}`;
    const subject = `E2E enquiry mail ${stamp}`;

    const inbound = await fetch(`${API_URL}/api/emails/inbound`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-inbound-secret": process.env.INBOUND_EMAIL_SECRET || "dev-inbound" },
      body: JSON.stringify({
        tenantId: loadAccounts().accounts.company.tenantId,
        from: `E2E Marked ${stamp}`, fromEmail: senderEmail,
        subject, text: "Do you have places this summer?",
      }),
    });
    expect(inbound.status).toBe(201);

    await page.goto("/company/email");
    await page.getByText(subject).click();
    await page.getByRole("button", { name: /Mark as enquiry/ }).click();
    await page.getByRole("button", { name: /Add to enquiries/ }).click();

    // The enquiry store is client-side; the Audiences tab must now list them.
    await page.getByRole("button", { name: "Audiences", exact: true }).click();
    await page.getByRole("button", { name: /Enquiries/ }).click();
    const card = cardWith(page, "New enquiries — everyone");
    await card.getByRole("button", { name: /View/ }).click();
    await card.getByPlaceholder(/Search .* recipient/).fill(senderEmail);
    await expect(card.getByText(senderEmail)).toBeVisible();
  });

  test("'Skip this send' drops the person from the actual send payload", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const name = `E2E skip ${stamp}`;
    const keep = await arrangeEnquirer(stamp, "keep");
    const skip = await arrangeEnquirer(stamp, "skip");

    await wizardToContent(page, name);

    // Content step: open the recipient list and skip ONE person.
    await page.locator("textarea").fill(`Skip check ${stamp}.`);
    await page.getByRole("button", { name: /^Recipients/ }).click();
    // .last() pins the innermost flex div holding the email — the row itself
    // (ancestor containers match hasText too and hold every row's button).
    await page.locator("div.flex").filter({ hasText: skip }).last()
      .getByRole("button", { name: "Skip this send" }).click();

    // The proof is the wire: the POST the wizard sends must carry the kept
    // address and not the skipped one (list counts are polluted by other
    // runs' enquirers, so assert membership, not totals).
    const reqPromise = page.waitForRequest((r) => r.url().includes("/api/emails/send") && r.method() === "POST");
    await page.getByRole("button", { name: "Send now" }).click();
    const sent = (await reqPromise).postDataJSON() as { recipients: string[] };
    expect(sent.recipients).toContain(keep);
    expect(sent.recipients).not.toContain(skip);

    // And the send itself lands: the campaigns list shows the server row.
    const row = page.locator("div.grid").filter({ hasText: name }).last();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row.getByText(/Sent|Sending/)).toBeVisible({ timeout: 15_000 });
  });
});
