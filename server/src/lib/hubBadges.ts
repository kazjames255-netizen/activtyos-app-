// Learning Hub — a child's BADGES. Pure and read-only: every badge is worked out from data that already exists (marked attempts,
// homework hand-ins, flashcard reviews), so nothing is stored per child and asking twice always gives the same answer (idempotent).
// The names, wording and pictures live in the client (lib/i18n hubextras + features/learninghub/badges); here there are only ids.

export const BADGE_IDS = ["first_quiz", "streak3", "streak7", "homework5", "cards50", "perfect", "comeback"] as const;
export type BadgeId = (typeof BADGE_IDS)[number];

export interface BadgeAttempt { assessmentId: string; type?: string | null; status: string; scoreMarks: number; maxMarks: number; submittedAt: string | null }
export interface BadgeInput {
  now: number;
  attempts: BadgeAttempt[];
  /** The child's homework hand-ins: when handed in vs the homework's due date. */
  handIns: { status: string; submittedAt: string | null; dueAt: string | null }[];
  /** How many different flashcards they have reviewed. */
  cardsReviewed: number;
  /** When they last reviewed each card (ms) — extra days of activity for streaks. */
  reviewedAt: number[];
}
export interface BadgeOut { id: BadgeId; earned: boolean; /** Progress towards a badge not yet earned. */ have?: number; need?: number }

const DAY = 86_400_000;
/** Local-day key is unknowable server-side (no timezone on the child); UTC days are a fair, stable approximation. */
const dayOf = (ms: number) => Math.floor(ms / DAY);

const CARDS_NEEDED = 50;
const HOMEWORK_NEEDED = 5;
const COMEBACK_POINTS = 20;

/** Longest run of consecutive days with any activity. */
export function bestStreak(activityMs: number[]): number {
  const days = [...new Set(activityMs.filter((n) => Number.isFinite(n)).map(dayOf))].sort((a, b) => a - b);
  let best = 0, run = 0, prev = -Infinity;
  for (const d of days) { run = d === prev + 1 ? run + 1 : 1; prev = d; if (run > best) best = run; }
  return best;
}

const pct = (a: BadgeAttempt) => (a.maxMarks > 0 ? (a.scoreMarks / a.maxMarks) * 100 : null);

export function computeBadges(i: BadgeInput): BadgeOut[] {
  const quiz = i.attempts.filter((a) => a.status !== "in_progress" && (a.type ?? "quiz") === "quiz");
  const marked = quiz.filter((a) => a.status === "marked");
  const activity = [...quiz.map((a) => (a.submittedAt ? Date.parse(a.submittedAt) : NaN)), ...i.reviewedAt];
  const streak = bestStreak(activity);
  const onTime = i.handIns.filter((h) => (h.status === "submitted" || h.status === "marked") && h.submittedAt && h.dueAt && h.submittedAt <= h.dueAt).length;
  const perfect = marked.some((a) => a.maxMarks > 0 && a.scoreMarks >= a.maxMarks);

  // Comeback: at one quiz, a later marked attempt at least 20 points better than an earlier one.
  let comeback = false;
  const byQuiz = new Map<string, BadgeAttempt[]>();
  for (const a of marked) { if (pct(a) === null || !a.submittedAt) continue; const l = byQuiz.get(a.assessmentId) ?? []; l.push(a); byQuiz.set(a.assessmentId, l); }
  for (const list of byQuiz.values()) {
    list.sort((x, y) => (x.submittedAt as string).localeCompare(y.submittedAt as string));
    let lowest = Infinity;
    for (const a of list) { const p = pct(a) as number; if (p - lowest >= COMEBACK_POINTS) { comeback = true; break; } lowest = Math.min(lowest, p); }
    if (comeback) break;
  }

  const prog = (have: number, need: number): { have: number; need: number } => ({ have: Math.min(have, need), need });
  return [
    { id: "first_quiz", earned: quiz.length >= 1 },
    { id: "streak3", earned: streak >= 3, ...(streak >= 3 ? {} : prog(streak, 3)) },
    { id: "streak7", earned: streak >= 7, ...(streak >= 7 ? {} : prog(streak, 7)) },
    { id: "homework5", earned: onTime >= HOMEWORK_NEEDED, ...(onTime >= HOMEWORK_NEEDED ? {} : prog(onTime, HOMEWORK_NEEDED)) },
    { id: "cards50", earned: i.cardsReviewed >= CARDS_NEEDED, ...(i.cardsReviewed >= CARDS_NEEDED ? {} : prog(i.cardsReviewed, CARDS_NEEDED)) },
    { id: "perfect", earned: perfect },
    { id: "comeback", earned: comeback },
  ];
}
