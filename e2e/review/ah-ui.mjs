// AH UI check on the isolated stack (web :3025 -> API :4025): provider bookings list/detail, confirm panels, Finance Debts "Refunds to send", parent view.
import { chromium } from "/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright/index.mjs";
import fs from "node:fs";
const D = process.cwd() + "/docs/home-visit-qa/AH/";
const A = JSON.parse(fs.readFileSync(process.cwd() + "/e2e/review/ah-accounts.json", "utf8"));
const WEB = "http://localhost:3025";
const out = {};
const b = await chromium.launch();
async function login(email) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(90000);
  await page.goto(WEB + "/login", { waitUntil: "load", timeout: 180000 });
  await page.locator('input[type="email"], #email, input[name="email"]').first().fill(email); await page.locator('input[type="password"]').first().fill(A.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await page.waitForURL((u) => !/login/.test(u.pathname), { timeout: 180000 }).catch(() => {});
  await page.waitForTimeout(3000);
  for (const t of ["Skip", "Not now", "Maybe later", "Got it", "Close", "Skip for now"]) { const x = page.getByRole("button", { name: t }).first(); if (await x.isVisible().catch(() => false)) await x.click().catch(() => {}); }
  return { ctx, page };
}
const { page: p } = await login(A.provider.email);
const base = p.url().match(/^(https?:\/\/[^/]+\/[a-z]+)\//)?.[1] ?? WEB + "/freelancer";
console.log("provider at", p.url(), "base", base);
const settle = async (url) => { for (let i = 0; i < 4; i++) { await p.goto(url, { waitUntil: "load", timeout: 180000 }); await p.waitForTimeout(5000); if (!(await p.getByText("ChunkLoadError").first().isVisible().catch(() => false))) return; } };
const open = async (ref) => settle(`${base}/bookings?ref=${ref}`);

// 1. awaiting-transfer booking: detail
await open(A.refs.refC);
out.detailText = (await p.locator("body").innerText()).slice(0, 1500);
await p.screenshot({ path: D + "01-detail-awaiting-top.png" });
out.chipDetail = await p.getByText("Refund recorded — awaiting your transfer").first().isVisible().catch(() => false);
out.sentBtn = await p.getByRole("button", { name: "I've sent the refund" }).first().isVisible().catch(() => false);
out.revealBtn = await p.getByRole("button", { name: /reveal/i }).first().isVisible().catch(() => false);
out.nothingToDoShown = await p.getByText(/nothing left to action|nothing to do/i).first().isVisible().catch(() => false);
await p.screenshot({ path: D + "02-detail-awaiting-full.png", fullPage: true });

// 2. list view row chip + button
await settle(`${base}/bookings`);
await p.screenshot({ path: D + "03-list-awaiting-row.png", fullPage: false });
out.listChip = (await p.getByText(/Refund recorded — awaiting your transfer/).count());

// 3. Finance > Debts > Refunds to send + Overview tile note
await settle(`${base}/finance`);
const finUrl = p.url();
out.finUrl = finUrl;
await p.waitForTimeout(5000);
let hasTab = await p.getByRole("button", { name: "Debts" }).first().isVisible().catch(() => false);
if (!hasTab) { for (const path of ["/finance", "/money", "/analytics"]) { await p.goto(`${base}${path}`, { waitUntil: "load", timeout: 120000 }).catch(() => {}); await p.waitForTimeout(4000); if (await p.getByRole("button", { name: "Debts" }).first().isVisible().catch(() => false)) { hasTab = true; out.finUrl = p.url(); break; } } }
await p.getByRole("button", { name: "Overview" }).first().click().catch(() => {}); await p.waitForTimeout(2500);
await p.screenshot({ path: D + "04-finance-overview.png" });
out.refundsTileNote = await p.getByText(/awaiting your transfer/).first().isVisible().catch(() => false);
if (hasTab) {
  await p.getByRole("button", { name: "Debts" }).first().click(); await p.waitForTimeout(3000);
  out.refundsToSendVisible = await p.locator('[data-ui="refunds-to-send"]').isVisible().catch(() => false);
  out.refundsToSendText = await p.locator('[data-ui="refunds-to-send"]').innerText().catch(() => null);
  await p.screenshot({ path: D + "05-finance-debts-refunds-to-send.png", fullPage: true });
}

// 4. approve flow on the PENDING one (refD): the confirm panel with two choices
await open(A.refs.refD);
await p.getByRole("button", { name: /reimbursed|accept bank|approve refund/i }).first().click().catch(() => {});
await p.waitForTimeout(1500);
out.approvePanel = await p.locator('[data-kind="refund-record"]').innerText().catch(() => null);
await p.screenshot({ path: D + "06-approve-confirm-panel.png" });

// 5. mark sent on refC from the detail
await open(A.refs.refC);
await p.getByRole("button", { name: "I've sent the refund" }).first().click().catch(() => {});
await p.waitForTimeout(1500);
out.sentPanel = await p.locator('[data-kind="refund-transfer-sent"]').innerText().catch(() => null);
await p.screenshot({ path: D + "07-sent-confirm-panel.png" });
await p.getByRole("button", { name: "Yes, I've sent it" }).first().click().catch(() => {});
await p.waitForTimeout(4000);
out.greenAfter = await p.locator('[data-ui="refund-sent"]').innerText().catch(() => null);
out.badgeAfter = await p.getByText(/Refunded on/).first().isVisible().catch(() => false);
await p.screenshot({ path: D + "08-detail-after-sent.png", fullPage: true });

// 6. parent view of the other recorded booking (refB was sent in one step; refA sent): use parent two for refC (now sent) and parent one for refA
const { page: q } = await login(A.parents.two.email);
await q.goto(WEB + "/custdash/bookings", { waitUntil: "load", timeout: 180000 }); await q.waitForTimeout(6000);
await q.screenshot({ path: D + "09-parent-bookings.png", fullPage: true });
out.parentText = (await q.locator("body").innerText()).match(/Refund[^\n]{0,120}/g)?.slice(0, 8) ?? null;
fs.writeFileSync(D + "ui-results.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2).slice(0, 3500));
await b.close();
