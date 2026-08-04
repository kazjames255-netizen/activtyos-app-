// Domain model for the Bookings view — mirrors the legacy `window.PB` record
// shape exactly so the extracted seed data (data.ts) is valid without edits.

export type BookingStatus =
  | "Approval needed"
  | "Confirmed"
  | "Waitlisted"
  // A place has been OFFERED off the waiting list — the seat is held until
  // offerExpiresAt (2 hours); accept → Confirmed, decline/expiry → back to
  // the queue / Cancelled.
  | "Offered"
  | "Cancelled"
  | "Declined";

export type PayStatus =
  | "Paid"
  | "Unpaid"
  | "Invoice sent"
  | "Refunded"
  | "Partially refunded"
  | "Partially paid"
  | "Funded"
  | string; // legacy also stores raw method placeholders like "—"

export type RefundKind = "full" | "partial" | "none" | "approved" | "declined" | "pending";

export interface Kid {
  name: string;
  /** The child's record id (children collection). Present when booked from a
   *  saved profile — lets registers resolve the face, allergies, SEND plan
   *  and collection password rather than guessing from the name. */
  childId?: string;
  age?: number;
  dob?: string;
  dates?: string[];
  cancelledDays?: string[];
  cancelled?: boolean;
}

export interface CancelInfo {
  on: string;
  by: string;
  msg?: string;
  /** Provider-defined reason (Illness / Weather / …) for reporting. */
  reason?: string;
  refund?: RefundKind;
  amount?: number;
  refundOnly?: boolean;
  /** Where the family asked for the money to go. "wallet" keeps it in-house as
   *  store credit with this provider; "card" (the default) refunds the payment
   *  method. Honoured when the operator approves the refund. */
  refundTo?: "card" | "wallet";
}

export interface RefundLogEntry {
  label: string;
  amount: number;
  on: string;
  by: string;
  source?: string;
}

export interface Booking {
  ref: string;
  bid: string;
  /** The provider (tenant) this booking belongs to — stamped server-side. */
  tenantId?: string;
  /** Set when the booking belongs to a franchise within the tenant. */
  franchiseId?: string;
  /** The block this booking holds places in (capacity/waitlist tracking). */
  blockId?: string;
  /** The listing this booking is for — stamped server-side. Lets the amend flow
   *  fetch the listing's live schedule + pass rules to constrain a date change. */
  listingId?: string;
  /** Places held in the block (kids count; default 1). */
  seats?: number;
  /** The ISO session dates this booking occupies (absent = every session —
   * pre-day-picker bookings). Registers use this to know who's expected. */
  days?: string[];
  /** The bundle timing chosen at checkout (period title, e.g. "Late pick-up"). */
  timing?: string;
  /** Waiting-list offer window (status "Offered") — ISO timestamps. */
  offeredAt?: string;
  offerExpiresAt?: string;
  /** Childcare voucher booking (§Q): the scheme the family pays through, and
   *  the dates they must send by / it must arrive by. pay is
   *  "Awaiting voucher payment" until the money lands. */
  voucherScheme?: string;
  voucherSendBy?: string;
  voucherReceiveBy?: string;
  /** The unique reference the parent pays under (voucher account ref / TFC
   *  payment reference) so the provider can match the money in their bank.
   *  Entered once by the parent; the provider can correct it (parent notified). */
  paymentRef?: string;
  /** Per-child / per-scheme payment references — siblings on one booking may
   *  pay as two separate references (e.g. £50 each for a £100 booking). When
   *  present these take precedence over the single paymentRef. */
  payRefs?: { child?: string; scheme?: string; ref: string; amount?: number }[];
  /** Split payment: how much of `amount` was already taken by card at checkout
   *  (auto-settled); the remainder is the off-platform portion reconciled here. */
  cardPaid?: number;
  /** Provider-only reconciliation notes — never shown to the parent. A running
   *  log; each entry is time-stamped and attributed. */
  reconNotes?: { at: string; by?: string; text: string }[];
  /** Reconciliation nudges: how many payment reminders were sent and when the
   *  last one went, so the bell can show state. Off-platform / awaiting only. */
  nudges?: number;
  lastNudgedAt?: string;
  /** A card payment attempt failed (set by the Stripe webhook — Amir). Surfaces
   *  a "card failed — arrange payment" flag in the booking area. */
  cardFailed?: boolean;
  /** Stripe payment that settled this booking (set server-side on confirm).
   * stripeAccount is the provider's connected account it was charged on
   * (null = dev platform fallback). Refund-approve refunds through these. */
  paymentIntentId?: string;
  stripeAccount?: string | null;
  /** When the booking was taken. Absent on anything created before this. */
  createdAt?: string;
  booker: string;
  email: string;
  phone: string;
  child: string;
  /** Resolved child record id (see Kid.childId). */
  childId?: string;
  age?: number;
  dob?: string;
  kids?: Kid[];
  listing: string;
  pass: string;
  ticket: string;
  dates: string;
  sessions: string[];
  status: BookingStatus;
  pay: PayStatus;
  method: string;
  amount: number;
  /** How much has actually been received (reconciliation). Absent = 0 for
   *  Unpaid, treated as `amount` for Paid. Partial payments track it. */
  amountPaid?: number;
  /** Store credit taken off this booking at checkout. `amount` is already net
   *  of it — this is here so the money trail shows where the difference went. */
  walletApplied?: number;
  /** Marketing discount code redeemed on this booking, if any. */
  discountCode?: string;
  addons: string[];
  /** ISO dates a meal was bought for at checkout (meals ride the add-on lines;
   *  this is the clean structured signal the meals area reads). */
  mealDates?: string[];
  answers: [string, string][];
  note: string;
  recon: boolean | null;
  evid: string | null;
  cancel: CancelInfo | null;
  past?: boolean;
  refundLog?: RefundLogEntry[];
  /** A parent's pending request to move day(s) to other dates — surfaced to the
   *  operator to approve/deny from the row. On approve the swaps are applied. */
  dateChangeRequest?: {
    moves: { childName?: string; childId?: string; from: string; to: string; approved?: boolean }[];
    /** A requested new time slot ("09:00 – 15:30"), separate from date moves. */
    timing?: string;
    requestedAt?: string;
    status: "pending" | "approved" | "denied";
    /** Optional reason the provider gave when denying. */
    reason?: string;
    resolvedAt?: string;
  } | null;

  /** Optional free-text the provider gave when declining the booking; shown
   *  to the family in the decline email. */
  declineReason?: string;

  // Transient UI state (kept on the record to match the legacy flows).
  _cancelling?: boolean;
  _refundType?: "full" | "partial" | "none";
  _chgKi?: number | null;
  _chgDt?: string | null;
}

export type BookingFilter =
  | "all"
  | "approval"
  | "confirmed"
  | "waitlisted"
  | "unpaid"
  | "cancelled"
  | "requests"
  | "refunds";
