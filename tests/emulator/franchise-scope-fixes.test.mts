// Franchise / head-office scoping fixes (10 Oct 2026 franchise run F06, F10-F14, F17, F19, F31, F34, F38). Real API + Firestore emulator (npm run test:emu). Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { call, db, login, makeListing, makeProvider, uniq, sleep, type Provider } from "./helpers.mts";
import * as scope from "../../server/src/lib/franchiseScope";

let P: Provider;
const F1 = `frS1-${uniq()}`, F2 = `frS2-${uniq()}`;
let t1 = "", t2 = "", tOrphan = "", tNew = "";

async function mk(tag: string, doc: Record<string, unknown>) {
  const email = `${tag}-${uniq()}@emu.test`;
  const s = await login(email);
  await db.collection("users").doc(s.uid).set({ email, tenantId: P.tenantId, ...doc });
  return s;
}
const lib = (fid: string) => db.collection("libraries").doc(`${P.tenantId}__fr__${fid}`);
const toggle = (fid: string, view: string, on: boolean) => call("PUT", `/api/franchises/${fid}/features`, P.token, { view, on });
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

before(async () => {
  P = await makeProvider("frscope");
  // Head office's own library: bank details, payroll administrators and a cancellation policy a franchise must NOT copy / must follow.
  await db.collection("libraries").doc(P.tenantId).set({
    tenantId: P.tenantId, categories: [{ id: "c1", name: "Sport" }], venues: [{ id: "v-ho", name: "HQ Hall" }],
    settings: {
      features: { meals: true, trips: true }, brandColor: "#123456",
      billing: { businessName: "HQ Ltd", bankName: "HQ Bank", accountName: "HQ Ltd", sortCode: "11-22-33", accountNumber: "12345678", logoUrl: "https://example.test/logo.png" },
      payrollAdmins: ["boss@hq.test"], cancellationPolicies: [{ id: "p1", name: "HQ Strict v1" }], allowCardRefund: true,
    },
  });
  t1 = (await mk("fr1", { role: "franchise", franchiseId: F1, franchiseName: "Alpha", name: "A" })).token;
  t2 = (await mk("fr2", { role: "franchise", franchiseId: F2, franchiseName: "Bravo", name: "B" })).token;
  tOrphan = (await mk("orph", { role: "franchise", name: "No Franchise" })).token;
});

describe("F34: a franchise account with no franchiseId sees nothing", () => {
  it("the scope helper treats the sentinel as a franchise that owns nothing", () => {
    assert.equal(scope.isFranchise({ role: "franchise", tenantId: "t", franchiseId: (scope as any).NO_FRANCHISE } as never), true);
  });
  it("every franchise-scoped route is refused or empty, never the network", async () => {
    // marker data that belongs to F1 and to head office
    await db.collection("bookings").doc(`${P.tenantId}-orph1`).set({ ref: "orph1", tenantId: P.tenantId, franchiseId: F1, child: "Zed Marker", booker: "Zed Parent", email: "zed@emu.test", status: "Confirmed", amount: 5, kids: [] });
    await db.collection("customers").doc(`${P.tenantId}-zed`).set({ tenantId: P.tenantId, email: "zed@emu.test", name: "Zed Marker" });
    await db.collection("incidents").add({ tenantId: P.tenantId, kind: "incident", childName: "Zed Marker", date: "2026-10-01" });
    await db.collection("expenses").add({ tenantId: P.tenantId, description: "Zed Marker expense", amount: 5, date: "2026-10-01" });
    await db.collection("moments").add({ tenantId: P.tenantId, text: "Zed Marker moment", childName: "Zed Marker" });
    await db.collection("medications").add({ tenantId: P.tenantId, childName: "Zed Marker", name: "Zed Marker med" });
    const routes = ["/api/bookings", "/api/customers", "/api/incidents", "/api/expenses", "/api/moments", "/api/medications", "/api/listings", "/api/income", "/api/splitfees/mine",
      "/api/splitfees/payouts/mine", "/api/messages/threads", "/api/registers?date=2026-10-12", "/api/blocks", "/api/discounts", "/api/children/lookup", "/api/milestones", "/api/kit"];
    for (const r of routes) {
      const res = await call("GET", r, tOrphan);
      assert.ok(res.status === 403 || res.status === 404 || (res.status === 200 && !JSON.stringify(res.json).includes("Zed")), `${r} -> ${res.status} ${JSON.stringify(res.json).slice(0, 200)}`);
      assert.ok(!JSON.stringify(res.json).includes("Zed"), `${r} leaked`);
    }
    // writes are refused too
    assert.equal((await call("POST", "/api/incidents", tOrphan, { kind: "incident", childName: "x", date: "2026-10-01", description: "x" })).status, 403);
    // /api/me still answers so the app can say what is wrong
    assert.equal((await call("GET", "/api/me", tOrphan)).status, 200);
    // a normal franchise is unaffected
    assert.equal((await call("GET", "/api/bookings", t1)).status, 200);
  });
});

describe("F12: the seeded franchise copy carries no bank details and policies follow head office", () => {
  it("the first feature toggle seeds only franchise-safe fields", async () => {
    assert.equal((await toggle(F1, "marketing", false)).status, 200);
    const raw = (await lib(F1).get()).data()!;
    const text = JSON.stringify(raw);
    for (const secret of ["11-22-33", "12345678", "boss@hq.test", "HQ Bank"]) assert.ok(!text.includes(secret), `seeded doc holds ${secret}`);
    assert.equal(raw.settings.brandColor, "#123456");
    const g = await call("GET", "/api/library", t1);
    assert.equal(g.status, 200);
    for (const secret of ["11-22-33", "12345678", "boss@hq.test", "HQ Bank"]) assert.ok(!JSON.stringify(g.json).includes(secret), `GET /api/library returns ${secret}`);
  });
  it("an inherited policy keeps following head office until the franchise overrides it", async () => {
    let g = await call("GET", "/api/library", t1);
    assert.equal(g.json.settings.cancellationPolicies[0].name, "HQ Strict v1");
    assert.ok(g.json.inherited.includes("cancellationPolicies"));
    await db.collection("libraries").doc(P.tenantId).set({ settings: { cancellationPolicies: [{ id: "p2", name: "HQ Flexible v2" }] } }, { merge: true });
    g = await call("GET", "/api/library", t1);
    assert.equal(g.json.settings.cancellationPolicies[0].name, "HQ Flexible v2", "head office's change reaches a franchise that never edited its own");
    // saving something else with the policy echoed back does NOT freeze it
    const put = await call("PUT", "/api/library", t1, { settings: { ...g.json.settings, brandColor: "#abcdef" } });
    assert.equal(put.status, 200, JSON.stringify(put.json));
    assert.equal((await lib(F1).get()).get("overrides.cancellationPolicies"), undefined);
    await db.collection("libraries").doc(P.tenantId).set({ settings: { cancellationPolicies: [{ id: "p3", name: "HQ v3" }] } }, { merge: true });
    assert.equal((await call("GET", "/api/library", t1)).json.settings.cancellationPolicies[0].name, "HQ v3");
    // an actual edit becomes an override and sticks
    const mine = [{ id: "m1", name: "Alpha own policy" }];
    await call("PUT", "/api/library", t1, { settings: { ...put.json.settings, cancellationPolicies: mine } });
    assert.equal((await lib(F1).get()).get("overrides.cancellationPolicies"), true);
    await db.collection("libraries").doc(P.tenantId).set({ settings: { cancellationPolicies: [{ id: "p4", name: "HQ v4" }] } }, { merge: true });
    assert.equal((await call("GET", "/api/library", t1)).json.settings.cancellationPolicies[0].name, "Alpha own policy");
  });
  it("an existing seeded doc is scrubbed on the franchise's next read and write", async () => {
    await db.collection("libraries").doc(`${P.tenantId}__fr__${F2}`).set({
      tenantId: P.tenantId, franchiseId: F2,
      settings: { billing: { sortCode: "11-22-33", accountNumber: "12345678", bankName: "HQ Bank", accountName: "HQ Ltd", businessName: "Bravo Ltd" }, payrollAdmins: ["boss@hq.test"], brandColor: "#000" },
    });
    const g = await call("GET", "/api/library", t2);
    assert.ok(!JSON.stringify(g.json).includes("11-22-33") && !JSON.stringify(g.json).includes("boss@hq.test"), "legacy copy hidden on read");
    assert.equal(g.json.settings.billing.businessName, "Bravo Ltd", "the franchise's own fields stay");
    await call("PUT", "/api/library", t2, { settings: g.json.settings });
    const text = JSON.stringify((await lib(F2).get()).data());
    assert.ok(!text.includes("11-22-33") && !text.includes("12345678") && !text.includes("boss@hq.test"), "scrubbed on write");
  });
});

describe("F06: reassigning a listing", () => {
  it("an unknown franchise is refused (404) and the listing is untouched; a real one works", async () => {
    const L = await makeListing(P, `Reassign ${uniq()}`, false);
    const bad = await call("PUT", `/api/listings/${L.id}`, P.token, { franchiseId: "nope" });
    assert.equal(bad.status, 404, JSON.stringify(bad.json));
    assert.equal((await db.collection("listings").doc(L.id).get()).get("franchiseId") ?? null, null);
    const good = await call("PUT", `/api/listings/${L.id}`, P.token, { franchiseId: F1 });
    assert.equal(good.status, 200, JSON.stringify(good.json));
    assert.equal((await db.collection("listings").doc(L.id).get()).get("franchiseId"), F1);
  });
  it("the settled-period guard keys on when the money was RECEIVED, not the day the booking was made", async () => {
    const S = `frSet-${uniq()}`;
    await db.collection("users").doc(`u-${S}`).set({ role: "franchise", tenantId: P.tenantId, franchiseId: S, franchiseName: "Settled Camps", name: "S" });
    await db.collection("franchiseSettlements").doc(`set-${S}`).set({ tenantId: P.tenantId, franchiseId: S, from: "2026-09-01", to: "2026-09-30" });
    // booked in September, but paid in October: the money sits in an OPEN period, so the listing may move
    const L1 = await makeListing(P, `Paid later ${uniq()}`, false);
    await db.collection("listings").doc(L1.id).set({ franchiseId: S }, { merge: true });
    const base = { tenantId: P.tenantId, status: "Confirmed", pay: "Paid", method: "Cash on the day", kids: [], addons: [], answers: [], child: "c", booker: "b", email: "b@emu.test", franchiseId: S };
    await db.collection("bookings").doc(`${P.tenantId}-late1`).set({ ...base, ref: "late1", bid: "late1", listingId: L1.id, amount: 40, amountPaid: 40, createdAt: "2026-09-10T10:00:00Z" });
    await db.collection("payments").doc(`pay-late1-${uniq()}`).set({ tenantId: P.tenantId, refs: ["late1"], amount: 40, type: "payment", status: "recorded", offline: true, createdAt: "2026-10-05T10:00:00Z" });
    const ok = await call("PUT", `/api/listings/${L1.id}`, P.token, { franchiseId: F2 });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    // control: paid in September (settled) -> refused
    const L2 = await makeListing(P, `Paid in Sept ${uniq()}`, false);
    await db.collection("listings").doc(L2.id).set({ franchiseId: S }, { merge: true });
    await db.collection("bookings").doc(`${P.tenantId}-early1`).set({ ...base, ref: "early1", bid: "early1", listingId: L2.id, amount: 40, amountPaid: 40, createdAt: "2026-10-02T10:00:00Z" });
    await db.collection("payments").doc(`pay-early1-${uniq()}`).set({ tenantId: P.tenantId, refs: ["early1"], amount: 40, type: "payment", status: "recorded", offline: true, createdAt: "2026-09-20T10:00:00Z" });
    const no = await call("PUT", `/api/listings/${L2.id}`, P.token, { franchiseId: F2 });
    assert.equal(no.status, 409, JSON.stringify(no.json));
  });
});

describe("F11/F38: feature switches validate their target", () => {
  it("an unknown franchise is 404 and creates nothing; an unknown view is 400", async () => {
    const r = await toggle("nope", "meals", false);
    assert.equal(r.status, 404, JSON.stringify(r.json));
    assert.equal((await db.collection("libraries").doc(`${P.tenantId}__fr__nope`).get()).exists, false);
    const z = await toggle(F1, "zzz", false);
    assert.equal(z.status, 400, JSON.stringify(z.json));
    assert.equal((await lib(F1).get()).get("settings.features.zzz"), undefined);
    assert.equal((await call("PUT", "/api/franchises/__all__/features", P.token, { view: "zzz", on: false })).status, 400);
  });
  it("another head office's franchise id is a 404 (tenant isolation)", async () => {
    const other = await makeProvider("frother");
    const r = await call("PUT", `/api/franchises/${F1}/features`, other.token, { view: "meals", on: false });
    assert.equal(r.status, 404, JSON.stringify(r.json));
  });
});

describe("F14/F13: head office's switches are authoritative; safety features cannot be switched off", () => {
  it("a franchise cannot switch Meals back on, and the API says head office did it", async () => {
    assert.equal((await toggle(F2, "meals", false)).status, 200);
    const g = await call("GET", "/api/library", t2);
    assert.equal(g.json.settings.features.meals, false);
    const put = await call("PUT", "/api/library", t2, { settings: { ...g.json.settings, features: { ...g.json.settings.features, meals: true } } });
    assert.equal(put.status, 403, JSON.stringify(put.json));
    assert.match(put.json.error, /Head office has turned this off/);
    assert.doesNotMatch(put.json.error, /switched off/, "PortalGuard reads 'switched off' as a closed account");
    assert.equal((await lib(F2).get()).get("settings.features.meals"), false);
    await sleep(10_200); // the access cache
    const api = await call("GET", "/api/meals", t2);
    assert.equal(api.status, 403);
    assert.doesNotMatch(api.json.error, /turn it back on in Setup/);
    assert.match(api.json.error, /head office/i);
    // other settings still save; head office turning it back on lifts the lock
    assert.equal((await call("PUT", "/api/library", t2, { settings: { ...g.json.settings, brandColor: "#222222" } })).status, 200);
    assert.equal((await toggle(F2, "meals", true)).status, 200);
    const g2 = await call("GET", "/api/library", t2);
    assert.notEqual(g2.json.settings.features.meals, false);
    assert.equal((await call("PUT", "/api/library", t2, { settings: { ...g2.json.settings, features: { ...g2.json.settings.features, meals: false } } })).status, 200, "a franchise may still switch its own modules off");
  });
  it("registers, incidents and medication cannot be switched off for a franchise (400); trips can and really blocks", async () => {
    for (const v of ["registers", "admin-registers", "incidents", "medication"]) {
      const r = await toggle(F1, v, false);
      assert.equal(r.status, 400, `${v}: ${JSON.stringify(r.json)}`);
      assert.match(r.json.error, /can't be switched off/);
      assert.equal((await call("PUT", "/api/franchises/__all__/features", P.token, { view: v, on: false })).status, 400);
    }
    assert.equal((await lib(F1).get()).get("settings.features.incidents"), undefined);
    assert.equal((await toggle(F1, "registers", true)).status, 200, "turning one ON is allowed");
    assert.equal((await toggle(F1, "trips", false)).status, 200);
    await sleep(10_200);
    assert.equal((await call("GET", "/api/trips", t1)).status, 403);
    assert.equal((await call("GET", "/api/incidents", t1)).status, 200);
    assert.equal((await call("GET", "/api/medications", t1)).status, 200);
  });
});

describe("F10: a franchise that joins after an all-franchises switch starts with the head-office default", () => {
  it("__all__ off, then a new franchise: its library shows the feature OFF and locked", async () => {
    assert.equal((await call("PUT", "/api/franchises/__all__/features", P.token, { view: "marketing", on: false })).status, 200);
    const F3 = `frS3-${uniq()}`;
    tNew = (await mk("fr3", { role: "franchise", franchiseId: F3, franchiseName: "Charlie", name: "C" })).token;
    const g = await call("GET", "/api/library", tNew);
    assert.equal(g.status, 200);
    assert.equal(g.json.settings.features.marketing, false, "starts with the head-office default");
    const put = await call("PUT", "/api/library", tNew, { settings: { ...g.json.settings, features: { ...g.json.settings.features, marketing: true } } });
    assert.equal(put.status, 403);
    const m = await call("GET", "/api/franchises/features", P.token);
    assert.equal(m.json.find((x: any) => x.franchiseId === F3).features.marketing, false);
  });
  it("a franchise that never opened Setup also resolves to the default (access check path)", async () => {
    const F4 = `frS4-${uniq()}`;
    await mk("fr4", { role: "franchise", franchiseId: F4, franchiseName: "Delta", name: "D" });
    const { loadSettings } = await import("../../server/src/lib/tenantLibrary");
    const s = await loadSettings(P.tenantId, F4);
    assert.equal((s.features as Record<string, unknown>).marketing, false);
  });
});

describe("F17: a franchise invite does not use a staff seat", () => {
  it("staff at the plan limit still can invite a franchise, but not another staff member", async () => {
    const Q = await makeProvider("frcap");
    await db.collection("tenants").doc(Q.tenantId).set({ subscription: { status: "active", staffLimit: 1, staffUsed: 1 } }, { merge: true });
    await db.collection("users").doc(`staff-${uniq()}`).set({ role: "staff", tenantId: Q.tenantId, email: `s-${uniq()}@emu.test` });
    const staff = await call("POST", "/api/invites", Q.token, { role: "staff", email: `new-${uniq()}@emu.test` });
    assert.equal(staff.status, 403, JSON.stringify(staff.json));
    assert.match(staff.json.error, /plan covers 1 team member/);
    const fr = await call("POST", "/api/invites", Q.token, { role: "franchise", franchiseName: "Echo", franchiseArea: "North" });
    assert.equal(fr.status, 201, JSON.stringify(fr.json));
  });
});

describe("F19: territories", () => {
  const sq = (lat: number, lng: number, d = 0.1) => [{ lat, lng }, { lat, lng: lng + d }, { lat: lat + d, lng: lng + d }, { lat: lat + d, lng }];
  const area = (id: string, rings: unknown) => ({ id, name: id, color: "#f00", rings });
  const terr = (fid: string, body: unknown) => call("PUT", `/api/franchises/${fid}/territory`, P.token, body);
  const stored = async (fid: string) => (await db.collection("users").where("tenantId", "==", P.tenantId).where("franchiseId", "==", fid).get()).docs[0].get("franchiseTerritory");
  it("a material edit of an agreed territory resets it to proposed and clears agreedAt", async () => {
    const a = await terr(F1, { status: "agreed", areas: [area("a1", sq(51.0, 0.0))] });
    assert.equal(a.status, 200, JSON.stringify(a.json));
    const agreed = await stored(F1);
    assert.equal(agreed.status, "agreed");
    assert.ok(agreed.agreedAt);
    // re-sending the same areas, or a name-only no-op, keeps it agreed
    assert.equal((await terr(F1, { areas: [area("a1", sq(51.0, 0.0))] })).json.status, null);
    assert.equal((await stored(F1)).status, "agreed");
    assert.equal((await stored(F1)).agreedAt, agreed.agreedAt);
    // moving the border does not
    const e = await terr(F1, { areas: [area("a1", sq(52.0, 1.0))] });
    assert.equal(e.status, 200);
    assert.equal(e.json.status, "proposed");
    const after = await stored(F1);
    assert.equal(after.status, "proposed");
    assert.equal(after.agreedAt, undefined);
    assert.equal(after.agreedBy, undefined);
  });
  it("overlapping agreed areas of two franchises are flagged (response and list), never blocked", async () => {
    await terr(F1, { status: "agreed", areas: [area("a1", sq(52.0, 1.0, 0.2))] });
    const r = await terr(F2, { status: "agreed", areas: [area("b1", sq(52.1, 1.1, 0.2))] });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.overlapWarnings?.[0]?.franchiseId, F1);
    const list = await call("GET", "/api/franchises", P.token);
    assert.equal(list.json.find((x: any) => x.franchiseId === F2).overlapWarnings[0].franchiseId, F1);
    assert.equal(list.json.find((x: any) => x.franchiseId === F1).overlapWarnings[0].franchiseId, F2);
    // a disjoint territory carries no warning
    await terr(F2, { areas: [area("b1", sq(40.0, 5.0))] });
    assert.equal((await terr(F2, { status: "agreed" })).json.overlapWarnings, undefined);
  });
});

describe("F31: a child booked with two franchises", () => {
  it("head-office oversight shows the record under both franchises and flags it", async () => {
    const childId = `kid-${uniq()}`;
    const base = { tenantId: P.tenantId, status: "Confirmed", kids: [], addons: [], answers: [], booker: "b", email: "b@emu.test", amount: 0, childId, child: "Twin Child" };
    await db.collection("bookings").doc(`${P.tenantId}-tw1`).set({ ...base, ref: "tw1", bid: "tw1", franchiseId: F1 });
    await db.collection("bookings").doc(`${P.tenantId}-tw2`).set({ ...base, ref: "tw2", bid: "tw2", franchiseId: F2 });
    await db.collection("bookings").doc(`${P.tenantId}-tw3`).set({ ...base, ref: "tw3", bid: "tw3", childId: `solo-${uniq()}`, child: "Solo Child", franchiseId: F1 });
    const inc = await db.collection("incidents").add({ tenantId: P.tenantId, kind: "incident", childId, childName: "Twin Child", date: "2026-10-10", createdAt: ago(1000) });
    const ov = await call("GET", "/api/ho/oversight/incidents", P.token);
    assert.equal(ov.status, 200);
    const rec = ov.json.records.find((r: any) => r.id === inc.id);
    assert.equal(rec.multiFranchise, true);
    assert.deepEqual([...rec.franchiseIds].sort(), [F1, F2].sort());
    const counts = Object.fromEntries(ov.json.byFranchise.map((b: any) => [b.franchiseId, b.total]));
    assert.ok(counts[F1] >= 1 && counts[F2] >= 1, JSON.stringify(counts));
    // a one-franchise child is not flagged
    const solo = await db.collection("incidents").add({ tenantId: P.tenantId, kind: "incident", childName: "Solo Child", date: "2026-10-10", createdAt: ago(500) });
    const rec2 = (await call("GET", "/api/ho/oversight/incidents", P.token)).json.records.find((r: any) => r.id === solo.id);
    assert.equal(rec2.multiFranchise, undefined);
  });
});
