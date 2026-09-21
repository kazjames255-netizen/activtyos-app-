// Builders for the A-level Chemistry pack (leading underscore = skipped by the validator).
// The right option is slotted in rotating positions so answers spread across A–D.
import type { CQuestion } from "../types";

type D = 1 | 2 | 3;
type X = { diag?: boolean; image?: { file: string; alt: string }; tol?: number; acc?: string[]; marks?: number; pos?: number };
const POS = [1, 3, 0, 2, 2, 0, 3, 1, 3, 1, 0, 2, 1, 3];

export function qb(topic: string, year: number) {
  let n = 0;
  const next = () => `${topic}-y${year}-${String(++n).padStart(2, "0")}`;
  const ex = (x: X) => ({ ...(x.diag ? { diagnostic: true as const } : {}), ...(x.image ? { image: x.image } : {}), ...(x.marks ? { marks: x.marks } : {}) });
  return {
    /** answer = the right option; wrong = 3 distractors. */
    single(difficulty: D, prompt: string, answer: string, wrong: string[], explanation: string, x: X = {}): CQuestion {
      const key = next();
      const options = [...wrong];
      options.splice(Math.min(x.pos ?? POS[(n - 1) % POS.length], wrong.length), 0, answer);
      return { key, kind: "single", prompt, options, answer, explanation, difficulty, ...ex(x) };
    },
    multi(difficulty: D, prompt: string, right: string[], wrong: string[], explanation: string, x: X = {}): CQuestion {
      const key = next();
      const all = [...right, ...wrong];
      const r = (n * 2) % all.length;
      const options = [...all.slice(r), ...all.slice(0, r)];
      return { key, kind: "multi", prompt, options, answer: options.filter((o) => right.includes(o)), explanation, difficulty, ...ex(x) };
    },
    num(difficulty: D, prompt: string, answer: number, tolerance: number, explanation: string, x: X = {}): CQuestion {
      return { key: next(), kind: "number", prompt, answer, tolerance, explanation, difficulty, ...ex(x) };
    },
    short(difficulty: D, prompt: string, answer: string, accepted: string[], explanation: string, x: X = {}): CQuestion {
      return { key: next(), kind: "short", prompt, answer, accepted, explanation, difficulty, ...ex(x) };
    },
    written(difficulty: D, prompt: string, modelAnswer: string, explanation: string, marks = 6, x: X = {}): CQuestion {
      return { key: next(), kind: "written", prompt, answer: modelAnswer, explanation, difficulty, marks, ...ex(x) };
    },
  };
}
export const img = (file: string, alt: string) => ({ file, alt });
