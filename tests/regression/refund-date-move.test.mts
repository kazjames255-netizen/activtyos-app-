/**
 * Regression: moving a date LATER must not buy a bigger refund.
 * Found by the refund-policy test (6 Oct): GBP18 day booked 3 days out (Standard = 50%), moved by the family to 14 days out, cancelled for 100%.
 * Rule: refund notice is judged on the EARLIER of the original and the current date.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_POLICIES, effectiveRefundDate, refundFor } from "../../lib/cancellation";
import { applyMoveApprove } from "../../server/src/lib/dateChange";

const standard = DEFAULT_POLICIES.find((p) => p.id === "standard")!;
const NOW = "2026-10-06T10:00:00.000Z";
const day = (n: number) => new Date(Date.parse("2026-10-06T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);

test("effectiveRefundDate: earlier of original and current", () => {
  assert.equal(effectiveRefundDate("2026-10-09", "2026-10-20"), "2026-10-09"); // moved later: keep the original
  assert.equal(effectiveRefundDate("2026-10-20", "2026-10-09"), "2026-10-09"); // moved earlier: the earlier one
  assert.equal(effectiveRefundDate(undefined, "2026-10-09"), "2026-10-09"); // never moved
  assert.equal(effectiveRefundDate("2026-10-09", undefined), "2026-10-09");
  assert.equal(effectiveRefundDate("junk", "2026-10-09"), "2026-10-09"); // malformed original ignored
  assert.equal(effectiveRefundDate(undefined, undefined), undefined);
});

test("original 3 days out moved to 14 days out cancels at 50%, not 100%", () => {
  const orig = day(3), moved = day(14);
  const wrong = refundFor(standard, moved, 18, NOW, "parent")!;
  assert.equal(wrong.percent, 100); // what the loophole used to give
  const right = refundFor(standard, effectiveRefundDate(orig, moved), 18, NOW, "parent")!;
  assert.equal(right.percent, 50);
  assert.equal(right.amount, 9);
});

test("moved EARLIER still counts from the earlier date", () => {
  const right = refundFor(standard, effectiveRefundDate(day(14), day(1)), 18, NOW, "parent")!;
  assert.equal(right.percent, 0);
});

test("a never-moved booking is judged exactly as before", () => {
  assert.equal(refundFor(standard, effectiveRefundDate(undefined, day(14)), 18, NOW, "parent")!.percent, 100);
});

test("provider-initiated cancel is still 100% whatever the dates", () => {
  assert.equal(refundFor(standard, effectiveRefundDate(day(1), day(30)), 18, NOW, "provider")!.percent, 100);
});

test("applyMoveApprove records origFirstDate and dayOrigin on the first move, and keeps the earliest across further moves", () => {
  const b: any = {
    days: [day(3)], dates: "x", sessions: [],
    dateChangeRequest: { status: "pending", moves: [{ from: day(3), to: day(14) }] },
  };
  applyMoveApprove(b);
  assert.deepEqual(b.days, [day(14)]);
  assert.equal(b.origFirstDate, day(3));
  assert.deepEqual(b.dayOrigin, { [day(14)]: day(3) });
  // a second move later still still remembers the very first date
  b.dateChangeRequest = { status: "pending", moves: [{ from: day(14), to: day(21) }] };
  applyMoveApprove(b);
  assert.equal(b.origFirstDate, day(3));
  assert.deepEqual(b.dayOrigin, { [day(21)]: day(3) });
});

test("a multi-day booking: each released day is judged on min(original, current)", () => {
  const b: any = {
    days: [day(3), day(15)], sessions: [],
    dateChangeRequest: { status: "pending", moves: [{ from: day(3), to: day(14) }] },
  };
  applyMoveApprove(b);
  // days now [14, 15]; day 14 came from 3, day 15 never moved
  const eff = (d: string) => effectiveRefundDate(b.dayOrigin?.[d], d);
  assert.equal(refundFor(standard, eff(day(14)), 10, NOW, "parent")!.percent, 50);
  assert.equal(refundFor(standard, eff(day(15)), 10, NOW, "parent")!.percent, 100);
  assert.equal(b.origFirstDate, day(3));
});
