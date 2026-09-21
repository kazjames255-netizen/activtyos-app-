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
  students: { childId: string; childName: string; cardsAvailable: number; reviewed: number; due: number; new: number; mastered: number; lastReviewedAt: string | null }[];
}

/** The rating scale the server accepts: 1 Again · 3 Hard · 4 Good · 5 Easy. */
export const RATINGS = [
  { key: "1", quality: 1, label: "Again", hint: "Didn't know it", tone: "red" },
  { key: "2", quality: 3, label: "Hard", hint: "Got it, but struggled", tone: "gold" },
  { key: "3", quality: 4, label: "Good", hint: "Knew it", tone: "brand" },
  { key: "4", quality: 5, label: "Easy", hint: "Too easy", tone: "green" },
] as const;
export type Rating = (typeof RATINGS)[number];

/** "tomorrow", "in 6 days", "in 3 weeks" — display only. */
export function intervalText(days: number): string {
  if (days <= 1) return "tomorrow";
  if (days < 14) return `in ${days} days`;
  if (days < 60) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30)} months`;
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
