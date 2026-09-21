"use client";

import { useState } from "react";
import { humanSpan, fmtClock, FOCUS } from "../teachKit";
import { Ico } from "../teachIcons";
import { VideoEmbeds } from "../videoKit";
import { lessonStage, lessonTiming, type Lesson, type Stage } from "./lessonTypes";

// Shared bits for the Live lessons hero / rows / today strip / lobby.

/** A ring that fills as a moment approaches. Sits on the dark hero (white strokes). */
export function CountdownRing({ progress, value, unit, size = 132, tone = "white", label }: {
  progress: number; value: string; unit: string; size?: number; tone?: "white" | "amber" | "green"; label: string;
}) {
  const sw = Math.max(7, Math.round(size / 15));
  const r = size / 2 - sw / 2 - 1;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, progress));
  const stroke = tone === "amber" ? "var(--gold)" : tone === "green" ? "var(--green)" : "#fff";
  return (
    <div className="relative flex-none" style={{ width: size, height: size }} role="timer" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none" />
      </svg>
      <div aria-hidden className="absolute inset-0 grid place-content-center text-center leading-none text-white">
        <span className="font-extrabold tabular-nums" style={{ fontFamily: "var(--ff-display)", fontSize: size * (value.length > 4 ? 0.2 : 0.27) }}>{value}</span>
        <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/75">{unit}</span>
      </div>
    </div>
  );
}

export interface StageInfo {
  stage: Stage;
  /** Short status for the pill. */
  pill: string;
  /** One honest sentence for the hero. */
  sub: string;
  /** Primary action label (null = nothing to do). */
  cta: string | null;
  /** Can the primary action be used right now? */
  canJoin: boolean;
  /** A family, and the tutor ended (or reopened) the lesson and isn't back in yet — nothing to press until they are. */
  waiting?: boolean;
  ring: { progress: number; value: string; unit: string; tone: "white" | "amber" | "green"; label: string } | null;
}

/** The single state machine for a lesson: what to say and what the one primary action is. */
export function stageInfo(lesson: Lesson, now: number, isTutor: boolean): StageInfo {
  const t = lessonTiming(lesson, now);
  const stage = lessonStage(lesson, now);
  const started = lesson.status === "live" || lesson.status === "ended";
  const untilStart = t.startMs - now;
  if (!isTutor && lesson.waitingForTutor && (stage === "soon" || stage === "live" || stage === "grace" || stage === "rejoin")) {
    return { stage, pill: "Waiting for your tutor", cta: "Waiting for your tutor", canJoin: false, waiting: true, ring: null,
      sub: "Your tutor ended the lesson. You can come back in as soon as they reopen it — we'll tell you." };
  }

  if (stage === "upcoming") {
    const d = Math.floor(untilStart / 86_400_000);
    const h = Math.floor((untilStart % 86_400_000) / 3_600_000);
    const m = Math.floor((untilStart % 3_600_000) / 60_000);
    const value = d >= 1 ? String(d) : h >= 1 ? `${h}h ${String(m).padStart(2, "0")}` : String(Math.max(1, Math.round(untilStart / 60_000)));
    const unit = d >= 1 ? (d === 1 ? "day" : "days") : h >= 1 ? "to start" : "min";
    return {
      stage, pill: "Next lesson", cta: `Opens in ${humanSpan(t.opensMs - now)}`, canJoin: false,
      sub: `The room opens at ${fmtClock(new Date(t.opensMs).toISOString())}, 10 minutes before the start.`,
      ring: { progress: Math.max(0.03, 1 - untilStart / (6 * 3_600_000)), value, unit, tone: "white", label: `Starts in ${humanSpan(untilStart)}` },
    };
  }
  if (stage === "soon") {
    const mins = Math.max(1, Math.round(untilStart / 60_000));
    return {
      stage, pill: "Room open", canJoin: true, cta: isTutor ? "Start lesson" : "Join lesson",
      sub: `Starts in ${humanSpan(untilStart)} — the room is open, so you can get set up now.`,
      ring: { progress: 1 - untilStart / (10 * 60_000), value: String(mins), unit: "min", tone: "green", label: `Starts in ${humanSpan(untilStart)}` },
    };
  }
  if (stage === "live") {
    const left = t.endMs - now;
    return {
      stage, pill: "Live now", canJoin: true, cta: isTutor ? (started ? "Rejoin lesson" : "Start lesson") : "Join now",
      sub: `${humanSpan(left)} left of the scheduled ${lesson.durationMins} minutes.`,
      ring: { progress: (now - t.startMs) / (t.endMs - t.startMs), value: String(Math.max(1, Math.round(left / 60_000))), unit: "min left", tone: "green", label: `${humanSpan(left)} left` },
    };
  }
  if (stage === "rejoin") {
    const closes = t.closesMs - now;
    return {
      stage, pill: "Ended — rejoin", canJoin: true, cta: "Rejoin lesson",
      sub: `This lesson was ended, but you can step straight back in until ${fmtClock(new Date(t.closesMs).toISOString())}.`,
      ring: { progress: Math.min(1, closes / (30 * 60_000)), value: String(Math.max(1, Math.round(closes / 60_000))), unit: "min to rejoin", tone: "amber", label: `Rejoin window closes in ${humanSpan(closes)}` },
    };
  }
  if (stage === "grace") {
    const closes = t.closesMs - now;
    return {
      stage, pill: "Past its slot", canJoin: true, cta: started ? "Rejoin lesson" : isTutor ? "Open the room" : "Join lesson",
      sub: `The scheduled time has ended, but the room stays open until ${fmtClock(new Date(t.closesMs).toISOString())}.`,
      ring: { progress: closes / (30 * 60_000), value: String(Math.max(1, Math.round(closes / 60_000))), unit: "min to join", tone: "amber", label: `Room closes in ${humanSpan(closes)}` },
    };
  }
  return { stage, pill: stage === "cancelled" ? "Cancelled" : "Ended", sub: "", cta: null, canJoin: false, ring: null };
}

/** The tutor's note for this lesson (+ its videos) — one component so it reads the same on the hero, every row,
 *  the lobby and inside the call. Two lines by default, "Show more" opens the whole note and the video players. */
export function LessonNotes({ lesson, isTutor, tone = "light", className = "", alwaysOpen = false, onEdit }: {
  lesson: Pick<Lesson, "notes" | "videos" | "noteIds">;
  isTutor: boolean;
  /** "dark" sits on the brand hero / lobby (white text); "light" on a card. */
  tone?: "light" | "dark";
  className?: string;
  alwaysOpen?: boolean;
  /** Tutor: open the notes & videos editor (add / change them without editing the whole lesson). */
  onEdit?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const note = lesson.notes?.trim() ?? "";
  const vids = lesson.videos?.length ?? 0;
  const attachedN = lesson.noteIds?.length ?? 0;
  const dark0 = tone === "dark";
  const editBtn = onEdit && (
    <button type="button" onClick={onEdit} data-action="add-notes"
      className={`inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1.5 rounded-lg px-1.5 text-[12px] font-extrabold hover:underline ${FOCUS} ${dark0 ? "text-white" : "text-[var(--brand)]"}`}>
      <Ico name={note || vids || attachedN ? "edit" : "plus"} size={13} />{note || vids || attachedN ? "Edit message, lessons & videos" : "Add a message / lessons / videos"}
    </button>
  );
  if (!note && !vids && !attachedN) return editBtn ? <div data-lesson-notes className={className}>{editBtn}</div> : null;
  const long = note.length > 120 || note.split("\n").length > 2 || vids > 0;
  const expanded = alwaysOpen || open;
  const dark = tone === "dark";
  return (
    <div data-lesson-notes className={className}>
      {note && (
        <div className={`rounded-xl border-l-[3px] px-3 py-2 ${dark ? "border-white/50 bg-white/10 text-white/95" : "border-[var(--brand)] bg-[var(--panel)] text-[var(--ink-2)]"}`}>
          <div className={`mb-0.5 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] ${dark ? "text-white/70" : "text-[var(--ink-3)]"}`}><Ico name="notes" size={12} />{isTutor ? "Your message for students" : "Message from your tutor"}</div>
          <p className={`m-0 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>{note}</p>
        </div>
      )}
      {long && !alwaysOpen && (
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} data-action="notes-toggle"
          className={`mt-1 inline-flex min-h-[44px] lg:min-h-[36px] items-center gap-1 rounded-lg px-1.5 text-[12px] font-extrabold hover:underline ${FOCUS} ${dark ? "text-white" : "text-[var(--brand)]"}`}>
          {open ? "Show less" : vids > 0 ? `Show more${note ? " & " : " · "}${vids} video${vids > 1 ? "s" : ""}` : "Show more"}
          <Ico name="chevronDown" size={13} className={open ? "rotate-180" : ""} />
        </button>
      )}
      {attachedN > 0 && <p className={`m-0 mt-1 flex items-center gap-1.5 text-[12px] font-bold ${dark ? "text-white/85" : "text-[var(--ink-2)]"}`} data-attached-count><Ico name="notes" size={12} />{attachedN} {attachedN === 1 ? "lesson" : "lessons"} attached</p>}
      {editBtn && <div>{editBtn}</div>}
      {vids > 0 && expanded && (
        <div className="mt-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 text-[var(--ink)]"><VideoEmbeds videos={lesson.videos} heading="Videos for this lesson" /></div>
      )}
    </div>
  );
}
