// Owner decisions 10 Oct: (a) deleting a child removes/anonymises its photos and moments within 30 days, statutory records stay;
// (b) a provider's access to a child's plan ends 90 days after the family's last booking with them.
// Real API + Firestore emulator; the sweeps are the real functions (server/src/lib/childRetention.ts). Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { call, db, login, makeProvider, uniq, type Provider } from "./helpers.mts";
import { childPhotoErasure, planAccessExpiry } from "../../server/src/lib/childRetention";

const u = uniq();
const now = () => new Date().toISOString();
const ukDay = (off = 0) => new Date(Date.now() + off * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const DAY = 86_400_000;
let P: Provider; let Q: Provider;
let tok = ""; let uid = ""; let email = "";

async function mkParent(tag: string) {
  const e = `ret-${tag}-${u}@emu.test`;
  const s = await login(e);
  await db.collection("users").doc(s.uid).set({ email: e, role: "parent", chosen: true, name: `Fam ${tag}` }, { merge: true });
  return { ...s, email: e };
}
const exists = async (col: string, id: string) => (await db.collection(col).doc(id).get()).exists;

before(async () => {
  P = await makeProvider("ret"); Q = await makeProvider("retq");
  const p = await mkParent("a"); tok = p.token; uid = p.uid; email = p.email;
});

describe("(a) deleting a child: photos and moments go within 30 days, statutory records stay", () => {
  let kid = ""; let otherKid = ""; let photoOnly = ""; let solo = ""; let group = ""; let work = ""; let otherSolo = "";
  let inc = ""; let sg = ""; let reg = ""; let bk = ""; let med = ""; let bell = ""; let ownPhoto = "";
  before(async () => {
    const img = async () => (await db.collection("images").add({ purpose: "private", dataUrl: "data:image/png;base64,AAAA", createdAt: now() })).id;
    ownPhoto = await img();
    kid = (await db.collection("children").add({ name: `Erase ${u}`, parentUid: uid, photoConsent: true, photo: `/api/images/${ownPhoto}`, dob: "2017-05-06" })).id;
    otherKid = (await db.collection("children").add({ name: `Stays ${u}`, parentUid: `other-${u}`, photoConsent: true })).id;
    photoOnly = await img();
    const soloImg = photoOnly;
    solo = (await db.collection("moments").add({ tenantId: P.tenantId, photoType: "child", photoUrl: `/api/images/${soloImg}?exp=1&sig=x`, caption: "solo", childIds: [kid], childNames: [`Erase ${u}`], createdAt: now() })).id;
    bell = (await db.collection("notifications").add({ tenantId: P.tenantId, category: "moment", ref: solo, email, title: "A new moment", body: "solo", at: now() })).id;
    const groupImg = await img();
    group = (await db.collection("moments").add({ tenantId: P.tenantId, photoType: "child", photoUrl: `/api/images/${groupImg}`, caption: "group", childIds: [kid, otherKid], childNames: [`Erase ${u}`, `Stays ${u}`], comments: [{ by: uid, role: "parent", text: "mine", at: now() }, { by: `other-${u}`, role: "parent", text: "theirs", at: now() }, { by: "staff", role: "staff", text: "nice", at: now() }], createdAt: now() })).id;
    work = (await db.collection("moments").add({ tenantId: P.tenantId, photoType: "work", photoUrl: `/api/images/${await img()}`, caption: "paintings", childIds: [kid, otherKid], childNames: ["a", "b"], createdAt: now() })).id;
    otherSolo = (await db.collection("moments").add({ tenantId: P.tenantId, photoType: "child", photoUrl: `/api/images/${await img()}`, childIds: [otherKid], childNames: ["Stays"], createdAt: now() })).id;
    inc = (await db.collection("incidents").add({ tenantId: P.tenantId, kind: "accident", childId: kid, childName: `Erase ${u}`, date: "2026-09-01", injury: "knee", photoUrl: `/api/images/${await img()}`, createdAt: now() })).id;
    sg = (await db.collection("incidents").add({ tenantId: P.tenantId, kind: "safeguarding", childId: kid, childName: `Erase ${u}`, date: "2026-09-02", description: "concern", confidential: true, createdAt: now() })).id;
    reg = (await db.collection("registers").add({ tenantId: P.tenantId, blockId: `b-${u}`, date: "2026-09-03", entries: { [`R${u}`]: { status: "in" } } })).id;
    bk = `${P.tenantId}_RT${u}`;
    await db.collection("bookings").doc(bk).set({ ref: `RT${u}`, tenantId: P.tenantId, email, childId: kid, child: `Erase ${u}`, status: "Confirmed", days: [ukDay(-60)], createdAt: now() });
    med = (await db.collection("medications").add({ tenantId: P.tenantId, childId: kid, childName: `Erase ${u}`, name: "Ventolin", dose: "2", consentGranted: true, createdAt: now() })).id;
  });

  it("deleting stamps a date 30 days out and removes nothing yet", async () => {
    const r = await call("DELETE", `/api/my/children/${kid}`, tok);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const c = (await db.collection("children").doc(kid).get()).data()!;
    assert.equal(c.archived, true);
    const days = (new Date(c.erasureDueAt).getTime() - new Date(c.archivedAt).getTime()) / DAY;
    assert.equal(Math.round(days), 30);
    assert.ok(await exists("moments", solo) && await exists("moments", group), "moments still there on day 0");
    const early = await childPhotoErasure(new Date(Date.now() + 10 * DAY).toISOString());
    assert.equal(early.children, 0, "nothing is erased before day 30");
    assert.ok(await exists("moments", solo) && await exists("images", photoOnly));
  });

  it("after 30 days the child's solo moment, photos and bell are gone; a group moment keeps the others", async () => {
    const r = await childPhotoErasure(new Date(Date.now() + 31 * DAY).toISOString());
    assert.ok(r.children >= 1);
    assert.ok(!(await exists("moments", solo)), "solo moment deleted");
    assert.ok(!(await exists("images", photoOnly)), "its photo file deleted");
    assert.ok(!(await exists("notifications", bell)), "its bell deleted");
    assert.ok(!(await exists("images", ownPhoto)), "profile photo file deleted");
    const g = (await db.collection("moments").doc(group).get()).data()!;
    assert.deepEqual(g.childIds, [otherKid]);
    assert.deepEqual(g.childNames, [`Stays ${u}`]);
    assert.equal(g.photoUrl, undefined, "a group picture of children cannot keep this child's face");
    assert.deepEqual(g.comments.map((c: any) => c.text).sort(), ["nice", "theirs"]);
    const w = (await db.collection("moments").doc(work).get()).data()!;
    assert.deepEqual(w.childIds, [otherKid]);
    assert.ok(w.photoUrl, "a photo of work (no faces) stays for the other child");
    assert.ok(await exists("moments", otherSolo), "another child's moment untouched");
    const c = (await db.collection("children").doc(kid).get()).data()!;
    assert.equal(c.photo, undefined);
    assert.equal(c.photoConsent, false);
    assert.ok(c.photosErasedAt && c.erasureDueAt === undefined);
  });

  it("statutory records survive: accident (with its photo), safeguarding concern, register, booking, medication", async () => {
    for (const [col, id] of [["incidents", inc], ["incidents", sg], ["registers", reg], ["bookings", bk], ["medications", med]] as const) assert.ok(await exists(col, id), `${col}/${id} was kept`);
    assert.ok((await db.collection("incidents").doc(inc).get()).get("photoUrl"), "the accident photo is part of the accident record");
    assert.equal((await db.collection("incidents").doc(sg).get()).get("description"), "concern");
  });

  it("running it again changes nothing", async () => {
    const snap = async () => JSON.stringify(await Promise.all(["moments/" + group, "moments/" + work, "children/" + kid].map(async (p) => { const [c, i] = p.split("/"); return (await db.collection(c).doc(i).get()).data(); })));
    const before = await snap();
    const r = await childPhotoErasure(new Date(Date.now() + 90 * DAY).toISOString());
    assert.equal(r.children, 0);
    assert.equal(r.momentsDeleted + r.momentsUntagged + r.photosDeleted, 0);
    assert.equal(await snap(), before);
  });

  it("a child that is not deleted is never erased, even with a stray due date", async () => {
    const live = (await db.collection("children").add({ name: `Live ${u}`, parentUid: uid, photoConsent: true, erasureDueAt: new Date(Date.now() - DAY).toISOString() })).id;
    const m = (await db.collection("moments").add({ tenantId: P.tenantId, photoType: "child", childIds: [live], childNames: ["Live"], caption: "x", createdAt: now() })).id;
    await childPhotoErasure();
    assert.ok(await exists("moments", m));
    assert.equal((await db.collection("children").doc(live).get()).get("erasureDueAt"), undefined);
  });
});

describe("(b) plan access ends 90 days after the last booking", () => {
  let file = ""; let kid = "";
  const fileRead = (who: Provider) => call("GET", `/api/my/files/${file}`, who.token);
  before(async () => {
    kid = (await db.collection("children").add({ name: `Plan ${u}`, parentUid: uid, dob: "2016-01-01" })).id;
    file = (await db.collection("childFiles").add({ ownerUid: uid, name: "plan.pdf", contentType: "application/pdf", bytes: 3, total: 1, complete: true, tenantIds: [P.tenantId, Q.tenantId], createdAt: new Date(Date.now() - 400 * DAY).toISOString() })).id;
    await db.collection("childFiles").doc(file).collection("chunks").doc("0").set({ b64: Buffer.from("PDF").toString("base64") });
    await db.collection("children").doc(kid).set({ sendPlanId: file }, { merge: true });
    // P: last booking ended 100 days ago.  Q: last booking ended 30 days ago.
    await db.collection("bookings").doc(`${P.tenantId}_PL${u}`).set({ ref: `PL${u}`, tenantId: P.tenantId, email, childId: kid, child: `Plan ${u}`, status: "Confirmed", days: [ukDay(-101), ukDay(-100)], createdAt: now() });
    await db.collection("bookings").doc(`${Q.tenantId}_PL${u}`).set({ ref: `PL${u}`, tenantId: Q.tenantId, email, childId: kid, child: `Plan ${u}`, status: "Confirmed", days: [ukDay(-30)], createdAt: now() });
    await db.collection("childFiles").doc(file).set({ accessReviewDue: ukDay(-1) }, { merge: true });
  });

  it("both providers can read it before the sweep", async () => {
    assert.equal((await fileRead(P)).status, 200);
    assert.equal((await fileRead(Q)).status, 200);
  });

  it("the sweep ends the provider whose last booking is over 90 days old and keeps the other", async () => {
    const r = await planAccessExpiry();
    assert.equal(r.revoked >= 1, true);
    const f = (await db.collection("childFiles").doc(file).get()).data()!;
    assert.deepEqual(f.tenantIds, [Q.tenantId]);
    assert.equal(f.accessReviewDue, ukDay(-30 + 90), "next review on the day Q's access will end");
    assert.equal((await fileRead(P)).status, 404, "P can no longer read the plan");
    assert.equal((await fileRead(Q)).status, 200);
    const parent = await call("GET", `/api/my/files/${file}`, tok);
    assert.equal(parent.status, 200, "the family always keeps its own file");
  });

  it("a second run changes nothing", async () => {
    const before = JSON.stringify((await db.collection("childFiles").doc(file).get()).data());
    const r = await planAccessExpiry();
    assert.equal(r.revoked, 0);
    assert.equal(JSON.stringify((await db.collection("childFiles").doc(file).get()).data()), before);
  });

  it("a future booking keeps access, a cancelled one does not count, and 90 days later it ends", async () => {
    await db.collection("bookings").doc(`${Q.tenantId}_PL2${u}`).set({ ref: `PL2${u}`, tenantId: Q.tenantId, email, childId: kid, child: `Plan ${u}`, status: "Confirmed", days: [ukDay(20)], createdAt: now() });
    await db.collection("bookings").doc(`${P.tenantId}_PL3${u}`).set({ ref: `PL3${u}`, tenantId: P.tenantId, email, childId: kid, child: `Plan ${u}`, status: "Cancelled", days: [ukDay(5)], createdAt: now() });
    await db.collection("childFiles").doc(file).set({ accessReviewDue: ukDay(0), tenantIds: [P.tenantId, Q.tenantId] }, { merge: true });
    await planAccessExpiry();
    let f = (await db.collection("childFiles").doc(file).get()).data()!;
    assert.deepEqual(f.tenantIds, [Q.tenantId], "Q kept (booked ahead); P still out (its only newer booking is cancelled)");
    assert.equal(f.accessReviewDue, ukDay(20 + 90));
    await planAccessExpiry(ukDay(20 + 91));
    f = (await db.collection("childFiles").doc(file).get()).data()!;
    assert.deepEqual(f.tenantIds, []);
    assert.equal(f.accessReviewDue, undefined, "nothing left to review");
  });

  it("a new booking re-grants access through the booking route's grant", async () => {
    const { grantPlanAccess } = await import("../../server/src/routes/childFiles");
    await grantPlanAccess([file], P.tenantId);
    const f = (await db.collection("childFiles").doc(file).get()).data()!;
    assert.deepEqual(f.tenantIds, [P.tenantId]);
    assert.ok(f.tenantGrants[P.tenantId] && f.accessReviewDue);
    assert.equal((await fileRead(P)).status, 200);
  });
});
