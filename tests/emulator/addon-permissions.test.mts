// Behaviour tests: what STAFF may see and do with add-ons (owner decision 8 Oct 2026).
//  AP07 staff never see prices (booking, booking list, register); the owner still does.
//  AP09 /api/kit* follows the role matrix (Bookings or Registers view), parents refused, platform read-only.
//  AP10 a kit tick must be inside the caller's site / franchise and its key must match the booking ref and date.
// Real API + Firestore emulator (npm run test:emu). Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, day, ids, kitDay, login, parentAddonRequest, seedAddons } from "../../scripts/emu/addons-helpers.mts";

let lkRef = "", flRef = "";
let lkKey = "", flKey = "";
const u = () => Math.random().toString(36).slice(2, 7);

/** Every place a money value could hide: any "£", and any key that names a price, amount or payment. */
function moneyLeaks(v: unknown, path = "$"): string[] {
  const out: string[] = [];
  if (typeof v === "string") { if (v.includes("£")) out.push(`${path} = ${v.slice(0, 60)}`); }
  else if (Array.isArray(v)) v.forEach((x, i) => out.push(...moneyLeaks(x, `${path}[${i}]`)));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
    if (/price|amount|money|paid|refund|cost|fee/i.test(k)) out.push(`${path}.${k}`);
    out.push(...moneyLeaks(x, `${path}.${k}`));
  }
  return out;
}

before(async () => {
  await seedAddons();
  const I = ids();
  const a = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: `Perm ${u()}`, days: "all", addons: [{ id: "AW", answers: { Colour: "Blue" } }, { id: "AT", answers: { Size: "M" } }] }] });
  assert.ok(a.ok, JSON.stringify(a.json));
  lkRef = a.refs[0];
  // A pending add-on request, so the staff view has a request carrying price / priceDiff to leak.
  const opt = await parentAddonRequest(lkRef, { as: "A", op: "options" });
  const key = opt.json?.lines?.[0]?.key;
  assert.ok(key, `add-on options: ${JSON.stringify(opt.json).slice(0, 300)}`);
  const rq = await parentAddonRequest(lkRef, { as: "A", op: "request", key, kind: "cancel", note: "perm test" });
  assert.ok(rq.ok, `request ${rq.status} ${JSON.stringify(rq.json)}`);
  const f = await bookWithAddons({ parent: "A", listing: "FL", children: [{ name: `Perm F ${u()}`, days: [1], addons: [{ id: "AF" }] }] });
  assert.ok(f.ok, JSON.stringify(f.json));
  flRef = f.refs[0];
  // a staff user whose role has Registers view but NO Bookings, assigned to LK
  const pLib = (await as("P", "GET", "/api/library")).json;
  const roles = [...(pLib.settings?.roles ?? []).filter((r: any) => r.id !== "emu-regs-only"), { id: "emu-regs-only", name: "Emu: registers only", caps: { bookings: "none", registers: "view" } }];
  const put = await as("P", "PUT", "/api/library", { ...pLib, settings: { ...pLib.settings, roles } });
  assert.ok(put.ok, `library ${put.status}`);
  const s5 = await login("staff-s5@emu.test");
  await (await adminDb()).collection("users").doc(s5.uid).set({ email: "staff-s5@emu.test", role: "staff", chosen: true, tenantId: I.tenants.P, franchiseId: null, name: "Staff S5", staffRole: "emu-regs-only", permRole: "emu-regs-only", assignment: { mode: "listings", ids: [I.listings.LK.id] } }, { merge: true });
  const k1 = (await kitDay("D1", {}, "P")).json;
  lkKey = k1.groups.flatMap((g: any) => g.children).find((c: any) => c.ref === lkRef)?.key;
  assert.ok(lkKey, "owner sees the LK order on the kit page");
  const k2 = (await as("F", "GET", `/api/kit?date=${day(1, "FL")}`)).json;
  flKey = k2.groups.flatMap((g: any) => g.children).find((c: any) => c.ref === flRef)?.key;
  assert.ok(flKey, "franchise sees its FL order on the kit page");
});

const tick = (who: string, key: string, ref: string, date: string, done = true) => as(who, "POST", "/api/kit/tick", { key, ref, date, done });

describe("AP07 staff never see add-on prices", () => {
  it("the owner still sees the prices", async () => {
    const one = (await as("P", "GET", `/api/bookings/${lkRef}`)).json;
    assert.ok(one.addonLines.some((l: any) => l.price > 0));
    assert.ok(JSON.stringify(one).includes("£"));
    const reg = JSON.stringify((await as("P", "GET", `/api/registers?date=${day(1)}`)).json);
    assert.ok(reg.includes("£"), "owner's register keeps the price");
  });
  for (const who of ["S2", "S1"]) {
    it(`${who}: GET /api/bookings/:ref carries no money, but still the add-on choices`, async () => {
      const r = await as(who, "GET", `/api/bookings/${lkRef}`);
      assert.equal(r.status, 200);
      assert.deepEqual(moneyLeaks(r.json), []);
      assert.ok(r.json.addonLines.some((l: any) => /Water bottle/.test(l.label) && /Blue/.test(l.label)), "choices stay visible");
      assert.ok((r.json.addonRequests ?? []).length > 0, "the request itself stays visible");
    });
    it(`${who}: GET /api/bookings (list) carries no money`, async () => {
      const r = await as(who, "GET", "/api/bookings");
      assert.equal(r.status, 200);
      assert.ok(r.json.some((b: any) => b.ref === lkRef));
      assert.deepEqual(moneyLeaks(r.json), []);
    });
    it(`${who}: the register shows add-on choices without a price`, async () => {
      const r = await as(who, "GET", `/api/registers?date=${day(1)}`);
      assert.equal(r.status, 200);
      const text = JSON.stringify(r.json);
      assert.deepEqual(moneyLeaks(r.json), []);
      assert.match(text, /Water bottle/);
      assert.match(text, /Blue/);
    });
  }
  it("franchise staff (SF) see no money on their franchise's booking either", async () => {
    const r = await as("SF", "GET", `/api/bookings/${flRef}`);
    assert.equal(r.status, 200);
    assert.deepEqual(moneyLeaks(r.json), []);
  });
});

describe("AP09 /api/kit follows the role matrix", () => {
  const routes = () => [`/api/kit?date=${day(1)}`, `/api/kit/days?from=${day(1)}&to=${day(3)}`, "/api/kit/live"];
  it("S4 (Bookings none, Registers none) is refused on all three routes", async () => {
    for (const p of routes()) assert.equal((await as("S4", "GET", p)).status, 403, p);
  });
  it("S2 (no restriction) and S5 (Registers view, Bookings none) get the page", async () => {
    for (const who of ["S2", "staff-s5@emu.test"]) for (const p of routes()) assert.equal((await as(who, "GET", p)).status, 200, `${who} ${p}`);
  });
  it("staff see only their own site's orders, and no price", async () => {
    const mine = (await kitDay("D1", {}, "S2")).json;
    assert.ok(JSON.stringify(mine).includes(lkRef));
    assert.deepEqual(moneyLeaks(mine), []);
    assert.ok(!JSON.stringify((await as("S2", "GET", `/api/kit?date=${day(1, "FL")}`)).json).includes(flRef), "another franchise is not visible");
    assert.ok(!JSON.stringify((await kitDay("D1", {}, "S3")).json).includes(lkRef), "another site is not visible");
  });
  it("parents are refused, platform can read but not tick, owner is unchanged", async () => {
    assert.equal((await as("A", "GET", "/api/kit/live")).status, 403);
    assert.equal((await as("HQ", "GET", `/api/kit?date=${day(1)}`)).status, 200);
    assert.equal((await as("HQ", "POST", "/api/kit/tick", { key: lkKey, ref: lkRef, date: day(1), done: true })).status, 403);
    assert.equal((await kitDay("D1", {}, "P")).status, 200);
  });
  it("S4 cannot tick either", async () => {
    assert.equal((await tick("S4", lkKey, lkRef, day(1))).status, 403);
  });
});

describe("AP10 a tick must be inside the caller's scope and match the booking", () => {
  it("outside the caller's franchise / site is refused", async () => {
    assert.ok([403, 404].includes((await tick("S3", lkKey, lkRef, day(1))).status), "S3 (other site) on LK");
    assert.ok([403, 404].includes((await tick("SF", lkKey, lkRef, day(1))).status), "SF (franchise staff) on a head-office booking");
    assert.ok([403, 404].includes((await tick("F", lkKey, lkRef, day(1))).status), "franchise on a head-office booking");
    assert.ok([403, 404].includes((await tick("S2", flKey, flRef, day(1, "FL"))).status), "S2 on a franchise booking");
    const left = (await (await adminDb()).collection("kitTicks").where("ref", "in", [lkRef, flRef]).get()).docs;
    assert.equal(left.length, 0, "a refused tick leaves nothing behind");
  });
  it("the key must match the booking ref and the date", async () => {
    assert.equal((await tick("P", "anything-goes", lkRef, day(1))).status, 400, "arbitrary key");
    assert.equal((await tick("P", lkKey, flRef, day(1))).status, 400, "key of another booking");
    assert.equal((await tick("P", lkKey, lkRef, day(2))).status, 400, "key for a different date");
    assert.equal((await tick("P", lkKey.replace("blue", "red"), lkRef, day(1))).status, 400, "an item the booking does not have");
    assert.equal((await (await adminDb()).collection("kitTicks").where("ref", "==", lkRef).get()).size, 0);
  });
  it("owner, staff on the site and franchise inside their own scope can still tick (and untick)", async () => {
    for (const who of ["P", "S2", "S1"]) {
      const on = await tick(who, lkKey, lkRef, day(1));
      assert.equal(on.status, 200, `${who} ${JSON.stringify(on.json)}`);
      assert.ok((await kitDay("D1", {}, "P")).json.groups.flatMap((g: any) => g.children).find((c: any) => c.key === lkKey).done);
      assert.equal((await tick(who, lkKey, lkRef, day(1), false)).status, 200);
    }
    assert.equal((await tick("F", flKey, flRef, day(1, "FL"))).status, 200, "franchise on its own booking");
    assert.equal((await tick("SF", flKey, flRef, day(1, "FL"))).status, 200, "franchise staff on their franchise's booking");
  });
});
