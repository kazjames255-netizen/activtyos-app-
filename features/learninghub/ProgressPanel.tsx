"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { setHubIntent, takeOpenStudent } from "./hubIntent";
import { Button } from "@/components/ui";
import { Icon, SkeletonRows } from "./kit";
import { post } from "@/lib/api";
import type { PanelMeta, PanelProps } from "./panelTypes";
import { hubPath } from "./shared-assess/api";
import { EmptyState, FOCUS, TAP } from "./shared-assess/ui";
import { errMsg } from "./types";
import { useFamily } from "./family/FamilyContext";
import { GamesSummaryCard } from "./games/GamesSummaryCard";
import { GamesPlayedPanel } from "./games/GamesPlayedPanel";
import { KidProgressCards } from "./progress/ProgressCards";
import { SubjectOrbs } from "./progress/SubjectOrbs";
import { PARENT_COPY } from "./family/parentCopy";
import { useT } from "@/lib/i18n/provider";
import { hubT } from "./family/hubT";

// Progress — the mastery dashboard. A family sees their chosen child's mastery by
// topic, growth from the placement-test baseline and the recent-quiz trend; a
// tutor sees every student at a glance and opens any one of them. A tutor never
// needs the family-only pieces (CurriculumRings, KidStars, ProgressReport) nor a
// family the tutor-only roster (Overview) — load each when the branch that needs
// it actually renders, same as Quizzes/Homework/Diagnostic/Flashcards do.
const CurriculumRings = dynamic(() => import("./curriculum/CurriculumRings").then((m) => m.CurriculumRings), { loading: () => <SkeletonRows rows={1} label={hubT("hubfam.loading")} /> });
const Overview = dynamic(() => import("./progress/Overview").then((m) => m.Overview), { loading: () => <SkeletonRows rows={3} label={hubT("hubfam.loading")} /> });
const ProgressView = dynamic(() => import("./progress/ProgressView").then((m) => m.ProgressView), { loading: () => <SkeletonRows rows={3} label={hubT("hubfam.loading")} /> });
const KidStars = dynamic(() => import("./progress/KidStars").then((m) => m.KidStars), { loading: () => <SkeletonRows rows={2} label={hubT("hubfam.loading")} /> });
const ProgressReport = dynamic(() => import("./progress/ProgressReport").then((m) => m.ProgressReport));
const PenguinTutorPanel = dynamic(() => import("./games/penguin/TutorPanel").then((m) => m.PenguinTutorPanel), { loading: () => <SkeletonRows rows={1} label={hubT("hubfam.loading")} /> });

export const meta: PanelMeta = { key: "dashboard", label: "Progress", icon: "📈", status: "live", blurb: "Mastery by topic and how it's trending, built from your quiz and homework results." };

export function Panel(p: PanelProps) {
  const t = useT();
  // A student card ("Progress") lands here with that child already open.
  const [open, setOpen] = useState<{ id: string; name: string } | null>(() => (p.canEdit ? takeOpenStudent() : null));
  const [busy, setBusy] = useState(false);
  const kid = useFamily().kid;
  const [report, setReport] = useState(false);

  if (!p.canEdit) {
    if (kid && p.childId) return <div className="grid gap-4"><KidStars p={p} childId={p.childId} /><SubjectOrbs p={p} childId={p.childId} kid /><KidProgressCards p={p} childId={p.childId} /></div>; // a child sees their stars and (owner: "child needs to see this info too") the same at-a-glance cards
    if (!p.childId) return <EmptyState icon="users" title={t("hubfam.pgChooseChild")} body={t("hubfam.pgChooseChildBody")} />;
    return (
      <>
        <div className="mb-3 flex justify-end">
          <button type="button" onClick={() => setReport(true)} data-testid="hub-report-open"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-[13px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] focus-visible:ring-2 focus-visible:ring-[var(--brand-2)]">
            {PARENT_COPY.reportButton}
          </button>
        </div>
        <div className="mb-3"><SubjectOrbs p={p} childId={p.childId} kid={false} /></div>
        <div className="mb-3"><GamesSummaryCard p={p} /></div>
        <CurriculumRings qs={p.childQs ?? p.qs} canEdit={false} onOpenMap={() => p.goTo?.("notes")} /><ProgressView p={p} childId={p.childId} />
        {report && <ProgressReport p={p} childId={p.childId} onClose={() => setReport(false)} />}
      </>
    );
  }

  if (!open) return <Overview p={p} onOpen={(id, name) => setOpen({ id, name })} />;

  const recompute = async () => {
    setBusy(true);
    try { await post(hubPath(p.qs, "/mastery/recompute"), { childId: open.id }); }
    catch (e) { p.onError(errMsg(e, t("hubfam.pgCouldntRecalc"))); }
    finally { setBusy(false); }
  };
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen(null)} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg pe-3 text-[13px] font-bold text-[var(--ink-2)] hover:text-[var(--brand)] ${FOCUS}`}><Icon name="arrowLeft" size={16} className="rtl:rotate-180" />{t("hubfam.pgAllStudents")}</button>
        <div className="text-[16px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{open.name}</div>
        <div className="ms-auto flex flex-wrap items-center gap-1.5">
          {!p.readOnly && <Button variant="solid" className={TAP} data-testid="hub-progress-set-homework" onClick={() => { setHubIntent({ kind: "homework", groupId: "", childIds: [open.id] }); p.goTo?.("homework"); }}>{t("hubfam.pgSetHomework")}</Button>}
          {!p.readOnly && <Button variant="ghost" className={TAP} disabled={busy} onClick={recompute}>{busy ? t("hubfam.pgRecalculating") : t("hubfam.pgRecalc")}</Button>}
        </div>
      </div>
      <ProgressView p={p} childId={open.id} />
      {/* Penguin Slide play is family-only, but its fact-strength evidence is a tutor's business: this is the one
          place it was ever wired to render (games/penguin/TutorPanel.tsx was built but never mounted before). */}
      <GamesPlayedPanel detailOnly childId={open.id} childName={open.name} tenantQuery={p.qs.replace(/^\?/, "")}
        detail={<div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4"><PenguinTutorPanel childId={open.id} childName={open.name} tenantQuery={p.qs.replace(/^\?/, "")} /></div>} />
    </div>
  );
}
