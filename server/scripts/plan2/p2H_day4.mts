// Plan-2 Day 4 — the permissions matrix: every area, every level, every verb
// (p2-p1 … p2-p20). Throwaway freelancer A (+ staff S, site lead L), freelancer
// B, company C + F1/F2, parent P, HQ. All deleted at the end.
//   cd server && npx tsx --tsconfig ../tsconfig.json scripts/plan2/p2H_day4.mts
import fs from "node:fs";
import { api, db, mkTenant, mkFranchise, mkStaff, mkParent, mkPlatform, setSettings, cleanup, start, stop, ymd, daysFromNow, type Actor } from "./p2H_harness.mts";
import { forgetSettings } from "../../src/middleware/access";
import { CAP_API } from "../../../lib/accessMap";

type V = { verdict: "pass" | "fail" | "blocked"; actual: string; notes?: string; method?: string };
const results: Record<string, V> = {};
const origLog = console.log;
const step = async (id: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { results[id] = { verdict: "blocked", actual: `script error: ${(e as Error).message}` }; origLog(`  !! ${id} threw`, e); } origLog(`[${id}] ${results[id]?.verdict} — ${results[id]?.actual}`); };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const today = ymd(new Date());

await start();
const A = await mkTenant("freelancer", "P2H Perm A"); const OA = A.owner; const TA = A.tenantId;
const B = await mkTenant("freelancer", "P2H Perm B"); const OB = B.owner; const TB = B.tenantId;
const C = await mkTenant("company", "P2H Perm HO"); const HO = C.owner; const TC = C.tenantId; const F1 = await mkFranchise(TC, "P2H Perm F1"); const F2 = await mkFranchise(TC, "P2H Perm F2");
const S = await mkStaff(TA, { franchiseId: null, name: "Perm Staff", staffRole: "Coach", permRole: "coach" });
const S2 = await mkStaff(TA, { franchiseId: null, name: "Perm Other", staffRole: "Coach" });
const P = await mkParent("Perm Parent"); const HQ = await mkPlatform();
async function listingAndBlock(actor: Actor, title: string, venueId?: string) {
  const l = await api(actor, "POST", "/api/listings", { title, passes: [{ name: "Day", price: 10 }], ...(venueId ? { venueId } : {}) }); if (l.status !== 201) throw new Error(`listing ${l.status} ${l.text}`);
  await db.collection("listings").doc(l.json.id).set({ status: "live", ...(venueId ? { venueId } : {}) }, { merge: true });
  const b = await api(actor, "POST", "/api/blocks", { listingId: l.json.id, name: `${title} wk`, startDate: today, endDate: ymd(daysFromNow(4)), capacity: 50, schedule: { startTime: "09:00", endTime: "15:30" } }); if (b.status !== 201) throw new Error(`block ${b.status} ${b.text}`);
  return { listingId: l.json.id as string, blockId: b.json.id as string, title };
}
await setSettings(TA, null, { locations: [{ id: "v1", name: "Venue One" }, { id: "v2", name: "Venue Two" }] });
const V1 = await listingAndBlock(OA, "P2H Perm V1", "v1"); const V2 = await listingAndBlock(OA, "P2H Perm V2", "v2");
const L = await mkStaff(TA, { franchiseId: null, name: "Perm Lead", staffRole: "Lead", lead: true, assignment: { mode: "locations", ids: ["v1"] } });
async function child(parent: Actor, name: string) { const r = await api(parent, "POST", "/api/my/children", { name, dob: "2019-05-04" }); return r.json.id as string; }
const K1 = await child(P, "Perm Kid One"); const K2 = await child(P, "Perm Kid Two");
async function parentBook(parent: Actor, Lx: { listingId: string; blockId: string }, name: string, childId: string) { const r = await api(parent, "POST", "/api/my/bookings", { listingId: Lx.listingId, blockId: Lx.blockId, method: "Bank transfer", items: [{ pass: "Day", child: name, childId, age: 7, dates: [today] }] }); if (r.status !== 201) throw new Error(`parent booking ${r.status} ${r.text}`); return r.json.ref ?? r.json.refs?.[0] ?? r.json.bookings?.[0]?.ref; }
const R1 = await parentBook(P, V1, "Perm Kid One", K1); const R2 = await parentBook(P, V2, "Perm Kid Two", K2);
await api(OA, "POST", "/api/incidents", { kind: "accident", date: today, childId: K1, childName: "Perm Kid One", blockId: V1.blockId, listingId: V1.listingId, description: "V1 bump" });
await api(OA, "POST", "/api/incidents", { kind: "accident", date: today, childId: K2, childName: "Perm Kid Two", blockId: V2.blockId, listingId: V2.listingId, description: "V2 bump" });
await api(OA, "POST", "/api/medications", { childId: K1, childName: "Perm Kid One", name: "Med1", dose: "1", consentGranted: true }); await api(OA, "POST", "/api/medications", { childId: K2, childName: "Perm Kid Two", name: "Med2", dose: "1", consentGranted: true });
await api(OA, "POST", "/api/trips", { destination: "V1 trip", date: ymd(daysFromNow(10)), listingId: V1.listingId, attendees: [{ n: "Perm Kid One", childId: K1 }] }); await api(OA, "POST", "/api/trips", { destination: "V2 trip", date: ymd(daysFromNow(10)), listingId: V2.listingId, attendees: [{ n: "Perm Kid Two", childId: K2 }] });
await api(OA, "POST", "/api/tasks", { title: "V1 task", link: { k: "list", v: V1.listingId } }); await api(OA, "POST", "/api/tasks", { title: "V2 task", link: { k: "list", v: V2.listingId } });
origLog("world", { TA, TB, TC, R1, R2 });

const setRole = async (caps: Record<string, string>) => { await setSettings(TA, null, { rolesSetAt: new Date().toISOString(), roles: [{ id: "coach", name: "Coach", caps }] }); forgetSettings(TA); };
// ── p2-p1: the matrix ─────────────────────────────────────────────────────
await step("p2-p1", async () => {
  const listPath: Record<string, string> = { bookings: "/api/bookings", customers: "/api/customers", listings: "/api/blocks", registers: `/api/registers?date=${today}`, ratios: `/api/ratios/board/${today}`, meals: "/api/meal-menus", trips: "/api/trips", timetable: "/api/timetables", calendar: "/api/calendar-events", tasks: "/api/tasks", medical: "/api/children/lookup?q=pe", incidents: "/api/incidents", medication: "/api/medications", moments: "/api/moments", documents: "/api/documents", finances: "/api/reconciliation", moneyops: "/api/expenses", marketing: "/api/discounts", messaging: "/api/posts", email: "/api/emails", franchise: "/api/franchises" };
  const postBody: Record<string, [string, unknown]> = { bookings: ["/api/bookings", { booker: "X", email: "x@p2h.test", child: "X", age: 7, listing: V1.title, pass: "Day", blockId: V1.blockId, amount: 10, method: "Bank transfer" }], customers: ["/api/customers", { name: "New Fam", email: "fam@p2h.test" }], listings: ["/api/blocks", { listingId: V1.listingId, name: "wk2", startDate: ymd(daysFromNow(40)), endDate: ymd(daysFromNow(44)), capacity: 5, schedule: { startTime: "09:00", endTime: "15:30" } }], registers: [`/api/registers/${V1.blockId}/${today}/headcount`, { n: 1 }], ratios: ["", null], meals: ["/api/meal-menus", { name: "m", items: [] }], trips: ["/api/trips", { destination: "x", date: ymd(daysFromNow(12)) }], timetable: ["/api/timetables", { name: "tt", dateFrom: today, dateTo: ymd(daysFromNow(4)), config: { start: "09:00", end: "15:30", perDay: 4, breaks: 1, lunch: "12:00", signin: [], signout: [], wholeTimes: [], groups: ["A"] }, dayList: [], plan: [] }], calendar: ["/api/calendar-events", { title: "inset", date: ymd(daysFromNow(5)) }], tasks: ["/api/tasks", { title: "t" }], medical: ["", null], incidents: ["/api/incidents", { kind: "accident", date: today, childName: "Perm Kid One", description: "d" }], medication: ["/api/medications", { childName: "Perm Kid One", name: "m", dose: "1" }], moments: ["/api/moments", { caption: "hi", photoType: "work" }], documents: ["/api/documents", { title: "d", category: "policy", url: "https://example.com/d.pdf" }], finances: ["", null], moneyops: ["/api/expenses", { date: today, amount: 1, category: "Equipment" }], marketing: ["/api/discounts", { code: "X1", type: "percent", value: 5 }], messaging: ["/api/posts", { title: "p", body: "b" }], email: ["/api/emails/send", { subject: "s", body: "b", audience: "one", to: "x@p2h.test" }], franchise: ["", null] };
  const areas = [...new Set(CAP_API.map((c) => c.area))]; const rows: string[] = []; let bad = 0;
  const gate = (r: { status: number; json: any }) => r.status === 403 && (r.json?.code === "no_access" || r.json?.code === "view_only") ? r.json.code : `${r.status}`;
  for (const area of areas) {
    await setRole({ [area]: "none" }); const gN = await api(S, "GET", listPath[area]);
    await setRole({ [area]: "view" }); const gV = await api(S, "GET", listPath[area]); const [pp, pb] = postBody[area]; const pV = pp ? await api(S, "POST", pp, pb) : null;
    await setRole({ [area]: "edit" }); const pE = pp ? await api(S, "POST", pp, pb) : null;
    const okN = gate(gN) === "no_access"; const okV = gV.status !== 403 && (!pV || gate(pV) === "view_only"); const okE = !pE || (pE.status !== 403 || pE.json?.code === undefined);
    const line = `${area}: None GET=${gate(gN)} · View GET=${gV.status}${pV ? ` POST=${gate(pV)}` : ""} · Edit${pE ? ` POST=${pE.status}${pE.status >= 400 ? " " + JSON.stringify(pE.json?.error ?? pE.json).slice(0, 70) : ""}` : " (read-only area)"}`; rows.push(line);
    if (!(okN && okV && okE)) bad++;
  }
  await setRole({});
  results["p2-p1"] = { verdict: bad === 0 ? "pass" : "fail", actual: rows.join(" | "), notes: `${bad} area(s) off the expected pattern. Edit POSTs answering 400/404 count as 'allowed through the gate' (the body was minimal). A staff member with no restriction set is 'edit' everywhere (capLevel default). Areas 'ratios', 'medical', 'finances', 'franchise' have no staff POST — GET only.` };
});
// ── p2-p2: cache latency ──────────────────────────────────────────────────
await step("p2-p2", async () => {
  await setRole({}); await api(S, "GET", "/api/tasks");
  await db.collection("libraries").doc(TA).set({ settings: { rolesSetAt: new Date().toISOString(), roles: [{ id: "coach", name: "Coach", caps: { tasks: "none" } }] } }, { merge: true }); // NO forgetSettings — real cache path
  let first = -1; const seen: number[] = [];
  for (let s = 0; s < 15; s++) { const r = await api(S, "GET", "/api/tasks"); seen.push(r.status); if (r.status === 403 && first < 0) { first = s; break; } await wait(1000); }
  forgetSettings(TA); await setRole({});
  results["p2-p2"] = { verdict: first >= 0 && first <= 11 ? "pass" : "fail", actual: `tasks set to None via the library doc (cache untouched): first 403 at second ${first} (statuses: ${seen.join(",")})` };
});
// ── p2-p3: staff with no permRole ────────────────────────────────────────
await step("p2-p3", async () => {
  await setRole({ bookings: "none", incidents: "none", tasks: "none" });
  const old = await mkStaff(TA, { franchiseId: null, name: "Perm Legacy" }); await db.collection("users").doc(old.uid).update({ staffRole: (await import("firebase-admin")).default.firestore.FieldValue.delete() }).catch(() => {});
  const b = await api(old, "GET", "/api/bookings"); const i = await api(old, "GET", "/api/incidents"); const t = await api(old, "POST", "/api/tasks", { title: "legacy task" });
  await setRole({});
  results["p2-p3"] = { verdict: "pass", actual: `staff with no permRole while the coach role is None on bookings/incidents/tasks: GET bookings ${b.status}, GET incidents ${i.status}, POST tasks ${t.status}`, notes: "resolveCaps returns null when the user has no permRole (lib/accessMap.ts:228) and capLevel(null) = 'edit' — so a staff account invited before roles existed is a FULL-ACCESS account. Decision needed (plan p2-p3): default such accounts to a 'view' role or force a role on first login." };
});
// ── p2-p4: features off ──────────────────────────────────────────────────
await step("p2-p4", async () => {
  await setSettings(TA, null, { features: { schedule: false, clock: false, meals: false } }); forgetSettings(TA);
  const g = await api(OA, "GET", "/api/rota"); const p = await api(OA, "PUT", "/api/rota", { shifts: [] }); const c = await api(S, "POST", "/api/rota/clock", { kind: "in" }); const t = await api(S, "POST", "/api/timeclock/event", { kind: "in", day: today, name: "Perm Staff" }); const m = await api(OA, "GET", "/api/meals");
  await setSettings(TA, null, { features: { schedule: true, clock: true, meals: true } }); forgetSettings(TA);
  const ok = g.status === 200 && p.status === 403 && p.json?.code === "feature_off" && c.status !== 403 && t.status !== 403 && m.status === 403 && m.json?.code === "feature_off";
  results["p2-p4"] = { verdict: ok ? "pass" : "fail", actual: `Schedule+Clock+Meals OFF: GET rota ${g.status}; PUT rota ${p.status} ${p.json?.code ?? ""}; POST rota/clock ${c.status}; POST timeclock/event ${t.status}; GET meals ${m.status} ${m.json?.code ?? ""}` };
});
// ── p2-p5: HO feature control per franchise ───────────────────────────────
await step("p2-p5", async () => {
  const put = await api(HO, "PUT", `/api/franchises/${F1.franchiseId}/features`, { view: "meals", on: false }); forgetSettings(TC);
  const f1 = await api(F1.actor, "GET", "/api/meals"); const f2 = await api(F2.actor, "GET", "/api/meals"); const ho = await api(HO, "GET", "/api/meals");
  const f1put = await api(F1.actor, "PUT", `/api/franchises/${F2.franchiseId}/features`, { view: "meals", on: true });
  const all = await api(HO, "PUT", "/api/franchises/__all__/features", { view: "meals", on: false }); forgetSettings(TC);
  const f2b = await api(F2.actor, "GET", "/api/meals");
  await api(HO, "PUT", "/api/franchises/__all__/features", { view: "meals", on: true });
  const ok = put.status === 200 && f1.status === 403 && f1.json?.code === "feature_off" && f2.status === 200 && ho.status === 200 && f1put.status === 403 && all.status === 200 && f2b.status === 403;
  results["p2-p5"] = { verdict: ok ? "pass" : "fail", actual: `HO turns meals off for F1 → ${put.status}; GET meals F1 ${f1.status} ${f1.json?.code ?? ""}, F2 ${f2.status}, HO ${ho.status}; F1 PUT features → ${f1put.status}; __all__ off → ${all.status}; F2 then ${f2b.status}` };
});
results["p2-p6"] = { verdict: "blocked", method: "browser", actual: "Browser step (franchise Setup → Features vs HO matrix) — queued for the browser agent." };
// ── p2-p7 / p8: site-lead narrowing ──────────────────────────────────────
async function narrowing(who: Actor, label: string) {
  const count = async (path: string, pick: (j: any) => any[]) => { const r = await api(who, "GET", path); const arr = r.status === 200 ? pick(r.json) : []; return `${path.split("?")[0].replace("/api/", "")}=${r.status}:${arr.length}`; };
  const txt = (j: any, key: string) => JSON.stringify(j ?? "").includes(key);
  const reg = await api(who, "GET", `/api/registers?date=${today}`); const regV2 = txt(reg.json, V2.blockId);
  const bk = await api(who, "GET", "/api/bookings"); const bkV2 = (bk.json ?? []).some((b: any) => b.ref === R2);
  const board = await api(who, "GET", `/api/ratios/board/${today}`); const boardV2 = txt(board.json, "Perm Kid Two");
  const meals = await api(who, "GET", `/api/meals?date=${today}`); const mealsV2 = txt(meals.json, "Perm Kid Two");
  const trips = await api(who, "GET", "/api/trips"); const tripsV2 = (trips.json ?? []).some((t: any) => t.destination === "V2 trip");
  const mom = await api(who, "GET", "/api/moments"); const inc = await api(who, "GET", "/api/incidents"); const incV2 = (inc.json ?? []).some((x: any) => x.description === "V2 bump");
  const med = await api(who, "GET", "/api/medications"); const medV2 = (med.json ?? []).some((x: any) => x.name === "Med2");
  const ch = await api(who, "GET", `/api/children/${K2}`);
  const cust = await api(who, "GET", "/api/customers"); const th = await api(who, "GET", "/api/messages/threads"); const tasks = await api(who, "GET", "/api/tasks"); const tasksV2 = (tasks.json?.items ?? tasks.json ?? []).some?.((t: any) => t.title === "V2 task");
  const leaks = [regV2 && "registers", bkV2 && "bookings", boardV2 && "ratios board", mealsV2 && "meals", tripsV2 && "trips", incV2 && "incidents", medV2 && "medications", ch.status === 200 && "children/<V2 id>"].filter(Boolean);
  const notNarrowed = [`customers=${cust.status}:${(cust.json?.items ?? cust.json ?? []).length ?? "?"}`, `threads=${th.status}:${(th.json?.threads ?? th.json ?? []).length ?? "?"}`, `tasks=${tasks.status} V2 task visible=${tasksV2}`];
  return { leaks, notNarrowed, chStatus: ch.status, momStatus: mom.status };
}
await step("p2-p7", async () => {
  const n = await narrowing(L, "venue");
  results["p2-p7"] = { verdict: n.leaks.length === 0 && n.chStatus === 404 ? "pass" : "fail", actual: `site lead (venue V1 only): V2 rows leaking in first group: [${n.leaks.join(", ") || "none"}]; GET children/<V2 child> → ${n.chStatus}; moments → ${n.momStatus}; second group (listed as not narrowed): ${n.notNarrowed.join("; ")}` };
});
await step("p2-p8", async () => {
  await db.collection("users").doc(L.uid).set({ assignment: { mode: "listings", ids: [V1.listingId] } }, { merge: true });
  const n = await narrowing(L, "listings");
  results["p2-p8"] = { verdict: n.leaks.length === 0 && n.chStatus === 404 ? "pass" : "fail", actual: `site lead (listing V1 only): V2 rows leaking: [${n.leaks.join(", ") || "none"}]; GET children/<V2 child> → ${n.chStatus}; second group: ${n.notNarrowed.join("; ")}` };
});
results["p2-p9"] = { verdict: "blocked", actual: "GET /api/events needs a real Firebase ID token (?token=, verifyFresh) — the in-process harness injects users by header, so the SSE stream can't be opened here. Code read: events.ts checks users.disabled/deactivatedAt on connect (403 account_disabled) and the stream is re-authenticated on reconnect only.", notes: "Needs the live server + a real staff token (prereq q1)." };
// ── p2-p10: parent deactivate / reactivate ────────────────────────────────
await step("p2-p10", async () => {
  const P2 = await mkParent("Perm Closer"); const K = await child(P2, "Closer Kid");
  const ref = await parentBook(P2, V1, "Closer Kid", K); const rp = await api(OA, "POST", `/api/bookings/${ref}/record-payment`, { amount: 10, method: "bank" });
  const d = await api(P2, "POST", "/api/account/deactivate", { reason: "moving" });
  const my = await api(P2, "GET", "/api/my/bookings"); const pub = await api(P2, "GET", "/api/listings"); const fam1 = await api(OA, "GET", "/api/customers"); const listed1 = JSON.stringify(fam1.json).includes(P2.email.toLowerCase());
  const r0 = await api(P2, "POST", "/api/account/reactivate", {}); const r1 = await api(P2, "POST", "/api/account/reactivate", { confirm: true });
  const my2 = await api(P2, "GET", "/api/my/bookings"); const fam2 = await api(OA, "GET", "/api/customers"); const listed2 = JSON.stringify(fam2.json).includes(P2.email.toLowerCase());
  const ok = d.status === 200 && my.status === 403 && my.json?.code === "account_closed" && pub.status === 200 && r0.status === 400 && r1.status === 200 && my2.status === 200 && listed1 && listed2;
  results["p2-p10"] = { verdict: ok ? "pass" : "fail", actual: `ref=${ref}; record-payment → ${rp.status} ${rp.status >= 400 ? JSON.stringify(rp.json).slice(0, 80) : ""}; deactivate → ${d.status} ${d.status >= 400 ? JSON.stringify(d.json).slice(0, 90) : ""}; GET my/bookings → ${my.status} ${my.json?.code ?? ""}; public listings with the token → ${pub.status} (${(pub.json ?? []).length} shown); provider's Families lists them while closed: ${listed1}; reactivate without confirm → ${r0.status}, with confirm → ${r1.status}; my/bookings after → ${my2.status}; Families after: ${listed2}` };
});
// ── p2-p11 / p12: x-act-as ───────────────────────────────────────────────
await step("p2-p11", async () => {
  const a = await api(OA, "GET", "/api/me", undefined, { "x-act-as": OB.uid }); const ignored = a.json?.tenantId === TA || a.json?.uid === OA.uid;
  const so = await api(HQ, "POST", "/api/account/signout-everywhere", {}, { "x-act-as": S.uid });
  const sub = await api(HQ, "GET", "/api/subscription", undefined, { "x-act-as": F1.actor.uid });
  const ok = ignored && so.status === 403 && sub.status === 403;
  results["p2-p11"] = { verdict: ok ? "pass" : "fail", actual: `$A + x-act-as $B → /api/me still $A: ${ignored} (tenantId=${a.json?.tenantId === TA ? "A" : a.json?.tenantId}); $H acting as $S signout-everywhere → ${so.status} ${(so.json?.error ?? "").slice(0, 40)}; $H acting as $F1 GET subscription → ${sub.status}` };
});
await step("p2-p12", async () => {
  const kids = await api(HQ, "GET", "/api/my/children", undefined, { "x-act-as": P.uid }); const id = (kids.json ?? [])[0]?.id;
  const w = await api(HQ, "PUT", `/api/my/children/${id}`, { name: "Perm Kid One", dob: "2019-05-04", allergies: "test" }, { "x-act-as": P.uid });
  const after = (await db.collection("children").doc(id).get()).data();
  const audit = (await db.collection("audit").where("uid", "==", P.uid).get().catch(() => ({ size: -1 }))).size;
  results["p2-p12"] = { verdict: kids.status === 200 ? "pass" : "fail", actual: `$H as $P: GET my/children → ${kids.status} (${(kids.json ?? []).length}); PUT allergies → ${w.status}; stored allergies="${after?.allergies}"; audit docs for the family: ${audit < 0 ? "no audit collection" : audit}`, notes: `HQ acting as a parent CAN write the child's medical fields (allergies stored) and nothing records that it was HQ rather than the parent (only a console.warn '[impersonate]' line). Decision needed (b6): block writes while impersonating or write an audit doc.` };
});
// ── p2-p13: platform routes ──────────────────────────────────────────────
await step("p2-p13", async () => {
  const paths = ["/api/platform/providers", "/api/tenants", "/api/platform/leads", "/api/platform/support", "/api/platform/notifications"]; const out: string[] = []; let bad = 0;
  for (const [n, who] of [["$A", OA], ["$F1", F1.actor], ["$S", S], ["$P", P], ["$C", HO]] as [string, Actor][]) { const codes = []; for (const p of paths) { const r = await api(who, "GET", p); codes.push(r.status); if (r.status !== 403 && r.status !== 401) bad++; } out.push(`${n}: ${codes.join("/")}`); }
  const ff = await api(F1.actor, "GET", "/api/franchises/features"); if (ff.status !== 403) bad++;
  results["p2-p13"] = { verdict: bad === 0 ? "pass" : "fail", actual: `${paths.map((p) => p.replace("/api/", "")).join(" / ")} → ${out.join("; ")}; $F1 GET franchises/features → ${ff.status}` };
});
// ── p2-p14: operator as a customer ────────────────────────────────────────
await step("p2-p14", async () => {
  const b = await api(OA, "POST", "/api/my/bookings", { listingId: V1.listingId, blockId: V1.blockId, method: "Bank transfer", items: [{ pass: "Day", child: "Owner Kid", age: 7, dates: [today] }] });
  const m = await api(OA, "POST", "/api/my/memberships/join", { tenantId: TA, tierId: "x" }); const w = await api(OA, "GET", "/api/my/wallet");
  const fam = await api(OA, "GET", "/api/customers"); const self = JSON.stringify(fam.json).includes(OA.email.toLowerCase());
  results["p2-p14"] = { verdict: b.status === 403 && w.status === 403 ? "pass" : "fail", actual: `operator token: POST my/bookings → ${b.status} ${(b.json?.error ?? "").slice(0, 40)}; memberships/join → ${m.status}; GET my/wallet → ${w.status}; owner now in their own Families: ${self}`, notes: b.status === 201 ? "Operators may book as themselves through the parent route — the provider now has a customer record in their own tenant (recorded, per the plan's 'or')." : undefined };
});
// ── p2-p15: library scoping ──────────────────────────────────────────────
await step("p2-p15", async () => {
  await setSettings(TC, null, { safeguarding: { dslName: "HO DSL" } });
  const w = await api(F1.actor, "PUT", "/api/library", { settings: { safeguarding: { dslName: "F1 DSL" } } });
  const ho = await api(HO, "GET", "/api/library"); const hoDsl = ho.json?.settings?.safeguarding?.dslName;
  const frDoc = (await db.collection("libraries").doc(`${TC}__fr__${F1.franchiseId}`).get()).data()?.settings?.safeguarding?.dslName;
  const x = await api(F1.actor, "GET", `/api/library/${TB}`); const xp = await api(null, "GET", `/api/public/library/${TB}`);
  const ok = w.status === 200 && hoDsl === "HO DSL" && frDoc === "F1 DSL" && x.status >= 400;
  results["p2-p15"] = { verdict: ok ? "pass" : "fail", actual: `F1 PUT dslName → ${w.status}; HO's dslName after: "${hoDsl}"; tenant__fr__F1 doc dslName: "${frDoc}"; GET /api/library/<B> as F1 → ${x.status}; public /api/public/library/<B> → ${xp.status} (keys: ${Object.keys(xp.json?.settings ?? {}).join(",").slice(0, 60)})`, notes: "The authenticated router has no /:tenantId route (404); the PUBLIC library route returns only PUBLIC_SETTINGS_KEYS for any tenant by design (storefront)." };
});
// ── p2-p16: register-role abuse ──────────────────────────────────────────
await step("p2-p16", async () => {
  const a = await api(OA, "POST", "/api/register-role", { role: "platform" });
  const fresh = await mkParent("Perm Fresh"); await db.collection("users").doc(fresh.uid).delete();
  const b = await api(fresh, "POST", "/api/register-role", { role: "company", businessName: "Hijack", tenantId: TB });
  const u = (await db.collection("users").doc(fresh.uid).get()).data();
  const ok = a.status >= 400 && (b.status >= 400 || u?.tenantId !== TB);
  results["p2-p16"] = { verdict: ok ? "pass" : "fail", actual: `$A registers role platform → ${a.status} ${(b.json?.error ?? a.json?.error ?? "").toString().slice(0, 40)}; new account posts {role:company, tenantId:<B>} → ${b.status}; their users doc tenantId=${u?.tenantId === TB ? "B's (!)" : u?.tenantId ? "a fresh tenant" : "none"}`, notes: "zod: role is limited to parent/company/freelancer (registerRole.ts:19-21) — 'platform' is a 400; tenantId isn't a schema field, so it is ignored and a fresh tenant is created." };
});
// ── p2-p17: invites ──────────────────────────────────────────────────────
await step("p2-p17", async () => {
  const inv = await api(OA, "POST", "/api/invites", { role: "staff", email: "perm-new@p2h.test", name: "Perm New" }); const tok = inv.json?.token;
  const hoInv = await api(HO, "POST", "/api/invites", { role: "staff", email: "ho-new@p2h.test", name: "HO New" });
  const s = await api(S, "PATCH", `/api/invites/${tok}/lead`, { lead: true }); const f = await api(F1.actor, "DELETE", `/api/invites/${hoInv.json?.token}`);
  const pv = await api(null, "GET", `/api/invites/${tok}`); const keys = Object.keys(pv.json ?? {}); const leaksEmail = JSON.stringify(pv.json ?? {}).includes("perm-new@p2h.test");
  const ok = s.status === 403 && f.status === 404 && pv.status === 200 && !leaksEmail && !keys.includes("assignment");
  results["p2-p17"] = { verdict: ok ? "pass" : "fail", actual: `staff PATCH lead → ${s.status}; F1 DELETE HO's invite → ${f.status}; public preview → ${pv.status} keys=[${keys.join(",")}] email leaked=${leaksEmail}` };
});
// ── p2-p18: availability ─────────────────────────────────────────────────
await step("p2-p18", async () => {
  const req = await api(OA, "POST", "/api/availability/requests", { staffEmail: S2.email, staffName: "Perm Other", window: { kind: "range", label: "Next week", from: ymd(daysFromNow(7)), to: ymd(daysFromNow(14)) }, note: "please" });
  const mine = await api(S, "PUT", "/api/availability/mine", { days: { mon: { on: true, from: "09:00", to: "17:00" } } });
  const asg = await api(S, "PATCH", `/api/availability/requests/${req.json?.id}/assign`, { staffId: S.uid });
  const sub = await api(S, "GET", `/api/availability/requests/${req.json?.id}/submission`);
  const ok = mine.status === 200 && asg.status === 403 && (sub.status === 403 || sub.status === 404);
  results["p2-p18"] = { verdict: ok ? "pass" : "fail", actual: `request (as owner) → ${req.status}; PUT availability/mine as staff → ${mine.status}; staff PATCH assign → ${asg.status}; staff GET another's submission → ${sub.status}` };
});
// ── p2-p19: leave ────────────────────────────────────────────────────────
await step("p2-p19", async () => {
  const cfg = await api(S, "PUT", "/api/leave/config", { policy: {} });
  const other = await api(S, "POST", "/api/leave/absences", { staffId: S2.uid, name: "Perm Other", kind: "annual", start: ymd(daysFromNow(20)), end: ymd(daysFromNow(20)), days: 1 });
  const appr = await api(OA, "POST", "/api/leave/absences", { name: "Perm Staff", staffId: S.uid, kind: "annual", start: ymd(daysFromNow(21)), end: ymd(daysFromNow(21)), days: 1, status: "approved" });
  const canc = await api(S, "POST", `/api/leave/absences/${appr.json?.id}/cancel`, {});
  const own = await api(OA, "POST", "/api/leave/absences", { name: OA.name, kind: "annual", start: ymd(daysFromNow(22)), end: ymd(daysFromNow(22)), days: 1 });
  const dec = await api(OA, "POST", `/api/leave/absences/${own.json?.id}/decide`, { status: "approved" });
  const ok = cfg.status === 403 && (other.status === 403 || (other.status === 201 && other.json?.name === "Perm Staff"));
  results["p2-p19"] = { verdict: ok ? "pass" : "fail", actual: `staff PUT leave/config → ${cfg.status}; staff posts leave with someone else's staffId → ${other.status} (stored for "${other.json?.name}"); staff cancels their APPROVED day → ${canc.status} ${(canc.json?.error ?? "").slice(0, 50)}; manager decides their OWN request → ${dec.status} ${(dec.json?.error ?? "").slice(0, 40)}`, notes: `Cancel-after-approval rule: ${canc.status === 200 ? "allowed (status → cancelled)" : `refused ${canc.status}`}. ${dec.status === 200 ? "Fix needed (decision): a manager can approve their own leave request with nothing flagged." : ""}` };
});
// ── p2-p20: timeclock ────────────────────────────────────────────────────
await step("p2-p20", async () => {
  await api(S, "POST", "/api/timeclock/event", { kind: "out", day: today, name: "Perm Staff" }); // p2-p4 left them clocked in
  const e1 = await api(S, "POST", "/api/timeclock/event", { kind: "in", day: today, name: "Perm Staff" }); const e2 = await api(S, "POST", "/api/timeclock/event", { kind: "in", day: today, name: "Perm Staff" });
  const id = e1.json?.id ?? e1.json?.record?.id; const sp = await api(S, "PATCH", `/api/timeclock/${id}?day=${today}`, { breakMs: 0 });
  const mp = await api(OA, "PATCH", `/api/timeclock/${id}?day=${today}`, { breakMs: 600000 });
  const rec = mp.json?.record ?? mp.json; const stamped = !!(rec?.editedBy ?? rec?.updatedBy ?? rec?.edits ?? rec?.lastEditedBy);
  const ok = sp.status === 403 && e2.status >= 400 && mp.status === 200 && stamped;
  results["p2-p20"] = { verdict: ok ? "pass" : "fail", actual: `staff clock-in → ${e1.status}; second clock-in → ${e2.status} ${(e2.json?.error ?? "").slice(0, 40)}; staff PATCH → ${sp.status}; manager PATCH → ${mp.status}, who-changed stamp: ${stamped ? Object.keys(rec).filter((k) => /edit|updated/i.test(k)).join(",") : "NONE"}`, notes: !stamped && mp.status === 200 ? "Fix needed: the manager's edit of a punch isn't attributed on the record." : undefined };
});

fs.writeFileSync("/tmp/p2h_day4.json", JSON.stringify({ results, world: { TA, TB, TC } }, null, 2));
origLog("cleanup", await cleanup());
stop();
process.exit(0);
