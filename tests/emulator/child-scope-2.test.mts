// Scope audit follow-ups (items 2-4) and the other child-data routes a Bookings-none/Registers-none staff role could reach.
//  2. GET /api/customers: a site-assigned staff member sees each family's children[] only for children at their site.
//  3. PUT /api/customers/:id as a franchise: the response narrows children[] like GET does.
//  4. PUT /api/children/:id as lead staff: the child must be on the lead's assigned site.
//  5. none/none staff are refused incidents (reads), medications, trips, the ratio board and the moments list - unless the role names the area.
// Real API + Firestore emulator. Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, ids, login, seedAddons } from "../../scripts/emu/addons-helpers.mts";

const u = () => Math.random().toString(36).slice(2, 7);
const N = { K1: `ScLK ${u()}`, K2: `ScLK2 ${u()}`, K3: `ScFL ${u()}` };
const id: Record<string, string> = {};
let custId = "";
const NAMED = "staff-sc-named@emu.test"; // none/none but names incidents, medication, trips, ratios, meals and moments (view)
const REGS = "staff-sc-regs@emu.test";   // Registers view

async function kid(key: keyof typeof N, listing: string) {
  const k = await as("A", "POST", "/api/my/children", { name: N[key], dob: "2017-05-06" });
  assert.ok(k.ok, JSON.stringify(k.json));
  id[key] = k.json.id;
  const b = await bookWithAddons({ parent: "A", listing, children: [{ name: N[key], days: [1] }] });
  assert.ok(b.ok, `${key}: ${JSON.stringify(b.json).slice(0, 300)}`);
}
async function mkStaff(email: string, role: string) {
  const I = ids();
  const s = await login(email);
  await (await adminDb()).collection("users").doc(s.uid).set({ email, role: "staff", chosen: true, tenantId: I.tenants.P, franchiseId: null, name: email, staffRole: role, permRole: role, assignment: { mode: "listings", ids: [I.listings.LK.id] } }, { merge: true });
}
const familyKids = (r: any): string[] => {
  const list: any[] = Array.isArray(r.json) ? r.json : [r.json];
  return list.filter((c) => c?.email === "parent-a@emu.test").flatMap((c) => (c.children ?? []).map((k: any) => k.name));
};

before(async () => {
  await seedAddons();
  await kid("K1", "LK"); await kid("K2", "LK2"); await kid("K3", "FL");
  const all = await as("P", "GET", "/api/customers");
  custId = all.json.find((c: any) => c.email === "parent-a@emu.test")?.id;
  assert.ok(custId, "family record exists");
  const lib = (await as("P", "GET", "/api/library")).json;
  const keep = (lib.settings?.roles ?? []).filter((r: any) => !["sc-named", "sc-regs"].includes(r.id));
  const named = { id: "sc-named", name: "SC named", caps: { bookings: "none", registers: "none", incidents: "view", medication: "view", trips: "view", ratios: "view", moments: "view" } };
  const regs = { id: "sc-regs", name: "SC regs", caps: { bookings: "none", registers: "view" } };
  assert.ok((await as("P", "PUT", "/api/library", { ...lib, settings: { ...lib.settings, roles: [...keep, named, regs] } })).ok);
  await mkStaff(NAMED, "sc-named"); await mkStaff(REGS, "sc-regs");
});

describe("2. GET /api/customers narrows each family's children to the caller's site", () => {
  it("S1 and S2 (site LK) see the LK child only", async () => {
    for (const who of ["S1", "S2"]) {
      const k = familyKids(await as(who, "GET", "/api/customers"));
      assert.ok(k.includes(N.K1), `${who} lost the LK child`);
      assert.ok(!k.includes(N.K2) && !k.includes(N.K3), `${who}: ${JSON.stringify(k)}`);
    }
  });
  it("S3 (site LK2) sees the LK2 child only", async () => {
    const k = familyKids(await as("S3", "GET", "/api/customers"));
    assert.ok(k.includes(N.K2));
    assert.ok(!k.includes(N.K1) && !k.includes(N.K3), JSON.stringify(k));
  });
  it("owner P still sees every child of the family at P", async () => {
    const k = familyKids(await as("P", "GET", "/api/customers"));
    for (const n of Object.values(N)) assert.ok(k.includes(n), `P lost ${n}`);
  });
  it("franchise F sees only its own child", async () => {
    const k = familyKids(await as("F", "GET", "/api/customers"));
    assert.ok(k.includes(N.K3));
    assert.ok(!k.includes(N.K1) && !k.includes(N.K2), JSON.stringify(k));
  });
});

describe("3. PUT /api/customers/:id as a franchise returns only its own children", () => {
  it("F's response lists K3 and not the head-office children", async () => {
    const r = await as("F", "PUT", `/api/customers/${custId}`, { notes: `franchise note ${u()}` });
    assert.equal(r.status, 200, JSON.stringify(r.json).slice(0, 200));
    const k = (r.json.children ?? []).map((c: any) => c.name);
    assert.ok(!k.includes(N.K1) && !k.includes(N.K2), JSON.stringify(k));
  });
  it("owner P's PUT still returns the whole family record", async () => {
    const r = await as("P", "PUT", `/api/customers/${custId}`, { notes: `owner note ${u()}` });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.json.children));
  });
});

describe("4. PUT /api/children/:id as lead staff needs the child on the lead's site", () => {
  it("S1 (lead on LK) cannot write care details of the LK2 child", async () => {
    const r = await as("S1", "PUT", `/api/children/${id.K2}`, { medical: "written by the wrong site" });
    assert.equal(r.status, 404, JSON.stringify(r.json));
    const doc = await (await adminDb()).collection("children").doc(id.K2).get();
    assert.notEqual(doc.get("medical"), "written by the wrong site");
  });
  it("S1 can still write care details of the LK child", async () => {
    const r = await as("S1", "PUT", `/api/children/${id.K1}`, { allergies: "dust" });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  });
  it("owner P can still write any child's care details; ordinary staff (S2) cannot", async () => {
    assert.equal((await as("P", "PUT", `/api/children/${id.K2}`, { allergies: "none known" })).status, 200);
    assert.equal((await as("S2", "PUT", `/api/children/${id.K1}`, { allergies: "x" })).status, 403);
  });
});

describe("5. none/none staff are refused the other child-data routes", () => {
  const reads = ["/api/incidents", "/api/medications", "/api/medications/administrations", "/api/trips", `/api/ratios/board/${new Date().toISOString().slice(0, 10)}`, "/api/moments"];
  for (const p of reads) {
    it(`S4 GET ${p} is 403`, async () => {
      const r = await as("S4", "GET", p);
      assert.equal(r.status, 403, `${p}: ${JSON.stringify(r.json).slice(0, 150)}`);
    });
  }
  it("S4 cannot dossier an incident or create/administer medication", async () => {
    const inc = await as("P", "POST", "/api/incidents", { kind: "accident", date: ids().generatedOn, childId: id.K1, childName: N.K1, description: "x" });
    assert.equal(inc.status, 201);
    assert.equal((await as("S4", "GET", `/api/incidents/${inc.json.id}/dossier`)).status, 403);
    const med = await as("S4", "POST", "/api/medications", { childId: id.K1, childName: N.K1, name: "M", dose: "1", consentGranted: true });
    assert.equal(med.status, 403, JSON.stringify(med.json).slice(0, 150));
  });
  it("S4 can still LOG an incident or accident (anyone working with children must be able to)", async () => {
    const r = await as("S4", "POST", "/api/incidents", { kind: "accident", date: ids().generatedOn, childName: "Walk-in child", description: "logged by S4" });
    assert.equal(r.status, 201, JSON.stringify(r.json).slice(0, 150));
  });
  it("a none/none role that NAMES the areas reads them", async () => {
    for (const p of reads) assert.equal((await as(NAMED, "GET", p)).status, 200, p);
  });
  it("Registers-view staff, staff with no matrix role (S1) and the owner read them", async () => {
    for (const who of [REGS, "S1", "P"]) for (const p of reads) assert.equal((await as(who, "GET", p)).status, 200, `${who} ${p}`);
  });
});
