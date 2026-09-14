// Plan-2 Day 8 — operations tools (p2-o1 … p2-o18): tasks, calendar,
// timetable, inventory, meals, seasons, bundles, listings, waitlist, cut-off,
// bulk, trips. Throwaway freelancer A (+ staff S/S2, parents P/P2/P3/P4),
// freelancer B, company C + F1/F2 (+ HO staff, F1 staff, F2 staff). All
// deleted at the end (try/finally).
//   cd server && npx tsx --tsconfig ../tsconfig.json scripts/plan2/p2H_day8.mts
import fs from "node:fs";
import { api, db, mkTenant, mkFranchise, mkStaff, mkParent, setSettings, cleanup, start, stop, ymd, daysFromNow, type Actor } from "./p2H_harness.mts";
import { forgetSettings } from "../../src/middleware/access";
import { expireOffers } from "../../src/lib/waitlist";
import { ukWallClock } from "../../src/lib/bookingCutoff";
import { ukNow } from "../../src/lib/scheduler";

type V = { verdict: "pass" | "fail" | "blocked"; actual: string; notes?: string; method?: string };
const results: Record<string, V> = {};
const origLog = console.log;
const step = async (id: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { results[id] = { verdict: "blocked", actual: `script error: ${(e as Error).message}` }; origLog(`  !! ${id} threw`, e); } origLog(`[${id}] ${results[id]?.verdict} — ${results[id]?.actual}`); };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const err = (r: { json: any }) => JSON.stringify(r.json?.error ?? r.json ?? "").slice(0, 110);
const today = ymd(new Date());
const D = (n: number) => ymd(daysFromNow(n));
/** Provider (tenant-audience) bells for a tenant. */
const tenantBells = async (tenantId: string) => (await db.collection("notifications").where("tenantId", "==", tenantId).where("audience", "==", "tenant").get()).docs.map((d) => d.data());
/** A family's bells. */
const parentBells = async (email: string) => (await db.collection("notifications").where("email", "==", email.toLowerCase()).get()).docs.map((d) => d.data());
// Transactional mail isn't logged to Firestore — lib/mailer.ts prints `[mail] "subject" → to` (sent or SUPPRESSED); capture it.
const mailLog: string[] = [];
console.log = (...a: unknown[]) => { const s = a.map(String).join(" "); if (s.startsWith("[mail]")) mailLog.push(s); origLog(...a); };
const emailsTo = async (email: string) => mailLog.filter((l) => l.toLowerCase().includes(`→ ${email.toLowerCase()}`)).length;
const bookingDoc = async (tenantId: string, ref: string) => (await db.collection("bookings").doc(`${tenantId}_${ref}`).get()).data();

await start();
let world: Record<string, string> = {};
try {
  const A = await mkTenant("freelancer", "P2H Ops A"); const OA = A.owner; const TA = A.tenantId;
  const B = await mkTenant("freelancer", "P2H Ops B"); const OB = B.owner; const TB = B.tenantId;
  const C = await mkTenant("company", "P2H Ops HO"); const HO = C.owner; const TC = C.tenantId; const F1 = await mkFranchise(TC, "P2H Ops F1"); const F2 = await mkFranchise(TC, "P2H Ops F2");
  const S = await mkStaff(TA, { franchiseId: null, name: "Ops Staff", staffRole: "Coach" });
  const S2 = await mkStaff(TA, { franchiseId: null, name: "Ops Lead", staffRole: "Lead", lead: true });
  const SH = await mkStaff(TC, { franchiseId: null, name: "Ops HO Staff", staffRole: "Coach" });
  const SF1 = await mkStaff(TC, { franchiseId: F1.franchiseId, name: "Ops F1 Staff", staffRole: "Coach" });
  const SF2 = await mkStaff(TC, { franchiseId: F2.franchiseId, name: "Ops F2 Staff", staffRole: "Coach" });
  const P = await mkParent("Ops Parent"); const P2 = await mkParent("Ops Parent Two"); const P3 = await mkParent("Ops Parent Three"); const P4 = await mkParent("Ops Parent Four");
  await setSettings(TA, null, { locations: [{ id: "v1", name: "Venue One" }], meals: { ordering: true, cutoffWhen: "prev", cutoffTime: "08:00", changeApproval: "auto" }, seasons: [{ id: "s-one", name: "Summer" }, { id: "s-empty", name: "Empty season" }] }); forgetSettings(TA);
  world = { TA, TB, TC, S: S.uid, S2: S2.uid, F1: F1.franchiseId, F2: F2.franchiseId, P: P.uid };
  origLog("world", world);

  async function listing(actor: Actor, title: string, extra: Record<string, unknown> = {}) {
    const l = await api(actor, "POST", "/api/listings", { title, passes: [{ name: "Day", price: 10 }], venueId: "v1", ...extra }); if (l.status !== 201) throw new Error(`listing ${l.status} ${l.text}`);
    await db.collection("listings").doc(l.json.id).set({ status: "live", venueId: "v1" }, { merge: true });
    return l.json.id as string;
  }
  async function block(actor: Actor, listingId: string, name: string, from: string, to: string, capacity: number, sessions?: { date: string; start: string; end: string }[]) {
    const b = await api(actor, "POST", "/api/blocks", { listingId, name, startDate: from, endDate: to, capacity, ...(sessions ? { sessions } : { schedule: { startTime: "09:00", endTime: "15:30", weekdays: [0, 1, 2, 3, 4, 5, 6] } }) }); if (b.status !== 201) throw new Error(`block ${b.status} ${b.text}`);
    return b.json.id as string;
  }
  async function child(parent: Actor, name: string, extra: Record<string, unknown> = {}) { const r = await api(parent, "POST", "/api/my/children", { name, dob: "2019-05-04", ...extra }); if (r.status !== 201) throw new Error(`child ${r.status} ${r.text}`); return r.json.id as string; }
  async function parentBook(parent: Actor, listingId: string, blockId: string, name: string, childId: string, dates: string[], age = 7) {
    const r = await api(parent, "POST", "/api/my/bookings", { listingId, blockId, method: "Bank transfer", items: [{ pass: "Day", child: name, childId, age, dates }] });
    return { status: r.status, ref: (r.json?.bookings?.[0]?.ref ?? r.json?.ref ?? null) as string | null, statusText: r.json?.bookings?.[0]?.status ?? r.json?.status, json: r.json, err: err(r) };
  }

  // Base world: listing L + block covering today..+6, P has a booking for K1 today (timetable/meals/trip/seasons hang off it).
  const L = await listing(OA, "P2H Ops Camp", { mealsEnabled: true });
  const BL = await block(OA, L, "Ops week", today, D(6), 50);
  const K1 = await child(P, "Ops Kid One"); const K2 = await child(P, "Ops Kid Nuts", { allergies: "nuts" });
  const R1 = await parentBook(P, L, BL, "Ops Kid One", K1, [today, D(2)]); if (!R1.ref) throw new Error(`base booking ${R1.status} ${R1.err}`);

  // ── p2-o1: task series + subtask-only assignee ─────────────────────────
  await step("p2-o1", async () => {
    const mk = await api(OA, "POST", "/api/tasks", { t: "Daily recon", due: today, repeat: { freq: "daily", until: D(6) } });
    const sid = mk.json?.seriesId as string;
    const all = (r: { json: any }) => ((r.json ?? []) as any[]).filter((t) => t.seriesId === sid);
    const l1 = all(await api(OA, "GET", "/api/tasks"));
    const byDue = (d: string) => l1.find((t) => t.due === d);
    const d1 = await api(OA, "PUT", `/api/tasks/${byDue(today)?.id}`, { status: "done" }); const d2 = await api(OA, "PUT", `/api/tasks/${byDue(D(1))?.id}`, { status: "done" });
    const shrink = await api(OA, "PUT", `/api/tasks/series/${sid}/range`, { from: today, until: D(2) });
    const l2 = all(await api(OA, "GET", "/api/tasks"));
    const doneKept = l2.filter((t) => t.status === "done").map((t) => t.due).sort();
    const futureGone = !l2.some((t) => t.due > D(2));
    // Shrink again so a DONE date falls outside: is it kept?
    const shrink2 = await api(OA, "PUT", `/api/tasks/series/${sid}/range`, { from: D(2), until: D(2) });
    const l3 = all(await api(OA, "GET", "/api/tasks"));
    const doneOutsideKept = l3.filter((t) => t.status === "done").length;
    const del = await api(OA, "DELETE", `/api/tasks/series/${sid}`);
    const l4 = all(await api(OA, "GET", "/api/tasks"));
    // Subtask-only assignee
    const t = await api(OA, "POST", "/api/tasks", { t: "Lead task", who: "Ops Lead", whoEmail: S2.email, subs: [{ t: "Coach step", done: false, who: "Ops Staff", whoEmail: S.email }, { t: "Lead step", done: false, who: "Ops Lead", whoEmail: S2.email }] });
    const mine = await api(S, "GET", "/api/tasks"); const flagged = ((mine.json ?? []) as any[]).find((x) => x.id === t.json?.id);
    const title = await api(S, "PUT", `/api/tasks/${t.json?.id}`, { t: "Hijacked" });
    const tick = await api(S, "PUT", `/api/tasks/${t.json?.id}`, { subs: [{ t: "Coach step", done: true, who: "Ops Staff", whoEmail: S.email }, { t: "Lead step", done: false, who: "Ops Lead", whoEmail: S2.email }] });
    const other = await api(S, "PUT", `/api/tasks/${t.json?.id}`, { subs: [{ t: "Coach step", done: true, who: "Ops Staff", whoEmail: S.email }, { t: "Lead step", done: true, who: "Ops Lead", whoEmail: S2.email }] });
    const ok = mk.status === 201 && mk.json?.created === 7 && d1.status === 200 && d2.status === 200 && shrink.status === 200 && doneKept.join(",") === `${today},${D(1)}` && futureGone && l2.length === 3 && doneOutsideKept === 2 && del.status === 200 && l4.length === 0 && flagged?.subtaskOnly === true && title.status === 403 && tick.status === 200 && other.status === 403;
    results["p2-o1"] = { verdict: ok ? "pass" : "fail", actual: `POST daily ×7 → ${mk.status} created=${mk.json?.created}; done ${today},${D(1)} → ${d1.status}/${d2.status}; PUT range ${today}→${D(2)} → ${shrink.status} ${JSON.stringify({ created: shrink.json?.created, removed: shrink.json?.removed, keptDone: shrink.json?.keptDone })}; left ${l2.length} (done kept: [${doneKept.join(",")}], future gone: ${futureGone}); range ${D(2)}→${D(2)} (done dates now outside) → ${shrink2.status} keptDone=${shrink2.json?.keptDone}, done rows still present: ${doneOutsideKept}; DELETE series → ${del.status} deleted=${del.json?.deleted}, left ${l4.length}; subtask-only: $S sees the task flagged subtaskOnly=${flagged?.subtaskOnly}; PUT {t} → ${title.status} ${err(title)}; tick own step → ${tick.status}; tick the lead's step → ${other.status}` };
  });

  // ── p2-o2: assignee list is the team ───────────────────────────────────
  await step("p2-o2", async () => {
    const asS = await api(S, "GET", "/api/tasks/assignees");
    const emailsOf = (r: { json: any }) => ((r.json?.groups ?? []) as any[]).flatMap((g) => g.people.map((p: any) => String(p.email).toLowerCase()));
    const a = emailsOf(asS);
    const outsideA = a.filter((e) => ![OA.email, S.email, S2.email].map((x) => x.toLowerCase()).includes(e));
    const asF1 = await api(SF1, "GET", "/api/tasks/assignees"); const f = emailsOf(asF1);
    const asF1m = await api(F1.actor, "GET", "/api/tasks/assignees"); const fm = emailsOf(asF1m);
    const f1Team = [F1.actor.email, SF1.email].map((x) => x.toLowerCase());
    const leakStaff = f.filter((e) => !f1Team.includes(e)); const leakMgr = fm.filter((e) => !f1Team.includes(e));
    const asHO = await api(HO, "GET", "/api/tasks/assignees");
    const ok = asS.status === 200 && outsideA.length === 0 && !a.includes(P.email.toLowerCase()) && asF1.status === 200 && leakStaff.length === 0 && leakMgr.length === 0;
    results["p2-o2"] = { verdict: ok ? "pass" : "fail", actual: `as $S (tenant A) → ${asS.status} people=[${a.join(",")}] outside A: [${outsideA.join(",") || "none"}] parent present: ${a.includes(P.email.toLowerCase())}; as F1 staff → ${asF1.status} people=[${f.join(",")}] outside F1: [${leakStaff.join(",") || "none"}]; as $F1 manager → ${asF1m.status} outside F1: [${leakMgr.join(",") || "none"}]; as HO → headOffice=${asHO.json?.headOffice} groups=[${(asHO.json?.groups ?? []).map((g: any) => `${g.name}:${g.people.length}`).join(",")}]`, notes: leakStaff.length || leakMgr.length ? "Fix needed: tasks.ts:187-194 — a non-head-office caller (a franchise manager or its staff) gets the FLAT list of every bucket in the tenant (head office + every sibling franchise); only role=company with franchises is grouped. A franchise should get its own bucket only." : undefined };
  });

  // ── p2-o3: calendar reminders (validation half here; sweep half needs a runner) ─
  await step("p2-o3", async () => {
    const bad = await api(OA, "POST", "/api/calendar-events", { title: "Backwards", date: D(1), start: "14:00", end: "10:00" });
    const badRange = await api(OA, "POST", "/api/calendar-events", { title: "Backwards range", date: D(3), endDate: D(1), allDay: true });
    const { date: ukDate, minutes } = ukNow(); const hh = String(Math.floor((minutes + 3) / 60) % 24).padStart(2, "0"); const mm = String((minutes + 3) % 60).padStart(2, "0");
    const ev = await api(OA, "POST", "/api/calendar-events", { title: "Reminder test", date: ukDate, start: `${hh}:${mm}`, end: "23:59", remindMode: "on", remindMinutes: 2 });
    const bellsBefore = (await tenantBells(TA)).filter((n) => n.category === "calendar").length;
    await wait(2000);
    const bellsAfter = (await tenantBells(TA)).filter((n) => n.category === "calendar").length;
    const validationOk = bad.status === 400 && badRange.status === 400;
    results["p2-o3"] = { verdict: validationOk ? "blocked" : "fail", actual: `POST end 10:00 before start 14:00 → ${bad.status}${bad.status === 201 ? " (stored as-is)" : ` ${err(bad)}`}; endDate before date → ${badRange.status}; POST event at ${hh}:${mm} UK with remindMode on / 2 min → ${ev.status}; calendar bells without a sweep: ${bellsBefore}→${bellsAfter}. Reminder-fires-once half: needs a sweep runner (calendarReminders is module-private in src/lib/sweeps.ts:50 and startSweeps() would run every production sweep in-process).`, notes: validationOk ? "Sweep half unverified in-process." : "Fix needed: calendarEvents.ts:16-31 eventSchema has no start<end / date<=endDate refinement — an event that ends before it starts is stored (the plan expects 400). Reminder half unverified (needs a sweep runner)." };
  });

  // ── p2-o4: timetable publish snapshot ──────────────────────────────────
  await step("p2-o4", async () => {
    const cfg = { start: "09:00", end: "15:30", perDay: 1, breaks: 0, lunch: "12:00", signin: ["09:00"], signout: ["15:30"], wholeTimes: [], groups: ["Group A"] };
    const cell = (name: string) => ({ name, color: "#f00", cat: "Sport", place: "Hall" });
    const body = (name: string, act: string) => ({ name, dateFrom: today, dateTo: today, excluded: [], config: cfg, dayList: [{ n: "D", d: today.slice(5), iso: today }], plan: [[{ type: "session", time: "09:00", cells: [cell(act)] }]], mode: "manual" });
    const mk = await api(OA, "POST", "/api/timetables", body("Week one", "Football"));
    const pBefore = (await parentBells(P.email)).length; const eBefore = await emailsTo(P.email);
    const pub = await api(OA, "POST", `/api/timetables/${mk.json?.id}/publish`, { staff: true, parents: true, audience: "everyone", notifyEmail: true });
    const edit = await api(OA, "PUT", `/api/timetables/${mk.json?.id}`, body("Week one EDITED", "Tennis"));
    await wait(2000);
    const asP = await api(P, "GET", "/api/timetables/published"); const seen = ((asP.json ?? []) as any[]).find((t) => t.id === mk.json?.id);
    const seenAct = seen?.plan?.[0]?.[0]?.cells?.[0]?.name;
    const pAfter = (await parentBells(P.email)).length; const eAfter = await emailsTo(P.email);
    const frozen = !!seen && seen.name === "Week one" && seenAct === "Football" && edit.json?.name === "Week one EDITED";
    const ok = mk.status === 201 && pub.status === 200 && edit.status === 200 && frozen && pAfter === pBefore && eAfter === eBefore;
    results["p2-o4"] = { verdict: ok ? "pass" : "fail", actual: `POST timetable → ${mk.status}; publish {parents, notifyEmail} → ${pub.status} published.at=${pub.json?.published?.at ? "set" : "missing"}; PUT draft (name+activity changed) → ${edit.status} draft name="${edit.json?.name}"; GET /published as $P → ${asP.status}: sees name="${seen?.name}" activity="${seenAct}" (frozen: ${frozen}); parent bells ${pBefore}→${pAfter}, emails ${eBefore}→${eAfter}`, notes: "Owed (Amir 22): notifyEmail/notifyPush are accepted by publishSchema (timetables.ts:299-309) and dropped — no parent email or bell is sent on publish." };
  });

  // ── p2-o5: inventory order → received → carry-over ─────────────────────
  await step("p2-o5", async () => {
    const it = await api(OA, "POST", "/api/inventory", { name: "Footballs", quantity: 5, minQty: 3, season: "Summer 2026", unit: "units" });
    const ord = await api(OA, "POST", `/api/inventory/${it.json?.id}/order`, { quantity: 10, cost: 25, category: "Equipment" });
    const rec = await api(OA, "POST", `/api/inventory/${it.json?.id}/received`, {});
    const carry = await api(OA, "POST", "/api/inventory/carry-over", { fromSeason: "Summer 2026", toSeason: "Autumn 2026" });
    const list = await api(OA, "GET", "/api/inventory"); const rolled = ((list.json ?? []) as any[]).find((x) => x.season === "Autumn 2026" && x.name === "Footballs");
    const clr = await api(OA, "PUT", `/api/inventory/${it.json?.id}`, { minQty: null });
    const neg = await api(OA, "PUT", `/api/inventory/${it.json?.id}`, { quantity: -1 });
    const exp = (await db.collection("expenses").doc(String(ord.json?.orderExpenseId ?? "x")).get()).data();
    const ok = it.status === 201 && ord.status === 200 && rec.status === 200 && rec.json?.quantity === 15 && carry.status === 200 && carry.json?.copied === 1 && rolled?.quantity === 15 && rolled?.carriedFrom === "Summer 2026" && clr.status === 200 && clr.json?.minQty === null && neg.status === 400;
    results["p2-o5"] = { verdict: ok ? "pass" : "fail", actual: `POST item qty 5 → ${it.status}; /order {quantity:10, cost:25} → ${ord.status} ordered=${ord.json?.ordered} expense created=${!!exp} (£${exp?.amount}); /received → ${rec.status} quantity=${rec.json?.quantity} ordered=${rec.json?.ordered}; /carry-over Summer→Autumn → ${carry.status} copied=${carry.json?.copied}; new-season item quantity=${rolled?.quantity} carriedFrom=${rolled?.carriedFrom} lastCheckedAt=${rolled?.lastCheckedAt}; PUT {minQty:null} → ${clr.status} minQty=${clr.json?.minQty}; PUT {quantity:-1} → ${neg.status} ${err(neg)}`, notes: "The reorder level is the `minQty` field (the plan's reorderLevel); the order body is {quantity, cost, category} not {qty}." };
  });

  // ── p2-o6: low-stock bell ──────────────────────────────────────────────
  await step("p2-o6", async () => {
    await setSettings(TA, null, { inventory: { lowStockAlert: true } }); forgetSettings(TA);
    const it = await api(OA, "POST", "/api/inventory", { name: "Bibs", quantity: 10, minQty: 5, season: "Summer 2026" });
    const b0 = (await tenantBells(TA)).length;
    const low = await api(OA, "POST", `/api/inventory/${it.json?.id}/check`, { quantity: 2 });
    await wait(2500);
    const b1 = (await tenantBells(TA)).length;
    const inv = (await tenantBells(TA)).filter((n) => /stock|inventory|bibs/i.test(`${n.title} ${n.body}`)).length;
    results["p2-o6"] = { verdict: "fail", actual: `Setup inventory.lowStockAlert=true; item minQty 5; /check {quantity:2} → ${low.status} quantity=${low.json?.quantity}; provider bells ${b0}→${b1} (stock-related: ${inv}). No low-stock sweep exists to wait for: src/lib/sweeps.ts registers no inventory sweep and nothing in server/src raises a stock alert.`, notes: "Fix needed: low-stock alerts are client-side only — settings.inventory.lowStockAlert (lib/settings.ts:957) just filters/badges the Inventory page (features/inventory/InventoryApp.tsx:45). No server sweep, no notify() call, so the 'one bell per item, none while OFF' behaviour has nothing to test until a sweep is written." };
  });

  // ── Meals world (o7–o10): a day-menu on L, orders by $P ────────────────
  const menu = await api(OA, "POST", "/api/meal-menus", { name: "Ops menu", items: [{ id: "m-pasta", name: "Pasta", price: 3, allergens: [] }, { id: "m-satay", name: "Peanut satay", price: 3.5, allergens: ["nuts"] }, { id: "m-jacket", name: "Jacket potato", price: 2.5, allergens: [] }] });
  const D1 = D(2); const D2 = D(3);
  const plan = await api(OA, "PUT", `/api/listings/${L}`, { mealsEnabled: true, mealPlan: { [D1]: { menuId: menu.json?.id, itemIds: [] }, [D2]: { menuId: menu.json?.id, itemIds: [] } } });
  origLog("  meals world", { menu: menu.status, plan: plan.status });

  // ── p2-o7: meal shop lifecycle + cut-off ───────────────────────────────
  await step("p2-o7", async () => {
    const countOrdered = async () => (await tenantBells(TA)).filter((n) => /ordered a meal for Ops Kid One/i.test(n.title)).length;
    const b0 = await countOrdered();
    const o1 = await api(P, "POST", "/api/meal-orders", { tenantId: TA, listingId: L, date: D1, childName: "Ops Kid One", childId: K1, items: [{ menuItemId: "m-pasta", qty: 1 }] });
    await wait(2000);
    const bells = { length: (await countOrdered()) - b0 };
    const chg1 = await api(P, "POST", `/api/meal-orders/${o1.json?.id}/change`, { menuItemId: "m-jacket" });
    // Close the day: listing cut-off 2 days before at 00:01 → D1 (today+2) closed as of today 00:01.
    const cut = await api(OA, "PUT", `/api/listings/${L}`, { mealConfig: { cutoffWhen: "2days", cutoffTime: "00:01" } });
    const chg2 = await api(P, "POST", `/api/meal-orders/${o1.json?.id}/change`, { menuItemId: "m-pasta" });
    const can2 = await api(P, "POST", `/api/meal-orders/${o1.json?.id}/cancel`, {});
    const after = (await db.collection("mealOrders").doc(String(o1.json?.id)).get()).data();
    // Re-open and place a second order (D2) to pay + report
    await api(OA, "PUT", `/api/listings/${L}`, { mealConfig: { cutoffWhen: "off" } });
    const o2 = await api(P, "POST", "/api/meal-orders", { tenantId: TA, listingId: L, date: D2, childName: "Ops Kid One", childId: K1, items: [{ menuItemId: "m-pasta", qty: 1 }] });
    const pay = await api(OA, "POST", `/api/meal-orders/${o2.json?.id}/pay`, {});
    const payChg = await api(P, "POST", `/api/meal-orders/${o2.json?.id}/change`, { menuItemId: "m-jacket" });
    const rep = await api(OA, "GET", "/api/meal-orders/report"); const rows = ((rep.json?.rows ?? []) as any[]).filter((r) => r.listingId === L);
    const kitchen = await api(OA, "GET", "/api/meal-orders"); const live = ((kitchen.json ?? []) as any[]).filter((o) => o.status !== "cancelled");
    const kitchenUnits = live.reduce((n, o) => n + (o.items ?? []).reduce((s: number, i: any) => s + (i.qty ?? 1), 0), 0);
    const kitchenTotal = live.reduce((n, o) => n + (o.total ?? 0), 0); const repTotal = rows.reduce((n, r) => n + (r.price ?? 0), 0);
    const ok = o1.status === 201 && bells.length === 1 && chg1.status === 200 && chg1.json?.items?.[0]?.menuItemId === "m-jacket" && chg2.status === 409 && can2.status === 409 && pay.status === 200 && pay.json?.pay === "Paid" && rep.status === 200 && rows.length === kitchenUnits && Math.abs(repTotal - kitchenTotal) < 0.005 && rows.every((r) => "allergies" in r);
    results["p2-o7"] = { verdict: ok ? "pass" : "fail", actual: `POST order (D1=${D1}) → ${o1.status} total=${o1.json?.total}; provider 'ordered a meal' bells: ${bells.length}; /change before cut-off → ${chg1.status} item=${chg1.json?.items?.[0]?.name}; listing cut-off 2 days@00:01 → ${cut.status}; /change after cut-off → ${chg2.status} ${err(chg2)}; /cancel after cut-off → ${can2.status} ${err(can2)} (order status now "${after?.status}"); second order (D2) → ${o2.status}; /pay → ${pay.status} pay=${pay.json?.pay}; change a paid order → ${payChg.status}; report → ${rep.status} rows=${rows.length} total=£${repTotal.toFixed(2)} vs operator order list units=${kitchenUnits} total=£${kitchenTotal.toFixed(2)}; every row carries allergies/dietary: ${rows.every((r) => "allergies" in r)}`, notes: can2.status !== 409 ? "Fix needed: POST /api/meal-orders/:id/cancel (mealsShop.ts:644-668) never checks the meal cut-off — a family cancels a closed day's meal outright while /change (mealsShop.ts:687 via resolveDishForDay) is refused 409. The kitchen's final numbers can still drop after the cut-off." : undefined };
  });

  // ── p2-o8: allergen vs menu item ───────────────────────────────────────
  await step("p2-o8", async () => {
    const o = await api(P, "POST", "/api/meal-orders", { tenantId: TA, listingId: L, date: D2, childName: "Ops Kid Nuts", childId: K2, items: [{ menuItemId: "m-satay", qty: 1 }] });
    const warnKeys = Object.keys(o.json ?? {}).filter((k) => /warn|allerg|conflict/i.test(k));
    const rep = await api(OA, "GET", "/api/meal-orders/report"); const row = ((rep.json?.rows ?? []) as any[]).find((r) => r.child === "Ops Kid Nuts" && r.dish === "Peanut satay");
    const days = await api(P, "GET", "/api/my/meal-days"); const day = ((days.json ?? []) as any[]).find((d) => d.listingId === L && d.date === D2);
    const dayWarn = JSON.stringify(day ?? {}).match(/nuts/gi)?.length ?? 0;
    const blockedOrWarned = o.status >= 400 || warnKeys.length > 0;
    const ok = blockedOrWarned && row?.allergies === "nuts";
    results["p2-o8"] = { verdict: ok ? "pass" : "fail", actual: `child allergies="nuts" orders "Peanut satay" (allergens [nuts]) → ${o.status} ${o.status >= 400 ? err(o) : `accepted; warning keys in the response: [${warnKeys.join(",") || "none"}]; line allergens=[${(o.json?.items?.[0]?.allergens ?? []).join(",")}]`}; kitchen report row: dish="${row?.dish}" allergies="${row?.allergies}"; parent meal-days entry for that day mentions the child's allergy: ${dayWarn > 0} (allergenNote="${day?.allergenNote ?? ""}")`, notes: blockedOrWarned ? undefined : "Fix needed: POST /api/meal-orders (mealsShop.ts:443-619) never compares the dish's allergens with the child's profile allergies — a nut-allergic child's nut dish is accepted with no warning field; the only allergen surface is the provider's free-text meals.allergenNote on meal-days. The report does flag the child (careOf join, mealsShop.ts:363-365)." };
  });

  // ── p2-o9: the parent half of meal notifications (owed, Amir 23) ───────
  await step("p2-o9", async () => {
    await setSettings(TA, null, { meals: { ordering: true, cutoffWhen: "off", changeApproval: "review" } }); forgetSettings(TA);
    await api(OA, "PUT", `/api/listings/${L}`, { mealConfig: { cutoffWhen: "off" } });
    const o = await api(P, "POST", "/api/meal-orders", { tenantId: TA, listingId: L, date: D1, childName: "Ops Kid Nuts", childId: K2, items: [{ menuItemId: "m-pasta", qty: 1 }] });
    const countAsk = async () => (await tenantBells(TA)).filter((n) => /change requested/i.test(n.title)).length;
    const b0 = await countAsk();
    const req = await api(P, "POST", `/api/meal-orders/${o.json?.id}/change`, { menuItemId: "m-jacket" });
    await wait(2000);
    const askBells = (await countAsk()) - b0;
    const p0 = (await parentBells(P.email)).length; const e0 = await emailsTo(P.email);
    const appr = await api(OA, "POST", `/api/meal-orders/${o.json?.id}/request`, { action: "approve" });
    await wait(2000);
    const p1 = (await parentBells(P.email)).length; const e1 = await emailsTo(P.email);
    const applied = appr.json?.items?.[0]?.menuItemId === "m-jacket" && appr.json?.changeRequest === null;
    const ok = o.status === 201 && req.status === 200 && !!req.json?.changeRequest && askBells === 1 && appr.status === 200 && applied;
    results["p2-o9"] = { verdict: ok ? "pass" : "fail", actual: `changeApproval=review; order → ${o.status}; parent /change → ${req.status} changeRequest=${req.json?.changeRequest ? "pending (" + req.json.changeRequest.name + ")" : "none"}; provider 'change requested' bells: ${askBells}; $A /request {approve} → ${appr.status} applied=${applied}; parent bells ${p0}→${p1}, parent emails ${e0}→${e1} (nothing, as expected while owed)`, notes: "Owed (Amir 23): POST /api/meal-orders/:id/request approve/decline (mealsShop.ts:702-735) writes the order and never notifies the family — no bell, no email." };
  });

  // ── p2-o10: caterer digest (owed, Amir 24) ─────────────────────────────
  await step("p2-o10", async () => {
    const { minutes } = ukNow(); const at = `${String(Math.floor((minutes + 1) / 60) % 24).padStart(2, "0")}:${String((minutes + 1) % 60).padStart(2, "0")}`;
    const catererEmail = `caterer-${TA.slice(0, 6).toLowerCase()}@p2h.test`;
    const put = await api(OA, "PUT", `/api/listings/${L}`, { mealConfig: { catererEmail, catererEvery: "day", catererAt: at, cutoffWhen: "off" } });
    const stored = put.json?.mealConfig;
    const e0 = await emailsTo(catererEmail);
    await wait(2500);
    const e1 = await emailsTo(catererEmail);
    const ok = put.status === 200 && stored?.catererEmail === catererEmail && stored?.catererAt === at && e1 === e0;
    results["p2-o10"] = { verdict: ok ? "pass" : "fail", actual: `PUT mealConfig {catererEmail, catererEvery:day, catererAt:${at}} → ${put.status} stored=${JSON.stringify(stored)}; emails to the caterer after the time: ${e0}→${e1}. No sender exists to wait for: nothing in server/src reads catererEmail/catererAt (listings.ts:128-137 stores them and says 'Caterer emailing is a backend cron (Amir)'); the UI's Meals config shows the same note.`, notes: "Owed (Amir 24): no caterer digest sweep — settings are stored only." };
  });

  // ── p2-o11: seasons join + sentinel ────────────────────────────────────
  await step("p2-o11", async () => {
    const L2 = await listing(OA, "P2H Ops Other camp"); const BL2 = await block(OA, L2, "Other week", today, D(6), 50);
    const K3 = await child(P2, "Ops Kid Three"); const R2 = await parentBook(P2, L2, BL2, "Ops Kid Three", K3, [today]);
    const put = await api(OA, "PUT", `/api/listings/${L}`, { seasonId: "s-one" });
    const mine = await api(OA, "GET", "/api/listings?mine=1"); const bySeason = (id: string) => ((mine.json ?? []) as any[]).filter((l) => l.seasonId === id).map((l) => l.id);
    const all = await api(OA, "GET", "/api/bookings"); const bk = (all.json ?? []) as any[];
    // The client-side join (features/email/EmailApp.tsx:1513): listings of the season, or ["__none__"] when the season has none.
    const filt = (id: string) => { const ids = bySeason(id); const f = ids.length ? ids : ["__none__"]; return bk.filter((b) => f.includes(b.listingId)).map((b) => b.ref); };
    const inOne = filt("s-one"); const inEmpty = filt("s-empty");
    const viaQuery = await api(OA, "GET", "/api/bookings?seasonId=s-empty"); const serverIgnores = (viaQuery.json ?? []).length === bk.length;
    await setSettings(TA, null, { seasons: [{ id: "s-empty", name: "Empty season" }] }); forgetSettings(TA);
    const afterDel = await api(OA, "GET", `/api/listings/${L}`); const orphan = afterDel.json?.seasonId;
    const pubL = await api(null, "GET", `/api/listings?tenantId=${TA}`); const pubSeason = ((pubL.json ?? []) as any[]).find((l) => l.id === L)?.season;
    const ok = put.status === 200 && inOne.includes(R1.ref!) && !inOne.includes(R2.ref!) && inEmpty.length === 0 && bk.length >= 2;
    results["p2-o11"] = { verdict: ok ? "pass" : "fail", actual: `PUT seasonId=s-one on L → ${put.status}; listings in s-one=[${bySeason("s-one").length}] s-empty=[${bySeason("s-empty").length}]; GET /api/bookings → ${all.status} ${bk.length} bookings; join by listing (client rule): s-one → [${inOne.join(",")}] (L's ${R1.ref} in, L2's ${R2.ref} out), s-empty → [${inEmpty.join(",") || "nobody"}] via the __none__ sentinel; GET /api/bookings?seasonId=s-empty → ${viaQuery.status} ${(viaQuery.json ?? []).length} rows (server ignores the param: ${serverIgnores}); delete season s-one → listing keeps seasonId="${orphan}" (public feed shows season=${JSON.stringify(pubSeason)})`, notes: "Record: the season filter is client-side only (EmailApp.tsx:1513 seasonListingFilter, listing ids or ['__none__']) — no server route filters bookings by season; GET /api/bookings ignores ?seasonId. Deleting a season leaves the orphan id on the listing (listings.ts resolves it to season=null on the public feed)." };
  });

  // ── p2-o12: bundle duplicate / archive / reorder ───────────────────────
  await step("p2-o12", async () => {
    const per = await api(OA, "POST", "/api/periods", { title: "Full day", start: "09:00", finish: "15:30" });
    const pas = await api(OA, "POST", "/api/passes", { name: "Day pass", days: 1 });
    const bun = await api(OA, "POST", "/api/block-bundles", { name: "Ops bundle", periodIds: [per.json?.id], passIds: [pas.json?.id] });
    const L3 = await listing(OA, "P2H Ops Bundled"); const BL3 = await block(OA, L3, "Bundled week", today, D(6), 50);
    const att = await api(OA, "PUT", `/api/block-bundles/${bun.json?.id}/listings`, { listingIds: [L3] });
    const K4 = await child(P3, "Ops Kid Four"); const R3 = await parentBook(P3, L3, BL3, "Ops Kid Four", K4, [today]);
    const dup = await api(OA, "POST", `/api/block-bundles/${bun.json?.id}/duplicate`, {});
    const arc = await api(OA, "POST", `/api/block-bundles/${bun.json?.id}/archive`, { archived: true });
    const foreignB = await api(OB, "POST", "/api/block-bundles", { name: "B bundle" });
    const reorder = await api(OA, "POST", "/api/block-bundles/reorder", { orderedIds: [bun.json?.id, foreignB.json?.id] });
    const feedBundle = await api(null, "GET", `/api/listings?tenantId=${TA}`); const stillListed = ((feedBundle.json ?? []) as any[]).some((l) => l.id === L3);
    const arcL = await api(OA, "PUT", `/api/listings/${L3}`, { archived: true });
    const feed2 = await api(null, "GET", `/api/listings?tenantId=${TA}`); const hidden = !((feed2.json ?? []) as any[]).some((l) => l.id === L3);
    const bks = await api(OA, "GET", "/api/bookings"); const intact = ((bks.json ?? []) as any[]).find((b) => b.ref === R3.ref);
    const ok = bun.status === 201 && att.status === 200 && dup.status === 201 && dup.json?.id !== bun.json?.id && (dup.json?.listingIds ?? []).length === 0 && arc.status === 200 && arc.json?.archived === true && reorder.status === 400 && hidden && !!intact && intact.status !== "Cancelled";
    results["p2-o12"] = { verdict: ok ? "pass" : "fail", actual: `bundle → ${bun.status}; attach to L3 → ${att.status}; booking on L3 ${R3.ref} → ${R3.status}; /duplicate → ${dup.status} newId=${dup.json?.id !== bun.json?.id} name="${dup.json?.name}" listingIds=[${(dup.json?.listingIds ?? []).join(",")}]; /archive → ${arc.status} archived=${arc.json?.archived}; public feed still shows L3 after the BUNDLE is archived: ${stillListed}; /reorder with tenant B's id → ${reorder.status} ${err(reorder)}; archive the LISTING → ${arcL.status}; public feed hides L3: ${hidden}; booking ${R3.ref} intact: ${!!intact} status=${intact?.status}`, notes: `Foreign id is refused as 404 "Bundle … not found" (blockBundles.ts:365) rather than the plan's 400 — same protection, different code. Archiving a bundle does not touch the public feed (the listing's own archived flag does); the duplicate has a new id and no listings/bookings.` };
  });

  // ── p2-o13: listings never auto-expire ─────────────────────────────────
  await step("p2-o13", async () => {
    const LP = await listing(OA, "P2H Ops Last month");
    const BP = await block(OA, LP, "Past week", D(-40), D(-34), 20);
    const mine = await api(OA, "GET", "/api/listings?mine=1"); const row = ((mine.json ?? []) as any[]).find((l) => l.id === LP);
    const pub = await api(null, "GET", `/api/listings?tenantId=${TA}`); const inFeed = ((pub.json ?? []) as any[]).some((l) => l.id === LP);
    const direct = await api(null, "GET", `/api/listings/${LP}`);
    const ok = !!row && row.status === "live" && !inFeed;
    results["p2-o13"] = { verdict: ok ? "pass" : "fail", actual: `listing with one block ${D(-40)}→${D(-34)} (block ${BP.slice(0, 6)}…): GET ?mine=1 → status="${row?.status}" archived=${row?.archived ?? false} blocks=${row?.blocks?.length}; public feed (?tenantId) lists it: ${inFeed}; direct GET /api/listings/:id → ${direct.status}`, notes: "Record (Amir 43): the public feed drops it on the dates gate (listings.ts:373-381 hasUpcomingBlock) but the stored status stays 'live' — ?mine=1 counts, HQ analytics and anything keyed on status:'live' overstate." };
  });

  // ── p2-o14: per-age caps ───────────────────────────────────────────────
  await step("p2-o14", async () => {
    await setSettings(TA, null, { ageGroups: [{ id: "g57", name: "5–7", from: 5, to: 7 }] }); forgetSettings(TA);
    const LC = await listing(OA, "P2H Ops Capped", { ageFrom: "5", ageTo: "7" }); const BC = await block(OA, LC, "Capped week", today, D(6), 20);
    const save = await api(OA, "PUT", `/api/listings/${LC}`, { ageCaps: { g57: 1 }, ageCapsOn: true });
    const back = await api(OA, "GET", `/api/listings/${LC}`); const caps = back.json?.ageCaps; const survived = caps?.g57 === 1 && back.json?.ageCapsOn === true;
    const K5 = await child(P2, "Ops Kid Five", { dob: "2020-05-04" }); const K6 = await child(P3, "Ops Kid Six", { dob: "2020-05-04" });
    const b1 = await parentBook(P2, LC, BC, "Ops Kid Five", K5, [D(1)], 6); const b2 = await parentBook(P3, LC, BC, "Ops Kid Six", K6, [D(1)], 6);
    const secondRefused = b2.status >= 400 || b2.statusText === "Waitlisted";
    const ok = save.status === 200 && survived && b1.status === 201 && secondRefused;
    results["p2-o14"] = { verdict: ok ? "pass" : "fail", actual: `PUT ageCaps {g57:1} ageCapsOn → ${save.status}; GET back: ageCaps=${JSON.stringify(caps)} ageCapsOn=${back.json?.ageCapsOn} (survived: ${survived}); first 6-year-old → ${b1.status} ${b1.statusText ?? ""}; second 6-year-old → ${b2.status} ${b2.status >= 400 ? b2.err : b2.statusText} (refused/waitlisted: ${secondRefused})`, notes: secondRefused ? undefined : "Fix needed (§S, known): the caps are stored and returned (listings.ts:88-93) but POST /api/my/bookings never reads ageCaps — capacity is block-wide only (my.ts:1259-1283). The wizard's 'Enforced once the backend is built' badge still applies." };
  });

  // ── p2-o15: waitlist offer chain ───────────────────────────────────────
  await step("p2-o15", async () => {
    const LW = await listing(OA, "P2H Ops Waitlist", { waitlist: true, waitlistMode: "auto" }); const BW = await block(OA, LW, "Waitlist day", D(4), D(4), 1);
    const KA = await child(P, "Ops Kid Wait A"); const KB = await child(P2, "Ops Kid Wait B"); const KC = await child(P3, "Ops Kid Wait C");
    const a = await parentBook(P, LW, BW, "Ops Kid Wait A", KA, [D(4)]); const b = await parentBook(P2, LW, BW, "Ops Kid Wait B", KB, [D(4)]); const c = await parentBook(P3, LW, BW, "Ops Kid Wait C", KC, [D(4)]);
    const canc = await api(OA, "POST", `/api/bookings/${a.ref}/actions`, { type: "cancel", refund: "none" });
    await wait(2500);
    const bAfter = await bookingDoc(TA, b.ref!); const cAfter = await bookingDoc(TA, c.ref!);
    const decl = await api(P2, "POST", `/api/my/bookings/${b.ref}/decline-offer`, { tenantId: TA });
    await wait(2500);
    const cOffered = await bookingDoc(TA, c.ref!);
    const acc = await api(P3, "POST", `/api/my/bookings/${c.ref}/accept-offer`, { tenantId: TA });
    // Expiry: a fresh block; $P holds it, $P2 + $P4 queue; cancel → $P2 offered; back-date the offer; run the sweep fn.
    const BX = await block(OA, LW, "Expiry day", D(5), D(5), 1);
    const KD = await child(P4, "Ops Kid Wait D");
    const x1 = await parentBook(P, LW, BX, "Ops Kid Wait A", KA, [D(5)]); const x2 = await parentBook(P2, LW, BX, "Ops Kid Wait B", KB, [D(5)]); const x4 = await parentBook(P4, LW, BX, "Ops Kid Wait D", KD, [D(5)]);
    await api(OA, "POST", `/api/bookings/${x1.ref}/actions`, { type: "cancel", refund: "none" });
    await wait(2500);
    const x2Off = await bookingDoc(TA, x2.ref!);
    await db.collection("bookings").doc(`${TA}_${x2.ref}`).set({ offerExpiresAt: new Date(Date.now() - 60_000).toISOString() }, { merge: true });
    // Before the sweep: accept-offer itself refuses an expired offer on read.
    const lateAccept = await api(P2, "POST", `/api/my/bookings/${x2.ref}/accept-offer`, { tenantId: TA });
    await expireOffers(); await wait(1500);
    const x2Exp = await bookingDoc(TA, x2.ref!); const x4Exp = await bookingDoc(TA, x4.ref!);
    const reissued = x2Exp?.status === "Offered" && x2Exp?.offeredAt !== x2Off?.offeredAt;
    const movedOn = x4Exp?.status === "Offered";
    const chainOk = a.statusText !== "Waitlisted" && b.statusText === "Waitlisted" && c.statusText === "Waitlisted" && canc.status === 200 && bAfter?.status === "Offered" && cAfter?.status === "Waitlisted" && decl.status === 200 && cOffered?.status === "Offered" && acc.status === 200 && acc.json?.status === "Confirmed";
    const ok = chainOk && x2Off?.status === "Offered" && lateAccept.status === 409 && movedOn;
    results["p2-o15"] = { verdict: ok ? "pass" : "fail", actual: `cap 1, auto: $P → ${a.status} ${a.statusText}; $P2 → ${b.statusText}; $P3 → ${c.statusText}; $A cancels $P → ${canc.status}; after 2.5s: $P2=${bAfter?.status} $P3=${cAfter?.status}; $P2 /decline-offer → ${decl.status}; $P3 now ${cOffered?.status}; $P3 /accept-offer → ${acc.status} ${acc.json?.status ?? err(acc)}. Expiry (fresh block, $P2 then $P4 queued): $P2 ${x2Off?.status} offeredAt=${x2Off?.offeredAt}; offerExpiresAt back-dated; $P2 accept-offer → ${lateAccept.status} ${err(lateAccept)}; expireOffers(): $P2=${x2Exp?.status} offeredAt=${x2Exp?.offeredAt} note="${x2Exp?.note}" (re-issued to the same family: ${reissued}), $P4=${x4Exp?.status} (moved on: ${movedOn})`, notes: `Expired offers are handled by SWEEP — 'waitlist-expiry' runs expireOffers() every 5 min (sweeps.ts:789) and accept-offer refuses an expired offer on read (my.ts:1913). ${movedOn ? "" : "Fix needed / decision: expireOffers (lib/waitlist.ts:129-164) puts the booking back to Waitlisted and then triggerWaitlist re-walks the queue in REF order — the family that just let the offer lapse is the oldest ref, so it is re-offered a fresh 2h hold every sweep and the next family in line is never reached."}` };
  });

  // ── p2-o16: cut-off, both doors ────────────────────────────────────────
  await step("p2-o16", async () => {
    const LT = await listing(OA, "P2H Ops Cutoff", { bookingCutoffHours: "2" });
    const wall = ukWallClock(new Date(Date.now() + 60 * 60_000)); const sDate = wall.slice(0, 10); const sStart = wall.slice(11, 16);
    const endH = Math.min(23, Number(sStart.slice(0, 2)) + 1); const sEnd = `${String(endH).padStart(2, "0")}:${endH === 23 ? "59" : sStart.slice(3)}`;
    const BT = await block(OA, LT, "Soon session", sDate, sDate, 10, [{ date: sDate, start: sStart, end: sEnd }]);
    const KT = await child(P2, "Ops Kid Late");
    const par = await parentBook(P2, LT, BT, "Ops Kid Late", KT, [sDate]);
    const op = await api(OA, "POST", "/api/bookings", { booker: "Ops Parent Two", email: P2.email, child: "Ops Kid Late", age: 7, listing: "P2H Ops Cutoff", pass: "Day", blockId: BT, amount: 10, method: "Cash", phone: "07000000000" });
    const ok = par.status === 409 && op.status === 201;
    results["p2-o16"] = { verdict: ok ? "pass" : "fail", actual: `listing cut-off 2h; session ${sDate} ${sStart}–${sEnd} UK (1h ahead); parent POST /api/my/bookings → ${par.status} ${par.err}; operator POST /api/bookings same block → ${op.status} ${op.status === 201 ? `ref ${op.json?.ref} status ${op.json?.status}` : err(op)} (operator door open: ${op.status === 201})`, notes: par.status === 400 ? "Family refusal is a 400, not the plan's 409 (my.ts:956 HttpError(400) with the 'Bookings for … have closed' message) — same gate, different code. The operator door is deliberately open (bookings.ts POST / never reads bookingCutoffHours)." : undefined };
  });

  // ── p2-o17: bulk with a bad row ────────────────────────────────────────
  await step("p2-o17", async () => {
    const LB = await listing(OA, "P2H Ops Bulk"); const BB = await block(OA, LB, "Bulk day", D(3), D(3), 26);
    const refs: string[] = []; const statuses: string[] = []; const codes: number[] = [];
    for (let i = 1; i <= 50; i++) {
      const r = await api(OA, "POST", "/api/bookings", { booker: `Bulk Family ${i}`, email: `bulk-${i}-${TA.slice(0, 5).toLowerCase()}@p2h.test`, child: `Bulk Kid ${i}`, age: 7, listing: "P2H Ops Bulk", pass: "Day", blockId: BB, amount: 10, method: "Cash" });
      codes.push(r.status); if (r.status === 201) { refs.push(r.json.ref); statuses.push(r.json.status); }
    }
    const firstWait = statuses.findIndex((s) => s === "Waitlisted") + 1;
    const blk0 = (await db.collection("blocks").doc(BB).get()).data();
    const bulk = await api(OA, "POST", "/api/bookings/bulk", { refs, action: "approve" });
    const blk1 = (await db.collection("blocks").doc(BB).get()).data();
    const after = await api(OA, "GET", "/api/bookings"); const rows = ((after.json ?? []) as any[]).filter((b) => b.blockId === BB);
    const confirmed = rows.filter((b) => b.status === "Confirmed").length; const waitl = rows.filter((b) => b.status === "Waitlisted").length;
    const perRow = Array.isArray(bulk.json) ? bulk.json.length : null;
    const allOrNothing = bulk.status === 200 && (confirmed === 50 || confirmed === 26) && bulk.status !== 500;
    const ok = allOrNothing && bulk.status !== 500;
    results["p2-o17"] = { verdict: ok ? "pass" : "fail", actual: `POST /api/bookings ×50 on a block of 26 → codes ${[...new Set(codes)].join("/")}, per-row statuses: ${statuses.filter((s) => s !== "Waitlisted").length} placed, ${statuses.filter((s) => s === "Waitlisted").length} Waitlisted (first waitlisted row: ${firstWait}); block bookedCount before=${blk0?.bookedCount}; POST /bulk {approve ×50} → ${bulk.status} rows=${perRow ?? err(bulk)}; after: Confirmed=${confirmed} Waitlisted=${waitl}, block bookedCount=${blk1?.bookedCount}/${blk1?.capacity}`, notes: `There is no bulk-CREATE endpoint — /api/bookings/bulk is a bulk ACTION on refs (bookings.ts:131-134 {refs, action}); creation is one row per POST and the over-capacity rows come back Waitlisted per row (bookings.ts:385), which is the 'names row 27' behaviour. The bulk approve is one Firestore transaction (all-or-nothing, no 500) but ${confirmed === 50 ? `Fix needed: it never checks capacity — it confirmed all 50 on a block of ${blk1?.capacity} (bookedCount ${blk1?.bookedCount}), a silent overbook (bookings.ts:1113-1170; the single-row 'approve' action has the same gap)` : "see counts"}.` };
  });

  // ── p2-o18: trip child removal cleans consent ──────────────────────────
  await step("p2-o18", async () => {
    const mk = await api(OA, "POST", "/api/trips", { destination: "Ops zoo", date: today, listingId: L, childNames: ["Ops Kid One", "Ops Kid Nuts"], attendees: [{ n: "Ops Kid One", childId: K1, consent: "granted" }, { n: "Ops Kid Nuts", childId: K2, consent: "granted" }] });
    const t0 = mk.json?.attendees as any[]; const granted = t0?.map((a) => `${a.n}=${a.consent}`);
    const namesOnly = await api(OA, "PUT", `/api/trips/${mk.json?.id}`, { childNames: ["Ops Kid Nuts"] });
    const lingering = ((namesOnly.json?.attendees ?? []) as any[]).some((a) => a.childId === K1);
    const full = await api(OA, "PUT", `/api/trips/${mk.json?.id}`, { childNames: ["Ops Kid Nuts"], attendees: [{ n: "Ops Kid Nuts", childId: K2, consent: "granted" }] });
    const att = (full.json?.attendees ?? []) as any[]; const gone = !att.some((a) => a.childId === K1 || a.n === "Ops Kid One"); const idsGone = !(full.json?.childIds ?? []).includes(K1);
    // "Roll call": the day's register — who is booked on L today (K1 is; K2 never booked).
    const reg = await api(OA, "GET", `/api/registers?date=${today}`);
    const regText = JSON.stringify(reg.json ?? {}); const k1OnRegister = regText.includes("Ops Kid One"); const k2OnRegister = regText.includes("Ops Kid Nuts");
    const roll = att.filter((a) => a.consent !== "declined").map((a) => a.n);
    const ok = mk.status === 201 && full.status === 200 && gone && idsGone && k1OnRegister && !k2OnRegister;
    results["p2-o18"] = { verdict: ok ? "pass" : "fail", actual: `POST trip (2 children, consent granted by provider) → ${mk.status} attendees=[${granted?.join(",")}]; PUT {childNames} only (dropping Kid One) → ${namesOnly.status} Kid One still in attendees: ${lingering}; PUT {childNames + attendees} → ${full.status} attendees=[${att.map((a) => `${a.n}=${a.consent}`).join(",")}] Kid One gone: ${gone} childIds cleaned: ${idsGone}; day register ${today} → ${reg.status} lists Kid One (booked): ${k1OnRegister}, Kid Nuts (never booked): ${k2OnRegister}; trip roll (attending) = [${roll.join(",")}]`, notes: `Roll call is client-side in the planner (attendees minus declined; trips.ts:105-110) — no roll-call API. A PUT that sends childNames WITHOUT attendees keeps the removed child's consent entry (trips.ts:318-320: incoming = prev, enrichTrip only adds) — ${lingering ? "confirmed: the entry lingers until the client also resends attendees (the planner does)" : "not reproduced"}.` };
  });
} finally {
  fs.writeFileSync("/tmp/p2h_day8.json", JSON.stringify({ results, world }, null, 2));
  origLog("cleanup", await cleanup());
  stop();
}
process.exit(0);
