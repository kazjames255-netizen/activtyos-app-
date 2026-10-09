// Child / family data follows the role matrix (verifier finding R04/R04d/R06b, 8 Oct): a staff member whose role has
// Bookings: none AND Registers: none must not read children, parent contact details or the medical note off
// GET /api/children/lookup, GET /api/children/:id or GET /api/moments/taggable (they sit under the "medical" and "moments" areas,
// which that role does not name, so "silent = edit" let them through). Real API + Firestore emulator (npm run test:emu). Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, ids, login, seedAddons } from "../../scripts/emu/addons-helpers.mts";

const u = () => Math.random().toString(36).slice(2, 7);
const MED = `MEDSECRET-${u()}`;
const KID = `ScopeKid ${u()}`;
const PARENT_MAIL = "parent-a@emu.test";
const REGS = "staff-cs-regs@emu.test";      // Registers: view, Bookings: none
const BOOKS = "staff-cs-books@emu.test";    // Bookings: view, Registers: none
const MEDNAMED = "staff-cs-med@emu.test";   // Bookings none, Registers none, but Medical records named explicitly (view)
const MOMNAMED = "staff-cs-mom@emu.test";   // Bookings none, Registers none, Moments named explicitly (edit)
const FLIP = "staff-cs-flip@emu.test";      // role flipped mid-run
let childId = "";

async function setRoles(extra: { id: string; name: string; caps: Record<string, string> }[]) {
  const lib = (await as("P", "GET", "/api/library")).json;
  const keep = (lib.settings?.roles ?? []).filter((r: any) => !extra.some((e) => e.id === r.id));
  const r = await as("P", "PUT", "/api/library", { ...lib, settings: { ...lib.settings, roles: [...keep, ...extra] } });
  assert.ok(r.ok, JSON.stringify(r.json));
}
async function mkStaff(email: string, role: string) {
  const I = ids();
  const s = await login(email);
  await (await adminDb()).collection("users").doc(s.uid).set({ email, role: "staff", chosen: true, tenantId: I.tenants.P, franchiseId: null, name: email, staffRole: role, permRole: role, assignment: { mode: "listings", ids: [I.listings.LK.id] } }, { merge: true });
}

before(async () => {
  await seedAddons();
  const I = ids();
  assert.ok((await as("A", "POST", "/api/my/children", { name: KID, dob: "2018-03-04" })).ok);
  const b = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: KID, days: "all" }] });
  assert.ok(b.ok, JSON.stringify(b.json));
  const db = await adminDb();
  const bk = await db.collection("bookings").where("ref", "==", b.refs[0]).get();
  childId = bk.docs[0].get("childId");
  assert.ok(childId, "the booking carries a child record");
  await db.collection("children").doc(childId).set({ medical: MED, allergies: "peanuts", emergencyName: "Em Contact", emergencyPhone: "07000000001" }, { merge: true });
  await setRoles([
    { id: "cs-regs", name: "CS registers only", caps: { bookings: "none", registers: "view" } },
    { id: "cs-books", name: "CS bookings only", caps: { bookings: "view", registers: "none" } },
    { id: "cs-med", name: "CS medical named", caps: { bookings: "none", registers: "none", medical: "view" } },
    { id: "cs-mom", name: "CS moments named", caps: { bookings: "none", registers: "none", moments: "edit" } },
    { id: "cs-flip", name: "CS flip", caps: { bookings: "none", registers: "none" } },
  ]);
  for (const [e, r] of [[REGS, "cs-regs"], [BOOKS, "cs-books"], [MEDNAMED, "cs-med"], [MOMNAMED, "cs-mom"], [FLIP, "cs-flip"]]) await mkStaff(e, r);
  void I;
});

const leaks = (v: unknown) => { const s = JSON.stringify(v) ?? ""; return [MED, PARENT_MAIL, "07000000001", KID].filter((t) => s.includes(t)); };

describe("none/none staff (S4) is refused the child and family routes, with no data", () => {
  it("GET /api/children/lookup", async () => {
    const r = await as("S4", "GET", "/api/children/lookup");
    assert.equal(r.status, 403, JSON.stringify(r.json).slice(0, 200));
    assert.deepEqual(leaks(r.json), []);
    assert.equal(r.json.code, "no_access");
  });
  it("GET /api/children/lookup?q= (search form)", async () => {
    const r = await as("S4", "GET", `/api/children/lookup?q=${encodeURIComponent(KID)}`);
    assert.equal(r.status, 403);
    assert.deepEqual(leaks(r.json), []);
  });
  it("GET /api/children/:id (the full card with the medical note)", async () => {
    const r = await as("S4", "GET", `/api/children/${childId}`);
    assert.equal(r.status, 403, JSON.stringify(r.json).slice(0, 200));
    assert.deepEqual(leaks(r.json), []);
  });
  it("GET /api/moments/taggable (children with parent name, email, postcode)", async () => {
    const r = await as("S4", "GET", "/api/moments/taggable");
    assert.equal(r.status, 403, JSON.stringify(r.json).slice(0, 200));
    assert.deepEqual(leaks(r.json), []);
  });
  it("PUT /api/children/:id stays refused", async () => {
    const r = await as("S4", "PUT", `/api/children/${childId}`, { medical: "changed" });
    assert.ok(r.status === 403 || r.status === 404, `got ${r.status}`);
  });
});

describe("staff whose role grants Registers or Bookings still get what they need", () => {
  for (const [who, label] of [[REGS, "Registers view"], [BOOKS, "Bookings view"], ["S1", "no matrix role (unrestricted)"], ["S2", "no matrix role (unrestricted)"]] as const) {
    it(`${label}: lookup, the child card and taggable answer 200 with the child`, async () => {
      const l = await as(who, "GET", "/api/children/lookup");
      assert.equal(l.status, 200, `${who} lookup`);
      assert.ok(JSON.stringify(l.json).includes(KID));
      const c = await as(who, "GET", `/api/children/${childId}`);
      assert.equal(c.status, 200, `${who} card`);
      assert.equal(c.json.record.medical, MED);
      const t = await as(who, "GET", "/api/moments/taggable");
      assert.equal(t.status, 200, `${who} taggable`);
      assert.ok(JSON.stringify(t.json).includes(KID));
    });
  }
  it("a role that NAMES Medical records (view) reads the child card even with Bookings and Registers none", async () => {
    assert.equal((await as(MEDNAMED, "GET", `/api/children/${childId}`)).status, 200);
    assert.equal((await as(MEDNAMED, "GET", "/api/children/lookup")).status, 200);
  });
  it("a role that NAMES Moments reads the taggable list, but is still refused the child card", async () => {
    assert.equal((await as(MOMNAMED, "GET", "/api/moments/taggable")).status, 200);
    assert.equal((await as(MOMNAMED, "GET", `/api/children/${childId}`)).status, 403);
  });
  it("another site's staff (S3) stays scoped: no LK child", async () => {
    const r = await as("S3", "GET", `/api/children/${childId}`);
    assert.equal(r.status, 404);
  });
});

describe("owners, franchise, HQ and parents are unchanged", () => {
  it("owner P: lookup, card, taggable all 200", async () => {
    assert.equal((await as("P", "GET", "/api/children/lookup")).status, 200);
    const c = await as("P", "GET", `/api/children/${childId}`);
    assert.equal(c.status, 200);
    assert.equal(c.json.record.medical, MED);
    assert.equal((await as("P", "GET", "/api/moments/taggable")).status, 200);
  });
  it("franchise F and its staff SF: 200 on lookup, but never see the head-office LK child", async () => {
    for (const who of ["F", "SF"]) {
      const l = await as(who, "GET", "/api/children/lookup");
      assert.equal(l.status, 200, who);
      assert.ok(!JSON.stringify(l.json).includes(KID), `${who} saw another site's child`);
      assert.equal((await as(who, "GET", "/api/moments/taggable")).status, 200, who);
      assert.ok([403, 404].includes((await as(who, "GET", `/api/children/${childId}`)).status), who);
    }
  });
  it("another provider (Q) cannot open P's child", async () => {
    assert.equal((await as("Q", "GET", `/api/children/${childId}`)).status, 404);
  });
  it("HQ (platform) answers the lookup the same way it did before (no 5xx, no change to its own status)", async () => {
    const r = await as("HQ", "GET", "/api/children/lookup");
    assert.ok(r.status < 500);
  });
  it("parent A still reads their own child, medical note included, and is refused the operator lookup", async () => {
    const mine = await as("A", "GET", "/api/my/children");
    assert.equal(mine.status, 200);
    const kid = mine.json.find((k: any) => k.id === childId);
    assert.ok(kid, "own child listed");
    assert.equal(kid.medical, MED);
    assert.equal((await as("A", "GET", "/api/children/lookup")).status, 403);
    assert.equal((await as("A", "GET", `/api/children/${childId}`)).status, 403);
  });
  it("parent B cannot see A's child", async () => {
    const mine = await as("B", "GET", "/api/my/children");
    assert.ok(!JSON.stringify(mine.json).includes(KID));
  });
});

describe("a role changed mid-run takes effect on the next request", () => {
  it("none/none -> Registers view -> none/none", async () => {
    const roleOf = (caps: Record<string, string>) => setRoles([{ id: "cs-flip", name: "CS flip", caps }]);
    await roleOf({ bookings: "none", registers: "none" });
    assert.equal((await as(FLIP, "GET", `/api/children/${childId}`)).status, 403);
    await roleOf({ bookings: "none", registers: "view" });
    assert.equal((await as(FLIP, "GET", `/api/children/${childId}`)).status, 200);
    assert.equal((await as(FLIP, "GET", "/api/moments/taggable")).status, 200);
    await roleOf({ bookings: "none", registers: "none" });
    const r = await as(FLIP, "GET", `/api/children/${childId}`);
    assert.equal(r.status, 403);
    assert.deepEqual(leaks(r.json), []);
    assert.equal((await as(FLIP, "GET", "/api/moments/taggable")).status, 403);
  });
});
