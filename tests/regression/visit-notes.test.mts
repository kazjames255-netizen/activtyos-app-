import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanVisitNotes, savedAddressOffer, VISIT_NOTES_MAX } from "../../server/src/lib/visitNotes";

test("access notes: blank / non-string notes are dropped", () => {
  assert.equal(cleanVisitNotes(undefined), undefined);
  assert.equal(cleanVisitNotes("   \n  "), undefined);
  assert.equal(cleanVisitNotes(42), undefined);
});

test("access notes: trimmed, line breaks normalised, control characters removed", () => {
  assert.equal(cleanVisitNotes("  Park on the drive\r\nGate code 1234\u0007  "), "Park on the drive\nGate code 1234");
  assert.equal(cleanVisitNotes("a\n\n\n\nb"), "a\n\nb");
});

test("access notes: capped at the maximum length", () => {
  const out = cleanVisitNotes("x".repeat(VISIT_NOTES_MAX + 300));
  assert.equal(out?.length, VISIT_NOTES_MAX);
});

test("saved address is only offered when it has a postcode", () => {
  assert.equal(savedAddressOffer(null), null);
  assert.equal(savedAddressOffer({ address: "1 High St" }), null);
  assert.deepEqual(savedAddressOffer({ address: " 1 High St ", postcode: " MK10 9NR " }), { address: "1 High St", postcode: "MK10 9NR" });
  assert.deepEqual(savedAddressOffer({ postcode: "NW1 6XE" }), { address: "", postcode: "NW1 6XE" });
});
