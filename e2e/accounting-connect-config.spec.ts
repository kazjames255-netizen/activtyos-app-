import { test, expect } from "@playwright/test";
import { loadAccounts } from "./helpers/env";
import { apiFetch, fbSignIn } from "./helpers/accounts";

// Accounting connect config: every provider the server is configured for must hand back a real authorize URL
// (right host, our client id present, the localhost callback). No third-party login happens here.

test("each configured accounting provider returns a real authorize URL", async () => {
  test.setTimeout(60_000);
  const { accounts } = loadAccounts();
  const co = await fbSignIn(accounts.company.email);

  const conns = await apiFetch<Record<string, { configured: boolean; connected: boolean }>>("/api/accounting/connections", co.idToken);
  const expected: Record<string, { host: RegExp; callback: string }> = {
    sage: { host: /^www\.sageone\.com$/, callback: "/api/accounting/callback/sage" },
    xero: { host: /^login\.xero\.com$/, callback: "/api/accounting/callback/xero" },
    quickbooks: { host: /^appcenter\.intuit\.com$/, callback: "/api/accounting/callback/quickbooks" },
  };
  for (const [provider, want] of Object.entries(expected)) {
    expect(conns[provider]?.configured, `${provider} configured`).toBe(true);
    const { url } = await apiFetch<{ url: string }>(`/api/accounting/${provider}/connect`, co.idToken);
    const u = new URL(url);
    expect(u.hostname, `${provider} host`).toMatch(want.host);
    expect(u.searchParams.get("client_id"), `${provider} client_id`).toBeTruthy();
    expect(u.searchParams.get("redirect_uri"), `${provider} redirect_uri`).toContain(want.callback);
    expect(u.searchParams.get("state"), `${provider} state`).toBeTruthy();
  }
});
