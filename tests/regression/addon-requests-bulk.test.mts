import test from "node:test";
import assert from "node:assert/strict";
import { addonLineKey } from "../../features/bookings/addons";
import { describeRequest, requestTargets } from "../../features/bookings/addonRequests";
import { applyCancelDay } from "../../features/bookings/mutations";
import { followCancelledDays, removeLineDays } from "../../features/bookings/addonDays";
import { approveAddonRequest } from "../../server/src/lib/addonRequestsCore";

// One request for several days and several extras (bulk), approved or declined as one, and a cancelled day following the money.

const DAYS = ["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"];
const bottleLine = (days = DAYS) => ({ child: "sally james", label: `Water bottle × ${days.length} (Colour: Blue)`, price: days.length * 3, days, perDay: true, name: "Water bottle", answers: [{ label: "Colour", value: "Blue" }], qty: days.length });
const mkDaily = (o: Record<string, unknown> = {}) => {
  const l = bottleLine();
  return { ref: "APF-2", status: "Confirmed", pay: "Paid", amount: 161, amountPaid: 161, method: "Card", child: "sally james", days: DAYS, addons: [`${l.label} — £21.00`], addonLines: [l], kids: [{ name: "sally james", dates: DAYS }], ...o } as any;
};
const pendingCancel = (b: any, targets: any[], price: number) => {
  const k = addonLineKey("sally james", b.addonLines[0].label);
  b.addonRequests = [{ id: "r9", key: k, kind: "cancel", child: "sally james", label: b.addonLines[0].label, price, status: "pending", createdAt: "x", targets }];
  return k;
};

test("a request made before bulk requests (no targets) reads as the one whole extra", () => {
  const r = { key: "sally james|tshirty (size: m)", kind: "cancel", child: "sally james", label: "tshirty (size: m)", price: 10 } as any;
  assert.deepEqual(requestTargets(r).map((t) => t.key), [r.key]);
  assert.equal(describeRequest(r), "sally asks to cancel tshirty (size: m)");
  assert.equal(describeRequest({ ...r, targets: [{ key: "a", child: "sally james", label: "x", price: 1 }, { key: "b", child: "sally james", label: "y", price: 1 }] }), "sally asks to cancel 2 extras");
});

test("approve a bulk cancel on a paid booking: days come off the daily extra, the one-off goes, ONE pending refund for the total", () => {
  const b = mkDaily({ addons: ["Water bottle × 7 (Colour: Blue) — £21.00", "T-shirt (Size: M) — £8.00"], amount: 169, amountPaid: 169 });
  b.addonLines.push({ child: "sally james", label: "T-shirt (Size: M)", price: 8, days: DAYS, perDay: false, name: "T-shirt", qty: 1 });
  const kb = pendingCancel(b, [], 17);
  const kt = addonLineKey("sally james", "T-shirt (Size: M)");
  b.addonRequests[0].targets = [{ key: kb, child: "sally james", label: b.addonLines[0].label, days: DAYS.slice(4), price: 9 }, { key: kt, child: "sally james", label: "T-shirt (Size: M)", price: 8 }];
  const out = approveAddonRequest(b, "r9", { resolution: "refund", by: "Provider" });
  assert.equal(out.release?.amount, 17); assert.equal(b.cancel?.amount, 17); assert.equal(b.cancel?.refund, "pending");
  assert.equal(b.addonLines.length, 1);
  assert.deepEqual(b.addonLines[0].days, DAYS.slice(0, 4)); assert.equal(b.addonLines[0].price, 12); assert.equal(b.addonLines[0].label, "Water bottle × 4 (Colour: Blue)");
  assert.deepEqual(b.addons, ["Water bottle × 4 (Colour: Blue) — £12.00"]);
  assert.equal(b.amount, 152); assert.equal(b.status, "Confirmed");
});

test("approve a bulk cancel on an UNPAID booking: the total comes off what is owed; a repeat approve is refused and changes nothing", () => {
  const b = mkDaily({ pay: "Unpaid", amountPaid: 0 });
  const k = pendingCancel(b, [], 12);
  b.addonRequests[0].targets = [{ key: k, child: "sally james", label: b.addonLines[0].label, days: DAYS.slice(3), price: 12 }];
  approveAddonRequest(b, "r9", { by: "Provider" });
  assert.equal(b.amount, 149); assert.equal(b.cancel, undefined); assert.equal(b.addonLines[0].days.length, 3);
  assert.throws(() => approveAddonRequest(b, "r9", { by: "Provider" }), (e: any) => e.status === 409);
  assert.equal(b.amount, 149);
});

test("a day the provider cancelled meanwhile is skipped and the pending request follows the reworded line; days nobody has are refused with a reason", () => {
  const b = mkDaily({ pay: "Unpaid", amountPaid: 0 });
  const k = pendingCancel(b, [], 6);
  b.addonRequests[0].targets = [{ key: k, child: "sally james", label: b.addonLines[0].label, days: [DAYS[5], DAYS[6]], price: 6 }];
  removeLineDays(b, b.addonLines[0], [DAYS[6]]);
  assert.equal(b.addonRequests[0].targets[0].key, addonLineKey("sally james", "Water bottle × 6 (Colour: Blue)"));
  approveAddonRequest(b, "r9", { by: "Provider" });
  assert.equal(b.addonLines[0].days.length, 5); assert.equal(b.amount, 161 - 3); // only the day still on the line (D6) comes off what is owed
  const c = mkDaily();
  const ck = pendingCancel(c, [], 3);
  c.addonRequests[0].targets = [{ key: ck, child: "sally james", label: c.addonLines[0].label, days: ["2026-11-01"], price: 3 }];
  assert.throws(() => approveAddonRequest(c, "r9", { resolution: "refund", by: "Provider" }), (e: any) => e.status === 409);
  assert.equal(c.cancel, undefined); assert.equal(c.addonLines[0].days.length, 7);
});

test("a cancelled day takes its share off the line and, when nothing was paid, the amount owed; a paid booking refunds the same share (amount 161 -> 138)", () => {
  const u = mkDaily({ pay: "Unpaid", amountPaid: 0 });
  applyCancelDay(u, 0, DAYS[2], { resolution: "refund" });
  assert.equal(u.amount, 138); assert.equal(u.addonLines[0].label, "Water bottle × 6 (Colour: Blue)"); assert.equal(u.addonLines[0].price, 18); assert.ok(!u.addonLines[0].days.includes(DAYS[2]));
  assert.deepEqual(u.addons, ["Water bottle × 6 (Colour: Blue) — £18.00"]);
  const p = mkDaily();
  const res = applyCancelDay(p, 0, DAYS[2], { resolution: "refund" });
  assert.equal(p.amount, 138); assert.equal(res?.amount, 23); assert.equal(p.addonLines[0].price, 18);
  assert.equal(followCancelledDays(p, "someone else", [DAYS[0]]), 0); // another child's extras are untouched
});
