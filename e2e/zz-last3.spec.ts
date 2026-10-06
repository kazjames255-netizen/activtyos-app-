import { test, expect, type Browser, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT, WEB_URL, API_URL } from "./helpers/env";
import { DEFAULT_POLICIES } from "../lib/cancellation";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, apiFetch, apiPost, fbSignIn, fbSignUp } from "./helpers/accounts";
import { cardWith } from "./helpers/ui";

const realFetch = globalThis.fetch;
globalThis.fetch = (async (...a: Parameters<typeof fetch>) => {
  for (let i = 0; ; i++) { try { return await realFetch(...a); } catch (e) { if (i >= 8) throw e; await new Promise((r) => setTimeout(r, 3000)); } }
}) as typeof fetch;
test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 30_000, navigationTimeout: 60_000 });
const stamp = Date.now().toString(36);
const SHOTS = path.join(ROOT, "e2e/review/shots/last3");
const OUT = path.join(SHOTS, "results.json");
const RESULTS: Record<string, { status: string; note: string }> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const rec = (id: string, status: string, note: string) => { RESULTS[id] = { status, note }; fs.writeFileSync(OUT, JSON.stringify(RESULTS, null, 1)); console.log(`RESULT ${id} ${status} :: ${note}`); };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const plus = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const ONLY = new Set((process.env.L3_ONLY ?? "").split(",").filter(Boolean));
const want = (k: string) => !ONLY.size || ONLY.has(k);

type Acct = { email: string; uid: string; tenantId?: string; token: () => Promise<string> };
const tok = (email: string) => async () => (await fbSignIn(email)).idToken;
const shot = (page: Page, id: string) => page.screenshot({ path: path.join(SHOTS, `${id}.png`), fullPage: true });
async function login(browser: Browser, a: { email: string }, home: RegExp, vp = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  await page.goto(`${WEB_URL}/login`);
  await page.getByPlaceholder("you@example.com").fill(a.email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(home, { timeout: 45_000 });
  return page;
}
async function mkParent(): Promise<Acct> {
  const email = `e2e-l3-p-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  await apiPost("/api/register-role", s.idToken, { role: "parent", postcode: "NN5 7EA" });
  await apiPost("/api/me/welcome", s.idToken, {});
  return { email, uid: s.uid, token: tok(email) };
}
const mkOps: Record<string, () => Promise<Acct>> = {};
let company: Acct | undefined; let ctr = 0;
async function mkOp(kind: "company" | "freelancer" | "franchise"): Promise<Acct> {
  if (kind === "franchise") {
    const company = await mkOp("company");
    const inv = await apiPost<{ token: string }>("/api/invites", await company.token(), { role: "franchise" });
    const email = `e2e-l3-franchise-${stamp}-${++ctr}@${TEST_EMAIL_DOMAIN}`;
    const s = await fbSignUp(email);
    await apiPost(`/api/invites/${inv.token}/accept`, s.idToken, {});
    return { email, uid: s.uid, tenantId: company.tenantId, token: tok(email) };
  }
  const email = `e2e-l3-${kind}-${stamp}-${++ctr}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  const name = `L3 ${kind} ${stamp}`;
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role: kind, businessName: name, providerName: name, providerNameMode: "business" });
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", r.tenantId], { stdio: "pipe" });
  return { email, uid: s.uid, tenantId: r.tenantId, token: tok(email) };
}
async function setSettings(a: Acct, patch: Record<string, unknown>) {
  const t = await a.token();
  const lib = ((await apiFetch<Record<string, unknown> | null>("/api/library", t)) ?? {}) as { settings?: Record<string, unknown> };
  await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ settings: { ...(lib.settings ?? {}), ...patch } }) });
}
interface L { id: string; title: string; tenantId: string; blockId: string; sessions: string[] }
async function mkListing(a: Acct, o: { title: string; offset: number; extra?: Record<string, unknown>; addonIds?: string[] }): Promise<L> {
  const t = await a.token();
  const lib = ((await apiFetch<Record<string, unknown> | null>("/api/library", t)) ?? {}) as { venues?: { id: string }[]; settings?: Record<string, unknown> };
  const vid = "l3-venue";
  await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ venues: (lib.venues ?? []).some((v) => v.id === vid) ? lib.venues : [...(lib.venues ?? []), { id: vid, name: "L3 Hall", address: "1 Test Way", city: "Northampton" }], settings: { ...(lib.settings ?? {}), marketplaceListed: true } }) });
  const period = await apiPost<{ id: string }>("/api/periods", t, { title: "Full day", start: "09:00", finish: "15:30" });
  const pass = await apiPost<{ id: string }>("/api/passes", t, { name: "3 days", days: 3 });
  const bundle = await apiPost<{ id: string }>("/api/block-bundles", t, { name: `L3 Block ${o.title}`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 54, calcOn: true });
  const from = plus(o.offset), to = plus(o.offset + 6);
  const l = await apiPost<{ id: string; tenantId: string }>("/api/listings", t, {
    title: o.title, venueId: vid, runFrom: from, runTo: to, blockMode: "custom", days: [0, 1, 2, 3, 4, 5, 6],
    maxAttendees: "16", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12",
    blockId: bundle.id, passes: [{ name: "3 days", price: 54, days: 3 }], bookingType: "auto", status: "live", visibility: "public",
    ...(o.addonIds ? { addonIds: o.addonIds } : {}), ...(o.extra ?? {}),
  });
  await apiFetch(`/api/block-bundles/${bundle.id}/listings`, t, { method: "PUT", body: JSON.stringify({ listingIds: [l.id] }) });
  const doc = await apiFetch<{ blocks: { id: string; sessions?: { date: string }[] }[] }>(`/api/listings/${l.id}`, t);
  return { id: l.id, title: o.title, tenantId: l.tenantId, blockId: doc.blocks[0].id, sessions: (doc.blocks[0].sessions ?? []).map((s) => s.date).sort() };
}
const raw = async (token: string, method: string, p: string, body?: unknown) => {
  const r = await fetch(`${API_URL}${p}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j: any = null; try { j = await r.json(); } catch { /* */ }
  return { status: r.status, body: j };
};
const money = (n: number) => `£${n.toFixed(2)}`;

let parent: Acct;
let pp: Page;
test.beforeAll(async ({ browser }) => {
  test.setTimeout(300_000);
  parent = await mkParent();
  pp = await login(browser, parent, /custdash/);
});

// ============================================================ BM-021
test("BM-021 add-on + meal together", async ({ browser }) => {
  if (!want("BM021")) test.skip();
  test.setTimeout(400_000);
  try {
    const op = await mkOp("company");
    const t = await op.token();
    const lib = ((await apiFetch<any>("/api/library", t)) ?? {}) as any;
    await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ addons: [{ id: "l3-tshirt", name: "T-shirt", type: "oneoff", price: 8, questions: [{ id: "q-size", label: "Size", type: "choice", options: ["S", "M", "L"], required: true }] }], settings: { ...(lib.settings ?? {}) } }) });
    const itemId = `l3-meal-${stamp}`;
    const menu = await apiPost<{ id: string }>("/api/meal-menus", t, { name: `L3 menu`, items: [{ id: itemId, name: "Pasta bake", price: 4, allergens: ["gluten"] }] });
    const plan: Record<string, any> = {}; for (let i = 8; i <= 14; i++) plan[plus(i)] = { menuId: menu.id, itemIds: [itemId] };
    const l = await mkListing(op, { title: `L3 Meals ${stamp}`, offset: 8, addonIds: ["l3-tshirt"], extra: { mealsEnabled: true, mealPlan: plan } });
    const child = `L3 BM ${stamp}`;
    const d = l.sessions.slice(0, 3);
    const pt = await parent.token();
    const r = await raw(pt, "POST", "/api/my/bookings", { listingId: l.id, blockId: l.blockId, method: "card", items: [{ pass: "3 days", child, age: 8, dates: d, addons: [{ id: "l3-tshirt", answers: { "q-size": "M" } }], meals: [{ menuItemId: itemId, date: d[0] }] }] });
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    const b = r.body.bookings[0];
    console.log("BM021 booking", JSON.stringify(b).slice(0, 1500));
    const opB = await apiFetch<any>(`/api/bookings/${b.ref}`, t);
    console.log("BM021 op booking", JSON.stringify(opB).slice(0, 2000));
    expect(opB.amount).toBe(54 + 8 + 4);
    const opg = await login(browser, op, /company/);
    await opg.goto("/company/bookings");
    await opg.getByText(child, { exact: true }).first().click();
    await opg.waitForTimeout(2500);
    await shot(opg, "BM-021-operator");
    await pp.goto("/custdash/bookings");
    const card = cardWith(pp, child);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.getByText(child).first().click().catch(() => {});
    await pp.waitForTimeout(2000);
    const meal = pp.getByText(/Pasta bake/).first();
    await meal.scrollIntoViewIfNeeded().catch(() => {});
    const parentSees = (await card.innerText()).replace(/\s+/g, " ");
    expect(parentSees).toMatch(/T-shirt/); expect(parentSees).toMatch(/Pasta bake/); expect(parentSees).toMatch(/£66\.00/);
    await pp.screenshot({ path: path.join(SHOTS, "BM-021.png") });
    rec("BM-021", "pending-look", `amount ${opB.amount}; ref ${b.ref}`);
  } catch (e) { rec("BM-021", "fail", String((e as Error).message).slice(0, 500)); }
});

// ============================================================ FD-025
test("FD-025 platform read-only on bookings", async ({ browser }) => {
  if (!want("FD025")) test.skip();
  test.setTimeout(300_000);
  try {
    const acc = JSON.parse(fs.readFileSync(path.join(ROOT, "e2e/.auth/accounts.json"), "utf8")).accounts.platform;
    const op = await mkOp("company");
    execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", op.tenantId!, `--2fa=${acc.uid}`], { stdio: "pipe" });
    const t = await op.token();
    const l = await mkListing(op, { title: `L3 FD025 ${stamp}`, offset: 10 });
    const child = `L3 FD ${stamp}`;
    const pt0 = await parent.token();
    // a second booking needing approval is not needed; one Confirmed+Unpaid booking is enough to prove "unchanged"
    const bk = await raw(pt0, "POST", "/api/my/bookings", { listingId: l.id, blockId: l.blockId, method: "card", items: [{ pass: "3 days", child, age: 8, dates: l.sessions.slice(0, 3) }] });
    expect(bk.status).toBeLessThan(300);
    const ref = bk.body.bookings[0].ref as string;
    const plat = (await fbSignIn(acc.email)).idToken;
    const lines: string[] = [];
    const q = `?tenantId=${op.tenantId}`;
    // reads
    const list = await raw(plat, "GET", `/api/bookings${q}`);
    console.log('LIST', list.status, JSON.stringify(list.body).slice(0,300));
    expect(list.status).toBe(200);
    const rows: any[] = Array.isArray(list.body) ? list.body : list.body?.bookings ?? [];
    expect(rows.some((r) => r.ref === ref), "platform list must contain the booking").toBe(true);
    lines.push(`GET /api/bookings?tenantId -> 200, ${rows.length} row(s) incl. ${ref}`);
    const one = await raw(plat, "GET", `/api/bookings/${ref}${q}`);
    expect(one.status).toBe(200); expect(one.body.ref).toBe(ref);
    lines.push(`GET /api/bookings/${ref} -> 200`);
    // writes
    const writes: [string, string, string, unknown][] = [
      ["POST", `/api/bookings/${ref}/actions${q}`, "actions paid", { type: "paid" }],
      ["POST", `/api/bookings/${ref}/actions${q}`, "actions approve", { type: "approve" }],
      ["POST", `/api/bookings/${ref}/actions${q}`, "actions decline", { type: "decline" }],
      ["POST", `/api/bookings/${ref}/actions${q}`, "actions cancel", { type: "cancel", refund: "full" }],
      ["POST", `/api/bookings/${ref}/actions${q}`, "actions cancel-child", { type: "cancel-child", ki: 0 }],
      ["POST", `/api/bookings/${ref}/actions${q}`, "actions note", { type: "note", text: "hq was here" }],
      ["POST", `/api/bookings/${ref}/record-payment${q}`, "record-payment", { amount: 10, method: "cash" }],
      ["POST", `/api/bookings/${ref}/nudge${q}`, "nudge", {}],
      ["PUT", `/api/bookings/${ref}/recon-notes${q}`, "recon-notes", { notes: "x" }],
      ["POST", `/api/bookings${q}`, "create booking", { listingId: l.id, blockId: l.blockId, items: [{ pass: "3 days", child: "HQ Kid", age: 8, dates: l.sessions.slice(0, 3) }], name: "X Y", email: "hq-x@activityos-test.com", tenantId: op.tenantId }],
      ["POST", `/api/bookings/bulk${q}`, "bulk", { refs: [ref], action: "paid" }],
    ];
    const statuses: string[] = [];
    for (const [m, p2, label, body] of writes) {
      const r = await raw(plat, m, p2, body);
      statuses.push(`${label}=${r.status} (${String(r.body?.error ?? "").slice(0, 60)})`);
      expect([401, 403], `${label} should be refused 403, got ${r.status} ${JSON.stringify(r.body)}`).toContain(r.status);
    }
    lines.push(`writes refused: ${statuses.join(", ")}`);
    const after = await apiFetch<any>(`/api/bookings/${ref}`, t);
    expect(after.status).toBe("Confirmed"); expect(after.pay).toBe("Unpaid"); expect(after.cancel ?? null).toBeNull(); expect(after.note ?? "").not.toContain("hq was here");
    const listAfter = await apiFetch<any>(`/api/bookings`, t);
    expect((Array.isArray(listAfter) ? listAfter : listAfter.bookings).length, "no booking created by HQ").toBe(1);
    lines.push(`operator re-read: still ${after.status}/${after.pay}, 1 booking only`);
    // UI
    const ctx = await browser.newContext({ storageState: path.join(ROOT, "e2e/.auth/platform.json"), viewport: { width: 1280, height: 900 } });
    const pg = await ctx.newPage();
    await pg.goto(`${WEB_URL}/platform/providers`, { waitUntil: "load" });
    await pg.getByText(/Loading providers/).waitFor({ state: "hidden", timeout: 40_000 }).catch(() => {});
    await pg.waitForTimeout(1500);
    const nav = (await pg.locator("nav, aside").first().innerText().catch(() => "")).replace(/\s+/g, " ");
    console.log("PLATFORM NAV:", nav.slice(0, 600));
    await shot(pg, "FD-025");
    const hasBookingNav = /\bBookings\b/i.test(nav);
    await pg.goto(`${WEB_URL}/platform/bookings`, { waitUntil: "load" });
    await pg.waitForTimeout(3000);
    const body = (await pg.locator("body").innerText()).replace(/\s+/g, " ");
    console.log("PLATFORM /bookings BODY:", body.slice(0, 500));
    const btns = await pg.getByRole("button", { name: /Mark paid|Approve|Decline|Cancel booking|Cancel all|Cancel this day|Take a booking|New booking|Refund/i }).count();
    await shot(pg, "FD-025-bookings-url");
    lines.push(`platform UI /platform/bookings: nav has Bookings item=${hasBookingNav}; booking action buttons on page=${btns}; url=${pg.url()}`);
    expect(btns).toBe(0);
    rec("FD-025", "pending-look", lines.join(" ; "));
  } catch (e) { rec("FD-025", "fail", String((e as Error).message).slice(0, 700)); }
});

// ============================================================ CN-019
for (const kind of ["company", "freelancer", "franchise"] as const) {
  test(`CN-019 cancel one child (${kind})`, async ({ browser }) => {
    if (!want("CN019") && !want(`CN019-${kind}`)) test.skip();
    test.setTimeout(500_000);
    const id = `CN-019-${kind}`;
    let opg: Page | undefined;
    try {
      const op = await mkOp(kind);
      await setSettings(op, { cancellationPolicies: DEFAULT_POLICIES, allowCardRefund: true, refundLetCustomerChoose: true, noRefundCredit: false, allowPartialCancel: true, partialAllowRefund: true, partialAllowWallet: true, allowDateChanges: true });
      const t = await op.token();
      const l = await mkListing(op, { title: `L3 CN ${kind} ${stamp}`, offset: 20 });
      const pt = await parent.token();
      const home = new RegExp(`/${kind}`);
      opg = await login(browser, op, home);
      const mk = async (a: string, b: string) => {
        const r = await raw(pt, "POST", "/api/my/bookings", { listingId: l.id, blockId: l.blockId, method: "card", walletCap: 0, items: [{ pass: "3 days", child: a, age: 8, dates: l.sessions.slice(0, 3) }, { pass: "3 days", child: b, age: 9, dates: l.sessions.slice(0, 3) }] });
        expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
        expect(r.body.bookings.length, "one booking for two siblings").toBe(1);
        const bk = r.body.bookings[0];
        const paid = await raw(t, "POST", `/api/bookings/${bk.ref}/actions`, { type: "paid" });
        expect(paid.status, JSON.stringify(paid.body)).toBeLessThan(300);
        return bk.ref as string;
      };
      const spots = async () => { const d = await apiFetch<any>(`/api/listings/${l.id}`, pt); return (d.blocks[0].sessions ?? []).slice(0, 3).map((x: any) => x.spotsLeft); };
      const blockOf = async () => (await apiFetch<any>(`/api/listings/${l.id}`, t)).blocks[0];
      const lines: string[] = [];
      // ---- operator cancels child A
      const A = `L3 A ${kind} ${stamp}`, B = `L3 B ${kind} ${stamp}`;
      const ref = await mk(A, B);
      const b0 = await apiFetch<any>(`/api/bookings/${ref}`, t);
      expect(b0.amount).toBe(108); expect((b0.kids ?? []).length).toBe(2);
      const blk0 = await blockOf(); const sp0 = await spots();
      lines.push(`2-child booking ${ref} amount ${b0.amount} kids ${b0.kids.map((k: any) => k.name).join("+")}; block bookedCount ${blk0.bookedCount}; spotsLeft ${JSON.stringify(sp0)}`);
      const base = `/${kind}/bookings`;
      await opg.goto(base);
      await opg.getByText(ref).first().click();
      const cancelA = opg.getByRole("button", { name: /Cancel all 3 days/ }).first();
      await expect(cancelA).toBeVisible({ timeout: 30_000 });
      expect(await opg.getByRole("button", { name: /Cancel all 3 days/ }).count()).toBe(2);
      await cancelA.click();
      await expect.poll(async () => ((await apiFetch<any>(`/api/bookings/${ref}`, t)).kids ?? []).filter((k: any) => k.cancelled).length, { timeout: 30_000 }).toBe(1);
      const b1 = await apiFetch<any>(`/api/bookings/${ref}`, t);
      const kA = b1.kids.find((k: any) => k.name === A), kB = b1.kids.find((k: any) => k.name === B);
      expect(kA.cancelled).toBe(true); expect(!!kB.cancelled).toBe(false);
      expect(b1.status).not.toBe("Cancelled");
      const rl = b1.refundLog ?? [];
      const blk1 = await blockOf(); const sp1 = await spots();
      lines.push(`OPERATOR: ${A} cancelled, ${B} stays; status ${b1.status}/${b1.pay}; refundLog ${JSON.stringify(rl.map((x: any) => [x.label, x.amount]))}; seats ${b0.seats}->${b1.seats}; block bookedCount ${blk0.bookedCount}->${blk1.bookedCount}; parent-visible spotsLeft first 3 days ${JSON.stringify(sp0)}->${JSON.stringify(sp1)}`);
      // register
      const reg = await raw(t, "GET", `/api/registers?date=${l.sessions[0]}`);
      const regTxt = JSON.stringify(reg.body);
      lines.push(`register ${l.sessions[0]} GET ${reg.status}: has ${B}=${regTxt.includes(B)}, has ${A}=${regTxt.includes(A)} ${regTxt.includes(A) ? "(" + regTxt.slice(regTxt.indexOf(A) - 80, regTxt.indexOf(A) + 200) + ")" : ""}`);
      await opg.waitForTimeout(1500);
      await shot(opg, `${id}-operator`);
      // ---- parent cancels child A via UI (partial: all A's days)
      const A2 = `L3 PA ${kind} ${stamp}`, B2 = `L3 PB ${kind} ${stamp}`;
      const ref2 = await mk(A2, B2);
      const blk2 = await blockOf(); const sp2 = await spots();
      await pp.goto("/custdash/bookings");
      const card = cardWith(pp, A2);
      await expect(card).toBeVisible({ timeout: 30_000 });
      const btn = card.getByRole("button", { name: /Cancel booking/ });
      if (!(await btn.isVisible().catch(() => false))) await card.getByText(A2).first().click();
      await btn.click();
      await expect(pp.getByText("Request cancellation")).toBeVisible();
      await card.getByRole("button", { name: "Choose days" }).click();
      const sect = card.locator("div.mb-1\\.5").filter({ hasText: A2 }).filter({ has: pp.getByRole("checkbox") });
      const boxes = sect.getByRole("checkbox");
      expect(await boxes.count()).toBe(3);
      for (let i = 0; i < 3; i++) await boxes.nth(i).check();
      const refundBtn = card.locator("button").filter({ hasText: /back —/ }).first();
      console.log("REFUND BTN COUNT", await card.locator("button").filter({ hasText: /Refund/ }).count(), await card.locator("button").filter({ hasText: /Refund/ }).allInnerTexts());
      await refundBtn.click({ timeout: 8000 }).catch((e) => console.log("refund click failed", String(e).slice(0, 100)));
      await card.screenshot({ path: path.join(SHOTS, `${id}-parent-form.png`) });
      await card.locator("div.mt-2.flex.gap-2").last().getByRole("button").first().click();
      await expect.poll(async () => ((await apiFetch<any>(`/api/bookings/${ref2}`, t)).kids ?? []).filter((k: any) => k.cancelled).length, { timeout: 30_000 }).toBe(1);
      const c1 = await apiFetch<any>(`/api/bookings/${ref2}`, t);
      const pA = c1.kids.find((k: any) => k.name === A2), pB = c1.kids.find((k: any) => k.name === B2);
      expect(pA.cancelled).toBe(true); expect(!!pB.cancelled).toBe(false);
      expect(c1.status).not.toBe("Cancelled");
      const blk3 = await blockOf(); const sp3 = await spots();
      lines.push(`PARENT(UI Choose days -> all of ${A2}'s 3 days): ${A2} cancelled, ${B2} stays; status ${c1.status}/${c1.pay}; refundLog ${JSON.stringify((c1.refundLog ?? []).map((x: any) => [x.label, x.amount, x.source]))}; cancel=${JSON.stringify(c1.cancel ?? null)}; seats ${c1.seats}; block bookedCount ${blk2.bookedCount}->${blk3.bookedCount}; spotsLeft ${JSON.stringify(sp2)}->${JSON.stringify(sp3)}`);
      await pp.goto("/custdash/bookings");
      const card2 = cardWith(pp, ref2);
      await expect(card2).toBeVisible({ timeout: 30_000 });
      await card2.getByRole("button", { name: /Details/ }).click().catch(() => {});
      await pp.waitForTimeout(1500);
      await shot(pp, `${id}-parent`);
      await opg.goto(base);
      await opg.getByText(ref2).first().click();
      await opg.waitForTimeout(2000);
      await shot(opg, `${id}-operator-after-parent`);
      rec(id, "pending-look", lines.join(" ; "));
    } catch (e) {
      try { if (opg) await shot(opg, `${id}-fail`); } catch { /* */ }
      rec(id, "fail", String((e as Error).message).slice(0, 700));
    }
  });
}
