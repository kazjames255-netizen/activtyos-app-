/**
 * CN-019: cancelling ONE of two children frees ONE place (pure helpers).
 * Run: server/node_modules/.bin/tsx --test tests/child-cancel-capacity.test.mts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { applyPlacesDelta, heldPlaces, placesDelta, type BlockDoc } from "../server/src/lib/blockDomain";
import { applyCancelChild, applyCancelDay, applyPartialCancel } from "../features/bookings/mutations";
import { attendeeCount } from "../features/bookings/helpers";
import type { Booking } from "../features/bookings/types";

const D = ["2027-07-27", "2027-07-28", "2027-07-29"];
const block = (): BlockDoc => ({
  tenantId: "t", listingId: "l", name: "b", startDate: D[0], endDate: D[2], capacity: 4,
  bookedCount: 2, open: true, capacityScope: "day",
  sessions: D.map((date) => ({ date, start: "09:00", end: "15:00" })),
  dayCounts: { [D[0]]: 2, [D[1]]: 2, [D[2]]: 2 },
});
const booking = (): Booking =>
  ({
    ref: "X-1", status: "Confirmed", seats: 2, days: [...D], amount: 60, child: "A", sessions: [],
    kids: [
      { name: "A", childId: "a", dates: [...D] },
      { name: "B", childId: "b", dates: [...D] },
    ],
  }) as unknown as Booking;
const run = (b: Booking, mutate: (b: Booking) => void, blk = block()) => {
  const before = structuredClone(b);
  mutate(b);
  const pd = placesDelta(heldPlaces(before, blk), heldPlaces(b, blk));
  return { pd, counts: applyPlacesDelta(blk, pd), b };
};

test("untouched booking holds seats x days (old behaviour)", () => {
  const h = heldPlaces(booking(), block());
  assert.equal(h.seats, 2);
  assert.deepEqual(h.days, { [D[0]]: 2, [D[1]]: 2, [D[2]]: 2 });
});

test("operator cancels one child: one place freed on every day", () => {
  const { pd, counts, b } = run(booking(), (x) => applyCancelChild(x, 0));
  assert.equal(b.status, "Confirmed");
  assert.equal(pd.seats, -1);
  assert.deepEqual(pd.days, { [D[0]]: -1, [D[1]]: -1, [D[2]]: -1 });
  assert.equal(counts.bookedCount, 1);
  assert.deepEqual(counts.dayCounts, { [D[0]]: 1, [D[1]]: 1, [D[2]]: 1 });
});

test("cancelling the same child twice does not free twice", () => {
  const b = booking();
  applyCancelChild(b, 0);
  const { pd } = run(b, (x) => applyCancelChild(x, 0));
  assert.equal(pd.seats, 0);
  assert.deepEqual(pd.days, {});
});

test("cancelling the last child after the first frees only the remainder", () => {
  const b = booking();
  const blk = block();
  const first = run(b, (x) => applyCancelChild(x, 0), blk);
  const second = run(b, (x) => applyCancelChild(x, 1), { ...blk, ...first.counts });
  assert.equal(b.status, "Cancelled");
  assert.equal(second.counts.bookedCount, 0);
  assert.deepEqual(second.counts.dayCounts, { [D[0]]: 0, [D[1]]: 0, [D[2]]: 0 });
});

test("whole-booking status cancel frees everything held", () => {
  const { pd } = run(booking(), (x) => { x.status = "Cancelled"; });
  assert.equal(pd.seats, -2);
  assert.deepEqual(pd.days, { [D[0]]: -2, [D[1]]: -2, [D[2]]: -2 });
});

test("one child releases one day: that day only, seat stays", () => {
  const { pd } = run(booking(), (x) => applyPartialCancel(x, [{ childKey: "a", days: [D[1]] }]));
  assert.equal(pd.seats, 0);
  assert.deepEqual(pd.days, { [D[1]]: -1 });
});

test("both children release the same day: two places on that day", () => {
  const { pd } = run(booking(), (x) =>
    applyPartialCancel(x, [{ childKey: "a", days: [D[1]] }, { childKey: "b", days: [D[1]] }]));
  assert.deepEqual(pd.days, { [D[1]]: -2 });
});

test("parent cancels one child via all their days: a seat and each day freed", () => {
  const { pd } = run(booking(), (x) => applyPartialCancel(x, [{ childKey: "b", days: D }]));
  assert.equal(pd.seats, -1);
  assert.deepEqual(pd.days, { [D[0]]: -1, [D[1]]: -1, [D[2]]: -1 });
});

test("operator cancel-day (label dates, single child) frees that day", () => {
  const blk = block();
  const b = { ...booking(), seats: 1, kids: undefined, child: "A", days: undefined,
    sessions: D.map((d) => `${new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).replace(/,/g, "")} · 09:00 – 15:00`) } as unknown as Booking;
  const label = b.sessions[1].split(" · ")[0];
  const { pd } = run(b, (x) => applyCancelDay(x, 0, label), blk);
  assert.equal(pd.seats, 0);
  assert.deepEqual(pd.days, { [D[1]]: -1 });
});

test("non-counting statuses hold nothing", () => {
  const b = booking();
  b.status = "Waitlisted";
  assert.deepEqual(heldPlaces(b, block()), { seats: 0, days: {} });
});

test("attendeeCount counts only children still holding a place", () => {
  const b = booking();
  assert.equal(attendeeCount(b), 2);
  applyCancelChild(b, 0);
  assert.equal(attendeeCount(b), 1);
});
