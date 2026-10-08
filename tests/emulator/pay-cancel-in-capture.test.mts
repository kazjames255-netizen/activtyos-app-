/**
 * A booking cancelled while the approval's card capture is in flight must never end "Cancelled" + "Paid" with the money kept and no refund.
 * The capture records its result against the booking's CURRENT state: if the booking ended meanwhile, the captured money goes back
 * (the existing late-payment refund: one refund, one family notice, one provider notice).
 * The in-flight window is simulated deterministically: Stripe has captured (same idempotency key the app uses), the booking is cancelled,
 * and only then does the capture code finish recording (it holds the booking as it was read before the cancel).
 * Live Stripe TEST via the platform fallback; the connected-account path is NOT exercised.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { makeProvider, makeParent, makeListing, book, uniq, call, db, sleep, operatorAction, patchBooking, bookingDoc, type Provider, type Parent, type Listing } from "./helpers.mts";
import { stripe, payIntent } from "./_stack.mts";

let P: Provider, A: Parent, M: Listing;
before(async () => {
  P = await makeProvider("CICP"); A = await makeParent("CICA", P);
  M = await makeListing(P, `CIC manual ${uniq()}`, true);
});

/** A held card, approved (Confirmed) but not yet captured: what the approve transaction leaves a moment before the capture. */
async function approvedHold() {
  const ref = await book(A, M, { method: "card" });
  const co = await call("POST", "/api/payments/checkout", A.token, { refs: [ref], tenantId: P.tenantId });
  assert.equal(co.status, 201, JSON.stringify(co.json));
  const piId = String(co.json.clientSecret).split("_secret_")[0];
  await payIntent(piId);
  assert.equal((await call("POST", `/api/payments/checkout/${co.json.paymentId}/confirm`, A.token)).json.held, true);
  await patchBooking(P, ref, { status: "Confirmed" });
  const { fromDoc } = await import("../../server/src/lib/bookingDoc");
  const stale = fromDoc((await db.collection("bookings").doc(`${P.tenantId}_${ref}`).get()).data() as any);
  return { ref, payId: co.json.paymentId as string, piId, stale };
}
/** Capture the way the app does (same idempotency key), so the app's own capture call later gets the same answer. */
const captureAtStripe = (piId: string) => stripe.paymentIntents.capture(piId, { amount_to_capture: 2000 }, { idempotencyKey: `capture-${piId}-2000` });
async function finishCapture(stale: any) {
  const { captureHolds } = await import("../../server/src/lib/cardHold");
  return captureHolds([stale]);
}
async function refunds(piId: string) { return (await stripe.refunds.list({ payment_intent: piId })).data; }
async function notices(ref: string) {
  await sleep(2500);
  const n = (await db.collection("notifications").where("tenantId", "==", P.tenantId).get()).docs.map((d: any) => d.data()).filter((x: any) => x.ref === ref);
  return { family: n.filter((x: any) => x.audience === "parent" && /refunded/i.test(x.title)).length, provider: n.filter((x: any) => x.audience === "tenant" && /refunded automatically|needs refunding/i.test(x.title)).length };
}

describe("a cancel during the capture window", () => {
  it("provider cancels while the capture is in flight: not Cancelled+Paid; the money is refunded exactly once and each side is told once", async () => {
    const h = await approvedHold();
    await captureAtStripe(h.piId);
    assert.equal((await operatorAction(P, h.ref, { type: "cancel", refund: "none" })).status, 200);
    assert.equal((await bookingDoc(P, h.ref)).status, "Cancelled");
    assert.equal((await finishCapture(h.stale)).ok, true);
    await finishCapture(h.stale); // a repeat (double click / retry) changes nothing
    const b = await bookingDoc(P, h.ref);
    assert.equal(b.status, "Cancelled");
    assert.notEqual(b.pay, "Paid", `Cancelled but Paid: ${b.status}/${b.pay}`);
    const r = await refunds(h.piId);
    assert.equal(r.length, 1, `refunds: ${r.length}`);
    assert.equal(r[0].amount, 2000);
    assert.notEqual((await db.collection("payments").doc(h.payId).get()).get("status"), "succeeded");
    assert.deepEqual(await notices(h.ref), { family: 1, provider: 1 });
  });

  it("parent cancels while the capture is in flight: never Cancelled+Paid without a refund", async () => {
    const h = await approvedHold();
    await captureAtStripe(h.piId);
    const c = await call("POST", `/api/my/bookings/${encodeURIComponent(h.ref)}/cancel`, A.token, {});
    assert.ok(c.status < 300, `${c.status} ${JSON.stringify(c.json).slice(0, 300)}`);
    const mid = await bookingDoc(P, h.ref);
    assert.equal((await finishCapture(h.stale)).ok, true);
    const b = await bookingDoc(P, h.ref);
    const r = await refunds(h.piId);
    if (b.status === "Cancelled") {
      assert.notEqual(b.pay, "Paid", `Cancelled but Paid (was ${mid.status}/${mid.pay} after the cancel)`);
      assert.equal(r.length, 1, "cancelled -> the captured money goes back");
    } else {
      // The cancel was only a request awaiting the provider: the booking stays approved and Paid, the existing refund flow handles the request.
      assert.equal(b.pay, "Paid"); assert.equal(r.length, 0);
    }
  });

  it("control: nothing cancelled: Paid, no refund, one payment-received notice path as before", async () => {
    const h = await approvedHold();
    assert.equal((await finishCapture(h.stale)).ok, true);
    const b = await bookingDoc(P, h.ref);
    assert.equal(b.pay, "Paid"); assert.equal(b.status, "Confirmed");
    assert.equal((await refunds(h.piId)).length, 0);
    assert.equal((await db.collection("payments").doc(h.payId).get()).get("status"), "succeeded");
  });
});
