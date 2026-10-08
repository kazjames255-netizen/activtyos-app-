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

export const AGENT_AS_OF = "2026-10-08";

export const AGENT_AREAS: AgentArea[] = [
  { id: "A01", area: "Pay double-charge fix (double-click Pay)", status: "verified", rounds: "5 rounds (b7a45598)", next: "Needs your go, then one real card payment on your phone.", date: "2026-10-08" },
  { id: "A02", area: "Child-data scope + staff home guard", status: "verified", rounds: "fix-child-names-8oct (5c4da69e)", next: "Ship with the next batch.", date: "2026-10-08" },
  { id: "A03", area: "Add-ons: display, requests, permissions", status: "testing", rounds: "6 findings fixed", next: "Final money re-check, then ship.", date: "2026-10-08" },
  { id: "A04", area: "Unpaid-card hold release (race fix)", status: "testing", rounds: "Verifier running", next: "Wait for the verifier result.", date: "2026-10-08" },
  { id: "A05", area: "Incident dossier children leak", status: "shipped", rounds: "PR #158, #163", next: "Nothing. Live.", date: "2026-10-08" },
  { id: "A06", area: "Role/feature gate bypass (path case, absolute form)", status: "shipped", rounds: "PR #161", next: "Nothing. Live.", date: "2026-10-08" },
  { id: "A07", area: "HMRC sandbox runner + evidence (32 of 32)", status: "shipped", rounds: "PR #160", next: "Message HMRC Support when you are ready.", date: "2026-10-08" },
  { id: "A08", area: "Privacy and terms company details", status: "shipped", rounds: "PR #159, #162, #164, #165", next: "Add the registered office once decided.", date: "2026-10-08" },
  { id: "A09", area: "Add-on orders: listing filter", status: "shipped", rounds: "1 round", next: "Nothing. Live.", date: "2026-10-08" },
  { id: "A10", area: "Coupons (54 cases; fixes merged #156)", status: "waiting", rounds: "Baseline + 1 fix round", next: "Your call on stacking: repeat code, two percentage codes, exclusive codes.", date: "2026-10-08" },
  { id: "A11", area: "Name, domain, registered office", status: "waiting", rounds: "n/a", next: "Pick the name and domain; office is Suite A, 82 James Carter Road, Mildenhall IP28 7DE (service address).", date: "2026-10-08" },
  { id: "A12", area: "HMRC message and production credentials", status: "waiting", rounds: "n/a", next: "Send the message to HMRC Support after the privacy and terms links are live.", date: "2026-10-08" },
  { id: "A13", area: "Head-injury accident rule", status: "waiting", rounds: "n/a", next: "Decide the rule.", date: "2026-10-08" },
  { id: "A14", area: "Repository visibility", status: "waiting", rounds: "n/a", next: "Decide public or private.", date: "2026-10-08" },
];

export const PHONE_CHECKS: PhoneCheck[] = [
  { id: "P1", when: "After the Pay fix ships", task: "Make one small real card payment and confirm you are charged once." },
  { id: "P2", when: "After the Pay fix ships", task: "Cancel that booking and confirm the refund shows." },
  { id: "P3", when: "After add-ons ship", task: "As a parent, ask to change and to cancel an add-on." },
  { id: "P4", when: "After add-ons ship", task: "As the owner, approve one request and see the parent told." },
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
