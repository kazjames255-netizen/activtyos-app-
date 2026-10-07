/**
 * ONE reminders log per booking (Resend invoice, Chase and the automatic reminder all count in it), a 30-second double-click guard, and a
 * resent / chased email that says it is a REMINDER (Kaz, 7 Oct: the resent email was identical to the first). Pure: no network, no Firestore.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { RESEND_COOLDOWN_MS, nextInvoiceResends, remindersPatch, reminderDateLabel, resendWaitSeconds } from "../../server/src/lib/invoiceResend";
import { paymentLinkSpec } from "../../server/src/lib/emailTemplates";
import type { Booking } from "../../features/bookings/types";

const T0 = "2026-10-07T18:50:00.000Z";
const bk = { ref: "APF-10325", listing: "October half term", booker: "Kaz", child: "sally", amount: 0.6 } as unknown as Booking;

test("count: every reminder adds one to the same log; the first send date is kept", () => {
  const p1 = remindersPatch({ createdAt: "2026-10-07T11:56:00.000Z" }, T0, "Provider");
  assert.equal(p1.invoiceResends.count, 1);
  assert.equal(p1.invoiceResends.lastAt, T0);
  assert.equal(p1.invoiceSentAt, "2026-10-07T11:56:00.000Z");
  const p2 = remindersPatch({ invoiceResends: p1.invoiceResends, invoiceSentAt: p1.invoiceSentAt }, "2026-10-07T19:53:00.000Z", "automatic reminder");
  assert.equal(p2.invoiceResends.count, 2);
  assert.equal(p2.invoiceResends.lastBy, "automatic reminder");
  assert.equal(p2.invoiceSentAt, "2026-10-07T11:56:00.000Z");
});

test("the legacy Reconciliation fields (nudges / lastNudgedAt) stay in step so the bell there never contradicts the count", () => {
  const p = remindersPatch({ invoiceResends: { count: 2, lastAt: T0 } }, "2026-10-07T20:00:00.000Z", "x");
  assert.equal(p.nudges, 3);
  assert.equal(p.lastNudgedAt, "2026-10-07T20:00:00.000Z");
  assert.equal(p.nudges, p.invoiceResends.count);
});

test("30 s guard: a second send inside 30 seconds is refused with the seconds left; after 30 s it is allowed", () => {
  const rec = nextInvoiceResends(undefined, T0, "Provider");
  const t0 = Date.parse(T0);
  assert.equal(resendWaitSeconds(undefined, t0), 0);
  assert.equal(resendWaitSeconds(rec, t0 + 1000), 29);
  assert.equal(resendWaitSeconds(rec, t0 + RESEND_COOLDOWN_MS - 1), 1);
  assert.equal(resendWaitSeconds(rec, t0 + RESEND_COOLDOWN_MS), 0);
  assert.equal(resendWaitSeconds(rec, t0 + 3_600_000), 0);
});

test("wording: the first email is unchanged; a resend / chase says REMINDER N and when we first emailed", () => {
  const first = paymentLinkSpec(bk, "APF Activity Camps", "https://x/pay");
  assert.equal(first.subject, "Complete your booking — October half term");
  assert.equal(first.title, "Your booking is reserved — payment inside");
  assert.doesNotMatch(first.body, /reminder/i);
  const rem = paymentLinkSpec(bk, "APF Activity Camps", "https://x/pay", false, { n: 2, firstAt: reminderDateLabel("2026-10-07T11:56:00.000Z") });
  assert.equal(rem.subject, "Reminder: complete your booking — October half term");
  assert.equal(rem.title, "Reminder: your booking is reserved — payment inside");
  assert.match(rem.body, /This is reminder 2\./);
  assert.match(rem.body, /We first emailed you on 7 October 2026\./);
  assert.match(rem.body, /Pay £0\.60 securely/); // same pay button
});

test("the 'approved, please pay' email is not turned into a reminder", () => {
  const ap = paymentLinkSpec(bk, "APF", "https://x/pay", true, { n: 1 });
  assert.match(ap.subject, /approved/i);
});
