// Automatic tool suggestions: rules over a lesson's subject / year / unit / title / learning objective → ranked tools, each with a reason.
// Deterministic, no AI, no database — the same input always gives the same answer, so it can be tested against the real library.

export type Field = "title" | "unit" | "objective";
/** What we know about a lesson (or a question) when suggesting tools. */
export interface Signal {
  /** maths · english · science · languages (or a free-text subject a tutor typed — matched loosely). */
  subject: string;
  /** School year 1–13 when known. */
  year: number | null;
  title: string;
  /** The Oak unit, as words ("fractions of amounts") — parse it from the lesson URL with unitFromKey(). */
  unit: string;
  /** The learning objective ("I can …") or a question stem. */
  objective: string;
  /** Oak programme slug, when known (gives KS, exam board, biology/chemistry/physics, French/German/Spanish for free). */
  programme?: string;
}

export interface Rule {
  /** Unique, stable id — shown in the "why" and used by tests ("maths.protractor.1"). */
  id: string;
  /** A tool id from the registry (M-02, S-15, L-03…). */
  tool: string;
  /** 0–1: how sure this rule is. Specific rules 0.8–1; catch-alls 0.2–0.4. */
  weight: number;
  /** Case-insensitive regex sources; the rule fires if ANY matches one of `fields`. */
  any: string[];
  /** Fires only if NONE of these match (kills known false positives, e.g. "non-chronological" for timelines). */
  none?: string[];
  /** Which text to look in. Default: title, unit and objective. */
  fields?: Field[];
  /** Only for these subjects (lower-case). Absent = any subject. */
  subject?: string[];
  /** Only for years [from, to] inclusive. Absent = any year. */
  years?: [number, number];
  /** Only when the Oak programme slug matches this regex (e.g. "^biology|combined"). */
  programme?: string;
  /** Plain-words reason shown to the tutor ("Suggested because…"); optional — falls back to the matched words. */
  why?: string;
}

export interface RuleSet {
  version: string;
  rules: Rule[];
  /** Tools to show when nothing matches, by subject, then "*" for everything else. Already ordered. */
  fallback: Record<string, string[]>;
}

export interface Suggestion {
  tool: string;
  score: number;
  /** Why: the rule, the field it matched and the words that matched — shown as "Suggested because…". */
  why: { rule: string; field: Field | "fallback" | "pinned"; match: string; text?: string };
  source: "rule" | "fallback" | "pinned";
}

/** A tutor's own choices for one lesson: pinned tools always come first; hidden ones never appear. */
export interface Overrides { pin?: string[]; hide?: string[] }
