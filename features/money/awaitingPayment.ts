import { owedNow } from "../bookings/helpers";
import type { Booking } from "../bookings/types";

// Money in -> "Awaiting payment". Pure (no database, no React) so the list, the total and the empty-state decision can be regression-tested.
//
// Two lists share one panel:
//   (a) formal CUSTOMER INVOICES that were sent and are unpaid (the invoices collection), and
//   (b) BOOKINGS that hold a place, still owe money AND have a payment request out (an invoice / payment link was emailed or a reminder sent).
// A booking that is also covered by a sent invoice (invoice.reference = the booking ref) appears ONCE, as the invoice. The panel must never
// say "all paid up" while money is owed anywhere: Finance's "Owed to you" uses the same owedNow rule over EVERY booking.

export interface AwaitingInvoice {
  id: string;
  customerName: string;
  reference?: string;
  amount: number;
  dueDate?: string;
  status: string;
  overdue?: boolean;
}

/** A booking plus the optional reminder log fork AF adds (reminders / invoiceResends); both are read tolerantly. */
export type AwaitingBookingIn = Booking & {
  reminders?: { count?: number; lastAt?: string } | null;
  invoiceResends?: { count?: number; lastAt?: string } | null;
};

export interface AwaitingRow {
  kind: "invoice" | "booking";
  id: string;
  name: string;
  /** Invoice reference, or the booking ref. */
  reference?: string;
  /** Booking ref when the row is (or is backed by) a booking: Chase / View act on it. */
  bookingRef?: string;
  listing?: string;
  amount: number;
  dueDate?: string;
  overdue?: boolean;
  /** When the payment request was last sent (ISO), if known. */
  sentAt?: string;
  /** How many reminders have gone out after the first request, if known. */
  reminders?: number;
}

export type AwaitingEmpty = "list" | "owedNoRequest" | "paidUp";

export interface AwaitingResult {
  rows: AwaitingRow[];
  invoiceTotal: number;
  bookingTotal: number;
  /** The panel's header total: sent invoices + bookings with a payment request out. */
  total: number;
  /** Money owed on bookings that are NOT in the list (no payment request out yet): Finance's "Owed to you" minus what the list already shows. */
  notRequestedOwed: number;
  /** Finance's "Owed to you": owedNow over every booking. */
  owedAll: number;
  empty: AwaitingEmpty;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** How many reminders / resends are on record for a booking (the unified log first, then the older nudge counter). */
export function reminderCount(b: AwaitingBookingIn): number {
  return Math.max(b.reminders?.count ?? 0, b.invoiceResends?.count ?? 0, b.nudges ?? 0, 0);
}

/** When the last reminder / resend went out, if recorded. */
export function lastReminderAt(b: AwaitingBookingIn): string | undefined {
  const all = [b.reminders?.lastAt, b.invoiceResends?.lastAt, b.lastNudgedAt].filter((x): x is string => !!x).sort();
  return all.length ? all[all.length - 1] : undefined;
}

/** Has a payment request gone out for this booking? An invoice / payment link was emailed (pay "Invoice sent") or a reminder was recorded. */
export function paymentRequestOut(b: AwaitingBookingIn): boolean {
  return b.pay === "Invoice sent" || reminderCount(b) > 0 || !!lastReminderAt(b);
}

export function buildAwaiting(invoices: AwaitingInvoice[], bookings: AwaitingBookingIn[]): AwaitingResult {
  const sent = invoices.filter((v) => v.status === "sent");
  const invoiceRefs = new Set(sent.map((v) => (v.reference ?? "").trim()).filter(Boolean));

  const rows: AwaitingRow[] = sent.map((v) => ({
    kind: "invoice", id: `inv-${v.id}`, name: v.customerName, reference: v.reference, ...(v.reference ? { bookingRef: v.reference } : {}),
    amount: v.amount ?? 0, dueDate: v.dueDate, overdue: v.overdue,
  }));

  let owedAll = 0;
  let coveredOwed = 0;
  for (const b of bookings) {
    const owed = round2(owedNow(b));
    if (owed <= 0.005) continue;
    owedAll += owed;
    if (invoiceRefs.has(b.ref)) { coveredOwed += owed; continue; } // already listed once, as its invoice
    if (!paymentRequestOut(b)) continue;
    const n = reminderCount(b);
    rows.push({
      kind: "booking", id: `bk-${b.ref}`, name: b.booker || b.email || "—", reference: b.ref, bookingRef: b.ref, listing: b.listing,
      amount: owed, sentAt: lastReminderAt(b) || b.createdAt, reminders: n > 0 ? n : undefined,
    });
    coveredOwed += owed;
  }

  rows.sort((a, b) => b.amount - a.amount);
  const invoiceTotal = round2(rows.filter((r) => r.kind === "invoice").reduce((s, r) => s + r.amount, 0));
  const bookingTotal = round2(rows.filter((r) => r.kind === "booking").reduce((s, r) => s + r.amount, 0));
  owedAll = round2(owedAll);
  const notRequestedOwed = Math.max(0, round2(owedAll - coveredOwed));
  const empty: AwaitingEmpty = rows.length > 0 ? "list" : owedAll > 0.005 ? "owedNoRequest" : "paidUp";
  return { rows, invoiceTotal, bookingTotal, total: round2(invoiceTotal + bookingTotal), notRequestedOwed, owedAll, empty };
}
