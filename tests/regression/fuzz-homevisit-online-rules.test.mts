/** Regression (6 Oct): home-visit coverage, base-postcode / own-link privacy, online join entitlement, and the home-visit invariants. Pure: no network. */
import test from "node:test";
import assert from "node:assert/strict";
import { checkCoverage } from "../../server/src/lib/coverageArea";
import { withoutBaseAddress } from "../../server/src/lib/publicListing";
import { ownLinkVisible, bookingJoinable, ukWallToUtc } from "../../server/src/lib/onlineRules";
import { INVARIANTS } from "../../server/tools/assure/invariants";
import type { Snapshot, SnapBooking } from "../../server/tools/assure/types";

const cover = (prefixes: string[], pc: string) => checkCoverage({ mode: "postcodePrefixes", postcodePrefixes: prefixes }, pc).then((r) => r.ok);

test("a postcode prefix ending in a digit ends the district (NN5 is not NN50, SW1 is not SW10)", async () => {
  assert.equal(await cover(["NN5"], "NN5 7EA"), true);
  assert.equal(await cover(["NN5"], "NN50 1AA"), false);
  assert.equal(await cover(["NN5"], "NN501AA"), false);
  assert.equal(await cover(["SW1"], "SW1A 1AA"), true);
  assert.equal(await cover(["SW1"], "SW10 9AA"), false);
  assert.equal(await cover(["SW1"], "SW100AA"), false);
});
test("coverage ignores case and spacing", async () => {
  for (const pc of ["nn5 7ea", "NN57EA", "  NN5   7EA ", "Nn5 7eA"]) assert.equal(await cover(["NN5"], pc), true, pc);
  assert.equal(await cover(["nn5", " sw1 "], "SW1A 2AA"), true);
});
test("an empty postcode is never covered and a different area is refused", async () => {
  assert.equal(await cover(["NN5"], ""), false);
  assert.equal(await cover(["NN5"], "   "), false);
  assert.equal(await cover(["NN5", "B1"], "M1 1AE"), false);
  assert.equal(await cover(["B1"], "B10 0AA"), false);
  assert.equal(await cover(["LS1"], "LS11 5AA"), false);
});
test("a listing response to a non-owner never carries the base postcode or the own link", () => {
  const out = withoutBaseAddress({ coverageArea: { mode: "radius", basePostcode: "NE1 4ST", radiusMiles: 3 }, ownLink: "https://meet.example.test/secret", title: "T" } as any);
  assert.ok(!JSON.stringify(out).includes("NE1 4ST"));
  assert.ok(!JSON.stringify(out).includes("secret"));
  assert.equal((out as any).coverageArea.radiusMiles, 3);
  assert.equal((out as any).title, "T");
});
test("the own link is shown only for an own-link listing with a link, inside the window or when the provider says show it now", () => {
  const l = { videoMode: "own", ownLink: "https://x.test/j" };
  assert.equal(ownLinkVisible(l, false), false);
  assert.equal(ownLinkVisible(l, true), true);
  assert.equal(ownLinkVisible({ ...l, showLinkNow: true }, false), true);
  assert.equal(ownLinkVisible({ videoMode: "platform", ownLink: "https://x.test/j", showLinkNow: true }, true), false);
  assert.equal(ownLinkVisible({ videoMode: "own", showLinkNow: true }, true), false);
});
const booking = (over: Record<string, unknown>) => ({ ref: "R1", status: "Confirmed", pay: "Paid", days: ["2026-11-02"], kids: [{ name: "A", childId: "c1" }], pass: "1 day", seats: 1, ...over }) as any;
test("only a confirmed, paid, uncancelled booking on that date may join an online session", () => {
  assert.equal(bookingJoinable(booking({}), "2026-11-02"), true);
  assert.equal(bookingJoinable(booking({}), "2026-11-03"), false);
  assert.equal(bookingJoinable(booking({ status: "Cancelled" }), "2026-11-02"), false);
  assert.equal(bookingJoinable(booking({ status: "Waitlisted" }), "2026-11-02"), false);
  assert.equal(bookingJoinable(booking({ pay: "Unpaid" }), "2026-11-02"), false);
  assert.equal(bookingJoinable(booking({ pay: "Refunded" }), "2026-11-02"), false);
});
test("session times follow UK summer and winter time", () => {
  assert.equal(ukWallToUtc("2026-07-01", "09:00").toISOString(), "2026-07-01T08:00:00.000Z");
  assert.equal(ukWallToUtc("2026-12-01", "09:00").toISOString(), "2026-12-01T09:00:00.000Z");
});

// ---- the three home-visit invariants ----
const snap = (listing: Record<string, unknown>, b: Partial<SnapBooking>): Snapshot => ({
  tenantId: "T", takenAt: "2026-10-06T12:00:00.000Z",
  listings: [{ id: "L1", status: "live", name: "Visit", ...listing }], blocks: [], payments: [], wallet: {}, emailsSent: [],
  bookings: [{ id: "x", ref: "R1", listingId: "L1", tenantId: "T", email: "p@x.test", status: "Confirmed", pay: "Unpaid", amount: 0, days: [], seats: 1, kidsLive: 1, ...b } as SnapBooking],
} as unknown as Snapshot);
const fired = (id: string, s: Snapshot) => INVARIANTS.find((i) => i.id === id)!.check(s).length;
test("invariant: a home-visit booking must record where it runs", () => {
  assert.equal(fired("state.homevisit-has-service-address", snap({ deliveryMode: "home-visit" }, {})), 1);
  assert.equal(fired("state.homevisit-has-service-address", snap({ deliveryMode: "home-visit" }, { serviceAddress: { postcode: "NN5 7EA" } })), 0);
  assert.equal(fired("state.homevisit-has-service-address", snap({}, {})), 0);
});
test("invariant: a venue booking carries no service address", () => {
  assert.equal(fired("state.venue-has-no-service-address", snap({}, { serviceAddress: { postcode: "NN5 7EA" } })), 1);
  assert.equal(fired("state.venue-has-no-service-address", snap({ deliveryMode: "both" }, { serviceAddress: { postcode: "NN5 7EA" } })), 0);
});
test("invariant: the stored service postcode is inside the district-aware prefix coverage", () => {
  const l = { deliveryMode: "home-visit", coverageMode: "postcodePrefixes", coveragePrefixes: ["NN5", "SW1"] };
  const at = (postcode: string) => fired("state.service-address-in-coverage", snap(l, { serviceAddress: { postcode } }));
  assert.equal(at("NN5 7EA"), 0); assert.equal(at("nn57ea"), 0); assert.equal(at("SW1A 1AA"), 0);
  assert.equal(at("NN50 1AA"), 1); assert.equal(at("SW10 9AA"), 1); assert.equal(at("M1 1AE"), 1);
});
