/**
 * Money regression tests (pure: no network, no Firestore, no Firebase).
 * Locks in the behaviour verified by hand on 3 Oct 2026 against the
 * "Standard test camp" rules.
 *
 * Run:   npm run test:money
 *        (= tsx --test tests/money.test.mts, using the tsx in server/node_modules)
 *
 * Covers: features/listings/discounts.ts (applyDiscounts),
 *         server/src/lib/discountCodes.ts (checkCode),
 *         features/bookings/helpers.ts (collectedNet / refundedGross).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { applyDiscounts, emptyRule, type DiscountRule } from "../features/listings/discounts";
import { checkCode, type DiscountCodeDoc } from "../server/src/lib/discountCodes";
import { collectedNet, refundedGross } from "../features/bookings/helpers";
import type { Booking } from "../features/bookings/types";

const rule = (kind: "person" | "session" | "early", over: Partial<DiscountRule>): DiscountRule => ({ ...emptyRule(kind), ...over });
const sibling = rule("person", { name: "Sibling", moreThan: 1, method: "subtract", value: 5 });
const multiSession = rule("session", { name: "Multi-session", moreThan: 3, method: "percent", value: 10 });
const earlyBird = rule("early", { name: "Early bird", method: "subtract", value: 10, beforeDate: "2026-10-04" });
const STANDARD = [sibling, multiSession, earlyBird];

const total = (rules: DiscountRule[], items: { name: string; price: number; days: number; heads?: number }[], attendees: number, today: string) =>
  applyDiscounts(rules, items, attendees, today).total;

test("applyDiscounts: Standard test camp", async (t) => {
  await t.test("1 child, 5-day £90, on 3 Oct = £71 (10% multi-session + £10 early bird)", () => {
    assert.equal(total(STANDARD, [{ name: "5-day", price: 90, days: 5, heads: 1 }], 1, "2026-10-03"), 71);
  });
  await t.test("same on 5 Oct (early bird over) = £81", () => {
    assert.equal(total(STANDARD, [{ name: "5-day", price: 90, days: 5, heads: 1 }], 1, "2026-10-05"), 81);
  });
  await t.test("1 child, 3-day £54, on 3 Oct = £44 (3 sessions is not MORE than 3)", () => {
    assert.equal(total(STANDARD, [{ name: "3-day", price: 54, days: 3, heads: 1 }], 1, "2026-10-03"), 44);
  });
  await t.test("2 children on a 3-day pass (heads 2, attendees 2) = £78.20", () => {
    assert.equal(total(STANDARD, [{ name: "3-day", price: 54, days: 3, heads: 2 }], 2, "2026-10-03"), 78.2);
  });
  await t.test("2 children x 3 single-day lines = £45 each, sibling rule only (never pairs on one line)", () => {
    // Each child has their own 3 lines of £15 (heads 1 per line): no sibling saving, 3 sessions is not > 3.
    const perChild = [1, 2].map(() =>
      total([sibling], [1, 2, 3].map((d) => ({ name: `Day ${d}`, price: 15, days: 1, heads: 1 })), 1, "2026-10-05"),
    );
    assert.deepEqual(perChild, [45, 45]);
  });
  await t.test("never goes below £0", () => {
    assert.equal(total(STANDARD, [{ name: "tiny", price: 4, days: 5, heads: 2 }], 2, "2026-10-03"), 0);
    assert.equal(total([earlyBird], [{ name: "tiny", price: 3, days: 1, heads: 1 }], 1, "2026-10-03"), 0);
  });
});

const code = (over: Partial<DiscountCodeDoc>): DiscountCodeDoc => ({ tenantId: "t1", code: "TEST", type: "percent", value: 10, ...over });
const TODAY = "2026-10-03";
type Ctx = Parameters<typeof checkCode>[3];
const offOf = (c: DiscountCodeDoc, subtotal: number, ctx?: Ctx) => {
  const r = checkCode(c, subtotal, TODAY, ctx);
  assert.ok(r.ok, r.ok ? "" : r.reason);
  return r.ok ? r.off : NaN;
};
const refusal = (c: DiscountCodeDoc, subtotal: number, ctx?: Ctx) => {
  const r = checkCode(c, subtotal, TODAY, ctx);
  assert.equal(r.ok, false);
  return r.ok ? "" : r.reason;
};

// Mirrors the basket logic in server/src/routes/my.ts (~line 1289): codes stack by
// ADDING each checkCode().off, an `exclusive` code refuses any combination, and the
// total is capped at the subtotal. That logic is inline in the route (not exported),
// so it is reproduced here; the per-code maths below is the real checkCode.
function stack(codes: DiscountCodeDoc[], subtotal: number): { ok: true; off: number } | { ok: false; reason: string } {
  const excl = codes.find((c) => c.exclusive);
  if (excl && codes.length > 1) return { ok: false, reason: `Code ${excl.code} can’t be combined with other codes` };
  let off = 0;
  for (const c of codes) {
    const r = checkCode(c, subtotal, TODAY);
    if (!r.ok) return r;
    off = Math.round((off + r.off) * 100) / 100;
  }
  return { ok: true, off: Math.min(off, subtotal) };
}

test("discount codes (checkCode)", async (t) => {
  await t.test("percent 10% on a £71 subtotal = £7.10", () => assert.equal(offOf(code({ type: "percent", value: 10 }), 71), 7.1));
  await t.test("two stacked percent codes ADD (not compound) = £14.20", () => {
    const r = stack([code({ code: "A", value: 10 }), code({ code: "B", value: 10 })], 71);
    assert.deepEqual(r, { ok: true, off: 14.2 });
  });
  await t.test("per-attendee £3 x 2 children = £6", () => assert.equal(offOf(code({ type: "perAttendee", value: 3 }), 71, { attendees: 2 }), 6));
  await t.test("flat £5 per booking", () => {
    assert.equal(offOf(code({ type: "amount", value: 5 }), 71, { attendees: 2 }), 5);
  });
  await t.test("a code cannot reduce below zero", () => {
    assert.equal(offOf(code({ type: "amount", value: 50 }), 20), 20);
    assert.equal(offOf(code({ type: "perAttendee", value: 30 }), 20, { attendees: 2 }), 20);
    assert.deepEqual(stack([code({ code: "A", type: "amount", value: 15 }), code({ code: "B", type: "amount", value: 15 })], 20), { ok: true, off: 20 });
  });
  await t.test("minimum spend £60 is judged on the subtotal AFTER automatic discounts", () => {
    const min60 = code({ type: "amount", value: 5, minSpend: 60 });
    assert.match(refusal(min60, 10), /at least £60\.00/);
    assert.match(refusal(min60, 20), /at least £60\.00/);
    assert.equal(offOf(min60, 71), 5);
    // Wiring check: £90 camp on 3 Oct leaves £71 after automatic discounts (accepted); a £54 pass leaves £44 (refused).
    const after90 = total(STANDARD, [{ name: "5-day", price: 90, days: 5, heads: 1 }], 1, TODAY);
    const after54 = total(STANDARD, [{ name: "3-day", price: 54, days: 3, heads: 1 }], 1, TODAY);
    assert.equal(checkCode(min60, after90, TODAY).ok, true);
    assert.equal(checkCode(min60, after54, TODAY).ok, false);
  });
  await t.test("'exclusive' code is refused when combined with another", () => {
    const r = stack([code({ code: "SOLO", exclusive: true }), code({ code: "OTHER" })], 71);
    assert.equal(r.ok, false);
    assert.match(r.ok ? "" : r.reason, /can’t be combined/);
    assert.equal(stack([code({ code: "SOLO", exclusive: true })], 71).ok, true);
  });
  await t.test("reserved code is refused for another email, accepted for the owner", () => {
    const reserved = code({ assignedTo: "Owner@Example.com" });
    assert.match(refusal(reserved, 71, { email: "other@example.com" }), /reserved for another customer/);
    assert.match(refusal(reserved, 71), /reserved for another customer/);
    assert.equal(offOf(reserved, 71, { email: " owner@example.com " }), 7.1);
  });
  await t.test("expired code refused; the expiry date itself is still valid (inclusive)", () => {
    assert.match(refusal(code({ expiry: "2026-10-02" }), 71), /expired/);
    assert.equal(offOf(code({ expiry: "2026-10-03" }), 71), 7.1);
  });
  await t.test("usage limit reached is refused", () => {
    assert.match(refusal(code({ usageLimit: 5, usedCount: 5 }), 71), /usage limit/);
    assert.equal(offOf(code({ usageLimit: 5, usedCount: 4 }), 71), 7.1);
  });
});

const booking = (over: Record<string, unknown>) => over as unknown as Booking;
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.005, `${a} !== ${b}`);

test("collectedNet / refundedGross", async (t) => {
  await t.test("paid £20 with an APPROVED partial refund of £10 nets £10, not £0 (3 Oct double-count regression)", () => {
    const b = booking({
      pay: "Partially refunded", amount: 20, amountPaid: 20,
      refundLog: [{ label: "Refund approved (partial)", amount: 10 }],
      cancel: { on: "2026-10-03", by: "op", refund: "approved", amount: 10 },
    });
    near(refundedGross(b), 10);
    near(collectedNet(b), 10);
  });
  await t.test("fully refunded £20 nets £0", () => {
    const b = booking({
      pay: "Refunded", amount: 20, amountPaid: 20,
      refundLog: [{ label: "Refund approved", amount: 20 }],
      cancel: { on: "2026-10-03", by: "op", refund: "approved", amount: 20 },
    });
    near(collectedNet(b), 0);
  });
  await t.test("whole-booking refund with no log line still counts once via cancel.amount", () => {
    const b = booking({ pay: "Refunded", amount: 20, amountPaid: 20, refundLog: [], cancel: { on: "x", by: "op", refund: "approved", amount: 20 } });
    near(refundedGross(b), 20);
    near(collectedNet(b), 0);
  });
  await t.test("cancelled-and-refunded Sam: £5.29 paid, £2.65 refunded nets £2.64", () => {
    const b = booking({
      pay: "Partially refunded", amount: 5.29, amountPaid: 5.29,
      refundLog: [{ label: "Refund approved (partial)", amount: 2.65 }],
      cancel: { on: "2026-10-03", by: "op", refund: "approved", amount: 2.65 },
    });
    near(collectedNet(b), 2.64);
  });
  await t.test("a still-pending refund request is not counted", () => {
    const b = booking({ pay: "Paid", amount: 20, amountPaid: 20, refundLog: [], cancel: { on: "x", by: "parent", refund: "requested", amount: 20 } });
    near(collectedNet(b), 20);
  });
});

// ── Discount rule variants (tracker DI-002, DI-003, DI-005, DI-007, DI-008) ────────────────────────────────────────────────────────────
test("applyDiscounts: rule variants", async (t) => {
  const two3day = [{ name: "3 days", price: 54, days: 3, heads: 2 }];
  await t.test("DI-002 sibling by percentage: 10% off each child = 2 x £54 - £10.80 = £97.20", () => {
    const r = rule("person", { name: "Sibling %", moreThan: 1, method: "percent", value: 10 });
    assert.equal(total([r], two3day, 2, "2026-10-05"), 97.2);
  });
  await t.test("DI-003 sibling discounted price: each child pays £45 = £90", () => {
    const r = rule("person", { name: "Sibling price", moreThan: 1, method: "price", value: 45 });
    assert.equal(total([r], two3day, 2, "2026-10-05"), 90);
  });
  await t.test("DI-005 sibling limited to '5 days' gives nothing on '3 days' = £108", () => {
    const r = rule("person", { name: "Sibling 5-day only", moreThan: 1, method: "subtract", value: 5, passNames: ["5 days"] });
    assert.equal(total([r], two3day, 2, "2026-10-05"), 108);
  });
  await t.test("DI-007 multi-session counts days across children: 3 days x 2 children = 6 sessions, 10% of £108 = £97.20", () => {
    assert.equal(total([multiSession], two3day, 2, "2026-10-05"), 97.2);
  });
  await t.test("DI-008 multi-session is not applied at the threshold: one child on 3 days = £54", () => {
    assert.equal(total([multiSession], [{ name: "3 days", price: 54, days: 3, heads: 1 }], 1, "2026-10-05"), 54);
  });
  await t.test("display regression: 2 passes x 2 children on the Standard rules = £166.40 (sibling lands on both passes)", () => {
    const pass = { name: "3-day", price: 54, days: 3, heads: 2 };
    assert.equal(total(STANDARD, [pass, { ...pass }], 2, "2026-10-03"), 166.4);
  });
});

// ── Home-visit coverage by postcode list (tracker LT-003) ───────────────────────────────────────────────────────────────────────────────
import { checkCoverage } from "../server/src/lib/coverageArea";
test("checkCoverage: postcode list SW1, SW2", async (t) => {
  const area = { mode: "postcodePrefixes" as const, postcodePrefixes: ["SW1", "SW2"] };
  await t.test("SW1A 1AA is inside", async () => assert.deepEqual(await checkCoverage(area, "SW1A 1AA"), { ok: true }));
  await t.test("sw2 4qd (lower case) is inside", async () => assert.deepEqual(await checkCoverage(area, "sw2 4qd"), { ok: true }));
  await t.test("N1 9GU is refused with the coverage message", async () => {
    const r = await checkCoverage(area, "N1 9GU");
    assert.equal(r.ok, false);
    assert.match(r.ok ? "" : r.reason, /outside this provider's home-visit coverage area/);
  });
  await t.test("no postcode is refused", async () => assert.equal((await checkCoverage(area, "")).ok, false));
  await t.test("no coverage area configured = nothing to enforce", async () => assert.deepEqual(await checkCoverage(null, "N1 9GU"), { ok: true }));
});
