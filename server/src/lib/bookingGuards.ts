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

// ── Card HOLD (manual approval paid by card) ──────────────────────────────────────────────────────────────────────────────────────────
type HoldLike = { cardHold?: { state?: string } | null } | undefined;

/** A card that is only HELD (or not yet entered) is settled by approving: money recorded by hand against it would count twice, and after a
 *  decline it would leave a "Paid" booking nobody paid for. record-payment / reconcile / Mark paid refuse these. */
export const cardHeldBlocksPayment = (b: HoldLike): boolean => b?.cardHold?.state === "held" || b?.cardHold?.state === "awaiting";

export const CARD_HELD_MESSAGE = "This booking's card is only held, not charged. Approving the booking takes the payment, so there is nothing to record.";

/** Approving a held request captures the card and announces it ONCE: only the approval that moves it out of "Approval needed" does it
 *  (a double click / retry sees it already Confirmed and does nothing). */
export function isFirstHeldApproval(action: string, statusBefore: string | undefined, b: HoldLike): boolean {
  return action === "approve" && statusBefore === "Approval needed" && b?.cardHold?.state === "held";
}

/** Approved, but the family's card hold was lost (the other child on the same card was approved first and the capture dropped the rest of
 *  the authorisation): nothing has been taken, so the family must be ASKED TO PAY - not told "you're booked in". */
export function shouldAskToPayAfterApproval(action: string, b: { status?: string; pay?: string; amount?: number; cardHold?: { state?: string } | null }): boolean {
  return action === "approve" && b.status === "Confirmed" && b.cardHold?.state === "released" && b.pay !== "Paid" && b.pay !== "Funded" && (b.amount ?? 0) > 0;
}
