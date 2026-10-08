// Round 5 behaviour tests (npm run test:emu): every approved refund is its own entry, so a refund approved but not yet sent can never drop out of
// "awaiting transfer" / "Refunds to send" when a second refund is requested or approved on the same booking. Synthetic data, emulator only.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, bookingAsRole, day, ids, operatorAction, seedAddons } from "../../scripts/emu/addons-helpers.mts";
import { refundAwaitingTransfer, refundTransferAmount } from "../../features/bookings/helpers";
import { refundTransferReminders } from "../../server/src/lib/sweeps";

const uniq = () => Math.random().toString(36).slice(2, 7);
const walletRef = async () => (await adminDb()).collection("wallet").doc(`${ids().tenants.P}__parent-a@emu.test`);
before(async () => { await seedAddons({ extraD1: [4, 2] }); await (await walletRef()).set({ balance: 0 }, { merge: true }); });
after(async () => { await (await walletRef()).set({ balance: 0 }, { merge: true }); });

async function mk(tag: string) {
  await (await walletRef()).set({ balance: 0 }, { merge: true });
  const b = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: `${tag} ${uniq()}`, days: "all", addons: [{ id: "AW", answers: { Colour: "Blue" } }] }] });
  assert.equal(b.status, 201, JSON.stringify(b.json));
  assert.equal((await operatorAction(b.refs[0], "paid")).status, 200);
  return b.refs[0] as string;
}
const doc = async (ref: string) => (await bookingAsRole(ref, "P")).json;
const keyOf = async (ref: string) => (await as("A", "GET", `/api/my/bookings/${encodeURIComponent(ref)}/addon-options`)).json.lines.find((x: any) => x.name === "Water bottle").key as string;
/** Ask to cancel these days of the bottle (one 3.00 share each) and have the provider approve it with the given money choice. */
async function removeDays(ref: string, nums: number[], resolution = "refund") {
  const r = await as("A", "POST", `/api/my/bookings/${encodeURIComponent(ref)}/addon-requests`, { kind: "cancel", targets: [{ key: await keyOf(ref), days: nums.map((n) => day(n)) }] });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.equal((await operatorAction(ref, "addon-approve", { requestId: r.json.id, resolution })).status, 200);
}
const act = async (ref: string, type: string, extra: Record<string, unknown> = {}) => (await operatorAction(ref, type, extra)).status;
const owedToSend = async (ref: string) => { const d = await doc(ref); return [refundAwaitingTransfer(d), refundTransferAmount(d)] as const; };

describe("every approved refund is its own entry: what is still owed to send cannot be overwritten", () => {
  it("3 approved but unsent, then a second of 6 approved: 9 to send", async () => {
    const ref = await mk("r5a");
    await removeDays(ref, [7]); assert.equal(await act(ref, "refund-approve"), 200);
    assert.deepEqual(await owedToSend(ref), [true, 3]);
    await removeDays(ref, [5, 6]); assert.equal(await act(ref, "refund-approve"), 200);
    assert.deepEqual(await owedToSend(ref), [true, 9]);
  });
  it("3 approved but unsent, then a second only requested (pending): still 3 to send", async () => {
    const ref = await mk("r5b");
    await removeDays(ref, [7]); assert.equal(await act(ref, "refund-approve"), 200);
    await removeDays(ref, [5, 6]);
    const d = await doc(ref);
    assert.equal(d.cancel.refund, "pending");
    assert.deepEqual(await owedToSend(ref), [true, 3]);
  });
  it("first sent, then second approved: 6; marking sent clears everything and the 'sent' wording names 6", async () => {
    const ref = await mk("r5c");
    await removeDays(ref, [7]); assert.equal(await act(ref, "refund-approve"), 200); assert.equal(await act(ref, "refund-sent"), 200);
    assert.deepEqual(await owedToSend(ref), [false, 3], "just sent: nothing awaiting, the last confirmation named 3");
    await removeDays(ref, [5, 6]); assert.equal(await act(ref, "refund-approve"), 200);
    assert.deepEqual(await owedToSend(ref), [true, 6]);
    assert.equal(await act(ref, "refund-sent"), 200);
    const d = await doc(ref);
    assert.equal(refundAwaitingTransfer(d), false); assert.equal(d.lastRefundSent.amount, 6);
    assert.equal(await act(ref, "refund-sent"), 409);
  });
  it("two sent: nothing to send", async () => {
    const ref = await mk("r5d");
    await removeDays(ref, [7]); await act(ref, "refund-approve"); await act(ref, "refund-sent");
    await removeDays(ref, [6]); await act(ref, "refund-approve", { alreadySent: true });
    assert.equal((await owedToSend(ref))[0], false);
    assert.equal(await act(ref, "refund-sent"), 409);
  });
  it("mixed methods: an unsent bank refund (3), then a wallet credit (3) and an already-sent refund (3): still 3 to send", async () => {
    const ref = await mk("r5e");
    await removeDays(ref, [7]); assert.equal(await act(ref, "refund-approve"), 200);
    await removeDays(ref, [6], "wallet");
    await removeDays(ref, [5]); assert.equal(await act(ref, "refund-approve", { alreadySent: true }), 200);
    assert.deepEqual(await owedToSend(ref), [true, 3]);
  });
  it("declining one entry only: the second (pending) is declined, the first stays owed and cannot be declined", async () => {
    const ref = await mk("r5f");
    await removeDays(ref, [7]); assert.equal(await act(ref, "refund-approve"), 200);
    await removeDays(ref, [5, 6]);
    assert.equal(await act(ref, "refund-decline"), 200);
    assert.deepEqual(await owedToSend(ref), [true, 3]);
    assert.equal(await act(ref, "refund-decline"), 409);
    assert.equal(await act(ref, "refund-approve"), 409);
    assert.equal(await act(ref, "refund-sent"), 200);
    assert.equal((await owedToSend(ref))[0], false);
  });
  it("one reminder bell per booking (not one per refund), naming the total", async () => {
    const ref = await mk("r5g");
    await removeDays(ref, [7]); await act(ref, "refund-approve");
    await removeDays(ref, [5, 6]); await act(ref, "refund-approve");
    const db = await adminDb();
    const rows = (await db.collection("payments").where("refs", "array-contains", ref).get()).docs.filter((d) => d.get("status") === "to-reimburse");
    assert.equal(rows.length, 2, "one ledger row per approved refund");
    const old = new Date(Date.now() - 4 * 86400_000).toISOString();
    for (const r of rows) await r.ref.update({ createdAt: old });
    await refundTransferReminders();
    const bells = ((await as("P", "GET", "/api/notifications")).json?.notifications ?? []).filter((n: any) => String(n.title).includes(ref) && /refund to send/i.test(String(n.title)));
    assert.equal(bells.length, 1, JSON.stringify(bells.map((n: any) => [n.title, n.body])));
    assert.match(String(bells[0].body), /9\.00/);
  });
});
