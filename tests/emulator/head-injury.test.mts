// A head injury on an accident report tells the family at once, exactly once, from the server.
//  - head injury (tick, or the injury text names the head): one bell + one email for the linked parent, whatever the accident switch says
//  - other injuries follow the ordinary rule (the ordinary "accident recorded" bell), and send no head notice
//  - edit / retry never sends a second; an edit that turns an accident INTO a head injury sends one
//  - another provider cannot file against this child, and its own child's notice carries its own tenant only
// Real API + Firestore emulator. Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, EMAILS, ids, seedAddons } from "../../scripts/emu/addons-helpers.mts";

const u = () => Math.random().toString(36).slice(2, 7);
const NAME = `HeadKid ${u()}`;
const NAME2 = `HeadKid2 ${u()}`;
let kid = "", kid2 = "";

async function child(name: string, listing: string) {
  const k = await as("A", "POST", "/api/my/children", { name, dob: "2017-05-06" });
  assert.ok(k.ok, JSON.stringify(k.json));
  const b = await bookWithAddons({ parent: "A", listing, children: [{ name, days: [1] }] });
  assert.ok(b.ok, JSON.stringify(b.json).slice(0, 300));
  return k.json.id as string;
}
const report = (who: string, childId: string, childName: string, extra: Record<string, unknown> = {}) =>
  as(who, "POST", "/api/incidents", { kind: "accident", date: ids().generatedOn, time: "14:30", childId, childName, listingId: ids().listings.LK.id, description: "Tripped on the pitch", ...extra });
const settle = () => new Promise((r) => setTimeout(r, 1500));
async function bells(ref: string) {
  const db = await adminDb();
  const s = await db.collection("notifications").where("ref", "==", ref).get();
  return s.docs.map((d) => d.data());
}
const headBells = (all: any[]) => all.filter((b) => b.i18n?.tk === "p7shell.bellHeadTitle");

before(async () => {
  await seedAddons();
  kid = await child(NAME, "LK");
  kid2 = await child(NAME2, "LK");
});

describe("head injury notice", () => {
  it("a head injury sends exactly one bell + one email to the parent, and no second ordinary message", async () => {
    const r = await report("P", kid, NAME, { injury: "Bump to the head", severity: "moderate" });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    await settle();
    const all = await bells(r.json.id);
    assert.equal(all.length, 1, JSON.stringify(all.map((b) => b.title)));
    const h = headBells(all);
    assert.equal(h.length, 1);
    assert.equal(h[0].email, EMAILS.A);
    assert.equal(h[0].tenantId, ids().listings.LK.tenantId);
    assert.ok(["sent", "suppressed"].includes(h[0].emailStatus), `email status ${h[0].emailStatus}`);
    assert.match(h[0].body, /headache/);
    assert.ok(h[0].body.includes(NAME) && h[0].body.includes("14:30"));
    assert.ok(h[0].i18n.bk === "p7shell.bellHeadBody" && h[0].i18n.bv.name === NAME);
    const rec = (await (await adminDb()).collection("incidents").doc(r.json.id).get()).data()!;
    assert.ok(rec.headInjuryNotifiedAt && rec.parentNotified === true);
  });

  it("the explicit head-injury tick works without any injury text", async () => {
    const r = await report("P", kid, NAME, { headInjury: true, injury: "Knock" });
    await settle();
    assert.equal(headBells(await bells(r.json.id)).length, 1);
  });

  it("an edit or retry does not send a second notice", async () => {
    const r = await report("P", kid, NAME, { injury: "Bump to the head" });
    await settle();
    for (let i = 0; i < 2; i++) {
      const e = await as("P", "PUT", `/api/incidents/${r.json.id}`, { description: `Edited ${i}`, injury: "Bump to the head", notifyParentOfEdit: true });
      assert.equal(e.status, 200, JSON.stringify(e.json));
    }
    await settle();
    const all = await bells(r.json.id);
    assert.equal(headBells(all).length, 1);
    // The only other messages are the provider's own chosen "record updated" ones (notifyParentOfEdit), never a repeat head notice.
    assert.deepEqual(all.filter((b) => b.i18n?.tk !== "p7shell.bellHeadTitle").map((b) => /updated/.test(b.title)), [true, true]);
  });

  it("another injury follows the ordinary rule: the ordinary bell, no head notice", async () => {
    const r = await report("P", kid, NAME, { injury: "Grazed knee" });
    await settle();
    const all = await bells(r.json.id);
    assert.equal(headBells(all).length, 0);
    assert.equal(all.length, 1);
    assert.match(all[0].title, /accident was recorded/i);
  });

  it("an edit that turns an accident into a head injury sends one notice, once", async () => {
    const r = await report("P", kid, NAME, { injury: "Grazed knee" });
    await settle();
    for (let i = 0; i < 2; i++) await as("P", "PUT", `/api/incidents/${r.json.id}`, { injury: "Bump to the head" });
    await settle();
    assert.equal(headBells(await bells(r.json.id)).length, 1);
  });

  it("an incident (not an accident) never triggers it", async () => {
    const r = await report("P", kid, NAME, { kind: "incident", injury: "Bump to the head", incidentType: "Behaviour" });
    await settle();
    assert.equal(headBells(await bells(r.json.id)).length, 0);
  });

  it("another provider cannot file against this child, and nothing reaches the family", async () => {
    const r = await as("Q", "POST", "/api/incidents", { kind: "accident", date: ids().generatedOn, childId: kid2, childName: NAME2, description: "x", injury: "Bump to the head" });
    assert.equal(r.status, 403, JSON.stringify(r.json));
    await settle();
    const db = await adminDb();
    const s = await db.collection("notifications").where("email", "==", EMAILS.A).get();
    assert.ok(!s.docs.some((d) => (d.get("body") ?? "").includes(NAME2) && d.get("i18n")?.tk === "p7shell.bellHeadTitle"));
  });
});
