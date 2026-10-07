/** Regression (6 Oct): discount engine, refund matrix, owed / received arithmetic, register + dashboard rules. Pure. */
import test from "node:test";
import assert from "node:assert/strict";
import { applyDiscounts, emptyRule, type DiscountRule } from "../../features/listings/discounts";
import { earlyBirdScopeOf, countsAsEarlyBirdUse, personRuleProblem } from "../../server/src/lib/discountRules";
import { DEFAULT_POLICIES, refundFor } from "../../lib/cancellation";
import { receivedOf, owedNow, owedOf } from "../../features/bookings/helpers";
import { withoutLeavers, childExtrasForDay, openOccupancy } from "../../server/src/lib/rosterRules";
import type { Booking } from "../../features/bookings/types";

const rule = (o: Partial<DiscountRule>): DiscountRule => ({ ...emptyRule("person"), enabled: true, passNames: [], moreThan: 1, method: "percent", value: 10, beforeDate: "", ...o });
const bk = (o: Record<string, unknown>) => ({ ref: "R", bid: "b", status: "Confirmed", pay: "Unpaid", amount: 100, ...o }) as unknown as Booking;

test("multi-person counts every child in the WHOLE checkout, across weeks", () => {
  const items = [{ name: "W1", price: 50, days: 5, heads: 1 }, { name: "W2", price: 50, days: 5, heads: 1 }];
  const r = applyDiscounts([rule({ moreThan: 1 })], items, 2, "2026-10-06");
  assert.equal(r.total, 90);
  assert.equal(r.lines[0].amount, 10);
  assert.equal(applyDiscounts([rule({ moreThan: 1 })], items.slice(0, 1), 1, "2026-10-06").lines.length, 0);
});
test("fixed early bird: skipped once the family used one this season, percent still applies", () => {
  const fixed = rule({ kind: "early", method: "subtract", value: 5, moreThan: 0 });
  const pct = rule({ kind: "early", method: "percent", value: 10, moreThan: 0 });
  const items = [{ name: "W", price: 100, days: 5, heads: 1 }];
  assert.equal(applyDiscounts([fixed], items, 1, "2026-10-06").total, 95);
  assert.equal(applyDiscounts([fixed], items, 1, "2026-10-06", undefined, { earlyFixedUsed: true }).total, 100);
  assert.equal(applyDiscounts([pct], items, 1, "2026-10-06", undefined, { earlyFixedUsed: true }).total, 90);
});
test("early bird with a blank date is continuous; with a date it ends after that date", () => {
  const items = [{ name: "W", price: 100, days: 5, heads: 1 }];
  const blank = rule({ kind: "early", beforeDate: "", moreThan: 0 });
  assert.equal(applyDiscounts([blank], items, 1, "2099-01-01").total, 90);
  const dated = rule({ kind: "early", beforeDate: "2026-10-10", moreThan: 0 });
  assert.equal(applyDiscounts([dated], items, 1, "2026-10-10").total, 90);
  assert.equal(applyDiscounts([dated], items, 1, "2026-10-11").total, 100);
});
test("early-bird scope: per season when there is one, else per listing; cancelled/declined don't count as use", () => {
  assert.equal(earlyBirdScopeOf("L1", "S1"), "season:S1");
  assert.equal(earlyBirdScopeOf("L1"), "listing:L1");
  assert.equal(earlyBirdScopeOf("L1", null), "listing:L1");
  assert.equal(countsAsEarlyBirdUse("Confirmed"), true);
  assert.equal(countsAsEarlyBirdUse("Cancelled"), false);
  assert.equal(countsAsEarlyBirdUse("Declined"), false);
});
test("multi-person rules must be percentage-only; saved legacy fixed rules keep working unchanged", () => {
  const fixed = { id: "r1", kind: "person", method: "subtract", value: 5 };
  assert.match(personRuleProblem([fixed], [])!, /percentage/);
  assert.equal(personRuleProblem([fixed], [fixed]), null);
  assert.match(personRuleProblem([{ ...fixed, value: 6 }], [fixed])!, /percentage/);
  assert.equal(personRuleProblem([{ id: "r2", kind: "person", method: "percent", value: 10 }], []), null);
  assert.equal(personRuleProblem([{ id: "e", kind: "early", method: "subtract", value: 5 }], []), null);
});

const pol = (id: string) => DEFAULT_POLICIES.find((p) => p.id === id)!;
const NOW = "2026-10-01T00:00:00Z";
const at = (hoursAhead: number) => new Date(Date.parse(NOW) + hoursAhead * 3_600_000).toISOString().slice(0, 10);
// Session dates carry no time (midnight UTC); so notice is judged from NOW to that midnight.
const pct = (id: string, hours: number) => refundFor(pol(id), at(hours), 100, NOW, "parent")!.percent;
test("Standard: full a week out, 50% from 48h, nothing inside 48h", () => {
  assert.equal(pct("standard", 24 * 20), 100);
  assert.equal(pct("standard", 24 * 14), 100);
  assert.equal(pct("standard", 24 * 8), 100);
  assert.equal(pct("standard", 24 * 7), 100);
  assert.equal(pct("standard", 24 * 3), 50);
  assert.equal(pct("standard", 24 * 2), 50);
  assert.equal(pct("standard", 24), 0);
});
test("Flexible: full a day out, none inside", () => {
  assert.equal(pct("flexible", 24 * 20), 100);
  assert.equal(pct("flexible", 24 * 2), 100);
  assert.equal(pct("flexible", 24), 100);
  assert.equal(pct("flexible", 0), 0);
});
test("Strict: full at 14d, 50% at 7d, none inside a week", () => {
  assert.equal(pct("strict", 24 * 20), 100);
  assert.equal(pct("strict", 24 * 14), 100);
  assert.equal(pct("strict", 24 * 8), 50);
  assert.equal(pct("strict", 24 * 7), 50);
  assert.equal(pct("strict", 24 * 3), 0);
});
test("No refunds is always 0 at every distance", () => {
  for (const h of [24 * 20, 24 * 14, 24 * 7, 24 * 3, 24, 1]) assert.equal(pct("none", h), 0);
});
test("refund amounts are exact in pence and provider-cancel is always full", () => {
  assert.equal(refundFor(pol("standard"), at(24 * 3), 37.55, NOW, "parent")!.amount, 18.78);
  const p = refundFor(pol("none"), at(24), 40, NOW, "provider")!;
  assert.equal(p.percent, 100);
  assert.equal(p.amount, 40);
  assert.equal(refundFor(pol("standard"), undefined, 40, NOW), null);
});

test("unpaid waitlisted / offered bookings owe nothing; a confirmed unpaid one owes its price", () => {
  assert.equal(owedNow(bk({ status: "Waitlisted" })), 0);
  assert.equal(owedNow(bk({ status: "Offered" })), 0);
  assert.equal(owedNow(bk({ status: "Cancelled" })), 0);
  assert.equal(owedNow(bk({ status: "Confirmed" })), 100);
  assert.equal(owedNow(bk({ status: "Confirmed", pay: "Pay on the day" })), 100);
  assert.equal(owedNow(bk({ status: "Confirmed", pay: "Paid", amountPaid: 100 })), 0);
  assert.equal(owedOf(bk({ pay: "Unpaid", amountPaid: 40 })), 60);
});
test("wallet credit applied counts as money received", () => {
  assert.equal(receivedOf(bk({ pay: "Unpaid", amount: 70, walletApplied: 30 })), 30);
  assert.equal(receivedOf(bk({ pay: "Paid", amount: 70, amountPaid: 70, walletApplied: 30 })), 100);
  assert.equal(receivedOf(bk({ pay: "Paid", amount: 70, walletApplied: 30 })), 100);
  // `amount` is already NET of store credit (a fully covered booking is amount 0 / Funded): what is still owed is amount less CASH received,
  // never less the wallet again (QA-C D1: the card was asked for £2.50 on a £7.50 balance).
  assert.equal(owedNow(bk({ status: "Confirmed", pay: "Funded", amount: 0, walletApplied: 70 })), 0);
  assert.equal(owedNow(bk({ status: "Confirmed", amount: 70, walletApplied: 30 })), 70);
});

test("dashboard spaces left: per-day limit is judged per day, not once per run", () => {
  const run = { capacity: 10, bookedCount: 25 };
  const days = [1, 2, 3, 4, 5].map(() => ({ capacity: 10, bookedCount: 5 }));
  assert.deepEqual(openOccupancy("day", run, days), { capacity: 50, booked: 25 });
  assert.deepEqual(openOccupancy("run", run, days), { capacity: 10, booked: 25 });
  assert.deepEqual(openOccupancy(undefined, run, []), { capacity: 10, booked: 25 });
});
test("register shows only that child's extras for that day", () => {
  const lines = [
    { child: "Ann", label: "T-shirt", price: 8, perDay: false },
    { child: "Ann", label: "Lunch", price: 4, perDay: true, days: ["2026-10-12"] },
    { child: "Ben", label: "Lunch", price: 4, perDay: true, days: ["2026-10-13"] },
  ];
  assert.deepEqual(childExtrasForDay(lines, ["x"], "Ann", "2026-10-12"), ["T-shirt — £8.00", "Lunch — £4.00"]);
  assert.deepEqual(childExtrasForDay(lines, ["x"], "Ann", "2026-10-13"), ["T-shirt — £8.00"]);
  assert.deepEqual(childExtrasForDay(lines, [], "Ben", "2026-10-12"), []);
  assert.deepEqual(childExtrasForDay(undefined, ["Old extra"], "Ann", "2026-10-12"), ["Old extra"]);
});
test("leavers are excluded from ratio cover and the parent staff list", () => {
  assert.deepEqual(withoutLeavers(["a", "b", "c"], new Set(["b"])), ["a", "c"]);
  assert.deepEqual(withoutLeavers(["a"], new Set()), ["a"]);
  assert.deepEqual(withoutLeavers([], new Set(["a"])), []);
});
