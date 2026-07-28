import { test, expect, type Frame, type Locator, type Page } from "@playwright/test";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, apiPost, fbSignIn, fbSignUp } from "./helpers/accounts";

// Stripe subscription billing, end to end through the REAL gate: a brand-new
// freelancer signup is walled, captures a genuine test card in the Stripe
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

test("fresh signup hits the gate, starts a card-backed trial, cancels and reactivates", async ({ page }) => {
  test.setTimeout(240_000);

  const s = await fbSignUp(email);
  await apiPost("/api/register-role", s.idToken, {
    role: "freelancer",
    businessName,
    providerName: businessName,
    providerNameMode: "business",
  });

  // Sign in through the real login page — the gate must wall the portal.
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Pick a plan to start your free trial")).toBeVisible({ timeout: 30_000 });

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
  await expect(page.getByText("Pick a plan to start your free trial")).toBeHidden({ timeout: 60_000 });

  // Money → Subscription shows the live trial and the card on file.
  await page.goto("/freelancer/subscription");
  await expect(page.getByText("Free trial", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("···· 4242")).toBeVisible();

  // Cancel keeps access until the period end…
  await page.getByRole("button", { name: "Cancel subscription" }).click();
  await expect(page.getByText(/Cancels .* you keep access until then/)).toBeVisible({ timeout: 20_000 });

  // …and reactivating un-cancels without a new card or a second trial.
  await page.getByRole("button", { name: "Reactivate" }).click();
  await expect(page.getByText("Free trial", { exact: true })).toBeVisible({ timeout: 20_000 });

  // Leave the Stripe side tidy: cancel the test subscription for real.
  const done = await fbSignIn(email);
  await apiPost("/api/subscription/cancel", done.idToken, {});
});
