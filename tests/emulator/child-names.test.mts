// Child-data scope, name-matching leftovers.
//  (a) B15: site-staff / franchise narrowing of a family's children[] was by child NAME, so a same-named child of ANOTHER family
//      (booked at the caller's site) made this family's same-named child at a hidden site show. Narrow by child id.
//  (b) B16b: a franchise editing a family in Families saves the narrowed children[] it was shown; PUT replaced the stored list, wiping the
//      children at other sites/franchises. PUT must merge: only children the caller can see are touched.
//  (c) GET /api/ratios?date= and GET /api/meals?date= return child names and allergies: a none/none staff role (Bookings none,
//      Registers none) is refused unless its role names ratios / meals itself. Bookings / Registers staff are unaffected.
// Real API + Firestore emulator. Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, ids, login, seedAddons } from "../../scripts/emu/addons-helpers.mts";

const u = () => Math.random().toString(36).slice(2, 7);
const SAME = `Same ${u()}`;       // A's child at LK2 (hidden from S1), and B's child at LK (visible to S1)
const A_LK = `ALk ${u()}`;        // A's child at LK
const SAMEF = `SameF ${u()}`;     // A's child at LK (head office), and B's child at FL (visible to franchise F)
const A_FL = `AFl ${u()}`;        // A's child at FL
const A_EMAIL = "parent-a@emu.test", B_EMAIL = "parent-b@emu.test";
let custA = "";

async function kid(parent: string, name: string, listing: string) {
  const k = await as(parent, "POST", "/api/my/children", { name, dob: "2016-05-06" });
  assert.ok(k.ok, JSON.stringify(k.json));
  const b = await bookWithAddons({ parent, listing, children: [{ name, days: [1] }] });
  assert.ok(b.ok, `${name}: ${JSON.stringify(b.json).slice(0, 300)}`);
}
const kidsOf = (r: any, email: string): string[] => {
  const list: any[] = Array.isArray(r.json) ? r.json : [r.json];
  return list.filter((c) => c?.email === email).flatMap((c) => (c.children ?? []).map((k: any) => k.name));
};
async function mkStaff(email: string, role: string) {
  const I = ids();
  const s = await login(email);
  await (await adminDb()).collection("users").doc(s.uid).set({ email, role: "staff", chosen: true, tenantId: I.tenants.P, franchiseId: null, name: email, staffRole: role, permRole: role, assignment: { mode: "listings", ids: [I.listings.LK.id] } }, { merge: true });
}
const NN = "staff-cn-none@emu.test", NAMED = "staff-cn-named@emu.test", REGS = "staff-cn-regs@emu.test", BOOKS = "staff-cn-books@emu.test";

before(async () => {
  await seedAddons();
  await kid("A", A_LK, "LK"); await kid("A", SAME, "LK2"); await kid("B", SAME, "LK");
  await kid("A", A_FL, "FL"); await kid("A", SAMEF, "LK"); await kid("B", SAMEF, "FL");
  const all = await as("P", "GET", "/api/customers");
  custA = all.json.find((c: any) => c.email === A_EMAIL)?.id;
  assert.ok(custA, "family A record exists");
  const lib = (await as("P", "GET", "/api/library")).json;
  const mine = ["cn-none", "cn-named", "cn-regs", "cn-books"];
  const keep = (lib.settings?.roles ?? []).filter((r: any) => !mine.includes(r.id));
  const roles = [
    { id: "cn-none", name: "CN none", caps: { bookings: "none", registers: "none" } },
    { id: "cn-named", name: "CN named", caps: { bookings: "none", registers: "none", ratios: "view", meals: "view" } },
    { id: "cn-regs", name: "CN regs", caps: { bookings: "none", registers: "view" } },
    { id: "cn-books", name: "CN books", caps: { bookings: "view", registers: "none" } },
  ];
  assert.ok((await as("P", "PUT", "/api/library", { ...lib, settings: { ...lib.settings, roles: [...keep, ...roles] } })).ok);
  await mkStaff(NN, "cn-none"); await mkStaff(NAMED, "cn-named"); await mkStaff(REGS, "cn-regs"); await mkStaff(BOOKS, "cn-books");
});

describe("a. family children[] are narrowed by child id, not name", () => {
  it("S1 (site LK) sees A's LK child but NOT A's same-named child at LK2 (B's same-named child at LK is B's)", async () => {
    for (const who of ["S1", "S2"]) {
      const r = await as(who, "GET", "/api/customers");
      const a = kidsOf(r, A_EMAIL), b = kidsOf(r, B_EMAIL);
      assert.ok(a.includes(A_LK), `${who} lost A's LK child: ${JSON.stringify(a)}`);
      assert.ok(!a.includes(SAME), `${who}: A's same-named child at LK2 leaked: ${JSON.stringify(a)}`);
      assert.ok(b.includes(SAME), `${who}: B's own child vanished: ${JSON.stringify(b)}`);
    }
  });
  it("franchise F sees A's FL child but NOT A's same-named child at head office", async () => {
    const a = kidsOf(await as("F", "GET", "/api/customers"), A_EMAIL);
    assert.ok(a.includes(A_FL), JSON.stringify(a));
    assert.ok(!a.includes(SAMEF), `A's head-office child leaked to the franchise: ${JSON.stringify(a)}`);
  });
  it("owner P still sees every child of A", async () => {
    const a = kidsOf(await as("P", "GET", "/api/customers"), A_EMAIL);
    for (const n of [A_LK, SAME, A_FL, SAMEF]) assert.ok(a.includes(n), `P lost ${n}: ${JSON.stringify(a)}`);
  });
});

describe("b. a franchise editing a family does not wipe the children it cannot see", () => {
  it("F saves the narrowed list (edits the FL child): P still has every child", async () => {
    const seen = (await as("F", "GET", "/api/customers")).json.find((c: any) => c.email === A_EMAIL);
    assert.ok(seen, "F sees family A");
    const children = (seen.children as any[]).map((k) => (k.name === A_FL ? { ...k, age: 7 } : k));
    const put = await as("F", "PUT", `/api/customers/${custA}`, { children });
    assert.equal(put.status, 200, JSON.stringify(put.json).slice(0, 300));
    assert.ok(!(put.json.children ?? []).some((k: any) => k.name === A_LK || k.name === SAMEF), "the PUT response leaked a hidden child");
    const p = kidsOf(await as("P", "GET", "/api/customers"), A_EMAIL);
    for (const n of [A_LK, SAME, A_FL, SAMEF]) assert.ok(p.includes(n), `F's save wiped ${n}: ${JSON.stringify(p)}`);
    const stored = (await (await adminDb()).collection("customers").doc(custA).get()).data()!;
    assert.ok((stored.children as any[]).some((k) => k.name === A_FL && k.age === 7), "F's edit was not saved");
  });
  it("F removes the FL child it can see: only that child goes", async () => {
    const put = await as("F", "PUT", `/api/customers/${custA}`, { children: [] });
    assert.equal(put.status, 200, JSON.stringify(put.json).slice(0, 300));
    const stored = ((await (await adminDb()).collection("customers").doc(custA).get()).data()!.children as any[]).map((k) => k.name);
    assert.ok(!stored.includes(A_FL), `the removed FL child is still stored: ${JSON.stringify(stored)}`);
    for (const n of [A_LK, SAME, SAMEF]) assert.ok(stored.includes(n), `${n} was wiped by a franchise save: ${JSON.stringify(stored)}`);
  });
  it("the owner still replaces the whole list as before", async () => {
    const put = await as("P", "PUT", `/api/customers/${custA}`, { children: [{ name: A_LK }] });
    assert.equal(put.status, 200);
    const stored = ((await (await adminDb()).collection("customers").doc(custA).get()).data()!.children as any[]).map((k) => k.name);
    assert.deepEqual(stored, [A_LK]);
  });
});

describe("c. ratios / meals day boards follow the family-read rule", () => {
  const D = () => ids().d1;
  for (const [what, path] of [["ratios", "/api/ratios?date="], ["meals", "/api/meals?date="]] as const) {
    it(`none/none staff is refused GET ${what}`, async () => {
      const r = await as(NN, "GET", `${path}${D()}`);
      assert.equal(r.status, 403, JSON.stringify(r.json).slice(0, 200));
    });
    it(`a role naming ${what} (view) is allowed GET ${what}`, async () => {
      assert.equal((await as(NAMED, "GET", `${path}${D()}`)).status, 200);
    });
    it(`Registers staff, Bookings staff, plain site staff, owner and franchise are unaffected on GET ${what}`, async () => {
      for (const who of [REGS, BOOKS, "S1", "S2", "S3", "P", "F"]) {
        const r = await as(who, "GET", `${path}${D()}`);
        assert.equal(r.status, 200, `${who}: ${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
      }
    });
  }
});
