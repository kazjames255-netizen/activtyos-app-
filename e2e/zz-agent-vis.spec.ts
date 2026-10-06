import fs from "node:fs";
import path from "node:path";
import { test, chromium, expect } from "@playwright/test";
import { API_URL, ROOT, WEB_URL } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, fbSignUp } from "./helpers/accounts";

const SHOTS = path.join(ROOT, "e2e/review/shots/vis");
fs.mkdirSync(SHOTS, { recursive: true });
const IDS = ["journey", "money-flows", "go-live", "payment-methods", "stripe-steps", "email-timeline", "reply-to"];
const email = `e2e-vis-co-${Date.now().toString(36)}@${TEST_EMAIL_DOMAIN}`;

test("assistant visuals render", async () => {
  test.setTimeout(900_000);
  const s = await fbSignUp(email);
  const r = await fetch(`${API_URL}/api/register-role`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.idToken}` }, body: JSON.stringify({ role: "company", businessName: "Vis Test Co", providerName: "Vis Test Co", providerNameMode: "business" }) });
  if (!r.ok) throw new Error("register " + (await r.text()));
  const browser = await chromium.launch();
  for (const scheme of ["light", "dark"] as const) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
    const page = await ctx.newPage();
    page.setDefaultTimeout(60_000);
    await page.route("**/api/ai/chat", (route) => route.fulfill({ json: { reply: `Here is how it works.\n\n- Step one\n- Step two\n\n${IDS.map((i) => `[[visual:${i}]]`).join("\n")}\n[[visual:bogus]]` } }));
    let first = true;
    for (const [wname, width] of [["desktop", 1280], ["phone", 390]] as const) {
      await page.setViewportSize({ width, height: 900 });
      if (first) {
      await page.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(1500);
        await page.getByPlaceholder("you@example.com").fill(email);
        await page.locator('input[type="password"]').fill(TEST_PASSWORD);
        if ((await page.getByPlaceholder("you@example.com").inputValue()) === email) break;
      }
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
        first = false;
      }
      await page.goto(`${WEB_URL}/company/ai`, { waitUntil: "load", timeout: 120_000 });
      const box = page.locator("textarea");
      await box.waitFor({ timeout: 60_000 });
      await box.fill("show me");
      await box.press("Enter");
      await page.locator('[role="img"][aria-label^="Your journey"]').waitFor({ timeout: 30_000 });
      await page.waitForTimeout(800);
      expect(await page.getByText("[[visual").count()).toBe(0);
      expect(await page.getByText("bogus").count()).toBe(0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      console.log(scheme, wname, "horizontal overflow px:", overflow);
      expect(overflow).toBeLessThanOrEqual(0);
      await page.screenshot({ path: path.join(SHOTS, `full-${wname}-${scheme}.png`), fullPage: true });
      await page.addStyleTag({ content: "*{scroll-behavior:auto!important} nav,[class*='fixed']{display:none!important}" });
      const imgs = page.locator('[role="img"][aria-label]').filter({ hasNot: page.locator("svg[role=img]") });
      const n = await imgs.count();
      for (let i = 0; i < n; i++) {
        const el = imgs.nth(i);
        const label = (await el.getAttribute("aria-label")) ?? "";
        const idx = IDS.findIndex((_, j) => j === i);
        if (!label || idx < 0) continue;
        const bb = await el.boundingBox();
        console.log(IDS[idx], wname, scheme, "height", Math.round(bb?.height ?? 0));
        await el.screenshot({ path: path.join(SHOTS, `${IDS[idx]}-${wname}-${scheme}.png`) });
      }
    }
    await ctx.close();
  }
  await browser.close();
});
