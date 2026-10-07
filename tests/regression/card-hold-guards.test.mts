import test from "node:test";
import assert from "node:assert/strict";
import { cardHeldBlocksPayment, isFirstHeldApproval, shouldAskToPayAfterApproval, shouldEmailConfirmed } from "../../server/src/lib/bookingGuards";

// D1: a held / not-yet-entered card can't have money recorded by hand against it.
test("D1 cardHeldBlocksPayment: held and awaiting block; captured, released, expired and ordinary bookings do not", () => {
  assert.equal(cardHeldBlocksPayment({ cardHold: { state: "held" } }), true);
  assert.equal(cardHeldBlocksPayment({ cardHold: { state: "awaiting" } }), true);
  for (const s of ["captured", "released", "expired"]) assert.equal(cardHeldBlocksPayment({ cardHold: { state: s } }), false);
  assert.equal(cardHeldBlocksPayment({}), false);
  assert.equal(cardHeldBlocksPayment(undefined), false);
});

// D4: only the first approval captures + announces.
test("D4 isFirstHeldApproval: a double click (already Confirmed) is not a first approval", () => {
  assert.equal(isFirstHeldApproval("approve", "Approval needed", { cardHold: { state: "held" } }), true);
  assert.equal(isFirstHeldApproval("approve", "Confirmed", { cardHold: { state: "held" } }), false);
  assert.equal(isFirstHeldApproval("approve", "Approval needed", { cardHold: { state: "captured" } }), false);
  assert.equal(isFirstHeldApproval("decline", "Approval needed", { cardHold: { state: "held" } }), false);
  // and the plain "booking confirmed" email also stays once-only
  assert.equal(shouldEmailConfirmed("approve", "Confirmed"), false);
});

// D3: the second child of a split hold is approved but unpaid -> ask to pay.
test("D3 shouldAskToPayAfterApproval: approved + hold lost + unpaid = ask to pay; paid / £0 / still held = no", () => {
  assert.equal(shouldAskToPayAfterApproval("approve", { status: "Confirmed", pay: "Unpaid", amount: 0.3, cardHold: { state: "released" } }), true);
  assert.equal(shouldAskToPayAfterApproval("approve", { status: "Confirmed", pay: "Paid", amount: 0.3, cardHold: { state: "released" } }), false);
  assert.equal(shouldAskToPayAfterApproval("approve", { status: "Confirmed", pay: "Funded", amount: 0, cardHold: { state: "released" } }), false);
  assert.equal(shouldAskToPayAfterApproval("approve", { status: "Confirmed", pay: "Paid", amount: 0.3, cardHold: { state: "captured" } }), false);
  assert.equal(shouldAskToPayAfterApproval("decline", { status: "Declined", pay: "Unpaid", amount: 0.3, cardHold: { state: "released" } }), false);
  assert.equal(shouldAskToPayAfterApproval("approve", { status: "Confirmed", pay: "Unpaid", amount: 0.3 }), false);
});
