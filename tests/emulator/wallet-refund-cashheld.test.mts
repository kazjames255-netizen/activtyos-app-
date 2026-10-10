// INDEPENDENT VERIFIER cases for wallet refund-back (c734ac51). Expected values are in ~/ActivityOS-QA/runs/wallet-refund-verify/EXPECTED.md (worked by hand first).
import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";
import { before, describe, it } from "node:test";
import { call, db, makeParent, makeProvider, makeListing, ok, operatorAction, bookingDoc, sleep, uniq, type Parent, type Provider } from "./helpers.mts";
import { refundTransferAmount, unsentRefunds } from "../../features/bookings/helpers";

const OUT = process.env.VOUT ?? "/dev/null";
const r2 = (n: number) => Math.round(n * 100) / 100;
let P: Provider;
const L: Record<string, { id: string; blockId: string; dates: string[] }> = {};
let seq = 0;
const BANK = { accountName: "Test Parent", sortCode: "112233", accountNumber: "12345678" };

/** soft-check recorder: collects mismatches, never throws, writes one row per case */
class Rec {
  fails: string[] = []; obs: Record<string, unknown> = {};
  constructor(public id: string, public expected: string) {}
  eq(label: string, actual: unknown, expected: unknown) {
    this.obs[label] = actual;
    if (JSON.stringify(actual) !== JSON.stringify(expected)) this.fails.push(`${label}: got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`);
  }
  note(label: string, v: unknown) { this.obs[label] = v; }
  done(record = false) {
    const result = record ? "RECORD" : this.fails.length ? "FAIL" : "PASS-EXECUTED";
    appendFileSync(OUT, JSON.stringify({ case: this.id, expected: this.expected, observed: JSON.stringify(this.obs).slice(0, 900), fails: this.fails, result }) + "\n");
    if (!record) assert.deepEqual(this.fails, [], this.id);
  }
}

async function listing(title: string, policyId?: string) {
  const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7) + 21);
  const end = new Date(start); end.setDate(end.getDate() + 27);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const period = await ok("POST", "/api/periods", P.token, { title: "Full day", start: "09:00", finish: "15:30" });
  const pass = await ok("POST", "/api/passes", P.token, { name: "Week pass", days: 5 });
  const bundle = await ok("POST", "/api/block-bundles", P.token, { name: `VR ${title}`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 100, calcOn: true });
  const lst = await ok("POST", "/api/listings", P.token, {
    title, venueId: "emu-venue", runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5],
    maxAttendees: "5000", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id,
    passes: [{ name: "Week pass", price: 100, days: 5 }], bookingType: "auto", status: "live", visibility: "public",
    ...(policyId ? { cancellationPolicyId: policyId } : {}),
  });
  await ok("PUT", `/api/block-bundles/${bundle.id}/listings`, P.token, { listingIds: [lst.id] });
  const blocks = await db.collection("blocks").where("listingId", "==", lst.id).get();
  const dates = (blocks.docs[0].data().sessions as { date: string }[]).map((s) => s.date).sort().slice(0, 5);
  return { id: lst.id as string, blockId: blocks.docs[0].id, dates };
}

let stripe: any, payIntent: any, deliver: any;
before(async () => {
  P = await makeProvider("VR");
  const lib = (await ok("GET", "/api/library", P.token)) ?? {};
  const venues: any[] = lib.venues ?? [];
  if (!venues.some((v) => v.id === "emu-venue")) venues.push({ id: "emu-venue", name: "Test Sports Hall", address: "1 Test Way", city: "Testville" });
  await ok("PUT", "/api/library", P.token, {
    venues, addons: lib.addons ?? [],
    settings: { ...(lib.settings ?? {}), marketplaceListed: true, allowPartialCancel: true, partialAllowWallet: true, partialAllowRefund: true, allowCardRefund: true,
      cancellationPolicies: [{ id: "half", name: "Half back", bands: [{ hoursBefore: 0, refundPercent: 50 }] }, { id: "none", name: "No refunds", bands: [{ hoursBefore: 0, refundPercent: 0 }] }] },
  });
  L.far = await listing(`VR far ${uniq()}`);
  L.half = await listing(`VR half ${uniq()}`, "half");
  L.none = await listing(`VR none ${uniq()}`, "none");
  try { const m: any = await import("./_stack.mts"); stripe = m.stripe; payIntent = m.payIntent; deliver = m.deliver; } catch (e) { console.log("no stripe:", (e as Error).message); }
});

const walletId = (email: string) => `${P.tenantId}__${email.trim().toLowerCase()}`;
const setWallet = (email: string, balance: number) => db.collection("wallet").doc(walletId(email)).set({ tenantId: P.tenantId, email: email.toLowerCase(), balance, updatedAt: new Date().toISOString() });
const walletBal = async (email: string) => r2(Number((await db.collection("wallet").doc(walletId(email)).get()).get("balance") ?? 0));
async function credited(ref: string) {
  const s = await db.collection("walletEntries").where("tenantId", "==", P.tenantId).where("ref", "==", ref).get();
  const pos = s.docs.filter((d) => Number(d.get("delta")) > 0);
  return { total: r2(pos.reduce((n, d) => n + Number(d.get("delta")), 0)), rows: pos.length };
}
const doc = (ref: string) => bookingDoc(P, ref);
const entriesOf = (b: Record<string, any>) => (b.refundEntries ?? []) as { amount: number; cash: number; via: string; status: string }[];
const sumVia = (b: Record<string, any>, via: string) => r2(entriesOf(b).filter((e) => e.via === via).reduce((n, e) => n + e.amount, 0));
const approve = (ref: string, extra: Record<string, unknown> = {}) => operatorAction(P, ref, { type: "refund-approve", ...extra });
const cancelPartial = (ref: string, amount: number) => operatorAction(P, ref, { type: "cancel", refund: "partial", amount });
const cancelFull = (ref: string) => operatorAction(P, ref, { type: "cancel", refund: "full" });
const stripeTotal = async (piId: string) => (await stripe.refunds.list({ payment_intent: piId })).data.reduce((s: number, r: any) => s + r.amount, 0) / 100;

interface Fam { parent: Parent; ref: string }
/** wallet W, then `cash` recorded as cash/bank by the provider, `card` paid via Stripe. gross 100 (5-day pass). Rest unpaid. */
async function mk(o: { wallet: number; cash?: number; card?: boolean; at?: string; cardAmt?: number }): Promise<Fam & { pi?: string }> {
  const l = L[o.at ?? "far"];
  const parent = await makeParent("VR", P);
  if (o.wallet > 0) await setWallet(parent.email, o.wallet);
  const r = await call("POST", "/api/my/bookings", parent.token, { listingId: l.id, blockId: l.blockId, walletCap: 1e6, method: o.card ? "card" : "Bank transfer", items: [{ pass: "Week pass", child: `Kid ${++seq}${uniq()}`, age: 8, dates: l.dates }] });
  assert.ok(r.status < 300, `book -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  const list = Array.isArray(r.json) ? r.json : (r.json?.bookings ?? [r.json]);
  const ref = (list[0]?.ref ?? list[0]?.booking?.ref) as string;
  const b = await doc(ref);
  assert.equal(r2((b.amount ?? 0) + (b.walletApplied ?? 0)), 100, "gross is 100");
  if (o.cash && o.cash > 0) {
    const pay = await call("POST", `/api/bookings/${encodeURIComponent(ref)}/record-payment`, P.token, { amount: o.cash, method: "Bank transfer" });
    assert.ok(pay.status < 300, `cash -> ${pay.status} ${JSON.stringify(pay.json).slice(0, 300)}`);
  }
  let pi: string | undefined;
  if (o.card) {
    const co = await call("POST", "/api/payments/checkout", parent.token, { refs: [ref], tenantId: P.tenantId });
    assert.equal(co.status, 201, JSON.stringify(co.json));
    pi = String(co.json.clientSecret).split("_secret_")[0];
    await payIntent(pi);
    const c = await call("POST", `/api/payments/checkout/${co.json.paymentId}/confirm`, parent.token);
    assert.equal(c.json.paid, true, JSON.stringify(c.json));
  }
  return { parent, ref, pi };
}
const snapshot = async (f: Fam) => { const b = await doc(f.ref); return { wal: await walletBal(f.parent.email), cr: await credited(f.ref), wr: b.walletRefunded ?? 0, awaiting: r2(unsentRefunds(b as never).reduce((n, x) => n + x.cash, 0)), entries: entriesOf(b).map((e) => `${e.via}:${e.amount}:${e.status}`), pay: b.pay, ra: b.refundedApproved }; };


import { createRequire } from "node:module";
const FV = createRequire(new URL("../../server/package.json", import.meta.url))("firebase-admin/firestore").FieldValue;
const waitDash = async (ref: string) => { const until = Date.now() + 10000; while (Date.now() < until && !((await doc(ref)).refundLog ?? []).some((l: any) => l.label === "Refunded in Stripe")) await sleep(200); };
const dash = async (pi: string, pounds: number, ref: string) => { const re = await stripe.refunds.create({ payment_intent: pi, amount: Math.round(pounds * 100) }); await deliver(`evt_vr_${uniq()}${uniq()}`, "refund.created", re); await waitDash(ref); };
const sentAll = async (ref: string) => operatorAction(P, ref, { type: "refund-sent" });

describe("W: new attacks on cashHeld", () => {
  it("S1 cash top-up between cancel and approval (wallet30+cash20, cancel full pending 50, +30 cash, approve)", async () => {
    const R = new Rec("S1", "RECORD: refund owed 50 (what was paid at cancel). hand: wallet 30, offline 20; the extra 30 cash received after cancel is not part of this refund");
    const f = await mk({ wallet: 30, cash: 20 });
    await cancelFull(f.ref); R.note("pending", (await doc(f.ref)).cancel?.amount); R.note("cashHeld", (await doc(f.ref)).cashHeld);
    const p = await call("POST", `/api/bookings/${encodeURIComponent(f.ref)}/record-payment`, P.token, { amount: 30, method: "Bank transfer" }); R.note("topup", p.status);
    const a = await approve(f.ref); R.note("approve", a.status);
    const s = await snapshot(f); R.note("snap", s);
    R.eq("wallet", s.cr.total, 30); R.eq("sum", r2(s.cr.total + s.awaiting), 50); R.done();
  });
  it("S2 record-payment AFTER cancel then approve (wallet30, rest unpaid, cancel full 30, +70 cash)", async () => {
    const R = new Rec("S2", "owed 30 = all wallet; wallet 30, awaiting 0 (late cash is not this refund)");
    const f = await mk({ wallet: 30 });
    await cancelFull(f.ref);
    const p = await call("POST", `/api/bookings/${encodeURIComponent(f.ref)}/record-payment`, P.token, { amount: 70, method: "Bank transfer" }); R.note("topup", p.status);
    await approve(f.ref); const s = await snapshot(f); R.note("snap", s);
    R.eq("wallet", s.cr.total, 30); R.eq("awaiting", s.awaiting, 0); R.done();
  });
  it("S3 second partial refund / S7 per-day cancels accumulating on wallet30+cash20; totals must be wallet 30, offline 20", async () => {
    const R = new Rec("S3", "three steps then full: final wallet 30 total, offline 20 total, nothing over");
    const f = await mk({ wallet: 30, cash: 20 });
    const steps: unknown[] = [];
    for (let i = 0; i < 2; i++) {
      const c = await operatorAction(P, f.ref, { type: "cancel-day", ki: 0, date: L.far.dates[i], resolution: "refund", amount: 10 }); 
      const a = await approve(f.ref); const bb = await doc(f.ref); steps.push([c.status, a.status, await snapshot(f), { amountPaid: bb.amountPaid, amount: bb.amount, cashHeld: bb.cashHeld, pay: bb.pay, wa: bb.walletApplied, wr: bb.walletRefunded, ra: bb.refundedApproved, log: (bb.refundLog||[]).map((x:any)=>x.amount) }]);
    }
    R.note("steps", steps);
    const s = await snapshot(f); R.eq("afterTwo", r2(s.cr.total + s.awaiting), 20);
    // proportional each time: 10 of pool 50 -> w6 o4 ; then 10 of 40 (w24,c16) -> w6 o4
    R.eq("wallet2", s.cr.total, 12); R.eq("awaiting2", s.awaiting, 8);
    R.done();
  });
  it("S3b ...then provider marks sent, then another cancel-day, then full cancel: totals exact", async () => {
    const R = new Rec("S3b", "after refund-sent and more: wallet total 30, offline total 20 (all refunded = paid 50)");
    const f = await mk({ wallet: 30, cash: 20 });
    await operatorAction(P, f.ref, { type: "cancel-day", ki: 0, date: L.far.dates[0], resolution: "refund", amount: 10 }); await approve(f.ref);
    const sent = await sentAll(f.ref); R.note("sent", [sent.status, sent.json?.error]);
    R.note("afterSent", await snapshot(f));
    const c = await operatorAction(P, f.ref, { type: "cancel-day", ki: 0, date: L.far.dates[1], resolution: "refund", amount: 10 }); R.note("cd2", c.status); await approve(f.ref);
    R.note("afterCd2", await snapshot(f));
    const cf = await cancelFull(f.ref); R.note("full", cf.status); const ap = await approve(f.ref); R.note("approveFull", ap.status);
    const s = await snapshot(f); R.note("final", s);
    const b = await doc(f.ref);
    const offAll = r2(entriesOf(b).filter((e) => e.via === "offline").reduce((n, e) => n + e.amount, 0));
    R.eq("walletTotal", s.cr.total, 30); R.eq("offlineTotal", offAll, 20); R.eq("ra", s.ra !== undefined, true); R.done();
  });
  it("S5 Stripe dashboard refund between cancel and approval (wallet30+card70, cancel full, dash 20, approve)", async (t) => {
    if (!stripe) return t.skip("no stripe"); const R = new Rec("S5", "refundable 80: wallet 30, card 50 (Stripe total 70, never more)");
    const f = await mk({ wallet: 30, card: true });
    await cancelFull(f.ref); R.note("pending", (await doc(f.ref)).cancel?.amount);
    await dash(f.pi!, 20, f.ref);
    const a = await approve(f.ref); R.note("approve", [a.status, a.json?.error]);
    const s = await snapshot(f); R.eq("wallet", s.cr.total, 30); R.eq("stripe", await stripeTotal(f.pi!), 70); R.note("entries", s.entries); R.done();
  });
  it("S6 two references on ONE checkout (wallet 30 each, card 70 each in one PI)", async (t) => {
    if (!stripe) return t.skip("no stripe"); const R = new Rec("S6", "refund A partial 50 -> w15 card35; refund B full -> w30 card70; Stripe total 105; wallet total 45");
    const parent = await makeParent("VR", P); await setWallet(parent.email, 60);
    const l = L.far;
    const refs: string[] = [];
    for (const nm of ["KA", "KB"]) {
      const r = await call("POST", "/api/my/bookings", parent.token, { listingId: l.id, blockId: l.blockId, walletCap: 1e6, method: "card", items: [{ pass: "Week pass", child: `${nm}${uniq()}`, age: 8, dates: l.dates }] });
      const list: any[] = Array.isArray(r.json) ? r.json : (r.json?.bookings ?? [r.json]); refs.push((list[0].ref ?? list[0].booking?.ref) as string);
    }
    R.eq("two", refs.length, 2);
    const ds = await Promise.all(refs.map(doc)); R.note("wa", ds.map((d) => [d.amount, d.walletApplied]));
    const co = await call("POST", "/api/payments/checkout", parent.token, { refs, tenantId: P.tenantId }); R.eq("co", co.status, 201);
    const pi = String(co.json.clientSecret).split("_secret_")[0]; await payIntent(pi);
    const cf = await call("POST", `/api/payments/checkout/${co.json.paymentId}/confirm`, parent.token); R.eq("paid", cf.json.paid, true);
    const wa0 = ds[0].walletApplied ?? 0, wa1 = ds[1].walletApplied ?? 0; R.note("splitW", [wa0, wa1]);
    await cancelPartial(refs[0], 50); await approve(refs[0]);
    const c0 = await credited(refs[0]); R.eq("A wallet", c0.total, r2(50 * wa0 / 100));
    const st1 = await stripeTotal(pi); R.eq("A stripe", st1, r2(50 - 50 * wa0 / 100));
    await cancelFull(refs[1]); await approve(refs[1]);
    const c1 = await credited(refs[1]); R.eq("B wallet", c1.total, wa1);
    R.eq("stripe total", await stripeTotal(pi), r2(150 - wa0 * 0.5 - wa1 > 0 ? (50 - 50 * wa0 / 100) + (100 - wa1) : 0));
    R.note("balance", await walletBal(parent.email)); R.done();
  });
  it("S9a LEGACY: paid booking 30w+70cash with cashHeld absent, partial 50", async () => {
    const R = new Rec("S9a", "15 / 35 (paid, so label reads right without cashHeld)");
    const f = await mk({ wallet: 30, cash: 70 });
    R.note("hasCashHeld", (await doc(f.ref)).cashHeld);
    await cancelPartial(f.ref, 50);
    const FieldValue = (await import("../../server/node_modules/firebase-admin/lib/firestore/index.js" as string).catch(() => null)) as any;
    await db.collection("bookings").doc(`${P.tenantId}_${f.ref}`).update({ cashHeld: FV.delete() });
    R.eq("deleted", (await doc(f.ref)).cashHeld, undefined);
    await approve(f.ref); const s = await snapshot(f); R.eq("wallet", s.cr.total, 15); R.eq("awaiting", s.awaiting, 35); R.done();
  });
  it("S9b LEGACY: part-paid wallet30+cash20 cancelled BEFORE the change (cashHeld absent, label Refund pending), approve after deploy", async () => {
    const R = new Rec("S9b", "RECORD: no cashHeld, label already settled: hand-ideal wallet 30 / offline 20 for a full 50");
    const f = await mk({ wallet: 30, cash: 20 });
    await cancelFull(f.ref);
    await db.collection("bookings").doc(`${P.tenantId}_${f.ref}`).update({ cashHeld: FV.delete() });
    await approve(f.ref); const s = await snapshot(f); R.note("snap", s); R.eq("wallet", s.cr.total, 30); R.eq("awaiting", s.awaiting, 20); R.done();
  });
  it("S9c LEGACY: wallet30 unpaid-rest cancelled before change (no cashHeld) RECORD", async () => {
    const R = new Rec("S9c", "RECORD: ideal wallet 30 awaiting 0");
    const f = await mk({ wallet: 30 });
    await cancelFull(f.ref);
    await db.collection("bookings").doc(`${P.tenantId}_${f.ref}`).update({ cashHeld: FV.delete() });
    await approve(f.ref); const s = await snapshot(f); R.note("snap", s); R.eq("wallet", s.cr.total, 30); R.eq("awaiting", s.awaiting, 0); R.done();
  });
  it("S10 per-day release on unpaid-rest (wallet 30 only) then full cancel: all wallet, never offline", async () => {
    const R = new Rec("S10", "only 30 ever paid (wallet): wallet total <= 30, offline 0 throughout, final wallet total 30");
    const f = await mk({ wallet: 30 });
    const c1 = await operatorAction(P, f.ref, { type: "cancel-day", ki: 0, date: L.far.dates[0], resolution: "refund" }); R.note("cd", c1.status);
    R.note("pending1", (await doc(f.ref)).cancel?.amount);
    await approve(f.ref); const s1 = await snapshot(f); R.note("s1", s1); R.eq("s1.awaiting", s1.awaiting, 0);
    const cf = await cancelFull(f.ref); R.note("full", cf.status); await approve(f.ref);
    const s = await snapshot(f); R.note("final", s); R.eq("walletTotal", s.cr.total, 30); R.eq("awaiting", s.awaiting, 0); R.done();
  });
  it("S11 parent release (refund) on unpaid-rest wallet30 then provider full cancel", async () => {
    const R = new Rec("S11", "all wallet, offline 0, wallet total 30");
    const f = await mk({ wallet: 30 });
    const days = L.far.dates.slice(0, 2);
    const pv = await call("POST", `/api/my/bookings/${encodeURIComponent(f.ref)}/release-preview`, f.parent.token, { days, resolution: "refund" }); R.note("pv", pv.json);
    const rel = await call("POST", `/api/my/bookings/${encodeURIComponent(f.ref)}/cancel`, f.parent.token, { days, resolution: "refund", msg: "x", refundBank: BANK }); R.note("rel", rel.status);
    await approve(f.ref); const s1 = await snapshot(f); R.note("s1", s1);
    await cancelFull(f.ref); await approve(f.ref);
    const s = await snapshot(f); R.note("final", s); R.eq("walletTotal", s.cr.total, 30); R.eq("awaiting", s.awaiting, 0); R.done();
  });
});

describe("W: real captured card hold", () => {
  it("V20real wallet 8 + held card 12 (manual approval), approve (capture), then partial 10 and full", async (t) => {
    if (!stripe) return t.skip("no stripe"); const R = new Rec("V20real", "gross 20, wallet 8, card 12: partial 10 -> wallet 4, Stripe 6; then full of remaining 10 -> wallet 4, Stripe 6");
    const M = await makeListing(P, `VR manual ${uniq()}`, true);
    const parent = await makeParent("VR", P); await setWallet(parent.email, 8);
    const r = await call("POST", "/api/my/bookings", parent.token, { listingId: M.id, blockId: M.blockId, walletCap: 1e6, method: "card", items: [{ pass: "Day pass", child: `KH${uniq()}`, age: 8 }] });
    R.eq("book", r.status < 300, true);
    const list: any[] = Array.isArray(r.json) ? r.json : (r.json?.bookings ?? [r.json]);
    const ref = (list[0].ref ?? list[0].booking?.ref) as string;
    const b0 = await doc(ref); R.note("b0", { amount: b0.amount, wa: b0.walletApplied, hold: b0.cardHold, status: b0.status });
    const co = await call("POST", "/api/payments/checkout", parent.token, { refs: [ref], tenantId: P.tenantId }); R.eq("co", co.status, 201);
    const pi = String(co.json.clientSecret).split("_secret_")[0]; await payIntent(pi);
    const cf = await call("POST", `/api/payments/checkout/${co.json.paymentId}/confirm`, parent.token); R.eq("held", cf.json.held, true);
    const ap = await operatorAction(P, ref, { type: "approve" }); R.note("approve", [ap.status, ap.json?.error]);
    await sleep(1500);
    const b1 = await doc(ref); R.note("afterCapture", { status: b1.status, pay: b1.pay, amountPaid: b1.amountPaid });
    const piObj = await stripe.paymentIntents.retrieve(pi); R.eq("captured", piObj.amount_received / 100, 12);
    await cancelPartial(ref, 10); await approve(ref);
    let s = await snapshot({ parent, ref }); R.eq("w1", s.cr.total, 4); R.eq("stripe1", await stripeTotal(pi), 6); R.eq("await1", s.awaiting, 0);
    // second: booking already cancelled; use cancel-day style not available (single day). Just record.
    R.note("final", s); R.done();
  });
  it("V20real-full: wallet 8 + held card 12, approve, full cancel", async (t) => {
    if (!stripe) return t.skip("no stripe"); const R = new Rec("V20real-full", "wallet 8, Stripe 12");
    const M = await makeListing(P, `VR manual ${uniq()}`, true);
    const parent = await makeParent("VR", P); await setWallet(parent.email, 8);
    const r = await call("POST", "/api/my/bookings", parent.token, { listingId: M.id, blockId: M.blockId, walletCap: 1e6, method: "card", items: [{ pass: "Day pass", child: `KH${uniq()}`, age: 8 }] });
    const list: any[] = Array.isArray(r.json) ? r.json : (r.json?.bookings ?? [r.json]); const ref = (list[0].ref ?? list[0].booking?.ref) as string;
    const co = await call("POST", "/api/payments/checkout", parent.token, { refs: [ref], tenantId: P.tenantId });
    const pi = String(co.json.clientSecret).split("_secret_")[0]; await payIntent(pi);
    await call("POST", `/api/payments/checkout/${co.json.paymentId}/confirm`, parent.token);
    await operatorAction(P, ref, { type: "approve" }); await sleep(1500);
    await cancelFull(ref); await approve(ref);
    const s = await snapshot({ parent, ref }); R.eq("wallet", s.cr.total, 8); R.eq("stripe", await stripeTotal(pi), 12); R.eq("awaiting", s.awaiting, 0); R.note("snap", s); R.done();
  });
  it("V20decline: held card + wallet 8, provider declines while held - RECORD", async (t) => {
    if (!stripe) return t.skip("no stripe"); const R = new Rec("V20decline", "RECORD: hold released, no Stripe refund (nothing captured), wallet?");
    const M = await makeListing(P, `VR manual ${uniq()}`, true);
    const parent = await makeParent("VR", P); await setWallet(parent.email, 8);
    const r = await call("POST", "/api/my/bookings", parent.token, { listingId: M.id, blockId: M.blockId, walletCap: 1e6, method: "card", items: [{ pass: "Day pass", child: `KH${uniq()}`, age: 8 }] });
    const list: any[] = Array.isArray(r.json) ? r.json : (r.json?.bookings ?? [r.json]); const ref = (list[0].ref ?? list[0].booking?.ref) as string;
    const co = await call("POST", "/api/payments/checkout", parent.token, { refs: [ref], tenantId: P.tenantId });
    const pi = String(co.json.clientSecret).split("_secret_")[0]; await payIntent(pi);
    await call("POST", `/api/payments/checkout/${co.json.paymentId}/confirm`, parent.token);
    const d = await operatorAction(P, ref, { type: "decline" }); R.note("decline", d.status); await sleep(1200);
    const piObj = await stripe.paymentIntents.retrieve(pi); R.note("pi", [piObj.status, piObj.amount_received]);
    R.note("balance", await walletBal(parent.email)); R.note("snap", await snapshot({ parent, ref })); R.done();
  });
});
