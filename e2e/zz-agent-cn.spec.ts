import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { ROOT, WEB_URL } from "./helpers/env";
import { DEFAULT_POLICIES } from "../lib/cancellation";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, apiFetch, apiPost, fbSignIn, fbSignUp } from "./helpers/accounts";

// The shared dev API restarts under `tsx watch` whenever anyone edits server code: retry connection-level failures.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (...a: Parameters<typeof fetch>) => {
  for (let i = 0; ; i++) {
    try { return await realFetch(...a); } catch (e) { if (i >= 8) throw e; await new Promise((r) => setTimeout(r, 3000)); }
  }
}) as typeof fetch;
test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 30_000, navigationTimeout: 60_000 });
const stamp = Date.now().toString(36);
const SHOTS = path.join(ROOT, "e2e/review/shots/cn");
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const plus = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

type Acct = { email: string; uid: string; tenantId?: string; token: () => Promise<string> };
let parent: Acct, op: Acct;
const tok = (email: string) => async () => (await fbSignIn(email)).idToken;

async function mkParent(tag: string): Promise<Acct> {
  const email = `e2e-cn-${tag}-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  await apiPost("/api/register-role", s.idToken, { role: "parent", postcode: "NN5 7EA" });
  await apiPost("/api/me/welcome", s.idToken, {});
  return { email, uid: s.uid, token: tok(email) };
}
async function mkOp(): Promise<Acct> {
  const email = `e2e-cn-op-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  const name = `CN Co ${stamp}`;
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role: "company", businessName: name, providerName: name, providerNameMode: "business" });
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", r.tenantId], { stdio: "pipe" });
  return { email, uid: s.uid, tenantId: r.tenantId, token: tok(email) };
}
async function uiCtx(browser: Browser, a: Acct, home: RegExp): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${WEB_URL}/login`);
  await page.getByPlaceholder("you@example.com").fill(a.email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(home, { timeout: 45_000 });
  return { ctx, page };
}
export const shot = (page: Page, id: string) => page.screenshot({ path: path.join(SHOTS, `${id}.png`), fullPage: true });

async function setSettings(a: Acct, patch: Record<string, unknown>) {
  const t = await a.token();
  const lib = ((await apiFetch<Record<string, unknown> | null>("/api/library", t)) ?? {}) as { settings?: Record<string, unknown> };
  await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ settings: { ...(lib.settings ?? {}), ...patch } }) });
}

interface L { id: string; title: string; runFrom: string; tenantId: string }
async function mkListing(a: Acct, o: { title: string; offset: number; price?: number; passDays?: number; policy?: string; cap?: number; waitlist?: boolean; wmode?: "manual" | "auto"; runDays?: number; passName?: string }): Promise<L> {
  const t = await a.token();
  const lib = ((await apiFetch<Record<string, unknown> | null>("/api/library", t)) ?? {}) as { venues?: { id: string }[]; settings?: Record<string, unknown> };
  const vid = "cn-venue";
  await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ venues: (lib.venues ?? []).some((v) => v.id === vid) ? lib.venues : [...(lib.venues ?? []), { id: vid, name: "CN Hall", address: "1 Test Way", city: "Northampton" }], settings: { ...(lib.settings ?? {}), marketplaceListed: true } }) });
  const passName = o.passName ?? "3 days";
  const period = await apiPost<{ id: string }>("/api/periods", t, { title: "Full day", start: "09:00", finish: "15:30" });
  const pass = await apiPost<{ id: string }>("/api/passes", t, { name: passName, days: o.passDays ?? 3 });
  const price = o.price ?? 54;
  const bundle = await apiPost<{ id: string }>("/api/block-bundles", t, { name: `CN Block ${o.title}`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: price, calcOn: true });
  const from = plus(o.offset), to = plus(o.offset + (o.runDays ?? 6));
  const l = await apiPost<{ id: string; tenantId: string }>("/api/listings", t, {
    title: o.title, venueId: vid, runFrom: from, runTo: to, blockMode: "custom", days: [0, 1, 2, 3, 4, 5, 6],
    maxAttendees: String(o.cap ?? 16), capacityScope: "day", ...(o.waitlist ? { waitlist: true, waitlistMode: o.wmode ?? "manual" } : {}), showSpaces: true, ageFrom: "5", ageTo: "12",
    blockId: bundle.id, passes: [{ name: passName, price, days: o.passDays ?? 3 }], bookingType: "auto", status: "live", visibility: "public",
    ...(o.policy ? { cancellationPolicyId: o.policy } : {}),
  });
  await apiFetch(`/api/block-bundles/${bundle.id}/listings`, t, { method: "PUT", body: JSON.stringify({ listingIds: [l.id] }) });
  return { id: l.id, title: o.title, runFrom: from, tenantId: l.tenantId };
}
async function book(p: Acct, l: L, o: { child: string; days?: number; method?: string; extra?: Record<string, unknown>; passName?: string; dates?: string[] }) {
  const t = await p.token();
  const doc = await apiFetch<{ blocks: { id: string; sessions?: { date: string }[] }[] }>(`/api/listings/${l.id}`, t);
  const sessions = (doc.blocks[0].sessions ?? []).map((s) => s.date).sort();
  const dates = o.dates ?? sessions.slice(0, o.days ?? 3);
  const res = await apiPost<{ bookings: Record<string, any>[] }>("/api/my/bookings", t, {
    listingId: l.id, blockId: doc.blocks[0].id, method: o.method ?? "card",
    items: [{ pass: o.passName ?? "3 days", child: o.child, age: 8, dates }], ...(o.extra ?? {}),
  });
  return { b: res.bookings[0], sessions };
}
const opBooking = async (ref: string) => apiFetch<Record<string, any>>(`/api/bookings/${ref}`, await op.token());
const myBookings = async (a: Acct) => apiFetch<Record<string, any>[]>(`/api/my/bookings`, await a.token());




// ---- results + helpers ----
import fs from "node:fs";
import { cardWith } from "./helpers/ui";
const OUT = "/private/tmp/claude-501/x/results.json";
const RESULTS: Record<string, { acct: string; status: string; note: string; shot?: string }> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const rec = (id: string, acct: string, status: "pass" | "fail" | "blocked", note: string) => {
  RESULTS[id] = { acct, status, note, shot: `e2e/review/shots/cn/${id}.png` };
  fs.writeFileSync(OUT, JSON.stringify(RESULTS, null, 1));
  console.log(`RESULT ${id} ${status} :: ${note}`);
};
/** Run a check; any thrown assertion becomes a recorded fail (evidence = first error line) and the run carries on. */
const SKIP = new Set((process.env.CN_SKIP ?? "").split(",").filter(Boolean));
async function check(id: string, acct: string, page: () => Page | undefined, fn: () => Promise<string>) {
  if (SKIP.has(id)) return;
  try {
    const note = await fn();
    rec(id, acct, "pass", note);
  } catch (e) {
    const msg = String((e as Error).message).split("\n").filter(Boolean).slice(0, 4).join(" | ").slice(0, 600);
    try { const pg = page(); if (pg) await shot(pg, id); } catch { /* ignore */ }
    rec(id, acct, "fail", msg);
  }
}
const money = (n: number) => `£${n.toFixed(2)}`;
let pp: Page, opg: Page; // parent + operator pages (UI)
const kid = (tag: string) => `${tag} ${stamp}`;
const markPaid = async (ref: string) => apiPost(`/api/bookings/${ref}/actions`, await op.token(), { type: "paid" });
const opAct = async (ref: string, body: Record<string, unknown>) => apiPost(`/api/bookings/${ref}/actions`, await op.token(), body);
const pCancelApi = async (a: Acct, ref: string, body: Record<string, unknown> = {}) => apiPost<Record<string, any>>(`/api/my/bookings/${ref}/cancel`, await a.token(), body);
const notifs = async (a: Acct) => (await apiFetch<{ notifications: { title: string; body: string }[] }>("/api/notifications", await a.token())).notifications;
const wallet = async (a: Acct) => { const w = await apiFetch<{ balances: { balance?: number }[] }>("/api/my/wallet", await a.token()); return w.balances.reduce((n, x) => n + (x.balance ?? 0), 0); };
const listingDoc = async (id: string) => apiFetch<{ blocks: { id: string; bookedCount: number; dayCounts?: Record<string, number> }[] }>(`/api/listings/${id}`, await op.token());

async function pCancelUi(child: string) {
  await pp.goto("/custdash/bookings");
  const card = cardWith(pp, child);
  await expect(card).toBeVisible({ timeout: 30_000 });
  const btn = card.getByRole("button", { name: /Cancel booking/ });
  if (!(await btn.isVisible().catch(() => false))) await card.getByText(child).first().click();
  await btn.click();
  await expect(pp.getByText("Request cancellation")).toBeVisible();
  return card;
}
const waitCancel = async (ref: string) => { await expect.poll(async () => ((await opBooking(ref)).cancel ? 1 : 0), { timeout: 30_000 }).toBe(1); };
async function opOpen(child: string) {
  await opg.goto("/company/bookings");
  await opg.getByText(child, { exact: true }).first().click();
  await expect(opg.getByRole("button", { name: /Cancel booking|Approve refund|Accept refund|Decline refund/ }).first()).toBeVisible({ timeout: 30_000 });
}
async function booked(o: { tag: string; offset: number; paid?: boolean; method?: string; extra?: Record<string, unknown>; who?: Acct; lst?: Parameters<typeof mkListing>[1]; dates?: (s: string[]) => string[] }) {
  const child = kid(o.tag);
  const l = await mkListing(op, { title: `CN ${o.tag} ${stamp}`, offset: o.offset, ...(o.lst ?? {}) });
  const who = o.who ?? parent;
  const t = await who.token();
  const doc = await apiFetch<{ blocks: { id: string; sessions?: { date: string }[] }[] }>(`/api/listings/${l.id}`, t);
  const sessions = (doc.blocks[0].sessions ?? []).map((x) => x.date).sort();
  const dates = o.dates ? o.dates(sessions) : sessions.slice(0, 3);
  const res = await apiPost<{ bookings: Record<string, any>[] }>("/api/my/bookings", t, {
    listingId: l.id, blockId: doc.blocks[0].id, method: o.method ?? "card", walletCap: 0,
    items: [{ pass: "3 days", child, age: 8, dates }], ...(o.extra ?? {}),
  });
  const b = res.bookings[0];
  if (o.paid !== false) await markPaid(b.ref);
  return { child, l, ref: b.ref as string, dates };
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(700_000);
  parent = await mkParent("p");
  op = await mkOp();
  pp = (await uiCtx(browser, parent, /custdash/)).page;
  opg = (await uiCtx(browser, op, /company/)).page;
  // A provider who has opened Setup has the seeded default policies saved; a brand-new one has none (see report) - mimic the former.
  await setSettings(op, { cancellationPolicies: DEFAULT_POLICIES, allowCardRefund: true, refundLetCustomerChoose: true, noRefundCredit: false, allowPartialCancel: true, partialAllowRefund: true, partialAllowWallet: true, partialAllowChangeDate: false, allowDateChanges: true });
  // Seed the public library once so we know what the parent sees.
  const lib = await apiFetch<{ settings?: Record<string, any> }>(`/api/public/library/${op.tenantId}`, null).catch(() => null);
  console.log("PUBLIC LIB policies:", lib?.settings?.cancellationPolicies?.length, "keys:", Object.keys(lib?.settings ?? {}).length);
});

test("CN-001..003", async () => {
  test.setTimeout(400_000);
  await check("CN-001", "parent", () => pp, async () => {
    const x = await booked({ tag: "cn001", offset: 8 });
    const card = await pCancelUi(x.child);
    await expect(card.getByText(/entitled to a full refund of £54\.00/)).toBeVisible();
    await shot(pp, "CN-001");
    await card.getByRole("button", { name: "Send cancellation request" }).click();
    await waitCancel(x.ref);
    const b = await opBooking(x.ref);
    expect(b.status).toBe("Cancelled"); expect(b.cancel.refund).toBe("full"); expect(b.cancel.amount).toBe(54);
    const ld = await listingDoc(x.l.id);
    expect(ld.blocks[0].bookedCount).toBe(0);
    const n = (await notifs(op)).filter((z) => (z.title + z.body).includes(x.ref));
    expect(n.length).toBeGreaterThan(0);
    return `UI said full refund £54.00; cancel.refund=${b.cancel.refund} amount=${b.cancel.amount} refundTo=${b.cancel.refundTo}; block bookedCount back to 0; provider bell raised (${n[0].title})`;
  });
  await check("CN-002", "parent", () => pp, async () => {
    const x = await booked({ tag: "cn002", offset: 4 });
    const card = await pCancelUi(x.child);
    await expect(card.getByText(/entitled to a 50% refund — £27\.00/)).toBeVisible();
    await shot(pp, "CN-002");
    await card.getByRole("button", { name: "Send cancellation request" }).click();
    await waitCancel(x.ref);
    const b = await opBooking(x.ref);
    expect(b.cancel.refund).toBe("partial"); expect(b.cancel.amount).toBe(27);
    return `UI: 50% refund £27.00; cancel.refund=partial amount=27`;
  });
  await check("CN-003", "parent", () => pp, async () => {
    const x = await booked({ tag: "cn003", offset: 1 });
    const card = await pCancelUi(x.child);
    await expect(card.getByText(/No refund is due/)).toBeVisible();
    await shot(pp, "CN-003");
    await card.getByRole("button", { name: "Send cancellation request" }).click();
    await waitCancel(x.ref);
    const b = await opBooking(x.ref);
    expect(b.cancel.refund).toBe("none"); expect(b.cancel.amount).toBe(0);
    return `UI: "No refund is due - inside no-refund window"; cancel.refund=none amount=0`;
  });
});

const sendReq = async (card: ReturnType<typeof cardWith>) => card.getByRole("button", { name: "Send cancellation request" }).click();
const opClick = async (name: RegExp | string) => opg.getByRole("button", { name }).first().click();

test("CN-004..008", async () => {
  test.setTimeout(500_000);
  await check("CN-004", "parent", () => pp, async () => {
    await setSettings(op, { noRefundCredit: true });
    const x = await booked({ tag: "cn004", offset: 1 });
    const w0 = await wallet(parent);
    const card = await pCancelUi(x.child);
    await expect(card.getByText(/No refund is due/)).toBeVisible();
    await expect(card.getByText(/full-value credit note/)).toBeVisible();
    await shot(pp, "CN-004");
    await sendReq(card); await waitCancel(x.ref);
    // the operator then settles (declines the £0 refund request or nothing to action) - see whether the credit note is ever credited
    const b = await opBooking(x.ref);
    const w1 = await wallet(parent);
    await setSettings(op, { noRefundCredit: false });
    expect(w1 - w0, `wallet moved ${w1 - w0} (credit note advertised as full value 54)`).toBe(54);
    return `credit note line shown; wallet +${w1 - w0}; cancel.refund=${b.cancel.refund}`;
  });
  await check("CN-005", "parent", () => pp, async () => {
    const x = await booked({ tag: "cn005", offset: 8 });
    const w0 = await wallet(parent);
    const card = await pCancelUi(x.child);
    await expect(card.getByText("Send my £54.00 refund to")).toBeVisible();
    await card.getByRole("button", { name: /Wallet credit/ }).click();
    await shot(pp, "CN-005");
    await sendReq(card); await waitCancel(x.ref);
    await opOpen(x.child);
    await shot(opg, "CN-005-op");
    await opClick(/Accept refund to wallet/);
    await expect.poll(async () => (await opBooking(x.ref)).pay, { timeout: 30_000 }).toMatch(/Refund/);
    const b = await opBooking(x.ref);
    const w1 = await wallet(parent);
    expect(w1 - w0).toBe(54);
    expect(b.cancel.refundVia).toBe("wallet");
    return `parent chose wallet; provider clicked "Accept refund to wallet"; wallet ${w0} -> ${w1} (+54); cancel.refundVia=wallet refundedApproved=${b.refundedApproved} pay=${b.pay}; no Stripe call`;
  });
  await check("CN-006", "company", () => opg, async () => {
    const x = await booked({ tag: "cn006", offset: 8 });
    const card = await pCancelUi(x.child);
    await sendReq(card); await waitCancel(x.ref);
    await opOpen(x.child);
    const label = await opg.getByRole("button", { name: /Approve refund|Accept refund/ }).first().innerText();
    await shot(opg, "CN-006");
    await opClick(/Approve refund|Accept refund/);
    await expect.poll(async () => (await opBooking(x.ref)).pay, { timeout: 30_000 }).toMatch(/Refund/);
    const b = await opBooking(x.ref);
    return `button label "${label}"; after click pay=${b.pay} refundVia=${b.cancel.refundVia} refundedAt=${!!b.cancel.refundedAt}; NO Stripe PaymentIntent exists (dev API has no STRIPE_SECRET_KEY, web has no publishable key) so a real card refund could not be exercised`;
  });
  await check("CN-007", "company", () => opg, async () => {
    const x = await booked({ tag: "cn007", offset: 8 });
    const card = await pCancelUi(x.child);
    await sendReq(card); await waitCancel(x.ref);
    await opOpen(x.child);
    await shot(opg, "CN-007");
    await opClick(/Decline refund/);
    await expect.poll(async () => (await opBooking(x.ref)).cancel?.refund, { timeout: 30_000 }).toBe("declined");
    const b = await opBooking(x.ref);
    const told = (await notifs(parent)).filter((n) => (n.title + n.body).includes(x.ref) && /declin/i.test(n.title + n.body));
    expect(told.length, "parent bell about the declined refund").toBeGreaterThan(0);
    return `cancel.refund=declined, pay=${b.pay}; parent told: ${told[0].title}`;
  });
});

test("CN-008..013", async () => {
  test.setTimeout(600_000);
  await setSettings(op, { voucherProviders: [{ id: "cnv", name: "CN Vouchers", details: [{ label: "Account", value: "CN-ACCT-1" }] }] });
  await check("CN-008", "parent", () => pp, async () => {
    const x = await booked({ tag: "cn008", offset: 8, extra: { voucherScheme: "cnv" }, paid: false, method: "Childcare voucher" });
    await markPaid(x.ref);
    expect((await opBooking(x.ref)).voucherScheme).toBe("CN Vouchers");
    const card = await pCancelUi(x.child);
    await expect(card.getByText(/can.t go back to a bank card/)).toBeVisible();
    await expect(card.getByText(/added to your wallet as credit/)).toBeVisible();
    await shot(pp, "CN-008");
    await sendReq(card); await waitCancel(x.ref);
    const b = await opBooking(x.ref);
    expect(b.cancel.refundTo).toBe("wallet");
    await opOpen(x.child);
    await opClick(/Accept refund to wallet|Mark refund reimbursed|Accept refund to bank/);
    await expect.poll(async () => (await opBooking(x.ref)).cancel?.refundVia, { timeout: 30_000 }).toBeTruthy();
    const b2 = await opBooking(x.ref);
    return `UI note: refund cannot go to bank card, goes to wallet; cancel.refundTo=wallet; on approve refundVia=${b2.cancel.refundVia}; no Stripe movement`;
  });
  await check("CN-009", "company", () => opg, async () => {
    // wallet switched OFF on the provider so the family cannot pick the wallet: the provider is left to reimburse via the scheme
    await setSettings(op, { customerArea: { wallet: false } });
    const x = await booked({ tag: "cn009", offset: 8, extra: { voucherScheme: "cnv" }, paid: false, method: "Childcare voucher" });
    await markPaid(x.ref);
    const card = await pCancelUi(x.child);
    await expect(card.getByText(/reimburse|through CN Vouchers/i).first()).toBeVisible();
    await sendReq(card); await waitCancel(x.ref);
    const pre = await opBooking(x.ref);
    await opOpen(x.child);
    const labels = await opg.getByRole("button", { name: /Accept refund|Mark refund|Approve refund/ }).allInnerTexts();
    await shot(opg, "CN-009");
    await setSettings(op, { customerArea: { wallet: true } });
    expect(labels.join("|")).toMatch(/Mark refund reimbursed/);
    await opClick(/Mark refund reimbursed/);
    await expect.poll(async () => (await opBooking(x.ref)).cancel?.refundVia, { timeout: 30_000 }).toBe("offline");
    return `voucher refund (refundTo=${pre.cancel.refundTo}); button labels: ${labels.join(" | ")}; refundVia=offline after click`;
  });
  await check("CN-010", "parent", () => pp, async () => {
    const x = await booked({ tag: "cn010", offset: 8, paid: false, method: "Tax-Free Childcare" });
    await markPaid(x.ref);
    const card = await pCancelUi(x.child);
    await expect(card.getByText(/can.t go back to a bank card/)).toBeVisible();
    await shot(pp, "CN-010");
    await sendReq(card); await waitCancel(x.ref);
    const b = await opBooking(x.ref);
    await opOpen(x.child);
    await opClick(/Accept refund to wallet|Mark refund reimbursed|Accept refund to bank|Approve refund/);
    await expect.poll(async () => (await opBooking(x.ref)).cancel?.refundVia, { timeout: 30_000 }).toMatch(/wallet|offline/);
    const b2 = await opBooking(x.ref);
    return `TFC: UI voucher-style note shown; refundTo=${b.cancel.refundTo}; refundVia=${b2.cancel.refundVia} (no Stripe)`;
  });
  await check("CN-011", "parent", () => pp, async () => {
    const x = await booked({ tag: "cn011", offset: 8, paid: false, method: "Cash" });
    await markPaid(x.ref);
    const card = await pCancelUi(x.child);
    await expect(card.getByText(/entitled to a full refund of £54\.00/)).toBeVisible();
    await card.getByRole("button", { name: /Back to card/ }).click();
    await shot(pp, "CN-011");
    await sendReq(card); await waitCancel(x.ref);
    await opOpen(x.child);
    await shot(opg, "CN-011-op");
    const txt = await opg.locator("body").innerText();
    await opClick(/Accept refund to bank|Approve refund|Mark refund reimbursed|Accept refund to wallet/);
    await expect.poll(async () => (await opBooking(x.ref)).cancel?.refundVia, { timeout: 30_000 }).toBeTruthy();
    const b = await opBooking(x.ref);
    const saysCash = /wasn.t paid by card|settle any refund directly/i.test(txt);
    expect(b.cancel.refundVia).toBe("offline");
    expect(saysCash, "provider screen should say the booking wasn't paid by card / settle directly").toBe(true);
    return `cash booking: refundVia=${b.cancel.refundVia}, provider told to settle directly`;
  });
  await check("CN-012", "parent", () => pp, async () => {
    const x = await booked({ tag: "cn012", offset: 8, paid: false });
    const card = await pCancelUi(x.child);
    await expect(card.getByText(/Nothing has been paid on this booking, so there.s nothing to refund/)).toBeVisible();
    await shot(pp, "CN-012");
    await sendReq(card); await waitCancel(x.ref);
    const b = await opBooking(x.ref);
    expect(b.cancel.amount).toBe(0);
    return `unpaid: UI says nothing to refund; cancel.refund=${b.cancel.refund} amount=${b.cancel.amount}; status=${b.status}`;
  });
});

let p2: Acct, pg2: Page;
test("CN-013..017", async ({ browser }) => {
  test.setTimeout(700_000);
  await check("CN-013", "parent", () => pg2, async () => {
    p2 = await mkParent("w");
    pg2 = (await uiCtx(browser, p2, /custdash/)).page;
    // 1) get 54 of wallet credit: cancel a paid booking to wallet, provider accepts
    const a = await booked({ tag: "cn013a", offset: 8, who: p2 });
    await pCancelApi(p2, a.ref, { refundPref: "wallet" });
    await opAct(a.ref, { type: "refund-approve" });
    expect(await wallet(p2)).toBe(54);
    // 2) book part-paid: wallet 10 + (card) 44
    const x = await booked({ tag: "cn013b", offset: 8, who: p2, extra: { walletCap: 10 } });
    const pre = await opBooking(x.ref);
    expect(pre.walletApplied).toBe(10); expect(pre.amount).toBe(44);
    expect(await wallet(p2)).toBe(44);
    await pg2.goto("/custdash/bookings");
    const card = cardWith(pg2, x.child);
    await expect(card).toBeVisible({ timeout: 30_000 });
    const btn = card.getByRole("button", { name: /Cancel booking/ });
    if (!(await btn.isVisible().catch(() => false))) await card.getByText(x.child).first().click();
    await btn.click();
    await expect(card.getByText(/entitled to a full refund of £54\.00/)).toBeVisible();
    await card.getByRole("button", { name: /Back to card/ }).click();
    await shot(pg2, "CN-013");
    await sendReq(card); await waitCancel(x.ref);
    const c = await opBooking(x.ref);
    expect(c.cancel.amount).toBe(54);
    await opAct(x.ref, { type: "refund-approve" });
    const d = await opBooking(x.ref);
    const w = await wallet(p2);
    expect(d.walletRefunded).toBe(10);
    return `booking amount 44 + walletApplied 10; parent UI "full refund of £54.00"; cancel.amount=54; on approve walletRefunded=${d.walletRefunded}, wallet ${44} -> ${w}; card part £44 -> refundVia=${d.cancel.refundVia} (no Stripe PI)`;
  });
  await check("CN-014", "company", () => opg, async () => {
    const pol = ["flexible", "standard", "strict", "none"] as const;
    const expAmt = { flexible: 54, standard: 27, strict: 0, none: 0 };
    const out: string[] = [];
    const xs: Record<string, Awaited<ReturnType<typeof booked>>> = {};
    for (const id of pol) xs[id] = await booked({ tag: `cn014${id}`, offset: 3, lst: { policy: id } as any });
    // provider's own cancel panel: pick each policy and read what it advises at this notice
    await opOpen(xs.strict.child);
    await opClick(/^Cancel booking$/);
    const sel = opg.locator("select").filter({ has: opg.locator("option", { hasText: "Flexible" }) }).first();
    const advice: string[] = [];
    for (const label of ["Flexible", "Standard", "Strict", "No refunds"]) {
      await sel.selectOption({ label });
      await opg.waitForTimeout(250);
      advice.push(`${label}: ${(await opg.getByText(/Policy says|policy says/).first().innerText()).replace(/\s+/g, " ")}`);
    }
    await shot(opg, "CN-014");
    // server-side (what the parent is actually given) per listing policy
    for (const id of pol) {
      const r = await pCancelApi(parent, xs[id].ref);
      out.push(`${id}=${r.cancel.amount}`);
      expect(r.cancel.amount, `policy ${id}`).toBe(expAmt[id]);
    }
    const defaultPolicyShown = advice[0];
    return `parent cancel at ~72h notice: ${out.join(", ")} (expect 54,27,0,0); provider panel advice by dropdown: ${advice.join(" // ")}`;
  });
  await check("CN-015", "company", () => opg, async () => {
    const x = await booked({ tag: "cn015", offset: 4 });
    await opOpen(x.child);
    await opClick(/^Cancel booking$/);
    await expect(opg.getByText("The family asked")).toBeVisible();
    const adviceTxt = (await opg.getByText(/Policy says|policy says/).first().innerText()).replace(/\s+/g, " ");
    await opg.getByText("Partial", { exact: true }).click();
    const amt = await opg.locator("input").filter({ hasNot: opg.locator("x") }).evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
    await shot(opg, "CN-015");
    await opClick(/Confirm cancellation/);
    await expect.poll(async () => (await opBooking(x.ref)).status, { timeout: 30_000 }).toBe("Cancelled");
    const b = await opBooking(x.ref);
    expect(b.cancel.by).toBe("Provider");
    expect(b.cancel.amount).toBe(27);
    return `advice: "${adviceTxt}"; Partial box prefilled with ${amt.join("/")}; cancel.amount=${b.cancel.amount} by=${b.cancel.by} pay=${b.pay}`;
  });
  await check("CN-016", "company", () => opg, async () => {
    const x = await booked({ tag: "cn016", offset: 1 });
    await opOpen(x.child);
    await opClick(/^Cancel booking$/);
    await opg.getByText("We cancelled it").click();
    const adviceTxt = (await opg.getByText(/Policy says|policy says/).first().innerText()).replace(/\s+/g, " ");
    expect(adviceTxt).toMatch(/full/i);
    await shot(opg, "CN-016");
    await opClick(/Confirm cancellation/);
    await expect.poll(async () => (await opBooking(x.ref)).status, { timeout: 30_000 }).toBe("Cancelled");
    const b = await opBooking(x.ref);
    expect(b.cancel.amount).toBe(54);
    return `inside no-refund window, "We cancelled it": advice "${adviceTxt}"; cancel.amount=${b.cancel.amount}`;
  });
  await check("CN-017", "company", () => opg, async () => {
    const x = await booked({ tag: "cn017", offset: 8 });
    await opOpen(x.child);
    await opClick(/^Cancel booking$/);
    await opg.getByText("Partial", { exact: true }).click();
    const box = opg.getByText("Refund amount (£)").locator("xpath=following::input[1]");
    await box.fill("20");
    await shot(opg, "CN-017");
    await opClick(/Confirm cancellation/);
    await expect.poll(async () => (await opBooking(x.ref)).status, { timeout: 30_000 }).toBe("Cancelled");
    const b = await opBooking(x.ref);
    expect(b.cancel.amount).toBe(20); expect(b.amount).toBe(54);
    await opOpen(x.child);
    await expect(opg.getByText(/£20\.00/).first()).toBeVisible();
    await shot(opg, "CN-017-after");
    return `partial refund typed 20: cancel.refund=${b.cancel.refund} amount=${b.cancel.amount}; booking total still ${b.amount}; pay=${b.pay}`;
  });
});

test("CN-019..023", async () => {
  test.setTimeout(700_000);
  await check("CN-019", "company", () => opg, async () => {
    const x = await booked({ tag: "cn019", offset: 8 });
    await opOpen(x.child);
    await opg.getByRole("button", { name: /Cancel all 3 days/ }).click();
    await shot(opg, "CN-019");
    await expect.poll(async () => { const b = await opBooking(x.ref); return JSON.stringify(b.kids ?? []).includes('"cancelled":true') ? 1 : 0; }, { timeout: 30_000 }).toBe(1);
    const b = await opBooking(x.ref);
    return `BLOCKED-ish: the booking engine creates ONE booking per child, so a two-child booking cannot be made; cancel-child on the single child: status=${b.status} pay=${b.pay} refundLog=${JSON.stringify(b.refundLog)} kids=${JSON.stringify((b.kids ?? []).map((k: any) => [k.name, k.cancelled]))}`;
  });
  await check("CN-020", "company", () => opg, async () => {
    const x = await booked({ tag: "cn020", offset: 8 });
    await opOpen(x.child);
    await opg.getByRole("button", { name: "Cancel this day" }).first().click();
    await expect.poll(async () => ((await opBooking(x.ref)).refundLog?.length ?? 0), { timeout: 30_000 }).toBeGreaterThan(0);
    const b = await opBooking(x.ref);
    await opOpen(x.child);
    await shot(opg, "CN-020");
    expect(b.refundLog[0].amount).toBe(18);
    return `one day cancelled: refundLog=${JSON.stringify(b.refundLog)} status=${b.status} pay=${b.pay} (54/3 days = 18)`;
  });
  await check("CN-021", "parent", () => pp, async () => {
    const x = await booked({ tag: "cn021", offset: 8 });
    const w0 = await wallet(parent);
    const card = await pCancelUi(x.child);
    await card.getByRole("button", { name: "Choose days" }).click();
    await expect(card.getByText(/worth/i).first()).toBeVisible();
    await card.getByRole("checkbox").first().check();
    await expect(card.getByRole("button", { name: /Release 1 day to wallet/ })).toBeVisible();
    await shot(pp, "CN-021");
    await card.getByRole("button", { name: /Release 1 day to wallet/ }).click();
    await expect.poll(async () => (await wallet(parent)) - w0, { timeout: 30_000 }).toBe(18);
    const b = await opBooking(x.ref);
    return `released 1 of 3 days to wallet: wallet +18 instantly; booking days now ${JSON.stringify(b.days)} status=${b.status}; refundLog=${JSON.stringify(b.refundLog)}`;
  });
  await check("CN-022", "parent", () => pp, async () => {
    const x = await booked({ tag: "cn022", offset: 1, lst: { runDays: 10 }, dates: (s) => [s[0], s[7], s[8]] });
    const card = await pCancelUi(x.child);
    await card.getByRole("button", { name: "Choose days" }).click();
    await expect(card.getByText(/no cash refund \(too close\)/)).toBeVisible();
    const rows = await card.locator("label").allInnerTexts();
    // tick the far day (second row), choose the Refund option, cancel for a refund
    await card.getByRole("checkbox").nth(1).check();
    await card.getByRole("button", { name: /Refund/ }).first().click();
    await shot(pp, "CN-022");
    await card.getByRole("button", { name: /^Cancel 1 day/ }).click();
    await expect.poll(async () => ((await opBooking(x.ref)).cancel ? 1 : 0), { timeout: 30_000 }).toBe(1);
    const far = await opBooking(x.ref);
    expect(far.cancel.amount, "far day (outside the window) should be pro-rata 18").toBe(18);
    // now the near day (inside the no-refund window)
    await pp.goto("/custdash/bookings");
    const card2 = cardWith(pp, x.child);
    await card2.getByRole("button", { name: /Cancel booking/ }).click();
    await card2.getByRole("button", { name: "Choose days" }).click();
    await card2.getByRole("checkbox").first().check();
    await card2.getByRole("button", { name: /Refund/ }).first().click();
    await card2.getByRole("button", { name: /^Cancel 1 day/ }).click();
    await expect.poll(async () => JSON.stringify((await opBooking(x.ref)).kids ?? []).includes(x.dates[0]) ? 1 : 0, { timeout: 30_000 }).toBe(1);
    await expect.poll(async () => ((await opBooking(x.ref)).kids?.[0]?.cancelledDays?.length ?? 0), { timeout: 30_000 }).toBe(2);
    const both = await opBooking(x.ref);
    await shot(pp, "CN-022-after");
    const detail = `row labels: ${rows.map((r) => r.replace(/\s+/g, " ")).join(" || ")}; 1st release (far day) -> cancel=${JSON.stringify({ refund: far.cancel.refund, amount: far.cancel.amount })}; 2nd release (near day, £0) -> booking.cancel=${JSON.stringify({ refund: both.cancel.refund, amount: both.cancel.amount })}`;
    expect(both.cancel.amount, `the 2nd release must not wipe the first release's pending £18 refund request. ${detail}`).toBe(18);
    return detail;
  });
  await check("CN-023", "parent", () => pp, async () => {
    await setSettings(op, { partialAllowChangeDate: true });
    const x = await booked({ tag: "cn023", offset: 8, lst: { runDays: 9 } });
    const card = await pCancelUi(x.child);
    await card.getByRole("button", { name: "Choose days" }).click();
    await card.getByRole("checkbox").first().check();
    await card.getByRole("button", { name: /Move to another date/ }).click();
    const sessions = (await (await listingDocFull(x.l.id)).blocks[0].sessions as { date: string }[]).map((s) => s.date).sort();
    const target = sessions[5];
    await card.getByRole("button", { name: String(parseInt(target.slice(8), 10)), exact: true }).click();
    await shot(pp, "CN-023");
    await card.getByRole("button", { name: /Request to move 1 day/ }).click();
    await expect.poll(async () => (await opBooking(x.ref)).dateChangeRequest?.status, { timeout: 30_000 }).toBe("pending");
    const b = await opBooking(x.ref);
    await setSettings(op, { partialAllowChangeDate: false });
    expect(b.amount).toBe(54);
    return `dateChangeRequest pending: ${JSON.stringify(b.dateChangeRequest.moves)}; total still ${b.amount}; status ${b.status}`;
  });
});
const listingDocFull = async (id: string) => apiFetch<{ blocks: { sessions: { date: string }[] }[] }>(`/api/listings/${id}`, await op.token());

const CANCEL_REASONS = [
  { id: "illness", label: "Illness", who: "both" }, { id: "weather", label: "Weather", who: "provider" }, { id: "staffing", label: "Staffing", who: "provider" },
  { id: "venue", label: "Venue unavailable", who: "provider" }, { id: "too-few", label: "Too few booked", who: "provider" }, { id: "asked", label: "Family asked us to", who: "provider" },
  { id: "plans", label: "Plans changed", who: "parent" }, { id: "childcare", label: "No longer need the childcare", who: "parent" }, { id: "cost", label: "Cost", who: "parent" },
  { id: "duplicate", label: "Booked by mistake", who: "both" },
];
test("CN-025..029", async ({ browser }) => {
  test.setTimeout(800_000);
  await check("CN-025", "company", () => opg, async () => {
    const code = `CNONE${stamp}`.toUpperCase();
    const t = await op.token();
    const made = await apiPost<{ id: string }>("/api/discounts", t, { code, type: "percent", value: 10, usageLimit: 1, active: true });
    const used = async () => { const all = await apiFetch<{ id: string; code: string; usedCount?: number }[]>("/api/discounts", await op.token()); return all.find((c) => c.code === code)?.usedCount ?? 0; };
    const x = await booked({ tag: "cn025", offset: 8, paid: false, extra: { discountCode: code } });
    const b0 = await opBooking(x.ref);
    expect(b0.amount).toBe(48.6);
    expect(await used()).toBe(1);
    // second use is refused / not applied while the first stands
    let second = "applied?";
    try { const y = await booked({ tag: "cn025b", offset: 8, paid: false, extra: { discountCode: code } }); second = `booking made at £${(await opBooking(y.ref)).amount}`; await pCancelApi(parent, y.ref); } catch (e) { second = `refused: ${String((e as Error).message).slice(0, 90)}`; }
    // provider cancels the first through the UI
    await opOpen(x.child);
    await opClick(/^Cancel booking$/);
    await opg.getByText("No refund", { exact: true }).click();
    await opClick(/Confirm cancellation/);
    await expect.poll(async () => (await opBooking(x.ref)).status, { timeout: 30_000 }).toBe("Cancelled");
    await expect.poll(used, { timeout: 30_000 }).toBe(0);
    await opg.goto("/company/bookings"); await shot(opg, "CN-025");
    const z = await booked({ tag: "cn025c", offset: 8, paid: false, extra: { discountCode: code } });
    const b2 = await opBooking(z.ref);
    expect(b2.amount).toBe(48.6);
    return `code 10% usageLimit 1: first booking £48.60 (used=1); second while first stands: ${second}; after provider cancelled first usedCount=0 and code applied again (£${b2.amount})`;
  });
  await check("CN-026", "company", () => opg, async () => {
    p2 = p2 ?? (await mkParent("w"));
    const x = await booked({ tag: "cn026a", offset: 8, lst: { cap: 1, waitlist: true, wmode: "auto" } });
    const t2 = await p2.token();
    const doc = await apiFetch<{ blocks: { id: string; sessions?: { date: string }[] }[] }>(`/api/listings/${x.l.id}`, t2);
    const dates = (doc.blocks[0].sessions ?? []).map((s) => s.date).sort().slice(0, 3);
    const q = await apiPost<{ bookings: Record<string, any>[] }>("/api/my/bookings", t2, { listingId: x.l.id, blockId: doc.blocks[0].id, method: "card", walletCap: 0, items: [{ pass: "3 days", child: kid("cn026b"), age: 8, dates }] });
    expect(q.bookings[0].status).toBe("Waitlisted");
    const before = await listingDoc(x.l.id);
    await opOpen(x.child);
    await opClick(/^Cancel booking$/);
    await opg.getByText("We cancelled it").click();
    await opClick(/Confirm cancellation/);
    await expect.poll(async () => (await opBooking(x.ref)).status, { timeout: 30_000 }).toBe("Cancelled");
    const after = await listingDoc(x.l.id);
    await expect.poll(async () => (await opBooking(q.bookings[0].ref)).status, { timeout: 40_000 }).toMatch(/Offered|Confirmed/);
    const qb = await opBooking(q.bookings[0].ref);
    const bell = (await notifs(p2)).filter((n) => /place/i.test(n.title));
    await opg.goto("/company/bookings"); await opg.getByRole("button", { name: /^Offered/ }).click().catch(() => {}); await shot(opg, "CN-026");
    return `cap 1 full, 2nd family Waitlisted. Provider cancelled the holder: block bookedCount ${before.blocks[0].bookedCount} -> ${after.blocks[0].bookedCount}; queued booking now "${qb.status}" (auto mode); family bell: ${bell[0]?.title ?? "none"}`;
  });
  await check("CN-027", "parent", () => pp, async () => {
    await setSettings(op, { askReasonParent: true, askReasonOperator: true, cancellationReasons: CANCEL_REASONS });
    const x = await booked({ tag: "cn027", offset: 8 });
    const card = await pCancelUi(x.child);
    await expect(card.locator("select")).toBeVisible({ timeout: 20_000 });
    const opts = (await card.locator("select option").allInnerTexts()).map((s) => s.trim());
    await shot(pp, "CN-027");
    const parentWant = ["Illness", "Plans changed", "No longer need the childcare", "Cost", "Booked by mistake"];
    for (const w of parentWant) expect(opts, `parent list has ${w}`).toContain(w);
    for (const bad of ["Weather", "Staffing", "Venue unavailable", "Too few booked", "Family asked us to"]) expect(opts).not.toContain(bad);
    await card.locator("select").selectOption({ label: "Illness" });
    await sendReq(card); await waitCancel(x.ref);
    const y = await booked({ tag: "cn027y", offset: 8 });
    await opOpen(y.child);
    await opClick(/^Cancel booking$/);
    const famChips = await opg.locator("span.cursor-pointer").allInnerTexts();
    await opg.getByText("We cancelled it").click();
    const provChips = await opg.locator("span.cursor-pointer").allInnerTexts();
    await shot(opg, "CN-027-op");
    const provWant = ["Weather", "Staffing", "Venue unavailable", "Too few booked", "Family asked us to"];
    for (const w of provWant) expect(provChips, `provider list has ${w}`).toContain(w);
    const b = await opBooking(x.ref);
    return `parent select: ${opts.filter(Boolean).join(", ")}; provider (we cancelled) chips include ${provWant.join(", ")}; family-asked chips: ${famChips.filter((c) => CANCEL_REASONS.some((r) => r.label === c)).join(", ")}; parent chose Illness -> stored cancel.reason=${JSON.stringify(b.cancel?.reason)} msg=${JSON.stringify(b.cancel?.msg)}`;
  });
  await check("CN-028", "parent", () => pp, async () => {
    const name = kid("cn028");
    const t = await parent.token();
    await apiPost("/api/my/children", t, { name, dob: "2018-05-14" });
    const l = await mkListing(op, { title: `CN cn028 ${stamp}`, offset: 8 });
    const doc = await apiFetch<{ blocks: { id: string; sessions?: { date: string }[] }[] }>(`/api/listings/${l.id}`, t);
    const dates = (doc.blocks[0].sessions ?? []).map((s) => s.date).sort().slice(0, 3);
    const bk = (await apiPost<{ bookings: Record<string, any>[] }>("/api/my/bookings", t, { listingId: l.id, blockId: doc.blocks[0].id, method: "card", walletCap: 0, items: [{ pass: "3 days", child: name, age: 8, dates }] })).bookings[0];
    await markPaid(bk.ref);
    const opt = await apiPost<{ id: string }>("/api/meal-options", await op.token(), { name: "CN Pasta", price: 4.5 });
    const mo = await apiPost<{ id: string }>("/api/meal-orders", t, { tenantId: op.tenantId, listingId: l.id, date: dates[0], childName: name, items: [{ optionId: opt.id, qty: 1 }] });
    const trip = await apiPost<{ id: string; attendees?: unknown[] }>("/api/trips", await op.token(), { destination: "CN Zoo", date: dates[0], childNames: [name], listingId: l.id });
    const card = await pCancelUi(name);
    await sendReq(card); await waitCancel(bk.ref);
    await expect.poll(async () => { const list = await apiFetch<{ id: string; status?: string }[]>("/api/meal-orders", await parent.token()); return list.find((m) => m.id === mo.id)?.status; }, { timeout: 40_000 }).toBe("cancelled");
    await pp.goto("/custdash/bookings"); await shot(pp, "CN-028");
    const trips = await apiFetch<{ id: string; attendees?: { n?: string }[] }[]>("/api/trips", await op.token());
    const stillOn = (trips.find((x) => x.id === trip.id)?.attendees ?? []).some((a) => a.n === name);
    const bell = (await notifs(op)).filter((n) => /trip day/i.test(n.title));
    expect(stillOn, "catalogue says the trip place is removed").toBe(false);
    return `meal order cancelled; trip place removed`;
  });
  await check("CN-029", "parent", () => pp, async () => {
    const emailText = (await import("node:child_process")).execFileSync(path.join(ROOT, "server/node_modules/.bin/tsx"), ["/private/tmp/claude-501/x/spec29.ts"], { cwd: path.join(ROOT, "server"), encoding: "utf8" }).trim().split("\n").pop()!;
    expect(emailText).toMatch(/5.10 working days/);
    const x = await booked({ tag: "cn029", offset: 8 });
    await pCancelApi(parent, x.ref, { refundPref: "card" });
    await opAct(x.ref, { type: "refund-approve" });
    const bell = (await notifs(parent)).find((n) => n.title.includes(x.ref) && /Refund approved/.test(n.title));
    await pp.goto("/custdash/bookings"); await pp.getByRole("button", { name: /notification|bell/i }).first().click().catch(() => {}); await shot(pp, "CN-029");
    return `refund email (refundApprovedSpec): ${emailText}; in-app bell for the same event reads: "${bell?.body}" (no timing)`;
  });
});

test("CN-031..036", async ({ browser }) => {
  test.setTimeout(800_000);
  await check("CN-031", "company", () => pp, async () => {
    await setSettings(op, { allowCardRefund: false });
    try {
      const w0 = await wallet(parent);
      const x = await booked({ tag: "cn031", offset: 8 });
      const card = await pCancelUi(x.child);
      await expect(card.getByText(/entitled to a full refund/)).toBeVisible();
      const chooser = await card.getByText(/Send my £54\.00 refund to/).isVisible().catch(() => false);
      const toCard = await card.getByRole("button", { name: /Back to card/ }).isVisible().catch(() => false);
      await shot(pp, "CN-031");
      await sendReq(card); await waitCancel(x.ref);
      await opOpen(x.child);
      const label = await opg.getByRole("button", { name: /Accept refund|Approve refund|Mark refund/ }).first().innerText();
      await opClick(/Accept refund|Approve refund|Mark refund/);
      await expect.poll(async () => (await opBooking(x.ref)).cancel?.refundVia, { timeout: 30_000 }).toBeTruthy();
      const b = await opBooking(x.ref);
      const w1 = await wallet(parent);
      expect(toCard, "no 'back to card' offered").toBe(false);
      expect(w1 - w0).toBe(54);
      expect(b.cancel.refundVia).toBe("wallet");
      return `card refunds off: parent UI chooser shown=${chooser}, card option shown=${toCard} (family is NOT told it will be wallet credit); provider button "${label}"; on approve wallet ${w0}->${w1}, refundVia=${b.cancel.refundVia}, refundTo=${b.cancel.refundTo}`;
    } finally { await setSettings(op, { allowCardRefund: true }); }
  });
  await check("CN-032", "company", () => pp, async () => {
    await setSettings(op, { refundLetCustomerChoose: true });
    const x = await booked({ tag: "cn032", offset: 8 });
    const card = await pCancelUi(x.child);
    await expect(card.getByText("Send my £54.00 refund to")).toBeVisible();
    await expect(card.getByRole("button", { name: /Wallet credit/ })).toBeVisible();
    await expect(card.getByRole("button", { name: /Back to card/ })).toBeVisible();
    await card.getByRole("button", { name: /Wallet credit/ }).click();
    await shot(pp, "CN-032");
    await sendReq(card); await waitCancel(x.ref);
    const b = await opBooking(x.ref);
    expect(b.cancel.refundTo).toBe("wallet");
    // and with the toggle off ("always card") the chooser disappears
    await setSettings(op, { refundLetCustomerChoose: false });
    const y = await booked({ tag: "cn032b", offset: 8 });
    const card2 = await pCancelUi(y.child);
    await expect(card2.getByText(/entitled to a full refund/)).toBeVisible();
    const gone = !(await card2.getByText(/Send my £54\.00 refund to/).isVisible().catch(() => false));
    await shot(pp, "CN-032-off");
    await setSettings(op, { refundLetCustomerChoose: true });
    expect(gone).toBe(true);
    return `chooser on: "Send my £54.00 refund to" with Wallet credit + Back to card; picked wallet -> cancel.refundTo=wallet; toggle off: chooser hidden`;
  });
  await check("CN-033", "company", () => opg, async () => {
    await setSettings(op, { refundApproval: "auto" });
    const x = await booked({ tag: "cn033", offset: 8 });
    await pCancelApi(parent, x.ref, { refundPref: "card" });
    await opg.waitForTimeout(6000);
    const b = await opBooking(x.ref);
    await opg.goto("/company/setup");
    await opg.getByText(/Cancellations/i).first().click().catch(() => {});
    await opg.waitForTimeout(1500);
    await shot(opg, "CN-033");
    const txt = await opg.locator("body").innerText();
    await setSettings(op, { refundApproval: "review" });
    expect(b.cancel.refund).not.toBe("approved");
    return `'Issue it automatically' selected: after parent cancelled, 6s later cancel.refund=${b.cancel.refund} pay=${b.pay} refundedAt=${b.cancel.refundedAt ?? "none"} (nothing auto-moved; still waits for provider); Setup shows the "needs building" note: ${/Automatic needs building|can.t be un-sent/i.test(txt)}`;
  });
  await check("CN-034", "parent", () => opg, async () => {
    const lA = await mkListing(op, { title: `CN reg ${stamp}`, offset: 0, runDays: 3 });
    const mk = async (who: string) => {
      const t = await parent.token();
      const doc = await apiFetch<{ blocks: { id: string; sessions?: { date: string }[] }[] }>(`/api/listings/${lA.id}`, t);
      const dates = (doc.blocks[0].sessions ?? []).map((s) => s.date).sort().slice(0, 3);
      const r = await apiPost<{ bookings: Record<string, any>[] }>("/api/my/bookings", t, { listingId: lA.id, blockId: doc.blocks[0].id, method: "card", walletCap: 0, items: [{ pass: "3 days", child: kid(who), age: 8, dates }] });
      return { ref: r.bookings[0].ref as string, child: kid(who), today: dates[0] };
    };
    const a = await mk("cn034stay"), c = await mk("cn034gone");
    const regOf = async () => JSON.stringify(await apiFetch(`/api/registers?date=${a.today}`, await op.token()));
    const before = await regOf();
    expect(before).toContain(a.child); expect(before).toContain(c.child);
    await pCancelApi(parent, c.ref);
    const after = await regOf();
    await opg.goto("/company/admin-registers"); await opg.waitForTimeout(4000); await shot(opg, "CN-034");
    expect(after).toContain(a.child);
    expect(after, "cancelled child must not be expected").not.toContain(c.child);
    return `register for ${a.today}: before both children listed; after parent cancelled one, only the other remains`;
  });
  // ---- head office / franchise ----
  const frEmail = `e2e-cn-fr-${stamp}@${TEST_EMAIL_DOMAIN}`;
  let fr: Acct | null = null;
  try {
    const inv = await apiPost<{ token: string }>("/api/invites", await op.token(), { role: "franchise" });
    const s = await fbSignUp(frEmail);
    await apiPost(`/api/invites/${inv.token}/accept`, s.idToken, {});
    fr = { email: frEmail, uid: s.uid, tenantId: op.tenantId, token: tok(frEmail) };
  } catch (e) { console.log("FRANCHISE SETUP FAILED", (e as Error).message); }
  let frBooking: { child: string; ref: string; l: L } | null = null;
  await check("CN-035", "head-office", () => opg, async () => {
    if (!fr) throw new Error("could not create a franchise account via invite");
    const l = await mkListing(fr, { title: `CN fr ${stamp}`, offset: 8 });
    const child = kid("cn035");
    const t = await parent.token();
    const doc = await apiFetch<{ blocks: { id: string; sessions?: { date: string }[] }[] }>(`/api/listings/${l.id}`, t);
    const dates = (doc.blocks[0].sessions ?? []).map((x) => x.date).sort().slice(0, 3);
    const r = await apiPost<{ bookings: Record<string, any>[] }>("/api/my/bookings", t, { listingId: l.id, blockId: doc.blocks[0].id, method: "card", walletCap: 0, items: [{ pass: "3 days", child, age: 8, dates }] });
    const ref = r.bookings[0].ref as string;
    await markPaid(ref);
    const bb = await opBooking(ref);
    const sf = async () => apiFetch<{ franchises: { count: number; revenue: number; fee: number }[]; direct: { count: number } }>("/api/splitfees", await op.token());
    const s0 = await sf();
    await opOpen(child);
    await opClick(/^Cancel booking$/);
    await opClick(/Confirm cancellation/);
    await expect.poll(async () => (await opBooking(ref)).status, { timeout: 30_000 }).toBe("Cancelled");
    await opg.goto("/company/bookings"); await shot(opg, "CN-035");
    const s1 = await sf();
    const f0 = s0.franchises.reduce((n, f) => n + f.count, 0), f1 = s1.franchises.reduce((n, f) => n + f.count, 0);
    const r0 = s0.franchises.reduce((n, f) => n + f.revenue, 0), r1 = s1.franchises.reduce((n, f) => n + f.revenue, 0);
    expect(bb.franchiseId, "booking is a franchise booking").toBeTruthy();
    expect(f1).toBe(f0 - 1); expect(r1).toBeCloseTo(r0 - 54, 2);
    frBooking = { child, ref, l };
    return `franchise booking (franchiseId set) cancelled by head office via UI; split-fees franchise count ${f0}->${f1}, revenue ${r0}->${r1} (-54), fee ${s0.franchises.reduce((n, f) => n + f.fee, 0)}->${s1.franchises.reduce((n, f) => n + f.fee, 0)}`;
  });
  await check("CN-036", "head-office", () => opg, async () => {
    if (!fr) throw new Error("could not create a franchise account via invite");
    const l = await mkListing(fr, { title: `CN fr2 ${stamp}`, offset: 8 });
    const child = kid("cn036");
    const t = await parent.token();
    const doc = await apiFetch<{ blocks: { id: string; sessions?: { date: string }[] }[] }>(`/api/listings/${l.id}`, t);
    const dates = (doc.blocks[0].sessions ?? []).map((x) => x.date).sort().slice(0, 3);
    const r = await apiPost<{ bookings: Record<string, any>[] }>("/api/my/bookings", t, { listingId: l.id, blockId: doc.blocks[0].id, method: "card", walletCap: 0, items: [{ pass: "3 days", child, age: 8, dates }] });
    const ref = r.bookings[0].ref as string;
    await markPaid(ref);
    const sf = async () => apiFetch<{ franchises: { revenue: number; fee: number }[]; settings: unknown }>("/api/splitfees", await op.token());
    const s0 = await sf();
    // a partial refund that leaves the booking standing: head office cancels one day (UI)
    await opOpen(child);
    await opg.getByRole("button", { name: "Cancel this day" }).first().click();
    await expect.poll(async () => ((await opBooking(ref)).refundLog?.length ?? 0), { timeout: 30_000 }).toBeGreaterThan(0);
    const b = await opBooking(ref);
    await opOpen(child); await opg.goto("/company/finance").catch(() => {}); await shot(opg, "CN-036");
    const s1 = await sf();
    const r0 = s0.franchises.reduce((n, f) => n + f.revenue, 0), r1 = s1.franchises.reduce((n, f) => n + f.revenue, 0);
    const fee0 = s0.franchises.reduce((n, f) => n + f.fee, 0), fee1 = s1.franchises.reduce((n, f) => n + f.fee, 0);
    expect(r1, `royalty base should drop after a partial refund (revenue ${r0}->${r1}, fee ${fee0}->${fee1})`).toBeLessThan(r0);
    return `RECORD: after a partial refund (refundLog ${JSON.stringify(b.refundLog?.map((x: any) => x.amount))}, pay=${b.pay}) split-fees revenue ${r0} -> ${r1}, fee ${fee0} -> ${fee1}: royalty base ${r1 < r0 ? "DROPS" : "does NOT drop"} (suspected: stays at the full booking amount)`;
  });
});
