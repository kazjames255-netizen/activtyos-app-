import { test } from "node:test";
import assert from "node:assert/strict";
import { isPlaceholderName } from "../../lib/ownerName";

test("role-style and empty names are placeholders", () => {
  for (const n of ["support", "Support", "ADMIN", "info", "", "  ", "a", "123", "no-reply", "Team", "owner"]) assert.equal(isPlaceholderName(n), true, n);
});

test("an email address or the email's own local part is a placeholder", () => {
  assert.equal(isPlaceholderName("support@apfactivitycamps.com"), true);
  assert.equal(isPlaceholderName("kazjames", "kazjames"), true);
  assert.equal(isPlaceholderName("Kaz James", "kazjames"), false); // a spaced personal name is real even if the letters match the email
});

test("a real name is not a placeholder", () => {
  for (const n of ["Kaz James", "Priya Patel", "Zoë O'Neil", "Li Wei", "Amir"]) assert.equal(isPlaceholderName(n, "support"), false, n);
});
