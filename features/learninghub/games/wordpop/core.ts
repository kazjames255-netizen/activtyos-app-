// WORD POP's own layer on top of the shared quiz core (features/learninghub/games/quiz/core.ts). The "reuse vs
// fork" test from docs/games-prototypes/BACKEND-PATTERN.md step 1, applied honestly: Word Pop asks the exact same
// KIND of question as Compass Quest / Museum Vault / Colour Lab / Debate Keep / Story Detective / Word Vault (a
// seeded multiple-choice item over a static bank) — so item selection (buildPlan), per-item Leitner state
// (ItemState/applyToState) and the child-facing profile (QuizProfile/applyToProfile/weekDaysOf) are REUSED WHOLESALE,
// unchanged, imported straight from quiz/core.ts. Nothing here forks that.
//
// What is genuinely different, and so IS forked (a few lines, not a parallel data model): Word Pop is a fast,
// arcade-paced drill, not an untimed thinking quiz — "no time pressure on thinking" (BACKEND-PATTERN.md's standing
// content rule) does not apply here because the timer IS this game's own arcade mechanic (its explicit brief: "a
// good candidate to genuinely reuse Penguin's core drill-timing engine if the mechanic is truly equivalent"). It
// isn't quite equivalent - Penguin's engine is a continuous physics sim over numeric fact keys; Word Pop is a
// discrete per-item multiple-choice pick over word content - so rather than force-fitting Penguin's lane/steering
// simulation onto word content, this reuses the SHAPE of Penguin's MTC practice mode instead (mtc.ts: a fixed
// per-item answer window, a miss counted separately from a wrong answer, marked server-side from (answer, ms) pairs)
// -  the closest genuine equivalent, applied to a multiple-choice bank rather than typed numbers. The one new rule
// this file adds over plain markQuiz(): an answer given after ANSWER_MS is a timeout, not a correct answer, no
// matter what the client claims it picked - and a combo multiplier (base 10, x1..x5, resets on any miss) scores it.
import type { MarkedRow, QuizAnswer, QuizItem } from "../quiz/core";

export const WORDPOP_ANSWER_MS = 5000; // the whole arcade pace of this game: 5s to pop the right spelling before it's gone

export interface PoppedRow extends MarkedRow { timeout: boolean; popped: boolean }
export interface PopResult { score: number; bestCombo: number; total: number; correctCount: number; rows: PoppedRow[]; points: number; passRate: number }

/** Same marking as markQuiz (never trust the client's own idea of "correct"), but a slow answer is downgraded to a
 *  miss regardless of which option was picked, and scoring is base-10-times-combo instead of a flat 10 per hit. */
export function markWordPop(bank: readonly QuizItem[], answers: QuizAnswer[], answerMs = WORDPOP_ANSWER_MS): PopResult {
  const byKey = new Map(bank.map((i) => [i.key, i]));
  let combo = 0, bestCombo = 0, score = 0;
  const rows: PoppedRow[] = answers.map((a) => {
    const item = byKey.get(a.key);
    const correctId = item?.correctId ?? "";
    const timeout = a.ms > answerMs;
    const correct = !timeout && !!item && a.chosenId !== null && a.chosenId === correctId;
    if (correct) { combo = Math.min(5, combo + 1); score += 10 * combo; bestCombo = Math.max(bestCombo, combo); }
    else combo = 0;
    return { key: a.key, topics: item?.topics ?? [], correctId, chosenId: a.chosenId, correct, ms: a.ms, explanation: item?.explanation ?? "", timeout, popped: correct };
  });
  const correctCount = rows.filter((r) => r.correct).length;
  return { score, bestCombo, total: rows.length, correctCount, rows, points: score, passRate: rows.length ? correctCount / rows.length : 0 };
}
