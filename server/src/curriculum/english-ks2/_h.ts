// Tiny authoring helpers for the english-ks2 pack (leading underscore: skipped by validate.ts and the seeder).
import type { CQuestion } from "../types";

export type Item = Omit<CQuestion, "key">;
type D = 1 | 2 | 3;

/** single: `right` is inserted among `wrongs` at index `pos` (0-based) so answer positions can be spread deliberately. */
export const sg = (prompt: string, right: string, wrongs: string[], pos: number, explanation: string, difficulty: D, diagnostic = false): Item => {
  const options = [...wrongs];
  options.splice(pos, 0, right);
  return { kind: "single", prompt, options, answer: right, explanation, difficulty, ...(diagnostic ? { diagnostic } : {}) };
};
export const mu = (prompt: string, options: string[], answer: string[], explanation: string, difficulty: D, diagnostic = false): Item =>
  ({ kind: "multi", prompt, options, answer, explanation, difficulty, ...(diagnostic ? { diagnostic } : {}) });
/** short: the marker only trims/lowercases, so a typed trailing full stop ("dangerous.") is auto-accepted for every form. */
export const sh = (prompt: string, answer: string, accepted: string[], explanation: string, difficulty: D, diagnostic = false): Item => {
  const set = new Set<string>();
  for (const a of [answer, ...accepted]) { set.add(a); if (!/[.!?]$/.test(a)) set.add(`${a}.`); }
  set.delete(answer);
  return { kind: "short", prompt, answer, accepted: [...set], explanation, difficulty, ...(diagnostic ? { diagnostic } : {}) };
};

export const build = (topic: string, year: number, items: Item[]): CQuestion[] =>
  items.map((it, i) => ({ key: `${topic}-y${year}-${String(i + 1).padStart(2, "0")}`, ...it }));
