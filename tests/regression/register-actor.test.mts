import test from "node:test";
import assert from "node:assert/strict";
import { pickActorName, ownerNeedsRealName, canTakeRegister } from "../../server/src/lib/actorNamePure";

// A freelancer working alone takes their own registers: allowed with no staff record, and stamped with a real name (never an email or "support").

test("owners (freelancer / company) and staff may take a register; parents and platform may not", () => {
  for (const r of ["freelancer", "company", "staff", "franchise"]) assert.equal(canTakeRegister(r, true), true, r);
  for (const r of ["parent", "platform"]) assert.equal(canTakeRegister(r, true), false, r);
  assert.equal(canTakeRegister("freelancer", false), false, "no tenant, no register");
});

test("a freelancer with a real personal name is stamped with it", () => {
  assert.equal(pickActorName({ role: "freelancer", userDocName: "Kaz James", tokenName: "support", email: "support@apf.co.uk", publicName: "APF Activity Camps" }), "Kaz James");
  assert.equal(pickActorName({ role: "freelancer", tokenName: "Jo Bloggs", email: "jo@x.com", publicName: "Jo's Camps" }), "Jo Bloggs");
});

test("a freelancer whose account name is 'support' is stamped with the provider's public name, never the email", () => {
  const name = pickActorName({ role: "freelancer", tokenName: "support", email: "support@apfactivitycamps.com", publicName: "APF Activity Camps" });
  assert.equal(name, "APF Activity Camps");
  assert.ok(!name.includes("@"));
  assert.equal(pickActorName({ role: "company", tokenName: null, userDocName: "", email: "info@co.com", publicName: "Sunny Sports" }), "Sunny Sports");
});

test("with nothing real to show an owner is 'Provider', not an email or a role word", () => {
  assert.equal(pickActorName({ role: "freelancer", tokenName: "support", email: "support@x.com", publicName: "" }), "Provider");
  assert.equal(pickActorName({ role: "freelancer", tokenName: "", email: "kaz@x.com", publicName: "admin" }), "Provider");
});

test("staff keep the old stamp: their account name, else their email, else the fallback", () => {
  assert.equal(pickActorName({ role: "staff", tokenName: "Sam Lee", email: "sam@x.com" }), "Sam Lee");
  assert.equal(pickActorName({ role: "staff", tokenName: "", email: "sam@x.com" }), "sam@x.com");
  assert.equal(pickActorName({ role: "staff", tokenName: null, email: null }), "Staff");
});

test("only owners with no real name are asked for one", () => {
  assert.equal(ownerNeedsRealName({ role: "freelancer", tokenName: "support", email: "support@x.com" }), true);
  assert.equal(ownerNeedsRealName({ role: "freelancer", tokenName: "support", userDocName: "Kaz James", email: "support@x.com" }), false);
  assert.equal(ownerNeedsRealName({ role: "staff", tokenName: "support", email: "support@x.com" }), false);
  assert.equal(ownerNeedsRealName({ role: "parent", tokenName: "", email: "p@x.com" }), false);
});
