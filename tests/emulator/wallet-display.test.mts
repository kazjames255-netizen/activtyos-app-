// Wallet display (9 Oct 2026): a booking paid partly with wallet credit carries the server's price / wallet / still-to-pay split (`money`), so no screen
// shows the cash due as "Total" and hides the wallet payment. Staff must NOT gain it. Real API + Firestore emulator (npm run test:emu). Synthetic data.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { adminDb, as, bookWithAddons, bookingAsRole, ids, operatorAction, seedAddons } from "../../scripts/emu/addons-helpers.mts";

const uniq = () => Math.random().toString(36).slice(2, 7);
const walletDoc = async () => (await adminDb()).collection("wallet").doc(`${ids().tenants.P}__parent-a@emu.test`);
const setWallet = async (v: number) => { await (await walletDoc()).set({ balance: v }, { merge: true }); };
before(async () => { await seedAddons({ extraD1: [4, 2] }); });
after(async () => { await setWallet(0); });

async function mk(wallet: number) {
  await setWallet(wallet);
  const b = await bookWithAddons({ parent: "A", listing: "LK", children: [{ name: `wd ${uniq()}`, days: "all", addons: [] }] });
  assert.equal(b.status, 201, JSON.stringify(b.json));
  return b.refs[0] as string;
}
const MONEY_KEYS = /^(money|walletApplied|walletRelieved|gross|due|paidBy)$/;
const keysDeep = (v: unknown): string[] => (Array.isArray(v) ? v.flatMap(keysDeep) : v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => [k, ...keysDeep(x)]) : []);

describe("wallet breakdown on booking responses", () => {
  it("provider booking + list: gross = amount + wallet, due = amount, chip Partially paid", async () => {
    const ref = await mk(100);
    const one = (await bookingAsRole(ref, "P")).json;
    assert.equal(one.walletApplied, 100);
    assert.ok(one.money, "the single booking carries money");
    assert.equal(one.money.walletApplied, 100);
    assert.equal(one.money.gross, Math.round((one.amount + 100) * 100) / 100);
    assert.equal(one.money.due, one.amount);
    assert.equal(one.money.pay, "Partially paid");
    assert.deepEqual(one.money.paidBy, [{ kind: "wallet", amount: 100 }]);
    const row = ((await as("P", "GET", "/api/bookings")).json as { ref: string; money?: { gross: number } }[]).find((b) => b.ref === ref);
    assert.equal(row?.money?.gross, one.money.gross, "the list row agrees with the booking page");
  });
  it("family My bookings carries the same split", async () => {
    const ref = await mk(100);
    const mine = ((await as("A", "GET", "/api/my/bookings")).json as { ref: string; money?: { gross: number; due: number } }[]).find((b) => b.ref === ref);
    const owner = (await bookingAsRole(ref, "P")).json;
    assert.deepEqual(mine?.money, owner.money);
  });
  it("wallet covering the whole price: due 0, Paid, paid in full by wallet", async () => {
    const ref = await mk(100000);
    const one = (await bookingAsRole(ref, "P")).json;
    const m = one.money;
    assert.equal(m.due, 0);
    assert.equal(m.pay ?? one.pay, "Paid", "the chip a screen shows is Paid (stored, or overridden by the split)");
    assert.equal(m.paidInFullByWallet, true);
  });
  it("a booking with no wallet part has no money block (responses unchanged)", async () => {
    const ref = await mk(0);
    const one = (await bookingAsRole(ref, "P")).json;
    assert.equal(one.money, undefined);
  });
  it("staff never receive the wallet fields or the split (list + single)", async () => {
    const ref = await mk(100);
    for (const who of ["S1", "S2"]) {
      const list = ((await as(who, "GET", "/api/bookings")).json as { ref: string }[]).find((b) => b.ref === ref);
      const one = (await as(who, "GET", `/api/bookings/${encodeURIComponent(ref)}`)).json;
      assert.deepEqual(keysDeep(list).filter((k) => MONEY_KEYS.test(k)), [], `${who} list`);
      assert.deepEqual(keysDeep(one).filter((k) => MONEY_KEYS.test(k)), [], `${who} single`);
    }
  });
  it("a payment recorded for the cash part is listed as received, and due drops", async () => {
    const ref = await mk(100);
    const before = (await bookingAsRole(ref, "P")).json;
    assert.equal((await operatorAction(ref, "paid")).status, 200);
    const m = (await bookingAsRole(ref, "P")).json.money;
    assert.equal(m.due, 0);
    assert.equal(m.gross, before.money.gross);
    assert.ok(m.paidBy.some((p: { kind: string }) => p.kind === "cash"));
  });
});
