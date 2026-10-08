// Integration money fixes, pure rules: releaseCap / releaseValue never hand back an extra twice; a declined refund takes its own "refunded" marks off.
import test from "node:test";
import assert from "node:assert/strict";
import { kidActiveDays, refundableSoFar, releaseCap, releaseValue } from "../../features/bookings/helpers";
import { stampAddonRefund, undoAddonStamps } from "../../features/bookings/addonRefund";
import { applyRowAction } from "../../features/bookings/mutations";
import type { Booking } from "../../features/bookings/types";

const days = (n: number) => Array.from({ length: n }, (_, i) => `2026-10-${String(18 + i).padStart(2, "0")}`);
const base = (o: Partial<Booking>): Booking => ({ ref: "R", booker: "B", email: "e", phone: "", child: "K", listing: "L", pass: "7", ticket: "", dates: "", sessions: [], status: "Confirmed", pay: "Paid", method: "Bank transfer", amount: 0, addons: [], answers: [], note: "", recon: null, evid: null, cancel: null, ...o }) as Booking;
const round2 = (n: number) => Math.round(n * 100) / 100;

test("nothing refunded yet: the cap equals the pro-rata share (no change for a plain booking)", () => {
  const b = base({ amount: 140, amountPaid: 140, kids: [{ name: "K", dates: days(7) }] });
  assert.equal(releaseValue(b, 0, days(3)), 60);
  assert.equal(releaseValue(b, 0), 140);
});

test("after a T-shirt (8) and one bottle day (3) were refunded, releasing 6 of 7 days is worth 135, not 144.86", () => {
  const b = base({
    amount: 158, amountPaid: 169, refundedApproved: 11, refundLog: [{ label: "Refund approved", amount: 11, on: "x", by: "P", source: "Card" }],
    kids: [{ name: "K", dates: days(7) }],
    addonLines: [{ child: "K", label: "Water bottle × 6", price: 18, days: [...days(7).filter((d) => d !== days(7)[2])], perDay: true, qty: 6 }],
  });
  assert.equal(refundableSoFar(b), 158);
  const six = days(7).slice(0, 6);
  assert.equal(releaseCap(b, [{ kid: b.kids![0], days: six }]), 135);
  assert.equal(releaseValue(b, 0, six), 135);
});

test("cancel-child after the child's own bottle was refunded is worth the pass (140), not 161", () => {
  const b = base({
    amount: 301, amountPaid: 322, refundedApproved: 21, refundLog: [{ label: "Refund approved", amount: 21, on: "x", by: "P", source: "Card" }],
    kids: [{ name: "A", dates: days(7) }, { name: "B", dates: days(7) }],
    addonLines: [{ child: "B", label: "Water bottle × 7", price: 21, days: days(7), perDay: true, qty: 7 }],
  });
  assert.equal(releaseValue(b, 0), 140);
  assert.equal(releaseValue(b, 1), 161, "the other child still has its bottle, it is part of its place");
});

test("a day a policy kept the money for does not raise the next day's price", () => {
  const b = base({ amount: 140, amountPaid: 140, kids: [{ name: "K", dates: days(7), cancelledDays: [days(7)[0]] }] });
  assert.equal(round2(releaseValue(b, 0, [days(7)[1]])), 20);
});

test("days are compared as ISO whether the kid stores labels or ISO", () => {
  const k = { name: "K", dates: ["Sun 18 Oct 2026", "Mon 19 Oct 2026", "Tue 20 Oct 2026"], cancelledDays: ["2026-10-19"] };
  assert.deepEqual(kidActiveDays(k), ["Sun 18 Oct 2026", "Tue 20 Oct 2026"]);
});

test("declining a pending refund takes off the 'refunded' marks that refund put on, and keeps the marks an earlier refund made", () => {
  const b = base({
    cancel: { on: "x", by: "P", refund: "full", amount: 28 },
    addonLines: [
      { child: "K", label: "T-shirt (Size: M)", price: 8, days: [], perDay: false },
      { child: "K", label: "Cap", price: 4, days: [], perDay: false, refunded: true },
    ],
  });
  stampAddonRefund(b, { scope: "whole" }, true, b.cancel);
  assert.deepEqual(b.addonLines!.map((l) => l.refunded), [true, true]);
  applyRowAction(b, "refund-decline");
  assert.deepEqual(b.addonLines!.map((l) => l.refunded), [undefined, true]);
  assert.equal(b.cancel!.addonUndo, undefined);
  undoAddonStamps(b); // nothing left to undo
  assert.deepEqual(b.addonLines!.map((l) => l.refunded), [undefined, true]);
});

test("approving keeps the marks", () => {
  const b = base({ cancel: { on: "x", by: "P", refund: "full", amount: 28 }, addonLines: [{ child: "K", label: "T-shirt (Size: M)", price: 8, days: [], perDay: false }] });
  stampAddonRefund(b, { scope: "whole" }, true, b.cancel);
  applyRowAction(b, "refund-approve");
  assert.equal(b.addonLines![0].refunded, true);
  assert.equal(b.cancel!.addonUndo, undefined);
});
