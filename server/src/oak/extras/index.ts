// Extra teaching material that ships WITH a hand-built lesson, keyed by Oak lesson slug: curated flashcards, plus the
// lesson's worksheet as (a) the original PDF and (b) an interactive task (a short-answer quiz). The importer writes them
// with the lesson; a tutor can then set the worksheet as (optional) homework from the lesson page.
import { EXTRAS as tionCian } from "./spelling-words-with-the-suffixes-tion-and-cian";

export interface LessonExtras {
  flashcards: { front: string; back: string }[];
  worksheet: {
    title: string;
    instructions: string;
    /** File next to this module (the worksheet as Oak publishes it, exported to PDF). */
    pdfFile: string;
    questions: { prompt: string; answer: string; accepted?: string[]; explanation: string }[];
  };
}

export const EXTRAS_BY_LESSON: Record<string, LessonExtras> = {
  "spelling-words-with-the-suffixes-tion-and-cian": tionCian,
};
