// Round 3 behaviour tests (npm run test:emu): wallet-funded bookings, a change only touching the remaining days, an empty-days change refused,
// and the provider's refund buttons after an extras refund. Synthetic data, emulator only.
//
// WALLET RULE (how the booking stores it): `amount` is the CASH due, net of the wallet credit spent at checkout (`walletApplied`);
// paid = cash paid + walletApplied. Everything is compared on the GROSS basis: price = amount + walletApplied.
//   new price = price - removed share;  refund = max(0, paid - new price) (minus a refund already pending); the cash due drops by the share.
// A refund the provider approves goes back through the existing refund-approve path, which returns the wallet part to the wallet and the
// cash part to the original method; "wallet credit" at approval credits the whole refund to the wallet.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, bookingAsRole, day, ids, kitDay, operatorAction, seedAddons } from "../../scripts/emu/addons-helpers.mts";

const uniq = () => Math.random().toString(36).slice(2, 7);
const BOTTLE = (c = "Blue") => ({ id: "AW", answers: { Colour: c } });
const SHIRT = (s = "M") => ({ id: "AT", answers: { Size: s } });
const r2 = (n: number) => Math.round(n * 100) / 100;
before(async () => { await seedAddons({ extraD1: [4, 2] }); });
// Wallet credit must not leak into other test files (the checkout spends whatever balance the family has).
after(async () => { await setWallet(0); });

const walletDoc = async () => { const db = await adminDb(); return db.collection("wallet").doc(`${ids().tenants.P}__parent-a@emu.test`); };
const setWallet = async (v: number) => { await (await walletDoc()).set({ balance: v }, { merge: true }); };
const walletBal = async () => r2(((await (await walletDoc()).get()).data()?.balance as number) ?? 0);

async function mk(tag: string, addons: any[], o: { wallet?: number; pay?: number | "full"; listing?: string } = {}) {
  await setWallet(o.wallet ?? 0);
  const child = `${tag} ${uniq()}`;
  const b = await bookWithAddons({ parent: "A", listing: o.listing ?? "LK", children: [{ name: child, days: "all", addons }], walletCap: o.wallet ?? 0 }); // checkout now only spends credit it is told to
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
const cancelD4to7 = async (ref: string) => (await post(ref, { kind: "cancel", targets: [{ key: await keyOf(ref, "Water bottle"), days: [4, 5, 6, 7].map((n) => day(n)) }] })).json;
async function patchDays(ref: string, fn: (d: string[]) => string[]) {
  const db = await adminDb();
  const s = (await db.collection("bookings").where("ref", "==", ref).get()).docs[0];
  const d = s.data() as any;
  await s.ref.update({ days: fn(d.days), addonLines: (d.addonLines ?? []).map((l: any) => ({ ...l, days: l.days?.length ? fn(l.days) : l.days })) });
}

describe("W: wallet credit spent at checkout (amount is net of wallet, paid adds it back)", () => {
  it("W01: wallet 12 + 149 cash paid; cancel 4 bottle days (12): refund exactly 12, cash due 137", async () => {
    const { ref } = await mk("w01", [BOTTLE()], { wallet: 12, pay: "full" });
    const b0 = await doc(ref);
    assert.equal(b0.amount, 149); assert.equal(b0.walletApplied, 12);
    const r = await cancelD4to7(ref);
    assert.equal((await approve(ref, r.id, "refund")).status, 200);
    const b = await doc(ref);
    assert.equal(b.cancel?.amount, 12); assert.equal(b.amount, 137);
  });
  it("W02: wallet 100 spent, 61 cash owed, nothing paid: removing 12 gives nothing back and the cash owed is 49", async () => {
    const { ref } = await mk("w02", [BOTTLE()], { wallet: 100 });
    const b0 = await doc(ref);
    assert.equal(b0.amount, 61); assert.equal(b0.walletApplied, 100);
    const r = await cancelD4to7(ref);
    assert.equal((await approve(ref, r.id, "refund")).status, 200);
    const b = await doc(ref);
    assert.equal(b.amount, 49);
    assert.ok(!(b.cancel?.amount > 0), `no refund: ${JSON.stringify(b.cancel)}`);
    assert.deepEqual(b.refundLog ?? [], []);
    assert.equal(await walletBal(), 0);
  });
  it("W03: wallet 12 + 149 paid; the provider cancels D3: refund 23 (20 + 3), not 33.29", async () => {
    const { ref } = await mk("w03", [BOTTLE()], { wallet: 12, pay: "full" });
    assert.equal((await operatorAction(ref, "cancel-day", { ki: 0, date: day(3), resolution: "refund" })).status, 200);
    const b = await doc(ref);
    assert.equal(b.cancel?.amount, 23); assert.equal(b.amount, 126);
  });
  it("W04: wallet 12 + 149 paid; approve to wallet credit: credit exactly 12", async () => {
    const { ref } = await mk("w04", [BOTTLE()], { wallet: 12, pay: "full" });
    const r = await cancelD4to7(ref);
    assert.equal((await approve(ref, r.id, "wallet")).status, 200);
    const b = await doc(ref);
    const credited = r2((b.refundLog ?? []).filter((x: any) => /wallet/i.test(x.label)).reduce((t: number, x: any) => t + x.amount, 0));
    assert.equal(credited, 12); assert.equal(await walletBal(), 12);
  });
  it("W05: wallet 12 + only 100 cash paid of 149: removing 12 refunds nothing, cash still owed 37", async () => {
    const { ref } = await mk("w05", [BOTTLE()], { wallet: 12, pay: 100 });
    const r = await cancelD4to7(ref);
    assert.equal((await approve(ref, r.id, "refund")).status, 200);
    const b = await doc(ref);
    assert.equal(b.amount, 137); assert.ok(!(b.cancel?.amount > 0), JSON.stringify(b.cancel));
    assert.equal(r2(b.amount - b.amountPaid), 37);
  });
  it("W06: wallet covers everything (161), nothing in cash: removing 12 gives back exactly 12 and cash due stays 0", async () => {
    const { ref } = await mk("w06", [BOTTLE()], { wallet: 500 });
    const b0 = await doc(ref);
    assert.equal(b0.amount, 0); assert.equal(b0.walletApplied, 161);
    const r = await cancelD4to7(ref);
    assert.equal((await approve(ref, r.id, "refund")).status, 200);
    const b = await doc(ref);
    assert.equal(b.cancel?.amount, 12); assert.equal(b.amount, 0);
  });
  it("W07: wallet 12 + paid; request D4-D7 (12) then the provider cancels D5 (20): 32 in all, nothing negative", async () => {
    const { ref } = await mk("w07", [BOTTLE()], { wallet: 12, pay: "full" });
    const r = await cancelD4to7(ref);
    assert.equal((await approve(ref, r.id, "refund")).status, 200);
    assert.equal((await operatorAction(ref, "cancel-day", { ki: 0, date: day(5), resolution: "refund" })).status, 200);
    const b = await doc(ref);
    assert.equal(b.cancel?.amount, 32); assert.equal(b.amount, 117);
    assert.ok(b.amount >= 0 && (await walletBal()) >= 0);
  });
});

describe("C03 / C05: a change only touches the remaining days (past and too-close days keep what was booked)", () => {
  it("C03: first day inside the cut-off: that day stays Blue (x1 3.00), the other six become Red (x6 18.00), total 21", async () => {
    const { ref, child } = await mk("c03", [BOTTLE("Blue")], { listing: "LK_D2" });
    const opt = (await as("A", "GET", `/api/my/bookings/${encodeURIComponent(ref)}/addon-options`)).json.lines[0];
    assert.equal(opt.changeDays?.length, 6, "the family is told which days a change will reach");
    const r = await post(ref, { key: opt.key, kind: "change", answers: { Colour: "Red" } });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal((await approve(ref, r.json.id)).status, 200);
    const b = await doc(ref);
    const lines = (b.addonLines as any[]).map((l) => [l.label, l.price, l.days.length]).sort();
    assert.deepEqual(lines, [["Water bottle × 1 (Colour: Blue)", 3, 1], ["Water bottle × 6 (Colour: Red)", 18, 6]].sort());
    assert.equal(b.amount, 161);
    const k1 = (await kitDay(1, {}, "P")); void k1; void child;
    const k = await as("P", "GET", `/api/kit?date=${day(1, "LK_D2")}`);
    assert.ok((k.json.groups as any[]).some((g) => g.choiceValue === "Blue" && g.children.some((c: any) => c.child === child)));
    const k2 = await as("P", "GET", `/api/kit?date=${day(2, "LK_D2")}`);
    assert.ok((k2.json.groups as any[]).some((g) => g.choiceValue === "Red" && g.children.some((c: any) => c.child === child)));
  });
  it("C05: day 1 has passed: the past day stays Blue (x1), the remaining six become Red (x6)", async () => {
    const { ref } = await mk("c05", [BOTTLE("Blue")]);
    const key = await keyOf(ref, "Water bottle");
    await patchDays(ref, (d) => [new Date(Date.now() - 86400_000).toLocaleDateString("en-CA", { timeZone: "Europe/London" }), ...d.slice(1)]);
    const r = await post(ref, { key, kind: "change", answers: { Colour: "Red" } });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal((await approve(ref, r.json.id)).status, 200);
    const lines = ((await doc(ref)).addonLines as any[]).map((l) => [l.label, l.price, l.days.length]).sort();
    assert.deepEqual(lines, [["Water bottle × 1 (Colour: Blue)", 3, 1], ["Water bottle × 6 (Colour: Red)", 18, 6]].sort());
  });
});

describe("E01b: a change with an empty days list is refused like a cancel", () => {
  it("targets [{key, days: []}] on a change -> 400 with a reason, nothing stored", async () => {
    const { ref } = await mk("e01", [BOTTLE()]);
    const r = await post(ref, { kind: "change", targets: [{ key: await keyOf(ref, "Water bottle"), days: [] }], answers: { Colour: "Red" } });
    assert.equal(r.status, 400, JSON.stringify(r.json));
    assert.ok(r.json?.error);
    assert.equal((await doc(ref)).addonRequests, undefined);
  });
});

describe("B02: the provider's refund buttons after an extras refund", () => {
  it("approving the extras refund leaves a pending refund the provider can approve (recorded, awaiting transfer) or decline without losing the record", async () => {
    const decl = await mk("b02a", [BOTTLE(), SHIRT()], { pay: "full" });
    const kb = await keyOf(decl.ref, "Water bottle"), kt = await keyOf(decl.ref, "T-shirt");
    const rq = await post(decl.ref, { kind: "cancel", targets: [{ key: kb, days: [2, 3].map((n) => day(n)) }, { key: kt }] });
    assert.equal(rq.status, 201, JSON.stringify(rq.json));
    assert.equal((await approve(decl.ref, rq.json.id, "refund")).status, 200);
    const before = await doc(decl.ref);
    assert.equal(before.cancel.amount, 14); assert.equal(before.cancel.refund, "pending");
    const d = await operatorAction(decl.ref, "refund-decline");
    assert.equal(d.status, 200, JSON.stringify(d.json).slice(0, 200));
    const after = await doc(decl.ref);
    assert.equal(after.status, "Confirmed");
    assert.equal(after.cancel.refund, "declined"); assert.equal(after.cancel.amount, 14, "the money record is kept");
    assert.equal(after.amount, before.amount); assert.equal(after.addonLines.length, before.addonLines.length);
    assert.equal(after.pay, "Paid");
    // and a bank-transfer booking approved instead is RECORDED and waits for the provider's transfer
    const ok = await mk("b02b", [BOTTLE(), SHIRT()], { pay: "full" });
    const rq2 = await post(ok.ref, { kind: "cancel", targets: [{ key: await keyOf(ok.ref, "Water bottle"), days: [2, 3].map((n) => day(n)) }, { key: await keyOf(ok.ref, "T-shirt") }] });
    assert.equal((await approve(ok.ref, rq2.json.id, "refund")).status, 200);
    const ra = await operatorAction(ok.ref, "refund-approve");
    assert.equal(ra.status, 200, JSON.stringify(ra.json).slice(0, 200));
    const recorded = await doc(ok.ref);
    assert.equal(recorded.cancel.refundTransfer, "awaiting"); assert.equal(recorded.cancel.refundVia, "offline");
    assert.equal(recorded.cancel.amount, 14); assert.equal(recorded.status, "Confirmed");
  });
});
