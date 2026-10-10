// Franchise payouts: the shared pure helper, hand-worked numbers (worked out BEFORE the code).
//   Franchise card 1,000 net of 100 refunds = 900. At 10%: head office keeps 90, franchise gets 810.
//   Direct cash 200: head office's 10% = 20.  NET: head office pays the franchise 810 - 20 = 790.
import test from "node:test";
import assert from "node:assert/strict";
import type { Booking } from "../../features/bookings/types";
import { bookingMoney, computePayouts, rateOn, withRateChange, ukDay, franchiseOf, royaltyFee, monthBounds, type PayoutItem } from "../../server/src/lib/franchisePayouts";

const mk = (o: Record<string, unknown>) => ({ status: "Confirmed", pay: "Paid", method: "Card", amount: 0, kids: [], addons: [], ...o }) as unknown as Booking;
const card = (amount: number, o: Record<string, unknown> = {}) => mk({ amount, amountPaid: amount, paymentIntentId: "pi_x", createdAt: "2026-10-05T10:00:00Z", ...o });
const cash = (amount: number, o: Record<string, unknown> = {}) => mk({ amount, amountPaid: amount, method: "Cash on the day", createdAt: "2026-10-05T10:00:00Z", ...o });
const item = (b: Booking, fid: string | null = "F1"): PayoutItem => ({ b, fid });
const refund = (amount: number) => ({ refundLog: [{ label: "Refunded a day", amount, on: "x", by: "x" }] });

test("worked example: card 1000 less 100 refunds = 900; keeps 90, franchise 810; direct 200 -> 20; HO pays 790", () => {
  const items = [item(card(500)), item(card(500, { pay: "Partially refunded", ...refund(100) })), item(cash(200))];
  const r = computePayouts(items, { fallbackRate: 10 }).franchises.get("F1")!;
  assert.deepEqual([r.card, r.direct, r.total, r.bookings], [900, 200, 1100, 3]);
  assert.deepEqual([r.hoKeepsCard, r.franchiseCard, r.hoShareDirect, r.net, r.royalty], [90, 810, 20, 790, 110]);
  assert.equal(r.rate, 10);
});

test("a franchise that took more direct money than it earned on card OWES head office (negative net)", () => {
  const r = computePayouts([item(card(100)), item(cash(1000))], { fallbackRate: 10 }).franchises.get("F1")!;
  assert.equal(r.net, 90 - 100); // 100 card -> 90 to franchise, less 10% of 1000 = 100
});

test("odd amounts round to the penny: 3 x 33.33 card at 7.5% keeps 7.50 (749.925p) and the franchise gets 92.49", () => {
  const r = computePayouts([item(card(33.33)), item(card(33.33)), item(card(33.33))], { fallbackRate: 7.5 }).franchises.get("F1")!;
  assert.deepEqual([r.card, r.hoKeepsCard, r.franchiseCard, r.net], [99.99, 7.5, 92.49, 92.49]);
});

test("the rate in force on each booking's day applies: a change on 1 Oct never rewrites September", () => {
  const history = withRateChange(undefined, 10, 15, "2026-10-01");
  assert.deepEqual(history, [{ from: "1970-01-01", rate: 10 }, { from: "2026-10-01", rate: 15 }]);
  const sep = card(100, { createdAt: "2026-09-30T12:00:00Z" });
  const oct = card(100, { createdAt: "2026-10-02T12:00:00Z" });
  const all = computePayouts([item(sep), item(oct)], { history }).franchises.get("F1")!;
  assert.deepEqual([all.hoKeepsCard, all.rate, all.rates], [25, null, [10, 15]]);
  assert.equal(computePayouts([item(sep), item(oct)], { history, from: "2026-09-01", to: "2026-09-30" }).franchises.get("F1")!.hoKeepsCard, 10);
  assert.equal(computePayouts([item(sep), item(oct)], { history, from: "2026-10-01", to: "2026-10-31" }).franchises.get("F1")!.hoKeepsCard, 15);
  assert.equal(rateOn(history, "2026-09-30"), 10);
  assert.equal(rateOn(history, "2026-10-01"), 15);
});

test("UK time: a booking made at 00:30 BST on 1 Oct (23:30 UTC on 30 Sep) counts in October, not September", () => {
  const b = card(100, { createdAt: "2026-09-30T23:30:00Z" });
  assert.equal(ukDay(b.createdAt), "2026-10-01");
  const oct = monthBounds("2026-10");
  assert.deepEqual(oct, { from: "2026-10-01", to: "2026-10-31" });
  assert.equal(computePayouts([item(b)], { ...oct, fallbackRate: 10 }).franchises.get("F1")!.bookings, 1);
  const sep = monthBounds("2026-09");
  assert.equal(computePayouts([item(b)], { ...sep, fallbackRate: 10 }).franchises.get("F1")?.bookings ?? 0, 0);
  // In winter (GMT) 23:30Z on 30 Nov is still 30 Nov.
  assert.equal(ukDay("2026-11-30T23:30:00Z"), "2026-11-30");
});

test("only money actually received counts: unpaid, invoice sent, pending approval, card hold, waitlisted, declined are all excluded", () => {
  const none = [
    mk({ amount: 50, pay: "Unpaid", amountPaid: 0 }),
    mk({ amount: 50, pay: "Invoice sent", amountPaid: 0 }),
    mk({ amount: 50, status: "Approval needed", pay: "Paid", amountPaid: 50, paymentIntentId: "pi_h" }),
    mk({ amount: 50, status: "Approval needed", pay: "Unpaid", amountPaid: 0, cardHold: { state: "held", amount: 50 } }),
    mk({ amount: 50, status: "Confirmed", pay: "Paid", amountPaid: 50, paymentIntentId: "pi_h", cardHold: { state: "held", amount: 50 } }),
    mk({ amount: 50, status: "Waitlisted", pay: "Paid", amountPaid: 50 }),
    mk({ amount: 50, status: "Declined", pay: "Paid", amountPaid: 50 }),
    mk({ amount: 50, status: "Offered", pay: "Paid", amountPaid: 50 }),
  ];
  for (const b of none) assert.equal(bookingMoney(b).counts, false, `${b.status}/${b.pay}`);
  const r = computePayouts(none.map((b) => item(b)), { fallbackRate: 10 }).franchises.get("F1");
  assert.ok(!r || r.bookings === 0);
});

test("a part-paid booking counts only what was received", () => {
  const m = bookingMoney(mk({ amount: 100, pay: "Partially paid", amountPaid: 40, method: "Bank transfer" }));
  assert.deepEqual([m.counts, m.card, m.direct], [true, 0, 40]);
});

test("a card-hold booking once captured counts as card", () => {
  const m = bookingMoney(card(60, { cardHold: { state: "captured", amount: 60 } }));
  assert.deepEqual([m.card, m.direct], [60, 0]);
});

test("a fully refunded booking is excluded (no money kept, even under per-booking fees)", () => {
  const b = card(100, { pay: "Refunded", ...refund(100) });
  assert.equal(bookingMoney(b).counts, false);
  const r = computePayouts([item(b), item(card(40))], { fallbackRate: 10 }).franchises.get("F1")!;
  assert.equal(r.bookings, 1);
  assert.equal(royaltyFee(r, "perBooking", 5), 5);
});

test("a partial and a per-day refund both come off the card money", () => {
  const b = card(120, { pay: "Partially refunded", refundLog: [{ label: "Released a day", amount: 30, on: "x", by: "x" }, { label: "Cancelled a child", amount: 20, on: "x", by: "x" }] });
  assert.equal(bookingMoney(b).card, 70);
});

test("wallet credit spent on a booking is not card money: 60 by card + 40 wallet counts 60", () => {
  const b = card(60, { walletApplied: 40 });
  const m = bookingMoney(b);
  assert.deepEqual([m.card, m.total], [60, 60]);
  assert.equal(bookingMoney(mk({ amount: 0, walletApplied: 50, pay: "Paid" })).counts, false);
});

test("a refund that went back to the wallet is a refund of the wallet part first, then real money", () => {
  // 60 card + 40 wallet; the family cancels and gets 40 back to the wallet: card money is untouched.
  const b = card(60, { walletApplied: 40, walletRefunded: 40, pay: "Partially refunded", ...refund(40) });
  assert.equal(bookingMoney(b).card, 60);
  // And a 30 refund of cash on top comes off the card.
  const b2 = card(60, { walletApplied: 40, walletRefunded: 40, pay: "Partially refunded", ...refund(70) });
  assert.equal(bookingMoney(b2).card, 30);
});

test("a cancelled booking where the provider kept a fee counts the kept amount only", () => {
  const b = card(50, { status: "Cancelled", pay: "Partially refunded", cancel: { on: "x", by: "x", refund: "approved", amount: 40, refundVia: "card" }, refundLog: [{ label: "Refund approved", amount: 40, on: "x", by: "x" }] });
  assert.deepEqual([bookingMoney(b).counts, bookingMoney(b).card], [true, 10]);
  // A cancelled booking that gave everything back, or whose refund is still waiting to be approved for the lot, keeps nothing.
  const all = card(50, { status: "Cancelled", pay: "Refunded", cancel: { on: "x", by: "x", refund: "approved", amount: 50 }, refundLog: [{ label: "Refund approved", amount: 50, on: "x", by: "x" }] });
  assert.equal(bookingMoney(all).counts, false);
  const waiting = card(50, { status: "Cancelled", cancel: { on: "x", by: "x", refund: "full", amount: 50 } });
  assert.equal(bookingMoney(waiting).counts, false);
});

test("an offline refund comes off the direct part first when a booking was part card, part direct", () => {
  const b = mk({ amount: 100, pay: "Partially refunded", amountPaid: 100, cardPaid: 60, paymentIntentId: "pi", cancel: { on: "x", by: "x", refund: "approved", amount: 30, refundVia: "offline" }, refundLog: [{ label: "Refund approved", amount: 30, on: "x", by: "x" }] });
  const m = bookingMoney(b);
  assert.deepEqual([m.card, m.direct], [60, 10]);
});

test("head office's own bookings owe nothing: they land in 'direct' with no royalty row", () => {
  const r = computePayouts([item(card(100), null), item(card(100), "F1")], { fallbackRate: 10 });
  assert.equal(r.direct.total, 100);
  assert.equal(r.franchises.get("F1")!.royalty, 10);
  assert.equal(r.franchises.size, 1);
});

test("franchise attribution is one rule: the booking's own stamp wins, else its listing's owner, else head office", () => {
  const listings = new Map<string, string | undefined>([["L1", "A"], ["L2", undefined]]);
  assert.equal(franchiseOf({ franchiseId: "B", listingId: "L1" }, listings), "B");
  assert.equal(franchiseOf({ listingId: "L1" }, listings), "A");
  assert.equal(franchiseOf({ listingId: "L2" }, listings), null);
  assert.equal(franchiseOf({}, listings), null);
});

test("known franchises with no bookings still get an all-zero row", () => {
  const r = computePayouts([], { fallbackRate: 10 }, ["F9"]).franchises.get("F9")!;
  assert.deepEqual([r.bookings, r.card, r.net], [0, 0, 0]);
});

test("a rate of 0 means head office keeps nothing; stale or junk history steps are ignored", () => {
  assert.equal(computePayouts([item(card(100))], { history: [{ from: "1970-01-01", rate: 0 }] }).franchises.get("F1")!.hoKeepsCard, 0);
  assert.equal(rateOn([{ from: "nonsense", rate: 50 } as never], "2026-10-01", 12), 12);
});
