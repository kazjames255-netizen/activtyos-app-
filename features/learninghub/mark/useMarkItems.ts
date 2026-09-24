"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { hubPath, type AttemptRow } from "../shared-assess/api";
import { useAssessmentPage } from "../quiz/useAssessmentPage";
import type { InboxRow } from "../homework/hwTypes";
import { withQs } from "../teachKit";
import type { Student } from "../types";

// R-2 One Mark queue: the three existing queues (homework hand-ins, quiz written answers, starting-quiz written answers) read from
// the EXISTING endpoints and merged into one list, longest-waiting first. Nothing is written here; marking still goes through the
// old MarkDialog / MarkForm and the old endpoints.

export type MarkKind = "homework" | "quiz" | "starting";
export interface MarkItem {
  key: string; kind: MarkKind; id: string;
  childName: string; what: string; at: string | null;
  late?: boolean; detail?: string;
  hw?: InboxRow; attempt?: AttemptRow;
}
export const KIND_LABEL: Record<MarkKind, string> = { homework: "Homework", quiz: "Quiz answers", starting: "Starting quiz" };

export function useMarkItems(qs: string, students: Student[], enabled = true) {
  const [inbox, setInbox] = useState<InboxRow[] | null>(null);
  const [waiting, setWaiting] = useState<AttemptRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const load = useCallback(() => {
    if (!enabled) return;
    get<InboxRow[]>(`/api/learning-hub/homework/inbox${withQs(qs, {})}`).then((r) => { if (live.current) { setInbox(Array.isArray(r) ? r.filter((x) => x.status === "submitted") : []); setFailed(false); } }).catch(() => { if (live.current) { setInbox((c) => c ?? []); setFailed(true); } });
    get<AttemptRow[]>(hubPath(qs, "/attempts", { status: "pending_marking" })).then((r) => { if (live.current) setWaiting(Array.isArray(r) ? r : []); }).catch(() => { if (live.current) { setWaiting((c) => c ?? []); setFailed(true); } });
  }, [qs, enabled]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset then refetch when the provider changes (same as the other hub loaders)
  useEffect(() => { setInbox(null); setWaiting(null); load(); }, [load]);
  useRealtime(enabled ? ["hubHomework", "hubSubmissions", "hubAttempts"] : [], load);

  // Titles / kinds of the papers the attempts point at (the same look-up the Quizzes tab's Marking sub-tab does).
  const refIds = useMemo(() => [...new Set((waiting ?? []).map((r) => r.assessmentId))].sort().slice(0, 300), [waiting]);
  const refs = useAssessmentPage(qs, { ids: refIds }, undefined, enabled && refIds.length > 0);
  const meta = useMemo(() => new Map(refs.items.map((a) => [a.id, a])), [refs.items]);
  const names = useMemo(() => new Map(students.map((s) => [s.childId, s.childName])), [students]);

  const ready = inbox !== null && waiting !== null && (refIds.length === 0 || refs.loaded);
  const items = useMemo<MarkItem[]>(() => {
    const out: MarkItem[] = [];
    for (const r of inbox ?? []) out.push({ key: `homework:${r.submissionId}`, kind: "homework", id: r.submissionId, childName: r.childName, what: r.title, at: r.submittedAt, late: r.late, hw: r, detail: r.attemptPending ? "Quiz part needs marking too" : undefined });
    for (const a of waiting ?? []) {
      const m = meta.get(a.assessmentId);
      const type = a.assessmentType ?? m?.type ?? "quiz";
      out.push({ key: `attempt:${a.id}`, kind: type === "diagnostic" ? "starting" : "quiz", id: a.id, childName: a.childName ?? names.get(a.childId) ?? "Student", what: a.assessmentTitle ?? m?.title ?? "Assessment", at: a.submittedAt, attempt: a, detail: a.writtenPending ? `${a.writtenPending} written to mark` : undefined });
    }
    return out.sort((x, y) => (x.at ? new Date(x.at).getTime() : Infinity) - (y.at ? new Date(y.at).getTime() : Infinity));
  }, [inbox, waiting, meta, names]);

  return { items, ready, failed, reload: load, count: items.length, byKind: { homework: items.filter((i) => i.kind === "homework").length, quiz: items.filter((i) => i.kind === "quiz").length, starting: items.filter((i) => i.kind === "starting").length } };
}
