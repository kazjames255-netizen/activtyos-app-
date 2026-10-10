// Children's health data - fixes from the 10 Oct blind health run (findings H15, H10, H25b, H50, H22, H43/H42, H45, H12, H37, H36).
// Real API + Firestore emulator (npm run test:emu). Synthetic data only. Each block fails on main c2eee176 and passes on the fix.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, call, ids, ukDay, login, seedAddons } from "../../scripts/emu/addons-helpers.mts";

const u = () => Math.random().toString(36).slice(2, 7);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const KID = `HealthKid ${u()}`;
const PARENT = "parent-a@emu.test";
const PW_TEXT = `SWORDFISH-${u()}`;
let childId = "";
let planId = "";
let T = "";
const MEDONLY = "staff-hf-med@emu.test";   // Medical view only (Bookings none, Registers none)
const NOPE = "staff-hf-none@emu.test";     // Medical, Bookings, Registers, Medication all none
const REGS = "staff-hf-regs@emu.test";     // Registers view
const pdf = (n: string) => Buffer.from(`%PDF-1.4 synthetic plan ${n}`, "latin1");

async function setRoles(extra: { id: string; name: string; caps: Record<string, string> }[]) {
  const lib = (await as("P", "GET", "/api/library")).json;
  const keep = (lib.settings?.roles ?? []).filter((r: any) => !extra.some((e) => e.id === r.id));
  const r = await as("P", "PUT", "/api/library", { ...lib, settings: { ...lib.settings, roles: [...keep, ...extra], rolesSetAt: lib.settings?.rolesSetAt ?? new Date().toISOString() } });
  assert.ok(r.ok, JSON.stringify(r.json));
  await sleep(10_500); // the access settings cache lasts 10s
}
async function mkStaff(email: string, role: string) {
  const s = await login(email);
  await (await adminDb()).collection("users").doc(s.uid).set({ email, role: "staff", chosen: true, tenantId: T, franchiseId: null, name: email, staffRole: role, permRole: role, assignment: { mode: "listings", ids: [ids().listings.LK.id] } }, { merge: true });
}
async function upload(token: string, name: string, bytes: Buffer) {
  const f = await call("POST", "/api/my/files", token, { name, contentType: "application/pdf", bytes: bytes.length, total: 1 });
  assert.equal(f.status, 201, JSON.stringify(f.json));
  assert.equal((await call("PUT", `/api/my/files/${f.json.id}/chunks/0`, token, { b64: bytes.toString("base64") })).status, 200);
  assert.equal((await call("POST", `/api/my/files/${f.json.id}/done`, token, {})).status, 200);
  return f.json.id as string;
}
async function raw(token: string, p: string) {
  const { API } = await import("../../scripts/emu/addons-helpers.mts");
  const r = await fetch(API + p, { headers: { Authorization: `Bearer ${token}` } });
  return { status: r.status, body: Buffer.from(await r.arrayBuffer()) };
}
const tok = async (email: string) => (await login(email)).token;
const newMed = (over: Record<string, unknown> = {}) =>
  as("P", "POST", "/api/medications", { childId, childName: KID, name: `Med${u()}`, dose: "2 puffs", route: "inhaler", asNeeded: true, consentGranted: true, consentBy: "Parent A", ...over });
const adm = (who: string, id: string, body: Record<string, unknown> = {}) => as(who, "POST", `/api/medications/${id}/administer`, { date: ukDay(0), doseGiven: "2 puffs", ...body });
const marRows = async (medId: string) => (await (await adminDb()).collection("medicationAdmin").where("medicationId", "==", medId).get()).docs.map((d) => ({ id: d.id, ...d.data() } as any));
const mailsTo = async (email: string, part: string) => (await (await adminDb()).collection("mailLog").where("to", "==", email).get()).docs.map((d) => d.data() as any).filter((m) => String(m.subject).includes(part));

before(async () => {
  const I = await seedAddons();
  T = I.tenants.P;
  const a = await tok(PARENT);
  const k = await call("POST", "/api/my/children", a, { name: KID, dob: "2017-05-06" });
  assert.ok(k.ok, JSON.stringify(k.json));
  childId = k.json.id;
  // a SEND plan, attached BEFORE the booking so the booking grants the provider access to it
  planId = await upload(a, "plan.pdf", pdf("one"));
  const put = await call("PUT", `/api/my/children/${childId}`, a, { name: KID, dob: "2017-05-06", sendPlanId: planId, sendPlanName: "plan.pdf" });
  assert.equal(put.status, 200, JSON.stringify(put.json));
  const b = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: KID, days: [1] }] });
  assert.ok(b.ok, JSON.stringify(b.json));
  await (await adminDb()).collection("children").doc(childId).set({ collectionPassword: PW_TEXT, allergies: "peanuts", medical: "asthma" }, { merge: true });
  await setRoles([
    { id: "hf-med", name: "HF medical only", caps: { bookings: "none", registers: "none", medical: "view" } },
    { id: "hf-none", name: "HF nothing", caps: { bookings: "none", registers: "none", medical: "none", medication: "none" } },
    { id: "hf-regs", name: "HF registers", caps: { bookings: "none", registers: "view" } },
  ]);
  await mkStaff(MEDONLY, "hf-med"); await mkStaff(NOPE, "hf-none"); await mkStaff(REGS, "hf-regs");
  await sleep(11_000); // plan grant is fire-and-forget after the booking
});

describe("H15: two identical administer calls at once record ONE dose and send ONE email", () => {
  it("5 parallel pairs: one MAR row each, one parent email each, both callers get the same record", async () => {
    for (let i = 0; i < 5; i++) {
      const med = await newMed();
      assert.equal(med.status, 201, JSON.stringify(med.json));
      const s1 = await tok(ids().emails.S1);
      const go = () => call("POST", `/api/medications/${med.json.id}/administer`, s1, { date: ukDay(0), doseGiven: "2 puffs" });
      const [x, y] = await Promise.all([go(), go()]);
      const rows = await marRows(med.json.id);
      assert.equal(rows.length, 1, `pair ${i}: statuses ${x.status}/${y.status}, rows ${rows.length}`);
      const ok = [x, y].filter((r) => r.status < 300);
      assert.ok(ok.length >= 1);
      for (const r of ok) assert.equal(r.json.id, rows[0].id, `pair ${i}: a caller was handed a record that is not the stored one`);
      await sleep(1500);
      assert.equal((await mailsTo(PARENT, med.json.name)).length, 1, `pair ${i}: parent emails`);
    }
  });
  it("a genuine second dose with confirmDuplicate is still recorded", async () => {
    const med = await newMed();
    assert.equal((await adm("S1", med.json.id)).status, 201);
    const again = await adm("S1", med.json.id);
    assert.equal(again.status, 409);
    assert.equal(again.json.code, "possible_duplicate");
    assert.equal((await adm("S1", med.json.id, { confirmDuplicate: true })).status, 201);
    assert.equal((await marRows(med.json.id)).length, 2);
  });
});

describe("H10: the same medicine authorised many times at once is stored ONCE", () => {
  it("15 parallel parent authorise calls: one record, one provider bell", async () => {
    const a = await tok(PARENT);
    const name = `Auth${u()}`;
    const body = { tenantId: T, childId, childName: KID, name, dose: "5ml", schedule: "twice daily" };
    const rs = await Promise.all(Array.from({ length: 15 }, () => call("POST", "/api/medications/authorise", a, body)));
    assert.ok(rs.every((r) => r.status < 300), JSON.stringify(rs.map((r) => r.status)));
    const db = await adminDb();
    const stored = (await db.collection("medications").where("childId", "==", childId).get()).docs.filter((d) => d.get("name") === name);
    assert.equal(stored.length, 1, `stored ${stored.length}`);
    assert.equal(new Set(rs.map((r) => r.json.id)).size, 1);
    await sleep(1500);
    const bells = (await db.collection("notifications").where("tenantId", "==", T).get()).docs.filter((d) => String(d.get("title")).includes(name));
    assert.equal(bells.length, 1, `bells ${bells.length}`);
  });
  it("after the parent withdraws, authorising the same medicine again makes a new live record", async () => {
    const a = await tok(PARENT);
    const body = { tenantId: T, childId, childName: KID, name: `Again${u()}`, dose: "1 tablet" };
    const first = await call("POST", "/api/medications/authorise", a, body);
    assert.equal(first.status, 201);
    assert.equal((await call("POST", `/api/medications/${first.json.id}/withdraw`, a, {})).status, 200);
    const second = await call("POST", "/api/medications/authorise", a, body);
    assert.ok(second.status < 300);
    assert.notEqual(second.json.id, first.json.id);
    assert.equal(second.json.consentGranted, true);
  });
});

describe("H25b: consent withdrawn at the same moment as a dose - no dose after the withdraw answers", () => {
  it("16 staggered administer + withdraw pairs", async () => {
    const a = await tok(PARENT);
    const s1 = await tok(ids().emails.S1);
    for (let i = 0; i < 16; i++) {
      const med = await newMed();
      let answeredAt = "";
      // the withdraw is sent 0..45ms after the dose, so some pairs land inside the dose's check-then-write window
      const [d, w] = await Promise.all([call("POST", `/api/medications/${med.json.id}/administer`, s1, { date: ukDay(0), doseGiven: "2 puffs" }), sleep(i * 3).then(() => call("POST", `/api/medications/${med.json.id}/withdraw`, a, {})).then((r) => { answeredAt = new Date().toISOString(); return r; })]);

      assert.equal(w.status, 200);
      await sleep(400);
      const late = (await marRows(med.json.id)).filter((r) => String(r.createdAt) > answeredAt);
      assert.equal(late.length, 0, `pair ${i}: dose ${d.status} written after the withdraw response`);
      assert.equal((await adm("S1", med.json.id, { confirmDuplicate: true })).status, 409, "after the withdraw, no more doses");
    }
  });
});

describe("H22: a dose that was not given is never reported as given", () => {
  const NOT_GIVEN = ["No dose", "no dose", "NO DOSE", "No  dose", "No dose given", "Not given - asleep", "not given", "Not-given", "Missed", "Refused", "Skipped", "Declined", "Dose not given"];
  for (const text of NOT_GIVEN) {
    it(`"${text}" with no given field tells the parent it was MISSED`, async () => {
      const med = await newMed();
      assert.equal((await adm("S1", med.json.id, { doseGiven: text })).status, 201);
      await sleep(1200);
      const m = await mailsTo(PARENT, med.json.name);
      assert.equal(m.length, 1);
      assert.match(String(m[0].subject), /missed a dose/, String(m[0].subject));
    });
  }
  it("a real dose ('2 puffs') is still reported as given; an explicit given:true/false wins over the text", async () => {
    const med = await newMed();
    assert.equal((await adm("S1", med.json.id, { doseGiven: "2 puffs" })).status, 201);
    await sleep(1000);
    assert.match(String((await mailsTo(PARENT, med.json.name))[0].subject), /had their/);
    const med2 = await newMed();
    assert.equal((await adm("S1", med2.json.id, { doseGiven: "No dose", given: true })).status, 201);
    await sleep(1000);
    assert.match(String((await mailsTo(PARENT, med2.json.name))[0].subject), /had their/);
  });
});

describe("H50: confidential always wins", () => {
  const mk = (body: Record<string, unknown>) => as("P", "POST", "/api/incidents", { date: ukDay(0), childName: KID, childId, location: "hall", ...body });
  it("the server refuses confidential + shareWithParent on write (400), for a new record and for an edit", async () => {
    assert.equal((await mk({ kind: "safeguarding", description: "x", concernCategory: "neglect", confidential: true, shareWithParent: true })).status, 400);
    assert.equal((await mk({ kind: "accident", description: "x", injury: "graze", confidential: true, shareWithParent: true })).status, 400);
    const ok = await mk({ kind: "safeguarding", description: "x", concernCategory: "neglect", confidential: true });
    assert.equal(ok.status, 201, JSON.stringify(ok.json));
    assert.equal((await as("P", "PUT", `/api/incidents/${ok.json.id}`, { shareWithParent: true })).status, 400);
    const open = await mk({ kind: "safeguarding", description: "y", concernCategory: "neglect", shareWithParent: true });
    assert.equal(open.status, 201);
    assert.equal((await as("P", "PUT", `/api/incidents/${open.json.id}`, { confidential: true })).status, 400);
  });
  it("a record already stored with both flags is kept out of the parent's export, list and replies", async () => {
    const SECRET = `LEGACY-SECRET-${u()}`;
    const db = await adminDb();
    const ref = await db.collection("incidents").add({ tenantId: T, kind: "safeguarding", date: ukDay(0), childId, childName: KID, description: SECRET, confidential: true, shareWithParent: true, severity: "minor", parentNotified: false, createdAt: new Date().toISOString(), recordedBy: "provider-p@emu.test" });
    const a = await tok(PARENT);
    const ex = await call("GET", "/api/privacy/export", a);
    assert.equal(ex.status, 200);
    assert.ok(!JSON.stringify(ex.json).includes(SECRET), "confidential text in the export");
    assert.ok(!JSON.stringify((await call("GET", "/api/incidents", a)).json).includes(SECRET), "confidential text in the parent's list");
    assert.equal((await call("POST", `/api/incidents/${ref.id}/note`, a, { text: "hello" })).status, 404);
    assert.equal((await call("POST", `/api/incidents/${ref.id}/acknowledge`, a, {})).status, 404);
  });
  it("a confidential accident tells the parent only that a record was made (no text), in the bell, the email and the export", async () => {
    const SECRET = `ACC-SECRET-${u()}`;
    const r = await mk({ kind: "accident", description: SECRET, injury: `inj-${SECRET}`, treatment: `trt-${SECRET}`, confidential: true });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    await sleep(2500);
    const db = await adminDb();
    const bells = (await db.collection("notifications").where("ref", "==", r.json.id).get()).docs.map((d) => d.data() as any).filter((n) => n.audience === "parent");
    assert.equal(bells.length, 1, "one neutral bell to the parent");
    assert.ok(!JSON.stringify(bells).includes(SECRET), JSON.stringify(bells));
    const mails = (await db.collection("mailLog").where("to", "==", PARENT).get()).docs.map((d) => d.data() as any).filter((m) => String(m.html ?? "").includes(KID) || String(m.subject).includes(KID));
    assert.ok(!JSON.stringify(mails).includes(SECRET), "text in the email");
    const a = await tok(PARENT);
    assert.ok(!JSON.stringify((await call("GET", "/api/privacy/export", a)).json).includes(SECRET), "text in the export");
    assert.ok(!JSON.stringify((await call("GET", "/api/incidents", a)).json).includes(SECRET), "text in the list");
    // an older bell that already carries the text is redacted in the export too
    await db.collection("notifications").add({ tenantId: T, audience: "parent", email: PARENT, category: "accident", title: `An accident was recorded for ${KID}`, body: `old-${SECRET}`, ref: r.json.id, readAt: null, at: new Date().toISOString() });
    assert.ok(!JSON.stringify((await call("GET", "/api/privacy/export", a)).json).includes(`old-${SECRET}`), "old bell text in the export");
  });
  it("an ordinary shared accident still reaches the parent with its text", async () => {
    const TXT = `PLAIN-${u()}`;
    const r = await mk({ kind: "accident", description: TXT, injury: "graze" });
    assert.equal(r.status, 201);
    await sleep(2000);
    const a = await tok(PARENT);
    assert.ok(JSON.stringify((await call("GET", "/api/privacy/export", a)).json).includes(TXT));
  });
});

describe("H43 / H42: a plan file follows the staff role matrix and the site scope", () => {
  it("owner P and a site staff member S2 at LK read the granted plan", async () => {
    for (const who of ["P", "S1", "S2"]) {
      const r = await raw(await tok(ids().emails[who as "P"]), `/api/my/files/${planId}`);
      assert.equal(r.status, 200, who);
      assert.ok(r.body.equals(pdf("one")), who);
    }
  });
  it("staff whose role has Medical, Bookings, Registers and Medication all None are refused (403)", async () => {
    const r = await raw(await tok(NOPE), `/api/my/files/${planId}`);
    assert.equal(r.status, 403);
    assert.ok(!r.body.equals(pdf("one")));
  });
  it("S4 (Bookings none, Registers none, Medical not named) is refused like the child card is", async () => {
    assert.equal((await raw(await tok(ids().emails.S4), `/api/my/files/${planId}`)).status, 403);
  });
  it("Medical view only and Registers view roles still read it", async () => {
    assert.equal((await raw(await tok(MEDONLY), `/api/my/files/${planId}`)).status, 200);
    assert.equal((await raw(await tok(REGS), `/api/my/files/${planId}`)).status, 200);
  });
  it("staff at another site (S3, LK2 only) cannot read the plan of a child booked only at LK (404)", async () => {
    assert.equal((await raw(await tok(ids().emails.S3), `/api/my/files/${planId}`)).status, 404);
  });
  it("case and trailing-slash spellings of the path are held to the same rule", async () => {
    const t = await tok(NOPE);
    for (const p of [`/API/MY/FILES/${planId}`, `/api/my/files/${planId}/`, `/api/my//files/${planId}`]) assert.equal((await raw(t, p)).status, 403, p);
  });
  it("the parent still reads their own file", async () => {
    assert.equal((await raw(await tok(PARENT), `/api/my/files/${planId}`)).status, 200);
  });
});

describe("H45: a completed plan file cannot be overwritten; a new upload has no grant until the parent re-grants", () => {
  it("PUT on a completed file is 409 and the provider keeps reading the original bytes", async () => {
    const a = await tok(PARENT);
    const put = await call("PUT", `/api/my/files/${planId}/chunks/0`, a, { b64: pdf("two").toString("base64") });
    assert.equal(put.status, 409, JSON.stringify(put.json));
    const r = await raw(await tok(ids().emails.P), `/api/my/files/${planId}`);
    assert.equal(r.status, 200);
    assert.ok(r.body.equals(pdf("one")), "the provider read changed bytes");
  });
  it("a replacement upload is a new file the provider cannot read until it is booked again", async () => {
    const a = await tok(PARENT);
    const f2 = await upload(a, "plan2.pdf", pdf("three"));
    assert.equal((await raw(await tok(ids().emails.P), `/api/my/files/${f2}`)).status, 404);
    const mine = await raw(a, `/api/my/files/${f2}`);
    assert.equal(mine.status, 200);
  });
  it("an unfinished upload can still be filled in (resume) until it is completed", async () => {
    const a = await tok(PARENT);
    const f = await call("POST", "/api/my/files", a, { name: "x.pdf", contentType: "application/pdf", bytes: 20, total: 2 });
    assert.equal((await call("PUT", `/api/my/files/${f.json.id}/chunks/0`, a, { b64: "QUJD" })).status, 200);
    assert.equal((await call("PUT", `/api/my/files/${f.json.id}/chunks/0`, a, { b64: "QUJE" })).status, 200);
    assert.equal((await call("PUT", `/api/my/files/${f.json.id}/chunks/1`, a, { b64: "QUJD" })).status, 200);
    assert.equal((await call("POST", `/api/my/files/${f.json.id}/done`, a, {})).status, 200);
  });
});

describe("H12: changing a consented medicine's name, dose or route clears the consent and asks the parent again", () => {
  for (const [field, value] of [["name", "Changed name"], ["dose", "10 puffs"], ["route", "oral"]] as const) {
    it(`${field} changed: consent cleared, doses refused, parent told (bell + email), parent can re-consent`, async () => {
      const med = await newMed();
      const before = await adm("S1", med.json.id);
      assert.equal(before.status, 201);
      const put = await as("P", "PUT", `/api/medications/${med.json.id}`, { [field]: value });
      assert.equal(put.status, 200, JSON.stringify(put.json));
      assert.equal(put.json.consentGranted, false);
      assert.equal((await adm("S1", med.json.id, { confirmDuplicate: true })).status, 409);
      await sleep(2000);
      const db = await adminDb();
      const bells = (await db.collection("notifications").where("ref", "==", med.json.id).get()).docs.map((d) => d.data() as any).filter((n) => n.audience === "parent");
      assert.equal(bells.length, 1, "one bell to the parent");
      assert.ok(bells[0].i18n?.tk, "the bell is translatable");
      assert.equal((await mailsTo(PARENT, KID)).filter((m) => /consent|confirm/i.test(String(m.subject)) && String(m.html).includes(KID)).length >= 1, true);
      const a = await tok(PARENT);
      const re = await call("POST", `/api/medications/${med.json.id}/consent`, a, {});
      assert.equal(re.status, 200);
      assert.equal((await adm("S1", med.json.id, { confirmDuplicate: true })).status, 201);
    });
  }
  it("a change to notes, storage or a case-only change keeps the consent", async () => {
    const med = await newMed({ name: "Ventolin" });
    const put = await as("P", "PUT", `/api/medications/${med.json.id}`, { notes: "kept in the red bag", name: "VENTOLIN", storage: "bag" });
    assert.equal(put.status, 200);
    assert.equal(put.json.consentGranted, true);
  });
});

describe("H37: the provider route enforces the same allergies limit as the parent route", () => {
  it("300 characters pass, 301 is a 400, on PUT /api/children/:id", async () => {
    assert.equal((await as("P", "PUT", `/api/children/${childId}`, { allergies: "a".repeat(300) })).status, 200);
    assert.equal((await as("P", "PUT", `/api/children/${childId}`, { allergies: "a".repeat(301) })).status, 400);
    assert.equal((await as("P", "PUT", `/api/children/${childId}`, { allergies: "peanuts" })).status, 200);
  });
});

describe("H36: the collection password goes only to roles that may collect children", () => {
  it("Medical-only staff get the card without collectionPassword", async () => {
    const r = await as(MEDONLY, "GET", `/api/children/${childId}`);
    assert.equal(r.status, 200);
    assert.equal(r.json.record.medical, "asthma");
    assert.ok(!JSON.stringify(r.json).includes(PW_TEXT), "password leaked");
    const l = await as(MEDONLY, "GET", "/api/children/lookup");
    assert.ok(!JSON.stringify(l.json).includes(PW_TEXT));
  });
  it("owner, a lead and Registers staff still see it", async () => {
    for (const who of ["P", "S1", REGS]) {
      const r = await as(who, "GET", `/api/children/${childId}`);
      assert.equal(r.status, 200, who);
      assert.equal(r.json.record.collectionPassword, PW_TEXT, who);
    }
  });
});
