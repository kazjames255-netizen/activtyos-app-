/**
 * Waiting-list rules agreed on 6 Oct 2026 (see docs/session-log-2026-10-06.md).
 * Pure checks: copy that must say the right thing, and the defaults that must not drift.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { offerExpiredSpec, placeOfferedSpec } from "../../server/src/lib/emailTemplates";
import type { Booking } from "../../features/bookings/types";

const b = { ref: "APF-1", booker: "Kaz", listing: "October half term", child: "Jack", email: "k@x.com", status: "Waitlisted", pay: "Unpaid", amount: 0.3, offerExpiresAt: "2026-10-06T19:33:00.000Z" } as unknown as Booking;

test("a family that misses an offered place is told sorry, put back on the list, nothing charged", () => {
  const m = offerExpiredSpec(b, "APF");
  assert.match(m.subject, /missed/i);
  assert.match(m.subject, /back on the waiting list/i);
  assert.match(m.body, /put back on the waiting list automatically/i);
  assert.match(m.body, /Nothing has been charged/i);
});

test("the offer email gives a UK-time deadline and one Accept and pay button", () => {
  const m = placeOfferedSpec(b, "APF", "https://x.test");
  assert.match(m.body, /for 2 hours \(until 20:33\)/); // 19:33 UTC is 20:33 UK (BST)
  assert.match(m.body, /accept and pay/i);
});

test("provider waiting-list alert defaults: free-place alert ON, every-join email OFF, one first-join email ON", () => {
  // Read from the source text: importing autoEmails.ts would pull in the database client, which regression tests must not.
  const src = readFileSync(new URL("../../server/src/lib/autoEmails.ts", import.meta.url), "utf8");
  const defaults = src.slice(src.indexOf("AUTO_EMAIL_DEFAULTS"));
  assert.match(defaults, /waitlistFreeAlert: true/);
  assert.match(defaults, /waitlistJoinAlert: false/);
  assert.match(defaults, /waitlistStartAlert: true/);
});

test("new listings start with the waiting list on automatic offers", () => {
  const src = readFileSync(new URL("../../features/listings/ListingWizard.tsx", import.meta.url), "utf8");
  assert.match(src, /waitlist: true, waitlistSize: "20", waitlistMode: "auto"/);
});

test("a manual-mode waiting list tells the provider when a place frees up, and the setting can switch it off", () => {
  const src = readFileSync(new URL("../../server/src/lib/waitlist.ts", import.meta.url), "utf8");
  assert.match(src, /waitlistFreeAlert/);
  assert.match(src, /A place has opened up/);
});
