import { shuffleOptionIds, type QuizItem } from "./core";

/** Compact authoring helper for the quiz-quest content banks: one correct answer + 2-3 wrong ones. Option ids are assigned from the item key (shuffleOptionIds),
 *  so the right answer is never predictable from its id or its position. Used by every `content.extra.ts`. */
export function mc(key: string, topic: string, difficulty: 1 | 2 | 3, prompt: string, correct: string, wrongs: string[], explanation: string): QuizItem {
  const { options, correctId } = shuffleOptionIds(key, correct, wrongs);
  return { key, topics: [topic], difficulty, prompt, options, correctId, explanation };
}
