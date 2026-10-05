import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test, chromium, webkit, devices, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { API_URL, ROOT, WEB_URL } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, fbSignIn, fbSignUp } from "./helpers/accounts";

// Brand-new franchise operator journey (head office invites -> franchisee onboards -> first listing -> parent books -> royalty).
// Run in stages:  npx playwright test -c e2e/zz-journey-franchise.config.ts -g "<stage>"
// State persists in e2e/review/shots/journey-franchise/state.json so stages can be re-run.
test.describe.configure({ mode: "serial" });
const SHOTS = path.join(ROOT, "e2e/review/shots/journey-franchise");
const STATE = path.join(SHOTS, "state.json");
fs.mkdirSync(SHOTS, { recursive: true });
const st: any = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : { stamp: Date.now().toString(36), A: {}, log: [] };
const save = () => fs.writeFileSync(STATE, JSON.stringify(st, null, 2));
save();
const stamp: string = st.stamp;
const email = (n: string) => `e2e-jf-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`;

async function call(tok: string | null, method: string, url: string, body?: unknown): Promise<{ status: number; json: any }> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${API_URL}${url}`, { method, headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      let json: any = null; try { json = await res.json(); } catch { /* empty */ }
      return { status: res.status, json };
    } catch (e) { if (attempt >= 20) throw e; await new Promise((r) => setTimeout(r, 3000)); }
  }
}
const tokOf = async (k: string) => (await fbSignIn(st.A[k].email)).idToken;
const api = async (k: string, method: string, url: string, body?: unknown) => call(await tokOf(k), method, url, body);
const ok = async (k: string, method: string, url: string, body?: unknown) => { const r = await api(k, method, url, body); if (r.status >= 300) throw new Error(`${method} ${url} -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`); return r.json; };
const unwall = (...ids: string[]) => execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", ...ids], { stdio: "pipe" });

let step = 0;
const nextNo = () => String(++step).padStart(2, "0");
/** Record a journey step (time + clicks are supplied by the caller) */
function note(row: { step: string; screen: string; secs?: number; clicks?: number; verdict: string; detail?: string; shot?: string }) {
  st.log = st.log.filter((r: any) => r.step !== row.step); st.log.push(row); save(); console.log("STEP", JSON.stringify(row));
}
let browser: Browser | null = null, wk: Browser | null = null;
async function ctx(kind: "desktop" | "phone", storage?: string): Promise<BrowserContext> {
  if (kind === "phone") {
    wk ??= await webkit.launch();
    return wk.newContext({ ...devices["iPhone 13"], storageState: storage && fs.existsSync(storage) ? storage : undefined });
  }
  browser ??= await chromium.launch();
  return browser.newContext({ viewport: { width: 1280, height: 1500 }, storageState: storage && fs.existsSync(storage) ? storage : undefined });
}
const storageFor = (k: string, kind: string) => path.join(SHOTS, `auth-${k}-${kind}.json`);
async function settle(page: Page, ms = 2500) { await page.waitForLoadState("load").catch(() => {}); await page.waitForTimeout(ms); }
async function shot(page: Page, name: string, full = true) {
  const n = nextNo(); const f = path.join(SHOTS, `${n}-${name}.png`);
  await page.screenshot({ path: f, fullPage: full }).catch(async () => { await page.screenshot({ path: f }); });
  return path.relative(ROOT, f);
}
async function login(page: Page, mail: string, home: RegExp | string) {
  await page.goto(`${WEB_URL}/login`, { waitUntil: "load", timeout: 120_000 }); await page.waitForTimeout(5000);
  await page.getByPlaceholder("you@example.com").fill(mail);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(home, { timeout: 120_000 });
}
async function loggedIn(key: string, kind: "desktop" | "phone", mail: string, home: RegExp | string) {
  const f = storageFor(key, kind);
  const c = await ctx(kind, f); const p = await c.newPage();
  await p.goto(`${WEB_URL}/${typeof home === "string" ? home.replace(/^\//, "") : ""}`, { waitUntil: "load", timeout: 120_000 }).catch(() => {});
  await p.waitForTimeout(3000);
  if (/\/login|\/signup/.test(p.url()) || !fs.existsSync(f)) { await login(p, mail, home); await p.waitForTimeout(3000); await c.storageState({ path: f }); }
  return { c, p };
}


test("S1 setup head office", async () => {
  test.setTimeout(600_000);
  if (!st.A.ho) {
    const mail = email("ho");
    const s = await fbSignUp(mail);
    const r = await call(s.idToken, "POST", "/api/register-role", { role: "company", businessName: `Brightstar Camps ${stamp}`, providerName: `Brightstar Camps ${stamp}`, providerNameMode: "business" });
    if (r.status >= 300) throw new Error(JSON.stringify(r.json));
    st.A.ho = { email: mail, uid: s.uid, tenantId: r.json.tenantId }; save();
    unwall(r.json.tenantId);
  }
});


test("S2 head office invites a franchisee", async () => {
  test.setTimeout(600_000);
  const t0 = Date.now();
  const c = await ctx("desktop"); const p = await c.newPage();
  await login(p, st.A.ho.email, /\/company\//); await settle(p, 4000);
  note({ step: "HO-1 sign in", screen: "/company/bookings (landing)", secs: Math.round((Date.now() - t0) / 1000), clicks: 3, verdict: "lands on Bookings, empty", shot: await shot(p, "ho-landing-after-signin") });
  // open sidebar FRANCHISES group
  const grp = p.getByText(/^Franchises$/i).first();
  await grp.click().catch(() => {}); await p.waitForTimeout(800);
  await shot(p, "ho-sidebar-franchises-group", false);
  await p.getByText("Invite franchises", { exact: true }).first().click(); await settle(p, 2500);
  note({ step: "HO-2 invite page", screen: "Franchises > Invite franchises", clicks: 2, verdict: "ok", shot: await shot(p, "ho-invite-franchises-empty") });
  const inputs = p.locator("input");
  await p.getByPlaceholder(/APF Activity Camps/).fill(`Sunny Days Northampton ${stamp}`);
  await p.getByPlaceholder(/Manchester/).fill("Northampton");
  await p.getByPlaceholder("them@email.com").fill(email("fr"));
  await shot(p, "ho-invite-form-filled", false);
  await p.getByRole("button", { name: "Create invite" }).click(); await p.waitForTimeout(3000);
  note({ step: "HO-3 create invite", screen: "Invite form submit", clicks: 4, verdict: "see findings", shot: await shot(p, "ho-invite-created") });
  const list = await ok("ho", "GET", "/api/invites");
  const inv = list.find((i: any) => i.sentTo === email("fr"));
  st.invite = inv; save();
  await c.close();
});

test("S3 franchisee opens the invite link and signs up", async () => {
  test.setTimeout(600_000);
  const link = `${WEB_URL}/signup?invite=${st.invite.token}`;
  // phone look first (webkit iPhone 13)
  const pc = await ctx("phone"); const pp = await pc.newPage();
  await pp.goto(link, { waitUntil: "load", timeout: 120_000 }); await settle(pp, 5000);
  note({ step: "FR-1p invite link on phone", screen: "/signup?invite=", clicks: 1, verdict: "see findings", shot: await shot(pp, "fr-invite-link-phone") });
  await pc.close();
  // desktop
  const t0 = Date.now();
  const c = await ctx("desktop"); const p = await c.newPage();
  await p.goto(link, { waitUntil: "load", timeout: 120_000 }); await settle(p, 5000);
  note({ step: "FR-1 invite link, signed out", screen: "/signup?invite=", clicks: 1, verdict: "see findings", shot: await shot(p, "fr-invite-link-desktop") });
  await p.getByLabel(/your name/i).fill("Dana Franchisee");
  await p.locator("#iv-email").fill(email("fr"));
  await p.locator("#iv-pw").fill(TEST_PASSWORD);
  await shot(p, "fr-invite-form-filled", false);
  await p.locator('form button[type="submit"]').click();
  await p.waitForURL(/\/franchise\//, { timeout: 120_000 }); await settle(p, 5000);
  note({ step: "FR-2 account created -> landing", screen: p.url().replace(WEB_URL, ""), secs: Math.round((Date.now() - t0) / 1000), clicks: 2, verdict: "see findings", shot: await shot(p, "fr-first-landing") });
  st.A.fr = { email: email("fr") }; save();
  await c.close();
});

const TXT = path.join(SHOTS, "texts");
fs.mkdirSync(TXT, { recursive: true });
async function visit(p: Page, urlPath: string, name: string, row?: { step: string; screen: string; clicks: number; verdict: string }, wait = 5000) {
  const t0 = Date.now();
  await p.goto(`${WEB_URL}${urlPath}`, { waitUntil: "load", timeout: 120_000 }).catch(() => {});
  await p.waitForTimeout(wait);
  const secs = Math.round((Date.now() - t0) / 1000);
  const txt = (await p.locator("body").innerText().catch(() => "")).replace(/\n{2,}/g, "\n");
  fs.writeFileSync(path.join(TXT, `${name}.txt`), `URL ${p.url()}\n${txt}`);
  const f = await shot(p, name);
  if (row) note({ ...row, secs, shot: f });
  return txt;
}
test("S4 franchisee tour (desktop + phone)", async () => {
  test.setTimeout(1_200_000);
  const c = await ctx("desktop"); const p = await c.newPage();
  await login(p, st.A.fr.email, /\/franchise\//); await settle(p, 3000);
  const pages: [string, string, string][] = [
    ["/franchise/dash", "fr-dashboard", "Dashboard"], ["/franchise/setup", "fr-setup", "Setup & features"], ["/franchise/account", "fr-onboarding-info", "Onboarding info"],
    ["/franchise/subscription", "fr-subscription", "Subscription"], ["/franchise/getpaid", "fr-getpaid", "Get paid"], ["/franchise/royalties", "fr-royalties", "Royalties"],
    ["/franchise/milestones", "fr-milestones", "Milestones"], ["/franchise/listings", "fr-listings-empty", "Blocks & listings"],
  ];
  for (const [u, n, label] of pages) await visit(p, u, n, { step: `FR-3 ${label}`, screen: u, clicks: 2, verdict: "see findings" });
  for (const tab of ["billing", "policies", "questions", "features", "branding", "profile", "business"]) await visit(p, `/franchise/setup?tab=${tab}`, `fr-setup-tab-${tab}`);
  await c.close();
  const pc = await ctx("phone"); const pp = await pc.newPage();
  await login(pp, st.A.fr.email, /\/franchise\//); await settle(pp, 3000);
  await shot(pp, "fr-phone-landing", false);
  for (const [u, n] of [["/franchise/dash", "fr-phone-dashboard"], ["/franchise/setup", "fr-phone-setup"], ["/franchise/getpaid", "fr-phone-getpaid"], ["/franchise/royalties", "fr-phone-royalties"]]) await visit(pp, u, n);
  await pc.close();
});

test("S5 franchisee setup tabs", async () => {
  test.setTimeout(900_000);
  const c = await ctx("desktop"); const p = await c.newPage();
  await login(p, st.A.fr.email, /\/franchise\//); await settle(p, 3000);
  await p.goto(`${WEB_URL}/franchise/setup`, { waitUntil: "load" }); await p.waitForTimeout(5000);
  for (const [tab, name] of [["Company setup", "company"], ["Branding", "branding"], ["Child questions", "child-questions"], ["Cancellations & refunds", "cancellations"], ["Payments", "payments"], ["Safeguarding", "safeguarding"], ["Marketplace", "marketplace"], ["New listing defaults", "listing-defaults"]] as const) {
    await p.getByRole("button", { name: tab, exact: true }).click(); await p.waitForTimeout(2500);
    const txt = (await p.locator("body").innerText()).replace(/\n{2,}/g, "\n");
    fs.writeFileSync(path.join(TXT, `fr-setup-${name}.txt`), txt);
    note({ step: `FR-4 Setup > ${tab}`, screen: "/franchise/setup", clicks: 1, secs: 3, verdict: "see findings", shot: await shot(p, `fr-setup-${name}`) });
  }
  await c.close();
});

test("S6a franchisee: venue + blocks", async () => {
  test.setTimeout(900_000);
  const c = await ctx("desktop"); const p = await c.newPage();
  await login(p, st.A.fr.email, /\/franchise\//); await settle(p, 3000);
  await visit(p, "/franchise/listings", "fr-listings-locations", { step: "FR-5 Listings (empty) click Locations", screen: "/franchise/listings", clicks: 2, verdict: "see findings" });
  await p.getByRole("button", { name: /^Locations/ }).first().click().catch(() => {}); await p.waitForTimeout(2000);
  fs.writeFileSync(path.join(TXT, "fr-locations.txt"), await p.locator("body").innerText());
  await shot(p, "fr-locations-tab");
  await visit(p, "/franchise/blocks", "fr-blocks-empty", { step: "FR-6 Blocks board (empty)", screen: "/franchise/blocks", clicks: 3, verdict: "see findings" });
  await c.close();
});

test("S6b add location", async () => {
  test.setTimeout(900_000);
  const c = await ctx("desktop"); const p = await c.newPage();
  await login(p, st.A.fr.email, /\/franchise\//); await settle(p, 3000);
  await p.goto(`${WEB_URL}/franchise/listings`, { waitUntil: "load" }); await p.waitForTimeout(4000);
  await p.getByRole("button", { name: /^Locations/ }).first().click().catch(() => {}); await p.waitForTimeout(1500);
  await p.getByRole("button", { name: /Add location/ }).click(); await p.waitForTimeout(2000);
  fs.writeFileSync(path.join(TXT, "fr-add-location.txt"), await p.locator("body").innerText());
  const inputs = await p.locator("input:visible, textarea:visible, select:visible").evaluateAll((els) => els.map((e: any) => `${e.tagName} ph="${e.placeholder || ""}" name="${e.name || ""}" aria="${e.getAttribute("aria-label") || ""}"`));
  fs.writeFileSync(path.join(TXT, "fr-add-location-inputs.txt"), inputs.join("\n"));
  await shot(p, "fr-add-location-form");
  await c.close();
});

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
test("S7 franchisee builds first listing through the UI", async () => {
  test.setTimeout(1_200_000);
  const T0 = Date.now();
  const title = `Sunny Days Holiday Camp ${stamp}`; st.listingTitle = title; save();
  const c = await ctx("desktop"); const p = await c.newPage();
  await login(p, st.A.fr.email, /\/franchise\//); await settle(p, 3000);
  // 1 location
  await p.goto(`${WEB_URL}/franchise/listings`, { waitUntil: "load" }); await p.waitForTimeout(4000);
  await p.getByRole("button", { name: /^Locations/ }).first().click().catch(() => {}); await p.waitForTimeout(1500);
  await p.getByRole("button", { name: /Add location/ }).click();
  await p.getByPlaceholder("e.g. Riverside Sports Hall").fill("Abington Community Hall");
  await p.getByPlaceholder("Street, town, postcode").fill("1 Abington St, Northampton, NN1 2AB");
  await p.getByRole("button", { name: "Add", exact: true }).click(); await p.waitForTimeout(3000);
  note({ step: "FR-7 add a location", screen: "Listings > Locations", clicks: 4, verdict: "see findings", shot: await shot(p, "fr-location-added") });
  // 2 blocks
  await p.goto(`${WEB_URL}/franchise/blocks`, { waitUntil: "load" }); await p.waitForTimeout(4000);
  await p.getByRole("button", { name: "+ Add a period" }).click();
  await shot(p, "fr-blocks-add-period-form", false);
  await p.getByPlaceholder("Period title").fill("Full day");
  await p.getByRole("button", { name: "Add period", exact: true }).click(); await p.waitForTimeout(1500);
  await p.getByRole("button", { name: "+ Add a pass" }).click();
  await p.getByPlaceholder("Pass name (e.g. 5-day week pass)").fill("Day pass");
  await p.getByRole("button", { name: "Add pass", exact: true }).click(); await p.waitForTimeout(1500);
  const add = p.getByRole("button", { name: "+ Add to block" }); const n = await add.count();
  for (let i = 0; i < n; i++) await add.first().click();
  await p.getByPlaceholder("e.g. Summer Multi Activity Camp — Loughton").fill("Summer Camp Day Pass");
  await shot(p, "fr-blocks-before-library");
  await p.getByRole("button", { name: /Move to Block Library/ }).click(); await p.waitForTimeout(2500);
  note({ step: "FR-8 build block (period+pass+block)", screen: "/franchise/blocks", clicks: 11, verdict: "jargon heavy: period/pass/block/Block Library", shot: await shot(p, "fr-blocks-library") });
  fs.writeFileSync(path.join(TXT, "fr-blocks-library.txt"), await p.locator("body").innerText());
  // price the block: look for the pricing UI
  const priceInputs = await p.locator("input:visible").evaluateAll((els) => els.map((e: any) => `${e.type} ph="${e.placeholder}" val="${e.value}"`));
  fs.writeFileSync(path.join(TXT, "fr-blocks-inputs.txt"), priceInputs.join("\n"));
  await c.close();
});

test("S8 set prices", async () => {
  test.setTimeout(900_000);
  const c = await ctx("desktop"); const p = await c.newPage();
  await login(p, st.A.fr.email, /\/franchise\//); await settle(p, 3000);
  await p.goto(`${WEB_URL}/franchise/blocks`, { waitUntil: "load" }); await p.waitForTimeout(5000);
  await p.getByRole("button", { name: /Set prices/ }).first().click(); await p.waitForTimeout(2500);
  note({ step: "FR-9 Set prices (block)", screen: "/franchise/blocks", clicks: 1, verdict: "see findings", shot: await shot(p, "fr-set-prices") });
  await p.getByText("£0.00", { exact: true }).first().click().catch(() => {}); await p.waitForTimeout(1500);
  await shot(p, "fr-set-prices-expanded");
  const inputs = await p.locator("input:visible").evaluateAll((els) => els.map((e: any) => `${e.type} ph="${e.placeholder || ""}" val="${e.value || ""}" aria="${e.getAttribute("aria-label") || ""}"`));
  fs.writeFileSync(path.join(TXT, "fr-price-inputs.txt"), inputs.join("\n"));
  await c.close();
});

test("S9 price + wizard + publish", async () => {
  test.setTimeout(1_200_000);
  const T0 = Date.now();
  const c = await ctx("desktop"); const p = await c.newPage();
  await login(p, st.A.fr.email, /\/franchise\//); await settle(p, 3000);
  await p.goto(`${WEB_URL}/franchise/blocks`, { waitUntil: "load" }); await p.waitForTimeout(5000);
  await p.getByRole("button", { name: /Set prices/ }).first().click(); await p.waitForTimeout(1500);
  await p.getByText("£0.00", { exact: true }).first().click(); await p.waitForTimeout(800);
  await p.locator('input[type="number"]').first().fill("25");
  await p.getByRole("button", { name: "Save pricing" }).click(); await p.waitForTimeout(2500);
  note({ step: "FR-9 price the block £25", screen: "/franchise/blocks", clicks: 4, verdict: "ok but buried", shot: await shot(p, "fr-block-priced") });
  await p.goto(`${WEB_URL}/franchise/listings`, { waitUntil: "load" }); await p.waitForTimeout(4000);
  await p.getByRole("button", { name: /New listing/ }).click(); await p.waitForTimeout(2500);
  note({ step: "FR-10 wizard opens", screen: "listing wizard", clicks: 1, verdict: "see findings", shot: await shot(p, "fr-wizard-step1") });
  const titles = await p.locator("[title]").evaluateAll((els) => els.map((e: any) => e.getAttribute("title")).filter((t: string) => /^\d+\. /.test(t)));
  fs.writeFileSync(path.join(TXT, "fr-wizard-steps.txt"), titles.join("\n"));
  fs.writeFileSync(path.join(TXT, "fr-wizard-1.txt"), await p.locator("body").innerText());
  await p.getByPlaceholder("e.g. Summer Multi-Activity Camp").fill(st.listingTitle);
  let k = 2;
  for (const t of titles.slice(1)) {
    const label = t.replace(/^\d+\. /, "");
    await p.getByTitle(t, { exact: true }).click().catch(() => {}); await p.waitForTimeout(1200);
    if (/Details$/.test(t)) await p.locator("select").filter({ hasText: "Select a venue" }).first().selectOption({ index: 1 }).catch(() => {});
    if (/When it runs$/.test(t)) {
      const from = new Date(); from.setDate(from.getDate() + (((8 - from.getDay()) % 7) || 7)); const to = new Date(from); to.setDate(to.getDate() + 11);
      await p.getByLabel("Runs from").fill(isoD(from)).catch(() => {}); await p.getByLabel("Runs to").fill(isoD(to)).catch(() => {});
    }
    if (/Tickets & pricing$/.test(t)) await p.getByRole("button", { name: "Summer Camp Day Pass" }).first().click().catch(() => {});
    await p.waitForTimeout(800);
    fs.writeFileSync(path.join(TXT, `fr-wizard-${k}.txt`), await p.locator("body").innerText());
    await shot(p, `fr-wizard-${String(k).padStart(2, "0")}-${label.toLowerCase().replace(/\W+/g, "-")}`); k++;
  }
  const pub = p.getByRole("button", { name: /^Publish/ }).first();
  fs.writeFileSync(path.join(TXT, "fr-wizard-publish-label.txt"), await pub.innerText().catch(() => "?"));
  await pub.click().catch(() => {}); await p.waitForTimeout(4000);
  note({ step: "FR-11 publish", screen: "wizard -> list", secs: Math.round((Date.now() - T0) / 1000), clicks: 25, verdict: "see findings", shot: await shot(p, "fr-after-publish") });
  fs.writeFileSync(path.join(TXT, "fr-after-publish.txt"), await p.locator("body").innerText());
  await c.close();
});

test("PROBE api", async () => {
  test.skip(!process.env.JF_URL, "set JF_URL");
  const r = await api(process.env.JF_KEY || "fr", process.env.JF_METHOD || "GET", process.env.JF_URL!, process.env.JF_BODY ? JSON.parse(process.env.JF_BODY) : undefined);
  fs.writeFileSync(path.join(TXT, "probe.json"), JSON.stringify(r, null, 1));
});

test("S9b bundle vanish repro", async () => {
  test.setTimeout(600_000);
  const c = await ctx("desktop"); const p = await c.newPage();
  await login(p, st.A.fr.email, /\/franchise\//); await settle(p, 3000);
  const count = async (tag: string) => { const r = await api("fr", "GET", "/api/block-bundles"); console.log("BUNDLES", tag, JSON.stringify((r.json ?? []).map((b: any) => ({ id: b.id, name: b.name, priced: b.priced, passFlat: b.passFlat, masterPrice: b.masterPrice })))); };
  await count("start");
  await p.goto(`${WEB_URL}/franchise/blocks`, { waitUntil: "load" }); await p.waitForTimeout(5000);
  const add = p.getByRole("button", { name: "+ Add to block" }); const n = await add.count();
  for (let i = 0; i < n; i++) await add.first().click();
  await p.getByPlaceholder("e.g. Summer Multi Activity Camp — Loughton").fill("Summer Camp Day Pass");
  await p.getByRole("button", { name: /Move to Block Library/ }).click(); await p.waitForTimeout(3000);
  await count("after create");
  await p.getByRole("button", { name: /Set prices/ }).first().click(); await p.waitForTimeout(1500);
  await p.getByText("£0.00", { exact: true }).first().click(); await p.waitForTimeout(800);
  await p.locator('input[type="number"]').first().fill("25"); await p.waitForTimeout(500);
  await shot(p, "fr-price-typed");
  await p.getByRole("button", { name: "Save pricing" }).click(); await p.waitForTimeout(3000);
  await count("after save pricing");
  fs.writeFileSync(path.join(TXT, "fr-after-save-pricing.txt"), await p.locator("body").innerText());
  note({ step: "FR-9b save pricing", screen: "/franchise/blocks", clicks: 4, verdict: "see findings", shot: await shot(p, "fr-after-save-pricing") });
  await c.close();
});

test("S10 wizard with a block", async () => {
  test.setTimeout(1_200_000);
  const T0 = Date.now();
  const c = await ctx("desktop"); const p = await c.newPage();
  await login(p, st.A.fr.email, /\/franchise\//); await settle(p, 3000);
  await p.goto(`${WEB_URL}/franchise/listings`, { waitUntil: "load" }); await p.waitForTimeout(4000);
  await p.getByRole("button", { name: /New listing/ }).click(); await p.waitForTimeout(2500);
  await p.getByPlaceholder("e.g. Summer Multi-Activity Camp").fill(st.listingTitle);
  await p.getByTitle("2. Details", { exact: true }).click(); await p.waitForTimeout(800);
  await p.locator("select").filter({ hasText: "Select a venue" }).first().selectOption({ index: 1 }).catch(() => {});
  await p.getByTitle("7. When it runs", { exact: true }).click(); await p.waitForTimeout(800);
  const from = new Date(); from.setDate(from.getDate() + (((8 - from.getDay()) % 7) || 7)); const to = new Date(from); to.setDate(to.getDate() + 11);
  await p.getByLabel("Runs from").fill(isoD(from)); await p.getByLabel("Runs to").fill(isoD(to));
  st.runFrom = isoD(from); save();
  await p.getByTitle("8. Tickets & pricing", { exact: true }).click(); await p.waitForTimeout(2000);
  note({ step: "FR-11 wizard step 8 with a block", screen: "wizard", clicks: 12, verdict: "see findings", shot: await shot(p, "fr-wizard-tickets-with-block") });
  const btns = await p.locator("button:visible").evaluateAll((els) => els.map((e: any) => (e.innerText || "").replace(/\s+/g, " ").slice(0, 80)));
  fs.writeFileSync(path.join(TXT, "fr-wizard-s8-buttons.txt"), btns.join("\n"));
  const ub = p.getByRole("button", { name: "Use this block" }).first(); console.log("UB count", await ub.count(), "box", JSON.stringify(await ub.boundingBox()));
  await ub.click(); await p.waitForTimeout(2500);
  if (await p.getByText("Selected", { exact: true }).count() === 0) { console.log("retry via text click"); await p.getByText("Summer Camp Day Pass").first().click(); await p.waitForTimeout(2500); }
  console.log("SELECTED?", await p.getByText("Selected", { exact: true }).count());
  fs.writeFileSync(path.join(TXT, "fr-wizard-after-use-block.txt"), await p.locator("body").innerText());
  await shot(p, "fr-wizard-block-picked");
  await p.getByTitle("13. Policy & publish", { exact: true }).click(); await p.waitForTimeout(1500);
  await shot(p, "fr-wizard-ready-to-publish");
  fs.writeFileSync(path.join(TXT, "fr-wizard-publish-label.txt"), await p.locator("div.fixed button", { hasText: /^Publish/ }).first().innerText().catch(() => "?"));
  await p.locator("div.fixed button", { hasText: /^Publish/ }).first().click(); await p.waitForTimeout(5000);
  note({ step: "FR-12 publish", screen: "wizard -> list", secs: Math.round((Date.now() - T0) / 1000), clicks: 8, verdict: "see findings", shot: await shot(p, "fr-after-publish2") });
  fs.writeFileSync(path.join(TXT, "fr-after-publish2.txt"), await p.locator("body").innerText());
  await c.close();
});

test("S11 head office sees the franchise", async () => {
  test.setTimeout(900_000);
  const c = await ctx("desktop"); const p = await c.newPage();
  await login(p, st.A.ho.email, /\/company\//); await settle(p, 3000);
  const pages: [string, string, string][] = [
    ["/company/franchise-invites", "ho-invites-after-join", "Invite franchises (after join)"], ["/company/franchise-overview", "ho-franchises-overview", "Franchises overview"],
    ["/company/franchise-features", "ho-feature-control", "Feature control"], ["/company/territories", "ho-territories", "Territories"],
    ["/company/listings", "ho-listings", "Blocks & listings (HO)"], ["/company/splitfees", "ho-splitfees", "Split fees"],
    ["/company/subscription", "ho-subscription", "Subscription"], ["/company/getpaid", "ho-getpaid", "Get paid"], ["/company/ho-framework", "ho-milestones", "Milestones"],
  ];
  for (const [u, n, label] of pages) await visit(p, u, n, { step: `HO-4 ${label}`, screen: u, clicks: 2, verdict: "see findings" });
  await c.close();
});

test("S12 parent books (cash on the day)", async () => {
  test.setTimeout(900_000);
  if (!st.A.pa) {
    const mail = email("pa"); const s = await fbSignUp(mail);
    const r = await call(s.idToken, "POST", "/api/register-role", { role: "parent", postcode: "NN5 7EA" });
    if (r.status >= 300) throw new Error(JSON.stringify(r.json));
    await call(s.idToken, "POST", "/api/me/welcome", {});
    st.A.pa = { email: mail, uid: s.uid }; save();
  }
  const link = `${WEB_URL}/book/${st.listingId}`;
  // phone look at the public booking page (signed out)
  const pc = await ctx("phone"); const pp = await pc.newPage();
  await pp.goto(link, { waitUntil: "load", timeout: 120_000 }); await settle(pp, 6000);
  fs.writeFileSync(path.join(TXT, "pa-booking-page-phone.txt"), await pp.locator("body").innerText());
  note({ step: "PA-1p public booking page (phone, signed out)", screen: "/book/:id", clicks: 1, verdict: "see findings", shot: await shot(pp, "pa-booking-page-phone") });
  await pc.close();
  const c = await ctx("desktop"); const p = await c.newPage();
  await login(p, st.A.pa.email, /\/custdash\//); await settle(p, 2500);
  await p.goto(link, { waitUntil: "load", timeout: 120_000 }); await settle(p, 6000);
  fs.writeFileSync(path.join(TXT, "pa-booking-page.txt"), await p.locator("body").innerText());
  note({ step: "PA-1 public booking page (desktop)", screen: "/book/:id", clicks: 1, verdict: "see findings", shot: await shot(p, "pa-booking-page-desktop") });
  await p.getByRole("button", { name: /Day pass · £/ }).first().click(); await p.waitForTimeout(1500);
  const timing = p.getByText(/choose a timing/i);
  if (await timing.isVisible().catch(() => false)) await p.getByRole("button", { name: /Full day/ }).first().click();
  await p.waitForTimeout(800);
  await p.getByRole("button", { name: /^(Mon|Tue|Wed|Thu|Fri) \d+$/ }).first().click();
  await p.getByRole("button", { name: /Add .* to basket/ }).click(); await p.waitForTimeout(1200);
  await shot(p, "pa-basket");
  await p.getByRole("button", { name: /Next — add children/ }).click(); await p.waitForTimeout(2000);
  await p.getByRole("button", { name: /Add a new child/ }).click();
  await p.getByPlaceholder("First and last name").fill(`Kid ${stamp}`);
  const dob = p.locator('input[type="date"]').first(); if (await dob.isVisible().catch(() => false)) await dob.fill("2018-05-14");
  const boyBtn = p.getByRole("button", { name: "Boy", exact: true }); await boyBtn.waitFor({ state: "visible", timeout: 6000 }).then(() => boyBtn.click()).catch(() => {});
  await shot(p, "pa-child-form");
  await p.getByRole("button", { name: "Add child", exact: true }).click();
  const nextBtn = p.getByRole("button", { name: "Next", exact: true });
  for (let g = 0; !(await nextBtn.isVisible().catch(() => false)); g++) {
    if (g > 20) throw new Error("stuck children step");
    fs.writeFileSync(path.join(TXT, "pa-children-step.txt"), await p.locator("body").innerText());
    for (const box of await p.getByRole("textbox").all()) if (await box.isVisible().catch(() => false) && !(await box.inputValue().catch(() => "x"))) await box.fill("N/A").catch(() => {});
    for (const sel of await p.locator("select:visible").all()) if (!(await sel.inputValue().catch(() => "x"))) { const v = await sel.locator("option").nth(1).getAttribute("value").catch(() => null); if (v) await sel.selectOption(v).catch(() => {}); }
    for (const yes of await p.getByRole("button", { name: "Yes", exact: true }).all()) if (await yes.isVisible().catch(() => false)) await yes.click().catch(() => {});
    const ac = p.getByRole("button", { name: "Add child", exact: true }); if (await ac.isVisible().catch(() => false)) await ac.click().catch(() => {});
    await p.waitForTimeout(500);
  }
  await shot(p, "pa-children-done");
  await nextBtn.click(); await p.waitForTimeout(2500);
  const phone = p.getByPlaceholder("e.g. 07700 900123"); if (await phone.isVisible().catch(() => false)) await phone.fill("07700900123");
  fs.writeFileSync(path.join(TXT, "pa-pay-step.txt"), await p.locator("body").innerText());
  note({ step: "PA-2 payment step", screen: "checkout", clicks: 12, verdict: "see findings", shot: await shot(p, "pa-pay-step") });
  await p.getByText("Cash on the day", { exact: false }).first().click().catch((e) => console.log("cash click failed", String(e).slice(0, 80))); await p.waitForTimeout(1200);
  await shot(p, "pa-pay-cash-selected");
  await c.close();
});

async function parentBook(p: Page, dayIdx: number | number[], method: string, tag: string) {
  await p.goto(`${WEB_URL}/book/${st.listingId}`, { waitUntil: "load", timeout: 120_000 }); await settle(p, 5000);
  await p.getByRole("button", { name: /Day pass · £/ }).first().click(); await p.waitForTimeout(1200);
  if (await p.getByText(/choose a timing/i).isVisible().catch(() => false)) await p.getByRole("button", { name: /Full day/ }).first().click();
  await p.waitForTimeout(600);
  const days = p.getByRole("button", { name: /^(Mon|Tue|Wed|Thu|Fri) \d+$/ });
  for (const i of ([] as number[]).concat(dayIdx)) await days.nth(i).click();
  await p.getByRole("button", { name: /Add .* to basket/ }).click(); await p.waitForTimeout(1000);
  await p.getByRole("button", { name: /Next — add children/ }).click(); await p.waitForTimeout(2500);
  if (await p.getByRole("button", { name: /Add a new child/ }).isVisible().catch(() => false) && !(await p.getByText(`Kid ${stamp}`).first().isVisible().catch(() => false))) {
    await p.getByRole("button", { name: /Add a new child/ }).click();
    await p.getByPlaceholder("First and last name").fill(`Kid ${stamp}`);
    const dob = p.locator('input[type="date"]').first(); if (await dob.isVisible().catch(() => false)) await dob.fill("2018-05-14");
    const boy = p.getByRole("button", { name: "Boy", exact: true }); await boy.waitFor({ state: "visible", timeout: 5000 }).then(() => boy.click()).catch(() => {});
    await p.getByRole("button", { name: "Add child", exact: true }).click();
  }
  const nextBtn = p.getByRole("button", { name: "Next", exact: true });
  for (let g = 0; !(await nextBtn.isVisible().catch(() => false)); g++) {
    if (g > 15) throw new Error("stuck children step");
    const kid = null; const addKid = p.locator(`[aria-label^="Add Kid"], [title^="Add Kid"]`).first(); if (await addKid.isVisible().catch(() => false)) { await addKid.click().catch(() => {}); await p.waitForTimeout(500); }
    for (const box of await p.getByRole("textbox").all()) if (await box.isVisible().catch(() => false) && !(await box.inputValue().catch(() => "x"))) await box.fill("N/A").catch(() => {});
    for (const sel of await p.locator("select:visible").all()) if (!(await sel.inputValue().catch(() => "x"))) { const v = await sel.locator("option").nth(1).getAttribute("value").catch(() => null); if (v) await sel.selectOption(v).catch(() => {}); }
    for (const yes of await p.getByRole("button", { name: "Yes", exact: true }).all()) if (await yes.isVisible().catch(() => false)) await yes.click().catch(() => {});
    const ac = p.getByRole("button", { name: "Add child", exact: true }); if (await ac.isVisible().catch(() => false)) await ac.click().catch(() => {});
    await p.waitForTimeout(500);
    if (g === 3) { fs.writeFileSync(path.join(TXT, `pa-children-stuck-${tag}.txt`), await p.locator("body").innerText()); await shot(p, `pa-children-stuck-${tag}`, false); void kid; }
  }
  await nextBtn.click(); await p.waitForTimeout(2500);
  const phone = p.getByPlaceholder("e.g. 07700 900123"); if (await phone.isVisible().catch(() => false)) await phone.fill("07700900123");
  const sel = p.locator("select").filter({ hasText: "Card" }).first();
  fs.writeFileSync(path.join(TXT, `pa-pay-options-${tag}.txt`), (await sel.locator("option").allInnerTexts()).join("\n"));
  await sel.selectOption({ label: method }); await p.waitForTimeout(1200);
  fs.writeFileSync(path.join(TXT, `pa-pay-step-${tag}.txt`), await p.locator("body").innerText());
  const f = await shot(p, `pa-pay-${tag}-selected`);
  await p.getByRole("button", { name: /^Confirm/ }).first().click(); await p.waitForTimeout(6000);
  fs.writeFileSync(path.join(TXT, `pa-confirmation-${tag}.txt`), await p.locator("body").innerText());
  return { f, conf: await shot(p, `pa-confirmation-${tag}`) };
}
test("S13 parent books cash on the day", async () => {
  test.setTimeout(900_000);
  const c = await ctx("desktop"); const p = await c.newPage();
  await login(p, st.A.pa.email, /\/custdash\//); await settle(p, 2500);
  const t0 = Date.now();
  const r = await parentBook(p, 0, "Cash on the day", "cash1");
  note({ step: "PA-3 book + Cash on the day", screen: "checkout -> confirmation", secs: Math.round((Date.now() - t0) / 1000), clicks: 14, verdict: "see findings", shot: r.conf });
  const refTxt = (await p.locator("body").innerText()).match(/[A-Z]{3}-\d+/g); st.refs = [...(st.refs || []), ...(refTxt ? [refTxt[0]] : [])]; save();
  await c.close();
});

test("S14 parent books 2 days cash (for refund test)", async () => {
  test.setTimeout(900_000);
  const c = await ctx("desktop"); const p = await c.newPage();
  await login(p, st.A.pa.email, /\/custdash\//); await settle(p, 2500);
  const r = await parentBook(p, [1, 2], "Cash on the day", "cash2");
  note({ step: "PA-4 second booking, 2 days, cash", screen: "checkout -> confirmation", clicks: 14, verdict: "ok", shot: r.conf });
  const refTxt = (await p.locator("body").innerText()).match(/[A-Z]{3}-\d+/g); st.ref2 = refTxt ? refTxt[0] : null; save();
  await c.close();
});

test("S15 franchisee sees bookings, marks paid", async () => {
  test.setTimeout(900_000);
  const c = await ctx("desktop"); const p = await c.newPage();
  await login(p, st.A.fr.email, /\/franchise\//); await settle(p, 4000);
  const row = p.getByText(`Ref ${st.refs[0]}`).first();
  await row.click(); await p.waitForTimeout(2500);
  const btns = await p.locator("button:visible").evaluateAll((els) => els.map((e: any) => (e.innerText || "").replace(/\s+/g, " ").slice(0, 60)).filter(Boolean));
  fs.writeFileSync(path.join(TXT, "fr-booking-buttons.txt"), btns.join("\n"));
  fs.writeFileSync(path.join(TXT, "fr-booking-open.txt"), await p.locator("body").innerText());
  note({ step: "FR-14 open booking", screen: "/franchise/bookings", clicks: 1, verdict: "see findings", shot: await shot(p, "fr-booking-open") });
  await c.close();
});

test("S16 mark second paid and royalty views", async () => {
  test.setTimeout(900_000);
  const c = await ctx("desktop"); const p = await c.newPage();
  await login(p, st.A.fr.email, /\/franchise\//); await settle(p, 5000);
  await p.getByText(`Ref ${st.ref2}`).first().click(); await p.waitForTimeout(2500);
  await p.getByRole("button", { name: "Mark paid" }).click(); await p.waitForTimeout(2500);
  note({ step: "FR-15 Mark paid (one click, no confirm)", screen: "booking detail", clicks: 3, verdict: "fast; no confirmation or receipt prompt", shot: await shot(p, "fr-after-markpaid-2", false) });
  await visit(p, "/franchise/royalties", "fr-royalties-after-paid", { step: "FR-16 Royalties after 2 paid bookings", screen: "/franchise/royalties", clicks: 2, verdict: "see findings" }, 7000);
  await c.close();
  const h = await ctx("desktop"); const hp = await h.newPage();
  await login(hp, st.A.ho.email, /\/company\//); await settle(hp, 3000);
  await visit(hp, "/company/splitfees", "ho-splitfees-after-paid", { step: "HO-5 Split fees after paid", screen: "/company/splitfees", clicks: 3, verdict: "see findings" }, 8000);
  await h.close();
});

test("S17 cancel one day + refund, royalty nets", async () => {
  test.setTimeout(900_000);
  const c = await ctx("desktop"); const p = await c.newPage();
  await login(p, st.A.fr.email, /\/franchise\//); await settle(p, 5000);
  await p.getByText(`Ref ${st.ref2}`).first().click(); await p.waitForTimeout(2500);
  await p.getByText("Cancel this day").first().click(); await p.waitForTimeout(2500);
  fs.writeFileSync(path.join(TXT, "fr-cancel-day-dialog.txt"), await p.locator("body").innerText());
  note({ step: "FR-17 Cancel this day dialog", screen: "booking detail", clicks: 3, verdict: "see findings", shot: await shot(p, "fr-cancel-day-dialog", false) });
  const btns = await p.locator("button:visible").evaluateAll((els) => els.map((e: any) => (e.innerText || "").replace(/\s+/g, " ").slice(0, 70)).filter(Boolean));
  fs.writeFileSync(path.join(TXT, "fr-cancel-day-buttons.txt"), btns.join("\n"));
  await c.close();
});

test("S18 royalty after refund", async () => {
  test.setTimeout(900_000);
  const c = await ctx("desktop"); const p = await c.newPage();
  await login(p, st.A.fr.email, /\/franchise\//); await settle(p, 3000);
  await visit(p, "/franchise/royalties", "fr-royalties-after-refund", { step: "FR-18 Royalties after 1-day refund", screen: "/franchise/royalties", clicks: 2, verdict: "see findings" }, 7000);
  await c.close();
  const h = await ctx("desktop"); const hp = await h.newPage();
  await login(hp, st.A.ho.email, /\/company\//); await settle(hp, 3000);
  await visit(hp, "/company/splitfees", "ho-splitfees-after-refund", { step: "HO-6 Split fees after refund", screen: "/company/splitfees", clicks: 3, verdict: "see findings" }, 8000);
  await visit(hp, "/company/franchise-overview", "ho-franchises-after-bookings", { step: "HO-7 Franchises overview after bookings", screen: "/company/franchise-overview", clicks: 2, verdict: "see findings" }, 7000);
  await visit(hp, "/company/bookings", "ho-bookings", { step: "HO-8 HO bookings list (sees franchise bookings)", screen: "/company/bookings", clicks: 1, verdict: "see findings" }, 7000);
  await h.close();
});

test("S19 sibling franchise + isolation probes", async () => {
  test.setTimeout(900_000);
  const nm = (n: number) => { const d = new Date(); d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7) + n); return isoD(d); };
  if (!st.A.fb) {
    const inv = await ok("ho", "POST", "/api/invites", { role: "franchise", franchiseName: `Rival Rovers Leicester ${stamp}`, franchiseArea: "Leicester" });
    const mail = email("fb"); const s = await fbSignUp(mail);
    const acc = await call(s.idToken, "POST", `/api/invites/${inv.token}/accept`, {});
    if (acc.status >= 300) throw new Error(JSON.stringify(acc.json));
    st.A.fb = { email: mail, uid: s.uid, inviteToken: inv.token }; save();
  }
  // B's data
  const lib = (await api("fb", "GET", "/api/library")).json ?? {};
  await ok("fb", "PUT", "/api/library", { venues: [{ id: "fb-venue", name: "Leicester Leisure Centre", address: "2 Test Rd", city: "Leicester" }], settings: { ...(lib.settings ?? {}) } });
  if (!st.fbListing) {
    const per = await ok("fb", "POST", "/api/periods", { title: "Full day", start: "09:00", finish: "15:00" });
    const pas = await ok("fb", "POST", "/api/passes", { name: "1 day", days: 1 });
    const bun = await ok("fb", "POST", "/api/block-bundles", { name: "B bundle", periodIds: [per.id], passIds: [pas.id], priced: true, masterPrice: 40, calcOn: true, passFlat: { [pas.id]: 40 }, passMode: { [pas.id]: "flat" } });
    const l = await ok("fb", "POST", "/api/listings", { title: `Rival Camp ${stamp}`, venueId: "fb-venue", runFrom: nm(0), runTo: nm(11), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "10", capacityScope: "day", ageFrom: "5", ageTo: "11", blockId: bun.id, passes: [{ name: "1 day", price: 40, days: 1 }], bookingType: "auto", status: "live", visibility: "public" });
    await ok("fb", "PUT", `/api/block-bundles/${bun.id}/listings`, { listingIds: [l.id] });
    st.fbListing = l.id; st.fbBundle = bun.id; save();
  }
  const full = await ok("fb", "GET", `/api/listings/${st.fbListing}`);
  const blk = (full.blocks ?? [])[0];
  if (!st.fbBooking) {
    const pt = (await fbSignIn(st.A.pa.email)).idToken;
    const bk = await call(pt, "POST", "/api/my/bookings", { listingId: st.fbListing, blockId: blk?.id, method: "cash", items: [{ pass: "1 day", child: "Rival Kid", age: 8, dates: [blk?.startDate ?? nm(0)] }] });
    st.fbBookingRes = { status: bk.status, json: JSON.stringify(bk.json).slice(0, 400) }; st.fbBooking = bk.json?.bookings?.[0]?.id ?? bk.json?.bookings?.[0]?.ref ?? "?"; save();
  }
  const bks = await ok("fb", "GET", "/api/bookings"); const bid = (bks[0] ?? {}).id;
  const probes: [string, string, string, unknown?][] = [
    ["A reads B's listing by id", "GET", `/api/listings/${st.fbListing}`],
    ["A lists listings (own scope)", "GET", `/api/listings?mine=1`],
    ["A lists listings ?franchiseId=B", "GET", `/api/listings?mine=1&franchiseId=${"__B__"}`],
    ["A reads B's booking by id", "GET", `/api/bookings/${bid}`],
    ["A lists all bookings", "GET", "/api/bookings"],
    ["A lists customers (families)", "GET", "/api/customers"],
    ["A lists children", "GET", "/api/children"],
    ["A reads B's block bundle ?franchiseId=B", "GET", `/api/block-bundles?franchiseId=__B__`],
    ["A PUT B's bundle", "PUT", `/api/block-bundles/${st.fbBundle}`, { name: "hacked", periodIds: [], passIds: [] }],
    ["A PUT B's listing", "PUT", `/api/listings/${st.fbListing}`, { title: "hacked by A" }],
    ["A DELETE B's listing", "DELETE", `/api/listings/${st.fbListing}`],
    ["A GET /api/franchises", "GET", "/api/franchises"],
    ["A GET /api/franchises/features", "GET", "/api/franchises/features"],
    ["A PUT B's features", "PUT", `/api/franchises/__B__/features`, { features: { tripsplaceholder: false } }],
    ["A PUT B's territory", "PUT", `/api/franchises/__B__/territory`, { areas: [] }],
    ["A GET /api/ho/overview", "GET", "/api/ho/overview"],
    ["A GET /api/splitfees (HQ report)", "GET", "/api/splitfees"],
    ["A PUT /api/splitfees/settings (set own royalty)", "PUT", "/api/splitfees/settings", { basis: "revenue", rate: 0 }],
    ["A GET /api/milestones/franchises", "GET", "/api/milestones/franchises"],
    ["A GET /api/milestones?franchiseId=B", "GET", "/api/milestones?franchiseId=__B__"],
    ["A GET /api/invites (own scope)", "GET", "/api/invites"],
    ["A GET invite preview of B's used token", "GET", `/api/invites/${st.A.fb.inviteToken}`],
    ["A GET /api/subscription", "GET", "/api/subscription"],
    ["A GET /api/dashboard", "GET", "/api/dashboard"],
    ["A GET /api/payments", "GET", "/api/payments"],
    ["A GET /api/incidents (safeguarding)", "GET", "/api/incidents"],
    ["A GET /api/registers", "GET", "/api/registers"],
  ];
  const bUser = (await api("fb", "GET", "/api/me")).json; const fidB = bUser?.franchiseId;
  const out: any[] = [];
  for (const [label, method, url0, body] of probes) {
    const url = url0.replace(/__B__/g, String(fidB)); const b2 = body ? JSON.parse(JSON.stringify(body).replace(/__B__/g, String(fidB))) : undefined;

    const r = await api("fr", method, url, b2);
    let summary = JSON.stringify(r.json).slice(0, 160);
    if (Array.isArray(r.json)) summary = `array(${r.json.length}) ids=${JSON.stringify(r.json.slice(0, 4).map((x: any) => x.id ?? x.ref ?? x.title ?? x.name ?? "?"))}`;
    out.push({ label, method, url, status: r.status, summary, leaksB: JSON.stringify(r.json).includes("Rival") || JSON.stringify(r.json).includes(String(st.fbListing)) || JSON.stringify(r.json).includes("Leicester") });
  }
  st.isolation = out; save();
  fs.writeFileSync(path.join(TXT, "isolation.json"), JSON.stringify({ fidB, out }, null, 1));
});

test("S20 head office only views + franchise URL access", async () => {
  test.setTimeout(900_000);
  const h = await ctx("desktop"); const hp = await h.newPage();
  await login(hp, st.A.ho.email, /\/company\//); await settle(hp, 4000);
  for (const g of ["Overview", "Safeguarding oversight", "People & reviews", "Settings"]) { await hp.getByText(new RegExp(`^${g}$`, "i")).first().click().catch(() => {}); await hp.waitForTimeout(500); }
  const links = await hp.locator("a[href^='/company/']").evaluateAll((els) => els.map((e: any) => `${e.getAttribute("href")} | ${(e.innerText || "").replace(/\s+/g, " ").trim()}`));
  fs.writeFileSync(path.join(TXT, "ho-nav-links.txt"), links.join("\n"));
  await shot(hp, "ho-sidebar-all-groups", false);
  await h.close();
});

test("S21 HO-only screens + franchise URL tries", async () => {
  test.setTimeout(1_200_000);
  const h = await ctx("desktop"); const hp = await h.newPage();
  await login(hp, st.A.ho.email, /\/company\//); await settle(hp, 3000);
  await visit(hp, "/company/dashboard", "ho-dashboard", { step: "HO-9 HO dashboard (network)", screen: "/company/dashboard", clicks: 1, verdict: "see findings" }, 8000);
  await visit(hp, "/company/customers", "ho-families", { step: "HO-10 Families (network)", screen: "/company/customers", clicks: 1, verdict: "see findings" }, 7000);
  await visit(hp, "/company/incidents", "ho-incidents-oversight", { step: "HO-11 Safeguarding oversight (Incidents)", screen: "/company/incidents", clicks: 2, verdict: "see findings" }, 7000);
  await hp.getByText("Find a child", { exact: false }).first().click().catch(() => {}); await hp.waitForTimeout(3000);
  fs.writeFileSync(path.join(TXT, "ho-find-a-child.txt"), await hp.locator("body").innerText());
  note({ step: "HO-12 Find a child", screen: "header button", clicks: 1, verdict: "see findings", shot: await shot(hp, "ho-find-a-child", false) });
  await h.close();
  const c = await ctx("desktop"); const p = await c.newPage();
  await login(p, st.A.fr.email, /\/franchise\//); await settle(p, 3000);
  for (const u of ["/company/splitfees", "/company/franchise-overview", "/franchise/franchise-overview", "/franchise/franchise-features", "/franchise/territories", "/franchise/splitfees", "/franchise/ho-framework"]) {
    await p.goto(`${WEB_URL}${u}`, { waitUntil: "load" }).catch(() => {}); await p.waitForTimeout(5000);
    const txt = (await p.locator("body").innerText()).replace(/\n{2,}/g, "\n");
    fs.writeFileSync(path.join(TXT, `fr-url-${u.replace(/\W+/g, "_")}.txt`), `LANDED ${p.url()}\n${txt}`);
    note({ step: `FR-URL ${u}`, screen: `landed ${p.url().replace(WEB_URL, "")}`, clicks: 0, verdict: "isolation try", shot: await shot(p, `fr-url${u.replace(/\W+/g, "-")}`, false) });
  }
  await c.close();
});

test("S22 HO turns a feature off; can the franchisee turn it back on?", async () => {
  test.setTimeout(900_000);
  const h = await ctx("desktop"); const hp = await h.newPage();
  await login(hp, st.A.ho.email, /\/company\//); await settle(hp, 3000);
  await hp.goto(`${WEB_URL}/company/franchise-features`, { waitUntil: "load" }); await hp.waitForTimeout(6000);
  const row = hp.locator("tr, div").filter({ hasText: /^Discount codes/ }).last();
  const toggles = hp.getByRole("switch", { name: /Discount codes/i });
  console.log("switch count", await toggles.count());
  // click the franchise column toggle (second one in the row)
  const rowToggles = hp.locator('tr:has-text("Discount codes") [role="switch"], tr:has-text("Discount codes") input[type="checkbox"], tr:has-text("Discount codes") button');
  console.log("row toggles", await rowToggles.count());
  await rowToggles.nth(1).click().catch((e) => console.log("toggle click failed", String(e).slice(0, 100))); await hp.waitForTimeout(2500);
  note({ step: "HO-13 turn off 'Discount codes' for the franchise", screen: "/company/franchise-features", clicks: 5, verdict: "see findings", shot: await shot(hp, "ho-feature-off", false) });
  await h.close();
  const c = await ctx("desktop"); const p = await c.newPage();
  await login(p, st.A.fr.email, /\/franchise\//); await settle(p, 4000);
  await p.getByText(/^Marketing$/i).first().click().catch(() => {}); await p.waitForTimeout(800);
  fs.writeFileSync(path.join(TXT, "fr-nav-after-feature-off.txt"), await p.locator("body").innerText());
  await shot(p, "fr-sidebar-after-feature-off", false);
  await p.goto(`${WEB_URL}/franchise/setup`, { waitUntil: "load" }); await p.waitForTimeout(5000);
  const dc = p.locator("div").filter({ hasText: /^Discount codes/ }).last();
  fs.writeFileSync(path.join(TXT, "fr-setup-features-after-off.txt"), await p.locator("body").innerText());
  note({ step: "FR-19 Setup > Features after HO switched Discount codes off", screen: "/franchise/setup", clicks: 3, verdict: "see findings", shot: await shot(p, "fr-setup-features-after-off") });
  await c.close();
});

test("S23 franchisee re-enables the feature HO turned off", async () => {
  test.setTimeout(600_000);
  const c = await ctx("desktop"); const p = await c.newPage();
  await login(p, st.A.fr.email, /\/franchise\//); await settle(p, 3000);
  await p.goto(`${WEB_URL}/franchise/setup`, { waitUntil: "load" }); await p.waitForTimeout(6000);
  const rowOf = p.locator("div").filter({ has: p.getByText("Discount codes", { exact: true }) }).filter({ hasText: "Families see this too" }).last();
  const before = await rowOf.innerText().catch(() => "?");
  await shot(p, "fr-setup-discount-before", false);
  await rowOf.getByRole("button", { name: "On", exact: true }).first().click().catch((e) => console.log("on click failed", String(e).slice(0, 100))); await p.waitForTimeout(3000);
  await p.goto(`${WEB_URL}/franchise/dash`, { waitUntil: "load" }); await p.waitForTimeout(5000);
  await p.getByText(/^Marketing$/i).first().click().catch(() => {}); await p.waitForTimeout(800);
  const nav = await p.locator("body").innerText();
  console.log("DISCOUNT IN NAV AFTER RE-ENABLE:", /Discount codes/.test(nav));
  note({ step: "FR-20 franchisee re-enables Discount codes HO switched off", screen: "/franchise/setup", clicks: 3, verdict: `discount in nav after re-enable: ${/Discount codes/.test(nav)}`, shot: await shot(p, "fr-after-reenable", false) });
  await c.close();
});
