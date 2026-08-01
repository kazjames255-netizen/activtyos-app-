import { expect, type Page } from "@playwright/test";
import { loadAccounts } from "./env";
import { TEST_EMAIL_DOMAIN, apiPost, fbSignIn } from "./accounts";

// Shared arrange/walk steps for the Email feature specs.

/** A customer who has never booked but explicitly opted in to marketing —
 *  the only never-booked contact a campaign may lawfully reach (UK PECR
 *  split-default), and the seed for the "New enquiries" audience. */
export async function arrangeEnquirer(stamp: string, tag = "enquiry"): Promise<string> {
  const manifest = loadAccounts();
  const op = await fbSignIn(manifest.accounts.company.email);
  const email = `e2e-${tag}-${stamp}@${TEST_EMAIL_DOMAIN}`;
  await apiPost("/api/customers", op.idToken, { name: `E2E Enquirer ${stamp}`, email, marketingOptIn: true });
  return email;
}

/** Walk the 4-step campaign wizard (Name → Audience → Subject) to the Content
 *  step, sending to the live "New enquiries" segment only (the default
 *  "All active families" chip is dropped). Subject = name, so history rows
 *  are anchorable by the run stamp. Starts from /company/email. */
export async function wizardToContent(page: Page, name: string): Promise<void> {
  await page.goto("/company/email");
  await page.getByRole("button", { name: "Campaigns", exact: true }).click();
  await page.getByRole("button", { name: /New campaign/ }).click();

  await page.getByPlaceholder("e.g. August football camp").fill(name);
  await page.getByRole("button", { name: "Next →" }).click();

  await page.locator('select:has-text("Add another audience")').selectOption("seg-enquiries");
  await page.locator("span").filter({ hasText: /^All active families/ }).getByTitle("Remove from this send").click();
  await expect(page.getByText(/This send reaches/)).toBeVisible();
  await page.getByRole("button", { name: "Next →" }).click();

  await page.getByPlaceholder("e.g. ☀️ August camp places are open!").fill(name);
  await page.getByRole("button", { name: "Next →" }).click();
}
