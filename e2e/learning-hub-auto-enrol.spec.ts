import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL, ROOT, type AccountManifest, type TestAccount } from "./helpers/env";
import { apiFetch, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, markParentWelcomed, provisionLiveListing, type ProvisionedListing } from "./helpers/tenantData";
import { openTab } from "./helpers/hubTabs";

// Learning Hub — AUTO-ENROL ON BOOKING (settings.hub.autoEnrolOnBooking, server/src/lib/hubAutoEnrol.ts).
//  • default OFF: a parent's booking leaves the child in the tutor's "Enrol a student" list (nobody is enrolled behind the tutor's back);
//  • the switch lives in the Enrol dialog (and Setup): flipping it saves to the tutor's config;
//  • ON: the next booking puts THAT child on the roster straight away (active, no tutor), and is not retroactive;
//  • a child the tutor paused stays paused when the family books again.
// Runs on the COMPANY tenant: a freelancer's "minimum gap between sessions" rule would 409 several same-day bookings on one shared parent.
// Every assertion is anchored to THIS run's children (ids/names carry the stamp).

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const HUB = "/api/learning-hub";
const offKid = `Autooff${stamp}`;
const onKid = `Autoon${stamp}`;
const pausedKid = `Autopaused${stamp}`;

let accounts: AccountManifest["accounts"];
let tenantId = "";
let listing: ProvisionedListing;
let offId = "", onId = "", pausedId = "";

interface Lib { settings?: { features?: Record<string, boolean> } & Record<string, unknown> }
async function setHub(op: TestAccount, on: boolean) {
  const s = await fbSignIn(op.email);
  const lib = (await apiFetch<Lib | null>("/api/library", s.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...(lib.settings?.features ?? {}), learninghub: on } };
  await apiFetch("/api/library", s.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
}
const tutorToken = async () => (await fbSignIn(accounts.company.email)).idToken;
const setAuto = async (on: boolean) => apiFetch(`${HUB}/config`, await tutorToken(), { method: "PUT", body: JSON.stringify({ hub: { autoEnrolOnBooking: on } }) });
const getAuto = async () => (await apiFetch<{ hub: { autoEnrolOnBooking: boolean } }>(`${HUB}/config`, await tutorToken())).hub.autoEnrolOnBooking;
interface Row { childId: string; active?: boolean; subjects: string[]; tutorUid: string | null }
const roster = async () => apiFetch<Row[]>(`${HUB}/students`, await tutorToken());
const rowOf = async (childId: string) => (await roster()).find((r) => r.childId === childId);
/** Auto-enrol runs after the booking response (fire-and-forget): poll for it instead of assuming it is instant. */
const waitForRow = async (childId: string, present: boolean) => {
  await expect.poll(async () => !!(await rowOf(childId)), { timeout: 30_000, intervals: [500, 1000] }).toBe(present);
};

const envApi = (() => {
  try {
    const m = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/^NEXT_PUBLIC_API_URL=(.*)$/m);
    return m?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
  } catch { return ""; }
})();
async function tutorPage(browser: Browser) {
  const ctx = await browser.newContext({ storageState: statePath("company") });
  if (envApi && envApi !== API_URL) {
    const origin = new URL(envApi).origin;
    await ctx.route((u) => u.origin === origin, async (route) => {
      const url = route.request().url().replace(origin, API_URL);
      if (url.includes("/api/events/") && !url.includes("/ticket")) return route.abort();
      try { await route.fulfill({ response: await route.fetch({ url }) }); } catch { await route.abort(); }
    });
  }
  return { ctx, page: await ctx.newPage() };
}
async function gotoStudents(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await setHub(accounts.company, true);
    await page.goto("/company/learninghub?tab=students");
    if (await page.getByRole("tab").first().isVisible({ timeout: 25_000 }).catch(() => false)) break;
  }
  await openTab(page, /^Students/);
}

test.beforeAll(async () => {
  test.setTimeout(300_000);
  accounts = loadAccounts().accounts;
  tenantId = accounts.company.tenantId!;
  await setHub(accounts.company, true);
  await setAuto(false);
  listing = await provisionLiveListing(accounts.company, { title: `E2E Auto-enrol ${stamp}`, price: 0 });
  offId = await createParentChild(accounts.parent, { name: offKid });
  onId = await createParentChild(accounts.parent, { name: onKid });
  pausedId = await createParentChild(accounts.parent, { name: pausedKid });
  await markParentWelcomed(accounts.parent);
});
test.beforeEach(async () => { await setHub(accounts.company, true); });
test.afterAll(async () => { await setAuto(false).catch(() => {}); await setHub(accounts.company, false); });

test("default OFF: a booking leaves the child waiting in the Enrol list, not on the roster", async ({ browser }) => {
  test.setTimeout(240_000);
  expect(await getAuto()).toBe(false);
  await bookViaApi(accounts.parent, listing, { child: offKid, dates: [listing.runFrom] });
  // give a (wrongly) eager server time to enrol, then prove it did not
  await new Promise((r) => setTimeout(r, 4000));
  expect(await rowOf(offId)).toBeUndefined();

  const { ctx, page } = await tutorPage(browser);
  await gotoStudents(page);
  await page.getByRole("button", { name: /Enrol a student|Enrol your first student/ }).first().click();
  const dialog = page.getByTestId("hub-enrol-modal").or(page.getByRole("dialog")).first();
  const row = dialog.locator("li").filter({ hasText: offKid });
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row.getByRole("button", { name: new RegExp(`Enrol ${offKid}`) })).toBeVisible();
  await expect(dialog.getByTestId("hub-enrol-auto")).toBeVisible();
  await expect(dialog.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  await ctx.close();
});

test("the switch in the Enrol dialog saves the setting", async ({ browser }) => {
  test.setTimeout(240_000);
  const { ctx, page } = await tutorPage(browser);
  await gotoStudents(page);
  await page.getByRole("button", { name: /Enrol a student|Enrol your first student/ }).first().click();
  const sw = page.getByTestId("hub-enrol-auto").getByRole("switch");
  await expect(sw).toHaveAttribute("aria-checked", "false", { timeout: 30_000 });
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await expect.poll(getAuto, { timeout: 20_000 }).toBe(true);
  await ctx.close();
});

test("ON: the next booking puts that child on the roster straight away; earlier ones are not swept in", async () => {
  test.setTimeout(240_000);
  expect(await getAuto()).toBe(true);
  await bookViaApi(accounts.parent, listing, { child: onKid, dates: [listing.runFrom] });
  await waitForRow(onId, true);
  const r = (await rowOf(onId))!;
  expect(r.active).not.toBe(false);
  expect(r.subjects).toEqual([]);
  expect(r.tutorUid).toBeNull();
  // the child who booked while it was OFF is still waiting
  expect(await rowOf(offId)).toBeUndefined();
});

test("a child the tutor paused stays paused when the family books again", async () => {
  test.setTimeout(240_000);
  expect(await getAuto()).toBe(true);
  // first booking: auto-enrolled (ON)
  await bookViaApi(accounts.parent, listing, { child: pausedKid, dates: [listing.runFrom] });
  await waitForRow(pausedId, true);
  // the tutor pauses them
  const t = await tutorToken();
  await apiFetch(`${HUB}/students/${pausedId}`, t, { method: "DELETE" });
  await expect.poll(async () => (await rowOf(pausedId))?.active, { timeout: 20_000 }).toBe(false);
  // the family books again (another listing): still paused, not re-activated or re-created
  const again = await provisionLiveListing(accounts.company, { title: `E2E Auto-enrol again ${stamp}`, price: 0 });
  await bookViaApi(accounts.parent, again, { child: pausedKid, dates: [again.runFrom] });
  await new Promise((r) => setTimeout(r, 4000));
  expect((await rowOf(pausedId))?.active).toBe(false);
});

test("turning it OFF again stops it: the next booking waits for the tutor", async () => {
  test.setTimeout(240_000);
  await setAuto(false);
  expect(await getAuto()).toBe(false);
  const later = await provisionLiveListing(accounts.company, { title: `E2E Auto-enrol later ${stamp}`, price: 0 });
  const laterKid = `Autolater${stamp}`;
  const laterId = await createParentChild(accounts.parent, { name: laterKid });
  await bookViaApi(accounts.parent, later, { child: laterKid, dates: [later.runFrom] });
  await new Promise((r) => setTimeout(r, 4000));
  expect(await rowOf(laterId)).toBeUndefined();
});
