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
  | "Funded"
  | string; // legacy also stores raw method placeholders like "—"

export type RefundKind = "full" | "partial" | "none" | "approved" | "declined" | "pending";

export interface Kid {
  name: string;
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
  refund?: RefundKind;
  amount?: number;
  refundOnly?: boolean;
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
  /** Stripe payment that settled this booking (set server-side on confirm).
   * stripeAccount is the provider's connected account it was charged on
   * (null = dev platform fallback). Refund-approve refunds through these. */
  paymentIntentId?: string;
  stripeAccount?: string | null;
  booker: string;
  email: string;
  phone: string;
  child: string;
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
  addons: string[];
  answers: [string, string][];
  note: string;
  recon: boolean | null;
  evid: string | null;
  cancel: CancelInfo | null;
  past?: boolean;
  refundLog?: RefundLogEntry[];

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
  | "refunds";
