// SOURCE OF TRUTH for the HQ "Agent testing" section of the Test tracker (/platform/testing).
// Updated BY PULL REQUEST as the testing agents report. It does NOT update live; AGENT_AS_OF below
// says how fresh it is. Keep every field to one short line. No Firestore, no API.

export type AgentStatus = "shipped" | "verified" | "testing" | "waiting" | "held";

export interface AgentArea {
  id: string;
  area: string;
  status: AgentStatus;
  /** Short, e.g. "5 rounds" or "PR #158, #163". */
  rounds: string;
  /** One line: what happens next. */
  next: string;
  /** ISO date (YYYY-MM-DD) of the last change. */
  date: string;
}

export interface PhoneCheck {
  id: string;
  /** When to do it, e.g. "After the Pay fix ships". */
  when: string;
  /** One line: what to do. */
  task: string;
}

export const AGENT_STATUS_ORDER: AgentStatus[] = ["waiting", "verified", "testing", "held", "shipped"];

export const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  shipped: "Shipped",
  verified: "Verified, ready to ship",
  testing: "In testing",
  waiting: "Waiting on owner",
  held: "Held",
};

export const AGENT_AS_OF = "2026-10-10";

const D = "2026-10-10";
const T_NEXT = "Proposal and cases written (10 Oct); confirm gaps by running them.";
export const AGENT_AREAS: AgentArea[] = [
  // Shipped (merged to main by PR)
  { id: "A01", area: "Pay double-charge fix", status: "shipped", rounds: "PR #168", next: "Nothing. Live.", date: D },
  { id: "A02", area: "Incident dossier children leak", status: "shipped", rounds: "PR #158, #163", next: "Nothing. Live.", date: D },
  { id: "A03", area: "Role/feature gate bypass (path case, absolute form)", status: "shipped", rounds: "PR #161", next: "Nothing. Live.", date: D },
  { id: "A04", area: "HMRC sandbox runner + evidence (32 of 32)", status: "shipped", rounds: "PR #160", next: "Message HMRC Support once the name and office are settled.", date: D },
  { id: "A05", area: "Privacy and terms company details", status: "shipped", rounds: "PR #159, #162, #164, #165, #169", next: "Update the office once Companies House shows it.", date: D },
  { id: "A06", area: "HQ Test tracker merge", status: "shipped", rounds: "PR #167", next: "Nothing. Live.", date: D },
  { id: "A07", area: "Quick book white screen on iPhone", status: "shipped", rounds: "PR #171", next: "Nothing. Your phone check passed.", date: D },
  { id: "A08", area: "Wallet-minting release race hotfix", status: "shipped", rounds: "PR #172", next: "Nothing. Your phone check passed.", date: D },
  { id: "A09", area: "Friendly Pay and session-expired messages", status: "shipped", rounds: "PR #173", next: "Nothing. Live.", date: D },
  { id: "A10", area: "Stripe refund sync", status: "shipped", rounds: "PR #174", next: "Inert until you tick the four refund events on both webhooks.", date: D },
  { id: "A11", area: "Card-hold cancel-during-capture hotfix", status: "shipped", rounds: "PR #175", next: "Nothing. Live.", date: D },
  { id: "A12", area: "Add-ons (extras) as one build", status: "shipped", rounds: "PR #176", next: "Nothing. Live. Polish shipped as #182 to #184.", date: D },
  { id: "A13", area: "Refund follow-ups and wallet breakdown", status: "shipped", rounds: "PR #179, #180", next: "Nothing. Live.", date: D },
  { id: "A14", area: "Dates sweep (Welsh, Polish, Arabic)", status: "shipped", rounds: "PR #181", next: "Nothing. Live.", date: D },
  { id: "A15", area: "Add-on polish and checkout breakdown", status: "shipped", rounds: "PR #182, #183, #184", next: "Nothing. Live.", date: D },
  { id: "A16", area: "Add-on batch: staff no prices, Quick book scope, Finance figures, extra-request wording, head-injury notice", status: "shipped", rounds: "PR #186", next: "Nothing. Your phone checks passed 10 Oct.", date: D },
  { id: "A17", area: "Money batch: wallet refund split, checkout asks about credit, reconciliation overpaid, refund wording names the method", status: "shipped", rounds: "PR #187", next: "Your phone checks pending (see list below).", date: D },
  { id: "A18", area: "AI assistant hardening, HQ Providers tabs, short Manual, food-for-thought cards", status: "shipped", rounds: "PR #188", next: "Nothing. Live.", date: D },
  { id: "A19", area: "Trips and consent hardening (incl. cross-tenant child link fix)", status: "shipped", rounds: "PR #189", next: "Nothing. Live.", date: D },
  { id: "A20", area: "Learning Hub hardening", status: "shipped", rounds: "PR #190", next: "Flag set on both owner tenants live 10 Oct. Check live counts are 4,679, not doubled.", date: D },
  { id: "A21", area: "Franchise payouts Option A (cash statement)", status: "shipped", rounds: "PR #191", next: "Nothing. Live.", date: D },
  { id: "A22", area: "Learning Hub follow-ups (privacy registry for 11 collections, staff fail-closed, publisher link)", status: "shipped", rounds: "PR #192", next: "Nothing. Live.", date: D },
  // In flight (testing, not on main)
  { id: "A23", area: "Memberships with real Stripe subscriptions", status: "testing", rounds: "memberships-stripe-10oct, fixer round 2 done", next: "Re-verify (credit proration, provider-off members, N+1 reads, retry keys fixed).", date: D },
  { id: "A24", area: "Cancel-one-child and release-then-cancel-day money bugs", status: "testing", rounds: "cancel-money-bugs-10oct (8e1a2d8f)", next: "Independent verifier running.", date: D },
  { id: "A25", area: "Per-add-on request cut-off in the listing editor", status: "testing", rounds: "addon-cutoff-per-item-10oct", next: "Being built, then verify.", date: D },
  { id: "A26", area: "Awaiting payment (card bookings unconfirmed until paid)", status: "held", rounds: "5 rounds, 121 cases, 0 fail", next: "Needs a rebase on main, then one more check.", date: D },
  { id: "A27", area: "Pay hold-release recovery (lost replies, stuck holds)", status: "held", rounds: "fix-pay-y07-8oct, round 5", next: "Held. Verify before it ships.", date: D },
  // Waiting on owner
  { id: "A28", area: "Name, domain, registered office", status: "waiting", rounds: "n/a", next: "Pick name and domain. Office: Suite A, 82 James Carter Road, Mildenhall IP28 7DE (pages show 12 Corris Court until Companies House updates).", date: D },
  { id: "A29", area: "HMRC message and production credentials", status: "waiting", rounds: "n/a", next: "Send the message after the name, domain and office are settled.", date: D },
  { id: "A30", area: "Coupons: stacking rules", status: "waiting", rounds: "54 cases; fixes merged #156", next: "Your call on stacking: repeat, two percentage, exclusive codes.", date: D },
  { id: "A31", area: "Repository visibility", status: "waiting", rounds: "n/a", next: "Decide public or private.", date: D },
  { id: "A32", area: "Stripe events for memberships", status: "waiting", rounds: "n/a", next: "Add the subscription events when memberships ships. Refund events: see A10.", date: D },
  { id: "A33", area: "Double refund (pending partial also refunded in Stripe)", status: "waiting", rounds: "n/a", next: "Your call: shrink the pending refund by the Stripe amount (recommended).", date: D },
  { id: "A34", area: "Account closure and delete requests", status: "waiting", rounds: "n/a", next: "Closure leaves hub data and delete requests only log. Plan as its own area.", date: D },
  // Testing programme: 13 planned areas
  { id: "T01", area: "Testing programme: safeguarding", status: "waiting", rounds: "Proposal written", next: T_NEXT, date: D },
  { id: "T02", area: "Testing programme: health", status: "waiting", rounds: "Proposal written", next: T_NEXT, date: D },
  { id: "T03", area: "Testing programme: sign-in and roles", status: "waiting", rounds: "Proposal written", next: T_NEXT, date: D },
  { id: "T04", area: "Testing programme: subscription billing", status: "waiting", rounds: "Proposal written", next: T_NEXT, date: D },
  { id: "T05", area: "Testing programme: franchise", status: "waiting", rounds: "Proposal written", next: T_NEXT, date: D },
  { id: "T06", area: "Testing programme: online sessions", status: "waiting", rounds: "Proposal written", next: T_NEXT, date: D },
  { id: "T07", area: "Testing programme: home visits", status: "waiting", rounds: "Proposal written", next: T_NEXT, date: D },
  { id: "T08", area: "Testing programme: privacy scoping", status: "waiting", rounds: "Proposal written", next: T_NEXT, date: D },
  { id: "T09", area: "Testing programme: messages and bells", status: "waiting", rounds: "Proposal written", next: T_NEXT, date: D },
  { id: "T10", area: "Testing programme: trips", status: "waiting", rounds: "Proposal written", next: T_NEXT, date: D },
  { id: "T11", area: "Testing programme: learning hub", status: "waiting", rounds: "Proposal written", next: T_NEXT, date: D },
  { id: "T12", area: "Testing programme: memberships", status: "testing", rounds: "Proposal written", next: T_NEXT, date: D },
  { id: "T13", area: "Testing programme: AI assistant", status: "waiting", rounds: "Proposal written", next: T_NEXT, date: D },
];

export const PHONE_CHECKS: PhoneCheck[] = [
  { id: "P1", when: "Now", task: "Checkout with wallet credit: it asks whether to use the credit, and the breakdown adds up." },
  { id: "P2", when: "Now", task: "Cancel a part-wallet, part-card booking: the refund splits between wallet and card, and the wording names the method." },
  { id: "P3", when: "Now", task: "Finance Reconciliation: an overpaid booking shows the overpaid / Partially refunded chip." },
  { id: "P4", when: "After ticking the Stripe events", task: "Refund 1 pound in the Stripe dashboard: Finance shows Refunded within a minute, one bell." },
];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Returns a list of problems; empty means the data is well formed. */
export function validateAgentData(areas: AgentArea[] = AGENT_AREAS, checks: PhoneCheck[] = PHONE_CHECKS): string[] {
  const bad: string[] = [];
  const ids = new Set<string>();
  for (const a of areas) {
    if (ids.has(a.id)) bad.push(`duplicate id ${a.id}`);
    ids.add(a.id);
    if (!AGENT_STATUS_ORDER.includes(a.status)) bad.push(`${a.id}: bad status ${a.status}`);
    if (!ISO.test(a.date) || Number.isNaN(Date.parse(a.date))) bad.push(`${a.id}: bad date ${a.date}`);
    if (!a.area || !a.next) bad.push(`${a.id}: empty text`);
  }
  for (const c of checks) {
    if (ids.has(c.id)) bad.push(`duplicate id ${c.id}`);
    ids.add(c.id);
    if (!c.when || !c.task) bad.push(`${c.id}: empty text`);
  }
  return bad;
}
