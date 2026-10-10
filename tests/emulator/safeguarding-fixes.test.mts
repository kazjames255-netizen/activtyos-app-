// Safeguarding fixes (blind-tester run, 10 Oct): S19 parent view allow-list, S24 confidential note emails, S25 lost notes,
// S46 dossier never guesses a child by name, S52 attachments, S10 duplicate posts, S47 dossier read cost.
// Real API + Firestore emulator. Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { adminDb, API, as, bookWithAddons, EMAILS, ids, seedAddons } from "../../scripts/emu/addons-helpers.mts";

const u = () => Math.random().toString(36).slice(2, 7);
const settle = (ms = 1800) => new Promise((r) => setTimeout(r, ms));
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function child(parent: string, name: string, listing = "LK") {
  const k = await as(parent, "POST", "/api/my/children", { name, dob: "2017-05-06" });
  assert.ok(k.ok, JSON.stringify(k.json));
  const b = await bookWithAddons({ parent, listing, children: [{ name, days: [1] }] });
  assert.ok(b.ok, JSON.stringify(b.json).slice(0, 300));
  return k.json.id as string;
}
const base = (childId: string | undefined, childName: string, extra: Record<string, unknown> = {}) => ({
  kind: "accident", date: ids().generatedOn, childName, ...(childId ? { childId } : {}), listingId: ids().listings.LK.id, description: `desc ${u()}`, ...extra,
});
async function bells(ref: string) {
  const s = await (await adminDb()).collection("notifications").where("ref", "==", ref).get();
  return s.docs.map((d) => d.data() as any);
}
async function mailsTo(to: string) {
  const s = await (await adminDb()).collection("mailLog").where("to", "==", to.toLowerCase()).get();
  return s.docs.map((d) => d.data() as any);
}
async function upload(who: string, purpose: "private" | "public") {
  const r = await as(who, "POST", "/api/uploads", { dataUrl: PNG, purpose });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r.json.id as string;
}
/** every key and string value anywhere in a JSON value */
function walk(v: unknown, keys: string[] = [], strs: string[] = []) {
  if (Array.isArray(v)) v.forEach((x) => walk(x, keys, strs));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { keys.push(k); walk(x, keys, strs); }
  else if (typeof v === "string") strs.push(v);
  return { keys, strs };
}
async function readsFor(label: string) {
  const r = await fetch(`${API}/internal/read-stats?top=500`);
  const j: any = await r.json();
  return (j.top.find((x: any) => x.label === label)?.reads ?? 0) as number;
}

let kidA = "";
const NAME = `SgKid ${u()}`;
before(async () => {
  await seedAddons();
  kidA = await child("A", NAME);
});

describe("S19 parent list is an allow-list", () => {
  it("a shared safeguarding concern shows the parent nothing internal", async () => {
    const sentinels = { dslOutcome: `OUTCOME-${u()}`, voice: `VOICE-${u()}`, ref: `MASH-${u()}`, rt: `RT-${u()}`, la: `LA-${u()}`, act: `ACT-${u()}`, lognote: `LOGNOTE-${u()}` };
    const r = await as("P", "POST", "/api/incidents", base(kidA, NAME, {
      kind: "safeguarding", subject: "child", shareWithParent: true, description: "We would like to talk to you",
      followUp: "Please phone the office", childVoice: sentinels.voice, reportedTo: sentinels.rt, externalReferral: sentinels.ref, localAuthority: sentinels.la,
      dslOutcome: sentinels.dslOutcome, dslActions: [sentinels.act],
      dslLog: [{ id: "l1", key: "k", label: "Spoke", note: sentinels.lognote, at: "2026-10-09T10:00:00Z", by: "dsl@x.test" }],
    }));
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const l = await as("A", "GET", "/api/incidents");
    assert.equal(l.status, 200);
    const mine = (l.json as any[]).find((x) => x.id === r.json.id);
    assert.ok(mine, "shared concern is listed");
    assert.ok(mine.date && mine.kind && mine.childName, "the parent still gets date, kind and child name");
    assert.equal(mine.description, "We would like to talk to you");
    assert.equal(mine.followUp, "Please phone the office");
    const { keys, strs } = walk(l.json);
    for (const k of ["recordedBy", "recordedByName", "dslLog", "dslOutcome", "dslActions", "dslActionedAt", "externalReferral", "childVoice", "reportedTo", "reportedToRole", "localAuthority", "concernCategory", "concernType", "franchiseId", "aboutDsl", "confidential", "bodyMap", "witnesses", "shareWithReporter"]) {
      assert.ok(!keys.includes(k), `parent list leaks key ${k}`);
    }
    const all = strs.join("\n");
    for (const s of Object.values(sentinels)) assert.ok(!all.includes(s), `parent list leaks ${s}`);
    assert.ok(!all.includes(EMAILS.P) && !all.includes("dsl@x.test"), "staff email leaks");
  });
  it("an ordinary accident still shows everything the parent screen uses", async () => {
    const r = await as("P", "POST", "/api/incidents", base(kidA, NAME, { injury: "Grazed knee", treatment: "Plaster", firstAider: "Pat", location: "Pitch", severity: "minor", followUp: "Watch it" }));
    assert.equal(r.status, 201);
    const mine = ((await as("A", "GET", "/api/incidents")).json as any[]).find((x) => x.id === r.json.id);
    for (const k of ["injury", "treatment", "firstAider", "location", "severity", "followUp", "date", "description", "childName", "kind"]) assert.ok(mine[k] !== undefined, `missing ${k}`);
    assert.equal(typeof mine.requireAck, "boolean");
    assert.ok(!("recordedBy" in mine));
  });
});

describe("S24 a staff note on a confidential accident never emails the note text", () => {
  it("neutral line only, and ordinary accidents still send the reply", async () => {
    const conf = await as("P", "POST", "/api/incidents", base(kidA, NAME, { confidential: true }));
    assert.equal(conf.status, 201);
    const ord = await as("P", "POST", "/api/incidents", base(kidA, NAME));
    await settle();
    const secret = `SECRETNOTE${u()}`;
    const n1 = await as("P", "POST", `/api/incidents/${conf.json.id}/note`, { text: secret });
    assert.equal(n1.status, 201, JSON.stringify(n1.json));
    const okText = `VISIBLENOTE${u()}`;
    const n2 = await as("P", "POST", `/api/incidents/${ord.json.id}/note`, { text: okText });
    assert.equal(n2.status, 201);
    await settle();
    const cb = await bells(conf.json.id);
    assert.ok(!JSON.stringify(cb).includes(secret), "note text in a bell/email record of a confidential accident");
    const mails = JSON.stringify(await mailsTo(EMAILS.A));
    assert.ok(!mails.includes(secret), "note text emailed");
    assert.ok(mails.includes(okText) || JSON.stringify(await bells(ord.json.id)).includes(okText), "control: an ordinary accident still sends the reply");
  });
});

describe("S25 notes are appended atomically", () => {
  it("20 parallel notes (parent and staff) are all stored", async () => {
    const r = await as("P", "POST", "/api/incidents", base(kidA, NAME));
    assert.equal(r.status, 201);
    const tag = u();
    const calls = Array.from({ length: 20 }, (_, i) => as(i % 2 ? "A" : "P", "POST", `/api/incidents/${r.json.id}/note`, { text: `n${i} ${tag}` }));
    const res = await Promise.all(calls);
    assert.deepEqual(res.map((x) => x.status), Array(20).fill(201), JSON.stringify(res.map((x) => x.json).slice(0, 2)));
    const rec = (await (await adminDb()).collection("incidents").doc(r.json.id).get()).data()!;
    assert.equal((rec.notes ?? []).length, 20);
    assert.equal(new Set((rec.notes ?? []).map((x: any) => x.text)).size, 20);
    const sameText = await Promise.all([as("A", "POST", `/api/incidents/${r.json.id}/note`, { text: "same" }), as("A", "POST", `/api/incidents/${r.json.id}/note`, { text: "same" })]);
    assert.deepEqual(sameText.map((x) => x.status), [201, 201]);
    const rec2 = (await (await adminDb()).collection("incidents").doc(r.json.id).get()).data()!;
    assert.equal(rec2.notes.length, 22, "two identical notes are two notes");
  });
});

describe("S46 the dossier never guesses a child by name", () => {
  it("a record with no childId gets no parent, no bookings, and a clear marker", async () => {
    const twin = `Twin ${u()}`;
    const k1 = await child("A", twin);
    const k2 = await child("B", twin);
    void k1; void k2;
    const idless = await as("P", "POST", "/api/incidents", base(undefined, twin, { description: "walk-in" }));
    assert.equal(idless.status, 201);
    const d = await as("P", "GET", `/api/incidents/${idless.json.id}/dossier`);
    assert.equal(d.status, 200);
    assert.equal(d.json.parent, null);
    assert.equal(d.json.child, null);
    assert.deepEqual(d.json.bookings, []);
    assert.deepEqual(d.json.siblings, []);
    assert.deepEqual(d.json.history, []);
    assert.equal(d.json.unlinked, true);
    assert.match(String(d.json.unlinkedNote), /not linked to a child profile/i);
    const s = JSON.stringify(d.json);
    assert.ok(!s.includes(EMAILS.A) && !s.includes(EMAILS.B), "a family's contact details came back by name");
  });
  it("a linked record's history does not pull in a same-named record that has no childId", async () => {
    const nm = `Hist ${u()}`;
    const kid = await child("A", nm);
    const linked = await as("P", "POST", "/api/incidents", base(kid, nm, { description: "linked one" }));
    const linked2 = await as("P", "POST", "/api/incidents", base(kid, nm, { description: "linked two" }));
    await as("P", "POST", "/api/incidents", base(undefined, nm, { description: "IDLESS-SAME-NAME" }));
    const d = await as("P", "GET", `/api/incidents/${linked.json.id}/dossier`);
    assert.equal(d.status, 200);
    assert.equal(d.json.unlinked, undefined);
    const hist = JSON.stringify(d.json.history);
    assert.ok(hist.includes("linked two") && !hist.includes("IDLESS-SAME-NAME"), hist);
    assert.equal(d.json.parent?.email, EMAILS.A);
    assert.ok(d.json.bookings.length >= 1);
    void linked2;
  });
});

describe("S52 attachments", () => {
  it("accepts only this tenant's own private images, refuses everything else", async () => {
    const own = await upload("P", "private");
    const foreign = await upload("Q", "private");
    const pub = await upload("P", "public");
    const host = API;
    const bad: string[] = [`${host}/api/images/${foreign}`, `/api/uploads/${foreign}`, "https://evil.test/x.png", "javascript:1", `https://evil.test/api/images/${own}`.replace("evil.test", "evil.test"), `${host}/api/images/${pub}`, `${host}/api/images/doesnotexist1234`, `${host}/api/images/${own}/../${foreign}`];
    for (const a of bad) {
      const r = await as("P", "POST", "/api/incidents", base(kidA, NAME, { attachments: [a] }));
      if (a === `https://evil.test/api/images/${own}`) { // a foreign host with our own id is normalised to our host, never stored as given
        assert.equal(r.status, 201); const rec = (await (await adminDb()).collection("incidents").doc(r.json.id).get()).data()!;
        assert.ok(String(rec.attachments[0]).startsWith(API), rec.attachments[0]); continue;
      }
      assert.equal(r.status, 400, `${a} -> ${r.status}`);
    }
    const ok = await as("P", "POST", "/api/incidents", base(kidA, NAME, { attachments: [`${host}/api/images/${own}`], photoUrl: `${host}/api/images/${own}` }));
    assert.equal(ok.status, 201, JSON.stringify(ok.json));
    const mine = ((await as("P", "GET", "/api/incidents")).json as any[]).find((x) => x.id === ok.json.id);
    assert.ok(mine.attachments[0].includes("sig="), "own image is signed");
    const badPhoto = await as("P", "POST", "/api/incidents", base(kidA, NAME, { photoUrl: `${host}/api/images/${foreign}` }));
    assert.equal(badPhoto.status, 400);
    const put = await as("P", "PUT", `/api/incidents/${ok.json.id}`, { attachments: [`${host}/api/images/${foreign}`] });
    assert.equal(put.status, 400);
  });
  it("a foreign image id already stored (legacy) is never signed on a list", async () => {
    const foreign = await upload("Q", "private");
    const r = await as("P", "POST", "/api/incidents", base(kidA, NAME));
    await (await adminDb()).collection("incidents").doc(r.json.id).set({ attachments: [`${API}/api/images/${foreign}`, "https://evil.test/x.png", "javascript:1"], photoUrl: `${API}/api/images/${foreign}` }, { merge: true });
    for (const who of ["P", "A"]) {
      const mine = ((await as(who, "GET", "/api/incidents")).json as any[]).find((x) => x.id === r.json.id);
      assert.ok(mine, who);
      const s = JSON.stringify([mine.attachments ?? [], mine.photoUrl ?? ""]);
      assert.ok(!s.includes("sig="), `${who}: signed a foreign id: ${s}`);
      assert.ok(!s.includes("evil.test") && !s.includes("javascript:"), s);
    }
  });
});

describe("S10 duplicate posts are one record and one email", () => {
  it("two identical parallel posts: one record, one email, same id; the head-injury notice stays once", async () => {
    const nm = `Dup ${u()}`;
    const kid = await child("A", nm);
    const body = base(kid, nm, { injury: "Bump to the head", description: `dup ${u()}`, time: "10:15" });
    const [r1, r2] = await Promise.all([as("P", "POST", "/api/incidents", body), as("P", "POST", "/api/incidents", body)]);
    assert.ok(r1.ok && r2.ok, `${r1.status}/${r2.status}`);
    assert.equal(r1.json.id, r2.json.id, "same record returned");
    await settle(2500);
    const recs = await (await adminDb()).collection("incidents").where("childId", "==", kid).get();
    assert.equal(recs.size, 1);
    const sent = (await mailsTo(EMAILS.A)).filter((m) => `${m.subject}${m.html}`.includes(nm) && !/book/i.test(String(m.subject))); const mails = sent.length;
    assert.equal(mails, 1, `emails ${mails}`);
    assert.equal((await bells(r1.json.id)).length, 1);
  });
  it("a different description is a new record", async () => {
    const nm = `Dup2 ${u()}`;
    const kid = await child("A", nm);
    const a = await as("P", "POST", "/api/incidents", base(kid, nm, { description: "first" }));
    const b = await as("P", "POST", "/api/incidents", base(kid, nm, { description: "second" }));
    assert.notEqual(a.json.id, b.json.id);
  });
});

describe("S47 a dossier reads about 50 documents, not the whole tenant", () => {
  it("with hundreds of bookings and incidents in the tenant", async () => {
    const db = await adminDb();
    const t = ids().tenants.P;
    const batch = db.batch();
    for (let i = 0; i < 250; i++) {
      batch.set(db.collection("bookings").doc(`${t}_bulk${i}_${u()}`), { tenantId: t, child: `Bulk ${i}`, childId: `bulkchild${i}`, email: `bulk${i}@emu.test`, status: "confirmed", createdAt: new Date().toISOString(), listingId: ids().listings.LK.id });
      if (i < 240) batch.set(db.collection("incidents").doc(`bulk${i}_${u()}`), { tenantId: t, kind: "accident", childName: `Bulk ${i}`, childId: `bulkchild${i}`, date: ids().generatedOn, description: "bulk" });
    }
    await batch.commit();
    const nm = `Cost ${u()}`;
    const kid = await child("A", nm);
    const rec = await as("P", "POST", "/api/incidents", base(kid, nm));
    const label = "http:GET /api/incidents/:id/dossier";
    const before = await readsFor(label);
    const d = await as("P", "GET", `/api/incidents/${rec.json.id}/dossier`);
    assert.equal(d.status, 200);
    const used = (await readsFor(label)) - before;
    assert.ok(used > 0 && used <= 60, `dossier read ${used} documents`);
    assert.equal(d.json.parent?.email, EMAILS.A);
  });
});
