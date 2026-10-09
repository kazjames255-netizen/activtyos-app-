import { relativeFrom } from "@/lib/i18n/format";
// Flashcards — shapes mirror server/src/routes/hub/flashcardsApi.ts (contract:
// docs/learning-hub.md → Flashcards). All spaced-repetition maths is server-side
// (SM-2): the browser sends a quality and displays what comes back.

export interface Card { id: string; franchiseId?: string | null; topicId: string; front: string; back: string; published: boolean; createdAt: string; updatedAt: string }

export interface QueueCard { id: string; topicId: string; front: string; back: string; isNew: boolean }
export interface DueResponse { due: QueueCard[]; dueCount: number; newCount: number; upcoming: number }
export interface ReviewResult { nextDueAt: string; intervalDays: number; easeFactor?: number; repetitions?: number }

export interface FlashStats {
  totalCards: number;
  publishedCards: number;
  topics: { topicId: string; subject: string; topic: string; subtopic: string | null; cards: number }[];
  /** `assigned` / `assignedReviewed`: cards given to the child (topic assignment or an assigned lesson) and how many of those they have reviewed; absent on an older server. */
  students: { childId: string; childName: string; cardsAvailable: number; reviewed: number; assigned?: number; assignedReviewed?: number; due: number; new: number; mastered: number; lastReviewedAt: string | null }[];
}

/** The rating scale the server accepts: 1 Again · 3 Hard · 4 Good · 5 Easy. `labelKey` / `hintKey` are i18n keys (resolve with t()). */
export const RATINGS = [
  { key: "1", quality: 1, labelKey: "hublessons.fcRatAgain", hintKey: "hublessons.fcHintAgain", tone: "red" },
  { key: "2", quality: 3, labelKey: "hublessons.fcRatHard", hintKey: "hublessons.fcHintHard", tone: "gold" },
  { key: "3", quality: 4, labelKey: "hublessons.fcRatGood", hintKey: "hublessons.fcHintGood", tone: "brand" },
  { key: "4", quality: 5, labelKey: "hublessons.fcRatEasy", hintKey: "hublessons.fcHintEasy", tone: "green" },
] as const;
export type Rating = (typeof RATINGS)[number];

/** "tomorrow", "in 6 days", "in 3 weeks" — display only, in the active language (Intl handles plural forms). */
export function intervalText(days: number, locale: string): string {
  const rtf = { format: (n: number, u: "day" | "week" | "month") => relativeFrom(n, u, locale) };
  if (days <= 1) return rtf.format(1, "day");
  if (days < 14) return rtf.format(days, "day");
  if (days < 60) return rtf.format(Math.round(days / 7), "week");
  return rtf.format(Math.round(days / 30), "month");
}

/** Bulk-add: one card per line, "front | back" (a tab also works). */
export function parseBulk(text: string): { cards: { front: string; back: string }[]; bad: number[] } {
  const cards: { front: string; back: string }[] = [];
  const bad: number[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const at = line.includes("|") ? line.indexOf("|") : line.indexOf("\t");
    const front = at > 0 ? line.slice(0, at).trim() : "";
    const back = at > 0 ? line.slice(at + 1).trim() : "";
    if (front && back) cards.push({ front: front.slice(0, 1000), back: back.slice(0, 2000) });
    else bad.push(i + 1);
  });
  return { cards, bad };
}
