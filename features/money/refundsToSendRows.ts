// Pure helpers for the "Refunds to send" list (no React, so they can be unit-tested).

export interface RefundToSend { ref: string; name: string; listing: string; amount: number; since: string; method: string }

/** Whole days between the stamp and now (never negative). Pure, so it can be tested. */
export function daysWaiting(since: string, nowMs: number): number {
  const ms = Date.parse(since);
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.floor((nowMs - ms) / 86_400_000));
}
