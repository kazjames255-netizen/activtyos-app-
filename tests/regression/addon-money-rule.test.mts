import test from "node:test";
import assert from "node:assert/strict";
import { applyCancelDay, applyPartialCancel, settleShareRemoval } from "../../features/bookings/mutations";
import { lineRequestBlock } from "../../features/bookings/addonRequests";

// ONE money rule: new amount = old amount - removed share; refund = max(0, paid - new amount); a one-off extra is never spread over days.

const DAYS = ["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"];
const bottle = { child: "kid", label: "Water bottle × 7 (Colour: Blue)", price: 21, days: DAYS, perDay: true, name: "Water bottle", answers: [{ label: "Colour", value: "Blue" }], qty: 7 };
const shirt = { child: "kid", label: "T-shirt (Size: M)", price: 8, days: DAYS, perDay: false, name: "T-shirt", qty: 1 };
const mk = (o: Record<string, unknown> = {}) => ({
  ref: "APF-3", status: "Confirmed", pay: "Paid", amount: 169, amountPaid: 169, method: "Card", child: "kid", days: DAYS, addons: [`${bottle.label} — £21.00`, `${shirt.label} — £8.00`],
  addonLines: [{ ...bottle }, { ...shirt }], kids: [{ name: "kid", dates: DAYS }], ...o,
}) as any;

test("a one-off extra is not part of a day's refund: paid 169, cancel a day -> 20 + 3 = 23 back, the T-shirt stays", () => {
  const b = mk();
  const r = applyCancelDay(b, 0, DAYS[2], { resolution: "refund" });
  assert.equal(r?.amount, 23); assert.equal(b.amount, 146); assert.equal(b.cancel?.amount, 23);
  assert.equal(b.addonLines.find((l: any) => l.name === "T-shirt").price, 8);
});

test("part-paid: removing 12 from 161 owed with 10 paid refunds nothing; paid 150 refunds exactly 1", () => {
  const a = mk({ pay: "Partially paid", amount: 161, amountPaid: 10, addons: [], addonLines: [] });
  const ra = settleShareRemoval(a, "x", 12, { resolution: "refund" });
  assert.equal(a.amount, 149); assert.equal(ra.amount, 0); assert.equal(a.cancel, undefined);
  const b = mk({ pay: "Partially paid", amount: 161, amountPaid: 150, addons: [], addonLines: [] });
  const rb = settleShareRemoval(b, "x", 12, { resolution: "refund" });
  assert.equal(b.amount, 149); assert.equal(rb.amount, 1); assert.equal(b.cancel?.amount, 1);
});

test("a second removal only refunds what is still overpaid (no double refund)", () => {
  const b = mk({ amount: 161, amountPaid: 161, addons: [], addonLines: [] });
  assert.equal(settleShareRemoval(b, "x", 12, { resolution: "refund" }).amount, 12);
  assert.equal(settleShareRemoval(b, "y", 20, { resolution: "refund" }).amount, 20);
  assert.equal(b.cancel?.amount, 32); assert.equal(b.amount, 129);
});

test("a joint booking that stores no amountPaid keeps its paid money on the record when the amount drops", () => {
  const b = mk({ amount: 100, amountPaid: 0, addons: [], addonLines: [] });
  assert.equal(settleShareRemoval(b, "x", 30, { resolution: "refund" }).amount, 30);
  assert.equal(b.amountPaid, 100);
});

test("a parent releasing days of an UNPAID booking: each day's pass share and its extras leave what is owed; a paid one keeps its amount (policy refund)", () => {
  const u = mk({ pay: "Unpaid", amountPaid: 0, addons: [`${bottle.label} — £21.00`], addonLines: [{ ...bottle }] , amount: 161 });
  applyPartialCancel(u, [{ childKey: "kid", days: [DAYS[2], DAYS[3]] }]);
  assert.equal(u.amount, 115);
  const p = mk({ amount: 161, amountPaid: 161, addons: [`${bottle.label} — £21.00`], addonLines: [{ ...bottle }] });
  applyPartialCancel(p, [{ childKey: "kid", days: [DAYS[2], DAYS[3]] }]);
  assert.equal(p.amount, 161);
});

test("a change follows the remaining-days rule: allowed while any day of a daily extra is open, refused when all are past or too close", () => {
  const b = { status: "Confirmed", days: DAYS } as any;
  const line = { key: "k", days: DAYS, perDay: true };
  assert.equal(lineRequestBlock(b, line, "2026-10-19", 3), "none");   // D1 passed, later days still open
  assert.equal(lineRequestBlock(b, line, "2026-10-23", 3), "cutoff"); // the rest are inside the cut-off (D6, D7 within 3 days or past)
  assert.equal(lineRequestBlock(b, line, "2026-11-01", 3), "past");
});
