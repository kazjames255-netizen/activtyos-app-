/**
 * The 28-day acceptance test plan.
 *
 * Rewritten 8 Sept after five senior reviewers took the first version apart.
 * Their central criticism was correct and worth restating, because it shapes
 * everything below: the old plan tested whether a SCREEN rendered something.
 * That proves a sidebar link is hidden. It does not prove the data behind it
 * is unreachable — and for this product the data was, repeatedly, one request
 * away for exactly the accounts the test was meant to exclude.
 *
 * Three rules now govern every step:
 *
 *  1. A permission test that does not make an API call is not a permission
 *     test. Where access matters, the step includes the request to make.
 *  2. A step that cannot fail is worse than no step. Several old steps could
 *     not fail — "the parent was emailed" passes when mail is switched off and
 *     the send reports success; the i18n check looked for raw keys that the
 *     English fallback guarantees never appear. Those are rewritten.
 *  3. Follow one fact around the loop AND BACK: create in A, see it in B,
 *     CHANGE it in B, see the change in A, delete it, confirm it is gone from
 *     both. Anything less tests a screen, not a system.
 *
 * Day 1 = Fri 11 Sept 2026. Day 28 = Thu 8 Oct.
 * Days 1-7 need nothing from Amir. Day 8 is Tax-Free Childcare, his headline
 * deliverable, due 18 Sept.
 *
 * PREREQS below are not optional. Without them a large part of the run is
 * unfalsifiable: mail is off by default, Stripe has no key set, and there is
 * no deployed environment at all.
 */

export interface Step {
  /** Stable id — results are keyed on it. Never renumber a shipped step. */
  id: string;
  where: string;
  action: string;
  expect: string;
  /** Re-checks a bug already confirmed by the 8 Sept audit. */
  regression?: boolean;
  /** Cannot pass until Amir's backend work lands. Routes failures to him. */
  needsBackend?: boolean;
  /** Involves a request/console step rather than only clicking. */
  evidence?: boolean;
  /** An attempt to get at something you should NOT be able to reach. */
  attack?: boolean;
}

export interface Day {
  day: number;
  date: string;
  label: string;
  title: string;
  portal: "operator" | "parent" | "staff" | "franchise" | "hq" | "public" | "mixed";
  intent: string;
  steps: Step[];
}

export const PLAN_START = "2026-09-11";
export const AMIR_DUE = "2026-09-18";

/**
 * Do these BEFORE day 1. Each one exists because a reviewer showed that without
 * it, steps in the run report success while nothing happened.
 */
export const PREREQS: { id: string; title: string; why: string; who: string }[] = [
  {
    id: "p1", title: "Deploy to a real staging environment",
    why: "The old plan was 25 days of localhost followed by a cold go-live. Nothing about hosting, domains, HTTPS, environment variables, cold starts or real network latency would have been tested at all. Test where it will actually run.",
    who: "Amir",
  },
  {
    id: "p2", title: "Turn outbound mail ON and prove one arrives",
    why: "Mail is off by default and a skipped send deliberately reports success. Every 'the parent was emailed' / 'the DSL was alerted' step in this plan is unfalsifiable until a real message lands in a real inbox. Send one to yourself first.",
    who: "Amir",
  },
  {
    id: "p3", title: "Set Stripe test keys and confirm a card charge records server-side",
    why: "No key is set, so payments cannot run. Reviewers also found no Connect webhook — a payment may only be recorded if the parent's browser calls back, which means a closed laptop loses the payment. Establish which is true before Day 6.",
    who: "Amir",
  },
  {
    id: "p4", title: "Load one tenant with a realistic season",
    why: "~1,500 bookings, 250 families, 400 children, two years of payments. The dashboard reads four entire collections per load and the client gives up at 15 seconds. Ten bookings proves nothing about a provider in September.",
    who: "Amir",
  },
  {
    id: "p5", title: "Create the accounts: 2 unrelated providers, 1 head office + 2 franchises, 1 staff, 2 parents",
    why: "Tenant-vs-tenant is the boundary that separates two paying customers and it was never tested once. You cannot test isolation with one account.",
    who: "You",
  },
  {
    id: "p6", title: "Delete the 22 'E2E Signup …' fixture tenants",
    why: "They outnumber the real accounts and already polluted the public provider directory badly enough to need filtering by name.",
    who: "Amir",
  },
  {
    id: "p7", title: "Learn the token grab — you'll use it all month",
    why: "In the browser console on any signed-in tab:\nJSON.parse(Object.entries(localStorage).find(([k])=>k.startsWith('firebase:authUser'))[1]).stsTokenManager.accessToken\nCopy the result. That is that account's key to the API. Every security step below uses one.",
    who: "You",
  },
];

export const PLAN: Day[] = [
  {
    day: 1, date: "2026-09-11", label: "Fri 11 Sept", portal: "operator",
    title: "Sign up, onboarding & the environment itself",
    intent: "A brand-new provider from nothing to usable — on the deployed environment, not localhost. If this is wrong nothing after it matters.",
    steps: [
      { id: "d1s1", where: "The STAGING url (not localhost)", action: "Create a brand-new Freelancer account with an unused email", expect: "Account created over HTTPS, you land in the portal, no error banner" },
      { id: "d1s2", where: "Your email inbox", action: "Check for the welcome/verification email", expect: "It actually ARRIVED. If nothing lands, stop — prerequisite p2 has failed and dozens of later steps cannot be trusted", evidence: true },
      { id: "d1s3", where: "Onboarding wizard", action: "Complete every step; try to skip a required field", expect: "Saves each step, and refuses to continue past a blank required field" },
      { id: "d1s4", where: "Setup → provider name", action: "Switch between 'my name' and 'business name'", expect: "Propagates to the sidebar AND a customer-facing page" },
      { id: "d1s5", where: "Setup → branding", action: "Upload a logo and set a brand colour", expect: "Both appear in the portal and on customer pages" },
      { id: "d1s6", where: "Staging url", action: "Create the second, UNRELATED provider (Company plan). Note its tenant id from any URL", expect: "Separate account, separate data. You now have tenants A and B for the isolation work" },
      { id: "d1s7", where: "Browser console, tenant A", action: "Grab tenant A's token per prereq p7 and save it as $A. Do the same for B as $B", expect: "Two tokens. These are used repeatedly from Day 6 onward", evidence: true },
      { id: "d1s8", where: "Browser", action: "Deliberately visit a URL that does not exist, e.g. /company/nonsense", expect: "A proper not-found page — not a white screen and not a raw error" },
      { id: "d1s9", where: "Both accounts", action: "Sign out and back in", expect: "Right portal, setup intact" },
    ],
  },
  {
    day: 2, date: "2026-09-12", label: "Sat 12 Sept", portal: "operator",
    title: "Setup, roles & safeguarding configuration",
    intent: "Every switch should visibly change the product. A toggle that does nothing is a bug, and a permission that only hides a link is worse.",
    steps: [
      { id: "d2s1", where: "Setup → Setup & features", action: "Switch OFF three features, then back on", expect: "They vanish from the sidebar immediately and return" },
      { id: "d2s2", where: "Browser, with Meals switched OFF", action: "Type the Meals URL directly into the address bar", expect: "Refused. If the page loads, the toggle only hid a link", attack: true },
      { id: "d2s3", where: "Setup → Safeguarding", action: "Set DSL name, title and email", expect: "Saved, and the name shows on the Log-a-concern form" },
      { id: "d2s4", where: "Setup → Safeguarding", action: "Add a local authority with LADO, MASH and out-of-hours numbers", expect: "They appear on the concern form as click-to-call links" },
      { id: "d2s5", where: "Setup → Safeguarding", action: "Edit the categories and the 'what to do now' protocol", expect: "Your wording shows on the form, not the defaults" },
      { id: "d2s6", where: "Setup → Roles & permissions", action: "Set an area to None for a role, then sign in as that role", expect: "Unreachable by link AND by typing the URL", attack: true },
      { id: "d2s7", where: "Setup", action: "Try to save with the DSL name blank", expect: "Record what happens. Today it is optional — a setting can run with nobody named", regression: true },
      { id: "d2s8", where: "Setup → Seasons and Age groups", action: "Create one of each", expect: "Offered in the listing wizard and on Ratios" },
    ],
  },
  {
    day: 3, date: "2026-09-13", label: "Sun 13 Sept", portal: "operator",
    title: "Listings — including dates that cross the clock change",
    intent: "Build every shape, and deliberately build dates after 25 October, when the clocks go back. The run otherwise never leaves British Summer Time.",
    steps: [
      { id: "d3s1", where: "Blocks & listings → new", action: "Build a HOLIDAY CAMP, multi-day, ages 5–12, capacity 30", expect: "Customer page shows dates, ages, price, places left" },
      { id: "d3s2", where: "Blocks & listings → new", action: "Build a WEEKLY CLASS, Tuesdays for 6 weeks", expect: "All six dates generate correctly" },
      { id: "d3s3", where: "Blocks & listings → new", action: "Build a BLOCK of 6 sold as one purchase, and a ONE-OFF trip at another venue", expect: "Both correct on the customer page" },
      { id: "d3s4", where: "Blocks & listings → new", action: "Build a camp for Mon 26 – Fri 30 Oct 2026, 09:00–15:30 — AFTER the clocks change", expect: "All five dates and both times correct. 'Today' is computed in UTC in ~40 server files; this is where that shows" },
      { id: "d3s5", where: "Listing wizard", action: "Set a capacity of 2 and a booking cut-off", expect: "Saved — both are attacked on Day 6. Write down the listing name" },
      { id: "d3s6", where: "Listing wizard → Staff step", action: "Look at the staff list offered", expect: "Record whether fabricated demo staff (Marcus Bell, Jess Patel…) appear. They are seeded per-browser and can reach a customer page", regression: true },
      { id: "d3s7", where: "Listing wizard → questions", action: "Add a required custom question", expect: "Asked at checkout, answer lands on the booking" },
      { id: "d3s8", where: "Customer page, signed out", action: "Check every listing you just built", expect: "All visible, correct prices, no draft leaking out" },
    ],
  },
  {
    day: 4, date: "2026-09-14", label: "Mon 14 Sept", portal: "operator",
    title: "Capacity, waitlists, discounts, memberships",
    intent: "The commercial rules. Wrong here means you oversell or undercharge, every day, quietly.",
    steps: [
      { id: "d4s1", where: "Marketing → Discount codes", action: "Create a 20% code, a £10 exclusive code, and a one-use-per-customer code", expect: "All three save with their restrictions" },
      { id: "d4s2", where: "Listing wizard → discounts", action: "Set sibling and early-bird discounts", expect: "Shown on the customer page as available savings" },
      { id: "d4s3", where: "Setup → Memberships", action: "Create free, credit-based and percentage tiers", expect: "All three offered to parents" },
      { id: "d4s4", where: "Setup → Memberships", action: "Check whether joining is capped or charged", expect: "Record it. Reviewers found join/cancel/join can mint unlimited credit — if there is no cap, that is a finding today, not on Day 7", regression: true, needsBackend: true },
      { id: "d4s5", where: "Marketing → Referrals", action: "Configure the referral reward", expect: "Saves" },
      { id: "d4s6", where: "Setup → cancellation policy", action: "Set 100% over 14 days, 50% inside 14 days", expect: "Saved and shown to parents before they pay" },
      { id: "d4s7", where: "Money → Invoices", action: "Check what happens to a booking when its invoice is paid", expect: "Note the intended answer now. Reviewers found paying an invoice does not settle the booking — so a family can pay twice", needsBackend: true },
    ],
  },
  {
    day: 5, date: "2026-09-15", label: "Tue 15 Sept", portal: "public",
    title: "The public surface — and what a stranger can take from it",
    intent: "Everything reachable with no account at all. This is the part of the product the whole internet can touch.",
    steps: [
      { id: "d5s1", where: "Customer booking page, signed out, on a phone", action: "Browse and filter", expect: "Readable, no horizontal scroll, filters work" },
      { id: "d5s2", where: "/v2/parents.html, schools.html, safeguarding.html", action: "Read each, click every footer link", expect: "No 404s, no placeholder text, no wrong nav tab highlighted" },
      { id: "d5s3", where: "/parent → Create an account", action: "Type two letters of your provider's name", expect: "Found. And check what shows beneath it — a town or postcode, never a street address", regression: true },
      { id: "d5s4", where: "Terminal, no account", action: "curl 'https://STAGING-API/api/providers?q=a' — then try q=b, q=c", expect: "Record how much of your customer list a stranger can enumerate, and whether tenant ids come back with it", evidence: true, attack: true },
      { id: "d5s5", where: "Terminal, no account", action: "Hit the same endpoint 200 times in a loop", expect: "You get rate-limited or blocked. If all 200 succeed, there is no rate limiting on any public endpoint", evidence: true, attack: true },
      { id: "d5s6", where: "Browser, no account", action: "Open /docs (the API documentation) on staging", expect: "Decide whether the whole API surface should be readable by anyone. Record the answer", attack: true },
      { id: "d5s7", where: "Browser, no account", action: "Open an image URL from a listing (right-click → copy image address), in a private window", expect: "Record whether it loads. Images are served unauthenticated and never expire — including, later, photos of children", attack: true },
      { id: "d5s8", where: "Public site", action: "Submit the 'Book a demo' form", expect: "Arrives in HQ → Leads. Keep this — Day 28 uses it" },
    ],
  },
  {
    day: 6, date: "2026-09-16", label: "Wed 16 Sept", portal: "mixed",
    title: "Booking by card — and proving the money was recorded",
    intent: "The most important flow in the product, tested in both directions and verified server-side rather than on screen.",
    steps: [
      { id: "d6s1", where: "Customer page as parent 1", action: "Add a child and book one session, paying by card", expect: "Confirmed, receipt shown, card charged what was quoted" },
      { id: "d6s2", where: "Checkout", action: "Compare the basket total with the amount actually charged", expect: "Identical to the penny", regression: true },
      { id: "d6s3", where: "Checkout", action: "Add an add-on and a meal, then apply the 20% code", expect: "Discount applies to the SESSION price only and the quoted total is what you pay", regression: true },
      { id: "d6s4", where: "Checkout", action: "Pay, then CLOSE THE TAB immediately as the payment confirms", expect: "Reopen: the booking is still Paid. If it isn't, the payment is only recorded when the browser calls back", evidence: true, needsBackend: true },
      { id: "d6s5", where: "Operator → Bookings, Dashboard, Registers, Families", action: "Find the booking in all four", expect: "Present in every one, right child, right amount, dashboard totals moved by exactly that much" },
      { id: "d6s6", where: "Operator → Bookings", action: "Now create a booking FROM the operator side for the same family", expect: "Appears in the parent's My bookings — the reverse direction is never usually tested" },
      { id: "d6s7", where: "Two browsers at once", action: "With 1 place left, have two parents check out simultaneously", expect: "One succeeds, one is refused. Not two bookings on one seat", attack: true },
      { id: "d6s8", where: "Operator → listing", action: "Now EDIT that listing: remove one date it already has bookings on", expect: "Record exactly what happens to those bookings and that day's register. Reviewers say the register is silently deleted" },
      { id: "d6s9", where: "Terminal, tenant A's token $A", action: "curl -H \"Authorization: Bearer $A\" 'API/api/bookings/<B_REF>?tenantId=<B_TENANT>'", expect: "404. A 200 means one provider just read another's booking by passing a tenant id in the query string", evidence: true, attack: true },
    ],
  },
  {
    day: 7, date: "2026-09-17", label: "Thu 17 Sept", portal: "parent",
    title: "Wallet, memberships, codes — and the abuse cases",
    intent: "Everything that reduces what a parent pays. Each one is a way to take money out of the provider if it's wrong.",
    steps: [
      { id: "d7s1", where: "Parent → Memberships", action: "Join the credit tier", expect: "Credit lands in the wallet" },
      { id: "d7s2", where: "Parent → Memberships", action: "Cancel it, then join again. Repeat three times", expect: "You do NOT accumulate credit each time. If you do, membership credit can be minted at will", attack: true, needsBackend: true },
      { id: "d7s3", where: "Terminal, parent 1's token $P", action: "curl -X POST -H \"Authorization: Bearer $P\" -H 'Content-Type: application/json' -d '{\"tenantId\":\"<TENANT_B>\",\"tierId\":\"<any>\"}' API/api/my/memberships/join", expect: "Refused. Parent 1 has never booked with tenant B. (Fixed 8 Sept — this step proves it stayed fixed)", regression: true, evidence: true, attack: true },
      { id: "d7s4", where: "Parent → checkout", action: "Book using wallet credit", expect: "Credit deducted, remainder charged" },
      { id: "d7s5", where: "Parent → My bookings", action: "Cancel that wallet-paid booking", expect: "The credit comes BACK. Reviewers found cancelling a wallet-paid booking destroys it", regression: true, needsBackend: true },
      { id: "d7s6", where: "Parent → checkout", action: "Try to use the one-use code a second time, and the exclusive code alongside another", expect: "Both refused with a clear message" },
      { id: "d7s7", where: "Operator → Setup → Customer area", action: "Switch a customer-area feature OFF, then check the parent portal", expect: "Gone for the parent. Then type its URL directly — still refused", attack: true },
      { id: "d7s8", where: "Parent → Refer a friend", action: "Use your own referral link on your own account", expect: "Refused" },
    ],
  },
  {
    day: 8, date: "2026-09-18", label: "Fri 18 Sept", portal: "mixed",
    title: "★ Tax-Free Childcare — Amir's deliverable, due today",
    intent: "Reviewers warn the product may not yet HAVE a TFC checkout. Step 1 establishes that before anything else. If it isn't there, this day becomes the spec review with Amir.",
    steps: [
      { id: "d8s1", where: "Parent → checkout", action: "Look for Tax-Free Childcare as a payment method", expect: "It exists and is selectable. If not, stop and work through steps 2–10 with Amir as a specification instead", needsBackend: true },
      { id: "d8s2", where: "Checkout", action: "Choose TFC and read what you are given", expect: "The provider's account details AND a reference. Check the reference is unique per child and per booking — not free text you type yourself", needsBackend: true },
      { id: "d8s3", where: "Operator → Bookings", action: "Find the booking", expect: "Awaiting payment, reference visible" },
      { id: "d8s4", where: "With Amir", action: "Send an inbound payment carrying that exact reference", expect: "Booking flips to Paid, balance £0, with nobody matching it by hand", needsBackend: true },
      { id: "d8s5", where: "With Amir", action: "Send the SAME payment twice", expect: "It does not pay the booking twice or create a credit. Webhook retries are normal, not exotic", needsBackend: true, attack: true },
      { id: "d8s6", where: "With Amir", action: "Send a payment with a wrong reference", expect: "It does NOT auto-match, and it surfaces somewhere an operator can resolve it. It must never vanish", needsBackend: true },
      { id: "d8s7", where: "With Amir", action: "Send a payment for a booking that has already been cancelled", expect: "Handled deliberately — refund path or held for review, not silently absorbed", needsBackend: true },
      { id: "d8s8", where: "With Amir", action: "Send an OVERpayment, and separately a part payment", expect: "Over: surplus handled explicitly. Part: correct balance remaining, not £0 and not Paid", needsBackend: true },
      { id: "d8s9", where: "With Amir", action: "Send a payment BEFORE the booking exists", expect: "Held and matched when the booking appears, or clearly queued. Not lost", needsBackend: true },
      { id: "d8s10", where: "Checkout", action: "Pay part by TFC and the rest by card", expect: "Both recorded, totals reconcile" },
      { id: "d8s11", where: "Operator → Reconciliation", action: "Review the TFC view", expect: "Sent, matched and outstanding are all visible and correct" },
    ],
  },
  {
    day: 9, date: "2026-09-19", label: "Sat 19 Sept", portal: "operator",
    title: "Refunds, cancellations and money going backwards",
    intent: "Money out is where silent failure costs you twice — once in cash and once in trust.",
    steps: [
      { id: "d9s1", where: "Parent", action: "Cancel a fully-paid booking with 3 weeks' notice, then another with 3 days'", expect: "100% and 50% respectively, per your policy" },
      { id: "d9s2", where: "Operator → Bookings", action: "Record a £150 part payment on a £200 booking, then have the parent cancel with 3 weeks' notice", expect: "Refund reflects the £150 paid — NOT £0", regression: true, needsBackend: true },
      { id: "d9s3", where: "Stripe dashboard", action: "After approving a card refund, check Stripe itself", expect: "The refund is really there. Reviewers found refunds are fire-and-forget — a Stripe failure reaches only the server console", evidence: true, needsBackend: true },
      { id: "d9s4", where: "Operator", action: "Approve a refund on a booking paid by TFC/voucher", expect: "It does NOT tell the parent the money is going back to their card, and the money actually moves somewhere real", regression: true, needsBackend: true },
      { id: "d9s5", where: "Money → Invoices", action: "Raise an invoice for an existing booking and pay it from the link", expect: "The BOOKING is settled too. If not, the family can pay the same money twice and Money-in counts it twice", regression: true, needsBackend: true },
      { id: "d9s6", where: "Operator", action: "Cancel a booking that has meals, a trip consent and a register mark against it", expect: "All of them are cleaned up. Reviewers found the seat is released and everything else left dangling" },
      { id: "d9s7", where: "Money → Reconciliation", action: "Total today's refunds against the bookings list", expect: "They agree" },
    ],
  },
  {
    day: 10, date: "2026-09-20", label: "Sun 20 Sept", portal: "operator",
    title: "Registers and collection — on a phone, as staff",
    intent: "The on-the-day product. Do it standing up, on a phone, and try to break it the way a real session does.",
    steps: [
      { id: "d10s1", where: "Registers → today, on a phone", action: "Sign children in and out, recording who collected", expect: "Marked with times; the collector's name is stored" },
      { id: "d10s2", where: "Child record", action: "Set a collection password, allergies, medical, SEND and walk-home consent", expect: "All flag on the register row, not buried a level down" },
      { id: "d10s3", where: "Registers", action: "Book two SIBLINGS on ONE booking, then open the register", expect: "BOTH children appear and the headcount counts two. Reviewers found one booking counts as one child wherever ratios and registers matter", regression: true },
      { id: "d10s4", where: "Registers", action: "Cancel a booking while that child is signed IN", expect: "Record what happens. Reviewers found the child vanishes from the register and can never be marked out" },
      { id: "d10s5", where: "Two phones at once", action: "Sign different children in on each, then refresh both", expect: "Both phones show both children and the same headcount" },
      { id: "d10s6", where: "A phone", action: "Turn on flight mode mid-register, mark a child, then reconnect", expect: "Record exactly what survives. This is the one screen that must work in a hall with no signal" },
      { id: "d10s7", where: "A phone", action: "Clear browser data mid-session and reopen the register", expect: "Nothing recorded during the session has been lost" },
      { id: "d10s8", where: "Terminal, staff token $S", action: "curl -H \"Authorization: Bearer $S\" API/api/children/<childId>", expect: "Decide FIRST whether a session coach should read any child's medical, SEND, collection password and emergency contacts. Then see what happens", evidence: true, attack: true },
      { id: "d10s9", where: "Registers", action: "Run a roll call", expect: "Matches the signed-in children and is recorded" },
      { id: "d10s10", where: "Parent portal", action: "Check the parent's view of attendance", expect: "They can see their child was marked present" },
    ],
  },
  {
    day: 11, date: "2026-09-21", label: "Mon 21 Sept", portal: "operator",
    title: "Ratios and groups",
    intent: "A ratio is a compliance claim. If the count is wrong the claim is false, and the sibling case above means it may be.",
    steps: [
      { id: "d11s1", where: "Ratios & groups", action: "Set a ratio, then sign children in one at a time", expect: "Recalculates live and flags unmissably when breached" },
      { id: "d11s2", where: "Ratios & groups", action: "Sign in the two siblings on one booking", expect: "Counts as TWO children against the ratio", regression: true },
      { id: "d11s3", where: "Ratios & groups", action: "Add a staff member to the session", expect: "Ratio recovers" },
      { id: "d11s4", where: "Ratios & groups", action: "Create a group and assign children", expect: "Register can be viewed by group" },
      { id: "d11s5", where: "Ratios & groups", action: "Check the age band against each child's date of birth", expect: "Correct, including a child whose birthday falls mid-camp" },
      { id: "d11s6", where: "Any operator page, between 00:15 and 00:59 UK", action: "Open Dashboard and Ratios", expect: "Today's figures are TODAY's. During BST the server's UTC 'today' is still yesterday until 01:00", evidence: true },
    ],
  },
  {
    day: 12, date: "2026-09-22", label: "Tue 22 Sept", portal: "mixed",
    title: "Medication and the consent gate",
    intent: "The strongest safety claim in the product, and one we now make publicly. Prove it is enforced by the server, not the screen.",
    steps: [
      { id: "d12s1", where: "Medication", action: "Add a medication with dose, route, storage and expiry", expect: "Saved, awaiting consent" },
      { id: "d12s2", where: "Parent portal", action: "Authorise it", expect: "Consent recorded with the parent's name and date" },
      { id: "d12s3", where: "Medication", action: "Try to record a dose against an UNCONSENTED medication", expect: "Refused" },
      { id: "d12s4", where: "Terminal, operator token", action: "Try the same thing by API, bypassing the screen entirely", expect: "Still refused. This is the step that proves the control is real", evidence: true, attack: true },
      { id: "d12s5", where: "Parent portal", action: "Withdraw consent", expect: "Timestamped, and further doses refused" },
      { id: "d12s6", where: "Operator → Medication", action: "As the PROVIDER, try to re-grant the consent the parent just withdrew", expect: "Record what happens. Reviewers found a provider can reverse a parent's withdrawal with nothing recording that it happened", regression: true },
      { id: "d12s7", where: "Operator → Medication", action: "Check who is shown as having consented", expect: "The parent, by name and date — not just a tick" },
      { id: "d12s8", where: "Parent portal set to Urdu", action: "Open the medication authorisation and read the consent wording", expect: "In Urdu. A parent consenting to medication in a language they cannot read is the worst version of this feature failing" },
      { id: "d12s9", where: "Registers", action: "Check the child's row", expect: "Medication visible to the staff running that session" },
    ],
  },
  {
    day: 13, date: "2026-09-23", label: "Wed 23 Sept", portal: "mixed",
    title: "Concerns, accidents and who can read them",
    intent: "Test as if it were real. Then test who else can read it, because a safeguarding concern names a child and sometimes a colleague.",
    steps: [
      { id: "d13s1", where: "Log a concern", action: "Log one about a child", expect: "Saved; your named DSL alerted" },
      { id: "d13s2", where: "The DSL's actual inbox and the in-app bell", action: "Check both", expect: "The alert ARRIVED. An alert nobody receives is not an alert", evidence: true },
      { id: "d13s3", where: "Log a concern", action: "Check the form shows YOUR categories and protocol", expect: "Your Day-2 wording", regression: true },
      { id: "d13s4", where: "Terminal, staff token $S", action: "curl -H \"Authorization: Bearer $S\" API/api/incidents", expect: "Record what comes back. Reviewers found any staff account can read every concern in the tenant — including allegations about a colleague", evidence: true, attack: true },
      { id: "d13s5", where: "Concern record", action: "Record the DSL decision and action taken, then export the PDF", expect: "Both on the same record; PDF carries your real escalation numbers" },
      { id: "d13s6", where: "First aid", action: "Log an accident with a photo of the injury", expect: "Parent emailed and notified" },
      { id: "d13s7", where: "Private window, no account", action: "Open that injury photo's URL directly", expect: "Record the result. Reviewers found every photo, including injury photos on accident records, is served on a public unauthenticated URL", evidence: true, attack: true },
      { id: "d13s8", where: "Parent portal", action: "Acknowledge the accident", expect: "Visible to the operator" },
      { id: "d13s9", where: "Setup → Safeguarding", action: "Turn parent notification OFF for incidents, log one", expect: "Parent NOT notified — the setting is respected in both directions" },
    ],
  },
  {
    day: 14, date: "2026-09-24", label: "Thu 24 Sept", portal: "mixed",
    title: "Meals, allergens, trips and consent",
    intent: "Two places where a wrong answer harms a child. The trip gate must hold against a decline, not only against silence.",
    steps: [
      { id: "d14s1", where: "Meals", action: "Build a weekly menu and publish it", expect: "Parents can see it" },
      { id: "d14s2", where: "Parent → Meals", action: "Choose meals for a child with a nut allergy", expect: "Anything containing nuts is flagged BEFORE you pick it" },
      { id: "d14s3", where: "Meals → kitchen view", action: "Check a day", expect: "Correct counts and every allergy listed" },
      { id: "d14s4", where: "Trips", action: "Create a trip; leave one consent OUTSTANDING and try to mark it ready", expect: "Blocked", regression: true },
      { id: "d14s5", where: "Parent portal", action: "Now have that parent explicitly DECLINE consent, and try again", expect: "Still blocked, and the child is not on the trip. Reviewers found the gate only tests for 'pending', so a decline may pass", regression: true },
      { id: "d14s6", where: "Trips", action: "Look for a per-trip switch that turns the consent requirement off", expect: "Record whether one exists. A safety gate that is switchable per trip is not a gate" },
      { id: "d14s7", where: "Trips", action: "As a non-manager, try to create a trip", expect: "Refused if 'who can plan' is restricted — check by URL too", attack: true },
      { id: "d14s8", where: "Operator → child", action: "RENAME a child who is on a trip, has meals booked and has a medication", expect: "All three still point at the right child. Reviewers found children are resolved by NAME in these areas", regression: true },
      { id: "d14s9", where: "Trips", action: "Run a roll call on the trip", expect: "Recorded against the trip" },
    ],
  },
  {
    day: 15, date: "2026-09-25", label: "Fri 25 Sept", portal: "operator",
    title: "Staff invites, safer recruitment — and invite abuse",
    intent: "Safer recruitment is the claim an inspector tests. An invite link that anyone can redeem undoes all of it.",
    steps: [
      { id: "d15s1", where: "Team & invites", action: "Invite a staff member by email", expect: "It arrives; the link opens a signup tied to your account" },
      { id: "d15s2", where: "A DIFFERENT email account", action: "Take that same invite link and redeem it from an address it was NOT sent to", expect: "Refused. Reviewers found invites are not bound to the address they were sent to — a forwarded link is an account", regression: true, attack: true },
      { id: "d15s3", where: "The original link", action: "Try to redeem it a second time", expect: "Refused — one invite, one account", attack: true },
      { id: "d15s4", where: "Team → Onboarding", action: "Fill DBS, references, right to work, qualifications; leave one blank", expect: "Reads Start on hold, not Cleared to start" },
      { id: "d15s5", where: "Staff schedule", action: "With compliance required ON, try to roster the uncleared person", expect: "Blocked", regression: true },
      { id: "d15s6", where: "Setup", action: "Turn require-compliance OFF and retry", expect: "Now allowed — proving the block came from the setting" },
      { id: "d15s7", where: "A SECOND browser", action: "Open Team & invites and the onboarding record there", expect: "The same records appear. Reviewers found the SCR and onboarding are browser localStorage — one laptop, one set of evidence", regression: true, needsBackend: true },
      { id: "d15s8", where: "Team", action: "Deactivate a staff member", expect: "You are told plainly it does not revoke sign-in", regression: true },
      { id: "d15s9", where: "That staff member's browser", action: "Refresh and keep using the portal; then use their token: curl -H \"Authorization: Bearer $S\" API/api/children/lookup", expect: "Both should fail. Both will work — there is no disabled-account concept at all", evidence: true, attack: true, needsBackend: true },
      { id: "d15s10", where: "Operator → Team, and HQ → Providers", action: "After the invite is accepted, check both", expect: "Activated in the team list AND the platform's staff count moved" },
    ],
  },
  {
    day: 16, date: "2026-09-26", label: "Sat 26 Sept", portal: "mixed",
    title: "Rota, clocking, timesheets, leave",
    intent: "Hours become money. Follow one shift from rota to payslip.",
    steps: [
      { id: "d16s1", where: "Staff schedule", action: "Build a week's rota across two staff and publish", expect: "Saved and published" },
      { id: "d16s2", where: "Staff portal", action: "Check the staff member's own schedule", expect: "Their shifts only — not the whole rota" },
      { id: "d16s3", where: "Clock in/out", action: "Clock in, break, clock out", expect: "Hours correct with the break rule applied" },
      { id: "d16s4", where: "Operator → Timesheets", action: "Check the same shift", expect: "Appears without anyone re-entering it" },
      { id: "d16s5", where: "Leave & absence", action: "Request leave as staff; approve as operator", expect: "Rota shows unavailable and flags cover" },
      { id: "d16s6", where: "Staff schedule", action: "Remove a staff member from the team MID-ROTA", expect: "Their shifts are handled deliberately — not left assigned to nobody" },
      { id: "d16s7", where: "Clock in/out", action: "Record a shift spanning 01:00–02:00 on 25 Oct (clocks go back)", expect: "Timesheet and payroll pay the hours actually worked" },
      { id: "d16s8", where: "Live who's-in board", action: "Check it against who is actually clocked in", expect: "Accurate right now" },
    ],
  },
  {
    day: 17, date: "2026-09-27", label: "Sun 27 Sept", portal: "mixed",
    title: "Documents, read receipts, training, payroll",
    intent: "The evidence layer. Reviewers say most of it lives in your browser — prove it or record it as a finding.",
    steps: [
      { id: "d17s1", where: "Documents", action: "Publish a policy, assign it to a role", expect: "Staff in that role see it" },
      { id: "d17s2", where: "Staff portal", action: "Read and confirm it", expect: "Confirmation recorded with a date" },
      { id: "d17s3", where: "A SECOND browser, as the operator", action: "Open Documents and the read receipts", expect: "The policy AND the confirmation are both there. If not, your compliance evidence exists on one laptop only", regression: true, needsBackend: true },
      { id: "d17s4", where: "Documents", action: "Publish version 2", expect: "Previous confirmations no longer count as current" },
      { id: "d17s5", where: "Learning Centre", action: "Assign a course; complete it as staff", expect: "Completion flows back to the operator record" },
      { id: "d17s6", where: "Payroll", action: "Run a pay run from Day 16's timesheets and generate a payslip", expect: "Hours carry across; figures correct" },
      { id: "d17s7", where: "Payroll", action: "Check the pay run against a staff member who took leave and one who clocked overtime", expect: "Both correct" },
    ],
  },
  {
    day: 18, date: "2026-09-28", label: "Mon 28 Sept", portal: "operator",
    title: "Money in/out, purchasing, inventory — at real volume",
    intent: "Switch to the tenant loaded with a realistic season (prereq p4). Ten bookings prove nothing.",
    steps: [
      { id: "d18s1", where: "The volume tenant → Dashboard", action: "Time how long until it is usable, on a laptop and on a phone on mobile data", expect: "Under five seconds. The client aborts at fifteen", evidence: true },
      { id: "d18s2", where: "The volume tenant", action: "Time Bookings (scroll to the oldest), Families, Money in, Finance, Registers, Messages", expect: "Every one under five seconds — write the numbers down", evidence: true },
      { id: "d18s3", where: "The volume tenant", action: "Have three people open the app at once", expect: "Still usable for all three" },
      { id: "d18s4", where: "Money → Money in", action: "Reconcile income against the bookings you made on Days 6–9", expect: "Totals agree — write both figures down" },
      { id: "d18s5", where: "Money → Money out", action: "Log an expense with a receipt, and set a recurring one", expect: "Saved with the file; recurs as configured" },
      { id: "d18s6", where: "Money", action: "Export a CSV", expect: "Opens in a spreadsheet; totals match the screen" },
      { id: "d18s7", where: "Inventory", action: "Run a stock check", expect: "Saves; low stock flags" },
      { id: "d18s8", where: "With Amir", action: "Ask for the Firestore read count of one dashboard load on the volume tenant", expect: "A number, and what it costs at 100 providers loading it 20 times a day", needsBackend: true },
    ],
  },
  {
    day: 19, date: "2026-09-29", label: "Tue 29 Sept", portal: "operator",
    title: "Finance, subscription and the billing wall",
    intent: "Your own revenue, and what happens to a provider when their card fails.",
    steps: [
      { id: "d19s1", where: "Finance & analytics", action: "Check Overview, Revenue, Payouts, Debts against what you know you did", expect: "Nothing invented, nothing missing; payouts labelled as estimates if Stripe isn't connected" },
      { id: "d19s2", where: "Finance", action: "Change period and season filters", expect: "Figures move correctly with both" },
      { id: "d19s3", where: "Subscription", action: "Switch to annual billing", expect: "The ANNUAL price is shown — not the monthly figure with /yr after it", regression: true },
      { id: "d19s4", where: "With Amir", action: "Force a subscription into past_due, then use the portal", expect: "Record exactly what the OWNER loses access to. Reviewers found a failed renewal can lock the owner out of registers and medication while staff and parents carry on", regression: true, needsBackend: true },
      { id: "d19s5", where: "Terminal, that owner's token", action: "Call an API route while past_due", expect: "The wall is enforced server-side too, not only in the UI", evidence: true, needsBackend: true },
      { id: "d19s6", where: "Subscription", action: "Add staff until you cross a plan band", expect: "Price band updates and matches Day 15's headcount" },
      { id: "d19s7", where: "Dashboard", action: "Compare headline cards with the Finance pages", expect: "They agree" },
    ],
  },
  {
    day: 20, date: "2026-09-30", label: "Wed 30 Sept", portal: "mixed",
    title: "Comms, email, photos — and what a parent can inject",
    intent: "Everything that reaches a phone or an inbox. Including what happens when a parent types something hostile.",
    steps: [
      { id: "d20s1", where: "Messages", action: "Message a family; have them reply", expect: "Both directions, one thread" },
      { id: "d20s2", where: "Email → Audiences", action: "Build an audience and check the count", expect: "Matches the actual bookings" },
      { id: "d20s3", where: "Email", action: "Send a campaign with merge fields, to a REAL inbox", expect: "It arrives and every field resolves — no raw {SessionDate}", evidence: true },
      { id: "d20s4", where: "Parent portal", action: "Name a child with HTML in it, e.g. Ben <b>test</b> <a href=\"http://x\">click</a>, then trigger an email that includes the child's name", expect: "The email shows the text literally. Reviewers found parent typing lands unescaped in the provider's outbound email", regression: true, attack: true },
      { id: "d20s5", where: "An email footer", action: "Look at the unsubscribe link and decode it", expect: "Record whether it is a signed token or just base64 of tenantId:email. If unsigned, anyone can suppress any address", evidence: true, attack: true },
      { id: "d20s6", where: "Moments", action: "Upload photos to a session", expect: "Only parents of children in that session can see them" },
      { id: "d20s7", where: "Private window, no account", action: "Open one of those photo URLs directly", expect: "Record the result. Every image is served unauthenticated and never expires", evidence: true, attack: true },
      { id: "d20s8", where: "Child record", action: "Turn photo consent OFF, then upload again", expect: "That child excluded; staff warned first" },
      { id: "d20s9", where: "Moments", action: "Withdraw photo consent for a child whose photos are ALREADY published", expect: "Record whether existing photos are removed. Withdrawal that is not retroactive is not withdrawal", regression: true },
      { id: "d20s10", where: "Parent portal in Urdu", action: "Open Medication, Accidents and Messages — not the dashboard", expect: "Record every screen still in English. Those catalogues are empty stubs, and the English fallback means the old 'no raw keys' check could never catch it", regression: true },
      { id: "d20s11", where: "Parent portal", action: "Switch to Bengali, Panjabi, Welsh and Portuguese", expect: "Record how much is still English — these have no base catalogue" },
      { id: "d20s12", where: "Parent portal in Arabic", action: "Check the sidebar, buttons, dates and forms", expect: "Nothing overlaps or runs off screen when the layout flips right-to-left" },
    ],
  },
  {
    day: 21, date: "2026-10-01", label: "Thu 1 Oct", portal: "parent",
    title: "The parent portal, plus data rights",
    intent: "Be a customer all day. Then exercise the rights a parent legally has.",
    steps: [
      { id: "d21s1", where: "Parent portal", action: "Work through every sidebar item on a phone", expect: "Nothing blank, nothing errors, no other family's data" },
      { id: "d21s2", where: "Parent → My child", action: "Update a medical detail", expect: "Identical on the register AND the family record" },
      { id: "d21s3", where: "Parent → My child", action: "Upload a SEND/EHCP document", expect: "Saved" },
      { id: "d21s4", where: "Terminal, tenant B's token $B", action: "curl -H \"Authorization: Bearer $B\" API/api/my/files/<thatFileId>", expect: "404. A 200 means one provider can read another provider's child's EHCP", evidence: true, attack: true },
      { id: "d21s5", where: "Parent portal", action: "Try to DELETE a child who has bookings, medication and an incident record", expect: "Record what happens. Deleting a child who appears on a safeguarding record must not be a one-click parent action", attack: true },
      { id: "d21s6", where: "Parent → account", action: "Request your data (subject access)", expect: "Record what the export actually contains, and what it is missing — bookings, payments, messages, incidents, consents, photos" },
      { id: "d21s7", where: "Parent → account", action: "Request deletion", expect: "Record what actually happens. Reviewers found it writes a document nothing ever reads" },
      { id: "d21s8", where: "Parent → account", action: "Open Close my account with an active membership", expect: "It warns about the membership", regression: true },
      { id: "d21s9", where: "Parent portal", action: "Add a second carer to the same children", expect: "They see the same bookings and can book" },
      { id: "d21s10", where: "Parent → AI assistant", action: "Ask when the next session is and what was paid in September", expect: "Correct, drawn from real data — and nothing from another family" },
    ],
  },
  {
    day: 22, date: "2026-10-02", label: "Fri 2 Oct", portal: "franchise",
    title: "★ Franchise isolation — screens AND endpoints",
    intent: "Every step is an attempt to see someone else's data. Last time this was tested by looking at seven screens; the routes behind them were never touched.",
    steps: [
      { id: "d22s1", where: "Setup", action: "Head office with TWO franchises, each with own children, staff, bookings, rota and documents", expect: "Both exist with separate data. Grab franchise A's token as $F", evidence: true },
      { id: "d22s2", where: "Franchise A → Find a child", action: "Search for a child belonging to franchise B", expect: "Not found", regression: true },
      { id: "d22s3", where: "Terminal, $F", action: "curl -H \"Authorization: Bearer $F\" API/api/children/<B_childId>", expect: "404 — the by-id route, not the search screen", evidence: true, attack: true, regression: true },
      { id: "d22s4", where: "Terminal, $F", action: "Repeat for /api/trips, /api/compliance, /api/referrals, /api/availability/requests, /api/tasks, /api/reviews, /api/documents, /api/shifts", expect: "None return head office's or franchise B's rows. Record every one that does — four of these are known-open", evidence: true, attack: true, needsBackend: true },
      { id: "d22s5", where: "Franchise A → Team & invites", action: "Look at pending invites", expect: "Only your own — head office's franchise invites must not be listed", regression: true },
      { id: "d22s6", where: "Parent portal", action: "Have a PARENT self-book onto franchise B's listing, then check franchise A", expect: "Invisible to A. Reviewers note isolation is only tested on data the franchise itself created", regression: true },
      { id: "d22s7", where: "Franchise A → notification bell", action: "Watch the bell while franchise B and head office do things", expect: "Nothing from them appears. The bell obeys none of the scoping the routes enforce", regression: true, needsBackend: true },
      { id: "d22s8", where: "Franchise A → Setup", action: "Change a setting and confirm it takes effect for A", expect: "Record it — franchise settings are known to save to a document nothing reads", needsBackend: true },
      { id: "d22s9", where: "HQ combined view", action: "Check head office sees both franchises", expect: "Full visibility, correctly totalled" },
    ],
  },
  {
    day: 23, date: "2026-10-03", label: "Sat 3 Oct", portal: "operator",
    title: "Company multi-site and the schools/MAT shape",
    intent: "The shape you are now selling to schools, tested as a school would use it.",
    steps: [
      { id: "d23s1", where: "Company → Locations", action: "Create three locations and assign staff per site", expect: "Only assigned staff offered for that site's shifts" },
      { id: "d23s2", where: "Company dashboard", action: "Open it as a company with NO franchises", expect: "The operational dashboard, not a franchisor screen", regression: true },
      { id: "d23s3", where: "Company", action: "Build breakfast, after-school and holiday clubs", expect: "A parent can book across all three in one basket" },
      { id: "d23s4", where: "Registers", action: "Run breakfast and after-school registers on the same day", expect: "Separate registers, separate ratios" },
      { id: "d23s5", where: "Company → Team", action: "Make someone a site lead", expect: "They see their site only — check by URL too", attack: true },
      { id: "d23s6", where: "Money", action: "Compare income by site", expect: "Correctly split" },
      { id: "d23s7", where: "Parent", action: "Book a child into breakfast AND after-school on the same day", expect: "Both registers show them; the child is counted once per session, not once per day" },
    ],
  },
  {
    day: 24, date: "2026-10-04", label: "Sun 4 Oct", portal: "staff",
    title: "★ Staff portal — the API permission sweep",
    intent: "The old Day 24 walked the sidebar and passed. This one uses the staff token. Reviewers say most of these will fail today.",
    steps: [
      { id: "d24s1", where: "Staff portal", action: "Work through every sidebar item", expect: "Nothing blank or broken" },
      { id: "d24s2", where: "Browser console, staff account", action: "Grab the staff token as $S", expect: "You have it", evidence: true },
      { id: "d24s3", where: "Terminal", action: "curl -H \"Authorization: Bearer $S\" API/api/payments", expect: "403. Anything else — including a 200 with an empty list — is a fail: the endpoint answered a staff account at all", evidence: true, attack: true, regression: true },
      { id: "d24s4", where: "Terminal", action: "Repeat for /api/bookings, /api/customers, /api/reconciliation, /api/dashboard, /api/invoices", expect: "All 403. Paste one line of any response that isn't — the amounts are the evidence", evidence: true, attack: true, regression: true },
      { id: "d24s5", where: "Terminal", action: "curl -H \"Authorization: Bearer $S\" API/api/compliance", expect: "403, or only this person's own certificates. Colleagues' DBS references would be a serious fail", evidence: true, attack: true, regression: true },
      { id: "d24s6", where: "Terminal", action: "curl -H \"Authorization: Bearer $S\" API/api/incidents", expect: "Not every concern in the tenant — including allegations about colleagues", evidence: true, attack: true },
      { id: "d24s7", where: "Browser, signed in as staff", action: "Type an operator URL directly: /company/finance, /company/money-in, /company/team", expect: "Refused, every one", attack: true },
      { id: "d24s8", where: "Staff portal", action: "Submit an expense; take a register for your own session", expect: "Both work; a session you are NOT on is refused" },
      { id: "d24s9", where: "Staff portal on a phone", action: "Clock in, take a register, log an incident, clock out", expect: "All four comfortable one-handed" },
    ],
  },
  {
    day: 25, date: "2026-10-05", label: "Mon 5 Oct", portal: "mixed",
    title: "★ NEW — Cross-tenant attack day",
    intent: "Two unrelated paying customers. The boundary that, if it fails, ends the business. It was never tested once.",
    steps: [
      { id: "d25s1", where: "Tenant B", action: "Collect real ids: a childId, a booking ref, a listing id, an invoice id, an uploaded image URL, a file id", expect: "Six ids belonging to B" },
      { id: "d25s2", where: "Terminal, tenant A's token $A", action: "curl -H \"Authorization: Bearer $A\" API/api/children/<B_childId>", expect: "404", evidence: true, attack: true },
      { id: "d25s3", where: "Terminal, $A", action: "Try every id-bearing route with B's ids: /api/bookings/<ref>, /api/listings/<id>, /api/invoices/<id>, /api/my/files/<id>, /api/incidents/<id>, /api/medications/<id>", expect: "404 or 403 on every one", evidence: true, attack: true },
      { id: "d25s4", where: "Terminal, $A", action: "Add ?tenantId=<B> to /api/bookings, /api/registers, /api/compliance, /api/incidents, /api/invoices", expect: "The parameter is ignored for a non-platform account. Any route that honours it is a fail", evidence: true, attack: true, regression: true },
      { id: "d25s5", where: "Terminal, a PARENT's token", action: "Call operator routes: /api/bookings, /api/customers, /api/library", expect: "403 on all", evidence: true, attack: true },
      { id: "d25s6", where: "Terminal, no token at all", action: "Call /api/children/lookup, /api/bookings, /api/payments", expect: "401 on all", evidence: true, attack: true },
      { id: "d25s7", where: "Browser, tenant A signed in", action: "Type tenant B's portal URLs directly, and edit an id in a URL you are on", expect: "Refused", attack: true },
      { id: "d25s8", where: "Private window", action: "Open B's image URL and B's public library/invoice links", expect: "Record exactly what a stranger can see", evidence: true, attack: true },
    ],
  },
  {
    day: 26, date: "2026-10-06", label: "Tue 6 Oct", portal: "mixed",
    title: "★ NEW — Auth lifecycle and abuse",
    intent: "Everything about getting in, staying in, and being put out. Reviewers found there is currently no way to put anyone out.",
    steps: [
      { id: "d26s1", where: "Sign-in page", action: "Enter a wrong password 20 times in a row", expect: "You are slowed or locked out", attack: true },
      { id: "d26s2", where: "Sign-in", action: "Reset your password by email", expect: "The link arrives, works once, and cannot be reused", evidence: true },
      { id: "d26s3", where: "Two browsers signed in as the same account", action: "Change the password in one; keep using the other", expect: "The other session stops working", attack: true, needsBackend: true },
      { id: "d26s4", where: "Terminal", action: "Keep a token, sign out in the browser, then use the token", expect: "Refused. If it still works, signing out means nothing", evidence: true, attack: true, needsBackend: true },
      { id: "d26s5", where: "Account settings", action: "Change your email address", expect: "Verified before it takes effect; the old address can no longer sign in" },
      { id: "d26s6", where: "Team", action: "Remove a staff member entirely, then have them refresh and use their token", expect: "Both refused", evidence: true, attack: true, needsBackend: true },
      { id: "d26s7", where: "Parent portal", action: "Paste a script into every free-text field you can find — child name, care notes, review, newsfeed comment, message", expect: "Shown literally as text wherever it is later displayed, including in emails and PDFs", attack: true },
      { id: "d26s8", where: "Any upload field", action: "Upload a .html file, a .svg, and a 50MB file", expect: "Type and size are restricted; nothing is served back inline in a way that could run", attack: true },
      { id: "d26s9", where: "Terminal", action: "Call a POST route with a token from a DIFFERENT role and a body for someone else's record", expect: "Refused, not silently accepted", evidence: true, attack: true },
    ],
  },
  {
    day: 27, date: "2026-10-07", label: "Wed 7 Oct", portal: "mixed",
    title: "★ NEW — Failure, recovery, access and the clock change",
    intent: "What a real Tuesday does to it. Nobody has looked at what happens when things go wrong rather than right.",
    steps: [
      { id: "d27s1", where: "Any page", action: "Kill the API (ask Amir to stop it) and use the portal", expect: "Clear error messages — not white screens, not silent empty lists that look like real data" },
      { id: "d27s2", where: "Every main list", action: "View each with genuinely no data (a brand-new account)", expect: "A helpful empty state, not a broken layout or a zero that looks like a bug" },
      { id: "d27s3", where: "With Amir", action: "Ask how you would find out that something broke in production at 07:00 on a Monday", expect: "A real answer — monitoring or alerting. 'A customer will call' is a finding", needsBackend: true },
      { id: "d27s4", where: "With Amir", action: "Ask him to restore the database to yesterday, on staging", expect: "He can, and knows how long it takes. Rehearse it before you need it", needsBackend: true },
      { id: "d27s5", where: "Device clock set to 26 Oct", action: "Open today's register, the dashboard, and a medication due at 08:00", expect: "Correct sessions, correct times, the day after the clocks change" },
      { id: "d27s6", where: "Payment plans and reminders", action: "Set one to fire after 25 Oct", expect: "Fires at the right UK time, not an hour out" },
      { id: "d27s7", where: "Keyboard only, no mouse", action: "Complete a booking as a parent and take a register as staff", expect: "Possible throughout. You are selling to schools, who are legally required to care about this" },
      { id: "d27s8", where: "A screen reader (VoiceOver)", action: "Open the booking page and the register", expect: "Buttons and fields are announced meaningfully" },
      { id: "d27s9", where: "Safari, Firefox, Edge, and an older Android phone", action: "Do one booking and one register on each", expect: "All work. The whole run so far has been one browser" },
    ],
  },
  {
    day: 28, date: "2026-10-08", label: "Thu 8 Oct", portal: "hq",
    title: "HQ, go-live rehearsal, and the regression sweep",
    intent: "Finish with the owner's view, rehearse the switch to real money, then re-run everything that failed.",
    steps: [
      { id: "d28s1", where: "HQ → Analytics and Providers", action: "Check platform numbers and each provider's plan and price", expect: "Match the accounts you created" },
      { id: "d28s2", where: "HQ → Sales pipeline", action: "Open it after Day 5's demo form submission", expect: "The page LOADS. A real demo lead must not crash it", regression: true },
      { id: "d28s3", where: "HQ → open an account, then exit", action: "Impersonate a provider and come back", expect: "The right account throughout, and Exit returns you to HQ", regression: true },
      { id: "d28s4", where: "Terminal, an OPERATOR token", action: "Call platform routes: /api/platform/providers, /api/tenants", expect: "403 — only HQ may call these", evidence: true, attack: true },
      { id: "d28s5", where: "With Amir", action: "Walk the go-live checklist: live Stripe keys, STRIPE_PLATFORM_FALLBACK OFF, real Connect onboarding with KYC, webhook endpoint registered, mail domain verified, backups on, monitoring on", expect: "Every one confirmed, out loud, with him", needsBackend: true },
      { id: "d28s6", where: "Live Stripe, small amounts", action: "Take one real £1 booking on your own card, refund it, and check the payout", expect: "Charge, refund and payout all real and correct. Test mode never proves this", needsBackend: true },
      { id: "d28s7", where: "Live Stripe", action: "Try a card that will be declined, and one that triggers 3DS", expect: "Both handled gracefully for the parent", needsBackend: true },
      { id: "d28s8", where: "Testing → To triage and For Amir", action: "Re-run EVERY step you failed across days 1–27", expect: "Each now passes, or is explicitly still open with an owner and a decision" },
      { id: "d28s9", where: "Testing → Export", action: "Export the full report", expect: "A complete record: what passed, what is open, who owns it" },
    ],
  },
];

export const TOTAL_STEPS = PLAN.reduce((n, d) => n + d.steps.length, 0);
