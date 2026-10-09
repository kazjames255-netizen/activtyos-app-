/**
 * Round 3 (live Stripe TEST, platform fallback): after an excess refund the money screens' figures equal the NET.
 * Connected-account direct charges are NOT exercised.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { booking, call, deliver, fixture, fs, newBooking, stripe, type Fixture } from "./_stack.mts";
import { reconcileBooking } from "../../server/src/lib/reconcileMath";
import { takenThisWeekFigure } from "../../server/src/lib/dashboardFigures";

let f: Fixture;
test.before(async () => { f = await fixture(); });

test("4: £36 card payment landing when only £26 is owed: Money in, reconciliation and refundable amount are all net", async () => {
  const ref = await newBooking(f, 36);
  assert.ok((await call("POST", `/api/bookings/${ref}/record-payment`, f.providerToken, { amount: 10, method: "cash", reference: `r3-${ref}` })).status < 300);
  const pi = await stripe.paymentIntents.create({
    amount: 3600, currency: "gbp", payment_method: "pm_card_visa", confirm: true, automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    metadata: { tenantId: f.tenantId, refs: ref, email: "parent-a@emu.test" },
  });
  await fs.collection("payments").add({ tenantId: f.tenantId, refs: [ref], email: "parent-a@emu.test", amount: 36, currency: "gbp", paymentIntentId: pi.id, stripeAccount: null, platformFallback: true, status: "created", createdAt: new Date().toISOString() });
  assert.equal((await deliver(`evt_r3_${Date.now()}`, "payment_intent.succeeded", pi)).status, 200);
  const rows = (await fs.collection("payments").where("refs", "array-contains", ref).get()).docs.map((d: any) => d.data()).filter((x: any) => x.tenantId === f.tenantId); // (booking numbers repeat across providers)
  const bk = await booking(f, ref);
  assert.equal(bk.amountPaid, 36);
  // reconciliation: money in minus refunds equals what the booking says was collected
  const r = reconcileBooking(bk, rows);
  assert.equal(r.net, 36, JSON.stringify(r));
  assert.equal(r.ok, true);
  // Dashboard "taken": only this booking's rows
  const taken = takenThisWeekFigure(rows, "2000-01-01", new Set());
  assert.equal(taken, 36);
  // refundable on the card: what Stripe holds (36 - refunds) as cardRefundable computes it from refund rows
  const stripeNet = (await stripe.paymentIntents.retrieve(pi.id)).amount_received / 100 - (await stripe.refunds.list({ payment_intent: pi.id })).data.reduce((s: number, x: any) => s + x.amount, 0) / 100;
  const refundRows = rows.filter((x: any) => x.type === "refund" && x.paymentIntentId === pi.id && x.status === "succeeded").reduce((s: number, x: any) => s + x.amount, 0);
  assert.equal(36 - refundRows, stripeNet);
  assert.equal(stripeNet, 26);
});
