// Coupon QA (agent B, 8 Oct): at the parent checkout a typed-in discount code showed as "Code X  -£2.00" with no way to take it off;
// the only way was to retype it and press Apply (or tap a coupon chip). Each applied code now has a Remove button.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("every applied code line in the checkout carries a Remove button wired to removeCode", () => {
  const src = readFileSync(new URL("../../features/listings/checkout.tsx", import.meta.url), "utf8");
  assert.match(src, /appliedCodes\.map\(\(a\) => \(\s*<div key=\{a\.code\}[\s\S]{0,700}onClick=\{\(\) => removeCode\(a\.code\)\}[\s\S]{0,200}p8lst\.bpRemove/);
});
