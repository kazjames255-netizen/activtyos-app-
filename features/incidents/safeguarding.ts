// Safeguarding reference data — categories, auto risk-level and the read-only
// "What to do now" protocol, transcribed from the prototype's safeguarding
// stream so the staff form behaves the same. Facts-only, DSL-routed.

export type Risk = "minor" | "moderate" | "serious"; // low / medium / high

export const SG_CATEGORIES = [
  "Disclosure / allegation by a child",
  "Physical abuse",
  "Emotional abuse",
  "Sexual abuse / harmful sexual behaviour",
  "Neglect",
  "Child-on-child abuse (bullying, harassment)",
  "Online / digital harm",
  "Mental health (self-harm, suicidal ideation)",
  "Radicalisation (Prevent)",
  "Exploitation (CSE / CCE) or modern slavery",
  "Domestic abuse affecting a child",
  "FGM (mandatory report)",
  "Allegation against a member of staff / volunteer",
  "Welfare concern / early help",
] as const;

const has = (s: string, ...needles: string[]) => needles.some((n) => s.toLowerCase().includes(n));

/** Suggested risk level for a category (operator can override). */
export function riskFor(cat: string): Risk {
  if (has(cat, "child-on-child", "online", "digital")) return "moderate";
  if (has(cat, "welfare", "early help")) return "minor";
  if (has(cat, "disclosure", "abuse", "neglect", "self-harm", "suicidal", "mental health", "allegation", "fgm", "exploitation", "modern slavery", "domestic", "radicalis")) return "serious";
  return "moderate";
}

export interface Protocol { who: string; due: string; tone: "red" | "amber" | "grey"; ref: string; steps: string[] }

export const DEFAULT_PROTOCOL = {
  due: "Same day",
  ref: "KCSIE",
  steps: [
    "Record only the facts now — what was seen or heard, when, where and who. No opinions or leading questions.",
    "As the safeguarding lead, decide today whether to refer: children's social care (MASH) if a child may be at risk, the LADO for a concern about an adult, or 999 if a child is in immediate danger.",
    "Share strictly on a need-to-know basis — never promise confidentiality. If you're unsure, call the NSPCC helpline for advice.",
  ],
};

/** KCSIE Part 4 — an allegation / concern ABOUT an adult who works with children.
 *  A different process to a concern about a child: the case manager handles it,
 *  you don't investigate, and it may go to the LADO (harm threshold) or be
 *  recorded as a low-level concern. */
export function staffAllegationProtocol(dslWho: string): Protocol {
  return {
    who: `Case manager — ${dslWho} → LADO`,
    due: "Refer to the LADO within 1 working day (if the harm threshold is met)",
    tone: "red",
    ref: "KCSIE Part 4",
    steps: [
      "Do not investigate and do not question the child or the person — refer at once to the case manager (the most senior person; if it concerns them, the proprietor / chair).",
      "Where the allegation meets the harm threshold, the case manager reports to the Local Authority Designated Officer (LADO) within one working day; the LADO advises next steps. Do not tip off the person.",
      "For a lower-level concern that doesn't meet the threshold, still record it and share with the case manager — patterns matter.",
      "Put the child's safety first and keep it confidential. Consider suspension only as a last resort, after weighing alternatives.",
    ],
  };
}

/** The "What to do now" guidance for a category. The default (due / ref / steps
 *  / who) comes from the provider's Setup; special categories add legal
 *  overrides. `dsl` is the provider's editable lead title + name. When `subject`
 *  is "staff" the KCSIE Part 4 (allegations) process is shown instead. */
export function protocolFor(cat: string, base?: { due?: string; ref?: string; steps?: string[] }, dsl?: { title?: string; name?: string }, subject?: "child" | "staff"): Protocol {
  const steps = base?.steps?.length ? base.steps : DEFAULT_PROTOCOL.steps;
  const dslWho = [dsl?.title || "Designated Safeguarding Lead (DSL)", dsl?.name].filter(Boolean).join(" · ");
  if (subject === "staff" || has(cat, "allegation against")) return staffAllegationProtocol(dslWho);
  const youDecide = `You${dsl?.name ? ` (${dsl.name})` : ""} decide the referral`;
  const p: Protocol = { who: youDecide, due: base?.due || DEFAULT_PROTOCOL.due, tone: "red", ref: base?.ref || DEFAULT_PROTOCOL.ref, steps };
  if (has(cat, "fgm")) return { ...p, who: `${dslWho} + Police (mandatory)`, due: "Mandatory report — without delay", steps: ["This is a mandatory report — the DSL must inform the police without delay.", ...steps.slice(1)] };
  if (has(cat, "self-harm", "suicidal", "mental health")) return { ...p, due: "Same day — 999 if life at risk", steps: ["If there is an immediate risk to life, call 999 first.", ...steps] };
  if (has(cat, "exploitation", "modern slavery")) return { ...p, who: `${dslWho} → NRM`, due: "Same day — consider NRM", steps: ["Tell the DSL — consider a National Referral Mechanism (NRM) referral.", ...steps.slice(1)] };
  if (has(cat, "welfare", "early help")) return { ...p, due: "Same day — record & monitor", tone: "amber", steps: ["Record and monitor — raise early help with the DSL.", ...steps.slice(1)] };
  return p;
}

/** Keeping Children Safe in Education (statutory guidance). */
export const KCSIE_URL = "https://assets.publishing.service.gov.uk/media/6a4cf903b7203c4c023fd2f3/Keeping_children_safe_in_education_2026_.pdf";

/** The decisions a DSL chooses from once a concern reaches them (KCSIE 2026).
 *  Multiple can apply; each carries a plain-English "when to use". */
export const DSL_DECISIONS: { key: string; label: string; when: string; tone: "red" | "amber" | "grey" }[] = [
  { key: "monitor", label: "Manage internally — monitor & review", when: "No external threshold met yet. Record, support the child, and set a review date.", tone: "grey" },
  { key: "early-help", label: "Early help assessment", when: "The child may benefit from coordinated multi-agency early help. Start an assessment.", tone: "amber" },
  { key: "childrens-social-care", label: "Refer to children's social care (MASH)", when: "A child is in need, or at risk of significant harm. Refer the same day; confirm in writing within 48 hours.", tone: "red" },
  { key: "police", label: "Refer to the police / 999", when: "A crime may have been committed, or a child is in immediate danger.", tone: "red" },
  { key: "lado", label: "Refer to the LADO", when: "An allegation against a member of staff or volunteer — within 1 working day.", tone: "red" },
  { key: "nrm-nspcc", label: "NRM / NSPCC referral or advice", when: "Modern slavery / exploitation (NRM), or ring the NSPCC helpline for advice.", tone: "amber" },
  { key: "inform-parents", label: "Consult / inform parents or carers", when: "Unless doing so would place the child at further risk or interfere with an investigation.", tone: "grey" },
  { key: "no-action", label: "No further action — recorded", when: "Threshold not met. The concern is noted and kept on file.", tone: "grey" },
];
