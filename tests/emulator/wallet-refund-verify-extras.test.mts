// Wallet refund-back (9 Oct 2026) for an approved request to cancel EXTRAS and for the family's view: a booking paid partly with wallet credit that has an
// extra refunded splits that refund PROPORTIONALLY - the wallet's share goes back to the wallet (once), the rest to the original method / awaiting transfer.
// Real API + Firestore emulator (npm run test:emu). Synthetic data.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, bookingAsRole, day, ids, operatorAction, seedAddons } from "../../scripts/emu/addons-helpers.mts";
import { refundTransferAmount } from "../../features/bookings/helpers";
import { appendFileSync } from "node:fs";

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

describe("V12 extras cancel approval", () => {
  it("wallet 25 + cash: 12 extras refund -> wallet round(12*25/gross,2) once, rest awaiting", async () => {
    const ref = await mk(25);
    const b0 = await doc(ref); const gross = r2(b0.amount + b0.walletApplied);
    const key = await keyOf(ref, "Water bottle");
    const r = await post(ref, { kind: "cancel", targets: [{ key, days: [4, 5, 6, 7].map((n) => day(n)) }] });
    assert.equal((await operatorAction(ref, "addon-approve", { requestId: r.json.id, resolution: "refund" })).status, 200);
    const pend = (await doc(ref)).cancel.amount as number;
    const rs = await Promise.all(Array.from({ length: 15 }, () => operatorAction(ref, "refund-approve")));
    await new Promise((x) => setTimeout(x, 600));
    const b = await doc(ref); const got = await credited(ref);
    const expW = r2(pend * 25 / gross);
    const fails: string[] = [];
    if (got.rows !== 1) fails.push(`rows ${got.rows}`);
    if (got.total !== expW) fails.push(`wallet ${got.total} expected ${expW}`);
    if (r2(refundTransferAmount(b) + got.total) !== pend) fails.push(`sum ${refundTransferAmount(b)}+${got.total} != ${pend}`);
    appendFileSync((process.env.VOUT ?? "/dev/null"), JSON.stringify({ case: "V12", expected: `pend 12 (hand: 4 days x 3 extras); wallet = 12*25/gross, once, rest awaiting`, observed: JSON.stringify({ gross, pend, got, expW, transfer: refundTransferAmount(b), statuses: rs.map((x) => x.status).join(",") }), fails, result: fails.length ? "FAIL" : "PASS-EXECUTED" }) + "\n");
    assert.deepEqual(fails, []);
  });
});
