/**
 * Finance regression tests (pure: no network, no Firestore, no Firebase).
 * Oracle: lib/testTracker/catalogue.ts areas FD-* (finance/dashboard) and PY-* (payments).
 *
 * Run:   npm run test:finance
 *        (= tsx --test tests/finance.test.mts, using the tsx in server/node_modules)
 *
 * Covers: features/bookings/helpers.ts (receivedOf / refundedGross / collectedNet / owedNow / isMoneyIn),
 *         features/money/bookingIncome.ts (Income tab + Money-in hero rule),
 *         features/money/financeFigures.ts (Finance & analytics page),
 *         server/src/lib/dashboardFigures.ts (Dashboard: Outstanding, Taken this week, per-day capacity),
 *         server/src/lib/invoiceMath.ts (invoice totals/VAT/status/overdue),
 *         server/src/lib/reconcileMath.ts (server/tools/reconcile.ts core).
 *
 * Fixtures are the real bookings from the 3 Oct 2026 co-test (refs AMI-* and AC-*).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { collectedNet, isMoneyIn, owedNow, owedOf, receivedOf, refundedGross, money, holdsPlace } from "../features/bookings/helpers";
import { bookingNetIn } from "../features/money/bookingIncome";
import { financeFigures, payIndex, type PaymentRecord } from "../features/money/financeFigures";
import { outstandingFigures, takenThisWeekFigure, isGoneRefund, addRunToListing, round2, type BkLite, type PayLite, type ListingOcc } from "../server/src/lib/dashboardFigures";
import { grandTotal, subtotalOf, isOverdue, statusAfterEmail, invoiceSummary } from "../server/src/lib/invoiceMath";
import { reconcileBooking } from "../server/src/lib/reconcileMath";
import { blockSummary, type BlockDoc } from "../server/src/lib/blockDomain";
import type { Booking } from "../features/bookings/types";

const bk = (o: Record<string, unknown>): Booking => ({
  bid: "", addons: [], answers: [], note: "", recon: null, evid: null, cancel: null, status: "Confirmed", pay: "Unpaid", amount: 0,
  createdAt: "2026-10-01", ...o,
} as unknown as Booking);

// ── Real fixtures ──────────────────────────────────────────────────────────
const AMI_24639 = bk({ ref: "AMI-24639", amount: 81, pay: "Paid", amountPaid: 81, method: "Card" });
const AMI_24630 = bk({ ref: "AMI-24630", amount: 20, pay: "Partially refunded", amountPaid: 20, method: "Card", refundLog: [{ label: "Refund — day released", amount: 10, on: "2026-10-02", by: "Amir" }] });
const AMI_24643 = bk({ ref: "AMI-24643", amount: 10, status: "Cancelled", pay: "Refunded", amountPaid: 10, method: "Cash", cancel: { on: "2026-10-02", by: "Amir", refund: "approved", amount: 10 } });
const AMI_24647_AWAITING = bk({ ref: "AMI-24647", amount: 10, pay: "Awaiting voucher payment", voucherScheme: "Edenred", voucherReceiveBy: "2026-10-20" });
const AMI_24647_RECEIVED = bk({ ref: "AMI-24647", amount: 10, pay: "Paid", amountPaid: 10, voucherScheme: "Edenred" });
const AMI_24646_FUNDED = bk({ ref: "AMI-24646", amount: 0, pay: "Funded", method: "HAF (funded £0)" });
const AC_3101 = bk({ ref: "AC-3101", amount: 180, pay: "Unpaid" });
const AC_3103 = bk({ ref: "AC-3103", amount: 120, pay: "Part paid", amountPaid: 60 });
const AC_3104 = bk({ ref: "AC-3104", amount: 72, pay: "Awaiting voucher payment", voucherScheme: "Edenred", voucherReceiveBy: "2026-09-30" });
const AC_3105 = bk({ ref: "AC-3105", amount: 48, pay: "Awaiting voucher payment", voucherScheme: "Edenred", voucherReceiveBy: "2026-10-30" });
const OWING = [AC_3101, AC_3103, AC_3104, AC_3105];

test("FD-001/FD-029: paid card booking everywhere", async (t) => {
  await t.test("AMI-24639 £81 paid: received 81, refunded 0, net 81, owes nothing", () => {
    assert.equal(receivedOf(AMI_24639), 81);
    assert.equal(refundedGross(AMI_24639), 0);
    assert.equal(collectedNet(AMI_24639), 81);
    assert.equal(owedNow(AMI_24639), 0);
  });
  await t.test("a booking marked Paid with no amountPaid still counts its full amount as received", () => {
    assert.equal(receivedOf(bk({ amount: 54, pay: "Paid" })), 54);
  });
  await t.test("Income tab / Money-in hero rule agrees with collectedNet", () => {
    assert.deepEqual(bookingNetIn(AMI_24639), { got: 81, back: 0, net: 81 });
  });
});

test("FD-006/FD-007: refunds are net, never double counted", async (t) => {
  await t.test("AMI-24630 £20 paid then £10 refunded: net £10", () => {
    assert.equal(receivedOf(AMI_24630), 20);
    assert.equal(refundedGross(AMI_24630), 10);
    assert.equal(collectedNet(AMI_24630), 10);
    assert.deepEqual(bookingNetIn(AMI_24630), { got: 20, back: 10, net: 10 });
  });
  await t.test("AMI-24643 £10 cash cancelled and refunded: net £0, owes nothing", () => {
    assert.equal(refundedGross(AMI_24643), 10);
    assert.equal(collectedNet(AMI_24643), 0);
    assert.equal(owedNow(AMI_24643), 0);
  });
  await t.test("approved cancellation refund WITH a 'Refund approved' log line counts once, not twice", () => {
    const b = bk({ ref: "X-1", amount: 20, status: "Cancelled", pay: "Partially refunded", amountPaid: 20,
      cancel: { on: "2026-10-02", by: "Amir", refund: "approved", amount: 10 },
      refundLog: [{ label: "Refund approved — cancellation", amount: 10, on: "2026-10-02", by: "Amir" }] });
    assert.equal(refundedGross(b), 10);
    assert.equal(collectedNet(b), 10);
  });
  await t.test("cancel.amount with NO log line is counted once (and not when only requested)", () => {
    const approved = bk({ amount: 20, status: "Cancelled", pay: "Refunded", amountPaid: 20, cancel: { on: "x", by: "y", refund: "approved", amount: 20 } });
    assert.equal(refundedGross(approved), 20);
    const pending = bk({ amount: 20, status: "Cancelled", pay: "Refund pending", amountPaid: 20, cancel: { on: "x", by: "y", refund: "pending", amount: 20 } });
    assert.equal(refundedGross(pending), 0);
    assert.equal(collectedNet(pending), 20, "money has not moved yet, so it is still income");
  });
  await t.test("refunding more than was received never drives net below zero", () => {
    const b = bk({ amount: 10, pay: "Refunded", amountPaid: 10, refundLog: [{ label: "a", amount: 7, on: "x", by: "y" }, { label: "b", amount: 7, on: "x", by: "y" }] });
    assert.equal(collectedNet(b), 0);
    assert.equal(bookingNetIn(b).net, 0);
    assert.equal(bookingNetIn(b).back, 10, "the refunded part shown is capped at what came in");
  });
});

test("FD-009/PY-015: voucher awaiting vs received (unpaid money is never income)", async (t) => {
  await t.test("AMI-24647 awaiting: received 0, net 0, owes £10", () => {
    assert.equal(receivedOf(AMI_24647_AWAITING), 0);
    assert.equal(collectedNet(AMI_24647_AWAITING), 0);
    assert.equal(owedNow(AMI_24647_AWAITING), 10);
  });
  await t.test("AMI-24647 received: income £10, owes £0", () => {
    assert.equal(collectedNet(AMI_24647_RECEIVED), 10);
    assert.equal(owedNow(AMI_24647_RECEIVED), 0);
  });
  await t.test("unpaid bookings contribute nothing to income, whatever their price", () => {
    for (const b of OWING.filter((x) => !x.amountPaid)) {
      assert.equal(collectedNet(b), 0, b.ref);
      assert.equal(bookingNetIn(b).net, 0, b.ref);
    }
  });
});

test("PY-017/PY-037/FD-011: Funded £0 place", () => {
  assert.equal(receivedOf(AMI_24646_FUNDED), 0);
  assert.equal(collectedNet(AMI_24646_FUNDED), 0);
  assert.equal(owedNow(AMI_24646_FUNDED), 0, "a £0 funded place owes nothing");
  assert.equal(money(0), "£0.00");
});

test("PY-023: part-paid booking", () => {
  assert.equal(receivedOf(AC_3103), 60);
  assert.equal(owedOf(AC_3103), 60);
  assert.equal(owedNow(AC_3103), 60);
  assert.equal(collectedNet(AC_3103), 60);
});

test("FD-002/FD-012/FD-013: Outstanding = confirmed bookings still owing", async (t) => {
  await t.test("owedNow per real booking", () => {
    assert.deepEqual(OWING.map(owedNow), [180, 60, 72, 48]);
  });
  await t.test("dashboard Outstanding for AC-3101/3103/3104/3105 = £360", () => {
    assert.equal(outstandingFigures(OWING as unknown as BkLite[], "2026-10-03").outstanding, 360);
  });
  await t.test("excludes Approval needed, Waitlisted, Offered, Cancelled, Declined (same price, unpaid)", () => {
    for (const status of ["Approval needed", "Waitlisted", "Offered", "Cancelled", "Declined"]) {
      const b = bk({ ref: "Z", amount: 100, pay: "Unpaid", status });
      assert.equal(owedNow(b), 0, status);
      assert.equal(holdsPlace(b), false, status);
    }
    const mixed = [...OWING, bk({ ref: "W", status: "Waitlisted", amount: 999 }), bk({ ref: "A", status: "Approval needed", amount: 999 }), bk({ ref: "C", status: "Cancelled", amount: 999 })];
    assert.equal(outstandingFigures(mixed as unknown as BkLite[], "2026-10-03").outstanding, 360);
  });
  await t.test("a confirmed 'Pay on the day' booking owes its balance like Unpaid", () => {
    assert.equal(owedNow(bk({ amount: 25, pay: "Pay on the day" })), 25);
  });
  await t.test("overpayment never produces a negative debt", () => {
    assert.equal(owedNow(bk({ amount: 10, pay: "Part paid", amountPaid: 15 })), 0);
  });
  await t.test("voucher counts: 2 awaiting, 1 overdue (receive-by in the past)", () => {
    const f = outstandingFigures(OWING as unknown as BkLite[], "2026-10-03");
    assert.equal(f.awaitingVoucher, 2);
    assert.equal(f.overdueVouchers, 1);
  });
  await t.test("empty book gives £0 not NaN", () => {
    assert.deepEqual(outstandingFigures([], "2026-10-03"), { outstanding: 0, overdueVouchers: 0, awaitingVoucher: 0 });
  });
});

test("Rounding to pence", async (t) => {
  await t.test("3 x £33.33 bookings: outstanding £99.99 exactly", () => {
    const three = [1, 2, 3].map((i) => bk({ ref: `R${i}`, amount: 33.33, pay: "Unpaid" }));
    assert.equal(outstandingFigures(three as unknown as BkLite[], "2026-10-03").outstanding, 99.99);
  });
  await t.test("floating point drift is rounded away (0.1 + 0.2)", () => {
    const two = [bk({ ref: "a", amount: 0.1 }), bk({ ref: "b", amount: 0.2 })];
    assert.equal(outstandingFigures(two as unknown as BkLite[], "2026-10-03").outstanding, 0.3);
    assert.equal(round2(0.1 + 0.2), 0.3);
  });
  await t.test("net of a fractional refund is rounded to pence", () => {
    const b = bk({ amount: 33.33, pay: "Partially refunded", amountPaid: 33.33, refundLog: [{ label: "r", amount: 11.11, on: "x", by: "y" }] });
    assert.equal(bookingNetIn(b).net, 22.22);
  });
  await t.test("money() formats pounds and pence", () => {
    assert.equal(money(33.33), "£33.33");
    assert.equal(money(180), "£180.00");
  });
});

test("FD-030: Dashboard 'Taken this week'", async (t) => {
  const WEEK = "2026-09-26T12:00:00.000Z";
  const pay = (o: Partial<PayLite>): PayLite => ({ status: "succeeded", type: "booking", createdAt: "2026-10-02T10:00:00.000Z", ...o });
  await t.test("sums settled card + recorded offline payments in the window", () => {
    const ps = [pay({ amount: 81, refs: ["AMI-24639"] }), pay({ amount: 20, status: "recorded", refs: ["AMI-24630"] })];
    assert.equal(takenThisWeekFigure(ps, WEEK, new Set()), 101);
  });
  await t.test("unfinished ('created') and failed card attempts are not income", () => {
    const ps = [pay({ amount: 50, status: "created" }), pay({ amount: 60, status: "failed" }), pay({ amount: 5 })];
    assert.equal(takenThisWeekFigure(ps, WEEK, new Set()), 5);
  });
  await t.test("payments older than the window are excluded; paidAt beats createdAt", () => {
    const old = pay({ amount: 40, createdAt: "2026-09-01T00:00:00.000Z" });
    const paidLater = pay({ amount: 30, createdAt: "2026-09-01T00:00:00.000Z", paidAt: "2026-10-02T00:00:00.000Z" });
    assert.equal(takenThisWeekFigure([old, paidLater], WEEK, new Set()), 30);
  });
  await t.test("a succeeded refund row this week is taken off", () => {
    const ps = [pay({ amount: 20, refs: ["AMI-24630"] }), pay({ amount: 10, type: "refund", refs: ["AMI-24630"] })];
    assert.equal(takenThisWeekFigure(ps, WEEK, new Set()), 10);
  });
  await t.test("refund rows are never counted as money in (no double count)", () => {
    assert.equal(isMoneyIn({ type: "refund", status: "succeeded" }), false);
    assert.equal(takenThisWeekFigure([pay({ amount: 10, type: "refund" })], WEEK, new Set()), -10);
  });
  await t.test("cancelled + fully refunded booking with NO refund row is excluded (AMI-24643)", () => {
    const refs = new Set<string>();
    assert.equal(isGoneRefund({ ref: "AMI-24643", status: "Cancelled", pay: "Refunded" }, refs), true);
    const gone = new Set(["AMI-24643"]);
    const ps = [pay({ amount: 10, status: "recorded", refs: ["AMI-24643"] }), pay({ amount: 81, refs: ["AMI-24639"] })];
    assert.equal(takenThisWeekFigure(ps, WEEK, gone), 81);
  });
  await t.test("...but if it DOES have a refund row, it is not 'gone' (the row nets it; no double subtraction)", () => {
    assert.equal(isGoneRefund({ ref: "AMI-24643", status: "Cancelled", pay: "Refunded" }, new Set(["AMI-24643"])), false);
    const ps = [pay({ amount: 10, status: "recorded", refs: ["AMI-24643"] }), pay({ amount: 10, type: "refund", refs: ["AMI-24643"] })];
    assert.equal(takenThisWeekFigure(ps, WEEK, new Set()), 0);
  });
  await t.test("a live Confirmed paid booking is never 'gone'", () => {
    assert.equal(isGoneRefund({ ref: "x", status: "Confirmed", pay: "Paid" }, new Set()), false);
  });
  await t.test("venue lens counts only this site's share of a two-booking checkout, by price", () => {
    const priceOf: Record<string, number> = { A: 60, B: 40 };
    const venue = new Set(["A"]);
    const share = (refs: string[]) => { const tot = refs.reduce((n, r) => n + (priceOf[r] ?? 0), 0); return tot > 0 ? refs.filter((r) => venue.has(r)).reduce((n, r) => n + priceOf[r], 0) / tot : 1; };
    assert.equal(takenThisWeekFigure([pay({ amount: 100, refs: ["A", "B"] })], WEEK, new Set(), venue, share), 60);
  });
  await t.test("3 payments of £33.33 total £99.99", () => {
    assert.equal(takenThisWeekFigure([1, 2, 3].map(() => pay({ amount: 33.33 })), WEEK, new Set()), 99.99);
  });
});

test("FD-016: per-day listing capacity (dashboard occupancy)", async (t) => {
  const run = (o: Partial<BlockDoc>): BlockDoc => ({
    tenantId: "t", listingId: "l", name: "Wk", startDate: "2026-10-05", endDate: "2026-10-07", capacity: 2, bookedCount: 3, open: true,
    sessions: ["2026-10-05", "2026-10-06", "2026-10-07"].map((date) => ({ date, start: "09:00", end: "15:00" })), ...o,
  });
  const fresh = (): ListingOcc => ({ listing: "L", capacity: 0, booked: 0, spotsLeft: 0, nextDate: "9999-99-99" });
  await t.test("day scope: 2 a day over three days is 2 capacity, busiest day booked, never 6", () => {
    const r = run({ capacityScope: "day", dayCounts: { "2026-10-05": 1, "2026-10-06": 2, "2026-10-07": 0 } });
    const cur = addRunToListing(fresh(), r, blockSummary("b", r));
    assert.deepEqual([cur.capacity, cur.booked, cur.spotsLeft], [2, 2, 0]);
  });
  await t.test("day scope across two weekly blocks stays a daily limit", () => {
    const a = run({ capacityScope: "day", dayCounts: { "2026-10-05": 1 } });
    const b = run({ capacityScope: "day", dayCounts: { "2026-10-12": 2 } });
    const cur = fresh();
    addRunToListing(cur, a, blockSummary("a", a));
    addRunToListing(cur, b, blockSummary("b", b));
    assert.deepEqual([cur.capacity, cur.booked, cur.spotsLeft], [2, 2, 0]);
  });
  await t.test("listing scope sums capacity and bookings across runs", () => {
    const a = run({ capacity: 10, bookedCount: 4 });
    const b = run({ capacity: 10, bookedCount: 6 });
    const cur = fresh();
    addRunToListing(cur, a, blockSummary("a", a));
    addRunToListing(cur, b, blockSummary("b", b));
    assert.deepEqual([cur.capacity, cur.booked, cur.spotsLeft], [20, 10, 10]);
  });
  await t.test("per-session spots are capacity minus that day's count, floored at 0", () => {
    const s = blockSummary("b", run({ capacityScope: "day", dayCounts: { "2026-10-05": 5, "2026-10-06": 1 } }));
    assert.deepEqual(s.sessions.map((x) => x.spotsLeft), [0, 1, 2]);
  });
});

test("Income tab / Money-in aggregation over the real fixtures", async (t) => {
  const all = [AMI_24639, AMI_24630, AMI_24643, AMI_24647_AWAITING, AMI_24646_FUNDED, ...OWING];
  const income = all.map((b) => bookingNetIn(b)).filter((r) => r.got > 0);
  await t.test("Income collected = 81 + 10 + 0 + 60 = £151 (net of refunds)", () => {
    assert.equal(round2(all.reduce((s, b) => s + collectedNet(b), 0)), 151);
    assert.equal(round2(income.reduce((s, r) => s + r.net, 0)), 151);
  });
  await t.test("refunded part shown = £10 + £10 = £20 and gross received = £171", () => {
    assert.equal(income.reduce((s, r) => s + r.back, 0), 20);
    assert.equal(income.reduce((s, r) => s + r.got, 0), 171);
  });
  await t.test("income + refunds always equals gross received (refunds never double counted)", () => {
    for (const r of income) assert.equal(round2(r.net + r.back), r.got);
  });
  await t.test("awaiting-voucher, unpaid and funded £0 bookings add nothing", () => {
    assert.equal(income.length, 4, "only the four with money received appear");
  });
});

test("Finance & analytics page figures (financeFigures)", async (t) => {
  const NOW = Date.parse("2026-10-03T12:00:00Z");
  const base = { payIdx: payIndex([], []), months: 1, nowMs: NOW, season: "", venue: "", listingSeason: {}, listingVenue: {}, listingVenueId: {} };
  const all = [AMI_24639, AMI_24630, AMI_24643, AMI_24647_AWAITING, AMI_24646_FUNDED, ...OWING];
  const f = financeFigures({ ...base, bookings: all });
  await t.test("collected = £151 net, owed = £360 + £10 voucher = £370", () => {
    assert.equal(round2(f.collected), 151);
    assert.equal(round2(f.owed), 370);
  });
  await t.test("refunds in window = £20 (log £10 + cancelled £10)", () => {
    assert.equal(round2(f.refunds), 20);
  });
  await t.test("Finance 'owed' equals Dashboard Outstanding rule on the same rows", () => {
    assert.equal(round2(f.owed), outstandingFigures(all as unknown as BkLite[], "2026-10-03").outstanding);
  });
  await t.test("Waitlisted and Declined bookings are neither income nor owed", () => {
    const g = financeFigures({ ...base, bookings: [...all, bk({ ref: "W", status: "Waitlisted", amount: 500 }), bk({ ref: "D", status: "Declined", amount: 500, pay: "Paid" })] });
    assert.equal(round2(g.collected), 151);
    assert.equal(round2(g.owed), 370);
  });
  await t.test("collected month split adds up to collectedNet when a payment record dates it", () => {
    const pays: PaymentRecord[] = [{ id: "p1", refs: ["AMI-24639"], amount: 81, status: "succeeded", createdAt: "2026-10-01T10:00:00Z", paymentIntentId: "pi_1" }];
    const g = financeFigures({ ...base, bookings: [AMI_24639], payIdx: payIndex([AMI_24639], pays) });
    assert.equal(round2(g.collected), 81);
  });
  await t.test("a refund payment record is not money in for payIndex", () => {
    const pays: PaymentRecord[] = [{ id: "r1", refs: ["AMI-24630"], amount: 10, type: "refund", status: "succeeded", createdAt: "2026-10-02T10:00:00Z" }];
    assert.equal(payIndex([AMI_24630], pays).byRef.size, 0);
  });
});

test("PY-021/PY-022/FD-014: invoices", async (t) => {
  await t.test("grandTotal: line items x qty + VAT, rounded to pence", () => {
    const lines = [{ description: "Camp", qty: 3, unitPrice: 33.33 }];
    assert.equal(subtotalOf(lines, undefined), 99.99);
    assert.equal(grandTotal(lines, undefined, 20), 119.99); // 99.99 * 1.2 = 119.988
  });
  await t.test("no VAT leaves the subtotal", () => {
    assert.equal(grandTotal([{ description: "x", qty: 2, unitPrice: 12.5 }], undefined, undefined), 25);
    assert.equal(grandTotal([{ description: "x", qty: 2, unitPrice: 12.5 }], undefined, 0), 25);
  });
  await t.test("with no line items, the fallback amount is used (and VAT applied)", () => {
    assert.equal(grandTotal(undefined, 180, undefined), 180);
    assert.equal(grandTotal([], 100, 20), 120);
    assert.equal(grandTotal(undefined, undefined, 20), 0);
  });
  await t.test("line items win over the fallback amount", () => {
    assert.equal(grandTotal([{ description: "x", qty: 1, unitPrice: 10 }], 999, undefined), 10);
  });
  await t.test("VAT rounding: £0.05 + 5% rounds to £0.05; £10.01 at 20% = £12.01", () => {
    assert.equal(grandTotal(undefined, 0.05, 5), 0.05);
    assert.equal(grandTotal(undefined, 10.01, 20), 12.01);
  });
  await t.test("status transitions: only a draft becomes sent when emailed", () => {
    assert.equal(statusAfterEmail("draft"), "sent");
    for (const s of ["sent", "paid", "cancelled", undefined]) assert.equal(statusAfterEmail(s), undefined);
  });
  await t.test("overdue only applies to SENT invoices past their due date", () => {
    const today = "2026-10-03";
    assert.equal(isOverdue({ status: "sent", dueDate: "2026-10-02" }, today), true);
    assert.equal(isOverdue({ status: "sent", dueDate: "2026-10-03" }, today), false, "due today is not yet overdue");
    assert.equal(isOverdue({ status: "paid", dueDate: "2026-09-01" }, today), false);
    assert.equal(isOverdue({ status: "cancelled", dueDate: "2026-09-01" }, today), false);
    assert.equal(isOverdue({ status: "draft", dueDate: "2026-09-01" }, today), false);
    assert.equal(isOverdue({ status: "sent" }, today), false, "no due date, never overdue");
  });
  await t.test("summary: outstanding = sent only; collected = paid this year only; unpaid never counted as collected", () => {
    const list = [
      { status: "sent", amount: 100, date: "2026-09-01", dueDate: "2026-09-15" },
      { status: "sent", amount: 33.33, date: "2026-10-01", dueDate: "2026-10-30" },
      { status: "paid", amount: 50, date: "2026-03-01" },
      { status: "paid", amount: 70, date: "2025-12-31" },
      { status: "draft", amount: 999, date: "2026-10-01" },
      { status: "cancelled", amount: 888, date: "2026-10-01" },
    ];
    assert.deepEqual(invoiceSummary(list, "2026-10-03"), { count: 6, outstanding: 133.33, collected: 50, overdue: 1 });
  });
});

test("reconcile tool core: payment records vs collectedNet", async (t) => {
  const pay = (o: Record<string, unknown>) => ({ status: "succeeded", ...o });
  await t.test("AMI-24630: in 20, refunds 10, net 10 matches the dashboard helper", () => {
    const r = reconcileBooking(AMI_24630 as never, [pay({ amount: 20, refs: ["AMI-24630"] }), pay({ amount: 10, type: "refund", refs: ["AMI-24630"] })]);
    assert.deepEqual([r.inn, r.ref, r.net, r.helper, r.ok], [20, 10, 10, 10, true]);
  });
  await t.test("AMI-24639: in 81, no refunds, ok", () => {
    assert.equal(reconcileBooking(AMI_24639 as never, [pay({ amount: 81, refs: ["AMI-24639"] })]).ok, true);
  });
  await t.test("other bookings' payments are ignored; failed/created attempts are not money in", () => {
    const r = reconcileBooking(AMI_24639 as never, [pay({ amount: 81, refs: ["AMI-24639"] }), pay({ amount: 50, status: "created", refs: ["AMI-24639"] }), pay({ amount: 999, refs: ["OTHER"] })]);
    assert.equal(r.inn, 81);
    assert.equal(r.ok, true);
  });
  await t.test("a mismatch is flagged (payment records say 81 but the booking says unpaid)", () => {
    const r = reconcileBooking(AC_3101 as never, [pay({ amount: 180, refs: ["AC-3101"] })]);
    assert.equal(r.helper, 0);
    assert.equal(r.net, 180);
    assert.equal(r.ok, false);
  });
  await t.test("refunds queued 'to-reimburse' count as refunded in the reconcile", () => {
    const r = reconcileBooking(AMI_24643 as never, [pay({ amount: 10, status: "recorded", refs: ["AMI-24643"] }), pay({ amount: 10, type: "refund", status: "to-reimburse", refs: ["AMI-24643"] })]);
    assert.deepEqual([r.net, r.helper, r.ok], [0, 0, true]);
  });
});
