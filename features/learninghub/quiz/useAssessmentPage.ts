"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { get } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { errMsg } from "../types";
import { hubPath, type Assessment, type AssessType } from "../shared-assess/api";

// SCALE: a provider's library can hold thousands of papers (the Oak import has 8.5k), so the tutor's list is never
// downloaded whole. This hook reads GET /assessments?limit=&cursor= — filtered server-side by the sidebar's subject /
// topic, the year-group chip, the search box and the published state — a page at a time, and keeps the page(s) on
// screen across realtime nudges (a reload re-reads as many rows as were shown, so the list doesn't jump back).

export interface AssessmentFacets {
  subjects: { subject: string; count: number }[];
  yearGroups: { yearGroup: string; count: number }[];
  allYearGroups: number;
  anyYearTargeted: boolean;
  types: { quiz: number; diagnostic: number };
  published: number;
  drafts: number;
}

export interface AssessmentPage { items: Assessment[]; total: number; nextCursor: string | null; facets: AssessmentFacets }

export interface AssessmentQuery {
  type?: AssessType | null;
  subject?: string | null;
  topicId?: string | null;
  yearGroup?: string | null;
  q?: string | null;
  published?: "1" | "0" | null;
  /** Just these papers (≤300) — Results / Marking look up the rows their attempts point at. */
  ids?: string[] | null;
}

export const PAGE = 40;
const MAX_KEEP = 400;

export function useAssessmentPage(qs: string, query: AssessmentQuery, onError?: (m: string) => void, enabled = true) {
  const [items, setItems] = useState<Assessment[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<AssessmentFacets | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const count = useRef(PAGE);
  const ids = query.ids ? [...query.ids].sort().join(",") : null;
  const { type, subject, topicId, yearGroup, q, published } = query;

  const path = useCallback((cursor: string | null, limit: number) => hubPath(qs, "/assessments", {
    light: "1", limit: String(limit), cursor,
    type: type ?? null, ...(topicId ? { topicId } : subject ? { subject } : {}), yearGroup: yearGroup || null, q: q || null, published: published ?? null, ids: ids || null,
  }), [qs, type, subject, topicId, yearGroup, q, published, ids]);

  const load = useCallback((more: boolean, cursor: string | null = null, keep = false) => {
    if (!enabled) { setItems([]); setTotal(0); setFacets(null); setNext(null); setLoading(false); setLoaded(false); return; }
    const mine = ++seq.current;
    setLoading(true);
    get<AssessmentPage>(path(more ? cursor : null, more ? PAGE : keep ? Math.min(MAX_KEEP, Math.max(PAGE, count.current)) : PAGE))
      .then((r) => {
        if (mine !== seq.current) return;
        setItems((cur) => (more ? [...cur, ...r.items.filter((x) => !cur.some((c) => c.id === x.id))] : r.items));
        count.current = more ? count.current + r.items.length : Math.max(PAGE, r.items.length);
        setTotal(r.total); setNext(r.nextCursor); setFacets(r.facets); setLoaded(true); setError(null);
      })
      .catch((e) => { if (mine === seq.current) { const m = errMsg(e, "Couldn't load the quizzes"); setError(m); setLoaded(true); onError?.(m); } })
      .finally(() => { if (mine === seq.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled]);
  useEffect(() => { count.current = PAGE; load(false); }, [load]);
  const reload = useCallback(() => load(false, null, true), [load]);
  const loadMore = useCallback(() => { if (next) load(true, next); }, [load, next]);
  useRealtime(["hubAssessments", "hubQuestions"], reload);

  return { items, total, facets, next, loading, loaded, error, reload, loadMore };
}

/** Calls `onNear` when the sentinel element scrolls into view — infinite scroll on top of the "Show more" button. */
export function useNearEnd(onNear: () => void, active: boolean) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const cb = useRef(onNear);
  useEffect(() => { cb.current = onNear; }, [onNear]);
  useEffect(() => {
    if (!el || !active || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) cb.current(); }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [el, active]);
  return setEl;
}
