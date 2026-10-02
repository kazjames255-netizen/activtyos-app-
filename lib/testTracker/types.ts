// Test tracker: the SCENARIO CATALOGUE lives in code (lib/testTracker/catalogue.ts, versioned in git); the RESULTS live in Firestore
// (testTrackerResults/{checkId}) so Kaz, Amir and Claude all see the same state.

export type AccountKind = "company" | "freelancer" | "franchise" | "head-office" | "staff" | "parent" | "platform";

/** The big groups the tracker is organised by (the order here is the order on the page). */
export type Area =
  | "listing-types"        // every kind of listing and how it is set up
  | "passes-pricing"       // passes, timings, add-ons, meals, extras, prices
  | "discounts"            // sibling, multi-day, codes, early-bird, referral, wallet, memberships
  | "payments"             // card, voucher, Tax-Free Childcare, HAF, cash, bank transfer, part-payments
  | "booking-main"         // the parent booking page, start to finish
  | "booking-quick"        // quick book / book for a customer (provider side)
  | "booking-embed"        // the embedded widget and shared links / QR
  | "approval-waitlist"    // approval-needed, out-of-range, waitlist and offers
  | "cancellations"        // parent cancels, provider cancels, partial, refunds, wallet credit
  | "amendments"           // change dates, add or remove days, swap child, move to another listing
  | "children-families"    // child profiles, questions, SEND/EHCP, consents, families list
  | "registers-day"        // registers, attendance, collection, ratios on the day
  | "messages-emails"      // notifications, bells and emails around bookings
  | "finance-dashboard";   // Money in, reconciliation, invoices, dashboard figures vs bookings

export type Status = "todo" | "pass" | "fail" | "blocked" | "fixed" | "na";

export interface TestCheck {
  /** Stable id, e.g. "LT-001". Never reuse or renumber. */
  id: string;
  area: Area;
  /** Short plain-English name of the scenario. */
  title: string;
  /** Which kinds of account this must be tried on. */
  accounts: AccountKind[];
  /** What must exist first (listing type, a paid booking, a code...). */
  setup?: string;
  /** Click-by-click, plain words. */
  steps: string[];
  /** What you should see, one line each. */
  expected: string[];
  /** The numbers Claude checks afterwards (booking total, Money in, dashboard income, refund, wallet, capacity). */
  moneyCheck?: string;
  /** What Claude verifies in the data/server logs once Kaz says it was done. */
  claudeCheck?: string;
  /** 1 = must work for launch, 2 = important, 3 = nice to have. */
  priority: 1 | 2 | 3;
}

export interface CheckResult {
  checkId: string;
  status: Status;
  /** One result per account kind tried, e.g. { company: "pass", freelancer: "fail" }. */
  byAccount?: Partial<Record<AccountKind, Status>>;
  note?: string;
  /** Short bug description and the fix, filled in as we go. */
  bug?: string;
  fix?: string;
  updatedBy?: string;
  updatedAt?: string;
  history?: { at: string; by: string; status: Status; note?: string }[];
}
