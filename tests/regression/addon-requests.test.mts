import test from "node:test";
import assert from "node:assert/strict";
import { addonRequestBlock, changeProblem, daysUntil, describeRequest, labelWithAnswers, pendingForLine, requestDeadline } from "../../features/bookings/addonRequests";
import { addonLineKey, bookingAddonLines, kitForDay, parseAddonLabel } from "../../features/bookings/addons";
import { needsDecision } from "../../features/bookings/helpers";
import { AddonRequestError, addAddonRequest, approveAddonRequest, declineAddonRequest, withdrawAddonRequest, currentAnswers } from "../../server/src/lib/addonRequestsCore";

// A family's request to change / cancel ONE extra: validation, the cut-off, one pending per extra, and what approving does to the booking and the money.
// Never automatic, never the same as cancelling the booking.

const LABEL = "tshirty (size: m)";
const mk = (o: Record<string, unknown> = {}) => ({
  ref: "APF-1", status: "Confirmed", pay: "Paid", amount: 15, amountPaid: 15, method: "Card", child: "sally james", days: ["2026-10-28"],
  addons: [`${LABEL} — £10.00`, "water bottle (colour: red) — £5.00"],
  addonLines: [
    { child: "sally james", label: LABEL, price: 10, days: ["2026-10-28"], perDay: false, addonId: "a1", answers: [{ label: "size", value: "m" }] },
    { child: "sally james", label: "water bottle (colour: red)", price: 5, days: ["2026-10-28"], perDay: false },
  ],
  ...o,
}) as any;
const req = (b: any, over: Record<string, unknown> = {}) => ({
  id: "r1", key: addonLineKey("sally james", LABEL), kind: "cancel", child: "sally james", label: LABEL, price: 10, status: "pending", createdAt: "x", ...over,
}) as any;

test("the line key and the shared add-on parser (features/bookings/addons.ts) agree on the label the booking stores", () => {
  const p = parseAddonLabel("tshirty × 2 (size: m)");
  assert.equal(p.name, "tshirty"); assert.equal(p.qty, 2); assert.deepEqual(p.answers, [{ label: "size", value: "m" }]);
  const lines = bookingAddonLines(mk());
  assert.equal(lines.length, 2);
  assert.equal(lines[0].name, "Tshirty"); assert.equal(lines[0].choice, "size: m"); assert.equal(lines[0].price, 10);
  assert.equal(addonLineKey("sally james", LABEL), "sally james|tshirty (size: m)");
});

test("the cut-off: asked up to N days before; 0 = until the day itself; past and pending are blocked", () => {
  const line = { key: "k", days: ["2026-10-28"] };
  const b = mk();
  assert.equal(addonRequestBlock(b, line, "2026-10-25", 3), "none");   // 3 days before: still allowed
  assert.equal(addonRequestBlock(b, line, "2026-10-26", 3), "cutoff");  // 2 days before: too late
  assert.equal(addonRequestBlock(b, line, "2026-10-28", 0), "none");    // 0 = the day of the session
  assert.equal(addonRequestBlock(b, line, "2026-10-29", 0), "past");
  assert.equal(addonRequestBlock(mk({ status: "Cancelled" }), line, "2026-10-01", 3), "cancelled");
  assert.equal(addonRequestBlock(mk({ addonRequests: [{ key: "k", status: "pending" }] }), line, "2026-10-01", 3), "pending");
  assert.equal(daysUntil("2026-10-25", "2026-10-28"), 3);
  assert.equal(requestDeadline("2026-10-28", 3), "2026-10-25");
});

test("changeProblem only accepts a real option that differs from today's", () => {
  const qs = [{ id: "q1", label: "size", type: "choice", options: ["s", "m", "l"], required: true }];
  assert.equal(changeProblem(qs, { size: "m" }, { size: "l" }), null);
  assert.match(changeProblem(qs, { size: "m" }, { size: "xxl" }) ?? "", /isn't one of the options/);
  assert.match(changeProblem(qs, { size: "m" }, { size: "m" }) ?? "", /already have/);
  assert.match(changeProblem(qs, { size: "m" }, {}) ?? "", /Pick what/);
  assert.equal(labelWithAnswers("tshirty", 1, false, [{ label: "size", value: "l" }]), "tshirty (size: l)");
  assert.equal(describeRequest({ kind: "change", child: "sally james", label: LABEL, toLabel: "tshirty (size: l)" }), "sally asks to change tshirty (size: m) to tshirty (size: l)");
});

test("one pending request per extra", () => {
  const b = mk();
  addAddonRequest(b, req(b));
  assert.ok(pendingForLine(b, addonLineKey("sally james", LABEL)));
  assert.throws(() => addAddonRequest(b, req(b, { id: "r2" })), (e: any) => e instanceof AddonRequestError && e.status === 409);
  assert.equal(needsDecision(b), true); // it shows in the provider's Requests tab
});

test("approve a CANCEL on a paid booking: the extra comes off, the booking stands, the refund is a pending request the provider sends", () => {
  const b = mk(); b.addonRequests = [req(b)];
  const out = approveAddonRequest(b, "r1", { resolution: "refund", by: "Provider" });
  assert.equal(out.request.status, "approved");
  assert.equal(b.status, "Confirmed");                       // the booking is untouched
  assert.equal(b.addonLines.length, 1); assert.equal(b.addons.length, 1);
  assert.equal(b.cancel?.refund, "pending"); assert.equal(b.cancel?.amount, 10); assert.equal(b.cancel?.refundOnly, true);
  assert.equal(out.release?.resolution, "refund"); assert.equal(out.release?.amount, 10);
  assert.equal(b.amount, 5);                             // the removed share leaves the amount; the refund is only what is then overpaid (15 paid - 5 = 10)
});

test("approve a CANCEL with wallet credit / no refund", () => {
  const w = mk(); w.addonRequests = [req(w)];
  const ow = approveAddonRequest(w, "r1", { resolution: "wallet", by: "Provider" });
  assert.equal(ow.release?.resolution, "wallet"); assert.equal(ow.release?.amount, 10);
  assert.ok((w.refundLog ?? []).some((x: any) => x.source === "Wallet" && x.amount === 10));
  assert.equal(w.cancel, undefined);                          // wallet credit is instant: no pending refund
  const n = mk(); n.addonRequests = [req(n)];
  const on = approveAddonRequest(n, "r1", { resolution: "none", by: "Provider" });
  assert.equal(on.release?.amount, 0); assert.equal(n.cancel, undefined); assert.equal(n.addonLines.length, 1);
});

test("approve a CANCEL on an UNPAID booking: the extra just comes off what is owed", () => {
  const b = mk({ pay: "Unpaid", amountPaid: 0 }); b.addonRequests = [req(b)];
  const out = approveAddonRequest(b, "r1", { by: "Provider" });
  assert.equal(b.amount, 5); assert.equal(out.release, null); assert.equal(b.cancel, undefined);
});

test("a decision is final: approving twice, or after declining / withdrawing, is refused", () => {
  const b = mk(); b.addonRequests = [req(b)];
  approveAddonRequest(b, "r1", { resolution: "refund", by: "Provider" });
  assert.throws(() => approveAddonRequest(b, "r1", { resolution: "refund", by: "Provider" }), (e: any) => e.status === 409);
  const d = mk(); d.addonRequests = [req(d)];
  declineAddonRequest(d, "r1", "sorry, already ordered", "Provider");
  assert.equal(d.addonRequests[0].declineReason, "sorry, already ordered"); assert.equal(d.addonLines.length, 2);
  assert.throws(() => approveAddonRequest(d, "r1", { by: "Provider" }), (e: any) => e.status === 409);
  const w = mk(); w.addonRequests = [req(w)];
  withdrawAddonRequest(w, "r1");
  assert.throws(() => declineAddonRequest(w, "r1", "", "Provider"), (e: any) => e.status === 409);
  assert.equal(needsDecision(w), false);
});

test("approve a CHANGE with no price difference: the choice changes, no money moves", () => {
  const b = mk(); b.addonRequests = [req(b, { kind: "change", to: { size: "l" }, toLabel: "tshirty (size: l)", priceDiff: 0 })];
  const out = approveAddonRequest(b, "r1", { by: "Provider" });
  assert.equal(b.addonLines[0].label, "tshirty (size: l)"); assert.deepEqual(b.addonLines[0].answers, [{ label: "size", value: "l" }]);
  assert.equal(b.addons[0], "tshirty (size: l) — £10.00");
  assert.equal(out.release, null); assert.equal(b.amount, 15); assert.equal(b.pay, "Paid");
  assert.deepEqual(currentAnswers(b.addonLines[0]), { size: "l" });
});

test("approve a CHANGE with a price difference: the provider must choose; charging is never automatic", () => {
  const b = mk(); b.addonRequests = [req(b, { kind: "change", to: { size: "l" }, toLabel: "tshirty (size: l)", priceDiff: 2 })];
  assert.throws(() => approveAddonRequest(b, "r1", { by: "Provider" }), (e: any) => e.status === 400);
  const out = approveAddonRequest(b, "r1", { resolution: "charge", by: "Provider" });
  assert.equal(b.amount, 17); assert.equal(b.pay, "Partially paid"); assert.equal(b.addonLines[0].price, 12);
  assert.equal(out.request.money?.resolution, "charge"); assert.equal(out.request.money?.amount, 2);
  const waive = mk(); waive.addonRequests = [req(waive, { kind: "change", to: { size: "l" }, toLabel: "tshirty (size: l)", priceDiff: 2 })];
  approveAddonRequest(waive, "r1", { resolution: "waive", by: "Provider" });
  assert.equal(waive.amount, 15); assert.equal(waive.addonLines[0].price, 10); assert.equal(waive.pay, "Paid");
});

test("a request on a legacy line (no id, answers only in the label) still reads its current choice", () => {
  assert.deepEqual(currentAnswers({ child: "x", label: "tshirty (size: m, colour: red)", price: 10, days: [], perDay: false } as any), { size: "m", colour: "red" });
});

test("the kit-to-prepare list follows an APPROVED change (new size) and drops an APPROVED cancel, and marks a PENDING request", () => {
  const day = "2026-10-28";
  const b = mk({ days: [day], ref: "APF-1" });
  const g0 = kitForDay([b], day);
  assert.deepEqual(g0.map((g) => g.id).sort(), ["tshirty|m", "water bottle|red"]);
  // pending request on the t-shirt: still in the list, flagged
  b.addonRequests = [req(b, { kind: "change", to: { size: "l" }, toLabel: "tshirty (size: l)", priceDiff: 0 })];
  const pend = kitForDay([b], day).find((g) => g.id === "tshirty|m")!;
  assert.equal(pend.children[0].pending, "change");
  // approved: the item moves to size L (a new tick is needed) and the flag is gone
  approveAddonRequest(b, "r1", { by: "Provider" });
  const g1 = kitForDay([b], day);
  assert.ok(g1.find((g) => g.id === "tshirty|l")); assert.equal(g1.find((g) => g.id === "tshirty|m"), undefined);
  assert.equal(g1.find((g) => g.id === "tshirty|l")!.children[0].pending, undefined);
  // approved cancel of the bottle: gone from the kit list
  b.addonRequests.push(req(b, { id: "r2", key: addonLineKey("sally james", "water bottle (colour: red)"), label: "water bottle (colour: red)", price: 5 }));
  approveAddonRequest(b, "r2", { resolution: "none", by: "Provider" });
  assert.deepEqual(kitForDay([b], day).map((g) => g.id), ["tshirty|l"]);
});
