// Verifier follow-ups on the export allow-list and the 30-day / 90-day retention work (10 Oct): per-provider review dates, bookings under any
// email tied to the child, re-delete keeps the first dates, which bookings count, archived children cannot be tagged again, test-tenant
// guard, dry-run backfills, payments + nested family-record children in the export. Real API + Firestore emulator. Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { call, db, login, makeProvider, uniq, type Provider } from "./helpers.mts";

const u = uniq();
const DAY = 86_400_000;
const now = () => new Date().toISOString();
const ukDay = (off = 0) => new Date(Date.now() + off * DAY).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const lib = () => import("../../server/src/lib/childRetention");
let P: Provider; let Q: Provider;
let tok = ""; let uid = ""; let email = "";

before(async () => {
  P = await makeProvider("rfu"); Q = await makeProvider("rfuq");
  email = `rfu-${u}@emu.test`;
  const s = await login(email); tok = s.token; uid = s.uid;
  await db.collection("users").doc(uid).set({ email, role: "parent", chosen: true, name: `Fam ${u}` }, { merge: true });
});

async function planFile(tenantIds: string[], due: string) {
  const kid = (await db.collection("children").add({ name: `Plan ${uniq()}`, parentUid: uid })).id;
  const file = (await db.collection("childFiles").add({ ownerUid: uid, name: "p.pdf", contentType: "application/pdf", bytes: 3, total: 1, complete: true, tenantIds, accessReviewDue: due, createdAt: new Date(Date.now() - 500 * DAY).toISOString() })).id;
  await db.collection("children").doc(kid).set({ sendPlanId: file }, { merge: true });
  return { kid, file };
}
const booking = (t: Provider, kid: string, over: Record<string, unknown>, bookEmail = email) =>
  db.collection("bookings").add({ ref: `B${uniq()}`, tenantId: t.tenantId, email: bookEmail, childId: kid, child: "K", status: "Confirmed", pay: "Paid", createdAt: now(), ...over });
const tenantsOf = async (file: string) => ((await db.collection("childFiles").doc(file).get()).get("tenantIds") as string[]);

describe("F1 a new grant never pushes out another provider's review", () => {
  it("P (last booked 85 days ago) is still removed on time after Q is re-granted", async () => {
    const { kid, file } = await planFile([P.tenantId, Q.tenantId], ukDay(5));
    await booking(P, kid, { days: [ukDay(-85)] });
    await booking(Q, kid, { days: [ukDay(-1)] });
    const { grantPlanAccess } = await import("../../server/src/routes/childFiles");
    await grantPlanAccess([file], Q.tenantId);
    assert.equal((await db.collection("childFiles").doc(file).get()).get("accessReviewDue"), ukDay(5), "the earlier review date stands");
    await (await lib()).planAccessExpiry(ukDay(6));
    assert.deepEqual(await tenantsOf(file), [Q.tenantId]);
  });
});

describe("F2 bookings under another email still count", () => {
  it("a future booking made under a different email keeps access", async () => {
    const { kid, file } = await planFile([P.tenantId], ukDay(-1));
    await booking(P, kid, { days: [ukDay(20)] }, `someone-else-${u}@emu.test`);
    await (await lib()).planAccessExpiry();
    assert.deepEqual(await tenantsOf(file), [P.tenantId]);
  });
});

describe("F3 deleting twice keeps the first dates", () => {
  it("a second DELETE does not move archivedAt or erasureDueAt", async () => {
    const kid = (await db.collection("children").add({ name: `Twice ${u}`, parentUid: uid })).id;
    assert.equal((await call("DELETE", `/api/my/children/${kid}`, tok)).status, 200);
    const first = (await db.collection("children").doc(kid).get()).data()!;
    await db.collection("children").doc(kid).set({ erasureDueAt: new Date(Date.now() + 10 * DAY).toISOString() }, { merge: true });
    assert.equal((await call("DELETE", `/api/my/children/${kid}`, tok)).status, 200);
    const second = (await db.collection("children").doc(kid).get()).data()!;
    assert.equal(second.archivedAt, first.archivedAt);
    assert.equal(Math.round((new Date(second.erasureDueAt).getTime() - Date.now()) / DAY), 10, "10 days left stays 10, not 30");
  });
});

describe("F4 only a confirmed real place counts as a last booking", () => {
  it("waitlisted, approval-needed, offered, cancelled and refunded bookings do not keep access", async () => {
    const { kid, file } = await planFile([P.tenantId], ukDay(-1));
    await booking(P, kid, { days: [ukDay(-120)] });
    for (const over of [{ status: "Waitlisted" }, { status: "Approval needed" }, { status: "Offered" }, { status: "Cancelled" }, { status: "Confirmed", pay: "Refunded" }, { status: "Confirmed", pay: "Refund pending" }])
      await booking(P, kid, { days: [ukDay(10)], ...over });
    await (await lib()).planAccessExpiry();
    assert.deepEqual(await tenantsOf(file), []);
  });
  it("a confirmed place that is still to be paid does count", async () => {
    const { kid, file } = await planFile([P.tenantId], ukDay(-1));
    await booking(P, kid, { days: [ukDay(10)], pay: "Unpaid" });
    await (await lib()).planAccessExpiry();
    assert.deepEqual(await tenantsOf(file), [P.tenantId]);
  });
});

describe("F5 a deleted child cannot be tagged in a new moment", () => {
  it("posting a 'their work' moment for an archived child is refused", async () => {
    const kid = (await db.collection("children").add({ name: `Gone ${u}`, parentUid: uid, archived: true, archivedAt: now() })).id;
    await booking(P, kid, { days: [ukDay(-3)] });
    const r = await call("POST", "/api/moments", P.token, { photoType: "work", caption: "painting", childIds: [kid] });
    assert.equal(r.status, 409, JSON.stringify(r.json));
    assert.match(String(r.json.error), /deleted/);
  });
});

describe("F6 test tenants are skipped when SWEEPS_SKIP_TEST_TENANTS=1 (same name and meaning as the mail-volume branch)", () => {
  it("plan grants and moments of a test tenant are left alone, then handled once the guard is off", async () => {
    const { kid, file } = await planFile([P.tenantId], ukDay(-1));
    await booking(P, kid, { days: [ukDay(-200)] });
    const gone = (await db.collection("children").add({ name: `TT ${u}`, parentUid: uid, archived: true, archivedAt: now(), erasureDueAt: new Date(Date.now() - DAY).toISOString() })).id;
    const m = (await db.collection("moments").add({ tenantId: P.tenantId, photoType: "child", childIds: [gone], childNames: ["TT"], caption: "x", createdAt: now() })).id;
    process.env.SWEEPS_SKIP_TEST_TENANTS = "1";
    try {
      await (await lib()).planAccessExpiry();
      await (await lib()).childPhotoErasure();
      assert.deepEqual(await tenantsOf(file), [P.tenantId], "test tenant grant kept");
      assert.ok((await db.collection("moments").doc(m).get()).exists, "test tenant moment kept");
      process.env.SWEEPS_SKIP_TEST_TENANTS = "0";
      await db.collection("childFiles").doc(file).set({ accessReviewDue: ukDay(-1) }, { merge: true });
      await db.collection("children").doc(gone).set({ erasureDueAt: new Date(Date.now() - DAY).toISOString() }, { merge: true });
      await (await lib()).planAccessExpiry();
      await (await lib()).childPhotoErasure();
      assert.deepEqual(await tenantsOf(file), []);
      assert.ok(!(await db.collection("moments").doc(m).get()).exists);
    } finally { delete process.env.SWEEPS_SKIP_TEST_TENANTS; }
  });
});

describe("F7 the one-off backfills are dry runs unless told to apply", () => {
  it("counts without writing, then writes on apply", async () => {
    const kid = (await db.collection("children").add({ name: `Old ${u}`, parentUid: uid, archived: true, archivedAt: new Date(Date.now() - 40 * DAY).toISOString() })).id;
    const file = (await db.collection("childFiles").add({ ownerUid: uid, name: "o.pdf", contentType: "application/pdf", bytes: 1, total: 1, complete: true, tenantIds: [P.tenantId], createdAt: now() })).id;
    const l = await lib();
    const d1 = await l.backfillErasureDates(false); const d2 = await l.backfillAccessReviews(false);
    assert.ok(d1.candidates >= 1 && d1.alreadyPastDue >= 1 && d2.candidates >= 1);
    assert.equal((await db.collection("children").doc(kid).get()).get("erasureDueAt"), undefined);
    assert.equal((await db.collection("childFiles").doc(file).get()).get("accessReviewDue"), undefined);
    await l.backfillErasureDates(true); await l.backfillAccessReviews(true);
    assert.ok((await db.collection("children").doc(kid).get()).get("erasureDueAt"));
    assert.ok((await db.collection("childFiles").doc(file).get()).get("accessReviewDue"));
    assert.equal((await l.backfillErasureDates(false)).candidates, 0, "idempotent");
  });
  it("the sweeps themselves no longer run a hidden backfill", async () => {
    const file = (await db.collection("childFiles").add({ ownerUid: uid, name: "n.pdf", contentType: "application/pdf", bytes: 1, total: 1, complete: true, tenantIds: [P.tenantId], createdAt: now() })).id;
    await (await lib()).planAccessExpiry();
    assert.equal((await db.collection("childFiles").doc(file).get()).get("accessReviewDue"), undefined);
    assert.deepEqual(await tenantsOf(file), [P.tenantId]);
  });
});

describe("export: payments and the family record's nested children", () => {
  it("payments keep amount, date, method, status and booking ref but not Stripe ids, notes or errors", async () => {
    const id = (await db.collection("payments").add({ tenantId: P.tenantId, email, refs: [`REF${u}`], amount: 12.5, currency: "gbp", method: "card", status: "succeeded", createdAt: now(), paidAt: now(),
      paymentIntentId: `pi_SECRET${u}`, stripeAccount: `acct_SECRET${u}`, refundId: `re_SECRET${u}`, note: `PRIVATE-NOTE-${u}`, error: `STRIPE-ERR-${u}`, recordedBy: `staff-${u}@provider.test` })).id;
    const exp = await call("GET", "/api/privacy/export", tok);
    const text = JSON.stringify(exp.json);
    for (const t of ["pi_SECRET", "acct_SECRET", "re_SECRET", "PRIVATE-NOTE", "STRIPE-ERR", `staff-${u}@provider.test`]) assert.ok(!text.includes(t), `${t} in the export`);
    const row = exp.json.payments.find((p: any) => p.id === id);
    assert.equal(row.amount, 12.5); assert.equal(row.method, "card"); assert.equal(row.status, "succeeded"); assert.deepEqual(row.refs, [`REF${u}`]); assert.ok(row.createdAt);
  });
  it("a provider-added key inside a child entry of the family record stays out", async () => {
    await db.collection("customers").add({ tenantId: P.tenantId, name: "F", email, children: [{ name: "Kid", age: 7, childId: "c1", providerFlag: `FLAG-${u}`, behaviourNote: `BEH-${u}` }] });
    const exp = await call("GET", "/api/privacy/export", tok);
    const text = JSON.stringify(exp.json);
    assert.ok(!text.includes(`FLAG-${u}`) && !text.includes(`BEH-${u}`));
    assert.equal(exp.json.providerFamilyRecords[0].children[0].name, "Kid");
  });
});
