// Branded "proof of purchase" receipts for a parent's payments. No PDF library
// in the app — we build a self-contained, inline-styled HTML document and open
// it in a print window, where the browser's "Save as PDF" produces the file
// (same approach as the timetable print). One receipt per booking; bulk mode
// stacks them with a page break between.

import type { Booking } from "@/features/bookings/types";
import { money, payLabelFor, refundedTotal } from "@/features/bookings/helpers";

export interface ReceiptCtx {
  /** The operator's business/display name — headers each receipt. */
  brand: string;
  /** tenantId → provider name (from /api/my/providers), preferred over brand. */
  providerByTenant?: Record<string, string>;
  /** listingId → venue name/address (from /api/listings/:id), for Location. */
  venueByListing?: Record<string, { location?: string | null; address?: string | null }>;
}

const esc = (x: unknown) =>
  String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const fmtDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

const childrenOf = (b: Booking) =>
  b.kids && b.kids.length ? b.kids.map((k) => k.name).filter(Boolean).join(", ") : b.child || "";

function receiptHtml(b: Booking, ctx: ReceiptCtx): string {
  const provider = (b.tenantId && ctx.providerByTenant?.[b.tenantId]) || ctx.brand || "Your activity provider";
  const venue = b.listingId ? ctx.venueByListing?.[b.listingId] : undefined;
  const loc = [venue?.location, venue?.address].filter(Boolean).join(", ");
  const refunded = refundedTotal(b);

  const rows: [string, string][] = [
    ["Receipt ref", b.ref],
    ["Activity", b.listing],
    ["Pass", b.ticket || b.pass || "—"],
    ["Child", childrenOf(b)],
    ["Dates", b.dates || (b.days ?? []).join(", ") || "—"],
  ];
  if (b.sessions && b.sessions.length) rows.push(["Sessions / times", b.sessions.join("  ·  ")]);
  if (loc) rows.push(["Location", loc]);
  if (b.addons && b.addons.length) rows.push(["Add-ons", b.addons.join(", ")]);
  rows.push(["Payment status", payLabelFor(b)]);
  if (b.method && b.method !== "—") rows.push(["Payment method", b.method]);
  rows.push(["Booked by", `${b.booker || ""}${b.email ? `  ·  ${b.email}` : ""}`]);
  const issued = fmtDate(b.createdAt);
  if (issued) rows.push(["Date of purchase", issued]);

  const rowsHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 10px;border:1px solid #e5e7eb;background:#f7f9fd;font-weight:700;white-space:nowrap;color:#4a4763;font-size:12px">${esc(k)}</td>` +
        `<td style="padding:6px 10px;border:1px solid #e5e7eb;font-size:12px">${esc(v)}</td></tr>`,
    )
    .join("");

  const amountBlock =
    refunded > 0
      ? `<div>Amount paid: <b>${money(b.amount)}</b></div><div style="color:#b0186a">Refunded: −${money(refunded)}</div><div style="margin-top:2px;font-size:16px">Net: <b>${money(b.amount - refunded)}</b></div>`
      : `<div style="font-size:16px">Amount: <b>${money(b.amount)}</b></div>`;

  return (
    `<section style="page-break-after:always;max-width:640px;margin:0 auto 26px">` +
    `<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #2f6bd8;padding-bottom:10px;margin-bottom:14px">` +
    `<div><div style="font-size:20px;font-weight:800;color:#16306e">${esc(provider)}</div>` +
    `<div style="font-size:12px;color:#666;font-weight:600;letter-spacing:.04em;text-transform:uppercase">Payment receipt · Proof of purchase</div></div>` +
    `<div style="text-align:right;font-size:13px;color:#171534">${amountBlock}</div>` +
    `</div>` +
    `<table style="width:100%;border-collapse:collapse;font-family:inherit">${rowsHtml}</table>` +
    `<div style="margin-top:12px;font-size:11px;color:#8a86a3">Keep this receipt as proof of purchase. Issued by ${esc(provider)} via ActivityOS.</div>` +
    `</section>`
  );
}

/** Opens a print window with one or many receipts. Bulk = all supplied bookings. */
export function printReceipts(bookings: Booking[], ctx: ReceiptCtx) {
  if (!bookings.length) return;
  const title = bookings.length === 1 ? `Receipt ${bookings[0].ref}` : `${bookings.length} receipts`;
  const body = bookings.map((b) => receiptHtml(b, ctx)).join("");
  const html =
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${esc(ctx.brand || "Payments")} — ${esc(title)}</title></head>` +
    `<body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;padding:20px;color:#171534">` +
    `${body}<script>window.onload=function(){window.print();}<\/script></body></html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}
