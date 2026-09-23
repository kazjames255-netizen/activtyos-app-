"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Cell, IpResult } from "./api";

// What the tutor has captured so far in a class session: per child × question answers/verdicts, per child × warm-up question
// right/wrong taps, and the results the server has recorded. It lives in the browser too (localStorage "hubclass:<sessionId>"),
// so a refresh mid-lesson resumes exactly where the tutor was; nothing is lost until the answers are handed in and recorded.

export interface ClassState {
  cells: Record<string, Record<string, Cell>>;
  /** Per child × warm-up question: which option/answer THAT child gave (same shape as `cells`) — so who chose
   *  what, and whether it was right, is visible per child, not just a blank right/wrong tally. */
  warm: Record<string, Record<string, Cell>>;
  results: Record<string, IpResult>;
  /** The paper the answers above are for (the lesson's exit quiz, or the quiz the tutor picked). */
  assessmentId: string | null;
}
const EMPTY: ClassState = { cells: {}, warm: {}, results: {}, assessmentId: null };
const key = (sessionId: string) => `hubclass:${sessionId}`;

function load(sessionId: string): ClassState {
  try {
    const raw = window.localStorage.getItem(key(sessionId));
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<ClassState>) };
  } catch { /* private window / blocked storage: the session simply doesn't survive a refresh */ }
  return EMPTY;
}

export function useClassState(sessionId: string) {
  const [state, setState] = useState<ClassState>(() => load(sessionId));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    try { window.localStorage.setItem(key(sessionId), JSON.stringify(state)); } catch { /* see load() */ }
  }, [state, sessionId]);

  /** Set (or with `null` clear) one child's answer to one question. */
  const setCell = useCallback((childId: string, questionId: string, cell: Cell | null) => {
    setState((s) => {
      const mine = { ...(s.cells[childId] ?? {}) };
      if (cell && (cell.response !== undefined || cell.verdict)) mine[questionId] = cell; else delete mine[questionId];
      return { ...s, cells: { ...s.cells, [childId]: mine } };
    });
  }, []);
  /** "Everyone got it" / "Nobody yet" for one question — for these children only. */
  const setAll = useCallback((childIds: string[], questionId: string, verdict: "right" | "wrong" | null) => {
    setState((s) => {
      const cells = { ...s.cells };
      for (const c of childIds) {
        const mine = { ...(cells[c] ?? {}) };
        if (verdict) mine[questionId] = { verdict }; else delete mine[questionId];
        cells[c] = mine;
      }
      return { ...s, cells };
    });
  }, []);
  /** Set (or with `null` clear) one child's warm-up answer to one question — which option/text they gave, and/or the tutor's right/wrong call. */
  const setWarmCell = useCallback((childId: string, questionId: string, cell: Cell | null) => {
    setState((s) => {
      const mine = { ...(s.warm[childId] ?? {}) };
      if (cell && (cell.response !== undefined || cell.verdict)) mine[questionId] = cell; else delete mine[questionId];
      return { ...s, warm: { ...s.warm, [childId]: mine } };
    });
  }, []);
  const setResults = useCallback((rows: IpResult[]) => {
    setState((s) => {
      const next = { ...s.results };
      for (const r of rows) {
        // A skipped row never replaces a recorded one (a retry that is refused again must not hide the earlier result).
        if (r.status === "skipped" && next[r.childId] && next[r.childId]!.status !== "skipped") continue;
        if (r.status === "duplicate" && !r.answers && next[r.childId]) continue;
        next[r.childId] = r;
      }
      return { ...s, results: next };
    });
  }, []);
  const setAssessment = useCallback((assessmentId: string | null) => setState((s) => (s.assessmentId === assessmentId ? s : { ...s, assessmentId })), []);
  const clear = useCallback(() => { try { window.localStorage.removeItem(key(sessionId)); } catch { /* nothing to do */ } }, [sessionId]);

  return { state, setCell, setAll, setWarmCell, setResults, setAssessment, clear };
}
export type ClassStore = ReturnType<typeof useClassState>;
