"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, Card } from "@/components/ui";
import { Icon } from "../kit";
import { SubjectCover, SubjectGlyph } from "../subjectArt";
import { ApiError, post } from "@/lib/api";
import type { PanelProps } from "../panelTypes";
import { errMsg } from "../types";
import { hubPath, ruleOf, type Assessment, type Result, type StartedAttempt } from "./api";
import { isAnswered, QuestionView, type Answer } from "./QuestionView";
import { effectivePolicy, fmtWait, retakeBlockedFor } from "./retake";
import { ResultView } from "./ResultView";
import { Chip, display, FOCUS, Meter, Modal, Notice, TAP } from "./ui";
import { AskTutorLink, ChildChip, useChildGate, useFamily, WhoIsLearning } from "../family/FamilyContext";
import { clearDraft, loadDraft, pickDraft, saveDraft } from "./draft";
import { useDraftSync } from "./useDraftSync";

// The student-side runner: intro → one question per screen (with a jump strip,
// progress bar and optional countdown) → review + confirm → scored feedback.
// The server marks; this component only collects answers and renders the reply.

type Phase = "intro" | "starting" | "taking" | "review" | "submitting" | "result";

interface Props {
  a: Assessment;
  p: PanelProps;
  childId: string;
  /** Called when the student leaves (back to the list). */
  onExit: () => void;
  /** Called after a submit so the list can refresh its "last score". */
  onSubmitted: () => void;
  /** Extra content under the score (e.g. the placement-test baseline). */
  resultExtra?: (r: Result) => ReactNode;
  /** Diagnostic copy for the intro. */
  welcome?: { title: string; body: string; bullets: string[] };
  /** Pick up a paper that was left running (skips the intro). */
  resume?: boolean;
  /** The homework this paper is being taken FOR (from a homework's "Take the quiz"): recorded on the attempt. */
  homeworkId?: string | null;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function TakeAssessment({ a, p, childId, onExit, onSubmitted, resultExtra, welcome, resume, homeworkId }: Props) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [run, setRun] = useState<StartedAttempt | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [soft, setSoft] = useState(false);
  const [confirm, setConfirm] = useState<"submit" | "leave" | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const deadline = useRef<number | null>(null);
  const submitted = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);
  const diag = a.type === "diagnostic";
  const kidNoun = useFamily().kid;
  const noun = diag ? "starting quiz" : "quiz";
  const again = effectivePolicy(a, p.config);
  // The child this paper is recorded for is exactly `childId` (the same id every request below sends and the chip shows).
  // A family with 2+ children must have said who is learning before anything starts.
  const gate = useChildGate(childId);

  const start = async () => {
    if (!gate.ok) { setErr("Choose who's learning first, so the result is saved for the right child."); return; }
    setPhase("starting"); setErr(null); setSoft(false);
    try {
      const r = await post<StartedAttempt>(hubPath(p.qs, `/assessments/${a.id}/attempts`, { childId }), { childId, ...(homeworkId ? { homeworkId } : {}) });
      if (!r.questions?.length) throw new Error(`This ${noun} has no questions yet.`);
      // A resumed paper: the newer of what the server kept (works on any device) and what this device kept.
      const draft = r.resumed ? pickDraft(r.draft, loadDraft(r.attemptId)) : null;
      setRun(r); setAnswers(draft?.a ?? {}); setIdx(Math.min(draft?.idx ?? 0, r.questions.length - 1)); submitted.current = false;
      // A resumed paper keeps its ORIGINAL clock (started when it was first opened).
      const t0 = r.resumed && r.startedAt ? Date.parse(r.startedAt) : Date.now();
      deadline.current = r.timeLimitMins ? (Number.isFinite(t0) ? t0 : Date.now()) + r.timeLimitMins * 60_000 : null;
      setLeft(r.timeLimitMins ? Math.max(0, Math.ceil((deadline.current! - Date.now()) / 1000)) : null);
      setPhase("taking");
    } catch (e) {
      // 409 codes the server uses to say "not now" — worded for a child, never raw.
      const body = e instanceof ApiError ? (e.body as { code?: string; reason?: string; nextAvailableAt?: string | null } | undefined) : undefined;
      const needsDiag = e instanceof ApiError && e.status === 409 && body?.code === "diagnostic_required";
      const blocked = e instanceof ApiError && e.status === 409 && (body?.code === "retake_blocked" || body?.code === "not_for_this_child" || needsDiag);
      setSoft(blocked);
      if (e instanceof ApiError && e.status === 409 && body?.code === "retake_blocked") setErr(retakeBlockedFor(body.reason, body.nextAvailableAt));
      else if (needsDiag) setErr(kidNoun ? "Do the starting quiz for this subject first. It unlocks the rest." : "Take the starting quiz for this subject first. It unlocks the quizzes.");
      else if (blocked) setErr("This one isn't set up for your year group. Ask your tutor if you think that's a mistake.");
      else setErr(errMsg(e, "Couldn't start"));
      setPhase("intro");
    }
  };

  // Signed picture links are short-lived. When one fails to load the picture asks for a
  // fresh set: the same in-progress attempt is "resumed" by the server, which re-signs the
  // links. Never while the clock has run out (the server would discard that paper) and never
  // once handed in (it would open a NEW attempt).
  const refreshing = useRef<Promise<void> | null>(null);
  const refreshImages = useCallback(async () => {
    if (!run || phase === "result" || phase === "submitting" || submitted.current) return;
    if (deadline.current != null && Date.now() >= deadline.current - 5_000) return;
    if (refreshing.current) return refreshing.current;
    refreshing.current = (async () => {
      try {
        const r = await post<StartedAttempt>(hubPath(p.qs, `/assessments/${a.id}/attempts`, { childId }), { childId, ...(homeworkId ? { homeworkId } : {}) });
        if (r.attemptId !== run.attemptId) return;
        const fresh = new Map(r.questions.map((x) => [x.id, x]));
        setRun((cur) => cur && { ...cur, questions: cur.questions.map((x) => { const f = fresh.get(x.id); return f ? { ...x, image: f.image, options: x.options?.map((o) => ({ ...o, image: f.options?.find((y) => y.id === o.id)?.image ?? o.image })) } : x; }) });
      } finally { refreshing.current = null; }
    })();
    return refreshing.current;
  }, [run, phase, p.qs, a.id, childId, homeworkId]);

  const submit = useCallback(async (auto = false) => {
    if (!run || submitted.current) return;
    submitted.current = true;
    setConfirm(null); setPhase("submitting"); setErr(null);
    try {
      const body = run.questions.flatMap((q): { questionId: string; response: unknown }[] => {
        const v = answers[q.id];
        if (!isAnswered(v)) return [];
        if (Array.isArray(v) || typeof v === "object") return [{ questionId: q.id, response: v }]; // option ids, or a match / order arrangement
        const rule = ruleOf(p.config.questionKinds, q.kind);
        if (rule === "numeric") { const n = Number(String(v).replace(/,/g, "").trim()); return [{ questionId: q.id, response: Number.isFinite(n) ? n : v }]; }
        return [{ questionId: q.id, response: v }];
      });
      const r = await post<Result>(hubPath(p.qs, `/attempts/${run.attemptId}/submit`, { childId }), { answers: body });
      clearDraft(run.attemptId);
      setResult(r); setPhase("result"); onSubmitted();
    } catch (e) {
      submitted.current = false;
      setErr(errMsg(e, auto ? `Time ran out and we couldn't hand your ${noun} in` : "Couldn't hand in"));
      setPhase("review");
    }
  }, [run, answers, p.qs, p.config.questionKinds, childId, onSubmitted]);

  // Countdown. Auto-hands-in at zero.
  useEffect(() => {
    if (phase !== "taking" && phase !== "review") return;
    if (deadline.current == null) return;
    const tick = () => {
      const s = Math.max(0, Math.ceil((deadline.current! - Date.now()) / 1000));
      setLeft(s);
      if (s <= 0) void submit(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [phase, submit]);

  // Focus mode: while a student is in here the shell hides its hero + sidebar.
  // Always released on leave / unmount.
  const setFocus = useRef(p.setFocus);
  setFocus.current = p.setFocus;
  useEffect(() => {
    setFocus.current?.(true);
    return () => setFocus.current?.(false);
  }, []);

  // Keep the running answers on this device so a reload can resume the paper.
  useEffect(() => {
    if (run && (phase === "taking" || phase === "review")) saveDraft(run.attemptId, answers, idx);
  }, [run, answers, idx, phase]);

  // …and on the server too, so the same paper resumes on another device.
  useDraftSync(run ? hubPath(p.qs, `/attempts/${run.attemptId}/draft`, { childId }) : null, answers, idx, !!run && (phase === "taking" || phase === "review"));

  // "Resume your quiz": go straight back into the running paper.
  const resumed = useRef(false);
  useEffect(() => {
    if (resume && !resumed.current) { resumed.current = true; void start(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume]);

  useEffect(() => { topRef.current?.scrollIntoView({ block: phase === "result" ? "start" : "nearest", behavior: "smooth" }); }, [phase, idx]);

  const qs = run?.questions ?? [];
  const q = qs[idx];
  const answered = useMemo(() => qs.filter((x) => isAnswered(answers[x.id])).length, [qs, answers]);
  const unanswered = qs.length - answered;
  const set = (id: string, v: Answer) => setAnswers((m) => ({ ...m, [id]: v }));
  const meta = [
    { k: "Questions", v: String(a.questionCount ?? "—") },
    { k: "Marks", v: String(a.totalMarks ?? "—") },
    { k: "Time", v: a.timeLimitMins ? `${a.timeLimitMins} min` : "No limit" },
    ...(diag ? [] : [{ k: "Pass mark", v: `${a.passMarkPct}%` }]),
  ];

  // ── intro ──
  if (phase === "intro" || phase === "starting") {
    const resuming = !!resume && phase === "starting";
    return (
      <div ref={topRef} className="mx-auto w-full max-w-[680px]">
        <button type="button" onClick={onExit} className={`mb-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg pr-3 text-[13px] font-bold text-[var(--ink-2)] hover:text-[var(--brand)] ${FOCUS}`}><Icon name="arrowLeft" size={16} />Back</button>
        <Card className="overflow-hidden">
          <SubjectCover subject={a.subject} height={132} rounded="rounded-none" className="!h-auto min-h-[132px]">
            <div className="px-5 pb-4 pt-5 sm:px-8">
              <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--ink-2)]">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--surface)]/80 text-[var(--ink)]"><SubjectGlyph subject={a.subject} size={16} /></span>
                {a.subject}{diag ? " · Starting quiz" : ""}
              </div>
              <h3 className="m-0 mt-2.5 text-[24px] font-extrabold leading-tight text-[var(--ink)] sm:text-[26px]" style={display}>{welcome?.title ?? a.title}</h3>
              {welcome && <div className="mt-1 text-[13px] font-semibold text-[var(--ink-2)]">{a.title}</div>}
            </div>
          </SubjectCover>
          <div className="p-5 sm:p-7">
            {welcome && (
              <>
                <p className="m-0 text-[14.5px] leading-relaxed text-[var(--ink-2)]">{welcome.body}</p>
                <ul className="mx-0 mb-1 mt-3 grid list-none gap-2 p-0">
                  {welcome.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-[13.5px] text-[var(--ink)]"><span aria-hidden className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-[var(--green-soft)]" style={{ color: "var(--green)" }}><Icon name="check" size={12} strokeWidth={2.6} /></span>{b}</li>
                  ))}
                </ul>
              </>
            )}
            <dl className="m-0 mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {meta.map((m) => (
                <div key={m.k} className="rounded-xl bg-[var(--panel)] px-3 py-2.5 text-center">
                  <dd className="m-0 text-[17px] font-extrabold tabular-nums text-[var(--ink)]" style={display}>{m.v}</dd>
                  <dt className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">{m.k}</dt>
                </div>
              ))}
            </dl>
            {a.timeLimitMins ? <p className="m-0 mt-3 text-[12.5px] text-[var(--ink-3)]">The clock starts when you press Start and your answers are handed in automatically when time is up.</p> : null}
            {err && <div className="mt-4"><Notice tone={soft ? "warn" : "error"} onDismiss={() => setErr(null)}>{err}</Notice>{soft && <AskTutorLink subject={a.title} />}</div>}
            <div className="mt-5"><WhoIsLearning childId={childId} /></div>
            <div className="flex justify-center">
              <Button variant="solid" className={`${TAP} w-full !px-8 text-[14px] sm:w-auto`} disabled={phase === "starting" || !gate.ok} onClick={start} data-testid="hub-start">
                {phase === "starting" ? (resuming ? "Finding your answers…" : "Getting your questions…") : a.lastAttempt && !diag ? "Retake" : "Start"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ── result ──
  if (phase === "result" && result) {
    return (
      <div ref={topRef} className="mx-auto w-full max-w-[860px]">
        <div className="mb-2 flex items-center gap-2" data-testid="hub-result-for"><ChildChip childId={childId} /><span className="text-[12.5px] font-semibold text-[var(--ink-3)]">result saved</span></div>
        <ResultView kidYear={p.students.find((s) => s.childId === childId)?.yearGroup} result={result} questions={qs} topics={p.topics} config={p.config} type={a.type} passMarkPct={a.passMarkPct} title={a.title}
          actions={<>
            <Button variant="solid" className={TAP} onClick={onExit}>Back to {diag ? "starting quizzes" : "quizzes"}</Button>
            {!diag && (again.policy === "once"
              ? <span className="inline-flex min-h-[44px] flex-wrap items-center gap-x-1.5 rounded-full bg-[var(--panel)] px-4 text-[12.5px] font-bold text-[var(--ink-2)]">One attempt only. Ask your tutor if you need another go.<AskTutorLink subject={a.title} /></span>
              : again.policy === "cooldown"
                ? <span className="inline-flex min-h-[44px] items-center rounded-full bg-[var(--panel)] px-4 text-[12.5px] font-bold text-[var(--ink-2)]">You can retake this in {fmtWait(again.hours * 3_600_000)}</span>
                : <Button variant="ghost" className={TAP} onClick={() => { setResult(null); setRun(null); setAnswers({}); setPhase("intro"); }}>Retake</Button>)}
          </>}>
          {resultExtra?.(result)}
        </ResultView>
      </div>
    );
  }

  if (!run) return <div ref={topRef} className="mx-auto w-full max-w-[680px]"><div role="status" aria-label={`Opening your ${noun}`} className="grid gap-3"><div aria-hidden className="h-[72px] animate-pulse rounded-2xl bg-[var(--panel)]" /><div aria-hidden className="h-[280px] animate-pulse rounded-2xl bg-[var(--panel)]" /></div></div>;
  const urgent = left != null && left <= 60;

  // ── taking / review ──
  return (
    <div ref={topRef} className="mx-auto w-full max-w-[720px]" data-testid="hub-runner">
      <style>{`@keyframes hub-q-in{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}.hub-q-in{animation:hub-q-in .28s cubic-bezier(.2,.7,.2,1) both}@media (prefers-reduced-motion:reduce){.hub-q-in{animation:none}}`}</style>
      <div className="sticky top-0 z-10 -mx-1 mb-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)]/95 px-4 py-3 shadow-[var(--shadow-sm)] backdrop-blur">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setConfirm("leave")} aria-label={`Leave this ${noun}`} className={`grid h-11 w-11 flex-none place-items-center rounded-xl text-[var(--ink-2)] hover:bg-[var(--panel)] ${FOCUS}`}><Icon name="close" size={20} /></button>
          <SubjectCover subject={a.subject} height={40} width={40} rounded="rounded-xl" className="hidden sm:block"><span className="grid h-10 w-10 place-items-center"><SubjectGlyph subject={a.subject} size={20} /></span></SubjectCover>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-extrabold text-[var(--ink)]" style={display}>{a.title}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <ChildChip childId={childId} />
              <span className="text-[11.5px] font-semibold text-[var(--ink-3)]" aria-live="polite">{phase === "review" ? "Check your answers" : `Question ${idx + 1} of ${qs.length}`} · {answered} answered</span>
            </div>
          </div>
          {left != null && (
            <div role="timer" aria-label={`Time left ${mmss(left)}`} className="flex flex-none items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-extrabold tabular-nums" style={urgent ? { background: "var(--red-soft)", color: "var(--red)" } : { background: "var(--panel)", color: "var(--ink)" }}>
              <span aria-hidden>⏱</span>{mmss(left)}
            </div>
          )}
        </div>
        <div className="mt-2.5"><Meter pct={phase === "review" ? 100 : ((idx + 1) / qs.length) * 100} tone={{ fill: "var(--brand)", soft: "var(--brand-soft)", ink: "var(--brand-strong)" }} height={6} label="Progress" /></div>
      </div>

      {err && <div className="mb-3"><Notice onDismiss={() => setErr(null)}>{err}</Notice></div>}
      {left != null && left <= 0 && <div className="mb-3"><Notice tone="warn">Time&apos;s up. Handing in your answers…</Notice></div>}

      {phase === "taking" && q && (
        <Card className="p-4 sm:p-6">
          <div key={q.id} className="hub-q-in" onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT" && (e.target as HTMLInputElement).type === "text") { e.preventDefault(); if (idx < qs.length - 1) setIdx(idx + 1); else setPhase("review"); } }}>
            <QuestionView q={q} rule={ruleOf(p.config.questionKinds, q.kind)} value={answers[q.id]} onChange={(v) => set(q.id, v)} onRefreshImages={refreshImages} />
          </div>
          <div className="mt-6 flex items-center justify-between gap-2">
            <Button variant="ghost" className={`${TAP} !px-5`} disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Back</Button>
            {idx < qs.length - 1
              ? <Button variant="solid" className={`${TAP} !px-6`} onClick={() => setIdx(idx + 1)} data-testid="hub-next">{isAnswered(answers[q.id]) ? "Next →" : "Skip →"}</Button>
              : <Button variant="solid" className={`${TAP} !px-6`} onClick={() => setPhase("review")} data-testid="hub-review">Review answers</Button>}
          </div>
        </Card>
      )}

      {phase === "taking" && qs.length > 1 && (
        <nav aria-label="Jump to a question" className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {qs.map((x, i) => {
            const done = isAnswered(answers[x.id]);
            const cur = i === idx;
            return (
              <button key={x.id} type="button" onClick={() => setIdx(i)} aria-label={`Question ${i + 1}${done ? ", answered" : ""}`} aria-current={cur ? "step" : undefined}
                className={`grid h-11 min-w-[44px] flex-none place-items-center rounded-xl border-2 text-[12.5px] font-extrabold tabular-nums transition-colors ${FOCUS} ${cur ? "border-[var(--brand)] bg-[var(--brand)] text-white" : done ? "border-[var(--brand-line)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-3)]"}`}>{i + 1}</button>
            );
          })}
        </nav>
      )}

      {(phase === "review" || phase === "submitting") && (
        <Card className="p-4 sm:p-6">
          <h3 className="m-0 text-[18px] font-extrabold text-[var(--ink)]" style={display}>Ready to hand in?</h3>
          <p className="mt-1 text-[13px] text-[var(--ink-2)]">Tap a question to go back to it.</p>
          {unanswered > 0 && <div className="mt-3"><Notice tone="warn">You haven&apos;t answered {unanswered} {unanswered === 1 ? "question" : "questions"} yet. Unanswered questions score no marks.</Notice></div>}
          <ol className="m-0 mt-4 grid list-none gap-2 p-0">
            {qs.map((x, i) => {
              const done = isAnswered(answers[x.id]);
              return (
                <li key={x.id}>
                  <button type="button" onClick={() => { setIdx(i); setPhase("taking"); }} className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-left hover:border-[var(--brand)] ${FOCUS}`}>
                    <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-[var(--panel)] text-[12px] font-extrabold text-[var(--ink-2)]">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--ink)]">{x.prompt}</span>
                    {done ? <Chip tone={{ fill: "", soft: "var(--green-soft)", ink: "color-mix(in srgb, var(--green) 50%, var(--ink))" }} icon="✓">Answered</Chip> : <Chip tone={{ fill: "", soft: "var(--gold-soft)", ink: "color-mix(in srgb, var(--gold) 30%, var(--ink))" }}>Blank</Chip>}
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-5 flex items-center justify-between gap-2">
            <Button variant="ghost" className={`${TAP} !px-5`} onClick={() => { setIdx(qs.length - 1); setPhase("taking"); }} disabled={phase === "submitting"}>← Back</Button>
            <Button variant="solid" className={`${TAP} !px-6`} onClick={() => setConfirm("submit")} disabled={phase === "submitting"} data-testid="hub-handin">{phase === "submitting" ? "Marking…" : "Hand in"}</Button>
          </div>
        </Card>
      )}

      {confirm === "submit" && (
        <Modal title="Hand in your answers?" onClose={() => setConfirm(null)}
          footer={<><Button variant="ghost" className={TAP} onClick={() => setConfirm(null)}>Keep going</Button><Button variant="solid" className={TAP} onClick={() => submit()} data-testid="hub-confirm-submit" data-autofocus>Yes, hand in</Button></>}>
          <p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">
            {unanswered > 0 ? <>You still have <b className="text-[var(--ink)]">{unanswered} unanswered</b>. </> : "You've answered every question. "}
            Once you hand in you can&apos;t change your answers.
          </p>
        </Modal>
      )}
      {confirm === "leave" && (
        <Modal title={`Leave this ${noun} for now?`} onClose={() => setConfirm(null)}
          footer={<><Button variant="ghost" className={TAP} onClick={() => setConfirm(null)}>Stay</Button><Button variant="solid" className={TAP} onClick={onExit}>Leave for now</Button></>}>
          <p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">Your answers are saved, so you can pick this up again from the list (on this device or another){a.timeLimitMins ? ", but the clock keeps running" : ""}.</p>
        </Modal>
      )}
    </div>
  );
}
