// Small builders for the English KS3 pack (leading underscore = skipped by the validator).
// They only assemble CQuestion objects: the right option is slotted into a rotating position,
// and quotations claimed by a question are registered so _check_e3.ts can confirm they appear in the prompt.
import type { CQuestion } from "../types";

type D = 1 | 2 | 3;
type O = { d?: boolean; q?: string[] };
export const QUOTES = new Map<string, string[]>();
const POS = [1, 3, 0, 2, 2, 0, 3, 1, 1, 2, 0, 3];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function qb(topic: string, year: number) {
  let n = 0;
  const next = () => `${topic}-y${year}-${String(++n).padStart(2, "0")}`;
  const reg = (key: string, o?: O) => { if (o?.q?.length) QUOTES.set(key, o.q); };
  return {
    single(prompt: string, answer: string, wrong: string[], explanation: string, difficulty: D, o?: O): CQuestion {
      const key = next(); reg(key, o);
      const options = [...wrong];
      options.splice(Math.min(POS[(n - 1) % POS.length], wrong.length), 0, answer);
      return { key, kind: "single", prompt, options, answer, explanation, difficulty, ...(o?.d ? { diagnostic: true } : {}) };
    },
    multi(prompt: string, right: string[], wrong: string[], explanation: string, difficulty: D, o?: O): CQuestion {
      const key = next(); reg(key, o);
      const all = [...right, ...wrong];
      const r = (n * 2) % all.length;
      const options = [...all.slice(r), ...all.slice(0, r)];
      return { key, kind: "multi", prompt, options, answer: options.filter((x) => right.includes(x)), explanation, difficulty, ...(o?.d ? { diagnostic: true } : {}) };
    },
    short(prompt: string, answer: string, accepted: string[], explanation: string, difficulty: D, o?: O): CQuestion {
      const key = next(); reg(key, o);
      const set = new Set<string>();
      // The marker only trims/lowercases/collapses spaces, so add the curly-apostrophe form and a trailing-full-stop form of every answer.
      for (const a of [answer, ...accepted]) for (const v of [a, cap(a), a.replace(/'/g, "’"), a.replace(/’/g, "'")]) { set.add(v); if (!/[.!?]$/.test(v)) set.add(`${v}.`); }
      set.delete(answer);
      return { key, kind: "short", prompt, answer, ...(set.size ? { accepted: [...set] } : {}), explanation, difficulty, ...(o?.d ? { diagnostic: true } : {}) };
    },
    written(prompt: string, model: string, explanation: string, difficulty: D, o?: O): CQuestion {
      const key = next(); reg(key, o);
      return { key, kind: "written", prompt, answer: model, explanation, difficulty, ...(o?.d ? { diagnostic: true } : {}) };
    },
  };
}
export const cards = (rows: [string, string][]) => rows.map(([front, back]) => ({ front, back }));
