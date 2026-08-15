"use client";

// Payroll — an extensive front-end payroll workspace for a UK children's-activity
// provider. Employees (pulled from onboarding pay + the staff roster), monthly
// pay runs with ESTIMATED PAYE / National Insurance / pension / net, branded
// payslips, and accounting integrations (QuickBooks / Xero / Sage). All figures
// are estimates for planning — real RTI/HMRC filing, exact tax codes and the live
// accounting sync are the backend/integration piece (Amir). Demo stores.
import { useEffect, useState } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { useSettings } from "@/lib/settings";
import { DEMO_STAFF } from "@/features/learning/credentials";

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

interface Emp { id: string; name: string; role: string; op: string; basis: "hour" | "year"; rate: number; hpw: number; weeks: number; taxCode: string; niCat: string; pension: boolean }
export interface Line { id: string; name: string; role: string; op: string; basis: "hour" | "year"; rate: number; hpw: number; weeks: number; taxCode: string; niCat: string; hoursM: number; grossM: number; payeM: number; eeNiM: number; erNiM: number; eePenM: number; erPenM: number; netM: number }
export interface PayRun { id: string; period: string; paidOn: string; lines: Line[]; status: "draft" | "approved" }
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
  const row = (k: string, v: string, strong = false) => `<tr><td>${escH(k)}</td><td style="text-align:right${strong ? ";font-weight:800" : ""}">${escH(v)}</td></tr>`;
  const pays = l.basis === "hour" ? row(`Basic pay · ${l.hoursM} hrs @ £${l.rate.toFixed(2)}`, gbp(l.grossM)) : row("Salary", gbp(l.grossM));
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Payslip — ${escH(l.name)}</title><style>body{font-family:-apple-system,'Segoe UI',Arial,sans-serif;color:#1a1c2b;max-width:660px;margin:0 auto;padding:40px}h1{font-size:20px;margin:0}.tag{display:inline-block;background:#fdf3e0;color:#8a5a09;border-radius:99px;padding:2px 9px;font-size:10.5px;font-weight:800;margin-bottom:6px}.sub{color:#6b7086;font-size:12px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:2px 18px;font-size:12px;color:#4a4763;margin:14px 0;border-top:1px solid #e5e7f0;padding-top:12px}.meta b{color:#1a1c2b}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:16px 0}h3{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#3557b7;border-bottom:1px solid #e5e7f0;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-size:13px}td{padding:5px 0;border-top:1px solid #eef1f7}.net{background:#eef4fd;border-radius:10px;padding:14px;margin-top:14px;display:flex;justify-content:space-between;align-items:center}.net b{font-size:22px;color:#1d3a8f}.est{font-size:11px;color:#8a92a8;margin-top:14px}@media print{body{padding:0}}</style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start"><div><span class="tag">Estimated payslip · pay preview</span><h1>${escH(provider)}</h1><div class="sub">Payslip · ${escH(period)} · paid ${escH(paid.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))}</div></div><div style="text-align:right"><div style="font-weight:800">${escH(l.name)}</div><div class="sub">${escH(l.role)} · ${escH(l.op)}</div></div></div>
    <div class="meta"><div>Tax code · <b>${escH(l.taxCode)}</b></div><div>NI category · <b>${escH(l.niCat)}</b></div><div>Tax period · <b>Month ${taxMonth} · ${escH(ty)}</b></div><div>Frequency · <b>Monthly</b></div></div>
    <div class="grid"><div><h3>Payments</h3><table>${pays}</table></div><div><h3>Deductions</h3><table>${row("PAYE tax (est.)", gbp(l.payeM))}${row("Employee NI (est.)", gbp(l.eeNiM))}${row("Pension — auto-enrolment", gbp(l.eePenM))}</table></div></div>
    <div class="net"><span>Net pay · BACS</span><b>${gbp(l.netM)}</b></div>
    <div class="grid"><div><h3>Year to date (${escH(ty)})</h3><table>${row("Gross", gbp(ytd("grossM")))}${row("PAYE", gbp(ytd("payeM")))}${row("Employee NI", gbp(ytd("eeNiM")))}${row("Pension", gbp(ytd("eePenM")))}${row("Net", gbp(ytd("netM")), true)}</table></div><div><h3>Employer costs</h3><table>${row("Employer NI (est.)", gbp(l.erNiM))}${row("Employer pension", gbp(l.erPenM))}${row("Total cost to employer", gbp(l.grossM + l.erNiM + l.erPenM), true)}</table></div></div>
    <div class="est">⚠ This is an ESTIMATE for planning, not a statutory itemised pay statement. PAYE, NI and pension are computed on simplified UK 2026/27 rest-of-UK bands using tax code ${escH(l.taxCode)}; pension is 5%/3% of qualifying earnings. Your real payslip is produced by the payroll provider from the RTI/HMRC submission (student loans, statutory pay, Scottish/Welsh bands etc. not modelled here).</div>
    <script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></body></html>`;
  const w = window.open(); if (w) { w.document.write(html); w.document.close(); }
}
const EKEY = "aos.payroll.employees.v2"; // v2 — added weeks/year, stable ids
const RKEY = PAYROLL_RUNS_KEY;
const IKEY = "aos.payroll.integrations.v1";

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
function computeLine(e: Emp): Line {
  const grossM = r2(grossMonthly(e)); const grossA = grossM * 12;
  const payeM = r2(payeAnnual(grossA, e.taxCode) / 12), eeNiM = r2(eeNiAnnual(grossA, e.niCat) / 12), erNiM = r2(erNiAnnual(grossA, e.niCat) / 12);
  const qeM = qePension(grossA) / 12;
  const eePenM = e.pension ? r2(qeM * 0.05) : 0, erPenM = e.pension ? r2(qeM * 0.03) : 0;
  const hoursM = e.basis === "hour" ? r2(e.hpw * (e.weeks || 52) / 12) : 0;
  return { id: e.id, name: e.name, role: e.role, op: e.op, basis: e.basis, rate: e.rate, hpw: e.hpw, weeks: e.weeks || 52, taxCode: e.taxCode, niCat: e.niCat, hoursM, grossM, payeM, eeNiM, erNiM, eePenM, erPenM, netM: r2(grossM - payeM - eeNiM - eePenM) };
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
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    try { const e = JSON.parse(localStorage.getItem(EKEY) || "null"); if (Array.isArray(e) && e.length) setEmps(e); } catch { /* ignore */ }
    try { const r = JSON.parse(localStorage.getItem(RKEY) || "null"); if (Array.isArray(r)) setRuns(r); } catch { /* ignore */ }
    try { const i = JSON.parse(localStorage.getItem(IKEY) || "null"); if (i) setConn(i); } catch { /* ignore */ }
  }, []);
  const saveEmps = (e: Emp[]) => { setEmps(e); try { localStorage.setItem(EKEY, JSON.stringify(e)); } catch { /* ignore */ } };
  const saveRuns = (r: PayRun[]) => { setRuns(r); try { localStorage.setItem(RKEY, JSON.stringify(r)); } catch { /* ignore */ } };
  const saveConn = (c: Record<string, boolean>) => { setConn(c); try { localStorage.setItem(IKEY, JSON.stringify(c)); } catch { /* ignore */ } };
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2800); };

  const lines = emps.map(computeLine);
  const totalGross = lines.reduce((a, l) => a + l.grossM, 0);
  const totalNet = lines.reduce((a, l) => a + l.netM, 0);
  const totalErCost = lines.reduce((a, l) => a + l.grossM + l.erNiM + l.erPenM, 0);
  const totalPaye = lines.reduce((a, l) => a + l.payeM, 0);
  const nextPay = (() => { const d = new Date(); d.setMonth(d.getMonth() + 1, 0); return d; })(); // month-end

  const runPayroll = () => {
    const now = new Date(); const period = monthLabel(now);
    if (runs.some((r) => r.period === period) && !window.confirm(`A payroll run for ${period} already exists. Approve another? Both are kept (a payroll record is never overwritten).`)) return;
    const run: PayRun = { id: "pr_" + now.getTime().toString(36), period, paidOn: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10), lines, status: "approved" };
    saveRuns([run, ...runs]); // never delete a prior run — versioned history
    flash(`✅ ${period} payroll run — ${lines.length} payslips generated (${gbp0(totalNet)} net).`);
    setTab("payslips");
  };

  const showPayslip = (l: Line, period: string, paidOn: string) => openPayslip(l, period, paidOn, provider, runs);

  const exportCsv = () => {
    // guard against CSV/formula injection: quote, and neutralise leading =,+,-,@
    const cell = (x: string | number) => { let s = typeof x === "number" ? x.toFixed(2) : String(x ?? ""); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [["Employee", "Role", "Location", "Gross", "PAYE", "EE NI", "Pension", "Net", "ER NI", "ER Pension"], ...lines.map((l) => [l.name, l.role, l.op, l.grossM, l.payeM, l.eeNiM, l.eePenM, l.netM, l.erNiM, l.erPenM])];
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
      <PageHero title="Payroll" icon="💷" lede="Your monthly pay runs — hours & rates from onboarding, estimated PAYE, NI and pension, branded payslips, and one-tap export to your accounting software." />

      <div className="mb-3 inline-flex flex-wrap gap-0.5 rounded-full border border-[var(--line)] bg-[var(--panel)] p-0.5">
        {([["overview", "📊 Overview"], ["employees", "👥 Employees"], ["run", "▶ Pay run"], ["payslips", "🧾 Payslips"], ["integrations", "🔌 Integrations"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={"rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors " + (tab === k ? "bg-white text-[#1d3a8f] shadow-sm" : "text-[var(--ink-3)] hover:text-[var(--ink-2)]")}>{l}</button>
        ))}
      </div>

      {tab === "overview" && (<>
        <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {tile("This month · gross", gbp0(totalGross), `${emps.length} employees`, "linear-gradient(135deg,#1d3a8f,#3f7ae0)")}
          {tile("Net to pay", gbp0(totalNet), "after tax, NI & pension", "linear-gradient(135deg,#166534,#37b26a)")}
          {tile("PAYE + NI to HMRC", gbp0(totalPaye + lines.reduce((a, l) => a + l.eeNiM + l.erNiM, 0)), "estimated liability", "linear-gradient(135deg,#9d174d,#f43f5e)")}
          {tile("Total employer cost", gbp0(totalErCost), "incl. employer NI & pension", "linear-gradient(135deg,#334155,#64748b)")}
        </div>
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2"><div><div className="text-[13.5px] font-extrabold text-[var(--ink)]">Next pay day</div><div className="text-[12px] text-[var(--ink-3)]">{nextPay.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · monthly</div></div><Button variant="primary" className="ml-auto" onClick={() => setTab("run")}>▶ Run this month&rsquo;s payroll</Button></div>
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
          <div className="mb-3 flex flex-wrap items-center gap-2"><div><div className="text-[14px] font-extrabold text-[var(--ink)]">Pay run · {monthLabel(new Date())}</div><div className="text-[12px] text-[var(--ink-3)]">Review, then approve to generate payslips. Figures are estimates.</div></div><div className="ml-auto flex gap-2"><Button onClick={exportCsv}>⬇ Export CSV</Button><Button variant="primary" onClick={runPayroll}>✓ Approve &amp; generate payslips</Button></div></div>
          <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full text-[12.5px]"><thead><tr className="bg-[var(--panel)] text-left text-[10px] uppercase tracking-wide text-[var(--ink-3)]"><th className="px-3 py-2.5 font-extrabold">Employee</th><th className="px-3 py-2.5 text-right font-extrabold">Gross</th><th className="px-3 py-2.5 text-right font-extrabold">PAYE</th><th className="px-3 py-2.5 text-right font-extrabold">NI</th><th className="px-3 py-2.5 text-right font-extrabold">Pension</th><th className="px-3 py-2.5 text-right font-extrabold">Net</th><th className="px-3 py-2.5 text-right font-extrabold">Er cost</th></tr></thead>
              <tbody>{lines.map((l) => (
                <tr key={l.id} className="border-t border-[var(--line-2,#eef2f8)]"><td className="px-3 py-2 font-bold text-[var(--ink)]">{l.name}</td><td className="px-3 py-2 text-right tabular-nums">{gbp(l.grossM)}</td><td className="px-3 py-2 text-right tabular-nums text-[#c0392b]">{gbp(l.payeM)}</td><td className="px-3 py-2 text-right tabular-nums text-[#c0392b]">{gbp(l.eeNiM)}</td><td className="px-3 py-2 text-right tabular-nums text-[#c0392b]">{gbp(l.eePenM)}</td><td className="px-3 py-2 text-right font-extrabold tabular-nums text-[#0f7a43]">{gbp(l.netM)}</td><td className="px-3 py-2 text-right tabular-nums text-[var(--ink-3)]">{gbp(l.grossM + l.erNiM + l.erPenM)}</td></tr>
              ))}
              <tr className="border-t-2 border-[var(--line)] bg-[var(--panel)] font-extrabold"><td className="px-3 py-2.5">Totals</td><td className="px-3 py-2.5 text-right tabular-nums">{gbp(totalGross)}</td><td className="px-3 py-2.5 text-right tabular-nums">{gbp(totalPaye)}</td><td className="px-3 py-2.5 text-right tabular-nums">{gbp(lines.reduce((a, l) => a + l.eeNiM, 0))}</td><td className="px-3 py-2.5 text-right tabular-nums">{gbp(lines.reduce((a, l) => a + l.eePenM, 0))}</td><td className="px-3 py-2.5 text-right tabular-nums text-[#0f7a43]">{gbp(totalNet)}</td><td className="px-3 py-2.5 text-right tabular-nums">{gbp(totalErCost)}</td></tr></tbody>
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
