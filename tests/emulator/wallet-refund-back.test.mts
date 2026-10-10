// Refunds on a booking paid partly with WALLET credit (9 Oct 2026 owner decision). Real API + Firestore emulator (+ Stripe TEST for the card cases).
//
// THE RULE: the policy (or the provider's own figure) decides the TOTAL refund; the wallet part of it goes BACK TO THE WALLET, PROPORTIONAL to what each
// source paid (gross 100 = wallet 30 + cash 70, refund 50 -> 15 to the wallet + 35 to the original method / awaiting-transfer entry), exactly once.
// A refund the family RESOLVED as wallet credit stays wallet credit for the whole refund. Synthetic data, emulator only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { call, db, makeParent, makeProvider, ok, operatorAction, bookingDoc, sleep, uniq, type Parent, type Provider } from "./helpers.mts";
import { refundTransferAmount, unsentRefunds } from "../../features/bookings/helpers";

const r2 = (n: number) => Math.round(n * 100) / 100;
const PAR = 15;
const BANK = { accountName: "Test Parent", sortCode: "112233", accountNumber: "12345678" };
let P: Provider;
const L: Record<"far" | "half" | "none", { id: string; blockId: string; dates: string[] }> = {} as never;
let seq = 0;

async function listing(title: string, policyId?: string) {
  const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7) + 21);
  const end = new Date(start); end.setDate(end.getDate() + 27);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const period = await ok("POST", "/api/periods", P.token, { title: "Full day", start: "09:00", finish: "15:30" });
  const pass = await ok("POST", "/api/passes", P.token, { name: "Week pass", days: 5 });
  const bundle = await ok("POST", "/api/block-bundles", P.token, { name: `WR block ${title}`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 100, calcOn: true });
  const lst = await ok("POST", "/api/listings", P.token, {
    title, venueId: "emu-venue", runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5],
    maxAttendees: "5000", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id,
    passes: [{ name: "Week pass", price: 100, days: 5 }], bookingType: "auto", status: "live", visibility: "public",
    ...(policyId ? { cancellationPolicyId: policyId } : {}),
  });
  await ok("PUT", `/api/block-bundles/${bundle.id}/listings`, P.token, { listingIds: [lst.id] });
  const blocks = await db.collection("blocks").where("listingId", "==", lst.id).get();
  assert.ok(!blocks.empty);
  const dates = (blocks.docs[0].data().sessions as { date: string }[]).map((s) => s.date).sort().slice(0, 5);
  assert.equal(dates.length, 5);
  return { id: lst.id as string, blockId: blocks.docs[0].id, dates };
}

before(async () => {
  P = await makeProvider("WR");
  const lib = (await ok("GET", "/api/library", P.token)) ?? {};
  const venues: any[] = lib.venues ?? [];
  if (!venues.some((v) => v.id === "emu-venue")) venues.push({ id: "emu-venue", name: "Test Sports Hall", address: "1 Test Way", city: "Testville" });
  await ok("PUT", "/api/library", P.token, {
    venues, addons: lib.addons ?? [],
    settings: { ...(lib.settings ?? {}), marketplaceListed: true, allowPartialCancel: true, partialAllowWallet: true, partialAllowRefund: true, allowCardRefund: true,
      cancellationPolicies: [{ id: "half", name: "Half back", bands: [{ hoursBefore: 0, refundPercent: 50 }] }, { id: "none", name: "No refunds", bands: [{ hoursBefore: 0, refundPercent: 0 }] }] },
  });
  L.far = await listing(`WR far ${uniq()}`);
  L.half = await listing(`WR half ${uniq()}`, "half");
  L.none = await listing(`WR none ${uniq()}`, "none");
});

const walletId = (email: string) => `${P.tenantId}__${email.trim().toLowerCase()}`;
const setWallet = (email: string, balance: number) => db.collection("wallet").doc(walletId(email)).set({ tenantId: P.tenantId, email: email.toLowerCase(), balance, updatedAt: new Date().toISOString() });
const walletBal = async (email: string) => r2(Number((await db.collection("wallet").doc(walletId(email)).get()).get("balance") ?? 0));
/** Everything credited back to the wallet for this booking (ledger rows with a positive delta). */
async function credited(ref: string): Promise<{ total: number; rows: number }> {
  const s = await db.collection("walletEntries").where("tenantId", "==", P.tenantId).where("ref", "==", ref).get();
  const pos = s.docs.filter((d) => Number(d.get("delta")) > 0);
  return { total: r2(pos.reduce((n, d) => n + Number(d.get("delta")), 0)), rows: pos.length };
}
const doc = (ref: string) => bookingDoc(P, ref);

interface Fam { parent: Parent; ref: string; kind: string }
/** A fresh family with `wallet` credit, who books the 5-day pass (100). pay "cash": the provider records the cash part. "card": the family pays it by Stripe. */
async function mk(o: { wallet: number; pay?: "cash" | "card" | "none"; at?: keyof typeof L }): Promise<Fam> {
  const l = L[o.at ?? "far"];
  const parent = await makeParent("WR", P);
  if (o.wallet > 0) await setWallet(parent.email, o.wallet);
  const r = await call("POST", "/api/my/bookings", parent.token, { listingId: l.id, blockId: l.blockId, method: o.pay === "card" ? "card" : "Bank transfer", items: [{ pass: "Week pass", child: `Kid ${++seq}${uniq()}`, age: 8, dates: l.dates }] });
  assert.ok(r.status < 300, `book -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  const list = Array.isArray(r.json) ? r.json : (r.json?.bookings ?? [r.json]);
  const ref = (list[0]?.ref ?? list[0]?.booking?.ref) as string;
  assert.ok(ref);
  const b = await doc(ref);
  assert.equal(r2((b.amount ?? 0) + (b.walletApplied ?? 0)), 100, "gross is 100");
  assert.equal(r2(b.walletApplied ?? 0), Math.min(100, o.wallet), "the wallet part was applied");
  if (o.pay === "cash" && (b.amount ?? 0) > 0) {
    const pay = await call("POST", `/api/bookings/${encodeURIComponent(ref)}/record-payment`, P.token, { amount: b.amount, method: "Bank transfer" });
    assert.ok(pay.status < 300, `pay -> ${pay.status} ${JSON.stringify(pay.json).slice(0, 300)}`);
  }
  return { parent, ref, kind: o.pay ?? "none" };
}
const approve = (ref: string, extra: Record<string, unknown> = {}) => operatorAction(P, ref, { type: "refund-approve", ...extra });
const cancelPartial = (ref: string, amount: number) => operatorAction(P, ref, { type: "cancel", refund: "partial", amount });
const entriesOf = (b: Record<string, any>) => (b.refundEntries ?? []) as { amount: number; cash: number; via: string; status: string }[];

describe("provider cancel + approve: the wallet part goes back to the wallet, the rest to the original method", () => {
  it("gross 100 = wallet 30 + cash 70, refund 50 -> 15 to the wallet, 35 awaiting transfer", async () => {
    const f = await mk({ wallet: 30, pay: "cash" });
    assert.equal((await cancelPartial(f.ref, 50)).status, 200);
    const a = await approve(f.ref);
    assert.equal(a.status, 200, JSON.stringify(a.json));
    const b = await doc(f.ref);
    assert.deepEqual(await credited(f.ref), { total: 15, rows: 1 });
    assert.equal(await walletBal(f.parent.email), 15);
    assert.equal(b.refundedApproved, 50);
    assert.equal(b.walletRefunded, 15);
    const e = entriesOf(b);
    const w = e.filter((x) => x.via === "wallet"), off = e.filter((x) => x.via === "offline");
    assert.equal(w.length, 1, JSON.stringify(e)); assert.equal(w[0].amount, 15); assert.equal(w[0].status, "sent", "the wallet credit is instant");
    assert.equal(off.length, 1, JSON.stringify(e)); assert.equal(off[0].amount, 35); assert.equal(off[0].cash, 35); assert.equal(off[0].status, "approved");
    assert.equal(r2(e.reduce((n, x) => n + x.amount, 0)), 50, "the entries add up to the refund");
    // Finance / Refunds to send count only the part the provider has to transfer.
    assert.equal(refundTransferAmount(b as never), 35);
    assert.equal(unsentRefunds(b as never).reduce((n, x) => n + x.cash, 0), 35);
    const led = (await db.collection("payments").where("tenantId", "==", P.tenantId).where("refs", "array-contains", f.ref).get()).docs.map((d) => d.data());
    assert.equal(r2(led.filter((x) => x.method === "wallet" && x.type === "refund").reduce((n, x) => n + x.amount, 0)), 15);
    assert.equal(r2(led.filter((x) => x.status === "to-reimburse").reduce((n, x) => n + x.amount, 0)), 35);
  });

  it("a full refund returns the whole wallet part (30) and the whole cash part (70)", async () => {
    const f = await mk({ wallet: 30, pay: "cash" });
    assert.equal((await operatorAction(P, f.ref, { type: "cancel", refund: "full" })).status, 200);
    assert.equal((await approve(f.ref)).status, 200);
    const b = await doc(f.ref);
    assert.equal((await credited(f.ref)).total, 30);
    assert.equal(r2(refundTransferAmount(b as never)), 70);
    assert.equal(b.walletRefunded, 30);
  });

  it("a booking paid ENTIRELY with wallet credit: the whole refund is wallet credit, nothing is left awaiting a transfer", async () => {
    const f = await mk({ wallet: 1000, pay: "none" });
    assert.equal((await cancelPartial(f.ref, 60)).status, 200);
    assert.equal((await approve(f.ref)).status, 200);
    const b = await doc(f.ref);
    assert.deepEqual(await credited(f.ref), { total: 60, rows: 1 });
    assert.equal(entriesOf(b).filter((x) => x.via !== "wallet").length, 0, JSON.stringify(entriesOf(b)));
    assert.equal(unsentRefunds(b as never).length, 0);
    const led = (await db.collection("payments").where("tenantId", "==", P.tenantId).where("refs", "array-contains", f.ref).get()).docs.map((d) => d.data());
    assert.equal(led.filter((x) => x.status === "to-reimburse").length, 0, "no cash refund recorded");
  });

  it("two refunds in a row use what the wallet still holds: a day (20) then the rest (80) = 30 back to the wallet in total, 70 offline", async () => {
    const f = await mk({ wallet: 30, pay: "cash" });
    assert.equal((await operatorAction(P, f.ref, { type: "cancel-day", ki: 0, date: L.far.dates[0], resolution: "refund" })).status, 200);
    assert.equal((await approve(f.ref)).status, 200);
    const w1 = (await credited(f.ref)).total;
    assert.equal(w1, 6, "20 of 100 -> 30% = 6 to the wallet");
    assert.equal((await operatorAction(P, f.ref, { type: "cancel", refund: "full" })).status, 200);
    assert.equal((await approve(f.ref)).status, 200);
    const b = await doc(f.ref);
    assert.equal((await credited(f.ref)).total, 30, "the wallet got its 30 back in total, never more");
    assert.equal(b.walletRefunded, 30);
    assert.equal(r2(entriesOf(b).filter((x) => x.via === "offline").reduce((n, x) => n + x.cash, 0)), 70);
  });

  it("a refund resolved as wallet credit (parent picks the wallet): all of it is wallet credit, no cash entry", async () => {
    const f = await mk({ wallet: 30, pay: "cash" });
    assert.equal((await cancelPartial(f.ref, 50)).status, 200);
    await db.collection("bookings").doc(`${P.tenantId}_${f.ref}`).set({ cancel: { refundTo: "wallet" } }, { merge: true });
    assert.equal((await approve(f.ref)).status, 200);
    const b = await doc(f.ref);
    assert.equal((await credited(f.ref)).total, 50);
    assert.equal(entriesOf(b).filter((x) => x.via === "offline").length, 0);
    assert.equal(unsentRefunds(b as never).length, 0);
  });

  it("15 parallel duplicate approvals credit the wallet exactly once", async () => {
    const f = await mk({ wallet: 30, pay: "cash" });
    assert.equal((await cancelPartial(f.ref, 50)).status, 200);
    const rs = await Promise.all(Array.from({ length: PAR }, () => approve(f.ref)));
    assert.ok(rs.filter((r) => r.status === 200).length >= 1);
    await sleep(500);
    assert.deepEqual(await credited(f.ref), { total: 15, rows: 1 });
    assert.equal(await walletBal(f.parent.email), 15);
    const b = await doc(f.ref);
    assert.equal(b.walletRefunded, 15); assert.equal(b.refundedApproved, 50);
    assert.equal(entriesOf(b).filter((x) => x.via === "wallet").length, 1);
  });
});

describe("the policy decides the total, then the wallet part is split off", () => {
  it("no-refund policy: parent cancels, nothing is refunded - the wallet part is not refunded either (the policy decided 0)", async () => {
    const f = await mk({ wallet: 30, pay: "cash", at: "none" });
    const c = await call("POST", `/api/my/bookings/${encodeURIComponent(f.ref)}/cancel`, f.parent.token, { msg: "no", refundBank: BANK });
    assert.equal(c.status, 200, JSON.stringify(c.json));
    const b = await doc(f.ref);
    assert.equal(b.cancel?.amount ?? 0, 0);
    assert.equal((await credited(f.ref)).total, 0);
  });

  it("50% policy: parent cancels, the provider approves -> 50 total = 15 wallet + 35 awaiting transfer", async () => {
    const f = await mk({ wallet: 30, pay: "cash", at: "half" });
    const c = await call("POST", `/api/my/bookings/${encodeURIComponent(f.ref)}/cancel`, f.parent.token, { msg: "policy", refundBank: BANK });
    assert.equal(c.status, 200, JSON.stringify(c.json));
    const before = await doc(f.ref);
    assert.equal(before.cancel.amount, 50, JSON.stringify(before.cancel));
    assert.equal((await approve(f.ref)).status, 200);
    const b = await doc(f.ref);
    assert.deepEqual(await credited(f.ref), { total: 15, rows: 1 });
    assert.equal(refundTransferAmount(b as never), 35);
    assert.equal(b.pay, "Partially refunded");
  });
});

describe("released days / cancelled children and days / refunded extras follow the same split", () => {
  it("parent releases 2 of 5 days (refund): the preview says 12 -> 'x to the wallet, y to the original method'; approval does exactly that", async () => {
    const f = await mk({ wallet: 30, pay: "cash" });
    const days = L.far.dates.slice(0, 2);
    const pv = await call("POST", `/api/my/bookings/${encodeURIComponent(f.ref)}/release-preview`, f.parent.token, { days, resolution: "refund" });
    assert.equal(pv.status, 200, JSON.stringify(pv.json));
    const rel = await call("POST", `/api/my/bookings/${encodeURIComponent(f.ref)}/cancel`, f.parent.token, { days, resolution: "refund", msg: "wr" });
    assert.equal(rel.status, 200, JSON.stringify(rel.json));
    const pend = (await doc(f.ref)).cancel.amount as number;
    assert.equal(pv.json.refund, pend, "preview refund equals the pending refund");
    assert.equal(r2(pv.json.toWallet + pv.json.toOriginal), pv.json.refund);
    assert.equal(pv.json.toWallet, r2(pend * 0.3), "wallet share is 30%");
    assert.equal((await approve(f.ref)).status, 200);
    const b = await doc(f.ref);
    assert.equal((await credited(f.ref)).total, pv.json.toWallet, "preview == real wallet credit, to the penny");
    assert.equal(r2(refundTransferAmount(b as never)), pv.json.toOriginal, "preview == real transfer amount, to the penny");
  });

  it("release as WALLET credit: the whole value is wallet credit, instant, and the preview says so", async () => {
    const f = await mk({ wallet: 30, pay: "cash" });
    const days = L.far.dates.slice(0, 2);
    const pv = await call("POST", `/api/my/bookings/${encodeURIComponent(f.ref)}/release-preview`, f.parent.token, { days, resolution: "wallet" });
    assert.equal(pv.status, 200);
    const rel = await call("POST", `/api/my/bookings/${encodeURIComponent(f.ref)}/cancel`, f.parent.token, { days, resolution: "wallet", msg: "wr" });
    assert.equal(rel.status, 200, JSON.stringify(rel.json));
    const got = await credited(f.ref);
    assert.equal(got.total, pv.json.credit); assert.equal(got.rows, 1);
    assert.equal(pv.json.toWallet, pv.json.credit); assert.equal(pv.json.toOriginal, 0);
    assert.equal(entriesOf(await doc(f.ref)).length, 0);
  });

  it("provider cancel-day with a refund: approving it splits the pending refund 30/70", async () => {
    const f = await mk({ wallet: 30, pay: "cash" });
    assert.equal((await operatorAction(P, f.ref, { type: "cancel-day", ki: 0, date: L.far.dates[0], resolution: "refund" })).status, 200);
    const b0 = await doc(f.ref);
    const pend = b0.cancel.amount as number;
    assert.ok(pend > 0, JSON.stringify(b0.cancel));
    assert.equal((await approve(f.ref)).status, 200);
    const b = await doc(f.ref);
    const w = (await credited(f.ref)).total;
    assert.equal(w, r2(pend * 0.3));
    assert.equal(r2(refundTransferAmount(b as never) + w), pend);
  });

  it("provider cancel-child with a refund: same split", async () => {
    const f = await mk({ wallet: 30, pay: "cash" });
    assert.equal((await operatorAction(P, f.ref, { type: "cancel-child", ki: 0, resolution: "refund" })).status, 200);
    const pend = (await doc(f.ref)).cancel.amount as number;
    assert.ok(pend > 0);
    assert.equal((await approve(f.ref)).status, 200);
    const b = await doc(f.ref);
    const w = (await credited(f.ref)).total;
    assert.equal(w, r2(pend * 0.3));
    assert.equal(r2(refundTransferAmount(b as never) + w), pend);
  });

  it("an explicit provider amount stays the provider's choice (capped at paid): cancel-day amount 10 -> 3 wallet + 7 offline", async () => {
    const f = await mk({ wallet: 30, pay: "cash" });
    assert.equal((await operatorAction(P, f.ref, { type: "cancel-day", ki: 0, date: L.far.dates[0], resolution: "refund", amount: 10 })).status, 200);
    assert.equal((await doc(f.ref)).cancel.amount, 10);
    assert.equal((await approve(f.ref)).status, 200);
    const b = await doc(f.ref);
    assert.equal((await credited(f.ref)).total, 3);
    assert.equal(refundTransferAmount(b as never), 7);
  });

  it("cancel-day as WALLET credit stays wallet credit for the whole value", async () => {
    const f = await mk({ wallet: 30, pay: "cash" });
    assert.equal((await operatorAction(P, f.ref, { type: "cancel-day", ki: 0, date: L.far.dates[0], resolution: "wallet" })).status, 200);
    const got = await credited(f.ref);
    assert.equal(got.rows, 1); assert.ok(got.total > 0);
    assert.equal(entriesOf(await doc(f.ref)).length, 0);
  });
});

describe("a booking paid by wallet + CARD: Stripe refunds the card part only", () => {
  let stripe: any, payIntent: (id: string) => Promise<unknown>;
  before(async () => {
    try { ({ stripe, payIntent } = await import("./_stack.mts") as any); } catch { /* no Stripe test key: card cases are skipped */ }
  });
  async function card(): Promise<{ f: Fam; pi: any } | null> {
    if (!stripe) return null;
    const f = await mk({ wallet: 30, pay: "card" });
    const co = await call("POST", "/api/payments/checkout", f.parent.token, { refs: [f.ref], tenantId: P.tenantId });
    assert.equal(co.status, 201, JSON.stringify(co.json));
    const piId = String(co.json.clientSecret).split("_secret_")[0];
    await payIntent(piId);
    const r = await call("POST", `/api/payments/checkout/${co.json.paymentId}/confirm`, f.parent.token);
    assert.equal(r.json.paid, true, JSON.stringify(r.json));
    const pi = await stripe.paymentIntents.retrieve(piId);
    assert.equal(pi.amount_received / 100, 70, "the card was charged only the cash part");
    return { f, pi };
  }
  const stripeTotal = async (piId: string) => (await stripe.refunds.list({ payment_intent: piId })).data.reduce((s: number, r: any) => s + r.amount, 0) / 100;

  it("refund 50 -> 35 to the card (Stripe), 15 to the wallet", async (t) => {
    const x = await card(); if (!x) return t.skip("no Stripe test key");
    assert.equal((await cancelPartial(x.f.ref, 50)).status, 200);
    assert.equal((await approve(x.f.ref)).status, 200);
    assert.equal(await stripeTotal(x.pi.id), 35);
    assert.deepEqual(await credited(x.f.ref), { total: 15, rows: 1 });
    const b = await doc(x.f.ref);
    const e = entriesOf(b);
    assert.equal(e.find((y) => y.via === "wallet")?.amount, 15);
    assert.equal(e.find((y) => y.via === "card")?.amount, 35);
    assert.equal(unsentRefunds(b as never).length, 0, "nothing for the provider to transfer");
  });

  it("a full refund: 70 to the card (never more than the card paid), 30 to the wallet", async (t) => {
    const x = await card(); if (!x) return t.skip("no Stripe test key");
    assert.equal((await operatorAction(P, x.f.ref, { type: "cancel", refund: "full" })).status, 200);
    assert.equal((await approve(x.f.ref)).status, 200);
    assert.equal(await stripeTotal(x.pi.id), 70);
    assert.equal((await credited(x.f.ref)).total, 30);
  });

  it("a refund made in the Stripe dashboard does not touch the wallet", async (t) => {
    const x = await card(); if (!x) return t.skip("no Stripe test key");
    const before = await walletBal(x.f.parent.email);
    const { deliver } = await import("./_stack.mts") as any;
    const re = await stripe.refunds.create({ payment_intent: x.pi.id, amount: 1000 });
    await deliver(`evt_wr_${uniq()}${uniq()}`, "refund.created", re);
    const until = Date.now() + 10000; let seen = false;
    while (!seen && Date.now() < until) { seen = ((await doc(x.f.ref)).refundLog ?? []).some((l: any) => l.label === "Refunded in Stripe"); if (!seen) await sleep(200); }
    assert.ok(seen, "the dashboard refund was recorded on the booking");
    assert.equal(await walletBal(x.f.parent.email), before);
    assert.equal((await credited(x.f.ref)).total, 0);
    assert.equal((await doc(x.f.ref)).walletRefunded ?? 0, 0);
  });
});
