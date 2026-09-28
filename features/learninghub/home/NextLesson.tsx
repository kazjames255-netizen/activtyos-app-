"use client";

import type { Lesson } from "../live/lessonTypes";
import { lessonTiming } from "../live/lessonTypes";
import { HERO_BG, fmtClock, humanSpan, relDay, useNow } from "../teachKit";
import { BigButton, DISPLAY, FOCUS, Icon, Person, Stack, rise } from "./homeKit";
import { firstName } from "./homeLib";
import { useH } from "./homeI18n";
import { CountdownRing, stageInfo } from "../live/liveKit";

// The "Next lesson" hero — one card, both audiences. Countdown ticks each
// second; the button reads honestly against the join window (the server is
// still the enforcer — this just sends people to the Live lessons tab).

/** In the join window but already past its scheduled end — a fresher lesson should lead. */
export const over = (l: Lesson, now: number) => { const t = lessonTiming(l, now); return t.phase === "open" && !t.early && !t.inProgress; };

const pad = (n: number) => String(n).padStart(2, "0");

function Countdown({ ms }: { ms: number }) {
  const { t } = useH();
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86_400), h = Math.floor((s % 86_400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const cells: [number, string][] = d >= 1 ? [[d, d === 1 ? t("hubshell.hm_uDay") : t("hubshell.hm_uDays")], [h, t("hubshell.hm_uHrs")], [m, t("hubshell.hm_uMin")]] : [[h, t("hubshell.hm_uHrs")], [m, t("hubshell.hm_uMin")], [sec, t("hubshell.hm_uSec")]];
  return (
    <div className="flex items-stretch gap-2" role="timer" aria-label={t("hubshell.hm_startsIn", { span: humanSpan(ms) })}>
      {cells.map(([n, label]) => (
        <div key={label} className="min-w-[62px] rounded-2xl border border-white/20 bg-white/12 px-2.5 py-2 text-center backdrop-blur-sm">
          <div className="text-[28px] font-extrabold leading-none tabular-nums text-white sm:text-[32px]" style={DISPLAY}>{pad(n)}</div>
          <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white/75">{label}</div>
        </div>
      ))}
    </div>
  );
}

export function NextLessonHero({ lesson, isTutor, inPerson = false, attendees, topicLabel, extraCount, later = [], onGo, onSchedule, alsoUp = [], embedded = false, readOnly = false }: {
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
  /** The lesson runs with the children beside the tutor (no room): Start / Resume say so, and there is no join window. */
  inPerson?: boolean;
  /** Nothing live is booked but other work is coming (a quiz to resume, homework due): listed here so this card never says "nothing" while the page shows something. */
  alsoUp?: { key: string; title: string; note: string; onClick: () => void }[];
  /** Rendered inside another hero (student greeting) — no outer gradient. */
  embedded?: boolean;
}) {
  const now = useNow(1000);
  const { t: tr } = useH();

  // ── nothing scheduled ──
  if (!lesson) {
    return (
      <section aria-label={tr("hubshell.hm_nextLesson")} data-ui="card" className={`home-rise relative flex h-full min-w-0 flex-col justify-center overflow-hidden text-white ${embedded ? "" : "min-h-[220px] rounded-3xl p-6 sm:p-7"}`} style={embedded ? undefined : { ...HERO_BG, ...rise(0) }}>
        {!embedded && <Icon name="video" size={170} strokeWidth={1} className="pointer-events-none absolute -bottom-8 -end-6 text-white opacity-[0.08]" />}
        <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/75">{tr("hubshell.hm_nextLesson")}</div>
        <h2 className={`mt-1.5 font-extrabold leading-tight ${embedded ? "text-[21px]" : "text-[24px] sm:text-[28px]"}`} style={DISPLAY}>{alsoUp.length ? tr("hubshell.hm_comingUpHead") : isTutor ? tr("hubshell.hm_nothingCal") : tr("hubshell.hm_noLiveBooked")}</h2>
        {alsoUp.length > 0 ? (
          <ul className="mt-2 grid gap-1.5" data-testid="hub-coming-up">
            {alsoUp.slice(0, 3).map((x) => (
              <li key={x.key}>
                <button type="button" onClick={x.onClick} className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-start text-white ${FOCUS}`}>
                  <span className="min-w-0"><span className="block truncate text-[14px] font-extrabold">{x.title}</span><span className="block text-[12px] text-white/80">{x.note}</span></span>
                  <Icon name="chevronRight" size={16} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 max-w-[440px] text-[13.5px] leading-relaxed text-white/85">
            {isTutor ? tr("hubshell.hm_emptyTutorBody") : tr("hubshell.hm_emptyParentBody")}
          </p>
        )}
        {!(isTutor && readOnly) && <div className="mt-5">
          <BigButton variant="white" icon={isTutor ? "plus" : "video"} onClick={isTutor ? (onSchedule ?? onGo) : onGo}>{isTutor ? tr("hubshell.hm_scheduleVideo") : tr("hubshell.hm_seeLessons")}</BigButton>
        </div>}
      </section>
    );
  }

  const t = lessonTiming(lesson, now);
  const open = t.phase === "open";
  const live = open && t.inProgress;
  const title = lesson.title || tr("hubshell.hm_lesson");
  const untilStart = t.startMs - now;
  const names = attendees.length ? attendees : [];
  const overrun = open && !t.early && !t.inProgress;
  const ringInfo = stageInfo(lesson, now, isTutor).ring;
  const status = live ? tr("hubshell.hm_liveNow") : lesson.status === "ended" && overrun ? (!isTutor && lesson.waitingForTutor ? tr("hubshell.hm_waitingTutor") : tr("hubshell.hm_endedRejoin")) : overrun ? tr("hubshell.hm_justFinished") : open ? tr("hubshell.hm_startingSoon") : tr("hubshell.hm_nextLesson");

  return (
    <section aria-label={tr("hubshell.hm_nextLesson")} data-ui="card"
      className={`home-rise relative flex h-full min-w-0 flex-col overflow-hidden text-white ${embedded ? "" : "min-h-[200px] rounded-3xl p-5 sm:p-6"}`}
      style={embedded ? undefined : { ...HERO_BG, ...rise(0) }}>
      {!embedded && <Icon name="video" size={190} strokeWidth={1} className="pointer-events-none absolute -bottom-10 -end-8 text-white opacity-[0.07]" />}
      <div className="relative flex items-start gap-4">
        <div className="min-w-0 flex-1">
      <div className="relative flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] backdrop-blur-sm">
          {live && <span className="home-live h-2 w-2 rounded-full" style={{ background: "var(--red)" }} aria-hidden />}
          {status}
        </span>
        {inPerson && <span data-testid="hub-next-inperson" className="inline-flex items-center rounded-full border border-white/25 bg-white/15 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.1em]">{tr("hubshell.hm_inPersonBadge")}</span>}
        <span className="text-[12.5px] font-bold text-white/85">{tr("hubshell.hm_lessonMeta", { day: relDay(lesson.startsAt, now), clock: fmtClock(lesson.startsAt), mins: lesson.durationMins })}</span>
      </div>

      <h2 className={`relative mt-2.5 font-extrabold leading-tight ${embedded ? "text-[21px]" : "text-[26px] sm:text-[30px]"}`} style={DISPLAY}>{title}</h2>
      {topicLabel && <div className="relative mt-1 text-[12.5px] font-semibold text-white/80">{topicLabel}</div>}

      {names.length > 0 && (
        <div className="relative mt-3 flex flex-wrap items-center gap-2">
          {isTutor ? (
            <>
              <Stack names={names} size={30} />
              <span className="text-[12.5px] font-semibold text-white/90">{names.length <= 3 ? names.map(firstName).join(", ") : tr("hubshell.hm_namesAndMore", { names: names.slice(0, 2).map(firstName).join(", "), n: names.length - 2 })}</span>
            </>
          ) : (
            <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-white/90"><Person name={lesson.tutorName || tr("hubshell.hm_tutor")} size={26} />{tr("hubshell.hm_withTutor", { name: lesson.tutorName || tr("hubshell.hm_yourTutor") })}</span>
          )}
        </div>
      )}

        </div>
        {ringInfo && <div className="hidden flex-none sm:block"><CountdownRing {...ringInfo} size={embedded ? 92 : 112} /></div>}
      </div>

      {!embedded && later.length > 0 && (
        <div className="relative mt-5 hidden sm:block" aria-label={tr("hubshell.hm_laterLessons")}>
          <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/70">{tr("hubshell.hm_comingUpAfter")}</div>
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

      <div className="relative mt-auto flex flex-wrap items-end justify-between gap-4 pt-3">
        {open ? (
          <div className="text-[13px] font-semibold text-white/90">
            {live ? tr("hubshell.hm_endsIn", { span: humanSpan(t.endMs - now) }) : overrun ? (lesson.status === "ended" ? (!isTutor && lesson.waitingForTutor ? tr("hubshell.hm_endedWaiting") : tr("hubshell.hm_endedRejoinFor", { span: humanSpan(t.closesMs - now) })) : tr("hubshell.hm_finishedJoinFor", { span: humanSpan(t.closesMs - now) })) : tr("hubshell.hm_startsIn", { span: humanSpan(untilStart) })}
          </div>
        ) : (
          <div>
            <Countdown ms={untilStart} />
            <div className="mt-2 text-[11.5px] font-semibold text-white/75">{isTutor ? tr("hubshell.hm_earlyTutor") : tr("hubshell.hm_earlyFamily")}</div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          {extraCount > 0 && !embedded && <span className="text-[12px] font-bold text-white/80">{tr("hubshell.hm_moreComing", { n: extraCount })}</span>}
          {open && !(isTutor && readOnly) ? (
            <BigButton variant="white" icon="video" onClick={onGo} ariaLabel={tr(isTutor ? (live ? "hubshell.hm_ariaRejoin" : "hubshell.hm_ariaStart") : "hubshell.hm_ariaJoin", { title })}>{inPerson && isTutor ? (lesson.status === "live" ? tr("hubshell.hm_resumeInPerson") : tr("hubshell.hm_startInPerson")) : lesson.status === "ended" || (isTutor && live && lesson.status === "live") ? tr("hubshell.hm_rejoinLesson") : isTutor ? (live ? tr("hubshell.hm_rejoinLesson") : tr("hubshell.hm_startLesson")) : tr("hubshell.hm_joinLesson")}</BigButton>
          ) : (
            <>
            {!(isTutor && readOnly) && lesson.status !== "cancelled" && <BigButton variant="white" icon="video" onClick={onGo} ariaLabel={tr(isTutor ? "hubshell.hm_ariaStart" : "hubshell.hm_ariaJoin", { title })}>{isTutor ? (inPerson ? tr("hubshell.hm_startInPerson") : tr("hubshell.hm_startLesson")) : tr("hubshell.hm_joinLesson")}</BigButton>}
            <button type="button" onClick={onGo} className={`inline-flex min-h-[48px] items-center gap-1.5 rounded-full border border-white/35 bg-white/14 px-5 text-[13.5px] font-extrabold text-white transition hover:bg-white/22 motion-reduce:transition-none ${FOCUS}`}>
              {tr("hubshell.hm_lessonDetails")} <Icon name="chevronRight" size={15} />
            </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
