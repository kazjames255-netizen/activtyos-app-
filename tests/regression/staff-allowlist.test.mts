import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { STAFF_BOOKING_SHOWN, STAFF_BOOKING_HIDDEN, staffBookingView } from "../../server/src/lib/rosterRules";
import { familyBooking } from "../../server/src/lib/familyView";

// A STAFF token sees a booking through an ALLOW-LIST: a field nobody has decided about is hidden. A discount code used to leak listPrice (pass + extras
// before the discount), discountOff and discountNames, from which the add-on money could be worked out.
const root = path.resolve(import.meta.dirname, "../..");

test("every Booking field is decided: shown to staff or hidden from staff (a new field fails here until someone decides)", () => {
  const sf = ts.createSourceFile("t.ts", fs.readFileSync(path.join(root, "features/bookings/types.ts"), "utf8"), ts.ScriptTarget.Latest, true);
  let keys: string[] = [];
  sf.forEachChild((n) => { if (ts.isInterfaceDeclaration(n) && n.name.text === "Booking") keys = n.members.map((m) => m.name?.getText(sf) ?? "").filter(Boolean); });
  assert.ok(keys.length > 60);
  const shown = new Set<string>(STAFF_BOOKING_SHOWN), hidden = new Set<string>(STAFF_BOOKING_HIDDEN);
  const undecided = keys.filter((k) => !shown.has(k) && !hidden.has(k));
  assert.deepEqual(undecided, [], "decide these Booking fields in server/src/lib/rosterRules.ts");
  assert.deepEqual([...shown].filter((k) => hidden.has(k)), []);
  for (const money of ["amount", "amountPaid", "pay", "method", "listPrice", "discountOff", "discountNames", "discountCode", "priceOverride", "walletApplied", "refundLog", "refundEntries", "mealItems", "amendFeesCharged", "cardPaid", "payRefs"])
    assert.ok(hidden.has(money) && !shown.has(money), money);
});

const full = {
  ref: "EMU-1", bid: "1", booker: "Parent A", email: "a@x.com", phone: "07", child: "Kid", listing: "Camp", pass: "7 days", ticket: "7 days", dates: "x", sessions: ["Sun 18 Oct 2026 · 09:00 – 15:00"],
  status: "Confirmed", days: ["2026-10-18"], answers: [["Allergies", "none"]], note: "1 day released — booking reduced by £52.00.", addons: ["T-shirt × 1 — £8.00"],
  kids: [{ name: "Kid", dates: ["2026-10-18"], price: 12, refundedAmount: 3 }],
  addonLines: [{ child: "Kid", label: "T-shirt × 1", price: 8, days: ["2026-10-18"], perDay: false, refunded: true }],
  addonRequests: [{ id: "r1", kind: "cancel", label: "T-shirt", price: 8, status: "pending", money: { amount: 8 } }],
  cancel: { on: "x", by: "Provider", refund: "pending", amount: 30, refundCash: 30, refundOnly: true, msg: "Cancelled by provider." },
  dateChangeRequest: { moves: [], status: "approved", feeCharged: 5 },
  amount: 169, amountPaid: 40, pay: "Partially paid", method: "Bank transfer", listPrice: 169, discountOff: 20, discountNames: ["Sibling"], discountCode: "SIB10", walletApplied: 5,
  priceOverride: { originalAmount: 1, amount: 2, by: "x", reason: "y", at: "z" }, refundLog: [{ label: "x", amount: 1, on: "x", by: "x" }], refundEntries: [], mealItems: [{ date: "x", name: "y", price: 3 }],
  amendFeesCharged: 5, earlyBirdScope: "x", cardHold: { state: "held" }, paymentIntentId: "pi_1", futureField: { price: 9 },
} as Record<string, unknown>;

test("the staff view keeps only allow-listed fields: no price, discount, payment or unknown field survives", () => {
  const out = staffBookingView(full) as Record<string, unknown>;
  const shown = new Set<string>(STAFF_BOOKING_SHOWN);
  for (const k of Object.keys(out)) assert.ok(shown.has(k), `${k} should not reach staff`);
  for (const k of ["listPrice", "discountOff", "discountNames", "discountCode", "amount", "amountPaid", "pay", "method", "walletApplied", "priceOverride", "refundLog", "mealItems", "amendFeesCharged", "earlyBirdScope", "cardHold", "paymentIntentId", "futureField"])
    assert.equal(k in out, false, k);
  const deepKeys = (v: unknown, acc: string[] = []): string[] => { if (Array.isArray(v)) v.forEach((x) => deepKeys(x, acc)); else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { acc.push(k); deepKeys(x, acc); } return acc; };
  const bad = deepKeys(out).filter((k) => /price|amount|money|paid|refund|cost|fee|diff|wallet|discount/i.test(k));
  assert.deepEqual(bad, []);
  assert.doesNotMatch(JSON.stringify(out), /£/);
});
test("what staff need is still there: names, contacts, days, sessions, status, the extras' names and choices, the child's days", () => {
  const out = staffBookingView(full) as Record<string, any>;
  assert.equal(out.booker, "Parent A"); assert.equal(out.status, "Confirmed"); assert.deepEqual(out.days, ["2026-10-18"]); assert.equal(out.sessions.length, 1);
  assert.equal(out.addons[0], "T-shirt × 1"); assert.equal(out.addonLines[0].label, "T-shirt × 1"); assert.deepEqual(out.kids[0].dates, ["2026-10-18"]); assert.equal(out.kids[0].name, "Kid");
  assert.equal(out.cancel.by, "Provider"); assert.equal(out.cancel.refund === undefined, true, "the refund state is money");
  assert.equal(out.note, "1 day released — booking reduced");
});
test("both staff booking routes (list and one booking) go through the allow-list", () => {
  const src = fs.readFileSync(path.join(root, "server/src/routes/bookings.ts"), "utf8");
  assert.match(src, /function staffView[^]*?staffBookingView\(b\)/);
  assert.ok((src.match(/staffView\(/g) ?? []).length >= 3, "list + single + definition");
  assert.doesNotMatch(src, /const MONEY_KEYS = \[/, "the old deny-list is gone");
});

// ---- Families: refund amounts and status yes, internal cash split / approver data no ---------------------------------------------------------
test("a family's booking carries no cash split, approver or wallet-refund bookkeeping, but still the amounts and states its screens show", () => {
  const b = {
    ref: "R", amount: 100, pay: "Partially refunded", refundedApproved: 20, walletRefunded: 5, refundEntries: [{ id: "e", amount: 20, cash: 15, via: "offline", status: "approved" }],
    refundLog: [{ label: "Refund approved", amount: 20, on: "x", by: "Provider" }], reconNotes: [{ at: "x", text: "y" }], reconciledBy: { at: "x", by: "p" }, stripeAccount: "acct_1",
    lastRefundSent: { amount: 15, at: "x" },
    cancel: { on: "x", by: "Provider", refund: "approved", amount: 20, refundCash: 15, refundVia: "offline", refundTransfer: "awaiting", refundSentBy: "p@x.com", refundRecordedAt: "x", refundSentAt: "y", msg: "m" },
  } as never;
  const out = familyBooking(b) as Record<string, any>;
  for (const k of ["refundEntries", "walletRefunded", "reconNotes", "reconciledBy", "stripeAccount"]) assert.equal(k in out, false, k);
  for (const k of ["refundCash", "refundSentBy", "refundRecordedAt"]) assert.equal(k in out.cancel, false, `cancel.${k}`);
  assert.equal(out.cancel.amount, 20); assert.equal(out.cancel.refund, "approved"); assert.equal(out.cancel.refundVia, "offline"); assert.equal(out.amount, 100); assert.equal(out.refundLog[0].amount, 20);
  assert.equal(out.refundAwaiting, true);
});
test("the data export gives a family the same view of its bookings", () => {
  const src = fs.readFileSync(path.join(root, "server/src/routes/privacy.ts"), "utf8");
  assert.match(src, /familyBooking/);
});
