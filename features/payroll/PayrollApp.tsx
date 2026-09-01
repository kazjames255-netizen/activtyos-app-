"use client";

// Payroll — an extensive front-end payroll workspace for a UK children's-activity
// provider. Employees (pulled from onboarding pay + the staff roster), monthly
// pay runs with ESTIMATED PAYE / National Insurance / pension / net, branded
// payslips, and accounting integrations (QuickBooks / Xero / Sage). All figures
// are estimates for planning — real RTI/HMRC filing, exact tax codes and the live
// accounting sync are the backend/integration piece (Amir). Demo stores.
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import { CollapsibleStats, LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { useSettings } from "@/lib/settings";
import { DEMO_STAFF } from "@/features/learning/credentials";
import { loadProfiles as loadHolidayProfiles } from "@/features/holiday/data";

// ——— UK PAYE / NI / pension ESTIMATE helpers (2026/27; rest-of-UK bands) ———
const r2 = (n: number) => Math.round((n || 0) * 100) / 100;
const gbp = (n: number) => "£" + (n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const gbp0 = (n: number) => "£" + Math.round(n || 0).toLocaleString("en-GB");
const escH = (s: unknown = "") => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));

// annual PAYE from gross + tax code — parses the allowance, BR/D0/D1/NT and K
// codes, and the £100k personal-allowance taper. Rest-of-UK bands (S/C prefixes
// are stripped; a real Scottish/Welsh calc is backend). Estimate only.
function payeAnnual(gross: number, taxCodeRaw = "1257L"): number {
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
function eeNiAnnual(gross: number, cat = "A"): number {
  if (cat === "C") return 0; // over State Pension age
  const PT = 12570, UEL = 50270;
  return Math.min(Math.max(0, gross - PT), UEL - PT) * 0.08 + Math.max(0, gross - UEL) * 0.02;
}
function erNiAnnual(gross: number, cat = "A"): number {
  if (cat === "M" || cat === "H") return Math.max(0, gross - 50270) * 0.15; // under-21 / apprentice under-25: 0% to UST
  return Math.max(0, gross - 5000) * 0.15; // 2025/26+ : 15% above the £5,000 secondary threshold
}
const qePension = (annualGross: number) => Math.min(Math.max(annualGross - 6240, 0), 50270 - 6240); // qualifying earnings band

interface Emp { id: string; name: string; role: string; op: string; basis: "hour" | "year"; rate: number; hpw: number; weeks: number; taxCode: string; niCat: string; pension: boolean; paidFrom?: "contracted" | "rota" }
// A one-off addition (taxable — overtime/bonus/holiday pay) or after-tax deduction (advance/other) on a single pay run.
export interface AdjItem { id: string; label: string; amount: number }
// Per-employee, per-period overrides applied in the pay run — everything editable
// without touching the employee master record.
export interface Adjust { hours?: number | null; taxCode?: string; niCat?: string; additions?: AdjItem[]; deductions?: AdjItem[]; override?: { paye?: number | null; eeNi?: number | null; eePen?: number | null } }
export interface Line { id: string; name: string; role: string; op: string; basis: "hour" | "year"; rate: number; hpw: number; weeks: number; taxCode: string; niCat: string; freqLabel?: string; hoursM: number; basePayM: number; addM: number; dedM: number; additions: AdjItem[]; deductions: AdjItem[]; manual: { paye: boolean; eeNi: boolean; eePen: boolean }; grossM: number; payeM: number; eeNiM: number; erNiM: number; eePenM: number; erPenM: number; netM: number }
export interface PayRun { id: string; period: string; paidOn: string; lines: Line[]; status: "draft" | "approved"; hoursBasis?: "contracted" | "rota"; freq?: Freq }
export const PAYROLL_RUNS_KEY = "aos.payroll.runs.v1";

// Standalone payslip window — shared by the operator Payroll view and the staff
// My-payslips view. YTD is summed from every run the employee appears in.
export function openPayslip(l: Line, period: string, paidOn: string, provider: string, runs: PayRun[]) {
  if (typeof window === "undefined") return;
  const ytdL = runs.flatMap((r) => r.lines).filter((x) => x.id === l.id);
  const ytd = (k: keyof Line) => ytdL.reduce((a, x) => a + (typeof x[k] === "number" ? (x[k] as number) : 0), 0);
  const paid = new Date(paidOn); const mo = paid.getMonth();
  const taxMonth = ((mo - 3 + 12) % 12) + 1; const taxYearStart = mo >= 3 ? paid.getFullYear() : paid.getFullYear() - 1;
  const ty = `${taxYearStart}/${String((taxYearStart + 1) % 100).padStart(2, "0")}`;
  const freqLabel = l.freqLabel || "Monthly";
  const taxWeek = Math.min(53, Math.max(1, Math.floor((Date.UTC(paid.getFullYear(), paid.getMonth(), paid.getDate()) - Date.UTC(taxYearStart, 3, 6)) / (7 * 86400000)) + 1));
  const taxPeriod = freqLabel === "Weekly" ? `Week ${taxWeek} · ${ty}` : freqLabel === "Monthly" ? `Month ${taxMonth} · ${ty}` : `${freqLabel} · ${ty}`;
  const row = (k: string, v: string, strong = false) => `<tr><td>${escH(k)}</td><td style="text-align:right${strong ? ";font-weight:800" : ""}">${escH(v)}</td></tr>`;
  const basePay = l.basePayM ?? l.grossM;
  const baseRow = l.basis === "hour" ? row(`Basic pay · ${l.hoursM} hrs @ £${l.rate.toFixed(2)}`, gbp(basePay)) : row("Salary", gbp(basePay));
  const pays = baseRow + (l.additions || []).map((x) => row(x.label || "Addition", gbp(x.amount))).join("");
  const deds = row("PAYE tax (est.)", gbp(l.payeM)) + row("Employee NI (est.)", gbp(l.eeNiM)) + row("Pension — auto-enrolment", gbp(l.eePenM)) + (l.deductions || []).map((x) => row(x.label || "Deduction", gbp(x.amount))).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Payslip — ${escH(l.name)}</title><style>body{font-family:-apple-system,'Segoe UI',Arial,sans-serif;color:#1a1c2b;max-width:660px;margin:0 auto;padding:40px}h1{font-size:20px;margin:0}.tag{display:inline-block;background:#fdf3e0;color:#8a5a09;border-radius:99px;padding:2px 9px;font-size:10.5px;font-weight:800;margin-bottom:6px}.sub{color:#6b7086;font-size:12px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:2px 18px;font-size:12px;color:#4a4763;margin:14px 0;border-top:1px solid #e5e7f0;padding-top:12px}.meta b{color:#1a1c2b}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:16px 0}h3{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#3557b7;border-bottom:1px solid #e5e7f0;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-size:13px}td{padding:5px 0;border-top:1px solid #eef1f7}.net{background:#eef4fd;border-radius:10px;padding:14px;margin-top:14px;display:flex;justify-content:space-between;align-items:center}.net b{font-size:22px;color:#1d3a8f}.est{font-size:11px;color:#8a92a8;margin-top:14px}@media print{body{padding:0}}</style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start"><div><span class="tag">Estimated payslip · pay preview</span><h1>${escH(provider)}</h1><div class="sub">Payslip · ${escH(period)} · paid ${escH(paid.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))}</div></div><div style="text-align:right"><div style="font-weight:800">${escH(l.name)}</div><div class="sub">${escH(l.role)} · ${escH(l.op)}</div></div></div>
    <div class="meta"><div>Tax code · <b>${escH(l.taxCode)}</b></div><div>NI category · <b>${escH(l.niCat)}</b></div><div>Tax period · <b>${escH(taxPeriod)}</b></div><div>Frequency · <b>${escH(freqLabel)}</b></div></div>
    <div class="grid"><div><h3>Payments</h3><table>${pays}${(l.additions || []).length ? row("Gross pay", gbp(l.grossM), true) : ""}</table></div><div><h3>Deductions</h3><table>${deds}</table></div></div>
    <div class="net"><span>Net pay · BACS</span><b>${gbp(l.netM)}</b></div>
    <div class="grid"><div><h3>Year to date (${escH(ty)})</h3><table>${row("Gross", gbp(ytd("grossM")))}${row("PAYE", gbp(ytd("payeM")))}${row("Employee NI", gbp(ytd("eeNiM")))}${row("Pension", gbp(ytd("eePenM")))}${row("Net", gbp(ytd("netM")), true)}</table></div><div><h3>Employer costs</h3><table>${row("Employer NI (est.)", gbp(l.erNiM))}${row("Employer pension", gbp(l.erPenM))}${row("Total cost to employer", gbp(l.grossM + l.erNiM + l.erPenM), true)}</table></div></div>
    <div class="est">⚠ This is an ESTIMATE for planning, not a statutory itemised pay statement. PAYE, NI and pension are computed on simplified UK 2026/27 rest-of-UK bands using tax code ${escH(l.taxCode)}; pension is 5%/3% of qualifying earnings. Your real payslip is produced by the payroll provider from the RTI/HMRC submission (student loans, statutory pay, Scottish/Welsh bands etc. not modelled here).</div>
    <script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></body></html>`;
  const w = window.open(); if (w) { w.document.write(html); w.document.close(); }
}
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

function seedEmployees(): Emp[] {
  // best-effort: read pay/hours captured in the onboarding record
  let onb: { staff: string; values: Record<string, { v?: string }> }[] = [];
  try { onb = JSON.parse(localStorage.getItem("aos.team.onboardrecords.v1") || "[]"); } catch { /* ignore */ }
  return DEMO_STAFF.map((s) => {
    const d = DEMO_PAY[s.name] ?? { basis: "hour", rate: 12.5, hpw: 20, pension: true };
    const rec = onb.find((r) => r.staff === s.name);
    let basis = d.basis as "hour" | "year", rate = d.rate as number, hpw = d.hpw as number;
    try { const p = JSON.parse(rec?.values?.payRate?.v || "null"); if (p?.amount) { basis = p.basis === "year" ? "year" : "hour"; rate = parseFloat(String(p.amount).replace(/[£,]/g, "")) || rate; hpw = parseFloat(p.hpw) || hpw; } } catch { /* ignore */ }
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "emp_" + s.name.replace(/\s/g, "");
    return { id, name: s.name, role: s.role, op: s.op, basis, rate, hpw, weeks: basis === "hour" ? 45 : 52, taxCode: "1257L", niCat: "A", pension: d.pension ?? true };
  });
}

const grossMonthly = (e: Emp) => e.basis === "year" ? e.rate / 12 : e.rate * e.hpw * (e.weeks || 52) / 12;
const sumItems = (a?: AdjItem[]) => r2((a || []).reduce((n, x) => n + (Number(x.amount) || 0), 0));
// Pay frequency: how often a run pays, and how many fall in a tax year (the
// divisor that turns an annual PAYE/NI/pension figure into one period's amount).
export type Freq = "weekly" | "fortnightly" | "fourweekly" | "monthly";
const PPY: Record<Freq, number> = { weekly: 52, fortnightly: 26, fourweekly: 13, monthly: 12 };
const FREQ_LABEL: Record<Freq, string> = { weekly: "Weekly", fortnightly: "Fortnightly", fourweekly: "4-weekly", monthly: "Monthly" };
// computeLine estimates ONE PERIOD for one employee at pay frequency `freq`.
// Adjustments: `hours` pays an hourly person by actual hours (from the Schedule
// or a manual entry) instead of contracted; taxCode/niCat override the master;
// additions are taxable (added to gross), deductions come off net after tax;
// override.{paye,eeNi,eePen} force a statutory figure.
function computeLine(e: Emp, a: { hours?: number | null; rate?: number | null; taxCode?: string; niCat?: string; additions?: AdjItem[]; deductions?: AdjItem[]; override?: { paye?: number | null; eeNi?: number | null; eePen?: number | null }; rolledUp?: boolean } = {}, freq: Freq = "monthly"): Line {
  const ppy = PPY[freq];
  const taxCode = a.taxCode || e.taxCode, niCat = a.niCat || e.niCat;
  const rate = a.rate != null ? a.rate : e.rate; // e.g. the Schedule's own rate in rota mode
  const contractedHours = e.basis === "hour" ? (e.hpw * (e.weeks || 52)) / ppy : 0; // avg contracted hours in one period
  const useH = a.hours != null && e.basis === "hour";
  const periodHours = e.basis === "hour" ? (useH ? (a.hours as number) : contractedHours) : 0;
  const basePayM = r2(e.basis === "hour" ? rate * periodHours : e.rate / ppy);
  // rolled-up holiday pay: a separate, itemised 12.07% line on the pay for hours worked
  const holidayAdd: AdjItem[] = a.rolledUp ? [{ id: "__holpay", label: "Holiday pay (12.07% rolled-up)", amount: r2(basePayM * 0.1207) }] : [];
  const additions = [...holidayAdd, ...(a.additions || [])];
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
  return { id: e.id, name: e.name, role: e.role, op: e.op, basis: e.basis, rate, hpw: e.hpw, weeks: e.weeks || 52, taxCode, niCat, freqLabel: FREQ_LABEL[freq], hoursM, basePayM, addM, dedM, additions, deductions: a.deductions || [], manual: { paye: ov.paye != null, eeNi: ov.eeNi != null, eePen: ov.eePen != null }, grossM, payeM, eeNiM, erNiM, eePenM, erPenM, netM: r2(grossM - payeM - eeNiM - eePenM - dedM) };
}

// ── Link to the Schedule / rota ─────────────────────────────────────────────
// Sums a staff member's ACTUAL rostered hours for a month from the Schedule's
// demo store (aos.rota.v5): prefers real check-in/out (in/out) over planned
// start/end and subtracts an unpaid break. Matched to payroll employees by name
// — the demo stand-in for a shared staff id (server-side link is Amir's; see
// docs/payroll-integrations-handoff.md).
const ROTA_KEY = "aos.rota.v5";
const rhm = (t: string) => { const [h, m] = (t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const shiftHours = (s: { start: string; end: string; in?: string; out?: string; brk?: { from: string; to: string } }) => {
  const gross = Math.max(0, rhm(s.out || s.end) - rhm(s.in || s.start));
  const brk = s.brk ? Math.max(0, rhm(s.brk.to) - rhm(s.brk.from)) : 0;
  return Math.max(0, gross - brk) / 60;
};
// rostered hours per staff member for shifts whose date falls in [startISO, endISO]
function rotaHoursForRange(startISO: string, endISO: string): { byName: Record<string, number>; rateByName: Record<string, number>; hasData: boolean } {
  const byName: Record<string, number> = {}; const rateByName: Record<string, number> = {};
  if (typeof window === "undefined") return { byName, rateByName, hasData: false };
  let store: { staff?: { id: string; name: string; rate?: number }[]; shifts?: { staffId: string | null; date: string; start: string; end: string; in?: string; out?: string; brk?: { from: string; to: string } }[] } | null = null;
  try { store = JSON.parse(localStorage.getItem(ROTA_KEY) || "null"); } catch { /* ignore */ }
  if (!store || !Array.isArray(store.shifts) || !Array.isArray(store.staff)) return { byName, rateByName, hasData: false };
  const idToName: Record<string, string> = {};
  store.staff.forEach((s) => { const nm = (s.name || "").trim().toLowerCase(); idToName[s.id] = s.name; if (nm && s.rate) rateByName[nm] = s.rate; });
  for (const sh of store.shifts) {
    if (!sh.staffId || !sh.date || sh.date < startISO || sh.date > endISO) continue;
    const nm = (idToName[sh.staffId] || "").trim().toLowerCase();
    if (nm) byName[nm] = (byName[nm] || 0) + shiftHours(sh);
  }
  return { byName, rateByName, hasData: store.shifts.length > 0 };
}

// The pay period for an anchor date at a given frequency: monthly = calendar
// month; weekly/fortnightly/4-weekly = a window ending on the anchor's Sunday.
const isoD = (d: Date) => d.toISOString().slice(0, 10);
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
  const [tab, setTab] = useState<"overview" | "employees" | "run" | "payslips" | "integrations">("overview");
  const [emps, setEmps] = useState<Emp[]>(seedEmployees);
  const [runs, setRuns] = useState<PayRun[]>([]);
  const [conn, setConn] = useState<Record<string, boolean>>({});
  const [edit, setEdit] = useState<Emp | null>(null);
  const [adjEmp, setAdjEmp] = useState<Emp | null>(null); // employee whose pay-run adjustments are being edited
  const [toast, setToast] = useState<string | null>(null);
  const [freq, setFreq] = useState<Freq>("monthly");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [adjust, setAdjust] = useState<Record<string, Record<string, Adjust>>>({}); // period -> empId -> Adjust
  useEffect(() => {
    try { const e = JSON.parse(localStorage.getItem(EKEY) || "null"); if (Array.isArray(e) && e.length) setEmps(e); } catch { /* ignore */ }
    try { const r = JSON.parse(localStorage.getItem(RKEY) || "null"); if (Array.isArray(r)) setRuns(r); } catch { /* ignore */ }
    try { const i = JSON.parse(localStorage.getItem(IKEY) || "null"); if (i) setConn(i); } catch { /* ignore */ }
    try { const a = JSON.parse(localStorage.getItem(ADJKEY) || "null"); if (a && typeof a === "object") setAdjust(a); } catch { /* ignore */ }
  }, []);
  const saveEmps = (e: Emp[]) => { setEmps(e); try { localStorage.setItem(EKEY, JSON.stringify(e)); } catch { /* ignore */ } };
  const saveRuns = (r: PayRun[]) => { setRuns(r); try { localStorage.setItem(RKEY, JSON.stringify(r)); } catch { /* ignore */ } };
  const saveConn = (c: Record<string, boolean>) => { setConn(c); try { localStorage.setItem(IKEY, JSON.stringify(c)); } catch { /* ignore */ } };
  const saveAdjust = (a: Record<string, Record<string, Adjust>>) => { setAdjust(a); try { localStorage.setItem(ADJKEY, JSON.stringify(a)); } catch { /* ignore */ } };
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2800); };

  // the pay period (window + label) for the chosen frequency & anchor date
  const win = useMemo(() => periodWindow(anchor, freq), [anchor, freq]);
  const period = win.label;
  // rostered hours for this period's window, read from the Schedule
  const rota = useMemo(() => rotaHoursForRange(win.start, win.end), [win.start, win.end, tab]);
  const rotaHoursFor = (e: Emp) => rota.byName[e.name.trim().toLowerCase()];
  const rotaRateFor = (e: Emp) => rota.rateByName[e.name.trim().toLowerCase()]; // rate the Schedule uses for this person
  const scheduleWageFor = (e: Emp) => { const h = rotaHoursFor(e); const r = rotaRateFor(e) ?? e.rate; return h != null ? h * r : undefined; };
  // staff whose holiday is INCLUDED IN PAY (rolled-up 12.07%), from the Holiday
  // planner (loadProfiles falls back to the seed, so it works before that page is opened)
  const rolledUpNames = useMemo(() => { try { return new Set(loadHolidayProfiles().filter((p) => p.holidayPay === "rolled-up").map((p) => p.name.trim().toLowerCase())); } catch { return new Set<string>(); } }, [tab]);
  const isRolledUp = (e: Emp) => rolledUpNames.has(e.name.trim().toLowerCase());
  // each employee is paid from contracted hours OR the rota (their own setting);
  // salaried staff are always contracted (a salary isn't hours-driven)
  const empSource = (e: Emp): "contracted" | "rota" => (e.basis === "year" ? "contracted" : (e.paidFrom || "contracted"));
  const setSource = (id: string, src: "contracted" | "rota") => saveEmps(emps.map((x) => (x.id === id ? { ...x, paidFrom: src } : x)));
  const bulkSource = (src: "contracted" | "rota") => saveEmps(emps.map((x) => (x.basis === "hour" ? { ...x, paidFrom: src } : x)));
  const periodAdj = adjust[period] || {};
  const adjOf = (id: string): Adjust | undefined => periodAdj[id];
  // base hours for an hourly employee this period: a manual per-run override
  // wins, else rostered hours if paid from the rota, else contracted (undefined)
  const baseHours = (e: Emp): number | null | undefined => {
    const a = adjOf(e.id);
    if (a?.hours != null) return a.hours;
    return empSource(e) === "rota" ? (rotaHoursFor(e) ?? 0) : undefined;
  };
  // when paid from the rota, also pay at the Schedule's own rate so the run mirrors the Schedule's wage
  const lineFor = (e: Emp): Line => { const a = adjOf(e.id); const rate = empSource(e) === "rota" && a?.hours == null ? rotaRateFor(e) : undefined; return computeLine(e, { hours: baseHours(e), rate, taxCode: a?.taxCode, niCat: a?.niCat, additions: a?.additions, deductions: a?.deductions, override: a?.override, rolledUp: isRolledUp(e) }, freq); };
  const lines = emps.map(lineFor);
  const isAdjusted = (e: Emp) => { const a = adjOf(e.id); return !!a && (a.hours != null || !!a.taxCode || !!a.niCat || !!(a.additions?.length) || !!(a.deductions?.length) || a.override?.paye != null || a.override?.eeNi != null || a.override?.eePen != null); };
  const rotaEmps = emps.filter((e) => empSource(e) === "rota");
  const zeroHourNames = rotaEmps.filter((e) => e.basis === "hour" && !((baseHours(e) ?? 0) > 0)).map((e) => e.name);
  const setEmpAdjust = (id: string, a: Adjust | null) => { const next = { ...adjust, [period]: { ...periodAdj } }; if (a) next[period][id] = a; else delete next[period][id]; if (Object.keys(next[period]).length === 0) delete next[period]; saveAdjust(next); };
  const totalGross = lines.reduce((a, l) => a + l.grossM, 0);
  const totalNet = lines.reduce((a, l) => a + l.netM, 0);
  const totalErCost = lines.reduce((a, l) => a + l.grossM + l.erNiM + l.erPenM, 0);
  const totalPaye = lines.reduce((a, l) => a + l.payeM, 0);
  const nextPay = new Date(`${win.paidOn}T00:00:00`);

  const runPayroll = () => {
    if (zeroHourNames.length && !window.confirm(`${zeroHourNames.length} rota-paid staff have no rostered hours for ${period} (${zeroHourNames.join(", ")}). They'll be paid £0. Approve anyway?`)) return;
    if (runs.some((r) => r.period === period) && !window.confirm(`A payroll run for ${period} already exists. Approve another? Both are kept (a payroll record is never overwritten).`)) return;
    const run: PayRun = { id: "pr_" + Date.now().toString(36), period, paidOn: win.paidOn, lines, status: "approved", hoursBasis: rotaEmps.length ? "rota" : "contracted", freq };
    saveRuns([run, ...runs]); // never delete a prior run — versioned history
    flash(`✅ ${period} — ${lines.length} payslips generated (${gbp0(totalNet)} net · ${FREQ_LABEL[freq]}).`);
    setTab("payslips");
  };

  const showPayslip = (l: Line, period: string, paidOn: string) => openPayslip(l, period, paidOn, provider, runs);

  const exportCsv = () => {
    // guard against CSV/formula injection: quote, and neutralise leading =,+,-,@
    const cell = (x: string | number) => { let s = typeof x === "number" ? x.toFixed(2) : String(x ?? ""); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [["Employee", "Role", "Location", "Frequency", "Period", "Hours", "Hours basis", "Base pay", "Additions", "Deductions", "Tax code", "NI cat", "Gross", "PAYE", "EE NI", "Pension", "Net", "ER NI", "ER Pension"], ...lines.map((l, i) => [l.name, l.role, l.op, FREQ_LABEL[freq], period, l.basis === "year" ? "" : l.hoursM, l.basis === "year" ? "salary" : empSource(emps[i]), l.basePayM, l.addM, l.dedM, l.taxCode, l.niCat, l.grossM, l.payeM, l.eeNiM, l.eePenM, l.netM, l.erNiM, l.erPenM])];
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

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="Payroll" icon="💷" lede="Weekly or monthly pay runs — hours from contracts or the Schedule, estimated PAYE, NI and pension, fully editable, branded payslips, and one-tap export to your accounting software." />

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
          {runs.length > 0 && <div className="mt-3 border-t border-[var(--line)] pt-3"><div className="mb-1.5 text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Recent runs</div>{runs.slice(0, 3).map((r) => <div key={r.id} className="flex items-center gap-2 py-1 text-[12.5px]"><span className="font-bold text-[var(--ink)]">{r.period}</span><span className="text-[var(--ink-3)]">{r.lines.length} payslips · {gbp0(r.lines.reduce((a, l) => a + l.netM, 0))} net</span><span className="ml-auto rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[10px] font-bold text-[#0f7a43]">{r.status}</span></div>)}</div>}
        </Card>
      </>)}

      {tab === "employees" && (
        <Card className="p-4">
          <div className="mb-2 text-[12px] text-[var(--ink-3)]">Pay rate &amp; hours pull from each person&rsquo;s onboarding record — edit here to override. Tax code &amp; NI category as advised by HMRC.</div>
          <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full text-[13px]"><thead><tr className="bg-[var(--panel)] text-left text-[10px] uppercase tracking-wide text-[var(--ink-3)]"><th className="px-3 py-2.5 font-extrabold">Employee</th><th className="px-3 py-2.5 font-extrabold">Basis</th><th className="px-3 py-2.5 font-extrabold">Rate</th><th className="px-3 py-2.5 font-extrabold">Hrs/wk</th><th className="px-3 py-2.5 font-extrabold">Gross/mo</th><th className="px-3 py-2.5 font-extrabold">Tax code</th><th className="px-3 py-2.5 font-extrabold">Pension</th><th className="px-3 py-2.5"></th></tr></thead>
              <tbody>{emps.map((e) => (
                <tr key={e.id} className="border-t border-[var(--line-2,#eef2f8)]"><td className="px-3 py-2.5 font-bold text-[var(--ink)]">{e.name}<span className="ml-1 text-[10.5px] font-normal text-[var(--ink-3)]">{e.role}</span></td><td className="px-3 py-2.5 text-[var(--ink-2)]">{e.basis === "year" ? "Salary" : "Hourly"}</td><td className="px-3 py-2.5 tabular-nums text-[var(--ink-2)]">{e.basis === "year" ? gbp0(e.rate) + "/yr" : "£" + e.rate.toFixed(2) + "/hr"}</td><td className="px-3 py-2.5 tabular-nums text-[var(--ink-2)]">{e.basis === "year" ? "—" : e.hpw}</td><td className="px-3 py-2.5 font-bold tabular-nums text-[var(--ink)]">{gbp0(grossMonthly(e))}</td><td className="px-3 py-2.5 tabular-nums text-[var(--ink-2)]">{e.taxCode}</td><td className="px-3 py-2.5">{e.pension ? <span className="rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[10px] font-bold text-[#0f7a43]">Enrolled</span> : <span className="rounded-full bg-[#eef1f6] px-2 py-0.5 text-[10px] font-bold text-[#64748b]">Opted out</span>}</td><td className="px-3 py-2.5 text-right"><button type="button" onClick={() => setEdit(e)} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">Edit</button></td></tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "run" && (
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2"><div><div className="text-[14px] font-extrabold text-[var(--ink)]">Pay run</div><div className="text-[12px] text-[var(--ink-3)]">Review, then approve to generate payslips. Figures are estimates.</div></div><div className="ml-auto flex gap-2"><Button onClick={exportCsv}>⬇ Export CSV</Button><Button variant="primary" onClick={runPayroll}>✓ Approve &amp; generate payslips</Button></div></div>

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

          {/* Per-employee hours source — mix contracted (e.g. admin) and rostered (from Schedule) */}
          <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Hourly staff paid from</span>
              <span className="text-[11.5px] text-[var(--ink-3)]">Set per person on each row — mix and match. Set all hourly:</span>
              <button type="button" onClick={() => bulkSource("contracted")} className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">Contracted</button>
              <button type="button" onClick={() => bulkSource("rota")} className="rounded-full border border-[var(--line)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">Rostered (Schedule)</button>
            </div>
            {rotaEmps.length > 0 && !rota.hasData && <div className="mt-2 rounded-lg bg-[#fdf3e0] px-3 py-2 text-[11.5px] font-semibold text-[#8a5a09]">Some staff are set to Rostered, but no shifts are in the Schedule for {period} — build the rota, or set them to Contracted.</div>}
            {rotaEmps.length > 0 && rota.hasData && (() => { const totH = rotaEmps.reduce((n, e) => n + (rotaHoursFor(e) ?? 0), 0); const totW = rotaEmps.reduce((n, e) => n + (scheduleWageFor(e) ?? 0), 0); return <div className="mt-2 rounded-lg bg-[#eef4fd] px-3 py-2 text-[11.5px] font-semibold text-[#1d3a8f]">↩ Pulled from your Schedule for {period}: <b>{r2(totH)}h</b> rostered across {rotaEmps.length} staff → <b>{gbp0(totW)}</b> at Schedule rates (the pay basis before tax, NI &amp; pension).</div>; })()}
            {rotaEmps.length > 0 && rota.hasData && zeroHourNames.length > 0 && <div className="mt-2 rounded-lg bg-[#fdf3e0] px-3 py-2 text-[11.5px] font-semibold text-[#8a5a09]">⚠ No rostered hours for: {zeroHourNames.join(", ")} — they&rsquo;ll show £0. Add their shifts, set them to Contracted, or approve as-is.</div>}
          </div>

          <div className="mb-2 text-[11.5px] text-[var(--ink-3)]">Everything is editable per person, per period — click <b>Edit</b> on a row to change hours, tax code, NI category, add overtime/bonus or deductions, or override PAYE/NI/pension. Net always recalculates. Nothing here changes the employee&rsquo;s master record.</div>
          <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full text-[12.5px]"><thead><tr className="bg-[var(--panel)] text-left text-[10px] uppercase tracking-wide text-[var(--ink-3)]"><th className="px-3 py-2.5 font-extrabold">Employee</th><th className="px-3 py-2.5 text-right font-extrabold">Hours</th><th className="px-3 py-2.5 text-right font-extrabold">Gross</th><th className="px-3 py-2.5 text-right font-extrabold">PAYE</th><th className="px-3 py-2.5 text-right font-extrabold">NI</th><th className="px-3 py-2.5 text-right font-extrabold">Pension</th><th className="px-3 py-2.5 text-right font-extrabold">Net</th><th className="px-3 py-2.5 text-right font-extrabold">Er cost</th><th className="px-3 py-2.5 text-right font-extrabold"></th></tr></thead>
              <tbody>{lines.map((l, i) => { const e = emps[i]; const man = (on: boolean) => on ? <sup className="ml-0.5 text-[8px] font-black text-[#b45309]" title="Manual override">M</sup> : null; return (
                <tr key={l.id} className="border-t border-[var(--line-2,#eef2f8)]">
                  <td className="px-3 py-2 font-bold text-[var(--ink)]">{l.name}{isAdjusted(e) && <span className="ml-1.5 rounded-full bg-[#fdf3e0] px-1.5 py-0.5 text-[9.5px] font-bold text-[#8a5a09] align-middle">adjusted</span>}{(l.addM > 0 || l.dedM > 0) && <div className="mt-0.5 text-[10px] font-semibold text-[var(--ink-3)]">{l.addM > 0 && <span className="text-[#0f7a43]">+{gbp(l.addM)} additions</span>}{l.addM > 0 && l.dedM > 0 && " · "}{l.dedM > 0 && <span className="text-[#c0392b]">−{gbp(l.dedM)} deductions</span>}</div>}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--ink-2)]">{l.basis === "year" ? <span className="text-[var(--ink-3)]">Salary</span> : <div className="flex items-center justify-end gap-1.5">{adjOf(e.id)?.hours != null && <span className="rounded bg-[#fdf3e0] px-1 py-0.5 text-[9.5px] font-bold text-[#8a5a09]" title="Manual hours">manual</span>}<span>{l.hoursM}h</span><button type="button" onClick={() => setSource(e.id, empSource(e) === "rota" ? "contracted" : "rota")} title="Click to switch this person between contracted and rostered hours" className={`rounded px-1 py-0.5 text-[9.5px] font-bold ${empSource(e) === "rota" ? "bg-[#e7edfb] text-[#1d3a8f]" : "bg-[#eef1f6] text-[#64748b]"}`}>{empSource(e) === "rota" ? "rota ⇄" : "contract ⇄"}</button></div>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{gbp(l.grossM)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#c0392b]">{gbp(l.payeM)}{man(l.manual.paye)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#c0392b]">{gbp(l.eeNiM)}{man(l.manual.eeNi)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#c0392b]">{gbp(l.eePenM)}{man(l.manual.eePen)}</td>
                  <td className="px-3 py-2 text-right font-extrabold tabular-nums text-[#0f7a43]">{gbp(l.netM)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--ink-3)]">{gbp(l.grossM + l.erNiM + l.erPenM)}</td>
                  <td className="px-3 py-2 text-right"><button type="button" onClick={() => setAdjEmp(e)} className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[#1d3a8f] hover:border-[#1d3a8f]">✏️ Edit</button></td>
                </tr>
              ); })}
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
                <div className="mb-1.5 flex items-center gap-2"><span className="text-[13.5px] font-extrabold text-[var(--ink)]">{r.period}</span><span className="text-[11.5px] text-[var(--ink-3)]">paid {new Date(r.paidOn).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {gbp0(r.lines.reduce((a, l) => a + l.netM, 0))} net</span></div>
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

      {edit && <EmpEditor emp={edit} onSave={(e) => { saveEmps(emps.map((x) => (x.id === e.id ? e : x))); setEdit(null); }} onClose={() => setEdit(null)} />}
      {adjEmp && <RunAdjust emp={adjEmp} period={period} freq={freq} value={adjOf(adjEmp.id)} rotaHours={rotaHoursFor(adjEmp)} rotaRate={rotaRateFor(adjEmp)} hoursSource={empSource(adjEmp)} onSave={(a) => { setEmpAdjust(adjEmp.id, a); setAdjEmp(null); }} onClose={() => setAdjEmp(null)} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[150] max-w-[92vw] -translate-x-1/2 rounded-2xl bg-[#111634] px-4 py-2.5 text-center text-[12.5px] font-bold text-white shadow-xl">{toast}</div>}
      <p className="mt-4 text-[11px] text-[var(--ink-3)]">⚠ PAYE, National Insurance and pension are <b>estimates for planning</b> (UK 2026/27, rest-of-UK bands; employer NI 15% over £5,000; pension on qualifying earnings). Tax code &amp; NI category are applied; <b>not</b> modelled: Scottish/Welsh bands, student loans, statutory pay (SSP/SMP), Employment Allowance and RTI. The real payroll — exact calc, RTI/HMRC filing and statutory payslips — is your payroll provider / the accounting integration.</p>
    </div>
  );
}

function EmpEditor({ emp, onSave, onClose }: { emp: Emp; onSave: (e: Emp) => void; onClose: () => void }) {
  const [e, setE] = useState<Emp>(emp);
  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[8vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(ev) => ev.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{e.name}</h3><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
        <div className="grid gap-2.5">
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Pay basis</span><Select value={e.basis} onChange={(ev) => setE({ ...e, basis: ev.target.value as "hour" | "year" })} className="w-full"><option value="hour">Hourly</option><option value="year">Annual salary</option></Select></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{e.basis === "year" ? "Salary (£/yr)" : "Rate (£/hr)"}</span><Input inputMode="decimal" value={String(e.rate)} onChange={(ev) => setE({ ...e, rate: parseFloat(ev.target.value) || 0 })} className="w-full" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Hours / week</span><Input inputMode="decimal" value={String(e.hpw)} onChange={(ev) => setE({ ...e, hpw: parseFloat(ev.target.value) || 0 })} disabled={e.basis === "year"} className="w-full" /></label>
          </div>
          {e.basis === "hour" && <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Weeks / year <span className="normal-case text-[var(--ink-3)]">(52 = all year · 38–45 = term-time / seasonal)</span></span><Input inputMode="decimal" value={String(e.weeks)} onChange={(ev) => setE({ ...e, weeks: parseFloat(ev.target.value) || 52 })} className="w-full" /></label>}
          {e.basis === "hour" && <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Paid from <span className="normal-case text-[var(--ink-3)]">(admin/office staff → Contracted; coaches on the rota → Rostered)</span></span><Select value={e.paidFrom || "contracted"} onChange={(ev) => setE({ ...e, paidFrom: ev.target.value as "contracted" | "rota" })} className="w-full"><option value="contracted">Contracted hours</option><option value="rota">Rostered hours (from Schedule)</option></Select></label>}
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Tax code</span><Input value={e.taxCode} onChange={(ev) => setE({ ...e, taxCode: ev.target.value })} className="w-full" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">NI category</span><Select value={e.niCat} onChange={(ev) => setE({ ...e, niCat: ev.target.value })} className="w-full">{["A", "B", "C", "H", "M"].map((c) => <option key={c} value={c}>{c}</option>)}</Select></label>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--panel)] px-3 py-2"><input type="checkbox" checked={e.pension} onChange={(ev) => setE({ ...e, pension: ev.target.checked })} className="h-4 w-4 accent-[#1d3a8f]" /><span className="text-[12.5px] font-bold text-[var(--ink)]">Enrolled in workplace pension (5% / 3%)</span></label>
          <div className="rounded-lg bg-[#eef4fd] px-3 py-2 text-[12px] font-semibold text-[#1d3a8f]">Estimated gross: {gbp0(grossMonthly(e))}/month</div>
        </div>
        <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => onSave(e)}>Save</Button></div>
      </div>
    </div>
  );
}

// Per-run adjustments for one employee: hours / tax code / NI / additions /
// deductions / manual PAYE-NI-pension overrides. Everything editable; net always
// recalculates. Saves to the period's adjustment store, not the master record.
function RunAdjust({ emp, period, freq, value, rotaHours, rotaRate, hoursSource, onSave, onClose }: { emp: Emp; period: string; freq: Freq; value?: Adjust; rotaHours?: number; rotaRate?: number; hoursSource: "contracted" | "rota"; onSave: (a: Adjust | null) => void; onClose: () => void }) {
  const [d, setD] = useState<Adjust>(() => ({ hours: value?.hours ?? null, taxCode: value?.taxCode ?? "", niCat: value?.niCat ?? "", additions: value?.additions ? value.additions.map((x) => ({ ...x })) : [], deductions: value?.deductions ? value.deductions.map((x) => ({ ...x })) : [], override: { paye: value?.override?.paye ?? null, eeNi: value?.override?.eeNi ?? null, eePen: value?.override?.eePen ?? null } }));
  const [showManual, setShowManual] = useState(!!(value?.override && (value.override.paye != null || value.override.eeNi != null || value.override.eePen != null)));
  const contracted = emp.basis === "hour" ? r2(emp.hpw * (emp.weeks || 52) / PPY[freq]) : 0;
  const sourceHours = hoursSource === "rota" ? (rotaHours ?? 0) : contracted;
  const num = (s: string) => { const n = parseFloat(s); return Number.isNaN(n) ? 0 : n; };

  const eff = { hours: d.hours != null ? d.hours : (hoursSource === "rota" ? (rotaHours ?? 0) : undefined), rate: hoursSource === "rota" && d.hours == null ? rotaRate : undefined, taxCode: d.taxCode || undefined, niCat: d.niCat || undefined, additions: d.additions, deductions: d.deductions, override: d.override };
  const pl = computeLine(emp, eff, freq);

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
        <div className="mb-3 text-[11px] text-[var(--ink-3)]">Adjustments apply to this month only — the employee&rsquo;s master record is unchanged.</div>
        <div className="grid gap-3">
          {emp.basis === "hour" ? (
            <label className="block"><span className={lbl}>Hours this month</span>
              <Input inputMode="decimal" value={d.hours != null ? String(d.hours) : ""} placeholder={`${sourceHours} (from ${hoursSource === "rota" ? "Schedule" : "contract"})`} onChange={(ev) => setD({ ...d, hours: ev.target.value.trim() === "" ? null : num(ev.target.value) })} className="w-full" />
              <span className="mt-1 block text-[10.5px] text-[var(--ink-3)]">Schedule: <b>{rotaHours != null ? `${r2(rotaHours)}h` : "no shifts"}</b> · Contracted: <b>{contracted}h</b>{hoursSource === "rota" && rotaRate ? ` · Schedule rate £${rotaRate.toFixed(2)}/hr` : ""}. Leave blank to use the {hoursSource === "rota" ? "rostered" : "contracted"} figure.</span>
            </label>
          ) : <div className="rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-3)]">Salaried — {gbp0(emp.rate / PPY[freq])} base per {FREQ_LABEL[freq].toLowerCase()} period. Add a bonus or deduction below.</div>}
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
