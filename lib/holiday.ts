// Holiday & absence model + UK statutory entitlement engine (front-end demo).
//
// Legal basis (gov.uk/holiday-entitlement-rights, Working Time Regulations 1998
// as amended 2024): almost all workers get 5.6 weeks' paid holiday a year =
// (days worked per week × 5.6), CAPPED at 28 days. Bank holidays are NOT
// automatically extra — an employer may include them or give them on top.
// Irregular-hours & part-year workers accrue at 12.07% of hours worked. In the
// first year a worker accrues 1/12 of the annual entitlement at the start of
// each month. Statutory carry-over is limited (the 1.6-week portion by
// agreement). Bank-holiday dates below are England & Wales; Scotland/NI differ.

export type AbsenceKind = "annual" | "sickness" | "toil" | "unpaid" | "maternity" | "parental" | "other";
export type AbsenceStatus = "pending" | "approved" | "declined" | "cancelled";
export type Region = "eng-wal" | "scotland" | "ni";

export interface Absence {
  id: string;
  staffId: string;      // links to the roster / rota staff (demo: name-key)
  name: string;
  kind: AbsenceKind;
  start: string;        // ISO yyyy-mm-dd
  end: string;          // ISO yyyy-mm-dd (== start for a single day)
  half?: "am" | "pm" | null; // half-day, only meaningful when start === end
  days: number;         // paid-leave working days this booking consumes
  status: AbsenceStatus;
  reason?: string;
  requestedAt: string;  // ISO datetime
  decidedBy?: string;
  decidedAt?: string;
  note?: string;        // approver's decline reason / note
  paid?: boolean;       // false = unpaid (e.g. rolled-up staff taking already-paid leave)
}

// Per-tenant leave policy (defaults sit in the store; editable in Settings).
export interface HolidayPolicy {
  leaveYearStartMonth: number;  // 1–12 (1 = Jan, 4 = Apr common in UK)
  leaveYearStartDay: number;    // 1–31
  daysPerWeek: number;          // default working days/week (drives statutory)
  allowanceBasis: "statutory" | "custom";
  customDays: number;           // used when allowanceBasis === "custom"
  bankHolidaysExtra: boolean;   // true = bank holidays on top; false = within allowance
  carryOverMax: number;         // max days that may carry into the next year
  region: Region;
  sickThreshold: number;        // Bradford-style "flag at N sick days" (soft)
  // Company sick-pay policy ON TOP of the statutory floor. "ssp" = statutory only;
  // "enhanced" = full pay for `enhancedDays` days, then SSP.
  sickPay: "ssp" | "enhanced";
  enhancedDays: number;
}

// Statutory Sick Pay. From 6 April 2026 the Lower Earnings Limit and the 3
// waiting days were ABOLISHED — SSP is now payable from day 1 to ALL employees
// (incl. casual/zero-hours), at £123.25/week OR 80% of normal weekly earnings,
// whichever is lower. Max 28 weeks. (2026/27 figures.)
export const SSP_WEEKLY = 123.25;
export const SSP_PCT = 0.8;
export const SSP_MAX_WEEKS = 28;
// A plain-English sick-pay line for a given policy.
export function sickPayNote(policy: Pick<HolidayPolicy, "sickPay" | "enhancedDays">): string {
  const ssp = `Statutory Sick Pay — £${SSP_WEEKLY.toFixed(2)}/week or 80% of normal weekly pay (whichever is lower), from day 1`;
  return policy.sickPay === "enhanced"
    ? `Company sick pay: full pay for the first ${policy.enhancedDays} day${policy.enhancedDays === 1 ? "" : "s"}, then ${ssp}.`
    : `${ssp}. No company top-up.`;
}

// Per-employee record layered over the roster (allowance overrides, start date).
export interface LeaveProfile {
  id: string;                   // matches Absence.staffId
  name: string;
  role?: string;
  op?: string;                  // location
  daysPerWeek?: number;         // overrides policy for part-timers
  allowanceDays?: number;       // overrides the computed allowance
  carriedOver?: number;         // days carried in from last year
  startDate?: string;           // employment start (for first-year accrual)
  // "accrued" (default) = books paid time off; "rolled-up" = holiday is INCLUDED
  // IN PAY at 12.07% (legal for irregular/part-year staff from Apr 2024). Rolled-up
  // staff don't book paid leave — payroll adds a separate 12.07% line instead.
  holidayPay?: "accrued" | "rolled-up";
}
export const isRolledUp = (p?: { holidayPay?: "accrued" | "rolled-up" }) => p?.holidayPay === "rolled-up";

export const HOLIDAY_ABSENCES_KEY = "aos.holiday.absences.v1";
export const HOLIDAY_POLICY_KEY = "aos.holiday.policy.v1";
export const HOLIDAY_PROFILES_KEY = "aos.holiday.profiles.v1";

export const DEFAULT_POLICY: HolidayPolicy = {
  leaveYearStartMonth: 1, leaveYearStartDay: 1, daysPerWeek: 5,
  allowanceBasis: "statutory", customDays: 28, bankHolidaysExtra: false,
  carryOverMax: 5, region: "eng-wal", sickThreshold: 4,
  sickPay: "ssp", enhancedDays: 5,
};

export const KIND_META: Record<AbsenceKind, { label: string; icon: string; tone: string; countsAllowance: boolean }> = {
  annual: { label: "Annual leave", icon: "🌴", tone: "#0ea5e9", countsAllowance: true },
  sickness: { label: "Sickness", icon: "🤒", tone: "#f59e0b", countsAllowance: false },
  toil: { label: "Time off in lieu", icon: "⏳", tone: "#8b5cf6", countsAllowance: false },
  unpaid: { label: "Unpaid leave", icon: "◻️", tone: "#64748b", countsAllowance: false },
  maternity: { label: "Maternity / paternity", icon: "🍼", tone: "#ec4899", countsAllowance: false },
  parental: { label: "Parental leave", icon: "👶", tone: "#14b8a6", countsAllowance: false },
  other: { label: "Other", icon: "🗓️", tone: "#6366f1", countsAllowance: false },
};

// ── Bank holidays (England & Wales) 2025–2027 ───────────────────────────────
const BANK_HOLIDAYS_ENG_WAL: Record<string, string> = {
  "2025-01-01": "New Year’s Day", "2025-04-18": "Good Friday", "2025-04-21": "Easter Monday",
  "2025-05-05": "Early May bank holiday", "2025-05-26": "Spring bank holiday", "2025-08-25": "Summer bank holiday",
  "2025-12-25": "Christmas Day", "2025-12-26": "Boxing Day",
  "2026-01-01": "New Year’s Day", "2026-04-03": "Good Friday", "2026-04-06": "Easter Monday",
  "2026-05-04": "Early May bank holiday", "2026-05-25": "Spring bank holiday", "2026-08-31": "Summer bank holiday",
  "2026-12-25": "Christmas Day", "2026-12-28": "Boxing Day (substitute)",
  "2027-01-01": "New Year’s Day", "2027-03-26": "Good Friday", "2027-03-29": "Easter Monday",
  "2027-05-03": "Early May bank holiday", "2027-05-31": "Spring bank holiday", "2027-08-30": "Summer bank holiday",
  "2027-12-27": "Christmas Day (substitute)", "2027-12-28": "Boxing Day (substitute)",
};
// Scotland/NI vary (2 Jan, St Andrew's, Battle of the Boyne, etc.) — eng-wal is
// fully modelled; others fall back to it in the demo. Backend should use the
// gov.uk bank-holidays JSON feed by division.
export function bankHolidays(_region: Region = "eng-wal"): Record<string, string> { return BANK_HOLIDAYS_ENG_WAL; }
export const isBankHoliday = (iso: string, region: Region = "eng-wal") => iso in bankHolidays(region);

// ── Date helpers ────────────────────────────────────────────────────────────
export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
export const addDays = (iso: string, n: number) => { const d = parse(iso); d.setDate(d.getDate() + n); return isoDate(d); };
export const fmtRange = (start: string, end: string) => {
  const a = parse(start), b = parse(end);
  const opt: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };
  return start === end ? a.toLocaleDateString("en-GB", opt) : `${a.toLocaleDateString("en-GB", opt)} – ${b.toLocaleDateString("en-GB", opt)}`;
};
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

// Working days a booking consumes: weekdays in range, minus bank holidays
// (they're non-working / given). Half-day on a single working day = 0.5.
export function workingDays(start: string, end: string, opts?: { half?: "am" | "pm" | null; region?: Region }): number {
  const region = opts?.region ?? "eng-wal";
  if (start === end) {
    const d = parse(start);
    if (isWeekend(d) || isBankHoliday(start, region)) return 0;
    return opts?.half ? 0.5 : 1;
  }
  let n = 0;
  for (let cur = start; cur <= end; cur = addDays(cur, 1)) {
    const d = parse(cur);
    if (!isWeekend(d) && !isBankHoliday(cur, region)) n += 1;
  }
  return n;
}

// ── Entitlement ─────────────────────────────────────────────────────────────
export const round1 = (n: number) => Math.round(n * 10) / 10;
// Statutory: 5.6 weeks × days/week, capped at 28.
export const statutoryDays = (daysPerWeek: number) => Math.min(28, round1(daysPerWeek * 5.6));
// The 12.07% accrual figure for irregular-hours / part-year workers.
export const ACCRUAL_RATE = 0.1207;
export const accruedFromHours = (hoursWorked: number) => round1(hoursWorked * ACCRUAL_RATE);

// The leave-year window [start,end] (ISO) containing `ref`, per the policy.
export function leaveYear(policy: HolidayPolicy, ref: Date = new Date()): { start: string; end: string; label: string } {
  const m = policy.leaveYearStartMonth - 1, day = policy.leaveYearStartDay;
  let startYear = ref.getFullYear();
  const thisYearStart = new Date(startYear, m, day);
  if (ref < thisYearStart) startYear -= 1;
  const start = new Date(startYear, m, day);
  const end = new Date(startYear + 1, m, day); end.setDate(end.getDate() - 1);
  const label = policy.leaveYearStartMonth === 1 && policy.leaveYearStartDay === 1
    ? `${startYear}`
    : `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  return { start: isoDate(start), end: isoDate(end), label };
}

// Full annual allowance for one person (before carry-over), rounded to 1dp.
export function annualAllowance(profile: LeaveProfile, policy: HolidayPolicy): number {
  if (profile.allowanceDays != null) return round1(profile.allowanceDays);
  const dpw = profile.daysPerWeek ?? policy.daysPerWeek;
  return policy.allowanceBasis === "custom" ? round1(policy.customDays) : statutoryDays(dpw);
}

// Months accrued so far this leave year (first-year employees accrue monthly).
export function accruedAllowance(profile: LeaveProfile, policy: HolidayPolicy, ref: Date = new Date()): number {
  const full = annualAllowance(profile, policy);
  const { start } = leaveYear(policy, ref);
  const joined = profile.startDate && profile.startDate > start ? profile.startDate : start;
  const jd = parse(joined);
  // if they joined this leave year, accrue 1/12 per month from their start
  if (profile.startDate && profile.startDate > start) {
    const monthsWorked = Math.max(0, (ref.getFullYear() - jd.getFullYear()) * 12 + (ref.getMonth() - jd.getMonth()) + 1);
    return round1(Math.min(full, (full / 12) * monthsWorked));
  }
  return full;
}

export interface LeaveSummary {
  allowance: number;      // full annual allowance
  carriedOver: number;
  total: number;          // allowance + carriedOver
  takenAnnual: number;    // approved annual leave already passed or booked
  bookedAnnual: number;   // approved future annual leave
  pendingAnnual: number;  // pending annual-leave days
  remaining: number;      // total − approved annual (taken+booked)
  byKind: Record<AbsenceKind, number>; // approved days per kind this year
  sickness: number;       // approved sickness days this year (Bradford-ish)
}

// Roll an employee's absences up into the numbers the dashboards show.
export function summarise(profile: LeaveProfile, policy: HolidayPolicy, absences: Absence[], ref: Date = new Date()): LeaveSummary {
  const { start, end } = leaveYear(policy, ref);
  const today = isoDate(ref);
  const mine = absences.filter((a) => a.staffId === profile.id && a.status !== "declined" && a.status !== "cancelled" && a.start >= start && a.start <= end);
  const byKind = { annual: 0, sickness: 0, toil: 0, unpaid: 0, maternity: 0, parental: 0, other: 0 } as Record<AbsenceKind, number>;
  let takenAnnual = 0, bookedAnnual = 0, pendingAnnual = 0;
  for (const a of mine) {
    if (a.status === "approved") byKind[a.kind] += a.days;
    if (a.kind === "annual") {
      if (a.status === "pending") pendingAnnual += a.days;
      else if (a.status === "approved") { if (a.end < today) takenAnnual += a.days; else bookedAnnual += a.days; }
    }
  }
  const allowance = annualAllowance(profile, policy);
  const carriedOver = round1(profile.carriedOver || 0);
  const total = round1(allowance + carriedOver);
  const remaining = round1(total - takenAnnual - bookedAnnual);
  return { allowance, carriedOver, total, takenAnnual, bookedAnnual, pendingAnnual, remaining, byKind, sickness: byKind.sickness };
}

// Overlapping approved/pending absences from OTHER people (clash detection).
export function conflicts(target: Absence, all: Absence[]): Absence[] {
  return all.filter((a) => a.id !== target.id && a.staffId !== target.staffId && a.status !== "declined" && a.status !== "cancelled" && a.start <= target.end && a.end >= target.start);
}

// Who is off on a given ISO date (approved only) — for the schedule / who's-off.
export function offOn(iso: string, all: Absence[]): Absence[] {
  return all.filter((a) => a.status === "approved" && a.start <= iso && a.end >= iso);
}

// The next bank/public holiday on or after `fromISO`.
export function nextPublicHoliday(fromISO: string, region: Region = "eng-wal"): { date: string; name: string } | null {
  const entries = Object.entries(bankHolidays(region)).filter(([d]) => d >= fromISO).sort(([a], [b]) => (a < b ? -1 : 1));
  return entries.length ? { date: entries[0][0], name: entries[0][1] } : null;
}
