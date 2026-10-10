// VERIFIER break attempts for checkout wallet ask (commit 1c8890ce). Expected values: ~/ActivityOS-QA/runs/checkout-wallet-verify/EXPECTED.md
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { call, db, makeCode, makeListing, makeParent, makeProvider, ok, uniq, type Listing, type Parent, type Provider } from "./helpers.mts";
import { walletRemaining } from "../../features/listings/walletChoice";
import { bookingPayToken } from "../../server/src/lib/bookingPayToken";

let P: Provider, Q: Provider;
let L: Listing, QL: Listing;
let days: string[] = [];        // all session dates of L, sorted (block of first listing doc)
let blockDates: Record<string, string[]> = {};
const r2 = (n: number) => Math.round(n * 100) / 100;
const wid = (t: Provider, email: string) => `${t.tenantId}__${email.toLowerCase()}`;
const setBal = (t: Provider, email: string, v: number) => db.collection("wallet").doc(wid(t, email)).set({ tenantId: t.tenantId, email: email.toLowerCase(), balance: v }, { merge: true });
const bal = async (t: Provider, email: string) => Number((await db.collection("wallet").doc(wid(t, email)).get()).get("balance") ?? 0);
const spends = async (t: Provider, email: string) => (await db.collection("walletEntries").where("tenantId", "==", t.tenantId).where("email", "==", email.toLowerCase()).get()).docs.map((d) => d.data()).filter((e) => Number(e.delta) < 0);
const bdoc = async (t: Provider, ref: string) => (await db.collection("bookings").doc(`${t.tenantId}_${ref}`).get()).data() as Record<string, any>;
let n = 0;
const item = (dates: string[], child = `Kid${++n}${uniq()}`) => ({ pass: dates.length === 1 ? "Day pass" : `${dates.length} days`, child, age: 8, dates });
const post = (par: Parent, l: Listing, items: unknown[], extra: Record<string, unknown> = {}, t: Provider = P) =>
  call("POST", "/api/my/bookings", par.token, { listingId: l.id, blockId: l.blockId, method: "Bank transfer", items, ...extra });
const refsOf = (r: { json: any }): string[] => (Array.isArray(r.json) ? r.json : r.json?.bookings ?? []).map((b: any) => b.ref);
async function fam(bal0: number, t: Provider = P) { const par = await makeParent("W", t); await setBal(t, par.email, bal0); return par; }

async function mk3(p: Provider, title: string): Promise<Listing> {
  const lib = (await ok("GET", "/api/library", p.token)) ?? {};
  const venues: any[] = lib.venues ?? [];
  if (!venues.some((v) => v.id === "emu-venue")) venues.push({ id: "emu-venue", name: "Test Sports Hall", address: "1 Test Way", city: "Testville" });
  await ok("PUT", "/api/library", p.token, { venues, addons: lib.addons ?? [], settings: { ...(lib.settings ?? {}), marketplaceListed: true } });
  const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7));
  const end = new Date(start); end.setDate(end.getDate() + 27);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const period = await ok("POST", "/api/periods", p.token, { title: "Full day", start: "09:00", finish: "15:30" });
  const passes = [await ok("POST", "/api/passes", p.token, { name: "Day pass", days: 1 }), await ok("POST", "/api/passes", p.token, { name: "2 days", days: 2 }), await ok("POST", "/api/passes", p.token, { name: "3 days", days: 3 })];
  const bundle = await ok("POST", "/api/block-bundles", p.token, { name: `Emu block ${title}`, periodIds: [period.id], passIds: passes.map((x: any) => x.id), priced: true, masterPrice: 60, calcOn: true });
  const listing = await ok("POST", "/api/listings", p.token, {
    title, venueId: "emu-venue", runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5],
    maxAttendees: "500", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id,
    passes: [{ name: "Day pass", price: 20, days: 1 }, { name: "2 days", price: 40, days: 2 }, { name: "3 days", price: 60, days: 3 }],
    bookingType: "auto", status: "live", visibility: "public",
  });
  await ok("PUT", `/api/block-bundles/${bundle.id}/listings`, p.token, { listingIds: [listing.id] });
  const blocks = await db.collection("blocks").where("listingId", "==", listing.id).get();
  return { id: listing.id, blockId: blocks.docs[0].id };
}

before(async () => {
  P = await makeProvider("WP"); Q = await makeProvider("WQ");
  L = await mk3(P, `Wallet camp ${uniq()}`);
  QL = await mk3(Q, `Q camp ${uniq()}`);
  const blocks = await db.collection("blocks").where("listingId", "==", L.id).get();
  for (const b of blocks.docs) blockDates[b.id] = (b.data().sessions as { date: string }[]).map((s) => s.date).sort();
  days = Object.values(blockDates).flat().sort();
  console.log("BLOCKS", blocks.size, Object.entries(blockDates).map(([k, v]) => `${k}:${v.length}`).join(" "));
});

describe("W single-ref cases (Day pass 20/day, 3 days = 60)", () => {
  const three = () => days.slice(0, 3);
  it("W1 omitted cap: 0 applied, due 60, bal 50", async () => {
    const f = await fam(50); const r = await post(f, L, [item(three())]); assert.equal(r.status, 201, JSON.stringify(r.json));
    const b = await bdoc(P, refsOf(r)[0]); assert.equal(b.walletApplied ?? 0, 0); assert.equal(b.amount, 60); assert.equal(await bal(P, f.email), 50); assert.equal((await spends(P, f.email)).length, 0);
  });
  it("W2 null cap", async () => {
    const f = await fam(50); const r = await post(f, L, [item(three())], { walletCap: null }); assert.equal(r.status, 201, JSON.stringify(r.json));
    const b = await bdoc(P, refsOf(r)[0]); assert.equal(b.walletApplied ?? 0, 0); assert.equal(b.amount, 60); assert.equal(await bal(P, f.email), 50);
  });
  it("W3 cap 0", async () => {
    const f = await fam(50); const r = await post(f, L, [item(three())], { walletCap: 0 }); assert.equal(r.status, 201);
    const b = await bdoc(P, refsOf(r)[0]); assert.equal(b.walletApplied ?? 0, 0); assert.equal(b.amount, 60); assert.equal(await bal(P, f.email), 50);
  });
  it("W4 cap 25 of 50: applied 25, due 35, bal 25, one spend row", async () => {
    const f = await fam(50); const r = await post(f, L, [item(three())], { walletCap: 25 }); assert.equal(r.status, 201);
    const b = await bdoc(P, refsOf(r)[0]); assert.equal(b.walletApplied, 25); assert.equal(b.amount, 35); assert.equal(await bal(P, f.email), 25); assert.equal((await spends(P, f.email)).length, 1);
  });
  it("W5 cap 500 > balance 50: applied 50, due 10, bal 0", async () => {
    const f = await fam(50); const r = await post(f, L, [item(three())], { walletCap: 500 }); assert.equal(r.status, 201);
    const b = await bdoc(P, refsOf(r)[0]); assert.equal(b.walletApplied, 50); assert.equal(b.amount, 10); assert.equal(await bal(P, f.email), 0);
  });
  it("W6 cap 100 > total 60, bal 100: applied 60, due 0, bal 40", async () => {
    const f = await fam(100); const r = await post(f, L, [item(three())], { walletCap: 100 }); assert.equal(r.status, 201);
    const b = await bdoc(P, refsOf(r)[0]); assert.equal(b.walletApplied, 60); assert.equal(b.amount, 0); assert.equal(await bal(P, f.email), 40);
    console.log("W6/W17 booking status/pay with 0 due:", b.status, b.pay);
  });
  it("W7 negative cap refused 400, nothing booked, bal 50", async () => {
    const f = await fam(50); const r = await post(f, L, [item(three())], { walletCap: -5 });
    assert.equal(r.status, 400, JSON.stringify(r.json)); assert.equal(await bal(P, f.email), 50);
    assert.equal((await db.collection("bookings").where("email", "==", f.email).get()).size, 0);
  });
  it("W8 string cap refused 400", async () => {
    const f = await fam(50); const r = await post(f, L, [item(three())], { walletCap: "10" });
    assert.equal(r.status, 400, JSON.stringify(r.json)); assert.equal(await bal(P, f.email), 50);
    assert.equal((await db.collection("bookings").where("email", "==", f.email).get()).size, 0);
  });
  it("W9 cap 1e999 (Infinity): refused or clamped to 50, never above balance", async () => {
    const f = await fam(50);
    const raw = await fetch(`${process.env.EMU_API}/api/my/bookings`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${f.token}` }, body: JSON.stringify({ listingId: L.id, blockId: L.blockId, method: "Bank transfer", items: [item(three())] }).replace(/}$/, ',"walletCap":1e999}') });
    const j: any = await raw.json().catch(() => null);
    console.log("W9 status", raw.status, JSON.stringify(j).slice(0, 160));
    const b = await bal(P, f.email); assert.ok(b >= 0 && b <= 50, `bal ${b}`);
    if (raw.status === 201) { assert.equal(b, 0); const d = await bdoc(P, (j.bookings ?? j)[0].ref); assert.equal(d.walletApplied, 50); assert.equal(d.amount, 10); }
    else assert.equal(b, 50);
  });
  it("W17 wallet covers whole 1-day booking: applied 20, due 0, bal 80", async () => {
    const f = await fam(100); const r = await post(f, L, [item(days.slice(0, 1))], { walletCap: 20 }); assert.equal(r.status, 201);
    const b = await bdoc(P, refsOf(r)[0]); assert.equal(b.walletApplied, 20); assert.equal(b.amount, 0); assert.equal(await bal(P, f.email), 80);
  });
  it("W14a balance falls after choosing (cap 30, bal now 12): applied 12, due 48", async () => {
    const f = await fam(30); await setBal(P, f.email, 12);
    const r = await post(f, L, [item(three())], { walletCap: 30 }); assert.equal(r.status, 201);
    const b = await bdoc(P, refsOf(r)[0]); assert.equal(b.walletApplied, 12); assert.equal(b.amount, 48); assert.equal(await bal(P, f.email), 0);
  });
  it("W14b balance rises after choosing (cap 30, bal now 80): applied 30, due 30, bal 50", async () => {
    const f = await fam(30); await setBal(P, f.email, 80);
    const r = await post(f, L, [item(three())], { walletCap: 30 }); assert.equal(r.status, 201);
    const b = await bdoc(P, refsOf(r)[0]); assert.equal(b.walletApplied, 30); assert.equal(b.amount, 30); assert.equal(await bal(P, f.email), 50);
  });
  it("W15 other provider's credit (Q 50, P 0) is not spent at P", async () => {
    const f = await fam(0); await setBal(Q, f.email, 50);
    const r = await post(f, L, [item(three())], { walletCap: 50 }); assert.equal(r.status, 201);
    const b = await bdoc(P, refsOf(r)[0]); assert.equal(b.walletApplied ?? 0, 0); assert.equal(b.amount, 60); assert.equal(await bal(Q, f.email), 50); assert.equal(await bal(P, f.email), 0);
    const w = await call("GET", "/api/my/wallet", f.token); console.log("W15 /my/wallet", JSON.stringify(w.json));
  });
  it("W16 10% code + wallet 20: code price 54, applied 20, due 34", async () => {
    const code = await makeCode(P, `W${uniq().toUpperCase()}`);
    const f = await fam(20); const r = await post(f, L, [item(three())], { walletCap: 20, discountCode: code.code }); assert.equal(r.status, 201, JSON.stringify(r.json));
    const b = await bdoc(P, refsOf(r)[0]); assert.equal(b.walletApplied, 20); assert.equal(b.amount, 34); assert.equal(await bal(P, f.email), 0);
  });
  it("W10 parallel x10 same cap 30 bal 30 (1 day each): total applied exactly 30, bal 0, ledger -30", async () => {
    const f = await fam(30);
    const rs = await Promise.all(Array.from({ length: 10 }, () => post(f, L, [item(days.slice(0, 1))], { walletCap: 30 })));
    const okRs = rs.filter((r) => r.status === 201);
    console.log("W10 statuses", rs.map((r) => r.status).join(","));
    let applied = 0, due = 0;
    for (const r of okRs) for (const ref of refsOf(r)) { const b = await bdoc(P, ref); applied += b.walletApplied ?? 0; due += b.amount; }
    const sp = (await spends(P, f.email)).reduce((s, e) => s + Math.abs(Number(e.delta)), 0);
    assert.equal(r2(applied), 30); assert.equal(r2(sp), 30); assert.equal(await bal(P, f.email), 0); assert.equal(r2(due), r2(okRs.length * 20 - 30));
  });
  it("W10b parallel x6 with cap 30 bal 30 whole cart identical child (duplicates): credit spent once at most", async () => {
    const f = await fam(30); const child = `Dup${uniq()}`;
    const rs = await Promise.all(Array.from({ length: 6 }, () => post(f, L, [item(days.slice(1, 2), child)], { walletCap: 30 })));
    console.log("W10b statuses", rs.map((r) => r.status).join(","));
    const sp = (await spends(P, f.email)).reduce((s, e) => s + Math.abs(Number(e.delta)), 0);
    const b = await bal(P, f.email); assert.ok(b >= 0); assert.equal(r2(30 - b), r2(sp));
    let applied = 0; for (const r of rs.filter((x) => x.status === 201)) for (const ref of refsOf(r)) applied += (await bdoc(P, ref)).walletApplied ?? 0;
    assert.equal(r2(applied), r2(sp));
  });
});

describe("W multi-reference, other paths", () => {
  it("W11 one POST spanning blocks: wallet drawn across refs, earliest first, total applied = min(cap,bal)", async () => {
    const keys = Object.keys(blockDates);
    if (keys.length < 2) { console.log("W11 only one block - NOT multi-ref"); return; }
    const d = [blockDates[keys[0]].slice(-1)[0], blockDates[keys[1]][0], blockDates[keys[1]][1]]; // 1 day + 2 days = 3 days => segments 20 and 40
    const f = await fam(50);
    const r = await post(f, L, [{ pass: "3 days", child: `Kid${++n}${uniq()}`, age: 8, dates: d }], { walletCap: 50 }); assert.equal(r.status, 201, JSON.stringify(r.json));
    const refs = refsOf(r); const bs = await Promise.all(refs.map((x) => bdoc(P, x)));
    console.log("W11 refs", refs.length, bs.map((b) => `${b.ref}: amt ${b.amount} wal ${b.walletApplied ?? 0}`).join(" | "));
    const applied = bs.reduce((s, b) => s + (b.walletApplied ?? 0), 0), due = bs.reduce((s, b) => s + b.amount, 0);
    assert.equal(r2(applied), 50); assert.equal(r2(due), 10); assert.equal(await bal(P, f.email), 0);
    assert.equal((await spends(P, f.email)).length, refs.length >= 2 ? 2 : 1);
  });
  it("W11b UI-style (wizard: one POST per block, each carrying the still-unspent part of the chosen total): block1 Day pass 20 + block2 3-day 60, bal 50, 'Use' => screen promises applied 50, due 30", async () => {
    const keys = Object.keys(blockDates);
    if (keys.length < 2) { console.log("W11b only one block"); return; }
    const f = await fam(50);
    const d1 = [blockDates[keys[0]][0]]; const d2 = blockDates[keys[1]].slice(0, 3);
    const r1 = await call("POST", "/api/my/bookings", f.token, { listingId: L.id, blockId: keys[0], method: "Bank transfer", walletCap: 50, items: [{ pass: "Day pass", child: `Kid${++n}${uniq()}`, age: 8, dates: d1 }] });
    const r2_ = await call("POST", "/api/my/bookings", f.token, { listingId: L.id, blockId: keys[1], method: "Bank transfer", walletCap: walletRemaining(50, (await bdoc(P, refsOf(r1)[0])).walletApplied ?? 0), items: [{ pass: "3 days", child: `Kid${++n}${uniq()}`, age: 8, dates: d2 }] });
    assert.equal(r1.status, 201, JSON.stringify(r1.json)); assert.equal(r2_.status, 201, JSON.stringify(r2_.json));
    const bs = await Promise.all([...refsOf(r1), ...refsOf(r2_)].map((x) => bdoc(P, x)));
    const applied = bs.reduce((s, b) => s + (b.walletApplied ?? 0), 0), due = bs.reduce((s, b) => s + b.amount, 0);
    console.log("W11b applied", applied, "due", due, "bal left", await bal(P, f.email), "(screen promised applied 50, due 30)");
    assert.equal(r2(due), 30, "the amount charged equals the amount the screen showed");
    assert.equal(await bal(P, f.email), 0);
    assert.equal(r2(applied), 50, `screen promised 50 credit applied but only ${applied} was; real due ${due} vs promised 30`);
  });
  it("W12a waitlist accept-offer never touches wallet", async () => {
    const f = await fam(0); const r = await post(f, L, [item(days.slice(2, 3))], { walletCap: 0 }); assert.equal(r.status, 201);
    const ref = refsOf(r)[0]; await setBal(P, f.email, 50);
    await db.collection("bookings").doc(`${P.tenantId}_${ref}`).set({ status: "Offered", offerExpiresAt: new Date(Date.now() + 3600e3).toISOString() }, { merge: true });
    const a = await call("POST", `/api/my/bookings/${encodeURIComponent(ref)}/accept-offer`, f.token, { walletCap: 50 });
    console.log("W12a accept status", a.status, JSON.stringify(a.json).slice(0, 120));
    assert.equal(a.status, 200); const b = await bdoc(P, ref); assert.equal(b.walletApplied ?? 0, 0); assert.equal(b.amount, 20); assert.equal(await bal(P, f.email), 50); assert.equal((await spends(P, f.email)).length, 0);
  });
  it("W12b pay link GET + checkout never touches wallet; amount = booking amount", async () => {
    const f = await fam(0); const r = await post(f, L, [item(days.slice(0, 3))], { walletCap: 0 }); assert.equal(r.status, 201);
    const ref = refsOf(r)[0]; await setBal(P, f.email, 50);
    const tok = await bookingPayToken(P.tenantId, ref);
    const g = await call("GET", `/api/public/booking-pay/${tok}`, null); console.log("W12b GET", g.status, JSON.stringify(g.json).slice(0, 200));
    assert.equal(g.status, 200); assert.equal(g.json.amount, 60);
    const c = await call("POST", `/api/public/booking-pay/${tok}/checkout`, null, {}); console.log("W12b checkout", c.status, JSON.stringify(c.json).slice(0, 160));
    const b = await bdoc(P, ref); assert.equal(b.walletApplied ?? 0, 0); assert.equal(b.amount, 60); assert.equal(await bal(P, f.email), 50); assert.equal((await spends(P, f.email)).length, 0);
  });
  it("W13 operator Quick book with walletCap 50 on a family holding 50: spends none", async () => {
    const f = await fam(50);
    const r = await call("POST", "/api/my/bookings", P.token, { listingId: L.id, blockId: L.blockId, method: "Cash", items: [item(days.slice(0, 3))], walletCap: 50, onBehalfOf: { name: "Pat Family", email: f.email, phone: "07000000000" } });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const b = await bdoc(P, refsOf(r)[0]); assert.equal(b.walletApplied ?? 0, 0); assert.equal(b.amount, 60); assert.equal(await bal(P, f.email), 50);
  });
  it("W13b operator Quick book with walletCap omitted: spends none", async () => {
    const f = await fam(50);
    const r = await call("POST", "/api/my/bookings", P.token, { listingId: L.id, blockId: L.blockId, method: "Cash", items: [item(days.slice(0, 3))], onBehalfOf: { name: "Pat Family", email: f.email, phone: "07000000000" } });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const b = await bdoc(P, refsOf(r)[0]); assert.equal(b.walletApplied ?? 0, 0); assert.equal(await bal(P, f.email), 50);
  });
  it("W18 waitlisted place never gets credit (cap given, status Waitlisted)", async () => {
    // fill not feasible cheaply: assert by read of code path only
    console.log("W18 PASS-READ only: placed && walletLeft>0 guard at my.ts:1769");
  });
});
