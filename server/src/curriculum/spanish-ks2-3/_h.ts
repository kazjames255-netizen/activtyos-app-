// Small builders shared by the Spanish pack files (leading underscore = skipped by the validator).
// They only assemble CQuestion objects: the right option of a single/multi is slotted into a rotating position, and a
// `short` question's accepted list gains harmless variants: with/without ¿ ¡ ? ! and a final full stop, with/without commas,
// and (unless `strict`) accent-free spellings (á é í ó ú ü -> a e i o u). ñ is NEVER stripped (ano is a different word).
import type { CQuestion } from "../types";

type D = 1 | 2 | 3;
const strip = (s: string) => s.replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i").replace(/[óòö]/g, "o").replace(/[úù]/g, "u").replace(/ü/g, "u");
const POS = [1, 3, 0, 2, 2, 0, 3, 1, 1, 2, 0, 3];

export function qb(topic: string, year: number) {
  let n = 0;
  const next = () => `${topic}-y${year}-${String(++n).padStart(2, "0")}`;
  const flag = (d: boolean) => (d ? { diagnostic: true as const } : {});
  return {
    /** answer = the right option; wrong = 2-3 distractors. */
    single(prompt: string, answer: string, wrong: string[], explanation: string, difficulty: D, diagnostic = false): CQuestion {
      const key = next();
      const options = [...wrong];
      options.splice(Math.min(POS[(n - 1) % POS.length], wrong.length), 0, answer);
      return { key, kind: "single", prompt, options, answer, explanation, difficulty, ...flag(diagnostic) };
    },
    multi(prompt: string, right: string[], wrong: string[], explanation: string, difficulty: D, diagnostic = false): CQuestion {
      const key = next();
      const all = [...right, ...wrong];
      const r = (n * 2) % all.length;
      const options = [...all.slice(r), ...all.slice(0, r)];
      return { key, kind: "multi", prompt, options, answer: options.filter((o) => right.includes(o)), explanation, difficulty, ...flag(diagnostic) };
    },
    short(prompt: string, answer: string, explanation: string, difficulty: D, o: { acc?: string[]; strict?: boolean; diag?: boolean } = {}): CQuestion {
      const key = next();
      const set = new Set<string>();
      const add = (a: string) => {
        const core = a.replace(/^[¿¡]+/, "").replace(/[?!.]+$/, "").trim();
        const coreNoComma = core.replace(/,/g, "");
        for (const c of new Set([core, coreNoComma])) {
          for (const v of [c, c + ".", c + "?", "¿" + c + "?", c + "!", "¡" + c + "!"]) {
            set.add(v);
            if (!o.strict) set.add(strip(v));
          }
        }
      };
      for (const a of [answer, ...(o.acc ?? [])]) add(a);
      set.delete(answer);
      return { key, kind: "short", prompt, answer, accepted: [...set], explanation, difficulty, ...flag(!!o.diag) };
    },
    written(prompt: string, model: string, explanation: string, difficulty: D): CQuestion {
      return { key: next(), kind: "written", prompt, answer: model, explanation, difficulty };
    },
  };
}
export const cards = (rows: [string, string][]) => rows.map(([front, back]) => ({ front, back }));
