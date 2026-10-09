// Round 2 behaviour tests (npm run test:emu) for extra change / cancel requests. ONE money rule everywhere (owner, 8 Oct):
//   removed share = the pass price of the cancelled day(s) (cancel-day only) + the daily extra's share of them;
//   new amount = old amount - removed share; refund = max(0, paid - new amount); a one-off extra is never spread over days.
// Synthetic data only, emulator only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, bookingAsRole, day, ids, operatorAction, seedAddons, ukDay } from "../../scripts/emu/addons-helpers.mts";

const uniq = () => Math.random().toString(36).slice(2, 7);
const BOTTLE = (c = "Blue") => ({ id: "AW", answers: { Colour: c } });
const SHIRT = (s = "M") => ({ id: "AT", answers: { Size: s } });
before(async () => { await seedAddons({ extraD1: [4, 2] }); });
// These cases are about cash only: no wallet credit left over from other test files may be spent by the checkout.
const noWallet = async () => { await (await adminDb()).collection("wallet").doc(`${ids().tenants.P}__parent-a@emu.test`).set({ balance: 0 }, { merge: true }); };

async function mk(tag: string, addons: any[], o: { pay?: number | "full" } = {}) {
  await noWallet();
  const child = `${tag} ${uniq()}`;
  const b = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: child, days: "all", addons }] });
  assert.equal(b.status, 201, JSON.stringify(b.json));
  const ref = b.refs[0];
  if (o.pay === "full") assert.equal((await operatorAction(ref, "paid")).status, 200);
  else if (o.pay) assert.equal((await as("P", "POST", `/api/bookings/${ref}/record-payment`, { amount: o.pay, method: "Bank transfer" })).status, 200);
  return { ref, child };
}
const doc = async (ref: string) => (await bookingAsRole(ref, "P")).json;
const line = async (ref: string, name: string) => (await doc(ref)).addonLines?.find((l: any) => l.name === name);
const keyOf = async (ref: string, name: string) => (await as("A", "GET", `/api/my/bookings/${encodeURIComponent(ref)}/addon-options`)).json.lines.find((x: any) => x.name === name).key as string;
const post = (ref: string, body: unknown) => as("A", "POST", `/api/my/bookings/${encodeURIComponent(ref)}/addon-requests`, body);
const approve = (ref: string, requestId: string, resolution?: string) => operatorAction(ref, "addon-approve", { requestId, ...(resolution ? { resolution } : {}) });
async function patchDays(ref: string, fn: (d: string[]) => string[]) {
  const db = await adminDb();
  const s = (await db.collection("bookings").where("ref", "==", ref).get()).docs[0];
  const d = s.data() as any;
  await s.ref.update({ days: fn(d.days), addonLines: (d.addonLines ?? []).map((l: any) => ({ ...l, days: l.days?.length ? fn(l.days) : l.days })) });
}

describe("V12 / V12b: a request removes its share from the amount; a refund is only what is overpaid", () => {
  it("part-paid 10 of 161, 12 of extras removed: amount 149, owed 139, nothing refunded", async () => {
    const { ref } = await mk("v12", [BOTTLE()], { pay: 10 });
    const r = await post(ref, { kind: "cancel", targets: [{ key: await keyOf(ref, "Water bottle"), days: [4, 5, 6, 7].map((n) => day(n)) }] });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal((await approve(ref, r.json.id, "refund")).status, 200);
    const b = await doc(ref);
    assert.equal(b.amount, 149);
    assert.ok(!(b.cancel?.amount > 0), `no refund: ${JSON.stringify(b.cancel)}`);
    assert.equal(Math.round((b.amount - b.amountPaid) * 100) / 100, 139);
  });
  it("paid 150 of 161, 12 removed: new amount 149, refund exactly 1", async () => {
    const { ref } = await mk("v12b", [BOTTLE()], { pay: 150 });
    const r = await post(ref, { kind: "cancel", targets: [{ key: await keyOf(ref, "Water bottle"), days: [4, 5, 6, 7].map((n) => day(n)) }] });
    assert.equal((await approve(ref, r.json.id, "refund")).status, 200);
    const b = await doc(ref);
    assert.equal(b.amount, 149); assert.equal(b.cancel?.amount, 1);
  });
  it("fully paid 161, 12 removed: amount 149, refund 12", async () => {
    const { ref } = await mk("v12c", [BOTTLE()], { pay: "full" });
    const r = await post(ref, { kind: "cancel", targets: [{ key: await keyOf(ref, "Water bottle"), days: [4, 5, 6, 7].map((n) => day(n)) }] });
    assert.equal((await approve(ref, r.json.id, "refund")).status, 200);
    const b = await doc(ref);
    assert.equal(b.amount, 149); assert.equal(b.cancel?.amount, 12);
  });
});

describe("V20c: a day whose extra was already refunded is not refunded twice", () => {
  it("request D4-D7 approved (12), then cancel-day D5: only the 20 pass share more, 32 in all", async () => {
    const { ref } = await mk("v20c", [BOTTLE()], { pay: "full" });
    const r = await post(ref, { kind: "cancel", targets: [{ key: await keyOf(ref, "Water bottle"), days: [4, 5, 6, 7].map((n) => day(n)) }] });
    assert.equal((await approve(ref, r.json.id, "refund")).status, 200);
    assert.equal((await doc(ref)).cancel?.amount, 12);
    assert.equal((await operatorAction(ref, "cancel-day", { ki: 0, date: day(5), resolution: "refund" })).status, 200);
    const b = await doc(ref);
    assert.equal(b.cancel?.amount, 32); assert.equal(b.amount, 129);
  });
});

describe("V26e: a one-off extra is never spread over cancelled days", () => {
  it("paid 169 with a T-shirt, cancel D3: refund 23 (20 + 3), T-shirt stays at 8", async () => {
    const { ref } = await mk("v26", [BOTTLE(), SHIRT()], { pay: "full" });
    assert.equal((await operatorAction(ref, "cancel-day", { ki: 0, date: day(3), resolution: "refund" })).status, 200);
    const b = await doc(ref);
    assert.equal(b.cancel?.amount, 23); assert.equal(b.amount, 146);
    assert.equal((await line(ref, "T-shirt")).price, 8);
  });
});

describe("owner (a): an unpaid cancelled day also drops the day's pass share", () => {
  it("unpaid 161, cancel D3: owed 138 (20 + 3 off); three days: 92", async () => {
    const { ref } = await mk("a", [BOTTLE()]);
    await operatorAction(ref, "cancel-day", { ki: 0, date: day(3), resolution: "refund" });
    assert.equal((await doc(ref)).amount, 138);
    await operatorAction(ref, "cancel-day", { ki: 0, date: day(1), resolution: "refund" });
    await operatorAction(ref, "cancel-day", { ki: 0, date: day(2), resolution: "refund" });
    assert.equal((await doc(ref)).amount, 92);
  });
});

describe("V10: a target with an empty days list is refused, never read as all days", () => {
  it("empty days -> 400, nothing stored", async () => {
    const { ref } = await mk("v10", [BOTTLE()]);
    const r = await post(ref, { kind: "cancel", targets: [{ key: await keyOf(ref, "Water bottle"), days: [] }] });
    assert.equal(r.status, 400, JSON.stringify(r.json));
    assert.equal((await doc(ref)).addonRequests, undefined);
  });
});

describe("X02: approving a change after a day was cancelled keeps the count honest", () => {
  it("pending Blue->Red, cancel-day D3, approve: x6 Red, 18, 6 days", async () => {
    const { ref } = await mk("x02", [BOTTLE()]);
    const r = await post(ref, { key: await keyOf(ref, "Water bottle"), kind: "change", answers: { Colour: "Red" } });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal((await operatorAction(ref, "cancel-day", { ki: 0, date: day(3), resolution: "refund" })).status, 200);
    assert.equal((await approve(ref, r.json.id)).status, 200);
    const l = await line(ref, "Water bottle");
    assert.equal(l.label, "Water bottle × 6 (Colour: Red)"); assert.equal(l.price, 18); assert.equal(l.days.length, 6);
  });
});

describe("owner (b): a change follows the same remaining-days rule as a cancel", () => {
  it("D1 yesterday, other days open: a colour change is allowed; every day past: refused", async () => {
    const a = await mk("b1", [BOTTLE()]);
    const ka = await keyOf(a.ref, "Water bottle");
    await patchDays(a.ref, (d) => [ukDay(-1), ...d.slice(1)]);
    const ok = await post(a.ref, { key: ka, kind: "change", answers: { Colour: "Red" } });
    assert.equal(ok.status, 201, JSON.stringify(ok.json));
    const b = await mk("b2", [BOTTLE()]);
    const kb = await keyOf(b.ref, "Water bottle");
    await patchDays(b.ref, (d) => d.map((_, i) => ukDay(-1 - i)));
    const no = await post(b.ref, { key: kb, kind: "change", answers: { Colour: "Red" } });
    assert.equal(no.status, 409, JSON.stringify(no.json));
  });
});
