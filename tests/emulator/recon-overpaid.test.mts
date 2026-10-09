// Reconciliation "Overpaid": money already handed back (wallet credit, pending/approved refund) must NOT show as overpaid / to give back.
// Reproduces booking APF-10342: 2 days at 1 pound, 2 pounds recorded as received in cash, the provider cancels ONE day with the refund as wallet
// credit -> the Refunds list shows 1 pound, the booking costs 1 pound, and the ledger row must be neither "overpaid" nor in the summary.
// Real API + Firestore emulator (npm run test:emu). Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { call, db, makeParent, makeProvider, ok, operatorAction, uniq, type Parent, type Provider } from "./helpers.mts";

let P: Provider;
let listingId = "";
let blockId = "";
let dates: string[] = [];

before(async () => {
  P = await makeProvider("RO");
  const lib = (await ok("GET", "/api/library", P.token)) ?? {};
  const venues: any[] = lib.venues ?? [];
  if (!venues.some((v) => v.id === "emu-venue")) venues.push({ id: "emu-venue", name: "Test Sports Hall", address: "1 Test Way", city: "Testville" });
  await ok("PUT", "/api/library", P.token, { venues, addons: lib.addons ?? [], settings: { ...(lib.settings ?? {}), marketplaceListed: true, allowPartialCancel: true, partialAllowWallet: true, partialAllowRefund: true } });
  const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7) + 21);
  const end = new Date(start); end.setDate(end.getDate() + 27);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const period = await ok("POST", "/api/periods", P.token, { title: "Full day", start: "09:00", finish: "15:30" });
  const pass = await ok("POST", "/api/passes", P.token, { name: "Pair pass", days: 2 });
  const bundle = await ok("POST", "/api/block-bundles", P.token, { name: `Recon block ${uniq()}`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 2, calcOn: true });
  const listing = await ok("POST", "/api/listings", P.token, {
    title: `Recon camp ${uniq()}`, venueId: "emu-venue", runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5],
    maxAttendees: "5000", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id,
    passes: [{ name: "Pair pass", price: 2, days: 2 }], bookingType: "auto", status: "live", visibility: "public",
  });
  await ok("PUT", `/api/block-bundles/${bundle.id}/listings`, P.token, { listingIds: [listing.id] });
  const blocks = await db.collection("blocks").where("listingId", "==", listing.id).get();
  listingId = listing.id; blockId = blocks.docs[0].id;
  dates = (blocks.docs[0].data().sessions as { date: string }[]).map((s) => s.date).sort().slice(0, 2);
  assert.equal(dates.length, 2);
});

async function cashBooking(): Promise<{ ref: string; parent: Parent }> {
  const parent = await makeParent("RO", P);
  const r = await call("POST", "/api/my/bookings", parent.token, { listingId, blockId, method: "Cash", items: [{ pass: "Pair pass", child: `Kid ${uniq()}`, age: 8, dates }] });
  assert.ok(r.status < 300, `book -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  const list = Array.isArray(r.json) ? r.json : (r.json?.bookings ?? [r.json]);
  const ref = (list[0]?.ref ?? list[0]?.booking?.ref) as string;
  const pay = await call("POST", `/api/bookings/${encodeURIComponent(ref)}/record-payment`, P.token, { amount: 2, method: "Cash" });
  assert.ok(pay.status < 300, `pay -> ${pay.status} ${JSON.stringify(pay.json).slice(0, 300)}`);
  return { ref, parent };
}
const recon = async (ref: string) => {
  const r = await call("GET", "/api/reconciliation", P.token);
  assert.equal(r.status, 200);
  return { item: (r.json.items as any[]).find((i) => i.ref === ref), summary: r.json.summary };
};
const overpaidTotal = (summary: any) => summary.overpaid?.total ?? 0;

describe("Reconciliation overpaid ignores money already handed back", () => {
  it("cash 2, provider cancels one day with a wallet-credit refund: not overpaid, not in the 'hand back' summary", async () => {
    const { ref } = await cashBooking();
    const before = await recon(ref);
    assert.equal(before.item.amountPaid, 2);
    const cancel = await operatorAction(P, ref, { type: "cancel-day", ki: 0, date: dates[1], resolution: "wallet" });
    assert.equal(cancel.status, 200, JSON.stringify(cancel.json).slice(0, 300));
    const after = await recon(ref);
    assert.equal(after.item.amount, 1, "the booking now costs 1");
    assert.equal(after.item.refundedAmount, 1, "the refund is on the booking");
    assert.equal(after.item.overpaid, 0, "already handed back as wallet credit -> not overpaid");
    assert.equal(after.item.outstanding, 0);
    assert.equal(overpaidTotal(after.summary) >= 1 && after.item.overpaid > 0, false);
  });
  it("cash 2, cancel one day with a refund still pending: not overpaid either", async () => {
    const { ref } = await cashBooking();
    const cancel = await operatorAction(P, ref, { type: "cancel-day", ki: 0, date: dates[1], resolution: "refund" });
    assert.equal(cancel.status, 200, JSON.stringify(cancel.json).slice(0, 300));
    const after = await recon(ref);
    assert.equal(after.item.overpaid, 0, "a requested refund is handled (the Refunds-to-send list tracks it)");
  });
  it("cash 2 price 1, nothing handed back: still overpaid by 1", async () => {
    const { ref } = await cashBooking();
    const cancel = await operatorAction(P, ref, { type: "cancel-day", ki: 0, date: dates[1], resolution: "none" });
    assert.equal(cancel.status, 200, JSON.stringify(cancel.json).slice(0, 300));
    const after = await recon(ref);
    assert.equal(after.item.overpaid, 1);
    assert.ok(overpaidTotal(after.summary) >= 1);
  });
});
