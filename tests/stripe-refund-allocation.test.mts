import test from "node:test";
import assert from "node:assert/strict";
import { allocateRefund } from "../server/src/lib/stripeRefundSync";

const pence = (a: { ref: string; pence: number }[]) => a.map((x) => x.pence);

test("one booking takes the whole refund (capped at what it can still give back)", () => {
  assert.deepEqual(allocateRefund(500, [{ ref: "A", weight: 2000, headroom: 2000 }]), [{ ref: "A", pence: 500 }]);
  assert.deepEqual(allocateRefund(5000, [{ ref: "A", weight: 2000, headroom: 2000 }]), [{ ref: "A", pence: 2000 }]);
});

test("several bookings: pro rata by share, lines add up to the penny", () => {
  const a = allocateRefund(1001, [{ ref: "A", weight: 2000, headroom: 2000 }, { ref: "B", weight: 2000, headroom: 2000 }]);
  assert.equal(pence(a).reduce((s, n) => s + n, 0), 1001);
  assert.ok(Math.abs(a[0].pence - a[1].pence) <= 1);
  const u = allocateRefund(1000, [{ ref: "A", weight: 3000, headroom: 3000 }, { ref: "B", weight: 1000, headroom: 1000 }]);
  assert.deepEqual(pence(u), [750, 250]);
});

test("a booking with no room left passes its share to the others", () => {
  const a = allocateRefund(3000, [{ ref: "A", weight: 2000, headroom: 500 }, { ref: "B", weight: 2000, headroom: 2000 }]);
  assert.deepEqual(pence(a), [500, 2000].map((n, i) => (i === 0 ? 500 : 2000)));
  assert.equal(pence(a).reduce((s, n) => s + n, 0), 2500, "nothing beyond what the bookings can give back is attributed");
});

test("zero weights fall back to an equal split; nothing to allocate gives nothing", () => {
  assert.deepEqual(pence(allocateRefund(1000, [{ ref: "A", weight: 0, headroom: 1000 }, { ref: "B", weight: 0, headroom: 1000 }])), [500, 500]);
  assert.deepEqual(allocateRefund(0, [{ ref: "A", weight: 1, headroom: 1 }]), []);
});
