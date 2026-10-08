/**
 * Round 4 (verifier case X05): a payment must never be kept for a booking that is no longer payable (Cancelled / Declined / released).
 * Two layers are tested: (1) the cancel paths stop the family's open card payment; (2) if money lands anyway, settlement refunds it in
 * full (once, even if the webhook arrives twice), leaves the booking as it was, and the discount code stays released.
 * Live Stripe TEST via the platform fallback; the connected-account path is NOT exercised.
 */
import test, { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { makeProvider, makeParent, makeListing, makeCode, book, uniq, call, db, bookingDoc, patchBooking, operatorAction, bulk, usedCount, stays, type Provider, type Parent, type Listing } from "./helpers.mts";
import { deliver, intentsFor, payIntent, stripe } from "./_stack.mts";

const since = Math.floor(Date.now() / 1000);
let P: Provider, A: Parent, B: Parent, L: Listing;
before(async () => {
  P = await makeProvider("R4P"); A = await makeParent("R4A", P); B = await makeParent("R4B", P);
  L = await makeListing(P, `R4 camp ${uniq()}`, false);
});

/** A card booking for A holding a discount code (a bystander holds another use), with an OPEN card payment started. */
async function openPayment() {
  const code = await makeCode(P, `R4${uniq().toUpperCase()}`);
  await book(B, L, { code: code.code });
  const ref = await book(A, L, { code: code.code, method: "card" });
  const co = await call("POST", "/api/payments/checkout", A.token, { refs: [ref], tenantId: P.tenantId });
  assert.equal(co.status, 201, JSON.stringify(co.json));
  return { code, ref, paymentId: co.json.paymentId as string, pi: String(co.json.clientSecret).split("_secret_")[0], amount: co.json.amount as number };
}
const net = async (piIds: string[]) => {
  let n = 0;
  for (const id of piIds) {
    const p = await stripe.paymentIntents.retrieve(id);
    const rs = (await stripe.refunds.list({ payment_intent: id, limit: 20 })).data.filter((r: any) => r.status !== "failed" && r.status !== "canceled");
    n += (p.amount_received ?? 0) - rs.reduce((s: number, r: any) => s + r.amount, 0);
  }
  return n;
};
/** The family tries to pay with the intent they already had open, then the browser calls confirm. */
async function lateBrowserPayment(x: { pi: string; paymentId: string }) {
  await payIntent(x.pi).catch(() => null);
  await call("POST", `/api/payments/checkout/${x.paymentId}/confirm`, A.token);
}
/** A succeeded payment + record that already exists when the booking ends (what a race leaves behind). */
async function forcedLatePayment(ref: string, pounds: number) {
  const pi = await stripe.paymentIntents.create({
    amount: Math.round(pounds * 100), currency: "gbp", payment_method: "pm_card_visa", confirm: true, automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    metadata: { tenantId: P.tenantId, refs: ref, email: A.email },
  });
  const doc = await db.collection("payments").add({ tenantId: P.tenantId, refs: [ref], email: A.email, amount: pounds, currency: "gbp", paymentIntentId: pi.id, stripeAccount: null, platformFallback: true, status: "created", createdAt: new Date().toISOString() });
  return { pi, payId: doc.id };
}

const ways: Record<string, (ref: string) => Promise<void>> = {
  "operator cancel (refund none)": async (ref) => { assert.equal((await operatorAction(P, ref, { type: "cancel", refund: "none" })).status, 200); },
  "parent cancel": async (ref) => { const r = await call("POST", `/api/my/bookings/${encodeURIComponent(ref)}/cancel`, A.token, {}); assert.ok(r.status < 300, JSON.stringify(r.json)); },
  "bulk cancel": async (ref) => { assert.equal((await bulk(P, [ref], "cancel")).status, 200); },
  "operator decline recorded on the booking": async (ref) => { await patchBooking(P, ref, { status: "Declined" }); await (await import("../../server/src/lib/discountRedemptions")).releaseDiscountCodes(P.tenantId, ref); }, // as the decline route does
};

for (const [name, endIt] of Object.entries(ways)) {
  describe(`booking ended by: ${name}`, () => {
    it("the family's old Pay does not leave money kept and the booking is not marked Paid", async () => {
      const x = await openPayment();
      await endIt(x.ref);
      await lateBrowserPayment(x);
      assert.equal(await net([x.pi]), 0, "no card money may be kept for an ended booking");
      const b = await bookingDoc(P, x.ref);
      assert.notEqual(b.pay, "Paid"); assert.ok(["Cancelled", "Declined"].includes(b.status), b.status);
      await stays(x.code, 1, "the code stays released (only the bystander's use is left)");
    });

    it("a payment that lands anyway is refunded in full ONCE (webhook twice), the booking is left alone, the family is told", async () => {
      const x = await openPayment();
      await endIt(x.ref);
      const late = await forcedLatePayment(x.ref, x.amount);
      const ev = `evt_r4_${uniq()}`;
      assert.equal((await deliver(ev, "payment_intent.succeeded", late.pi)).status, 200);
      await deliver(ev, "payment_intent.succeeded", late.pi);
      await deliver(`${ev}_b`, "payment_intent.succeeded", late.pi);
      await call("POST", `/api/payments/checkout/${late.payId}/confirm`, A.token);
      const refunds = (await stripe.refunds.list({ payment_intent: late.pi.id })).data;
      assert.equal(refunds.length, 1, `refunds: ${refunds.length}`);
      assert.equal(refunds[0].amount, Math.round(x.amount * 100));
      const b = await bookingDoc(P, x.ref);
      assert.notEqual(b.pay, "Paid"); assert.ok(!b.amountPaid, `amountPaid ${b.amountPaid}`);
      const rec = (await db.collection("payments").doc(late.payId).get()).data()!;
      assert.equal(rec.status, "duplicate-refunded"); assert.equal(rec.excess.reason, "not-payable");
      await stays(x.code, 1, "the code stays released");
      let mails: string[] = [];
      for (let i = 0; i < 20 && !mails.some((m) => /refund|nothing was taken/i.test(m)); i++) {
        mails = (await db.collection("mailLog").where("to", "==", A.email.toLowerCase()).get()).docs.map((d: any) => String(d.get("subject")));
        await new Promise((r) => setTimeout(r, 300));
      }
      assert.ok(mails.some((m) => /refund|nothing was taken/i.test(m)), `family email: ${mails.join(" | ")}`);
    });
  });
}

describe("the normal payment flow is unchanged", () => {
  it("an unpaid card booking pays once and is recorded Paid at its amount", async () => {
    const x = await openPayment();
    assert.equal((await payIntent(x.pi)).status, "succeeded");
    assert.equal((await call("POST", `/api/payments/checkout/${x.paymentId}/confirm`, A.token)).json.paid, true);
    const b = await bookingDoc(P, x.ref);
    assert.equal(b.pay, "Paid"); assert.equal(b.amountPaid, x.amount);
    assert.equal(await net([x.pi]), Math.round(x.amount * 100));
    assert.equal((await intentsFor(x.ref, since)).length, 1);
  });
});
