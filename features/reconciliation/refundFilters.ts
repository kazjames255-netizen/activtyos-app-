// Pure rules for the Reconciliation screen's refund filters (no React, no server): one place decides which rows, tab counts and refund-panel lines are
// visible, so the list, the "N shown" counter, the method tab counts and the Refunds panel always agree.

export type RefundState = "none" | "part" | "full" | "awaiting";
export type StatusFilter = "all" | "awaiting" | "reconciled" | "refunded";

/** The bits of a ledger row the filters read (the screen's Item satisfies this). */
export interface FilterItem {
  ref: string;
  method: string;
  pay: string;
  voucherScheme: string | null;
  reconciled: boolean;
  listingId: string | null;
  date: string;
  /** Server: how this booking's money went back. "awaiting" = a bank/offline refund recorded but not yet transferred. */
  refundState?: RefundState;
  /** Server: true when the booking is on the list ONLY because it was refunded (cancelled / card): it is not a payment to reconcile. */
  refundedOnly?: boolean;
}

export interface FilterRefundRow { ref: string; method: string; listingId: string | null; date: string | null; amount: number }

// Bucket a booking's payment route into a tidy category for the tabs (the same rule the screen has always used).
export function methodCat(it: { method: string; voucherScheme: string | null; pay: string }): string {
  const m = (it.method || "").toLowerCase();
  if (/tax.?free|tfc/.test(m) || /tax.?free|\btfc\b/i.test(it.voucherScheme || "")) return "Tax-Free Childcare";
  if (it.voucherScheme || /voucher/.test(m)) return "Childcare vouchers";
  if (/cash/.test(m)) return "Cash";
  if (/bank|transfer/.test(m)) return "Bank transfer";
  if (/haf|funded/.test(m) || it.pay === "Funded") return "HAF / funded";
  if (/card/.test(m)) return "Card";
  return it.method || "Other";
}

/** A refund row only carries the method text ("Card", "Bank transfer", "Voucher · Edenred"): same buckets. */
export function refundCat(method: string): string {
  return methodCat({ method: /^voucher/i.test(method) ? "Childcare vouchers" : method, voucherScheme: null, pay: "" });
}

export const isRefunded = (it: Pick<FilterItem, "refundState">) => (it.refundState ?? "none") !== "none";

export interface Opts { cat: string; status: StatusFilter; hideRefunded: boolean; voucherSub?: string; listingId?: string; seasonId?: string; from?: string; to?: string }

/** Refund visibility alone: the "Hide refunded" toggle, and a refunded-only booking is never a payment to reconcile. */
export function refundVisible(it: FilterItem, status: StatusFilter, hideRefunded: boolean): boolean {
  if (hideRefunded && isRefunded(it)) return false;
  if (it.refundedOnly && !(status === "all" || status === "refunded")) return false;
  return true;
}

/** The ledger list: every existing filter plus the refund rules. */
export function filterItems<T extends FilterItem>(items: T[], o: Opts, listingSeason: Record<string, string> = {}): T[] {
  return items.filter((it) => {
    if (!refundVisible(it, o.status, o.hideRefunded)) return false;
    if (o.cat !== "All" && methodCat(it) !== o.cat) return false;
    if (o.cat === "Childcare vouchers" && o.voucherSub && it.voucherScheme !== o.voucherSub) return false;
    if (o.status === "awaiting" && (it.reconciled || it.refundedOnly)) return false;
    if (o.status === "reconciled" && (!it.reconciled || it.refundedOnly)) return false;
    if (o.status === "refunded" && !isRefunded(it)) return false;
    if (o.listingId && it.listingId !== o.listingId) return false;
    if (o.seasonId && (it.listingId ? listingSeason[it.listingId] : "") !== o.seasonId) return false;
    if (o.from && (!it.date || it.date < o.from)) return false;
    if (o.to && (!it.date || it.date > o.to)) return false;
    return true;
  });
}

/** Method-tab counts: follow the Hide refunded toggle (and never count a row the status filter would hide anyway). */
export function catCountsOf<T extends FilterItem>(items: T[], status: StatusFilter, hideRefunded: boolean): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    if (!refundVisible(it, status, hideRefunded)) continue;
    const c = methodCat(it);
    m.set(c, (m.get(c) ?? 0) + 1);
  }
  return m;
}

/**
 * The Refunds panel's rows. They follow the SAME hide rule and the tab / listing / season / date filters as the list, so a refund of a booking that is
 * hidden never shows in the panel. (The status chips Awaiting / Reconciled describe the payment ledger, not refunds, so they do not hide the panel.)
 */
export function refundPanelRows<R extends FilterRefundRow>(rows: R[], items: FilterItem[], o: Opts, listingSeason: Record<string, string> = {}): R[] {
  if (o.hideRefunded) return [];
  const byRef = new Map(items.map((i) => [i.ref, i]));
  return rows.filter((r) => {
    const it = byRef.get(r.ref);
    const cat = it ? methodCat(it) : refundCat(r.method);
    if (o.cat !== "All" && cat !== o.cat) return false;
    if (o.cat === "Childcare vouchers" && o.voucherSub && it && it.voucherScheme !== o.voucherSub) return false;
    const listingId = it ? it.listingId : r.listingId;
    if (o.listingId && listingId !== o.listingId) return false;
    if (o.seasonId && (listingId ? listingSeason[listingId] : "") !== o.seasonId) return false;
    if (o.from && (!r.date || r.date < o.from)) return false;
    if (o.to && (!r.date || r.date > o.to)) return false;
    return true;
  });
}

export const sumRefunds = (rows: { amount: number }[]) => Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;

/** The Refunds filter state in the page URL: ?status=refunded&hideRefunded=1 (everything else is untouched). */
export function parseFilterParams(search: string): { status?: StatusFilter; hideRefunded?: boolean } {
  const p = new URLSearchParams(search);
  const s = p.get("status");
  const out: { status?: StatusFilter; hideRefunded?: boolean } = {};
  if (s === "all" || s === "awaiting" || s === "reconciled" || s === "refunded") out.status = s;
  if (p.get("hideRefunded") === "1") out.hideRefunded = true;
  return out;
}

/** Writes the two params into a query string (the default status "awaiting" and hideRefunded=false are left out to keep URLs clean). */
export function withFilterParams(search: string, status: StatusFilter, hideRefunded: boolean): string {
  const p = new URLSearchParams(search);
  if (status === "awaiting") p.delete("status"); else p.set("status", status);
  if (hideRefunded) p.set("hideRefunded", "1"); else p.delete("hideRefunded");
  const s = p.toString();
  return s ? `?${s}` : "";
}
