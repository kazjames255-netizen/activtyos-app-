import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT, WEB_URL } from "./helpers/env";
import { DEFAULT_POLICIES } from "../lib/cancellation";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, apiFetch, apiPost, fbSignIn, fbSignUp } from "./helpers/accounts";
import { cardWith } from "./helpers/ui";

// Gap-fill sweep: same flows as the CN/LT/RD/ME specs, run on FRESH freelancer / franchise / company accounts.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (...a: Parameters<typeof fetch>) => {
  for (let i = 0; ; i++) {
    try { const [u, init] = a; return await realFetch(u, { signal: AbortSignal.timeout(60_000), ...(init ?? {}) }); } catch (e) { if (i >= 8) throw e; await new Promise((r) => setTimeout(r, 3000)); }
  }
}) as typeof fetch;
test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 30_000, navigationTimeout: 60_000 });
const stamp = Date.now().toString(36);
const SHOTS = path.join(ROOT, "e2e/review/shots/gapcn");
fs.mkdirSync(SHOTS, { recursive: true });
const SCR = "/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/d6be64b6-4124-4419-9525-b7eb6fbb7058/scratchpad";
const OUT = path.join(SCR, "gapcn-results.json");
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const plus = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const ONLY = process.env.GAP_ONLY ? process.env.GAP_ONLY.split(",") : null;

type Kind = "co" | "fl" | "fr";
const TRACKER: Record<Kind, string> = { co: "company", fl: "freelancer", fr: "franchise" };
const PORTAL: Record<Kind, string> = { co: "company", fl: "freelancer", fr: "franchise" };
type Acct = { email: string; uid: string; tenantId: string; token: () => Promise<string> };
const tok = (email: string) => async () => (await fbSignIn(email)).idToken;
const A: Partial<Record<string, Acct>> = {};
let parent: Acct, p2: Acct;
const pages: Partial<Record<string, Page>> = {};
let theBrowser: Browser;

async function mkParent(tag: string): Promise<Acct> {
  const email = `e2e-gap-${tag}-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  await apiPost("/api/register-role", s.idToken, { role: "parent", postcode: "NN5 7EA" });
  await apiPost("/api/me/welcome", s.idToken, {});
  return { email, uid: s.uid, tenantId: "", token: tok(email) };
}
async function mkOp(tag: string, role: "company" | "freelancer"): Promise<Acct> {
  const email = `e2e-gap-${tag}-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  const name = `Gap ${tag} ${stamp}`;
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role, businessName: name, providerName: name, providerNameMode: "business" });
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", r.tenantId], { stdio: "pipe" });
  return { email, uid: s.uid, tenantId: r.tenantId, token: tok(email) };
}
async function mkFranchise(tag: string, ho: Acct): Promise<Acct> {
  const email = `e2e-gap-${tag}-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const inv = await apiPost<{ token: string }>("/api/invites", await ho.token(), { role: "franchise", franchiseName: `Gap Alpha ${stamp}` });
  const s = await fbSignUp(email);
  await apiPost(`/api/invites/${inv.token}/accept`, s.idToken, {});
  return { email, uid: s.uid, tenantId: ho.tenantId, token: tok(email) };
}
async function loginPage(a: Acct, home: RegExp): Promise<Page> {
  const ctx = await theBrowser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  for (let attempt = 0; ; attempt++) {
    try {
      await page.goto(`${WEB_URL}/login`);
      await page.getByPlaceholder("you@example.com").fill(a.email);
      await page.locator('input[type="password"]').fill(TEST_PASSWORD);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL(home, { timeout: 60_000 });
      return page;
    } catch (e) { if (attempt >= 2) throw e; }
  }
}

// ---- results ----
const RESULTS: Record<string, { id: string; kind: Kind; acct: string; status: string; note: string; shot?: string }> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const rec = (id: string, kind: Kind, status: "pass" | "fail" | "blocked", note: string, shot?: string) => {
  RESULTS[`${id}.${kind}`] = { id, kind, acct: TRACKER[kind], status, note, shot };
  fs.writeFileSync(OUT, JSON.stringify(RESULTS, null, 1));
  console.log(`RESULT ${id} [${kind}] ${status} :: ${note}`);
};
const rel = (f: string) => path.relative(ROOT, f);
let K: Kind = "fl";
let opg: Page;
const op = () => A[K]!;
let curShot: string | undefined;
async function snap(page: Page, id: string, suffix = "") {
  const f = path.join(SHOTS, `${id}.${K}${suffix}.png`);
  await page.waitForTimeout(700);
  await page.screenshot({ path: f, fullPage: true });
  curShot = rel(f);
  return f;
}
class Blocked extends Error {}
async function check(id: string, kind: Kind, page: () => Page | undefined, fn: () => Promise<string>) {
  if (ONLY && !ONLY.includes(id)) return;
  K = kind; curShot = undefined;
  console.log(`START ${id} [${kind}] ${new Date().toISOString().slice(11, 19)}`);
  try {
    const note = await fn();
    rec(id, kind, "pass", note, curShot);
  } catch (e) {
    const msg = String((e as Error).message).split("\n").filter(Boolean).slice(0, 4).join(" | ").slice(0, 700);
    try { const pg = page(); if (pg) await snap(pg, id, ".FAIL"); } catch { /* ignore */ }
    rec(id, kind, e instanceof Blocked ? "blocked" : "fail", msg, curShot);
  }
}

async function setSettings(a: Acct, patch: Record<string, unknown>) {
  const t = await a.token();
  const lib = ((await apiFetch<Record<string, unknown> | null>("/api/library", t)) ?? {}) as { settings?: Record<string, unknown> };
  await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ settings: { ...(lib.settings ?? {}), ...patch } }) });
}
const BASE_SETTINGS = { cancellationPolicies: DEFAULT_POLICIES, allowCardRefund: true, refundLetCustomerChoose: true, noRefundCredit: false, allowPartialCancel: true, partialAllowRefund: true, partialAllowWallet: true, partialAllowChangeDate: false, allowDateChanges: true, refundApproval: "review" };

interface L { id: string; title: string; runFrom: string; tenantId: string; blockId?: string; blocks?: { id: string; sessions?: { date: string }[] }[] }
async function mkListing(a: Acct, o: { title: string; offset: number; price?: number; passDays?: number; policy?: string; cap?: number; waitlist?: boolean; wmode?: "manual" | "auto"; runDays?: number; extra?: Record<string, unknown>; noVenue?: boolean }): Promise<L> {
  const t = await a.token();
  const lib = ((await apiFetch<Record<string, unknown> | null>("/api/library", t)) ?? {}) as { venues?: { id: string }[]; settings?: Record<string, unknown> };
  const vid = "gap-venue";
  await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ venues: (lib.venues ?? []).some((v) => v.id === vid) ? lib.venues : [...(lib.venues ?? []), { id: vid, name: "Gap Hall", address: "1 Test Way", city: "Northampton" }], settings: { ...(lib.settings ?? {}), marketplaceListed: true } }) });
  const passName = "3 days";
  const period = await apiPost<{ id: string }>("/api/periods", t, { title: "Full day", start: "09:00", finish: "15:30" });
  const pass = await apiPost<{ id: string }>("/api/passes", t, { name: passName, days: o.passDays ?? 3 });
  const price = o.price ?? 54;
  const bundle = await apiPost<{ id: string }>("/api/block-bundles", t, { name: `Gap Block ${o.title}`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: price, calcOn: true });
  const from = plus(o.offset), to = plus(o.offset + (o.runDays ?? 6));
  const l = await apiPost<{ id: string; tenantId: string }>("/api/listings", t, {
    title: o.title, ...(o.noVenue ? {} : { venueId: vid }), runFrom: from, runTo: to, blockMode: "custom", days: [0, 1, 2, 3, 4, 5, 6],
    maxAttendees: String(o.cap ?? 16), capacityScope: "day", ...(o.waitlist ? { waitlist: true, waitlistMode: o.wmode ?? "manual" } : {}), showSpaces: true, ageFrom: "5", ageTo: "12",
    blockId: bundle.id, passes: [{ name: passName, price, days: o.passDays ?? 3 }], bookingType: "auto", status: "live", visibility: "public",
    ...(o.policy ? { cancellationPolicyId: o.policy } : {}), ...(o.extra ?? {}),
  });
  await apiFetch(`/api/block-bundles/${bundle.id}/listings`, t, { method: "PUT", body: JSON.stringify({ listingIds: [l.id] }) });
  return { id: l.id, title: o.title, runFrom: from, tenantId: l.tenantId };
}
const opBooking = async (ref: string) => apiFetch<Record<string, any>>(`/api/bookings/${ref}`, await op().token());
const markPaid = async (ref: string) => apiPost(`/api/bookings/${ref}/actions`, await op().token(), { type: "paid" });
const opAct = async (ref: string, body: Record<string, unknown>) => apiPost(`/api/bookings/${ref}/actions`, await op().token(), body);
const pCancelApi = async (a: Acct, ref: string, body: Record<string, unknown> = {}) => apiPost<Record<string, any>>(`/api/my/bookings/${ref}/cancel`, await a.token(), { tenantId: op().tenantId, ...body });
const notifs = async (a: Acct) => (await apiFetch<{ notifications: { title: string; body: string }[] }>("/api/notifications", await a.token())).notifications;
const wallet = async (a: Acct) => { const w = await apiFetch<{ balances: { balance?: number }[] }>("/api/my/wallet", await a.token()); return w.balances.reduce((n, x) => n + (x.balance ?? 0), 0); };
const waitCancel = async (ref: string) => { await expect.poll(async () => ((await opBooking(ref)).cancel ? 1 : 0), { timeout: 30_000 }).toBe(1); };
const kid = (tag: string) => `${tag} ${K} ${stamp}`;

async function opOpen(child: string) {
  await opg.goto(`/${PORTAL[K]}/bookings`);
  await opg.getByText(child, { exact: true }).first().click();
  await expect(opg.getByRole("button", { name: /Cancel booking|Approve refund|Accept refund|Decline refund/ }).first()).toBeVisible({ timeout: 30_000 });
}
async function opView(child: string) {
  await opg.goto(`/${PORTAL[K]}/bookings`);
  await opg.getByText(child, { exact: true }).first().click();
  await opg.getByText("Booking details").first().waitFor({ timeout: 30_000 });
  await opg.waitForTimeout(800);
}
const opClick = async (name: RegExp | string) => opg.getByRole("button", { name }).first().click();

async function booked(o: { tag: string; offset: number; paid?: boolean; method?: string; extra?: Record<string, unknown>; lst?: Parameters<typeof mkListing>[1] extends infer X ? Partial<X> : never; who?: Acct }) {
  const child = kid(o.tag);
  const l = await mkListing(op(), { title: `Gap ${o.tag} ${K} ${stamp}`, offset: o.offset, ...(o.lst ?? {}) } as any);
  const who = o.who ?? parent;
  const t = await who.token();
  const doc = await apiFetch<{ blocks: { id: string; sessions?: { date: string }[] }[] }>(`/api/listings/${l.id}`, t);
  const sessions = (doc.blocks[0].sessions ?? []).map((x) => x.date).sort();
  const dates = sessions.slice(0, 3);
  const res = await apiPost<{ bookings: Record<string, any>[] }>("/api/my/bookings", t, {
    listingId: l.id, blockId: doc.blocks[0].id, method: o.method ?? "card", walletCap: 0,
    items: [{ pass: "3 days", child, age: 8, dates }], ...(o.extra ?? {}),
  });
  const b = res.bookings[0];
  if (o.paid !== false) await markPaid(b.ref);
  return { child, l, ref: b.ref as string, dates, sessions };
}
const mailRows = (to: string, sinceIso: string): { subject: string; status: string; at: string }[] => {
  const out = execFileSync(path.join(ROOT, "server/node_modules/.bin/tsx"), [path.join(SCR, "mailrows.mts"), to, sinceIso], { cwd: path.join(ROOT, "server"), encoding: "utf8" });
  const m = out.match(/@@ROWS@@(.*)@@END@@/s);
  return m ? JSON.parse(m[1]) : [];
};

test.beforeAll(async ({ browser }) => {
  test.setTimeout(900_000);
  theBrowser = browser;
  parent = await mkParent("p"); p2 = await mkParent("p2");
  A.ho = await mkOp("ho", "company");
  A.co = await mkOp("co", "company");
  A.fl = await mkOp("fl", "freelancer");
  A.fr = await mkFranchise("fr", A.ho!);
  console.log("ACCOUNTS", JSON.stringify(Object.fromEntries(Object.entries(A).map(([k, v]) => [k, v!.email]))), parent.email);
  for (const k of ["co", "fl", "fr"] as Kind[]) {
    pages[k] = await loginPage(A[k]!, new RegExp(PORTAL[k]));
    await setSettings(A[k]!, { ...BASE_SETTINGS, marketplaceListed: true });
  }
});

// ===================================================================== CN checks
for (const kind of ["fl", "fr"] as Kind[]) {
  test(`CN gap checks ${kind}`, async () => {
    test.setTimeout(1_500_000);
    K = kind; opg = pages[kind]!;
    const o = A[kind]!;
    if (kind === "fr") await check("CN-006", kind, () => opg, async () => {
      const x = await booked({ tag: "cn006", offset: 8 });
      await pCancelApi(parent, x.ref, { refundPref: "card" }); await waitCancel(x.ref);
      await opOpen(x.child);
      const label = await opg.getByRole("button", { name: /Approve refund|Accept refund/ }).first().innerText();
      await snap(opg, "CN-006");
      await opClick(/Approve refund|Accept refund/);
      await expect.poll(async () => (await opBooking(x.ref)).pay, { timeout: 30_000 }).toMatch(/Refund/);
      const b = await opBooking(x.ref);
      throw new Blocked(`UI reached the "${label}" button and the click set pay=${b.pay} refundVia=${b.cancel.refundVia} refundedAt=${!!b.cancel.refundedAt}, but there is no Stripe PaymentIntent on the local stack (no STRIPE_SECRET_KEY, booking marked paid by hand), so the real card refund through Stripe and the Stripe refund id could not be exercised. Blocked for this account.`);
    });
    await check("CN-007", kind, () => opg, async () => {
      const x = await booked({ tag: "cn007", offset: 8 });
      await pCancelApi(parent, x.ref, { refundPref: "card" }); await waitCancel(x.ref);
      await opOpen(x.child);
      await opClick(/Decline refund/);
      await expect.poll(async () => (await opBooking(x.ref)).cancel?.refund, { timeout: 30_000 }).toBe("declined");
      await opView(x.child); await snap(opg, "CN-007");
      const b = await opBooking(x.ref);
      const told = (await notifs(parent)).filter((n) => (n.title + n.body).includes(x.ref) && /declin/i.test(n.title + n.body));
      expect(told.length, "parent bell about the declined refund").toBeGreaterThan(0);
      return `[screenshot after load, UI click + API assertion] operator clicked Decline refund in the ${TRACKER[kind]} portal -> cancel.refund=declined, pay=${b.pay}, no money moved; parent notified: "${told[0].title}"`;
    });
    await check("CN-009", kind, () => opg, async () => {
      await setSettings(o, { voucherProviders: [{ id: "cnv", name: "Gap Vouchers", details: [{ label: "Account", value: "GAP-ACCT-1" }] }], customerArea: { wallet: false } });
      const x = await booked({ tag: "cn009", offset: 8, extra: { voucherScheme: "cnv" }, paid: false, method: "Childcare voucher" });
      await markPaid(x.ref);
      await pCancelApi(parent, x.ref); await waitCancel(x.ref);
      const pre = await opBooking(x.ref);
      await opOpen(x.child);
      const labels = await opg.getByRole("button", { name: /Accept refund|Mark refund|Approve refund/ }).allInnerTexts();
      await snap(opg, "CN-009");
      await setSettings(o, { customerArea: { wallet: true } });
      expect(labels.join("|")).toMatch(/Mark refund reimbursed/);
      await opClick(/Mark refund reimbursed/);
      await expect.poll(async () => (await opBooking(x.ref)).cancel?.refundVia, { timeout: 30_000 }).toBe("offline");
      const b = await opBooking(x.ref);
      const told = (await notifs(parent)).filter((n) => (n.title + n.body).includes(x.ref));
      return `[screenshot after load, UI click + API assertion] voucher booking (refundTo=${pre.cancel.refundTo}); operator buttons: ${labels.join(" | ")}; clicked Mark refund reimbursed -> refundVia=${b.cancel.refundVia}, pay=${b.pay}; no Stripe; family notifications on this ref: ${told.map((n) => n.title).join(" / ")}`;
    });
    if (kind === "fr") await check("CN-014", kind, () => opg, async () => {
      const pol = ["flexible", "standard", "strict", "none"] as const;
      const expAmt = { flexible: 54, standard: 27, strict: 0, none: 0 };
      const xs: Record<string, Awaited<ReturnType<typeof booked>>> = {};
      for (const id of pol) xs[id] = await booked({ tag: `cn014${id}`, offset: 3, lst: { policy: id } as any });
      await opOpen(xs.strict.child);
      await opClick(/^Cancel booking$/);
      const sel = opg.locator("select").filter({ has: opg.locator("option", { hasText: "Flexible" }) }).first();
      const advice: string[] = [];
      for (const label of ["Flexible", "Standard", "Strict", "No refunds"]) {
        await sel.selectOption({ label });
        await opg.waitForTimeout(300);
        advice.push(`${label}: ${(await opg.getByText(/Policy says|policy says/).first().innerText()).replace(/\s+/g, " ")}`);
      }
      await snap(opg, "CN-014");
      const out: string[] = [];
      for (const id of pol) {
        const r = await pCancelApi(parent, xs[id].ref);
        out.push(`${id}=${r.cancel.amount}`);
        expect(r.cancel.amount, `policy ${id}`).toBe(expAmt[id]);
      }
      return `[screenshot of provider cancel panel + API] a parent cancelling each policy's listing at ~72h notice is given: ${out.join(", ")} (expected 54,27,0,0); franchise cancel panel advice by dropdown: ${advice.join(" // ")}`;
    });
    await check("CN-015", kind, () => opg, async () => {
      const x = await booked({ tag: "cn015", offset: 4 });
      await opOpen(x.child);
      await opClick(/^Cancel booking$/);
      await expect(opg.getByText("The family asked")).toBeVisible();
      const adviceTxt = (await opg.getByText(/Policy says|policy says/).first().innerText()).replace(/\s+/g, " ");
      await opg.getByText("Partial", { exact: true }).click();
      const prefill = await opg.getByText("Refund amount (£)").locator("xpath=following::input[1]").inputValue();
      await snap(opg, "CN-015");
      await opClick(/Confirm cancellation|Issue refund/);
      await expect.poll(async () => (await opBooking(x.ref)).status, { timeout: 30_000 }).toBe("Cancelled");
      const b = await opBooking(x.ref);
      expect(b.cancel.by).toBe("Provider");
      expect(b.cancel.amount).toBe(27);
      return `[screenshot of cancel panel after load + API] "The family asked", suggested refund per Standard policy at ~4 days notice: "${adviceTxt}"; Partial box prefilled with the suggestion £${prefill} (note: with no choice made the panel defaults to Full £54, not the policy amount); accepted it -> cancel.amount=${b.cancel.amount} by=${b.cancel.by} refund=${b.cancel.refund}`;
    });
    if (kind === "fr") await check("CN-016", kind, () => opg, async () => {
      const x = await booked({ tag: "cn016", offset: 1 });
      await opOpen(x.child);
      await opClick(/^Cancel booking$/);
      await opg.getByText("We cancelled it").click();
      const adviceTxt = (await opg.getByText(/Policy says|policy says/).first().innerText()).replace(/\s+/g, " ");
      expect(adviceTxt).toMatch(/full/i);
      await snap(opg, "CN-016");
      await opClick(/Confirm cancellation/);
      await expect.poll(async () => (await opBooking(x.ref)).status, { timeout: 30_000 }).toBe("Cancelled");
      const b = await opBooking(x.ref);
      expect(b.cancel.amount).toBe(54);
      return `[screenshot after load + API] booking 1 day from now (inside the no-refund window), "We cancelled it": panel says "${adviceTxt}"; cancel.amount=${b.cancel.amount} (100% of £54)`;
    });
    await check("CN-017", kind, () => opg, async () => {
      const x = await booked({ tag: "cn017", offset: 8 });
      await opOpen(x.child);
      await opClick(/^Cancel booking$/);
      await opg.getByText("Partial", { exact: true }).click();
      const box = opg.getByText("Refund amount (£)").locator("xpath=following::input[1]");
      await box.fill("20");
      await expect(box).toHaveValue("20");
      await opClick(/Confirm cancellation|Issue refund/);
      await expect.poll(async () => (await opBooking(x.ref)).status, { timeout: 30_000 }).toBe("Cancelled");
      const b = await opBooking(x.ref);
      expect(b.cancel.amount).toBe(20); expect(b.amount).toBe(54);
      await opView(x.child);
      await expect(opg.getByText(/£20\.00/).first()).toBeVisible();
      await snap(opg, "CN-017");
      return `[screenshot after load + API] partial £20 typed in 'Refund amount (£)': cancel.refund=${b.cancel.refund} amount=${b.cancel.amount}; booking total still £${b.amount}; booking screen shows £20.00`;
    });
    await check("CN-020", kind, () => opg, async () => {
      const x = await booked({ tag: "cn020", offset: 8 });
      await opOpen(x.child);
      await opg.getByRole("button", { name: "Cancel this day" }).first().click();
      await expect.poll(async () => ((await opBooking(x.ref)).refundLog?.length ?? 0), { timeout: 30_000 }).toBeGreaterThan(0);
      const b = await opBooking(x.ref);
      await opView(x.child);
      await snap(opg, "CN-020");
      expect(b.refundLog[0].amount).toBe(18);
      return `[screenshot after load + API] Cancel this day on one date: refundLog=${JSON.stringify(b.refundLog.map((r: any) => r.amount))} (54/3 = 18), status=${b.status} pay=${b.pay}`;
    });
    await check("CN-025", kind, () => opg, async () => {
      const code = `GAPONE${kind}${stamp}`.toUpperCase();
      await apiPost("/api/discounts", await o.token(), { code, type: "percent", value: 10, usageLimit: 1, active: true });
      const used = async () => { const all = await apiFetch<{ code: string; usedCount?: number }[]>("/api/discounts", await o.token()); return all.find((c) => c.code === code)?.usedCount ?? 0; };
      const x = await booked({ tag: "cn025", offset: 8, paid: false, extra: { discountCode: code } });
      const b0 = await opBooking(x.ref);
      expect(b0.amount).toBe(48.6);
      expect(await used()).toBe(1);
      await opOpen(x.child);
      await opClick(/^Cancel booking$/);
      await opg.getByText("No refund", { exact: true }).click();
      await opClick(/Confirm cancellation/);
      await expect.poll(async () => (await opBooking(x.ref)).status, { timeout: 30_000 }).toBe("Cancelled");
      await expect.poll(used, { timeout: 30_000 }).toBe(0);
      await opg.goto(`/${PORTAL[kind]}/bookings`);
      await opg.getByText(x.child, { exact: true }).first().waitFor();
      await snap(opg, "CN-025");
      const z = await booked({ tag: "cn025c", offset: 8, paid: false, extra: { discountCode: code } });
      const b2 = await opBooking(z.ref);
      expect(b2.amount).toBe(48.6);
      return `[screenshot after load + API] one-use 10% code: first booking £48.60 (usedCount=1); operator cancelled it via UI -> usedCount=0; code applied again on a new booking (£${b2.amount})`;
    });
    await check("CN-026", kind, () => opg, async () => {
      const x = await booked({ tag: "cn026a", offset: 8, lst: { cap: 1, waitlist: true, wmode: "auto" } as any });
      const t2 = await p2.token();
      const doc = await apiFetch<{ blocks: { id: string; sessions?: { date: string }[] }[] }>(`/api/listings/${x.l.id}`, t2);
      const dates = (doc.blocks[0].sessions ?? []).map((s) => s.date).sort().slice(0, 3);
      const q = await apiPost<{ bookings: Record<string, any>[] }>("/api/my/bookings", t2, { listingId: x.l.id, blockId: doc.blocks[0].id, method: "card", walletCap: 0, items: [{ pass: "3 days", child: kid("cn026b"), age: 8, dates }] });
      expect(q.bookings[0].status).toBe("Waitlisted");
      const cnt = async () => (await apiFetch<{ blocks: { bookedCount: number }[] }>(`/api/listings/${x.l.id}`, await o.token())).blocks[0].bookedCount;
      const before = await cnt();
      await opOpen(x.child);
      await opClick(/^Cancel booking$/);
      await opg.getByText("We cancelled it").click();
      await opClick(/Confirm cancellation/);
      await expect.poll(async () => (await opBooking(x.ref)).status, { timeout: 30_000 }).toBe("Cancelled");
      await expect.poll(async () => (await opBooking(q.bookings[0].ref)).status, { timeout: 40_000 }).toMatch(/Offered|Confirmed/);
      const after = await cnt();
      const qb = await opBooking(q.bookings[0].ref);
      const bell = (await notifs(p2)).filter((n) => /place/i.test(n.title));
      await opg.goto(`/${PORTAL[kind]}/bookings`);
      await opg.getByText(kind === "fr" ? kind : kind).first().waitFor().catch(() => {});
      await opg.getByText(qb.child ?? "cn026b", { exact: false }).first().waitFor({ timeout: 20_000 }).catch(() => {});
      await snap(opg, "CN-026");
      return `[screenshot after load + API] capacity 1, second family Waitlisted. Operator cancelled the holder via UI: block bookedCount ${before} -> ${after}; queued booking now "${qb.status}" (auto waitlist); family bell: ${bell[0]?.title ?? "none"}`;
    });
    await check("CN-031", kind, () => opg, async () => {
      await setSettings(o, { allowCardRefund: false });
      try {
        const w0 = await wallet(parent);
        const x = await booked({ tag: "cn031", offset: 8 });
        await pCancelApi(parent, x.ref, { refundPref: "card" }); await waitCancel(x.ref);
        await opOpen(x.child);
        const label = await opg.getByRole("button", { name: /Accept refund|Approve refund|Mark refund/ }).first().innerText();
        await snap(opg, "CN-031");
        await opClick(/Accept refund|Approve refund|Mark refund/);
        await expect.poll(async () => (await opBooking(x.ref)).cancel?.refundVia, { timeout: 30_000 }).toBeTruthy();
        const b = await opBooking(x.ref);
        const w1 = await wallet(parent);
        expect(w1 - w0).toBe(54);
        expect(b.cancel.refundVia).toBe("wallet");
        return `[screenshot after load + API] Setup 'money back to card' off: operator button "${label}"; on approve wallet ${w0} -> ${w1} (+54), refundVia=${b.cancel.refundVia}, no card refund`;
      } finally { await setSettings(o, { allowCardRefund: true }); }
    });
    await check("CN-032", kind, () => opg, async () => {
      await setSettings(o, { refundLetCustomerChoose: true });
      const pp = await loginPage(parent, /custdash/);
      try {
        const x = await booked({ tag: "cn032", offset: 8 });
        await pp.goto("/custdash/bookings");
        const card = cardWith(pp, x.child);
        await expect(card).toBeVisible({ timeout: 30_000 });
        const btn = card.getByRole("button", { name: /Cancel booking/ });
        if (!(await btn.isVisible().catch(() => false))) await card.getByText(x.child).first().click();
        await btn.click();
        await expect(card.getByText("Send my £54.00 refund to")).toBeVisible();
        await expect(card.getByRole("button", { name: /Wallet credit/ })).toBeVisible();
        await expect(card.getByRole("button", { name: /Back to card/ })).toBeVisible();
        await card.getByRole("button", { name: /Wallet credit/ }).click();
        await snap(pp, "CN-032");
        await card.getByRole("button", { name: "Send cancellation request" }).click();
        await waitCancel(x.ref);
        const b = await opBooking(x.ref);
        expect(b.cancel.refundTo).toBe("wallet");
        return `[screenshot of the family's cancel panel after load + API] chooser "Send my £54.00 refund to" shows Wallet credit and Back to card; picked wallet -> cancel.refundTo=${b.cancel.refundTo}`;
      } finally { await pp.context().close(); }
    });
    await check("CN-033", kind, () => opg, async () => {
      await opg.setViewportSize({ width: 1280, height: 1000 });
      await opg.goto(`/${PORTAL[kind]}/setup?tab=cancel`);
      const lbl = opg.getByText(/When a refund is due/i).first();
      await expect(lbl).toBeVisible({ timeout: 60_000 });
      const sel = opg.locator("select").filter({ has: opg.locator("option", { hasText: /Flag it for me/ }) }).first();
      const opts = (await sel.locator("option").allInnerTexts()).map((s) => s.trim());
      await sel.selectOption("auto");
      await opg.waitForTimeout(1000);
      await lbl.scrollIntoViewIfNeeded();
      await snap(opg, "CN-033");
      const txt = await opg.locator("body").innerText();
      expect(txt).not.toMatch(/\(Amir\)|needs building/i);
      const note = (txt.match(/[^\n]*Not available yet[^\n]*/i) ?? [""])[0];
      expect(opts.join("|")).toMatch(/Flag it for me/); expect(opts.join("|")).toMatch(/Issue it automatically/);
      return `[screenshot after load] /${PORTAL[kind]}/setup?tab=cancel: 'When a refund is due' offers [${opts.join(" | ")}]; choosing 'Issue it automatically' shows "${note.trim()}"; no '(Amir)' / 'needs building' developer text anywhere on the page`;
    });
  });
}

// ===================================================================== LT / RD / ME
let listingByKind: Partial<Record<Kind, L>> = {};
const ukPcPlaceholder = "e.g. 07700 900123";
const monRe = (d: Date) => new RegExp("^Mon\\s*" + d.getDate() + "$", "i");
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = new Date();
const nextMonday = addDays(today, (8 - today.getDay()) % 7 || 7);
const sd = (w: number, d: number) => iso(addDays(nextMonday, w * 7 + d));

async function mkStandard(a: Acct, title: string, extra: Record<string, unknown> = {}, noVenue = false) {
  const t = await a.token();
  const lib = ((await apiFetch<Record<string, unknown> | null>("/api/library", t)) ?? {}) as { venues?: { id: string }[]; settings?: Record<string, unknown> };
  const vid = "gap-venue";
  await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ venues: (lib.venues ?? []).some((v) => v.id === vid) ? lib.venues : [...(lib.venues ?? []), { id: vid, name: "Gap Hall", address: "1 Test Way", city: "Northampton" }], settings: { ...(lib.settings ?? {}), marketplaceListed: true } }) });
  const period = await apiPost<{ id: string }>("/api/periods", t, { title: "Full day", start: "09:00", finish: "15:00" });
  const p1 = (await apiPost<{ id: string }>("/api/passes", t, { name: "1 day", days: 1 })).id;
  const p3 = (await apiPost<{ id: string }>("/api/passes", t, { name: "3 days", days: 3 })).id;
  const p5 = (await apiPost<{ id: string }>("/api/passes", t, { name: "5 days", days: 5 })).id;
  const bundle = await apiPost<{ id: string }>("/api/block-bundles", t, { name: `Standard ${title}`, periodIds: [period.id], passIds: [p1, p3, p5], priced: true, masterPrice: 90, calcOn: false, passFlat: { [p1]: 20, [p3]: 54, [p5]: 90 }, periodPrice: { [`${p1}_${period.id}`]: 20, [`${p3}_${period.id}`]: 54, [`${p5}_${period.id}`]: 90 } });
  const l = await apiPost<{ id: string; tenantId: string }>("/api/listings", t, {
    title, ...(noVenue ? {} : { venueId: vid }), runFrom: iso(nextMonday), runTo: iso(addDays(nextMonday, 20)), blockMode: "weekly", days: [1, 2, 3, 4, 5],
    maxAttendees: "10", capacityScope: "day", allowOutsideAge: false, showSpaces: true, ageFrom: "5", ageTo: "11", blockId: bundle.id,
    passes: [{ name: "1 day", price: 20, days: 1 }, { name: "3 days", price: 54, days: 3 }, { name: "5 days", price: 90, days: 5 }],
    bookingType: "auto", waitlist: true, waitlistMode: "manual", cancellationPolicyId: "standard", status: "live", visibility: "public", ...extra,
  });
  await apiFetch(`/api/block-bundles/${bundle.id}/listings`, t, { method: "PUT", body: JSON.stringify({ listingIds: [l.id] }) });
  const full = await apiFetch<{ blocks: { id: string; startDate: string }[] }>(`/api/listings/${l.id}`, t);
  const blocks = full.blocks.sort((a2, c) => (a2.startDate < c.startDate ? -1 : 1));
  return { id: l.id, title, tenantId: l.tenantId, blockId: blocks[0].id, blocks, doc: full as Record<string, any> };
}
async function uiToPay(p: Page, childName: string) {
  await p.getByText(/Tap a week/).first().waitFor({ timeout: 45_000 });
  await p.getByRole("button", { name: monRe(nextMonday) }).first().click();
  await p.getByRole("button", { name: /ADD 5 DAYS TO BASKET/i }).click();
  await p.getByRole("button", { name: /NEXT — ADD CHILDREN/i }).click();
  await p.getByRole("button", { name: new RegExp(`Add ${childName} to this booking`) }).click();
  await p.getByRole("button", { name: "Next", exact: true }).click();
  await p.getByPlaceholder(ukPcPlaceholder).waitFor({ timeout: 45_000 });
}
const settle = async (page: Page, waits: (string | RegExp)[] = []) => {
  for (const w of waits) await page.getByText(w).first().waitFor({ state: "visible", timeout: 45_000 });
  await page.waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.innerText), null, { timeout: 45_000 }).catch(() => {});
};

test("LT-001 LT-002 as company + franchise", async () => {
  test.setTimeout(1_200_000);
  for (const kind of ["co", "fr"] as Kind[]) {
    K = kind; opg = pages[kind]!;
    const a = A[kind]!;
    await check("LT-001", kind, () => opg, async () => {
      const title = `Standard test camp ${kind} ${stamp}`;
      const L = await mkStandard(a, title);
      listingByKind[kind] = L as any;
      const d = L.doc;
      expect(d.status).toBe("live"); expect(d.visibility).toBe("public"); expect(d.bookingType).toBe("auto");
      expect(String(d.maxAttendees)).toBe("10"); expect(d.capacityScope).toBe("day"); expect(d.waitlist).toBe(true); expect(d.waitlistMode).toBe("manual"); expect(d.cancellationPolicyId).toBe("standard");
      const sessions = L.blocks.reduce((n, b: any) => n + (b.sessions?.length ?? 0), 0);
      expect(L.blocks.length).toBe(3); expect(sessions).toBe(15);
      // operator card
      await opg.goto(`/${PORTAL[kind]}/listings`);
      const card = opg.locator('[data-ui="card"]').filter({ hasText: title }).last();
      await expect(card).toBeVisible({ timeout: 60_000 });
      await settle(opg);
      const cardTxt = (await card.innerText()).replace(/\s+/g, " ");
      await snap(opg, "LT-001", ".operator");
      expect(cardTxt).toMatch(/Published|Live/i);
      // customer page in a private (logged-out) window
      const anon = await theBrowser.newContext({ viewport: { width: 1280, height: 1000 } });
      const pg = await anon.newPage();
      await pg.goto(`${WEB_URL}/book/${L.id}`);
      await settle(pg, [title]);
      const bodyTxt = (await pg.locator("body").innerText()).replace(/\s+/g, " ");
      await snap(pg, "LT-001");
      await anon.close();
      for (const s of ["£20", "£54", "£90"]) expect(bodyTxt, `customer page shows ${s}`).toContain(s);
      expect(bodyTxt).toMatch(/1 day/i); expect(bodyTxt).toMatch(/3 days/i); expect(bodyTxt).toMatch(/5 days/i);
      return `[screenshot after load + API doc] Standard test camp (listing created through the same /api/listings the wizard publishes to, NOT clicked through the 13-step wizard): doc status live, public, auto, 10 per day, waitlist manual, Standard policy, 3 weekly blocks / 15 sessions, passes 20/54/90. Operator card: "${cardTxt.slice(0, 160)}". Logged-out customer page shows 1 day £20, 3 days £54, 5 days £90.`;
    });
    await check("LT-002", kind, () => opg, async () => {
      const title = `Venue camp ${kind} ${stamp}`;
      const L = await mkStandard(a, title);
      const d = L.doc;
      expect(d.venueId).toBe("gap-venue"); expect(d.deliveryMode ?? "venue").toBe("venue");
      const nm = `Ven${kind}${stamp}`;
      await apiPost("/api/my/children", await parent.token(), { name: nm, dob: "2017-03-04" });
      const ctx = await theBrowser.newContext({ viewport: { width: 1280, height: 1200 } });
      const lp = await ctx.newPage();
      await lp.goto(`${WEB_URL}/login`);
      await lp.getByPlaceholder("you@example.com").fill(parent.email);
      await lp.locator('input[type="password"]').fill(TEST_PASSWORD);
      await lp.getByRole("button", { name: "Sign in", exact: true }).click();
      await lp.waitForURL(/custdash/, { timeout: 60_000 });
      await lp.goto(`${WEB_URL}/book/${L.id}`);
      await settle(lp, ["Gap Hall"]);
      const pageTxt = (await lp.locator("body").innerText()).replace(/\s+/g, " ");
      expect(pageTxt.toLowerCase()).toContain("gap hall"); expect(pageTxt).toContain("1 Test Way");
      await uiToPay(lp, nm);
      await settle(lp);
      const payTxt = (await lp.locator("body").innerText()).replace(/\s+/g, " ");
      await snap(lp, "LT-002");
      await ctx.close();
      expect(payTxt).not.toMatch(/visit address|we.ll come to you|House number and street/i);
      // booking made without a visit address
      const sess = await apiFetch<{ blocks: { id: string }[] }>(`/api/listings/${L.id}`, await parent.token());
      const r = await apiPost<{ bookings: Record<string, any>[] }>("/api/my/bookings", await parent.token(), { listingId: L.id, blockId: sess.blocks[0].id, method: "card", walletCap: 0, items: [{ pass: "1 day", child: `V2${kind}${stamp}`, age: 8, dates: [sd(0, 0)] }] });
      const b = await apiFetch<Record<string, any>>(`/api/bookings/${r.bookings[0].ref}`, await a.token());
      expect(b.serviceAddress ?? null).toBeNull();
      return `[screenshot of the checkout Pay step after load + API] venue listing (venueId ${d.venueId}, deliveryMode ${d.deliveryMode ?? "absent=venue"}): customer page shows "Gap Hall" and "1 Test Way"; the checkout Pay step has no visit-address fields/text; a booking made without an address succeeded (${b.ref}) with no serviceAddress`;
    });
  }
});

test("LT-003 as company", async () => {
  test.setTimeout(600_000);
  K = "co"; opg = pages.co!;
  await check("LT-003", "co", () => opg, async () => {
    const a = A.co!;
    const title = `Gap home visit ${stamp}`;
    const L = await mkStandard(a, title, { deliveryMode: "home-visit", venueId: null, coverageArea: { mode: "postcodePrefixes", postcodePrefixes: ["SW1", "SW2"] }, minGapMinutes: 30 }, true);
    const d = L.doc;
    expect(d.deliveryMode).toBe("home-visit"); expect(d.coverageArea.mode).toBe("postcodePrefixes"); expect(d.coverageArea.postcodePrefixes).toEqual(["SW1", "SW2"]); expect(d.venueId ?? null).toBeNull();
    // operator wizard shows coverage
    await opg.goto(`/company/listings`);
    const card = opg.locator('[data-ui="card"]').filter({ hasText: title }).last();
    await expect(card).toBeVisible({ timeout: 60_000 });
    await card.getByRole("button", { name: "Edit" }).click();
    await opg.getByText(/^Step 1 of 13/).waitFor({ timeout: 45_000 });
    await opg.getByRole("button", { name: /^Next/ }).click(); await opg.waitForTimeout(800);
    await opg.getByText("Coverage area").first().waitFor({ timeout: 45_000 });
    await opg.getByText("SW1").first().waitFor({ timeout: 20_000 }).catch(() => {});
    await snap(opg, "LT-003", ".wizard");
    // parent UI: N1 9GU refused
    const nm = `Hom${stamp}`;
    await apiPost("/api/my/children", await parent.token(), { name: nm, dob: "2017-03-04" });
    const ctx = await theBrowser.newContext({ viewport: { width: 1280, height: 1200 } });
    const p = await ctx.newPage();
    await p.goto(`${WEB_URL}/login`);
    await p.getByPlaceholder("you@example.com").fill(parent.email);
    await p.locator('input[type="password"]').fill(TEST_PASSWORD);
    await p.getByRole("button", { name: "Sign in", exact: true }).click();
    await p.waitForURL(/custdash/, { timeout: 60_000 });
    await p.goto(`${WEB_URL}/book/${L.id}`);
    await uiToPay(p, nm);
    await p.getByPlaceholder(ukPcPlaceholder).fill("07700900123");
    await p.getByPlaceholder("House number and street").fill("1 Islington High St");
    await p.getByPlaceholder("Postcode").fill("N1 9GU");
    await p.locator("button:visible").filter({ hasText: /^(Pay|Book|Confirm|Complete|Reserve|Place|Add)/i }).last().click();
    await p.getByText(/outside|coverage/i).first().waitFor({ timeout: 45_000 });
    const refusedTxt = (await p.getByText(/outside|coverage/i).first().innerText()).replace(/\s+/g, " ");
    await snap(p, "LT-003", ".refused");
    await ctx.close();
    // API: N1 refused (no booking), SW1A accepted with address + postcode
    const doc = await apiFetch<{ blocks: { id: string }[] }>(`/api/listings/${L.id}`, await parent.token());
    const before = (await apiFetch<any[]>("/api/bookings", await a.token())).length;
    const bad = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/my/bookings`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await parent.token()}` }, body: JSON.stringify({ listingId: L.id, blockId: doc.blocks[0].id, method: "card", walletCap: 0, items: [{ pass: "1 day", child: `HomBad${stamp}`, age: 8, dates: [sd(0, 0)] }], serviceAddress: { address: "1 Islington High St", postcode: "N1 9GU" } }) });
    const badJson = await bad.json() as { error?: string };
    expect(bad.status).toBe(409); expect(badJson.error ?? "").toMatch(/outside|coverage/i);
    const afterBad = (await apiFetch<any[]>("/api/bookings", await a.token())).length;
    expect(afterBad).toBe(before);
    const ok = await apiPost<{ bookings: Record<string, any>[] }>("/api/my/bookings", await parent.token(), { listingId: L.id, blockId: doc.blocks[0].id, method: "card", walletCap: 0, items: [{ pass: "1 day", child: `HomOk${stamp}`, age: 8, dates: [sd(0, 1)] }], serviceAddress: { address: "10 Downing St", postcode: "SW1A 1AA" } });
    const bo = await apiFetch<Record<string, any>>(`/api/bookings/${ok.bookings[0].ref}`, await a.token());
    expect(bo.serviceAddress?.postcode).toBe("SW1A 1AA");
    await opg.goto(`/company/bookings`);
    await opg.getByText(`HomOk${stamp}`, { exact: true }).first().waitFor({ timeout: 45_000 });
    await snap(opg, "LT-003", ".booked");
    return `[screenshots after load + API] home-visit listing, no venue, postcodePrefixes SW1,SW2, wizard Coverage area step shows them; parent checkout with N1 9GU refused in the UI ("${refusedTxt.slice(0, 120)}") and by the API (409 "${badJson.error}", booking count unchanged ${before}->${afterBad}); SW1A 1AA booked (${bo.ref}) with serviceAddress.postcode ${bo.serviceAddress.postcode}`;
  });
});

test("RD-001 ME-004 ME-005 company + franchise", async () => {
  test.setTimeout(1_200_000);
  for (const kind of ["co", "fr"] as Kind[]) {
    K = kind; opg = pages[kind]!;
    const a = A[kind]!;
    const reg = kind === "co" ? "/company/admin-registers" : `/${PORTAL[kind]}/registers`;
    let rdChild = "";
    await check("RD-001", kind, () => opg, async () => {
            const x = await booked({ tag: "rd001", offset: 0 });
      rdChild = x.child;
      const todayIso = x.dates[0];
      expect(todayIso).toBe(plus(0));
      const rows = JSON.stringify(await apiFetch(`/api/registers?date=${todayIso}`, await a.token()));
      expect(rows).toContain(x.child);
      await opg.goto(reg);
      await expect(opg.getByLabel("Previous day")).toBeVisible({ timeout: 90_000 });
      const lt = `Gap rd001 ${kind} ${stamp}`;
      if (!(await opg.getByText(lt).first().isVisible().catch(() => false))) {
        await opg.getByLabel("Choose listing").click();
        await opg.getByPlaceholder("Search listings or venues…").fill(lt);
        await opg.getByRole("button", { name: lt }).click();
      }
      await opg.locator('input[type="date"]').fill(todayIso);
      const row = opg.locator('[data-ui="card"]').filter({ hasText: x.child }).last();
      await expect(row).toBeVisible({ timeout: 45_000 });
      const rowTxt = (await row.innerText()).replace(/\s+/g, " ");
      await snap(opg, "RD-001");
      const hdr = (await opg.locator("body").innerText()).replace(/\s+/g, " ");
      expect(hdr).toMatch(/0 of 1 signed in/i); expect(hdr).toMatch(/1 not arrived/i);
      return `[screenshot after load + API] confirmed booking for today (${todayIso}): /api/registers contains the child; ${reg} with listing + today's date shows the child's row "${rowTxt.slice(0, 140)}" with header "0 of 1 signed in / 1 not arrived" (the not-yet-arrived = Due state, In button available)`;
    });
    const since = new Date(Date.now() - 2000).toISOString();
    let meRef = "", meChild = "", meL = "";
    await check("ME-004", kind, () => opg, async () => {
      const x = await booked({ tag: "me004", offset: 8, paid: false });
      meRef = x.ref; meChild = x.child; meL = x.l.title;
      await expect.poll(async () => (await notifs(a)).filter((n) => (n.title + n.body).includes(x.ref)).length, { timeout: 40_000 }).toBeGreaterThan(0);
      const n = (await notifs(a)).filter((z) => (z.title + z.body).includes(x.ref));
      const b = await opBooking(x.ref);
      expect(n.map((z) => z.title).join("|")).toMatch(/New booking/i);
      await opg.goto(`/${PORTAL[kind]}/bookings`);
      await settle(opg);
      // open the bell
      const bell = opg.locator('button[aria-label*="otification" i], button[title*="otification" i], button[aria-label*="bell" i]').first();
      if (await bell.isVisible().catch(() => false)) await bell.click(); else await opg.getByRole("button").filter({ hasText: /^\d+$/ }).first().click().catch(() => {});
      await opg.waitForTimeout(1500);
      await opg.getByText(x.ref).first().waitFor({ timeout: 20_000 }).catch(() => {});
      await snap(opg, "ME-004");
      const mails = mailRows(a.email, since);
      const full = n.map((z) => `${z.title} :: ${z.body}`).join(" || ").slice(0, 380);
      return `[screenshot of bell after load + API notifications + mailLog] booking ${x.ref} (£${b.amount}) -> provider notifications: ${full}. Emails to ${a.email} since the booking: ${mails.map((m) => `"${m.subject}" (${m.status})`).join("; ") || "none logged"}`;
    });
    await check("ME-005", kind, () => opg, async () => {
      expect(meRef, "needs ME-004 booking").toBeTruthy();
      await opAct(meRef, { type: "paid" });
      await pCancelApi(parent, meRef, { refundPref: "card" }); await waitCancel(meRef);
      await expect.poll(async () => (await notifs(a)).filter((n) => (n.title + n.body).includes(meRef) && /cancel|refund/i.test(n.title + n.body)).length, { timeout: 40_000 }).toBeGreaterThan(0);
      const n = (await notifs(a)).filter((z) => (z.title + z.body).includes(meRef) && /cancel|refund/i.test(z.title + z.body));
      const b = await opBooking(meRef);
      await opg.goto(`/${PORTAL[kind]}/bookings`);
      await settle(opg);
      const bell = opg.locator('button[aria-label*="otification" i], button[title*="otification" i], button[aria-label*="bell" i]').first();
      if (await bell.isVisible().catch(() => false)) await bell.click(); else await opg.getByRole("button").filter({ hasText: /^\d+$/ }).first().click().catch(() => {});
      await opg.waitForTimeout(1500);
      await opg.getByText(meRef).first().waitFor({ timeout: 20_000 }).catch(() => {});
      await snap(opg, "ME-005");
      const full = n.map((z) => `${z.title} :: ${z.body}`).join(" || ");
      expect(full).toMatch(/card|wallet|scheme|refund/i);
      expect(full).toMatch(/£54|54\.00|54/);
      return `[screenshot of bell after load + API notifications] parent cancelled ${meRef} asking for the card refund (cancel.amount=${b.cancel.amount}, refundTo=${b.cancel.refundTo}) -> provider notification: ${full.slice(0, 500)}`;
    });
  }
});
