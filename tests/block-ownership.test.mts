import test from "node:test";
import assert from "node:assert/strict";
import { ownershipOf } from "../server/src/routes/blockBundles";

test("ownershipOf keeps franchise + creator, drops everything else", () => {
  assert.deepEqual(ownershipOf({ franchiseId: "f1", createdBy: "a@b.c", name: "x", tenantId: "t" }), { franchiseId: "f1", createdBy: "a@b.c" });
});
test("ownershipOf keeps an explicit head-office null and tolerates missing", () => {
  assert.deepEqual(ownershipOf({ franchiseId: null }), { franchiseId: null });
  assert.deepEqual(ownershipOf(undefined), {});
});
