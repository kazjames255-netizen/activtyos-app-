/**
 * The open work, as of 8 Sept 2026.
 *
 * Everything here is CONFIRMED — either by the 9-agent portal audit (which
 * verified each finding adversarially before keeping it) or by the 5-reviewer
 * critique of the test plan, which read the code rather than the screens.
 * Nothing speculative is in this list.
 *
 * Tick items off as they land. Anything still open on 11 Sept is something the
 * 28-day run will hit — the `step` field says where.
 */

export type Who = "amir" | "claude" | "kaz" | "decision";

export interface BacklogItem {
  id: string;
  title: string;
  detail: string;
  who: Who;
  severity: "critical" | "high" | "medium";
  /** Where it lives, so it can be found. */
  file?: string;
  /** The test step that will catch it if it isn't fixed. */
  step?: string;
}

export const BACKLOG: BacklogItem[] = [
  // ── Critical: data exposure ────────────────────────────────────────────────
  {
    id: "b1", who: "amir", severity: "critical",
    title: "A staff token reads the whole tenant's money and DBS records",
    detail: "operatorScope() treats role \"staff\" as an operator (isOperator = role !== \"parent\"), so a coach's token returns /api/payments, /api/bookings, /api/customers, /api/reconciliation and /api/dashboard. compliance.ts has no per-person filter, so it also returns every colleague's DBS reference and certificate number. The screens are hidden; the data is not. This is special-category and criminal-records data.",
    file: "server/src/middleware/role.ts, server/src/routes/payments.ts:199, compliance.ts:51", step: "d24s3",
  },
  {
    id: "b2", who: "amir", severity: "critical",
    title: "Every photo of a child is on a public, unauthenticated, permanent URL",
    detail: "/api/images/:id is mounted above requireAuth and has no tenant check or expiry. That includes Moments photos and injury photos attached to accident records. Anyone with the link — forever, including after a family leaves.",
    file: "server/src/index.ts (images mount)", step: "d20s7",
  },
  {
    id: "b3", who: "amir", severity: "critical",
    title: "There is no way to switch an account off",
    detail: "No disabled/suspended flag on the user doc, no check in the auth middleware, and PATCH /api/invites/:token/status does not exist. Sign-out, password change and \"Deactivate\" all leave a working token. An ex-employee keeps access to children's records. The UI now says so out loud, which is a warning, not a fix.",
    file: "server/src/middleware/auth.ts, features/team/TeamApp.tsx:190", step: "d15s9",
  },
  {
    id: "b4", who: "amir", severity: "critical",
    title: "A staff invite is not bound to the address it was sent to",
    detail: "Anyone who gets the link can redeem it, and it isn't single-use. A forwarded invite is an account with access to children's records.",
    file: "server/src/routes/invites.ts", step: "d15s2",
  },
  {
    id: "b5", who: "amir", severity: "critical",
    title: "Any staff account can read every safeguarding concern in the tenant",
    detail: "Including allegations that name a colleague. There is no per-person or per-role filter on incidents.",
    file: "server/src/routes/incidents.ts", step: "d13s4",
  },
  {
    id: "b6", who: "decision", severity: "critical",
    title: "No audit trail — we cannot answer \"who saw this child's record\"",
    detail: "The safeguarding policy we published claims records are attributed. Creation is attributed; ACCESS is not logged anywhere. If a family asks who read their child's file, there is no answer.",
    step: "d28s8",
  },

  // ── Critical: money ───────────────────────────────────────────────────────
  {
    id: "b7", who: "amir", severity: "critical",
    title: "No Stripe Connect webhook — a payment may only be recorded if the browser calls back",
    detail: "If a parent closes the tab as the payment confirms, the charge may succeed at Stripe and never be recorded against the booking. Establish whether this is true before Day 6; if it is, it is the single most expensive bug in the product.",
    file: "server/src/lib/stripe.ts", step: "d6s4",
  },
  {
    id: "b8", who: "amir", severity: "critical",
    title: "Day 8 may be testing a TFC checkout that doesn't exist yet",
    detail: "Reviewers could not find a Tax-Free Childcare payment method in the checkout. This is the headline deliverable due 18 Sept. Confirm scope with Amir now rather than discovering it on the day.",
    step: "d8s1",
  },
  {
    id: "b9", who: "amir", severity: "high",
    title: "Refunding a TFC/voucher booking emails \"back to your card\" and moves no money",
    detail: "The booking is marked Refunded, the parent is told the money is going back to a card that was never charged, and nothing actually moves.",
    file: "server/src/routes/my.ts", step: "d9s4",
  },
  {
    id: "b10", who: "amir", severity: "high",
    title: "Partially-paid cancellations are quoted a £0 refund",
    detail: "The refund reads `amount` only when pay === \"Paid\" and ignores amountPaid entirely. Pay a £150 deposit on a £200 place, cancel under a 100% policy, get offered nothing.",
    file: "server/src/routes/my.ts:2021", step: "d9s2",
  },
  {
    id: "b11", who: "amir", severity: "high",
    title: "Paying an invoice doesn't settle the booking",
    detail: "A family can pay the same money twice and Money-in counts it twice.",
    step: "d9s5",
  },
  {
    id: "b12", who: "amir", severity: "high",
    title: "Card refunds are fire-and-forget",
    detail: "A Stripe failure reaches nothing but the server console. The operator believes the refund happened.",
    step: "d9s3",
  },
  {
    id: "b13", who: "amir", severity: "high",
    title: "Cancelling a wallet-paid booking destroys the credit",
    detail: "The family loses money they had already paid in.",
    step: "d7s5",
  },
  {
    id: "b14", who: "amir", severity: "high",
    title: "Membership join is uncapped — join, cancel, join again mints credit",
    detail: "The authorisation hole (joining a provider you've never used) was fixed on 8 Sept. The repeat-join hole was not.",
    file: "server/src/routes/memberships.ts", step: "d7s2",
  },

  // ── Franchise isolation, blocked on a data decision ───────────────────────
  {
    id: "b15", who: "decision", severity: "critical",
    title: "Four franchise routes still return the whole network — and can't simply be filtered",
    detail: "trips, compliance, referrals and availability documents carry NO franchiseId at all, so filtering on it would empty the pages rather than secure them. Each needs an ownership derivation (trip→listing, certificate→staff user, referral→booking) plus a backfill. children/reviews/tasks/invites were fixed on 8 Sept because their data did carry it.",
    file: "docs/franchise-isolation-handoff.md", step: "d22s4",
  },
  {
    id: "b16", who: "amir", severity: "high",
    title: "A franchise's Setup changes save to a document nothing reads",
    detail: "libDocId() writes libraries/{tenantId}__fr__{franchiseId}, but every server-side consumer reads libraries/{tenantId}. A franchise turning on a safety setting achieves nothing.",
    file: "server/src/routes/library.ts:50", step: "d22s8",
  },
  {
    id: "b17", who: "amir", severity: "high",
    title: "The notification bell obeys none of the scoping the routes enforce",
    detail: "Every franchise and every staff member sees events they shouldn't.",
    step: "d22s7",
  },

  // ── Correctness that harms a child or a claim ─────────────────────────────
  {
    id: "b18", who: "amir", severity: "critical",
    title: "Two siblings on one booking count as one child on registers and ratios",
    detail: "The ratio is a compliance claim. If the count is wrong, the claim is false — and one child is missing from the register.",
    step: "d10s3",
  },
  {
    id: "b19", who: "amir", severity: "critical",
    title: "A parent who DECLINES trip consent may still leave their child on the trip",
    detail: "The gate tests for 'pending', not for an explicit decline. It is also switchable off per trip, which makes it not a gate.",
    step: "d14s5",
  },
  {
    id: "b20", who: "amir", severity: "critical",
    title: "A provider can reverse a parent's withdrawal of medication consent",
    detail: "And nothing records that it happened. We publicly claim consent is enforced.",
    step: "d12s6",
  },
  {
    id: "b21", who: "amir", severity: "high",
    title: "Children are resolved by NAME in medication, meals and trips",
    detail: "Renaming or deleting a child breaks or misattributes their records.",
    step: "d14s8",
  },
  {
    id: "b22", who: "amir", severity: "high",
    title: "Cancel a booking while a child is signed in and they vanish from the register",
    detail: "They can never be marked out. On the day, that is a child unaccounted for.",
    step: "d10s4",
  },
  {
    id: "b23", who: "amir", severity: "high",
    title: "Editing a listing after it has bookings silently deletes that day's register",
    detail: "No warning, no migration of the affected bookings.",
    step: "d6s8",
  },

  // ── Evidence that isn't durable ───────────────────────────────────────────
  {
    id: "b24", who: "amir", severity: "critical",
    title: "Documents, read receipts and the Single Central Record are browser localStorage",
    detail: "Your safeguarding evidence — who read which policy version, and the safer-recruitment record — exists on one laptop and dies with a cleared cache. Days 15 and 17 would pass in one browser and be worthless.",
    step: "d17s3",
  },
  {
    id: "b25", who: "amir", severity: "high",
    title: "Register notes and nappy changes are stored in the browser, not the tenant",
    detail: "Two staff on two phones do not see each other's entries.",
    step: "d10s5",
  },

  // ── Front-end, mine ───────────────────────────────────────────────────────
  {
    id: "b26", who: "claude", severity: "high",
    title: "HQ Sales pipeline crashes on any real demo lead",
    detail: "FIXED 8 Sept. The leads collection has two writers with different shapes: the public demo form stores {name, message, status} with no contactName, stage, plan, estMrr or activities, while the board read l.activities[0], l.estMrr and l.stage. One genuine inbound lead took the whole page down. Now normalised on load rather than guarded at each of six read sites. Step d28s2 re-verifies it.",
    file: "features/platform/SalesApp.tsx:183", step: "d28s2",
  },
  {
    id: "b27", who: "claude", severity: "high",
    title: "Impersonation serves the wrong account's identity",
    detail: "setActAs is called without clearMeCache, so the cached /api/me keeps the HQ identity while the API serves the impersonated account. Exiting can strand you outside HQ.",
    file: "components/shell/AccountPicker.tsx:39, ImpersonationBar.tsx:24", step: "d28s3",
  },
  {
    id: "b28", who: "claude", severity: "medium",
    title: "A company with no franchises gets the franchisor dashboard",
    detail: "CompanyDashboardSwitch checks only useHoScope(), not hasFranchises, so a plain company can never reach the operational dashboard.",
    file: "features/franchise/CompanyDashboardSwitch.tsx:12", step: "d23s2",
  },
  {
    id: "b29", who: "claude", severity: "medium",
    title: "Deleted staff resurrect as six fabricated demo names",
    detail: "Emptying the staff library on Ratios causes the listings page to re-upload Marcus Bell, Jess Patel and four others to the tenant — where they can reach a customer-facing page.",
    file: "features/listings/FreelancerListingsApp.tsx:187", step: "d3s6",
  },
  {
    id: "b30", who: "claude", severity: "medium",
    title: "Parent typing lands unescaped in outbound provider emails",
    detail: "A child's name can carry a link into an email the provider sends.",
    step: "d20s4",
  },
  {
    id: "b31", who: "amir", severity: "medium",
    title: "The unsubscribe link is unsigned base64 of tenantId:email",
    detail: "Anyone can suppress any address.",
    step: "d20s5",
  },

  // ── Operations ────────────────────────────────────────────────────────────
  {
    id: "b32", who: "amir", severity: "critical",
    title: "Nothing is deployed — there is no staging environment",
    detail: "28 days of localhost followed by a cold go-live tests nothing about hosting, HTTPS, env vars, cold starts or latency. DEPLOY.md documents 8 of the 43 environment variables.",
    step: "d1s1",
  },
  {
    id: "b33", who: "amir", severity: "critical",
    title: "Mail is off by default and a skipped send reports success",
    detail: "Every 'the parent was emailed' and 'the DSL was alerted' step is unfalsifiable until this is on.",
    step: "d1s2",
  },
  {
    id: "b34", who: "amir", severity: "high",
    title: "No monitoring, no error boundary, no not-found page",
    detail: "A broken page is a white screen, and nobody would know it broke in production until a customer rang.",
    step: "d27s3",
  },
  {
    id: "b35", who: "amir", severity: "high",
    title: "\"Today\" is computed in UTC in ~40 server files",
    detail: "During British Summer Time that is yesterday until 01:00. The clocks go back on 25 Oct — the Sunday before autumn half-term.",
    step: "d27s5",
  },
  {
    id: "b36", who: "amir", severity: "high",
    title: "The dashboard reads four entire collections per load, with no pagination",
    detail: "The client aborts at 15 seconds. A provider with a real season's data may never see their dashboard, and the Firestore bill is per load.",
    file: "server/src/routes/dashboard.ts", step: "d18s1",
  },
  {
    id: "b37", who: "amir", severity: "high",
    title: "\"Delete my data\" writes a document nothing ever reads",
    detail: "A subject access export is also materially incomplete. Both are legal obligations, not features.",
    step: "d21s7",
  },
  {
    id: "b38", who: "claude", severity: "high",
    title: "Medication, incident and messaging screens are English-only in every language",
    detail: "care.ts, comms.ts, tasks.ts, listings.ts and workforce.ts are empty stubs for every locale; pa, bn, pt and cy have no base catalogue. A parent consents to medication in a language they cannot read.",
    step: "d20s10",
  },
  {
    id: "b39", who: "decision", severity: "medium",
    title: "No rate limiting anywhere, and /docs serves the whole API surface publicly",
    detail: "The public endpoints — including the provider directory — can be hit without limit.",
    step: "d5s5",
  },
];

export const bySeverity = (a: BacklogItem, b: BacklogItem) =>
  ({ critical: 0, high: 1, medium: 2 })[a.severity] - ({ critical: 0, high: 1, medium: 2 })[b.severity];
