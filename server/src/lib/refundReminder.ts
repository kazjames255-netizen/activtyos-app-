// Pure timing rule for the "refund to send" reminder (no database): kept apart from lib/sweeps.ts so it can be unit-tested.

/** A recorded offline refund the provider has not sent is first reminded about after this many days, then again every this many days. */
export const REFUND_REMIND_DAYS = 3;

/** Reminders stop after this many days (a refund left that long is stale data, and the first sweep after a deploy must not nag about years-old test rows).
 *  It still shows in Finance > Debts > Refunds to send. */
export const REFUND_REMIND_MAX_DAYS = 60;
/** At most this many reminders per sweep run, so a deploy can never produce a burst of bells and emails. */
export const REFUND_REMIND_MAX_PER_RUN = 25;

/** Which 3-day period a refund recorded at `createdAt` is in now (1, 2, 3 ...), or null while it is younger than 3 days, older than 60 days, or the stamp is unreadable.
 *  The reminder fires once per refund per period. */
export function refundReminderPeriod(createdAt: string, nowMs: number): number | null {
  const made = Date.parse(createdAt);
  if (!Number.isFinite(made)) return null;
  const days = (nowMs - made) / 86_400_000;
  return days >= REFUND_REMIND_DAYS && days <= REFUND_REMIND_MAX_DAYS ? Math.floor(days / REFUND_REMIND_DAYS) : null;
}
