"use client";

import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui";
import { Ico } from "../teachIcons";
import { FOCUS, fmtClock, fmtDay, relDay } from "../teachKit";
const clock = (ms: number) => fmtClock(new Date(ms).toISOString());
import type { Lesson } from "./lessonTypes";

// A lesson scheduled AHEAD to run in person (POST /lessons {mode:"in_person"}): it has no room and nothing to join, so it
// gets its own row instead of the video LessonRow's join window. The tutor presses "Start in-person session" when the
// children are with them (POST /in-person/sessions/:id/start → the ordinary in-person flow); a family just sees when and
// with whom. Cancelled ones stay listed as cancelled so nobody wonders where a lesson went.

export function ScheduledInPersonRow({ lesson, now, isTutor, readOnly = false, tutorLabel, attendees, busy, onStart, onEdit, onCancel, onCancelFollowing }: {
  lesson: Lesson;
  now: number;
  isTutor: boolean;
  readOnly?: boolean;
  tutorLabel: string;
  attendees: string[];
  busy: boolean;
  onStart: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onCancelFollowing?: () => void;
}) {
  const t = useT();
  const cancelled = lesson.status === "cancelled";
  const startMs = new Date(lesson.startsAt).getTime();
  const endMs = startMs + lesson.durationMins * 60_000;
  const overdue = !cancelled && endMs < now;
  const write = isTutor && !readOnly;
  return (
    <div data-ui="card" data-ip-scheduled-id={lesson.id} data-status={lesson.status}
      className={`relative rounded-2xl border bg-[var(--surface)] p-3.5 shadow-[var(--shadow-sm)] ${cancelled ? "border-[var(--red-line)] opacity-80" : "border-[var(--gold-line)]"}`}>
      {!cancelled && <span aria-hidden className="absolute bottom-3 start-0 top-3 w-[3px] rounded-e bg-[var(--gold)]" />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <span aria-hidden className="grid h-[58px] w-[58px] flex-none place-items-center rounded-2xl bg-[var(--gold-soft)] text-[var(--brand-ink)]"><Ico name="users" size={26} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-0 truncate text-[15px] font-extrabold text-[var(--ink)]">{lesson.title}</span>
              <span data-testid="hub-ip-badge" className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-[3px] text-[11px] font-extrabold text-[var(--ink-2)]"><Ico name="users" size={12} />{t("hublive.aIp_inPerson")}</span>
              {cancelled && <span className="inline-flex items-center rounded-full border px-2.5 py-[3px] text-[11px] font-extrabold" style={{ background: "var(--red-soft)", color: "var(--red)", borderColor: "var(--red-line)" }}>{t("hublive.aKit_cancelled")}</span>}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-[var(--ink-2)]">
              <span className="inline-flex items-center gap-1"><Ico name="calendar" size={13} className="text-[var(--ink-3)]" />{overdue ? t("hublive.aIp_dueOn", { date: fmtDay(lesson.startsAt) }) : relDay(lesson.startsAt, now)}</span>
              <span className="inline-flex items-center gap-1 tabular-nums"><Ico name="clock" size={13} className="text-[var(--ink-3)]" />{clock(startMs)}–{clock(endMs)}</span>
              <span className="text-[var(--ink-3)]">{t("hublive.aLobby_min", { n: lesson.durationMins })}</span>
              {lesson.seriesId && lesson.seriesCount && <span data-testid="hub-lesson-series" className="inline-flex items-center gap-1 text-[var(--ink-3)]"><Ico name="refresh" size={12} />{t("hublive.aCards_weekly", { i: (lesson.seriesIndex ?? 0) + 1, n: lesson.seriesCount })}</span>}
            </div>
            <p className="m-0 mt-1 text-[12px] text-[var(--ink-3)]">
              {isTutor ? (attendees.length ? attendees.join(", ") : "") : t("hublive.aIp_familyNote", { tutor: tutorLabel })}
              {isTutor && !cancelled ? <span className="block">{t("hublive.aIp_tutorNote")}</span> : null}
            </p>
            {!!lesson.notes && <p className="m-0 mt-1.5 whitespace-pre-wrap text-[12.5px] text-[var(--ink-2)]">{lesson.notes}</p>}
          </div>
        </div>
        {write && !cancelled && (
          <div className="flex flex-none flex-wrap items-center gap-1.5 sm:justify-end">
            <Button variant="solid" className={`min-h-[46px] ${FOCUS}`} disabled={busy} data-testid={`ip-start-${lesson.id}`} onClick={onStart}>
              <Ico name="users" size={16} />{busy ? t("hublive.aIp_starting") : t("hublive.aIp_start")}
            </Button>
            <button type="button" onClick={onEdit} aria-label={t("hublive.aCards_editTitle", { title: lesson.title })} title={t("hublive.aCards_editLesson")}
              className={`grid h-11 w-11 flex-none place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)] ${FOCUS}`}><Ico name="edit" size={16} /></button>
            <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} disabled={busy} data-testid={`ip-cancel-${lesson.id}`} onClick={onCancel}>{t("hublive.aCards_cancelLesson")}</Button>
            {onCancelFollowing && lesson.seriesId && (lesson.seriesIndex ?? 0) < (lesson.seriesCount ?? 1) - 1 && (
              <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} disabled={busy} data-testid={`ip-cancel-following-${lesson.id}`} onClick={onCancelFollowing}>{t("hublive.aCards_cancelSeries")}</Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
