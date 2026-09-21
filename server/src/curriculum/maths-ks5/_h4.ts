// Tiny question-builders for the maths-ks5 pack (keeps topic files readable). Output is plain CQuestion data.
import type { CQuestion } from "../types";
type Extra = { diagnostic?: boolean; image?: { file: string; alt: string }; marks?: number };
const mk = (key: string, kind: CQuestion["kind"], d: 1 | 2 | 3, prompt: string, rest: Partial<CQuestion>, ex?: Extra): CQuestion =>
  ({ key, kind, prompt, difficulty: d, ...rest, ...(ex?.diagnostic ? { diagnostic: true } : {}), ...(ex?.image ? { image: ex.image } : {}), ...(ex?.marks ? { marks: ex.marks } : {}) }) as CQuestion;
/** single choice */
export const S = (key: string, d: 1 | 2 | 3, prompt: string, options: string[], answer: string, explanation: string, ex?: Extra) => mk(key, "single", d, prompt, { options, answer, explanation }, ex);
/** multi choice */
export const M = (key: string, d: 1 | 2 | 3, prompt: string, options: string[], answer: string[], explanation: string, ex?: Extra) => mk(key, "multi", d, prompt, { options, answer, explanation }, ex);
/** numeric */
export const NUM = (key: string, d: 1 | 2 | 3, prompt: string, answer: number, tolerance: number, explanation: string, ex?: Extra) => mk(key, "number", d, prompt, { answer, ...(tolerance ? { tolerance } : {}), explanation }, ex);
/** typed short answer (accepted = other exact forms) */
export const SH = (key: string, d: 1 | 2 | 3, prompt: string, answer: string, accepted: string[], explanation: string, ex?: Extra) => mk(key, "short", d, prompt, { answer, accepted, explanation }, ex);
/** tutor-marked: mark scheme in explanation */
export const WR = (key: string, d: 1 | 2 | 3, prompt: string, marks: number, explanation: string, ex?: Extra) => mk(key, "written", d, prompt, { explanation }, { ...ex, marks });
/** variants of a typed answer: both minus signs, with/without spaces, optional leading "x = " forms */
export const variants = (...forms: string[]): string[] => {
  const out = new Set<string>();
  for (const f of forms) for (const g of [f, f.replace(/−/g, "-")]) { out.add(g); out.add(g.replace(/ /g, "")); out.add(g.replace(/, /g, ",")); out.add(g.replace(/,(?! )/g, ", ")); }
  return Array.from(out);
};
