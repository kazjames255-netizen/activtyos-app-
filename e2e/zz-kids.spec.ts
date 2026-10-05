import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, apiFetch, apiPost, fbSignIn, fbSignUp } from "./helpers/accounts";
import { markParentWelcomed } from "./helpers/tenantData";

// The checkout "Who's coming?" step: screenshots for before/after review. PHASE=before|after, KIDS_MODE=phone|desktop.
const PHASE = process.env.PHASE || "after";
const MODE = process.env.KIDS_MODE === "phone" ? "phone" : "desktop";
const SHOTS = path.join(ROOT, "e2e/review/shots/kids");
const run = Date.now().toString(36);
const shot = (page: Page, id: string) => page.screenshot({ path: path.join(SHOTS, `${PHASE}-${MODE}-${id}.png`), fullPage: true }).catch(() => {});
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const MON1 = (() => { const d = new Date(); d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7)); return d; })();

let opTok = "", opEmail = "", tenantId = "", tenantName = "", listingId = "";
async function mkParent(tag: string, kids: string[]) {
  const email = `e2e-kids-${tag}-${run}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  await apiPost("/api/register-role", s.idToken, { role: "parent", postcode: "NN5 7EA" });
  await markParentWelcomed({ role: "parent", email, uid: s.uid, tenantId: null, tenantName: null });
  const tok = (await fbSignIn(email)).idToken;
  await apiFetch("/api/me", tok, { method: "PATCH", body: JSON.stringify({ phone: "07700900123" }) }).catch(() => {});
  await apiPost("/api/my/providers/follow", tok, { tenantId });
  for (const k of kids) await apiPost("/api/my/children", tok, { name: k, dob: "2018-05-14", sex: "girl" });
  return email;
}
async function login(page: Page, email: string, wait: RegExp) {
  await page.goto("/login");
  await page.waitForLoadState("load");
  await page.waitForTimeout(1500); // hydrate first or React wipes the typed values
  await page.locator("#login-email").fill(email);
  await page.locator('input[type="password"]').first().fill(TEST_PASSWORD);
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL(wait, { timeout: 60_000 });
}
const dayBtns = (page: Page) => page.getByRole("button", { name: /^(Mon|Tue|Wed|Thu|Fri) \d+$/ });
async function toChildren(page: Page, pass: "1 day" | "3 days", n: number) {
  await page.goto(`/book/${listingId}`);
  await page.getByRole("button", { name: new RegExp(`^${pass} · £`) }).first().click();
  const timing = page.getByText(/choose a timing/i);
  if (await timing.isVisible().catch(() => false)) await page.getByRole("button", { name: /Full day/ }).first().click();
  for (let i = 0; i < n; i++) await dayBtns(page).nth(i).click();
  await page.getByRole("button", { name: /Add .* to basket/ }).click();
  await page.getByRole("button", { name: /Next — add children/ }).click();
  await page.getByText(/Who.s coming|Your children/).first().waitFor();
}
const addForm = async (page: Page, name: string) => {
  await page.getByRole("button", { name: /^(＋ )?Add a (new )?child$/ }).click();
  await page.getByPlaceholder(/first and last name/i).first().fill(name);
  await page.locator('input[type="date"]').first().fill("2018-03-14");
  const girl = page.getByRole("button", { name: "Girl", exact: true });
  if (await girl.isVisible().catch(() => false)) await girl.click();
};

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  test.setTimeout(240_000);
  fs.mkdirSync(SHOTS, { recursive: true });
  opEmail = `e2e-kids-op-${run}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(opEmail);
  tenantName = `Kids ${run}`;
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role: "freelancer", businessName: tenantName, providerName: tenantName, providerNameMode: "business" });
  tenantId = r.tenantId;
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", tenantId], { stdio: "pipe" });
  opTok = (await fbSignIn(opEmail)).idToken;
  await apiFetch("/api/library", opTok, { method: "PUT", body: JSON.stringify({ venues: [{ id: "k-venue", name: "Kids Hall", address: "1 Test Way", city: "Northampton" }], settings: { marketplaceListed: true, providerName: tenantName, payMethods: ["card", "cash", "bank"], phoneRequired: false } }) });
  const period = await apiPost<{ id: string }>("/api/periods", opTok, { title: "Full day", start: "09:00", finish: "15:30" });
  const defs: [string, number, number][] = [["1 day", 1, 20], ["3 days", 3, 54], ["5 days", 5, 90]];
  const passIds: string[] = []; const passFlat: Record<string, number> = {}, passMode: Record<string, "flat"> = {};
  for (const [name, days, price] of defs) { const p = await apiPost<{ id: string }>("/api/passes", opTok, { name, days }); passIds.push(p.id); passFlat[p.id] = price; passMode[p.id] = "flat"; }
  const bundle = await apiPost<{ id: string }>("/api/block-bundles", opTok, { name: `K Block ${run}`, periodIds: [period.id], passIds, priced: true, masterPrice: 90, calcOn: true, passFlat, passMode });
  const l = await apiPost<{ id: string }>("/api/listings", opTok, {
    title: `Kids Camp ${run}`, venueId: "k-venue", runFrom: iso(MON1), runTo: iso(addDays(MON1, 3 * 7 - 3)), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "10", capacityScope: "day",
    waitlist: true, waitlistMode: "manual", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id, passes: defs.map(([name, days, price]) => ({ name, price, days })), bookingType: "auto", status: "live", visibility: "public",
  });
  listingId = l.id;
  await apiFetch(`/api/block-bundles/${bundle.id}/listings`, opTok, { method: "PUT", body: JSON.stringify({ listingIds: [l.id] }) });
});

test("1 · parent with no children adds the first", async ({ page }) => {
  const email = await mkParent("zero", []);
  await login(page, email, /custdash/);
  await toChildren(page, "1 day", 1);
  await shot(page, "1a-empty");
  await addForm(page, "Mia Zero");
  await shot(page, "1b-form");
  await page.getByRole("button", { name: "Add child", exact: true }).click();
  await shot(page, "1c-added");
});

test("2 · parent with two children picks one, adds a third", async ({ page }) => {
  const email = await mkParent("two", ["Ava Two", "Ben Two"]);
  await login(page, email, /custdash/);
  await toChildren(page, "3 days", 3);
  await shot(page, "2a-list");
  await page.getByRole("button", { name: /Ava Two/ }).first().click();
  await shot(page, "2b-one-selected");
  await addForm(page, "Cleo Two");
  await shot(page, "2c-form");
  await page.getByRole("button", { name: "Add child", exact: true }).click();
  await shot(page, "2d-third-added");
  await page.getByRole("button", { name: /Ben Two/ }).first().click();
  await shot(page, "2e-three-selected");
  const days = page.getByRole("button", { name: /Choose days for each child/ });
  if (await days.count()) { await days.click(); await shot(page, "2f-per-pass"); }
});

test("3 · two children, 3-day pass, through to Pay", async ({ page }) => {
  const email = await mkParent("pay", ["Dan Pay", "Eve Pay"]);
  await login(page, email, /custdash/);
  await toChildren(page, "3 days", 3);
  await page.getByRole("button", { name: /Dan Pay/ }).first().click();
  await page.getByRole("button", { name: /Eve Pay/ }).first().click();
  await shot(page, "3a-both");
  await page.getByRole("button", { name: /^Next/ }).last().click();
  await page.waitForTimeout(1500);
  await shot(page, "3b-after-next");
  for (let i = 0; i < 4; i++) {
    const skip = page.getByRole("button", { name: /^(Skip|Next)/ }).last();
    if (await page.getByText(/Confirm|Total/).first().isVisible().catch(() => false) && (await page.getByText(/Pay (by|with)|Payment/i).count())) break;
    if (await skip.isVisible().catch(() => false)) { await skip.click().catch(() => {}); await page.waitForTimeout(800); } else break;
  }
  await shot(page, "3c-pay");
});

test("4 · operator Take a booking", async ({ page }) => {
  await login(page, opEmail, /freelancer/);
  await page.goto("/freelancer/bookings");
  await page.getByRole("button", { name: /Take a booking/ }).first().click({ timeout: 60_000 });
  await page.getByRole("heading", { name: "Take a booking" }).waitFor();
  await page.waitForTimeout(2500);
  await page.locator("button").filter({ hasText: /^\s*(MON|TUE)\s*\d+/i }).first().click({ timeout: 15_000 }).catch(() => {});
  await page.getByRole("button", { name: /Add .* basket/i }).first().click({ timeout: 15_000 }).catch(() => {});
  await page.getByRole("button", { name: /Checkout \(\d+\)/ }).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1500);
  const fieldAfter = (label: RegExp) => page.getByText(label).first().locator("xpath=following::input[1]");
  await fieldAfter(/^Parent.s full name$/).fill("Sam Parent");
  await fieldAfter(/^Email$/).fill(`e2e-kids-fam-${run}@${TEST_EMAIL_DOMAIN}`);
  await fieldAfter(/^Phone$/).fill("07700 900123");
  await page.getByRole("button", { name: /Set up Sam/ }).click();
  await page.getByRole("button", { name: /Book for Sam/ }).click();
  await page.waitForTimeout(1200);
  await shot(page, "4a-empty");
  await addForm(page, "Op Kid");
  await shot(page, "4b-form");
  await page.getByRole("button", { name: "Add child", exact: true }).click();
  await shot(page, "4c-added");
});
