// Behaviour tests (npm run test:emu): a family's requests to change or cancel extras (add-ons), CASES-v2 section C, plus the money part of AD16 / AM03.
// Real API + Firestore emulator, seeded with scripts/emu/seed-addons-run.mts's library (via scripts/emu/addons-helpers.mts). Synthetic data only.
//
// Rules under test (owner, 8 Oct): a family can ask to change or cancel an extra; it is ALWAYS a request the provider approves, separate from
// cancelling the booking; one request can cover SEVERAL days of a daily extra and SEVERAL extras; a day inside the cut-off (3 days, per day)
// cannot be included; after day 1 has passed the remaining days can still be cancelled; a change of choice never carries a price difference;
// cancelling one day of a daily extra follows the day (its £3 share leaves the line and, when nothing was paid, the amount owed).
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  adminDb, as, bookWithAddons, bookingAsRole, day, ids, kitDay, operatorAction, registerDay, seedAddons, ukDay,
} from "../../scripts/emu/addons-helpers.mts";

const uniq = () => Math.random().toString(36).slice(2, 7);
const nm = (tag: string) => `${tag} ${uniq()}`;
const BOTTLE = (c = "Blue") => ({ id: "AW", answers: { Colour: c } });
const SHIRT = (s = "M") => ({ id: "AT", answers: { Size: s } });

before(async () => { await seedAddons({ extraD1: [4, 2] }); });

/** Book (bank transfer, so Unpaid), optionally mark it paid. Returns the ref, the child and the key of each extra from the family's own options. */
async function mk(tag: string, addons: any[], o: { paid?: boolean; listing?: string; days?: any } = {}) {
  const child = nm(tag);
  const b = await bookWithAddons({ parent: "A", listing: o.listing ?? "LK", children: [{ name: child, days: o.days ?? "all", addons }] });
  assert.equal(b.status, 201, JSON.stringify(b.json));
  const ref = b.refs[0];
  if (o.paid) assert.equal((await operatorAction(ref, "paid")).status, 200);
  return { ref, child };
}
const options = async (ref: string) => { const r = await as("A", "GET", `/api/my/bookings/${encodeURIComponent(ref)}/addon-options`); assert.equal(r.status, 200, JSON.stringify(r.json)); return r.json; };
const keyOf = async (ref: string, name: string) => { const l = (await options(ref)).lines.find((x: any) => x.name === name); assert.ok(l, `no ${name} line`); return l.key as string; };
const doc = async (ref: string) => { const r = await bookingAsRole(ref, "P"); assert.equal(r.status, 200); return r.json; };
const line = async (ref: string, name: string) => (await doc(ref)).addonLines?.find((l: any) => l.name === name);
/** The new request shape: a list of targets, each an extra line and (for a daily extra) the specific days. */
const cancelReq = (ref: string, targets: { key: string; days?: string[] }[], note?: string) =>
  as("A", "POST", `/api/my/bookings/${encodeURIComponent(ref)}/addon-requests`, { kind: "cancel", targets, ...(note ? { note } : {}) });
const approve = (ref: string, requestId: string, resolution?: string) => operatorAction(ref, "addon-approve", { requestId, ...(resolution ? { resolution } : {}) });
const mailsTo = async (to: string) => { const s = await (await adminDb()).collection("mailLog").where("to", "==", to).get(); return s.docs.map((d) => d.data() as { subject: string; html?: string }); };

async function kitHas(n: number, child: string, item = "Water bottle") {
  const r = await kitDay(n);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return (r.json.groups as any[]).some((g) => g.name === item && g.children.some((c: any) => c.child === child));
}
async function regHas(n: number, ref: string, item = "Water bottle") {
  const r = await registerDay(n);
  assert.equal(r.status, 200);
  return (r.json as any[]).some((s) => (s.attendees ?? []).some((a: any) => a.bookingRef === ref && (a.addons ?? []).some((x: string) => x.startsWith(item))));
}
/** Direct emulator write (disclosed shortcut: the product refuses a booking in the past): make D1 of a booking yesterday. */
async function pastD1(ref: string) {
  const db = await adminDb();
  const s = await db.collection("bookings").where("ref", "==", ref).get();
  assert.equal(s.size, 1);
  const y = ukDay(-1);
  const d = s.docs[0].data() as any;
  const shift = (a?: string[]) => (a?.length ? [y, ...a.slice(1)] : a);
  await s.docs[0].ref.update({ days: shift(d.days), addonLines: (d.addonLines ?? []).map((l: any) => ({ ...l, days: shift(l.days) })) });
}
const setBottlePrice = async (p: number) => {
  const lib = (await as("P", "GET", "/api/library")).json;
  const r = await as("P", "PUT", "/api/library", { ...lib, addons: lib.addons.map((a: any) => (a.id === "addon-emu-aw" ? { ...a, price: p } : a)) });
  assert.equal(r.status, 200);
};

describe("AR12: changing a choice is never a price change, and approving never fails with a 500", () => {
  it("colour change after the library price went 3 -> 4: no price difference, approve works, price stays as booked", async () => {
    const { ref } = await mk("ar12", [BOTTLE("Blue")]);
    await setBottlePrice(4);
    try {
      const key = await keyOf(ref, "Water bottle");
      const r = await as("A", "POST", `/api/my/bookings/${encodeURIComponent(ref)}/addon-requests`, { key, kind: "change", answers: { Colour: "Red" } });
      assert.equal(r.status, 201, JSON.stringify(r.json));
      assert.ok(!r.json.priceDiff, `a colour change carries no price difference, got ${r.json.priceDiff}`);
      const a = await approve(ref, r.json.id);
      assert.equal(a.status, 200, `approve must not fail: ${a.status} ${JSON.stringify(a.json).slice(0, 200)}`);
      const l = await line(ref, "Water bottle");
      assert.equal(l.price, 21); assert.match(l.label, /Red/);
      assert.equal((await doc(ref)).amount, 161);
    } finally { await setBottlePrice(3); }
  });

  it("a stored request that still carries a price difference is answered with a 400 and a reason, never a 500; the booking is untouched", async () => {
    const { ref } = await mk("ar12b", [BOTTLE("Blue")]);
    const key = await keyOf(ref, "Water bottle");
    const r = await as("A", "POST", `/api/my/bookings/${encodeURIComponent(ref)}/addon-requests`, { key, kind: "change", answers: { Colour: "Red" } });
    assert.equal(r.status, 201);
    const db = await adminDb();
    const s = (await db.collection("bookings").where("ref", "==", ref).get()).docs[0];
    await s.ref.update({ addonRequests: (s.data().addonRequests as any[]).map((x) => ({ ...x, priceDiff: 7 })) }); // how an old request looked after a library price change
    const bad = await approve(ref, r.json.id);
    assert.equal(bad.status, 400, `expected a 400 with a reason, got ${bad.status} ${JSON.stringify(bad.json).slice(0, 200)}`);
    assert.ok(bad.json?.error);
    assert.match((await line(ref, "Water bottle")).label, /Blue/);
    const ok = await approve(ref, r.json.id, "waive");
    assert.equal(ok.status, 200);
    assert.equal((await line(ref, "Water bottle")).price, 21);
  });
});

describe("AR13: after day 1 has passed the remaining days can still be cancelled (remaining days only)", () => {
  it("D1 yesterday: cancel D2 to D7 -> allowed; D1 stays; approve (refund) gives 18.00 pending; kit and register drop D2 to D7", async () => {
    const { ref, child } = await mk("ar13", [BOTTLE()], { paid: true });
    await pastD1(ref);
    const key = await keyOf(ref, "Water bottle");
    const days = [2, 3, 4, 5, 6, 7].map((n) => day(n));
    const r = await cancelReq(ref, [{ key, days }]);
    assert.equal(r.status, 201, `remaining days must be allowed: ${r.status} ${JSON.stringify(r.json)}`);
    const d1 = await cancelReq(ref, [{ key, days: [ukDay(-1)] }]);
    assert.ok(d1.status >= 400 && d1.status < 500 && d1.json?.error, "the day that has passed cannot be included (refused with a reason)");
    const a = await approve(ref, r.json.id, "refund");
    assert.equal(a.status, 200, JSON.stringify(a.json).slice(0, 200));
    const b = await doc(ref);
    assert.equal(b.cancel?.refund, "pending"); assert.equal(b.cancel?.amount, 18);
    assert.equal(b.status, "Confirmed");
    const l = await line(ref, "Water bottle");
    assert.deepEqual(l.days, [ukDay(-1)]); assert.equal(l.price, 3);
    assert.equal(await kitHas(2, child), false); assert.equal(await kitHas(7, child), false);
    assert.equal(await regHas(2, ref), false); assert.equal(await regHas(7, ref), false);
  });
});

describe("AR15: bulk, days", () => {
  it("D4 to D7 of the water bottle in ONE request: pending changes nothing; approve (refund) records 12.00; D1 to D3 stay, D4 to D7 go", async () => {
    const { ref, child } = await mk("ar15", [BOTTLE()], { paid: true });
    const key = await keyOf(ref, "Water bottle");
    const r = await cancelReq(ref, [{ key, days: [4, 5, 6, 7].map((n) => day(n)) }]);
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const before = await doc(ref);
    assert.equal(before.addonRequests.filter((x: any) => x.status === "pending").length, 1);
    assert.equal(before.addonLines[0].days.length, 7); assert.equal(before.cancel, null);
    assert.equal(await kitHas(5, child), true, "nothing changes until the provider approves");
    const a = await approve(ref, r.json.id, "refund");
    assert.equal(a.status, 200, JSON.stringify(a.json).slice(0, 200));
    const b = await doc(ref);
    assert.equal(b.cancel?.refund, "pending"); assert.equal(b.cancel?.amount, 12);
    assert.equal(b.status, "Confirmed");
    const l = await line(ref, "Water bottle");
    assert.equal(l.days.length, 3); assert.equal(l.price, 9);
    for (const n of [1, 2, 3]) { assert.equal(await kitHas(n, child), true, `D${n} kept`); assert.equal(await regHas(n, ref), true); }
    for (const n of [4, 5, 6, 7]) { assert.equal(await kitHas(n, child), false, `D${n} dropped`); assert.equal(await regHas(n, ref), false); }
  });
});

describe("AR16: bulk, extras", () => {
  it("water bottle D5 to D7 AND the T-shirt in ONE request: 9 + 8 = 17.00 refunded; both lines removed from the days concerned", async () => {
    const { ref, child } = await mk("ar16", [BOTTLE(), SHIRT()], { paid: true });
    const kb = await keyOf(ref, "Water bottle"), kt = await keyOf(ref, "T-shirt");
    const r = await cancelReq(ref, [{ key: kb, days: [5, 6, 7].map((n) => day(n)) }, { key: kt }]);
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal((await doc(ref)).addonRequests.filter((x: any) => x.status === "pending").length, 1, "one request covering both");
    assert.equal(await kitHas(1, child, "T-shirt"), true);
    const a = await approve(ref, r.json.id, "refund");
    assert.equal(a.status, 200, JSON.stringify(a.json).slice(0, 200));
    const b = await doc(ref);
    assert.equal(b.cancel?.refund, "pending"); assert.equal(b.cancel?.amount, 17);
    assert.equal(await line(ref, "T-shirt"), undefined);
    assert.equal((await line(ref, "Water bottle")).days.length, 4);
    assert.equal(await kitHas(1, child, "T-shirt"), false);
    assert.equal(await kitHas(4, child), true); assert.equal(await kitHas(5, child), false);
    assert.equal(await regHas(4, ref), true); assert.equal(await regHas(6, ref), false);
  });
});

describe("AR17: the provider declines a bulk request", () => {
  it("nothing changes on any line; the request is declined with the reason; the family is told", async () => {
    const { ref } = await mk("ar17", [BOTTLE(), SHIRT()], { paid: true });
    const kb = await keyOf(ref, "Water bottle"), kt = await keyOf(ref, "T-shirt");
    const r = await cancelReq(ref, [{ key: kb, days: [5, 6, 7].map((n) => day(n)) }, { key: kt }]);
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const d = await operatorAction(ref, "addon-decline", { requestId: r.json.id, reason: "Already ordered" });
    assert.equal(d.status, 200, JSON.stringify(d.json).slice(0, 200));
    const b = await doc(ref);
    assert.equal(b.addonRequests[0].status, "declined"); assert.equal(b.addonRequests[0].declineReason, "Already ordered");
    assert.equal(b.addonLines.length, 2); assert.equal((await line(ref, "Water bottle")).days.length, 7); assert.equal(b.cancel, null); assert.equal(b.amount, 169);
    const mails = await mailsTo("parent-a@emu.test");
    assert.ok(mails.some((m) => /declined/i.test(m.subject) && /Already ordered/.test(m.html ?? "")), "the family is told, with the reason");
  });
});

describe("AR18: a bulk request that includes a day inside the cut-off (3 days)", () => {
  it("LK_D2 starts in 2 days: D1 (2 days away) cannot be included, D2 (3 days away) can", async () => {
    const { ref } = await mk("ar18", [BOTTLE()], { listing: "LK_D2" });
    const key = await keyOf(ref, "Water bottle");
    const bad = await cancelReq(ref, [{ key, days: [1, 2].map((n) => day(n, "LK_D2")) }]);
    assert.equal(bad.status, 409, `a day inside the cut-off is refused: ${bad.status} ${JSON.stringify(bad.json)}`);
    assert.ok(bad.json?.error);
    assert.equal((await doc(ref)).addonRequests ?? undefined, undefined, "nothing was stored");
    const good = await cancelReq(ref, [{ key, days: [2, 3].map((n) => day(n, "LK_D2")) }]);
    assert.equal(good.status, 201, JSON.stringify(good.json));
  });
});

describe("AR05 / AR06 regressions", () => {
  it("a second request for the same extra while one is pending is refused with a reason (also inside a bulk request)", async () => {
    const { ref } = await mk("ar05", [BOTTLE(), SHIRT()]);
    const kt = await keyOf(ref, "T-shirt"), kb = await keyOf(ref, "Water bottle");
    const one = await as("A", "POST", `/api/my/bookings/${encodeURIComponent(ref)}/addon-requests`, { key: kt, kind: "cancel" });
    assert.equal(one.status, 201, JSON.stringify(one.json));
    const two = await as("A", "POST", `/api/my/bookings/${encodeURIComponent(ref)}/addon-requests`, { key: kt, kind: "cancel" });
    assert.equal(two.status, 409); assert.ok(two.json?.error);
    const bulk = await cancelReq(ref, [{ key: kb, days: [6, 7].map((n) => day(n)) }, { key: kt }]);
    assert.ok(bulk.status === 409 && bulk.json?.error, `a bulk request touching a pending extra is refused: ${bulk.status}`);
    assert.equal((await doc(ref)).addonRequests.length, 1);
  });

  it("cut-off: 4 days before accepted; 2 days before refused; once the session has passed refused", async () => {
    const a = await mk("ar06a", [SHIRT()], { listing: "LK_D4" });
    const ok = await as("A", "POST", `/api/my/bookings/${encodeURIComponent(a.ref)}/addon-requests`, { key: await keyOf(a.ref, "T-shirt"), kind: "cancel" });
    assert.equal(ok.status, 201, JSON.stringify(ok.json));
    const b = await mk("ar06b", [SHIRT()], { listing: "LK_D2" });
    const no = await as("A", "POST", `/api/my/bookings/${encodeURIComponent(b.ref)}/addon-requests`, { key: await keyOf(b.ref, "T-shirt"), kind: "cancel" });
    assert.equal(no.status, 409); assert.ok(no.json?.error);
    const c = await mk("ar06c", [SHIRT()]);
    const key = await keyOf(c.ref, "T-shirt");
    await pastD1(c.ref);
    const late = await as("A", "POST", `/api/my/bookings/${encodeURIComponent(c.ref)}/addon-requests`, { key, kind: "cancel" });
    assert.equal(late.status, 409); assert.ok(late.json?.error);
  });
});

describe("AR07 to AR10 regressions: cancel one extra (the single-line request keeps working)", () => {
  const ask = (ref: string, key: string) => as("A", "POST", `/api/my/bookings/${encodeURIComponent(ref)}/addon-requests`, { key, kind: "cancel" });
  it("AR07+AR08: paid booking, T-shirt cancel is only pending; approve with refund records 8.00 pending; line gone; booking stays confirmed", async () => {
    const { ref, child } = await mk("ar07", [SHIRT()], { paid: true });
    assert.equal((await doc(ref)).amount, 148);
    const r = await ask(ref, await keyOf(ref, "T-shirt"));
    assert.equal(r.status, 201);
    const mid = await doc(ref);
    assert.equal(mid.amount, 148); assert.equal(mid.status, "Confirmed"); assert.ok(await line(ref, "T-shirt"));
    assert.equal((await approve(ref, r.json.id, "refund")).status, 200);
    const b = await doc(ref);
    assert.equal(b.cancel?.refund, "pending"); assert.equal(b.cancel?.amount, 8); assert.equal(b.status, "Confirmed");
    assert.equal(await line(ref, "T-shirt"), undefined);
    assert.equal(await kitHas(1, child, "T-shirt"), false);
  });
  it("AR09: wallet credit gives 8.00 now; no refund moves nothing; the line is gone either way", async () => {
    const w = await mk("ar09w", [SHIRT()], { paid: true });
    const rw = await ask(w.ref, await keyOf(w.ref, "T-shirt"));
    assert.equal((await approve(w.ref, rw.json.id, "wallet")).status, 200);
    const bw = await doc(w.ref);
    assert.ok((bw.refundLog ?? []).some((x: any) => x.source === "Wallet" && x.amount === 8)); assert.equal(await line(w.ref, "T-shirt"), undefined);
    const n = await mk("ar09n", [SHIRT()], { paid: true });
    const rn = await ask(n.ref, await keyOf(n.ref, "T-shirt"));
    assert.equal((await approve(n.ref, rn.json.id, "none")).status, 200);
    const bn = await doc(n.ref);
    assert.equal(bn.cancel, null); assert.equal(bn.refundLog ?? undefined, undefined); assert.equal(await line(n.ref, "T-shirt"), undefined);
  });
  it("AR10: unpaid booking: approving drops the amount owed 148 -> 140", async () => {
    const { ref } = await mk("ar10", [SHIRT()]);
    assert.equal((await doc(ref)).amount, 148);
    const r = await ask(ref, await keyOf(ref, "T-shirt"));
    assert.equal((await approve(ref, r.json.id)).status, 200);
    assert.equal((await doc(ref)).amount, 140);
  });
});

describe("AD16 / AM03 money: one cancelled day of a daily extra follows the day", () => {
  it("UNPAID booking: cancel D3 -> the owed amount drops by the 3.00 share, the line says x6 with 6 days and 18.00; kit and register drop D3", async () => {
    const { ref, child } = await mk("ad16u", [BOTTLE()]);
    assert.equal((await doc(ref)).amount, 161);
    const c = await operatorAction(ref, "cancel-day", { ki: 0, date: day(3), resolution: "refund" });
    assert.equal(c.status, 200, JSON.stringify(c.json).slice(0, 200));
    const b = await doc(ref);
    assert.equal(b.amount, 158, "owed drops by the day's bottle share");
    const l = await line(ref, "Water bottle");
    assert.equal(l.days.length, 6); assert.equal(l.price, 18); assert.match(l.label, /× 6/);
    assert.ok(!l.days.includes(day(3)));
    assert.ok(b.addons.some((s: string) => /× 6/.test(s) && /£18\.00/.test(s)), `the text line follows: ${JSON.stringify(b.addons)}`);
    assert.equal(await kitHas(3, child), false); assert.equal(await kitHas(2, child), true);
    assert.equal(await regHas(3, ref), false);
  });
  it("PAID booking: cancel D3 -> a pending refund of 20 + 3 = 23 (as before); the line follows the day (x6, 18.00)", async () => {
    const { ref } = await mk("ad16p", [BOTTLE()], { paid: true });
    const c = await operatorAction(ref, "cancel-day", { ki: 0, date: day(3), resolution: "refund" });
    assert.equal(c.status, 200);
    const b = await doc(ref);
    assert.equal(b.cancel?.refund, "pending"); assert.equal(b.cancel?.amount, 23);
    const l = await line(ref, "Water bottle");
    assert.equal(l.days.length, 6); assert.equal(l.price, 18);
  });
  it("AM03 paid: D1 to D3 of 7 cancelled -> 60 for passes + 9 for the bottles = 69 pending, line x4 at 12.00", async () => {
    const { ref } = await mk("am03p", [BOTTLE()], { paid: true });
    for (const n of [1, 2, 3]) assert.equal((await operatorAction(ref, "cancel-day", { ki: 0, date: day(n), resolution: "refund" })).status, 200);
    const b = await doc(ref);
    assert.equal(b.cancel?.amount, 69);
    const l = await line(ref, "Water bottle");
    assert.equal(l.days.length, 4); assert.equal(l.price, 12);
  });
  it("AM03 unpaid: D1 to D3 cancelled -> the owed amount drops by 9 (3 x 3), the line is x4 at 12.00", async () => {
    const { ref } = await mk("am03u", [BOTTLE()]);
    for (const n of [1, 2, 3]) assert.equal((await operatorAction(ref, "cancel-day", { ki: 0, date: day(n), resolution: "refund" })).status, 200);
    const b = await doc(ref);
    assert.equal(b.amount, 152);
    const l = await line(ref, "Water bottle");
    assert.equal(l.days.length, 4); assert.equal(l.price, 12);
  });
});

void ids;
