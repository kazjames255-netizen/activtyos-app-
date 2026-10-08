/**
 * Round 3 of the Stripe refund sync: races between the app's own refund-approve and a refund made in the Stripe dashboard,
 * decline after a Stripe refund, a Stripe refund with no room on the booking, and the refund-fetch cache.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { makeProvider, makeParent, makeListing, book, uniq, call, db, sleep, operatorAction, bookingDoc, patchBooking, type Provider, type Parent, type Listing } from "./helpers.mts";
import { deliver, stripe, payIntent } from "./_stack.mts";
import { refundedGross } from "../../features/bookings/helpers";

let P: Provider, A: Parent, L: Listing;
before(async () => {
  P = await makeProvider("RS3"); A = await makeParent("RS3A", P);
  L = await makeListing(P, `RS3 camp ${uniq()}`, false);
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
const evId = () => `evt_rs3_${uniq()}${uniq()}`;
const chargeOf = async (pi: any) => stripe.charges.retrieve(String(pi.latest_charge));
const listBooking = async (ref: string) => ((await call("GET", "/api/bookings", P.token)).json as any[]).find((b) => b.ref === ref);
const waitFor = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now() + ms; while (Date.now() < t) { if (await fn()) return true; await sleep(200); } return false; };
const logOf = (b: any) => (b.refundLog ?? []) as { label: string; amount: number }[];
const sum = (b: any) => Math.round(logOf(b).reduce((s, x) => s + x.amount, 0) * 100) / 100;

describe("R9f: the app's partial refund-approve racing a Stripe-dashboard refund keeps BOTH lines", () => {
  for (const round of [1, 2, 3]) it(`round ${round}: £6 approved in the app + £5 refunded in Stripe meanwhile = £11 on the booking`, async () => {
    const { ref, pi } = await paid();
    assert.equal((await operatorAction(P, ref, { type: "cancel", refund: "partial", amount: 6 })).status, 200);
    const approve = operatorAction(P, ref, { type: "refund-approve" });
    await sleep(150 * round);
    const re = await stripe.refunds.create({ payment_intent: pi.id, amount: 500 });
    await deliver(evId(), "refund.created", re);
    const ap = await approve;
    assert.equal(ap.status, 200, JSON.stringify(ap.json));
    assert.ok(await waitFor(async () => sum(await bookingDoc(P, ref)) === 11), `lines: ${JSON.stringify(logOf(await bookingDoc(P, ref)))}`);
    const b = await listBooking(ref);
    assert.equal(refundedGross(b), 11);
    const stripeTotal = (await stripe.refunds.list({ payment_intent: pi.id })).data.reduce((s: number, r: any) => s + r.amount, 0);
    assert.equal(stripeTotal, 1100);
  });
});

describe("R13b-d: Approve racing a full Stripe refund never leaves the refund 'pending'", () => {
  for (const round of [1, 2, 3]) it(`round ${round}: the end state is resolved (approved, Refunded) and the refunded total is 20`, async () => {
    const { ref, pi } = await paid();
    await operatorAction(P, ref, { type: "cancel", refund: "full" });
    const re = await stripe.refunds.create({ payment_intent: pi.id }); // dashboard refund, event not delivered yet
    const approve = operatorAction(P, ref, { type: "refund-approve" }); // Stripe will refuse it: already refunded
    await sleep(40 * round);
    await deliver(evId(), "charge.refunded", await chargeOf(pi));
    await approve;
    assert.ok(await waitFor(async () => (await bookingDoc(P, ref)).pay === "Refunded"), "pay should be Refunded");
    const b = await bookingDoc(P, ref);
    assert.equal(b.cancel.refund, "approved");
    assert.equal(b.cancel.amount ?? 0, 0);
    assert.equal(refundedGross(await listBooking(ref)), 20);
    assert.equal(re.amount, 2000);
  });
});

describe("R13b-a: decline after a Stripe refund", () => {
  it("is refused (409) and no 'refund update' email goes to the family", async () => {
    const { ref, pi } = await paid();
    await operatorAction(P, ref, { type: "cancel", refund: "full" });
    await stripe.refunds.create({ payment_intent: pi.id });
    await deliver(evId(), "charge.refunded", await chargeOf(pi));
    assert.ok(await waitFor(async () => (await bookingDoc(P, ref)).pay === "Refunded"));
    const mailsBefore = (await db.collection("mailLog").get()).size;
    const d = await operatorAction(P, ref, { type: "refund-decline" });
    assert.equal(d.status, 409, JSON.stringify(d.json));
    await sleep(1200);
    assert.equal((await db.collection("mailLog").get()).size, mailsBefore);
    assert.notEqual((await bookingDoc(P, ref)).cancel.refund, "declined");
  });
});

describe("a Stripe refund where the booking has no refundable room left", () => {
  it("still lands on the payment ledger (Payout transactions) and tells the provider; the booking is not changed", async () => {
    const { ref, pi } = await paid();
    await patchBooking(P, ref, { refundedApproved: 20 }); // everything already given back another way (e.g. wallet credit)
    await stripe.refunds.create({ payment_intent: pi.id });
    await deliver(evId(), "charge.refunded", await chargeOf(pi));
    const rows = async () => (await db.collection("payments").where("paymentIntentId", "==", pi.id).get()).docs.filter((d: any) => d.get("type") === "refund");
    assert.ok(await waitFor(async () => (await rows()).length === 1), "a refund row is written");
    assert.equal((await rows())[0].get("amount"), 20);
    const pay = (await db.collection("payments").where("paymentIntentId", "==", pi.id).get()).docs.find((d: any) => d.get("type") !== "refund");
    assert.equal(pay!.get("refundState"), "full");
    assert.equal(logOf(await bookingDoc(P, ref)).length, 0, "the booking itself is unchanged");
    await sleep(1500);
    const bells = (await db.collection("notifications").where("tenantId", "==", P.tenantId).get()).docs.map((d: any) => d.data()).filter((n: any) => n.audience === "tenant" && String(n.body).includes(ref) && /made in Stripe/i.test(String(n.body)));
    assert.equal(bells.length, 1);
    assert.match(String(bells[0].body), /already (been )?refunded/i);
  });
});

describe("bulk dashboard refunds do not multiply Stripe reads", () => {
  it("many simultaneous fetches of the same refund make one Stripe retrieve", async () => {
    const { pi } = await paid();
    const re = await stripe.refunds.create({ payment_intent: pi.id, amount: 300 });
    const mod = await import("../../server/src/lib/stripeRefundSync");
    const before = mod.refundFetchStats.retrieves;
    await Promise.all(Array.from({ length: 8 }, () => mod.freshRefund(re, null)));
    assert.equal(mod.refundFetchStats.retrieves - before, 1);
  });
});
