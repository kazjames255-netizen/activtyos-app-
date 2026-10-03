// Provider cancel -> "Refund pending" keeps the money counted until the refund is approved.
// Run: server/node_modules/.bin/tsx server/src/refundPendingTest.mts
import assert from "node:assert/strict";
import { applyCancel, applyRowAction } from "../../features/bookings/mutations";
import { collectedNet, refundedGross, receivedOf } from "../../features/bookings/helpers";

const mk = () => ({ ref: "APF-T", status: "Confirmed", pay: "Paid", amount: 20, amountPaid: 20, method: "Card" } as never as Parameters<typeof applyCancel>[0]);

const b = mk();
applyCancel(b, "full");
assert.equal(b.pay, "Refund pending");
assert.equal(receivedOf(b), 20);
assert.equal(refundedGross(b), 0);
assert.equal(collectedNet(b), 20);

applyRowAction(b, "refund-approve");
assert.equal(b.pay, "Refunded");
assert.equal(collectedNet(b), 0);

const d = mk();
applyCancel(d, "full");
applyRowAction(d, "refund-decline");
assert.equal(d.pay, "Paid");

// Legacy live shape (APF-24624): stamped Refunded at cancel time, refund never approved.
const legacy = mk();
applyCancel(legacy, "full");
legacy.pay = "Refunded";
assert.equal(collectedNet(legacy), 20);

console.log("refundPendingTest OK");
