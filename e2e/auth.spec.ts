import { test, expect, type Page } from "@playwright/test";
import { statePath } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD } from "./helpers/accounts";

// Auth surface: login, signup (the operator wizard), portal guard.
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

  // Signup is a 5-step operator wizard (type → business → identity → hear →
  // login). Walks it from the currently-selected type tile to "Create account".
  // The identity step defaults to showing the business name, so no per-person
  // name is required; the "hear" step demands a pick before it lets you on.
  async function walkOperatorWizard(page: Page, business: string, email: string) {
    await page.getByRole("button", { name: "Continue" }).click(); // type → business
    await page.getByLabel("Business name").fill(business);
    await page.getByLabel("Address", { exact: true }).fill("1 Test Street, Northampton");
    await page.getByLabel("Postcode", { exact: true }).fill("NN5 7EA");
    await page.getByRole("button", { name: "Continue" }).click(); // business → identity
    await page.getByRole("button", { name: "Continue" }).click(); // identity → hear
    await page.getByRole("button", { name: "Google / search" }).click();
    await page.getByRole("button", { name: "Continue" }).click(); // hear → login
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    // Operators now land on an optional "Get paid" step (Stripe Connect + bank
    // details) before the portal — skip it. Only appears when the account was
    // actually created, so it must not be awaited on the duplicate-email path.
    const skip = page.getByRole("button", { name: /^Skip for now/ });
    await skip.click({ timeout: 15_000 }).catch(() => { /* signup failed → the error assertion owns it */ });
  }

  test("parents are not offered self-signup (they arrive via a provider's link)", async ({ page }) => {
    // Product decision (July 2026): the wizard provisions operators only —
    // parent accounts are created through a provider's booking link instead.
    await page.goto("/signup");
    await expect(page.getByRole("button", { name: "Freelancer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Company" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Franchise" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Parent", exact: true })).toHaveCount(0);
  });

  test("freelancer signup provisions a tenant and lands in bookings", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: "Freelancer" }).click();
    await walkOperatorWizard(page, `E2E Signup Freelance ${runId}`, `e2e-signup-freelancer-${runId}@${TEST_EMAIL_DOMAIN}`);
    await page.waitForURL("**/freelancer/bookings", { timeout: 30_000 });
  });

  test("company signup lands in company bookings", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: "Company" }).click();
    await walkOperatorWizard(page, `E2E Signup Company ${runId}`, `e2e-signup-company-${runId}@${TEST_EMAIL_DOMAIN}`);
    await page.waitForURL("**/company/bookings", { timeout: 30_000 });
  });

  test("duplicate email is rejected with a friendly message", async ({ page }) => {
    const email = `e2e-signup-dupe-${runId}@${TEST_EMAIL_DOMAIN}`;
    await page.goto("/signup");
    await walkOperatorWizard(page, `E2E Signup Dupe ${runId}`, email);
    await page.waitForURL("**/freelancer/bookings", { timeout: 30_000 });

    await page.goto("/signup");
    await walkOperatorWizard(page, `E2E Signup Dupe ${runId}`, email);
    await expect(page.getByText("That email already has an account — try signing in instead.")).toBeVisible({ timeout: 15_000 });
  });

  test("invalid invite token shows the invite-problem card", async ({ page }) => {
    await page.goto("/signup?invite=not-a-real-token");
    await expect(page.getByRole("heading", { name: "Invite problem" })).toBeVisible();
  });
});

test.describe("portal guard", () => {
  test("a signed-out visitor deep-linking a portal view is sent to login with a return path", async ({ page }) => {
    await page.goto("/company/bookings");
    // RequireAuth sends cold arrivals to login carrying ?next= so they land
    // back on the deep link after signing in.
    await page.waitForURL(/\/login\?next=%2Fcompany%2Fbookings/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test.describe("parent → operator", () => {
    test.use({ storageState: statePath("parent") });

    test("a parent deep-linking into an operator portal is bounced home", async ({ page }) => {
      await page.goto("/freelancer/listings");
      await page.waitForURL("**/custdash/browse", { timeout: 20_000 });
    });
  });

  test.describe("operator → parent", () => {
    test.use({ storageState: statePath("freelancer") });

    test("an operator deep-linking into the parent dashboard is bounced home", async ({ page }) => {
      await page.goto("/custdash/browse");
      await page.waitForURL("**/freelancer/bookings", { timeout: 20_000 });
    });
  });
});
