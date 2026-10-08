// GET /api/incidents/:id/dossier matched bookings (and so the parent's contact details) by child NAME across the whole tenant, and ignored
// the site scope the incident list applies: a site lead at LK saw LK2 bookings and another family's booker email, and staff at LK2 could
// open an LK incident's dossier by id. The dossier must follow the list: 404 for an incident outside the caller's scope; bookings matched
// by childId, restricted to the caller's visible sites. Real API + Firestore emulator. Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { as, bookWithAddons, ids, seedAddons } from "../../scripts/emu/addons-helpers.mts";

const u = () => Math.random().toString(36).slice(2, 7);
const NAME = `DosLK ${u()}`;     // A's child, booked at LK (and also at LK2 for the same-child case)
const ONLY2 = `DosLK2 ${u()}`;   // A's child booked ONLY at LK2
const ONLYLK = `DosOnlyLK ${u()}`; // A's child booked ONLY at LK
const inc: Record<string, string> = {};
let LKT = "", LK2T = "";
const B_EMAIL = "parent-b@emu.test";

const emails = (r: any): string[] => (r.json?.bookings ?? []).map((b: any) => String(b.email ?? "").toLowerCase());
const titles = (r: any): string[] => (r.json?.bookings ?? []).map((b: any) => String(b.listing));

before(async () => {
  await seedAddons();
  LKT = ids().listings.LK.title; LK2T = ids().listings.LK2.title;
  // A's child at LK, and the SAME child (same childId) also at LK2.
  const k = await as("A", "POST", "/api/my/children", { name: NAME, dob: "2017-05-06" });
  assert.ok(k.ok, JSON.stringify(k.json));
  assert.ok((await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: NAME, days: [1] }] })).ok);
  assert.ok((await bookWithAddons({ parent: "A", listing: "LK2", children: [{ name: NAME, days: [1] }] })).ok);
  // A child of ANOTHER family (parent B) with the very same name, booked at LK2.
  const kb = await as("B", "POST", "/api/my/children", { name: NAME, dob: "2016-01-02" });
  assert.ok(kb.ok, JSON.stringify(kb.json));
  assert.ok((await bookWithAddons({ parent: "B", listing: "LK2", children: [{ name: NAME, days: [1] }] })).ok);
  // A's second child, only at LK2.
  const k2 = await as("A", "POST", "/api/my/children", { name: ONLY2, dob: "2015-03-04" });
  assert.ok(k2.ok, JSON.stringify(k2.json));
  assert.ok((await bookWithAddons({ parent: "A", listing: "LK2", children: [{ name: ONLY2, days: [1] }] })).ok);

  const k3 = await as("A", "POST", "/api/my/children", { name: ONLYLK, dob: "2014-05-06" });
  assert.ok(k3.ok, JSON.stringify(k3.json));
  assert.ok((await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: ONLYLK, days: [1] }] })).ok);

  const mk = async (who: string, name: string, listing: string, childId?: string) => {
    const r = await as(who, "POST", "/api/incidents", { kind: "accident", date: ids().generatedOn, ...(childId ? { childId } : {}), childName: name, listingId: ids().listings[listing].id, description: `dossier scope ${name}` });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    return r.json.id as string;
  };
  inc.LK = await mk("P", NAME, "LK", k.json.id);
  inc.LK2 = await mk("P", ONLY2, "LK2", k2.json.id);
  inc.ONLYLK = await mk("P", ONLYLK, "LK", k3.json.id);
});

describe("incident dossier: bookings by childId, scoped like the incident list", () => {
  it("owner P: the child's own bookings (LK and LK2, same childId) - never the other family's same-named child", async () => {
    const r = await as("P", "GET", `/api/incidents/${inc.LK}/dossier`);
    assert.equal(r.status, 200);
    assert.ok(titles(r).includes(LKT) && titles(r).includes(LK2T), JSON.stringify(titles(r)));
    assert.ok(!emails(r).includes(B_EMAIL), `other family's booker email leaked: ${JSON.stringify(emails(r))}`);
    assert.ok(emails(r).every((e) => e === "parent-a@emu.test"), JSON.stringify(emails(r)));
    assert.notEqual(r.json.parent?.email, B_EMAIL);
  });
  it("S1 (lead) and S2 at site LK: only the LK booking, no LK2 booking, no other family's email", async () => {
    for (const who of ["S1", "S2"]) {
      const r = await as(who, "GET", `/api/incidents/${inc.LK}/dossier`);
      assert.equal(r.status, 200, who);
      assert.deepEqual(titles(r), [LKT], `${who}: ${JSON.stringify(titles(r))}`);
      assert.ok(!JSON.stringify(r.json).includes(B_EMAIL), `${who} saw another family's email`);
    }
  });
  it("S3 (site LK2) cannot open an LK incident's dossier by id: 404", async () => {
    const r = await as("S3", "GET", `/api/incidents/${inc.ONLYLK}/dossier`);
    assert.equal(r.status, 404, JSON.stringify(r.json).slice(0, 200));
  });
  it("S1/S2 (site LK) cannot open an LK2-only child's incident dossier: 404", async () => {
    for (const who of ["S1", "S2"]) {
      const r = await as(who, "GET", `/api/incidents/${inc.LK2}/dossier`);
      assert.equal(r.status, 404, `${who}: ${r.status}`);
    }
  });
  it("S3 still opens the dossier of an incident at ITS site", async () => {
    const r = await as("S3", "GET", `/api/incidents/${inc.LK2}/dossier`);
    assert.equal(r.status, 200);
    assert.deepEqual(titles(r), [LK2T]);
  });
  it("franchise F and franchise staff SF: still refused for head-office incidents", async () => {
    for (const who of ["F", "SF"]) assert.equal((await as(who, "GET", `/api/incidents/${inc.LK}/dossier`)).status, 404, who);
  });
  it("the incident list agrees: S3 does not list the LK incident either", async () => {
    const list = (await as("S3", "GET", "/api/incidents")).json as any[];
    assert.ok(!list.some((x) => x.id === inc.ONLYLK));
  });
});
