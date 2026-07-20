// ─────────────────────────────────────────────────────────────────────────
// When a voucher payment has to arrive — and whether it can at all.
//
// The provider sets one hold period, but that number alone is wrong the
// moment a camp is close. "Your place is held for 7 days" on a booking for a
// camp starting tomorrow promises something impossible twice over: the place
// can't be held past the day it runs, and voucher money doesn't move that
// fast anyway.
//
// So the deadline is the earlier of the two, and if there isn't time for the
// money to clear, what happens is the provider's choice — hide the option,
// warn and allow it, hold it for approval, or carry on regardless. This file
// works out the facts; it doesn't decide the policy.
//
// Pure, no React: the email and any chase job need the same answer.
// ─────────────────────────────────────────────────────────────────────────

const DAY = 86_400_000;

/** What a provider does when a booking is too close for the money to land. */
export type WhenTooClose =
  /** Don't offer vouchers at all, and say why. */
  | "hide"
  /** Offer them, with a clear caution that the place may not be held. */
  | "warn"
  /** Offer them, but the booking waits for the provider to accept it. */
  | "approve"
  /** No special handling — treat it like any other voucher booking. */
  | "normal";

export interface VoucherWindow {
  /**
   * There isn't time for the money to arrive by the day it's needed. What
   * happens next is the provider's choice, not this function's.
   */
  tooClose: boolean;
  /**
   * The day the parent must SEND it — the date they're shown. Earlier than
   * receiveBy, because voucher money spends days in transit.
   */
  sendBy: string | null;
  /** The day the money must be WITH the provider. */
  receiveBy: string | null;
  /** Days from now until sendBy. */
  daysToPay: number;
  /** "it starts tomorrow" — for explaining the situation to the parent. */
  closeReason: string | null;
}

/** Whether the option appears at all, given the provider's rule. */
export const offerVouchers = (mode: WhenTooClose, w: VoucherWindow): boolean =>
  !w.tooClose || mode !== "hide";

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * @param firstSessionIso the earliest day they're booked in, if known
 * @param holdDays        how long the provider holds an unpaid place
 * @param clearDays       how long voucher money takes to reach them
 * @param dueByDays       how many days before the first session the money
 *                        must have arrived. 0 = by the day it starts.
 */
export function voucherWindow(
  nowIso: string,
  firstSessionIso: string | undefined,
  holdDays: number,
  clearDays: number,
  dueByDays = 0,
): VoucherWindow {
  const now = Date.parse(nowIso);
  if (Number.isNaN(now)) return { tooClose: true, sendBy: null, receiveBy: null, daysToPay: 0, closeReason: null };

  const holdEnds = now + holdDays * DAY;

  // No dated session — a free-text or open-ended booking. Nothing to be due
  // before, so the hold period stands on its own.
  const start = firstSessionIso && /^\d{4}-\d{2}-\d{2}$/.test(firstSessionIso)
    ? Date.parse(`${firstSessionIso}T00:00:00Z`)
    : NaN;
  if (Number.isNaN(start)) {
    return { tooClose: false, sendBy: iso(holdEnds), receiveBy: iso(holdEnds), daysToPay: holdDays, closeReason: null };
  }

  // Two dates, not one. Collapsing them tells a parent to pay on the morning
  // of the camp and lets the money arrive days after their child has been.
  const receiveMs = start - dueByDays * DAY;
  const sendMs = Math.min(holdEnds, receiveMs - clearDays * DAY);
  const daysToPay = Math.floor((sendMs - now) / DAY);

  const daysUntilStart = Math.floor((start - now) / DAY);
  const closeReason =
    daysUntilStart <= 0
      ? "it starts today"
      : daysUntilStart === 1
        ? "it starts tomorrow"
        : `it starts in ${daysUntilStart} days`;

  // No time left to send it and have it land in time.
  if (sendMs < now) {
    return { tooClose: true, sendBy: iso(now), receiveBy: iso(receiveMs), daysToPay: 0, closeReason };
  }

  return { tooClose: false, sendBy: iso(sendMs), receiveBy: iso(receiveMs), daysToPay, closeReason: null };
}
