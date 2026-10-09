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

export const AGENT_AS_OF = "2026-10-09";

const D = "2026-10-09";
export const AGENT_AREAS: AgentArea[] = [
  { id: "A01", area: "Pay double-charge fix", status: "shipped", rounds: "PR #168", next: "Nothing. Live.", date: D },
  { id: "A02", area: "Incident dossier children leak", status: "shipped", rounds: "PR #158, #163", next: "Nothing. Live.", date: D },
  { id: "A03", area: "Role/feature gate bypass (path case, absolute form)", status: "shipped", rounds: "PR #161", next: "Nothing. Live.", date: D },
  { id: "A04", area: "HMRC sandbox runner + evidence (32 of 32)", status: "shipped", rounds: "PR #160", next: "Message HMRC Support once the name and office are settled.", date: D },
  { id: "A05", area: "Privacy and terms company details", status: "shipped", rounds: "PR #159, #162, #164, #165, #169", next: "Update the office once Companies House shows it.", date: D },
  { id: "A06", area: "HQ Test tracker merge", status: "shipped", rounds: "PR #167", next: "Nothing. Live.", date: D },
  { id: "A07", area: "Quick book white screen on iPhone", status: "shipped", rounds: "PR #171", next: "Phone check 1.", date: D },
  { id: "A08", area: "Wallet-minting release race hotfix", status: "shipped", rounds: "PR #172 (d86d50be)", next: "Phone check 2.", date: D },
  { id: "A09", area: "Friendly Pay and session-expired messages", status: "shipped", rounds: "PR #173", next: "Nothing. Live.", date: D },
  { id: "A10", area: "Stripe refund sync", status: "shipped", rounds: "PR #174", next: "Inert until you tick the four refund events on both webhooks.", date: D },
  { id: "A11", area: "Card-hold cancel-during-capture hotfix", status: "shipped", rounds: "PR #175", next: "Nothing. Live.", date: D },
  { id: "A12", area: "Add-ons (extras) as one build", status: "shipped", rounds: "PR #176 (7750a0f4)", next: "Phone checks 3 and 4. Rollback: revert the merge.", date: D },
  { id: "A13", area: "Dates sweep (Welsh, Polish, Arabic)", status: "verified", rounds: "fix-dates-8oct, 506 sites", next: "Display only. Ship with the next batch.", date: D },
  { id: "A14", area: "Awaiting payment (card bookings unconfirmed until paid)", status: "testing", rounds: "5 rounds, 121 cases, 0 fail", next: "Rebase on add-ons, one more check, then your phone check.", date: D },
  { id: "A15", area: "Pay card-hold recovery (lost replies, stuck holds)", status: "testing", rounds: "fix-pay-y07-8oct, round 5", next: "Verifier pending.", date: D },
  { id: "A16", area: "Pay hold-release round 5", status: "held", rounds: "Verify pending", next: "Verify before it ships.", date: D },
  { id: "A17", area: "Double refund (pending partial also refunded in Stripe)", status: "held", rounds: "n/a", next: "Your call: shrink the pending refund by the Stripe amount (recommended).", date: D },
  { id: "A18", area: "Offline part + card part booking", status: "held", rounds: "n/a", next: "Shows the offline part only as to-reimburse. Needs a fix.", date: D },
  { id: "A19", area: "Awaiting payment tester D", status: "held", rounds: "Blocked", next: "Blocked by a permission denial. Needs your go.", date: D },
  { id: "A20", area: "Coupons (54 cases; fixes merged #156)", status: "waiting", rounds: "Baseline + 1 fix round", next: "Your call on stacking: repeat, two percentage, exclusive codes.", date: D },
  { id: "A21", area: "Name, domain, registered office", status: "waiting", rounds: "n/a", next: "Pick name and domain. Office: Suite A, 82 James Carter Road, Mildenhall IP28 7DE (pages show 12 Corris Court until Companies House updates).", date: D },
  { id: "A22", area: "HMRC message and production credentials", status: "waiting", rounds: "n/a", next: "Send the message after the name, domain and office are settled.", date: D },
  { id: "A23", area: "Stripe refund events", status: "waiting", rounds: "n/a", next: "Tick charge.refunded, refund.created, refund.updated, refund.failed on both endpoints.", date: D },
  { id: "A24", area: "Head-injury accident rule", status: "testing", rounds: "n/a", next: "Owner decided yes (9 Oct). Built as A30, verifier pending.", date: D },
  { id: "A25", area: "Repository visibility", status: "waiting", rounds: "n/a", next: "Decide public or private.", date: D },
  { id: "A26", area: "Add-ons acceptance run (build #176)", status: "held", rounds: "2 blind testers, 58 cases each: 55 pass, 0 fail, 1 not built (AP12), 1 needs browser (AM05)", next: "Both found 2 money bugs: provider cancel-child leaves 230 not 161; family release then provider cancel-day refunds about 19 pounds short. Fixer after the wallet-refund work.", date: D },
  { id: "A27", area: "Staff no-prices check", status: "testing", rounds: "Browser: 52 pass, 2 fail, 4 not done", next: "Fix staff-listings-noprice-9oct (2f00934e) built, also hides the Not paid yet chip from staff (owner decided). Awaiting independent verifier.", date: D },
  { id: "A28", area: "Extra-request wording", status: "testing", rounds: "extra-request-wording-9oct (5b1e65c9), browser pass EN + CY", next: "Both findings fixed, not re-checked in a browser.", date: D },
  { id: "A29", area: "Quick book franchise scope + Finance unpaid-cancelled add-on figures", status: "testing", rounds: "addon-scope-finance-9oct (e26d204c)", next: "Verifier pending.", date: D },
  { id: "A30", area: "Head-injury parent notice (always notify at once)", status: "testing", rounds: "head-injury-notify-9oct (8523297b)", next: "Add form checkbox + Manual screenshot.", date: D },
  { id: "A31", area: "Wallet part of a refund goes back to the wallet", status: "testing", rounds: "Building", next: "Owner decided: proportional split. Then verify.", date: D },
  { id: "A32", area: "Checkout asks before using wallet credit", status: "testing", rounds: "checkout-wallet-ask-9oct (1c8890ce), 594 pure + 5 emulator pass", next: "Verifier needed: release-race 21 of 24, Pay suites not run, no browser check.", date: D },
  { id: "A33", area: "Reconciliation: overpaid / Partially refunded chip", status: "verified", rounds: "qa-branch-bd 6dce27ed, independent verifier: safe, 73/73", next: "Ship. Not tested: Reconciliation give-back button, screen rendering.", date: D },
];

export const PHONE_CHECKS: PhoneCheck[] = [
  { id: "P1", when: "Now", task: "Retry the online lesson Quick book on iPhone." },
  { id: "P2", when: "Now", task: "As a parent, release one day on a paid booking: wallet credit is exactly one day; double-tap credits once." },
  { id: "P3", when: "Now", task: "Add-ons: approve a T-shirt size change request; staff see no prices." },
  { id: "P4", when: "Now", task: "Part-paid release preview says the price drops." },
  { id: "P5", when: "After ticking the Stripe events", task: "Refund 1 pound in the Stripe dashboard: Finance shows Refunded within a minute, one bell." },
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
