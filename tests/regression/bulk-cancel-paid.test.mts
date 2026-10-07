import test from "node:test";
import assert from "node:assert/strict";
import { blocksBulkCancel } from "../../server/src/lib/bulkCancelRules";

// QA-C D2: bulk-cancelling PAID bookings kept the money and told the family "No refund".
const b = (o: Record<string, unknown>) => ({ status: "Confirmed", pay: "Unpaid", amount: 0.3, ...o }) as any;

test("a paid booking is not bulk-cancellable (needs a refund decision)", () => {
  assert.equal(blocksBulkCancel(b({ pay: "Paid", amountPaid: 0.3 })), true);
  assert.equal(blocksBulkCancel(b({ pay: "Paid" })), true);
});
test("part-paid, wallet-funded and refund-pending bookings are blocked too", () => {
  assert.equal(blocksBulkCancel(b({ pay: "Partially paid", amountPaid: 0.1 })), true);
  assert.equal(blocksBulkCancel(b({ walletApplied: 0.3 })), true);
  assert.equal(blocksBulkCancel(b({ pay: "Refund pending" })), true);
});
test("unpaid, held-card, waitlisted, already cancelled or refunded bookings can still be bulk-cancelled", () => {
  assert.equal(blocksBulkCancel(b({})), false);
  assert.equal(blocksBulkCancel(b({ status: "Approval needed", cardHold: { state: "held", amount: 0.3 } })), false);
  assert.equal(blocksBulkCancel(b({ status: "Cancelled", pay: "Paid" })), false);
  assert.equal(blocksBulkCancel(b({ pay: "Refunded" })), false);
});
