// Wallet refund-back (9 Oct 2026) for an approved request to cancel EXTRAS and for the family's view: a booking paid partly with wallet credit that has an
// extra refunded splits that refund PROPORTIONALLY - the wallet's share goes back to the wallet (once), the rest to the original method / awaiting transfer.
// Real API + Firestore emulator (npm run test:emu). Synthetic data.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, bookingAsRole, day, ids, operatorAction, seedAddons } from "../../scripts/emu/addons-helpers.mts";
import { refundTransferAmount } from "../../features/bookings/helpers";
import { walletShareOfRefund } from "../../features/bookings/refundSplit";

const uniq = () => Math.random().toString(36).slice(2, 7);
const r2 = (n: number) => Math.round(n * 100) / 100;
before(async () => { await seedAddons({ extraD1: [4, 2] }); });
after(async () => { await setWallet(0); });

const walletDoc = async () => { const db = await adminDb(); return db.collection("wallet").doc(`${ids().tenants.P}__parent-a@emu.test`); };
const setWallet = async (v: number) => { await (await walletDoc()).set({ balance: v }, { merge: true }); };
const walletBal = async () => r2(((await (await walletDoc()).get()).data()?.balance as number) ?? 0);
const credited = async (ref: string) => {
  const db = await adminDb();
  const s = await db.collection("walletEntries").where("tenantId", "==", ids().tenants.P).where("ref", "==", ref).get();
  const pos = s.docs.filter((d) => Number(d.get("delta")) > 0);
  return { total: r2(pos.reduce((n, d) => n + Number(d.get("delta")), 0)), rows: pos.length };
};
const doc = async (ref: string) => (await bookingAsRole(ref, "P")).json;
const keyOf = async (ref: string, name: string) => (await as("A", "GET", `/api/my/bookings/${encodeURIComponent(ref)}/addon-options`)).json.lines.find((x: any) => x.name === name).key as string;
const post = (ref: string, body: unknown) => as("A", "POST", `/api/my/bookings/${encodeURIComponent(ref)}/addon-requests`, body);

async function mk(wallet: number) {
  await setWallet(wallet);
  const b = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: `wrx ${uniq()}`, days: "all", addons: [{ id: "AW", answers: { Colour: "Blue" } }] }] });
  assert.equal(b.status, 201, JSON.stringify(b.json));
  const ref = b.refs[0] as string;
  assert.equal((await operatorAction(ref, "paid")).status, 200);
  return ref;
}

describe("approving a request to cancel extras with a refund", () => {
  it("wallet 40 + cash paid: the 12 refund splits by what each paid; the wallet's share is credited once; only the cash part is awaiting transfer", async () => {
    const ref = await mk(40);
    const b0 = await doc(ref);
    const gross = r2(b0.amount + b0.walletApplied);
    assert.equal(b0.walletApplied, 40);
    const key = await keyOf(ref, "Water bottle");
    const r = await post(ref, { kind: "cancel", targets: [{ key, days: [4, 5, 6, 7].map((n) => day(n)) }] });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal((await operatorAction(ref, "addon-approve", { requestId: r.json.id, resolution: "refund" })).status, 200);
    const pend = (await doc(ref)).cancel.amount as number;
    assert.equal(pend, 12);
    // The family sees how much of it the wallet will get back, from the server's own figure.
    const mine = ((await as("A", "GET", "/api/my/bookings")).json as any[]).find((x) => x.ref === ref);
    assert.ok(mine.money.walletBack > 0, JSON.stringify(mine.money));
    const expectWallet = walletShareOfRefund(pend, mine.money.walletBack, r2(gross));
    // 15 parallel approvals: the credit lands exactly once.
    const rs = await Promise.all(Array.from({ length: 15 }, () => operatorAction(ref, "refund-approve")));
    assert.ok(rs.some((x) => x.status === 200), JSON.stringify(rs.map((x) => x.status)));
    const b = await doc(ref);
    const got = await credited(ref);
    assert.equal(got.rows, 1);
    assert.equal(got.total, expectWallet, "wallet share == the proportional share from the family's figure");
    assert.equal(got.total, r2(pend * 40 / gross));
    assert.equal(r2(refundTransferAmount(b) + got.total), pend);
    assert.equal(await walletBal(), got.total);
    assert.equal(b.refundEntries === undefined ? 0 : b.refundEntries.filter((e: any) => e.via === "wallet").length, 1, "provider view carries one wallet entry");
  });

  it("extras refund resolved as WALLET credit: the whole 12 is wallet credit", async () => {
    const ref = await mk(40);
    const key = await keyOf(ref, "Water bottle");
    const r = await post(ref, { kind: "cancel", targets: [{ key, days: [4, 5, 6, 7].map((n) => day(n)) }] });
    assert.equal((await operatorAction(ref, "addon-approve", { requestId: r.json.id, resolution: "wallet" })).status, 200);
    assert.deepEqual(await credited(ref), { total: 12, rows: 1 });
  });
});

describe("staff and family views", () => {
  it("the family's money block carries walletBack, never the provider's walletRefunded / refundEntries; staff see none of it", async () => {
    const ref = await mk(40);
    const mine = ((await as("A", "GET", "/api/my/bookings")).json as any[]).find((x) => x.ref === ref);
    assert.equal(mine.money.walletBack, 40);
    assert.equal(mine.walletRefunded, undefined); assert.equal(mine.refundEntries, undefined);
    const staff = (await as("S1", "GET", `/api/bookings/${encodeURIComponent(ref)}`)).json;
    assert.equal(JSON.stringify(staff).includes("walletBack"), false);
    assert.equal(staff.money, undefined);
  });
});
