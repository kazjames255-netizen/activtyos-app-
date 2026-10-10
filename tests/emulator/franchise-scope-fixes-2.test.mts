// Franchise scoping fixes, verifier round (10 Oct 2026): orphan gate on /api/listings and invite creation, legacy-copy scrub regardless of value,
// hub config seeding, listing franchiseId validation, bounded payments read in the settled-period guard. Real API + Firestore emulator. Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { call, db, login, makeListing, makeProvider, sleep, uniq, type Provider } from "./helpers.mts";

let P: Provider;
const F1 = `frV1-${uniq()}`;
let t1 = "", tOrphan = "";

async function mk(tag: string, doc: Record<string, unknown>) {
  const email = `${tag}-${uniq()}@emu.test`;
  const s = await login(email);
  await db.collection("users").doc(s.uid).set({ email, tenantId: P.tenantId, ...doc });
  return s;
}
const lib = (fid: string) => db.collection("libraries").doc(`${P.tenantId}__fr__${fid}`);

before(async () => {
  P = await makeProvider("frscope2");
  await db.collection("libraries").doc(P.tenantId).set({
    tenantId: P.tenantId, venues: [{ id: "v-ho", name: "HQ Hall" }], staff: [{ name: "HQ Person" }],
    settings: { features: { learninghub: true }, billing: { sortCode: "11-22-33", accountNumber: "12345678", bankName: "HQ Bank" }, payrollAdmins: ["boss@hq.test"] },
  });
  t1 = (await mk("v1", { role: "franchise", franchiseId: F1, franchiseName: "Alpha", name: "A" })).token;
  tOrphan = (await mk("vorph", { role: "franchise", name: "No Franchise" })).token;
});

describe("1/5: the orphan franchise gate covers /api/listings and invite creation", () => {
  it("an orphan franchise gets 403 on listings GET and POST, and cannot create an invite", async () => {
    assert.equal((await call("GET", "/api/listings", tOrphan)).status, 403);
    const post = await call("POST", "/api/listings", tOrphan, { title: "Orphan draft", status: "draft" });
    assert.equal(post.status, 403, JSON.stringify(post.json));
    const owners = (await call("GET", "/api/listings", P.token)).json.map((l: any) => l.franchiseId);
    assert.ok(!owners.includes("__no_franchise__"), "no listing owned by the sentinel");
    const inv = await call("POST", "/api/invites", tOrphan, { role: "staff", email: `x-${uniq()}@emu.test` });
    assert.equal(inv.status, 403, JSON.stringify(inv.json));
    assert.equal((await call("GET", "/api/listings", null)).status, 200, "anonymous browsing still works");
    assert.equal((await call("GET", "/api/listings", t1)).status, 200, "a real franchise still works");
  });
});

describe("2: a legacy copy is scrubbed whatever head office's values are now", () => {
  it("old bank / payroll values (not equal to head office's) and copied venues / staff are neither returned nor kept", async () => {
    const F = `frLeg-${uniq()}`;
    const tok = (await mk("vleg", { role: "franchise", franchiseId: F, franchiseName: "Legacy", name: "L" })).token;
    await lib(F).set({
      tenantId: P.tenantId, franchiseId: F, venues: [{ id: "v-ho", name: "HQ Hall" }, { id: "v-own", name: "Legacy Gym" }], staff: [{ name: "HQ Person" }, { name: "Own Coach" }],
      settings: { billing: { sortCode: "00-11-22", accountNumber: "87654321", bankName: "Old Bank", accountName: "Old Ltd", businessName: "Legacy Ltd" }, payrollAdmins: ["old-admin@hq.test"], brandColor: "#010101" },
    });
    const g = await call("GET", "/api/library", tok);
    const text = JSON.stringify(g.json);
    for (const s of ["00-11-22", "87654321", "Old Bank", "old-admin@hq.test", "HQ Hall", "HQ Person"]) assert.ok(!text.includes(s), `returned ${s}`);
    assert.ok(text.includes("Legacy Gym") && text.includes("Own Coach") && text.includes("Legacy Ltd"), "its own venue, coach and business name stay");
    const put = await call("PUT", "/api/library", tok, { settings: g.json.settings });
    assert.equal(put.status, 200, JSON.stringify(put.json));
    const raw = JSON.stringify((await lib(F).get()).data());
    for (const s of ["00-11-22", "87654321", "Old Bank", "old-admin@hq.test", "HQ Hall", "HQ Person"]) assert.ok(!raw.includes(s), `stored ${s}`);
    assert.equal((await lib(F).get()).get("seedVersion"), 2);
  });
  it("a head-office feature switch on a legacy doc cleans it too", async () => {
    const F = `frLeg2-${uniq()}`;
    await mk("vleg2", { role: "franchise", franchiseId: F, franchiseName: "Legacy2", name: "L2" });
    await lib(F).set({ tenantId: P.tenantId, franchiseId: F, settings: { billing: { sortCode: "55-55-55" }, payrollAdmins: ["z@hq.test"] } });
    assert.equal((await call("PUT", `/api/franchises/${F}/features`, P.token, { view: "marketing", on: false })).status, 200);
    const raw = JSON.stringify((await lib(F).get()).data());
    assert.ok(!raw.includes("55-55-55") && !raw.includes("z@hq.test"), raw);
  });
});

describe("3: the hub config seeds a franchise doc from the allow-list only", () => {
  it("a franchise with hub-edit rights saving the hub config does not copy head office's bank or payroll data", async () => {
    const F = `frHub-${uniq()}`;
    const tok = (await mk("vhub", { role: "franchise", franchiseId: F, franchiseName: "Hubby", name: "H" })).token;
    assert.equal((await lib(F).get()).exists, false);
    const r = await call("PUT", "/api/learning-hub/config", tok, { hub: { passMarkPct: 65 } });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const raw = JSON.stringify((await lib(F).get()).data());
    for (const s of ["11-22-33", "12345678", "boss@hq.test", "HQ Bank", "HQ Hall", "HQ Person"]) assert.ok(!raw.includes(s), `hub seed stored ${s}`);
    assert.equal((await lib(F).get()).get("settings.hub.passMarkPct"), 65);
  });
});

describe("4: a bad franchiseId on a listing is refused, not turned into head office", () => {
  it("blank, numeric and object ids are 400 and the listing keeps its owner", async () => {
    const L = await makeListing(P, `Coerce ${uniq()}`, false);
    assert.equal((await call("PUT", `/api/listings/${L.id}`, P.token, { franchiseId: F1 })).status, 200);
    for (const bad of ["  ", 123, {}, ["x"], true]) {
      const r = await call("PUT", `/api/listings/${L.id}`, P.token, { franchiseId: bad });
      assert.equal(r.status, 400, `${JSON.stringify(bad)} -> ${r.status}`);
      assert.equal((await db.collection("listings").doc(L.id).get()).get("franchiseId"), F1);
    }
    assert.equal((await call("PUT", `/api/listings/${L.id}`, P.token, { franchiseId: null })).status, 200);
  });
});

describe("6: the settled-period guard reads only this listing's payments", () => {
  it("60 unrelated payments in the tenant are not read", async () => {
    const S = `frRead-${uniq()}`;
    await db.collection("franchiseSettlements").doc(`set-${S}`).set({ tenantId: P.tenantId, franchiseId: S, from: "2026-09-01", to: "2026-09-30" });
    const L = await makeListing(P, `Reads ${uniq()}`, false);
    await db.collection("listings").doc(L.id).set({ franchiseId: S }, { merge: true });
    await db.collection("bookings").doc(`${P.tenantId}-rd1`).set({ tenantId: P.tenantId, ref: "rd1", bid: "rd1", listingId: L.id, franchiseId: S, status: "Confirmed", pay: "Paid", method: "Cash on the day", kids: [], addons: [], answers: [], child: "c", booker: "b", email: "b@emu.test", amount: 10, amountPaid: 10, createdAt: "2026-10-01T10:00:00Z" });
    await db.collection("payments").doc(`pay-rd1-${uniq()}`).set({ tenantId: P.tenantId, refs: ["rd1"], amount: 10, type: "payment", status: "recorded", offline: true, createdAt: "2026-10-02T10:00:00Z" });
    for (let i = 0; i < 60; i++) await db.collection("payments").doc(`noise-${S}-${i}`).set({ tenantId: P.tenantId, refs: [`other-${i}`], amount: 5, type: "payment", status: "recorded", offline: true, createdAt: "2026-09-02T10:00:00Z" });
    const { reassignBlockedBySettlement } = await import("../../server/src/lib/franchisePayoutsData");
    let paymentDocsRead = 0;
    const wrap = (o: any): any => new Proxy(o, {
      get(t, k) {
        const v = t[k];
        if (k === "get" && typeof v === "function") return async (...a: unknown[]) => { const s = await v.apply(t, a); if (s?.docs) paymentDocsRead += s.docs.length; return s; };
        return typeof v === "function" ? (...a: unknown[]) => { const r = v.apply(t, a); return r && typeof r === "object" && typeof r.get === "function" ? wrap(r) : r; } : v;
      },
    });
    const real = db.collection.bind(db);
    (db as any).collection = (name: string) => (name === "payments" ? wrap(real(name)) : real(name));
    try {
      const msg = await reassignBlockedBySettlement(P.tenantId, L.id, S);
      assert.equal(msg, null, "paid in October, so the move is allowed");
    } finally { (db as any).collection = real; }
    assert.ok(paymentDocsRead >= 1 && paymentDocsRead <= 2, `read ${paymentDocsRead} payment docs; the 60 unrelated ones must not be read`);
    void sleep;
  });
});

describe("R2 blocker: saving venues and staff from a franchise (and head office) is stored", () => {
  const venues = [{ id: "v-new", name: "New Hall" }], staff = [{ name: "New Coach" }];
  const stored = async (path: string) => (await db.collection("libraries").doc(path).get()).data() ?? {};
  it("a franchise with NO doc yet, a freshly seeded doc, and a legacy doc all keep what they save", async () => {
    const A = `frS-a-${uniq()}`;
    const ta = (await mk("sva", { role: "franchise", franchiseId: A, franchiseName: "A", name: "A" })).token;
    assert.equal((await call("PUT", "/api/library", ta, { venues, staff })).status, 200);
    let d = await stored(`${P.tenantId}__fr__${A}`);
    assert.deepEqual([d.venues, d.staff, d.seedVersion], [venues, staff, 2]);
    const B = `frS-b-${uniq()}`;
    const tb = (await mk("svb", { role: "franchise", franchiseId: B, franchiseName: "B", name: "B" })).token;
    assert.equal((await call("GET", "/api/library", tb)).status, 200);
    assert.equal((await lib(B).get()).get("seedVersion"), 2);
    assert.equal((await call("PUT", "/api/library", tb, { venues, staff })).status, 200);
    d = await stored(`${P.tenantId}__fr__${B}`);
    assert.deepEqual([d.venues, d.staff], [venues, staff]);
    assert.deepEqual((await call("GET", "/api/library", tb)).json.venues, venues);
    const C = `frS-c-${uniq()}`;
    const tc = (await mk("svc", { role: "franchise", franchiseId: C, franchiseName: "C", name: "C" })).token;
    await lib(C).set({ tenantId: P.tenantId, franchiseId: C, venues: [{ id: "v-ho", name: "HQ Hall" }], staff: [{ name: "HQ Person" }], settings: {} });
    assert.equal((await call("PUT", "/api/library", tc, { venues, staff })).status, 200);
    d = await stored(`${P.tenantId}__fr__${C}`);
    assert.deepEqual([d.venues, d.staff, d.seedVersion], [venues, staff, 2]);
    const E = `frS-e-${uniq()}`;
    const te = (await mk("sve", { role: "franchise", franchiseId: E, franchiseName: "E", name: "E" })).token;
    await lib(E).set({ tenantId: P.tenantId, franchiseId: E, venues: [{ id: "v-ho", name: "HQ Hall" }], staff: [{ name: "HQ Person" }], settings: {} });
    assert.equal((await call("PUT", "/api/library", te, { settings: { brandColor: "#999999" } })).status, 200);
    d = await stored(`${P.tenantId}__fr__${E}`);
    assert.deepEqual([d.venues, d.staff], [[], []], "legacy head-office copies removed when nothing is sent");
  });
  it("head office saving venues and staff is unchanged", async () => {
    const Q = await makeProvider("frhosave");
    assert.equal((await call("PUT", "/api/library", Q.token, { venues, staff })).status, 200);
    const d = await stored(Q.tenantId);
    assert.deepEqual([d.venues, d.staff], [venues, staff]);
  });
});
