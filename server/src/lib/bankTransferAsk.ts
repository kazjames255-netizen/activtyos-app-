// What a family is asked to pay by bank transfer for one checkout. Pure (no database), so the booking route, the confirmation email and the tests
// all agree: the done screen has always asked for the WHOLE basket under every reference, and the email must say the same thing.

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The amount and reference(s) to quote for a bank-transfer checkout: every place taken (waitlisted ones owe nothing yet), summed, with the
 *  references joined. `null` when nothing is owed (a 100% discount code, or store credit covering it all): such a booking has no bank
 *  details to show, and the email must not tell the family to pay GBP 0.00. */
export function bankTransferAsk(bookings: { ref: string; status?: string; amount?: number }[]): { reference: string; amount: number } | null {
  const live = bookings.filter((b) => b.status !== "Waitlisted");
  const amount = round2(live.reduce((s, b) => s + (b.amount ?? 0), 0));
  if (amount <= 0.004) return null;
  return { reference: live.map((b) => b.ref).join(", "), amount };
}
