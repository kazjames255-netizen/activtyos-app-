import { chromium } from "/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright/index.mjs";
import fs from "node:fs";
const D = process.cwd() + "/docs/home-visit-qa/AC1/";
const A = JSON.parse(fs.readFileSync(D + "accounts.json", "utf8"));
const WEB = "http://localhost:3019";
const out = {};
const b = await chromium.launch();
async function login(path, sel, email) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(60000);
  await page.goto(WEB + path, { waitUntil: "load", timeout: 120000 });
  await page.locator(sel.email).first().fill(email); await page.locator(sel.pw).first().fill(A.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await page.waitForURL((u) => !/login|\/parent$/.test(u.pathname), { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(3000);
  for (const t of ["Skip", "Not now", "Maybe later", "Got it", "Close", "Skip for now"]) { const x = page.getByRole("button", { name: t }).first(); if (await x.isVisible().catch(() => false)) await x.click().catch(() => {}); }
  return { ctx, page };
}
// ---- provider
const { ctx: pc, page: p } = await login("/login", { email: 'input[type="email"], #email, input[name="email"]', pw: 'input[type="password"]' }, A.provider.email);
console.log("provider at", p.url());
const base = p.url().match(/^(https?:\/\/[^/]+\/[a-z]+)\//)?.[1] ?? WEB + "/freelancer";
// kit (fresh tab: the dev server's hot-reload can leave an old runtime behind after other routes were compiled)
const k = p;
await k.goto(`${base}/kit`, { waitUntil: "load", timeout: 120000 }); console.log("kit url", k.url());
await k.waitForTimeout(4000);
await k.locator('input[type="date"]').first().waitFor({ timeout: 150000 }).catch(async () => { console.log("NO DATE INPUT, url", k.url()); await k.screenshot({ path: D + "dbg-kit.png" }); throw new Error("kit not rendered"); });
await k.locator('input[type="date"]').first().fill(A.day); await k.waitForTimeout(3500);
await k.screenshot({ path: D + "03-kit-day-before-ticks.png", fullPage: true });
const kitText = await k.locator("body").innerText();
out.kitText = kitText.slice(0, 900);
out.kitHasMoney = /£/.test(await k.locator("#kit-print").innerText());
const ticks = k.locator('[data-testid="kit-tick"]');
out.tickCount = await ticks.count();
if (out.tickCount) { await ticks.nth(0).check(); await k.waitForTimeout(1200); await ticks.nth(1).check(); await k.waitForTimeout(1500); }
await k.screenshot({ path: D + "04-kit-after-two-ticks.png", fullPage: true });
await k.reload({ waitUntil: "load" }); for (let i = 0; i < 3 && !(await k.locator('input[type="date"]').first().isVisible().catch(() => false)); i++) { await k.goto(`${base}/kit`, { waitUntil: "load", timeout: 120000 }); await k.waitForTimeout(8000); }
await k.locator('input[type="date"]').first().waitFor({ timeout: 90000 });
await k.locator('input[type="date"]').fill(A.day); await k.waitForTimeout(3500);
out.tickedAfterReload = await k.locator('[data-testid="kit-tick"]:checked').count();
await k.screenshot({ path: D + "05-kit-after-reload.png", fullPage: true });
out.progress = await k.locator('[data-testid="kit-progress"]').innerText().catch(() => null);
// print view
await k.emulateMedia({ media: "print" });
await k.screenshot({ path: D + "06-kit-print.png", fullPage: true });
await k.emulateMedia({ media: "screen" });
// a day with nothing
await k.locator('input[type="date"]').fill("2026-12-25"); await k.waitForTimeout(3000);
out.emptyDay = (await k.locator("body").innerText()).includes("Nothing to prepare");
await k.screenshot({ path: D + "07-kit-empty-day.png" });
for (let i = 0; i < 4; i++) { await p.goto(`${base}/bookings`, { waitUntil: "load", timeout: 120000 }); await p.waitForTimeout(7000); if (/HVQ-/.test(await p.locator("body").innerText())) break; }
await p.waitForFunction(() => /Ref |HVQ-/.test(document.body.innerText), null, { timeout: 120000 }).catch(() => {}); await p.waitForTimeout(3000);
await p.screenshot({ path: D + "01-provider-bookings-list.png", fullPage: false });
const listText = await p.locator("body").innerText();
out.listChip = (listText.match(/Extras: \d+/g) ?? []);
out.listKitLink = /Kit to prepare/.test(listText);
await p.goto(`${base}/bookings?ref=${A.bookings.one.j.bookings[0].ref}`, { waitUntil: "load", timeout: 120000 });
await p.waitForFunction(() => /Ref |HVQ-/.test(document.body.innerText), null, { timeout: 120000 }).catch(() => {}); await p.waitForTimeout(3000);
await p.screenshot({ path: D + "02-provider-booking-detail.png", fullPage: true });
const detailText = await p.locator("body").innerText();
out.detailBlock = /EXTRAS/i.test(detailText) && /sally james/.test(detailText);
await pc.close();
// ---- parent
const { ctx: qc, page: q } = await login("/parent", { email: "#parent-email", pw: "#parent-password" }, A.parents.one.email);
await q.goto(`${WEB}/custdash/bookings`, { waitUntil: "load", timeout: 120000 }); await q.waitForTimeout(6000);
await q.screenshot({ path: D + "08-parent-my-bookings.png", fullPage: true });
await q.getByRole("button", { name: "Details", exact: true }).first().click().catch(() => {}); await q.waitForTimeout(2500);
await q.screenshot({ path: D + "09-parent-booking-details.png", fullPage: true });
const pt = await q.locator("body").innerText();
out.parentSeesExtras = /EXTRAS/i.test(pt) && /Tshirty|T-shirt/i.test(pt);
const open = q.getByText(/Details|View|Open/i).first();
await q.locator('text=/Water bottle/i').first().waitFor({ timeout: 4000 }).catch(() => {});
out.parentText = pt.slice(0, 1200);
await qc.close();
fs.writeFileSync(D + "ui-results.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1).slice(0, 3000));
await b.close();
