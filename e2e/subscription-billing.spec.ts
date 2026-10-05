import { test, expect, type Frame, type Locator, type Page } from "@playwright/test";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, apiPost, fbSignIn, fbSignUp, stripeConfigured } from "./helpers/accounts";

// Stripe subscription billing, end to end through the REAL gate: a brand-new
// freelancer signup (no wall) starts the trial from Billing & payouts, captures a genuine test card in the Stripe
// PaymentElement, starts the 7-day trial, then cancels and reactivates from
// Money → Subscription. A fresh account is essential — the suite's standing
// operator accounts predate the gate and are deliberately never walled.
//
// The Stripe test subscription this creates is cancelled in the test's own
// last step; the account itself is removed by `npm run e2e:cleanup`.

const stamp = Date.now().toString(36);
const email = `e2e-billing-${stamp}@${TEST_EMAIL_DOMAIN}`;
const businessName = `E2E Billing ${stamp}`;

// Stripe splits the Payment Element across several __privateStripeFrame
// iframes — scan every frame for whichever holds the field (same technique
// as payments.spec.ts).
const inAnyFrame = async (page: Page, find: (f: Frame) => Locator, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const f of page.frames()) {
      const loc = find(f);
      if ((await loc.count().catch(() => 0)) > 0) return loc.first();
    }
    await page.waitForTimeout(300);
  }
  return null;
};

// Needs STRIPE_SECRET_KEY on the local API: without it the gate never renders a card field.
test.skip(!stripeConfigured(), "no STRIPE_SECRET_KEY on the local API");

test("fresh signup hits the gate, starts a card-backed trial, cancels and reactivates", async ({ page }) => {
  test.setTimeout(240_000);

  const s = await fbSignUp(email);
  await apiPost("/api/register-role", s.idToken, {
    role: "freelancer",
    businessName,
    providerName: businessName,
    providerNameMode: "business",
  });

  // Sign in through the real login page. There is no plan wall any more: a new provider lands in the portal and starts the
  // trial from Billing & payouts (or from the Go live pop-up when publishing the first listing).
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Get set up to take bookings").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Pick your plan")).toHaveCount(0);
  await page.goto("/freelancer/billing?tab=plan");
  await page.getByRole("button", { name: "Start free trial" }).first().click(); // the Freelancer card -> "Add your card" box

  // The PaymentElement replaces the old dummy card form — fill the Stripe
  // test card inside its iframes.
  const cardTab = await inAnyFrame(page, (f) => f.getByRole("button", { name: "Card", exact: true }), 20_000);
  if (cardTab) await cardTab.click().catch(() => {});
  const cardNumber = await inAnyFrame(page, (f) => f.getByPlaceholder("1234 1234 1234 1234"));
  expect(cardNumber, "Stripe card field should appear in the gate").toBeTruthy();
  await cardNumber!.fill("4242424242424242");
  await (await inAnyFrame(page, (f) => f.getByPlaceholder("MM / YY"), 10_000))?.fill("12/30");
  await (await inAnyFrame(page, (f) => f.getByPlaceholder("CVC"), 10_000))?.fill("123");
  const postcode = await inAnyFrame(page, (f) => f.getByLabel(/postal code|postcode|zip/i), 5_000);
  if (postcode) await postcode.fill("NN5 7EA").catch(() => {});

  await page.getByRole("button", { name: /Start 7-day free trial/ }).click();

  // confirmSetup + POST /start + the gate's re-check — give Stripe room.
  await expect(page.getByText("Add your card")).toBeHidden({ timeout: 60_000 });

  // Billing & payouts → Your plan shows the live trial and the card on file.
  await page.goto("/freelancer/billing?tab=plan");
  await expect(page.getByText("Free trial", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("···· 4242")).toBeVisible();

  // Cancel keeps access until the period end…
  await page.getByRole("button", { name: "Cancel subscription" }).click();
  // Copy changed with the i18n rework: the date line plus a status badge.
  await expect(page.getByText(/^Cancels on .+\.$/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Cancelling", { exact: true })).toBeVisible();

  // …and reactivating un-cancels without a new card or a second trial.
  await page.getByRole("button", { name: "Reactivate" }).click();
  await expect(page.getByText("Free trial", { exact: true })).toBeVisible({ timeout: 20_000 });

  // Leave the Stripe side tidy: cancel the test subscription for real.
  const done = await fbSignIn(email);
  await apiPost("/api/subscription/cancel", done.idToken, {});
});
