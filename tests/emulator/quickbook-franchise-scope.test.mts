// Behaviour tests: X-QB-FRANCHISE-SCOPE. A franchise (and its staff) may Quick book / Take booking (POST /api/my/bookings with onBehalfOf)
// ONLY on listings its own franchise owns. A head-office listing is refused with a clear 403 and creates nothing (before the fix it returned 201
// and made a booking the franchise could not see). Head office is unaffected and may still book on any listing of the company.
// Real API + Firestore emulator (npm run test:emu). Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { adminDb, as, day, ids, seedAddons } from "../../scripts/emu/addons-helpers.mts";

const u = () => Math.random().toString(36).slice(2, 7);

function quickBody(listing: string) {
  const I = ids();
  const l = I.listings[listing];
  const dates = [day(1, listing)];
  return { listingId: l.id, blockId: l.blockId, method: "Cash", onBehalfOf: { name: `Fam ${u()}`, email: `qbfs-${u()}@emu.test` }, items: [{ pass: "1-day pass", child: `Kid${u()}`, age: 8, dates }] };
}
const countFor = async (email: string) => (await (await adminDb()).collection("bookings").where("email", "==", email).get()).size;

before(async () => { await seedAddons(); });

describe("quick book on behalf: franchise scope", () => {
  it("franchise F is refused on a head-office listing (403, clear message, nothing created)", async () => {
    const body = quickBody("LK");
    const r = await as("F", "POST", "/api/my/bookings", body);
    assert.equal(r.status, 403, JSON.stringify(r.json));
    assert.match(String(r.json?.error), /own listings/i);
    assert.equal(await countFor(body.onBehalfOf.email), 0, "no booking written");
  });
  it("franchise staff SF are refused on a head-office listing too", async () => {
    const r = await as("SF", "POST", "/api/my/bookings", quickBody("LK"));
    assert.equal(r.status, 403, JSON.stringify(r.json));
  });
  it("franchise F still books on its OWN listing, and sees the booking", async () => {
    const body = quickBody("FL");
    const r = await as("F", "POST", "/api/my/bookings", body);
    assert.ok([200, 201].includes(r.status), JSON.stringify(r.json));
    assert.equal(await countFor(body.onBehalfOf.email), 1);
    const list = await as("F", "GET", "/api/bookings");
    assert.ok(JSON.stringify(list.json).includes(body.onBehalfOf.email), "the franchise sees what it booked");
  });
  it("head office P can still quick-book on a head-office listing", async () => {
    const r = await as("P", "POST", "/api/my/bookings", quickBody("LK"));
    assert.ok([200, 201].includes(r.status), JSON.stringify(r.json));
  });
});
