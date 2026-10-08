// The one rule for handing a discount code back (server/src/lib/bookingGuards.shouldReleaseDiscountCodes), as pure behaviour.
// The end-to-end behaviour (routes, sweep, concurrency) is covered by tests/emulator/ (npm run test:emu), which CI cannot run.
import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldReleaseDiscountCodes as rule } from "../../server/src/lib/bookingGuards";

const b = (o: Record<string, unknown>) => ({ amount: 18, ...o }) as Parameters<typeof rule>[0];

test("declined bookings give the code back; live ones do not", () => {
  assert.equal(rule(b({ status: "Declined" })), true);
  for (const status of ["Confirmed", "Approval needed", "Waitlisted", "Offered"]) assert.equal(rule(b({ status })), false, status);
});

test("cancelled and unpaid gives the code back", () => {
  assert.equal(rule(b({ status: "Cancelled", pay: "Unpaid" })), true);
  assert.equal(rule(b({ status: "Cancelled", pay: "Unpaid", cancel: { refund: "none" } })), true);
});

test("cancelled after payment: only a full refund gives the code back", () => {
  const paid = { status: "Cancelled", pay: "Paid", amountPaid: 18 };
  assert.equal(rule(b({ ...paid, cancel: { refund: "full", amount: 18 } })), true);
  assert.equal(rule(b({ ...paid, cancel: { refund: "partial", amount: 9 } })), false);
  assert.equal(rule(b({ ...paid, cancel: { refund: "none" } })), false);
  assert.equal(rule(b({ ...paid, cancel: { refund: "pending" } })), false);
});
