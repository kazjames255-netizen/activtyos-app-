// Real, persistable PDF payslips — the backend half of
// docs/payroll-integrations-handoff.md §4. Mirrors the content and structure
// of the front end's `openPayslip()` (features/payroll/PayrollApp.tsx): same
// fields, same "ESTIMATE" framing, same ERA 1996 s.8A hours line for hourly
// staff — just rendered server-side as bytes instead of a window.print()
// popup. jsPDF is already the codebase's PDF library (see
// features/parent/paymentReceipt.ts, which builds real downloadable receipts
// the same way) — it needs no headless browser and runs fine in plain Node,
// confirmed against this server's runtime. No new dependency category, just
// jspdf added to server/package.json alongside the app's existing use of it.
import { jsPDF } from "jspdf";

export interface PayslipAdjItem { id: string; label: string; amount: number }
export interface PayslipLeaveSum { byKind: Record<string, number>; unpaidDays: number; sickDays: number; statutoryDays: number }
// Shape of one `PayRun.lines[]` entry, as written by
// server/src/routes/payroll.ts's POST /runs (features/payroll/payCalc.ts's
// `Line`). Read-only here — we never write payrollRuns.
export interface PayslipLine {
  id: string;
  staffKey?: string;
  name: string;
  role?: string;
  op?: string;
  basis: "hour" | "year";
  rate: number;
  hpw?: number;
  weeks?: number;
  taxCode: string;
  niCat: string;
  freqLabel?: string;
  hoursM?: number;
  hoursFrom?: "contracted" | "timesheet" | "manual";
  basePayM?: number;
  unpaidLeaveM?: number;
  sickLeaveM?: number;
  sickPay?: "full" | "ssp";
  leave?: PayslipLeaveSum;
  additions?: PayslipAdjItem[];
  deductions?: PayslipAdjItem[];
  grossM: number;
  payeM: number;
  eeNiM: number;
  erNiM: number;
  eePenM: number;
  erPenM: number;
  netM: number;
}
export interface PayslipRun { id: string; period: string; paidOn: string; lines: PayslipLine[] }

const gbp = (n: number) => "£" + (n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plural = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// The tax year runs 6 April → 5 April. Used both for the "Tax period" line
// and to scope the year-to-date figures — identical logic to openPayslip().
export function taxYearFor(paidOnIso: string): { start: number; label: string; fromDate: string; endDate: string } {
  // The UK tax year starts on 6 April: 1-5 April still belong to the PREVIOUS year (the old `month >= April` test put 5 April in the new one,
  // so a payslip dated 3 April 2026 showed 2026/27 while payrollYtd.ts, P60 data and the YTD store used 2025/26).
  const [y, m, d] = paidOnIso.split("-").map(Number);
  const start = m > 4 || (m === 4 && d >= 6) ? y : y - 1;
  return {
    start,
    label: `${start}/${String((start + 1) % 100).padStart(2, "0")}`,
    fromDate: `${start}-04-06`,
    endDate: `${start + 1}-04-05`,
  };
}

function taxPeriodLabel(paidOnIso: string, freqLabel: string): string {
  const [y, m, d] = paidOnIso.split("-").map(Number);
  const ty = taxYearFor(paidOnIso);
  // Tax month 1 = 6 Apr-5 May, ... month 12 = 6 Mar-5 Apr.
  const taxMonth = Math.min(12, Math.max(1, (y - ty.start) * 12 + (m - 4) + (d >= 6 ? 1 : 0)));
  const taxWeek = Math.min(53, Math.max(1, Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(ty.start, 3, 6)) / (7 * 86400000)) + 1));
  if (freqLabel === "Weekly") return `Week ${taxWeek} · ${ty.label}`;
  if (freqLabel === "Monthly") return `Month ${taxMonth} · ${ty.label}`;
  return `${freqLabel} · ${ty.label}`;
}

/** Sums one YTD figure across every run in the same tax year, up to and
 *  including `paidOn`, for the lines that belong to this employee (matched
 *  by staffKey/id, same as the front end and GET /api/payroll/mine). */
function ytdOf(allRuns: PayslipRun[], employeeKey: string, paidOn: string, fromDate: string, key: keyof PayslipLine): number {
  let total = 0;
  for (const r of allRuns) {
    if (r.paidOn < fromDate || r.paidOn > paidOn) continue;
    for (const l of r.lines) {
      if ((l.staffKey ?? l.id) !== employeeKey) continue;
      const v = l[key];
      if (typeof v === "number") total += v;
    }
  }
  return r2(total);
}

export interface BuildPayslipInput {
  line: PayslipLine;
  period: string;
  paidOn: string;
  provider: string;
  /** Every run this employee appears in (for YTD) — same tax year suffices,
   *  the caller may pass the tenant's full run list. */
  allRuns: PayslipRun[];
}

/** Builds the real PDF — one page, matching openPayslip()'s HTML content:
 *  employer/employee identity, tax code, tax period, NI category, hours line
 *  for hourly staff (ERA 1996 s.8A), payments/deductions, net pay, YTD,
 *  employer costs, and the same estimate disclaimer. Returns raw PDF bytes. */
export function buildPayslipPdf(input: BuildPayslipInput): Buffer {
  const { line: l, period, paidOn, provider, allRuns } = input;
  const employeeKey = l.staffKey ?? l.id;
  const ty = taxYearFor(paidOn);
  const freqLabel = l.freqLabel || "Monthly";
  const taxPeriod = taxPeriodLabel(paidOn, freqLabel);
  const ytd = (k: keyof PayslipLine) => ytdOf(allRuns, employeeKey, paidOn, ty.fromDate, k);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 40;
  const contentW = pageW - M * 2;
  const colW = (contentW - 20) / 2;

  // ── Header band ─────────────────────────────────────────────
  doc.setFillColor(22, 48, 110); // navy
  doc.rect(0, 0, pageW, 92, "F");
  doc.setFillColor(47, 107, 216);
  doc.rect(0, 92, pageW, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(provider, M, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 214, 242);
  doc.text("ESTIMATED PAYSLIP · PAY PREVIEW", M, 54);
  doc.setFontSize(9.5);
  doc.text(`Payslip · ${period} · paid ${new Date(`${paidOn}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`, M, 70);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(l.name, pageW - M, 40, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(200, 214, 242);
  doc.text([l.role, l.op].filter(Boolean).join(" · ") || "—", pageW - M, 56, { align: "right" });

  // ── Meta row (tax code / NI / tax period / frequency) ──────────
  let y = 116;
  doc.setTextColor(23, 21, 52);
  doc.setFontSize(9.5);
  const meta: [string, string][] = [
    ["Tax code", l.taxCode],
    ["NI category", l.niCat],
    ["Tax period", taxPeriod],
    ["Frequency", freqLabel],
  ];
  meta.forEach(([k, v], i) => {
    const x = M + (i % 2) * (contentW / 2);
    const yy = y + Math.floor(i / 2) * 16;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 112, 134);
    doc.text(`${k} ·`, x, yy);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(23, 21, 52);
    doc.text(v || "—", x + doc.getTextWidth(`${k} · `) + 2, yy);
  });
  y += 40;

  const lv = l.leave;
  if (lv && Object.keys(lv.byKind).length) {
    const leaveLabel = Object.entries(lv.byKind).map(([k, d]) => `${d} day${d === 1 ? "" : "s"} ${k}`).join(" · ");
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 112, 134);
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(`Leave this period · ${leaveLabel}`, contentW);
    doc.text(lines, M, y);
    y += lines.length * 12 + 6;
  }
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.6);
  doc.line(M, y, pageW - M, y);
  y += 16;

  // ── Payments / Deductions (two columns) ────────────────────────
  const basePay = l.basePayM ?? l.grossM;
  const unpaidM = l.unpaidLeaveM || 0, sickM = l.sickLeaveM || 0;
  type Row = [string, string];
  const payRows: Row[] = [];
  if (l.basis === "hour") {
    payRows.push([`Basic pay · ${l.hoursM ?? 0} hrs${l.hoursFrom === "timesheet" ? " (approved timesheets)" : ""} @ £${l.rate.toFixed(2)}`, gbp(basePay)]);
    if (unpaidM > 0 && lv) payRows.push([`Unpaid leave · ${plural(lv.unpaidDays)} (${r2(unpaidM / (l.rate || 1))} hrs not paid)`, "—"]);
    if (sickM > 0 && lv) payRows.push([`Sickness · ${plural(lv.sickDays)} (${r2(sickM / (l.rate || 1))} hrs not paid — SSP only)`, "—"]);
  } else {
    payRows.push(["Salary", gbp(basePay + unpaidM + sickM)]);
    if (unpaidM > 0 && lv) payRows.push([`Unpaid leave · ${plural(lv.unpaidDays)}`, "−" + gbp(unpaidM)]);
    if (sickM > 0 && lv) payRows.push([`Sickness · ${plural(lv.sickDays)} (SSP only)`, "−" + gbp(sickM)]);
  }
  for (const a of l.additions || []) payRows.push([a.label || "Addition", gbp(a.amount)]);
  if ((l.additions || []).length || ((unpaidM > 0 || sickM > 0) && l.basis === "year")) payRows.push(["Gross pay", gbp(l.grossM)]);

  const dedRows: Row[] = [
    ["PAYE tax (est.)", gbp(l.payeM)],
    ["Employee NI (est.)", gbp(l.eeNiM)],
    ["Pension — auto-enrolment", gbp(l.eePenM)],
    ...(l.deductions || []).map((d): Row => [d.label || "Deduction", gbp(d.amount)]),
  ];

  const drawTable = (title: string, rows: Row[], x: number, top: number): number => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(53, 87, 183);
    doc.text(title.toUpperCase(), x, top);
    doc.setDrawColor(229, 231, 235);
    doc.line(x, top + 4, x + colW, top + 4);
    let ry = top + 20;
    for (const [k, v] of rows) {
      const lines = doc.splitTextToSize(k, colW - 70);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(74, 71, 99);
      doc.text(lines, x, ry);
      doc.setFont("helvetica", v === "Gross pay" ? "bold" : "normal");
      doc.setTextColor(23, 21, 52);
      doc.text(v, x + colW, ry, { align: "right" });
      doc.setDrawColor(238, 241, 247);
      doc.line(x, ry + 4, x + colW, ry + 4);
      ry += Math.max(16, lines.length * 12 + 4);
    }
    return ry;
  };
  const payBottom = drawTable("Payments", payRows, M, y);
  const dedBottom = drawTable("Deductions", dedRows, M + colW + 20, y);
  y = Math.max(payBottom, dedBottom) + 10;

  // ── Net pay banner ───────────────────────────────────────────
  doc.setFillColor(238, 244, 253);
  doc.roundedRect(M, y, contentW, 36, 6, 6, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(23, 21, 52);
  doc.text("Net pay · BACS", M + 14, y + 23);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(29, 58, 143);
  doc.text(gbp(l.netM), pageW - M - 14, y + 24, { align: "right" });
  y += 54;

  // ── YTD / Employer costs (two columns) ─────────────────────────
  const ytdRows: Row[] = [
    ["Gross", gbp(ytd("grossM"))],
    ["PAYE", gbp(ytd("payeM"))],
    ["Employee NI", gbp(ytd("eeNiM"))],
    ["Pension", gbp(ytd("eePenM"))],
    ["Net", gbp(ytd("netM"))],
  ];
  const costRows: Row[] = [
    ["Employer NI (est.)", gbp(l.erNiM)],
    ["Employer pension", gbp(l.erPenM)],
    ["Total cost to employer", gbp(l.grossM + l.erNiM + l.erPenM)],
  ];
  const yb = drawTable(`Year to date (${ty.label})`, ytdRows, M, y);
  const cb = drawTable("Employer costs", costRows, M + colW + 20, y);
  y = Math.max(yb, cb) + 16;

  // ── Disclaimer (ERA 1996 s.8A + estimate framing) ───────────────
  const statNote = lv && (lv.sickDays || lv.statutoryDays)
    ? ` This period includes ${[lv.sickDays ? `${plural(lv.sickDays)} sickness${l.sickPay === "ssp" ? " (deducted — SSP to be added by your payroll provider)" : l.sickPay === "full" ? " (paid in full)" : ""}` : "", lv.statutoryDays ? `${plural(lv.statutoryDays)} statutory-pay leave` : ""].filter(Boolean).join(" and ")} — Statutory Sick Pay / statutory family pay are NOT included in these figures.`
    : "";
  const disclaimer = `⚠ This is an ESTIMATE for planning, not a statutory itemised pay statement (Employment Rights Act 1996 s.8A requires an itemised pay statement showing, for variable-hours pay, the number of hours worked — the hours line above meets that; the figures themselves are still estimates). PAYE, NI and pension are computed on simplified UK bands using tax code ${l.taxCode}; pension is 5%/3% of qualifying earnings. Your real payslip is produced by the payroll provider from the RTI/HMRC submission (student loans, statutory pay, Scottish/Welsh bands etc. not modelled here).${statNote}`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(138, 146, 168);
  const dLines = doc.splitTextToSize(disclaimer, contentW);
  doc.text(dLines, M, y);

  return Buffer.from(doc.output("arraybuffer"));
}
