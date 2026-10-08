/**
 * Round 2 of the double-charge fix (independent verifier's attack cases V02, V06, V03b, V09a). Same stack rules as
 * pay-idempotency.test.mts. Platform TEST account only; connected-account direct charges are NOT exercised.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { booking, call, checkout, deliver, fixture, fs, intentsFor, newBooking, payIntent, stripe, type Fixture } from "./_stack.mts";

const since = Math.floor(Date.now() / 1000);
let f: Fixture;
test.before(async () => { f = await fixture(); });

const secretToPi = (secret: string) => String(secret).split("_secret_")[0];

/** A PaymentIntent (already succeeded on the TEST card) plus the payments record that points at it: what a second checkout used to leave behind. */
async function forceIntent(refs: string[], pounds: number): Promise<{ pi: any; payId: string }> {
  const pi = await stripe.paymentIntents.create({
    amount: Math.round(pounds * 100), currency: "gbp", payment_method: "pm_card_visa", confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    metadata: { tenantId: f.tenantId, refs: refs.join(","), email: "parent-a@emu.test" },
  });
  assert.equal(pi.status, "succeeded");
  const doc = await fs.collection("payments").add({
    tenantId: f.tenantId, refs, email: "parent-a@emu.test", amount: pounds, currency: "gbp", paymentIntentId: pi.id, stripeAccount: null,
    platformFallback: true, status: "created", createdAt: new Date().toISOString(),
  });
  return { pi, payId: doc.id };
}

/** Net card money kept on Stripe for these intents, in pence (captured minus refunded). */
async function netPence(piIds: string[]): Promise<number> {
  let net = 0;
  for (const id of piIds) {
    const pi = await stripe.paymentIntents.retrieve(id);
    const refunds = (await stripe.refunds.list({ payment_intent: id, limit: 20 })).data.filter((r: any) => r.status !== "failed" && r.status !== "canceled");
    net += (pi.amount_received ?? 0) - refunds.reduce((s: number, r: any) => s + r.amount, 0);
  }
  return net;
}

test("V02: the pay-link route and the parent route called at the same instant share ONE PaymentIntent", async () => {
  const ref = await newBooking(f, 36);
  const token = randomUUID();
  await fs.collection("bookingPayTokens").doc(token).set({ key: `${f.tenantId}_${ref}`, tenantId: f.tenantId, ref, createdAt: new Date().toISOString() });
  const [a, b] = await Promise.all([
    checkout(f, [ref]),
    call("POST", `/api/public/booking-pay/${token}/checkout`, null, {}),
  ]);
  assert.equal(a.status, 201, JSON.stringify(a.json));
  assert.equal(b.status, 201, JSON.stringify(b.json));
  const intents = await intentsFor(ref, since);
  assert.equal(intents.length, 1, `Stripe holds ${intents.length} PaymentIntents for one booking`);
  assert.equal(a.json.clientSecret, b.json.clientSecret);
  assert.equal(a.json.paymentId, b.json.paymentId);
});

test("V06: both payments + their webhooks + both browser confirms arriving together record ONE payment and refund the other", async () => {
  for (let round = 0; round < 4; round++) {
    const ref = await newBooking(f, 36);
    const one = await forceIntent([ref], 36);
    const two = await forceIntent([ref], 36);
    const token = randomUUID();
    await fs.collection("bookingPayTokens").doc(token).set({ key: `${f.tenantId}_${ref}`, tenantId: f.tenantId, ref, createdAt: new Date().toISOString() });
    const ev = `evt_v06_${Date.now()}_${round}`;
    await Promise.all([
      deliver(`${ev}a`, "payment_intent.succeeded", one.pi),
      deliver(`${ev}b`, "payment_intent.succeeded", two.pi),
      call("POST", `/api/payments/checkout/${one.payId}/confirm`, f.parentToken),
      call("POST", `/api/public/booking-pay/${token}/confirm/${two.payId}`, null, {}),
      deliver(`${ev}a`, "payment_intent.succeeded", one.pi), // replay
      deliver(`${ev}b`, "payment_intent.succeeded", two.pi), // replay
    ]);
    const recs = await Promise.all([fs.collection("payments").doc(one.payId).get(), fs.collection("payments").doc(two.payId).get()]);
    const statuses = recs.map((r: any) => r.data().status).sort();
    assert.deepEqual(statuses.map((s: string) => s.startsWith("duplicate") ? "duplicate" : s), ["duplicate", "succeeded"], `round ${round}: ${statuses}`);
    assert.equal(await netPence([one.pi.id, two.pi.id]), 3600, `round ${round}: net card money must be one payment`);
    const bk = await booking(f, ref);
    assert.equal(bk.pay, "Paid"); assert.equal(bk.amountPaid, 36);
    const refundCount = (await stripe.refunds.list({ payment_intent: one.pi.id })).data.length + (await stripe.refunds.list({ payment_intent: two.pi.id })).data.length;
    assert.equal(refundCount, 1, `round ${round}: exactly one refund`);
  }
});

test("V03b: an old 36 pound intent confirmed after 10 pounds cash was recorded never over-collects", async () => {
  const ref = await newBooking(f, 36);
  const a = await checkout(f, [ref]);
  const old = secretToPi(a.json.clientSecret);
  const rec = await call("POST", `/api/bookings/${ref}/record-payment`, f.providerToken, { amount: 10, method: "cash", reference: `v03b-${ref}` });
  assert.ok(rec.status < 300, JSON.stringify(rec.json));
  // The old intent may by now be cancelled (fix) or still open (parent code): either way the family must not pay 36 on top of 10.
  await payIntent(old).catch(() => null);
  await call("POST", `/api/payments/checkout/${a.json.paymentId}/confirm`, f.parentToken);
  const net = await netPence([old]);
  assert.ok(net <= 2600, `card kept ${net}p but only 2600p was owed`);
  const bk = await booking(f, ref);
  assert.ok(bk.amountPaid <= 36, `booking records ${bk.amountPaid}`);
  assert.equal(net / 100 + 10 <= 36, true);
});

test("V03b backstop: a 36 pound payment that lands when only 26 is owed is settled for 26 and the 10 excess is refunded once", async () => {
  const ref = await newBooking(f, 36);
  const rec = await call("POST", `/api/bookings/${ref}/record-payment`, f.providerToken, { amount: 10, method: "cash", reference: `v03bb-${ref}` });
  assert.ok(rec.status < 300);
  const x = await forceIntent([ref], 36);
  const ev = `evt_v03bb_${Date.now()}`;
  await deliver(ev, "payment_intent.succeeded", x.pi);
  await deliver(ev, "payment_intent.succeeded", x.pi);
  await call("POST", `/api/payments/checkout/${x.payId}/confirm`, f.parentToken);
  await deliver(`${ev}_2`, "payment_intent.succeeded", x.pi);
  const refunds = (await stripe.refunds.list({ payment_intent: x.pi.id })).data;
  assert.equal(refunds.length, 1, "one refund");
  assert.equal(refunds[0].amount, 1000);
  const bk = await booking(f, ref);
  assert.equal(bk.pay, "Paid"); assert.equal(bk.amountPaid, 36);
  assert.equal(await netPence([x.pi.id]), 2600);
});

test("V09a: after A is paid, the older 72 pound basket intent never keeps more than B's 36", async () => {
  const A = await newBooking(f, 36);
  const B = await newBooking(f, 36);
  const first = await checkout(f, [A]);
  const basket = await checkout(f, [A, B]);
  assert.equal(basket.json.amount, 72);
  const piA = secretToPi(first.json.clientSecret), piAB = secretToPi(basket.json.clientSecret);
  // Pay A with its own intent (it may have been cancelled by the newer basket: then it simply cannot be paid).
  await payIntent(piA).catch(() => null);
  await call("POST", `/api/payments/checkout/${first.json.paymentId}/confirm`, f.parentToken);
  await payIntent(piAB).catch(() => null);
  await call("POST", `/api/payments/checkout/${basket.json.paymentId}/confirm`, f.parentToken);
  const paidBookings = [(await booking(f, A)), (await booking(f, B))].filter((b) => b.pay === "Paid").length;
  const net = await netPence([piA, piAB]);
  assert.equal(net, 3600 * paidBookings, `kept ${net}p for ${paidBookings} paid booking(s) worth 3600p each`);
});

test("V09a backstop: a 72 pound payment for [A,B] landing after A was paid settles B and refunds A's 36", async () => {
  const A = await newBooking(f, 36);
  const B = await newBooking(f, 36);
  const a = await forceIntent([A], 36);
  await deliver(`evt_v09a_${Date.now()}_a`, "payment_intent.succeeded", a.pi);
  const ab = await forceIntent([A, B], 72);
  const ev = `evt_v09a_${Date.now()}_ab`;
  await deliver(ev, "payment_intent.succeeded", ab.pi);
  await deliver(ev, "payment_intent.succeeded", ab.pi);
  await call("POST", `/api/payments/checkout/${ab.payId}/confirm`, f.parentToken);
  const refunds = (await stripe.refunds.list({ payment_intent: ab.pi.id })).data;
  assert.equal(refunds.length, 1);
  assert.equal(refunds[0].amount, 3600);
  assert.equal((await booking(f, A)).amountPaid, 36);
  const bb = await booking(f, B);
  assert.equal(bb.pay, "Paid"); assert.equal(bb.amountPaid, 36);
  assert.equal(await netPence([a.pi.id, ab.pi.id]), 7200);
});

test("older open intents are cancelled when a new basket supersedes them, and when cash is recorded", async () => {
  const A = await newBooking(f, 36);
  const B = await newBooking(f, 36);
  const first = await checkout(f, [A]);
  await checkout(f, [A, B]);
  const old = await stripe.paymentIntents.retrieve(secretToPi(first.json.clientSecret));
  assert.equal(old.status, "canceled", "the single-booking intent is cancelled once the basket supersedes it");
  const C = await newBooking(f, 36);
  const c = await checkout(f, [C]);
  await call("POST", `/api/bookings/${C}/record-payment`, f.providerToken, { amount: 10, method: "cash", reference: `canc-${C}` });
  assert.equal((await stripe.paymentIntents.retrieve(secretToPi(c.json.clientSecret))).status, "canceled");
});
