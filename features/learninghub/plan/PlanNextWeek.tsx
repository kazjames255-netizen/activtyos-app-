"use client";

import { useState } from "react";
import { Button, Select } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { FOCUS } from "../teachKit";
import { groupMemberIds, type HubGroup, type Student } from "../types";
import { AutoPlanSheet } from "./AutoPlanSheet";
import { setPlanItems, type PlanItem, type PlanTarget } from "./planApi";

// "Plan next week" trigger + sheet for one child or one group (docs/auto-plan.md). Accepting posts one homework per ticked
// item through setPlanItems, then calls onDone so the host refetches. The API needs at least one student overall, so a
// group plan also lists the group's member ids.

export interface PlanNextWeekProps {
  target: PlanTarget;
  targetName: string;
  /** Member ids, for a group target. */
  memberIds?: string[];
  qs: string;
  onDone?: () => void;
  /** Render only the sheet (no trigger button); the host owns open state. */
  open?: boolean;
  onClose?: () => void;
  testId?: string;
  className?: string;
}

export const PLAN_BTN = `inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1 rounded-full border border-[var(--line)] px-3 text-[12px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`;

export function PlanNextWeek({ target, targetName, memberIds = [], qs, onDone, open: controlled, onClose, testId, className }: PlanNextWeekProps) {
  const t = useT();
  const [own, setOwn] = useState(false);
  const open = controlled ?? own;
  const close = () => { setOwn(false); onClose?.(); };
  const accept = async (items: PlanItem[]) => {
    const to = target.groupId ? { groupIds: [target.groupId], childIds: memberIds } : { childIds: target.childId ? [target.childId] : [] };
    try { await setPlanItems(items, to, qs); } finally { onDone?.(); } // refetch even after a partial failure, so what landed shows
    close();
  };
  return (
    <>
      {controlled === undefined && (
        <button type="button" data-testid={testId ?? "hub-plan-next-week"} onClick={() => setOwn(true)} className={className ?? PLAN_BTN} aria-label={t("hubplan.pick_aria", { name: targetName })}>
          {t("hubplan.title")}
        </button>
      )}
      {open && <AutoPlanSheet target={target} targetName={targetName} qs={qs} onClose={close} onAccept={accept} />}
    </>
  );
}

/** Toolbar version (Homework tab): pick a student or a group first, then plan. */
export function PlanPicker({ students, groups, qs, onDone }: { students: Student[]; groups: HubGroup[]; qs: string; onDone?: () => void }) {
  const t = useT();
  const [pick, setPick] = useState("");
  const [open, setOpen] = useState(false);
  const active = students.filter((s) => s.active !== false);
  if (!active.length && !groups.length) return null;
  const g = pick.startsWith("g:") ? groups.find((x) => x.id === pick.slice(2)) : undefined;
  const c = pick.startsWith("c:") ? active.find((x) => x.childId === pick.slice(2)) : undefined;
  const target: PlanTarget | null = g ? { groupId: g.id } : c ? { childId: c.childId } : null;
  const name = g?.name ?? c?.childName ?? "";
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="hub-plan-picker">
      <Select value={pick} onChange={(e) => setPick(e.target.value)} className="min-h-[44px] w-full sm:w-56" aria-label={t("hubplan.pick_who")}>
        <option value="">{t("hubplan.pick_ph")}</option>
        {groups.length > 0 && <optgroup label={t("hubplan.pick_groups")}>{groups.map((x) => <option key={x.id} value={`g:${x.id}`}>{x.name}</option>)}</optgroup>}
        {active.length > 0 && <optgroup label={t("hubplan.pick_students")}>{active.map((x) => <option key={x.childId} value={`c:${x.childId}`}>{x.childName}</option>)}</optgroup>}
      </Select>
      <Button className={`min-h-[44px] ${FOCUS}`} disabled={!target} onClick={() => setOpen(true)} data-testid="hub-plan-go">{t("hubplan.title")}</Button>
      {target && <PlanNextWeek target={target} targetName={name} memberIds={g ? groupMemberIds(g) : []} qs={qs} open={open} onClose={() => setOpen(false)} onDone={onDone} />}
    </div>
  );
}
