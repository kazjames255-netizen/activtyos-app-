// Pure booking-action guards (no database), so regression tests can import them.

/** Statuses on which "Mark paid" makes no sense: there is no live place to pay for. */
export const NOT_PAYABLE_STATUSES = ["Cancelled", "Declined", "Waitlisted", "Offered"] as const;

export const canMarkPaid = (status: string | undefined): boolean => !NOT_PAYABLE_STATUSES.includes(status as (typeof NOT_PAYABLE_STATUSES)[number]);

/** The 409 message when "Mark paid" is refused. */
export function paidBlockedMessage(status: string): string {
  if (status === "Cancelled") return "This booking is cancelled, so it can't be marked paid. Reopen it first.";
  if (status === "Declined") return "This booking was declined, so it can't be marked paid.";
  return `This booking is still ${status === "Offered" ? "an offered place" : "on the waiting list"}, so it can't be marked paid until the place is taken.`;
}

/** "Booking confirmed" is mailed once per confirmation: approve/promote on a booking that was ALREADY Confirmed
 *  (double click; approve after an accepted waiting-list offer) is a no-op and sends nothing. */
export function shouldEmailConfirmed(action: string, statusBefore: string | undefined): boolean {
  return (action === "approve" || action === "promote") && statusBefore !== "Confirmed";
}

/** The family gets a "your booking is cancelled" notice only when a real booking flips to Cancelled
 *  (not when someone leaves a waiting list or turns down an offered place, and not on a repeat call). */
export function shouldNotifyCancelled(oldStatus: string | undefined, newStatus: string | undefined): boolean {
  return newStatus === "Cancelled" && !!oldStatus && !["Cancelled", "Declined", "Waitlisted", "Offered"].includes(oldStatus);
}
