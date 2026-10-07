import test from "node:test";
import assert from "node:assert/strict";
import { providerPaidBell } from "../../server/src/lib/providerPaidBell";
import { cancelBell } from "../../server/src/lib/emailTemplates";

// The provider's bell said "awaiting card payment" at checkout and nothing said it was paid: this is the follow-up line.
test("provider paid bell: ref, booker, amount, and 'booking confirmed' for an instant-confirm booking", () => {
  const b = { ref: "APF-10330", listing: "HOME VISIT FITNESS LESSON", booker: "Kaz", amount: 0.3, child: "sally james", kids: undefined };
  const m = providerPaidBell([b], true);
  // The bell is short: label + ref, then TYPE · COST (· Confirmed). The long wording is the email's `detail`.
  assert.equal(m.title, "Paid ✓ · APF-10330");
  assert.equal(m.body, "Card · £0.30 · Confirmed");
  assert.equal(providerPaidBell([b], false).body, "Card · £0.30");
  assert.match(m.detail, /APF-10330 · Kaz · HOME VISIT FITNESS LESSON · sally james — £0\.30 received by card, booking confirmed\./);
});

test("provider paid bell: a basket of two children names both and sums the money", () => {
  const rows = [
    { ref: "APF-1", listing: "Camp", booker: "Kaz", amount: 0.3, child: "A", kids: undefined },
    { ref: "APF-2", listing: "Camp", booker: "Kaz", amount: 0.3, child: "B", kids: undefined },
  ];
  const m = providerPaidBell(rows, false);
  assert.equal(m.title, "Paid ✓ · APF-1 +1");
  assert.equal(m.body, "Card · £0.60");
  assert.match(m.detail, /A, B — £0\.60 received by card/);
});

test("parent cancel bell: explicit title with the ref, who cancelled and the money", () => {
  const m = cancelBell({ ref: "APF-10330", listing: "HOME VISIT" }, "APF Activity Camps", "provider", "sally james", "Tue 24 Aug", "£0.30 refund pending");
  assert.equal(m.title, "Booking cancelled · APF-10330");
  assert.equal(m.body, "HOME VISIT · sally james · Tue 24 Aug — APF Activity Camps cancelled this booking. £0.30 refund pending.");
  assert.match(cancelBell({ ref: "R", listing: "L" }, "P", "family", "", "", "nothing owed").body, /^L — You cancelled this booking\. Nothing owed\.$/);
});
