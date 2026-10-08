import test from "node:test";
import assert from "node:assert/strict";
import { cancelledBannerKey } from "../../features/bookings/helpers";
import messages from "../../lib/i18n/messages/areas/p7bd";

// FAIL 2 (verify-integration-screens): after the provider cancelled a child/extras with a refund and then pressed 'Decline refund', the booking page
// banner said 'Cancelled by the family. Nothing for you to do.' while the section below said 'by Provider'.
const base = { status: "Cancelled" } as const;

test("banner: a family cancellation keeps the family wording", () => {
  assert.equal(cancelledBannerKey({ ...base, cancel: { by: "Booker", refund: "none" } }), "p7bd.cancelledNothingToDo");
  assert.equal(cancelledBannerKey({ ...base, cancel: { by: "Booker", refund: "declined" } }), "p7bd.cancelledNothingToDo");
});
test("banner: a provider cancellation with the refund declined says the provider cancelled", () => {
  assert.equal(cancelledBannerKey({ ...base, cancel: { by: "Provider", refund: "declined", refundOnly: true } }), "p7bd.cancelledByProviderNothingToDo");
});
test("banner: nothing to say while a refund is still waiting on the provider", () => {
  for (const refund of ["pending", "full", "partial"]) assert.equal(cancelledBannerKey({ ...base, cancel: { by: "Provider", refund } }), null, refund);
  assert.equal(cancelledBannerKey({ ...base, cancel: { by: "Provider", refund: "approved", refundVia: "offline", refundTransfer: "awaiting" } }), null);
});
test("banner: only for cancelled bookings", () => {
  assert.equal(cancelledBannerKey({ status: "Confirmed", cancel: { by: "Provider", refund: "declined" } }), null);
});
test("the new wording exists in all 11 languages", () => {
  const m0 = messages as unknown as { default?: unknown };
  const cat = (m0.default ?? messages) as Record<string, Record<string, string>>;
  assert.equal(Object.keys(cat).length, 11);
  for (const [lang, m] of Object.entries(cat)) assert.ok(m.cancelledByProviderNothingToDo && m.cancelledByProviderNothingToDo.length > 5, lang);
});
