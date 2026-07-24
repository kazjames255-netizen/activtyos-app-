import { test, expect } from "@playwright/test";
import { statePath } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD } from "./helpers/accounts";

// Auth surface: login, signup (all three self-serve roles), portal guard.
// Signup tests create real throwaway accounts — `npm run e2e:cleanup` removes
// everything on @activityos-test.com.

test.describe("login", () => {
  test("root redirects to /login for signed-out visitors", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("wrong password shows an error, stays on the form", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("you@example.com").fill(`nobody@${TEST_EMAIL_DOMAIN}`);
    await page.locator('input[type="password"]').fill("definitely-wrong");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("Sign-in failed — check your email and password.")).toBeVisible();
    expect(page.url()).toContain("/login");
  });
});

test.describe("signup", () => {
  const runId = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

  test("parent signup lands in the customer dashboard", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: "Parent" }).click();
    await page.getByLabel("Your name").fill("E2E Parent Signup");
    await page.getByLabel(/Postcode/).fill("NN5 7EA");
    await page.getByLabel("Email").fill(`e2e-signup-parent-${runId}@${TEST_EMAIL_DOMAIN}`);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/custdash/browse", { timeout: 30_000 });
  });

  test("freelancer signup provisions a tenant and lands in bookings", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: "Freelancer" }).click();
    await page.getByLabel("Business name").fill(`E2E Signup Freelance ${runId}`);
    await page.getByLabel("Your name").fill("E2E Freelancer");
    await page.getByLabel("Email").fill(`e2e-signup-freelancer-${runId}@${TEST_EMAIL_DOMAIN}`);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/freelancer/bookings", { timeout: 30_000 });
  });

  test("company signup lands in company bookings", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: "Company / Head Office" }).click();
    await page.getByLabel("Business name").fill(`E2E Signup Company ${runId}`);
    await page.getByLabel("Your name").fill("E2E Company Owner");
    await page.getByLabel("Email").fill(`e2e-signup-company-${runId}@${TEST_EMAIL_DOMAIN}`);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/company/bookings", { timeout: 30_000 });
  });

  test("duplicate email is rejected with a friendly message", async ({ page }) => {
    const email = `e2e-signup-dupe-${runId}@${TEST_EMAIL_DOMAIN}`;
    await page.goto("/signup");
    await page.getByRole("button", { name: "Parent" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/custdash/browse", { timeout: 30_000 });

    await page.goto("/signup");
    await page.getByRole("button", { name: "Parent" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("That email already has an account — try signing in instead.")).toBeVisible();
  });

  test("invalid invite token shows the invite-problem card", async ({ page }) => {
    await page.goto("/signup?invite=not-a-real-token");
    await expect(page.getByRole("heading", { name: "Invite problem" })).toBeVisible();
  });
});

test.describe("portal guard", () => {
  test.use({ storageState: statePath("parent") });

  test("a parent deep-linking into an operator portal is bounced home", async ({ page }) => {
    await page.goto("/freelancer/listings");
    await page.waitForURL("**/custdash/browse", { timeout: 20_000 });
  });
});
