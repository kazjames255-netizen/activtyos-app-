// One malformed record must not block the daily retention sweeps: each child, moment and plan file is handled on its own, failures are
// counted and logged with ids only, and the failed child stays due so the next run retries it. Real emulator; real sweep functions.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { db, login, makeProvider, uniq, type Provider } from "./helpers.mts";
import { childPhotoErasure, planAccessExpiry } from "../../server/src/lib/childRetention";

const u = uniq();
const DAY = 86_400_000;
const now = () => new Date().toISOString();
let P: Provider; let uid = "";

before(async () => {
  P = await makeProvider("rob");
  const s = await login(`rob-${u}@emu.test`); uid = s.uid;
  await db.collection("users").doc(uid).set({ email: `rob-${u}@emu.test`, role: "parent", chosen: true }, { merge: true });
});

describe("child photo erasure survives a malformed moment", () => {
  it("the broken child is counted, left due and retried; the good child later in the queue is still anonymised", async () => {
    const bad = (await db.collection("children").add({ name: `BadKid ${u}`, parentUid: uid, archived: true, archivedAt: now(), erasureDueAt: new Date(Date.now() - 3 * DAY).toISOString() })).id;
    const other = (await db.collection("children").add({ name: "Sib", parentUid: uid })).id;
    // a group moment whose comments is not a list: the untag step throws on it
    const m = (await db.collection("moments").add({ tenantId: P.tenantId, photoType: "child", childIds: [bad, other], childNames: ["a", "b"], comments: { oops: true }, createdAt: now() })).id;
    const good = (await db.collection("children").add({ name: `GoodKid ${u}`, parentUid: uid, allergies: "x", archived: true, archivedAt: now(), erasureDueAt: new Date(Date.now() - DAY).toISOString() })).id;
    const r = await childPhotoErasure();
    assert.equal(r.failures, 1);
    assert.equal((await db.collection("children").doc(good).get()).get("name"), "Deleted child", "the good child was not blocked");
    const b = (await db.collection("children").doc(bad).get()).data()!;
    assert.equal(b.name, `BadKid ${u}`, "the broken child is NOT anonymised while its moment could not be cleaned");
    assert.ok(b.erasureDueAt, "still due: retried next run");
    assert.deepEqual((await db.collection("moments").doc(m).get()).get("childIds"), [bad, other]);
    // fixed data -> next run completes it
    await db.collection("moments").doc(m).set({ comments: [] }, { merge: true });
    const r2 = await childPhotoErasure();
    assert.equal(r2.failures, 0);
    assert.equal((await db.collection("children").doc(bad).get()).get("name"), "Deleted child");
    assert.deepEqual((await db.collection("moments").doc(m).get()).get("childIds"), [other]);
  });
});

describe("plan access expiry survives a malformed file", () => {
  it("a file that throws is counted; the good file is still processed", async () => {
    const old = new Date(Date.now() - 500 * DAY).toISOString();
    const broken = (await db.collection("childFiles").add({ ownerUid: uid, name: "b.pdf", total: 1, complete: true, tenantIds: [{ not: "a string" }], accessReviewDue: "2000-01-01", createdAt: old })).id;
    const good = (await db.collection("childFiles").add({ ownerUid: uid, name: "g.pdf", total: 1, complete: true, tenantIds: [P.tenantId], accessReviewDue: "2000-01-02", createdAt: old })).id;
    const r = await planAccessExpiry();
    assert.equal(r.failures, 1);
    assert.deepEqual((await db.collection("childFiles").doc(good).get()).get("tenantIds"), [], "the good file was still processed");
    assert.ok((await db.collection("childFiles").doc(broken).get()).exists);
  });
});
