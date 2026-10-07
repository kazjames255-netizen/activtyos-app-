// AJ UI check: Money in -> 'Awaiting payment' on an isolated stack (web :3027 / API :4027). Throwaway provider from aj-setup.mts.
// run (from the worktree root): node e2e/review/aj-ui.mjs
import { chromium } from "/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright/index.mjs";
import fs from "node:fs";
const D = process.cwd() + "/docs/home-visit-qa/AJ/";
const A = JSON.parse(fs.readFileSync(D + "accounts.json", "utf8"));
const WEB = "http://localhost:3027", API = "http://localhost:4027";
const FKEY = (fs.readFileSync(process.cwd() + "/.env.local", "utf8").match(/^NEXT_PUBLIC_FIREBASE_API_KEY=(.+)$/m) || [])[1];
const B1 = A.bookings.one.j.bookings[0].ref, B2 = A.bookings.two.j.bookings[0].ref;
const out = { B1, B2, steps: {} };

const fb = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FKEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: A.provider.email, password: A.password, returnSecureToken: true }) })).json();
const tok = fb.idToken;
const api = async (path, init) => { const r = await fetch(API + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` } }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, j }; };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 } });
const page = await ctx.newPage(); page.setDefaultTimeout(90000);
await page.goto(WEB + "/login", { waitUntil: "load", timeout: 120000 });
await page.locator('input[type="email"], #email, input[name="email"]').first().fill(A.provider.email);
await page.locator('input[type="password"]').first().fill(A.password);
await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
await page.waitForURL((u) => !/login/.test(u.pathname), { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(3000);
for (const t of ["Skip", "Not now", "Maybe later", "Got it", "Close", "Skip for now"]) { const x = page.getByRole("button", { name: t }).first(); if (await x.isVisible().catch(() => false)) await x.click().catch(() => {}); }
const base = page.url().match(/^(https?:\/\/[^/]+\/[a-z]+)\//)?.[1] ?? WEB + "/freelancer";
console.log("provider at", page.url(), "base", base);

async function open(name) {
  for (let i = 0; i < 2; i++) {
    await page.goto(`${base}/purchasing`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(3500);
    if (await page.getByText("Awaiting payment").first().isVisible().catch(() => false)) break;
  }
  await page.getByText("Awaiting payment").first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: D + name, fullPage: true });
}
const panel = async () => {
  const total = await page.locator('[data-testid="awaiting-total"]').first().innerText().catch(() => null);
  const card = page.locator('[data-testid="awaiting-total"]').first().locator("xpath=ancestor::*[contains(@class,'p-4')][1]");
  const text = (await card.innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 700);
  return { total, paidUp: await page.locator('[data-testid="awaiting-paid-up"]').count(), owedNoRequest: await page.locator('[data-testid="awaiting-owed-no-request"]').count(), otherOwed: await page.locator('[data-testid="awaiting-other-owed"]').count(), rows: await page.locator('[data-testid^="awaiting-row-"]').count(), text };
};
const heroText = async () => (await page.getByText("Awaiting payment").first().locator("xpath=ancestor::*[1]").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);

// 1) two unpaid confirmed card bookings, NO payment request out
out.steps.s1 = await api(`/api/bookings`).then((r) => (r.j || []).filter((x) => [B1, B2].includes(x.ref)).map((x) => ({ ref: x.ref, status: x.status, pay: x.pay, amount: x.amount, nudges: x.nudges })));
await open("01-no-request-out.png"); out.steps.p1 = await panel(); out.steps.hero1 = await heroText();

// 2) the provider chases B1 (the existing nudge endpoint, what the Chase button calls)
out.steps.nudge = (await api(`/api/bookings/${B1}/nudge`, { method: "POST", body: "{}" })).status;
await open("02-after-nudge-B1.png"); out.steps.p2 = await panel(); out.steps.hero2 = await heroText();

// 3) a formal customer invoice, sent and unpaid
const inv = await api("/api/invoices", { method: "POST", body: JSON.stringify({ customerName: "Acme Ltd", amount: 25, status: "sent", reference: "INV-AJ-1", description: "Hall hire" }) });
out.steps.invoice = inv.status; const invId = inv.j && inv.j.id;
await open("03-with-invoice.png"); out.steps.p3 = await panel(); out.steps.hero3 = await heroText();

// 4) click Chase in the UI on B1
const chaseBtn = page.locator(`[data-testid="awaiting-row-${B1}"]`).getByRole("button", { name: "Chase" });
out.steps.chaseVisible = await chaseBtn.count();
if (out.steps.chaseVisible) { await chaseBtn.first().click(); await page.waitForTimeout(3500); }
await page.getByText("Awaiting payment").first().scrollIntoViewIfNeeded().catch(() => {});
await page.screenshot({ path: D + "04-after-chase-click.png", fullPage: true });
out.steps.p4 = await panel(); out.steps.toast = await page.locator('[role="status"]').allInnerTexts().catch(() => []);

// 5) an invoice that is ALSO a booking (reference = the booking ref): appears once
const inv2 = await api("/api/invoices", { method: "POST", body: JSON.stringify({ customerName: "Familytwo QA", amount: 0.3, status: "sent", reference: B2, bookingRef: B2 }) });
out.steps.invoice2 = inv2.status;
await open("05-invoice-is-also-booking.png"); out.steps.p5 = await panel(); out.steps.hero5 = await heroText();

// 6) everything paid -> 'all paid up'
for (const r of [B1, B2]) out.steps["paid_" + r] = (await api(`/api/bookings/${r}/actions`, { method: "POST", body: JSON.stringify({ type: "paid" }) })).status;
for (const id of [invId, inv2.j && inv2.j.id].filter(Boolean)) await api(`/api/invoices/${id}`, { method: "PUT", body: JSON.stringify({ status: "paid" }) });
await open("06-all-paid-up.png"); out.steps.p6 = await panel(); out.steps.hero6 = await heroText();

fs.writeFileSync(D + "ui-results.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1).slice(0, 6000));
await b.close();
process.exit(0);
