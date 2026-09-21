"use client";

import { useEffect, useMemo } from "react";
import type { PanelProps } from "../../panelTypes";
import { MiniRing } from "../../kit";
import { Avatar, FOCUS, Pill, Skeleton, fmtClock } from "../../teachKit";
import { Ico } from "../../teachIcons";
import { bandTone } from "../../home/homeLib";
import { dueState } from "../../homework/hwTypes";
import type { Lesson } from "../lessonTypes";
import { WsEmpty, useShownName, useWsView, type Attendee } from "./wsKit";
import type { WsData } from "./useWorkspaceData";
import { lessonSubject } from "./wsLib";

// "Students" — one card per person in THIS lesson: joined?, mastery ring + level
// band, homework due / overdue, flashcards due, last quiz. Tapping a card opens
// their full Progress view in a drawer.

export function StudentsTab({ p, lesson, attendees, data, groupNames, now, onOpen }: {
  p: PanelProps; lesson: Lesson; attendees: Attendee[]; data: WsData; groupNames: string[]; now: number; onOpen: (childId: string) => void;
}) {
  const { hideNames, present, big } = useWsView();
  const { want } = data;
  useEffect(() => want(["overview", "inbox", "flash", "attempts"]), [want]);
  const shown = useShownName();
  const subject = lessonSubject(p.topics, lesson);
  const bands = p.config.masteryBands;
  // A shared screen (present / hide names) never opens another child's full progress.
  const locked = present || hideNames;

  const rows = useMemo(() => attendees.map((a) => {
    const ov = data.overview?.find((s) => s.childId === a.childId);
    const subs = (ov?.subjects ?? []).filter((s) => s.masteryPct != null);
    const inSubject = subject ? subs.find((s) => s.subject === subject) : null;
    const pct = inSubject ? inSubject.masteryPct : subs.length ? Math.round(subs.reduce((n, s) => n + (s.masteryPct ?? 0), 0) / subs.length) : null;
    const tone = bandTone(pct, bands);
    // When this student has nothing in the lesson's subject yet, say so: the ring is then their overall level.
    const scope = inSubject ? subject : null;
    const hw = (data.inbox ?? []).filter((r) => r.childId === a.childId && r.status === "assigned");
    const overdue = hw.filter((r) => dueState(r.dueAt, r.status, now).overdue).length;
    const tomark = (data.inbox ?? []).filter((r) => r.childId === a.childId && r.status === "submitted").length;
    const fc = data.flash?.find((s) => s.childId === a.childId)?.due ?? null;
    const q = (data.attempts ?? []).filter((t) => t.childId === a.childId && t.status === "marked" && t.assessmentType !== "diagnostic" && t.pct != null)
      .sort((x, y) => (y.submittedAt ?? "").localeCompare(x.submittedAt ?? ""))[0] ?? null;
    return { a, pct, tone, scope, hwOpen: hw.length, overdue, tomark, fc, q };
  }), [attendees, data, subject, bands, now]);

  const ovLoading = data.overview === null && !data.failed.includes("overview");
  const loading = (data.overview === null || data.inbox === null) && data.failed.length === 0;
  if (!attendees.length) return <WsEmpty icon="users" title="No students on this lesson" body="Edit the lesson to invite students." />;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--ink-2)]">
        <span className="font-bold">{attendees.length} {attendees.length === 1 ? "student" : "students"}</span>
        {groupNames.map((g) => <Pill key={g} tone="violet" icon={<Ico name="users" size={12} />}>{g}</Pill>)}
        {subject && <Pill tone="brand">{subject}</Pill>}
      </div>
      <ul className="grid list-none gap-2.5 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr))]" aria-label="Students in this lesson">
        {rows.map(({ a, pct, tone, scope, hwOpen, overdue, tomark, fc, q }, i) => {
          const name = shown(a, i);
          return (
            <li key={a.childId} data-student={a.childId}>
              <button type="button" onClick={() => onOpen(a.childId)} disabled={locked} aria-label={locked ? undefined : `${name}: open progress`}
                className={`grid min-h-[44px] w-full gap-2.5 rounded-2xl border border-[var(--hub-warm-line)] bg-[var(--surface)] p-3 text-left shadow-[var(--shadow-sm)] transition hover:-translate-y-px hover:border-[var(--brand)] hover:shadow-[var(--shadow)] disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:border-[var(--hub-warm-line)] motion-reduce:transition-none ${FOCUS}`}>
                <span className="flex items-center gap-2.5">
                  <Avatar name={name} size={big ? 40 : 34} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-extrabold text-[var(--ink)] ${big ? "text-[17px]" : "text-[14px]"}`}>{name}</span>
                    <span className="block truncate text-[11.5px] text-[var(--ink-3)]">{hideNames ? " " : a.yearGroup ?? " "}</span>
                  </span>
                  {lesson.attendance !== undefined && (
                    <span className={`inline-flex flex-none items-center gap-1 rounded-full border px-2 py-[3px] text-[11px] font-extrabold ${a.joinedAt ? "border-[var(--green-line)] bg-[var(--green-soft)] text-[var(--hub-green-ink)]" : "border-[var(--line)] bg-[var(--panel)] text-[var(--ink-3)]"}`} title={a.joinedAt ? `Joined at ${fmtClock(a.joinedAt)}` : "Hasn't joined yet"}>
                      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${a.joinedAt ? "bg-[var(--green)]" : "bg-[var(--ink-3)]"}`} />{a.joinedAt ? `Joined ${fmtClock(a.joinedAt)}` : "Not yet"}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  {ovLoading
                    ? <span aria-hidden className="flex-none" style={{ width: big ? 62 : 54, height: big ? 62 : 54 }}><Skeleton className="h-full w-full !rounded-full" /></span>
                    : hideNames
                    ? <span aria-hidden className="grid flex-none place-items-center rounded-full bg-[var(--panel)] text-[var(--ink-3)]" style={{ width: big ? 62 : 54, height: big ? 62 : 54 }}><Ico name="eyeOff" size={big ? 24 : 20} /></span>
                    : <MiniRing pct={pct} size={big ? 62 : 54} stroke={6} color={tone?.fill ?? "var(--brand)"} />}
                  <span className="min-w-0 flex-1 text-[12px] leading-snug text-[var(--ink-2)]">
                    <span className="block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{scope ? `${scope} level` : "Overall level"}</span>
                    {ovLoading ? <Skeleton className="mt-1 h-4 w-24" /> : <span className={`block font-extrabold ${big ? "text-[15px]" : "text-[13px]"}`} style={{ color: tone ? `color-mix(in srgb, ${tone.fill} 55%, var(--ink))` : "var(--ink-3)" }}>{tone?.label ?? "Not started yet"}</span>}
                  </span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {loading ? <Skeleton className="h-6 w-full" /> : (
                    <>
                      <Pill tone={overdue ? "red" : hwOpen ? "gold" : "green"} icon={<Ico name="homework" size={12} />}>{overdue ? `${overdue} overdue` : hwOpen ? `${hwOpen} due` : "Homework clear"}</Pill>
                      {tomark > 0 && !present && <Pill tone="brand">{tomark} to mark</Pill>}
                      {fc != null && <Pill tone={fc ? "violet" : "neutral"} icon={<Ico name="cards" size={12} />}>{fc} card{fc === 1 ? "" : "s"} due</Pill>}
                      <Pill tone="neutral" icon={<Ico name="quiz" size={12} />}>{q && !hideNames ? `Quiz ${Math.round(q.pct ?? 0)}%` : q ? "Quiz taken" : "No quiz yet"}</Pill>
                    </>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!locked && <p className="m-0 text-[11.5px] text-[var(--ink-3)]">Tap a student to see their full progress.</p>}
    </div>
  );
}

