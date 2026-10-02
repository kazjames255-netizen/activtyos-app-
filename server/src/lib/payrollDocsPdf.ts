import { jsPDF } from "jspdf";

// P60 (end-of-year certificate) and P45 (leaver) as PDFs, built from the YTD
// store. Same library/house style as payslipPdf.ts. These are ESTIMATE-framed
// summaries produced from this system's own figures (taxable pay is
// approximated as gross; pay from previous employments isn't tracked) — the
// statutory P60/P45 comes from the payroll provider's RTI data.
const gbp = (n: number) => "£" + (n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface PayrollDocInput {
  kind: "P60" | "P45";
  provider: string;
  employeeName: string;
  niMasked: string | null; // never the full number
  taxCode: string;
  taxYear: string; // "2026-27"
  totals: { gross: number; taxable: number; paye: number; eeNi: number; erNi: number; eePension: number; net: number };
  leaveDate?: string | null;
  provisional?: boolean;
  issuedOn: string;
}

export function maskNi(ni: string | null): string | null {
  if (!ni) return null;
  const n = ni.replace(/\s/g, "").toUpperCase();
  return n.length < 3 ? "••••" : `${n.slice(0, 2)} •• •• •• ${n.slice(-1)}`;
}

export function buildPayrollDocPdf(i: PayrollDocInput): Buffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), M = 40;
  doc.setFillColor(22, 48, 110); doc.rect(0, 0, W, 80, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text(i.provider, M, 36);
  doc.setFontSize(11); doc.setFont("helvetica", "normal");
  doc.text(i.kind === "P60" ? `P60 · End of year certificate · ${i.taxYear.replace("-", "/")}` : `P45 · Details of employee leaving work · ${i.taxYear.replace("-", "/")}`, M, 58);
  let y = 112;
  doc.setTextColor(23, 21, 52);
  const row = (k: string, v: string, bold = false) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(90, 98, 120); doc.text(k, M, y);
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setTextColor(23, 21, 52); doc.text(v, W - M, y, { align: "right" });
    doc.setDrawColor(228, 232, 242); doc.line(M, y + 6, W - M, y + 6); y += 24;
  };
  if (i.provisional) { doc.setTextColor(192, 57, 43); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("PROVISIONAL — the tax year has not ended; figures may still change.", M, y - 10); y += 10; }
  row("Employee", i.employeeName, true);
  row("National Insurance number", i.niMasked ?? "not on file");
  row("Tax code", i.taxCode || "—");
  if (i.kind === "P45") row("Leaving date", i.leaveDate ?? "—", true);
  y += 6;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(29, 58, 143);
  doc.text(i.kind === "P60" ? "Pay and deductions for the tax year (this employment)" : "Pay and tax to the leaving date (this employment, this tax year)", M, y); y += 22;
  row("Total pay", gbp(i.totals.gross), true);
  row("Taxable pay", gbp(i.totals.taxable));
  row("Income tax (PAYE) deducted", gbp(i.totals.paye), true);
  row("Employee National Insurance", gbp(i.totals.eeNi));
  row("Employee pension contributions", gbp(i.totals.eePension));
  row("Employer National Insurance", gbp(i.totals.erNi));
  row("Net pay", gbp(i.totals.net));
  y += 10;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(138, 146, 168);
  doc.text(doc.splitTextToSize(`Issued ${i.issuedOn}. This is generated from the figures held in ActivityOS for this employment only (taxable pay is approximated as gross pay; pay and tax from previous employments are not included). Keep it safe — you may need it for tax credits, loans or a tax refund. The statutory ${i.kind} comes from your payroll provider's HMRC (RTI) data.`, W - M * 2), M, y);
  return Buffer.from(doc.output("arraybuffer"));
}
