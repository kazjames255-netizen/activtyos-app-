"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HubSettings } from "@/lib/hubConfig";
import { ApiError } from "@/lib/api";
import { hubPath, ruleOf, type Result, type StartedAttempt } from "../shared-assess/api";
import { isAnswered, QuestionView, type Answer } from "../shared-assess/QuestionView";
import { retakeBlockedFor } from "../shared-assess/retake";
import { errMsg } from "../types";
import { checkWarmup, fetchLessonQuestions, startQuizAttempt, submitQuizAttempt, type LessonQuestions } from "./api";
import { WarmupStep } from "./WarmupStep";
import { ChildChip, useFamily } from "../family/FamilyContext";
import { clearDraft, loadDraft, pickDraft, saveDraft } from "../shared-assess/draft";
import { useDraftSync } from "../shared-assess/useDraftSync";
import { Btn, StepCard, Tag, display } from "./lessonUi";

// "Quiz": the lesson's exit quiz. This is a REAL attempt on the real assessment (POST /assessments/:id/attempts → submit), so
// its score feeds the child's mastery and follows the tenant's retake / audience rules. Answers stay in the browser until the
// last question is handed in — the server marks them and only then reveals feedback (per the reveal policy), exactly like the
// Quizzes tab. In a tutor preview nothing is started.

export interface QuizOutcome { result: Result | null; run: StartedAttempt | null; notice: string | null }

export function QuizStep({ quiz, qs, childId, config, readOnly, onFinish, onBack, preview, homeworkId, onLiveAnswer }: {
  quiz: { id: string; title: string; questionCount: number }; qs: string; childId: string | null; config: HubSettings; readOnly: boolean;
  /** Tutor preview: the lesson to practise the quiz of (instant feedback, nothing saved). */
  preview?: { noteId: string; childQs: string };
  /** The homework this lesson was opened from: the quiz attempt is recorded against it. */
  homeworkId?: string | null;
  /** Remote-sync "own_pace": fired on every change to the current question's answer-so-far. */
  onLiveAnswer?: (questionId: string, response: unknown) => void;
  onFinish: (o: QuizOutcome) => void; onBack: () => void;
}) {
  const [run, setRun] = useState<StartedAttempt | null>(null);
  const [phase, setPhase] = useState<"starting" | "taking" | "submitting">(readOnly ? "taking" : "starting");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [err, setErr] = useState<string | null>(null);
  const [warn, setWarn] = useState(false);
  const kidWords = useFamily().kid;
  const submitted = useRef(false);
  const started = useRef(false);
  const box = useRef<HTMLDivElement>(null);

  // Start (or resume) the attempt once. A refusal the server words for a child (retake limit, year group…) ends the step politely.
  useEffect(() => {
    if (readOnly || started.current) return;
    started.current = true;
    (async () => {
      if (!childId) { onFinish({ result: null, run: null, notice: "Choose which child is doing this lesson to take the quiz." }); return; }
      try {
        const r = await startQuizAttempt(qs, quiz.id, childId, homeworkId);
        if (!r.questions?.length) throw new Error("This quiz has no questions yet.");
        // A refresh / Back mid-quiz: the same attempt comes back "resumed"; put the answers typed so far back.
        const d = r.resumed ? pickDraft(r.draft, loadDraft(r.attemptId)) : null;
        if (d) { setAnswers(d.a); setIdx(Math.min(d.idx, r.questions.length - 1)); }
        setRun(r); setPhase("taking");
      } catch (e) {
        const body = e instanceof ApiError ? (e.body as { code?: string; reason?: string; nextAvailableAt?: string | null } | undefined) : undefined;
        let notice = errMsg(e, "Couldn't start the quiz");
        if (e instanceof ApiError && e.status === 409) {
          if (body?.code === "retake_blocked") notice = retakeBlockedFor(body.reason, body.nextAvailableAt);
          else if (body?.code === "not_for_this_child") notice = "This quiz isn't set up for your year group. Ask your tutor if you think that's a mistake.";
          else if (body?.code === "diagnostic_required") notice = kidWords ? "Do the starting quiz for this subject first, then come back to this one." : "Take your placement test first, then come back to this quiz.";
        }
        onFinish({ result: null, run: null, notice });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { box.current?.focus({ preventScroll: true }); }, [idx, phase]);
  useEffect(() => { if (run && !readOnly && phase === "taking") saveDraft(run.attemptId, answers, idx); }, [run, readOnly, phase, answers, idx]);
  const currentAnswer = run?.questions[idx] ? answers[run.questions[idx]!.id] : undefined;
  useEffect(() => {
    if (!run || readOnly || phase !== "taking" || currentAnswer === undefined) return;
    onLiveAnswer?.(run.questions[idx]!.id, currentAnswer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAnswer, idx]);
  useDraftSync(run && !readOnly && childId ? hubPath(qs, `/attempts/${run.attemptId}/draft`, { childId }) : null, answers, idx, !!run && !readOnly && phase === "taking");

  // Signed picture links expire: a failed picture asks for a fresh set (the server "resumes" the same attempt and re-signs).
  const refreshImages = useCallback(async () => {
    if (!run || !childId || submitted.current) return;
    try {
      const r = await startQuizAttempt(qs, quiz.id, childId, homeworkId);
      if (r.attemptId !== run.attemptId) return;
      const fresh = new Map(r.questions.map((x) => [x.id, x]));
      setRun((cur) => cur && { ...cur, questions: cur.questions.map((x) => { const f = fresh.get(x.id); return f ? { ...x, image: f.image, options: x.options?.map((o) => ({ ...o, image: f.options?.find((y) => y.id === o.id)?.image ?? o.image })) } : x; }) });
    } catch { /* the picture shows its own "couldn't load" tile */ }
  }, [run, childId, qs, quiz.id, homeworkId]);

  if (readOnly && preview) return <QuizPractice quiz={quiz} preview={preview} config={config} onFinish={() => onFinish({ result: null, run: null, notice: null })} onBack={onBack} />;
  if (readOnly) {
    return (
      <StepCard>
        <Tag>Quiz</Tag>
        <h2 className="m-0 mb-1.5 mt-2 text-[21px] font-extrabold text-[var(--ink)]" style={display} tabIndex={-1} data-autofocus>{quiz.title}</h2>
        <p className="m-0 text-[14.5px] text-[var(--ink-2)]">Students answer this {quiz.questionCount}-question quiz here, one question at a time. Their score counts towards mastery. Nothing is started in preview.</p>
        <div className="mt-5 flex justify-between gap-3"><Btn tone="ghost" onClick={onBack}>Back</Btn><Btn onClick={() => onFinish({ result: null, run: null, notice: null })} data-testid="lesson-next">Skip to the end →</Btn></div>
      </StepCard>
    );
  }
  if (!run || phase === "starting") {
    return <StepCard><div role="status" aria-label="Getting your quiz ready" className="grid gap-3"><div aria-hidden className="h-6 w-40 animate-pulse rounded bg-[var(--panel)]" /><div aria-hidden className="h-24 animate-pulse rounded-xl bg-[var(--panel)]" /><div aria-hidden className="h-14 animate-pulse rounded-xl bg-[var(--panel)]" /></div></StepCard>;
  }

  const qs_ = run.questions;
  const q = qs_[idx];
  const last = idx === qs_.length - 1;
  const unanswered = qs_.filter((x) => !isAnswered(answers[x.id])).length;

  const submit = async () => {
    if (submitted.current || !childId) return;
    submitted.current = true; setPhase("submitting"); setErr(null); setWarn(false);
    try {
      const body = qs_.flatMap((x): { questionId: string; response: unknown }[] => {
        const v = answers[x.id];
        if (!isAnswered(v)) return [];
        if (typeof v === "string" && ruleOf(config.questionKinds, x.kind) === "numeric") { const n = Number(v.replace(/,/g, "").trim()); return [{ questionId: x.id, response: Number.isFinite(n) ? n : v }]; }
        return [{ questionId: x.id, response: v }];
      });
      const result = await submitQuizAttempt(qs, run.attemptId, childId, body);
      clearDraft(run.attemptId);
      onFinish({ result, run, notice: null });
    } catch (e) {
      submitted.current = false; setPhase("taking");
      setErr(errMsg(e, "Couldn't hand your quiz in — try again"));
    }
  };

  return (
    <StepCard>
      <div ref={box} tabIndex={-1} className="outline-none">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="flex flex-wrap items-center gap-2"><Tag>Quiz · {idx + 1} of {qs_.length}</Tag><ChildChip childId={childId} /></span><span className="text-[12px] text-[var(--ink-3)]">Marked when you finish</span></div>
        <QuestionView key={q.id} q={q} rule={ruleOf(config.questionKinds, q.kind)} value={answers[q.id]} onChange={(v) => setAnswers((m) => ({ ...m, [q.id]: v }))} onRefreshImages={refreshImages} autoFocus />
      </div>
      {err && <p role="alert" className="mt-3 rounded-xl bg-[var(--red-soft)] px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--red)]">{err}</p>}
      {warn && <p role="alert" className="mt-3 rounded-xl border border-[var(--line)] border-l-4 border-l-[var(--gold)] bg-[var(--panel)] px-3.5 py-2.5 text-[14px] font-semibold text-[var(--ink)]">You haven&apos;t answered {unanswered} {unanswered === 1 ? "question" : "questions"}. Unanswered questions score no marks.</p>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        {idx === 0 ? <Btn tone="ghost" onClick={onBack} disabled={phase === "submitting"}>Back</Btn> : <Btn tone="ghost" onClick={() => { setWarn(false); setIdx(idx - 1); }} disabled={phase === "submitting"}>← Previous</Btn>}
        {!last
          ? <Btn onClick={() => setIdx(idx + 1)} data-testid="lesson-next">{isAnswered(answers[q.id]) ? "Next →" : "Skip →"}</Btn>
          : warn && unanswered > 0
            ? <span className="flex gap-2"><Btn tone="ghost" onClick={() => { setWarn(false); setIdx(qs_.findIndex((x) => !isAnswered(answers[x.id]))); }}>Go back</Btn><Btn onClick={submit} disabled={phase === "submitting"} data-testid="lesson-finish">Hand in anyway</Btn></span>
            : <Btn onClick={() => { if (unanswered > 0) setWarn(true); else void submit(); }} disabled={phase === "submitting"} data-testid="lesson-finish">{phase === "submitting" ? "Marking…" : "Finish →"}</Btn>}
      </div>
    </StepCard>
  );
}


/** A tutor's preview of the exit quiz: the real questions, one at a time, checked instantly by the server; nothing is started or saved. */
function QuizPractice({ quiz, preview, config, onFinish, onBack }: { quiz: { title: string }; preview: { noteId: string; childQs: string }; config: HubSettings; onFinish: () => void; onBack: () => void }) {
  const [data, setData] = useState<LessonQuestions | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  useEffect(() => { fetchLessonQuestions(preview.noteId, preview.childQs, true).then(setData).catch((e) => setErr(errMsg(e, "Couldn't load the quiz questions"))); }, [preview.noteId, preview.childQs]);
  if (err) return <StepCard><p role="alert" className="m-0 text-[14px] font-semibold text-[var(--red)]">{err}</p><div className="mt-4"><Btn tone="ghost" onClick={onBack}>Back</Btn></div></StepCard>;
  if (!data) return <StepCard><div role="status" aria-label="Loading the quiz" className="h-24 animate-pulse rounded-xl bg-[var(--panel)]" /></StepCard>;
  if (!started) {
    return (
      <StepCard>
        <Tag>Quiz</Tag>
        <h2 className="m-0 mb-1.5 mt-2 text-[21px] font-extrabold text-[var(--ink)]" style={display} tabIndex={-1} data-autofocus>{quiz.title}</h2>
        <p className="m-0 text-[14.5px] text-[var(--ink-2)]">Students answer these {data.warmup.length} questions one at a time and their score counts towards mastery. In preview you can try them with instant feedback; nothing is saved.</p>
        <div className="mt-5 flex justify-between gap-3"><Btn tone="ghost" onClick={onBack}>Back</Btn><span className="flex gap-2"><Btn tone="ghost" onClick={onFinish}>Skip to the end</Btn><Btn onClick={() => setStarted(true)} data-testid="quiz-preview-try">Try the quiz →</Btn></span></div>
      </StepCard>
    );
  }
  return <WarmupStep questions={data.warmup} config={config} scored={() => undefined} onBack={() => setStarted(false)} skippable check={(id, response) => checkWarmup(preview.noteId, preview.childQs, id, response, true)} onDone={() => onFinish()} />;
}
