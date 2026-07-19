// Browser-only half of the export. Kept apart from helpers.ts because the
// Express server compiles that file (mutations.ts imports it) and has no DOM
// lib — a `document` reference there breaks the API's typecheck, not the web
// app's, which is a confusing place to find the error.

import type { Booking } from "./types";
import { columnsFor, money, type Col } from "./helpers";

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Hands the file to the browser. No server round trip — the data is already here. */
export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * A printable table. Opened in a hidden iframe and sent to the print dialog,
 * where "Save as PDF" is one of the destinations on every modern browser —
 * so this is a PDF without shipping a PDF library, and it prints properly on
 * paper too, which a generated PDF often doesn't.
 */
export function printBookings(rows: Booking[], keys: string[], title: string, subtitle: string): void {
  printRows(rows, columnsFor(keys), title, subtitle, (b) => (typeof b.amount === "number" ? b.amount : 0));
}

/** The same, for anything with columns — families, and whatever comes next. */
export function printRows<T>(
  rows: T[],
  cols: Col<T>[],
  title: string,
  subtitle: string,
  amountOf?: (row: T) => number,
): void {
  const head = cols.map((c) => `<th${c.numeric ? ' class="n"' : ""}>${esc(c.label)}</th>`).join("");
  const body = rows
    .map(
      (b) =>
        `<tr>${cols.map((c) => `<td${c.numeric ? ' class="n"' : ""}>${esc(c.get(b))}</td>`).join("")}</tr>`,
    )
    .join("");
  const total = amountOf ? rows.reduce((s, r) => s + amountOf(r), 0) : 0;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font: 11px/1.4 -apple-system, "Hanken Grotesk", system-ui, sans-serif; color: #171534; margin: 0; }
    h1 { font-size: 17px; margin: 0 0 2px; }
    .sub { color: #6b7288; font-size: 11px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .06em;
         color: #6b7288; border-bottom: 1.5px solid #171534; padding: 6px 6px; }
    td { padding: 6px; border-bottom: 1px solid #e6e9f2; vertical-align: top;
         word-break: break-word; }
    .n { text-align: right; white-space: nowrap; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }   /* repeat the header on every page */
    tfoot td { border: 0; border-top: 1.5px solid #171534; font-weight: 800; padding-top: 8px; }
    .foot { margin-top: 10px; color: #8a93a8; font-size: 9.5px; }
  </style></head><body>
    <h1>${esc(title)}</h1>
    <div class="sub">${esc(subtitle)}</div>
    <table>
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
      ${
        amountOf && cols.some((c) => c.key === "amount")
          ? `<tfoot><tr><td colspan="${cols.length - 1}">Total — ${rows.length} booking${rows.length === 1 ? "" : "s"}</td><td class="n">${money(total)}</td></tr></tfoot>`
          : ""
      }
    </table>
    <div class="foot">Generated ${new Date().toLocaleString("en-GB")} · ActivityOS</div>
  </body></html>`;

  // An iframe rather than window.open: popup blockers eat the latter, and a
  // blocked print is indistinguishable from a broken button.
  //
  // It has to have a real size. A 0×0 iframe prints blank in Safari and
  // silently does nothing in some Chrome builds — so it's full-size and parked
  // off-screen instead of collapsed.
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1024px;height:800px;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const go = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    // Leave it long enough for the dialog to take a copy of the document.
    setTimeout(() => frame.remove(), 60_000);
  };
  if (frame.contentWindow?.document.readyState === "complete") go();
  else frame.onload = go;
}


