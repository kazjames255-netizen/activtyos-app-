/**
 * Waiting list + capacity regression tests (pure: no network, no Firestore).
 *
 * Run:   npm run test:waitlist
 *        (= tsx --test tests/waitlist-capacity.test.mts)
 *
 * Covers: server/src/lib/blockDomain.ts (countsUpdate, daysHaveSpace,
 *         countsTowardCapacity, blockCountDelta, blockSummary, bookingDays),
 *         server/src/lib/waitlistQueue.ts (sortQueue, positionsFrom),
 *         features/bookings/mutations.ts applyRowAction("offer") (2h hold),
 *         features/listings/capacity.ts (rawLeftOn, lowAt).
 * Catalogue refs: LT-035, AW-006..AW-011, BE-* (per-day limit, places rule).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  blockCountDelta,
  blockSummary,
  bookingDays,
  countsTowardCapacity,
  countsUpdate,
  daysHaveSpace,
  type BlockDoc,
} from "../server/src/lib/blockDomain";
import { positionsFrom, sortQueue } from "../server/src/lib/waitlistQueue";
import { applyRowAction } from "../features/bookings/mutations";
import { lowAt, rawLeftOn } from "../features/listings/capacity";
import type { RunBlock } from "../features/listings/ListingWizard";
import type { Booking } from "../features/bookings/types";

const MON = "2027-07-26", TUE = "2027-07-27", WED = "2027-07-28";
const sessions = [MON, TUE, WED].map((date) => ({ date, start: "09:00", end: "15:00" }));
const block = (over: Partial<BlockDoc> = {}): BlockDoc => ({
  tenantId: "t", listingId: "l", name: "Wk1", startDate: MON, endDate: WED,
  capacity: 10, bookedCount: 0, open: true, sessions, capacityScope: "day", dayCounts: {}, ...over,
});
/** Book `seats` onto `days` the way the server does (check, then countsUpdate). */
function book(b: BlockDoc, days: string[], seats = 1): { ok: boolean; block: BlockDoc } {
  const wanted = Object.fromEntries(days.map((d) => [d, seats]));
  const scope = b.capacityScope ?? "listing";
  const fits = scope === "day" ? daysHaveSpace(b, wanted).fits : b.bookedCount + seats <= b.capacity;
  if (!fits) return { ok: false, block: b };
  return { ok: true, block: { ...b, ...countsUpdate(b, seats, days) } };
}
const bk = (ref: string, over: Partial<Booking> = {}) => ({ ref, status: "Waitlisted", ...over }) as Booking;

// ── LT-035: never over the per-day limit ───────────────────────────────

test("LT-035: 10 children on Monday fit, the 11th is refused, Tuesday still open", () => {
  let b = block();
  for (let i = 0; i < 10; i++) {
    const r = book(b, [MON]);
    assert.equal(r.ok, true, `child ${i + 1} should fit`);
    b = r.block;
  }
  assert.equal(b.dayCounts![MON], 10);
  assert.deepEqual(daysHaveSpace(b, { [MON]: 1 }), { fits: false, fullDay: MON }); // exactly full
  assert.equal(book(b, [MON]).ok, false); // 11th child
  assert.equal(book(b, [TUE]).ok, true); // 11th child on Tuesday is fine
});

test("LT-035: one place left (9/10) still fits exactly one more, not two seats", () => {
  const b = block({ dayCounts: { [MON]: 9 }, bookedCount: 9 });
  assert.equal(daysHaveSpace(b, { [MON]: 1 }).fits, true);
  assert.equal(daysHaveSpace(b, { [MON]: 2 }).fits, false);
});

test("per-day scope: capacity holds per DATE, not summed across the block", () => {
  // 10 on Mon + 10 on Tue + 10 on Wed = bookedCount 30 > capacity 10, yet nothing over.
  let b = block();
  for (const d of [MON, TUE, WED]) for (let i = 0; i < 10; i++) b = book(b, [d]).block;
  assert.equal(b.bookedCount, 30);
  assert.deepEqual(b.dayCounts, { [MON]: 10, [TUE]: 10, [WED]: 10 });
  assert.equal(book(b, [MON]).ok, false);
});

test("per-day scope: separate weekly blocks each get their own 10 per date", () => {
  const wk1 = block({ dayCounts: { [MON]: 10 } });
  const wk2 = block({ name: "Wk2", dayCounts: {}, sessions: [{ date: "2027-08-02", start: "09:00", end: "15:00" }] });
  assert.equal(book(wk1, [MON]).ok, false);
  assert.equal(book(wk2, ["2027-08-02"]).ok, true);
});

test("listing scope: capacity is the whole-run total (bookedCount), not per date", () => {
  const b = block({ capacityScope: "listing", bookedCount: 10, dayCounts: { [MON]: 4 } });
  assert.equal(book(b, [TUE]).ok, false);
  assert.equal(book({ ...b, bookedCount: 9 }, [TUE]).ok, true);
  // absent scope = old "listing" behaviour
  assert.equal(book({ ...b, capacityScope: undefined }, [TUE]).ok, false);
});

test("a pass spanning several days needs space on EVERY chosen day", () => {
  const b = block({ dayCounts: { [MON]: 3, [TUE]: 10, [WED]: 0 } });
  const r = daysHaveSpace(b, { [MON]: 1, [TUE]: 1, [WED]: 1 });
  assert.equal(r.fits, false);
  assert.equal(r.fullDay, TUE);
  assert.equal(book(b, [MON, TUE, WED]).ok, false);
  // a refused booking changes nothing (no partial hold on Mon/Wed)
  assert.deepEqual(book(b, [MON, TUE, WED]).block.dayCounts, b.dayCounts);
  assert.equal(book(b, [MON, WED]).ok, true);
});

test("a 5-day pass is ONE place per child per day, and a 2-seat booking takes 2 on each day", () => {
  const b = block();
  const one = book(b, [MON, TUE, WED], 1).block;
  assert.deepEqual(one.dayCounts, { [MON]: 1, [TUE]: 1, [WED]: 1 });
  assert.equal(one.bookedCount, 1); // one child, however many days
  const two = book(b, [MON, TUE], 2).block;
  assert.deepEqual(two.dayCounts, { [MON]: 2, [TUE]: 2 });
  assert.equal(two.bookedCount, 2);
});

test("older bookings with no `days` occupy every session of the block", () => {
  const b = block();
  assert.deepEqual(bookingDays({}, b), [MON, TUE, WED]);
  assert.deepEqual(bookingDays({ days: [] }, b), [MON, TUE, WED]);
  assert.deepEqual(bookingDays({ days: [TUE] }, b), [TUE]);
});

// ── Which statuses hold seats ──────────────────────────────────────────

test("only Confirmed / Approval needed / Offered consume seats", () => {
  for (const s of ["Confirmed", "Approval needed", "Offered"] as const) assert.equal(countsTowardCapacity(s), true, s);
  for (const s of ["Cancelled", "Declined", "Waitlisted"] as const) assert.equal(countsTowardCapacity(s), false, s);
});

test("status transitions move bookedCount correctly (cancel frees, offer holds, decline frees)", () => {
  assert.equal(blockCountDelta("Confirmed", "Cancelled", 2), -2);
  assert.equal(blockCountDelta("Waitlisted", "Offered", 1), 1); // offer holds the seat
  assert.equal(blockCountDelta("Offered", "Confirmed", 1), 0); // accepting changes no capacity (AW-009)
  assert.equal(blockCountDelta("Offered", "Waitlisted", 1), -1); // lapsed offer releases the seat
  assert.equal(blockCountDelta("Offered", "Declined", 1), -1); // AW-010
  assert.equal(blockCountDelta("Approval needed", "Confirmed", 1), 0); // pending approval already held it
  assert.equal(blockCountDelta("Approval needed", "Declined", 3), -3);
  assert.equal(blockCountDelta("Waitlisted", "Cancelled", 1), 0); // never held a seat
  assert.equal(blockCountDelta("Waitlisted", "Confirmed", 1), 1); // promote
});

test("cancelling frees exactly that child's days; counts never go negative", () => {
  let b = book(block(), [MON, TUE]).block;
  b = { ...b, ...countsUpdate(b, -1, [MON, TUE]) };
  assert.deepEqual(b.dayCounts, { [MON]: 0, [TUE]: 0 });
  assert.equal(b.bookedCount, 0);
  const again = countsUpdate(b, -1, [MON]); // double-cancel guard
  assert.equal(again.dayCounts[MON], 0);
  assert.equal(again.bookedCount, 0);
});

test("freed seat on a full day lets the next booking in (boundary 10 -> 9 -> 10)", () => {
  let b = block({ dayCounts: { [MON]: 10 }, bookedCount: 10 });
  assert.equal(book(b, [MON]).ok, false);
  b = { ...b, ...countsUpdate(b, -1, [MON]) };
  assert.equal(book(b, [MON]).ok, true);
});

// ── Offer + 2h hold ────────────────────────────────────────────────────

test("AW-007: offering sets Offered, offeredAt and an expiry exactly 2 hours later", () => {
  const b = bk("A-1");
  const before = Date.now();
  applyRowAction(b, "offer");
  assert.equal(b.status, "Offered");
  const offered = Date.parse(b.offeredAt!), expires = Date.parse(b.offerExpiresAt!);
  assert.ok(offered >= before - 1000 && offered <= Date.now() + 1000);
  assert.equal(expires - offered, 2 * 60 * 60 * 1000);
  assert.match(b.note ?? "", /2 hours/);
});

test("an offered place holds the seat, so the day reads full to other bookers", () => {
  const b = block({ dayCounts: { [MON]: 9 }, bookedCount: 9 });
  const held = { ...b, ...countsUpdate(b, 1, [MON]) }; // makeOffer's hold
  assert.equal(daysHaveSpace(held, { [MON]: 1 }).fits, false);
});

test("AW-011: lapsed offer returns the seat; sweep releases it via countsUpdate(-seats)", () => {
  const b = block({ dayCounts: { [MON]: 10 }, bookedCount: 10 });
  const released = { ...b, ...countsUpdate(b, -(1), [MON]) };
  assert.equal(daysHaveSpace(released, { [MON]: 1 }).fits, true);
});

// ── Queue ordering + positions ─────────────────────────────────────────

test("AW-008: queue is first-in-first-out by ref number (numeric, not lexical)", () => {
  const q = sortQueue([bk("BK-10"), bk("BK-2"), bk("BK-1")]);
  assert.deepEqual(q.map((b) => b.ref), ["BK-1", "BK-2", "BK-10"]);
});

test("AW-011: a family whose offer lapsed re-joins at the BACK of the queue", () => {
  const q = sortQueue([
    bk("BK-1", { requeuedAt: "2027-07-20T10:00:00.000Z" }), // oldest ref but lapsed
    bk("BK-2"),
    bk("BK-3"),
  ]);
  assert.deepEqual(q.map((b) => b.ref), ["BK-2", "BK-3", "BK-1"]);
});

test("two lapsed families queue behind never-lapsed ones in lapse order", () => {
  const q = sortQueue([
    bk("BK-1", { requeuedAt: "2027-07-21T10:00:00.000Z" }),
    bk("BK-2", { requeuedAt: "2027-07-20T10:00:00.000Z" }),
    bk("BK-9"),
  ]);
  assert.deepEqual(q.map((b) => b.ref), ["BK-9", "BK-2", "BK-1"]);
});

test("sortQueue does not mutate its input", () => {
  const input = [bk("BK-3"), bk("BK-1")];
  sortQueue(input);
  assert.deepEqual(input.map((b) => b.ref), ["BK-3", "BK-1"]);
});

test("AW-006: positions are per DATE (2nd in line for Monday, 1st for Tuesday)", () => {
  const q = sortQueue([bk("BK-1", { days: [MON] }), bk("BK-2", { days: [MON, TUE] })]);
  const pos = positionsFrom(q, ["BK-2"], (b) => (b as Booking).days ?? []);
  assert.deepEqual(pos, [
    { ref: "BK-2", date: MON, position: 2 },
    { ref: "BK-2", date: TUE, position: 1 },
  ]);
});

test("positions: a ref not in the queue yields nothing; results are date-sorted", () => {
  const q = sortQueue([bk("BK-1", { days: [WED, MON] })]);
  assert.deepEqual(positionsFrom(q, ["BK-99"], (b) => (b as Booking).days ?? []), []);
  assert.deepEqual(positionsFrom(q, ["BK-1"], (b) => (b as Booking).days ?? []).map((p) => p.date), [MON, WED]);
});

test("positions: a lapsed family's position drops behind everyone (AW-011)", () => {
  const q = sortQueue([bk("BK-1", { days: [MON], requeuedAt: "2027-07-20T10:00:00.000Z" }), bk("BK-2", { days: [MON] })]);
  const pos = positionsFrom(q, ["BK-1", "BK-2"], (b) => (b as Booking).days ?? []);
  assert.equal(pos.find((p) => p.ref === "BK-2")!.position, 1);
  assert.equal(pos.find((p) => p.ref === "BK-1")!.position, 2);
});

// ── What the parent sees (summary + rawLeft/leftOn maths) ──────────────

test("blockSummary day scope: per-session spotsLeft is that DATE's own count; block spotsLeft is the busiest day", () => {
  const s = blockSummary("b1", block({ dayCounts: { [MON]: 10, [TUE]: 3 }, bookedCount: 13 }));
  assert.equal(s.spotsLeft, 0); // busiest day full
  assert.deepEqual(s.sessions.map((x) => x.spotsLeft), [0, 7, 10]);
});

test("blockSummary listing scope: spotsLeft = capacity - bookedCount, never negative", () => {
  assert.equal(blockSummary("b", block({ capacityScope: "listing", bookedCount: 4 })).spotsLeft, 6);
  assert.equal(blockSummary("b", block({ capacityScope: "listing", bookedCount: 12 })).spotsLeft, 0);
});

const run = (over: Partial<RunBlock> = {}): RunBlock => ({
  id: "b1", name: "Wk1", startDate: MON, endDate: WED, capacity: 10, spotsLeft: 0, open: true,
  capacityScope: "day",
  sessions: [{ date: MON, spotsLeft: 0 }, { date: TUE, spotsLeft: 1 }, { date: WED, spotsLeft: 10 }], ...over,
});

test("rawLeft (day scope): uses the date's own count, so a full Monday does not block Tuesday", () => {
  const blocks = [run()];
  assert.equal(rawLeftOn(blocks, MON, 10, true, 0), 0); // full
  assert.equal(rawLeftOn(blocks, TUE, 10, true, 0), 1); // one left
  assert.equal(rawLeftOn(blocks, WED, 10, true, 0), 10);
});

test("rawLeft (listing scope): uses the block's spotsLeft for every date", () => {
  const blocks = [run({ capacityScope: "listing", spotsLeft: 3 })];
  assert.equal(rawLeftOn(blocks, MON, 10, false, 0), 3);
  assert.equal(rawLeftOn(blocks, WED, 10, false, 0), 3);
});

test("rawLeft: no dated run falls back to configured capacity (per-day full, whole-listing minus basket), null when unlimited", () => {
  assert.equal(rawLeftOn(undefined, MON, 10, true, 4), 10); // per-day ignores basket size
  assert.equal(rawLeftOn(undefined, MON, 10, false, 4), 6);
  assert.equal(rawLeftOn(undefined, MON, 10, false, 15), 0); // clamped, never negative
  assert.equal(rawLeftOn(undefined, MON, null, false, 4), null);
  assert.equal(rawLeftOn([run()], "2027-09-01", 10, true, 0), 10); // date outside every run
});

test("lowAt ('almost full'): a quarter-ish of the group, min 1, max 5", () => {
  assert.equal(lowAt(10), 4); // ceil(10/3)=4
  assert.equal(lowAt(30), 5); // capped at 5
  assert.equal(lowAt(4), 2);
  assert.equal(lowAt(1), 1);
  assert.equal(lowAt(null), 1);
  assert.equal(lowAt(0), 1);
});
