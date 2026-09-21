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
 *
 * 12 Sept overnight run: items whose detail starts "FIXED 12 Sept" were fixed
 * in code and checked (types, targeted tests, and live reads where the data
 * allowed). Their step now tests the FIX — a fail there is a regression.
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
  // ── Childcare payments / TFC — added 9 Sept 2026 after the Iryna call ──────
  {
    id: "cc1", who: "decision", severity: "high",
    title: "Marketing opt-in is set to YES automatically when a family signs up through a provider link",
    detail: "POST /api/my/providers/follow creates the customer with marketingOptIn: true, stamped marketingSource \"Signed up through the provider's booking link\". Set on your instruction. CHECK: the signup/storefront page needs visible consent wording next to the button, because the record now asserts they agreed to hear from the provider. UK PECR treats marketing email as needing consent that the person actually gave — an implied opt-in with no wording on screen is the part that would be challenged, not the flag itself. Decide the wording, or make it a tick.",
    file: "server/src/routes/my.ts (providers/follow), features/storefront/StorePage.tsx", step: "d8s10",
  },
  {
    id: "cc2", who: "decision", severity: "high",
    title: "Two conflicting models for how TFC gets reconciled",
    detail: "The Reconciliation page's TFC banner says HMRC settles automatically via the EPP integration and there is nothing to reconcile by hand (docs/listings-backend-handoff.md §S). The build spec written from the Iryna call describes a manual tick-off against the bank statement (docs/tfc-build-spec.md, Part B). Both are in the product right now. Pick one before Amir builds — it changes what the operator is asked to do every week.",
    file: "docs/tfc-build-spec.md, features/reconciliation/ReconciliationApp.tsx", step: "d8s11",
  },
  {
    id: "cc3", who: "kaz", severity: "medium",
    title: "59 voucher bookings do not say which voucher company paid",
    detail: "Every voucher booking in the database is a bare method \"Childcare voucher\" with no voucherScheme, so they can't be told apart when matching the bank. The checkout captures the company going forward (the parent picks from settings.voucherProviders), and a \"Which provider?\" picker on each unnamed row fixes historic ones — but one at a time. CHECK whether a bulk fix is worth it, or whether these are old enough to leave.",
    file: "features/reconciliation/ReconciliationApp.tsx", step: "d8s11",
  },
  {
    id: "cc4", who: "kaz", severity: "medium",
    title: "Check the childcare figures and the Unreconciled tab against your own books",
    detail: "New: a childcare roll-up on Reconciliation (gross / confirmed by booker / unconfirmed / reconciled / unreconciled / missing a reference), scoped to whichever payment tab you're on, and an \"Unreconciled\" tab on Bookings. Both use one shared rule — card is excluded (Stripe settles it) and so are waitlisted/offered/approval-needed bookings, which have no place yet so owe nothing. CHECK the totals against what you believe is outstanding.",
    file: "features/reconciliation/ReconciliationApp.tsx, features/bookings/helpers.ts", step: "d18s4",
  },
  {
    id: "cc5", who: "amir", severity: "high",
    title: "Reconciled rows can say auto vs by hand — nothing sets auto yet",
    detail: "Booking.reconciledBy = { at, by, auto } is now stamped when someone ticks a payment off, and the badge reads \"Reconciled by hand · <name>\" or \"Auto-reconciled\". Rows settled before this exists show a plain \"Reconciled\" and claim nothing. When the HMRC EPP feed lands it should stamp auto: true — that's the only wiring needed for TFC rows to start reading as automatic.",
    file: "server/src/routes/bookings.ts (reconcile), features/reconciliation/ReconciliationApp.tsx", step: "d8s11",
  },
  {
    id: "cc6", who: "kaz", severity: "medium",
    title: "A family who opens a provider's link should appear in that provider's Families",
    detail: "Opening /store/{tenantId} while signed in now links the family to that provider: they resolve it in their portal (Browse, branding) and the provider sees them in Families with the note \"Signed up through your booking link — no bookings yet\". They are listed regardless of marketing opt-in — the Families list filters on tenant only. CHECK end to end with a real second account, and that it does NOT fire when the storefront is embedded in someone else's website.",
    file: "server/src/routes/my.ts, features/storefront/StorePage.tsx", step: "d8s10",
  },
  // ── Critical: data exposure ────────────────────────────────────────────────
  {
    id: "b1", who: "amir", severity: "critical",
    title: "A staff token reads the whole tenant's money and DBS records",
    detail: "FIXED 12 Sept. managerScope() (middleware/role.ts) refuses staff on /api/payments, /payments/status, /reconciliation, /dashboard and /bookings/:ref/children; staff get bookings WITHOUT money fields; compliance returns a staff member only their own certificates. Verified live with a staff token: 403 ×4, 182 bookings with no amounts. operatorScope() treats role \"staff\" as an operator (isOperator = role !== \"parent\"), so a coach's token returns /api/payments, /api/bookings, /api/customers, /api/reconciliation and /api/dashboard. compliance.ts has no per-person filter, so it also returns every colleague's DBS reference and certificate number. The screens are hidden; the data is not. This is special-category and criminal-records data.",
    file: "server/src/middleware/role.ts, server/src/routes/payments.ts:199, compliance.ts:51", step: "d24s3",
  },
  {
    id: "b2", who: "amir", severity: "critical",
    title: "Every photo of a child is on a public, unauthenticated, permanent URL",
    detail: "FIXED 12 Sept for new uploads. Moments and incident photos/attachments upload as private and are served only on HMAC-signed links that expire (lib/signing.ts); lists re-sign on every read. STILL OPEN for images uploaded before 12 Sept until server/src/backfillPrivateImages.ts is run (Amir #53). /api/images/:id is mounted above requireAuth and has no tenant check or expiry. That includes Moments photos and injury photos attached to accident records. Anyone with the link — forever, including after a family leaves.",
    file: "server/src/index.ts (images mount)", step: "d20s7",
  },
  {
    id: "b3", who: "amir", severity: "critical",
    title: "There is no way to switch an account off",
    detail: "FIXED 12 Sept. users.disabled / deactivatedAt are refused in attachRole; Team → Deactivate calls the real PATCH /api/invites/:token/status, which disables the account and revokes its sessions. No disabled/suspended flag on the user doc, no check in the auth middleware, and PATCH /api/invites/:token/status does not exist. Sign-out, password change and \"Deactivate\" all leave a working token. An ex-employee keeps access to children's records. The UI now says so out loud, which is a warning, not a fix.",
    file: "server/src/middleware/auth.ts, features/team/TeamApp.tsx:190", step: "d15s9",
  },
  {
    id: "b4", who: "amir", severity: "critical",
    title: "A staff invite is not bound to the address it was sent to",
    detail: "FIXED 12 Sept. Accept is bound to the invited address (403 otherwise) and single-use was already fixed. Remaining: require a VERIFIED email once verification mail is on. Anyone who gets the link can redeem it, and it isn't single-use. A forwarded invite is an account with access to children's records.",
    file: "server/src/routes/invites.ts", step: "d15s2",
  },
  {
    id: "b5", who: "amir", severity: "critical",
    title: "Any staff account can read every safeguarding concern in the tenant",
    detail: "FIXED 12 Sept. Staff see accidents/incidents but only the safeguarding (or confidential) records they logged themselves — list and dossier. Including allegations that name a colleague. There is no per-person or per-role filter on incidents.",
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
    detail: "FIXED 12 Sept. A voucher/TFC/cash refund is recorded as an offline 'to-reimburse' payment and the family is told it comes back the way they paid, not to a card. The booking is marked Refunded, the parent is told the money is going back to a card that was never charged, and nothing actually moves.",
    file: "server/src/routes/my.ts", step: "d9s4",
  },
  {
    id: "b10", who: "amir", severity: "high",
    title: "Partially-paid cancellations are quoted a £0 refund",
    detail: "FIXED 12 Sept. paidSoFar() (features/bookings/helpers.ts) — both cancel paths and the operator cancel refund from what was actually paid, incl. part payments; card confirm now records amountPaid. The refund reads `amount` only when pay === \"Paid\" and ignores amountPaid entirely. Pay a £150 deposit on a £200 place, cancel under a 100% policy, get offered nothing.",
    file: "server/src/routes/my.ts:2021", step: "d9s2",
  },
  {
    id: "b11", who: "amir", severity: "high",
    title: "Paying an invoice doesn't settle the booking",
    detail: "FIXED 12 Sept. settleInvoiceBooking() (routes/invoices.ts) settles the linked booking on the pay-link confirm and on manual 'paid'; idempotent via bookingSettledAt. A family can pay the same money twice and Money-in counts it twice.",
    step: "d9s5",
  },
  {
    id: "b12", who: "amir", severity: "high",
    title: "Card refunds are fire-and-forget",
    detail: "FIXED 12 Sept. Refund-approve now WAITS for Stripe (idempotency-keyed), puts the refund back to pending with the reason if it fails, and refuses a second approval. A Stripe failure reaches nothing but the server console. The operator believes the refund happened.",
    step: "d9s3",
  },
  {
    id: "b13", who: "amir", severity: "high",
    title: "Cancelling a wallet-paid booking destroys the credit",
    detail: "FIXED 12 Sept. Wallet credit spent on a booking counts towards what was paid and always goes back to the wallet on an approved refund. The family loses money they had already paid in.",
    step: "d7s5",
  },
  {
    id: "b14", who: "amir", severity: "high",
    title: "Membership join is uncapped — join, cancel, join again mints credit",
    detail: "FIXED 12 Sept. Credit is paid once per monthly period per family (creditPaidUntil survives cancel/re-join, set in a transaction); re-joining the same tier is refused. The authorisation hole (joining a provider you've never used) was fixed on 8 Sept. The repeat-join hole was not.",
    file: "server/src/routes/memberships.ts", step: "d7s2",
  },

  // ── Franchise isolation, blocked on a data decision ───────────────────────
  {
    id: "b15", who: "decision", severity: "critical",
    title: "Four franchise routes still return the whole network — and can't simply be filtered",
    detail: "MOSTLY FIXED 12 Sept. Trips and shifts stamp franchiseId (legacy ones are claimed via their children / listing); compliance is narrowed to the franchise's own team and rota (lib/franchiseScope franchiseTeam) or certificates it added; referrals to the franchise's own families; availability requests to its own people (and stamped from now on). Remaining: a real staff→certificate id (certs match by NAME) and a backfill. trips, compliance, referrals and availability documents carry NO franchiseId at all, so filtering on it would empty the pages rather than secure them. Each needs an ownership derivation (trip→listing, certificate→staff user, referral→booking) plus a backfill. children/reviews/tasks/invites were fixed on 8 Sept because their data did carry it.",
    file: "docs/franchise-isolation-handoff.md", step: "d22s4",
  },
  {
    id: "b16", who: "amir", severity: "high",
    title: "A franchise's Setup changes save to a document nothing reads",
    detail: "MOSTLY FIXED 12 Sept. lib/tenantLibrary.ts — every safety/decision reader now uses the franchise's own settings (medication, trips, incidents, staff policy, cancellation policies, meals, customer-page library, notifications). Emails/reminders, referrals, memberships, reviews still read head office's. libDocId() writes libraries/{tenantId}__fr__{franchiseId}, but every server-side consumer reads libraries/{tenantId}. A franchise turning on a safety setting achieves nothing.",
    file: "server/src/routes/library.ts:50", step: "d22s8",
  },
  {
    id: "b17", who: "amir", severity: "high",
    title: "The notification bell obeys none of the scoping the routes enforce",
    detail: "FIXED 12 Sept. Alerts are tagged with their franchise (worked out from the record); a franchise sees only its own; staff see operational categories only (no billing/bookings/incidents); read state is per person. Every franchise and every staff member sees events they shouldn't.",
    step: "d22s7",
  },

  // ── Correctness that harms a child or a claim ─────────────────────────────
  {
    id: "b18", who: "amir", severity: "critical",
    title: "Two siblings on one booking count as one child on registers and ratios",
    detail: "FIXED 12 Sept. lib/registerRows.ts — one row per CHILD on registers, ratios, the meals board, the register sweeps and the AI's day summary; each sibling's own allergies. Old joint marks carry over. The ratio is a compliance claim. If the count is wrong, the claim is false — and one child is missing from the register.",
    step: "d10s3",
  },
  {
    id: "b19", who: "amir", severity: "critical",
    title: "A parent who DECLINES trip consent may still leave their child on the trip",
    detail: "FIXED 12 Sept. A parent's decision can't be overwritten by staff (and a provider-recorded one is stamped with who); the gate bites at sign-off as well as completion and ignores the per-trip askConsent switch; changing askConsent is manager-only; 'who can plan' enforced server-side. A decline = not going (unchanged). The gate tests for 'pending', not for an explicit decline. It is also switchable off per trip, which makes it not a gate.",
    step: "d14s5",
  },
  {
    id: "b20", who: "amir", severity: "critical",
    title: "A provider can reverse a parent's withdrawal of medication consent",
    detail: "FIXED 12 Sept. A withdrawn consent can't be re-granted or un-archived by the provider (409 — the parent must re-authorise); every provider consent change is stamped and kept in consentHistory. And nothing records that it happened. We publicly claim consent is enforced.",
    step: "d12s6",
  },
  {
    id: "b21", who: "amir", severity: "high",
    title: "Children are resolved by NAME in medication, meals and trips",
    detail: "FIXED 12 Sept. Renaming a child rewrites the name on every booking (incl. siblings in kids[]); the medication and trip name fallbacks now link only an UNAMBIGUOUS name (two children called the same → left unlinked, never the wrong parent). Remaining nicety: pickers should always send childId. Renaming or deleting a child breaks or misattributes their records.",
    step: "d14s8",
  },
  {
    id: "b22", who: "amir", severity: "high",
    title: "Cancel a booking while a child is signed in and they vanish from the register",
    detail: "FIXED 12 Sept. A child signed in and not collected stays on the register after a cancel (flagged 'Booking cancelled — still on site'), and can still be signed out. They can never be marked out. On the day, that is a child unaccounted for.",
    step: "d10s4",
  },
  {
    id: "b23", who: "amir", severity: "high",
    title: "Editing a listing after it has bookings silently deletes that day's register",
    detail: "FIXED 12 Sept. A listing (or block) edit that would remove a date with bookings is refused BEFORE anything is written, naming the dates and headcounts. No warning, no migration of the affected bookings.",
    step: "d6s8",
  },

  // ── Evidence that isn't durable ───────────────────────────────────────────
  {
    id: "b24", who: "amir", severity: "critical",
    title: "Documents, read receipts and the Single Central Record are browser localStorage",
    detail: "FIXED 12 Sept (both halves). Documents, files and read receipts: routes/documents.ts. Onboarding / Single Central Record: routes/onboarding.ts — records per person, scans in a private file store only a manager or the person can open (never a colleague), staff can't touch the employer's verification; screens show the real team, not the demo cast. STILL OWED: encryption at rest + a retention period for bank details / NI / ID scans (Amir doc). Original: Your safeguarding evidence — who read which policy version, and the safer-recruitment record — exists on one laptop and dies with a cleared cache. Days 15 and 17 would pass in one browser and be worthless.",
    step: "d17s3",
  },
  {
    id: "b25", who: "amir", severity: "high",
    title: "Register notes and nappy changes are stored in the browser, not the tenant",
    detail: "FIXED 12 Sept. Notes, nappy changes and nudges are on the register doc (every device sees them; this browser's old ones upload once); the child quick-edit saves to the child record (PUT /api/children/:id, managers, with history). Two staff on two phones do not see each other's entries.",
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
    detail: "FIXED 12 Sept. PortalGuard clears the cached /api/me on every view-as change (the aos:actas event). setActAs is called without clearMeCache, so the cached /api/me keeps the HQ identity while the API serves the impersonated account. Exiting can strand you outside HQ.",
    file: "components/shell/AccountPicker.tsx:39, ImpersonationBar.tsx:24", step: "d28s3",
  },
  {
    id: "b28", who: "claude", severity: "medium",
    title: "A company with no franchises gets the franchisor dashboard",
    detail: "FIXED 12 Sept. Only a head office WITH franchises gets the comparison board. CompanyDashboardSwitch checks only useHoScope(), not hasFranchises, so a plain company can never reach the operational dashboard.",
    file: "features/franchise/CompanyDashboardSwitch.tsx:12", step: "d23s2",
  },
  {
    id: "b29", who: "claude", severity: "medium",
    title: "Deleted staff resurrect as six fabricated demo names",
    detail: "FIXED 12 Sept. The default team is just you; demo staff already saved are filtered out (name AND role match) and are never recovered from the browser cache. Emptying the staff library on Ratios causes the listings page to re-upload Marcus Bell, Jess Patel and four others to the tenant — where they can reach a customer-facing page.",
    file: "features/listings/FreelancerListingsApp.tsx:187", step: "d3s6",
  },
  {
    id: "b30", who: "claude", severity: "medium",
    title: "Parent typing lands unescaped in outbound provider emails",
    detail: "FIXED 12 Sept. Merge values, booking emails, notify() emails and team invites escape parent-typed text (lib/html.ts esc, emails.ts escapeHtml now escapes quotes). A child's name can carry a link into an email the provider sends.",
    step: "d20s4",
  },
  {
    id: "b31", who: "amir", severity: "medium",
    title: "The unsubscribe link is unsigned base64 of tenantId:email",
    detail: "FIXED 12 Sept. Signed (HMAC) tokens; unsigned legacy links honoured until 12 Oct, then refused; the page no longer reflects the address unescaped. Anyone can suppress any address.",
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
    detail: "PARTLY FIXED 12 Sept. app/not-found.tsx, app/error.tsx and app/global-error.tsx exist. Monitoring/alerting is still Amir's. A broken page is a white screen, and nobody would know it broke in production until a customer rang.",
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
    detail: "FIXED 12 Sept. A deletion request bells + emails every provider the family booked with (with the one-month due date) and shows in HQ's bell; the export now covers payments, messages, incidents (non-confidential), trip consents, uploaded plans, memberships, wallet and provider family records, with no 10-child cap. A subject access export is also materially incomplete. Both are legal obligations, not features.",
    step: "d21s7",
  },
  {
    id: "b38", who: "claude", severity: "high",
    title: "Medication, incident and messaging screens are English-only in every language",
    detail: "MOSTLY FIXED 12 Sept: in all 11 languages now — parent Medication, Accidents (+ the notes thread), Trips consent, Account, Privacy, Support, Moments, Newsfeed, Timetable, and the staff portal's Announcements, My leave, Documents, Certificates, Payslips, Appraisals, Expenses. Team & invites' Urdu/Welsh/Punjabi/Bengali were written but never switched on — now on. STILL ENGLISH: operator/staff shared screens (MedicationApp, IncidentsApp, TripsApp, MomentsApp, TasksApp, RatiosApp, ListingWizard), TimeClockApp, StaffOnboardingApp, CoursePlayer, printed payslips. Was: the parent Medication screen first. Still English: incident/accident screens, messaging (comms.ts), tasks.ts, listings.ts, workforce.ts. Original: care.ts, comms.ts, tasks.ts, listings.ts and workforce.ts are empty stubs for every locale; pa, bn, pt and cy have no base catalogue. A parent consents to medication in a language they cannot read.",
    step: "d20s10",
  },
  {
    id: "b39", who: "decision", severity: "medium",
    title: "No rate limiting anywhere, and /docs serves the whole API surface publicly",
    detail: "FIXED 12 Sept. lib/rateLimit.ts on the public endpoints (providers 120/min, leads 10/min…); /docs off in production; the directory returns only the outward postcode. The public endpoints — including the provider directory — can be hit without limit.",
    step: "d5s5",
  },
  // ── 12 Sept: found by the three reviewers of the overnight run, fixed ───────
  {
    id: "r1", who: "claude", severity: "high",
    title: "Dose-email mute was a per-device flag the server never saw",
    detail: "FIXED 12 Sept. The Medication screen's mute now writes the family's server preference (PUT /api/notifications/prefs, category medication): routine \"dose given\" emails stop, the bell still records every dose, and a MISSED dose is emailed regardless (notify ignoreMute).",
    file: "features/medication/ParentMedicationApp.tsx, server/src/lib/notify.ts", step: "d12s12",
  },
  {
    id: "r2", who: "claude", severity: "high",
    title: "Clock-in/out times only reached the phone's copy of the rota",
    detail: "FIXED 12 Sept. POST /api/rota/clock stamps the real in/out on today's shift (staff: their own; managers: by name), and a manager's rota save keeps stamps its screen didn't have instead of erasing them.",
    file: "server/src/routes/rota.ts, features/timeclock/data.ts", step: "d16s11",
  },
  {
    id: "r3", who: "claude", severity: "high",
    title: "Parents couldn't clear a child's allergies, medical note or SEND plan",
    detail: "FIXED 12 Sept. Editing sends blanks; the server removes a field sent blank (it used to read a missing field as \"unchanged\").",
    file: "features/parent/ChildrenApp.tsx, server/src/routes/my.ts", step: "d21s11",
  },
  {
    id: "r4", who: "claude", severity: "medium",
    title: "A child with a finished whole-course booking could never be removed",
    detail: "FIXED 12 Sept. A booking with no individual days is live only until its block's end date.",
    file: "server/src/routes/my.ts (DELETE /children/:id)", step: "d21s12",
  },
  {
    id: "r5", who: "claude", severity: "high",
    title: "Closing a parent account was a permanent lockout — and hid the provider's public page",
    detail: "FIXED 12 Sept. Signing back in reopens it (POST /api/account/reactivate, called from the login page) as the Close screen promises; public pages treat a closed or switched-off account as a visitor. NB the Close screen says \"within 30 days\" — nothing deletes a closed account after 30 days (see the Amir doc).",
    file: "server/src/middleware/role.ts, server/src/routes/account.ts, app/login/page.tsx", step: "d21s13",
  },
  {
    id: "r6", who: "claude", severity: "high",
    title: "A paid invoice overwrote the booking's card payment and could mark a paid booking part-paid",
    detail: "FIXED 12 Sept. settleInvoiceBooking counts cash already in the way refunds do (paidSoFar), and keeps the booking's paymentIntentId/stripeAccount — the invoice's payment is recorded in invoicePaymentIntentIds instead, so a refund still goes back to the original card.",
    file: "server/src/routes/invoices.ts", step: "d19s8",
  },
  {
    id: "r7", who: "claude", severity: "medium",
    title: "Any action on an already-cancelled booking re-ran the meal/trip clean-up",
    detail: "FIXED 12 Sept. cleanupAfterCancel runs only on the cancel itself.",
    file: "server/src/routes/bookings.ts",
  },
  {
    id: "r8", who: "claude", severity: "medium",
    title: "Membership credit could be paid out twice via credit → % tier → credit",
    detail: "FIXED 12 Sept. The legacy fallback uses the last join date whatever tier the member is on now.",
    file: "server/src/routes/memberships.ts",
  },
  {
    id: "r9", who: "claude", severity: "medium",
    title: "Chase emailed a referee who had declined; iPhone (HEIC) uploads refused",
    detail: "FIXED 12 Sept. Chase on a declined reference is refused (410). Plan and document uploads read the type off the file extension when the browser gives none.",
    file: "server/src/routes/references.ts, features/listings/planUpload.ts", step: "d15s19",
  },
  {
    id: "r10", who: "claude", severity: "high",
    title: "\"Assign to Bedford only\" told everyone in the network",
    detail: "FIXED 12 Sept. Learning notifications resolve locations to franchises (Company-owned = head office's own staff) and go out after the screen gets its answer.",
    file: "server/src/routes/learning.ts", step: "d17s10",
  },
  // ── 12 Sept, second pass ("you sort") ───────────────────────────────────────
  {
    id: "r11", who: "claude", severity: "high",
    title: "\"Leads only\" settings meant \"no staff at all\" — the server had no leads",
    detail: "FIXED 12 Sept. Team & invites → Make lead (PATCH /api/invites/:token/lead) sets users.lead; req.auth.lead + isPlainStaff() let leads through medication doses, trip planning (\"leads\"; \"managers\" still refuses all staff) and group assignment. /api/me returns lead so the buttons show.",
    file: "server/src/middleware/role.ts, server/src/routes/invites.ts", step: "d16s12",
  },
  {
    id: "r12", who: "claude", severity: "critical",
    title: "Clock in/out records lived on the device that clocked",
    detail: "FIXED 12 Sept. /api/timeclock holds each person's day; the board, On-site-now, timesheets and payroll read a cache refreshed every 30s. A real provider no longer gets the demo people seeded onto its board. STILL PER-DEVICE: the pay-policy settings (grace, rounding).",
    file: "server/src/routes/timeclock.ts, features/timeclock/data.ts", step: "d16s13",
  },
  {
    id: "r13", who: "claude", severity: "critical",
    title: "Staff certs and the rota's DBS check read two different stores",
    detail: "FIXED 12 Sept. Staff certificates are server-side (/api/credentials) and a manager-saved one is mirrored into certifications, which the rota check reads — record a DBS in Team → Staff certs and rostering accepts it; reject it and rostering refuses. NB: the rota check (existing rule) only bites once a tenant has ANY certificate recorded — the first one switches enforcement on for everyone.",
    file: "server/src/routes/credentials.ts, features/learning/credentials.tsx", step: "d15s20",
  },
  {
    id: "r14", who: "claude", severity: "high",
    title: "Real providers were shown the demo cast (Marcus Bell & co.)",
    detail: "FIXED 12 Sept on: operator Onboarding, Single Central Record, Team → Staff certs, Setup credential chips, Learning Centre completion view (and its made-up per-course scores), the clock board, and the staff Onboarding / My certificates screens (which used to fill in \"Marcus Bell's\" record as whoever was signed in). Demo mode keeps them. STILL DEMO: Payroll's employee list and pay, the Learning Centre policies tab.",
    file: "features/team/useTeam.ts", step: "d17s11",
  },
  {
    id: "r15", who: "claude", severity: "high",
    title: "Course passes and assignments stayed on one device",
    detail: "FIXED 12 Sept. /api/learning/completions (staff record their own; a resit keeps the better score) and /api/learning/assignments (managers set, staff read). Course CONTENT edits are still per-device.",
    file: "server/src/routes/learning.ts, features/learning/courseCompletions.ts", step: "d17s11",
  },
  // ── 13 Sept overnight run: subscription wall + staff cap (agent "subscription") ──
  {
    id: "s13-sub1", who: "claude", severity: "critical",
    title: "A failed card renewal locked the owner out of registers and incident records while their staff carried on",
    detail: "FIXED 13 Sept: middleware/subscription.ts now runs a grace model for the WHOLE tenant team (owner, franchise, staff — parents never walled). past_due: 14 days' full access from pastDueSince with a \"payment failed — update card\" banner; then read-only (every read works; writes only to the safety routes). canceled / canceling past its end: locked except the safety routes + billing/account/support. Safety = registers, children, incidents/accidents, medication, child files, uploads (read AND write in every mode, so today's register can always be marked); bookings/customers/library/franchises stay readable for those screens. The open list is now deliberate (OPEN / SAFETY / SAFETY_READ, whole path segments). pastDueSince is stamped by markPastDue (webhook) / syncFromStripe. The UI no longer walls the portal: SubscriptionLock shows the banner, and on a locked tenant any non-safety screen shows a panel linking to the safety screens. Tested on a throwaway tenant across all four modes x four roles.",
    file: "server/src/middleware/subscription.ts, components/auth/SubscriptionGate.tsx, server/src/lib/billing.ts", step: "d19s4",
  },
  {
    id: "s13-sub2", who: "claude", severity: "high",
    title: "Plan staff caps could be overrun — pending invites didn't count and accepting never re-checked",
    detail: "FIXED 13 Sept: staffHeadroom counts active staff + staff invites still waiting to be accepted; accepting a staff invite re-checks the cap inside the join transaction (two simultaneous accepts can't both take the last place); over the cap the invitee is told plainly — on the invite preview, before they create an account — and the owner gets a billing notice (once a day per invite); the invite stays valid, so the same link works once a place frees. Re-enabling a switched-off member is capped too. The headcount is now the real team: disabled accounts and franchisee logins (billed as locations) no longer take a seat. GET /api/subscription returns a live staffUsed + staffPending, and the Staff meter shows invites waiting. The band itself still never auto-changes (decision #4: hard cap + upgrade prompt).",
    file: "server/src/lib/billing.ts, server/src/routes/invites.ts, server/src/routes/subscription.ts", step: "d19s6",
  },
  {
    id: "s13-sub3", who: "claude", severity: "high",
    title: "Subscription grace model — confirmed",
    detail: "DECIDED 13 Sept by Kaz: the grace model stands as built — (1) 14 days' full access after a failed payment, then read-only; (2) safety records (registers, incidents/first aid, medication, children's details) stay readable AND writable even once a subscription has ended; (3) staff and franchises follow the owner's state; (4) parents are never walled — existing bookings, cancellations and their own records keep working — BUT parents can still book only during the 14-day grace: once the provider is read-only or locked, a NEW parent booking or waitlist join is refused; (5) franchisee logins don't count as staff seats. BUILT 13 Sept: server/src/middleware/subscription.ts takesNewBookings() (mode full|grace) + NOT_TAKING_BOOKINGS; POST /api/my/bookings refuses 409 code provider_not_taking_bookings 'This provider isn't taking online bookings right now — please contact them directly.' right after the listing lifecycle gate. Tested (d19s4, throwaway tenant): active 201, grace 201 (a waitlist join), read-only 409, locked 409; while refused the parent still lists bookings/children and cancels (200). Not changed: accepting a waitlist OFFER on an existing booking (and the automatic offer) still works while read-only — it's an existing booking; say if that should stop too.",
    file: "server/src/middleware/subscription.ts, server/src/routes/my.ts (POST /bookings)", step: "d19s4",
  },
  {
    id: "s13-sub4", who: "amir", severity: "medium",
    title: "Stripe side of the grace model",
    detail: "FIXED 21 Sept (never call Stripe in tests — verified out-of-band on a Stripe TEST-mode test clock, all objects deleted afterwards). New lib/billing.ts settleOpenInvoice(tenantId, subId, pm?) pays the subscription's OPEN latest_invoice off_session and then re-syncs the tenant from the live Stripe subscription, so Stripe — not the attempt — decides the status. (a) POST /subscription/card on a past_due/unpaid tenant now settles that invoice immediately instead of waiting for Smart Retries; a decline returns 402 {code:'card_saved_payment_failed'} with Stripe's own decline text, the card stays saved and the tenant stays past_due on its ORIGINAL pastDueSince (the grace clock is never restarted). Same fix also pins the new card on the SUBSCRIPTION (default_payment_method) — verified that detaching the old card does NOT clear it, so every future renewal was still aiming at a detached card. (b) POST /subscription/reactivate now asks Stripe whether the subscription is still alive: alive + cancel_at_period_end → un-cancel; alive + overdue → settle the open invoice (402 {code:'reactivate_payment_failed'} if it declines); only a genuinely canceled/gone one creates a new subscription. No second subscription can be bolted on beside an unpaid one, and the grandfathered Price is preserved (re-creating would re-snapshot today's catalogue). (c) syncFromStripe maps Stripe 'unpaid' to 'unpaid' instead of folding it into past_due, so accessFor() LOCKS it (it already did) rather than leaving an exhausted card read-only until Stripe cancels; pastDueSince is carried across past_due → unpaid, markPastDue can no longer un-lock an unpaid tenant, and the 402 copy says 'paused, update your card' rather than 'subscription has ended' — it's recoverable, Update card settles it. Note: this Stripe account's dunning setting is currently 'cancel' after retries, so 'unpaid' never occurs today; the mapping is what makes flipping it to 'mark unpaid' safe.",
    file: "server/src/routes/subscription.ts, server/src/lib/billing.ts", step: "d19s4",
  },
  // ── 13 Sept overnight run: features + roles enforcement, site-lead scope (agent "access") ──
  {
    id: "s13-acc1", who: "claude", severity: "high",
    title: "Switching a feature off in Setup → Features only hid the sidebar link",
    detail: "FIXED 13 Sept: new middleware/access.ts (mounted after the subscription wall, and on /api/listings) refuses a switched-off module server-side for owners and staff — 403 {code:'feature_off'} with a plain message. Covers Meals (meals, meal-menus, meal-options, meal-orders), Trips, Events calendar, Activity timetable, Task manager, Discount codes, Referrals, Reviews, Money in (purchasing), Reconciliation, Inventory, Documents, Moments. Franchise-aware (reads the franchise's own Setup via tenantLibrary), 10s cache cleared on every Setup save. The page is refused by URL too: app/[portal]/[view]/page.tsx wraps every view in components/auth/ViewGate.tsx ('Meals is turned off' + link to Setup → Features), and the staff sidebar now follows the operator's switches. One shared table: lib/accessMap.ts. Tested on a throwaway tenant (meals/trips/tasks off → 403 for owner + staff, back on → 200 on the next request; bookings/registers/incidents unaffected).",
    file: "server/src/middleware/access.ts, lib/accessMap.ts, components/auth/ViewGate.tsx, app/[portal]/[view]/page.tsx", step: "d2s2",
  },
  {
    id: "s13-acc2", who: "claude", severity: "high",
    title: "The Roles & permissions matrix was saved but nothing enforced it",
    detail: "FIXED 13 Sept (P1): a staff member's permission role is the one picked on their invite (users.staffRole — Team & invites already sent it; users.permRole overrides) and rides on req.auth.permRole; middleware/access.ts resolves the role's caps from Setup (franchise-aware) and refuses by area — GET needs View, writes need Edit (403 no_access / view_only). Owners (company, freelancer, franchise) and the Owner role are never gated. ~35 API prefixes mapped to the matrix areas (lib/accessMap.ts CAP_API). Never refused: raising a concern (POST /api/incidents), messaging support, confirming you've read a document, reacting to a post; own schedule/leave/clock/learning/payslips aren't gated (\"non-managers see their own only\"). Least-surprise: Setup saves its whole settings bag (default roles included) on any change, so the matrix is only enforced once the operator has actually edited it — the Roles tab now stamps settings.rolesSetAt. /api/me returns permRole + caps; the staff sidebar hides None areas and ViewGate refuses them by URL. Tested: coach at None → customers, incidents, listings?mine=1, meals, bookings, registers, child card, medication all 403; View → reads 200, marking a register 403; Edit → 200; concern still raised (201).",
    file: "server/src/middleware/access.ts, server/src/middleware/role.ts, lib/accessMap.ts, components/shell/Sidebar.tsx, features/setup/SetupApp.tsx", step: "d2s6",
  },
  {
    id: "s13-acc3", who: "claude", severity: "medium",
    title: "Roles & permissions: enforcement choices — decided",
    detail: "DECIDED 13 Sept by Kaz: (a) the specific 'who can give doses' setting wins for recording a dose — a staff member allowed to give doses can record one even at Medication: View; (b) logging a safeguarding concern or an incident/accident is never blocked by the matrix; everything else in the matrix unchanged (binds once the Roles tab is edited; View = read-only; safeguarding pages + registers never refused by Features switches). BUILT 13 Sept: lib/accessMap.ts — POST /api/medications/:id/administer is a View-level write, so Setup → Medication 'Doses: leads only / all staff' (enforced in the route) decides; at Medication: None the area stays closed. POST /api/incidents (any kind) was already never refused; the staff 'Accidents & first aid' page is no longer refused by URL/sidebar at Incidents: None (it's where an accident is logged) — the list says 'You can still record one here' (IncidentsApp.tsx). Tested (d2s6): coach at View doses 201, edit 403 view_only; None 403; leads-only → plain coach 403 / lead at View 201; accident/incident/concern logged at None 201, list 403. STILL OPEN from the original item: no way to change a joined member's role (invites.ts PATCH writing users.permRole).",
    file: "lib/accessMap.ts (VIEW_LEVEL_WRITES, NEVER_REFUSED, STAFF_VIEW_CAP), features/incidents/IncidentsApp.tsx", step: "d2s6",
  },
  {
    id: "s13-acc4", who: "claude", severity: "critical",
    title: "A site lead saw, and could mark, every site's registers and open any child's card",
    detail: "FIXED 13 Sept: new lib/siteScope.ts resolves a staff member's invite assignment (users.assignment, now on req.auth) to listing ids — mode 'locations' = listings whose venueId is one of the ids, 'listings' = those ids — plus those listings' blocks. Narrowed like franchiseListingIds narrows a franchise: GET /api/registers (only that site's sessions), every register write (mark/note/nappy/nudge/headcount → 404 elsewhere), GET /api/children/lookup + /:id, GET /api/bookings + /:ref, and childVisibleTo (so incidents/medication can't be filed against, or pull, another site's child). Mode 'all', 'none' (not rostered), no assignment or no ids picked = unscoped as before. Applies to any staff member with a site assignment, not only leads (least privilege). Tested on a throwaway tenant: lead assigned to Oak → 1 session (Oak), Elm mark 404, Oak mark 200, Elm child 404, Oak child 200, bookings Oak-only; a mode-'all' lead still sees both.",
    file: "server/src/lib/siteScope.ts, server/src/routes/registers.ts, server/src/routes/children.ts, server/src/routes/bookings.ts, server/src/lib/childAccess.ts", step: "d23s5",
  },
  {
    id: "s13-acc5", who: "claude", severity: "medium",
    title: "Site scope + feature switches: the follow-ups",
    detail: "FIXED 13 Sept (agent access2): (a) site scope now covers the rest of a site lead's child data — GET /api/ratios and the day board (they see and save only their own children's child → group moves; other sites' moves are kept), the meals board, trips (list, edit, planning on another site's listing refused, a typed name links only to a child booked at their sites so another site's medical notes can't be pulled), moments (feed, taggable, tagging/commenting elsewhere refused), and the incident + medication LISTS, each record behind them (note/edit/dose → 404 elsewhere) and the MAR. Rule (server/src/lib/siteScope.ts recordInSite): a record is at the site when it names a listing/block there or a child booked there; the person's own records always show; a record tied to no child and no session (an office note) isn't shown to a site-scoped person. The MAR (GET /api/medications/administrations) is now franchise-scoped too — it wasn't. (c) Newsfeed, Email, the AI assistant, Schedule (rota/shifts/availability), Leave, Split fees and Ratios now refuse WRITES while switched off (403 feature_off; reads still answer for the dashboards) — lib/accessMap.ts FEATURE_WRITE_API; open on purpose: post reactions, the email opt-out (PECR) and rota/clock. (d) Parents: customerAreaOn now folds Setup → Features in (same table as the family nav, lib/accessMap.ts CA_FEATURES — the nav now also hides Trips and the Timetable when switched off), so meal options/orders/cancel/change, trip consent and moment comments are refused 403 area_off with a plain message, and meal days, meal orders, trips, moments, the newsfeed and published timetables from that provider come back empty. Tested on a throwaway tenant (70 checks, 0 leftovers; the original access suite still 45/45).",
    file: "server/src/lib/siteScope.ts, server/src/routes/{ratios,meals,trips,moments,incidents,medications,mealsShop,posts,timetables,my}.ts, server/src/lib/customerArea.ts, lib/accessMap.ts, lib/use-customer-area.ts", step: "d23s5",
  },
  {
    id: "s13-acc6", who: "claude", severity: "medium",
    title: "Switched-off modules whose writes are deliberately still open — decided",
    detail: "DECIDED 13 Sept by Kaz: keep as built — everything else in the matrix/feature switches unchanged, so Messages, Clock in/out, Money out and AI drafting stay open for writes while switched off, for the reasons below. Nothing to build. Not refused when switched off, because a page that can't be switched off writes through the same API (13 Sept, access2): Messages — the register's late-collection nudge, Bookings' 'email these families' and a booking's 'Message family' all send through /api/messages (and Email shares its templates), so refusing would stop a core page reaching a family; Clock in/out — staff clock-ins are fire-and-forget from 'My shifts & clock' (which follows Schedule, not Clock), so a refusal would silently lose a clock-in the person thinks landed, and Payroll edits timesheets through PATCH /api/timeclock; Money out — Head office's Finance page and Purchasing (PO → expense) write money-out entries through /api/expenses; AI drafting — /api/ai/compose powers the AI buttons inside Email, the newsletter and the Learning Centre course editor (only the assistant, /api/ai/chat, is refused). Decide: should Messages-off also stop in-app family messages from registers/bookings (email-only instead)? Should AI-off also remove the drafting buttons? Should the staff clock follow the Clock switch (the staff page would need to hide the button first)?",
    file: "lib/accessMap.ts (FEATURE_WRITE_API)", step: "d2s2",
  },
  {
    id: "s13-acc7", who: "claude", severity: "medium",
    title: "Site scope: what's still not narrowed",
    detail: "After 13 Sept (access2): (1) the ratio board's group staffing (groupStaff) is one per tenant per day with no site dimension — a site lead can still change who covers an age group, which the other sites share (needs per-site boards); (2) a member of staff covering another site via the rota still needs their invite assignment widened (the rota isn't read); (3) messaging/email audiences aren't site-scoped (staff don't reach those APIs as senders today); (4) parent-side trip filtering uses the head office's switches, not a franchise's own (meals/consent use the listing's franchise); (5) the family pages refuse by data, not by URL — a parent typing /custdash/meals after it's switched off sees an empty page rather than a 'not offered' card.",
    file: "server/src/lib/siteScope.ts, server/src/routes/ratios.ts, server/src/routes/my.ts", step: "d23s5",
  },
  {
    id: "s13-par1", who: "claude", severity: "high",
    title: "Parent AI assistant couldn't say what was paid when — and listed cancelled sessions and removed children",
    detail: "FIXED 13 Sept: the parent snapshot (server/src/routes/ai.ts familySnapshot) now carries a dated payments list from the payments collection — this family's own records only (matched on the signed-in email): date (paidAt, else createdAt), amount, method (card when it's a Stripe payment), booking refs, reference, provider; settled card payments + recorded offline payments + refunds, never unfinished card attempts or failed refunds. The parent prompt tells the model month totals come from that list, not from bookings marked Paid. Cancelled and declined bookings now have upcomingDays [] (UK today via ukToday), and archived (removed) children are filtered out. Tested with Groq stubbed: Sept = the single £20 Cash on 2026-09-10, June card £100 dated from paidAt, another family's £999 and a £77 unfinished attempt absent, cancelled/declined bookings show no upcoming days, the archived child is gone.",
    file: "server/src/routes/ai.ts (familySnapshot)", step: "d21s10",
  },
  {
    id: "s13-par2", who: "claude", severity: "medium",
    title: "No booking cut-off — families could book a session minutes before it started",
    detail: "FIXED 13 Sept: new per-listing field bookingCutoffHours (listing schema, whole hours, blank = none) set in the listing wizard's Policy step under 'Bookings open at' (🛑 Stop taking bookings N hours before each session starts). Enforced in POST /api/my/bookings next to the past-date gate, per chosen day, against that day's session start (the chosen timing's start if one was picked, else the block's session start), compared on the UK wall clock (server/src/lib/bookingCutoff.ts) → 400 'Bookings for Mon 14 Sept have closed — <listing> stops taking bookings 2 days before each session. Please pick a later date, or contact the provider.' An operator booking on behalf of a family (onBehalfOf) skips it, like the past-date gate. The customer page shows 'Bookings close N hours before each session starts' under Choose your dates (both page styles). Calendar days inside the cut-off are NOT greyed out yet — the server refuses them with the message. Tested on a throwaway tenant: 48h cut-off saved; tomorrow and the day after refused, +6 days booked, operator override booked tomorrow, clearing the cut-off re-opens it. Wizard + customer-page note not visually checked (no browser sign-in).",
    file: "server/src/routes/listings.ts, server/src/routes/my.ts, server/src/lib/bookingCutoff.ts, features/listings/ListingWizard.tsx", step: "d3s5",
  },
  {
    id: "s13-par3", who: "claude", severity: "high",
    title: "No way to change the sign-in email",
    detail: "FIXED 13 Sept: My account has a 'Sign-in email' card → Change email. It calls Firebase verifyBeforeUpdateEmail (link goes to the NEW address; the login only switches when it's opened — the old address then can't sign in and Firebase ends other sessions); on auth/requires-recent-login it asks for the current password, re-authenticates and retries; email-in-use / invalid / too-many-requests have their own messages. POST /api/account/email-change records users.pendingEmail (GET /api/account shows 'waiting for confirmation of …'). Server half (server/src/lib/emailSync.ts, run on GET /api/me and GET /api/account): when the token's email differs from users.email AND the new address is proven (Firebase email_verified, or it's the pendingEmail this account asked for), everything keyed on the old address moves to the new one — bookings, customer rows in every tenant (a row linked to a DIFFERENT uid is left alone), threads, meal orders, memberships, payments, wallet ledger, notifications, discount redemptions, email suppressions, support threads — and wallet balances are moved (transaction) onto the new address's wallet doc; users.email updated with previousEmails kept. Skipped under HQ view-as. New strings in all 11 account-area locales. Tested with the harness (throwaway tenants): pending → nothing moves; token switches → all of the above moved across two tenants, other-uid customer untouched, £15 wallet moved, family still sees its bookings; unproven change → nothing moves; verified change → moves. The real Firebase email/link was NOT exercised (no auth accounts / real mail in tests).",
    file: "features/account/AccountApp.tsx, server/src/lib/emailSync.ts, server/src/routes/account.ts, server/src/routes/tenants.ts (/api/me), lib/i18n/messages/areas/account.ts", step: "d26s5",
  },
  {
    id: "s13-par4", who: "decision", severity: "medium",
    title: "Email change + cut-off: what's still open",
    detail: "(a) Staff/operator email change: the sync moves family records only; staff records that carry an email (invites, rota/timeclock names, credential reminders) aren't migrated — check before a staff member changes theirs. (b) A change made outside the app (Firebase console / admin updateUser) only syncs if Firebase marks the new address verified. (c) If the family already had a customer row under the NEW address with the same provider, both rows now share it — the provider merges them by hand. (d) Booking cut-off: the parent calendar doesn't grey out days inside the cut-off (server refuses them), and amend/move-date requests don't check it (the operator approves those). (e) Decide whether a cut-off should also stop the waiting-list auto-offer inside the window.",
    file: "server/src/lib/emailSync.ts, features/listings/booking.ts", step: "d26s5",
  },
  // ── 13 Sept overnight run: payroll from the real team, timesheets and leave (agent "payroll") ──
  {
    id: "s13-pay1", who: "claude", severity: "high",
    title: "Payroll paid the demo cast from one browser's rota — a real member of staff who clocked hours couldn't be paid",
    detail: "FIXED 13 Sept: employees now come from the REAL team (useTeam — joined staff invites, own franchise; DEMO_STAFF only in demo mode) with pay details (basis, rate, hrs/wk, weeks, tax code, NI, pension, paid-from) edited per person, plus '+ Add employee' for someone not on the app and 'Remove from payroll' for hand-added people / leavers. New staff default to hourly, paid from APPROVED timesheets, rate prefilled from onboarding or the Schedule (0 = 'needs pay details', never made up). Hours come from the server timesheets (new GET /api/payroll/timesheets?from&to reads clockRecords for the whole period) using the Timesheets screen's own Pay-hrs rule (break, rounding, grace/lateness, overtime capped unless auto-pay or approved) — Day 16's 09:00–15:00 with a 30-min break is 5.5h in the run, not 6.0h. Unapproved and never-clocked-out days are NOT paid and are listed on the run; the ✏️ Edit modal lists each day with Approve / 'Pay +Xh overtime' (PATCH /api/timeclock). Pay details, per-period adjustments and every approved run are stored server-side (payrollConfig/{tenant or tenant__fr__franchise}, payrollRuns — never overwritten); runs are published to staff explicitly ('📣 Publish to staff'), and GET /api/payroll/mine returns the signed-in person's own lines of published runs (matched by account-name slug, like the timeclock). Also fixed: pay-period windows were a day early east of GMT (toISOString), and payslip YTD summed every run ever (now this tax year up to the payslip). Tested: 30 maths checks + 33 in-process API checks on a throwaway tenant (incl. franchise isolation and staff 403s).",
    file: "features/payroll/PayrollApp.tsx, features/payroll/payCalc.ts, server/src/routes/payroll.ts", step: "d17s6",
  },
  {
    id: "s13-pay2", who: "claude", severity: "high",
    title: "Payroll ignored leave — contracted staff were paid full hours through unpaid leave",
    detail: "FIXED 13 Sept: the pay run reads APPROVED absences for the period from /api/leave (a booking straddling the period counts its share of working days) and uses each booking's pay treatment (else the type's default). Unpaid leave comes off contracted hours (a day = hrs/wk ÷ 5, matching the planner's Mon–Fri day count) or off salary (salary ÷ 260 a day), shown as its own payslip line; paid leave is already in contracted pay/salary and is ADDED at the normal rate for timesheet-paid staff (who don't clock it); rolled-up (12.07%) staff never get it twice — their annual leave is treated as unpaid and the 12.07% line applies to what's paid. Leave days show on the pay-run row, in the Edit modal, the CSV and the payslip. Sickness / statutory-pay leave: pay is NOT adjusted (SSP/SMP not modelled — disclaimer kept) and the row + payslip say so explicitly.",
    file: "features/payroll/payCalc.ts (leaveForPeriod, computeLine), features/payroll/PayrollApp.tsx", step: "d17s7",
  },
  {
    id: "s13-pay3", who: "claude", severity: "medium",
    title: "Payroll: sick pay setting — decided",
    detail: "DECIDED 13 Sept by Kaz: (1) add a company setting 'Sick pay: Full contracted pay (default) / SSP only'; with SSP only, sick days are deducted like unpaid leave and the row notes 'SSP to be added by your payroll provider' (SSP still not calculated); (4) keep '📣 Publish to staff' as the separate step. BUILT 13 Sept: payrollConfig settings.sickPay via GET /api/payroll + PUT /api/payroll/settings (managers; staff 403; per tenant or franchise); the pay run has a Sick pay toggle; payCalc.computeLine takes sickPay — SSP only: sick days (hrs/wk÷5, or salary÷260) come off as their own sickLeaveM line (row, Edit modal, payslip 'Sickness · N days (SSP only)', CSV column); FULL: contracted/salaried pay unchanged, and a timesheet-paid person with hrs/wk set gets each sick day at hrs/wk÷5 × rate ('Sick pay (full pay)' line, like paid leave) — my reading of 'full contracted pay' for timesheet staff; say if casual staff should get nothing instead (one line in payCalc). Statutory (SMP etc.) still unmodelled and flagged. Publish confirmed separate: unpublished run → staff /mine [], published → only their own line. Tested: 13 sick-pay maths checks + API (d17s7). Still open from the original list: (2) day = hrs/wk÷5 for part-timers, (3) TOIL adds nothing, (5) name-slug matching, (6) the Timesheets pay policy is still per-browser (aos.timeclock.settings.v1), (7) payroll tour copy.",
    file: "features/payroll/payCalc.ts, features/payroll/PayrollApp.tsx, server/src/routes/payroll.ts", step: "d17s7",
  },
  {
    id: "s13-mon1", who: "claude", severity: "high",
    title: "Dashboard 'taken this week' / 'outstanding' disagreed with Finance",
    detail: "FIXED 13 Sept: (1) 'Mark paid' (and one-click Reconcile) on a part-paid booking now records only the BALANCE (amount − what was already received), not the full price — a £40 part-payment then Mark paid wrote £40 + £100. Marking an already-paid booking again records nothing. Undoing a Reconcile now marks that booking's offline payment records 'reversed', so re-reconciling can't double-count. (2) One 'still owed' rule, owedNow() in features/bookings/helpers.ts, is summed by the Dashboard (server/src/routes/dashboard.ts), Finance (Owed/Debts) and the AI co-pilot: a booking owes its balance while it holds a place (not cancelled/declined/waitlisted/offered/awaiting approval), whatever the pay label — 'Pay on the day' now counts, waitlisted places don't. 'Taken' uses the shared isMoneyIn() rule and the card record's paidAt. Tested on throwaway tenants through the real routes + the page's own maths (financeFigures): taken £280 = collected £280, outstanding £175 = owed £175; undo/redo reconcile keeps them equal.",
    file: "features/bookings/helpers.ts, server/src/routes/dashboard.ts, server/src/routes/bookings.ts, server/src/routes/ai.ts, features/money/financeFigures.ts", step: "d19s7",
  },
  {
    id: "s13-mon2", who: "claude", severity: "high",
    title: "Today's refunds didn't appear on Reconciliation at all",
    detail: "FIXED 13 Sept: GET /api/reconciliation now returns `refunds` (one row per refund: booking, method, where the money went — card / wallet / offline — amount and UK date) plus summary.refunds {count, total, today, todayCount, byVia}, read from the booking itself (refundedApproved + refundLog, the same figures the bookings list shows), cancelled bookings included. Approving a refund now stamps cancel.refundedAt (cancel.on is when it was asked for), and a wallet refund writes a payments record {type:'refund', method:'wallet', status:'credited'} like card and offline refunds already did, so the payments ledger no longer comes up short by every wallet refund. Reconciliation shows a Refunds panel (today by default, All, or the page's From/To dates; honours listing/season). Tested: £40 wallet + £40 offline approved today → Reconciliation today £80 × 2 = bookings list £80 = payments ledger £80. Screen not visually checked.",
    file: "server/src/routes/reconciliation.ts, server/src/routes/bookings.ts (settleApprovedRefund), features/reconciliation/ReconciliationApp.tsx", step: "d9s7",
  },
  {
    id: "s13-mon3", who: "claude", severity: "medium",
    title: "Finance's period filter hid debts on older bookings",
    detail: "FIXED 13 Sept: each Finance figure now moves with the period in its own sense — Owed / 'Who owes you' is what's owed NOW (not windowed; a family owing on a booking made 7 months ago stays in Debts at 3m/6m); Collected lands in the month it was PAID where a payment record says so (the rest on the booking's month — the all-time total is unchanged); Refunds by the month they were given (refundedAt / refund log dates); Booked and the customer/learner counts stay by booking month. Season and location filters unchanged. Tiles relabelled ('owed now · any period', 'by date paid'). The maths moved to features/money/financeFigures.ts so it can be tested. Screen not visually checked.",
    file: "features/money/financeFigures.ts, features/money/FinanceAnalyticsApp.tsx", step: "d19s2",
  },
  {
    id: "s13-mon4", who: "claude", severity: "high",
    title: "Payouts showed cash, transfer and TFC money as Stripe payouts",
    detail: "FIXED 13 Sept: payout estimates (on the way / in your bank / fees) now count CARD money only — a card booking's takings, or the card part of a split booking, less what went back to the card, dated by its card payment record; plus card payments not tied to a booking (invoice pay-links, meal orders) when no filter is set. Cash, bank transfer, vouchers and TFC never appear as a payout and have no card fee taken off. Payout transactions lists only settled card payments (not offline records or unfinished checkouts). Still labelled as estimates; the note now says only card payments show here. Overview's 'Est. net to bank' is now 'Est. net after fees' (card fees only). Revenue carries a note that it's bookings only (invoices and logged income live in Money in). Tested: £100 card + £100 cash + £30 transfer + £50 TFC → on the way £98.40, fees £1.60. Screen not visually checked.",
    file: "features/money/financeFigures.ts, features/money/FinanceAnalyticsApp.tsx", step: "d19s1",
  },
  {
    id: "s13-mon5", who: "decision", severity: "medium",
    title: "Money figures: what's still open after the 13 Sept consistency fixes",
    detail: "(a) Finance Revenue is bookings-only — standalone invoices and hand-logged income aren't in Overview/Revenue (now labelled). Decide whether to fold them in. (b) A parent releasing days for WALLET credit (server/src/routes/my.ts) still writes no payments-ledger record (the refund shows on Reconciliation from the booking, but not on the Payments page) — parent area, left alone. (c) Dashboard 'taken this week' is gross money in over 7 days; Finance 'collected' is net of refunds by month — they agree on the same money, but a refund in the same week makes them differ by design. (d) Payout figures remain estimates until the Stripe balance/payout API is wired (Amir). (e) Refunds approved before 13 Sept have no refundedAt, so their date falls back to when the refund was asked for.",
    file: "features/money/financeFigures.ts, server/src/routes/my.ts", step: "d19s1",
  },
  // ── 13 Sept overnight run: staff self-service, Learning Centre, Deployment, register row (agent "staffops") ──
  {
    id: "s13-so1", who: "claude", severity: "high",
    title: "Every real provider's staff got three made-up required courses (and 'Lead / manager' matched every role)",
    detail: "FIXED 13 Sept: the Learning Centre starts a real (non-demo) provider with NO assignments — the three sample ones (Safeguarding 'due 30 Jun', First Aid for 'First-aider, Lead / manager', Water Safety '15 Jul') are demo-only, and any copy already saved to the server or a browser is recognised (their due dates aren't ISO) and dropped wherever the list is read (withoutDemoAssignments — Learning Centre, My learning, the staff reminder bar); the manager's next save removes them from the server. Role matching is one shared rule (rolesCover): each label is split on / , & and matched against the person's own role — 'Lead / manager' covers a Lead or a Site manager, not a Coach; an empty role covers nothing. Staff-recorded passes are stored and returned as selfReported (manager-recorded ones aren't), the score is rounded and still refused outside 0–100, and the manager's completion chips read '84% · self'. The quiz itself is still marked on the device (course content isn't on the server). Tested: API harness + a logic test (roles, seed stripping).",
    file: "features/learning/courseCompletions.ts, features/learning/LearningCentreApp.tsx, features/learning/StaffCertsApp.tsx, features/staff/staffTasks.ts, server/src/routes/learning.ts, features/learning/CredentialsApp.tsx", step: "d17s11",
  },
  {
    id: "s13-so2", who: "claude", severity: "high",
    title: "Staff Appraisals and Payslips read the manager's browser, so they were blank on the staff member's phone",
    detail: "FIXED 13 Sept: appraisals are on the server — new /api/appraisals (server/src/routes/appraisals.ts, key tenant or tenant__fr__franchise): managers write reviews one doc each (PUT /reviews/:id) and the suite's templates / feedback log / PIPs / 9-box (PUT /config, manager-only reads); a member of staff GETs only their OWN reviews (matched by the email looked up for the review's name, else the account name) plus templates, can't see the appraiser's draft ratings/summary until sign-off, and can only submit their own self-assessment (POST /reviews/:id/self → manager review). The operator Appraisals tab syncs from it (local keys are a cache; only changed reviews are sent), uses the REAL team (useTeam) instead of the demo cast for every picker and the 9-box, and seeds nothing outside the demo. My appraisals reads the server only. Payslips: My payslips now reads GET /api/payroll/mine (the payroll agent's route — published runs, own line only) with an honest empty state ('They'll appear here once your employer publishes them'); the demo still reads the demo store. Expenses were already server-side (/api/expense-claims, d24s8) — confirmed: a staff claim reaches the manager, not other staff. Tested with the API harness (38 checks, throwaway tenants). Screens not visually checked.",
    file: "server/src/routes/appraisals.ts, features/appraisals/data.ts, features/appraisals/AppraisalsApp.tsx, features/appraisals/MyAppraisalsApp.tsx, features/payroll/StaffPayslipsApp.tsx", step: "d24s1",
  },
  {
    id: "s13-so3", who: "claude", severity: "high",
    title: "Location staff assignments stayed in one browser and the schedule never used them",
    detail: "FIXED 13 Sept (P1): Team → Deployment is stored on the server — new /api/location-staff (managers only, tenant / franchise scoped) — and lists the REAL team (joined staff), each first placed where their invite said (locations / listings / all / not rostered; no choice on the invite = 'not placed yet', no rule). The Schedule reads it: a shift's Assign staff list shows only the people deployed at that location (and, where someone has specific listings there, only for those listings), with 'Show N more — not deployed at this location' to override; ⚡ Auto-fill (a shift and the whole period) never picks someone deployed elsewhere. Staff not in Deployment, or shifts at a location that isn't a library venue, are unaffected. NOT done: the server doesn't refuse a rota assignment to an undeployed site (it's a soft rule), and Deployment doesn't rewrite users.assignment — which lib/siteScope.ts now uses to limit a staff member's registers/children — so the two can disagree after a move (see decision).",
    file: "server/src/routes/locationStaff.ts, features/locations/locStaff.ts, features/locations/LocationsApp.tsx, features/schedule/ScheduleApp.tsx", step: "d23s1",
  },
  {
    id: "s13-so4", who: "decision", severity: "medium",
    title: "Should moving someone in Deployment also change which sites' registers and children they can open?",
    detail: "Two stores now say where a member of staff works: users.assignment (set on the invite; lib/siteScope.ts limits their registers, child records and bookings to those sites) and Team → Deployment (/api/location-staff; drives who the Schedule offers). Deployment was deliberately NOT allowed to rewrite users.assignment, because that silently changes someone's data access. Decide: should Deployment be the one place (and write users.assignment), or stay rota-only? Also decide whether the rota should hard-refuse rostering someone at a site they aren't deployed to (today it's a filter with an override).",
    file: "features/locations/LocationsApp.tsx, server/src/lib/siteScope.ts, server/src/routes/locationStaff.ts", step: "d23s1",
  },
  {
    id: "s13-so5", who: "claude", severity: "medium",
    title: "Walk-home consent was only in the child card, not on the register row",
    detail: "FIXED 13 Sept: a '🚶 Walk home' chip now sits on the register row beside the allergy / medical / medicine / SEND chips whenever the child has walk-home consent (tooltip 'Walk home: Yes'), so whoever signs children out sees it without opening the card. Uses the existing registers.walkHome string (all locales). Screen not visually checked.",
    file: "features/registers/RegistersApp.tsx", step: "d10s2",
  },
  {
    id: "s13-rtC1", who: "claude", severity: "high",
    title: "A trip's consent-request emails could wipe a parent's decline made while they were sending",
    detail: "FIXED 13 Sept (re-test): after a trip is saved, requestConsents emails each pending child's parent and then wrote back the WHOLE attendee list it started with. Anything answered in between — a parent's decline, a provider's recorded consent — went back to 'pending' (seen on the re-test: parent declined Zed and the provider granted Amy straight after creating the trip; a few seconds later both read pending). A wiped decline is no longer parent-owned, so a staff 'granted' would then have been accepted. It now stamps only consentRequestedAt/sent onto the attendees as they are at that moment, in a transaction. Re-tested on a throwaway tenant: decline and grant both survive, the 'asked' stamps land; d14s4–s6 re-run clean.",
    file: "server/src/routes/trips.ts (requestConsents)", step: "d14s5",
  },
  // ── 13 Sept full re-test, days 7–11 (agent B) ──
  {
    id: "s13-rtB1", who: "claude", severity: "medium",
    title: "A parent cancelling a Tax-Free Childcare booking told the operator the refund was going 'back to their CARD'",
    detail: "FIXED 13 Sept (re-test): the operator's cancellation bell/email only treated a voucherScheme or a method containing 'voucher' as non-card, so a TFC booking (method 'tfc', no voucherScheme — the default TFC setup) read '£60.00 refund requested back to their CARD'. It now uses the same childcare rule as the rest of my.ts (voucher / tax-free / tfc / childcare / haf) and says 'via Tax-Free Childcare (not a bank card)'. The family's own messages were already right. Tested: tfc → 'via Tax-Free Childcare', Childcare vouchers → 'via their voucher scheme'.",
    file: "server/src/routes/my.ts (whole-booking cancel notify, ~2246)", step: "d9s4",
  },
  {
    id: "s13-rtB2", who: "claude", severity: "medium",
    title: "The child card and register show the parent's phone as '—' even when the family gave one at checkout",
    detail: "FIXED 13 Sept (wave 3): bookings now store the family's real phone — what they gave at checkout, else the number this provider already holds on their customer record, else their own account's (my.ts POST /bookings; buildBooking takes input.phone and never writes '—'; the operator POST /api/bookings accepts phone too). Older bookings still carry '—' (no backfill of real data): realPhone() in features/bookings/helpers.ts treats it as blank everywhere it's read — the child card and Find-a-child (children.ts, with a same-tenant customer-record fallback), the register row (registers.ts, same fallback), Reconciliation and the booking's child-card endpoint — and BookingDetail shows 'No phone on file' instead of '—'. Tested (d10s8): checkout phone lands on the booking, card, lookup and register; a '—' legacy booking shows the customer's number.",
    file: "features/bookings/mutations.ts, features/bookings/helpers.ts (realPhone), server/src/routes/my.ts, children.ts, registers.ts, reconciliation.ts, bookings.ts, features/bookings/BookingDetail.tsx", step: "d10s8",
  },
  // ── 13 Sept full re-test, days 25–28 (agent F) ──
  {
    id: "s13-rtF1", who: "claude", severity: "medium",
    title: "HQ 'viewing as' an account could sign that account out of every device",
    detail: "FIXED 13 Sept (re-test): POST /api/account/signout-everywhere revoked req.user's sessions, and under HQ view-as req.user is the TARGET — so 'Sign out of all devices' on the account page while viewing as a provider ended the provider's sessions (and then signed HQ out). It now refuses under impersonation (403), the same guard email-change already had. Re-tested in-process with Firebase Admin stubbed: HQ + x-act-as → 403 and the target isn't revoked; the account holder's own call still revokes and the kept token is refused at once.",
    file: "server/src/routes/account.ts (signout-everywhere)", step: "d26s4",
  },
  {
    id: "s13-rtF2", who: "decision", severity: "medium",
    title: "Plain 'Sign out' doesn't end the session server-side — a copied token works for up to an hour",
    detail: "Re-test 13 Sept: ordinary Sign out is client-only (AuthProvider signOut(firebaseAuth), no API call), so a token kept from that session still gets 200 from every route until it expires (≤1h). 'Sign out of all devices' does kill it at once (verifyFresh + tokensValidAfterTime). Decide: accept 'all devices' as the kill switch, or make plain Sign out end THIS device's session too — e.g. POST /api/account/signout records the token's auth_time on the users doc and attachRole/events refuse a token with that auth_time (other devices unaffected). Small, but it touches the auth chain, so not done overnight.",
    file: "components/auth/AuthProvider.tsx, server/src/middleware/role.ts, server/src/routes/account.ts, server/src/routes/events.ts", step: "d26s4",
  },
  {
    id: "s13-rtF3", who: "claude", severity: "high",
    title: "Sales pipeline now loads all 26,000 researched leads on every open",
    detail: "Re-test 13 Sept: the Sales board (SalesApp → GET /api/platform/leads) reads the WHOLE `leads` collection with every field and no cache, and since the 12 Sept research import that collection holds 26,212 prospects. In-process the call didn't answer within 5 minutes (undici headers timeout; machine heavily loaded), and the board would put every researched prospect in the 'New' column. HQ → Leads (/api/leads) already solved this for the same collection (trimmed select + in-memory/disk cache + gzip); the HQ bell hit the same wall (s13-rtE1). Rendering is fine: a demo-form lead with no stage/contact/plan/MRR shows as '1 · Lead · £69 🏢 name · demo company' and a logged call appears on the card. Fix: serve the board from a trimmed/cached or paged list, and decide whether unworked researched prospects belong on the board at all (the source field was widened for directory sources like 'eequ', so some are meant to).",
    file: "server/src/routes/platformLeads.ts (GET /), server/src/routes/leads.ts (cache), features/platform/SalesApp.tsx", step: "d28s2",
  },
  {
    id: "s13-coord1", who: "claude", severity: "high",
    title: "Sales board, HQ live stream and signup lead-match read only the leads being worked",
    detail: "DECIDED 13 Sept by Kaz: yes — researched prospects reach the Sales board only once someone works them from HQ → Leads (nothing further to build). FIXED 13 Sept: leads carry `inPipeline` — set by a demo-form POST, any Sales-board create/edit/activity/bulk import, and a Leads-page status change away from New (which also moves the pipeline stage unless the board has it further on). GET /api/platform/leads, the platform live stream (events.ts) and registerRole's convertMatchingLead (pipeline leads + an exact-email lookup) no longer read all 26k researched prospects. Backfilled the 3 existing worked leads. d28s2 re-tested: 816 ms, 4 leads, demo lead + logged call shown.",
    file: "server/src/routes/platformLeads.ts, server/src/routes/leads.ts, server/src/routes/events.ts, server/src/routes/registerRole.ts", step: "d28s2",
  },
  {
    id: "s13-coord2", who: "claude", severity: "medium",
    title: "Leave emails could reach a same-named person in another franchise",
    detail: "FIXED 13 Sept: leave.ts emailForName now matches only staff in the same franchise (or head office when the manager has no franchise) — found by the payroll agent's franchise-isolation test.",
    file: "server/src/routes/leave.ts",
  },
  // ── 13 Sept full re-test, days 16–20 (agent D) ──
  {
    id: "s13-rtD1", who: "claude", severity: "medium",
    title: "Payroll held back the extra hour worked on the night the clocks go back",
    detail: "FIXED 13 Sept (re-test): since the payroll rebuild a real account is paid from approved timesheets, capped at the rota shift's scheduled length (default policy 'actual, capped at scheduled') — and that length was wall-clock end − start. A 01:00 BST → 02:00 GMT clocking on 25 Oct (2h worked) paid 1h plus '1h overtime unpaid', in payroll and in the Timesheets Pay-hrs column. The scheduled length is now real elapsed time (payCalc.ukShiftHours, using the londonMs helper moved out of PayrollApp): pays 2h; ordinary days, spring-forward (1h) and overnight shifts (still uncapped) unchanged; payroll maths 30/30.",
    file: "features/payroll/payCalc.ts (londonMs, ukShiftHours), features/payroll/PayrollApp.tsx (schedMap), features/timeclock/data.ts (scheduledHoursToday)", step: "d16s7",
  },
  // ── 13 Sept full re-test, days 21–24 (agent E) ──
  {
    id: "s13-rtE1", who: "claude", severity: "high",
    title: "HQ bell timed out — so a parent's data-deletion request never reached HQ",
    detail: "FIXED 13 Sept (re-test): GET /api/platform/notifications read every lead created in the last 45 days to find new demo requests — and the leads research import (12 Sept) put ~26,200 researched prospects in that window. The bell read ~50MB per refresh and died on a Firestore DEADLINE_EXCEEDED (150–300s), so nothing below it — including pending deletion requests (the statutory one-month clock) — was ever shown. It now queries only demo requests (source == 'demo', what the /demo form and the public schema default write; equality, no index), still dropping imported ones and anything older than 45 days. Re-tested: HQ bell 200 in ~9s under heavy load, lists the new deletion request; 2 recent demo requests still ring. A lead HQ types in itself (cold call etc.) no longer rings HQ's own bell.",
    file: "server/src/routes/platformNotifications.ts (lead section)", step: "d21s7",
  },
  {
    id: "s13-rtE2", who: "claude", severity: "medium",
    title: "One basket with the same child twice on the same day charges twice and holds two seats",
    detail: "FIXED 13 Sept (wave 3): POST /api/my/bookings refuses the same child twice in one basket for the same block + day (400 'X is in this basket twice for Mon 21 Sept — remove one of them') and a child who already holds a place on that exact day (409 'X already has a place on … (booking APF-…)'; matched by child id, or by name within the same family; a different TIMING on the same day is a different session and is allowed). The operator's POST /api/bookings refuses the same family's child already placed on that block. Tested (d23s3 notes): duplicate basket 400, single booking seats 1 (bookedCount 1), re-book 409, operator re-book 409, sibling same day 201. Open: not race-proof against two baskets for the same child landing at the same instant (checked before the transaction). The d23s3 step itself stays fail — multi-listing checkout is unbuilt.",
    file: "server/src/routes/my.ts (POST /bookings basket), server/src/routes/bookings.ts (POST /)", step: "d23s3",
  },
  {
    id: "s13-rtE3", who: "claude", severity: "medium",
    title: "A concern about a colleague filed as kind 'incident' is readable by every member of staff",
    detail: "FIXED 13 Sept (wave 4): a record whose subject is a member of staff is now manager/DSL-only whatever kind it was filed under (incidents.ts staffAccess). Other staff — leads included — don't get it in the list, ?kind=, dossier (or another record's dossier history) or notes (404). Whoever reported it sees it as status only ('Received — with the safeguarding lead' → 'The safeguarding lead has acted on your report'), with no text or name, and can no longer edit it. A parent only sees a staff-subject record (and is only emailed about it) when the DSL shares it; the parent data export follows the same rule. Also closed a second leak: the staff AI co-pilot's data snapshot carried every incident's text, safeguarding and confidential ones included — staff now get only what the log shows them. The safeguarding/incident screens show the status-only row with a 🔒 badge and no Details/Edit/Review buttons (screens not visually checked). Re-tested on a throwaway tenant: 20/20 incident checks.",
    file: "server/src/routes/incidents.ts (staffAccess, statusOnly), server/src/routes/ai.ts (tenantSnapshot incidents), features/incidents/SafeguardingApp.tsx, features/incidents/IncidentsApp.tsx", step: "d24s6",
  },
  // ── 13 Sept wave 4 (agent "fix4") ──
  {
    id: "s13-w4-sar", who: "claude", severity: "medium",
    title: "The data download left out dose records, most of the profile and register attendance",
    detail: "FIXED 13 Sept (wave 4): GET /api/privacy/export now also includes, for a parent: every medication dose given to their child (the MAR), register attendance for their bookings (signed in / absent + reason / collected and by whom / nappy changes / the notes staff shared with them), the whole account record (address, postcode, preferences … not credentials), bell history, deletion requests, feedback, referrals (without the other family's email) and email preferences. For staff (new): their own timeclock, leave, expense claims, availability, documents read, learning, appraisals (as My appraisals shows them) and onboarding record, plus their bell. Deliberately NOT in the self-serve copy: staff-internal register notes and referees' replies (same reasoning as confidential concerns — available on a formal request to the provider). Tested: counts and contents right, nothing of another family or colleague.",
    file: "server/src/routes/privacy.ts (gather)", step: "d21s6",
  },
  {
    id: "s13-w4-reopen", who: "claude", severity: "medium",
    title: "Signing in to a closed account reopened it without asking",
    detail: "FIXED 13 Sept (wave 4): sign-in now checks GET /api/account/reactivate first; a closed account gets 'Your account was closed on <date> — reopen it?' with 'Yes, reopen my account' (POST /api/account/reactivate {confirm:true}) or 'No, keep it closed' (signs out, stays closed). The POST refuses without confirm:true (400 confirm_required) and under HQ view-as (403). Tested in-process; the login screen itself wasn't clicked through (no browser sign-in here). The close-account copy ('reopen by signing back in within 30 days') still reads right; nothing enforces the 30 days.",
    file: "app/login/page.tsx, server/src/routes/account.ts (GET/POST /reactivate)", step: "d21s13",
  },
  {
    id: "s13-w4-dupref", who: "claude", severity: "medium",
    title: "'Still booked in' named the same booking twice",
    detail: "FIXED 13 Sept (wave 4): removing a booked child said 'still booked in (APF-10312, APF-10312)' because the booking matched both the child and the email lookup. The refs are de-duplicated ('… and N more' past three; 'that booking' / 'those bookings'). Tested: 'Ada Fix is still booked in (ZF62712). Cancel that booking first.'",
    file: "server/src/routes/my.ts (DELETE /children/:id)", step: "d21s5",
  },
  {
    id: "s13-w4-paylink", who: "claude", severity: "medium",
    title: "Invoice pay links never expired, even once paid or cancelled",
    detail: "FIXED 13 Sept (wave 4): a paid invoice's link now shows 'This invoice is paid' (amount, what for, paid date — no pay button, no payment methods, no family name), a cancelled one 'This invoice is closed'. Every link closes 90 days after the latest of its due date, issue date, last send and payment ('This payment link has expired — ask <provider> to send you a new link'; 410 link_expired), so re-sending an overdue invoice or moving its due date gives a working link again. Card checkout refuses expired links. Checked on the running web app with seeded throwaway invoices (paid / cancelled / expired / live). Kaz: 90 days is a guess — change LINK_DAYS in invoices.ts if you want longer/shorter.",
    file: "server/src/routes/invoices.ts (invoicePublic, linkExpiresOn), features/money/PayPage.tsx", step: "d25s8",
  },
  // ── 13 Sept wave 2 (agent "fix2staff"): staff messaging, bells, rota team, HO content → franchise staff ──
  {
    id: "s13-fs1", who: "claude", severity: "high",
    title: "Any member of staff could read every family's message threads",
    detail: "FIXED 13 Sept (wave 2): a plain member of staff (not a lead) now sees only the conversations they've written in — the register's late-pickup nudge, a booking's 'Message family', their own note or broadcast — and only from their first message on (thread.staffJoined[uid], stamped on send; never returned). Before, isOperator included staff, so a coach's token got every family's thread with the owner. Also: they can't file another family's thread into a folder, and see only their own bulk sends. Leads, owners and franchises unchanged. Old messages carry no stamp, so staff see none of them. Tested: 24 checks on a throwaway tenant (d20s1). Open for Kaz: a thread is ONE per family, shared by the team, so once a coach writes in it they also see the family's later replies to the owner (from their first message on) — confirm, or build per-sender threads; leads still see every family's thread (not site-scoped, s13-acc7).",
    file: "server/src/routes/messages.ts (plainStaffUid, joinStamp, GET /threads, GET /threads/:id, /threads/:id/folder, /broadcasts)", step: "d20s1",
  },
  {
    id: "s13-fs2", who: "claude", severity: "medium",
    title: "'Training reminder sent' landed on every staff member's bell",
    detail: "FIXED 13 Sept (wave 2): the Remind log is now on the sending manager's bell only (notifyTenantMember to the sender), not an untargeted team alert in category 'task' that every staff member's bell showed. The people reminded still get their own 'Reminder: …' bell + email. Tested (d17s9).",
    file: "server/src/routes/learning.ts (POST /notify)", step: "d17s9",
  },
  {
    id: "s13-fs3", who: "claude", severity: "high",
    title: "The Schedule couldn't put a real team member on the rota",
    detail: "FIXED 13 Sept (wave 2): the rota's staff list now includes the real team (useTeam: joined staff accounts of this head office/franchise; DEMO_STAFF only in demo mode), matched by name with a stable id team-<name> and saved with the next real change (derived, no save on open). The Deployment filter in Assign staff still applies. The four-made-up-people seeder ('Add sample shifts') shows only in demo mode and no longer replaces the staff list; ↻ Refresh reloads from the server, not localStorage. Open: real team members start at £0/hr — the Schedule has no pay-rate editor, so the wage forecast reads £0 until one exists (payroll keeps its own rates).",
    file: "features/schedule/ScheduleApp.tsx (withTeam, store useMemo, seedDemo, Refresh)", step: "d16s1",
  },
  {
    id: "s13-fs4", who: "claude", severity: "high",
    title: "Head office documents and courses never reached franchise staff",
    detail: "FIXED 13 Sept (wave 2): (a) Documents — a franchise's staff now also get head office's library documents that reach them (everyone / their role / a listing they're on — the chase's own rule, docReaches), read-only, ids prefixed 'ho:'; confirming one records it in HEAD OFFICE's receipts, so HO's chase stops counting them (4 → 3 in the test) and HO sees who read it. The franchise manager's library (what it edits and saves) is unchanged. (b) Learning — franchise staff's GET /api/learning/assignments adds head office's assignments whose locations reach their franchise (none/'all' = network-wide; a franchise's name/area; the same rule /notify uses), tagged fromHo; head office's own staff no longer get a franchise-only course; the franchise manager still gets exactly its own list. My learning shows one card per course. Tested (d17s4, d17s10). OPEN (decision): a franchise staff member's course PASS is stored under the franchise key and HO's Learning Centre lists only HO's own team, so head office still can't see franchise staff completing HO courses — needs a network view.",
    file: "server/src/routes/documents.ts (docReaches, HO_DOC, GET /library, POST /library/:docId/read), server/src/routes/learning.ts (GET /assignments, locsReach), features/learning/StaffCertsApp.tsx", step: "d17s10",
  },
  {
    id: "s13-fs5", who: "claude", severity: "medium",
    title: "Customer area → Messaging off didn't stop family messaging",
    detail: "FIXED 13 Sept (wave 2): with Setup → Customer area → Messaging (or Features → Messages) off, the family's GET /api/messages/threads leaves that provider out, opening a thread or sending is refused 403 area_off ('Messaging isn't available from this provider at the moment — please contact them directly…'), franchise-aware (a franchise family follows the franchise's own Setup). The provider's operational messages still reach the family BY EMAIL ONLY (register late-pickup nudge, booking 'Message family', Bookings' 'email these families'): the email has no app button and replies go to the provider's contact address; the API returns {emailOnly, note}; the provider's thread keeps the record, so it's all there if Messaging is switched back on. The family page /custdash/messages is refused by URL (ViewGate card). Tested 20/20 (d7s7). Open: the operator screens don't show the 'went by email only' note yet (needs i18n keys); the ViewGate card is English only; other family areas are still refused by data, not URL (s13-acc7 (5)).",
    file: "server/src/routes/messages.ts (familyMessagingOn, MESSAGING_OFF, EMAIL_ONLY_NOTE), server/src/lib/emails.ts (emailNewMessage emailOnly), components/auth/ViewGate.tsx (CUSTDASH_AREA), lib/use-customer-area.ts (fetchCustomerArea)", step: "d7s7",
  },
  // ── 13 Sept wave 2 (agent "fix2small"): CSV injection, PDF receipts, reorder level, pt Browse, test-user cleanup ──
  {
    id: "s13-f2s1", who: "claude", severity: "high",
    title: "CSV exports ran parent-typed text as spreadsheet formulas",
    detail: "FIXED 13 Sept (wave 2): new lib/csv.ts (csvCell/csvText) — quotes as before and puts an apostrophe in front of any text cell starting = + - @ tab or CR (real numbers and plain numeric strings stay numeric, so money columns still sum). Used by Money in, Money out, Invoices, Purchasing, the Finance hub CSV, Registers CSV, Payroll and the bookings/families toCsv; LeadsApp's csvCell has the same rule inline. Checked with the real helper ('=HYPERLINK(…)', '+1+1', '-2+3', '@SUM', tab/CR → text; -12.5 stays a number). STILL OPEN: features/learning (LearningCentreApp downloadCSV, CredentialsApp csv) still uses the old quote-only escaper — left for the fix2staff owner of that area; swap its escaper for csvCell. Not opened in a real spreadsheet.",
    file: "lib/csv.ts; features/money/{IncomeApp,ExpensesApp,InvoicesApp,PurchasingApp,FinanceAnalyticsApp}.tsx; features/registers/RegistersApp.tsx; features/payroll/PayrollApp.tsx; features/bookings/helpers.ts; features/platform/LeadsApp.tsx", step: "d18s6",
  },
  {
    id: "s13-f2s2", who: "claude", severity: "medium",
    title: "Receipts could only be photos — no PDF receipts",
    detail: "FIXED 13 Sept (wave 2): /api/uploads accepts application/pdf for PRIVATE uploads only, checks the bytes really start %PDF-, caps it at ~750KB (base64 ≤ 1,000,000 chars so the image doc stays under Firestore's 1MiB) and serves it inline as receipt.pdf behind the same signed, expiring link (bare link 403). Expenses, Purchasing and the staff 'My expenses' claim picker take image/* or PDF; a PDF shows a 'file' chip with the Open link (photos still preview). Purchasing bills are now private files like expense receipts (stored bare, re-signed on every response); older public attachments keep working. Open: images still have the 900KB decoded cap, which can exceed Firestore's 1MiB once base64-encoded (a rare 500 instead of a 413) — separate from this fix.",
    file: "server/src/routes/uploads.ts, server/src/routes/purchasing.ts (signDoc), features/money/ExpensesApp.tsx, features/money/PurchasingApp.tsx, features/staff/StaffExpensesApp.tsx", step: "d18s5",
  },
  {
    id: "s13-f2s3", who: "claude", severity: "medium",
    title: "Inventory: a reorder level couldn't be removed",
    detail: "FIXED 13 Sept (wave 2): the edit form sent a blank 'Reorder at' as undefined and the merging PUT kept the old value. Now the form sends null for blank fields when editing and the schema accepts null (category/location/unit/minQty/notes) — PUT minQty:null clears it and the item stops being flagged low. Season is deliberately never cleared (a seasonless item drops out of every season view). A cleared category/location re-opens as '— none —'.",
    file: "server/src/routes/inventory.ts (itemSchema), features/inventory/InventoryApp.tsx (ItemForm submit)", step: "d18s7",
  },
  {
    id: "s13-f2s4", who: "claude", severity: "medium",
    title: "Parent Browse page ~38% English in Portuguese",
    detail: "FIXED 13 Sept (wave 2): added the 26 missing Browse strings (age/date/season/price filters, price units, offer badges, TFC/vouchers, card actions) plus 2 other parent strings to parent.pt, European Portuguese to match the existing block, placeholders kept. Re-measured: Browse 0% English in pt. Payments (~20% English in every language, 12 Sept) not re-measured.",
    file: "lib/i18n/messages/areas/parent.ts (end of parent.pt)", step: "d20s11",
  },
  {
    id: "s13-f2s5", who: "claude", severity: "medium",
    title: "Throwaway test users left behind by tonight's fix agents",
    detail: "FIXED 13 Sept (wave 2): deleted 24 self-test docs, ids/tenantIds all starting 'zz': 10 users zzpay-{fr,frstaff,mgr,staff,staff2}-1789253065063/-1789253120852 (tenants zz-selftest-payroll-*, which had no tenant doc), 2 users zz-money-1789252292134-mgr1/-mgr2, tenants zz-selftest-money-1789252292134 and …-b, 9 bookings zz-selftest-money-1789252292134_* and 1 payment tagged with that tenant. Scanned every top-level collection for docs tagged with (or keyed by) those 4 tenant ids; nothing else remained. No Firebase Auth accounts were involved.",
    file: "scratchpad/acceptance/fix-fix2small/cleanup.mts",
  },
  // ── 13 Sept wave 3 (agent "fix3ops"): code race, register double-tap, subtask assignees, manual payments ──
  {
    id: "s13-fx3-codes", who: "claude", severity: "high",
    title: "A one-use discount code could be spent three times by simultaneous checkouts",
    detail: "FIXED 13 Sept (wave 3): the usage cap was checked before the booking transaction and usedCount bumped after it, so 3 parallel checkouts with a usageLimit:1 code all got the discount (usedCount 3). Codes are now re-read and spent INSIDE the booking transaction (lib/discountRedemptions.ts redeemCodesInTx): the code doc and — for a once-per-customer code — a deterministic redemption doc per code+family are read under the transaction and written with the bookings, so Firestore serialises the contenders. The loser gets 409 'Code X has just been used up — remove it to book without it' (or 'You’ve already used code X') and NOTHING is booked at the discount. Tested (d7s6): 3 parallel → 1×201 at £95 + 2×409, usedCount 1, one redemption, no loser bookings; same-family per-customer race → 1 booking; release-on-cancel still hands the code back.",
    file: "server/src/lib/discountRedemptions.ts, server/src/routes/my.ts (POST /bookings)", step: "d7s6",
  },
  {
    id: "s13-fx3-register", who: "claude", severity: "high",
    title: "Register double-tap from a stale phone flipped a signed-in child back to not-arrived",
    detail: "FIXED 13 Sept (wave 3): register marks were toggles, so phone B (not refreshed) tapping In on a child phone A had just signed in recorded them as NOT here. The mark endpoint now sets explicit states — in / absent / collect / uncollect / reset — and is idempotent (already in that state = unchanged, first time + marker kept). The client also sends `from`, the state its screen showed: a real change from a stale screen is refused with 409 register_changed + who marked it and when, and the screen refreshes — a stale phone can never silently overwrite a colleague's mark or turn a signed-in child absent. Undo is explicit (tapping the lit button sends reset / uncollect). Bulk sign-all-in / In / Collect / Absent skip rows changed elsewhere and say how many. Rationale written above markSchema in registers.ts. Tested (d10s12, 6 checks incl. same-moment conflicting taps → one wins, other told, devices agree). Register screen not visually checked.",
    file: "server/src/routes/registers.ts (POST /:blockId/:date/mark), features/registers/RegistersApp.tsx (mark, markMany, applyAction)", step: "d10s12",
  },
  {
    id: "s13-fx3-tasks", who: "decision", severity: "medium",
    title: "Subtask assignees: what may someone given one step of a task see and do?",
    detail: "FIXED 13 Sept (wave 3) with a least-privilege default — Kaz to confirm: a step assigned to someone now reaches them. Staff: GET /api/tasks lists a task where one of the steps is theirs (flagged subtaskOnly); they may tick/untick THEIR step(s) and add comments (stamped with their real name) — title, status, due, assignee, other people's steps, renaming their step and deleting are refused (403), a stale copy gets 409. Operators: My tasks (web) now includes tasks with a step assigned to you (taskDisplay.hasMySub); their edit rights are unchanged. Steps picked from the team list now carry whoEmail (names aren't unique); legacy name-only steps match on the person's name. The staff drawer for these is a cut-down StepsOnlyDrawer; the staff dashboard links to it instead of offering a whole-task tick. DECISIONS: (1) should a step-only assignee see the WHOLE task (other steps, comments, links) as now, or only their step + title? (2) should they be able to mark the whole task done when theirs was the last step? (3) should the row status dropdown be hidden for them (the server already refuses it). Tested (d11s8).",
    file: "server/src/routes/tasks.ts (whoAmI, mySubs, saveOwnSteps), features/tasks/taskDisplay.ts, features/tasks/TasksApp.tsx, features/dashboard/StaffDashApp.tsx", step: "d11s8",
  },
  {
    id: "s13-fx3-pay", who: "claude", severity: "high",
    title: "Manual payments: the same payment logged twice counted twice; overpayments and money on cancelled bookings vanished",
    detail: "FIXED 13 Sept (wave 3), manual path only (the HMRC/TFC feed is Amir's, untouched): record-payment now (a) refuses what looks like the same payment again — same booking, same amount, same reference (case/space-insensitive; blank = same), dated within 24h — with 409 possible_duplicate naming when and by whom it was logged, unless the operator confirms it's a second payment (the form offers 'It's a second payment — record it'); the check and the payment record are in the booking's transaction, so a double-click counts once; (b) returns `overpaid` when more than the price has come in, and Reconciliation shows it (overpaid chip, reconciled=false, summary.overpaid) instead of a silent 'Paid'; (c) money logged on a cancelled/declined booking is kept as receivedAfterCancel and stays on Reconciliation as 'needs refund / credit' until a refund is approved (summary.needsRefund). Tested (d8s5/d8s7/d8s8/d8s11). OPEN for Kaz: no one-click 'keep it as a fee' or 'credit to wallet' on those rows yet (they clear when a refund is approved); '✓ Reconcile' is hidden on money-to-give-back rows because it resets amountPaid to the price.",
    file: "server/src/routes/bookings.ts (record-payment), server/src/routes/reconciliation.ts, features/reconciliation/ReconciliationApp.tsx, features/bookings/types.ts (receivedAfterCancel)", step: "d8s5",
  },
  // ── 13 Sept wave 5 (agent "fix5"): DSL alerting, age caps, paid-on-create invoice, postcode probing, public rate limits, signup name, zz sweep ──
  {
    id: "s13-fx5-dsl", who: "claude", severity: "critical",
    title: "The Safeguarding Lead named in Setup was never told when a concern was logged",
    detail: "DECIDED 13 Sept by Kaz + BUILT: (1) the named DSL — and a deputy DSL (new optional Setup → Safeguarding 'Deputy DSL' name + sign-in email, next to a new 'DSL's email' input the screen never had) — gets full safeguarding read/write on concerns and allegations even on a staff account: incidents.ts staffAccess/staffMayRead take a lead flag (isSafeguardingLead: their login email = dslEmail/deputyDslEmail of their franchise, else head office), so they see the full record in the list (past a site scope too), edit it (DSL decisions/dslLog), add notes and open the dossier; delete stays owner-only; middleware/access.ts lets them past the matrix on the incidents area. (2) An allegation about any staff member ALSO alerts the account holder (bell + details-free mail). (3) An allegation whose subject is the DSL/deputy (the concern form's new 'This is about our safeguarding lead' tick, or the named staff member matching the DSL/deputy name in Setup) is stored aboutDsl and goes to the account holder ONLY — the leads aren't alerted and can't open it (404 on list/edit/note/dossier); the reporter sees 'Received — with the account holder'; only an owner can clear the flag. The deputy is alerted with the DSL on every concern. Tested (d13s2, 69-check suite). Caveats: if the account holder IS the DSL (a solo provider, or an owner who named themselves), 'holder only' still reaches them; a head-office DSL on a staff account covers the whole tenant (incl. franchises with their own DSL). ORIGINAL: FIXED 13 Sept (wave 5): settings.safeguarding.dslEmail was stored and read nowhere, so on a company account a coach could log a disclosure and the DSL heard nothing. New server/src/lib/dslAlert.ts, called once from POST /api/incidents: a safeguarding concern, an allegation about a member of staff, or anything filed confidential now (a) raises an in-app bell aimed at the DSL's own account (toEmail — only they see it; colleagues and the owner don't) when an account on the tenant has that email, and (b) emails the DSL address via the normal mailer (MAIL_LIVE/allowlist respected — locally logged SUPPRESSED). The email says only that a concern needs attention + a link; no child name or details (they stay in-app). Who: the child's franchise's own DSL if set, else head office's; blank everywhere → the account holder (the setting's documented default). No self-alert when the DSL (or a solo freelancer) logged it. Tested (d13s2 / d2s3): staff concern → DSL bell + mail, owner 0; allegation → DSL; franchise → franchise DSL, else HO's; accident → nothing. (Was OPEN for Kaz — decided above:) a DSL whose account is plain STAFF gets the bell, but staff can't read other people's concerns in the list (staffAccess) — should the named DSL get full safeguarding access? And an allegation ABOUT the DSL still goes to the DSL (no way to tell from the record) — should staff allegations also copy the account holder? Arrival in a real inbox still needs mail live (p2).",
    file: "server/src/lib/dslAlert.ts, server/src/routes/incidents.ts, server/src/middleware/access.ts, features/setup/SetupApp.tsx, features/incidents/SafeguardingApp.tsx, lib/settings.ts", step: "d13s2",
  },
  {
    id: "s13-fx5-agecaps", who: "claude", severity: "medium",
    title: "Listing wizard per-age-group caps were thrown away on save",
    detail: "FIXED 13 Sept (wave 5): ageCaps / ageCapsOn weren't in listings.ts baseListingSchema, so zod stripped them and the caps vanished. Now stored (record of Setup age-group id → whole number 0–10000, ≤50 entries; 0 = closed to that age) and returned, so the wizard reloads them. Tested (d2s8): POST/PUT store them, GET returns them, -1 / 1.5 → 400, turning caps off stores {}. NOT ENFORCED at booking — no per-age cap logic exists server-side yet (§S); the wizard's 'Enforced once the backend is built' badge is still true.",
    file: "server/src/routes/listings.ts (baseListingSchema)", step: "d2s8",
  },
  {
    id: "s13-fx5-invpaid", who: "claude", severity: "high",
    title: "An invoice created already marked paid didn't settle its booking",
    detail: "FIXED 13 Sept (wave 5): POST /api/invoices with status 'paid' now calls the same settleInvoiceBooking() as marking it paid later (idempotent via bookingSettledAt). Tested (d4s7): £150 raised paid → booking Paid/£150 once, re-save → still £150; draft → booking untouched; £60 raised paid on £150 → Partially paid.",
    file: "server/src/routes/invoices.ts (POST /)", step: "d4s7",
  },
  {
    id: "s13-fx5-postcode", who: "claude", severity: "medium",
    title: "Provider search matched on the full postcode, so a hidden home postcode could be confirmed by guessing",
    detail: "FIXED 13 Sept (wave 5): the public directory only ever shows the outward code, but matched on the full one ('MK14 6BN' yes, 'MK14 6BX' no). Matching now uses the outward code only; a full postcode typed in is cut to its outward half, so a right and a wrong inward half give the same answer. Applies to every provider (there is no per-provider show-full-address flag). Tested (d5s3/d5s4).",
    file: "server/src/routes/providers.ts", step: "d5s3",
  },
  {
    id: "s13-fx5-ratelimit", who: "claude", severity: "medium",
    title: "Several unauthenticated endpoints had no rate limit",
    detail: "FIXED 13 Sept (wave 5): the existing rateLimit() now also guards /api/events 120/min, /api/images 600, /api/emails/open 1000 (mail-client proxies share IPs), /api/emails/inbound 300, /api/geo/tiles 1200 (each tile spends OS-key quota), and SIGNED-OUT /api/listings + /api/public/library 300 each (anonOnly — operators saving listings aren't throttled; a bad token is a 401). Left alone on purpose: the Stripe + Resend webhooks (signature-verified; a 429 would drop real events) and /health. Tested (d5s5): 640 anonymous listings calls → 300 then 429; images → 600 then 429; signed-in unaffected. Still in-memory per instance.",
    file: "server/src/index.ts", step: "d5s5",
  },
  {
    id: "s13-fx5-signup80", who: "claude", severity: "medium",
    title: "Signup business name had no 80-character limit on the client",
    detail: "FIXED 13 Sept (wave 5): the server already refused >80 (register-role) — but the Firebase account is created first, so an 81-char name left a login with no role. The business-name input now has maxLength 80 and the step refuses >80 before continuing; 'Your name' (sent as providerName, also max 80) has maxLength 80 too. Code + type-check only; screen not rendered (d1s3).",
    file: "app/signup/page.tsx", step: "d1s3",
  },
  {
    id: "s13-fx5-zzsweep", who: "claude", severity: "medium",
    title: "Other agents' ZZ test providers showed in the public provider search",
    detail: "FIXED 13 Sept (wave 5): deleted leftovers from crashed self-test runs (all >1h old, ids zz-selftest-*/zz-*-<timestamp>): tenants zz-selftest-parent-1789252518077 ('ZZ Parent Test A') + …-b ('ZZ Parent Test B'); 8 users zz-parent-1789252518077-{mgr,p,pl,q,r,s,u2,v}; 6 walletEntries tagged zz-selftest-money-1789252408568(-b) / -1789253288292(-b) / zz-selftest-rtD-money-1789254623535(-b); 1 schedulerFired doc for zz-selftest-B-1789225697774-reg. ('ZZ Money Test' / 'ZZ rtF A/B' tenants were already gone.) Random Firestore auto-ids that merely start 'zz' (leads, pageViews, images) are real data and were NOT touched. q=zz on the live directory → [] afterwards (d5s4).",
    step: "d5s4",
  },
  // ── 13 Sept: Kaz's decisions implemented (agent "decisions") ──
  {
    id: "s13-dec-med", who: "claude", severity: "high",
    title: "A provider could delete a medicine the parent had withdrawn consent for",
    detail: "DECIDED 13 Sept by Kaz + FIXED 13 Sept: once a parent has withdrawn consent OR any dose has been recorded, a medication can't be deleted — only archived (kept with full history, hidden from the active list, shown under Archived and in the family's data export). DELETE /api/medications/:id on a withdrawn record → 409 code keep_archived (doses already → 409). MedicationApp: an archived withdrawn record shows 'Parent withdrew consent — kept on the record' in place of Restore (the server refuses it); a Delete button appears only on an archived record with no doses and no withdrawal (a mistaken entry). Before, a withdrawn medicine with no doses could be deleted (200) and the parent's withdrawal vanished (agent C's d12s6 residual). Tested (d12s6).",
    file: "server/src/routes/medications.ts (DELETE), features/medication/MedicationApp.tsx", step: "d12s6",
  },
  // ── 17 Sept: found + fixed while triaging the e2e Playwright suite ─────────
  {
    id: "s17-leave-crash", who: "claude", severity: "high",
    title: "Requesting leave could crash if an existing absence record had no name",
    detail: "FIXED 17 Sept: the overlap check in POST /api/leave/absences called a.name.trim() on every existing absence for the rota key, but `name` is optional in the schema — any record saved without one (possible via direct API use, or a partial migration) threw and took the whole leave-request flow down for that person, not just that one row. Now (a.name ?? \"\").trim(). Found via a clean tsc --noEmit pass after fixing an unrelated corrupted node_modules install.",
    file: "server/src/routes/leave.ts", step: "n/a — found via typecheck, not a plan step",
  },
  {
    id: "s17-salesapp-selects", who: "claude", severity: "medium",
    title: "Sales lead-edit form: 4 dropdowns had a broken accessible name, and Companies House website-build leads showed as \"Cold call\"",
    detail: "FIXED 17 Sept: the Type/Source/Likely plan/Stage <select>s in the lead-edit modal were each wrapped inside their own <label>, so each one's computed accessible name concatenated the label text with whichever option was selected (e.g. selecting \"Business\" under \"Type\" made that select's accessible name collide with the real \"Business name\" text input — broke a getByLabel(\"Business\") lookup in the HQ e2e spec, and would equally confuse anyone using a screen reader on this form). Moved all 4 to htmlFor/id association. Separately, normSource() didn't recognise the website-build add-on's/demo form's raw source strings, so those leads silently defaulted to \"cold_call\" — added a website_build source id + better keyword matching.",
    file: "features/platform/SalesApp.tsx", step: "n/a — found via e2e/hq.spec.ts",
  },
  {
    id: "s17-invite-email-inconsistency", who: "decision", severity: "medium",
    title: "Two different \"invite a team member\" flows disagree on whether an email is required",
    detail: "NOT FIXED — needs a decision. HoTeamApp (head-office combined view, /company/staff with no scope) explicitly supports a blank-email, link-only invite — the copy literally says \"email (optional — or copy a link)\". TeamApp (the plain per-site Team & invites view, reached via ?hoScope=__ho__ or a non-franchised account) is a 5-step wizard where step 1's Next button is disabled until an email is filled — there is no way to create a link-only invite through it, and the join page enforces that the new person signs up with EXACTLY that email (\"This invite was sent to X — sign up with that address\"). So the same underlying feature (invite by shareable link, no email) works in one operator view and not the other. Decide whether TeamApp should also allow a blank email (matching HoTeamApp), or whether HoTeamApp's optional-email path should go away for consistency.",
    file: "features/team/TeamApp.tsx, features/team/HoTeamApp.tsx", step: "n/a — found via e2e/secondary.spec.ts",
  },
];

export const bySeverity = (a: BacklogItem, b: BacklogItem) =>
  ({ critical: 0, high: 1, medium: 2 })[a.severity] - ({ critical: 0, high: 1, medium: 2 })[b.severity];
