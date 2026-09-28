// "MTC practice": a practice mode that mimics the OFFICIAL Year 4 Multiplication Tables Check. Pure + seeded like the game core (server re-marks it).
// Spec verified against the STA assessment framework (docs/games-research/deep/C-learning-science-uk.md section 4): 25 questions, 1 mark each, 6 s per
// question, ~3 s pause between, 3 practice questions first, items from tables 2-12 (1x is not tested), no reversals within a form (3x8 excludes 8x3), no repeats,
// max 30% overlap with the previous form, not ordered by difficulty, per-form limits on how often each table is the FIRST factor.
// There is NO pass mark: never present a result as pass/fail or as diagnostic. Label it "practice".
import { makeRng } from "../../tools/engine/rng";
import { mix } from "./core";

export const MTC = { n: 25, practice: 3, answerMs: 6000, pauseMs: 3000, maxOverlap: 7 } as const;
// Per-form limits on the first factor, by table. TODO(verify): the 10 / 11 / 12 rows came from a secondary source because the PDF extraction of those rows was
// garbled; re-verify all rows against the official framework before this mode ships to families (see doc C section 4).
export const MTC_LIMITS: Record<number, [number, number]> = { 2: [0, 2], 3: [1, 3], 4: [1, 3], 5: [1, 3], 6: [2, 4], 7: [2, 4], 8: [2, 4], 9: [2, 4], 10: [0, 2], 11: [1, 3], 12: [2, 4] };
export interface MtcItem { a: number; b: number }
export const mtcKey = (i: MtcItem) => `${Math.min(i.a, i.b)}x${Math.max(i.a, i.b)}`;
const pairKey = (a: number, b: number) => (a <= b ? `${a}x${b}` : `${b}x${a}`);

/** One form of 25, obeying the limits. `prev` = the previous form's items (keys) to keep overlap under 30%. */
export function makeMtcForm(seed: number, prev: string[] = []): MtcItem[] {
  const tables = Object.keys(MTC_LIMITS).map(Number);
  const prevSet = new Set(prev);
  let best: MtcItem[] | null = null;
  for (let attempt = 0; attempt < 1200 && !best; attempt++) {
    const relax = attempt < 400 ? 0 : attempt < 800 ? 1 : 2; // 1: allow a wider second-factor spread; 2: also ignore overlap (never in practice)
    const rng = makeRng(mix(seed, 7000 + attempt));
    const counts: Record<number, number> = {}; let total = 0;
    for (const t of tables) { counts[t] = MTC_LIMITS[t]![0]; total += counts[t]!; }
    while (total < MTC.n) {
      const room = tables.filter((t) => counts[t]! < MTC_LIMITS[t]![1]);
      const pool = room.flatMap((t) => (t === 6 || t === 7 || t === 8 || t === 9 || t === 12 ? [t, t, t] : [t]));
      const t = pool[rng.int(0, pool.length - 1)]!; counts[t]!++; total++;
    }
    const used = new Set<string>(); const cnt2: Record<number, number> = {}; const items: MtcItem[] = [];
    let bad = false;
    for (const a of rng.shuffle(tables)) {
      for (let c = 0; c < counts[a]!; c++) {
        const cands = rng.shuffle(tables.filter((b) => !used.has(pairKey(a, b)) && (cnt2[b] ?? 0) < MTC_LIMITS[b]![1] + 1 + relax));
        const b = cands[0];
        if (b === undefined) { bad = true; break; }
        used.add(pairKey(a, b)); cnt2[b] = (cnt2[b] ?? 0) + 1; items.push({ a, b });
      }
      if (bad) break;
    }
    if (bad) continue;
    if (relax < 2 && items.filter((i) => prevSet.has(mtcKey(i))).length > MTC.maxOverlap) continue;
    const order = rng.shuffle(items);
    const products = order.map((i) => i.a * i.b);
    const asc = products.every((p, i) => i === 0 || p >= products[i - 1]!), desc = products.every((p, i) => i === 0 || p <= products[i - 1]!);
    if (asc || desc) continue;
    best = order;
  }
  return best!;
}
/** 3 "try it out" questions: never marked, never sent. */
export function makeMtcPractice(seed: number): MtcItem[] {
  const rng = makeRng(mix(seed, 9100));
  return [0, 1, 2].map(() => ({ a: rng.int(2, 12), b: rng.int(2, 12) }));
}

export interface MtcAnswer { v: number | null; ms: number }
export interface MtcResult { score: number; total: number; rows: { a: number; b: number; entered: number | null; ok: boolean; kind: "right" | "wrong" | "timeout"; ms: number }[]; byTable: Record<number, { right: number; total: number }> }
/** Mark a form. A blank (timed out) answer is incorrect and reported separately from a wrong one (tutor: "timed out" vs "did not know"). */
export function markMtc(form: MtcItem[], answers: MtcAnswer[]): MtcResult {
  const rows = form.map((it, i) => {
    const a = answers[i]; const ms = Math.max(0, Math.min(MTC.answerMs + 500, Math.round(a?.ms ?? 0)));
    const entered = a && typeof a.v === "number" && Number.isFinite(a.v) ? a.v : null;
    const ok = entered !== null && entered === it.a * it.b && ms <= MTC.answerMs + 500;
    return { a: it.a, b: it.b, entered, ok, kind: (ok ? "right" : entered === null ? "timeout" : "wrong") as "right" | "wrong" | "timeout", ms };
  });
  const byTable: Record<number, { right: number; total: number }> = {};
  for (const r of rows) for (const t of new Set([r.a, r.b])) { const e = (byTable[t] ??= { right: 0, total: 0 }); e.total++; if (r.ok) e.right++; }
  return { score: rows.filter((r) => r.ok).length, total: form.length, rows, byTable };
}
export const cleanMtcAnswers = (raw: unknown): MtcAnswer[] | null => {
  if (!Array.isArray(raw) || raw.length !== MTC.n) return null;
  const out: MtcAnswer[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") return null;
    const v = (x as { v?: unknown }).v, ms = (x as { ms?: unknown }).ms;
    if (!(v === null || (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 999)) || typeof ms !== "number" || !Number.isFinite(ms)) return null;
    out.push({ v: v as number | null, ms });
  }
  return out;
};
