/** Regression (8 Oct, coupon test A): code rule boundaries, preview == charge subtotal, locale coverage of every refusal. Pure. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { checkCode, type DiscountCodeDoc } from "../../server/src/lib/discountCodes";
import { apiErrorKey } from "../../lib/i18n/apiErrorKey";
import p8mod from "../../lib/i18n/messages/areas/p8api";
const p8api = ((p8mod as unknown as { default?: typeof p8mod }).default ?? p8mod) as typeof p8mod;

const base = (o: Partial<DiscountCodeDoc>): DiscountCodeDoc => ({ tenantId: "t", code: "X", type: "percent", value: 10, ...o });
const TODAY = "2026-10-08";

test("minSpend: exactly at the boundary passes, a penny under is refused", () => {
  const c = base({ minSpend: 9.99 });
  assert.equal(checkCode(c, 9.99, TODAY).ok, true);
  assert.equal(checkCode(c, 9.98, TODAY).ok, false);
  assert.equal(checkCode(c, 10, TODAY).ok, true);
});
test("expiry is inclusive of its last day, refused the day after", () => {
  assert.equal(checkCode(base({ expiry: TODAY }), 20, TODAY).ok, true);
  assert.equal(checkCode(base({ expiry: "2026-10-07" }), 20, TODAY).ok, false);
});
test("usage limit: last allowed use passes, one over is refused", () => {
  assert.equal(checkCode(base({ usageLimit: 3, usedCount: 2 }), 20, TODAY).ok, true);
  assert.equal(checkCode(base({ usageLimit: 3, usedCount: 3 }), 20, TODAY).ok, false);
});
test("awkward prices round to the penny and never exceed the subtotal", () => {
  assert.deepEqual(checkCode(base({ value: 33.33 }), 9.99, TODAY), { ok: true, off: 3.33 });
  assert.deepEqual(checkCode(base({ type: "perAttendee", value: 5 }), 0.3, TODAY, { attendees: 3 }), { ok: true, off: 0.3 });
  assert.deepEqual(checkCode(base({ type: "amount", value: 50 }), 9.99, TODAY), { ok: true, off: 9.99 });
  assert.equal(checkCode(base({ value: 1 }), 0.3, TODAY).ok, false); // under half a penny: no discount, not a £0.00 "success"
});
test("reserved codes match the family email case- and space-insensitively", () => {
  const c = base({ assignedTo: "kid@x.com" });
  assert.equal(checkCode(c, 20, TODAY, { email: "  KID@x.com " }).ok, true);
  assert.equal(checkCode(c, 20, TODAY, { email: "other@x.com" }).ok, false);
  assert.equal(checkCode(c, 20, TODAY).ok, false);
});
test("a franchise's code does not work on a sibling's or head office's listing", () => {
  const c = base({ franchiseId: "f1" });
  assert.equal(checkCode(c, 20, TODAY, { listingFranchiseId: "f1" }).ok, true);
  assert.equal(checkCode(c, 20, TODAY, { listingFranchiseId: "f2" }).ok, false);
  assert.equal(checkCode(c, 20, TODAY, { listingFranchiseId: null }).ok, false);
});

test("the storefront booking panel previews a code against the PASS subtotal (no add-ons), like the server charges", () => {
  const src = fs.readFileSync("features/storefront/BookingPanel.tsx", "utf8");
  assert.match(src, /subtotal: preview\.passTotal/);
  assert.doesNotMatch(src, /subtotal: preview\.total/);
});
test("a code reserved by email is stored lower-case so the family's Coupons list (assignedTo == lower-case) finds it", () => {
  const src = fs.readFileSync("server/src/routes/discounts.ts", "utf8");
  assert.match(src, /assignedTo: z\.string\(\)\.trim\(\)\.email\(\)\.max\(160\)\.transform\(\(e\) => e\.toLowerCase\(\)\)/);
});
test("every code refusal the API can show is translated into all 11 languages, and the clients translate validate's reason", () => {
  const reasons = [
    "This code is no longer active", "This code is reserved for another customer", "This code doesn’t apply to this activity", "This code has expired",
    "This code has reached its usage limit", "Spend at least £{v1} to use this code", "This code gives no discount on this order", "That code isn’t recognised",
    "You’ve already used this code", "This code is for new customers only", "Code {v1} is no longer available — remove it to book without it",
    "Code {v1} has just been used up — remove it to book without it", "You can’t use your own referral link", "You already have a code with that name",
  ];
  for (const loc of Object.keys(p8api) as (keyof typeof p8api)[])
    for (const r of reasons) assert.ok(p8api[loc][apiErrorKey(r)]?.trim(), `${loc} missing: ${r}`);
  for (const f of ["features/listings/checkout.tsx", "features/storefront/BookingPanel.tsx"])
    assert.match(fs.readFileSync(f, "utf8"), /translateApiMessage\(r\.reason\)/, f);
  const code = fs.readFileSync("server/src/lib/discountCodes.ts", "utf8");
  for (const r of reasons.slice(0, 5)) assert.ok(code.includes(r), r);
});
