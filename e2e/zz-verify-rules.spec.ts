import { test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { ROOT, API_URL } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, apiPost, fbSignIn, fbSignUp } from "./helpers/accounts";

// API-only verification of the new pass-booking rules + regression of normal bookings.
// Run (private API on :4011, no web):
//   NEXT_PUBLIC_API_URL=http://localhost:4011 npx playwright test -c e2e/zz-verify-rules.config.ts

test.describe.configure({ mode: "serial" });
const stamp = Date.now().toString(36);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const MON1 = (() => { const d = new Date(); d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7)); return d; })();

type Acct = { email: string; uid: string; tenantId?: string; name?: string; token: () => Promise<string> };
const tok = (email: string) => async () => (await fbSignIn(email)).idToken;
async function call(a: Acct | null, method: string, p: string, body?: unknown) {
  const r = await fetch(`${API_URL}${p}`, { method, headers: { "Content-Type": "application/json", ...(a ? { Authorization: `Bearer ${await a.token()}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: r.status, json, text };
}
async function ok<T = any>(a: Acct | null, method: string, p: string, body?: unknown): Promise<T> {
  const r = await call(a, method, p, body);
  if (r.status >= 300) throw new Error(`${method} ${p} -> ${r.status} ${r.text.slice(0, 300)}`);
  return r.json as T;
}
async function mkParent(tag: string): Promise<Acct> {
  const email = `e2e-vr-${tag}-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  await apiPost("/api/register-role", s.idToken, { role: "parent", postcode: "NN5 7EA" });
  await apiPost("/api/me/welcome", s.idToken, {});
  return { email, uid: s.uid, token: tok(email) };
}
const unwall = (t: string) => execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", t], { stdio: "pipe" });
async function mkOp(tag: string): Promise<Acct> {
  const email = `e2e-vr-${tag}-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  const name = `VR ${tag} ${stamp}`;
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role: "company", businessName: name, providerName: name, providerNameMode: "business" });
  unwall(r.tenantId);
  return { email, uid: s.uid, tenantId: r.tenantId, name, token: tok(email) };
}

const VENUE = "vr-venue";
async function ensureVenue(a: Acct) {
  const lib = ((await ok(a, "GET", "/api/library")) ?? {}) as any;
  await ok(a, "PUT", "/api/library", { venues: (lib.venues ?? []).some((v: any) => v.id === VENUE) ? lib.venues : [...(lib.venues ?? []), { id: VENUE, name: "VR Hall", address: "1 Test Way", city: "Northampton" }], settings: { ...(lib.settings ?? {}), marketplaceListed: true, providerName: a.name } });
}
interface L { id: string; title: string; blocks: { id: string; startDate: string; sessions: { date: string }[] }[]; dates: string[] }
type PassDef = [string, number, number];
async function mkWeekly(a: Acct, title: string, o: { passes?: PassDef[]; max?: number; waitlist?: boolean; extra?: Record<string, unknown>; weeks?: number; custom?: number } = {}): Promise<L> {
  await ensureVenue(a);
  const period = await ok(a, "POST", "/api/periods", { title: "Full day", start: "09:00", finish: "15:30" });
  const defs: PassDef[] = o.passes ?? [["1 day", 1, 20], ["3 days", 3, 54], ["5 days", 5, 90]];
  const passIds: string[] = []; const passFlat: Record<string, number> = {}, passMode: Record<string, string> = {};
  for (const [name, days] of defs) { const p = await ok(a, "POST", "/api/passes", { name, days }); passIds.push(p.id); passFlat[p.id] = defs.find((d) => d[0] === name)![2]; passMode[p.id] = "flat"; }
  const bundle = await ok(a, "POST", "/api/block-bundles", { name: `VR ${title}`, periodIds: [period.id], passIds, priced: true, masterPrice: Math.max(...defs.map((d) => d[2])), calcOn: true, passFlat, passMode });
  const weeks = o.weeks ?? 3;
  const base = o.custom
    ? { runFrom: iso(addDays(MON1, 0)), runTo: iso(addDays(MON1, o.custom - 1)), blockMode: "custom", days: [0, 1, 2, 3, 4, 5, 6] }
    : { runFrom: iso(MON1), runTo: iso(addDays(MON1, weeks * 7 - 3)), blockMode: "weekly", days: [1, 2, 3, 4, 5] };
  const l = await ok(a, "POST", "/api/listings", {
    title, venueId: VENUE, ...base, maxAttendees: String(o.max ?? 10), capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id,
    passes: defs.map(([name, days, price]) => ({ name, price, days })), bookingType: "auto", waitlist: o.waitlist ?? true, ...(o.waitlist === false ? {} : { waitlistMode: "manual" }), status: "live", visibility: "public", ...(o.extra ?? {}),
  });
  await ok(a, "PUT", `/api/block-bundles/${bundle.id}/listings`, { listingIds: [l.id] });
  return refresh(a, l.id, title);
}
async function refresh(a: Acct, id: string, title = ""): Promise<L> {
  const full = await ok(a, "GET", `/api/listings/${id}`);
  const blocks = ((full.blocks ?? []) as any[]).sort((x, y) => (x.startDate < y.startDate ? -1 : 1));
  const dates = blocks.flatMap((b) => (b.sessions ?? []).map((s: any) => s.date)).sort();
  return { id, title, blocks, dates };
}
/** The 5 (or fewer) dates of week w (Mon-Fri block). */
const wk = (L: L, w: number, n = 5) => L.blocks[w].sessions.map((s) => s.date).sort().slice(0, n);
let kn = 0;
const kid = (t = "K") => `${t}${stamp}x${++kn}`;
const bookBody = (L: L, items: any[], extra: Record<string, unknown> = {}, block = 0) => ({ listingId: L.id, blockId: L.blocks[block].id, method: "card", walletCap: 0, items, ...extra });
const item = (pass: string, child: string, dates?: string[], extra: Record<string, unknown> = {}) => ({ pass, child, age: 8, ...(dates ? { dates } : {}), ...extra });
const post = (a: Acct, L: L, items: any[], extra: Record<string, unknown> = {}, block = 0) => call(a, "POST", "/api/my/bookings", bookBody(L, items, extra, block));
const sum = (r: { json: any }) => Math.round(((r.json?.bookings ?? []) as any[]).reduce((s, b) => s + (b.amount ?? 0), 0) * 100) / 100;

const RES: [string, "PASS" | "FAIL", string][] = [];
async function check(id: string, fn: () => Promise<string>) {
  try { const n = await fn(); RES.push([id, "PASS", n]); console.log(`RESULT ${id} PASS :: ${n}`); } catch (e) {
    const m = String((e as Error).message).slice(0, 700); RES.push([id, "FAIL", m]); console.log(`RESULT ${id} FAIL :: ${m}`);
  }
}
const eq = (a: unknown, b: unknown, msg: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };
const must = (c: unknown, msg: string) => { if (!c) throw new Error(msg); };
const st = (r: { status: number; text: string }) => `${r.status} ${r.text.slice(0, 160)}`;

test("verify pass-booking rules", async () => {
  test.setTimeout(1_800_000);
  const [pA, pB, pC] = await Promise.all([mkParent("a"), mkParent("b"), mkParent("c")]);
  const op = await mkOp("op");
  await ok(op, "PUT", "/api/library", { settings: { ...(((await ok(op, "GET", "/api/library")) ?? {}).settings ?? {}), marketplaceListed: true, providerName: op.name, allowDateChanges: true, amendSelfService: true } }).catch(() => {});
  console.log("ACCOUNTS", JSON.stringify({ pA: pA.email, pB: pB.email, pC: pC.email, op: op.email, tenant: op.tenantId }));

  // ---------------------------------------------------------------- REGRESSION
  const W = await mkWeekly(op, `VR weekly ${stamp}`);
  let r1ref = "";
  await check("R1 1-day pass", async () => {
    const r = await post(pA, W, [item("1 day", kid("r1"), [wk(W, 0)[0]])]);
    eq(r.status, 201, "status " + st(r)); eq(sum(r), 20, "amount"); r1ref = r.json.bookings[0].ref;
    return `201, ${r.json.bookings.length} booking(s), £${sum(r)}, status ${r.json.bookings[0].status}`;
  });
  await check("R2 3-day pass on 3 dates", async () => {
    const r = await post(pA, W, [item("3 days", kid("r2"), wk(W, 0, 3))]);
    eq(r.status, 201, st(r)); eq(sum(r), 54, "amount"); return `201 £${sum(r)} ${r.json.bookings[0].status}`;
  });
  await check("R3 5-day pass full week", async () => {
    const r = await post(pA, W, [item("5 days", kid("r3"), wk(W, 1))], {}, 1);
    eq(r.status, 201, st(r)); eq(sum(r), 90, "amount"); return `201 £${sum(r)} ${r.json.bookings[0].status}`;
  });
  await check("R4 two children same week (sibling discount)", async () => {
    const S = await mkWeekly(op, `VR sibling ${stamp}`, { extra: { discounts: [{ id: "rsib", kind: "person", name: "", passNames: [], enabled: true, moreThan: 1, appliesTo: "all", method: "subtract", value: 5, beforeDate: "" }] } });
    const r = await post(pB, S, [item("3 days", kid("sa"), wk(S, 0, 3)), item("3 days", kid("sb"), wk(S, 0, 3))]);
    eq(r.status, 201, st(r)); eq(sum(r), 98, "2x54 = 108 less sibling discount 10 = 98");
    const nobase = await post(pB, await mkWeekly(op, `VR nosib ${stamp}`), [item("3 days", kid("sc"), [])].map((i) => ({ ...i, dates: undefined })));
    return `201 total £${sum(r)} (108 -> 98), ${r.json.bookings.length} booking(s)`;
  });
  await check("R5 basket across 2 weeks (2 calls)", async () => {
    const k = kid("r5");
    const a = await post(pB, W, [item("5 days", k, wk(W, 0))], {}, 0);
    const b = await post(pB, W, [item("5 days", k, wk(W, 1))], {}, 1);
    eq(a.status, 201, st(a)); eq(b.status, 201, st(b)); eq(sum(a), 90, "a"); eq(sum(b), 90, "b");
    const one = await post(pC, W, [item("5 days", kid("r5b"), wk(W, 0)), item("5 days", kid("r5b"), wk(W, 1))]);
    eq(one.status, 201, "single call two weeks " + st(one));
    return `2 calls: 201/201 £${sum(a)}+£${sum(b)}; single call two-week basket: 201 with ${one.json.bookings.length} booking(s) £${sum(one)}`;
  });
  await check("R6 operator on-behalf (exempt from parent rules)", async () => {
    const fam = { email: pC.email, name: "VR Family" };
    const two = await post(op, W, [item("3 days", kid("r6"), wk(W, 2, 2))], { method: "cash", onBehalfOf: fam }, 2);
    eq(two.status, 201, "3-day on 2 dates by operator " + st(two));
    // closed pass on behalf
    await ok(op, "PUT", `/api/listings/${W.id}`, { ticketOverrides: { "1 day": { capacity: "0" } } });
    const closed = await post(op, W, [item("1 day", kid("r6c"), [wk(W, 2)[4]])], { method: "cash", onBehalfOf: fam }, 2);
    eq(closed.status, 201, "closed pass on behalf " + st(closed));
    await ok(op, "PUT", `/api/listings/${W.id}`, { ticketOverrides: {} });
    return `3 days on 2 dates -> 201 £${sum(two)}; closed 1-day on behalf -> 201 £${sum(closed)}`;
  });
  await check("R7 discount code", async () => {
    const code = `VR10${stamp}`.toUpperCase().slice(0, 14);
    await ok(op, "POST", "/api/discounts", { active: true, code, type: "percent", value: 10 });
    const r = await post(pC, W, [item("5 days", kid("r7"), wk(W, 1))], { discountCodes: [code] }, 1);
    eq(r.status, 201, st(r)); eq(sum(r), 81, "90 - 10%"); return `201 £${sum(r)} codes ${JSON.stringify(r.json.bookings[0].discountCodes)}`;
  });
  await check("R8 waitlist when day capacity full", async () => {
    const F = await mkWeekly(op, `VR dayfull ${stamp}`, { max: 1 });
    const d = wk(F, 0)[0];
    const a = await post(pA, F, [item("1 day", kid("w1"), [d])]);
    const b = await post(pB, F, [item("1 day", kid("w2"), [d])]);
    eq(a.status, 201, st(a)); eq(b.status, 201, st(b));
    eq(a.json.bookings[0].status, "Confirmed", "first"); eq(b.json.bookings[0].status, "Waitlisted", "second");
    return `first ${a.json.bookings[0].status}, second ${b.json.bookings[0].status} (201)`;
  });
  await check("R9 quick-book style (no dates in body)", async () => {
    const r1 = await post(pB, W, [item("1 day", kid("q1"))], {}, 0);
    const r3 = await post(pB, W, [item("3 days", kid("q3"))], {}, 0);
    eq(r1.status, 201, st(r1)); eq(r3.status, 201, st(r3));
    return `1-day dateless 201 £${sum(r1)} days ${JSON.stringify(r1.json.bookings[0].days)}; 3-day dateless 201 £${sum(r3)} days ${JSON.stringify(r3.json.bookings[0].days)}`;
  });
  await check("R10 amend + cancel still work", async () => {
    const mine = await ok<any[]>(pA, "GET", "/api/my/bookings");
    const b = mine.find((x) => x.ref === r1ref); must(b, "booking in my list");
    const from = b.days?.[0] ?? wk(W, 0)[0]; const to = wk(W, 2)[1];
    const am = await call(pA, "POST", `/api/my/bookings/${r1ref}/amend`, { moves: [{ from, to }] });
    const cx = await call(pA, "POST", `/api/my/bookings/${r1ref}/cancel`, {});
    must(am.status < 500 && cx.status < 500, `amend ${st(am)} / cancel ${st(cx)}`);
    eq(cx.status, 200, "cancel " + st(cx));
    return `amend ${st(am)}; cancel ${cx.status}`;
  });

  // ---------------------------------------------------------------- NEW RULES
  await check("N1 closed pass -> 400", async () => {
    const C = await mkWeekly(op, `VR closed ${stamp}`, { extra: { ticketOverrides: { "3 days": { capacity: "0" } } } });
    const r = await post(pA, C, [item("3 days", kid("n1"), wk(C, 0, 3))]);
    eq(r.status, 400, st(r)); must(/closed/i.test(r.text), "message " + r.text);
    const other = await post(pA, C, [item("1 day", kid("n1b"), [wk(C, 0)[0]])]);
    eq(other.status, 201, "other pass still bookable " + st(other));
    return `400 "${r.json.error}"; other pass 1 day still 201`;
  });
  await check("N2 wrong day count -> 400", async () => {
    const a = await post(pA, W, [item("5 days", kid("n2"), wk(W, 2, 2))], {}, 2);
    const b = await post(pA, W, [item("3 days", kid("n2b"), wk(W, 2, 2))], {}, 2);
    const c = await post(pA, W, [item("3 days", kid("n2c"), wk(W, 2, 4))], {}, 2);
    eq(a.status, 400, "5d on 2 " + st(a)); eq(b.status, 400, "3d on 2 " + st(b)); eq(c.status, 400, "3d on 4 " + st(c));
    return `5d/2 dates 400 "${a.json.error}"; 3d/2 dates 400 "${b.json.error}"; 3d/4 dates 400 "${c.json.error}"`;
  });
  await check("N3 term pass (blocks rule, custom 10-date run)", async () => {
    const T = await mkWeekly(op, `VR term ${stamp}`, { passes: [["10 days", 10, 150]], custom: 10, extra: { bookRules: { "10 days": "blocks" } } });
    eq(T.dates.length, 10, "10 dates " + T.dates.length);
    const five = await post(pA, T, [item("10 days", kid("n3"), T.dates.slice(0, 5))]);
    const nine = await post(pA, T, [item("10 days", kid("n3b"), T.dates.slice(0, 9))]);
    eq(five.status, 400, "5 of 10 " + st(five)); eq(nine.status, 400, "9 of 10 " + st(nine));
    const all = await post(pA, T, [item("10 days", kid("n3c"), T.dates)]);
    eq(all.status, 201, "all " + st(all)); eq(sum(all), 150, "total");
    return `5/10 -> 400 "${five.json.error}"; 9/10 -> 400; all 10 -> 201, ${all.json.bookings.length} booking(s) £${sum(all)}`;
  });
  await check("N4 term pass on weekly 3-week run (15 days across 3 blocks)", async () => {
    const T = await mkWeekly(op, `VR term15 ${stamp}`, { passes: [["15 days", 15, 200], ["5 days", 5, 90]], extra: { bookRules: { "15 days": "blocks", "5 days": "blocks" } } });
    eq(T.dates.length, 15, "15 dates");
    const part = await post(pB, T, [item("15 days", kid("n4"), T.dates.slice(0, 10))]);
    eq(part.status, 400, "10 of 15 " + st(part));
    const all = await post(pB, T, [item("15 days", kid("n4b"), T.dates)]);
    eq(all.status, 201, "all 15 " + st(all)); eq(sum(all), 200, "total");
    const split = await post(pB, T, [item("5 days", kid("n4c"), [...wk(T, 0, 3), ...wk(T, 1).slice(0, 2)])]);
    eq(split.status, 400, "5 days across two weeks " + st(split));
    const okWk = await post(pB, T, [item("5 days", kid("n4d"), wk(T, 1))], {}, 1);
    eq(okWk.status, 201, "5 days in one week " + st(okWk));
    return `10/15 -> 400; all 15 -> 201 as ${all.json.bookings.length} booking(s) £${sum(all)}; 5d across weeks -> 400 "${split.json.error}"; 5d one week 201`;
  });
  let capL: L;
  await check("N5 pass capacity 1 -> waitlist + passFullDates", async () => {
    capL = await mkWeekly(op, `VR passcap ${stamp}`, { extra: { ticketOverrides: { "3 days": { capacity: "1" } } } });
    const d3 = wk(capL, 0, 3);
    const a = await post(pA, capL, [item("3 days", kid("n5"), d3)]);
    eq(a.status, 201, st(a)); eq(a.json.bookings[0].status, "Confirmed", "first");
    const b = await post(pB, capL, [item("3 days", kid("n5b"), d3)]);
    eq(b.status, 201, st(b)); eq(b.json.bookings[0].status, "Waitlisted", "second");
    const other = await post(pC, capL, [item("1 day", kid("n5c"), [d3[0]])]);
    eq(other.json.bookings[0].status, "Confirmed", "different pass not capped");
    const lst = await ok<any[]>(pC, "GET", "/api/listings");
    const mine = lst.find((x) => x.id === capL.id);
    must(mine, "listing present in GET /api/listings");
    eq(mine.passFullDates?.["3 days"], d3, "passFullDates");
    const one = await ok(pC, "GET", `/api/listings/${capL.id}`);
    return `1st Confirmed, 2nd ${b.json.bookings[0].status}; 1-day pass same day ${other.json.bookings[0].status}; GET /api/listings passFullDates ${JSON.stringify(mine.passFullDates)}; GET /api/listings/:id passFullDates ${JSON.stringify(one.passFullDates)}`;
  });
  await check("N6 pass capacity 1, waitlist off -> 409", async () => {
    const C = await mkWeekly(op, `VR passcap409 ${stamp}`, { waitlist: false, extra: { ticketOverrides: { "3 days": { capacity: "1" } }, waitlist: false } });
    const d3 = wk(C, 0, 3);
    const a = await post(pA, C, [item("3 days", kid("n6"), d3)]);
    eq(a.status, 201, st(a));
    const b = await post(pB, C, [item("3 days", kid("n6b"), d3)]);
    eq(b.status, 409, st(b));
    return `second parent 409 "${b.json.error}"`;
  });
  await check("N7 every-booking answers saved on booking", async () => {
    const Q = [{ id: "q-swim", label: "Swim level", type: "choice", options: ["None", "Beginner", "Confident"], scope: "all", ask: "every" }, { id: "q-once", label: "Nickname", type: "text", scope: "all", ask: "once" }];
    await ok(op, "PUT", "/api/library", { childQuestions: Q });
    const k = kid("n7");
    const r = await post(pB, W, [item("1 day", k, [wk(W, 2)[2]], { answers: { "q-swim": "Beginner", "q-once": "Bob", "q-fake": "x" } })], {}, 2);
    eq(r.status, 201, st(r));
    const ref = r.json.bookings[0].ref;
    const ob = await ok(op, "GET", `/api/bookings/${ref}`);
    const mine = (await ok<any[]>(pB, "GET", "/api/my/bookings")).find((x) => x.ref === ref);
    const flat = JSON.stringify(ob.answers ?? []);
    must(flat.includes("Beginner") && flat.includes("Swim level"), "operator booking answers " + flat);
    must(!flat.includes("Bob") && !flat.includes("fake"), "only 'every' questions kept " + flat);
    const kids = await ok<any[]>(pB, "GET", "/api/my/children");
    await new Promise((s) => setTimeout(s, 1500));
    const kids2 = await ok<any[]>(pB, "GET", "/api/my/children");
    return `operator booking.answers ${flat}; parent's my/bookings answers ${JSON.stringify(mine?.answers ?? "(absent)")}; children records ${JSON.stringify(kids2.map((c) => [c.name, c.answers]))}; items[].answers on booking ${JSON.stringify(ob.items?.map?.((i: any) => i.answers))}`;
  });

  // ---------------------------------------------------------------- FRANCHISE
  const ho = await mkOp("ho");
  const frEmail = `e2e-vr-fr-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const fs2 = await fbSignUp(frEmail);
  const inv = await apiPost<{ token: string }>("/api/invites", await ho.token(), { role: "franchise", franchiseName: `VR Fr ${stamp}` });
  await apiPost(`/api/invites/${inv.token}/accept`, fs2.idToken, {});
  const fr: Acct = { email: frEmail, uid: fs2.uid, tenantId: ho.tenantId, name: ho.name, token: tok(frEmail) };
  const pF = await mkParent("f"), pF2 = await mkParent("f2"), pH = await mkParent("h");
  const FL = await mkWeekly(fr, `VR fr listing ${stamp}`);
  const HL = await mkWeekly(ho, `VR ho listing ${stamp}`);
  const frQ = [{ id: "q-fr", label: "FR only question", type: "text", scope: "all", ask: "once" }];
  await check("F0 franchise setup (library, listing owned by franchise)", async () => {
    const frLib = ((await ok(fr, "GET", "/api/library")) ?? {}) as any;
    await ok(fr, "PUT", "/api/library", { childQuestions: frQ, settings: { ...(frLib.settings ?? {}), marketplaceListed: true, requireDob: true,
      memberships: { enabled: true, tiers: [{ id: "frgold", name: "FR Gold", enabled: true, priceMonthly: 30, benefitType: "credit", benefitValue: 40 }] },
      referral: { enabled: true, type: "percent", friendOff: 10, referrerReward: 50, minSpend: 0, capToFriendSpend: true } } });
    const doc = await ok(fr, "GET", `/api/listings/${FL.id}`);
    must(doc.franchiseId, "listing has franchiseId " + JSON.stringify(doc.franchiseId));
    return `franchiseId ${doc.franchiseId}`;
  });
  await check("F1 franchise family: membership tier joinable", async () => {
    const b = await post(pF, FL, [item("1 day", kid("f1"), [wk(FL, 0)[0]])]);
    eq(b.status, 201, st(b));
    const m = await ok(pF, "GET", `/api/my/memberships?tenantId=${ho.tenantId}`);
    must(m.enabled && m.tiers?.some((t: any) => t.id === "frgold"), "franchise tier shown " + JSON.stringify(m));
    const j = await call(pF, "POST", "/api/my/memberships/join", { tenantId: ho.tenantId, tierId: "frgold" });
    eq(j.status, 200, "join " + st(j));
    const w = await ok(pF, "GET", "/api/my/wallet");
    // HO family sees nothing (HO has no memberships)
    await post(pH, HL, [item("1 day", kid("h1"), [wk(HL, 0)[0]])]);
    const mh = await ok(pH, "GET", `/api/my/memberships?tenantId=${ho.tenantId}`);
    return `franchise family sees ${JSON.stringify(m.tiers.map((t: any) => t.id))} and joined (200); wallet ${JSON.stringify(w.balances?.map((x: any) => x.balance))}; HO family memberships enabled=${mh.enabled}`;
  });
  await check("F2 franchise family: referral enabled", async () => {
    const r = await ok(pF, "GET", "/api/my/referral");
    must(r.enabled && r.code, "enabled for franchise family " + JSON.stringify(r));
    const rh = await ok(pH, "GET", "/api/my/referral");
    return `franchise family: enabled ${r.enabled} type ${r.type} code ${r.code}; HO family enabled=${rh.enabled}`;
  });
  await check("F3 public library ?listingId= returns franchise settings", async () => {
    const withL = await call(null, "GET", `/api/public/library/${ho.tenantId}?listingId=${FL.id}`);
    const without = await call(null, "GET", `/api/public/library/${ho.tenantId}`);
    eq(withL.status, 200, st(withL));
    eq(withL.json.childQuestions?.[0]?.id, "q-fr", "franchise childQuestions with listingId");
    must(JSON.stringify(without.json.childQuestions ?? null).indexOf("q-fr") < 0, "HO view must not show franchise question: " + JSON.stringify(without.json));
    return `with listingId: childQuestions ${JSON.stringify(withL.json.childQuestions?.map((q: any) => q.id))} requireDob=${withL.json.settings?.requireDob} referral=${JSON.stringify(withL.json.settings?.referral)}; without: ${JSON.stringify(without.json.childQuestions)}`;
  });
  await check("F4 referral reward cap = what friend paid", async () => {
    const ref = await ok(pF, "GET", "/api/my/referral");
    const r = await post(pF2, FL, [item("5 days", kid("f4"), wk(FL, 1))], { discountCodes: [ref.code] }, 1);
    eq(r.status, 201, st(r));
    const paid = sum(r);
    let row: any = null; let dash: any = null;
    for (let i = 0; i < 25 && !row; i++) {
      await new Promise((x) => setTimeout(x, 1000));
      dash = await ok(fr, "GET", "/api/referrals");
      row = (dash.recent ?? []).find((q: any) => JSON.stringify(q).toLowerCase().includes(pF2.email.toLowerCase()) || q.bookingRef === r.json.bookings[0].ref);
    }
    must(row, "referral row recorded: " + JSON.stringify(dash).slice(0, 400));
    eq(row.friendSpend, paid, "friendSpend = what friend paid");
    eq(row.cap, paid, "reward cap = what friend paid");
    return `friend paid £${paid} (90 less 10% code); referral row ${JSON.stringify(row)}`;
  });

  console.log("\n===== SUMMARY =====");
  for (const [id, s, n] of RES) console.log(`${s}\t${id}\t${n}`);
});

test("age caps (LT-023) + franchise season (LT-029)", async () => {
  test.setTimeout(900_000);
  const [pA, pB, pC, pD] = await Promise.all([mkParent("ag-a"), mkParent("ag-b"), mkParent("ag-c"), mkParent("ag-d")]);
  const ho = await mkOp("ag-ho");
  const lib0 = ((await ok(ho, "GET", "/api/library")) ?? {}) as any;
  const groups = [{ id: "g58", name: "Age 5-8", colour: "#111111", ageFrom: 5, ageTo: 8, targetRatio: 8, maxSize: 32 }, { id: "g912", name: "Age 9-12", colour: "#222222", ageFrom: 9, ageTo: 12, targetRatio: 8, maxSize: 32 }];
  await ok(ho, "PUT", "/api/library", { settings: { ...(lib0.settings ?? {}), ratioGroups: groups } });
  const res: [string, "PASS" | "FAIL", string][] = [];
  const chk = async (id: string, fn: () => Promise<string>) => { try { const n = await fn(); res.push([id, "PASS", n]); console.log(`RESULT ${id} PASS :: ${n}`); } catch (e) { const m = String((e as Error).message).slice(0, 600); res.push([id, "FAIL", m]); console.log(`RESULT ${id} FAIL :: ${m}`); } };
  const aged = (pass: string, child: string, dates: string[], age: number) => ({ pass, child, age, dates });
  await chk("LT-023a age cap 1 on 5-8 (HO): 2nd 7-year-old waitlisted", async () => {
    const A = await mkWeekly(ho, `VR agecap ${stamp}`, { extra: { ageCapsOn: true, ageCaps: { g58: 1, g912: 5 } } });
    const d = wk(A, 0)[0];
    const a = await post(pA, A, [aged("1 day", kid("ag1"), [d], 7)]);
    const b = await post(pB, A, [aged("1 day", kid("ag2"), [d], 7)]);
    const c = await post(pC, A, [aged("1 day", kid("ag3"), [d], 10)]);
    eq(a.status, 201, st(a)); eq(a.json.bookings[0].status, "Confirmed", "first 7yo");
    eq(b.status, 201, st(b)); eq(b.json.bookings[0].status, "Waitlisted", "second 7yo");
    eq(c.json.bookings[0].status, "Confirmed", "10yo in other group");
    return `1st 7yo ${a.json.bookings[0].status}, 2nd 7yo ${b.json.bookings[0].status}, 10yo ${c.json.bookings[0].status}`;
  });
  await chk("LT-023b age cap, waitlist off -> 409", async () => {
    const A = await mkWeekly(ho, `VR agecap409 ${stamp}`, { waitlist: false, extra: { waitlist: false, ageCapsOn: true, ageCaps: { g58: 1 } } });
    const d = wk(A, 0)[0];
    const a = await post(pA, A, [aged("1 day", kid("ag4"), [d], 6)]);
    const b = await post(pB, A, [aged("1 day", kid("ag5"), [d], 7)]);
    eq(a.status, 201, st(a)); eq(b.status, 409, st(b));
    return `first 201 ${a.json.bookings[0].status}; second 409 "${b.json.error}"`;
  });
  // franchise
  const frEmail = `e2e-vr-agfr-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const fs2 = await fbSignUp(frEmail);
  const inv = await apiPost<{ token: string }>("/api/invites", await ho.token(), { role: "franchise", franchiseName: `VR AgFr ${stamp}` });
  await apiPost(`/api/invites/${inv.token}/accept`, fs2.idToken, {});
  const fr: Acct = { email: frEmail, uid: fs2.uid, tenantId: ho.tenantId, name: ho.name, token: tok(frEmail) };
  const frLib = ((await ok(fr, "GET", "/api/library")) ?? {}) as any;
  await ok(fr, "PUT", "/api/library", { settings: { ...(frLib.settings ?? {}), marketplaceListed: true, ratioGroups: [{ id: "fr58", name: "Franchise 5-8", colour: "#333333", ageFrom: 5, ageTo: 8, targetRatio: 8, maxSize: 32 }], seasons: [{ id: "frs1", name: `Franchise Autumn ${stamp}` }] } });
  await chk("LT-023c age cap uses franchise's own age groups", async () => {
    const A = await mkWeekly(fr, `VR agecapfr ${stamp}`, { extra: { ageCapsOn: true, ageCaps: { fr58: 1 }, seasonId: "frs1" } });
    const d = wk(A, 0)[0];
    const a = await post(pA, A, [aged("1 day", kid("ag6"), [d], 7)]);
    const b = await post(pB, A, [aged("1 day", kid("ag7"), [d], 7)]);
    eq(a.json.bookings[0].status, "Confirmed", "first"); eq(b.json.bookings[0].status, "Waitlisted", "second");
    (globalThis as any).__frListing = A;
    return `franchise listing: 1st ${a.json.bookings[0].status}, 2nd ${b.json.bookings[0].status}`;
  });
  await chk("LT-029 franchise listing season/venue on GET /api/listings", async () => {
    const A: L = (globalThis as any).__frListing; must(A, "franchise listing exists");
    const lst = await ok<any[]>(pD, "GET", `/api/listings?tenantId=${ho.tenantId}`);
    const mine = lst.find((x) => x.id === A.id); must(mine, "listing present");
    eq(mine.season, `Franchise Autumn ${stamp}`, "season");
    return `season ${JSON.stringify(mine.season)} venue ${JSON.stringify(mine.venue)}`;
  });
  console.log("\n===== SUMMARY2 =====");
  for (const [id, s, n] of res) console.log(`${s}\t${id}\t${n}`);
});
