import test from "node:test";
import assert from "node:assert/strict";
import { payErrorMessage, messageForState, RAW, type PayState } from "../../lib/payErrors";
import { isSessionExpiredFailure, SESSION_EXPIRED_TEXT } from "../../lib/authExpiry";
import { payStateOf } from "../../server/src/lib/payState";

// What a parent sees after a card payment fails (owner finding 9 Oct 2026: raw "A processing error occurred" and "invalid or expired token").

const processing = { type: "card_error", code: "processing_error", message: "An error occurred while processing your card. Try again in a little bit." };
const keyOf = (e: Parameters<typeof payErrorMessage>[0], s: PayState | null = "open") => payErrorMessage(e, s).key;

test("the booking's real state beats whatever Stripe said", () => {
  for (const e of [processing, { type: "invalid_request_error", code: "payment_intent_unexpected_state", message: "A processing error occurred" }, null]) {
    assert.equal(keyOf(e, "cancelled"), "p8lst.peCancelled");
    assert.equal(keyOf(e, "paid"), "p8lst.peAlreadyPaid");
    assert.equal(keyOf(e, "released"), "p8lst.peReleased");
    assert.equal(keyOf(e, "refunded"), "p8lst.pmRefunded");
    assert.equal(keyOf(e, "refunding"), "p8lst.pmRefunding");
    for (const s of ["cancelled", "paid", "released", "refunded", "refunding"] as PayState[]) assert.equal(payErrorMessage(e, s).final, true, s);
  }
  assert.equal(messageForState("open"), null);
  assert.equal(messageForState(null), null);
});

test("processing_error / payment_intent_unexpected_state on a payable booking: generic, never Stripe's words", () => {
  for (const e of [processing, { type: "invalid_request_error", code: "payment_intent_unexpected_state", message: "A processing error occurred" }, { message: "A processing error occurred" }, {}, null, undefined]) {
    for (const s of ["open", null] as const) {
      const m = payErrorMessage(e, s);
      assert.equal(m.key, "p8lst.peGeneric");
      assert.equal(m.params, undefined);
      assert.ok(!m.final);
    }
  }
});

test("real declines keep Stripe's reason and add 'try another card' (card_declined variants, expired_card, insufficient funds...)", () => {
  const declines = [
    { type: "card_error", code: "card_declined", decline_code: "generic_decline", message: "Your card was declined." },
    { type: "card_error", code: "card_declined", decline_code: "insufficient_funds", message: "Your card has insufficient funds." },
    { type: "card_error", code: "card_declined", decline_code: "lost_card", message: "Your card was declined." },
    { type: "card_error", code: "card_declined", decline_code: "stolen_card", message: "Your card was declined." },
    { type: "card_error", code: "card_declined", decline_code: "do_not_honor", message: "Your card was declined." },
    { type: "card_error", code: "card_declined", decline_code: "fraudulent", message: "Your card was declined." },
    { type: "card_error", code: "card_declined", message: "Your card was declined." },
    { type: "card_error", code: "expired_card", message: "Your card has expired." },
    { type: "card_error", code: "insufficient_funds", message: "Your card has insufficient funds." },
  ];
  for (const e of declines) {
    const m = payErrorMessage(e, "open");
    assert.equal(m.key, RAW, JSON.stringify(e));
    assert.equal(m.params?.text, e.message);
    assert.equal(m.retryNote, true);
  }
  // a decline with no text still gets a plain sentence
  assert.equal(keyOf({ type: "card_error", code: "card_declined" }), "p8lst.peDeclined");
});

test("card-entry mistakes show Stripe's own text, without the 'declined' tail", () => {
  for (const code of ["incomplete_number", "incomplete_cvc", "incomplete_expiry", "incomplete_zip", "invalid_number", "invalid_expiry_year", "invalid_cvc", "incorrect_number", "incorrect_zip"]) {
    const m = payErrorMessage({ type: "validation_error", code, message: "Your card number is incomplete." }, "open");
    assert.equal(m.key, RAW, code);
    assert.equal(m.params?.text, "Your card number is incomplete.");
    assert.ok(!m.retryNote, code);
  }
  const cvc = payErrorMessage({ type: "card_error", code: "incorrect_cvc", message: "Your card's security code is incorrect." }, "open");
  assert.equal(cvc.key, RAW);
  assert.equal(cvc.params?.text, "Your card's security code is incorrect.");
});

test("auth failure, rate limit, connection errors get their own plain sentence", () => {
  assert.equal(keyOf({ type: "invalid_request_error", code: "payment_intent_authentication_failure", message: "We are unable to authenticate your payment method." }), "p8lst.peAuthFailed");
  assert.equal(keyOf({ type: "card_error", code: "payment_method_authentication_failure" }), "p8lst.peAuthFailed");
  assert.equal(keyOf({ type: "api_error", code: "rate_limit", message: "Too many requests" }), "p8lst.peRateLimit");
  assert.equal(keyOf({ type: "rate_limit_error", message: "x" }), "p8lst.peRateLimit");
  assert.equal(keyOf({ type: "api_connection_error", message: "network" }), "p8lst.peConnection");
  assert.equal(keyOf({ code: "api_connection_error" }), "p8lst.peConnection");
});

test("unknown Stripe errors (api_error, invalid_request_error...) never leak their text", () => {
  for (const e of [{ type: "api_error", message: "Internal error 0xdeadbeef" }, { type: "invalid_request_error", code: "resource_missing", message: "No such payment_intent: pi_123" }, { type: "idempotency_error", message: "x" }]) {
    const m = payErrorMessage(e, "open");
    assert.equal(m.key, "p8lst.peGeneric");
    assert.equal(m.params, undefined);
  }
});

test("session expiry: the server's 401 token wording (and Firebase's) maps; other 401/403/500 do not", () => {
  assert.equal(SESSION_EXPIRED_TEXT, "Your session has expired. Please sign in again.");
  for (const m of ["Invalid or expired token", "invalid or expired token", "Missing Authorization bearer token", "Not signed in", "Firebase ID token has expired. Get a fresh ID token", "auth/id-token-expired", "Your session has expired"]) {
    assert.equal(isSessionExpiredFailure(401, m), true, m);
  }
  assert.equal(isSessionExpiredFailure(403, "Invalid or expired token"), false);
  assert.equal(isSessionExpiredFailure(500, "Invalid or expired token"), false);
  assert.equal(isSessionExpiredFailure(401, "Incorrect password"), false);
  assert.equal(isSessionExpiredFailure(409, "This booking was cancelled, so it can't be paid."), false);
  assert.equal(isSessionExpiredFailure(401, ""), false);
});

test("payStateOf (server): cancelled / declined / paid / released / refunded / open", () => {
  assert.equal(payStateOf({ status: "created" }, [{ status: "Cancelled", pay: "Unpaid" }]), "cancelled");
  assert.equal(payStateOf({ status: "created" }, [{ status: "Declined", pay: "Unpaid" }]), "cancelled");
  assert.equal(payStateOf({ status: "created" }, [{ status: "Confirmed", pay: "Unpaid" }, { status: "cancelled", pay: "Unpaid" }]), "cancelled");
  assert.equal(payStateOf({ status: "created" }, [{ status: "Confirmed", pay: "Paid" }]), "paid");
  assert.equal(payStateOf({ status: "created" }, [{ status: "Confirmed", pay: "Paid" }, { status: "Confirmed", pay: "Unpaid" }]), "open");
  assert.equal(payStateOf({ status: "released" }, [{ status: "Approval needed", pay: "Unpaid" }]), "released");
  assert.equal(payStateOf({ status: "duplicate-refunded", excess: { reason: "not-payable" } }, []), "refunded");
  assert.equal(payStateOf({ status: "duplicate-pending", excess: { reason: "not-payable" } }, []), "refunding");
  assert.equal(payStateOf({ status: "created" }, [{ status: "Confirmed", pay: "Unpaid" }]), "open");
});
