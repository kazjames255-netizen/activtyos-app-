/**
 * Pins the rules the policies-amend fuzz area judges bookings by (server/tools/assure/actions/policies-amend.ts):
 * amend notice + limit refusals, and that moving a date EARLIER records the later pre-move date but the refund still uses the earlier one.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_POLICIES, effectiveRefundDate, refundFor } from "../../lib/cancellation";
import { amendLimitError, amendNoticeError, applyMoveApprove } from "../../server/src/lib/dateChange";

const NOW = Date.parse("2026-10-06T10:00:00Z");
const mv = (from: string, to: string) => ({ from, to });

test("notice: a day inside the notice window cannot be moved; 0 means no rule", () => {
  assert.ok(amendNoticeError([mv("2026-10-08", "2026-10-15")], 72, NOW));
  assert.equal(amendNoticeError([mv("2026-10-20", "2026-10-21")], 72, NOW), null);
  assert.equal(amendNoticeError([mv("2026-10-07", "2026-10-21")], 0, NOW), null);
});

test("limit: moves past the per-booking limit are refused; 0 means unlimited", () => {
  assert.ok(amendLimitError([mv("a", "b")], 1, 1));
  assert.ok(amendLimitError([mv("a", "b"), mv("c", "d")], 1, 2));
  assert.equal(amendLimitError([mv("a", "b")], 5, 0), null);
});

test("moved earlier: origFirstDate keeps the later pre-move day, refund notice uses the earlier day", () => {
  const b: any = { days: ["2026-10-22"], status: "Confirmed", dateChangeRequest: { moves: [{ from: "2026-10-22", to: "2026-10-19" }], status: "pending" } };
  applyMoveApprove(b, undefined, undefined, {});
  assert.equal(b.origFirstDate, "2026-10-22");
  assert.deepEqual(b.days, ["2026-10-19"]);
  assert.equal(b.amendMovesApproved, 1);
  assert.equal(effectiveRefundDate(b.origFirstDate, b.days[0]), "2026-10-19");
});

test("provider cancel refunds in full whatever the notice; 'No refunds' gives nothing to a parent", () => {
  const none = DEFAULT_POLICIES.find((p) => p.id === "none")!;
  assert.equal(refundFor(none, "2026-12-01", 54, "2026-10-06T10:00:00Z", "parent")?.amount, 0);
  assert.equal(refundFor(none, "2026-10-07", 54, "2026-10-06T10:00:00Z", "provider")?.amount, 54);
});
