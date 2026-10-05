import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD } from "./helpers/accounts";

// Exploratory "first hour as a brand-new Company provider" walk (see docs/provider-journey-company.md).
// Screenshots land in e2e/review/shots/journey-company/. Observation-oriented: it asserts only that each
// step loads, it is not a regression suite. Uses a FRESH @activityos-test.com account (npm run e2e:cleanup removes it).
const SHOTS = path.join(process.cwd(), "e2e/review/shots/journey-company");
const stamp = Date.now().toString(36);
const email = `e2e-jc-${stamp}@${TEST_EMAIL_DOMAIN}`;
const biz = `Sunny Days Camps ${stamp}`;
let n = 0;
const shot = async (page: Page, name: string, full = false) => {
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS, `S${String(++n).padStart(2, "0")}-${name}.png`), fullPage: full });
};

test.describe.configure({ mode: "serial" });
test.beforeAll(() => fs.mkdirSync(SHOTS, { recursive: true }));

test("1 public site -> company signup wizard (+ error states)", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/activly.html");
  await page.getByText("Provider sign up").first().click();
  await page.waitForURL(/signup/);
  await page.goto("/signup?plan=company");
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: /Continue/ }).click(); // error: business name
  await expect(page.getByText("Enter your business name.")).toBeVisible();
  await page.fill("#b-name", biz);
  await page.getByRole("button", { name: /Continue/ }).click(); // error: where based
  await page.fill("#b-addr", "12 High Street, Northampton");
  await page.getByRole("button", { name: /Continue/ }).click(); // error: postcode
  await page.getByText("Holiday camps").click();
  await page.fill("#b-pc", "NN5 7EA");
  await shot(page, "signup-business");
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: /Continue/ }).click(); // error: how heard
  await page.getByText("Google / search").click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.locator("input[type=checkbox]").check(); // Create account is disabled until ticked
  await page.fill("#l-email", email);
  await page.fill("#l-pw", TEST_PASSWORD);
  await page.getByRole("button", { name: /Create/ }).click();
  await expect(page.getByText("Get paid").first()).toBeVisible({ timeout: 30_000 });
  await shot(page, "signup-get-paid");
  await page.getByText(/Skip for now/).click();
});

test("2 billing gate -> start trial (local dev has no Stripe keys: empty card form passes)", async ({ page }) => {
  await page.goto("/company/bookings");
  await expect(page.getByText("Pick your plan")).toBeVisible({ timeout: 30_000 });
  await shot(page, "gate");
  await page.getByText("Growth · 11–30 staff").click();
  await page.getByText(/Annual/).click();
  await shot(page, "gate-annual");
  await page.getByRole("button", { name: /Start 7-day/ }).click();
  await expect(page.getByText("Pick your plan")).toBeHidden({ timeout: 30_000 });
});

test("3 onboarding surfaces + staff invite", async ({ page }) => {
  test.setTimeout(180_000);
  for (const [u, name] of [
    ["/company/dashboard", "dashboard"], ["/company/account", "onboarding-info"], ["/company/setup", "setup"],
    ["/company/getpaid", "getpaid"], ["/company/ratios", "ratios"], ["/company/staff", "team"], ["/company/credentials", "compliance"],
  ] as const) {
    await page.goto(u);
    await page.waitForLoadState("load");
    await shot(page, name, true);
  }
  await page.goto("/company/setup");
  for (const tab of ["Branding", "Child questions", "Safeguarding", "Age groups & rooms", "Cancellations & refunds", "Payments"]) {
    await page.getByRole("button", { name: tab, exact: true }).first().click();
    await shot(page, `setup-${tab.toLowerCase().replace(/\W+/g, "-")}`, true);
  }
  await page.goto("/company/staff");
  await page.getByPlaceholder("e.g. Jamie Rivers").fill("Jamie Rivers");
  await page.getByPlaceholder("their@email.com").fill(`e2e-jc-staff-${stamp}@${TEST_EMAIL_DOMAIN}`);
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: /^Next ›/ }).click();
  await page.getByRole("button", { name: /Send invite/ }).click();
  await expect(page.getByText("Pending").first()).toBeVisible();
});

test("4 venue -> block (period + 1/3/5-day passes + prices) -> 13-step listing -> publish", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/company/listings");
  await page.getByRole("button", { name: /^Locations$/ }).click();
  await page.getByRole("button", { name: /Add location/ }).click();
  await page.getByPlaceholder("e.g. Riverside Sports Hall").fill("Abington Park Pavilion");
  await page.getByPlaceholder("Street, town, postcode").fill("Abington Park, Northampton NN5 7EA");
  await page.getByRole("button", { name: /^Add$/ }).click();

  await page.goto("/company/blocks");
  await page.getByRole("button", { name: /Add a period/ }).click();
  await page.getByRole("button", { name: /^Add period$/ }).click();
  for (const [name, days] of [["Single day", "1"], ["3-day pass", "3"], ["5-day week pass", "5"]]) {
    await page.getByRole("button", { name: /Add a pass/ }).click();
    await page.getByPlaceholder(/Pass name/).fill(name);
    await page.locator("input[type=number]").first().fill(days);
    await page.getByRole("button", { name: /^Add pass$/ }).click();
  }
  const add = page.getByRole("button", { name: /\+ Add to block/ });
  for (let i = await add.count(); i > 0; i--) await add.first().click();
  await page.getByPlaceholder(/Summer Multi Activity/).fill("Half-term camp block");
  await page.getByRole("button", { name: /Move to Block Library/ }).click();
  await page.getByRole("button", { name: /Set prices/ }).first().click();
  for (const price of ["120", "75", "28"]) {
    await page.getByText("£0.00").first().click();
    await page.getByPlaceholder("0.00").first().fill(price);
  }
  await page.getByRole("button", { name: /Save pricing/ }).click();
  await shot(page, "block-priced");

  await page.goto("/company/listings");
  await page.getByRole("button", { name: /New listing/ }).click();
  await page.locator('input[placeholder^="e.g. Summer Multi"]').fill("Autumn Half-Term Multi-Sport Camp");
  await page.getByRole("button", { name: /^Next ›/ }).click();
  await page.waitForTimeout(3000); // typing inside ~1s of the first Next is lost (draft is created then re-hydrates)
  // NB the list page's own <select>s sit behind the wizard, so wizard selects are nth(3)/nth(4), date inputs nth(1)/(2)
  const nums = page.locator("input[type=number]");
  await nums.nth(0).fill("5");
  await nums.nth(1).fill("11");
  await page.locator("select").nth(3).selectOption({ index: 1 });
  await page.getByRole("button", { name: /^Holiday Multi-Activity Camps$/ }).click();
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: /^Next ›/ }).click(); // -> step 7
  const dates = page.locator("input[type=date]");
  await dates.nth(1).fill("2026-10-26");
  await dates.nth(2).fill("2026-11-06");
  await page.getByRole("button", { name: /^Next ›/ }).click(); // step 8
  await page.getByRole("button", { name: /Use this block/ }).click();
  await page.getByRole("button", { name: /^Next ›/ }).click(); // step 9 discounts
  await page.getByText("Multi-person", { exact: false }).first().click();
  await page.locator("input[value^='More than 1']").fill("Sibling discount");
  await page.locator("input[type=number]").last().fill("10");
  await page.getByRole("button", { name: /^Add discount$/ }).click();
  await page.getByText("Early bird", { exact: false }).first().click();
  await page.locator("input[value^='Book by the cut-off']").fill("Early bird");
  await page.locator("input[type=date]").last().fill("2026-10-12");
  await page.getByRole("button", { name: /^Add discount$/ }).click();
  await shot(page, "discounts", true);
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: /^Next ›/ }).click(); // -> step 13
  await page.getByRole("button", { name: /Publish/ }).last().click();
  await expect(page.getByText("Published").first()).toBeVisible({ timeout: 20_000 });
  await shot(page, "published", true);
});

// Steps 5-6 (parent signup from the public link, two siblings, "Cash on the day", provider-side detail, cancel one
// child, money-in) were walked with ad-hoc scripts; their screenshots are in the same folder (100-130 series) and the
// findings are in docs/provider-journey-company.md. Phone (WebKit iPhone 13) shots are the P01-P10 series.
