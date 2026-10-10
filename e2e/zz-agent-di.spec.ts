import { test, expect, type Page, type Browser } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { apiFetch, apiPost, fbSignIn, fbSignUp, TEST_EMAIL_DOMAIN, TEST_PASSWORD } from "./helpers/accounts";
import { WEB_URL, ROOT, type TestAccount } from "./helpers/env";
import { cardWith } from "./helpers/ui";

test.describe.configure({ mode: "serial" });
const stamp = Date.now().toString(36);
const SHOTS = path.join(ROOT, "e2e/review/shots/di");
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const em = (r: string) => `e2e-di-${r}-${stamp}@${TEST_EMAIL_DOMAIN}`;

const results: Record<string, { ok: boolean; note: string; shot?: string }> = {};
const RESULTS_FILE = path.join(process.env.DI_OUT || "/tmp", `di-results-${stamp}.json`);
const save = () => fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 1));

async function shot(page: Page, id: string) {
  const f = path.join(SHOTS, `${id}.png`);
  await page.screenshot({ path: f, fullPage: true });
  return f;
}
/** Run one check: record pass/fail + evidence; never aborts the rest. */
async function check(id: string, page: Page | null, fn: () => Promise<string>) {
  try {
    const note = await fn();
    results[id] = { ok: true, note };
  } catch (e) {
    results[id] = { ok: false, note: `FAILED: ${(e as Error).message.split("\n").slice(0, 4).join(" | ")}` };
  }
  if (page && !page.isClosed()) { try { results[id].shot = await shot(page, id); } catch { /* */ } }
  save();
  console.log(`[${id}] ${results[id].ok ? "PASS" : "FAIL"} ${results[id].note}`);
}
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(0.011);

let op: TestAccount, pA: TestAccount, pB: TestAccount;
let opTok = "", aTok = "", bTok = "";
let listingId = "", blocks: { id: string; sessions: { date: string }[] }[] = [];
let tenantId = "";

async function login(browser: Browser, email: string, home: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${WEB_URL}/login`);
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(`**${home}`, { timeout: 45_000 });
  return { ctx, page };
}

test("setup fresh accounts + listing", async () => {
  test.setTimeout(180_000);
  const s = await fbSignUp(em("op"));
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role: "company", businessName: `E2E DI Co ${stamp}`, providerName: `E2E DI Co ${stamp}`, providerNameMode: "business" });
  tenantId = r.tenantId;
  op = { role: "company", email: em("op"), uid: s.uid, tenantId, tenantName: `E2E DI Co ${stamp}` };
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", tenantId], { stdio: "pipe" });
  for (const k of ["a", "b"] as const) {
    const ps = await fbSignUp(em(k));
    await apiPost("/api/register-role", ps.idToken, { role: "parent", postcode: "NN5 7EA" });
    await apiPost("/api/me/welcome", ps.idToken, {});
    const acc: TestAccount = { role: "parent", email: em(k), uid: ps.uid, tenantId: null, tenantName: null };
    if (k === "a") pA = acc; else pB = acc;
  }
  opTok = (await fbSignIn(op.email)).idToken; aTok = (await fbSignIn(pA.email)).idToken; bTok = (await fbSignIn(pB.email)).idToken;

  // Venue + marketplace
  const lib = ((await apiFetch<Record<string, unknown> | null>("/api/library", opTok)) as { venues?: unknown[]; settings?: Record<string, unknown> } | null) ?? {};
  await apiFetch("/api/library", opTok, { method: "PUT", body: JSON.stringify({ venues: [{ id: "di-venue", name: "E2E DI Hall", address: "1 Test Way", city: "Northampton" }], settings: { ...(lib.settings ?? {}), marketplaceListed: true } }) });
  // The Standard test camp: 1 day £20 / 3 days £54 / 5 days £90, 10 per day, 3 weeks Mon-Fri
  const period = await apiPost<{ id: string }>("/api/periods", opTok, { title: "Full day", start: "09:00", finish: "15:00" });
  const defs = [["1 day", 1, 20], ["3 days", 3, 54], ["5 days", 5, 90]] as const;
  const passIds: string[] = []; const passFlat: Record<string, number> = {}; const passMode: Record<string, "flat"> = {};
  for (const [name, days, price] of defs) { const p = await apiPost<{ id: string }>("/api/passes", opTok, { name, days }); passIds.push(p.id); passFlat[p.id] = price; passMode[p.id] = "flat"; }
  const bundle = await apiPost<{ id: string }>("/api/block-bundles", opTok, { name: `E2E DI block ${stamp}`, periodIds: [period.id], passIds, priced: true, masterPrice: 90, calcOn: true, passFlat, passMode });
  const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7)); const end = new Date(start); end.setDate(end.getDate() + 18);
  const L = await apiPost<{ id: string }>("/api/listings", opTok, { title: `E2E DI Standard camp ${stamp}`, venueId: "di-venue", runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "10", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "11", blockId: bundle.id, passes: defs.map(([name, days, price]) => ({ name, price, days })), bookingType: "auto", status: "live", visibility: "public" });
  listingId = L.id;
  await apiFetch(`/api/block-bundles/${bundle.id}/listings`, opTok, { method: "PUT", body: JSON.stringify({ listingIds: [L.id] }) });
  const doc = await apiFetch<{ blocks: typeof blocks; passes: unknown[] }>(`/api/listings/${L.id}`, aTok);
  blocks = doc.blocks;
  console.log("listing", listingId, "blocks", blocks.length, JSON.stringify(doc.passes));
  expect(blocks.length).toBeGreaterThanOrEqual(3);
});

test("logins", async ({ browser }) => {
  test.setTimeout(180_000);
  pageA = (await login(browser, pA.email, "/custdash/browse")).page;
  pageB = (await login(browser, pB.email, "/custdash/browse")).page;
  pageO = (await login(browser, op.email, "/company/bookings")).page;
});



async function mkKid(tok: string, name: string) {
  return (await apiPost<{ id: string }>("/api/my/children", tok, { name, dob: "2018-05-14" })).id;
}
const kids: { name: string; id: string }[] = [];
const kid = (i: number) => kids[i];

type Rule = { kind: "person" | "session" | "early"; moreThan?: number; method: "price" | "subtract" | "percent"; value: number; passNames?: string[]; beforeDate?: string };
const setRules = (rs: Rule[]) =>
  apiFetch(`/api/listings/${listingId}`, opTok, { method: "PUT", body: JSON.stringify({ discounts: rs.map((r, i) => ({ id: `r${i}${Date.now()}`, kind: r.kind, name: `${r.kind} rule ${i}`, passNames: r.passNames ?? [], enabled: true, appliesTo: "all", moreThan: r.moreThan ?? 1, method: r.method, value: r.value, beforeDate: r.beforeDate ?? "" })) }) });
const mkCode = (o: Record<string, unknown>) => apiPost<{ id: string }>("/api/discounts", opTok, { active: true, ...o });

interface BookRow { ref: string; amount: number; listPrice?: number; discountOff?: number; walletApplied?: number; pay?: string; status?: string; discountCodes?: string[]; discountNames?: string[] }
type Item = { pass: string; week: number; kid: { name: string; id: string }; days?: number; dates?: string[] };
const passDays: Record<string, number> = { "1 day": 1, "3 days": 3, "5 days": 5 };
const itemOf = (x: Item) => ({ pass: x.pass, child: x.kid.name, childId: x.kid.id, age: 8, dates: x.dates ?? blocks[x.week].sessions.slice(0, x.days ?? passDays[x.pass]).map((d) => d.date) });
async function book(tok: string, items: Item[], extra: Record<string, unknown> = {}, lid = listingId, bl = blocks[0].id) {
  const r = await apiPost<{ bookings: BookRow[] }>("/api/my/bookings", tok, { listingId: lid, blockId: bl, method: "card", items: items.map(itemOf), ...extra });
  const sum = (f: (b: BookRow) => number) => Math.round(r.bookings.reduce((s, b) => s + f(b), 0) * 100) / 100;
  // GET the stored rows (the POST body may omit the money fields)
  const mine = await apiFetch<BookRow[]>("/api/my/bookings", tok);
  const rows = r.bookings.map((b) => mine.find((m) => m.ref === b.ref) ?? b);
  const tot = (f: (b: BookRow) => number) => Math.round(rows.reduce((s, b) => s + f(b), 0) * 100) / 100;
  void sum;
  return { rows, refs: rows.map((b) => b.ref), amount: tot((b) => Number(b.amount ?? 0)), off: tot((b) => Number(b.discountOff ?? 0)), listPrice: tot((b) => Number(b.listPrice ?? b.amount ?? 0)), wallet: tot((b) => Number(b.walletApplied ?? 0)) };
}
const balance = async (tok: string) => Math.round(((await apiFetch<{ balances: { tenantId: string; balance: number }[] }>("/api/my/wallet", tok)).balances.find((b) => b.tenantId === tenantId)?.balance ?? 0) * 100) / 100;
const credit = (email: string, amt: number) => execFileSync("npx", ["tsx", "../e2e/helpers/walletCredit.ts", tenantId, email, String(amt)], { cwd: path.join(ROOT, "server"), stdio: "pipe" });

let pageA: Page, pageB: Page, pageO: Page;

/** UI: open the booking page, pick pass(es) + dates, add children, land on the pay stage. */
async function toPay(page: Page, o: { passes: { pass: string; week: number }[]; kids: string[]; lid?: string }) {
  await page.goto(`/book/${o.lid ?? listingId}`);
  for (const x of o.passes) {
    await page.getByRole("button", { name: new RegExp(`^${x.pass} · £`) }).first().click();
    const timing = page.getByRole("button", { name: /Full day/ });
    if (await timing.first().isVisible().catch(() => false)) await timing.first().click();
    const base = blocks[x.week].sessions.map((d) => d.date);
    for (let i = 0; i < passDays[x.pass]; i++) {
      const dn = new Date(base[i] + "T12:00:00").getDate();
      await page.getByRole("button", { name: new RegExp(`^(Mon|Tue|Wed|Thu|Fri) ${dn}$`) }).nth(x.week >= 0 ? x.week * 0 : 0).click();
    }
    await page.getByRole("button", { name: /Add .* to basket/ }).click();
  }
  await page.getByRole("button", { name: /Next — add children/ }).click();
  for (const k of o.kids) await page.getByText(`Add ${k}`, { exact: false }).first().click({ timeout: 30_000 });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Have discount codes?")).toBeVisible({ timeout: 30_000 });
}
async function applyCode(page: Page, code: string) {
  await page.getByPlaceholder("Type a code…").fill(code);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
}
const dueNow = async (page: Page) => Number((await page.getByText("Due now").locator("xpath=following-sibling::*[1]").first().innerText()).replace(/[^0-9.]/g, ""));


const newKid = async (tok = aTok, tag = "K") => { const n = `DI ${tag}${kids.length} ${stamp}`; const k = { name: n, id: await mkKid(tok, n) }; kids.push(k); return k; };
const ukToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const ukPlus = (n: number) => { const d = new Date(ukToday() + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const hasText = async (page: Page, re: RegExp | string, ms = 20_000) => expect(page.locator("body")).toContainText(re, { timeout: ms });
async function viewBooking(page: Page, ref: string) {
  await page.goto("/custdash/bookings");
  await expect(cardWith(page, `Ref ${ref}`)).toBeVisible({ timeout: 45_000 });
}

test("auto discounts via real parent bookings (DI-001..008)", async () => {
  test.setTimeout(420_000);
  // DI-001 sibling subtract £5
  await setRules([{ kind: "person", moreThan: 1, method: "subtract", value: 5 }]);
  await check("DI-001", pageA, async () => {
    const [a, b, c] = [await newKid(), await newKid(), await newKid()];
    const two = await book(aTok, [{ pass: "3 days", week: 0, kid: a }, { pass: "3 days", week: 0, kid: b }]);
    near(two.amount, 98); near(two.off, 10);
    const one = await book(aTok, [{ pass: "3 days", week: 1, kid: c }]);
    near(one.amount, 54); near(one.off, 0);
    await viewBooking(pageA, two.refs[0]);
    return `parent booked 2 children on 3 days wk1: ${two.refs.join(",")} amount £${two.amount} (2x54 - 2x5), discountOff ${two.off}; 1 child: ${one.refs[0]} £${one.amount}, off ${one.off}`;
  });
  // DI-004 two different lines (same rule)
  await check("DI-004", pageA, async () => {
    const [a, b] = [await newKid(), await newKid()];
    const r = await book(aTok, [{ pass: "3 days", week: 1, kid: a }, { pass: "3 days", week: 2, kid: b }]);
    await viewBooking(pageA, r.refs[0]);
    if (Math.abs(r.amount - 108) > 0.01) throw new Error(`BUG: child A (wk2) and child B (wk3) are on DIFFERENT lines but the server charged £${r.amount} (discountOff £${r.off}) instead of £108: sibling rule applied across lines (server/src/routes/my.ts lineKey omits dates). Refs ${r.refs.join(",")}`);
    return `child A wk2 + child B wk3 on separate lines: ${r.refs.join(",")} total £${r.amount}, discountOff ${r.off} (no sibling discount, as designed)`;
  });
  // DI-002 percent
  await setRules([{ kind: "person", moreThan: 1, method: "percent", value: 10 }]);
  await check("DI-002", pageA, async () => {
    const r = await book(aTok, [{ pass: "3 days", week: 2, kid: await newKid() }, { pass: "3 days", week: 2, kid: await newKid() }]);
    near(r.amount, 97.2); near(r.off, 10.8);
    await viewBooking(pageA, r.refs[0]);
    return `2 children, 10%: ${r.refs.join(",")} total £${r.amount}, off £${r.off}`;
  });
  // DI-003 discounted price £45
  await setRules([{ kind: "person", moreThan: 1, method: "price", value: 45 }]);
  await check("DI-003", pageA, async () => {
    const r = await book(aTok, [{ pass: "3 days", week: 0, kid: await newKid() }, { pass: "3 days", week: 0, kid: await newKid() }]);
    near(r.amount, 90); near(r.off, 18);
    await viewBooking(pageA, r.refs[0]);
    return `2 children at discounted price £45 each: ${r.refs.join(",")} total £${r.amount}, off £${r.off}`;
  });
  // DI-005 limited to 5 days
  await setRules([{ kind: "person", moreThan: 1, method: "subtract", value: 5, passNames: ["5 days"] }]);
  await check("DI-005", pageA, async () => {
    const r = await book(aTok, [{ pass: "3 days", week: 1, kid: await newKid() }, { pass: "3 days", week: 1, kid: await newKid() }]);
    near(r.amount, 108); near(r.off, 0);
    await viewBooking(pageA, r.refs[0]);
    return `rule limited to '5 days'; 2 children on '3 days': ${r.refs.join(",")} total £${r.amount}, off ${r.off}`;
  });
  // DI-007 / DI-008 multi-session (more than 3 sessions) 10%
  await setRules([{ kind: "session", moreThan: 3, method: "percent", value: 10 }]);
  await check("DI-007", pageA, async () => {
    const r = await book(aTok, [{ pass: "3 days", week: 2, kid: await newKid() }, { pass: "3 days", week: 2, kid: await newKid() }]);
    near(r.amount, 97.2); near(r.off, 10.8);
    await viewBooking(pageA, r.refs[0]);
    return `3 days x 2 children = 6 sessions > 3: ${r.refs.join(",")} total £${r.amount}, off £${r.off}`;
  });
  await check("DI-008", pageA, async () => {
    const r = await book(aTok, [{ pass: "3 days", week: 0, kid: await newKid() }]);
    near(r.amount, 54); near(r.off, 0);
    await viewBooking(pageA, r.refs[0]);
    return `exactly 3 sessions (not more than 3): ${r.refs[0]} total £${r.amount}, off ${r.off}`;
  });
  await setRules([]);
});

test("codes at the pay step (DI-027, 044-048)", async () => {
  test.setTimeout(540_000);
  await setRules([]);
  await mkCode({ code: "PCT10", type: "percent", value: 10 });
  await mkCode({ code: "FIVE", type: "amount", value: 5 });
  await mkCode({ code: "EXCL", type: "percent", value: 5, exclusive: true });
  await mkCode({ code: "PERKID", type: "perAttendee", value: 3 });
  await mkCode({ code: "MIN80", type: "percent", value: 10, minSpend: 80 });
  await mkCode({ code: "RESB", type: "percent", value: 20, assignedTo: pB.email, assignedName: "Family B" });
  const k = await newKid(); const k2 = await newKid();
  const p = pageA;
  await check("DI-027", p, async () => {
    await toPay(p, { passes: [{ pass: "5 days", week: 0 }], kids: [k.name] });
    await applyCode(p, "NOSUCH");
    await hasText(p, /That code isn.t recognised/);
    await hasText(p, "£90.00");
    return "typed NOSUCH at the pay step: 'That code isn't recognised' shown, total unchanged at £90.00";
  });
  await check("DI-044", p, async () => {
    await toPay(p, { passes: [{ pass: "5 days", week: 0 }], kids: [k.name] });
    await applyCode(p, "PCT10"); await hasText(p, "Code PCT10");
    await applyCode(p, "FIVE"); await hasText(p, "Code FIVE");
    await hasText(p, /[−-]£9.00/); await hasText(p, /[−-]£5.00/);
    expect(await dueNow(p)).toBe(76);
    return "5 days £90 + PCT10 (-£9.00) + FIVE (-£5.00): both accepted, Due now £76.00 (added, not compounded)";
  });
  await check("DI-045", p, async () => {
    await toPay(p, { passes: [{ pass: "5 days", week: 0 }], kids: [k.name] });
    await applyCode(p, "PCT10"); await hasText(p, "Code PCT10");
    await applyCode(p, "EXCL");
    await hasText(p, /can.t be combined/i);
    await expect(p.getByText("Code EXCL")).toHaveCount(0);
    const refusedShot = await shot(p, "DI-045-refusal");
    await toPay(p, { passes: [{ pass: "5 days", week: 0 }], kids: [k.name] });
    await applyCode(p, "EXCL"); await hasText(p, "Code EXCL"); await hasText(p, /[−-]£4.50/);
    
    void refusedShot;
    return "PCT10 then EXCL: EXCL refused ('can't be combined'); EXCL alone on a fresh basket accepted (-£4.50). Shots: DI-045-refusal.png (refusal), DI-045.png (alone)";
  });
  await check("DI-047", p, async () => {
    await toPay(p, { passes: [{ pass: "1 day", week: 0 }], kids: [k.name, k2.name] });
    await applyCode(p, "PERKID"); await hasText(p, "Code PERKID"); await hasText(p, /[−-]£6.00/);
    expect(await dueNow(p)).toBe(34);
    await shot(p, "DI-047-perchild");
    await toPay(p, { passes: [{ pass: "1 day", week: 0 }], kids: [k.name, k2.name] });
    await applyCode(p, "FIVE"); await hasText(p, "Code FIVE"); await hasText(p, /[−-]£5.00/);
    expect(await dueNow(p)).toBe(35);
    return "2 children on 1 day (£40): per-child PERKID -£6.00 -> Due £34.00; per-booking FIVE -£5.00 once -> Due £35.00. Shots DI-047-perchild.png + DI-047.png";
  });
  await check("DI-048", p, async () => {
    await setRules([{ kind: "early", method: "subtract", value: 15, beforeDate: ukPlus(30) }]);
    await toPay(p, { passes: [{ pass: "5 days", week: 0 }], kids: [k.name] });
    await applyCode(p, "MIN80");
    await hasText(p, /Spend at least £80\.00/);
    await expect(p.getByText("Code MIN80")).toHaveCount(0);
    await shot(p, "DI-048-refused");
    await toPay(p, { passes: [{ pass: "5 days", week: 0 }, { pass: "1 day", week: 1 }], kids: [k.name] });
    await applyCode(p, "MIN80"); await hasText(p, "Code MIN80"); await hasText(p, /[−-]£9.50/);
    expect(await dueNow(p)).toBe(85.5);
    return "early bird -£15 takes the £90 order to £75: MIN80 (min £80) refused 'Spend at least £80.00'; adding a £20 pass (95 after early bird) accepted: -£9.50, Due £85.50. Shots DI-048-refused.png + DI-048.png";
  });
  await setRules([]);
});

test("reserved code, boundaries, details (DI-046, 049, 050)", async () => {
  test.setTimeout(540_000);
  const kb = await newKid(bTok, "B");
  await check("DI-046", pageA, async () => {
    await toPay(pageB, { passes: [{ pass: "1 day", week: 0 }], kids: [kb.name] });
    await applyCode(pageB, "RESB"); await hasText(pageB, "Code RESB"); await hasText(pageB, /[−-]£4.00/);
    await shot(pageB, "DI-046-family");
    const ka = await newKid();
    await toPay(pageA, { passes: [{ pass: "1 day", week: 0 }], kids: [ka.name] });
    await applyCode(pageA, "RESB");
    await hasText(pageA, /reserved for another/i);
    await expect(pageA.getByText("Code RESB")).toHaveCount(0);
    return "RESB reserved for family B: B applied it (-£4.00 = 20% of £20); parent A refused ('reserved for another customer'), total stays £20.00. Shots DI-046-family.png + DI-046.png (refusal)";
  });
  await check("DI-049", pageA, async () => {
    await setRules([{ kind: "session", moreThan: 3, method: "percent", value: 10 }, { kind: "early", method: "subtract", value: 10, beforeDate: ukToday() }]);
    const three = await book(aTok, [{ pass: "3 days", week: 0, kid: await newKid() }]);
    near(three.amount, 44); near(three.off, 10); // 3 sessions: no multi-session; early bird on its LAST day (today) still applies
    const k4 = await newKid();
    const four = await book(aTok, [{ pass: "3 days", week: 1, kid: k4 }, { pass: "1 day", week: 2, kid: k4 }]);
    // 4 sessions: 54+20=74, -10% = 66.60, then early -10 = 56.60
    near(four.amount, 56.6); near(four.off, 17.4);
    await setRules([{ kind: "early", method: "subtract", value: 10, beforeDate: ukPlus(-1) }]);
    const late = await book(aTok, [{ pass: "1 day", week: 0, kid: await newKid() }]);
    near(late.amount, 20); near(late.off, 0); // early bird dated yesterday: not applied
    await viewBooking(pageA, four.refs[0]);
    return `3 sessions: ${three.refs[0]} £${three.amount} (no multi-session, early bird on its last day -£10); 4 sessions: ${four.refs[0]} £${four.amount} (-10% multi-session then -£10 early); early bird dated yesterday: ${late.refs[0]} £${late.amount}, off 0`;
  });
  await check("DI-050", pageA, async () => {
    await setRules([{ kind: "person", moreThan: 1, method: "subtract", value: 5 }]);
    const r = await book(aTok, [{ pass: "3 days", week: 2, kid: await newKid() }, { pass: "3 days", week: 2, kid: await newKid() }], { discountCodes: ["PCT10"] });
    const ref = r.refs[0];
    await viewBooking(pageA, ref);
    const card = cardWith(pageA, `Ref ${ref}`);
    const det = card.getByRole("button", { name: /detail|view|more|^open/i }).first();
    if (await det.isVisible().catch(() => false)) await det.click().catch(() => {});
    await expect(card).toContainText("Price before discount", { timeout: 15_000 });
    const parentText = await card.innerText();
    await shot(pageA, "DI-050");
    await pageO.goto("/company/bookings");
    await pageO.getByText(ref).first().click({ timeout: 45_000 });
    await expect(pageO.getByText("Price before discount").first()).toBeVisible({ timeout: 20_000 });
    await shot(pageO, "DI-050-provider");
    const provText = await pageO.locator("body").innerText();
    for (const m of [`£${r.listPrice.toFixed(2)}`, `£${r.amount.toFixed(2)}`]) { expect(parentText).toContain(m); expect(provText).toContain(m); }
    return `${ref}: price before discount £${r.listPrice.toFixed(2)}, discount £${r.off.toFixed(2)}, total £${r.amount.toFixed(2)} on BOTH the parent's My bookings card and the provider's booking detail (shots DI-050.png, DI-050-provider.png)`;
  });
  await setRules([]);
});

test("wallet (DI-038..041)", async () => {
  test.setTimeout(540_000);
  const p = pageA;
  expect(await balance(aTok)).toBe(0);
  const walletLine = (amt: string) => hasText(p, new RegExp(`Wallet credit[^]*${amt}`, "i"));
  await check("DI-039", p, async () => {
    credit(pA.email, 30);
    const k = await newKid();
    await toPay(p, { passes: [{ pass: "5 days", week: 1 }], kids: [k.name] });
    await hasText(p, "£30.00");
    await p.getByRole("radio", { name: /Use part of it/ }).click(); // checkout ASKS: nothing is applied until the parent chooses
    await p.locator('input[type="range"]').fill("10");
    await hasText(p, "£20.00"); // credit left in wallet
    expect(await dueNow(p)).toBe(80);
    await shot(p, "DI-039");
    const r = await book(aTok, [{ pass: "5 days", week: 1, kid: k }], { walletCap: 10 });
    near(r.wallet, 10); near(r.amount, 80);
    expect(await balance(aTok)).toBe(20);
    return `wallet £30, slider to £10: Due now £80.00; booking ${r.refs[0]} walletApplied £${r.wallet}, wallet left £20.00`;
  });
  await check("DI-038", p, async () => {
    credit(pA.email, 10); // back to £30
    expect(await balance(aTok)).toBe(30);
    const k = await newKid();
    await toPay(p, { passes: [{ pass: "5 days", week: 2 }], kids: [k.name] });
    await hasText(p, "£30.00");
    await p.getByRole("radio", { name: /Use my credit/ }).click(); // checkout ASKS before spending credit
    expect(await dueNow(p)).toBe(60);
    await shot(p, "DI-038");
    const r = await book(aTok, [{ pass: "5 days", week: 2, kid: k }], { walletCap: 30 });
    near(r.wallet, 30); near(r.amount, 60);
    expect(await balance(aTok)).toBe(0);
    await viewBooking(p, r.refs[0]);
    await shot(p, "DI-038-booking");
    return `wallet £30 applied after choosing 'Use my credit' at checkout: Due now £60.00; booking ${r.refs[0]} walletApplied £${r.wallet}, wallet now £0`;
  });
  void walletLine;
  await check("DI-040", p, async () => {
    credit(pA.email, 100);
    const k = await newKid();
    await toPay(p, { passes: [{ pass: "1 day", week: 0 }], kids: [k.name] });
    await p.getByRole("radio", { name: /Use my credit/ }).click(); // checkout ASKS before spending credit
    expect(await dueNow(p)).toBe(0);
    await shot(p, "DI-040-pay");
    const phone = p.getByPlaceholder("e.g. 07700 900123");
    if (await phone.isVisible().catch(() => false)) { if (!(await phone.inputValue())) await phone.fill("07700900123"); }
    await p.getByRole("button", { name: /Confirm|Book|Pay/i }).last().click();
    await expect(p.getByRole("heading", { name: /Congratulations/ })).toBeVisible({ timeout: 45_000 });
    const rows = await apiFetch<BookRow[]>("/api/my/bookings", aTok);
    const row = rows.filter((b) => Number(b.walletApplied) === 20 && b.pay === "Funded")[0];
    expect(row, "a Funded booking with walletApplied 20").toBeTruthy();
    expect(await balance(aTok)).toBe(80);
    return `wallet £100, 1 day £20: Due now £0.00, booking ${row.ref} pay=${row.pay}, walletApplied £20, wallet now £80 (UI confirmation screen shot DI-040.png)`;
  });
  await check("DI-041", pageA, async () => {
    const full = await provisionFull();
    const kb = await newKid(bTok, "BF"); const ka = await newKid(aTok, "AF");
    const before = await balance(aTok);
    const a1 = await book(bTok, [{ pass: "Day pass", week: 0, kid: kb, dates: [fullBlocks[0].sessions[0].date] }], {}, full.id, full.blockId);
    expect(a1.rows[0].status).not.toMatch(/wait/i);
    const a2 = await book(aTok, [{ pass: "Day pass", week: 0, kid: ka, dates: [fullBlocks[0].sessions[0].date] }], {}, full.id, full.blockId);
    expect(String(a2.rows[0].status)).toMatch(/wait/i);
    expect(a2.wallet).toBe(0);
    expect(await balance(aTok)).toBe(before);
    await pageA.goto("/custdash/bookings");
    await pageA.getByText("My waiting list").first().click({ timeout: 45_000 });
    await expect(pageA.locator("body")).toContainText(a2.refs[0], { timeout: 20_000 });
    return `listing with 1 place: B took it, A joined the waiting list ${a2.refs[0]} (status ${a2.rows[0].status}); walletApplied 0, wallet unchanged at £${before}`;
  });
});

async function provisionFull() {
  const { provisionLiveListing } = await import("./helpers/tenantData");
  const L = await provisionLiveListing(op, { title: `E2E DI Full ${stamp}`, price: 20, maxAttendees: 1, waitlist: true });
  const doc = await apiFetch<{ blocks: typeof blocks }>(`/api/listings/${L.id}`, aTok);
  const full = { id: L.id, blockId: doc.blocks[0].id };
  fullBlocks = doc.blocks;
  return full;
}
let fullBlocks: typeof blocks = [];

test("membership cancel (DI-037)", async () => {
  test.setTimeout(240_000);
  const lib = (await apiFetch<{ settings?: Record<string, unknown> }>("/api/library", opTok)) ?? {};
  const cur = (await apiFetch<Record<string, unknown>>("/api/library", opTok)) as { venues?: unknown[]; settings?: Record<string, unknown> };
  void lib;
  await apiFetch("/api/library", opTok, { method: "PUT", body: JSON.stringify({ venues: cur.venues, settings: { ...(cur.settings ?? {}), memberships: { enabled: true, tiers: [{ id: "gold", name: "Gold", enabled: true, priceMonthly: 10, benefitType: "percent", benefitValue: 15 }] } } }) });
  const p = pageA;
  await check("DI-037", p, async () => {
    await p.goto("/custdash/memberships");
    await p.getByRole("button", { name: /Join Gold/i }).click({ timeout: 45_000 });
    await expect(p.getByRole("button", { name: /Cancel membership/i })).toBeVisible({ timeout: 20_000 });
    const codes1 = await apiFetch<{ code: string; membership?: boolean; active?: boolean }[]>("/api/discounts", opTok);
    const m1 = codes1.find((c) => c.membership);
    expect(m1?.active).toBe(true);
    const balBefore = await balance(aTok);
    p.once("dialog", (d) => void d.accept());
    await p.getByRole("button", { name: /Cancel membership/i }).click();
    await expect(p.getByRole("button", { name: /Join Gold/i })).toBeVisible({ timeout: 20_000 });
    const codes2 = await apiFetch<{ code: string; membership?: boolean; active?: boolean }[]>("/api/discounts", opTok);
    expect(codes2.find((c) => c.membership)?.active).toBe(false);
    expect(await balance(aTok)).toBe(balBefore);
    return `joined Gold (15% percent tier): member code ${m1?.code} active=true; Cancel membership -> page back to 'Join Gold', member code active=false, wallet unchanged £${balBefore}`;
  });
});

test("write results", async () => {
  save();
  console.log("RESULTS_FILE", RESULTS_FILE);
});
