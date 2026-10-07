import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, apiFetch, apiPost, fbSignUp, fbSignIn } from "../helpers/accounts";
import { provisionLiveListing } from "../helpers/tenantData";
import { execFileSync } from "node:child_process";
import { ROOT, WEB_URL } from "../helpers/env";

// Screenshots of the booking-page colour themes: the public booking page (desktop + 390px phone) and the
// listing wizard's Preview step with the picker. Throwaway @activityos-test.com account only.
//   E2E_BASE_URL=http://localhost:3101 NEXT_PUBLIC_API_URL=http://localhost:4101 npx playwright test -c <config> e2e/review/theme-shots.spec.ts
const OUT = path.join(ROOT, "e2e/review/shots/themes");
const THEMES = (process.env.THEME_LIST || "lagoon,arcade,aurora,sherbet,varsity,plum,halftone,wildwood,pirouette,riso,brite,pitch,frost,mint,poster,sport,playful").split(",");
const NAME: Record<string, string> = { lagoon: "Lagoon", arcade: "Arcade", sherbet: "Sherbet", varsity: "Varsity", pitch: "Pitchside", poster: "Poster", plum: "Plum & Wasabi", mint: "Mint Choc", riso: "Riso" };
const WIZARD = (process.env.WIZARD_LIST || "lagoon,arcade,sherbet,varsity,pitch,poster").split(",");

test("theme screenshots", async ({ browser }) => {
  test.setTimeout(900_000);
  fs.mkdirSync(OUT, { recursive: true });
  const runId = "th" + Date.now().toString(36);
  const email = `e2e-freelancer-${runId}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  const tenantName = `E2E Theme ${runId}`;
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role: "freelancer", businessName: tenantName, providerName: tenantName, providerNameMode: "business" });
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", r.tenantId], { stdio: "pipe" });
  const acct = { role: "freelancer" as const, email, uid: s.uid, tenantId: r.tenantId, tenantName };
  const listing = await provisionLiveListing(acct, { title: "Half-Term Football Camp", price: 35 });
  const tok = (await fbSignIn(email)).idToken;
  fs.writeFileSync(path.join(OUT, "_run.json"), JSON.stringify({ email, listing: listing.id, runId }, null, 2));

  for (const th of THEMES) {
    await apiFetch(`/api/listings/${listing.id}`, tok, { method: "PUT", body: JSON.stringify({ pageStyle: th }) });
    for (const [label, vp] of [["desktop", { width: 1280, height: 900 }], ["phone", { width: 390, height: 844 }]] as const) {
      const ctx = await browser.newContext({ viewport: vp });
      const page = await ctx.newPage();
      await page.goto(`${WEB_URL}/book/${listing.id}`);
      await expect(page.getByRole("heading", { level: 1, name: /Half-Term Football Camp/ })).toBeVisible({ timeout: 90_000 });
      await page.getByText("Keep looking").click({ timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(1500); // webfont + art settle
      await page.screenshot({ path: path.join(OUT, `book-${th}-${label}.png`), fullPage: true });
      await ctx.close();
    }
  }

  // Wizard preview (operator signed in through the real login form).
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(`${WEB_URL}/login`);
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/freelancer/**", { timeout: 90_000 });
  await page.goto(`${WEB_URL}/freelancer/listings`);
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  // The wizard's Preview step: find it by its title in the step bar.
  await page.getByTitle(/\. Preview$/).first().click({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  for (const th of WIZARD) {
    await page.getByTitle(NAME[th] ?? th, { exact: true }).first().click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, `wizard-${th}-desktop.png`), fullPage: true });
  }
  await ctx.close();
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pp = await phone.newPage();
  await pp.goto(`${WEB_URL}/login`);
  await pp.getByPlaceholder("you@example.com").fill(email);
  await pp.locator('input[type="password"]').fill(TEST_PASSWORD);
  await pp.getByRole("button", { name: "Sign in", exact: true }).click();
  await pp.waitForURL("**/freelancer/**", { timeout: 90_000 });
  await pp.goto(`${WEB_URL}/freelancer/listings`);
  await pp.getByRole("button", { name: "Edit", exact: true }).first().click();
  await pp.getByTitle(/\. Preview$/).first().click({ timeout: 60_000 });
  await pp.waitForTimeout(1500);
  for (const th of WIZARD.slice(0, 3)) {
    await pp.getByTitle(NAME[th] ?? th, { exact: true }).first().click();
    await pp.waitForTimeout(1200);
    await pp.screenshot({ path: path.join(OUT, `wizard-${th}-phone.png`), fullPage: true });
  }
  await phone.close();
});
