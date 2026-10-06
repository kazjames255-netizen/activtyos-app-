// DATA for the listing x action COMBINATION GRID (see grid.ts). Edit THIS file to add rows, actions, evidence or rules; grid.ts computes the rest.
//
// How a cell gets its state (grid.ts):
//   NOT-ALLOWED  a rule here says the pair cannot happen; the rule cites the server code that refuses it (grep-verified).
//   TESTED       some claim covers the cell AND every piece of evidence it cites still exists (grep/JSON-verified).
//                An action that provably never reads an axis (static scan of its code units) only needs ONE tested claim on any
//                row for that axis; an action that does read the axis needs a claim for that exact row value.
//   GAP          nobody tests it. `grid.ts --check` lists each gap as a task.

export type AxisId = "loc" | "shape" | "cap" | "appr" | "wl" | "price" | "disc" | "addon" | "pol";

export interface Row { id: string; axis: AxisId; label: string; note?: string }
export interface Col { id: string; group: string; label: string }

export const AXES: Record<AxisId, string> = {
  loc: "Where it runs", shape: "Pass shape", cap: "Capacity rule", appr: "Approval", wl: "Waiting list",
  price: "Price", disc: "Discount", addon: "Add-ons", pol: "Cancellation policy",
};

export const ROWS: Row[] = [
  { id: "loc.venue", axis: "loc", label: "At a venue" },
  { id: "loc.hv-pc", axis: "loc", label: "Home visits, postcode list" },
  { id: "loc.hv-radius", axis: "loc", label: "Home visits, radius" },
  { id: "loc.both", axis: "loc", label: "Venue and home visits" },
  { id: "loc.online-room", axis: "loc", label: "Online, our video room" },
  { id: "loc.online-link", axis: "loc", label: "Online, provider's own link" },
  { id: "shape.single", axis: "shape", label: "Single-day tickets" },
  { id: "shape.multiday", axis: "shape", label: "Multi-day pass in one week" },
  { id: "shape.multiweek", axis: "shape", label: "Pass across several weeks" },
  { id: "cap.day", axis: "cap", label: "Capacity per day" },
  { id: "cap.listing", axis: "cap", label: "Capacity for the whole listing" },
  { id: "cap.ticket", axis: "cap", label: "Per-ticket cap (or closed/hidden ticket)" },
  { id: "cap.age", axis: "cap", label: "Per-age-group cap / ticket age range" },
  { id: "appr.auto", axis: "appr", label: "Auto-confirm" },
  { id: "appr.manual", axis: "appr", label: "Provider approves each booking" },
  { id: "appr.oor", axis: "appr", label: "Outside the age range = request" },
  { id: "wl.off", axis: "wl", label: "Waiting list off" },
  { id: "wl.manual", axis: "wl", label: "Waiting list, provider offers" },
  { id: "wl.auto", axis: "wl", label: "Waiting list, first in queue" },
  { id: "price.paid", axis: "price", label: "Paid ticket" },
  { id: "price.free", axis: "price", label: "Free / funded GBP 0 (HAF)" },
  { id: "disc.none", axis: "disc", label: "No discount" },
  { id: "disc.person", axis: "disc", label: "Multi-person % (siblings)" },
  { id: "disc.session", axis: "disc", label: "Multi-session % or GBP" },
  { id: "disc.early-pct", axis: "disc", label: "Early bird %" },
  { id: "disc.early-fixed", axis: "disc", label: "Early bird fixed GBP (once per family)" },
  { id: "disc.code", axis: "disc", label: "Discount code" },
  { id: "addon.none", axis: "addon", label: "No add-ons" },
  { id: "addon.perday", axis: "addon", label: "Per-day add-on" },
  { id: "addon.oneoff", axis: "addon", label: "One-off add-on" },
  { id: "pol.standard", axis: "pol", label: "Standard policy" },
  { id: "pol.flexible", axis: "pol", label: "Flexible policy" },
  { id: "pol.strict", axis: "pol", label: "Strict policy" },
  { id: "pol.none", axis: "pol", label: "No refunds" },
  { id: "pol.custom", axis: "pol", label: "Custom bands" },
];

export const COLS: Col[] = [
  { id: "book", group: "Booking", label: "Book" },
  { id: "pay.card", group: "Paying", label: "Pay by card" },
  { id: "pay.bank", group: "Paying", label: "Pay by bank transfer" },
  { id: "pay.wallet", group: "Paying", label: "Pay from wallet" },
  { id: "pay.cash", group: "Paying", label: "Pay cash" },
  { id: "pay.tfc", group: "Paying", label: "Pay by Tax-Free Childcare" },
  { id: "pay.voucher", group: "Paying", label: "Pay by voucher" },
  { id: "pay.partial", group: "Paying", label: "Part-pay then balance" },
  { id: "wallet.use", group: "Paying", label: "Wallet credit on top of card" },
  { id: "cancel.whole", group: "Cancelling", label: "Parent cancels whole booking" },
  { id: "cancel.child", group: "Cancelling", label: "Cancel one child" },
  { id: "cancel.afterstart", group: "Cancelling", label: "Cancel after it started" },
  { id: "cancel.provider", group: "Cancelling", label: "Provider cancels a session or child" },
  { id: "amend.date", group: "Changing", label: "Move a date" },
  { id: "wl.join", group: "Waiting list", label: "Join waiting list" },
  { id: "wl.offer", group: "Waiting list", label: "Offer a place" },
  { id: "wl.accept", group: "Waiting list", label: "Accept offer" },
  { id: "wl.decline", group: "Waiting list", label: "Decline offer" },
  { id: "wl.expire", group: "Waiting list", label: "Offer expires" },
  { id: "req.approve", group: "Requests", label: "Provider approves request" },
  { id: "req.decline", group: "Requests", label: "Provider declines request" },
  { id: "refund", group: "Money out", label: "Refund sent / approved" },
  { id: "listing.duplicate", group: "Listing edits", label: "Duplicate the listing" },
  { id: "listing.edit", group: "Listing edits", label: "Edit after bookings exist" },
  { id: "listing.unpublish", group: "Listing edits", label: "Unpublish or end with live bookings" },
  { id: "embed.book", group: "Surfaces", label: "Book through the embed" },
  { id: "ui.phone", group: "Surfaces", label: "Phone width (390px)" },
];

/** Where each action's logic lives. grid.ts scans these for axis tokens: an axis whose tokens never appear is proven independent. */
export interface Unit { file: string; start?: string }
export const UNITS: Record<string, Unit[]> = {
  "book": [{ file: "server/src/routes/my.ts", start: "^my\\.post\\(\"/bookings\"" }, { file: "server/src/lib/passBooking.ts" }, { file: "server/src/lib/addonPricing.ts" }, { file: "features/listings/discounts.ts" }, { file: "server/src/lib/coverageArea.ts" }, { file: "server/src/lib/blockDomain.ts" }],
  "pay.card": [{ file: "server/src/routes/payments.ts" }, { file: "server/src/lib/settlePayment.ts" }, { file: "server/src/lib/payGate.ts" }],
  "pay.bank": [{ file: "server/src/routes/bookings.ts", start: "^bookings\\.post\\(\"/:ref/record-payment\"" }, { file: "server/src/lib/payMethods.ts" }],
  "pay.cash": [{ file: "server/src/routes/bookings.ts", start: "^bookings\\.post\\(\"/:ref/record-payment\"" }, { file: "server/src/lib/payMethods.ts" }],
  "pay.tfc": [{ file: "server/src/routes/bookings.ts", start: "^bookings\\.post\\(\"/:ref/record-payment\"" }, { file: "server/src/lib/tfc.ts" }, { file: "server/src/lib/payMethods.ts" }],
  "pay.voucher": [{ file: "server/src/routes/bookings.ts", start: "^bookings\\.post\\(\"/:ref/record-payment\"" }, { file: "server/src/lib/payMethods.ts" }],
  "pay.partial": [{ file: "server/src/routes/bookings.ts", start: "^bookings\\.post\\(\"/:ref/record-payment\"" }, { file: "server/src/lib/payGate.ts" }],
  "pay.wallet": [{ file: "server/src/routes/my.ts", start: "^my\\.post\\(\"/bookings\"" }, { file: "server/src/lib/wallet.ts" }],
  "wallet.use": [{ file: "server/src/routes/my.ts", start: "^my\\.post\\(\"/bookings\"" }, { file: "server/src/lib/wallet.ts" }],
  "cancel.whole": [{ file: "server/src/routes/my.ts", start: "^my\\.post\\(\"/bookings/:ref/cancel\"" }, { file: "features/bookings/mutations.ts" }, { file: "lib/cancellation.ts" }, { file: "server/src/lib/blockDomain.ts" }, { file: "server/src/lib/waitlist.ts" }],
  "cancel.child": [{ file: "server/src/routes/my.ts", start: "^my\\.post\\(\"/bookings/:ref/cancel\"" }, { file: "features/bookings/mutations.ts" }, { file: "lib/cancellation.ts" }, { file: "server/src/lib/blockDomain.ts" }, { file: "server/src/lib/waitlist.ts" }],
  "cancel.afterstart": [{ file: "server/src/routes/my.ts", start: "^my\\.post\\(\"/bookings/:ref/cancel\"" }, { file: "lib/cancellation.ts" }],
  "cancel.provider": [{ file: "server/src/routes/bookings.ts", start: "^bookings\\.post\\(\"/:ref/actions\"" }, { file: "features/bookings/mutations.ts" }, { file: "lib/cancellation.ts" }, { file: "server/src/lib/waitlist.ts" }],
  "amend.date": [{ file: "server/src/routes/my.ts", start: "^my\\.post\\(\"/bookings/:ref/amend\"" }, { file: "server/src/lib/dateChange.ts" }, { file: "server/src/lib/blockDomain.ts" }],
  "wl.join": [{ file: "server/src/routes/my.ts", start: "^my\\.post\\(\"/bookings\"" }, { file: "server/src/lib/waitlistQueue.ts" }],
  "wl.offer": [{ file: "server/src/routes/bookings.ts", start: "^bookings\\.post\\(\"/:ref/actions\"" }, { file: "server/src/lib/waitlist.ts" }, { file: "server/src/lib/waitlistQueue.ts" }],
  "wl.accept": [{ file: "server/src/routes/my.ts", start: "^my\\.post\\(\"/bookings/:ref/accept-offer\"" }, { file: "server/src/lib/waitlist.ts" }],
  "wl.decline": [{ file: "server/src/routes/my.ts", start: "^my\\.post\\(\"/bookings/:ref/decline-offer\"" }, { file: "server/src/lib/waitlist.ts" }],
  "wl.expire": [{ file: "server/src/lib/sweeps.ts" }, { file: "server/src/lib/waitlist.ts" }],
  "req.approve": [{ file: "server/src/routes/bookings.ts", start: "^bookings\\.post\\(\"/:ref/actions\"" }, { file: "features/bookings/mutations.ts" }],
  "req.decline": [{ file: "server/src/routes/bookings.ts", start: "^bookings\\.post\\(\"/:ref/actions\"" }, { file: "features/bookings/mutations.ts" }],
  "refund": [{ file: "server/src/routes/bookings.ts", start: "^bookings\\.post\\(\"/:ref/actions\"" }, { file: "server/src/lib/refundRows.ts" }, { file: "lib/cancellation.ts" }, { file: "server/src/lib/wallet.ts" }],
  "listing.duplicate": [{ file: "server/src/routes/listings.ts", start: "^listings\\.post\\(\"/\"" }, { file: "server/src/lib/listingRules.ts" }],
  "listing.edit": [{ file: "server/src/routes/listings.ts", start: "^listings\\.put\\(\"/:id\"" }, { file: "server/src/lib/listingRules.ts" }],
  "listing.unpublish": [{ file: "server/src/lib/listingVisibility.ts" }, { file: "server/src/routes/listings.ts", start: "^listings\\.put\\(\"/:id\"" }],
  "embed.book": [{ file: "public/embed.js" }],
  "ui.phone": [],
};

/** Axis tokens: a code unit "reads" an axis when one of these appears in it (comments stripped). */
export const AXIS_TOKENS: Partial<Record<AxisId, RegExp>> = {
  loc: /deliveryMode|coverageArea|serviceAddress|videoMode|ownLink|onlineSession|kind\s*===\s*["']online/,
  cap: /capacityScope|maxAttendees|ageCaps?\b|ticketOverrides|dayFull|spotsLeft|countsUpdate|blockCountDelta|passCap/,
  appr: /bookingType|["']Approval needed["']|allowOutOfRange|needsApproval/,
  wl: /waitlist|["']Waitlisted["']|["']Offered["']|offerExpires/i,
  disc: /discount|earlyBird|listPrice|coupon/i,
  addon: /add-?ons?\b|addonLines|addonIds/i,
  pol: /cancellationPolic|policyById|refundFor|\bpolicy\b/i,
};
/** Axes the token scan cannot see: an action depends on these by construction. */
export const EXTRA_DEP: Record<string, AxisId[]> = {
  "book": ["shape", "price"],
  "pay.card": ["price", "shape"],
  "pay.bank": ["price"], "pay.cash": ["price"], "pay.tfc": ["price"], "pay.voucher": ["price"], "pay.partial": ["price"],
  "pay.wallet": ["price"], "wallet.use": ["price"],
  "cancel.whole": ["shape", "price"], "cancel.child": ["shape", "price"], "cancel.afterstart": ["price"], "cancel.provider": ["shape", "price"],
  "amend.date": ["shape"],
  "wl.join": ["shape"], "wl.offer": ["shape"], "wl.accept": ["price"], "wl.decline": [], "wl.expire": [],
  "req.approve": ["price"], "req.decline": [],
  "refund": ["price"],
  "listing.duplicate": ["loc", "shape", "cap", "appr", "wl", "price", "disc", "addon", "pol"],
  "listing.edit": ["shape"],
  "listing.unpublish": [],
  "embed.book": [],
  "ui.phone": ["loc", "shape", "cap", "appr", "wl", "price", "disc", "addon", "pol"],
};

/** Pairs that cannot happen. `source` is grep-verified so the rule can't rot. */
export interface NotAllowed { id: string; cols: string[]; rows: string[]; rule: string; source: { file: string; match: string } }
export const NOT_ALLOWED: NotAllowed[] = [
  {
    id: "NA-wl-off", cols: ["wl.join", "wl.offer", "wl.accept", "wl.decline", "wl.expire"], rows: ["wl.off"],
    rule: "With the waiting list off, a full day refuses the booking (409 '... and the waitlist is off'), so no waitlisted booking exists to offer, accept, decline or expire.",
    source: { file: "server/src/routes/my.ts", match: "the waitl" },
  },
  {
    id: "NA-approve-auto", cols: ["req.approve", "req.decline"], rows: ["appr.auto"],
    rule: "An auto-confirm listing places bookings as Confirmed (bookingType === 'auto'); 'Approval needed' only arises for manual approval, out-of-range children or a held answer, which are their own rows.",
    source: { file: "server/src/routes/my.ts", match: "listing.bookingType === \"auto\" ? \"Confirmed\" : \"Approval needed\"" },
  },
  {
    id: "NA-pay-free", cols: ["pay.card", "pay.bank", "pay.wallet", "pay.cash", "pay.tfc", "pay.voucher", "pay.partial", "wallet.use", "refund"], rows: ["price.free"],
    rule: "A GBP 0 / funded ticket owes nothing: card payment answers 409 'Nothing to pay', and there is no money to take, apply or refund.",
    source: { file: "server/src/routes/payments.ts", match: "Nothing to pay" },
  },
];

// ---------------------------------------------------------------------------------------------------------------------------
// EVIDENCE. Every citation is verified by `grid.ts --verify`: pure -> the test title exists in the file; report -> the results JSON has
// a passing entry whose key contains the text; script -> the file contains the pattern; tracker -> the catalogue id exists.
// A claim says "this evidence exercises these rows under these actions". Only cite what you have read.
// ---------------------------------------------------------------------------------------------------------------------------
export type Ref =
  | { kind: "pure"; file: string; test: string }
  | { kind: "report"; file: string; key: string }
  | { kind: "script"; file: string; match: string }
  | { kind: "tracker"; id: string }
  | { kind: "fuzz"; area: string; action: string };

export interface Claim { id: string; what: string; refs: Ref[]; rows: string[]; cols: string[] }

// shorthand
const P = (file: string, test: string): Ref => ({ kind: "pure", file, test });
const R = (dir: string, key: string, file = "results.json"): Ref => ({ kind: "report", file: `e2e/review/shots/${dir}/${file}`, key });
const S = (file: string, match: string): Ref => ({ kind: "script", file, match });

export const CLAIMS: Claim[] = [];
export const claim = (c: Claim) => { CLAIMS.push(c); };

// ---- things only a human with real money / a real device can prove --------------------------------------------------------------
// Shown as a blue checklist under the matrix. Set done to a date string (e.g. "2026-10-07") once Kaz has checked it and the result is verified in the database.
export interface HumanCheck { id: string; cols: string[]; what: string; how: string; done?: string }
export const HUMAN: HumanCheck[] = [
  { id: "H1", cols: ["pay.card"], what: "Real card payment, GBP 0.30", how: "Book as a parent with a real card; pilot-check the booking (payment record, one receipt, reconcile)." },
  { id: "H2", cols: ["refund"], what: "Real card refund", how: "Refund the H1 booking; confirm the money returns to the card and the booking, wallet and finance figures agree." },
  { id: "H3", cols: ["pay.card"], what: "3-D Secure on a real bank card", how: "Pay with a card that asks for bank approval; the booking must confirm after approval and not before." },
  { id: "H4", cols: ["pay.tfc"], what: "Real Tax-Free Childcare payment", how: "Pay with a real childcare account; provider marks it received." },
  { id: "H5", cols: ["pay.bank"], what: "Real bank transfer", how: "Transfer to the provider, provider marks it paid, receipt sent once." },
  { id: "H6", cols: ["ui.phone", "book"], what: "Whole booking on a real iPhone", how: "Browse, choose dates, add children, pay, confirmation page with times and Message button." },
  { id: "H7", cols: ["ui.phone"], what: "Provider screens on a real phone", how: "Dashboard, registers, bookings list, messages, banner and bottom tabs." },
  { id: "H8", cols: ["book"], what: "Confirmation email in real inboxes", how: "Gmail on iPhone, Outlook, and forwarded to a laptop: dates stacked, nothing blank." },
  { id: "H9", cols: ["embed.book"], what: "Embed on a real provider website", how: "Book through the embedded widget on the live site, pay, confirm." },
  { id: "H10", cols: ["pay.card", "refund", "book"], what: "Real-money pilot, first 10-20 bookings", how: "Run the pilot tool on each of the first real bookings (HQ manual, Pilot page)." },
];
