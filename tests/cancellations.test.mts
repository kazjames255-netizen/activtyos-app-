/**
 * Cancellation / refund policy regression tests (pure: no network, no Firestore).
 * Oracle: lib/testTracker/catalogue.ts CN-* entries.
 *
 * Run:   npm run test:cancel
 *        (= tsx --test tests/cancellations.test.mts, using the tsx in server/node_modules)
 *
 * Covers: lib/cancellation.ts (refundFor, DEFAULT_POLICIES, policyById),
 *         features/bookings/helpers.ts (receivedOf, refundedGross, collectedNet,
 *         owedOf, paidSoFar, refundableSoFar),
 *         features/bookings/mutations.ts (applyCancel, applyRowAction,
 *         applyCancelDay, applyCancelChild, applyPartialCancel, applyParentCancel).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { refundFor, DEFAULT_POLICY, DEFAULT_POLICIES, policyById, type CancellationPolicy } from "../lib/cancellation";
import { receivedOf, refundedGross, collectedNet, owedOf, paidSoFar, refundableSoFar } from "../features/bookings/helpers";
import { applyCancel, applyRowAction, applyCancelDay, applyCancelChild, applyPartialCancel, applyParentCancel } from "../features/bookings/mutations";
import type { Booking } from "../features/bookings/types";

const bk = (over: Record<string, unknown>) => over as unknown as Booking;
const policy = (id: string): CancellationPolicy => policyById(DEFAULT_POLICIES, id)!;
// Notice is counted from midnight (UTC) at the start of the first session date.
const refund = (p: CancellationPolicy, first: string, paid: number, now: string, by: "parent" | "provider" = "parent") =>
  refundFor(p, first, paid, now, by)!;

test("Standard policy bands (CN-001/002/003, AMI-24627)", async (t) => {
  await t.test("CN-001: 12 days out = 100% of £54", () => {
    const r = refund(DEFAULT_POLICY, "2026-10-05", 54, "2026-09-23T10:00:00Z");
    assert.equal(r.percent, 100);
    assert.equal(r.amount, 54);
  });
  await t.test("exactly 168h (1 week) out is still 100%", () => {
    assert.equal(refund(DEFAULT_POLICY, "2026-10-05", 54, "2026-09-28T00:00:00Z").amount, 54);
  });
  await t.test("one hour short of a week drops to 50%", () => {
    assert.equal(refund(DEFAULT_POLICY, "2026-10-05", 54, "2026-09-28T01:00:00Z").amount, 27);
  });
  await t.test("CN-002: 4 days out = 50% = £27", () => {
    const r = refund(DEFAULT_POLICY, "2026-10-05", 54, "2026-10-01T00:00:00Z");
    assert.equal(r.percent, 50);
    assert.equal(r.amount, 27);
  });
  await t.test("exactly 48h out is still 50%; 47h is none", () => {
    assert.equal(refund(DEFAULT_POLICY, "2026-10-05", 54, "2026-10-03T00:00:00Z").amount, 27);
    assert.equal(refund(DEFAULT_POLICY, "2026-10-05", 54, "2026-10-03T01:00:00Z").amount, 0);
  });
  await t.test("CN-003 / AMI-24627: starts Mon 5 Oct, cancelled Sat 3 Oct afternoon = none", () => {
    const r = refund(DEFAULT_POLICY, "2026-10-05", 54, "2026-10-03T14:30:00Z");
    assert.equal(r.percent, 0);
    assert.equal(r.amount, 0);
  });
  await t.test("1 day out and after the start both give nothing", () => {
    assert.equal(refund(DEFAULT_POLICY, "2026-10-05", 54, "2026-10-04T00:00:00Z").amount, 0);
    assert.equal(refund(DEFAULT_POLICY, "2026-10-05", 54, "2026-10-06T09:00:00Z").amount, 0);
  });
  await t.test("penny-safe half: £37.55 at 50% = £18.78 (rounds up, not £18.77)", () => {
    assert.equal(refund(DEFAULT_POLICY, "2026-10-05", 37.55, "2026-10-01T00:00:00Z").amount, 18.78);
  });
});

test("Other policies at 72h notice (CN-014)", async (t) => {
  const now = "2026-10-02T00:00:00Z"; // 72h before Mon 5 Oct
  await t.test("Flexible = 100% (£54)", () => assert.equal(refund(policy("flexible"), "2026-10-05", 54, now).amount, 54));
  await t.test("Standard = 50% (£27)", () => assert.equal(refund(policy("standard"), "2026-10-05", 54, now).amount, 27));
  await t.test("Strict = 0", () => assert.equal(refund(policy("strict"), "2026-10-05", 54, now).amount, 0));
  await t.test("No refunds = 0", () => assert.equal(refund(policy("none"), "2026-10-05", 54, now).amount, 0));
  await t.test("Strict: 14 days = 100%, 8 days = 50%", () => {
    assert.equal(refund(policy("strict"), "2026-10-15", 54, "2026-10-01T00:00:00Z").amount, 54);
    assert.equal(refund(policy("strict"), "2026-10-09", 54, "2026-10-01T00:00:00Z").amount, 27);
  });
  await t.test("No refunds gives nothing even 60 days out", () => {
    assert.equal(refund(policy("none"), "2026-12-05", 54, "2026-10-03T00:00:00Z").amount, 0);
  });
  await t.test("Flexible: 24h met, 23h not", () => {
    assert.equal(refund(policy("flexible"), "2026-10-05", 54, "2026-10-04T00:00:00Z").amount, 54);
    assert.equal(refund(policy("flexible"), "2026-10-05", 54, "2026-10-04T01:00:00Z").amount, 0);
  });
});

test("refundFor edge cases", async (t) => {
  await t.test("CN-016: provider cancelling refunds 100% inside the no-refund window", () => {
    const r = refund(DEFAULT_POLICY, "2026-10-05", 54, "2026-10-04T20:00:00Z", "provider");
    assert.equal(r.amount, 54);
    assert.equal(r.percent, 100);
  });
  await t.test("provider cancel ignores the No refunds policy", () => {
    assert.equal(refund(policy("none"), "2026-10-05", 54, "2026-10-04T20:00:00Z", "provider").amount, 54);
  });
  await t.test("CN-012: nothing paid = £0", () => {
    assert.equal(refund(DEFAULT_POLICY, "2026-10-05", 0, "2026-09-23T00:00:00Z").amount, 0);
  });
  await t.test("returns null (not a confident zero) for a missing date, bad date or missing amount", () => {
    assert.equal(refundFor(DEFAULT_POLICY, undefined, 54, "2026-10-03T00:00:00Z"), null);
    assert.equal(refundFor(DEFAULT_POLICY, "05/10/2026", 54, "2026-10-03T00:00:00Z"), null);
    assert.equal(refundFor(DEFAULT_POLICY, "2026-10-05", undefined, "2026-10-03T00:00:00Z"), null);
  });
  await t.test("policyById falls back to the first policy for an unknown id", () => {
    assert.equal(policyById(DEFAULT_POLICIES, "deleted")?.id, "standard");
    assert.equal(policyById([], "x"), null);
  });
});

test("paidSoFar / refundableSoFar (CN-013)", async (t) => {
  await t.test("CN-013: card £44 + wallet £10 on a £44 amount = £54 paid and refundable", () => {
    const b = bk({ pay: "Paid", amount: 44, amountPaid: 44, walletApplied: 10 });
    assert.equal(paidSoFar(b), 54);
    assert.equal(refundableSoFar(b), 54);
    assert.equal(refund(DEFAULT_POLICY, "2026-10-05", refundableSoFar(b), "2026-09-23T00:00:00Z").amount, 54);
  });
  await t.test("part-paid (£150 of £200) counts only what was handed over", () => {
    assert.equal(paidSoFar(bk({ pay: "Part paid", amount: 200, amountPaid: 150 })), 150);
  });
  await t.test("unpaid booking has nothing to refund", () => {
    assert.equal(refundableSoFar(bk({ pay: "Unpaid", amount: 54, amountPaid: 0 })), 0);
  });
  await t.test("joint sibling booking Paid with amountPaid 0 still counts the amount", () => {
    assert.equal(paidSoFar(bk({ pay: "Paid", amount: 54, amountPaid: 0 })), 54);
  });
  await t.test("earlier refunds (log + approved total) are taken off, never refunded twice", () => {
    const b = bk({ pay: "Paid", amount: 200, amountPaid: 200, refundLog: [{ label: "Released day", amount: 40 }], refundedApproved: 10 });
    assert.equal(refundableSoFar(b), 150);
  });
  await t.test("never negative", () => {
    assert.equal(refundableSoFar(bk({ pay: "Paid", amount: 20, amountPaid: 20, refundLog: [{ label: "x", amount: 25 }] })), 0);
  });
});

test("Net money: receivedOf / refundedGross / collectedNet / owedOf", async (t) => {
  await t.test("paid £20 then refunded £10 nets £10", () => {
    const b = bk({ pay: "Partially refunded", amount: 20, amountPaid: 20, refundLog: [{ label: "Partial refund", amount: 10 }] });
    assert.equal(receivedOf(b), 20);
    assert.equal(refundedGross(b), 10);
    assert.equal(collectedNet(b), 10);
  });
  await t.test("fully refunded booking nets £0", () => {
    const b = bk({ pay: "Refunded", amount: 54, amountPaid: 54, status: "Cancelled",
      cancel: { refund: "approved", amount: 54 }, refundLog: [] });
    assert.equal(refundedGross(b), 54);
    assert.equal(collectedNet(b), 0);
  });
  await t.test("approved refund already in the log is not subtracted twice (kept £10, not £0)", () => {
    const b = bk({ pay: "Partially refunded", amount: 20, amountPaid: 20, status: "Cancelled",
      cancel: { refund: "approved", amount: 10 }, refundLog: [{ label: "Refund approved - 10", amount: 10 }] });
    assert.equal(refundedGross(b), 10);
    assert.equal(collectedNet(b), 10);
  });
  await t.test("Refund pending: money stays counted until approved", () => {
    const b = bk({ pay: "Refund pending", amount: 54, amountPaid: 54, status: "Cancelled",
      cancel: { refund: "full", amount: 54 }, refundLog: [] });
    assert.equal(receivedOf(b), 54);
    assert.equal(refundedGross(b), 0);
    assert.equal(collectedNet(b), 54);
  });
  await t.test("legacy booking stamped Refunded but with refund still 'pending' is not counted refunded", () => {
    const b = bk({ pay: "Refunded", amount: 54, amountPaid: 54, status: "Cancelled", cancel: { refund: "pending", amount: 0 } });
    assert.equal(refundedGross(b), 0);
    assert.equal(collectedNet(b), 54);
  });
  await t.test("receivedOf uses full amount for paid states with no amountPaid, 0 for unpaid", () => {
    assert.equal(receivedOf(bk({ pay: "Paid", amount: 54 })), 54);
    assert.equal(receivedOf(bk({ pay: "Refund pending", amount: 54 })), 54);
    assert.equal(receivedOf(bk({ pay: "Unpaid", amount: 54 })), 0);
  });
  await t.test("owedOf: part-paid owes the balance, fully paid owes 0", () => {
    assert.equal(owedOf(bk({ pay: "Part paid", amount: 200, amountPaid: 150 })), 50);
    assert.equal(owedOf(bk({ pay: "Paid", amount: 54, amountPaid: 54 })), 0);
  });
});

test("Whole-booking cancel flow (provider side, CN-006/007/015/017)", async (t) => {
  const paid54 = () => bk({ pay: "Paid", status: "Confirmed", amount: 54, amountPaid: 54, refundLog: [] });
  await t.test("applyCancel full: Refund pending, amount = everything paid, money still counted", () => {
    const b = paid54();
    applyCancel(b, "full");
    assert.equal(b.status, "Cancelled");
    assert.equal(b.pay, "Refund pending");
    assert.equal(b.cancel!.amount, 54);
    assert.equal(collectedNet(b), 54);
  });
  await t.test("CN-006: approving flips to Refunded and nets £0", () => {
    const b = paid54();
    applyCancel(b, "full");
    applyRowAction(b, "refund-approve");
    assert.equal(b.pay, "Refunded");
    assert.equal(collectedNet(b), 0);
  });
  await t.test("CN-007: declining returns to Paid, no money moves", () => {
    const b = paid54();
    applyCancel(b, "full");
    applyRowAction(b, "refund-decline");
    assert.equal(b.pay, "Paid");
    assert.equal(b.cancel!.refund, "declined");
    assert.equal(collectedNet(b), 54);
  });
  await t.test("CN-017: partial £20 refunds £20; capped at what was paid", () => {
    const b = paid54();
    applyCancel(b, "partial", 20);
    assert.equal(b.cancel!.amount, 20);
    const c = paid54();
    applyCancel(c, "partial", 500);
    assert.equal(c.cancel!.amount, 54);
  });
  await t.test("refund 'none' leaves pay unchanged", () => {
    const b = paid54();
    applyCancel(b, "none");
    assert.equal(b.pay, "Paid");
    assert.equal(b.cancel!.amount, 0);
  });
  await t.test("CN-012: cancelling an unpaid booking refunds £0 and stays unpaid", () => {
    const b = bk({ pay: "Unpaid", status: "Confirmed", amount: 54, amountPaid: 0 });
    applyCancel(b, "full");
    assert.equal(b.cancel!.amount, 0);
    assert.equal(b.pay, "Unpaid");
  });
  await t.test("applyCancel full after an earlier £18 day refund only refunds the remaining £36", () => {
    const b = bk({ pay: "Partially refunded", status: "Confirmed", amount: 54, amountPaid: 54, refundLog: [{ label: "day", amount: 18 }] });
    applyCancel(b, "full");
    assert.equal(b.cancel!.amount, 36);
  });
  await t.test("parent request starts as pending and money is still counted", () => {
    const b = paid54();
    applyParentCancel(b);
    assert.equal(b.cancel!.refund, "pending");
    assert.equal(collectedNet(b), 54);
  });
});

test("Partial per-day cancellations (CN-019/020/021/022)", async (t) => {
  const threeDay = (amount: number, paid: number) =>
    bk({ pay: "Paid", status: "Confirmed", amount, amountPaid: paid, refundLog: [],
      days: ["2026-10-05", "2026-10-06", "2026-10-07"],
      kids: [{ name: "Ami", dates: ["2026-10-05", "2026-10-06", "2026-10-07"] }] });

  await t.test("CN-020: provider cancels 1 of 3 days on £54 = £18 and booking is Partially refunded", () => {
    const b = threeDay(54, 54);
    applyCancelDay(b, 0, "2026-10-05");
    assert.equal(b.refundLog![0].amount, 18);
    assert.equal(b.pay, "Partially refunded");
    assert.equal(collectedNet(b), 36);
  });
  await t.test("discounted booking: one day refunds a third of the DISCOUNTED £44, not list £54", () => {
    const b = threeDay(44, 44);
    applyCancelDay(b, 0, "2026-10-05");
    assert.equal(b.refundLog![0].amount, 14.67);
    assert.notEqual(b.refundLog![0].amount, 18);
  });
  await t.test("cancelling the same day twice does not refund twice", () => {
    const b = threeDay(54, 54);
    applyCancelDay(b, 0, "2026-10-05");
    applyCancelDay(b, 0, "2026-10-05");
    assert.equal(b.refundLog!.length, 1);
  });
  await t.test("cancelling all three days refunds in full, status Cancelled, nets £0", () => {
    const b = threeDay(54, 54);
    for (const d of b.days!) applyCancelDay(b, 0, d);
    assert.equal(b.status, "Cancelled");
    assert.equal(b.pay, "Refunded");
    assert.equal(collectedNet(b), 0);
  });
  await t.test("CN-019: cancelling one of two children refunds half and leaves the other", () => {
    const b = bk({ pay: "Paid", status: "Confirmed", amount: 108, amountPaid: 108, refundLog: [],
      kids: [{ name: "A", dates: ["2026-10-05", "2026-10-06"] }, { name: "B", dates: ["2026-10-05", "2026-10-06"] }] });
    applyCancelChild(b, 0);
    assert.equal(b.refundLog![0].amount, 54);
    assert.equal(b.status, "Confirmed");
    assert.equal(b.pay, "Partially refunded");
  });
  await t.test("CN-021/022: parent per-day value is paid / booked child-days, each day through the policy on its OWN date", () => {
    const b = bk({ pay: "Paid", amount: 54, amountPaid: 54, walletApplied: 0 });
    const perSlot = Math.round((paidSoFar(b) / 3) * 100) / 100;
    assert.equal(perSlot, 18);
    const now = "2026-10-01T00:00:00Z";
    assert.equal(refund(DEFAULT_POLICY, "2026-10-20", perSlot, now).amount, 18); // > 1 week out
    assert.equal(refund(DEFAULT_POLICY, "2026-10-02", perSlot, now).amount, 0); // 24h out
  });
  await t.test("CN-021: wallet release value counts wallet credit paid (£44 card + £10 wallet over 3 days = £18)", () => {
    const b = bk({ pay: "Paid", amount: 44, amountPaid: 44, walletApplied: 10 });
    assert.equal(Math.round((paidSoFar(b) / 3) * 100) / 100, 18);
  });
  await t.test("applyPartialCancel: amount unchanged, released day leaves days, last day cancels booking", () => {
    const b = threeDay(54, 54);
    applyPartialCancel(b, [{ childKey: "Ami", days: ["2026-10-05"] }]);
    assert.equal(b.amount, 54);
    assert.deepEqual(b.days, ["2026-10-06", "2026-10-07"]);
    assert.equal(b.status, "Confirmed");
    applyPartialCancel(b, [{ childKey: "Ami", days: ["2026-10-06", "2026-10-07"] }]);
    assert.equal(b.status, "Cancelled");
  });
  await t.test("release value is capped at what is still refundable (no £240 back on a £200 booking)", () => {
    const b = bk({ pay: "Paid", amount: 200, amountPaid: 200, refundLog: [{ label: "Released", amount: 40 }] });
    assert.equal(Math.min(refundableSoFar(b), 200), 160);
  });
});
