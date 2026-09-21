// Authoring helpers for the science-ks3 pack (leading underscore: skipped by validate.ts and the seeder).
import type { CQuestion } from "../types";

type D = 1 | 2 | 3;
export type Ex = { d?: boolean; img?: [string, string]; pos?: number; tol?: number; accepted?: string[] };
export type Item = Omit<CQuestion, "key"> & { _pos?: number };
const ex = (e?: Ex) => ({ ...(e?.d ? { diagnostic: true } : {}), ...(e?.img ? { image: { file: e.img[0], alt: e.img[1] } } : {}) });

/** single: `right` is placed among `wrongs`; position rotates automatically (or `pos` to force it, e.g. ordered numeric options). */
export const sg = (prompt: string, right: string, wrongs: string[], explanation: string, difficulty: D, e?: Ex): Item =>
  ({ kind: "single", prompt, options: [...wrongs], answer: right, explanation, difficulty, ...ex(e), _pos: e?.pos });
export const mu = (prompt: string, options: string[], answer: string[], explanation: string, difficulty: D, e?: Ex): Item =>
  ({ kind: "multi", prompt, options, answer, explanation, difficulty, ...ex(e) });
export const sh = (prompt: string, answer: string, accepted: string[], explanation: string, difficulty: D, e?: Ex): Item =>
  ({ kind: "short", prompt, answer, accepted, explanation, difficulty, ...ex(e) });
export const nm = (prompt: string, answer: number, explanation: string, difficulty: D, e?: Ex): Item =>
  ({ kind: "number", prompt, answer, ...(e?.tol ? { tolerance: e.tol } : {}), explanation, difficulty, ...ex(e) });
export const wr = (prompt: string, modelAnswer: string, explanation: string, difficulty: D, e?: Ex): Item =>
  ({ kind: "written", prompt, answer: modelAnswer, explanation, difficulty, ...ex(e) });

const ROT = [2, 0, 3, 1, 1, 3, 0, 2]; // deterministic spread of the correct option across positions
export const build = (topic: string, year: number, items: Item[]): CQuestion[] => {
  let si = 0;
  return items.map((it, i) => {
    const { _pos, ...q } = it;
    if (q.kind === "single") {
      const pos = _pos ?? ROT[si++ % ROT.length];
      const opts = [...(q.options as string[])];
      opts.splice(Math.min(pos, opts.length), 0, q.answer as string);
      return { key: `${topic}-y${year}-${String(i + 1).padStart(2, "0")}`, ...q, options: opts } as CQuestion;
    }
    return { key: `${topic}-y${year}-${String(i + 1).padStart(2, "0")}`, ...q } as CQuestion;
  });
};
