// INDEPENDENT VERIFIER cases for wallet refund-back (c734ac51). Expected values are in ~/ActivityLane-QA/runs/wallet-refund-verify/EXPECTED.md (worked by hand first).
import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";
import { before, describe, it } from "node:test";
import { call, db, makeParent, makeProvider, ok, operatorAction, bookingDoc, sleep, uniq, type Parent, type Provider } from "./helpers.mts";
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

describe("V: offline", () => {
  it("V01 wallet30+cash70 partial 50", async () => {
    const R = new Rec("V01", "wallet 15, offline 35 awaiting");
    const f = await mk({ wallet: 30, cash: 70 });
    await cancelPartial(f.ref, 50); await approve(f.ref);
    const s = await snapshot(f);
    R.eq("credited", s.cr, { total: 15, rows: 1 }); R.eq("awaiting", s.awaiting, 35); R.eq("balance", s.wal, 15); R.note("entries", s.entries); R.done();
  });
  it("V04 odd pennies 33.33: 33.33 / 0.01 / 99.99", async () => {
    for (const [amt, w, off] of [[33.33, 11.11, 22.22], [0.01, 0, 0.01], [99.99, 33.33, 66.66]] as const) {
      const R = new Rec(`V04-${amt}`, `wallet ${w}, offline ${off}`);
      const f = await mk({ wallet: 33.33, cash: 66.67 });
      const c = await cancelPartial(f.ref, amt); R.note("cancelStatus", c.status);
      const a = await approve(f.ref); R.note("approveStatus", a.status);
      const s = await snapshot(f);
      R.eq("wallet", s.cr.total, w); R.eq("awaiting", s.awaiting, off); R.eq("sum", r2(s.cr.total + s.awaiting), amt); R.note("entries", s.entries); R.done();
    }
  });
  it("V05 no-refund policy", async () => {
    const R = new Rec("V05", "nothing moves: wallet credit 0, no entries");
    const f = await mk({ wallet: 30, cash: 70, at: "none" });
    const c = await call("POST", `/api/my/bookings/${encodeURIComponent(f.ref)}/cancel`, f.parent.token, { msg: "x", refundBank: BANK });
    R.eq("cancelStatus", c.status, 200);
    const b = await doc(f.ref); R.eq("pendingAmount", b.cancel?.amount ?? 0, 0);
    const a = await approve(f.ref); R.note("approveStatus", a.status);
    const s = await snapshot(f); R.eq("credited", s.cr, { total: 0, rows: 0 }); R.eq("balance", s.wal, 0); R.eq("awaiting", s.awaiting, 0); R.note("entries", s.entries); R.done();
  });
  it("V05b provider cancels with refund none", async () => {
    const R = new Rec("V05b", "provider cancel refund:none -> nothing moves");
    const f = await mk({ wallet: 30, cash: 70 });
    const c = await operatorAction(P, f.ref, { type: "cancel", refund: "none" }); R.note("status", c.status);
    await approve(f.ref);
    const s = await snapshot(f); R.eq("credited", s.cr.total, 0); R.eq("awaiting", s.awaiting, 0); R.eq("balance", s.wal, 0); R.note("entries", s.entries); R.done();
  });
  it("V06 full refund wallet30+cash70", async () => {
    const R = new Rec("V06", "wallet 30, offline 70, walletRefunded 30");
    const f = await mk({ wallet: 30, cash: 70 });
    await cancelFull(f.ref); await approve(f.ref);
    const s = await snapshot(f); R.eq("credited", s.cr, { total: 30, rows: 1 }); R.eq("awaiting", s.awaiting, 70); R.eq("wr", s.wr, 30); R.note("entries", s.entries); R.done();
  });
  it("V07 provider cancel-day refund 20", async () => {
    const R = new Rec("V07", "wallet 6, offline 14");
    const f = await mk({ wallet: 30, cash: 70 });
    const c = await operatorAction(P, f.ref, { type: "cancel-day", ki: 0, date: L.far.dates[0], resolution: "refund" }); R.eq("status", c.status, 200);
    R.eq("pending", (await doc(f.ref)).cancel?.amount, 20);
    await approve(f.ref);
    const s = await snapshot(f); R.eq("wallet", s.cr.total, 6); R.eq("awaiting", s.awaiting, 14); R.note("entries", s.entries); R.done();
  });
  it("V08 cancel-child refund", async () => {
    const R = new Rec("V08", "pending 100: wallet 30 offline 70");
    const f = await mk({ wallet: 30, cash: 70 });
    const c = await operatorAction(P, f.ref, { type: "cancel-child", ki: 0, resolution: "refund" }); R.eq("status", c.status, 200);
    const pend = (await doc(f.ref)).cancel?.amount; R.eq("pending", pend, 100);
    await approve(f.ref);
    const s = await snapshot(f); R.eq("wallet", s.cr.total, 30); R.eq("awaiting", s.awaiting, 70); R.done();
  });
  it("V09/V22 parent release 2 days refund: preview == real", async () => {
    const R = new Rec("V09", "preview toWallet 12 toOriginal 28 refund 40; real credit 12; awaiting 28");
    const f = await mk({ wallet: 30, cash: 70 });
    const days = L.far.dates.slice(0, 2);
    const pv = await call("POST", `/api/my/bookings/${encodeURIComponent(f.ref)}/release-preview`, f.parent.token, { days, resolution: "refund" });
    R.eq("pvStatus", pv.status, 200); R.note("pvRefund", pv.json.refund); R.eq("pv", [pv.json.toWallet, pv.json.toOriginal], [r2(pv.json.refund*0.3), r2(pv.json.refund*0.7)]);
    const rel = await call("POST", `/api/my/bookings/${encodeURIComponent(f.ref)}/cancel`, f.parent.token, { days, resolution: "refund", msg: "x", refundBank: BANK }); R.eq("relStatus", rel.status, 200);
    await approve(f.ref);
    const s = await snapshot(f); R.eq("wallet", s.cr.total, pv.json.toWallet); R.eq("awaiting", s.awaiting, pv.json.toOriginal); R.done();
  });
  it("V22 odd-penny preview == real (wallet 33.33, release 1 day)", async () => {
    const R = new Rec("V22", "refund 20: wallet 6.67, original 13.33");
    const f = await mk({ wallet: 33.33, cash: 66.67 });
    const days = L.far.dates.slice(0, 1);
    const pv = await call("POST", `/api/my/bookings/${encodeURIComponent(f.ref)}/release-preview`, f.parent.token, { days, resolution: "refund" });
    R.note("pvRefund", pv.json.refund); R.eq("pv", [pv.json.toWallet, pv.json.toOriginal], [r2(pv.json.refund*0.3333), r2(pv.json.refund-r2(pv.json.refund*0.3333))]);
    await call("POST", `/api/my/bookings/${encodeURIComponent(f.ref)}/cancel`, f.parent.token, { days, resolution: "refund", msg: "x", refundBank: BANK });
    await approve(f.ref);
    const s = await snapshot(f); R.eq("wallet", s.cr.total, pv.json.toWallet); R.eq("awaiting", s.awaiting, pv.json.toOriginal); R.done();
  });
  it("V09w parent release as wallet: whole value wallet, instant, preview says so", async () => {
    const R = new Rec("V09w", "release 2 days as wallet: wallet +40 once, nothing awaiting, no provider entries");
    const f = await mk({ wallet: 30, cash: 70 });
    const days = L.far.dates.slice(0, 2);
    const pv = await call("POST", `/api/my/bookings/${encodeURIComponent(f.ref)}/release-preview`, f.parent.token, { days, resolution: "wallet" });
    R.eq("pv", [pv.json.credit, pv.json.toWallet, pv.json.toOriginal], [40, 40, 0]);
    await call("POST", `/api/my/bookings/${encodeURIComponent(f.ref)}/cancel`, f.parent.token, { days, resolution: "wallet", msg: "x" });
    const s = await snapshot(f); R.eq("credited", s.cr, { total: 40, rows: 1 }); R.eq("awaiting", s.awaiting, 0); R.eq("balance", s.wal, 40); R.note("wr", s.wr); R.done();
  });
  it("V10 half policy parent cancel then approve", async () => {
    const R = new Rec("V10", "pending 50 -> wallet 15 offline 35");
    const f = await mk({ wallet: 30, cash: 70, at: "half" });
    const c = await call("POST", `/api/my/bookings/${encodeURIComponent(f.ref)}/cancel`, f.parent.token, { msg: "x", refundBank: BANK }); R.eq("cancel", c.status, 200);
    R.eq("pending", (await doc(f.ref)).cancel?.amount, 50);
    await approve(f.ref);
    const s = await snapshot(f); R.eq("wallet", s.cr.total, 15); R.eq("awaiting", s.awaiting, 35); R.done();
  });
  it("V11 provider whole cancel full", async () => {
    const R = new Rec("V11", "30 / 70");
    const f = await mk({ wallet: 30, cash: 70 });
    await operatorAction(P, f.ref, { type: "cancel", refund: "full" }); await approve(f.ref);
    const s = await snapshot(f); R.eq("wallet", s.cr.total, 30); R.eq("awaiting", s.awaiting, 70); R.done();
  });
  it("V13 15 parallel approvals", async () => {
    const R = new Rec("V13", "wallet 15 once, balance 15, one wallet entry, walletRefunded 15");
    const f = await mk({ wallet: 30, cash: 70 });
    await cancelPartial(f.ref, 50);
    const rs = await Promise.all(Array.from({ length: 15 }, () => approve(f.ref)));
    R.note("statuses", rs.map((r) => r.status).join(","));
    await sleep(800);
    const s = await snapshot(f);
    R.eq("credited", s.cr, { total: 15, rows: 1 }); R.eq("balance", s.wal, 15); R.eq("wr", s.wr, 15); R.eq("awaiting", s.awaiting, 35); R.eq("ra", s.ra, 50);
    R.eq("walletEntries", s.entries.filter((e) => e.startsWith("wallet")).length, 1);
    const pays = (await db.collection("payments").where("tenantId", "==", P.tenantId).where("refs", "array-contains", f.ref).get()).docs.map((d) => d.data()).filter((x) => x.method === "wallet");
    R.eq("walletPaymentsRows", pays.length, 1); R.done();
  });
  it("V13b sequential duplicate approval (second after first done)", async () => {
    const R = new Rec("V13b", "second approve: no second credit");
    const f = await mk({ wallet: 30, cash: 70 });
    await cancelPartial(f.ref, 50); await approve(f.ref); const a2 = await approve(f.ref); R.note("second", a2.status);
    const s = await snapshot(f); R.eq("credited", s.cr, { total: 15, rows: 1 }); R.eq("balance", s.wal, 15); R.done();
  });
  it("V14 release THEN provider cancel-day (known open bug) - RECORD", async () => {
    const R = new Rec("V14", "RECORD: release 2d refund(40) approve; then cancel-day 1 day 20 refund; approve. owner expectation total refund 60");
    const f = await mk({ wallet: 30, cash: 70 });
    const days = L.far.dates.slice(0, 2);
    await call("POST", `/api/my/bookings/${encodeURIComponent(f.ref)}/cancel`, f.parent.token, { days, resolution: "refund", msg: "x", refundBank: BANK });
    await approve(f.ref);
    R.note("afterRelease", await snapshot(f));
    const c = await operatorAction(P, f.ref, { type: "cancel-day", ki: 0, date: L.far.dates[2], resolution: "refund" }); R.note("cdStatus", c.status);
    R.note("pendingAfterCancelDay", (await doc(f.ref)).cancel?.amount);
    const a = await approve(f.ref); R.note("approve", a.status);
    R.note("final", await snapshot(f)); R.done(true);
  });
  it("V15 wallet-only booking", async () => {
    const R = new Rec("V15", "wallet 60 back, nothing awaiting, no offline entry");
    const f = await mk({ wallet: 1000 });
    await cancelPartial(f.ref, 60); await approve(f.ref);
    const s = await snapshot(f); R.eq("credited", s.cr, { total: 60, rows: 1 }); R.eq("awaiting", s.awaiting, 0); R.eq("nonWalletEntries", s.entries.filter((e) => !e.startsWith("wallet")), []); R.done();
  });
  it("V15b wallet-only full refund", async () => {
    const R = new Rec("V15b", "wallet 100 back");
    const f = await mk({ wallet: 1000 });
    await cancelFull(f.ref); await approve(f.ref);
    const s = await snapshot(f); R.eq("credited", s.cr, { total: 100, rows: 1 }); R.eq("balance", s.wal, 1000); R.done();
  });
  it("V16 part-paid wallet30 + cash20 (50 unpaid)", async () => {
    let R = new Rec("V16a", "partial 25 -> wallet 15 offline 10");
    let f = await mk({ wallet: 30, cash: 20 });
    const c = await cancelPartial(f.ref, 25); R.note("c", c.status); await approve(f.ref);
    let s = await snapshot(f); R.eq("wallet", s.cr.total, 15); R.eq("awaiting", s.awaiting, 10); R.note("entries", s.entries); R.done();
    R = new Rec("V16b", "full cancel -> wallet 30 offline 20");
    f = await mk({ wallet: 30, cash: 20 });
    await cancelFull(f.ref); await approve(f.ref);
    s = await snapshot(f); R.eq("wallet", s.cr.total, 30); R.eq("awaiting", s.awaiting, 20); R.note("entries", s.entries); R.done();
  });
  it("V16c refund request larger than paid is capped at paid", async () => {
    const R = new Rec("V16c", "wallet30+cash20 paid=50; amount 90 -> capped 50: wallet 30, offline 20");
    const f = await mk({ wallet: 30, cash: 20 });
    const c = await cancelPartial(f.ref, 90); R.note("c", c.status);
    await approve(f.ref);
    const s = await snapshot(f); R.eq("wallet", s.cr.total, 30); R.eq("awaiting", s.awaiting, 20); R.eq("ra", s.ra, 50); R.done();
  });
  it("V23 family release as WALLET, then provider full cancel", async () => {
    const R = new Rec("V23", "release 2d as wallet (+pv credit); then full cancel refund of the rest: wallet share = walletLeft(30 - credit*0.3) , rest offline; totals: refunded 100 exactly, offline never > 70");
    const f = await mk({ wallet: 30, cash: 70 });
    const days = L.far.dates.slice(0, 2);
    const pv = await call("POST", `/api/my/bookings/${encodeURIComponent(f.ref)}/release-preview`, f.parent.token, { days, resolution: "wallet" });
    const cr = pv.json.credit as number; R.note("credit", cr);
    await call("POST", `/api/my/bookings/${encodeURIComponent(f.ref)}/cancel`, f.parent.token, { days, resolution: "wallet", msg: "x" });
    let s = await snapshot(f); R.eq("firstWallet", s.cr.total, cr); R.note("wr1", s.wr); R.eq("wr1", s.wr, r2(cr * 0.3));
    await cancelFull(f.ref); await approve(f.ref);
    s = await snapshot(f);
    const pool = 100 - cr, wl = r2(30 - cr * 0.3);
    R.eq("secondWallet", r2(s.cr.total - cr), wl); R.eq("awaiting", s.awaiting, r2(pool - wl)); R.eq("offlineLe70", s.awaiting <= 70, true); R.note("entries", s.entries); R.done();
  });
  it("V23c cancelled-by-family wallet resolution on a whole cancel (refundTo wallet): all wallet", async () => {
    const R = new Rec("V23c", "partial 50 resolved wallet: wallet +50, no offline");
    const f = await mk({ wallet: 30, cash: 70 });
    await cancelPartial(f.ref, 50);
    await db.collection("bookings").doc(`${P.tenantId}_${f.ref}`).set({ cancel: { refundTo: "wallet" } }, { merge: true });
    await approve(f.ref);
    const s = await snapshot(f); R.eq("wallet", s.cr, { total: 50, rows: 1 }); R.eq("awaiting", s.awaiting, 0); R.done();
  });
  it("V24 wallet 30, rest UNPAID (nothing paid in cash), provider full cancel", async () => {
    const R = new Rec("V24", "only 30 was ever paid, all of it wallet: refund 30 -> wallet 30, awaiting 0");
    const f = await mk({ wallet: 30 });
    const b0 = await doc(f.ref); R.note("before", { pay: b0.pay, amount: b0.amount, amountPaid: b0.amountPaid, wa: b0.walletApplied });
    const c = await cancelFull(f.ref); R.note("cancel", c.status); R.note("pending", (await doc(f.ref)).cancel?.amount);
    const a = await approve(f.ref); R.note("approve", a.status);
    const s = await snapshot(f); R.eq("wallet", s.cr.total, 30); R.eq("awaiting", s.awaiting, 0); R.note("entries", s.entries); R.done();
  });
  it("V24b wallet 30 + cash 20 pay status before cancel", async () => {
    const R = new Rec("V24b", "diagnostic: pay status of part-paid booking before / after cancel");
    const f = await mk({ wallet: 30, cash: 20 });
    const b0 = await doc(f.ref); R.note("before", { pay: b0.pay, amount: b0.amount, amountPaid: b0.amountPaid, wa: b0.walletApplied });
    await cancelFull(f.ref); const b1 = await doc(f.ref); R.note("afterCancel", { pay: b1.pay, pending: b1.cancel?.amount });
    R.done(true);
  });
});

describe("V: card", () => {
  const need = (t: any) => { if (!stripe) { t.skip("no stripe"); return true; } return false; };
  it("V02 wallet30+card70 partial 50", async (t) => {
    if (need(t)) return; const R = new Rec("V02", "wallet 15, Stripe 35, awaiting 0");
    const f = await mk({ wallet: 30, card: true });
    await cancelPartial(f.ref, 50); await approve(f.ref);
    const s = await snapshot(f); R.eq("wallet", s.cr, { total: 15, rows: 1 }); R.eq("stripe", await stripeTotal(f.pi!), 35); R.eq("awaiting", s.awaiting, 0); R.note("entries", s.entries); R.done();
  });
  it("V06b full refund wallet30+card70", async (t) => {
    if (need(t)) return; const R = new Rec("V06b", "wallet 30, Stripe 70");
    const f = await mk({ wallet: 30, card: true });
    await cancelFull(f.ref); await approve(f.ref);
    const s = await snapshot(f); R.eq("wallet", s.cr.total, 30); R.eq("stripe", await stripeTotal(f.pi!), 70); R.eq("awaiting", s.awaiting, 0); R.done();
  });
  it("V03 wallet30 + cash30 + card40, refund 50", async (t) => {
    if (need(t)) return; const R = new Rec("V03", "wallet 15, card 20, offline 15");
    const f = await mk({ wallet: 30, cash: 30, card: true });
    const b0 = await doc(f.ref); R.note("paid", { amount: b0.amount, walletApplied: b0.walletApplied, pay: b0.pay });
    await cancelPartial(f.ref, 50); await approve(f.ref);
    const s = await snapshot(f); R.eq("wallet", s.cr.total, 15); R.eq("stripe", await stripeTotal(f.pi!), 20); R.eq("awaiting", s.awaiting, 15); R.note("entries", s.entries); R.done();
  });
  it("V03b same, full cancel: every source exactly", async (t) => {
    if (need(t)) return; const R = new Rec("V03b", "wallet 30, card 40, offline 30");
    const f = await mk({ wallet: 30, cash: 30, card: true });
    await cancelFull(f.ref); await approve(f.ref);
    const s = await snapshot(f); R.eq("wallet", s.cr.total, 30); R.eq("stripe", await stripeTotal(f.pi!), 40); R.eq("awaiting", s.awaiting, 30); R.done();
  });
  it("V17 refund bigger than card holds (Stripe dashboard 40 first, then provider full cancel)", async (t) => {
    if (need(t)) return; const R = new Rec("V17", "pool 60: wallet 30, card 30; Stripe total 70 never more; no error");
    const f = await mk({ wallet: 30, card: true });
    const re = await stripe.refunds.create({ payment_intent: f.pi, amount: 4000 });
    await deliver(`evt_vr_${uniq()}${uniq()}`, "refund.created", re);
    const until = Date.now() + 10000; while (Date.now() < until && !((await doc(f.ref)).refundLog ?? []).some((l: any) => l.label === "Refunded in Stripe")) await sleep(200);
    R.note("afterDashboard", await snapshot(f));
    const c = await cancelFull(f.ref); R.note("cancel", c.status);
    R.note("pending", (await doc(f.ref)).cancel?.amount);
    const a = await approve(f.ref); R.eq("approve", a.status, 200);
    const s = await snapshot(f); R.eq("wallet", s.cr.total, 30); R.eq("stripe", await stripeTotal(f.pi!), 70); R.eq("awaiting", s.awaiting, 0); R.note("entries", s.entries); R.done();
  });
  it("V19 Stripe dashboard refund BEFORE, then partial 45", async (t) => {
    if (need(t)) return; const R = new Rec("V19", "dashboard 10 first (pool 90): partial 45 -> wallet 15, card 30; Stripe total 40");
    const f = await mk({ wallet: 30, card: true });
    const re = await stripe.refunds.create({ payment_intent: f.pi, amount: 1000 });
    await deliver(`evt_vr_${uniq()}${uniq()}`, "refund.created", re);
    const until = Date.now() + 10000; while (Date.now() < until && !((await doc(f.ref)).refundLog ?? []).some((l: any) => l.label === "Refunded in Stripe")) await sleep(200);
    const c = await cancelPartial(f.ref, 45); R.note("cancel", c.status);
    await approve(f.ref);
    const s = await snapshot(f); R.eq("wallet", s.cr.total, 15); R.eq("stripe", await stripeTotal(f.pi!), 40); R.note("entries", s.entries); R.done();
  });
  it("V18 Stripe dashboard refund AFTER approval leaves wallet alone", async (t) => {
    if (need(t)) return; const R = new Rec("V18", "after approval (15 wallet, 35 card) dashboard refund 10 -> wallet balance still 15, credited rows 1, walletRefunded 15");
    const f = await mk({ wallet: 30, card: true });
    await cancelPartial(f.ref, 50); await approve(f.ref);
    const before = await snapshot(f);
    const re = await stripe.refunds.create({ payment_intent: f.pi, amount: 1000 });
    await deliver(`evt_vr_${uniq()}${uniq()}`, "refund.created", re);
    const until = Date.now() + 10000; while (Date.now() < until && !((await doc(f.ref)).refundLog ?? []).some((l: any) => l.label === "Refunded in Stripe")) await sleep(200);
    await sleep(500);
    const s = await snapshot(f);
    R.eq("balance", s.wal, before.wal); R.eq("credited", s.cr, { total: 15, rows: 1 }); R.eq("wr", s.wr, 15); R.note("entriesAfter", s.entries); R.done();
  });
  it("V18b dashboard refund on wallet+card with NO app refund leaves wallet alone", async (t) => {
    if (need(t)) return; const R = new Rec("V18b", "wallet balance 0 (all spent), credited 0, walletRefunded 0");
    const f = await mk({ wallet: 30, card: true });
    const re = await stripe.refunds.create({ payment_intent: f.pi, amount: 2500 });
    await deliver(`evt_vr_${uniq()}${uniq()}`, "refund.created", re);
    const until = Date.now() + 10000; while (Date.now() < until && !((await doc(f.ref)).refundLog ?? []).some((l: any) => l.label === "Refunded in Stripe")) await sleep(200);
    const s = await snapshot(f); R.eq("balance", s.wal, 0); R.eq("credited", s.cr.total, 0); R.eq("wr", s.wr, 0); R.done();
  });
  it("V02c card booking: 15 parallel approvals => Stripe refunded once, wallet once", async (t) => {
    if (need(t)) return; const R = new Rec("V02c", "Stripe 35 once, wallet 15 once");
    const f = await mk({ wallet: 30, card: true });
    await cancelPartial(f.ref, 50);
    const rs = await Promise.all(Array.from({ length: 15 }, () => approve(f.ref))); R.note("st", rs.map((r) => r.status).join(","));
    await sleep(1200);
    const s = await snapshot(f); R.eq("stripe", await stripeTotal(f.pi!), 35); R.eq("wallet", s.cr, { total: 15, rows: 1 }); R.done();
  });
});

describe("V: several references / hold", () => {
  it("V21 basket of two references with wallet 50", async () => {
    const R = new Rec("V21", "wallet spread over refs; refunding each in full returns wallet total 50 exactly once each, offline = rest");
    const parent = await makeParent("VR", P); await setWallet(parent.email, 50);
    const l = L.far;
    const r = await call("POST", "/api/my/bookings", parent.token, { listingId: l.id, blockId: l.blockId, walletCap: 1e6, method: "Bank transfer", items: [
      { pass: "Week pass", child: `KidA${uniq()}`, age: 8, dates: l.dates }, { pass: "Week pass", child: `KidB${uniq()}`, age: 9, dates: l.dates }] });
    R.eq("book", r.status < 300, true);
    const list: any[] = Array.isArray(r.json) ? r.json : (r.json?.bookings ?? [r.json]);
    const refs = list.map((x) => x.ref ?? x.booking?.ref).filter(Boolean) as string[]; R.note("refs", refs);
    const docs = await Promise.all(refs.map(doc)); R.note("walletApplied", docs.map((d) => [d.amount, d.walletApplied]));
    const wsum = r2(docs.reduce((n, d) => n + (d.walletApplied ?? 0), 0)); R.eq("walletSpentTotal", wsum, 50);
    for (const d of docs) { const amt = d.amount ?? 0; if (amt > 0) await call("POST", `/api/bookings/${encodeURIComponent(d.ref)}/record-payment`, P.token, { amount: amt, method: "Bank transfer" }); }
    let w = 0, aw = 0;
    for (const d of docs) { await cancelFull(d.ref); await approve(d.ref); w += (await credited(d.ref)).total; const b = await doc(d.ref); aw += unsentRefunds(b as never).reduce((n, x) => n + x.cash, 0); R.note(`ref ${d.ref}`, { wr: b.walletRefunded, cr: (await credited(d.ref)).total }); }
    R.eq("walletBack", r2(w), 50); R.eq("awaiting", r2(aw), 150); R.eq("balance", await walletBal(parent.email), 50); R.done();
  });
  it("V20 card-hold booking with wallet part (patched hold) - RECORD", async () => {
    const R = new Rec("V20", "RECORD: wallet30, cardHold held for 70 (nothing charged). provider cancel full.");
    const f = await mk({ wallet: 30 });
    await db.collection("bookings").doc(`${P.tenantId}_${f.ref}`).set({ cardHold: { state: "held", expiresAt: new Date(Date.now() + 5 * 86400_000).toISOString(), amount: 70 } }, { merge: true });
    const c = await operatorAction(P, f.ref, { type: "cancel", refund: "full" }); R.note("cancel", c.status);
    R.note("pending", (await doc(f.ref)).cancel);
    const a = await approve(f.ref); R.note("approve", [a.status, a.json?.error]);
    R.note("snap", await snapshot(f)); R.done(true);
  });
});
