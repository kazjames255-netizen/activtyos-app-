/**
 * Payment-method rules + Tax-Free Childcare split (pure; no network/Firestore).
 * PY-009 (TFC lands as awaiting-payment), PY-012 (TFC part-pay + card remainder),
 * PY-025 (server enforces the tenant/listing payMethods).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { canonicalMethod, isTfcMethod, methodAllowed, methodKey, splitTfc, TFC_METHOD } from "../server/src/lib/payMethods";
import { balanceOf } from "../server/src/lib/payGate";
import { childcareRoute } from "../server/src/lib/childcare";
import { pendingPayWords, payMethodLabel } from "../features/bookings/helpers";
import { PUBLIC_SETTINGS_KEYS } from "../server/src/lib/publicLibrary";
import type { Booking } from "../features/bookings/types";

const bk = (o: Record<string, unknown>) => ({ ref: "R1", bid: "b", status: "Confirmed", pay: "Unpaid", amount: 100, ...o }) as unknown as Booking;

test("methodKey maps checkout methods and Setup labels onto the same rail", () => {
  assert.equal(methodKey("tfc"), "tfc");
  assert.equal(methodKey("Tax-Free Childcare"), "tfc");
  assert.equal(methodKey("Childcare voucher — Edenred"), "voucher");
  assert.equal(methodKey("Childcare vouchers"), "voucher");
  assert.equal(methodKey("Cash on the day"), "cash");
  assert.equal(methodKey("bank"), "bank");
  assert.equal(methodKey("Card"), "card");
  assert.equal(methodKey("HAF (funded £0)"), "haf");
});

test("PY-009: TFC is stored under one canonical method that the operator UI recognises", () => {
  assert.equal(canonicalMethod("tfc"), TFC_METHOD);
  assert.equal(canonicalMethod("Cash on the day"), "Cash on the day");
  assert.equal(isTfcMethod("HMRC Tax-Free Childcare"), true);
  assert.equal(isTfcMethod("Childcare voucher — Edenred"), false);
  const b = { method: TFC_METHOD, voucherScheme: "HMRC Tax-Free Childcare" };
  assert.equal(pendingPayWords(b).action, "Mark Tax-Free Childcare received");
  assert.equal(payMethodLabel(b), "HMRC Tax-Free Childcare");
  // Reconciliation buckets it as TFC, not as a voucher, despite carrying a scheme name.
  assert.equal(childcareRoute(b), "Tax-Free Childcare");
  assert.equal(childcareRoute({ method: "Childcare voucher — Edenred", voucherScheme: "Edenred" }), "Childcare vouchers");
});

test("PY-025: payMethods is published to the parent checkout", () => {
  assert.ok((PUBLIC_SETTINGS_KEYS as readonly string[]).includes("payMethods"));
});

test("PY-025: server rejects a method the tenant has not enabled", () => {
  assert.equal(methodAllowed("cash", ["Card"]).ok, false);
  assert.equal(methodAllowed("card", ["Card"]).ok, true);
  assert.equal(methodAllowed("tfc", ["Card", "Cash on the day"]).ok, false);
  assert.equal(methodAllowed("tfc", ["Card", "Tax-Free Childcare"]).ok, true);
  assert.equal(methodAllowed("Childcare voucher — Edenred", ["Card", "Childcare vouchers"]).ok, true);
  assert.equal(methodAllowed("bank", ["Card", "Cash on the day"]).ok, false);
  assert.equal(methodAllowed("cash", undefined).ok, true, "no Setup list = legacy, everything allowed");
  assert.equal(methodAllowed("cash", []).ok, true);
});

test("PY-025: a listing's own payMethods narrow the tenant's (card stays tenant-governed)", () => {
  const tenant = ["Card", "Bank transfer", "Cash on the day"];
  assert.equal(methodAllowed("cash", tenant, ["Bank transfer"]).ok, false);
  assert.equal(methodAllowed("bank", tenant, ["Bank transfer"]).ok, true);
  assert.equal(methodAllowed("card", tenant, ["Bank transfer"]).ok, true);
  assert.equal(methodAllowed("cash", tenant, undefined).ok, true);
  assert.equal(methodAllowed("cash", tenant, []).ok, false, "an empty listing list means card only");
  assert.equal(methodAllowed("haf", ["Card"]).ok, true, "funded places are policed elsewhere");
});

test("PY-012: splitTfc shares HMRC's amount across bookings and conserves the total", () => {
  assert.deepEqual(splitTfc([100], 40), [40]);
  const parts = splitTfc([60, 40], 50);
  assert.equal(Math.round(parts.reduce((s, p) => s + p, 0) * 100) / 100, 50);
  assert.deepEqual(parts, [30, 20]);
  assert.deepEqual(splitTfc([100], 0), [0], "0 is not a split");
  assert.deepEqual(splitTfc([100], 100), [0], "the whole total is plain TFC");
  assert.deepEqual(splitTfc([100], 250), [0], "over the total is plain TFC");
  assert.deepEqual(splitTfc([33.33, 33.33, 33.34], 10).reduce((s, p) => s + p, 0).toFixed(2), "10.00");
  assert.deepEqual(splitTfc([], 10), []);
});

test("PY-012: a card payment asks only for the remainder of a part-paid TFC booking", () => {
  const split = bk({ pay: "Awaiting voucher payment", method: TFC_METHOD, voucherScheme: "HMRC Tax-Free Childcare", amount: 100, tfcAmount: 40, tfcRemainderVia: "card" });
  assert.equal(balanceOf(split), 60);
  assert.equal(balanceOf(bk({ amount: 100 })), 100, "non-split bookings unchanged");
  // Card remainder taken (settlePayment records amountPaid/cardPaid): nothing left for card.
  assert.equal(balanceOf({ ...split, amountPaid: 60, cardPaid: 60 } as Booking), 0);
  // HMRC money then lands (Mark received): fully paid.
  assert.equal(balanceOf({ ...split, pay: "Paid", amountPaid: 100, cardPaid: 60 } as Booking), 0);
});
