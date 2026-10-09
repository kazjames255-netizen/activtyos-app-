"use client";

import { dateLocale as dl, uiDate } from "@/lib/i18n/format";
import { useState } from "react";
import type { TenantSettings } from "@/lib/settings";
import { tNow, useT } from "@/lib/i18n/provider";
import { rich } from "./rich";

export type LineItem = { description: string; qty: number; unitPrice: number };
export type Billing = NonNullable<TenantSettings["billing"]>;

const gbp = (n: number) => `£${(Math.round((n || 0) * 100) / 100).toLocaleString(dl(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDay = (iso?: string) => (iso ? uiDate(new Date(`${String(iso).slice(0, 10)}T00:00:00Z`), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
export const lineTotal = (items: LineItem[]) => Math.round(items.reduce((s, li) => s + (li.qty || 0) * (li.unitPrice || 0), 0) * 100) / 100;

// No w-full here — the row sizes each input explicitly (flex-1 / w-14 / w-24),
// and a w-full would override those and collapse the description field.
const fieldCls = "min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand-line,#cdddf7)]";

// The document body as standalone HTML — used for the on-screen preview and the
// print/PDF window. Mirrors the server email renderer (server/lib/moneyDoc.ts).
export function docHtml(kind: "po" | "invoice" | "bill", doc: Record<string, unknown>, billing?: Billing, payUrl?: string): string {
  const t = tNow; // the document is shown in the language the operator has chosen (browser-side preview / print)
  const b = billing ?? {};
  const business = esc(b.businessName || t("p8fin.dcBusinessFallback"));
  const addr = esc(b.address || "").replace(/\n/g, "<br>");
  const contact = [b.email, b.phone].filter(Boolean).map(esc).join(" · ");
  const vat = b.vatNumber ? `VAT ${esc(b.vatNumber)}` : "";
  const logo = b.logoUrl ? `<img src="${esc(b.logoUrl)}" alt="" style="max-height:56px;max-width:200px;margin-bottom:6px"/>` : "";
  const companyReg = b.companyReg ? t("p8fin.dcCompanyReg", { n: esc(b.companyReg) }) : "";
  const isInv = kind === "invoice";
  const title = kind === "po" ? t("p8fin.dcPO") : kind === "bill" ? t("p8fin.dcBill") : t("p8fin.dcInvoice");
  const partyName = isInv ? doc.customerName : doc.supplier;
  const partyEmail = isInv ? doc.customerEmail : doc.supplierEmail;
  const partyPhone = isInv ? undefined : doc.supplierPhone;
  const partyAddr = isInv ? doc.customerAddress : doc.supplierAddress;
  const party = `<b>${isInv ? t("p8fin.dcBillTo") : kind === "bill" ? t("p8fin.dcFrom") : t("p8fin.dcTo")}</b><br>${esc(partyName)}${partyAddr ? `<br>${esc(partyAddr).replace(/\n/g, "<br>")}` : ""}${partyEmail ? `<br>${esc(partyEmail)}` : ""}${partyPhone ? `<br>${esc(partyPhone)}` : ""}${doc.bookingRef ? `<br>${t("p8fin.dcBookingRef", { ref: esc(doc.bookingRef) })}` : ""}`;
  const isPo = kind === "po";
  const meta = [
    doc.reference ? t(kind === "po" ? "p8fin.dcPoNo" : kind === "bill" ? "p8fin.dcBillNo" : "p8fin.dcInvNo", { ref: esc(doc.reference) }) : "",
    doc.date ? t(kind === "po" ? "p8fin.dcOrderDate" : "p8fin.dcDate", { date: fmtDay(doc.date as string) }) : "",
    doc.dueDate ? t(kind === "po" ? "p8fin.dcDeliveryBy" : "p8fin.dcDue", { date: fmtDay(doc.dueDate as string) }) : "",
    isPo && doc.requestedBy ? t("p8fin.dcRequestedBy", { name: esc(doc.requestedBy) }) : "",
    kind === "invoice" && doc.poNumber ? t("p8fin.dcPoNumber", { ref: esc(doc.poNumber) }) : "",
    doc.accountRef ? t("p8fin.dcAccountRef", { ref: esc(doc.accountRef) }) : "",
  ].filter(Boolean).join("<br>");
  // A PO tells the supplier where to send the goods — a per-PO delivery address
  // if given, otherwise your own; with the delivery date alongside.
  const deliverAddr = doc.deliveryAddress ? esc(doc.deliveryAddress).replace(/\n/g, "<br>") : addr;
  const deliverTo = isPo && (deliverAddr || business)
    ? `<div style="margin-top:14px;padding:12px 14px;background:#f6f8fc;border-radius:10px;font-size:12.5px;color:#4a4763"><b style="color:#1d3a8f">${t("p8fin.dcDeliverTo")}</b><br>${business}${deliverAddr ? `<br>${deliverAddr}` : ""}${doc.dueDate ? `<br><span style="color:#6b6880">${t("p8fin.dcDeliveryDate", { date: fmtDay(doc.dueDate as string) })}</span>` : ""}</div>`
    : "";
  const terms = b.paymentTerms && kind !== "bill" ? `<div style="margin-top:12px;font-size:12px;color:#6b6880"><b>${kind === "po" ? t("p8fin.dcPaymentTerms") : t("p8fin.dcTerms")}</b> ${esc(b.paymentTerms)}</div>` : "";
  // PO boilerplate from settings + the per-PO comments field.
  const numbered = (txt: unknown) => String(txt ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .map((l, i) => `<div style="display:flex;gap:8px;margin-top:3px"><span style="color:#8a86a3;min-width:14px">${i + 1}.</span><span>${esc(l)}</span></div>`).join("");
  const poComments = isPo && doc.comments ? `<div style="margin-top:14px;font-size:12.5px;color:#4a4763"><b style="color:#1d3a8f">${t("p8fin.dcComments")}</b><div style="margin-top:3px">${esc(doc.comments).replace(/\n/g, "<br>")}</div></div>` : "";
  const poPayMethod = isPo && b.poPaymentMethod ? `<div style="margin-top:12px;font-size:12.5px;color:#4a4763"><b style="color:#1d3a8f">${t("p8fin.dcPayMethod")}</b> ${esc(b.poPaymentMethod)}</div>` : "";
  const poInstructions = isPo && b.poInstructions ? `<div style="margin-top:14px;font-size:12px;color:#6b6880"><b style="color:#1d3a8f">${t("p8fin.dcInstructions")}</b>${numbered(b.poInstructions)}</div>` : "";
  const poTerms = isPo && b.poTerms ? `<div style="margin-top:14px;padding-top:10px;border-top:1px solid #eee;font-size:11.5px;color:#8a86a3"><b>${t("p8fin.dcTermsConditions").replace(/&/g, "&amp;")}</b><div style="margin-top:3px">${esc(b.poTerms).replace(/\n/g, "<br>")}</div></div>` : "";
  const items: LineItem[] = Array.isArray(doc.lineItems) && (doc.lineItems as LineItem[]).length
    ? (doc.lineItems as LineItem[])
    : [{ description: String(doc.description || doc.notes || t("p8fin.dcAmount")), qty: 1, unitPrice: Number(doc.amount) || 0 }];
  // Inline break-inside (not a class): this HTML is also opened standalone via
  // document.write() in a popup window with no access to app/globals.css, so a
  // reusable class wouldn't do anything there — the rule has to travel with
  // the markup itself.
  const rows = items.map((li, i) => `<tr style="break-inside:avoid;page-break-inside:avoid">${isPo ? `<td style="padding:8px 6px;border-bottom:1px solid #eee;color:#8a86a3;font-variant-numeric:tabular-nums">${String((i + 1) * 10).padStart(5, "0")}</td>` : ""}<td style="padding:8px 6px;border-bottom:1px solid #eee">${esc(li.description)}</td><td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:end">${li.qty ?? 1}</td><td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:end">${gbp(li.unitPrice ?? 0)}</td><td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:end"><b>${gbp((li.qty ?? 1) * (li.unitPrice ?? 0))}</b></td></tr>`).join("");
  const subtotal = lineTotal(items);
  const rate = Number(doc.taxRate) || 0;
  const tax = Math.round(subtotal * rate) / 100;
  const totals = rate > 0
    ? `<div style="text-align:end;margin-top:12px;font-size:13px;color:#4a4763"><div>${t("p8fin.dcSubtotal", { amount: gbp(subtotal) })}</div><div>${t("p8fin.dcVatLine", { rate, amount: gbp(tax) })}</div><div style="font-size:16px;margin-top:4px;color:#171534"><span style="color:#8a86a3;font-size:13px">${t("p8fin.dcColTotal")} </span><b>${gbp(Math.round((subtotal + tax) * 100) / 100)}</b></div></div>`
    : `<div style="text-align:end;margin-top:12px;font-size:16px"><span style="color:#8a86a3;font-size:13px">${t("p8fin.dcColTotal")} </span><b>${gbp(subtotal)}</b></div>`;
  const bank = kind === "invoice" && (b.bankName || b.accountNumber)
    ? `<div style="margin-top:16px;padding:12px 14px;background:#f6f8fc;border-radius:10px;font-size:13px"><div style="font-weight:700;color:#1d3a8f;margin-bottom:4px">${t("p8fin.dcHowToPay")}</div>${b.bankName ? `${t("p8fin.dcBankLine", { v: esc(b.bankName) })}<br>` : ""}${b.accountName ? `${t("p8fin.dcNameLine", { v: esc(b.accountName) })}<br>` : ""}${b.sortCode ? `${t("p8fin.dcSortCodeLine", { v: esc(b.sortCode) })}<br>` : ""}${b.accountNumber ? t("p8fin.dcAccountLine", { v: esc(b.accountNumber) }) : ""}${payUrl ? `<div style="margin-top:10px"><a href="${esc(payUrl)}" style="display:inline-block;background:#1d3a8f;color:#fff;text-decoration:none;padding:9px 16px;border-radius:999px;font-weight:700">${t("p8fin.dcPayOnline")}</a></div>` : ""}</div>`
    : "";
  const footNote = [b.footer ? esc(b.footer) : "", companyReg].filter(Boolean).join(" · ");
  return `<div style="max-width:640px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#171534;font-size:14px;line-height:1.5">
    <div style="display:flex;justify-content:space-between;align-items:flex-start"><div>${logo}<div style="font-size:18px;font-weight:800">${business}</div><div style="color:#6b6880;font-size:12.5px;margin-top:2px">${addr}${addr && contact ? "<br>" : ""}${contact}${vat ? `<br>${vat}` : ""}</div></div><div style="text-align:end"><div style="font-size:20px;font-weight:800;color:#1d3a8f;letter-spacing:.04em">${title}</div></div></div>
    <div style="display:flex;justify-content:space-between;margin-top:18px;font-size:13px"><div style="color:#4a4763">${party}</div><div style="text-align:end;color:#4a4763">${meta}</div></div>
    <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px"><thead><tr style="text-align:start;color:#8a86a3;font-size:11px;text-transform:uppercase;letter-spacing:.05em">${isPo ? `<th style="padding:6px">${t("p8fin.dcColNo")}</th>` : ""}<th style="padding:6px">${t("p8fin.dcColDescription")}</th><th style="padding:6px;text-align:end">${t("p8fin.dcColQty")}</th><th style="padding:6px;text-align:end">${t("p8fin.dcColUnit")}</th><th style="padding:6px;text-align:end">${t("p8fin.dcColTotal")}</th></tr></thead><tbody>${rows}</tbody></table>
    ${totals}
    ${poComments}${deliverTo}${poPayMethod}
    ${bank}${terms}${poInstructions}${doc.notes ? `<div style="margin-top:14px;color:#6b6880;font-size:12.5px">${esc(doc.notes)}</div>` : ""}${poTerms}${footNote ? `<div style="margin-top:18px;border-top:1px solid #eee;padding-top:10px;color:#8a86a3;font-size:11.5px">${footNote}</div>` : ""}
  </div>`;
}

export function LineItemsEditor({ items, onChange }: { items: LineItem[]; onChange: (items: LineItem[]) => void }) {
  const t = useT();
  const set = (i: number, patch: Partial<LineItem>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const num = (v: string) => (v === "" ? 0 : Number(v));
  return (
    <div>
      <div className="mb-1 flex gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">
        <span className="flex-1">{t("p8fin.dcEdDescService")}</span><span className="w-14 text-end">{t("p8fin.dcColQty")}</span><span className="w-24 text-end">{t("p8fin.dcEdUnit")}</span><span className="w-20 text-end">{t("p8fin.dcColTotal")}</span><span className="w-5" />
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={it.description} onChange={(e) => set(i, { description: e.target.value })} placeholder={t("p8fin.dcEdPh")} className={`${fieldCls} flex-1`} />
            <input type="number" min="0" step="1" value={it.qty} onChange={(e) => set(i, { qty: num(e.target.value) })} className={`${fieldCls} w-14 text-end`} />
            <input type="number" min="0" step="0.01" value={it.unitPrice} onChange={(e) => set(i, { unitPrice: num(e.target.value) })} className={`${fieldCls} w-24 text-end`} />
            <span className="w-20 text-end text-[12.5px] font-bold tabular-nums">{gbp((it.qty || 0) * (it.unitPrice || 0))}</span>
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} disabled={items.length === 1} className="w-5 text-[15px] leading-none text-[var(--ink-3)] enabled:hover:text-[var(--red)] disabled:opacity-30" aria-label={t("p8fin.dcRemoveLine")}>×</button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <button type="button" onClick={() => onChange([...items, { description: "", qty: 1, unitPrice: 0 }])} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">{t("p8fin.dcAddLine")}</button>
        <div className="text-[13px]"><span className="text-[var(--ink-3)]">{t("p8fin.dcColTotal")} </span><b className="tabular-nums">{gbp(lineTotal(items))}</b></div>
      </div>
    </div>
  );
}

// Full-screen document preview with Print/Save-PDF, Email and (invoices) pay-link.
export type DocAction = { key: string; label: string; onClick: () => void; disabled?: boolean };
export function PrintableDoc({ kind, doc, billing, payUrl, actions, note, onClose }: { kind: "po" | "invoice" | "bill"; doc: Record<string, unknown>; billing?: Billing; payUrl?: string; actions?: DocAction[]; note?: string; onClose: () => void }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const html = docHtml(kind, doc, billing, payUrl);
  const fileName = `${kind === "po" ? "Purchase-order" : "Invoice"}${doc.reference ? `-${esc(doc.reference)}` : ""}`;
  const print = () => {
    const w = window.open("", "_blank", "width=820,height=1040");
    if (!w) return;
    // @page margin:0 + our own padding removes the browser's date/URL headers.
    w.document.write(`<html dir="${document.documentElement.dir || "ltr"}" lang="${document.documentElement.lang || "en"}"><head><title>${fileName}</title><style>@page{size:A4;margin:0}@media print{body{margin:0}}</style></head><body style="margin:0;padding:32px">${html}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };
  const copy = async () => { if (!payUrl) return; try { await navigator.clipboard.writeText(payUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* noop */ } };
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div data-ui="card" className="my-6 w-[min(720px,96vw)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={print} className="rounded-full bg-[#1d3a8f] px-3.5 py-2 text-[12.5px] font-extrabold text-white shadow-sm hover:brightness-110" title={t("p8fin.dcPrintTip")}>{t("p8fin.dcPrint")}</button>
          {actions?.map((a) => <button key={a.key} type="button" onClick={a.onClick} disabled={a.disabled} className="rounded-full border border-[var(--line)] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink)] hover:border-[var(--ink-3)] disabled:opacity-50">{a.label}</button>)}
          {payUrl && <button type="button" onClick={copy} className="rounded-full border border-[var(--line)] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[#1d3a8f] hover:border-[var(--ink-3)]">{copied ? t("p8fin.dcLinkCopied") : t("p8fin.dcCopyLink")}</button>}
          <button type="button" onClick={onClose} className="rounded-full border border-[var(--line)] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-3)]">{t("p8fin.dcClose")}</button>
        </div>
        {note && <div className="mb-2 rounded-lg bg-[#eaf0fc] px-3 py-1.5 text-center text-[12px] font-bold text-[#1d3a8f]">{note}</div>}
        <div className="mb-2 text-end text-[10.5px] text-white/85">{rich(t("p8fin.dcPdfTip"))}</div>
        <div className="rounded-xl bg-white p-6 shadow-[0_16px_40px_-16px_rgba(29,58,143,.45)]" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
