// rewardReferrer's "already rewarded for this friend" check ignored the provider, so a referrer/friend pair rewarded by provider A was silently
// refused a reward at provider B (coupon test C, 8 Oct). The check must be scoped to the tenant.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the duplicate-referral check is scoped to the provider", () => {
  const src = readFileSync(new URL("../../server/src/routes/referral.ts", import.meta.url), "utf8");
  const at = src.indexOf("const dupe = ");
  assert.ok(at > 0);
  const line = src.slice(at, src.indexOf("\n", at));
  assert.match(line, /where\("tenantId", "==", tenantId\)/);
  assert.match(line, /where\("referrerEmail", "==", rel\)/);
  assert.match(line, /where\("friendEmail", "==", fel\)/);
});
