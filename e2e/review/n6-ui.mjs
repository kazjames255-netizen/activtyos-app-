// N6 screenshots: (A) the Registers page asks a nameless freelancer once for a real name; (B) Setup > Tax-Free Childcare provider details (Missing, then
// Ready after saving) and the parent's checkout not offering Tax-Free Childcare until then. Reads docs/home-visit-qa/N6/accounts2.json (N6_STOP setup run).
import { chromium } from "/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright/index.mjs";
import fs from "node:fs";
const D = process.cwd() + "/docs/home-visit-qa/N6/";
const A = JSON.parse(fs.readFileSync(D + "accounts2.json", "utf8"));
const WEB = "http://localhost:3044";
const out = {};
const b = await chromium.launch();
async function login(email, vp = { width: 1280, height: 1000 }) {
  const ctx = await b.newContext({ viewport: vp });
  const page = await ctx.newPage(); page.setDefaultTimeout(90000);
  await page.goto(WEB + "/login", { waitUntil: "load", timeout: 120000 });
  await page.locator('input[type="email"], #email, input[name="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(A.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await page.waitForURL((u) => !/login/.test(u.pathname), { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(3000);
  for (const t of ["Skip", "Maybe later", "Got it", "Close", "Skip for now"]) { const x = page.getByRole("button", { name: t }).first(); if (await x.isVisible().catch(() => false)) await x.click().catch(() => {}); }
  return { ctx, page };
}
// ── provider: registers prompt ──
const { page: p } = await login(A.provider.email);
await p.goto(WEB + "/freelancer/registers", { waitUntil: "load", timeout: 120000 });
await p.getByTestId("owner-name-ask").waitFor({ timeout: 90000 }).catch(() => {});
await p.waitForTimeout(5000); // the lazy catalogue lands a moment after the page
out.promptShown = await p.getByTestId("owner-name-ask").isVisible().catch(() => false);
await p.screenshot({ path: D + "01-registers-name-prompt.png", fullPage: false });
// a placeholder is refused, a real name saves and the prompt goes
await p.getByPlaceholder(/first and last name/i).fill("support");
await p.getByRole("button", { name: /Save my name/i }).click();
out.refusedPlaceholder = await p.getByText(/real first and last name/i).isVisible().catch(() => false);
await p.getByPlaceholder(/first and last name/i).fill("Kaz Tester");
await p.getByRole("button", { name: /Save my name/i }).click();
await p.waitForTimeout(2500);
out.promptGone = !(await p.getByTestId("owner-name-ask").isVisible().catch(() => false));
await p.screenshot({ path: D + "02-registers-after-name.png", fullPage: false });
// ── provider: Setup > Childcare vouchers: the TFC card, Missing then Ready ──
await p.goto(WEB + "/freelancer/setup?tab=vouchers", { waitUntil: "load", timeout: 120000 });
await p.getByTestId("tfc-provider-details").waitFor({ timeout: 90000 }).catch(() => {});
await p.waitForTimeout(5000);
out.statusBefore = (await p.getByTestId("tfc-status").innerText().catch(() => "")).trim();
await p.getByTestId("tfc-provider-details").scrollIntoViewIfNeeded().catch(() => {});
await p.screenshot({ path: D + "03-setup-tfc-missing.png", fullPage: false });
// parent checkout BEFORE details: no Tax-Free Childcare option, with the polite note
const { page: q } = await login(A.parent.email);
const openCheckout = async (page, shot) => {
  await page.goto(WEB + `/book/${A.listing.id}?quick=1`, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(3000);
  for (const t of [/Day pass/, /Full day|9:00/]) { const x = page.getByRole("button", { name: t }).first(); if (await x.isVisible().catch(() => false)) await x.click().catch(() => {}); }
  const dayBtn = page.locator('[class*="aos-pb-day"], button:has-text("' + new Date().getDate() + '")').first();
  await dayBtn.click({ timeout: 20000 }).catch(() => {});
  for (let i = 0; i < 4; i++) { const n = page.getByRole("button", { name: /^Next|Continue|Go to/ }).first(); if (await n.isVisible().catch(() => false)) { await n.click().catch(() => {}); await page.waitForTimeout(1200); } }
  const sel = page.locator("select").filter({ hasText: /Card|Cash|Tax-Free/ }).first();
  await sel.waitFor({ timeout: 30000 }).catch(() => {});
  const opts = (await sel.locator("option").allInnerTexts().catch(() => [])).map((x) => x.trim());
  const note = await page.getByTestId("tfc-not-ready").isVisible().catch(() => false);
  await sel.scrollIntoViewIfNeeded().catch(() => {});
  await page.screenshot({ path: D + shot, fullPage: false });
  return { opts, note };
};
out.checkoutBefore = await openCheckout(q, "04-checkout-before-details.png");
// provider saves the details
await p.getByPlaceholder("e.g. EY123456").fill("EY 123456");
await p.getByPlaceholder("MK1 1AA").fill("mk45 4jz");
await p.waitForTimeout(1500);
await p.getByRole("button", { name: /Save details/i }).click();
await p.waitForTimeout(2500);
out.statusAfter = (await p.getByTestId("tfc-status").innerText().catch(() => "")).trim();
await p.screenshot({ path: D + "05-setup-tfc-ready.png", fullPage: false });
out.checkoutAfter = await openCheckout(q, "06-checkout-after-details.png");
fs.writeFileSync(D + "ui-results.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
await b.close();
