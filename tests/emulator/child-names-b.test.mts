// Follow-ups to child-names.test.mts (verifier findings).
//  P7. A franchise PUT /api/customers/:id on a family it does not own must never touch a child it cannot see - not even by sending an entry
//      with the same NAME (tidyChildren used to merge it into the hidden child, replacing age / dob / SEND plan). Hidden children are kept
//      byte-for-byte (the entry may only differ by NOT carrying a dob, or carrying the same one - tidyChildren merged those); an entry that only matches a hidden child by name is added as a new id-less entry.
//  B3w. The family-read rule covered READS only: none/none staff could still WRITE the ratio board, trips, meals and moments, and read
//      meal orders (child names). Same rule for every method on those areas (incidents stay open for logging).
// Real API + Firestore emulator. Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, ids, login, seedAddons } from "../../scripts/emu/addons-helpers.mts";

const u = () => Math.random().toString(36).slice(2, 7);
const HIDDEN = `Hid ${u()}`;   // A's child at head office (LK): the franchise cannot see it
const SEEN = `Seen ${u()}`;    // A's child at the franchise (FL)
const A_EMAIL = "parent-a@emu.test";
let custA = "";
const NN = "staff-cnb-none@emu.test", NAMED = "staff-cnb-named@emu.test", REGS = "staff-cnb-regs@emu.test";

async function kid(parent: string, name: string, listing: string) {
  const k = await as(parent, "POST", "/api/my/children", { name, dob: "2016-05-06" });
  assert.ok(k.ok, JSON.stringify(k.json));
  const b = await bookWithAddons({ parent, listing, children: [{ name, days: [1] }] });
  assert.ok(b.ok, `${name}: ${JSON.stringify(b.json).slice(0, 300)}`);
}
async function mkStaff(email: string, role: string) {
  const I = ids();
  const s = await login(email);
  await (await adminDb()).collection("users").doc(s.uid).set({ email, role: "staff", chosen: true, tenantId: I.tenants.P, franchiseId: null, name: email, staffRole: role, permRole: role }, { merge: true });
}
const stored = async () => (((await (await adminDb()).collection("customers").doc(custA).get()).data()!.children ?? []) as any[]);

before(async () => {
  await seedAddons();
  await kid("A", HIDDEN, "LK"); await kid("A", SEEN, "FL");
  custA = (await as("P", "GET", "/api/customers")).json.find((c: any) => c.email === A_EMAIL)?.id;
  assert.ok(custA, "family A record exists");
  // Give the stored hidden child some details a franchise must not be able to replace.
  const db = await adminDb();
  const cur = await stored();
  await db.collection("customers").doc(custA).set({ children: cur.map((k) => (k.name === HIDDEN ? { ...k, age: 9, dob: "2016-05-06", sendPlanId: "plan-orig", sendPlanName: "orig.pdf" } : k)) }, { merge: true });
  const lib = (await as("P", "GET", "/api/library")).json;
  const mine = ["cnb-none", "cnb-named", "cnb-regs"];
  const keep = (lib.settings?.roles ?? []).filter((r: any) => !mine.includes(r.id));
  const roles = [
    { id: "cnb-none", name: "CNB none", caps: { bookings: "none", registers: "none" } },
    { id: "cnb-named", name: "CNB named", caps: { bookings: "none", registers: "none", ratios: "edit", meals: "edit", trips: "edit", moments: "edit" } },
    { id: "cnb-regs", name: "CNB regs", caps: { bookings: "none", registers: "edit" } },
  ];
  assert.ok((await as("P", "PUT", "/api/library", { ...lib, settings: { ...lib.settings, roles: [...keep, ...roles] } })).ok);
  await mkStaff(NN, "cnb-none"); await mkStaff(NAMED, "cnb-named"); await mkStaff(REGS, "cnb-regs");
});

describe("P7. a franchise save never touches a hidden child, even by name", () => {
  it("F sends an entry with the hidden child's NAME and new age/dob/SEND plan: the hidden child is unchanged byte-for-byte", async () => {
    const before = (await stored()).find((k) => k.name === HIDDEN);
    assert.ok(before, "hidden child is stored");
    const seen = (await as("F", "GET", "/api/customers")).json.find((c: any) => c.email === A_EMAIL);
    assert.ok(seen && !(seen.children as any[]).some((k) => k.name === HIDDEN), "F cannot see the hidden child");
    const put = await as("F", "PUT", `/api/customers/${custA}`, { children: [...(seen.children as any[]), { name: HIDDEN, age: 3, sendPlanId: "plan-evil", sendPlanName: "evil.pdf" }] });
    assert.equal(put.status, 200, JSON.stringify(put.json).slice(0, 300));
    const after = await stored();
    const orig = after.filter((k) => JSON.stringify(k) === JSON.stringify(before));
    assert.equal(orig.length, 1, `the hidden child changed: ${JSON.stringify(after.filter((k) => k.name === HIDDEN))}`);
    assert.ok(after.some((k) => k.name === SEEN), "F's own child is still there");
  });
  it("the same with different letter case / spacing in the name", async () => {
    const before = (await stored()).find((k) => k.name === HIDDEN && k.sendPlanId === "plan-orig");
    const put = await as("F", "PUT", `/api/customers/${custA}`, { children: [{ name: `  ${HIDDEN.toUpperCase()} `, age: 4, dob: "2016-05-06", sendPlanId: "plan-evil2" }] });
    assert.equal(put.status, 200);
    const after = await stored();
    assert.ok(after.some((k) => JSON.stringify(k) === JSON.stringify(before)), "hidden child changed");
    assert.ok(!after.some((k) => k.name === SEEN), "F removed its own (visible) child by omitting it - allowed");
  });
  it("the owner can still edit that child", async () => {
    const put = await as("P", "PUT", `/api/customers/${custA}`, { children: [{ name: HIDDEN, age: 10 }] });
    assert.equal(put.status, 200);
    assert.equal((await stored()).find((k) => k.name === HIDDEN)?.age, 10);
  });
});

describe("B3w. none/none staff are refused WRITES (and meal orders) on the family-read areas too", () => {
  const D = () => ids().d1;
  const writes: [string, string, () => string][] = [
    ["PUT", "ratio board", () => `/api/ratios/board/${D()}`],
    ["PUT", "ratio group", () => `/api/ratios/someblock/${D()}`],
    ["POST", "trips", () => "/api/trips"],
    ["PUT", "trip", () => "/api/trips/x"],
    ["DELETE", "trip", () => "/api/trips/x"],
    ["PUT", "meals", () => `/api/meals/${D()}`],
    ["POST", "moments", () => "/api/moments"],
    ["PUT", "moment", () => "/api/moments/x"],
    ["DELETE", "moment", () => "/api/moments/x"],
  ];
  for (const [method, what, path] of writes) {
    it(`${method} ${what}: none/none staff 403; a role naming the area and Registers staff get past the family-read gate`, async () => {
      const nn = await as(NN, method, path(), {});
      assert.equal(nn.status, 403, `${method} ${path()} -> ${nn.status} ${JSON.stringify(nn.json).slice(0, 150)}`);
      assert.equal(nn.json?.code, "no_access");
      const named = await as(NAMED, method, path(), {});
      assert.notEqual(named.json?.code, "no_access", `${method} ${path()} named role: ${named.status}`);
      if (!/ratio|trip|meal|moment/.test(what)) return;
      const regs = await as(REGS, method, path(), {});
      assert.notEqual(regs.json?.code, "no_access", `${method} ${path()} registers role: ${regs.status}`);
    });
  }
  it("meal orders (child + parent names) need Bookings/Registers or meals named", async () => {
    assert.equal((await as(NN, "GET", "/api/meal-orders")).status, 403);
    assert.notEqual((await as(NAMED, "GET", "/api/meal-orders")).status, 403);
    assert.notEqual((await as(REGS, "GET", "/api/meal-orders")).status, 403);
  });
  it("logging an incident or accident stays open to none/none staff", async () => {
    const r = await as(NN, "POST", "/api/incidents", { kind: "accident", date: ids().generatedOn, childName: "Open Log", description: "still allowed" });
    assert.notEqual(r.status, 403, JSON.stringify(r.json).slice(0, 150));
  });
  it("owner and franchise are unaffected", async () => {
    for (const who of ["P", "F"]) assert.notEqual((await as(who, "PUT", `/api/ratios/board/${D()}`, {})).status, 403, who);
  });
});
