// Franchise payouts, round 2 (independent verifier findings). Real API + Firestore emulator (npm run test:emu). Synthetic data only.
//   Franchise C (rate 10%), September 2026 (an ended period):  c1 card 20 (made + paid 5 Sep).
//   Stale cache:  GET fills the cache, then the booking is changed WITHOUT going through the API (as a webhook or sweep does); a settle in the
//                 next seconds must record the LIVE figure: card 20 less an 8 refund = 12, keeps 1.20, franchise gets 10.80 (not 18.00).
//   Overlap:      Sep 1-15 and Sep 10-30 sent together 20 times: exactly ONE period is ever accepted.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { call, db, login, makeListing, makeProvider, uniq, type Provider } from "./helpers.mts";

let P: Provider;
let FC: { token: string };
const C = `frC-${uniq()}`, D = `frD-${uniq()}`;
const ukToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const book = async (id: string, o: Record<string, unknown>) => {
  await db.collection("bookings").doc(`${P.tenantId}-${id}`).set({
    ref: id, bid: id, tenantId: P.tenantId, status: "Confirmed", pay: "Paid", method: "Card", amount: 0, kids: [], addons: [], answers: [], child: "c", booker: "b", email: "b@emu.test", ...o,
  });
};
const card = (id: string, amount: number, createdAt: string, o: Record<string, unknown> = {}) => book(id, { amount, amountPaid: amount, paymentIntentId: `pi_${id}`, createdAt, ...o });
const payouts = (token: string, q: string, extra = "") => call("GET", `/api/splitfees/payouts?${q}${extra}`, token);
const rowOf = (j: any, fid: string) => (j.rows as any[]).find((r) => r.franchiseId === fid);
const bust = () => call("PUT", "/api/splitfees/settings", P.token, { basis: "revenue", rate: 10 }); // any successful API write empties the 60-second cache
const settle = (fid: string, from: string, to: string, token = P.token) => call("POST", "/api/splitfees/payouts/settle", token, { franchiseId: fid, from, to });

before(async () => {
  P = await makeProvider("fpay2");
  const mk = async (tag: string, doc: Record<string, unknown>) => {
    const email = `${tag}-${uniq()}@emu.test`;
    const s = await login(email);
    await db.collection("users").doc(s.uid).set({ email, tenantId: P.tenantId, ...doc });
    return { token: s.token };
  };
  FC = await mk("fc", { role: "franchise", franchiseId: C, franchiseName: "Charlie Camps", name: "C" });
  await mk("fd", { role: "franchise", franchiseId: D, franchiseName: "Delta Camps", name: "D" });
});

describe("Settling reads FRESH data", () => {
  it("a change that bypassed the API (webhook / sweep style) inside the 60-second cache is still in the recorded amount", async () => {
    await card("c1", 20, "2026-09-05T10:00:00Z", { franchiseId: C });
    const before = await payouts(P.token, "month=2026-09");
    assert.equal(rowOf(before.json, C).card, 20, "cache now holds 20");
    // an £8 refund arrives by a path that does not clear the cache
    await db.collection("bookings").doc(`${P.tenantId}-c1`).set({ pay: "Partially refunded", refundLog: [{ label: "Refunded in Stripe", amount: 8, on: "2026-09-20", by: "Stripe", source: "Card" }] }, { merge: true });
    const r = await settle(C, "2026-09-01", "2026-09-30");
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.deepEqual([r.json.settlement.card, r.json.settlement.hoKeepsCard, r.json.settlement.amount], [12, 1.2, 10.8]);
  });
});

describe("Overlapping periods", () => {
  it("20 parallel settles of Sep 1-15 and Sep 10-30 accept exactly one period", async () => {
    await card("d1", 50, "2026-09-12T10:00:00Z", { franchiseId: D });
    const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? settle(D, "2026-09-01", "2026-09-15") : settle(D, "2026-09-10", "2026-09-30"))));
    assert.ok(rs.every((r) => [200, 201, 409].includes(r.status)), rs.map((r) => r.status).join());
    assert.equal(rs.filter((r) => r.status === 201).length, 1);
    const docs = await db.collection("franchiseSettlements").where("tenantId", "==", P.tenantId).where("franchiseId", "==", D).get();
    assert.equal(docs.size, 1);
  });
});

describe("A period must have ENDED", () => {
  it("today and the future are refused, yesterday is accepted", async () => {
    const t = ukToday();
    assert.equal((await settle(C, t, t)).status, 400);
    assert.equal((await settle(C, addDays(t, -3), t)).status, 400);
    assert.equal((await settle(C, "2026-10-01", addDays(t, 2))).status, 400);
    const ok = await settle("nope-none", "2026-10-01", addDays(t, -1));
    assert.equal(ok.status, 404, "an ended period passes the date rule (then the unknown franchise is refused)");
    const good = await settle(C, "2026-10-01", addDays(t, -1));
    assert.equal(good.status, 201, JSON.stringify(good.json));
  });
});

describe("Cash dating", () => {
  it("a September booking whose payment is recorded in October counts in October's statement, not September's", async () => {
    const F = `frE-${uniq()}`;
    await db.collection("users").doc(`u-${F}`).set({ role: "franchise", tenantId: P.tenantId, franchiseId: F, franchiseName: "Echo Camps", name: "E" });
    await book("e1", { franchiseId: F, amount: 100, amountPaid: 100, method: "Cash on the day", createdAt: "2026-09-28T10:00:00Z" });
    await db.collection("payments").doc(`pay-e1-${uniq()}`).set({ tenantId: P.tenantId, refs: ["e1"], amount: 100, type: "payment", status: "recorded", offline: true, createdAt: "2026-10-03T10:00:00Z" });
    // Echo has no sign-in session here; read through head office.
    const sep = rowOf((await payouts(P.token, "month=2026-09")).json, F), oct = rowOf((await payouts(P.token, "month=2026-10")).json, F);
    assert.deepEqual([sep.direct, oct.direct, oct.hoShareDirect], [0, 100, 10]);
    assert.match((await payouts(P.token, "month=2026-10")).json.basis, /received/i);
  });
  it("a booking with no createdAt still lands in a window (dated by its payment record, else by when its record last changed)", async () => {
    const F = `frG-${uniq()}`;
    await db.collection("users").doc(`u-${F}`).set({ role: "franchise", tenantId: P.tenantId, franchiseId: F, franchiseName: "Golf Camps", name: "G" });
    await book("g1", { franchiseId: F, amount: 40, amountPaid: 40, paymentIntentId: "pi_g1" });
    await bust();
    const now = ukToday();
    const row = rowOf((await payouts(P.token, `from=${addDays(now, -1)}&to=${addDays(now, 1)}`)).json, F);
    assert.equal(row.card, 40);
  });
});

describe("Listing reassignment and settled periods", () => {
  it("a listing whose bookings sit in a settled period cannot be handed to another franchise (and bookings do not move)", async () => {
    const L = await makeListing(P, `Settled camp ${uniq()}`, false);
    await db.collection("listings").doc(L.id).set({ franchiseId: C }, { merge: true });
    await card("c-listing", 30, "2026-09-06T10:00:00Z", { franchiseId: C, listingId: L.id });
    const r = await call("PUT", `/api/listings/${L.id}`, P.token, { franchiseId: D });
    assert.equal(r.status, 409, JSON.stringify(r.json));
    assert.match(r.json.error, /settled/i);
    const b = await db.collection("bookings").doc(`${P.tenantId}-c-listing`).get();
    assert.equal(b.get("franchiseId"), C);
    const l = await db.collection("listings").doc(L.id).get();
    assert.equal(l.get("franchiseId"), C);
  });
});

describe("Rates: scheduled change and the per-booking basis", () => {
  it("a rate scheduled for later is labelled 'from <date>' and the current rate stays the current one", async () => {
    const later = addDays(ukToday(), 5);
    const put = await call("PUT", "/api/splitfees/settings", P.token, { basis: "revenue", rate: 25, effectiveFrom: later });
    assert.equal(put.status, 200, JSON.stringify(put.json));
    const g = await call("GET", "/api/splitfees/settings", P.token);
    assert.equal(g.json.settings.rate, 10);
    assert.deepEqual(g.json.upcoming, [{ from: later, rate: 25 }]);
    const p = await payouts(P.token, "month=2026-09");
    assert.equal(p.json.rate, 10);
    assert.deepEqual(p.json.upcoming, [{ from: later, rate: 25 }]);
    // set it back to the current rate before the date: the schedule goes
    const back = await call("PUT", "/api/splitfees/settings", P.token, { basis: "revenue", rate: 10, effectiveFrom: later });
    assert.equal(back.status, 200);
  });
  it("on the legacy per-booking fee: payouts shows a banner and NO amounts, settle is refused, and Split fees keeps its own number", async () => {
    const put = await call("PUT", "/api/splitfees/settings", P.token, { basis: "perBooking", perBookingFee: 2.5 });
    assert.equal(put.status, 200);
    const p = await payouts(P.token, "month=2026-09");
    assert.equal(p.json.blocked, "perBooking");
    assert.deepEqual(p.json.rows, []);
    assert.equal(JSON.stringify(p.json).includes('"net"'), false, "no payout amount anywhere");
    assert.equal((await settle(C, "2026-08-01", "2026-08-31")).status, 409);
    const mine = await call("GET", "/api/splitfees/payouts/mine?month=2026-09", FC.token);
    assert.equal(mine.json.blocked, "perBooking");
    assert.equal(mine.json.row, null);
    const sf = (await call("GET", "/api/splitfees?from=2026-09-01&to=2026-09-30", P.token)).json;
    assert.equal(sf.franchises.find((f: any) => f.franchiseId === C).fee, 5); // two bookings x 2.50
  });
  it("switching to a percentage brings payouts back and all reports agree again", async () => {
    await call("PUT", "/api/splitfees/settings", P.token, { basis: "revenue", rate: 10 });
    const p = await payouts(P.token, "month=2026-09");
    assert.equal(p.json.blocked, undefined);
    const sf = (await call("GET", "/api/splitfees?from=2026-09-01&to=2026-09-30", P.token)).json;
    const mineSf = (await call("GET", "/api/splitfees/mine?from=2026-09-01&to=2026-09-30", FC.token)).json;
    const c = rowOf(p.json, C);
    assert.equal(sf.franchises.find((f: any) => f.franchiseId === C).fee, c.royalty);
    assert.equal(mineSf.fee, c.royalty);
  });
});
