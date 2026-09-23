// Learning Hub settings — pure data + a merge, no imports, so BOTH the portal
// (lib/settings.ts) and the API (server/src/lib/hubCore.ts) read the same shape
// and the same defaults. Same pattern as lib/accessMap.ts.

/** How a tenant's Learning Hub marks and bands work. Merged over HUB_DEFAULTS by
 *  `withDefaults` (client) and `hubConfig` (server) — a tenant that never opened
 *  the settings still gets a complete, working config. */
export interface HubSettings {
  /** The question types a tutor can author. `mark` picks the (server-side)
   *  marking rule: choice = one right option, multi = all-right, exact = text
   *  match (trimmed, case-insensitive), numeric = within tolerance, match = every
   *  term paired with its definition, order = items in the exact sequence,
   *  manual = a tutor marks it. Tenants may rename, reorder or drop kinds. */
  questionKinds: { id: string; label: string; mark: "choice" | "multi" | "exact" | "numeric" | "match" | "order" | "tool" | "manual" }[];
  /** Default pass mark (%) for a new quiz. */
  passMarkPct: number;
  /** When true, a child must sit (or be waived from) the placement test for a
   *  subject before its quizzes are available. */
  requireDiagnostic: boolean;
  /** When a student sees the right answers + explanations. "after_pass" (the default) = only once that attempt reached the pass mark
   *  (or the child has passed the quiz before), so a failed attempt can't be used to read the key off and re-sit it. Tutors always see them. */
  revealAnswers: "after_pass" | "after_submit" | "after_marked" | "never";
  /** Mastery labels, lowest first: a topic scoring >= min gets that label. */
  masteryBands: { min: number; label: string }[];
  /** Days between assigning homework and its default due date. */
  homeworkDueDays: number;
  /** Spaced repetition: an ease factor never drops below this (SM-2 floor). */
  srsMinEase: number;
  /** Retakes of a quiz / placement test the same child has already finished:
   *  "unlimited" = any time; "once" = never again unless the tutor allows it;
   *  "cooldown" = again after `retakeCooldownHours`. A single assessment can override it. */
  retakePolicy: "unlimited" | "once" | "cooldown";
  retakeCooldownHours: number;
  /** Under "unlimited" retakes: after this many not-passed attempts IN A ROW at the same quiz, every further go waits `retakeBreakMinutes`
   *  (a short "go back over the lesson first" break). 0 = off. A tutor's one-more-go grant skips it. */
  retakeBreakAfter: number;
  retakeBreakMinutes: number;
  /** The year groups a tutor can aim a quiz / placement test at (and tag a student with).
   *  Free text per tenant — a music teacher might use "Grade 1".."Grade 8". */
  yearGroups: string[];
  /** The colour a tutor chose for a subject, everywhere in the hub: `subjectColourKey(name)` -> one of SUBJECT_PALETTE_KEYS.
   *  A subject with no entry wears its default colour (features/learninghub/subjectColour.ts). */
  subjectColours: Record<string, string>;
}

/** The colour choices a subject can wear (ids only — the actual colours live in features/learninghub/subjectColour.ts). */
export const SUBJECT_PALETTE_KEYS = ["blue", "green", "red", "purple", "orange", "teal", "pink", "amber", "indigo", "slate"] as const;
export const SUBJECT_COLOURS_MAX = 80;
/** A subject's stable key in `subjectColours`: trimmed, whitespace-collapsed, lower-cased. */
export const subjectColourKey = (subject: string) => subject.trim().replace(/\s+/g, " ").toLowerCase().slice(0, 60);
/** Keep only well-formed entries (key of 1-60 characters -> a known palette key). Used on every read so a bad stored value can never reach a screen. */
export function cleanSubjectColours(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = subjectColourKey(k);
    if (key && typeof v === "string" && (SUBJECT_PALETTE_KEYS as readonly string[]).includes(v) && Object.keys(out).length < SUBJECT_COLOURS_MAX) out[key] = v;
  }
  return out;
}

export const HUB_DEFAULTS: HubSettings = {
  questionKinds: [
    { id: "single", label: "Single choice", mark: "choice" },
    { id: "multi", label: "Multiple choice", mark: "multi" },
    { id: "short", label: "Short answer", mark: "exact" },
    { id: "number", label: "Number", mark: "numeric" },
    { id: "match", label: "Matching pairs", mark: "match" },
    { id: "order", label: "Put in order", mark: "order" },
    { id: "tool", label: "Tool question (ruler, protractor, grid…)", mark: "tool" },
    { id: "written", label: "Written answer (tutor marks)", mark: "manual" },
  ],
  passMarkPct: 70,
  requireDiagnostic: false,
  revealAnswers: "after_pass",
  masteryBands: [{ min: 0, label: "Learning" }, { min: 50, label: "Developing" }, { min: 80, label: "Secure" }],
  homeworkDueDays: 7,
  srsMinEase: 1.3,
  retakePolicy: "unlimited",
  retakeCooldownHours: 24,
  retakeBreakAfter: 3,
  retakeBreakMinutes: 30,
  yearGroups: ["Reception", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6", "Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12", "Year 13"],
  subjectColours: {},
};

const LEGACY_KIND_IDS = ["single", "multi", "short", "number", "written"];

/** A tenant list saved BEFORE the match / order kinds existed — recognisably the old five defaults,
 *  with neither new rule — gets them slotted in ahead of the written kind, so imported and authored
 *  matching / ordering questions work without anyone re-saving Setup. Any other list (a tenant that
 *  customised its own kinds) is left exactly as written. */
function withNewKinds(list: HubSettings["questionKinds"]): HubSettings["questionKinds"] {
  if (!LEGACY_KIND_IDS.every((id) => list.some((k) => k.id === id))) return list;
  const has = (m: string, id: string) => list.some((k) => k.mark === m || k.id === id);
  const add = HUB_DEFAULTS.questionKinds.filter((k) => (k.mark === "match" || k.mark === "order" || k.mark === "tool") && !has(k.mark, k.id));
  if (!add.length) return list;
  const at = list.findIndex((k) => k.mark === "manual");
  return at < 0 ? [...list, ...add] : [...list.slice(0, at), ...add, ...list.slice(at)];
}

/** Stored settings.hub (possibly partial or absent) over the defaults. Arrays
 *  are taken whole when present and non-empty — a tenant that renames a question
 *  kind owns the whole list, it isn't merged item by item. */
export function mergeHub(stored: Partial<HubSettings> | null | undefined): HubSettings {
  const s = stored ?? {};
  return {
    ...HUB_DEFAULTS,
    ...s,
    questionKinds: s.questionKinds?.length ? withNewKinds(s.questionKinds) : HUB_DEFAULTS.questionKinds,
    masteryBands: s.masteryBands?.length ? [...s.masteryBands].sort((a, b) => a.min - b.min) : HUB_DEFAULTS.masteryBands,
    yearGroups: s.yearGroups?.length ? s.yearGroups : HUB_DEFAULTS.yearGroups,
    subjectColours: cleanSubjectColours(s.subjectColours),
  };
}
