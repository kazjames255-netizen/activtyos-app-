"use client";

import type { Lesson } from "../live/lessonTypes";
import { lessonTiming } from "../live/lessonTypes";
import { HERO_BG, fmtClock, humanSpan, relDay, useNow } from "../teachKit";
import { BigButton, DISPLAY, FOCUS, Icon, Person, Stack, rise } from "./homeKit";
import { firstName } from "./homeLib";
import { CountdownRing, stageInfo } from "../live/liveKit";

// The "Next lesson" hero — one card, both audiences. Countdown ticks each
// second; the button reads honestly against the join window (the server is
// still the enforcer — this just sends people to the Live lessons tab).

/** In the join window but already past its scheduled end — a fresher lesson should lead. */
export const over = (l: Lesson, now: number) => { const t = lessonTiming(l, now); return t.phase === "open" && !t.early && !t.inProgress; };

const pad = (n: number) => String(n).padStart(2, "0");

function Countdown({ ms }: { ms: number }) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86_400), h = Math.floor((s % 86_400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const cells: [number, string][] = d >= 1 ? [[d, d === 1 ? "day" : "days"], [h, "hrs"], [m, "min"]] : [[h, "hrs"], [m, "min"], [sec, "sec"]];
  return (
    <div className="flex items-stretch gap-2" role="timer" aria-label={`Starts in ${humanSpan(ms)}`}>
      {cells.map(([n, label]) => (
        <div key={label} className="min-w-[62px] rounded-2xl border border-white/20 bg-white/12 px-2.5 py-2 text-center backdrop-blur-sm">
          <div className="text-[28px] font-extrabold leading-none tabular-nums text-white sm:text-[32px]" style={DISPLAY}>{pad(n)}</div>
          <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white/75">{label}</div>
        </div>
      ))}
    </div>
  );
}

export function NextLessonHero({ lesson, isTutor, attendees, topicLabel, extraCount, later = [], onGo, onSchedule, embedded = false, readOnly = false }: {
  lesson: Lesson | null;
  isTutor: boolean;
  /** A view-only staff role: no schedule / start / join buttons (the server refuses those writes). */
  readOnly?: boolean;
  attendees: string[];
  topicLabel?: string;
  /** Other upcoming lessons after this one. */
  extraCount: number;
  /** The lessons after this one (a few, pre-formatted) — fills the hero on wide layouts. */
  later?: { id: string; title: string; when: string; who: string }[];
  onGo: () => void;
  onSchedule?: () => void;
  /** Rendered inside another hero (student greeting) — no outer gradient. */
  embedded?: boolean;
}) {
  const now = useNow(1000);

  // ── nothing scheduled ──
  if (!lesson) {
    return (
      <section aria-label="Next lesson" data-ui="card" className={`home-rise relative flex h-full min-w-0 flex-col justify-center overflow-hidden text-white ${embedded ? "" : "min-h-[220px] rounded-3xl p-6 sm:p-7"}`} style={embedded ? undefined : { ...HERO_BG, ...rise(0) }}>
        {!embedded && <Icon name="video" size={170} strokeWidth={1} className="pointer-events-none absolute -bottom-8 -right-6 text-white opacity-[0.08]" />}
        <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/75">Next lesson</div>
        <h2 className={`mt-1.5 font-extrabold leading-tight ${embedded ? "text-[21px]" : "text-[24px] sm:text-[28px]"}`} style={DISPLAY}>{isTutor ? "Nothing on the calendar yet" : "No lesson booked just yet"}</h2>
        <p className="mt-2 max-w-[440px] text-[13.5px] leading-relaxed text-white/85">
          {isTutor ? "Put your next 1:1 or small-group session in — students see it here the moment you do, with a countdown and a join button." : "When your tutor schedules a live lesson it appears here, with a countdown and a one-tap join."}
        </p>
        {!(isTutor && readOnly) && <div className="mt-5">
          <BigButton variant="white" icon={isTutor ? "plus" : "video"} onClick={isTutor ? (onSchedule ?? onGo) : onGo}>{isTutor ? "Schedule a video lesson" : "See lessons"}</BigButton>
        </div>}
      </section>
    );
  }

  const t = lessonTiming(lesson, now);
  const open = t.phase === "open";
  const live = open && t.inProgress;
  const title = lesson.title || "Lesson";
  const untilStart = t.startMs - now;
  const untilOpen = t.opensMs - now;
  const names = attendees.length ? attendees : [];
  const overrun = open && !t.early && !t.inProgress;
  const ringInfo = stageInfo(lesson, now, isTutor).ring;
  const status = live ? "Live now" : lesson.status === "ended" && overrun ? (!isTutor && lesson.waitingForTutor ? "Waiting for your tutor" : "Ended — rejoin") : overrun ? "Just finished" : open ? "Starting soon" : "Next lesson";

  return (
    <section aria-label="Next lesson" data-ui="card"
      className={`home-rise relative flex h-full min-w-0 flex-col overflow-hidden text-white ${embedded ? "" : "min-h-[240px] rounded-3xl p-6 sm:p-7"}`}
      style={embedded ? undefined : { ...HERO_BG, ...rise(0) }}>
      {!embedded && <Icon name="video" size={190} strokeWidth={1} className="pointer-events-none absolute -bottom-10 -right-8 text-white opacity-[0.07]" />}
      <div className="relative flex items-start gap-4">
        <div className="min-w-0 flex-1">
      <div className="relative flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] backdrop-blur-sm">
          {live && <span className="home-live h-2 w-2 rounded-full" style={{ background: "var(--red)" }} aria-hidden />}
          {status}
        </span>
        <span className="text-[12.5px] font-bold text-white/85">{relDay(lesson.startsAt, now)} · {fmtClock(lesson.startsAt)} · {lesson.durationMins} min</span>
      </div>

      <h2 className={`relative mt-2.5 font-extrabold leading-tight ${embedded ? "text-[21px]" : "text-[26px] sm:text-[30px]"}`} style={DISPLAY}>{title}</h2>
      {topicLabel && <div className="relative mt-1 text-[12.5px] font-semibold text-white/80">{topicLabel}</div>}

      {names.length > 0 && (
        <div className="relative mt-3 flex flex-wrap items-center gap-2">
          {isTutor ? (
            <>
              <Stack names={names} size={30} />
              <span className="text-[12.5px] font-semibold text-white/90">{names.length <= 3 ? names.map(firstName).join(", ") : `${names.slice(0, 2).map(firstName).join(", ")} and ${names.length - 2} more`}</span>
            </>
          ) : (
            <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-white/90"><Person name={lesson.tutorName || "Tutor"} size={26} />with {lesson.tutorName || "your tutor"}</span>
          )}
        </div>
      )}

        </div>
        {ringInfo && <div className="hidden flex-none sm:block"><CountdownRing {...ringInfo} size={embedded ? 92 : 112} /></div>}
      </div>

      {!embedded && later.length > 0 && (
        <div className="relative mt-5 hidden sm:block" aria-label="Later lessons">
          <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/70">Coming up after this</div>
          <ul className="grid gap-1.5 md:grid-cols-2">
            {later.slice(0, 2).map((l) => (
              <li key={l.id} className="flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">
                <Icon name="video" size={15} className="text-white/80" />
                <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-bold">{l.title}</span><span className="block truncate text-[11px] text-white/75">{l.when}{l.who ? ` · ${l.who}` : ""}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="relative mt-auto flex flex-wrap items-end justify-between gap-4 pt-5">
        {open ? (
          <div className="text-[13px] font-semibold text-white/90">
            {live ? `Ends in ${humanSpan(t.endMs - now)}` : overrun ? (lesson.status === "ended" ? (!isTutor && lesson.waitingForTutor ? "Ended — waiting for your tutor to reopen it" : `Ended — you can rejoin for ${humanSpan(t.closesMs - now)}`) : `Finished — you can still join for ${humanSpan(t.closesMs - now)}`) : `Starts in ${humanSpan(untilStart)}`}
          </div>
        ) : (
          <div>
            <Countdown ms={untilStart} />
            <div className="mt-2 text-[11.5px] font-semibold text-white/75">Joining opens 10 min before · in {humanSpan(untilOpen)}</div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          {extraCount > 0 && !embedded && <span className="text-[12px] font-bold text-white/80">+{extraCount} more coming up</span>}
          {open && !(isTutor && readOnly) ? (
            <BigButton variant="white" icon="video" onClick={onGo} ariaLabel={`${isTutor ? (live ? "Rejoin" : "Start") : "Join"} lesson: ${title}`}>{lesson.status === "ended" || (isTutor && live && lesson.status === "live") ? "Rejoin lesson" : isTutor ? (live ? "Rejoin lesson" : "Start lesson") : "Join lesson"}</BigButton>
          ) : (
            <button type="button" onClick={onGo} className={`inline-flex min-h-[48px] items-center gap-1.5 rounded-full border border-white/35 bg-white/14 px-5 text-[13.5px] font-extrabold text-white transition hover:bg-white/22 motion-reduce:transition-none ${FOCUS}`}>
              Lesson details <Icon name="chevronRight" size={15} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
