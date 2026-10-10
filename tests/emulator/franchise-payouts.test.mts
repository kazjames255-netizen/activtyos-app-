// Franchise payouts through the REAL API + Firestore emulator (npm run test:emu). Synthetic data only.
//
// Fixture, worked out by hand BEFORE the code (rate 10% for franchise A and B; everything made in September 2026):
//   Franchise A:  a1 card 500 | a2 card 500 less a 100 refund = 400 | a3 cash 200 | a4 UNPAID 80 (not counted) | a5 pending approval 60 (not counted)
//                 a6 card 100 made 23:30 UTC on 30 Sep = 00:30 BST on 1 Oct (an OCTOBER booking)
//     September: card 900, direct 200 -> head office keeps 90, franchise gets 810, head office's share of direct 20, NET head office pays 790.
//     All time: card 1000, direct 200, royalty 90 + 10 + 20 = 120.
//   Franchise B:  b1 card 100 | b2 card 40 with NO franchise stamp, made on a listing B owns (attribution by listing)
//     September: card 140 -> keeps 14, gets 126, NET head office pays 126.   Royalty 14.
//   Head office's own booking: h1 card 50 (owes nothing).
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { call, db, login, makeProvider, ok, sleep, uniq, type Provider } from "./helpers.mts";
import { clearKitCache } from "../../server/src/lib/kitCache";
import { loadLite } from "../../server/src/lib/franchisePayoutsData";

let P: Provider;
let FA: { token: string }, FB: { token: string }, STAFF_A: { token: string }, PLATFORM: { token: string }, PARENT: { token: string };
const A = `frA-${uniq()}`, B = `frB-${uniq()}`;
const SEP = "month=2026-09";
const SEP_FROM = "2026-09-01", SEP_TO = "2026-09-30";

const book = async (id: string, o: Record<string, unknown>) => {
  await db.collection("bookings").doc(`${P.tenantId}-${id}`).set({
    ref: id, bid: id, tenantId: P.tenantId, status: "Confirmed", pay: "Paid", method: "Card", amount: 0, kids: [], addons: [], answers: [], child: "c", booker: "b", email: "b@emu.test", ...o,
  });
};
const card = (id: string, amount: number, createdAt: string, o: Record<string, unknown> = {}) => book(id, { amount, amountPaid: amount, paymentIntentId: `pi_${id}`, createdAt, ...o });

before(async () => {
  P = await makeProvider("fpay");
  await db.collection("listings").doc(`${P.tenantId}-LB`).set({ tenantId: P.tenantId, franchiseId: B, title: "B's camp" });
  const mk = async (tag: string, doc: Record<string, unknown>) => {
    const email = `${tag}-${uniq()}@emu.test`;
    const s = await login(email);
    await db.collection("users").doc(s.uid).set({ email, tenantId: P.tenantId, ...doc });
    return { token: s.token };
  };
  FA = await mk("fa", { role: "franchise", franchiseId: A, franchiseName: "Alpha Camps", name: "Alpha Owner" });
  FB = await mk("fb", { role: "franchise", franchiseId: B, franchiseName: "Bravo Camps", name: "Bravo Owner" });
  STAFF_A = await mk("sa", { role: "staff", franchiseId: A });
  PLATFORM = await mk("pl", { role: "platform", tenantId: null, twoFaVerifiedAt: Date.now() });
  PARENT = await mk("pa", { role: "parent" });

  await card("a1", 500, "2026-09-05T10:00:00Z", { franchiseId: A });
  await card("a2", 500, "2026-09-06T10:00:00Z", { franchiseId: A, pay: "Partially refunded", refundLog: [{ label: "Refunded a day", amount: 100, on: "x", by: "x" }] });
  await book("a3", { franchiseId: A, amount: 200, amountPaid: 200, method: "Cash on the day", createdAt: "2026-09-07T10:00:00Z" });
  await book("a4", { franchiseId: A, amount: 80, amountPaid: 0, pay: "Unpaid", createdAt: "2026-09-08T10:00:00Z" });
  await book("a5", { franchiseId: A, amount: 60, amountPaid: 60, status: "Approval needed", paymentIntentId: "pi_a5", createdAt: "2026-09-09T10:00:00Z" });
  await card("a6", 100, "2026-09-30T23:30:00Z", { franchiseId: A });
  await card("b1", 100, "2026-09-10T10:00:00Z", { franchiseId: B });
  await card("b2", 40, "2026-09-11T10:00:00Z", { listingId: `${P.tenantId}-LB` });
  await card("h1", 50, "2026-09-12T10:00:00Z");
});

const payouts = (token: string, q = SEP, extra = "") => call("GET", `/api/splitfees/payouts?${q}${extra}`, token);
const rowOf = (j: any, fid: string) => (j.rows as any[]).find((r) => r.franchiseId === fid);

describe("Franchise payouts: head office view", () => {
  it("September: A keeps 90 / gets 810 / direct 20 / HO pays 790; B card 140 keeps 14 gets 126; unpaid, pending and the 1 Oct booking excluded", async () => {
    const r = await payouts(P.token);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const a = rowOf(r.json, A), b = rowOf(r.json, B);
    assert.deepEqual([a.card, a.direct, a.hoKeepsCard, a.franchiseCard, a.hoShareDirect, a.net, a.bookings, a.name], [900, 200, 90, 810, 20, 790, 3, "Alpha Camps"]);
    assert.deepEqual([b.card, b.direct, b.hoKeepsCard, b.franchiseCard, b.net, b.bookings], [140, 0, 14, 126, 126, 2]);
    assert.equal(r.json.direct.total, 50);
    assert.match(r.json.basis, /booking was made/i);
    assert.match(r.json.basis, /fee is not deducted/i);
  });
  it("October (the 00:30 BST booking) is only franchise A's 100 card -> keeps 10, gets 90", async () => {
    const r = await payouts(P.token, "month=2026-10");
    const a = rowOf(r.json, A);
    assert.deepEqual([a.card, a.hoKeepsCard, a.franchiseCard, a.bookings], [100, 10, 90, 1]);
  });
  it("a custom UK window works and the default is this month", async () => {
    const r = await payouts(P.token, `from=2026-09-05&to=2026-09-06`);
    assert.deepEqual([rowOf(r.json, A).card, rowOf(r.json, A).bookings], [900, 2]);
    const def = await call("GET", "/api/splitfees/payouts", P.token);
    assert.equal(def.json.range.period, "month");
    assert.match(def.json.range.from, /-01$/);
  });
});

describe("The three reports agree", () => {
  it("Split fees (September + all time), the franchise's own Royalties and the head office overview give identical royalty and money", async () => {
    const sep = (await call("GET", `/api/splitfees?from=${SEP_FROM}&to=${SEP_TO}`, P.token)).json;
    const sa = sep.franchises.find((f: any) => f.franchiseId === A), sb = sep.franchises.find((f: any) => f.franchiseId === B);
    assert.deepEqual([sa.fee, sa.revenue, sa.count], [110, 1100, 3]); // 90 + 20 on 900 card + 200 direct
    assert.deepEqual([sb.fee, sb.revenue], [14, 140]);
    const pay = (await payouts(P.token)).json;
    assert.equal(rowOf(pay, A).royalty, sa.fee);
    assert.equal(rowOf(pay, B).royalty, sb.fee);

    const all = (await call("GET", "/api/splitfees", P.token)).json;
    const ho = (await call("GET", "/api/ho/overview", P.token)).json;
    for (const fid of [A, B]) {
      const s = all.franchises.find((f: any) => f.franchiseId === fid), o = ho.franchises.find((f: any) => f.franchiseId === fid);
      assert.equal(o.royalty, s.fee, `royalty ${fid}`);
      assert.equal(o.revenue, s.revenue, `revenue ${fid}`);
      assert.equal(o.bookings, s.count, `bookings ${fid}`);
    }
    assert.equal(all.franchises.find((f: any) => f.franchiseId === A).fee, 120);
    assert.equal(ho.network.royalty, all.totals.fee);
    assert.equal(ho.direct.revenue, all.direct.revenue);

    const mineA = (await call("GET", `/api/splitfees/mine?from=${SEP_FROM}&to=${SEP_TO}`, FA.token)).json;
    assert.deepEqual([mineA.fee, mineA.revenue, mineA.count], [sa.fee, sa.revenue, sa.count]);
    const mineB = (await call("GET", `/api/splitfees/mine?from=${SEP_FROM}&to=${SEP_TO}`, FB.token)).json;
    assert.deepEqual([mineB.fee, mineB.revenue], [sb.fee, sb.revenue]); // B's listing-owned booking counts for B on BOTH screens
  });
});

describe("Franchise payouts: who may see what", () => {
  it("a franchise sees ONLY its own statement", async () => {
    const r = await call("GET", `/api/splitfees/payouts/mine?${SEP}`, FA.token);
    assert.equal(r.status, 200);
    assert.equal(r.json.row.franchiseId, A);
    assert.equal(r.json.row.net, 790);
    assert.equal(r.json.rows, undefined);
    assert.ok(!JSON.stringify(r.json).includes(B), "no other franchise id anywhere");
    assert.ok(!JSON.stringify(r.json).includes("Bravo"));
    const b = await call("GET", `/api/splitfees/payouts/mine?${SEP}`, FB.token);
    assert.equal(b.json.row.franchiseId, B);
    assert.equal(b.json.row.net, 126);
  });
  it("a franchise cannot open the head office table, a settlement or another franchise's data", async () => {
    assert.equal((await payouts(FA.token)).status, 403);
    assert.equal((await call("POST", "/api/splitfees/payouts/settle", FA.token, { franchiseId: A, from: SEP_FROM, to: SEP_TO })).status, 403);
    assert.equal((await call("POST", "/api/splitfees/payouts/settle", FA.token, { franchiseId: B, from: SEP_FROM, to: SEP_TO })).status, 403);
    assert.equal((await call("PUT", "/api/splitfees/settings", FA.token, { basis: "revenue", rate: 1 })).status, 403);
    // asking for B's figures with A's login still returns A's
    const r = await call("GET", `/api/splitfees/payouts/mine?${SEP}&franchiseId=${B}`, FA.token);
    assert.equal(r.json.row.franchiseId, A);
  });
  it("franchise staff see no money (403 everywhere)", async () => {
    assert.equal((await call("GET", `/api/splitfees/payouts/mine?${SEP}`, STAFF_A.token)).status, 403);
    assert.equal((await payouts(STAFF_A.token)).status, 403);
    assert.equal((await call("GET", "/api/splitfees/mine", STAFF_A.token)).status, 403);
  });
  it("a parent sees nothing", async () => {
    assert.equal((await payouts(PARENT.token)).status, 403);
    assert.equal((await call("GET", `/api/splitfees/payouts/mine?${SEP}`, PARENT.token)).status, 403);
  });
  it("HQ platform can READ a tenant's payouts but never settle or change a rate", async () => {
    const r = await call("GET", `/api/splitfees/payouts?${SEP}&tenantId=${P.tenantId}`, PLATFORM.token);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(rowOf(r.json, A).net, 790);
    assert.equal(r.json.canSettle, false);
    assert.equal((await call("POST", "/api/splitfees/payouts/settle", PLATFORM.token, { franchiseId: A, from: SEP_FROM, to: SEP_TO })).status, 403);
    assert.equal((await call("PUT", "/api/splitfees/settings", PLATFORM.token, { basis: "revenue", rate: 1 })).status, 403);
  });
});

describe("Mark settled", () => {
  it("rejects a period that has not finished, an unknown franchise, junk dates", async () => {
    assert.equal((await call("POST", "/api/splitfees/payouts/settle", P.token, { franchiseId: A, from: "2026-10-01", to: "2099-01-31" })).status, 400);
    assert.equal((await call("POST", "/api/splitfees/payouts/settle", P.token, { franchiseId: "nope", from: SEP_FROM, to: SEP_TO })).status, 404);
    assert.equal((await call("POST", "/api/splitfees/payouts/settle", P.token, { franchiseId: A, from: "2026-13-45", to: SEP_TO })).status, 400);
  });
  it("15 parallel clicks make exactly ONE record; the rest return it unchanged", async () => {
    const body = { franchiseId: A, from: SEP_FROM, to: SEP_TO };
    const rs = await Promise.all(Array.from({ length: 15 }, () => call("POST", "/api/splitfees/payouts/settle", P.token, body)));
    assert.ok(rs.every((r) => r.status === 200 || r.status === 201), rs.filter((r) => r.status > 201).map((r) => r.status + JSON.stringify(r.json).slice(0, 300)).join(" | "));
    assert.equal(rs.filter((r) => r.status === 201).length, 1);
    const ids = new Set(rs.map((r) => r.json.settlement.id));
    assert.equal(ids.size, 1);
    const docs = await db.collection("franchiseSettlements").where("tenantId", "==", P.tenantId).get();
    assert.equal(docs.size, 1);
    const s = docs.docs[0].data();
    assert.deepEqual([s.amount, s.direction, s.franchiseId, s.card, s.direct, s.hoKeepsCard, s.hoShareDirect], [790, "hoPays", A, 900, 200, 90, 20]);
    assert.ok(s.settledAt && s.settledBy.name);
  });
  it("a second click later changes nothing; the table shows the settlement; there is no edit or delete", async () => {
    const before = (await db.collection("franchiseSettlements").where("tenantId", "==", P.tenantId).get()).docs[0].data();
    await sleep(20);
    const again = await call("POST", "/api/splitfees/payouts/settle", P.token, { franchiseId: A, from: SEP_FROM, to: SEP_TO });
    assert.equal(again.status, 200);
    assert.equal(again.json.alreadySettled, true);
    const after = (await db.collection("franchiseSettlements").where("tenantId", "==", P.tenantId).get()).docs[0].data();
    assert.deepEqual(after, before);
    const t = await payouts(P.token);
    assert.equal(rowOf(t.json, A).settlement.amount, 790);
    assert.equal(rowOf(t.json, B).settlement, null);
    assert.equal(t.json.settlements.length, 1);
    const id = rowOf(t.json, A).settlement.id;
    assert.ok([404, 405].includes((await call("DELETE", `/api/splitfees/payouts/settlements/${id}`, P.token)).status));
    assert.ok([404, 405].includes((await call("PUT", `/api/splitfees/payouts/settlements/${id}`, P.token, { amount: 1 })).status));
  });
  it("an overlapping different period for the same franchise is refused; the franchise sees its own history only", async () => {
    const r = await call("POST", "/api/splitfees/payouts/settle", P.token, { franchiseId: A, from: "2026-09-15", to: "2026-10-05" });
    assert.equal(r.status, 409);
    const mine = await call("GET", `/api/splitfees/payouts/mine?${SEP}`, FA.token);
    assert.equal(mine.json.settlements.length, 1);
    assert.equal(mine.json.row.settlement.amount, 790);
    const theirs = await call("GET", `/api/splitfees/payouts/mine?${SEP}`, FB.token);
    assert.equal(theirs.json.settlements.length, 0);
  });
});

describe("The rate carries an effective date", () => {
  it("changing the rate never rewrites a past month, and a rate cannot start in the past", async () => {
    const today = new Date().toISOString().slice(0, 10);
    assert.equal((await call("PUT", "/api/splitfees/settings", P.token, { basis: "revenue", rate: 20, effectiveFrom: "2020-01-01" })).status, 400);
    assert.equal((await call("PUT", "/api/splitfees/settings", P.token, { basis: "revenue", rate: 10.123 })).status, 400);
    const put = await call("PUT", "/api/splitfees/settings", P.token, { basis: "revenue", rate: 20 });
    assert.equal(put.status, 200, JSON.stringify(put.json));
    assert.equal(put.json.settings.rate, 20);
    assert.equal(put.json.history.length, 2);
    assert.deepEqual(put.json.history[0], { from: "1970-01-01", rate: 10 });
    assert.ok(put.json.history[1].from >= today.slice(0, 7));
    const sep = await payouts(P.token);
    assert.deepEqual([rowOf(sep.json, A).net, rowOf(sep.json, A).rate, rowOf(sep.json, A).hoKeepsCard], [790, 10, 90]);
    const oct = await payouts(P.token, "month=2026-10");
    assert.equal(rowOf(oct.json, A).hoKeepsCard, 10); // the 1 Oct booking is before the new rate started
    assert.equal(oct.json.rate, 20);
    // saving the same rate again adds no history step
    const same = await call("PUT", "/api/splitfees/settings", P.token, { basis: "revenue", rate: 20 });
    assert.equal(same.json.history.length, 2);
  });
});

describe("Reads", () => {
  it("the money data is read once and then served from memory for 60 seconds (no scan per call)", async () => {
    const proto = Object.getPrototypeOf(db.collection("bookings").where("tenantId", "==", "x"));
    const realGet = proto.get;
    let docs = 0;
    proto.get = async function (this: unknown, ...a: unknown[]) { const s = await realGet.apply(this, a); docs += s.size; return s; };
    try {
      clearKitCache();
      const first = await loadLite(P.tenantId);
      const afterFirst = docs;
      assert.ok(afterFirst >= 9 && afterFirst <= 12, `first load read ${afterFirst} docs (9 bookings + 1 listing)`);
      for (let i = 0; i < 5; i++) await loadLite(P.tenantId);
      assert.equal(docs, afterFirst, "five more loads read nothing");
      assert.equal(first.length, 7); // the unpaid and pending bookings are boiled away
    } finally { proto.get = realGet; }
  });
});
