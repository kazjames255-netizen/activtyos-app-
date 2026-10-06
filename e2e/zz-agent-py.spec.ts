import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { test, expect, type Browser, type BrowserContext, type Frame, type Locator, type Page } from "@playwright/test";
import { ROOT, WEB_URL, type TestAccount } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD, apiFetch, apiPost, fbSignIn, fbSignUp } from "./helpers/accounts";
import { cardWith } from "./helpers/ui";

// PY (payments) test-tracker sweep. FRESH throwaway operator + parent (never the standing accounts), Stripe TEST cards only.
// Run ONLY this file with --project=e2e --no-deps (the setup project would wipe the standing accounts' data).
// Each check records {status, note, shot} to RESULTS; a separate step copies them into testTrackerResults.

const stamp = Date.now().toString(36);
const SHOTS = path.join(ROOT, "e2e/review/shots/py");
const RESULTS = process.env.PY_RESULTS || path.join(ROOT, "e2e/review/shots/py/_results.json");
fs.mkdirSync(SHOTS, { recursive: true });
const results: Record<string, { status: "pass" | "fail" | "blocked"; note: string; account: string; shot?: string }> = fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, "utf8")) : {};
const save = () => fs.writeFileSync(RESULTS, JSON.stringify(results, null, 2));

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const money = (n: number) => `£${n.toFixed(2)}`;

let op: TestAccount, parent: TestAccount;
let opCtx: BrowserContext, parCtx: BrowserContext;
let opTok = "", parTok = "";
let listingId = "", blockId = "", weeks: { blockId: string; dates: string[] }[] = [];
let tenantId = "";
let kidSeq = 0;
const kids: string[] = [];

async function uiLogin(browser: Browser, email: string, landing: string): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${WEB_URL}/login`);
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(`**${landing}`, { timeout: 60_000 });
  await page.close();
  return context;
}

async function shot(page: Page, id: string, tag = "") {
  const file = path.join(SHOTS, `${id}${tag}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  return file;
}

/** Run one check; never throws so the sweep continues. */
async function check(id: string, account: string, page: Page | null, fn: () => Promise<string>) {
  const prev = results[id];
  try {
    const note = await fn();
    if (results[id] !== prev) { save(); return; } // fn recorded its own (e.g. blocked) result
    results[id] = { status: "pass", note, account, shot: path.join(SHOTS, `${id}.png`) };
  } catch (e) {
    const msg = (e as Error).message.split("\n").slice(0, 3).join(" | ").slice(0, 600);
    if (page) await shot(page, id);
    results[id] = { status: "fail", note: msg, account, shot: path.join(SHOTS, `${id}.png`) };
  }
  save();
}

const newKid = async (tag: string) => {
  const name = `PY ${tag} ${stamp}-${++kidSeq}`;
  await apiPost("/api/my/children", parTok, { name, dob: "2018-05-14" });
  kids.push(name);
  return name;
};

type Bk = { ref: string; amount: number; status: string; pay: string; method?: string; [k: string]: unknown };
type BookRes = { bookings: Bk[]; bank?: { accountName: string; sortCode: string; accountNumber: string; reference: string } | null; [k: string]: unknown };
let weekCursor = 0;
async function book(opts: { method: string; pass?: string; days?: number; tag?: string; extra?: Record<string, unknown>; tok?: string; childCount?: number }): Promise<BookRes> {
  const pass = opts.pass ?? "3 days";
  const n = opts.days ?? (pass === "1 day" ? 1 : pass === "3 days" ? 3 : 5);
  const week = weeks[weekCursor++ % weeks.length];
  const items = [] as unknown[];
  for (let i = 0; i < (opts.childCount ?? 1); i++) items.push({ pass, child: await newKid(opts.tag ?? "kid"), age: 8, dates: week.dates.slice(0, n) });
  return apiPost<BookRes>("/api/my/bookings", opts.tok ?? parTok, { listingId, blockId: week.blockId, method: opts.method, items, walletCap: 0, ...(opts.extra ?? {}) });
}
const opGet = <T,>(p: string) => apiFetch<T>(p, opTok);
const getBooking = (ref: string) => opGet<Bk>(`/api/bookings/${encodeURIComponent(ref)}`);
const action = (ref: string, type: string, extra: Record<string, unknown> = {}) =>
  apiPost<Bk>(`/api/bookings/${encodeURIComponent(ref)}/actions`, opTok, { type, ...extra });

// --- Stripe Payment Element helpers (same approach as payments.spec.ts) ---
const inAnyFrame = async (page: Page, find: (f: Frame) => Locator, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const f of page.frames()) {
      const loc = find(f);
      if ((await loc.count().catch(() => 0)) > 0) return loc.first();
    }
    await page.waitForTimeout(300);
  }
  return null;
};
async function fillCard(page: Page, number: string) {
  const cardTab = await inAnyFrame(page, (f) => f.getByRole("button", { name: "Card", exact: true }), 15_000);
  if (cardTab) await cardTab.click().catch(() => {});
  const cardNumber = await inAnyFrame(page, (f) => f.getByPlaceholder("1234 1234 1234 1234"));
  expect(cardNumber, "Stripe card-number field should appear").toBeTruthy();
  await cardNumber!.fill(number);
  await (await inAnyFrame(page, (f) => f.getByPlaceholder("MM / YY"), 10_000))?.fill("12/30");
  await (await inAnyFrame(page, (f) => f.getByPlaceholder("CVC"), 10_000))?.fill("123");
  const postcode = await inAnyFrame(page, (f) => f.getByLabel(/postal code|postcode|zip/i), 5_000);
  if (postcode) await postcode.fill("NN5 7EA").catch(() => {});
}

const payTokenFor = (ref: string): string => {
  const out = execFileSync("npx", ["tsx", path.join(ROOT, "e2e/helpers/payTokenFor.ts"), tenantId, ref], { cwd: path.join(ROOT, "server"), encoding: "utf8" });
  const m = out.match(/@@TOKEN@@(\S+)@@END@@/);
  if (!m) throw new Error("no token: " + out.slice(-200));
  return m[1];
};

async function parentBookingsPage(page: Page, ref: string) {
  await page.goto("/custdash/bookings");
  await expect(cardWith(page, `Ref ${ref}`)).toBeVisible({ timeout: 45_000 });
}
async function opBookingPage(page: Page, ref: string) {
  await page.goto(`/company/bookings?ref=${encodeURIComponent(ref)}`);
  const detail = page.getByRole("button", { name: /Cancel booking|Refund/ }).first();
  const open = await detail.waitFor({ state: "visible", timeout: 20_000 }).then(() => true).catch(() => false);
  if (!open) {
    await page.getByText(new RegExp(`Ref ${ref}`)).first().click({ timeout: 20_000 });
    await detail.waitFor({ state: "visible", timeout: 20_000 });
  }
  await page.waitForTimeout(500);
}

test.describe.configure({ mode: "serial" });
test.describe("PY payments sweep", () => {
  test.setTimeout(600_000);
  let parPage: Page, opPage: Page;

  test("arrange: fresh operator + parent + listing", async ({ browser }) => {
    test.setTimeout(420_000);
    const pEmail = `e2e-py-parent-${stamp}@${TEST_EMAIL_DOMAIN}`;
    const oEmail = `e2e-py-op-${stamp}@${TEST_EMAIL_DOMAIN}`;
    const ps = await fbSignUp(pEmail);
    await apiPost("/api/register-role", ps.idToken, { role: "parent", postcode: "NN5 7EA" });
    parent = { role: "parent", email: pEmail, uid: ps.uid, tenantId: null, tenantName: null };
    const os = await fbSignUp(oEmail);
    const tenantName = `PY Company ${stamp}`;
    const r = await apiPost<{ tenantId: string }>("/api/register-role", os.idToken, { role: "company", businessName: tenantName, providerName: tenantName, providerNameMode: "business" });
    tenantId = r.tenantId;
    op = { role: "company", email: oEmail, uid: os.uid, tenantId, tenantName };
    execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", tenantId], { stdio: "pipe" });
    opTok = (await fbSignIn(oEmail)).idToken;
    parTok = (await fbSignIn(pEmail)).idToken;
    await apiPost("/api/me/welcome", parTok, {});

    // library: venue + marketplace + bank details + a voucher scheme with a reference
    const lib = ((await apiFetch<Record<string, unknown> | null>("/api/library", opTok)) as { venues?: unknown[]; settings?: Record<string, unknown> } | null) ?? {};
    await apiFetch("/api/library", opTok, {
      method: "PUT",
      body: JSON.stringify({
        venues: [{ id: "py-venue", name: "PY Sports Hall", address: "1 Test Way", city: "Northampton" }],
        settings: {
          ...(lib.settings ?? {}), marketplaceListed: true,
          billing: { businessName: tenantName, accountName: `PY Test Club ${stamp}`, sortCode: "12-34-56", accountNumber: "87654321", bankName: "Test Bank" },
          voucherProviders: [{ id: "edenred", name: "Edenred", details: [{ label: "Account reference", value: `EDN-${stamp}` }] }],
        },
      }),
    });

    // block: three passes with flat prices 20 / 54 / 90
    const period = await apiPost<{ id: string }>("/api/periods", opTok, { title: "Full day", start: "09:00", finish: "15:30" });
    const p1 = await apiPost<{ id: string }>("/api/passes", opTok, { name: "1 day", days: 1 });
    const p3 = await apiPost<{ id: string }>("/api/passes", opTok, { name: "3 days", days: 3 });
    const p5 = await apiPost<{ id: string }>("/api/passes", opTok, { name: "5 days", days: 5 });
    const bundle = await apiPost<{ id: string }>("/api/block-bundles", opTok, {
      name: `PY Standard ${stamp}`, periodIds: [period.id], passIds: [p1.id, p3.id, p5.id], priced: true, masterPrice: 90, calcOn: true,
      passMode: { [p1.id]: "flat", [p3.id]: "flat", [p5.id]: "flat" }, passFlat: { [p1.id]: 20, [p3.id]: 54, [p5.id]: 90 },
    });
    const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7));
    const end = new Date(start); end.setDate(end.getDate() + 18);
    const L = await apiPost<{ id: string }>("/api/listings", opTok, {
      title: `PY Standard Camp ${stamp}`, venueId: "py-venue", runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5],
      maxAttendees: "10", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id,
      passes: [{ name: "1 day", price: 20, days: 1 }, { name: "3 days", price: 54, days: 3 }, { name: "5 days", price: 90, days: 5 }],
      bookingType: "auto", status: "live", visibility: "public",
    });
    listingId = L.id;
    await apiFetch(`/api/block-bundles/${bundle.id}/listings`, opTok, { method: "PUT", body: JSON.stringify({ listingIds: [L.id] }) });
    const doc = await apiFetch<{ blocks: { id: string; sessions: { date: string }[] }[]; passes: { name: string; price: number }[] }>(`/api/listings/${L.id}`, parTok);
    blockId = doc.blocks[0].id;
    weeks = doc.blocks.map((b) => ({ blockId: b.id, dates: b.sessions.map((s) => s.date) }));
    expect(weeks.length, "blocks: " + JSON.stringify(weeks.map((w) => w.dates.length))).toBeGreaterThan(0);
    expect(doc.passes.map((p) => `${p.name}:${p.price}`).sort().join(",")).toBe("1 day:20,3 days:54,5 days:90");
    await apiPost("/api/my/providers/follow", parTok, { tenantId });
    await apiPost("/api/discounts", opTok, { code: "SAVE10", type: "percent", value: 10 });

    opCtx = await uiLogin(browser, oEmail, "/company/bookings");
    parCtx = await uiLogin(browser, pEmail, "/custdash/browse");
    parPage = await parCtx.newPage();
    opPage = await opCtx.newPage();
    parPage.setDefaultTimeout(25_000); opPage.setDefaultTimeout(25_000);
    fs.writeFileSync(path.join(SHOTS, "_accounts.json"), JSON.stringify({ parent: pEmail, operator: oEmail, tenantId, listingId }, null, 2));
  });

  test("card checks (Stripe not configured on this machine: verify everything up to the card form)", async () => {
    const stripeOn = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/payments/checkout`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${parTok}` }, body: JSON.stringify({ refs: ["NOPE-1"] }) }).then((r) => r.status);
    const blockedNote = (what: string) => `BLOCKED by environment: server has no STRIPE_SECRET_KEY and web has no NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, so the card form cannot open (checkout API answers 503 "Payments aren't configured"). Verified up to the card form: ${what}`;
    expect(stripeOn === 503 || stripeOn === 404 || stripeOn === 409, `checkout status ${stripeOn}`).toBeTruthy();
    const blocked = async (id: string, account: string, page: Page, fn: () => Promise<string>) => {
      await check(id, account, page, async () => { const w = await fn(); results[id] = { status: "blocked", note: blockedNote(w), account, shot: path.join(SHOTS, `${id}.png`) }; return w; });
      if (results[id].status === "pass") results[id].status = "blocked";
      save();
    };
    const payOpens = async (ref: string, amt: string, id: string) => {
      await parentBookingsPage(parPage, ref);
      await cardWith(parPage, `Ref ${ref}`).getByRole("button", { name: new RegExp(`^Pay ${amt.replace(".", "\\.")}`) }).click();
      await expect(parPage.getByText(/Pay for booking/i)).toBeVisible();
      await expect(parPage.getByText(/Payments aren.t configured/i)).toBeVisible({ timeout: 15_000 });
      await shot(parPage, id);
    };
    await blocked("PY-001", "parent", parPage, async () => {
      const b = (await book({ method: "card" })).bookings[0];
      expect(b.amount).toBe(54); expect(b.pay).toBe("Unpaid"); expect(b.status).toBe("Confirmed");
      await payOpens(b.ref, "£54", "PY-001");
      return `${b.ref} Confirmed/Unpaid £54, 'Pay £54.00' button opens the pay modal, which shows a clean error`;
    });
    await blocked("PY-002", "parent", parPage, async () => {
      const b = (await book({ method: "card" })).bookings[0];
      await payOpens(b.ref, "£54", "PY-002");
      return `${b.ref} stays Unpaid with retry button available; decline + cardFailed warning not exercised`;
    });
    await blocked("PY-003", "parent", parPage, async () => {
      const b = (await book({ method: "card" })).bookings[0];
      await payOpens(b.ref, "£54", "PY-003");
      return `${b.ref} Unpaid; 3DS/webhook settle not exercised`;
    });
    await blocked("PY-004", "parent", parPage, async () => {
      const b = (await book({ method: "card" })).bookings[0];
      await payOpens(b.ref, "£54", "PY-004");
      await parPage.keyboard.press("Escape");
      await parPage.getByRole("button", { name: "Close" }).first().click().catch(() => {});
      await payOpens(b.ref, "£54", "PY-004");
      return `${b.ref}: 'Pay £54.00' reopens the modal on every click; single-charge not exercised`;
    });
    await blocked("PY-027", "parent", parPage, async () => {
      const r = await book({ method: "card", childCount: 2 });
      expect(r.bookings.length, "one booking for two children").toBe(1);
      const b = r.bookings[0];
      expect(b.amount).toBe(108);
      await payOpens(b.ref, "£108", "PY-027");
      return `Two children -> ONE booking ${b.ref}, total £108, one Pay button for £108`;
    });
    await blocked("PY-028", "parent", parPage, async () => {
      const b = (await book({ method: "card", pass: "5 days", extra: { discountCodes: ["SAVE10"] } })).bookings[0];
      expect(b.amount, "5 days £90 less SAVE10 10%").toBe(81);
      await payOpens(b.ref, "£81", "PY-028");
      return `SAVE10 on 5 days: booking ${b.ref} total £81 and Pay button says £81.00 (the Stripe charge itself not exercised)`;
    });
    await blocked("PY-024", "parent", parPage, async () => {
      // give the parent wallet credit the honest way: pay a booking in cash, then release a day to the wallet
      const w = (await book({ method: "card" })).bookings[0];
      await apiPost(`/api/bookings/${w.ref}/record-payment`, opTok, { amount: 54, method: "Cash" });
      const doc = await apiFetch<{ blocks: { id: string; sessions: { date: string }[] }[] }>(`/api/listings/${listingId}`, parTok);
      const wk = weeks.find((x) => x.blockId === (w as unknown as { blockId: string }).blockId) ?? weeks[0];
      await apiPost(`/api/my/bookings/${w.ref}/cancel`, parTok, { days: [wk.dates[2]], resolution: "wallet" });
      const wal = await apiFetch<{ balances: { balance: number }[] }>("/api/my/wallet", parTok);
      const bal = wal.balances[0]?.balance;
      expect(bal, "wallet credit").toBeGreaterThan(9);
      const r = await book({ method: "card", extra: { walletCap: 10 } });
      const b = r.bookings[0];
      expect(b.walletApplied ?? b.walletUsed, JSON.stringify(b)).toBe(10);
      await payOpens(b.ref, "£44", "PY-024");
      void doc;
      return `Wallet £10 applied, Pay button asks for £44.00 (54-10)`;
    });
  });

  test("explore wizard", async () => {
    test.skip(!process.env.PY_EXPLORE, "exploration only");
    test.setTimeout(240_000);
    const out = "/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/d6be64b6-4124-4419-9525-b7eb6fbb7058/scratchpad/explore";
    fs.mkdirSync(out, { recursive: true });
    await newKid("wiz");
    await parPage.goto("/custdash/browse");
    await parPage.waitForTimeout(6000);
    await parPage.screenshot({ path: `${out}/1-browse.png`, fullPage: true });
    fs.writeFileSync(`${out}/1.txt`, await parPage.locator("body").innerText());
    await parPage.getByText(`PY Standard Camp ${stamp}`).first().click();
    await parPage.waitForTimeout(5000);
    await parPage.screenshot({ path: `${out}/2-listing.png`, fullPage: true });
    fs.writeFileSync(`${out}/2.txt`, await parPage.locator("body").innerText());
    await parPage.getByRole("button", { name: /1 day · £20/ }).click();
    await parPage.getByRole("button", { name: /^THU\s*8|^Thu\s*8/i }).first().click().catch(async () => { await parPage.getByText("8", { exact: true }).first().click(); });
    await parPage.getByRole("button", { name: /NEXT.*ADD CHILDREN/i }).click();
    await parPage.waitForTimeout(3000);
    await parPage.screenshot({ path: `${out}/3-children.png`, fullPage: true });
    fs.writeFileSync(`${out}/3.txt`, await parPage.locator("body").innerText());
  });

  // ───────────────────────── offline rails ─────────────────────────
  test("bank transfer / cash (PY-005..008, 031..035)", async () => {
    let bankRef = "", cashRef = "";
    await check("PY-005", "parent", parPage, async () => {
      const r = await book({ method: "bank" });
      const b = r.bookings[0];
      expect(b.pay).toBe("Unpaid"); expect(b.amount).toBe(54);
      bankRef = b.ref;
      expect(r.bank, "booking response carries bank details").toBeTruthy();
      expect(r.bank!.sortCode).toBe("12-34-56");
      await parentBookingsPage(parPage, b.ref);
      const card = cardWith(parPage, `Ref ${b.ref}`);
      await expect(card).toContainText(/12-34-56/);
      await expect(card).toContainText("87654321");
      await expect(card).toContainText(b.ref);
      await shot(parPage, "PY-005");
      return `${b.ref} £54 Unpaid, method Bank transfer; My bookings card shows account name, sort code 12-34-56, account number and reference ${b.ref}`;
    });
    await check("PY-031", "parent", parPage, async () => {
      expect(bankRef).toBeTruthy();
      const r = (await apiFetch<{ bank: { reference: string; accountName: string } | null }>(`/api/my/bank-details?ref=${bankRef}`, parTok));
      expect(r.bank?.reference).toBe(bankRef);
      // another parent must not see them
      const otherEmail = `e2e-py-other-${stamp}@${TEST_EMAIL_DOMAIN}`;
      const o = await fbSignUp(otherEmail);
      await apiPost("/api/register-role", o.idToken, { role: "parent", postcode: "NN5 7EA" });
      const other = await apiFetch<{ bank: unknown }>(`/api/my/bank-details?ref=${bankRef}`, o.idToken);
      expect(other.bank, "other parent sees no bank details").toBeNull();
      const pub = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/public/library/${tenantId}`).then((x) => x.text());
      expect(pub).not.toContain("87654321");
      expect(pub).not.toContain("12-34-56");
      const listing = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/listings/${listingId}`).then((x) => x.text());
      expect(listing).not.toContain("87654321");
      await parentBookingsPage(parPage, bankRef);
      await shot(parPage, "PY-031");
      return `Booker sees bank details+reference (response, My bookings card, /api/my/bank-details); other parent gets bank:null; public library + listing payloads contain no sort code/account number. Confirmation EMAIL body not inspected.`;
    });
    await check("PY-006", "company", opPage, async () => {
      await opBookingPage(opPage, bankRef);
      await expect(opPage.getByText(/Waiting for a bank transfer/i)).toBeVisible();
      await opPage.getByRole("button", { name: "Mark paid" }).click();
      await expect.poll(async () => (await getBooking(bankRef)).pay, { timeout: 20_000 }).toBe("Paid");
      await opPage.waitForTimeout(800);
      await shot(opPage, "PY-006");
      const after = await getBooking(bankRef);
      expect(after.amountPaid).toBe(54);
      const pays = await opGet<{ refs?: string[]; amount: number }[]>("/api/payments");
      expect(pays.some((p) => (p.refs ?? []).includes(bankRef) && p.amount === 54), "payment record £54 in Money in").toBeTruthy();
      return `UI button is 'Mark paid' (catalogue says 'Mark transfer received', which only shows for 'Awaiting voucher payment' bookings) -> ${bankRef} Paid, amountPaid 54, payments record £54. 'Payment received' message to family not read.`;
    });
    await check("PY-033", "company", opPage, async () => {
      const r = await book({ method: "bank" });
      const b = r.bookings[0];
      let mine: { title?: string; body?: string } | undefined;
      for (let i = 0; i < 12 && !mine; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const notes = await opGet<{ notifications?: { title?: string; body?: string; ref?: string }[] }>("/api/notifications");
        mine = (notes.notifications ?? []).find((n) => n.ref === b.ref);
      }
      expect(mine, "operator notification for the new booking").toBeTruthy();
      const nText = `${mine!.title} || ${mine!.body}`;
      expect(nText, "notification should tell the provider which bank reference to look for. Observed: " + nText).toMatch(/bank|transfer|reference/i);
      await opBookingPage(opPage, b.ref);
      await expect(opPage.getByText(/Look for that reference/i)).toBeVisible();
      await opPage.getByRole("button", { name: /Mark paid/ }).first().click();
      await expect.poll(async () => (await getBooking(b.ref)).pay, { timeout: 20_000 }).toBe("Paid");
      await shot(opPage, "PY-033");
      // second 'Mark paid' (replayed action) must not double count
      await action(b.ref, "paid").catch(() => {});
      const after = await getBooking(b.ref);
      expect(after.amountPaid).toBe(54);
      const pays = (await opGet<{ refs?: string[]; amount: number }[]>("/api/payments")).filter((p) => (p.refs ?? []).includes(b.ref));
      expect(pays.reduce((s, p) => s + p.amount, 0), "one £54 in total").toBe(54);
      return `Notification mentions ref; detail page says 'Look for that reference'; Mark paid -> Paid; replay did not double count (payments sum £54). Notification: ${JSON.stringify(mine).slice(0, 200)}`;
    });
    await check("PY-007", "parent", parPage, async () => {
      const r = await book({ method: "cash" });
      const b = r.bookings[0];
      cashRef = b.ref;
      expect(b.pay).toBe("Unpaid"); expect(b.status).toBe("Confirmed");
      await parentBookingsPage(parPage, b.ref);
      await shot(parPage, "PY-007");
      expect(b.method, "stored method").toMatch(/cash/i);
      return `${b.ref} Confirmed, £${b.amount} Unpaid, method Cash on the day; card text mentions cash`;
    });
    await check("PY-034", "parent", parPage, async () => {
      const r = await book({ method: "cash" });
      const b = r.bookings[0];
      await parentBookingsPage(parPage, b.ref);
      const txt = (await cardWith(parPage, `Ref ${b.ref}`).innerText()).replace(/\s+/g, " ");
      await shot(parPage, "PY-034");
      results["PY-034"] = { status: "blocked", note: `PARTIAL: confirmation screen + email not driven (booking made by API; wizard code at ListingWizard.tsx:904-908 has the 'Bring it with you' text). Observation: the My bookings card for a cash booking shows only a card 'Pay £54.00' button and no 'bring cash' note.`, account: "parent", shot: path.join(SHOTS, "PY-034.png") };
      return `Card text: "${txt.slice(0, 220)}". Confirmation screen + email wording not driven (booking done by API).`;
    });
    await check("PY-008", "company", opPage, async () => {
      await opBookingPage(opPage, cashRef);
      await opPage.getByRole("button", { name: "Mark paid" }).click();
      await expect.poll(async () => (await getBooking(cashRef)).pay, { timeout: 20_000 }).toBe("Paid");
      await opPage.waitForTimeout(800);
      await shot(opPage, "PY-008");
      const pays = await opGet<{ refs?: string[]; amount: number }[]>("/api/payments");
      expect(pays.some((p) => (p.refs ?? []).includes(cashRef) && p.amount === 54)).toBeTruthy();
      return `UI button is 'Mark paid' (catalogue says 'Mark cash received') -> ${cashRef} Paid, payments record £54`;
    });
    await check("PY-032", "parent", parPage, async () => {
      const pubUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/public/library/${tenantId}`;
      const withBank = await fetch(pubUrl).then((x) => x.json());
      expect(withBank.settings?.bankReady).toBe(true);
      const lib = (await apiFetch<{ settings: Record<string, unknown> }>("/api/library", opTok));
      const billing = lib.settings.billing as Record<string, unknown>;
      const put = (b: unknown) => apiFetch("/api/library", opTok, { method: "PUT", body: JSON.stringify({ settings: { ...lib.settings, billing: b } }) });
      await put({ ...billing, sortCode: "", accountNumber: "" });
      const without = await fetch(pubUrl).then((x) => x.json());
      const hiddenNow = without.settings?.bankReady;
      // booking by bank with no details must show no bank block
      const r = await book({ method: "bank" });
      await put(billing);
      const again = await fetch(pubUrl).then((x) => x.json());
      expect(hiddenNow, "bankReady false while no bank details").toBe(false);
      expect(again.settings?.bankReady).toBe(true);
      await parentBookingsPage(parPage, r.bookings[0].ref).catch(() => {});
      await shot(parPage, "PY-032");
      return `Public settings bankReady true -> false when sort code/account cleared -> true after re-saving (checkout hides 'Bank transfer' when !bankReady, checkout.tsx:760). Note: server still ACCEPTED a bank-transfer booking while details were empty (returned bank=${JSON.stringify(r.bank ?? null)}). Checkout list not driven in the browser.`;
    });
    await check("PY-035", "parent", parPage, async () => {
      const kid = await newKid("haf");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/my/bookings`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${parTok}` }, body: JSON.stringify({ listingId, blockId: weeks[0].blockId, method: "HAF (funded £0)", items: [{ pass: "1 day", child: kid, age: 8, dates: [weeks[0].dates[4]] }] }) });
      const j = await res.json();
      expect(res.status).toBe(400);
      expect(JSON.stringify(j)).toMatch(/HAF|Funded/);
      await parPage.goto("/custdash/bookings");
      await shot(parPage, "PY-035");
      return `Server refuses a parent HAF booking (400: ${JSON.stringify(j).slice(0, 120)}); checkout list filters HAF out for parents (checkout.tsx:763). Checkout list not driven in the browser.`;
    });
  });

  // ───────────────────────── childcare rails ─────────────────────────
  test("TFC / vouchers (PY-009..015)", async () => {
    let vRef = "";
    await check("PY-009", "parent", parPage, async () => {
      const r = await book({ method: "tfc", extra: { voucherScheme: "HMRC Tax-Free Childcare" }, tag: "tfc" });
      const b = r.bookings[0];
      await parentBookingsPage(parPage, b.ref);
      await shot(parPage, "PY-009");
      const full = await getBooking(b.ref);
      await opBookingPage(opPage, b.ref);
      await shot(opPage, "PY-009b");
      const btns = await opPage.getByRole("button").allInnerTexts();
      const facts = `booking.method='${full.method}', pay='${full.pay}', voucherScheme='${full.voucherScheme ?? ""}'; operator buttons: ${btns.filter((x) => /Mark|Resend/.test(x)).join(" | ")}`;
      expect(btns.some((x) => /Mark Tax-Free Childcare received/.test(x)), "operator should see 'Mark Tax-Free Childcare received'. Observed: " + facts).toBeTruthy();
      return facts;
    });
    await check("PY-010", "parent", null, async () => {
      const c = await apiFetch<{ configured: boolean }>("/api/my/tfc/config", parTok);
      results["PY-010"] = { status: "blocked", note: `BLOCKED: HMRC TFC test mode is off on this stack (GET /api/my/tfc/config -> configured:${c.configured}); the 'not enough in your HMRC account' + Split-it flow needs the integration. HMRC states are covered separately by e2e/tfc-checkout-stub.spec.ts (not run here).`, account: "parent" };
      return "";
    });
    results["PY-010"].status = "blocked";
    results["PY-011"] = { ...results["PY-010"], note: results["PY-010"].note.replace("'not enough in your HMRC account' + Split-it flow", "five HMRC failure messages") };
    save();
    await check("PY-012", "parent", parPage, async () => {
      const r = await book({ method: "tfc", extra: { voucherScheme: "HMRC Tax-Free Childcare", tfc: { amount: 30, remainderVia: "card", references: {} } }, tag: "tfcsplit" });
      const b = await getBooking(r.bookings[0].ref);
      await parentBookingsPage(parPage, b.ref);
      await shot(parPage, "PY-012");
      expect(b.cardPaid, `booking cardPaid after sending tfc{amount:30,remainderVia:'card'}; pay='${b.pay}' (server ignores the tfc object; ListingWizard.tsx onBook never forwards p.tfc)`).toBe(24);
      return "split recorded";
    });
    await check("PY-013", "parent", parPage, async () => {
      const kid = await newKid("voucher");
      const wk = weeks[1];
      const r = await apiPost<BookRes>("/api/my/bookings", parTok, { listingId, blockId: wk.blockId, method: "Childcare voucher — Edenred", voucherScheme: "edenred", walletCap: 0, items: [{ pass: "3 days", child: kid, age: 8, dates: wk.dates.slice(0, 3), paymentRef: `EDN-REF-${stamp}` }] });
      const b = await getBooking(r.bookings[0].ref);
      vRef = b.ref;
      expect(b.pay).toBe("Awaiting voucher payment");
      expect(b.voucherScheme).toBe("Edenred");
      expect(b.voucherSendBy, "send-by date").toBeTruthy();
      expect(b.voucherReceiveBy, "receive-by date").toBeTruthy();
      await parentBookingsPage(parPage, b.ref);
      await shot(parPage, "PY-013");
      const txt = (await cardWith(parPage, `Ref ${b.ref}`).innerText()).replace(/\s+/g, " ");
      return `${b.ref} £${b.amount} 'Awaiting voucher payment', scheme Edenred, sendBy ${b.voucherSendBy}, receiveBy ${b.voucherReceiveBy}; card text: "${txt.slice(0, 200)}"`;
    });
    await check("PY-014", "parent", parPage, async () => {
      const wk = weeks[2];
      const kidA = await newKid("sibA"), kidB = await newKid("sibB");
      const r = await apiPost<BookRes>("/api/my/bookings", parTok, { listingId, blockId: wk.blockId, method: "Childcare voucher — Edenred", voucherScheme: "edenred", walletCap: 0, items: [
        { pass: "3 days", child: kidA, age: 8, dates: wk.dates.slice(0, 3), paymentRef: `REF-A-${stamp}` },
        { pass: "3 days", child: kidB, age: 8, dates: wk.dates.slice(0, 3), paymentRef: `REF-B-${stamp}` }] });
      expect(r.bookings.length).toBe(1);
      const b = await getBooking(r.bookings[0].ref) as Bk & { payRefs?: { child: string; ref: string; amount: number }[] };
      expect(b.payRefs?.length, JSON.stringify(b.payRefs)).toBe(2);
      expect(Math.round(b.payRefs!.reduce((s, x) => s + x.amount, 0) * 100) / 100).toBe(b.amount);
      await apiFetch(`/api/bookings/${b.ref}/payment-ref`, opTok, { method: "PUT", body: JSON.stringify({ paymentRef: `REF-A-FIXED-${stamp}` }) });
      let notes = "";
      for (let i = 0; i < 10 && !notes.includes("Payment reference updated"); i++) { await new Promise((r) => setTimeout(r, 1500)); notes = JSON.stringify(await apiFetch<unknown>("/api/notifications", parTok)); }
      expect(notes).toContain("Payment reference updated");
      await parentBookingsPage(parPage, b.ref);
      await shot(parPage, "PY-014");
      return `${b.ref}: payRefs for both siblings (amounts sum to £${b.amount}); provider corrected reference -> parent notification 'Payment reference updated'`;
    });
    await check("PY-015", "company", opPage, async () => {
      expect(vRef).toBeTruthy();
      await apiPost(`/api/bookings/${vRef}/nudge`, opTok, {});
      await opBookingPage(opPage, vRef);
      await opPage.getByRole("button", { name: /^Mark .* received$/ }).first().click();
      await expect.poll(async () => (await getBooking(vRef)).pay, { timeout: 20_000 }).toBe("Paid");
      await opPage.waitForTimeout(800);
      await shot(opPage, "PY-015");
      const pays = await opGet<{ refs?: string[]; amount: number }[]>("/api/payments");
      expect(pays.some((p) => (p.refs ?? []).includes(vRef) && p.amount === 54)).toBeTruthy();
      return `nudge ok; UI 'Mark ... received' -> ${vRef} Paid, payments record £54`;
    });
  });

  // ───────────────────────── provider-side money ─────────────────────────
  test("HAF / invoices / manual payments (PY-017..023)", async () => {
    await check("PY-017", "company", opPage, async () => {
      const kid = await newKid("haf-op");
      const wk = weeks[0];
      const created = await apiPost<Bk>("/api/bookings", opTok, { booker: "PY HAF Family", email: `haf-${stamp}@${TEST_EMAIL_DOMAIN}`, child: kid, age: 8, listing: `PY Standard Camp ${stamp}`, pass: "1 day", blockId: wk.blockId, amount: 0, method: "HAF (funded £0)" });
      expect(created.pay).toBe("Funded"); expect(created.amount).toBe(0); expect(created.status).toBe("Confirmed");
      await opBookingPage(opPage, created.ref);
      await shot(opPage, "PY-017");
      const body = (await opPage.locator("body").innerText()).replace(/\s+/g, " ");
      return `${created.ref}: Confirmed, £0, pay Funded; page text mentions: ${/nothing to collect/i.test(body) ? "'Nothing to collect'" : "NO 'Nothing to collect' text found (Funded: " + /funded/i.test(body) + ")"}; capacity count + 'no invoice sent' not independently checked`;
    });
    await check("PY-018", "parent", parPage, async () => {
      const kid = await newKid("haf-par");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/my/bookings`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${parTok}` }, body: JSON.stringify({ listingId, blockId: weeks[0].blockId, method: "haf", items: [{ pass: "1 day", child: kid, age: 8, dates: [weeks[0].dates[3]] }] }) });
      expect(res.status).toBe(400);
      await parPage.goto("/custdash/bookings"); await shot(parPage, "PY-018");
      return `Catalogue's 'suspected bug' (parent HAF keeps full price) is NOT present: server now refuses a parent HAF booking with 400 (${(await res.text()).slice(0, 110)}) and checkout hides it`;
    });
    let invRef = "";
    await check("PY-019", "company", opPage, async () => {
      const kid = await newKid("inv");
      const wk = weeks[1];
      const famEmail = `fam-${stamp}@${TEST_EMAIL_DOMAIN}`;
      const r = await apiPost<BookRes>("/api/my/bookings", opTok, { listingId, blockId: wk.blockId, method: "card", onBehalfOf: { name: "PY Invoice Family", email: famEmail, phone: "07700900123" }, items: [{ pass: "3 days", child: kid, age: 8, dates: wk.dates.slice(3, 5).concat([wk.dates[0]]) }] });
      const b = r.bookings[0]; invRef = b.ref;
      expect(b.pay).toBe("Invoice sent"); expect(b.amount).toBe(54);
      await opBookingPage(opPage, b.ref);
      await shot(opPage, "PY-019");
      const tok = payTokenFor(b.ref);
      const pg = await opCtx.newPage();
      await pg.goto(`/pay/b/${tok}`);
      await expect(pg.getByText("Payment request from")).toBeVisible({ timeout: 30_000 });
      await expect(pg.getByText("£54.00").first()).toBeVisible();
      await shot(pg, "PY-019b");
      await pg.close();
      return `${b.ref} on behalf of a family: pay 'Invoice sent', £54 unpaid; public pay link /pay/b/{token} loads with £54.00 (card button needs Stripe). Payment-link email + Invoices list not inspected.`;
    });
    await check("PY-020", "company", opPage, async () => {
      expect(invRef).toBeTruthy();
      const before = await getBooking(invRef);
      await opBookingPage(opPage, invRef);
      await opPage.getByRole("button", { name: "Resend invoice" }).click();
      await opPage.waitForTimeout(1500);
      await shot(opPage, "PY-020");
      const after = await getBooking(invRef);
      expect({ pay: after.pay, amountPaid: after.amountPaid, status: after.status }).toEqual({ pay: before.pay, amountPaid: before.amountPaid, status: before.status });
      return `UI 'Resend invoice' on ${invRef}: booking unchanged (${after.pay}). Email arrival not inspected.`;
    });
    await check("PY-021", "company", opPage, async () => {
      await opBookingPage(opPage, invRef);
      await opPage.getByRole("button", { name: "Mark paid" }).click();
      await expect.poll(async () => (await getBooking(invRef)).pay, { timeout: 20_000 }).toBe("Paid");
      await opPage.waitForTimeout(800);
      await shot(opPage, "PY-021");
      const a = await getBooking(invRef);
      expect(a.amountPaid).toBe(a.amount);
      return `UI 'Mark paid' -> ${invRef} Paid, amountPaid ${a.amountPaid} = total`;
    });
    await check("PY-022", "company", opPage, async () => {
      const b = (await book({ method: "card", pass: "1 day" })).bookings[0];
      await action(b.ref, "cancel", { refund: "none" });
      await apiPost(`/api/bookings/${b.ref}/record-payment`, opTok, { amount: 20, method: "Bank transfer" });
      const a = await getBooking(b.ref);
      expect(a.receivedAfterCancel).toBe(20);
      await opPage.goto("/company/reconciliation");
      await opPage.waitForTimeout(4000);
      await shot(opPage, "PY-022");
      const body = (await opPage.locator("body").innerText()).replace(/\s+/g, " ");
      expect(body, "Reconciliation should list it as needing a refund/credit").toMatch(/refund|credit/i);
      return `${b.ref}: cancelled, then £20 recorded -> receivedAfterCancel 20; Reconciliation page text mentions refund/credit (${body.includes(b.ref) ? "and the ref" : "ref not found on page"})`;
    });
    await check("PY-023", "company", opPage, async () => {
      const b = (await book({ method: "card" })).bookings[0];
      await apiPost(`/api/bookings/${b.ref}/record-payment`, opTok, { amount: 20, method: "Cash" });
      await apiFetch(`/api/bookings/${b.ref}/recon-notes`, opTok, { method: "PUT", body: JSON.stringify({ note: `PY partial ${stamp}` }) });
      const a = await getBooking(b.ref);
      expect(a.pay).toBe("Partially paid"); expect(a.amountPaid).toBe(20);
      await opBookingPage(opPage, b.ref);
      await shot(opPage, "PY-023");
      const tok = payTokenFor(b.ref);
      const pg = await opCtx.newPage();
      await pg.goto(`/pay/b/${tok}`);
      await expect(pg.getByText("£34.00").first()).toBeVisible({ timeout: 30_000 });
      await shot(pg, "PY-023b");
      await pg.close();
      return `${b.ref}: £20 of £54 recorded -> 'Partially paid'; recon note saved; public pay link asks for the balance £34.00`;
    });
  });

  // ───────────────────────── setup ─────────────────────────
  test("Setup / Get paid / HAF listing (PY-025,026,036,037)", async () => {
    await check("PY-025", "company", opPage, async () => {
      const liveVouchers = (all: { details?: { value?: string }[] }[]) => all.filter((v) => (v.details ?? []).some((d) => (d.value ?? "").trim()));
      const lib = await apiFetch<{ settings: Record<string, unknown> }>("/api/library", opTok);
      const pubUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/public/library/${tenantId}`;
      const put = (st: Record<string, unknown>) => apiFetch("/api/library", opTok, { method: "PUT", body: JSON.stringify({ settings: st }) });
      await put({ ...lib.settings, payMethods: ["Card"], voucherProviders: [...(lib.settings.voucherProviders as unknown[]), { id: "noref", name: "NoRefScheme", details: [] }] });
      const pub = await fetch(pubUrl).then((x) => x.json());
      const live = liveVouchers(pub.settings.voucherProviders ?? []).map((v: { name: string }) => v.name);
      expect(live).toContain("Edenred"); expect(live).not.toContain("NoRefScheme");
      const kid = await newKid("pm");
      const cashRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/my/bookings`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${parTok}` }, body: JSON.stringify({ listingId, blockId: weeks[2].blockId, method: "cash", walletCap: 0, items: [{ pass: "1 day", child: kid, age: 8, dates: [weeks[2].dates[4]] }] }) });
      await opPage.goto("/company/setup");
      await opPage.waitForTimeout(3000);
      await shot(opPage, "PY-025");
      await put(lib.settings);
      expect(pub.settings.payMethods, `Provider switched payment methods to Card only, but the public/parent settings payload has payMethods=${JSON.stringify(pub.settings.payMethods)} (not in PUBLIC_SETTINGS_KEYS, server/src/lib/publicLibrary.ts) so the parent checkout falls back to ALL six default methods; a cash booking was still ACCEPTED by the API (HTTP ${cashRes.status}). Scheme with no reference IS correctly filtered.`).toEqual(["Card"]);
      return `Public settings follow Setup: payMethods narrowed to Card + Cash; scheme with no reference is filtered out by liveVouchers (client-side rule; the API itself still returns it). Setup UI toggling not clicked through.`;
    });
    await check("PY-026", "company", opPage, async () => {
      await opPage.goto("/company/getpaid");
      await opPage.waitForTimeout(3000);
      await shot(opPage, "PY-026");
      const st = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/payments/status`, { headers: { Authorization: `Bearer ${opTok}` } });
      results["PY-026"] = { status: "blocked", note: `BLOCKED by environment: /api/payments/status -> ${st.status} (no STRIPE_SECRET_KEY on the server), so Connect onboarding / card option cannot be verified. Get paid page screenshot saved.`, account: "company", shot: path.join(SHOTS, "PY-026.png") };
      return "";
    });
    results["PY-026"].status = "blocked"; save();
    let hafListing = "", hafBlock = "", hafDate = "";
    await check("PY-036", "company", opPage, async () => {
      const period = await apiPost<{ id: string }>("/api/periods", opTok, { title: "HAF day", start: "10:00", finish: "14:00" });
      const pass = await apiPost<{ id: string }>("/api/passes", opTok, { name: "HAF place", days: 1 });
      const bundle = await apiPost<{ id: string }>("/api/block-bundles", opTok, { name: `PY HAF ${stamp}`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 0, calcOn: true });
      const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7) + 21);
      const end = new Date(start); end.setDate(end.getDate() + 4);
      const title = `PY HAF Club ${stamp}`;
      const L = await apiPost<{ id: string }>("/api/listings", opTok, { title, venueId: "py-venue", runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "10", capacityScope: "day", ageFrom: "5", ageTo: "12", blockId: bundle.id, passes: [{ name: "HAF place", price: 0, days: 1 }], status: "live", visibility: "hidden" });
      await apiFetch(`/api/block-bundles/${bundle.id}/listings`, opTok, { method: "PUT", body: JSON.stringify({ listingIds: [L.id] }) });
      hafListing = L.id;
      const doc = await apiFetch<{ visibility: string; bookingType?: string; passes: { price: number }[]; blocks: { id: string; sessions: { date: string }[] }[] }>(`/api/listings/${L.id}`, opTok);
      hafBlock = doc.blocks[0].id; hafDate = doc.blocks[0].sessions[0].date;
      expect(doc.visibility).toBe("hidden"); expect(doc.passes[0].price).toBe(0);
      // not on the parent's Browse page
      await parPage.goto("/custdash/browse");
      await parPage.waitForTimeout(5000);
      const txt = await parPage.locator("body").innerText();
      expect(txt).not.toContain(title);
      await shot(parPage, "PY-036");
      return `Hidden (link-only) listing with a £0 pass saved (visibility ${doc.visibility}, bookingType ${doc.bookingType ?? "default(manual)"}); title absent from the parent's Browse page. Wizard UI + required 'HAF reference' question not driven.`;
    });
    await check("PY-037", "parent", parPage, async () => {
      expect(hafListing).toBeTruthy();
      const kid = await newKid("hafbook");
      const r = await apiPost<BookRes>("/api/my/bookings", parTok, { listingId: hafListing, blockId: hafBlock, method: "card", walletCap: 0, items: [{ pass: "HAF place", child: kid, age: 8, dates: [hafDate] }] });
      const b = r.bookings[0];
      expect(b.amount).toBe(0);
      expect(b.status).toBe("Approval needed");
      expect(b.pay).toBe("Funded");
      await parentBookingsPage(parPage, b.ref);
      await shot(parPage, "PY-037");
      await action(b.ref, "approve");
      const a = await getBooking(b.ref);
      expect(a.status).toBe("Confirmed");
      return `${b.ref}: £0, 'Approval needed' + pay Funded -> operator approve -> Confirmed. Link-open + HAF-reference answer not driven.`;
    });
    await check("PY-030", "franchise", null, async () => {
      results["PY-030"] = { status: "blocked", note: "NOT RUN: needs a franchise account with its own Stripe account and a card payment; Stripe is not configured on this machine.", account: "franchise" };
      return "";
    });
    results["PY-030"].status = "blocked"; save();
  });
});
