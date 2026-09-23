"use client";

import { useEffect, useMemo, useState } from "react";
import { takeHubIntent } from "../hubIntent";
import type { PanelProps } from "../panelTypes";
import { hubPath, type AssessType, type AttemptRow } from "../shared-assess/api";
import { useHubData } from "../shared-assess/hooks";
import { Notice, Segmented } from "../shared-assess/ui";
import { AssessmentList } from "./AssessmentList";
import { useAssessmentPage } from "./useAssessmentPage";
import { MarkingQueue } from "./MarkingQueue";
import { QuestionBank } from "./QuestionBank";
import { Results, type GroupScope } from "./Results";
import { useGroupView } from "../groupKit";
import { isQuizHw, membersOf, relevantTo } from "../groupStatus";
import type { HwLite } from "../useRosterInsights";

// The tutor's workspace for quizzes / placement tests: build them, keep the
// question bank, mark written answers, review results. Same component for both
// panels; `type` picks which kind of assessment it manages.

type Tab = "list" | "bank" | "marking" | "results";

export function TutorAssess({ p, type }: { p: PanelProps; type: AssessType }) {
  // A group card's Quiz tile lands on Results filtered to that group: its members' attempts at the quizzes set for it.
  const { group: viewGroup, clear: clearView } = useGroupView("quiz", p.groups ?? []);
  const vg = type === "quiz" ? viewGroup : null;
  const [tab, setTab] = useState<Tab>(() => (vg ? "results" : "list"));
  // Home's "Written answers to mark" lands on this kind's Marking tab.
  useEffect(() => { if (takeHubIntent(["marking"])) setTab("marking"); }, []);
  const hw = useHubData<HwLite[]>(vg ? hubPath(p.qs, "/homework") : null, ["hubHomework"]);
  const scope = useMemo<GroupScope | null>(() => {
    if (!vg) return null;
    const m = membersOf(vg);
    const set = (Array.isArray(hw.data) ? hw.data : []).filter((h) => isQuizHw(h) && relevantTo(vg, m, h.groupIds, h.assignedChildIds));
    const aIds = new Set(set.map((h) => h.assessmentId)), hIds = new Set(set.map((h) => h.id));
    return { group: vg, onClear: clearView, keep: (r) => m.has(r.childId) && (!set.length || aIds.has(r.assessmentId) || (!!r.homeworkId && hIds.has(r.homeworkId))) };
  }, [vg, hw.data, clearView]);
  // SCALE: a library can hold thousands of papers (the Oak import: 8.5k), so the workspace never downloads the list. The
  // Quizzes tab pages it server-side (AssessmentList → useAssessmentPage); questions are fetched per topic by the bank and
  // the builder's picker (paged, searchable), never as one list.
  // The full attempt history (newest 300) is only needed for the list's per-paper numbers and the Results tab; the Marking
  // queue asks for JUST the papers waiting (so an old paper is never pushed out of the window, and the marking tab / question bank
  // don't download the lot).
  const att = useHubData<AttemptRow[]>(tab === "list" || tab === "results" ? hubPath(p.qs, "/attempts") : null, ["hubAttempts"]);
  const waiting = useHubData<AttemptRow[]>(hubPath(p.qs, "/attempts", { status: "pending_marking" }), ["hubAttempts"]);
  const diag = type === "diagnostic";

  // Results / Marking only need the papers their attempts point at (title, pass mark, subject / topics for the sidebar
  // filter): fetch exactly those rows by id — a few hundred at most, not the library.
  const refIds = useMemo(() => {
    if (tab !== "results" && tab !== "marking") return null;
    return [...new Set([...(att.data ?? []), ...(waiting.data ?? [])].map((r) => r.assessmentId))].sort().slice(0, 300);
  }, [tab, att.data, waiting.data]);
  const refs = useAssessmentPage(p.qs, { ids: refIds ?? [] }, undefined, !!refIds?.length);
  const assessments = refs.items;
  const aType = useMemo(() => new Map(assessments.map((x) => [x.id, x.type])), [assessments]);
  const ofType = useMemo(() => (att.data ?? []).filter((r) => (r.assessmentType ?? aType.get(r.assessmentId)) === type), [att.data, aType, type]);
  const pending = useMemo(() => (waiting.data ?? []).filter((r) => (r.assessmentType ?? aType.get(r.assessmentId)) === type), [waiting.data, aType, type]);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const err = refs.error;

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto pb-0.5">
        <Segmented<Tab> label="Section" value={tab} onChange={setTab} options={[
          { id: "list", label: diag ? "Starting quizzes" : "Quizzes" },
          { id: "bank", label: "Question bank" },
          { id: "marking", label: "Marking", count: pending.length },
          { id: "results", label: "Results" },
        ]} />
      </div>
      {err && dismissed !== err && <Notice onDismiss={() => setDismissed(err)}>{err}</Notice>}

      {tab === "list" && <AssessmentList p={p} type={type} attempts={att.data ? ofType : null} onGoMarking={() => setTab("marking")} />}
      {tab === "bank" && <QuestionBank p={p} />}
      {tab === "marking" && <MarkingQueue p={p} rows={waiting.data ? pending : null} assessments={assessments} loading={waiting.loading} reload={waiting.reload} />}
      {tab === "results" && <Results p={p} type={type as AssessType} rows={att.data} assessments={assessments} loading={att.loading} error={att.error} scope={scope} />}
    </div>
  );
}
