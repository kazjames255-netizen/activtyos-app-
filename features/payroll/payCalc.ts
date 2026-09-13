// Payroll maths — pure (no React, no storage) so it can be tested on its own
// (acceptance d17s6/d17s7). The PAYE / NI / pension ESTIMATE helpers moved
// here unchanged from PayrollApp; new: pay hours from the real (server)
// timesheets, and approved leave for the period.
import { defaultPayTreatment, workingDays } from "@/lib/holiday";

// ——— UK PAYE / NI / pension ESTIMATE helpers (2026/27; rest-of-UK bands) ———
export const r2 = (n: number) => Math.round((n || 0) * 100) / 100;

// annual PAYE from gross + tax code — parses the allowance, BR/D0/D1/NT and K
// codes, and the £100k personal-allowance taper. Rest-of-UK bands (S/C prefixes
// are stripped; a real Scottish/Welsh calc is backend). Estimate only.
export function payeAnnual(gross: number, taxCodeRaw = "1257L"): number {
  const code = String(taxCodeRaw).toUpperCase().replace(/\s|W1|M1|X/g, "").replace(/^[SC]/, "");
  if (code === "NT") return 0;
  if (code === "BR") return gross * 0.20;
  if (code === "D0") return gross * 0.40;
  if (code === "D1") return gross * 0.45;
  let taxable: number;
  if (code.startsWith("K")) taxable = gross + (parseInt(code.slice(1)) || 0) * 10; // K = extra taxable, no allowance
  else { const num = parseInt(code.replace(/[^0-9]/g, "")) || 1257; const pa = Math.max(0, num * 10 - Math.max(0, gross - 100000) / 2); taxable = Math.max(0, gross - pa); }
  const basic = Math.min(taxable, 37700) * 0.20;
  const higher = Math.min(Math.max(0, taxable - 37700), 112570 - 37700) * 0.40;
  const add = Math.max(0, taxable - 112570) * 0.45;
  return basic + higher + add;
}
export function eeNiAnnual(gross: number, cat = "A"): number {
  if (cat === "C") return 0; // over State Pension age
  const PT = 12570, UEL = 50270;
  return Math.min(Math.max(0, gross - PT), UEL - PT) * 0.08 + Math.max(0, gross - UEL) * 0.02;
}
export function erNiAnnual(gross: number, cat = "A"): number {
  if (cat === "M" || cat === "H") return Math.max(0, gross - 50270) * 0.15; // under-21 / apprentice under-25: 0% to UST
  return Math.max(0, gross - 5000) * 0.15; // 2025/26+ : 15% above the £5,000 secondary threshold
}
export const qePension = (annualGross: number) => Math.min(Math.max(annualGross - 6240, 0), 50270 - 6240); // qualifying earnings band

/** How an hourly person's hours are found: their contract, or their APPROVED
 *  timesheets (clock in/out). "rota" is the old name for the timesheet source. */
export type PaidFrom = "contracted" | "rota" | "timesheet";
export interface Emp { id: string; name: string; role: string; op: string; basis: "hour" | "year"; rate: number; hpw: number; weeks: number; taxCode: string; niCat: string; pension: boolean; paidFrom?: PaidFrom; source?: "team" | "manual" }
// A one-off addition (taxable — overtime/bonus/holiday pay) or after-tax deduction (advance/other) on a single pay run.
export interface AdjItem { id: string; label: string; amount: number }
// Per-employee, per-period overrides applied in the pay run — everything editable
// without touching the employee master record.
export interface Adjust { hours?: number | null; taxCode?: string; niCat?: string; additions?: AdjItem[]; deductions?: AdjItem[]; override?: { paye?: number | null; eeNi?: number | null; eePen?: number | null } }
/** Approved leave falling in a pay period, in days, by how it's paid. */
export interface LeaveSum { byKind: Record<string, number>; paidDays: number; unpaidDays: number; sickDays: number; statutoryDays: number; toilDays: number }
/** The company's sick-pay rule (Payroll settings, decided by Kaz 13 Sept —
 *  s13-pay3): "full" = full contracted pay (the default); "ssp" = SSP only —
 *  sick days come off pay like unpaid leave and SSP itself is left to the
 *  payroll provider (not calculated here). */
export type SickPay = "full" | "ssp";
export interface Line { id: string; staffKey?: string; name: string; role: string; op: string; basis: "hour" | "year"; rate: number; hpw: number; weeks: number; taxCode: string; niCat: string; freqLabel?: string; hoursM: number; hoursFrom?: "contracted" | "timesheet" | "manual"; basePayM: number; unpaidLeaveM?: number; sickLeaveM?: number; sickPay?: SickPay; leave?: LeaveSum; addM: number; dedM: number; additions: AdjItem[]; deductions: AdjItem[]; manual: { paye: boolean; eeNi: boolean; eePen: boolean }; grossM: number; payeM: number; eeNiM: number; erNiM: number; eePenM: number; erPenM: number; netM: number }

export const grossMonthly = (e: Emp) => e.basis === "year" ? e.rate / 12 : e.rate * e.hpw * (e.weeks || 52) / 12;
export const sumItems = (a?: AdjItem[]) => r2((a || []).reduce((n, x) => n + (Number(x.amount) || 0), 0));
// Pay frequency: how often a run pays, and how many fall in a tax year (the
// divisor that turns an annual PAYE/NI/pension figure into one period's amount).
export type Freq = "weekly" | "fortnightly" | "fourweekly" | "monthly";
export const PPY: Record<Freq, number> = { weekly: 52, fortnightly: 26, fourweekly: 13, monthly: 12 };
export const FREQ_LABEL: Record<Freq, string> = { weekly: "Weekly", fortnightly: "Fortnightly", fourweekly: "4-weekly", monthly: "Monthly" };

// Leave is booked in Mon–Fri working days (the planner's workingDays), so one
// day is a fifth of the contracted week: a whole week off comes to exactly one
// contracted week, for part-timers too. A salaried day is salary ÷ 260.
export const leaveDayHours = (e: Pick<Emp, "hpw">) => (e.hpw || 0) / 5;
export const salaryDayRate = (e: Pick<Emp, "rate">) => (e.rate || 0) / 260;

export interface LineOpts {
  hours?: number | null; rate?: number | null; taxCode?: string; niCat?: string; additions?: AdjItem[]; deductions?: AdjItem[];
  override?: { paye?: number | null; eeNi?: number | null; eePen?: number | null }; rolledUp?: boolean;
  /** where `hours` came from — only timesheet hours get approved paid leave added on top */
  hoursFrom?: "contracted" | "timesheet" | "manual";
  leave?: LeaveSum;
  sickPay?: SickPay;
}
// computeLine estimates ONE PERIOD for one employee at pay frequency `freq`.
// Adjustments: `hours` pays an hourly person by actual hours (approved
// timesheets or a manual entry) instead of contracted; taxCode/niCat override
// the master; additions are taxable (added to gross), deductions come off net
// after tax; override.{paye,eeNi,eePen} force a statutory figure.
// Leave (approved, this period): unpaid days come off contracted hours (hourly)
// or salary (salaried); paid leave is already in contracted pay/salary, and is
// added at the normal rate for timesheet-paid staff (who don't clock it).
// Rolled-up staff never get it twice: their annual leave arrives here as
// unpaid (it was paid as the 12.07% line). Sickness follows the company's
// sick-pay rule: "full" (default) = paid like paid leave (already in contracted
// pay/salary; added at the normal rate for timesheet-paid staff); "ssp" = sick
// days come off pay like unpaid leave and SSP is left to the payroll provider.
// Statutory (SMP etc.): not modelled — pay is left as it is and the row says so.
export function computeLine(e: Emp, a: LineOpts = {}, freq: Freq = "monthly"): Line {
  const ppy = PPY[freq];
  const taxCode = a.taxCode || e.taxCode, niCat = a.niCat || e.niCat;
  const rate = a.rate != null ? a.rate : e.rate;
  const contractedHours = e.basis === "hour" ? (e.hpw * (e.weeks || 52)) / ppy : 0; // avg contracted hours in one period
  const useH = a.hours != null && e.basis === "hour";
  const lv = a.leave;
  const unpaidDays = lv?.unpaidDays || 0;
  const sickDays = lv?.sickDays || 0;
  const sspOnly = a.sickPay === "ssp";
  // hourly on contracted hours: unpaid leave (and, SSP-only, sick days) come off the contract (never below 0)
  const unpaidH = e.basis === "hour" && !useH ? Math.min(contractedHours, unpaidDays * leaveDayHours(e)) : 0;
  const sickH = e.basis === "hour" && !useH && sspOnly ? Math.min(contractedHours - unpaidH, sickDays * leaveDayHours(e)) : 0;
  const periodHours = e.basis === "hour" ? (useH ? (a.hours as number) : contractedHours - unpaidH - sickH) : 0;
  const fullSalary = e.rate / ppy;
  const unpaidSalary = e.basis === "year" ? Math.min(fullSalary, unpaidDays * salaryDayRate(e)) : 0;
  const sickSalary = e.basis === "year" && sspOnly ? Math.min(fullSalary - unpaidSalary, sickDays * salaryDayRate(e)) : 0;
  const basePayM = r2(e.basis === "hour" ? rate * periodHours : fullSalary - unpaidSalary - sickSalary);
  const unpaidLeaveM = r2(e.basis === "hour" ? unpaidH * rate : unpaidSalary);
  const sickLeaveM = r2(e.basis === "hour" ? sickH * rate : sickSalary);
  // rolled-up holiday pay: a separate, itemised 12.07% line on the pay for hours worked
  const holidayAdd: AdjItem[] = a.rolledUp ? [{ id: "__holpay", label: "Holiday pay (12.07% rolled-up)", amount: r2(basePayM * 0.1207) }] : [];
  // approved paid leave for someone paid from timesheets: they didn't clock it, so pay it at their normal rate
  const paidLeaveH = e.basis === "hour" && a.hoursFrom === "timesheet" && !a.rolledUp ? (lv?.paidDays || 0) * leaveDayHours(e) : 0;
  const leaveAdd: AdjItem[] = paidLeaveH > 0 ? [{ id: "__leavepay", label: `Paid leave · ${lv!.paidDays} day${lv!.paidDays === 1 ? "" : "s"} × ${r2(leaveDayHours(e))}h`, amount: r2(paidLeaveH * rate) }] : [];
  // full sick pay for someone paid from timesheets: a sick day is a contracted day (hrs/wk ÷ 5) at their normal rate
  const sickPaidH = e.basis === "hour" && a.hoursFrom === "timesheet" && !sspOnly ? sickDays * leaveDayHours(e) : 0;
  const sickAdd: AdjItem[] = sickPaidH > 0 ? [{ id: "__sickpay", label: `Sick pay (full pay) · ${sickDays} day${sickDays === 1 ? "" : "s"} × ${r2(leaveDayHours(e))}h`, amount: r2(sickPaidH * rate) }] : [];
  const additions = [...holidayAdd, ...leaveAdd, ...sickAdd, ...(a.additions || [])];
  const addM = sumItems(additions), dedM = sumItems(a.deductions);
  const grossM = r2(basePayM + addM); const grossA = grossM * ppy;
  const ov = a.override || {};
  const payeM = ov.paye != null ? r2(ov.paye) : r2(payeAnnual(grossA, taxCode) / ppy);
  const eeNiM = ov.eeNi != null ? r2(ov.eeNi) : r2(eeNiAnnual(grossA, niCat) / ppy);
  const erNiM = r2(erNiAnnual(grossA, niCat) / ppy);
  const qeM = qePension(grossA) / ppy;
  const eePenM = ov.eePen != null ? r2(ov.eePen) : (e.pension ? r2(qeM * 0.05) : 0);
  const erPenM = e.pension ? r2(qeM * 0.03) : 0;
  const hoursM = r2(periodHours);
  const hoursFrom = e.basis === "hour" ? (a.hoursFrom ?? (useH ? "manual" : "contracted")) : undefined;
  return { id: e.id, staffKey: staffSlug(e.name), name: e.name, role: e.role, op: e.op, basis: e.basis, rate, hpw: e.hpw, weeks: e.weeks || 52, taxCode, niCat, freqLabel: FREQ_LABEL[freq], hoursM, ...(hoursFrom ? { hoursFrom } : {}), basePayM, ...(unpaidLeaveM > 0 ? { unpaidLeaveM } : {}), ...(sickLeaveM > 0 ? { sickLeaveM } : {}), ...(sickDays > 0 ? { sickPay: (sspOnly ? "ssp" : "full") as SickPay } : {}), ...(lv && Object.keys(lv.byKind).length ? { leave: lv } : {}), addM, dedM, additions, deductions: a.deductions || [], manual: { paye: ov.paye != null, eeNi: ov.eeNi != null, eePen: ov.eePen != null }, grossM, payeM, eeNiM, erNiM, eePenM, erPenM, netM: r2(grossM - payeM - eeNiM - eePenM - dedM) };
}

// ── Leave (the holiday planner, /api/leave) ─────────────────────────────────
export const staffSlug = (name: string) => name.trim().toLowerCase().replace(/\s+/g, "-");
export interface LeaveAbsence { staffId?: string; name?: string; kind: string; start: string; end: string; half?: "am" | "pm" | null; days: number; status: string; paid?: boolean; pay?: string }
/** One person's APPROVED absences overlapping [start, end], split by how each
 *  is paid (the booking's own pay treatment, else the type's default). An
 *  absence straddling the period counts its share of working days. */
export function leaveForPeriod(absences: LeaveAbsence[], staffKey: string, start: string, end: string, opts: { rolledUp?: boolean } = {}): LeaveSum {
  const out: LeaveSum = { byKind: {}, paidDays: 0, unpaidDays: 0, sickDays: 0, statutoryDays: 0, toilDays: 0 };
  for (const a of absences) {
    if (a.status !== "approved" || !a.start || !a.end) continue;
    if (a.staffId !== staffKey && staffSlug(a.name || "") !== staffKey) continue;
    const from = a.start > start ? a.start : start, to = a.end < end ? a.end : end;
    if (from > to) continue;
    let days = Number(a.days) || 0;
    if (a.start < start || a.end > end) { const all = workingDays(a.start, a.end); days = all ? r2(days * workingDays(from, to) / all) : 0; }
    if (days <= 0) continue;
    const kind = String(a.kind);
    // Rolled-up staff were paid their holiday as 12.07% on every hour — annual
    // leave is unpaid time, whatever the booking says (no double pay).
    const pay = opts.rolledUp && kind === "annual" ? "unpaid" : a.pay ?? (a.paid === false ? "unpaid" : defaultPayTreatment(kind as Parameters<typeof defaultPayTreatment>[0], { rolled: opts.rolledUp }));
    out.byKind[kind] = r2((out.byKind[kind] || 0) + days);
    if (pay === "unpaid") out.unpaidDays = r2(out.unpaidDays + days);
    else if (pay === "ssp") out.sickDays = r2(out.sickDays + days);
    else if (pay === "statutory") out.statutoryDays = r2(out.statutoryDays + days);
    else if (pay === "toil") out.toilDays = r2(out.toilDays + days);
    else out.paidDays = r2(out.paidDays + days);
  }
  return out;
}

// ── Timesheets (clock in/out, /api/payroll/timesheets) ──────────────────────
/** UK wall-clock "HH:MM" on a date → a real instant, so the clock change counts
 *  (01:00 BST → 02:00 GMT is 2 hours, not 1) — acceptance d16s7. UK offsets are
 *  only ever +1h (BST) or 0 (GMT): take the earliest instant that really shows
 *  this wall time — an ambiguous 01:xx on the last Sunday of October is the
 *  first (BST) one; a skipped 01:xx in March falls back. */
export const londonMs = (date: string, hm: string): number => {
  const [y, mo, d] = date.split("-").map(Number); const [h, mi] = (hm || "0:0").split(":").map(Number);
  const guess = Date.UTC(y, (mo || 1) - 1, d || 1, h || 0, mi || 0);
  const off = (t: number) => { const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(t)); const g = (k: string) => Number(p.find((x) => x.type === k)?.value); return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - t; };
  for (const o of [3600000, 0]) if (off(guess - o) === o) return guess - o;
  return guess - off(guess);
};
/** A rota shift's scheduled length in real hours — the "Sched" that pay is
 *  capped at. Wall-clock end − start made a 01:00–02:00 shift on the night the
 *  clocks go back 1h, so the second hour worked was held back as overtime
 *  (d16s7). An end before the start (overnight) stays 0, as before. */
export const ukShiftHours = (date: string, start: string, end: string): number => Math.max(0, londonMs(date, end) - londonMs(date, start)) / 3600000;
export interface ClockRec { id: string; name: string; day: string; status?: string; clockInAt?: string; clockOutAt?: string; breakMs?: number; lateMin?: number; approved?: boolean; payBasis?: "actual" | "scheduled" | "scheduled-less-late" | "custom" | null; payHoursOverride?: number | null }
export interface ClockPolicy { payPolicy: "actual" | "scheduled" | "scheduled-less-late"; autoPayOvertime: boolean; graceMin: number; rounding: 0 | 5 | 15 }
const roundHours = (h: number, rounding: 0 | 5 | 15) => (rounding ? Math.round((h * 60) / rounding) * rounding / 60 : h);
/** Pay hours for one finished clock record — the SAME rule as the Timesheets
 *  screen's "Pay hrs" column (TimesheetsApp sheet()), for any day: worked time
 *  less the clocked break (break added back when breaks are paid), rounded; a
 *  manager's per-row basis wins, else the pay policy — and under "actual"
 *  overtime above the rota is only paid when auto-pay is on. */
export function clockPayHours(r: ClockRec, schedH: number, pol: ClockPolicy, breakPaid = false): { payH: number; workedH: number; overtimeUnpaidH: number } {
  if (!r.clockInAt || !r.clockOutAt) return { payH: 0, workedH: 0, overtimeUnpaidH: 0 };
  const span = Math.max(0, Date.parse(r.clockOutAt) - Date.parse(r.clockInAt));
  const workedH = roundHours(Math.max(0, breakPaid ? span : span - (r.breakMs || 0)) / 3600000, pol.rounding);
  const lateOverH = Math.max(0, (r.lateMin || 0) - pol.graceMin) / 60;
  let payH: number;
  if (r.payBasis === "scheduled") payH = schedH || workedH;
  else if (r.payBasis === "scheduled-less-late") payH = Math.max(0, (schedH || workedH) - lateOverH);
  else if (r.payBasis === "custom") payH = r.payHoursOverride ?? workedH;
  else if (r.payBasis === "actual") payH = workedH;
  else if (pol.payPolicy === "scheduled") payH = schedH || workedH;
  else if (pol.payPolicy === "scheduled-less-late") payH = Math.max(0, (schedH || workedH) - lateOverH);
  else payH = pol.autoPayOvertime ? workedH : (schedH ? Math.min(workedH, schedH) : workedH);
  const overtimeUnpaidH = !r.payBasis && pol.payPolicy === "actual" && !pol.autoPayOvertime && schedH ? Math.max(0, workedH - schedH) : 0;
  return { payH: r2(payH), workedH: r2(workedH), overtimeUnpaidH: r2(overtimeUnpaidH) };
}
export interface TimesheetSum { approvedH: number; pendingH: number; openDays: number; overtimeUnpaidH: number; days: number }
/** One person's timesheet hours for a pay period. Only APPROVED rows are paid
 *  ("Approved hours flow to the pay run"); unapproved and still-open rows are
 *  counted separately so the pay run can say what's missing. */
export function timesheetHours(records: ClockRec[], staffKey: string, schedFor: (day: string) => number, pol: ClockPolicy, breakPaid = false): TimesheetSum {
  const out: TimesheetSum = { approvedH: 0, pendingH: 0, openDays: 0, overtimeUnpaidH: 0, days: 0 };
  for (const r of records) {
    if (r.id !== staffKey || !r.clockInAt) continue;
    if (!r.clockOutAt) { out.openDays += 1; continue; }
    const h = clockPayHours(r, schedFor(r.day), pol, breakPaid);
    out.days += 1;
    if (r.approved) { out.approvedH = r2(out.approvedH + h.payH); out.overtimeUnpaidH = r2(out.overtimeUnpaidH + h.overtimeUnpaidH); }
    else out.pendingH = r2(out.pendingH + h.payH);
  }
  return out;
}
