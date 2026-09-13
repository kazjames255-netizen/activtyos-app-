// CSV helpers shared by every spreadsheet export.
//
// Two jobs per cell. Quote anything containing a comma, quote or line break
// (doubling inner quotes) so the file parses; and neutralise a leading =, +,
// -, @, tab or CR, which Excel / Sheets / Numbers treat as the start of a
// formula. Exports carry text other people typed — a family's name, a
// supplier, a booking note — so "=HYPERLINK(…)" in a cell would otherwise run
// as a live formula in the provider's spreadsheet (quoting alone doesn't stop
// that). The fix is the OWASP one: prefix with an apostrophe, which the
// spreadsheet shows as plain text.
//
// Real numbers are left alone so money columns still sum: a JS number can't
// be a formula, and neither can a plain numeric string like "-12.50".

const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^[-+]?\d+(\.\d+)?$/;

/** One CSV cell, formula-safe. Numbers stay numeric; null/undefined → "". */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "number" ? (Number.isFinite(v) ? String(v) : "") : String(v);
  if (typeof v !== "number" && FORMULA_START.test(s) && !PLAIN_NUMBER.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows (header first) to CSV text, every cell through csvCell. */
export function csvText(rows: unknown[][], eol = "\n"): string {
  return rows.map((r) => r.map(csvCell).join(",")).join(eol);
}
