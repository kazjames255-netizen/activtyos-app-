/**
 * A refund on a booking paid partly by CARD (Stripe) and partly OFFLINE (cash / bank / voucher, or a hand-paid top-up) goes back to the SAME
 * method each pound came in by. The rule: PROPORTIONAL to what is still refundable by each method (paid by that method, less refunds it has
 * already had), so a half-and-half booking gives half-and-half for any refund (100 -> 50 + 50, 60 -> 30 + 30). The card share is capped at what
 * Stripe can still return; an amount beyond what both methods hold (should not happen) is owed back offline, as before. Pure.
 */
export function splitRefundByMethod(rest: number, cardLeft: number, offlineLeft: number): { card: number; offline: number } {
  const total = Math.max(0, cardLeft) + Math.max(0, offlineLeft);
  const card = total <= 0 ? 0 : Math.min(Math.max(0, cardLeft), Math.round((rest * Math.max(0, cardLeft) / total) * 100) / 100);
  return { card, offline: Math.round((rest - card) * 100) / 100 };
}
