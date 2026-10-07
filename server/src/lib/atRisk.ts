// Pure churn-risk classification for the HQ At-risk list. No Firestore here so it is unit-testable.
export const QUIET_DAYS = 45, LAUNCH_GRACE = 14, TRIAL_SOON = 3;
const DAY = 86_400_000;

export interface RiskInput {
  status: string;
  createdAt?: string;
  trialEndsAt?: string;
  cancelAt?: string;
  /** ms timestamp of the tenant's latest booking; undefined = never booked. */
  lastBooking?: number;
}

/** Statuses the list considers at all. */
export function isWatchedStatus(status: string): boolean {
  return ["active", "trialing", "canceling", "past_due"].includes(status);
}

/** Reason decided by subscription state alone (no booking history needed), else null. */
export function stateReason(i: RiskInput, now: number): { reason: string; detail: string } | null {
  const trialLeft = i.trialEndsAt ? (Date.parse(i.trialEndsAt) - now) / DAY : Infinity;
  if (i.status === "past_due") return { reason: "payment_failed", detail: "Card payment failed" };
  if (i.status === "canceling") return { reason: "cancelling", detail: `Cancels ${i.cancelAt ? new Date(i.cancelAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "soon"}` };
  if (i.status === "trialing" && trialLeft <= TRIAL_SOON) return { reason: "trial_ending", detail: `Trial ends in ${Math.max(0, Math.round(trialLeft))}d` };
  return null;
}

/** Full classification. Call stateReason first and only look up bookings when it returns null. */
export function classifyRisk(i: RiskInput, now: number): { reason: string; detail: string } | null {
  const s = stateReason(i, now);
  if (s) return s;
  const lb = i.lastBooking;
  const ageDays = i.createdAt ? (now - Date.parse(i.createdAt)) / DAY : 0;
  const daysSince = lb ? Math.round((now - lb) / DAY) : null;
  if (lb === undefined && ageDays > LAUNCH_GRACE) return { reason: "never_launched", detail: "No bookings taken yet" };
  if (daysSince != null && daysSince > QUIET_DAYS) return { reason: "quiet", detail: `No bookings in ${daysSince}d` };
  return null;
}

/** Run `fn` over items with at most `limit` in flight; results in input order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const k = next++; out[k] = await fn(items[k]); }
  }));
  return out;
}
