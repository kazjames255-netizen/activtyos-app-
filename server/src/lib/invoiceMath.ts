// Pure invoice maths (routes/invoices.ts), lifted out for testing. Unchanged.
export const round2 = (n: number) => Math.round(n * 100) / 100;
export interface LineItem { description: string; qty: number; unitPrice: number }
export const subtotalOf = (lineItems: LineItem[] | undefined, fallback: number | undefined) =>
  lineItems && lineItems.length ? round2(lineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0)) : round2(fallback ?? 0);
// The stored amount is the grand total (subtotal + VAT), so analytics stay right.
export const grandTotal = (lineItems: LineItem[] | undefined, fallback: number | undefined, taxRate: number | undefined) =>
  round2(subtotalOf(lineItems, fallback) * (1 + (taxRate ?? 0) / 100));

export const OWED = new Set(["sent"]); // sent-but-unpaid is money still to collect
export const isOverdue = (p: { status?: string; dueDate?: string }, today: string) =>
  OWED.has(p.status ?? "") && !!p.dueDate && p.dueDate < today;

/** Emailing an invoice moves a draft to "sent"; every other status is left alone (undefined = no change). */
export const statusAfterEmail = (status: string | undefined): string | undefined => (status === "draft" ? "sent" : undefined);

export function invoiceSummary(list: { status?: string; amount?: number; date?: string; dueDate?: string }[], today: string) {
  const thisYear = today.slice(0, 4);
  return {
    count: list.length,
    outstanding: round2(list.filter((p) => OWED.has(p.status ?? "")).reduce((s, p) => s + (p.amount ?? 0), 0)),
    collected: round2(list.filter((p) => p.status === "paid" && (p.date ?? "").slice(0, 4) === thisYear).reduce((s, p) => s + (p.amount ?? 0), 0)),
    overdue: list.filter((p) => isOverdue(p, today)).length,
  };
}
