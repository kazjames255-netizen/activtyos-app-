import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, apiFetch, apiPost, fbSignUp, fbSignIn } from "../helpers/accounts";
import { provisionLiveListing } from "../helpers/tenantData";
import { execFileSync } from "node:child_process";
import { ROOT, WEB_URL } from "../helpers/env";

// Theme-artwork switch screenshots (throwaway account, own ports).
const OUT = path.join(ROOT, "e2e/review/shots/themeart");
const NAME: Record<string, string> = { arcade: "Arcade", poster: "Poster" };
const VPS = [["desktop", { width: 1280, height: 900 }], ["phone", { width: 390, height: 844 }]] as const;

test("theme art switch", async ({ browser }) => {
  test.setTimeout(900_000);
  fs.mkdirSync(OUT, { recursive: true });
  const runId = "ta" + Date.now().toString(36);
  const email = `e2e-freelancer-${runId}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  const tenantName = `E2E Art ${runId}`;
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role: "freelancer", businessName: tenantName, providerName: tenantName, providerNameMode: "business" });
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", r.tenantId], { stdio: "pipe" });
  const acct = { role: "freelancer" as const, email, uid: s.uid, tenantId: r.tenantId, tenantName };
  const listing = await provisionLiveListing(acct, { title: "Half-Term Football Camp", price: 35 });
  const tok = (await fbSignIn(email)).idToken;

  for (const th of ["poster", "arcade"]) {
    for (const art of [true, false]) {
      await apiFetch(`/api/listings/${listing.id}`, tok, { method: "PUT", body: JSON.stringify({ pageStyle: th, themeArt: art }) });
      for (const [label, vp] of VPS) {
        const ctx = await browser.newContext({ viewport: vp });
        const page = await ctx.newPage();
        await page.goto(`${WEB_URL}/book/${listing.id}`);
        await expect(page.getByRole("heading", { level: 1, name: /Half-Term Football Camp/ })).toBeVisible({ timeout: 90_000 });
        await page.getByText("Keep looking").click({ timeout: 5_000 }).catch(() => {});
        await page.waitForTimeout(1500);
        await expect(page.getByTestId("theme-hero")).toHaveAttribute("data-theme-art", art ? "on" : "off");
        await page.screenshot({ path: path.join(OUT, `book-${th}-${art ? "on" : "off"}-${label}.png`), fullPage: false });
        await ctx.close();
      }
    }
  }

  // Wizard preview + default-theme behaviour when editing.
  const defOf = async () => JSON.stringify(((await apiFetch<any>(`/api/library`, tok)) as any)?.settings?.defaultListingTheme ?? null);
  const defBefore = await defOf();
  for (const [label, vp] of VPS) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto(`${WEB_URL}/login`);
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/freelancer/**", { timeout: 90_000 });
    await page.goto(`${WEB_URL}/freelancer/listings`);
    await page.getByRole("button", { name: "Edit", exact: true }).first().click();
    await page.getByTitle(/\. Preview$/).first().click({ timeout: 60_000 });
    await page.waitForTimeout(1500);
    for (const th of ["poster", "arcade"]) {
      await page.getByTitle(NAME[th], { exact: true }).first().click();
      await page.waitForTimeout(1000);
      const sw = page.getByTestId("theme-art-switch").locator("input");
      await sw.scrollIntoViewIfNeeded();
      if (!(await sw.isChecked())) await sw.check();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(OUT, `wizard-${th}-on-${label}.png`) });
      await sw.uncheck();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(OUT, `wizard-${th}-off-${label}.png`) });
      await expect(page.getByTestId("theme-hero")).toHaveAttribute("data-theme-art", "off");
    }
    await ctx.close();
  }
  await new Promise((r) => setTimeout(r, 2500));
  const defAfter = await defOf();
  console.log("DEFAULT THEME before/after editing:", defBefore, defAfter);
  expect(defAfter).toBe(defBefore);
});
