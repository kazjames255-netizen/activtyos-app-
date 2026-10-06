/**
 * Regression tests from the 6 Oct refund / waiting-list / email triage (pure: no network, no Firestore).
 *  - approving a cancellation whose policy gives nothing back must NOT flip the booking to "Refunded" (POL-10312: Refunded with £0 returned).
 *  - editing a listing's capacity fields must wake the waiting list (WLT-10348: capacity raised, family never offered the free place).
 *  - the email invariants key mail to ONE checkout by time, so e2e re-runs sharing an address + listing name stop raising false alarms,
 *    and still flag the real thing (two confirmations for one checkout, a confirmation before a card payment settles).
 * Server-side counterparts (not pure, covered by the e2e specs): routes/bookings.ts refund-approve throws Conflict for a "none"/£0 refund;
 * routes/my.ts decline-offer now writes a cancel record.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { applyRowAction } from "../../features/bookings/mutations";
import { touchesCapacity } from "../../server/src/lib/publicListing";
import { INVARIANTS } from "../../server/tools/assure/invariants";
import type { Snapshot, SnapBooking } from "../../server/tools/assure/types";
import type { Booking } from "../../features/bookings/types";

const bk = (over: Record<string, unknown>) => over as unknown as Booking;

test("refund-approve on a cancellation whose policy refunds nothing does not mark the booking Refunded", () => {
  for (const cancel of [{ refund: "none", amount: 0 }, { refund: "approved", amount: 0 }, { refund: "pending", amount: 0 }]) {
    const b = bk({ status: "Cancelled", pay: "Paid", amount: 54, method: "Cash", payments: [], cancel: { on: "x", by: "Booker", ...cancel } });
    applyRowAction(b, "refund-approve");
    assert.notEqual(b.pay, "Refunded", `cancel ${JSON.stringify(cancel)} must stay ${"Paid"}`);
  }
});

test("refund-approve on a cancellation with money to give back still marks it Refunded", () => {
  const b = bk({ status: "Cancelled", pay: "Refund pending", amount: 54, method: "Cash", cancel: { on: "x", by: "Booker", refund: "full", amount: 54 } });
  applyRowAction(b, "refund-approve");
  assert.equal(b.pay, "Refunded");
  assert.equal(b.cancel?.refund, "approved");
});

test("capacity-related listing edits wake the waiting list; unrelated edits do not", () => {
  for (const f of ["maxAttendees", "capacityScope", "ticketOverrides", "ageCaps", "ageCapsOn", "waitlistMode"]) assert.equal(touchesCapacity({ [f]: 1 }), true, f);
  assert.equal(touchesCapacity({ description: "x", name: "y" }), false);
});

// ---- invariants: time-keyed email rules ----
const T0 = Date.parse("2026-10-06T09:00:00Z");
const at = (sec: number) => new Date(T0 + sec * 1000).toISOString();
const book = (ref: string, sec: number, over: Partial<SnapBooking> = {}): SnapBooking => ({
  id: ref, ref, listingId: "L1", blockId: "B1", tenantId: "T", email: "p@x.test", status: "Confirmed", pay: "Paid", amount: 20, received: 20, refunded: 0, days: [], seats: 1, kidsLive: 1,
  method: "card", createdAt: at(sec), listingName: "Camp", paymentIntentId: "pi_" + ref, ...over,
});
const snap = (bookings: SnapBooking[], emailsSent: Snapshot["emailsSent"], payments: Snapshot["payments"] = []): Snapshot =>
  ({ tenantId: "T", takenAt: at(100_000), bookings, blocks: [], payments, listings: [], emailsSent });
const rule = (id: string) => INVARIANTS.find((i) => i.id === id)!;
const mail = (sec: number) => ({ to: "p@x.test", subject: "Booking confirmed — Camp", kind: "booking-confirmed", at: at(sec) });
const pay = (ref: string, sec: number) => ({ id: "p" + ref, refs: [ref], amount: 20, status: "succeeded", createdAt: at(sec), paidAt: at(sec), email: "p@x.test", paymentIntentId: "pi_" + ref });

test("one-confirmation-per-checkout: an e2e re-run hours later (same address + listing) is not blamed on the first checkout", () => {
  const s = snap([book("A", 0), book("B", 7200)], [mail(2), mail(7202)]);
  assert.equal(rule("email.one-confirmation-per-checkout").check(s).length, 0);
});

test("one-confirmation-per-checkout: two quick separate checkouts each send one email, but a THIRD email for them is flagged", () => {
  const two = snap([book("A", 0), book("B", 1.5)], [mail(2), mail(3.5)]);
  assert.equal(rule("email.one-confirmation-per-checkout").check(two).length, 0);
  const three = snap([book("A", 0), book("B", 1.5)], [mail(2), mail(3.5), mail(5)]);
  assert.equal(rule("email.one-confirmation-per-checkout").check(three).length, 1);
});

test("one-confirmation-per-checkout: a duplicate email for one checkout is flagged (positive control)", () => {
  const s = snap([book("A", 0)], [mail(2), mail(4)]);
  assert.equal(rule("email.one-confirmation-per-checkout").check(s).length, 1);
});

test("no-confirmation-before-card-payment: flags a confirmation minutes before the gateway payment, ignores a later re-run's mail and hand-recorded payments", () => {
  const early = snap([book("A", 0)], [mail(2)], [pay("A", 300)]);
  assert.equal(rule("email.no-confirmation-before-card-payment").check(early).length, 1);
  const ok = snap([book("A", 0), book("B", 7200)], [mail(302), mail(7202)], [pay("A", 300), pay("B", 7200)]);
  assert.equal(rule("email.no-confirmation-before-card-payment").check(ok).length, 0);
  const seeded = snap([book("S", 0, { paymentIntentId: undefined })], [mail(2)], [{ ...pay("S", 300), paymentIntentId: undefined, status: "recorded" }]);
  assert.equal(rule("email.no-confirmation-before-card-payment").check(seeded).length, 0);
});

test("waitlisted-never-confirmed: only mail after THIS booking was made counts, a later confirmed re-run does not", () => {
  const w = book("W", 7200, { status: "Waitlisted", pay: "Unpaid", method: "Cash" });
  const stale = snap([w], [mail(7200 - 100)]);
  assert.equal(rule("email.waitlisted-never-confirmed").check(stale).length, 0);
  const real = snap([w], [mail(7202)]);
  assert.equal(rule("email.waitlisted-never-confirmed").check(real).length, 1);
});

test("seeded OS-A / OS-B fixtures do not trip the doc-hunting rules; the same shape on a real ref still does", () => {
  const shape = (ref: string) => [book(ref, 0, { status: "Cancelled", pay: "Paid", cancel: null, blockMissing: true }), book(ref + "x", 1, { method: "card", paymentIntentId: undefined, blockMissing: true })];
  for (const id of ["state.cancelled-has-cancel-info", "state.refs-resolve", "money.card-paid-has-payment"]) {
    assert.equal(rule(id).check(snap(shape("OS-B1"), [])).filter((v) => v.refs?.[0] === "OS-B1" || v.refs?.[0] === "OS-B1x").length, 0, id + " (seeded)");
  }
  assert.ok(rule("state.cancelled-has-cancel-info").check(snap(shape("POL-1"), [])).length >= 1, "real ref still flagged");
});

test("refund-records-bounded: a card booking with no gateway trace at all (test-seeded) is skipped, a real over-refund is not", () => {
  const seeded = book("P1", 0, { paymentIntentId: undefined, walletApplied: 30, amount: 24, pay: "Refunded" });
  const refunds = (ref: string) => [{ id: "r1" + ref, refs: [ref], amount: 30, status: "credited", type: "refund" }, { id: "r2" + ref, refs: [ref], amount: 24, status: "to-reimburse", type: "refund" }];
  assert.equal(rule("money.refund-records-bounded").check(snap([seeded], [], refunds("P1"))).length, 0);
  const real = book("P2", 0, { walletApplied: 0, pay: "Refunded" });
  assert.equal(rule("money.refund-records-bounded").check(snap([real], [], [pay("P2", 1), { id: "x", refs: ["P2"], amount: 40, status: "succeeded", type: "refund" }])).length, 1);
});
