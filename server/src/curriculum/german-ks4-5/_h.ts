// Small builders shared by the German KS4-5 pack files (leading underscore = skipped by the validator).
// They only assemble CQuestion objects: they put the right option in a rotating position, and on request add
// umlaut/eszett alternates (ä→ae, ö→oe, ü→ue, ß→ss) to a `short` question's accepted answers. The hub marks
// case-insensitively, so capital-letter variants are not needed.
import type { CQuestion } from "../types";

type D = 1 | 2 | 3;
const alt = (s: string) => s.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
const altUmlautOnly = (s: string) => s.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue");
const altSzOnly = (s: string) => s.replace(/ß/g, "ss");
const POS = [1, 3, 0, 2, 2, 0, 3, 1, 1, 2, 0, 3];

export function qb(topic: string, year: number) {
  let n = 0;
  const next = () => `${topic}-y${year}-${String(++n).padStart(2, "0")}`;
  return {
    /** answer = the right option; wrong = 2–3 distractors. The right option is slotted in rotating positions. */
    single(prompt: string, answer: string, wrong: string[], explanation: string, difficulty: D, diagnostic = false): CQuestion {
      const key = next();
      const options = [...wrong];
      options.splice(Math.min(POS[(n - 1) % POS.length], wrong.length), 0, answer);
      return { key, kind: "single", prompt, options, answer, explanation, difficulty, ...(diagnostic ? { diagnostic: true } : {}) };
    },
    multi(prompt: string, right: string[], wrong: string[], explanation: string, difficulty: D, diagnostic = false): CQuestion {
      const key = next();
      const all = [...right, ...wrong];
      const r = (n * 2) % all.length;
      const options = [...all.slice(r), ...all.slice(0, r)];
      return { key, kind: "multi", prompt, options, answer: options.filter((o) => right.includes(o)), explanation, difficulty, ...(diagnostic ? { diagnostic: true } : {}) };
    },
    /** o.na = also accept ae/oe/ue/ss spellings (use only when the task is not about umlauts/ß). */
    short(prompt: string, answer0: string, explanation: string, difficulty: D, o: { acc?: string[]; na?: boolean; diag?: boolean } = {}): CQuestion {
      const key = next();
      // The hub does not strip punctuation, so the canonical answer has no final full stop; a version with one is accepted too.
      const answer = answer0.replace(/[.!?]+$/, "");
      const set = new Set<string>();
      for (const a of [answer, ...(o.acc ?? []).map((x) => x.replace(/[.!?]+$/, ""))]) {
        const forms = [a];
        if (o.na) forms.push(alt(a), altUmlautOnly(a), altSzOnly(a));
        for (const f of forms) {
          set.add(f);
          set.add(f.replace(/,/g, "")); // learners often drop the comma before dass/weil
          set.add(`${f}.`);
        }
      }
      set.delete(answer);
      return { key, kind: "short", prompt, answer, ...(set.size ? { accepted: [...set] } : {}), explanation, difficulty, ...(o.diag ? { diagnostic: true } : {}) };
    },
    written(prompt: string, model: string, explanation: string, difficulty: D): CQuestion {
      return { key: next(), kind: "written", prompt, answer: model, explanation, difficulty };
    },
  };
}
export const cards = (rows: [string, string][]) => rows.map(([front, back]) => ({ front, back }));
