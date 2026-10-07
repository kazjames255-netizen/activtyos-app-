// Pure figure maths for the operator Dashboard (routes/dashboard.ts), lifted
// out so it can be tested without Firestore. Behaviour is unchanged.
import { isMoneyIn, owedNow } from "../../../features/bookings/helpers";
import type { Booking } from "../../../features/bookings/types";

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** The booking fields the figures read. */
export interface BkLite {
  ref: string;
  status: string;
  amount?: number;
  amountPaid?: number;
  pay?: string;
  voucherReceiveBy?: string;
}
export interface PayLite { amount?: number; status?: string; type?: string; createdAt?: string; paidAt?: string; refs?: string[] }

/** owedNow's rules only touch status/amount/amountPaid/pay. */
export const owedLite = (b: BkLite) => owedNow(b as unknown as Booking);

/** "Outstanding": confirmed (place-holding) bookings still owing, plus the voucher counts. */
export function outstandingFigures(liveBookings: BkLite[], today: string) {
  const owing = liveBookings.filter((b) => owedLite(b) > 0.005);
  return {
    outstanding: round2(owing.reduce((s, b) => s + owedLite(b), 0)),
    overdueVouchers: owing.filter((b) => b.pay === "Awaiting voucher payment" && !!b.voucherReceiveBy && b.voucherReceiveBy < today).length,
    awaitingVoucher: owing.filter((b) => b.pay === "Awaiting voucher payment").length,
  };
}

/** A cancelled booking refunded in full with no refund payment row: its money is gone. */
export const isGoneRefund = (b: BkLite, refsWithRefundRow: Set<string>) =>
  b.status === "Cancelled" && String(b.pay) === "Refunded" && !refsWithRefundRow.has(b.ref);

/**
 * "Taken this week". `shareIn` / `venueRefs` are the venue-lens inputs (null = no lens).
 * `goneRefs` = refs of bookings that were cancelled and refunded without a refund row.
 */
export function takenThisWeekFigure(
  payments: PayLite[],
  weekAgo: string,
  goneRefs: Set<string>,
  venueRefs: Set<string> | null = null,
  shareIn: (refs: string[]) => number = () => 1,
): number {
  const refundedThisWeek = payments
    // Same statuses reconcileMath counts: an approved offline refund ("to-reimburse") and a recorded one are money going back too.
    .filter((p) => p.type === "refund" && (p.status === "succeeded" || p.status === "recorded" || p.status === "to-reimburse" || p.status === "credited") && (p.paidAt ?? p.createdAt ?? "") >= weekAgo)
    .filter((p) => !venueRefs || (p.refs ?? []).some((r) => venueRefs.has(r)))
    .reduce((s, p) => s + round2((p.amount ?? 0) * shareIn(p.refs ?? [])), 0);
  return round2(
    payments
      // A card record is created when checkout STARTS; paidAt is when it paid.
      .filter((p) => isMoneyIn(p) && (p.paidAt ?? p.createdAt ?? "") >= weekAgo)
      .filter((p) => !(p.refs ?? []).some((r) => goneRefs.has(r)))
      .filter((p) => !venueRefs || (p.refs ?? []).some((r) => venueRefs.has(r)))
      .reduce((s, p) => s + round2((p.amount ?? 0) * shareIn(p.refs ?? [])), 0) - refundedThisWeek,
  );
}

export interface ListingOcc { listing: string; capacity: number; booked: number; spotsLeft: number; nextDate: string }
/** Fold one open run into its listing's occupancy row (day-scope = daily limit + busiest day, never a sum). */
export function addRunToListing(
  cur: ListingOcc,
  run: { capacityScope?: string; dayCounts?: Record<string, number> },
  sum: { capacity: number; bookedCount: number; spotsLeft: number },
): ListingOcc {
  if (run.capacityScope === "day") {
    // 2 a day over three weeks is still 2 a day, not 6.
    const busiest = Math.max(0, ...Object.values(run.dayCounts ?? {}));
    cur.capacity = Math.max(cur.capacity, sum.capacity);
    cur.booked = Math.max(cur.booked, busiest);
    cur.spotsLeft = cur.capacity - cur.booked;
  } else {
    cur.capacity += sum.capacity; cur.booked += sum.bookedCount; cur.spotsLeft += sum.spotsLeft;
  }
  return cur;
}
