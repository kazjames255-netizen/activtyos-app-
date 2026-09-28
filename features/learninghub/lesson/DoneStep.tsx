"use client";

import { useT } from "@/lib/i18n/provider";
import { Mascot, MascotSpeech, useMascotEnabled } from "../mascot";
import { useSupport } from "../family/FamilyContext";
import { useEffect, useRef } from "react";
import { describeAnswer } from "./answerText";
import { Btn, StepCard, Tag, display } from "./lessonUi";
import { PlanRecap } from "./LessonPlanView";
import type { QuizOutcome } from "./QuizStep";
import type { Lesson } from "./types";

// "Done": stars, score, XP, the mistakes worth another look, the flashcards note and the step-by-step recap of the lesson plan.

export function DoneStep({ lesson, quiz, warm, xp, preview, onAgain, onExit, onFlashcards }: {
  lesson: Lesson; quiz: QuizOutcome | null; warm: { ok: number; total: number } | null; xp: number; preview: boolean;
  onAgain: () => void; onExit: () => void; onFlashcards?: () => void;
}) {
  const t = useT();
  const mascotOn = useMascotEnabled();
  const calm = useSupport().calm;
  const TITLES = [t("hublessons.doneT0"), t("hublessons.doneT1"), t("hublessons.doneT2"), t("hublessons.doneT3")];
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
      {mascotOn && !preview && (
        <div className="mb-2 flex items-center justify-center gap-2" data-testid="lesson-done-mascot">
          <Mascot pose={stars >= 2 ? (calm ? "wave" : "celebrate") : "encourage"} size={96} />
          {stars < 2 && <MascotSpeech side="left">{t("hubmascot.again")}</MascotSpeech>}
        </div>
      )}
      <Tag>{preview ? t("hublessons.previewComplete") : t("hublessons.lessonComplete")}</Tag>
      <h1 ref={head} tabIndex={-1} className="m-0 mt-2 text-[26px] font-extrabold leading-tight text-[var(--ink)] outline-none sm:text-[30px]" style={display}>{TITLES[stars]}</h1>
      <div className="my-2 text-[44px] leading-none tracking-[6px]" role="img" aria-label={t("hublessons.starsOutOf3", { n: stars })}>
        <span style={{ color: "var(--gold)" }}>{"★".repeat(stars)}</span><span style={{ color: "var(--line)" }}>{"★".repeat(3 - stars)}</span>
      </div>
      {r ? (
        <>
          <p className="m-0 text-[52px] font-black leading-none text-[var(--brand)]" data-testid="lesson-score">{right}<span className="text-[26px] text-[var(--ink-3)]"> / {total}</span></p>
          <p className="m-0 mt-2 text-[14.5px] text-[var(--ink-2)]">
            {r.status === "pending_marking" ? t("hublessons.autoMarked", { a: r.autoMarks ?? 0, b: r.autoMax ?? 0, n: r.writtenPending ?? 0 }) : `${r.pct}%`}
            {" · "}{t("hublessons.xpEarned", { xp })}{warm ? ` · ${t("hublessons.warmupScore", { ok: warm.ok, total: warm.total })}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 text-[13px] font-extrabold">
            <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[var(--brand)]">{t("hublessons.progressUpdated")}</span>
            {onFlashcards && <button type="button" onClick={onFlashcards} className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[var(--brand)] underline-offset-2 hover:underline">{t("hublessons.keywordsInFlashcards", { n: lesson.keywords.length })}</button>}
          </div>
        </>
      ) : (
        <p className="m-0 mt-2 text-[14.5px] text-[var(--ink-2)]" data-testid="lesson-noquiz">
          {quiz?.notice ?? (preview ? t("hublessons.previewNoQuiz") : t("hublessons.finishedLesson"))} {t("hublessons.xpEarned", { xp })}{warm ? ` · ${t("hublessons.warmupScore", { ok: warm.ok, total: warm.total })}` : ""}.
        </p>
      )}

      {r && (wrong.length ? (
        <div className="mt-5 text-start">
          <h2 className="m-0 mb-2 text-[16px] font-extrabold text-[var(--ink)]">{t("hublessons.worthAnotherLook")}</h2>
          {r.keyHeld && <p className="m-0 mb-2 text-[13.5px] text-[var(--ink-2)]" data-testid="lesson-key-held">{t("hublessons.keyHeld")}</p>}
          {wrong.map((a) => {
            const q = byId.get(a.questionId);
            const shown = describeAnswer(a.correctAnswer, q?.options, (l) => t("hublessons.optionLetter", { l }));
            return (
              <div key={a.questionId} className="my-2 rounded-e-xl border-s-4 border-[var(--red)] bg-[var(--red-soft)] px-3.5 py-2.5 text-[14px]" style={{ color: "color-mix(in srgb, var(--red) 55%, #000)" }}>
                <b>{q?.prompt || t("hublessons.question")}</b>
                {(shown || a.explanation) && <><br />{shown && <>{t("hublessons.answerIs", { a: shown })} </>}{a.explanation}</>}
              </div>
            );
          })}
        </div>
      ) : <p className="m-0 mt-4 text-[14.5px] text-[var(--ink-2)]">{t("hublessons.noMistakes")}</p>)}

      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Btn tone="ghost" onClick={onAgain}>{t("hublessons.tryAgain")}</Btn>
        <Btn onClick={onExit} data-testid="lesson-exit">{preview ? t("hublessons.closePreview") : t("hublessons.backToLessons")}</Btn>
      </div>

      {lesson.plan && <PlanRecap plan={lesson.plan} />}
    </StepCard>
  );
}
