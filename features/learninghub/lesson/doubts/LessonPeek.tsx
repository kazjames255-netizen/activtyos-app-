"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { get } from "@/lib/api";
import type { HubSettings } from "@/lib/hubConfig";
import { ruleOf } from "../../shared-assess/api";
import { QuestionView } from "../../shared-assess/QuestionView";
import { errMsg } from "../../types";
import { fetchLessonQuestions, type LessonQuestions } from "../api";
import { LessonStyles, StepCard, Tag, display } from "../lessonUi";
import { SlideDeck } from "../slides/SlideDeck";
import type { Slide } from "../slides/types";

// #learning-hub carries CSS-variable overrides (a warm light palette, forced regardless of the tutor's own
// dark-mode preference) that every hub overlay depends on — portalling past it to document.body falls back to
// the app's plain :root tokens instead, which on a dark-mode account renders this black-on-black. Match every
// other hub overlay (features/learninghub/teachKit.tsx's FullscreenPortal) and portal INTO it.
const Portal = ({ children }: { children: ReactNode }) => {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.getElementById("learning-hub") ?? document.body);
};

/** A quick, read-only look at exactly what a student was looking at when they asked — the real slide (rendered the
 *  same way they saw it), or the real warm-up/quiz question — in a small popup, not the full lesson player. Just
 *  view and close; nothing here is answered, saved or navigated into.
 *
 *  Goes through GET /notes/:id/slide-peek (slides) and the ordinary lesson-questions endpoint (warm-up/quiz) —
 *  never the general GET /notes/:id, which 404s a family that was never formally SET this lesson as homework;
 *  being party to a thread about it is proof enough they were shown it. */
export function LessonPeek({ qs, noteId, step, slide, questionId, lessonTitle, config, onClose }: {
  qs: string; noteId: string; step: string; slide: number; questionId: string | null; lessonTitle: string | null; config: HubSettings; onClose: () => void;
}) {
  // The caller already knows the lesson's title (it's the thread's own header) — show it immediately
  // instead of waiting on a round-trip, and only correct it if slide-peek's own response disagrees.
  const [title, setTitle] = useState<string | null>(lessonTitle);
  const [slideData, setSlideData] = useState<Slide | null | undefined>(undefined);
  const [data, setData] = useState<LessonQuestions | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (step === "slides") {
      get<{ title: string; slide: Slide | null }>(`/api/learning-hub/notes/${noteId}/slide-peek${qs}${qs.includes("?") ? "&" : "?"}slide=${slide}`)
        .then((r) => { if (alive) { setTitle(r.title); setSlideData(r.slide); } })
        .catch((e) => { if (alive) setErr(errMsg(e, "Couldn't load this")); });
    } else if (step === "warm" || step === "quiz") {
      fetchLessonQuestions(noteId, qs, step === "quiz").then((d) => { if (alive) setData(d); }).catch((e) => { if (alive) setErr(errMsg(e, "Couldn't load this")); });
    }
    return () => { alive = false; };
  }, [noteId, qs, step, slide]);

  const question = data?.warmup.find((q) => q.id === questionId) ?? null;

  let body: ReactNode;
  if (err) body = <p role="alert" className="m-0 text-[14px] font-semibold text-[var(--red)]">{err}</p>;
  else if (step === "slides") {
    if (slideData === undefined) body = <div className="h-40 animate-pulse rounded-xl bg-[var(--panel)]" />;
    else if (slideData === null) body = <p className="m-0 text-[14px] text-[var(--ink-2)]">That slide isn&apos;t there any more.</p>;
    else body = <SlideDeck slides={[slideData]} addXP={() => undefined} onDone={onClose} onBack={onClose} />;
  } else if (step === "warm" || step === "quiz") {
    body = !data
      ? <div className="h-40 animate-pulse rounded-xl bg-[var(--panel)]" />
      : question
        ? (
          <StepCard>
            <Tag>{step === "quiz" ? "Quiz" : "Warm-up"}</Tag>
            <div className="mt-3">
              <QuestionView q={question} rule={ruleOf(config.questionKinds, question.kind)} value={undefined} onChange={() => undefined} disabled />
            </div>
          </StepCard>
        )
        : <p className="m-0 text-[14px] text-[var(--ink-2)]">That question isn&apos;t there any more.</p>;
  } else {
    body = <p className="m-0 text-[14px] text-[var(--ink-2)]">This part of the lesson doesn&apos;t have a specific page to show.</p>;
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-[520] flex items-stretch justify-center bg-[color-mix(in_srgb,var(--ink)_45%,transparent)] md:items-center md:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div role="dialog" aria-modal="true" aria-label="What the student saw" className="flex max-h-full w-full flex-col overflow-hidden bg-[var(--surface)] shadow-[var(--shadow-pop)] md:max-h-[90vh] md:max-w-[720px] md:rounded-2xl">
          <div className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
            <h2 className="min-w-0 flex-1 truncate text-[16px] font-extrabold text-[var(--ink)]" style={display}>{title ?? "Lesson"}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 flex-none place-items-center rounded-xl text-[20px] leading-none text-[var(--ink-2)] hover:bg-[var(--panel)]">×</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <LessonStyles />
            {body}
          </div>
        </div>
      </div>
    </Portal>
  );
}
