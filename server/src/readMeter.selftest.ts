// Offline selftest for lib/readMeter.ts helpers (no Firestore): attribution, budget guard, counters.
// Run: cd server && node_modules/.bin/tsx src/readMeter.selftest.ts
import assert from "node:assert/strict";
process.env.HUB_READ_BUDGET_PER_HOUR = "5";
const { withReadLabel, currentReadLabel, readStats, resetReadStats, overReadBudget, readsInLast } = await import("./lib/readMeter");

assert.equal(currentReadLabel(), undefined);
await withReadLabel("sweep:x", async () => {
  await Promise.resolve();
  assert.equal(currentReadLabel(), "sweep:x", "label survives awaits");
  await withReadLabel("inner", async () => assert.equal(currentReadLabel(), "inner"));
  assert.equal(currentReadLabel(), "sweep:x", "outer label restored");
});
resetReadStats();
assert.equal(readStats().total, 0);
assert.equal(readsInLast(60), 0);
assert.equal(overReadBudget("test"), false, "under budget");
console.log("readMeter selftest: 6 checks passed");
