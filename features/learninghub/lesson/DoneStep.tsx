"use client";

import { useEffect, useRef } from "react";
import { describeAnswer } from "./answerText";
import { Btn, StepCard, Tag, display } from "./lessonUi";
import { PlanRecap } from "./LessonPlanView";
import type { QuizOutcome } from "./QuizStep";
import type { Lesson } from "./types";

// "Done": stars, score, XP, the mistakes worth another look, the flashcards note and the step-by-step recap of the lesson plan.

const TITLES = ["Keep going!", "Good effort!", "Great work!", "Brilliant!"];

export function DoneStep({ lesson, quiz, warm, xp, preview, onAgain, onExit, onFlashcards }: {
  lesson: Lesson; quiz: QuizOutcome | null; warm: { ok: number; total: number } | null; xp: number; preview: boolean;
  onAgain: () => void; onExit: () => void; onFlashcards?: () => void;
}) {
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => { head.current?.focus({ preventScroll: true }); }, []);
  const r = quiz?.result ?? null;
  const total = r?.answers.length ?? 0;
  const right = r?.answers.filter((a) => a.correct === true).length ?? 0;
  const pct = r ? (r.status === "pending_marking" && r.autoMax ? Math.round(((r.autoMarks ?? 0) / r.autoMax) * 100) : r.pct) : 100;
  const stars = r ? (pct >= 90 ? 3 : pct >= 60 ? 2 : pct >= 30 ? 1 : 0) : 3;
  const byId = new Map((quiz?.run?.questions ?? []).map((q) => [q.id, q] as const));
  const wrong = (r?.answers ?? []).filter((a) => a.correct === false);

  return (
    <StepCard className="text-center">
      <Tag>{preview ? "Preview complete" : "Lesson complete"}</Tag>
      <h1 ref={head} tabIndex={-1} className="m-0 mt-2 text-[26px] font-extrabold leading-tight text-[var(--ink)] outline-none sm:text-[30px]" style={display}>{TITLES[stars]}</h1>
      <div className="my-2 text-[44px] leading-none tracking-[6px]" role="img" aria-label={`${stars} out of 3 stars`}>
        <span style={{ color: "var(--gold)" }}>{"★".repeat(stars)}</span><span style={{ color: "var(--line)" }}>{"★".repeat(3 - stars)}</span>
      </div>
      {r ? (
        <>
          <p className="m-0 text-[52px] font-black leading-none text-[var(--brand)]" data-testid="lesson-score">{right}<span className="text-[26px] text-[var(--ink-3)]"> / {total}</span></p>
          <p className="m-0 mt-2 text-[14.5px] text-[var(--ink-2)]">
            {r.status === "pending_marking" ? `Auto-marked ${r.autoMarks ?? 0}/${r.autoMax ?? 0} · ${r.writtenPending ?? 0} written ${r.writtenPending === 1 ? "answer" : "answers"} being reviewed` : `${r.pct}%`}
            {" · "}{xp} XP earned{warm ? ` · warm-up ${warm.ok}/${warm.total}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 text-[13px] font-extrabold">
            <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[var(--brand)]">📈 Your progress is updated</span>
            {onFlashcards && <button type="button" onClick={onFlashcards} className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[var(--brand)] underline-offset-2 hover:underline">🃏 {lesson.keywords.length} key words are in your flashcards</button>}
          </div>
        </>
      ) : (
        <p className="m-0 mt-2 text-[14.5px] text-[var(--ink-2)]" data-testid="lesson-noquiz">
          {quiz?.notice ?? (preview ? "That's the whole lesson. Students finish with a short quiz here." : "You've finished the lesson.")} {xp} XP earned{warm ? ` · warm-up ${warm.ok}/${warm.total}` : ""}.
        </p>
      )}

      {r && (wrong.length ? (
        <div className="mt-5 text-left">
          <h2 className="m-0 mb-2 text-[16px] font-extrabold text-[var(--ink)]">Worth another look</h2>
          {r.keyHeld && <p className="m-0 mb-2 text-[13.5px] text-[var(--ink-2)]" data-testid="lesson-key-held">The answers unlock when you pass the quiz. Look back over the lesson, then have another go.</p>}
          {wrong.map((a) => {
            const q = byId.get(a.questionId);
            const shown = describeAnswer(a.correctAnswer, q?.options);
            return (
              <div key={a.questionId} className="my-2 rounded-r-xl border-l-4 border-[var(--red)] bg-[var(--red-soft)] px-3.5 py-2.5 text-[14px]" style={{ color: "color-mix(in srgb, var(--red) 55%, #000)" }}>
                <b>{q?.prompt || "Question"}</b>
                {(shown || a.explanation) && <><br />{shown && <>Answer: {shown}. </>}{a.explanation}</>}
              </div>
            );
          })}
        </div>
      ) : <p className="m-0 mt-4 text-[14.5px] text-[var(--ink-2)]">No mistakes — you can move on to the next lesson.</p>)}

      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Btn tone="ghost" onClick={onAgain}>↺ Try the lesson again</Btn>
        <Btn onClick={onExit} data-testid="lesson-exit">{preview ? "Close preview" : "Back to lessons"}</Btn>
      </div>

      {lesson.plan && <PlanRecap plan={lesson.plan} />}
    </StepCard>
  );
}
