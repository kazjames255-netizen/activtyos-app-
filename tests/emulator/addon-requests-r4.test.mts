// Round 4 behaviour tests (npm run test:emu): the "awaiting transfer" figure with two extras refunds, the refund state table (pending -> approved
// -> sent, pending -> declined, nothing else) on the extras refund and the whole-booking refund, and a family release of days never giving back
// more than was paid. Synthetic data, emulator only.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, bookingAsRole, day, ids, operatorAction, seedAddons } from "../../scripts/emu/addons-helpers.mts";
import { refundTransferAmount } from "../../features/bookings/helpers";

const uniq = () => Math.random().toString(36).slice(2, 7);
const BOTTLE = (c = "Blue") => ({ id: "AW", answers: { Colour: c } });
const SHIRT = (s = "M") => ({ id: "AT", answers: { Size: s } });
const r2 = (n: number) => Math.round(n * 100) / 100;
const walletRef = async () => (await adminDb()).collection("wallet").doc(`${ids().tenants.P}__parent-a@emu.test`);
before(async () => { await seedAddons({ extraD1: [4, 2] }); await (await walletRef()).set({ balance: 0 }, { merge: true }); });
after(async () => { await (await walletRef()).set({ balance: 0 }, { merge: true }); });

async function mk(tag: string, addons: any[]) {
  await (await walletRef()).set({ balance: 0 }, { merge: true });
  const b = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: `${tag} ${uniq()}`, days: "all", addons }] });
  assert.equal(b.status, 201, JSON.stringify(b.json));
  assert.equal((await operatorAction(b.refs[0], "paid")).status, 200);
  return b.refs[0] as string;
}
const doc = async (ref: string) => (await bookingAsRole(ref, "P")).json;
const keyOf = async (ref: string, name: string) => (await as("A", "GET", `/api/my/bookings/${encodeURIComponent(ref)}/addon-options`)).json.lines.find((x: any) => x.name === name).key as string;
const cancelDays = async (ref: string, name: string, nums: number[]) => (await as("A", "POST", `/api/my/bookings/${encodeURIComponent(ref)}/addon-requests`, { kind: "cancel", targets: [{ key: await keyOf(ref, name), days: nums.map((n) => day(n)) }] })).json;
const approveReq = (ref: string, id: string, resolution = "refund") => operatorAction(ref, "addon-approve", { requestId: id, resolution });
const act = async (ref: string, type: string, extra: Record<string, unknown> = {}) => (await operatorAction(ref, type, extra)).status;

describe("the awaiting-transfer figure counts only what is not yet sent", () => {
  it("two extras refunds: the first approved and sent, the second approved only -> 6 awaiting, not 18", async () => {
    const ref = await mk("fin", [BOTTLE()]);
    const a = await cancelDays(ref, "Water bottle", [4, 5, 6, 7]);
    assert.equal((await approveReq(ref, a.id)).status, 200);
    assert.equal(await act(ref, "refund-approve"), 200);
    assert.equal(await act(ref, "refund-sent"), 200);
    const b = await cancelDays(ref, "Water bottle", [2, 3]);
    assert.equal((await approveReq(ref, b.id)).status, 200);
    assert.equal(await act(ref, "refund-approve"), 200);
    const d = await doc(ref);
    assert.equal(d.cancel.refundTransfer, "awaiting");
    assert.equal(refundTransferAmount(d), 6);
    assert.equal(await act(ref, "refund-sent"), 200);
    assert.equal(refundTransferAmount(await doc(ref)), 6, "the 'has been sent' wording still names this refund's amount");
  });
});

describe("refund state table: pending -> approved -> sent, pending -> declined, nothing else (extras refund and booking refund)", () => {
  async function extrasRefund(tag: string) {
    const ref = await mk(tag, [BOTTLE()]);
    const r = await cancelDays(ref, "Water bottle", [5, 6, 7]);
    assert.equal((await approveReq(ref, r.id)).status, 200);
    assert.equal((await doc(ref)).cancel.refund, "pending");
    return ref;
  }
  async function bookingRefund(tag: string) {
    const ref = await mk(tag, [BOTTLE()]);
    assert.equal((await operatorAction(ref, "cancel", { refund: "full" })).status, 200);
    return ref;
  }
  for (const [name, make] of [["extras refund", extrasRefund], ["booking refund", bookingRefund]] as const) {
    it(`${name}: pending -> declined; then decline, approve and sent are all 409`, async () => {
      const ref = await make(`d-${name.slice(0, 3)}`);
      assert.equal(await act(ref, "refund-decline"), 200);
      assert.equal(await act(ref, "refund-decline"), 409);
      assert.equal(await act(ref, "refund-approve"), 409);
      assert.equal(await act(ref, "refund-sent"), 409);
      assert.equal((await doc(ref)).cancel.refund, "declined");
    });
    it(`${name}: pending -> approved -> sent; every other move is 409`, async () => {
      const ref = await make(`a-${name.slice(0, 3)}`);
      assert.equal(await act(ref, "refund-approve"), 200);
      assert.equal(await act(ref, "refund-approve"), 409);
      assert.equal(await act(ref, "refund-decline"), 409, "an approved (recorded) refund cannot be declined");
      assert.equal((await doc(ref)).cancel.refund, "approved");
      assert.equal(await act(ref, "refund-sent"), 200);
      assert.equal(await act(ref, "refund-sent"), 409);
      assert.equal(await act(ref, "refund-decline"), 409);
      assert.equal(await act(ref, "refund-approve"), 409);
      assert.equal((await doc(ref)).cancel.refund, "approved");
    });
    it(`${name}: approved as already sent -> sent, approve and decline are 409`, async () => {
      const ref = await make(`s-${name.slice(0, 3)}`);
      assert.equal(await act(ref, "refund-approve", { alreadySent: true }), 200);
      assert.equal(await act(ref, "refund-sent"), 409);
      assert.equal(await act(ref, "refund-decline"), 409);
      assert.equal(await act(ref, "refund-approve"), 409);
    });
  }
  it("a refund given to the wallet cannot be declined afterwards (the credit would stay)", async () => {
    const ref = await mk("wal", [BOTTLE()]);
    const r = await cancelDays(ref, "Water bottle", [5, 6, 7]);
    assert.equal((await approveReq(ref, r.id, "wallet")).status, 200);
    assert.equal(await act(ref, "refund-decline"), 409);
    assert.equal(await act(ref, "refund-approve"), 409);
  });
  it("nothing to decline: a booking with no refund record, and a cancellation that gives nothing back, are 409", async () => {
    const ref = await mk("none", [BOTTLE()]);
    assert.equal(await act(ref, "refund-decline"), 409);
    assert.equal(await act(ref, "refund-sent"), 409);
    assert.equal(await act(ref, "refund-approve"), 409);
    assert.equal((await operatorAction(ref, "cancel", { refund: "none" })).status, 200);
    assert.equal(await act(ref, "refund-decline"), 409);
  });
});

describe("a family releasing days never gets back more than was paid", () => {
  it("paid 169; extras (29) refunded pending, then 6 days released to the wallet: pending + credit <= 169", async () => {
    const ref = await mk("over", [BOTTLE(), SHIRT()]);
    const rq = await as("A", "POST", `/api/my/bookings/${encodeURIComponent(ref)}/addon-requests`, { kind: "cancel", targets: [{ key: await keyOf(ref, "Water bottle") }, { key: await keyOf(ref, "T-shirt") }] });
    assert.equal(rq.status, 201, JSON.stringify(rq.json));
    assert.equal((await approveReq(ref, rq.json.id)).status, 200);
    assert.equal((await doc(ref)).cancel.amount, 29);
    const rel = await as("A", "POST", `/api/my/bookings/${encodeURIComponent(ref)}/cancel`, { days: [2, 3, 4, 5, 6, 7].map((n) => day(n)), resolution: "wallet" });
    assert.equal(rel.status, 200, JSON.stringify(rel.json).slice(0, 200));
    const d = await doc(ref);
    const credited = r2((d.refundLog ?? []).filter((x: any) => /wallet/i.test(x.label)).reduce((t: number, x: any) => t + x.amount, 0));
    const pending = d.cancel?.refund === "pending" ? d.cancel.amount : 0;
    assert.ok(r2(credited + pending) <= 169.0001, `credit ${credited} + pending ${pending} must not exceed what was paid (169)`);
  });
});
