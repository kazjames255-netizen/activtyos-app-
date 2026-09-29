import { test, expect } from "@playwright/test";
import { loadAccounts, statePath } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn, fbSignUp, TEST_EMAIL_DOMAIN } from "./helpers/accounts";
import { bookViaApi, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { dismissParentWelcome } from "./helpers/ui";

// Messaging / notification scoping and delivery (plan3 P8):
//  · a franchise can only message ITS OWN families (1:1 and from-booking);
//  · a franchise only sees its own families on the marketing suppression list;
//  · HQ support replies reach the right bell (franchise thread -> franchise, a
//    parent's own thread -> that parent — it used to reach nobody);
//  · the parent's accident-alert switch is a SERVER preference, not localStorage.

test.describe.configure({ mode: "serial" });
const stamp = Date.now().toString(36);

test("a franchise cannot message head office's family, only its own", async () => {
  test.setTimeout(150_000);
  const { accounts } = loadAccounts();
  // A second family, booked ONLY with head office (no franchiseId).
  const email = `e2e-comms-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const s2 = await fbSignUp(email);
  await apiPost("/api/register-role", s2.idToken, { role: "parent", postcode: "NN5 7EA" });
  const hoFamily = { role: "parent" as const, email, uid: s2.uid, tenantId: null, tenantName: null };
  const hoListing = await provisionLiveListing(accounts.company, { title: `E2E Comms HO ${stamp}`, price: 0 });
  const kid = `E2E Comms Kid ${stamp}`;
  await apiPost("/api/my/children", s2.idToken, { name: kid, dob: "2018-05-14" });
  const booking = await bookViaApi(hoFamily, hoListing, { child: kid });

  const fr = await fbSignIn(accounts.franchise.email);
  await expect(apiPost("/api/messages", fr.idToken, { parentEmail: email, body: "should be refused" })).rejects.toThrow(/only message your own/i);
  await expect(apiPost("/api/messages/from-booking", fr.idToken, { ref: booking.ref, body: "should be refused" })).rejects.toThrow(/Booking not found/);
  await expect(apiPost("/api/emails/suppress", fr.idToken, { email })).rejects.toThrow(/isn't one of yours/);
  const sups = await apiFetch<{ suppressions: { email: string }[] }>("/api/emails/suppressions", fr.idToken);
  expect(sups.suppressions.map((x) => x.email)).not.toContain(email);

  // Head office CAN message that family (positive control).
  const co = await fbSignIn(accounts.company.email);
  await apiPost("/api/messages", co.idToken, { parentEmail: email, body: `E2E HO hello ${stamp}` });
});

test("HQ support replies reach the franchise bell and a parent's own thread", async () => {
  test.setTimeout(120_000);
  const { accounts } = loadAccounts();
  const marker = `E2E support ${stamp}`;
  const par = await fbSignIn(accounts.parent.email);
  const fr = await fbSignIn(accounts.franchise.email);
  const hq = await fbSignIn(accounts.platform.email);
  await apiPost("/api/messages/support", par.idToken, { body: `${marker} parent`, topic: "general" });
  await apiPost("/api/messages/support", fr.idToken, { body: `${marker} franchise`, topic: "general" });
  const { threads } = await apiFetch<{ threads: { id: string; party: string; email: string; franchiseId?: string | null; messages?: { body: string }[] }[] }>("/api/platform/support", hq.idToken);
  const mine = (who: string) => threads.find((t) => t.messages?.some((m) => m.body === `${marker} ${who}`))!;
  expect(mine("parent")).toBeTruthy();
  expect(mine("franchise")).toBeTruthy();
  await apiPost(`/api/platform/support/${mine("parent").id}/messages`, hq.idToken, { body: `${marker} reply-parent` });
  await apiPost(`/api/platform/support/${mine("franchise").id}/messages`, hq.idToken, { body: `${marker} reply-franchise` });

  const bell = async (idToken: string) => (await apiFetch<{ notifications: { title: string; body: string; franchiseId?: string }[] }>("/api/notifications", idToken)).notifications;
  await expect.poll(async () => (await bell(par.idToken)).some((n) => n.body === `${marker} reply-parent`), { timeout: 20_000 }).toBe(true);
  await expect.poll(async () => (await bell(fr.idToken)).some((n) => n.body === `${marker} reply-franchise`), { timeout: 20_000 }).toBe(true);
});

test.describe("accident alert switch is server-side", () => {
  test.use({ storageState: statePath("parent") });
  test("turning alerts off mutes accident + incident emails on the server", async ({ page }) => {
    test.setTimeout(90_000);
    const { accounts } = loadAccounts();
    await markParentWelcomed(accounts.parent);
    const par = await fbSignIn(accounts.parent.email);
    const prefs = () => apiFetch<{ muted: Record<string, boolean> }>("/api/notifications/prefs", par.idToken);
    await apiFetch("/api/notifications/prefs", par.idToken, { method: "PUT", body: JSON.stringify({ category: "accident", muted: false }) });
    await apiFetch("/api/notifications/prefs", par.idToken, { method: "PUT", body: JSON.stringify({ category: "incident", muted: false }) });
    await page.goto("/custdash/accidents");
    await dismissParentWelcome(page);
    await page.getByRole("button", { name: /Stop notifying me/ }).click();
    await expect.poll(async () => { const m = (await prefs()).muted; return !!m.accident && !!m.incident; }, { timeout: 15_000 }).toBe(true);
    await page.reload();
    await expect(page.getByRole("button", { name: /Turn alerts back on/ })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /Turn alerts back on/ }).click();
    await expect.poll(async () => { const m = (await prefs()).muted; return !m.accident && !m.incident; }, { timeout: 15_000 }).toBe(true);
  });
});
