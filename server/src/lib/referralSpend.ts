// Pure: what a referred friend actually paid for the booking that triggered
// the referral reward (after automatic discounts AND their own referral/discount
// code). Waitlisted rows are not paid for yet, so they don't count.
export function friendPaidAmount(bookings: { amount?: number; status?: string }[]): number {
  const cents = bookings
    .filter((b) => b.status !== "Waitlisted")
    .reduce((s, b) => s + Math.round((Number(b.amount) || 0) * 100), 0);
  return cents / 100;
}
