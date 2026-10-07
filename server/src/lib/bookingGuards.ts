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

// ── Approve / decline / nudge only make sense on the right status (found testing: the API let a provider approve a CANCELLED or REFUNDED
//    booking back to "Confirmed", decline a CONFIRMED + PAID one (money kept, family told "nothing was taken"), and nag a family about £0.00) ──

/** A request can be approved only while it is waiting ("Approval needed"); approving an already Confirmed booking is a harmless no-op (double click). */
export function approveBlockedMessage(status: string | undefined): string | null {
  if (status === "Approval needed" || status === "Confirmed") return null;
  if (status === "Cancelled") return "This booking was cancelled, so it can't be approved. Ask the family to book again.";
  if (status === "Declined") return "This booking was declined, so it can't be approved. Ask the family to book again.";
  return `This booking is ${status === "Offered" ? "an offered place" : "on the waiting list"}, not a request waiting for approval. Offer or confirm the place instead.`;
}

/** A request is declined only while it is waiting (or on the waiting list / offered). A Confirmed booking is ended with Cancel, so the refund is decided. */
export function declineBlockedMessage(status: string | undefined): string | null {
  if (status === "Approval needed" || status === "Waitlisted" || status === "Offered") return null;
  if (status === "Confirmed") return "This booking is already confirmed. To end it, use Cancel booking and choose the refund.";
  if (status === "Cancelled") return "This booking is already cancelled.";
  if (status === "Declined") return "This booking was already declined.";
  return `A booking that is ${String(status ?? "").toLowerCase()} can't be declined.`;
}

/** A payment reminder only goes to a family that still owes money on a live booking. */
export function nudgeBlockedMessage(b: { status?: string; pay?: string; amount?: number; amountPaid?: number; cardHold?: { state?: string } | null }): string | null {
  if (b.status === "Cancelled" || b.status === "Declined") return "This booking is cancelled or declined: there is nothing to remind the family about.";
  if (b.status === "Waitlisted" || b.status === "Offered") return "This booking is on the waiting list: nothing is due until a place is taken.";
  if (b.cardHold?.state === "held") return "The family's card is already held: approve the booking to take the payment.";
  if (["Paid", "Refunded", "Refund pending", "Funded"].includes(String(b.pay))) return "Nothing is owed on this booking.";
  if (Math.max(0, (b.amount ?? 0) - (b.amountPaid ?? 0)) <= 0) return "Nothing is owed on this booking.";
  return null;
}
