"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { HubSettings } from "@/lib/hubConfig";
import { Icon, FOCUS } from "../kit";
import { Modal } from "../shared-assess/ui";
import { errMsg } from "../types";
import { checkWarmup, fetchLessonQuestions, saveLessonSlides, type LessonQuestions } from "./api";
import { DoneStep } from "./DoneStep";
import { LearnStep } from "./LearnStep";
import { Btn, Confetti, LessonStyles, StepCard, display } from "./lessonUi";
import { QuizStep, type QuizOutcome } from "./QuizStep";
import { normalizeLesson } from "./types";
import { WarmupStep, type WarmupOutcome } from "./WarmupStep";
import type { WarmupQuestion } from "./api";
import { SlideDeck } from "./slides/SlideDeck";
import { OakDeckStep } from "./OakDeckStep";
import { WordsStep } from "./WordsStep";
import { getWidget } from "./widgets";
import { ChildChip, useChildGate, WhoIsLearning } from "../family/FamilyContext";

// The interactive lesson player: Start → Learn → Key words → Warm-up → Quiz → Done, one small step at a time, with a sticky
// header (progress, XP, streak), confetti and the licence credit. It renders a hubNotes doc's structured `lesson` field.
//
// Real vs practice: the warm-up is instant-feedback practice (nothing stored); the exit quiz is a REAL attempt on the real
// assessment, so results / mastery / retake rules are the server's. `readOnly` = a tutor's preview: nothing is started or saved.

type StepId = "start" | "learn" | "slides" | "words" | "warm" | "quiz" | "done";
const LABEL: Record<StepId, string> = { start: "Start", learn: "Learn", slides: "Lesson", words: "Key words", warm: "Warm-up", quiz: "Quiz", done: "Done" };

/** In-person class mode (features/learninghub/inperson): a TUTOR runs this lesson on their own device with children beside them
 *  (pair it with `readOnly`, so nothing is started here). The player keeps its steps; these slots swap what is recorded. */
export interface InPersonSlots {
  /** Replaces the "Preview — nothing is saved" note. */
  banner: ReactNode;
  /** The exit quiz step: the tutor's per-child capture grid instead of one child's paper. `onFinish` moves on to Done. */
  quiz: (p: { quiz: { id: string; title: string; questionCount: number }; onFinish: () => void; onBack: () => void }) => ReactNode;
  /** Under each warm-up question: "show the answer" and the per-child tally. */
  warmupExtra?: (q: WarmupQuestion) => ReactNode;
  /** The Done step: the per-child result summary and follow-up. */
  done: (p: { onExit: () => void }) => ReactNode;
}

export interface LessonPlayerProps {
  note: { id: string; title: string; lesson: unknown };
  /** "?tenantId=…" — appended to attempt calls (the child rides along as ?childId=). */
  qs: string;
  /** "?tenantId=…&childId=…" for a family, else the same as qs. */
  childQs: string;
  childId: string | null;
  config: HubSettings;
  /** Tutor preview: nothing is started, saved or counted. */
  readOnly?: boolean;
  onExit: () => void;
  /** Ask the shell to hide its hero / sidebar while a pupil is in the lesson. Released on unmount. */
  setFocus?: (on: boolean, opts?: { bare?: boolean }) => void;
  /** Jump to another hub tab ("flashcards"). */
  goTo?: (key: "flashcards") => void;
  /** Tutor preview: called with the updated note after the slides were edited or a slide deleted. */
  onLessonSaved?: (note: unknown) => void;
  /** Live lessons: told the step (and slide) the player is on, so a tutor teaching in a call can carry the students along. */
  onProgress?: (p: { step: string; slide: number }) => void;
  /** Live lessons: follow this step/slide (the tutor's). Ignored while the pupil is in the exit quiz or on the result, so a real attempt is never yanked away. */
  follow?: { step: string; slide: number } | null;
  /** Tutor-led class mode — see InPersonSlots. */
  inPerson?: InPersonSlots;
  /** Opened from a homework: the exit quiz is recorded against it. */
  homeworkId?: string | null;
}

// A pupil's place in a lesson survives a refresh / Back (this tab only): the step, XP and streak. Dropped when they leave on purpose or finish.
const progKey = (noteId: string, childId: string | null) => `hublesson:${childId ?? "-"}:${noteId}`;
const loadProg = (k: string): { step?: string; xp?: number; streak?: number } | null => { try { const r = sessionStorage.getItem(k); return r ? JSON.parse(r) : null; } catch { return null; } };
const saveProg = (k: string, v: { step: string; xp: number; streak: number }) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const dropProg = (k: string) => { try { sessionStorage.removeItem(k); } catch { /* ignore */ } };

export function LessonPlayer({ note, qs, childQs, childId, config, readOnly = false, onExit, setFocus, goTo, onLessonSaved, onProgress, follow, inPerson, homeworkId }: LessonPlayerProps) {
  const lesson = useMemo(() => normalizeLesson(note.lesson, note.title), [note.lesson, note.title]);
  const widget = useMemo(() => getWidget(lesson.widget), [lesson.widget]);

  const [data, setData] = useState<LessonQuestions | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const pk = progKey(note.id, childId);
  const saved = useMemo(() => (readOnly || typeof window === "undefined" ? null : loadProg(pk)), [readOnly, pk]);
  const [step, setStep] = useState<StepId>(() => (saved?.step && saved.step in LABEL && saved.step !== "done" ? (saved.step as StepId) : "start"));
  const [xp, setXp] = useState(() => saved?.xp ?? 0);
  const [streak, setStreak] = useState(() => saved?.streak ?? 0);
  const gate = useChildGate(childId);
  const [xpKey, setXpKey] = useState(0);
  const [burst, setBurst] = useState({ n: 0, scale: 1 });
  const [warm, setWarm] = useState<{ ok: number; total: number } | null>(null);
  const [quiz, setQuiz] = useState<QuizOutcome | null>(null);
  const [round, setRound] = useState(0);
  const [leave, setLeave] = useState(false);
  const streakRef = useRef(saved?.streak ?? 0);
  const top = useRef<HTMLDivElement>(null);

  // Focus mode: hide the hub's own header + sidebar while a lesson is open; always release.
  const focusRef = useRef(setFocus);
  focusRef.current = setFocus;
  useEffect(() => { focusRef.current?.(true, { bare: true }); return () => focusRef.current?.(false); }, []);

  const load = useCallback(() => {
    setLoadErr(null);
    fetchLessonQuestions(note.id, childQs).then(setData).catch((e) => setLoadErr(errMsg(e, "Couldn't load this lesson's questions")));
  }, [note.id, childQs]);
  useEffect(() => { load(); }, [load]);

  const hasWarm = (data?.warmup.length ?? lesson.warmupQuestionIds.length) > 0;
  const hasQuiz = data ? !!data.quiz : !!lesson.quizId;
  const hasDeck = lesson.deckSlides.length > 0; // Oak's real deck imported as our own editable canvas slides
  const hasSlides = lesson.slides.length > 0 || hasDeck || !!lesson.oakDeck;
  const [ownSlides, setOwnSlides] = useState(false); // a learner/tutor can swap Oak's real deck for our summary slides
  const summaryView = ownSlides && lesson.slides.length > 0;
  const slideCount = hasDeck && !summaryView ? lesson.deckSlides.length : lesson.slides.length;
  // A slide-deck lesson runs like Oak's own: warm-up questions, then the slides (they carry the key words), then the exit quiz.
  const steps = useMemo<StepId[]>(() => (hasSlides
    ? ["start", ...(hasWarm ? ["warm" as const] : []), "slides", ...(hasQuiz ? ["quiz" as const] : []), "done"]
    : ["start", ...(lesson.points.length || widget ? ["learn" as const] : []), ...(lesson.keywords.length ? ["words" as const] : []), ...(hasWarm ? ["warm" as const] : []), ...(hasQuiz ? ["quiz" as const] : []), "done"]),
  [hasSlides, lesson.points.length, lesson.keywords.length, widget, hasWarm, hasQuiz]);
  // A restored step this lesson doesn't have (its shape changed) falls back to the start.
  useEffect(() => { if (data && !steps.includes(step)) setStep("start"); }, [data, steps, step]);
  useEffect(() => {
    if (readOnly) return;
    if (step === "start" || step === "done") { dropProg(pk); return; }
    saveProg(pk, { step, xp, streak });
  }, [readOnly, pk, step, xp, streak]);
  const at = Math.max(0, steps.indexOf(step));
  const go = useCallback((s: StepId) => { setStep(s); }, []);

  // Live lessons: report where we are, and follow the tutor (never out of the quiz / the result, never into them).
  const [slide, setSlide] = useState(0);
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;
  useEffect(() => { progressRef.current?.({ step, slide: step === "slides" ? slide : 0 }); }, [step, slide]);
  const followStep = follow?.step ?? null;
  useEffect(() => {
    if (!followStep || step === "quiz" || step === "done") return;
    if (followStep === "quiz" || followStep === "done") return;
    if ((steps as string[]).includes(followStep)) setStep(followStep as StepId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followStep, steps]);
  const next = () => go(steps[Math.min(steps.length - 1, at + 1)]);
  const back = () => go(steps[Math.max(0, at - 1)]);

  // Each step change brings the top of the lesson into view.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    top.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }, [step, round]);

  const addXP = useCallback((n: number) => { setXp((x) => x + n); setXpKey((k) => k + 1); }, []);
  const scored = useCallback((ok: boolean, hinted: boolean) => {
    if (ok) {
      streakRef.current += 1;
      addXP(hinted ? 7 : 10 + Math.min(5, streakRef.current));
      if (streakRef.current >= 3) setBurst((b) => ({ n: b.n + 1, scale: 0.3 }));
    } else streakRef.current = 0;
    setStreak(streakRef.current);
  }, [addXP]);

  const finishQuiz = (o: QuizOutcome) => {
    setQuiz(o);
    if (o.result) {
      const right = o.result.answers.filter((a) => a.correct === true).length;
      addXP(right * 10);
    }
    addXP(20);
    setBurst((b) => ({ n: b.n + 1, scale: 1 }));
    go("done");
  };

  const restart = () => {
    streakRef.current = 0;
    setXp(0); setStreak(0); setWarm(null); setQuiz(null); setRound((r) => r + 1); go("start");
  };

  const leaveNow = () => { dropProg(pk); onExit(); };
  const exit = () => { if (step !== "start" && step !== "done" && !readOnly) setLeave(true); else leaveNow(); };
  const minutes = Math.max(5, Math.round(((hasSlides ? slideCount * 0.75 : lesson.points.length * 1.5) + lesson.keywords.length * 0.5 + ((data?.warmup.length ?? 0) + (data?.quiz?.questionCount ?? 0)) * 0.75) / 5) * 5);

  return (
    <div ref={top} className="mx-auto w-full max-w-[820px] scroll-mt-2" data-testid="lesson-player" data-step={step}>
      <LessonStyles />
      <Confetti fire={burst.n} scale={burst.scale} />
      {readOnly && inPerson?.banner}
      {readOnly && !inPerson && <div role="note" className="mb-3 rounded-xl border border-[var(--line)] border-l-4 border-l-[var(--brand-2)] bg-[var(--panel)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--ink)]">Preview — this is what students see. Nothing you do here is saved or counted.</div>}

      <header className="sticky top-0 z-10 -mx-1 mb-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)]/95 px-3 pb-2.5 pt-2 shadow-[var(--shadow-sm)] backdrop-blur sm:px-4">
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={exit} aria-label={readOnly ? "Close preview" : "Leave this lesson"} className={`grid h-11 w-11 flex-none place-items-center rounded-xl text-[var(--ink-2)] hover:bg-[var(--panel)] ${FOCUS}`}><Icon name="close" size={20} /></button>
          {!readOnly && <span className="hidden flex-none sm:block"><ChildChip childId={childId} /></span>}
          <div className="min-w-0 flex-1 truncate text-[11.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">{[lesson.subject, lesson.year && (/^\d+$/.test(lesson.year) ? `Year ${lesson.year}` : lesson.year), lesson.title].filter(Boolean).join(" · ")}</div>
          {!inPerson && <span className="rounded-full px-3 py-1 text-[13px] font-extrabold" style={{ background: "var(--gold-soft)", color: "color-mix(in srgb, var(--gold) 40%, #000)" }} title="Correct in a row" aria-label={`${streak} correct in a row`} data-testid="lesson-streak">🔥 {streak}</span>}
          {!inPerson && <span key={xpKey} className={`rounded-full px-3 py-1 text-[13px] font-extrabold ${xpKey ? "ls-pulse" : ""}`} style={{ background: "var(--brand-soft)", color: "var(--brand)" }} aria-label={`${xp} experience points`} data-testid="lesson-xp">⭐ {xp} XP</span>}
        </div>
        <nav aria-label="Lesson progress" className="mt-2">
          <ol className="m-0 flex list-none gap-1.5 p-0">
            {steps.map((s, i) => (
              <li key={s} aria-current={i === at ? "step" : undefined} className="min-w-0 flex-1">
                {readOnly && <button type="button" onClick={() => go(s)} aria-label={`Jump to ${LABEL[s]} (preview)`} data-testid={`preview-jump-${s}`} className="mb-1 block h-3 w-full cursor-pointer opacity-0" />}
                <span className="block h-1.5 overflow-hidden rounded-full bg-[var(--line)]"><span className="block h-full origin-left rounded-full transition-transform duration-500 motion-reduce:transition-none" style={{ background: "linear-gradient(90deg, var(--brand-2), var(--brand))", transform: `scaleX(${i < at ? 1 : i === at ? 0.5 : 0})` }} /></span>
                <span className={`mt-1 hidden truncate text-[11px] font-extrabold sm:block ${i === at ? "text-[var(--brand)]" : "text-[var(--ink-3)]"}`}>{LABEL[s]}</span>
              </li>
            ))}
          </ol>
          <p className="m-0 mt-1 flex items-center gap-2 text-[11.5px] font-extrabold text-[var(--brand)] sm:hidden">{!readOnly && <ChildChip childId={childId} />}<span>Step {at + 1} of {steps.length} · {LABEL[step]}</span></p>
        </nav>
      </header>

      <div key={`${round}-${step}`}>
        {step === "start" && (
          <StepCard hero>
            <div className="flex flex-wrap gap-2 text-[12px] font-extrabold">
              {[lesson.keyStage && lesson.year ? `${lesson.keyStage} · ${/^\d+$/.test(lesson.year) ? `Year ${lesson.year}` : lesson.year}` : lesson.keyStage || (/^\d+$/.test(lesson.year) ? `Year ${lesson.year}` : lesson.year), lesson.subject].filter(Boolean).map((c) => <span key={c} className="rounded-full bg-white/20 px-3 py-[3px]">{c}</span>)}
            </div>
            {lesson.unit && <p className="m-0 mt-3.5 text-[13px] text-white/75">{lesson.unit}</p>}
            <h1 className="m-0 mb-2 mt-1 text-[26px] font-extrabold leading-tight sm:text-[30px]" style={display} tabIndex={-1} data-autofocus>{lesson.title}</h1>
            {lesson.outcome && <p className="m-0 text-[17px] text-white/90"><b>By the end you can:</b> {lesson.outcome.replace(/^I can /i, "").replace(/\.$/, "")}.</p>}
            {lesson.outline.length > 0 && <ul className="m-0 my-3 flex list-none flex-wrap gap-2 p-0">{lesson.outline.map((o) => <li key={o} className="rounded-full bg-white/20 px-3 py-[3px] text-[12px] font-extrabold">◆ {o}</li>)}</ul>}
            <p className="m-0 mb-4 text-[13px] text-white/75">About {minutes} minutes · {hasSlides ? `${slideCount} slides` : `${lesson.points.length} ${lesson.points.length === 1 ? "idea" : "ideas"} · ${lesson.keywords.length} key ${lesson.keywords.length === 1 ? "word" : "words"}`}{data ? ` · ${data.warmup.length + (data.quiz?.questionCount ?? 0)} questions` : ""}</p>
            {loadErr && <p role="alert" className="mb-3 rounded-xl bg-white px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--red)]">{loadErr} <button type="button" onClick={load} className="font-extrabold underline">Try again</button></p>}
            {!readOnly && <WhoIsLearning childId={childId} tone="dark" />}
            <button type="button" onClick={next} disabled={!data || (!readOnly && !gate.ok)} data-testid="lesson-start"
              className={`inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-extrabold text-[var(--brand)] transition hover:brightness-95 disabled:opacity-50 ${FOCUS}`}>{data ? "Start the lesson →" : loadErr ? "Can't start yet" : "Getting ready…"}</button>
          </StepCard>
        )}

        {step === "learn" && <LearnStep lesson={lesson} widget={widget} addXP={addXP} onDone={next} onBack={back} />}
        {step === "slides" && hasDeck && !summaryView && (
          <SlideDeck slides={lesson.deckSlides} addXP={addXP} onDone={next} onBack={back} onIndex={setSlide} followIndex={followStep === "slides" ? follow?.slide ?? null : null}
            toolbar={lesson.slides.length > 0 ? <Btn tone="ghost" onClick={() => setOwnSlides(true)} data-testid="oak-deck-summary" className="!min-h-[36px] !px-3 !text-[12.5px]">Summary slides instead</Btn> : undefined}
            editor={readOnly && onLessonSaved ? { save: async (sl) => { onLessonSaved(await saveLessonSlides(note.id, qs, sl, "deckSlides")); } } : undefined} />
        )}
        {step === "slides" && !hasDeck && lesson.oakDeck && !summaryView && <OakDeckStep deckId={lesson.oakDeck} title={lesson.title} hasSummary={lesson.slides.length > 0} onSummary={() => setOwnSlides(true)} addXP={addXP} onDone={next} onBack={back} />}
        {step === "slides" && (summaryView || (!hasDeck && !lesson.oakDeck)) && (
          <SlideDeck slides={lesson.slides} addXP={addXP} onDone={next} onBack={back} onIndex={setSlide} followIndex={followStep === "slides" ? follow?.slide ?? null : null}
            toolbar={hasDeck && summaryView ? <Btn tone="ghost" onClick={() => setOwnSlides(false)} data-testid="oak-deck-real" className="!min-h-[36px] !px-3 !text-[12.5px]">Lesson slides</Btn> : undefined}
            editor={readOnly && onLessonSaved ? { save: async (sl) => { onLessonSaved(await saveLessonSlides(note.id, qs, sl)); } } : undefined} />
        )}
        {step === "words" && <WordsStep lesson={lesson} addXP={addXP} onDone={next} onBack={back} />}
        {step === "warm" && data && (
          <WarmupStep questions={data.warmup} config={config} scored={scored} onBack={back} skippable={readOnly} extra={inPerson?.warmupExtra}
            check={(id, response) => checkWarmup(note.id, childQs, id, response)}
            onDone={(res: WarmupOutcome[]) => { setWarm({ ok: res.filter((r) => r.ok).length, total: res.length }); addXP(10); next(); }} />
        )}
        {step === "quiz" && data?.quiz && inPerson && inPerson.quiz({ quiz: data.quiz, onFinish: () => finishQuiz({ result: null, run: null, notice: null }), onBack: back })}
        {step === "quiz" && data?.quiz && !inPerson && (
          <QuizStep quiz={data.quiz} qs={qs} childId={childId} homeworkId={homeworkId} config={config} readOnly={readOnly} preview={readOnly ? { noteId: note.id, childQs } : undefined} onFinish={finishQuiz} onBack={back} />
        )}
        {step === "done" && inPerson && inPerson.done({ onExit })}
        {step === "done" && !inPerson && (
          <DoneStep lesson={lesson} quiz={quiz} warm={warm} xp={xp} preview={readOnly} onAgain={restart} onExit={leaveNow} onFlashcards={goTo && !readOnly && lesson.keywords.length ? () => goTo("flashcards") : undefined} />
        )}
      </div>

      {leave && (
        <Modal title="Leave this lesson?" onClose={() => setLeave(false)}
          footer={<><Btn tone="ghost" onClick={() => setLeave(false)}>Stay</Btn><Btn onClick={leaveNow} data-testid="lesson-leave">Leave</Btn></>}>
          <p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">You can come back and start it again. Quiz answers you haven&apos;t handed in aren&apos;t saved.</p>
        </Modal>
      )}
    </div>
  );
}
