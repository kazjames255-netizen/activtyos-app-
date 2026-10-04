import { test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { ROOT, API_URL } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, apiPost, fbSignIn, fbSignUp } from "./helpers/accounts";

// CN-019: cancelling ONE of two children frees ONE place. API-only, private API:
//   NEXT_PUBLIC_API_URL=http://localhost:4011 npx playwright test -c e2e/zz-cn019.config.ts
test.describe.configure({ mode: "serial" });
const stamp = Date.now().toString(36);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const MON1 = (() => { const d = new Date(); d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7)); return d; })();
type Acct = { email: string; uid: string; tenantId?: string; name?: string; token: () => Promise<string> };
const tok = (email: string) => async () => (await fbSignIn(email)).idToken;
async function call(a: Acct | null, method: string, p: string, body?: unknown) {
  const r = await fetch(`${API_URL}${p}`, { method, headers: { "Content-Type": "application/json", ...(a ? { Authorization: `Bearer ${await a.token()}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: r.status, json, text };
}
async function ok<T = any>(a: Acct | null, method: string, p: string, body?: unknown): Promise<T> {
  const r = await call(a, method, p, body);
  if (r.status >= 300) throw new Error(`${method} ${p} -> ${r.status} ${r.text.slice(0, 300)}`);
  return r.json as T;
}
async function mkParent(tag: string): Promise<Acct> {
  const email = `e2e-cn19-${tag}-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  await apiPost("/api/register-role", s.idToken, { role: "parent", postcode: "NN5 7EA" });
  await apiPost("/api/me/welcome", s.idToken, {});
  return { email, uid: s.uid, token: tok(email) };
}
async function mkOp(): Promise<Acct> {
  const email = `e2e-cn19-op-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  const name = `CN19 op ${stamp}`;
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role: "company", businessName: name, providerName: name, providerNameMode: "business" });
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", r.tenantId], { stdio: "pipe" });
  return { email, uid: s.uid, tenantId: r.tenantId, name, token: tok(email) };
}
const VENUE = "cn19-venue";
async function mkListing(a: Acct, title: string, max: number) {
  const lib = ((await ok(a, "GET", "/api/library")) ?? {}) as any;
  await ok(a, "PUT", "/api/library", { venues: [...(lib.venues ?? []), { id: VENUE, name: "Hall", address: "1 Test Way", city: "Northampton" }], settings: { ...(lib.settings ?? {}), marketplaceListed: true, providerName: a.name } });
  const period = await ok(a, "POST", "/api/periods", { title: "Full day", start: "09:00", finish: "15:30" });
  const pass = await ok(a, "POST", "/api/passes", { name: "3 days", days: 3 });
  const bundle = await ok(a, "POST", "/api/block-bundles", { name: `B ${title}`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 54, calcOn: true, passFlat: { [pass.id]: 54 }, passMode: { [pass.id]: "flat" } });
  const l = await ok(a, "POST", "/api/listings", {
    title, venueId: VENUE, runFrom: iso(MON1), runTo: iso(addDays(MON1, 4)), blockMode: "weekly", days: [1, 2, 3, 4, 5],
    maxAttendees: String(max), capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id,
    passes: [{ name: "3 days", price: 54, days: 3 }], bookingType: "auto", waitlist: true, waitlistMode: "auto", status: "live", visibility: "public",
  });
  await ok(a, "PUT", `/api/block-bundles/${bundle.id}/listings`, { listingIds: [l.id] });
  return l.id as string;
}
const blockOf = async (op: Acct, id: string) => { const f = await ok(op, "GET", `/api/listings/${id}`); const b = f.blocks[0]; return { id: b.id as string, booked: b.bookedCount as number, days: (b.sessions as any[]).map((s) => s.bookedCount ?? 0) as number[], dates: (b.sessions as any[]).map((s) => s.date as string) }; };
const publicSpots = async (p: Acct, id: string): Promise<string> => { const all = await ok<any>(p, "GET", "/api/listings"); const rows: any[] = Array.isArray(all) ? all : all.listings ?? []; const l = rows.find((x) => x.id === id); const b = l?.blocks?.[0]; return JSON.stringify({ spotsLeft: b?.spotsLeft, sessions: (b?.sessions ?? []).slice(0, 3).map((s: any) => s.spotsLeft) }); };
const book = (p: Acct, listingId: string, blockId: string, dates: string[], kids: string[]) => call(p, "POST", "/api/my/bookings", { listingId, blockId, method: "card", walletCap: 0, items: kids.map((c) => ({ pass: "3 days", child: c, age: 8, dates })) });
const RES: [string, string][] = [];
const fail = (m: string) => { throw new Error(m); };
const eq = (a: unknown, b: unknown, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) fail(`${m}: expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };
async function check(id: string, fn: () => Promise<string>) { try { const n = await fn(); RES.push([id, "PASS"]); console.log(`RESULT ${id} PASS :: ${n}`); } catch (e) { RES.push([id, "FAIL"]); console.log(`RESULT ${id} FAIL :: ${String((e as Error).message).slice(0, 600)}`); } }

test("CN-019 per-child capacity", async () => {
  test.setTimeout(900_000);
  const [pA, pB, pW] = await Promise.all([mkParent("a"), mkParent("b"), mkParent("w")]);
  const op = await mkOp();
  const lid = await mkListing(op, `CN19 ${stamp}`, 6);
  const blk0 = await blockOf(op, lid);
  const d3 = blk0.dates.slice(0, 3);
  let b1 = ""; let b2 = "";
  await check("A operator cancels one of two children", async () => {
    const r = await book(pA, lid, blk0.id, d3, [`A1${stamp}`, `A2${stamp}`]);
    eq(r.status, 201, "book " + r.text.slice(0, 200)); eq(r.json.bookings.length, 1, "one booking");
    b1 = r.json.bookings[0].ref;
    const before = await blockOf(op, lid); const spB = await publicSpots(pB, lid);
    eq(before.booked, 2, "bookedCount after booking"); eq(before.days.slice(0, 3), [2, 2, 2], "dayCounts");
    const c = await call(op, "POST", `/api/bookings/${b1}/actions`, { type: "cancel-child", ki: 0 });
    eq(c.status, 200, "cancel-child " + c.text.slice(0, 200));
    const after = await blockOf(op, lid); const spA = await publicSpots(pB, lid);
    eq(after.booked, 1, "bookedCount"); eq(after.days.slice(0, 3), [1, 1, 1], "dayCounts");
    const st = (await ok(op, "GET", `/api/bookings/${b1}`)).status; eq(st, "Confirmed", "booking status");
    const again = await call(op, "POST", `/api/bookings/${b1}/actions`, { type: "cancel-child", ki: 0 });
    const twice = await blockOf(op, lid); eq(twice.booked, 1, "after 2nd cancel (no double free)"); eq(twice.days.slice(0, 3), [1, 1, 1], "dayCounts after 2nd");
    return `booked ${before.booked}->${after.booked}, days ${before.days.slice(0, 3)}->${after.days.slice(0, 3)}, public ${spB} -> ${spA}; 2nd cancel status ${again.status}, no change`;
  });
  await check("A2 last child cancel frees the remainder only", async () => {
    const c = await call(op, "POST", `/api/bookings/${b1}/actions`, { type: "cancel-child", ki: 1 });
    eq(c.status, 200, "cancel last " + c.text.slice(0, 200));
    const after = await blockOf(op, lid); eq(after.booked, 0, "bookedCount"); eq(after.days.slice(0, 3), [0, 0, 0], "dayCounts");
    return `status ${(await ok(op, "GET", `/api/bookings/${b1}`)).status}, booked 0, days 0,0,0`;
  });
  await check("B parent cancels one of two children", async () => {
    const r = await book(pB, lid, blk0.id, d3, [`B1${stamp}`, `B2${stamp}`]);
    eq(r.status, 201, "book " + r.text.slice(0, 200)); b2 = r.json.bookings[0].ref;
    const before = await blockOf(op, lid); eq(before.booked, 2, "booked"); const sp0 = await publicSpots(pA, lid);
    const mine = (await ok<any[]>(pB, "GET", "/api/my/bookings")).find((x) => x.ref === b2);
    const kids = mine.kids as any[]; const k0 = kids[0];
    const c = await call(pB, "POST", `/api/my/bookings/${b2}/cancel`, { kids: [{ name: k0.name, ...(k0.childId ? { childId: k0.childId } : {}), days: d3 }], resolution: "wallet" });
    eq(c.status, 200, "parent cancel-child " + c.text.slice(0, 300));
    const after = await blockOf(op, lid); const sp1 = await publicSpots(pA, lid);
    eq(after.booked, 1, "bookedCount"); eq(after.days.slice(0, 3), [1, 1, 1], "dayCounts");
    const again = await call(pB, "POST", `/api/my/bookings/${b2}/cancel`, { kids: [{ name: k0.name, ...(k0.childId ? { childId: k0.childId } : {}), days: d3 }], resolution: "wallet" });
    const twice = await blockOf(op, lid); eq(twice.booked, 1, "after repeat (no double free)"); eq(twice.days.slice(0, 3), [1, 1, 1], "dayCounts after repeat");
    return `booked 2->1, days 2,2,2->1,1,1, public ${sp0} -> ${sp1}; repeat status ${again.status} no change`;
  });
  await check("C waitlisted booking is offered the freed place", async () => {
    const lid2 = await mkListing(op, `CN19 wl ${stamp}`, 2);
    const bl = await blockOf(op, lid2); const dd = bl.dates.slice(0, 3);
    const full = await book(pA, lid2, bl.id, dd, [`F1${stamp}`, `F2${stamp}`]);
    eq(full.status, 201, "fill " + full.text.slice(0, 200)); const fref = full.json.bookings[0].ref;
    const w = await book(pW, lid2, bl.id, dd, [`W1${stamp}`]);
    eq(w.status, 201, "waitlist book " + w.text.slice(0, 200)); eq(w.json.bookings[0].status, "Waitlisted", "waitlisted");
    const wref = w.json.bookings[0].ref;
    await call(op, "POST", `/api/bookings/${fref}/actions`, { type: "cancel-child", ki: 0 });
    let st = ""; for (let i = 0; i < 20; i++) { st = (await ok(op, "GET", `/api/bookings/${wref}`)).status; if (st !== "Waitlisted") break; await new Promise((r) => setTimeout(r, 500)); }
    eq(st, "Offered", "waitlisted status after freeing one place");
    const after = await blockOf(op, lid2); eq(after.booked, 2, "freed place now held by the offer");
    return `waitlist ${wref} -> ${st}; block booked ${after.booked}/2`;
  });
  console.log("SUMMARY", JSON.stringify(RES));
});
