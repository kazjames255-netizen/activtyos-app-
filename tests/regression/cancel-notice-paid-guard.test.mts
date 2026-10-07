/**
 * Overnight-test fixes (7 Oct 2026): the family's cancellation notice, "Mark paid" refused on dead bookings,
 * one "Booking confirmed" per confirmation, and a parent-cancelled paid booking reading "Refund pending".
 * Pure checks only: no firebase imports (the guards live in their own database-free file).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bookingCancelledSpec, cancelMoneyLine } from "../../server/src/lib/emailTemplates";
import { canMarkPaid, paidBlockedMessage, shouldEmailConfirmed, shouldNotifyCancelled } from "../../server/src/lib/bookingGuards";
import { applyCancel, applyParentCancel, markRefundPending } from "../../features/bookings/mutations";
import { payLabelFor } from "../../features/bookings/helpers";
import type { Booking } from "../../features/bookings/types";

const mk = (over: Partial<Booking> = {}) =>
  ({ ref: "APF-9", booker: "Kaz", child: "Jack", listing: "October half term", email: "k@x.com", status: "Confirmed", pay: "Paid", amount: 40, amountPaid: 40, method: "Card", days: ["2026-10-26"], dates: "Mon 26 Oct 2026", tenantId: "t1", ...over }) as unknown as Booking;

test("cancellation notice: subject, child, date and the money in one sentence", () => {
  const b = mk();
  applyCancel(b, "full");
  const m = bookingCancelledSpec(b, "APF", { by: "provider", paid: 40 });
  assert.equal(m.subject, "Your booking for October half term is cancelled");
  assert.match(m.body, /Jack/);
  assert.match(m.body, /Mon 26 Oct 2026/);
  assert.match(m.body, /refund of £40\.00 is pending/);
  assert.match(m.bell.title, /^October half term cancelled · £40\.00 refund pending$/);
});

test("money line covers wallet credit, nothing owed and no refund per policy", () => {
  const w = mk({ cancel: { on: "x", by: "Booker", refund: "full", amount: 40, refundTo: "wallet" } as Booking["cancel"] });
  assert.match(cancelMoneyLine(w, "APF", 40).full, /added to your wallet/);
  const none = mk({ cancel: { on: "x", by: "Booker", refund: "none", amount: 0 } as Booking["cancel"] });
  assert.match(cancelMoneyLine(none, "APF", 40).full, /No refund is due under the cancellation policy/);
  assert.equal(cancelMoneyLine(none, "APF", 40).short, "no refund");
  assert.match(cancelMoneyLine(none, "APF", 0).full, /nothing is owed/i);
});

test("the family is told once: only when a live booking flips to Cancelled", () => {
  assert.equal(shouldNotifyCancelled("Confirmed", "Cancelled"), true);
  assert.equal(shouldNotifyCancelled("Approval needed", "Cancelled"), true);
  assert.equal(shouldNotifyCancelled("Cancelled", "Cancelled"), false); // repeat call
  assert.equal(shouldNotifyCancelled("Offered", "Cancelled"), false); // turned down an offer
  assert.equal(shouldNotifyCancelled("Waitlisted", "Cancelled"), false);
  assert.equal(shouldNotifyCancelled("Confirmed", "Confirmed"), false);
});

test("the cancellation switch exists, defaults ON, and is listed in the Email screen", () => {
  const auto = readFileSync(new URL("../../server/src/lib/autoEmails.ts", import.meta.url), "utf8");
  assert.match(auto.slice(auto.indexOf("AUTO_EMAIL_DEFAULTS")), /cancellation: true/);
  assert.match(readFileSync(new URL("../../features/email/EmailApp.tsx", import.meta.url), "utf8"), /key: "cancellation"/);
  assert.match(readFileSync(new URL("../../lib/settings.ts", import.meta.url), "utf8"), /autoEmails: \{ bookings: true, cancellation: true/);
});

test("both cancel routes wire the notice on the status flip", () => {
  const ops = readFileSync(new URL("../../server/src/routes/bookings.ts", import.meta.url), "utf8");
  const my = readFileSync(new URL("../../server/src/routes/my.ts", import.meta.url), "utf8");
  assert.match(ops, /shouldNotifyCancelled\(statusBefore, updated\.status\)/);
  assert.match(my, /shouldNotifyCancelled\(statusBefore, updated\.status\)\) void notifyFamilyCancelledFor/);
  // the refund-approved email is untouched
  assert.match(ops, /emailRefundApproved\(updated/);
});

test("Mark paid is refused (409) on cancelled / declined / waitlisted / offered bookings", () => {
  for (const s of ["Cancelled", "Declined", "Waitlisted", "Offered"]) assert.equal(canMarkPaid(s), false, s);
  for (const s of ["Confirmed", "Approval needed", "Pending"]) assert.equal(canMarkPaid(s), true, s);
  assert.equal(paidBlockedMessage("Cancelled"), "This booking is cancelled, so it can't be marked paid. Reopen it first.");
  const ops = readFileSync(new URL("../../server/src/routes/bookings.ts", import.meta.url), "utf8");
  assert.match(ops, /action\.type === "paid" && !canMarkPaid\(b\.status\)\)\s*\n\s*throw new Conflict\(paidBlockedMessage/);
});

test("Mark paid buttons are hidden for cancelled / declined bookings in the list and the detail", () => {
  const list = readFileSync(new URL("../../features/bookings/BookingsList.tsx", import.meta.url), "utf8");
  const detail = readFileSync(new URL("../../features/bookings/BookingDetail.tsx", import.meta.url), "utf8");
  assert.match(list, /Awaiting voucher payment" && !off && b\.status !== "Cancelled" && b\.status !== "Declined"/);
  assert.match(detail, /Awaiting voucher payment" && b\.status !== "Cancelled" && b\.status !== "Declined"/);
});

test("approve / promote on an already-Confirmed booking sends no second 'Booking confirmed'", () => {
  assert.equal(shouldEmailConfirmed("approve", "Approval needed"), true);
  assert.equal(shouldEmailConfirmed("promote", "Waitlisted"), true);
  assert.equal(shouldEmailConfirmed("approve", "Confirmed"), false);
  assert.equal(shouldEmailConfirmed("promote", "Confirmed"), false);
});

test("a parent-cancelled paid booking reads 'Refund pending', like an operator cancel", () => {
  const b = mk();
  applyParentCancel(b, "changed plans");
  b.cancel!.amount = 40;
  b.cancel!.refund = "full";
  markRefundPending(b);
  assert.equal(b.pay, "Refund pending");
  assert.equal(payLabelFor(b), "Refund pending");
  // nothing refundable -> unchanged; unpaid -> unchanged
  const none = mk();
  applyParentCancel(none);
  none.cancel!.amount = 0;
  none.cancel!.refund = "none";
  markRefundPending(none);
  assert.equal(none.pay, "Paid");
  const unpaid = mk({ pay: "Unpaid" });
  applyParentCancel(unpaid);
  markRefundPending(unpaid);
  assert.equal(unpaid.pay, "Unpaid");
});
