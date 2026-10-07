import test from "node:test";
import assert from "node:assert/strict";
import { joinState, validOwnLink, bookingAwaitingPayOnline } from "../../server/src/lib/onlineRules";
import type { Booking } from "../../features/bookings/types";

const T0 = Date.parse("2026-10-21T09:00:00Z");
const base = { mode: "platform" as const, opensAt: T0 - 10 * 60_000, closesAt: T0 + 120 * 60_000, hostLive: false, hasLink: false };

test("unpaid: the join link is locked, whatever the time or host", () => {
  assert.equal(joinState({ ...base, paid: false, now: T0 - 86_400_000 }), "unpaid");
  assert.equal(joinState({ ...base, paid: false, now: T0, hostLive: true }), "unpaid");
});

test("paid, our room: early -> waiting for host -> open", () => {
  assert.equal(joinState({ ...base, paid: true, now: T0 - 3600_000 }), "early");
  assert.equal(joinState({ ...base, paid: true, now: T0 - 5 * 60_000 }), "waiting_host");
  assert.equal(joinState({ ...base, paid: true, now: T0 - 5 * 60_000, hostLive: true }), "open");
});

test("paid, own link: early_own until the window (or showLinkNow), no_link when the provider added none", () => {
  const own = { ...base, mode: "own" as const, hasLink: true };
  assert.equal(joinState({ ...own, paid: true, now: T0 - 3600_000 }), "early_own");
  assert.equal(joinState({ ...own, paid: true, now: T0 - 3600_000, showLinkNow: true }), "open");
  assert.equal(joinState({ ...own, paid: true, now: T0 - 5 * 60_000 }), "open");
  assert.equal(joinState({ ...own, hasLink: false, paid: true, now: T0 }), "no_link");
});

test("finished: after the join window, paid or not", () => {
  assert.equal(joinState({ ...base, paid: true, now: base.closesAt + 1 }), "finished");
  assert.equal(joinState({ ...base, paid: false, now: base.closesAt + 1 }), "finished");
});

test("an own link must be a full https URL", () => {
  assert.equal(validOwnLink("https://zoom.us/j/123"), true);
  assert.equal(validOwnLink("http://zoom.us/j/123"), false);
  assert.equal(validOwnLink("zoom.us/j/123"), false);
  assert.equal(validOwnLink("https://localhost"), false);
  assert.equal(validOwnLink(""), false);
});

test("awaiting-pay: confirmed + Unpaid + the child is on that day", () => {
  const b = { status: "Confirmed", pay: "Unpaid", days: ["2026-10-21"], child: "Ann", kids: [{ name: "Ann", dates: ["2026-10-21"] }] } as unknown as Booking;
  assert.equal(bookingAwaitingPayOnline(b, "2026-10-22"), false);
  assert.equal(bookingAwaitingPayOnline({ ...b, pay: "Paid" } as Booking, "2026-10-21"), false);
  assert.equal(bookingAwaitingPayOnline({ ...b, status: "Declined" } as Booking, "2026-10-21"), false);
});
