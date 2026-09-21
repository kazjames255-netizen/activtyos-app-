// Interactive lessons — the structured `lesson` field of a hubNotes doc (contract: docs/oak-import.md, docs/learning-hub.md
// "Lessons"). The importer and tutors may write it slightly differently (Oak-shaped `{keyword, description}` vs the short
// `{k, d}`; `steps` vs `points`), so everything the player renders goes through `normalizeLesson` first.

import { normalizeSlides, type Slide } from "./slides/types";
import { normalizePlan, type LessonPlan } from "./plan";

export interface LessonSource { provider?: string; url?: string; licence?: string; attribution?: string; programmes?: string[]; fetchedAt?: string }

/** What is stored / sent. Loose on purpose — see normalizeLesson. */
export interface LessonRaw {
  v?: number;
  subject?: string; keyStage?: string; year?: string | number; unit?: string; title?: string;
  outcome?: string;
  /** The key learning points, one card each. Strings, or `{text}`/`{keyLearningPoint}` objects. */
  steps?: unknown[];
  points?: unknown[];
  outline?: unknown[];
  keywords?: unknown[];
  /** Tutors only — the server strips both from what a family receives. */
  misconceptions?: unknown[];
  teacherTips?: unknown[];
  /** LEGACY: older imports stored Oak's raw video transcript here. It is no longer written and never shown (the `plan` replaces it). */
  transcript?: unknown[];
  /** The step-by-step lesson plan (lesson/plan.ts). Tutors only get commonMistakes / watchOut, the server strips them for families. */
  plan?: unknown;
  warmupQuestionIds?: string[];
  quizId?: string | null;
  /** Id of the interactive "Explore" widget (features/learninghub/lesson/widgets), or null/absent for none. */
  widget?: string | null;
  /** A slide-deck lesson: the teaching itself as interactive slides (features/learninghub/lesson/slides). */
  slides?: unknown[];
  /** Oak's REAL slide deck imported as editable canvas slides (server/src/oak/deckConvert.ts); shown instead of the embedded deck when present. */
  deckSlides?: unknown[];
  /** Google Slides id of Oak's own deck for this lesson (Oak publishes every deck as a public Google Slides file); the player embeds it. */
  oakDeck?: string;
  /** The lesson's worksheet: a note carrying the PDF + an interactive quiz version (both linked from here). */
  worksheet?: { noteId?: string; assessmentId?: string; title?: string };
  source?: LessonSource;
}

export interface LessonKeyword { keyword: string; description: string }
export interface LessonMisconception { misconception: string; response: string }

export interface Lesson {
  subject: string; keyStage: string; year: string; unit: string; title: string;
  outcome: string; points: string[]; outline: string[]; keywords: LessonKeyword[];
  misconceptions: LessonMisconception[]; teacherTips: string[];
  /** The simplified step-by-step plan, or null (a lesson without one shows no plan). */
  plan: LessonPlan | null;
  warmupQuestionIds: string[]; quizId: string | null; widget: string | null;
  slides: Slide[];
  /** Oak's real deck as our own editable canvas slides (one canvas per slide); preferred over the embedded deck / summary slides when present. */
  deckSlides: Slide[];
  /** Oak's real slide deck (Google Slides id), shown in the player when present. */
  oakDeck: string | null;
  source: LessonSource;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const pick = (o: unknown, ...keys: string[]): string => {
  if (typeof o === "string") return o.trim();
  if (o && typeof o === "object") for (const k of keys) { const v = str((o as Record<string, unknown>)[k]); if (v) return v; }
  return "";
};
const list = (a: unknown, ...keys: string[]): string[] => (Array.isArray(a) ? a.map((x) => pick(x, ...keys)).filter(Boolean) : []);

export function normalizeLesson(raw: unknown, fallbackTitle = ""): Lesson {
  const r = (raw && typeof raw === "object" ? raw : {}) as LessonRaw;
  const keywords: LessonKeyword[] = Array.isArray(r.keywords)
    ? r.keywords.map((k) => ({ keyword: pick(k, "keyword", "k", "term"), description: pick(k, "description", "d", "definition") })).filter((k) => k.keyword)
    : [];
  const misconceptions: LessonMisconception[] = Array.isArray(r.misconceptions)
    ? r.misconceptions.map((m) => ({ misconception: pick(m, "misconception", "m"), response: pick(m, "response", "r") })).filter((m) => m.misconception)
    : [];
  const points = list(r.steps?.length ? r.steps : r.points, "text", "keyLearningPoint", "point");
  const src = r.source && typeof r.source === "object" ? r.source : {};
  return {
    subject: str(r.subject), keyStage: str(r.keyStage), year: str(r.year), unit: str(r.unit), title: str(r.title) || fallbackTitle,
    outcome: str(r.outcome), points, outline: list(r.outline, "text", "lessonOutline"), keywords,
    misconceptions, teacherTips: list(r.teacherTips, "teacherTip", "text"), plan: normalizePlan(r.plan),
    warmupQuestionIds: Array.isArray(r.warmupQuestionIds) ? r.warmupQuestionIds.filter((x): x is string => typeof x === "string") : [],
    quizId: str(r.quizId) || null, widget: str(r.widget) || null, slides: normalizeSlides(r.slides), deckSlides: normalizeSlides(r.deckSlides), oakDeck: /^[A-Za-z0-9_-]{20,80}$/.test(str(r.oakDeck)) ? str(r.oakDeck) : null, source: src,
  };
}

/** The wording Oak's licence asks for ("A {subject} lesson by Oak National Academy licensed under Open Government Licence (OGL)"). */
export const OGL_URL = "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/";
export const isOak = (l: Lesson) => (l.source.provider ?? "").toLowerCase() === "oak" || /oaknational/i.test(l.source.url ?? "");
