// The "All income" ledger rows, built once so the list, the totals line, the CSV and the regression test all use the same rule.
// Pure (no React, no fetch). A booking that RECEIVED money gets a row even when it was refunded back to £0, so the list explains
// the Refunded figure in the tiles instead of silently dropping those bookings.
import { bookingNetIn, bookingRefundOwed, isStandaloneInvoiceIn, round2, ukDay } from "./bookingIncome";
import type { Booking } from "../bookings/types";

/** How a booking's refund stands. awaiting = a bank/cash refund recorded but not yet transferred; owed = agreed with the family, not sent. */
export type RefundState = "none" | "part" | "full" | "awaiting" | "owed";
export type ShowFilter = "all" | "received" | "refunded" | "awaiting";
export const SHOW_FILTERS: ShowFilter[] = ["all", "received", "refunded", "awaiting"];

export interface BookingMoney {
  got: number;
  back: number;
  net: number;
  owed: number;
  state: RefundState;
  /** UK day (YYYY-MM-DD) the refund was given, when known. */
  refundedOn: string;
}

/** The refund date out of a booking: ISO stamps and the en-GB "13/09/2026, 10:30" that refund-log entries carry. */
export function refundDateOf(b: Booking): string {
  const stamps: string[] = [];
  const c = b.cancel as { refundedAt?: string } | undefined;
  if (c?.refundedAt) stamps.push(c.refundedAt);
  for (const x of b.refundLog ?? []) if (x.on) stamps.push(x.on);
  const days = stamps.map((s) => {
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return ukDay(s);
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
    return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
  }).filter(Boolean).sort();
  return days[days.length - 1] ?? "";
}

/** Has the provider confirmed they sent an offline refund? Tolerant of the field names the "I've sent the refund" action may use. */
export function offlineRefundSent(b: Booking): boolean {
  const c = (b.cancel ?? {}) as Record<string, unknown>;
  return !!(c.refundSentAt || c.sentAt || c.transferredAt || c.refundSent === true || c.refundTransferred === true);
}

/** null when the booking never received money (nothing to list). */
export function bookingMoney(b: Booking): BookingMoney | null {
  const { got, back, net } = bookingNetIn(b);
  if (got <= 0.004) return null;
  const owed = bookingRefundOwed(b);
  const offline = (b.cancel as { refundVia?: string } | undefined)?.refundVia === "offline";
  let state: RefundState = "none";
  if (back > 0.004 && offline && !offlineRefundSent(b)) state = "awaiting";
  else if (owed > 0.004) state = "owed";
  else if (back > 0.004) state = back >= got - 0.005 ? "full" : "part";
  return { got: round2(got), back: round2(back), net: round2(net), owed: round2(owed), state, refundedOn: back > 0.004 ? refundDateOf(b) : "" };
}

export interface LedgerRow {
  id: string;
  date: string;
  category: string;
  /** NET of refunds: the figure every tile uses. */
  amount: number;
  received: number;
  refunded: number;
  money?: BookingMoney;
}

/** Does a row belong under the Show filter? Non-booking rows (invoices, logged income) are only ever "received". */
export function matchesShow(r: Pick<LedgerRow, "money" | "amount">, show: ShowFilter): boolean {
  if (show === "all") return true;
  const m = r.money;
  if (show === "received") return !m || m.net > 0.004;
  if (show === "refunded") return !!m && m.back > 0.004;
  return !!m && (m.state === "awaiting" || m.state === "owed");
}

export function sumRows(rows: Pick<LedgerRow, "amount" | "received" | "refunded">[]) {
  const net = round2(rows.reduce((s, r) => s + r.amount, 0));
  const received = round2(rows.reduce((s, r) => s + r.received, 0));
  const refunded = round2(rows.reduce((s, r) => s + r.refunded, 0));
  return { net, received, refunded };
}

export const REFUND_STATE_CSV: Record<RefundState, string> = { none: "Paid", part: "Part refunded", full: "Refunded", awaiting: "Refund awaiting transfer", owed: "Refund owed" };

/** Every ledger row the All income list can show (no UI filters applied): bookings that received money (including fully refunded ones),
 *  standalone paid invoices, and logged income. The sum of `amount` is exactly what the Money in tiles call "after refunds". */
export function buildLedger(input: {
  bookings: Booking[];
  invoices: { id: string; status?: string; bookingSettledAt?: string; amount?: number; paidAt?: string; date?: string }[];
  logged: { id: string; date: string; category: string; amount: number }[];
}): LedgerRow[] {
  const rows: LedgerRow[] = [];
  for (const b of input.bookings) {
    const m = bookingMoney(b);
    if (!m) continue;
    rows.push({ id: `bk-${b.ref}`, date: ukDay(b.createdAt || ""), category: "Bookings", amount: m.net, received: m.got, refunded: m.back, money: m });
  }
  for (const v of input.invoices) {
    if (!isStandaloneInvoiceIn(v)) continue;
    const a = round2(v.amount ?? 0);
    rows.push({ id: `inv-${v.id}`, date: ukDay(v.paidAt || v.date || ""), category: "Invoices", amount: a, received: a, refunded: 0 });
  }
  for (const x of input.logged) rows.push({ id: x.id, date: x.date, category: x.category, amount: round2(x.amount), received: round2(x.amount), refunded: 0 });
  return rows;
}
