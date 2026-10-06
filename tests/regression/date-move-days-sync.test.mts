/**
 * Date move keeps the booking's `days` in step with its children's own dates (regression, 6 Oct fuzz finding).
 *
 * Bug: applyMoveApprove moved a child's own dates but left booking.days on the old day. heldPlaces() only counts a child's dates that fall
 * inside booking.days, so the next cancel/move/approve read the booking as holding the OLD day and the block's per-day counts drifted
 * (FUZ-10317: days [16 Oct], both kids on [14 Oct], counts 14:2 + 16:2 instead of 14:2).
 *
 * Pure: no network. Run: npx tsx --test tests/regression/date-move-days-sync.test.mts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { applyMoveApprove } from "../../server/src/lib/dateChange";
import { countsUpdate, heldPlaces, placesDelta, type BlockDoc } from "../../server/src/lib/blockDomain";
import type { Booking } from "../../features/bookings/types";

const D = ["2027-07-26", "2027-07-27", "2027-07-28", "2027-07-29", "2027-07-30"];
const sessions = D.map((date) => ({ date, start: "09:00", end: "15:00" }));
const block = (over: Partial<BlockDoc> = {}): BlockDoc => ({
  tenantId: "t", listingId: "l", name: "Wk", startDate: D[0], endDate: D[4], capacity: 10, bookedCount: 0, open: true, sessions, capacityScope: "day", dayCounts: {}, ...over,
});
const kid = (name: string, dates: string[]) => ({ name, childId: name, dates: [...dates], days: [...dates] }) as NonNullable<Booking["kids"]>[number];
const booking = (days: string[], kids: NonNullable<Booking["kids"]>, moves: { childName: string; from: string; to: string }[]): Booking =>
  ({ ref: "T-1", status: "Confirmed", seats: kids.length, days: [...days], kids, dateChangeRequest: { moves: moves.map((m) => ({ ...m })), status: "pending", requestedAt: "now" } }) as unknown as Booking;

/** What the routes do: take a booking's seats onto the block, and on an approved move free the old day / take the new one. */
function bookOnto(b: BlockDoc, bk: Booking): BlockDoc {
  const h = heldPlaces(bk, b);
  let cur = b;
  for (const [d, n] of Object.entries(h.days)) cur = { ...cur, ...countsUpdate(cur, n, [d]) };
  return cur;
}
function moveCounts(b: BlockDoc, moves: { from: string; to: string }[]): BlockDoc {
  let cur = b;
  for (const m of moves) {
    cur = { ...cur, ...countsUpdate(cur, -1, [m.from]) };
    cur = { ...cur, ...countsUpdate(cur, 1, [m.to]) };
  }
  return cur;
}
const dc = (b: BlockDoc) => Object.fromEntries(Object.entries(b.dayCounts ?? {}).filter(([, v]) => v !== 0));
const recount = (bk: Booking, b: BlockDoc) => heldPlaces(bk, b).days;

test("both children on one day move together: days follows, counts equal a recount", () => {
  const bk = booking([D[2]], [kid("A", [D[2]]), kid("B", [D[2]])], [{ childName: "A", from: D[2], to: D[0] }, { childName: "B", from: D[2], to: D[0] }]);
  let blk = bookOnto(block(), bk);
  assert.deepEqual(dc(blk), { [D[2]]: 2 });
  applyMoveApprove(bk);
  blk = moveCounts(blk, [{ from: D[2], to: D[0] }, { from: D[2], to: D[0] }]);
  assert.deepEqual(bk.days, [D[0]]);
  assert.deepEqual(dc(blk), { [D[0]]: 2 });
  assert.deepEqual(recount(bk, blk), { [D[0]]: 2 }); // the FUZ-10317 shape: this used to read back {D[2]: 2}
});

test("only one child moves: the day the other child still holds stays on the booking", () => {
  const bk = booking([D[2]], [kid("A", [D[2]]), kid("B", [D[2]])], [{ childName: "A", from: D[2], to: D[0] }]);
  let blk = bookOnto(block(), bk);
  applyMoveApprove(bk);
  blk = moveCounts(blk, [{ from: D[2], to: D[0] }]);
  assert.deepEqual(bk.days, [D[0], D[2]]);
  assert.deepEqual(dc(blk), { [D[0]]: 1, [D[2]]: 1 });
  assert.deepEqual(recount(bk, blk), { [D[0]]: 1, [D[2]]: 1 });
});

test("children on different days: moving one child's day leaves the other's untouched", () => {
  const bk = booking([D[0], D[1], D[2]], [kid("A", [D[0], D[1], D[2]]), kid("B", [D[0], D[1]])], [{ childName: "B", from: D[1], to: D[3] }]);
  let blk = bookOnto(block(), bk);
  assert.deepEqual(dc(blk), { [D[0]]: 2, [D[1]]: 2, [D[2]]: 1 });
  applyMoveApprove(bk);
  blk = moveCounts(blk, [{ from: D[1], to: D[3] }]);
  assert.deepEqual(bk.days, [D[0], D[1], D[2], D[3]]); // A still holds D[1]
  assert.deepEqual(dc(blk), { [D[0]]: 2, [D[1]]: 1, [D[2]]: 1, [D[3]]: 1 });
  assert.deepEqual(recount(bk, blk), dc(blk));
});

test("a day only one child held leaves booking.days when that child moves off it", () => {
  const bk = booking([D[0], D[1]], [kid("A", [D[0]]), kid("B", [D[1]])], [{ childName: "B", from: D[1], to: D[3] }]);
  let blk = bookOnto(block(), bk);
  applyMoveApprove(bk);
  blk = moveCounts(blk, [{ from: D[1], to: D[3] }]);
  assert.deepEqual(bk.days, [D[0], D[3]]);
  assert.deepEqual(recount(bk, blk), { [D[0]]: 1, [D[3]]: 1 });
  assert.deepEqual(dc(blk), recount(bk, blk));
});

test("move onto a day the booking already holds (other child there): no duplicate, counts add up", () => {
  const bk = booking([D[0], D[1]], [kid("A", [D[0]]), kid("B", [D[1]])], [{ childName: "B", from: D[1], to: D[0] }]);
  let blk = bookOnto(block(), bk);
  applyMoveApprove(bk);
  blk = moveCounts(blk, [{ from: D[1], to: D[0] }]);
  assert.deepEqual(bk.days, [D[0]]);
  assert.deepEqual(dc(blk), { [D[0]]: 2 });
  assert.deepEqual(recount(bk, blk), { [D[0]]: 2 });
});

test("cancelling the moved booking afterwards frees exactly the days it now holds (no seat released elsewhere)", () => {
  const bk = booking([D[2]], [kid("A", [D[2]]), kid("B", [D[2]])], [{ childName: "A", from: D[2], to: D[0] }, { childName: "B", from: D[2], to: D[0] }]);
  let blk = bookOnto(block({ dayCounts: { [D[2]]: 3 } }), bk); // another family also holds one place on D[2]
  applyMoveApprove(bk);
  blk = moveCounts(blk, [{ from: D[2], to: D[0] }, { from: D[2], to: D[0] }]);
  const before = heldPlaces(bk, blk);
  const cancelled = { ...bk, status: "Cancelled" } as Booking;
  const delta = placesDelta(before, heldPlaces(cancelled, blk, "Cancelled"));
  assert.deepEqual(before.days, { [D[0]]: 2 });
  assert.deepEqual(delta.days, { [D[0]]: -2 });
});

test("a single-child booking with no own dates still just maps booking.days (unchanged behaviour)", () => {
  const bk = { ref: "T-2", status: "Confirmed", seats: 1, days: [D[1], D[2]], kids: [{ name: "A", childId: "A" }], dateChangeRequest: { moves: [{ childName: "A", from: D[1], to: D[3] }], status: "pending", requestedAt: "now" } } as unknown as Booking;
  applyMoveApprove(bk);
  assert.deepEqual([...bk.days!].sort(), [D[2], D[3]]); // order is not part of the contract
});

test("moves not approved leave days alone", () => {
  const bk = booking([D[2]], [kid("A", [D[2]]), kid("B", [D[2]])], [{ childName: "A", from: D[2], to: D[0] }, { childName: "B", from: D[2], to: D[1] }]);
  applyMoveApprove(bk, [1]); // approve only B's move
  assert.deepEqual(bk.days, [D[1], D[2]]);
  assert.deepEqual(bk.kids![0].dates, [D[2]]);
  assert.deepEqual(bk.kids![1].dates, [D[1]]);
});
