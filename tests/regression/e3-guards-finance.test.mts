// QA E3 (online bookings) regression tests: approve / decline / nudge only on the right status; Finance "on the way" counts CARD money only.
import test from "node:test";
import assert from "node:assert/strict";
import { approveBlockedMessage, declineBlockedMessage, nudgeBlockedMessage } from "../../server/src/lib/bookingGuards";
import { financeFigures, payIndex } from "../../features/money/financeFigures";
import type { Booking } from "../../features/bookings/types";

test("approve: only a waiting request (or an already Confirmed no-op) can be approved", () => {
  assert.equal(approveBlockedMessage("Approval needed"), null);
  assert.equal(approveBlockedMessage("Confirmed"), null, "double click is a harmless no-op");
  for (const s of ["Cancelled", "Declined", "Waitlisted", "Offered"]) assert.match(String(approveBlockedMessage(s)), /./, `${s} must be refused`);
  assert.match(String(approveBlockedMessage("Cancelled")), /cancelled/i);
});

test("decline: a Confirmed (paid) booking can't be declined: it is cancelled so the refund is decided", () => {
  for (const s of ["Approval needed", "Waitlisted", "Offered"]) assert.equal(declineBlockedMessage(s), null);
  assert.match(String(declineBlockedMessage("Confirmed")), /Cancel booking/);
  assert.match(String(declineBlockedMessage("Cancelled")), /already cancelled/);
  assert.match(String(declineBlockedMessage("Declined")), /already declined/);
});

test("nudge: no payment reminder for a paid / refunded / cancelled / waitlisted / held booking", () => {
  assert.equal(nudgeBlockedMessage({ status: "Confirmed", pay: "Unpaid", amount: 12.5, amountPaid: 0 }), null);
  assert.match(String(nudgeBlockedMessage({ status: "Confirmed", pay: "Paid", amount: 12.5, amountPaid: 12.5 })), /Nothing is owed/);
  assert.match(String(nudgeBlockedMessage({ status: "Cancelled", pay: "Refunded", amount: 12.5, amountPaid: 12.5 })), /cancelled or declined/);
  assert.match(String(nudgeBlockedMessage({ status: "Waitlisted", pay: "Unpaid", amount: 12.5 })), /waiting list/);
  assert.match(String(nudgeBlockedMessage({ status: "Approval needed", pay: "Unpaid", amount: 12.5, cardHold: { state: "held" } })), /already held/);
});

const bk = (o: Record<string, unknown>): Booking => ({ bid: "", addons: [], answers: [], note: "", recon: null, evid: null, cancel: null, status: "Confirmed", pay: "Unpaid", amount: 0, createdAt: "2026-10-05", ...o } as unknown as Booking);

test("Finance: store credit spent on a card booking is NOT card money (payout estimate)", () => {
  const NOW = Date.parse("2026-10-07T12:00:00Z");
  const base = { payIdx: payIndex([], []), months: 1, nowMs: NOW, season: "", venue: "", listingSeason: {}, listingVenue: {}, listingVenueId: {} };
  // £12.50 booking: £5 store credit + £7.50 on the card (amount is already net of the credit)
  const wallet = bk({ ref: "W1", amount: 7.5, amountPaid: 7.5, pay: "Paid", method: "Card", walletApplied: 5 });
  const plain = bk({ ref: "P1", amount: 7.5, amountPaid: 7.5, pay: "Paid", method: "Card" });
  const a = financeFigures({ ...base, bookings: [wallet] });
  const b = financeFigures({ ...base, bookings: [plain] });
  assert.equal(Math.round(a.inTransit * 100), Math.round(b.inTransit * 100), "the wallet part must not add to the card payout estimate");
  assert.ok(a.inTransit < 7.5, "net of card fees, never above the £7.50 actually charged");
});
