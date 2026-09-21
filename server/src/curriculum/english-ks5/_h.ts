// Authoring helpers for the english-ks5 pack (leading underscore: skipped by validate.ts and the seeder).
import type { CQuestion } from "../types";

export type Item = Omit<CQuestion, "key">;
type D = 1 | 2 | 3;

/** single: `right` is inserted among `wrongs` at index `pos` (0-based) so answer positions are spread deliberately. */
export const sg = (prompt: string, right: string, wrongs: string[], pos: number, explanation: string, difficulty: D, diagnostic = false): Item => {
  const options = [...wrongs];
  options.splice(pos, 0, right);
  return { kind: "single", prompt, options, answer: right, explanation, difficulty, ...(diagnostic ? { diagnostic } : {}) };
};
export const mu = (prompt: string, options: string[], answer: string[], explanation: string, difficulty: D, diagnostic = false): Item =>
  ({ kind: "multi", prompt, options, answer, explanation, difficulty, ...(diagnostic ? { diagnostic } : {}) });
export const sh = (prompt: string, answer: string, accepted: string[], explanation: string, difficulty: D, diagnostic = false): Item =>
  ({ kind: "short", prompt, answer, accepted, explanation, difficulty, ...(diagnostic ? { diagnostic } : {}) });
/** written: tutor-marked; the mark scheme lives in `explanation`. */
export const wr = (prompt: string, explanation: string, difficulty: D = 3): Item =>
  ({ kind: "written", prompt, answer: "Tutor-marked: see the mark scheme in the explanation.", explanation, difficulty, marks: 6 });

export const build = (topic: string, year: number, items: Item[]): CQuestion[] =>
  items.map((it, i) => ({ key: `${topic}-y${year}-${String(i + 1).padStart(2, "0")}`, ...it }));
