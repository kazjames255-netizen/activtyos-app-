/** Provider-journey fixes: wizard prerequisites + draft hygiene, billing gate, franchise terms. Pure, no network. */
import test from "node:test";
import assert from "node:assert/strict";
import { BRAND } from "../server/src/lib/brand";
import { listingPrereqs, allPrereqsMet, titleMissing, mayCreateOnServer, isAbandonedDraft, newBlockId, bookingLink } from "../features/listings/prereqs";
import { gateMode } from "../lib/billingGate";
import { tierParts, franchiseFeeFor, parseRoyaltyPct, settingsOwner } from "../lib/franchiseTerms";
import { franchiseCostParagraph, tierText, royaltyText } from "../server/src/lib/franchiseTerms";

test("prereqs: new account has nothing ticked; venue + priced block tick it", () => {
  const none = listingPrereqs({ venueCount: 0, deliveryMode: "venue", blocks: [] });
  assert.deepEqual(none.map((p) => p.ok), [false, false]);
  const unpriced = listingPrereqs({ venueCount: 1, blocks: [{ passCount: 2, priced: false }] });
  assert.equal(unpriced[0].ok, true);
  assert.equal(unpriced[1].ok, false);
  assert.equal(allPrereqsMet(listingPrereqs({ venueCount: 1, blocks: [{ passCount: 2, priced: true }] })), true);
  assert.equal(listingPrereqs({ venueCount: 0, deliveryMode: "home-visit", blocks: [] })[0].ok, true);
  assert.equal(listingPrereqs({ venueCount: 0, blocks: [{ passCount: 0, priced: true }] })[1].ok, false);
});
test("draft hygiene: no name, no server draft; abandoned empty drafts are cleaned", () => {
  assert.equal(titleMissing("   "), true);
  assert.equal(titleMissing("Football"), false);
  assert.equal(mayCreateOnServer({ id: null, title: "" }), false);
  assert.equal(mayCreateOnServer({ id: null, title: "Football" }), true);
  assert.equal(mayCreateOnServer({ id: "abc", title: "" }), true);
  assert.equal(isAbandonedDraft({ id: "abc", title: " ", status: "draft" }), true);
  assert.equal(isAbandonedDraft({ id: "abc", title: " ", status: "live" }), false);
  assert.equal(isAbandonedDraft({ id: null, title: "", status: "draft" }), false);
});
test("newBlockId finds the block just created; link builder", () => {
  assert.equal(newBlockId(["a"], ["a", "b"]), "b");
  assert.equal(newBlockId(["a"], ["a"]), null);
  assert.equal(bookingLink("https://x.test", "L1"), "https://x.test/book/L1");
});
test("billing gate fails closed in production only", () => {
  assert.equal(gateMode(true, "production"), "card");
  assert.equal(gateMode(false, "production"), "closed");
  assert.equal(gateMode(undefined, "production"), "closed");
  assert.equal(gateMode(false, "development"), "dummy");
  assert.equal(gateMode(false, undefined), "dummy");
});
const tiers = [{ upTo: 5, price: 39 }, { upTo: 15, price: 31 }, { upTo: null, price: 25 }];
test("franchise tiers + fee", () => {
  assert.deepEqual(tierParts(tiers), [{ kind: "first", price: 39, n: 5 }, { kind: "next", price: 31, n: 10 }, { kind: "then", price: 25 }]);
  assert.equal(franchiseFeeFor(3, tiers), 117);
  assert.equal(franchiseFeeFor(7, tiers), 5 * 39 + 2 * 31);
  assert.equal(franchiseFeeFor(20, tiers), 5 * 39 + 10 * 31 + 5 * 25);
  assert.equal(parseRoyaltyPct("10"), 10);
  assert.equal(parseRoyaltyPct("7.555"), 7.56);
  assert.equal(parseRoyaltyPct(""), null);
  assert.equal(parseRoyaltyPct("101"), null);
  assert.equal(settingsOwner("refer"), "headOffice");
  assert.equal(settingsOwner("company"), "yours");
});
test("invite email text states base, tiers, royalty and that the franchisee pays nothing", () => {
  assert.equal(tierText(tiers), "£39 each for the first 5, £31 each for the next 10, then £25 each");
  assert.equal(royaltyText(null), "10% of revenue");
  assert.equal(royaltyText({ basis: "perBooking", perBookingFee: 2 }), "£2 per booking");
  const t = franchiseCostParagraph({ price: 99, franchiseTiers: tiers }, { basis: "revenue", rate: 12 });
  assert.match(t, /£99\/month/);
  assert.match(t, /£39 each for the first 5/);
  assert.match(t, new RegExp(`pay nothing to ${BRAND}`));
  assert.match(t, /12% of revenue/);
});
