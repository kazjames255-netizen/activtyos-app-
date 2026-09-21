"use client";

import { useEffect, useMemo, useState } from "react";
import type { PanelProps } from "../../panelTypes";
import { Avatar, FOCUS, Pill, Skeleton, fmtDayTime, useNow, type Tone } from "../../teachKit";
import { Ico } from "../../teachIcons";
import { HomeworkForm } from "../../homework/HomeworkForm";
import { MarkDialog } from "../../homework/MarkDialog";
import { dueState, pctOf, type InboxRow, type TutorHomework } from "../../homework/hwTypes";
import type { Lesson } from "../lessonTypes";
import { WsButton, WsEmpty, WsSection, useShownName, useWsView, type Attendee } from "./wsKit";
import type { WsData } from "./useWorkspaceData";

// "Homework" — this lesson's students' homework: what's assigned, handed in and
// marked; mark a hand-in in place (the same dialog as the Homework tab); or set
// new homework with these students already ticked.

export function HomeworkTab({ p, lesson, attendees, data }: { p: PanelProps; lesson: Lesson; attendees: Attendee[]; data: WsData }) {
  const { present, hideNames, big } = useWsView();
  const shown = useShownName();
  const now = useNow(60_000);
  const { want } = data;
  useEffect(() => want(["inbox", "homework"]), [want]);
  const [marking, setMarking] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const ids = useMemo(() => new Set(attendees.map((a) => a.childId)), [attendees]);
  const idx = useMemo(() => new Map(attendees.map((a, i) => [a.childId, i])), [attendees]);
  const nameOf = (childId: string) => { const a = attendees.find((x) => x.childId === childId); return a ? shown(a, idx.get(childId) ?? 0) : "Student"; };

  const rows = useMemo(() => (data.inbox ?? []).filter((r) => ids.has(r.childId)), [data.inbox, ids]);
  const mine = useMemo(() => (data.homework ?? []).filter((h) => h.assignedChildIds.some((c) => ids.has(c)) || (h.groupIds ?? []).some((g) => (lesson.groupIds ?? []).includes(g)))
    .sort((a, b) => Number(a.counts.assigned + a.counts.submitted === 0) - Number(b.counts.assigned + b.counts.submitted === 0) || b.dueAt.localeCompare(a.dueAt)), [data.homework, ids, lesson.groupIds]);
  const toMark = rows.filter((r) => r.status === "submitted");
  const marker = marking ? rows.find((r) => r.submissionId === marking) ?? null : null;
  const next = marker ? toMark.find((r) => r.submissionId !== marker.submissionId) ?? null : null;

  const loading = (data.inbox === null || data.homework === null) && !data.failed.includes("inbox") && !data.failed.includes("homework");
  const many = attendees.length > 1;

  return (
    <div className="grid gap-3">
      {!present && (
        <WsButton variant="solid" icon="plus" id="ws-set-homework" onClick={() => setCreating(true)} className="w-full sm:w-auto sm:justify-self-start">
          {many ? "Set new homework for this group" : "Set new homework"}
        </WsButton>
      )}

      {toMark.length > 0 && !present && (
        <WsSection title={`To mark · ${toMark.length}`} icon="edit">
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {toMark.map((r) => (
              <li key={r.submissionId}>
                <button type="button" onClick={() => setMarking(r.submissionId)} data-mark={r.submissionId}
                  className={`flex min-h-[48px] w-full items-center gap-2.5 rounded-xl border border-[var(--brand-line)] bg-[var(--brand-soft)] px-3 py-2 text-left hover:border-[var(--brand)] ${FOCUS}`}>
                  <Avatar name={nameOf(r.childId)} size={28} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-extrabold text-[var(--ink)]">{nameOf(r.childId)}</span><span className="block truncate text-[11.5px] text-[var(--ink-2)]">{r.title}{r.late ? " · late" : ""}</span></span>
                  <span className="inline-flex items-center gap-1 text-[12px] font-extrabold text-[var(--brand)]">Mark <Ico name="chevronRight" size={14} /></span>
                </button>
              </li>
            ))}
          </ul>
        </WsSection>
      )}

      <WsSection title={`Set for ${many ? "this group" : "this student"}`} icon="homework">
        {loading ? <div className="grid gap-2"><Skeleton className="h-[72px]" /><Skeleton className="h-[72px]" /></div> : mine.length === 0 ? (
          <WsEmpty icon="homework" title="No homework set yet" body={present ? undefined : "Set some now — it goes straight to these students."} />
        ) : (
          <ul className="m-0 grid list-none gap-2 p-0">
            {mine.map((h) => <HwRow key={h.id} h={h} rows={rows.filter((r) => r.homeworkId === h.id)} now={now} big={big} nameOf={nameOf} hideNames={hideNames} />)}
          </ul>
        )}
      </WsSection>

      {marker && <MarkDialog row={marker} hasNext={!!next} qs={p.qs} onClose={() => setMarking(null)} onMarked={(adv) => { data.reload(); setMarking(adv && next ? next.submissionId : null); }} />}
      {creating && (
        <HomeworkForm homework={null} students={p.students} topics={p.topics} qs={p.qs} config={p.config} groups={p.groups ?? []}
          initialChildIds={attendees.map((a) => a.childId)} initialGroupIds={lesson.groupIds}
          onClose={() => setCreating(false)} onSaved={() => { setCreating(false); data.reload(); }} />
      )}
    </div>
  );
}

function HwRow({ h, rows, now, big, nameOf, hideNames }: { h: TutorHomework; rows: InboxRow[]; now: number; big: boolean; nameOf: (id: string) => string; hideNames: boolean }) {
  const c = { assigned: 0, submitted: 0, marked: 0 };
  for (const r of rows) c[r.status]++;
  const total = rows.length || 1;
  const overdueRows = rows.filter((r) => dueState(r.dueAt, r.status, now).overdue);
  const overdue = overdueRows.length > 0;
  const tone: Tone = overdue ? "red" : "neutral";
  return (
    <li className="rounded-xl border border-[var(--hub-warm-line)] bg-[var(--surface)] p-3" data-hw={h.id}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`min-w-0 flex-1 truncate font-extrabold text-[var(--ink)] ${big ? "text-[16px]" : "text-[13.5px]"}`}>{h.title}</span>
        <Pill tone={tone} icon={<Ico name="clock" size={12} />}>{overdue ? "Overdue" : "Due"} {fmtDayTime(h.dueAt)}</Pill>
      </div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[var(--panel)]" role="img" aria-label={`${c.marked} marked, ${c.submitted} handed in, ${c.assigned} not handed in`}>
        <span style={{ width: `${(c.marked / total) * 100}%`, background: "var(--green)" }} />
        <span style={{ width: `${(c.submitted / total) * 100}%`, background: "var(--brand-2)" }} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold text-[var(--ink-2)]">
        <span className="text-[var(--hub-green-ink)]">{c.marked} marked</span>
        <span className="text-[var(--brand)]">{c.submitted} handed in</span>
        <span>{c.assigned} to do</span>
      </div>
      {rows.some((r) => r.status === "marked") && !hideNames && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">{rows.filter((r) => r.status === "marked" && r.mark).map((r) => <Pill key={r.submissionId} tone="green">{nameOf(r.childId).split(" ")[0]} {pctOf(r.mark!)}%</Pill>)}</div>
      )}
    </li>
  );
}
