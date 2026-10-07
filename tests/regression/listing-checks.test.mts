// Listing date + postcode rules (QA defects D1-D3 from the home-visit QA run, and the date box typed "2006").
import test from "node:test";
import assert from "node:assert/strict";
import { addDaysIso, allDatesPassed, postcodeKind, checkPostcodeKnown, homeVisitPostcodeProblem, cleanCoverage, coveragePostcodes } from "../../server/src/lib/listingChecks";
import { publishProblems } from "../../server/src/lib/listingRules";
import { dateProblem, maxRunIso, todayIso, fixYear } from "../../features/listings/wizardRules";

test("addDaysIso / allDatesPassed: one day of grace", () => {
  assert.equal(addDaysIso("2026-10-07", -1), "2026-10-06");
  assert.equal(allDatesPassed("2006-11-03", "2026-10-07"), true);
  assert.equal(allDatesPassed("2026-10-06", "2026-10-07"), false); // yesterday: inside the grace
  assert.equal(allDatesPassed("2026-10-05", "2026-10-07"), true);
  assert.equal(allDatesPassed(undefined, "2026-10-07"), false);
});

const ready = (o: Record<string, unknown> = {}) => ({ title: "x", venueId: "v", runFrom: "2006-10-23", runTo: "2006-11-03", blockId: "b", passes: [{ name: "p", price: 1 }], ...o });
test("publishProblems refuses a listing whose every date has passed, only when today is supplied", () => {
  assert.deepEqual(publishProblems(ready()), []); // unchanged for callers (tests, seeds) that do not pass today
  assert.deepEqual(publishProblems(ready(), { today: "2026-10-07" }), ["dates in the future (every date has already passed)"]);
  assert.deepEqual(publishProblems(ready({ runFrom: "2026-10-05", runTo: "2026-11-20" }), { today: "2026-10-07" }), []); // running now is fine
});

test("postcodeKind: full, outward, sector and area forms", () => {
  assert.deepEqual(postcodeKind("mk10 9nr"), { kind: "full", code: "MK109NR" });
  assert.deepEqual(postcodeKind("NW1"), { kind: "outward", code: "NW1" });
  assert.deepEqual(postcodeKind("TW9 1"), { kind: "outward", code: "TW9" });
  assert.deepEqual(postcodeKind("SW1A"), { kind: "outward", code: "SW1A" });
  assert.deepEqual(postcodeKind("MK"), { kind: "area", code: "MK" });
  assert.equal(postcodeKind("hello").kind, "bad");
  assert.equal(postcodeKind("12345").kind, "bad");
});

const fake = (status: number | "throw") => (async () => { if (status === "throw") throw new Error("offline"); return { ok: status === 200, status } as Response; }) as unknown as typeof fetch;
test("checkPostcodeKnown: ok / bad / fails open when the lookup is down", async () => {
  assert.equal(await checkPostcodeKnown("MK10 9NR", fake(200)), "ok");
  assert.equal(await checkPostcodeKnown("ZZ99 9ZZ", fake(404)), "bad");
  assert.equal(await checkPostcodeKnown("NW1", fake(404)), "bad");
  assert.equal(await checkPostcodeKnown("MK10 9NR", fake("throw")), "unknown");
  assert.equal(await checkPostcodeKnown("MK10 9NR", fake(500)), "unknown");
  assert.equal(await checkPostcodeKnown("nonsense", fake(200)), "bad");
  assert.equal(await checkPostcodeKnown("NW", fake(404)), "ok"); // a whole area is not looked up
});

test("homeVisitPostcodeProblem: only home-visit listings, names the bad postcode", async () => {
  const hv = { deliveryMode: "home-visit", coverageArea: { mode: "radius", basePostcode: "zz99 9zz", radiusMiles: 10 } };
  const bad = async () => "bad" as const;
  const ok = async () => "ok" as const;
  assert.match((await homeVisitPostcodeProblem(hv, bad)) ?? "", /ZZ99 9ZZ/);
  assert.equal(await homeVisitPostcodeProblem(hv, ok), null);
  assert.equal(await homeVisitPostcodeProblem({ deliveryMode: "venue", coverageArea: hv.coverageArea }, bad), null);
  assert.match((await homeVisitPostcodeProblem({ deliveryMode: "home-visit", coverageArea: { mode: "postcodePrefixes", postcodePrefixes: ["MK10", "ZZ9"] } }, async (p) => (p === "ZZ9" ? "bad" : "ok")))!, /ZZ9/);
});

test("cleanCoverage drops the other mode's data", () => {
  assert.deepEqual(cleanCoverage({ mode: "radius", postcodePrefixes: ["MK10"], basePostcode: "MK10 9NR", radiusMiles: 5 }), { mode: "radius", basePostcode: "MK10 9NR", radiusMiles: 5 });
  assert.deepEqual(cleanCoverage({ mode: "postcodePrefixes", postcodePrefixes: ["MK10"], basePostcode: "x", radiusMiles: 5 }), { mode: "postcodePrefixes", postcodePrefixes: ["MK10"] });
  assert.deepEqual(coveragePostcodes({ mode: "radius", basePostcode: "MK10 9NR", postcodePrefixes: ["N1"] }), ["MK10 9NR"]);
});

test("dateProblem: past / far / still typing", () => {
  assert.equal(dateProblem("2006-10-20", "2026-10-07"), "past");
  assert.equal(dateProblem("2026-10-06", "2026-10-07"), "past");
  assert.equal(dateProblem("2026-10-07", "2026-10-07"), null);
  assert.equal(dateProblem("2030-01-01", "2026-10-07"), "far");
  assert.equal(dateProblem("2029-10-07", "2026-10-07"), null);
  assert.equal(dateProblem("0002-10-20", "2026-10-07"), null); // year still being typed
  assert.equal(dateProblem("2026-06-01", "2026-10-07", 365), null); // a run that started months ago is fine
  assert.equal(dateProblem("2006-10-20", "2026-10-07", 365), "past");
  assert.equal(maxRunIso("2026-10-07"), "2029-10-07");
  assert.match(todayIso(new Date(2026, 9, 7)), /^2026-10-07$/);
});

test("fixYear is only for blur: two-digit years become 20xx, real years are left alone", () => {
  assert.equal(fixYear("0026-10-20"), "2026-10-20");
  assert.equal(fixYear("2026-10-20"), "2026-10-20");
});
