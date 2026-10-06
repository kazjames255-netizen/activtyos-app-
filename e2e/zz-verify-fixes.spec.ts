import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT, WEB_URL, API_URL } from "./helpers/env";
import { DEFAULT_POLICIES } from "../lib/cancellation";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, apiFetch, apiPost, fbSignIn, fbSignUp } from "./helpers/accounts";
import { cardWith } from "./helpers/ui";

// Verification of the uncommitted fixes against the LOCAL stack. Fresh throwaway accounts only.
// Run:  npx playwright test -c e2e/zz-verify-fixes.config.ts   (config has no webServer; E2E_BASE_URL points at a private web)

const realFetch = globalThis.fetch;
globalThis.fetch = (async (...a: Parameters<typeof fetch>) => {
  for (let i = 0; ; i++) {
    try { return await realFetch(...a); } catch (e) { if (i >= 8) throw e; await new Promise((r) => setTimeout(r, 3000)); }
  }
}) as typeof fetch;
test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 30_000, navigationTimeout: 90_000 });
const stamp = Date.now().toString(36);
const SHOTS = path.join(ROOT, "e2e/review/shots/verify");
fs.mkdirSync(SHOTS, { recursive: true });
const OUT = path.join(SHOTS, "_results.json");
const RESULTS: Record<string, { status: string; note: string; shot: string }> = {};
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const plus = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const nextMonday = () => { const d = new Date(); d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7)); return d; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const MON1 = nextMonday();

type Acct = { email: string; uid: string; tenantId?: string; name?: string; token: () => Promise<string> };
let parent: Acct, parent2: Acct, op: Acct;
const tok = (email: string) => async () => (await fbSignIn(email)).idToken;

async function mkParent(tag: string): Promise<Acct> {
  const email = `e2e-vf-${tag}-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  await apiPost("/api/register-role", s.idToken, { role: "parent", postcode: "NN5 7EA" });
  await apiPost("/api/me/welcome", s.idToken, {});
  return { email, uid: s.uid, token: tok(email) };
}
async function mkOp(): Promise<Acct> {
  const email = `e2e-vf-op-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  const name = `VF Co ${stamp}`;
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role: "company", businessName: name, providerName: name, providerNameMode: "business" });
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", r.tenantId], { stdio: "pipe" });
  return { email, uid: s.uid, tenantId: r.tenantId, name, token: tok(email) };
}
async function uiCtx(browser: Browser, a: Acct, home: RegExp): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${WEB_URL}/login`);
  await page.getByPlaceholder("you@example.com").fill(a.email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(home, { timeout: 90_000 });
  return { ctx, page };
}
const shot = (page: Page, id: string) => page.screenshot({ path: path.join(SHOTS, `${id}.png`), fullPage: true });
const rec = (id: string, status: "PASS" | "FAIL", note: string) => {
  RESULTS[id] = { status, note, shot: `e2e/review/shots/verify/${id}.png` };
  fs.writeFileSync(OUT, JSON.stringify(RESULTS, null, 1));
  console.log(`RESULT ${id} ${status} :: ${note}`);
};
let pp: Page, opg: Page;
const ONLY = (process.env.VF_ONLY ?? "").split(",").filter(Boolean);
async function check(id: string, page: () => Page | undefined, fn: () => Promise<string>) {
  if (ONLY.length && !ONLY.includes(id)) return;
  try { rec(id, "PASS", await fn()); } catch (e) {
    const msg = String((e as Error).message).split("\n").filter(Boolean).slice(0, 5).join(" | ").slice(0, 900);
    try { const pg = page(); if (pg) await shot(pg, id); } catch { /* ignore */ }
    rec(id, "FAIL", msg);
  }
}

async function setSettings(a: Acct, patch: Record<string, unknown>) {
  const t = await a.token();
  const lib = ((await apiFetch<Record<string, unknown> | null>("/api/library", t)) ?? {}) as { settings?: Record<string, unknown> };
  await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ settings: { ...(lib.settings ?? {}), ...patch } }) });
}
const VENUE = "vf-venue";
async function ensureVenue(a: Acct) {
  const t = await a.token();
  const lib = ((await apiFetch<Record<string, unknown> | null>("/api/library", t)) ?? {}) as { venues?: { id: string }[]; settings?: Record<string, unknown> };
  await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ venues: (lib.venues ?? []).some((v) => v.id === VENUE) ? lib.venues : [...(lib.venues ?? []), { id: VENUE, name: "VF Hall", address: "1 Test Way", city: "Northampton" }], settings: { ...(lib.settings ?? {}), marketplaceListed: true, providerName: a.name } }) });
}

interface L { id: string; title: string; tenantId: string }
/** Custom-date block with ONE 3-day pass at `price` (the CN pattern). */
async function mkListing(a: Acct, o: { title: string; offset: number; price?: number; cap?: number; waitlist?: boolean; runDays?: number; policy?: string; sessionPrices?: Record<number, number> }): Promise<L> {
  const t = await a.token();
  await ensureVenue(a);
  const period = await apiPost<{ id: string }>("/api/periods", t, { title: "Full day", start: "09:00", finish: "15:30" });
  const pass = await apiPost<{ id: string }>("/api/passes", t, { name: "3 days", days: 3 });
  const price = o.price ?? 54;
  const bundle = await apiPost<{ id: string }>("/api/block-bundles", t, { name: `VF Block ${o.title}`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: price, calcOn: true });
  const l = await apiPost<{ id: string; tenantId: string }>("/api/listings", t, {
    title: o.title, venueId: VENUE, runFrom: plus(o.offset), runTo: plus(o.offset + (o.runDays ?? 6)), blockMode: "custom", days: [0, 1, 2, 3, 4, 5, 6],
    maxAttendees: String(o.cap ?? 16), capacityScope: "day", ...(o.waitlist ? { waitlist: true, waitlistMode: "manual" } : {}), showSpaces: true, ageFrom: "5", ageTo: "12",
    blockId: bundle.id, passes: [{ name: "3 days", price, days: 3 }], bookingType: "auto", status: "live", visibility: "public",
    ...(o.policy ? { cancellationPolicyId: o.policy } : {}),
  });
  await apiFetch(`/api/block-bundles/${bundle.id}/listings`, t, { method: "PUT", body: JSON.stringify({ listingIds: [l.id] }) });
  return { id: l.id, title: o.title, tenantId: l.tenantId };
}
/** Weekly Mon-Fri listing with flat 1/3/5 day passes and arbitrary timings (the BM pattern). */
async function mkWeekly(a: Acct, o: { title: string; periods?: [string, string, string][]; max?: number }): Promise<L> {
  const t = await a.token();
  await ensureVenue(a);
  const periodIds: string[] = [];
  for (const [title, start, finish] of o.periods ?? [["Full day", "09:00", "15:30"]]) periodIds.push((await apiPost<{ id: string }>("/api/periods", t, { title, start, finish })).id);
  const defs: [string, number, number][] = [["1 day", 1, 20], ["3 days", 3, 54], ["5 days", 5, 90]];
  const passIds: string[] = []; const passFlat: Record<string, number> = {}, passMode: Record<string, "flat"> = {};
  for (const [name, days, price] of defs) { const p = await apiPost<{ id: string }>("/api/passes", t, { name, days }); passIds.push(p.id); passFlat[p.id] = price; passMode[p.id] = "flat"; }
  const bundle = await apiPost<{ id: string }>("/api/block-bundles", t, { name: `VF Wk ${o.title}`, periodIds, passIds, priced: true, masterPrice: 90, calcOn: true, passFlat, passMode });
  const l = await apiPost<{ id: string; tenantId: string }>("/api/listings", t, {
    title: o.title, venueId: VENUE, runFrom: iso(MON1), runTo: iso(addDays(MON1, 3 * 7 - 3)), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: String(o.max ?? 10), capacityScope: "day",
    waitlist: true, waitlistMode: "manual", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id, passes: defs.map(([name, days, price]) => ({ name, price, days })),
    bookingType: "auto", status: "live", visibility: "public",
  });
  await apiFetch(`/api/block-bundles/${bundle.id}/listings`, t, { method: "PUT", body: JSON.stringify({ listingIds: [l.id] }) });
  return { id: l.id, title: o.title, tenantId: l.tenantId };
}

type Doc = { blocks: { id: string; bookedCount: number; dayCounts?: Record<string, number>; sessions?: { date: string }[] }[] };
const listingDoc = async (id: string, a: Acct = op) => apiFetch<Doc>(`/api/listings/${id}`, await a.token());
const sessionsOf = async (l: L, a: Acct = parent) => ((await listingDoc(l.id, a)).blocks[0].sessions ?? []).map((s) => s.date).sort();
const opBooking = async (ref: string) => apiFetch<Record<string, any>>(`/api/bookings/${ref}`, await op.token());
const notifs = async (a: Acct) => (await apiFetch<{ notifications: { title: string; body: string }[] }>("/api/notifications", await a.token())).notifications;
const wallet = async (a: Acct) => { const w = await apiFetch<{ balances: { balance?: number }[] }>("/api/my/wallet", await a.token()); return w.balances.reduce((n, x) => n + (x.balance ?? 0), 0); };
const opAct = async (ref: string, body: Record<string, unknown>, a: Acct = op) => apiPost(`/api/bookings/${ref}/actions`, await a.token(), body);
const markPaid = (ref: string) => opAct(ref, { type: "paid" });
const pCancelApi = async (a: Acct, ref: string, body: Record<string, unknown> = {}) => apiPost<Record<string, any>>(`/api/my/bookings/${ref}/cancel`, await a.token(), body);
let kidSeq = 0;
const kid = (tag: string) => `${tag}${++kidSeq} ${stamp}`;

async function bookRaw(who: Acct, l: L, body: Record<string, unknown>, dates: string[], child: string, pass = "3 days") {
  const doc = await listingDoc(l.id, who);
  return apiPost<{ bookings: Record<string, any>[] }>("/api/my/bookings", await who.token(), {
    listingId: l.id, blockId: doc.blocks[0].id, method: "card", walletCap: 0, items: [{ pass, child, age: 8, dates }], ...body,
  });
}
async function booked(o: { tag: string; offset: number; paid?: boolean; method?: string; extra?: Record<string, unknown>; who?: Acct; lst?: Partial<Parameters<typeof mkListing>[1]>; dates?: (s: string[]) => string[] }) {
  const child = kid(o.tag);
  const l = await mkListing(op, { title: `VF ${o.tag} ${stamp}`, offset: o.offset, ...(o.lst ?? {}) });
  const who = o.who ?? parent;
  const sessions = await sessionsOf(l, who);
  const dates = o.dates ? o.dates(sessions) : sessions.slice(0, 3);
  const res = await bookRaw(who, l, { method: o.method ?? "card", ...(o.extra ?? {}) }, dates, child);
  const b = res.bookings[0];
  if (o.paid !== false) await markPaid(b.ref);
  return { child, l, ref: b.ref as string, dates, sessions };
}
const payTokenFor = (ref: string): string => {
  const out = execFileSync("npx", ["tsx", path.join(ROOT, "e2e/helpers/payTokenFor.ts"), op.tenantId!, ref], { cwd: path.join(ROOT, "server"), encoding: "utf8" });
  const m = out.match(/@@TOKEN@@(\S+)@@END@@/);
  if (!m) throw new Error("no pay token: " + out.slice(-200));
  return m[1];
};
const payLink = async (ref: string) => apiFetch<Record<string, any>>(`/api/public/booking-pay/${payTokenFor(ref)}`, null).catch(async (e) => { throw e; });

async function pCancelUi(child: string) {
  await pp.goto("/custdash/bookings");
  const card = cardWith(pp, child);
  await expect(card).toBeVisible({ timeout: 60_000 });
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
  await expect(opg.getByRole("button", { name: /Cancel booking|Approve refund|Accept refund|Decline refund|Mark|Cancel this day/ }).first()).toBeVisible({ timeout: 45_000 });
}
const opClick = async (name: RegExp | string) => opg.getByRole("button", { name }).first().click();
const sendReq = async (card: ReturnType<typeof cardWith>) => card.getByRole("button", { name: "Send cancellation request" }).click();

test.beforeAll(async ({ browser }) => {
  test.setTimeout(900_000);
  parent = await mkParent("p");
  parent2 = await mkParent("q");
  op = await mkOp();
  await ensureVenue(op);
  pp = (await uiCtx(browser, parent, /custdash/)).page;
  opg = (await uiCtx(browser, op, /company/)).page;
  await setSettings(op, { cancellationPolicies: DEFAULT_POLICIES, allowCardRefund: true, refundLetCustomerChoose: true, noRefundCredit: false, allowPartialCancel: true, partialAllowRefund: true, partialAllowWallet: true, partialAllowChangeDate: false, allowDateChanges: true, amendFee: 0, amendSelfService: false, amendNoticeHours: 0, amendLimit: 0 });
});

test("(1) CN-022 + (4) CN-007 + (5) CN-004", async () => {
  test.setTimeout(600_000);
  await check("CN-022", () => pp, async () => {
    const x = await booked({ tag: "cn022", offset: 1, lst: { runDays: 10 }, dates: (s) => [s[0], s[7], s[8]] });
    const card = await pCancelUi(x.child);
    await card.getByRole("button", { name: "Choose days" }).click();
    await card.getByRole("checkbox").nth(1).check();
    await card.getByRole("button", { name: /Refund/ }).first().click();
    await card.getByRole("button", { name: /^Cancel 1 day/ }).click();
    await expect.poll(async () => ((await opBooking(x.ref)).cancel ? 1 : 0), { timeout: 30_000 }).toBe(1);
    const far = await opBooking(x.ref);
    expect(far.cancel.amount, "far day pro-rata 18").toBe(18);
    await pp.goto("/custdash/bookings");
    const card2 = cardWith(pp, x.child);
    await card2.getByRole("button", { name: /Cancel booking/ }).click();
    await card2.getByRole("button", { name: "Choose days" }).click();
    await card2.getByRole("checkbox").first().check();
    await card2.getByRole("button", { name: /Refund/ }).first().click();
    await card2.getByRole("button", { name: /^Cancel 1 day/ }).click();
    await expect.poll(async () => ((await opBooking(x.ref)).kids?.[0]?.cancelledDays?.length ?? 0), { timeout: 30_000 }).toBe(2);
    const both = await opBooking(x.ref);
    await shot(pp, "CN-022");
    expect(both.cancel.amount, `2nd release wiped the 1st: cancel=${JSON.stringify(both.cancel)}`).toBe(18);
    expect(both.cancel.refund).toBe("pending");
    // third release: a further far day must ADD to the pending 18
    return `1st release (far day) cancel.amount=${far.cancel.amount}; after 2nd (near day, £0) cancel=${JSON.stringify({ refund: both.cancel.refund, amount: both.cancel.amount })}; cancelledDays=${JSON.stringify(both.kids?.[0]?.cancelledDays)}`;
  });
  await check("CN-022b-accumulate", () => pp, async () => {
    // two FAR days released one after the other must accumulate 18 + 18 = 36
    const x = await booked({ tag: "cn022b", offset: 10, lst: { runDays: 10 } });
    const card = await pCancelUi(x.child);
    await card.getByRole("button", { name: "Choose days" }).click();
    await card.getByRole("checkbox").nth(0).check();
    await card.getByRole("button", { name: /Refund/ }).first().click();
    await card.getByRole("button", { name: /^Cancel 1 day/ }).click();
    await expect.poll(async () => ((await opBooking(x.ref)).cancel?.amount ?? 0), { timeout: 30_000 }).toBe(18);
    await pp.goto("/custdash/bookings");
    const card2 = cardWith(pp, x.child);
    await card2.getByRole("button", { name: /Cancel booking/ }).click();
    await card2.getByRole("button", { name: "Choose days" }).click();
    await card2.getByRole("checkbox").nth(0).check();
    await card2.getByRole("button", { name: /Refund/ }).first().click();
    await card2.getByRole("button", { name: /^Cancel 1 day/ }).click();
    await expect.poll(async () => ((await opBooking(x.ref)).kids?.[0]?.cancelledDays?.length ?? 0), { timeout: 30_000 }).toBe(2);
    const b = await opBooking(x.ref);
    await shot(pp, "CN-022b-accumulate");
    expect(b.cancel.amount).toBe(36);
    return `two far-day releases accumulate: cancel.amount=${b.cancel.amount} refund=${b.cancel.refund}`;
  });

  await check("CN-007", () => opg, async () => {
    const x = await booked({ tag: "cn007", offset: 8 });
    await pCancelApi(parent, x.ref);
    await waitCancel(x.ref);
    await opOpen(x.child);
    await shot(opg, "CN-007");
    await opClick(/Decline refund/);
    await expect.poll(async () => (await opBooking(x.ref)).cancel?.refund, { timeout: 30_000 }).toBe("declined");
    const told = (await notifs(parent)).filter((n) => n.title.includes(x.ref) && /declin/i.test(n.title + n.body));
    expect(told.length, "parent bell about declined refund").toBeGreaterThan(0);
    return `operator clicked Decline refund -> cancel.refund=declined; parent notification: "${told[0].title}" / "${told[0].body.slice(0, 120)}"`;
  });

  await check("CN-004", () => pp, async () => {
    await setSettings(op, { noRefundCredit: true });
    try {
      const x = await booked({ tag: "cn004", offset: 1 });
      const w0 = await wallet(parent);
      const card = await pCancelUi(x.child);
      await expect(card.getByText(/No refund is due/)).toBeVisible();
      await expect(card.getByText(/credit note/)).toBeVisible();
      await shot(pp, "CN-004");
      await sendReq(card); await waitCancel(x.ref);
      const b = await opBooking(x.ref);
      expect(b.cancel.amount, `request amount ${JSON.stringify(b.cancel)}`).toBe(54);
      expect(b.cancel.refundTo).toBe("wallet");
      const wMid = await wallet(parent);
      expect(wMid - w0, "no wallet movement before approval").toBe(0);
      await opOpen(x.child);
      await shot(opg, "CN-004-op");
      await opAct(x.ref, { type: "refund-approve" });
      const w1 = await wallet(parent);
      expect(w1 - w0).toBe(54);
      const b2 = await opBooking(x.ref);
      return `policy £0 (inside no-refund window) but noRefundCredit on: UI shows credit-note line; request cancel=${JSON.stringify({ refund: b.cancel.refund, amount: b.cancel.amount, refundTo: b.cancel.refundTo })}; after provider approve wallet ${w0} -> ${w1} (+54), refundVia=${b2.cancel.refundVia}`;
    } finally { await setSettings(op, { noRefundCredit: false }); }
  });
});

test("(2) CN-009/011", async () => {
  test.setTimeout(500_000);
  await setSettings(op, { voucherProviders: [{ id: "vfv", name: "VF Vouchers", details: [{ label: "Account", value: "VF-ACCT-1" }] }] });
  await check("CN-009", () => opg, async () => {
    await setSettings(op, { customerArea: { wallet: false } });
    try {
      const x = await booked({ tag: "cn009", offset: 8, extra: { voucherScheme: "vfv" }, paid: false, method: "Childcare voucher" });
      await markPaid(x.ref);
      const card = await pCancelUi(x.child);
      await sendReq(card); await waitCancel(x.ref);
      await opOpen(x.child);
      const labels = await opg.getByRole("button", { name: /Accept refund|Mark refund|Approve refund/ }).allInnerTexts();
      await shot(opg, "CN-009");
      expect(labels.join("|")).toMatch(/Mark refund reimbursed/);
      await opClick(/Mark refund reimbursed/);
      await expect.poll(async () => (await opBooking(x.ref)).cancel?.refundVia, { timeout: 30_000 }).toBe("offline");
      return `voucher booking, wallet off: operator buttons [${labels.join(" | ")}]; after click refundVia=offline`;
    } finally { await setSettings(op, { customerArea: { wallet: true } }); }
  });
  await check("CN-011", () => opg, async () => {
    const x = await booked({ tag: "cn011", offset: 8, paid: false, method: "Cash" });
    await markPaid(x.ref);
    const card = await pCancelUi(x.child);
    await card.getByRole("button", { name: /Back to card/ }).click().catch(() => {});
    await sendReq(card); await waitCancel(x.ref);
    await opOpen(x.child);
    await shot(opg, "CN-011");
    const txt = await opg.locator("body").innerText();
    const labels = await opg.getByRole("button", { name: /Accept refund|Mark refund|Approve refund/ }).allInnerTexts();
    const note = txt.match(/[^\n]*(wasn.t paid by card|settle any refund directly)[^\n]*/i)?.[0] ?? "";
    expect(note, `settle-directly note on operator screen. buttons=[${labels.join(" | ")}]`).not.toBe("");
    await opClick(/Accept refund|Mark refund|Approve refund/);
    await expect.poll(async () => (await opBooking(x.ref)).cancel?.refundVia, { timeout: 30_000 }).toBe("offline");
    return `cash booking: operator note "${note.trim().slice(0, 160)}"; buttons [${labels.join(" | ")}]; refundVia=offline`;
  });
});

test("(3) CN-036 franchise split-fees", async () => {
  test.setTimeout(500_000);
  await check("CN-036", () => opg, async () => {
    const frEmail = `e2e-vf-fr-${stamp}@${TEST_EMAIL_DOMAIN}`;
    const inv = await apiPost<{ token: string }>("/api/invites", await op.token(), { role: "franchise" });
    const s = await fbSignUp(frEmail);
    await apiPost(`/api/invites/${inv.token}/accept`, s.idToken, {});
    const fr: Acct = { email: frEmail, uid: s.uid, tenantId: op.tenantId, name: op.name, token: tok(frEmail) };
    const l = await mkListing(fr, { title: `VF fr ${stamp}`, offset: 8 });
    const child = kid("cn036");
    const sessions = await sessionsOf(l, parent);
    const r = await bookRaw(parent, l, {}, sessions.slice(0, 3), child);
    const ref = r.bookings[0].ref as string;
    await markPaid(ref);
    expect((await opBooking(ref)).franchiseId, "franchise booking").toBeTruthy();
    const sf = async () => apiFetch<{ franchises: { revenue: number; fee: number }[] }>("/api/splitfees", await op.token());
    const s0 = await sf();
    await opOpen(child);
    await opg.getByRole("button", { name: "Cancel this day" }).first().click();
    await expect.poll(async () => ((await opBooking(ref)).refundLog?.length ?? 0), { timeout: 30_000 }).toBeGreaterThan(0);
    const b = await opBooking(ref);
    await opg.goto("/company/finance").catch(() => {});
    await shot(opg, "CN-036");
    const s1 = await sf();
    const r0 = s0.franchises.reduce((n, f) => n + f.revenue, 0), r1 = s1.franchises.reduce((n, f) => n + f.revenue, 0);
    const f0 = s0.franchises.reduce((n, f) => n + f.fee, 0), f1 = s1.franchises.reduce((n, f) => n + f.fee, 0);
    expect(r1, `revenue ${r0} -> ${r1}`).toBeLessThan(r0);
    return `one-day partial refund (refundLog ${JSON.stringify(b.refundLog?.map((x: any) => x.amount))}, pay=${b.pay}): split-fees franchise revenue ${r0} -> ${r1}, fee ${f0} -> ${f1}`;
  });
});

test("(6) AM-011 + (7) AM-012", async () => {
  test.setTimeout(500_000);
  await check("AM-011", () => pp, async () => {
    await setSettings(op, { amendFee: 5, amendSelfService: false, allowDateChanges: true });
    try {
      const x = await booked({ tag: "am011", offset: 8, lst: { runDays: 9 } });
      const from = x.dates[0], to = x.sessions[6];
      await apiPost(`/api/my/bookings/${x.ref}/amend`, await parent.token(), { moves: [{ from, to }] });
      const q = await opBooking(x.ref);
      expect(q.dateChangeRequest?.status, "queued when self-service off").toBe("pending");
      expect(q.amount).toBe(54);
      await opOpen(x.child);
      await shot(opg, "AM-011-before-approve");
      await opAct(x.ref, { type: "move-approve" });
      const b = await opBooking(x.ref);
      expect(b.amount, `booking ${JSON.stringify({ amount: b.amount, amountPaid: b.amountPaid, pay: b.pay, fee: b.dateChangeRequest?.feeCharged })}`).toBe(59);
      const link = await payLink(x.ref);
      expect(link.amount, `pay-link ${JSON.stringify(link)}`).toBe(5);
      await opOpen(x.child);
      await shot(opg, "AM-011");
      await pp.goto("/custdash/bookings"); await expect(cardWith(pp, x.child)).toBeVisible({ timeout: 60_000 }); await shot(pp, "AM-011-parent");
      return `approve move with amendFee £5: amount 54 -> ${b.amount}, amountPaid=${b.amountPaid}, pay='${b.pay}', amendFeesCharged=${b.amendFeesCharged}, feeCharged=${b.dateChangeRequest?.feeCharged}; public pay link asks £${link.amount}`;
    } finally { await setSettings(op, { amendFee: 0 }); }
  });
  await check("AM-012", () => pp, async () => {
    const sess = async (x: { l: L }) => {
      const bl = (await apiFetch<{ sessions: { date: string; bookedCount: number }[] }[]>(`/api/blocks?listingId=${x.l.id}`, await op.token()))[0];
      return { dayCounts: Object.fromEntries(bl.sessions.map((q) => [q.date, q.bookedCount])) as Record<string, number> };
    };
    // ON: applied immediately
    await setSettings(op, { amendSelfService: true });
    const x = await booked({ tag: "am012on", offset: 8, lst: { runDays: 9 } });
    const from = x.dates[0], to = x.sessions[6];
    const b0 = await sess(x);
    const res = await apiPost<Record<string, any>>(`/api/my/bookings/${x.ref}/amend`, await parent.token(), { moves: [{ from, to }] });
    const b = await opBooking(x.ref);
    expect(b.days, `days after plain move: ${JSON.stringify(b.days)} (resp amendApplied=${res.amendApplied})`).toContain(to);
    expect(b.days).not.toContain(from);
    expect(b.dateChangeRequest?.status).toBe("approved");
    const b1 = await sess(x);
    expect((b1.dayCounts?.[from] ?? 0)).toBe((b0.dayCounts?.[from] ?? 0) - 1);
    expect((b1.dayCounts?.[to] ?? 0)).toBe((b0.dayCounts?.[to] ?? 0) + 1);
    await pp.goto("/custdash/bookings"); await expect(cardWith(pp, x.child)).toBeVisible({ timeout: 60_000 });
    await shot(pp, "AM-012");
    // OFF: queues
    await setSettings(op, { amendSelfService: false });
    const y = await booked({ tag: "am012off", offset: 8, lst: { runDays: 9 } });
    await apiPost(`/api/my/bookings/${y.ref}/amend`, await parent.token(), { moves: [{ from: y.dates[0], to: y.sessions[6] }] });
    const q = await opBooking(y.ref);
    expect(q.dateChangeRequest?.status).toBe("pending");
    expect(q.days).toContain(y.dates[0]);
    await setSettings(op, { amendSelfService: true });
    return `ON: amendApplied=${res.amendApplied}, days ${JSON.stringify(x.dates)} -> ${JSON.stringify(b.days)}, request status=${b.dateChangeRequest?.status} selfService=${b.dateChangeRequest?.selfService}; dayCounts[${from}] ${b0.dayCounts?.[from]}->${b1.dayCounts?.[from]}, dayCounts[${to}] ${b0.dayCounts?.[to] ?? 0}->${b1.dayCounts?.[to]}. OFF: status=pending, days unchanged`;
  });
});

test("AM-012 fee preview (UI)", async () => {
  test.setTimeout(300_000);
  await check("AM-012-fee-preview", () => pp, async () => {
    await setSettings(op, { amendFee: 5, amendSelfService: true, allowDateChanges: true, amendAllowCheaper: true });
    try {
      const x = await booked({ tag: "am012fee", offset: 8, lst: { runDays: 9 } });
      await pp.goto("/custdash/bookings");
      const card = cardWith(pp, x.child);
      await expect(card).toBeVisible({ timeout: 60_000 });
      await card.getByRole("button", { name: /Change dates/ }).click();
      const modal = pp.locator('[role="dialog"]').last();
      await expect(pp.getByText(/admin fee/i).first()).toBeVisible({ timeout: 20_000 }).catch(() => {});
      const sel = pp.locator("select").filter({ has: pp.locator("option", { hasText: /Keep this date/ }) }).first();
      await sel.waitFor({ timeout: 20_000 });
      await expect.poll(async () => await sel.locator("option").count(), { timeout: 30_000 }).toBeGreaterThan(1);
      const optVals = await sel.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
      await sel.selectOption(optVals[optVals.length - 1]);
      await pp.waitForTimeout(800);
      await shot(pp, "AM-012-fee-preview");
      const before = (await pp.locator("body").innerText()).replace(/\s+/g, " ");
      const feeLines = before.match(/[^.]{0,60}(admin fee|£5\.00|£5)[^.]{0,60}/gi) ?? [];
      const btns = await pp.getByRole("button").allInnerTexts();
      expect(feeLines.length, `no fee mention before confirming. buttons=${btns.join(" | ")}`).toBeGreaterThan(0);
      return `before confirming, the modal says: ${feeLines.slice(0, 3).map((l) => '"' + l.trim() + '"').join(" ; ")}; buttons: ${btns.filter((b) => /move|change|confirm|request|save/i.test(b)).join(" | ")}`;
    } finally { await setSettings(op, { amendFee: 0 }); }
  });
});

test("(8) BQ-006", async () => {
  test.setTimeout(300_000);
  await check("BQ-006", () => opg, async () => {
    const l = await mkListing(op, { title: `VF bq006 ${stamp}`, offset: 8 });
    const sessions = await sessionsOf(l, op);
    const child = kid("bq006");
    const doc = await listingDoc(l.id);
    const res = await apiPost<{ bookings: Record<string, any>[] }>("/api/my/bookings", await op.token(), {
      listingId: l.id, blockId: doc.blocks[0].id, method: "cash", walletCap: 0, items: [{ pass: "3 days", child, age: 8, dates: sessions.slice(0, 3) }],
      onBehalfOf: { email: parent.email, name: "VF Family" }, overrideTotal: 40, overrideReason: "agreed on the phone",
    });
    const ref = res.bookings[0].ref as string;
    const b = await opBooking(ref);
    expect(b.amount).toBe(40);
    expect(b.priceOverride?.originalAmount).toBe(54);
    expect(b.priceOverride?.amount).toBe(40);
    // parent sends the same field -> 403
    const doc2 = await listingDoc(l.id, parent);
    const r = await fetch(`${API_URL}/api/my/bookings`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await parent.token()}` }, body: JSON.stringify({ listingId: l.id, blockId: doc2.blocks[0].id, method: "cash", walletCap: 0, items: [{ pass: "3 days", child: kid("bq006p"), age: 8, dates: sessions.slice(3, 6) }], overrideTotal: 10 }) });
    const rj = await r.text();
    expect(r.status, rj).toBe(403);
    await opOpen(child);
    await shot(opg, "BQ-006");
    return `operator on-behalf with overrideTotal 40 on £54: amount=${b.amount}, priceOverride=${JSON.stringify({ o: b.priceOverride.originalAmount, a: b.priceOverride.amount, by: b.priceOverride.by, reason: b.priceOverride.reason })}; same field from parent -> HTTP ${r.status} ${rj.slice(0, 100)}`;
  });
});

test("(9) CN-028 + (10) AW-025", async () => {
  test.setTimeout(500_000);
  await check("CN-028", () => pp, async () => {
    const name = kid("cn028");
    const t = await parent.token();
    await apiPost("/api/my/children", t, { name, dob: "2018-05-14" });
    const l = await mkListing(op, { title: `VF cn028 ${stamp}`, offset: 8 });
    const sessions = await sessionsOf(l, parent);
    const bk = (await bookRaw(parent, l, {}, sessions.slice(0, 3), name)).bookings[0];
    await markPaid(bk.ref);
    const trip = await apiPost<{ id: string }>("/api/trips", await op.token(), { destination: "VF Zoo", date: sessions[0], childNames: [name], listingId: l.id });
    const tripOf = async () => (await apiFetch<{ id: string; headcount?: number; attendees?: { n?: string }[] }[]>("/api/trips", await op.token())).find((x) => x.id === trip.id);
    const before = await tripOf();
    expect((before?.attendees ?? []).some((a) => a.n === name), "child is on the trip before cancelling").toBe(true);
    const card = await pCancelUi(name);
    await sendReq(card); await waitCancel(bk.ref);
    await expect.poll(async () => ((await tripOf())?.attendees ?? []).some((a) => a.n === name), { timeout: 40_000 }).toBe(false);
    const after = await tripOf();
    await opg.goto("/company/trips"); await opg.waitForTimeout(3000); await shot(opg, "CN-028");
    const bell = (await notifs(op)).find((n) => /trip day/i.test(n.title));
    return `trip attendees ${before?.attendees?.length} -> ${after?.attendees?.length} (headcount ${before?.headcount} -> ${after?.headcount}); provider bell: "${bell?.body?.slice(0, 120)}"`;
  });
  await check("AW-025", () => pp, async () => {
    const l = await mkListing(op, { title: `VF aw025 ${stamp}`, offset: 8, cap: 1, waitlist: true });
    const sessions = await sessionsOf(l, parent);
    const first = (await bookRaw(parent, l, { method: "cash" }, sessions.slice(0, 3), kid("aw025a"))).bookings[0];
    const cWait = kid("aw025b");
    const q = (await bookRaw(parent2, l, { method: "card" }, sessions.slice(0, 3), cWait)).bookings[0];
    expect(q.status).toBe("Waitlisted");
    const bq = await opBooking(q.ref);
    const link = await payLink(q.ref);
    const control = await payLink(first.ref);
    expect(link.closed, `waitlisted pay link: ${JSON.stringify(link)} (control unpaid confirmed booking asks £${control.amount})`).toBe(true);
    expect(control.amount).toBe(54);
    const pg2 = (await uiCtx(await pp.context().browser()!, parent2, /custdash/));
    await pg2.page.goto("/custdash/bookings");
    await pg2.page.getByText("My waiting list").first().click();
    const card = cardWith(pg2.page, cWait);
    await card.waitFor({ state: "visible", timeout: 60_000 }).catch(async () => { await shot(pg2.page, "AW-025"); throw new Error("waitlisted card not rendered on parent2 My bookings. Page text: " + (await pg2.page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 500)); });
    const ctext = (await card.innerText()).replace(/\s+/g, " ");
    await shot(pg2.page, "AW-025");
    const payBtn = await card.getByRole("button", { name: /Pay now|Pay £|Complete payment/ }).count();
    await pg2.ctx.close();
    expect(payBtn, `card: ${ctext}`).toBe(0);
    return `Waitlisted booking (amount £${bq.amount}, pay '${bq.pay}', childcare.outstanding=${bq.childcare?.outstanding}): public pay link closed:true (control confirmed unpaid booking asks £${control.amount}); parent card has no Pay button. Card text: "${ctext.slice(0, 160)}"`;
  });
});

test("(11) PY-009/012/025", async () => {
  test.setTimeout(500_000);
  await setSettings(op, { billing: { businessName: op.name, accountName: `VF ${stamp}`, sortCode: "12-34-56", accountNumber: "87654321", bankName: "Test Bank" } });
  await check("PY-009", () => opg, async () => {
    const x = await booked({ tag: "py009", offset: 8, paid: false, method: "tfc", extra: { voucherScheme: "HMRC Tax-Free Childcare" } });
    const b = await opBooking(x.ref);
    expect(b.pay).toBe("Awaiting voucher payment");
    await opOpen(x.child);
    await shot(opg, "PY-009");
    const btns = await opg.getByRole("button").allInnerTexts();
    expect(btns.some((t) => /Mark Tax-Free Childcare received/.test(t)), `buttons: ${btns.filter((t) => /Mark|Resend/.test(t)).join(" | ")}`).toBe(true);
    await pp.goto("/custdash/bookings"); await expect(cardWith(pp, x.child)).toBeVisible({ timeout: 60_000 });
    return `tfc booking: pay='${b.pay}' method='${b.method}'; operator buttons: ${btns.filter((t) => /Mark|Resend/.test(t)).join(" | ")}`;
  });
  await check("PY-012", () => pp, async () => {
    const x = await booked({ tag: "py012", offset: 8, paid: false, method: "tfc", extra: { voucherScheme: "HMRC Tax-Free Childcare", tfc: { amount: 30, remainderVia: "card", references: {} } } });
    const b = await opBooking(x.ref);
    const link = await payLink(x.ref);
    await pp.goto("/custdash/bookings"); await expect(cardWith(pp, x.child)).toBeVisible({ timeout: 60_000 }); await shot(pp, "PY-012");
    expect(link.amount, `booking ${JSON.stringify({ amount: b.amount, cardPaid: b.cardPaid, pay: b.pay, tfc: b.childcare })} link ${JSON.stringify(link)}`).toBe(24);
    return `tfc £30 + card remainder: booking amount=${b.amount}, cardPaid=${b.cardPaid}, pay='${b.pay}'; public pay link asks £${link.amount} (54 - 30)`;
  });
  await check("PY-025", () => opg, async () => {
    await setSettings(op, { payMethods: ["Card"] });
    try {
      const l = await mkListing(op, { title: `VF py025 ${stamp}`, offset: 8 });
      const sessions = await sessionsOf(l, parent);
      const doc = await listingDoc(l.id, parent);
      const post = (method: string) => fetch(`${API_URL}/api/my/bookings`, { method: "POST", headers: { "Content-Type": "application/json" , Authorization: `Bearer ${tokenCache}` }, body: JSON.stringify({ listingId: l.id, blockId: doc.blocks[0].id, method, walletCap: 0, items: [{ pass: "3 days", child: kid("py025"), age: 8, dates: sessions.slice(0, 3) }] }) });
      let tokenCache = await parent.token();
      const cash = await post("cash");
      const cashTxt = await cash.text();
      const card = await post("card");
      const cardTxt = await card.text();
      await opg.goto("/company/setup"); await opg.waitForTimeout(3000); await shot(opg, "PY-025");
      expect(cash.status, cashTxt).toBe(400);
      expect(card.status, cardTxt.slice(0, 200)).toBe(201);
      return `payMethods=[Card]: cash -> HTTP ${cash.status} ${cashTxt.slice(0, 110)}; card -> HTTP ${card.status}`;
    } finally { await setSettings(op, { payMethods: undefined }); }
  });
});

test("(12) BM-007 + (13) BM-003", async ({ browser }) => {
  test.setTimeout(500_000);
  let two: L; let sessNote = ""; let sessRows = "";
  await check("BM-007", () => undefined, async () => {
    two = await mkWeekly(op, { title: `VF Timings ${stamp}`, periods: [["Morning", "09:00", "12:00"], ["Afternoon", "13:00", "16:00"]] });
    const k = kid("bm007");
    await apiPost("/api/my/children", await parent.token(), { name: k, dob: "2018-05-14" });
    const doc = await listingDoc(two.id, parent);
    const day = doc.blocks[0].sessions![0].date;
    const res = await apiPost<Record<string, any>>("/api/my/bookings", await parent.token(), {
      listingId: two.id, blockId: doc.blocks[0].id, method: "cash", phone: "07700900123", walletCap: 0,
      items: [{ pass: "1 day", child: k, age: 8, dates: [day], timing: "Morning" }, { pass: "1 day", child: k, age: 8, dates: [day], timing: "Afternoon" }],
    });
    const mine = (await apiFetch<Record<string, any>[]>("/api/my/bookings", await parent.token())).filter((b) => b.listingId === two.id || (b.listing ?? "").includes("VF Timings"));
    const rows = mine.map((b) => ({ ref: b.ref, status: b.status, amount: b.amount, timing: b.timing, sessions: b.sessions, days: b.days }));
    expect(mine.length, JSON.stringify(rows)).toBe(2);
    expect(mine.every((b) => b.status === "Confirmed")).toBe(true);
    const sess = mine.map((b) => (b.sessions ?? []).join(","));
    expect(mine.map((b) => b.timing).sort(), JSON.stringify(rows)).toEqual(["Afternoon", "Morning"]);
    expect(new Set(mine.map((b) => b.ref)).size).toBe(2);
    sessNote = sess.join(" // ");
    const total = mine.reduce((a, b) => a + (b.amount ?? 0), 0);
    expect(total).toBe(40);
    expect(res.bookings.length).toBe(2);
    sessRows = JSON.stringify(rows);
    return `2 separate bookings (distinct refs), timings Morning + Afternoon, each Confirmed, amounts sum £${total} = basket £40: ${sessRows}`;
  });
  await check("BM-007-session-label", () => undefined, async () => {
    const mine = (await apiFetch<Record<string, any>[]>("/api/my/bookings", await parent.token())).filter((b) => (b.listing ?? "").includes("VF Timings"));
    const aft = mine.find((b) => b.timing === "Afternoon")!, mor = mine.find((b) => b.timing === "Morning")!;
    expect(aft.sessions.join(","), `Afternoon booking sessions=${JSON.stringify(aft.sessions)} Morning=${JSON.stringify(mor.sessions)}`).toMatch(/13:00/);
    return `Afternoon booking sessions ${JSON.stringify(aft.sessions)}`;
  });

  await check("BM-003", () => undefined, async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    try {
      const std = await mkWeekly(op, { title: `VF Standard ${stamp}` });
      await page.goto(`/book/${std.id}`);
      await page.getByRole("button", { name: /^1 day · £/ }).first().click();
      const timing = page.getByText(/choose a timing/i);
      if (await timing.isVisible().catch(() => false)) await page.getByRole("button", { name: /Full day/ }).first().click();
      await page.getByRole("button", { name: /^(Mon|Tue|Wed|Thu|Fri) \d+$/ }).first().click();
      await page.getByRole("button", { name: /Add .* to basket/ }).click();
      await page.getByRole("link", { name: "Sign in", exact: true }).first().click();
      await page.waitForURL(/\/login\?next=/);
      await page.getByRole("link", { name: "Create an account" }).click();
      await page.waitForURL(/\/parent\?tab=up&next=/);
      expect(decodeURIComponent(new URL(page.url()).searchParams.get("next")!)).toBe(`/book/${std.id}`);
      await shot(page, "BM-003-signup-page");
      const prov = page.getByRole("combobox");
      await prov.fill(op.name!);
      await expect(page.getByRole("option").first()).toBeVisible({ timeout: 45_000 });
      await page.getByRole("option").first().click();
      await page.getByPlaceholder("you@example.com").fill(`e2e-vf-par3-${stamp}@${TEST_EMAIL_DOMAIN}`);
      await page.locator('input[type="password"]').fill(TEST_PASSWORD);
      await page.getByRole("button", { name: /create/i }).last().click();
      await page.waitForURL(new RegExp(`/book/${std.id}`), { timeout: 90_000 });
      await expect(page.getByText(/Your basket/i).first()).toBeVisible({ timeout: 45_000 });
      await expect(page.getByText(/Total\s*£20\.00/).first()).toBeVisible();
      await shot(page, "BM-003");
      return `booking page -> Sign in -> Create an account -> /parent?tab=up&next=/book/${std.id} -> signed up -> returned to /book/${std.id} with basket (1 day, Total £20.00)`;
    } finally { await shot(page, "BM-003-last").catch(() => {}); await ctx.close(); }
  });
});
