/**
 * The 25-day acceptance test plan.
 *
 * Day 1 = Fri 11 Sept 2026 (the day Kaz lands), Day 25 = Mon 5 Oct.
 * Days 1–7 deliberately need NO backend work, so a slip on Amir's 18 Sept
 * deadline costs nothing at the start. Everything that depends on him —
 * Tax-Free Childcare reconciliation above all — sits from Day 8 onward.
 *
 * Steps are written to be executed literally: go here, do this, expect that.
 * If the "expect" doesn't happen, that's a fail — log it, don't interpret it.
 *
 * Several steps exist because a 9-agent audit on 8 Sept found a confirmed bug
 * there. Those carry `regression: true` — they are the ones most likely to
 * still be broken, and the ones worth re-running after any fix.
 */

export type Owner = "amir" | "frontend" | "unknown";

export interface Step {
  /** Stable id — results are keyed on this, so never renumber a shipped step. */
  id: string;
  /** Where to be before starting. A portal path or a plain-English location. */
  where: string;
  /** The action, in the imperative. One action per step. */
  action: string;
  /** What must happen. If it doesn't, fail the step. */
  expect: string;
  /** Set when this step exists to re-check a known bug. */
  regression?: boolean;
  /** Set when the step cannot pass until Amir's backend work lands. */
  needsBackend?: boolean;
}

export interface Day {
  day: number;
  /** ISO date, so the UI can say "today" without guessing. */
  date: string;
  label: string;
  title: string;
  /** Which portal you spend the day in. */
  portal: "operator" | "parent" | "staff" | "franchise" | "hq" | "public";
  /** One line on why this day matters — shown under the title. */
  intent: string;
  steps: Step[];
}

export const PLAN_START = "2026-09-11";
export const AMIR_DUE = "2026-09-18";

export const PLAN: Day[] = [
  {
    day: 1, date: "2026-09-11", label: "Fri 11 Sept", portal: "operator",
    title: "Sign up & onboarding",
    intent: "A brand-new provider, from nothing to a usable account. If this is wrong, nothing after it matters.",
    steps: [
      { id: "d1s1", where: "/signup", action: "Create a brand-new Freelancer account with an email you've never used here", expect: "Account created, you land in the portal, no error banner" },
      { id: "d1s2", where: "Onboarding wizard", action: "Complete every step without skipping", expect: "Each step saves and you cannot proceed past a required field left blank" },
      { id: "d1s3", where: "Onboarding — provider name", action: "Choose 'show my business name', then finish", expect: "The name you chose appears in the sidebar and on your customer-facing pages" },
      { id: "d1s4", where: "Onboarding — provider name", action: "Go back to Setup and switch to 'show my own name'", expect: "The change propagates — check the sidebar AND a customer page" },
      { id: "d1s5", where: "Setup → branding", action: "Upload a logo and set a brand colour", expect: "Sidebar and customer pages pick up both" },
      { id: "d1s6", where: "/signup", action: "Repeat d1s1 but choose the Company plan", expect: "You get the company portal — Team, Locations and Staff schedule are in the sidebar" },
      { id: "d1s7", where: "Both new accounts", action: "Sign out and back in", expect: "You return to the right portal for each account, with your setup intact" },
    ],
  },
  {
    day: 2, date: "2026-09-12", label: "Sat 12 Sept", portal: "operator",
    title: "Setup & features, roles, safeguarding config",
    intent: "Every switch in Setup should visibly change the product. A toggle that does nothing is a bug.",
    steps: [
      { id: "d2s1", where: "Setup → Setup & features", action: "Switch OFF three features (e.g. Meals, Trips, Inventory)", expect: "All three vanish from the sidebar immediately, no reload needed" },
      { id: "d2s2", where: "Setup → Setup & features", action: "Switch them back on", expect: "All three return" },
      { id: "d2s3", where: "Setup → Safeguarding", action: "Set the DSL name, title and email", expect: "Saved, and the name shows on the Log-a-concern form" },
      { id: "d2s4", where: "Setup → Safeguarding", action: "Add a local authority with LADO, social care and out-of-hours numbers", expect: "They appear on the concern form as click-to-call links" },
      { id: "d2s5", where: "Setup → Safeguarding", action: "Edit the concern categories and the 'what to do now' protocol", expect: "Your wording — not the defaults — shows on the form" },
      { id: "d2s6", where: "Setup → Roles & permissions", action: "Set an area to None for a role, save, then sign in as someone with that role", expect: "That area is genuinely unreachable, not just hidden" },
      { id: "d2s7", where: "Setup → Seasons", action: "Add a season and set its dates", expect: "It's offered when you build a listing" },
      { id: "d2s8", where: "Setup → Age groups", action: "Create an age group", expect: "Available on Ratios, and read-only there as designed" },
    ],
  },
  {
    day: 3, date: "2026-09-13", label: "Sun 13 Sept", portal: "operator",
    title: "Build a listing of every type",
    intent: "The listing builder is the front door. Build one of each shape and check the customer page matches.",
    steps: [
      { id: "d3s1", where: "Blocks & listings → new", action: "Build a HOLIDAY CAMP: multi-day, ages 5–12, capacity 30, a price per day", expect: "Saves; the customer page shows dates, ages, price and places left" },
      { id: "d3s2", where: "Blocks & listings → new", action: "Build a WEEKLY CLASS running Tuesdays for 6 weeks", expect: "All six dates generate; the customer page lists them" },
      { id: "d3s3", where: "Blocks & listings → new", action: "Build a BLOCK of 6 sessions sold as one purchase", expect: "Sold as a block, not six separate items" },
      { id: "d3s4", where: "Blocks & listings → new", action: "Build a ONE-OFF trip with a different venue", expect: "Venue shows correctly on the customer page" },
      { id: "d3s5", where: "Listing wizard → Staff step", action: "Assign staff to a listing", expect: "They appear in 'Meet the team' on the customer page" },
      { id: "d3s6", where: "Listing wizard", action: "Set a cut-off time and a capacity of 2", expect: "Both are enforced later on Day 6 — note the listing name here" },
      { id: "d3s7", where: "Listing wizard → questions", action: "Add a custom question parents must answer", expect: "It's asked at checkout and the answer lands on the booking" },
    ],
  },
  {
    day: 4, date: "2026-09-14", label: "Mon 14 Sept", portal: "operator",
    title: "Capacity, waitlists, discounts & codes",
    intent: "The commercial rules. Get these wrong and you either oversell or undercharge.",
    steps: [
      { id: "d4s1", where: "Blocks & listings", action: "On the capacity-2 listing, check the places counter", expect: "Reads 2 available" },
      { id: "d4s2", where: "Marketing → Discount codes", action: "Create a 20% code, no restrictions", expect: "Saved and live" },
      { id: "d4s3", where: "Marketing → Discount codes", action: "Create a £10-off code marked exclusive (can't combine)", expect: "Saved with the exclusive flag" },
      { id: "d4s4", where: "Marketing → Discount codes", action: "Create a code limited to one use per customer", expect: "Saved with the limit" },
      { id: "d4s5", where: "Listing wizard → discounts", action: "Set a sibling discount and an early-bird discount on a listing", expect: "Both show on the customer page as available savings" },
      { id: "d4s6", where: "Setup → Memberships", action: "Create three tiers: free, credit-based, percentage-based", expect: "All three save and show on the customer page" },
      { id: "d4s7", where: "Marketing → Referrals", action: "Check the referral reward settings", expect: "Reward amount is configurable and saves" },
    ],
  },
  {
    day: 5, date: "2026-09-15", label: "Tue 15 Sept", portal: "public",
    title: "Public pages & the parent front door",
    intent: "Everything a family sees before they have an account, including the new marketing pages.",
    steps: [
      { id: "d5s1", where: "Your customer booking page", action: "Open it signed out, on a phone", expect: "Readable, no horizontal scrolling, all listings visible" },
      { id: "d5s2", where: "Customer page", action: "Use every filter (age, date, venue, type)", expect: "Results narrow correctly; clearing restores everything" },
      { id: "d5s3", where: "/v2/parents.html", action: "Read it end to end on desktop and phone", expect: "No placeholder text, no broken image, no horizontal scroll" },
      { id: "d5s4", where: "/v2/parents.html", action: "Click 'Parent sign up' in the nav", expect: "Lands on /parent with the Create-an-account tab already open", regression: true },
      { id: "d5s5", where: "/parent → Create an account", action: "Type the first 2 letters of your provider's name", expect: "Your provider appears in the dropdown", regression: true },
      { id: "d5s6", where: "/parent → Create an account", action: "Check what the dropdown shows under each provider name", expect: "A town and/or postcode — NEVER a full street address", regression: true },
      { id: "d5s7", where: "/v2/schools.html and /v2/safeguarding.html", action: "Read both, click every footer link", expect: "No 404s, no page with the wrong nav tab highlighted" },
      { id: "d5s8", where: "Any v2 page", action: "Open the 'Built for' menu", expect: "Four personas including Schools & academies" },
    ],
  },
  {
    day: 6, date: "2026-09-16", label: "Wed 16 Sept", portal: "parent",
    title: "The parent booking journey — card payment",
    intent: "The single most important flow in the product. Book as a real parent would.",
    steps: [
      { id: "d6s1", where: "Customer page", action: "As a parent, add a child and book one session, paying by card", expect: "Booking confirmed, receipt visible, card charged the amount shown" },
      { id: "d6s2", where: "Checkout", action: "Before paying, compare the basket total to what you're actually charged", expect: "They match to the penny", regression: true },
      { id: "d6s3", where: "Checkout", action: "Book two children onto two different listings in ONE basket", expect: "Both appear, one payment, sibling discount applied automatically" },
      { id: "d6s4", where: "Checkout", action: "Add a paid add-on and a meal, then apply the 20% code", expect: "The discount comes off the SESSION price only, and the quoted total is what you pay", regression: true },
      { id: "d6s5", where: "Checkout", action: "Try to add the exclusive code on top of the 20% code", expect: "Refused with a clear message, not a silent failure" },
      { id: "d6s6", where: "Checkout", action: "Fill the capacity-2 listing, then try to book a third place", expect: "Blocked and offered the waitlist" },
      { id: "d6s7", where: "Checkout", action: "Join the waitlist, then cancel one confirmed place as the operator", expect: "The waitlisted family is offered the freed place" },
      { id: "d6s8", where: "Parent → My bookings", action: "Check everything you just booked is listed", expect: "All bookings, correct dates, correct child, correct status" },
    ],
  },
  {
    day: 7, date: "2026-09-17", label: "Thu 17 Sept", portal: "parent",
    title: "Wallet, memberships, coupons, referrals",
    intent: "Everything that reduces what a parent pays. Each one must be right to the penny.",
    steps: [
      { id: "d7s1", where: "Parent → Memberships", action: "Join the credit-based tier", expect: "Credit lands in the wallet, and the wallet balance updates" },
      { id: "d7s2", where: "Parent → checkout", action: "Book with wallet credit available", expect: "Credit is deducted, and the remainder is what's charged" },
      { id: "d7s3", where: "Parent → Memberships", action: "Switch to the percentage tier and book again", expect: "The discount applies automatically without entering a code" },
      { id: "d7s4", where: "Parent → checkout", action: "Try stacking the membership discount with a sibling discount", expect: "Behaves exactly as your Setup rules say — write down what you configured" },
      { id: "d7s5", where: "Parent → Refer a friend", action: "Copy your referral link and open it in a private window", expect: "It resolves to your provider's page with the referral attached" },
      { id: "d7s6", where: "Parent → Coupons", action: "Check any codes you hold appear", expect: "Listed with their terms" },
      { id: "d7s7", where: "Parent → Memberships", action: "Cancel the membership", expect: "Cancelled, and unused wallet credit is still yours" },
      { id: "d7s8", where: "Parent portal", action: "Try to join a DIFFERENT provider's membership (one you've never booked with)", expect: "Refused — you should not be able to hold credit with a provider you have no relationship with", regression: true, needsBackend: true },
    ],
  },
  {
    day: 8, date: "2026-09-18", label: "Fri 18 Sept", portal: "parent",
    title: "★ Tax-Free Childcare — the full reconciliation",
    intent: "Amir's headline deliverable, due today. This is the day that decides whether the release is real.",
    steps: [
      { id: "d8s1", where: "Parent → checkout", action: "Choose Tax-Free Childcare as the payment method", expect: "You're shown the provider's account details AND a payment reference unique to your child", needsBackend: true },
      { id: "d8s2", where: "Checkout", action: "Copy the reference", expect: "Copies cleanly; the same reference is shown again in My bookings" , needsBackend: true },
      { id: "d8s3", where: "Operator → Bookings", action: "Find the booking created by that TFC checkout", expect: "Shows as awaiting payment, with the reference against it", needsBackend: true },
      { id: "d8s4", where: "Simulate the payment arriving", action: "Have Amir trigger (or record) an inbound TFC payment carrying that exact reference", expect: "The booking flips to Paid, balance £0, WITHOUT anyone matching it by hand", needsBackend: true },
      { id: "d8s5", where: "Parent → My bookings", action: "Check the parent's view after the payment lands", expect: "Shows Paid, with a receipt" , needsBackend: true },
      { id: "d8s6", where: "Repeat d8s4", action: "Send a payment with a WRONG or missing reference", expect: "It does NOT auto-match; it surfaces somewhere an operator can see and resolve it — it must not vanish", needsBackend: true },
      { id: "d8s7", where: "Repeat d8s4", action: "Send a PART payment (£60 against a £120 booking)", expect: "Booking shows partially paid with the correct balance remaining", needsBackend: true },
      { id: "d8s8", where: "Checkout", action: "Pay part by TFC and the rest by card in one checkout", expect: "Both recorded, totals reconcile", needsBackend: true },
      { id: "d8s9", where: "Operator → Reconciliation", action: "Review the TFC statement view", expect: "Shows what's been sent, what matched, and what's outstanding", needsBackend: true },
    ],
  },
  {
    day: 9, date: "2026-09-19", label: "Sat 19 Sept", portal: "operator",
    title: "Refunds, cancellations, invoices, payment plans",
    intent: "Money going back out. The audit found a confirmed bug here — step 4 is that bug.",
    steps: [
      { id: "d9s1", where: "Setup → cancellation policy", action: "Set a policy: 100% refund over 14 days' notice, 50% inside 14 days", expect: "Saved and shown to parents before they pay" },
      { id: "d9s2", where: "Parent → My bookings", action: "Cancel a fully-paid booking with 3 weeks' notice", expect: "Offered a 100% refund, and it's issued to card or wallet as configured" },
      { id: "d9s3", where: "Parent → My bookings", action: "Cancel a fully-paid booking with 3 days' notice", expect: "Offered 50%" },
      { id: "d9s4", where: "Operator → Bookings", action: "Record a PART payment (£150 of £200), then have the parent cancel with 3 weeks' notice", expect: "The refund offered reflects the £150 actually paid — NOT £0", regression: true, needsBackend: true },
      { id: "d9s5", where: "Operator → Bookings", action: "Cancel a booking as the operator with a reason", expect: "Parent is notified, reason recorded" },
      { id: "d9s6", where: "Money → Invoices", action: "Raise an invoice and send it", expect: "Parent receives it and can pay it from the link" },
      { id: "d9s7", where: "Checkout", action: "Book using a payment plan if configured", expect: "Instalments listed with dates, first payment taken" },
      { id: "d9s8", where: "Money → Reconciliation", action: "Check refunds appear", expect: "Every refund from today is listed with the right amount" },
    ],
  },
  {
    day: 10, date: "2026-09-20", label: "Sun 20 Sept", portal: "operator",
    title: "Registers, collection & the safeguarding basics",
    intent: "The on-the-day product. Do this on a phone, standing up, as staff actually would.",
    steps: [
      { id: "d10s1", where: "Registers → today", action: "Open today's register on a phone", expect: "Every booked child listed, readable without zooming" },
      { id: "d10s2", where: "Registers", action: "Sign a child in", expect: "Marked Present with a time" },
      { id: "d10s3", where: "Registers", action: "Sign a child out and record who collected them", expect: "Marked Collected, and the collector's name is stored against the child" },
      { id: "d10s4", where: "Child record", action: "Set a collection password on a child, then open their card on the register", expect: "The password shows to staff on the card" },
      { id: "d10s5", where: "Child record", action: "Set allergies, medical and SEND notes", expect: "All three flag on the register row, not buried in a sub-page" },
      { id: "d10s6", where: "Child record", action: "Set walk-home consent on one child and not another", expect: "The difference is visible on the register" },
      { id: "d10s7", where: "Registers", action: "Mark a child absent", expect: "Recorded as Absent; the count updates" },
      { id: "d10s8", where: "Registers", action: "Run a roll call", expect: "Headcount matches signed-in children and the check is recorded" },
      { id: "d10s9", where: "Header → Find a child", action: "Search for a child by name", expect: "Found, and their card opens with the full record" },
    ],
  },
  {
    day: 11, date: "2026-09-21", label: "Mon 21 Sept", portal: "operator",
    title: "Ratios, groups & rooms",
    intent: "Ratio maths is a compliance claim. If it counts wrong, the claim is false.",
    steps: [
      { id: "d11s1", where: "Ratios & groups", action: "Set a required ratio for an age group", expect: "Saved and shown against today's session" },
      { id: "d11s2", where: "Ratios & groups", action: "Sign children in one at a time and watch the ratio", expect: "Recalculates live with each sign-in" },
      { id: "d11s3", where: "Ratios & groups", action: "Push past the ratio deliberately", expect: "Flags clearly — you cannot miss it" },
      { id: "d11s4", where: "Ratios & groups", action: "Add a staff member to the session", expect: "Ratio recovers" },
      { id: "d11s5", where: "Ratios & groups", action: "Create a group and assign children to it", expect: "Saved; the register can be viewed by group" },
      { id: "d11s6", where: "Ratios & groups", action: "Check the age band shown against each child", expect: "Matches their date of birth" },
    ],
  },
  {
    day: 12, date: "2026-09-22", label: "Tue 22 Sept", portal: "operator",
    title: "Medication & the consent gate",
    intent: "The strongest safety control in the product. Step 3 must be impossible.",
    steps: [
      { id: "d12s1", where: "Medication", action: "Add a medication for a child with dose, route, storage and expiry", expect: "Saved, awaiting parental consent" },
      { id: "d12s2", where: "Parent portal", action: "As the parent, authorise that medication", expect: "Consent recorded with your name and the date" },
      { id: "d12s3", where: "Medication", action: "Try to record a dose against a medication that has NO consent", expect: "REFUSED by the system — not a warning you can click past", regression: true },
      { id: "d12s4", where: "Medication", action: "Record a dose against the consented medication", expect: "Appears on the MAR with who gave it and when" },
      { id: "d12s5", where: "Parent portal", action: "Withdraw consent", expect: "Withdrawal is timestamped and further doses are refused" },
      { id: "d12s6", where: "Medication", action: "Set an expiry date in the past", expect: "Flagged as expired" },
      { id: "d12s7", where: "Registers", action: "Check the child's register row", expect: "Medication is visible to the staff running that session" },
    ],
  },
  {
    day: 13, date: "2026-09-23", label: "Wed 23 Sept", portal: "operator",
    title: "Concerns, accidents & incidents",
    intent: "Test this as if it were real. The DSL alert either fires or it doesn't.",
    steps: [
      { id: "d13s1", where: "Log a concern", action: "Log a safeguarding concern about a child", expect: "Saved, and your named DSL is alerted — check the DSL's email/notifications" },
      { id: "d13s2", where: "Log a concern", action: "Check the form shows YOUR categories and YOUR protocol", expect: "Your Day-2 wording, not defaults", regression: true },
      { id: "d13s3", where: "Concern record", action: "Record the DSL decision and the action taken", expect: "Stored on the same record as the concern" },
      { id: "d13s4", where: "Concern record", action: "Export the concern as a PDF", expect: "Contains your escalation numbers (LADO, social care, out-of-hours)" },
      { id: "d13s5", where: "First aid", action: "Log an accident for a child", expect: "Parent is emailed AND notified in-app" },
      { id: "d13s6", where: "Parent portal", action: "As the parent, acknowledge the accident", expect: "Acknowledgement recorded and visible to the operator" },
      { id: "d13s7", where: "Setup → Safeguarding", action: "Turn ON 'require acknowledgement', log another accident, then leave it", expect: "The parent is chased until they acknowledge" },
      { id: "d13s8", where: "Concerns list", action: "Check every record carries who logged it and when", expect: "Timestamped and attributed, every one" },
    ],
  },
  {
    day: 14, date: "2026-09-24", label: "Thu 24 Sept", portal: "operator",
    title: "Meals, allergens, trips & consent",
    intent: "Two places where a wrong answer harms a child. The trip consent gate must be absolute.",
    steps: [
      { id: "d14s1", where: "Meals", action: "Build a weekly menu from the saved library and drag it onto the days", expect: "Saves; parents can see it" },
      { id: "d14s2", where: "Parent portal → Meals", action: "Choose meals for a child with a nut allergy", expect: "Anything containing nuts is flagged BEFORE you pick it" },
      { id: "d14s3", where: "Meals", action: "Check the kitchen view for a day", expect: "Correct counts per dish and every allergy listed" },
      { id: "d14s4", where: "Trips & visits", action: "Create a trip with children attached", expect: "Saved; parents are asked for consent" },
      { id: "d14s5", where: "Trips & visits", action: "With one child's consent still missing, try to mark the trip ready", expect: "BLOCKED — the system refuses while any consent is outstanding", regression: true },
      { id: "d14s6", where: "Parent portal", action: "Give the outstanding consent", expect: "Trip can now be marked ready" },
      { id: "d14s7", where: "Trips & visits", action: "Set a ratio target below the number of children", expect: "The trip flags before departure" },
      { id: "d14s8", where: "Trips & visits", action: "Run a roll call on the trip", expect: "Recorded against the trip" },
    ],
  },
  {
    day: 15, date: "2026-09-25", label: "Fri 25 Sept", portal: "operator",
    title: "Staff invites, onboarding & the cleared-to-start gate",
    intent: "Safer recruitment. Step 5 is the one an inspector would ask about.",
    steps: [
      { id: "d15s1", where: "Team & invites", action: "Invite a staff member by email", expect: "They receive it; the link opens a signup tied to your account" },
      { id: "d15s2", where: "New tab", action: "Accept the invite and complete signup as that staff member", expect: "They land in the STAFF portal, not the operator one" },
      { id: "d15s3", where: "Team → Onboarding", action: "Fill their record: DBS, references, right to work, qualifications", expect: "Each saves with its own date" },
      { id: "d15s4", where: "Team → Onboarding", action: "Leave one required item blank", expect: "Record reads 'Start on hold', not 'Cleared to start'" },
      { id: "d15s5", where: "Staff schedule", action: "With compliance required ON, try to roster the not-yet-cleared person", expect: "BLOCKED", regression: true },
      { id: "d15s6", where: "Team → Onboarding", action: "Complete the missing item", expect: "Flips to 'Cleared to start' and rostering is allowed" },
      { id: "d15s7", where: "Compliance", action: "Set a certificate to expire in 10 days", expect: "Warns ahead of expiry" },
      { id: "d15s8", where: "Team", action: "Click Deactivate on an active staff member", expect: "You are told plainly that this does NOT yet revoke their sign-in", regression: true },
      { id: "d15s9", where: "Sign in as that 'deactivated' staff member", action: "Attempt to sign in", expect: "Note what actually happens — this is a known gap and Amir's to close", needsBackend: true },
    ],
  },
  {
    day: 16, date: "2026-09-26", label: "Sat 26 Sept", portal: "operator",
    title: "Rota, cover, clock in/out & timesheets",
    intent: "Hours become money, so the arithmetic has to survive scrutiny.",
    steps: [
      { id: "d16s1", where: "Staff schedule", action: "Build a week's rota across two staff", expect: "Saves and publishes" },
      { id: "d16s2", where: "Staff portal", action: "As staff, view your own schedule", expect: "You see only your own shifts" },
      { id: "d16s3", where: "Clock in/out", action: "Clock in, take a break, clock out", expect: "Hours calculated with the break deducted per your settings" },
      { id: "d16s4", where: "Clock in/out board", action: "Check the live who's-in view", expect: "In / off / on-break is accurate right now" },
      { id: "d16s5", where: "Leave & absence", action: "As staff, request leave", expect: "Operator sees it for approval" },
      { id: "d16s6", where: "Leave & absence", action: "Approve it as the operator", expect: "Shows on the rota as unavailable, and cover is flagged" },
      { id: "d16s7", where: "Timesheets", action: "Check the week's timesheet", expect: "Matches what was clocked, to the minute" },
      { id: "d16s8", where: "Clock in/out", action: "Clock in late deliberately with auto-deduct on", expect: "Deduction applied per the rule you set" },
    ],
  },
  {
    day: 17, date: "2026-09-27", label: "Sun 27 Sept", portal: "operator",
    title: "Documents, training & payroll",
    intent: "The evidence layer. Read receipts are the bit that proves 'they were told'.",
    steps: [
      { id: "d17s1", where: "Documents", action: "Publish a policy and assign it to a role", expect: "Staff in that role see it" },
      { id: "d17s2", where: "Staff portal", action: "As staff, read and confirm it", expect: "Your confirmation is recorded with a date" },
      { id: "d17s3", where: "Documents", action: "Publish version 2 of the same policy", expect: "Previous confirmations no longer count as current" },
      { id: "d17s4", where: "Documents → read receipts", action: "Check who has and hasn't confirmed", expect: "Accurate list" },
      { id: "d17s5", where: "Learning Centre", action: "Assign a course to a staff member", expect: "Appears in their My learning" },
      { id: "d17s6", where: "Staff portal", action: "Complete the course", expect: "Completion flows back to the operator's record" },
      { id: "d17s7", where: "Payroll", action: "Run a monthly pay run from the timesheets", expect: "Hours carry across; estimated PAYE/NI shown" },
      { id: "d17s8", where: "Payroll", action: "Generate a payslip", expect: "Branded, correct figures" },
    ],
  },
  {
    day: 18, date: "2026-09-28", label: "Mon 28 Sept", portal: "operator",
    title: "Money in, money out, purchasing & inventory",
    intent: "The ledger. Every number here should be traceable to something you did earlier in the month.",
    steps: [
      { id: "d18s1", where: "Money → Money in", action: "Check income against the bookings you made on Days 6–9", expect: "Totals reconcile — write down both figures" },
      { id: "d18s2", where: "Money → Money out", action: "Log an expense with a receipt upload", expect: "Saved with the file attached" },
      { id: "d18s3", where: "Money → Money out", action: "Set up a recurring expense", expect: "Recurs as configured" },
      { id: "d18s4", where: "Money → Purchasing", action: "Raise a purchase order", expect: "Generates a document with your business details" },
      { id: "d18s5", where: "Money", action: "Export a CSV", expect: "Opens in a spreadsheet; totals match the screen" },
      { id: "d18s6", where: "Inventory", action: "Run a stock check", expect: "Saves; low stock flags" },
      { id: "d18s7", where: "Money → Reconciliation", action: "Review the month", expect: "Unpaid balances are correct and clickable through to the booking" },
    ],
  },
  {
    day: 19, date: "2026-09-29", label: "Tue 29 Sept", portal: "operator",
    title: "Finance & analytics, subscription & billing",
    intent: "The numbers you'd quote to a bank. And your own bill.",
    steps: [
      { id: "d19s1", where: "Finance & analytics → Overview", action: "Check every figure against what you know you did", expect: "Nothing invented, nothing missing" },
      { id: "d19s2", where: "Finance → Revenue", action: "Change the period and the season filter", expect: "Figures move correctly with both" },
      { id: "d19s3", where: "Finance → Payouts", action: "Review payouts", expect: "Clearly labelled as estimates if Stripe isn't connected" },
      { id: "d19s4", where: "Finance → Debts", action: "Check who owes you", expect: "Matches the unpaid list from Day 18" },
      { id: "d19s5", where: "Finance → Customers & learners", action: "Review", expect: "Counts match your actual families" },
      { id: "d19s6", where: "Subscription", action: "Review your plan and what you're being charged", expect: "Band and price are correct for your staff count" },
      { id: "d19s7", where: "Subscription", action: "Switch to annual billing", expect: "The price shown is the ANNUAL figure, not the monthly one with /yr after it", regression: true },
      { id: "d19s8", where: "Dashboard", action: "Check the headline cards", expect: "Agree with the Finance pages" },
    ],
  },
  {
    day: 20, date: "2026-09-30", label: "Wed 30 Sept", portal: "operator",
    title: "Messages, email, newsfeed & moments",
    intent: "Everything that reaches a parent's phone. A wrong merge field is a public mistake.",
    steps: [
      { id: "d20s1", where: "Messages", action: "Message a family and have them reply from the parent portal", expect: "Both directions work; thread stays together" },
      { id: "d20s2", where: "Email → Audiences", action: "Build an audience (e.g. everyone booked on a listing)", expect: "Count matches the actual bookings" },
      { id: "d20s3", where: "Email", action: "Send a campaign using merge fields", expect: "Every field resolves — no {SessionDate} left raw in the delivered email" },
      { id: "d20s4", where: "Email → Templates", action: "Check booking-scoped merge fields are offered here", expect: "Offered in the message-family send, hidden in the general composer" },
      { id: "d20s5", where: "Newsfeed", action: "Post an announcement", expect: "Appears in the parent portal newsfeed" },
      { id: "d20s6", where: "Moments", action: "Upload photos to a session", expect: "Only parents of children in that session can see them" },
      { id: "d20s7", where: "Child record", action: "Turn photo consent OFF for one child, then upload again", expect: "That child is excluded, and staff are warned before uploading" },
      { id: "d20s8", where: "Parent portal", action: "Switch the app language to Polish, then Urdu", expect: "The interface translates; nothing falls back to raw keys" },
    ],
  },
  {
    day: 21, date: "2026-10-01", label: "Thu 1 Oct", portal: "parent",
    title: "The whole parent portal, as a parent",
    intent: "Spend the day being a customer. Every tab, on a phone, with no operator knowledge.",
    steps: [
      { id: "d21s1", where: "Parent portal", action: "Work through every sidebar item in turn", expect: "Nothing blank, nothing errors, nothing shows another family's data" },
      { id: "d21s2", where: "Parent → My child", action: "Update the medical details", expect: "Operator sees the change immediately on the register" },
      { id: "d21s3", where: "Parent → Wallet", action: "Check the balance and its history", expect: "Every credit and spend is explained" },
      { id: "d21s4", where: "Parent → Activity timetable", action: "Review", expect: "Matches what you actually booked" },
      { id: "d21s5", where: "Parent → AI assistant", action: "Ask 'when is my next session?' and 'what did I pay in September?'", expect: "Correct answers drawn from your real data" },
      { id: "d21s6", where: "Parent → account", action: "Open 'Close my account'", expect: "It correctly warns about any active membership", regression: true },
      { id: "d21s7", where: "Parent portal", action: "Add a second parent/carer to the same children", expect: "They see the same bookings and can book" },
      { id: "d21s8", where: "Parent portal on a phone", action: "Repeat the three things you do most", expect: "All comfortable one-handed" },
    ],
  },
  {
    day: 22, date: "2026-10-02", label: "Fri 2 Oct", portal: "franchise",
    title: "★ Franchise isolation — try to break in",
    intent: "Do not test that it works. Test that it CANNOT be broken. Every step here is an attempt to see someone else's data.",
    steps: [
      { id: "d22s1", where: "HQ", action: "Set up a head office with TWO franchises, each with its own children, staff and bookings", expect: "Both exist with separate data" },
      { id: "d22s2", where: "Franchise A → Find a child", action: "Search for a child who belongs to franchise B", expect: "NOT FOUND — franchise A must not see them", regression: true },
      { id: "d22s3", where: "Franchise A → Task manager", action: "Look for head office's tasks", expect: "Not visible, and not editable", regression: true },
      { id: "d22s4", where: "Franchise A → Reviews", action: "Look for reviews of franchise B's listings", expect: "Not visible; you cannot reply to them", regression: true },
      { id: "d22s5", where: "Franchise A → Team & invites", action: "Look at pending invites", expect: "Only your own — head office's franchise invites must NOT be listed", regression: true },
      { id: "d22s6", where: "Franchise A → Trips", action: "Look for franchise B's trips", expect: "Record what you see — this is a KNOWN open gap awaiting Amir", needsBackend: true },
      { id: "d22s7", where: "Franchise A → Compliance", action: "Look for franchise B's staff DBS records", expect: "Record what you see — KNOWN open gap awaiting Amir", needsBackend: true },
      { id: "d22s8", where: "Franchise A → Referrals", action: "Check whose referrals and customers are listed", expect: "Record what you see — KNOWN open gap awaiting Amir", needsBackend: true },
      { id: "d22s9", where: "Franchise A → Setup", action: "Change a setting, then check it actually takes effect for franchise A", expect: "Record the result — franchise settings are known to save to a doc nothing reads", needsBackend: true },
      { id: "d22s10", where: "HQ (combined view)", action: "Check head office sees BOTH franchises", expect: "Full network visibility for HO, correctly totalled" },
    ],
  },
  {
    day: 23, date: "2026-10-03", label: "Sat 3 Oct", portal: "operator",
    title: "Company multi-site & the schools/MAT scenario",
    intent: "The company shape, and the school shape you're now selling to.",
    steps: [
      { id: "d23s1", where: "Company portal → Locations", action: "Create three locations", expect: "All three usable when building a listing" },
      { id: "d23s2", where: "Locations → Staff tab", action: "Assign staff to specific sites", expect: "Only assigned staff are offered for that site's shifts" },
      { id: "d23s3", where: "Company dashboard", action: "Open it as a company with NO franchises", expect: "You get the operational dashboard — today's bookings and registers — NOT a franchisor screen", regression: true },
      { id: "d23s4", where: "Company", action: "Build a breakfast club, an after-school club and a holiday club", expect: "All three bookable; a parent can book across them in one basket" },
      { id: "d23s5", where: "Registers", action: "Run a breakfast register and an after-school register on the same day", expect: "Separate registers, separate ratios" },
      { id: "d23s6", where: "Company → Team", action: "Set up staff roles and permissions per site", expect: "A site lead sees their site only" },
      { id: "d23s7", where: "Money", action: "Compare income by site", expect: "Correctly split" },
    ],
  },
  {
    day: 24, date: "2026-10-04", label: "Sun 4 Oct", portal: "staff",
    title: "The whole staff portal + what staff must NOT see",
    intent: "Half of this day is a permissions test. Staff see operations, never money.",
    steps: [
      { id: "d24s1", where: "Staff portal", action: "Work through every sidebar item", expect: "Nothing blank, nothing errors" },
      { id: "d24s2", where: "Staff portal", action: "Look for anything showing revenue, payments or debts", expect: "NOTHING. If you can see money, that's a fail", regression: true },
      { id: "d24s3", where: "Staff portal → Compliance", action: "Check whether you can see colleagues' DBS certificate details", expect: "You should NOT see the whole team's certificates", regression: true },
      { id: "d24s4", where: "Staff portal", action: "Submit an expense", expect: "Operator receives it for approval" },
      { id: "d24s5", where: "Staff portal", action: "View announcements", expect: "Shows what the operator posted" },
      { id: "d24s6", where: "Staff portal", action: "Complete your own onboarding submission", expect: "Lands in the operator's onboarding record" },
      { id: "d24s7", where: "Staff portal", action: "Take a register for a session you're assigned to", expect: "Works; and you cannot open a session you're not on" },
      { id: "d24s8", where: "Staff portal on a phone", action: "Do a full session: clock in, take the register, log an incident, clock out", expect: "All four comfortable on a phone" },
    ],
  },
  {
    day: 25, date: "2026-10-05", label: "Mon 5 Oct", portal: "hq",
    title: "HQ, and the regression sweep",
    intent: "Finish with the owner's view, then re-run every single thing you failed across the 24 days.",
    steps: [
      { id: "d25s1", where: "HQ → Analytics", action: "Check the platform numbers", expect: "Match the accounts you actually created" },
      { id: "d25s2", where: "HQ → Providers & billing", action: "Review every provider and what they pay", expect: "Correct plan and price for each" },
      { id: "d25s3", where: "HQ → Sales pipeline", action: "Open it after submitting a 'Book a demo' form from the public site", expect: "The page LOADS — a real demo lead must not crash it", regression: true },
      { id: "d25s4", where: "HQ → Leads", action: "Check the demo form submission is there", expect: "Present with the details you typed" },
      { id: "d25s5", where: "HQ → Open an account (impersonation)", action: "Open a provider account, then exit back to HQ", expect: "The portal shows the RIGHT account throughout, and Exit returns you to HQ", regression: true },
      { id: "d25s6", where: "HQ → Support inbox", action: "Send a support message as a provider and check it arrives", expect: "Threaded, with the right provider name against it" },
      { id: "d25s7", where: "Testing → Failures", action: "Re-run EVERY step you failed on days 1–24", expect: "Each one now passes, or is explicitly still open with an owner" },
      { id: "d25s8", where: "Testing", action: "Export the final report", expect: "A complete list: what passed, what's still open, and who owns each open item" },
    ],
  },
];

export const TOTAL_STEPS = PLAN.reduce((n, d) => n + d.steps.length, 0);
