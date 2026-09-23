"use client";

import { useState } from "react";
import { setHubIntent, takeOpenStudent } from "./hubIntent";
import { Button } from "@/components/ui";
import { Icon } from "./kit";
import { post } from "@/lib/api";
import type { PanelMeta, PanelProps } from "./panelTypes";
import { CurriculumRings } from "./curriculum/CurriculumRings";
import { Overview } from "./progress/Overview";
import { ProgressView } from "./progress/ProgressView";
import { hubPath } from "./shared-assess/api";
import { EmptyState, FOCUS, TAP } from "./shared-assess/ui";
import { errMsg } from "./types";
import { useFamily } from "./family/FamilyContext";
import { KidStars } from "./progress/KidStars";

// Progress — the mastery dashboard. A family sees their chosen child's mastery by
// topic, growth from the placement-test baseline and the recent-quiz trend; a
// tutor sees every student at a glance and opens any one of them.
export const meta: PanelMeta = { key: "dashboard", label: "Progress", icon: "📈", status: "live", blurb: "Mastery by topic and how it's trending, built from your quiz and homework results." };

export function Panel(p: PanelProps) {
  // A student card ("Progress") lands here with that child already open.
  const [open, setOpen] = useState<{ id: string; name: string } | null>(() => (p.canEdit ? takeOpenStudent() : null));
  const [busy, setBusy] = useState(false);
  const kid = useFamily().kid;

  if (!p.canEdit) {
    if (kid && p.childId) return <KidStars p={p} childId={p.childId} />; // a child sees stars only (P-03)
    if (!p.childId) return <EmptyState icon="users" title="Choose a child" body="Pick which child's progress you'd like to see." />;
    return <><CurriculumRings qs={p.childQs ?? p.qs} canEdit={false} onOpenMap={() => p.goTo?.("notes")} /><ProgressView p={p} childId={p.childId} /></>;
  }

  if (!open) return <Overview p={p} onOpen={(id, name) => setOpen({ id, name })} />;

  const recompute = async () => {
    setBusy(true);
    try { await post(hubPath(p.qs, "/mastery/recompute"), { childId: open.id }); }
    catch (e) { p.onError(errMsg(e, "Couldn't recalculate")); }
    finally { setBusy(false); }
  };
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen(null)} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg pr-3 text-[13px] font-bold text-[var(--ink-2)] hover:text-[var(--brand)] ${FOCUS}`}><Icon name="arrowLeft" size={16} />All students</button>
        <div className="text-[16px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{open.name}</div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {!p.readOnly && <Button variant="solid" className={TAP} data-testid="hub-progress-set-homework" onClick={() => { setHubIntent({ kind: "homework", groupId: "", childIds: [open.id] }); p.goTo?.("homework"); }}>Set homework</Button>}
          {!p.readOnly && <Button variant="ghost" className={TAP} disabled={busy} onClick={recompute}>{busy ? "Recalculating…" : "↻ Recalculate"}</Button>}
        </div>
      </div>
      <ProgressView p={p} childId={open.id} />
    </div>
  );
}
