import test from "node:test";
import assert from "node:assert/strict";
import { orderSessions, indexAfterReload, isLiveNow, sessionKey } from "../../features/onlinesessions/order";

// The parent's "Your online sessions" carousel: nearest first, joinable-now first, finished dropped.
const NOW = Date.parse("2026-10-21T11:55:00Z");
const mk = (id: string, startsAt: string, extra: Record<string, unknown> = {}) => {
  const s = new Date(startsAt).getTime();
  return { listingId: id, date: startsAt.slice(0, 10), listingName: id, startsAt, opensAt: new Date(s - 10 * 60_000).toISOString(), closesAt: new Date(s + 90 * 60_000).toISOString(), ...extra };
};

test("soonest session comes first", () => {
  const out = orderSessions([mk("c", "2026-11-03T12:00:00Z"), mk("a", "2026-10-21T12:00:00Z"), mk("b", "2026-10-28T12:00:00Z")], NOW);
  assert.deepEqual(out.map((s) => s.listingId), ["a", "b", "c"]);
});

test("a session joinable right now sorts ahead of an earlier-listed one, waiting-for-host included", () => {
  const later = mk("later", "2026-10-21T14:00:00Z");
  const open = mk("open", "2026-10-21T12:00:00Z", { joinState: "open" });
  const waiting = mk("waiting", "2026-10-21T11:50:00Z", { joinState: "waiting_host" });
  const out = orderSessions([later, open, waiting], NOW);
  assert.deepEqual(out.map((s) => s.listingId), ["waiting", "open", "later"]);
});

test("an unpaid session starting soon is not 'live' and keeps its time order", () => {
  const unpaid = mk("unpaid", "2026-10-21T12:00:00Z", { joinState: "unpaid" });
  const paid = mk("paid", "2026-10-21T13:00:00Z", { joinState: "early" });
  assert.equal(isLiveNow(unpaid, NOW), false);
  assert.deepEqual(orderSessions([paid, unpaid], NOW).map((s) => s.listingId), ["unpaid", "paid"]);
});

test("finished sessions and sessions whose window has closed are dropped", () => {
  const done = mk("done", "2026-10-21T08:00:00Z", { joinState: "finished" });
  const past = mk("past", "2026-10-20T09:00:00Z");
  const ok = mk("ok", "2026-10-22T09:00:00Z");
  assert.deepEqual(orderSessions([done, past, ok], NOW).map((s) => s.listingId), ["ok"]);
});

test("same start time: ordered by name so the carousel is stable; input is not mutated", () => {
  const input = [mk("zed", "2026-10-25T10:00:00Z"), mk("abe", "2026-10-25T10:00:00Z")];
  const copy = [...input];
  assert.deepEqual(orderSessions(input, NOW).map((s) => s.listingId), ["abe", "zed"]);
  assert.deepEqual(input, copy);
});

test("after a reload the carousel stays on the session being looked at, else goes to the first", () => {
  const ordered = orderSessions([mk("a", "2026-10-22T10:00:00Z"), mk("b", "2026-10-23T10:00:00Z"), mk("c", "2026-10-24T10:00:00Z")], NOW);
  assert.equal(indexAfterReload(ordered, sessionKey(ordered[2])), 2);
  assert.equal(indexAfterReload(ordered, "gone_2026-01-01"), 0);
  assert.equal(indexAfterReload(ordered, null), 0);
});
