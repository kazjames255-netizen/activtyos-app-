// Refunds on a booking paid partly with WALLET credit (9 Oct 2026 owner decision): the refund is split PROPORTIONALLY to what each source paid
// (wallet vs card vs cash/offline). The policy decides the total; this only splits it. Pure: no database.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitRefundBySource, walletShareOfRefund, walletShareFor, refundPoolOf } from "../../features/bookings/refundSplit";
import { splitRefundByMethod } from "../../server/src/lib/refundSplit";
import type { Booking } from "../../features/bookings/types";

const sum = (s: { wallet: number; card: number; offline: number }) => Math.round((s.wallet + s.card + s.offline) * 100) / 100;

describe("splitRefundBySource: proportional to what each source paid", () => {
  it("wallet-only booking: everything goes back to the wallet", () => {
    assert.deepEqual(splitRefundBySource(50, { wallet: 100, card: 0, offline: 0 }), { wallet: 50, card: 0, offline: 0 });
  });
  it("wallet + card: 100 = 30 + 70, refund 50 -> 15 wallet + 35 card", () => {
    assert.deepEqual(splitRefundBySource(50, { wallet: 30, card: 70, offline: 0 }), { wallet: 15, card: 35, offline: 0 });
  });
  it("wallet + cash: 100 = 30 + 70 cash, refund 50 -> 15 wallet + 35 offline", () => {
    assert.deepEqual(splitRefundBySource(50, { wallet: 30, card: 0, offline: 70 }), { wallet: 15, card: 0, offline: 35 });
  });
  it("wallet + cash + card: 100 = 20 + 30 + 50, refund 50 -> 10 + 15 + 25", () => {
    assert.deepEqual(splitRefundBySource(50, { wallet: 20, card: 50, offline: 30 }), { wallet: 10, card: 25, offline: 15 });
  });
  it("a full refund returns every source exactly", () => {
    assert.deepEqual(splitRefundBySource(100, { wallet: 30, card: 50, offline: 20 }), { wallet: 30, card: 50, offline: 20 });
  });
  it("zero refund moves nothing; no wallet = the old card/offline split", () => {
    assert.deepEqual(splitRefundBySource(0, { wallet: 30, card: 70, offline: 0 }), { wallet: 0, card: 0, offline: 0 });
    const m = splitRefundByMethod(60, 50, 50);
    assert.deepEqual(splitRefundBySource(60, { wallet: 0, card: 50, offline: 50 }), { wallet: 0, ...m });
  });
  it("clamps: more than the sources hold never over-credits the wallet or the card (the excess is owed offline, as before)", () => {
    const s = splitRefundBySource(150, { wallet: 30, card: 70, offline: 0 });
    assert.equal(s.wallet, 30); assert.equal(s.card, 70); assert.equal(s.offline, 50); assert.equal(sum(s), 150);
  });
  it("negative / nonsense sources are treated as zero", () => {
    assert.deepEqual(splitRefundBySource(10, { wallet: -5, card: 20, offline: 0 }), { wallet: 0, card: 10, offline: 0 });
  });
  it("odd amounts: pennies are never lost or invented (total always equals the refund), 500 random cases", () => {
    let seed = 7; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    for (let i = 0; i < 500; i++) {
      const wallet = Math.round(rnd() * 8000) / 100, card = Math.round(rnd() * 8000) / 100, offline = Math.round(rnd() * 3000) / 100;
      const pool = wallet + card + offline;
      const owed = Math.round(rnd() * pool * 100) / 100;
      const s = splitRefundBySource(owed, { wallet, card, offline });
      assert.equal(sum(s), owed, JSON.stringify({ wallet, card, offline, owed, s }));
      assert.ok(s.wallet <= wallet + 0.001 && s.card <= card + 0.001 && s.offline <= offline + 0.011, JSON.stringify({ wallet, card, offline, owed, s }));
      assert.ok(s.wallet >= 0 && s.card >= 0 && s.offline >= 0);
    }
  });
  it("odd penny: £10 paid = £3.33 wallet + £6.67 card, refund £5 -> the wallet share is rounded, the odd penny stays with the card (1.66 + 3.34)", () => {
    assert.deepEqual(splitRefundBySource(5, { wallet: 3.33, card: 6.67, offline: 0 }), { wallet: 1.66, card: 3.34, offline: 0 });
  });
});

describe("walletShareOfRefund / walletShareFor", () => {
  it("is the refund's proportional share, never more than the wallet still holds", () => {
    assert.equal(walletShareOfRefund(50, 30, 100), 15);
    assert.equal(walletShareOfRefund(100, 30, 100), 30);
    assert.equal(walletShareOfRefund(50, 300, 100), 50); // (wallet capped at the pool)
    assert.equal(walletShareOfRefund(0, 30, 100), 0);
    assert.equal(walletShareOfRefund(50, 0, 100), 0);
  });
  it("on a booking: gross 100 paid 30 wallet + 70 card, policy gives 50 -> 15", () => {
    const b = { pay: "Paid", amount: 70, amountPaid: 70, walletApplied: 30 } as Booking;
    assert.equal(walletShareFor(b, 50), 15);
  });
  it("a second refund uses what the wallet still holds (walletRefunded) over what is still refundable", () => {
    // paid 100 (30 + 70); first refund 50 gave 15 wallet back and 35 card back.
    const b = { pay: "Partially refunded", amount: 70, amountPaid: 70, walletApplied: 30, walletRefunded: 15, refundedApproved: 50 } as Booking;
    assert.equal(walletShareFor(b, 25), 7.5);
    assert.equal(walletShareFor(b, 50), 15);
  });
  it("a no-refund policy (total 0) gives the wallet nothing: the policy decides the total", () => {
    const b = { pay: "Paid", amount: 70, amountPaid: 70, walletApplied: 30 } as Booking;
    assert.equal(walletShareFor(b, 0), 0);
  });
});

describe("the split pool is what each source really holds, never the price", () => {
  it("wallet 30 paid, rest unpaid, after a cancel flipped the label to Refund pending: pool 30, all of it wallet", () => {
    const b = { pay: "Refund pending", amount: 70, amountPaid: 0, walletApplied: 30, cashHeld: 0 } as Booking;
    assert.deepEqual(refundPoolOf(b), { pool: 30, wallet: 30, cash: 0 });
    assert.equal(walletShareFor(b, 30), 30);
  });
  it("wallet 30 + cash 20 paid of 100 (label Refund pending): pool 50; refund 25 -> 15 wallet, refund 50 -> 30 wallet", () => {
    const b = { pay: "Refund pending", amount: 70, amountPaid: 20, walletApplied: 30 } as Booking;
    assert.equal(refundPoolOf(b).pool, 50);
    assert.equal(walletShareFor(b, 25), 15);
    assert.equal(walletShareFor(b, 50), 30);
  });
});
