import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { test as setup, expect, type Browser } from "@playwright/test";
import { ACCOUNTS_PATH, AUTH_DIR, ROOT, WEB_URL, statePath, type AccountManifest, type Role, type TestAccount } from "../helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, apiPost, fbSignUp, fbTrySignIn } from "../helpers/accounts";

// Minimal setup for the Teaching Hub review: freelancer tutor, company (+ staff via invite) and a parent.
// NEVER creates or signs in a platform (HQ) account, so no 2FA email is triggered. Writes its own manifest under E2E_AUTH_DIR.
const HOME: Partial<Record<Role, string>> = { freelancer: "/freelancer/bookings", company: "/company/bookings", staff: "/staff/dash", parent: "/custdash/browse" };
setup.describe.configure({ timeout: 300_000 });

async function uiLogin(browser: Browser, role: Role, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${WEB_URL}/login`);
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(`**${HOME[role]}`, { timeout: 90_000 });
  await context.storageState({ path: statePath(role), indexedDB: true });
  await context.close();
}

setup("provision review accounts (no platform)", async ({ browser }) => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const runId = "rv" + Date.now().toString(36);
  const email = (r: string) => `e2e-${r}-${runId}@${TEST_EMAIL_DOMAIN}`;
  const accounts: Partial<Record<Role, TestAccount>> = {};
  const p = await fbSignUp(email("parent"));
  await apiPost("/api/register-role", p.idToken, { role: "parent", postcode: "NN5 7EA" });
  accounts.parent = { role: "parent", email: email("parent"), uid: p.uid, tenantId: null, tenantName: null };
  for (const role of ["freelancer", "company"] as const) {
    const s = await fbSignUp(email(role));
    const tenantName = `E2E ${role === "company" ? "Company" : "Freelance"} ${runId}`;
    const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role, businessName: tenantName, providerName: tenantName, providerNameMode: "business" });
    accounts[role] = { role, email: email(role), uid: s.uid, tenantId: r.tenantId, tenantName };
  }
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", accounts.freelancer!.tenantId!, accounts.company!.tenantId!], { stdio: "pipe" });
  const company = await fbTrySignIn(accounts.company!.email);
  expect(company).toBeTruthy();
  const inv = await apiPost<{ token: string }>("/api/invites", company!.idToken, { role: "staff" });
  const st = await fbSignUp(email("staff"));
  await apiPost(`/api/invites/${inv.token}/accept`, st.idToken, {});
  accounts.staff = { role: "staff", email: email("staff"), uid: st.uid, tenantId: accounts.company!.tenantId, tenantName: accounts.company!.tenantName };
  for (const role of ["parent", "freelancer", "company", "staff"] as const) await uiLogin(browser, role, accounts[role]!.email);
  const manifest = { runId, password: TEST_PASSWORD, accounts } as unknown as AccountManifest;
  fs.writeFileSync(ACCOUNTS_PATH, JSON.stringify(manifest, null, 2));
});
