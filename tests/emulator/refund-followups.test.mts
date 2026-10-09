/**
 * 9 Oct 2026 refund follow-ups on the emulator stack + Stripe TEST:
 *  Q1  Approve on a pending PARTIAL refund whose money was also refunded in the Stripe dashboard answers 409 already_refunded_in_stripe and does nothing;
 *      the same request with confirmAlreadyRefunded:true proceeds. Decline is unaffected.
 *  Q2  a booking part-paid offline + card: the offline share becomes its OWN refund entry (awaiting transfer) and the card share goes through Stripe.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { makeProvider, makeParent, makeListing, book, uniq, call, db, sleep, operatorAction, bookingDoc, patchBooking, type Provider, type Parent, type Listing } from "./helpers.mts";
import { deliver, stripe, payIntent } from "./_stack.mts";
import { unsentRefunds } from "../../features/bookings/helpers";

let P: Provider, A: Parent, L: Listing;
before(async () => {
  P = await makeProvider("RF9"); A = await makeParent("RF9A", P);
  L = await makeListing(P, `RF9 camp ${uniq()}`, false);
});

async function paid() {
  const ref = await book(A, L, { method: "card" });
  const co = await call("POST", "/api/payments/checkout", A.token, { refs: [ref], tenantId: P.tenantId });
  assert.equal(co.status, 201, JSON.stringify(co.json));
  const piId = String(co.json.clientSecret).split("_secret_")[0];
  await payIntent(piId);
  const r = await call("POST", `/api/payments/checkout/${co.json.paymentId}/confirm`, A.token);
  assert.equal(r.json.paid, true, JSON.stringify(r.json));
  return { ref, pi: await stripe.paymentIntents.retrieve(piId) };
}
const evId = () => `evt_rf9_${uniq()}${uniq()}`;
const waitFor = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now() + ms; while (Date.now() < t) { if (await fn()) return true; await sleep(200); } return false; };
const stripeTotal = async (piId: string) => (await stripe.refunds.list({ payment_intent: piId })).data.reduce((s: number, r: any) => s + r.amount, 0) / 100;
const dashRefund = async (pi: any, amount: number) => {
  const re = await stripe.refunds.create({ payment_intent: pi.id, amount: Math.round(amount * 100) });
  await deliver(evId(), "refund.created", re);
};
const stripeLines = (b: any) => (b.refundLog ?? []).filter((x: any) => x.label === "Refunded in Stripe").reduce((s: number, x: any) => s + x.amount, 0);

describe("Q1: Approve on a pending partial refund already refunded in Stripe", () => {
  it("is refused with 409 already_refunded_in_stripe and does nothing; confirmAlreadyRefunded:true proceeds", async () => {
    const { ref, pi } = await paid();
    assert.equal((await operatorAction(P, ref, { type: "cancel", refund: "partial", amount: 8 })).status, 200);
    await dashRefund(pi, 8);
    assert.ok(await waitFor(async () => stripeLines(await bookingDoc(P, ref)) === 8));
    const before = await bookingDoc(P, ref);
    const a1 = await operatorAction(P, ref, { type: "refund-approve" });
    assert.equal(a1.status, 409, JSON.stringify(a1.json));
    assert.equal(a1.json.code, "already_refunded_in_stripe");
    assert.deepEqual([a1.json.stripeRefunded, a1.json.pending, a1.json.paid], [8, 8, 20]);
    assert.match(String(a1.json.error), /already refunded/i);
    const after = await bookingDoc(P, ref);
    assert.equal(after.cancel.refund, before.cancel.refund);
    assert.equal(after.refundedApproved ?? 0, 0);
    assert.equal(await stripeTotal(pi.id), 8, "no second Stripe refund");
    const a2 = await operatorAction(P, ref, { type: "refund-approve", confirmAlreadyRefunded: true });
    assert.equal(a2.status, 200, JSON.stringify(a2.json));
    assert.equal(await stripeTotal(pi.id), 16);
  });

  it("the same warning guards 'Approve and record' (alreadySent)", async () => {
    const { ref, pi } = await paid();
    await operatorAction(P, ref, { type: "cancel", refund: "partial", amount: 5 });
    await dashRefund(pi, 5);
    assert.ok(await waitFor(async () => stripeLines(await bookingDoc(P, ref)) === 5));
    const a = await operatorAction(P, ref, { type: "refund-approve", alreadySent: true });
    assert.equal(a.status, 409);
    assert.equal(a.json.code, "already_refunded_in_stripe");
  });

  it("a smaller, non-overlapping Stripe refund does not trigger it; decline is unaffected", async () => {
    const { ref, pi } = await paid();
    await operatorAction(P, ref, { type: "cancel", refund: "partial", amount: 8 });
    await dashRefund(pi, 3);
    assert.ok(await waitFor(async () => stripeLines(await bookingDoc(P, ref)) === 3));
    const a = await operatorAction(P, ref, { type: "refund-approve" });
    assert.equal(a.status, 200, JSON.stringify(a.json));
    const x = await paid();
    await operatorAction(P, x.ref, { type: "cancel", refund: "partial", amount: 8 });
    await dashRefund(x.pi, 8);
    assert.ok(await waitFor(async () => stripeLines(await bookingDoc(P, x.ref)) === 8));
    const d = await operatorAction(P, x.ref, { type: "refund-decline" });
    assert.equal(d.status, 200, JSON.stringify(d.json));
  });
});

describe("Q2: offline + card part-paid booking, refund split by method", () => {
  // £20 on the card, plus a further £10 paid by hand (cash/bank): the booking is paid £30 and Stripe holds £20 of it.
  async function mixed() {
    const p = await paid();
    await patchBooking(P, p.ref, { amount: 30, amountPaid: 30 });
    return p;
  }
  const entries = (b: any) => (b.refundEntries ?? []).map((e: any) => `${e.via}/${e.status}/${e.amount}`).sort();
  const toReimburse = async (ref: string) => (await db.collection("payments").where("refs", "array-contains", ref).get()).docs.map((d: any) => d.data()).filter((p: any) => p.type === "refund" && p.status === "to-reimburse");

  it("full refund 30 = card 20 (sent) + offline 10 (own entry, awaiting transfer) until marked sent", async () => {
    const { ref, pi } = await mixed();
    await operatorAction(P, ref, { type: "cancel", refund: "full" });
    const a = await operatorAction(P, ref, { type: "refund-approve" });
    assert.equal(a.status, 200, JSON.stringify(a.json));
    assert.equal(await stripeTotal(pi.id), 20);
    const b = await bookingDoc(P, ref);
    assert.deepEqual(entries(b), ["card/sent/20", "offline/approved/10"]);
    assert.deepEqual(unsentRefunds(b).map((u) => u.cash), [10]);
    assert.deepEqual((await toReimburse(ref)).map((r: any) => r.amount), [10]);
    const s = await operatorAction(P, ref, { type: "refund-sent" });
    assert.equal(s.status, 200, JSON.stringify(s.json));
    assert.deepEqual(unsentRefunds(await bookingDoc(P, ref)), []);
  });

  it("partial refund 15 follows what was paid by each method: card 10 + offline 5", async () => {
    const { ref, pi } = await mixed();
    await operatorAction(P, ref, { type: "cancel", refund: "partial", amount: 15 });
    const a = await operatorAction(P, ref, { type: "refund-approve" });
    assert.equal(a.status, 200, JSON.stringify(a.json));
    assert.equal(await stripeTotal(pi.id), 10);
    assert.deepEqual(entries(await bookingDoc(P, ref)), ["card/sent/10", "offline/approved/5"]);
  });

  it("the verifier repro: Stripe took 8 of the card first, then Approve: the offline 10 is still its own awaiting entry", async () => {
    const { ref, pi } = await mixed();
    await operatorAction(P, ref, { type: "cancel", refund: "full" });
    await dashRefund(pi, 8);
    assert.ok(await waitFor(async () => stripeLines(await bookingDoc(P, ref)) === 8));
    const a = await operatorAction(P, ref, { type: "refund-approve" });
    assert.equal(a.status, 200, JSON.stringify(a.json));
    const b = await bookingDoc(P, ref);
    assert.deepEqual(entries(b), ["card/sent/12", "offline/approved/10"]);
    assert.deepEqual(unsentRefunds(b).map((u) => u.cash), [10]);
  });

  it("'Approve and record' (alreadySent) marks the offline share sent in the same step", async () => {
    const { ref } = await mixed();
    await operatorAction(P, ref, { type: "cancel", refund: "full" });
    const a = await operatorAction(P, ref, { type: "refund-approve", alreadySent: true });
    assert.equal(a.status, 200, JSON.stringify(a.json));
    assert.deepEqual(entries(await bookingDoc(P, ref)), ["card/sent/20", "offline/sent/10"]);
    assert.equal((await toReimburse(ref)).length, 0);
  });
});
