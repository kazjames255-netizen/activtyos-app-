/**
 * Regression tests from the 6 Oct invariant triage (pure: no network, no Firestore).
 *  - heldPlaces counts each child on its OWN days even before anything is cancelled (two children, different days on one booking).
 *  - the early-bird-once rule treats one checkout's rows (one saving split across weeks) as ONE use, and two checkouts as two.
 *  - a provider's "Promote now" overbook is the only allowed excess over capacity.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { heldPlaces, applyPlacesDelta, placesDelta, type BlockDoc } from "../../server/src/lib/blockDomain";
import { INVARIANTS } from "../../server/tools/assure/invariants";
import type { Snapshot, SnapBooking, SnapBlock } from "../../server/tools/assure/types";

const DAYS = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"];
const block = (over: Partial<BlockDoc> = {}): BlockDoc => ({
  id: "b1", tenantId: "t", listingId: "l", name: "Week", capacity: 10, capacityScope: "day", bookedCount: 0, dayCounts: {}, open: true,
  sessions: DAYS.map((date) => ({ date, start: "09:00", finish: "15:30" })), ...over,
} as unknown as BlockDoc);

test("two children on different days: held places follow each child (A all week, B Mon-Wed)", () => {
  const h = heldPlaces({ status: "Confirmed", seats: 2, days: DAYS, kids: [
    { name: "A", dates: DAYS }, { name: "B", dates: DAYS.slice(0, 3) },
  ] } as never, block());
  assert.deepEqual(h.days, { "2026-10-12": 2, "2026-10-13": 2, "2026-10-14": 2, "2026-10-15": 1, "2026-10-16": 1 });
  assert.equal(h.seats, 2);
});

test("cancelling that booking frees exactly what it held, never more (no phantom release of another family's place)", () => {
  const mine = heldPlaces({ status: "Confirmed", seats: 2, days: DAYS, kids: [{ name: "A", dates: DAYS }, { name: "B", dates: DAYS.slice(0, 3) }] } as never, block());
  // another family holds one place on Thu and Fri; stored counts = mine + theirs
  const stored = { "2026-10-12": 2, "2026-10-13": 2, "2026-10-14": 2, "2026-10-15": 2, "2026-10-16": 2 };
  const gone = heldPlaces({ status: "Cancelled", seats: 2, days: DAYS, kids: [] } as never, block());
  const out = applyPlacesDelta(block({ dayCounts: stored, bookedCount: 3 }), placesDelta(mine, gone));
  assert.equal(out.dayCounts["2026-10-15"], 1, "the other family's Thursday place must survive");
  assert.equal(out.dayCounts["2026-10-16"], 1);
  assert.equal(out.dayCounts["2026-10-12"], 0);
});

test("same days for every child, or no per-child dates: unchanged behaviour (seats x days)", () => {
  const same = heldPlaces({ status: "Confirmed", seats: 2, days: DAYS, kids: [{ name: "A", dates: DAYS }, { name: "B", dates: DAYS }] } as never, block());
  assert.deepEqual(same.days, Object.fromEntries(DAYS.map((d) => [d, 2])));
  const none = heldPlaces({ status: "Confirmed", seats: 1, days: DAYS, kids: [{ name: "A" }] } as never, block());
  assert.deepEqual(none.days, Object.fromEntries(DAYS.map((d) => [d, 1])));
});

test("a child's dates outside the booking's own days are ignored (booking days win)", () => {
  const h = heldPlaces({ status: "Confirmed", seats: 1, days: DAYS.slice(0, 4), kids: [{ name: "P", dates: DAYS }] } as never, block());
  assert.equal(h.days["2026-10-16"], undefined);
  assert.equal(h.days["2026-10-15"], 1);
});

test("legacy kid dates that cannot be read fall back to the booking's days (never zero)", () => {
  const h = heldPlaces({ status: "Confirmed", seats: 1, days: DAYS, kids: [{ name: "L", dates: ["some old label"] }] } as never, block());
  assert.deepEqual(h.days, Object.fromEntries(DAYS.map((d) => [d, 1])));
});

const rule = (id: string) => INVARIANTS.find((r) => r.id === id)!;
const bk = (o: Partial<SnapBooking>): SnapBooking => ({ id: o.ref ?? "x", ref: "R", tenantId: "t", email: "p@x.test", status: "Confirmed", amount: 49, days: ["2026-10-19"], seats: 1, kidsLive: 1, createdAt: "2026-10-06T09:30:22.811Z", ...o } as SnapBooking);
const snap = (o: Partial<Snapshot>): Snapshot => ({ tenantId: "t", takenAt: "2026-10-06T10:00:00.000Z", bookings: [], blocks: [], payments: [], listings: [], ...o } as Snapshot);

test("early-bird-once: one checkout of two weeks (rows 1 ms apart, same stamp) is ONE use", () => {
  const s = snap({ bookings: [bk({ ref: "A", earlyBirdScope: "listing:L" } as never), bk({ ref: "B", earlyBirdScope: "listing:L", createdAt: "2026-10-06T09:30:22.812Z" } as never)] });
  assert.equal(rule("money.early-bird-once").check(s).length, 0);
});

test("early-bird-once: two separate checkouts by one family ARE flagged", () => {
  const s = snap({ bookings: [bk({ ref: "A", earlyBirdScope: "listing:L" } as never), bk({ ref: "B", earlyBirdScope: "listing:L", createdAt: "2026-10-06T09:45:00.000Z" } as never)] });
  assert.equal(rule("money.early-bird-once").check(s).length, 1);
});

const blk = (o: Partial<SnapBlock> = {}): SnapBlock => ({ id: "b1", listingId: "l", capacity: 1, capacityScope: "day", dates: ["2026-10-12"], dayCounts: { "2026-10-12": 2 }, bookedCount: 2, ...o } as SnapBlock);

test("capacity: a 'Promote now' overbook is allowed, an ordinary overbook is flagged", () => {
  const two = [bk({ ref: "W1", blockId: "b1", days: ["2026-10-12"] }), bk({ ref: "W2", blockId: "b1", days: ["2026-10-12"], email: "q@x.test", promoted: true } as never)];
  assert.equal(rule("capacity.day-stored-within-capacity").check(snap({ blocks: [blk()], bookings: two })).length, 0);
  assert.equal(rule("capacity.day-recomputed-within-capacity").check(snap({ blocks: [blk()], bookings: two })).length, 0);
  const plain = [two[0], { ...two[1], promoted: false }];
  assert.equal(rule("capacity.day-stored-within-capacity").check(snap({ blocks: [blk()], bookings: plain })).length, 1);
  assert.equal(rule("capacity.day-recomputed-within-capacity").check(snap({ blocks: [blk()], bookings: plain })).length, 1);
});
