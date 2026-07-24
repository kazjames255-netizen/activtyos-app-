// Renders a purchase order or invoice as a self-contained HTML document — used
// for the email body (and mirrors the on-screen PDF the operator prints). All
// styles inline so it survives email clients. Provider + bank details come from
// tenant `settings.billing`.

type LineItem = { description?: string; qty?: number; unitPrice?: number };
type Doc = Record<string, unknown> & { amount?: number; lineItems?: LineItem[] };
type Billing = Record<string, unknown> | undefined;

const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
const money = (n: number) => `£${(Math.round((n || 0) * 100) / 100).toFixed(2)}`;
const fmtDay = (iso?: unknown) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

export function renderMoneyDoc(kind: "po" | "invoice", doc: Doc, billing: Billing, payUrl?: string): string {
  const b = billing ?? {};
  const business = esc(b.businessName || "Your business");
  const addr = Array.isArray(b.addressLines) ? (b.addressLines as string[]).map(esc).join("<br>") : esc(b.address || "");
  const contact = [b.email, b.phone].filter(Boolean).map(esc).join(" · ");
  const vat = b.vatNumber ? `VAT ${esc(b.vatNumber)}` : "";

  const title = kind === "po" ? "PURCHASE ORDER" : "INVOICE";
  const party = kind === "po"
    ? `<b>To</b><br>${esc(doc.supplier)}${doc.supplierEmail ? `<br>${esc(doc.supplierEmail)}` : ""}`
    : `<b>Bill to</b><br>${esc(doc.customerName)}${doc.customerEmail ? `<br>${esc(doc.customerEmail)}` : ""}${doc.bookingRef ? `<br>Booking ${esc(doc.bookingRef)}` : ""}`;
  const ref = kind === "po" ? doc.reference : doc.reference;

  const items: LineItem[] = Array.isArray(doc.lineItems) && doc.lineItems.length
    ? doc.lineItems
    : [{ description: (doc.description as string) || (doc.notes as string) || "Amount", qty: 1, unitPrice: doc.amount ?? 0 }];
  const rows = items.map((li) => {
    const lineTotal = (li.qty ?? 1) * (li.unitPrice ?? 0);
    return `<tr><td style="padding:8px 6px;border-bottom:1px solid #eee">${esc(li.description)}</td><td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">${li.qty ?? 1}</td><td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">${money(li.unitPrice ?? 0)}</td><td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right"><b>${money(lineTotal)}</b></td></tr>`;
  }).join("");
  const total = items.reduce((s, li) => s + (li.qty ?? 1) * (li.unitPrice ?? 0), 0);

  const bankBlock = kind === "invoice" && (b.bankName || b.accountNumber)
    ? `<div style="margin-top:16px;padding:12px 14px;background:#f6f8fc;border-radius:10px;font-size:13px">
         <div style="font-weight:700;color:#1d3a8f;margin-bottom:4px">How to pay</div>
         ${b.bankName ? `Bank: ${esc(b.bankName)}<br>` : ""}${b.accountName ? `Name: ${esc(b.accountName)}<br>` : ""}${b.sortCode ? `Sort code: ${esc(b.sortCode)}<br>` : ""}${b.accountNumber ? `Account: ${esc(b.accountNumber)}` : ""}
         ${payUrl ? `<div style="margin-top:10px"><a href="${esc(payUrl)}" style="display:inline-block;background:#1d3a8f;color:#fff;text-decoration:none;padding:9px 16px;border-radius:999px;font-weight:700">Pay online</a></div>` : ""}
       </div>` : "";

  return `<div style="max-width:640px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#171534;font-size:14px;line-height:1.5">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><div style="font-size:18px;font-weight:800">${business}</div><div style="color:#6b6880;font-size:12.5px;margin-top:2px">${addr}${addr && contact ? "<br>" : ""}${contact}${vat ? `<br>${vat}` : ""}</div></div>
      <div style="text-align:right"><div style="font-size:20px;font-weight:800;color:#1d3a8f;letter-spacing:.04em">${title}</div>${ref ? `<div style="color:#6b6880;font-size:12.5px">${esc(ref)}</div>` : ""}</div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:18px;font-size:13px">
      <div style="color:#4a4763">${party}</div>
      <div style="text-align:right;color:#4a4763">${doc.date ? `Date: ${fmtDay(doc.date)}<br>` : ""}${doc.dueDate ? `Due: ${fmtDay(doc.dueDate)}` : ""}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px">
      <thead><tr style="text-align:left;color:#8a86a3;font-size:11px;text-transform:uppercase;letter-spacing:.05em"><th style="padding:6px">Description</th><th style="padding:6px;text-align:right">Qty</th><th style="padding:6px;text-align:right">Unit</th><th style="padding:6px;text-align:right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="text-align:right;margin-top:12px;font-size:16px"><span style="color:#8a86a3;font-size:13px">Total </span><b>${money(total)}</b></div>
    ${bankBlock}
    ${doc.notes ? `<div style="margin-top:14px;color:#6b6880;font-size:12.5px">${esc(doc.notes)}</div>` : ""}
    ${b.footer ? `<div style="margin-top:18px;border-top:1px solid #eee;padding-top:10px;color:#8a86a3;font-size:11.5px">${esc(b.footer)}</div>` : ""}
  </div>`;
}
