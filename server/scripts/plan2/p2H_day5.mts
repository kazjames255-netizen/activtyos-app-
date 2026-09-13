// Plan-2 Day 5 — franchise isolation on the routes the isolation work never
// reached (p2-f1 … p2-f17). Throwaway company tenant + two franchises + staff +
// parents, all deleted at the end. Results → /tmp/p2h_day5.json
import fs from "node:fs";
import { api, db, mkTenant, mkFranchise, mkStaff, mkParent, mkPlatform, setSettings, cleanup, start, stop, created, log, ymd, daysFromNow, type Actor } from "./p2H_harness.mts";

const results: Record<string, { verdict: "pass" | "fail" | "blocked"; actual: string; notes?: string }> = {};
const mailLog: string[] = [];
const origLog = console.log;
console.log = (...a: unknown[]) => { const s = a.map(String).join(" "); if (s.startsWith("[mail]") || s.startsWith("[dsl]")) mailLog.push(s); origLog(...a); };
const step = async (id: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { results[id] = { verdict: "blocked", actual: `script error: ${(e as Error).message}` }; origLog(`  !! ${id} threw`, e); } origLog(`[${id}] ${results[id]?.verdict} — ${results[id]?.actual}`); };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const bells = async (toEmail: string) => (await db.collection("notifications").where("toEmail", "==", toEmail.toLowerCase()).get()).docs.map((d) => d.data());

await start();
const C = await mkTenant("company", "P2H Head Office");
const HO = C.owner; const T = C.tenantId;
const F1 = await mkFranchise(T, "P2H Franchise One");
const F2 = await mkFranchise(T, "P2H Franchise Two");
const S1 = await mkStaff(T, { franchiseId: F1.franchiseId, name: "Fone Coach", staffRole: "Coach", jobTitle: "Coach" });
const S2 = await mkStaff(T, { franchiseId: F2.franchiseId, name: "Ftwo Coach", staffRole: "Coach", jobTitle: "Coach" });
const SH = await mkStaff(T, { franchiseId: null, name: "Ho Coach", staffRole: "Coach", jobTitle: "Coach" });
const DSL1 = await mkStaff(T, { franchiseId: F1.franchiseId, name: "Fone Dsl", staffRole: "Lead", lead: true });
const DSLH = await mkStaff(T, { franchiseId: null, name: "Ho Dsl", staffRole: "Lead", lead: true });
const P1 = await mkParent("Parent One"); const P2 = await mkParent("Parent Two");
const HQ = await mkPlatform();
origLog("world", { T, F1: F1.franchiseId, F2: F2.franchiseId });

// ── Seed: a listing + block per owner (HO, F1, F2) and a booking each ─────
async function listingAndBlock(actor: Actor, title: string) {
  const l = await api(actor, "POST", "/api/listings", { title, passes: [{ name: "Day", price: 10 }] });
  if (l.status !== 201) throw new Error(`listing ${l.status} ${l.text}`);
  const b = await api(actor, "POST", "/api/blocks", { listingId: l.json.id, name: `${title} wk1`, startDate: ymd(daysFromNow(30)), endDate: ymd(daysFromNow(34)), capacity: 10, schedule: { startTime: "09:00", endTime: "15:30" } });
  if (b.status !== 201) throw new Error(`block ${b.status} ${b.text}`);
  return { listingId: l.json.id as string, blockId: b.json.id as string, title };
}
const LH = await listingAndBlock(HO, "P2H HO Camp");
const L1 = await listingAndBlock(F1.actor, "P2H F1 Camp");
const L2 = await listingAndBlock(F2.actor, "P2H F2 Camp");
async function book(actor: Actor, L: { listingId: string; blockId: string; title: string }, parent: Actor, child: string, amount: number) {
  const r = await api(actor, "POST", "/api/bookings", { booker: parent.name, email: parent.email, child, age: 7, listing: L.title, pass: "Day", blockId: L.blockId, amount, method: "Bank transfer" });
  if (r.status !== 201) throw new Error(`booking ${r.status} ${r.text}`);
  return r.json as { ref: string; franchiseId?: string };
}
const BH = await book(HO, LH, await mkParent("Parent HO"), "Kid H", 40);
const B1a = await book(F1.actor, L1, P1, "Kid One", 30);
const B1b = await book(F1.actor, L1, P1, "Kid OneB", 20);
const B2 = await book(F2.actor, L2, P2, "Kid Two", 50);
origLog("bookings", { BH: BH.ref, B1a: B1a.ref, B1b: B1b.ref, B2: B2.ref, fr1: B1a.franchiseId, fr2: B2.franchiseId });

// ── p2-f1: the unscoped-route sweep ─────────────────────────────────────
const foreignIds: Record<string, string> = {}; // route → an HO-owned id (for f2)
await step("p2-f1", async () => {
  const ttBody = (name: string) => ({ name, dateFrom: ymd(daysFromNow(30)), dateTo: ymd(daysFromNow(34)), config: { start: "09:00", end: "15:30", perDay: 4, breaks: 1, lunch: "12:00", signin: ["08:30"], signout: ["15:30"], wholeTimes: [], groups: ["A"] }, dayList: [], plan: [] });
  const review = (id: string, name: string) => ({ id, staffId: name.toLowerCase().replace(/\s+/g, "-"), name, kind: "annual", due: ymd(daysFromNow(10)), status: "scheduled", self: { done: false, ratings: [] }, manager: { ratings: [] }, goals: [], signoff: {}, createdAt: new Date().toISOString() });
  // Create one row as HO and one as F2 on every route.
  const mk = async (who: Actor, tag: string, holder: Record<string, string>) => {
    const put = async (route: string, r: { status: number; json: any }, idKey = "id") => { if (r.status >= 300) origLog(`  seed ${route} as ${tag}: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`); else if (r.json?.[idKey]) holder[route] = r.json[idKey]; };
    await put("/api/block-bundles", await api(who, "POST", "/api/block-bundles", { name: `${tag} bundle` }));
    await put("/api/inventory", await api(who, "POST", "/api/inventory", { name: `${tag} cones`, quantity: 5, season: "S1" }));
    await put("/api/meal-menus", await api(who, "POST", "/api/meal-menus", { name: `${tag} menu`, items: [] }));
    await put("/api/suppliers", await api(who, "POST", "/api/suppliers", { name: `${tag} supplier` }));
    await put("/api/timetables", await api(who, "POST", "/api/timetables", ttBody(`${tag} tt`)));
    await put("/api/calendar-events", await api(who, "POST", "/api/calendar-events", { title: `${tag} inset`, date: ymd(daysFromNow(5)) }));
    await put("/api/discounts/groups", await api(who, "POST", "/api/discounts/groups", { name: `${tag} group`, emails: [] }));
    await put("/api/discounts/auto", await api(who, "POST", "/api/discounts/auto", { kind: "person", from: 2, mode: "pct", value: 10 }));
    await put("/api/leave", await api(who, "POST", "/api/leave/absences", { name: `${tag} Person`, kind: "annual", start: ymd(daysFromNow(40)), end: ymd(daysFromNow(40)), days: 1 }));
    await api(who, "PUT", `/api/appraisals/reviews/${tag}-rev`, review(`${tag}-rev`, `${tag} Person`));
    await api(who, "PUT", `/api/credentials/records/${tag}-cred`, { staff: `${tag} Person`, typeId: "dbs", verified: "verified", expiry: ymd(daysFromNow(400)) });
    await api(who, "PUT", `/api/onboarding/records/${encodeURIComponent(`${tag} Person`)}`, { values: { ni: { v: "QQ123456C" } }, extra: [] });
    await put("/api/payroll", await api(who, "POST", "/api/payroll/runs", { period: "2026-08", paidOn: "2026-08-28", lines: [{ id: `${tag}-person`, name: `${tag} Person`, grossM: 100, netM: 90 }] }));
    await api(who, "POST", "/api/timeclock/event", { kind: "in", day: ymd(new Date()), name: `${tag} Person` });
    await put("/api/expense-claims", await api(who, "POST", "/api/expense-claims", { date: ymd(new Date()), category: "Equipment", amount: 12.5 }));
    await api(who, "PUT", "/api/location-staff", { staff: [{ id: `${tag}-p`, name: `${tag} Person`, sites: [], listings: [] }] });
    await api(who, "PUT", "/api/learning/assignments", { assignments: [{ course: `${tag}-course`, title: `${tag} course` }] });
    await put("/api/staff-announcements", await api(who, "POST", "/api/staff-announcements", { title: `${tag} notice`, body: "hello" }));
  };
  const hoIds: Record<string, string> = {}; const f2Ids: Record<string, string> = {};
  await mk(HO, "HO", hoIds); await mk(F2.actor, "F2", f2Ids);
  Object.assign(foreignIds, hoIds);
  // Posts: HO network-wide (legitimately visible to F1) + HO targeted at F2 + F2's own.
  const pHoNet = await api(HO, "POST", "/api/posts", { body: "HO network post" });
  const pHoF2 = await api(HO, "POST", "/api/posts", { body: "HO post for F2 only", franchiseId: F2.franchiseId });
  const pF2 = await api(F2.actor, "POST", "/api/posts", { body: "F2's own post" });
  foreignIds["/api/posts"] = pHoF2.json?.id;
  // Memberships / reviews / referrals rows are written by parent flows; seed the docs directly.
  const now = new Date().toISOString();
  await db.collection("memberships").add({ tenantId: T, email: "ho-member@p2h.test", status: "active", tierId: "credit", tierName: "Credit", benefitType: "credit", benefitValue: 50, priceMonthly: 10, startedAt: now, renewsAt: now });
  await db.collection("memberships").add({ tenantId: T, email: P2.email, status: "active", tierId: "credit", tierName: "Credit", benefitType: "credit", benefitValue: 50, priceMonthly: 10, startedAt: now, renewsAt: now, franchiseId: F2.franchiseId });
  await db.collection("feedback").add({ tenantId: T, rating: 5, comment: "HO review", name: "HO Fam", email: "ho-member@p2h.test", listing: LH.title, createdAt: now });
  await db.collection("feedback").add({ tenantId: T, rating: 4, comment: "F2 review", name: P2.name, email: P2.email, listing: L2.title, listingId: L2.listingId, franchiseId: F2.franchiseId, createdAt: now });
  await db.collection("referrals").add({ tenantId: T, referrerEmail: "ho-member@p2h.test", friendEmail: "ho-friend@p2h.test", reward: 5, friendOff: 5, at: now });
  await db.collection("referrals").add({ tenantId: T, referrerEmail: P2.email, friendEmail: P2.email, reward: 5, friendOff: 5, at: now, franchiseId: F2.franchiseId });

  // Read every list as F1 and count rows that belong to HO or F2.
  const foreign = (rows: unknown[], pick: (r: any) => string) => rows.filter((r) => { const s = pick(r); return /\bHO\b|\bF2\b|ho-member|ho-friend|ftwo|Franchise Two|HO Camp|F2 Camp/i.test(s) || s === P2.email; }).length;
  const leak: Record<string, string> = {};
  const check = async (route: string, pick: (json: any) => { rows: unknown[]; label: (r: any) => string }) => {
    const r = await api(F1.actor, "GET", route);
    if (r.status !== 200) { leak[route] = `HTTP ${r.status}`; return; }
    const { rows, label } = pick(r.json);
    const n = foreign(rows, label);
    leak[route] = n ? `${n} foreign of ${rows.length}` : `clean (${rows.length} rows)`;
  };
  await check("/api/blocks", (j) => ({ rows: j, label: (r) => `${r.name} ${r.listingId === LH.listingId ? "HO" : r.listingId === L2.listingId ? "F2" : ""}` }));
  await check("/api/block-bundles", (j) => ({ rows: j, label: (r) => r.name }));
  await check("/api/inventory", (j) => ({ rows: j, label: (r) => r.name }));
  await check("/api/meal-menus", (j) => ({ rows: j, label: (r) => r.name }));
  await check("/api/suppliers", (j) => ({ rows: j, label: (r) => r.name }));
  await check("/api/timetables", (j) => ({ rows: j, label: (r) => r.name }));
  await check("/api/calendar-events", (j) => ({ rows: j, label: (r) => r.title }));
  await check("/api/memberships", (j) => ({ rows: j.members ?? [], label: (r) => r.email }));
  await check("/api/discounts/groups", (j) => ({ rows: j, label: (r) => r.name }));
  await check("/api/discounts/auto", (j) => ({ rows: j, label: (r) => `${r.tenantId === T ? "" : ""}${r.value}` }));
  // auto discounts carry no name — count by ids instead
  { const r = await api(F1.actor, "GET", "/api/discounts/auto"); const ids = new Set(r.json.map((x: any) => x.id)); const n = [hoIds["/api/discounts/auto"], f2Ids["/api/discounts/auto"]].filter((id) => ids.has(id)).length; leak["/api/discounts/auto"] = n ? `${n} foreign of ${r.json.length}` : `clean (${r.json.length} rows)`; }
  await check("/api/leave", (j) => ({ rows: j.absences ?? [], label: (r) => r.name }));
  await check("/api/appraisals", (j) => ({ rows: j.reviews ?? [], label: (r) => r.name }));
  await check("/api/credentials", (j) => ({ rows: j.records ?? [], label: (r) => r.staff }));
  await check("/api/onboarding", (j) => ({ rows: j.records ?? [], label: (r) => r.staff }));
  await check("/api/payroll", (j) => ({ rows: j.runs ?? [], label: (r) => r.lines?.[0]?.name ?? "" }));
  await check(`/api/timeclock?day=${ymd(new Date())}`, (j) => ({ rows: j, label: (r) => r.name }));
  await check("/api/expense-claims", (j) => ({ rows: j, label: (r) => r.staffName }));
  await check("/api/location-staff", (j) => ({ rows: j.staff ?? [], label: (r) => r.name }));
  await check("/api/posts", (j) => ({ rows: j.filter((p: any) => p.franchiseId), label: (r) => r.body }));
  await check("/api/staff-announcements", (j) => ({ rows: j, label: (r) => r.title }));
  await check("/api/learning/assignments", (j) => ({ rows: j.assignments ?? [], label: (r) => r.course }));
  await check("/api/reviews", (j) => ({ rows: (j.items ?? []).filter((r: any) => !r.demo), label: (r) => r.text }));
  await check("/api/referrals", (j) => ({ rows: j.referrals ?? j.rows ?? j.list ?? (Array.isArray(j) ? j : []), label: (r) => `${r.referrerEmail} ${r.friendEmail}` }));
  { const r = await api(F1.actor, "GET", "/api/referrals"); leak["/api/referrals(raw-keys)"] = Object.keys(r.json ?? {}).join(","); }
  const leaking = Object.entries(leak).filter(([, v]) => v.includes("foreign") || v.startsWith("HTTP"));
  results["p2-f1"] = { verdict: leaking.length ? "fail" : "pass", actual: Object.entries(leak).map(([k, v]) => `${k}: ${v}`).join(" | "), notes: leaking.length ? `${leaking.length} routes return HO/F2 rows to F1: ${leaking.map(([k]) => k).join(", ")}` : undefined };
});

// ── p2-f2: mutate an HO-owned id as F1 ─────────────────────────────────
await step("p2-f2", async () => {
  const hoBlock = (await api(HO, "GET", `/api/blocks?listingId=${LH.listingId}`)).json[0]?.id;
  const targets: [string, string | undefined, unknown][] = [
    ["/api/blocks", hoBlock, { listingId: LH.listingId, name: "hijacked", startDate: ymd(daysFromNow(30)), endDate: ymd(daysFromNow(31)), capacity: 3, schedule: { startTime: "09:00", endTime: "12:00" } }],
    ["/api/inventory", foreignIds["/api/inventory"], { name: "hijacked" }],
    ["/api/suppliers", foreignIds["/api/suppliers"], { name: "hijacked" }],
    ["/api/timetables", foreignIds["/api/timetables"], { name: "hijacked", dateFrom: ymd(daysFromNow(30)), dateTo: ymd(daysFromNow(34)), config: { start: "09:00", end: "15:30", perDay: 4, breaks: 1, lunch: "12:00", signin: ["08:30"], signout: ["15:30"], wholeTimes: [], groups: ["A"] }, dayList: [], plan: [] }],
    ["/api/calendar-events", foreignIds["/api/calendar-events"], { title: "hijacked" }],
    ["/api/meal-menus", foreignIds["/api/meal-menus"], { name: "hijacked" }],
  ];
  const out: string[] = []; let bad = 0;
  for (const [route, id, body] of targets) {
    if (!id) { out.push(`${route}: no HO id seeded`); bad++; continue; }
    const put = await api(F1.actor, "PUT", `${route}/${id}`, body);
    const del = await api(F1.actor, "DELETE", `${route}/${id}`);
    out.push(`${route}: PUT ${put.status} / DELETE ${del.status}`);
    if (put.status !== 404 || del.status !== 404) bad++;
  }
  results["p2-f2"] = { verdict: bad ? "fail" : "pass", actual: out.join(" | "), notes: bad ? "A franchise can edit/delete head office's rows on the routes that answered 200 — ownership is checked on tenantId only" : undefined };
});

// ── p2-f3: franchise creates carry a stamp ────────────────────────────
await step("p2-f3", async () => {
  const made: Record<string, { id: string; franchiseId: unknown }> = {};
  const mk = async (route: string, body: unknown) => { const r = await api(F1.actor, "POST", route, body); made[route] = { id: r.json?.id, franchiseId: r.json?.franchiseId }; };
  await mk("/api/inventory", { name: "F1 stamped cones", quantity: 1 });
  await mk("/api/suppliers", { name: "F1 stamped supplier" });
  await mk("/api/timetables", { name: "F1 stamped tt", dateFrom: ymd(daysFromNow(30)), dateTo: ymd(daysFromNow(34)), config: { start: "09:00", end: "15:30", perDay: 4, breaks: 1, lunch: "12:00", signin: ["08:30"], signout: ["15:30"], wholeTimes: [], groups: ["A"] }, dayList: [], plan: [] });
  await mk("/api/calendar-events", { title: "F1 stamped event", date: ymd(daysFromNow(6)) });
  await mk("/api/meal-menus", { name: "F1 stamped menu", items: [] });
  await mk("/api/block-bundles", { name: "F1 stamped bundle" });
  const out: string[] = []; let bad = 0;
  for (const route of Object.keys(made)) {
    const r = await api(F2.actor, "GET", route);
    const seen = (r.json as { id: string }[]).some((x) => x.id === made[route].id);
    out.push(`${route}: stamp=${JSON.stringify(made[route].franchiseId)} F2 sees=${seen}`);
    if (seen) bad++;
  }
  results["p2-f3"] = { verdict: bad ? "fail" : "pass", actual: out.join(" | "), notes: bad ? "Creates on the unstamped routes carry no franchiseId, so F2 reads F1's rows" : undefined };
});

// ── p2-f4: HO overview adds up ───────────────────────────────────────
await step("p2-f4", async () => {
  const ov = await api(HO, "GET", "/api/ho/overview?period=month");
  const d1 = await api(F1.actor, "GET", "/api/dashboard");
  const d2 = await api(F2.actor, "GET", "/api/dashboard");
  const m1 = await api(F1.actor, "GET", "/api/splitfees/mine");
  const m2 = await api(F2.actor, "GET", "/api/splitfees/mine");
  const fr = (id: string) => (ov.json.franchises as any[]).find((f) => f.franchiseId === id);
  const month = new Date().toISOString().slice(0, 7);
  const ser = (ov.json.series as any[]).find((s) => s.month === month)?.byFranchise ?? {};
  const a1 = fr(F1.franchiseId), a2 = fr(F2.franchiseId);
  const ok = a1?.bookings === 2 && a1?.revenue === 50 && a2?.bookings === 1 && a2?.revenue === 50
    && d1.json.bookings.live === 2 && d2.json.bookings.live === 1 && m1.json.revenue === 50 && m2.json.revenue === 50
    && ser[F1.franchiseId]?.bookings === 2 && ser[F2.franchiseId]?.bookings === 1 && ov.json.direct.bookings === 1 && ov.json.direct.revenue === 40;
  const attention = (ov.json.attention as any[]).map((a) => `${a.kind}:${a.message}`).join("; ");
  results["p2-f4"] = { verdict: ok ? "pass" : "fail", actual: `HO overview F1 {bookings ${a1?.bookings}, revenue ${a1?.revenue}, outstanding ${a1?.outstanding}} F2 {bookings ${a2?.bookings}, revenue ${a2?.revenue}} direct {bookings ${ov.json.direct.bookings}, revenue ${ov.json.direct.revenue}}; month series F1 ${JSON.stringify(ser[F1.franchiseId])} F2 ${JSON.stringify(ser[F2.franchiseId])}; F1 dashboard live=${d1.json.bookings.live} outstanding=${d1.json.money.outstanding}; F2 dashboard live=${d2.json.bookings.live}; splitfees/mine F1 revenue=${m1.json.revenue} F2 revenue=${m2.json.revenue}. Attention: ${attention || "none"}`, notes: "Seeded 2 F1 bookings (£30+£20), 1 F2 (£50), 1 HO direct (£40), all unpaid. Attention items are the territory ones (both franchises have no agreed territory) — real, pointable." };
});

// ── p2-f5: HO scope switch by query ───────────────────────────────────
await step("p2-f5", async () => {
  const all = await api(HO, "GET", "/api/bookings");
  const q1 = await api(HO, "GET", `/api/bookings?franchiseId=${F1.franchiseId}`);
  const qx = await api(HO, "GET", `/api/bookings?franchiseId=not-a-real-franchise`);
  const refs = (r: any) => (r.json as any[]).map((b) => b.ref).sort().join(",");
  const f1Only = (q1.json as any[]).every((b) => b.franchiseId === F1.franchiseId) && q1.json.length === 2;
  results["p2-f5"] = { verdict: f1Only && qx.json.length === 0 ? "pass" : "fail", actual: `no filter: ${all.json.length} rows; ?franchiseId=F1: ${q1.json.length} rows [${refs(q1)}]; foreign id: ${qx.status} ${qx.json.length} rows`, notes: f1Only ? undefined : "GET /api/bookings ignores ?franchiseId= for a company account (routes/bookings.ts:191-204 has no applyHoNetFilter) — HO's scope switch on the bookings list is client-side only" };
});

// ── p2-f6: royalty % changes mid-period ───────────────────────────────
await step("p2-f6", async () => {
  await api(HO, "PUT", "/api/splitfees/settings", { basis: "revenue", rate: 10 });
  const before = await api(F1.actor, "GET", "/api/splitfees/mine");
  const hoBefore = await api(HO, "GET", "/api/splitfees");
  await api(HO, "PUT", "/api/splitfees/settings", { basis: "revenue", rate: 20 });
  const after = await api(F1.actor, "GET", "/api/splitfees/mine");
  const hoAfter = await api(HO, "GET", "/api/splitfees");
  const hoRow = (r: any) => (r.json.franchises as any[]).find((f) => f.franchiseId === F1.franchiseId)?.fee;
  const agree = before.json.fee === hoRow(hoBefore) && after.json.fee === hoRow(hoAfter);
  results["p2-f6"] = { verdict: agree ? "pass" : "fail", actual: `F1 revenue £50: at 10% mine.fee=${before.json.fee} HO row fee=${hoRow(hoBefore)}; raised to 20%: mine.fee=${after.json.fee} HO row fee=${hoRow(hoAfter)}`, notes: "Rule: EVERYTHING is recomputed at the current rate — there is no effective-from date on splitFees (routes/splitfees.ts feeOf uses tenant.splitFees.rate for every booking whatever its createdAt). HO and franchise agree because both read the same setting." };
});

// ── p2-f7: territory approval flow ────────────────────────────────────
await step("p2-f7", async () => {
  const sq = (lat: number, lng: number) => [{ lat, lng }, { lat, lng: lng + 0.1 }, { lat: lat + 0.1, lng: lng + 0.1 }, { lat: lat + 0.1, lng }];
  const f2t = await api(HO, "PUT", `/api/franchises/${F2.franchiseId}/territory`, { areas: [{ id: "a", name: "F2 area", color: "#f00", rings: sq(51.5, -0.1) }], status: "agreed" });
  const overlap = await api(HO, "PUT", `/api/franchises/${F1.franchiseId}/territory`, { areas: [{ id: "b", name: "F1 area", color: "#0f0", rings: sq(51.55, -0.05) }], status: "proposed" });
  const selfApprove = await api(F1.actor, "PUT", `/api/franchises/${F1.franchiseId}/territory`, { status: "agreed" });
  const acctApprove = await api(F1.actor, "POST", "/api/account/territory/approve", {});
  const hoApprove = await api(HO, "PUT", `/api/franchises/${F1.franchiseId}/territory`, { status: "agreed" });
  const me = await api(F1.actor, "GET", "/api/account");
  const outside = await api(F1.actor, "POST", "/api/listings", { title: "P2H far away listing", venueId: "nowhere" });
  const warnKeys = Object.keys(outside.json ?? {}).filter((k) => /territor|warn|outside/i.test(k));
  const ok = selfApprove.status === 403 && hoApprove.status === 200;
  results["p2-f7"] = { verdict: ok ? "pass" : "fail", actual: `F2 agreed ${f2t.status}; HO proposes overlapping F1 polygon: ${overlap.status} ${JSON.stringify(overlap.json)} (no overlap warning field); F1 self-approve via PUT /franchises: ${selfApprove.status}; F1 POST /account/territory/approve: ${acctApprove.status} ${JSON.stringify(acctApprove.json)}; HO approve: ${hoApprove.status}; F1 territory now status=${me.json?.franchiseTerritory?.status}; listing outside territory: ${outside.status}, warning fields: ${warnKeys.length ? warnKeys.join(",") : "none"}`, notes: "Self-approval refused and HO approval works. NOT built: overlap detection on PUT territory (routes/franchises.ts:21-40 stores the polygon as given), and an out-of-territory warning on listings (routes/listings.ts has no territory check). A HO-drawn territory saved via /franchises has no `by` field, so POST /account/territory/approve says nothing is waiting — that route only works for a territory carried on the invite." };
});

// ── p2-f8: franchise invites carry franchiseId ────────────────────────
await step("p2-f8", async () => {
  const byF1 = await api(F1.actor, "POST", "/api/invites", { role: "franchise", franchiseName: "Rogue" });
  const byHO = await api(HO, "POST", "/api/invites", { role: "franchise", franchiseName: "P2H Franchise Three", franchiseArea: "North" });
  const uid = `${created.uids[0].split("-")[0]}-f3-new`; const email = `${uid}@p2h.test`; created.uids.push(uid); created.emails.push(email);
  const F3: Actor = { uid, email, name: "F3 owner" };
  const acc = await api(F3, "POST", `/api/invites/${byHO.json?.token}/accept`, {});
  const me = await api(F3, "GET", "/api/me");
  const ok = byF1.status === 403 && byHO.status === 201 && acc.status === 200 && me.json?.role === "franchise" && me.json?.franchiseId === uid && me.json?.tenantId === T;
  results["p2-f8"] = { verdict: ok ? "pass" : "fail", actual: `F1 invites a franchise: ${byF1.status} ${byF1.json?.error}; HO invites: ${byHO.status}; accept: ${acc.status} ${JSON.stringify(acc.json)}; new account /api/me → role=${me.json?.role} franchiseId=${me.json?.franchiseId} tenantId=${me.json?.tenantId === T ? "HO tenant" : me.json?.tenantId} franchiseName=${me.json?.franchiseName}` };
});

// ── p2-f9: newsfeed targeting ─────────────────────────────────────────
await step("p2-f9", async () => {
  const hoToF1 = await api(HO, "POST", "/api/posts", { body: "HO post targeted at F1", franchiseId: F1.franchiseId });
  const seenP2 = await api(P2, "GET", "/api/posts");
  const seenP1 = await api(P1, "GET", "/api/posts");
  const f1Net = await api(F1.actor, "POST", "/api/posts", { body: "F1 tries network-wide", franchiseId: null });
  const p1Hit = (seenP1.json as any[]).find((p) => p.id === hoToF1.json.id);
  const p2Hit = (seenP2.json as any[]).find((p) => p.id === hoToF1.json.id);
  const seenP2after = await api(P2, "GET", "/api/posts");
  const f1PostReachesP2 = (seenP2after.json as any[]).some((p) => p.id === f1Net.json.id);
  const ok = !p2Hit && !!p1Hit && p1Hit.authorLabel === "Head office" && f1Net.json.franchiseId === F1.franchiseId && !f1PostReachesP2;
  results["p2-f9"] = { verdict: ok ? "pass" : "fail", actual: `HO→F1 post: F2 parent sees=${!!p2Hit}; F1 parent sees=${!!p1Hit} authorLabel=${p1Hit?.authorLabel} authorScope=${p1Hit?.authorScope}; F1 posting with franchiseId:null → ${f1Net.status}, stored franchiseId=${f1Net.json.franchiseId === F1.franchiseId ? "F1 (auto-scoped)" : f1Net.json.franchiseId}, reaches F2 parent=${f1PostReachesP2}`, notes: "A franchise's 'network-wide' attempt is not a 403 — it is silently re-scoped to its own franchise (routes/posts.ts:158-162). Outcome is the same: F2's parents never see it." };
});

// ── p2-f10: announcements to one franchise ────────────────────────────
await step("p2-f10", async () => {
  const before1 = (await bells(S1.email)).length, before2 = (await bells(S2.email)).length;
  const post = await api(HO, "POST", "/api/staff-announcements", { title: "P2H F1-only important notice", body: "Read me", important: true, franchiseId: F1.franchiseId });
  await wait(2500);
  const g1 = await api(S1, "GET", "/api/staff-announcements");
  const g2 = await api(S2, "GET", "/api/staff-announcements");
  const in1 = (g1.json as any[]).find((a) => a.id === post.json.id), in2 = (g2.json as any[]).find((a) => a.id === post.json.id);
  const read = await api(S1, "POST", `/api/staff-announcements/${post.json.id}/read`, {});
  const g1b = await api(S1, "GET", "/api/staff-announcements");
  const readNow = (g1b.json as any[]).find((a) => a.id === post.json.id)?.read;
  const hoView = ((await api(HO, "GET", "/api/staff-announcements")).json as any[]).find((a) => a.id === post.json.id);
  const del = await api(F2.actor, "DELETE", `/api/staff-announcements/${post.json.id}`);
  const b1 = (await bells(S1.email)).length - before1, b2 = (await bells(S2.email)).length - before2;
  const mail = mailLog.filter((l) => l.includes(S1.email) && l.includes("notice")).length;
  const ok = !!in1 && !in2 && read.status === 200 && readNow === true && hoView?.readCount === 1 && del.status === 404 && b1 === 1 && b2 === 0 && mail >= 1;
  results["p2-f10"] = { verdict: ok ? "pass" : "fail", actual: `F1 staff sees=${!!in1}; F2 staff sees=${!!in2}; read receipt ${read.status} → read=${readNow}, HO readCount=${hoView?.readCount}; F2 DELETE → ${del.status}; bells: F1 staff +${b1}, F2 staff +${b2}; email attempts to F1 staff: ${mail} (mailer not live — logged as SUPPRESSED)` };
});

// ── p2-f11: course assignment by location ─────────────────────────────
await step("p2-f11", async () => {
  const put = await api(HO, "PUT", "/api/learning/assignments", { assignments: [{ course: "safeguarding-l1", title: "Safeguarding L1", required: true, locs: ["P2H Franchise One"] }] });
  const a1 = await api(S1, "GET", "/api/learning/assignments");
  const a2 = await api(S2, "GET", "/api/learning/assignments");
  const has = (r: any) => (r.json.assignments ?? []).some((a: any) => a.course === "safeguarding-l1");
  const done = await api(S1, "POST", "/api/learning/completions", { courseId: "safeguarding-l1", title: "Safeguarding L1", score: 90, date: ymd(new Date()) });
  const cF2 = await api(F2.actor, "GET", "/api/learning/completions");
  const cF1 = await api(F1.actor, "GET", "/api/learning/completions");
  const cHO = await api(HO, "GET", "/api/learning/completions");
  const f2Sees = JSON.stringify(cF2.json).includes("Fone Coach");
  const ok = put.status === 200 && has(a1) && !has(a2) && done.status === 200 && !f2Sees;
  results["p2-f11"] = { verdict: ok ? "pass" : "fail", actual: `HO assigns to locs ["P2H Franchise One"]: F1 staff has it=${has(a1)} (fromHo=${(a1.json.assignments ?? []).find((a: any) => a.course === "safeguarding-l1")?.fromHo}); F2 staff has it=${has(a2)}; F1 staff completes → ${done.status}; completions seen by F2 owner=${f2Sees}, by F1 owner=${JSON.stringify(cF1.json).includes("Fone Coach")}, by HO=${JSON.stringify(cHO.json).includes("Fone Coach")}`, notes: "Completions are keyed tenant__fr__F1, so F2 cannot read them — but HO (who assigned the course) cannot see the completion either (GET /completions reads only the tenant key). Worth a follow-up: HO's who's-in-date view misses franchise staff's passes." };
});

// ── p2-f12: documents to franchise roles ──────────────────────────────
await step("p2-f12", async () => {
  const hoPut = await api(HO, "PUT", "/api/documents/library", { docs: [{ id: "pol-coach", title: "Coach policy", version: 1, roles: ["Coach"] }] });
  const s1 = await api(S1, "GET", "/api/documents/library");
  const s2 = await api(S2, "GET", "/api/documents/library");
  const sh = await api(SH, "GET", "/api/documents/library");
  const sees = (r: any) => (r.json.docs ?? []).some((d: any) => String(d.id).endsWith("pol-coach"));
  const before = { s1: (await bells(S1.email)).length, s2: (await bells(S2.email)).length, sh: (await bells(SH.email)).length };
  const chase = await api(HO, "POST", "/api/documents/library/chase", {});
  await wait(2500);
  const d = { s1: (await bells(S1.email)).length - before.s1, s2: (await bells(S2.email)).length - before.s2, sh: (await bells(SH.email)).length - before.sh };
  // The franchise's OWN library reaches only its own coaches.
  const f1Put = await api(F1.actor, "PUT", "/api/documents/library", { docs: [{ id: "f1-pol", title: "F1 coach policy", version: 1, roles: ["Coach"] }] });
  const s1b = await api(S1, "GET", "/api/documents/library");
  const s2b = await api(S2, "GET", "/api/documents/library");
  const own = (r: any) => (r.json.docs ?? []).some((d: any) => d.id === "f1-pol");
  const f1Chase = await api(F1.actor, "POST", "/api/documents/library/chase", {});
  results["p2-f12"] = { verdict: f1Put.status === 200 && own(s1b) && !own(s2b) && f1Chase.json?.people === 1 ? "pass" : "fail", actual: `HO library doc roles:[Coach]: F1 coach sees=${sees(s1)}, F2 coach sees=${sees(s2)}, HO coach sees=${sees(sh)}; HO chase → people=${chase.json?.people}, bells F1 coach +${d.s1}, F2 coach +${d.s2}, HO coach +${d.sh}. F1's OWN library doc roles:[Coach]: F1 coach sees=${own(s1b)}, F2 coach sees=${own(s2b)}; F1 chase → people=${f1Chase.json?.people}`, notes: "The library model has no 'F1's Coach role' — roles are job titles tenant-wide, so a HEAD-OFFICE document assigned to Coach reaches every franchise's coaches (by design, routes/documents.ts teamFor includes all franchise staff for a company). Franchise-only targeting works when the franchise assigns it from its own library. Pass is judged on the latter; the HO half is recorded." };
});

// ── p2-f14: HO-own money excludes franchises ──────────────────────────
await step("p2-f14", async () => {
  const day = ymd(new Date());
  await api(HO, "POST", "/api/income", { date: day, category: "Grants", amount: 100 });
  await api(F1.actor, "POST", "/api/income", { date: day, category: "Grants", amount: 50 });
  await api(F2.actor, "POST", "/api/income", { date: day, category: "Grants", amount: 25 });
  await api(HO, "POST", "/api/expenses", { date: day, category: "Venue", amount: 10 });
  await api(F1.actor, "POST", "/api/expenses", { date: day, category: "Venue", amount: 5 });
  await api(F2.actor, "POST", "/api/expenses", { date: day, category: "Venue", amount: 2.5 });
  const sum = (r: any) => (Array.isArray(r.json) ? r.json : r.json?.rows ?? r.json?.items ?? []).reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
  const iHo = sum(await api(HO, "GET", "/api/income?franchiseId=__ho__")), iAll = sum(await api(HO, "GET", "/api/income")), i1 = sum(await api(F1.actor, "GET", "/api/income")), i2 = sum(await api(F2.actor, "GET", "/api/income"));
  const eHo = sum(await api(HO, "GET", "/api/expenses?franchiseId=__ho__")), eAll = sum(await api(HO, "GET", "/api/expenses")), e1 = sum(await api(F1.actor, "GET", "/api/expenses")), e2 = sum(await api(F2.actor, "GET", "/api/expenses"));
  // expenses also carry the two stock-order/claim rows seeded in f1 (HO expense claim £12.50 + F2's) — compare on the Venue category only
  const venue = (r: any) => (Array.isArray(r.json) ? r.json : []).filter((x: any) => x.category === "Venue").reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
  const vHo = venue(await api(HO, "GET", "/api/expenses?franchiseId=__ho__")), vAll = venue(await api(HO, "GET", "/api/expenses")), v1 = venue(await api(F1.actor, "GET", "/api/expenses")), v2 = venue(await api(F2.actor, "GET", "/api/expenses"));
  const ok = iHo === 100 && i1 === 50 && i2 === 25 && iAll === 175 && vHo === 10 && v1 === 5 && v2 === 2.5 && vAll === 17.5;
  results["p2-f14"] = { verdict: ok ? "pass" : "fail", actual: `income: HO-own(__ho__)=${iHo} + F1=${i1} + F2=${i2} = ${iHo + i1 + i2}; tenant total (HO no filter)=${iAll}. expenses(Venue): HO-own=${vHo} + F1=${v1} + F2=${v2} = ${vHo + v1 + v2}; tenant total=${vAll} (all-category totals ${eHo}/${e1}/${e2}/${eAll} include the f1-seeded claims)` };
});

// ── p2-f15: reviews and referrals ─────────────────────────────────────
await step("p2-f15", async () => {
  const rv = await api(F1.actor, "GET", "/api/reviews");
  const rf = await api(F1.actor, "GET", "/api/referrals");
  const items = (rv.json.items ?? []).filter((i: any) => !i.demo);
  const f2Review = items.some((i: any) => i.text === "F2 review"), hoReview = items.some((i: any) => i.text === "HO review");
  const rfText = JSON.stringify(rf.json);
  const f2Ref = rfText.includes(P2.email), hoRef = rfText.includes("ho-friend");
  const leaks = f2Review || hoReview || f2Ref || hoRef;
  results["p2-f15"] = { verdict: leaks ? "fail" : "pass", actual: `F1 GET /api/reviews: ${items.length} real items, contains F2's review=${f2Review}, HO's=${hoReview} (demo items=${(rv.json.items ?? []).length - items.length}); F1 GET /api/referrals: contains F2's referral=${f2Ref}, HO's=${hoRef}`, notes: leaks ? "Known item from the franchise review (reviews/referrals not yet scoped) — logged as the known item, not a new bug" : "Both routes ARE scoped for a franchise today (reviews by listing ownership, referrals by the franchise's family emails) — the 'still owed' note in the franchise review is out of date for these two." };
});

// ── p2-f16: support threads name the franchise ────────────────────────
await step("p2-f16", async () => {
  const f1Msg = await api(F1.actor, "POST", "/api/messages/support", { body: "P2H F1 needs help", topic: "general", subject: "F1 help" });
  const hoMsg = await api(HO, "POST", "/api/messages/support", { body: "P2H HO needs help", topic: "billing", subject: "HO help" });
  const hq = await api(HQ, "GET", "/api/platform/support");
  const threads = (hq.json.threads as any[]).filter((t) => t.providerId === T);
  const f1t = threads.find((t) => t.franchiseId === F1.franchiseId), hot = threads.find((t) => !t.franchiseId);
  const f1View = await api(F1.actor, "GET", "/api/messages/support");
  const bodies = (f1View.json as any[]).map((m) => m.body);
  const ok = f1Msg.status === 201 && !!f1t && f1t.name === "P2H Franchise One · P2H Franchise One area" && f1t.tier === "franchise" && !!hot && bodies.includes("P2H F1 needs help") && !bodies.includes("P2H HO needs help");
  results["p2-f16"] = { verdict: ok ? "pass" : "fail", actual: `HQ inbox: F1 thread name="${f1t?.name}" tier=${f1t?.tier} kind=${f1t?.kind} franchiseId=${f1t?.franchiseId === F1.franchiseId ? "F1" : f1t?.franchiseId}; HO thread name="${hot?.name}" tier=${hot?.tier}; F1's own view has ${bodies.length} message(s): own=${bodies.includes("P2H F1 needs help")}, HO's=${bodies.includes("P2H HO needs help")}`, notes: "'Franchise' kind is expressed as tier: the tenant's plan 'franchise' → tier 'franchise' for BOTH the HO thread and the franchise thread (platformSupport.ts tenantTier); the franchise is told apart by franchiseId + its real name on the thread." };
});

// ── p2-f17: the franchise's own DSL is alerted ────────────────────────
await step("p2-f17", async () => {
  await setSettings(T, null, { safeguarding: { dslName: "Ho Dsl", dslEmail: DSLH.email } });
  await setSettings(T, F1.franchiseId, { safeguarding: { dslName: "Fone Dsl", dslEmail: DSL1.email } });
  const b1 = (await bells(DSL1.email)).length, bh = (await bells(DSLH.email)).length;
  const inc = await api(S1, "POST", "/api/incidents", { kind: "safeguarding", date: ymd(new Date()), childName: "Walk-in Child", description: "Disclosure during session", concernCategory: "disclosure" });
  await wait(3000);
  const d1 = (await bells(DSL1.email)).length - b1, dh = (await bells(DSLH.email)).length - bh;
  const dslLines = mailLog.filter((l) => l.startsWith("[dsl]") && l.includes(inc.json?.id)).join(" || ");
  const mailTo1 = mailLog.some((l) => l.startsWith("[mail]") && l.includes(DSL1.email)), mailToH = mailLog.some((l) => l.startsWith("[mail]") && l.includes(DSLH.email) && l.includes("concern"));
  const ok = inc.status === 201 && d1 === 1 && dh === 0 && mailTo1 && !mailToH;
  results["p2-f17"] = { verdict: ok ? "pass" : "fail", actual: `F1 staff logs a safeguarding concern → ${inc.status}; bells: F1 DSL +${d1}, HO DSL +${dh}; email attempts: F1 DSL=${mailTo1}, HO DSL=${mailToH} (mailer not live — SUPPRESSED log lines); dsl log: ${dslLines}` };
});

// ── p2-f13 / p2-f18 are code / browser — recorded by the agent ────────

fs.writeFileSync("/tmp/p2h_day5.json", JSON.stringify({ results, mailLog: mailLog.slice(0, 80), world: { T, F1: F1.franchiseId, F2: F2.franchiseId } }, null, 2));
origLog("cleanup", await cleanup());
stop();
process.exit(0);
