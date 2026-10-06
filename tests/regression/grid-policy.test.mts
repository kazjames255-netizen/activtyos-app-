// GRID: refund bands for every policy, per-child and provider-initiated cancels (pure, no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_POLICIES, refundFor } from "../../lib/cancellation";

const D = "2026-10-20";
const at = (h: number) => new Date(Date.parse(`${D}T00:00:00Z`) - h * 3_600_000).toISOString();
const CUSTOM = { id: "custom", name: "Custom", bands: [{ hoursBefore: 336, refundPercent: 100 }, { hoursBefore: 168, refundPercent: 50 }, { hoursBefore: 48, refundPercent: 25 }] };

test("grid: provider-initiated cancel is 100% under every policy, even after the session started", () => {
  for (const p of [...DEFAULT_POLICIES, CUSTOM]) for (const h of [700, 48, 1, -30]) {
    const r = refundFor(p as never, D, 54, at(h), "provider");
    assert.equal(r?.amount, 54, `${p.name} h=${h}`);
  }
});
test("grid: custom bands hit their exact boundaries", () => {
  const exp: [number, number][] = [[336, 54], [335, 27], [168, 27], [167, 13.5], [48, 13.5], [47, 0]];
  for (const [h, amt] of exp) assert.equal(refundFor(CUSTOM as never, D, 54, at(h), "parent")?.amount, amt, `h=${h}`);
});
test("grid: a per-child cancel is refunded on that child's price, per policy, never above what was paid", () => {
  for (const p of [...DEFAULT_POLICIES, CUSTOM]) for (const h of [700, 100, 10]) {
    const r = refundFor(p as never, D, 18, at(h), "parent");
    assert.ok(r && r.amount >= 0 && r.amount <= 18, `${p.name} h=${h}`);
  }
});
