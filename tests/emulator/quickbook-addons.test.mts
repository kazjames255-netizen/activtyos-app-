// Behaviour tests: a provider's QUICK BOOK / Take booking (POST /api/my/bookings with onBehalfOf) carries the listing's add-ons exactly like a
// parent's own booking: same server pricing (priceAddon), same stored addonLines, same refusals. Also: the legacy POST /api/bookings
// (hand-typed amount, no add-ons) must REFUSE add-ons rather than silently drop them.
// Real API + Firestore emulator (npm run test:emu). Synthetic data only.
//
// Fixture (worked out by hand): day pass 20, T-shirt (one-off, 10, size S/M/L), Bottle (per day, 3, colour Red/Blue), Hidden extra (in the
// library but NOT offered on the listing). Pass = 3 days (55). Child books d0,d1,d2 with T-shirt M (10) + Bottle on d0,d1 only (2 x 3 = 6).
// Expected amount = (no-extras amount of the same pass) + 10 + 6. With a 10% code on the pass only: 0.9 x pass + 16.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { call, db, makeParent, makeProvider, ok, uniq, type Provider } from "./helpers.mts";

let P: Provider;
let L: { id: string; blockId: string; days: string[]; pass3: string; pass1: string };
let parent: { token: string; email: string };

before(async () => {
  P = await makeProvider("qb");
  const lib = (await ok("GET", "/api/library", P.token)) ?? {};
  await ok("PUT", "/api/library", P.token, {
    venues: [{ id: "emu-venue", name: "Test Sports Hall", address: "1 Test Way", city: "Testville" }],
    addons: [
      { id: "ao-tshirt", name: "T-shirt", type: "once", price: 10, questions: [{ id: "q-size", label: "Size", type: "choice", options: ["S", "M", "L"], required: true }] },
      { id: "ao-bottle", name: "Bottle", type: "perday", price: 3, questions: [{ id: "q-col", label: "Colour", type: "choice", options: ["Red", "Blue"], required: true }] },
      { id: "ao-hidden", name: "Hidden extra", type: "once", price: 5, questions: [] },
    ],
    settings: { ...(lib.settings ?? {}), marketplaceListed: true },
  });
  const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7));
  const end = new Date(start); end.setDate(end.getDate() + 13);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const period = await ok("POST", "/api/periods", P.token, { title: `Full day ${uniq()}`, start: "09:00", finish: "15:30" });
  const p1 = await ok("POST", "/api/passes", P.token, { name: `Day ${uniq()}`, days: 1 });
  const p3 = await ok("POST", "/api/passes", P.token, { name: `Three ${uniq()}`, days: 3 });
  const bundle = await ok("POST", "/api/block-bundles", P.token, { name: `Block ${uniq()}`, periodIds: [period.id], passIds: [p1.id, p3.id], priced: true, masterPrice: 20, calcOn: true });
  const listing = await ok("POST", "/api/listings", P.token, {
    title: `QB camp ${uniq()}`, venueId: "emu-venue", runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5],
    maxAttendees: "500", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id,
    passes: [{ name: p1.name, price: 20, days: 1 }, { name: p3.name, price: 55, days: 3 }],
    bookingType: "auto", status: "live", visibility: "public", addonIds: ["ao-tshirt", "ao-bottle"],
  });
  await ok("PUT", `/api/block-bundles/${bundle.id}/listings`, P.token, { listingIds: [listing.id] });
  const blk = (await db.collection("blocks").where("listingId", "==", listing.id).get()).docs.map((d) => ({ id: d.id, ...(d.data() as any) })).sort((a, b) => String(a.sessions?.[0]?.date).localeCompare(String(b.sessions?.[0]?.date)))[0];
  L = { id: listing.id, blockId: blk.id, days: blk.sessions.map((s: any) => s.date).slice(0, 3), pass3: p3.name, pass1: p1.name };
  parent = await makeParent("qb", P);
});

const items = (child: string, addons: unknown[], dates = L.days, pass = L.pass3) => [{ pass, child, age: 8, dates, addons }];
const goodAddons = () => [
  { id: "ao-tshirt", answers: { "q-size": "M" } },
  { id: "ao-bottle", days: [L.days[0], L.days[1]], answers: { "q-col": "Blue" } },
];
const asParent = (its: unknown[], extra: Record<string, unknown> = {}) => call("POST", "/api/my/bookings", parent.token, { listingId: L.id, blockId: L.blockId, method: "Bank transfer", items: its, ...extra });
const asProvider = (its: unknown[], email: string, extra: Record<string, unknown> = {}) => call("POST", "/api/my/bookings", P.token, { listingId: L.id, blockId: L.blockId, method: "Cash", items: its, onBehalfOf: { name: "Pat Family", email, phone: "07000000000" }, ...extra });
const strip = (lines: any[]) => lines.map((l) => ({ name: l.name, label: l.label, price: l.price, days: l.days, perDay: l.perDay, qty: l.qty, answers: l.answers, child: l.child }));
const baseTotal = async () => (await asProvider(items(`Base${uniq()}`, []), `fam-${uniq()}@emu.test`)).json.total as number;
const doc = async (ref: string) => (await db.collection("bookings").doc(`${P.tenantId}_${ref}`).get()).data() as Record<string, any>;

describe("provider Quick book carries add-ons like a parent booking", () => {
  it("one-off T-shirt (M) + per-day Bottle on 2 of 3 days: amount = pass + extras, addonLines identical to the parent's", async () => {
    const pr = await asParent(items(`Kid${uniq()}`, goodAddons()));
    assert.equal(pr.status, 201, JSON.stringify(pr.json));
    const em = `fam-${uniq()}@emu.test`;
    const qr = await asProvider(items(`Kid${uniq()}`, goodAddons()), em);
    assert.equal(qr.status, 201, JSON.stringify(qr.json));
    const base = (await asProvider(items(`Kid${uniq()}`, []), `fam-${uniq()}@emu.test`)).json.total;
    assert.ok(base > 0);
    assert.equal(qr.json.total, base + 16, "pass + 10 T-shirt + 2 days x 3 bottle");
    assert.equal(pr.json.total, base + 16);
    const pd = await doc(pr.json.bookings[0].ref), qd = await doc(qr.json.bookings[0].ref);
    assert.ok((pd.addonLines ?? []).length >= 2, "parent booking stores addonLines");
    const norm = (x: any[]) => strip(x).map((l) => ({ ...l, child: "k" }));
    assert.deepEqual(norm(qd.addonLines), norm(pd.addonLines), "same stored lines");
    assert.equal(qd.amount, base + 16);
    assert.equal(qd.email, em, "lands on the family's account");
  });

  it("a tampered client price is ignored (the server prices it)", async () => {
    const r = await asProvider(items(`Kid${uniq()}`, [{ ...goodAddons()[0], price: 0 }, goodAddons()[1]]), `fam-${uniq()}@emu.test`, { amount: 1, total: 1 });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.total, (await baseTotal()) + 16);
  });

  it("refusals: bad choice, missing required answer, extra on a day not booked, extra not offered, duplicate extra", async () => {
    const em = () => `fam-${uniq()}@emu.test`;
    const bad = (a: unknown[], dates?: string[], pass?: string) => asProvider(items(`Kid${uniq()}`, a, dates, pass), em());
    assert.equal((await bad([{ id: "ao-tshirt", answers: { "q-size": "XXL" } }])).status, 400, "size not offered");
    assert.equal((await bad([{ id: "ao-tshirt" }])).status, 400, "required size missing");
    // Pass of 1 day booked on d0; bottle asked for d1 which is not booked.
    assert.equal((await bad([{ id: "ao-bottle", days: [L.days[1]], answers: { "q-col": "Red" } }], [L.days[0]], L.pass1)).status, 400, "day not booked");
    assert.equal((await bad([{ id: "ao-hidden" }])).status, 400, "not offered on this listing");
    assert.equal((await bad([{ id: "ao-nope" }])).status, 400, "unknown add-on");
    const dup = await bad([{ id: "ao-tshirt", answers: { "q-size": "S" } }, { id: "ao-tshirt", answers: { "q-size": "M" } }]);
    assert.equal(dup.status, 400, "chosen twice");
  });

  it("discount code applies to the pass only; extras stay at full price", async () => {
    await ok("POST", "/api/discounts", P.token, { code: "QB10", type: "percent", value: 10 });
    const r = await asProvider(items(`Kid${uniq()}`, goodAddons()), `fam-${uniq()}@emu.test`, { discountCode: "QB10" });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const base = await baseTotal();
    assert.equal(r.json.total, Math.round((base * 0.9 + 16) * 100) / 100);
  });

  it("the booking shows in Add-on orders (kit) with quantities, and the parent sees the extras in My bookings", async () => {
    const em = parent.email; // an existing family account: the booking lands on it
    const child = `Kit${uniq()}`;
    const r = await asProvider(items(child, goodAddons()), em);
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const k = await ok("GET", `/api/kit?date=${L.days[0]}&listingId=${L.id}`, P.token);
    assert.match(JSON.stringify(k), new RegExp(child), "child on the kit list");
    assert.match(JSON.stringify(k), /T-shirt/);
    assert.match(JSON.stringify(k), /Bottle/);
    // The family's own account sees the extras.
    const fam = parent;
    const mine = await ok("GET", "/api/my/bookings", fam.token);
    const b = (Array.isArray(mine) ? mine : mine.bookings).find((x: any) => x.ref === r.json.bookings[0].ref);
    assert.ok(b, "family sees the booking");
    assert.match(JSON.stringify(b), /Bottle/);
  });

  it("an add-on request (cancel the T-shirt) works afterwards on a provider-made booking", async () => {
    const em = parent.email;
    const r = await asProvider(items(`Req${uniq()}`, goodAddons()), em);
    const ref = r.json.bookings[0].ref;
    const fam = parent;
    const opt = await call("GET", `/api/my/bookings/${encodeURIComponent(ref)}/addon-options`, fam.token);
    assert.equal(opt.status, 200, JSON.stringify(opt.json).slice(0, 200));
    const names = (opt.json.lines as any[]).map((l) => l.name).sort();
    assert.deepEqual(names, ["Bottle", "T-shirt"], "both extras are changeable/cancellable lines like a parent booking");
    const tshirt = (opt.json.lines as any[]).find((l) => l.name === "T-shirt");
    assert.equal(tshirt.questions[0].label, "Size");
  });

  it("a booking without extras is unchanged (amount = pass only)", async () => {
    const r = await asProvider(items(`Kid${uniq()}`, []), `fam-${uniq()}@emu.test`);
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.total, await baseTotal());
  });
});

describe("legacy POST /api/bookings (typed amount)", () => {
  it("refuses add-ons instead of silently dropping them", async () => {
    const base = { booker: "Pat", email: `fam-${uniq()}@emu.test`, child: `Old${uniq()}`, age: 8, listing: "x", pass: L.pass1, blockId: L.blockId, amount: 20, method: "Cash" };
    const r = await call("POST", "/api/bookings", P.token, { ...base, addons: [{ id: "ao-tshirt" }] });
    assert.equal(r.status, 400, JSON.stringify(r.json));
    assert.match(JSON.stringify(r.json), /add-on|extras/i);
  });
});
