// Behaviour test: a STAFF token never receives money from the listings API (mine list, browse feed, direct link). Owners still do.
// Real API + Firestore emulator (npm run test:emu). Synthetic data only.
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { call, db, login, makeListing, makeParent, makeProvider, ok, uniq, type Provider } from "./helpers.mts";

let P: Provider, L: string, staff: { token: string };
let DAY = "", CHILD = "", L2 = "";
const NAME = `Staff money ${uniq()}`;
const MONEY_KEY = /price|amount|paid|fee|cost|discount|deposit/i;

/** Every key path (and every string value containing a pound sign) that looks like money. */
function moneyHits(v: unknown, path = "$"): string[] {
  if (typeof v === "string") return v.includes("£") ? [`${path} = "${v}"`] : [];
  if (Array.isArray(v)) return v.flatMap((x, i) => moneyHits(x, `${path}[${i}]`));
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => (MONEY_KEY.test(k) ? [`${path}.${k}`] : []).concat(moneyHits(x, `${path}.${k}`)));
  return [];
}
const mine = (rows: any[]) => rows.find((r) => r.id === L);

before(async () => {
  P = await makeProvider("slm");
  const l = await makeListing(P, NAME, false);
  L = l.id;
  await db.collection("listings").doc(L).set({ discounts: [{ kind: "early", method: "fixed", amount: 5, enabled: true }], depositAmount: 10 }, { merge: true });
  // An UNPAID bank-transfer booking with a one-off add-on (shows in Add-on orders and on the register, flagged "not-paid" for the owner).
  const lib = (await ok("GET", "/api/library", P.token)) ?? {};
  await ok("PUT", "/api/library", P.token, { ...lib, addons: [{ id: "ao-slm", name: "Slm shirt", type: "once", price: 10, questions: [] }] });
  const l2 = await makeListing(P, `${NAME} addon`, false);
  L2 = l2.id;
  await ok("PUT", `/api/listings/${L2}`, P.token, { addonIds: ["ao-slm"] });
  const blk = (await db.collection("blocks").doc(l2.blockId).get()).data() as any;
  DAY = blk.sessions[0].date;
  CHILD = `Slm Kid ${uniq()}`;
  const parent = await makeParent("slm", P);
  const bk = await call("POST", "/api/my/bookings", parent.token, { listingId: L2, blockId: l2.blockId, method: "Bank transfer", items: [{ pass: "Day pass", dates: [DAY], child: CHILD, age: 8, addons: [{ id: "ao-slm", answers: {} }] }] });
  assert.ok(bk.status < 300, JSON.stringify(bk.json).slice(0, 300));
  const email = `slm-staff-${uniq()}@emu.test`;
  const s = await login(email);
  await db.collection("users").doc(s.uid).set({ email, tenantId: P.tenantId, role: "staff" });
  staff = { token: s.token };
});

describe("listings as a staff token carry no money", () => {
  it("owner still gets prices (control)", async () => {
    const row = mine(await ok("GET", "/api/listings?mine=1", P.token));
    assert.ok(row && moneyHits(row).length > 0, "owner sees passes[].price");
    assert.ok(row.passes?.[0]?.price > 0);
  });
  it("GET /api/listings?mine=1: no money key or pound text anywhere, but the screens' fields remain", async () => {
    const rows = await ok("GET", "/api/listings?mine=1", staff.token);
    const row = mine(rows);
    assert.ok(row, "staff still sees the listing");
    assert.deepEqual(moneyHits(rows), []);
    assert.equal(row.title, NAME);
    assert.ok(row.venueId && Array.isArray(row.blocks) && row.blocks[0].sessions.length > 0);
    assert.equal(typeof row.blocks[0].capacity, "number");
    assert.ok(row.passes.every((p: any) => p.name && !("price" in p)));
  });
  it("GET /api/listings (browse feed): no money", async () => {
    const rows = await ok("GET", "/api/listings", staff.token);
    assert.deepEqual(moneyHits(rows), []);
  });
  it("GET /api/listings/:id: no money (passes, bundle, library add-ons, discounts)", async () => {
    const r = await call("GET", `/api/listings/${L}`, staff.token);
    assert.equal(r.status, 200);
    assert.deepEqual(moneyHits(r.json), []);
    assert.equal(r.json.id, L);
  });
  it("owner direct link still has prices", async () => {
    const r = await ok("GET", `/api/listings/${L}`, P.token);
    assert.ok(moneyHits(r).length > 0);
  });
});

describe("staff do not see the 'Not paid yet' flag; owners still do", () => {
  const regFlags = (j: any) => (j?.attendees ?? j?.sessions?.flatMap((x: any) => x.attendees) ?? []).filter((a: any) => JSON.stringify(a).includes(CHILD));
  it("owner: Add-on orders and the register carry not-paid (control)", async () => {
    const kit = await ok("GET", `/api/kit?date=${DAY}`, P.token);
    assert.ok(JSON.stringify(kit).includes('"flag":"not-paid"'), "owner kit flag");
    const reg = await ok("GET", `/api/registers?date=${DAY}`, P.token);
    assert.ok(JSON.stringify(reg).includes('"addonFlag":"not-paid"'), "owner register flag");
  });
  it("staff: the add-on still shows, with no flag and no 'not-paid' anywhere", async () => {
    const kit = await ok("GET", `/api/kit?date=${DAY}`, staff.token);
    const kj = JSON.stringify(kit);
    assert.ok(kj.includes(CHILD), "staff still sees the child's add-on order");
    assert.ok(!/not-paid|"flag"/.test(kj), kj.slice(0, 400));
    const reg = await ok("GET", `/api/registers?date=${DAY}`, staff.token);
    const rj = JSON.stringify(reg);
    assert.ok(rj.includes(CHILD) && rj.includes("Slm shirt"), "staff register still lists the add-on");
    assert.ok(!/not-paid|addonFlag/.test(rj), "no addonFlag for staff");
  });
});
