// Pure checks behind the parent-portal fixes (P08 P25 P34 P40). The behaviour is proved against the emulator in tests/emulator/parent-fixes.test.mts.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normRef, refKeys } from "../server/src/lib/bookingRef";
import { namesMentioned } from "../server/src/lib/incidentNames";
import { allergenHits } from "../features/meals/allergens";
import { exportMoment, scrubFamilyExport, staffLabel } from "../server/src/lib/familyExport";

describe("booking numbers (P40)", () => {
  it("trim, strip spaces, upper-case", () => {
    assert.equal(normRef("  ami-1 "), "AMI-1");
    assert.equal(normRef("a m i - 1"), "AMI-1");
    assert.deepEqual(refKeys(" ami-1"), ["AMI-1", "ami-1"]);
    assert.deepEqual(refKeys("AMI-1"), ["AMI-1"]);
  });
});

describe("another child named in a write-up (P08)", () => {
  it("whole-word, case-insensitive, first name or full name", () => {
    assert.deepEqual(namesMentioned("Ben fell on Ava", ["Ben Beta", "Cara Gamma"]), ["Ben Beta"]);
    assert.deepEqual(namesMentioned("Benjamin tripped", ["Ben Beta"]), []);
    assert.deepEqual(namesMentioned("Grazed a knee", ["Ben Beta"]), []);
  });
});

describe("one allergen rule (P34)", () => {
  it("synonyms and dish spellings", () => {
    assert.deepEqual(allergenHits("nut allergy", ["peanuts"]), ["peanuts"]);
    assert.deepEqual(allergenHits("Nut allergy", ["Tree nuts"]), ["Tree nuts"]);
    assert.deepEqual(allergenHits("dairy", ["Milk"]), ["Milk"]);
    assert.deepEqual(allergenHits("milk", ["Dairy"]), ["Dairy"]);
    assert.deepEqual(allergenHits("coeliac", ["Wheat"]), ["Wheat"]);
    assert.deepEqual(allergenHits("egg", ["eggs"]), ["eggs"]);
    assert.deepEqual(allergenHits("nut allergy", ["gluten"]), []);
  });
});

describe("family export (P25)", () => {
  it("a group moment keeps only this family's child and comments; staff are first name + role", () => {
    const m = exportMoment({ id: "m1", tenantId: "t", caption: "hi", childIds: ["a", "b"], childNames: ["Ava", "Ben"], postedBy: "staff@x.com", postedByName: "staff@x.com", comments: [{ role: "parent", by: "uidB", text: "B reply" }, { role: "parent", by: "uidA", text: "A reply" }, { role: "staff", byName: "Sam Jones", text: "team" }] }, new Set(["a"]), "uidA");
    const t = JSON.stringify(m);
    assert.ok(!t.includes("Ben") && !t.includes("uidB") && !t.includes("B reply") && !t.includes("staff@x.com"));
    assert.ok(t.includes("A reply") && t.includes("Ava"));
    assert.equal(staffLabel("Sam Jones", "team"), "Sam (team)");
  });
  it("deep scrub drops internal keys and staff emails but keeps the parent's own", () => {
    const out = scrubFamilyExport({ a: [{ recon: { note: "x" }, reconNotes: [1], ok: 1, collectedBy: "staff@x.com", email: "me@x.com", by: "me@x.com" }] }, "me@x.com") as any;
    assert.deepEqual(Object.keys(out.a[0]).sort(), ["by", "collectedBy", "email", "ok"]);
    assert.equal(out.a[0].collectedBy, "The team");
    assert.equal(out.a[0].by, "me@x.com");
  });
});
