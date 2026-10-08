/**
 * Round 2 of the Stripe refund sync (verifier findings R13b, R5c, R17b/R19e, R19d, R19b, R24, R7e, cooldown, busy retries).
 * Same setup as stripe-refund-sync.test.mts: real Stripe TEST payments/refunds, signed events delivered to the local API.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { makeProvider, makeParent, makeListing, book, uniq, call, db, sleep, operatorAction, bookingDoc, type Provider, type Parent, type Listing } from "./helpers.mts";
import { deliver, stripe, payIntent, API, WEBHOOK_SECRET } from "./_stack.mts";
import { refundedGross, collectedNet } from "../../features/bookings/helpers";

let P: Provider, A: Parent, L: Listing;
before(async () => {
  P = await makeProvider("RS2"); A = await makeParent("RS2A", P);
  L = await makeListing(P, `RS2 camp ${uniq()}`, false);
});

async function paid(n = 1) {
  const refs: string[] = [];
  for (let i = 0; i < n; i++) refs.push(await book(A, L, { method: "card" }));
  const co = await call("POST", "/api/payments/checkout", A.token, { refs, tenantId: P.tenantId });
  assert.equal(co.status, 201, JSON.stringify(co.json));
  const piId = String(co.json.clientSecret).split("_secret_")[0];
  await payIntent(piId);
  const r = await call("POST", `/api/payments/checkout/${co.json.paymentId}/confirm`, A.token);
  assert.equal(r.json.paid, true, JSON.stringify(r.json));
  return { refs, pi: await stripe.paymentIntents.retrieve(piId) };
}
const dashboardRefund = (pi: any, pounds?: number) => stripe.refunds.create({ payment_intent: pi.id, ...(pounds ? { amount: Math.round(pounds * 100) } : {}) });
const chargeOf = async (pi: any) => stripe.charges.retrieve(String(pi.latest_charge));
const evId = () => `evt_rs2_${uniq()}${uniq()}`;
const rows = async (pi: any) => (await db.collection("payments").where("paymentIntentId", "==", pi.id).get()).docs.map((d: any) => ({ id: d.id, ...d.data() })).filter((d: any) => d.type === "refund");
const logOf = (b: any) => (b.refundLog ?? []) as { label: string; amount: number; on: string; refundId?: string }[];
const waitFor = async (fn: () => Promise<boolean>, ms = 8000) => { const t = Date.now() + ms; while (Date.now() < t) { if (await fn()) return true; await sleep(200); } return false; };
const bells = async (needle: RegExp) => { await sleep(1500); return (await db.collection("notifications").where("tenantId", "==", P.tenantId).get()).docs.map((d: any) => d.data()).filter((n: any) => n.audience === "tenant" && needle.test(String(n.body))); };
const fake = (pi: any, id: string | undefined, pounds: number, extra: Record<string, unknown> = {}) => ({ ...(id ? { id } : {}), object: "refund", amount: Math.round(pounds * 100), currency: "gbp", payment_intent: pi.id, status: "succeeded", reason: null, metadata: {}, created: Math.floor(Date.now() / 1000), ...extra });
const ukDay = (secs: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date(secs * 1000));
const listBooking = async (ref: string) => ((await call("GET", "/api/bookings", P.token)).json as any[]).find((b) => b.ref === ref);
async function deliverFrom(account: string, type: string, object: unknown) {
  const payload = JSON.stringify({ id: evId(), object: "event", type, account, data: { object }, created: Math.floor(Date.now() / 1000), livemode: false, api_version: "2025-01-01" });
  const r = await fetch(`${API}/api/stripe/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }) }, body: payload });
  return { status: r.status };
}

describe("R13b: a cancellation's pending refund already covered by a Stripe-side refund", () => {
  it("webhook first, then Approve: the pending refund is resolved, Approve is refused, refunded money = 20 (never 40), pay Refunded", async () => {
    const { refs, pi } = await paid();
    assert.equal((await operatorAction(P, refs[0], { type: "cancel", refund: "full" })).status, 200);
    assert.equal((await bookingDoc(P, refs[0])).pay, "Refund pending");
    await dashboardRefund(pi);
    await deliver(evId(), "charge.refunded", await chargeOf(pi));
    assert.ok(await waitFor(async () => (await bookingDoc(P, refs[0])).pay === "Refunded"), "pending refund should resolve to Refunded");
    const ap = await operatorAction(P, refs[0], { type: "refund-approve" });
    assert.ok(ap.status >= 400 && ap.status < 500, `Approve must be refused, got ${ap.status} ${JSON.stringify(ap.json)}`);
    const b = await listBooking(refs[0]);
    assert.equal(refundedGross(b), 20);
    assert.equal(collectedNet(b), 0);
    assert.ok(logOf(b).every((x) => x.amount > 0), "no £0 line");
  });

  it("Approve first (webhook not yet delivered): never a £0 approval; after the event the total is still 20", async () => {
    const { refs, pi } = await paid();
    await operatorAction(P, refs[0], { type: "cancel", refund: "full" });
    await dashboardRefund(pi);
    const ap = await operatorAction(P, refs[0], { type: "refund-approve" });
    assert.notEqual(ap.status, 200, "Stripe already refunded this: Approve must not report success");
    await deliver(evId(), "charge.refunded", await chargeOf(pi));
    assert.ok(await waitFor(async () => (await bookingDoc(P, refs[0])).pay === "Refunded"));
    const b = await listBooking(refs[0]);
    assert.equal(refundedGross(b), 20);
    assert.ok(logOf(b).every((x) => x.amount > 0));
  });

  it("a partial Stripe refund shrinks the pending refund to what is left", async () => {
    const { refs, pi } = await paid();
    await operatorAction(P, refs[0], { type: "cancel", refund: "full" });
    await dashboardRefund(pi, 5);
    await deliver(evId(), "charge.refunded", await chargeOf(pi));
    assert.ok(await waitFor(async () => logOf(await bookingDoc(P, refs[0])).length === 1));
    const b = await bookingDoc(P, refs[0]);
    assert.equal(b.cancel.refund, "full");
    assert.equal(b.cancel.amount, 15);
  });
});

describe("R5c: the refund is re-read from Stripe, not trusted from the event", () => {
  it("a stale 'failed' event for a refund that actually succeeded changes nothing; a stale 'pending' after is harmless", async () => {
    const { refs, pi } = await paid();
    const re = await dashboardRefund(pi);
    await deliver(evId(), "refund.failed", { ...re, status: "failed" });
    assert.ok(await waitFor(async () => (await bookingDoc(P, refs[0])).pay === "Refunded"), "Stripe says succeeded, so it is recorded");
    await deliver(evId(), "refund.failed", { ...re, status: "failed" });
    await deliver(evId(), "refund.updated", { ...re, status: "pending" });
    await sleep(800);
    const b = await bookingDoc(P, refs[0]);
    assert.equal(b.pay, "Refunded");
    assert.equal(logOf(b).length, 1);
  });
});

describe("R17b/R19e/R19d: nothing to record means nothing written", () => {
  it("a zero-amount refund and a refund with no amount: no row, no £0.00 bell", async () => {
    const { refs, pi } = await paid();
    await deliver(evId(), "refund.created", fake(pi, `re_zero_${uniq()}`, 0));
    await deliver(evId(), "refund.created", { ...fake(pi, `re_noamt_${uniq()}`, 1), amount: undefined });
    await sleep(800);
    assert.equal((await rows(pi)).length, 0);
    assert.equal(logOf(await bookingDoc(P, refs[0])).length, 0);
    assert.equal((await bells(/£0\.00 was made in Stripe/)).length, 0);
  });

  it("a refund when the payment is already fully refunded (no room): no extra row, no bell", async () => {
    const { refs, pi } = await paid();
    await dashboardRefund(pi);
    await deliver(evId(), "charge.refunded", await chargeOf(pi));
    assert.ok(await waitFor(async () => (await bookingDoc(P, refs[0])).pay === "Refunded"));
    await deliver(evId(), "refund.created", fake(pi, `re_more_${uniq()}`, 5));
    await sleep(800);
    assert.equal((await rows(pi)).length, 1);
    assert.equal((await bells(new RegExp(`£5\\.00 was made in Stripe for booking ${refs[0]}`))).length, 0);
  });

  it("a refund with no id is ignored (200) and writes nothing", async () => {
    const { pi } = await paid();
    const d = await deliver(evId(), "refund.created", fake(pi, undefined, 3));
    assert.equal(d.status, 200);
    assert.ok(!(await db.collection("payments").doc("stripe-refund-undefined").get()).exists);
  });
});

describe("R19b: charge.refunded naming an account we cannot read", () => {
  it("answers 200 (ignored), not 500", async () => {
    const { pi } = await paid();
    const ch = await chargeOf(pi);
    const d = await deliverFrom("acct_1NotARealAccount", "charge.refunded", ch);
    assert.equal(d.status, 200);
  });
});

describe("R24: the refund is dated when it happened, not when we heard", () => {
  it("a refund made 40 days ago, picked up now, is dated 40 days ago on the booking line", async () => {
    const { refs, pi } = await paid();
    const when = Math.floor(Date.now() / 1000) - 40 * 86400;
    await deliver(evId(), "refund.created", fake(pi, `re_old_${uniq()}`, 6, { created: when }));
    assert.ok(await waitFor(async () => logOf(await bookingDoc(P, refs[0])).length === 1));
    assert.equal(logOf(await bookingDoc(P, refs[0]))[0].on, ukDay(when));
  });
});

describe("R7e / busy: concurrent deliveries", () => {
  it("40 simultaneous distinct events for one refund: every one answers 200, one row, one line", async () => {
    const { refs, pi } = await paid();
    const re = await dashboardRefund(pi, 7);
    const ch = await chargeOf(pi);
    const out = await Promise.all(Array.from({ length: 40 }, (_, i) => deliver(evId(), i % 2 ? "refund.updated" : "charge.refunded", i % 2 ? re : ch)));
    assert.deepEqual(out.map((o) => o.status).filter((s) => s !== 200), [], "all deliveries answered 200 after retries");
    await sleep(800);
    assert.equal((await rows(pi)).length, 1);
    assert.equal(logOf(await bookingDoc(P, refs[0])).length, 1);
  });

  it("two refunds at once on one payment both land and the payment's refund state is right", async () => {
    const { refs, pi } = await paid();
    const r1 = await dashboardRefund(pi, 8), r2 = await dashboardRefund(pi, 12);
    await Promise.all([deliver(evId(), "refund.created", r1), deliver(evId(), "refund.created", r2)]);
    assert.ok(await waitFor(async () => (await bookingDoc(P, refs[0])).pay === "Refunded"));
    const pay = (await db.collection("payments").where("paymentIntentId", "==", pi.id).get()).docs.find((d: any) => d.get("type") !== "refund");
    assert.equal(pay!.get("refundState"), "full");
    assert.equal(pay!.get("externalRefunded"), undefined, "the racy running total is gone");
  });
});

describe("backfill endpoint: cooldown", () => {
  it("a second run inside the cooldown gets a friendly 429; after it, it runs", async () => {
    const first = await call("POST", "/api/payments/sync-refunds", P.token, {});
    assert.equal(first.status, 200, JSON.stringify(first.json));
    const again = await call("POST", "/api/payments/sync-refunds", P.token, {});
    assert.equal(again.status, 429, JSON.stringify(again.json));
    assert.match(String(again.json.error), /try again/i);
    await sleep(3200);
    assert.equal((await call("POST", "/api/payments/sync-refunds", P.token, {})).status, 200);
  });
});
