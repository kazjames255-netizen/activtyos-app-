// "Resend invoice" bookkeeping, pure so it can be tested: how many times the payment link / invoice email has been re-sent, and when.

/** One re-send per booking every 30 seconds: a double click must not mail the family twice. */
export const RESEND_COOLDOWN_MS = 30_000;

export interface InvoiceResends { count: number; lastAt: string; lastBy?: string }

/** The record after one more re-send. */
export function nextInvoiceResends(prev: InvoiceResends | undefined, nowIso: string, by?: string): InvoiceResends {
  return { count: (prev?.count ?? 0) + 1, lastAt: nowIso, ...(by ? { lastBy: by } : {}) };
}

/** Seconds still to wait before the next re-send is allowed (0 = allowed now). */
export function resendWaitSeconds(prev: InvoiceResends | undefined, nowMs: number): number {
  const last = prev?.lastAt ? Date.parse(prev.lastAt) : 0;
  if (!last) return 0;
  return Math.max(0, Math.ceil((RESEND_COOLDOWN_MS - (nowMs - last)) / 1000));
}

/**
 * ONE reminders log per booking, shared by "Resend invoice", "Chase" (the nudge) and the automatic payment-due reminder, so the counts can never
 * contradict each other. The legacy Reconciliation fields (nudges / lastNudgedAt) are kept in step: the bell there reads them.
 */
export function remindersPatch(b: { invoiceResends?: InvoiceResends; invoiceSentAt?: string; createdAt?: string }, nowIso: string, by: string): {
  invoiceResends: InvoiceResends; nudges: number; lastNudgedAt: string; invoiceSentAt: string;
} {
  const inv = nextInvoiceResends(b.invoiceResends, nowIso, by);
  return { invoiceResends: inv, nudges: inv.count, lastNudgedAt: inv.lastAt, invoiceSentAt: b.invoiceSentAt ?? b.createdAt ?? nowIso };
}

/** "7 Oct 2026" for the reminder line in the email (UK date). */
export function reminderDateLabel(iso: string | undefined): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
}
