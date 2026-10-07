// QA-E2 (7 Oct 2026): rules found while testing "My own link" online sessions end to end.
import test from "node:test";
import assert from "node:assert/strict";
import { bookingJoinable, bookingAwaitingPayOnline, emailShowsOwnLink, validOwnLink } from "../../server/src/lib/onlineRules";
import type { Booking } from "../../features/bookings/types";

const bk = (over: Record<string, unknown>) => ({ status: "Confirmed", pay: "Paid", days: ["2026-10-21"], child: "Ann", kids: [{ name: "Ann", dates: ["2026-10-21"] }], ...over }) as unknown as Booking;
const DAY = "2026-10-21";

test("only a PAID booking unlocks the join link (Paid / Funded / Partially refunded)", () => {
  for (const pay of ["Paid", "Funded", "Partially refunded"]) assert.equal(bookingJoinable(bk({ pay }), DAY), true, pay);
});

test("every not-yet-paid state keeps the link locked (it used to unlock for Invoice sent, voucher, part-paid, any unknown pay word)", () => {
  for (const pay of ["Unpaid", "Invoice sent", "Awaiting voucher payment", "Partially paid", "Pending", "Part paid", "Refunded", "Refund pending", "—"])
    assert.equal(bookingJoinable(bk({ pay }), DAY), false, pay);
});

test("those families are told the link unlocks on payment (not silently shown nothing), except refunded ones", () => {
  for (const pay of ["Unpaid", "Invoice sent", "Awaiting voucher payment", "Partially paid", "Pending"]) assert.equal(bookingAwaitingPayOnline(bk({ pay }), DAY), true, pay);
  for (const pay of ["Paid", "Funded", "Refunded", "Refund pending"]) assert.equal(bookingAwaitingPayOnline(bk({ pay }), DAY), false, pay);
  assert.equal(bookingAwaitingPayOnline(bk({ pay: "Unpaid", status: "Cancelled" }), DAY), false);
});

test("the confirmation EMAIL never prints the provider's own link for an unpaid family, even with 'show the link straight away'", () => {
  const l = { videoMode: "own", ownLink: "https://meet.google.com/abc-defg-hij", showLinkNow: true };
  assert.equal(emailShowsOwnLink(l, true), false);
  assert.equal(emailShowsOwnLink(l, false), true);
  assert.equal(emailShowsOwnLink({ ...l, showLinkNow: false }, false), false); // link appears in My bookings 10 minutes before
  assert.equal(emailShowsOwnLink({ ...l, videoMode: "platform" }, false), false);
  assert.equal(emailShowsOwnLink({ ...l, ownLink: "" }, false), false);
});

test("own-link validation matrix (what a provider may paste)", () => {
  for (const ok of ["https://zoom.us/j/123456789?pwd=abc", "https://meet.google.com/abc-defg-hij", "HTTPS://teams.microsoft.com/l/meetup-join/19%3ameeting", "https://us02web.zoom.us/j/1"]) assert.equal(validOwnLink(ok), true, ok);
  for (const bad of ["http://zoom.us/j/1", "zoom", "javascript:alert(1)", "", "  ", "https://", "https://zoom", "https://a b.com/x", "ftp://zoom.us/j/1", "https://localhost"]) assert.equal(validOwnLink(bad), false, JSON.stringify(bad));
});

import { ukClock, ukDay } from "../../features/onlinesessions/time";
test("session times read in UK time whatever the browser timezone is (14:55 UK, not 17:55)", () => {
  const prev = process.env.TZ;
  for (const tz of ["Asia/Dubai", "America/New_York", "Europe/London"]) {
    process.env.TZ = tz;
    assert.equal(ukClock("2026-10-07T13:55:00.000Z", "en-GB"), "14:55", tz);
    assert.match(ukDay("2026-10-07T23:30:00.000Z", "en-GB"), /^Thu,? 8 Oct$/, tz); // 00:30 BST on the 8th
  }
  process.env.TZ = prev;
});
