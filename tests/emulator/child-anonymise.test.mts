// Owner decisions 10 Oct (answers): at the 30-day erasure the deleted child's profile is ANONYMISED (id and links kept) and its plan
// file is deleted outright; statutory records are left exactly as they were. Real API + Firestore emulator; the sweep is the real function.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { call, db, login, makeProvider, uniq, type Provider } from "./helpers.mts";
import { childPhotoErasure, backfillErasureDates } from "../../server/src/lib/childRetention";

const u = uniq();
const DAY = 86_400_000;
const now = () => new Date().toISOString();
const NAME = `Zebediah-${u}`;
let P: Provider; let tok = ""; let uid = ""; let email = "";
let kid = ""; let file = ""; let inc = ""; let sg = ""; let reg = ""; let bk = ""; let med = ""; let crm = "";
const snap = async (col: string, id: string) => JSON.stringify((await db.collection(col).doc(id).get()).data());

before(async () => {
  P = await makeProvider("anon");
  email = `anon-${u}@emu.test`;
  const s = await login(email); tok = s.token; uid = s.uid;
  await db.collection("users").doc(uid).set({ email, role: "parent", chosen: true, name: `Fam ${u}` }, { merge: true });
  file = (await db.collection("childFiles").add({ ownerUid: uid, name: `ehcp-${NAME}.pdf`, contentType: "application/pdf", bytes: 6, total: 2, complete: true, tenantIds: [P.tenantId], tenantGrants: { [P.tenantId]: now() }, accessReviewDue: "2099-01-01", createdAt: now() })).id;
  for (const n of [0, 1]) await db.collection("childFiles").doc(file).collection("chunks").doc(String(n)).set({ b64: "UERG" });
  kid = (await db.collection("children").add({
    name: NAME, dob: "2016-03-09", age: 10, parentUid: uid, createdAt: now(), allergies: `nuts-${u}`, medical: `asthma-${u}`, send: `dyslexia-${u}`, sendPlanId: file, sendPlanName: "ehcp.pdf",
    emergencyName: `Gran-${u}`, emergencyPhone: "07700900999", collectionPassword: `pw-${u}`, likes: `trains-${u}`, dislikes: "loud", answers: { q1: `free-text-${u}` }, notes: `note-${u}`, photo: "", photoConsent: true,
  })).id;
  inc = (await db.collection("incidents").add({ tenantId: P.tenantId, kind: "accident", childId: kid, childName: NAME, date: "2026-09-01", injury: "knee", createdAt: now() })).id;
  sg = (await db.collection("incidents").add({ tenantId: P.tenantId, kind: "safeguarding", childId: kid, childName: NAME, date: "2026-09-02", description: "concern", confidential: true, createdAt: now() })).id;
  reg = (await db.collection("registers").add({ tenantId: P.tenantId, blockId: `b-${u}`, date: "2026-09-03", entries: { [`R${u}`]: { status: "in", name: NAME } } })).id;
  bk = (await db.collection("bookings").add({ ref: `AN${u}`, tenantId: P.tenantId, email, childId: kid, child: NAME, status: "Confirmed", days: ["2026-09-03"], createdAt: now() })).id;
  med = (await db.collection("medications").add({ tenantId: P.tenantId, childId: kid, childName: NAME, name: "Ventolin", dose: "2", consentGranted: true, createdAt: now() })).id;
  crm = (await db.collection("customers").add({ tenantId: P.tenantId, name: "F", email, children: [{ name: NAME, age: 10, childId: kid }, { name: "Sibling", childId: "other" }] })).id;
});

describe("anonymise at 30 days", () => {
  let statutory: string[] = [];
  it("nothing changes before the date; deleting sets it", async () => {
    assert.equal((await call("DELETE", `/api/my/children/${kid}`, tok)).status, 200);
    await childPhotoErasure(new Date(Date.now() + 10 * DAY).toISOString());
    assert.equal((await db.collection("children").doc(kid).get()).get("name"), NAME);
    assert.ok((await db.collection("childFiles").doc(file).get()).exists);
    statutory = await Promise.all([["incidents", inc], ["incidents", sg], ["registers", reg], ["bookings", bk], ["medications", med]].map(([c, i]) => snap(c, i)));
  });

  it("the profile keeps only its id, links, deletion dates, a neutral name and the birth year", async () => {
    await childPhotoErasure(new Date(Date.now() + 31 * DAY).toISOString());
    const c = (await db.collection("children").doc(kid).get()).data()!;
    assert.deepEqual(Object.keys(c).sort(), ["anonymisedAt", "archived", "archivedAt", "birthYear", "createdAt", "name", "parentUid", "photoConsent", "photosErasedAt"]);
    assert.equal(c.name, "Deleted child"); assert.equal(c.birthYear, 2016); assert.equal(c.parentUid, uid); assert.equal(c.archived, true);
    assert.ok(!JSON.stringify(c).includes(u), "no trace of the old name or any free text");
  });

  it("the plan file is gone: document, every chunk and every grant", async () => {
    assert.ok(!(await db.collection("childFiles").doc(file).get()).exists);
    assert.equal((await db.collection("childFiles").doc(file).collection("chunks").get()).size, 0);
    const r = await call("GET", `/api/my/files/${file}`, P.token);
    assert.equal(r.status, 404);
    assert.equal((await call("GET", `/api/my/files/${file}`, tok)).status, 404);
  });

  it("statutory records are untouched and still resolve to the child's id", async () => {
    const after = await Promise.all([["incidents", inc], ["incidents", sg], ["registers", reg], ["bookings", bk], ["medications", med]].map(([c, i]) => snap(c, i)));
    assert.deepEqual(after, statutory);
    assert.equal(JSON.parse(after[3]).childId, kid);
  });

  it("the provider's family record, the parent's child list and the export no longer show the old name in profile sections", async () => {
    const list = await call("GET", "/api/my/children", tok);
    assert.ok(!JSON.stringify(list.json).includes(NAME));
    const exp = await call("GET", "/api/privacy/export", tok);
    assert.equal(exp.json.children.find((c: any) => c.id === kid)?.name, "Deleted child");
    assert.ok(!JSON.stringify(exp.json.providerFamilyRecords).includes(NAME));
    assert.deepEqual((await db.collection("customers").doc(crm).get()).get("children").map((k: any) => k.name), ["Deleted child", "Sibling"]);
    // Where the name still is (statutory snapshots, deliberately untouched): recorded for the report.
    const where = Object.entries(exp.json).filter(([, v]) => JSON.stringify(v).includes(NAME)).map(([k]) => k).sort();
    console.log("OLD NAME STILL IN EXPORT SECTIONS:", where.join(","));
    assert.ok(!where.includes("children") && !where.includes("providerFamilyRecords"));
  });

  it("running it again changes nothing", async () => {
    const before = await snap("children", kid);
    const r = await childPhotoErasure(new Date(Date.now() + 90 * DAY).toISOString());
    assert.equal(await snap("children", kid), before);
    assert.equal(r.photosDeleted, 0);
  });

  it("a plan file still used by a live child is not deleted", async () => {
    const f = (await db.collection("childFiles").add({ ownerUid: uid, name: "shared.pdf", contentType: "application/pdf", bytes: 1, total: 1, complete: true, tenantIds: [], createdAt: now() })).id;
    const live = (await db.collection("children").add({ name: `Live ${u}`, parentUid: uid, sendPlanId: f })).id;
    const gone = (await db.collection("children").add({ name: `Gone ${u}`, parentUid: uid, sendPlanId: f, archived: true, archivedAt: now(), erasureDueAt: new Date(Date.now() - DAY).toISOString() })).id;
    await childPhotoErasure();
    assert.ok((await db.collection("childFiles").doc(f).get()).exists);
    assert.equal((await db.collection("children").doc(gone).get()).get("name"), "Deleted child");
    assert.equal((await db.collection("children").doc(live).get()).get("name"), `Live ${u}`);
  });

  it("the backfill dry run counts the plan files that would be deleted and writes nothing", async () => {
    const f = (await db.collection("childFiles").add({ ownerUid: uid, name: "o.pdf", contentType: "application/pdf", bytes: 1, total: 1, complete: true, tenantIds: [], createdAt: now() })).id;
    const old = (await db.collection("children").add({ name: `Old ${u}`, parentUid: uid, sendPlanId: f, archived: true, archivedAt: new Date(Date.now() - 50 * DAY).toISOString() })).id;
    const earlier = (await db.collection("children").add({ name: `Earlier ${u}`, parentUid: uid, archived: true, archivedAt: now(), photosErasedAt: now() })).id;
    const d = await backfillErasureDates(false);
    assert.ok(d.candidates >= 1 && d.withPlanFile >= 1 && d.erasedNotAnonymised >= 1);
    assert.equal((await db.collection("children").doc(old).get()).get("erasureDueAt"), undefined);
    await backfillErasureDates(true);
    assert.ok((await db.collection("children").doc(earlier).get()).get("erasureDueAt"), "erased-but-not-anonymised child is scheduled");
    await childPhotoErasure();
    assert.equal((await db.collection("children").doc(earlier).get()).get("name"), "Deleted child");
    assert.ok(!(await db.collection("childFiles").doc(f).get()).exists);
  });
});
