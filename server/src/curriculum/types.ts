// Curriculum content format — shared by every subject/key-stage content file and the seeder.
// Source spec: docs/curriculum-ks2-maths-spec.txt (DfE National Curriculum, Open Government Licence v3.0).
// Content is ORIGINAL (written for ActivityOS), aligned to the published objectives. It is plain typed DATA:
// no Firestore, no side effects. `validate.ts` checks every file; the seeder turns it into hub docs.

/** School year 1–13 (Reception is not covered). KS1 = 1–2, KS2 = 3–6, KS3 = 7–9, KS4 = 10–11 (GCSE), KS5 = 12–13 (A-level). */
export type Year = number;
export const keyStageOf = (y: number) => (y <= 2 ? "KS1" : y <= 6 ? "KS2" : y <= 9 ? "KS3" : y <= 11 ? "KS4" : "KS5");
/** single/multi = choice (auto-marked); short = typed answer (auto-marked against `answer`/`accepted`); number = numeric (auto-marked);
 *  written = an extended answer a TUTOR marks (use sparingly: at most 1 per quiz, KS3+ only; put the mark scheme in `explanation`). */
export type CKind = "single" | "multi" | "short" | "number" | "written";

export interface CQuestion {
  /** Stable, globally unique key, e.g. "npv-y6-03" (topic-abbrev, year, running number). Never reuse or renumber. */
  key: string;
  kind: CKind;
  /** Child-facing wording. Plain text; use unicode for maths (×, ÷, ½, ², °, £) — no LaTeX, no HTML. */
  prompt: string;
  /** single / multi: 3–5 option texts (the spec's samples use 4). Distinct, plausible distractors from real misconceptions. */
  options?: string[];
  /** single: the EXACT text of the one right option. multi: the exact texts of every right option (≥2, fewer than all).
   *  short: the expected text answer. number: the numeric answer. */
  answer: string | string[] | number;
  /** short: other accepted spellings/forms ("5/6", "five sixths"). */
  accepted?: string[];
  /** number: allowed absolute error (default 0). */
  tolerance?: number;
  /** 1–2 sentences a 9–11 year old can follow; states the METHOD, not just the answer. Mandatory. */
  explanation: string;
  /** 1 = secure recall, 2 = standard for the year, 3 = stretch / multi-step. Aim for roughly 3 : 5 : 2 per quiz. */
  difficulty: 1 | 2 | 3;
  /** Default 1. */
  marks?: number;
  /** True on 2 representative questions per topic-year: eligible for that year's placement (diagnostic) paper. */
  diagnostic?: boolean;
  /** Optional picture (PNG in scratch/curriculum-images/ks2maths/, ≤200KB) + REQUIRED alt text. */
  image?: { file: string; alt: string };
}

export interface CYear {
  /** The school year this content is filed under (the subtopic row is "Year N" unless `subtopic` says otherwise). */
  year: Year;
  /** Optional subtopic label override for combined phases, e.g. "GCSE (Years 10–11)" or "A-level (Years 12–13)". Default "Year N". */
  subtopic?: string;
  /** Year groups the quiz/notes are aimed at (audience). Default [year]. For "GCSE (Years 10–11)" use [10, 11]. */
  yearsCovered?: number[];
  /** The DfE objectives this content covers (condensed, as in the spec). */
  objectives: string[];
  /** A course note in markdown (headings, lists, **bold**, tables; no HTML): what to know + 2–3 worked examples. ≥120 words. */
  note: { title: string; body: string };
  /** The topic-year quiz: 10 questions (8–12 allowed). */
  quiz: { title: string; questions: CQuestion[] };
  /** 8–12 cards: short prompt on the front, a crisp answer/rule on the back. */
  flashcards: { front: string; back: string }[];
}

export interface CTopic {
  /** Short stable key, e.g. "npv". Files in different packs that share the same `key` + `topic` are MERGED by the seeder (that's how KS1 and KS3 join the KS2 files). */
  key: string;
  /** Exactly as in the taxonomy you were given, e.g. "Number & Place Value". */
  topic: string;
  /** "Maths" | "English" | "Science" | "French" | "Spanish" | "German" (the hub's subject label). */
  subject: string;
  years: Partial<Record<Year, CYear>>;
  /** Years the programme of study does not introduce (spec says so): no content, just the reason. */
  notIntroduced?: Partial<Record<Year, string>>;
}
