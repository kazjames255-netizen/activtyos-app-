// Pure tests for the HQ Providers list helpers (lib/providerFilters.ts). Run: tsx --test tests/provider-filters.test.mts
import test from "node:test";
import assert from "node:assert/strict";
import { classify, isTestAccount, matchesSearch, tiles, trialDaysLeft, sortProviders, type ProviderLike } from "../lib/providerFilters.ts";

const base = (o: Partial<ProviderLike>): ProviderLike => ({ id: "t1", name: "Acme", status: "active", hasCard: true, price: 15, ...o });
// 10 Oct 2026 12:00 UK (BST, UTC+1).
const NOW = new Date("2026-10-10T11:00:00Z");
const tabs = (o: Partial<ProviderLike>) => [...classify(base(o), NOW)].sort();

test("trial started, with and without card", () => {
  assert.deepEqual(tabs({ status: "trialing", trialEndsAt: "2026-10-20T10:00:00Z" }), ["all", "trial"]);
  assert.deepEqual(tabs({ status: "trialing", trialEndsAt: "2026-10-20T10:00:00Z", hasCard: false }), ["all", "noCard", "trial"]);
});
test("ending soon: exactly 7 days is in, 8 days is out", () => {
  assert.ok(classify(base({ status: "trialing", trialEndsAt: "2026-10-17T20:00:00Z" }), NOW).has("endingSoon"));
  assert.ok(!classify(base({ status: "trialing", trialEndsAt: "2026-10-18T09:00:00Z" }), NOW).has("endingSoon"));
});
test("0 days: ends later today is still on trial and ending soon; just passed is ended", () => {
  const later = classify(base({ status: "trialing", trialEndsAt: "2026-10-10T20:00:00Z" }), NOW);
  assert.ok(later.has("trial") && later.has("endingSoon") && !later.has("trialEnded"));
  const gone = classify(base({ status: "trialing", trialEndsAt: "2026-10-10T10:59:00Z" }), NOW);
  assert.ok(gone.has("trialEnded") && !gone.has("trial") && !gone.has("endingSoon"));
});
test("UK timezone: 23:30 UTC on 16 Oct is 00:30 UK on 17 Oct, which is 7 days away", () => {
  assert.equal(trialDaysLeft("2026-10-16T23:30:00Z", NOW), 7);
  assert.equal(trialDaysLeft("2026-10-17T23:30:00Z", NOW), 8);
  // Winter (GMT): same instant-of-day maths.
  assert.equal(trialDaysLeft("2026-12-01T23:30:00Z", new Date("2026-12-01T00:10:00Z")), 0);
  assert.equal(trialDaysLeft(null, NOW), null);
});
test("active, past due, cancelled, cancelling", () => {
  assert.deepEqual(tabs({ status: "active" }), ["active", "all"]);
  assert.deepEqual(tabs({ status: "past_due" }), ["all", "pastDue"]);
  assert.deepEqual(tabs({ status: "canceled" }), ["all", "cancelled"]);
  assert.deepEqual(tabs({ status: "canceling" }), ["all", "cancelled"]);
  assert.deepEqual(tabs({ status: "none" }), ["all"]);
});
test("test-account matcher", () => {
  assert.ok(isTestAccount({ name: "X", ownerEmail: "a@ActivityOS-Test.com" }));
  assert.ok(isTestAccount({ name: "X", ownerEmail: null, contactEmail: "b@activityos-test.com" }));
  assert.ok(isTestAccount({ name: "QA Coupon B Co", ownerEmail: "real@x.com" }));
  assert.ok(!isTestAccount({ name: "QAtar Sports", ownerEmail: "real@x.com" }));
  assert.ok(!isTestAccount({ name: "Acme", ownerEmail: "a@activityos-test.com.au" }));
});
test("search by name, email, tenant id", () => {
  const p = { id: "tn_9Zx", name: "Little Kickers", ownerEmail: "Sam@kick.co.uk", contactEmail: null };
  assert.ok(matchesSearch(p, "kicker") && matchesSearch(p, "SAM@KICK") && matchesSearch(p, "9zx") && matchesSearch(p, " "));
  assert.ok(!matchesSearch(p, "nope"));
});
test("tile maths: only billable statuses add to MRR; counts recalc from the set", () => {
  const rows = [
    { status: "active", price: 20 }, { status: "trialing", price: 15 }, { status: "canceling", price: 10 },
    { status: "canceled", price: 99 }, { status: "past_due", price: 5 }, { status: "none", price: null },
  ];
  assert.deepEqual(tiles(rows), { total: 6, mrr: 45, trialing: 1, active: 1 });
  assert.deepEqual(tiles([]), { total: 0, mrr: 0, trialing: 0, active: 0 });
});
test("sorting", () => {
  const rows = [
    base({ id: "a", name: "b", createdAt: "2026-01-01", status: "trialing", trialEndsAt: "2026-10-20T10:00:00Z", price: 5 }),
    base({ id: "b", name: "A", createdAt: "2026-03-01", status: "trialing", trialEndsAt: "2026-10-12T10:00:00Z", price: 30 }),
    base({ id: "c", name: "c", createdAt: "2026-02-01", status: "active", price: 15 }),
  ];
  const ids = (k: Parameters<typeof sortProviders>[1]) => sortProviders(rows, k, NOW).map((r) => r.id).join("");
  assert.equal(ids("newest"), "bca");
  assert.equal(ids("name"), "bac");
  assert.equal(ids("value"), "bca");
  assert.equal(ids("trialEnding"), "bac");
});
