import test from "node:test";
import assert from "node:assert/strict";
import { isOwed, isStandaloneInvoiceIn, round2, ukDay, ukMonth } from "../../features/money/bookingIncome";
import { refundedGross } from "../../features/bookings/helpers";
import { payIndex, financeFigures } from "../../features/money/financeFigures";
import { takenThisWeekFigure, outstandingFigures } from "../../server/src/lib/dashboardFigures";

test("round2 removes float residue", () => {
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(round2(33.333333), 33.33);
});
test("float residue is never an owed amount", () => {
  assert.equal(isOwed(1e-12), false);
  assert.equal(isOwed(0.004), false);
  assert.equal(isOwed(0.01), true);
  const live = [{ ref: "A", status: "Confirmed", amount: 0.3, amountPaid: 0.1 + 0.2, pay: "Paid" }];
  assert.equal(outstandingFigures(live, "2026-10-07").outstanding, 0);
});
test("a payment split across bookings is rounded per booking", () => {
  const bks = [{ ref: "A", amount: 10 }, { ref: "B", amount: 20 }] as never[];
  const idx = payIndex(bks, [{ id: "p", refs: ["A", "B"], amount: 10, status: "succeeded", createdAt: "2026-10-01T10:00:00Z" }]);
  assert.equal(idx.byRef.get("A")![0].amount, 3.33);
  assert.equal(idx.byRef.get("B")![0].amount, 6.67);
});
test("dashboard taken-this-week rounds each share", () => {
  const pays = [
    { amount: 10, status: "succeeded", paidAt: "2026-10-05T10:00:00Z", refs: ["A", "B"] },
    { amount: 10, status: "succeeded", paidAt: "2026-10-05T11:00:00Z", refs: ["A", "B"] },
  ];
  assert.equal(takenThisWeekFigure(pays, "2026-10-01", new Set(), null, () => 1 / 3), 6.66);
});
test("UK day/month bucketing: 00:30 BST on the 1st belongs to the new month", () => {
  assert.equal(ukDay("2026-09-30T23:30:00.000Z"), "2026-10-01");
  assert.equal(ukMonth("2026-09-30T23:30:00.000Z"), "2026-10");
  assert.equal(ukMonth("2026-12-31T23:30:00.000Z"), "2026-12"); // GMT: no shift
  assert.equal(ukDay("2026-10-05"), "2026-10-05");
  assert.equal(ukDay(""), "");
});
test("finance figures bucket a 00:30 BST booking in the UK month", () => {
  const b = { ref: "A", status: "Confirmed", amount: 10, amountPaid: 10, pay: "Paid", createdAt: "2026-09-30T23:30:00.000Z" } as never;
  const r = financeFigures({ bookings: [b], payIdx: payIndex([b], []), months: 2, nowMs: Date.parse("2026-10-07T12:00:00Z"), season: "", venue: "", listingSeason: {}, listingVenue: {}, listingVenueId: {} });
  assert.equal(r.bookedByMonth.find((m) => m.label === "2026-10")!.value, 10);
  assert.equal(r.bookedByMonth.find((m) => m.label === "2026-09")!.value, 0);
});
test("a refund-approval log line of 0 does not suppress the cancellation amount", () => {
  const b = { ref: "A", amount: 10, amountPaid: 10, pay: "Refunded", cancel: { refund: "approved", amount: 10 }, refundLog: [{ label: "Refund approved", amount: 0 }] } as never;
  assert.equal(refundedGross(b), 10);
});
test("double count: a paid invoice that settled a booking is excluded from money in", () => {
  const invs = [
    { status: "paid", amount: 50, bookingSettledAt: "2026-10-01T09:00:00Z" },
    { status: "paid", amount: 20 },
    { status: "sent", amount: 99 },
  ];
  const counted = invs.filter(isStandaloneInvoiceIn);
  assert.equal(counted.reduce((s, v) => s + v.amount, 0), 20);
});
