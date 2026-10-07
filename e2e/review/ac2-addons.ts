// Fork AC2: add-on CHANGE / CANCEL REQUESTS end to end on an ISOLATED stack (web :3020 -> API :4020), throwaway accounts only, Stripe TEST mode.
// Run: E2E_BASE_URL=http://localhost:3020 NEXT_PUBLIC_API_URL=http://localhost:4020 server/node_modules/.bin/tsx e2e/review/ac2-addons.ts <phase>   (phase "api" then "ui")
import fs from "node:fs";
import path from "node:path";
import { fbSignUp, apiPost, apiFetch, TEST_EMAIL_DOMAIN, TEST_PASSWORD } from "../helpers/accounts";
import { ROOT, WEB_URL, API_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require(path.join(ROOT, "node_modules/playwright"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Stripe = require(path.join(ROOT, "server/node_modules/stripe")).default ?? require(path.join(ROOT, "server/node_modules/stripe"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require(path.join(ROOT, "server/node_modules/firebase-admin"));
admin.initializeApp({ credential: admin.credential.cert(require(path.join(ROOT, "server/serviceAccountKey.json"))) });
const fs_ = admin.firestore();

const OUT = "/Users/kazjames/Downloads/activtyos-app-/docs/home-visit-qa/AC2";
const STATE = path.join(OUT, "state.json");
const phase = process.argv[2] || "api";
fs.mkdirSync(OUT, { recursive: true });
const results: { id: string; ok: boolean; note: string }[] = fs.existsSync(path.join(OUT, "results.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "results.json"), "utf8")) : [];
const T = (id: string, ok: boolean, note = "") => { results.push({ id, ok, note }); console.log(`${ok ? "PASS" : "FAIL"} ${id} ${note}`); fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1)); };
const call = async (tok: string | null, method: string, url: string, body?: unknown) => {
  const r = await fetch(`${API_URL}${url}`, { method, headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let json: any = null; try { json = await r.json(); } catch { /* empty */ }
  return { status: r.status, json };
};
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const plus = (n: number) => ymd(new Date(Date.now() + n * 86_400_000));
const stamp = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")).stamp : Date.now().toString(36);
const em = (n: string) => `hvqa-ac2-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`;
const signIn = async (email: string) => { const key = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/NEXT_PUBLIC_FIREBASE_API_KEY=(\S+)/)![1].replace(/["']/g, ""); const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: TEST_PASSWORD, returnSecureToken: true }) }); return ((await r.json()) as any).idToken as string; };
const stripeKey = (fs.readFileSync(path.join(ROOT, "server/.env"), "utf8").match(/^STRIPE_SECRET_KEY=(\S+)/m) || [])[1]?.replace(/["']/g, "");

async function payByCard(tok: string, ref: string) {
  const co = await call(tok, "POST", "/api/payments/checkout", { refs: [ref] });
  if (!co.json?.clientSecret) return false;
  const piId = String(co.json.clientSecret).split("_secret_")[0];
  const stripe = new Stripe(stripeKey);
  await stripe.paymentIntents.confirm(piId, { payment_method: "pm_card_visa", return_url: "https://example.org/return" }).catch(() => {});
  const cf = await call(tok, "POST", `/api/payments/checkout/${co.json.paymentId}/confirm`, {});
  return cf.json?.paid === true;
}

(async () => {
  if (phase === "api") {
    T("stack", stripeKey?.startsWith("sk_test_") === true, `stripe ${stripeKey?.slice(0, 8)}`);
    const prov = await fbSignUp(em("prov"));
    const reg = await apiPost<{ tenantId: string }>("/api/register-role", prov.idToken, { role: "freelancer", businessName: "HVQA AC2 Kit Co", providerName: "HVQA AC2 Kit Co", providerNameMode: "business", ownerName: "Kit Owner" });
    const tid = reg.tenantId;
    await fs_.collection("tenants").doc(tid).set({ subscription: { status: "trialing", plan: "freelancer" } }, { merge: true });
    const lib0 = ((await apiFetch<any>("/api/library", prov.idToken)) ?? {}) as any;
    const addons = [
      { id: "ao-tshirt", name: "tshirty", type: "once", price: 10, questions: [{ id: "q-size", label: "size", type: "choice", options: ["S", "M", "L"], required: true }] },
      { id: "ao-bottle", name: "water bottle", type: "once", price: 5, questions: [{ id: "q-col", label: "red or blue", type: "choice", options: ["red", "blue"], required: true }] },
    ];
    await apiFetch("/api/library", prov.idToken, { method: "PUT", body: JSON.stringify({ addons, venues: [{ id: "v1", name: "AC2 Hall", address: "1 High St, Milton Keynes", kind: "venue" }], settings: { ...(lib0.settings ?? {}), billing: { ...(lib0.settings?.billing ?? {}), sortCode: "20-57-44", accountNumber: "63437582", bankName: "Test" } } }) });
    const parent = await fbSignUp(em("parent"));
    await apiPost("/api/register-role", parent.idToken, { role: "parent", firstName: "Kit", lastName: "Parent" });
    const per = await apiPost<{ id: string }>("/api/periods", prov.idToken, { title: "Day", start: "09:00", finish: "15:00" });
    const pass = await apiPost<{ id: string }>("/api/passes", prov.idToken, { name: "Single day", days: 1 });
    const bundle = await apiPost<{ id: string }>("/api/block-bundles", prov.idToken, { name: "Kit block", periodIds: [per.id], passIds: [pass.id], priced: true, masterPrice: 0.3, calcOn: true });
    const mk = await call(prov.idToken, "POST", "/api/listings", { title: "AC2 Kit Camp", venueId: "v1", runFrom: plus(1), runTo: plus(30), blockMode: "custom", days: [0, 1, 2, 3, 4, 5, 6], maxAttendees: "30", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id, passes: [{ name: "Single day", price: 0.3, days: 1 }], bookingType: "auto", status: "live", visibility: "public", deliveryMode: "venue", addonIds: ["ao-tshirt", "ao-bottle"] });
    const L = mk.json as { id: string };
    T("setup: provider, add-ons, listing", mk.status < 300 && !!L?.id, `tenant ${tid} listing ${L?.id} ${mk.status}`);
    const detail = await call(parent.idToken, "GET", `/api/listings/${L.id}`);
    const blocks: any[] = detail.json?.blocks ?? [];
    const blockFor = (d: string) => blocks.find((b) => (b.sessions ?? []).some((s: any) => s.date === d));
    const far = plus(14), near = plus(1);
    const book = async (method: string, child: string, day: string, extras = true) => {
      const blk = blockFor(day);
      return call(parent.idToken, "POST", "/api/my/bookings", { listingId: L.id, blockId: blk?.id, method, items: [{ pass: "Single day", dates: [day], child, age: 7, ...(extras ? { addons: [{ id: "ao-tshirt", answers: { "q-size": "M" } }, { id: "ao-bottle", answers: { "q-col": "red" } }] } : {}) }] });
    };
    // A: paid by card (the main flow). B: unpaid bank. C: tomorrow (inside the 3-day cut-off).
    const bA = await book("card", "Sally", far); const refA = bA.json?.bookings?.[0]?.ref;
    T("book A (card, far day, 2 extras)", bA.status < 300 && !!refA, `${bA.status} ${refA} £${bA.json?.total}`);
    const paid = await payByCard(parent.idToken, refA);
    T("pay A by test card", paid, "");
    const bB = await book("bank", "Paul", far); const refB = bB.json?.bookings?.[0]?.ref;
    T("book B (bank transfer, unpaid)", bB.status < 300 && !!refB, `${bB.status} ${refB} £${bB.json?.total}`);
    const bC = await book("bank", "Cat", near); const refC = bC.json?.bookings?.[0]?.ref;
    T("book C (tomorrow)", bC.status < 300 && !!refC, `${bC.status} ${refC}`);
    const bD = await book("card", "Dan", far); const refD = bD.json?.bookings?.[0]?.ref;
    await payByCard(parent.idToken, refD);
    fs.writeFileSync(STATE, JSON.stringify({ stamp, tid, listing: L.id, refA, refB, refC, refD, far, near }, null, 1));

    // ── the family's options ──
    const opts = await call(parent.idToken, "GET", `/api/my/bookings/${refA}/addon-options`);
    const lines = (opts.json?.lines ?? []) as any[];
    const ts = lines.find((l) => l.name === "tshirty"); const bt = lines.find((l) => l.name === "water bottle");
    T("options: both extras listed with their real choices", opts.status === 200 && !!ts && !!bt && ts.canChange && ts.questions?.[0]?.options?.join() === "S,M,L" && ts.current?.size === "M", JSON.stringify({ cutoff: opts.json?.cutoffDays, ts: ts && { key: ts.key, canChange: ts.canChange, current: ts.current } }));
    const optsC = await call(parent.idToken, "GET", `/api/my/bookings/${refC}/addon-options`);
    T("cut-off: tomorrow's extras are blocked (default 3 days)", (optsC.json?.lines ?? []).every((l: any) => l.block === "cutoff" && !l.canCancel), JSON.stringify((optsC.json?.lines ?? []).map((l: any) => l.block)));
    const reqC = await call(parent.idToken, "POST", `/api/my/bookings/${refC}/addon-requests`, { key: (optsC.json?.lines ?? [])[0]?.key, kind: "cancel" });
    T("cut-off: a request inside it is refused with a clear message", reqC.status === 409 && /day/.test(reqC.json?.error ?? ""), `${reqC.status} ${reqC.json?.error}`);

    // ── validation ──
    const bad = await call(parent.idToken, "POST", `/api/my/bookings/${refA}/addon-requests`, { key: ts.key, kind: "change", answers: { size: "XXL" } });
    T("validation: a size the provider does not offer is refused", bad.status === 400, `${bad.status} ${bad.json?.error}`);
    const same = await call(parent.idToken, "POST", `/api/my/bookings/${refA}/addon-requests`, { key: ts.key, kind: "change", answers: { size: "M" } });
    T("validation: 'change' to what they already have is refused", same.status === 400, `${same.status} ${same.json?.error}`);
    const ghost = await call(parent.idToken, "POST", `/api/my/bookings/${refA}/addon-requests`, { key: "nope|nothing", kind: "cancel" });
    T("validation: an extra that is not on the booking is refused", ghost.status === 404, `${ghost.status}`);
    const other = await fbSignUp(em("other")); await apiPost("/api/register-role", other.idToken, { role: "parent", firstName: "Other", lastName: "Family" });
    const stranger = await call(other.idToken, "POST", `/api/my/bookings/${refA}/addon-requests`, { key: ts.key, kind: "cancel" });
    T("validation: another family cannot ask on this booking", stranger.status === 404, `${stranger.status}`);

    // ── change: request, one pending per extra, approve, double approve ──
    const rq = await call(parent.idToken, "POST", `/api/my/bookings/${refA}/addon-requests`, { key: ts.key, kind: "change", answers: { size: "L" }, note: "She has grown" });
    T("request: change size M -> L is accepted (pending)", rq.status === 201 && rq.json?.status === "pending" && rq.json?.toLabel === "tshirty (size: L)", `${rq.status} ${rq.json?.toLabel}`);
    const dup = await call(parent.idToken, "POST", `/api/my/bookings/${refA}/addon-requests`, { key: ts.key, kind: "cancel" });
    T("request: a second one on the same extra is refused", dup.status === 409, `${dup.status}`);
    const bkPending = await call(prov.idToken, "GET", `/api/bookings/${refA}`);
    T("provider sees it pending, booking untouched, still Paid/Confirmed", bkPending.json?.addonRequests?.[0]?.status === "pending" && bkPending.json?.status === "Confirmed" && bkPending.json?.pay === "Paid" && /size: m/i.test(bkPending.json?.addonLines?.[0]?.label ?? ""), `${bkPending.json?.status}/${bkPending.json?.pay} ${bkPending.json?.addonLines?.[0]?.label}`);
    await new Promise((r) => setTimeout(r, 2500));
    const provNotifs = await call(prov.idToken, "GET", "/api/notifications");
    T("provider bell: 'asks to change' with the booking ref", JSON.stringify(provNotifs.json).includes("asks to change") && JSON.stringify(provNotifs.json).includes(refA), "");
    const rid = rq.json.id;
    const ap = await call(prov.idToken, "POST", `/api/bookings/${refA}/actions`, { type: "addon-approve", requestId: rid });
    T("approve change: the booking now says size L, no money moved", ap.status === 200 && /size: L/.test(ap.json?.addonLines?.[0]?.label ?? "") && ap.json?.amount === bkPending.json?.amount && ap.json?.pay === "Paid" && !ap.json?.cancel, `${ap.status} ${ap.json?.addonLines?.[0]?.label} £${ap.json?.amount} ${ap.json?.pay}`);
    const ap2 = await call(prov.idToken, "POST", `/api/bookings/${refA}/actions`, { type: "addon-approve", requestId: rid });
    T("double approve is refused (409)", ap2.status === 409, `${ap2.status} ${ap2.json?.error}`);
    await new Promise((r) => setTimeout(r, 2500));
    const famNotifs = await call(parent.idToken, "GET", "/api/notifications");
    T("parent bell: 'Extra request approved'", JSON.stringify(famNotifs.json).includes("Extra request approved"), "");

    // ── decline ──
    const rq2 = await call(parent.idToken, "POST", `/api/my/bookings/${refA}/addon-requests`, { key: bt.key, kind: "cancel" });
    const dec = await call(prov.idToken, "POST", `/api/bookings/${refA}/actions`, { type: "addon-decline", requestId: rq2.json?.id, reason: "Already ordered" });
    T("decline: the extra stays, reason kept, booking untouched", dec.status === 200 && dec.json?.addonLines?.length === 2 && dec.json?.addonRequests?.find((r: any) => r.id === rq2.json?.id)?.declineReason === "Already ordered", `${dec.status}`);
    await new Promise((r) => setTimeout(r, 2500)); // bells are sent in the background
    const famNotifs2 = await call(parent.idToken, "GET", "/api/notifications");
    T("parent bell: 'Extra request declined' with the reason", JSON.stringify(famNotifs2.json).includes("Extra request declined") && JSON.stringify(famNotifs2.json).includes("Already ordered"), "");

    // ── withdraw ──
    const rq3 = await call(parent.idToken, "POST", `/api/my/bookings/${refA}/addon-requests`, { key: bt.key, kind: "cancel" });
    const wd = await call(parent.idToken, "POST", `/api/my/bookings/${refA}/addon-requests/${rq3.json?.id}/withdraw`, {});
    const afterWd = await call(prov.idToken, "POST", `/api/bookings/${refA}/actions`, { type: "addon-approve", requestId: rq3.json?.id });
    T("withdraw: the family withdraws; the provider can no longer approve it (409)", wd.json?.status === "withdrawn" && afterWd.status === 409, `${wd.status} ${afterWd.status}`);

    // ── cancel the bottle, money = refund (a pending refund the provider sends), booking stands ──
    const rq4 = await call(parent.idToken, "POST", `/api/my/bookings/${refA}/addon-requests`, { key: bt.key, kind: "cancel", note: "Not needed" });
    const before = (await call(prov.idToken, "GET", `/api/bookings/${refA}`)).json;
    const ap4 = await call(prov.idToken, "POST", `/api/bookings/${refA}/actions`, { type: "addon-approve", requestId: rq4.json?.id, resolution: "refund" });
    T("approve cancel + refund: extra removed, booking STANDS, a pending refund of the extra's price", ap4.status === 200 && ap4.json?.status === "Confirmed" && ap4.json?.addonLines?.length === 1 && ap4.json?.cancel?.refund === "pending" && ap4.json?.cancel?.amount === 5 && ap4.json?.cancel?.refundOnly === true && ap4.json?.amount === before.amount, `${ap4.status} ${ap4.json?.status} lines ${ap4.json?.addonLines?.length} cancel ${JSON.stringify(ap4.json?.cancel)}`);
    const ra = await call(prov.idToken, "POST", `/api/bookings/${refA}/actions`, { type: "refund-approve" });
    T("then the existing refund-approve sends it (Stripe test refund), pay = Partially refunded", ra.status === 200 && /refund/i.test(ra.json?.pay ?? ""), `${ra.status} ${ra.json?.pay} ${ra.json?.error ?? ""}`);

    // ── wallet resolution on booking D ──
    const optsD = await call(parent.idToken, "GET", `/api/my/bookings/${refD}/addon-options`);
    const tsD = (optsD.json?.lines ?? []).find((l: any) => l.name === "tshirty");
    const rqD = await call(parent.idToken, "POST", `/api/my/bookings/${refD}/addon-requests`, { key: tsD.key, kind: "cancel" });
    const apD = await call(prov.idToken, "POST", `/api/bookings/${refD}/actions`, { type: "addon-approve", requestId: rqD.json?.id, resolution: "wallet" });
    T("approve cancel + wallet credit: instant, logged, no pending refund", apD.status === 200 && !apD.json?.cancel && (apD.json?.refundLog ?? []).some((x: any) => x.source === "Wallet" && x.amount === 10), `${apD.status} ${JSON.stringify(apD.json?.refundLog)}`);

    // ── unpaid booking B: cancelling an extra just comes off what is owed ──
    const optsB = await call(parent.idToken, "GET", `/api/my/bookings/${refB}/addon-options`);
    const tsB = (optsB.json?.lines ?? []).find((l: any) => l.name === "tshirty");
    const rqB = await call(parent.idToken, "POST", `/api/my/bookings/${refB}/addon-requests`, { key: tsB.key, kind: "cancel" });
    const bBefore = (await call(prov.idToken, "GET", `/api/bookings/${refB}`)).json;
    const apB = await call(prov.idToken, "POST", `/api/bookings/${refB}/actions`, { type: "addon-approve", requestId: rqB.json?.id });
    T("unpaid booking: cancelling an extra just reduces what is owed by its price", apB.status === 200 && Math.abs((bBefore.amount - apB.json?.amount) - 10) < 0.005 && !apB.json?.cancel, `${bBefore.amount} -> ${apB.json?.amount}`);

    // ── the Setup cut-off: 0 = until the day of the session ──
    const lib1 = ((await apiFetch<any>("/api/library", prov.idToken)) ?? {}) as any;
    await apiFetch("/api/library", prov.idToken, { method: "PUT", body: JSON.stringify({ addons: lib1.addons, venues: lib1.venues, settings: { ...(lib1.settings ?? {}), addonRequestDays: 0 } }) });
    const optsC2 = await call(parent.idToken, "GET", `/api/my/bookings/${refC}/addon-options`);
    T("Setup option addonRequestDays = 0: tomorrow's extras can now be asked about", optsC2.json?.cutoffDays === 0 && (optsC2.json?.lines ?? []).every((l: any) => l.canCancel), JSON.stringify({ c: optsC2.json?.cutoffDays, b: (optsC2.json?.lines ?? []).map((l: any) => l.block) }));
    // ── cancelled booking cannot be asked about / approved ──
    const cx = await call(prov.idToken, "POST", `/api/bookings/${refC}/actions`, { type: "cancel", refund: "none", reason: "QA" });
    const optsC3 = await call(parent.idToken, "GET", `/api/my/bookings/${refC}/addon-options`);
    T("a cancelled booking: nothing can be requested", cx.status < 300 && (optsC3.json?.lines ?? []).every((l: any) => l.block === "cancelled"), JSON.stringify((optsC3.json?.lines ?? []).map((l: any) => l.block)));
    console.log("API phase done", JSON.stringify({ refA, refB, refC, refD }));
    return;
  }
  // ── UI phase ──
  const st = JSON.parse(fs.readFileSync(STATE, "utf8"));
  const login = async (browser: any, email: string, vp = { width: 1440, height: 1000 }) => {
    const ctx = await browser.newContext({ viewport: vp });
    await ctx.addInitScript(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s)); });
    const page = await ctx.newPage();
    await page.goto(`${WEB_URL}/login`, { waitUntil: "domcontentloaded" });
    for (let i = 0; i < 6; i++) { await page.waitForTimeout(1500); await page.getByPlaceholder("you@example.com").fill(email); await page.locator('input[type="password"]').fill(TEST_PASSWORD); await page.waitForTimeout(300); if (await page.getByRole("button", { name: "Sign in", exact: true }).isEnabled().catch(() => false)) break; }
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL((u: URL) => !u.pathname.startsWith("/login"), { timeout: 180_000 });
    await page.waitForTimeout(2500);
    return { ctx, page };
  };
  const shot = async (page: any, name: string) => { await page.waitForTimeout(1200); await page.screenshot({ path: path.join(OUT, `${name}.png`) }); };
  const go = async (page: any, p: string) => { await page.goto(`${WEB_URL}${p}`, { waitUntil: "load", timeout: 120_000 }).catch(() => {}); await page.waitForTimeout(4500); await page.locator('button:has-text("×")').first().click({ timeout: 1500 }).catch(() => {}); await page.keyboard.press("Escape").catch(() => {}); await page.waitForTimeout(500); };
  const browser = await chromium.launch({ headless: true });
  // fresh pending requests to photograph: a new booking E (card, far day)
  const parentTok = await signIn(em("parent")); const provTok = await signIn(em("prov"));
  const detail = await call(parentTok, "GET", `/api/listings/${st.listing}`);
  const blk = (detail.json?.blocks ?? []).find((b: any) => (b.sessions ?? []).some((s: any) => s.date === st.far));
  const eveName = `Eve${Date.now().toString(36).slice(-3)}`;
  const bE = await call(parentTok, "POST", "/api/my/bookings", { listingId: st.listing, blockId: blk?.id, method: "bank", items: [{ pass: "Single day", dates: [st.far], child: eveName, age: 7, addons: [{ id: "ao-tshirt", answers: { "q-size": "S" } }, { id: "ao-bottle", answers: { "q-col": "blue" } }] }] });
  const refE = bE.json?.bookings?.[0]?.ref;
  if (!refE) console.log("bE failed", bE.status, JSON.stringify(bE.json).slice(0, 300), "block", blk?.id, "detail", detail.status);
  // parent: UI request
  const par = await login(browser, em("parent"));
  await go(par.page, `/custdash/bookings?open=${encodeURIComponent(refE)}`);
  await shot(par.page, "01-parent-booking-extras");
  const open = par.page.getByText("Change or cancel an extra", { exact: false }).first();
  const panelP = () => par.page.locator("[data-testid=addon-requests-parent]").filter({ hasText: eveName }).first();
  T("UI parent: the 'Change or cancel an extra' link is on the booking", await open.isVisible().catch(() => false), refE);
  await open.click().catch(() => {});
  await par.page.waitForTimeout(2500);
  await shot(par.page, "02-parent-panel-open");
  await par.page.getByText(eveName).first().scrollIntoViewIfNeeded().catch(() => {});
  await panelP().getByRole("button", { name: "Request a change" }).first().click().catch(() => {});
  await par.page.waitForTimeout(800);
  await panelP().locator("select").first().selectOption("L").catch(() => {});
  await panelP().locator("textarea").first().fill("Bigger please").catch(() => {});
  await shot(par.page, "03-parent-change-form");
  await panelP().getByRole("button", { name: "Send request" }).click().catch(() => {});
  await par.page.waitForTimeout(3000);
  await shot(par.page, "04-parent-request-sent");
  const sentTxt = await panelP().innerText().catch(() => "");
  T("UI parent: request sent and shown as waiting for the provider", /Request sent/i.test(sentTxt), sentTxt.replace(/\s+/g, " ").slice(0, 160));
  // second request: cancel the bottle
  await panelP().getByRole("button", { name: "Request to cancel" }).first().click().catch(() => {});
  await par.page.waitForTimeout(600);
  await panelP().getByRole("button", { name: "Send request" }).click().catch(() => {});
  await par.page.waitForTimeout(2500);
  await shot(par.page, "05-parent-two-pending");
  // provider: list chip, Requests tab, detail panel
  const pv = await login(browser, em("prov"));
  await go(pv.page, "/freelancer/bookings");
  await shot(pv.page, "06-provider-list-chip");
  const chip = pv.page.locator("[data-testid=addon-request-chip]").first();
  T("UI provider: the bookings list shows the purple 'Extra request' line on the row", await chip.isVisible().catch(() => false), "");
  const reqTab = pv.page.getByRole("button", { name: /Requests/ }).first();
  await reqTab.click().catch(() => {});
  await pv.page.waitForTimeout(1500);
  await shot(pv.page, "07-provider-requests-tab");
  await go(pv.page, `/freelancer/bookings?ref=${encodeURIComponent(refE)}`);
  await shot(pv.page, "08-provider-detail-requests");
  const panel = pv.page.locator("[data-testid=addon-requests]");
  T("UI provider: the booking detail shows both requests with Approve / Decline", (await panel.locator("[data-testid=addon-request]").count().catch(() => 0)) === 2, "");
  // approve the change, decline the cancel
  const cards = panel.locator("[data-testid=addon-request]");
  await cards.nth(0).getByRole("button", { name: "Approve" }).click().catch(() => {});
  await pv.page.waitForTimeout(2500);
  await shot(pv.page, "09-provider-after-approve");
  await panel.locator("[data-testid=addon-request]").first().getByRole("button", { name: "Decline" }).click().catch(() => {});
  await pv.page.waitForTimeout(500);
  await pv.page.getByPlaceholder(/Reason/i).first().fill("Already ordered").catch(() => {});
  await shot(pv.page, "10-provider-decline-reason");
  await pv.page.locator("[data-testid=addon-request]").first().getByRole("button", { name: "Decline" }).last().click().catch(() => {});
  await pv.page.waitForTimeout(2500);
  await shot(pv.page, "11-provider-after-decline");
  const fin = await call(provTok, "GET", `/api/bookings/${refE}`);
  T("UI provider: approved the change (size L) and declined the cancel; the extra and booking stand", /size: L/.test(fin.json?.addonLines?.[0]?.label ?? "") && fin.json?.addonLines?.length === 2 && fin.json?.status === "Confirmed" && fin.json?.addonRequests?.map((r: any) => r.status).join() === "approved,declined", `${fin.json?.addonLines?.map((l: any) => l.label).join(" | ")} ${fin.json?.addonRequests?.map((r: any) => r.status).join()}`);
  // parent after: bell + booking
  await go(par.page, `/custdash/bookings?open=${encodeURIComponent(refE)}`);
  await shot(par.page, "12-parent-after-answers");
  // setup option
  await go(pv.page, "/freelancer/setup");
  await shot(pv.page, "13-provider-setup");
  // mobile
  const mob = await login(browser, em("parent"), { width: 390, height: 844 });
  await go(mob.page, `/custdash/bookings?open=${encodeURIComponent(refE)}`);
  await mob.page.getByText("Change or cancel an extra", { exact: false }).first().click().catch(() => {});
  await mob.page.waitForTimeout(2000);
  await shot(mob.page, "14-parent-mobile-panel");
  await browser.close();
  console.log("UI phase done", refE);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
