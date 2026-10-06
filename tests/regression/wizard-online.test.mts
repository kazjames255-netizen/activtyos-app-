/** Regression (6 Oct): listing wizard rules, online sessions, UK-time email. Pure. */
import test from "node:test";
import assert from "node:assert/strict";
import { fixYear, runLooksWrong, saveStatusFor, onlineVenueChoice, deliveryPatch } from "../../features/listings/wizardRules";
import { ukWallToUtc, bookingJoinable, ownLinkVisible } from "../../server/src/lib/onlineRules";
import { joinWindow, windowState } from "../../server/src/lib/hubVideo";
import { placeOfferedSpec } from "../../server/src/lib/emailTemplates";
import type { Booking } from "../../features/bookings/types";

test("year typed as 20 becomes 2020; four-digit and in-progress years are left alone", () => {
  assert.equal(fixYear("0020-10-26"), "2020-10-26");
  assert.equal(fixYear("20-10-26"), "2020-10-26");
  assert.equal(fixYear("2026-10-26"), "2026-10-26");
  assert.equal(fixYear("202-10-26"), "202-10-26");
  assert.equal(fixYear("nonsense"), "nonsense");
});
test("40-week and pre-2000 runs raise the check-the-dates warning", () => {
  assert.equal(runLooksWrong(41, "2026-01-01"), true);
  assert.equal(runLooksWrong(40, "2026-01-01"), false);
  assert.equal(runLooksWrong(10, "0020-01-01"), true);
  assert.equal(runLooksWrong(10, undefined), false);
});
test("Save-draft on a live listing keeps it live", () => {
  assert.equal(saveStatusFor("live"), "live");
  assert.equal(saveStatusFor("draft"), "draft");
});
test("Online delivery picks the existing online venue, or creates one", () => {
  const v = [{ id: "v1", kind: "venue" }, { id: "o1", kind: "online" }];
  assert.deepEqual(onlineVenueChoice(v, "new"), { id: "o1", create: false });
  assert.deepEqual(onlineVenueChoice([v[0]], "new"), { id: "new", create: true });
});
test("choosing a non-online delivery clears a leftover online place; home visits starts a blank area", () => {
  const v = [{ id: "o1", kind: "online" }, { id: "v1", kind: "venue" }];
  assert.deepEqual(deliveryPatch("venue", v, "o1", false), { deliveryMode: "venue", venueId: null });
  assert.deepEqual(deliveryPatch("venue", v, "v1", false), { deliveryMode: "venue" });
  assert.deepEqual(deliveryPatch("home-visit", v, "v1", false).coverageArea, { mode: "postcodePrefixes", postcodePrefixes: [] });
  assert.equal("coverageArea" in deliveryPatch("home-visit", v, "v1", true), false);
});

test("UK wall time converts correctly in BST and GMT", () => {
  assert.equal(ukWallToUtc("2026-07-01", "10:00").toISOString(), "2026-07-01T09:00:00.000Z");
  assert.equal(ukWallToUtc("2026-12-01", "10:00").toISOString(), "2026-12-01T10:00:00.000Z");
  assert.equal(ukWallToUtc("2026-03-29", "00:30").toISOString(), "2026-03-29T00:30:00.000Z");
});
test("join window: opens 10 minutes before, closes 30 after the end", () => {
  const w = joinWindow("2026-10-12T10:00:00.000Z", 60);
  assert.equal(w.opensAt.toISOString(), "2026-10-12T09:50:00.000Z");
  assert.equal(w.endsAt.toISOString(), "2026-10-12T11:00:00.000Z");
  assert.equal(w.closesAt.toISOString(), "2026-10-12T11:30:00.000Z");
  assert.equal(windowState(new Date("2026-10-12T09:50:00Z"), w), "open");
  assert.equal(windowState(new Date("2026-10-12T11:30:00Z"), w), "open");
  assert.equal(windowState(new Date("2026-10-12T11:31:00Z"), w), "closed");
});
const book = (o: Record<string, unknown>) => ({ ref: "R", bid: "b", status: "Confirmed", pay: "Paid", amount: 10, days: ["2026-10-12"], kids: [{ name: "A" }], child: "A", ...o }) as unknown as Booking;
test("online attendance: only confirmed, paid, on-the-date bookings may join", () => {
  assert.equal(bookingJoinable(book({}), "2026-10-12"), true);
  assert.equal(bookingJoinable(book({}), "2026-10-13"), false);
  assert.equal(bookingJoinable(book({ status: "Waitlisted" }), "2026-10-12"), false);
  assert.equal(bookingJoinable(book({ status: "Cancelled" }), "2026-10-12"), false);
  assert.equal(bookingJoinable(book({ pay: "Unpaid" }), "2026-10-12"), false);
  assert.equal(bookingJoinable(book({ pay: "Refunded" }), "2026-10-12"), false);
});
test("own link visible only inside the window unless 'show now'", () => {
  const l = { videoMode: "own", ownLink: "https://zoom.us/j/1" };
  assert.equal(ownLinkVisible(l, false), false);
  assert.equal(ownLinkVisible(l, true), true);
  assert.equal(ownLinkVisible({ ...l, showLinkNow: true }, false), true);
  assert.equal(ownLinkVisible({ videoMode: "own", showLinkNow: true }, true), false);
  assert.equal(ownLinkVisible({ videoMode: "hub", ownLink: "x" }, true), false);
});

test("waitlist offer email shows UK time whatever the server's zone", () => {
  const b = { ref: "R", booker: "Pat", listing: "Camp", offerExpiresAt: "2026-07-01T12:30:00.000Z" } as unknown as Booking;
  const prev = process.env.TZ;
  try {
    for (const tz of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
      process.env.TZ = tz;
      assert.match(placeOfferedSpec(b, "APF", "https://x").body, /until 13:30/, tz);
    }
  } finally { if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev; }
});
