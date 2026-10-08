import test from "node:test";
import assert from "node:assert/strict";
import { refundAwaitingTransfer, refundTransferAmount } from "../../features/bookings/helpers";
import { archiveAwaitingRefund, settleShareRemoval } from "../../features/bookings/mutations";

// Refund entries: what is still to send is the sum of the offline entries not yet sent; an older booking with one approved-unsent cancel record
// still counts, and is kept as an entry before a newer refund replaces that record.

const legacy = (o: Record<string, unknown> = {}) => ({ ref: "APF-9", status: "Confirmed", pay: "Paid", amount: 100, amountPaid: 100, method: "Bank transfer", addons: [], addonLines: [], days: [],
  cancel: { on: "x", by: "Provider", refund: "approved", refundVia: "offline", refundTransfer: "awaiting", amount: 12, refundOnly: true }, refundedApproved: 12, ...o }) as any;

test("an older booking (single approved-unsent cancel record) still counts as awaiting its amount; sent or card does not", () => {
  assert.equal(refundAwaitingTransfer(legacy()), true); assert.equal(refundTransferAmount(legacy()), 12);
  assert.equal(refundAwaitingTransfer(legacy({ cancel: { ...legacy().cancel, refundTransfer: "sent" } })), false);
  assert.equal(refundAwaitingTransfer(legacy({ cancel: { ...legacy().cancel, refundVia: "card" } })), false);
});

test("entries: the total is the cash of every offline entry not sent; wallet / card / sent entries are not owed", () => {
  const b = legacy({ refundEntries: [
    { id: "1", amount: 3, cash: 3, via: "offline", status: "approved", approvedAt: "a" },
    { id: "2", amount: 6, cash: 6, via: "offline", status: "approved", approvedAt: "b" },
    { id: "3", amount: 5, cash: 0, via: "wallet", status: "sent", approvedAt: "c" },
    { id: "4", amount: 4, cash: 4, via: "offline", status: "sent", approvedAt: "d" },
  ] });
  assert.equal(refundTransferAmount(b), 9); assert.equal(refundAwaitingTransfer(b), true);
});

test("a newer refund replacing the cancel record keeps the older unsent one as an entry; settleShareRemoval does it", () => {
  const b = legacy();
  settleShareRemoval(b, "x", 20, { resolution: "refund" });
  assert.equal(b.cancel.refund, "pending");
  assert.equal(b.refundEntries.length, 1);
  assert.equal(refundTransferAmount(b), 12, "the 12 approved earlier is still owed while the new one waits");
  archiveAwaitingRefund(b); assert.equal(b.refundEntries.length, 1, "kept once");
});
