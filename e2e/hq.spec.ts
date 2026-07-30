import { test, expect } from "@playwright/test";
import { loadAccounts, statePath, type AccountManifest } from "./helpers/env";
import { apiFetch, fbSignIn } from "./helpers/accounts";

// The Platform (HQ) apps, now off localStorage: the sales pipeline (real
// leads API) and the support inbox — fed by the in-app 🐞 bug report every
// operator and parent shell now carries.

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const leadBusiness = `E2E Lead Gym ${stamp}`;
const bugSteps = `E2E bug repro ${stamp}: clicked export, nothing happened`;

let accounts: AccountManifest["accounts"];

test.beforeAll(() => {
  accounts = loadAccounts().accounts;
});

test.describe("sales pipeline", () => {
  test.use({ storageState: statePath("platform") });

  test("HQ adds a lead and it lands on the live board", async ({ page }) => {
    await page.goto("/platform/sales");
    await page.getByRole("button", { name: "+ Add lead" }).click();
    await page.getByLabel("Business").fill(leadBusiness);
    await page.getByLabel("Contact name").fill("Jo Test");
    await page.getByLabel("Owner (rep)").fill("E2E Rep");
    await page.getByRole("button", { name: "Add lead", exact: true }).click();

    // The board re-reads from the API (not a local store), so the new card
    // appearing proves the round trip. The stamped name is this run's anchor.
    await expect(page.getByText(leadBusiness)).toBeVisible({ timeout: 15_000 });

    // Tidy: remove the lead through the API so reruns don't accumulate.
    const hq = await fbSignIn(accounts.platform.email);
    const leads = await apiFetch<{ id: string; business: string }[]>("/api/platform/leads", hq.idToken);
    const mine = leads.find((l) => l.business === leadBusiness);
    expect(mine, "lead should exist server-side").toBeTruthy();
    await apiFetch(`/api/platform/leads/${mine!.id}`, hq.idToken, { method: "DELETE" });
  });
});

test.describe("bug report → support inbox", () => {
  test("operator files a bug from the header; HQ sees, replies, resolves", async ({ browser }) => {
    // Operator side: the 🐞 next to the bell, page + device auto-captured.
    const opCtx = await browser.newContext({ storageState: statePath("company") });
    const opPage = await opCtx.newPage();
    await opPage.goto("/company/dashboard");
    await opPage.getByRole("button", { name: "Report a bug" }).click();
    await opPage.getByPlaceholder("What were you doing, and what went wrong?").fill(bugSteps);
    await opPage.getByRole("button", { name: "Send report" }).click();
    await expect(opPage.getByText("Thanks — we're on it.")).toBeVisible({ timeout: 15_000 });
    await opCtx.close();

    // HQ side: the thread is in the inbox with the reported details.
    const hqCtx = await browser.newContext({ storageState: statePath("platform") });
    const hqPage = await hqCtx.newPage();
    await hqPage.goto("/platform/support");
    // The operator's tenant name is run-unique (E2E Company <runId>), and the
    // steps carry this test's stamp — open the thread via its list row.
    await hqPage.getByText(accounts.company.tenantName!, { exact: false }).first().click();
    // The stamped steps text renders in the list row, the "Reported details"
    // card AND the conversation bubble — any one proves the thread landed.
    await expect(hqPage.getByText(bugSteps).first()).toBeVisible({ timeout: 15_000 });

    // The reply MUST be run-stamped: an unstamped "Thanks — fix incoming."
    // matches stale list-row previews from earlier runs instantly, so the
    // resolve click below races the still-in-flight reply POST — and the
    // server reopens a thread on every reply, cancelling the resolve.
    // The stamped bubble only renders from server data, so its visibility
    // proves the POST (and the refetch) completed first.
    const replyText = `Thanks — fix incoming. (${stamp})`;
    await hqPage.getByPlaceholder(/Write a reply…/).fill(replyText);
    await hqPage.getByRole("button", { name: "Send", exact: true }).click();
    await expect(hqPage.getByText(replyText).first()).toBeVisible({ timeout: 15_000 });

    await hqPage.getByRole("button", { name: "✓ Mark resolved" }).click();
    await expect(hqPage.getByRole("button", { name: "↩︎ Reopen" })).toBeVisible({ timeout: 15_000 });
    await hqCtx.close();
  });
});
