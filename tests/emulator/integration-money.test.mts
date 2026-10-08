// Integration MONEY fixes (8 Oct 2026): what staff and families may see of a refund, a family release / provider cancel-child never refunding an
// extra that was already refunded, a declined refund un-doing its own "T-shirt refunded" stamp, a partial refund of the whole booking, and a family
// releasing a day after the provider cancelled one. Real API + Firestore emulator (npm run test:emu). Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { ADDON_DEFS, EMAILS, adminDb, as, bookWithAddons, bookingAsRole, call, day, ids, kitDay, kitDays, login, operatorAction, registerDay, seedAddons } from "../../scripts/emu/addons-helpers.mts";
import { dayIso, paidSoFar, refundableSoFar } from "../../features/bookings/helpers";

const uniq = () => Math.random().toString(36).slice(2, 7);
const r2 = (n: number) => Math.round(n * 100) / 100;
const BOTTLE = (c = "Blue") => ({ id: "AW", answers: { Colour: c } });
const SHIRT = (s = "M") => ({ id: "AT", answers: { Size: s } });
const walletRef = async () => (await adminDb()).collection("wallet").doc(`${ids().tenants.P}__parent-a@emu.test`);
const walletBal = async () => Number(((await (await walletRef()).get()).data() as { balance?: number } | undefined)?.balance ?? 0);
before(async () => { await seedAddons({ extraD1: [4, 2] }); await (await walletRef()).set({ balance: 0 }, { merge: true }); });

const act = async (ref: string, type: string, extra: Record<string, unknown> = {}) => operatorAction(ref, type, extra);
const doc = async (ref: string) => (await bookingAsRole(ref, "P")).json;
const myDoc = async (ref: string) => (await bookingAsRole(ref, "A")).json;
const lines = async (ref: string) => (await as("A", "GET", `/api/my/bookings/${encodeURIComponent(ref)}/addon-options`)).json.lines as { key: string; child: string; name: string }[];
const keyOf = async (ref: string, name: string, child?: string) => (await lines(ref)).find((x) => x.name === name && (!child || x.child === child))!.key;
async function cancelExtra(ref: string, name: string, dayNums?: number[], child?: string) {
  const target = { key: await keyOf(ref, name, child), ...(dayNums ? { days: dayNums.map((n) => day(n)) } : {}) };
  const r = await as("A", "POST", `/api/my/bookings/${encodeURIComponent(ref)}/addon-requests`, { kind: "cancel", targets: [target] });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r.json.id as string;
}
/** Family asks, provider approves the removal as a refund, then records the refund. */
async function refundExtra(ref: string, name: string, dayNums?: number[], child?: string) {
  const id = await cancelExtra(ref, name, dayNums, child);
  assert.equal((await operatorAction(ref, "addon-approve", { requestId: id, resolution: "refund" })).status, 200);
  assert.equal((await act(ref, "refund-approve")).status, 200);
}
async function mk(tag: string, addons: unknown[], kids = 1) {
  await (await walletRef()).set({ balance: 0 }, { merge: true });
  const children = Array.from({ length: kids }, (_, i) => ({ name: `${tag}${i} ${uniq()}`, days: "all" as const, addons: addons as never }));
  const b = await bookWithAddons({ parent: "A", listing: "LK", children });
  assert.equal(b.status, 201, JSON.stringify(b.json));
  assert.equal(b.refs.length, 1, "one reference for the whole run");
  assert.equal((await act(b.refs[0], "paid")).status, 200);
  return { ref: b.refs[0] as string, names: children.map((c) => c.name) };
}
const keysDeep = (v: unknown, path = "$"): string[] => {
  const out: string[] = [];
  if (Array.isArray(v)) v.forEach((x, i) => out.push(...keysDeep(x, `${path}[${i}]`)));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.push(`${path}.${k}`); out.push(...keysDeep(x, `${path}.${k}`)); }
  return out;
};
const hits = (v: unknown, re: RegExp) => keysDeep(v).filter((p) => re.test(p.split(".").pop()!));
/** Money given back on a booking (paid minus what is still refundable). */
const given = (d: unknown) => r2(paidSoFar(d as never) - refundableSoFar(d as never));

describe("1 staff never see refund or extras money", () => {
  let ref = "";
  const STAFF_MONEY = /^(refundLog|refundEntries|refundedApproved|walletRefunded|walletRelieved|lastRefundSent|checkoutId|amount|cash|via|price|approvedAt|sentAt)$/i;
  before(async () => {
    const m = await mk("stf", [BOTTLE(), SHIRT()]);
    ref = m.ref;
    await refundExtra(ref, "T-shirt");
    await refundExtra(ref, "Water bottle", [3]);
    // a request still waiting, so its price is on the booking too
    await cancelExtra(ref, "Water bottle", [5]);
    const owner = await doc(ref);
    assert.ok((owner.refundEntries ?? []).length >= 2, "the owner view still has the refund entries");
    assert.ok((owner.refundLog ?? []).length >= 2, "the owner view still has the refund log");
  });
  for (const who of ["S1", "S2"]) {
    it(`${who}: GET /api/bookings (list) and /api/bookings/:ref carry no refund / extras money`, async () => {
      const list = (await as(who, "GET", "/api/bookings")).json as { ref: string }[];
      const mine = list.find((b) => b.ref === ref);
      assert.ok(mine, "the staff member still sees the booking");
      assert.deepEqual(hits(mine, STAFF_MONEY), [], "list row");
      const one = (await as(who, "GET", `/api/bookings/${encodeURIComponent(ref)}`)).json;
      assert.deepEqual(hits(one, STAFF_MONEY), [], "single booking");
      assert.ok(one.ref === ref && one.booker && (one.addonLines ?? []).length >= 1, "names, children and extras are still there");
      assert.deepEqual(hits(one.addonRequests ?? [], /price|amount|refund|paid|wallet|cost/i), [], "request prices");
      assert.deepEqual(hits(one.addonLines ?? [], /price|amount|refund|paid|wallet|cost/i), [], "line prices");
    });
    it(`${who}: register, kit, Add-on orders month tally carry no refund money`, async () => {
      for (const r of [await registerDay(3, who), await kitDay(3, {}, who), await kitDays(1, 7, {}, who)]) {
        assert.equal(r.status, 200);
        assert.deepEqual(hits(r.json, /refund|amount|price|wallet|cash|checkoutId|paid/i), []);
      }
    });
  }
});

describe("2 a family sees its own refund, not the provider's internals", () => {
  it("GET /api/my/bookings has no refundEntries / walletRefunded; the refund amount and 'awaiting' state remain", async () => {
    const { ref } = await mk("fam", [BOTTLE(), SHIRT()]);
    await refundExtra(ref, "T-shirt");
    const mine = await myDoc(ref);
    assert.deepEqual(hits(mine, /^(refundEntries|walletRefunded|checkoutId|approvedAt|sentAt|cash|via)$/), [], "internal refund structure / checkout id");
    assert.ok((mine.refundLog ?? []).some((l: { amount: number }) => l.amount === 8), "their refund amount is still shown");
    assert.equal(mine.refundAwaiting, true, "the bank-transfer refund the provider has recorded but not sent still reads 'awaiting'");
    assert.equal((await act(ref, "refund-sent")).status, 200);
    assert.equal((await myDoc(ref)).refundAwaiting, false);
    const owner = await doc(ref);
    assert.ok((owner.refundEntries ?? []).length >= 1, "the provider keeps the entries");
  });
  it("GET /api/privacy/export has no checkoutId anywhere", async () => {
    await mk("prv", [BOTTLE()]);
    const r = await as("A", "GET", "/api/privacy/export");
    assert.equal(r.status, 200);
    assert.deepEqual(hits(r.json, /^checkoutId$/), []);
  });
});

describe("3 a release / cancel-child never refunds an extra that was already refunded", () => {
  const gone = [1, 2, 3, 4, 5, 6];
  const release = (ref: string, resolution: "refund" | "wallet") => as("A", "POST", `/api/my/bookings/${encodeURIComponent(ref)}/cancel`, { days: gone.map((n) => day(n)), resolution, msg: "release" });
  async function afterExtras(tag: string) {
    const m = await mk(tag, [BOTTLE(), SHIRT()]); // 7 x 20 + bottle 21 + T-shirt 8 = 169
    await refundExtra(m.ref, "T-shirt");
    await refundExtra(m.ref, "Water bottle", [3]);
    const d = await doc(m.ref);
    assert.equal(r2(given(d)), 11);
    return m.ref;
  }
  // One day (the 7th) is left: 20 for the pass + 3 for its bottle = 23 stays with the provider, so at most 169 - 23 = 146 goes back in total.
  it("family release of 6 of 7 days, refund: total back after approval is 146, not 155.84", async () => {
    const ref = await afterExtras("rel");
    const r = await release(ref, "refund");
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal((await act(ref, "refund-approve")).status, 200);
    const total = given(await doc(ref));
    assert.ok(total <= 146.005, `refunded ${total}, entitled 146`);
    assert.ok(total >= 145.99, `refunded ${total}, the family is owed 146`);
  });
  it("family release of 6 of 7 days, wallet: the instant credit also stays within 146", async () => {
    const ref = await afterExtras("wal");
    const before = await walletBal();
    const r = await release(ref, "wallet");
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const total = given(await doc(ref));
    assert.ok(total <= 146.005, `credited in total ${total}, entitled 146`);
    assert.ok(total >= 145.99, `credited in total ${total}`);
    assert.equal(r2((await walletBal()) - before), r2(total - 11), "the wallet got exactly what the release logged");
  });
  it("provider cancel-child with the default amount after a bottle refund gives 140, the child's pass, not 161", async () => {
    const m = await mk("kc", [BOTTLE()], 2); // two children: 2 x (140 + 21) = 322
    await refundExtra(m.ref, "Water bottle", undefined, m.names[0]);
    assert.equal(r2(given(await doc(m.ref))), 21);
    assert.equal((await act(m.ref, "cancel-child", { ki: 0 })).status, 200);
    assert.equal((await act(m.ref, "refund-approve")).status, 200);
    const total = given(await doc(m.ref));
    assert.ok(total <= 161.005, `refunded ${total} for a child worth 161 (bottle already gave back 21)`);
    assert.ok(total >= 160.99, `refunded ${total}`);
  });
  it("an untouched booking still gives the whole pro-rata share (no regression)", async () => {
    const m = await mk("plain", [BOTTLE()], 2);
    assert.equal((await act(m.ref, "cancel-child", { ki: 0 })).status, 200);
    assert.equal((await act(m.ref, "refund-approve")).status, 200);
    assert.equal(given(await doc(m.ref)), 161);
  });
});

/** A weekly listing that starts on a Sunday so a 7 day booking splits into two references: Sunday | Monday to Saturday. */
async function weeklyListing() {
  const P = await login(EMAILS.P);
  const must = async (method: string, path: string, body?: unknown) => { const r = await call(method, path, P.token, body); assert.ok(r.ok, `${method} ${path} -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`); return r.json; };
  const start = new Date(); start.setUTCDate(start.getUTCDate() + 9); while (start.getUTCDay() !== 0) start.setUTCDate(start.getUTCDate() + 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6);
  const period = await must("POST", "/api/periods", { title: "Full day", start: "09:00", finish: "15:30" });
  const passDocs = [];
  for (let n = 1; n <= 7; n++) passDocs.push(await must("POST", "/api/passes", { name: `${n}-day pass`, days: n }));
  const bundle = await must("POST", "/api/block-bundles", { name: `Emu block weekly ${uniq()}`, periodIds: [period.id], passIds: passDocs.map((p: { id: string }) => p.id), priced: true, masterPrice: 140, calcOn: true });
  const listing = await must("POST", "/api/listings", {
    title: `Weekly split ${uniq()}`, venueId: "emu-venue", runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [0, 1, 2, 3, 4, 5, 6],
    maxAttendees: "500", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id,
    passes: passDocs.map((p: { name: string }, i: number) => ({ name: p.name, price: 20 * (i + 1), days: i + 1 })), bookingType: "auto", addonIds: [ADDON_DEFS.AT.id, ADDON_DEFS.AW.id], status: "live", visibility: "public",
  });
  await must("PUT", `/api/block-bundles/${bundle.id}/listings`, { listingIds: [listing.id] });
  const db = await adminDb();
  const bl = await db.collection("blocks").where("listingId", "==", listing.id).get();
  const blocks = bl.docs.map((d) => ({ id: d.id, dates: (d.data().sessions as { date: string }[]).map((s) => s.date).sort() })).sort((a, b) => a.dates[0].localeCompare(b.dates[0]));
  return { id: listing.id as string, blocks, dates: blocks.flatMap((b) => b.dates) };
}
async function splitBooking(L: Awaited<ReturnType<typeof weeklyListing>>, child: string) {
  const { token } = await login(EMAILS.A);
  const r = await call("POST", "/api/my/bookings", token, { listingId: L.id, blockId: L.blocks[0].id, method: "Bank transfer", items: [{ pass: "7-day pass", child, age: 8, dates: L.dates, addons: [{ id: ADDON_DEFS.AT.id, answers: { "q-size": "M" } }] }] });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const list: { ref: string; days?: string[] }[] = Array.isArray(r.json) ? r.json : r.json.bookings ?? [r.json];
  assert.equal(list.length, 2, "split into two references");
  const refs = list.map((b) => b.ref).sort((a, b) => (a < b ? -1 : 1));
  const all = (await as("P", "GET", "/api/bookings")).json as { ref: string; days?: string[] }[];
  const rows = refs.map((x) => all.find((b) => b.ref === x)!).sort((a, b) => String(a.days?.[0]).localeCompare(String(b.days?.[0])));
  for (const x of rows) assert.equal((await act(x.ref, "paid")).status, 200);
  return rows.map((x) => x.ref);
}
const shirtDays = async (L: Awaited<ReturnType<typeof weeklyListing>>, child: string) => {
  const out: string[] = [];
  for (const d of L.dates) {
    const k = (await kitDay(d)).json;
    for (const g of k.groups ?? []) if (/T-shirt/i.test(g.name)) for (const c of g.children) if (c.child === child) out.push(d);
  }
  return out;
};

describe("4 / 5 the T-shirt follows to the sibling reference unless it was really refunded", () => {
  let L: Awaited<ReturnType<typeof weeklyListing>>;
  before(async () => { L = await weeklyListing(); });
  it("cancel (full) then DECLINE the refund: no money moved, so the T-shirt shows on the second reference", async () => {
    const child = `decl ${uniq()}`;
    const [first] = await splitBooking(L, child);
    assert.deepEqual(await shirtDays(L, child), [L.blocks[0].dates[0]], "before: on the first day");
    assert.equal((await act(first, "cancel", { refund: "full" })).status, 200);
    assert.deepEqual(await shirtDays(L, child), [], "while the refund is pending the T-shirt is treated as going back");
    assert.equal((await act(first, "refund-decline")).status, 200);
    assert.deepEqual(await shirtDays(L, child), [L.blocks[1].dates[0]], "declined: the T-shirt follows to the next reference");
  });
  it("same with an explicit 'add-ons go back: yes' answer", async () => {
    const child = `decy ${uniq()}`;
    const [first] = await splitBooking(L, child);
    assert.equal((await act(first, "cancel", { refund: "full", refundsAddons: true })).status, 200);
    assert.equal((await act(first, "refund-decline")).status, 200);
    assert.deepEqual(await shirtDays(L, child), [L.blocks[1].dates[0]]);
  });
  it("cancel (full) and APPROVE the refund: the T-shirt went back and does not follow", async () => {
    const child = `appr ${uniq()}`;
    const [first] = await splitBooking(L, child);
    assert.equal((await act(first, "cancel", { refund: "full" })).status, 200);
    assert.equal((await act(first, "refund-approve")).status, 200);
    assert.deepEqual(await shirtDays(L, child), []);
  });
  it("a partial refund equal to the whole booking amount counts as full: the T-shirt does not follow", async () => {
    const child = `part ${uniq()}`;
    const [first] = await splitBooking(L, child);
    const d = await doc(first);
    const whole = d.amount + (d.walletApplied ?? 0);
    assert.equal((await act(first, "cancel", { refund: "partial", amount: whole })).status, 200);
    assert.deepEqual(await shirtDays(L, child), [], "pending whole-booking partial refund");
    assert.equal((await act(first, "refund-approve")).status, 200);
    assert.deepEqual(await shirtDays(L, child), [], "approved whole-booking partial refund");
  });
  it("a smaller partial refund still keeps the T-shirt following", async () => {
    const child = `small ${uniq()}`;
    const [first] = await splitBooking(L, child);
    assert.equal((await act(first, "cancel", { refund: "partial", amount: 5 })).status, 200);
    assert.deepEqual(await shirtDays(L, child), [L.blocks[1].dates[0]]);
  });
});

/** The ISO days the child has given up, whatever form (ISO or label) the booking stores them in. */
const goneDays = async (ref: string) => [...new Set(((await doc(ref)).kids?.[0]?.cancelledDays ?? []).map((d: string) => dayIso(d) ?? d))].sort();

describe("6 a family can release a day after the provider cancelled another", () => {
  it("provider cancel-day on a one-child booking, then the parent releases a different day", async () => {
    const m = await mk("cd", []);
    assert.equal((await act(m.ref, "cancel-day", { ki: 0, date: day(2), resolution: "refund" })).status, 200);
    const r = await as("A", "POST", `/api/my/bookings/${encodeURIComponent(m.ref)}/cancel`, { days: [day(3)], resolution: "refund", msg: "x" });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.deepEqual(await goneDays(m.ref), [day(2), day(3)], "both days are off the child");
    assert.ok(!((await doc(m.ref)).days ?? []).includes(day(3)), "the family's day left the booking's days");
  });
  it("releasing the day the provider already cancelled says so, not 'isn't booked'", async () => {
    const m = await mk("cd2", []);
    assert.equal((await act(m.ref, "cancel-day", { ki: 0, date: day(2), resolution: "refund" })).status, 200);
    const r = await as("A", "POST", `/api/my/bookings/${encodeURIComponent(m.ref)}/cancel`, { days: [day(2)], resolution: "refund", msg: "x" });
    assert.equal(r.status, 400);
    assert.match(String(r.json.error), /already cancelled/i);
  });
  it("two releases by the family and a cancel-day in the middle all land on the right days", async () => {
    const m = await mk("cd3", []);
    assert.equal((await as("A", "POST", `/api/my/bookings/${encodeURIComponent(m.ref)}/cancel`, { days: [day(1)], resolution: "refund", msg: "x" })).status, 200);
    assert.equal((await act(m.ref, "cancel-day", { ki: 0, date: day(2), resolution: "refund" })).status, 200);
    assert.equal((await as("A", "POST", `/api/my/bookings/${encodeURIComponent(m.ref)}/cancel`, { days: [day(3)], resolution: "refund", msg: "x" })).status, 200);
    assert.deepEqual(await goneDays(m.ref), [1, 2, 3].map((n) => day(n)));
  });
});
