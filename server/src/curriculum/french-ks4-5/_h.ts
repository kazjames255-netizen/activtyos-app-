// Small builders shared by the French pack files (leading underscore = skipped by the validator).
// They only assemble CQuestion objects: they put the right option in a rotating position, and add
// apostrophe (' vs ’) and, on request, accent-free variants to a `short` question's accepted answers.
import type { CQuestion } from "../types";

type D = 1 | 2 | 3;
const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae");
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
    short(prompt: string, answer: string, explanation: string, difficulty: D, o: { acc?: string[]; na?: boolean; diag?: boolean } = {}): CQuestion {
      const key = next();
      const set = new Set<string>();
      // Marker compares only after lowercase + trim + collapse-whitespace, so list the harmless variants: with/without commas,
      // with/without a final full stop (or ? / ! with or without the French space), straight or curly apostrophe, and (na) accent-free.
      const forms = (a: string): string[] => {
        const tail = a.match(/\s*([?!]+)$/)?.[1];
        const core = a.replace(/\s*[?!.]+$/, "").trim();
        const out = new Set<string>();
        for (const c of new Set([core, core.replace(/,/g, "")])) {
          out.add(c);
          out.add(c + ".");
          if (tail) { out.add(c + tail); out.add(c + " " + tail); }
        }
        return [...out];
      };
      for (const a of [answer, ...(o.acc ?? [])]) {
        for (const f of forms(a)) {
          set.add(f);
          set.add(f.replace(/'/g, "\u2019"));
          set.add(f.replace(/\u2019/g, "'"));
          if (o.na) { set.add(strip(f)); set.add(strip(f).replace(/'/g, "\u2019")); }
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
