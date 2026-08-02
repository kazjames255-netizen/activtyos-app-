// Branded "proof of purchase" receipts for a parent's payments, as a REAL
// downloadable PDF (jsPDF, lazy-loaded so it never bloats the page bundle).
// Coloured, invoice-style, one receipt per page. Includes the provider's logo
// when available and always shows the method of payment.

import type { Booking } from "@/features/bookings/types";
import { bookingDateSummary, money, payLabelFor, refundedTotal } from "@/features/bookings/helpers";

export interface ReceiptCtx {
  /** The operator's business/display name — headers each receipt. */
  brand: string;
  /** tenantId → provider name (from /api/my/providers), preferred over brand. */
  providerByTenant?: Record<string, string>;
  /** listingId → venue name/address (from /api/listings/:id), for Location. */
  venueByListing?: Record<string, { location?: string | null; address?: string | null }>;
  /** Optional logo image URL (settings.billing.logoUrl) embedded top-left. */
  logoUrl?: string | null;
}

const fmtDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

const childrenOf = (b: Booking) =>
  b.kids && b.kids.length ? b.kids.map((k) => k.name).filter(Boolean).join(", ") : b.child || "";

const fileSafe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "receipt";

// Load a logo URL as {dataUrl,w,h}. Returns null on any failure (missing,
// CORS-tainted, decode error) so the receipt just omits it.
async function loadLogo(url?: string | null): Promise<{ dataUrl: string; w: number; h: number } | null> {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const cx = canvas.getContext("2d");
        if (!cx) return resolve(null);
        cx.drawImage(img, 0, 0);
        resolve({ dataUrl: canvas.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// jsPDF type is loose here (dynamic import); keep the calls we use typed enough.
type Doc = {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  setFillColor: (r: number, g: number, b: number) => void;
  setTextColor: (r: number, g: number, b: number) => void;
  setDrawColor: (r: number, g: number, b: number) => void;
  setLineWidth: (n: number) => void;
  rect: (x: number, y: number, w: number, h: number, style?: string) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  setFont: (family: string, style?: string) => void;
  setFontSize: (n: number) => void;
  text: (t: string | string[], x: number, y: number, opts?: { align?: string }) => void;
  splitTextToSize: (t: string, w: number) => string[];
  addImage: (data: string, fmt: string, x: number, y: number, w: number, h: number) => void;
  addPage: () => void;
  save: (name: string) => void;
};

function drawReceipt(doc: Doc, b: Booking, ctx: ReceiptCtx, logo: { dataUrl: string; w: number; h: number } | null) {
  const provider = (b.tenantId && ctx.providerByTenant?.[b.tenantId]) || ctx.brand || "Your activity provider";
  const venue = b.listingId ? ctx.venueByListing?.[b.listingId] : undefined;
  const loc = [venue?.location, venue?.address].filter(Boolean).join(", ");
  const refunded = refundedTotal(b);
  const pageW = doc.internal.pageSize.getWidth();
  const M = 40;
  const contentW = pageW - M * 2;

  // ── Header band ─────────────────────────────────────────────
  doc.setFillColor(22, 48, 110); // navy
  doc.rect(0, 0, pageW, 96, "F");
  doc.setFillColor(47, 107, 216); // accent underline
  doc.rect(0, 96, pageW, 4, "F");

  let textX = M;
  if (logo) {
    const h = 46;
    const w = Math.min(120, (logo.w / logo.h) * h);
    try {
      doc.addImage(logo.dataUrl, "PNG", M, 26, w, h);
      textX = M + w + 14;
    } catch {
      /* corrupt image — fall back to text only */
    }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(provider, textX, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 214, 242);
  doc.text("PAYMENT RECEIPT · PROOF OF PURCHASE", textX, 68);

  // Amount, right-aligned
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("AMOUNT PAID", pageW - M, 44, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(money(b.amount - refunded), pageW - M, 68, { align: "right" });

  // ── Body table ──────────────────────────────────────────────
  const rows: [string, string][] = [
    ["Receipt ref", b.ref],
    ["Activity", b.listing],
    ["Pass", b.ticket || b.pass || "—"],
    ["Child", childrenOf(b)],
    ["Dates", bookingDateSummary(b)],
  ];
  if (b.sessions && b.sessions.length) rows.push(["Sessions / times", b.sessions.join("   ·   ")]);
  if (loc) rows.push(["Location", loc]);
  if (b.addons && b.addons.length) rows.push(["Add-ons", b.addons.join(", ")]);
  rows.push(["Payment status", payLabelFor(b)]);
  rows.push(["Payment method", b.method && b.method !== "—" ? b.method : "Card"]);
  if (refunded > 0) rows.push(["Refunded", `-${money(refunded)}  (of ${money(b.amount)})`]);
  rows.push(["Booked by", `${b.booker || ""}${b.email ? `   ·   ${b.email}` : ""}`]);
  const issued = fmtDate(b.createdAt);
  if (issued) rows.push(["Date of purchase", issued]);

  const labelW = 150;
  const valX = M + labelW + 12;
  const valW = contentW - labelW - 12;
  let y = 128;
  doc.setFontSize(10.5);
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.6);

  for (const [k, v] of rows) {
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(String(v || "—"), valW);
    const rowH = Math.max(24, lines.length * 14 + 10);
    // label cell
    doc.setFillColor(240, 244, 252);
    doc.rect(M, y, labelW, rowH, "F");
    doc.rect(M, y, labelW, rowH); // border
    doc.rect(M + labelW, y, valW + 12, rowH); // value cell border
    doc.setTextColor(22, 48, 110);
    doc.setFont("helvetica", "bold");
    doc.text(k, M + 10, y + 16);
    // value
    doc.setTextColor(23, 21, 52);
    doc.setFont("helvetica", "normal");
    doc.text(lines, valX, y + 16);
    y += rowH;
  }

  // ── Footer ──────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(138, 134, 163);
  doc.text(`Keep this receipt as proof of purchase. Issued by ${provider} via ActivityOS.`, M, y + 22);
}

/**
 * Builds and DOWNLOADS a real .pdf — one page per booking. Bulk = all supplied.
 */
export async function downloadReceipts(bookings: Booking[], ctx: ReceiptCtx) {
  if (!bookings.length) return;
  const { jsPDF } = await import("jspdf");
  const logo = await loadLogo(ctx.logoUrl);
  const doc = new jsPDF({ unit: "pt", format: "a4" }) as unknown as Doc;
  bookings.forEach((b, i) => {
    if (i > 0) doc.addPage();
    drawReceipt(doc, b, ctx, logo);
  });
  const name =
    bookings.length === 1
      ? `${fileSafe(ctx.brand || "receipt")}-${fileSafe(bookings[0].ref)}.pdf`
      : `${fileSafe(ctx.brand || "receipts")}-${bookings.length}-receipts.pdf`;
  doc.save(name);
}
