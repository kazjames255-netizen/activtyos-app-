// Franchise payouts: the CASH statement (10 Oct owner decision). Money counts on the UK day it was RECEIVED, a refund on the day it was GIVEN,
// so a late payment or refund lands in the NEXT period and never changes a settled one. Hand-worked numbers.
import test from "node:test";
import assert from "node:assert/strict";
import type { Booking } from "../../features/bookings/types";
import { computePayouts, eventRows, monthBounds, refundDay, withRateChange, type PayoutItem } from "../../server/src/lib/franchisePayouts";

const mk = (o: Record<string, unknown>) => ({ status: "Confirmed", pay: "Paid", method: "Card", amount: 0, kids: [], addons: [], ...o }) as unknown as Booking;
const card = (amount: number, o: Record<string, unknown> = {}) => mk({ amount, amountPaid: amount, paymentIntentId: "pi_x", createdAt: "2026-10-05T10:00:00Z", ...o });
const cash = (amount: number, o: Record<string, unknown> = {}) => mk({ amount, amountPaid: amount, method: "Cash on the day", createdAt: "2026-10-05T10:00:00Z", ...o });
const item = (b: Booking): PayoutItem => ({ b, fid: "F1" });

test("cash booking made 28 Sep and paid 3 Oct counts in OCTOBER, not September", () => {
  const items: PayoutItem[] = [{ b: cash(100, { createdAt: "2026-09-28T10:00:00Z" }), fid: "F1", pays: [{ day: "2026-10-03", amount: 100 }] }];
  const sep = computePayouts(items, { from: "2026-09-01", to: "2026-09-30", fallbackRate: 10 }).franchises.get("F1");
  const oct = computePayouts(items, { from: "2026-10-01", to: "2026-10-31", fallbackRate: 10 }).franchises.get("F1")!;
  assert.equal(sep?.direct ?? 0, 0);
  assert.deepEqual([oct.direct, oct.hoShareDirect, oct.bookings], [100, 10, 1]);
});

test("a part payment received in two months is split by the day each part arrived (40 in Sep, 60 in Oct)", () => {
  const items: PayoutItem[] = [{ b: card(100, { createdAt: "2026-09-20T10:00:00Z" }), fid: "F1", pays: [{ day: "2026-09-20", amount: 40 }, { day: "2026-10-02", amount: 60 }] }];
  const sep = computePayouts(items, { from: "2026-09-01", to: "2026-09-30", fallbackRate: 10 }).franchises.get("F1")!;
  const oct = computePayouts(items, { from: "2026-10-01", to: "2026-10-31", fallbackRate: 10 }).franchises.get("F1")!;
  assert.deepEqual([sep.card, oct.card], [40, 60]);
});

test("a refund given in October lands in October: September stays as it was; October is net negative (franchise owes 90)", () => {
  const b = card(100, { createdAt: "2026-09-10T10:00:00Z", pay: "Refunded", refundLog: [{ label: "Refunded", amount: 100, on: "2026-10-12", by: "x" }] });
  const sep = computePayouts([item(b)], { from: "2026-09-01", to: "2026-09-30", fallbackRate: 10 }).franchises.get("F1")!;
  const oct = computePayouts([item(b)], { from: "2026-10-01", to: "2026-10-31", fallbackRate: 10 }).franchises.get("F1")!;
  assert.deepEqual([sep.card, sep.hoKeepsCard, sep.net], [100, 10, 90]);
  assert.deepEqual([oct.card, oct.hoKeepsCard, oct.franchiseCard, oct.net], [-100, -10, -90, -90]);
  const all = computePayouts([item(b)], { fallbackRate: 10 }).franchises.get("F1")!;
  assert.deepEqual([all.card, all.net, all.bookings], [0, 0, 0]);
});

test("a refund of a booking counted in the same period nets out inside it", () => {
  const b = card(100, { createdAt: "2026-09-10T10:00:00Z", pay: "Partially refunded", refundLog: [{ label: "Refunded a day", amount: 30, on: "2026-09-20", by: "x" }] });
  const sep = computePayouts([item(b)], { from: "2026-09-01", to: "2026-09-30", fallbackRate: 10 }).franchises.get("F1")!;
  assert.deepEqual([sep.card, sep.hoKeepsCard, sep.net, sep.bookings], [70, 7, 63, 1]);
});

test("refund dates are read from ISO days, ISO timestamps and the older '12/10/2026, 09:30' text", () => {
  assert.equal(refundDay("2026-10-12"), "2026-10-12");
  assert.equal(refundDay("2026-10-12T09:30:00Z"), "2026-10-12");
  assert.equal(refundDay("12/10/2026, 09:30"), "2026-10-12");
  assert.equal(refundDay("nonsense"), null);
});

test("rounding: the all-time figure is the sum of the monthly figures (3 months of 3.33 at 10% = 0.99, not 1.00)", () => {
  const items = ["2026-07-10", "2026-08-10", "2026-09-10"].map((d) => item(card(3.33, { createdAt: `${d}T10:00:00Z` })));
  const all = computePayouts(items, { fallbackRate: 10 }).franchises.get("F1")!;
  const months = ["2026-07", "2026-08", "2026-09"].map((m) => computePayouts(items, { ...monthBounds(m), fallbackRate: 10 }).franchises.get("F1")!.hoKeepsCard);
  assert.deepEqual(months, [0.33, 0.33, 0.33]);
  assert.equal(all.hoKeepsCard, 0.99);
  assert.equal(all.franchiseCard, 9);
});

test("a booking with no createdAt is dated by its payment, else by the day its record last changed, and counts in windows", () => {
  const b = card(100, { createdAt: undefined });
  assert.equal(eventRows({ b, fid: "F1", pays: [{ day: "2026-09-12", amount: 100 }] })[0].day, "2026-09-12");
  const r = computePayouts([{ b, fid: "F1", fallbackDay: "2026-09-15" }], { from: "2026-09-01", to: "2026-09-30", fallbackRate: 10 }).franchises.get("F1")!;
  assert.equal(r.card, 100);
});

test("the rate in force on the PAYMENT day applies (made at 10%, paid after the change to 20%)", () => {
  const history = withRateChange(undefined, 10, 20, "2026-10-01");
  const items: PayoutItem[] = [{ b: card(100, { createdAt: "2026-09-28T10:00:00Z" }), fid: "F1", pays: [{ day: "2026-10-03", amount: 100 }] }];
  assert.equal(computePayouts(items, { history }).franchises.get("F1")!.hoKeepsCard, 20);
});

test("payment events add back to the booking exactly (odd pennies over three payments)", () => {
  const rows = eventRows({ b: card(100), fid: "F1", pays: [{ day: "2026-10-01", amount: 1 }, { day: "2026-10-02", amount: 1 }, { day: "2026-10-03", amount: 1 }] });
  assert.equal(Math.round(rows.reduce((s, r) => s + r.card, 0) * 100), 10000);
});
