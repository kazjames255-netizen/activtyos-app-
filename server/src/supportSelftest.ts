import assert from "node:assert/strict";
import { cleanSupport, DEFAULT_SUPPORT, effectiveLimitMins, isDefaultSupport } from "../../features/learninghub/support";

assert.deepEqual(cleanSupport(undefined), DEFAULT_SUPPORT);
assert.deepEqual(cleanSupport({ extraTimePercent: 30, textSize: "huge", calm: "yes" }), DEFAULT_SUPPORT);
assert.equal(cleanSupport({ extraTimePercent: 50, calm: true }).extraTimePercent, 50);
assert.equal(isDefaultSupport(DEFAULT_SUPPORT), true);
assert.equal(isDefaultSupport(cleanSupport({ calm: true })), false);
assert.equal(effectiveLimitMins(null, cleanSupport({ extraTimePercent: 50 })), null);
assert.equal(effectiveLimitMins(20, undefined), 20);
assert.equal(effectiveLimitMins(20, DEFAULT_SUPPORT), 20);
assert.equal(effectiveLimitMins(20, cleanSupport({ extraTimePercent: 25 })), 25);
assert.equal(effectiveLimitMins(15, cleanSupport({ extraTimePercent: 25 })), 19); // 18.75 rounds up
assert.equal(effectiveLimitMins(20, cleanSupport({ extraTimePercent: 50, noTimer: true })), null);
console.log("support selftest OK");
