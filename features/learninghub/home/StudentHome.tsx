"use client";

import { SubjectTile } from "../subjectArt";
import { useEffect, useMemo, useState } from "react";
import { get as apiGet, put as apiPut } from "@/lib/api";
import { EmptyState } from "../kit";
import { dueState, type StudentHomework } from "../homework/hwTypes";
import { lessonTiming } from "../live/lessonTypes";
import type { PanelProps } from "../panelTypes";
import { topicLabel } from "../types";
import { HERO_BG, useNow } from "../teachKit";
import { RetryFace } from "../homework/RetryFace";
import { BigButton, Card, DISPLAY, Flame, FOCUS, HomeSkeleton, Icon, IconTile, PartError, Person, ScoreRing, TONES, WeekDots, plural, rise } from "./homeKit";
import { activeDays, bandTone, firstName, greeting, relTime, streakOf, weekDots, type AssessmentLite, type AttemptRow } from "./homeLib";
import { NextLessonHero, over } from "./NextLesson";
import { Attainment } from "../progress/Attainment";
import { useStudentHome } from "./useHomeData";
import { AskTutorLink, useFamily, useSupport } from "../family/FamilyContext";
import { openLink } from "../family/link";
import { kidBand } from "../family/KidMode";
import { PARENT_COPY, overdueVerdict } from "../family/parentCopy";
import { KID_COPY, bandOrDefault, useKidCopy } from "../family/kidCopy";
import { KidHome, type KidRow, type KidStep } from "./KidHome";
import { JoinRemoteSyncBanner } from "../remotesync/JoinRemoteSyncBanner";

// Student / parent Home — a warm "today" for the chosen child: what's next, what
// is due, how the last quizzes went, where they're strong, and one clear next step.

type Chip = { tone: "green" | "gold" | "red" | "brand" | "neutral" | "violet"; text: string };

export function StudentHome(props: PanelProps) {
  const { childId } = props;
  if (!childId) {
    return <EmptyState id="hub-home-nochild" icon="users" title="No child selected" body="Once your tutor enrols your child in My Classroom, their lessons, homework and progress appear here." />;
  }
  return <StudentHomeFor {...props} childId={childId} />;
}

function StudentHomeFor(props: PanelProps & { childId: string }) {
  const { qs, childQs, childId, config, onError, goTo, providerName } = props;
  const go = goTo ?? (() => undefined);
  const { ready, parts, failed, reload } = useStudentHome(qs, childId, onError);
  const now = useNow(30_000);
  const kidMode = useFamily().kid;
  const calm = useSupport().calm; // R-5: no streak / flame for a child whose tutor set Calm
  const yearGroup = props.students.find((s) => s.childId === childId)?.yearGroup;
  const { kind } = useKidCopy(yearGroup);
  const kid = props.child ?? props.students.find((s) => s.childId === childId) ?? null;
  const name = kid?.childName ?? "there";

  const d = useMemo(() => {
    if (!parts) return null;
    const { lessons, homework, attempts, mastery, assessments, due } = parts;
    const mine = lessons.filter((l) => !l.childIds?.length || l.childIds.includes(childId));
    const upcoming = mine.filter((l) => ["upcoming", "open"].includes(lessonTiming(l, now).phase)).sort((a, b) => Number(over(a, now)) - Number(over(b, now)) || a.startsAt.localeCompare(b.startsAt));

    const todo: (StudentHomework & { st: ReturnType<typeof dueState> })[] = homework
      .filter((h) => h.childId === childId && h.submission.status === "assigned")
      .map((h) => ({ ...h, st: dueState(h.dueAt, h.submission.status, now, kind) }))
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const urgent = todo.filter((h) => h.st.overdue || h.st.soon);
    const overdueN = todo.filter((h) => h.st.overdue).length;
    const soonN = todo.filter((h) => h.st.soon && !h.st.overdue).length;

    const activity: number[] = [];
    for (const a of attempts) if (a.submittedAt) activity.push(new Date(a.submittedAt).getTime());
    for (const h of homework) if (h.childId === childId && h.submission.submittedAt) activity.push(new Date(h.submission.submittedAt).getTime());
    const streak = streakOf(activity, now);
    const days14 = activeDays(activity, now, 14);
    const week = weekDots(activity, now);

    const results = attempts.filter((a) => a.assessmentType !== "diagnostic" && a.status !== "in_progress" && a.submittedAt).slice(0, 3);

    const subjects = (mastery?.subjects ?? []).filter((s) => s.masteryPct != null).sort((a, b) => (b.masteryPct ?? 0) - (a.masteryPct ?? 0));
    const topics = subjects.flatMap((s) => s.topics.filter((t) => t.masteryPct != null && t.attempts > 0).map((t) => ({ ...t, subject: s.subject })));
    topics.sort((a, b) => (b.masteryPct ?? 0) - (a.masteryPct ?? 0));

    // one clear next step
    const av = assessments.filter((a) => !a.locked);
    const diag = av.find((a) => a.type === "diagnostic" && !a.done && !a.lastAttempt);
    const resume = av.find((a) => a.type === "quiz" && a.lastAttempt?.status === "in_progress");
    // A lesson's exit quiz is not "up next": it comes at the end of its lesson (the Quizzes tab lists it under "Finish a lesson to unlock").
    const fresh = av.find((a) => a.type === "quiz" && !a.lastAttempt && !a.lessonNoteId);
    const retry = [...av].filter((a) => a.type === "quiz" && a.lastAttempt?.status === "marked" && a.lastAttempt.pct < a.passMarkPct).sort((a, b) => (a.lastAttempt?.pct ?? 0) - (b.lastAttempt?.pct ?? 0))[0];
    const step: { a: AssessmentLite; kicker: string; go: "quizzes" | "diagnostic"; cta: string } | null =
      resume ? { a: resume, kicker: "Pick up where you left off", go: "quizzes", cta: "Continue quiz" }
      : diag ? { a: diag, kicker: "Start here", go: "diagnostic", cta: kidMode ? "Do the starting quiz" : PARENT_COPY.takeStartingQuiz }
      : fresh ? { a: fresh, kicker: "Up next", go: "quizzes", cta: "Start quiz" }
      : retry ? { a: retry, kicker: "Worth another go", go: "quizzes", cta: "Try again" }
      : null;
    // The parent's one-glance summary of the last 7 days (from data this screen already has).
    const weekAgo = now - 7 * 86_400_000;
    const weekQuizzes = attempts.filter((a) => a.assessmentType !== "diagnostic" && a.status !== "in_progress" && !!a.submittedAt && new Date(a.submittedAt).getTime() >= weekAgo).length;
    const weekHomework = homework.filter((h) => h.childId === childId && !!h.submission.submittedAt && new Date(h.submission.submittedAt).getTime() >= weekAgo).length;
    const weekInClass = attempts.filter((a) => a.inPerson === true && a.assessmentType !== "diagnostic" && a.status !== "in_progress" && !!a.submittedAt && new Date(a.submittedAt).getTime() >= weekAgo).length;
    const waitingMark = attempts.filter((a) => a.status === "pending_marking").length + homework.filter((h) => h.childId === childId && h.submission.status === "submitted").length;
    const focusTopic = topics.length > 1 ? topics[topics.length - 1] : null;
    return { upcoming, todo, urgent, overdueN, soonN, streak, days14, week, results, subjects, topics, step, due, weekQuizzes, weekInClass, weekHomework, waitingMark, focusTopic, allDone: av.some((a) => a.type === "quiz" && !a.lessonNoteId) && !step };
  }, [parts, now, childId, kidMode, kind]);

  if (!ready || !parts || !d) return <HomeSkeleton label={`Loading ${firstName(name)}'s day`} />;

  const next = d.upcoming[0] ?? null;
  const topicById = new Map(props.topics.map((t) => [t.id, t]));
  const dueCards = d.due?.dueCount ?? 0;
  const newCards = d.due?.newCount ?? 0;
  const lead = [dueCards + newCards > 0 ? `${plural(dueCards + newCards, "flashcard")} to review` : "", !kind && d.overdueN ? `${d.overdueN} overdue` : "", !kind && d.soonN ? `${plural(d.soonN, "homework task")} due soon` : "", kind && d.urgent.length ? KID_COPY.homeworkWaiting(d.urgent.length) : ""].filter(Boolean);
  const partial = (Object.keys(failed) as (keyof typeof failed)[]);
  const partLabel = { lessons: "lessons", homework: "homework", due: "flashcards", attempts: "quiz results", mastery: kidMode ? "your level" : PARENT_COPY.progressLoading, assessments: "quizzes" } as const;

  // Parent verdict (one line, from data this screen already has): overdue homework first, otherwise "All done" once this week's work is in, else "On track".
  const first = firstName(name);
  const verdict: { text: string; hint: string; to: "homework" | "dashboard" | "quizzes"; tone: string; icon: "warning" | "check" } =
    failed.homework ? { text: PARENT_COPY.verdict.couldntCheck, hint: "Try again", to: "homework", tone: "var(--ink-2)", icon: "warning" }
    : d.overdueN ? { text: overdueVerdict(d.overdueN, first), hint: "See it", to: "homework", tone: "var(--red)", icon: "warning" }
    : d.todo.length === 0 && d.weekHomework + d.weekQuizzes > 0 ? { text: `${first}: ${PARENT_COPY.verdict.allDone}`, hint: "See progress", to: "dashboard", tone: "var(--green)", icon: "check" }
    : { text: `${first}: ${PARENT_COPY.verdict.onTrack}`, hint: d.todo.length ? "See homework" : "See progress", to: d.todo.length ? "homework" : "dashboard", tone: "var(--green)", icon: "check" };

  // Kid mode: ONE big next step, nothing else competing (P-03). Streak, level and stats stay out of a child's Home.
  if (kidMode) {
    const band = bandOrDefault(yearGroup);
    const liveNow = d.upcoming.find((l) => lessonTiming(l, now).phase === "open") ?? null;
    const cardsReady = dueCards + newCards > 0;
    const step: KidStep | null = liveNow ? { icon: "video", text: "Join your lesson", to: "live" }
      : d.todo.length > 0 ? { icon: "homework", text: "Your homework is ready", to: "homework" }
      : cardsReady ? { icon: "cards", text: "Play your cards", to: "flashcards" }
      : d.step ? { icon: "quiz", text: d.step.go === "diagnostic" ? "Do your starting quiz" : "Try a quiz", to: d.step.go }
      : null;
    const dayName = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long" });
    const weekEnd = now + 7 * 86_400_000;
    const hwRows: KidRow[] = d.todo.map((h) => ({ key: h.id, icon: "homework", title: h.title, note: h.st.overdue ? h.st.label : `Due ${dayName(h.dueAt)}`, to: "homework" }));
    const rows: KidRow[] = band === "ks2"
      ? [...hwRows.slice(0, 2),
         ...(cardsReady ? [{ key: "cards", icon: "cards", title: "Your cards", note: `${plural(dueCards + newCards, "card")} ready`, to: "flashcards" } as KidRow] : []),
         ...(next && next !== liveNow ? [{ key: "lesson", icon: "video", title: next.title, note: dayName(next.startsAt), to: "live" } as KidRow] : []),
         ...(d.results[0] ? [{ key: "result", icon: "quiz", title: d.results[0].assessmentTitle ?? "Quiz", note: d.results[0].status === "pending_marking" ? "Handed in" : d.results[0].passed === false && kind ? "Nearly there" : "Marked", to: "quizzes" } as KidRow] : [])]
      : band === "ks1" ? []
      : [...todoThisWeek(d.todo, weekEnd).map((h) => ({ key: h.id, icon: "homework", title: h.title, note: h.st.overdue ? `Was due ${dayName(h.dueAt)}` : `Due ${dayName(h.dueAt)}`, to: "homework" } as KidRow)),
         ...(cardsReady ? [{ key: "cards", icon: "cards", title: "Flashcards", note: `${plural(dueCards + newCards, "card")} to review`, to: "flashcards" } as KidRow] : []),
         ...(d.step && d.todo.length === 0 ? [{ key: "step", icon: "quiz", title: d.step.a.title, note: d.step.go === "diagnostic" ? "Starting quiz" : "Quiz", to: d.step.go } as KidRow] : [])];
    // Weakest three topics, from this child's own mastery results only (hidden when there are none).
    const weak = [...d.topics].sort((a, b) => (a.masteryPct ?? 0) - (b.masteryPct ?? 0)).slice(0, 3).map((t) => ({ topic: t.topic, subject: t.subject, pct: t.masteryPct ?? 0 }));
    return (
      <div className="space-y-4">
        <JoinRemoteSyncBanner qs={childQs ?? qs} childId={childId} config={config} />
        <KidHome name={firstName(name)} band={band} step={step} rows={rows} failedHomework={!!failed.homework} onRetry={reload} go={(k) => go(k)} weak={band === "ks3" || band === "teen" ? weak : []} />
      </div>
    );
  }

  return (
    <div id="hub-home-student" className="space-y-4">
      <JoinRemoteSyncBanner qs={childQs ?? qs} childId={childId} config={config} />
      {!kidMode && (
        <section aria-label={`${firstName(name)} this week`} data-testid="hub-parent-summary" data-ui="card" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-sm)]">
          <div className="min-w-0 flex-1 basis-[240px]">
            <button type="button" data-testid="hub-parent-verdict" onClick={() => go(verdict.to)} aria-label={`${verdict.text}. ${verdict.hint}`}
              className={`mb-1.5 flex min-h-[44px] w-full items-center gap-2 rounded-lg text-left text-[17px] font-extrabold ${FOCUS}`} style={{ color: verdict.tone }}>
              <Icon name={verdict.icon} size={19} strokeWidth={2.4} />
              <span className="min-w-0 flex-1">{verdict.text}</span>
              <span className="inline-flex flex-none items-center gap-0.5 text-[12px] font-extrabold text-[var(--brand)]">{verdict.hint}<Icon name="chevronRight" size={14} /></span>
            </button>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[var(--ink-3)]">{firstName(name)} this week</div>
            <div className="mt-0.5 text-[13.5px] font-semibold leading-snug text-[var(--ink)]" data-testid="hub-parent-summary-text">
              {d.weekQuizzes + d.weekHomework + d.waitingMark === 0
                ? `Nothing handed in yet this week.${d.step ? ` A good place to start: ${d.step.a.title}.` : " A short quiz or a few flashcards is an easy start."}`
                : [plural(d.weekQuizzes, "quiz", "quizzes") + " done" + (d.weekInClass ? ` (${d.weekInClass} in class with the tutor)` : ""), `${plural(d.weekHomework, "homework task")} handed in`, d.waitingMark ? `${d.waitingMark} waiting to be marked` : "", d.focusTopic ? `focus next: ${[d.focusTopic.topic, d.focusTopic.subtopic].filter(Boolean).join(" › ")}` : ""].filter(Boolean).join(" · ")}
            </div>
            <LearningMail name={firstName(name)} />
          </div>
          <AskTutorLink>Ask your tutor</AskTutorLink>
        </section>
      )}
      {partial.length > 0 && partial.length < 6 && (
        <div className="space-y-2">{partial.map((k) => <PartError key={k} what={partLabel[k]} message={failed[k]} onRetry={reload} />)}</div>
      )}

      {/* ── greeting + next lesson ─────────────────────────────────────────── */}
      <section aria-label={`Welcome, ${firstName(name)}`} className="home-rise relative overflow-hidden rounded-3xl p-5 text-white sm:p-7" style={{ ...HERO_BG, ...rise(0) }}>
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-[0.12]" style={{ background: "radial-gradient(circle, #fff, transparent 65%)" }} aria-hidden />
        <div className="relative grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center rounded-full bg-white/20 p-1 backdrop-blur-sm"><Person name={name} size={46} /></span>
              <div className="min-w-0 text-[12px] font-bold uppercase tracking-[0.12em] text-white/75">{providerName ?? "Your tutor"}</div>
            </div>
            <h2 className="mt-3 text-[28px] font-extrabold leading-[1.1] sm:text-[34px]" style={DISPLAY}>{greeting(now)}, {firstName(name)}.</h2>
            <p className="mt-2.5 max-w-[380px] text-[14px] leading-relaxed text-white/88">
              {lead.length ? `You have ${lead.join(" and ")}. A few minutes today keeps it all fresh.` : failed.homework ? "We couldn't check your homework just now. Try again below." : "You're all caught up. Take a look at your progress or get ahead with a quiz."}
            </p>
            <div className="mt-4 max-w-[400px]" data-chip="attainment"><Attainment variant="hero" overall={parts.mastery?.overall} bands={config.masteryBands} subjects={parts.mastery?.subjects} maxSubjects={3} onEmptyAction={() => go("quizzes")} /></div>
            {!calm && <div className="mt-auto pt-4">
              <div data-chip="streak" title="Counts days with a finished quiz or a homework hand-in" className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-white/20 bg-white/10 p-3 pr-4 backdrop-blur-sm">
                <Flame size={58} lit={d.streak >= 2} n={d.streak} />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-extrabold" style={DISPLAY}>{d.streak >= 2 ? `${d.streak}-day streak` : d.days14 > 0 ? `${plural(d.days14, "active day")} in 2 weeks` : "Start a streak today"}</div>
                  <div className="mt-0.5 text-[11.5px] font-semibold text-white/70">{d.streak >= 2 && d.days14 > d.streak ? `${plural(d.days14, "active day")} in the last 2 weeks` : d.streak >= 2 ? "Keep it going tomorrow" : "A quiz or homework hand-in lights a day"}</div>
                </div>
                <WeekDots dots={d.week} />
              </div>
            </div>}
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm sm:p-5">
            <NextLessonHero embedded lesson={next} isTutor={false} attendees={[]} extraCount={Math.max(0, d.upcoming.length - 1)}
              topicLabel={next?.topicId && topicById.get(next.topicId) ? topicLabel(topicById.get(next.topicId)!) : undefined} onGo={() => go("live")} />
          </div>
        </div>
      </section>

      {/* ── due today ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Flashcards" icon="cards" tone="violet" style={rise(1)}>
          <div className="flex items-center gap-4">
            <div className="grid h-[84px] w-[84px] flex-none place-content-center rounded-3xl text-center" style={{ background: dueCards + newCards > 0 ? TONES.violet.bg : TONES.green.bg, border: `1px solid ${dueCards + newCards > 0 ? TONES.violet.line : TONES.green.line}` }} aria-hidden>
              {dueCards + newCards > 0
                ? <><span className="text-[34px] font-extrabold leading-none tabular-nums" style={{ ...DISPLAY, color: TONES.violet.fg }}>{dueCards + newCards}</span><span className="mt-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">to review</span></>
                : <Icon name="check" size={34} className="mx-auto" strokeWidth={2.4} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-extrabold text-[var(--ink)]" style={DISPLAY}>
                {dueCards + newCards > 0 ? `${plural(dueCards + newCards, "card")} ready` : d.due === null ? "Flashcards unavailable" : (d.due.upcoming > 0 ? "All caught up" : "No cards yet")}
              </div>
              <div className="mt-0.5 text-[12.5px] leading-snug text-[var(--ink-2)]">
                {dueCards + newCards > 0 ? `${dueCards} due${newCards ? ` · ${newCards} new` : ""}. About ${Math.max(1, Math.round((dueCards + newCards) / 4))} min.`
                  : d.due && d.due.upcoming > 0 ? kidMode ? `${plural(d.due.upcoming, "card")} coming back later. Cards you find tricky come back sooner.` : `${plural(d.due.upcoming, "card")} scheduled for later — spaced practice at work.` : "Your tutor hasn't added flashcards for this child yet."}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <BigButton className="w-full sm:w-auto" icon="cards" onClick={() => go("flashcards")} ariaLabel={dueCards + newCards > 0 ? "Review flashcards now" : "Open flashcards"}>{dueCards + newCards > 0 ? "Review now" : "Open flashcards"}</BigButton>
          </div>
        </Card>

        <Card title="Homework" icon="homework" tone={d.urgent.some((h) => h.st.overdue) && !kind ? "red" : "gold"} style={rise(2)}
          aside={d.todo.length > 0 ? <button type="button" onClick={() => go("homework")} className={`inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-[12px] font-extrabold text-[var(--brand)] hover:underline ${FOCUS}`}>All homework <Icon name="chevronRight" size={14} /></button> : undefined}>
          {failed.homework ? (
            <RetryFace what="homework" kid={kidMode} onRetry={reload} />
          ) : d.todo.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl bg-[var(--panel)] px-4 py-5">
              <IconTile icon="check" tone="green" size={44} />
              <div><div className="text-[14px] font-extrabold text-[var(--ink)]">{PARENT_COPY.homeworkEmptyTitle}</div><div className="text-[12.5px] text-[var(--ink-2)]">{PARENT_COPY.homeworkEmptyBody}</div></div>
            </div>
          ) : (
            <ul className="space-y-2">
              {d.todo.slice(0, 3).map((h) => {
                const tone = h.st.overdue && !kind ? TONES.red : h.st.soon || h.st.overdue ? TONES.gold : TONES.neutral;
                return (
                  <li key={h.id + h.submission.id}>
                    <button type="button" onClick={() => go("homework")} aria-label={`${h.title}. ${h.st.label}. Open homework.`}
                      className={`home-lift flex min-h-[56px] w-full items-center gap-3 rounded-2xl border p-2.5 text-left ${FOCUS}`} style={{ background: tone.bg, borderColor: tone.line }}>
                      <span aria-hidden className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[var(--surface)]" style={{ color: tone.fg }}><Icon name={h.st.overdue && !kind ? "warning" : "homework"} size={19} /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-extrabold text-[var(--ink)]">{h.title}</span><span className="block text-[12px] font-bold" style={{ color: tone.fg }}>{h.st.label}</span></span>
                      <Icon name="chevronRight" size={16} className="text-[var(--ink-3)]" />
                    </button>
                  </li>
                );
              })}
              {d.todo.length > 3 && <li className="px-1 text-[12px] font-semibold text-[var(--ink-3)]">+{d.todo.length - 3} more to do</li>}
            </ul>
          )}
        </Card>
      </div>

      {/* ── results + mastery ─────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card title="Latest results" icon="quiz" tone="brand" style={rise(3)}
          aside={d.results.length > 0 ? <button type="button" onClick={() => go("quizzes")} className={`inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-[12px] font-extrabold text-[var(--brand)] hover:underline ${FOCUS}`}>All quizzes <Icon name="chevronRight" size={14} /></button> : undefined}>
          {d.results.length === 0 ? (
            <EmptyState icon="quiz" title="No results yet" body={`${firstName(name)}'s first quiz score will appear here as a ring — pass or not yet, it all counts.`} action={<BigButton icon="quiz" onClick={() => go("quizzes")}>Browse quizzes</BigButton>} />
          ) : (
            <ul className={`grid gap-3 ${d.results.length === 1 ? "sm:grid-cols-1" : d.results.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
              {d.results.map((a) => <ResultTile key={a.id} a={a} now={now} kid={kidMode} kind={kind} onOpen={() => go("quizzes")} />)}
            </ul>
          )}
        </Card>

        <Card title={kidMode ? "How I'm doing" : PARENT_COPY.howTheyAreDoing} icon="chart" tone="green" style={rise(4)}>
          {d.subjects.length === 0 ? (
            <EmptyState icon="chart" title={kidMode ? "Every quiz helps you grow" : PARENT_COPY.buildsWithQuizzes} body={PARENT_COPY.buildsBody} action={<BigButton icon="chart" onClick={() => go("dashboard")}>See progress</BigButton>} />
          ) : (() => {
            const top = d.subjects[0];
            const tone = bandTone(top.masteryPct, config.masteryBands);
            const strong = d.topics[0];
            const weak = d.topics.length > 1 ? d.topics[d.topics.length - 1] : null;
            return (
              <>
                <div className="flex items-center gap-4">
                  <ScoreRing pct={top.masteryPct} size={92} color={tone?.fill ?? "var(--brand)"} sub={kidMode ? undefined : PARENT_COPY.levelWord} sr={`${top.subject} level ${Math.round(top.masteryPct ?? 0)} percent, ${kidBand(top.band ?? tone?.label ?? "", kidMode)}`} />
                  <div className="min-w-0">
                    <div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Strongest subject</div>
                    <div className="flex items-center gap-2"><SubjectTile subject={top.subject} size={26} /><span className="truncate text-[18px] font-extrabold text-[var(--ink)]" style={DISPLAY}>{top.subject}</span></div>
                    {top.topics.length > 0 && <div className="mt-1 text-[12px] font-semibold text-[var(--ink-2)]" data-testid="hub-mastery-coverage">Based on {top.topics.filter((t) => t.attempts > 0).length} of {plural(top.topics.length, "topic")} practised</div>}
                    {(top.band ?? tone?.label) && <span className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-extrabold text-[var(--ink)]" style={{ background: tone?.soft }}><span aria-hidden className="h-2 w-2 rounded-full" style={{ background: tone?.fill }} />{kidBand(top.band ?? tone?.label ?? "", kidMode)}</span>}
                  </div>
                </div>
                <dl className="mt-3.5 grid gap-2 sm:grid-cols-2">
                  {strong && <TopicLine label="Strongest topic" t={strong} bands={config.masteryBands} />}
                  {weak && <TopicLine label="Focus next" t={weak} bands={config.masteryBands} />}
                </dl>
                <div className="mt-4"><BigButton className="w-full sm:w-auto" variant="brand" icon="chart" onClick={() => go("dashboard")}>See progress</BigButton></div>
              </>
            );
          })()}
        </Card>
      </div>

      {/* ── keep going ────────────────────────────────────────────────────── */}
      {d.step ? (
        <section aria-label="Keep going" data-ui="card" className="home-rise relative overflow-hidden rounded-3xl border p-5 sm:p-6" style={{ ...rise(5), background: "linear-gradient(120deg, var(--brand-soft), var(--surface) 70%)", borderColor: "var(--brand-line)" }}>
          <div className="flex flex-wrap items-center gap-4">
            <IconTile icon="sparkle" tone="brand" size={52} />
            <div className="min-w-0 flex-1 basis-[240px]">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--brand)]">Keep going · {d.step.kicker}</div>
              <div className="mt-0.5 truncate text-[18px] font-extrabold text-[var(--ink)]" style={DISPLAY}>{d.step.a.title}</div>
              <div className="mt-0.5 text-[12.5px] text-[var(--ink-2)]">{d.step.a.subject}{d.step.a.questionCount ? ` · ${plural(d.step.a.questionCount, "question")}` : ""}{d.step.a.timeLimitMins ? ` · ${d.step.a.timeLimitMins} min` : ""}{d.step.a.lastAttempt?.status === "marked" ? ` · last score ${Math.round(d.step.a.lastAttempt.pct)}%` : ""}</div>
            </div>
            <BigButton icon="play" onClick={() => openLink({ kind: "quiz", id: d.step!.a.id }, { tab: d.step!.go })} ariaLabel={`${d.step.cta}: ${d.step.a.title}`}>{d.step.cta}</BigButton>
          </div>
        </section>
      ) : d.allDone ? (
        <section aria-label="Keep going" data-ui="card" className="home-rise flex items-center gap-4 rounded-3xl border p-5" style={{ ...rise(5), background: TONES.green.bg, borderColor: TONES.green.line }}>
          <IconTile icon="check" tone="green" size={48} />
          <div><div className="text-[16px] font-extrabold text-[var(--ink)]" style={DISPLAY}>Every quiz done — brilliant.</div><div className="text-[12.5px] text-[var(--ink-2)]">Flashcards are the best way to lock it in. New quizzes will appear here.</div></div>
        </section>
      ) : null}
    </div>
  );
}

/** The parent's own switch for Learning Hub emails (the shared notification preference, category "learning": the bell still records everything). */
function LearningMail({ name }: { name: string }) {
  const [muted, setMuted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { let live = true; apiGet<{ muted?: Record<string, boolean> }>("/api/notifications/prefs").then((p) => { if (live) setMuted(!!p.muted?.learning); }).catch(() => undefined); return () => { live = false; }; }, []);
  if (muted === null) return null;
  const flip = () => { const next = !muted; setBusy(true); setMuted(next); apiPut("/api/notifications/prefs", { category: "learning", muted: next }).catch(() => setMuted(!next)).finally(() => setBusy(false)); };
  return (
    <button type="button" onClick={flip} disabled={busy} aria-pressed={!muted} data-testid="hub-learning-mail"
      className={`mt-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg pr-2 text-[12px] font-bold text-[var(--ink-2)] underline-offset-2 hover:text-[var(--brand)] hover:underline ${FOCUS}`}>
      <Icon name={muted ? "close" : "check"} size={13} strokeWidth={2.4} />{muted ? `Emails about ${name}'s learning are off. Turn on` : `Emailing me about ${name}'s learning. Turn off`}
    </button>
  );
}

function TopicLine({ label, t, bands }: { label: string; t: { topic: string; subtopic: string | null; masteryPct: number | null; subject: string }; bands: PanelProps["config"]["masteryBands"] }) {
  const tone = bandTone(t.masteryPct, bands);
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
      <dt className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-2">
        <span aria-hidden className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: tone?.fill }} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--ink)]" title={`${t.subject}: ${t.topic}`}>{[t.topic, t.subtopic].filter(Boolean).join(" › ")}</span>
        <span className="text-[13px] font-extrabold tabular-nums text-[var(--ink)]">{Math.round(t.masteryPct ?? 0)}%</span>
      </dd>
    </div>
  );
}

function ResultTile({ a, now, onOpen, kid, kind }: { a: AttemptRow; now: number; onOpen: () => void; kid: boolean; kind: boolean }) {
  const pending = a.status === "pending_marking";
  const passed = a.passed === true, failedQ = a.passed === false;
  const color = pending ? "var(--gold)" : passed ? "var(--green)" : failedQ ? (kind ? "var(--gold)" : "var(--red)") : "var(--brand-2)";
  const chip: Chip = pending ? { tone: "gold", text: kid ? "Being marked" : "Awaiting marking" } : passed ? { tone: "green", text: "Passed" } : failedQ ? (kind ? { tone: "gold", text: "Nearly there" } : { tone: "red", text: "Not yet" }) : { tone: "neutral", text: "Done" };
  const t = TONES[chip.tone];
  const title = a.assessmentTitle ?? "Quiz";
  const sr = `${title}: ${pending ? "waiting to be marked" : `${Math.round(a.pct ?? 0)} percent, ${chip.text}`}`;
  return (
    <li>
      <button type="button" onClick={onOpen} aria-label={`${sr}. Open quizzes.`}
        className={`home-lift grid h-full min-h-[44px] w-full grid-cols-[auto_minmax(0,1fr)] items-center justify-items-start gap-x-4 gap-y-0.5 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3.5 py-3 text-left sm:flex sm:flex-col sm:justify-items-center sm:gap-2 sm:py-4 sm:text-center ${FOCUS}`}>
        <span className="row-span-3 sm:row-auto"><ScoreRing pct={pending ? null : (a.pct ?? 0)} size={84} color={color} sub={pending ? "marking" : undefined} sr={sr} /></span>
        <span className="line-clamp-2 sm:min-h-[2.4em] text-[12.5px] font-extrabold leading-tight text-[var(--ink)]">{title}</span>
        <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold" style={{ background: t.bg, color: t.fg, borderColor: t.line }}>
          <Icon name={passed ? "check" : failedQ && !kind ? "warning" : "sparkle"} size={11} strokeWidth={2.6} />{chip.text}
        </span>
        <span className="text-[11px] font-semibold text-[var(--ink-3)]">{a.subject ? `${a.subject} · ` : ""}{relTime(a.submittedAt, now)}</span>
      </button>
    </li>
  );
}

/** Homework that is overdue or due within the week (a teen's "due this week" list). */
function todoThisWeek<T extends { dueAt: string }>(todo: T[], weekEnd: number): T[] {
  return todo.filter((h) => new Date(h.dueAt).getTime() <= weekEnd);
}
