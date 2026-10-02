import { test, expect } from "@playwright/test";
import { API_URL } from "./helpers/env";
import { apiFetch, fbSignIn, TEST_EMAIL_DOMAIN, TEST_PASSWORD } from "./helpers/accounts";

// A parent creates an account on /parent?tab=up: picks their provider from the directory, gets a login, is registered as a parent against
// that provider and lands on the provider's storefront. Throwaway @activityos-test.com account, unique per run.
test("parent sign-up picks a provider, creates the login and lands on that provider's storefront", async ({ page }) => {
  test.setTimeout(120_000);
  // find a provider that the public directory actually returns
  let query = "", provider: { id: string; name: string } | null = null;
  for (const q of ["Riverside", "E2E", "Sports", "Club", "Amir"]) {
    const rows = (await (await fetch(`${API_URL}/api/providers?q=${encodeURIComponent(q)}`)).json()) as { id: string; name: string }[];
    if (Array.isArray(rows) && rows.length) { query = q; provider = rows[0]; break; }
  }
  test.skip(!provider, "no provider is listed in the public directory");

  const email = `parent-signup-${Date.now().toString(36)}@${TEST_EMAIL_DOMAIN}`;
  await page.goto("/parent?tab=up");

  // submitting without picking a provider is refused with a clear message (nothing is created)
  await page.getByPlaceholder(/you@example/i).fill(email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByText(/Choose your provider from the list/i)).toBeVisible();

  // pick the provider from the directory
  await page.locator("#parent-provider").fill(query);
  const option = page.locator("#provider-list [role=option]").first();
  await expect(option).toBeVisible({ timeout: 20_000 });
  await option.click();

  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.waitForURL(/\/store\//, { timeout: 60_000 });
  expect(page.url()).toContain(`/store/${provider!.id}`);

  // the account really is a parent
  const tok = (await fbSignIn(email)).idToken;
  const me = await apiFetch<{ role?: string }>("/api/me", tok);
  expect(me.role).toBe("parent");
});
