import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addonCost } from "../../features/listings/addonCost";

test("both Quick book screens run the SAME checkout widget, and the provider modal forwards the picked extras to POST /api/my/bookings", () => {
  const modal = readFileSync("features/bookings/TakeBookingModal.tsx", "utf8");
  assert.match(modal, /BookingOnly/);
  assert.match(modal, /addons/);
  assert.match(modal, /\/api\/my\/bookings/);
  assert.match(modal, /onBehalfOf/);
  assert.match(readFileSync("features/parent/QuickBookModal.tsx", "utf8"), /CustomerPage listing=\{listing\} bookingOnly/);
  assert.match(readFileSync("features/storefront/BookPage.tsx", "utf8"), /CustomerPage listing=\{listing\} bookingOnly/);
});

// The checkout's per-extra breakdown (Take booking / Quick book / parent checkout): an extra nobody picked costs nothing.
const tshirt = { type: "once", price: 8 }, bottle = { type: "perday", price: 3 };

test("a one-off extra not picked for the child costs 0 (it used to read its full price)", () => {
  assert.equal(addonCost(tshirt, []), 0);
});
test("a one-off extra picked costs its price once, whatever the days array holds", () => {
  assert.equal(addonCost(tshirt, ["2026-10-19"]), 8);
  assert.equal(addonCost(tshirt, ["2026-10-19", "2026-10-20"]), 8);
});
test("a per-day extra costs price x days picked, 0 when none", () => {
  assert.equal(addonCost(bottle, []), 0);
  assert.equal(addonCost(bottle, ["2026-10-19", "2026-10-20"]), 6);
});
