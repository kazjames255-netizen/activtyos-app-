// Builders for the English KS4 pack (leading underscore = skipped by the validator).
import type { CQuestion } from "../types";
type D = 1 | 2 | 3;
const POS = [2, 0, 3, 1, 1, 3, 0, 2, 3, 1, 2, 0, 1, 3];
export function qb(topic: string, year: number) {
  let n = 0;
  const next = () => `${topic}-y${year}-${String(++n).padStart(2, "0")}`;
  return {
    /** right option is slotted into a rotating position among the distractors */
    single(prompt: string, answer: string, wrong: string[], explanation: string, difficulty: D, diagnostic = false): CQuestion {
      const key = next();
      const options = [...wrong];
      options.splice(Math.min(POS[(n - 1) % POS.length], wrong.length), 0, answer);
      return { key, kind: "single", prompt, options, answer, explanation, difficulty, ...(diagnostic ? { diagnostic: true } : {}) };
    },
    multi(prompt: string, right: string[], wrong: string[], explanation: string, difficulty: D, diagnostic = false): CQuestion {
      const key = next();
      const all = [...right, ...wrong];
      const r = (n * 2 + 1) % all.length;
      const options = [...all.slice(r), ...all.slice(0, r)];
      return { key, kind: "multi", prompt, options, answer: options.filter((o) => right.includes(o)), explanation, difficulty, ...(diagnostic ? { diagnostic: true } : {}) };
    },
    short(prompt: string, answer: string, accepted: string[], explanation: string, difficulty: D, diagnostic = false): CQuestion {
      return { key: next(), kind: "short", prompt, answer, ...(accepted.length ? { accepted } : {}), explanation, difficulty, ...(diagnostic ? { diagnostic: true } : {}) };
    },
    /** tutor-marked; `model` is an exemplar summary, explanation carries the mark scheme */
    written(prompt: string, model: string, explanation: string, difficulty: D, marks = 8): CQuestion {
      return { key: next(), kind: "written", prompt, answer: model, explanation, difficulty, marks };
    },
  };
}
export const cards = (rows: [string, string][]) => rows.map(([front, back]) => ({ front, back }));
