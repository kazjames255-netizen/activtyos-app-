import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_POLICIES, refundFor } from "../lib/cancellation";
import { ROOT } from "./helpers/env";
import { apiFetch, apiPost } from "./helpers/accounts";
import * as K from "./helpers/polKit";
import { mkParent, mkOp, setAccts, setSettings, mkListing, setPolicy, book, opBooking, opAct, markPaid, pCancel, wallet, oracle, plus, POLICIES, CUSTOM, stamp, type L } from "./helpers/polKit";
declare const require: (m: string) => any;

test.describe.configure({ mode: "serial" });
const SHOTS = path.join(ROOT, "e2e/review/shots/pol");
const OUT = path.join(SHOTS, "results2.json");
const RES: Record<string, { status: string; note: string }> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const rec = (id: string, status: "pass" | "fail" | "info", note: string) => { RES[id] = { status, note }; fs.writeFileSync(OUT, JSON.stringify(RES, null, 1)); console.log(`RESULT ${id} ${status} :: ${note}`); };
async function check(id: string, fn: () => Promise<string>) {
  try { rec(id, "pass", await fn()); } catch (e) { rec(id, "fail", String((e as Error).message).split("\n").filter(Boolean).slice(0, 4).join(" | ").slice(0, 800)); }
}
const API_LOG = "/tmp/aos-api-dev.log";
const mailCount = (to: string, subjectPart: RegExp) => { try { return fs.readFileSync(API_LOG, "utf8").split("\n").filter((l) => l.includes("[mail]") && l.includes(to) && subjectPart.test(l)).length; } catch { return -1; } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rd = (n: number) => Math.round(n * 100) / 100;
let parent: K.Acct, op: K.Acct;

test.beforeAll(async () => {
  test.setTimeout(300_000);
  parent = await mkParent("p"); op = await mkOp(); setAccts(parent, op);
  await setSettings(op, { cancellationPolicies: POLICIES, allowCardRefund: true, refundLetCustomerChoose: false, noRefundCredit: false, allowPartialCancel: true, partialAllowRefund: true, partialAllowWallet: true });
  console.log("ACCOUNTS", parent.email, op.email, op.tenantId);
});

// ===== B. booking types (policy applied to what was PAID) =====
test("B. booking types", async () => {
  test.setTimeout(1_200_000);
  const STD = DEFAULT_POLICIES[0].bands;
  const L3 = await mkListing(op, { title: `POL B3 ${stamp}`, offset: 5, policy: "standard", runDays: 14 });
  const L1 = await mkListing(op, { title: `POL B1 ${stamp}`, offset: 5, policy: "standard", passName: "1 day", passDays: 1, price: 18 });
  const cancelAndRead = async (who: K.Acct, ref: string, body: Record<string, unknown> = {}) => { const now = Date.now(); await pCancel(who, ref, body); return { b: await opBooking(ref), now }; };

  await check("B1 single day pass £18", async () => {
    const [b] = await book(parent, L1, { child: `b1 ${stamp}`, passName: "1 day", dates: L1.sessions.slice(0, 1) });
    await markPaid(b.ref); const { b: x, now } = await cancelAndRead(parent, b.ref);
    const e = oracle(STD, L1.sessions[0], 18, now); expect(x.cancel.amount).toBe(e.amount);
    return `paid £18, notice ${e.hours}h, ${e.pct}% -> £${x.cancel.amount} (${x.cancel.refund})`;
  });
  await check("B2 3-day pass £54 (control)", async () => {
    const [b] = await book(parent, L3, { child: `b2 ${stamp}`, dates: L3.sessions.slice(0, 3) });
    await markPaid(b.ref); const { b: x, now } = await cancelAndRead(parent, b.ref);
    const e = oracle(STD, L3.sessions[0], 54, now); expect(x.cancel.amount).toBe(e.amount);
    return `paid £54, ${e.pct}% -> £${x.cancel.amount}`;
  });
  await check("B3 multi-week (days in week 1 and week 2)", async () => {
    const d = [L3.sessions[0], L3.sessions[7], L3.sessions[8]];
    const bs = await book(parent, L3, { child: `b3 ${stamp}`, dates: d });
    const refs = bs.map((q) => q.ref);
    for (const r of refs) await markPaid(r);
    const outs: string[] = [];
    for (const r of refs) { const { b: x, now } = await cancelAndRead(parent, r); const first = (x.days ?? []).slice().sort()[0] ?? d[0]; const e = oracle(STD, first, x.amount, now); expect(x.cancel.amount, `${r} first=${first}`).toBe(e.amount); outs.push(`${r} ${(x.days ?? []).join("/")} £${x.amount} -> £${x.cancel.amount} (${e.pct}%)`); }
    return `${refs.length} booking(s) from one checkout: ${outs.join(" ; ")}`;
  });
  await check("B4 two children in one checkout, cancel one", async () => {
    const bs = await book(parent, L3, { child: `b4a ${stamp}`, dates: L3.sessions.slice(0, 3), extraItems: [{ pass: "3 days", child: `b4b ${stamp}`, age: 7, dates: L3.sessions.slice(0, 3) }] });
    expect(bs.length).toBeGreaterThanOrEqual(1);
    for (const q of bs) await markPaid(q.ref);
    const refs = bs.map((q) => q.ref);
    const { b: x } = await cancelAndRead(parent, refs[0]);
    expect(x.status).toBe("Cancelled");
    let other = "single booking holding both kids";
    if (refs.length > 1) { const o = await opBooking(refs[1]); expect(o.status).not.toBe("Cancelled"); other = `sibling ${refs[1]} still ${o.status}/${o.pay}`; }
    else { const kids = (x.kids ?? []).map((k: any) => k.name + (k.cancelled ? "(cancelled)" : "")).join(", "); other += `: kids=${kids}`; }
    return `${refs.length} booking(s); cancelled ${refs[0]} refund £${x.cancel.amount} of £${x.amount}; ${other}`;
  });
  await check("B4b two children, release ONE child's days (refund)", async () => {
    const l = await mkListing(op, { title: `POL B4b ${stamp}`, offset: 6, policy: "standard", runDays: 6 });
    const bs = await book(parent, l, { child: `b4c ${stamp}`, dates: l.sessions.slice(0, 3), extraItems: [{ pass: "3 days", child: `b4d ${stamp}`, age: 7, dates: l.sessions.slice(0, 3) }] });
    const ref = bs[0].ref; await markPaid(ref);
    const now = Date.now();
    await pCancel(parent, ref, { kids: [{ name: `b4c ${stamp}`, days: l.sessions.slice(0, 3) }], resolution: "refund" });
    const x = await opBooking(ref);
    // Released days are valued PER DAY on each day's own date (documented in my.ts partialCancel): £18 a day each (108 over 6 child-days).
    const expDays = l.sessions.slice(0, 3).map((dd) => oracle(STD, dd, 18, now).amount);
    const exp = rd(expDays.reduce((a, c) => a + c, 0));
    const wholeCancel = oracle(STD, l.sessions[0], 54, now).amount;
    expect(x.cancel?.amount).toBe(exp);
    expect(x.status).not.toBe("Cancelled");
    return `booking £${x.amount} for 2 kids; one child's 3 days released: each day on its own date ${expDays.map((v) => "£" + v).join(" + ")} = £${x.cancel?.amount} (cancelling a whole £54 booking at the first date would give £${wholeCancel}); booking still ${x.status}; kids=${(x.kids ?? []).map((k: any) => `${k.name}${k.cancelled ? "(cancelled)" : ""}`).join(", ")}`;
  });
  const SIB = (kind: "early", method: "percent" | "subtract", value: number) => [{ id: `d${method}${Date.now()}`, kind, name: `${method} early`, passNames: [], enabled: true, appliesTo: "all", moreThan: 0, method, value, beforeDate: plus(60) }];
  await check("B5 discounted: 10% early-bird", async () => {
    const l = await mkListing(op, { title: `POL B5 ${stamp}`, offset: 5, policy: "standard", discounts: SIB("early", "percent", 10) });
    const [b] = await book(parent, l, { child: `b5 ${stamp}`, dates: l.sessions.slice(0, 3) });
    expect(b.amount).toBe(48.6);
    await markPaid(b.ref); const { b: x, now } = await cancelAndRead(parent, b.ref);
    const e = oracle(STD, l.sessions[0], 48.6, now); expect(x.cancel.amount).toBe(e.amount);
    return `list £54 -> paid £${b.amount} (discount ${JSON.stringify(x.discountNames ?? x.discountName ?? "")}); refund ${e.pct}% of PAID = £${x.cancel.amount}`;
  });
  await check("B6 discounted: fixed £10 early-bird", async () => {
    const l = await mkListing(op, { title: `POL B6 ${stamp}`, offset: 5, policy: "standard", discounts: SIB("early", "subtract", 10) });
    const [b] = await book(parent, l, { child: `b6 ${stamp}`, dates: l.sessions.slice(0, 3) });
    expect(b.amount).toBe(44);
    await markPaid(b.ref); const { b: x, now } = await cancelAndRead(parent, b.ref);
    const e = oracle(STD, l.sessions[0], 44, now); expect(x.cancel.amount).toBe(e.amount);
    return `list £54 -> paid £${b.amount}; refund ${e.pct}% of PAID = £${x.cancel.amount}`;
  });
  await check("B7 add-on included (£5 one-off)", async () => {
    const t = await op.token();
    const lib = ((await apiFetch<Record<string, any> | null>("/api/library", t)) ?? {}) as { addons?: any[]; venues?: any[]; settings?: any };
    await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ addons: [...(lib.addons ?? []), { id: "pol-addon", name: "Lunch", type: "oneoff", price: 5 }], settings: lib.settings }) });
    const l = await mkListing(op, { title: `POL B7 ${stamp}`, offset: 5, policy: "standard", extra: { addonIds: ["pol-addon"] } });
    const r7 = await apiPost<{ bookings: Record<string, any>[] }>("/api/my/bookings", await parent.token(), { listingId: l.id, blockId: l.blockId, method: "card", walletCap: 0, items: [{ pass: "3 days", child: `b7 ${stamp}`, age: 8, dates: l.sessions.slice(0, 3), addons: [{ id: "pol-addon" }] }] });
    const b = r7.bookings[0];
    expect(b.amount).toBe(59);
    await markPaid(b.ref); const { b: x, now } = await cancelAndRead(parent, b.ref);
    const e = oracle(STD, l.sessions[0], 59, now); expect(x.cancel.amount).toBe(e.amount);
    return `pass £54 + add-on £5 = £${b.amount}; refund ${e.pct}% of TOTAL = £${x.cancel.amount}`;
  });
  await check("B8 part-paid (£20 of £54)", async () => {
    const [b] = await book(parent, L3, { child: `b8 ${stamp}`, dates: L3.sessions.slice(0, 3) });
    await apiPost(`/api/bookings/${b.ref}/record-payment`, await op.token(), { amount: 20, method: "Bank transfer", reference: `pp${stamp}` });
    const mid = await opBooking(b.ref); expect(mid.pay).toBe("Partially paid");
    const { b: x, now } = await cancelAndRead(parent, b.ref);
    const e = oracle(STD, L3.sessions[0], 20, now); expect(x.cancel.amount).toBe(e.amount);
    return `owed £54, paid £20 (${mid.pay}); refund ${e.pct}% of PAID = £${x.cancel.amount} (never of the £54 price)`;
  });
  await check("B9 unpaid booking", async () => {
    const [b] = await book(parent, L3, { child: `b9 ${stamp}`, dates: L3.sessions.slice(0, 3) });
    const { b: x } = await cancelAndRead(parent, b.ref);
    expect(x.cancel.amount).toBe(0); expect(x.cancel.refund).toBe("none");
    return `unpaid: cancel.refund=${x.cancel.refund} amount=${x.cancel.amount}, status ${x.status}`;
  });
  await check("B10 provider cancels: 'we cancelled it' inside the no-refund window", async () => {
    const l = await mkListing(op, { title: `POL B10 ${stamp}`, offset: 1, policy: "none" });
    const [b] = await book(parent, l, { child: `b10 ${stamp}`, dates: l.sessions.slice(0, 3) });
    await markPaid(b.ref);
    await opAct(b.ref, { type: "cancel", refund: "full", reason: "Weather" });
    const x = await opBooking(b.ref);
    expect(x.cancel.amount).toBe(54);
    return `policy 'No refunds', 1 day out: provider chose full -> cancel.amount £${x.cancel.amount} refund=${x.cancel.refund} pay=${x.pay}`;
  });
  await check("B11 release ONE day of 3 (refund) under each policy", async () => {
    const outs: string[] = [];
    for (const pol of POLICIES) {
      const l = await mkListing(op, { title: `POL B11${pol.id} ${stamp}`, offset: 6, policy: pol.id });
      const [b] = await book(parent, l, { child: `b11${pol.id} ${stamp}`, dates: l.sessions.slice(0, 3) });
      await markPaid(b.ref);
      const day = l.sessions[2];
      const now = Date.now();
      await pCancel(parent, b.ref, { days: [day], resolution: "refund" });
      const x = await opBooking(b.ref);
      const e = oracle(pol.bands, day, 18, now);
      outs.push(`${pol.id}: day ${day} expected £${e.amount} actual £${x.cancel?.amount}`);
      expect(x.cancel?.amount, `${pol.id}`).toBe(e.amount);
    }
    return outs.join(" ; ");
  });
});

// ===== C. payment methods: who gets the money back, and how =====
const ledger = async () => (await apiFetch<any[]>("/api/payments", await op.token())) ?? [];
test("C. payment methods and refund destination", async () => {
  test.setTimeout(1_200_000);
  const stripe = new (require("/Users/kazjames/Downloads/activtyos-app-/server/node_modules/stripe"))(
    (fs.readFileSync("/Users/kazjames/Downloads/activtyos-app-/server/.env", "utf8").match(/^STRIPE_SECRET_KEY=(\S+)/m) ?? [])[1]);
  const admin = require("/Users/kazjames/Downloads/activtyos-app-/server/node_modules/firebase-admin");
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require("/Users/kazjames/Downloads/activtyos-app-/server/serviceAccountKey.json")) });
  await setSettings(op, { voucherProviders: [{ id: "polv", name: "POL Vouchers", details: [{ label: "Account", value: "POL-1" }] }], customerArea: { wallet: true } });
  const L = await mkListing(op, { title: `POL C ${stamp}`, offset: 10, policy: "standard", runDays: 8 });
  const dates = L.sessions.slice(0, 3);
  const flow = async (id: string, o: { method: string; extra?: Record<string, unknown>; prep?: (ref: string) => Promise<void>; wallet?: number; expect: (b: any, d: { w0: number; w1: number; refunds: any[] }) => string; refundPref?: "card" | "wallet" }) => {
    await check(id, async () => {
      const child = `c${id.replace(/\W/g, "")} ${stamp}`;
      const [b] = await book(parent, L, { child, dates, method: o.method, extra: o.extra, walletCap: o.wallet ?? 0 });
      if (o.prep) await o.prep(b.ref); else await markPaid(b.ref);
      const w0 = await wallet(parent);
      await pCancel(parent, b.ref, o.refundPref ? { refundPref: o.refundPref } : {});
      const mailBefore = mailCount(parent.email, /Refund approved/);
      const pre = await opBooking(b.ref);
      let approveErr = "";
      if (pre.cancel?.refund && pre.cancel.refund !== "none") { try { await opAct(b.ref, { type: "refund-approve" }); } catch (e) { approveErr = String((e as Error).message).slice(0, 200); } }
      await sleep(1500);
      const x = await opBooking(b.ref); const w1 = await wallet(parent);
      const refunds = (await ledger()).filter((p) => (p.refs ?? []).includes(b.ref) && p.type === "refund");
      const mails = mailCount(parent.email, /Refund approved/) - mailBefore;
      const msg = o.expect(x, { w0, w1, refunds });
      return `${msg} | pay=${x.pay} cancel=${JSON.stringify({ refund: x.cancel?.refund, amount: x.cancel?.amount, to: x.cancel?.refundTo, via: x.cancel?.refundVia })} refundedApproved=${x.refundedApproved ?? 0} wallet ${w0}->${w1} ledger=${refunds.map((r) => `${r.method ?? r.via}:${r.amount}:${r.status}`).join(",") || "none"} refundEmails=${mails}${approveErr ? " approveErr=" + approveErr : ""}`;
    });
  };

  await flow("C1 card (real Stripe test PaymentIntent)", {
    method: "card",
    prep: async (ref) => {
      const pi = await stripe.paymentIntents.create({ amount: 5400, currency: "gbp", payment_method: "pm_card_visa", confirm: true, automatic_payment_methods: { enabled: true, allow_redirects: "never" } });
      await markPaid(ref);
      const q = await admin.firestore().collection("bookings").where("ref", "==", ref).where("tenantId", "==", op.tenantId).get();
      await q.docs[0].ref.set({ paymentIntentId: pi.id, cardPaid: 54, method: "card" }, { merge: true });
      (globalThis as any).__pi = pi.id;
    },
    expect: (x) => { return `Stripe PI ${(globalThis as any).__pi}`; },
  });
  { // verify the Stripe-side refund of C1
    await check("C1b Stripe shows the refund", async () => {
      const pi = (globalThis as any).__pi as string;
      const r = await stripe.refunds.list({ payment_intent: pi });
      expect(r.data.length).toBe(1); expect(r.data[0].amount).toBe(5400);
      return `Stripe refund ${r.data[0].id} £${r.data[0].amount / 100} status=${r.data[0].status} on ${pi}`;
    });
  }
  await flow("C2 bank transfer", { method: "Bank transfer", expect: (x, d) => { expect(x.cancel.refundVia).toBe("offline"); expect(d.w1 - d.w0).toBe(0); return "offline refund owed (no wallet move)"; } });
  await flow("C3 cash", { method: "Cash", expect: (x, d) => { expect(x.cancel.refundVia).toBe("offline"); return "offline refund owed"; } });
  await flow("C4 Tax-Free Childcare", { method: "Tax-Free Childcare", prep: async (ref) => { await markPaid(ref); }, expect: (x, d) => { expect(["wallet", "offline"]).toContain(x.cancel.refundVia); return `TFC refund went via ${x.cancel.refundVia}`; } });
  await flow("C5 childcare voucher", { method: "Childcare voucher", extra: { voucherScheme: "polv" }, expect: (x, d) => { expect(["wallet", "offline"]).toContain(x.cancel.refundVia); return `voucher refund via ${x.cancel.refundVia}`; } });
  await check("C6 wallet-funded (wallet £54)", async () => {
    const { execFileSync } = require("node:child_process");
    execFileSync("npx", ["tsx", "../e2e/helpers/walletCredit.ts", op.tenantId!, parent.email, "54"], { cwd: "/Users/kazjames/Downloads/activtyos-app-/server", stdio: "pipe" });
    const w0 = await wallet(parent);
    const [b] = await book(parent, L, { child: `c6 ${stamp}`, dates, method: "card", walletCap: 54 });
    const mid = await opBooking(b.ref);
    await pCancel(parent, b.ref, {});
    const pre = await opBooking(b.ref);
    if (pre.cancel?.refund && pre.cancel.refund !== "none") await opAct(b.ref, { type: "refund-approve" });
    await sleep(1500);
    const x = await opBooking(b.ref); const w1 = await wallet(parent);
    return `wallet before booking £${w0}; booking amount £${mid.amount} walletApplied £${mid.walletApplied}; cancel=${JSON.stringify({ r: x.cancel?.refund, a: x.cancel?.amount })}; pay=${x.pay}; wallet after refund £${w1} (expect back to £${w0 + (mid.walletApplied ?? 0)}) walletRefunded=${x.walletRefunded}`;
  });
  await check("C6b wallet part + card part (wallet £30, rest card)", async () => {
    const { execFileSync } = require("node:child_process");
    execFileSync("npx", ["tsx", "../e2e/helpers/walletCredit.ts", op.tenantId!, parent.email, "30"], { cwd: "/Users/kazjames/Downloads/activtyos-app-/server", stdio: "pipe" });
    const w0 = await wallet(parent);
    const [b] = await book(parent, L, { child: `c6b ${stamp}`, dates, method: "card", walletCap: 30 });
    await markPaid(b.ref);
    const mid = await opBooking(b.ref);
    await pCancel(parent, b.ref, {});
    await opAct(b.ref, { type: "refund-approve" });
    await sleep(1500);
    const x = await opBooking(b.ref); const w1 = await wallet(parent);
    const refunds = (await ledger()).filter((p) => (p.refs ?? []).includes(b.ref) && p.type === "refund");
    expect(w1 - w0 + (mid.walletApplied ?? 0)).toBeGreaterThanOrEqual(mid.walletApplied ?? 0);
    return `amount £${mid.amount}, wallet £${mid.walletApplied} + cash £${rd((mid.amount ?? 0) - (mid.walletApplied ?? 0))}; refund approved £${x.refundedApproved}; walletRefunded=${x.walletRefunded}; wallet ${w0} -> ${w1} (before booking it was ${w0}, booking took ${mid.walletApplied}); ledger=${refunds.map((r) => `${r.method ?? r.via}:${r.amount}`).join(",")}`;
  });
  await check("C7 HAF £0 booking (made by the provider for the family)", async () => {
    const l0 = await mkListing(op, { title: `POL C7 ${stamp}`, offset: 10, policy: "standard", price: 0 });
    const made = await apiPost<Record<string, any>>("/api/bookings", await op.token(), { booker: "Parent", email: parent.email, child: `c7 ${stamp}`, age: 8, listing: l0.title, pass: "3 days", blockId: l0.blockId, amount: 0, method: "HAF (funded £0)" });
    const x0 = await opBooking(made.ref);
    await pCancel(parent, made.ref, {});
    const x = await opBooking(made.ref);
    expect(x.status).toBe("Cancelled"); expect(x.cancel?.amount ?? 0).toBe(0);
    const refunds = (await ledger()).filter((p) => (p.refs ?? []).includes(made.ref) && p.type === "refund");
    expect(refunds.length).toBe(0);
    return `£0 booking amount=${x0.amount} pay=${x0.pay}; parent cancel ok, cancel.refund=${x.cancel?.refund} amount=${x.cancel?.amount ?? 0}; no wallet credit or ledger refund created`;
  });
});

// ===== D. policy changes and fallbacks =====
test("D. policy changes mid-season, fallbacks", async () => {
  test.setTimeout(900_000);
  const STD = DEFAULT_POLICIES[0].bands;
  const L = await mkListing(op, { title: `POL D ${stamp}`, offset: 8, policy: "standard" });
  const mk = async (tag: string) => { const [b] = await book(parent, L, { child: `${tag} ${stamp}`, dates: L.sessions.slice(0, 3) }); await markPaid(b.ref); return b.ref as string; };
  const cancelRead = async (ref: string) => { const now = Date.now(); await pCancel(parent, ref, {}); return { x: await opBooking(ref), now }; };
  await check("D1 policy edited AFTER booking (Standard made stricter)", async () => {
    const ref = await mk("d1");
    const before = oracle(STD, L.sessions[0], 54).amount;
    const strict = [{ hoursBefore: 336, refundPercent: 100 }, { hoursBefore: 0, refundPercent: 0 }];
    await setSettings(op, { cancellationPolicies: POLICIES.map((p) => (p.id === "standard" ? { ...p, bands: strict } : p)) });
    const { x } = await cancelRead(ref);
    await setSettings(op, { cancellationPolicies: POLICIES });
    return `booked under Standard (would refund £${before} at this notice); provider then changed Standard to '100% at 14 days, else 0'; cancel gave £${x.cancel.amount}. => The refund uses the policy AS IT IS AT CANCEL TIME, not the one the family booked under (no snapshot on the booking).`;
  });
  await check("D2 listing switched to another policy after booking", async () => {
    const ref = await mk("d2");
    await setPolicy(L, "none");
    const { x } = await cancelRead(ref);
    await setPolicy(L, "standard");
    expect(x.cancel.amount).toBe(0);
    return `listing moved Standard -> No refunds after booking: cancel gave £${x.cancel.amount}`;
  });
  await check("D3 listing's policy deleted from Setup", async () => {
    const ref = await mk("d3");
    await setPolicy(L, "strict");
    await setSettings(op, { cancellationPolicies: POLICIES.filter((p) => p.id !== "strict") });
    const { x } = await cancelRead(ref);
    await setSettings(op, { cancellationPolicies: POLICIES }); await setPolicy(L, "standard");
    const first = POLICIES.filter((p) => p.id !== "strict")[0];
    const e = oracle(first.bands, L.sessions[0], 54);
    expect(x.cancel.amount).toBe(e.amount);
    return `listing pointed at deleted 'strict'; server fell back to the FIRST remaining policy (${first.name}) -> £${x.cancel.amount}`;
  });
  await check("D4 listing with NO policy chosen when the provider reorders policies", async () => {
    const t = await op.token();
    // listing without a policy id: PUT null is not allowed to clear, so create a fresh listing without one
    const l2 = await mkListing(op, { title: `POL D4 ${stamp}`, offset: 8 });
    const [b] = await book(parent, l2, { child: `d4 ${stamp}`, dates: l2.sessions.slice(0, 3) }); await markPaid(b.ref);
    const reordered = [POLICIES[3], POLICIES[0], POLICIES[1], POLICIES[2], POLICIES[4]]; // 'No refunds' first
    await setSettings(op, { cancellationPolicies: reordered });
    const doc = await apiFetch<any>(`/api/listings/${l2.id}`, t);
    const now = Date.now(); await pCancel(parent, b.ref, {}); const x = await opBooking(b.ref);
    await setSettings(op, { cancellationPolicies: POLICIES });
    return `listing.cancellationPolicyId=${JSON.stringify(doc.cancellationPolicyId ?? null)}; with 'No refunds' moved to the top of the list the cancel gave £${x.cancel.amount} (a listing with no explicit policy follows whichever policy is FIRST)`;
  });
});

// ===== E. credit note instead of a nil refund =====
test("E. no-refund credit note", async () => {
  test.setTimeout(600_000);
  await setSettings(op, { noRefundCredit: true, customerArea: { wallet: true } });
  const L = await mkListing(op, { title: `POL E ${stamp}`, offset: 1, policy: "none" });
  await check("E1 noRefundCredit ON, wallet ON, inside no-refund window", async () => {
    const [b] = await book(parent, L, { child: `e1 ${stamp}`, dates: L.sessions.slice(0, 3) }); await markPaid(b.ref);
    const w0 = await wallet(parent);
    await pCancel(parent, b.ref, {});
    const pre = await opBooking(b.ref);
    expect(pre.cancel.refundTo).toBe("wallet"); expect(pre.cancel.amount).toBe(54);
    const wMid = await wallet(parent);
    await opAct(b.ref, { type: "refund-approve" }); await sleep(1500);
    const x = await opBooking(b.ref); const w1 = await wallet(parent);
    expect(w1 - w0).toBe(54);
    return `on cancel: cancel.amount=${pre.cancel.amount} refundTo=${pre.cancel.refundTo} (wallet unchanged ${wMid - w0} until the provider approves); after approve wallet +${w1 - w0}; pay=${x.pay}`;
  });
  await check("E2 noRefundCredit ON but wallet switched OFF", async () => {
    await setSettings(op, { customerArea: { wallet: false } });
    const [b] = await book(parent, L, { child: `e2 ${stamp}`, dates: L.sessions.slice(0, 3) }); await markPaid(b.ref);
    await pCancel(parent, b.ref, {});
    const x = await opBooking(b.ref);
    await setSettings(op, { customerArea: { wallet: true } });
    expect(x.cancel.amount).toBe(0);
    return `no credit note when the wallet is off: cancel.amount=${x.cancel.amount} refund=${x.cancel.refund}`;
  });
  await check("E3 noRefundCredit ON, partial refund due (not nil)", async () => {
    const l3 = await mkListing(op, { title: `POL E3 ${stamp}`, offset: 4, policy: "standard" });
    const [b] = await book(parent, l3, { child: `e3 ${stamp}`, dates: l3.sessions.slice(0, 3) }); await markPaid(b.ref);
    await pCancel(parent, b.ref, {});
    const x = await opBooking(b.ref);
    expect(x.cancel.amount).toBe(27); expect(x.cancel.refundTo).not.toBe("wallet-credit-note");
    return `standard 50%: cancel.amount=${x.cancel.amount} refundTo=${x.cancel.refundTo ?? "(card/default)"}; NO extra credit note on top of a partial refund`;
  });
  await setSettings(op, { noRefundCredit: false });
});
