import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fbSignUp, apiPost, apiFetch, TEST_PASSWORD, TEST_EMAIL_DOMAIN } from "../helpers/accounts";
import { ROOT, WEB_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require("/Users/kazjames/Downloads/activtyos-app-/server/node_modules/firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(require("/Users/kazjames/Downloads/activtyos-app-/server/serviceAccountKey.json")) });

const OUT = path.join(ROOT, "e2e/review/shots/manualm");
const stamp = Date.now().toString(36);
const BIZ = "Riverside Activity Camps";
const pEmail = `e2e-mm-prov-${stamp}@${TEST_EMAIL_DOMAIN}`;
const parEmail = `e2e-mm-par-${stamp}@${TEST_EMAIL_DOMAIN}`;
const scrub = (person: string) => `(() => {
  const fix = (s) => s.replace(/\\b(ActivityOS|Activly)\\b/g, "Name TBC").replace(/E2e(?: [A-Za-z0-9]+){2,3}/g, ${JSON.stringify(person)}).replace(/[\\w.+-]+@activityos-test\\.com/g, ${JSON.stringify(person === "Sam Taylor" ? "sam@riverside-camps.co.uk" : "alex@example.com")});
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) { const v = n.nodeValue || ""; if (/Activ|E2e|activityos-test/.test(v)) n.nodeValue = fix(v); }
  document.querySelectorAll("input").forEach((i) => { if (/activityos-test/.test(i.value)) i.value = ${JSON.stringify(person === "Sam Taylor" ? "sam@riverside-camps.co.uk" : "alex@example.com")}; });
})()`;
const NOPORTAL = () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s)); };
async function shot(page: any, name: string, person: string, opts: { full?: boolean } = {}) {
  await page.waitForTimeout(1800);
  await page.evaluate(scrub(person)).catch(() => {});
  await page.waitForTimeout(300);
  const png = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: png, fullPage: !!opts.full });
  execFileSync("sips", ["--resampleWidth", "1200", "-s", "format", "jpeg", "-s", "formatOptions", "82", png, "--out", path.join(OUT, `${name}.jpg`)], { stdio: "pipe" });
  console.log("shot", name);
}
async function go(page: any, p: string, wait = 4500) { await page.goto(`${WEB_URL}${p}`, { waitUntil: "load", timeout: 120_000 }).catch(() => {}); await page.waitForTimeout(wait); }
async function login(page: any, email: string) {
  await go(page, "/login", 3000);
  await page.getByPlaceholder("you@example.com").fill(email); await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((u: URL) => !u.pathname.startsWith("/login"), { timeout: 90_000 }); await page.waitForTimeout(3500);
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

(async () => {
  if (!process.env.ONLY) fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  // ---- provider with bank details saved, one live listing
  const s = await fbSignUp(pEmail); const t = s.idToken;
  const r = await apiPost<{ tenantId: string }>("/api/register-role", t, { role: "freelancer", businessName: BIZ, providerName: BIZ, providerNameMode: "business" });
  await admin.firestore().collection("tenants").doc(r.tenantId).set({ subscription: { status: "trialing", plan: "freelancer", price: 29 } }, { merge: true });
  const lib = ((await apiFetch<any>("/api/library", t)) ?? {}) as any;
  const settings = { ...(lib.settings ?? {}), billing: { ...(lib.settings?.billing ?? {}), bankName: "Barclays", accountName: BIZ, sortCode: "20-00-00", accountNumber: "12345678", email: "hello@riverside-camps.co.uk" } };
  await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ venues: [{ id: "mm-v", name: "Northampton Sports Hall", address: "1 Test Way, Northampton", city: "Northampton", lat: 52.24, lng: -0.9, zoom: 16 }], settings }) });
  const period = await apiPost<{ id: string }>("/api/periods", t, { title: "Full day", start: "09:00", finish: "15:30" });
  const defs = [["5 days", 5, 90], ["3 days", 3, 54], ["1 day", 1, 20]] as const;
  const ids: string[] = []; for (const [name, days] of defs) ids.push((await apiPost<{ id: string }>("/api/passes", t, { name, days })).id);
  const passFlat: Record<string, number> = {}; const periodPrice: Record<string, number> = {}; defs.forEach(([, , price], i) => { passFlat[ids[i]] = price; periodPrice[`${ids[i]}_${period.id}`] = price; });
  const bundle = await apiPost<{ id: string }>("/api/block-bundles", t, { name: "Half term block", periodIds: [period.id], passIds: ids, priced: true, masterPrice: 90, calcOn: false, passFlat, periodPrice });
  const today = new Date(); const nextMonday = addDays(today, (8 - today.getDay()) % 7 || 7);
  const listing = await apiPost<{ id: string }>("/api/listings", t, { title: "Half term multi-activity camp", venueId: "mm-v", runFrom: ymd(nextMonday), runTo: ymd(addDays(nextMonday, 20)), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "10", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "11", blockId: bundle.id, passes: defs.map(([name, days, price]) => ({ name, price, days })), bookingType: "auto", status: "live", visibility: "public" });
  await apiFetch(`/api/block-bundles/${bundle.id}/listings`, t, { method: "PUT", body: JSON.stringify({ listingIds: [listing.id] }) });
  console.log("provider ready", r.tenantId, listing.id);

  const b = await chromium.launch();
  // ---- (1) cancellation welcome as the provider
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await ctx.addInitScript(NOPORTAL);
    const page = await ctx.newPage(); await login(page, pEmail);
    await go(page, "/freelancer/setup?tab=cancel&welcome=1");
    await shot(page, "cancel-welcome", "Sam Taylor");
    await page.getByRole("button", { name: /Change it now/ }).click(); await page.waitForTimeout(1500);
    await shot(page, "cancel-editor", "Sam Taylor");
    // second visit: keep and move on
    await go(page, "/freelancer");
    const before = await page.locator('[data-testid="first-run-step-cancel"]').getAttribute("data-done").catch(() => "n/a");
    await go(page, "/freelancer/setup?tab=cancel&welcome=1");
    await page.getByRole("button", { name: /Keep this and move on/ }).click(); await page.waitForTimeout(3500);
    const url = page.url();
    await go(page, "/freelancer");
    const after = await page.locator('[data-testid="first-run-step-cancel"]').getAttribute("data-done").catch(() => "n/a");
    console.log("KEEP RESULT", JSON.stringify({ before, afterUrl: url.replace(WEB_URL, ""), after }));
    await ctx.close();
  }
  if (process.env.ONLY === "cancel") { await b.close(); process.exit(0); }
  // ---- (2) a parent books by bank transfer
  const ps = await fbSignUp(parEmail); const pt = ps.idToken;
  await apiPost("/api/register-role", pt, { role: "parent", postcode: "NN5 7EA" });
  await apiPost("/api/me/welcome", pt, {}).catch(() => {});
  await apiPost("/api/my/children", pt, { name: "Jamie Morgan", dob: "2017-03-04" });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await ctx.addInitScript(NOPORTAL);
  const p = await ctx.newPage(); await login(p, parEmail);
  await go(p, `/book/${listing.id}`);
  const mon = new RegExp("^Mon\\s*" + nextMonday.getDate() + "$", "i");
  await p.getByText(/Tap a week/).first().waitFor({ timeout: 45_000 });
  await p.getByRole("button", { name: mon }).first().click();
  await p.getByRole("button", { name: /ADD 5 DAYS TO BASKET/i }).click();
  await p.getByRole("button", { name: /NEXT — ADD CHILDREN/i }).click();
  await p.getByRole("button", { name: /Jamie Morgan/ }).first().click();
  await p.getByRole("button", { name: "Next", exact: true }).click();
  await p.getByPlaceholder("e.g. 07700 900123").waitFor({ timeout: 45_000 });
  await p.getByPlaceholder("e.g. 07700 900123").fill("07700900123");
  await p.getByText(/How you.ll pay/i).first().scrollIntoViewIfNeeded(); await p.evaluate(() => { const el = [...document.querySelectorAll("*")].find((e) => /^How you.ll pay$/i.test((e.textContent || "").trim()) && e.children.length === 0); if (el) window.scrollTo(0, (el as HTMLElement).getBoundingClientRect().top + window.scrollY - 330); });
  await shot(p, "bank-1-method-choice", "Alex Morgan");
  const bodyBefore = await p.locator("body").innerText(); console.log("CHECKOUT CHOICE SHOWS BANK NUMBERS", /20-00-00/.test(bodyBefore), /12345678/.test(bodyBefore));
  await p.locator("button:visible").filter({ hasText: /Confirm booking/i }).last().click();
  await p.waitForTimeout(6000);
  await p.evaluate(() => window.scrollTo(0, 0));
  await shot(p, "bank-2-confirmation", "Alex Morgan");
  // (c) My bookings
  await go(p, "/custdash/bookings");
  const card = p.locator('[data-ui="card"]').filter({ hasText: "Half term" }).first();
  await card.click().catch(() => {}); await p.waitForTimeout(2000);
  await shot(p, "bank-3-my-bookings", "Alex Morgan");
  const body = await p.locator("body").innerText();
  console.log("MYBOOKINGS HAS BANK", /20-00-00/.test(body), /12345678/.test(body));
  // (e) pay link page: look up the booking ref, mint the token, open the public page signed out
  const mine = await apiFetch<any[]>("/api/my/bookings", pt);
  const bk = mine.find((x) => /Half term/.test(x.listing ?? x.title ?? "")) ?? mine[0];
  console.log("booking", bk?.ref, bk?.amount);
  const tokOut = execFileSync("node_modules/.bin/tsx", ["../e2e/helpers/payTokenFor.ts", r.tenantId, bk.ref], { cwd: path.join(ROOT, "server"), encoding: "utf8" });
  const token = /@@TOKEN@@(.+?)@@END@@/.exec(tokOut)?.[1];
  const anon = await b.newContext({ viewport: { width: 1440, height: 900 } }); await anon.addInitScript(NOPORTAL);
  const ap = await anon.newPage(); await go(ap, `/pay/b/${token}`, 5000);
  const abody = await ap.locator("body").innerText();
  console.log("PAYLINK HAS BANK NUMBERS", /20-00-00/.test(abody), /12345678/.test(abody), "ref shown", abody.includes(bk.ref));
  await shot(ap, "bank-5-pay-link", "Alex Morgan");
  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({ tenantId: r.tenantId, ref: bk.ref, amount: bk.amount, provider: pEmail, parent: parEmail, listing: listing.id }));
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
