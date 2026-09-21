"use client";

import { useState } from "react";
import type { Topic } from "../types";
import { topicLabel } from "../types";
import { subjectColor, subjectInk, tint } from "../kit";
import { SubjectGlyph } from "../subjectArt";
import { DISPLAY, FOCUS, HERO_BG, MenuItem, MoreMenu, fmtClock, fmtDay, humanSpan, relDay, tzLabel } from "../teachKit";
import { GradientTile, Ico } from "../teachIcons";
import { Stack } from "../home/homeKit";
import { CountdownRing, LessonNotes, stageInfo } from "./liveKit";
import { VideoChip } from "../videoKit";
import { lessonTiming, type Lesson, type Stage } from "./lessonTypes";

// The "next lesson" hero and the lesson rows (upcoming / past). One state
// machine (liveKit.stageInfo) drives the copy AND the single primary action, so
// the hero can never say "scheduled time is over" next to "Start lesson".

const clock = (ms: number) => fmtClock(new Date(ms).toISOString());
const names = (list: string[], max = 2) => (list.length <= max ? list.join(", ") : `${list.slice(0, max).join(", ")} +${list.length - max}`);

const STAGE_PILL: Record<Stage, string> = {
  upcoming: "bg-white/15 text-white",
  soon: "bg-[var(--hub-green-fill)] text-white",
  live: "bg-[var(--red)] text-white",
  grace: "bg-[var(--gold)] text-[var(--brand-ink)]",
  rejoin: "bg-[var(--gold)] text-[var(--brand-ink)]",
  ended: "bg-white/15 text-white",
  cancelled: "bg-white/15 text-white",
};

/** A lesson someone has been in already — worth offering the one-click "Skip the check" (straight in, no lobby). It is worded as what it
 *  skips, never as a second "Rejoin": the main button (labelled Rejoin lesson / Join now) opens the camera check first. */
const canQuick = (stage: Stage, status: Lesson["status"]) => stage === "rejoin" || ((stage === "live" || stage === "grace") && status === "live");

export function NextLessonHero({ lesson, now, isTutor, readOnly = false, topic, tutorLabel, attendees, joining, onJoin, onCheck, onEdit, onQuickJoin, onOpenBoard, onEditNotes }: {
  lesson: Lesson;
  now: number;
  isTutor: boolean;
  /** A view-only staff role: every write (join, edit, notes) is refused by the server, so none is offered. */
  readOnly?: boolean;
  topic: Topic | null;
  tutorLabel: string;
  attendees: string[];
  joining: boolean;
  /** Primary action: opens the pre-join lobby. */
  onJoin: () => void;
  /** Open the lobby just to test camera and mic (before the room opens). */
  onCheck: () => void;
  onEdit?: () => void;
  /** One click back in with the last camera/mic choices — no lobby. */
  onQuickJoin?: () => void;
  /** Tutor: join with the whiteboard open. */
  onOpenBoard?: () => void;
  /** Tutor: open the notes & videos editor. */
  onEditNotes?: () => void;
}) {
  const t = lessonTiming(lesson, now);
  const info = stageInfo(lesson, now, isTutor);
  const live = info.stage === "live";
  const others = isTutor ? attendees : [tutorLabel];

  const ring = info.ring && (
    <>
      <div className="sm:hidden"><CountdownRing {...info.ring} size={92} /></div>
      <div className="hidden sm:block"><CountdownRing {...info.ring} size={148} /></div>
    </>
  );

  return (
    <section aria-label="Next lesson" id="hub-next-lesson" data-lesson-id={lesson.id} data-phase={t.phase} data-stage={info.stage} className="relative overflow-hidden rounded-3xl p-5 text-white shadow-[var(--shadow)] sm:p-7" style={HERO_BG}>
      <div aria-hidden className="pointer-events-none absolute -right-14 -top-20 hidden h-[280px] w-[280px] rounded-full bg-white/8 sm:block" />

      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[4px] text-[11px] font-extrabold uppercase tracking-[0.1em] ${STAGE_PILL[info.stage]}`}>
              {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" />}{info.pill}
            </span>
            {topic && (
              <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-white/25 bg-white/10 px-2.5 py-[3px] text-[11.5px] font-bold">
                <SubjectGlyph subject={topic.subject} size={13} />{topicLabel(topic)}
              </span>
            )}
            {(lesson.videos?.length ?? 0) > 0 && (
              <span data-video-chip className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-2.5 py-[3px] text-[11.5px] font-bold"><Ico name="video" size={13} />{lesson.videos!.length > 1 ? `${lesson.videos!.length} videos` : "Video"}</span>
            )}
          </div>
          <div className="mt-3.5 flex items-start gap-3.5">
            <GradientTile icon="video" size={56} tone="glass" className="hidden sm:grid" />
            <h2 className="m-0 min-w-0 break-words text-[24px] font-extrabold leading-tight sm:text-[32px]" style={DISPLAY}>{lesson.title}</h2>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-white/85">
            <span className="inline-flex items-center gap-1.5"><Ico name="calendar" size={15} />{relDay(lesson.startsAt, now)}</span>
            <span className="inline-flex items-center gap-1.5"><Ico name="clock" size={15} />{clock(t.startMs)}–{clock(t.endMs)} <span className="text-white/60">({lesson.durationMins} min · {tzLabel()})</span></span>
            {others.length > 0 && (
              <span className="inline-flex items-center gap-2"><Stack names={others} size={24} />{isTutor ? names(attendees, 3) : `with ${tutorLabel === "Your tutor" ? "your tutor" : tutorLabel}`}</span>
            )}
          </div>
        </div>
        {ring && <div className="justify-self-end">{ring}</div>}

        <div className="col-span-2 grid gap-3.5">
          <p id="hub-join-hint" className="max-w-[640px] text-[13.5px] leading-relaxed text-white/90">{info.sub}</p>
          {readOnly ? (
            <p data-testid="hub-live-viewonly" className="m-0 inline-flex items-center gap-2 text-[13px] font-bold text-white/85"><Ico name="lock" size={15} />View only — ask a manager for Edit access to run or change lessons.</p>
          ) : (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              id="hub-join-btn"
              disabled={!info.canJoin || joining}
              onClick={onJoin}
              aria-describedby="hub-join-hint"
              className={`inline-flex min-h-[54px] items-center gap-2.5 rounded-2xl px-7 text-[15.5px] font-extrabold transition disabled:cursor-not-allowed motion-reduce:transition-none ${FOCUS} ${info.canJoin ? "bg-white text-[var(--brand-strong)] shadow-[0_10px_28px_rgba(0,0,0,0.28)] hover:-translate-y-px hover:shadow-[0_14px_32px_rgba(0,0,0,0.34)] active:translate-y-0 motion-reduce:hover:transform-none" : "bg-white/20 text-white/85"}`}
            >
              <Ico name={info.canJoin ? "video" : "lock"} size={19} />
              {joining ? "Connecting…" : info.cta}
            </button>
            {onQuickJoin && info.canJoin && canQuick(info.stage, lesson.status) && (
              <button type="button" onClick={onQuickJoin} disabled={joining} data-action="rejoin-now" className={`inline-flex min-h-[54px] items-center gap-2 rounded-2xl border border-white/40 bg-white/15 px-5 text-[13.5px] font-extrabold text-white backdrop-blur-sm transition-colors hover:bg-white/25 disabled:opacity-60 ${FOCUS}`}>
                <Ico name="bolt" size={16} />Skip the check
              </button>
            )}
            {onOpenBoard && isTutor && info.canJoin && (
              <button type="button" onClick={onOpenBoard} disabled={joining} data-action="open-board-hero" className={`inline-flex min-h-[54px] items-center gap-2 rounded-2xl border border-white/40 bg-white/15 px-5 text-[13.5px] font-extrabold text-white backdrop-blur-sm transition-colors hover:bg-white/25 disabled:opacity-60 ${FOCUS}`}>
                <Ico name="edit" size={16} />Open board
              </button>
            )}
            <button type="button" onClick={onCheck} className={`inline-flex min-h-[54px] items-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-5 text-[13.5px] font-extrabold text-white backdrop-blur-sm transition-colors hover:bg-white/20 ${FOCUS}`}>
              <Ico name="mic" size={16} />Test camera &amp; mic
            </button>
            {onEdit && (
              <button type="button" onClick={onEdit} aria-label="Edit lesson" title="Edit lesson" className={`grid h-[54px] w-[54px] place-items-center rounded-2xl border border-white/30 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 ${FOCUS}`}>
                <Ico name="edit" size={18} />
              </button>
            )}
          </div>
          )}
          <LessonNotes lesson={lesson} isTutor={isTutor} tone="dark" className="max-w-[640px]" onEdit={isTutor && !readOnly ? onEditNotes : undefined} />
        </div>
      </div>
    </section>
  );
}

/** Cancel lives inside the ⋯ menu, behind a second tap. */
function CancelItem({ busy, onCancel, close, label = "Cancel lesson" }: { busy: boolean; onCancel: () => void; close: () => void; label?: string }) {
  const [ask, setAsk] = useState(false);
  if (!ask) return <MenuItem icon="trash" tone="danger" onClick={() => setAsk(true)}>{label}…</MenuItem>;
  return (
    <div className="grid gap-1 p-1">
      <div className="px-2 pt-1 text-[12px] font-bold text-[var(--ink-2)]">{label === "Cancel lesson" ? "Cancel for everyone?" : "Cancel these for everyone?"}</div>
      <button type="button" disabled={busy} onClick={() => { close(); onCancel(); }} className={`min-h-[44px] rounded-lg bg-[var(--red)] px-3 text-[13px] font-extrabold text-white ${FOCUS}`}>Yes, {label.toLowerCase()}</button>
      <button type="button" onClick={() => { setAsk(false); close(); }} className={`min-h-[44px] rounded-lg px-3 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)] ${FOCUS}`}>Keep {label === "Cancel lesson" ? "it" : "them"}</button>
    </div>
  );
}

export function LessonRow({ lesson, now, isTutor, readOnly = false, topic, tutorLabel, attendees, busy, onJoin, onEdit, onCancel, onCancelFollowing, onQuickJoin, onReopen, onEditNotes }: {
  lesson: Lesson;
  now: number;
  isTutor: boolean;
  /** A view-only staff role: no Join / Reopen / Edit / Cancel (the server would refuse each). */
  readOnly?: boolean;
  topic: Topic | null;
  tutorLabel: string;
  attendees: string[];
  busy: boolean;
  onJoin: () => void;
  onEdit: () => void;
  onCancel: () => void;
  /** A weekly series: cancel this lesson and every later one. */
  onCancelFollowing?: () => void;
  /** One click back in with the last camera/mic choices — no lobby. */
  onQuickJoin?: () => void;
  /** Tutor, on a lesson whose window has closed: start a NEW session of it (POST /reopen) and go straight in. */
  onReopen?: () => void;
  /** Tutor: open the notes & videos editor. */
  onEditNotes?: () => void;
}) {
  const t = lessonTiming(lesson, now);
  const info = stageInfo(lesson, now, isTutor);
  const done = info.stage === "ended" || info.stage === "cancelled";
  const live = info.stage === "live";
  const elapsed = live ? Math.min(1, (now - t.startMs) / (t.endMs - t.startMs)) : 0;
  const c = topic ? subjectColor(topic.subject) : "var(--brand)";
  const others = isTutor ? attendees : [tutorLabel];
  const write = isTutor && !readOnly;

  const chip = (() => {
    if (info.stage === "cancelled") return { text: "Cancelled", bg: "var(--red-soft)", fg: "var(--red)", line: "var(--red-line)" };
    if (info.waiting) return { text: "Waiting for your tutor", bg: "var(--gold-soft)", fg: "var(--brand-ink)", line: "var(--gold-line)" };
    if (info.stage === "ended") return { text: `Ended · ${fmtDay(lesson.startsAt)}`, bg: "var(--panel)", fg: "var(--ink-2)", line: "var(--line)" };
    if (live) return { text: `Live · ${humanSpan(t.endMs - now)} left`, bg: "var(--green-soft)", fg: "var(--hub-green-ink)", line: "var(--green-line)" };
    if (info.stage === "soon") return { text: `Room open · starts in ${humanSpan(t.startMs - now)}`, bg: "var(--gold-soft)", fg: "var(--brand-ink)", line: "var(--gold-line)" };
    if (info.stage === "rejoin") return { text: "Ended — rejoin", bg: "var(--gold-soft)", fg: "var(--brand-ink)", line: "var(--gold-line)" };
    if (info.stage === "grace") return { text: "Past its slot · still open", bg: "var(--gold-soft)", fg: "var(--brand-ink)", line: "var(--gold-line)" };
    return null;
  })();

  return (
    <div data-ui="card" data-lesson-id={lesson.id} data-phase={t.phase} data-stage={info.stage}
      className={`relative rounded-2xl border bg-[var(--surface)] p-3.5 shadow-[var(--shadow-sm)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow)] motion-reduce:transition-none motion-reduce:hover:transform-none ${live ? "border-[var(--green-line)]" : "border-[var(--line)]"} ${done ? "opacity-90" : ""}`}>
      {live && <span aria-hidden className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r bg-[var(--green)]" />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          {topic ? (
            <span aria-hidden className={`grid h-[58px] w-[58px] flex-none place-items-center rounded-2xl ${done ? "grayscale" : ""}`} style={{ background: `linear-gradient(135deg, ${tint(c, 34)} 0%, ${tint(c, 14)} 100%)`, color: c, boxShadow: `inset 0 0 0 1px ${tint(c, 30)}` }}>
              <SubjectGlyph subject={topic.subject} size={28} />
            </span>
          ) : (
            <span aria-hidden className={`grid h-[58px] w-[58px] flex-none place-items-center rounded-2xl ${done ? "bg-[var(--panel)] text-[var(--ink-3)]" : "text-white"}`} style={done ? undefined : { background: "linear-gradient(140deg, var(--brand-2), var(--brand))" }}><Ico name="video" size={26} /></span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-0 truncate text-[15px] font-extrabold text-[var(--ink)]">{lesson.title}</span>
              {chip && (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11px] font-extrabold" style={{ background: chip.bg, color: chip.fg, borderColor: chip.line }}>
                  {live && <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full motion-reduce:animate-none" style={{ background: "var(--green)" }} />}{chip.text}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-[var(--ink-2)]">
              <span className="inline-flex items-center gap-1"><Ico name="calendar" size={13} className="text-[var(--ink-3)]" />{relDay(lesson.startsAt, now)}</span>
              <span className="inline-flex items-center gap-1 tabular-nums"><Ico name="clock" size={13} className="text-[var(--ink-3)]" />{clock(t.startMs)}–{clock(t.endMs)}</span>
              <span className="text-[var(--ink-3)]">{lesson.durationMins} min</span>
              {lesson.seriesId && lesson.seriesCount && <span data-testid="hub-lesson-series" className="inline-flex items-center gap-1 text-[var(--ink-3)]"><Ico name="refresh" size={12} />Weekly {(lesson.seriesIndex ?? 0) + 1} of {lesson.seriesCount}</span>}
              {lesson.held && <span data-testid="hub-lesson-held" className="rounded-full bg-[var(--panel)] px-2 py-[1px] text-[11px] font-bold text-[var(--ink-2)]">Logged after the fact</span>}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {topic && <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full px-2.5 py-[3px] text-[11px] font-bold" style={{ background: tint(c, 13), color: subjectInk(topic.subject) }}>{topicLabel(topic)}</span>}
              <VideoChip count={lesson.videos?.length ?? 0} />
              {others.length > 0 && (
                <span className="inline-flex items-center gap-2 text-[12px] text-[var(--ink-2)]"><Stack names={others} size={22} /><span className="truncate">{isTutor ? names(attendees) : `with ${tutorLabel === "Your tutor" ? "your tutor" : tutorLabel}`}</span></span>
              )}
            </div>
            {live && <div className="mt-2 h-1 max-w-[280px] overflow-hidden rounded-full bg-[var(--green-soft)]" role="img" aria-label={`${Math.round(elapsed * 100)}% of the lesson has run`}><div className="h-full rounded-full bg-[var(--green)]" style={{ width: `${elapsed * 100}%` }} /></div>}
            {info.stage === "ended" && isTutor && lesson.attendance && (
              <p className="m-0 mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--ink-2)]" data-attendance>
                <Ico name="users" size={13} className="text-[var(--ink-3)]" />
                {(() => { const came = (lesson.students ?? []).filter((x) => lesson.attendance![x.childId]); const total = lesson.students?.length ?? lesson.childIds.length; return total ? `Attended ${came.length} of ${total}${came.length ? ` · ${names(came.map((x) => x.childName), 3)}` : ""}` : "No students"; })()}
              </p>
            )}
            <LessonNotes lesson={lesson} isTutor={isTutor} className="mt-2" onEdit={write && info.stage !== "cancelled" ? onEditNotes : undefined} />
          </div>
        </div>

        {info.stage === "ended" && write && onReopen && !lesson.held && (
          <div className="grid gap-1.5 sm:max-w-[250px] sm:flex-none sm:justify-items-end">
            <button type="button" disabled={busy} onClick={onReopen} data-action="reopen"
              className={`inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl px-5 text-[13.5px] font-extrabold text-white shadow-[var(--shadow-sm)] transition hover:-translate-y-px hover:brightness-110 disabled:opacity-60 motion-reduce:transition-none sm:w-auto ${FOCUS}`}
              style={{ background: "linear-gradient(180deg, var(--brand-2), var(--brand))" }}>
              <Ico name="refresh" size={16} />{busy ? "Reopening…" : "Reopen & rejoin"}
            </button>
            <span className="text-[11.5px] leading-snug text-[var(--ink-3)] sm:text-right">Start a new session of this lesson — your students can rejoin too.</span>
          </div>
        )}
        {info.stage === "ended" && write && onReopen && !lesson.held && (
          <div className="flex-none self-start sm:self-center">
            <MoreMenu label={`More actions for ${lesson.title}`}>{(close) => <MenuItem icon="refresh" onClick={() => { close(); onReopen(); }}>Reopen lesson</MenuItem>}</MoreMenu>
          </div>
        )}

        {!done && readOnly && isTutor && (
          <span data-testid="hub-live-viewonly" className="inline-flex min-h-[44px] items-center gap-1.5 px-1 text-[12px] font-semibold text-[var(--ink-3)] sm:flex-none"><Ico name="lock" size={14} />View only</span>
        )}
        {!done && !(readOnly && isTutor) && (
          <div className="flex items-center gap-1.5 sm:flex-none sm:justify-end">
            {info.canJoin && onQuickJoin && canQuick(info.stage, lesson.status) && (
              <button type="button" disabled={busy} onClick={onQuickJoin} data-action="rejoin-now" title="Skip the camera and microphone check and go straight in, with your last settings" aria-label={`Skip the camera check and go straight in: ${lesson.title}`}
                className={`inline-flex min-h-[46px] flex-none items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[13px] font-extrabold text-[var(--ink-2)] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-60 ${FOCUS}`}>
                <Ico name="bolt" size={15} />Skip check
              </button>
            )}
            {info.canJoin ? (
              <button type="button" disabled={busy} onClick={onJoin} data-action="join"
                className={`inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl px-5 text-[13.5px] font-extrabold text-white shadow-[var(--shadow-sm)] transition hover:-translate-y-px hover:brightness-110 disabled:opacity-60 motion-reduce:transition-none sm:flex-none ${FOCUS}`}
                style={{ background: "linear-gradient(180deg, var(--brand-2), var(--brand))" }}>
                <Ico name="video" size={16} />{info.cta}
              </button>
            ) : !isTutor ? (
              <span className="inline-flex min-h-[44px] flex-1 items-center gap-1.5 rounded-xl bg-[var(--panel)] px-3 text-[12px] font-semibold text-[var(--ink-2)] sm:flex-none"><Ico name="lock" size={14} />{info.waiting ? "Waiting for your tutor" : <>Opens in {humanSpan(t.opensMs - now)}</>}</span>
            ) : (
              <span className="inline-flex min-h-[44px] flex-1 items-center gap-1.5 px-1 text-[12px] font-semibold text-[var(--ink-3)] sm:flex-none"><Ico name="lock" size={14} />Room opens in {humanSpan(t.opensMs - now)}</span>
            )}
            {isTutor && (
              <>
                <button type="button" onClick={onEdit} aria-label={`Edit ${lesson.title}`} title="Edit lesson" className={`grid h-11 w-11 flex-none place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)] ${FOCUS}`}><Ico name="edit" size={17} /></button>
                <MoreMenu label={`More actions for ${lesson.title}`}>{(close) => <><CancelItem busy={busy} onCancel={onCancel} close={close} />{onCancelFollowing && lesson.seriesId && (lesson.seriesIndex ?? 0) < (lesson.seriesCount ?? 1) - 1 && <CancelItem busy={busy} onCancel={onCancelFollowing} close={close} label="Cancel this and every later week" />}</>}</MoreMenu>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
