"use client";

import { useState } from "react";
import type { TenantSettings } from "@/lib/settings";

export type LineItem = { description: string; qty: number; unitPrice: number };
export type Billing = NonNullable<TenantSettings["billing"]>;

const gbp = (n: number) => `£${(Math.round((n || 0) * 100) / 100).toFixed(2)}`;
const fmtDay = (iso?: string) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
export const lineTotal = (items: LineItem[]) => Math.round(items.reduce((s, li) => s + (li.qty || 0) * (li.unitPrice || 0), 0) * 100) / 100;

const fieldCls = "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand-line,#cdddf7)]";

// The document body as standalone HTML — used for the on-screen preview and the
// print/PDF window. Mirrors the server email renderer (server/lib/moneyDoc.ts).
export function docHtml(kind: "po" | "invoice", doc: Record<string, unknown>, billing?: Billing, payUrl?: string): string {
  const b = billing ?? {};
  const business = esc(b.businessName || "Your business");
  const addr = esc(b.address || "").replace(/\n/g, "<br>");
  const contact = [b.email, b.phone].filter(Boolean).map(esc).join(" · ");
  const vat = b.vatNumber ? `VAT ${esc(b.vatNumber)}` : "";
  const title = kind === "po" ? "PURCHASE ORDER" : "INVOICE";
  const party = kind === "po"
    ? `<b>To</b><br>${esc(doc.supplier)}${doc.supplierEmail ? `<br>${esc(doc.supplierEmail)}` : ""}`
    : `<b>Bill to</b><br>${esc(doc.customerName)}${doc.customerEmail ? `<br>${esc(doc.customerEmail)}` : ""}${doc.bookingRef ? `<br>Booking ${esc(doc.bookingRef)}` : ""}`;
  const items: LineItem[] = Array.isArray(doc.lineItems) && (doc.lineItems as LineItem[]).length
    ? (doc.lineItems as LineItem[])
    : [{ description: String(doc.description || doc.notes || "Amount"), qty: 1, unitPrice: Number(doc.amount) || 0 }];
  const rows = items.map((li) => `<tr><td style="padding:8px 6px;border-bottom:1px solid #eee">${esc(li.description)}</td><td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">${li.qty ?? 1}</td><td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">${gbp(li.unitPrice ?? 0)}</td><td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right"><b>${gbp((li.qty ?? 1) * (li.unitPrice ?? 0))}</b></td></tr>`).join("");
  const total = lineTotal(items);
  const bank = kind === "invoice" && (b.bankName || b.accountNumber)
    ? `<div style="margin-top:16px;padding:12px 14px;background:#f6f8fc;border-radius:10px;font-size:13px"><div style="font-weight:700;color:#1d3a8f;margin-bottom:4px">How to pay</div>${b.bankName ? `Bank: ${esc(b.bankName)}<br>` : ""}${b.accountName ? `Name: ${esc(b.accountName)}<br>` : ""}${b.sortCode ? `Sort code: ${esc(b.sortCode)}<br>` : ""}${b.accountNumber ? `Account: ${esc(b.accountNumber)}` : ""}${payUrl ? `<div style="margin-top:10px"><a href="${esc(payUrl)}" style="display:inline-block;background:#1d3a8f;color:#fff;text-decoration:none;padding:9px 16px;border-radius:999px;font-weight:700">Pay online</a></div>` : ""}</div>`
    : "";
  return `<div style="max-width:640px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#171534;font-size:14px;line-height:1.5">
    <div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div style="font-size:18px;font-weight:800">${business}</div><div style="color:#6b6880;font-size:12.5px;margin-top:2px">${addr}${addr && contact ? "<br>" : ""}${contact}${vat ? `<br>${vat}` : ""}</div></div><div style="text-align:right"><div style="font-size:20px;font-weight:800;color:#1d3a8f;letter-spacing:.04em">${title}</div>${doc.reference ? `<div style="color:#6b6880;font-size:12.5px">${esc(doc.reference)}</div>` : ""}</div></div>
    <div style="display:flex;justify-content:space-between;margin-top:18px;font-size:13px"><div style="color:#4a4763">${party}</div><div style="text-align:right;color:#4a4763">${doc.date ? `Date: ${fmtDay(doc.date as string)}<br>` : ""}${doc.dueDate ? `Due: ${fmtDay(doc.dueDate as string)}` : ""}</div></div>
    <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px"><thead><tr style="text-align:left;color:#8a86a3;font-size:11px;text-transform:uppercase;letter-spacing:.05em"><th style="padding:6px">Description</th><th style="padding:6px;text-align:right">Qty</th><th style="padding:6px;text-align:right">Unit</th><th style="padding:6px;text-align:right">Total</th></tr></thead><tbody>${rows}</tbody></table>
    <div style="text-align:right;margin-top:12px;font-size:16px"><span style="color:#8a86a3;font-size:13px">Total </span><b>${gbp(total)}</b></div>
    ${bank}${doc.notes ? `<div style="margin-top:14px;color:#6b6880;font-size:12.5px">${esc(doc.notes)}</div>` : ""}${b.footer ? `<div style="margin-top:18px;border-top:1px solid #eee;padding-top:10px;color:#8a86a3;font-size:11.5px">${esc(b.footer)}</div>` : ""}
  </div>`;
}

export function LineItemsEditor({ items, onChange }: { items: LineItem[]; onChange: (items: LineItem[]) => void }) {
  const set = (i: number, patch: Partial<LineItem>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const num = (v: string) => (v === "" ? 0 : Number(v));
  return (
    <div>
      <div className="mb-1 flex gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">
        <span className="flex-1">Description / service</span><span className="w-14 text-right">Qty</span><span className="w-24 text-right">Unit £</span><span className="w-20 text-right">Total</span><span className="w-5" />
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={it.description} onChange={(e) => set(i, { description: e.target.value })} placeholder="e.g. Coaching — 2 hrs" className={`${fieldCls} flex-1`} />
            <input type="number" min="0" step="1" value={it.qty} onChange={(e) => set(i, { qty: num(e.target.value) })} className={`${fieldCls} w-14 text-right`} />
            <input type="number" min="0" step="0.01" value={it.unitPrice} onChange={(e) => set(i, { unitPrice: num(e.target.value) })} className={`${fieldCls} w-24 text-right`} />
            <span className="w-20 text-right text-[12.5px] font-bold tabular-nums">{gbp((it.qty || 0) * (it.unitPrice || 0))}</span>
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} disabled={items.length === 1} className="w-5 text-[15px] leading-none text-[var(--ink-3)] enabled:hover:text-[var(--red)] disabled:opacity-30" aria-label="Remove line">×</button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <button type="button" onClick={() => onChange([...items, { description: "", qty: 1, unitPrice: 0 }])} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">＋ Add line</button>
        <div className="text-[13px]"><span className="text-[var(--ink-3)]">Total </span><b className="tabular-nums">{gbp(lineTotal(items))}</b></div>
      </div>
    </div>
  );
}

// Full-screen document preview with Print/Save-PDF, Email and (invoices) pay-link.
export function PrintableDoc({ kind, doc, billing, payUrl, emailing, onEmail, onClose }: { kind: "po" | "invoice"; doc: Record<string, unknown>; billing?: Billing; payUrl?: string; emailing?: boolean; onEmail?: () => void; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const html = docHtml(kind, doc, billing, payUrl);
  const print = () => {
    const w = window.open("", "_blank", "width=820,height=1040");
    if (!w) return;
    w.document.write(`<html><head><title>${kind === "po" ? "Purchase order" : "Invoice"}${doc.reference ? ` ${esc(doc.reference)}` : ""}</title></head><body style="margin:28px">${html}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };
  const copy = async () => { if (!payUrl) return; try { await navigator.clipboard.writeText(payUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* noop */ } };
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="my-6 w-[min(720px,96vw)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={print} className="rounded-full bg-[#1d3a8f] px-3.5 py-2 text-[12.5px] font-extrabold text-white shadow-sm hover:brightness-110">⬇ Download / Print PDF</button>
          {onEmail && <button type="button" onClick={onEmail} disabled={emailing} className="rounded-full border border-[var(--line)] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink)] hover:border-[var(--ink-3)] disabled:opacity-50">{emailing ? "Sending…" : "✉ Email"}</button>}
          {payUrl && <button type="button" onClick={copy} className="rounded-full border border-[var(--line)] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[#1d3a8f] hover:border-[var(--ink-3)]">{copied ? "✓ Link copied" : "🔗 Copy pay-link"}</button>}
          <button type="button" onClick={onClose} className="rounded-full border border-[var(--line)] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink)]">Close</button>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-[0_16px_40px_-16px_rgba(29,58,143,.45)]" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
