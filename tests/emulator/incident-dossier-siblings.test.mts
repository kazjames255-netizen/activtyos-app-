// GET /api/incidents/:id/dossier listed the child's siblings (name, dob, age) from the PARENT'S whole account: children booked only
// with another provider, another franchise or another site showed up for anyone who could open the dossier (audit-scope finding 1).
// Siblings must pass the same visibility test as the child itself. Real API + Firestore emulator. Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, ids, seedAddons } from "../../scripts/emu/addons-helpers.mts";

const u = () => Math.random().toString(36).slice(2, 7);
const N = { K1: `SibLK ${u()}`, K2: `SibLK2 ${u()}`, K3: `SibFL ${u()}`, K4: `SibQL ${u()}` };
const id: Record<string, string> = {};
const inc: Record<string, string> = {};

async function kid(key: keyof typeof N, listing: string) {
  const k = await as("A", "POST", "/api/my/children", { name: N[key], dob: "2017-05-06" });
  assert.ok(k.ok, JSON.stringify(k.json));
  id[key] = k.json.id;
  const b = await bookWithAddons({ parent: "A", listing, children: [{ name: N[key], days: [1] }] });
  assert.ok(b.ok, `${key} booking: ${JSON.stringify(b.json).slice(0, 300)}`);
}
async function file(who: string, key: keyof typeof N, listing: string) {
  const r = await as(who, "POST", "/api/incidents", { kind: "accident", date: ids().generatedOn, childId: id[key], childName: N[key], listingId: ids().listings[listing].id, description: `dossier test ${key}` });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r.json.id as string;
}
const sib = (r: any): string[] => (r.json?.siblings ?? []).map((s: any) => s.name);

before(async () => {
  await seedAddons();
  await kid("K1", "LK"); await kid("K2", "LK2"); await kid("K3", "FL"); await kid("K4", "QL");
  inc.K1 = await file("P", "K1", "LK");
  inc.K3 = await file("F", "K3", "FL");
  inc.K4 = await file("Q", "K4", "QL");
  void adminDb;
});

describe("incident dossier: siblings follow the same visibility as the child", () => {
  it("owner P sees A's children booked with P (K2, K3) but never the child booked only with another provider (K4)", async () => {
    const r = await as("P", "GET", `/api/incidents/${inc.K1}/dossier`);
    assert.equal(r.status, 200);
    const s = sib(r);
    assert.ok(s.includes(N.K2) && s.includes(N.K3), JSON.stringify(s));
    assert.ok(!s.includes(N.K4), "another provider's child leaked");
  });
  it("other provider Q sees none of P's children as siblings of its own child", async () => {
    const r = await as("Q", "GET", `/api/incidents/${inc.K4}/dossier`);
    assert.equal(r.status, 200);
    assert.deepEqual(sib(r), []);
    const s = JSON.stringify(r.json);
    for (const k of ["K1", "K2", "K3"]) assert.ok(!s.includes(N[k as keyof typeof N]), `${k} leaked to Q`);
  });
  it("franchise F sees no head-office or other-site siblings of its child", async () => {
    const r = await as("F", "GET", `/api/incidents/${inc.K3}/dossier`);
    assert.equal(r.status, 200);
    const s = sib(r);
    assert.ok(!s.includes(N.K1) && !s.includes(N.K2) && !s.includes(N.K4), JSON.stringify(s));
  });
  it("site staff on LK (S1 lead, S2) see no sibling booked on another site or in the franchise", async () => {
    for (const who of ["S1", "S2"]) {
      const r = await as(who, "GET", `/api/incidents/${inc.K1}/dossier`);
      assert.equal(r.status, 200, who);
      const s = sib(r);
      assert.ok(!s.includes(N.K2) && !s.includes(N.K3) && !s.includes(N.K4), `${who}: ${JSON.stringify(s)}`);
    }
  });
  it("franchise staff SF sees no sibling outside the franchise", async () => {
    const r = await as("SF", "GET", `/api/incidents/${inc.K3}/dossier`);
    assert.ok(r.status === 200 || r.status === 403, String(r.status));
    const s = sib(r);
    assert.ok(!s.includes(N.K1) && !s.includes(N.K2) && !s.includes(N.K4), JSON.stringify(s));
  });
  it("the child, parent contact and history are unchanged for the owner", async () => {
    const r = await as("P", "GET", `/api/incidents/${inc.K1}/dossier`);
    assert.equal(r.json.child?.name, N.K1);
    assert.ok(r.json.parent?.email);
    assert.ok(Array.isArray(r.json.bookings));
  });
});
