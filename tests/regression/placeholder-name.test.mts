import test from "node:test";
import assert from "node:assert/strict";
import { isPlaceholderName, providerBrand, emailLocalPart } from "../../lib/placeholderName";

test("role words and the login's own local part are placeholders", () => {
  for (const n of ["support", "Support", "ADMIN", "info", "accounts", "no-reply", "noreply", "Hello", "", "   ", "a@b.com", "!!!"]) assert.equal(isPlaceholderName(n), true, n);
  assert.equal(isPlaceholderName("kazjames255", "kazjames255@gmail.com"), true);
  assert.equal(emailLocalPart("Support@APFActivityCamps.com"), "support");
});

test("real people and business names are not placeholders", () => {
  for (const n of ["Kaz James", "APF Activity Camps", "Sunshine Coaching Ltd", "Dr Support Services"]) assert.equal(isPlaceholderName(n, "support@apf.com"), false, n);
});

test("providerBrand prefers the public name, then the business, then the tenant; never a login name", () => {
  assert.deepEqual(providerBrand({ publicName: "APF Activity Camps", tenantName: "x" }), { name: "APF Activity Camps", placeholder: false });
  assert.deepEqual(providerBrand({ providerName: "", businessName: "Sunshine Ltd", tenantName: "T" }), { name: "Sunshine Ltd", placeholder: false });
  assert.deepEqual(providerBrand({ tenantName: "Tenant Co" }), { name: "Tenant Co", placeholder: false });
  assert.deepEqual(providerBrand({ providerName: "support", tenantName: "" }), { name: "", placeholder: true });
  assert.deepEqual(providerBrand({}), { name: "", placeholder: true });
});
