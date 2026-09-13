// The reference questions. Editable per provider (⚙ on the References step,
// saved to settings.referenceQuestions) with the defaults below as the starting
// point — so this file is the template, not the law.
//
// Three consumers: the referee's public form, the operator's "taken by phone"
// modal, and the read-back on the onboarding record. They all render whichever
// set the REQUEST was created with: every request stores a snapshot of the
// questions it was sent under (see server/src/routes/references.ts), so editing
// the set never rewrites what an earlier referee was actually asked.
//
// ── The safeguarding lock ──────────────────────────────────────────────────
// `flagsConcern` decides whether a returned reference blocks cleared-to-start,
// and the SERVER imports this same function — one implementation, so the gate
// can't disagree with the form. A concern is no longer "the answer was yes":
// it's "the answer is one the provider marked as a concern", which is what lets
// them reword the options freely. LOCKED_IDS can't be deleted and must keep at
// least one concern option, or the gate could be switched off by editing a
// dropdown. See validateSections.

export type RefKind = "text" | "month" | "long" | "choice";

export interface RefQuestion {
  id: string;
  kind: RefKind;
  label: string;
  hint?: string;
  required?: boolean;
  /** choice only — the pills the referee picks from. */
  options?: string[];
  /** Options that mean "this person may not be safe with children". */
  concernOptions?: string[];
  /** Options that open a compulsory "please give details" box. */
  detailsOn?: string[];
  detailsLabel?: string;
  /** A safeguarding question: rewordable and reorderable, never removable. */
  locked?: boolean;
}

export interface RefSection { id: string; title: string; icon: string; blurb?: string; questions: RefQuestion[] }

/** The default rating scale. Per-question, so a provider can give one question
 *  its own wording without dragging the rest with it. */
export const RATINGS = ["Excellent", "Good", "Satisfactory", "Some concerns", "Can't comment"];
export const YES_NO = ["Yes", "No"];

/** The three that carry the gate. */
export const LOCKED_IDS = ["q_suitability", "q_disciplinary", "q_notSuitable"];

export const DEFAULT_REFERENCE_SECTIONS: RefSection[] = [
  {
    id: "how",
    title: "How you know them",
    icon: "👥",
    blurb: "Just enough to confirm the reference is about the right person and the right job.",
    questions: [
      { id: "q_capacity", kind: "text", label: "In what capacity do you know them?", hint: "e.g. I was their line manager", required: true },
      { id: "q_org", kind: "text", label: "Organisation" },
      { id: "q_jobTitle", kind: "text", label: "Their job title with you" },
      { id: "q_from", kind: "month", label: "Employed from" },
      { id: "q_to", kind: "month", label: "Employed until", hint: "Leave blank if they still work with you." },
      { id: "q_leaving", kind: "long", label: "Reason for leaving", hint: "If they're still with you, just say so." },
    ],
  },
  {
    id: "work",
    title: "How they worked",
    icon: "⭐",
    blurb: "Your honest read. “Can't comment” is a perfectly good answer.",
    questions: [
      { id: "q_r_reliability", kind: "choice", label: "Reliability & punctuality", options: RATINGS },
      { id: "q_r_children", kind: "choice", label: "Working with children", options: RATINGS },
      { id: "q_r_team", kind: "choice", label: "Working with colleagues", options: RATINGS },
      { id: "q_r_communication", kind: "choice", label: "Communication", options: RATINGS },
      {
        id: "q_reemploy",
        kind: "choice",
        label: "Would you re-employ them?",
        options: ["Yes", "Yes, with reservations", "No", "Can't say — not my decision"],
        required: true,
        detailsOn: ["Yes, with reservations", "No", "Can't say — not my decision"],
        detailsLabel: "Please tell us why",
      },
      { id: "q_absence", kind: "text", label: "Days of sickness absence in the last 12 months", hint: "Only if you're able to share it — leave blank if not." },
    ],
  },
  {
    id: "safeguarding",
    title: "Safeguarding",
    icon: "🛡️",
    blurb: "These are the reason references are asked for at all. Please answer them even if the answer is uncomfortable — you're protected in giving a fair, factual reference.",
    questions: [
      {
        id: "q_suitability",
        kind: "choice",
        label: "Are you aware of anything that makes you doubt this person's suitability to work with children?",
        options: YES_NO,
        required: true,
        locked: true,
        concernOptions: ["Yes"],
        detailsOn: ["Yes"],
        detailsLabel: "Please give details",
      },
      {
        id: "q_disciplinary",
        kind: "choice",
        label: "Have they been the subject of any disciplinary procedure, allegation or investigation relating to children or vulnerable adults?",
        hint: "Including where the allegation was not substantiated — please say so if that's the case.",
        options: YES_NO,
        required: true,
        locked: true,
        concernOptions: ["Yes"],
        detailsOn: ["Yes"],
        detailsLabel: "Please give details, and the outcome",
      },
      {
        id: "q_notSuitable",
        kind: "choice",
        label: "Is there any other reason they should not work with children?",
        options: YES_NO,
        required: true,
        locked: true,
        concernOptions: ["Yes"],
        detailsOn: ["Yes"],
        detailsLabel: "Please give details",
      },
    ],
  },
  {
    id: "more",
    title: "Anything else",
    icon: "💬",
    questions: [
      { id: "q_comments", kind: "long", label: "Any other comments", hint: "Strengths, where they'd need support, anything you'd want to know if you were hiring them." },
    ],
  },
];

export const allQuestions = (sections: RefSection[]): RefQuestion[] => sections.flatMap((s) => s.questions);

/** The extra free-text key a question's "please give details" box writes to. */
export const detailsKey = (id: string) => `${id}_why`;

/** Is this question showing its details box, given the current answers? */
export const needsDetails = (q: RefQuestion, answers: Record<string, string>): boolean =>
  !!q.detailsOn?.length && q.detailsOn.includes(answers[q.id] ?? "");

/** Does this answer set flag a safeguarding concern? Shared with the server —
 *  the gate and the form must never disagree about what counts. */
export function flagsConcern(sections: RefSection[], answers: Record<string, string>): boolean {
  return allQuestions(sections).some((q) => (q.concernOptions ?? []).includes(answers[q.id] ?? ""));
}

/** Everything compulsory that hasn't been answered — the question, plus any
 *  details box its answer opened. */
export function missingAnswers(sections: RefSection[], answers: Record<string, string>): string[] {
  const out: string[] = [];
  for (const q of allQuestions(sections)) {
    if (q.required && !(answers[q.id] ?? "").trim()) out.push(q.label);
    else if (needsDetails(q, answers) && !(answers[detailsKey(q.id)] ?? "").trim()) out.push(`${q.label} — details`);
  }
  return out;
}

/** Why this edited set can't be saved. Empty means it's fine.
 *
 *  The safeguarding rules are the point: a provider may reword those three
 *  however they like, but they can't remove them and can't leave them with no
 *  answer that counts as a concern — that would silently disable the
 *  cleared-to-start gate, which is the worst failure this feature has. */
export function validateSections(sections: RefSection[]): string[] {
  const problems: string[] = [];
  const qs = allQuestions(sections);
  const ids = new Set<string>();

  for (const id of LOCKED_IDS) {
    const q = qs.find((x) => x.id === id);
    if (!q) { problems.push("A safeguarding question is missing — those three can't be removed."); continue; }
    if (!(q.concernOptions ?? []).length) {
      problems.push(`“${q.label.slice(0, 60)}…” needs at least one answer marked as a concern — that's what puts someone on hold.`);
    }
    if ((q.concernOptions ?? []).some((o) => !(q.options ?? []).includes(o))) {
      problems.push(`“${q.label.slice(0, 60)}…” marks an answer as a concern that isn't one of its options.`);
    }
  }
  for (const q of qs) {
    if (!q.label.trim()) problems.push("Every question needs a label.");
    if (ids.has(q.id)) problems.push(`Two questions share the id “${q.id}”.`);
    ids.add(q.id);
    if (q.kind === "choice" && !(q.options ?? []).length) problems.push(`“${q.label}” is a multiple-choice question with no options.`);
  }
  if (!sections.length) problems.push("Keep at least one section.");
  return [...new Set(problems)];
}

/** A stable id for a newly added question/section. Not random — Date.now keeps
 *  them ordered and readable in the stored JSON. */
export const newId = (prefix: string, n: number) => `${prefix}_${n.toString(36)}`;
