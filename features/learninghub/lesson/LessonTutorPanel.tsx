"use client";

import { useT } from "@/lib/i18n/provider";
import { useMemo } from "react";
import { Button } from "@/components/ui";
import { Icon } from "../kit";
import type { Note } from "../types";
import { setHubIntent } from "../hubIntent";
import { LessonPlanSection } from "./LessonPlanView";
import { rich } from "./tRich";
import { normalizeLesson } from "./types";

// What a tutor sees on an interactive lesson (instead of the pupil player): a summary of what pupils get, and a Preview
// button (opens the player read-only, where slides can be edited or deleted).

export function LessonTutorPanel({ note, qs, canEdit, goTo, onPreview, onSaved, onError }: {
  note: Note; qs: string; canEdit: boolean; goTo?: (key: "homework") => void; onPreview: () => void; onSaved: (n: Note) => void; onError: (m: string) => void;
}) {
  const lesson = useMemo(() => normalizeLesson(note.lesson, note.title), [note.lesson, note.title]);
  const t = useT();
  const ws = note.lesson?.worksheet;
  const facts = [
    ...(lesson.deckSlides.length ? [t("hublessons.factEditableSlides", { n: lesson.deckSlides.length })] : []),
    ...(lesson.slides.length ? [lesson.deckSlides.length ? t("hublessons.factSummarySlides", { n: lesson.slides.length }) : t("hublessons.factInteractiveSlides", { n: lesson.slides.length })] : lesson.deckSlides.length ? [] : [
      t("hublessons.factIdeas", { n: lesson.points.length }),
      t("hublessons.factKeyWords", { n: lesson.keywords.length }),
    ]),
    t("hublessons.factWarmupQs", { n: lesson.warmupQuestionIds.length }),
    lesson.quizId ? t("hublessons.factExitQuiz") : t("hublessons.factNoQuiz"),
  ];

  return (
    <>
    <section aria-labelledby="hub-lesson-tools" className="hub-no-print mt-6 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" data-testid="lesson-tutor-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="hub-lesson-tools" className="m-0 flex items-center gap-2 text-[15px] font-extrabold text-[var(--ink)]"><Icon name="sparkle" size={16} /> {t("hublessons.interactiveLesson")}</h3>
          <p className="m-0 mt-1 text-[12.5px] text-[var(--ink-2)]">{t("hublessons.tutorSummary", { facts: facts.join(" · ") })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="solid" onClick={onPreview} className="!h-[44px] !px-5" data-testid="lesson-preview"><Icon name="play" size={15} /> {t("hublessons.previewLesson")}</Button>
        </div>
      </div>

      {ws?.assessmentId && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-[var(--line)] pt-4" data-testid="lesson-worksheet">
          <p className="m-0 min-w-0 text-[12.5px] text-[var(--ink-2)]">{rich(t("hublessons.worksheetNote", { title: ws.title || t("hublessons.lessonWorksheet") }), { ws: <b className="text-[var(--ink)]">{t("hublessons.worksheet")}</b> })}</p>
          {canEdit && goTo && (
            <Button onClick={() => { setHubIntent({ kind: "homework", groupId: "", assessmentId: ws.assessmentId, noteIds: ws.noteId ? [ws.noteId] : [], title: ws.title || note.title }); goTo("homework"); }} className="!h-[44px] lg:!h-[40px]" data-testid="lesson-set-homework">
              <Icon name="homework" size={15} /> {t("hublessons.setWorksheetHomework")}
            </Button>
          )}
        </div>
      )}
    </section>
    {lesson.plan && <LessonPlanSection plan={lesson.plan} />}
    </>
  );
}
