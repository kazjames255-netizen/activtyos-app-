// Behaviour tests: the Add-on orders page can be filtered to ONE listing (GET /api/kit and GET /api/kit/days take ?listingId=).
// Real API + Firestore emulator (npm run test:emu). Synthetic data only.
//
// Fixture (worked out by hand BEFORE the code was written). Two listings, same provider, same add-on library:
//   Tshirty = a ONE-OFF add-on (counted once, on the child's first day), Lunch = a PER-DAY add-on (counted on each of its days).
//   d0..d3 = the first four weekdays of the run.
//   Listing A  c1: d0 Tshirty                     c2: d0,d1,d2 (3-day pass) Tshirty + Lunch on all three days    c3: d1 Tshirty
//   Listing B  c4: d0 Tshirty                     c5: d0,d1,d2 (3-day pass) Tshirty + Lunch on all three days    c6: d3 Lunch
// Listing A by day: d0 = Tshirty c1,c2 + Lunch c2 = 3 | d1 = Tshirty c3 + Lunch c2 = 2 | d2 = Lunch c2 = 1      total 6   Tshirty 3  Lunch 3
// Listing B by day: d0 = Tshirty c4,c5 + Lunch c5 = 3 | d1 = Lunch c5 = 1 | d2 = Lunch c5 = 1 | d3 = Lunch c6 = 1  total 6   Tshirty 2  Lunch 4
// Both together:    d0 6, d1 3, d2 2, d3 1   total 12   Tshirty 5  Lunch 7
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { call, db, login, makeParent, makeProvider, ok, uniq, type Provider } from "./helpers.mts";

let P: Provider;
let LA: string, LB: string, LC: string; // LC = a third listing with NO add-on orders
const NAME_A = `Holiday camp ${uniq()}`, NAME_B = `After-school club ${uniq()}`, NAME_C = `Quiet class ${uniq()}`;
let days: string[] = [];
let franchise: { token: string }, staffA: { token: string }, staffB: { token: string };

interface Made { id: string; blocks: any[]; p1: string; p3: string }
async function makeListingWith(title: string): Promise<Made> {
  const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7));
  const end = new Date(start); end.setDate(end.getDate() + 13);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const period = await ok("POST", "/api/periods", P.token, { title: `Full day ${uniq()}`, start: "09:00", finish: "15:30" });
  const p1 = await ok("POST", "/api/passes", P.token, { name: `Day ${uniq()}`, days: 1 });
  const p3 = await ok("POST", "/api/passes", P.token, { name: `Three days ${uniq()}`, days: 3 });
  const bundle = await ok("POST", "/api/block-bundles", P.token, { name: `Block ${title}`, periodIds: [period.id], passIds: [p1.id, p3.id], priced: true, masterPrice: 20, calcOn: true });
  const listing = await ok("POST", "/api/listings", P.token, {
    title, venueId: "emu-venue", runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5],
    maxAttendees: "500", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id,
    passes: [{ name: p1.name, price: 20, days: 1 }, { name: p3.name, price: 55, days: 3 }],
    bookingType: "auto", status: "live", visibility: "public", addonIds: ["ao-tshirt", "ao-lunch"],
  });
  await ok("PUT", `/api/block-bundles/${bundle.id}/listings`, P.token, { listingIds: [listing.id] });
  const blocks = (await db.collection("blocks").where("listingId", "==", listing.id).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  return { id: listing.id, blocks: blocks as any[], p1: p1.name, p3: p3.name };
}

before(async () => {
  P = await makeProvider("kit");
  const lib = (await ok("GET", "/api/library", P.token)) ?? {};
  await ok("PUT", "/api/library", P.token, {
    venues: [{ id: "emu-venue", name: "Test Sports Hall", address: "1 Test Way", city: "Testville" }],
    addons: [
      { id: "ao-tshirt", name: "Tshirty", type: "once", price: 10, questions: [{ id: "q-size", label: "size", type: "choice", options: ["S", "M", "L"], required: true }] },
      { id: "ao-lunch", name: "Lunch", type: "perday", price: 4, questions: [] },
    ],
    settings: { ...(lib.settings ?? {}), marketplaceListed: true },
  });
  const a = await makeListingWith(NAME_A);
  const b = await makeListingWith(NAME_B);
  const c = await makeListingWith(NAME_C);
  LA = a.id; LB = b.id; LC = c.id;
  const parent = await makeParent("kit", P);
  // The first four session days of the run (Monday to Thursday of the first week).
  const sessionDays = [...new Set(a.blocks.flatMap((x: any) => x.sessions.map((s: any) => s.date as string)))].sort();
  days = sessionDays.slice(0, 4);
  assert.equal(days.length, 4, "four session days");
  const [d0, d1, d2, d3] = days;
  const place = async (l: Made, pass: string, child: string, dates: string[], addons: any[]) => {
    const blk = l.blocks.find((x: any) => x.sessions.some((s: any) => s.date === dates[0]));
    const r = await call("POST", "/api/my/bookings", parent.token, { listingId: l.id, blockId: blk.id, method: "Bank transfer", items: [{ pass, dates, child, age: 8, addons }] });
    assert.ok(r.status < 300, `book ${child} -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  };
  const ts = (size: string) => ({ id: "ao-tshirt", answers: { "q-size": size } });
  const lunch = (on: string[]) => ({ id: "ao-lunch", days: on });
  await place(a, a.p1, "Ava One", [d0], [ts("M")]);
  await place(a, a.p3, "Ben Two", [d0, d1, d2], [ts("L"), lunch([d0, d1, d2])]);
  await place(a, a.p1, "Cal Three", [d1], [ts("M")]);
  await place(b, b.p1, "Dee Four", [d0], [ts("S")]);
  await place(b, b.p3, "Eve Five", [d0, d1, d2], [ts("M"), lunch([d0, d1, d2])]);
  await place(b, b.p1, "Fay Six", [d3], [lunch([d3])]);

  // A franchise owner that owns ONLY listing A, a member of staff sent to ONLY listing A, and one sent to ONLY listing B.
  await db.collection("listings").doc(LA).set({ franchiseId: "fr-kit" }, { merge: true });
  const mk = async (tag: string, doc: Record<string, unknown>) => {
    const email = `${tag}-${uniq()}@emu.test`;
    const s = await login(email);
    await db.collection("users").doc(s.uid).set({ email, tenantId: P.tenantId, ...doc });
    return { token: s.token };
  };
  franchise = await mk("fr", { role: "franchise", franchiseId: "fr-kit" });
  staffA = await mk("sa", { role: "staff", assignment: { mode: "listings", ids: [LA] } });
  staffB = await mk("sb", { role: "staff", assignment: { mode: "listings", ids: [LB] } });
});

const range = () => `from=${days[0]}&to=${days[3]}`;
const daysOf = (j: any) => Object.fromEntries((j.days as any[]).map((d) => [d.date, d.items]));
const summary = (j: any) => ({ perDay: daysOf(j), total: j.total, totals: j.totals });
const fetchDays = async (token: string, extra = "") => (await call("GET", `/api/kit/days?${range()}${extra}`, token)).json;

describe("/api/kit/days with a listing filter", () => {
  it("no filter: both listings together (the baseline)", async () => {
    const j = await fetchDays(P.token);
    assert.deepEqual(summary(j), { perDay: { [days[0]]: 6, [days[1]]: 3, [days[2]]: 2, [days[3]]: 1 }, total: 12, totals: { Tshirty: 5, Lunch: 7 } });
  });
  it("listing A only: exactly A's items and totals", async () => {
    const j = await fetchDays(P.token, `&listingId=${LA}`);
    assert.deepEqual(summary(j), { perDay: { [days[0]]: 3, [days[1]]: 2, [days[2]]: 1 }, total: 6, totals: { Tshirty: 3, Lunch: 3 } });
  });
  it("listing B only: exactly B's items and totals", async () => {
    const j = await fetchDays(P.token, `&listingId=${LB}`);
    assert.deepEqual(summary(j), { perDay: { [days[0]]: 3, [days[1]]: 1, [days[2]]: 1, [days[3]]: 1 }, total: 6, totals: { Tshirty: 2, Lunch: 4 } });
  });
  it("a listing with no add-on orders: empty, and no error", async () => {
    const r = await call("GET", `/api/kit/days?${range()}&listingId=${LC}`, P.token);
    assert.equal(r.status, 200);
    assert.deepEqual(summary(r.json), { perDay: {}, total: 0, totals: {} });
  });
  it("the add-on name filter and the listing filter combine", async () => {
    const a = await fetchDays(P.token, `&listingId=${LA}&name=Lunch`);
    assert.deepEqual(summary(a), { perDay: { [days[0]]: 1, [days[1]]: 1, [days[2]]: 1 }, total: 3, totals: { Lunch: 3 } });
    const b = await fetchDays(P.token, `&listingId=${LB}&name=Tshirty`);
    assert.deepEqual(summary(b), { perDay: { [days[0]]: 2 }, total: 2, totals: { Tshirty: 2 } });
    const all = await fetchDays(P.token, `&name=Tshirty`);
    assert.equal(all.total, 5);
  });
  it("the dropdown lists only listings that have add-on orders, with their names", async () => {
    const j = await fetchDays(P.token);
    const got = ((j.listings ?? []) as { id: string; name: string }[]).map((l) => `${l.id}=${l.name}`).sort();
    assert.deepEqual(got, [`${LA}=${NAME_A}`, `${LB}=${NAME_B}`].sort());
  });
  it("the dropdown does not shrink when a listing or an add-on is picked", async () => {
    const j = await fetchDays(P.token, `&listingId=${LA}&name=Lunch`);
    assert.equal((j.listings ?? []).length, 2);
  });
});

describe("/api/kit (one day) with a listing filter", () => {
  const day = async (token: string, date: string, extra = "") => (await call("GET", `/api/kit?date=${date}${extra}`, token)).json;
  const lines = (j: any) => (j.groups as any[]).flatMap((g) => g.children.map((c: any) => `${g.name}:${c.child}`)).sort();
  it("day 0, no filter: every line of both listings", async () => {
    const j = await day(P.token, days[0]);
    assert.deepEqual(lines(j), ["Lunch:Ben Two", "Lunch:Eve Five", "Tshirty:Ava One", "Tshirty:Ben Two", "Tshirty:Dee Four", "Tshirty:Eve Five"]);
    assert.equal(j.total, 6);
  });
  it("day 0, listing A", async () => {
    const j = await day(P.token, days[0], `&listingId=${LA}`);
    assert.deepEqual(lines(j), ["Lunch:Ben Two", "Tshirty:Ava One", "Tshirty:Ben Two"]);
    assert.equal(j.total, 3);
  });
  it("day 0, listing B", async () => {
    const j = await day(P.token, days[0], `&listingId=${LB}`);
    assert.deepEqual(lines(j), ["Lunch:Eve Five", "Tshirty:Dee Four", "Tshirty:Eve Five"]);
  });
  it("day 3 (only B has orders): listing A is empty, B has Fay", async () => {
    assert.equal((await day(P.token, days[3], `&listingId=${LA}`)).total, 0);
    assert.deepEqual(lines(await day(P.token, days[3], `&listingId=${LB}`)), ["Lunch:Fay Six"]);
  });
  it("listing and add-on name combine on a day", async () => {
    const j = await day(P.token, days[0], `&listingId=${LB}&name=Tshirty`);
    assert.deepEqual(lines(j), ["Tshirty:Dee Four", "Tshirty:Eve Five"]);
  });
  it("an unknown listing id gives an empty result, not an error", async () => {
    const r = await call("GET", `/api/kit?date=${days[0]}&listingId=does-not-exist`, P.token);
    assert.equal(r.status, 200);
    assert.equal(r.json.total, 0);
  });
});

describe("a scoped account cannot reach another listing's orders by passing its id", () => {
  const forbidden = async (token: string, id: string) => {
    const a = await call("GET", `/api/kit/days?${range()}&listingId=${id}`, token);
    const b = await call("GET", `/api/kit?date=${days[0]}&listingId=${id}`, token);
    assert.equal(a.status, 200); assert.equal(b.status, 200);
    assert.deepEqual(summary(a.json), { perDay: {}, total: 0, totals: {} });
    assert.equal(b.json.total, 0);
    assert.deepEqual(b.json.groups, []);
    // Same answer as an id that does not exist at all: nothing reveals that the listing is real.
    const ghost = await call("GET", `/api/kit/days?${range()}&listingId=does-not-exist`, token);
    assert.deepEqual(a.json, ghost.json);
  };
  const A_ONLY = { perDay: { [""]: 0 }, total: 6, totals: { Tshirty: 3, Lunch: 3 } };
  it("franchise (owns A only): sees A, gets nothing for B", async () => {
    const want = { ...A_ONLY, perDay: { [days[0]]: 3, [days[1]]: 2, [days[2]]: 1 } };
    assert.deepEqual(summary(await fetchDays(franchise.token)), want);
    assert.deepEqual(summary(await fetchDays(franchise.token, `&listingId=${LA}`)), want);
    await forbidden(franchise.token, LB);
  });
  it("staff sent to A only: gets nothing for B", async () => {
    assert.equal((await fetchDays(staffA.token)).total, 6);
    await forbidden(staffA.token, LB);
  });
  it("staff sent to B only: gets nothing for A", async () => {
    assert.equal((await fetchDays(staffB.token)).total, 6);
    await forbidden(staffB.token, LA);
  });
  it("their dropdown lists only their own listing", async () => {
    for (const [tok, id, name] of [[franchise.token, LA, NAME_A], [staffA.token, LA, NAME_A], [staffB.token, LB, NAME_B]] as const) {
      const j = await fetchDays(tok);
      assert.deepEqual(j.listings, [{ id, name }]);
    }
  });
});

describe("an odd listingId (repeated, array or object form) behaves exactly like a made-up id", () => {
  const nothing = { perDay: {}, total: 0, totals: {} };
  const odd = (id: string) => [
    `listingId=${id}&listingId=${LB}`, `listingId=${LA}&listingId=${LB}`, `listingId[]=${id}`, `listingId[]=${LA}&listingId[]=${LB}`, `listingId[a]=${id}`, `listingId[${LA}]=${LA}`,
  ];
  const who = () => [["owner", P.token, LA], ["franchise", franchise.token, LA], ["staff", staffA.token, LA]] as const;
  it("days route: empty 200 for every odd form, same as a made-up id", async () => {
    for (const [label, tok, own] of who()) {
      for (const q of odd(own)) {
        const r = await call("GET", `/api/kit/days?${range()}&${q}`, tok);
        assert.equal(r.status, 200, `${label} ${q}`);
        assert.deepEqual(summary(r.json), nothing, `${label} ${q}`);
      }
    }
  });
  it("day route: empty 200 for every odd form", async () => {
    for (const [label, tok, own] of who()) {
      for (const q of odd(own)) {
        const r = await call("GET", `/api/kit?date=${days[0]}&${q}`, tok);
        assert.equal(r.status, 200, `${label} ${q}`);
        assert.equal(r.json.total, 0, `${label} ${q}`);
        assert.deepEqual(r.json.groups, [], `${label} ${q}`);
      }
    }
  });
  it("an empty listingId still means All listings, and a padded id is still trimmed", async () => {
    assert.equal((await fetchDays(P.token, `&listingId=`)).total, 12);
    assert.equal((await fetchDays(P.token, `&listingId=%20${LA}%20`)).total, 6);
    assert.equal((await call("GET", `/api/kit?date=${days[0]}&listingId=`, P.token)).json.total, 6);
  });
});
