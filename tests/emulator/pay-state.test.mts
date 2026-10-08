/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Pay screen, owner finding 9 Oct: a parent typed card details, the provider cancelled the booking, the parent pressed Pay and saw
 * Stripe's "A processing error occurred" (the cancel path had cancelled the open PaymentIntent). The screen now asks
 * GET /api/payments/checkout/:id/state after any failure and says the TRUE reason. This asserts what that endpoint answers.
 * Local emulator stack + Stripe TEST only (npm run test:emu).
 */
import test, { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { makeProvider, makeParent, makeListing, book, uniq, call, sleep, operatorAction, patchBooking, type Provider, type Parent, type Listing } from "./helpers.mts";
import { stripe } from "./_stack.mts";

let P: Provider, A: Parent, B: Parent, L: Listing;
before(async () => {
  P = await makeProvider("PSP"); A = await makeParent("PSA", P); B = await makeParent("PSB", P);
  L = await makeListing(P, `PS camp ${uniq()}`, false);
});

const start = (ref: string, who: Parent = A) => call("POST", "/api/payments/checkout", who.token, { refs: [ref], tenantId: P.tenantId });
const state = (id: string, who: Parent = A) => call("GET", `/api/payments/checkout/${id}/state`, who.token);

describe("the state the Pay screen reads after a card error", () => {
  it("open while the booking can still be paid", async () => {
    const ref = await book(A, L, { method: "card" });
    const c = await start(ref);
    assert.equal(c.status, 201, JSON.stringify(c.json));
    const s = await state(c.json.paymentId);
    assert.equal(s.status, 200);
    assert.equal(s.json.state, "open");
  });

  it("cancelled once the provider cancels while the card form is open (PaymentIntent cancelled under it), and confirm cannot take money", async () => {
    const ref = await book(A, L, { method: "card" });
    const c = await start(ref);
    assert.equal(c.status, 201, JSON.stringify(c.json));
    const piId = String(c.json.clientSecret).split("_secret_")[0];
    assert.equal((await operatorAction(P, ref, { type: "cancel", refund: "none" })).status, 200);
    // the cancel path cancels the open intent shortly after (best effort, background)
    for (let i = 0; i < 20; i++) { if ((await stripe.paymentIntents.retrieve(piId)).status === "canceled") break; await sleep(500); }
    assert.equal((await stripe.paymentIntents.retrieve(piId)).status, "canceled", "Stripe would now refuse the confirm: 'A processing error occurred'");
    const s = await state(c.json.paymentId);
    assert.equal(s.json.state, "cancelled");
    const conf = await call("POST", `/api/payments/checkout/${c.json.paymentId}/confirm`, A.token, {});
    assert.notEqual(conf.json?.paid, true, "nothing is reported as paid");
    // and the screen cannot start a fresh payment for it either: the reworded 409
    const again = await start(ref);
    assert.equal(again.status, 409);
    assert.equal(again.json.error, "This booking was cancelled, so it can't be paid.");
  });

  it("paid once the booking is settled some other way", async () => {
    const ref = await book(A, L, { method: "card" });
    const c = await start(ref);
    assert.equal(c.status, 201);
    await patchBooking(P, ref, { pay: "Paid", amountPaid: 1000 });
    assert.equal((await state(c.json.paymentId)).json.state, "paid");
  });

  it("only the paying family can ask", async () => {
    const ref = await book(A, L, { method: "card" });
    const c = await start(ref);
    assert.equal((await state(c.json.paymentId, B)).status, 404);
    assert.equal((await call("GET", `/api/payments/checkout/${c.json.paymentId}/state`, null)).status, 401);
  });

  it("an expired / bad token is a 401 'Invalid or expired token' (what lib/api.ts turns into 'Your session has expired')", async () => {
    const r = await call("GET", "/api/payments/checkout/x/state", "not-a-real-token");
    assert.equal(r.status, 401);
    assert.match(String(r.json.error), /invalid or expired token/i);
  });
});
