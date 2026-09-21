// Small builders shared by the Spanish KS4–5 pack (leading underscore = skipped by the validator).
// They only assemble CQuestion objects: the right option goes in a rotating position, and a `short`
// question's `accepted` list gets punctuation variants (¿ ¡ ? ! .) and, unless accents are what is
// being tested, accent-free variants. The hub marks by exact match after trim + lower-case, so every
// tolerated spelling has to be listed.
import type { CQuestion } from "../types";

type D = 1 | 2 | 3;
// Remove accents but keep ñ (año ≠ ano) and ü is folded to u only if accents are not being tested.
const stripKeepN = (s: string) =>
  s.normalize("NFC").replace(/ñ/g, "#n#").replace(/Ñ/g, "#N#").normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC").replace(/#n#/g, "ñ").replace(/#N#/g, "Ñ");
const nopunct = (s: string) => s.replace(/[¿¡]/g, "").replace(/[.?!]+$/g, "").trim();
// Question text is plain text in the hub: turn *italic* markers into typographic quotes.
const plain = (s: string) => s.replace(/\*([^*\n]+)\*/g, "‘$1’");
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
      return { key, kind: "single", prompt: plain(prompt), options, answer, explanation: plain(explanation), difficulty, ...(diagnostic ? { diagnostic: true } : {}) };
    },
    multi(prompt: string, right: string[], wrong: string[], explanation: string, difficulty: D, diagnostic = false): CQuestion {
      const key = next();
      const all = [...right, ...wrong];
      const r = (n * 2) % all.length;
      const options = [...all.slice(r), ...all.slice(0, r)];
      return { key, kind: "multi", prompt: plain(prompt), options, answer: options.filter((o) => right.includes(o)), explanation: plain(explanation), difficulty, ...(diagnostic ? { diagnostic: true } : {}) };
    },
    /** acc = other accepted answers; accents:true = accents are being tested, so do NOT add accent-free variants (ñ is always kept). */
    short(prompt: string, answer: string, explanation: string, difficulty: D, o: { acc?: string[]; accents?: boolean; diag?: boolean } = {}): CQuestion {
      const key = next();
      const set = new Set<string>();
      for (const a of [answer, ...(o.acc ?? [])]) {
        // Marker compares only after lowercase + trim + collapse-whitespace: list the harmless variants (no ¿ ¡, with/without a final
        // full stop, with/without commas) so a child is not marked wrong for punctuation.
        const core = nopunct(a);
        const forms = new Set<string>();
        for (const c of new Set([core, core.replace(/,/g, "")])) { forms.add(c); forms.add(c + "."); }
        forms.add(a);
        if (!o.accents) for (const f of [...forms]) forms.add(stripKeepN(f));
        for (const f of forms) set.add(f);
      }
      set.delete(answer);
      return { key, kind: "short", prompt: plain(prompt), answer, ...(set.size ? { accepted: [...set] } : {}), explanation: plain(explanation), difficulty, ...(o.diag ? { diagnostic: true } : {}) };
    },
    written(prompt: string, model: string, explanation: string, difficulty: D): CQuestion {
      return { key: next(), kind: "written", prompt: plain(prompt), answer: model, explanation: plain(explanation), difficulty };
    },
  };
}
export const cards = (rows: [string, string][]) => rows.map(([front, back]) => ({ front, back }));
