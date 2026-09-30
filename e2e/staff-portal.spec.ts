import { test, expect } from "@playwright/test";
import { API_URL, loadAccounts, statePath } from "./helpers/env";
import { fbSignIn } from "./helpers/accounts";

// Staff portal: the restricted-area rules and the two staff-facing flows that were found broken on 30 Sept (plan3-P4).
// API halves use the standing staff account's own token; the browser half drives the real screens.
test.describe.configure({ mode: "serial", timeout: 240_000 });

async function staffToken() {
  const m = loadAccounts();
  return (await fbSignIn(m.accounts.staff.email, m.password)).idToken as string;
}
const raw = async (token: string, method: string, path: string, body?: unknown) => {
  const r = await fetch(`${API_URL}${path}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: r.status, json: await r.json().catch(() => null) as any };
};
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

test("staff cannot change tenant-level settings or read the business bank account", async () => {
  const t = await staffToken();
  // repoint the owner's new-message emails
  expect((await raw(t, "PUT", "/api/messages/settings", { notifyEmail: "attacker@example.com" })).status).toBe(403);
  expect((await raw(t, "GET", "/api/messages/settings")).status).toBe(403);
  // every screen reads the library, but never the bank details in it
  const lib = await raw(t, "GET", "/api/library");
  expect(lib.status).toBe(200);
  const billing = lib.json?.settings?.billing ?? {};
  for (const k of ["bankName", "accountName", "sortCode", "accountNumber"]) expect(billing).not.toHaveProperty(k);
  // manager-only writes stay closed
  for (const [m, p] of [["POST", "/api/invites"], ["PUT", "/api/library"], ["POST", "/api/payroll/runs"], ["PUT", "/api/accounting/mapping"], ["POST", "/api/staff-announcements"]] as const)
    expect([403, 400]).toContain((await raw(t, m, p, {})).status);
  expect((await raw(t, "POST", "/api/staff-announcements", { title: "x", body: "y" })).status).toBe(403);
});

test("staff records are filed against today and can't be future-dated", async () => {
  const t = await staffToken();
  // a clocking hung on a past day the person wasn't rostered
  expect((await raw(t, "POST", "/api/timeclock/event", { kind: "in", day: "2020-01-06" })).status).toBe(400);
  // an expense that hasn't been spent yet
  const claim = await raw(t, "POST", "/api/expense-claims", { date: iso(30), category: "Other", amount: 5, note: "future" });
  expect(claim.status).toBe(400);
});

test("a task staff add with no assignee stays on their own list", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: statePath("staff") });
  const page = await ctx.newPage();
  const title = `staff-portal e2e task ${Date.now().toString(36)}`;
  await page.goto("/staff/tasks");
  const skip = page.getByText("Skip for now", { exact: true });
  const quick = page.getByPlaceholder(/Quick add/);
  await expect(quick).toBeVisible({ timeout: 90_000 });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await quick.fill(title);
  await quick.press("Enter");
  // before the fix the task saved (201) but never showed for the person who made it. The page remembers its last tab — look on "My tasks".
  await page.getByRole("button", { name: "My tasks", exact: true }).click();
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 30_000 });
  await ctx.close();
});

test("a staff member is kept inside the staff portal", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: statePath("staff") });
  const page = await ctx.newPage();
  for (const url of ["/company/dash", "/platform/providers", "/custdash/browse"]) {
    await page.goto(url);
    await page.waitForURL(/\/staff\//, { timeout: 60_000 });
  }
  await ctx.close();
});
