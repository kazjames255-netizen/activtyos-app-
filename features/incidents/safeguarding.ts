// Safeguarding reference data — categories, auto risk-level and the read-only
// "What to do now" protocol, transcribed from the prototype's safeguarding
// stream so the staff form behaves the same. Facts-only, DSL-routed.

import { tNow } from "@/lib/i18n/provider";

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

/** Display name for a category. The stored value stays the English string (riskFor / protocolFor match on it); custom categories show as typed. */
export const SG_CAT_KEY: Record<string, string> = Object.fromEntries(SG_CATEGORIES.map((c, i) => [c, `p8ops.sgCat${i + 1}`]));
export const sgCategoryLabel = (t: (k: string) => string, cat: string): string => (SG_CAT_KEY[cat] ? t(SG_CAT_KEY[cat]) : cat);
/** DSL decision key -> catalogue keys (label / when). Stored log entries keep their English label; the display is translated by key. */
export const DEC_KEY: Record<string, [string, string]> = {
  "monitor": ["p8ops.sgDecMonitor", "p8ops.sgDecMonitorWhen"],
  "early-help": ["p8ops.sgDecEarly", "p8ops.sgDecEarlyWhen"],
  "childrens-social-care": ["p8ops.sgDecSocial", "p8ops.sgDecSocialWhen"],
  "police": ["p8ops.sgDecPolice", "p8ops.sgDecPoliceWhen"],
  "lado": ["p8ops.sgDecLado", "p8ops.sgDecLadoWhen"],
  "nrm-nspcc": ["p8ops.sgDecNrm", "p8ops.sgDecNrmWhen"],
  "inform-parents": ["p8ops.sgDecParents", "p8ops.sgDecParentsWhen"],
  "no-action": ["p8ops.sgDecNoAction", "p8ops.sgDecNoActionWhen"],
};

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
  const L = (k: string, v?: Record<string, string | number>) => tNow(`p8ops.${k}`, v);
  return {
    who: L("sgStaffWho", { dsl: dslWho }),
    due: L("sgStaffDue"),
    tone: "red",
    ref: L("sgStaffRef"),
    steps: [L("sgStaffStep1"), L("sgStaffStep2"), L("sgStaffStep3"), L("sgStaffStep4")],
  };
}

/** The "What to do now" guidance for a category. The default (due / ref / steps
 *  / who) comes from the provider's Setup; special categories add legal
 *  overrides. `dsl` is the provider's editable lead title + name. When `subject`
 *  is "staff" the KCSIE Part 4 (allegations) process is shown instead. */
export function protocolFor(cat: string, base?: { due?: string; ref?: string; steps?: string[] }, dsl?: { title?: string; name?: string }, subject?: "child" | "staff"): Protocol {
  const L = (k: string, v?: Record<string, string | number>) => tNow(`p8ops.${k}`, v);
  // The provider's own protocol text (Setup → Safeguarding) is shown as they wrote it; only the built-in default wording is translated.
  const custom = !!base?.steps?.length && JSON.stringify(base.steps) !== JSON.stringify(DEFAULT_PROTOCOL.steps);
  const steps = custom ? base!.steps! : [L("sgStepFacts"), L("sgStepDecide"), L("sgStepShare")];
  const dslWho = [dsl?.title || L("sgDslTitle"), dsl?.name].filter(Boolean).join(" · ");
  if (subject === "staff" || has(cat, "allegation against")) return staffAllegationProtocol(dslWho);
  const youDecide = dsl?.name ? L("sgYouDecideNamed", { name: dsl.name }) : L("sgYouDecide");
  const p: Protocol = { who: youDecide, due: !base?.due || base.due === DEFAULT_PROTOCOL.due ? L("sgSameDay") : base.due, tone: "red", ref: base?.ref || DEFAULT_PROTOCOL.ref, steps };
  if (has(cat, "fgm")) return { ...p, who: L("sgFgmWho", { dsl: dslWho }), due: L("sgFgmDue"), steps: [L("sgFgmStep"), ...steps.slice(1)] };
  if (has(cat, "self-harm", "suicidal", "mental health")) return { ...p, due: L("sgSelfHarmDue"), steps: [L("sgSelfHarmStep"), ...steps] };
  if (has(cat, "exploitation", "modern slavery")) return { ...p, who: L("sgExploitWho", { dsl: dslWho }), due: L("sgExploitDue"), steps: [L("sgExploitStep"), ...steps.slice(1)] };
  if (has(cat, "welfare", "early help")) return { ...p, due: L("sgWelfareDue"), tone: "amber", steps: [L("sgWelfareStep"), ...steps.slice(1)] };
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
