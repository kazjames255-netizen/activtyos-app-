// A confidential accident never sends record text on ANY path (create, edit, note, provider reply, export, bells, list).
// Real API + Firestore emulator. Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, EMAILS, ids, seedAddons } from "../../scripts/emu/addons-helpers.mts";

const u = () => Math.random().toString(36).slice(2, 7);
const settle = (ms = 2200) => new Promise((r) => setTimeout(r, ms));
const NAME = `ConfKid ${u()}`;
let kid = "";

before(async () => {
  await seedAddons();
  const k = await as("A", "POST", "/api/my/children", { name: NAME, dob: "2017-05-06" });
  assert.ok(k.ok, JSON.stringify(k.json));
  kid = k.json.id;
  const b = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: NAME, days: [1] }] });
  assert.ok(b.ok, JSON.stringify(b.json).slice(0, 300));
});

describe("confidential accident: one neutral rule on every path", () => {
  it("create, edit (notify on), staff note and export never carry the record text", async () => {
    const S = `CONFSECRET-${u()}`;
    const r = await as("P", "POST", "/api/incidents", { kind: "accident", date: ids().generatedOn, childName: NAME, childId: kid, listingId: ids().listings.LK.id, description: S, injury: `inj-${S}`, treatment: `trt-${S}`, actionTaken: `act-${S}`, confidential: true });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const id = r.json.id as string;
    await settle();
    const e = await as("P", "PUT", `/api/incidents/${id}`, { description: `edited-${S}`, notifyParentOfEdit: true });
    assert.equal(e.status, 200, JSON.stringify(e.json));
    const n = await as("P", "POST", `/api/incidents/${id}/note`, { text: `note-${S}` });
    assert.equal(n.status, 201, JSON.stringify(n.json));
    await settle();
    const db = await adminDb();
    const bells = (await db.collection("notifications").where("ref", "==", id).get()).docs.map((d) => d.data() as any).filter((b) => b.audience === "parent");
    const mails = (await db.collection("mailLog").where("to", "==", EMAILS.A.toLowerCase()).get()).docs.map((d) => d.data() as any);
    assert.ok(bells.length >= 2, "the family is told neutrally (created + updated)");
    assert.ok(!JSON.stringify(bells).includes(S), "record text in a parent bell");
    assert.ok(!JSON.stringify(mails).includes(S), "record text in an email");
    assert.ok(mails.some((m) => String(m.subject).includes(NAME)), "a neutral email was sent");
    const ex = await as("A", "GET", "/api/privacy/export");
    assert.ok(!JSON.stringify(ex.json).includes(S), "record text in the export");
    const list = await as("A", "GET", "/api/incidents");
    assert.ok(!JSON.stringify(list.json).includes(S), "record text in the parent list");
  });
  it("confidential + shareWithParent is a 400", async () => {
    const r = await as("P", "POST", "/api/incidents", { kind: "accident", date: ids().generatedOn, childName: NAME, childId: kid, description: "x", injury: "graze", confidential: true, shareWithParent: true });
    assert.equal(r.status, 400);
  });
});
