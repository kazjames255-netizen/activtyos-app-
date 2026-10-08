/**
 * Round 3: the Stripe idempotency keys must not poison a retry. These use a fake Stripe client (so a failure can be forced
 * deterministically) against the real emulator Firestore and the real server code. Runs in `npm run test:emu` without a Stripe key.
 * NOTE: what Stripe itself does with a replayed failed key for 24 hours is NOT reproduced here; the tests prove our code sends
 * a different key after a failure.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { db, uniq } from "./helpers.mts";
import * as checkout from "../../server/src/lib/checkoutIntent";
import * as settle from "../../server/src/lib/settlePayment";

const pi = (id: string, status = "requires_payment_method") => ({ id, status, client_secret: `${id}_secret_x` });

test("1: after a FAILED create, the retry uses a different idempotency key and can succeed", async () => {
  const u = uniq();
  const keys: string[] = [];
  const fake: any = { paymentIntents: {
    create: async (_p: unknown, o: { idempotencyKey: string }) => { keys.push(o.idempotencyKey); if (keys.length === 1) throw Object.assign(new Error("Amount must be at least 30p"), { statusCode: 400, code: "amount_too_small" }); return pi(`pi_fake_${u}`); },
    retrieve: async (id: string) => pi(id),
  } };
  const req = { tenantId: `t-${u}`, covers: [`F-${u}`], pence: 2000, tag: "x", stripeAccount: null, params: { amount: 2000, currency: "gbp" } as any, record: { tenantId: `t-${u}`, refs: [`F-${u}`], status: "created", amount: 20 } };
  await assert.rejects(checkout.createOrReuseIntent(fake, req));
  const ok = await checkout.createOrReuseIntent(fake, req);
  assert.equal(ok.intent.id, `pi_fake_${u}`);
  assert.equal(keys.length, 2);
  assert.notEqual(keys[0], keys[1], "the retry must not reuse the key whose failure Stripe would replay");
});

test("3: when Stripe answers idempotency_error because a racing call used the same key with other params, reuse that call's intent", async () => {
  const u = uniq();
  const covers = [`G-${u}`];
  const req = { tenantId: `t-${u}`, covers, pence: 3600, tag: "x", stripeAccount: null, params: { amount: 3600, currency: "gbp" } as any, record: { tenantId: `t-${u}`, refs: covers, status: "created", amount: 36 } };
  const key = checkout.checkoutKey(req);
  const fake: any = { paymentIntents: {
    create: async () => {
      // the racing call finishes and writes its record, then our call gets Stripe's parameter-mismatch error
      await db.collection("payments").doc(`pi_race_${u}`).set({ ...req.record, paymentIntentId: `pi_race_${u}`, idemKey: key });
      throw Object.assign(new Error("Keys for idempotent requests can only be used with the same parameters"), { type: "StripeIdempotencyError", code: "idempotency_error", statusCode: 400 });
    },
    retrieve: async (id: string) => pi(id),
  } };
  const r = await checkout.createOrReuseIntent(fake, req);
  assert.equal(r.paymentId, `pi_race_${u}`);
  assert.equal(r.reused, true);
});

test("2: a failed excess refund is retried with a different key and never refunds twice once it worked", async () => {
  const u = uniq();
  const payRef = db.collection("payments").doc(`pay_${u}`);
  await payRef.set({ tenantId: `t-${u}`, refs: [`H-${u}`], status: "succeeded", paymentIntentId: `pi_h_${u}`, stripeAccount: null, amount: 36, currency: "gbp", excess: { pence: 1000, state: "pending" } });
  const keys: string[] = [];
  const fake: any = { refunds: { create: async (_p: unknown, o: { idempotencyKey: string }) => { keys.push(o.idempotencyKey); if (keys.length === 1) throw Object.assign(new Error("insufficient funds"), { statusCode: 402 }); return { id: `re_${u}` }; } } };
  await settle.refundExcess(payRef, fake);
  assert.equal((await payRef.get()).data()!.excess.state, "failed");
  await settle.refundExcess(payRef, fake);
  assert.equal((await payRef.get()).data()!.excess.state, "refunded");
  await settle.refundExcess(payRef, fake);
  await settle.refundExcess(payRef, fake);
  assert.equal(keys.length, 2, "no further refund once one succeeded");
  assert.notEqual(keys[0], keys[1]);
});

test("4: an excess refund writes a refund row so Money in and the refundable amount stay net", async () => {
  const u = uniq();
  const payRef = db.collection("payments").doc(`pay4_${u}`);
  await payRef.set({ tenantId: `t-${u}`, refs: [`J-${u}`], status: "succeeded", paymentIntentId: `pi_j_${u}`, stripeAccount: null, amount: 36, currency: "gbp", excess: { pence: 1000, state: "pending" } });
  const fake: any = { refunds: { create: async () => ({ id: `re_j_${u}` }) } };
  await settle.refundExcess(payRef, fake);
  await settle.refundExcess(payRef, fake);
  const rows = (await db.collection("payments").where("paymentIntentId", "==", `pi_j_${u}`).get()).docs.map((d: any) => d.data());
  const refunds = rows.filter((r: any) => r.type === "refund");
  assert.equal(refunds.length, 1, "exactly one refund row");
  assert.equal(refunds[0].amount, 10);
  assert.equal(refunds[0].status, "succeeded");
  assert.deepEqual(refunds[0].refs, [`J-${u}`]);
  const { isMoneyIn } = await import("../../features/bookings/helpers");
  const net = rows.filter(isMoneyIn).reduce((s: number, r: any) => s + r.amount, 0) - refunds.reduce((s: number, r: any) => s + r.amount, 0);
  assert.equal(net, 26);
});

test("6: the provider message says what happened, not 'already paid', when the booking was no longer payable", () => {
  assert.equal(typeof settle.excessMessage, "function", "excessMessage exists");
  const m = settle.excessMessage({ reason: "not-payable", full: true, pence: 3600, where: "R1", refunded: true, pi: "pi_x" });
  assert.match(m.body, /no longer (payable|open)|cancelled|waitlisted/i);
  assert.doesNotMatch(m.body, /already paid/i);
  const p = settle.excessMessage({ reason: "paid", full: true, pence: 3600, where: "R1", refunded: true, pi: "pi_x" });
  assert.match(p.body, /already paid/i);
});
