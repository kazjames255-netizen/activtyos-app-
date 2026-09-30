// Payroll maths — pure (no React, no storage) so it can be tested on its own
// (acceptance d17s6/d17s7). The PAYE / NI / pension ESTIMATE helpers moved
// here unchanged from PayrollApp; new: pay hours from the real (server)
// timesheets, and approved leave for the period.
import { dateLocale as dl } from "../../lib/i18n/format";
import { defaultPayTreatment, workingDays } from "../../lib/holiday";

// ——— UK PAYE / NI / pension ESTIMATE helpers (2026/27; rest-of-UK bands) ———
import { rnd2, taxPeriodNo, payePeriod, niPeriod, qualifyingEarnings, studentLoanDeduction, AE, type SlPlan } from "./ukStatutory";
export const r2 = rnd2; // nearest penny, float-noise-proof (was Math.round(n*100)/100 — 1.005 -> 1.00)

// Annual-figure wrappers, kept for callers/tests that want a whole-year number. The engine itself
// (computeLine) works PER PERIOD with HMRC's method — see ukStatutory.ts.
export function payeAnnual(gross: number, taxCodeRaw = "1257L"): number { return payePeriod(gross, taxCodeRaw, { freq: "annual" }).tax; }
export function eeNiAnnual(gross: number, cat = "A"): number { return niPeriod(gross, cat, "annual").ee; }
export function erNiAnnual(gross: number, cat = "A"): number { return niPeriod(gross, cat, "annual").er; }
export const qePension = (annualGross: number) => qualifyingEarnings(annualGross, "annual"); // qualifying earnings band

/** How an hourly person's hours are found: their contract, or their APPROVED
 *  timesheets (clock in/out). "rota" is the old name for the timesheet source. */
export type PaidFrom = "contracted" | "rota" | "timesheet";
/** Which student/postgrad loan plan (if any) a deduction is due under —
 *  field only; the 9%/6% deduction calc itself is a separate task
 *  (docs/payroll-integrations-handoff.md §2). */
export type StudentLoanPlan = "none" | "plan1" | "plan2" | "plan4" | "plan5" | "postgrad";
/** Which country's PAYE bands apply — field only; Scottish/Welsh band rates
 *  are a separate task (handoff §1/§2). Rest-of-UK bands are what payeAnnual
 *  below actually applies regardless of this field for now. */
export type TaxRegime = "uk" | "scotland" | "wales";
export interface Emp {
  id: string; name: string; role: string; op: string; basis: "hour" | "year"; rate: number; hpw: number; weeks: number; taxCode: string; niCat: string; pension: boolean; paidFrom?: PaidFrom; source?: "team" | "manual";
  /** UK National Insurance number. Server-side only: encrypted at rest
   *  (server/src/lib/fieldCrypto.ts) and never round-tripped to the browser
   *  in a listing — present here only as the logical field's shape for the
   *  API boundary (server/src/routes/payroll.ts), never populated by a GET. */
  niNumber?: string;
  /** ISO date (YYYY-MM-DD) this employment started. */
  startDate?: string;
  /** ISO date this employment ended, or null/absent while still employed. */
  leaveDate?: string | null;
  studentLoanPlan?: StudentLoanPlan;
  /** Company director — NI is calculated differently for directors (annual
   *  earnings period); the calc itself is out of scope here, field only. */
  director?: boolean;
  taxRegime?: TaxRegime;
}
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
export interface Line { id: string; staffKey?: string; name: string; role: string; op: string; basis: "hour" | "year"; rate: number; hpw: number; weeks: number; taxCode: string; niCat: string; freqLabel?: string; hoursM: number; hoursFrom?: "contracted" | "timesheet" | "manual"; basePayM: number; proRata?: number; unpaidLeaveM?: number; sickLeaveM?: number; sickPay?: SickPay; leave?: LeaveSum; addM: number; dedM: number; additions: AdjItem[]; deductions: AdjItem[]; manual: { paye: boolean; eeNi: boolean; eePen: boolean }; grossM: number; payeM: number; eeNiM: number; erNiM: number; eePenM: number; erPenM: number; netM: number }

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
const isoWeekdays = (from: string, to: string): number => { let n = 0; for (let t = Date.parse(`${from}T12:00:00Z`); t <= Date.parse(`${to}T12:00:00Z`); t += 86_400_000) { const d = new Date(t).getUTCDay(); if (d !== 0 && d !== 6) n++; } return n; };
/** Was this person employed at all in the pay window [start, end], and what share of its Mon–Fri days? A new starter (startDate) part-way
 *  through is paid pro-rata; a leaver (leaveDate) is paid up to and including their last day and then drops out of later runs. No dates = full. */
export function employmentShare(e: Pick<Emp, "startDate" | "leaveDate">, start: string, end: string): { employed: boolean; share: number } {
  const from = e.startDate && e.startDate > start ? e.startDate : start, to = e.leaveDate && e.leaveDate < end ? e.leaveDate : end;
  if (from > to) return { employed: false, share: 0 };
  const all = isoWeekdays(start, end);
  return { employed: true, share: all ? Math.min(1, isoWeekdays(from, to) / all) : 1 };
}
export const leaveDayHours = (e: Pick<Emp, "hpw">) => (e.hpw || 0) / 5;
export const salaryDayRate = (e: Pick<Emp, "rate">) => (e.rate || 0) / 260;

export interface LineOpts {
  hours?: number | null; rate?: number | null; taxCode?: string; niCat?: string; additions?: AdjItem[]; deductions?: AdjItem[];
  override?: { paye?: number | null; eeNi?: number | null; eePen?: number | null }; rolledUp?: boolean;
  /** where `hours` came from — only timesheet hours get approved paid leave added on top */
  hoursFrom?: "contracted" | "timesheet" | "manual";
  leave?: LeaveSum;
  sickPay?: SickPay;
  /** Share of the period this person was employed (0–1, from employmentShare) — scales contracted hours / salary. */
  share?: number;
  /** Cumulative PAYE inputs (tax-year period number + pay/tax to date BEFORE this run, or a P45 for a starter). Omitted = Week1/Month1 steady-pay estimate. */
  ytd?: { period: number; payToDate: number; taxToDate: number };
  /** How the workplace pension is taxed — see computeLine. Default "legacy" (unchanged behaviour) until a tenant picks. */
  pensionScheme?: "legacy" | "netpay" | "ras";
  /** false = skip the student-loan deduction (e.g. SL start-date not yet reached / SL1 stop notice). */
  studentLoan?: boolean;
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
  const share = a.share != null ? Math.min(1, Math.max(0, a.share)) : 1; // new starter / leaver part-period
  const contractedHours = e.basis === "hour" ? ((e.hpw * (e.weeks || 52)) / ppy) * share : 0; // avg contracted hours in one period
  const useH = a.hours != null && e.basis === "hour";
  const lv = a.leave;
  const unpaidDays = lv?.unpaidDays || 0;
  const sickDays = lv?.sickDays || 0;
  const sspOnly = a.sickPay === "ssp";
  // hourly on contracted hours: unpaid leave (and, SSP-only, sick days) come off the contract (never below 0)
  const unpaidH = e.basis === "hour" && !useH ? Math.min(contractedHours, unpaidDays * leaveDayHours(e)) : 0;
  const sickH = e.basis === "hour" && !useH && sspOnly ? Math.min(contractedHours - unpaidH, sickDays * leaveDayHours(e)) : 0;
  const periodHours = e.basis === "hour" ? (useH ? (a.hours as number) : contractedHours - unpaidH - sickH) : 0;
  const fullSalary = (e.rate / ppy) * share;
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
  const addM = sumItems(additions);
  const grossM = r2(basePayM + addM);
  const ov = a.override || {};
  // Workplace pension first (net-pay schemes reduce TAXABLE pay). Per-period qualifying earnings (ukStatutory.qualifyingEarnings).
  const qeM = qualifyingEarnings(grossM, freq);
  const eePenFull = e.pension ? r2(qeM * AE.eeRate) : 0;
  const scheme = a.pensionScheme ?? "legacy";
  // legacy = the pre-30-Sep behaviour: PAYE on full gross, the 5% comes off net with no tax relief (wrong for both real scheme types — set a scheme).
  // netpay = employee 5% is deducted BEFORE PAYE. ras (relief at source) = employee pays 80% of the 5% (4%), the provider claims 20% back from HMRC.
  const taxableM = scheme === "netpay" ? grossM - eePenFull : grossM;
  const payeM = ov.paye != null ? r2(ov.paye) : payePeriod(taxableM, taxCode, { freq, cumulative: a.ytd, regime: e.taxRegime }).tax;
  const ni = niPeriod(grossM, niCat, freq);
  const eeNiM = ov.eeNi != null ? r2(ov.eeNi) : ni.ee;
  const erNiM = ni.er;
  const eePenM = ov.eePen != null ? r2(ov.eePen) : scheme === "ras" ? r2(eePenFull * 0.8) : eePenFull;
  const erPenM = e.pension ? r2(qeM * AE.erRate) : 0;
  // Student / postgraduate loan: a post-tax deduction on NI-able earnings (HMRC: period threshold = annual/periods rounded down to the penny, result rounded down to the pound).
  const sl = a.studentLoan === false ? 0 : studentLoanDeduction(grossM, (e.studentLoanPlan || "none") as SlPlan, freq);
  const slItem: AdjItem[] = sl > 0 ? [{ id: "__studentloan", label: `${e.studentLoanPlan === "postgrad" ? "Postgraduate loan" : `Student loan (${String(e.studentLoanPlan).replace("plan", "Plan ")})`}`, amount: sl }] : [];
  const deductionsAll = [...slItem, ...(a.deductions || [])];
  const dedM = sumItems(deductionsAll);
  const hoursM = r2(periodHours);
  const hoursFrom = e.basis === "hour" ? (a.hoursFrom ?? (useH ? "manual" : "contracted")) : undefined;
  return { id: e.id, staffKey: staffSlug(e.name), name: e.name, role: e.role, op: e.op, basis: e.basis, rate, hpw: e.hpw, weeks: e.weeks || 52, taxCode, niCat, freqLabel: FREQ_LABEL[freq], hoursM, ...(hoursFrom ? { hoursFrom } : {}), basePayM, ...(share < 1 ? { proRata: r2(share * 10000) / 10000 } : {}), ...(unpaidLeaveM > 0 ? { unpaidLeaveM } : {}), ...(sickLeaveM > 0 ? { sickLeaveM } : {}), ...(sickDays > 0 ? { sickPay: (sspOnly ? "ssp" : "full") as SickPay } : {}), ...(lv && Object.keys(lv.byKind).length ? { leave: lv } : {}), addM, dedM, additions, deductions: deductionsAll, manual: { paye: ov.paye != null, eeNi: ov.eeNi != null, eePen: ov.eePen != null }, grossM, payeM, eeNiM, erNiM, eePenM, erPenM, netM: r2(grossM - payeM - eeNiM - eePenM - dedM) };
}

// ── Server-side recalculation of a submitted pay run (routes/payroll.ts POST /runs) ─────────────────────────────────────────────────
// The browser computes every line with computeLine and POSTs the figures; the server re-runs the SAME engine from the STORED employee record plus
// the per-run inputs on the line (hours, adjustments, leave, pro-rata) and compares. Pure (no Firestore) so payrollCalcVerify.mts can test it.
export type CalcMode = "off" | "warn" | "enforce";
/** PAYROLL_SERVER_CALC: off | warn | enforce. Anything else (unset, typo) = warn - NEVER enforce by accident. A caller may ask for "enforce" on its own request
 *  (stricter only) when the server mode is warn; it can never loosen the server mode, and "off" stays off. */
export function resolveCalcMode(env: string | undefined | null, requested?: string | null): CalcMode {
  const e = String(env ?? "").trim().toLowerCase();
  const base: CalcMode = e === "off" || e === "enforce" ? e : "warn";
  if (base === "warn" && requested === "enforce") return "enforce";
  return base;
}
export interface LineMismatch { employeeKey: string; field: string; sent: number | string | null; computed: number | string | null }
/** The submitted line, loosely typed: it is untrusted input straight from the request body. */
export type SubmittedLine = { id?: string; staffKey?: string; name?: string; rate?: number; taxCode?: string; niCat?: string; hoursM?: number; hoursFrom?: string; proRata?: number; sickPay?: string; leave?: LeaveSum; additions?: AdjItem[]; deductions?: AdjItem[]; manual?: { paye?: boolean; eeNi?: boolean; eePen?: boolean } } & Partial<Pick<Line, "grossM" | "payeM" | "eeNiM" | "erNiM" | "eePenM" | "erPenM" | "netM">>;
const DERIVED_ADD = new Set(["__holpay", "__leavepay", "__sickpay"]);
const pence = (n: number) => Math.round(n * 100);
export const CALC_TOLERANCE_P = 1; // 1p
/** Recompute ONE submitted line and list every field that differs by more than 1p. `employed:false` (window given, person not employed in it) is itself a mismatch.
 *  `allowed` = the tax codes / NI categories the tenant legitimately has for this person this period (master record + that period's stored adjustment). */
export function checkRunLine(emp: Emp, line: SubmittedLine, freq: Freq, opts: { window?: { start: string; end: string }; allowedTaxCodes?: string[]; allowedNiCats?: string[]; pensionScheme?: LineOpts["pensionScheme"]; ytd?: LineOpts["ytd"] } = {}): { computed: Line; mismatches: LineMismatch[] } {
  const key = String(line.id ?? emp.id);
  const mm: LineMismatch[] = [];
  const num = (field: string, sent: number | undefined, computed: number, tolP = CALC_TOLERANCE_P) => { if (sent == null) return; if (typeof sent !== "number" || !Number.isFinite(sent) || Math.abs(pence(sent) - pence(computed)) > tolP) mm.push({ employeeKey: key, field, sent: Number.isFinite(sent as number) ? sent : null, computed }); };
  // the things the master record owns are NOT taken on trust from the line
  if (line.rate != null && pence(line.rate) !== pence(emp.rate)) mm.push({ employeeKey: key, field: "rate", sent: line.rate, computed: emp.rate });
  const okCode = (sent: string | undefined, master: string, allowed: string[] | undefined) => !sent || sent === master || (allowed ?? []).includes(sent);
  const taxCode = okCode(line.taxCode, emp.taxCode, opts.allowedTaxCodes) && line.taxCode ? line.taxCode : emp.taxCode;
  const niCat = okCode(line.niCat, emp.niCat, opts.allowedNiCats) && line.niCat ? line.niCat : emp.niCat;
  if (taxCode !== (line.taxCode || emp.taxCode)) mm.push({ employeeKey: key, field: "taxCode", sent: line.taxCode ?? null, computed: emp.taxCode });
  if (niCat !== (line.niCat || emp.niCat)) mm.push({ employeeKey: key, field: "niCat", sent: line.niCat ?? null, computed: emp.niCat });
  // pro-rata share: recomputed from start/leave dates + window when the run states its window, else the line's own proRata
  let share = line.proRata != null ? Math.min(1, Math.max(0, line.proRata)) : 1;
  if (opts.window) {
    const es = employmentShare(emp, opts.window.start, opts.window.end);
    if (!es.employed) mm.push({ employeeKey: key, field: "employed", sent: 1, computed: 0 });
    else { const sentShare = line.proRata ?? 1; if (Math.abs(sentShare - r2(es.share * 10000) / 10000) > 0.0002) mm.push({ employeeKey: key, field: "proRata", sent: sentShare, computed: r2(es.share * 10000) / 10000 }); }
    share = es.employed ? es.share : share;
  }
  const hoursFrom = line.hoursFrom === "manual" || line.hoursFrom === "timesheet" || line.hoursFrom === "contracted" ? line.hoursFrom : undefined;
  const hours = emp.basis === "hour" && (hoursFrom === "manual" || hoursFrom === "timesheet") && typeof line.hoursM === "number" ? line.hoursM : undefined;
  const man = line.manual ?? {};
  const computed = computeLine(emp, {
    hours, taxCode, niCat, hoursFrom, share,
    rolledUp: (line.additions ?? []).some((a) => a.id === "__holpay"),
    additions: (line.additions ?? []).filter((a) => !DERIVED_ADD.has(a.id)),
    deductions: (line.deductions ?? []).filter((d) => d.id !== "__studentloan"),
    override: { paye: man.paye ? line.payeM ?? null : null, eeNi: man.eeNi ? line.eeNiM ?? null : null, eePen: man.eePen ? line.eePenM ?? null : null },
    leave: line.leave, sickPay: line.sickPay === "ssp" ? "ssp" : line.sickPay === "full" ? "full" : undefined,
    pensionScheme: opts.pensionScheme, ytd: opts.ytd,
  }, freq);
  // hourly by hours: hoursM is rounded to 2dp on the line, so allow the rounding its pay can carry (rate x 0.005h) on hours-driven figures
  const hourSlack = hours != null ? Math.ceil(emp.rate * 0.005 * 100) : 0;
  num("grossM", line.grossM, computed.grossM, CALC_TOLERANCE_P + hourSlack);
  num("payeM", line.payeM, computed.payeM, CALC_TOLERANCE_P + hourSlack);
  num("eeNiM", line.eeNiM, computed.eeNiM, CALC_TOLERANCE_P + hourSlack);
  num("erNiM", line.erNiM, computed.erNiM, CALC_TOLERANCE_P + hourSlack);
  num("eePenM", line.eePenM, computed.eePenM, CALC_TOLERANCE_P + hourSlack);
  num("erPenM", line.erPenM, computed.erPenM, CALC_TOLERANCE_P + hourSlack);
  const slOf = (ds?: AdjItem[]) => r2((ds ?? []).filter((d) => d.id === "__studentloan").reduce((n, d) => n + (Number(d.amount) || 0), 0));
  if (line.deductions) num("studentLoan", slOf(line.deductions), slOf(computed.deductions), CALC_TOLERANCE_P + hourSlack);
  num("netM", line.netM, computed.netM, CALC_TOLERANCE_P + 3 * hourSlack);
  return { computed, mismatches: mm };
}
/** Cumulative-PAYE inputs from the stored payrollYtd totals (gross ~ taxable pay, see server/src/lib/payrollYtd.ts) for a run paid on `paidOn`. ADVISORY ONLY
 *  (PAYROLL_SERVER_CALC_YTD=1): the browser's lines are Month-1/Week-1 basis, so feeding this into the comparison would change today's numbers. */
export function ytdInputsFor(paidOn: string, freq: Freq, ytd: { gross?: number; paye?: number } | null | undefined): NonNullable<LineOpts["ytd"]> {
  return { period: taxPeriodNo(paidOn, freq), payToDate: ytd?.gross ?? 0, taxToDate: ytd?.paye ?? 0 };
}
/** A readable one-paragraph refusal for enforce mode. */
export function describeMismatches(mm: LineMismatch[], nameOf: (key: string) => string): string {
  const first = mm.slice(0, 3).map((m) => `${nameOf(m.employeeKey)}: ${m.field} sent ${m.sent} but the server calculates ${m.computed}`).join("; ");
  return `The figures on this pay run don't match the server's own calculation (${first}${mm.length > 3 ? `; and ${mm.length - 3} more` : ""}). Refresh Payroll and create the run again.`;
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
  const off = (t: number) => { const p = new Intl.DateTimeFormat(dl(), { timeZone: "Europe/London", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(t)); const g = (k: string) => Number(p.find((x) => x.type === k)?.value); return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - t; };
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
