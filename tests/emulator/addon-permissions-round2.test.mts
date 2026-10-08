// Round 2 behaviour tests (verifier findings V19b, X01, X02, X03): who sees what, beyond the add-on pages.
// Real API + Firestore emulator (npm run test:emu). Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, ids, login, operatorAction, seedAddons } from "../../scripts/emu/addons-helpers.mts";

let lkRef = "";
const S5 = "staff-s5@emu.test";
const u = () => Math.random().toString(36).slice(2, 7);

before(async () => {
  await seedAddons();
  const I = ids();
  const a = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: `R2 ${u()}`, days: "all", addons: [{ id: "AW", answers: { Colour: "Blue" } }] }] });
  assert.ok(a.ok, JSON.stringify(a.json));
  lkRef = a.refs[0];
  const pLib = (await as("P", "GET", "/api/library")).json;
  const roles = [...(pLib.settings?.roles ?? []).filter((r: any) => r.id !== "emu-regs-only"), { id: "emu-regs-only", name: "Emu: registers only", caps: { bookings: "none", registers: "view" } }];
  assert.ok((await as("P", "PUT", "/api/library", { ...pLib, settings: { ...pLib.settings, roles } })).ok);
  const s5 = await login(S5);
  await (await adminDb()).collection("users").doc(s5.uid).set({ email: S5, role: "staff", chosen: true, tenantId: I.tenants.P, franchiseId: null, name: "Staff S5", staffRole: "emu-regs-only", permRole: "emu-regs-only", assignment: { mode: "listings", ids: [I.listings.LK.id] } }, { merge: true });
});

const priceKeys = (v: unknown, path = "$"): string[] => {
  const out: string[] = [];
  if (Array.isArray(v)) v.forEach((x, i) => out.push(...priceKeys(x, `${path}[${i}]`)));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (/price|cost|amount/i.test(k)) out.push(`${path}.${k}`); out.push(...priceKeys(x, `${path}.${k}`)); }
  return out;
};

describe("V19b the library gives staff add-on names and questions, never prices", () => {
  it("the owner still sees the add-on prices", async () => {
    const lib = (await as("P", "GET", "/api/library")).json;
    assert.ok(lib.addons.some((a: any) => a.name === "Water bottle" && a.price === 3));
  });
  for (const who of ["S1", "S2", "S3", "S4", "SF"]) {
    it(`${who}: no price in the add-on catalogue, names and questions kept`, async () => {
      const r = await as(who, "GET", "/api/library");
      assert.equal(r.status, 200);
      assert.deepEqual(priceKeys(r.json.addons ?? []), []);
      if (who !== "SF") {
        const w = (r.json.addons ?? []).find((a: any) => a.name === "Water bottle");
        assert.ok(w, "the add-on is still listed");
        assert.ok(w.questions?.length, "its questions are kept");
      }
    });
  }
});

describe("X01 GET /api/blocks/:id/attendees follows the register's scope", () => {
  const path = () => `/api/blocks/${ids().listings.LK.blockId}/attendees`;
  it("owner, site staff (S1, S2), registers-only staff (S5) and HQ can read it", async () => {
    for (const who of ["P", "S1", "S2", S5, "HQ"]) {
      const r = await as(who, "GET", path());
      assert.equal(r.status, 200, who);
      assert.ok(JSON.stringify(r.json).includes(lkRef), `${who} sees the booking`);
    }
  });
  it("another site (S3), no Bookings and no Registers (S4), franchise staff (SF) and the franchise (F) get nothing", async () => {
    for (const who of ["S3", "S4", "SF", "F"]) {
      const r = await as(who, "GET", path());
      assert.ok(r.status === 403 || r.status === 404, `${who} got ${r.status}`);
      assert.ok(!JSON.stringify(r.json).includes("@emu.test"), `${who} saw an email`);
    }
  });
  it("the franchise still reads its own block", async () => {
    const r = await as("F", "GET", `/api/blocks/${ids().listings.FL.blockId}/attendees`);
    assert.equal(r.status, 200);
  });
});

describe("X02 an unknown add-on request id is a clear 4xx, not a 500", () => {
  for (const type of ["addon-approve", "addon-decline"]) {
    it(type, async () => {
      const r = await operatorAction(lkRef, type, { requestId: "no-such-request" }, "P");
      assert.ok(r.status === 400 || r.status === 404, `got ${r.status} ${JSON.stringify(r.json)}`);
      assert.ok(String(r.json?.error ?? "").length > 3, "a reason is given");
    });
  }
});

describe("X03 the customer list follows the role matrix", () => {
  it("S4 (Bookings none, Registers none) is refused", async () => {
    assert.equal((await as("S4", "GET", "/api/customers")).status, 403);
  });
  it("owner, S2 (no restriction) and S5 (Registers view) still read their families", async () => {
    for (const who of ["P", "S2", S5]) assert.equal((await as(who, "GET", "/api/customers")).status, 200, who);
  });
  it("S3 (other site) still gets a 200 that does not list the LK family", async () => {
    const r = await as("S3", "GET", "/api/customers");
    assert.equal(r.status, 200);
    assert.ok(!JSON.stringify(r.json).includes(lkRef));
  });
});
