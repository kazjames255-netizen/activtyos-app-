// Trips hardening, round 2 (independent verifier findings on cbe4584f). Real API + Firestore emulator (npm run test:emu). Synthetic data only.
//  - another provider's child can never be put on my trip (childId from the client is checked against MY bookings)
//  - sign-off needs a real roster with the NAMED lead on it (no role-text matching)
//  - un-signing the risk assessment after sign-off reopens the sign-off
//  - POST cannot forge a parent's consent or suppress the consent request
//  - approval fields without "submitted" go through the same gate; cancel -> un-cancel -> cancel tells families once
//  - rostered plain staff may record head counts / return (only), still behind the consent gate
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, ids, login, seedAddons, ukDay } from "../../scripts/emu/addons-helpers.mts";

const u = () => Math.random().toString(36).slice(2, 7);
const LEAD_NAME = "Tina Tripson2";
const PLAIN = "staff-tr2-plain@emu.test";
const ROSTER_STAFF = "staff-tr2-roster@emu.test";
const FOREIGN_MED = `FOREIGNMED-${u()}`;
const A1 = `Tr2A1 ${u()}`, B1 = `Tr2B1 ${u()}`;
const cid: Record<string, string> = {};
let foreignId = "";

async function child(parent: "A" | "B", name: string) {
  const k = await as(parent, "POST", "/api/my/children", { name, dob: "2016-05-06" });
  assert.ok(k.ok, JSON.stringify(k.json));
  cid[name] = k.json.id;
  const b = await bookWithAddons({ parent, listing: "LK", children: [{ name, days: [1] }] });
  assert.ok(b.ok, `${name}: ${JSON.stringify(b.json).slice(0, 300)}`);
}
async function mkStaff(email: string, name: string) {
  const I = ids();
  const s = await login(email);
  await (await adminDb()).collection("users").doc(s.uid).set({ email, role: "staff", chosen: true, tenantId: I.tenants.P, franchiseId: null, name, assignment: null }, { merge: true });
}
before(async () => {
  await seedAddons();
  await child("A", A1); await child("B", B1);
  await mkStaff(PLAIN, "Pat Plain2");
  await mkStaff(ROSTER_STAFF, "Rosa Roster");
  // A child of ANOTHER provider: a booking with tenant Q, a parent, medical text. Never booked with P.
  const I = ids();
  const db = await adminDb();
  foreignId = `foreign-${u()}`;
  await db.collection("children").doc(foreignId).set({ name: "Foreign Kid", parentUid: I.uids.A, medical: FOREIGN_MED, emergencyName: "X", emergencyPhone: "07000000002" });
  await db.collection("bookings").add({ tenantId: I.tenants.Q, childId: foreignId, child: "Foreign Kid", email: "parent-a@emu.test", status: "Confirmed", ref: `FQ-${u()}` });
});

let n = 0;
async function trip(over: Record<string, unknown> = {}, who = "P") {
  const r = await as(who, "POST", "/api/trips", {
    destination: `Farm2 ${++n} ${u()}`, date: ukDay(10), departTime: "09:00", returnTime: "15:00", transport: "Minibus", lead: LEAD_NAME, offsiteRatio: 8,
    roster: [{ n: LEAD_NAME, r: "Trip lead", fa: true }, { n: "Sam Helper", r: "Helper" }], staff: [LEAD_NAME, "Sam Helper"],
    hazards: [{ h: "Road", done: true, residual: "L" }], raSigned: true, childNames: [A1], status: "planned", ...over,
  });
  assert.ok(r.ok, `create trip -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  return r.json as { id: string; destination: string; attendees: any[] };
}
const tripNow = async (id: string, who = "P") => ((await as(who, "GET", "/api/trips")).json as any[]).find((t) => t.id === id);
const consent = (parent: string, tripId: string, name: string, decision: "granted" | "declined") => as(parent, "POST", `/api/my/trips/${tripId}/consent`, { childId: cid[name], decision });
const bells = async (ref: string) => (await (await adminDb()).collection("notifications").where("ref", "==", ref).get()).docs.map((d) => d.data() as { title: string; audience: string; email?: string });
const wait = (ms = 700) => new Promise((r) => setTimeout(r, ms));
const rawAttendee = async (id: string) => (await (await adminDb()).collection("trips").doc(id).get()).data()!.attendees[0];
const sign = (id: string) => as("P", "PUT", `/api/trips/${id}`, { signoff: { approvedBy: "Manager", approvedAt: "now", submitted: true } });

describe("a child of another provider can never be put on my trip", () => {
  it("POST naming another tenant's childId is refused; nothing copied, nobody emailed", async () => {
    const dest = `Foreign ${u()}`;
    const r = await as("P", "POST", "/api/trips", { destination: dest, date: ukDay(9), childNames: ["Foreign Kid"], attendees: [{ n: "Foreign Kid", childId: foreignId }] });
    assert.ok(r.status === 400 || r.status === 403, `got ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
    assert.ok(!JSON.stringify(r.json).includes(FOREIGN_MED));
    assert.equal((await (await adminDb()).collection("trips").where("destination", "==", dest).get()).size, 0);
    await wait();
    const mails = (await (await adminDb()).collection("mailLog").where("to", "==", "parent-a@emu.test").get()).docs.filter((d) => String(d.get("subject")).includes(dest));
    assert.equal(mails.length, 0);
  });
  it("PUT adding it to an existing trip is refused and the trip is unchanged", async () => {
    const t = await trip();
    const cur = await tripNow(t.id);
    const r = await as("P", "PUT", `/api/trips/${t.id}`, { attendees: [...cur.attendees, { n: "Foreign Kid", childId: foreignId }] });
    assert.ok(r.status === 400 || r.status === 403, `got ${r.status}`);
    const after = await tripNow(t.id);
    assert.ok(!JSON.stringify(after).includes(FOREIGN_MED));
    assert.equal(after.attendees.length, 1);
  });
  it("a child already on the trip keeps working on later saves", async () => {
    const t = await trip();
    const cur = await tripNow(t.id);
    assert.equal((await as("P", "PUT", `/api/trips/${t.id}`, { attendees: cur.attendees, notes: "n" })).status, 200);
  });
});

describe("sign-off needs a real roster with the named lead on it", () => {
  it("no roster and no ratio: refused (zero staff)", async () => {
    const t = await trip({ roster: [], staff: [], offsiteRatio: undefined });
    await consent("A", t.id, A1, "granted");
    assert.equal((await sign(t.id)).status, 409);
  });
  it("the named lead is not on the roster: refused even if someone else's role says lead", async () => {
    const t = await trip({ roster: [{ n: "Other Person", r: "Trip lead", fa: true }], staff: ["Other Person"] });
    await consent("A", t.id, A1, "granted");
    assert.equal((await sign(t.id)).status, 409);
  });
  it("a role like 'Not the team leader' does not make anyone the lead", async () => {
    const t = await trip({ roster: [{ n: "Other Person", r: "Not the team leader", fa: true }], staff: ["Other Person"] });
    await consent("A", t.id, A1, "granted");
    assert.equal((await sign(t.id)).status, 409);
  });
  it("the named lead on the roster (any role text) with a first-aider is accepted", async () => {
    const t = await trip({ roster: [{ n: LEAD_NAME, r: "Coach" }, { n: "Sam Helper", r: "Helper", fa: true }], staff: [LEAD_NAME, "Sam Helper"] });
    await consent("A", t.id, A1, "granted");
    assert.equal((await sign(t.id)).status, 200);
  });
});

describe("un-signing the risk assessment after sign-off reopens it", () => {
  async function signed() {
    const t = await trip();
    await consent("A", t.id, A1, "granted");
    assert.equal((await sign(t.id)).status, 200);
    return t;
  }
  it("raSigned false", async () => {
    const t = await signed();
    assert.equal((await as("P", "PUT", `/api/trips/${t.id}`, { raSigned: false })).status, 200);
    assert.equal((await tripNow(t.id)).signoff.submitted, false);
  });
  it("hazards removed", async () => {
    const t = await signed();
    assert.equal((await as("P", "PUT", `/api/trips/${t.id}`, { hazards: [] })).status, 200);
    assert.equal((await tripNow(t.id)).signoff.submitted, false);
  });
});

describe("a client cannot forge consent on create", () => {
  it("granted + a parent's email as consentBy is stored as the PROVIDER's record, never the parent's", async () => {
    const t = await trip({ attendees: [{ n: A1, consent: "granted", consentBy: "parent-a@emu.test", consentAt: "2020-01-01T00:00:00Z" }] }, PLAIN);
    const raw = await rawAttendee(t.id);
    assert.equal(raw.consentSource, "provider");
    assert.equal(raw.consentBy, PLAIN);
    assert.notEqual(raw.consentAt, "2020-01-01T00:00:00Z");
  });
  it("a client consentRequestedAt does not stop the parent being asked", async () => {
    const t = await trip({ attendees: [{ n: A1, consentRequestedAt: "2026-01-01T00:00:00Z", sent: true }] });
    await wait();
    assert.notEqual((await rawAttendee(t.id)).consentRequestedAt, "2026-01-01T00:00:00Z");
    assert.ok((await bells(t.id)).some((b) => b.audience === "parent" && b.email === "parent-a@emu.test" && /consent needed/i.test(b.title)), "the parent was asked");
  });
});

describe("records", () => {
  it("approval fields without submitted are gated like a sign-off", async () => {
    const t = await trip(); // child still pending
    const r = await as("P", "PUT", `/api/trips/${t.id}`, { signoff: { approvedBy: "x", approvedAt: "y" } });
    assert.equal(r.status, 409, JSON.stringify(r.json).slice(0, 200));
    assert.ok(!(await tripNow(t.id)).signoff?.approvedBy);
  });
  it("cancel, back to planned, cancel again: families are told once", async () => {
    const t = await trip({ childNames: [B1] });
    await as("P", "PUT", `/api/trips/${t.id}`, { status: "cancelled" });
    await as("P", "PUT", `/api/trips/${t.id}`, { status: "planned" });
    await as("P", "PUT", `/api/trips/${t.id}`, { status: "cancelled" });
    await wait();
    assert.equal((await bells(t.id)).filter((b) => b.audience === "parent" && b.email === "parent-b@emu.test" && /cancel/i.test(b.title)).length, 1);
  });
});

describe("rostered plain staff can record the day, nothing else", () => {
  const rostered = () => trip({ roster: [{ n: LEAD_NAME, r: "Trip lead", fa: true }, { n: "Rosa Roster", r: "Helper" }], staff: [LEAD_NAME, "Rosa Roster"] });
  it("checkpoints and returned are allowed once consent is in", async () => {
    const t = await rostered();
    await consent("A", t.id, A1, "granted");
    assert.equal((await as(ROSTER_STAFF, "PUT", `/api/trips/${t.id}`, { checkpoints: [{ n: "Depart", counted: 1 }] })).status, 200);
    assert.equal((await as(ROSTER_STAFF, "PUT", `/api/trips/${t.id}`, { returned: true })).status, 200);
  });
  it("still behind the consent gate", async () => {
    const t = await rostered();
    assert.equal((await as(ROSTER_STAFF, "PUT", `/api/trips/${t.id}`, { checkpoints: [{ n: "Depart", counted: 1 }] })).status, 409);
  });
  it("anything else, or anything extra alongside, is 403", async () => {
    const t = await rostered();
    await consent("A", t.id, A1, "granted");
    for (const body of [{ notes: "x" }, { checkpoints: [{ n: "Depart", counted: 1 }], notes: "x" }, { status: "completed" }, { returned: true, signoff: { submitted: false } }, {}]) {
      assert.equal((await as(ROSTER_STAFF, "PUT", `/api/trips/${t.id}`, body)).status, 403, JSON.stringify(body));
    }
  });
  it("staff not on this trip's roster get 403 even for a head count", async () => {
    const t = await rostered();
    await consent("A", t.id, A1, "granted");
    assert.equal((await as(PLAIN, "PUT", `/api/trips/${t.id}`, { checkpoints: [{ n: "Depart", counted: 1 }] })).status, 403);
  });
});
