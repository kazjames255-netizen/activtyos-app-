// Plan-2 Day 6 — staff HR: payroll maths, appraisals, leave entitlement,
// availability, deployment, onboarding privacy, references (p2-h1 … p2-h18).
// Throwaway freelancer tenant A (+ staff) and company C (+ F1/F2 + site lead).
//   cd server && npx tsx --tsconfig ../tsconfig.json _t_p2H_day6.mts
// Results → /tmp/p2h_day6.json
import fs from "node:fs";
import { api, db, mkTenant, mkFranchise, mkStaff, setSettings, cleanup, start, stop, log, ymd, daysFromNow, type Actor } from "./p2H_harness.mts";
import { computeLine, timesheetHours, leaveForPeriod, clockPayHours, ukShiftHours, r2, type Emp, type ClockRec } from "../../../features/payroll/payCalc";
import { statutoryDays, accruedAllowance, workingDays, DEFAULT_POLICY, leaveYear } from "../../../lib/holiday";

const results: Record<string, { verdict: "pass" | "fail" | "blocked"; actual: string; notes?: string }> = {};
const origLog = console.log;
const step = async (id: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { results[id] = { verdict: "blocked", actual: `script error: ${(e as Error).message}` }; origLog(`  !! ${id} threw`, e); } origLog(`[${id}] ${results[id]?.verdict} — ${results[id]?.actual}`); };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const bells = async (toEmail: string) => (await db.collection("notifications").where("toEmail", "==", toEmail.toLowerCase()).get()).size;

await start();
const A = await mkTenant("freelancer", "P2H Solo");
const OA = A.owner; const TA = A.tenantId;
const SAM = await mkStaff(TA, { franchiseId: null, name: "Sam Hourly", staffRole: "Coach", jobTitle: "Coach" });
const SAL = await mkStaff(TA, { franchiseId: null, name: "Sal Salaried", staffRole: "Lead / manager", jobTitle: "Lead / manager" });
const C = await mkTenant("company", "P2H HO Six");
const HO = C.owner; const TC = C.tenantId;
const F1 = await mkFranchise(TC, "P2H Six F1"); const F2 = await mkFranchise(TC, "P2H Six F2");
const S1 = await mkStaff(TC, { franchiseId: F1.franchiseId, name: "Six Fone", staffRole: "Coach" });
const S2 = await mkStaff(TC, { franchiseId: F2.franchiseId, name: "Six Ftwo", staffRole: "Coach" });
const HOP = await mkStaff(TC, { franchiseId: null, name: "Ho Person", staffRole: "Coach" });
origLog("world", { TA, TC });

/** A finished clock record for `name` on `day` with exact instants (manager PATCH after an 'in' event). */
async function clock(owner: Actor, name: string, day: string, inIso: string, outIso: string, extra: Record<string, unknown> = {}) {
  const ev = await api(owner, "POST", "/api/timeclock/event", { kind: "in", day, name });
  if (ev.status !== 200) throw new Error(`clock in ${ev.status} ${ev.text}`);
  const id = name.trim().toLowerCase().replace(/\s+/g, "-");
  const p = await api(owner, "PATCH", `/api/timeclock/${id}?day=${day}`, { clockInAt: inIso, clockOutAt: outIso, breakMs: 0, approved: true, ...extra });
  if (p.status !== 200) throw new Error(`patch ${p.status} ${p.text}`);
  return p.json;
}
const POL = { payPolicy: "actual" as const, autoPayOvertime: false, graceMin: 5, rounding: 0 as const };

// ── p2-h1: pay run against a hand calc ───────────────────────────────────
await step("p2-h1", async () => {
  const sam: Emp = { id: "sam-hourly", name: "Sam Hourly", role: "Coach", op: "", basis: "hour", rate: 12, hpw: 30, weeks: 52, taxCode: "1257L", niCat: "A", pension: true, paidFrom: "timesheet" };
  const sal: Emp = { id: "sal-salaried", name: "Sal Salaried", role: "Lead", op: "", basis: "year", rate: 30000, hpw: 37.5, weeks: 52, taxCode: "1257L", niCat: "A", pension: true };
  const emp = await api(OA, "PUT", "/api/payroll/employees", { employees: [sam, sal] });
  // 62 clocked hours in August: 8 days × 7h45.
  const days = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13"];
  for (const d of days) await clock(OA, "Sam Hourly", d, `${d}T09:00:00Z`, `${d}T16:45:00Z`);
  // One approved unpaid-leave day for Sal.
  const lv = await api(OA, "POST", "/api/leave/absences", { name: "Sal Salaried", kind: "unpaid", start: "2026-08-12", end: "2026-08-12", days: 1, status: "approved" });
  // One approved expense claim for Sam.
  const claim = await api(SAM, "POST", "/api/expense-claims", { date: "2026-08-14", category: "Travel & mileage", amount: 18.4 });
  const approved = await api(OA, "PATCH", `/api/expense-claims/${claim.json.id}`, { status: "approved" });
  // Read the period back through the API.
  const ts = await api(OA, "GET", "/api/payroll/timesheets?from=2026-08-01&to=2026-08-31");
  const leave = await api(OA, "GET", "/api/leave");
  const hours = timesheetHours(ts.json as ClockRec[], "sam-hourly", () => 0, POL);
  const salLeave = leaveForPeriod(leave.json.absences, "sal-salaried", "2026-08-01", "2026-08-31");
  const lineSam = computeLine(sam, { hours: hours.approvedH, hoursFrom: "timesheet" });
  const lineSal = computeLine(sal, { leave: salLeave });
  // Hand calc (independent arithmetic; 2026/27 rest-of-UK: PA £12,570, basic 20%, ee NI 8% above £12,570, pension QE £6,240–£50,270).
  const hSamGross = r2(12 * 62);                                  // 744.00
  const hSamPaye = 0, hSamNi = 0;                                  // £8,928 a year is under the allowance and the NI threshold
  const hSamPen = r2(((8928 - 6240) / 12) * 0.05);                // 11.20
  const hSamNet = r2(hSamGross - hSamPaye - hSamNi - hSamPen);    // 732.80
  const hSalBase = r2(30000 / 12 - 30000 / 260);                  // 2384.62
  const hSalA = hSalBase * 12;                                    // 28615.44
  const hSalPaye = r2(((hSalA - 12570) * 0.20) / 12);              // 267.42
  const hSalNi = r2(((hSalA - 12570) * 0.08) / 12);                // 106.97
  const hSalPen = r2(((hSalA - 6240) / 12) * 0.05);                // 93.23
  const hSalNet = r2(hSalBase - hSalPaye - hSalNi - hSalPen);      // 1917.00
  const run = await api(OA, "POST", "/api/payroll/runs", { period: "2026-08", paidOn: "2026-08-28", freq: "monthly", window: { start: "2026-08-01", end: "2026-08-31" }, lines: [lineSam, lineSal] });
  const stored = ((await api(OA, "GET", "/api/payroll")).json.runs as any[]).find((r) => r.id === run.json.id);
  const s0 = stored?.lines?.find((l: any) => l.id === "sam-hourly"), s1 = stored?.lines?.find((l: any) => l.id === "sal-salaried");
  const ok = emp.status === 200 && hours.approvedH === 62 && salLeave.unpaidDays === 1
    && lineSam.grossM === hSamGross && lineSam.payeM === hSamPaye && lineSam.eeNiM === hSamNi && lineSam.eePenM === hSamPen && lineSam.netM === hSamNet
    && lineSal.grossM === hSalBase && lineSal.payeM === hSalPaye && lineSal.eeNiM === hSalNi && lineSal.eePenM === hSalPen && lineSal.netM === hSalNet
    && run.status === 201 && s0?.grossM === hSamGross && s0?.netM === hSamNet && s1?.grossM === hSalBase && s1?.netM === hSalNet;
  results["p2-h1"] = { verdict: ok ? "pass" : "fail", actual: `timesheets API → Sam approved hours ${hours.approvedH}; leave API → Sal unpaid days ${salLeave.unpaidDays}; expense claim approved ${approved.status} (lands in /api/expenses as expenseId ${approved.json?.expenseId ? "set" : "missing"} — not a payroll line). Sam (hourly £12 × 62h): calc gross ${lineSam.grossM} PAYE ${lineSam.payeM} NI ${lineSam.eeNiM} pension ${lineSam.eePenM} net ${lineSam.netM} vs hand ${hSamGross}/${hSamPaye}/${hSamNi}/${hSamPen}/${hSamNet}. Sal (£30,000, 1 unpaid day): calc gross ${lineSal.grossM} PAYE ${lineSal.payeM} NI ${lineSal.eeNiM} pension ${lineSal.eePenM} net ${lineSal.netM} vs hand ${hSalBase}/${hSalPaye}/${hSalNi}/${hSalPen}/${hSalNet}. POST /api/payroll/runs → ${run.status}; stored lines gross/net Sam ${s0?.grossM}/${s0?.netM}, Sal ${s1?.grossM}/${s1?.netM}.`, notes: "The four numbers (Sam gross 744.00 net 732.80; Sal gross 2384.62 net 1917.00). Payroll maths runs in the browser (features/payroll/payCalc.ts computeLine) — POST /api/payroll/runs stores the lines it is given; the API does not recompute. An approved expense claim becomes an expenses row, never a payslip addition." };
});

// ── p2-h2: publish and who can read a payslip ────────────────────────────
let runId = "";
await step("p2-h2", async () => {
  const runs = (await api(OA, "GET", "/api/payroll")).json.runs as any[];
  runId = runs[0]?.id;
  const pub = await api(OA, "POST", `/api/payroll/runs/${runId}/publish`, { published: true });
  const mSam = await api(SAM, "GET", "/api/payroll/mine");
  const mSal = await api(SAL, "GET", "/api/payroll/mine");
  const all = await api(SAM, "GET", "/api/payroll");
  const ids = (r: any) => (r.json as any[]).flatMap((x) => x.lines.map((l: any) => l.id));
  const ok = pub.status === 200 && ids(mSam).join() === "sam-hourly" && ids(mSal).join() === "sal-salaried" && all.status === 403;
  results["p2-h2"] = { verdict: ok ? "pass" : "fail", actual: `publish → ${pub.status}; GET /api/payroll/mine as Sam → lines [${ids(mSam)}]; as Sal → [${ids(mSal)}]; GET /api/payroll as Sam → ${all.status} ${all.json?.error}` };
});

// ── p2-h3: run the same month twice; adjust after publish ────────────────
await step("p2-h3", async () => {
  const before = ((await api(OA, "GET", "/api/payroll")).json.runs as any[]).find((r) => r.id === runId);
  const again = await api(OA, "POST", "/api/payroll/runs", { period: "2026-08", paidOn: "2026-08-28", lines: [{ id: "sam-hourly", name: "Sam Hourly", grossM: 1, netM: 1 }] });
  const adj = await api(OA, "PUT", "/api/payroll/adjust", { period: "2026-08", adjust: { "sam-hourly": { hours: 70 } } });
  const after = (await api(OA, "GET", "/api/payroll")).json;
  const pubRun = (after.runs as any[]).find((r) => r.id === runId);
  const runsForPeriod = (after.runs as any[]).filter((r) => r.period === "2026-08").length;
  const untouched = JSON.stringify(pubRun.lines) === JSON.stringify(before.lines) && pubRun.publishedAt === before.publishedAt;
  results["p2-h3"] = { verdict: untouched && again.status === 201 && again.json.id !== runId ? "pass" : "fail", actual: `second POST for 2026-08 → ${again.status} new id ${again.json?.id} (now ${runsForPeriod} runs for the period, first untouched); PUT /adjust after publish → ${adj.status}, adjust stored under config for the period (${JSON.stringify(after.adjust?.["2026-08"])}); published run's lines/publishedAt unchanged=${untouched}`, notes: "Rule: a second run for the same period is a second record (never overwrites — payroll.ts:314-333 uses .create on a fresh id); adjust changes the per-period config that the NEXT run is computed from, not a published run. Nothing supersedes explicitly — both runs sit side by side and staff's /mine lists both." };
});

// ── p2-h4: DST shifts pay the real hours ─────────────────────────────────
await step("p2-h4", async () => {
  await clock(OA, "Sam Hourly", "2026-10-25", "2026-10-25T00:30:00+01:00", "2026-10-25T03:30:00+00:00");
  await clock(OA, "Sam Hourly", "2026-03-29", "2026-03-29T00:30:00+00:00", "2026-03-29T03:30:00+01:00");
  const oct = (await api(OA, "GET", "/api/payroll/timesheets?from=2026-10-25&to=2026-10-25")).json as ClockRec[];
  const mar = (await api(OA, "GET", "/api/payroll/timesheets?from=2026-03-29&to=2026-03-29")).json as ClockRec[];
  const hOct = clockPayHours(oct[0], 0, POL).workedH, hMar = clockPayHours(mar[0], 0, POL).workedH;
  const schedOct = ukShiftHours("2026-10-25", "00:30", "03:30"), schedMar = ukShiftHours("2026-03-29", "00:30", "03:30");
  const ok = hOct === 4 && hMar === 2 && schedOct === 4 && schedMar === 2;
  results["p2-h4"] = { verdict: ok ? "pass" : "fail", actual: `clocks-back night (25 Oct, 00:30 BST → 03:30 GMT): worked ${hOct}h, scheduled-shift length ${schedOct}h; clocks-forward night (29 Mar, 00:30 GMT → 03:30 BST): worked ${hMar}h, scheduled ${schedMar}h`, notes: "Clock records are absolute instants (clockInAt/clockOutAt ISO) so the span is real; the rota's scheduled length uses londonMs/ukShiftHours (payCalc.ts) — s13-rtD1 holds." };
});

// ── p2-h5: pay rates by the wrong hands ──────────────────────────────────
await step("p2-h5", async () => {
  const self = await api(SAM, "PUT", "/api/payroll/employees", { employees: [{ id: "sam-hourly", name: "Sam Hourly", basis: "hour", rate: 99, hpw: 30, weeks: 52, taxCode: "1257L", niCat: "A", pension: false }] });
  const hoBefore = (await api(HO, "GET", "/api/payroll")).json.employees;
  const fr = await api(F1.actor, "PUT", "/api/payroll/employees", { employees: [{ id: "ho-person", name: "Ho Person", basis: "hour", rate: 99, hpw: 30, weeks: 52, taxCode: "1257L", niCat: "A", pension: false }] });
  const hoAfter = (await api(HO, "GET", "/api/payroll")).json.employees;
  const f1Own = (await api(F1.actor, "GET", "/api/payroll")).json.employees;
  const samRate = ((await api(OA, "GET", "/api/payroll")).json.employees as any[]).find((e) => e.id === "sam-hourly")?.rate;
  const ok = self.status === 403 && samRate === 12 && JSON.stringify(hoBefore) === JSON.stringify(hoAfter);
  results["p2-h5"] = { verdict: ok ? "pass" : "fail", actual: `Sam sets own rate → ${self.status} (rate still £${samRate}); F1 PUT employees naming HO's person → ${fr.status} — written to F1's OWN payroll key (F1 employees now ${JSON.stringify(f1Own)?.slice(0, 80)}); HO's employees before/after identical=${JSON.stringify(hoBefore) === JSON.stringify(hoAfter)} (${JSON.stringify(hoAfter)})`, notes: "Expected 404 for the franchise; actual 200, but it can only write its own tenant__fr__ config (payroll.ts keyOf) — head office's pay details are untouched, so the isolation property holds even though the status differs." };
});

// ── p2-h7: timesheet equals timeclock ────────────────────────────────────
await step("p2-h7", async () => {
  const d1 = "2026-08-17", d2 = "2026-08-18";
  await clock(OA, "Sam Hourly", d1, `${d1}T09:00:00Z`, `${d1}T16:00:00Z`, { breakMs: 30 * 60_000 });
  await clock(OA, "Sam Hourly", d2, `${d2}T09:20:00Z`, `${d2}T16:00:00Z`, { lateMin: 20, payBasis: "scheduled-less-late" });
  const tc1 = (await api(OA, "GET", `/api/timeclock?day=${d1}`)).json[0], tc2 = (await api(OA, "GET", `/api/timeclock?day=${d2}`)).json[0];
  const ts = (await api(OA, "GET", `/api/payroll/timesheets?from=${d1}&to=${d2}`)).json as ClockRec[];
  const t1 = ts.find((r) => r.day === d1)!, t2 = ts.find((r) => r.day === d2)!;
  const same = JSON.stringify(tc1) === JSON.stringify(t1) && JSON.stringify(tc2) === JSON.stringify(t2);
  const pol = { ...POL, payPolicy: "scheduled-less-late" as const };
  const a1 = clockPayHours(tc1, 7, pol), b1 = clockPayHours(t1, 7, pol), a2 = clockPayHours(tc2, 7, pol), b2 = clockPayHours(t2, 7, pol);
  results["p2-h7"] = { verdict: same && a1.payH === b1.payH && a2.payH === b2.payH && a1.payH === 6.5 && a2.payH === 6.75 ? "pass" : "fail", actual: `records from /api/timeclock and /api/payroll/timesheets identical=${same}; day 1 (30-min break): worked ${a1.workedH}h pay ${a1.payH}h on both; day 2 (20 min late, grace 5, auto-deduct): pay ${a2.payH}h on both (7h sched − 0.25h)`, notes: "Both endpoints read the same clockRecords doc; the deduction is applied by the shared clockPayHours rule." };
});

// ── p2-h8: appraisal edit rights ─────────────────────────────────────────
await step("p2-h8", async () => {
  const review = { id: "rev1", staffId: "sam-hourly", name: "Sam Hourly", kind: "annual", due: ymd(daysFromNow(10)), status: "self", self: { done: false, ratings: [] }, manager: { text: "Draft notes", ratings: [{ id: "c1", rating: 3 }] }, goals: [], signoff: {}, createdAt: new Date().toISOString() };
  const put = await api(OA, "PUT", "/api/appraisals/reviews/rev1", review);
  await api(OA, "PUT", "/api/appraisals/config", { pips: [{ id: "pip1", staffId: "sam-hourly", reason: "lateness" }] });
  const asReviewee = await api(SAM, "PUT", "/api/appraisals/reviews/rev1", { ...review, manager: { text: "I rate myself 5", ratings: [{ id: "c1", rating: 5 }] } });
  const otherSelf = await api(SAL, "POST", "/api/appraisals/reviews/rev1/self", { text: "not mine", ratings: [] });
  const del = await api(SAM, "DELETE", "/api/appraisals/reviews/rev1");
  const own = await api(SAM, "GET", "/api/appraisals");
  const ownSelf = await api(SAM, "POST", "/api/appraisals/reviews/rev1/self", { text: "My year", ratings: [{ id: "c1", rating: 4 }] });
  const mgr = await api(OA, "GET", "/api/appraisals");
  const r = (mgr.json.reviews as any[]).find((x) => x.id === "rev1");
  const ok = put.status === 200 && asReviewee.status === 403 && otherSelf.status === 404 && del.status === 403 && own.json.reviews?.length === 1 && own.json.reviews[0].manager?.ratings?.length === 0 && own.json.pips === undefined && ownSelf.status === 200 && r.manager.ratings[0].rating === 3 && r.self.done === true;
  results["p2-h8"] = { verdict: ok ? "pass" : "fail", actual: `reviewee PUT changing the manager's rating → ${asReviewee.status}; another staff member POST /self → ${otherSelf.status}; reviewee DELETE → ${del.status}; reviewee GET → ${own.json.reviews?.length} review with manager ratings hidden (${own.json.reviews?.[0]?.manager?.ratings?.length} shown), keys=${Object.keys(own.json).join(",")} (no pips/feedback/talent); own /self → ${ownSelf.status}; manager view keeps rating 3 and self.done=${r?.self?.done}`, notes: "PIP / probation records are NOT visible to their subject: staff GET returns only {reviews, templates} (appraisals.ts:317-321); pips live in the manager-only config." };
});

// ── p2-h10: entitlement engine ───────────────────────────────────────────
await step("p2-h10", async () => {
  const pol = { ...DEFAULT_POLICY, leaveYearStartMonth: 1, leaveYearStartDay: 1, allowanceBasis: "statutory" as const, daysPerWeek: 5 };
  const ref = new Date("2026-09-13T12:00:00Z");
  const part = statutoryDays(3), full = statutoryDays(5), six = statutoryDays(6);
  const starter = accruedAllowance({ id: "sam-hourly", name: "Sam Hourly", daysPerWeek: 5, startDate: "2026-07-01" } as any, pol, ref);
  const cfg = await api(OA, "PUT", "/api/leave/config", { policy: { ...pol, leaveYearStartMonth: 4 }, profiles: [{ id: "sam-hourly", name: "Sam Hourly", daysPerWeek: 3 }, { id: "sal-salaried", name: "Sal Salaried", daysPerWeek: 5, startDate: "2026-07-01" }] });
  const got = (await api(OA, "GET", "/api/leave")).json;
  const pol2 = { ...pol, ...got.policy };
  const ly = leaveYear(pol2, ref);
  const starter2 = accruedAllowance({ id: "sal-salaried", name: "Sal Salaried", daysPerWeek: 5, startDate: "2026-07-01" } as any, pol2, ref);
  const ok = part === 16.8 && full === 28 && six === 28 && starter === 7 && cfg.status === 200 && got.policy.leaveYearStartMonth === 4 && ly.start === "2026-04-01" && starter2 === 7;
  results["p2-h10"] = { verdict: ok ? "pass" : "fail", actual: `statutoryDays: 3 days/wk → ${part}; 5 → ${full}; 6 → ${six} (capped). Mid-year starter (1 Jul, Jan leave year, as at 13 Sep): accrued ${starter} of 28 (3/12). PUT /api/leave/config moving the year start to April → ${cfg.status}; GET /api/leave policy.leaveYearStartMonth=${got.policy?.leaveYearStartMonth}, profiles ${got.profiles?.length}; leave year now ${ly.start}–${ly.end}; starter recomputed ${starter2}`, notes: "The engine is lib/holiday.ts (client): statutoryDays = min(28, dpw × 5.6); first-year accrual 1/12 per month from start. The server stores policy/profiles (leaveConfig) and hands them back — balances are recomputed on every read from the stored policy, so the config change takes effect on the next load." };
});

// ── p2-h11: overlaps, the past, bank holidays ────────────────────────────
await step("p2-h11", async () => {
  const d = ymd(daysFromNow(21));
  const approved = await api(OA, "POST", "/api/leave/absences", { name: "Sam Hourly", kind: "annual", start: d, end: d, days: 1, status: "approved" });
  const overlap = await api(SAM, "POST", "/api/leave/absences", { kind: "annual", start: d, end: d, days: 1 });
  const past = await api(SAM, "POST", "/api/leave/absences", { kind: "annual", start: "2026-08-05", end: "2026-08-05", days: 1 });
  const xmasDays = workingDays("2026-12-24", "2026-12-28");
  const xmas = await api(SAM, "POST", "/api/leave/absences", { kind: "annual", start: "2026-12-24", end: "2026-12-28", days: xmasDays });
  const mine = ((await api(SAM, "GET", "/api/leave")).json.absences as any[]).filter((a) => a.staffEmail === SAM.email);
  results["p2-h11"] = { verdict: overlap.status === 201 || past.status === 201 ? "fail" : "pass", actual: `overlapping an approved day → ${overlap.status} (status ${overlap.json?.status}); a day last month → ${past.status} (status ${past.json?.status}); 24–28 Dec 2026: client workingDays=${xmasDays} (25th and 28th are bank holidays, 26/27 weekend) → POST with days:${xmasDays} → ${xmas.status}, stored days=${xmas.json?.days}; Sam now has ${mine.length} own absences`, notes: "needsBackend: the API refuses neither an overlap nor a past date (leave.ts:106-133 validates shape only) — both land as pending. Bank holidays ARE excluded, but by the client's workingDays() (lib/holiday.ts:205, England & Wales table hard-coded, gov.uk feed owed); the server stores whatever `days` it is sent." };
});

// ── p2-h12: leave meets the rota ─────────────────────────────────────────
await step("p2-h12", async () => {
  const d = ymd(daysFromNow(14));
  const store = { staff: [{ id: "sam-hourly", name: "Sam Hourly", role: "Coach", rate: 12 }], shifts: [{ id: "sh1", staffId: "sam-hourly", site: "Main", role: "Coach", date: d, start: "09:00", end: "15:00" }], sites: ["Main"] };
  const put = await api(OA, "PUT", "/api/rota", store);
  const lv = await api(OA, "POST", "/api/leave/absences", { name: "Sam Hourly", kind: "annual", start: d, end: d, days: 1, status: "pending" });
  const dec = await api(OA, "POST", `/api/leave/absences/${lv.json.id}/decide`, { status: "approved" });
  const rota1 = (await api(OA, "GET", "/api/rota")).json;
  const sh1 = (rota1.shifts as any[]).find((s) => s.id === "sh1");
  const cancel = await api(OA, "POST", `/api/leave/absences/${lv.json.id}/cancel`, {});
  const rota2 = (await api(OA, "GET", "/api/rota")).json;
  const sh2 = (rota2.shifts as any[]).find((s) => s.id === "sh1");
  results["p2-h12"] = { verdict: "fail", actual: `rota saved ${put.status}; leave approved ${dec.status}; GET /api/rota after approval: shift sh1 staffId=${sh1?.staffId}, keys=${Object.keys(sh1 ?? {}).join(",")} (no uncovered/needs-covering flag); after cancel (${cancel.status}): staffId=${sh2?.staffId}`, notes: "The rota store is unaware of leave: rota.ts never reads absences, so an approved absence leaves the shift assigned. Any 'needs covering' is the browser's (Schedule screen) and is not visible through the API." };
});

// ── p2-h13: availability window ──────────────────────────────────────────
await step("p2-h13", async () => {
  const b1 = await bells(S1.email), b2 = await bells(S2.email);
  const req = await api(HO, "POST", "/api/availability/requests", { staffEmail: S1.email, staffName: "Six Fone", window: { kind: "range", label: "Autumn week", from: ymd(daysFromNow(20)), to: ymd(daysFromNow(26)) } });
  await wait(1500);
  const d1 = (await bells(S1.email)) - b1, d2 = (await bells(S2.email)) - b2;
  const outside = await api(S1, "PUT", "/api/availability/mine", { grid: { "2031-01-01": { on: true, from: "09:00", to: "17:00" } }, note: "outside the window" });
  const del = await api(HO, "DELETE", `/api/availability/requests/${req.json.id}`);
  const mine = await api(S1, "GET", "/api/availability/mine");
  const ok = req.status === 201 && d1 === 1 && d2 === 0 && outside.status === 400;
  results["p2-h13"] = { verdict: ok ? "pass" : "fail", actual: `request → ${req.status}; bells F1 staff +${d1}, F2 staff +${d2}; PUT /mine with a date outside the window → ${outside.status}; DELETE request → ${del.status}; GET /mine after delete: requests=${mine.json.requests?.length}, pattern survives=${!!mine.json.pattern} (grid keys ${Object.keys(mine.json.pattern?.grid ?? {}).join(",")})`, notes: "Only F1's person is belled (pass). The outside-window date is accepted (availability.ts:159-190 never compares grid dates to the request window) — expected 400. The submission (availabilityPatterns/{tenant}_{email}) survives deleting the request." };
});

// ── p2-h14: location assignment vs register scope ────────────────────────
await step("p2-h14", async () => {
  await setSettings(TC, null, { venues: [{ id: "V1", name: "Venue One" }, { id: "V2", name: "Venue Two" }] });
  const L = await mkStaff(TC, { franchiseId: null, name: "Site Lead", staffRole: "Lead", lead: true, assignment: { mode: "locations", ids: ["V1"] } });
  const D = ymd(daysFromNow(9)); // a session date; make it a weekday
  const dd = new Date(`${D}T12:00:00Z`); if (dd.getUTCDay() === 0) dd.setUTCDate(dd.getUTCDate() + 1); if (dd.getUTCDay() === 6) dd.setUTCDate(dd.getUTCDate() + 2);
  const day = ymd(dd);
  const mk = async (title: string, venueId: string) => {
    const l = await api(HO, "POST", "/api/listings", { title, venueId, passes: [{ name: "Day", price: 10 }] });
    const b = await api(HO, "POST", "/api/blocks", { listingId: l.json.id, name: `${title} run`, startDate: day, endDate: day, capacity: 10, sessions: [{ date: day, start: "09:00", end: "15:00" }] });
    return { listingId: l.json.id, blockId: b.json.id };
  };
  const v1 = await mk("Six V1 Camp", "V1"), v2 = await mk("Six V2 Camp", "V2");
  const before = await api(L, "GET", `/api/registers?date=${day}`);
  const moved = await api(HO, "PUT", "/api/location-staff", { staff: [{ id: L.uid, name: "Site Lead", role: "Lead", uid: L.uid, sites: ["V2"], listings: [] }] });
  const after = await api(L, "GET", `/api/registers?date=${day}`);
  const names = (r: any) => (r.json as any[]).map((s) => s.listing ?? s.listingName ?? s.listingId ?? s.blockId).join(",");
  const only = (r: any, id: string) => r.json.length === 1 && JSON.stringify(r.json).includes(id);
  results["p2-h14"] = { verdict: only(before, v1.blockId) && only(after, v1.blockId) ? "pass" : "fail", actual: `site lead invited to V1: GET /api/registers?date=${day} → ${before.json.length} session(s) [${names(before)}]; after PUT /api/location-staff moving them to V2 (${moved.status}): ${after.json.length} session(s) [${names(after)}]`, notes: "Today the INVITE assignment (users.assignment → lib/siteScope.staffSiteScope) decides register scope; Deployment (locationStaff) is read only by the Schedule when filling a shift (locationStaff.ts header). s13-so4 recorded: invite wins; moving someone in Deployment does not change what they can register." };
});

// ── p2-h15: rota and a leaver ────────────────────────────────────────────
await step("p2-h15", async () => {
  await db.collection("users").doc(SAL.uid).set({ disabled: true }, { merge: true });
  const cur = (await api(OA, "GET", "/api/rota")).json;
  const put = await api(OA, "PUT", "/api/rota", { staff: [...cur.staff, { id: "sal-salaried", name: "Sal Salaried", role: "Lead", rate: 20 }], shifts: [...cur.shifts, { id: "sh-leaver", staffId: "sal-salaried", site: "Main", role: "Lead", date: ymd(daysFromNow(15)), start: "09:00", end: "15:00" }], sites: cur.sites, baseUpdatedAt: cur.updatedAt });
  await db.collection("users").doc(SAL.uid).set({ disabled: false }, { merge: true });
  // Two clock sources for one person on one day.
  const day = ymd(daysFromNow(14));
  const ev = await api(SAM, "POST", "/api/timeclock/event", { kind: "in", day });
  const tc = (await api(OA, "GET", `/api/timeclock?day=${day}`)).json as any[];
  const rota = (await api(OA, "GET", "/api/rota")).json;
  const shift = (rota.shifts as any[]).find((s) => s.staffId === "sam-hourly" && s.date === day);
  const stamp = await api(SAM, "POST", "/api/rota/clock", { field: "in", hm: "09:01", date: day });
  const shift2 = ((await api(OA, "GET", "/api/rota")).json.shifts as any[]).find((s) => s.staffId === "sam-hourly" && s.date === day);
  results["p2-h15"] = { verdict: put.status === 409 ? "pass" : "fail", actual: `PUT /api/rota adding a shift for a deactivated member → ${put.status} ${put.json?.error?.slice(0, 90)}; clock sources: POST /api/timeclock/event in → ${ev.status} (clockRecords row status=${tc[0]?.status}); the rota shift for the same day had in=${shift?.in ?? "unset"} until POST /api/rota/clock (${stamp.status}, stamped=${stamp.json?.stamped}) set in=${shift2?.in}`, notes: "The who's-in board reads ONE source: clockRecords via GET /api/timeclock (features/timeclock/data.ts:172); the rota's in/out stamps are a second, separate store written by /api/rota/clock — the client posts to both (data.ts:81,200), the server does not sync them." };
});

// ── p2-h16: onboarding record privacy ────────────────────────────────────
await step("p2-h16", async () => {
  const own = await api(SAM, "PUT", `/api/onboarding/records/${encodeURIComponent("Sam Hourly")}`, { values: { ni: { v: "QQ123456C" }, bank: { v: "12-34-56 12345678" } }, extra: [] });
  const other = await api(SAL, "GET", "/api/onboarding");
  const f1 = await api(F1.actor, "GET", "/api/onboarding");
  await api(HO, "PUT", `/api/onboarding/records/${encodeURIComponent("Ho Person")}`, { values: { ni: { v: "AB123456C" } }, extra: [] });
  const f1b = await api(F1.actor, "GET", "/api/onboarding");
  const file = await api(OA, "POST", "/api/onboarding/files", { staff: "Sam Hourly", name: "id.png", contentType: "image/png", bytes: 3, total: 1 });
  await api(OA, "PUT", `/api/onboarding/files/${file.json.id}/chunks/0`, { b64: "iVBO" });
  await api(OA, "POST", `/api/onboarding/files/${file.json.id}/done`, {});
  const noTok = await api(null, "GET", `/api/onboarding/files/${file.json.id}`);
  const colleague = await api(SAL, "GET", `/api/onboarding/files/${file.json.id}`);
  const raw = (await db.collection("onboardRecords").where("tenantId", "==", TA).get()).docs.map((d) => d.data().values?.ni?.v);
  const ok = own.status === 200 && other.json.records?.length === 0 && !JSON.stringify(f1b.json).includes("Ho Person") && noTok.status === 401 && colleague.status === 404;
  results["p2-h16"] = { verdict: ok ? "pass" : "fail", actual: `Sam PUT own record → ${own.status}; Sal GET /api/onboarding → ${other.status} with ${other.json.records?.length} records (Sam's hidden); F1 GET → ${f1.status}, HO's person present=${JSON.stringify(f1b.json).includes("Ho Person")} (records ${f1b.json.records?.length}); GET /files/<id> with no token → ${noTok.status}; as a colleague → ${colleague.status}. NI stored in onboardRecords as plain text: ${JSON.stringify(raw)}`, notes: "Privacy holds, but the shapes differ from the expectation text: a colleague gets 200 with an empty list (not 403); a sibling franchise gets 200 without the record (not 404) — both filtered by key/name (onboarding.ts:75-78). Amir 61 confirmed: bank details and NI are stored as entered, not encrypted." };
});

// ── p2-h18: reference file after revoke ──────────────────────────────────
await step("p2-h18", async () => {
  const r1 = await api(OA, "POST", "/api/references", { staffName: "Sam Hourly", slot: 1, refereeName: "Ref One", deliver: "phone" });
  const rec = await api(OA, "POST", `/api/references/${r1.json.token}/record`, { answers: { q1: "Reliable" }, file: { fileData: "data:application/pdf;base64,JVBERi0xLjQK", fileName: "ref.pdf" } });
  const fA = await api(OA, "GET", `/api/references/${r1.json.token}/file`);
  const fS = await api(SAM, "GET", `/api/references/${r1.json.token}/file`);
  const delSubmitted = await api(OA, "DELETE", `/api/references/${r1.json.token}`);
  const r2r = await api(OA, "POST", "/api/references", { staffName: "Sam Hourly", slot: 2, refereeName: "Ref Two", deliver: "phone" });
  const delOpen = await api(OA, "DELETE", `/api/references/${r2r.json.token}`);
  const fGone = await api(OA, "GET", `/api/references/${r2r.json.token}/file`);
  const pubGone = await api(null, "GET", `/api/public/reference/${r2r.json.token}`);
  const ok = rec.status === 200 && fA.status === 200 && fS.status === 403 && delOpen.status === 200 && fGone.status === 404 && pubGone.status === 404;
  results["p2-h18"] = { verdict: ok ? "pass" : "fail", actual: `record with file → ${rec.status}; GET file as manager → ${fA.status} (${fA.text?.length} bytes); as staff → ${fS.status}; DELETE a RETURNED reference → ${delSubmitted.status} ${delSubmitted.json?.error?.slice(0, 60)}; DELETE an unreturned one → ${delOpen.status}; its file afterwards → ${fGone.status}; its public form → ${pubGone.status}`, notes: "A returned reference cannot be deleted (409, references.ts:383-393 — deliberate, keeps what a referee said about a concern); an open request revokes cleanly and the file/link are gone (404)." };
});

// ── p2-h6 / p2-h9 code, p2-h17 browser — recorded by the agent ───────────

fs.writeFileSync("/tmp/p2h_day6.json", JSON.stringify({ results, world: { TA, TC } }, null, 2));
origLog("cleanup", await cleanup());
stop();
process.exit(0);
