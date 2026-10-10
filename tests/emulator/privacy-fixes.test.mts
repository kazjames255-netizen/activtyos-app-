// Privacy / personal data fixes (areas run privacy-scoping, 10 Oct). Real API + Firestore emulator (npm run test:emu). Synthetic data only.
//   PV01/PV04  the parent export (and My bookings) find rows stored with a mixed-case email
//   PV08/PV09  a staff export never contains another member of staff's onboarding record when two share a name
//   PV12       HQ acting as a parent cannot export or file a deletion request, and every impersonated request (GETs too) is audited
//   PV23       a closed parent account gets no marketing / non-essential email and is off every recipient list; essential mail still goes
//   PV42/PV43  a huge id is a 404, and the ops error store keeps path only (no query, email, token)
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { call, db, login, makeProvider, ok, sleep, uniq, type Provider } from "./helpers.mts";

const u = uniq();
let P: Provider;
const now = () => new Date().toISOString();

async function mkParent(email: string) {
  const s = await login(email);
  await db.collection("users").doc(s.uid).set({ email, role: "parent", chosen: true, name: `Fam ${u}` }, { merge: true });
  return s;
}
const booking = (ref: string, email: string, extra: Record<string, unknown> = {}) =>
  db.collection("bookings").doc(`${P.tenantId}_${ref}`).set({ ref, tenantId: P.tenantId, email, booker: "Fam", child: "Kid", status: "Confirmed", pay: "Paid", amount: 0, paid: 0, createdAt: now(), ...extra });

before(async () => { P = await makeProvider("pvfix"); });

describe("PV01/PV04: mixed-case email rows belong to the same parent", () => {
  const lower = `pa-${u}@emu.test`;
  const mixed = `Pa-${u}@Emu.Test`;
  const upper = lower.toUpperCase();
  let tok = "";
  before(async () => {
    tok = (await mkParent(lower)).token;
    await booking(`A1-${u}`, lower); await booking(`A2-${u}`, mixed); await booking(`A3-${u}`, upper);
    await db.collection("payments").add({ tenantId: P.tenantId, email: lower, amount: 5, at: now() });
    await db.collection("payments").add({ tenantId: P.tenantId, email: mixed, amount: 6, at: now() });
    for (const [i, pe] of [lower, mixed].entries()) {
      const tid = `th-${u}-${i}`;
      await db.collection("threads").doc(tid).set({ tenantId: P.tenantId, parentEmail: pe, parentName: "Fam", lastAt: now() });
      for (const n of [1, 2]) await db.collection("messages").add({ threadId: tid, tenantId: P.tenantId, parentEmail: pe, from: "operator", senderName: "Prov", body: `m${n}`, createdAt: now() });
    }
    await db.collection("wallet").doc(`w-${u}`).set({ tenantId: P.tenantId, email: mixed, balance: 7 });
    await db.collection("feedback").add({ tenantId: P.tenantId, email: mixed, rating: 5, at: now() });
  });
  it("the export counts every row whatever the stored case", async () => {
    const r = await call("GET", "/api/privacy/export", tok);
    assert.equal(r.status, 200);
    assert.equal(r.json.bookings.length, 3, "bookings");
    assert.equal(r.json.payments.length, 2, "payments");
    assert.equal(r.json.messageThreads.length, 2, "threads");
    assert.equal(r.json.messages.length, 4, "messages");
    assert.equal(r.json.wallet.length, 1, "wallet");
    assert.equal(r.json.feedback.length, 1, "feedback");
  });
  it("the summary matches the export", async () => {
    const r = await call("GET", "/api/privacy", tok);
    assert.equal(r.json.summary.bookings, 3);
    assert.equal(r.json.summary.payments, 2);
  });
  it("My bookings lists the mixed-case row too", async () => {
    const r = await call("GET", "/api/my/bookings", tok);
    assert.equal(r.status, 200);
    const refs = (Array.isArray(r.json) ? r.json : r.json.bookings).map((b: any) => b.ref);
    for (const k of ["A1", "A2", "A3"]) assert.ok(refs.includes(`${k}-${u}`), `${k} in ${refs}`);
  });
  it("another parent's rows never appear (control)", async () => {
    const other = `pz-${u}@emu.test`;
    const t = (await mkParent(other)).token;
    const r = await call("GET", "/api/privacy/export", t);
    assert.equal(r.json.bookings.length, 0);
    assert.equal(r.json.payments.length, 0);
  });
});

describe("PV08/PV09: staff export is matched by account, never by a shared name", () => {
  const NAME = `Sam Same ${u}`;
  it("two staff with the same name each get NO onboarding record; a uniquely named colleague still gets theirs", async () => {
    const mk = async (email: string, name: string) => {
      const s = await login(email);
      await db.collection("users").doc(s.uid).set({ email, role: "staff", chosen: true, tenantId: P.tenantId, franchiseId: null, name }, { merge: true });
      return s;
    };
    const a = await mk(`st-a-${u}@emu.test`, NAME), b = await mk(`st-b-${u}@emu.test`, NAME), c = await mk(`st-c-${u}@emu.test`, `Una Unique ${u}`);
    const rec = (staff: string, secret: string) => db.collection("onboardRecords").add({ key: P.tenantId, tenantId: P.tenantId, staff, values: { bankAcc: { v: secret } }, extra: [], updatedAt: now() });
    await rec(NAME, `ACC-OF-SAM-A-${u}`);
    await rec(`Una Unique ${u}`, `ACC-OF-UNA-${u}`);
    await db.collection("learningCompletions").add({ key: P.tenantId, uid: b.uid, staffName: NAME, course: "Other staff's course" });
    for (const s of [a, b]) {
      const r = await call("GET", "/api/privacy/export", s.token);
      assert.equal(r.status, 200);
      assert.deepEqual(r.json.onboarding, [], "ambiguous name: no onboarding record");
      assert.ok(!JSON.stringify(r.json).includes("ACC-OF-SAM-A"), "no bank detail of the other person");
    }
    assert.equal((await call("GET", "/api/privacy/export", a.token)).json.learning.length, 0, "the other staff member's training record");
    assert.equal((await call("GET", "/api/privacy/export", b.token)).json.learning.length, 1, "own record by uid still comes");
    const own = await call("GET", "/api/privacy/export", c.token);
    assert.equal(own.json.onboarding.length, 1, "unique name: own record");
    assert.ok(JSON.stringify(own.json.onboarding).includes(`ACC-OF-UNA-${u}`));
  });
});

describe("PV12: HQ acting as a parent", () => {
  let hq = "", pa = { token: "", uid: "" };
  const email = `pa12-${u}@emu.test`;
  before(async () => {
    pa = await mkParent(email);
    const h = await login(`hq-${u}@emu.test`);
    await db.collection("users").doc(h.uid).set({ email: `hq-${u}@emu.test`, role: "platform", chosen: true, twoFaVerifiedAt: Date.now() }, { merge: true });
    hq = h.token;
  });
  const act = { "x-act-as": "" };
  it("refuses the export and the deletion request with a clear 403, and writes no deletion request", async () => {
    act["x-act-as"] = pa.uid;
    const e = await call("GET", "/api/privacy/export", hq, undefined, act);
    assert.equal(e.status, 403, JSON.stringify(e.json));
    assert.match(String(e.json.error), /account holder/i);
    const d = await call("POST", "/api/privacy/delete-request", hq, { reason: "x" }, act);
    assert.equal(d.status, 403);
    assert.equal((await db.collection("deletionRequests").where("uid", "==", pa.uid).get()).size, 0);
  });
  it("the account holder can still do both (control)", async () => {
    assert.equal((await call("GET", "/api/privacy/export", pa.token)).status, 200);
    assert.equal((await call("POST", "/api/privacy/delete-request", pa.token, { reason: "mine" })).status, 201);
  });
  it("every impersonated request is audited - GETs of personal data and refused ones included - with the path only", async () => {
    act["x-act-as"] = pa.uid;
    const before = (await db.collection("impersonationLog").where("targetUid", "==", pa.uid).get()).size;
    await call("GET", `/api/my/children?email=${email}&dob=2017-03-04`, hq, undefined, act);
    await call("GET", "/api/privacy/export", hq, undefined, act);
    await call("GET", "/api/my/bookings", hq, undefined, act);
    const rows = (await db.collection("impersonationLog").where("targetUid", "==", pa.uid).get()).docs.map((d) => d.data());
    assert.equal(rows.length - before, 3, "three impersonated requests, three audit rows");
    const mine = rows.filter((r) => /\/api\/my\/children/.test(String(r.action)));
    assert.ok(mine.length >= 1, "the GET of children is logged");
    for (const r of rows) {
      assert.ok(r.byUid && r.targetUid && r.at && r.path, "who, target, path, time");
      assert.ok(!String(r.action).includes("?") && !String(r.action).includes(email), "no query string in the audit action");
    }
    assert.ok(rows.some((r) => r.action === "GET /api/privacy/export"), "the refused export attempt is in the trail");
  });
});

describe("PV23: closed accounts get no marketing and no non-essential email", () => {
  const email = `pa23-${u}@emu.test`;
  const ctrl = `pk23-${u}@emu.test`;
  let tok = "";
  const logFor = async (to: string, subject: RegExp) => (await db.collection("mailLog").where("to", "==", to).get()).docs.map((d) => d.data()).filter((m) => subject.test(String(m.subject)));
  before(async () => {
    tok = (await mkParent(email)).token;
    await mkParent(ctrl);
    await booking(`C1-${u}`, email); await booking(`C2-${u}`, ctrl);
    await db.collection("customers").add({ tenantId: P.tenantId, name: "Fam", email, createdAt: now() });
  });
  it("before closing: on the recipient list; the provider message mail is attempted", async () => {
    const d = await ok("POST", "/api/emails/send", P.token, { subject: `Mkt pre ${u}`, body: "hi", dryRun: true });
    assert.ok(d.sample.includes(email) && d.sample.includes(ctrl), JSON.stringify(d.sample));
  });
  it("closing the account takes the parent off the marketing list, the audiences and the recipients preview", async () => {
    const c = await call("POST", "/api/account/deactivate", tok, { reason: "pv23" });
    assert.equal(c.status, 200, JSON.stringify(c.json));
    const d = await ok("POST", "/api/emails/send", P.token, { subject: `Mkt post ${u}`, body: "hi", dryRun: true });
    assert.ok(!d.sample.includes(email), "closed parent is not a recipient");
    assert.ok(d.sample.includes(ctrl), "an open account still is");
    const rec = await ok("GET", "/api/emails/recipients", P.token);
    assert.ok(!JSON.stringify(rec).includes(email));
    const aud = await ok("GET", "/api/emails/audiences", P.token);
    assert.ok(!JSON.stringify(aud).includes(email));
    assert.ok(JSON.stringify(aud).includes(ctrl));
  });
  it("a real marketing send and a provider message produce no delivery to the closed address", async () => {
    await ok("POST", "/api/emails/send", P.token, { subject: `Mkt real ${u}`, body: "hi" });
    const m = await call("POST", "/api/messages", P.token, { parentEmail: email, body: `after close ${u}` });
    assert.ok(m.status < 300, `message ${m.status} ${JSON.stringify(m.json)}`);
    await sleep(2500);
    const rows = await logFor(email, /.*/);
    assert.ok(!rows.some((r) => /Mkt real/.test(String(r.subject))), "marketing never reached the mailer for them");
    const notice = rows.filter((r) => !/Mkt/.test(String(r.subject)));
    for (const r of notice) assert.equal(r.error, "account closed", `"${r.subject}" must be suppressed as account-closed, got ${JSON.stringify(r)}`);
    assert.ok((await logFor(ctrl, /Mkt real/)).length >= 1, "control: the open parent still gets the marketing send");
  });
  it("the mailer drops non-essential mail to a closed account but lets a required notice (receipt / refund) through to the transport", async () => {
    const { sendMailDetailed } = await import("../../server/src/lib/mailer");
    const non = await sendMailDetailed(email, "Reminder", "<p>x</p>");
    assert.equal(non.error, "account closed");
    const ess = await sendMailDetailed(email, "Your refund", "<p>x</p>", undefined, { essential: true });
    assert.notEqual(ess.error, "account closed", "essential mail is not blocked by the closure rule");
    const open = await sendMailDetailed(ctrl, "Reminder", "<p>x</p>");
    assert.notEqual(open.error, "account closed");
  });
  it("reopening the account puts it back", async () => {
    const r = await call("POST", "/api/account/reactivate", tok, { confirm: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const d = await ok("POST", "/api/emails/send", P.token, { subject: `Mkt back ${u}`, body: "hi", dryRun: true });
    assert.ok(d.sample.includes(email));
  });
});

describe("PV42/PV43: huge ids are 404, and the ops error store keeps path only", () => {
  let tok = "";
  const email = `pa42-${u}@emu.test`;
  before(async () => { tok = (await mkParent(email)).token; });
  const opsRows = async () => (await db.collection("incidentsOps").get()).docs.map((d) => d.data());
  it("a 2000-character id on cancel / child / thread / booking routes is a plain 404, never a 500", async () => {
    const big = "x".repeat(2000);
    for (const [m, p] of [["POST", `/api/my/bookings/${big}/cancel`], ["PUT", `/api/my/children/${big}`], ["GET", `/api/messages/threads/${big}`], ["GET", `/api/bookings/${big}`], ["POST", `/api/my/bookings/a%00b/cancel`]] as const) {
      const r = await call(m, p, tok, m === "GET" ? undefined : { name: "x" });
      assert.equal(r.status, 404, `${m} ${p.slice(0, 40)} -> ${r.status}`);
    }
  });
  it("with an email / child / dob in the query, nothing is stored in the error store", async () => {
    const before = (await opsRows()).length;
    const q = `?email=${email}&child=Ava-T&dob=2017-03-04`;
    const r = await call("POST", `/api/my/bookings/${"y".repeat(2000)}/cancel${q}`, tok, {});
    assert.equal(r.status, 404);
    await sleep(500);
    const rows = await opsRows();
    assert.equal(rows.length, before, "a 404 raises no fault");
    assert.ok(!JSON.stringify(rows).includes(email));
  });
  it("record() keeps the path only and redacts emails / tokens, for any writer", async () => {
    const { record } = await import("../../server/src/lib/monitor");
    await record({
      kind: "request", signature: `pv43-${u}`, message: `boom for ${email} token ${"T".repeat(40)}`, stack: `Error at ${email}`,
      context: { method: "POST", path: `/api/my/bookings/abc/cancel?email=${email}&child=Ava-T&dob=2017-03-04`, url: `/x?dob=2017-03-04`, role: "parent", note: `see ${email}` },
    });
    const row = (await db.collection("incidentsOps").where("signature", "==", `pv43-${u}`).get()).docs[0].data();
    const s = JSON.stringify(row);
    assert.equal(row.context.path, "/api/my/bookings/abc/cancel");
    assert.equal(row.context.url, "/x");
    for (const bad of [email, "Ava-T", "2017-03-04", "T".repeat(40)]) assert.ok(!s.includes(bad), `${bad} must not be stored`);
  });
});
