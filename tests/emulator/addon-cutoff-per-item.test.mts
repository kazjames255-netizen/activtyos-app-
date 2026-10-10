// Per-add-on request cut-off (10 Oct): a T-shirt can close requests 7 days before, lunch 1 day, anything without a rule follows Setup (3).
// The rule is snapshotted on the booking's add-on line; editing the add-on later never moves an existing booking. Real API + emulator.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, bookingAsRole, day, operatorAction, seedAddons } from "../../scripts/emu/addons-helpers.mts";
import { requestDeadline } from "../../features/bookings/addonRequests";

const uniq = () => Math.random().toString(36).slice(2, 7);
const putCutoffs = async (c: Record<string, number | null | string | boolean>) => {
  const lib = (await as("P", "GET", "/api/library")).json;
  return as("P", "PUT", "/api/library", { addons: lib.addons.map((a: any) => {
    const { requestCutoffDays: _x, ...rest } = a;
    return a.id in c ? { ...rest, requestCutoffDays: c[a.id] } : rest;
  }) });
};
const clearCutoffs = async () => {
  const lib = (await as("P", "GET", "/api/library")).json;
  return as("P", "PUT", "/api/library", { addons: lib.addons.map(({ requestCutoffDays: _x, ...rest }: any) => rest) });
};
const AT = "addon-emu-at", AL = "addon-emu-al";
// LK_D5: the first session is 5 days away.
async function book(addons: any[]) {
  const child = `cut ${uniq()}`;
  const b = await bookWithAddons({ parent: "A", listing: "LK_D5", children: [{ name: child, days: [1], addons }] });
  assert.equal(b.status, 201, JSON.stringify(b.json));
  return b.refs[0] as string;
}
const options = async (ref: string) => (await as("A", "GET", `/api/my/bookings/${encodeURIComponent(ref)}/addon-options`)).json;
const keyOf = async (ref: string, name: string) => (await options(ref)).lines.find((l: any) => l.name === name).key as string;
const cancel = (ref: string, key: string, extra: Record<string, unknown> = {}) => as("A", "POST", `/api/my/bookings/${encodeURIComponent(ref)}/addon-requests`, { kind: "cancel", key, ...extra });
const SHIRT = { id: "AT", answers: { Size: "M" } };

before(async () => { await seedAddons({ extraD1: [5] }); });

describe("per-add-on cut-off", () => {
  it("T-shirt 7 / lunch 1 / Setup 3: 5 days before, T-shirt refused, lunch allowed, bottle follows Setup", async () => {
    assert.equal((await putCutoffs({ [AT]: 7, [AL]: 1 })).status, 200);
    const ref = await book([SHIRT, { id: "AL" }, { id: "AW", answers: { Colour: "Red" } }]);
    const o = await options(ref);
    const by = (n: string) => o.lines.find((l: any) => l.name === n);
    assert.equal(by("T-shirt").block, "cutoff");
    assert.equal(by("T-shirt").until, requestDeadline(day(1, "LK_D5"), 7)); // the per-item date, not the Setup one
    assert.equal(by("T-shirt").cutoffDays, 7);
    assert.equal(by("Lunch").block, "none"); assert.equal(by("Lunch").cutoffDays, 1);
    assert.equal(by("Water bottle").block, "none"); assert.equal(by("Water bottle").cutoffDays, 3);
    const t = await cancel(ref, by("T-shirt").key);
    assert.equal(t.status, 409, JSON.stringify(t.json));
    assert.match(t.json.error, /7 days/);
    assert.equal((await cancel(ref, by("Lunch").key)).status, 201);
    const lines = (await bookingAsRole(ref, "P")).json.addonLines;
    assert.equal(lines.find((l: any) => l.name === "T-shirt").requestCutoffDays, 7);
    assert.equal(lines.find((l: any) => l.name === "Lunch").requestCutoffDays, 1);
    assert.ok(!("requestCutoffDays" in lines.find((l: any) => l.name === "Water bottle")));
  });

  it("a booking made before the listing edit keeps its snapshot; a new booking gets the new rule", async () => {
    assert.equal((await putCutoffs({ [AT]: 7 })).status, 200);
    const old = await book([SHIRT]);
    assert.equal((await putCutoffs({ [AT]: 1 })).status, 200);
    assert.equal((await options(old)).lines[0].block, "cutoff"); // still 7
    const fresh = await book([SHIRT]);
    assert.equal((await options(fresh)).lines[0].block, "none"); // now 1
    assert.equal((await cancel(old, await keyOf(old, "T-shirt"))).status, 409);
    assert.equal((await cancel(fresh, await keyOf(fresh, "T-shirt"))).status, 201);
  });

  it("an old line with no snapshot uses Setup; rule switched off follows Setup for new bookings", async () => {
    assert.equal((await putCutoffs({ [AT]: 7 })).status, 200);
    const ref = await book([SHIRT]);
    const db = await adminDb();
    const s = await db.collection("bookings").where("ref", "==", ref).get();
    await s.docs[0].ref.update({ addonLines: (s.docs[0].data().addonLines as any[]).map(({ requestCutoffDays: _r, ...l }) => l) }); // disclosed shortcut: an old line
    assert.equal((await options(ref)).lines[0].block, "none");
    assert.equal((await clearCutoffs()).status, 200);
    const fresh = await book([SHIRT]);
    assert.equal((await options(fresh)).lines[0].cutoffDays, 3);
  });

  it("0 means requests stay open up to the session day", async () => {
    assert.equal((await putCutoffs({ [AT]: 0 })).status, 200);
    const ref = await book([SHIRT]);
    const l = (await options(ref)).lines[0];
    assert.equal(l.block, "none"); assert.equal(l.cutoffDays, 0);
  });

  it("a cut-off sent by the family is ignored (request body and checkout)", async () => {
    assert.equal((await putCutoffs({ [AT]: 7 })).status, 200);
    const ref = await book([SHIRT]);
    const r = await cancel(ref, await keyOf(ref, "T-shirt"), { requestCutoffDays: 0, cutoffDays: 0 });
    assert.equal(r.status, 409);
    const forged = await book([{ ...SHIRT, requestCutoffDays: 0 }]);
    assert.equal((await bookingAsRole(forged, "P")).json.addonLines[0].requestCutoffDays, 7);
    const w = await book([{ id: "AW", answers: { Colour: "Red" }, requestCutoffDays: 60 }]);
    assert.ok(!("requestCutoffDays" in (await bookingAsRole(w, "P")).json.addonLines[0]));
  });

  it("validation: integer 0 to 60 only", async () => {
    for (const bad of [-1, 61, 1.5, "3", true]) {
      const r = await putCutoffs({ [AT]: bad });
      assert.equal(r.status, 400, `${JSON.stringify(bad)} -> ${r.status}`);
    }
    for (const ok of [0, 60, null]) assert.equal((await putCutoffs({ [AT]: ok })).status, 200);
  });

  it("another provider and staff cannot edit it; staff still see no prices", async () => {
    assert.equal((await putCutoffs({ [AT]: 7 })).status, 200);
    const ref = await book([SHIRT]);
    const lib = (await as("P", "GET", "/api/library")).json;
    assert.equal((await as("S1", "PUT", "/api/library", { addons: lib.addons.map((a: any) => ({ ...a, requestCutoffDays: 0 })) })).status, 403);
    const q = await as("Q", "PUT", "/api/library", { addons: [{ id: AT, name: "T-shirt", type: "once", price: 1, requestCutoffDays: 0 }] });
    assert.equal(q.status, 200); // Q's own library only
    assert.equal((await as("P", "GET", "/api/library")).json.addons.find((a: any) => a.id === AT).requestCutoffDays, 7);
    assert.notEqual((await operatorAction(ref, "addon-approve", { requestId: "x" }, "Q")).status, 200);
    const staff = await as("S1", "GET", "/api/library");
    assert.equal(staff.status, 200);
    assert.ok(!/"price"/.test(JSON.stringify(staff.json.addons)));
  });
});
