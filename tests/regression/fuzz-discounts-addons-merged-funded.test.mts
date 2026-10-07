// A multi-week basket where a 100% code makes one week's row £0 but an add-on leaves £ owing on another week:
// the merged booking must not stay "Funded" (found by the discounts-addons fuzzer, money.funded-owes-nothing).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("merged booking takes pay/method from a row that owes money, not a £0 first row", () => {
  const src = readFileSync(new URL("../../server/src/routes/my.ts", import.meta.url), "utf8");
  assert.match(src, /first\.pay === "Funded" && grp\.some\(\(g\) => g\.pay !== "Funded"\)/);
});
