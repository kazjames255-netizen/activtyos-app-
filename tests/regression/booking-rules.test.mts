/** Regression (6 Oct): booking guards, public listing shape, coverage, waitlist caps. Pure: no network, no Firestore. */
import test from "node:test";
import assert from "node:assert/strict";
import { ageRangeFor, isOutOfRange, passHidden, addonRefusal, isQueuedOn, cardUnpaid } from "../../server/src/lib/bookingRules";
import { withoutBaseAddress, touchesCapacity, withHomeTenant } from "../../server/src/lib/publicListing";
import { capsViolation } from "../../server/src/lib/capRules";
import { checkCoverage } from "../../server/src/lib/coverageArea";

const cov = (...p: string[]) => ({ mode: "postcodePrefixes" as const, postcodePrefixes: p });
const ok = async (c: ReturnType<typeof cov>, pc: string) => (await checkCoverage(c, pc)).ok;

test("coverage: NN5 covers NN5 7EA but not NN50 1AA", async () => {
  assert.equal(await ok(cov("NN5"), "NN5 7EA"), true);
  assert.equal(await ok(cov("NN5"), "NN50 1AA"), false);
});
test("coverage: SW1 covers SW1A 1AA but not SW10 0AA", async () => {
  assert.equal(await ok(cov("SW1"), "SW1A 1AA"), true);
  assert.equal(await ok(cov("SW1"), "SW10 0AA"), false);
});
test("coverage: letter-ending and area prefixes still match; empty list does not block", async () => {
  assert.equal(await ok(cov("MK"), "MK14 6BN"), true);
  assert.equal(await ok(cov("MK14"), "MK14 6BN"), true);
  assert.equal(await ok(cov("MK14"), "MK15 6BN"), false);
  assert.equal(await ok(cov(), "ZZ1 1ZZ"), true);
});

test("base postcode is stripped from a non-owner listing response, service area kept", () => {
  const out = withoutBaseAddress({ coverageArea: { mode: "radius", basePostcode: "MK14 6BN", radiusMiles: 5 } }) as { coverageArea: Record<string, unknown> };
  assert.equal("basePostcode" in out.coverageArea, false);
  assert.equal(out.coverageArea.radiusMiles, 5);
  assert.equal(out.coverageArea.mode, "radius");
});
test("base postcode stripping does not mutate the stored object and survives missing coverage", () => {
  const src = { coverageArea: { basePostcode: "MK14 6BN" } };
  withoutBaseAddress(src);
  assert.equal(src.coverageArea.basePostcode, "MK14 6BN");
  assert.deepEqual(withoutBaseAddress({ coverageArea: null }), { coverageArea: null });
});
test("an online listing's own link never appears in a public response", () => {
  const out = withoutBaseAddress({ coverageArea: null, ownLink: "https://zoom.us/j/1" } as { coverageArea: null; ownLink?: string });
  assert.equal(out.ownLink, undefined);
});

test("hidden ticket cannot be booked; others can", () => {
  const l = { ticketOverrides: { "Full week": { hidden: true }, "Day": { hidden: false } } };
  assert.equal(passHidden(l, "Full week"), true);
  assert.equal(passHidden(l, "Day"), false);
  assert.equal(passHidden(l, "Unknown"), false);
  assert.equal(passHidden({}, "Day"), false);
});

test("ticket age range is enforced per ticket, falling back to the listing range", () => {
  const l = { ageFrom: "4", ageTo: "11", ticketOverrides: { Little: { ageFrom: "4", ageTo: "6" }, Open: {} } };
  assert.equal(isOutOfRange(l, 9, "Little"), true);
  assert.equal(isOutOfRange(l, 5, "Little"), false);
  assert.equal(isOutOfRange(l, 9, "Open"), false);
  assert.equal(isOutOfRange(l, 12, "Open"), true);
  assert.deepEqual(ageRangeFor(l, "Little"), { from: 4, to: 6 });
  assert.deepEqual(ageRangeFor(l, "Open"), { from: 4, to: 11 });
});
test("age: unknown age is exempt, age 0 is a real age", () => {
  assert.equal(isOutOfRange({ ageFrom: "2" }, undefined), false);
  assert.equal(isOutOfRange({ ageFrom: "2" }, 0), true);
  assert.equal(isOutOfRange({}, 30), false);
});

test("add-on not offered on the listing is refused", () => {
  assert.match(addonRefusal(["a1"], "zz", new Set(), "Lunch", "Sam")!, /isn't offered/);
  assert.match(addonRefusal(undefined, "a1", new Set(), "Lunch", "Sam")!, /isn't offered/);
});
test("same add-on twice for one child is rejected; once is fine; another child is fine", () => {
  const seen = new Set<string>();
  assert.equal(addonRefusal(["a1"], "a1", seen, "Lunch", "Sam"), null);
  assert.match(addonRefusal(["a1"], "a1", seen, "Lunch", "Sam")!, /twice for Sam/);
  assert.equal(addonRefusal(["a1"], "a1", new Set(), "Lunch", "Ann"), null);
});

test("a child already waitlisted for a day cannot join that day's queue again", () => {
  assert.equal(isQueuedOn("Waitlisted", ["2026-10-12"], "2026-10-12"), true);
  assert.equal(isQueuedOn("Waitlisted", ["2026-10-12"], "2026-10-13"), false);
  assert.equal(isQueuedOn("Cancelled", ["2026-10-12"], "2026-10-12"), false);
  assert.equal(isQueuedOn("Waitlisted", undefined, "2026-10-12"), false);
});

const D = ["2026-10-12", "2026-10-13"];
const listing = { ticketOverrides: { Early: { capacity: "1" } }, ageCapsOn: true, ageCaps: { g1: 1 } };
const groups = [{ id: "g1", ageFrom: 4, ageTo: 6, name: "Minis" }, { id: "g2", ageFrom: 7, ageTo: 11 }];
test("waitlist offer respects a full capped ticket", () => {
  const live = [{ ref: "A", pass: "Early", seats: 1, days: D }];
  assert.match(capsViolation(listing, { ref: "W", pass: "Early", seats: 1 }, D, live, D, groups)!, /Early is full/);
  assert.equal(capsViolation(listing, { ref: "W", pass: "Standard", seats: 1 }, D, live, D, groups), null);
});
test("waitlist offer respects a full age group, other group unaffected", () => {
  const live = [{ ref: "A", age: 5, seats: 1, days: D }];
  assert.match(capsViolation(listing, { ref: "W", age: 6, seats: 1 }, D, live, D, groups)!, /Minis is full/);
  assert.equal(capsViolation(listing, { ref: "W", age: 9, seats: 1 }, D, live, D, groups), null);
});
test("waitlist offer: the booking's own seats are not counted against itself", () => {
  const live = [{ ref: "W", pass: "Early", seats: 1, days: D }];
  assert.equal(capsViolation(listing, { ref: "W", pass: "Early", seats: 1 }, D, live, D, groups), null);
});

test("raising capacity, reopening a ticket or lifting an age cap triggers waitlist offers", () => {
  assert.equal(touchesCapacity({ maxAttendees: "20" }), true);
  assert.equal(touchesCapacity({ ticketOverrides: {} }), true);
  assert.equal(touchesCapacity({ ageCaps: {} }), true);
  assert.equal(touchesCapacity({ ageCapsOn: false }), true);
  assert.equal(touchesCapacity({ description: "x", name: "y" }), false);
});

test("card booking is unpaid (no 'booked in' email) until the card succeeds; cash/free/on-behalf are not", () => {
  assert.equal(cardUnpaid("Card", 20, undefined), true);
  assert.equal(cardUnpaid("card", 20, false), true);
  assert.equal(cardUnpaid("Cash", 20, undefined), false);
  assert.equal(cardUnpaid("Card", 0, undefined), false);
  assert.equal(cardUnpaid("Card", 20, true), false);
});

test("a parent's chosen provider shows in Browse before a first booking", () => {
  assert.deepEqual([...withHomeTenant(new Set(["a"]), "b")].sort(), ["a", "b"]);
  assert.deepEqual([...withHomeTenant(new Set(["a"]), undefined)], ["a"]);
  assert.deepEqual([...withHomeTenant(new Set(), null)], []);
});
