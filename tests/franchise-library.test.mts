// Pure rules for a franchise's own Setup doc (server/src/lib/franchiseLibrary.ts): what is seeded, what follows head office, what head office locks.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  franchiseSettingsToStore, INHERITED_POLICY_KEYS, isKnownFeatureKey, lockedFeatureViolation, overridesOf, resolveFranchiseLibrary, SAFETY_FEATURES, seedFromHeadOffice,
} from "../server/src/lib/franchiseLibrary";

const HO = {
  categories: [{ id: "c" }], venues: [{ id: "v" }], staff: [{ name: "HO person" }], addons: [{ name: "Lunch", price: 5 }],
  settings: {
    features: { meals: true }, brandColor: "#111", providerName: "HQ", childcare: { reg: "EY1" },
    billing: { bankName: "B", accountName: "A", sortCode: "11-22-33", accountNumber: "12345678", businessName: "HQ Ltd", logoUrl: "https://x.test/l.png" },
    payrollAdmins: ["boss@hq.test"], roles: [{ id: "r" }], cancellationPolicies: [{ id: "p1" }], allowCardRefund: true,
  },
};

describe("seeding is an allow-list", () => {
  it("never copies bank details, payroll administrators, billing, roles, venues, add-ons or staff", () => {
    const text = JSON.stringify(seedFromHeadOffice(HO));
    for (const secret of ["11-22-33", "12345678", "boss@hq.test", "HQ Ltd", "HO person", "Lunch", "HQ Hall", "EY1"]) assert.ok(!text.includes(secret), secret);
    assert.ok(text.includes("#111") && text.includes("p1") && text.includes("l.png"));
  });
  it("an 'all franchises' default is applied and an OFF default is a lock", () => {
    const d = seedFromHeadOffice({ ...HO, franchiseFeatureDefaults: { meals: false, trips: true } });
    assert.deepEqual((d.settings as any).features, { meals: false, trips: true });
    assert.deepEqual(d.hoLocks, { meals: false });
  });
});

describe("policies follow head office until overridden", () => {
  const fr = { ...seedFromHeadOffice(HO), tenantId: "t" };
  it("an un-overridden policy is read from head office NOW", () => {
    const ho2 = { ...HO, settings: { ...HO.settings, cancellationPolicies: [{ id: "p2" }] } };
    assert.deepEqual((resolveFranchiseLibrary(fr, ho2).settings as any).cancellationPolicies, [{ id: "p2" }]);
  });
  it("an echoed-back policy does not freeze; an edit becomes an override", () => {
    const same = franchiseSettingsToStore({ ...(fr.settings as object), brandColor: "#222", cancellationPolicies: [{ id: "p1" }] }, fr, HO);
    assert.equal(same.overrides.cancellationPolicies, undefined);
    assert.equal("cancellationPolicies" in same.settings, false);
    const edited = franchiseSettingsToStore({ cancellationPolicies: [{ id: "mine" }] }, fr, HO);
    assert.equal(edited.overrides.cancellationPolicies, true);
    const ho2 = { ...HO, settings: { ...HO.settings, cancellationPolicies: [{ id: "p9" }] } };
    assert.deepEqual((resolveFranchiseLibrary({ settings: edited.settings, overrides: edited.overrides }, ho2).settings as any).cancellationPolicies, [{ id: "mine" }]);
  });
  it("a legacy full copy (no overrides map): a policy equal to head office's follows it, a different one is kept", () => {
    const legacy = { settings: { cancellationPolicies: [{ id: "old" }], allowCardRefund: true } };
    assert.deepEqual(overridesOf(legacy, HO.settings), { cancellationPolicies: true });
    assert.ok(INHERITED_POLICY_KEYS.includes("allowCardRefund"));
  });
});

describe("scrubbing a seeded copy", () => {
  it("removes head office's bank details and payroll administrators but keeps the franchise's own", () => {
    const legacy = { settings: { billing: { ...HO.settings.billing, businessName: "Own Ltd", sortCode: "99-99-99" }, payrollAdmins: HO.settings.payrollAdmins } };
    const s = resolveFranchiseLibrary(legacy, HO).settings as any;
    assert.equal(s.payrollAdmins, undefined);
    assert.equal(s.billing.accountNumber, undefined);
    assert.equal(s.billing.bankName, undefined);
    assert.equal(s.billing.sortCode, "99-99-99", "its own differing value stays");
    assert.equal(s.billing.businessName, "Own Ltd");
  });
});

describe("head office locks and safety features", () => {
  it("a locked-off switch cannot be turned back on, a missing key is forced off at read time", () => {
    assert.equal(lockedFeatureViolation({ meals: false }, { meals: true }), "meals");
    assert.equal(lockedFeatureViolation({ meals: false }, { meals: false }), null);
    assert.equal(lockedFeatureViolation({ meals: false }, { trips: true }), null);
    assert.equal(lockedFeatureViolation(undefined, { meals: true }), null);
    assert.equal(((resolveFranchiseLibrary({ settings: { features: { meals: true } }, hoLocks: { meals: false } }, HO).settings as any).features.meals), false);
  });
  it("registers, incidents and medication are safety features", () => {
    for (const k of ["registers", "admin-registers", "incidents", "medication"]) assert.ok(SAFETY_FEATURES.has(k), k);
    assert.equal(SAFETY_FEATURES.has("trips"), false);
  });
  it("feature keys are checked against the known list", () => {
    assert.equal(isKnownFeatureKey("meals", ["meals"], []), true);
    assert.equal(isKnownFeatureKey("marketing", [], ["marketing"]), true);
    assert.equal(isKnownFeatureKey("zzz", ["meals"], ["marketing"]), false);
  });
});
