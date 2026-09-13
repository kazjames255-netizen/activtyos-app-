"use client";

// Payroll — an extensive front-end payroll workspace for a UK children's-activity
// provider. Employees (the REAL team from Team & invites, plus anyone added by
// hand — pay details per person), pay runs paid from contracts or APPROVED
// timesheets (clock in/out) with approved leave applied, ESTIMATED PAYE /
// National Insurance / pension / net, branded payslips, and accounting
// integrations (QuickBooks / Xero / Sage). All figures are estimates for
// planning — real RTI/HMRC filing, exact tax codes and the live accounting
// sync are the backend/integration piece (Amir). Pay details, adjustments and
// every approved run live on the server (/api/payroll); the demo cast and the
// browser stores are for the guided tour (demo mode) only.
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import { CollapsibleStats, LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { useSettings } from "@/lib/settings";
import { get as apiGet, isDemoMode, patch as apiPatch, post as apiPost, put as apiPut } from "@/lib/api";
import { DEMO_STAFF } from "@/features/learning/credentials";
import { useTeam, type TeamMember } from "@/features/team/useTeam";
import { fetchOnboarding } from "@/features/team/onboardStore";
import { loadAbsences as loadHolidayAbsences, loadProfiles as loadHolidayProfiles } from "@/features/holiday/data";
import { hhmm, loadClockSettings } from "@/features/timeclock/data";
import { isoDate, KIND_META, type AbsenceKind } from "@/lib/holiday";
import { csvCell } from "@/lib/csv";
import {
  type AdjItem, type Adjust, type ClockRec, type Emp, type Freq, type LeaveAbsence, type LeaveSum, type Line, type SickPay, type TimesheetSum,
  computeLine, grossMonthly, leaveForPeriod, PPY, FREQ_LABEL, r2, staffSlug, timesheetHours, clockPayHours, londonMs, ukShiftHours,
} from "./payCalc";
export type { AdjItem, Adjust, Freq, Line } from "./payCalc";

const gbp = (n: number) => "£" + (n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const gbp0 = (n: number) => "£" + Math.round(n || 0).toLocaleString("en-GB");
const escH = (s: unknown = "") => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "no connection");
const leaveLabel = (lv: LeaveSum) => Object.entries(lv.byKind).map(([k, d]) => `${d} day${d === 1 ? "" : "s"} ${(KIND_META[k as AbsenceKind]?.label ?? k).toLowerCase()}`).join(" · ");

export interface PayRun { id: string; period: string; paidOn: string; lines: Line[]; status: "draft" | "approved"; hoursBasis?: "contracted" | "rota" | "timesheet"; freq?: Freq; window?: { start: string; end: string }; createdAt?: string; publishedAt?: string | null }
export const PAYROLL_RUNS_KEY = "aos.payroll.runs.v1";

// Standalone payslip window — shared by the operator Payroll view and the staff
// My-payslips view. YTD is summed from every run the employee appears in.
export function openPayslip(l: Line, period: string, paidOn: string, provider: string, runs: PayRun[]) {
  if (typeof window === "undefined") return;
  const paid = new Date(`${paidOn}T12:00:00`); const mo = paid.getMonth();
  const taxMonth = ((mo - 3 + 12) % 12) + 1; const taxYearStart = mo >= 3 ? paid.getFullYear() : paid.getFullYear() - 1;
  // YTD = this tax year's runs up to and including this one (not every run ever)
  const tyFrom = `${taxYearStart}-04-06`;
  const ytdL = runs.filter((r) => r.paidOn >= tyFrom && r.paidOn <= paidOn).flatMap((r) => r.lines).filter((x) => x.id === l.id);
  const ytd = (k: keyof Line) => ytdL.reduce((a, x) => a + (typeof x[k] === "number" ? (x[k] as number) : 0), 0);
  const ty = `${taxYearStart}/${String((taxYearStart + 1) % 100).padStart(2, "0")}`;
  const freqLabel = l.freqLabel || "Monthly";
  const taxWeek = Math.min(53, Math.max(1, Math.floor((Date.UTC(paid.getFullYear(), paid.getMonth(), paid.getDate()) - Date.UTC(taxYearStart, 3, 6)) / (7 * 86400000)) + 1));
  const taxPeriod = freqLabel === "Weekly" ? `Week ${taxWeek} · ${ty}` : freqLabel === "Monthly" ? `Month ${taxMonth} · ${ty}` : `${freqLabel} · ${ty}`;
  const row = (k: string, v: string, strong = false) => `<tr><td>${escH(k)}</td><td style="text-align:right${strong ? ";font-weight:800" : ""}">${escH(v)}</td></tr>`;
  const basePay = l.basePayM ?? l.grossM;
  const unpaidM = l.unpaidLeaveM || 0, sickM = l.sickLeaveM || 0, lv = l.leave;
  const plural = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
  // unpaid leave: off the salary as its own line; for hourly staff the hours are already net of it
  const baseRow = l.basis === "hour"
    ? row(`Basic pay · ${l.hoursM} hrs${l.hoursFrom === "timesheet" ? " (approved timesheets)" : ""} @ £${l.rate.toFixed(2)}`, gbp(basePay)) + (unpaidM > 0 && lv ? row(`Unpaid leave · ${plural(lv.unpaidDays)} (${r2(unpaidM / (l.rate || 1))} hrs not paid)`, "—") : "") + (sickM > 0 && lv ? row(`Sickness · ${plural(lv.sickDays)} (${r2(sickM / (l.rate || 1))} hrs not paid — SSP only)`, "—") : "")
    : row("Salary", gbp(basePay + unpaidM + sickM)) + (unpaidM > 0 && lv ? row(`Unpaid leave · ${plural(lv.unpaidDays)}`, "−" + gbp(unpaidM)) : "") + (sickM > 0 && lv ? row(`Sickness · ${plural(lv.sickDays)} (SSP only)`, "−" + gbp(sickM)) : "");
  const pays = baseRow + (l.additions || []).map((x) => row(x.label || "Addition", gbp(x.amount))).join("");
  const leaveMeta = lv && Object.keys(lv.byKind).length ? `<div style="grid-column:1/-1">Leave this period · <b>${escH(leaveLabel(lv))}</b></div>` : "";
  const statNote = lv && (lv.sickDays || lv.statutoryDays) ? ` <b>This period includes ${escH([lv.sickDays ? `${plural(lv.sickDays)} sickness${l.sickPay === "ssp" ? " (deducted — SSP to be added by your payroll provider)" : l.sickPay === "full" ? " (paid in full)" : ""}` : "", lv.statutoryDays ? `${plural(lv.statutoryDays)} statutory-pay leave` : ""].filter(Boolean).join(" and "))} — Statutory Sick Pay / statutory family pay are NOT included in these figures.</b>` : "";
  const deds = row("PAYE tax (est.)", gbp(l.payeM)) + row("Employee NI (est.)", gbp(l.eeNiM)) + row("Pension — auto-enrolment", gbp(l.eePenM)) + (l.deductions || []).map((x) => row(x.label || "Deduction", gbp(x.amount))).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Payslip — ${escH(l.name)}</title><style>body{font-family:-apple-system,'Segoe UI',Arial,sans-serif;color:#1a1c2b;max-width:660px;margin:0 auto;padding:40px}h1{font-size:20px;margin:0}.tag{display:inline-block;background:#fdf3e0;color:#8a5a09;border-radius:99px;padding:2px 9px;font-size:10.5px;font-weight:800;margin-bottom:6px}.sub{color:#6b7086;font-size:12px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:2px 18px;font-size:12px;color:#4a4763;margin:14px 0;border-top:1px solid #e5e7f0;padding-top:12px}.meta b{color:#1a1c2b}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:16px 0}h3{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#3557b7;border-bottom:1px solid #e5e7f0;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-size:13px}td{padding:5px 0;border-top:1px solid #eef1f7}.net{background:#eef4fd;border-radius:10px;padding:14px;margin-top:14px;display:flex;justify-content:space-between;align-items:center}.net b{font-size:22px;color:#1d3a8f}.est{font-size:11px;color:#8a92a8;margin-top:14px}@media print{body{padding:0}}</style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start"><div><span class="tag">Estimated payslip · pay preview</span><h1>${escH(provider)}</h1><div class="sub">Payslip · ${escH(period)} · paid ${escH(paid.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))}</div></div><div style="text-align:right"><div style="font-weight:800">${escH(l.name)}</div><div class="sub">${escH(l.role)} · ${escH(l.op)}</div></div></div>
    <div class="meta"><div>Tax code · <b>${escH(l.taxCode)}</b></div><div>NI category · <b>${escH(l.niCat)}</b></div><div>Tax period · <b>${escH(taxPeriod)}</b></div><div>Frequency · <b>${escH(freqLabel)}</b></div>${leaveMeta}</div>
    <div class="grid"><div><h3>Payments</h3><table>${pays}${(l.additions || []).length || ((unpaidM > 0 || sickM > 0) && l.basis === "year") ? row("Gross pay", gbp(l.grossM), true) : ""}</table></div><div><h3>Deductions</h3><table>${deds}</table></div></div>
    <div class="net"><span>Net pay · BACS</span><b>${gbp(l.netM)}</b></div>
    <div class="grid"><div><h3>Year to date (${escH(ty)})</h3><table>${row("Gross", gbp(ytd("grossM")))}${row("PAYE", gbp(ytd("payeM")))}${row("Employee NI", gbp(ytd("eeNiM")))}${row("Pension", gbp(ytd("eePenM")))}${row("Net", gbp(ytd("netM")), true)}</table></div><div><h3>Employer costs</h3><table>${row("Employer NI (est.)", gbp(l.erNiM))}${row("Employer pension", gbp(l.erPenM))}${row("Total cost to employer", gbp(l.grossM + l.erNiM + l.erPenM), true)}</table></div></div>
    <div class="est">⚠ This is an ESTIMATE for planning, not a statutory itemised pay statement. PAYE, NI and pension are computed on simplified UK 2026/27 rest-of-UK bands using tax code ${escH(l.taxCode)}; pension is 5%/3% of qualifying earnings. Your real payslip is produced by the payroll provider from the RTI/HMRC submission (student loans, statutory pay, Scottish/Welsh bands etc. not modelled here).${statNote}</div>
    <script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></body></html>`;
  const w = window.open(); if (w) { w.document.write(html); w.document.close(); }
}
// Browser stores — the guided tour (demo mode) only; a real account's payroll is on the server.
const readLocal = <T,>(k: string): T | null => { try { return JSON.parse(localStorage.getItem(k) || "null") as T | null; } catch { return null; } };
const EKEY = "aos.payroll.employees.v2"; // v2 — added weeks/year, stable ids
const RKEY = PAYROLL_RUNS_KEY;
const IKEY = "aos.payroll.integrations.v1";
const ADJKEY = "aos.payroll.adjust.v1"; // period -> empId -> per-run Adjust

const DEMO_PAY: Record<string, Partial<Emp>> = {
  "Marcus Bell": { basis: "year", rate: 26000, hpw: 40, pension: true },
  "Jess Patel": { basis: "hour", rate: 13.5, hpw: 22, pension: true },
  "Aisha Rahman": { basis: "hour", rate: 14.25, hpw: 30, pension: true },
  "Tom Lewis": { basis: "hour", rate: 12.5, hpw: 16, pension: false },
  "Priya Khan": { basis: "hour", rate: 12.5, hpw: 18, pension: true },
  "Dan Reed": { basis: "year", rate: 31000, hpw: 40, pension: true },
};

type OnbRec = { staff: string; values: Record<string, { v?: string } | undefined> };
// pay/hours captured in a person's onboarding record ("payRate" field), if any
function onboardingPay(recs: OnbRec[], name: string): { basis: "hour" | "year"; rate: number; hpw?: number } | null {
  const rec = recs.find((r) => (r.staff || "").trim().toLowerCase() === name.trim().toLowerCase());
  try {
    const p = JSON.parse(rec?.values?.payRate?.v || "null");
    const rate = p?.amount ? parseFloat(String(p.amount).replace(/[£,]/g, "")) : NaN;
    if (!(rate > 0)) return null;
    return { basis: p.basis === "year" ? "year" : "hour", rate, hpw: parseFloat(p.hpw) || undefined };
  } catch { return null; }
}

// Demo mode (guided tour) only: the demo cast.
function seedEmployees(): Emp[] {
  let onb: OnbRec[] = [];
  try { onb = JSON.parse(localStorage.getItem("aos.team.onboardrecords.v1") || "[]"); } catch { /* ignore */ }
  return DEMO_STAFF.map((s) => {
    const d = DEMO_PAY[s.name] ?? { basis: "hour", rate: 12.5, hpw: 20, pension: true };
    const p = onboardingPay(onb, s.name);
    const basis = p?.basis ?? (d.basis as "hour" | "year"), rate = p?.rate ?? (d.rate as number), hpw = p?.hpw ?? (d.hpw as number);
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "emp_" + s.name.replace(/\s/g, "");
    return { id, name: s.name, role: s.role, op: s.op, basis, rate, hpw, weeks: basis === "hour" ? 45 : 52, taxCode: "1257L", niCat: "A", pension: d.pension ?? true };
  });
}

// A real team member with no pay details saved yet: whatever onboarding (or
// the Schedule's rate) already knows; hourly, paid from approved timesheets.
// Rate 0 = "needs pay details" (shown on the row) — never a made-up figure.
function defaultEmp(t: TeamMember, onb: OnbRec[], rotaRate?: number): Emp {
  const p = onboardingPay(onb, t.name);
  const basis = p?.basis ?? "hour";
  return { id: staffSlug(t.name), name: t.name, role: t.role || "", op: t.op || "", basis, rate: p?.rate ?? rotaRate ?? 0, hpw: p?.hpw ?? 0, weeks: 52, taxCode: "1257L", niCat: "A", pension: true, paidFrom: basis === "hour" ? "timesheet" : "contracted", source: "team" };
}
// "rota" was the old name of the timesheet source; salaried staff are always contracted
const sourceOf = (e: Emp): "contracted" | "timesheet" => (e.basis === "year" ? "contracted" : e.paidFrom === "rota" || e.paidFrom === "timesheet" ? "timesheet" : "contracted");

// ── Demo mode: hours from the Schedule's browser store ──────────────────────
// The guided tour has no server, so there its "timesheet" hours are the demo
// rota's clocked in/out (aos.rota.v5): prefers real check-in/out (in/out) over
// planned start/end and subtracts an unpaid break. Matched by name. A real
// account is paid from its APPROVED server timesheets (/api/payroll/timesheets).
const ROTA_KEY = "aos.rota.v5";
const rhm = (t: string) => { const [h, m] = (t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
// (londonMs — UK wall-clock time → real instant, d16s7 — now lives in payCalc.)
/** Hours for a shift: clocked in/out over planned, overnight shifts wrap past
 *  midnight (they paid 0h), and the break is only taken off when breaks are
 *  unpaid (Setup → Scheduling; it was always taken off — d16s3). */
const shiftHours = (s: { date?: string; start: string; end: string; in?: string; out?: string; clockedBreakMin?: number; brk?: { from: string; to: string } }, breakPaid = false) => {
  const a = s.in || s.start, b = s.out || s.end;
  let gross = s.date ? (londonMs(s.date, b) - londonMs(s.date, a)) / 60000 : rhm(b) - rhm(a);
  if (gross < 0) gross += 24 * 60; // finished after midnight
  // A clocked-out shift carries the break actually taken; otherwise the planned one.
  const brk = breakPaid ? 0 : s.out && typeof s.clockedBreakMin === "number" ? s.clockedBreakMin : s.brk ? Math.max(0, rhm(s.brk.to) - rhm(s.brk.from)) : 0;
  return Math.max(0, gross - brk) / 60;
};
// rostered hours per staff member for shifts whose date falls in [startISO, endISO]
function rotaHoursForRange(startISO: string, endISO: string, breakPaid = false): { byName: Record<string, number>; rateByName: Record<string, number>; hasData: boolean } {
  const byName: Record<string, number> = {}; const rateByName: Record<string, number> = {};
  if (typeof window === "undefined") return { byName, rateByName, hasData: false };
  let store: { staff?: { id: string; name: string; rate?: number }[]; shifts?: { staffId: string | null; date: string; start: string; end: string; in?: string; out?: string; clockedBreakMin?: number; brk?: { from: string; to: string } }[] } | null = null;
  try { store = JSON.parse(localStorage.getItem(ROTA_KEY) || "null"); } catch { /* ignore */ }
  if (!store || !Array.isArray(store.shifts) || !Array.isArray(store.staff)) return { byName, rateByName, hasData: false };
  const idToName: Record<string, string> = {};
  store.staff.forEach((s) => { const nm = (s.name || "").trim().toLowerCase(); idToName[s.id] = s.name; if (nm && s.rate) rateByName[nm] = s.rate; });
  for (const sh of store.shifts) {
    if (!sh.staffId || !sh.date || sh.date < startISO || sh.date > endISO) continue;
    const nm = (idToName[sh.staffId] || "").trim().toLowerCase();
    if (nm) byName[nm] = (byName[nm] || 0) + shiftHours(sh, breakPaid);
  }
  return { byName, rateByName, hasData: store.shifts.length > 0 };
}

// The pay period for an anchor date at a given frequency: monthly = calendar
// month; weekly/fortnightly/4-weekly = a window ending on the anchor's Sunday.
// LOCAL calendar date — toISOString() is UTC, which moved every window a day
// early east of GMT (and in BST at midnight): September ran 31 Aug – 29 Sep.
const isoD = isoDate;
const fmtD = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
function periodWindow(anchor: Date, freq: Freq): { start: string; end: string; label: string; paidOn: string } {
  if (freq === "monthly") {
    const s = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const e = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { start: isoD(s), end: isoD(e), label: monthLabel(anchor), paidOn: isoD(e) };
  }
  const days = freq === "weekly" ? 7 : freq === "fortnightly" ? 14 : 28;
  const end = new Date(anchor); end.setDate(end.getDate() + ((7 - end.getDay()) % 7)); // this week's Sunday
  const start = new Date(end); start.setDate(start.getDate() - (days - 1));
  const label = `${FREQ_LABEL[freq]} · ${fmtD(start)} – ${fmtD(end)}`;
  return { start: isoD(start), end: isoD(end), label, paidOn: isoD(end) };
}
// step the anchor one whole period forward (+1) or back (−1)
function stepAnchor(anchor: Date, freq: Freq, dir: number): Date {
  const d = new Date(anchor);
  if (freq === "monthly") d.setMonth(d.getMonth() + dir);
  else d.setDate(d.getDate() + dir * (freq === "weekly" ? 7 : freq === "fortnightly" ? 14 : 28));
  return d;
}

const monthLabel = (d: Date) => d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
const INTEGRATIONS = [
  { id: "quickbooks", name: "QuickBooks", icon: "🟢", blurb: "Post each pay run as a journal to QuickBooks Online." },
  { id: "xero", name: "Xero", icon: "🔵", blurb: "Sync wages, PAYE/NI and pension to Xero." },
  { id: "sage", name: "Sage", icon: "🟩", blurb: "Export to Sage Business Cloud Accounting." },
];

export function PayrollApp() {
  const { settings } = useSettings();
  const provider = settings.providerName || settings.billing?.businessName || "Your company";
  const demo = isDemoMode();
  const team = useTeam(); // the REAL team (joined staff, own franchise); the demo cast only in demo mode
  const [tab, setTab] = useState<"overview" | "employees" | "run" | "payslips" | "integrations">("overview");
  // pay details saved per person (server; demo: this browser). null = not loaded yet
  const [stored, setStored] = useState<Emp[] | null>(() => (demo ? (readLocal<Emp[]>(EKEY)?.length ? readLocal<Emp[]>(EKEY) : seedEmployees()) : null));
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [runs, setRuns] = useState<PayRun[]>(() => (demo ? readLocal<PayRun[]>(RKEY) ?? [] : []));
  const [conn, setConn] = useState<Record<string, boolean>>(() => readLocal<Record<string, boolean>>(IKEY) ?? {});
  const [edit, setEdit] = useState<{ emp: Emp; isNew?: boolean } | null>(null);
  const [adjEmp, setAdjEmp] = useState<Emp | null>(null); // employee whose pay-run adjustments are being edited
  const [toast, setToast] = useState<string | null>(null);
  const [freq, setFreq] = useState<Freq>("monthly");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [adjust, setAdjust] = useState<Record<string, Record<string, Adjust>>>(() => (demo ? readLocal<Record<string, Record<string, Adjust>>>(ADJKEY) ?? {} : {})); // period -> empId -> Adjust
  const [onb, setOnb] = useState<OnbRec[]>([]);
  const [rotaStore, setRotaStore] = useState<{ staff?: { id: string; name: string; rate?: number }[]; shifts?: { staffId: string | null; date: string; start: string; end: string }[] } | null>(null);
  const [absences, setAbsences] = useState<LeaveAbsence[]>(() => { try { return demo ? loadHolidayAbsences() : []; } catch { return []; } });
  const [profiles, setProfiles] = useState<{ id: string; name: string; holidayPay?: string }[]>(() => { try { return demo ? loadHolidayProfiles() : []; } catch { return []; } });
  const [clock, setClock] = useState<ClockRec[]>([]); // this period's timesheets (server)
  const [sickPay, setSickPay] = useState<SickPay>("full"); // company sick-pay rule (server; demo: this page only)
  const [clockTick, setClockTick] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (demo) return; // the tour reads this browser's stores (initial state above)
    apiGet<{ employees: Emp[] | null; adjust: Record<string, Record<string, Adjust>>; runs: PayRun[]; settings?: { sickPay?: SickPay } }>("/api/payroll")
      .then((r) => { setStored(r?.employees ?? []); setAdjust(r?.adjust ?? {}); setRuns(r?.runs ?? []); setSickPay(r?.settings?.sickPay === "ssp" ? "ssp" : "full"); })
      .catch((e) => setLoadErr(`Payroll couldn't load: ${errMsg(e)}`));
    apiGet<{ absences: LeaveAbsence[]; profiles: { id: string; name: string; holidayPay?: string }[] }>("/api/leave").then((r) => { setAbsences(r?.absences ?? []); setProfiles(r?.profiles ?? []); }).catch(() => {});
    apiGet<{ staff: { id: string; name: string; rate?: number }[]; shifts: { staffId: string | null; date: string; start: string; end: string }[] }>("/api/rota").then((r) => setRotaStore(r)).catch(() => {});
    fetchOnboarding().then((r) => setOnb((r?.records ?? []) as OnbRec[])).catch(() => {});
  }, [demo]);
  const loaded = stored !== null;
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3200); };
  const cleanEmp = (e: Emp): Emp => ({ id: e.id, name: e.name, role: e.role || "", op: e.op || "", basis: e.basis, rate: Math.max(0, Number(e.rate) || 0), hpw: Math.min(100, Math.max(0, Number(e.hpw) || 0)), weeks: Math.min(53, Math.max(1, Number(e.weeks) || 52)), taxCode: (e.taxCode || "1257L").trim(), niCat: e.niCat || "A", pension: !!e.pension, ...(e.paidFrom ? { paidFrom: e.paidFrom === "rota" ? "timesheet" : e.paidFrom } : {}), ...(e.source ? { source: e.source } : {}) });
  const saveEmps = (next: Emp[]) => {
    if (demo) { setStored(next); try { localStorage.setItem(EKEY, JSON.stringify(next)); } catch { /* ignore */ } return; }
    if (!loaded) { flash("Payroll is still loading — try again in a moment."); return; }
    const prev = stored; setStored(next);
    apiPut("/api/payroll/employees", { employees: next.map(cleanEmp) }).catch((e) => { setStored(prev); flash(`⚠ Not saved: ${errMsg(e)}`); });
  };
  const saveSickPay = (v: SickPay) => {
    if (v === sickPay) return;
    const prev = sickPay; setSickPay(v);
    if (demo) return;
    apiPut("/api/payroll/settings", { sickPay: v }).then(() => flash(v === "ssp" ? "Sick pay: SSP only — sick days are deducted; SSP is added by your payroll provider." : "Sick pay: full contracted pay.")).catch((e) => { setSickPay(prev); flash(`⚠ Not saved: ${errMsg(e)}`); });
  };
  const saveConn = (c: Record<string, boolean>) => { setConn(c); try { localStorage.setItem(IKEY, JSON.stringify(c)); } catch { /* ignore */ } };
  const saveAdjust = (a: Record<string, Record<string, Adjust>>, periodKey: string) => {
    setAdjust(a);
    if (demo) { try { localStorage.setItem(ADJKEY, JSON.stringify(a)); } catch { /* ignore */ } return; }
    apiPut("/api/payroll/adjust", { period: periodKey, adjust: a[periodKey] ?? null }).catch((e) => flash(`⚠ Adjustment not saved: ${errMsg(e)}`));
  };

  // the pay period (window + label) for the chosen frequency & anchor date
  const win = useMemo(() => periodWindow(anchor, freq), [anchor, freq]);
  const period = win.label;
  // this period's timesheets, from the server (every device's clockings)
  useEffect(() => {
    if (demo) return;
    let live = true;
    apiGet<ClockRec[]>(`/api/payroll/timesheets?from=${win.start}&to=${win.end}`).then((r) => { if (live) setClock(r ?? []); }).catch(() => { if (live) setClock([]); });
    return () => { live = false; };
  }, [demo, win.start, win.end, clockTick]);

  // Employees: everyone on the real team (their saved pay details, or what
  // onboarding / the Schedule already knows), then anyone added by hand or no
  // longer on the team (a leaver can still need a final pay run).
  const teamIds = useMemo(() => new Set(team.map((t) => staffSlug(t.name))), [team]);
  const rotaRateByKey = useMemo(() => { const m: Record<string, number> = {}; for (const s of rotaStore?.staff ?? []) if (s.name && s.rate) m[staffSlug(s.name)] = s.rate; return m; }, [rotaStore]);
  const emps: Emp[] = useMemo(() => {
    if (demo) return stored ?? [];
    const byId = new Map((stored ?? []).map((e) => [e.id, e]));
    const out: Emp[] = []; const seen = new Set<string>();
    for (const t of team) {
      const id = staffSlug(t.name); if (!id || seen.has(id)) continue; seen.add(id);
      const s = byId.get(id);
      out.push(s ? { ...s, name: t.name, role: s.role || t.role || "", source: "team" } : defaultEmp(t, onb, rotaRateByKey[id]));
    }
    for (const e of stored ?? []) if (!seen.has(e.id)) { seen.add(e.id); out.push(e); }
    return out;
  }, [demo, stored, team, onb, rotaRateByKey]);
  const tagOf = (e: Emp): string | null => (demo ? null : e.source === "manual" ? "added by hand" : !teamIds.has(e.id) ? "not on the team now" : null);

  // hours: approved timesheets (server) — the demo's are its browser rota
  const breakPaid = settings.scheduling?.breakPaid === "paid";
  const rota = useMemo(() => (demo ? rotaHoursForRange(win.start, win.end, breakPaid) : { byName: {} as Record<string, number>, rateByName: {}, hasData: false }), [demo, win.start, win.end, tab, breakPaid]);
  const clockPol = useMemo(() => loadClockSettings(), [tab]); // the Timesheets screen's pay policy (grace, rounding, overtime)
  // scheduled hours per person per day — the Timesheets screen's "Sched" (their
  // shift's end − start, in real time so the night the clocks change counts — d16s7)
  const schedMap = useMemo(() => {
    const idTo: Record<string, string> = {}; for (const s of rotaStore?.staff ?? []) idTo[s.id] = staffSlug(s.name || "");
    const m: Record<string, number> = {};
    for (const sh of rotaStore?.shifts ?? []) { if (!sh.staffId || !idTo[sh.staffId]) continue; const k = `${idTo[sh.staffId]}|${sh.date}`; if (!(k in m)) m[k] = ukShiftHours(sh.date, sh.start, sh.end); }
    return m;
  }, [rotaStore]);
  const schedFor = (e: Emp) => (day: string) => schedMap[`${staffSlug(e.name)}|${day}`] ?? 0;
  const tsFor = (e: Emp): TimesheetSum => {
    if (demo) { const h = rota.byName[e.name.trim().toLowerCase()]; return { approvedH: r2(h ?? 0), pendingH: 0, openDays: 0, overtimeUnpaidH: 0, days: h != null ? 1 : 0 }; }
    return timesheetHours(clock, staffSlug(e.name), schedFor(e), clockPol, breakPaid);
  };
  const tsRowsFor = (e: Emp) => clock.filter((r) => r.id === staffSlug(e.name) && r.clockInAt).sort((a, b) => a.day.localeCompare(b.day)).map((rec) => ({ rec, ...clockPayHours(rec, schedFor(e)(rec.day), clockPol, breakPaid) }));
  const setTimesheet = (rec: ClockRec, patch: Record<string, unknown>, msg: string) => {
    apiPatch(`/api/timeclock/${encodeURIComponent(rec.id)}?day=${rec.day}`, patch).then(() => { setClockTick((t) => t + 1); flash(msg); }).catch((e) => flash(`⚠ Timesheet not updated: ${errMsg(e)}`));
  };

  // approved leave this period (the holiday planner). Rolled-up staff (holiday
  // INCLUDED IN PAY at 12.07%) get the separate 12.07% line instead of paid leave.
  const rolledUpKeys = useMemo(() => new Set(profiles.filter((p) => p.holidayPay === "rolled-up").flatMap((p) => [p.id, staffSlug(p.name || "")])), [profiles]);
  const isRolledUp = (e: Emp) => rolledUpKeys.has(staffSlug(e.name));
  const leaveOf = (e: Emp) => leaveForPeriod(absences, staffSlug(e.name), win.start, win.end, { rolledUp: isRolledUp(e) });

  // each hourly employee is paid from contracted hours OR approved timesheets
  // (their own setting); salaried staff are always contracted
  const empSource = sourceOf;
  const setSource = (id: string, src: "contracted" | "timesheet") => saveEmps(emps.map((x) => (x.id === id ? { ...x, paidFrom: src } : x)));
  const bulkSource = (src: "contracted" | "timesheet") => saveEmps(emps.map((x) => (x.basis === "hour" ? { ...x, paidFrom: src } : x)));
  const periodAdj = adjust[period] || {};
  const adjOf = (id: string): Adjust | undefined => periodAdj[id];
  // One person's line: a manual per-run hours override wins, else approved
  // timesheet hours if paid from timesheets, else contracted (less unpaid leave).
  const lineFor = (e: Emp, a: Adjust | undefined = adjOf(e.id)): Line => {
    const src = empSource(e);
    const manualH = a?.hours != null && e.basis === "hour";
    const hours = manualH ? (a!.hours as number) : e.basis === "hour" && src === "timesheet" ? tsFor(e).approvedH : undefined;
    const hoursFrom = e.basis !== "hour" ? undefined : manualH ? "manual" : src === "timesheet" ? "timesheet" : "contracted";
    return computeLine(e, { hours, taxCode: a?.taxCode, niCat: a?.niCat, additions: a?.additions, deductions: a?.deductions, override: a?.override, rolledUp: isRolledUp(e), hoursFrom, leave: leaveOf(e), sickPay }, freq);
  };
  const lines = emps.map((e) => lineFor(e));
  const isAdjusted = (e: Emp) => { const a = adjOf(e.id); return !!a && (a.hours != null || !!a.taxCode || !!a.niCat || !!(a.additions?.length) || !!(a.deductions?.length) || a.override?.paye != null || a.override?.eeNi != null || a.override?.eePen != null); };
  const tsEmps = emps.filter((e) => empSource(e) === "timesheet");
  const tsSum: Record<string, TimesheetSum> = Object.fromEntries(tsEmps.map((e) => [e.id, tsFor(e)]));
  const zeroHourNames = tsEmps.filter((e) => adjOf(e.id)?.hours == null && !(tsSum[e.id].approvedH > 0)).map((e) => e.name);
  const pendingEmps = tsEmps.filter((e) => tsSum[e.id].pendingH > 0 || tsSum[e.id].openDays > 0);
  const noRateNames = emps.filter((e) => !(e.rate > 0)).map((e) => e.name);
  const setEmpAdjust = (id: string, a: Adjust | null) => { const next = { ...adjust, [period]: { ...periodAdj } }; if (a) next[period][id] = a; else delete next[period][id]; if (Object.keys(next[period]).length === 0) delete next[period]; saveAdjust(next, period); };
  const totalGross = lines.reduce((a, l) => a + l.grossM, 0);
  const totalNet = lines.reduce((a, l) => a + l.netM, 0);
  const totalErCost = lines.reduce((a, l) => a + l.grossM + l.erNiM + l.erPenM, 0);
  const totalPaye = lines.reduce((a, l) => a + l.payeM, 0);
  const nextPay = new Date(`${win.paidOn}T00:00:00`);

  const runPayroll = async () => {
    if (!loaded || !lines.length) { flash(loaded ? "No employees to pay yet — add them on the Employees tab." : "Payroll is still loading."); return; }
    if (noRateNames.length && !window.confirm(`No pay rate set for ${noRateNames.join(", ")} — they'll be paid £0. Set it on the Employees tab, or approve anyway?`)) return;
    if (zeroHourNames.length && !window.confirm(`${zeroHourNames.length} timesheet-paid staff have no APPROVED hours for ${period} (${zeroHourNames.join(", ")}). They'll be paid £0. Approve anyway?`)) return;
    if (pendingEmps.length && !window.confirm(`Timesheet hours not yet approved for ${period}: ${pendingEmps.map((e) => `${e.name} ${tsSum[e.id].pendingH}h${tsSum[e.id].openDays ? ` + ${tsSum[e.id].openDays} shift(s) never clocked out` : ""}`).join(", ")}. They are NOT paid in this run. Approve anyway?`)) return;
    if (runs.some((r) => r.period === period) && !window.confirm(`A payroll run for ${period} already exists. Approve another? Both are kept (a payroll record is never overwritten).`)) return;
    const body = { period, paidOn: win.paidOn, lines, hoursBasis: (tsEmps.length ? "timesheet" : "contracted") as PayRun["hoursBasis"], freq, window: { start: win.start, end: win.end } };
    if (demo) {
      const next = [{ id: "pr_" + new Date().getTime().toString(36), status: "approved" as const, ...body }, ...runs];
      setRuns(next); try { localStorage.setItem(RKEY, JSON.stringify(next)); } catch { /* ignore */ }
    } else {
      setBusy(true);
      try { const run = await apiPost<PayRun>("/api/payroll/runs", body); setRuns((rs) => [run, ...rs]); } // never delete a prior run — versioned history
      catch (e) { flash(`⚠ The pay run wasn't saved: ${errMsg(e)}`); return; }
      finally { setBusy(false); }
    }
    flash(`✅ ${period} — ${lines.length} payslips generated (${gbp0(totalNet)} net · ${FREQ_LABEL[freq]}).${demo ? "" : " Publish them to staff from the Payslips tab."}`);
    setTab("payslips");
  };
  const publishRun = async (r: PayRun, on: boolean) => {
    if (on && !window.confirm(`Publish ${r.period}'s payslips to the ${r.lines.length} people on it? Each sees only their own estimated payslip under My payslips.`)) return;
    try {
      const res = await apiPost<{ publishedAt: string | null }>(`/api/payroll/runs/${encodeURIComponent(r.id)}/publish`, { published: on });
      setRuns((rs) => rs.map((x) => (x.id === r.id ? { ...x, publishedAt: res.publishedAt } : x)));
      flash(on ? "📣 Published — staff can see their own payslip." : "Unpublished — hidden from staff.");
    } catch (e) { flash(`⚠ ${errMsg(e)}`); }
  };

  const showPayslip = (l: Line, period: string, paidOn: string) => openPayslip(l, period, paidOn, provider, runs);

  const exportCsv = () => {
    // guard against CSV/formula injection: shared lib/csv (quotes, neutralises leading = + - @ tab CR)
    const cell = (x: string | number) => csvCell(typeof x === "number" ? x.toFixed(2) : x);
    const rows = [["Employee", "Role", "Location", "Frequency", "Period", "Hours", "Hours basis", "Leave", "Base pay", "Unpaid leave", "Sick leave deducted (SSP only)", "Additions", "Deductions", "Tax code", "NI cat", "Gross", "PAYE", "EE NI", "Pension", "Net", "ER NI", "ER Pension"], ...lines.map((l) => [l.name, l.role, l.op, FREQ_LABEL[freq], period, l.basis === "year" ? "" : l.hoursM, l.basis === "year" ? "salary" : l.hoursFrom ?? "contracted", l.leave ? leaveLabel(l.leave) : "", l.basePayM, l.unpaidLeaveM ?? 0, l.sickLeaveM ?? 0, l.addM, l.dedM, l.taxCode, l.niCat, l.grossM, l.payeM, l.eeNiM, l.eePenM, l.netM, l.erNiM, l.erPenM])];
    const csv = rows.map((r) => r.map(cell).join(",")).join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `payroll-${monthLabel(new Date())}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const tile = (label: string, value: string, sub: string, grad: string) => (
    <div className="rounded-2xl p-4 text-white shadow-[0_18px_40px_-26px_rgba(16,32,90,.6)]" style={{ background: grad }}>
      <div className="text-[11px] font-bold uppercase tracking-wide text-white/85">{label}</div>
      <div className="mt-1 text-[26px] font-extrabold leading-none tabular-nums" style={{ fontFamily: "var(--ff-display)" }}>{value}</div>
      <div className="mt-1 text-[11.5px] text-white/85">{sub}</div>
    </div>
  );
  const chip = (text: string, tone: string, title?: string) => <span title={title} className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-bold align-middle ${tone}`}>{text}</span>;

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="Payroll" icon="💷" lede="Weekly or monthly pay runs — hours from contracts or approved timesheets, approved leave applied, estimated PAYE, NI and pension, fully editable, branded payslips, and one-tap export to your accounting software." />
      {loadErr && <div className="mb-3 rounded-xl bg-[#fdecec] px-3 py-2 text-[12.5px] font-semibold text-[#c0392b]">⚠ {loadErr}</div>}

      <div className="mb-3 inline-flex flex-wrap gap-0.5 rounded-full border border-[var(--line)] bg-[var(--panel)] p-0.5">
        {([["overview", "📊 Overview"], ["employees", "👥 Employees"], ["run", "▶ Pay run"], ["payslips", "🧾 Payslips"], ["integrations", "🔌 Integrations"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={"rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors " + (tab === k ? "bg-white text-[#1d3a8f] shadow-sm" : "text-[var(--ink-3)] hover:text-[var(--ink-2)]")}>{l}</button>
        ))}
      </div>

      {tab === "overview" && (<>
        <CollapsibleStats id="payroll">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {tile(`This ${freq === "monthly" ? "month" : "period"} · gross`, gbp0(totalGross), `${emps.length} employees · ${FREQ_LABEL[freq]}`, "linear-gradient(135deg,#1d3a8f,#3f7ae0)")}
          {tile("Net to pay", gbp0(totalNet), "after tax, NI & pension", "linear-gradient(135deg,#166534,#37b26a)")}
          {tile("PAYE + NI to HMRC", gbp0(totalPaye + lines.reduce((a, l) => a + l.eeNiM + l.erNiM, 0)), "estimated liability", "linear-gradient(135deg,#9d174d,#f43f5e)")}
          {tile("Total employer cost", gbp0(totalErCost), "incl. employer NI & pension", "linear-gradient(135deg,#334155,#64748b)")}
        </div>
        </CollapsibleStats>
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2"><div><div className="text-[13.5px] font-extrabold text-[var(--ink)]">Next pay day</div><div className="text-[12px] text-[var(--ink-3)]">{nextPay.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · {FREQ_LABEL[freq]} · {period}</div></div><Button variant="primary" className="ml-auto" onClick={() => setTab("run")}>▶ Run payroll</Button></div>
          {runs.length > 0 && <div className="mt-3 border-t border-[var(--line)] pt-3"><div className="mb-1.5 text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Recent runs</div>{runs.slice(0, 3).map((r) => <div key={r.id} className="flex items-center gap-2 py-1 text-[12.5px]"><span className="font-bold text-[var(--ink)]">{r.period}</span><span className="text-[var(--ink-3)]">{r.lines.length} payslips · {gbp0(r.lines.reduce((a, l) => a + l.netM, 0))} net</span><span className="ml-auto rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[10px] font-bold text-[#0f7a43]">{r.publishedAt ? "published" : r.status}</span></div>)}</div>}
        </Card>
      </>)}

      {tab === "employees" && (
        <Card className="p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2"><div className="text-[12px] text-[var(--ink-3)]">{demo ? "Pay rate & hours pull from each person’s onboarding record — edit here to override." : "Everyone who has joined your team (Team & invites) is here — set each person’s pay once. Add someone who isn’t on the app (e.g. office staff) by hand."} Tax code &amp; NI category as advised by HMRC.</div><Button className="ml-auto" onClick={() => setEdit({ emp: { id: "", name: "", role: "", op: "", basis: "hour", rate: 0, hpw: 0, weeks: 52, taxCode: "1257L", niCat: "A", pension: true, paidFrom: "contracted", source: "manual" }, isNew: true })}>+ Add employee</Button></div>
          {!loaded && !loadErr && <div className="p-4 text-center text-[12.5px] text-[var(--ink-3)]">Loading payroll…</div>}
          {loaded && emps.length === 0 && <div className="rounded-xl bg-[var(--panel)] p-5 text-center text-[12.5px] text-[var(--ink-3)]">No staff on your team yet — invite them from <b>Team &amp; invites</b> (they appear here once they join), or <b>+ Add employee</b> by hand.</div>}
          {emps.length > 0 && <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full text-[13px]"><thead><tr className="bg-[var(--panel)] text-left text-[10px] uppercase tracking-wide text-[var(--ink-3)]"><th className="px-3 py-2.5 font-extrabold">Employee</th><th className="px-3 py-2.5 font-extrabold">Basis</th><th className="px-3 py-2.5 font-extrabold">Rate</th><th className="px-3 py-2.5 font-extrabold">Hrs/wk</th><th className="px-3 py-2.5 font-extrabold">Paid from</th><th className="px-3 py-2.5 font-extrabold">Gross/mo</th><th className="px-3 py-2.5 font-extrabold">Tax code</th><th className="px-3 py-2.5 font-extrabold">Pension</th><th className="px-3 py-2.5"></th></tr></thead>
              <tbody>{emps.map((e) => { const tag = tagOf(e); return (
                <tr key={e.id} className="border-t border-[var(--line-2,#eef2f8)]"><td className="px-3 py-2.5 font-bold text-[var(--ink)]">{e.name}<span className="ml-1 text-[10.5px] font-normal text-[var(--ink-3)]">{e.role}</span>{tag && <span className="ml-1.5">{chip(tag, "bg-[#eef1f6] text-[#64748b]")}</span>}{!(e.rate > 0) && <span className="ml-1.5">{chip("needs pay details", "bg-[#fdf3e0] text-[#8a5a09]")}</span>}</td><td className="px-3 py-2.5 text-[var(--ink-2)]">{e.basis === "year" ? "Salary" : "Hourly"}</td><td className="px-3 py-2.5 tabular-nums text-[var(--ink-2)]">{e.basis === "year" ? gbp0(e.rate) + "/yr" : "£" + e.rate.toFixed(2) + "/hr"}</td><td className="px-3 py-2.5 tabular-nums text-[var(--ink-2)]">{e.basis === "year" ? "—" : e.hpw}</td><td className="px-3 py-2.5 text-[12px] text-[var(--ink-2)]">{e.basis === "year" ? "Salary" : empSource(e) === "timesheet" ? "Timesheets" : "Contract"}</td><td className="px-3 py-2.5 font-bold tabular-nums text-[var(--ink)]">{e.basis === "hour" && empSource(e) === "timesheet" ? <span className="font-normal text-[var(--ink-3)]">by hours</span> : gbp0(grossMonthly(e))}</td><td className="px-3 py-2.5 tabular-nums text-[var(--ink-2)]">{e.taxCode}</td><td className="px-3 py-2.5">{e.pension ? <span className="rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[10px] font-bold text-[#0f7a43]">Enrolled</span> : <span className="rounded-full bg-[#eef1f6] px-2 py-0.5 text-[10px] font-bold text-[#64748b]">Opted out</span>}</td><td className="px-3 py-2.5 text-right"><button type="button" onClick={() => setEdit({ emp: e })} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">Edit</button></td></tr>
              ); })}</tbody>
            </table>
          </div>}
        </Card>
      )}

      {tab === "run" && (
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2"><div><div className="text-[14px] font-extrabold text-[var(--ink)]">Pay run</div><div className="text-[12px] text-[var(--ink-3)]">Review, then approve to generate payslips. Figures are estimates.</div></div><div className="ml-auto flex gap-2"><Button onClick={exportCsv}>⬇ Export CSV</Button><Button variant="primary" onClick={runPayroll} disabled={busy || !loaded}>{busy ? "Saving…" : "✓ Approve & generate payslips"}</Button></div></div>

          {/* Frequency + period picker */}
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
            <div className="flex items-center gap-2"><span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Frequency</span>
              <div className="inline-flex overflow-hidden rounded-lg border border-[var(--line)]">
                {(["weekly", "fortnightly", "fourweekly", "monthly"] as Freq[]).map((f) => (
                  <button key={f} type="button" onClick={() => setFreq(f)} className={`px-2.5 py-1.5 text-[11.5px] font-bold ${freq === f ? "bg-[#1d3a8f] text-white" : "bg-white text-[var(--ink-2)] hover:bg-[#f2f5fb]"}`}>{FREQ_LABEL[f]}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5"><span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Period</span>
              <button type="button" onClick={() => setAnchor(stepAnchor(anchor, freq, -1))} className="rounded-lg border border-[var(--line)] px-2 py-1 text-[13px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">‹</button>
              <span className="min-w-[150px] text-center text-[12.5px] font-bold text-[var(--ink)]">{period}</span>
              <button type="button" onClick={() => setAnchor(stepAnchor(anchor, freq, 1))} className="rounded-lg border border-[var(--line)] px-2 py-1 text-[13px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">›</button>
              <button type="button" onClick={() => setAnchor(new Date())} className="ml-1 text-[11px] font-bold text-[#1d3a8f] hover:underline">Today</button>
            </div>
            <span className="text-[11px] text-[var(--ink-3)]">Paid {nextPay.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span>
          </div>

          {/* Per-employee hours source — mix contracted (e.g. admin) and approved timesheets (clock in/out) */}
          <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Hourly staff paid from</span>
              <span className="text-[11.5px] text-[var(--ink-3)]">Set per person on each row — mix and match. Set all hourly:</span>
              <button type="button" onClick={() => bulkSource("contracted")} className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">Contracted</button>
              <button type="button" onClick={() => bulkSource("timesheet")} className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">Approved timesheets</button>
            </div>
            {/* Company sick-pay rule (s13-pay3) */}
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Sick pay</span>
              <div className="inline-flex overflow-hidden rounded-lg border border-[var(--line)]">
                {([["full", "Full contracted pay"], ["ssp", "SSP only"]] as [SickPay, string][]).map(([v, label]) => (
                  <button key={v} type="button" onClick={() => saveSickPay(v)} className={`px-2.5 py-1.5 text-[11.5px] font-bold ${sickPay === v ? "bg-[#1d3a8f] text-white" : "bg-white text-[var(--ink-2)] hover:bg-[#f2f5fb]"}`}>{label}{v === "full" ? " (default)" : ""}</button>
                ))}
              </div>
              <span className="text-[11.5px] text-[var(--ink-3)]">{sickPay === "ssp" ? "Approved sick days are deducted like unpaid leave. SSP isn’t calculated here — your payroll provider adds it." : "Approved sick days are paid as normal (timesheet staff get a contracted day, hrs/wk ÷ 5)."}</span>
            </div>
            {demo && tsEmps.length > 0 && !rota.hasData && <div className="mt-2 rounded-lg bg-[#fdf3e0] px-3 py-2 text-[11.5px] font-semibold text-[#8a5a09]">Some staff are paid from timesheets, but nothing is clocked in the Schedule for {period}.</div>}
            {tsEmps.length > 0 && (() => { const totH = tsEmps.reduce((n, e) => n + tsSum[e.id].approvedH, 0); const totW = tsEmps.reduce((n, e) => n + tsSum[e.id].approvedH * e.rate, 0); return <div className="mt-2 rounded-lg bg-[#eef4fd] px-3 py-2 text-[11.5px] font-semibold text-[#1d3a8f]">↩ From {demo ? "the Schedule" : "approved timesheets (Clock in/out)"} for {period}: <b>{r2(totH)}h</b> across {tsEmps.length} staff → <b>{gbp0(totW)}</b> basic pay (before leave, tax, NI &amp; pension). Hours are the Timesheets screen&rsquo;s own &ldquo;Pay hrs&rdquo; — breaks, rounding, lateness and overtime rules included.</div>; })()}
            {pendingEmps.length > 0 && <div className="mt-2 rounded-lg bg-[#fdf3e0] px-3 py-2 text-[11.5px] font-semibold text-[#8a5a09]">⏳ Not approved yet — <b>not paid in this run</b>: {pendingEmps.map((e) => `${e.name} ${tsSum[e.id].pendingH}h${tsSum[e.id].openDays ? ` (+${tsSum[e.id].openDays} shift${tsSum[e.id].openDays === 1 ? "" : "s"} never clocked out)` : ""}`).join(", ")}. Approve them from ✏️ Edit on the row, or in Timesheets.</div>}
            {tsEmps.length > 0 && zeroHourNames.length > 0 && <div className="mt-2 rounded-lg bg-[#fdf3e0] px-3 py-2 text-[11.5px] font-semibold text-[#8a5a09]">⚠ No approved hours for: {zeroHourNames.join(", ")} — they&rsquo;ll show £0. Approve their timesheets, set them to Contracted, or approve as-is.</div>}
            {noRateNames.length > 0 && <div className="mt-2 rounded-lg bg-[#fdf3e0] px-3 py-2 text-[11.5px] font-semibold text-[#8a5a09]">⚠ No pay rate set for: {noRateNames.join(", ")} — set it on the <button type="button" onClick={() => setTab("employees")} className="underline">Employees</button> tab.</div>}
          </div>

          <div className="mb-2 text-[11.5px] text-[var(--ink-3)]">Everything is editable per person, per period — click <b>Edit</b> on a row to change hours, tax code, NI category, add overtime/bonus or deductions, or override PAYE/NI/pension. Net always recalculates. Nothing here changes the employee&rsquo;s master record. <b>Leave</b> comes from approved bookings in Leave &amp; absence: unpaid leave comes off contracted hours or salary; paid leave is paid at the normal rate (timesheet staff get it added); rolled-up staff are paid holiday as their 12.07% line instead.</div>
          <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full text-[12.5px]"><thead><tr className="bg-[var(--panel)] text-left text-[10px] uppercase tracking-wide text-[var(--ink-3)]"><th className="px-3 py-2.5 font-extrabold">Employee</th><th className="px-3 py-2.5 text-right font-extrabold">Hours</th><th className="px-3 py-2.5 text-right font-extrabold">Gross</th><th className="px-3 py-2.5 text-right font-extrabold">PAYE</th><th className="px-3 py-2.5 text-right font-extrabold">NI</th><th className="px-3 py-2.5 text-right font-extrabold">Pension</th><th className="px-3 py-2.5 text-right font-extrabold">Net</th><th className="px-3 py-2.5 text-right font-extrabold">Er cost</th><th className="px-3 py-2.5 text-right font-extrabold"></th></tr></thead>
              <tbody>{lines.map((l, i) => { const e = emps[i]; const ts = tsSum[e.id]; const lv = l.leave; const man = (on: boolean) => on ? <sup className="ml-0.5 text-[8px] font-black text-[#b45309]" title="Manual override">M</sup> : null; return (
                <tr key={l.id} className="border-t border-[var(--line-2,#eef2f8)]">
                  <td className="px-3 py-2 font-bold text-[var(--ink)]">{l.name}{isAdjusted(e) && <span className="ml-1.5">{chip("adjusted", "bg-[#fdf3e0] text-[#8a5a09]")}</span>}{isRolledUp(e) && <span className="ml-1.5">{chip("holiday rolled-up", "bg-[#eef1f6] text-[#64748b]", "Holiday is included in pay at 12.07% — annual leave isn't paid again")}</span>}
                    {(l.addM > 0 || l.dedM > 0) && <div className="mt-0.5 text-[10px] font-semibold text-[var(--ink-3)]">{l.addM > 0 && <span className="text-[#0f7a43]">+{gbp(l.addM)} additions</span>}{l.addM > 0 && l.dedM > 0 && " · "}{l.dedM > 0 && <span className="text-[#c0392b]">−{gbp(l.dedM)} deductions</span>}</div>}
                    {lv && <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] font-semibold">{Object.entries(lv.byKind).map(([k, d]) => <span key={k} className="rounded-full bg-[#eef4fd] px-1.5 py-0.5 text-[#1d3a8f]">{KIND_META[k as AbsenceKind]?.icon ?? "🗓️"} {d}d {(KIND_META[k as AbsenceKind]?.label ?? k).toLowerCase()}</span>)}{(l.unpaidLeaveM ?? 0) > 0 && <span className="text-[#c0392b]">−{gbp(l.unpaidLeaveM ?? 0)} unpaid leave</span>}{(l.sickLeaveM ?? 0) > 0 && <span className="text-[#c0392b]">−{gbp(l.sickLeaveM ?? 0)} sickness</span>}</div>}
                    {lv && lv.paidDays > 0 && l.hoursFrom === "timesheet" && !(e.hpw > 0) && !isRolledUp(e) && <div className="mt-0.5 text-[10px] font-bold text-[#b45309]">⚠ {lv.paidDays}d paid leave not valued — set their hours/week on the Employees tab (a day off is a fifth of it), or add holiday pay with Edit.</div>}
                    {lv && lv.sickDays > 0 && (sickPay === "ssp"
                      ? <div className="mt-0.5 text-[10px] font-bold text-[#b45309]">🤒 {lv.sickDays}d sickness {l.hoursFrom === "manual" ? "— hours entered by hand" : l.hoursFrom === "timesheet" ? "not paid (not clocked)" : "deducted like unpaid leave"} · SSP to be added by your payroll provider.</div>
                      : l.hoursFrom === "timesheet" && !(e.hpw > 0)
                        ? <div className="mt-0.5 text-[10px] font-bold text-[#b45309]">⚠ {lv.sickDays}d sickness not valued — set their hours/week on the Employees tab (a sick day is a fifth of it), or add sick pay with Edit.</div>
                        : <div className="mt-0.5 text-[10px] font-semibold text-[#0f7a43]">🤒 {lv.sickDays}d sickness — full pay{l.hoursFrom === "timesheet" ? " added at the normal rate" : l.hoursFrom === "manual" ? " (hours entered by hand)" : ""}.</div>)}
                    {lv && lv.statutoryDays > 0 && <div className="mt-0.5 text-[10px] font-bold text-[#b45309]">⚠ {lv.statutoryDays}d statutory-pay leave: SMP / statutory pay not calculated — {l.hoursFrom === "timesheet" ? "nothing is paid for these days" : "pay is left unchanged"}. Adjust with Edit.</div>}
                    {ts && l.hoursFrom === "timesheet" && (ts.pendingH > 0 || ts.openDays > 0 || ts.overtimeUnpaidH > 0) && <div className="mt-0.5 text-[10px] font-semibold text-[#8a5a09]">{[ts.pendingH > 0 ? `⏳ ${ts.pendingH}h awaiting approval` : "", ts.openDays > 0 ? `🕒 ${ts.openDays} shift${ts.openDays === 1 ? "" : "s"} not clocked out` : "", ts.overtimeUnpaidH > 0 ? `+${ts.overtimeUnpaidH}h overtime unpaid` : ""].filter(Boolean).join(" · ")}</div>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--ink-2)]">{l.basis === "year" ? <span className="text-[var(--ink-3)]">Salary</span> : <div className="flex items-center justify-end gap-1.5">{adjOf(e.id)?.hours != null && <span className="rounded bg-[#fdf3e0] px-1 py-0.5 text-[9.5px] font-bold text-[#8a5a09]" title="Manual hours">manual</span>}<span>{l.hoursM}h</span><button type="button" onClick={() => setSource(e.id, empSource(e) === "timesheet" ? "contracted" : "timesheet")} title="Click to switch this person between contracted hours and approved timesheets" className={`rounded px-1 py-0.5 text-[9.5px] font-bold ${empSource(e) === "timesheet" ? "bg-[#e7edfb] text-[#1d3a8f]" : "bg-[#eef1f6] text-[#64748b]"}`}>{empSource(e) === "timesheet" ? "timesheet ⇄" : "contract ⇄"}</button></div>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{gbp(l.grossM)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#c0392b]">{gbp(l.payeM)}{man(l.manual.paye)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#c0392b]">{gbp(l.eeNiM)}{man(l.manual.eeNi)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#c0392b]">{gbp(l.eePenM)}{man(l.manual.eePen)}</td>
                  <td className="px-3 py-2 text-right font-extrabold tabular-nums text-[#0f7a43]">{gbp(l.netM)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--ink-3)]">{gbp(l.grossM + l.erNiM + l.erPenM)}</td>
                  <td className="px-3 py-2 text-right"><button type="button" onClick={() => setAdjEmp(e)} className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[#1d3a8f] hover:border-[#1d3a8f]">✏️ Edit</button></td>
                </tr>
              ); })}
              {lines.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-[12.5px] text-[var(--ink-3)]">{loaded ? "No employees yet — add them on the Employees tab." : "Loading…"}</td></tr>}
              <tr className="border-t-2 border-[var(--line)] bg-[var(--panel)] font-extrabold"><td className="px-3 py-2.5">Totals</td><td className="px-3 py-2.5 text-right tabular-nums text-[var(--ink-3)]">{lines.filter((l) => l.basis === "hour").reduce((a, l) => a + l.hoursM, 0).toFixed(1)}h</td><td className="px-3 py-2.5 text-right tabular-nums">{gbp(totalGross)}</td><td className="px-3 py-2.5 text-right tabular-nums">{gbp(totalPaye)}</td><td className="px-3 py-2.5 text-right tabular-nums">{gbp(lines.reduce((a, l) => a + l.eeNiM, 0))}</td><td className="px-3 py-2.5 text-right tabular-nums">{gbp(lines.reduce((a, l) => a + l.eePenM, 0))}</td><td className="px-3 py-2.5 text-right tabular-nums text-[#0f7a43]">{gbp(totalNet)}</td><td className="px-3 py-2.5 text-right tabular-nums">{gbp(totalErCost)}</td><td></td></tr></tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "payslips" && (
        <Card className="p-4">
          {runs.length === 0 ? <div className="p-6 text-center text-[13px] text-[var(--ink-3)]">No pay runs yet — approve one from the <b>Pay run</b> tab.</div> : (
            <div className="space-y-4">{runs.map((r) => (
              <div key={r.id}>
                <div className="mb-1.5 flex flex-wrap items-center gap-2"><span className="text-[13.5px] font-extrabold text-[var(--ink)]">{r.period}</span><span className="text-[11.5px] text-[var(--ink-3)]">paid {new Date(`${r.paidOn}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {gbp0(r.lines.reduce((a, l) => a + l.netM, 0))} net</span>
                  {!demo && (r.publishedAt
                    ? <span className="ml-auto flex items-center gap-2"><span className="rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[10px] font-bold text-[#0f7a43]">📣 Published to staff</span><button type="button" onClick={() => publishRun(r, false)} className="text-[11px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">Unpublish</button></span>
                    : <button type="button" onClick={() => publishRun(r, true)} className="ml-auto rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[11px] font-bold text-[#1d3a8f] hover:border-[#1d3a8f]">📣 Publish to staff</button>)}
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">{r.lines.map((l) => (
                  <button key={l.id} type="button" onClick={() => showPayslip(l, r.period, r.paidOn)} className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-left hover:border-[#1d3a8f]"><span className="text-[12.5px] font-bold text-[var(--ink)]">{l.name}</span><span className="text-[11px] text-[var(--ink-3)]">{l.role}</span><span className="ml-auto text-[12px] font-extrabold tabular-nums text-[#0f7a43]">{gbp(l.netM)}</span><span className="text-[11px] font-bold text-[#1d3a8f]">🧾 Payslip</span></button>
                ))}</div>
              </div>
            ))}</div>
          )}
        </Card>
      )}

      {tab === "integrations" && (
        <Card className="p-4">
          <div className="mb-3 text-[12px] text-[var(--ink-3)]">Connect your accounting software to post each approved pay run as a wages journal (gross, PAYE/NI liability, net, pension). One place, no re-keying.</div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {INTEGRATIONS.map((i) => { const on = !!conn[i.id]; return (
              <div key={i.id} className="rounded-2xl border border-[var(--line)] p-4">
                <div className="mb-1 flex items-center gap-2"><span className="text-[22px]">{i.icon}</span><span className="text-[14px] font-extrabold text-[var(--ink)]">{i.name}</span>{on && <span className="ml-auto rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[10px] font-bold text-[#0f7a43]">Connected</span>}</div>
                <div className="mb-3 text-[11.5px] leading-relaxed text-[var(--ink-3)]">{i.blurb}</div>
                {on ? <div className="flex flex-wrap gap-2"><Button onClick={() => flash(`↗ Posted ${monthLabel(new Date())} wages journal to ${i.name}.`)}>Post journal</Button><button type="button" onClick={() => saveConn({ ...conn, [i.id]: false })} className="text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">Disconnect</button></div> : <Button variant="primary" onClick={() => { saveConn({ ...conn, [i.id]: true }); flash(`✓ ${i.name} connected (demo).`); }}>Connect {i.name}</Button>}
              </div>
            ); })}
          </div>
          <p className="mt-3 text-[11px] text-[var(--ink-3)]">Or <button type="button" onClick={exportCsv} className="font-bold text-[#1d3a8f] underline">export a CSV</button> for any provider. Real OAuth connections + the RTI/HMRC submission are the backend piece.</p>
        </Card>
      )}

      {edit && <EmpEditor emp={edit.emp} isNew={edit.isNew} canRemove={!demo && !edit.isNew && (edit.emp.source === "manual" || !teamIds.has(edit.emp.id))} takenIds={new Set(emps.map((x) => x.id))}
        onSave={(e) => { saveEmps(edit.isNew ? [...emps, e] : emps.map((x) => (x.id === e.id ? e : x))); setEdit(null); }}
        onRemove={() => { if (window.confirm(`Remove ${edit.emp.name} from payroll? Past pay runs and payslips are kept.`)) { saveEmps(emps.filter((x) => x.id !== edit.emp.id)); setEdit(null); } }}
        onClose={() => setEdit(null)} />}
      {adjEmp && <RunAdjust emp={adjEmp} period={period} freq={freq} value={adjOf(adjEmp.id)} preview={(a) => lineFor(adjEmp, a)} ts={empSource(adjEmp) === "timesheet" ? tsSum[adjEmp.id] ?? tsFor(adjEmp) : undefined} tsRows={demo ? [] : tsRowsFor(adjEmp)} hoursSource={empSource(adjEmp)} onTimesheet={setTimesheet} onSave={(a) => { setEmpAdjust(adjEmp.id, a); setAdjEmp(null); }} onClose={() => setAdjEmp(null)} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[150] max-w-[92vw] -translate-x-1/2 rounded-2xl bg-[#111634] px-4 py-2.5 text-center text-[12.5px] font-bold text-white shadow-xl">{toast}</div>}
      <p className="mt-4 text-[11px] text-[var(--ink-3)]">⚠ PAYE, National Insurance and pension are <b>estimates for planning</b> (UK 2026/27, rest-of-UK bands; employer NI 15% over £5,000; pension on qualifying earnings). Tax code &amp; NI category are applied; <b>not</b> modelled: Scottish/Welsh bands, student loans, statutory pay (SSP/SMP — rows with sickness or statutory leave say so; sick days follow your Sick pay setting on the pay run), Employment Allowance and RTI. The real payroll — exact calc, RTI/HMRC filing and statutory payslips — is your payroll provider / the accounting integration.</p>
    </div>
  );
}

function EmpEditor({ emp, isNew, canRemove, takenIds, onSave, onRemove, onClose }: { emp: Emp; isNew?: boolean; canRemove?: boolean; takenIds: Set<string>; onSave: (e: Emp) => void; onRemove: () => void; onClose: () => void }) {
  const [e, setE] = useState<Emp>(emp);
  const [err, setErr] = useState<string | null>(null);
  const save = () => {
    if (isNew) {
      const name = e.name.trim(); const id = staffSlug(name);
      if (!name) { setErr("Enter their name."); return; }
      if (takenIds.has(id)) { setErr(`${name} is already on the list — edit them there.`); return; }
      onSave({ ...e, name, id, source: "manual" }); return;
    }
    onSave(e);
  };
  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[8vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(ev) => ev.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{isNew ? "Add employee" : e.name}</h3><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
        <div className="grid gap-2.5">
          {isNew && <>
            <div className="rounded-lg bg-[var(--panel)] px-3 py-2 text-[11.5px] text-[var(--ink-3)]">For someone who isn&rsquo;t on the app (e.g. office staff). Staff who join through <b>Team &amp; invites</b> appear here on their own. Use the name they clock in under, so timesheets and leave match.</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Full name</span><Input value={e.name} onChange={(ev) => { setE({ ...e, name: ev.target.value }); setErr(null); }} className="w-full" /></label>
              <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Role</span><Input value={e.role} onChange={(ev) => setE({ ...e, role: ev.target.value })} className="w-full" /></label>
            </div>
          </>}
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Pay basis</span><Select value={e.basis} onChange={(ev) => setE({ ...e, basis: ev.target.value as "hour" | "year" })} className="w-full"><option value="hour">Hourly</option><option value="year">Annual salary</option></Select></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{e.basis === "year" ? "Salary (£/yr)" : "Rate (£/hr)"}</span><Input inputMode="decimal" value={String(e.rate)} onChange={(ev) => setE({ ...e, rate: parseFloat(ev.target.value) || 0 })} className="w-full" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Hours / week</span><Input inputMode="decimal" value={String(e.hpw)} onChange={(ev) => setE({ ...e, hpw: parseFloat(ev.target.value) || 0 })} disabled={e.basis === "year"} className="w-full" /></label>
          </div>
          {e.basis === "hour" && <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Weeks / year <span className="normal-case text-[var(--ink-3)]">(52 = all year · 38–45 = term-time / seasonal)</span></span><Input inputMode="decimal" value={String(e.weeks)} onChange={(ev) => setE({ ...e, weeks: parseFloat(ev.target.value) || 52 })} className="w-full" /></label>}
          {e.basis === "hour" && <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Paid from <span className="normal-case text-[var(--ink-3)]">(admin/office staff → Contracted; coaches who clock in → Timesheets)</span></span><Select value={sourceOf(e)} onChange={(ev) => setE({ ...e, paidFrom: ev.target.value as "contracted" | "timesheet" })} className="w-full"><option value="contracted">Contracted hours</option><option value="timesheet">Approved timesheets (clock in/out)</option></Select><span className="mt-1 block text-[10.5px] text-[var(--ink-3)]">Hours / week also values leave: a day off is a fifth of it.</span></label>}
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Tax code</span><Input value={e.taxCode} onChange={(ev) => setE({ ...e, taxCode: ev.target.value })} className="w-full" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">NI category</span><Select value={e.niCat} onChange={(ev) => setE({ ...e, niCat: ev.target.value })} className="w-full">{["A", "B", "C", "H", "M"].map((c) => <option key={c} value={c}>{c}</option>)}</Select></label>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--panel)] px-3 py-2"><input type="checkbox" checked={e.pension} onChange={(ev) => setE({ ...e, pension: ev.target.checked })} className="h-4 w-4 accent-[#1d3a8f]" /><span className="text-[12.5px] font-bold text-[var(--ink)]">Enrolled in workplace pension (5% / 3%)</span></label>
          <div className="rounded-lg bg-[#eef4fd] px-3 py-2 text-[12px] font-semibold text-[#1d3a8f]">{e.basis === "hour" && sourceOf(e) === "timesheet" ? `Paid for approved timesheet hours at £${(e.rate || 0).toFixed(2)}/hr` : `Estimated gross: ${gbp0(grossMonthly(e))}/month`}</div>
          {err && <div className="rounded-lg bg-[#fdecec] px-3 py-2 text-[12px] font-semibold text-[#c0392b]">{err}</div>}
        </div>
        <div className="mt-3 flex items-center gap-2">{canRemove && <button type="button" onClick={onRemove} className="text-[12px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">Remove from payroll</button>}<div className="ml-auto flex gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{isNew ? "Add" : "Save"}</Button></div></div>
      </div>
    </div>
  );
}

// Per-run adjustments for one employee: hours / tax code / NI / additions /
// deductions / manual PAYE-NI-pension overrides. Everything editable; net always
// recalculates. Saves to the period's adjustment store, not the master record.
type TsRow = { rec: ClockRec; payH: number; workedH: number; overtimeUnpaidH: number };
function RunAdjust({ emp, period, freq, value, preview, ts, tsRows, hoursSource, onTimesheet, onSave, onClose }: { emp: Emp; period: string; freq: Freq; value?: Adjust; preview: (a: Adjust) => Line; ts?: TimesheetSum; tsRows: TsRow[]; hoursSource: "contracted" | "timesheet"; onTimesheet: (rec: ClockRec, patch: Record<string, unknown>, msg: string) => void; onSave: (a: Adjust | null) => void; onClose: () => void }) {
  const [d, setD] = useState<Adjust>(() => ({ hours: value?.hours ?? null, taxCode: value?.taxCode ?? "", niCat: value?.niCat ?? "", additions: value?.additions ? value.additions.map((x) => ({ ...x })) : [], deductions: value?.deductions ? value.deductions.map((x) => ({ ...x })) : [], override: { paye: value?.override?.paye ?? null, eeNi: value?.override?.eeNi ?? null, eePen: value?.override?.eePen ?? null } }));
  const [showManual, setShowManual] = useState(!!(value?.override && (value.override.paye != null || value.override.eeNi != null || value.override.eePen != null)));
  const contracted = emp.basis === "hour" ? r2(emp.hpw * (emp.weeks || 52) / PPY[freq]) : 0;
  const sourceHours = hoursSource === "timesheet" ? (ts?.approvedH ?? 0) : contracted;
  const num = (s: string) => { const n = parseFloat(s); return Number.isNaN(n) ? 0 : n; };

  // the same calculation as the pay-run row (timesheets, leave, rolled-up) with this draft applied
  const pl = preview({ hours: d.hours, taxCode: d.taxCode || undefined, niCat: d.niCat || undefined, additions: d.additions, deductions: d.deductions, override: d.override });

  const setItems = (key: "additions" | "deductions", items: AdjItem[]) => setD({ ...d, [key]: items });
  const addItem = (key: "additions" | "deductions", label = "") => setItems(key, [...(d[key] || []), { id: crypto.randomUUID(), label, amount: 0 }]);
  const editItem = (key: "additions" | "deductions", id: string, patch: Partial<AdjItem>) => setItems(key, (d[key] || []).map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const delItem = (key: "additions" | "deductions", id: string) => setItems(key, (d[key] || []).filter((x) => x.id !== id));

  const save = () => {
    const additions = (d.additions || []).filter((x) => (x.label || "").trim() || x.amount);
    const deductions = (d.deductions || []).filter((x) => (x.label || "").trim() || x.amount);
    const ov = { paye: d.override?.paye ?? undefined, eeNi: d.override?.eeNi ?? undefined, eePen: d.override?.eePen ?? undefined };
    const clean: Adjust = { hours: d.hours != null ? d.hours : undefined, taxCode: (d.taxCode || "").trim() || undefined, niCat: d.niCat || undefined, additions, deductions, override: ov };
    const empty = clean.hours == null && !clean.taxCode && !clean.niCat && !additions.length && !deductions.length && ov.paye == null && ov.eeNi == null && ov.eePen == null;
    onSave(empty ? null : clean);
  };

  const lbl = "mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]";
  const itemRows = (key: "additions" | "deductions", title: string, presets: string[], tone: string) => (
    <div>
      <div className="mb-1 flex items-center gap-2"><span className={lbl + " mb-0"}>{title}</span><button type="button" onClick={() => addItem(key)} className="text-[11px] font-bold text-[#1d3a8f] hover:underline">+ Add</button></div>
      {(d[key] || []).map((x) => (
        <div key={x.id} className="mb-1.5 flex items-center gap-1.5">
          <Input value={x.label} placeholder="Label" onChange={(ev) => editItem(key, x.id, { label: ev.target.value })} className="flex-1" list={`preset-${key}`} />
          <span className="text-[var(--ink-3)]">£</span>
          <Input inputMode="decimal" value={x.amount ? String(x.amount) : ""} placeholder="0.00" onChange={(ev) => editItem(key, x.id, { amount: num(ev.target.value) })} className="w-24" />
          <button type="button" onClick={() => delItem(key, x.id)} className="px-1 text-[16px] text-[var(--ink-3)] hover:text-[#c0392b]">×</button>
        </div>
      ))}
      <datalist id={`preset-${key}`}>{presets.map((p) => <option key={p} value={p} />)}</datalist>
      <div className="flex flex-wrap gap-1">{presets.map((p) => <button key={p} type="button" onClick={() => addItem(key, p)} className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${tone}`}>+ {p}</button>)}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[6vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onClick={(ev) => ev.stopPropagation()}>
        <div className="mb-1 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{emp.name}</h3><span className="text-[12px] text-[var(--ink-3)]">· {period} pay run</span><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
        <div className="mb-3 text-[11px] text-[var(--ink-3)]">Adjustments apply to this pay period only — the employee&rsquo;s master record is unchanged.</div>
        <div className="grid gap-3">
          {emp.basis === "hour" ? (
            <label className="block"><span className={lbl}>Hours this period</span>
              <Input inputMode="decimal" value={d.hours != null ? String(d.hours) : ""} placeholder={`${sourceHours} (from ${hoursSource === "timesheet" ? "approved timesheets" : "contract"})`} onChange={(ev) => setD({ ...d, hours: ev.target.value.trim() === "" ? null : num(ev.target.value) })} className="w-full" />
              <span className="mt-1 block text-[10.5px] text-[var(--ink-3)]">Approved timesheets: <b>{ts ? `${ts.approvedH}h` : "—"}</b>{ts && ts.pendingH > 0 ? <> · awaiting approval <b>{ts.pendingH}h</b></> : null} · Contracted: <b>{contracted}h</b>. Leave blank to use the {hoursSource === "timesheet" ? "approved timesheet" : "contracted"} figure{hoursSource === "contracted" && pl.leave?.unpaidDays ? " (less unpaid leave)" : ""}.</span>
            </label>
          ) : <div className="rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-3)]">Salaried — {gbp0(emp.rate / PPY[freq])} base per {FREQ_LABEL[freq].toLowerCase()} period. Add a bonus or deduction below.</div>}
          {tsRows.length > 0 && (
            <div>
              <span className={lbl}>Timesheets this period</span>
              <div className="max-h-44 overflow-y-auto rounded-lg border border-[var(--line)]">
                {tsRows.map(({ rec, payH, workedH, overtimeUnpaidH }) => (
                  <div key={rec.day} className="flex flex-wrap items-center gap-1.5 border-t border-[var(--line-2,#eef2f8)] px-2.5 py-1.5 text-[11.5px] first:border-t-0">
                    <span className="w-[74px] font-bold text-[var(--ink)]">{new Date(`${rec.day}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span>
                    <span className="text-[var(--ink-3)]">{hhmm(rec.clockInAt)}–{rec.clockOutAt ? hhmm(rec.clockOutAt) : "…"}{rec.breakMs ? ` · break ${Math.round(rec.breakMs / 60000)}m` : ""} · worked {workedH}h</span>
                    <span className="font-bold tabular-nums text-[var(--ink)]">pay {payH}h</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      {!rec.clockOutAt ? <span className="rounded-full bg-[#fdf3e0] px-1.5 py-0.5 text-[9.5px] font-bold text-[#8a5a09]">not clocked out</span>
                        : rec.approved ? <span className="rounded-full bg-[#e6f4ea] px-1.5 py-0.5 text-[9.5px] font-bold text-[#0f7a43]">approved</span>
                        : <button type="button" onClick={() => onTimesheet(rec, { approved: true }, `${rec.day}: ${payH}h approved for payroll.`)} className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10.5px] font-bold text-[#1d3a8f] hover:border-[#1d3a8f]">Approve</button>}
                      {overtimeUnpaidH > 0 && <button type="button" title="Overtime above the rota is unpaid until you approve it — this pays the hours actually worked for this day" onClick={() => onTimesheet(rec, { payBasis: "actual", editNote: "Overtime approved from Payroll" }, `${rec.day}: +${overtimeUnpaidH}h overtime will be paid.`)} className="rounded-full border border-[#bfe3cd] px-2 py-0.5 text-[10.5px] font-bold text-[#0f7a43] hover:bg-[#eafaf0]">Pay +{overtimeUnpaidH}h overtime</button>}
                    </span>
                  </div>
                ))}
              </div>
              <span className="mt-1 block text-[10.5px] text-[var(--ink-3)]">Pay hours follow the Timesheets screen&rsquo;s pay policy (breaks, rounding, lateness, overtime). Only approved days are paid.</span>
            </div>
          )}
          {pl.leave && (
            <div className="rounded-lg bg-[#eef4fd] px-3 py-2 text-[11.5px] text-[#1d3a8f]">
              <b>Leave this period:</b> {leaveLabel(pl.leave)}.
              {pl.leave.unpaidDays > 0 && <> Unpaid: {pl.leave.unpaidDays}d{pl.unpaidLeaveM ? ` (−${gbp(pl.unpaidLeaveM)})` : hoursSource === "timesheet" || d.hours != null ? " (not clocked, so not paid)" : ""}.</>}
              {pl.leave.paidDays > 0 && <> Paid: {pl.leave.paidDays}d {pl.hoursFrom === "timesheet" ? "added at the normal rate" : "— already in their contracted pay"}.</>}
              {pl.leave.sickDays > 0 && (pl.sickPay === "ssp"
                ? <b className="block text-[#b45309]">🤒 Sickness: {pl.leave.sickDays}d{pl.sickLeaveM ? ` deducted (−${gbp(pl.sickLeaveM)})` : " not paid"} — your sick pay is set to SSP only. SSP to be added by your payroll provider.</b>
                : <> Sickness: {pl.leave.sickDays}d — full pay{pl.hoursFrom === "timesheet" ? " added at the normal rate" : " (already in their contracted pay)"}.</>)}
              {pl.leave.statutoryDays > 0 && <b className="block text-[#b45309]">⚠ Statutory-pay leave: SMP / statutory pay are not calculated here — add it as an addition, or adjust hours.</b>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className={lbl}>Tax code (this run)</span><Input value={d.taxCode} placeholder={emp.taxCode} onChange={(ev) => setD({ ...d, taxCode: ev.target.value })} className="w-full" /></label>
            <label className="block"><span className={lbl}>NI category</span><Select value={d.niCat || ""} onChange={(ev) => setD({ ...d, niCat: ev.target.value })} className="w-full"><option value="">{emp.niCat} (default)</option>{["A", "B", "C", "H", "M"].map((c) => <option key={c} value={c}>{c}</option>)}</Select></label>
          </div>
          {itemRows("additions", "Additions (taxable — added to gross)", ["Overtime", "Bonus", "Holiday pay", "Backpay"], "border-[#bfe3cd] text-[#0f7a43] hover:bg-[#eafaf0]")}
          {itemRows("deductions", "Deductions (after tax — off net)", ["Salary advance", "Salary sacrifice", "Other"], "border-[#f0cfcf] text-[#c0392b] hover:bg-[#fdeeee]")}
          <div>
            <button type="button" onClick={() => setShowManual((s) => !s)} className="text-[11.5px] font-bold text-[#1d3a8f] hover:underline">{showManual ? "▾" : "▸"} Manual PAYE / NI / pension override</button>
            {showManual && (
              <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-[var(--panel)] p-2.5">
                {([["paye", "PAYE", pl.payeM], ["eeNi", "Employee NI", pl.eeNiM], ["eePen", "Pension", pl.eePenM]] as const).map(([k, label, auto]) => (
                  <label key={k} className="block"><span className={lbl}>{label}</span><Input inputMode="decimal" value={d.override?.[k] != null ? String(d.override?.[k]) : ""} placeholder={`auto ${auto.toFixed(2)}`} onChange={(ev) => setD({ ...d, override: { ...d.override, [k]: ev.target.value.trim() === "" ? null : num(ev.target.value) } })} className="w-full" /></label>
                ))}
                <span className="col-span-3 text-[10.5px] text-[var(--ink-3)]">Blank = calculated automatically. A value forces that figure (net recalculates).</span>
              </div>
            )}
          </div>
          {/* live preview */}
          <div className="rounded-xl border border-[var(--line)] bg-[#f7f9fd] p-3 text-[12px]">
            <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">This pay run</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              <span className="text-[var(--ink-3)]">Gross</span><span className="text-right font-bold tabular-nums">{gbp(pl.grossM)}</span>
              <span className="text-[var(--ink-3)]">PAYE</span><span className="text-right tabular-nums text-[#c0392b]">−{gbp(pl.payeM)}</span>
              <span className="text-[var(--ink-3)]">Employee NI</span><span className="text-right tabular-nums text-[#c0392b]">−{gbp(pl.eeNiM)}</span>
              <span className="text-[var(--ink-3)]">Pension</span><span className="text-right tabular-nums text-[#c0392b]">−{gbp(pl.eePenM)}</span>
              {pl.dedM > 0 && <><span className="text-[var(--ink-3)]">Other deductions</span><span className="text-right tabular-nums text-[#c0392b]">−{gbp(pl.dedM)}</span></>}
              <span className="font-extrabold text-[var(--ink)]">Net pay</span><span className="text-right font-extrabold tabular-nums text-[#0f7a43]">{gbp(pl.netM)}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2"><button type="button" onClick={() => onSave(null)} className="text-[12px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">Reset to default</button><div className="ml-auto flex gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save adjustments</Button></div></div>
      </div>
    </div>
  );
}
