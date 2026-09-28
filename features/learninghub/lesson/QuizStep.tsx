"use client";

import { useT } from "@/lib/i18n/provider";
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

export function QuizStep({ quiz, qs, childId, config, readOnly, onFinish, onBack, preview, homeworkId, onLiveAnswer, onView }: {
  quiz: { id: string; title: string; questionCount: number }; qs: string; childId: string | null; config: HubSettings; readOnly: boolean;
  /** Tutor preview: the lesson to practise the quiz of (instant feedback, nothing saved). */
  preview?: { noteId: string; childQs: string };
  /** The homework this lesson was opened from: the quiz attempt is recorded against it. */
  homeworkId?: string | null;
  /** Remote-sync "own_pace": fired on every change to the current question's answer-so-far, with its prompt text
   *  (so the tutor's mini-screen can show "Q: …" with no separate lookup). Real-quiz correctness isn't known until
   *  submission, so there's no verdict here — the tutor's screen just shows "answered". */
  onLiveAnswer?: (questionId: string, response: unknown, prompt: string) => void;
  /** "Ask my teacher": fired as soon as a question is on screen (before any answer). */
  onView?: (q: { id: string; prompt: string }) => void;
  onFinish: (o: QuizOutcome) => void; onBack: () => void;
}) {
  const t = useT();
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
      if (!childId) { onFinish({ result: null, run: null, notice: t("hublessons.qzChooseChild") }); return; }
      try {
        const r = await startQuizAttempt(qs, quiz.id, childId, homeworkId);
        if (!r.questions?.length) throw new Error(t("hublessons.qzNoQuestions"));
        // A refresh / Back mid-quiz: the same attempt comes back "resumed"; put the answers typed so far back.
        const d = r.resumed ? pickDraft(r.draft, loadDraft(r.attemptId)) : null;
        if (d) { setAnswers(d.a); setIdx(Math.min(d.idx, r.questions.length - 1)); }
        setRun(r); setPhase("taking");
      } catch (e) {
        const body = e instanceof ApiError ? (e.body as { code?: string; reason?: string; nextAvailableAt?: string | null } | undefined) : undefined;
        let notice = errMsg(e, t("hublessons.qzCouldntStart"));
        if (e instanceof ApiError && e.status === 409) {
          if (body?.code === "retake_blocked") notice = retakeBlockedFor(body.reason, body.nextAvailableAt);
          else if (body?.code === "not_for_this_child") notice = t("hublessons.qzNotForYear");
          else if (body?.code === "diagnostic_required") notice = kidWords ? t("hublessons.qzDiagKid") : t("hublessons.qzDiagAdult");
        }
        onFinish({ result: null, run: null, notice });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { box.current?.focus({ preventScroll: true }); }, [idx, phase]);
  useEffect(() => { if (run && phase === "taking") onView?.({ id: run.questions[idx]!.id, prompt: run.questions[idx]!.prompt }); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, phase, idx]);
  useEffect(() => { if (run && !readOnly && phase === "taking") saveDraft(run.attemptId, answers, idx); }, [run, readOnly, phase, answers, idx]);
  const currentAnswer = run?.questions[idx] ? answers[run.questions[idx]!.id] : undefined;
  useEffect(() => {
    if (!run || readOnly || phase !== "taking" || currentAnswer === undefined) return;
    onLiveAnswer?.(run.questions[idx]!.id, currentAnswer, run.questions[idx]!.prompt);
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
        <Tag>{t("hublessons.quizTag")}</Tag>
        <h2 className="m-0 mb-1.5 mt-2 text-[21px] font-extrabold text-[var(--ink)]" style={display} tabIndex={-1} data-autofocus>{quiz.title}</h2>
        <p className="m-0 text-[14.5px] text-[var(--ink-2)]">{t("hublessons.qzReadOnlyInfo", { n: quiz.questionCount })}</p>
        <div className="mt-5 flex justify-between gap-3"><Btn tone="ghost" onClick={onBack}>{t("hublessons.back")}</Btn><Btn onClick={() => onFinish({ result: null, run: null, notice: null })} data-testid="lesson-next">{t("hublessons.skipToEndArrow")}</Btn></div>
      </StepCard>
    );
  }
  if (!run || phase === "starting") {
    return <StepCard><div role="status" aria-label={t("hublessons.qzGettingReady")} className="grid gap-3"><div aria-hidden className="h-6 w-40 animate-pulse rounded bg-[var(--panel)]" /><div aria-hidden className="h-24 animate-pulse rounded-xl bg-[var(--panel)]" /><div aria-hidden className="h-14 animate-pulse rounded-xl bg-[var(--panel)]" /></div></StepCard>;
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
      setErr(errMsg(e, t("hublessons.qzCouldntHandIn")));
    }
  };

  return (
    <StepCard>
      <div ref={box} tabIndex={-1} className="outline-none">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="flex flex-wrap items-center gap-2"><Tag>{t("hublessons.qzXofY", { n: idx + 1, total: qs_.length })}</Tag><ChildChip childId={childId} /></span><span className="text-[12px] text-[var(--ink-3)]">{t("hublessons.qzMarkedWhenFinish")}</span></div>
        <QuestionView key={q.id} q={q} rule={ruleOf(config.questionKinds, q.kind)} value={answers[q.id]} onChange={(v) => setAnswers((m) => ({ ...m, [q.id]: v }))} onRefreshImages={refreshImages} autoFocus />
      </div>
      {err && <p role="alert" className="mt-3 rounded-xl bg-[var(--red-soft)] px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--red)]">{err}</p>}
      {warn && <p role="alert" className="mt-3 rounded-xl border border-[var(--line)] border-s-4 border-s-[var(--gold)] bg-[var(--panel)] px-3.5 py-2.5 text-[14px] font-semibold text-[var(--ink)]">{t("hublessons.qzUnansweredWarn", { n: unanswered })}</p>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        {idx === 0 ? <Btn tone="ghost" onClick={onBack} disabled={phase === "submitting"}>{t("hublessons.back")}</Btn> : <Btn tone="ghost" onClick={() => { setWarn(false); setIdx(idx - 1); }} disabled={phase === "submitting"}>{t("hublessons.previousArrow")}</Btn>}
        {!last
          ? <Btn onClick={() => setIdx(idx + 1)} data-testid="lesson-next">{isAnswered(answers[q.id]) ? t("hublessons.nextArrow") : t("hublessons.skipArrow")}</Btn>
          : warn && unanswered > 0
            ? <span className="flex gap-2"><Btn tone="ghost" onClick={() => { setWarn(false); setIdx(qs_.findIndex((x) => !isAnswered(answers[x.id]))); }}>{t("hublessons.goBack")}</Btn><Btn onClick={submit} disabled={phase === "submitting"} data-testid="lesson-finish">{t("hublessons.handInAnyway")}</Btn></span>
            : <Btn onClick={() => { if (unanswered > 0) setWarn(true); else void submit(); }} disabled={phase === "submitting"} data-testid="lesson-finish">{phase === "submitting" ? t("hublessons.marking") : t("hublessons.finishArrow")}</Btn>}
      </div>
    </StepCard>
  );
}


/** A tutor's preview of the exit quiz: the real questions, one at a time, checked instantly by the server; nothing is started or saved. */
function QuizPractice({ quiz, preview, config, onFinish, onBack }: { quiz: { title: string }; preview: { noteId: string; childQs: string }; config: HubSettings; onFinish: () => void; onBack: () => void }) {
  const t = useT();
  const [data, setData] = useState<LessonQuestions | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  useEffect(() => { fetchLessonQuestions(preview.noteId, preview.childQs, true).then(setData).catch((e) => setErr(errMsg(e, t("hublessons.qzLoadErr")))); }, [preview.noteId, preview.childQs]);
  if (err) return <StepCard><p role="alert" className="m-0 text-[14px] font-semibold text-[var(--red)]">{err}</p><div className="mt-4"><Btn tone="ghost" onClick={onBack}>{t("hublessons.back")}</Btn></div></StepCard>;
  if (!data) return <StepCard><div role="status" aria-label={t("hublessons.qzLoading")} className="h-24 animate-pulse rounded-xl bg-[var(--panel)]" /></StepCard>;
  if (!started) {
    return (
      <StepCard>
        <Tag>{t("hublessons.quizTag")}</Tag>
        <h2 className="m-0 mb-1.5 mt-2 text-[21px] font-extrabold text-[var(--ink)]" style={display} tabIndex={-1} data-autofocus>{quiz.title}</h2>
        <p className="m-0 text-[14.5px] text-[var(--ink-2)]">{t("hublessons.qzPracticeInfo", { n: data.warmup.length })}</p>
        <div className="mt-5 flex justify-between gap-3"><Btn tone="ghost" onClick={onBack}>{t("hublessons.back")}</Btn><span className="flex gap-2"><Btn tone="ghost" onClick={onFinish}>{t("hublessons.skipToEnd")}</Btn><Btn onClick={() => setStarted(true)} data-testid="quiz-preview-try">{t("hublessons.tryQuizArrow")}</Btn></span></div>
      </StepCard>
    );
  }
  return <WarmupStep questions={data.warmup} config={config} scored={() => undefined} onBack={() => setStarted(false)} skippable check={(id, response) => checkWarmup(preview.noteId, preview.childQs, id, response, true)} onDone={() => onFinish()} />;
}
