import test from "node:test";
import assert from "node:assert/strict";
import { releaseCap, releaseValue } from "../../features/bookings/helpers";
import { applyCancelDay, applyRowAction } from "../../features/bookings/mutations";
import type { Booking } from "../../features/bookings/types";

// FINAL POLISH (D): provider cancel-day, then the family releases days, on a booking with a one-off T-shirt. The cap understated the value of a standing
// day once the booking's amount had dropped (it divided the lower amount by ALL days ever booked), so the family was refunded 2.28 to 3.42 too much.
// 7 days x 23 = 161 pass + T-shirt 8 = 169 paid. The refund can never pass: paid - (standing days x 23 + T-shirt).
const days = Array.from({ length: 7 }, (_, i) => `2026-10-${String(18 + i).padStart(2, "0")}`);
const fresh = (): Booking => ({ ref: "R", booker: "B", email: "e", phone: "", child: "K", listing: "L", pass: "7", ticket: "", dates: "", sessions: [], status: "Confirmed", pay: "Paid", method: "Card",
  amount: 169, amountPaid: 169, addons: [], kids: [{ name: "K", dates: [...days] }], days: [...days],
  addonLines: [{ child: "K", label: "T-shirt (Size: M)", price: 8, days: [], perDay: false, qty: 1 }] }) as unknown as Booking;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** The provider cancels `n` days with a refund, and approves each (the money has moved). */
function providerCancels(b: Booking, n: number): number {
  let given = 0;
  for (let i = 0; i < n; i++) {
    const res = applyCancelDay(b, 0, days[1 + i], { resolution: "refund" });
    given += res?.amount ?? 0;
    applyRowAction(b, "refund-approve");
    b.refundedApproved = given;
    b.refundLog = [...(b.refundLog ?? []), { label: "Refund approved", amount: res?.amount ?? 0, on: "x", by: "P", source: "Card" }];
  }
  return given;
}

for (const [prov, parent] of [[1, 2], [3, 2], [3, 3], [1, 1]] as const) {
  test(`provider cancels ${prov} day(s), family releases ${parent}: the family gets exactly the value of the days it gives up`, () => {
    const b = fresh();
    const given = providerCancels(b, prov);
    const standingBefore = 7 - prov;
    const release = days.slice(1 + prov, 1 + prov + parent);
    assert.equal(release.length, parent);
    const cap = releaseCap(b, [{ kid: b.kids![0], days: release }]);
    const wholeLeft = standingBefore - parent === 0;
    const expected = r2(wholeLeft ? 23 * parent + 8 : 23 * parent); // the last day out takes the T-shirt with it
    assert.equal(cap, expected, `cap (given so far ${given})`);
    assert.ok(given + cap <= 169 - (23 * (standingBefore - parent) + (wholeLeft ? 0 : 8)) + 0.005, "total refunded stays within the entitlement");
    assert.ok(releaseValue(b, 0, release) <= expected + 0.005);
  });
}
test("a day a policy kept the money for still does not raise the next day's price", () => {
  const b = fresh();
  b.amount = 161; b.amountPaid = 161; b.addonLines = [];
  b.kids = [{ name: "K", dates: [...days], cancelledDays: [days[0]] }];
  assert.equal(r2(releaseValue(b, 0, [days[1]])), 23);
});
