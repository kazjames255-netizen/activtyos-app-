// Trips & consent hardening (10 Oct). Child-safety rules the SERVER must enforce, not the browser:
//  - the head-count / returned actions are refused while any attending child's consent is pending (not just complete / sign-off)
//  - the client can never set consentObtained (the server owns it), and a decline does not turn it off
//  - sign-off needs the ratio, a finished risk assessment and the roster, server-side
//  - a change after sign-off (a parent flipping an answer, a child added or removed) REOPENS the sign-off and rings the provider
//  - only the trip lead / organiser / owner roles can edit a trip; plain staff cannot
//  - children's medical text is for leads only; plain staff get a flag, never the text or the parent's email
//  - cost is a validated amount; an unlinked child is surfaced with a clear fix; cancelling a trip tells the families
//  - attacks: other tenant, other parent, plain staff, duplicate and parallel taps, consent on a withdrawn child
// Real API + Firestore emulator (npm run test:emu). Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, ids, login, seedAddons, ukDay } from "../../scripts/emu/addons-helpers.mts";

const u = () => Math.random().toString(36).slice(2, 7);
const LEAD = "staff-tr-lead@emu.test";   // plain staff account whose name is the trip lead's name below
const PLAIN = "staff-tr-plain@emu.test"; // plain staff, not the lead, not the organiser
const LEAD_NAME = "Tina Tripson";
const MED = `PEANUTMED-${u()}`;
const kidName = (t: string) => `Tr${t} ${u()}`;
const A1 = kidName("A1"), A2 = kidName("A2"), A3 = kidName("A3"), B1 = kidName("B1"), TWIN = kidName("Twin"), GHOST = kidName("Ghost"), GONE = kidName("Gone");
const cid: Record<string, string> = {};

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
  for (const n of [A1, A2, A3, GONE]) await child("A", n);
  await child("B", B1);
  await child("A", TWIN); await child("B", TWIN); // same name, two families: never link by name
  const db = await adminDb();
  await db.collection("children").doc(cid[A1]).set({ medical: MED, allergies: "peanuts", emergencyName: "Em Contact", emergencyPhone: "07000000001" }, { merge: true });
  await mkStaff(LEAD, LEAD_NAME);
  await mkStaff(PLAIN, "Pat Plain");
});

let n = 0;
/** A planned trip ten days out with a sensible staff roster, made by the owner (P) unless told otherwise. */
async function trip(over: Record<string, unknown> = {}, who = "P") {
  const r = await as(who, "POST", "/api/trips", {
    destination: `Farm ${++n} ${u()}`, date: ukDay(10), departTime: "09:00", returnTime: "15:00", transport: "Minibus", lead: LEAD_NAME, offsiteRatio: 8,
    roster: [{ n: LEAD_NAME, r: "Trip lead", fa: true }, { n: "Sam Helper", r: "Helper" }], staff: [LEAD_NAME, "Sam Helper"],
    hazards: [{ h: "Road", done: true, residual: "L" }], raSigned: true,
    childNames: [A1], status: "planned", ...over,
  });
  assert.ok(r.ok, `create trip -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  return r.json as { id: string; attendees: any[]; [k: string]: any };
}
const tripNow = async (id: string, who = "P") => {
  const r = await as(who, "GET", "/api/trips");
  assert.equal(r.status, 200, JSON.stringify(r.json).slice(0, 200));
  return (r.json as any[]).find((t) => t.id === id);
};
const consent = (parent: string, tripId: string, name: string, decision: "granted" | "declined") => as(parent, "POST", `/api/my/trips/${tripId}/consent`, { childId: cid[name], decision });
const bells = async (ref: string) => (await (await adminDb()).collection("notifications").where("ref", "==", ref).get()).docs.map((d) => d.data() as { title: string; body: string; audience: string; email?: string; i18n?: any });
const setTripSettings = async (trips: Record<string, unknown>) => {
  const lib = (await as("P", "GET", "/api/library")).json;
  const r = await as("P", "PUT", "/api/library", { ...lib, settings: { ...lib.settings, trips } });
  assert.ok(r.ok, JSON.stringify(r.json));
};

describe("the server owns consentObtained", () => {
  it("a client claiming consentObtained:true on create is ignored", async () => {
    const t = await trip({ consentObtained: true });
    assert.equal(t.consentObtained, false);
    assert.equal((await tripNow(t.id)).consentObtained, false);
  });
  it("a PUT claiming it is ignored too", async () => {
    const t = await trip();
    const r = await as("P", "PUT", `/api/trips/${t.id}`, { consentObtained: true });
    assert.equal(r.status, 200);
    assert.equal((await tripNow(t.id)).consentObtained, false);
  });
  it("a decline does not switch it off: one granted, one declined = obtained", async () => {
    const t = await trip({ childNames: [A1, A2] });
    assert.equal((await consent("A", t.id, A1, "granted")).status, 200);
    assert.equal((await tripNow(t.id)).consentObtained, false, "A2 is still waiting");
    assert.equal((await consent("A", t.id, A2, "declined")).status, 200);
    assert.equal((await tripNow(t.id)).consentObtained, true);
  });
  it("a provider PUT recomputes it as well (a pending child added to a fully-consented trip turns it off)", async () => {
    const t = await trip({ childNames: [A1] });
    await consent("A", t.id, A1, "granted");
    assert.equal((await tripNow(t.id)).consentObtained, true);
    const cur = await tripNow(t.id);
    const r = await as("P", "PUT", `/api/trips/${t.id}`, { childNames: [A1, A2], attendees: cur.attendees });
    assert.equal(r.status, 200, JSON.stringify(r.json).slice(0, 200));
    assert.equal((await tripNow(t.id)).consentObtained, false);
  });
});

describe("day-of actions are refused while consent is pending", () => {
  it("head-count checkpoint with a count, and 'returned', are refused (409, names the child)", async () => {
    const t = await trip({ childNames: [A1] });
    const cp = await as("P", "PUT", `/api/trips/${t.id}`, { checkpoints: [{ n: "Depart", counted: 1 }] });
    assert.equal(cp.status, 409, JSON.stringify(cp.json).slice(0, 200));
    assert.match(String(cp.json.error), /consent/i);
    const ret = await as("P", "PUT", `/api/trips/${t.id}`, { returned: true });
    assert.equal(ret.status, 409);
    const doc = await tripNow(t.id);
    assert.ok(!(doc.checkpoints ?? []).some((c: any) => c.counted != null), "nothing was saved");
    assert.notEqual(doc.returned, true);
  });
  it("saving the planner with EMPTY checkpoints is still fine (the screen saves them every time)", async () => {
    const t = await trip({ childNames: [A1] });
    const r = await as("P", "PUT", `/api/trips/${t.id}`, { checkpoints: [{ n: "Depart", counted: null }], returned: false });
    assert.equal(r.status, 200, JSON.stringify(r.json).slice(0, 200));
  });
  it("allowed once the child's family has answered", async () => {
    const t = await trip({ childNames: [A1] });
    await consent("A", t.id, A1, "granted");
    assert.equal((await as("P", "PUT", `/api/trips/${t.id}`, { checkpoints: [{ n: "Depart", counted: 1 }] })).status, 200);
    assert.equal((await as("P", "PUT", `/api/trips/${t.id}`, { returned: true })).status, 200);
  });
  it("a decline unblocks it (that child is not going)", async () => {
    const t = await trip({ childNames: [A1] });
    await consent("A", t.id, A1, "declined");
    assert.equal((await as("P", "PUT", `/api/trips/${t.id}`, { checkpoints: [{ n: "Depart", counted: 0 }] })).status, 200);
  });
  it("Setup > Trips 'require consent' off lifts the block", async () => {
    await setTripSettings({ requireConsent: false });
    try {
      const t = await trip({ childNames: [A1] });
      assert.equal((await as("P", "PUT", `/api/trips/${t.id}`, { checkpoints: [{ n: "Depart", counted: 1 }] })).status, 200);
    } finally { await setTripSettings({}); }
  });
});

describe("sign-off is enforced on the server", () => {
  const sign = (id: string, who = "P") => as(who, "PUT", `/api/trips/${id}`, { signoff: { approvedBy: "Manager", approvedAt: "now", submitted: true } });
  it("refused with a child still pending", async () => {
    const t = await trip({ childNames: [A1] });
    const r = await sign(t.id);
    assert.equal(r.status, 409);
    assert.match(r.json.error, /consent/i);
  });
  it("refused when the ratio is not met: 1:2 with 3 going needs 2 staff, roster has 1", async () => {
    const t = await trip({ childNames: [A1, A2, A3], offsiteRatio: 2, roster: [{ n: LEAD_NAME, r: "Trip lead", fa: true }], staff: [LEAD_NAME] });
    for (const k of [A1, A2, A3]) await consent("A", t.id, k, "granted");
    const r = await sign(t.id);
    assert.equal(r.status, 409, JSON.stringify(r.json).slice(0, 300));
    assert.match(r.json.error, /staff|ratio/i);
    assert.equal((await tripNow(t.id)).signoff?.submitted ?? false, false);
    // add the second staff member: now it goes through
    const ok = await as("P", "PUT", `/api/trips/${t.id}`, { roster: [{ n: LEAD_NAME, r: "Trip lead", fa: true }, { n: "Sam Helper", r: "Helper" }], staff: [LEAD_NAME, "Sam Helper"], signoff: { approvedBy: "Manager", approvedAt: "now", submitted: true } });
    assert.equal(ok.status, 200, JSON.stringify(ok.json).slice(0, 300));
  });
  it("refused when the risk assessment is unfinished", async () => {
    const t = await trip({ childNames: [A1], raSigned: false });
    await consent("A", t.id, A1, "granted");
    const r = await sign(t.id);
    assert.equal(r.status, 409);
    assert.match(r.json.error, /risk assessment/i);
  });
  it("accepted when everything is in place", async () => {
    const t = await trip({ childNames: [A1] });
    await consent("A", t.id, A1, "granted");
    const r = await sign(t.id);
    assert.equal(r.status, 200, JSON.stringify(r.json).slice(0, 300));
    assert.equal((await tripNow(t.id)).signoff.submitted, true);
  });
});

describe("a change after sign-off reopens the sign-off and rings the provider", () => {
  async function signedOff(kids: string[]) {
    const t = await trip({ childNames: kids });
    for (const k of kids) assert.equal((await consent("A", t.id, k, "granted")).status, 200);
    const r = await as("P", "PUT", `/api/trips/${t.id}`, { signoff: { approvedBy: "Manager", approvedAt: "now", submitted: true } });
    assert.equal(r.status, 200, JSON.stringify(r.json).slice(0, 300));
    return t;
  }
  it("a parent flipping granted to declined reopens it and the provider gets a bell", async () => {
    const t = await signedOff([A1, A2]);
    const before = (await bells(t.id)).filter((b) => /reopened/i.test(b.title)).length;
    assert.equal((await consent("A", t.id, A2, "declined")).status, 200);
    const doc = await tripNow(t.id);
    assert.equal(doc.signoff.submitted, false);
    assert.ok(!doc.signoff.approvedBy, "the old approval no longer stands");
    const after = (await bells(t.id)).filter((b) => /reopened/i.test(b.title) && b.audience === "tenant");
    assert.equal(after.length, before + 1);
    assert.ok(after[0].title.length <= 32 || after[0].title.length <= 40, after[0].title);
  });
  it("a repeated identical tap (double tap, stale tab) changes nothing: no new bell, no reopen", async () => {
    const t = await signedOff([A1]);
    const count = async () => (await bells(t.id)).length;
    const c0 = await count();
    const again = await consent("A", t.id, A1, "granted");
    assert.equal(again.status, 200);
    assert.equal(await count(), c0, "no second 'consent given' bell");
    assert.equal((await tripNow(t.id)).signoff.submitted, true);
  });
  it("the provider adding a child after sign-off reopens it", async () => {
    const t = await signedOff([A1]);
    const cur = await tripNow(t.id);
    const r = await as("P", "PUT", `/api/trips/${t.id}`, { childNames: [A1, A2], attendees: cur.attendees });
    assert.equal(r.status, 200, JSON.stringify(r.json).slice(0, 200));
    assert.equal((await tripNow(t.id)).signoff.submitted, false);
  });
  it("saving the planner with nothing changed does NOT reopen it", async () => {
    const t = await signedOff([A1]);
    const cur = await tripNow(t.id);
    const r = await as("P", "PUT", `/api/trips/${t.id}`, { destination: cur.destination, attendees: cur.attendees, childNames: [A1], signoff: cur.signoff, notes: "a note" });
    assert.equal(r.status, 200, JSON.stringify(r.json).slice(0, 200));
    assert.equal((await tripNow(t.id)).signoff.submitted, true);
  });
  it("moving the date after sign-off reopens it", async () => {
    const t = await signedOff([A1]);
    assert.equal((await as("P", "PUT", `/api/trips/${t.id}`, { date: ukDay(11) })).status, 200);
    assert.equal((await tripNow(t.id)).signoff.submitted, false);
  });
});

describe("duplicate and parallel consent taps", () => {
  it("two identical taps at once: both succeed, the answer is stored once, and the provider hears once", async () => {
    const t = await trip({ childNames: [A1] });
    const rs = await Promise.all([consent("A", t.id, A1, "granted"), consent("A", t.id, A1, "granted"), consent("A", t.id, A1, "granted")]);
    assert.deepEqual(rs.map((r) => r.status), [200, 200, 200]);
    const heard = (await bells(t.id)).filter((b) => b.audience === "tenant" && /consent given/i.test(b.title));
    assert.equal(heard.length, 1, `provider bells: ${heard.map((h) => h.title).join(" | ")}`);
  });
  it("a grant and a decline racing: no error, one clean final answer, the flag agrees with it", async () => {
    const t = await trip({ childNames: [A1] });
    const rs = await Promise.all([consent("A", t.id, A1, "granted"), consent("A", t.id, A1, "declined")]);
    assert.ok(rs.every((r) => r.status === 200), JSON.stringify(rs.map((r) => r.status)));
    const doc = await tripNow(t.id);
    const final = doc.attendees[0].consent;
    assert.ok(final === "granted" || final === "declined");
    assert.equal(doc.consentObtained, final === "granted");
  });
});

describe("consent attacks", () => {
  it("another parent cannot answer for my child", async () => {
    const t = await trip({ childNames: [A1] });
    const r = await as("B", "POST", `/api/my/trips/${t.id}/consent`, { childId: cid[A1], decision: "granted" });
    assert.equal(r.status, 404);
    assert.equal((await tripNow(t.id)).attendees[0].consent ?? "pending", "pending");
  });
  it("my own child who is not on this trip gets a 404 and changes nothing", async () => {
    const t = await trip({ childNames: [A1] });
    const r = await consent("A", t.id, A2, "granted");
    assert.equal(r.status, 404);
  });
  it("a withdrawn (archived) child cannot be given consent for", async () => {
    const t = await trip({ childNames: [GONE] });
    await (await adminDb()).collection("children").doc(cid[GONE]).set({ archived: true }, { merge: true });
    try {
      const r = await consent("A", t.id, GONE, "granted");
      assert.ok(r.status === 404 || r.status === 409, `got ${r.status}`);
      assert.equal((await tripNow(t.id)).attendees[0].consent ?? "pending", "pending");
    } finally { await (await adminDb()).collection("children").doc(cid[GONE]).set({ archived: false }, { merge: true }); }
  });
  it("a child taken off the trip can no longer be answered for", async () => {
    const t = await trip({ childNames: [A1, A2] });
    const cur = await tripNow(t.id);
    const r = await as("P", "PUT", `/api/trips/${t.id}`, { childNames: [A1], attendees: cur.attendees.filter((a: any) => a.n === A1) });
    assert.equal(r.status, 200);
    assert.equal((await consent("A", t.id, A2, "granted")).status, 404);
  });
  it("a provider PUT cannot overwrite the parent's decline with a 'granted'", async () => {
    const t = await trip({ childNames: [A1] });
    await consent("A", t.id, A1, "declined");
    const cur = await tripNow(t.id);
    await as("P", "PUT", `/api/trips/${t.id}`, { attendees: cur.attendees.map((a: any) => ({ ...a, consent: "granted" })) });
    assert.equal((await tripNow(t.id)).attendees[0].consent, "declined");
  });
  it("another provider (Q) cannot read, edit, delete or message my trip", async () => {
    const t = await trip({ childNames: [A1] });
    assert.equal(await tripNow(t.id, "Q"), undefined);
    assert.equal((await as("Q", "PUT", `/api/trips/${t.id}`, { status: "cancelled" })).status, 404);
    assert.equal((await as("Q", "DELETE", `/api/trips/${t.id}`)).status, 404);
    assert.equal((await as("Q", "POST", `/api/trips/${t.id}/send-message`, { message: "hi" })).status, 404);
    assert.equal((await tripNow(t.id)).status, "planned");
  });
  it("a parent token cannot use the provider trip API at all", async () => {
    const t = await trip({ childNames: [A1] });
    assert.equal((await as("A", "GET", "/api/trips")).status, 403);
    assert.equal((await as("A", "PUT", `/api/trips/${t.id}`, { status: "cancelled" })).status, 403);
    assert.equal((await as("A", "POST", "/api/trips", { destination: "x", date: ukDay(5) })).status, 403);
  });
});

describe("who may edit a trip", () => {
  it("plain staff who are neither the lead nor the organiser cannot PUT (403), whatever they send", async () => {
    const t = await trip({ childNames: [A1] });
    for (const body of [{ status: "cancelled" }, { notes: "x" }, { checkpoints: [{ n: "Depart", counted: 0 }] }, { askConsent: false }]) {
      const r = await as(PLAIN, "PUT", `/api/trips/${t.id}`, body);
      assert.equal(r.status, 403, `${JSON.stringify(body)} -> ${r.status}`);
    }
    assert.equal((await tripNow(t.id)).status, "planned");
  });
  it("the named trip lead (staff whose account name matches) can", async () => {
    const t = await trip({ childNames: [A1] });
    assert.equal((await as(LEAD, "PUT", `/api/trips/${t.id}`, { notes: "lead note" })).status, 200);
  });
  it("staff can edit a trip they planned themselves", async () => {
    const t = await trip({ childNames: [A1], lead: "Someone Else" }, PLAIN);
    assert.equal((await as(PLAIN, "PUT", `/api/trips/${t.id}`, { notes: "mine" })).status, 200);
    assert.equal((await as(LEAD, "PUT", `/api/trips/${t.id}`, { notes: "not mine" })).status, 403, "the lead of ANOTHER trip is not this trip's lead");
  });
  it("the owner can always edit", async () => {
    const t = await trip({ childNames: [A1] });
    assert.equal((await as("P", "PUT", `/api/trips/${t.id}`, { notes: "owner" })).status, 200);
  });
});

describe("medical text is for leads only", () => {
  it("plain staff get a flag, never the text, the emergency phone or the parent's email", async () => {
    const t = await trip({ childNames: [A1] });
    await consent("A", t.id, A1, "granted");
    const plain = await tripNow(t.id, PLAIN);
    assert.ok(plain, "plain staff still see the trip itself");
    const blob = JSON.stringify(plain);
    assert.ok(!blob.includes(MED), "no medical text");
    assert.ok(!blob.includes("parent-a@emu.test"), "no parent email");
    assert.equal(plain.attendees[0].medFlag, true);
  });
  it("the owner and the trip lead see the text", async () => {
    const t = await trip({ childNames: [A1] });
    assert.ok(JSON.stringify(await tripNow(t.id, "P")).includes(MED));
    assert.ok(JSON.stringify(await tripNow(t.id, LEAD)).includes(MED));
  });
  it("the staff member who planned the trip sees it", async () => {
    const t = await trip({ childNames: [A1], lead: "Someone Else" }, PLAIN);
    assert.ok(JSON.stringify(await tripNow(t.id, PLAIN)).includes(MED));
  });
  it("a family only ever sees its own child (no medical text, no other families' names)", async () => {
    const t = await trip({ childNames: [A1, B1] });
    const mine = (await as("A", "GET", "/api/my/trips")).json as any[];
    const row = mine.find((r) => r.id === t.id);
    assert.ok(row);
    const blob = JSON.stringify(row);
    assert.ok(!blob.includes(MED) && !blob.includes(B1));
  });
});

describe("cost is a real amount", () => {
  it("words, minus signs, commas and over-long decimals are refused on create and on edit", async () => {
    for (const bad of ["free", "-5", "10,50", "12.505", "£free"]) {
      const r = await as("P", "POST", "/api/trips", { destination: "x", date: ukDay(8), cost: bad });
      assert.equal(r.status, 400, `${bad} -> ${r.status}`);
    }
    const t = await trip();
    assert.equal((await as("P", "PUT", `/api/trips/${t.id}`, { cost: "lots" })).status, 400);
  });
  it("12.5 is stored as 12.50; blank and 0 are fine", async () => {
    const t = await trip({ cost: "12.5" });
    assert.equal(t.cost, "12.50");
    assert.equal((await as("P", "PUT", `/api/trips/${t.id}`, { cost: "0" })).status, 200);
    assert.equal((await as("P", "PUT", `/api/trips/${t.id}`, { cost: "" })).status, 200);
  });
});

describe("a child nobody can be asked about is surfaced, with a fix", () => {
  it("setup warns: the ghost (no booking) and the twin (two families, same name) are listed as unlinked", async () => {
    const t = await trip({ childNames: [A1, GHOST, TWIN] });
    assert.deepEqual([...(t.unlinked ?? [])].sort(), [GHOST, TWIN].sort());
    assert.deepEqual([...((await tripNow(t.id)).unlinked ?? [])].sort(), [GHOST, TWIN].sort());
    const b = t.attendees.find((a: any) => a.n === A1);
    assert.ok(b.childId, "the clean child is linked");
  });
  it("completion is refused with a message that names the child and says how to fix it", async () => {
    const t = await trip({ childNames: [A1, GHOST] });
    await consent("A", t.id, A1, "granted");
    const r = await as("P", "PUT", `/api/trips/${t.id}`, { status: "completed" });
    assert.equal(r.status, 409);
    assert.match(r.json.error, new RegExp(GHOST));
    assert.match(r.json.error, /isn.t linked|not linked|no booking/i);
    assert.match(r.json.error, /record|paper|pick|choose/i, "the fix is in the message");
  });
  it("recording the consent held on paper clears it", async () => {
    const t = await trip({ childNames: [A1, GHOST] });
    await consent("A", t.id, A1, "granted");
    const cur = await tripNow(t.id);
    const ok = await as("P", "PUT", `/api/trips/${t.id}`, { attendees: cur.attendees.map((a: any) => (a.n === GHOST ? { ...a, consent: "granted" } : a)) });
    assert.equal(ok.status, 200, JSON.stringify(ok.json).slice(0, 200));
    assert.equal((await as("P", "PUT", `/api/trips/${t.id}`, { status: "completed" })).status, 200);
  });
  it("an unlinked child never gets a consent request sent to the wrong family", async () => {
    const t = await trip({ childNames: [TWIN] });
    const mine = (await bells(t.id)).filter((b) => b.audience === "parent");
    assert.equal(mine.length, 0);
  });
});

describe("cancelling a trip tells the families", () => {
  it("every family still in (granted or waiting) gets a bell and an email; a declined family does not", async () => {
    const t = await trip({ childNames: [A1, B1, A2] });
    await consent("A", t.id, A1, "granted");
    await consent("A", t.id, A2, "declined");
    // B1 is still pending
    const r = await as("P", "PUT", `/api/trips/${t.id}`, { status: "cancelled" });
    assert.equal(r.status, 200, JSON.stringify(r.json).slice(0, 200));
    await new Promise((res) => setTimeout(res, 600));
    const all = (await bells(t.id)).filter((b) => b.audience === "parent" && /cancel/i.test(b.title));
    const to = all.map((b) => b.email).sort();
    assert.deepEqual(to, ["parent-a@emu.test", "parent-b@emu.test"], `bells: ${JSON.stringify(all.map((b) => [b.email, b.title]))}`);
    for (const b of all) {
      assert.match(b.body, /no payment/i);
      assert.ok(b.i18n?.tk, "carries an i18n key so the bell shows in the family's language");
      assert.ok(b.title.length <= 60);
    }
    const mails = (await (await adminDb()).collection("mailLog").where("to", "==", "parent-b@emu.test").get()).docs.map((d) => String(d.get("subject")));
    assert.ok(mails.some((s) => /cancel/i.test(s) && s.includes(t.destination)), `mails: ${mails.join(" | ")}`);
  });
  it("cancelling twice (or a stale PUT) does not notify twice", async () => {
    const t = await trip({ childNames: [B1] });
    await as("P", "PUT", `/api/trips/${t.id}`, { status: "cancelled" });
    await as("P", "PUT", `/api/trips/${t.id}`, { status: "cancelled", notes: "again" });
    await new Promise((res) => setTimeout(res, 600));
    assert.equal((await bells(t.id)).filter((b) => b.audience === "parent" && /cancel/i.test(b.title)).length, 1);
  });
  it("the parent's trips list no longer offers a consent tap on it", async () => {
    const t = await trip({ childNames: [A1] });
    await as("P", "PUT", `/api/trips/${t.id}`, { status: "cancelled" });
    assert.equal((await consent("A", t.id, A1, "granted")).status, 409);
  });
});
