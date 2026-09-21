import type { Answer } from "./QuestionView";
import { put } from "@/lib/api";

// A paper's running answers are kept as the student goes so a reload (or Back) can resume the same paper without losing them.
//  1. On THIS device (localStorage `hubdraft:<attemptId>`): instant, works offline, but only here.
//  2. On the SERVER (PUT /attempts/:id/draft, debounced): so "Resume" also works on another device or after clearing the browser.
// The runner restores from whichever is newer (the server's answers arrive on the resume reply). Used by the Quizzes runner and a
// lesson's exit quiz. Stale local entries (a paper never handed in) are swept after a week.

const PREFIX = "hubdraft:";
const draftKey = (id: string) => `${PREFIX}${id}`;
const WEEK = 7 * 86_400_000;
export interface Draft { a: Record<string, Answer>; idx: number; t?: number }

export const saveDraft = (id: string, a: Record<string, Answer>, idx: number) => { try { localStorage.setItem(draftKey(id), JSON.stringify({ a, idx, t: Date.now() })); } catch { /* private mode */ } };
export const loadDraft = (id: string): Draft | null => { try { const r = localStorage.getItem(draftKey(id)); return r ? JSON.parse(r) : null; } catch { return null; } };
export const clearDraft = (id: string) => { try { localStorage.removeItem(draftKey(id)); } catch { /* ignore */ } };

/** Remove `hubdraft:` entries older than a week (an entry from before drafts carried a timestamp is stamped now, so it lives one more week). */
export function sweepDrafts(now = Date.now()) {
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      let t: number | null = null;
      let v: Draft | null = null;
      try { v = JSON.parse(localStorage.getItem(k) ?? "null") as Draft | null; t = typeof v?.t === "number" ? v.t : null; } catch { /* unreadable: drop it */ }
      if (!v) stale.push(k);
      else if (t === null) localStorage.setItem(k, JSON.stringify({ ...v, t: now }));
      else if (now - t > WEEK) stale.push(k);
    }
    for (const k of stale) localStorage.removeItem(k);
  } catch { /* storage unavailable */ }
}

/** The answers as the server draft wants them: only the answered ones (the runner's own emptiness rule lives in QuestionView). */
export const draftBody = (answers: Record<string, Answer>, idx: number, keep: (v: Answer) => boolean) => ({
  answers: Object.entries(answers).filter(([, v]) => keep(v)).map(([questionId, response]) => ({ questionId, response })),
  idx,
});

/** Save the draft to the server. Quiet on failure: the local copy still stands and the next change tries again. */
export async function pushDraft(path: string, body: ReturnType<typeof draftBody>): Promise<boolean> {
  try { await put(path, body); return true; } catch { return false; }
}

/** The newer of the server's draft and this device's (the server wins a tie). */
export function pickDraft(server: { answers: Record<string, unknown>; idx: number; savedAt: string } | null | undefined, local: Draft | null): Draft | null {
  const s: Draft | null = server && Object.keys(server.answers ?? {}).length ? { a: server.answers as Record<string, Answer>, idx: server.idx, t: Date.parse(server.savedAt) || 0 } : null;
  if (s && local) return (local.t ?? 0) > (s.t ?? 0) ? local : s;
  return s ?? local;
}
