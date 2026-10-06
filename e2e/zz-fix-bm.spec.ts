import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT, type TestAccount } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, apiFetch, apiPost, fbSignIn, fbSignUp } from "./helpers/accounts";
import { markParentWelcomed } from "./helpers/tenantData";

// Fixes for BM-003 (parent sign-up from a booking), BM-022 (booking cut-off greys days), BM-031 (clash chip drops the pass). Fresh throwaway accounts.
const SHOTS = path.join(ROOT, "e2e/review/shots/fix");
const run = Date.now().toString(36);
async function shot(page: Page, id: string) {
  await page.screenshot({ path: path.join(SHOTS, `${id}.png`), fullPage: true }).catch(() => {});
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const nextMonday = () => { const d = new Date(); d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7)); return d; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const MON1 = nextMonday();
const day = (week: number, dow: number) => iso(addDays(MON1, week * 7 + dow)); // dow 0=Mon

interface Op { acc: TestAccount; tok: string }
async function mkOperator(role: "freelancer" | "company", tag: string): Promise<Op> {
  const email = `e2e-bm-${tag}-${run}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  const name = `BM ${tag} ${run}`;
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role, businessName: name, providerName: name, providerNameMode: "business" });
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", r.tenantId], { stdio: "pipe" });
  const acc: TestAccount = { role, email, uid: s.uid, tenantId: r.tenantId, tenantName: name };
  const tok = (await fbSignIn(email)).idToken;
  await apiFetch("/api/library", tok, {
    method: "PUT",
    body: JSON.stringify({ venues: [{ id: "bm-venue", name: "BM Hall", address: "1 Test Way", city: "Northampton" }], settings: { marketplaceListed: true, providerName: name, payMethods: ["card", "cash", "bank"], phoneRequired: false } }),
  });
  return { acc, tok };
}
interface Parent { acc: TestAccount; email: string; tok: string }
async function mkParent(tag: string, phone?: string): Promise<Parent> {
  const email = `e2e-bm-par-${tag}-${run}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  await apiPost("/api/register-role", s.idToken, { role: "parent", postcode: "NN5 7EA" });
  const acc: TestAccount = { role: "parent", email, uid: s.uid, tenantId: null, tenantName: null };
  await markParentWelcomed(acc);
  if (phone) await apiFetch("/api/me", s.idToken, { method: "PATCH", body: JSON.stringify({ phone }) }).catch(() => {});
  return { acc, email, tok: (await fbSignIn(email)).idToken };
}
async function follow(p: Parent, tenantId: string) { await apiPost("/api/my/providers/follow", p.tok, { tenantId }); }
async function uiLogin(browser: Browser, email: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/custdash/**", { timeout: 45_000 });
  return { ctx, page };
}

interface LOpts { periods?: [string, string, string][]; title: string; flat?: [string, number, number][]; max?: number; extra?: Record<string, unknown>; weeks?: number }
interface L { id: string; title: string; tenantId: string; blockId?: string }
async function mkListing(op: Op, o: LOpts): Promise<L> {
  const t = op.tok;
  const periodIds: string[] = [];
  for (const [title, start, finish] of o.periods ?? [["Full day", "09:00", "15:30"]]) periodIds.push((await apiPost<{ id: string }>("/api/periods", t, { title, start, finish })).id);
  const defs = o.flat ?? [["1 day", 1, 20], ["3 days", 3, 54], ["5 days", 5, 90]];
  const passIds: string[] = [];
  const passFlat: Record<string, number> = {}, passMode: Record<string, "flat"> = {};
  for (const [name, days, price] of defs) {
    const p = await apiPost<{ id: string }>("/api/passes", t, { name, days });
    passIds.push(p.id); passFlat[p.id] = price; passMode[p.id] = "flat";
  }
  const bundle = await apiPost<{ id: string }>("/api/block-bundles", t, { name: `BM Block ${o.title}`, periodIds, passIds, priced: true, masterPrice: [...defs].sort((a, b) => b[1] - a[1])[0][2], calcOn: true, passFlat, passMode });
  const listing = await apiPost<{ id: string; tenantId: string }>("/api/listings", t, {
    title: o.title, venueId: "bm-venue", runFrom: iso(MON1), runTo: iso(addDays(MON1, (o.weeks ?? 3) * 7 - 3)),
    blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: String(o.max ?? 10), capacityScope: "day", waitlist: true, waitlistMode: "manual",
    showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id, passes: defs.map(([name, days, price]) => ({ name, price, days })),
    bookingType: "auto", status: "live", visibility: "public", ...o.extra,
  });
  await apiFetch(`/api/block-bundles/${bundle.id}/listings`, t, { method: "PUT", body: JSON.stringify({ listingIds: [listing.id] }) });
  return { id: listing.id, title: o.title, tenantId: listing.tenantId };
}
async function bookApi(p: Parent, l: L, items: { pass: string; child: string; age?: number; dates: string[] }[], method = "cash", extra: Record<string, unknown> = {}) {
  const doc = await apiFetch<{ blocks: { id: string }[] }>(`/api/listings/${l.id}`, p.tok);
  return apiFetch<{ bookings: { ref: string; status: string; amount?: number; total?: number; payStatus?: string; pay?: string }[] }>("/api/my/bookings", p.tok, {
    method: "POST", body: JSON.stringify({ listingId: l.id, blockId: doc.blocks[0].id, method, phone: "07700900123", items: items.map((i) => ({ age: 8, ...i })), ...extra }),
  });
}
async function child(p: Parent, name: string, dob = "2018-05-14") { return (await apiPost<{ id: string }>("/api/my/children", p.tok, { name, dob })).id; }
const myBookings = (p: Parent) => apiFetch<any[]>("/api/my/bookings", p.tok);


test.describe.configure({ mode: "serial" });
let opA: Op, std: L, cut: L;
const dayBtns = (page: Page) => page.getByRole("button", { name: /^(Mon|Tue|Wed|Thu|Fri) \d+$/ });

test.beforeAll(async () => {
  test.setTimeout(240_000);
  fs.mkdirSync(SHOTS, { recursive: true });
  opA = await mkOperator("freelancer", "A");
  std = await mkListing(opA, { title: `Fix Standard ${run}` });
  cut = await mkListing(opA, { title: `Fix Cutoff ${run}`, extra: { bookingCutoffHours: "240" } });
});

test("operator /signup offers an I'm a parent link", async ({ page }) => {
  await page.goto("/signup?next=" + encodeURIComponent(`/book/${std.id}`));
  const link = page.getByTestId("signup-im-parent");
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", new RegExp(`^/parent\\?tab=up&next=`));
  await shot(page, "signup-parent-link");
});

test("BM-003 new parent: booking page -> Sign in -> Create an account -> parent sign-up -> back to the booking with basket", async ({ page }) => {
  await page.goto(`/book/${std.id}`);
  await page.getByRole("button", { name: /^1 day · £/ }).first().click();
  const timing = page.getByText(/choose a timing/i);
  if (await timing.isVisible().catch(() => false)) await page.getByRole("button", { name: /Full day/ }).first().click();
  await dayBtns(page).first().click();
  await page.getByRole("button", { name: /Add .* to basket/ }).click();
  await page.getByRole("link", { name: "Sign in", exact: true }).first().click();
  await page.waitForURL(/\/login\?next=/);
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.waitForURL(/\/parent\?tab=up&next=/);
  expect(decodeURIComponent(new URL(page.url()).searchParams.get("next")!)).toBe(`/book/${std.id}`);
  const prov = page.getByRole("combobox");
  await prov.fill(opA.acc.tenantName!);
  await expect(page.getByRole("option").first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("option").first().click();
  await page.getByPlaceholder("you@example.com").fill(`e2e-fix-par-${run}@${TEST_EMAIL_DOMAIN}`);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await shot(page, "bm003-parent-signup");
  await page.getByRole("button", { name: /create/i }).last().click();
  await page.waitForURL(new RegExp(`/book/${std.id}`), { timeout: 45_000 });
  await expect(page.getByText(/1 day/).first()).toBeVisible();
  await expect(page.getByText(/Your basket/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Total\s*£20\.00/).first()).toBeVisible();
  await shot(page, "bm003-back-on-booking-with-basket");
});

test("BM-003 open redirect is refused", async ({ page }) => {
  await page.goto("/parent?tab=in&next=" + encodeURIComponent("https://evil.example/x"));
  await expect(page.getByText(/sign in/i).first()).toBeVisible();
  await page.goto("/login?next=" + encodeURIComponent("//evil.example"));
  await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup");
});

test("BM-022 days inside the booking cut-off are greyed and labelled", async ({ browser }) => {
  const p = await mkParent("c22"); await follow(p, cut.tenantId);
  const { ctx, page } = await uiLogin(browser, p.email);
  await page.goto(`/book/${cut.id}`);
  await page.getByRole("button", { name: /^1 day · £/ }).first().click();
  const timing = page.getByText(/choose a timing/i);
  if (await timing.isVisible().catch(() => false)) await page.getByRole("button", { name: /Full day/ }).first().click();
  const closed = page.locator('button[title="Bookings closed"]');
  await expect(closed.first()).toBeVisible();
  expect(await closed.count()).toBeGreaterThanOrEqual(5);
  await expect(closed.first()).toBeDisabled();
  await expect(closed.first()).toContainText(/closed/i);
  await expect(dayBtns(page).first()).toBeEnabled(); // Wed 14 is outside the 10 day window
  await shot(page, "bm022-cutoff-days");
  await ctx.close();
});

test("BM-031 clash chip takes the child off and the empty pass leaves the basket and total", async ({ browser }) => {
  const p = await mkParent("b31"); await follow(p, std.tenantId);
  const k = `Clash Kid ${run}`; await child(p, k);
  const first = await bookApi(p, std, [{ pass: "1 day", child: k, dates: [day(0, 0)] }]);
  const { ctx, page } = await uiLogin(browser, p.email);
  await page.goto(`/book/${std.id}`);
  await page.getByRole("button", { name: /^1 day · £/ }).first().click();
  const timing = page.getByText(/choose a timing/i);
  if (await timing.isVisible().catch(() => false)) await page.getByRole("button", { name: /Full day/ }).first().click();
  await dayBtns(page).nth(0).click();
  await dayBtns(page).nth(1).click();
  await page.getByRole("button", { name: /Add .* to basket/ }).click();
  await page.getByRole("button", { name: /Next — add children/ }).click();
  await page.getByRole("button", { name: `Add ${k} to this booking` }).click();
  await expect(page.getByText(new RegExp(`${k} already has a place on .*${first.bookings[0].ref}`)).first()).toBeVisible();
  await shot(page, "bm031-before");
  // two single-day lines: take the child off the clashing one
  await page.getByRole("button", { name: `✓ ${k}` }).first().click();
  await expect(page.getByText(/already has a place on/)).toHaveCount(0);
  await expect(page.getByText(/Nobody.s on this/)).toHaveCount(0);
  await shot(page, "bm031-after");
  const so = page.getByText("Booking so far");
  if (await so.count()) {
    const txt = await so.locator("xpath=..").innerText();
    expect(txt).toContain("£20.00");
    expect(txt).not.toContain("£40.00");
  }
  await ctx.close();
});
