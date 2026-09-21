// Lesson factory: raw Oak lesson -> slide deck (generated) with the curated override lane.
//   precedence for a lesson's deck:  hand-built (slides/*.ts, keyed by lessonSlug)  >  curated (curated/<unit>__<lesson>.json, agent-authored)  >  generated
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDeck, type KW } from "./generate";
import { cleanPoints, cleanKeywords, cleanOutline, tidy } from "./quality";
import { LANG_SUBJECTS } from "./clozeGuard";
import { validateDeck } from "./validate";
import { applyArtPolicy, verifyArt } from "./art/select";
import type { ArtContext } from "./art/types";
import type { Slide } from "../../../../features/learninghub/lesson/slides/types";
import { derivePlan, validatePlan, planFactsFromRaw, planSourceFromRaw, planTexts } from "./plan";
import { normalizePlan, type LessonPlan } from "../../../../features/learninghub/lesson/plan";
import { PLANS_BY_LESSON } from "../plans";

const here = path.dirname(fileURLToPath(import.meta.url));
export const CURATED_DIR = path.resolve(here, "../curated");

type Cm = (s: string) => string;
export interface Facts { outcome: string; points: string[]; keywords: KW[]; outline: string[] }

/** The lesson facts the generator + validator use, straight from the raw crawler object (LaTeX made readable via `cm`). */
export function factsFromRaw(o: Record<string, unknown>, cm: Cm): Facts {
  const arr = <T>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);
  const t = (v: unknown) => tidy(cm(String(v ?? ""))).trim();
  // quality.ts: tidied text, Oak's known errors corrected / dropped, blanks + teacher directives + lesson references left out, swapped definitions dropped
  return {
    outcome: t(o.pupilLessonOutcome),
    points: cleanPoints(arr<{ keyLearningPoint?: string }>(o.keyLearningPoints).map((x) => t(x.keyLearningPoint)).filter(Boolean)),
    keywords: cleanKeywords(arr<{ keyword?: string; description?: string }>(o.lessonKeywords).map((x) => ({ k: t(x.keyword), d: t(x.description) })).filter((x) => x.k)),
    outline: cleanOutline(arr<{ lessonOutline?: string }>(o.lessonOutline).map((x) => t(x.lessonOutline)).filter(Boolean)),
  };
}

export interface CuratedExtras {
  flashcards?: { front: string; back: string }[];
  worksheet?: { title: string; instructions: string; pdfFile?: string; questions: { prompt: string; answer: string; accepted?: string[]; explanation: string }[] };
}
export interface Curated extends CuratedExtras { slides?: unknown[]; agent?: string; /** Optional hand-written lesson plan (features/learninghub/lesson/plan.ts). Absent = the derived plan is used. */ plan?: unknown }

const curatedCache = new Map<string, Curated | null>();
export function curatedFor(unitSlug: string, lessonSlug: string): Curated | null {
  const key = `${unitSlug}__${lessonSlug}`;
  if (curatedCache.has(key)) return curatedCache.get(key)!;
  let c: Curated | null = null;
  try { c = JSON.parse(fs.readFileSync(path.join(CURATED_DIR, `${key}.json`), "utf8")) as Curated; } catch { /* none */ }
  curatedCache.set(key, c);
  return c;
}

export interface DeckResult { slides: unknown[]; source: "generated" | "curated"; problems: string[] }
/** The factory deck for one lesson (generated, or the curated override). Invalid decks are not returned: `slides` is [] and
 *  `problems` says why, so the importer falls back to the plain (non-slide) lesson. */
export function deckFor(o: Record<string, unknown>, opts: { cm: Cm; subject: string; unitTitle: string; lessonTitle: string; pool: KW[]; seed: string; unitSlug: string; lessonSlug: string }): DeckResult {
  const facts = factsFromRaw(o, opts.cm);
  const own = new Set(facts.keywords.map((x) => x.k.toLowerCase()));
  const cur = curatedFor(opts.unitSlug, opts.lessonSlug);
  const artCtx: ArtContext = { subject: opts.subject, discipline: String(o.subjectTitle ?? ""), keyStage: String(o.keyStageSlug ?? ""), lessonTitle: opts.lessonTitle, unitTitle: opts.unitTitle, keywords: facts.keywords.map((k) => k.k) };
  if (cur?.slides?.length) {
    // picture policy: the author's art is never trusted; only verified pictures / literal emoji survive (art/select.ts)
    const slides = applyArtPolicy(cur.slides as Slide[], artCtx);
    const problems = [...validateDeck(slides, undefined, true), ...verifyArt(slides, artCtx)];
    return problems.length ? { slides: [], source: "curated", problems } : { slides, source: "curated", problems };
  }
  const built = buildDeck({ lessonTitle: opts.lessonTitle, unitTitle: opts.unitTitle, subject: opts.subject, outcome: facts.outcome, points: facts.points, keywords: facts.keywords, outline: facts.outline, pool: opts.pool.filter((x) => !own.has(x.k.toLowerCase())), seed: opts.seed });
  if (!built.length) return { slides: [], source: "generated", problems: ["not enough source facts (no key learning points / <2 keyword definitions)"] };
  const slides = applyArtPolicy(built, artCtx);
  const problems = [...validateDeck(slides, { points: facts.points, outcome: facts.outcome, keywords: facts.keywords, pool: opts.pool.filter((x) => !own.has(x.k.toLowerCase())), strict: LANG_SUBJECTS.has(opts.subject) }), ...verifyArt(slides, artCtx)];
  return problems.length ? { slides: [], source: "generated", problems } : { slides, source: "generated", problems };
}

export interface PlanResult { plan: LessonPlan | null; source: "hand" | "curated" | "derived" | ""; problems: string[] }
/** The lesson plan for one lesson: hand-written (plans/<lessonSlug>.ts) > curated JSON `plan` > derived from Oak's structured facts.
 *  An invalid plan is never returned (`plan` null + `problems`): the lesson is then imported without one. `slideText` = Oak's slide-deck text
 *  (only used as extra source text for the number check of hand-written plans). */
export function planFor(o: Record<string, unknown>, opts: { cm: Cm; unitSlug: string; lessonSlug: string; hasWarmup: boolean; slideText?: () => string }): PlanResult {
  const hand = PLANS_BY_LESSON[opts.lessonSlug];
  const cur = curatedFor(opts.unitSlug, opts.lessonSlug);
  const written = hand ?? cur?.plan;
  if (written) {
    const plan = normalizePlan({ ...(written as object), source: "curated" });
    const problems = plan ? validatePlan(plan, planSourceFromRaw(o, opts.cm, opts.slideText?.() ?? ""), "curated") : ["hand-written plan has no usable steps"];
    return problems.length ? { plan: null, source: hand ? "hand" : "curated", problems } : { plan, source: hand ? "hand" : "curated", problems };
  }
  const src = planSourceFromRaw(o, opts.cm);
  const raw = derivePlan(src, { hasWarmup: opts.hasWarmup });
  if (!raw) return { plan: null, source: "derived", problems: ["not enough source facts for a plan"] };
  const plan = normalizePlan(raw);
  const problems = plan ? validatePlan(plan, src, "derived") : ["plan has no usable steps"];
  // normalizePlan must not change a derived plan (clipping / dropping would break traceability)
  if (plan && JSON.stringify(planTexts(plan)) !== JSON.stringify(planTexts(raw))) problems.push("plan changed by normalizePlan (a string was clipped or dropped)");
  return problems.length || !plan ? { plan: null, source: "derived", problems } : { plan, source: "derived", problems };
}
export { planFactsFromRaw };

const SLIDE_TEXT_DIR = path.resolve(here, "../../../../scratch/oak-slides");
/** Oak's crawled slide-deck + worksheet text for one raw lesson ("" when not crawled): extra source text for the number check of hand-written plans. */
export function slideTextFor(o: Record<string, unknown>): string {
  const name = `${String(o.subjectTitle).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${o.keyStageSlug}/${o.unitSlug}__${o.lessonSlug}`;
  try { const r = JSON.parse(fs.readFileSync(path.join(SLIDE_TEXT_DIR, `${name}.json`), "utf8")) as { presentation?: string; worksheet?: string }; return `${r.presentation ?? ""}\n${r.worksheet ?? ""}`; } catch { return ""; }
}
