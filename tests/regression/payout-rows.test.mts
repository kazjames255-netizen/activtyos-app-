/**
 * Card payouts (Stripe) page: the transaction table and the four tiles must agree, and a card payment that was cancelled and refunded to the
 * card must show as Refunded / net £0.00 and count for nothing as money on its way (Kaz, 7 Oct: APF-10330).
 * Pure: no network, no Firestore.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { financeFigures, payIndex, payoutRows, type PaymentRecord } from "../../features/money/financeFigures";
import type { Booking } from "../../features/bookings/types";

const bk = (o: Record<string, unknown>): Booking => ({
  bid: "", addons: [], answers: [], note: "", recon: null, evid: null, cancel: null, status: "Confirmed", pay: "Unpaid", amount: 0,
  createdAt: "2026-10-07T10:00:00.000Z", ...o,
} as unknown as Booking);
const charge = (id: string, ref: string, amount: number, pi: string, at = "2026-10-07T10:00:00.000Z", extra: Record<string, unknown> = {}): PaymentRecord =>
  ({ id, refs: [ref], amount, status: "succeeded", paymentIntentId: pi, createdAt: at, method: "Card", ...extra }) as PaymentRecord;
const refund = (id: string, ref: string, amount: number, pi: string | undefined, extra: Record<string, unknown> = {}): PaymentRecord =>
  ({ id, refs: [ref], amount, type: "refund", status: "succeeded", createdAt: "2026-10-07T12:00:00.000Z", ...(pi ? { paymentIntentId: pi } : {}), ...extra }) as PaymentRecord;

const NOW = Date.parse("2026-10-07T18:00:00.000Z");
const figures = (bookings: Booking[], payments: PaymentRecord[]) =>
  financeFigures({ bookings, payIdx: payIndex(bookings, payments), months: 6, nowMs: NOW, season: "", venue: "", listingSeason: {}, listingVenue: {}, listingVenueId: {} });

// ── fixtures ──
const CANCELLED_REFUNDED = bk({ ref: "APF-10330", amount: 0.3, amountPaid: 0.3, pay: "Refunded", status: "Cancelled", method: "card", refundedApproved: 0.3, cancel: { on: "2026-10-07", by: "Provider", refund: "approved", amount: 0.3, refundVia: "card" } });
const PAID = bk({ ref: "APF-10331", amount: 0.3, amountPaid: 0.3, pay: "Paid", method: "card" });
const PART = bk({ ref: "APF-10340", amount: 1, amountPaid: 1, pay: "Partially refunded", method: "card", refundedApproved: 0.4, cancel: { on: "2026-10-07", by: "Provider", refund: "approved", amount: 0.4, refundVia: "card" } });
const HELD_CAPTURED = bk({ ref: "APF-10327", amount: 0.6, amountPaid: 0.6, pay: "Paid", method: "card", cardHold: { state: "captured", amount: 0.6 } });
const BANK = bk({ ref: "APF-10314", amount: 0.3, amountPaid: 0.3, pay: "Paid", method: "bank" });

test("payoutRows: a cancelled + refunded card payment is Refunded with net £0.00", () => {
  const rows = payoutRows([charge("p1", "APF-10330", 0.3, "pi_1"), refund("r1", "APF-10330", 0.3, "pi_1")]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].state, "refunded");
  assert.equal(rows[0].gross, 0.3);
  assert.equal(rows[0].refunded, 0.3);
  assert.equal(rows[0].net, 0);
  assert.equal(rows[0].refundedAt, "2026-10-07T12:00:00.000Z");
});

test("payoutRows: a part refund is 'part' and keeps the rest", () => {
  const rows = payoutRows([charge("p1", "APF-10340", 1, "pi_2"), refund("r1", "APF-10340", 0.4, "pi_2")]);
  assert.equal(rows[0].state, "part");
  assert.equal(rows[0].net, 0.6);
});

test("payoutRows: an untouched charge is 'paid'; a held-card capture is an ordinary succeeded charge; a hold not yet captured is not a row", () => {
  const rows = payoutRows([
    charge("p1", "APF-10331", 0.3, "pi_3"),
    charge("p2", "APF-10327", 0.6, "pi_4", "2026-10-07T11:00:00.000Z", { hold: true }),
    charge("p3", "APF-10399", 0.3, "pi_5", "2026-10-07T11:30:00.000Z", { hold: true, status: "held" }),
  ]);
  assert.deepEqual(rows.map((r) => [r.refs[0], r.state]).sort(), [["APF-10327", "paid"], ["APF-10331", "paid"]]);
});

test("payoutRows: wallet / offline (bank) refunds never count as going back to the card; bank transfers are not rows at all", () => {
  const rows = payoutRows([
    charge("p1", "APF-10331", 0.3, "pi_3"),
    refund("r1", "APF-10331", 0.3, undefined, { method: "wallet", via: "wallet", status: "credited" }),
    refund("r2", "APF-10331", 0.3, undefined, { method: "offline", offline: true, status: "to-reimburse" }),
    { id: "b1", refs: ["APF-10314"], amount: 0.3, status: "recorded", method: "bank", createdAt: "2026-10-06T10:00:00.000Z" } as PaymentRecord,
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].state, "paid");
});

test("payoutRows: an older refund row with no PaymentIntent is matched by booking ref, once", () => {
  const rows = payoutRows([charge("p1", "APF-10330", 0.3, "pi_1"), refund("r1", "APF-10330", 0.3, undefined)]);
  assert.equal(rows[0].state, "refunded");
});

test("tiles and table agree: a refunded card payment is £0 on the way / in the bank; the fee is still on the gross; bank money is not in the card net", () => {
  const bookings = [CANCELLED_REFUNDED, PAID, PART, HELD_CAPTURED, BANK];
  const payments = [
    charge("p1", "APF-10330", 0.3, "pi_1"), refund("r1", "APF-10330", 0.3, "pi_1"),
    charge("p2", "APF-10331", 0.3, "pi_3"),
    charge("p3", "APF-10340", 1, "pi_2"), refund("r3", "APF-10340", 0.4, "pi_2"),
    charge("p4", "APF-10327", 0.6, "pi_4", "2026-10-07T11:00:00.000Z", { hold: true }),
    { id: "b1", refs: ["APF-10314"], amount: 0.3, status: "recorded", method: "bank", createdAt: "2026-10-06T10:00:00.000Z" } as PaymentRecord,
  ];
  const a = figures(bookings, payments);
  const rows = payoutRows(payments);
  // table: 4 card charges (bank is not a row); net of the refunds
  assert.equal(rows.length, 4);
  const tableNet = Math.round(rows.reduce((s, r) => s + r.net, 0) * 100) / 100;
  assert.equal(tableNet, 1.5); // 0 + 0.3 + 0.6 + 0.6
  // tiles: card gross 2.2, back to card 0.7, fees 4 x 0.2 + 1.4% of 2.2
  assert.equal(a.cardGross, 2.2);
  assert.equal(a.cardBack, 0.7);
  assert.equal(Math.round(a.fees * 100) / 100, Math.round((4 * 0.2 + 0.014 * 2.2) * 100) / 100);
  assert.equal(a.cardNet, Math.round((2.2 - 0.7 - a.fees) * 100) / 100);
  // the table's net == card gross - what went back to the card
  assert.equal(tableNet, Math.round((a.cardGross - a.cardBack) * 100) / 100);
  // the refunded APF-10330 contributes £0 to on-the-way (all four events are inside the last 7 days)
  const fee = (g: number) => g * 0.014 + 0.2;
  const expectedOnWay = Math.max(0, 0.3 - fee(0.3)) + Math.max(0, 0.6 - fee(1)) + Math.max(0, 0.6 - fee(0.6)) + 0; // 10330 -> 0
  assert.ok(Math.abs(a.inTransit - expectedOnWay) < 0.011, `inTransit ${a.inTransit} vs ${expectedOnWay}`);
  assert.equal(a.inBank, 0);
  // the bank-transfer booking is not in any card figure
  assert.ok(a.collected > a.cardGross - a.cardBack, "collected (all methods) is bigger than the card-only money");
});
