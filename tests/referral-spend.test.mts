import test from "node:test";
import assert from "node:assert/strict";
import { friendPaidAmount } from "../server/src/lib/referralSpend";

test("DI-032 friend spend is what they paid after their code, not the pre-code target", () => {
  // £90 basket, £9 referral code off each of two kids -> £81 paid
  assert.equal(friendPaidAmount([{ amount: 40.5, status: "Confirmed" }, { amount: 40.5, status: "Confirmed" }]), 81);
});
test("DI-032 waitlisted rows are ignored; float noise is rounded", () => {
  assert.equal(friendPaidAmount([{ amount: 0.1 }, { amount: 0.2 }, { amount: 50, status: "Waitlisted" }]), 0.3);
  assert.equal(friendPaidAmount([]), 0);
});
