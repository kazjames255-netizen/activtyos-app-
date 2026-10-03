/**
 * AM-011 (admin fee, cheaper moves), AM-012 (self-service source wiring), BQ-006 (operator price override),
 * AW-025 (waitlisted owes nothing). Pure: no network, no Firestore.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addAmendFee, amendCheaperError, applyMoveApprove } from "../server/src/lib/dateChange";
import { scaleToTotal, splitOriginal } from "../server/src/lib/priceOverride";
import { balanceOf } from "../server/src/lib/payGate";
import { owedOf } from "../features/bookings/helpers";
import type { Booking } from "../features/bookings/types";

const bk = (o: Record<string, unknown> = {}) => ({ ref: "R1", bid: "b", status: "Confirmed", pay: "Paid", amount: 54, days: ["2026-10-12", "2026-10-13"], kids: [], sessions: [], ...o }) as unknown as Booking;
const withReq = (b: Booking) => { b.dateChangeRequest = { moves: [{ from: "2026-10-12", to: "2026-10-14" }], status: "pending" }; return b; };

test("addAmendFee: a paid booking owes exactly the fee afterwards", () => {
  const b = bk();
  assert.equal(addAmendFee(b, 5), 5);
  assert.equal(b.amount, 59);
  assert.equal(b.pay, "Partially paid");
  assert.equal(owedOf(b), 5);
  assert.equal(b.amendFeesCharged, 5);
});
test("addAmendFee: unpaid booking just rises; funded, cancelled and zero fee are untouched", () => {
  const u = bk({ pay: "Unpaid" });
  addAmendFee(u, 5);
  assert.equal(u.amount, 59); assert.equal(owedOf(u), 59); assert.equal(u.pay, "Unpaid");
  for (const o of [{ pay: "Funded", amount: 0 }, { status: "Cancelled" }, {}]) {
    const b = bk(o); const before = b.amount;
    assert.equal(addAmendFee(b, o === undefined || Object.keys(o).length === 0 ? 0 : 5), 0);
    assert.equal(b.amount, before);
  }
});
test("applyMoveApprove charges the fee once and only when a date actually moved", () => {
  const b = withReq(bk());
  applyMoveApprove(b, undefined, undefined, { fee: 7.5 });
  assert.equal(b.amount, 61.5);
  assert.equal(b.dateChangeRequest?.feeCharged, 7.5);
  applyMoveApprove(b, undefined, undefined, { fee: 7.5 }); // replay
  assert.equal(b.amount, 61.5);
  const none = withReq(bk());
  applyMoveApprove(none, [], undefined, { fee: 7.5 }); // nothing approved
  assert.equal(none.amount, 54);
  const free = withReq(bk());
  applyMoveApprove(free, undefined, undefined, {}); // fee unset
  assert.equal(free.amount, 54);
});
test("applyMoveApprove self-service flag is recorded", () => {
  const b = withReq(bk());
  applyMoveApprove(b, undefined, undefined, { selfService: true });
  assert.equal(b.dateChangeRequest?.selfService, true);
  assert.equal(b.dateChangeRequest?.status, "approved");
});
test("amendCheaperError: refuses a cheaper day only when the setting is off", () => {
  const price: Record<string, number> = { "2026-10-12": 30, "2026-10-14": 20, "2026-10-15": 30 };
  const f = (d: string) => price[d];
  const m = [{ from: "2026-10-12", to: "2026-10-14" }];
  assert.match(amendCheaperError(m, f, false) ?? "", /doesn't allow moves to a cheaper session/);
  assert.equal(amendCheaperError(m, f, true), null);
  assert.equal(amendCheaperError([{ from: "2026-10-12", to: "2026-10-15" }], f, false), null); // same price
  assert.equal(amendCheaperError(m, () => undefined, false), null); // no per-day price -> cannot compare
});
test("AM-012: instant apply and the fee/cheaper rules are wired into the amend route", () => {
  const src = readFileSync(new URL("../server/src/routes/my.ts", import.meta.url), "utf8");
  assert.match(src, /enabled\(settings, "amendSelfService"\)/);
  assert.match(src, /amendCheaperError/);
  const bsrc = readFileSync(new URL("../server/src/routes/bookings.ts", import.meta.url), "utf8");
  assert.match(bsrc, /amendFee/);
});

test("scaleToTotal / splitOriginal always sum exactly", () => {
  const s = scaleToTotal([30, 20, 4], 40);
  assert.equal(Math.round(s.reduce((a, b) => a + b, 0) * 100) / 100, 40);
  assert.deepEqual(scaleToTotal([0, 0], 12), [12, 0]);
  assert.deepEqual(scaleToTotal([], 5), []);
  assert.deepEqual(scaleToTotal([10], 0), [0]);
  const o = splitOriginal([10, 20], 100);
  assert.equal(o[0] + o[1], 100);
});
test("BQ-006: overrideTotal is refused unless it's an operator booking for a family", () => {
  const src = readFileSync(new URL("../server/src/routes/my.ts", import.meta.url), "utf8");
  assert.match(src, /!onBehalf && "overrideTotal" in input[\s\S]{0,200}403/);
  assert.match(src, /if \(onBehalf && "overrideTotal" in input/);
});

test("AW-025: a waitlisted booking keeps its price but owes nothing to pay", () => {
  const w = bk({ status: "Waitlisted", pay: "Unpaid", amount: 54 });
  assert.equal(w.amount, 54);
  assert.equal(balanceOf(w), 0);
  assert.equal(balanceOf(bk({ status: "Confirmed", pay: "Unpaid" })), 54);
});
