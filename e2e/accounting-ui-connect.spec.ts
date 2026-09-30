import { test, expect, type Page } from "@playwright/test";
import { loadAccounts, statePath } from "./helpers/env";
import { apiFetch, fbSignIn, TEST_PASSWORD } from "./helpers/accounts";

// UI-level accounting connect checks on Payroll > Integrations (company portal). Read-only and self-cleaning:
//  • Xero / QuickBooks are already connected for the standing company account — we assert the "Connected" badges and NEVER click Disconnect;
//  • to exercise the Connect buttons we fake the /connections status in the browser only (nothing server-side changes), and every
//    third-party host is stubbed at the network layer, so no provider login page is ever loaded and nothing is typed anywhere;
//  • the popup's target URL must be the provider's authorize host, carry our client id, and call back to our /api/accounting/callback.
test.use({ storageState: statePath("company"), viewport: { width: 1440, height: 900 } });

type Conn = { configured: boolean; connected: boolean; label?: string | null };
const HOSTS: Record<string, { name: string; host: string; callback: string }> = {
  xero: { name: "Xero", host: "login.xero.com", callback: "/api/accounting/callback/xero" },
  quickbooks: { name: "QuickBooks Online", host: "appcenter.intuit.com", callback: "/api/accounting/callback/quickbooks" },
  sage: { name: "Sage Business Cloud Accounting", host: "www.sageone.com", callback: "/api/accounting/callback/sage" },
};

/** The saved storage state can be stale when the suite runs with --no-deps (no fresh global setup) — fall back to a real UI sign-in. */
async function openIntegrations(page: Page) {
  await page.goto("/company/payroll");
  const integ = page.getByRole("button", { name: /Integrations/ });
  await Promise.race([integ.waitFor({ timeout: 45_000 }), page.getByPlaceholder("you@example.com").waitFor({ timeout: 45_000 })]).catch(() => undefined);
  if (!(await integ.isVisible())) {
    const { accounts } = loadAccounts();
    await page.getByPlaceholder("you@example.com").fill(accounts.company.email);
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/company/, { timeout: 45_000 });
    await page.goto("/company/payroll");
  }
  await page.getByRole("button", { name: /Integrations/ }).click();
  await expect(page.getByText("Accounting integrations")).toBeVisible({ timeout: 30_000 });
}
const card = (page: Page, name: string) => page.locator('[data-ui="card"]').filter({ has: page.getByText(name, { exact: true }) }).last();

test("connected badges show for Xero and QuickBooks; Sage shows an honest not-connected state", async ({ page }) => {
  test.setTimeout(90_000);
  const { accounts } = loadAccounts();
  const live = await apiFetch<Record<string, Conn>>("/api/accounting/connections", (await fbSignIn(accounts.company.email)).idToken);
  await openIntegrations(page);
  for (const p of ["xero", "quickbooks"] as const) {
    test.skip(!live[p]?.connected, `${p} is not connected for the standing company account`);
    const c = card(page, HOSTS[p].name);
    await expect(c.getByText(/^Connected/)).toBeVisible();
    await expect(c.getByRole("button", { name: "Disconnect" })).toBeVisible();   // present, never clicked
    await expect(c.getByText("Account mapping")).toBeVisible();
    for (const label of ["Gross wages", "Employer NI", "Employer pension", "Net wages"]) await expect(c.getByText(label, { exact: false }).first()).toBeVisible();
  }
  if (!live.sage?.connected) {
    const c = card(page, HOSTS.sage.name);
    await expect(c.getByText("Not connected")).toBeVisible();
    await expect(c.getByRole("button", { name: "Connect" })).toBeVisible();
  }
  // the legacy mock (localStorage "Connect Xero (demo)") must not be what live accounts see
  await expect(page.getByText("(demo)")).toHaveCount(0);
});

test("each provider's Connect button opens the provider's authorize URL with our client id (third-party pages stubbed)", async ({ page, context }) => {
  test.setTimeout(120_000);
  const { accounts } = loadAccounts();
  const tok = (await fbSignIn(accounts.company.email)).idToken;
  const live = await apiFetch<Record<string, Conn>>("/api/accounting/connections", tok);
  // Browser-only fake: everything configured but NOT connected, so every Connect button is visible.
  const fake = Object.fromEntries(Object.keys(HOSTS).map((p) => [p, { configured: live[p]?.configured ?? false, connected: false }]));
  await page.route("**/api/accounting/connections", (r) => r.fulfill({ json: fake }));
  // Never reach a real provider: stub every provider host.
  const hit: string[] = [];
  await context.route(/^https:\/\/(login\.xero\.com|appcenter\.intuit\.com|www\.sageone\.com|identity\.xero\.com)\//, (r) => { hit.push(r.request().url()); return r.fulfill({ contentType: "text/html", body: "<h1>provider login stub</h1>" }); });
  await openIntegrations(page);
  for (const [p, want] of Object.entries(HOSTS)) {
    test.skip(!fake[p].configured, `${p} not configured on this server`);
    const popupP = context.waitForEvent("page", { timeout: 20_000 });
    await card(page, want.name).getByRole("button", { name: "Connect" }).click();
    const popup = await popupP;
    await popup.waitForURL(new RegExp(want.host.replace(/\./g, "\\.")), { timeout: 20_000 });
    const u = new URL(popup.url());
    expect(u.hostname, `${p} host`).toBe(want.host);
    expect(u.searchParams.get("client_id"), `${p} client_id`).toBeTruthy();
    expect(u.searchParams.get("redirect_uri"), `${p} redirect_uri`).toContain(want.callback);
    expect(u.searchParams.get("state"), `${p} state`).toBeTruthy();
    expect(u.searchParams.get("response_type")).toBe("code");
    await popup.close();
    await expect(card(page, want.name).getByRole("button", { name: "Connect", exact: true })).toBeEnabled({ timeout: 10_000 });   // popup closed by hand -> button recovers
  }
  expect(hit.length).toBeGreaterThanOrEqual(1);
});

test("a provider that is not configured on the server says so and offers no Connect button", async ({ page }) => {
  test.setTimeout(60_000);
  const none = { xero: { configured: false, connected: false }, quickbooks: { configured: false, connected: false }, sage: { configured: false, connected: false } };
  await page.route("**/api/accounting/connections", (r) => r.fulfill({ json: none }));
  await openIntegrations(page);
  for (const h of Object.values(HOSTS)) {
    const c = card(page, h.name);
    await expect(c.getByText("Not configured on this server")).toBeVisible();
    await expect(c.getByRole("button")).toHaveCount(0);
  }
});

test("a failing connect call surfaces the server's message instead of hanging on Connecting…", async ({ page }) => {
  test.setTimeout(60_000);
  await page.route("**/api/accounting/connections", (r) => r.fulfill({ json: { xero: { configured: true, connected: false }, quickbooks: { configured: false, connected: false }, sage: { configured: false, connected: false } } }));
  await page.route("**/api/accounting/xero/connect", (r) => r.fulfill({ status: 500, json: { error: "Xero is having a moment" } }));
  await openIntegrations(page);
  const c = card(page, "Xero");
  await c.getByRole("button", { name: "Connect" }).click();
  await expect(c.getByText("Xero is having a moment")).toBeVisible();
  await expect(c.getByRole("button", { name: "Connect" })).toBeEnabled();
});
