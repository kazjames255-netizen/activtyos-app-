/** Regression (6 Oct): directory, account, billing, go-live gate, bank details, onboarding. Pure. */
import test from "node:test";
import assert from "node:assert/strict";
import { maskEmail, publicFullAddress, displayNameFallback, stripeMode } from "../../server/src/lib/directoryRules";
import { decide, STAGES } from "../../server/src/lib/onboardingRules";
import { bankDetailsValid, payStepDone, bankSaved, goLiveFacts, goLiveRefusalFrom, gateAppliesOnPublish } from "../../lib/billingRules";
import { collectionOk, kidInitials, duplicateBody } from "../../lib/uiRules";

test("provider search masks the email", () => {
  assert.equal(maskEmail("sam.taylor@Riverside.co.uk"), "sa***@riverside.co.uk");
  assert.equal(maskEmail("a@b.co"), "a***@b.co");
  assert.ok(!maskEmail("sam.taylor@riverside.co.uk")!.includes("taylor"));
});
test("masking junk gives nothing rather than leaking", () => {
  assert.equal(maskEmail(""), undefined);
  assert.equal(maskEmail(undefined), undefined);
  assert.equal(maskEmail("not an email"), undefined);
});
test("full address is shown only on opt-in", () => {
  assert.equal(publicFullAddress({ address: "1 High St\nMK1", showAddressPublicly: true }), "1 High St MK1");
  assert.equal(publicFullAddress({ address: "1 High St" }), undefined);
  assert.equal(publicFullAddress({ address: "1 High St", showAddressPublicly: false }), undefined);
  assert.equal(publicFullAddress(undefined), undefined);
  assert.equal(publicFullAddress({ address: "  ", showAddressPublicly: true }), undefined);
});
test("account name falls back to trading name, business name, then tenant name", () => {
  assert.equal(displayNameFallback({ providerName: "APF", billing: { businessName: "B" } }, "T"), "APF");
  assert.equal(displayNameFallback({ billing: { businessName: "B" } }, "T"), "B");
  assert.equal(displayNameFallback({}, " T "), "T");
  assert.equal(displayNameFallback(undefined, undefined), "");
});
test("subscription product id is kept per Stripe mode", () => {
  assert.equal(stripeMode("sk_live_abc"), "live");
  assert.equal(stripeMode("sk_test_abc"), "test");
  assert.equal(stripeMode(undefined), "test");
});

test("bank details need at least 6 digits each", () => {
  assert.equal(bankDetailsValid("12-34-56", "12345678"), true);
  assert.equal(bankDetailsValid("12-34-5", "12345678"), false);
  assert.equal(bankDetailsValid("12-34-56", "12345"), false);
  assert.equal(bankDetailsValid("", ""), false);
  assert.equal(bankDetailsValid("ab-cd-ef", "abcdefgh"), false);
});
test("first-run pay step requires bank details (Stripe alone does not count)", () => {
  assert.equal(payStepDone({}), false);
  assert.equal(payStepDone(undefined), false);
  assert.equal(payStepDone({ accountNumber: "12345678" }), true);
  assert.equal(bankSaved({ sortCode: "12-34-56" }), false);
  assert.equal(bankSaved({ sortCode: "12-34-56", accountNumber: "12345678" }), true);
});

test("go-live gate: bank details required for a tenant on the plan flow", () => {
  const f = goLiveFacts({ status: "trialing" }, {}, false);
  assert.match(goLiveRefusalFrom(f)!, /bank details/);
  assert.equal(goLiveRefusalFrom(goLiveFacts({ status: "trialing" }, { sortCode: "1", accountNumber: "2" }, false)), null);
});
test("go-live gate: legacy tenants (no subscription status) are exempt", () => {
  assert.equal(goLiveRefusalFrom(goLiveFacts(undefined, {}, false)), null);
  assert.equal(goLiveRefusalFrom(goLiveFacts({}, {}, false)), null);
});
test("go-live gate: plan 'none' must start the trial first", () => {
  assert.match(goLiveRefusalFrom(goLiveFacts({ status: "none" }, { sortCode: "1", accountNumber: "2" }, false))!, /free trial/);
});
test("go-live gate applies only when moving to live, not when editing a live listing", () => {
  assert.equal(gateAppliesOnPublish("draft", true), true);
  assert.equal(gateAppliesOnPublish(undefined, true), true);
  assert.equal(gateAppliesOnPublish("live", true), false);
  assert.equal(gateAppliesOnPublish("draft", false), false);
});

const f = (o = {}) => ({ hasListing: false, hasLiveListing: false, planStarted: false, payChosen: false, ...o });
test("nudge: live listing ends the series at every stage", () => {
  for (const s of STAGES) assert.equal(decide(s, f({ hasListing: true, hasLiveListing: true })).send, false);
});
test("nudge: day 1 only asks for a first listing", () => {
  assert.equal(decide("d1", f()).send, true);
  assert.equal(decide("d1", f({ hasListing: true })).send, false);
});
test("nudge: day 3 skips steps already done and stays quiet when nothing is open", () => {
  const r = decide("d3", f({ hasListing: true, planStarted: true, payChosen: false }));
  assert.deepEqual(r.open, { listing: false, plan: false, pay: true });
  assert.equal(r.send, true);
  assert.equal(decide("d3", f({ hasListing: true, planStarted: true, payChosen: true })).send, false);
});
test("nudge: day 5 always says what is left when not live", () => {
  const r = decide("d5", f({ hasListing: true, planStarted: true, payChosen: true }));
  assert.equal(r.send, true);
  assert.deepEqual(r.open, { listing: false, plan: false, pay: false });
});

test("collection password is required unless the check is off", () => {
  assert.equal(collectionOk("on", ""), false);
  assert.equal(collectionOk(undefined, "  "), false);
  assert.equal(collectionOk("on", "pw"), true);
  assert.equal(collectionOk("off", ""), true);
});
test("4+ children show two initials and +N", () => {
  assert.equal(kidInitials(["Amy", "Ben", "Cal"]), "A & B & C");
  assert.equal(kidInitials(["Amy", "Ben", "Cal", "Dan"]), "A & B +2");
  assert.equal(kidInitials(["a", "b", "c", "d", "e"]), "A & B +3");
  assert.equal(kidInitials([]), "?");
});
test("duplicate of a legacy listing copies all fields, drops ids and server fields, comes back a draft", () => {
  const l = { id: "L1", tenantId: "t", name: "Camp", capacity: 20, venueId: "v", addons: [{ id: "a" }], ageFrom: "4", passes: [{ name: "Day" }], status: "live", createdAt: "x" };
  const b = duplicateBody(l, null, "Camp (copy)");
  assert.equal(b.name, "Camp (copy)");
  assert.equal(b.capacity, 20);
  assert.equal(b.venueId, "v");
  assert.deepEqual(b.addons, [{ id: "a" }]);
  assert.equal(b.ageFrom, "4");
  assert.equal(b.status, "draft");
  for (const k of ["id", "tenantId", "createdAt"]) assert.equal(k in b, false);
});
test("duplicate with a saved draft copies that draft as a fresh unpublished copy", () => {
  const b = duplicateBody({ passes: [1] }, { title: "T", x: 1, id: "old" }, "C2");
  assert.equal(b.x, 1);
  assert.equal(b.title, "C2");
  assert.equal(b.status, "draft");
  assert.equal(b.id, undefined);
});
