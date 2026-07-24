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

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const logo = b.logoUrl ? `<img src="${esc(b.logoUrl)}" alt="" style="max-height:56px;max-width:200px;margin-bottom:6px"/>` : "";
  const companyReg = b.companyReg ? `Company reg. ${esc(b.companyReg)}` : "";
  const title = kind === "po" ? "PURCHASE ORDER" : "INVOICE";
  const partyName = kind === "po" ? doc.supplier : doc.customerName;
  const partyEmail = kind === "po" ? doc.supplierEmail : doc.customerEmail;
  const party = `<b>${kind === "po" ? "To" : "Bill to"}</b><br>${esc(partyName)}${doc.customerAddress ? `<br>${esc(doc.customerAddress).replace(/\n/g, "<br>")}` : ""}${partyEmail ? `<br>${esc(partyEmail)}` : ""}${doc.bookingRef ? `<br>Booking ${esc(doc.bookingRef)}` : ""}`;
  const meta = [
    doc.reference ? `${kind === "po" ? "PO" : "Invoice"} No: ${esc(doc.reference)}` : "",
    doc.date ? `Date: ${fmtDay(doc.date)}` : "",
    doc.dueDate ? `Due: ${fmtDay(doc.dueDate)}` : "",
    doc.poNumber ? `Purchase Order No: ${esc(doc.poNumber)}` : "",
    doc.accountRef ? `Account Ref: ${esc(doc.accountRef)}` : "",
  ].filter(Boolean).join("<br>");

  const items: LineItem[] = Array.isArray(doc.lineItems) && doc.lineItems.length
    ? doc.lineItems
    : [{ description: (doc.description as string) || (doc.notes as string) || "Amount", qty: 1, unitPrice: doc.amount ?? 0 }];
  const rows = items.map((li) => {
    const lineTotal = (li.qty ?? 1) * (li.unitPrice ?? 0);
    return `<tr><td style="padding:8px 6px;border-bottom:1px solid #eee">${esc(li.description)}</td><td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">${li.qty ?? 1}</td><td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right">${money(li.unitPrice ?? 0)}</td><td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right"><b>${money(lineTotal)}</b></td></tr>`;
  }).join("");
  const subtotal = r2(items.reduce((s, li) => s + (li.qty ?? 1) * (li.unitPrice ?? 0), 0));
  const rate = Number(doc.taxRate) || 0;
  const tax = r2(subtotal * rate / 100);
  const totalsBlock = rate > 0
    ? `<div style="text-align:right;margin-top:12px;font-size:13px;color:#4a4763"><div>Subtotal: ${money(subtotal)}</div><div>VAT (${rate}%): ${money(tax)}</div><div style="font-size:16px;margin-top:4px;color:#171534"><span style="color:#8a86a3;font-size:13px">Total </span><b>${money(r2(subtotal + tax))}</b></div></div>`
    : `<div style="text-align:right;margin-top:12px;font-size:16px"><span style="color:#8a86a3;font-size:13px">Total </span><b>${money(subtotal)}</b></div>`;

  const bankBlock = kind === "invoice" && (b.bankName || b.accountNumber)
    ? `<div style="margin-top:16px;padding:12px 14px;background:#f6f8fc;border-radius:10px;font-size:13px">
         <div style="font-weight:700;color:#1d3a8f;margin-bottom:4px">How to pay</div>
         ${b.bankName ? `Bank: ${esc(b.bankName)}<br>` : ""}${b.accountName ? `Name: ${esc(b.accountName)}<br>` : ""}${b.sortCode ? `Sort code: ${esc(b.sortCode)}<br>` : ""}${b.accountNumber ? `Account: ${esc(b.accountNumber)}` : ""}
         ${payUrl ? `<div style="margin-top:10px"><a href="${esc(payUrl)}" style="display:inline-block;background:#1d3a8f;color:#fff;text-decoration:none;padding:9px 16px;border-radius:999px;font-weight:700">Pay online</a></div>` : ""}
       </div>` : "";
  const footNote = [b.footer ? esc(b.footer) : "", companyReg].filter(Boolean).join(" · ");

  return `<div style="max-width:640px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#171534;font-size:14px;line-height:1.5">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>${logo}<div style="font-size:18px;font-weight:800">${business}</div><div style="color:#6b6880;font-size:12.5px;margin-top:2px">${addr}${addr && contact ? "<br>" : ""}${contact}${vat ? `<br>${vat}` : ""}</div></div>
      <div style="text-align:right"><div style="font-size:20px;font-weight:800;color:#1d3a8f;letter-spacing:.04em">${title}</div></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:18px;font-size:13px">
      <div style="color:#4a4763">${party}</div>
      <div style="text-align:right;color:#4a4763">${meta}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px">
      <thead><tr style="text-align:left;color:#8a86a3;font-size:11px;text-transform:uppercase;letter-spacing:.05em"><th style="padding:6px">Description</th><th style="padding:6px;text-align:right">Qty</th><th style="padding:6px;text-align:right">Unit</th><th style="padding:6px;text-align:right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${totalsBlock}
    ${bankBlock}
    ${doc.notes ? `<div style="margin-top:14px;color:#6b6880;font-size:12.5px">${esc(doc.notes)}</div>` : ""}
    ${footNote ? `<div style="margin-top:18px;border-top:1px solid #eee;padding-top:10px;color:#8a86a3;font-size:11.5px">${footNote}</div>` : ""}
  </div>`;
}
