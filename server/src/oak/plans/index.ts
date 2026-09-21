// Hand-written lesson plans, keyed by Oak lesson slug (same precedence idea as slides/): a hand-written plan replaces the plan the
// generator would derive. Format: features/learninghub/lesson/plan.ts (LessonPlan). Every fact must be re-verified against the lesson
// dossier (`cd server && npx tsx src/oak/factory/cli.ts dossier <unit__lesson>`); `plancli.ts plans` validates them all.
// (Curated lessons instead carry an optional `plan` inside curated/<unit>__<lesson>.json.)
import type { LessonPlan } from "../../../../features/learninghub/lesson/plan";
import { PLAN as tionCian } from "./spelling-words-with-the-suffixes-tion-and-cian";

export const PLANS_BY_LESSON: Record<string, LessonPlan> = {
  "spelling-words-with-the-suffixes-tion-and-cian": tionCian,
};
