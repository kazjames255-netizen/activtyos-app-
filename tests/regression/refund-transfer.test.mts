/**
 * Offline refunds (bank transfer / cash / voucher): the app cannot send the money, so approving only RECORDS the refund
 * ("Refund recorded - awaiting your transfer") until the provider confirms they sent it. Pure: no network, no Firestore.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { refundAwaitingTransfer, refundTransferAmount } from "../../features/bookings/helpers";
import { applyRowAction, markRefundRecorded } from "../../features/bookings/mutations";
import { financeFigures, payIndex } from "../../features/money/financeFigures";
import { daysWaiting } from "../../features/money/refundsToSendRows";
import { refundReminderPeriod, REFUND_REMIND_DAYS } from "../../server/src/lib/refundReminder";
import { refundApprovedSpec, refundSentSpec } from "../../server/src/lib/emailTemplates";
import { bellBody, bellMoney, bellTitle, paymentType, BELL_TITLE_MAX, BELL_BODY_MAX } from "../../server/src/lib/bellText";
import type { Booking } from "../../features/bookings/types";

const bk = (o: Record<string, unknown>): Booking => ({
  bid: "", addons: [], answers: [], note: "", recon: null, evid: null, cancel: null, status: "Cancelled", pay: "Refunded", amount: 0.3, amountPaid: 0.3,
  createdAt: "2026-10-06", booker: "Kaz", email: "k@example.com", listing: "Camp", method: "bank", ...o,
} as unknown as Booking);
const offline = (extra: Record<string, unknown> = {}) => bk({ cancel: { on: "06/10/2026, 10:00", by: "Provider", refund: "approved", amount: 0.3, refundVia: "offline", refundedAt: "2026-10-06T10:05:00Z", ...extra }, refundedApproved: 0.3, refundLog: [{ label: "Refund approved", amount: 0.3, on: "06/10/2026", by: "Provider", source: "Offline" }] });

test("refundAwaitingTransfer: only an approved OFFLINE refund that is not yet sent", async (t) => {
  await t.test("offline approved with no marker (an older refund) counts as awaiting", () => assert.equal(refundAwaitingTransfer(offline()), true));
  await t.test("marker awaiting -> awaiting; marker sent -> not", () => {
    assert.equal(refundAwaitingTransfer(offline({ refundTransfer: "awaiting" })), true);
    assert.equal(refundAwaitingTransfer(offline({ refundTransfer: "sent" })), false);
  });
  await t.test("card and wallet refunds are never awaiting (Stripe / wallet move the money at once)", () => {
    assert.equal(refundAwaitingTransfer(bk({ cancel: { refund: "approved", refundVia: "card", amount: 0.3 } })), false);
    assert.equal(refundAwaitingTransfer(bk({ cancel: { refund: "approved", refundVia: "wallet", amount: 0.3 } })), false);
  });
  await t.test("a refund still waiting for approval is not 'awaiting transfer'", () => assert.equal(refundAwaitingTransfer(bk({ cancel: { refund: "full", amount: 0.3 } })), false));
  await t.test("no cancel record -> false", () => assert.equal(refundAwaitingTransfer(bk({})), false));
});

test("markRefundRecorded + 'refund-sent' state machine", async (t) => {
  await t.test("approving an offline refund records it as awaiting (with a recorded stamp)", () => {
    const b = offline(); markRefundRecorded(b, "offline", false, "prov@x.com");
    assert.equal(b.cancel?.refundTransfer, "awaiting"); assert.ok(b.cancel?.refundRecordedAt); assert.equal(b.cancel?.refundSentAt, undefined);
    assert.equal(refundAwaitingTransfer(b), true);
  });
  await t.test("'I've already sent it' records and confirms in one step, with who", () => {
    const b = offline(); markRefundRecorded(b, "offline", true, "prov@x.com");
    assert.equal(b.cancel?.refundTransfer, "sent"); assert.equal(b.cancel?.refundSentBy, "prov@x.com"); assert.ok(b.cancel?.refundSentAt);
    assert.equal(refundAwaitingTransfer(b), false);
  });
  await t.test("card / wallet refunds are left alone", () => {
    for (const via of ["card", "wallet"] as const) { const b = bk({ cancel: { refund: "approved", amount: 0.3 } }); markRefundRecorded(b, via, false); assert.equal(b.cancel?.refundTransfer, undefined); }
  });
  await t.test("refund-sent flips awaiting -> sent once; a repeat changes nothing (idempotent)", () => {
    const b = offline({ refundTransfer: "awaiting" }); applyRowAction(b, "refund-sent");
    assert.equal(b.cancel?.refundTransfer, "sent"); const at = b.cancel?.refundSentAt; assert.ok(at);
    applyRowAction(b, "refund-sent"); assert.equal(b.cancel?.refundSentAt, at);
  });
  await t.test("refund-sent on a booking that is not awaiting does nothing", () => {
    const b = bk({ cancel: { refund: "approved", refundVia: "card", amount: 0.3 } }); applyRowAction(b, "refund-sent"); assert.equal(b.cancel?.refundTransfer, undefined);
  });
});

test("refundTransferAmount: what is approved, less wallet credit already returned", () => {
  assert.equal(refundTransferAmount(offline()), 0.3);
  assert.equal(refundTransferAmount({ ...offline(), walletRefunded: 0.1 }), 0.2);
  assert.equal(refundTransferAmount({ cancel: { amount: 5 } }), 5);
});

test("Finance: the Refunds figure keeps every recorded refund but says how much is still awaiting transfer", async (t) => {
  const NOW = Date.parse("2026-10-07T12:00:00Z");
  const base = { payIdx: payIndex([], []), months: 6, nowMs: NOW, season: "", venue: "", listingSeason: {}, listingVenue: {}, listingVenueId: {} };
  const card = bk({ ref: "C1", method: "Card", paymentIntentId: "pi_1", cancel: { on: "06/10/2026, 10:00", by: "Provider", refund: "approved", amount: 0.3, refundVia: "card", refundedAt: "2026-10-06T10:05:00Z" }, refundedApproved: 0.3, refundLog: [{ label: "Refund approved", amount: 0.3, on: "06/10/2026", by: "Provider", source: "Card" }] });
  const bank = { ...offline({ refundTransfer: "awaiting" }), ref: "B1" } as Booking;
  const sentBank = { ...offline({ refundTransfer: "sent" }), ref: "B2" } as Booking;
  const f = financeFigures({ ...base, bookings: [card, bank, sentBank] });
  await t.test("all three recorded refunds count: 3 x £0.30", () => assert.equal(Math.round(f.refunds * 100) / 100, 0.9));
  await t.test("only the bank refund still awaiting is flagged: £0.30", () => assert.equal(f.refundsAwaiting, 0.3));
  await t.test("'Refunds to send' lists exactly that booking with its amount", () => {
    assert.equal(f.refundsToSend.length, 1); assert.equal(f.refundsToSend[0].ref, "B1"); assert.equal(f.refundsToSend[0].amount, 0.3);
  });
  await t.test("once sent it leaves the list and the awaiting figure", () => {
    const g = financeFigures({ ...base, bookings: [card, { ...bank, cancel: { ...bank.cancel!, refundTransfer: "sent" } } as Booking, sentBank] });
    assert.equal(g.refundsAwaiting, 0); assert.equal(g.refundsToSend.length, 0); assert.equal(Math.round(g.refunds * 100) / 100, 0.9);
  });
});

test("reminder timing: first after 3 days, then once per 3-day period", () => {
  const made = "2026-10-01T00:00:00Z"; const day = 86_400_000; const t0 = Date.parse(made);
  assert.equal(REFUND_REMIND_DAYS, 3);
  assert.equal(refundReminderPeriod(made, t0 + 2.9 * day), null);
  assert.equal(refundReminderPeriod(made, t0 + 3 * day), 1);
  assert.equal(refundReminderPeriod(made, t0 + 5.9 * day), 1);
  assert.equal(refundReminderPeriod(made, t0 + 6 * day), 2);
  assert.equal(refundReminderPeriod("not a date", t0), null);
  assert.equal(refundReminderPeriod(made, t0 + 61 * day), null, "older than 60 days: stale, no nagging");
  assert.equal(daysWaiting(made, t0 + 4.5 * day), 4);
  assert.equal(daysWaiting("nope", t0), 0);
});

test("family emails: approval says it will be sent by bank transfer, and ONLY the second email says it has been sent", () => {
  const b = offline({ refundTransfer: "awaiting" });
  const approved = refundApprovedSpec(b, "APF");
  assert.match(approved.body, /by bank transfer/); assert.match(approved.body, /email you again/); assert.doesNotMatch(approved.body, /has sent your refund|was sent on/);
  const sent = refundSentSpec(offline({ refundTransfer: "sent", refundSentAt: "2026-10-07T18:00:00Z" }), "APF");
  assert.match(sent.subject, /has been sent/); assert.match(sent.body, /by bank transfer/); assert.match(sent.body, /7 October 2026/); assert.match(sent.body, /£0\.30/);
});

test("provider reminder bell is short and fixed (lib/bellText.ts): 'Refund to send' + ref, 'Bank transfer · £0.30 · 3 days'", () => {
  const title = bellTitle("refundToSend", "APF-10314");
  const body = bellBody([paymentType({ method: "bank", amount: 0.3 }), bellMoney(0.3), "3 days"]);
  assert.equal(title, "Refund to send · APF-10314");
  assert.equal(body, "Bank transfer · £0.30 · 3 days");
  assert.ok(title.length <= BELL_TITLE_MAX && body.length <= BELL_BODY_MAX);
  assert.doesNotMatch(body, /[()]|—|\.\s/, "no sentence, no brackets, no dashes");
});
