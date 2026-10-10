// Checkout wallet: credit is spent ONLY when the checkout says so (9 Oct 2026). Real API + Firestore emulator (npm run test:emu). Synthetic data.
//  - omitted walletCap -> credit untouched (no silent auto-apply)      - explicit walletCap 0 -> credit untouched
//  - explicit amount applied exactly once, clamped to the balance and to the booking total
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { adminDb, bookWithAddons, bookingAsRole, ids, seedAddons } from "../../scripts/emu/addons-helpers.mts";

const uniq = () => Math.random().toString(36).slice(2, 7);
const walletDoc = async () => (await adminDb()).collection("wallet").doc(`${ids().tenants.P}__parent-a@emu.test`);
const setWallet = async (v: number) => { await (await walletDoc()).set({ balance: v }, { merge: true }); };
const balance = async () => Number(((await (await walletDoc()).get()).data() as { balance?: number } | undefined)?.balance ?? 0);
const spendRows = async (ref: string) => (await (await adminDb()).collection("walletEntries").where("ref", "==", ref).get()).docs.map((d) => d.data()).filter((e) => Number(e.delta) < 0);
before(async () => { await seedAddons({ extraD1: [4, 2] }); });
after(async () => { await setWallet(0); });

async function book(wallet: number, cap?: number | "omit") {
  await setWallet(wallet);
  const b = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: `wa ${uniq()}`, days: "all", addons: [] }], ...(cap === undefined || cap === "omit" ? {} : { walletCap: cap }) });
  assert.equal(b.status, 201, JSON.stringify(b.json));
  const one = (await bookingAsRole(b.refs[0], "P")).json;
  return { ref: b.refs[0] as string, one, price: Math.round(((one.amount ?? 0) + (one.walletApplied ?? 0)) * 100) / 100 };
}

describe("wallet credit is only spent when the checkout asks for it", () => {
  it("walletCap omitted: wallet untouched, nothing applied", async () => {
    const r = await book(50, "omit");
    assert.equal(r.one.walletApplied ?? 0, 0);
    assert.equal(r.one.amount, r.price);
    assert.equal(await balance(), 50);
    assert.equal((await spendRows(r.ref)).length, 0);
  });
  it("explicit walletCap 0 (Don't use it): wallet untouched", async () => {
    const r = await book(50, 0);
    assert.equal(r.one.walletApplied ?? 0, 0);
    assert.equal(await balance(), 50);
  });
  it("explicit amount is applied exactly once", async () => {
    const r = await book(50, 10);
    assert.equal(r.one.walletApplied, 10);
    assert.equal(r.one.amount, Math.round((r.price - 10) * 100) / 100);
    assert.equal(await balance(), 40);
    assert.equal((await spendRows(r.ref)).length, 1, "one ledger spend row");
  });
  it("amount above the balance is clamped to the balance", async () => {
    const r = await book(7, 500);
    assert.equal(r.one.walletApplied, 7);
    assert.equal(await balance(), 0);
  });
  it("amount above the total is clamped to the total (rest stays in the wallet)", async () => {
    const r = await book(100000, 100000);
    assert.equal(r.one.walletApplied, r.price);
    assert.equal(r.one.amount, 0);
    assert.equal(await balance(), Math.round((100000 - r.price) * 100) / 100);
  });
});
