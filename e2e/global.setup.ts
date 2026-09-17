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
import { NAV_GROUPS, PORTALS } from "../lib/nav/config";

// Where each role lands after sign-in (mirrors lib/roles.ts ROLE_HOME).
const ROLE_HOME: Record<Role, string> = {
  platform: "/platform/providers",
  company: "/company/bookings",
  franchise: "/franchise/bookings",
  freelancer: "/freelancer/bookings",
  staff: "/staff/dash",
  parent: "/custdash/browse",
};

// The pre-compile pass below can take several minutes cold (dozens of never-before-hit routes,
// each paying Next dev's one-time compile cost) — give this describe block room for that.
setup.describe.configure({ timeout: 600_000 });

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
      // Keep the standing operators clear of the plan gate (idempotent — see
      // the provisioning path below for why).
      const tids = [existing.accounts.freelancer.tenantId, existing.accounts.company.tenantId].filter(Boolean) as string[];
      if (tids.length)
        execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", ...tids], { stdio: "pipe" });
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

  // Fresh operator signups are seeded subscription status "none" and would be
  // walled by the plan gate on every UI login. The suite's standing accounts
  // must behave like pre-gate tenants (the billing spec mints its own fresh
  // account to test the gate), so strip the seeded field server-side.
  execFileSync(
    "npm",
    ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", accounts.freelancer.tenantId!, accounts.company.tenantId!],
    { stdio: "inherit" },
  );

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

// Next.js dev mode compiles each route on its FIRST hit — a cold visit can take 20-30s, a warm
// one under 1s (measured: /freelancer/ai was 26.8s cold, 0.45s warm). Every spec file's first
// visit to a given view pays that tax out of ITS OWN test timeout, which is what was actually
// timing out the portal smoke tests (each visits 25-50 NEVER-BEFORE-COMPILED routes in one test)
// and very likely contributed to other specs' timeouts too. Pre-compile every nav route here,
// once, in setup — outside any single spec's time budget — so later tests measure real behaviour
// instead of Turbopack's one-time cost. Auth doesn't matter: these routes render their shell (and
// so get compiled) even signed out; the portal guard redirect happens client-side after hydration.
setup("pre-compile every portal view (Next dev cold-start tax, paid once here)", async () => {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const portal of PORTALS) {
    for (const group of NAV_GROUPS[portal] ?? []) {
      for (const item of group.items) {
        if (item.hidden || item.view === "auth") continue;
        const key = `${portal}/${item.view}`;
        if (seen.has(key)) continue;
        seen.add(key);
        urls.push(`${WEB_URL}/${key}`);
      }
    }
  }
  const CONCURRENCY = 6;
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const url = urls[i++];
      try { await fetch(url, { signal: AbortSignal.timeout(45_000) }); } catch { /* best-effort warm-up, a real spec will surface any genuine failure */ }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
});
