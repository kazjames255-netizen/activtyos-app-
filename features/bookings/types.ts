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
  /** Days (ISO) whose price a provider cancel-day already took OFF `amount`. A day released by the family leaves `amount` alone, so only these
   *  days stop counting in the price of each standing day (releaseCap). */
  amountDaysRemoved?: string[];
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
  /** Explicit YES/NO chosen with the refund: did the add-ons go back with it? Absent = the default (whole-booking refund => yes, partial / none => no). */
  refundsAddons?: boolean;
  /** What the add-on lines said before THIS refund marked them refunded (addonRefund.ts). Declining the refund puts it back; approving keeps the marks. */
  addonUndo?: { key: string; refunded: boolean | null; refundedDays: string[] | null }[];
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
  /** An OFFLINE refund (bank transfer / cash / voucher) is only RECORDED when the provider approves it: the app cannot move that money.
   *  "awaiting" = recorded, the provider still has to send it ("Refund recorded - awaiting your transfer"); "sent" = the provider confirmed
   *  they sent it. Absent on an older offline refund = awaiting (the ledger row is still "to-reimburse"). Card and wallet refunds never set it. */
  refundTransfer?: "awaiting" | "sent";
  /** The cash (not wallet) part of THIS approved refund: what the provider has to send. Each refund carries its own, so an earlier one already sent is not counted again. */
  refundCash?: number;
  /** When the offline refund was recorded / confirmed sent (ISO), and who confirmed it. */
  refundRecordedAt?: string;
  refundSentAt?: string;
  refundSentBy?: string;
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
  /** Stripe refund id, on a line written for a refund made OUTSIDE the app (Stripe dashboard): what keeps it from being recorded twice. */
  refundId?: string;
  /** What the line is, with its data, so it shows in the viewer's language (refundLogLabel). Older lines have only the English `label`. */
  kind?: string;
  vars?: Record<string, string | number>;
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
  /** Tax-Free Childcare: HMRC accepted a payment request for this booking (the
   *  money reaches the provider on or around estimatedPaymentDate). Set once;
   *  a booking carrying it is never requested from HMRC again. */
  tfcPayment?: { paymentReference: string; estimatedPaymentDate: string; amount: number; requestedAt: string };
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
  /** The payment link / invoice email has been re-sent this many times (server-side, on every 'Resend invoice'). `lastBy` = who pressed it. */
  invoiceResends?: { count: number; lastAt: string; lastBy?: string };
  /** When the invoice / payment link was first sent (the booking's creation when never stamped). */
  invoiceSentAt?: string;
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
  /** One id per checkout REQUEST, stamped on every booking (reference) that request created: the several references of a weekly split share it.
   *  Provider/server side only - never sent to a family (index.ts strips it from /api/my and the public pay link). Absent on bookings made before it existed. */
  checkoutId?: string;
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
  /** Part of `walletApplied` no longer owed for: a removed share (cancelled day / extra) larger than the cash due came off the wallet part. The
   *  booking's gross price is amount + walletApplied - walletRelieved. */
  walletRelieved?: number;
  /** Set once a release took days off a PART-paid booking's price: later releases keep following the price (refund only what is paid beyond it), even after the status flips to Partially refunded. */
  priceFollowsRelease?: boolean;
  /** Running total of approved cancellation refunds (server-stamped) — so a
   *  later cancel can't refund money that already went back. */
  refundedApproved?: number;
  /** How much of `walletApplied` has already been returned to the wallet. */
  walletRefunded?: number;
  /** EVERY approved refund, one entry each (the single `cancel` record is overwritten by the next refund, so what is still owed to the family must
   *  not live only there). The money still to send is the sum of the offline entries not yet sent. Older bookings have none: see unsentRefunds(). */
  refundEntries?: RefundEntry[];
  /** What a FAMILY is told instead of refundEntries (server/src/lib/familyView.ts): a refund the provider has recorded is still waiting for their transfer. */
  refundAwaiting?: boolean;
  /** The last time the provider confirmed sending refund(s): the amount and when (for the "has been sent" wording). */
  lastRefundSent?: { amount: number; at: string };
  /** Marketing discount code redeemed on this booking, if any. */
  discountCode?: string;
  addons: string[];
  /** The same extras, structured: who each is for and on which days. Older bookings only have `addons` strings. */
  addonLines?: { child: string; label: string; price: number; days: string[]; perDay: boolean; meal?: boolean; /** Stored at cancel time (see addonRefund.ts): true = went back with a refund, false = kept. */ refunded?: boolean; refundedDays?: string[]; name?: string; answers?: { label: string; value: string }[]; qty?: number; addonId?: string }[];
  /** A family's REQUESTS to change or cancel one extra. Never automatic: the provider approves or declines each one, and it is separate from
   *  cancelling the booking itself. See features/bookings/addonRequests.ts. */
  addonRequests?: AddonRequest[];
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
  serviceAddress?: { address: string; postcode: string; /** Town / area the server recognised the postcode as (set server-side, never from the browser). */ area?: string; /** The family's note on how to find them (parking, gate codes...). Provider-facing only. */ notes?: string };

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

export interface RefundEntry {
  id: string;
  /** What was approved (cash + wallet part), and the cash part the provider must send. */
  amount: number;
  cash: number;
  via: "wallet" | "card" | "offline";
  /** approved = recorded, still to send (offline only); sent = money has moved / the provider confirmed. */
  status: "approved" | "sent";
  approvedAt: string;
  sentAt?: string;
  note?: string;
}
export type AddonRequestKind = "change" | "cancel";
export type AddonRequestStatus = "pending" | "approved" | "declined" | "withdrawn";
/** One extra a request covers: the line (see addonLineKey) and, for a daily extra, the specific days (always listed on a new request; absent on
 *  a request made before bulk requests existed, which means the whole extra). `price` is the money for exactly these days at the time of asking. */
export interface AddonRequestTarget {
  key: string;
  child: string;
  label: string;
  name?: string;
  days?: string[];
  price: number;
}
export interface AddonRequest {
  id: string;
  /** Which extra line (see addonLineKey): child + label at the time of the request. */
  key: string;
  kind: AddonRequestKind;
  child: string;
  /** The line's label when asked, e.g. "tshirty (size: m)". */
  label: string;
  /** Change only: the answers wanted, by question label ("size" -> "L"), and the readable new label. */
  to?: Record<string, string>;
  toLabel?: string;
  note?: string;
  /** CANCEL only: every extra (and the days of it) this ONE request covers. Absent on requests made before bulk requests: then `key` is the
   *  one whole extra. See requestTargets() in features/bookings/addonRequests.ts. */
  targets?: AddonRequestTarget[];
  /** What the extra costs now (for a bulk request: the total of all targets), and the price difference a change would make (always 0 for a
   *  size/colour change: the price stays as booked; older requests may still carry one). */
  price: number;
  priceDiff?: number;
  status: AddonRequestStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  declineReason?: string;
  /** What the provider chose for the money when approving. Nothing moves unless they say so. */
  money?: { resolution: "refund" | "wallet" | "none" | "charge" | "waive"; amount: number };
}
