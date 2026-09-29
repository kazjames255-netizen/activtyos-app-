// Renders a purchase order as a real downloadable PDF — the attachment for
// POST /purchasing/:id/email (p2-m26). Mirrors the field set of
// renderMoneyDoc("po", ...) in moneyDoc.ts (same header/party/lines/totals),
// laid out with jsPDF the same way lib/payslipPdf.ts builds payslips — jsPDF
// is already the codebase's server-side PDF library, no new dependency.

import { jsPDF } from "jspdf";

type LineItem = { description?: string; qty?: number; unitPrice?: number };
type Doc = Record<string, unknown> & { amount?: number; lineItems?: LineItem[] };
type Billing = Record<string, unknown> | undefined;

const money = (n: number) => `£${(Math.round((n || 0) * 100) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDay = (iso?: unknown) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Builds a one-page PO PDF and returns the raw bytes. */
export function buildPoPdf(doc: Doc, billing: Billing): Buffer {
  const b = billing ?? {};
  const business = String(b.businessName || "Your business");

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const M = 40;
  const contentW = pageW - M * 2;
  let y = 56;

  // Header
  pdf.setFillColor(22, 48, 110);
  pdf.rect(0, 0, pageW, 80, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(business, M, 40);
  pdf.setFontSize(18);
  pdf.text("PURCHASE ORDER", pageW - M, 40, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  const addr = Array.isArray(b.addressLines) ? (b.addressLines as string[]).join(", ") : String(b.address || "");
  const contact = [b.email, b.phone].filter(Boolean).join(" · ");
  pdf.text([addr, contact].filter(Boolean).join(" · "), M, 60);

  pdf.setTextColor(23, 21, 52);
  y = 108;

  // Party (To) / meta
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("To", M, y);
  pdf.setFont("helvetica", "normal");
  const partyLines = [
    String(doc.supplier ?? ""),
    doc.supplierAddress ? String(doc.supplierAddress) : "",
    doc.supplierEmail ? String(doc.supplierEmail) : "",
    doc.supplierPhone ? String(doc.supplierPhone) : "",
  ].filter(Boolean);
  partyLines.forEach((l, i) => pdf.text(l, M, y + 16 + i * 14));

  const metaLines = [
    doc.reference ? `PO No: ${doc.reference}` : "",
    doc.date ? `Order date: ${fmtDay(doc.date)}` : "",
    doc.dueDate ? `Delivery by: ${fmtDay(doc.dueDate)}` : "",
    doc.requestedBy ? `Requested by: ${doc.requestedBy}` : "",
  ].filter(Boolean) as string[];
  metaLines.forEach((l, i) => pdf.text(l, pageW - M, y + i * 14, { align: "right" }));

  y += Math.max(partyLines.length, metaLines.length) * 14 + 30;

  // Line items table
  const items: LineItem[] = Array.isArray(doc.lineItems) && doc.lineItems.length
    ? doc.lineItems
    : [{ description: (doc.notes as string) || "Amount", qty: 1, unitPrice: doc.amount ?? 0 }];

  pdf.setFillColor(246, 248, 252);
  pdf.rect(M, y - 12, contentW, 18, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("DESCRIPTION", M + 6, y);
  pdf.text("QTY", M + contentW - 170, y, { align: "right" });
  pdf.text("UNIT", M + contentW - 90, y, { align: "right" });
  pdf.text("TOTAL", M + contentW, y, { align: "right" });
  y += 16;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  for (const li of items) {
    const lineTotal = (li.qty ?? 1) * (li.unitPrice ?? 0);
    if (y > pdf.internal.pageSize.getHeight() - 120) { pdf.addPage(); y = 56; }
    pdf.text(String(li.description ?? ""), M, y, { maxWidth: contentW - 180 });
    pdf.text(String(li.qty ?? 1), M + contentW - 170, y, { align: "right" });
    pdf.text(money(li.unitPrice ?? 0), M + contentW - 90, y, { align: "right" });
    pdf.text(money(lineTotal), M + contentW, y, { align: "right" });
    y += 18;
    pdf.setDrawColor(230, 235, 242);
    pdf.line(M, y - 6, M + contentW, y - 6);
  }

  const subtotal = r2(items.reduce((s, li) => s + (li.qty ?? 1) * (li.unitPrice ?? 0), 0));
  y += 16;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(`Total: ${money(subtotal)}`, M + contentW, y, { align: "right" });
  y += 26;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(107, 104, 128);
  if (doc.deliveryAddress || addr) {
    pdf.setFont("helvetica", "bold");
    pdf.text("Deliver to", M, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(String(doc.deliveryAddress || business), M, y + 12, { maxWidth: contentW });
    y += 30;
  }
  if (doc.comments) {
    pdf.setFont("helvetica", "bold");
    pdf.text("Comments", M, y);
    pdf.setFont("helvetica", "normal");
    const lines = pdf.splitTextToSize(String(doc.comments), contentW);
    pdf.text(lines, M, y + 12);
    y += 12 + lines.length * 12 + 10;
  }
  if (doc.notes) {
    const lines = pdf.splitTextToSize(String(doc.notes), contentW);
    pdf.text(lines, M, y);
  }

  return Buffer.from(pdf.output("arraybuffer"));
}
