/**
 * Round 5 (verifier case Y08): a payment refunded because the booking was no longer payable is announced ONCE, however many times it
 * is delivered (webhook, browser confirm, concurrent, replays): one family email + bell, one provider mail + bell per payment.
 * And the parent's browser confirm answers truthfully (refunded, not paid) instead of {paid:true}.
 * Live Stripe TEST via the platform fallback; the connected-account path is NOT exercised.
 */
import test, { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { makeProvider, makeParent, makeListing, book, uniq, call, db, sleep, operatorAction, type Provider, type Parent, type Listing } from "./helpers.mts";
import { deliver, stripe } from "./_stack.mts";

let P: Provider, A: Parent, L: Listing;
before(async () => {
  P = await makeProvider("R5P"); A = await makeParent("R5A", P);
  L = await makeListing(P, `R5 camp ${uniq()}`, false);
});

/** A succeeded Stripe payment + record for a booking that has already ended (what a race leaves behind). */
async function latePayment(ref: string, pounds: number) {
  const pi = await stripe.paymentIntents.create({
    amount: Math.round(pounds * 100), currency: "gbp", payment_method: "pm_card_visa", confirm: true, automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    metadata: { tenantId: P.tenantId, refs: ref, email: A.email },
  });
  const doc = await db.collection("payments").add({ tenantId: P.tenantId, refs: [ref], email: A.email, amount: pounds, currency: "gbp", paymentIntentId: pi.id, stripeAccount: null, platformFallback: true, status: "created", createdAt: new Date().toISOString() });
  return { pi, payId: doc.id, money: `£${pounds.toFixed(2)}` };
}
async function endedBooking() {
  const ref = await book(A, L, { method: "card" });
  assert.equal((await operatorAction(P, ref, { type: "cancel", refund: "none" })).status, 200);
  return ref;
}
/** Everything the family and the provider were sent about one payment amount. */
async function counts(money: string) {
  await sleep(3000);
  const notes = (await db.collection("notifications").where("tenantId", "==", P.tenantId).get()).docs.map((d: any) => d.data());
  const mine = notes.filter((n: any) => String(n.body).includes(money));
  const family = mine.filter((n: any) => n.audience === "parent" && /refunded/i.test(n.title));
  const provider = mine.filter((n: any) => n.audience === "tenant" && /refunded automatically|needs refunding/i.test(n.title));
  const mails = (await db.collection("mailLog").get()).docs.map((d: any) => d.data());
  const famMail = mails.filter((m: any) => String(m.to).toLowerCase() === A.email.toLowerCase() && /refunded - nothing was taken/i.test(String(m.subject)) && String(m.html ?? m.body ?? m.text ?? "").includes(money));
  const provMail = mails.filter((m: any) => String(m.to).toLowerCase() === P.email.toLowerCase() && /refunded automatically/i.test(String(m.subject)) && String(m.html ?? m.body ?? m.text ?? "").includes(money));
  return { familyBells: family.length, providerBells: provider.length, famMail: famMail.length, provMail: provMail.length };
}
const burst = (late: { pi: any; payId: string }, tag: string) => Promise.all([
  deliver(`evt_${tag}_1`, "payment_intent.succeeded", late.pi), deliver(`evt_${tag}_2`, "payment_intent.succeeded", late.pi),
  call("POST", `/api/payments/checkout/${late.payId}/confirm`, A.token), call("POST", `/api/payments/checkout/${late.payId}/confirm`, A.token),
]);

describe("one refunded payment is announced once", () => {
  it("webhook, confirm, webhook in sequence, then a concurrent burst: 1 family email + bell, 1 provider mail + bell", async () => {
    const ref = await endedBooking();
    const late = await latePayment(ref, 7);
    await deliver(`evt_r5a_${uniq()}`, "payment_intent.succeeded", late.pi);
    await call("POST", `/api/payments/checkout/${late.payId}/confirm`, A.token);
    await deliver(`evt_r5a_${uniq()}`, "payment_intent.succeeded", late.pi);
    await burst(late, `r5a${uniq()}`);
    const c = await counts(late.money);
    assert.deepEqual(c, { familyBells: 1, providerBells: 1, famMail: 1, provMail: 1 }, JSON.stringify(c));
    assert.equal((await stripe.refunds.list({ payment_intent: late.pi.id })).data.length, 1);
  });

  it("concurrent deliveries only (the very first ones): still exactly one of each", async () => {
    const ref = await endedBooking();
    const late = await latePayment(ref, 8);
    await burst(late, `r5b${uniq()}`);
    await burst(late, `r5c${uniq()}`);
    const c = await counts(late.money);
    assert.deepEqual(c, { familyBells: 1, providerBells: 1, famMail: 1, provMail: 1 }, JSON.stringify(c));
  });

  it("two payments for the same ended booking, many deliveries each: one of each PER payment", async () => {
    const ref = await endedBooking();
    const one = await latePayment(ref, 9);
    const two = await latePayment(ref, 11);
    for (let i = 0; i < 3; i++) await Promise.all([burst(one, `r5d${i}${uniq()}`), burst(two, `r5e${i}${uniq()}`)]);
    for (const l of [one, two]) {
      const c = await counts(l.money);
      assert.deepEqual(c, { familyBells: 1, providerBells: 1, famMail: 1, provMail: 1 }, `${l.money} ${JSON.stringify(c)}`);
      assert.equal((await stripe.refunds.list({ payment_intent: l.pi.id })).data.length, 1);
    }
  });
});

describe("the browser confirm answers truthfully", () => {
  it("a refunded not-payable payment is NOT paid:true; it says refunded", async () => {
    const ref = await endedBooking();
    const late = await latePayment(ref, 12);
    const first = await call("POST", `/api/payments/checkout/${late.payId}/confirm`, A.token);
    const again = await call("POST", `/api/payments/checkout/${late.payId}/confirm`, A.token);
    for (const r of [first, again]) {
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.equal(r.json.paid, false, JSON.stringify(r.json));
      assert.equal(r.json.refunded, true, JSON.stringify(r.json));
    }
  });

  it("a normal payment still answers paid:true and no refunded flag", async () => {
    const ref = await book(A, L, { method: "card" });
    const co = await call("POST", "/api/payments/checkout", A.token, { refs: [ref], tenantId: P.tenantId });
    assert.equal(co.status, 201, JSON.stringify(co.json));
    const { payIntent } = await import("./_stack.mts");
    await payIntent(String(co.json.clientSecret).split("_secret_")[0]);
    const r = await call("POST", `/api/payments/checkout/${co.json.paymentId}/confirm`, A.token);
    assert.equal(r.json.paid, true); assert.ok(!r.json.refunded);
  });
});
