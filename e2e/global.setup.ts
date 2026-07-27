import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { test as setup, expect, type Browser } from "@playwright/test";
import {
  ACCOUNTS_PATH,
  AUTH_DIR,
  ROOT,
  ROLES,
  WEB_URL,
  statePath,
  type AccountManifest,
  type Role,
  type TestAccount,
} from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, apiPost, fbSignUp, fbTrySignIn } from "./helpers/accounts";

// Where each role lands after sign-in (mirrors lib/roles.ts ROLE_HOME).
const ROLE_HOME: Record<Role, string> = {
  platform: "/platform/providers",
  company: "/company/bookings",
  franchise: "/franchise/bookings",
  freelancer: "/freelancer/bookings",
  staff: "/staff/dash",
  parent: "/custdash/browse",
};

setup.describe.configure({ timeout: 300_000 });

async function uiLogin(browser: Browser, role: Role, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${WEB_URL}/login`);
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Landing on the role's home also proves fetchRoleHome routed correctly.
  await page.waitForURL(`**${ROLE_HOME[role]}`, { timeout: 30_000 });
  // Firebase keeps the session in IndexedDB — must be captured explicitly.
  await context.storageState({ path: statePath(role), indexedDB: true });
  await context.close();
}

function manifestIsReusable(): AccountManifest | null {
  if (!fs.existsSync(ACCOUNTS_PATH)) return null;
  if (!ROLES.every((r) => fs.existsSync(statePath(r)))) return null;
  try {
    return JSON.parse(fs.readFileSync(ACCOUNTS_PATH, "utf8")) as AccountManifest;
  } catch {
    return null;
  }
}

setup("provision throwaway accounts & signed-in states", async ({ browser }) => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  // Accounts from a previous run still alive (cleanup not run yet)? Reuse —
  // creating + logging in 6 accounts costs ~a minute. Their DATA is wiped
  // either way: leftover bookings/listings/children from earlier runs are how
  // stale-matching assertions false-pass, and they slow every list page.
  const existing = manifestIsReusable();
  if (existing) {
    const alive = await Promise.all(
      Object.values(existing.accounts).map((a) => fbTrySignIn(a.email, existing.password)),
    );
    if (alive.every(Boolean)) {
      execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-cleanup", "--", "--data-only"], {
        stdio: "pipe",
      });
      return;
    }
  }

  const runId = Date.now().toString(36);
  const email = (role: Role) => `e2e-${role}-${runId}@${TEST_EMAIL_DOMAIN}`;
  const accounts = {} as Record<Role, TestAccount>;

  // Parent + the two tenant-owning operators register themselves.
  {
    const s = await fbSignUp(email("parent"));
    await apiPost("/api/register-role", s.idToken, { role: "parent", postcode: "NN5 7EA" });
    accounts.parent = { role: "parent", email: email("parent"), uid: s.uid, tenantId: null, tenantName: null };
  }
  for (const role of ["freelancer", "company"] as const) {
    const s = await fbSignUp(email(role));
    const tenantName = `E2E ${role === "company" ? "Company" : "Freelance"} ${runId}`;
    const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, {
      role,
      businessName: tenantName,
      providerName: tenantName,
      providerNameMode: "business",
    });
    accounts[role] = { role, email: email(role), uid: s.uid, tenantId: r.tenantId, tenantName };
  }

  // Franchise + staff join the company tenant via invite tokens.
  const company = await fbTrySignIn(accounts.company.email);
  expect(company, "company sign-in for invites").toBeTruthy();
  for (const role of ["franchise", "staff"] as const) {
    const inv = await apiPost<{ token: string }>("/api/invites", company!.idToken, { role });
    const s = await fbSignUp(email(role));
    await apiPost(`/api/invites/${inv.token}/accept`, s.idToken, {});
    accounts[role] = {
      role,
      email: email(role),
      uid: s.uid,
      tenantId: accounts.company.tenantId,
      tenantName: accounts.company.tenantName,
    };
  }

  // Platform (HQ) can never self-register — use the server's bootstrap script.
  {
    const platformEmail = email("platform");
    execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "create-admin", "--", platformEmail, TEST_PASSWORD], {
      stdio: "pipe",
    });
    const s = await fbTrySignIn(platformEmail);
    expect(s, "platform admin sign-in").toBeTruthy();
    accounts.platform = { role: "platform", email: platformEmail, uid: s!.uid, tenantId: null, tenantName: null };
  }

  // One real UI login per role — saves the browser state every spec reuses,
  // and doubles as a check that each role lands on its portal home.
  for (const role of ROLES) await uiLogin(browser, role, accounts[role].email);

  const manifest: AccountManifest = { runId, password: TEST_PASSWORD, accounts };
  fs.writeFileSync(ACCOUNTS_PATH, JSON.stringify(manifest, null, 2));
});
