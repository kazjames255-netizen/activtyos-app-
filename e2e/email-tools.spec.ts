import { test, expect } from "@playwright/test";
import { loadAccounts, statePath } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, apiFetch, fbSignIn } from "./helpers/accounts";
import { arrangeEnquirer, wizardToContent } from "./helpers/email";

// The Email page's tooling round-trips: worded-template CRUD (server-backed,
// shared with Messages), builder-template save/delete (the designer opened
// from Templates only saves — sending stays in Campaigns), the composer's
// undo-send window actually cancelling, and scheduling a campaign from the
// wizard. Every name/subject is stamped per run.

test.describe("email tools", () => {
  test.use({ storageState: statePath("company") });

  test("worded templates: create, edit and delete round-trip the server", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const name = `E2E worded tmpl ${stamp}`;
    const subjectV2 = `E2E tmpl subject v2 ${stamp}`;

    await page.goto("/company/email");
    await page.getByRole("button", { name: "Templates", exact: true }).click();
    await page.getByRole("button", { name: /New template/ }).click();
    await page.getByPlaceholder("e.g. Booking confirmation").fill(name);
    await page.getByPlaceholder("Subject line").fill(`E2E tmpl subject ${stamp}`);
    await page.getByPlaceholder(/Write the template/).fill("Hello {ParentName}, see you at {ListingName}!");
    await page.getByRole("button", { name: "Save template" }).click();
    await expect(page.getByText(name)).toBeVisible();

    // Edit: the row is the innermost div holding our stamped name AND the
    // action buttons (ancestors match hasText too — .last() pins the row).
    const row = () => page.locator("div").filter({ hasText: name })
      .filter({ has: page.getByRole("button", { name: "Delete" }) }).last();
    await row().getByRole("button", { name: "Edit" }).click();
    await page.getByPlaceholder("Subject line").fill(subjectV2);
    await page.getByRole("button", { name: "Save template" }).click();
    await expect(page.getByText(subjectV2)).toBeVisible();

    page.once("dialog", (d) => void d.accept());
    await row().getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(name)).toBeHidden();
  });

  test("builder templates: design, save under a name, delete", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const name = `E2E builder tmpl ${stamp}`;

    await page.goto("/company/email");
    await page.getByRole("button", { name: "Templates", exact: true }).click();
    await page.getByRole("button", { name: /Builder templates/ }).click();
    await page.getByRole("button", { name: /New builder template/ }).click();

    // Designer gallery → start from a template → save (names via a prompt).
    await page.getByText("Refer a friend", { exact: true }).click();
    page.once("dialog", (d) => void d.accept(name));
    await page.getByRole("button", { name: /Save template/ }).click();
    await expect(page.getByText(name)).toBeVisible();

    page.once("dialog", (d) => void d.accept());
    await page.locator("div").filter({ hasText: name })
      .filter({ has: page.getByRole("button", { name: "Delete" }) }).last()
      .getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(name)).toBeHidden();
  });

  test("the composer's undo window cancels the send for real", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const subject = `E2E undone ${stamp}`;

    await page.goto("/company/email");
    await page.getByRole("button", { name: "Compose", exact: true }).click();
    await page.locator('select:has-text("A single address")').selectOption("one");
    await page.getByPlaceholder("name@example.com", { exact: true }).fill(`e2e-undo-${stamp}@${TEST_EMAIL_DOMAIN}`);
    await page.locator('div:has(> label:text-is("Subject")) input').fill(subject);
    await page.locator('[contenteditable="true"]').fill("This one gets pulled back.");
    await page.getByRole("button", { name: /^Send to 1 recipient$/ }).click();

    // The undo banner counts down (default 5s) — pull it back.
    await expect(page.getByText(/Sending to 1 recipient in \d+s/)).toBeVisible();
    await page.getByRole("button", { name: "↩ Undo" }).click();
    await expect(page.getByText(/Send cancelled/)).toBeVisible();

    // Past the would-be window, the server must have NO record of it — the
    // wait is for an event that must NOT happen, so a pause is the point.
    await page.waitForTimeout(8_000);
    const op = await fbSignIn(loadAccounts().accounts.company.email);
    const hist = await apiFetch<{ subject: string }[]>("/api/emails", op.idToken);
    expect(hist.some((h) => h.subject === subject)).toBe(false);
  });

  test("a campaign scheduled from the wizard queues server-side and shows Scheduled", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const name = `E2E queued ${stamp}`;
    await arrangeEnquirer(stamp, "queue");
    await wizardToContent(page, name);

    await page.locator("textarea").fill(`Scheduled body ${stamp}.`);
    // Tomorrow noon, local wall-clock parts (toISOString would walk a BST
    // midnight back a day).
    const t = new Date(Date.now() + 24 * 3_600_000);
    const p = (n: number) => String(n).padStart(2, "0");
    await page.getByTitle("Schedule for").fill(`${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T12:00`);
    await page.getByRole("button", { name: "⧗ Schedule" }).click();

    // The wizard closes and the campaigns list shows the queued row.
    const row = page.locator("div.grid").filter({ hasText: name }).last();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText("Scheduled")).toBeVisible();

    // It's the SERVER's queue, not local state — and cancel it so the sweep
    // never fires a stray test email tomorrow.
    const op = await fbSignIn(loadAccounts().accounts.company.email);
    const queue = await apiFetch<{ id: string; subject: string; status: string }[]>("/api/emails/scheduled", op.idToken);
    const mine = queue.find((s) => s.subject === name);
    expect(mine?.status).toBe("scheduled");
    await apiFetch(`/api/emails/scheduled/${mine!.id}`, op.idToken, { method: "DELETE" });
  });
});
