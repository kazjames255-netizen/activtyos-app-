"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { get } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

// What the roster shows beyond enrolment: mastery, last activity, the next
// lesson, and what needs the tutor (overdue homework, work to mark). Four
// existing endpoints, ONE fetch each, each allowed to fail on its own — a
// failed part simply leaves that figure blank (never an error banner: the
// roster itself must always work). All rules (marking, mastery, windows) are
// the server's; this only folds rows per child for display.

export interface Insight {
  /** Mean of the child's subject mastery %, or null when nothing is measured yet. */
  mastery: number | null;
  lastActive: number | null;
  nextLesson: { at: number; title: string; live: boolean } | null;
  overdue: number;
  toMark: number;
}
/** The raw rows behind the figures, for anything that folds them per GROUP (the group cards' status tiles).
 *  A part is null when its endpoint failed — callers show that tile without a status, never an error. */
export interface HwLite { id: string; title: string; assessmentId: string | null; dueAt: string; assignedChildIds: string[]; groupIds?: string[] }
export interface InboxLite { homeworkId: string; childId: string; status: string; dueAt: string; submittedAt: string | null; mark?: { markedAt?: string } | null }
export interface AttemptLite { childId: string; assessmentId: string; homeworkId: string | null; status: string; pct: number | null; submittedAt: string | null }
export interface LessonLite { id: string; title: string; startsAt: string; durationMins: number; childIds: string[]; groupIds?: string[]; status: string }
export interface RawRows { homework: HwLite[] | null; inbox: InboxLite[] | null; lessons: LessonLite[] | null; attempts: AttemptLite[] | null }
export type Insights = { byChild: Map<string, Insight>; loaded: boolean; failed: string[]; raw: RawRows };

const NONE: Insights = { byChild: new Map(), loaded: false, failed: [], raw: { homework: null, inbox: null, lessons: null, attempts: null } };

const arr = <T,>(r: unknown, key?: string): T[] => {
  if (Array.isArray(r)) return r as T[];
  const inner = key && r && typeof r === "object" ? (r as Record<string, unknown>)[key] : null;
  return Array.isArray(inner) ? (inner as T[]) : [];
};
const ms = (iso: string | null | undefined) => { const t = iso ? new Date(iso).getTime() : NaN; return Number.isNaN(t) ? 0 : t; };

interface OverviewRow { childId: string; subjects?: { masteryPct: number | null }[]; lastActive?: string | null }

export function useRosterInsights(qs: string): Insights & { reload: () => void } {
  const [state, setState] = useState<{ qs: string; data: Insights } | null>(null);
  const qsRef = useRef(qs);
  const seq = useRef(0);
  useEffect(() => { qsRef.current = qs; }, [qs]);

  const load = useCallback(() => {
    const mine = qsRef.current;
    const my = ++seq.current;
    const base = "/api/learning-hub";
    const paths = [`${base}/mastery/overview${mine}`, `${base}/homework/inbox${mine}`, `${base}/lessons${mine}`, `${base}/attempts${mine}`, `${base}/homework${mine}`];
    void Promise.allSettled(paths.map((p) => get<unknown>(p))).then((res) => {
      if (my !== seq.current || qsRef.current !== mine) return;
      const ok = <T,>(i: number, key?: string) => (res[i].status === "fulfilled" ? arr<T>((res[i] as PromiseFulfilledResult<unknown>).value, key) : []);
      const failed = ["mastery", "inbox", "lessons", "attempts", "homework"].filter((_, i) => res[i].status === "rejected");
      const overview = ok<OverviewRow>(0, "students"), inbox = ok<InboxLite>(1), lessons = ok<LessonLite>(2, "lessons"), attempts = ok<AttemptLite>(3);
      const homework = ok<HwLite>(4);
      const raw: RawRows = { homework: res[4].status === "fulfilled" ? homework : null, inbox: res[1].status === "fulfilled" ? inbox : null, lessons: res[2].status === "fulfilled" ? lessons : null, attempts: res[3].status === "fulfilled" ? attempts : null };
      const now = Date.now();
      const byChild = new Map<string, Insight>();
      const of = (id: string) => { let x = byChild.get(id); if (!x) { x = { mastery: null, lastActive: null, nextLesson: null, overdue: 0, toMark: 0 }; byChild.set(id, x); } return x; };
      const seen = (id: string, t: number) => { const x = of(id); if (t && (x.lastActive ?? 0) < t) x.lastActive = t; };

      for (const o of overview) {
        const v = (o.subjects ?? []).map((s) => s.masteryPct).filter((n): n is number => typeof n === "number");
        of(o.childId).mastery = v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
        seen(o.childId, ms(o.lastActive));
      }
      for (const r of inbox) {
        seen(r.childId, ms(r.submittedAt)); seen(r.childId, ms(r.mark?.markedAt));
        if (r.status === "submitted") of(r.childId).toMark++;
        else if (r.status === "assigned" && ms(r.dueAt) && ms(r.dueAt) < now) of(r.childId).overdue++;
      }
      for (const a of attempts) {
        if (a.status !== "in_progress") seen(a.childId, ms(a.submittedAt));
        if (a.status === "pending_marking") of(a.childId).toMark++;
      }
      for (const l of lessons) {
        if (l.status === "cancelled" || l.status === "ended") continue;
        const start = ms(l.startsAt), end = start + l.durationMins * 60_000;
        if (!start || now > end + 30 * 60_000) continue;
        const live = now >= start && now <= end;
        for (const id of l.childIds ?? []) {
          const x = of(id);
          if (!x.nextLesson || start < x.nextLesson.at) x.nextLesson = { at: start, title: l.title, live };
        }
      }
      setState({ qs: mine, data: { byChild, loaded: true, failed, raw } });
    });
  }, []);

  useEffect(() => { load(); }, [load, qs]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soon = useCallback(() => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(load, 400); }, [load]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useRealtime(["hubAttempts", "hubHomework", "hubSubmissions", "hubLessons", "hubEnrolments"], soon);

  const cur = state?.qs === qs ? state.data : NONE;
  return { ...cur, reload: load };
}
