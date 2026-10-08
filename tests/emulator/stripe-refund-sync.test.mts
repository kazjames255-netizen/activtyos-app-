/**
 * A refund made OUTSIDE the app (Stripe dashboard, the connected account's own dashboard) must reach our books.
 * Real Stripe TEST payments and refunds; events are delivered to the local API signed with the local webhook secret
 * (the same bytes Stripe would send), and some are hand-built to reach cases Stripe will not produce on demand.
 * Platform-account fallback path (stripeAccount null); the Connect account check is covered with an event that names a different account.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { makeProvider, makeParent, makeListing, book, uniq, call, db, sleep, operatorAction, bookingDoc, type Provider, type Parent, type Listing } from "./helpers.mts";
import { deliver, stripe, payIntent, API, WEBHOOK_SECRET } from "./_stack.mts";

let P: Provider, A: Parent, L: Listing;
before(async () => {
  P = await makeProvider("RS"); A = await makeParent("RSA", P);
  L = await makeListing(P, `RS camp ${uniq()}`, false);
});

/** A card payment really taken in Stripe TEST and settled in the app for one or more bookings. */
async function paid(n = 1) {
  const refs: string[] = [];
  for (let i = 0; i < n; i++) refs.push(await book(A, L, { method: "card" }));
  const co = await call("POST", "/api/payments/checkout", A.token, { refs, tenantId: P.tenantId });
  assert.equal(co.status, 201, JSON.stringify(co.json));
  const piId = String(co.json.clientSecret).split("_secret_")[0];
  await payIntent(piId);
  const r = await call("POST", `/api/payments/checkout/${co.json.paymentId}/confirm`, A.token);
  assert.equal(r.json.paid, true, JSON.stringify(r.json));
  const pi = await stripe.paymentIntents.retrieve(piId);
  return { refs, pi, payId: String(co.json.paymentId) as string };
}
/** The refund as the Stripe dashboard makes it: no app metadata. */
const dashboardRefund = (pi: any, pounds?: number) => stripe.refunds.create({ payment_intent: pi.id, ...(pounds ? { amount: Math.round(pounds * 100) } : {}) });
const chargeOf = async (pi: any) => stripe.charges.retrieve(String(pi.latest_charge));
const evId = () => `evt_rs_${uniq()}${uniq()}`;
const refundDocs = async (pi: any) => (await db.collection("payments").where("paymentIntentId", "==", pi.id).get()).docs.map((d: any) => ({ id: d.id, ...d.data() })).filter((d: any) => d.type === "refund");
const stripeBells = async (ref: string) => {
  await sleep(1500);
  return (await db.collection("notifications").where("tenantId", "==", P.tenantId).get()).docs.map((d: any) => d.data()).filter((n: any) => n.audience === "tenant" && /made in Stripe/i.test(String(n.body)) && String(n.body).includes(ref));
};
const waitFor = async (fn: () => Promise<boolean>, ms = 8000) => { const t = Date.now() + ms; while (Date.now() < t) { if (await fn()) return true; await sleep(200); } return false; };
const logOf = (b: any) => (b.refundLog ?? []) as { label: string; amount: number; refundId?: string }[];
const fakeRefund = (pi: any, id: string, pounds: number, extra: Record<string, unknown> = {}) => ({ id, object: "refund", amount: Math.round(pounds * 100), currency: "gbp", payment_intent: pi.id, charge: String(pi.latest_charge), status: "succeeded", reason: null, metadata: {}, created: Math.floor(Date.now() / 1000), ...extra });
async function deliverRaw(payload: string, header: string) {
  const r = await fetch(`${API}/api/stripe/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": header }, body: payload });
  return { status: r.status, json: await r.json().catch(() => null) };
}
async function deliverFrom(account: string, type: string, object: unknown) {
  const payload = JSON.stringify({ id: evId(), object: "event", type, account, data: { object }, created: Math.floor(Date.now() / 1000), livemode: false, api_version: "2025-01-01" });
  return deliverRaw(payload, stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }));
}

describe("a full refund made in the Stripe dashboard", () => {
  it("charge.refunded: booking Refunded, one refund line, one refund row, one bell, booking NOT cancelled, no wallet credit", async () => {
    const { refs, pi } = await paid();
    const re = await dashboardRefund(pi);
    const ch = await chargeOf(pi);
    const d = await deliver(evId(), "charge.refunded", ch);
    assert.equal(d.status, 200);
    assert.ok(await waitFor(async () => (await bookingDoc(P, refs[0])).pay === "Refunded"), "booking pay should become Refunded");
    const b = await bookingDoc(P, refs[0]);
    assert.equal(b.status, "Confirmed", "the app must not cancel the booking by itself");
    assert.equal(logOf(b).length, 1);
    assert.equal(logOf(b)[0].amount, 20);
    assert.match(logOf(b)[0].label, /Refunded in Stripe/);
    assert.equal(logOf(b)[0].refundId, re.id);
    assert.ok(!(b.walletRefunded > 0), "never mints wallet credit");
    const rows = await refundDocs(pi);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].refundId, re.id);
    assert.equal(rows[0].amount, 20);
    assert.equal(rows[0].status, "succeeded");
    assert.equal(rows[0].via, "stripe");
    assert.match(String(rows[0].reason), /refunded in Stripe/i);
    const bells = await stripeBells(refs[0]);
    assert.equal(bells.length, 1, JSON.stringify(bells));
    assert.match(String(bells[0].body), /A refund of £20\.00 was made in Stripe for booking/);
  });

  it("replays, a different event for the same refund, and a concurrent burst change nothing further", async () => {
    const { refs, pi } = await paid();
    const re = await dashboardRefund(pi);
    const ch = await chargeOf(pi);
    const e1 = evId();
    await deliver(e1, "charge.refunded", ch);
    await deliver(e1, "charge.refunded", ch); // exact replay (claimed event id)
    await Promise.all([
      deliver(evId(), "charge.refunded", ch), deliver(evId(), "refund.updated", re), deliver(evId(), "refund.created", re),
      deliver(evId(), "charge.refund.updated", re), deliver(evId(), "charge.refunded", ch), deliver(evId(), "refund.updated", re),
    ]);
    await sleep(1500);
    const b = await bookingDoc(P, refs[0]);
    assert.equal(logOf(b).length, 1, JSON.stringify(logOf(b)));
    assert.equal((await refundDocs(pi)).length, 1);
    assert.equal((await stripeBells(refs[0])).length, 1);
  });
});

describe("partial then full, and out-of-order events", () => {
  it("£5 then the remaining £15: Partially refunded, then Refunded; two lines, two rows, two bells", async () => {
    const { refs, pi } = await paid();
    const r1 = await dashboardRefund(pi, 5);
    await deliver(evId(), "refund.created", r1);
    assert.ok(await waitFor(async () => (await bookingDoc(P, refs[0])).pay === "Partially refunded"));
    assert.equal(logOf(await bookingDoc(P, refs[0]))[0].amount, 5);
    const r2 = await dashboardRefund(pi, 15);
    await deliver(evId(), "refund.created", r2);
    assert.ok(await waitFor(async () => (await bookingDoc(P, refs[0])).pay === "Refunded"));
    const b = await bookingDoc(P, refs[0]);
    assert.deepEqual(logOf(b).map((x) => x.amount).sort((a, c) => a - c), [5, 15]);
    assert.equal((await refundDocs(pi)).length, 2);
    assert.equal((await stripeBells(refs[0])).length, 2);
  });

  it("the later refund's event arrives before the earlier one's; a refund seen pending then succeeded counts once", async () => {
    const { refs, pi } = await paid();
    const r1 = await dashboardRefund(pi, 4);
    const r2 = await dashboardRefund(pi, 6);
    await deliver(evId(), "refund.updated", r2);
    await deliver(evId(), "refund.updated", r1);
    await deliver(evId(), "refund.created", { ...r1, status: "pending" });
    await deliver(evId(), "refund.updated", r1);
    await sleep(1000);
    const b = await bookingDoc(P, refs[0]);
    assert.deepEqual(logOf(b).map((x) => x.amount).sort((a, c) => a - c), [4, 6]);
    assert.equal(b.pay, "Partially refunded");
  });
});

describe("refunds our own flow made are not counted twice", () => {
  it("cancel + approve the refund in the app, then every Stripe event for it: nothing extra, no 'made in Stripe' bell", async () => {
    const { refs, pi } = await paid();
    assert.equal((await operatorAction(P, refs[0], { type: "cancel", refund: "full" })).status, 200);
    const ap = await operatorAction(P, refs[0], { type: "refund-approve" });
    assert.equal(ap.status, 200, JSON.stringify(ap.json));
    const before = await bookingDoc(P, refs[0]);
    const list = (await stripe.refunds.list({ payment_intent: pi.id })).data;
    assert.equal(list.length, 1);
    const ch = await chargeOf(pi);
    await Promise.all([deliver(evId(), "charge.refunded", ch), deliver(evId(), "refund.created", list[0]), deliver(evId(), "refund.updated", list[0])]);
    await sleep(1500);
    const after = await bookingDoc(P, refs[0]);
    assert.deepEqual(logOf(after), logOf(before));
    assert.equal(after.refundedApproved, before.refundedApproved);
    assert.equal((await refundDocs(pi)).length, 1, "only the app's own refund row");
    assert.equal((await stripeBells(refs[0])).length, 0);
  });

  it("our refund's event arrives BEFORE our own record of it exists (race): still nothing extra", async () => {
    const { refs, pi } = await paid();
    // The app's refund is created with the app's marker; the event is delivered with no payments row written yet.
    const re = await stripe.refunds.create({ payment_intent: pi.id, amount: 2000, metadata: { activityosOrigin: "app" } });
    await deliver(evId(), "refund.created", re);
    await sleep(800);
    assert.equal(logOf(await bookingDoc(P, refs[0])).length, 0);
    assert.equal((await refundDocs(pi)).length, 0);
  });

  it("an older app refund (no marker) whose row carries the refund id is also recognised", async () => {
    const { refs, pi } = await paid();
    const re = await dashboardRefund(pi, 3);
    await db.collection("payments").add({ tenantId: P.tenantId, refs, type: "refund", amount: 3, currency: "gbp", paymentIntentId: pi.id, stripeAccount: null, status: "succeeded", refundId: re.id, createdAt: new Date().toISOString() });
    await deliver(evId(), "refund.created", re);
    await sleep(800);
    assert.equal(logOf(await bookingDoc(P, refs[0])).length, 0);
    assert.equal((await refundDocs(pi)).length, 1);
  });
});

describe("rejected or ignored events", () => {
  it("a wrong signature is rejected (400) and changes nothing", async () => {
    const { refs, pi } = await paid();
    const re = await dashboardRefund(pi);
    const payload = JSON.stringify({ id: evId(), object: "event", type: "refund.created", data: { object: re }, created: Math.floor(Date.now() / 1000), livemode: false });
    const bad = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_not_the_secret" });
    const r = await deliverRaw(payload, bad);
    assert.equal(r.status, 400);
    await sleep(500);
    assert.equal(logOf(await bookingDoc(P, refs[0])).length, 0);
  });

  it("a refund for a payment we never recorded: 200, ignored, nothing written", async () => {
    const pi = await stripe.paymentIntents.create({ amount: 700, currency: "gbp", payment_method: "pm_card_visa", confirm: true, automatic_payment_methods: { enabled: true, allow_redirects: "never" } });
    const re = await dashboardRefund(pi);
    const before = (await db.collection("payments").get()).size;
    const d = await deliver(evId(), "refund.created", re);
    assert.equal(d.status, 200);
    assert.equal((await db.collection("payments").get()).size, before);
  });

  it("an event naming a different connected account than the payment's is ignored", async () => {
    const { refs, pi } = await paid();
    const re = await dashboardRefund(pi);
    const d = await deliverFrom("acct_someone_else", "refund.created", re);
    assert.equal(d.status, 200);
    await sleep(500);
    assert.equal(logOf(await bookingDoc(P, refs[0])).length, 0);
  });

  it("a refund larger than the payment cannot be recorded beyond the payment", async () => {
    const { refs, pi } = await paid();
    await deliver(evId(), "refund.created", fakeRefund(pi, `re_big_${uniq()}`, 25));
    await sleep(800);
    const b = await bookingDoc(P, refs[0]);
    assert.ok(logOf(b).reduce((s, x) => s + x.amount, 0) <= 20.005, JSON.stringify(logOf(b)));
  });

  it("a refund that FAILS afterwards is taken back off the booking", async () => {
    const { refs, pi } = await paid();
    const id = `re_fail_${uniq()}`;
    await deliver(evId(), "refund.created", fakeRefund(pi, id, 20));
    assert.ok(await waitFor(async () => (await bookingDoc(P, refs[0])).pay === "Refunded"));
    await deliver(evId(), "refund.failed", fakeRefund(pi, id, 20, { status: "failed" }));
    assert.ok(await waitFor(async () => (await bookingDoc(P, refs[0])).pay === "Paid"), "back to Paid");
    assert.equal(logOf(await bookingDoc(P, refs[0])).length, 0);
  });
});

describe("one payment covering several bookings", () => {
  it("is split by each booking's share of the payment; partial then the rest; the lines add up to the refund to the penny", async () => {
    const { refs, pi } = await paid(2); // 2 x 20
    const r1 = await dashboardRefund(pi, 10.01);
    await deliver(evId(), "refund.created", r1);
    assert.ok(await waitFor(async () => logOf(await bookingDoc(P, refs[0])).length === 1 && logOf(await bookingDoc(P, refs[1])).length === 1));
    const a = logOf(await bookingDoc(P, refs[0]))[0].amount, c = logOf(await bookingDoc(P, refs[1]))[0].amount;
    assert.equal(Math.round((a + c) * 100), 1001);
    assert.ok(Math.abs(a - c) <= 0.011);
    assert.equal((await bookingDoc(P, refs[0])).pay, "Partially refunded");
    const r2 = await dashboardRefund(pi, 29.99);
    await deliver(evId(), "refund.created", r2);
    assert.ok(await waitFor(async () => (await bookingDoc(P, refs[0])).pay === "Refunded" && (await bookingDoc(P, refs[1])).pay === "Refunded"));
    const tot = [...logOf(await bookingDoc(P, refs[0])), ...logOf(await bookingDoc(P, refs[1]))].reduce((s, x) => s + x.amount, 0);
    assert.equal(Math.round(tot * 100), 4000);
    assert.equal((await refundDocs(pi)).length, 2);
  });
});

describe("Reconcile pulls refunds made before the fix", () => {
  it("no event ever delivered: the reconcile call finds the refund; running it again changes nothing", async () => {
    const { refs, pi } = await paid();
    const re = await dashboardRefund(pi, 8);
    const first = await call("POST", "/api/payments/sync-refunds", P.token, {});
    assert.equal(first.status, 200, JSON.stringify(first.json));
    assert.ok(first.json.recorded >= 1, JSON.stringify(first.json));
    const b = await bookingDoc(P, refs[0]);
    assert.equal(b.pay, "Partially refunded");
    assert.equal(logOf(b)[0].refundId, re.id);
    const second = await call("POST", "/api/payments/sync-refunds", P.token, {});
    assert.equal(second.status, 200);
    assert.equal(second.json.recorded, 0, JSON.stringify(second.json));
    assert.equal(logOf(await bookingDoc(P, refs[0])).length, 1);
    assert.equal((await refundDocs(pi)).length, 1);
    assert.equal((await stripeBells(refs[0])).length, 1);
    // and a late webhook for the same refund adds nothing
    await deliver(evId(), "refund.created", re);
    await sleep(800);
    assert.equal(logOf(await bookingDoc(P, refs[0])).length, 1);
  });

  it("only the signed-in provider's own payments are read", async () => {
    const r = await call("POST", "/api/payments/sync-refunds", A.token, {});
    assert.ok(r.status === 401 || r.status === 403, String(r.status));
  });
});
