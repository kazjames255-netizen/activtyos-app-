/**
 * Listing wizard + publishing rules (pure: no network, no Firestore).
 *
 * Run:   npm run test:listings
 *        (= server/node_modules/.bin/tsx --test tests/listings.test.mts)
 *
 * Covers: server/src/lib/listingRules.ts (zod schema + publishProblems, moved verbatim out of routes/listings.ts),
 *         server/src/lib/listingRunsPure.ts (desiredRuns), listingVisibility.ts, coverageArea.ts (postcode mode),
 *         bookingCutoff.ts, bundlePricing.ts (resolveBundlePricing),
 *         features/listings/discounts.ts, capacity.ts.
 * Catalogue refs: LT-001..LT-035 (publish, visibility, delivery mode, coverage, capacity scope, age range,
 *         waitlist, booking style, cancellation policy, discounts, cut-off, ticket overrides).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { baseListingSchema, createSchema, publishProblems } from "../server/src/lib/listingRules";
import { desiredRuns } from "../server/src/lib/listingRunsPure";
import { isBrowsable, directLinkVisible } from "../server/src/lib/listingVisibility";
import { checkCoverage, normalisePostcode } from "../server/src/lib/coverageArea";
import { bookingCutoffLabel, cutoffHours, pastCutoff } from "../server/src/lib/bookingCutoff";
import { resolveBundlePricing, type BundleDoc, type PassDoc, type PeriodDoc } from "../server/src/lib/bundlePricing";
import { applyDiscounts, emptyRule, ruleSummary, type DiscountRule } from "../features/listings/discounts";
import { lowAt } from "../features/listings/capacity";

// A listing that satisfies every publish requirement (venue mode).
const ready = (over: Record<string, unknown> = {}) => ({
  title: "Standard test camp", venueId: "v1", runFrom: "2026-11-02", runTo: "2026-11-20",
  blockId: "b1", passes: [{ name: "1 day", price: 20 }], ...over,
});

// ── Publish validation ────────────────────────────────────────────────────
test("LT-001 a complete listing has no publish problems", () => {
  assert.deepEqual(publishProblems(ready()), []);
});
test("publish needs a name (title or name, not blank)", () => {
  assert.deepEqual(publishProblems(ready({ title: "   " })), ["a name"]);
  assert.deepEqual(publishProblems(ready({ title: undefined, name: "Via name" })), []);
  assert.ok(publishProblems(ready({ title: undefined })).includes("a name"));
});
test("publish needs a venue in venue mode (default) but not for home-visit", () => {
  assert.deepEqual(publishProblems(ready({ venueId: null })), ["a venue"]);
  assert.deepEqual(publishProblems(ready({ venueId: undefined, deliveryMode: "venue" })), ["a venue"]);
  assert.deepEqual(publishProblems(ready({ venueId: null, deliveryMode: "home-visit", coverageArea: { mode: "postcodePrefixes", postcodePrefixes: ["SW1"] } })), []);
});
test("publish needs dates with at least one running day", () => {
  assert.deepEqual(publishProblems(ready({ runFrom: undefined, runTo: undefined })), ["dates with at least one running day"]);
  assert.deepEqual(publishProblems(ready({ runTo: undefined })), ["dates with at least one running day"]);
  // A range that only spans a weekend with the default Mon-Fri days is empty.
  assert.deepEqual(publishProblems(ready({ runFrom: "2026-11-07", runTo: "2026-11-08" })), ["dates with at least one running day"]);
  // ...but fine when weekend days are ticked.
  assert.deepEqual(publishProblems(ready({ runFrom: "2026-11-07", runTo: "2026-11-08", days: [0, 6] })), []);
  // End before start yields nothing.
  assert.ok(publishProblems(ready({ runFrom: "2026-11-20", runTo: "2026-11-02" })).length > 0);
  // Every date switched off.
  assert.ok(publishProblems(ready({ runFrom: "2026-11-02", runTo: "2026-11-02", datesOff: ["2026-11-02"] })).length > 0);
});
test("publish needs a block with passes (blockId AND snapshotted passes)", () => {
  assert.deepEqual(publishProblems(ready({ blockId: null })), ["a block with passes"]);
  assert.deepEqual(publishProblems(ready({ passes: [] })), ["a block with passes"]);
  assert.deepEqual(publishProblems(ready({ passes: undefined })), ["a block with passes"]);
});
test("a pass priced at 0 still counts as priced for publishing; negatives are rejected by the schema", () => {
  assert.deepEqual(publishProblems(ready({ passes: [{ name: "Free taster", price: 0 }] })), []);
  assert.equal(baseListingSchema.safeParse({ passes: [{ name: "Free taster", price: 0 }] }).success, true);
  assert.equal(baseListingSchema.safeParse({ passes: [{ name: "Bad", price: -1 }] }).success, false);
  assert.equal(baseListingSchema.safeParse({ passes: [{ name: "", price: 5 }] }).success, false);
});
test("publishProblems reports every problem at once", () => {
  assert.deepEqual(publishProblems({}), ["a name", "a venue", "dates with at least one running day", "a block with passes"]);
});
test("create needs a name or title; a partial patch does not", () => {
  assert.equal(createSchema.safeParse({}).success, false);
  assert.equal(createSchema.safeParse({ title: "x" }).success, true);
  assert.equal(createSchema.safeParse({ name: "x" }).success, true);
  assert.equal(baseListingSchema.safeParse({ visibility: "hidden" }).success, true);
  assert.equal(baseListingSchema.safeParse({ title: "   " }).success, false); // trimmed blank
});
test("status only accepts draft or live; archived is boolean", () => {
  assert.equal(baseListingSchema.safeParse({ status: "live" }).success, true);
  assert.equal(baseListingSchema.safeParse({ status: "published" }).success, false);
  assert.equal(baseListingSchema.safeParse({ archived: "yes" }).success, false);
});

// ── Visibility ────────────────────────────────────────────────────────────
test("LT-017 public + live + unarchived listing is browsable", () => {
  assert.equal(isBrowsable({ title: "Camp", status: "live", visibility: "public" }), true);
  assert.equal(isBrowsable({ title: "Camp" }), true); // legacy defaults: live + public
});
test("LT-018 hidden (link-only) is not browsable but its direct link works", () => {
  const l = { title: "Camp", status: "live", visibility: "hidden" };
  assert.equal(isBrowsable(l), false);
  assert.equal(directLinkVisible(l, false), true);
});
test("LT-019 draft is neither browsable nor reachable by a stranger, but the owner can open it", () => {
  const l = { title: "Camp", status: "draft", visibility: "public" };
  assert.equal(isBrowsable(l), false);
  assert.equal(directLinkVisible(l, false), false);
  assert.equal(directLinkVisible(l, true), true);
});
test("LT-027 archived listing drops out of browse and the stranger link", () => {
  const l = { title: "Camp", status: "live", visibility: "public", archived: true };
  assert.equal(isBrowsable(l), false);
  assert.equal(directLinkVisible(l, false), false);
  assert.equal(directLinkVisible(l, true), true);
});
test("a listing with no title is never browsable", () => {
  assert.equal(isBrowsable({ title: "  ", status: "live", visibility: "public" }), false);
  assert.equal(isBrowsable({ name: "Legacy name", status: "live" }), true);
});
test("visibility schema accepts only public or hidden", () => {
  assert.equal(baseListingSchema.safeParse({ visibility: "private" }).success, false);
});

// ── Delivery mode + coverage area ─────────────────────────────────────────
test("LT-003 home-visit needs a coverage area with at least one postcode prefix", () => {
  const hv = { venueId: null, deliveryMode: "home-visit" };
  assert.deepEqual(publishProblems(ready({ ...hv })), ["a home-visit coverage area"]);
  assert.deepEqual(publishProblems(ready({ ...hv, coverageArea: null })), ["a home-visit coverage area"]);
  assert.deepEqual(publishProblems(ready({ ...hv, coverageArea: { mode: "postcodePrefixes", postcodePrefixes: [] } })), ["a home-visit coverage area"]);
  assert.deepEqual(publishProblems(ready({ ...hv, coverageArea: { mode: "postcodePrefixes", postcodePrefixes: ["SW1", "E2"] } })), []);
});
test("LT-004 radius coverage needs both a base postcode and a radius", () => {
  const hv = { venueId: null, deliveryMode: "home-visit" };
  assert.deepEqual(publishProblems(ready({ ...hv, coverageArea: { mode: "radius", basePostcode: "SW1A 1AA" } })), ["a home-visit coverage area"]);
  assert.deepEqual(publishProblems(ready({ ...hv, coverageArea: { mode: "radius", radiusMiles: 5 } })), ["a home-visit coverage area"]);
  assert.deepEqual(publishProblems(ready({ ...hv, coverageArea: { mode: "radius", basePostcode: "SW1A 1AA", radiusMiles: 5 } })), []);
});
test("LT-005 'both' needs a venue AND a coverage area", () => {
  assert.deepEqual(publishProblems(ready({ deliveryMode: "both", venueId: null })), ["a venue", "a home-visit coverage area"]);
  assert.deepEqual(publishProblems(ready({ deliveryMode: "both" })), ["a home-visit coverage area"]);
  assert.deepEqual(publishProblems(ready({ deliveryMode: "both", coverageArea: { mode: "postcodePrefixes", postcodePrefixes: ["N1"] } })), []);
});
test("venue mode ignores any coverage area", () => {
  assert.deepEqual(publishProblems(ready({ deliveryMode: "venue", coverageArea: null })), []);
});
test("deliveryMode schema: venue | home-visit | both only", () => {
  for (const m of ["venue", "home-visit", "both"]) assert.equal(baseListingSchema.safeParse({ deliveryMode: m }).success, true);
  assert.equal(baseListingSchema.safeParse({ deliveryMode: "online" }).success, false);
});
test("coverage schema: radius must be positive and <= 200 miles; mode enumerated; null allowed", () => {
  const cov = (c: unknown) => baseListingSchema.safeParse({ coverageArea: c }).success;
  assert.equal(cov({ mode: "radius", basePostcode: "N1 1AA", radiusMiles: 10 }), true);
  assert.equal(cov({ mode: "radius", basePostcode: "N1 1AA", radiusMiles: 0 }), false);
  assert.equal(cov({ mode: "radius", basePostcode: "N1 1AA", radiusMiles: -3 }), false);
  assert.equal(cov({ mode: "radius", basePostcode: "N1 1AA", radiusMiles: 201 }), false);
  assert.equal(cov({ mode: "polygon" }), false);
  assert.equal(cov(null), true);
  assert.equal(cov({ mode: "postcodePrefixes", postcodePrefixes: Array(201).fill("N1") }), false);
});
test("LT-006 checkout coverage: postcode prefixes match the outward code, case/space-insensitive", async () => {
  const area = { mode: "postcodePrefixes" as const, postcodePrefixes: ["SW1", "e2 "] };
  assert.equal((await checkCoverage(area, "sw1a 1aa")).ok, true);
  assert.equal((await checkCoverage(area, "E2 7AB")).ok, true);
  const out = await checkCoverage(area, "M1 1AA");
  assert.equal(out.ok, false);
  assert.match((out as { reason: string }).reason, /doesn't travel to this address/);
  assert.equal((await checkCoverage(area, "")).ok, false); // postcode required
  assert.equal((await checkCoverage(null, "M1 1AA")).ok, true); // nothing configured
  assert.equal((await checkCoverage({ mode: "radius", radiusMiles: 5 }, "M1 1AA")).ok, true); // unfinished radius never blocks
  assert.equal(normalisePostcode("  sw1a   1aa "), "SW1A 1AA");
});

// ── Capacity scope ────────────────────────────────────────────────────────
test("LT-024 capacityScope is day or listing; the run recipe carries capacity to every block", () => {
  assert.equal(baseListingSchema.safeParse({ capacityScope: "day" }).success, true);
  assert.equal(baseListingSchema.safeParse({ capacityScope: "listing" }).success, true);
  assert.equal(baseListingSchema.safeParse({ capacityScope: "week" }).success, false);
  const runs = desiredRuns({ runFrom: "2026-11-02", runTo: "2026-11-20", maxAttendees: "10", capacityScope: "day" }, { start: "09:00", end: "15:30" });
  assert.equal(runs.length, 3); // Mon-Fri for 3 weeks, one block per week
  assert.ok(runs.every((r) => r.capacity === 10 && r.sessions.length === 5));
});
test("LT-001 blank / invalid capacity means effectively unlimited (9999)", () => {
  const cap = (m?: string) => desiredRuns({ runFrom: "2026-11-02", runTo: "2026-11-02", maxAttendees: m }, { start: "09:00", end: "15:00" })[0].capacity;
  assert.equal(cap(""), 9999);
  assert.equal(cap(undefined), 9999);
  assert.equal(cap("abc"), 9999);
  assert.equal(cap("0"), 9999);
  assert.equal(cap("12.9"), 12);
});
test("custom block mode gives one run; weekly gives one per calendar week; datesOff removes days", () => {
  const t = { start: "09:00", end: "15:00" };
  const custom = desiredRuns({ runFrom: "2026-11-02", runTo: "2026-11-20", blockMode: "custom" }, t);
  assert.equal(custom.length, 1);
  assert.equal(custom[0].sessions.length, 15);
  const off = desiredRuns({ runFrom: "2026-11-02", runTo: "2026-11-06", datesOff: ["2026-11-04"] }, t);
  assert.equal(off[0].sessions.length, 4);
  assert.ok(!off[0].sessions.some((s) => s.date === "2026-11-04"));
  assert.deepEqual(desiredRuns({ runFrom: "garbage", runTo: "2026-11-06" }, t), []);
});
test("capacity strings are length-limited by the schema (maxAttendees, waitlistSize)", () => {
  assert.equal(baseListingSchema.safeParse({ maxAttendees: "10" }).success, true);
  assert.equal(baseListingSchema.safeParse({ maxAttendees: "12345678901" }).success, false);
  assert.equal(baseListingSchema.safeParse({ waitlistSize: "12345678901" }).success, false);
});
test("lowAt: 'only N left' threshold scales with capacity and is clamped to 1..5", () => {
  assert.equal(lowAt(10), 4);
  assert.equal(lowAt(1), 1);
  assert.equal(lowAt(100), 5);
  assert.equal(lowAt(null), 1);
  assert.equal(lowAt(0), 1);
});

// ── Age range ─────────────────────────────────────────────────────────────
test("LT-022 age range + allowOutOfRange are accepted by the schema", () => {
  assert.equal(baseListingSchema.safeParse({ ageFrom: "5", ageTo: "11", allowOutOfRange: false }).success, true);
  assert.equal(baseListingSchema.safeParse({ ageFrom: "5", ageTo: "11", allowOutOfRange: true }).success, true);
  assert.equal(baseListingSchema.safeParse({ allowOutOfRange: "yes" }).success, false);
});
test("ageFrom must not exceed ageTo: caught at publish (not on every autosave)", () => {
  const base = { title: "x", venueId: "v", blockId: "b", passes: [{ name: "p", price: 1 }], runFrom: "2026-10-05", runTo: "2026-10-09", days: [1, 2, 3, 4, 5] };
  const p = publishProblems({ ...base, ageFrom: "11", ageTo: "5" });
  assert.ok(p.some((x) => /minimum age/.test(x)), JSON.stringify(p));
  assert.ok(!publishProblems({ ...base, ageFrom: "5", ageTo: "11" }).some((x) => /minimum age/.test(x)));
  assert.ok(!publishProblems({ ...base, ageFrom: "5", ageTo: "" }).some((x) => /minimum age/.test(x)));
  // autosaving the draft still accepts a half-typed range
  assert.equal(baseListingSchema.safeParse({ ageFrom: "11", ageTo: "5" }).success, true);
});
test("ticket override: per-ticket age + capacity + hidden flag, closing a pass", () => {
  const ok = baseListingSchema.safeParse({ ticketOverrides: { "1:1 session": { ageFrom: "6", ageTo: "9", capacity: "0", hidden: false }, "5 days": { hidden: true } } });
  assert.equal(ok.success, true);
  assert.equal(baseListingSchema.safeParse({ ticketOverrides: { x: { hidden: "true" } } }).success, false);
  assert.equal(baseListingSchema.safeParse({ ticketOverrides: { x: { capacity: 3 } } }).success, false); // stored as a string
});

// ── Waiting list, booking style, cancellation ─────────────────────────────
test("waiting list settings: on/off, 'You choose' (manual) vs 'First in the queue' (auto), max size", () => {
  const ok = (v: unknown) => baseListingSchema.safeParse(v).success;
  assert.equal(ok({ waitlist: true, waitlistMode: "manual", waitlistSize: "5" }), true);
  assert.equal(ok({ waitlist: false }), true);
  assert.equal(ok({ waitlistMode: "auto" }), true);
  assert.equal(ok({ waitlistMode: "fifo" }), false);
  assert.equal(ok({ waitlist: "on" }), false);
});
test("booking style: automatic vs manual approval only", () => {
  assert.equal(baseListingSchema.safeParse({ bookingType: "auto" }).success, true);
  assert.equal(baseListingSchema.safeParse({ bookingType: "manual" }).success, true);
  assert.equal(baseListingSchema.safeParse({ bookingType: "approval" }).success, false);
});
test("cancellation policy id is trimmed and kept (not stripped on save)", () => {
  const r = baseListingSchema.safeParse({ cancellationPolicyId: "  pol_standard " });
  assert.equal(r.success, true);
  assert.equal(r.success && r.data.cancellationPolicyId, "pol_standard");
});
test("unknown fields are stripped, known ones survive a round trip", () => {
  const r = baseListingSchema.safeParse({ title: "A", hacker: 1, tenantId: "other", visibility: "hidden" });
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal("tenantId" in r.data, false);
    assert.equal("hacker" in r.data, false);
    assert.equal(r.data.visibility, "hidden");
  }
});

// ── Booking open time / cut-off / bookRules ───────────────────────────────
test("LT-021 cut-off hours: whole number string, blank allowed, junk rejected by the schema", () => {
  const ok = (v: string) => baseListingSchema.safeParse({ bookingCutoffHours: v }).success;
  assert.equal(ok(""), true);
  assert.equal(ok("24"), true);
  assert.equal(ok("1.5"), false);
  assert.equal(ok("-2"), false);
  assert.equal(ok("abc"), false);
  assert.equal(ok("12345"), false);
});
test("cutoffHours: blank / 0 / junk = none; capped at 60 days", () => {
  assert.equal(cutoffHours(""), null);
  assert.equal(cutoffHours("0"), null);
  assert.equal(cutoffHours("abc"), null);
  assert.equal(cutoffHours(undefined), null);
  assert.equal(cutoffHours("24"), 24);
  assert.equal(cutoffHours(999999), 1440);
});
test("pastCutoff: session 09:00 tomorrow with 24h cut-off closes at the boundary (UK time)", () => {
  assert.equal(pastCutoff(24, "2026-11-03", "09:00", new Date("2026-11-02T08:59:00Z")), false);
  assert.equal(pastCutoff(24, "2026-11-03", "09:00", new Date("2026-11-02T09:01:00Z")), true);
  // Missing start time is read strictly as 00:00.
  assert.equal(pastCutoff(24, "2026-11-03", undefined, new Date("2026-11-02T00:30:00Z")), true);
});
test("pastCutoff handles BST (UK wall clock, not UTC)", () => {
  // 2026-07-28 09:00 BST = 08:00Z. 2h cut-off => closed from 07:00 BST = 06:00Z.
  assert.equal(pastCutoff(2, "2026-07-28", "09:00", new Date("2026-07-28T05:59:00Z")), false);
  assert.equal(pastCutoff(2, "2026-07-28", "09:00", new Date("2026-07-28T06:01:00Z")), true);
});
test("bookingCutoffLabel wording", () => {
  assert.equal(bookingCutoffLabel(1), "1 hour");
  assert.equal(bookingCutoffLabel(24), "24 hours");
  assert.equal(bookingCutoffLabel(48), "2 days");
  assert.equal(bookingCutoffLabel(72), "3 days");
  assert.equal(bookingCutoffLabel(50), "50 hours");
});
test("opensAt and bookRules shapes", () => {
  assert.equal(baseListingSchema.safeParse({ opensAt: "2026-11-02T09:00" }).success, true);
  assert.equal(baseListingSchema.safeParse({ bookRules: { "3 days": "week", "5 days": "blocks" } }).success, true);
  assert.equal(baseListingSchema.safeParse({ bookRules: { "3 days": "a-value-way-longer-than-20-chars" } }).success, false);
  assert.equal(baseListingSchema.safeParse({ bookRules: { "3 days": 3 } }).success, false);
});

// ── Discount rules ────────────────────────────────────────────────────────
const rule = (o: Partial<DiscountRule> = {}): DiscountRule => ({ ...emptyRule("session"), name: "Ten percent", ...o });
test("discount schema: percent over 100 is rejected, 100 is allowed, £ amounts may exceed 100", () => {
  const d = (r: DiscountRule) => baseListingSchema.safeParse({ discounts: [r] }).success;
  assert.equal(d(rule({ method: "percent", value: 100 })), true);
  assert.equal(d(rule({ method: "percent", value: 100.5 })), false);
  assert.equal(d(rule({ method: "percent", value: 250 })), false);
  assert.equal(d(rule({ method: "subtract", value: 250 })), true);
  assert.equal(d(rule({ method: "price", value: 0 })), true);
});
test("discount schema: negative values, bad kind/method and non-integer thresholds are rejected", () => {
  const d = (r: object) => baseListingSchema.safeParse({ discounts: [{ ...rule(), ...r }] }).success;
  assert.equal(d({ value: -1 }), false);
  assert.equal(d({ kind: "loyalty" }), false);
  assert.equal(d({ method: "bogus" }), false);
  assert.equal(d({ moreThan: 1.5 }), false);
  assert.equal(d({ moreThan: -1 }), false);
});
test("emptyRule presets match their card copy", () => {
  assert.deepEqual([emptyRule("person").method, emptyRule("person").value, emptyRule("person").moreThan], ["percent", 10, 1]);
  assert.deepEqual([emptyRule("session").method, emptyRule("session").value, emptyRule("session").moreThan], ["percent", 10, 3]);
  assert.equal(emptyRule("early").value, 10);
  assert.equal(emptyRule("early").enabled, true);
});
test("an empty rule name is allowed by the schema but the basket falls back to the plain-English summary", () => {
  assert.equal(baseListingSchema.safeParse({ discounts: [rule({ name: "" })] }).success, true);
  const r = rule({ name: "", moreThan: 2, method: "percent", value: 10 });
  const out = applyDiscounts([r], [{ name: "5 days", price: 100, days: 5 }], 1);
  assert.equal(out.lines[0].name, ruleSummary(r));
  assert.equal(out.lines[0].name, "Book more than 2 sessions — 10% off");
});
test("session discount applies only when sessions exceed the threshold", () => {
  const r = rule({ moreThan: 3, method: "percent", value: 10 });
  assert.equal(applyDiscounts([r], [{ name: "3 days", price: 54, days: 3 }], 1).lines.length, 0);
  const five = applyDiscounts([r], [{ name: "5 days", price: 90, days: 5 }], 1);
  assert.equal(five.total, 81);
  assert.equal(five.lines[0].amount, 9);
});
test("disabled rules never apply; discounts never take the total below zero", () => {
  assert.equal(applyDiscounts([rule({ enabled: false, moreThan: 0 })], [{ name: "a", price: 50, days: 5 }], 1).total, 50);
  assert.equal(applyDiscounts([rule({ moreThan: 0, method: "percent", value: 100 })], [{ name: "a", price: 50, days: 5 }], 1).total, 0);
  assert.equal(applyDiscounts([rule({ moreThan: 0, method: "subtract", value: 500 })], [{ name: "a", price: 50, days: 5 }], 1).total, 0);
});
test("sibling discount: more than 1 child on the SAME line; best rule wins", () => {
  const sib = emptyRule("person"); sib.name = "Sibling"; sib.value = 5; sib.method = "subtract";
  const better = emptyRule("person"); better.name = "Big sibling"; better.value = 8; better.method = "subtract";
  const out = applyDiscounts([sib, better], [{ name: "5 days", price: 90, days: 5, heads: 2 }], 2);
  assert.equal(out.lines.length, 1);
  assert.equal(out.lines[0].name, "Big sibling");
  assert.equal(out.total, 164); // 180 - 8*2
  // One child on each of two lines is not a pair.
  assert.equal(applyDiscounts([sib], [{ name: "a", price: 90, days: 5, heads: 1 }, { name: "b", price: 90, days: 5, heads: 1 }], 1).lines.length, 0);
});
test("early-bird applies on or before its date only; a rule limited to named passes only discounts those", () => {
  const early = emptyRule("early"); early.name = "Early"; early.beforeDate = "2026-10-10"; early.method = "percent"; early.value = 10;
  const items = [{ name: "5 days", price: 100, days: 5 }];
  assert.equal(applyDiscounts([early], items, 1, "2026-10-10").total, 90);
  assert.equal(applyDiscounts([early], items, 1, "2026-10-11").total, 100);
  const scoped = { ...early, passNames: ["1 day"] };
  const two = [{ name: "1 day", price: 20, days: 1 }, { name: "5 days", price: 80, days: 5 }];
  assert.equal(applyDiscounts([scoped], two, 1, "2026-10-01").total, 98); // 10% of the £20 share only
  assert.equal(applyDiscounts([early], items, 1, "2026-10-01").lines[0].scope, "All passes");
});
test("multi-person runs before multi-session, on the reduced total", () => {
  const sib = emptyRule("person"); sib.method = "percent"; sib.value = 10; sib.name = "Sib";
  const ses = rule({ moreThan: 3, method: "percent", value: 10, name: "Ses" });
  const out = applyDiscounts([ses, sib], [{ name: "5 days", price: 100, days: 5, heads: 2 }], 2);
  assert.deepEqual(out.lines.map((l) => l.name), ["Sib", "Ses"]);
  assert.equal(out.total, 162); // 200 - 20 = 180, then -18 = 162
});

// ── Block bundle pricing ──────────────────────────────────────────────────
const periods = new Map<string, PeriodDoc & { id: string }>([
  ["am", { id: "am", tenantId: "t", title: "Full day", start: "09:00", finish: "15:00" }],
  ["half", { id: "half", tenantId: "t", title: "Morning", start: "09:00", finish: "12:00" }],
]);
const passes = new Map<string, PassDoc & { id: string }>([
  ["p1", { id: "p1", tenantId: "t", name: "1 day", days: 1 }],
  ["p3", { id: "p3", tenantId: "t", name: "3 days", days: 3 }],
  ["p5", { id: "p5", tenantId: "t", name: "5 days", days: 5 }],
]);
const bundle = (o: Partial<BundleDoc> = {}): BundleDoc => ({
  tenantId: "t", name: "Camp", periodIds: ["am", "half"], passIds: ["p1", "p3", "p5"], listingIds: [], order: 0,
  archived: false, priced: true, masterPrice: 90, calcOn: true, passFlat: {}, passMode: {}, periodPrice: {}, ...o,
});
test("LT-001 bundle pricing: master pass = masterPrice; others derive per-day (5 days £90 => £18/day)", () => {
  const r = resolveBundlePricing(bundle(), passes, periods);
  assert.deepEqual(r.passes.map((p) => [p.name, p.price]), [["5 days", 90], ["3 days", 54], ["1 day", 18]]);
  assert.equal(r.perDay, 18);
});
test("bundle pricing: flat override beats the formula; calcOn=false takes flat values (default 0)", () => {
  const flat = resolveBundlePricing(bundle({ passFlat: { p1: 20 }, passMode: { p1: "flat" } }), passes, periods);
  assert.equal(flat.passes.find((p) => p.id === "p1")!.price, 20);
  const manual = resolveBundlePricing(bundle({ calcOn: false, passFlat: { p3: 54 } }), passes, periods);
  assert.equal(manual.passes.find((p) => p.id === "p3")!.price, 54);
  assert.equal(manual.passes.find((p) => p.id === "p1")!.price, 0);
  assert.equal(manual.passes[0].price, 90); // master is still masterPrice
});
test("bundle pricing: a masterPrice of 0 is a real price (free), null resolves to 0", () => {
  assert.ok(resolveBundlePricing(bundle({ masterPrice: 0 }), passes, periods).passes.every((p) => p.price === 0));
  assert.equal(resolveBundlePricing(bundle({ masterPrice: null }), passes, periods).passes[0].price, 0);
});
test("bundle timings scale by period length vs the longest; period override wins; unknown ids are skipped", () => {
  const r = resolveBundlePricing(bundle({ periodPrice: { p5_half: 40 } }), passes, periods);
  assert.equal(r.timings["p5_am"], 90);
  assert.equal(r.timings["p5_half"], 40);
  assert.equal(r.timings["p3_half"], 27); // 54 * 3/6
  const missing = resolveBundlePricing(bundle({ passIds: ["p5", "ghost"], periodIds: ["am", "nope"] }), passes, periods);
  assert.equal(missing.passes.length, 1);
  assert.deepEqual(Object.keys(missing.timings), ["p5_am"]);
});
test("bundle with no passes resolves to nothing (cannot be sent to a listing)", () => {
  const r = resolveBundlePricing(bundle({ passIds: [] }), passes, periods);
  assert.deepEqual(r.passes, []);
  assert.equal(r.perDay, 0);
});
