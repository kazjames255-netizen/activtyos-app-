// F1 (children-data verify, 10 Oct): the parent's GDPR download must never carry more than the parent's own screens show.
// A shared safeguarding concern, a medication, its doses, a moment and the provider's family record are passed through the SAME
// allow-lists the parent lists use (server/src/lib/parentViews.ts). Real API + Firestore emulator. Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { call, db, login, makeProvider, uniq, type Provider } from "./helpers.mts";

const u = uniq();
let P: Provider;
let tok = "";
let uid = "";
let kid = "";
let otherKid = "";
const now = () => new Date().toISOString();
const S = (n: string) => `SECRET-${n}-${u}`;
const flat = (v: unknown) => JSON.stringify(v);
const keysOf = (v: unknown, out = new Set<string>()): Set<string> => {
  if (Array.isArray(v)) v.forEach((x) => keysOf(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.add(k); keysOf(x, out); }
  return out;
};

before(async () => {
  P = await makeProvider("expal");
  const email = `exp-${u}@emu.test`;
  const s = await login(email);
  tok = s.token; uid = s.uid;
  await db.collection("users").doc(uid).set({ email, role: "parent", chosen: true, name: `Fam ${u}` }, { merge: true });
  kid = (await db.collection("children").add({ name: `Kid ${u}`, parentUid: uid, dob: "2017-05-06", photoConsent: true })).id;
  otherKid = (await db.collection("children").add({ name: `OtherFamilyKid ${u}`, parentUid: `someone-else-${u}`, photoConsent: true })).id;
  await db.collection("bookings").doc(`${P.tenantId}_EX${u}`).set({ ref: `EX${u}`, tenantId: P.tenantId, email, booker: "Fam", child: `Kid ${u}`, childId: kid, status: "Confirmed", pay: "Paid", amount: 0, paid: 0, createdAt: now() });
});

describe("F1 shared safeguarding concern in the export", () => {
  it("carries only what the parent's own list shows", async () => {
    const internals = { childVoice: S("voice"), reportedTo: S("rt"), externalReferral: S("ext"), localAuthority: S("la"), dslOutcome: S("outcome"), recordedBy: `dsl-${u}@provider.test`, recordedByName: S("recname"), parentNotifiedHow: S("how") };
    const id = (await db.collection("incidents").add({
      tenantId: P.tenantId, kind: "safeguarding", subject: "child", childId: kid, childName: `Kid ${u}`, date: "2026-10-01", shareWithParent: true,
      description: `shared-text-${u}`, followUp: `phone-office-${u}`, createdAt: now(),
      ...internals, dslActions: [S("act")], dslLog: [{ at: now(), by: `dsl-${u}@provider.test`, text: S("log") }], witnesses: [S("wit")], franchiseId: "fr1", listingId: "l1",
      notes: [{ id: "n1", by: "Fam", role: "parent", text: "hello", at: now(), internalFlag: S("noteflag") }],
    })).id;
    const exp = await call("GET", "/api/privacy/export", tok);
    assert.equal(exp.status, 200);
    const text = flat(exp.json);
    for (const [k, v] of Object.entries(internals)) assert.ok(!text.includes(String(v)), `${k} leaked into the export`);
    for (const t of [S("act"), S("log"), S("wit"), S("noteflag")]) assert.ok(!text.includes(t), `${t} leaked`);
    const row = exp.json.incidents.find((r: any) => r.id === id);
    assert.ok(row, "the shared concern is still in the export");
    assert.equal(row.description, `shared-text-${u}`);
    assert.equal(row.followUp, `phone-office-${u}`);
    // exactly the parent list's keys (the list adds only requireAck)
    const list = await call("GET", "/api/incidents", tok);
    const mine = list.json.find((r: any) => r.id === id);
    assert.ok(mine);
    const { requireAck: _r, ...listRow } = mine;
    assert.deepEqual(row, listRow, "export row differs from the parent list row");
  });

  it("an accident keeps its parent-facing care lines", async () => {
    const id = (await db.collection("incidents").add({ tenantId: P.tenantId, kind: "accident", childId: kid, childName: `Kid ${u}`, date: "2026-10-02", injury: "scraped knee", treatment: "plaster", firstAider: "Sam", recordedBy: `staff-${u}@provider.test`, internalNote: S("acc-internal"), createdAt: now() })).id;
    const exp = await call("GET", "/api/privacy/export", tok);
    const row = exp.json.incidents.find((r: any) => r.id === id);
    assert.equal(row.injury, "scraped knee");
    assert.ok(!("recordedBy" in row) && !("internalNote" in row));
  });
});

describe("medications and doses in the export", () => {
  it("match the parent medication list and drop team identity and private notes", async () => {
    const med = await db.collection("medications").add({
      tenantId: P.tenantId, franchiseId: "fr1", childId: kid, childName: `Kid ${u}`, name: `Ventolin ${u}`, dose: "2 puffs", route: "inhaler", asNeeded: true, consentGranted: true, consentBy: "Fam", consentDate: now(),
      recordedBy: `staff-${u}@provider.test`, recordedByName: S("medrec"), consentRecordedBy: `staff-${u}@provider.test`, consentRecordedByName: S("consrec"),
      consentHistory: [{ at: now(), by: `staff-${u}@provider.test`, what: S("hist") }], notes: S("provider-private-note"), instructions: S("staff-instructions"), lastDose: { id: "x", atMs: 1, key: S("fp") }, createdAt: now(),
    });
    await db.collection("medicationAdmin").add({ tenantId: P.tenantId, medicationId: med.id, medName: `Ventolin ${u}`, childId: kid, childName: `Kid ${u}`, date: "2026-10-03", time: "10:00", doseGiven: "2 puffs", given: true, administeredBy: `staff-${u}@provider.test`, administeredByName: "Sam Staff", witnessedBy: S("witness"), notes: "fine", createdAt: now() });
    const exp = await call("GET", "/api/privacy/export", tok);
    const text = flat(exp.json);
    for (const t of ["medrec", "consrec", "hist", "provider-private-note", "staff-instructions", "fp", "witness"]) assert.ok(!text.includes(S(t)), `${t} leaked`);
    assert.ok(!text.includes(`staff-${u}@provider.test`), "team sign-in email in the export");
    const row = exp.json.medications.find((m: any) => m.id === med.id);
    assert.equal(row.name, `Ventolin ${u}`);
    const list = await call("GET", "/api/medications", tok);
    assert.deepEqual(row, list.json.find((m: any) => m.id === med.id), "export differs from the parent medication list");
    const dose = exp.json.medicationDoses.find((d: any) => d.medicationId === med.id);
    assert.equal(dose.administeredByName, "Sam Staff");
    const mar = await call("GET", "/api/medications/administrations", tok);
    assert.deepEqual(dose, mar.json.find((d: any) => d.id === dose.id), "export dose differs from the parent MAR");
  });

  it("the parent's own authorisation keeps their note", async () => {
    const med = await call("POST", "/api/medications/authorise", tok, { tenantId: P.tenantId, childId: kid, childName: `Kid ${u}`, name: `Cream ${u}`, dose: "thin layer", notes: `parent-note-${u}` });
    assert.ok(med.status < 300, flat(med.json));
    const exp = await call("GET", "/api/privacy/export", tok);
    assert.equal(exp.json.medications.find((m: any) => m.id === med.json.id)?.notes, `parent-note-${u}`);
  });
});

describe("moments and the provider's family record", () => {
  it("a group moment names only this family's child and hides the poster's sign-in email and other families' replies", async () => {
    const m = await db.collection("moments").add({ tenantId: P.tenantId, photoType: "child", caption: "art", childIds: [kid, otherKid], childNames: [`Kid ${u}`, `OtherFamilyKid ${u}`], postedBy: `poster-${u}@provider.test`, postedByName: `poster-${u}@provider.test`, franchiseId: "fr1", comments: [{ by: "staff", role: "staff", text: "lovely", at: now() }, { by: `someone-else-${u}`, role: "parent", text: S("other-reply"), at: now() }], createdAt: now() });
    const exp = await call("GET", "/api/privacy/export", tok);
    const text = flat(exp.json);
    assert.ok(!text.includes(`OtherFamilyKid ${u}`), "another family's child named");
    assert.ok(!text.includes(`poster-${u}@provider.test`), "poster sign-in email");
    assert.ok(!text.includes(S("other-reply")), "another family's reply");
    const row = exp.json.moments.find((x: any) => x.id === m.id);
    assert.deepEqual(row.childIds, [kid]);
    assert.equal(row.postedByName, "The team");
  });

  it("a photo whose consent was withdrawn is not in the export (as in the feed)", async () => {
    const k2 = (await db.collection("children").add({ name: `NoPhoto ${u}`, parentUid: uid, photoConsent: false })).id;
    const m = await db.collection("moments").add({ tenantId: P.tenantId, photoType: "child", photoUrl: "private/x.png", childIds: [k2], childNames: ["NoPhoto"], createdAt: now() });
    const exp = await call("GET", "/api/privacy/export", tok);
    assert.ok(!exp.json.moments.some((x: any) => x.id === m.id));
  });

  it("the provider's family record leaves out the provider's private notes", async () => {
    await db.collection("customers").add({ tenantId: P.tenantId, name: `Fam ${u}`, email: `exp-${u}@emu.test`, phone: "07700900123", notes: S("crm-note"), tags: [S("tag")], marketingOptIn: true, children: [{ name: `Kid ${u}` }] });
    const exp = await call("GET", "/api/privacy/export", tok);
    const text = flat(exp.json);
    assert.ok(!text.includes(S("crm-note")) && !text.includes(S("tag")));
    assert.equal(exp.json.providerFamilyRecords[0].phone, "07700900123");
    assert.ok(!keysOf(exp.json.providerFamilyRecords).has("notes"));
  });
});
