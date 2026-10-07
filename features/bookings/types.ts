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
  // Provider cancelled and a refund is owed, but it has not been approved/paid yet: the money is still held.
  | "Refund pending"
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
  /** Legacy/alias for `dates` — some writers (merged-basket bookings) set
   *  this instead; readers should treat `dates ?? days` as the child's booked
   *  days. Kept in sync with `dates` wherever both are written. */
  days?: string[];
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
  /** A bank-transfer booking has no card to refund to, so the parent types their account details on the cancel screen. The details are NOT
   *  kept on the booking: they sit in a separate `refundBanks` doc, are shown to the provider ONCE (reveal, then deleted), and are also
   *  deleted when the refund is approved/declined. The booking only carries this marker (last 4 digits) so the provider knows they exist. */
  refundBank?: { last4: string };
  /** Where the approved money actually went (set by the server on approve):
   *  "wallet" credit, back to the "card", or "offline" — a voucher/TFC/cash
   *  booking the provider reimburses outside the app. */
  refundVia?: "wallet" | "card" | "offline";
  /** When the approved refund was actually settled (ISO) — `on` is when it
   *  was asked for. Set by the server on approve. */
  refundedAt?: string;
  /** The last refund attempt failed (e.g. Stripe refused) — the refund went
   *  back to awaiting approval rather than claiming money that never moved. */
  refundError?: string;
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
  /** Set when an offer lapsed: the family goes to the BACK of the queue instead of being re-offered first (p2-o15). */
  requeuedAt?: string;
  /** Parent view only (GET /api/my/bookings): THIS family's place in the queue, per date, and how the provider offers places. */
  waitlist?: { date: string; position: number }[];
  waitlistMode?: "manual" | "auto";
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
  /** Part-paid Tax-Free Childcare: the portion of `amount` that comes from HMRC.
   *  The rest (`amount - tfcAmount`) is the remainder the family settles another
   *  way (`tfcRemainderVia`, usually "card" — payable now). Absent = not a split. */
  tfcAmount?: number;
  tfcRemainderVia?: string;
  /** Provider-only reconciliation notes — never shown to the parent. A running
   *  log; each entry is time-stamped and attributed. */
  reconNotes?: { at: string; by?: string; text: string }[];
  /** Money logged against the booking AFTER it was cancelled/declined (manual
   *  record-payment). It isn't the price of a place any more — Reconciliation
   *  keeps it visible as "needs refund / credit" until it's refunded (d8s7). */
  receivedAfterCancel?: number;
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
  /** Manual-approval listing paid by card: the card is AUTHORISED when the family books (money held, not taken) and captured when
   *  the provider approves. awaiting = the family hasn't entered the card yet; held = authorised; captured / released / expired = done.
   *  `intentId` is shared by every booking row of one basket (one card, one hold). `amount` is THIS row's share. */
  cardHold?: {
    state: "awaiting" | "held" | "captured" | "released" | "expired";
    intentId?: string;
    paymentId?: string;
    amount: number;
    heldAt?: string;
    /** ISO time the card hold lapses (Stripe cancels it). The provider must approve before this. */
    expiresAt?: string;
  };
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
  /** Set when the provider overrode the checkout total on a family's behalf (server-stamped, audit):
   *  the price the rules gave, what was agreed, who set it and why. `amount` is already the agreed price. */
  priceOverride?: { originalAmount: number; amount: number; by: string; reason: string; at: string };
  /** Before discounts, and what came off (automatic rules + codes). Only set when a discount applied. */
  listPrice?: number;
  discountOff?: number;
  discountNames?: string[];
  /** Server-stamped when a fixed-£ early bird was used: "season:<id>" or "listing:<id>" (once per family per scope). */
  earlyBirdScope?: string;
  /** Store credit taken off this booking at checkout. `amount` is already net
   *  of it — this is here so the money trail shows where the difference went. */
  walletApplied?: number;
  /** Running total of approved cancellation refunds (server-stamped) — so a
   *  later cancel can't refund money that already went back. */
  refundedApproved?: number;
  /** How much of `walletApplied` has already been returned to the wallet. */
  walletRefunded?: number;
  /** Marketing discount code redeemed on this booking, if any. */
  discountCode?: string;
  addons: string[];
  /** The same extras, structured: who each is for and on which days. Older bookings only have `addons` strings. */
  addonLines?: { child: string; label: string; price: number; days: string[]; perDay: boolean; meal?: boolean }[];
  /** ISO dates a meal was bought for at checkout (meals ride the add-on lines;
   *  this is the clean structured signal the meals area reads). */
  mealDates?: string[];
  /** Structured meal purchases — one per meal bought — for the operator report
   *  (who chose what, totals per day). */
  mealItems?: { date: string; name: string; price: number }[];
  answers: [string, string][];
  note: string;
  recon: boolean | null;
  /** WHO settled this and HOW. Reconciling used to leave no trace on the booking
   *  at all — the row just said "Reconciled", with no way to tell an operator
   *  ticking it off from HMRC/Stripe settling it by itself. `auto` is for
   *  machine-matched payments (the HMRC EPP feed, per docs/tfc-build-spec.md);
   *  absent entirely = reconciled before this was recorded, so we say nothing
   *  rather than guess. */
  reconciledBy?: { at: string; by: string; auto?: boolean } | null;
  evid: string | null;
  cancel: CancelInfo | null;
  past?: boolean;
  refundLog?: RefundLogEntry[];
  /** A parent's pending request to move day(s) to other dates — surfaced to the
   *  operator to approve/deny from the row. On approve the swaps are applied. */
  /** How many date moves the provider has approved on this booking (for Setup > Amending dates "most moves per booking"). */
  amendMovesApproved?: number;
  /** The earliest session date this booking ever had, kept when a date is moved: refund notice is judged on the EARLIER of this and the current first date. */
  origFirstDate?: string;
  /** current date -> the original date it came from (set only for moved days); each released day is judged on the earlier of the two. */
  dayOrigin?: Record<string, string>;
  dateChangeRequest?: {
    moves: { childName?: string; childId?: string; from: string; to: string; approved?: boolean }[];
    /** A requested new time slot ("09:00 – 15:30"), separate from date moves. */
    timing?: string;
    requestedAt?: string;
    status: "pending" | "approved" | "denied";
    /** Optional reason the provider gave when denying. */
    reason?: string;
    resolvedAt?: string;
    /** Setup > Amending dates > admin fee added to the booking when this request was approved (once). */
    feeCharged?: number;
    /** Applied straight away for the parent (Setup > "let parents move their own dates") rather than approved by the provider. */
    selfService?: boolean;
  } | null;
  /** Total admin fees added to this booking for date changes (already inside `amount`). */
  amendFeesCharged?: number;

  /** Optional free-text the provider gave when declining the booking; shown
   *  to the family in the decline email. */
  declineReason?: string;

  /** Home-visit listings only: where this session actually happens. Defaults
   *  to the parent's saved account address at checkout but is editable there
   *  (e.g. a grandparent's house) — validated against the listing's coverage
   *  area before the booking is allowed to complete. Absent on venue bookings. */
  serviceAddress?: { address: string; postcode: string };

  /** The booking family's own postcode, copied from their account at checkout
   *  (GET /api/me / account settings) — NOT the home-visit service address
   *  above, which can differ (e.g. a grandparent's house). Absent for
   *  bookings made before this was captured, or where the family has never
   *  set a postcode on their account. Read defensively by any consumer
   *  (e.g. the Task Manager parent picker). */
  postcode?: string;

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
  | "unreconciled"
  | "cancelled"
  | "requests"
  | "refunds";
