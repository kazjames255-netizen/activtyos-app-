// Hand-built interactive slide decks, keyed by Oak lesson slug. The importer attaches `slides` to the lesson when one exists
// (the raw transcript is never stored any more; the lesson plan, plans/, replaces it). Format: features/learninghub/lesson/slides/types.ts.
import { SLIDES as tionCian } from "./spelling-words-with-the-suffixes-tion-and-cian";

export const SLIDES_BY_LESSON: Record<string, unknown[]> = {
  "spelling-words-with-the-suffixes-tion-and-cian": tionCian,
};
