"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { InboxRow, StudentHomework } from "../homework/hwTypes";
import type { Lesson } from "../live/lessonTypes";
import { errMsg } from "../types";
import { getShared } from "../homework/homeworkFeed";
import { asArray, hubUrl, type AssessmentLite, type AttemptRow, type DueLite, type MasteryLite, type OverviewStudent } from "./homeLib";

// Home reads from several endpoints at once and must survive any of them
// failing — so each is fetched on its own (allSettled) and a failure marks
// just that part. Results are keyed by (mode, provider, child): switching any
// of those clears the rows rather than showing the previous child's.

const CHANNELS = ["hubAttempts", "hubHomework", "hubSubmissions", "hubLessons", "hubFlashcards", "hubEnrolments"];

export interface TutorParts { lessons: Lesson[]; inbox: InboxRow[]; overview: OverviewStudent[]; attempts: AttemptRow[] }
export interface StudentParts { lessons: Lesson[]; homework: StudentHomework[]; due: DueLite | null; attempts: AttemptRow[]; mastery: MasteryLite | null; assessments: AssessmentLite[] }
export type Failed<T> = Partial<Record<keyof T, string>>;

interface Loaded<T> { key: string; parts: T; failed: Failed<T> }

type Spec<T> = { [K in keyof T]: { path: string; pick: (r: unknown) => T[K]; empty: T[K]; /** Read through the shared homework fetch (one call for Home and the Homework tab). */ shared?: boolean } };

function useParts<T>(key: string, make: () => Spec<T>, onError: (m: string) => void) {
  const [state, setState] = useState<Loaded<T> | null>(null);
  const keyRef = useRef(key);
  const specRef = useRef(make);
  const errRef = useRef(onError);
  const seq = useRef(0);
  const lastShown = useRef("");
  useEffect(() => { keyRef.current = key; specRef.current = make; errRef.current = onError; });

  const load = useCallback((force = false) => {
    const mine = keyRef.current;
    const my = ++seq.current;
    const spec = specRef.current();
    const names = Object.keys(spec) as (keyof T)[];
    void Promise.allSettled(names.map((n) => (spec[n].shared ? getShared<unknown>(spec[n].path, force) : get<unknown>(spec[n].path)))).then((results) => {
      if (my !== seq.current || keyRef.current !== mine) return; // a newer request (or another child) superseded this one
      const parts = {} as T;
      const failed: Failed<T> = {};
      results.forEach((r, i) => {
        const n = names[i];
        if (r.status === "fulfilled") parts[n] = spec[n].pick(r.value);
        else { parts[n] = spec[n].empty; failed[n] = errMsg(r.reason, "Couldn't load"); }
      });
      setState({ key: mine, parts, failed });
      const bad = Object.keys(failed);
      const summary = bad.length === names.length ? String((failed[names[0]] as string) ?? "Couldn't load Home") : "";
      // Only speak up when *everything* failed (each card explains its own gap otherwise) — and once per distinct message.
      if (summary && summary !== lastShown.current) errRef.current(summary);
      lastShown.current = summary;
    });
  }, []);

  useEffect(() => { seq.current++; setState(null); load(); }, [key, load]);

  // Several channels often fire for one action; fold them into one refetch.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => load(true), 350);
  }, [load]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useRealtime(CHANNELS, soon);

  const ready = state?.key === key;
  return { ready, parts: ready ? state!.parts : null, failed: ready ? state!.failed : ({} as Failed<T>), reload: () => load(true) };
}

export function useTutorHome(qs: string, onError: (m: string) => void) {
  const make = useCallback((): Spec<TutorParts> => ({
    lessons: { path: hubUrl(qs, "/lessons"), pick: (r) => asArray<Lesson>(r, "lessons"), empty: [] },
    inbox: { path: hubUrl(qs, "/homework/inbox"), pick: (r) => asArray<InboxRow>(r), empty: [] },
    overview: { path: hubUrl(qs, "/mastery/overview"), pick: (r) => asArray<OverviewStudent>(r, "students"), empty: [] },
    attempts: { path: hubUrl(qs, "/attempts"), pick: (r) => asArray<AttemptRow>(r), empty: [] },
  }), [qs]);
  return useParts<TutorParts>(`t|${qs}`, make, onError);
}

export function useStudentHome(qs: string, childId: string | null, onError: (m: string) => void) {
  const c = useMemo(() => ({ childId }), [childId]);
  const make = useCallback((): Spec<StudentParts> => ({
    lessons: { path: hubUrl(qs, "/lessons", c), pick: (r) => asArray<Lesson>(r, "lessons"), empty: [] },
    homework: { path: hubUrl(qs, "/homework", c), pick: (r) => asArray<StudentHomework>(r), empty: [], shared: true },
    due: { path: hubUrl(qs, "/flashcards/due", c), pick: (r) => { const d = r as Partial<DueLite> | null; return { dueCount: d?.dueCount ?? 0, newCount: d?.newCount ?? 0, upcoming: d?.upcoming ?? 0 }; }, empty: null as DueLite | null },
    attempts: { path: hubUrl(qs, "/attempts", c), pick: (r) => asArray<AttemptRow>(r), empty: [] },
    mastery: { path: hubUrl(qs, "/mastery", c), pick: (r) => (r && typeof r === "object" ? (r as MasteryLite) : null), empty: null as MasteryLite | null },
    assessments: { path: hubUrl(qs, "/assessments", c), pick: (r) => asArray<AssessmentLite>(r), empty: [] },
  }), [qs, c]);
  return useParts<StudentParts>(`s|${qs}|${childId ?? ""}`, make, onError);
}
