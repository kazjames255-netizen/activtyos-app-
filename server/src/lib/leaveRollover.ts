// Leave-year carry-over rollover (holiday planner, #40) — the rule lives on the server, not in a browser.
// Pure functions only (no Firestore, no i18n) so it is cheap to test and safe to dry-run.
//
// For the leave year that has just ended:
//   unused  = allowance (+ days carried IN to that year) − approved annual leave starting in it
//   carry   = min(unused, policy.carryOverMax)         -> profile.carriedOver for the new year
//   expired = unused − carry                            -> reported, never silently dropped
// Rolled-up (12.07%) staff book no paid leave, so they carry nothing. A joiner part-way through the
// ended year is pro-rated by whole months (same 1/12-per-month rule the planner uses to accrue).

export interface RolloverPolicy {
  leaveYearStartMonth: number; leaveYearStartDay: number; daysPerWeek: number;
  allowanceBasis?: "statutory" | "custom"; customDays?: number; carryOverMax: number;
}
export interface RolloverProfile {
  id: string; name: string; daysPerWeek?: number; allowanceDays?: number; carriedOver?: number;
  startDate?: string; holidayPay?: "accrued" | "rolled-up"; rolledYearStart?: string;
}
export interface RolloverAbsence { staffId?: string; name?: string; kind: string; status?: string; start: string; days: number }

const r1 = (n: number) => Math.round(n * 10) / 10;
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Leave year [start,end] containing `asOf` (yyyy-mm-dd). A start day the month doesn't have (31 Feb) clamps to month end. */
export function leaveYearOf(policy: Pick<RolloverPolicy, "leaveYearStartMonth" | "leaveYearStartDay">, asOf: string): { start: string; end: string } {
  const m = Math.min(12, Math.max(1, policy.leaveYearStartMonth || 1));
  const startOf = (y: number) => iso(y, m, Math.min(Math.max(1, policy.leaveYearStartDay || 1), new Date(Date.UTC(y, m, 0)).getUTCDate()));
  const y = Number(asOf.slice(0, 4));
  const startYear = asOf < startOf(y) ? y - 1 : y;
  const nextStart = startOf(startYear + 1);
  const end = new Date(Date.parse(`${nextStart}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  return { start: startOf(startYear), end };
}

const statutoryDays = (dpw: number) => Math.min(28, r1(dpw * 5.6));
const allowanceOf = (p: RolloverProfile, pol: RolloverPolicy) =>
  p.allowanceDays != null ? r1(p.allowanceDays)
    : pol.allowanceBasis === "custom" ? r1(pol.customDays ?? 0) : statutoryDays(p.daysPerWeek ?? pol.daysPerWeek);

export interface RolloverRow { id: string; name: string; allowance: number; carriedIn: number; used: number; unused: number; carry: number; expired: number; skipped?: string }
export interface RolloverPlan { endedYear: { start: string; end: string }; newYearStart: string; rows: RolloverRow[] }

export function planRollover(policy: RolloverPolicy, profiles: RolloverProfile[], absences: RolloverAbsence[], asOf: string): RolloverPlan {
  const cur = leaveYearOf(policy, asOf);
  const ended = leaveYearOf(policy, new Date(Date.parse(`${cur.start}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10));
  const cap = Math.max(0, policy.carryOverMax || 0);
  const rows = profiles.map((p): RolloverRow => {
    const base = { id: p.id, name: p.name };
    const zero = { allowance: 0, carriedIn: 0, used: 0, unused: 0, carry: 0, expired: 0 };
    if (p.rolledYearStart === cur.start) return { ...base, ...zero, skipped: "already rolled for this leave year" };
    if (p.holidayPay === "rolled-up") return { ...base, ...zero, skipped: "holiday is rolled up into pay" };
    if (p.startDate && p.startDate > ended.end) return { ...base, ...zero, skipped: "joined after the ended leave year" };
    let allowance = allowanceOf(p, policy);
    if (p.startDate && p.startDate > ended.start) {
      const sy = Number(p.startDate.slice(0, 4)), sm = Number(p.startDate.slice(5, 7));
      const ey = Number(ended.end.slice(0, 4)), em = Number(ended.end.slice(5, 7));
      const months = Math.max(0, Math.min(12, (ey - sy) * 12 + (em - sm) + 1));
      allowance = r1(Math.min(allowance, (allowance / 12) * months));
    }
    const nm = p.name.trim().toLowerCase();
    const used = r1(absences
      .filter((a) => a.kind === "annual" && a.status === "approved" && a.start >= ended.start && a.start <= ended.end && (a.staffId === p.id || (a.name ?? "").trim().toLowerCase() === nm))
      .reduce((s, a) => s + (Number(a.days) || 0), 0));
    const carriedIn = r1(Math.max(0, p.carriedOver || 0));
    const unused = r1(Math.max(0, allowance + carriedIn - used));
    const carry = r1(Math.min(unused, cap));
    return { ...base, allowance, carriedIn, used, unused, carry, expired: r1(unused - carry) };
  });
  return { endedYear: ended, newYearStart: cur.start, rows };
}
