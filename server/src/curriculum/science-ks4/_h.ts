// Builders for the science-ks4 pack. Each numeric / computable question carries a `chk` recompute function that
// is registered in REG; _check_s4.ts re-runs every one against the typed answer.
import type { CQuestion, CYear } from "../types";

export type ChkVal = number | string | string[];
export type Chk = () => ChkVal;
export interface RegItem { key: string; kind: string; answer: string | string[] | number; tol?: number; chk: Chk }
export const REG: RegItem[] = [];

export interface O { diag?: boolean; img?: [string, string]; marks?: number; chk?: Chk; acc?: string[] }
type D = 1 | 2 | 3;
export interface Draft { kind: CQuestion["kind"]; d: D; prompt: string; right?: string | string[]; wrong?: string[]; answer?: string | number; tol?: number; expl: string; o: O }

/** single: `right` is the one correct option; `wrong` are 3 distractors. Position is rotated automatically. */
export const S = (d: D, prompt: string, right: string, wrong: string[], expl: string, o: O = {}): Draft => ({ kind: "single", d, prompt, right, wrong, expl, o });
/** multi: 2+ right, some wrong. */
export const M = (d: D, prompt: string, right: string[], wrong: string[], expl: string, o: O = {}): Draft => ({ kind: "multi", d, prompt, right, wrong, expl, o });
/** short typed answer. */
export const T = (d: D, prompt: string, answer: string, acc: string[], expl: string, o: O = {}): Draft => ({ kind: "short", d, prompt, answer, expl, o: { ...o, acc } });
/** number: tol is the allowed absolute error. chk recomputes the value. */
export const N = (d: D, prompt: string, answer: number, tol: number, expl: string, chk: Chk, o: O = {}): Draft => ({ kind: "number", d, prompt, answer, tol, expl, o: { ...o, chk } });
/** written (tutor-marked, 6 marks); the mark scheme lives in `expl`. */
export const W = (prompt: string, expl: string, o: O = {}): Draft => ({ kind: "written", d: 3, prompt, answer: "See the mark scheme in the explanation.", expl, o: { ...o, marks: o.marks ?? 6 } });

const ORDER = [2, 0, 3, 1];
export interface YSpec { obj: string[]; note: [string, string]; quiz: string; qs: Draft[]; cards: [string, string][] }

export function yr(topicKey: string, year: number, s: YSpec): CYear {
  let singles = 0, multis = 0;
  const questions: CQuestion[] = s.qs.map((d, i) => {
    const key = `${topicKey}-y${year}-${String(i + 1).padStart(2, "0")}`;
    const q: CQuestion = { key, kind: d.kind, prompt: d.prompt, answer: 0, explanation: d.expl, difficulty: d.d } as CQuestion;
    if (d.kind === "single") {
      const opts = [...d.wrong!]; const pos = ORDER[singles++ % 4] % (opts.length + 1);
      opts.splice(pos, 0, d.right as string);
      q.options = opts; q.answer = d.right as string;
    } else if (d.kind === "multi") {
      const rights = d.right as string[]; const all = [...rights, ...d.wrong!];
      const k = (multis++ * 2 + 1) % all.length; const opts = [...all.slice(k), ...all.slice(0, k)];
      q.options = opts; q.answer = rights;
    } else if (d.kind === "short") { q.answer = d.answer as string; if (d.o.acc?.length) q.accepted = d.o.acc; }
    else if (d.kind === "number") { q.answer = d.answer as number; if (d.tol) q.tolerance = d.tol; }
    else { q.answer = d.answer as string; }
    if (d.o.marks) q.marks = d.o.marks;
    if (d.o.diag) q.diagnostic = true;
    if (d.o.img) q.image = { file: d.o.img[0], alt: d.o.img[1] };
    if (d.o.chk) REG.push({ key, kind: d.kind, answer: q.answer, tol: d.tol, chk: d.o.chk });
    return q;
  });
  return {
    year, objectives: s.obj, note: { title: s.note[0], body: s.note[1] },
    quiz: { title: s.quiz, questions }, flashcards: s.cards.map(([front, back]) => ({ front, back })),
  };
}
