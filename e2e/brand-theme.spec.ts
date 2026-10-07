import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD } from "./helpers/accounts";

// "Brand colours drive theme choice": a fresh provider sets three brand colours in Setup → Branding, then the listing
// wizard's final (Preview) step offers "Matched to your brand"; approving one saves it as the default for NEW listings.
// Screenshots (desktop + 390px) go to e2e/review/shots/brand/.
const SHOTS = "e2e/review/shots/brand";
const runId = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

async function signupFreelancer(page: Page) {
  await page.goto("/signup");
  await page.getByRole("button", { name: "Freelancer" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Business name").fill(`E2E Brand ${runId}`);
  await page.getByLabel("Address", { exact: true }).fill("1 Test Street, Northampton");
  await page.getByLabel("Postcode", { exact: true }).fill("NN5 7EA");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByPlaceholder("e.g. Sam Taylor").fill("Sam Brand");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Google / search" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Email").fill(`e2e-brand-${runId}@${TEST_EMAIL_DOMAIN}`);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("button", { name: /^Skip for now/ }).click({ timeout: 15_000 }).catch(() => {});
  await page.waitForURL("**/freelancer/bookings", { timeout: 45_000 });
}

test("brand colours -> matched themes -> default for new listings", async ({ page }) => {
  test.setTimeout(240_000);
  fs.mkdirSync(SHOTS, { recursive: true });
  await signupFreelancer(page);

  // First-run: the optional "What are your brand colours?" question sits under the checklist.
  await page.getByRole("link", { name: "Dashboard" }).first().click();
  const onboard = page.getByTestId("first-run-brand");
  await expect(onboard).toBeVisible({ timeout: 30_000 });
  await onboard.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/onboarding-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${SHOTS}/onboarding-390.png` });
  await page.setViewportSize({ width: 1280, height: 900 });

  // Three brand colours in Setup → Branding (navy, orange, a near-white custom colour).
  await page.goto("/freelancer/setup?tab=branding");
  const row = (n: number) => page.getByTestId(`brand-colour-${n}`);
  await row(1).getByRole("button", { name: "#1e293b" }).click();
  await expect(row(1).getByRole("button", { name: "#1e293b" })).toHaveAttribute("aria-pressed", "true");
  await row(2).getByRole("button", { name: "#ea580c" }).click();
  await expect(row(2).getByRole("button", { name: "#ea580c" })).toHaveAttribute("aria-pressed", "true");
  await row(3).locator('input[type="color"]').fill("#f7f5f0");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/setup-branding-desktop.png` });
  await page.reload();
  await expect(row(2).getByRole("button", { name: "#ea580c" })).toHaveAttribute("aria-pressed", "true");

  // New listing -> name it -> jump to the last step.
  await page.goto("/freelancer/listings");
  await page.getByRole("button", { name: /New listing|Create listing|\+ New/i }).first().click();
  await page.getByPlaceholder(/e\.g\./i).first().fill(`Brand test camp ${runId}`);
  await page.locator('button[title^="12. "], button[title*="Preview"]').last().click();

  const matched = page.getByTestId("matched-themes");
  await expect(matched).toBeVisible({ timeout: 20_000 });
  await expect(matched.locator('[data-testid^="matched-theme-"]')).toHaveCount(3);
  await matched.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/matched-desktop.png` });

  const first = matched.locator('[data-testid^="matched-theme-"]').first();
  const key = (await first.getAttribute("data-testid"))!.replace("matched-theme-", "");
  await first.click();
  await expect(first).toHaveAttribute("data-selected", "1");
  await expect(matched.getByText(/Saved as the starting theme/)).toBeVisible({ timeout: 15_000 });
  await matched.getByTestId("matched-all-themes").click();
  await page.screenshot({ path: `${SHOTS}/matched-all-themes-desktop.png` });

  await page.setViewportSize({ width: 390, height: 844 });
  await matched.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/matched-390.png` });

  // The choice is remembered: the library now carries it, and a NEW listing starts on it.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(2500); // the settings save is debounced (500ms) before it reaches the server
  await page.reload();
  await page.getByRole("button", { name: /New listing|Create listing|\+ New/i }).first().click();
  await page.getByPlaceholder(/e\.g\./i).first().fill(`Second ${runId}`);
  await page.locator('button[title^="12. "], button[title*="Preview"]').last().click();
  await expect(page.getByTestId(`matched-theme-${key}`)).toHaveAttribute("data-selected", "1", { timeout: 20_000 });
});
