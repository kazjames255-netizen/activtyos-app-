/**
 * Card checkout idempotency (bug C36: a double-click on Pay charged 72 pounds for a 36 pound booking).
 * Run on the local emulator stack only:  npm run test:emu   (not part of test:all).
 *
 * Needs, all on this machine: Firestore+Auth emulators, the seed (scripts/emu/seed-coupon-run.mts), and the API started with
 * STRIPE_SECRET_KEY=sk_test_..., STRIPE_PLATFORM_FALLBACK=1, STRIPE_WEBHOOK_SECRET=<any whsec_ value>. This test process needs the
 * same STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and E2E_PASSWORD, plus EMU_PORT_OFFSET if the stack is not on the default ports.
 * Payments run on the platform TEST account (platform fallback): the connected-account direct-charge path is NOT exercised here.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { booking, call, checkout, deliver, fixture, fs, intentsFor, newBooking, payIntent, stripe, type Fixture } from "./_stack.mts";

const since = Math.floor(Date.now() / 1000);
let f: Fixture;
test.before(async () => { f = await fixture(); });

const open = new Set(["requires_payment_method", "requires_confirmation", "requires_action", "processing"]);

test("(i) two simultaneous checkout calls make exactly ONE PaymentIntent and return the same client secret", async () => {
  const ref = await newBooking(f, 36);
  const [a, b] = await Promise.all([checkout(f, [ref]), checkout(f, [ref])]);
  assert.equal(a.status, 201, JSON.stringify(a.json));
  assert.equal(b.status, 201, JSON.stringify(b.json));
  const intents = await intentsFor(ref, since);
  assert.equal(intents.length, 1, `Stripe holds ${intents.length} PaymentIntents for one booking (${intents.map((p) => p.id).join(", ")})`);
  assert.equal(a.json.clientSecret, b.json.clientSecret, "both calls must hand the browser the same client secret");
  assert.equal(a.json.clientSecret, intents[0].client_secret);
  const recs = (await fs.collection("payments").where("refs", "array-contains", ref).get()).docs;
  assert.equal(recs.length, 1, "one payments record");
});

test("(ii) a sequential repeat call returns the same open PaymentIntent", async () => {
  const ref = await newBooking(f, 36);
  const a = await checkout(f, [ref]);
  const b = await checkout(f, [ref]);
  assert.equal(a.status, 201); assert.equal(b.status, 201);
  assert.equal(a.json.clientSecret, b.json.clientSecret);
  assert.equal(a.json.paymentId, b.json.paymentId);
  const intents = await intentsFor(ref, since);
  assert.equal(intents.length, 1);
  assert.ok(open.has(intents[0].status));
});

test("(iii) a changed amount (part-payment received meanwhile) creates a NEW PaymentIntent for the new balance", async () => {
  const ref = await newBooking(f, 36);
  const a = await checkout(f, [ref]);
  assert.equal(a.json.amount, 36);
  const rec = await call("POST", `/api/bookings/${ref}/record-payment`, f.providerToken, { amount: 10, method: "cash", reference: `idem-${ref}` });
  assert.ok(rec.status < 300, JSON.stringify(rec.json));
  const b = await checkout(f, [ref]);
  assert.equal(b.status, 201, JSON.stringify(b.json));
  assert.equal(b.json.amount, 26);
  assert.notEqual(a.json.clientSecret, b.json.clientSecret);
  assert.equal((await intentsFor(ref, since)).length, 2);
});

test("(iv) after a successful payment a further checkout never yields a chargeable intent", async () => {
  const ref = await newBooking(f, 36);
  const a = await checkout(f, [ref]);
  const piId = String(a.json.clientSecret).split("_secret_")[0];
  const pi = await payIntent(piId);
  assert.equal(pi.status, "succeeded");
  const c = await call("POST", `/api/payments/checkout/${a.json.paymentId}/confirm`, f.parentToken);
  assert.equal(c.json.paid, true);
  const again = await checkout(f, [ref]);
  assert.equal(again.status, 409, JSON.stringify(again.json));
  assert.equal(again.json.clientSecret, undefined);
  assert.equal((await intentsFor(ref, since)).length, 1);
  const bk = await booking(f, ref);
  assert.equal(bk.pay, "Paid"); assert.equal(bk.amountPaid, 36);
});

test("(v) a second PaymentIntent that succeeds for an already-paid booking is refunded exactly once and never recorded", async () => {
  const ref = await newBooking(f, 36);
  const a = await checkout(f, [ref]);
  const pi1 = String(a.json.clientSecret).split("_secret_")[0];
  assert.equal((await payIntent(pi1)).status, "succeeded");
  assert.equal((await call("POST", `/api/payments/checkout/${a.json.paymentId}/confirm`, f.parentToken)).json.paid, true);

  // Force the duplicate: a second intent + payments record for the same booking, as a double-click used to produce.
  const pi2 = await stripe.paymentIntents.create({
    amount: 3600, currency: "gbp", payment_method: "pm_card_visa", confirm: true, automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    metadata: { tenantId: f.tenantId, refs: ref, email: "parent-a@emu.test" },
  });
  assert.equal(pi2.status, "succeeded");
  const payRef = await fs.collection("payments").add({
    tenantId: f.tenantId, refs: [ref], email: "parent-a@emu.test", amount: 36, currency: "gbp", paymentIntentId: pi2.id, stripeAccount: null,
    platformFallback: true, status: "created", createdAt: new Date().toISOString(),
  });

  const ev = `evt_dup_${Date.now()}`;
  const first = await deliver(ev, "payment_intent.succeeded", pi2);
  assert.equal(first.status, 200);
  await deliver(ev, "payment_intent.succeeded", pi2);            // Stripe retry of the same event
  await deliver(`${ev}_b`, "payment_intent.succeeded", pi2);     // a different event for the same intent
  const confirmAgain = await call("POST", `/api/payments/checkout/${payRef.id}/confirm`, f.parentToken); // and the browser callback
  assert.ok(confirmAgain.status < 500);

  const refunds = (await stripe.refunds.list({ payment_intent: pi2.id, limit: 10 })).data;
  assert.equal(refunds.length, 1, `exactly one refund on the duplicate (got ${refunds.length})`);
  assert.equal(refunds[0].amount, 3600);
  const bk = await booking(f, ref);
  assert.equal(bk.pay, "Paid");
  assert.equal(bk.amountPaid, 36, "the duplicate must not be recorded as a second payment");
  assert.equal(bk.paymentIntentId, pi1, "the booking still points at the first payment");
  const rec = (await payRef.get()).data();
  assert.equal(rec.status, "duplicate-refunded");
  assert.ok(rec.refundId);
  assert.equal((await stripe.paymentIntents.retrieve(pi1)).amount_received, 3600);
});
