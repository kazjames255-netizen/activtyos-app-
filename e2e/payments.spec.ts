import { test, expect, type Frame, type Locator } from "@playwright/test";
import { loadAccounts } from "./helpers/env";
import { apiPost, fbSignIn } from "./helpers/accounts";

// The platform's one real payment surface: the public invoice pay-link.
// Stripe test mode with the platform-fallback account (no Connect onboarding
// needed). The invoice is arranged via the API; the payment is made through
// the real Stripe Payment Element like a customer would.

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test("customer pays an invoice by card through the public pay-link", async ({ page }) => {
  test.setTimeout(120_000);
  const accounts = loadAccounts().accounts;
  const stamp = Date.now().toString(36);

  const op = await fbSignIn(accounts.company.email);
  const invoice = await apiPost<{ payToken: string }>("/api/invoices", op.idToken, {
    customerName: `E2E Payer ${stamp}`,
    date: iso(new Date()),
    lineItems: [{ description: "E2E card payment", qty: 1, unitPrice: 45 }],
    status: "sent",
  });
  expect(invoice.payToken).toBeTruthy();

  // The pay page is public — no auth, the token is the authorisation.
  await page.goto(`/pay/${invoice.payToken}`);
  await expect(page.getByText("Payment request from")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("£45.00").first()).toBeVisible();

  await page.getByRole("button", { name: "Pay by card" }).click();

  // Stripe splits the Payment Element across several __privateStripeFrame
  // iframes (tab strip and fields aren't always in the same one) — scan the
  // page's frames for whichever holds what we need.
  const inAnyFrame = async (find: (f: Frame) => Locator, timeoutMs = 30_000) => {
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

  const cardTab = await inAnyFrame((f) => f.getByRole("button", { name: "Card", exact: true }), 20_000);
  if (cardTab) await cardTab.click().catch(() => {});

  const cardNumber = await inAnyFrame((f) => f.getByPlaceholder("1234 1234 1234 1234"));
  expect(cardNumber, "Stripe card-number field should appear").toBeTruthy();
  await cardNumber!.fill("4242424242424242");
  await (await inAnyFrame((f) => f.getByPlaceholder("MM / YY"), 10_000))?.fill("12/30");
  await (await inAnyFrame((f) => f.getByPlaceholder("CVC"), 10_000))?.fill("123");
  const postcode = await inAnyFrame((f) => f.getByLabel(/postal code|postcode|zip/i), 5_000);
  if (postcode) await postcode.fill("NN5 7EA").catch(() => {});

  await page.getByRole("button", { name: /^Pay £45\.00$/ }).click();
  await expect(page.getByText("Paid — thank you!")).toBeVisible({ timeout: 45_000 });

  // The paid state must be SERVER state, not client cheer — a reload re-reads
  // the invoice and must still say paid.
  await page.reload();
  await expect(page.getByText("Paid — thank you!")).toBeVisible({ timeout: 15_000 });
});

test("a declined card leaves the invoice unpaid", async ({ page }) => {
  test.setTimeout(120_000);
  const accounts = loadAccounts().accounts;
  const stamp = Date.now().toString(36);

  const op = await fbSignIn(accounts.company.email);
  const invoice = await apiPost<{ payToken: string }>("/api/invoices", op.idToken, {
    customerName: `E2E Declined Payer ${stamp}`,
    date: iso(new Date()),
    lineItems: [{ description: "E2E declined payment", qty: 1, unitPrice: 30 }],
    status: "sent",
  });

  await page.goto(`/pay/${invoice.payToken}`);
  await page.getByRole("button", { name: "Pay by card" }).click();

  const inAnyFrame = async (find: (f: Frame) => Locator, timeoutMs = 30_000) => {
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

  const cardTab = await inAnyFrame((f) => f.getByRole("button", { name: "Card", exact: true }), 20_000);
  if (cardTab) await cardTab.click().catch(() => {});
  const cardNumber = await inAnyFrame((f) => f.getByPlaceholder("1234 1234 1234 1234"));
  expect(cardNumber, "Stripe card-number field should appear").toBeTruthy();
  await cardNumber!.fill("4000000000000002"); // Stripe's always-declined test card
  await (await inAnyFrame((f) => f.getByPlaceholder("MM / YY"), 10_000))?.fill("12/30");
  await (await inAnyFrame((f) => f.getByPlaceholder("CVC"), 10_000))?.fill("123");
  const postcode = await inAnyFrame((f) => f.getByLabel(/postal code|postcode|zip/i), 5_000);
  if (postcode) await postcode.fill("NN5 7EA").catch(() => {});

  await page.getByRole("button", { name: /^Pay £30\.00$/ }).click();
  await expect(page.getByText(/declined/i)).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Paid — thank you!")).toBeHidden();

  // And the server agrees: a fresh load still asks for the money.
  await page.reload();
  await expect(page.getByText("Amount due")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("£30.00").first()).toBeVisible();
});
